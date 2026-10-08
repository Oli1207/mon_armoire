import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { FaHeart, FaRegHeart, FaWhatsapp, FaFacebook, FaLink } from 'react-icons/fa';
import { productsAPI, favoritesAPI, reviewsAPI, waitlistAPI } from '../../utils/api';
import useAuthStore from '../../store/auth';
import useCartStore from '../../store/cart';
import { useLoadMore } from '../../utils/usePaginated';

export default function ProductDetailScreen() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthStore();
  const { addVariant } = useCartStore();
  const [product, setProduct] = useState(null);
  const [variant, setVariant] = useState(null);
  const [isFavorite, setIsFavorite] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState('');
  const [linkCopied, setLinkCopied] = useState(false);
  const [activeImage, setActiveImage] = useState(null);
  const [engravingText, setEngravingText] = useState('');
  const [waitlistEmail, setWaitlistEmail] = useState('');
  const [waitlistDone, setWaitlistDone] = useState(false);
  const [waitlistError, setWaitlistError] = useState('');
  const [joiningWaitlist, setJoiningWaitlist] = useState(false);

  const [reviewForm, setReviewForm] = useState({ rating: 5, comment: '' });
  const [reviewImages, setReviewImages] = useState([]);
  const [reviewError, setReviewError] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);

  useEffect(() => {
    productsAPI.detail(slug)
      .then(({ data }) => {
        setProduct(data);
        setVariant(data.variants.find((v) => v.is_default) || data.variants[0] || null);
        setActiveImage(null);
      })
      .catch(() => setNotFound(true));
  }, [slug]);

  useEffect(() => {
    if (!isAuthenticated || !product) return;
    favoritesAPI.ids().then(({ data }) => setIsFavorite(data.includes(product.id))).catch(() => {});
  }, [isAuthenticated, product]);

  // Les avis se chargent après la fiche (ils sont en bas de page) et par pages de 10.
  const reviews = useLoadMore(
    ({ slug: productSlug, ...rest }) => reviewsAPI.list(productSlug, rest),
    { slug: product?.slug }, Boolean(product),
  );

  const handleJoinWaitlist = async () => {
    if (!waitlistEmail.trim()) return;
    setWaitlistError('');
    setJoiningWaitlist(true);
    try {
      await waitlistAPI.join({ variant: variant.id, email: waitlistEmail.trim() });
      setWaitlistDone(true);
    } catch {
      setWaitlistError("Erreur lors de l'inscription.");
    } finally {
      setJoiningWaitlist(false);
    }
  };

  const toggleFavorite = async () => {
    if (!isAuthenticated || !product) return;
    await favoritesAPI.toggle(product.id);
    setIsFavorite((v) => !v);
  };

  const handleSubmitReview = async (e) => {
    e.preventDefault();
    setReviewError('');
    setSubmittingReview(true);
    try {
      const formData = new FormData();
      formData.append('rating', reviewForm.rating);
      formData.append('comment', reviewForm.comment);
      reviewImages.forEach((file) => formData.append('images', file));
      await reviewsAPI.create(product.slug, formData);
      reviews.reload();
      setReviewForm({ rating: 5, comment: '' });
      setReviewImages([]);
    } catch (err) {
      setReviewError(err.response?.data?.error || "Erreur lors de l'envoi de votre avis.");
    } finally {
      setSubmittingReview(false);
    }
  };

  const shareUrl = typeof window !== 'undefined' ? window.location.href : '';
  const shareText = product ? `${product.name} sur Mon Armoire` : '';

  const copyLink = () => {
    navigator.clipboard?.writeText(shareUrl);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  };

  if (notFound) return <div className="container py-5">Produit introuvable.</div>;
  if (!product) return <div className="container py-5">Chargement...</div>;

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
                className="img-fluid shadow-sm"
                style={{ aspectRatio: '1/1', objectFit: 'cover', width: '100%', borderRadius: 4 }}
              />
              {product.is_personalizable && engravingText.trim() && (
                <div className="engraving-preview">
                  <span>{engravingText}</span>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white d-flex align-items-center justify-content-center text-muted" style={{ aspectRatio: '1/1', borderRadius: 4 }}>
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
                    className="p-0 border-0 bg-transparent"
                    onClick={() => setActiveImage(img.image)}
                    style={{
                      width: 64,
                      height: 64,
                      borderRadius: 4,
                      overflow: 'hidden',
                      outline: isActive ? '2px solid var(--ma-gold)' : '1px solid #e5ddd0',
                      outlineOffset: -1,
                      flexShrink: 0,
                      cursor: 'pointer',
                    }}
                  >
                    <img
                      src={img.image}
                      alt=""
                      style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                    />
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
                    onClick={() => { setVariant(v); setActiveImage(null); setWaitlistDone(false); setWaitlistEmail(''); }}
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
                maxLength={60}
                placeholder="Ex : Un prénom, une date, une courte phrase..."
                value={engravingText}
                onChange={(e) => setEngravingText(e.target.value)}
              />
              <p className="form-text small text-muted mb-0">
                Aperçu indicatif — le rendu final peut légèrement varier selon le bijou.
              </p>
            </div>
          )}

          {addError && <div className="alert alert-danger mt-3">{addError}</div>}

          {variant && variant.stock === 0 && !variant.allow_preorder ? (
            <div className="mt-4 p-3 verse-banner">
              <p className="fw-semibold text-uppercase small tracking-wide mb-1">Rupture de stock</p>
              {waitlistDone ? (
                <p className="text-success small mb-0">Vous serez averti(e) dès que ce bijou sera de nouveau disponible.</p>
              ) : (
                <>
                  <p className="text-muted small mb-2">Laissez votre email, nous vous préviendrons dès son retour.</p>
                  <div className="d-flex gap-2 flex-wrap">
                    <input
                      type="email"
                      className="form-control form-control-sm"
                      style={{ maxWidth: 220 }}
                      placeholder="Votre email"
                      value={waitlistEmail}
                      onChange={(e) => setWaitlistEmail(e.target.value)}
                    />
                    <button
                      className="btn btn-sm btn-primary text-uppercase small tracking-wide"
                      disabled={joiningWaitlist || !waitlistEmail.trim()}
                      onClick={handleJoinWaitlist}
                    >
                      {joiningWaitlist ? '...' : "M'avertir"}
                    </button>
                  </div>
                  {waitlistError && <p className="text-danger small mt-2 mb-0">{waitlistError}</p>}
                </>
              )}
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
                    navigate('/panier');
                  } catch (err) {
                    setAddError(err.response?.data?.error || "Impossible d'ajouter ce produit au panier.");
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

      <div className="row mt-5 pt-4" style={{ borderTop: '1px solid #e5ddd0' }}>
        <div className="col-md-8">
          <h2 className="h4 mb-3">Avis clients ({reviews.count})</h2>

          {reviews.error && <p className="text-danger small">{reviews.error}</p>}
          {!reviews.loading && !reviews.error && reviews.items.length === 0 && <p className="text-muted">Aucun avis pour le moment.</p>}
          {reviews.items.map((r) => (
            <div key={r.id} className="border-bottom py-3">
              <strong>{r.user_name}</strong>{' '}
              <span className="text-gold">{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}</span>
              <p className="mb-2">{r.comment}</p>
              {r.images.length > 0 && (
                <div className="d-flex gap-2" style={{ overflowX: 'auto', scrollSnapType: 'x mandatory' }}>
                  {r.images.map((img) => (
                    <img
                      key={img.id}
                      src={img.image}
                      alt="Photo client"
                      style={{ width: 90, height: 90, objectFit: 'cover', borderRadius: 4, flexShrink: 0, scrollSnapAlign: 'start' }}
                    />
                  ))}
                </div>
              )}
            </div>
          ))}

          {reviews.hasMore && (
            <div className="text-center my-3">
              <button type="button" className="btn btn-outline-primary pager-btn px-4" disabled={reviews.loadingMore} onClick={reviews.loadMore}>
                {reviews.loadingMore ? 'Chargement...' : 'Voir plus d\'avis'}
              </button>
            </div>
          )}

          {isAuthenticated ? (
            <form onSubmit={handleSubmitReview} className="mt-3">
              <div className="mb-2">
                <label className="form-label d-block">Votre note</label>
                <select
                  className="form-select form-select-sm"
                  style={{ width: 120 }}
                  value={reviewForm.rating}
                  onChange={(e) => setReviewForm({ ...reviewForm, rating: Number(e.target.value) })}
                >
                  {[5, 4, 3, 2, 1].map((n) => (
                    <option key={n} value={n}>{n} / 5</option>
                  ))}
                </select>
              </div>
              <textarea
                className="form-control mb-2"
                placeholder="Votre avis"
                value={reviewForm.comment}
                onChange={(e) => setReviewForm({ ...reviewForm, comment: e.target.value })}
              />
              <div className="mb-2">
                <label className="form-label d-block small text-muted">Ajouter des photos (facultatif, 6 max)</label>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="form-control form-control-sm"
                  onChange={(e) => setReviewImages(Array.from(e.target.files).slice(0, 6))}
                />
                {reviewImages.length > 0 && (
                  <div className="d-flex gap-2 mt-2 flex-wrap">
                    {reviewImages.map((file, i) => (
                      <img
                        key={i}
                        src={URL.createObjectURL(file)}
                        alt=""
                        style={{ width: 60, height: 60, objectFit: 'cover', borderRadius: 4 }}
                      />
                    ))}
                  </div>
                )}
              </div>
              {reviewError && <div className="alert alert-danger">{reviewError}</div>}
              <button className="btn btn-sm btn-primary" disabled={submittingReview}>
                {submittingReview ? 'Envoi...' : 'Publier mon avis'}
              </button>
            </form>
          ) : (
            <p className="text-muted small mt-3">Connecte-toi pour laisser un avis.</p>
          )}
        </div>
      </div>
    </div>
  );
}
