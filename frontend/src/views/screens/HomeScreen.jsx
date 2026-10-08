import QueuedImage from '../../components/QueuedImage';
import { StarRating } from '../../components/Stars';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { categoriesAPI, coffretsAPI, notificationsAPI, reviewsAPI } from '../../utils/api';
import { subscribeToPush } from '../../utils/push';
import ReviewPhotoCarousel from '../../components/ReviewPhotoCarousel';
import { errorText } from '../../utils/errors';

const FALLBACK_TESTIMONIALS = [
  { id: 'f1', user_name: 'Aminata K.', rating: 5, comment: 'Des bijoux de qualité et un service incroyable ! Je ne les quitte plus.', images: [] },
  { id: 'f2', user_name: 'Christelle B.', rating: 5, comment: 'Chaque bijou me rappelle ma foi. Merci Mon Armoire !', images: [] },
  { id: 'f3', user_name: 'Mariam S.', rating: 5, comment: "J'ai offert un coffret à ma sœur et elle a tellement aimé !", images: [] },
];

const CARD_SHAPES = ['review-card--arch', 'review-card--bubble', '', 'review-card--cut'];

export default function HomeScreen() {
  const [categories, setCategories] = useState([]);
  const [coffret, setCoffret] = useState(null);
  const [verse, setVerse] = useState(null);
  const [subState, setSubState] = useState('idle');
  const [subError, setSubError] = useState('');
  const [testimonials, setTestimonials] = useState(FALLBACK_TESTIMONIALS);

  useEffect(() => {
    categoriesAPI.list().then(({ data }) => setCategories(data));
    coffretsAPI.list().then(({ data }) => setCoffret(data[0] || null));
    notificationsAPI.verseOfTheDay().then(({ data }) => setVerse(data)).catch(() => {});
    reviewsAPI.featured().then(({ data }) => {
      if (data.length > 0) setTestimonials(data);
    }).catch(() => {});
  }, []);

  const handleSubscribe = async () => {
    setSubState('loading');
    setSubError('');
    try {
      await subscribeToPush();
      setSubState('done');
    } catch (err) {
      setSubError(err.response ? errorText(err, 'L’abonnement aux notifications a échoué.') : (err.message || 'L’abonnement aux notifications a échoué.'));
      setSubState('error');
    }
  };

  // Les photos des tuiles viennent de l'API des catégories (`cover_image`) : plus besoin de charger tout le catalogue.
  const tiles = ['Chaînes', 'Bracelets', 'Chapelets', 'Médailles'].map((name) => {
    const cat = categories.find((c) => c.name === name);
    return { name, cat, image: cat?.cover_image };
  });
  const storyImage = tiles.find((t) => t.image)?.image;

  return (
    <div>
      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="hero-section py-5" style={{ '--hero-bg-image': "url('/images/hero.jpeg')" }}>
        <div className="container">
          <div className="row align-items-center g-5">
            <div className="col-lg-6">
              <p className="text-uppercase text-gold small tracking-wide mb-2">Bijoux &amp; objets chrétiens</p>
              <h1 className="display-5 mb-3">Porte ta foi<br />avec <span className="text-gold">élégance</span></h1>
              <p className="text-muted mb-4" style={{ maxWidth: 420 }}>
                Des bijoux et objets chrétiens pensés pour accompagner votre foi au quotidien.
              </p>
              <div className="d-flex gap-3 flex-wrap">
                <Link to="/catalogue" className="btn btn-primary px-4 py-2 text-uppercase small tracking-wide">
                  Découvrir les bijoux
                </Link>
                <Link to="/coffrets" className="btn btn-outline-primary px-4 py-2 text-uppercase small tracking-wide">
                  Découvrir les coffrets
                </Link>
              </div>
            </div>
            <div className="col-lg-6">
              <div className="verse-banner p-4 p-md-5 text-center">
                <p className="text-uppercase text-gold small tracking-wide mb-3">Un mot. Une promesse. Un rappel.</p>
                {verse ? (
                  <>
                    <p className="font-script fs-2 mb-2">« {verse.text} »</p>
                    <p className="text-muted mb-4">{verse.reference}</p>
                  </>
                ) : (
                  <p className="text-muted mb-4">Chargement du verset...</p>
                )}
                {subState === 'done' ? (
                  <p className="text-success small mb-0">Abonnement activé, merci !</p>
                ) : (
                  <button
                    className="btn btn-primary btn-sm text-uppercase small tracking-wide"
                    onClick={handleSubscribe}
                    disabled={subState === 'loading'}
                  >
                    {subState === 'loading' ? 'Abonnement...' : 'Recevoir mon verset du jour'}
                  </button>
                )}
                {subState === 'error' && <p className="text-danger small mt-2 mb-0">{subError}</p>}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Nos incontournables ──────────────────────────────────────────── */}
      <section className="py-5">
        <div className="container">
          <div className="text-center mb-4">
            <p className="text-uppercase text-gold small tracking-wide mb-2">Nos incontournables</p>
            <h2 className="h3">Des essentiels pour tous les jours.</h2>
          </div>
          <div className="row g-4">
            {tiles.map((tile) => (
              <div className="col-6 col-md-3" key={tile.name}>
                <Link to={tile.cat ? `/catalogue?category=${tile.cat.slug}` : '/catalogue'} className="category-tile">
                  {tile.image ? (
                    <QueuedImage src={tile.image} alt={tile.name} />
                  ) : (
                    <div className="bg-white" style={{ aspectRatio: '1/1', borderRadius: 4 }} />
                  )}
                  <p className="text-center fw-semibold mt-2 mb-0 text-uppercase small tracking-wide">{tile.name}</p>
                  <p className="text-center small text-gold mb-0">Découvrir →</p>
                </Link>
              </div>
            ))}
          </div>
          <div className="text-center mt-4">
            <Link to="/catalogue" className="link-tap small text-uppercase tracking-wide text-gold">Voir tous les bijoux →</Link>
          </div>
        </div>
      </section>

      {/* ── Aide au choix ────────────────────────────────────────────────── */}
      <section className="py-5" style={{ backgroundColor: 'var(--ma-cream)' }}>
        <div className="container">
          <div className="row g-4">
            <div className="col-md-6">
              <div className="verse-banner h-100 p-4 text-center d-flex flex-column justify-content-center">
                <p className="text-uppercase text-gold small tracking-wide mb-2">Pas sûre de votre choix ?</p>
                <h2 className="h4 mb-3">Quel objet choisir ?</h2>
                <p className="text-muted small mb-3">Répondez à 3 questions pour trouver le bijou qui vous correspond.</p>
                <Link to="/quiz" className="btn btn-outline-primary px-4 py-2 text-uppercase small tracking-wide align-self-center">
                  Faire le quiz
                </Link>
              </div>
            </div>
            <div className="col-md-6">
              <div className="verse-banner h-100 p-4 text-center d-flex flex-column justify-content-center">
                <p className="text-uppercase text-gold small tracking-wide mb-2">Un cadeau qui a du sens</p>
                <h2 className="h4 mb-3">Je cherche un cadeau</h2>
                <p className="text-muted small mb-3">Occasion et budget : on vous propose une sélection adaptée.</p>
                <Link to="/cadeau" className="btn btn-outline-primary px-4 py-2 text-uppercase small tracking-wide align-self-center">
                  Trouver un cadeau
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Histoire de la marque ────────────────────────────────────────── */}
      <section id="histoire" className="story-section py-5">
        <div className="container">
          <div className="row align-items-center g-5">
            <div className="col-lg-5">
              {storyImage ? (
                <img src={storyImage} alt="" className="story-image shadow-sm" loading="lazy" decoding="async" />
              ) : (
                <div className="story-image bg-white" />
              )}
            </div>
            <div className="col-lg-4">
              <p className="text-uppercase text-gold small tracking-wide mb-2">Mon Armoire</p>
              <h2 className="h1 mb-3">Plus qu'un bijou,<br />une conviction.</h2>
              <p className="text-muted mb-4">
                Chez Mon Armoire, nous croyons que la foi peut se porter, se partager et s'offrir.
                Chaque création est pensée comme un rappel de ce qui compte vraiment.
              </p>
              <Link to="/catalogue" className="btn btn-primary px-4 py-2 text-uppercase small tracking-wide">
                En savoir plus
              </Link>
            </div>
            <div className="col-lg-3 text-center d-none d-lg-block">
              <p className="font-script fs-3 text-gold">La foi qui inspire,</p>
              <p className="font-script fs-3">l'amour qui transforme.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Coffrets ─────────────────────────────────────────────────────── */}
      <section className="py-5">
        <div className="container">
          <div className="coffret-banner row g-0">
            <div className="col-md-5">
              {coffret?.image ? (
                <img src={coffret.image} alt={coffret.name} />
              ) : (
                <div className="bg-white h-100" />
              )}
            </div>
            <div className="col-md-7 p-4 p-md-5 d-flex flex-column justify-content-center">
              <p className="text-uppercase text-gold small tracking-wide mb-2">Coffrets Mon Armoire</p>
              <h3 className="h2 mb-2">Offrir la foi, autrement.</h3>
              <p className="mb-3">Des cadeaux qui ont du sens.</p>
              <Link to="/coffrets" className="btn btn-outline-light btn-sm text-uppercase small tracking-wide align-self-start">
                Découvrir les coffrets
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── Témoignages ──────────────────────────────────────────────────── */}
      <section id="avis" className="py-5">
        <div className="container">
          <div className="text-center mb-4">
            <p className="text-uppercase text-gold small tracking-wide mb-2">Avis clients</p>
            <h2 className="h3">Elles portent leur foi avec élégance.</h2>
          </div>
          <div className="testimonials-grid">
            {testimonials.map((t, i) => (
              <div key={t.id} className={`review-card ${CARD_SHAPES[i % CARD_SHAPES.length]}`}>
                <div className="review-header">
                  <div className="review-avatar">{t.user_name.charAt(0).toUpperCase()}</div>
                  <div>
                    <p className="fw-semibold mb-0">{t.user_name}</p>
                    <StarRating value={t.rating} size="1rem" />
                  </div>
                </div>
                <p className="review-quote-mark mb-0">”</p>
                <p className="mb-0">{t.comment}</p>
                <ReviewPhotoCarousel images={t.images} />
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
