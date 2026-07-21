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
    
    city = models.CharField(max_length=100)
    district = models.CharField(max_length=100)
    region = models.CharField(max_length=100, blank=True, null=True)
    
    latitude = models.DecimalField(max_digits=9, decimal_places=6, blank=True, null=True)
    longitude = models.DecimalField(max_digits=9, decimal_places=6, blank=True, null=True)
    
    is_available = models.BooleanField(default=True)
    is_banned = models.BooleanField(default=False)
    banned_until = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.title


class Booking(models.Model):
    STATUS_CHOICES = [
        ('pending_approval', 'Onay Bekliyor (Para Havuzda)'),
        ('approved', 'Onaylandı (Bekleniyor)'),
        ('active', 'Kirada (Teslim Edildi)'),
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
    
    # 🎯 YENİ: Kimin iptal ettiğini takip etmek için
    cancelled_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='cancelled_bookings')
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    dispute_reason = models.TextField(blank=True, null=True) 

    def generate_pin(self, length=6):
        chars = string.ascii_uppercase + string.digits
        return ''.join(random.choice(chars) for _ in range(length))

    def save(self, *args, **kwargs):
        if self.start_date and self.end_date and self.item:
            days = (self.end_date - self.start_date).days + 1
            if days <= 0: days = 1
            
            # 🎯 KRİTİK DÜZELTME: Eğer total_price dışarıdan (tekliften) gelmemişse standart hesapla!
            # Eğer geldiyse, anlaşılan o teklif fiyatına dokunma.
            if not self.total_price:
                self.total_price = self.item.price_per_day * days
                
            # Depozitoyu (Standart veya Pazarlıklı) o anki total_price üzerinden hesapla
            self.deposit_price = Decimal(str(self.total_price)) * Decimal('0.15')
            
        if not self.handover_pin:
            self.handover_pin = self.generate_pin()
        if not self.return_pin:
            self.return_pin = self.generate_pin()
            
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.renter.email} -> {self.item.title} ({self.status})"


class BookingImage(models.Model):
    IMAGE_TYPE_CHOICES = [
        ('handover', 'Teslimat Anı'),
        ('return', 'İade Anı'),
    ]
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    booking = models.ForeignKey(Booking, on_delete=models.CASCADE, related_name='images')
    image = models.ImageField(upload_to='booking_evidence/')
    image_type = models.CharField(max_length=10, choices=IMAGE_TYPE_CHOICES)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.image_type} - {self.booking.id}"


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
    item = models.ForeignKey('Item', on_delete=models.CASCADE, related_name='conversations')
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
    
    # 🎯 YENİ: Teklif (Pazarlık) Sistemi Alanları
    is_offer = models.BooleanField(default=False) # Bu mesaj bir teklif mi?
    offer_price = models.DecimalField(max_digits=10, decimal_places=2, blank=True, null=True)
    offer_start_date = models.DateField(blank=True, null=True)
    offer_end_date = models.DateField(blank=True, null=True)
    offer_status = models.CharField(
        max_length=20, 
        choices=[('pending', 'Bekliyor'), ('accepted', 'Kabul Edildi'), ('rejected', 'Reddedildi')], 
        blank=True, null=True
    )
    
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at']

    def __str__(self):
        return f"{self.sender.username}: {self.content[:20]}"
    
class Review(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    booking = models.OneToOneField(Booking, on_delete=models.CASCADE, related_name='review')
    item = models.ForeignKey(Item, on_delete=models.CASCADE, related_name='reviews')
    reviewer = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='reviews_given')
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='reviews_received')
    
    rating = models.IntegerField(choices=[(i, i) for i in range(1, 6)]) 
    comment = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.reviewer.first_name} -> {self.item.title} ({self.rating} Yıldız)"
    

class Notification(models.Model):
    # 🎯 YENİ: Bildirim türlerine Finansal ve İptal/Sistem türlerini ekledik.
    NOTIFICATION_TYPES = (
        ('message', 'Mesaj'),
        ('booking', 'Kiralama Talebi'),
        ('wallet', 'Cüzdan ve Finans'),
        ('system', 'İptal ve Sistem'),
    )
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='notifications')
    sender = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True) # Sistem bildirimlerinde sender null olabilir
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