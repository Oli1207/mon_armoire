import { useState } from 'react';
import { adminAPI } from '../../utils/api';
import usePaginated, { useDebounced } from '../../utils/usePaginated';
import Pager from '../../components/Pager';
import ListStatus from '../../components/ListStatus';

const STATUS_LABELS = {
  pending: 'En attente de paiement',
  active: 'Active',
  used: 'Épuisée',
  cancelled: 'Annulée',
};

export default function AdminGiftCardsScreen() {
  const [search, setSearch] = useState('');
  const debounced = useDebounced(search.trim());
  const { items: cards, count, loading, error, page, pageSize, setPage, reload } = usePaginated(
    adminAPI.giftcards, debounced ? { search: debounced } : {},
  );

  return (
    <div>
      <h1 className="h4 mb-3">Cartes cadeaux ({count})</h1>

      <input
        type="search"
        className="form-control mb-3"
        style={{ maxWidth: '24rem' }}
        placeholder="Chercher par code ou e-mail"
        aria-label="Chercher une carte cadeau"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      <ListStatus loading={loading} error={error} onRetry={reload} isEmpty={cards.length === 0} emptyText="Aucune carte cadeau trouvée." />

      {cards.length > 0 && (
        <div className="table-responsive">
          <table className="table table-sm align-middle bg-white">
            <thead>
              <tr>
                <th>Code</th>
                <th>Commande</th>
                <th>Valeur</th>
                <th>Solde</th>
                <th>Acheteur</th>
                <th>Destinataire</th>
                <th>Statut</th>
              </tr>
            </thead>
            <tbody>
              {cards.map((c) => (
                <tr key={c.id}>
                  <td className="small fw-semibold">{c.code}</td>
                  <td className="small">{c.order_number}</td>
                  <td>{Number(c.initial_value).toLocaleString('fr-FR')} FCFA</td>
                  <td className="fw-semibold text-gold">{Number(c.balance).toLocaleString('fr-FR')} FCFA</td>
                  <td className="small">{c.purchaser_name || c.purchaser_email}</td>
                  <td className="small">{c.recipient_name || c.recipient_email || '—'}</td>
                  <td className="small">{STATUS_LABELS[c.status] || c.status}</td>
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
