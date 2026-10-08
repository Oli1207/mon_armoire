from django.contrib import admin

from .models import User, Address, Favorite


@admin.register(User)
class UserAdmin(admin.ModelAdmin):
    list_display    = ('email', 'full_name', 'phone', 'is_staff', 'is_active', 'date_joined')
    list_filter     = ('is_staff', 'is_active')
    search_fields   = ('email', 'full_name', 'phone')
    ordering        = ('-date_joined',)
    readonly_fields = ('password', 'date_joined', 'last_login')


@admin.register(Address)
class AddressAdmin(admin.ModelAdmin):
    list_display  = ('full_name', 'user', 'city', 'is_default', 'created_at')
    list_filter   = ('is_default', 'city')
    search_fields = ('full_name', 'phone', 'city', 'user__email')


@admin.register(Favorite)
class FavoriteAdmin(admin.ModelAdmin):
    list_display  = ('user', 'product', 'created_at')
    search_fields = ('user__email', 'product__name')
