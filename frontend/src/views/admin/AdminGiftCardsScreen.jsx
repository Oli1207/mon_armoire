import { useState } from 'react';
import { adminAPI } from '../../utils/api';
import usePaginated, { useDebounced } from '../../utils/usePaginated';
import Pager from '../../components/Pager';
import ListStatus from '../../components/ListStatus';
import { PageHeader, StatusBadge, fcfa } from './ui/parts';

const STATUS = {
  pending: { label: 'En attente de paiement', tone: 'pending' },
  active: { label: 'Active', tone: 'on' },
  used: { label: 'Épuisée', tone: 'off' },
  cancelled: { label: 'Annulée', tone: 'cancelled' },
};

export default function AdminGiftCardsScreen() {
  const [search, setSearch] = useState('');
  const debounced = useDebounced(search.trim());
  const { items: cards, count, loading, error, page, pageSize, setPage, reload } = usePaginated(
    adminAPI.giftcards, debounced ? { search: debounced } : {},
  );

  return (
    <div>
      <PageHeader title="Cartes cadeaux" lead={`${count} carte${count > 1 ? 's' : ''}. Le code est envoyé par e-mail dès que l'achat est payé ; le solde baisse à chaque utilisation.`} />

      <div className="admin-toolbar">
        <input
          type="search" className="form-control admin-search" placeholder="Chercher par code ou e-mail"
          aria-label="Chercher une carte cadeau" value={search} onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <ListStatus loading={loading} error={error} onRetry={reload} isEmpty={cards.length === 0} emptyText="Aucune carte cadeau trouvée." />

      {cards.length > 0 && (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr><th>Code</th><th>Commande</th><th>Valeur</th><th>Solde</th><th>Acheteuse</th><th>Destinataire</th><th>Statut</th></tr>
            </thead>
            <tbody>
              {cards.map((c) => (
                <tr key={c.id}>
                  <td><strong>{c.code}</strong></td>
                  <td className="cell-muted">{c.order_number}</td>
                  <td>{fcfa(c.initial_value)}</td>
                  <td><strong className="text-gold">{fcfa(c.balance)}</strong></td>
                  <td>{c.purchaser_name || c.purchaser_email}</td>
                  <td>{c.recipient_name || c.recipient_email || '—'}</td>
                  <td><StatusBadge status={STATUS[c.status]?.tone || 'off'} label={STATUS[c.status]?.label || c.status} /></td>
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
