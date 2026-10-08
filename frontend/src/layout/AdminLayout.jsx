import { useEffect } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import '../views/admin/admin.css';
import { AdminUiProvider } from '../views/admin/ui/AdminUi';

const GROUPS = [
  {
    title: 'Boutique',
    links: [
      { to: '/admin', label: "Vue d'ensemble", end: true },
      { to: '/admin/commandes', label: 'Commandes' },
      { to: '/admin/clients', label: 'Clients' },
    ],
  },
  {
    title: 'Catalogue',
    links: [
      { to: '/admin/produits', label: 'Produits' },
      { to: '/admin/categories', label: 'Catégories' },
      { to: '/admin/coffrets', label: 'Coffrets' },
      { to: '/admin/occasions', label: 'Occasions' },
      { to: '/admin/symboles', label: 'Guide des symboles' },
      { to: '/admin/lookbook', label: 'Lookbook' },
    ],
  },
  {
    title: 'Clientes',
    links: [
      { to: '/admin/avis', label: 'Avis' },
      { to: '/admin/cartes-cadeaux', label: 'Cartes cadeaux' },
      { to: '/admin/liste-attente', label: "Liste d'attente" },
    ],
  },
  {
    title: 'Réglages',
    links: [
      { to: '/admin/livraison', label: 'Livraison' },
      { to: '/admin/versets', label: 'Versets' },
    ],
  },
];

export default function AdminLayout() {
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
      <div className="admin-shell">
        <nav className="admin-nav" aria-label="Menu de l'administration">
          <NavLink to="/" className="admin-back">← Site</NavLink>
          {GROUPS.map((group) => (
            <div className="admin-nav-group" key={group.title}>
              <p className="admin-nav-title">{group.title}</p>
              {group.links.map((link) => (
                <NavLink key={link.to} to={link.to} end={link.end}>{link.label}</NavLink>
              ))}
            </div>
          ))}
        </nav>
        <main>
          <Outlet />
        </main>
      </div>
    </AdminUiProvider>
  );
}
