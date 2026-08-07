import uuid
from django.contrib.auth.models import AbstractUser
from django.db import models
from django.utils import timezone
from datetime import timedelta
from django.conf import settings
from django.db.models.signals import post_save
from django.dispatch import receiver

class CustomUser(AbstractUser):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    email = models.EmailField(unique=True)
    
    first_name = models.CharField(max_length=150)
    last_name = models.CharField(max_length=150)
    date_of_birth = models.DateField(blank=True, null=True)
    phone = models.CharField(max_length=20, blank=True, null=True, unique=True)
    city = models.CharField(max_length=100, blank=True, null=True)
    district = models.CharField(max_length=100, blank=True, null=True)
    occupation = models.CharField(max_length=150, blank=True, null=True)
    is_active = models.BooleanField(default=False)
    is_2fa_enabled = models.BooleanField(default=False)


    can_post_items = models.BooleanField(default=True)
    item_ban_until = models.DateTimeField(null=True, blank=True)
    item_ban_reason = models.TextField(null=True, blank=True)

    can_send_messages = models.BooleanField(default=True)
    message_ban_until = models.DateTimeField(null=True, blank=True)
    message_ban_reason = models.TextField(null=True, blank=True)
    banned_until = models.DateTimeField(null=True, blank=True, help_text="Kullanıcının banının açılacağı tarih. Süresiz ban için çok ileri bir tarih verilebilir.")
    ban_reason = models.TextField(null=True, blank=True, help_text="Kullanıcıya gösterilecek banlanma sebebi/mesajı.")
    
    trust_score = models.FloatField(default=5.0)

    show_name = models.BooleanField(default=True)

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['username', 'first_name', 'last_name']

    def __str__(self):
        return f"{self.first_name} {self.last_name} ({self.email})"
    

class PasswordResetOTP(models.Model):
    user = models.OneToOneField(CustomUser, on_delete=models.CASCADE, related_name='reset_otp')
    otp = models.CharField(max_length=6)
    created_at = models.DateTimeField(auto_now_add=True)

    def is_valid(self):
        return timezone.now() <= self.created_at + timedelta(minutes=3)
    

class Wallet(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='wallet')
    balance = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.user.email} - Bakiye: {self.balance} ₺"

class WalletTransaction(models.Model):
    TRANSACTION_TYPES = (
        ('DEPOSIT', 'Para Yükleme'),     
        ('WITHDRAWAL', 'Para Çekme'),    
        ('PAYMENT', 'Ödeme (Kiralama)'), 
        ('INCOME', 'Kira Geliri'),       
        ('REFUND', 'İade'),              
    )
    wallet = models.ForeignKey(Wallet, on_delete=models.CASCADE, related_name='transactions')
    transaction_type = models.CharField(max_length=20, choices=TRANSACTION_TYPES)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    # 255 karakter açıklamalarımız için fazlasıyla yeterli olacak.
    description = models.CharField(max_length=255, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.wallet.user.email} - {self.get_transaction_type_display()} - {self.amount} ₺"

class WithdrawalRequest(models.Model):
    STATUS_CHOICES = (
        ('PENDING', 'Bekliyor'),
        ('APPROVED', 'Onaylandı (Ödendi)'),
        ('REJECTED', 'Reddedildi'),
    )
    wallet = models.ForeignKey(Wallet, on_delete=models.CASCADE, related_name='withdrawal_requests')
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    iban = models.CharField(max_length=50)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='PENDING')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.wallet.user.email} - {self.amount} ₺ - {self.status}"
    

@receiver(post_save, sender=settings.AUTH_USER_MODEL)
def create_user_wallet(sender, instance, created, **kwargs):
    if created:
        Wallet.objects.create(user=instance)