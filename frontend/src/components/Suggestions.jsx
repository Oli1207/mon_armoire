import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { productsAPI } from '../utils/api';
import QueuedImage from './QueuedImage';
import { StarRating } from './Stars';

/**
 * « Vous aimerez aussi » : 4 articles proposés en complément de `like` (slugs des articles consultés ou au panier).
 * Ne charge rien tant que la section n'approche pas de l'écran. C'est un bonus : en cas d'échec, la section
 * disparaît au lieu d'afficher une erreur qui gênerait la commande.
 */
export default function Suggestions({ like = [], title = 'Vous aimerez aussi', lead }) {
  const holder = useRef(null);
  const [near, setNear] = useState(false);
  const [state, setState] = useState({ loading: true, items: [] });
  const key = like.join(',');

  useEffect(() => {
    const el = holder.current;
    if (!el) return undefined;
    if (typeof IntersectionObserver === 'undefined') { setNear(true); return undefined; }
    const observer = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) { setNear(true); observer.disconnect(); } }, { rootMargin: '400px 0px' });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!near) return undefined;
    const controller = new AbortController();
    setState((s) => ({ ...s, loading: true }));
    productsAPI.suggestions(key, controller.signal)
      .then(({ data }) => setState({ loading: false, items: Array.isArray(data) ? data : [] }))
      .catch((err) => { if (err?.code !== 'ERR_CANCELED') setState({ loading: false, items: [] }); });
    return () => controller.abort();
  }, [near, key]);

  const { loading, items } = state;
  if (near && !loading && items.length === 0) return null;

  return (
    <section ref={holder} className="suggestions" aria-label={title}>
      <h2 className="h3 text-center mb-1">{title}</h2>
      {lead && <p className="text-center text-muted mb-4">{lead}</p>}
      <div className="row g-3 g-md-4 mt-1">
        {loading
          ? Array.from({ length: 4 }, (_, i) => <div className="col-6 col-lg-3" key={i}><div className="skeleton-card" /></div>)
          : items.map((p) => (
            <div className="col-6 col-lg-3" key={p.id}>
              <div className="card product-card h-100">
                <Link to={`/produits/${p.slug}`} aria-label={p.name}>
                  {p.main_image
                    ? <QueuedImage src={p.main_image} className="card-img-top" alt="" />
                    : <div className="card-img-top d-flex align-items-center justify-content-center text-muted bg-white">Pas d'image</div>}
                </Link>
                <div className="card-body">
                  <Link to={`/produits/${p.slug}`} className="text-decoration-none text-dark"><h3 className="h6 mb-1">{p.name}</h3></Link>
                  {p.rating_count > 0 && (
                    <div className="d-flex align-items-center gap-1 mb-1">
                      <StarRating value={p.rating_average} size="0.9rem" />
                      <span className="small text-muted">({p.rating_count})</span>
                    </div>
                  )}
                  <p className="mb-0 fw-semibold text-gold">{p.price ? `${Number(p.price).toLocaleString('fr-FR')} FCFA` : '—'}</p>
                  {p.is_new && <span className="badge badge-gold mt-1">Nouveauté</span>}
                </div>
              </div>
            </div>
          ))}
      </div>
    </section>
  );
}
