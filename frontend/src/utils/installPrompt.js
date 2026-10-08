// Garde l'invitation d'installation du navigateur (Chrome, Edge, Samsung Internet sur Android et ordinateur).
// Elle n'est émise qu'une fois, au chargement : on la conserve pour pouvoir proposer le bouton « Installer » plus tard (page /installer).
let deferred = null;
const listeners = new Set();

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferred = event;
    listeners.forEach((fn) => fn());
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    listeners.forEach((fn) => fn());
  });
}

export const canPromptInstall = () => deferred !== null;

export function onInstallAvailabilityChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export async function promptInstall() {
  if (!deferred) return false;
  deferred.prompt();
  const { outcome } = await deferred.userChoice;
  deferred = null;
  listeners.forEach((fn) => fn());
  return outcome === 'accepted';
}
