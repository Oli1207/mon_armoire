import { useState } from 'react';
import { Link } from 'react-router-dom';
import { adminAPI } from '../../utils/api';
import usePaginated, { useDebounced } from '../../utils/usePaginated';
import Pager from '../../components/Pager';
import ListStatus from '../../components/ListStatus';
import { PageHeader, fcfa, shortDate } from './ui/parts';

export default function AdminCustomersScreen() {
  const [search, setSearch] = useState('');
  const debounced = useDebounced(search.trim());
  const { items: customers, count, loading, error, page, pageSize, setPage, reload } = usePaginated(
    adminAPI.customers, debounced ? { search: debounced } : {},
  );

  return (
    <div>
      <PageHeader title="Clients" lead={`${count} cliente${count > 1 ? 's' : ''} inscrite${count > 1 ? 's' : ''}. Cliquez sur « Voir » pour ses commandes, son panier et ses favoris.`} />

      <div className="admin-toolbar">
        <input
          type="search" className="form-control admin-search" placeholder="Chercher par nom, e-mail ou téléphone"
          aria-label="Chercher une cliente" value={search} onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <ListStatus loading={loading} error={error} onRetry={reload} isEmpty={customers.length === 0} emptyText="Aucune cliente trouvée." />

      {customers.length > 0 && (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr><th>Cliente</th><th>Commandes</th><th>Total dépensé</th><th>Panier actuel</th><th>Favoris</th><th>Inscrite le</th><th aria-label="Voir" /></tr>
            </thead>
            <tbody>
              {customers.map((c) => (
                <tr key={c.id}>
                  <td><strong>{c.full_name || '—'}</strong><div className="cell-muted">{c.email}</div></td>
                  <td>{c.orders_count}</td>
                  <td>{fcfa(c.total_spent)}</td>
                  <td>{c.cart_items_count > 0 ? `${c.cart_items_count} article(s) — ${fcfa(c.cart_total)}` : '—'}</td>
                  <td>{c.favorites_count}</td>
                  <td className="cell-muted">{shortDate(c.date_joined)}</td>
                  <td className="cell-actions"><Link className="admin-link" to={`/admin/clients/${c.id}`}>Voir</Link></td>
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
