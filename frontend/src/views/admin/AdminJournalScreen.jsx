import { useState } from 'react';
import { adminAPI } from '../../utils/api';
import usePaginated, { useDebounced } from '../../utils/usePaginated';
import Pager from '../../components/Pager';
import ListStatus from '../../components/ListStatus';
import { PageHeader, StatusBadge } from './ui/parts';

const ACTIONS = {
  created: { label: 'Ajout', status: 'paid' },
  updated: { label: 'Modification', status: 'processing' },
  deleted: { label: 'Suppression', status: 'cancelled' },
  denied: { label: 'Refusé', status: 'cancelled' },
  login: { label: 'Connexion', status: 'delivered' },
};

const when = (iso) => new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

export default function AdminJournalScreen() {
  const [search, setSearch] = useState('');
  const [action, setAction] = useState('');
  const [days, setDays] = useState('');
  const debounced = useDebounced(search.trim());
  const params = {};
  if (debounced) params.search = debounced;
  if (action) params.action = action;
  if (days) params.days = days;
  const { items, count, loading, error, page, pageSize, setPage, reload } = usePaginated(adminAPI.journal, params);

  return (
    <div>
      <PageHeader
        kicker="Propriétaire" title="Journal"
        lead="Qui a fait quoi, et quand, dans l’Admin : ajouts, modifications, suppressions, connexions et tentatives refusées. Seule la propriétaire peut le lire. Le contenu des formulaires n’y est jamais enregistré."
      />

      <div className="admin-toolbar">
        <input
          type="search" className="form-control admin-search" placeholder="Chercher une personne ou un mot (ex : Chaîne, Awa)"
          aria-label="Chercher dans le journal" value={search} onChange={(e) => setSearch(e.target.value)}
        />
        <select className="form-select admin-filter" aria-label="Type d’action" value={action} onChange={(e) => setAction(e.target.value)}>
          <option value="">Toutes les actions</option>
          {Object.entries(ACTIONS).map(([key, a]) => <option key={key} value={key}>{a.label}s</option>)}
        </select>
        <select className="form-select admin-filter" aria-label="Période" value={days} onChange={(e) => setDays(e.target.value)}>
          <option value="">Toute la période</option>
          <option value="1">Dernières 24 h</option>
          <option value="7">7 derniers jours</option>
          <option value="30">30 derniers jours</option>
        </select>
      </div>

      <ListStatus loading={loading} error={error} onRetry={reload} isEmpty={items.length === 0} emptyText="Aucune action enregistrée avec ces critères." />

      {items.length > 0 && (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead><tr><th>Quand</th><th>Qui</th><th>Type</th><th>Quoi</th></tr></thead>
            <tbody>
              {items.map((entry) => (
                <tr key={entry.id}>
                  <td className="cell-muted">{when(entry.created_at)}</td>
                  <td>{entry.actor_label}</td>
                  <td><StatusBadge status={ACTIONS[entry.action]?.status || 'pending'} label={ACTIONS[entry.action]?.label || entry.action} /></td>
                  <td>{entry.summary}</td>
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
