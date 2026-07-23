from rest_framework import viewsets, permissions, status, serializers, filters
from rest_framework.decorators import APIView, action, api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from django.shortcuts import get_object_or_404, redirect
from django.db.models import Q
import json
from datetime import datetime
import iyzipay
from django.utils import timezone
from django.db import transaction
from decimal import Decimal
from users.models import Wallet, WalletTransaction
from django.contrib.auth import get_user_model
from .models import Category, Item, Booking, Conversation, Message, ItemImage, BookingImage, Review, Notification
from .serializers import CategorySerializer, ItemSerializer, BookingSerializer, StoreDetailSerializer, ConversationSerializer, MessageSerializer, ReviewSerializer, NotificationSerializer

User = get_user_model()

class CategoryViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Category.objects.all()
    serializer_class = CategorySerializer
    permission_classes = [permissions.AllowAny]


class ItemViewSet(viewsets.ModelViewSet):
    serializer_class = ItemSerializer

    filter_backends = [filters.SearchFilter]
    search_fields = ['title', 'description', 'category__name']

    def get_queryset(self):
        # 1. Süresi dolan banları kaldır
        expired_bans = Item.objects.filter(is_banned=True, banned_until__lte=timezone.now())
        for item in expired_bans:
            item.is_banned = False
            item.banned_until = None
            item.is_available = True
            item.save()

        # 2. Temel Sorgu
        queryset = Item.objects.all().prefetch_related('images').order_by("-created_at")

        if self.action == 'list':
            # Sadece aktif ve banlanmamış olanları getir
            queryset = queryset.filter(is_available=True, is_banned=False)
            
            # 🎯 YENİ: URL'den gelen Şehir ve İlçe filtrelerini uygula
            city = self.request.query_params.get('city', None)
            district = self.request.query_params.get('district', None)
            
            if city:
                queryset = queryset.filter(city__iexact=city) # Büyük/küçük harf duyarsız arama
            if district:
                queryset = queryset.filter(district__iexact=district)

        return queryset

    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated])
    def favorite(self, request, pk=None):
        item = self.get_object()
        user = request.user
        
        if item.favorites.filter(id=user.id).exists():
            item.favorites.remove(user)
            return Response({"is_favorite": False, "message": "Favorilerden çıkarıldı."}, status=status.HTTP_200_OK)
        else:
            item.favorites.add(user)
            return Response({"is_favorite": True, "message": "Favorilere eklendi."}, status=status.HTTP_200_OK)

    @action(detail=False, methods=['get'], permission_classes=[IsAuthenticated])
    def my_favorites(self, request):
        user = request.user
        favorite_items = Item.objects.filter(favorites=user, is_available=True).prefetch_related('images').order_by('-created_at')
        serializer = self.get_serializer(favorite_items, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'], url_path='stores/(?P<store_id>[^/.]+)', permission_classes=[AllowAny])
    def store_detail(self, request, store_id=None):
        store_user = get_object_or_404(User, id=store_id)
        serializer = StoreDetailSerializer(store_user, context={'request': request})
        return Response(serializer.data, status=status.HTTP_200_OK)

    def get_permissions(self):
        if self.action in ['list', 'retrieve', 'store_detail']:
            return [permissions.AllowAny()]
        return [permissions.IsAuthenticated()]

    def perform_create(self, serializer):
        item = serializer.save(owner=self.request.user)
        images = self.request.FILES.getlist('images')
        
        try:
            main_index = int(self.request.data.get('main_image_index', 0))
        except ValueError:
            main_index = 0
            
        if main_index >= len(images):
            main_index = 0
        
        for index, img in enumerate(images):
            is_main = True if index == main_index else False
            ItemImage.objects.create(item=item, image=img, is_main=is_main)


class BookingViewSet(viewsets.ModelViewSet):
    serializer_class = BookingSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        from django.db.models import Q
        return Booking.objects.filter(Q(renter=user) | Q(item__owner=user)).order_by('-created_at')

    def perform_create(self, serializer):
        serializer.save(renter=self.request.user)

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        booking = self.get_object()
        if request.user != booking.item.owner:
            return Response({"error": "Sadece ilan sahibi onaylayabilir."}, status=status.HTTP_403_FORBIDDEN)
        if booking.status != 'pending_approval':
            return Response({"error": "Sadece onay bekleyen işlemler onaylanabilir."}, status=status.HTTP_400_BAD_REQUEST)
            
        with transaction.atomic():
            booking.status = 'approved'
            booking.save()

            owner_wallet, _ = Wallet.objects.get_or_create(user=booking.item.owner)
            owner_wallet.balance += Decimal(str(booking.total_price))
            owner_wallet.save()

            # 🎯 DETAYLI SATICI GELİR LOGU
            WalletTransaction.objects.create(
                wallet=owner_wallet,
                transaction_type='INCOME',
                amount=booking.total_price,
                description=f"'{booking.item.title}' kiralaması ({booking.start_date.strftime('%d.%m.%Y')}) onaylandı. Kira geliri."
            )

            # 🎯 BİLDİRİM - KİRACIYA: Talebin onaylandı!
            Notification.objects.create(
                user=booking.renter,
                sender=booking.item.owner,
                item=booking.item,
                notification_type='system',
                reference_id=str(booking.id),
                message=f"Tebrikler! '{booking.item.title}' kiralama talebiniz satıcı tarafından onaylandı."
            )

        return Response({"message": "Onaylandı. Kira bedeli cüzdanınıza eklendi."}, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'])
    def handover(self, request, pk=None):
        booking = self.get_object()
        provided_pin = request.data.get('pin')
        images = request.FILES.getlist('images') # List olarak alıyoruz

        if request.user != booking.item.owner:
            return Response({"error": "Sadece ilan sahibi teslimatı başlatabilir."}, status=status.HTTP_403_FORBIDDEN)
        if booking.status != 'approved':
            return Response({"error": "Ürün onaylanmamış veya zaten teslim edilmiş."}, status=status.HTTP_400_BAD_REQUEST)
        if provided_pin != booking.handover_pin:
            return Response({"error": "Hatalı Teslimat PIN Kodu!"}, status=status.HTTP_400_BAD_REQUEST)
        if not images or len(images) == 0:
            return Response({"error": "Teslimat anı fotoğrafı yüklemek zorunludur."}, status=status.HTTP_400_BAD_REQUEST)
        if len(images) > 3:
            return Response({"error": "En fazla 3 fotoğraf yükleyebilirsiniz."}, status=status.HTTP_400_BAD_REQUEST)
            
        booking.status = 'active'
        booking.item.is_available = False 
        booking.item.save()
        booking.save()

        # Resimleri ilişki modeline kaydet
        for img in images:
            BookingImage.objects.create(booking=booking, image=img, image_type='handover')

        return Response({"message": "PIN ve Fotoğraflar Doğrulandı. Kiralama Başladı."}, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'])
    def complete(self, request, pk=None):
        booking = self.get_object()
        provided_pin = request.data.get('pin')
        images = request.FILES.getlist('images')

        if request.user != booking.renter:
            return Response({"error": "Sadece kiracı iade işlemini tamamlayabilir."}, status=status.HTTP_403_FORBIDDEN)
        if booking.status != 'active':
            return Response({"error": "Bu kiralama şu an aktif değil."}, status=status.HTTP_400_BAD_REQUEST)
        if provided_pin != booking.return_pin:
            return Response({"error": "Hatalı İade PIN Kodu!"}, status=status.HTTP_400_BAD_REQUEST)
        if not images or len(images) == 0:
            return Response({"error": "İade anı fotoğrafı yüklemek zorunludur."}, status=status.HTTP_400_BAD_REQUEST)
        if len(images) > 3:
            return Response({"error": "En fazla 3 fotoğraf yükleyebilirsiniz."}, status=status.HTTP_400_BAD_REQUEST)
            
        booking.status = 'completed'
        booking.item.is_available = True 
        booking.item.save()
        booking.save()

        for img in images:
            BookingImage.objects.create(booking=booking, image=img, image_type='return')

        return Response({"message": "PIN ve Fotoğraflar Doğrulandı. Kiralama Tamamlandı."}, status=status.HTTP_200_OK)
        
    from datetime import timedelta # En üste eklemeyi unutma

    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        booking = self.get_object()
        user = request.user
        
        if user not in [booking.item.owner, booking.renter]:
            return Response({"error": "Yetkisiz işlem."}, status=status.HTTP_403_FORBIDDEN)
            
        if booking.status in ['active', 'completed', 'disputed']:
            return Response({"error": "Bu aşamadaki bir işlem iptal edilemez."}, status=status.HTTP_400_BAD_REQUEST)
            
        with transaction.atomic():
            booking.cancelled_by = user

            rent_amount = Decimal(str(booking.total_price))
            deposit_amount = Decimal(str(booking.deposit_price))
            total_paid = rent_amount + deposit_amount
            
            refund_amount = total_paid
            penalty_amount = Decimal('0.00')
            date_str = booking.start_date.strftime('%d.%m.%Y')

            # 🎯 24 SAAT KONTROLÜ (Bugün 21'i, kiralama 22'si ise days_until_start = 1 olur)
            is_late_cancel = False
            if booking.status == 'approved':
                now = timezone.now().date()
                days_until_start = (booking.start_date - now).days
                if days_until_start <= 1: # 1 gün (24 saat) veya daha az kaldıysa
                    is_late_cancel = True

            # 1. KİRACI (ALICI) GEÇ İPTAL EDERSE -> %20 Para Cezası
            if booking.status == 'approved' and user == booking.renter and is_late_cancel:
                penalty_amount = rent_amount * Decimal('0.20')
                refund_amount = total_paid - penalty_amount
                
            # 2. SATICI GEÇ İPTAL EDERSE -> İlanı 1 Hafta Yasakla & Güven Puanı Düşür
            if booking.status == 'approved' and user == booking.item.owner and is_late_cancel:
                item = booking.item
                item.is_banned = True
                item.banned_until = timezone.now() + timedelta(days=7) # 🎯 1 HAFTA CEZA
                item.is_available = False
                item.save()
                
                owner = item.owner
                owner.trust_score = max(1.0, owner.trust_score - 0.5) # Güven puanını yarım puan kır
                owner.save()
                
                Notification.objects.create(
                    user=owner,
                    notification_type='system',
                    reference_id=str(booking.id),
                    message=f"🚨 CEZA: '{item.title}' kiralama işlemini son 24 saat içinde iptal ettiğiniz için ilanınız 1 hafta ({item.banned_until.strftime('%d.%m.%Y')}) süreyle askıya alınmış ve puanınız düşürülmüştür."
                )

            # --- SATICI CÜZDAN İŞLEMLERİ ---
            if booking.status == 'approved':
                owner_wallet = Wallet.objects.get(user=booking.item.owner)
                amount_to_deduct = rent_amount - penalty_amount
                owner_wallet.balance -= amount_to_deduct
                owner_wallet.save()
                
                owner_desc = f"'{booking.item.title}' iptal (Geri alım)."
                if penalty_amount > 0:
                    owner_desc = f"'{booking.item.title}' kiracı son 24 saatte iptal ettiği için {penalty_amount} ₺ ceza cüzdanınızda teselli geliri olarak bırakıldı."
                elif user == booking.item.owner:
                    owner_desc = f"'{booking.item.title}' işlemini iptal ettiniz. Kiralama bedeli iade edilmek üzere cüzdanınızdan düşüldü."

                WalletTransaction.objects.create(wallet=owner_wallet, transaction_type='PAYMENT', amount=amount_to_deduct, description=owner_desc)

                if user == booking.renter:
                    Notification.objects.create(user=booking.item.owner, sender=user, item=booking.item, notification_type='system', reference_id=str(booking.id), message=f"Kiracı '{booking.item.title}' ({date_str}) talebini iptal etti.")
            
            # --- KİRACI CÜZDAN İŞLEMLERİ ---
            if booking.status in ['pending_approval', 'approved']:
                renter_wallet = Wallet.objects.get(user=booking.renter)
                renter_wallet.balance += refund_amount
                renter_wallet.save()
                
                renter_desc = f"'{booking.item.title}' iptal iadesi."
                if penalty_amount > 0:
                    renter_desc = f"'{booking.item.title}' kiralamasını son 24 saat içinde iptal ettiğiniz için {penalty_amount} ₺ ceza kesilerek kalan tutar iade edildi."
                elif user == booking.item.owner:
                    renter_desc = f"'{booking.item.title}' satıcı tarafından iptal edildi. Paranızın tamamı kesintisiz iade edildi."

                WalletTransaction.objects.create(wallet=renter_wallet, transaction_type='REFUND', amount=refund_amount, description=renter_desc)

                if user == booking.item.owner:
                    Notification.objects.create(user=booking.renter, sender=user, item=booking.item, notification_type='system', reference_id=str(booking.id), message=f"Satıcı '{booking.item.title}' ({date_str}) işlemini iptal etti. Tutarınız cüzdanınıza iade edildi.")

            booking.status = 'rejected'
            
            # Ürünü tekrar müsait yapıyoruz (Eğer satıcı ceza yediyse yukarıda is_banned=True olduğu için gizli kalmaya devam edecek)
            if not booking.item.is_banned:
                booking.item.is_available = True
                booking.item.save()
            booking.save()

        return Response({
            "message": "İşlem iptal edildi ve bakiye güncellendi.",
            "refunded": refund_amount,
            "penalty": penalty_amount
        }, status=status.HTTP_200_OK)


class ConversationViewSet(viewsets.ModelViewSet):
    serializer_class = ConversationSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        return Conversation.objects.filter(Q(renter=user) | Q(owner=user))

    def create(self, request, *args, **kwargs):
        item_id = request.data.get('item')
        existing_conv = Conversation.objects.filter(item_id=item_id, renter=request.user).first()
        if existing_conv:
            serializer = self.get_serializer(existing_conv, context={'request': request})
            return Response(serializer.data, status=status.HTTP_200_OK)

        return super().create(request, *args, **kwargs)

    def perform_create(self, serializer):
        item = get_object_or_404(Item, id=self.request.data.get('item'))
        serializer.save(renter=self.request.user, owner=item.owner)

    @action(detail=True, methods=['get'])
    def messages(self, request, pk=None):
        conversation = self.get_object()
        conversation.messages.filter(is_read=False).exclude(sender=request.user).update(is_read=True)
        messages = conversation.messages.all()
        serializer = MessageSerializer(messages, many=True, context={'request': request})
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def send_message(self, request, pk=None):
        conversation = self.get_object()
        content = request.data.get('content', '')
        
        # Konum Verileri
        is_location_share = request.data.get('is_location_share', False)
        location_lat = request.data.get('location_lat')
        location_lon = request.data.get('location_lon')
        location_address = request.data.get('location_address')
        
        # 🎯 YENİ: Teklif Verilerini de Yakalıyoruz
        is_offer = request.data.get('is_offer', False)
        offer_price = request.data.get('offer_price')
        offer_start_date = request.data.get('start_date')
        offer_end_date = request.data.get('end_date')
        
        # Eğer mesaj sadece metinse içerik boş olamaz (Konum veya teklifse içerik boş olabilir)
        if not content and not is_location_share and not is_offer:
            return Response({"error": "Mesaj içeriği boş olamaz."}, status=status.HTTP_400_BAD_REQUEST)
            
        message = Message.objects.create(
            conversation=conversation,
            sender=request.user,
            content=content,
            is_location_share=is_location_share,
            location_lat=location_lat,
            location_lon=location_lon,
            location_address=location_address,
            is_offer=is_offer,
            offer_price=offer_price,
            offer_start_date=offer_start_date,
            offer_end_date=offer_end_date,
            offer_status='pending' if is_offer else request.data.get('offer_status')
        )
        
        conversation.updated_at = message.created_at
        conversation.save()
        
        serializer = MessageSerializer(message, context={'request': request})
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    
    @action(detail=False, methods=['get'])
    def check_existing(self, request):
        """Frontend'den İlan Detay sayfasında tıklandığında sohbetin var olup olmadığını kontrol eder."""
        item_id = request.query_params.get('item_id')
        conv = Conversation.objects.filter(item_id=item_id, renter=request.user).first()
        if conv:
            return Response({"exists": True, "conversation_id": conv.id})
        return Response({"exists": False})

    @action(detail=False, methods=['post'])
    def send_direct_message(self, request):
        """Kullanıcı ilk defa yazıyorsa veya teklif atıyorsa Sohbeti ve Mesajı aynı anda (Atomic) oluşturur."""
        item_id = request.data.get('item_id')
        content = request.data.get('content', '')
        
        # Konum Verileri
        is_location_share = request.data.get('is_location_share', False)
        location_lat = request.data.get('location_lat')
        location_lon = request.data.get('location_lon')
        location_address = request.data.get('location_address')
        offer_status = request.data.get('offer_status')
        
        # Teklif Verileri
        is_offer = request.data.get('is_offer', False)
        offer_price = request.data.get('offer_price')
        start_date = request.data.get('start_date')
        end_date = request.data.get('end_date')

        item = get_object_or_404(Item, id=item_id)
        user = request.user

        if item.owner == user:
            return Response({"error": "Kendi ilanınıza mesaj atamazsınız."}, status=status.HTTP_400_BAD_REQUEST)

        # 1. Konuşma var mı bak, yoksa ŞİMDİ YARAT (Buraya sadece Conversation alanları girer!)
        conversation, created = Conversation.objects.get_or_create(
            item=item,
            renter=user,
            owner=item.owner
        )

        # 2. Mesajı Yarat (Konum ve Teklif verileri BURAYA eklenmeli!)
        message = Message.objects.create(
            conversation=conversation,
            sender=user,
            content=content,
            is_offer=is_offer,
            offer_price=offer_price,
            offer_start_date=start_date,
            offer_end_date=end_date,
            offer_status='pending' if is_offer else offer_status, # Teklifse pending, konumsa gelen status
            is_location_share=is_location_share,
            location_lat=location_lat,
            location_lon=location_lon,
            location_address=location_address
        )

        # Sohbetin güncellenme tarihini yenile
        conversation.updated_at = message.created_at
        conversation.save()

        # Cevap olarak conversation_id'yi dönüyoruz ki frontend bu ID ile sohbete girebilsin
        return Response({
            "message": "Mesaj başarıyla gönderildi.",
            "conversation_id": conversation.id
        }, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['post'])
    def respond_offer(self, request):
        """Karşı tarafın gönderdiği teklifi veya konumu Kabul/Reddet işlemi yapar"""
        message_id = request.data.get('message_id')
        action_type = request.data.get('action')  # 'accept' veya 'reject'

        if not message_id or action_type not in ['accept', 'reject']:
            return Response({"error": "Geçersiz veya eksik parametre."}, status=status.HTTP_400_BAD_REQUEST)

        # Mesajı veritabanından bul (import etmediysen en üste 'from .models import Message' ekleyebilirsin)
        message = get_object_or_404(Message, id=message_id)

        # Güvenlik Duvarı: Kullanıcı kendi gönderdiği teklifi kabul/red edemez!
        if message.sender == request.user:
            return Response({"error": "Kendi teklifinize/konumunuza yanıt veremezsiniz."}, status=status.HTTP_400_BAD_REQUEST)

        # Durumu güncelle
        message.offer_status = 'accepted' if action_type == 'accept' else 'rejected'
        message.save()

        # Sohbetin de güncellenme tarihini yenileyelim ki listelerde üste çıksın
        conversation = message.conversation
        conversation.updated_at = message.updated_at if hasattr(message, 'updated_at') else message.created_at
        conversation.save()

        return Response({"message": "İşlem başarıyla gerçekleşti.", "offer_status": message.offer_status}, status=status.HTTP_200_OK)
    
class ReviewViewSet(viewsets.ModelViewSet):
    queryset = Review.objects.all()
    serializer_class = ReviewSerializer
    permission_classes = [IsAuthenticated]

    def perform_create(self, serializer):
        booking = serializer.validated_data['booking']
        
        # Güvenlik Kontrolleri
        if self.request.user != booking.renter:
            raise serializers.ValidationError({"error": "Sadece eşyayı kiralayan kişi yorum yapabilir."})
            
        if Review.objects.filter(booking=booking).exists():
            raise serializers.ValidationError({"error": "Bu kiralama işlemi için zaten bir değerlendirme yaptınız."})

        # Yorumu kaydet (item ve owner otomatik olarak booking'den çekilir)
        serializer.save(
            reviewer=self.request.user,
            item=booking.item,
            owner=booking.item.owner
        )

@api_view(['GET', 'PATCH'])
@permission_classes([IsAuthenticated])
def notification_list(request):
    if request.method == 'GET':
        # Kullanıcının bildirimlerini getir
        notifications = Notification.objects.filter(user=request.user)
        serializer = NotificationSerializer(notifications, many=True)
        return Response(serializer.data)
        
    elif request.method == 'PATCH':
        # İkona tıklandığında hepsini "Okundu" olarak işaretle (Sayı sıfırlanır)
        Notification.objects.filter(user=request.user, is_read=False).update(is_read=True)
        return Response({"message": "Tümü okundu olarak işaretlendi."})

@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def notification_delete(request, pk):
    # Kullanıcı X'e bastığında bildirimi tamamen siler
    try:
        notification = Notification.objects.get(pk=pk, user=request.user)
        notification.delete()
        return Response({"message": "Bildirim silindi."})
    except Notification.DoesNotExist:
        return Response({"error": "Bulunamadı."}, status=404)
    
@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def notification_clear_all(request):
    # Kullanıcıya ait olan tüm bildirimleri siler
    Notification.objects.filter(user=request.user).delete()
    return Response({"message": "Tüm bildirimler başarıyla temizlendi."})


class PayWithWalletView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, item_id):
        renter = request.user
        start_date_str = request.data.get('start_date')
        end_date_str = request.data.get('end_date')
        
        # 🎯 DÜZELTME: Frontend artık sadece KİRA BEDELİNİ gönderiyor (Teklif tutarı veya Standart Tutar)
        base_price_raw = request.data.get('total_price')

        if not all([start_date_str, end_date_str, base_price_raw]):
            return Response({"error": "Eksik bilgi gönderildi."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            start_date = datetime.strptime(start_date_str, "%Y-%m-%d").date()
            end_date = datetime.strptime(end_date_str, "%Y-%m-%d").date()
            
            # 🎯 MATEMATİK BURADA YAPILIYOR
            base_price = Decimal(str(base_price_raw))
            deposit_price = base_price * Decimal('0.15')
            total_deduction = base_price + deposit_price # Cüzdandan kesilecek GERÇEK tutar
            
            item = Item.objects.get(id=item_id)
        except Item.DoesNotExist:
            return Response({"error": "İlan bulunamadı."}, status=status.HTTP_404_NOT_FOUND)
        except ValueError:
            return Response({"error": "Geçersiz tarih veya fiyat formatı."}, status=status.HTTP_400_BAD_REQUEST)

        if item.owner == renter:
            return Response({"error": "Kendi ürününüzü kiralayamazsınız."}, status=status.HTTP_400_BAD_REQUEST)

        renter_wallet, _ = Wallet.objects.get_or_create(user=renter)
        
        # Bakiye kontrolünü total_deduction (Kira + Depozito) üzerinden yap
        if Decimal(str(renter_wallet.balance)) < total_deduction:
            return Response({"error": f"Cüzdan bakiyeniz yetersiz. Depozito dâhil toplam {total_deduction} ₺ gerekiyor."}, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            # Cüzdandan tüm parayı kes (Kira + Depozito)
            renter_wallet.balance -= total_deduction
            renter_wallet.save()

            WalletTransaction.objects.create(
                wallet=renter_wallet,
                transaction_type='PAYMENT',
                amount=total_deduction,
                description=f"'{item.title}' kiralama talebi (Onay Bekliyor) - Kira ({base_price} ₺) + %15 Güvence Bedeli."
            )

            # Modele sadece kira bedelini ver, save() fonksiyonu deposit_price'ı otomatik hesaplayacak!
            booking = Booking.objects.create(
                item=item,
                renter=renter,
                start_date=start_date,
                end_date=end_date,
                total_price=base_price, 
                status='pending_approval' 
            )

            Notification.objects.create(
                user=renter,
                sender=None,
                item=item,
                notification_type='wallet',
                reference_id=str(booking.id),
                message=f"'{item.title}' talebiniz oluşturuldu. Toplam {total_deduction} ₺ cüzdanınızdan çekilerek güvenli sistem havuzuna aktarıldı."
            )

        return Response({
            "message": "Kiralama talebiniz başarıyla oluşturuldu.",
            "booking_id": booking.id
        }, status=status.HTTP_201_CREATED)