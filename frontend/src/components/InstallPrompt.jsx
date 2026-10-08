import { useEffect, useState } from 'react';

const DISMISS_KEY = 'ma_install_dismissed';

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
    if (isStandalone || localStorage.getItem(DISMISS_KEY)) return;

    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setVisible(true);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const dismiss = () => {
    setVisible(false);
    localStorage.setItem(DISMISS_KEY, '1');
  };

  const install = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="install-prompt">
      <div className="container d-flex align-items-center justify-content-between gap-3 py-2 flex-wrap">
        <span className="small">Installez Mon Armoire sur votre téléphone pour un accès plus rapide.</span>
        <div className="d-flex gap-2">
          <button className="btn btn-sm btn-primary text-uppercase small tracking-wide" onClick={install}>
            Installer
          </button>
          <button className="btn btn-sm btn-outline-secondary" onClick={dismiss} aria-label="Fermer">
            ×
          </button>
        </div>
      </div>
    </div>
  );
}
