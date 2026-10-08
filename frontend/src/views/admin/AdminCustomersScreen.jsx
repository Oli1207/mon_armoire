import { useState } from 'react';
import { Link } from 'react-router-dom';
import { adminAPI } from '../../utils/api';
import usePaginated, { useDebounced } from '../../utils/usePaginated';
import Pager from '../../components/Pager';
import ListStatus from '../../components/ListStatus';

export default function AdminCustomersScreen() {
  const [search, setSearch] = useState('');
  const debounced = useDebounced(search.trim());
  const { items: customers, count, loading, error, page, pageSize, setPage, reload } = usePaginated(
    adminAPI.customers, debounced ? { search: debounced } : {},
  );

  return (
    <div>
      <h1 className="h4 mb-3">Clients ({count})</h1>

      <input
        type="search"
        className="form-control mb-3"
        style={{ maxWidth: '24rem' }}
        placeholder="Chercher par nom, e-mail ou téléphone"
        aria-label="Chercher un client"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      <ListStatus loading={loading} error={error} onRetry={reload} isEmpty={customers.length === 0} emptyText="Aucun client trouvé." />

      {customers.length > 0 && (
        <div className="table-responsive">
          <table className="table table-sm align-middle bg-white">
            <thead>
              <tr>
                <th>Client</th>
                <th>Commandes</th>
                <th>Total dépensé</th>
                <th>Panier actuel</th>
                <th>Favoris</th>
                <th>Inscrit le</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {customers.map((c) => (
                <tr key={c.id}>
                  <td>
                    <div>{c.full_name || '—'}</div>
                    <div className="text-muted small">{c.email}</div>
                  </td>
                  <td>{c.orders_count}</td>
                  <td>{Number(c.total_spent).toLocaleString('fr-FR')} FCFA</td>
                  <td>
                    {c.cart_items_count > 0
                      ? `${c.cart_items_count} article(s) — ${Number(c.cart_total).toLocaleString('fr-FR')} FCFA`
                      : '—'}
                  </td>
                  <td>{c.favorites_count}</td>
                  <td className="text-muted small">{new Date(c.date_joined).toLocaleDateString('fr-FR')}</td>
                  <td>
                    <Link className="btn btn-sm btn-link" to={`/admin/clients/${c.id}`}>Voir</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Pager page={page} count={count} pageSize={pageSize} onChange={setPage} />
    </div>
  );
}
