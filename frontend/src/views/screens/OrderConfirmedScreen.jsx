import { useEffect, useState } from 'react';
import { useParams, useLocation, Link } from 'react-router-dom';
import { ordersAPI, paymentsAPI } from '../../utils/api';
import useAuthStore from '../../store/auth';
import { errorText } from '../../utils/errors';

const STATUS_LABELS = {
  pending: 'En attente de paiement', paid: 'Payée', processing: 'En préparation',
  shipped: 'Expédiée', delivered: 'Livrée', cancelled: 'Annulée',
};

export default function OrderConfirmedScreen() {
  const { orderNumber } = useParams();
  const location = useLocation();
  const { isAuthenticated } = useAuthStore();
  const [order, setOrder] = useState(location.state?.order || null);
  const [payingWith, setPayingWith] = useState('');
  const [payError, setPayError] = useState('');

  useEffect(() => {
    if (!order && isAuthenticated) {
      ordersAPI.detail(orderNumber).then(({ data }) => setOrder(data)).catch(() => {});
    }
  }, [order, isAuthenticated, orderNumber]);

  const handlePay = async (provider) => {
    setPayError('');
    setPayingWith(provider);
    try {
      const { data } = await paymentsAPI.initiate(order.order_number, provider);
      window.location.href = data.checkout_url || data.authorization_url;
    } catch (err) {
      setPayError(errorText(err, 'Le paiement n’a pas pu démarrer. Aucun montant n’a été débité ; réessayez.'));
      setPayingWith('');
    }
  };

  if (!order) {
    return (
      <div className="container py-5 text-center" style={{ maxWidth: 600 }}>
        <div aria-busy="true" aria-label="Chargement"><div className="skeleton-row" /><div className="skeleton-row" /></div>
        <p className="text-muted small">
          Si rien ne s'affiche, utilisez la page <Link to="/suivi" className="text-gold">Suivre ma commande</Link> avec le numéro {orderNumber}.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="py-5 text-center" style={{ backgroundColor: 'var(--ma-cream)' }}>
        <p className="text-uppercase text-gold small tracking-wide mb-2">Merci pour votre confiance</p>
        <h1 className="h1 mb-0">Commande confirmée !</h1>
      </div>

      <div className="container py-5" style={{ maxWidth: 620 }}>
        <div className="card p-4 shadow-sm">
          <h2 className="h4 mb-1">{order.order_number}</h2>
          <p className="text-muted mb-4">Statut : {STATUS_LABELS[order.status] || order.status}</p>

          {order.items.map((item) => (
            <div className="d-flex align-items-center gap-3 border-bottom py-2" key={item.id}>
              {item.product_image ? (
                <img src={item.product_image} alt="" style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 4, flexShrink: 0 }} />
              ) : (
                <div className="bg-white" style={{ width: 56, height: 56, borderRadius: 4, flexShrink: 0 }} />
              )}
              <div className="flex-grow-1">
                <div className="d-flex justify-content-between">
                  <span>
                    {item.product_name} × {item.quantity}
                  </span>
                  <span>{Number(item.subtotal).toLocaleString('fr-FR')} FCFA</span>
                </div>
                {item.engraving_text && (
                  <div className="small text-gold">Gravure : « {item.engraving_text} »</div>
                )}
              </div>
            </div>
          ))}

          {order.gift_card_amount > 0 && (
            <div className="d-flex justify-content-between py-2 text-gold small">
              <span>Carte cadeau</span>
              <span>−{Number(order.gift_card_amount).toLocaleString('fr-FR')} FCFA</span>
            </div>
          )}
          {order.loyalty_discount_amount > 0 && (
            <div className="d-flex justify-content-between py-2 text-gold small">
              <span>Points de fidélité ({order.loyalty_points_used} pts)</span>
              <span>−{Number(order.loyalty_discount_amount).toLocaleString('fr-FR')} FCFA</span>
            </div>
          )}

          <div className="d-flex justify-content-between align-items-center mt-3 pt-3" style={{ borderTop: '2px solid var(--ma-brown)' }}>
            <h5 className="mb-0 font-display">Total</h5>
            <h5 className="mb-0 font-display text-gold">{Number(order.total).toLocaleString('fr-FR')} FCFA</h5>
          </div>

          {order.status === 'pending' && (
            <div className="mt-4 p-3 verse-banner">
              <p className="fw-semibold text-uppercase small tracking-wide text-gold mb-2">Choisissez votre mode de paiement</p>
              {payError && <div className="alert alert-danger">{payError}</div>}
              <div className="d-flex gap-2 flex-wrap">
                <button className="btn btn-primary text-uppercase small tracking-wide" disabled={!!payingWith} onClick={() => handlePay('geniuspay')}>
                  {payingWith === 'geniuspay' ? 'Redirection...' : 'Mobile Money (GeniusPay)'}
                </button>
                <button className="btn btn-outline-primary text-uppercase small tracking-wide" disabled={!!payingWith} onClick={() => handlePay('paystack')}>
                  {payingWith === 'paystack' ? 'Redirection...' : 'Carte bancaire (Paystack)'}
                </button>
              </div>
            </div>
          )}
        </div>

        <p className="text-muted small mt-3">
          Conservez le numéro <strong>{order.order_number}</strong> — il vous permet de suivre votre commande sur la page{' '}
          <Link to="/suivi" className="text-gold">Suivre ma commande</Link>.
        </p>

        <Link to="/catalogue" className="btn btn-primary mt-3 text-uppercase small tracking-wide">
          Continuer mes achats
        </Link>
      </div>
    </div>
  );
}
