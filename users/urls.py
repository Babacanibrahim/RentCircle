from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView

# 🎯 DÜZELTME: CustomTokenObtainPairView'ı BURAYA ekledik, kendi asıl yerinden (views.py) çağırıyoruz!
from .views import (CustomTokenObtainPairView, RegisterView, ActivateAccountView, UserProfileView, LogoutViewSet, 
                    ChangePasswordView, ForgotPasswordRequestView, VerifyOTPView, ResetPasswordConfirmView,
                    WalletDetailView, RequestWithdrawalView, InitiateDepositView, deposit_callback,
                    Setup2FAView, Verify2FAView, Disable2FAView)

urlpatterns = [
    path('register/', RegisterView.as_view(), name='auth_register'),
    path('activate/<str:uidb64>/<str:token>/', ActivateAccountView.as_view(), name='activate_account'),
    
    # 🛡️ GÜVENLİK ZIRHI: Artık views.py içindeki gerçek ve 2FA korumalı Login çalışacak!
    path('login/', CustomTokenObtainPairView.as_view(), name='auth_login'),
    
    path('refresh/', TokenRefreshView.as_view(), name='auth_refresh'),
    path('logout/', LogoutViewSet.as_view(), name='auth_logout'),
    
    path('me/', UserProfileView.as_view(), name='auth_me'),
    
    path('change-password/', ChangePasswordView.as_view(), name='change_password'),

    path('forgot-password/', ForgotPasswordRequestView.as_view(), name='forgot_password'),
    path('verify-otp/', VerifyOTPView.as_view(), name='verify_otp'),
    path('reset-password/', ResetPasswordConfirmView.as_view(), name='reset_password_confirm'),

    path('wallet/', WalletDetailView.as_view(), name='wallet_detail'),
    path('wallet/withdraw/', RequestWithdrawalView.as_view(), name='wallet_withdraw'),
    path('wallet/deposit/initiate/', InitiateDepositView.as_view(), name='wallet_deposit_initiate'),
    path('wallet/deposit/callback/', deposit_callback, name='wallet_deposit_callback'),

    path('2fa/setup/', Setup2FAView.as_view(), name='2fa_setup'),
    path('2fa/verify/', Verify2FAView.as_view(), name='2fa_verify'),
    path('2fa/disable/', Disable2FAView.as_view(), name='2fa_disable'),
]