from rest_framework import viewsets, permissions, status, serializers
from rest_framework.decorators import APIView, action, api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from django.shortcuts import get_object_or_404, redirect
from django.db.models import Q
import json
from datetime import datetime
import iyzipay
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

    # YENİ: Sadece ana listelemede is_available=True kuralını uygular.
    # Detay veya profil sayfalarından gelindiğinde (action != 'list') tüm ilanları getirir ve 404'ü çözer.
    def get_queryset(self):
        if self.action == 'list':
            return Item.objects.filter(is_available=True).prefetch_related('images').order_by("-created_at")
        return Item.objects.all().prefetch_related('images').order_by("-created_at")

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

            # 🎯 SATICI ONAYLADIĞI İÇİN PARA ŞİMDİ HESABINA GEÇİYOR
            owner_wallet, _ = Wallet.objects.get_or_create(user=booking.item.owner)
            owner_wallet.balance += Decimal(str(booking.total_price))
            owner_wallet.save()

            WalletTransaction.objects.create(
                wallet=owner_wallet,
                transaction_type='INCOME',
                amount=booking.total_price,
                description=f"{booking.item.title} kiralama onayı geliri"
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
        
    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        booking = self.get_object()
        user = request.user
        
        if user not in [booking.item.owner, booking.renter]:
            return Response({"error": "Yetkisiz işlem."}, status=status.HTTP_403_FORBIDDEN)
            
        if booking.status in ['active', 'completed', 'disputed']:
            return Response({"error": "Bu aşamadaki bir işlem iptal edilemez."}, status=status.HTTP_400_BAD_REQUEST)
            
        with transaction.atomic():
            # 1. Modeli baz alarak net ödenen tutarı hesapla
            rent_amount = Decimal(str(booking.total_price))
            deposit_amount = Decimal(str(booking.deposit_price))
            total_paid = rent_amount + deposit_amount
            
            refund_amount = total_paid
            penalty_amount = Decimal('0.00')

            # 2. 🎯 CEZA (PENALTY) MANTIĞI: Sadece Onaylanmış işlemde ve KİRACI iptal ederse
            if booking.status == 'approved' and user == booking.renter:
                now = timezone.now().date()
                days_until_start = (booking.start_date - now).days
                
                # Eğer kiralamaya 2 günden (48 saat) az kalmışsa iptal cezası uygula!
                if days_until_start <= 2:
                    # Depozito her zaman tam iade edilir. Kira bedelinin %20'si yanar.
                    penalty_amount = rent_amount * Decimal('0.20')
                    refund_amount = total_paid - penalty_amount
            
            # 3. 🎯 SATICIDAN PARAYI GERİ AL (Satıcıya sadece onayladığında kira geliri geçmişti)
            if booking.status == 'approved':
                owner_wallet = Wallet.objects.get(user=booking.item.owner)
                
                # Kiracı geç iptalden ceza yediyse, o ceza tutarı satıcıda "teselli" olarak kalır
                amount_to_deduct = rent_amount - penalty_amount
                
                owner_wallet.balance -= amount_to_deduct
                owner_wallet.save()
                
                WalletTransaction.objects.create(
                    wallet=owner_wallet,
                    transaction_type='PAYMENT',
                    amount=amount_to_deduct,
                    description=f"{booking.item.title} iptali (Geri Alım)"
                )
            
            # 4. 🎯 KİRACIYA PARAYI İADE ET
            if booking.status in ['pending_approval', 'approved']:
                renter_wallet = Wallet.objects.get(user=booking.renter)
                renter_wallet.balance += refund_amount
                renter_wallet.save()
                
                desc = f"{booking.item.title} iptal iadesi (Depozito dâhil)"
                if penalty_amount > 0:
                    desc += f" (Geç iptal cezası: -{penalty_amount} TL)"

                WalletTransaction.objects.create(
                    wallet=renter_wallet,
                    transaction_type='INCOME', 
                    amount=refund_amount,
                    description=desc
                )

            booking.status = 'rejected'
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
        content = request.data.get('content')
        
        if not content:
            return Response({"error": "Mesaj içeriği boş olamaz."}, status=status.HTTP_400_BAD_REQUEST)
            
        message = Message.objects.create(
            conversation=conversation,
            sender=request.user,
            content=content
        )
        conversation.updated_at = message.created_at
        conversation.save()
        
        serializer = MessageSerializer(message, context={'request': request})
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    
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


class PayWithWalletView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, item_id):
        renter = request.user
        start_date_str = request.data.get('start_date')
        end_date_str = request.data.get('end_date')
        total_price_raw = request.data.get('total_price')

        if not all([start_date_str, end_date_str, total_price_raw]):
            return Response({"error": "Eksik bilgi gönderildi."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            start_date = datetime.strptime(start_date_str, "%Y-%m-%d").date()
            end_date = datetime.strptime(end_date_str, "%Y-%m-%d").date()
            total_price = Decimal(str(total_price_raw))
            item = Item.objects.get(id=item_id)
        except Item.DoesNotExist:
            return Response({"error": "İlan bulunamadı."}, status=status.HTTP_404_NOT_FOUND)
        except ValueError:
            return Response({"error": "Geçersiz tarih veya fiyat formatı."}, status=status.HTTP_400_BAD_REQUEST)

        if item.owner == renter:
            return Response({"error": "Kendi ürününüzü kiralayamazsınız."}, status=status.HTTP_400_BAD_REQUEST)

        renter_wallet, _ = Wallet.objects.get_or_create(user=renter)
        renter_balance = Decimal(str(renter_wallet.balance))

        if renter_balance < total_price:
            return Response({"error": "Cüzdan bakiyeniz yetersiz. Lütfen bakiye yükleyin."}, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            # SADECE KİRACIDAN KESİYORUZ (Sistem güvencesine alındı)
            renter_wallet.balance = renter_balance - total_price
            renter_wallet.save()

            WalletTransaction.objects.create(
                wallet=renter_wallet,
                transaction_type='PAYMENT',
                amount=total_price,
                description=f"{item.title} kiralama talebi (Onay Bekliyor)"
            )

            # OTOMATİK ONAY YERİNE BEKLEMEYE ALDIK
            booking = Booking.objects.create(
                item=item,
                renter=renter,
                start_date=start_date,
                end_date=end_date,
                total_price=total_price,
                status='pending_approval' 
            )

        return Response({
            "message": "Kiralama talebiniz satıcıya iletildi. Onay bekleniyor.",
            "booking_id": booking.id
        }, status=status.HTTP_201_CREATED)