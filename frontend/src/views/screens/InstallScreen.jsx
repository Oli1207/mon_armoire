import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { detectDevice, guideKeyFor } from '../../utils/device';
import { canPromptInstall, onInstallAvailabilityChange, promptInstall } from '../../utils/installPrompt';

const GUIDES = {
  'ios-safari': {
    title: 'iPhone ou iPad (Safari)',
    steps: [
      'Ouvrez monarmoire.store dans Safari (l’icône bleue en forme de boussole). Pas dans Chrome, ni dans Facebook ou Instagram.',
      'Touchez le bouton Partager : un carré avec une flèche qui monte. Il est en bas de l’écran (sur iPad : en haut à droite).',
      'Faites défiler le menu vers le haut et touchez « Sur l’écran d’accueil ».',
      'Touchez « Ajouter » en haut à droite.',
      'L’icône Mon Armoire apparaît sur votre écran d’accueil : ouvrez le site toujours depuis cette icône.',
    ],
    note: 'Pour recevoir les notifications sur iPhone, il faut iOS 16.4 ou plus récent et ouvrir le site depuis cette icône.',
  },
  'android-chrome': {
    title: 'Téléphone Android (Chrome)',
    steps: [
      'Ouvrez monarmoire.store dans Chrome.',
      'Touchez les trois points ⋮ en haut à droite.',
      'Touchez « Installer l’application » (ou « Ajouter à l’écran d’accueil »).',
      'Touchez « Installer », puis « Ajouter ». L’icône apparaît sur votre écran d’accueil.',
    ],
    note: 'Si vous ne voyez ni l’un ni l’autre, vérifiez que vous n’êtes pas déjà dans l’application installée.',
  },
  'android-samsung': {
    title: 'Téléphone Samsung (Samsung Internet)',
    steps: [
      'Ouvrez monarmoire.store dans Samsung Internet.',
      'Touchez le menu ≡ (trois traits) en bas à droite.',
      'Touchez « Ajouter la page à », puis « Écran d’accueil ».',
      'Touchez « Ajouter ».',
    ],
  },
  'android-firefox': {
    title: 'Téléphone Android (Firefox)',
    steps: [
      'Ouvrez monarmoire.store dans Firefox.',
      'Touchez les trois points ⋮ en haut à droite.',
      'Touchez « Installer », puis confirmez.',
    ],
  },
  'android-edge': {
    title: 'Téléphone Android (Edge)',
    steps: [
      'Ouvrez monarmoire.store dans Edge.',
      'Touchez les trois points ⋯ en bas au centre.',
      'Touchez « Ajouter au téléphone » (ou « Ajouter à l’écran d’accueil »), puis confirmez.',
    ],
  },
  'desktop-chromium': {
    title: 'Ordinateur (Chrome ou Edge)',
    steps: [
      'Ouvrez monarmoire.store.',
      'À droite de la barre d’adresse, cliquez sur l’icône d’installation (un écran avec une flèche vers le bas).',
      'Cliquez sur « Installer ». Mon Armoire s’ouvre dans sa propre fenêtre et reste dans vos applications.',
    ],
    note: 'Pas d’icône ? Ouvrez le menu ⋮ du navigateur puis « Installer Mon Armoire » ou « Enregistrer et partager » → « Installer ».',
  },
  'desktop-safari': {
    title: 'Mac (Safari)',
    steps: [
      'Ouvrez monarmoire.store dans Safari.',
      'Dans le menu en haut de l’écran, cliquez sur « Fichier », puis « Ajouter au Dock ».',
      'Cliquez sur « Ajouter ».',
    ],
    note: 'Demande macOS Sonoma (14) ou plus récent.',
  },
  'desktop-firefox': {
    title: 'Ordinateur (Firefox)',
    steps: ['Firefox sur ordinateur ne sait pas installer d’application. Utilisez Chrome ou Edge, ou ajoutez simplement le site à vos favoris (Ctrl + D).'],
  },
};

const ORDER = ['ios-safari', 'android-chrome', 'android-samsung', 'android-firefox', 'android-edge', 'desktop-chromium', 'desktop-safari', 'desktop-firefox'];

function Guide({ guide, open }) {
  return (
    <details className="install-guide" open={open}>
      <summary>{guide.title}</summary>
      <ol className="mb-2">{guide.steps.map((step, i) => <li key={i}>{step}</li>)}</ol>
      {guide.note && <p className="small text-muted mb-0">{guide.note}</p>}
    </details>
  );
}

export default function InstallScreen() {
  const [device] = useState(detectDevice);
  const [oneTouch, setOneTouch] = useState(canPromptInstall());
  const mine = guideKeyFor(device);
  useEffect(() => onInstallAvailabilityChange(() => setOneTouch(canPromptInstall())), []);

  return (
    <div className="container py-4 py-md-5" style={{ maxWidth: '44rem' }}>
      <h1 className="h2 mb-2">Installer Mon Armoire sur votre téléphone</h1>
      <p className="text-muted">
        Une icône sur votre écran d’accueil, un site plus rapide qui s’ouvre en plein écran, et les notifications : suivi de votre commande, bijou de retour en stock, verset du jour.
        C’est gratuit et ne prend presque pas de place.
      </p>

      {device.standalone && <div className="alert alert-success" role="status">✓ L’application est déjà installée sur cet appareil.</div>}

      {device.inApp && (
        <div className="alert alert-warning" role="alert">
          <strong>Vous êtes dans le navigateur d’une application (Facebook, Instagram, TikTok…).</strong> L’installation ne marche pas ici.
          Touchez les trois points (⋯ ou ⋮) en haut ou en bas de l’écran, puis « Ouvrir dans le navigateur » (Safari sur iPhone, Chrome sur Android), et revenez sur cette page.
        </div>
      )}

      {oneTouch && !device.standalone && (
        <div className="mb-4">
          <button type="button" className="btn btn-primary" onClick={async () => { await promptInstall(); setOneTouch(canPromptInstall()); }}>Installer en un geste</button>
          <p className="small text-muted mt-2 mb-0">Votre navigateur sait installer l’application directement : touchez ce bouton, puis « Installer ».</p>
        </div>
      )}

      <h2 className="h5 mt-4">Pour votre appareil</h2>
      <Guide guide={GUIDES[mine]} open />
      {device.platform === 'ios' && device.browser !== 'safari' && (
        <p className="small text-muted">Vous utilisez un autre navigateur que Safari : sur iPhone, ouvrez ce site dans Safari pour suivre ces étapes.</p>
      )}
      {device.platform === 'ios' && device.iosVersion && device.iosVersion < 16.04 && (
        <p className="small text-danger">Votre iPhone utilise une version d’iOS trop ancienne pour les notifications (iOS 16.4 minimum). Vous pouvez quand même installer l’icône.</p>
      )}

      <h2 className="h5 mt-4">Autres appareils</h2>
      {ORDER.filter((key) => key !== mine).map((key) => <Guide key={key} guide={GUIDES[key]} open={false} />)}

      <p className="mt-4"><Link to="/" className="btn btn-outline-secondary">Retour à la boutique</Link></p>
    </div>
  );
}
