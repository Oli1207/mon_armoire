import { useState } from 'react';
import { adminAPI } from '../../utils/api';
import usePaginated, { useDebounced } from '../../utils/usePaginated';
import Pager from '../../components/Pager';
import ListStatus from '../../components/ListStatus';
import { PageHeader, StatusBadge, shortDate } from './ui/parts';

export default function AdminWaitlistScreen() {
  const [search, setSearch] = useState('');
  const debounced = useDebounced(search.trim());
  const { items: entries, count, loading, error, page, pageSize, setPage, reload } = usePaginated(
    adminAPI.waitlist, debounced ? { search: debounced } : {},
  );

  return (
    <div>
      <PageHeader
        title="Liste d'attente"
        lead={`${count} inscription${count > 1 ? 's' : ''}. Quand un bijou revient en stock, les personnes en attente sont prévenues automatiquement par e-mail (dans la demi-heure).`}
      />

      <div className="admin-toolbar">
        <input
          type="search" className="form-control admin-search" placeholder="Chercher par e-mail ou produit"
          aria-label="Chercher dans la liste d'attente" value={search} onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <ListStatus loading={loading} error={error} onRetry={reload} isEmpty={entries.length === 0} emptyText="Personne n'est en attente." />

      {entries.length > 0 && (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr><th>Produit</th><th>Variante</th><th>E-mail</th><th>Nom</th><th>Inscrite le</th><th>Prévenue</th></tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id}>
                  <td><strong>{e.product_name}</strong></td>
                  <td className="cell-muted">{e.variant_label}</td>
                  <td>{e.email}</td>
                  <td>{e.name || '—'}</td>
                  <td className="cell-muted">{shortDate(e.created_at)}</td>
                  <td><StatusBadge status={e.notified ? 'on' : 'pending'} label={e.notified ? 'Oui' : 'Pas encore'} /></td>
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
