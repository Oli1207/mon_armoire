import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { adminAPI } from '../../utils/api';

const STATUS_LABELS = {
  pending: 'En attente', paid: 'Payée', processing: 'En préparation',
  shipped: 'Expédiée', delivered: 'Livrée', cancelled: 'Annulée',
};

export default function AdminCustomerDetailScreen() {
  const { id } = useParams();
  const [customer, setCustomer] = useState(null);

  useEffect(() => {
    adminAPI.customerDetail(id).then(({ data }) => setCustomer(data));
  }, [id]);

  if (!customer) return <p>Chargement...</p>;

  return (
    <div>
      <Link to="/admin/clients" className="d-block mb-3">← Retour aux clients</Link>
      <h1 className="h4">{customer.full_name || customer.email}</h1>
      <p className="text-muted">{customer.email} — {customer.phone}</p>

      <div className="row g-4 mt-2">
        <div className="col-md-6">
          <h6>Adresses</h6>
          {customer.addresses.length === 0 && <p className="text-muted small">Aucune adresse enregistrée.</p>}
          {customer.addresses.map((a) => (
            <div key={a.id} className="small border-bottom py-1">
              {a.full_name} — {a.city}, {a.street} {a.is_default && <span className="badge badge-brand">Défaut</span>}
            </div>
          ))}
        </div>

        <div className="col-md-6">
          <h6>Panier actuel</h6>
          {customer.cart_items.length === 0 && <p className="text-muted small">Panier vide.</p>}
          {customer.cart_items.map((item) => (
            <div key={item.id} className="d-flex align-items-center gap-2 small border-bottom py-1">
              {item.product_image ? (
                <img src={item.product_image} alt="" width="36" height="36" loading="lazy" style={{ objectFit: 'cover', borderRadius: 4, flexShrink: 0 }} />
              ) : (
                <div className="bg-white border" style={{ width: 36, height: 36, borderRadius: 4, flexShrink: 0 }} />
              )}
              <span className="flex-grow-1">
                {item.product_name || `Coffret personnalisé — ${item.coffret_configuration?.coffret?.name}`} × {item.quantity}
                {item.gift_wrap && ' (emballage cadeau)'}
              </span>
              <span>{Number(item.subtotal).toLocaleString('fr-FR')} FCFA</span>
            </div>
          ))}
        </div>

        <div className="col-md-6">
          <h6>Favoris ({customer.favorites.length})</h6>
          {customer.favorites.length === 0 && <p className="text-muted small">Aucun favori.</p>}
          {customer.favorites.map((f) => (
            <div key={f.id} className="d-flex align-items-center gap-2 small border-bottom py-1">
              {f.product.main_image ? (
                <img src={f.product.main_image} alt="" style={{ width: 36, height: 36, objectFit: 'cover', borderRadius: 4, flexShrink: 0 }} />
              ) : (
                <div className="bg-white border" style={{ width: 36, height: 36, borderRadius: 4, flexShrink: 0 }} />
              )}
              <span>{f.product.name} — {f.product.price ? `${Number(f.product.price).toLocaleString('fr-FR')} FCFA` : '—'}</span>
            </div>
          ))}
        </div>

        <div className="col-12">
          <h6>Commandes ({customer.orders_total ?? customer.orders.length}){customer.orders_total > customer.orders.length && ` — les ${customer.orders.length} dernières`}</h6>
          {customer.orders.length === 0 && <p className="text-muted small">Aucune commande.</p>}
          {customer.orders.map((o) => (
            <div key={o.id} className="border-bottom py-2">
              <div className="d-flex justify-content-between">
                <strong>{o.order_number}</strong>
                <span>{Number(o.total).toLocaleString('fr-FR')} FCFA — {STATUS_LABELS[o.status] || o.status}</span>
              </div>
              <div className="text-muted small mb-1">{new Date(o.created_at).toLocaleDateString('fr-FR')}</div>
              <div className="d-flex flex-wrap gap-2">
                {o.items.map((item) => (
                  item.product_image ? (
                    <img key={item.id} src={item.product_image} alt="" title={item.product_name} style={{ width: 32, height: 32, objectFit: 'cover', borderRadius: 4 }} />
                  ) : (
                    <div key={item.id} className="bg-white border" style={{ width: 32, height: 32, borderRadius: 4 }} />
                  )
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
