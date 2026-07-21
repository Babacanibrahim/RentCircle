# users/views.py
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
from rest_framework.permissions import AllowAny
from django.http import HttpResponseRedirect
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.generics import RetrieveUpdateAPIView
from rest_framework.decorators import api_view, permission_classes
from rest_framework_simplejwt.tokens import RefreshToken
import iyzipay
import uuid
from django.shortcuts import redirect
from django.contrib.auth import get_user_model

from .serializers import RegisterSerializer, UserProfileSerializer, ChangePasswordSerializer, WalletSerializer
from .models import CustomUser, PasswordResetOTP, Wallet, WalletTransaction, WithdrawalRequest

class ForgotPasswordRequestView(APIView):
    permission_classes = []

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
                        <!DOCTYPE html>
                        <html>
                        <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #0f172a; color: #f8fafc;">
                            <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
                                <div style="background-color: #1e293b; border-radius: 16px; padding: 40px; border: 1px solid #334155; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
                                    <div style="text-align: center; margin-bottom: 30px;">
                                        <span style="font-size: 28px; font-weight: 900; letter-spacing: 2px; color: #f8fafc; font-family: monospace;">
                                            RENT<span style="color: #3b82f6;">CIRCLE</span>
                                        </span>
                                    </div>
                                    <p style="font-size: 16px; color: #cbd5e1; line-height: 1.6;">Merhaba <strong>{user.first_name}</strong>,</p>
                                    <p style="font-size: 16px; color: #cbd5e1; line-height: 1.6;">
                                        Hesabınız için bir şifre sıfırlama talebi aldık. İşleme devam etmek için doğrulama kodunuz aşağıdadır:
                                    </p>
                                    <div style="text-align: center; margin: 30px 0; background-color: #0f172a; padding: 20px; border-radius: 12px; border: 1px dashed #475569;">
                                        <span style="font-size: 32px; font-weight: 900; letter-spacing: 10px; color: #3b82f6; font-family: monospace;">
                                            {otp_obj.otp}
                                        </span>
                                    </div>
                                    <p style="font-size: 14px; color: #ef4444; text-align: center; font-weight: bold;">
                                        ⚠️ Bu kod güvenliğiniz için sadece 3 dakika geçerlidir.
                                    </p>
                                    <p style="font-size: 13px; color: #94a3b8; line-height: 1.5; border-top: 1px solid #334155; padding-top: 20px; margin-top: 30px;">
                                        Bu talebi siz yapmadıysanız lütfen bu e-postayı görmezden gelin. Şifreniz siz kodu onaylayana kadar değiştirilmeyecektir.
                                    </p>
                                </div>
                            </div>
                        </body>
                        </html>
                        """
            plain_message = strip_tags(html_message)

            send_mail(
                subject=subject,
                message=plain_message,
                from_email='RentCircle <noreply@rentcircle.com>',
                recipient_list=[user.email],
                html_message=html_message
            )

        return Response({"message": "Eğer bilgileriniz sistemimizle eşleşiyorsa, şifre sıfırlama kodu kayıtlı e-posta adresinize gönderildi."}, status=status.HTTP_200_OK)


class VerifyOTPView(APIView):
    permission_classes = []

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
    permission_classes = []

    def post(self, request):
        identifier = request.data.get('identifier', '').strip().lstrip('@')
        otp = request.data.get('otp')
        new_password = request.data.get('new_password')
        confirm_password = request.data.get('confirm_password')

        if new_password != confirm_password:
            return Response({"error": "Yeni şifreler birbiriyle uyuşmuyor."}, status=status.HTTP_400_BAD_REQUEST)

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


class RegisterView(APIView):
    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        if serializer.is_valid():
            user = serializer.save() 
            
            uid = urlsafe_base64_encode(force_bytes(user.pk))
            token = default_token_generator.make_token(user)
            activation_link = f"http://localhost:8000/api/auth/activate/{uid}/{token}/"
            
            subject = "RentCircle - Aramıza Hoş Geldin! Hesabını Aktifleştir"
            html_message = f"""
                        <!DOCTYPE html>
                        <html>
                        <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #0f172a; color: #f8fafc;">
                            <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
                                <div style="background-color: #1e293b; border-radius: 16px; padding: 40px; border: 1px solid #334155; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
                                    <div style="text-align: center; margin-bottom: 30px;">
                                        <span style="font-size: 28px; font-weight: 900; letter-spacing: 2px; color: #f8fafc; font-family: monospace;">
                                            RENT<span style="color: #3b82f6;">CIRCLE</span>
                                        </span>
                                    </div>
                                    <p style="font-size: 16px; color: #cbd5e1; line-height: 1.6;">Merhaba <strong>{user.first_name}</strong>,</p>
                                    <p style="font-size: 16px; color: #cbd5e1; line-height: 1.6;">
                                        Güvenli Pazar Yeri ekosistemine hoş geldin! Hesabını aktifleştirip ilanları incelemeye veya kendi ürünlerini kiralamaya başlamak için tek bir adımın kaldı.
                                    </p>
                                    <div style="text-align: center; margin: 40px 0;">
                                        <a href="{activation_link}" style="background: linear-gradient(to right, #3b82f6, #6366f1); color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block; font-size: 16px;">
                                            Hesabımı Aktifleştir
                                        </a>
                                    </div>
                                    <p style="font-size: 13px; color: #94a3b8; line-height: 1.5; border-top: 1px solid #334155; padding-top: 20px;">
                                        Eğer buton çalışmıyorsa aşağıdaki bağlantıyı tarayıcınıza kopyalayabilirsiniz:<br>
                                        <a href="{activation_link}" style="color: #3b82f6; word-break: break-all;">{activation_link}</a>
                                    </p>
                                </div>
                                <div style="text-align: center; margin-top: 20px; font-size: 12px; color: #64748b;">
                                    <p>Bu hesabı siz oluşturmadıysanız, e-postayı güvenle silebilirsiniz.</p>
                                    <p>&copy; 2026 RentCircle. Tüm hakları saklıdır.</p>
                                </div>
                            </div>
                        </body>
                        </html>
                        """
            plain_message = strip_tags(html_message)

            send_mail(
                subject=subject,
                message=plain_message,
                from_email='RentCircle <noreply@rentcircle.com>',
                recipient_list=[user.email],
                html_message=html_message 
            )
            
            return Response({"message": "Kayıt başarılı! Lütfen e-posta adresinize gönderilen aktivasyon linkini onaylayın."}, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

User = get_user_model()

class ActivateAccountView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, uidb64, token):
        try:
            uid = force_str(urlsafe_base64_decode(uidb64))
            user = User.objects.get(pk=uid)
        except (TypeError, ValueError, OverflowError, User.DoesNotExist):
            user = None

        # Token doğruysa ve kullanıcı varsa
        if user is not None and default_token_generator.check_token(user, token):
            user.is_active = True
            user.save()
            
            # 🎯 BAŞARILI: Kullanıcıyı frontend login sayfasına yönlendir
            # URL sonuna '?activated=true' ekliyoruz ki frontend'de yakalayabilelim
            return redirect("http://localhost:5173/login?activated=true")
        else:
            # 🎯 BAŞARISIZ: Link geçersizse veya süresi dolmuşsa
            return redirect("http://localhost:5173/login?activated=false")


class LogoutViewSet(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        try:
            refresh_token = request.data.get("refresh_token")
            if not refresh_token:
                return Response({"error": "Refresh token gerekli."}, status=status.HTTP_400_BAD_REQUEST)
                
            token = RefreshToken(refresh_token)
            token.blacklist() 
            
            return Response({"message": "Güvenli çıkış yapıldı, token kara listeye alındı."}, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({"error": "Geçersiz token veya işlem zaten tamamlanmış."}, status=status.HTTP_400_BAD_REQUEST)
        

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
        
        # İşlemleri yeniden eskiye doğru sırala ve son 20 işlemi gönder
        data['transactions'] = sorted(data['transactions'], key=lambda x: x['created_at'], reverse=True)[:20]
        return Response(data, status=status.HTTP_200_OK)

# 2. IBAN'A PARA ÇEKME TALEBİ OLUŞTURMA
class RequestWithdrawalView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        wallet = request.user.wallet
        amount = request.data.get('amount')
        iban = request.data.get('iban')

        if not amount or not iban:
            return Response({"error": "Tutar ve IBAN zorunludur."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            amount = Decimal(str(amount))
            if amount <= 0:
                return Response({"error": "Geçerli bir tutar girin."}, status=status.HTTP_400_BAD_REQUEST)
        except ValueError:
            return Response({"error": "Geçersiz tutar formatı."}, status=status.HTTP_400_BAD_REQUEST)

        # Bakiye kontrolü
        if wallet.balance < amount:
            return Response({"error": "Yetersiz bakiye."}, status=status.HTTP_400_BAD_REQUEST)

        # İşlemi veritabanında güvene al (atomic)
        with transaction.atomic():
            # 1. Bakiyeyi düş
            wallet.balance -= amount
            wallet.save()

            # 2. İşlem geçmişine kaydet
            WalletTransaction.objects.create(
                wallet=wallet,
                transaction_type='WITHDRAWAL',
                amount=amount,
                description=f"IBAN'a para çekme talebi: {iban}"
            )

            # 3. Talebi admin onayına gönder
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

# 1. ÖDEME FORMUNU BAŞLATMA (Kullanıcı Tarafı)
class InitiateDepositView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        amount = request.data.get('amount')
        if not amount:
            return Response({"error": "Tutar belirtilmelidir."}, status=status.HTTP_400_BAD_REQUEST)

        user = request.user
        options = get_iyzico_options()

        # conversationId içine user.id'yi gizliyoruz ki Iyzico'dan dönerken kim olduğunu bilelim
        conversation_id = f"DEP_{user.id}_{uuid.uuid4().hex[:6]}"

        request_data = {
            'locale': 'tr',
            'conversationId': conversation_id,
            'price': str(amount),
            'paidPrice': str(amount),
            'currency': 'TRY',
            'basketId': f"BSK-{user.id}",
            'paymentGroup': 'PRODUCT',
            # Geri dönüş URL'si (React veya Django tarafındaki callback adresi)
            'callbackUrl': "http://localhost:8000/api/users/wallet/deposit/callback/",
            'enabledInstallments': ['2', '3', '6', '9'],
            'buyer': {
                'id': str(user.id),
                'name': user.first_name or 'İsimsiz',
                'surname': user.last_name or 'Kullanıcı',
                'gsmNumber': '+905555555555',
                'email': user.email,
                'identityNumber': '11111111111', # Standart ödemede TCKN doğrulanmaz, sabit kalabilir
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
                    'itemType': 'VIRTUAL', # Fiziksel bir ürün değil
                    'price': str(amount)
                }
            ]
        }

        checkout_form_initialize = iyzipay.CheckoutFormInitialize().create(request_data, options)
        result = checkout_form_initialize.read().decode('utf-8')
        
        return Response(result, status=status.HTTP_200_OK)

# 2. İYZİCO'DAN DÖNEN YANITI YAKALAMA (Webhook / Callback)
# İyzico buraya POST atacağı için dışarıdan erişime açık olmalı (AllowAny)
@api_view(['POST'])
@permission_classes([AllowAny])
def deposit_callback(request):
    token = request.data.get('token')
    if not token:
        return HttpResponseRedirect("http://localhost:5173/wallet?status=fail")

    options = get_iyzico_options()
    request_iyzico = {'locale': 'tr', 'token': token}
    
    # İşlem sonucunu İyzico'dan sorgula
    checkout_form = iyzipay.CheckoutForm().retrieve(request_iyzico, options)
    result = checkout_form.read().decode('utf-8')
    import json
    result_json = json.loads(result)

    # Ödeme başarılıysa
    if result_json.get('paymentStatus') == 'SUCCESS':
        conversation_id = result_json.get('conversationId') # Format: DEP_{user.id}_{uuid}
        paid_price = Decimal(result_json.get('paidPrice'))
        
        try:
            # Kullanıcı ID'sini parçalayarak bul
            user_id = conversation_id.split('_')[1]
            wallet = Wallet.objects.get(user__id=user_id)

            # Cüzdan işlemini güvene al
            with transaction.atomic():
                wallet.balance += paid_price
                wallet.save()

                WalletTransaction.objects.create(
                    wallet=wallet,
                    transaction_type='DEPOSIT',
                    amount=paid_price,
                    description="Kredi Kartı ile Bakiye Yükleme"
                )
            
            # Başarılı sayfasına (Frontend Cüzdan sayfasına) yönlendir
            return HttpResponseRedirect("http://localhost:5173/wallet?status=success")
        except Exception as e:
            print("Cüzdan güncellenirken hata:", str(e))
            return HttpResponseRedirect("http://localhost:5173/wallet?status=fail")
            
    # Ödeme başarısızsa
    return HttpResponseRedirect("http://localhost:5173/wallet?status=fail")
