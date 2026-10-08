import { useState } from 'react';
import { adminAPI } from '../../utils/api';
import usePaginated, { useDebounced } from '../../utils/usePaginated';
import Pager from '../../components/Pager';
import ListStatus from '../../components/ListStatus';
import { useAdminUi } from './ui/AdminUi';
import { PageHeader, StatusBadge, errorText, shortDate } from './ui/parts';

const FILTERS = [
  ['', 'Toutes'],
  ['to_call', 'À relancer (bijou de retour, pas encore relancée)'],
  ['contacted', 'Déjà relancées'],
];

// Numéro ivoirien à 10 chiffres sans indicatif → on ajoute 225 ; sinon on garde les chiffres tels quels
const whatsappLink = (entry) => {
  let digits = entry.phone.replace(/\D/g, '').replace(/^00/, '');
  if (digits.length === 10) digits = `225${digits}`;
  const text = `Bonjour${entry.name ? ` ${entry.name}` : ''}, bonne nouvelle : « ${entry.product_name} » est de nouveau disponible chez Mon Armoire. ${window.location.origin}/produits/${entry.product_slug}`;
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
};

export default function AdminWaitlistScreen() {
  const { notify, confirm } = useAdminUi();
  const [search, setSearch] = useState('');
  const [state, setState] = useState('');
  const debounced = useDebounced(search.trim());
  const params = {};
  if (debounced) params.search = debounced;
  if (state) params.state = state;
  const { items: entries, count, loading, error, page, pageSize, setPage, reload } = usePaginated(adminAPI.waitlist, params);

  const toggleContacted = async (entry) => {
    try {
      await adminAPI.updateWaitlistEntry(entry.id, { contacted: !entry.contacted });
      notify(entry.contacted ? 'Marquée comme « à relancer ».' : 'Marquée comme relancée.');
      reload();
    } catch (err) {
      notify(errorText(err), 'error');
    }
  };

  const remove = async (entry) => {
    const accepted = await confirm({
      title: 'Retirer cette personne de la liste ?',
      message: 'Elle ne sera plus prévenue pour ce bijou. Cette action est définitive.',
      confirmLabel: 'Retirer', danger: true,
    });
    if (!accepted) return;
    try {
      await adminAPI.deleteWaitlistEntry(entry.id);
      notify('Personne retirée de la liste.');
      reload();
    } catch (err) {
      notify(errorText(err), 'error');
    }
  };

  return (
    <div>
      <PageHeader
        title="Liste d'attente"
        lead={`${count} inscription${count > 1 ? 's' : ''}. Les personnes laissent leur e-mail et leur téléphone quand un bijou est en rupture.`}
      />

      <details className="admin-card admin-guide">
        <summary>Comment ça marche ? (cliquez pour lire)</summary>
        <ul className="admin-help mb-0">
          <li><strong>Automatique :</strong> dès que vous remettez du stock, un e-mail part tout seul à chaque personne (dans la demi-heure), et une notification si elle l’a acceptée.</li>
          <li><strong>À la main :</strong> beaucoup de clientes ouvrent peu leurs e-mails. Dans la colonne « Contact », cliquez sur « WhatsApp » (le message est déjà écrit) ou « Appeler ».</li>
          <li>Ensuite cochez « Relancée » pour ne pas la contacter deux fois. Le filtre « À relancer » liste celles à contacter maintenant.</li>
        </ul>
      </details>

      <div className="admin-toolbar">
        <input
          type="search" className="form-control admin-search" placeholder="Chercher par nom, e-mail, téléphone ou produit"
          aria-label="Chercher dans la liste d'attente" value={search} onChange={(e) => setSearch(e.target.value)}
        />
        <div className="admin-chips" role="group" aria-label="Filtre">
          {FILTERS.map(([key, label]) => (
            <button key={key || 'all'} type="button" className={`btn btn-sm ${state === key ? 'btn-primary' : 'btn-outline-primary'}`} onClick={() => setState(key)}>{label}</button>
          ))}
        </div>
      </div>

      <ListStatus loading={loading} error={error} onRetry={reload} isEmpty={entries.length === 0} emptyText="Personne dans cette liste." />

      {entries.length > 0 && (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr><th>Bijou</th><th>Contact</th><th>Stock</th><th>Prévenue automatiquement</th><th>Relancée</th><th>Inscrite le</th><th aria-label="Actions" /></tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id}>
                  <td><strong>{e.product_name}</strong><div className="cell-muted">{e.variant_label}</div></td>
                  <td>
                    <div>{e.name || <span className="cell-muted">Sans nom</span>}</div>
                    {e.phone && (
                      <div className="d-flex gap-3 flex-wrap align-items-center">
                        <span>{e.phone}</span>
                        <a className="admin-link" href={whatsappLink(e)} target="_blank" rel="noopener noreferrer">WhatsApp</a>
                        <a className="admin-link" href={`tel:${e.phone}`}>Appeler</a>
                      </div>
                    )}
                    <div className="cell-muted">{e.email}</div>
                  </td>
                  <td><StatusBadge status={e.in_stock ? 'paid' : 'cancelled'} label={e.in_stock ? 'De retour en stock' : 'Toujours en rupture'} /></td>
                  <td className="cell-muted">E-mail : {e.notified ? 'envoyé' : 'pas encore'}{e.has_push ? ` · Notification : ${e.push_notified ? 'envoyée' : 'pas encore'}` : ''}</td>
                  <td>
                    <div className="form-check form-switch mb-0">
                      <input
                        type="checkbox" role="switch" className="form-check-input" checked={e.contacted}
                        aria-label={`${e.name || e.email} relancée à la main`} onChange={() => toggleContacted(e)}
                      />
                    </div>
                  </td>
                  <td className="cell-muted">{shortDate(e.created_at)}</td>
                  <td className="cell-actions"><button type="button" className="admin-link is-danger" onClick={() => remove(e)}>Retirer</button></td>
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
