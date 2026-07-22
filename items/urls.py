from django.urls import path, include
from rest_framework.routers import DefaultRouter
# 🎯 DİKKAT: PayWithWalletView'i buraya import ettik!
from .views import CategoryViewSet, ItemViewSet, BookingViewSet, ConversationViewSet, ReviewViewSet, notification_list, notification_delete, PayWithWalletView, notification_clear_all

router = DefaultRouter()
router.register(r'categories', CategoryViewSet, basename='category')
router.register(r'listings', ItemViewSet, basename='item')
router.register(r'bookings', BookingViewSet, basename='booking')
router.register(r'conversations', ConversationViewSet, basename='conversation')
router.register(r'reviews', ReviewViewSet)

urlpatterns = [
    # Mağaza detay rotasını router'dan önceye alarak ezilmesini engelliyoruz
    path('stores/<uuid:store_id>/', ItemViewSet.as_view({'get': 'store_detail'}), name='store-detail'),
    
    # 🎯 YENİ EKLEDİĞİMİZ KISIM: Cüzdanla Ödeme Rotası (Burası UUID bekliyor ve Router'dan önce yazılmalı)
    path('listings/<uuid:item_id>/pay-with-wallet/', PayWithWalletView.as_view(), name='pay_with_wallet'),

    path('notifications/', notification_list, name='notifications'),
    path('notifications/<int:pk>/', notification_delete, name='notification_delete'),
    path('notifications/clear_all/', notification_clear_all),
    
    # Router her zaman en altta kalmalı
    path('', include(router.urls)),
]