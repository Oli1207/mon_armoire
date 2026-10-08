import { useState } from 'react';
import { ordersAPI } from '../../utils/api';
import { errorText } from '../../utils/errors';

const STATUS_LABELS = {
  pending: 'En attente de paiement',
  paid: 'Payée',
  processing: 'En préparation',
  shipped: 'Expédiée',
  delivered: 'Livrée',
  cancelled: 'Annulée',
};

export default function TrackOrderScreen() {
  const [orderNumber, setOrderNumber] = useState('');
  const [email, setEmail] = useState('');
  const [order, setOrder] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setOrder(null);
    setLoading(true);
    try {
      const { data } = await ordersAPI.track(orderNumber.trim(), email.trim());
      setOrder(data);
    } catch (err) {
      setError(errorText(err, 'Commande introuvable. Vérifiez le numéro et l’e-mail saisis.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="py-5 text-center" style={{ backgroundColor: 'var(--ma-cream)' }}>
        <p className="text-uppercase text-gold small tracking-wide mb-2">Où en est ma commande ?</p>
        <h1 className="h1 mb-0">Suivre ma commande</h1>
      </div>

      <div className="container py-5" style={{ maxWidth: 620 }}>
        <div className="card p-4 shadow-sm mb-4">
          <form onSubmit={handleSubmit}>
            <div className="mb-3">
              <label className="form-label small text-uppercase tracking-wide">Numéro de commande</label>
              <input autoComplete="off" autoCapitalize="characters" spellCheck={false}
                className="form-control"
                placeholder="MA-XXXXXXXXXXXX"
                value={orderNumber}
                onChange={(e) => setOrderNumber(e.target.value)}
                required
              />
            </div>
            <div className="mb-3">
              <label className="form-label small text-uppercase tracking-wide">Email</label>
              <input autoComplete="email" inputMode="email" type="email" className="form-control" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <button className="btn btn-primary text-uppercase small tracking-wide" disabled={loading}>
              {loading ? 'Recherche...' : 'Suivre ma commande'}
            </button>
          </form>
        </div>

        {error && <div className="alert alert-danger">{error}</div>}

        {order && (
          <div className="card p-4 shadow-sm">
            <h2 className="h5">Commande {order.order_number}</h2>
            <p className="text-muted mb-3">Statut actuel : {STATUS_LABELS[order.status] || order.status}</p>

            {order.items.map((item) => (
              <div className="d-flex align-items-center gap-3 border-bottom py-2" key={item.id}>
                {item.product_image ? (
                  <img src={item.product_image} alt="" style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 4, flexShrink: 0 }} />
                ) : (
                  <div className="bg-white" style={{ width: 56, height: 56, borderRadius: 4, flexShrink: 0 }} />
                )}
                <div className="flex-grow-1 d-flex justify-content-between">
                  <span>{item.product_name} × {item.quantity}</span>
                  <span className="text-gold fw-semibold">{Number(item.subtotal).toLocaleString('fr-FR')} FCFA</span>
                </div>
              </div>
            ))}

            <h6 className="text-uppercase small tracking-wide text-gold mt-4 mb-2">Historique</h6>
            <ul className="list-unstyled">
              {order.status_history.map((h, i) => (
                <li key={i} className="border-bottom py-2">
                  <strong>{STATUS_LABELS[h.status] || h.status}</strong> — {new Date(h.created_at).toLocaleString('fr-FR')}
                  {h.note && <div className="text-muted small">{h.note}</div>}
                </li>
              ))}
            </ul>

            <div className="mt-3 d-flex justify-content-between align-items-center pt-3" style={{ borderTop: '2px solid var(--ma-brown)' }}>
              <h6 className="mb-0 font-display">Total</h6>
              <h6 className="mb-0 font-display text-gold">{Number(order.total).toLocaleString('fr-FR')} FCFA</h6>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
