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
        # Kodun ömrü tam olarak 3 dakika (180 saniye)
        return timezone.now() <= self.created_at + timedelta(minutes=3)
    

class Wallet(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='wallet')
    balance = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.user.email} - Bakiye: {self.balance} ₺"

# 2. CÜZDAN HAREKETLERİ (Geçmiş)
class WalletTransaction(models.Model):
    TRANSACTION_TYPES = (
        ('DEPOSIT', 'Para Yükleme'),     # Kredi/Banka kartından cüzdana yükleme
        ('WITHDRAWAL', 'Para Çekme'),    # Cüzdandan IBAN'a aktarma
        ('PAYMENT', 'Ödeme (Kiralama)'), # Kiralama için cüzdandan harcama
        ('INCOME', 'Kira Geliri'),       # Kiralamadan cüzdana gelen para
        ('REFUND', 'İade'),              # İptal durumunda cüzdana iade
    )
    wallet = models.ForeignKey(Wallet, on_delete=models.CASCADE, related_name='transactions')
    transaction_type = models.CharField(max_length=20, choices=TRANSACTION_TYPES)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    description = models.CharField(max_length=255, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.wallet.user.email} - {self.get_transaction_type_display()} - {self.amount} ₺"

# 3. IBAN'A PARA ÇEKME TALEPLERİ
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
    """Yeni bir kullanıcı oluşturulduğunda otomatik Wallet oluşturur."""
    if created:
        Wallet.objects.create(user=instance)