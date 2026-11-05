import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import '../views/admin/admin.css';
import { AdminUiProvider } from '../views/admin/ui/AdminUi';
import useAuthStore from '../store/auth';
import { can } from '../utils/permissions';
import { allowedGroups } from './adminNav';
import StaffAlerts from '../views/admin/ui/StaffAlerts';
import AdminTour from '../views/admin/tour/AdminTour';

export default function AdminLayout() {
  const { user } = useAuthStore();
  const groups = allowedGroups((...perms) => can(user, ...perms));
  const { pathname } = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const current = groups.flatMap((group) => group.links)
    .filter((link) => pathname === link.to || (!link.end && pathname.startsWith(`${link.to}/`)))
    .sort((a, b) => b.to.length - a.to.length)[0];

  // Sur téléphone et tablette, l'en-tête et le pied de page du site laissent la place à l'Admin (CSS : body.admin-mode)
  useEffect(() => {
    document.body.classList.add('admin-mode');
    return () => document.body.classList.remove('admin-mode');
  }, []);

  useEffect(() => { setMenuOpen(false); }, [pathname]);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const onKey = (event) => { if (event.key === 'Escape') setMenuOpen(false); };
    document.body.classList.add('admin-menu-open');
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.classList.remove('admin-menu-open');
      window.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  // L'espace admin ne doit pas être référencé par les moteurs de recherche
  useEffect(() => {
    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex, nofollow';
    document.head.appendChild(meta);
    return () => meta.remove();
  }, []);

  // Sur téléphone, chaque tableau devient une liste de fiches : on recopie l'intitulé de la colonne sur chaque cellule
  // (CSS : `td::before`). Même contenu et mêmes actions que sur ordinateur.
  useEffect(() => {
    const label = () => {
      document.querySelectorAll('.admin-table').forEach((table) => {
        const heads = [...table.querySelectorAll('thead th')].map((th) => th.textContent.trim());
        table.querySelectorAll('tbody tr').forEach((row) => {
          [...row.children].forEach((cell, i) => {
            if (heads[i] && cell.getAttribute('data-label') !== heads[i]) cell.setAttribute('data-label', heads[i]);
          });
        });
      });
    };
    label();
    const observer = new MutationObserver(label);
    observer.observe(document.querySelector('.admin-shell'), { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  return (
    <AdminUiProvider>
      <div className="admin-topbar">
        <button type="button" className="admin-menu-btn" aria-expanded={menuOpen} aria-controls="admin-menu" onClick={() => setMenuOpen(true)}>
          <span aria-hidden="true">☰</span> Menu
        </button>
        <span className="admin-topbar-title">{current?.label || 'Admin'}</span>
      </div>
      <div className="admin-shell">
        <nav id="admin-menu" className={`admin-nav${menuOpen ? ' is-open' : ''}`} aria-label="Menu de l'administration">
          <div className="admin-nav-head">
            <NavLink to="/" className="admin-back">← Site</NavLink>
            <button type="button" className="admin-menu-close" onClick={() => setMenuOpen(false)}>Fermer</button>
          </div>
          {groups.map((group) => (
            <div className="admin-nav-group" key={group.title}>
              <p className="admin-nav-title">{group.title}</p>
              {group.links.map((link) => (
                <NavLink key={link.to} to={link.to} end={link.end} data-tour={link.to} onClick={() => setMenuOpen(false)}>{link.label}</NavLink>
              ))}
            </div>
          ))}
        </nav>
        <main>
          <StaffAlerts />
          <Outlet />
          <AdminTour />
        </main>
      </div>
    </AdminUiProvider>
  );
}
