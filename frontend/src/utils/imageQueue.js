/**
 * File d'attente de chargement d'images.
 *
 * Problème (constaté sur EthniSpirit, même hébergement LWS) : l'hébergement mutualisé refuse les connexions quand
 * un même visiteur en ouvre trop à la fois (12 en parallèle : OK ; 40 : la moitié en timeout). Un catalogue qui
 * déclenche 20 à 30 images d'un coup produit alors des images « cassées » jusqu'au rechargement.
 *
 * Solution : au plus MAX_CONCURRENT images en cours de téléchargement, les autres attendent leur tour ; une image
 * sortie de l'écran avant d'avoir démarré est abandonnée ; un échec est retenté avec un délai croissant.
 */
export const MAX_CONCURRENT = 6;
const RETRY_DELAYS = [700, 1800, 4000]; // ms : 3 nouvelles tentatives
const LOAD_TIMEOUT = 20000;             // ms : libère la place d'une image qui « pend »

let active = 0;
const waiting = [];

function pump() {
  while (active < MAX_CONCURRENT && waiting.length) {
    const entry = waiting.shift();
    active += 1;
    let released = false;
    entry.job(() => {
      if (released) return;
      released = true;
      active -= 1;
      pump();
    });
  }
}

/** Met un travail en file. `job(release)` doit appeler `release()` à la fin. Renvoie cancel(). */
export function enqueue(job) {
  const entry = { job };
  waiting.push(entry);
  pump();
  return () => {
    const index = waiting.indexOf(entry);
    if (index >= 0) waiting.splice(index, 1); // pas encore démarré : on l'oublie
  };
}

/**
 * Charge `url` dans le cache du navigateur en respectant la file et les nouvelles tentatives.
 * onLoad() quand l'image est chargée ; onGiveUp() après échec de toutes les tentatives. Renvoie cancel().
 */
export function loadQueued(url, { onLoad, onGiveUp }) {
  let cancelled = false;
  let cancelQueued = null;
  let timer = null;

  function attempt(n) {
    cancelQueued = enqueue((release) => {
      if (cancelled) { release(); return; }
      const img = new Image();
      let settled = false;
      const settle = (ok) => {
        if (settled) return;
        settled = true;
        clearTimeout(guard);
        release();
        if (cancelled) return;
        if (ok) onLoad?.();
        else if (n < RETRY_DELAYS.length) timer = setTimeout(() => attempt(n + 1), RETRY_DELAYS[n]);
        else onGiveUp?.();
      };
      const guard = setTimeout(() => { img.src = ''; settle(false); }, LOAD_TIMEOUT);
      img.onload = () => settle(true);
      img.onerror = () => settle(false);
      img.src = url;
    });
  }

  attempt(0);
  return () => {
    cancelled = true;
    clearTimeout(timer);
    cancelQueued?.();
  };
}
