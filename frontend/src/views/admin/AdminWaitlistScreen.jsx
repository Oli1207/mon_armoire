import { useState } from 'react';
import { adminAPI } from '../../utils/api';
import usePaginated, { useDebounced } from '../../utils/usePaginated';
import Pager from '../../components/Pager';
import ListStatus from '../../components/ListStatus';

export default function AdminWaitlistScreen() {
  const [search, setSearch] = useState('');
  const debounced = useDebounced(search.trim());
  const { items: entries, count, loading, error, page, pageSize, setPage, reload } = usePaginated(
    adminAPI.waitlist, debounced ? { search: debounced } : {},
  );

  return (
    <div>
      <h1 className="h4 mb-3">Liste d'attente ({count})</h1>

      <input
        type="search"
        className="form-control mb-3"
        style={{ maxWidth: '24rem' }}
        placeholder="Chercher par e-mail ou produit"
        aria-label="Chercher dans la liste d'attente"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      <ListStatus loading={loading} error={error} onRetry={reload} isEmpty={entries.length === 0} emptyText="Personne n'est en attente." />

      {entries.length > 0 && (
        <div className="table-responsive">
          <table className="table table-sm align-middle bg-white">
            <thead>
              <tr>
                <th>Produit</th>
                <th>Variante</th>
                <th>Email</th>
                <th>Nom</th>
                <th>Inscrit(e) le</th>
                <th>Notifié(e)</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id}>
                  <td className="small">{e.product_name}</td>
                  <td className="small text-muted">{e.variant_label}</td>
                  <td className="small">{e.email}</td>
                  <td className="small">{e.name || '—'}</td>
                  <td className="small">{new Date(e.created_at).toLocaleDateString('fr-FR')}</td>
                  <td className="small">{e.notified ? 'Oui' : 'Non'}</td>
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
