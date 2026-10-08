from django.contrib import admin

from .models import Category, Collection, LookbookEntry, Product, ProductImage, ProductVariant, SymbolGuideEntry, WaitlistEntry


class ProductImageInline(admin.TabularInline):
    model = ProductImage
    extra = 1


class ProductVariantInline(admin.TabularInline):
    model = ProductVariant
    extra = 1


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display        = ('name', 'parent', 'order')
    prepopulated_fields = {'slug': ('name',)}
    search_fields       = ('name',)


@admin.register(Collection)
class CollectionAdmin(admin.ModelAdmin):
    list_display        = ('name', 'kind', 'order')
    list_filter          = ('kind',)
    prepopulated_fields = {'slug': ('name',)}


@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    inlines              = [ProductImageInline, ProductVariantInline]
    list_display         = ('name', 'category', 'is_active', 'is_new', 'created_at')
    list_filter           = ('is_active', 'is_new', 'category')
    search_fields         = ('name', 'description')
    prepopulated_fields   = {'slug': ('name',)}
    filter_horizontal     = ('collections',)


@admin.register(ProductVariant)
class ProductVariantAdmin(admin.ModelAdmin):
    list_display  = ('product', 'label', 'sku', 'price', 'stock', 'is_default', 'allow_preorder')
    list_filter   = ('is_default', 'allow_preorder')
    search_fields = ('sku', 'product__name')


@admin.register(WaitlistEntry)
class WaitlistEntryAdmin(admin.ModelAdmin):
    list_display  = ('variant', 'email', 'notified', 'created_at')
    list_filter   = ('notified',)
    search_fields = ('email', 'variant__product__name')


@admin.register(SymbolGuideEntry)
class SymbolGuideEntryAdmin(admin.ModelAdmin):
    list_display        = ('name', 'category', 'order', 'is_active')
    list_filter          = ('is_active',)
    prepopulated_fields = {'slug': ('name',)}


@admin.register(LookbookEntry)
class LookbookEntryAdmin(admin.ModelAdmin):
    list_display     = ('title', 'order', 'is_active', 'created_at')
    list_filter       = ('is_active',)
    filter_horizontal = ('products',)
