from rest_framework import viewsets, permissions, status, filters, serializers
from rest_framework.decorators import APIView, action, api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny, IsAdminUser, IsAuthenticatedOrReadOnly
from django.shortcuts import get_object_or_404
from django.db.models import Q, Sum
from django.core.cache import cache
from datetime import datetime, timedelta
from django.utils import timezone
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from django.utils.text import slugify
from django.db import transaction
from decimal import Decimal
import filetype
import traceback # 🚨 DEBUG İÇİN EKLENDİ
from django.contrib.auth import get_user_model

from rest_framework.exceptions import ValidationError as DRFValidationError

from users.models import Wallet, WalletTransaction, WithdrawalRequest
from .models import (Category, Item, Booking, Conversation, Message, ItemImage, 
                     BookingImage, Review, Notification, ActivityLog, Report, Ticket)
from .serializers import (CategorySerializer, ItemSerializer, BookingSerializer, 
                          StoreDetailSerializer, ConversationSerializer, MessageSerializer, 
                          ReviewSerializer, NotificationSerializer, ActivityLogSerializer, 
                          WithdrawalRequestSerializer, ReportSerializer, TicketSerializer)

User = get_user_model()


# ==========================================
# 🛡️ SİBER GÜVENLİK KAPISI (TEK ELDEN YÖNETİM)
# ==========================================
def validate_file_security(file_obj, is_document=False):
    """
    Sisteme yüklenen dosyaların uzantılarına kanmayıp, DNA
    analizi yaparak zararlı yazılımların (Malware) sunucuya sızmasını engeller.
    """
    if not file_obj:
        return file_obj

    try:
        # Dosya imlecini başa sar ve ilk 2048 byte'ı oku
        file_obj.seek(0)
        file_data = file_obj.read(2048)
        
        # 🎯 YENİ SİSTEM: filetype ile dosyanın gerçek türünü bul
        kind = filetype.guess(file_data)
        
        if kind is None:
            raise DRFValidationError("🚨 Güvenlik İhlali: Dosyanın türü doğrulanamadı. Bu sahte bir dosya olabilir!")
            
        mime_type = kind.mime
        print(f"🔍 [X-RAY] Taranan Dosya Mime Tipi: {mime_type}") # Terminalden görebilmen için
        
        allowed_mimes = ['image/jpeg', 'image/png', 'image/webp']
        if is_document:
            allowed_mimes.extend(['application/pdf']) 
            
        if mime_type not in allowed_mimes:
            raise DRFValidationError(
                f"🚨 Güvenlik İhlali: Dosyanın uzantısı sahte veya içerik zararlı! (Tespit edilen DNA: {mime_type})"
            )
            
        # KRİTİK: Tarama bittikten sonra dosya okuma imlecini başa sar
        file_obj.seek(0)
        
    except DRFValidationError:
        raise
    except Exception as e:
        print("🚨 [X-RAY ÇÖKTÜ] Hata Detayı:")
        traceback.print_exc()
        raise DRFValidationError(f"Güvenlik taraması sırasında sistem hatası oluştu. (Detay: {str(e)})")
        
    return file_obj


class CategoryViewSet(viewsets.ModelViewSet):
    queryset = Category.objects.all().order_by('name')
    serializer_class = CategorySerializer
    
    def get_permissions(self):
        if self.action in ['list', 'retrieve']:
            return [permissions.AllowAny()]
        return [permissions.IsAdminUser()]

    def perform_create(self, serializer):
        name = serializer.validated_data.get('name')
        slug = slugify(name)
        serializer.save(slug=slug)

    def perform_update(self, serializer):
        name = serializer.validated_data.get('name')
        if name:
            slug = slugify(name)
            serializer.save(slug=slug)
        else:
            serializer.save()


class TicketViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = TicketSerializer
    parser_classes = (MultiPartParser, FormParser) 

    def get_queryset(self):
        if self.request.user.is_staff:
            return Ticket.objects.all().order_by('-created_at')
        return Ticket.objects.filter(user=self.request.user).order_by('-created_at')

    def perform_create(self, serializer):
        attachment = self.request.FILES.get('attachment')
        # 🎯 KAPI KONTROLÜ
        if attachment:
            validate_file_security(attachment, is_document=True)
            
        serializer.save(user=self.request.user)


class ReportViewSet(viewsets.ViewSet):
    permission_classes = [IsAuthenticated]
    parser_classes = (MultiPartParser, FormParser)

    @action(detail=False, methods=['post'])
    def submit(self, request):
        target_type = request.data.get('target_type')
        reason = request.data.get('reason')
        description = request.data.get('description', '')
        proof_image = request.FILES.get('proof_image')

        if target_type not in ['item', 'user'] or not reason:
            return Response({"error": "Eksik bilgi gönderildi."}, status=status.HTTP_400_BAD_REQUEST)

        # 🎯 KAPI KONTROLÜ
        if proof_image:
            try:
                validate_file_security(proof_image)
            except DRFValidationError as e:
                return Response({"error": str(e.detail[0])}, status=status.HTTP_400_BAD_REQUEST)

        report = Report(
            reporter=request.user,
            target_type=target_type,
            reason=reason,
            description=description,
            proof_image=proof_image
        )
        
        try:
            if target_type == 'item':
                item_id = request.data.get('item_id')
                if item_id and str(item_id) != "undefined" and str(item_id) != "null":
                    item = Item.objects.get(id=item_id)
                    report.reported_item = item
            elif target_type == 'user':
                user_id = request.data.get('user_id')
                if user_id and str(user_id) != "undefined" and str(user_id) != "null":
                    target_user = User.objects.get(id=user_id)
                    report.reported_user = target_user
            
            report.save()
            return Response({"message": "Şikayetiniz alınmıştır."}, status=status.HTTP_201_CREATED)
            
        except Item.DoesNotExist:
            return Response({"error": "Şikayet edilmek istenen ilan bulunamadı."}, status=status.HTTP_404_NOT_FOUND)
        except User.DoesNotExist:
            return Response({"error": "Şikayet edilmek istenen kullanıcı bulunamadı."}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            return Response({"error": f"Bir hata oluştu: {str(e)}"}, status=status.HTTP_400_BAD_REQUEST)

class ItemViewSet(viewsets.ModelViewSet):
    serializer_class = ItemSerializer
    parser_classes = (MultiPartParser, FormParser, JSONParser)
    filter_backends = [filters.SearchFilter]
    search_fields = ['title', 'description', 'category__name']

    def get_queryset(self):
        expired_bans = Item.objects.filter(is_banned=True, banned_until__lte=timezone.now())
        for item in expired_bans:
            item.is_banned = False
            item.banned_until = None
            item.ban_reason = None
            item.is_available = True
            item.save()

        queryset = Item.objects.all().prefetch_related('images').order_by("-created_at")

        if self.action == 'list':
            queryset = queryset.filter(is_available=True, is_banned=False)
            city = self.request.query_params.get('city', None)
            district = self.request.query_params.get('district', None)
            
            if city:
                queryset = queryset.filter(city__iexact=city) 
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

    @action(detail=False, methods=['get'], url_path='my_listings', permission_classes=[IsAuthenticated])
    def my_listings(self, request):
        items = Item.objects.filter(owner=request.user).order_by('-created_at')
        serializer = self.get_serializer(items, many=True)
        return Response(serializer.data)

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

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        
        if request.user.is_authenticated:
            viewer_identifier = f"user_{request.user.id}"
        else:
            x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
            if x_forwarded_for:
                ip = x_forwarded_for.split(',')[0]
            else:
                ip = request.META.get('REMOTE_ADDR')
            viewer_identifier = f"ip_{ip}"
            
        cache_key = f"view_item_{instance.id}_{viewer_identifier}"
        
        if not cache.get(cache_key):
            if not (request.user.is_authenticated and instance.owner == request.user):
                instance.views_count += 1
                instance.save(update_fields=['views_count'])
                cache.set(cache_key, True, 86400)

        serializer = self.get_serializer(instance)
        return Response(serializer.data)

    def perform_create(self, serializer):
        user = self.request.user
        
        # 🛡️ İLAN YASAĞI KONTROLÜ
        is_item_banned = not getattr(user, 'can_post_items', True) or (getattr(user, 'item_ban_until', None) and user.item_ban_until > timezone.now())
        if is_item_banned:
            # 🎯 DÜZELTME: timezone.localtime eklendi!
            date_str = timezone.localtime(user.item_ban_until).strftime('%d.%m.%Y %H:%M') if getattr(user, 'item_ban_until', None) else "Süresiz"
            raise DRFValidationError({"error": f"Sisteme ilan ekleme yasağınız {date_str} tarihine kadar devam etmektedir. Sebep: {user.item_ban_reason}"})

        images = self.request.FILES.getlist('images')
        
        if not images:
            raise DRFValidationError({"error": "Güvenlik protokolü gereği en az 1 adet ilan fotoğrafı yüklemelisiniz."})

        # 🎯 KAPI KONTROLÜ: İlan resimlerini içeri girmeden tarat
        for img in images:
            validate_file_security(img)

        try:
            main_index = int(self.request.data.get('main_image_index', 0))
        except ValueError:
            main_index = 0
            
        if main_index >= len(images):
            main_index = 0
        
        with transaction.atomic():
            item = serializer.save(owner=self.request.user)
            
            for index, img in enumerate(images):
                is_main = True if index == main_index else False
                image_instance = ItemImage(item=item, image=img, is_main=is_main)
                image_instance.save()


class BookingViewSet(viewsets.ModelViewSet):
    serializer_class = BookingSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.is_staff:
            return Booking.objects.all().order_by('-created_at')
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

            WalletTransaction.objects.create(
                wallet=owner_wallet,
                transaction_type='INCOME',
                amount=booking.total_price,
                description=f"'{booking.item.title}' kiralaması ({booking.start_date.strftime('%d.%m.%Y')}) onaylandı. Kira geliri."
            )

            Notification.objects.create(
                user=booking.renter,
                sender=booking.item.owner,
                item=booking.item,
                notification_type='booking',
                reference_id=str(booking.id),
                message=f"Tebrikler! '{booking.item.title}' kiralama talebiniz satıcı tarafından onaylandı."
            )

        return Response({"message": "Onaylandı. Kira bedeli cüzdanınıza eklendi."}, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'])
    def handover(self, request, pk=None):
        booking = self.get_object()
        if request.user != booking.renter:
            return Response({'error': 'Sadece kiracı teslim alma işlemini başlatabilir.'}, status=status.HTTP_403_FORBIDDEN)
            
        pin = request.data.get('pin')
        notes = request.data.get('notes', '')
        images = request.FILES.getlist('images')
        
        if booking.status != 'approved':
            return Response({'error': 'Bu işlem teslimat için uygun değil.'}, status=status.HTTP_400_BAD_REQUEST)
        if booking.handover_pin != pin:
            return Response({'error': 'Geçersiz Satıcı PIN kodu.'}, status=status.HTTP_400_BAD_REQUEST)
        if not images:
            return Response({'error': 'Güvenlik protokolü gereği en az 1 adet durum fotoğrafı yüklemelisiniz.'}, status=status.HTTP_400_BAD_REQUEST)
            
        # 🎯 KAPI KONTROLÜ: Teslimat kanıtları içeri girmeden tarat
        try:
            for img in images:
                validate_file_security(img)
        except DRFValidationError as e:
            return Response({"error": str(e.detail[0])}, status=status.HTTP_400_BAD_REQUEST)
            
        with transaction.atomic():
            for img in images:
                image_instance = BookingImage(booking=booking, image=img, image_type='handover')
                image_instance.save()
                
            booking.handover_notes = notes
            booking.status = 'handover_pending'
            booking.item.is_available = False
            booking.item.save()
            booking.save()
            
        Notification.objects.create(
            user=booking.item.owner,
            notification_type='booking',
            reference_id=str(booking.id),
            message=f"Kiracı ({booking.renter.first_name}) ürünü teslim aldığını bildirdi. Lütfen onaylayın."
        )
        return Response({'message': 'Teslimat kanıtları yüklendi, satıcının onayı bekleniyor.'})

    @action(detail=True, methods=['post'])
    def approve_handover(self, request, pk=None):
        booking = self.get_object()
        if request.user != booking.item.owner:
            return Response({'error': 'Sadece satıcı teslimatı onaylayabilir.'}, status=status.HTTP_403_FORBIDDEN)
        if booking.status != 'handover_pending':
            return Response({'error': 'Geçersiz işlem.'}, status=status.HTTP_400_BAD_REQUEST)
            
        with transaction.atomic():
            booking.status = 'active'
            booking.save()
            
            # 🚀 SATICIYA PARA AKTARIMI: Ürün teslim edildiğine göre Kira Gelirini satıcıya aktar!
            owner_wallet, _ = Wallet.objects.get_or_create(user=booking.item.owner)
            owner_wallet.balance += Decimal(str(booking.total_price))
            owner_wallet.save()

            WalletTransaction.objects.create(
                wallet=owner_wallet,
                transaction_type='INCOME',
                amount=booking.total_price,
                description=f"'{booking.item.title}' kiralaması başladı. Kira geliri hesabınıza eklendi."
            )
            
        Notification.objects.create(user=booking.renter, notification_type='booking', reference_id=str(booking.id), message=f"Satıcı teslimatınızı onayladı. Kiralama süreci resmen başladı! İyi kullanımlar.")
        return Response({'message': 'Teslimat onaylandı, kira geliri cüzdanınıza aktarıldı ve işlem aktifleşti.'})

    @action(detail=True, methods=['post'])
    def complete_booking(self, request, pk=None):
        booking = self.get_object()
        if request.user != booking.item.owner:
            return Response({'error': 'Sadece satıcı iade alma işlemini başlatabilir.'}, status=status.HTTP_403_FORBIDDEN)
            
        pin = request.data.get('pin')
        notes = request.data.get('notes', '')
        images = request.FILES.getlist('images')
        
        if booking.status != 'active':
            return Response({'error': 'Bu işlem şu anda aktif değil.'}, status=status.HTTP_400_BAD_REQUEST)
        if booking.return_pin != pin:
            return Response({'error': 'Geçersiz Kiracı PIN kodu.'}, status=status.HTTP_400_BAD_REQUEST)
        if not images:
            return Response({'error': 'Güvenlik protokolü gereği en az 1 adet iade durumu fotoğrafı yüklemelisiniz.'}, status=status.HTTP_400_BAD_REQUEST)
            
        # 🎯 KAPI KONTROLÜ: İade kanıtları içeri girmeden tarat
        try:
            for img in images:
                validate_file_security(img)
        except DRFValidationError as e:
            return Response({"error": str(e.detail[0])}, status=status.HTTP_400_BAD_REQUEST)
            
        with transaction.atomic():
            for img in images:
                image_instance = BookingImage(booking=booking, image=img, image_type='return')
                image_instance.save()
                
            booking.return_notes = notes
            booking.status = 'return_pending'
            booking.save()
        
        Notification.objects.create(
            user=booking.renter,
            notification_type='wallet', 
            reference_id=str(booking.id),
            message=f"Satıcı iade fotoğraflarını yükledi. Depozitonuzu geri almak için lütfen iadeyi onaylayın."
        )
        return Response({'message': 'İade kanıtları yüklendi, kiracının onayı bekleniyor.'})

    @action(detail=True, methods=['post'])
    def approve_return(self, request, pk=None):
        booking = self.get_object()
        if request.user != booking.renter:
            return Response({'error': 'Sadece kiracı iade işlemini onaylayabilir.'}, status=status.HTTP_403_FORBIDDEN)
        if booking.status != 'return_pending':
            return Response({'error': 'Geçersiz işlem.'}, status=status.HTTP_400_BAD_REQUEST)
            
        with transaction.atomic():
            booking.status = 'completed'
            booking.item.is_available = True
            booking.item.save()
            booking.save()
            
            if booking.deposit_price > 0:
                renter_wallet, _ = Wallet.objects.get_or_create(user=booking.renter)
                renter_wallet.balance += Decimal(str(booking.deposit_price))
                renter_wallet.save()

                WalletTransaction.objects.create(
                    wallet=renter_wallet,
                    transaction_type='REFUND',
                    amount=booking.deposit_price,
                    description=f"'{booking.item.title}' sorunsuz iade edildi. Güvence bedeli (Depozito) iadesi."
                )
            
            Notification.objects.create(
                user=booking.item.owner,
                notification_type='booking',
                reference_id=str(booking.id),
                message=f"Kiracı iadeyi onayladı. Kiralama işlemi sorunsuz tamamlandı! Şimdi birbirinizi değerlendirebilirsiniz."
            )
            
            Notification.objects.create(
                user=booking.renter,
                notification_type='wallet',
                reference_id=str(booking.id),
                message=f"İadeyi onayladınız. ₺{booking.deposit_price} depozito bedeliniz cüzdanınıza iade edildi."
            )

        return Response({'message': 'İade onaylandı, kiralama işlemi başarıyla tamamlandı ve depozitonuz iade edildi.'})

    @action(detail=True, methods=['post'], permission_classes=[IsAdminUser])
    def resolve_dispute(self, request, pk=None):
        booking = self.get_object()
        winner = request.data.get('winner')
        resolution_note = request.data.get('resolution_note', '')

        if booking.status != 'disputed':
            return Response({'error': 'Sadece anlaşmazlık durumundaki (disputed) işlemler çözülebilir.'}, status=status.HTTP_400_BAD_REQUEST)

        if winner not in ['owner', 'renter']:
            return Response({'error': 'Lütfen kazanan tarafı belirtin (owner veya renter).'}, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            deposit = Decimal(str(booking.deposit_price))
            
            if winner == 'owner':
                wallet, _ = Wallet.objects.get_or_create(user=booking.item.owner)
                wallet.balance += deposit
                wallet.save()
                WalletTransaction.objects.create(
                    wallet=wallet, transaction_type='INCOME', amount=deposit,
                    description=f"'{booking.item.title}' anlaşmazlık çözümü: Haklı bulunduğunuz için depozito bedeli size aktarıldı."
                )
                booking.dispute_winner = 'owner'
                
                Notification.objects.create(user=booking.item.owner, notification_type='wallet', reference_id=str(booking.id), message=f"Anlaşmazlık lehinize sonuçlandı. ₺{deposit} tazminat cüzdanınıza eklendi. Not: {resolution_note}")
                Notification.objects.create(user=booking.renter, notification_type='system', reference_id=str(booking.id), message=f"Anlaşmazlık aleyhinize sonuçlandı. Hasar tespiti nedeni ile depozitonuz satıcıya aktarıldı. Not: {resolution_note}")

            elif winner == 'renter':
                wallet, _ = Wallet.objects.get_or_create(user=booking.renter)
                wallet.balance += deposit
                wallet.save()
                WalletTransaction.objects.create(
                    wallet=wallet, transaction_type='REFUND', amount=deposit,
                    description=f"'{booking.item.title}' anlaşmazlık çözümü: Haklı bulunduğunuz için depozito bedeli iade edildi."
                )
                booking.dispute_winner = 'renter'

                Notification.objects.create(user=booking.renter, notification_type='wallet', reference_id=str(booking.id), message=f"Anlaşmazlık lehinize sonuçlandı. ₺{deposit} depozito iade edildi. Not: {resolution_note}")
                Notification.objects.create(user=booking.item.owner, notification_type='system', reference_id=str(booking.id), message=f"Anlaşmazlık aleyhinize sonuçlandı. Şikayetiniz haksız bulunduğu için depozito kiracıya iade edildi. Not: {resolution_note}")

            booking.status = 'completed'
            booking.item.is_available = True
            booking.item.save()
            booking.save()

        return Response({'message': f"Anlaşmazlık başarıyla çözüldü. Kazanan taraf: {'Satıcı' if winner == 'owner' else 'Kiracı'}."})

    @action(detail=True, methods=['post'])
    def raise_dispute(self, request, pk=None):
        booking = self.get_object()
        reason = request.data.get('reason')
        
        if request.user not in [booking.item.owner, booking.renter]:
            return Response({'error': 'Sadece işleme taraf olan kişiler itiraz başlatabilir.'}, status=status.HTTP_403_FORBIDDEN)
            
        if booking.status not in ['handover_pending', 'return_pending', 'active']:
            return Response({'error': 'Bu aşamada itiraz edilemez.'}, status=status.HTTP_400_BAD_REQUEST)
            
        if not reason:
            return Response({'error': 'Lütfen itiraz/uyuşmazlık sebebini açıklayın.'}, status=status.HTTP_400_BAD_REQUEST)
            
        booking.status = 'disputed'
        booking.dispute_reason = reason
        booking.save()
        
        other_user = booking.item.owner if request.user == booking.renter else booking.renter
        Notification.objects.create(
            user=other_user,
            notification_type='system',
            reference_id=str(booking.id),
            message=f"DİKKAT: Kiralama işleminde karşı taraf bir uyuşmazlık bildirdi. Yönetim ekibi incelemeye aldı."
        )
        return Response({'message': 'İtirazınız sisteme kaydedildi. Yöneticilerimiz inceleyerek karar verecektir.'})


    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        booking = self.get_object()
        user = request.user
        
        if user not in [booking.item.owner, booking.renter]:
            return Response({"error": "Yetkisiz işlem."}, status=status.HTTP_403_FORBIDDEN)
            
        if booking.status in ['active', 'completed', 'disputed', 'handover_pending', 'return_pending']:
            return Response({"error": "Bu aşamadaki bir işlem iptal edilemez."}, status=status.HTTP_400_BAD_REQUEST)
            
        with transaction.atomic():
            booking.cancelled_by = user

            rent_amount = Decimal(str(booking.total_price))
            deposit_amount = Decimal(str(booking.deposit_price))
            total_paid = rent_amount + deposit_amount
            
            refund_amount = total_paid
            penalty_amount = Decimal('0.00')
            date_str = booking.start_date.strftime('%d.%m.%Y')

            is_late_cancel = False
            if booking.status == 'approved':
                now = timezone.now().date()
                days_until_start = (booking.start_date - now).days
                if days_until_start <= 1: 
                    is_late_cancel = True

            if booking.status == 'approved' and user == booking.renter and is_late_cancel:
                penalty_amount = rent_amount * Decimal('0.20')
                refund_amount = total_paid - penalty_amount
                
            if booking.status == 'approved' and user == booking.item.owner and is_late_cancel:
                item = booking.item
                item.is_banned = True
                item.banned_until = timezone.now() + timedelta(days=7) 
                item.is_available = False
                item.save()
                
                owner = item.owner
                owner.trust_score = max(1.0, getattr(owner, 'trust_score', 5.0) - 0.5) 
                owner.save()
                
                Notification.objects.create(
                    user=owner,
                    notification_type='system',
                    reference_id=str(booking.id),
                    message=f"🚨 CEZA: '{item.title}' işlemini son 24 saat içinde iptal ettiğiniz için ilanınız askıya alınmış ve puanınız düşürülmüştür."
                )

            if booking.status == 'approved':
                owner_wallet = Wallet.objects.get(user=booking.item.owner)
                amount_to_deduct = rent_amount - penalty_amount
                owner_wallet.balance -= amount_to_deduct
                owner_wallet.save()
                
                owner_desc = f"'{booking.item.title}' iptal (Geri alım)."
                if penalty_amount > 0:
                    owner_desc = f"'{booking.item.title}' kiracı iptali: {penalty_amount} ₺ ceza teselli geliri eklendi."
                elif user == booking.item.owner:
                    owner_desc = f"'{booking.item.title}' işlemini iptal ettiniz. Bedel düşüldü."

                WalletTransaction.objects.create(wallet=owner_wallet, transaction_type='PAYMENT', amount=amount_to_deduct, description=owner_desc)

                if user == booking.renter:
                    Notification.objects.create(user=booking.item.owner, sender=user, item=booking.item, notification_type='system', reference_id=str(booking.id), message=f"Kiracı '{booking.item.title}' ({date_str}) talebini iptal etti.")
            
            if booking.status in ['pending_approval', 'approved']:
                renter_wallet = Wallet.objects.get(user=booking.renter)
                renter_wallet.balance += refund_amount
                renter_wallet.save()
                
                renter_desc = f"'{booking.item.title}' iptal iadesi."
                if penalty_amount > 0:
                    renter_desc = f"'{booking.item.title}' iptal cezası (-{penalty_amount} ₺) sonrası iade."
                elif user == booking.item.owner:
                    renter_desc = f"'{booking.item.title}' satıcı iptali: Kesintisiz iade."

                WalletTransaction.objects.create(wallet=renter_wallet, transaction_type='REFUND', amount=refund_amount, description=renter_desc)

                if user == booking.item.owner:
                    Notification.objects.create(user=booking.renter, sender=user, item=booking.item, notification_type='system', reference_id=str(booking.id), message=f"Satıcı '{booking.item.title}' ({date_str}) işlemini iptal etti. İade yapıldı.")

            booking.status = 'rejected'
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

    def check_message_ban(self, user):
        is_message_banned = not getattr(user, 'can_send_messages', True) or (getattr(user, 'message_ban_until', None) and user.message_ban_until > timezone.now())
        if is_message_banned:
            # 🎯 DÜZELTME: timezone.localtime eklendi!
            date_str = timezone.localtime(user.message_ban_until).strftime('%d.%m.%Y %H:%M') if getattr(user, 'message_ban_until', None) else "Süresiz"
            raise DRFValidationError({"error": f"Susturma (Mesaj/Teklif) yasağınız {date_str} tarihine kadar devam etmektedir. Sebep: {user.message_ban_reason}"})

    def get_queryset(self):
        user = self.request.user
        return Conversation.objects.filter(Q(renter=user) | Q(owner=user))

    def create(self, request, *args, **kwargs):
        item_id = request.data.get('item')
        if item_id:
            existing_conv = Conversation.objects.filter(item_id=item_id, renter=request.user).first()
            if existing_conv:
                serializer = self.get_serializer(existing_conv, context={'request': request})
                return Response(serializer.data, status=status.HTTP_200_OK)
        return super().create(request, *args, **kwargs)

    def perform_create(self, serializer):
        item_id = self.request.data.get('item')
        if item_id:
            item = get_object_or_404(Item, id=item_id)
            serializer.save(renter=self.request.user, owner=item.owner)
        else:
            system_user, _ = User.objects.get_or_create(username='rentcircle_destek', defaults={'first_name': 'RentCircle', 'last_name': 'Destek', 'is_staff': True})
            serializer.save(renter=self.request.user, owner=system_user)

    @action(detail=True, methods=['get'])
    def messages(self, request, pk=None):
        conversation = self.get_object()
        conversation.messages.filter(is_read=False).exclude(sender=request.user).update(is_read=True)
        messages = conversation.messages.all()
        serializer = MessageSerializer(messages, many=True, context={'request': request})
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def send_message(self, request, pk=None):
        self.check_message_ban(request.user)

        conversation = self.get_object()
        content = request.data.get('content', '')
        
        is_location_share = request.data.get('is_location_share', False)
        location_lat = request.data.get('location_lat')
        location_lon = request.data.get('location_lon')
        location_address = request.data.get('location_address')
        
        is_offer = request.data.get('is_offer', False)
        offer_price = request.data.get('offer_price')
        offer_start_date = request.data.get('start_date')
        offer_end_date = request.data.get('end_date')
        
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
        item_id = request.query_params.get('item_id')
        conv = Conversation.objects.filter(item_id=item_id, renter=request.user).first()
        if conv:
            return Response({"exists": True, "conversation_id": conv.id})
        return Response({"exists": False})

    @action(detail=False, methods=['post'])
    def send_direct_message(self, request):
        self.check_message_ban(request.user)
        
        item_id = request.data.get('item_id')
        content = request.data.get('content', '')
        
        is_location_share = request.data.get('is_location_share', False)
        location_lat = request.data.get('location_lat')
        location_lon = request.data.get('location_lon')
        location_address = request.data.get('location_address')
        offer_status = request.data.get('offer_status')
        
        is_offer = request.data.get('is_offer', False)
        offer_price = request.data.get('offer_price')
        start_date = request.data.get('start_date')
        end_date = request.data.get('end_date')

        item = get_object_or_404(Item, id=item_id)
        user = request.user

        if item.owner == user:
            return Response({"error": "Kendi ilanınıza mesaj atamazsınız."}, status=status.HTTP_400_BAD_REQUEST)

        conversation, created = Conversation.objects.get_or_create(
            item=item,
            renter=user,
            owner=item.owner
        )

        message = Message.objects.create(
            conversation=conversation,
            sender=user,
            content=content,
            is_offer=is_offer,
            offer_price=offer_price,
            offer_start_date=start_date,
            offer_end_date=end_date,
            offer_status='pending' if is_offer else offer_status,
            is_location_share=is_location_share,
            location_lat=location_lat,
            location_lon=location_lon,
            location_address=location_address
        )

        conversation.updated_at = message.created_at
        conversation.save()

        return Response({
            "message": "Mesaj başarıyla gönderildi.",
            "conversation_id": conversation.id
        }, status=status.HTTP_201_CREATED)


    @action(detail=False, methods=['post'])
    def respond_offer(self, request):
        self.check_message_ban(request.user)

        message_id = request.data.get('message_id')
        action_type = request.data.get('action')

        if not message_id or action_type not in ['accept', 'reject']:
            return Response({"error": "Geçersiz veya eksik parametre."}, status=status.HTTP_400_BAD_REQUEST)

        message = get_object_or_404(Message, id=message_id)

        if message.sender == request.user:
            return Response({"error": "Kendi teklifinize/konumunuza yanıt veremezsiniz."}, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            message.offer_status = 'accepted' if action_type == 'accept' else 'rejected'
            message.save()

            conversation = message.conversation
            conversation.updated_at = timezone.now()
            conversation.save()

            # 🚀 YENİ: EĞER TEKLİF KABUL EDİLDİYSE, ÇAKIŞAN DİĞER TÜM TEKLİFLERİ OTOMATİK REDDET!
            if action_type == 'accept' and message.is_offer:
                overlapping_offers = Message.objects.filter(
                    conversation__item=conversation.item,
                    is_offer=True,
                    offer_status='pending',
                    offer_start_date__lte=message.offer_end_date,
                    offer_end_date__gte=message.offer_start_date
                ).exclude(id=message.id)

                for overlap_msg in overlapping_offers:
                    overlap_msg.offer_status = 'rejected'
                    overlap_msg.save()
                    
                    # Diğer sohbetin "son güncellenme" tarihini de tetikle ki liste güncellensin
                    overlap_conv = overlap_msg.conversation
                    overlap_conv.updated_at = timezone.now()
                    overlap_conv.save()

        return Response({"message": "İşlem başarıyla gerçekleşti.", "offer_status": message.offer_status}, status=status.HTTP_200_OK)
    

class ReviewViewSet(viewsets.ModelViewSet):
    queryset = Review.objects.all()
    serializer_class = ReviewSerializer
    permission_classes = [IsAuthenticatedOrReadOnly]

    def perform_create(self, serializer):
        booking = serializer.validated_data['booking']
        user = self.request.user
        
        if user not in [booking.renter, booking.item.owner]:
            raise serializers.ValidationError({"error": "Sadece bu kiralama işlemine taraf olan kişiler değerlendirme yapabilir."})
            
        if booking.status != 'completed':
            raise serializers.ValidationError({"error": "Sadece tamamlanmış işlemler için değerlendirme yapılabilir."})
            
        if Review.objects.filter(booking=booking, reviewer=user).exists():
            raise serializers.ValidationError({"error": "Bu işlem için zaten bir değerlendirme yaptınız."})

        target_user = booking.item.owner if user == booking.renter else booking.renter

        serializer.save(
            reviewer=user,
            target_user=target_user,
            item=booking.item
        )
        
        Notification.objects.create(
            user=target_user,
            sender=user,
            item=booking.item,
            notification_type='review',
            reference_id=str(booking.id),
            message=f"'{booking.item.title}' kiralama işlemi için {user.first_name} profilinize yeni bir değerlendirme bıraktı."
        )

@api_view(['GET', 'PATCH'])
@permission_classes([IsAuthenticated])
def notification_list(request):
    if request.method == 'GET':
        notifications = Notification.objects.filter(user=request.user)
        serializer = NotificationSerializer(notifications, many=True)
        return Response(serializer.data)
        
    elif request.method == 'PATCH':
        Notification.objects.filter(user=request.user, is_read=False).update(is_read=True)
        return Response({"message": "Tümü okundu olarak işaretlendi."})

@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def notification_delete(request, pk):
    try:
        notification = Notification.objects.get(pk=pk, user=request.user)
        notification.delete()
        return Response({"message": "Bildirim silindi."})
    except Notification.DoesNotExist:
        return Response({"error": "Bulunamadı."}, status=404)
    
@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def notification_clear_all(request):
    Notification.objects.filter(user=request.user).delete()
    return Response({"message": "Tüm bildirimler başarıyla temizlendi."})


class PayWithWalletView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, item_id):
        renter = request.user
        start_date_str = request.data.get('start_date')
        end_date_str = request.data.get('end_date')
        base_price_raw = request.data.get('total_price')

        if not all([start_date_str, end_date_str, base_price_raw]):
            return Response({"error": "Eksik bilgi gönderildi."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            start_date = datetime.strptime(start_date_str, "%Y-%m-%d").date()
            end_date = datetime.strptime(end_date_str, "%Y-%m-%d").date()
            base_price = Decimal(str(base_price_raw))
            deposit_price = base_price * Decimal('0.15')
            total_deduction = base_price + deposit_price 
            
            item = Item.objects.select_for_update().get(id=item_id) # 🛡️ Race-condition koruması için ilanı kilitliyoruz
        except Item.DoesNotExist:
            return Response({"error": "İlan bulunamadı."}, status=status.HTTP_404_NOT_FOUND)
        except ValueError:
            return Response({"error": "Geçersiz tarih veya fiyat formatı."}, status=status.HTTP_400_BAD_REQUEST)

        if item.owner == renter:
            return Response({"error": "Kendi ürününüzü kiralayamazsınız."}, status=status.HTTP_400_BAD_REQUEST)

        renter_wallet, _ = Wallet.objects.get_or_create(user=renter)
        
        if Decimal(str(renter_wallet.balance)) < total_deduction:
            return Response({"error": f"Cüzdan bakiyeniz yetersiz. Depozito dâhil toplam ₺{total_deduction} gerekiyor."}, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            # 🛡️ 1. KRİTİK KONTROL: Ödeme anında tarih çakışması var mı?
            overlapping_approved = Booking.objects.filter(
                item=item,
                status__in=['approved', 'active', 'handover_pending'],
                start_date__lte=end_date,
                end_date__gte=start_date
            )
            
            if overlapping_approved.exists():
                return Response({
                    "error": "Üzgünüz! Seçtiğiniz tarih aralığı az önce başka bir kullanıcı tarafından kiralandı ve ödemesi tamamlandı."
                }, status=status.HTTP_400_BAD_REQUEST)

            # 2. Bakiyeyi Düş ve İşlemi Kaydet
            renter_wallet.balance -= total_deduction
            renter_wallet.save()

            WalletTransaction.objects.create(
                wallet=renter_wallet,
                transaction_type='PAYMENT',
                amount=total_deduction,
                description=f"'{item.title}' kiralaması onaylandı - Kira (₺{base_price}) + %15 Güvence Bedeli."
            )

            # Sipariş doğrudan 'approved' statüsünde başlar (Çift onay ortadan kalktı)
            booking = Booking.objects.create(
                item=item,
                renter=renter,
                start_date=start_date,
                end_date=end_date,
                total_price=base_price, 
                status='approved' 
            )

            # 🚀 3. OTOMATİK ÇAKIŞMA TEMİZLİĞİ (Çakışan Diğer Talepleri İptal Et ve İade Yap)
            conflicting_pending_bookings = Booking.objects.filter(
                item=item,
                status='pending_approval',
                start_date__lte=end_date,
                end_date__gte=start_date
            ).exclude(id=booking.id)

            for pending_booking in conflicting_pending_bookings:
                pending_booking.status = 'rejected'
                pending_booking.save()
                
                # Eğer daha önceden parası çekilmiş bir talep varsa iadesini yap
                p_rent = Decimal(str(pending_booking.total_price))
                p_deposit = Decimal(str(pending_booking.deposit_price))
                p_total = p_rent + p_deposit
                
                p_wallet, _ = Wallet.objects.get_or_create(user=pending_booking.renter)
                p_wallet.balance += p_total
                p_wallet.save()

                WalletTransaction.objects.create(
                    wallet=p_wallet,
                    transaction_type='REFUND',
                    amount=p_total,
                    description=f"'{item.title}' ilanı başka bir kullanıcı tarafından kiralandığı için talebiniz iptal edildi ve paranız iade edildi."
                )

                Notification.objects.create(
                    user=pending_booking.renter,
                    notification_type='system',
                    reference_id=str(pending_booking.id),
                    message=f"Tarih Çakışması: '{item.title}' ilanı seçtiğiniz tarihler için başkası tarafından kiralandığı için talebiniz otomatik iptal edilerek ₺{p_total} cüzdanınıza iade edildi."
                )

            # Taraflara Başarı Bildirimleri
            Notification.objects.create(
                user=renter,
                notification_type='booking',
                reference_id=str(booking.id),
                message=f"Tebrikler! '{item.title}' kiralama işleminiz onaylandı. Kiralama gününüz geldiğinde teslimat PIN kodu ile ürünü alabilirsiniz."
            )

            Notification.objects.create(
                user=item.owner,
                notification_type='booking',
                reference_id=str(booking.id),
                message=f"Harika Haber! '{item.title}' ürününüz {start_date.strftime('%d.%m.%Y')} - {end_date.strftime('%d.%m.%Y')} tarihleri arasında kiralandı ve ödemesi alındı."
            )

        return Response({
            "message": "Kiralama ve ödeme işlemi başarıyla tamamlandı.",
            "booking_id": booking.id
        }, status=status.HTTP_201_CREATED)


class AdminDashboardViewSet(viewsets.ViewSet):
    permission_classes = [IsAdminUser]

    @action(detail=False, methods=['get'])
    def stats(self, request):
        pool_balance = Booking.objects.filter(
            status__in=['pending_approval', 'approved', 'handover_pending', 'return_pending', 'active', 'disputed']
        ).aggregate(total_rent=Sum('total_price'), total_deposit=Sum('deposit_price'))

        return Response({
            "users_count": User.objects.count(),
            "total_items": Item.objects.count(),
            "active_items": Item.objects.filter(is_available=True, is_banned=False).count(),
            "active_bookings": Booking.objects.filter(status='active').count(),
            "pending_disputes": Booking.objects.filter(status='disputed').count(),
            "finances": {
                "total_wallets": Wallet.objects.aggregate(total=Sum('balance'))['total'] or Decimal('0.00'),
                "pool_rent": pool_balance['total_rent'] or Decimal('0.00'),
                "pool_deposit": pool_balance['total_deposit'] or Decimal('0.00'),
            }
        }, status=status.HTTP_200_OK)

    @action(detail=False, methods=['get'])
    def users_list(self, request):
        search = request.query_params.get('search', '').lower()
        users = User.objects.select_related('wallet').all().order_by('-date_joined')
        
        if search:
            users = users.filter(Q(username__icontains=search) | Q(first_name__icontains=search) | Q(email__icontains=search))
            
        data = [{
            "id": u.id,
            "username": u.username,
            "email": u.email,
            "first_name": u.first_name,
            "last_name": u.last_name,
            "is_staff": u.is_staff,
            "trust_score": getattr(u, 'trust_score', 5.0),
            "wallet_balance": u.wallet.balance if hasattr(u, 'wallet') else Decimal('0.00'),
            "date_joined": u.date_joined.strftime('%Y-%m-%d %H:%M'),
            
            # 🎯 DÜZELTME: CEZA DURUMLARI VE "KALICI MI?" BİLGİSİ EKLENDİ
            "is_account_banned": not u.is_active or (u.banned_until and u.banned_until > timezone.now()),
            "account_ban_reason": getattr(u, 'ban_reason', None),
            "account_banned_until": timezone.localtime(u.banned_until).strftime('%d.%m.%Y %H:%M') if u.banned_until else None,
            "is_account_permanent": bool(u.banned_until and u.banned_until.year > 2100), # 100 yıl atıldığı için > 2100 ise kalıcıdır
            
            "is_item_banned": not u.can_post_items or (u.item_ban_until and u.item_ban_until > timezone.now()),
            "item_ban_reason": getattr(u, 'item_ban_reason', None),
            "item_banned_until": timezone.localtime(u.item_ban_until).strftime('%d.%m.%Y %H:%M') if u.item_ban_until else None,
            "is_item_permanent": bool(u.item_ban_until and u.item_ban_until.year > 2100),
            
            "is_message_banned": not u.can_send_messages or (u.message_ban_until and u.message_ban_until > timezone.now()),
            "message_ban_reason": getattr(u, 'message_ban_reason', None),
            "message_banned_until": timezone.localtime(u.message_ban_until).strftime('%d.%m.%Y %H:%M') if u.message_ban_until else None,
            "is_message_permanent": bool(u.message_ban_until and u.message_ban_until.year > 2100)
        } for u in users]
        
        return Response(data, status=status.HTTP_200_OK)

    @action(detail=False, methods=['post'])
    def update_user(self, request):
        target_user = get_object_or_404(User, id=request.data.get('user_id'))
        if target_user == request.user and request.data.get('is_staff') is False:
            return Response({"error": "Sistem Koruması: Kendi yöneticilik yetkinizi alamazsınız."}, status=status.HTTP_400_BAD_REQUEST)
            
        target_user.is_staff = request.data.get('is_staff', target_user.is_staff)
        target_user.trust_score = request.data.get('trust_score', getattr(target_user, 'trust_score', 5.0))
        target_user.save()
        return Response({"message": "Kullanıcı başarıyla güncellendi."})

    @action(detail=False, methods=['post'])
    def manage_wallet(self, request):
        user_id = request.data.get('user_id')
        action_type = request.data.get('action') 
        amount = Decimal(str(request.data.get('amount', 0)))

        target_user = get_object_or_404(User, id=user_id)
        wallet, _ = Wallet.objects.get_or_create(user=target_user)

        if action_type == 'add':
            wallet.balance += amount
            desc = f"Sistem Yöneticisi tarafından hesabınıza ₺{amount} eklendi."
            trans_type = 'DEPOSIT'
        elif action_type == 'subtract':
            if wallet.balance < amount:
                return Response({"error": "Kullanıcının bakiyesi yetersiz!"}, status=status.HTTP_400_BAD_REQUEST)
            wallet.balance -= amount
            desc = f"Sistem Yöneticisi tarafından hesabınızdan ₺{amount} kesildi."
            trans_type = 'WITHDRAWAL'
        else:
            return Response({"error": "Geçersiz işlem tipi."}, status=status.HTTP_400_BAD_REQUEST)
        
        wallet.save()
        WalletTransaction.objects.create(wallet=wallet, transaction_type=trans_type, amount=amount, description=desc)
        ActivityLog.objects.create(user=request.user, action_type="SİSTEM FİNANS", description=f"@{target_user.username} kullanıcısına ₺{amount} {action_type} işlemi yapıldı.")
        Notification.objects.create(user=target_user, notification_type='wallet', message=desc)

        return Response({"message": "Bakiye başarıyla güncellendi.", "new_balance": wallet.balance})

    @action(detail=False, methods=['post'])
    def ban_entity(self, request):
        target_type = request.data.get('target_type') 
        entity_id = request.data.get('id')
        duration = request.data.get('duration') 
        reason = request.data.get('reason', 'Topluluk kurallarını ihlal ettiniz.')
        # 🚀 YENİ: Hangi cezanın verileceğini belirler (account, item_post, messaging)
        penalty_type = request.data.get('penalty_type', 'account')

        # Süre Hesaplama
        banned_until = None
        if duration == '1_day':
            banned_until = timezone.now() + timedelta(days=1)
        elif duration == '1_week':
            banned_until = timezone.now() + timedelta(days=7)
        elif duration == '1_month':
            banned_until = timezone.now() + timedelta(days=30)
        elif duration == 'permanent':
            banned_until = timezone.now() + timedelta(days=36500)

        # 🎯 HEDEF: KULLANICI İSE
        if target_type == 'user':
            target_user = get_object_or_404(User, id=entity_id)
            
            # --- CEZAYI KALDIRMA İŞLEMİ ---
            if duration == 'remove_ban':
                if penalty_type == 'account':
                    target_user.banned_until = None
                    target_user.ban_reason = None
                    target_user.is_active = True
                    msg = "Hesabınızın giriş yasağı kaldırılmıştır."
                elif penalty_type == 'item_post':
                    target_user.item_ban_until = None
                    target_user.item_ban_reason = None
                    target_user.can_post_items = True
                    msg = "İlan paylaşma yasağınız kaldırılmıştır."
                elif penalty_type == 'messaging':
                    target_user.message_ban_until = None
                    target_user.message_ban_reason = None
                    target_user.can_send_messages = True
                    msg = "Mesajlaşma (Susturma) cezanız kaldırılmıştır."

                target_user.save()
                Notification.objects.create(user=target_user, notification_type='system', message=msg)
                return Response({"message": f"Kullanıcının {penalty_type} yasağı başarıyla kaldırıldı."})

            # --- CEZA VERME İŞLEMİ ---
            else:
                if penalty_type == 'account':
                    target_user.banned_until = banned_until
                    target_user.ban_reason = reason
                    target_user.is_active = False # Tam ban yiyen zaten giremez, o yüzden anında atıyoruz
                    msg = f"Hesabınız sistem tarafından askıya alınmıştır. Sebep: {reason}"
                    
                elif penalty_type == 'item_post':
                    target_user.item_ban_until = banned_until
                    target_user.item_ban_reason = reason
                    target_user.can_post_items = False
                    msg = f"Sisteme yeni ilan ekleme yetkiniz kısıtlanmıştır. Sebep: {reason}"
                    
                elif penalty_type == 'messaging':
                    target_user.message_ban_until = banned_until
                    target_user.message_ban_reason = reason
                    target_user.can_send_messages = False
                    msg = f"Mesaj gönderme ve teklif verme yetkiniz (Susturma) kısıtlanmıştır. Sebep: {reason}"

                target_user.save()
                ActivityLog.objects.create(user=request.user, action_type="MODERASYON", description=f"@{target_user.username} kullanıcısına {duration} süreli {penalty_type} cezası verildi.")
                Notification.objects.create(user=target_user, notification_type='system', message=msg)
                return Response({"message": "Kullanıcıya başarılı bir şekilde ceza uygulandı ve bildirildi."})

        # 🎯 HEDEF: İLAN İSE (Mevcut mantık değişmedi)
        elif target_type == 'item':
            item = get_object_or_404(Item, id=entity_id)
            if duration == 'remove_ban':
                item.banned_until = None
                item.ban_reason = None
                item.is_banned = False
                item.is_available = True
                msg = f"'{item.title}' ilanınızın kısıtlaması kaldırıldı."
            else:
                item.banned_until = banned_until
                item.ban_reason = reason
                item.is_banned = True
                item.is_available = False
                msg = f"'{item.title}' ilanınız yayından kaldırılmıştır. Sebep: {reason}"
                
            item.save()
            ActivityLog.objects.create(user=request.user, action_type="MODERASYON", description=f"İlan (#{item.id}) {duration} süreyle banlandı.")
            Notification.objects.create(user=item.owner, notification_type='system', message=msg)
            return Response({"message": "İlan banlandı ve satıcıya bildirildi."})

    @action(detail=False, methods=['post'])
    def reply_to_support(self, request):
        target_user_id = request.data.get('user_id')
        message_content = request.data.get('message')

        target_user = get_object_or_404(User, id=target_user_id)
        system_user, _ = User.objects.get_or_create(username='rentcircle_destek', defaults={'first_name': 'RentCircle', 'last_name': 'Destek', 'is_staff': True})

        conversation, _ = Conversation.objects.get_or_create(renter=target_user, owner=system_user)
        Message.objects.create(conversation=conversation, sender=system_user, content=message_content)

        ticket_id = request.data.get('ticket_id')
        if ticket_id:
            try:
                ticket = Ticket.objects.get(id=ticket_id)
                ticket.status = 'in_progress' 
                ticket.save()
            except Ticket.DoesNotExist:
                pass

        return Response({"message": "RentCircle Destek mesajı iletildi."})

    @action(detail=False, methods=['get'])
    def items_list(self, request):
        search = request.query_params.get('search', '').lower()
        items = Item.objects.select_related('owner', 'category').all().order_by('-created_at')
        if search:
            items = items.filter(Q(title__icontains=search) | Q(owner__username__icontains=search))
        serializer = ItemSerializer(items, many=True, context={'request': request})
        return Response(serializer.data, status=status.HTTP_200_OK)

    @action(detail=False, methods=['post'])
    def admin_update_item(self, request):
        item = get_object_or_404(Item, id=request.data.get('item_id'))
        for field in ['title', 'description', 'price_per_day', 'city', 'is_available']:
            if field in request.data:
                setattr(item, field, request.data.get(field))
        if 'is_banned' in request.data:
            item.is_banned = request.data.get('is_banned')
            if item.is_banned:
                item.is_available = False
        item.save()
        return Response({"message": "İlan güncellendi."})

    @action(detail=False, methods=['delete'])
    def delete_item(self, request):
        get_object_or_404(Item, id=request.query_params.get('item_id')).delete()
        return Response({"message": "İlan silindi."})

    @action(detail=False, methods=['delete'])
    def delete_user(self, request):
        user = get_object_or_404(User, id=request.query_params.get('user_id'))
        if user == request.user:
            return Response({"error": "Kendi hesabınızı silemezsiniz."}, status=status.HTTP_400_BAD_REQUEST)
        user.delete()
        return Response({"message": "Kullanıcı silindi."})

    @action(detail=False, methods=['get'])
    def bookings_list(self, request):
        bookings = Booking.objects.select_related('item', 'renter').all().order_by('-created_at')
        serializer = BookingSerializer(bookings, many=True, context={'request': request})
        return Response(serializer.data, status=status.HTTP_200_OK)

    @action(detail=False, methods=['delete'])
    def delete_booking(self, request):
        get_object_or_404(Booking, id=request.query_params.get('booking_id')).delete()
        return Response({"message": "Kiralama işlemi silindi."})

    @action(detail=False, methods=['get'])
    def reviews_list(self, request):
        reviews = Review.objects.select_related('reviewer', 'item').all().order_by('-created_at')
        serializer = ReviewSerializer(reviews, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @action(detail=False, methods=['delete'])
    def delete_review(self, request):
        get_object_or_404(Review, id=request.query_params.get('review_id')).delete()
        return Response({"message": "Yorum silindi."})

    @action(detail=False, methods=['get'])
    def disputed_bookings(self, request):
        disputes = Booking.objects.select_related('item', 'renter').filter(status='disputed').order_by('-updated_at')
        serializer = BookingSerializer(disputes, many=True, context={'request': request})
        return Response(serializer.data, status=status.HTTP_200_OK)

    @action(detail=False, methods=['get'])
    def system_logs(self, request):
        logs = ActivityLog.objects.select_related('user').all()[:500]
        serializer = ActivityLogSerializer(logs, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @action(detail=False, methods=['get'])
    def user_logs(self, request):
        user_id = request.query_params.get('user_id')
        logs = ActivityLog.objects.filter(user_id=user_id).order_by('-created_at')[:200]
        serializer = ActivityLogSerializer(logs, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @action(detail=False, methods=['get'])
    def withdrawals_list(self, request):
        withdrawals = WithdrawalRequest.objects.select_related('wallet__user').all().order_by('-created_at')
        serializer = WithdrawalRequestSerializer(withdrawals, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @action(detail=False, methods=['post'])
    def handle_withdrawal(self, request):
        withdrawal = get_object_or_404(WithdrawalRequest, id=request.data.get('request_id'))
        action_type = request.data.get('action') 
        reason = request.data.get('reason', '')

        if withdrawal.status != 'PENDING':
            return Response({"error": "Bu talep zaten işlenmiş."}, status=status.HTTP_400_BAD_REQUEST)

        if action_type == 'approve':
            withdrawal.status = 'APPROVED'
            withdrawal.save()
            Notification.objects.create(user=withdrawal.wallet.user, notification_type='wallet', reference_id=str(withdrawal.id), message=f"₺{withdrawal.amount} para çekme talebiniz onaylandı ve IBAN'ınıza iletildi.")
        
        elif action_type == 'reject':
            withdrawal.status = 'REJECTED'
            withdrawal.save()
            withdrawal.wallet.balance += withdrawal.amount
            withdrawal.wallet.save()
            WalletTransaction.objects.create(wallet=withdrawal.wallet, transaction_type='REFUND', amount=withdrawal.amount, description=f"Reddedilen Çekim Talebi İadesi. Sebep: {reason}")
            Notification.objects.create(user=withdrawal.wallet.user, notification_type='wallet', reference_id=str(withdrawal.id), message=f"₺{withdrawal.amount} para çekme talebiniz reddedildi. Tutar cüzdanınıza iade edildi. Sebep: {reason}")
            
        return Response({"message": "Para çekme talebi başarıyla işlendi."})

    @action(detail=False, methods=['get'])
    def reports_list(self, request):
        reports = Report.objects.select_related('reporter', 'reported_user', 'reported_item').all()
        # 🎯 ADMIN PANELİ KIRIK RESİM ÇÖZÜMÜ: context EKLENDİ!
        serializer = ReportSerializer(reports, many=True, context={'request': request})
        return Response(serializer.data, status=status.HTTP_200_OK)

    @action(detail=False, methods=['post'])
    def handle_report(self, request):
        report = get_object_or_404(Report, id=request.data.get('report_id'))
        action_type = request.data.get('action') 
        
        if report.status != 'pending':
            return Response({"error": "Bu şikayet zaten sonuçlandırılmış."}, status=status.HTTP_400_BAD_REQUEST)

        if action_type == 'dismiss':
            report.status = 'dismissed' 
            report.save()
            return Response({"message": "Şikayet asılsız olarak kapatıldı."})
        
        return Response({"error": "Lütfen gelişmiş yasaklama aracıyla işlem yapın."}, status=status.HTTP_400_BAD_REQUEST)


class WalletViewSet(viewsets.ViewSet):
    permission_classes = [IsAuthenticated]

    @action(detail=False, methods=['post'])
    def request_withdrawal(self, request):
        amount = Decimal(str(request.data.get('amount', '0')))
        iban = request.data.get('iban', '').strip()

        if amount <= 0: 
            return Response({"error": "Geçerli bir tutar girin."}, status=status.HTTP_400_BAD_REQUEST)
        if not iban: 
            return Response({"error": "IBAN adresi gereklidir."}, status=status.HTTP_400_BAD_REQUEST)

        wallet = request.user.wallet
        if wallet.balance < amount:
            return Response({"error": "Cüzdanınızda yeterli bakiye bulunmuyor."}, status=status.HTTP_400_BAD_REQUEST)

        wallet.balance -= amount
        wallet.save()
        
        WalletTransaction.objects.create(wallet=wallet, transaction_type='WITHDRAWAL', amount=amount, description=f"IBAN'a ({iban[-4:]}) para çekme talebi.")
        WithdrawalRequest.objects.create(wallet=wallet, amount=amount, iban=iban)

        return Response({"message": "Para çekme talebiniz alındı ve finans birimine iletildi."}, status=status.HTTP_200_OK)