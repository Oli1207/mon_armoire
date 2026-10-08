import { useState } from 'react';
import { FaStar } from 'react-icons/fa';

const LABELS = ['', 'Décevant', 'Moyen', 'Bien', 'Très bien', 'Excellent'];

const frNumber = (value) => String(value).replace('.', ',');

/** Étoiles en lecture seule, avec remplissage fractionnaire (4,5 → quatre étoiles et demie). */
export function StarRating({ value = 0, size = '1rem', label = true }) {
  const percent = Math.max(0, Math.min(5, Number(value) || 0)) / 5 * 100;
  const row = (color) => (
    <span style={{ display: 'inline-flex', gap: '0.12em', color }}>
      {[1, 2, 3, 4, 5].map((n) => <FaStar key={n} aria-hidden="true" style={{ flexShrink: 0 }} />)}
    </span>
  );
  return (
    <span
      className="stars"
      role={label ? 'img' : undefined}
      aria-label={label ? `Note : ${frNumber(value)} sur 5` : undefined}
      aria-hidden={label ? undefined : true}
      style={{ position: 'relative', display: 'inline-block', lineHeight: 1, fontSize: size, verticalAlign: 'middle' }}
    >
      {row('#d8cfbe')}
      <span style={{ position: 'absolute', inset: 0, width: `${percent}%`, overflow: 'hidden', whiteSpace: 'nowrap' }}>
        {row('var(--ma-gold)')}
      </span>
    </span>
  );
}

/** Choix d'une note de 1 à 5 : survol, clavier (flèches) et lecteurs d'écran. */
export function StarInput({ value, onChange, size = '2rem' }) {
  const [hover, setHover] = useState(0);
  const shown = hover || value;

  const onKeyDown = (event) => {
    if (event.key === 'ArrowRight' || event.key === 'ArrowUp') { event.preventDefault(); onChange(Math.min(5, (value || 0) + 1)); }
    if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') { event.preventDefault(); onChange(Math.max(1, (value || 2) - 1)); }
  };

  return (
    <div className="d-flex align-items-center gap-3 flex-wrap">
      <div role="radiogroup" aria-label="Votre note" className="d-inline-flex" onMouseLeave={() => setHover(0)} onKeyDown={onKeyDown}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            aria-label={`${n} étoile${n > 1 ? 's' : ''} : ${LABELS[n]}`}
            tabIndex={value === n || (!value && n === 1) ? 0 : -1}
            className="star-btn"
            style={{ fontSize: size, color: n <= shown ? 'var(--ma-gold)' : '#d8cfbe' }}
            onMouseEnter={() => setHover(n)}
            onClick={() => onChange(n)}
          >
            <FaStar aria-hidden="true" />
          </button>
        ))}
      </div>
      <span className="star-label" aria-live="polite">{shown ? LABELS[shown] : 'Touchez une étoile'}</span>
    </div>
  );
}
