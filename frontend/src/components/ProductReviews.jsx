import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { reviewsAPI } from '../utils/api';
import useAuthStore from '../store/auth';
import { StarInput, StarRating } from './Stars';
import Lightbox from './Lightbox';

const MAX_PHOTOS = 6;
const MAX_PHOTO_MB = 5;
const MAX_COMMENT = 1500;

const frNumber = (value) => String(value).replace('.', ',');
const formatDate = (iso) => new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });

function Summary({ summary }) {
  const max = Math.max(1, ...Object.values(summary.distribution));
  return (
    <div className="review-summary">
      <div className="review-summary-score">
        <div className="review-score-number">{frNumber(summary.average)}</div>
        <StarRating value={summary.average} size="1.5rem" />
        <p className="small mb-0 mt-2">Basé sur {summary.count} avis</p>
      </div>
      <div className="review-summary-bars" aria-label="Répartition des notes">
        {[5, 4, 3, 2, 1].map((stars) => {
          const n = summary.distribution[String(stars)] || 0;
          return (
            <div className="rating-row" key={stars}>
              <span className="rating-row-label">{stars} ★</span>
              <span className="rating-bar" role="presentation"><span className="rating-bar-fill" style={{ width: `${(n / max) * 100}%` }} /></span>
              <span className="rating-row-count">{n}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ReviewCard({ review, onOpenPhoto }) {
  return (
    <article className="review-item">
      <header className="d-flex align-items-center gap-3 mb-2">
        <div className="review-avatar" aria-hidden="true">{review.user_name.charAt(0).toUpperCase()}</div>
        <div className="flex-grow-1">
          <div className="fw-bold">{review.user_name}</div>
          <div className="small text-muted">{formatDate(review.created_at)}</div>
        </div>
        <StarRating value={review.rating} />
      </header>
      {review.comment && <p className="mb-0" style={{ whiteSpace: 'pre-line' }}>{review.comment}</p>}
      {review.images.length > 0 && (
        <div className="review-photos">
          {review.images.map((img, i) => (
            <button key={img.id} type="button" className="review-photo" onClick={() => onOpenPhoto(review.images.map((x) => x.image), i)} aria-label={`Agrandir la photo ${i + 1}`}>
              <img src={img.image} alt="" loading="lazy" />
            </button>
          ))}
        </div>
      )}
    </article>
  );
}

function ReviewForm({ product, onPublished }) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [photos, setPhotos] = useState([]);
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const previews = useMemo(() => photos.map((file) => URL.createObjectURL(file)), [photos]);

  useEffect(() => () => previews.forEach((url) => URL.revokeObjectURL(url)), [previews]);

  const addPhotos = (event) => {
    const chosen = Array.from(event.target.files || []);
    event.target.value = '';
    setError('');
    const tooBig = chosen.find((f) => f.size > MAX_PHOTO_MB * 1024 * 1024);
    if (tooBig) { setError(`Chaque photo doit faire ${MAX_PHOTO_MB} Mo au maximum.`); return; }
    if (photos.length + chosen.length > MAX_PHOTOS) setError(`Vous pouvez ajouter ${MAX_PHOTOS} photos au maximum.`);
    setPhotos((current) => [...current, ...chosen].slice(0, MAX_PHOTOS));
  };

  const submit = async (event) => {
    event.preventDefault();
    if (!rating) { setError('Choisissez une note en touchant les étoiles.'); return; }
    setError('');
    setSending(true);
    try {
      const data = new FormData();
      data.append('rating', rating);
      data.append('comment', comment);
      photos.forEach((file) => data.append('images', file));
      await reviewsAPI.create(product.slug, data);
      setDone(true);
      setRating(0); setComment(''); setPhotos([]);
      onPublished();
    } catch (err) {
      const body = err.response?.data;
      const first = body && typeof body === 'object' && !body.error ? Object.values(body)[0] : null;
      setError(body?.error || (Array.isArray(first) ? first[0] : null) || "Votre avis n'a pas pu être envoyé. Réessayez dans un instant.");
    } finally {
      setSending(false);
    }
  };

  if (done) {
    return (
      <div className="review-form-card text-center">
        <StarRating value={5} size="1.8rem" label={false} />
        <h3 className="h4 mt-2">Merci pour votre avis !</h3>
        <p className="mb-0">Il est publié ci-dessus. Il aidera d'autres clientes à choisir.</p>
      </div>
    );
  }

  return (
    <form className="review-form-card" onSubmit={submit} noValidate>
      <h3 className="h4">Votre avis compte</h3>
      <p className="small mb-3">Vous avez acheté ou reçu « {product.name} » ? Dites-nous ce que vous en pensez.</p>

      <div className="mb-3">
        <span className="field-label d-block mb-1">Votre note</span>
        <StarInput value={rating} onChange={setRating} />
      </div>

      <div className="mb-3">
        <label className="field-label" htmlFor="review-comment">Votre commentaire (facultatif)</label>
        <textarea
          id="review-comment" className="form-control" rows={4} maxLength={MAX_COMMENT}
          placeholder="La qualité, la finition, le sens que ce bijou a pour vous…"
          value={comment} onChange={(e) => setComment(e.target.value)}
        />
        <div className="small text-end text-muted">{comment.length} / {MAX_COMMENT}</div>
      </div>

      <div className="mb-3">
        <span className="field-label d-block mb-1">Photos (facultatif, {MAX_PHOTOS} maximum)</span>
        {previews.length > 0 && (
          <div className="review-previews">
            {previews.map((url, i) => (
              <div className="review-preview" key={url}>
                <img src={url} alt="" />
                <button type="button" aria-label="Retirer cette photo" onClick={() => setPhotos((current) => current.filter((_, index) => index !== i))}>×</button>
              </div>
            ))}
          </div>
        )}
        {photos.length < MAX_PHOTOS && (
          <label className="file-drop mb-0" style={{ position: 'relative' }}>
            + Ajouter des photos
            <input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={addPhotos} />
          </label>
        )}
      </div>

      {error && <div className="alert alert-danger" role="alert">{error}</div>}
      <button type="submit" className="btn btn-primary px-4" disabled={sending}>{sending ? 'Envoi…' : 'Publier mon avis'}</button>
    </form>
  );
}

/** Section « Avis clients » d'une fiche produit : résumé des notes, avis, formulaire. */
export default function ProductReviews({ product, reviews }) {
  const { isAuthenticated } = useAuthStore();
  const [lightbox, setLightbox] = useState(null); // { images, index }
  const listTop = useRef(null);

  const summary = reviews.summary;
  const hasReviews = summary && summary.count > 0;

  return (
    <section id="avis" className="mt-5 pt-5 reviews-section" ref={listTop}>
      <div className="text-center mb-4">
        <p className="text-uppercase text-gold small tracking-wide mb-1">Elles en parlent</p>
        <h2 className="h2 mb-0">Avis clients</h2>
      </div>

      <div className="mx-auto" style={{ maxWidth: '46rem' }}>
        {reviews.error && <div className="alert alert-danger" role="alert">{reviews.error}</div>}

        {hasReviews ? (
          <>
            <Summary summary={summary} />
            <div className="review-list">
              {reviews.items.map((review) => (
                <ReviewCard key={review.id} review={review} onOpenPhoto={(images, index) => setLightbox({ images, index })} />
              ))}
            </div>
            {reviews.hasMore && (
              <div className="text-center my-3">
                <button type="button" className="btn btn-outline-primary pager-btn px-4" disabled={reviews.loadingMore} onClick={reviews.loadMore}>
                  {reviews.loadingMore ? 'Chargement…' : "Voir plus d'avis"}
                </button>
              </div>
            )}
          </>
        ) : (
          !reviews.loading && !reviews.error && (
            <div className="review-empty">
              <StarRating value={0} size="1.6rem" label={false} />
              <p className="mb-0 mt-2">Aucun avis pour le moment. Soyez la première à partager votre expérience !</p>
            </div>
          )
        )}

        <div className="mt-4">
          {isAuthenticated ? (
            <ReviewForm product={product} onPublished={reviews.reload} />
          ) : (
            <div className="review-form-card text-center">
              <h3 className="h4">Vous avez ce bijou ?</h3>
              <p>Connectez-vous pour laisser votre avis et vos photos.</p>
              <Link to="/login" className="btn btn-primary px-4">Me connecter</Link>
            </div>
          )}
        </div>
      </div>

      {lightbox && (
        <Lightbox
          images={lightbox.images} index={lightbox.index}
          onClose={() => setLightbox(null)} onChange={(index) => setLightbox((current) => ({ ...current, index }))}
        />
      )}
    </section>
  );
}
