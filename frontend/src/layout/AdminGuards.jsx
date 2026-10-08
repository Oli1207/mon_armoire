import { Link, Navigate } from 'react-router-dom';
import useAuthStore from '../store/auth';
import { can } from '../utils/permissions';
import { allowedGroups } from './adminNav';

/** Affiche l'écran seulement si le rôle le permet (le serveur refuse de toute façon les actions non permises). */
export function Need({ perms, children }) {
  const { user } = useAuthStore();
  if (can(user, ...perms)) return children;
  return (
    <div className="admin-card text-center" role="alert">
      <h1 className="h4">Cet écran n’est pas disponible pour votre rôle</h1>
      <p className="mb-3">Si vous en avez besoin, demandez à la propriétaire du site de vous donner ce droit (écran « Équipe »).</p>
      <Link to="/admin" className="btn btn-primary">Revenir à l’accueil de l’Admin</Link>
    </div>
  );
}

/** Page d'accueil de l'Admin : la vue d'ensemble si permise, sinon le premier écran autorisé. */
export function AdminHome({ overview }) {
  const { user } = useAuthStore();
  if (can(user, 'analytics')) return overview;
  const first = allowedGroups((...perms) => can(user, ...perms)).flatMap((g) => g.links).find((link) => !link.always);
  if (first) return <Navigate to={first.to} replace />;
  return (
    <div className="admin-card text-center" role="alert">
      <h1 className="h4">Aucun accès pour le moment</h1>
      <p className="mb-0">Votre compte n’a encore aucun droit dans l’Admin. Demandez à la propriétaire du site de vous en donner.</p>
    </div>
  );
}
