from django.contrib import admin

from .models import Verse, VerseOverride, PushSubscription


@admin.register(Verse)
class VerseAdmin(admin.ModelAdmin):
    list_display  = ('reference', 'is_active', 'created_at')
    list_filter   = ('is_active',)
    list_editable = ('is_active',)


@admin.register(VerseOverride)
class VerseOverrideAdmin(admin.ModelAdmin):
    list_display  = ('date', 'reference')
    ordering      = ('date',)
    search_fields = ('reference', 'text')


@admin.register(PushSubscription)
class PushSubscriptionAdmin(admin.ModelAdmin):
    list_display  = ('user', 'endpoint', 'created_at')
    search_fields = ('user__email', 'endpoint')
