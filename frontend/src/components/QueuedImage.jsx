import { useEffect, useRef, useState } from 'react';
import { loadQueued } from '../utils/imageQueue';

/**
 * <img> qui ne télécharge que lorsqu'elle approche de l'écran, à son tour dans la file (6 images à la fois),
 * avec nouvelles tentatives automatiques. À utiliser pour les listes (catalogue, accueil, favoris) ; les images
 * « héros » et les vignettes isolées restent de simples <img>. Voir utils/imageQueue.js.
 */
export default function QueuedImage({ src, alt = '', ...imgProps }) {
  const ref = useRef(null);
  const doneRef = useRef(null); // src déjà chargée : pas de rechargement en re-défilant
  const [readySrc, setReadySrc] = useState(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || !src) return undefined;
    let cancel = null;
    const finish = () => { doneRef.current = src; setReadySrc(src); };
    const start = () => {
      if (cancel || doneRef.current === src) return;
      cancel = loadQueued(src, { onLoad: finish, onGiveUp: finish }); // abandon : le navigateur réessaie nativement
    };
    const stop = () => { if (cancel) { cancel(); cancel = null; } };

    if (typeof IntersectionObserver === 'undefined') { // très vieux navigateurs : chargement direct
      finish();
      return undefined;
    }
    const observer = new IntersectionObserver(
      ([entry]) => (entry.isIntersecting ? start() : stop()),
      { rootMargin: '300px 0px' },
    );
    observer.observe(el);
    return () => { observer.disconnect(); stop(); };
  }, [src]);

  const ready = readySrc === src;
  return <img ref={ref} src={ready ? src : undefined} alt={ready ? alt : ''} decoding="async" {...imgProps} />;
}
