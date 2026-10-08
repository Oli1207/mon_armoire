import { useState } from 'react';

export default function ReviewPhotoCarousel({ images }) {
  const [index, setIndex] = useState(0);

  if (!images || images.length === 0) return null;

  const prev = (e) => {
    e.stopPropagation();
    setIndex((i) => (i - 1 + images.length) % images.length);
  };
  const next = (e) => {
    e.stopPropagation();
    setIndex((i) => (i + 1) % images.length);
  };

  return (
    <div className="review-photo-carousel">
      <div className="review-photo-track" style={{ transform: `translateX(-${index * 100}%)` }}>
        {images.map((img) => (
          <img key={img.id} src={img.image} alt="Photo cliente" />
        ))}
      </div>
      {images.length > 1 && (
        <>
          <button type="button" className="carousel-arrow carousel-arrow-left" onClick={prev} aria-label="Photo précédente">‹</button>
          <button type="button" className="carousel-arrow carousel-arrow-right" onClick={next} aria-label="Photo suivante">›</button>
          <div className="carousel-dots">
            {images.map((_, i) => (
              <span key={i} className={i === index ? 'active' : ''} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
