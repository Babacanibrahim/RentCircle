from rest_framework import serializers
from .models import Category, Item, Booking, ItemImage, Conversation, Message, BookingImage, Review, Notification
from django.contrib.auth import get_user_model
from django.db.models import Max, Avg
from django.utils import timezone

User = get_user_model()


class NotificationSerializer(serializers.ModelSerializer):
    sender_name = serializers.CharField(source='sender.first_name', read_only=True)
    sender_avatar = serializers.CharField(source='sender.username', read_only=True) # Avatar harfi için
    
    class Meta:
        model = Notification
        fields = '__all__'


class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = ['id', 'name', 'slug']


class ItemImageSerializer(serializers.ModelSerializer):
    class Meta:
        model = ItemImage
        fields = ['id', 'image', 'is_main']


class ReviewSerializer(serializers.ModelSerializer):
    reviewer_username = serializers.CharField(source='reviewer.username', read_only=True)
    reviewer_show_name = serializers.ReadOnlyField(source='reviewer.show_name')
    reviewer_first_name = serializers.ReadOnlyField(source='reviewer.first_name')
    reviewer_last_name = serializers.ReadOnlyField(source='reviewer.last_name')
    
    # Frontend'deki minyatür ürün kartı için gereken ekstra veriler
    item_title = serializers.CharField(source='item.title', read_only=True)
    item_image = serializers.SerializerMethodField()
    
    class Meta:
        model = Review
        # DÜZELTİLDİ: 'reviewer_last_name' ve 'owner' arasına virgül eklendi
        fields = [
            'id', 'booking', 'item', 'item_title', 'item_image', 
            'reviewer', 'reviewer_username', 'reviewer_show_name', 
            'reviewer_first_name', 'reviewer_last_name', 'owner', 
            'rating', 'comment', 'created_at'
        ]
        read_only_fields = ['reviewer', 'owner', 'item']

    def get_item_image(self, obj):
        first_image = obj.item.images.first()
        if first_image and first_image.image:
            request = self.context.get('request')
            if request and hasattr(request, 'build_absolute_uri'):
                return request.build_absolute_uri(first_image.image.url)
            return first_image.image.url
        return None

    def validate(self, data):
        booking = data['booking']
        if booking.status != 'completed':
            raise serializers.ValidationError("Sadece tamamlanmış kiralamalar için değerlendirme yapabilirsiniz.")
        return data


class ItemSerializer(serializers.ModelSerializer):
    category_detail = CategorySerializer(source='category', read_only=True)
    owner_name = serializers.ReadOnlyField(source='owner.get_full_name')
    images = ItemImageSerializer(many=True, read_only=True)
    
    owner_username = serializers.ReadOnlyField(source='owner.username')
    owner_show_name = serializers.ReadOnlyField(source='owner.show_name')
    owner_first_name = serializers.ReadOnlyField(source='owner.first_name')
    owner_last_name = serializers.ReadOnlyField(source='owner.last_name')

    reviews = ReviewSerializer(source='review_set', many=True, read_only=True)
    
    is_favorite = serializers.SerializerMethodField()
    next_available_date = serializers.SerializerMethodField()
    is_currently_rented = serializers.SerializerMethodField()
    owner_rating = serializers.SerializerMethodField()
    owner_review_count = serializers.SerializerMethodField()
    
    # 🎯 YENİ EKLENEN KISIM: Dolu Tarihleri Frontend'e Gönderiyoruz
    booked_dates = serializers.SerializerMethodField()

    class Meta:
        model = Item
        # 🎯 DİKKAT: 'booked_dates' alanını fields listesine ekledik!
        fields = [
            'id', 'owner', 'owner_name', 'category', 'category_detail', 
            'title', 'description', 'price_per_day', 
            'city', 'district', 'region',
            'full_address', 'latitude', 'longitude', 
            'is_available', 'images', 'created_at', 'updated_at',
            'is_favorite', 'next_available_date', 'is_currently_rented',
            'reviews', 'owner_show_name', 'owner_first_name', 'owner_last_name', 
            'owner_username', 'owner_rating', 'owner_review_count',
            'booked_dates' 
        ]
        read_only_fields = ['owner']
   
    def get_owner_rating(self, obj):
        avg = obj.owner.reviews_received.aggregate(Avg('rating'))['rating__avg']
        return round(avg, 1) if avg else 0.0

    def get_owner_review_count(self, obj):
        return obj.owner.reviews_received.count()

    def validate_price_per_day(self, value):
        if value <= 0:
            raise serializers.ValidationError("Günlük kiralama bedeli sıfırdan büyük olmalıdır.")
        return value

    def get_is_favorite(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            return obj.favorites.filter(id=request.user.id).exists()
        return False

    def get_is_currently_rented(self, obj):
        return not obj.is_available

    def get_next_available_date(self, obj):
        last_booking = obj.bookings.filter(status='active').aggregate(Max('end_date'))
        end_date = last_booking['end_date__max']
        
        if end_date:
            today = timezone.now().date()
            if end_date < today:
                return today
            return end_date
        return None

    # 🎯 YENİ EKLENEN KISIM: Hangi günler kiralıysa o günleri liste olarak dön
    def get_booked_dates(self, obj):
        # 'approved' (Onaylanmış ama başlamamış) ve 'active' (Şu an kullanan) kiralamalar
        active_bookings = obj.bookings.filter(status__in=['approved', 'active'])
        return [
            {
                "start": str(booking.start_date),
                "end": str(booking.end_date)
            }
            for booking in active_bookings
        ]


class StoreDetailSerializer(serializers.ModelSerializer):
    active_listings = serializers.SerializerMethodField()
    rented_listings = serializers.SerializerMethodField()
    rating = serializers.SerializerMethodField()
    review_count = serializers.SerializerMethodField()
    reviews = ReviewSerializer(source='reviews_received', many=True, read_only=True)

    class Meta:
        model = User
        # DÜZELTİLDİ: 'show_name' alanı frontend'in ismini gizlemesi için eklendi
        fields = [
            'id', 'username', 'show_name', 'first_name', 'last_name', 
            'rating', 'review_count', 'reviews', 'active_listings', 'rented_listings'
        ]

    def get_rating(self, obj):
        avg = obj.reviews_received.aggregate(Avg('rating'))['rating__avg']
        return round(avg, 1) if avg else 0.0

    def get_review_count(self, obj):
        return obj.reviews_received.count()

    def get_active_listings(self, obj):
        items = Item.objects.filter(owner=obj).exclude(bookings__status__in=['approved', 'active'])
        return ItemSerializer(items, many=True, context=self.context).data

    def get_rented_listings(self, obj):
        items = Item.objects.filter(owner=obj, bookings__status__in=['approved', 'active']).distinct()
        return ItemSerializer(items, many=True, context=self.context).data


class BookingImageSerializer(serializers.ModelSerializer):
    class Meta:
        model = BookingImage
        fields = ['id', 'image', 'image_type']


class BookingSerializer(serializers.ModelSerializer):
    item_detail = ItemSerializer(source='item', read_only=True)
    renter_name = serializers.ReadOnlyField(source='renter.get_full_name')
    handover_images = serializers.SerializerMethodField()
    return_images = serializers.SerializerMethodField()
    has_review = serializers.SerializerMethodField()
    
    # 🎯 YENİ: İptal edeni frontend'e "Ahmet Yılmaz" gibi şık bir formatta gönderiyoruz
    cancelled_by_name = serializers.CharField(source='cancelled_by.first_name', read_only=True)

    class Meta:
        model = Booking
        fields = [
            'id', 'item', 'item_detail', 'renter', 'renter_name', 
            'start_date', 'end_date', 'status', 'total_price', 'deposit_price', 
            'handover_pin', 'return_pin', 'handover_images', 'return_images', 
            'dispute_reason', 'has_review', 'cancelled_by_name', 'created_at' # cancelled_by_name eklendi
        ]
        read_only_fields = ['renter', 'total_price', 'deposit_price', 'status', 'handover_pin', 'return_pin', 'handover_images', 'return_images']

    def get_has_review(self, obj):
        return hasattr(obj, 'review')

    def get_handover_images(self, obj):
        images = obj.images.filter(image_type='handover')
        request = self.context.get('request')
        return BookingImageSerializer(images, many=True, context={'request': request}).data

    def get_return_images(self, obj):
        images = obj.images.filter(image_type='return')
        request = self.context.get('request')
        return BookingImageSerializer(images, many=True, context={'request': request}).data

    def validate(self, data):
        if data['start_date'] > data['end_date']:
            raise serializers.ValidationError("Bitiş tarihi başlangıç tarihinden önce olamaz.")
        overlapping_bookings = Booking.objects.filter(
            item=data['item'],
            status__in=['approved', 'active'],
            start_date__lte=data['end_date'],
            end_date__gte=data['start_date']
        )
        if overlapping_bookings.exists():
            raise serializers.ValidationError("Bu ürün seçtiğiniz tarih aralığında halihazırda kiralıktır.")
        return data


class MessageSerializer(serializers.ModelSerializer):
    sender_name = serializers.CharField(source='sender.first_name', read_only=True)
    
    class Meta:
        model = Message
        fields = [
            'id', 'conversation', 'sender', 'sender_name', 'content', 'is_read', 'created_at',
            'is_offer', 'offer_price', 'offer_start_date', 'offer_end_date', 'offer_status',
            'is_location_share', 'location_lat', 'location_lon', 'location_address'
        ]
        read_only_fields = ['sender', 'is_read', 'created_at']


class ConversationSerializer(serializers.ModelSerializer):
    item_title = serializers.CharField(source='item.title', read_only=True)
    item_price = serializers.DecimalField(source='item.price_per_day', max_digits=10, decimal_places=2, read_only=True)
    item_image = serializers.SerializerMethodField() 
    renter_name = serializers.CharField(source='renter.first_name', read_only=True)
    owner_name = serializers.CharField(source='owner.first_name', read_only=True)
    last_message = serializers.SerializerMethodField()
    unread_count = serializers.SerializerMethodField()

    class Meta:
        model = Conversation
        fields = ['id', 'item', 'renter', 'owner', 'item_title', 
                'item_image', 'item_price', 'renter_name', 'owner_name', 
                'last_message', 'created_at', 'updated_at', 'unread_count']

    def get_unread_count(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            return obj.messages.filter(is_read=False).exclude(sender=request.user).count()
        return 0

    def get_item_image(self, obj):
        try:
            main_image = obj.item.images.filter(is_main=True).first()
            if not main_image:
                main_image = obj.item.images.first()
                
            if main_image and main_image.image:
                request = self.context.get('request')
                if request and hasattr(request, 'build_absolute_uri'):
                    return request.build_absolute_uri(main_image.image.url)
                return main_image.image.url
        except Exception:
            return None
        return None

    def get_last_message(self, obj):
        try:
            last_msg = obj.messages.last()
            if last_msg:
                return {
                    "content": last_msg.content,
                    "created_at": last_msg.created_at.isoformat() if last_msg.created_at else None,
                    "is_read": last_msg.is_read,
                    "sender": str(last_msg.sender.id)
                }
        except Exception:
            return None
        return None