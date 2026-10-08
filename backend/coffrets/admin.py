from django.contrib import admin

from .models import Coffret, CoffretItem, CoffretSlot, CoffretConfiguration, CoffretConfigurationItem


class CoffretSlotInline(admin.TabularInline):
    model = CoffretSlot
    extra = 1


class CoffretItemInline(admin.TabularInline):
    model = CoffretItem
    extra = 1


@admin.register(Coffret)
class CoffretAdmin(admin.ModelAdmin):
    inlines              = [CoffretItemInline, CoffretSlotInline]
    list_display         = ('name', 'box_price', 'show_contents', 'allow_customization', 'is_active', 'created_at')
    list_filter           = ('is_active', 'show_contents', 'allow_customization')
    prepopulated_fields   = {'slug': ('name',)}


class CoffretConfigurationItemInline(admin.TabularInline):
    model = CoffretConfigurationItem
    extra = 0


@admin.register(CoffretConfiguration)
class CoffretConfigurationAdmin(admin.ModelAdmin):
    inlines         = [CoffretConfigurationItemInline]
    list_display    = ('coffret', 'created_at')
    readonly_fields = ('created_at',)
