import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { adminAPI } from '../../utils/api';
import usePaginated from '../../utils/usePaginated';
import Pager from '../../components/Pager';
import ListStatus from '../../components/ListStatus';
import { PageHeader, errorText, fcfa } from './ui/parts';

const nf = (n) => Number(n || 0).toLocaleString('fr-FR');
const DEVICE_LABELS = { mobile: 'Téléphone', desktop: 'Ordinateur', tablet: 'Tablette', inconnu: 'Inconnu' };

function Tile({ label, value, note }) {
  return (
    <div className="stat-tile">
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      {note && <div className="stat-note">{note}</div>}
    </div>
  );
}

function RankList({ title, help, rows, empty, format = (r) => nf(r.count) }) {
  return (
    <section className="admin-card h-100">
      <h2 className="admin-card-title">{title}</h2>
      {help && <p className="admin-help">{help}</p>}
      {rows.length === 0 && <p className="admin-help mb-0">{empty || 'Pas encore de donnée.'}</p>}
      {rows.map((r) => (
        <div className="admin-row-line" key={r.id || r.label}>
          <span className="d-flex align-items-center gap-2">
            {r.image !== undefined && (r.image ? <img className="admin-thumb" src={r.image} alt="" loading="lazy" /> : <span className="admin-thumb admin-thumb-empty" />)}
            <span>{r.name || r.label}</span>
          </span>
          <strong>{format(r)}</strong>
        </div>
      ))}
    </section>
  );
}

function PeriodPicker({ days, onChange }) {
  return (
    <div className="admin-chips mb-3" role="group" aria-label="Période">
      {[7, 30, 90].map((d) => (
        <button key={d} type="button" className={`btn btn-sm ${days === d ? 'btn-primary' : 'btn-outline-secondary'}`} onClick={() => onChange(d)}>{d} jours</button>
      ))}
    </div>
  );
}

function useStat(fetcher, days) {
  const [state, setState] = useState({ data: null, loading: true, error: '' });
  const load = useCallback(() => {
    setState((s) => ({ ...s, loading: true, error: '' }));
    fetcher({ days })
      .then(({ data }) => setState({ data, loading: false, error: '' }))
      .catch((err) => setState({ data: null, loading: false, error: errorText(err, 'Impossible de charger ces chiffres.') }));
  }, [fetcher, days]);
  useEffect(() => { load(); }, [load]);
  return { ...state, reload: load };
}

function Summary() {
  const [days, setDays] = useState(30);
  const { data, loading, error, reload } = useStat(adminAPI.analyticsOverview, days);
  if (!data) return <ListStatus loading={loading} error={error} onRetry={reload} isEmpty rows={4} />;
  const maxVisits = Math.max(1, ...data.series.map((d) => d.visits));
  const top = data.funnel[0].count || 1;

  return (
    <>
      <PeriodPicker days={days} onChange={setDays} />
      <div className="row g-3 mb-3">
        <div className="col-6 col-lg-3"><Tile label="En ce moment" value={nf(data.online_now)} note="Personnes actives sur le site depuis 5 minutes." /></div>
        <div className="col-6 col-lg-3"><Tile label="Visites" value={nf(data.totals.visits)} note="Une personne qui revient un autre jour compte à nouveau." /></div>
        <div className="col-6 col-lg-3"><Tile label="Pages vues" value={nf(data.totals.pageviews)} /></div>
        <div className="col-6 col-lg-3"><Tile label="Commandes payées" value={nf(data.totals.orders)} note={fcfa(data.totals.revenue)} /></div>
      </div>

      <section className="admin-card">
        <h2 className="admin-card-title">Visites par jour</h2>
        <div className="admin-bars" role="img" aria-label={`Histogramme des visites sur ${days} jours`}>
          {data.series.map((d) => (
            <div key={d.date} className="admin-bar-col" title={`${new Date(d.date).toLocaleDateString('fr-FR')} : ${d.visits} visite(s), ${d.orders} commande(s)`}>
              <div className="admin-bar" style={{ height: `${(d.visits / maxVisits) * 100}%` }} />
              {days <= 30 && <span className="admin-bar-label">{new Date(d.date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}</span>}
            </div>
          ))}
        </div>
      </section>

      <section className="admin-card">
        <h2 className="admin-card-title">Du visiteur à la commande</h2>
        <p className="admin-help">Combien de personnes passent chaque étape. Si beaucoup regardent un bijou mais peu ajoutent au panier, regardez les photos, les prix ou la description.</p>
        {data.funnel.map((step) => (
          <div className="admin-funnel-row" key={step.label}>
            <div className="d-flex justify-content-between"><span>{step.label}</span><strong>{nf(step.count)}</strong></div>
            <div className="admin-funnel-track"><div className="admin-funnel-fill" style={{ width: `${Math.min(100, (step.count / top) * 100)}%` }} /></div>
          </div>
        ))}
      </section>

      <div className="row g-3">
        <div className="col-lg-4"><RankList title="Appareils" rows={data.devices.map((d) => ({ ...d, label: DEVICE_LABELS[d.label] || d.label }))} help="Téléphone, ordinateur ou tablette." /></div>
        <div className="col-lg-4"><RankList title="D’où viennent les visiteurs" rows={data.sources} help="« direct » = adresse tapée, favori ou lien sans origine (WhatsApp, par exemple)." /></div>
        <div className="col-lg-4"><RankList title="Pages les plus vues" rows={data.pages} /></div>
      </div>
    </>
  );
}

function Products() {
  const [days, setDays] = useState(30);
  const { data, loading, error, reload } = useStat(adminAPI.analyticsProducts, days);
  if (!data) return <ListStatus loading={loading} error={error} onRetry={reload} isEmpty rows={4} />;
  return (
    <>
      <PeriodPicker days={days} onChange={setDays} />
      <div className="row g-3">
        <div className="col-lg-4"><RankList title="Les plus regardés" help="Nombre de fois où la fiche du bijou a été ouverte." rows={data.most_viewed} format={(r) => `${nf(r.count)} vues`} /></div>
        <div className="col-lg-4"><RankList title="Les plus ajoutés au panier" help="Un bijou très regardé mais rarement mis au panier : vérifiez son prix et ses photos." rows={data.most_added} format={(r) => `${nf(r.count)} ajouts`} /></div>
        <div className="col-lg-4"><RankList title="Les plus aimés (cœur)" help="Depuis toujours, toutes périodes confondues." rows={data.most_liked} format={(r) => `♥ ${nf(r.count)}`} /></div>
      </div>
    </>
  );
}

function Searches() {
  const [days, setDays] = useState(30);
  const { data, loading, error, reload } = useStat(adminAPI.analyticsSearches, days);
  if (!data) return <ListStatus loading={loading} error={error} onRetry={reload} isEmpty rows={4} />;
  return (
    <>
      <PeriodPicker days={days} onChange={setDays} />
      <div className="row g-3">
        <div className="col-lg-6"><RankList title="Ce que les clientes cherchent" rows={data.top} format={(r) => `${nf(r.count)} fois`} /></div>
        <div className="col-lg-6"><RankList title="Recherches sans résultat" help="Des clientes ont cherché cela et n’ont rien trouvé : une idée de nouveau bijou ou de mot à ajouter dans une description." rows={data.empty} empty="Aucune recherche sans résultat." format={(r) => `${nf(r.count)} fois`} /></div>
      </div>
    </>
  );
}

function Places() {
  const [days, setDays] = useState(30);
  const { data, loading, error, reload } = useStat(adminAPI.analyticsPlaces, days);
  if (!data) return <ListStatus loading={loading} error={error} onRetry={reload} isEmpty rows={4} />;
  const money = (r) => `${nf(r.count)} commande${r.count > 1 ? 's' : ''} · ${fcfa(r.revenue)}`;
  return (
    <>
      <p className="admin-help">
        D’où commandent vos clientes : les communes et quartiers des <strong>commandes payées et livrées</strong>, d’après l’adresse que la cliente a saisie. C’est la donnée la plus fiable.
        Nous ne localisons pas les simples visiteurs : leur position par internet ne donne au mieux que « Abidjan », jamais le quartier, et nous ne conservons pas leur adresse IP.
      </p>
      <PeriodPicker days={days} onChange={setDays} />
      <div className="row g-3">
        <div className="col-lg-5">
          <RankList title="Communes d’Abidjan" rows={data.communes} empty="Pas encore de commande livrée à Abidjan sur cette période." format={money} />
        </div>
        <div className="col-lg-7">
          <RankList
            title="Quartiers" help={data.unknown ? `${data.unknown} commande${data.unknown > 1 ? 's' : ''} sans quartier (anciennes adresses).` : null}
            rows={data.quartiers.map((q) => ({ ...q, label: `${q.label} (${q.commune})` }))} empty="Pas encore de quartier renseigné." format={money}
          />
        </div>
        {data.cities.length > 0 && <div className="col-12"><RankList title="Autres villes" rows={data.cities} format={money} /></div>}
      </div>
    </>
  );
}

function Carts() {
  const [state, setState] = useState('active');
  const { items, count, loading, error, page, pageSize, setPage, reload } = usePaginated(adminAPI.carts, { state });
  return (
    <>
      <p className="admin-help">Les paniers qui contiennent au moins un article. « En cours » : modifiés depuis moins de 24 h. « Abandonnés » : laissés depuis plus de 24 h sans commande. Les comptes de l’équipe n’apparaissent pas.</p>
      <div className="admin-chips mb-3" role="group" aria-label="Type de panier">
        {[['active', 'En cours'], ['abandoned', 'Abandonnés'], ['', 'Tous']].map(([key, label]) => (
          <button key={key || 'all'} type="button" className={`btn btn-sm ${state === key ? 'btn-primary' : 'btn-outline-secondary'}`} onClick={() => setState(key)}>{label}</button>
        ))}
      </div>
      <ListStatus loading={loading} error={error} onRetry={reload} isEmpty={items.length === 0} emptyText="Aucun panier dans cette catégorie." />
      {items.map((cart) => (
        <section className="admin-card" key={cart.id}>
          <div className="d-flex justify-content-between flex-wrap gap-2 mb-2">
            <div>
              {cart.customer
                ? <Link to={`/admin/clients/${cart.customer.id}`}><strong>{cart.customer.name || cart.customer.email}</strong></Link>
                : <strong>Visiteur sans compte</strong>}
              <div className="cell-muted">Dernière modification : {new Date(cart.updated_at).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}{cart.is_abandoned ? ' · abandonné' : ''}</div>
            </div>
            <strong className="text-gold">{fcfa(cart.total)}</strong>
          </div>
          {cart.items.map((item) => (
            <div className="admin-row-line" key={item.id}>
              <span className="d-flex align-items-center gap-2">
                {item.product_image ? <img className="admin-thumb" src={item.product_image} alt="" loading="lazy" /> : <span className="admin-thumb admin-thumb-empty" />}
                <span>
                  {item.product_name || `Coffret : ${item.coffret_configuration?.coffret?.name || ''}`} <span className="cell-muted">× {item.quantity}</span>
                  {item.engraving_text && <div className="cell-muted">Gravure demandée : « {item.engraving_text} »</div>}
                </span>
              </span>
              <span>{fcfa(item.subtotal)}</span>
            </div>
          ))}
        </section>
      ))}
      <Pager page={page} count={count} pageSize={pageSize} onChange={setPage} />
      <p className="admin-help">{count} panier{count > 1 ? 's' : ''}.</p>
    </>
  );
}

const TABS = [['summary', 'Résumé'], ['products', 'Bijoux'], ['searches', 'Recherches'], ['places', 'Quartiers'], ['carts', 'Paniers']];

export default function AdminVisitorsScreen() {
  const [tab, setTab] = useState('summary');
  return (
    <div>
      <PageHeader
        title="Visiteurs"
        lead="Ce que font les personnes sur le site : qui vient, ce qu’elles regardent, aiment et mettent au panier. Les chiffres se mettent à jour toutes les quelques minutes. Les visites de l’équipe (quand vous êtes connectée) ne sont jamais comptées."
      />
      <div className="admin-tabs" role="tablist">
        {TABS.map(([key, label]) => (
          <button key={key} type="button" role="tab" aria-selected={tab === key} className={tab === key ? 'is-active' : ''} onClick={() => setTab(key)}>{label}</button>
        ))}
      </div>
      {tab === 'summary' && <Summary />}
      {tab === 'products' && <Products />}
      {tab === 'searches' && <Searches />}
      {tab === 'places' && <Places />}
      {tab === 'carts' && <Carts />}
    </div>
  );
}
