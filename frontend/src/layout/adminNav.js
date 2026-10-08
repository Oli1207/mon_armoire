// Menu de l'Admin. `perms` = droits (un seul suffit) nécessaires pour voir l'écran ; le serveur revérifie de toute façon.
export const ADMIN_GROUPS = [
  {
    title: 'Boutique',
    links: [
      { to: '/admin', label: "Vue d'ensemble", end: true, perms: ['analytics'] },
      { to: '/admin/commandes', label: 'Commandes', perms: ['orders'] },
      { to: '/admin/clients', label: 'Clients', perms: ['customers'] },
      { to: '/admin/visiteurs', label: 'Visiteurs', perms: ['analytics'] },
    ],
  },
  {
    title: 'Catalogue',
    links: [
      { to: '/admin/produits', label: 'Produits', perms: ['catalog'] },
      { to: '/admin/categories', label: 'Catégories', perms: ['catalog'] },
      { to: '/admin/coffrets', label: 'Coffrets', perms: ['catalog'] },
      { to: '/admin/occasions', label: 'Occasions', perms: ['catalog'] },
      { to: '/admin/symboles', label: 'Guide des symboles', perms: ['catalog'] },
      { to: '/admin/lookbook', label: 'Lookbook', perms: ['catalog'] },
    ],
  },
  {
    title: 'Clientes',
    links: [
      { to: '/admin/avis', label: 'Avis', perms: ['reviews'] },
      { to: '/admin/cartes-cadeaux', label: 'Cartes cadeaux', perms: ['giftcards'] },
      { to: '/admin/liste-attente', label: "Liste d'attente", perms: ['waitlist'] },
    ],
  },
  {
    title: 'Réglages',
    links: [
      { to: '/admin/site', label: 'Textes et contacts', perms: ['settings'] },
      { to: '/admin/livraison', label: 'Livraison', perms: ['settings'] },
      { to: '/admin/versets', label: 'Versets', perms: ['settings'] },
    ],
  },
  {
    title: 'Propriétaire',
    links: [
      { to: '/admin/equipe', label: 'Équipe', perms: ['team'] },
      { to: '/admin/journal', label: 'Journal', perms: ['journal'] },
    ],
  },
  {
    title: 'Aide',
    links: [{ to: '/admin/aide', label: 'Guide pas à pas', always: true }],
  },
];

export const allowedGroups = (can) => ADMIN_GROUPS
  .map((group) => ({ ...group, links: group.links.filter((link) => link.always || can(...link.perms)) }))
  .filter((group) => group.links.length > 0);
