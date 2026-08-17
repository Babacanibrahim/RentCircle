import json
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from django.core.cache import cache
from django.utils import timezone  # 🎯 YENİ: Zaman damgası için eklendi
from .models import Conversation, Message
from django.contrib.auth import get_user_model

User = get_user_model()

# 🎯 GÜNCELLENDİ: Son görülme zamanını da alıyoruz
@database_sync_to_async
def get_online_status(target_id):
    target_id_str = str(target_id).lower()
    is_online = cache.get(f"online_user_{target_id_str}", False)
    last_seen = cache.get(f"last_seen_{target_id_str}", None)
    return is_online, last_seen

# 🎯 GÜNCELLENDİ: Hem online durumunu hem de anlık zamanı 7 günlüğüne kaydediyoruz
@database_sync_to_async
def set_online_status(user_id):
    user_id_str = str(user_id).lower()
    cache.set(f"online_user_{user_id_str}", True, timeout=120)
    cache.set(f"last_seen_{user_id_str}", timezone.now().isoformat(), timeout=86400 * 7) # 7 Gün Hafızada kalır

class ChatConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.conversation_id = self.scope['url_route']['kwargs']['conversation_id']
        self.room_group_name = f'chat_{self.conversation_id}'

        await self.channel_layer.group_add(
            self.room_group_name,
            self.channel_name
        )
        await self.accept()

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(
            self.room_group_name,
            self.channel_name
        )

    async def receive(self, text_data):
        text_data_json = json.loads(text_data)
        msg_type = text_data_json.get('type')

        if msg_type == 'ping':
            await self.send(text_data=json.dumps({'type': 'pong'}))
            return

        # 🎯 GÜNCELLENDİ: Frontend'e last_seen verisini de yolluyoruz
        if msg_type == 'check_status':
            target_id = text_data_json.get('target_user_id')
            if target_id:
                is_online, last_seen = await get_online_status(target_id)
                await self.send(text_data=json.dumps({
                    'type': 'status_update',
                    'is_online': bool(is_online),
                    'last_seen': last_seen
                }))
            return
        
        # Senin modeline özel tüm alanları yakalıyoruz
        sender_id = text_data_json.get('sender_id')
        content = text_data_json.get('content', '')
        
        is_offer = text_data_json.get('is_offer', False)
        offer_price = text_data_json.get('offer_price', None)
        offer_start_date = text_data_json.get('offer_start_date', None)
        offer_end_date = text_data_json.get('offer_end_date', None)
        offer_status = text_data_json.get('offer_status', None)
        
        is_location_share = text_data_json.get('is_location_share', False)
        location_lat = text_data_json.get('location_lat', None)
        location_lon = text_data_json.get('location_lon', None)
        location_address = text_data_json.get('location_address', None)

        if sender_id and sender_id != 'Tester':
            # Veritabanına kaydet
            await self.save_message(
                sender_id, self.conversation_id, content,
                is_offer, offer_price, offer_start_date, offer_end_date, offer_status,
                is_location_share, location_lat, location_lon, location_address
            )

        # Mesajı WebSocket üzerinden React'e fırlat
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                'type': 'chat_message',
                'sender': sender_id,
                'content': content,
                'is_offer': is_offer,
                'offer_price': offer_price,
                'offer_start_date': offer_start_date,
                'offer_end_date': offer_end_date,
                'offer_status': offer_status,
                'is_location_share': is_location_share,
                'location_lat': location_lat,
                'location_lon': location_lon,
                'location_address': location_address
            }
        )

    async def chat_message(self, event):
        await self.send(text_data=json.dumps({
            'sender': event['sender'],
            'content': event['content'],
            'is_offer': event['is_offer'],
            'offer_price': event['offer_price'],
            'offer_start_date': event['offer_start_date'],
            'offer_end_date': event['offer_end_date'],
            'offer_status': event['offer_status'],
            'is_location_share': event['is_location_share'],
            'location_lat': event['location_lat'],
            'location_lon': event['location_lon'],
            'location_address': event['location_address']
        }))

    @database_sync_to_async
    def save_message(self, sender_id, conversation_id, content, 
                     is_offer, offer_price, offer_start_date, offer_end_date, offer_status,
                     is_location_share, location_lat, location_lon, location_address):
        try:
            user = User.objects.get(id=sender_id)
            conversation = Conversation.objects.get(id=conversation_id)
            
            message = Message.objects.create(
                conversation=conversation, 
                sender=user, 
                content=content,
                is_offer=is_offer,
                offer_price=offer_price,
                offer_start_date=offer_start_date,
                offer_end_date=offer_end_date,
                offer_status='pending' if is_offer else offer_status,
                is_location_share=is_location_share,
                location_lat=location_lat,
                location_lon=location_lon,
                location_address=location_address
            )
            
            conversation.updated_at = message.created_at
            conversation.save()
            
        except Exception as e:
            print(f"[HATA] Mesaj kaydedilemedi: {e}")

class NotificationConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.user_id = self.scope['url_route']['kwargs']['user_id']
        self.group_name = f"user_notifications_{self.user_id}"

        # Güvenli Cache Kaydı
        await set_online_status(self.user_id)

        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def receive(self, text_data):
        text_data_json = json.loads(text_data)
        
        if text_data_json.get('type') == 'ping':
            # Güvenli Cache Güncellemesi (Her pingde last_seen de yenilenir)
            await set_online_status(self.user_id)
            await self.send(text_data=json.dumps({'type': 'pong'}))

    async def send_notification(self, event):
        await self.send(text_data=json.dumps(event['data']))

class AdminLiveConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.group_name = 'admin_live_feed'

        await self.channel_layer.group_add(
            self.group_name,
            self.channel_name
        )
        await self.accept()

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(
            self.group_name,
            self.channel_name
        )

    async def receive(self, text_data):
        text_data_json = json.loads(text_data)
        if text_data_json.get('type') == 'ping':
            await self.send(text_data=json.dumps({'type': 'pong'}))

    async def send_admin_feed(self, event):
        await self.send(text_data=json.dumps(event['data']))