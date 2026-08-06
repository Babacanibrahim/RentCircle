import random
from django.conf import settings
from django.contrib.auth.tokens import default_token_generator
from django.utils.http import urlsafe_base64_encode, urlsafe_base64_decode
from django.utils.encoding import force_bytes, force_str
from django.core.mail import send_mail
from django.utils import timezone
from django.db import models, transaction
from django.utils.html import strip_tags
from decimal import Decimal
from django_otp.plugins.otp_totp.models import TOTPDevice
import qrcode
import base64
from io import BytesIO
from rest_framework.permissions import AllowAny
from django.http import HttpResponseRedirect
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.generics import RetrieveUpdateAPIView
from rest_framework.decorators import api_view, permission_classes
from rest_framework.throttling import ScopedRateThrottle # 🛡️ YENİ: Kalkan kütüphanesi eklendi
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView
import iyzipay
import uuid
from django.shortcuts import redirect
from django.contrib.auth import get_user_model

from .serializers import RegisterSerializer, UserProfileSerializer, ChangePasswordSerializer, WalletSerializer, CustomTokenObtainPairSerializer
from .models import CustomUser, PasswordResetOTP, Wallet, WalletTransaction, WithdrawalRequest

User = get_user_model()

# 🛡️ ZIRHLI: Şifre Sıfırlama Spam Koruması
class ForgotPasswordRequestView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'password_reset'

    def post(self, request):
        method = request.data.get('method')
        identifier = request.data.get('identifier', '').strip().lstrip('@')

        user = None
        if method == 'email':
            user = CustomUser.objects.filter(email=identifier).first()
        elif method == 'username':
            user = CustomUser.objects.filter(username=identifier).first()

        if user:
            otp_obj, created = PasswordResetOTP.objects.get_or_create(user=user)
            otp_obj.otp = str(random.randint(100000, 999999))
            otp_obj.created_at = timezone.now()
            otp_obj.save()

            subject = "RentCircle - Şifre Sıfırlama Kodu"
            html_message = f"""
                        
                        
                        
                            
                                
                                    
                                        
                                            RENTCIRCLE
                                        
                                    
                                    Merhaba {user.first_name},
                                    
                                        Hesabınız için bir şifre sıfırlama talebi aldık. İşleme devam etmek için doğrulama kodunuz aşağıdadır:
                                    
                                    
                                        
                                            {otp_obj.otp}
                                        
                                    
                                    
                                        ⚠️ Bu kod güvenliğiniz için sadece 3 dakika geçerlidir.
                                    
                                    
                                        Bu talebi siz yapmadıysanız lütfen bu e-postayı görmezden gelin. Şifreniz siz kodu onaylayana kadar değiştirilmeyecektir.
                                    
                                
                            
                        
                        
                        """
            plain_message = strip_tags(html_message)

            send_mail(
                subject=subject,
                message=plain_message,
                from_email='RentCircle ',
                recipient_list=[user.email],
                html_message=html_message
            )

        return Response({"message": "Eğer bilgileriniz sistemimizle eşleşiyorsa, şifre sıfırlama kodu kayıtlı e-posta adresinize gönderildi."}, status=status.HTTP_200_OK)


class VerifyOTPView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        identifier = request.data.get('identifier', '').strip().lstrip('@')
        otp = request.data.get('otp')

        user = CustomUser.objects.filter(models.Q(email=identifier) | models.Q(username=identifier)).first()
        if not user or not hasattr(user, 'reset_otp'):
            return Response({"error": "Geçersiz işlem veya süresi dolmuş kod."}, status=status.HTTP_400_BAD_REQUEST)

        otp_obj = user.reset_otp
        if otp_obj.otp != otp or not otp_obj.is_valid():
            return Response({"error": "Girdiğiniz kod hatalı veya 3 dakikalık süresi dolmuş."}, status=status.HTTP_400_BAD_REQUEST)

        return Response({"message": "Kod başarıyla doğrulandı."}, status=status.HTTP_200_OK)


class ResetPasswordConfirmView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        identifier = request.data.get('identifier', '').strip().lstrip('@')
        otp = request.data.get('otp')
        new_password = request.data.get('new_password')
        confirm_password = request.data.get('confirm_password')

        if new_password != confirm_password:
            return Response({"error": "Yeni şifreler birbiriyle uyuşmuyor."}, status=status.HTTP_400_BAD_REQUEST)

        if len(new_password) < 8:
            return Response({"error": "Şifreniz çok kısa. Güvenliğiniz için en az 8 karakterli bir şifre belirleyin."}, status=status.HTTP_400_BAD_REQUEST)
        
        if not any(char.isdigit() for char in new_password) or not any(char.isalpha() for char in new_password):
            return Response({"error": "Şifreniz çok zayıf. Lütfen içinde hem harf hem de rakam bulunan daha güçlü bir şifre belirleyin."}, status=status.HTTP_400_BAD_REQUEST)

        user = CustomUser.objects.filter(models.Q(email=identifier) | models.Q(username=identifier)).first()
        if not user or not hasattr(user, 'reset_otp'):
            return Response({"error": "Geçersiz işlem."}, status=status.HTTP_400_BAD_REQUEST)

        otp_obj = user.reset_otp
        if otp_obj.otp != otp or not otp_obj.is_valid():
            return Response({"error": "Doğrulama kodunun süresi dolmuş. Lütfen baştan başlayın."}, status=status.HTTP_400_BAD_REQUEST)

        user.set_password(new_password)
        user.save()
        otp_obj.delete() 

        return Response({"message": "Şifreniz başarıyla değiştirildi. Giriş yapabilirsiniz."}, status=status.HTTP_200_OK)

# 🛡️ ZIRHLI: Bot Kayıt (Spam) Koruması
class RegisterView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'register_attempts'

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        if serializer.is_valid():
            user = serializer.save() 
            
            uid = urlsafe_base64_encode(force_bytes(user.pk))
            token = default_token_generator.make_token(user)
            activation_link = f"http://localhost:8000/api/auth/activate/{uid}/{token}/"
            
            subject = "RentCircle - Aramıza Hoş Geldin! Hesabını Aktifleştir"
            html_message = f"""
                        
                        
                        
                            
                                
                                    
                                        
                                            RENTCIRCLE
                                        
                                    
                                    Merhaba {user.first_name},
                                    
                                        Güvenli Pazar Yeri ekosistemine hoş geldin! Hesabını aktifleştirip ilanları incelemeye veya kendi ürünlerini kiralamaya başlamak için tek bir adımın kaldı.
                                    
                                    
                                        
                                            Hesabımı Aktifleştir
                                        
                                    
                                    
                                        Eğer buton çalışmıyorsa aşağıdaki bağlantıyı tarayıcınıza kopyalayabilirsiniz:
                                        {activation_link}
                                    
                                
                                
                                    Bu hesabı siz oluşturmadıysanız, e-postayı güvenle silebilirsiniz.
                                    © 2026 RentCircle. Tüm hakları saklıdır.
                                
                            
                        
                        
                        """
            plain_message = strip_tags(html_message)

            send_mail(
                subject=subject,
                message=plain_message,
                from_email='RentCircle ',
                recipient_list=[user.email],
                html_message=html_message 
            )
            
            return Response({"message": "Kayıt başarılı! Lütfen e-posta adresinize gönderilen aktivasyon linkini onaylayın."}, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class ActivateAccountView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, uidb64, token):
        try:
            uid = force_str(urlsafe_base64_decode(uidb64))
            user = User.objects.get(pk=uid)
        except (TypeError, ValueError, OverflowError, User.DoesNotExist):
            user = None

        if user is not None and default_token_generator.check_token(user, token):
            user.is_active = True
            user.save()
            return redirect("http://localhost:5173/login?activated=true")
        else:
            return redirect("http://localhost:5173/login?activated=false")

# 🛡️ ZIRHLI VE İZLEMELİ ÇIKIŞ: Çalınan Token'ları Kara Listeye Alma
class LogoutViewSet(APIView):
    permission_classes = [AllowAny] 
    # 🎯 SİHİRLİ DOKUNUŞ: JWT doğrulamayı tamamen kapatır. 
    # Süresi bitmiş Access Token gelse bile hata fırlatmaz, kodun çalışmasına izin verir.
    authentication_classes = [] 

    def post(self, request):
        try:
            refresh_token = request.data.get("refresh_token")
            print(f"🔍 [KARA LİSTE TESTİ] Gelen Token: {refresh_token}") 
            
            if not refresh_token:
                print("❌ [KARA LİSTE HATASI] Frontend'den token gelmedi!")
                return Response({"error": "Refresh token gerekli."}, status=status.HTTP_400_BAD_REQUEST)
                
            token = RefreshToken(refresh_token)
            token.blacklist() 
            print("✅ [KARA LİSTE BAŞARILI] Token sonsuza dek kilitlendi!")
            
            return Response({"message": "Güvenli çıkış yapıldı, token kara listeye alındı."}, status=status.HTTP_200_OK)
        except Exception as e:
            print(f"⚠️ [KARA LİSTE DURUMU] İşlem atlandı: {str(e)}") 
            return Response({"message": "Güvenli çıkış yapıldı."}, status=status.HTTP_200_OK)
        

class UserProfileView(RetrieveUpdateAPIView):
    serializer_class = UserProfileSerializer
    permission_classes = [IsAuthenticated]

    def get_object(self):
        return self.request.user


class ChangePasswordView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = ChangePasswordSerializer(data=request.data, context={'request': request})
        if serializer.is_valid():
            user = request.user
            user.set_password(serializer.validated_data['new_password'])
            user.save()
            return Response({"message": "Şifreniz başarıyla değiştirildi."}, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    

class WalletDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        wallet, created = Wallet.objects.get_or_create(user=request.user)
        serializer = WalletSerializer(wallet)
        data = serializer.data
        
        data['transactions'] = sorted(data['transactions'], key=lambda x: x['created_at'], reverse=True)[:20]
        return Response(data, status=status.HTTP_200_OK)

# ==========================================
# 🛡️ GÜVENLİK ZIRHI: 2FA KORUMALI PARA ÇEKME İŞLEMİ
# ==========================================
class RequestWithdrawalView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        wallet = request.user.wallet
        amount = request.data.get('amount')
        iban = request.data.get('iban')
        otp_code = request.data.get('otp_code') # Frontend'den gelecek olan 6 haneli kod

        if not amount or not iban:
            return Response({"error": "Tutar ve IBAN zorunludur."}, status=status.HTTP_400_BAD_REQUEST)

        # 🛡️ 1. GÜVENLİK DUVARI: 2FA KULLANIMI ZORUNLU KILINDI!
        if not request.user.is_2fa_enabled:
            return Response({
                "error": "Finansal güvenliğiniz için para çekme işlemi yapmadan önce profil ayarlarınızdan İki Aşamalı Doğrulama'yı (2FA) aktifleştirmeniz zorunludur."
            }, status=status.HTTP_403_FORBIDDEN)

        # 🛡️ 2. GÜVENLİK DUVARI: SIFIR GÜVEN (ZERO-TRUST) 2FA KOD KONTROLÜ
        # 1. Kullanıcının 2FA'sı zorunlu olarak açık, ama modal henüz kodu göndermemiş
        if not otp_code:
            return Response({
                "error": "Bu işlem için İki Aşamalı Doğrulama (2FA) kodu gereklidir.", 
                "requires_2fa": True # Frontend'in modal açmasını tetikleyecek gizli bayrak
            }, status=status.HTTP_403_FORBIDDEN)
        
        # 2. Kod gönderilmiş, cihazı bul ve doğrula
        device = TOTPDevice.objects.filter(user=request.user, name='default').first()
        if not device or not device.verify_token(otp_code):
            return Response({
                "error": "Geçersiz veya süresi dolmuş 2FA kodu! İşlem reddedildi."
            }, status=status.HTTP_401_UNAUTHORIZED)
        
        try:
            amount = Decimal(str(amount))
            if amount <= 0:
                return Response({"error": "Geçerli bir tutar girin."}, status=status.HTTP_400_BAD_REQUEST)
        except ValueError:
            return Response({"error": "Geçersiz tutar formatı."}, status=status.HTTP_400_BAD_REQUEST)

        if wallet.balance < amount:
            return Response({"error": "Yetersiz bakiye."}, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            wallet.balance -= amount
            wallet.save()

            WalletTransaction.objects.create(
                wallet=wallet,
                transaction_type='WITHDRAWAL',
                amount=amount,
                description=f"IBAN'a para çekme talebi: {iban}"
            )

            WithdrawalRequest.objects.create(
                wallet=wallet,
                amount=amount,
                iban=iban
            )

        return Response({"message": "Para çekme talebiniz başarıyla alındı."}, status=status.HTTP_201_CREATED)
    
def get_iyzico_options():
    return {
        'api_key': settings.IYZICO_API_KEY,
        'secret_key': settings.IYZICO_SECRET_KEY,
        'base_url': settings.IYZICO_BASE_URL
    }

class InitiateDepositView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        amount = request.data.get('amount')
        if not amount:
            return Response({"error": "Tutar belirtilmelidir."}, status=status.HTTP_400_BAD_REQUEST)

        user = request.user
        options = get_iyzico_options()

        conversation_id = f"DEP_{user.id}_{uuid.uuid4().hex[:6]}"

        request_data = {
            'locale': 'tr',
            'conversationId': conversation_id,
            'price': str(amount),
            'paidPrice': str(amount),
            'currency': 'TRY',
            'basketId': f"BSK-{user.id}",
            'paymentGroup': 'PRODUCT',
            'callbackUrl': "http://localhost:8000/api/users/wallet/deposit/callback/",
            'enabledInstallments': ['2', '3', '6', '9'],
            'buyer': {
                'id': str(user.id),
                'name': user.first_name or 'İsimsiz',
                'surname': user.last_name or 'Kullanıcı',
                'gsmNumber': '+905555555555',
                'email': user.email,
                'identityNumber': '11111111111', 
                'lastLoginDate': '2023-01-01 10:00:00',
                'registrationDate': '2023-01-01 10:00:00',
                'registrationAddress': 'Denizli Türkiye',
                'ip': request.META.get('REMOTE_ADDR', '85.34.78.112'),
                'city': 'Denizli',
                'country': 'Turkey',
                'zipCode': '20000'
            },
            'shippingAddress': {
                'contactName': f"{user.first_name} {user.last_name}",
                'city': 'Denizli',
                'country': 'Turkey',
                'address': 'Denizli Türkiye',
                'zipCode': '20000'
            },
            'billingAddress': {
                'contactName': f"{user.first_name} {user.last_name}",
                'city': 'Denizli',
                'country': 'Turkey',
                'address': 'Denizli Türkiye',
                'zipCode': '20000'
            },
            'basketItems': [
                {
                    'id': 'WALLET-TOPUP',
                    'name': 'RentCircle Cüzdan Bakiye Yükleme',
                    'category1': 'Cüzdan',
                    'itemType': 'VIRTUAL', 
                    'price': str(amount)
                }
            ]
        }

        checkout_form_initialize = iyzipay.CheckoutFormInitialize().create(request_data, options)
        result = checkout_form_initialize.read().decode('utf-8')
        
        return Response(result, status=status.HTTP_200_OK)

@api_view(['POST'])
@permission_classes([AllowAny])
def deposit_callback(request):
    token = request.data.get('token')
    if not token:
        return HttpResponseRedirect("http://localhost:5173/wallet?status=fail")

    options = get_iyzico_options()
    request_iyzico = {'locale': 'tr', 'token': token}
    
    checkout_form = iyzipay.CheckoutForm().retrieve(request_iyzico, options)
    result = checkout_form.read().decode('utf-8')
    import json
    result_json = json.loads(result)

    if result_json.get('paymentStatus') == 'SUCCESS':
        conversation_id = result_json.get('conversationId') 
        paid_price = Decimal(result_json.get('paidPrice'))
        
        try:
            user_id = conversation_id.split('_')[1]
            wallet = Wallet.objects.get(user__id=user_id)

            with transaction.atomic():
                wallet.balance += paid_price
                wallet.save()

                WalletTransaction.objects.create(
                    wallet=wallet,
                    transaction_type='DEPOSIT',
                    amount=paid_price,
                    description="Kredi Kartı ile Bakiye Yükleme"
                )
            
            return HttpResponseRedirect("http://localhost:5173/wallet?status=success")
        except Exception as e:
            print("Cüzdan güncellenirken hata:", str(e))
            return HttpResponseRedirect("http://localhost:5173/wallet?status=fail")
            
    return HttpResponseRedirect("http://localhost:5173/wallet?status=fail")


# ==========================================
# 🛡️ GÜVENLİK ZIRHI: 2FA KURULUMU VE QR KOD ÜRETİMİ
# ==========================================
class Setup2FAView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            user = request.user
            
            # 1. Cihazı bul veya oluştur
            device = TOTPDevice.objects.filter(user=user, name='default').first()
            if not device:
                device = TOTPDevice.objects.create(user=user, name='default', confirmed=False)
            
            # 2. 🎯 SİHİRLİ DOKUNUŞ: config_url yerine URL'i kendi ellerimizle oluşturuyoruz (Hata riskini sıfırlar)
            issuer = "RentCircle"
            account_name = user.email if user.email else user.username
            secret_key = base64.b32encode(device.bin_key).decode('utf-8')
            
            # Bu link tam olarak Authenticator'ın okuduğu dildir
            url = f"otpauth://totp/{issuer}:{account_name}?secret={secret_key}&issuer={issuer}"
            
            # 3. QR Kodu PNG'ye çevir
            qr = qrcode.make(url)
            stream = BytesIO()
            qr.save(stream, format='PNG')
            qr_base64 = base64.b64encode(stream.getvalue()).decode('utf-8')
            
            # 4. Frontend'e fırlat
            return Response({
                "message": "QR kod başarıyla üretildi.",
                "qr_code": f"data:image/png;base64,{qr_base64}",
                "secret_key": secret_key
            }, status=status.HTTP_200_OK)

        except Exception as e:
            # 🚨 EĞER BURASI ÇÖKERSE TERMİNALDE BİZE NEDENİNİ BAĞIRACAK!
            print(f"❌ [2FA QR KOD HATASI]: {str(e)}")
            return Response({"error": f"QR Kod üretilirken sunucu hatası: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


# ==========================================
# 🛡️ GÜVENLİK ZIRHI: 2FA 6 HANELİ KOD DOĞRULAMA
# ==========================================
class Verify2FAView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user
        code = request.data.get('code')

        if not code:
            return Response({"error": "Lütfen 6 haneli doğrulama kodunu girin."}, status=status.HTTP_400_BAD_REQUEST)

        # Kullanıcının cihazını bul
        device = TOTPDevice.objects.filter(user=user, name='default').first()
        if not device:
            return Response({"error": "2FA kurulumu başlatılmamış."}, status=status.HTTP_400_BAD_REQUEST)

        # Gelen 6 haneli kod doğru mu? (Zaman bazlı kontrol)
        if device.verify_token(code):
            # Doğruysa cihazı onaylanmış olarak işaretle
            device.confirmed = True
            device.save()
            
            # Kullanıcı modelindeki alanı True yap
            user.is_2fa_enabled = True
            user.save()
            
            return Response({"message": "İki Aşamalı Doğrulama (2FA) başarıyla aktifleştirildi!"}, status=status.HTTP_200_OK)
        else:
            return Response({"error": "Geçersiz veya süresi dolmuş kod! Lütfen güncel kodu girin."}, status=status.HTTP_400_BAD_REQUEST)


class CustomTokenObtainPairView(TokenObtainPairView):
    # 🎯 SİHİRLİ DOKUNUŞ: Artık standart JWT'yi değil, kendi zırhlı sınıfımızı kullanıyoruz
    serializer_class = CustomTokenObtainPairSerializer
    
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'login_attempts'


# ==========================================
# 🛡️ GÜVENLİK ZIRHI: 2FA DEVRE DIŞI BIRAKMA (İPTAL)
# ==========================================
class Disable2FAView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user
        code = request.data.get('code')

        if not code:
            return Response({"error": "Lütfen 6 haneli doğrulama kodunu girin."}, status=status.HTTP_400_BAD_REQUEST)

        # Kullanıcının cihazını bul
        device = TOTPDevice.objects.filter(user=user, name='default').first()
        if not device:
            return Response({"error": "Sisteminizde aktif bir 2FA bulunamadı."}, status=status.HTTP_400_BAD_REQUEST)

        # Şifre (Kod) doğruysa cihazı SİL ve korumayı kapat
        if device.verify_token(code):
            device.delete() # Veritabanından cihazı tamamen uçur
            
            user.is_2fa_enabled = False
            user.save()
            
            return Response({"message": "İki Aşamalı Doğrulama (2FA) başarıyla devre dışı bırakıldı."}, status=status.HTTP_200_OK)
        else:
            return Response({"error": "Geçersiz veya süresi dolmuş kod! İptal işlemi reddedildi."}, status=status.HTTP_400_BAD_REQUEST)