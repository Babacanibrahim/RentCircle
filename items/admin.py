from django.contrib import admin
from unfold.admin import ModelAdmin, TabularInline
from django.utils.safestring import mark_safe
from .models import Category, Item, Booking, ItemImage, Conversation, Message, Review

@admin.register(Booking)
class BookingAdmin(ModelAdmin):
    list_display = ('id', 'item', 'renter', 'status', 'start_date', 'end_date', 'total_price')
    list_filter = ('status', 'start_date')
    search_fields = ('item__title', 'renter__username', 'renter__email', 'id')
    
    readonly_fields = ('handover_pin', 'return_pin', 'handover_photo_preview', 'return_photo_preview', 'created_at', 'updated_at')
    
    fieldsets = (
        ('Genel Bilgiler', {
            'fields': ('item', 'renter', 'start_date', 'end_date', 'status')
        }),
        ('Finansal Bilgiler', {
            'fields': ('total_price', 'deposit_price')
        }),
        ('Güvenlik ve Kanıt Protokolü', {
            'fields': (
                'handover_pin', 'handover_photo_preview', 
                'return_pin', 'return_photo_preview', 
                'dispute_reason'
            ),
            'description': 'Kullanıcıların teslimat ve iade sırasında yüklediği güvenlik kanıtları.'
        }),
    )

    def handover_photo_preview(self, obj):
        images = obj.images.filter(image_type='handover')
        if images.exists():
            html = '<div style="display: flex; gap: 10px; flex-wrap: wrap;">'
            for img in images:
                html += f'<img src="{img.image.url}" style="max-height: 120px; border-radius: 8px; border: 1px solid #e2e8f0;" />'
            html += '</div>'
            return mark_safe(html) # 🎯 DÜZELTİLDİ
        return "Fotoğraf Yüklenmemiş"
    handover_photo_preview.short_description = 'Teslimat Anı Kanıtları (Max 3)'

    def return_photo_preview(self, obj):
        images = obj.images.filter(image_type='return')
        if images.exists():
            html = '<div style="display: flex; gap: 10px; flex-wrap: wrap;">'
            for img in images:
                html += f'<img src="{img.image.url}" style="max-height: 120px; border-radius: 8px; border: 1px solid #e2e8f0;" />'
            html += '</div>'
            return mark_safe(html) # 🎯 DÜZELTİLDİ
        return "Fotoğraf Yüklenmemiş"
    return_photo_preview.short_description = 'İade Anı Kanıtları (Max 3)'


class ItemImageInline(TabularInline):
    model = ItemImage
    extra = 1

@admin.register(Item)
class ItemAdmin(ModelAdmin):
    list_display = ('title', 'owner', 'category', 'price_per_day', 'is_available')
    list_filter = ('is_available', 'category')
    search_fields = ('title', 'owner__email')
    inlines = [ItemImageInline]

@admin.register(Category)
class CategoryAdmin(ModelAdmin):
    pass

@admin.register(Conversation)
class ConversationAdmin(ModelAdmin):
    pass

@admin.register(Message)
class MessageAdmin(ModelAdmin):
    pass

@admin.register(Review)
class ReviewAdmin(ModelAdmin):
    list_display = ('item', 'reviewer', 'owner', 'rating', 'created_at')
    list_filter = ('rating', 'created_at')
    search_fields = ('item__title', 'reviewer__first_name', 'comment')