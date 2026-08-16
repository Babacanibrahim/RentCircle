from rest_framework import serializers
from .models import CustomUser, Wallet, WalletTransaction, WithdrawalRequest, ContactMessage
from django.contrib.auth import get_user_model
from datetime import date
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework.exceptions import AuthenticationFailed
from django_otp.plugins.otp_totp.models import TOTPDevice
from django.utils import timezone
from django.db import models
from django.utils.timezone import localtime
from django.contrib.auth.hashers import check_password

User = get_user_model()


class WalletTransactionSerializer(serializers.ModelSerializer):
    transaction_type_display = serializers.CharField(source='get_transaction_type_display', read_only=True)

    class Meta:
        model = WalletTransaction
        fields = ['id', 'transaction_type', 'transaction_type_display', 'amount', 'description', 'created_at']

class WalletSerializer(serializers.ModelSerializer):
    transactions = WalletTransactionSerializer(many=True, read_only=True)

    class Meta:
        model = Wallet
        fields = ['balance', 'created_at', 'transactions']

class WithdrawalRequestSerializer(serializers.ModelSerializer):
    class Meta:
        model = WithdrawalRequest
        fields = ['id', 'amount', 'iban', 'status', 'created_at']
        read_only_fields = ['status']

        
class UserProfileSerializer(serializers.ModelSerializer):

    is_item_banned = serializers.SerializerMethodField()
    is_message_banned = serializers.SerializerMethodField()
    item_ban_until_formatted = serializers.SerializerMethodField()
    message_ban_until_formatted = serializers.SerializerMethodField()

    class Meta:
        model = CustomUser
        fields = ['id', 'username', 'email', 'first_name', 'last_name', 'is_staff', 'phone', 'city', 'district', 'occupation', 'show_name', 'is_2fa_enabled',
                  'is_item_banned', 'item_ban_reason', 'item_ban_until_formatted',
                  'is_message_banned', 'message_ban_reason', 'message_ban_until_formatted']
        read_only_fields = ['id']
        
    def validate_email(self, value):
        user = self.context['request'].user
        if User.objects.exclude(pk=user.pk).filter(email=value).exists():
            raise serializers.ValidationError("Bu e-posta adresi başka bir kullanıcı tarafından kullanılıyor.")
        return value

    def validate_username(self, value):
        user = self.context['request'].user
        if User.objects.exclude(pk=user.pk).filter(username=value).exists():
            raise serializers.ValidationError("Bu kullanıcı adı alınmış, lütfen başka bir tane seçin.")
        return value

    # 🎯 YENİ: Profil güncellenirken telefon numarası başkasında var mı kontrolü
    def validate_phone(self, value):
        if not value:
            return value
        user = self.context['request'].user
        if User.objects.exclude(pk=user.pk).filter(phone=value).exists():
            raise serializers.ValidationError("Bu telefon numarası zaten sistemde kayıtlı. Lütfen size ait olan numarayı girin.")
        return value

    def get_is_item_banned(self, obj):
        return not getattr(obj, 'can_post_items', True) or (getattr(obj, 'item_ban_until', None) and obj.item_ban_until > timezone.now())

    def get_is_message_banned(self, obj):
        return not getattr(obj, 'can_send_messages', True) or (getattr(obj, 'message_ban_until', None) and obj.message_ban_until > timezone.now())

    def get_item_ban_until_formatted(self, obj):
        if getattr(obj, 'item_ban_until', None) and obj.item_ban_until > timezone.now():
            # 🎯 DÜZELTME: localtime eklendi
            return localtime(obj.item_ban_until).strftime('%d.%m.%Y %H:%M')
        return "Süresiz" if not getattr(obj, 'can_post_items', True) else None

    def get_message_ban_until_formatted(self, obj):
        if getattr(obj, 'message_ban_until', None) and obj.message_ban_until > timezone.now():
            # 🎯 DÜZELTME: localtime eklendi
            return localtime(obj.message_ban_until).strftime('%d.%m.%Y %H:%M')
        return "Süresiz" if not getattr(obj, 'can_send_messages', True) else None

class ChangePasswordSerializer(serializers.Serializer):
    old_password = serializers.CharField(required=True)
    new_password = serializers.CharField(required=True)
    confirm_password = serializers.CharField(required=True)

    def validate_old_password(self, value):
        user = self.context['request'].user
        if not user.check_password(value):
            raise serializers.ValidationError("Mevcut şifreniz yanlış.")
        return value

    def validate(self, data):
        if data['new_password'] != data['confirm_password']:
            raise serializers.ValidationError({"confirm_password": "Yeni şifreler birbiriyle eşleşmiyor."})

        if data['old_password'] == data['new_password']:
            raise serializers.ValidationError({"new_password": "Yeni şifreniz mevcut şifrenizle aynı olamaz. Lütfen farklı bir şifre belirleyin."})

        # 🎯 YENİ: Şifre Değiştirirken Zayıf Şifre Kontrolü
        password = data['new_password']
        if len(password) < 8:
            raise serializers.ValidationError({"new_password": "Şifreniz çok kısa. Güvenliğiniz için en az 8 karakterli bir şifre belirleyin."})
        
        if not any(char.isdigit() for char in password) or not any(char.isalpha() for char in password):
            raise serializers.ValidationError({"new_password": "Şifreniz çok zayıf. Lütfen içinde hem harf hem de rakam bulunan daha güçlü bir şifre belirleyin."})
        
        return data


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True)
    confirm_password = serializers.CharField(write_only=True) # Sadece doğrulama için alıyoruz, DB'ye kaydolmayacak

    class Meta:
        model = CustomUser
        fields = ('username', 'email', 'password', 'confirm_password', 'first_name', 'last_name', 'date_of_birth', 'phone', 'city', 'district', 'occupation')

    # 🎯 YENİ: Telefon numarası benzersizlik (unique) ve UX dostu hata mesajı kontrolü
    def validate_phone(self, value):
        if value:
            # Gelen numara veritabanında var mı kontrol et
            if CustomUser.objects.filter(phone=value).exists():
                raise serializers.ValidationError(
                    "Bu telefon numarası ile kayıtlı bir hesap zaten var. Şifrenizi unuttuysanız 'Şifremi Unuttum' sayfasından yeni şifre alabilirsiniz."
                )
        return value

    def validate(self, data):
        # 1. Şifre uyuşmazlık kontrolü
        if data['password'] != data['confirm_password']:
            raise serializers.ValidationError({"password": "Şifreler birbiriyle uyuşmuyor."})

        password = data['password']
        if len(password) < 8:
            raise serializers.ValidationError({"password": "Şifreniz çok kısa. Güvenliğiniz için en az 8 karakterli bir şifre belirleyin."})
        
        if not any(char.isdigit() for char in password) or not any(char.isalpha() for char in password):
            raise serializers.ValidationError({"password": "Şifreniz çok zayıf. Lütfen içinde hem harf hem de rakam bulunan daha güçlü bir şifre belirleyin."})
    
        # 2. 18 Yaş Sınırı Kontrolü (Siber Güvenlik Katmanı)
        dob = data.get('date_of_birth')
        if dob:
            today = date.today()
            # Yaş hesaplama algoritması (Artık yılları da hesaba katar)
            age = today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))
            if age < 18:
                raise serializers.ValidationError({"date_of_birth": "RentCircle platformuna kayıt olabilmek için en az 18 yaşında olmalısınız."})
                
        return data

    def create(self, validated_data):
        # confirm_password alanını user oluşturma metoduna göndermemek için siliyoruz
        validated_data.pop('confirm_password')
        
        user = CustomUser.objects.create_user(
            username=validated_data['username'],
            email=validated_data['email'],
            password=validated_data['password'],
            first_name=validated_data.get('first_name', ''),
            last_name=validated_data.get('last_name', ''),
            date_of_birth=validated_data.get('date_of_birth'),
            phone=validated_data.get('phone', ''),
            city=validated_data.get('city', ''),
            district=validated_data.get('district', ''),
            occupation=validated_data.get('occupation', '')
        )
        return user


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    def validate(self, attrs):
        # 1. SÜPER KONTROLDEN ÖNCE BİZİM KONTROLÜMÜZ: (Çünkü Django aktif olmayanları anında reddeder)
        username_or_email = attrs.get(self.username_field) or attrs.get('username') or attrs.get('email')
        password = attrs.get('password')
        
        if username_or_email and password:
            user = User.objects.filter(models.Q(username=username_or_email) | models.Q(email=username_or_email)).first()
            
            # Eğer kullanıcı var, şifresi doğru ama AKTİF DEĞİLSE (Ban yemişse)
            if user and user.check_password(password):
                if not user.is_active:
                    if getattr(user, 'banned_until', None) and user.banned_until > timezone.now():
                        date_str = localtime(user.banned_until).strftime('%d.%m.%Y %H:%M')
                        raise AuthenticationFailed({
                            "is_banned": True, 
                            "error": f"Sisteme girişiniz {date_str} tarihine kadar askıya alınmıştır.",
                            "reason": getattr(user, 'ban_reason', 'Topluluk kuralları ihlali.')
                        })
                    elif getattr(user, 'ban_reason', None):
                        raise AuthenticationFailed({
                            "is_banned": True, 
                            "error": "Hesabınız sistemden süresiz (kalıcı) olarak uzaklaştırılmıştır.",
                            "reason": user.ban_reason
                        })
                    else:
                        raise AuthenticationFailed("Hesabınız aktif değildir. Lütfen e-postanızı onaylayın.")

        # 2. Eğer ban yoksa, JWT'nin normal güvenlik kontrolünden geçir (Şifre doğrulaması vs)
        data = super().validate(attrs)
        user = self.user
        
        # 3. 2FA (İki Aşamalı Doğrulama) Kontrolü
        if getattr(user, 'is_2fa_enabled', False):
            otp_code = self.initial_data.get('otp_code', None)

            if not otp_code:
                raise AuthenticationFailed({
                    "requires_2fa": True, 
                    "error": "Lütfen Authenticator uygulamanızdaki 6 haneli kodu girin."
                })
            
            device = TOTPDevice.objects.filter(user=user, name='default').first()
            if not device or not device.verify_token(otp_code):
                raise AuthenticationFailed({
                    "error": "Girdiğiniz 2FA kodu geçersiz veya süresi dolmuş."
                })

        return data

    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        
        # FRONTEND İÇİN CEZA BİLGİLERİNİ TOKENA GÖMÜYORUZ
        is_item_banned = not getattr(user, 'can_post_items', True) or (getattr(user, 'item_ban_until', None) and user.item_ban_until > timezone.now())
        token['is_item_banned'] = is_item_banned
        token['item_ban_reason'] = getattr(user, 'item_ban_reason', None) if is_item_banned else None
        
        is_message_banned = not getattr(user, 'can_send_messages', True) or (getattr(user, 'message_ban_until', None) and user.message_ban_until > timezone.now())
        token['is_message_banned'] = is_message_banned
        token['message_ban_reason'] = getattr(user, 'message_ban_reason', None) if is_message_banned else None
        
        return token

class ContactMessageSerializer(serializers.ModelSerializer):
    class Meta:
        model = ContactMessage
        fields = ['id', 'name', 'email', 'subject', 'message', 'created_at']