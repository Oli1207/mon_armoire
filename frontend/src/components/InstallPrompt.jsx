import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { detectDevice } from '../utils/device';
import { canPromptInstall, onInstallAvailabilityChange, promptInstall } from '../utils/installPrompt';

const DISMISS_KEY = 'ma_install_dismissed';

const readDismissed = () => {
  try { return Boolean(localStorage.getItem(DISMISS_KEY)); } catch { return false; }
};

export default function InstallPrompt() {
  const { pathname } = useLocation();
  const [device] = useState(detectDevice);
  const [dismissed, setDismissed] = useState(readDismissed);
  const [available, setAvailable] = useState(canPromptInstall());
  useEffect(() => onInstallAvailabilityChange(() => setAvailable(canPromptInstall())), []);

  if (dismissed || device.standalone || device.inApp || pathname === '/installer' || pathname.startsWith('/admin')) return null;
  const iosHint = device.platform === 'ios' && device.browser === 'safari';
  if (!available && !iosHint) return null;

  const dismiss = () => {
    setDismissed(true);
    try { localStorage.setItem(DISMISS_KEY, '1'); } catch { /* stockage indisponible : la bannière reviendra */ }
  };

  return (
    <div className="install-prompt" role="region" aria-label="Installer l’application">
      <div className="container d-flex align-items-center justify-content-between gap-3 py-2 flex-wrap">
        <span className="small">
          {iosHint
            ? 'Installez Mon Armoire sur votre iPhone : touchez Partager puis « Sur l’écran d’accueil ».'
            : 'Installez Mon Armoire sur votre téléphone pour un accès plus rapide.'}
        </span>
        <div className="d-flex gap-2 align-items-center">
          {available
            ? <button type="button" className="btn btn-sm btn-primary text-uppercase small tracking-wide" onClick={promptInstall}>Installer</button>
            : <Link to="/installer" className="btn btn-sm btn-primary text-uppercase small tracking-wide">Voir comment</Link>}
          <button type="button" className="btn btn-sm btn-outline-secondary" onClick={dismiss} aria-label="Fermer">×</button>
        </div>
      </div>
    </div>
  );
}
