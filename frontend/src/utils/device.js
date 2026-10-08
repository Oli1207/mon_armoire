// Détection de l'appareil pour afficher la bonne marche à suivre (installation sur l'écran d'accueil, notifications).
export function detectDevice() {
  const ua = typeof navigator === 'undefined' ? '' : navigator.userAgent || '';
  const ios = /iPhone|iPad|iPod/.test(ua) || (typeof navigator !== 'undefined' && navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const android = /Android/.test(ua);
  const platform = ios ? 'ios' : android ? 'android' : 'desktop';

  let browser = 'other';
  if (ios) browser = /CriOS/.test(ua) ? 'chrome' : /FxiOS/.test(ua) ? 'firefox' : /EdgiOS/.test(ua) ? 'edge' : 'safari';
  else if (/SamsungBrowser/.test(ua)) browser = 'samsung';
  else if (/Edg\//.test(ua)) browser = 'edge';
  else if (/Firefox/.test(ua)) browser = 'firefox';
  else if (/OPR\//.test(ua)) browser = 'opera';
  else if (/Chrome/.test(ua)) browser = 'chrome';
  else if (/Safari/.test(ua)) browser = 'safari';

  // Navigateur intégré à une application (lien ouvert depuis Facebook, Instagram, TikTok…) : l'installation y est impossible
  const inApp = /FBAN|FBAV|FB_IAB|Instagram|Snapchat|TikTok|musical_ly|MicroMessenger|Twitter|Line\//.test(ua);
  const standalone = typeof window !== 'undefined' && (window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true);
  const match = ua.match(/OS (\d+)[_.](\d+)/);
  const iosVersion = ios && match ? Number(match[1]) + Number(match[2]) / 100 : null;
  return { platform, browser, inApp, standalone, iosVersion };
}

/** Clé du guide à ouvrir en premier pour cet appareil. */
export function guideKeyFor({ platform, browser }) {
  if (platform === 'ios') return 'ios-safari';
  if (platform === 'android') return { samsung: 'android-samsung', firefox: 'android-firefox', edge: 'android-edge' }[browser] || 'android-chrome';
  return { safari: 'desktop-safari', firefox: 'desktop-firefox' }[browser] || 'desktop-chromium';
}

/** iPhone/iPad où les notifications ne marchent qu'une fois l'application installée sur l'écran d'accueil. */
export const needsInstallForPush = (device) => device.platform === 'ios' && !device.standalone;
