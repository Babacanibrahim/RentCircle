from django.urls import path
from . import consumers

websocket_urlpatterns = [
    path('ws/chat/<str:conversation_id>/', consumers.ChatConsumer.as_asgi()),

    path('ws/notifications/<str:user_id>/', consumers.NotificationConsumer.as_asgi()),

    path('ws/admin-feed/', consumers.AdminLiveConsumer.as_asgi()),
]