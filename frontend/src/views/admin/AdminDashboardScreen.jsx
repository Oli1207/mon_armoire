import { useEffect, useState } from 'react';
import { adminAPI } from '../../utils/api';

const STATUS_LABELS = {
  pending: 'En attente',
  paid: 'Payée',
  processing: 'En préparation',
  shipped: 'Expédiée',
  delivered: 'Livrée',
  cancelled: 'Annulée',
};

export default function AdminDashboardScreen() {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    adminAPI.stats().then(({ data }) => setStats(data));
  }, []);

  if (!stats) return <p>Chargement...</p>;

  const maxTrend = Math.max(1, ...stats.revenue_trend.map((d) => Number(d.total)));

  return (
    <div>
      <h1 className="h4 mb-4">Vue d'ensemble</h1>
      <div className="row g-3 mb-4">
        <div className="col-6 col-md-3">
          <div className="card p-3">
            <div className="text-muted small">Chiffre d'affaires</div>
            <div className="fs-4 fw-semibold">{Number(stats.revenue_total).toLocaleString('fr-FR')} FCFA</div>
          </div>
        </div>
        <div className="col-6 col-md-3">
          <div className="card p-3">
            <div className="text-muted small">Commandes</div>
            <div className="fs-4 fw-semibold">{stats.orders_count}</div>
          </div>
        </div>
        <div className="col-6 col-md-3">
          <div className="card p-3">
            <div className="text-muted small">Clients</div>
            <div className="fs-4 fw-semibold">{stats.customers_count}</div>
          </div>
        </div>
        <div className="col-6 col-md-3">
          <div className="card p-3">
            <div className="text-muted small">Produits actifs</div>
            <div className="fs-4 fw-semibold">{stats.products_count}</div>
          </div>
        </div>
      </div>

      <div className="row g-3 mb-4">
        <div className="col-6 col-md-3">
          <div className="card p-3">
            <div className="text-muted small">Panier moyen</div>
            <div className="fs-5 fw-semibold">{Number(stats.average_order_value).toLocaleString('fr-FR')} FCFA</div>
          </div>
        </div>
        <div className="col-6 col-md-3">
          <div className="card p-3">
            <div className="text-muted small">Nouveaux clients (30j)</div>
            <div className="fs-5 fw-semibold">{stats.new_customers_30d}</div>
          </div>
        </div>
        <div className="col-6 col-md-3">
          <div className="card p-3">
            <div className="text-muted small">Cartes cadeaux (solde dû)</div>
            <div className="fs-5 fw-semibold">{Number(stats.gift_cards_outstanding).toLocaleString('fr-FR')} FCFA</div>
          </div>
        </div>
        <div className="col-6 col-md-3">
          <div className="card p-3">
            <div className="text-muted small">Points fidélité (valeur due)</div>
            <div className="fs-5 fw-semibold">{Number(stats.loyalty_liability_amount).toLocaleString('fr-FR')} FCFA</div>
            <div className="text-muted small">{stats.loyalty_points_outstanding} pts en circulation</div>
          </div>
        </div>
      </div>

      <div className="card p-3 mb-4">
        <h6>Chiffre d'affaires — 14 derniers jours</h6>
        <div className="d-flex align-items-end gap-1" style={{ height: 120 }}>
          {stats.revenue_trend.map((d) => (
            <div key={d.date} className="flex-grow-1 d-flex flex-column align-items-center justify-content-end h-100" title={`${d.date} — ${Number(d.total).toLocaleString('fr-FR')} FCFA (${d.orders} commande(s))`}>
              <div
                style={{
                  width: '100%',
                  minHeight: 2,
                  height: `${(Number(d.total) / maxTrend) * 100}%`,
                  backgroundColor: 'var(--ma-gold)',
                  borderRadius: '2px 2px 0 0',
                }}
              />
              <span className="text-muted mt-1" style={{ fontSize: '0.6rem' }}>
                {new Date(d.date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="row g-3 mb-4">
        <div className="col-md-6">
          <div className="card p-3">
            <h6>Meilleures ventes (30 derniers jours)</h6>
            {stats.top_products.length === 0 && <p className="text-muted small">Pas encore de vente.</p>}
            {stats.top_products.map((p, i) => (
              <div className="d-flex justify-content-between border-bottom py-1" key={i}>
                <span>{p.name} <span className="text-muted small">× {p.quantity}</span></span>
                <span className="fw-semibold text-gold">{Number(p.revenue).toLocaleString('fr-FR')} FCFA</span>
              </div>
            ))}
          </div>
        </div>
        <div className="col-md-6">
          <div className="card p-3">
            <h6>Signaux à surveiller</h6>
            <div className="d-flex justify-content-between border-bottom py-1">
              <span>Variantes en rupture de stock</span>
              <span className="fw-semibold text-danger">{stats.out_of_stock_count}</span>
            </div>
            <div className="d-flex justify-content-between py-1">
              <span>Clients en liste d'attente (non notifiés)</span>
              <span className="fw-semibold">{stats.waitlist_pending}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="row g-3">
        <div className="col-md-6">
          <div className="card p-3">
            <h6>Commandes par statut</h6>
            {stats.orders_by_status.length === 0 && <p className="text-muted small">Aucune commande.</p>}
            {stats.orders_by_status.map((s) => (
              <div className="d-flex justify-content-between border-bottom py-1" key={s.status}>
                <span>{STATUS_LABELS[s.status] || s.status}</span>
                <span className="fw-semibold">{s.count}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="col-md-6">
          <div className="card p-3">
            <h6>Stock faible ({stats.out_of_stock_count} en rupture)</h6>
            {stats.low_stock.length === 0 && <p className="text-muted small">Rien à signaler.</p>}
            {stats.low_stock.map((item, i) => (
              <div className="d-flex justify-content-between border-bottom py-1" key={i}>
                <span>{item.product} — {item.variant}</span>
                <span className="fw-semibold text-danger">{item.stock}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
