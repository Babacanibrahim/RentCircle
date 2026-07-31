import uuid
import string
import random
from decimal import Decimal
from django.db import models
from django.conf import settings
from django.contrib.auth import get_user_model
from django.db.models.signals import post_save
from django.dispatch import receiver
from django.utils import timezone
from users.models import WalletTransaction

class Category(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=100, unique=True)
    slug = models.SlugField(max_length=100, unique=True)

    class Meta:
        verbose_name_plural = "Categories"

    def __str__(self):
        return self.name

User = get_user_model()

class Item(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='items')
    category = models.ForeignKey(Category, on_delete=models.SET_NULL, null=True, related_name='items')
    
    title = models.CharField(max_length=255)
    description = models.TextField()
    price_per_day = models.DecimalField(max_digits=10, decimal_places=2)
    favorites = models.ManyToManyField(User, related_name="favorite_items", blank=True)
    views_count = models.PositiveIntegerField(default=0, verbose_name="Görüntülenme Sayısı")
    
    city = models.CharField(max_length=100)
    district = models.CharField(max_length=100)
    region = models.CharField(max_length=100, blank=True, null=True, verbose_name="Mahalle / Semt")
    full_address = models.TextField(blank=True, null=True, verbose_name="Açık Adres (Cadde/Sokak/No)")
    latitude = models.DecimalField(max_digits=9, decimal_places=6, blank=True, null=True)
    longitude = models.DecimalField(max_digits=9, decimal_places=6, blank=True, null=True)
    
    is_available = models.BooleanField(default=True)
    is_banned = models.BooleanField(default=False)
    banned_until = models.DateTimeField(null=True, blank=True, help_text="İlanın banının açılacağı tarih.")
    ban_reason = models.TextField(null=True, blank=True, help_text="Satıcıya gösterilecek ilanın kaldırılma/banlanma sebebi.")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.title


class Booking(models.Model):
    STATUS_CHOICES = [
        ('pending_approval', 'Onay Bekliyor (Para Havuzda)'),
        ('approved', 'Onaylandı (Bekleniyor)'),
        # 🎯 YENİ: Teslimat sürecindeki ara durumlar
        ('handover_pending', 'Satıcı Teslimat Onayı Bekliyor'), # Kiracı teslim alıp fotoğraf yüklediğinde
        ('active', 'Kirada (Teslim Edildi)'),
        ('return_pending', 'Kiracı İade Onayı Bekliyor'), # Satıcı iade alıp fotoğraf yüklediğinde
        ('completed', 'Tamamlandı (İade Edildi)'),
        ('rejected', 'Reddedildi / İptal'),
        ('disputed', 'Uyuşmazlık (Sorun Var)'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    item = models.ForeignKey(Item, on_delete=models.CASCADE, related_name='bookings')
    renter = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='bookings')
    
    start_date = models.DateField()
    end_date = models.DateField()
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending_approval')
    
    total_price = models.DecimalField(max_digits=10, decimal_places=2, blank=True, null=True)
    deposit_price = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    
    handover_pin = models.CharField(max_length=6, blank=True, null=True)
    return_pin = models.CharField(max_length=6, blank=True, null=True)
    
    cancelled_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='cancelled_bookings')
    
    # 🎯 YENİ: Tarafların Teslimat/İade Esnasında Bıraktıkları Yorumlar
    handover_notes = models.TextField(blank=True, null=True, help_text="Kiracının ürünü alırken bıraktığı not")
    return_notes = models.TextField(blank=True, null=True, help_text="Satıcının ürünü iade alırken bıraktığı not")

    # 🎯 YENİ: Uyuşmazlık Çözümü İçin Gerekli Alanlar
    dispute_reason = models.TextField(blank=True, null=True, help_text="İtiraz edilirse sebebi")
    
    DISPUTE_WINNER_CHOICES = (
        ('owner', 'Satıcı Haklı (Depozito Satıcıda Kalır)'),
        ('renter', 'Kiracı Haklı (Depozito İade Edilir)'),
        ('draw', 'Berabere / Kısmi'),
    )
    dispute_winner = models.CharField(max_length=10, choices=DISPUTE_WINNER_CHOICES, blank=True, null=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def generate_pin(self, length=6):
        chars = string.ascii_uppercase + string.digits
        return ''.join(random.choice(chars) for _ in range(length))

    def save(self, *args, **kwargs):
        if self.start_date and self.end_date and self.item:
            days = (self.end_date - self.start_date).days + 1
            if days <= 0: days = 1
            
            if not self.total_price:
                self.total_price = self.item.price_per_day * days
                
            self.deposit_price = Decimal(str(self.total_price)) * Decimal('0.15')
            
        if not self.handover_pin:
            self.handover_pin = self.generate_pin()
        if not self.return_pin:
            self.return_pin = self.generate_pin()
            
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.renter.email} -> {self.item.title} ({self.status})"


class BookingImage(models.Model):
    # 🎯 DÜZELTİLDİ: Sadece image_type değil, stage (aşama) olarak netleştirildi.
    IMAGE_TYPE_CHOICES = [
        ('handover', 'Teslim Alırken (Kiracı Yükledi)'),
        ('return', 'İade Ederken (Satıcı Yükledi)'),
    ]
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    booking = models.ForeignKey(Booking, on_delete=models.CASCADE, related_name='images')
    image = models.ImageField(upload_to='booking_evidence/')
    image_type = models.CharField(max_length=10, choices=IMAGE_TYPE_CHOICES)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.get_image_type_display()} - {self.booking.id}"


class ItemImage(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    item = models.ForeignKey(Item, on_delete=models.CASCADE, related_name='images')
    image = models.ImageField(upload_to='item_images/') 
    is_main = models.BooleanField(default=False) 
    created_at = models.DateTimeField(auto_now_add=True)

    def save(self, *args, **kwargs):
        if self.is_main:
            ItemImage.objects.filter(item=self.item, is_main=True).update(is_main=False)
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{'Kapak - ' if self.is_main else ''}Image for {self.item.title}"


class Conversation(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    item = models.ForeignKey(Item, on_delete=models.CASCADE, related_name='conversations', null=True, blank=True)
    renter = models.ForeignKey(User, on_delete=models.CASCADE, related_name='renter_conversations')
    owner = models.ForeignKey(User, on_delete=models.CASCADE, related_name='owner_conversations')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('item', 'renter', 'owner')
        ordering = ['-updated_at']

    def __str__(self):
        return f"{self.renter.username} -> {self.owner.username} ({self.item.title})"


class Message(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    conversation = models.ForeignKey(Conversation, on_delete=models.CASCADE, related_name='messages')
    sender = models.ForeignKey(User, on_delete=models.CASCADE, related_name='sent_messages')
    content = models.TextField()
    is_read = models.BooleanField(default=False)
    
    is_offer = models.BooleanField(default=False)
    offer_price = models.DecimalField(max_digits=10, decimal_places=2, blank=True, null=True)
    offer_start_date = models.DateField(blank=True, null=True)
    offer_end_date = models.DateField(blank=True, null=True)
    offer_status = models.CharField(
        max_length=20, 
        choices=[('pending', 'Bekliyor'), ('accepted', 'Kabul Edildi'), ('rejected', 'Reddedildi')], 
        blank=True, null=True
    )

    is_location_share = models.BooleanField(default=False, verbose_name="Konum Paylaşımı mı?")
    location_lat = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True, verbose_name="Enlem")
    location_lon = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True, verbose_name="Boylam")
    location_address = models.CharField(max_length=255, null=True, blank=True, verbose_name="Açık Adres / Yer İsmi")
    
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at']

    def __str__(self):
        return f"{self.sender.username}: {self.content[:20]}"
    
class Review(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    # 🎯 1. DEĞİŞİKLİK: OneToOne yerine ForeignKey yaptık. Artık hem kiracı hem satıcı yorum atabilir.
    booking = models.ForeignKey(Booking, on_delete=models.CASCADE, related_name='reviews')
    item = models.ForeignKey(Item, on_delete=models.CASCADE, related_name='reviews')
    reviewer = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='reviews_given')
    # 🎯 2. DEĞİŞİKLİK: "owner" kelimesini "target_user" yaptık ki satıcı da kiracıyı puanlayabilsin.
    target_user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='reviews_received')
    
    rating = models.IntegerField(choices=[(i, i) for i in range(1, 6)]) 
    comment = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        unique_together = ('booking', 'reviewer')

    def __str__(self):
        return f"{self.reviewer.first_name} -> {self.target_user.first_name} ({self.rating} Yıldız)"
    

class Notification(models.Model):
    NOTIFICATION_TYPES = (
        ('message', 'Mesaj'),
        ('booking', 'Kiralama Talebi'),
        ('wallet', 'Cüzdan ve Finans'),
        ('system', 'İptal ve Sistem'),
        ('review', 'Değerlendirme'), # 🎯 YENİ: Yorum bildirimleri için
    )
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='notifications')
    sender = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True) 
    item = models.ForeignKey(Item, on_delete=models.CASCADE, null=True, blank=True)
    notification_type = models.CharField(max_length=20, choices=NOTIFICATION_TYPES)
    
    reference_id = models.CharField(max_length=50)
    message = models.CharField(max_length=255)
    
    is_read = models.BooleanField(default=False) 
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']


@receiver(post_save, sender=Message)
def create_message_notification(sender, instance, created, **kwargs):
    if created:
        recipient = instance.conversation.owner if instance.sender == instance.conversation.renter else instance.conversation.renter
        Notification.objects.update_or_create(
            user=recipient,
            notification_type='message',
            reference_id=str(instance.conversation.id),
            defaults={
                'sender': instance.sender,
                'item': instance.conversation.item,
                'message': f"{instance.sender.first_name} size yeni bir mesaj gönderdi.",
                'is_read': False,
                'created_at': timezone.now()
            }
        )

@receiver(post_save, sender=Booking)
def create_booking_notification(sender, instance, created, **kwargs):
    if created:
        Notification.objects.update_or_create(
            user=instance.item.owner,
            notification_type='booking',
            reference_id=str(instance.id),
            defaults={
                'sender': instance.renter,
                'item': instance.item,
                'message': f"{instance.renter.first_name}, '{instance.item.title}' için kiralama talebi gönderdi.",
                'is_read': False,
                'created_at': timezone.now()
            }
        )

# -----------------------------------------------------------
# 🛡️ SİSTEM AKTİVİTE LOGLARI (GOD MODE İZLEME)
# -----------------------------------------------------------
class ActivityLog(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='activity_logs')
    action_type = models.CharField(max_length=50) 
    description = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Aktivite Logu'
        verbose_name_plural = 'Aktivite Logları'

    def __str__(self):
        return f"{self.user.email} - {self.action_type} - {self.created_at}"

# --- OTOMATİK LOG YAKALAYICI SİNYALLER (SIGNALS) ---

@receiver(post_save, sender=Item)
def log_item_creation(sender, instance, created, **kwargs):
    if created:
        ActivityLog.objects.create(
            user=instance.owner, 
            action_type="İLAN OLUŞTURDU", 
            description=f"'{instance.title}' başlıklı yeni bir ilan eklendi."
        )

@receiver(post_save, sender=Review)
def log_review_creation(sender, instance, created, **kwargs):
    if created:
        ActivityLog.objects.create(
            user=instance.reviewer, 
            action_type="YORUM YAPTI", 
            description=f"@{instance.target_user.username} kullanıcısına {instance.rating} yıldızlı değerlendirme yaptı."
        )

@receiver(post_save, sender=Booking)
def log_booking_creation(sender, instance, created, **kwargs):
    if created:
        ActivityLog.objects.create(
            user=instance.renter, 
            action_type="KİRALAMA BAŞLATTI", 
            description=f"'{instance.item.title}' ürününü kiralamak için işlem başlattı. (Tutar: ₺{instance.total_price})"
        )

# 🎯 SENİN MODELİNE ÖZEL: WalletTransaction tiplerini ayırıyoruz
@receiver(post_save, sender=WalletTransaction) 
def log_wallet_transaction(sender, instance, created, **kwargs):
    if created:
        # DEPOSIT, INCOME ve REFUND para girişidir. Diğerleri çıkış.
        if instance.transaction_type in ['DEPOSIT', 'INCOME', 'REFUND']:
            action = "PARA GİRİŞİ"
        else:
            action = "PARA ÇIKIŞI"
            
        ActivityLog.objects.create(
            user=instance.wallet.user, 
            action_type=action, 
            description=f"Cüzdan İşlemi: ₺{instance.amount} ({instance.get_transaction_type_display()})"
        )

class Report(models.Model):
    REPORT_TARGET_CHOICES = (
        ('item', 'İlan Şikayeti'),
        ('user', 'Kullanıcı Şikayeti'),
    )
    STATUS_CHOICES = (
        ('pending', 'İnceleniyor (Açık)'),
        ('resolved', 'Çözüldü (İşlem Yapıldı)'),
        ('dismissed', 'Kapatıldı (Asılsız/Red)'),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    reporter = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='submitted_reports')
    
    target_type = models.CharField(max_length=10, choices=REPORT_TARGET_CHOICES)
    reported_item = models.ForeignKey(Item, on_delete=models.CASCADE, null=True, blank=True, related_name='reports')
    reported_user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, null=True, blank=True, related_name='reports_received')
    
    reason = models.CharField(max_length=255) # Örn: Sahte ürün, Hakaret, Yanıltıcı Görsel
    description = models.TextField(blank=True, null=True)
    
    proof_image = models.ImageField(upload_to='reports/proofs/', null=True, blank=True, help_text="Kullanıcının şikayetine eklediği kanıt görseli.")
    
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.reporter.username} -> {self.target_type} şikayeti"


class Ticket(models.Model):
    TICKET_TOPIC_CHOICES = (
        ('billing', 'Ödeme ve Bakiye İşlemleri'),
        ('account', 'Hesap ve Profil İşlemleri'),
        ('item_issue', 'İlan ve Kiralama Sorunları'),
        ('technical', 'Sistem ve Teknik Sorunlar'),
        ('other', 'Diğer'),
    )
    STATUS_CHOICES = (
        ('open', 'Açık (Bekliyor)'),
        ('in_progress', 'İnceleniyor'),
        ('resolved', 'Çözüldü'),
        ('closed', 'Kapatıldı'),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='tickets')
    
    topic = models.CharField(max_length=20, choices=TICKET_TOPIC_CHOICES)
    subject = models.CharField(max_length=255, help_text="Kullanıcının yazdığı kısa konu başlığı")
    description = models.TextField(help_text="Sorunun detaylı açıklaması")
    
    # Maksimum 1 görsel eklenebilecek alan
    attachment = models.ImageField(upload_to='tickets/attachments/', null=True, blank=True, help_text="Kullanıcının sorunuyla ilgili eklediği görsel.")
    
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='open')
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"Ticket #{str(self.id)[:8]} - {self.user.username} ({self.get_topic_display()})"