import QueuedImage from '../../components/QueuedImage';
import { useEffect, useState } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { FaHeart, FaRegHeart } from 'react-icons/fa';
import { productsAPI, categoriesAPI, favoritesAPI, collectionsAPI } from '../../utils/api';
import useAuthStore from '../../store/auth';
import { useLoadMore } from '../../utils/usePaginated';
import { StarRating } from '../../components/Stars';

export default function CatalogueScreen() {
  const { isAuthenticated } = useAuthStore();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [categories, setCategories] = useState([]);
  const [category, setCategory] = useState(searchParams.get('category') || '');
  const search      = searchParams.get('search') || '';
  const collection  = searchParams.get('collection') || '';
  const maxPrice    = searchParams.get('max_price') || '';
  const [collectionName, setCollectionName] = useState('');
  const [favoriteIds, setFavoriteIds] = useState(new Set());

  useEffect(() => {
    categoriesAPI.list().then(({ data }) => setCategories(data));
  }, []);

  useEffect(() => {
    if (!collection) {
      setCollectionName('');
      return;
    }
    collectionsAPI.list('occasion').then(({ data }) => {
      setCollectionName(data.find((c) => c.slug === collection)?.name || '');
    });
  }, [collection]);

  const params = {};
  if (category) params.category = category;
  if (search) params.search = search;
  if (collection) params.collection = collection;
  if (maxPrice) params.max_price = maxPrice;
  const { items: products, loading, error, hasMore, loadingMore, loadMore, reload } = useLoadMore(productsAPI.list, params);

  useEffect(() => {
    if (!isAuthenticated) {
      setFavoriteIds(new Set());
      return;
    }
    favoritesAPI.ids().then(({ data }) => setFavoriteIds(new Set(data))).catch(() => {});
  }, [isAuthenticated]);

  const toggleFavorite = async (productId) => {
    if (!isAuthenticated) return;
    await favoritesAPI.toggle(productId);
    setFavoriteIds((prev) => {
      const next = new Set(prev);
      if (next.has(productId)) next.delete(productId);
      else next.add(productId);
      return next;
    });
  };

  return (
    <div>
      <div className="py-5 text-center" style={{ backgroundColor: 'var(--ma-cream)' }}>
        <p className="text-uppercase text-gold small tracking-wide mb-2">Boutique</p>
        <h1 className="h1 mb-0">Nos bijoux</h1>
      </div>

      <div className="container py-5">
        {(collectionName || search) && (
          <div className="text-center mb-4">
            <span className="badge text-bg-light border px-3 py-2 small">
              {collectionName ? `Sélection : ${collectionName}` : `Recherche : « ${search} »`}
              <button
                type="button"
                className="btn btn-sm p-0 border-0 bg-transparent ms-2 text-muted"
                onClick={() => navigate('/catalogue')}
                aria-label="Retirer le filtre"
              >
                ×
              </button>
            </span>
          </div>
        )}

        <div className="mb-5 d-flex gap-2 flex-wrap justify-content-center">
          <button
            className={`btn btn-sm px-3 text-uppercase small tracking-wide ${!category ? 'btn-primary' : 'btn-outline-primary'}`}
            onClick={() => setCategory('')}
          >
            Toutes
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              className={`btn btn-sm px-3 text-uppercase small tracking-wide ${category === c.slug ? 'btn-primary' : 'btn-outline-primary'}`}
              onClick={() => setCategory(c.slug)}
            >
              {c.name}
            </button>
          ))}
        </div>

        {error ? (
          <div className="alert alert-danger d-flex justify-content-between align-items-center gap-3" role="alert">
            <span>{error}</span>
            <button type="button" className="btn btn-sm btn-outline-primary flex-shrink-0" onClick={reload}>Réessayer</button>
          </div>
        ) : loading ? (
          <div className="row g-4" aria-busy="true" aria-label="Chargement des bijoux">
            {Array.from({ length: 8 }, (_, i) => (
              <div className="col-6 col-md-4 col-lg-3" key={i}><div className="skeleton-card" /></div>
            ))}
          </div>
        ) : products.length === 0 ? (
          <p className="text-center text-muted">
            {search ? `Aucun résultat pour « ${search} ».` : 'Aucun produit pour le moment.'}
          </p>
        ) : (
          <div className="row g-4">
            {products.map((p) => (
              <div className="col-6 col-md-4 col-lg-3" key={p.id}>
                <div className="card product-card h-100 shadow-sm">
                  <Link to={`/produits/${p.slug}`}>
                    {p.main_image ? (
                      <QueuedImage src={p.main_image} className="card-img-top" alt={p.name} />
                    ) : (
                      <div className="card-img-top d-flex align-items-center justify-content-center text-muted bg-white">
                        Pas d'image
                      </div>
                    )}
                  </Link>
                  <div className="card-body">
                    <div className="d-flex justify-content-between align-items-start">
                      <Link to={`/produits/${p.slug}`} className="text-decoration-none text-dark">
                        <h6 className="mb-1">{p.name}</h6>
                      </Link>
                      <button className="fav-btn btn btn-sm p-0 border-0 bg-transparent" onClick={() => toggleFavorite(p.id)} aria-label={favoriteIds.has(p.id) ? `Retirer ${p.name} des favoris` : `Ajouter ${p.name} aux favoris`}>
                        {favoriteIds.has(p.id) ? <FaHeart color="#C9A227" /> : <FaRegHeart />}
                      </button>
                    </div>
                    {p.rating_count > 0 && (
                      <div className="d-flex align-items-center gap-1 mb-1" title={`${p.rating_average} sur 5 (${p.rating_count} avis)`}>
                        <StarRating value={p.rating_average} size="0.9rem" />
                        <span className="small text-muted">({p.rating_count})</span>
                      </div>
                    )}
                    <p className="mb-0 fw-semibold text-gold">
                      {p.price ? `${Number(p.price).toLocaleString('fr-FR')} FCFA` : '—'}
                    </p>
                    <div className="mt-1">
                      {p.is_new && <span className="badge badge-gold me-1">Nouveauté</span>}
                      {!p.is_in_stock && <span className="badge badge-muted">Rupture</span>}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {hasMore && !loading && (
          <div className="text-center mt-5">
            <button type="button" className="btn btn-outline-primary pager-btn px-5 text-uppercase small tracking-wide" disabled={loadingMore} onClick={loadMore}>
              {loadingMore ? 'Chargement...' : 'Voir plus de bijoux'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
