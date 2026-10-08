from django.conf import settings
from django.core.mail import send_mail


def send_restock_notification(entry):
    variant = entry.variant
    lines = [
        f"Bonne nouvelle{', ' + entry.name if entry.name else ''} !",
        "",
        f"« {variant.product.name} » ({variant.label}) est de nouveau disponible sur Mon Armoire.",
        "",
        "Ne tardez pas, les stocks sont parfois limités.",
    ]
    send_mail(
        subject=f"De retour en stock : {variant.product.name} — Mon Armoire",
        message="\n".join(lines),
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[entry.email],
        fail_silently=False,  # l'appelant décide de réessayer plus tard en cas d'échec
    )
