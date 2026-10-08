import { useCallback, useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { adminAPI } from '../../utils/api';
import ListStatus from '../../components/ListStatus';
import { PageHeader, StatusBadge, errorText, fcfa, shortDate } from './ui/parts';

function Thumb({ src }) {
  return src ? <img className="admin-thumb" src={src} alt="" loading="lazy" /> : <span className="admin-thumb admin-thumb-empty" />;
}

export default function AdminCustomerDetailScreen() {
  const { id } = useParams();
  const [customer, setCustomer] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    setError('');
    adminAPI.customerDetail(id).then(({ data }) => setCustomer(data)).catch((err) => setError(errorText(err, 'Cliente introuvable.')));
  }, [id]);
  useEffect(() => { load(); }, [load]);

  if (!customer) {
    return (
      <div>
        <PageHeader title="Cliente" />
        <ListStatus loading={!error} error={error} onRetry={load} isEmpty rows={3} />
      </div>
    );
  }

  return (
    <div>
      <Link to="/admin/clients" className="admin-link mb-2">← Retour aux clients</Link>
      <PageHeader kicker="Cliente" title={customer.full_name || customer.email} lead={[customer.email, customer.phone].filter(Boolean).join(' — ')} />

      <div className="row g-3">
        <div className="col-lg-6">
          <section className="admin-card h-100">
            <h2 className="admin-card-title">Adresses</h2>
            {customer.addresses.length === 0 && <p className="admin-help">Aucune adresse enregistrée.</p>}
            {customer.addresses.map((a) => (
              <div className="admin-row-line" key={a.id}>
                <span>{a.full_name} — {a.city}, {a.street}</span>
                {a.is_default && <span className="status-badge status-on">Par défaut</span>}
              </div>
            ))}
          </section>
        </div>

        <div className="col-lg-6">
          <section className="admin-card h-100">
            <h2 className="admin-card-title">Panier actuel</h2>
            {customer.cart_items.length === 0 && <p className="admin-help">Panier vide.</p>}
            {customer.cart_items.map((item) => (
              <div className="admin-row-line align-items-center" key={item.id}>
                <span className="d-flex align-items-center gap-3">
                  <Thumb src={item.product_image} />
                  <span>
                    {item.product_name || `Coffret personnalisé — ${item.coffret_configuration?.coffret?.name}`} × {item.quantity}
                    {item.gift_wrap && <span className="cell-muted"> (emballage cadeau)</span>}
                  </span>
                </span>
                <strong>{fcfa(item.subtotal)}</strong>
              </div>
            ))}
          </section>
        </div>

        <div className="col-lg-6">
          <section className="admin-card h-100">
            <h2 className="admin-card-title">Favoris ({customer.favorites.length})</h2>
            {customer.favorites.length === 0 && <p className="admin-help">Aucun favori.</p>}
            {customer.favorites.map((f) => (
              <div className="admin-row-line align-items-center" key={f.id}>
                <span className="d-flex align-items-center gap-3"><Thumb src={f.product.main_image} />{f.product.name}</span>
                <span className="cell-muted">{f.product.price ? fcfa(f.product.price) : '—'}</span>
              </div>
            ))}
          </section>
        </div>

        <div className="col-12">
          <section className="admin-card">
            <h2 className="admin-card-title">
              Commandes ({customer.orders_total ?? customer.orders.length})
              {customer.orders_total > customer.orders.length && ` — les ${customer.orders.length} dernières`}
            </h2>
            {customer.orders.length === 0 && <p className="admin-help">Aucune commande.</p>}
            {customer.orders.map((o) => (
              <div className="admin-row-line flex-wrap align-items-center" key={o.id}>
                <span>
                  <strong>{o.order_number}</strong> <span className="cell-muted">— {shortDate(o.created_at)}</span>
                  <span className="d-flex flex-wrap gap-2 mt-2">
                    {o.items.map((item) => <span key={item.id} title={item.product_name}><Thumb src={item.product_image} /></span>)}
                  </span>
                </span>
                <span className="d-flex align-items-center gap-3"><StatusBadge status={o.status} /><strong>{fcfa(o.total)}</strong></span>
              </div>
            ))}
          </section>
        </div>
      </div>
    </div>
  );
}
