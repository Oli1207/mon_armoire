import { useCallback, useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { FaHeart, FaRegHeart, FaWhatsapp, FaFacebook, FaLink } from 'react-icons/fa';
import { productsAPI, favoritesAPI, reviewsAPI } from '../../utils/api';
import useAuthStore from '../../store/auth';
import useCartStore from '../../store/cart';
import { useLoadMore } from '../../utils/usePaginated';
import ProductReviews from '../../components/ProductReviews';
import { StarRating } from '../../components/Stars';
import { errorText } from '../../utils/errors';
import Suggestions from '../../components/Suggestions';
import DetailSkeleton from '../../components/DetailSkeleton';
import { track } from '../../utils/tracker';
import EngravingPreview from '../../components/EngravingPreview';
import WaitlistForm from '../../components/WaitlistForm';

export default function ProductDetailScreen() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthStore();
  const { addVariant } = useCartStore();
  const [product, setProduct] = useState(null);
  const [variant, setVariant] = useState(null);
  const [isFavorite, setIsFavorite] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState('');
  const [linkCopied, setLinkCopied] = useState(false);
  const [activeImage, setActiveImage] = useState(null);
  const [engravingText, setEngravingText] = useState('');

  const loadProduct = useCallback(() => {
    setLoadError(null);
    productsAPI.detail(slug)
      .then(({ data }) => {
        setProduct(data);
        track('product_view', { p: data.slug });
        setVariant(data.variants.find((v) => v.is_default) || data.variants[0] || null);
        setActiveImage(null);
      })
      .catch((err) => setLoadError({
        missing: err.response?.status === 404,
        message: errorText(err, 'Cette page n’a pas pu être chargée.'),
      }));
  }, [slug]);

  useEffect(() => {
    setProduct(null);
    loadProduct();
  }, [loadProduct]);

  useEffect(() => {
    if (!isAuthenticated || !product) return;
    favoritesAPI.ids().then(({ data }) => setIsFavorite(data.includes(product.id))).catch(() => {});
  }, [isAuthenticated, product]);

  // Les avis se chargent après la fiche (ils sont en bas de page) et par pages de 10.
  const reviews = useLoadMore(
    ({ slug: productSlug, ...rest }) => reviewsAPI.list(productSlug, rest),
    { slug: product?.slug }, Boolean(product),
  );

  const toggleFavorite = async () => {
    if (!isAuthenticated || !product) return;
    await favoritesAPI.toggle(product.id);
    track(isFavorite ? 'favorite_remove' : 'favorite_add', { p: product.slug });
    setIsFavorite((v) => !v);
  };

  const shareUrl = typeof window !== 'undefined' ? window.location.href : '';
  const shareText = product ? `${product.name} sur Mon Armoire` : '';

  const copyLink = () => {
    navigator.clipboard?.writeText(shareUrl);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  };

  if (loadError) {
    return (
      <div className="container py-5 text-center" style={{ maxWidth: '36rem' }}>
        <h1 className="h3 mb-3">{loadError.missing ? 'Ce bijou n’est plus disponible' : 'Oups, la page n’a pas pu s’afficher'}</h1>
        <p className="text-muted mb-4">{loadError.missing ? 'Il a peut-être été retiré de la boutique. Découvrez nos autres créations.' : loadError.message}</p>
        {loadError.missing
          ? <Link to="/catalogue" className="btn btn-primary">Voir tous les bijoux</Link>
          : <button type="button" className="btn btn-primary" onClick={loadProduct}>Réessayer</button>}
      </div>
    );
  }
  if (!product) return <DetailSkeleton />;

  // Zone de gravure de la photo actuellement affichée (la cliente la définit photo par photo dans l'Admin)
  const shownImage = activeImage
    ? product.images.find((img) => img.image === activeImage)
    : (variant?.image ? variant : product.images[0]);
  const engravingZone = shownImage?.engraving_zone || null;
  const engravingLimit = product.engraving_max_chars || 30;

  return (
    <div className="container py-5">
      <p className="small text-muted mb-3">
        <Link to="/catalogue" className="link-tap text-muted text-decoration-none">Boutique</Link>
        {product.category && <> / <Link to={`/catalogue?category=${product.category.slug}`} className="link-tap text-muted text-decoration-none">{product.category.name}</Link></>}
      </p>

      <div className="row g-5">
        <div className="col-md-6">
          {activeImage || variant?.image || product.images[0] ? (
            <div className="position-relative">
              <img
                src={activeImage || variant?.image || product.images[0]?.image}
                alt={product.name}
                className="img-fluid product-photo"
                style={{ aspectRatio: '1/1', objectFit: 'cover', width: '100%' }}
              />
              {product.is_personalizable && <EngravingPreview zone={engravingZone} text={engravingText} />}
            </div>
          ) : (
            <div className="bg-white d-flex align-items-center justify-content-center text-muted" style={{ aspectRatio: '1/1' }}>
              Pas d'image
            </div>
          )}

          {product.images.length > 1 && (
            <div className="d-flex gap-2 mt-2 flex-wrap">
              {product.images.map((img) => {
                const isActive = (activeImage || variant?.image || product.images[0]?.image) === img.image;
                return (
                  <button
                    key={img.id}
                    type="button"
                    className={`product-thumb ${isActive ? 'is-active' : ''}`}
                    onClick={() => setActiveImage(img.image)}
                    aria-label="Voir cette photo"
                    aria-pressed={isActive}
                  >
                    <img src={img.image} alt="" />
                  </button>
                );
              })}
            </div>
          )}
        </div>
        <div className="col-md-6">
          <div className="d-flex justify-content-between align-items-start">
            <h1 className="h2">{product.name}</h1>
            <button className="fav-btn btn btn-sm p-0 border-0 bg-transparent" onClick={toggleFavorite} disabled={!isAuthenticated} aria-label={isFavorite ? 'Retirer des favoris' : 'Ajouter aux favoris'} title={isAuthenticated ? undefined : 'Connectez-vous pour utiliser les favoris'}>
              {isFavorite ? <FaHeart color="#C9A227" size={22} /> : <FaRegHeart size={22} />}
            </button>
          </div>

          {reviews.summary?.count > 0 && (
            <a href="#avis" className="rating-link d-inline-flex align-items-center gap-2 text-decoration-none">
              <StarRating value={reviews.summary.average} size="1.1rem" />
              <span className="small">{String(reviews.summary.average).replace('.', ',')} ({reviews.summary.count} avis)</span>
            </a>
          )}

          {variant && (
            <p className="fs-4 fw-semibold text-gold mb-3">
              {Number(variant.price).toLocaleString('fr-FR')} FCFA
              {variant.discount_percent > 0 && (
                <span className="text-muted text-decoration-line-through fs-6 ms-2">
                  {Number(variant.old_price).toLocaleString('fr-FR')} FCFA
                </span>
              )}
            </p>
          )}

          {product.variants.length > 1 && (
            <div className="mb-3">
              <label className="form-label d-block text-uppercase small tracking-wide">Variante</label>
              <div className="d-flex gap-2 flex-wrap">
                {product.variants.map((v) => (
                  <button
                    key={v.id}
                    className={`btn btn-sm ${variant?.id === v.id ? 'btn-primary' : 'btn-outline-primary'}`}
                    onClick={() => { setVariant(v); setActiveImage(null); }}
                  >
                    {v.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <p className="text-muted">{product.description}</p>

          {product.symbolic_meaning && (
            <div className="mt-4 p-3 verse-banner">
              <h6 className="text-uppercase small tracking-wide text-gold mb-2">Signification</h6>
              <p className="mb-0 font-script fs-5">{product.symbolic_meaning}</p>
            </div>
          )}

          {product.is_personalizable && (
            <div className="mt-4">
              <label className="form-label d-block text-uppercase small tracking-wide">
                Texte de gravure (facultatif)
              </label>
              <input
                className="form-control"
                maxLength={engravingLimit}
                placeholder="Ex : Un prénom, une date, une courte phrase..."
                autoComplete="off"
                aria-describedby="engraving-help"
                value={engravingText}
                onChange={(e) => setEngravingText(e.target.value)}
              />
              <p id="engraving-help" className="form-text small text-muted mb-0">
                {engravingText.length}/{engravingLimit} caractères (lettres, chiffres, espace, apostrophe, point, tiret).{' '}
                {engravingText.trim() && !engravingZone
                  ? 'Pas d’aperçu sur cette photo : votre texte sera gravé comme demandé.'
                  : 'Aperçu indicatif — le rendu final peut légèrement varier selon le bijou.'}
              </p>
            </div>
          )}

          {addError && <div className="alert alert-danger mt-3">{addError}</div>}

          {variant && variant.stock === 0 && !variant.allow_preorder ? (
            <div className="mt-4 p-3 verse-banner">
              <p className="fw-semibold text-uppercase small tracking-wide mb-1">Rupture de stock</p>
              <WaitlistForm key={variant.id} variantId={variant.id} />
            </div>
          ) : (
            <>
              {variant?.stock === 0 && variant?.allow_preorder && (
                <p className="text-gold small mt-3 mb-0">
                  Précommande — {variant.restock_note || 'expédition différée'}.
                </p>
              )}
              <button
                className="btn btn-primary mt-3 px-4 text-uppercase small tracking-wide"
                disabled={!variant || adding}
                onClick={async () => {
                  setAddError('');
                  setAdding(true);
                  try {
                    await addVariant(variant.id, 1, false, '', engravingText.trim());
                    track('add_to_cart', { p: product.slug, v: variant.price });
                    navigate('/panier');
                  } catch (err) {
                    setAddError(errorText(err, 'Impossible d’ajouter ce produit au panier.'));
                  } finally {
                    setAdding(false);
                  }
                }}
              >
                {adding ? 'Ajout...' : variant?.stock === 0 ? 'Précommander' : 'Ajouter au panier'}
              </button>
            </>
          )}

          <div className="d-flex gap-2 mt-3">
            <a
              className="btn btn-sm btn-outline-secondary"
              target="_blank"
              rel="noopener noreferrer"
              href={`https://wa.me/?text=${encodeURIComponent(`${shareText} ${shareUrl}`)}`}
            >
              <FaWhatsapp className="me-1" /> WhatsApp
            </a>
            <a
              className="btn btn-sm btn-outline-secondary"
              target="_blank"
              rel="noopener noreferrer"
              href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`}
            >
              <FaFacebook className="me-1" /> Facebook
            </a>
            <button className="btn btn-sm btn-outline-secondary" onClick={copyLink}>
              <FaLink className="me-1" /> {linkCopied ? 'Lien copié !' : 'Copier le lien'}
            </button>
          </div>
        </div>
      </div>

      <ProductReviews product={product} reviews={reviews} />

      <div className="mt-5 pt-4 border-top">
        <Suggestions like={[product.slug]} />
      </div>
    </div>
  );
}
