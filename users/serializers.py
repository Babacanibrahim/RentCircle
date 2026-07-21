from rest_framework import serializers
from .models import CustomUser, Wallet, WalletTransaction, WithdrawalRequest
from django.contrib.auth import get_user_model
from datetime import date
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
    class Meta:
        model = CustomUser
        fields = ['id', 'username', 'email', 'first_name', 'last_name', 'phone', 'city', 'district', 'occupation', 'show_name']

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