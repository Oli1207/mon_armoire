import { Fragment, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { adminAPI } from '../../utils/api';
import usePaginated, { useDebounced } from '../../utils/usePaginated';
import Pager from '../../components/Pager';
import ListStatus from '../../components/ListStatus';
import { useAdminUi } from './ui/AdminUi';
import { ORDER_STATUS_LABELS, PageHeader, StatusBadge, errorText, fcfa, shortDate } from './ui/parts';

const STATUSES = ['pending', 'paid', 'processing', 'shipped', 'delivered', 'cancelled'];

// Mêmes règles que le serveur : une commande non payée ne peut qu'être payée ou annulée ; une annulée est figée.
function allowedStatuses(current) {
  if (current === 'cancelled') return ['cancelled'];
  if (current === 'pending') return ['pending', 'paid', 'cancelled'];
  return STATUSES.filter((s) => s !== 'pending');
}

const isAlertNote = (h) => h.note?.startsWith('ATTENTION') || h.note?.startsWith('Stock insuffisant');

export default function AdminOrdersScreen() {
  const { notify, confirm } = useAdminUi();
  const [searchParams] = useSearchParams();
  const [filter, setFilter] = useState(STATUSES.includes(searchParams.get('status')) ? searchParams.get('status') : '');
  const [search, setSearch] = useState('');
  const [updating, setUpdating] = useState('');
  const [expanded, setExpanded] = useState('');
  const debounced = useDebounced(search.trim());

  const params = {};
  if (filter) params.status = filter;
  if (debounced) params.search = debounced;
  const { items: orders, count, loading, error, page, pageSize, setPage, reload } = usePaginated(adminAPI.orders, params);

  const changeStatus = async (order, status) => {
    if (status === 'cancelled') {
      const accepted = await confirm({
        title: `Annuler la commande ${order.order_number} ?`,
        message: 'La carte cadeau et les points utilisés seront rendus à la cliente. Cette action est définitive.',
        confirmLabel: 'Annuler la commande', danger: true,
      });
      if (!accepted) return;
    }
    setUpdating(order.order_number);
    try {
      await adminAPI.updateOrderStatus(order.order_number, status);
      notify(`Commande ${order.order_number} : ${ORDER_STATUS_LABELS[status].toLowerCase()}.`);
      reload();
    } catch (err) {
      notify(errorText(err, 'Impossible de modifier le statut.'), 'error');
    } finally {
      setUpdating('');
    }
  };

  return (
    <div>
      <PageHeader title="Commandes" lead={`${count} commande${count > 1 ? 's' : ''}${filter ? ` — ${ORDER_STATUS_LABELS[filter].toLowerCase()}` : ''}. Une commande payée est à préparer, puis à expédier.`} />

      <div className="admin-toolbar">
        <input
          type="search" className="form-control admin-search" placeholder="Chercher par numéro, e-mail ou nom"
          aria-label="Chercher une commande" value={search} onChange={(e) => setSearch(e.target.value)}
        />
        <div className="admin-chips">
          <button type="button" className={`btn btn-sm ${!filter ? 'btn-primary' : 'btn-outline-primary'}`} onClick={() => setFilter('')}>Toutes</button>
          {STATUSES.map((s) => (
            <button key={s} type="button" className={`btn btn-sm ${filter === s ? 'btn-primary' : 'btn-outline-primary'}`} onClick={() => setFilter(s)}>
              {ORDER_STATUS_LABELS[s]}
            </button>
          ))}
        </div>
      </div>

      <ListStatus loading={loading} error={error} onRetry={reload} isEmpty={orders.length === 0} emptyText="Aucune commande ne correspond." />

      {orders.length > 0 && (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Commande</th><th>Cliente</th><th>Total</th><th>Statut</th><th>Changer</th><th aria-label="Détails" />
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <Fragment key={o.id}>
                  <tr>
                    <td><strong>{o.order_number}</strong><div className="cell-muted">{shortDate(o.created_at)}</div></td>
                    <td>{o.contact_email}</td>
                    <td>{fcfa(o.total)}</td>
                    <td><StatusBadge status={o.status} /></td>
                    <td>
                      <select
                        className="form-select form-select-sm" style={{ minWidth: '9.5rem' }}
                        aria-label={`Changer le statut de la commande ${o.order_number}`}
                        value={o.status} disabled={updating === o.order_number || o.status === 'cancelled'}
                        onChange={(e) => changeStatus(o, e.target.value)}
                      >
                        {allowedStatuses(o.status).map((s) => <option key={s} value={s}>{ORDER_STATUS_LABELS[s]}</option>)}
                      </select>
                    </td>
                    <td className="cell-actions">
                      <button type="button" className="admin-link" onClick={() => setExpanded(expanded === o.id ? '' : o.id)}>
                        {expanded === o.id ? 'Fermer' : 'Détails'}
                      </button>
                    </td>
                  </tr>
                  {expanded === o.id && (
                    <tr className="row-detail">
                      <td colSpan={6}>
                        {o.items.map((item) => (
                          <div key={item.id} className="d-flex align-items-center gap-3 py-2">
                            {item.product_image ? <img className="admin-thumb" src={item.product_image} alt="" loading="lazy" /> : <span className="admin-thumb admin-thumb-empty" />}
                            <div className="flex-grow-1">
                              <div className="d-flex justify-content-between gap-3">
                                <span>{item.product_name} × {item.quantity}</span>
                                <strong>{fcfa(item.subtotal)}</strong>
                              </div>
                              {item.engraving_text && <div className="text-gold">Gravure : « {item.engraving_text} »</div>}
                              {item.gift_wrap && <div className="cell-muted">Emballage cadeau{item.gift_message ? ` — « ${item.gift_message} »` : ''}</div>}
                            </div>
                          </div>
                        ))}
                        {Number(o.gift_card_amount) > 0 && <p className="mb-1 mt-2 text-gold">Carte cadeau utilisée : −{fcfa(o.gift_card_amount)}</p>}
                        {Number(o.loyalty_discount_amount) > 0 && <p className="mb-1 text-gold">Points de fidélité : {o.loyalty_points_used} pts (−{fcfa(o.loyalty_discount_amount)})</p>}
                        <p className="mb-1 mt-2 cell-muted">
                          {o.delivery_method === 'pickup' ? 'Retrait en boutique' : `Livraison${o.delivery_zone ? ` (${o.delivery_zone.name})` : ''} : ${fcfa(o.shipping_cost)}`}
                        </p>
                        {o.address && <p className="mb-0 cell-muted">À livrer à : {o.address.full_name} — {o.address.phone} — {o.address.city}, {o.address.street}</p>}
                        {o.status_history.some(isAlertNote) && (
                          <div className="alert alert-warning mt-3 mb-0">
                            {o.status_history.filter(isAlertNote).map((h) => <div key={h.created_at + h.note}>{h.note}</div>)}
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
