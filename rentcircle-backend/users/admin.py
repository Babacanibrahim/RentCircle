from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from unfold.admin import ModelAdmin
# 🎯 YENİ: Wallet modellerini import'a ekledik
from .models import CustomUser, Wallet, WalletTransaction, WithdrawalRequest

# --- MEVCUT KULLANICI ADMİNİ ---
@admin.register(CustomUser)
class CustomUserAdmin(BaseUserAdmin, ModelAdmin):
    list_display = ('email', 'username', 'first_name', 'last_name', 'is_staff', 'is_active')
    search_fields = ('email', 'username', 'first_name', 'last_name')
    ordering = ('email',)
    list_filter = ('is_staff', 'is_superuser', 'is_active', 'groups')
    
    fieldsets = (
        ('Giriş Bilgileri', {'fields': ('username', 'password')}),
        ('Kişisel Bilgiler', {'fields': ('first_name', 'last_name', 'email')}),
        ('Sistem Yetkileri', {
            'fields': ('is_active', 'is_staff', 'is_superuser', 'groups', 'user_permissions'),
            'classes': ('collapse',),
        }),
        ('Kayıt Tarihleri', {'fields': ('last_login', 'date_joined')}),
    )

# --- 🎯 YENİ: CÜZDAN (WALLET) ADMİN PANELLERİ ---

@admin.register(Wallet)
class WalletAdmin(ModelAdmin):
    list_display = ('user', 'balance', 'created_at', 'updated_at')
    search_fields = ('user__email', 'user__first_name', 'user__last_name')
    list_filter = ('created_at',)
    # Admin panelinden içeri girip bakiyeye manuel müdahale edebilirsin

@admin.register(WalletTransaction)
class WalletTransactionAdmin(ModelAdmin):
    list_display = ('wallet', 'get_user_email', 'transaction_type', 'amount', 'created_at')
    list_filter = ('transaction_type', 'created_at')
    search_fields = ('wallet__user__email', 'description')
    ordering = ('-created_at',)

    # Listede kullanıcının emailini direkt görmek için küçük bir fonksiyon
    def get_user_email(self, obj):
        return obj.wallet.user.email
    get_user_email.short_description = 'Kullanıcı'

@admin.register(WithdrawalRequest)
class WithdrawalRequestAdmin(ModelAdmin):
    list_display = ('wallet', 'amount', 'iban', 'status', 'created_at')
    list_filter = ('status', 'created_at')
    search_fields = ('wallet__user__email', 'iban')
    # Harika Özellik: Liste ekranından direkt Bekliyor / Onaylandı olarak değiştirebilirsin
    list_editable = ('status',) 
    ordering = ('-created_at',)