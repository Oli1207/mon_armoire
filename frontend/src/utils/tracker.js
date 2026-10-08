// Suivi des visites (pages vues, produits regardés, paniers, favoris, recherches), sans donnée personnelle.
// - Les événements sont regroupés (un envoi toutes les quelques secondes, ou quand l'onglet se ferme) : très peu de requêtes.
// - Rien n'est envoyé pour le personnel de la boutique ni sur les pages /admin ; « Ne pas me suivre » du navigateur est respecté.
// - Un échec d'envoi n'a jamais d'effet visible : le suivi ne doit jamais gêner un achat.
import axiosInstance from './axios';

const SID_KEY = 'ma_sid';
const FLUSH_DELAY = 4000;
const MAX_BUFFER = 20;

let buffer = [];
let timer = null;
let enabled = typeof navigator !== 'undefined' && navigator.doNotTrack !== '1';

function sessionId() {
  try {
    let sid = localStorage.getItem(SID_KEY);
    if (!sid) {
      sid = crypto.randomUUID();
      localStorage.setItem(SID_KEY, sid);
    }
    return sid;
  } catch {
    return null; // stockage bloqué (navigation privée stricte) : pas de suivi
  }
}

function meta() {
  const params = new URLSearchParams(window.location.search);
  return {
    referrer: document.referrer,
    landing: window.location.pathname,
    utm_source: params.get('utm_source') || '',
    utm_campaign: params.get('utm_campaign') || '',
  };
}

function send(unloading) {
  clearTimeout(timer);
  timer = null;
  const sid = sessionId();
  if (!sid || buffer.length === 0) return;
  const payload = { sid, events: buffer.splice(0, 25), meta: meta() };
  if (unloading) {
    // L'onglet se ferme : fetch « keepalive » survit à la fermeture (sans jeton : le personnel est déjà exclu côté navigateur).
    try {
      fetch(`${axiosInstance.defaults.baseURL}/api/track/`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), keepalive: true,
      }).catch(() => {});
    } catch { /* sans importance */ }
    return;
  }
  axiosInstance.post('/api/track/', payload).catch(() => {});
}

export function track(type, data = {}) {
  if (!enabled || window.location.pathname.startsWith('/admin')) return;
  buffer.push({ t: type, path: window.location.pathname, ...data });
  if (buffer.length >= MAX_BUFFER) send(false);
  else if (!timer) timer = setTimeout(() => send(false), FLUSH_DELAY);
}

/** Personnel connecté : on arrête le suivi et on demande au serveur d'écarter les visites déjà faites avec ce navigateur. */
export function setStaff(isStaff) {
  if (!isStaff) return;
  enabled = false;
  buffer = [];
  const sid = sessionId();
  if (sid) axiosInstance.post('/api/track/', { sid, events: [] }).catch(() => {});
}

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') send(true); });
}
