from django.conf import settings
from django.core.mail import send_mail

STATUS_LABELS = {
    'pending':    'en attente de paiement',
    'paid':       'payée',
    'processing': 'en préparation',
    'shipped':    'expédiée',
    'delivered':  'livrée',
    'cancelled':  'annulée',
}


def send_order_confirmation_email(order, account_setup_url=None):
    recipient = order.contact_email
    if not recipient:
        return

    lines = [
        f"Merci pour votre commande {order.order_number} chez Mon Armoire !",
        "",
        "Récapitulatif :",
    ]
    for item in order.items.all():
        lines.append(f"- {item.product_name} x{item.quantity} — {item.subtotal} FCFA")
    lines.append("")
    lines.append(f"Sous-total : {order.subtotal} FCFA")
    if order.shipping_cost:
        lines.append(f"Livraison : {order.shipping_cost} FCFA")
    lines.append(f"Total : {order.total} FCFA")
    lines.append("")

    if order.delivery_method == 'pickup':
        lines.append("Mode de récupération : retrait en boutique.")
    elif order.address:
        lines.append(f"Livraison à : {order.address.full_name}, {order.address.city}, {order.address.street}")

    if account_setup_url:
        lines += [
            "",
            "Un compte Mon Armoire a été créé pour vous afin de suivre vos commandes.",
            "Choisissez votre mot de passe en cliquant sur ce lien (valable 1 heure) :",
            account_setup_url,
            "Après 1 heure, utilisez « Mot de passe oublié » sur la page de connexion.",
        ]

    lines += [
        "",
        f"Vous pouvez suivre votre commande à tout moment avec le numéro {order.order_number} et votre email.",
    ]

    send_mail(
        subject=f"Confirmation de votre commande {order.order_number} — Mon Armoire",
        message="\n".join(lines),
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[recipient],
        fail_silently=True,
    )


def send_order_status_email(order, note=''):
    recipient = order.contact_email
    if not recipient:
        return

    label = STATUS_LABELS.get(order.status, order.status)
    message = (
        f"Votre commande {order.order_number} est maintenant {label}.\n\n"
        + (f"{note}\n\n" if note else "")
        + f"Suivez votre commande à tout moment sur monarmoire.com avec le numéro {order.order_number}."
    )
    send_mail(
        subject=f"Commande {order.order_number} — mise à jour",
        message=message,
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[recipient],
        fail_silently=True,
    )


def send_giftcard_email(gift_card):
    recipient = gift_card.recipient_email or gift_card.purchaser_email
    if not recipient:
        return

    to_someone = bool(gift_card.recipient_email and gift_card.recipient_name)
    lines = (
        [f"{gift_card.purchaser_name or 'Quelqu’un'} vous offre une carte cadeau Mon Armoire !", ""]
        if to_someone else
        ["Merci pour votre achat ! Voici votre carte cadeau Mon Armoire.", ""]
    )
    if gift_card.message:
        lines += [f"« {gift_card.message} »", ""]
    lines += [
        f"Code : {gift_card.code}",
        f"Valeur : {gift_card.initial_value} FCFA",
        "",
        "À utiliser en une ou plusieurs fois au moment du paiement, sur monarmoire.com.",
    ]

    send_mail(
        subject="Votre carte cadeau Mon Armoire",
        message="\n".join(lines),
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[recipient],
        fail_silently=True,
    )
