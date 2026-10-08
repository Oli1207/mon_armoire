import { useLocation, useNavigate } from 'react-router-dom';

// Page de repli quand il n'y a rien à « reculer » (lien partagé sur WhatsApp, onglet neuf…)
function fallbackFor(pathname) {
  if (pathname.startsWith('/produits/')) return '/catalogue';
  if (pathname.startsWith('/coffrets/')) return '/coffrets';
  if (pathname === '/checkout') return '/panier';
  return '/';
}

/** Bouton « Retour » en haut de page, sur téléphone seulement (le bureau a le bouton du navigateur). Absent de l'accueil et de l'Admin. */
export default function BackBar() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  if (pathname === '/' || pathname.startsWith('/admin')) return null;

  const goBack = () => {
    if (window.history.state?.idx > 0) navigate(-1);
    else navigate(fallbackFor(pathname), { replace: true });
  };

  return (
    <div className="back-bar d-md-none">
      <button type="button" className="back-bar-btn" onClick={goBack} aria-label="Revenir à la page précédente">
        <span aria-hidden="true">←</span> Retour
      </button>
    </div>
  );
}
