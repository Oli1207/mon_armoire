import { useEffect } from 'react';

/** Agrandissement d'une photo d'avis : fermeture par Échap, clic à côté ou bouton ; flèches pour passer à la suivante. */
export default function Lightbox({ images, index, onClose, onChange }) {
  useEffect(() => {
    const onKey = (event) => {
      if (event.key === 'Escape') onClose();
      if (event.key === 'ArrowRight' && index < images.length - 1) onChange(index + 1);
      if (event.key === 'ArrowLeft' && index > 0) onChange(index - 1);
    };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [index, images.length, onClose, onChange]);

  return (
    <div className="lightbox" role="dialog" aria-modal="true" aria-label="Photo agrandie" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <button type="button" className="lightbox-close" onClick={onClose} aria-label="Fermer">×</button>
      {index > 0 && <button type="button" className="lightbox-nav lightbox-prev" onClick={() => onChange(index - 1)} aria-label="Photo précédente">‹</button>}
      <img src={images[index]} alt={`Photo ${index + 1} sur ${images.length}`} />
      {index < images.length - 1 && <button type="button" className="lightbox-nav lightbox-next" onClick={() => onChange(index + 1)} aria-label="Photo suivante">›</button>}
    </div>
  );
}
