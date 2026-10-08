import { NavLink, Outlet, Link } from 'react-router-dom';

const linkClass = ({ isActive }) =>
  `list-group-item list-group-item-action ${isActive ? 'active' : ''}`;

export default function AdminLayout() {
  return (
    <div className="container-fluid py-4">
      <div className="row">
        <div className="col-md-3 col-lg-2 mb-4">
          <Link to="/" className="d-block mb-3 text-decoration-none fw-semibold">← Retour au site</Link>
          <div className="list-group">
            <NavLink to="/admin" end className={linkClass}>Vue d'ensemble</NavLink>
            <NavLink to="/admin/commandes" className={linkClass}>Commandes</NavLink>
            <NavLink to="/admin/clients" className={linkClass}>Clients</NavLink>
            <NavLink to="/admin/produits" className={linkClass}>Produits</NavLink>
            <NavLink to="/admin/coffrets" className={linkClass}>Coffrets</NavLink>
            <NavLink to="/admin/avis" className={linkClass}>Avis</NavLink>
            <NavLink to="/admin/cartes-cadeaux" className={linkClass}>Cartes cadeaux</NavLink>
            <NavLink to="/admin/liste-attente" className={linkClass}>Liste d'attente</NavLink>
            <NavLink to="/admin/versets" className={linkClass}>Versets</NavLink>
          </div>
        </div>
        <div className="col-md-9 col-lg-10">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
