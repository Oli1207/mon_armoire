import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { adminAPI } from '../../utils/api';
import ListStatus from '../../components/ListStatus';
import { PageHeader, StatusBadge, errorText, fcfa } from './ui/parts';

function Tile({ label, value, note, alert, to }) {
  const body = (
    <>
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      {note && <div className="stat-note">{note}</div>}
    </>
  );
  return to
    ? <Link to={to} className={`stat-tile d-block text-decoration-none ${alert ? 'is-alert' : ''}`}>{body}</Link>
    : <div className={`stat-tile ${alert ? 'is-alert' : ''}`}>{body}</div>;
}

export default function AdminDashboardScreen() {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    setError('');
    adminAPI.stats().then(({ data }) => setStats(data)).catch((err) => setError(errorText(err, 'Impossible de charger les chiffres.')));
  }, []);
  useEffect(() => { load(); }, [load]);

  if (!stats) {
    return (
      <div>
        <PageHeader title="Vue d'ensemble" lead="Un coup d'œil sur la boutique." />
        <ListStatus loading={!error} error={error} onRetry={load} isEmpty rows={4} />
      </div>
    );
  }

  const maxTrend = Math.max(1, ...stats.revenue_trend.map((d) => Number(d.total)));
  const toPrepare = stats.orders_by_status.find((s) => s.status === 'paid')?.count || 0;

  return (
    <div>
      <PageHeader title="Vue d'ensemble" lead="Un coup d'œil sur la boutique : ventes, commandes à traiter, produits à surveiller." />

      {toPrepare > 0 && (
        <Link to="/admin/commandes?status=paid" className="stat-tile is-alert d-block text-decoration-none mb-3">
          <div className="stat-label">À faire</div>
          <div className="stat-value">{toPrepare} commande{toPrepare > 1 ? 's' : ''} payée{toPrepare > 1 ? 's' : ''} à préparer →</div>
        </Link>
      )}

      <div className="row g-3 mb-3">
        <div className="col-6 col-lg-3"><Tile label="Chiffre d'affaires" value={fcfa(stats.revenue_total)} /></div>
        <div className="col-6 col-lg-3"><Tile label="Commandes" value={stats.orders_count} /></div>
        <div className="col-6 col-lg-3"><Tile label="Clients" value={stats.customers_count} /></div>
        <div className="col-6 col-lg-3"><Tile label="Produits en vente" value={stats.products_count} /></div>
      </div>
      <div className="row g-3 mb-4">
        <div className="col-6 col-lg-3"><Tile label="Panier moyen" value={fcfa(stats.average_order_value)} /></div>
        <div className="col-6 col-lg-3"><Tile label="Nouveaux clients (30 j)" value={stats.new_customers_30d} /></div>
        <div className="col-6 col-lg-3"><Tile label="Cartes cadeaux à honorer" value={fcfa(stats.gift_cards_outstanding)} /></div>
        <div className="col-6 col-lg-3">
          <Tile label="Points de fidélité dus" value={fcfa(stats.loyalty_liability_amount)} note={`${stats.loyalty_points_outstanding} pts en circulation`} />
        </div>
      </div>

      <section className="admin-card">
        <h2 className="admin-card-title">Chiffre d'affaires — 14 derniers jours</h2>
        <div className="admin-bars" role="img" aria-label="Histogramme du chiffre d'affaires des 14 derniers jours">
          {stats.revenue_trend.map((d) => (
            <div key={d.date} className="admin-bar-col" title={`${d.date} — ${fcfa(d.total)} (${d.orders} commande(s))`}>
              <div className="admin-bar" style={{ height: `${(Number(d.total) / maxTrend) * 100}%` }} />
              <span className="admin-bar-label">{new Date(d.date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}</span>
            </div>
          ))}
        </div>
      </section>

      <div className="row g-3">
        <div className="col-lg-6">
          <section className="admin-card h-100">
            <h2 className="admin-card-title">Meilleures ventes (30 jours)</h2>
            {stats.top_products.length === 0 && <p className="admin-help">Pas encore de vente.</p>}
            {stats.top_products.map((p) => (
              <div className="admin-row-line" key={p.name}>
                <span>{p.name} <span className="cell-muted">× {p.quantity}</span></span>
                <strong className="text-gold">{fcfa(p.revenue)}</strong>
              </div>
            ))}
          </section>
        </div>
        <div className="col-lg-6">
          <section className="admin-card h-100">
            <h2 className="admin-card-title">À surveiller</h2>
            <div className="admin-row-line">
              <span>Variantes en rupture de stock</span>
              <strong className={stats.out_of_stock_count ? 'text-danger' : ''}>{stats.out_of_stock_count}</strong>
            </div>
            <div className="admin-row-line">
              <Link to="/admin/liste-attente">Personnes en liste d'attente</Link>
              <strong>{stats.waitlist_pending}</strong>
            </div>
            {stats.low_stock.length > 0 && <p className="admin-label mt-3">Stock faible</p>}
            {stats.low_stock.map((item) => (
              <div className="admin-row-line" key={`${item.product}-${item.variant}`}>
                <span>{item.product} <span className="cell-muted">— {item.variant}</span></span>
                <strong className="text-danger">{item.stock}</strong>
              </div>
            ))}
          </section>
        </div>
        <div className="col-12">
          <section className="admin-card">
            <h2 className="admin-card-title">Commandes par statut</h2>
            {stats.orders_by_status.length === 0 && <p className="admin-help">Aucune commande.</p>}
            <div className="d-flex flex-wrap gap-3">
              {stats.orders_by_status.map((s) => (
                <div key={s.status} className="d-flex align-items-center gap-2">
                  <StatusBadge status={s.status} />
                  <strong>{s.count}</strong>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
