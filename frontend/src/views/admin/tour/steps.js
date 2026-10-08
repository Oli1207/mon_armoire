// Étapes du didactiel de l'Admin. Chaque étape n'est montrée qu'aux personnes ayant l'un des droits `perms` (sans `perms` : toutes).
// `route` : l'écran à ouvrir pendant l'étape ; `target` : l'élément à entourer en doré (sélecteur CSS).
const nav = (path) => `.admin-nav a[data-tour="${path}"]`;

const STEPS = [
  {
    id: 'welcome',
    title: ({ role }) => `Bienvenue dans l’Admin (${role})`,
    body: ({ role, owner }) => `Ce petit tour dure deux minutes : il vous montre où faire chaque chose. Votre rôle est « ${role} »${owner ? ' : vous avez tous les droits.' : ' : vous ne voyez que les écrans que ce rôle permet.'} Vous pouvez le passer maintenant et le revoir quand vous voulez (menu Aide).`,
  },
  {
    id: 'menu',
    target: '.admin-nav',
    title: () => 'Le menu',
    body: () => 'Chaque écran de l’Admin est dans ce menu (sur téléphone : le bandeau du haut, que l’on fait glisser vers la gauche). Le bouton « ← Site » vous ramène à la boutique, telle que la voit une cliente.',
  },
  {
    id: 'save',
    title: () => 'Comment ça s’enregistre',
    body: () => 'Dans la plupart des cases, tapez puis cliquez en dehors : un message vert « Enregistré » confirme. Un message rouge explique ce qui ne va pas et quoi faire. Les actions définitives (supprimer, annuler une commande) demandent toujours une confirmation.',
  },
  {
    id: 'alerts',
    perms: ['orders', 'catalog', 'reviews', 'waitlist'],
    target: '.admin-alerts',
    title: () => 'Les alertes en direct',
    body: () => 'Ce bandeau active les notifications sur l’appareil que vous utilisez : nouvelle commande payée, stock faible, nouvel avis, nouvelle inscription en attente (selon votre rôle). À faire une fois sur chaque appareil. Sur iPhone, il faut d’abord installer l’application sur l’écran d’accueil (page « Installer l’application »).',
  },
  {
    id: 'overview',
    perms: ['analytics'],
    route: '/admin',
    target: nav('/admin'),
    title: () => 'Vue d’ensemble',
    body: () => 'Le tableau de bord : en haut ce qui est à faire (commandes payées à préparer), puis le chiffre d’affaires, le panier moyen, les meilleures ventes et les bijoux à surveiller (stock faible).',
  },
  {
    id: 'orders',
    perms: ['orders'],
    route: '/admin/commandes',
    target: nav('/admin/commandes'),
    title: () => 'Commandes',
    body: ({ can }) => `« Payée » = à préparer. Cliquez sur « Détails » pour voir les articles, la gravure, l’emballage cadeau, l’adresse et le téléphone. Le mot « Gravure à faire » signale une commande personnalisée. ${can('orders_manage') ? 'Changez le statut dans la colonne « Changer » : chaque changement envoie un e-mail à la cliente, choisissez donc le bon statut du premier coup.' : 'Votre rôle permet de consulter les commandes, pas de changer leur statut.'}`,
  },
  {
    id: 'customers',
    perms: ['customers'],
    route: '/admin/clients',
    target: nav('/admin/clients'),
    title: () => 'Clients',
    body: () => 'La liste des clientes inscrites. « Voir » ouvre sa fiche : adresses, commandes, panier, favoris et, si votre rôle le permet, ses derniers gestes sur le site.',
  },
  {
    id: 'visitors',
    perms: ['analytics'],
    route: '/admin/visiteurs',
    target: nav('/admin/visiteurs'),
    title: () => 'Visiteurs',
    body: () => 'Ce que font les personnes sur le site : combien viennent, quels bijoux elles regardent, ce qu’elles cherchent, dans quels quartiers elles commandent, et leurs paniers en cours ou abandonnés. Vos propres visites ne sont jamais comptées.',
  },
  {
    id: 'products',
    perms: ['catalog'],
    route: '/admin/produits',
    target: nav('/admin/produits'),
    title: () => 'Produits',
    body: () => '« + Nouveau produit » pour ajouter un bijou. L’interrupteur « Visible » cache un bijou du site sans le supprimer. Dans la fiche d’un produit : les photos, les variantes (prix et stock) et, pour une gravure, la zone où le texte apparaît sur la photo.',
  },
  {
    id: 'catalog-more',
    perms: ['catalog'],
    route: '/admin/coffrets',
    target: nav('/admin/coffrets'),
    title: () => 'Coffrets, catégories, occasions, symboles, lookbook',
    body: () => 'Même principe pour le reste du catalogue : un coffret regroupe des articles (avec ou sans choix pour la cliente) ; les catégories rangent les bijoux ; les occasions alimentent « Je cherche un cadeau » ; le guide des symboles et le lookbook inspirent les clientes.',
  },
  {
    id: 'reviews',
    perms: ['reviews'],
    route: '/admin/avis',
    target: nav('/admin/avis'),
    title: () => 'Avis',
    body: () => 'Les avis sont publiés tout de suite. Décochez « Visible » pour en cacher un, cochez « En avant » pour l’afficher sur la page d’accueil.',
  },
  {
    id: 'giftcards',
    perms: ['giftcards'],
    route: '/admin/cartes-cadeaux',
    target: nav('/admin/cartes-cadeaux'),
    title: () => 'Cartes cadeaux',
    body: () => 'Les cartes vendues avec leur solde restant. Le code part par e-mail à l’acheteuse dès que le paiement est confirmé. Cet écran sert à consulter.',
  },
  {
    id: 'waitlist',
    perms: ['waitlist'],
    route: '/admin/liste-attente',
    target: nav('/admin/liste-attente'),
    title: () => 'Liste d’attente',
    body: () => 'Les personnes qui attendent un bijou en rupture, avec leur e-mail et leur téléphone. Au retour en stock, l’e-mail part tout seul. Pour relancer à la main, cliquez sur « WhatsApp » ou « Appeler », puis cochez « Relancée ».',
  },
  {
    id: 'delivery',
    perms: ['settings'],
    route: '/admin/livraison',
    target: nav('/admin/livraison'),
    title: () => 'Livraison',
    body: () => 'Les zones, tarifs et délais proposés au moment de commander. Pour arrêter de livrer une zone, masquez-la : les anciennes commandes gardent leur tarif.',
  },
  {
    id: 'site',
    perms: ['settings'],
    route: '/admin/site',
    target: nav('/admin/site'),
    title: () => 'Textes et contacts',
    body: () => 'Le bandeau du haut, la grande bannière d’accueil, le pied de page, le téléphone, WhatsApp, les réseaux sociaux, les conditions générales et l’e-mail qui reçoit les alertes. Tout se change ici, sans aide technique.',
  },
  {
    id: 'verses',
    perms: ['settings'],
    route: '/admin/versets',
    target: nav('/admin/versets'),
    title: () => 'Versets',
    body: () => 'Le verset du jour est choisi automatiquement. Dans « Cette semaine », remplacez-le pour une date précise ; dans « Bibliothèque », ajoutez ou retirez des versets.',
  },
  {
    id: 'team',
    perms: ['team'],
    route: '/admin/equipe',
    target: nav('/admin/equipe'),
    title: () => 'Équipe (propriétaire)',
    body: () => 'Invitez une collaboratrice par e-mail et choisissez son rôle : elle choisit elle-même son mot de passe. Chaque rôle donne accès à certains écrans seulement, et vous pouvez ajuster les droits un par un, suspendre un accès ou retirer quelqu’un.',
  },
  {
    id: 'journal',
    perms: ['journal'],
    route: '/admin/journal',
    target: nav('/admin/journal'),
    title: () => 'Journal (propriétaire)',
    body: () => 'Qui a fait quoi, et quand : ajouts, modifications, suppressions, connexions et tentatives refusées. Vous seule le lisez. Le contenu des formulaires n’y est jamais gardé.',
  },
  {
    id: 'help',
    route: '/admin/aide',
    target: '[data-tour-replay]',
    title: () => 'Le Guide pas à pas',
    body: () => 'Les gestes du quotidien expliqués étape par étape, et quoi faire quand quelque chose ne va pas. Ce bouton « Revoir le didactiel » relance ce tour quand vous voulez.',
  },
  {
    id: 'done',
    title: () => 'C’est terminé',
    body: () => 'Vous savez maintenant où trouver chaque chose. En cas de doute, ouvrez « Guide pas à pas » dans le menu. Ce tour ne se relancera plus tout seul.',
  },
];

/** Étapes adaptées à la personne : rôle affiché et écrans réservés à ses droits. */
export function buildSteps(user) {
  const permissions = user?.staff?.permissions || [];
  const can = (...perms) => perms.some((p) => permissions.includes(p));
  const ctx = { role: user?.staff?.role || 'Équipe', owner: Boolean(user?.staff?.is_owner), can };
  return STEPS
    .filter((step) => !step.perms || can(...step.perms))
    .map((step) => ({ ...step, title: step.title(ctx), body: step.body(ctx) }));
}
