import { Link } from 'react-router-dom';
import { PageHeader } from './ui/parts';

const TASKS = [
  {
    title: 'Ajouter un nouveau bijou',
    steps: [
      <>Menu <Link to="/admin/produits">Produits</Link> puis bouton « + Nouveau produit ».</>,
      'Écrivez le nom, choisissez la catégorie, puis cliquez sur « Créer et continuer ».',
      'Sur la fiche : ajoutez une ou plusieurs photos (la première devient la photo principale).',
      'Section « Variantes » : ajoutez au moins une variante avec son prix et son stock. Sans variante, le bijou ne peut pas être acheté.',
      'Vérifiez que « Visible sur le site » est activé. Le bijou apparaît sur le site en moins d’une minute.',
    ],
  },
  {
    title: 'Changer un prix ou mettre à jour le stock',
    steps: [
      <>Menu <Link to="/admin/produits">Produits</Link>, ouvrez le bijou (bouton « Modifier »).</>,
      'Section « Variantes » : changez le prix ou le stock dans la case, puis cliquez en dehors de la case.',
      'Un message vert « Variante enregistrée » confirme. Rien d’autre à faire.',
    ],
  },
  {
    title: 'Cacher un bijou sans le supprimer',
    steps: [
      <>Menu <Link to="/admin/produits">Produits</Link> : dans la colonne « Visible », désactivez l’interrupteur du bijou.</>,
      'Le bijou disparaît du site mais reste dans votre liste : réactivez l’interrupteur pour le remontrer.',
      'Préférez cacher plutôt que supprimer : un bijou déjà commandé ne peut pas être supprimé.',
    ],
  },
  {
    title: 'Un bijou est en rupture de stock',
    steps: [
      'Mettez le stock à 0 : la cliente voit « Rupture de stock » et peut laisser son e-mail.',
      'Quand vous remettez du stock, les personnes en attente sont prévenues automatiquement par e-mail (dans la demi-heure).',
      'Pour accepter les commandes malgré le stock à 0 (fabrication sur demande), cochez « Précommande possible » sur la variante et écrivez un message, par exemple « Retour en stock mi-décembre ».',
    ],
  },
  {
    title: 'Proposer la gravure d’un prénom sur un bijou',
    steps: [
      'Ouvrez la fiche du bijou et cochez « Personnalisable ». Indiquez le nombre maximum de lettres.',
      'Section « Photos » : sous la photo, cliquez sur « Zone de gravure ».',
      'Choisissez le type de zone (à plat, en courbe, ou lettres sur perles), placez la zone sur la photo avec le doigt ou la souris, tapez un prénom d’essai pour voir le résultat.',
      'Cliquez sur « Enregistrer la zone », puis sur « Voir sur le site » pour essayer comme une cliente.',
      <>Quand une cliente commande avec une gravure, <Link to="/admin/commandes">Commandes</Link> affiche « Gravure à faire » : ouvrez « Détails » pour lire le texte exact.</>,
    ],
  },
  {
    title: 'Préparer et expédier une commande',
    steps: [
      <>Menu <Link to="/admin/commandes">Commandes</Link>, filtre « Payée » : ce sont les commandes à préparer.</>,
      'Cliquez sur « Détails » : vous voyez les articles, la gravure, l’emballage cadeau, l’adresse et le téléphone.',
      'Colonne « Changer » : choisissez « En préparation », puis « Expédiée » quand le colis part, puis « Livrée ».',
      'Attention : chaque changement de statut envoie un e-mail à la cliente.',
    ],
  },
  {
    title: 'Créer un coffret cadeau',
    steps: [
      <>Menu <Link to="/admin/coffrets">Coffrets</Link> puis « + Nouveau coffret » : nom et prix du contenant (la boîte seule).</>,
      'Sur la fiche : ajoutez la photo, puis les articles inclus d’office.',
      'Si la cliente peut choisir (ex : « Choisissez un collier »), ajoutez un « emplacement » avec sa catégorie.',
      'Section « Ce que la cliente voit » : décidez si elle voit le contenu, les prix, et si elle peut retirer ou ajouter des articles.',
    ],
  },
  {
    title: 'Changer le tarif ou les zones de livraison',
    steps: [
      <>Menu <Link to="/admin/livraison">Livraison</Link> : modifiez une zone existante ou ajoutez-en une.</>,
      'Pour arrêter de livrer une zone, masquez-la : les anciennes commandes gardent leur tarif.',
    ],
  },
  {
    title: 'Changer un texte du site, un numéro ou un lien de réseau social',
    steps: [
      <>Menu <Link to="/admin/site">Textes et contacts</Link>.</>,
      'Modifiez la case voulue puis cliquez en dehors : un message vert confirme. Le site est à jour en quelques minutes.',
    ],
  },
  {
    title: 'Recevoir une alerte à chaque commande, stock faible ou avis',
    steps: [
      'En haut de l’Admin, cliquez sur « Activer les alertes sur cet appareil » et acceptez les notifications. Faites-le sur chaque appareil que vous voulez alerter (téléphone, ordinateur).',
      'Vous êtes ensuite prévenue, même quand le site est fermé : nouvelle commande payée (avec « gravure à faire » si besoin), stock faible ou épuisé, nouvel avis, nouvelle inscription en liste d’attente. Chaque personne de l’équipe ne reçoit que ce que son rôle permet.',
      <>Pour recevoir aussi un e-mail : <Link to="/admin/site">Textes et contacts</Link>, section « Alertes par e-mail ».</>,
      <>Sur iPhone, installez d’abord l’application sur l’écran d’accueil : <Link to="/installer">mode d’emploi pour chaque téléphone</Link>. Ouvrez ensuite l’Admin depuis la nouvelle icône.</>,
    ],
  },
  {
    title: 'Voir ce que font les visiteurs',
    steps: [
      <>Menu <Link to="/admin/visiteurs">Visiteurs</Link> : visites, bijoux les plus regardés, recherches, paniers en cours et abandonnés.</>,
      'Vos propres visites (quand vous êtes connectée) ne sont jamais comptées.',
    ],
  },
  {
    title: 'Donner accès à une collaboratrice (propriétaire seulement)',
    steps: [
      <>Menu <Link to="/admin/equipe">Équipe</Link> : saisissez son e-mail, choisissez son rôle, « Envoyer l’invitation ».</>,
      'Elle reçoit un e-mail pour choisir son mot de passe (lien valable 1 heure ; vous pouvez le renvoyer).',
      <>Tout ce qu’elle fait est noté dans le <Link to="/admin/journal">Journal</Link>. Pour lui retirer l’accès : « Suspendre l’accès » (temporaire) ou « Retirer de l’équipe ».</>,
    ],
  },
];

const PROBLEMS = [
  {
    title: 'Mon bijou n’apparaît pas sur le site',
    steps: [
      'Vérifiez que « Visible sur le site » est activé sur sa fiche.',
      'Vérifiez qu’il a au moins une variante avec un prix.',
      'Si le stock est à 0, il apparaît avec la mention « Rupture ».',
      'Patientez une minute puis rechargez la page du site.',
    ],
  },
  {
    title: 'Une cliente dit avoir payé, mais la commande est « En attente de paiement »',
    steps: [
      'Le paiement peut mettre quelques minutes à être confirmé : attendez un peu.',
      'Au bout d’une demi-heure, vérifiez dans votre espace du service de paiement que l’argent est bien reçu.',
      'Si l’argent est reçu : dans « Commandes », choisissez « Payée » pour cette commande. Sinon, ne changez rien.',
    ],
  },
  {
    title: 'Un message rouge m’empêche de supprimer quelque chose',
    steps: [
      'Le message explique pourquoi : par exemple un bijou déjà commandé ou placé dans un coffret ne peut pas être supprimé, pour garder l’historique des ventes.',
      'Cachez-le à la place (interrupteur « Visible ») : la cliente ne le voit plus.',
    ],
  },
  {
    title: 'Une photo est refusée',
    steps: [
      'Formats acceptés : JPEG, PNG ou WebP, 15 Mo au maximum par photo.',
      'Une photo de téléphone est acceptée : le site la réduit automatiquement pour rester rapide.',
    ],
  },
  {
    title: 'Je ne reçois pas les alertes',
    steps: [
      <>Sur iPhone, elles ne marchent qu’avec l’application installée : <Link to="/installer">voir comment l’installer</Link>.</>,
      'Vérifiez que le bandeau en haut de l’Admin affiche « Les alertes sont actives sur cet appareil ». Sinon, cliquez sur « Activer les alertes ».',
      'Si le bandeau dit que les notifications sont bloquées : touchez le cadenas à côté de l’adresse du site, autorisez les notifications, rechargez la page.',
      'Les alertes partent en quelques minutes (pas à la seconde). Si rien n’arrive pendant longtemps, prévenez la personne qui s’occupe du site technique : la tâche automatique « alertes » est peut-être arrêtée.',
    ],
  },
  {
    title: 'Je n’arrive pas à me connecter à l’Admin',
    steps: [
      'Utilisez « Mot de passe oublié » sur la page de connexion.',
      'Si vous venez d’être invitée et que le lien a expiré, demandez à la propriétaire de cliquer sur « Renvoyer l’invitation » (menu Équipe).',
      'Si le menu « Admin » n’apparaît pas, c’est que votre compte n’a pas encore de rôle : demandez à la propriétaire.',
    ],
  },
  {
    title: 'Un écran me dit « Cet écran n’est pas disponible pour votre rôle »',
    steps: ['C’est normal : votre rôle ne donne pas accès à cette partie. Demandez à la propriétaire de vous donner le droit (menu Équipe).'],
  },
];

function Guide({ items }) {
  return items.map((item) => (
    <details className="admin-card admin-guide" key={item.title}>
      <summary>{item.title}</summary>
      <ol className="admin-help mb-0">
        {item.steps.map((step, i) => <li key={i}>{step}</li>)}
      </ol>
    </details>
  ));
}

export default function AdminHelpScreen() {
  return (
    <div>
      <PageHeader
        kicker="Aide" title="Guide pas à pas"
        lead="Les gestes du quotidien expliqués simplement. Cliquez sur une ligne pour lire les étapes. Chaque modification s’enregistre en cliquant en dehors de la case, et un message vert le confirme : si vous voyez un message rouge, lisez-le, il explique quoi faire."
      />
      <h2 className="admin-card-title">Comment faire pour…</h2>
      <Guide items={TASKS} />
      <h2 className="admin-card-title mt-4">Quelque chose ne va pas</h2>
      <Guide items={PROBLEMS} />
    </div>
  );
}
