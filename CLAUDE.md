# Mon Armoire — Règles de travail du projet

E-commerce de bijoux et objets chrétiens (Abidjan, Côte d'Ivoire). Django 5 + DRF + SimpleJWT (API, fonctions `@api_view`, clés UUID) / React 19 + Vite + Bootstrap 5 précompilé + Zustand + axios + react-router v7. Déploiement cible : **LWS cPanel (hébergement mutualisé)**.

L'utilisateur travaille en français. Répondre en français, de façon concise.

## Façon de travailler (non négociable)

- Faire **bien**, pas seulement faire : chaque décision de code/UX doit être remise en question avant d'être écrite (« est-ce optimal ? est-ce sûr ? est-ce que ça passe partout ? »).
- Ne pas coder quand l'utilisateur dit « ne code pas d'abord » : intégrer les consignes, confirmer, attendre le feu vert.
- Avancer sans re-confirmer le détail, mais s'arrêter pour une vraie ambiguïté.
- Tester en réel dans le navigateur avant de déclarer terminé. Si une vérification est impossible, le dire explicitement.
- Ne jamais corriger un problème de façon à ce qu'il « passe » seulement sur quelques appareils/cas : la solution doit être robuste et générale.

## Contraintes d'hébergement : LWS cPanel (mutualisé)

Toute fonctionnalité doit être compatible. Donc **interdit / à éviter** :
- Redis, Memcached, Celery/RQ avec worker permanent, Channels/WebSockets, Docker, processus démons longs, Elasticsearch, tout service à installer côté serveur.
- Tâches différées/périodiques : **commandes `manage.py` lancées par cron cPanel** (idempotentes, avec verrou, bornées en durée et en mémoire).
- Cache : cache base de données ou fichiers (`DatabaseCache` / `FileBasedCache`), jamais `LocMemCache` pour des données devant être cohérentes (plusieurs processus Passenger). Prévoir une invalidation explicite.
- Python via « Setup Python App » (Passenger) : un redémarrage = `tmp/restart.txt`. Pas de `runserver`, pas de Node en production : le frontend est **buildé** (`npm run build`) et servi en statique.
- Statique/médias : servis par Apache (collectstatic, WhiteNoise éventuel pour le statique ; médias via dossier public avec règles .htaccess). Pas de S3 sauf décision explicite.
- Base : **PostgreSQL** (confirmé par l'utilisateur). **Aucune extension PostgreSQL disponible sur LWS** (`pg_trgm` absente, constaté au premier `migrate`) : ne jamais en exiger ; toute fonction qui en profite doit avoir un repli (`catalog/search.py`) ; pool de connexions limité sur mutualisé (`CONN_MAX_AGE` modéré).
- Mémoire/CPU/processus limités : pas de traitement lourd dans une requête HTTP (images, PDF, emails en masse → commande cron ou génération à l'upload bornée).
- E-mails : SMTP du compte cPanel (envoi limité par heure → file d'envoi en base + cron, jamais d'envoi massif synchrone).
- Secrets uniquement par variables d'environnement (jamais dans le dépôt). `DEBUG=False`, `ALLOWED_HOSTS`, `CORS`, `CSRF_TRUSTED_ORIGINS` explicites en production.

## Leçons du projet EthniSpirit (même auteur, déjà en production sur LWS : `C:\Users\LENOVO\PycharmProjects\ethnispirit`)

Avant de décider d'un réglage d'hébergement, regarder comment EthniSpirit l'a résolu (`DEPLOIEMENT.md`, `backend/backend/settings/`, `frontend/public/.htaccess`, `frontend/src/utils/imageQueue.js`).
- **PostgreSQL de LWS = version 13 (confirmé par l'utilisateur)** : Django est donc figé en **5.1.x** (5.1.15 ; Django 5.2 exige PostgreSQL 14+ et refuse de démarrer). Ne JAMAIS remonter à 5.2 tant que LWS n'a pas migré PostgreSQL, et rester compatible PG13 (pas de fonctionnalité PG14+). 5.1 n'a plus de correctifs de sécurité : `pip-audit` signale 8 CVE, tous sur des modules **non utilisés ici** (`UpdateCacheMiddleware`/`cache_page`, `get_signed_cookie`, GeoDjango/GDAL, `DomainNameValidator`) : ne pas introduire ces modules. Revérifier `pip-audit` à chaque déploiement et reconsidérer dès que LWS propose PostgreSQL 14+ (alors : Django 5.2 LTS).
- **Connexions simultanées limitées** : sur LWS, un visiteur qui ouvre ~40 connexions d'un coup voit la moitié échouer (12 passent). D'où `QueuedImage` + `utils/imageQueue.js` (6 images à la fois, abandon hors écran, 3 nouvelles tentatives) pour toute liste d'images. Ne jamais lancer des dizaines de requêtes en parallèle.
- **Médias** : dossier public du site principal (`public_html/media`, `MEDIA_ROOT` en `.env`), même origine que le frontend ; `MEDIA_URL` absolue en production ; règle de cache `/media/` dans le `.htaccess` du site ; mise en ligne des médias à la main (FTP), `media/` hors dépôt.
- **E-mail** : le serveur Exim local (`localhost:25`, sans SSL) a fonctionné ; `mail.<domaine>:465` SSL en alternative.
- **Passenger** : `passenger_wsgi.py` + `.htaccess` (`PassengerAppRoot`, `PassengerPython`) dans le dossier du sous-domaine ; cron = `source virtualenv/activate && python manage.py <commande>`.
- **Déploiement** : tout est dans `deploy/` (`DEPLOIEMENT_LWS.md` pas à pas, `backend.htaccess`, `media.htaccess`, `env.production.example`, `backup.sh`, `restore_test.sh`). Après chaque mise en ligne : `python manage.py preflight` doit être entièrement `OK`. Tâches cron : `expire_pending_orders` (horaire), `send_restock_notifications` (30 min), `send_daily_verse_push`, sauvegarde, `flushexpiredtokens`, `clearsessions`. Ne jamais lancer `seed_demo_*` en production.
- Images : conversion WebP + miniature à l'envoi (`common/imaging.py`, branché par signaux sur tous les champs image) ; `manage.py optimize_images` (toutes les photos : WebP réduit + miniatures, idempotent, `--limit`, à relancer tant qu'il le demande) et `generate_thumbnails` rattrapent les anciennes photos. Polices Sketchy hébergées par le site (`@fontsource`, aucun Google Fonts) ; `preconnect` vers l'API injecté au build.

## Intégrité métier (commandes, stock, argent)

- Toute transition de statut de commande passe par `orders/services.py` (`mark_order_paid`, `cancel_unpaid_order`) : verrou de ligne + statut revérifié, donc idempotent (webhook + retour client + admin simultanés).
- Toute lecture-puis-écriture sur un solde (carte cadeau, points, stock) se fait dans `transaction.atomic()` avec `select_for_update()` ou `UPDATE ... WHERE stock >= n`. Les e-mails partent via `transaction.on_commit`.
- Compte créé à la commande : mot de passe temporaire aléatoire (12 caractères, `get_random_string`) **envoyé en clair par e-mail — choix explicite de l'utilisateur** (ne pas le « corriger »). Les routes publiques (retour de paiement, suivi) ne renvoient jamais adresse/téléphone sans preuve (e-mail).
- Toute valeur numérique venue du client est bornée et validée (quantités 1–20, montants finis, jamais `int(request.data[...])` nu). Les codes (commande, carte cadeau) viennent de `secrets`.
- Tâche cron à planifier : `python manage.py expire_pending_orders` (toutes les heures) .

## Réglages de production (déjà en place, à ne pas défaire)

- API en JSON uniquement (`JSONOnlyNegotiation`), erreurs 404/500 en JSON, jamais de traceback au public (`passenger_wsgi.py` écrit dans `logs/startup_error.log`).
- Démarrage refusé si `SECRET_KEY` faible/d'exemple. HSTS sans `includeSubdomains`/preload par défaut. Médias servis par Apache (`deploy/media.htaccess`), statique par WhiteNoise, SPA et en-têtes de sécurité via `frontend/public/.htaccess`.
- Cache et limites de débit en **fichiers** (`FileBasedCache`, dossier `cache/` hors zone publique) : un cache en base ajoutait ~10 requêtes SQL à chaque appel API (limites de débit). Journaux tournants dans `logs/`. Refresh token 30 jours, révoqué après réinitialisation du mot de passe ; jeton de réinitialisation stocké haché.
- Avant chaque déploiement : `pip-audit -r requirements.txt` (seules les 8 CVE Django 5.1 documentées plus haut sont tolérées), `manage.py test`, `check --deploy` (seuls W005/W021 volontaires acceptés).

## Scalabilité (visée : des millions d'utilisateurs)

- Pagination : `common.pagination.paginate()` (réponse `{count, next, previous, results}`, 24 par page, 20 en admin, plafond 100). Côté React : `usePaginated` + `<Pager>` (admin), `useLoadMore` + « Voir plus » (catalogue, compte, avis), `<ListStatus>` (squelette/erreur/vide). Un queryset paginé est toujours ordonné.
- Pas de N+1 : les propriétés de `Product` (`default_variant`, `main_image`, `is_in_stock`) lisent le préchargement ; paniers/commandes passent par `orders/queries.py`. Tout nouvel écran liste est couvert par un test « nombre de requêtes constant » (voir `catalog/tests.py`).
- Médias : `MEDIA_URL` absolue en production (site et API sur deux domaines) ; images hors catalogue (hero) en fichiers statiques du frontend, jamais via `/media/`.

- Aucune requête N+1 : `select_related` / `prefetch_related` systématiques, vérifier avec `assertNumQueries` ou le nombre de requêtes réel.
- **Pagination serveur obligatoire** sur toute liste (catalogue, commandes, clients, avis, admin). Jamais de `.all()` renvoyé en entier.
- Index sur tout champ filtré/trié/joint (`db_index`, index composites) ; pas de `LIKE '%x%'` sur grosses tables sans stratégie ; agrégats lourds → calcul précalculé ou mis en cache.
- Écritures concurrentes sûres : `transaction.atomic`, `select_for_update` pour stock/codes cartes cadeaux/points de fidélité, contraintes d'unicité en base (pas seulement en code), opérations idempotentes (paiements, webhooks).
- Réponses API légères : sérialiseurs dédiés liste vs détail, champs minimaux, pas d'images en base64.
- Images : tailles/formats adaptés (miniatures, WebP si possible), `loading="lazy"`, dimensions explicites pour éviter les décalages de mise en page.
- Cache HTTP (`Cache-Control`, `ETag`) sur les endpoints publics en lecture ; invalidation soignée.
- Rate limiting/throttling DRF sur auth, mot de passe oublié, avis, suivi de commande, cartes cadeaux, liste d'attente.

## Chargements (frontend)

- Pages chargées à la demande (`lazyWithRetry` dans `App.jsx`, accueil seul dans le paquet principal), `ErrorBoundary` réinitialisé à chaque navigation, `PageSkeleton` pendant le chargement. Ne pas importer le JS de Bootstrap (inutilisé).
- Service worker (`public/sw.js`) : assets hachés et médias en « cache d'abord », pages en « réseau d'abord » ; incrémenter `VERSION` pour purger.
- Contrôle mobile : tester 320/375/414 px, vérifier `scrollWidth <= clientWidth`, cibles ≥ 44 px, `autoComplete`/`inputMode` sur chaque champ. Piège Bootstrap : `row g-5` déborde sur mobile (corrigé globalement dans `index.css`).

- Ne **jamais** lancer tous les chargements en même temps : prioriser le contenu visible (au-dessus de la ligne de flottaison) d'abord, différer le reste (au scroll / `IntersectionObserver` / après interaction).
- Découpage du code : `React.lazy` + `Suspense` par route, admin chargé séparément du site client.
- Pas de requêtes dupliquées ; annuler les requêtes obsolètes (`AbortController`) ; debounce sur recherche/suggestions.
- Toujours un état de chargement, d'erreur et de vide propres (skeleton plutôt que « Chargement... » brut), jamais d'écran blanc.
- Poids du bundle surveillé ; pas de dépendance lourde pour un petit besoin.

## UI/UX — exigences strictes

- Cliente **non technique** : chaque parcours doit être évident, un seul chemin clair, libellés en français simple, action principale toujours visible sans scroller, aucun espace vide inutile.
- **Compatibilité tous mobiles** (mobile-first, pas seulement quelques modèles) :
  - Unités relatives (`rem`, `%`, `clamp()`, `min()/max()`, `vw/vh` → préférer `dvh`/`svh` avec repli, jamais `100vh` seul à cause des barres d'URL mobiles) ; **pas de largeurs/hauteurs fixes en `px`** pour la mise en page (px réservé aux bordures fines, ombres, petites tailles d'icônes).
  - Mise en page testée de 320px à grand écran ; aucune barre de défilement horizontale ; gouttière latérale cohérente ; respect des `safe-area-inset` (encoche, barre d'accueil).
  - Texte ≥ 16px dans les champs (sinon zoom automatique iOS) ; cibles tactiles ≥ 44×44px ; `:hover` jamais indispensable ; `touch-action`/`overscroll` maîtrisés.
  - Clavier mobile : bon `type`/`inputmode`/`autocomplete` sur chaque champ ; le champ actif ne doit pas être masqué par le clavier.
  - Pas d'API navigateur sans repli (clipboard, push, share, etc.) ; tester Safari iOS, Chrome Android, navigateurs Android bas de gamme.
  - Connexions lentes (3G/4G Côte d'Ivoire) : poids minimal, pas de dépendance à de gros assets.
- **Identité de marque** : thème **Bootswatch Sketchy** sur tout le site ET l'espace Admin (décision de l'utilisateur ; remplace les anciennes règles « coins droits / Playfair »). Polices Neucha + Cabin Sketch (thème). Couleurs de marque conservées par-dessus : crème `#F7F2EA`, émeraude `--ma-brown` `#1F3D2E` (nom hérité, c'est du vert), or `#C9A227`, danger `#8f2d2d`.
  - Contours 2px `#333` et rayons « dessinés à la main » via `var(--bs-border-radius[-sm])` (jamais de rayon en dur), **aucun dégradé décoratif**, pas d'ombres lourdes, pas de couleur Bootstrap par défaut (bleu, jaune, gris froid). Le site et l'Admin doivent rester visuellement identiques.
  - Utiliser les classes de marque (`.badge-gold/brand/muted`, `.btn-primary`, `.btn-outline-primary`, `.btn-outline-secondary`, `.text-gold`, `.verse-banner`) ; ne pas utiliser `text-bg-*` de Bootstrap.
  - Bootstrap est importé **précompilé** : surcharger via variables CSS `--bs-*` et sélecteurs dans `index.css` (importé après).
- **Photo de l'article visible partout** où un article est listé (panier, paiement, commandes, admin).
- Accessibilité : contraste AA, `alt` utiles, `aria-label` sur boutons-icônes, focus visible, ordre de tabulation logique, formulaires avec `label`, messages d'erreur explicites et à côté du champ.
- Formulaires : validation côté client **et** serveur, messages en français clair, pas de perte de saisie en cas d'erreur, bouton désactivé pendant l'envoi (anti double-clic).
- Admin aussi simple que le client : un mot clair par action, confirmation pour toute action destructive, retour visuel après chaque action.

## Espace Admin (la cliente gère tout, hors Django admin)

- Libellé « Admin » partout (jamais « back-office »). Kit : `views/admin/admin.css`, `ui/AdminUi.jsx` (toasts + modale de confirmation, jamais `window.confirm`), `ui/parts.jsx` (`PageHeader`, `Field`, `ImageField`, `StatusBadge`), `ui/AdminCrud.jsx` (CRUD générique). Sauvegarde automatique à la sortie du champ avec toast ; `epoch` ne remonte les champs qu'après une erreur.
- Toute entité éditable par la cliente (produits, coffrets, catégories, occasions, symboles, lookbook, zones de livraison, versets…) a son écran : ne jamais renvoyer la cliente vers Django admin.
- Backend : `common/admin_crud.py` (`list_create`, `update_delete`, 409 si `ProtectedError`), `common/uploads.py` (`ValidatedImagesMixin`). `ADMIN_URL` (slug aléatoire, vide = Django admin désactivé). `common/test_admin_api.py` : audit de toutes les routes (aucune route admin sans `IsAdminUser`). `reset_shop_data --yes` vide commandes/clients de test avant le lancement.
- Les URL d'une SPA ne se cachent pas : la sécurité repose sur l'autorisation serveur testée, pas sur l'obscurité.

## Sécurité (strict, à vérifier à chaque fonctionnalité)

- Autorisation **côté serveur** sur chaque endpoint (permissions DRF explicites, `IsAdminUser` pour l'admin) ; vérifier la propriété de l'objet (pas d'IDOR) ; ne jamais faire confiance au client (prix, totaux, remises, stock, rôle, statut recalculés côté serveur).
- Entrées validées par les serializers ; ORM uniquement (pas de SQL brut concaténé) ; pas de `dangerouslySetInnerHTML` / HTML non échappé ; fichiers uploadés : type, taille, extension, nom régénéré, validation d'image réelle.
- Auth : JWT à durée courte + refresh, mots de passe via validateurs Django, réponses **non énumérantes** (mot de passe oublié, connexion), jetons de réinitialisation à usage unique et expirants, limitation de tentatives.
- Production : HTTPS forcé, `SECURE_*`, cookies `Secure`/`HttpOnly`/`SameSite`, HSTS, CSP raisonnable, `X-Content-Type-Options`, CORS en liste blanche stricte, pas de stack trace, journalisation sans données sensibles (aucun mot de passe/jeton/données de paiement dans les logs).
- Paiements/webhooks : signature vérifiée, idempotence, montants recalculés serveur, jamais de statut « payé » décidé par le client.
- Données personnelles (e-mail, téléphone, adresse) : minimisation, jamais exposées dans les URLs ni aux autres utilisateurs ; endpoints de suivi/cartes cadeaux à codes non devinables + throttling.
- Dépendances : versions figées, pas de paquet inutile, audit (`pip-audit`, `npm audit`) avant déploiement.
- Sauvegardes de la base planifiées (cron cPanel) et restauration testée.

## Qualité du code

- Code minimal et lisible, pas d'abstraction prématurée, pas de code mort ; commentaires uniquement pour un « pourquoi » non évident.
- Tests des chemins critiques (commande, paiement, stock, cartes cadeaux, fidélité, permissions). Migrations sûres (backfill avant contrainte d'unicité, jamais de migration destructive sans sauvegarde).
- Avant de déclarer « terminé » : build frontend sans erreur ni warning, `manage.py check --deploy`, console navigateur propre, parcours testés en vue mobile (320, 375, 414) et bureau.

## Conventions techniques connues

- Vues DRF : fonctions `@api_view` uniquement ; clés primaires UUID.
- Windows/Git Bash : ne pas passer de texte accentué via `<` dans `manage.py shell` ; utiliser `python manage.py shell -c "exec(open(r'chemin', encoding='utf-8').read())"`.
- Automatisation navigateur : pour les champs React contrôlés, utiliser `form_input` ou le setter natif + évènement `input` ; les captures d'écran du panneau peuvent échouer, se rabattre sur `get_page_text` / `read_page` / `getComputedStyle`.
- Coffret = « box » : `show_contents`, `show_item_prices`, `allow_customization`, `CoffretItem`, `CoffretConfiguration.removed_items`, `CoffretConfigurationItem.slot` nullable.
