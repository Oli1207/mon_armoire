import { lazy } from 'react';

const RELOAD_FLAG = 'ma_chunk_reload';

/**
 * React.lazy qui se remet d'un fichier introuvable : après une mise en ligne, un onglet resté ouvert réclame
 * d'anciens fichiers qui n'existent plus. On recharge la page une seule fois pour récupérer la nouvelle version.
 */
export default function lazyWithRetry(importer) {
  return lazy(async () => {
    try {
      const module = await importer();
      try { sessionStorage.removeItem(RELOAD_FLAG); } catch { /* stockage indisponible : sans importance */ }
      return module;
    } catch (error) {
      let alreadyReloaded = true;
      try {
        alreadyReloaded = sessionStorage.getItem(RELOAD_FLAG) === '1';
        if (!alreadyReloaded) sessionStorage.setItem(RELOAD_FLAG, '1');
      } catch { /* stockage indisponible : on laisse l'ErrorBoundary prendre le relais */ }
      if (!alreadyReloaded) {
        window.location.reload();
        return new Promise(() => {}); // la page se recharge : on n'affiche rien entre-temps
      }
      throw error;
    }
  });
}
