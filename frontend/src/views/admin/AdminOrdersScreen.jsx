import { Fragment, useState } from 'react';
import { adminAPI } from '../../utils/api';
import usePaginated, { useDebounced } from '../../utils/usePaginated';
import Pager from '../../components/Pager';
import ListStatus from '../../components/ListStatus';

const STATUSES = ['pending', 'paid', 'processing', 'shipped', 'delivered', 'cancelled'];
const STATUS_LABELS = {
  pending: 'En attente', paid: 'Payée', processing: 'En préparation',
  shipped: 'Expédiée', delivered: 'Livrée', cancelled: 'Annulée',
};

// Mêmes règles que le serveur : une commande non payée ne peut qu'être payée ou annulée ; une annulée est figée.
function allowedStatuses(current) {
  if (current === 'cancelled') return ['cancelled'];
  if (current === 'pending') return ['pending', 'paid', 'cancelled'];
  return STATUSES.filter((s) => s !== 'pending');
}

export default function AdminOrdersScreen() {
  const [filter, setFilter] = useState('');
  const [search, setSearch] = useState('');
  const [updating, setUpdating] = useState('');
  const [expanded, setExpanded] = useState('');
  const [actionError, setActionError] = useState('');
  const debounced = useDebounced(search.trim());

  const params = {};
  if (filter) params.status = filter;
  if (debounced) params.search = debounced;
  const { items: orders, count, loading, error, page, pageSize, setPage, reload } = usePaginated(adminAPI.orders, params);

  const handleStatusChange = async (orderNumber, status) => {
    if (status === 'cancelled' && !window.confirm(`Annuler la commande ${orderNumber} ? Cette action est définitive.`)) return;
    setActionError('');
    setUpdating(orderNumber);
    try {
      await adminAPI.updateOrderStatus(orderNumber, status);
      reload();
    } catch (err) {
      setActionError(err.response?.data?.error || 'Impossible de modifier le statut. Veuillez réessayer.');
    } finally {
      setUpdating('');
    }
  };

  return (
    <div>
      <h1 className="h4 mb-3">Commandes ({count})</h1>

      <input
        type="search"
        className="form-control mb-3"
        style={{ maxWidth: '24rem' }}
        placeholder="Chercher par numéro, e-mail ou nom"
        aria-label="Chercher une commande"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      <div className="mb-3 d-flex gap-2 flex-wrap">
        <button className={`btn btn-sm ${!filter ? 'btn-primary' : 'btn-outline-primary'}`} onClick={() => setFilter('')}>
          Toutes
        </button>
        {STATUSES.map((s) => (
          <button
            key={s}
            className={`btn btn-sm ${filter === s ? 'btn-primary' : 'btn-outline-primary'}`}
            onClick={() => setFilter(s)}
          >
            {STATUS_LABELS[s]}
          </button>
        ))}
      </div>

      {actionError && <div className="alert alert-danger" role="alert">{actionError}</div>}
      <ListStatus loading={loading} error={error} onRetry={reload} isEmpty={orders.length === 0} emptyText="Aucune commande trouvée." />

      {orders.length > 0 && (
        <div className="table-responsive">
          <table className="table table-sm align-middle bg-white">
            <thead>
              <tr>
                <th>Numéro</th>
                <th>Client</th>
                <th>Total</th>
                <th>Statut</th>
                <th>Date</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <Fragment key={o.id}>
                  <tr>
                    <td>{o.order_number}</td>
                    <td>{o.contact_email}</td>
                    <td>{Number(o.total).toLocaleString('fr-FR')} FCFA</td>
                    <td>
                      <select
                        className="form-select form-select-sm"
                        aria-label={`Statut de la commande ${o.order_number}`}
                        value={o.status}
                        disabled={updating === o.order_number || o.status === 'cancelled'}
                        onChange={(e) => handleStatusChange(o.order_number, e.target.value)}
                      >
                        {allowedStatuses(o.status).map((s) => (
                          <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                        ))}
                      </select>
                    </td>
                    <td className="text-muted small">{new Date(o.created_at).toLocaleDateString('fr-FR')}</td>
                    <td>
                      <button className="btn btn-sm btn-link" onClick={() => setExpanded(expanded === o.id ? '' : o.id)}>
                        {expanded === o.id ? 'Fermer' : 'Détails'}
                      </button>
                    </td>
                  </tr>
                  {expanded === o.id && (
                    <tr>
                      <td colSpan={6} className="bg-light">
                        {o.items.map((item) => (
                          <div key={item.id} className="d-flex align-items-center gap-2 small py-1">
                            {item.product_image ? (
                              <img src={item.product_image} alt="" width="40" height="40" loading="lazy" style={{ objectFit: 'cover', borderRadius: 4, flexShrink: 0 }} />
                            ) : (
                              <div className="bg-white border" style={{ width: 40, height: 40, borderRadius: 4, flexShrink: 0 }} />
                            )}
                            <div className="flex-grow-1">
                              <div className="d-flex justify-content-between">
                                <span>{item.product_name} × {item.quantity}</span>
                                <span>{Number(item.subtotal).toLocaleString('fr-FR')} FCFA</span>
                              </div>
                              {item.engraving_text && <div className="text-gold">Gravure : « {item.engraving_text} »</div>}
                              {item.gift_wrap && <div className="text-muted">Emballage cadeau</div>}
                            </div>
                          </div>
                        ))}
                        {Number(o.gift_card_amount) > 0 && (
                          <p className="small text-gold mb-0 mt-2">
                            Carte cadeau utilisée : −{Number(o.gift_card_amount).toLocaleString('fr-FR')} FCFA
                          </p>
                        )}
                        {Number(o.loyalty_discount_amount) > 0 && (
                          <p className="small text-gold mb-0 mt-1">
                            Points de fidélité utilisés : {o.loyalty_points_used} pts (−{Number(o.loyalty_discount_amount).toLocaleString('fr-FR')} FCFA)
                          </p>
                        )}
                        {o.address && (
                          <p className="small text-muted mb-0 mt-2">
                            Livraison : {o.address.full_name}, {o.address.city}, {o.address.street}
                          </p>
                        )}
                        {o.status_history.some((h) => h.note?.startsWith('ATTENTION') || h.note?.startsWith('Stock insuffisant')) && (
                          <div className="alert alert-warning small mt-2 mb-0 py-2">
                            {o.status_history.filter((h) => h.note?.startsWith('ATTENTION') || h.note?.startsWith('Stock insuffisant')).map((h) => (
                              <div key={h.created_at + h.note}>{h.note}</div>
                            ))}
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Pager page={page} count={count} pageSize={pageSize} onChange={setPage} />
    </div>
  );
}
