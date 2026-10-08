# Mon Armoire — Guide de déploiement LWS cPanel

Procédure adaptée de celle qui a fonctionné pour EthniSpirit (même hébergeur, même architecture).
**Site** : `monarmoire.store` (React, fichiers statiques) · **API** : `backend.monarmoire.store` (Django via Passenger) · **Photos** : `monarmoire.store/media/`.

Remplacer partout `VOTRE_LOGIN` par l'identifiant cPanel LWS.

---

## 0. À savoir avant de commencer

| Sujet | Décision |
|---|---|
| PostgreSQL de LWS | **version 13** → Django figé en **5.1.15** (ne pas mettre à jour vers 5.2). Vérifier : `psql ... -c "SHOW server_version;"` |
| Python | choisir **3.12.x** dans « Setup Python App » (version utilisée pour tous les tests ; éviter 3.13, non testée, et tout ce qui est ≤ 3.9) |
| Base locale | tes tests tournent sur PostgreSQL 15 : les migrations n'utilisent aucune fonction PG 14+, mais le contrôle `preflight` (étape 6) valide la vraie base LWS |
| Données de démonstration | **ne jamais** lancer `seed_demo_products` ni `seed_demo_reviews` en production (faux avis clients) |
| Paiements | clés **live** GeniusPay et Paystack, webhooks déclarés (étape 9) |

**Valeurs réelles de ce déploiement** (relevées dans cPanel) : domaine `monarmoire.store`, API `backend.monarmoire.store`, application Python en 3.12.13 avec racine `mon_armoire/backend`, environnement virtuel `/home/c2879665c/virtualenv/mon_armoire/backend/3.12/` (donc `source /home/c2879665c/virtualenv/mon_armoire/backend/3.12/bin/activate`), identifiant cPanel `c2879665c`.
**Dossier public** : partout où le guide écrit `public_html`, utiliser le « dossier racine » affiché dans cPanel › Domaines pour `monarmoire.store` (pour le sous-domaine `backend`, celui indiqué à sa création).

---

## 1. Préparation sur ton ordinateur

```bash
cd backend
python manage.py test                      # tous les tests doivent passer
python -m pip_audit -r requirements.txt    # seules les 8 alertes Django 5.1 documentées dans CLAUDE.md sont tolérées
cd ../frontend
npm audit --omit=dev                       # 0 vulnérabilité
npm run build                              # crée frontend/dist (contient déjà .htaccess, sw.js, images/)
```

`frontend/.env.production` fixe l'adresse de l'API (`https://backend.monarmoire.store`) : vérifier qu'elle est correcte **avant** le build.

Préparer les secrets (à garder dans ton gestionnaire de mots de passe, jamais dans un chat) :

```bash
python -c "from django.core.management.utils import get_random_secret_key as k; print(k()+k())"   # SECRET_KEY
```

---

## 2. cPanel : base de données, sous-domaine, application Python

1. **Bases de données PostgreSQL** : créer `VOTRE_LOGIN_monarmoire`, un utilisateur `VOTRE_LOGIN_maruser` (mot de passe fort) et l'associer à la base (tous les privilèges).
2. **Sous-domaines** : sous-domaine `backend`, domaine `monarmoire.store`, racine `public_html/backend`.
3. **Software › Setup Python App** :

| Champ | Valeur |
|---|---|
| Application root | `mon_armoire/backend` |
| Application URL | `backend.monarmoire.store` |
| Startup file | `passenger_wsgi.py` |
| Entry point | `application` |

   Cliquer **Create** : LWS crée le virtualenv (`/home/VOTRE_LOGIN/virtualenv/mon_armoire/backend/3.12/…`).

4. **SSL/TLS › AutoSSL** : vérifier que `monarmoire.store`, `www.monarmoire.store` et `backend.monarmoire.store` ont un certificat valide.

---

## 3. Récupérer le code depuis GitHub, envoyer le site et les photos

Le code est sur **https://github.com/Oli1207/mon_armoire** (dépôt **privé** : vérifier dans GitHub › Settings › Danger Zone que « Change visibility » indique *Private*).
Le dépôt contient le backend, le frontend (sources), `deploy/` et `CLAUDE.md`. Il ne contient **volontairement pas** : `backend/.env` (secrets), `backend/vapid_private.pem`, les photos (`backend/media`), `frontend/dist` (le site compilé), `venv/`, `node_modules/`.

**3.1 Cloner le dépôt dans `/home/VOTRE_LOGIN/mon_armoire`** (le dossier du dépôt devient `mon_armoire`, ce qui donne `mon_armoire/backend` et `mon_armoire/deploy` comme dans l'arborescence ci-dessous) :

- *Option A (recommandée)* : cPanel › **Git™ Version Control** › Create › « Clone a Repository » : URL `git@github.com:Oli1207/mon_armoire.git`, chemin `/home/VOTRE_LOGIN/mon_armoire`. Dépôt privé : cPanel affiche une **clé publique** à ajouter dans GitHub › dépôt › Settings › **Deploy keys** (lecture seule).
- *Option B (si l'option Git n'existe pas sur ton offre)* : Terminal cPanel, `git clone https://github.com/Oli1207/mon_armoire.git ~/monarmoire` avec un **jeton d'accès** GitHub en lecture seule (Settings › Developer settings › Fine-grained tokens) comme mot de passe. Dernier recours : GitHub › Code › *Download ZIP*, puis décompresser dans `mon_armoire/`.

**3.2 Fichiers à envoyer à la main** (FTP ou Gestionnaire de fichiers) :

| Fichier | Destination |
|---|---|
| contenu de `frontend/dist/` (après `npm run build` sur ton ordinateur) | `public_html/` (y compris le `.htaccess` caché) |
| tes photos `backend/media/*` | `public_html/media/` + `deploy/media.htaccess` copié en `public_html/media/.htaccess` |
| `backend/vapid_private.pem` | `mon_armoire/backend/` |
| `.env` rempli à partir de `deploy/env.production.example` | `mon_armoire/backend/.env` |
| `deploy/backend.htaccess` (3 × `VOTRE_LOGIN` remplacés) | `public_html/backend/.htaccess` |
| `backend/passenger_wsgi.py` (copie) | `public_html/backend/passenger_wsgi.py` |

Structure finale :

```
/home/VOTRE_LOGIN/
├── public_html/                     ← SITE (contenu de frontend/dist)
│   ├── index.html, assets/, images/, icons/, sw.js, manifest.json, .htaccess
│   ├── media/                       ← PHOTOS (servies par Apache) + .htaccess
│   └── backend/                     ← dossier public du sous-domaine API
│       ├── passenger_wsgi.py
│       └── .htaccess
└── mon_armoire/                      ← clone GitHub, HORS de public_html (inaccessible depuis Internet)
    ├── backend/                     ← manage.py, apps, requirements.txt, .env, vapid_private.pem
    ├── frontend/                    ← sources (non utilisées sur le serveur)
    ├── deploy/                      ← scripts (sauvegarde…)
    ├── cache/  logs/                ← créés automatiquement
```

---

## 4. Installation sur le serveur (Terminal cPanel)

```bash
source /home/VOTRE_LOGIN/virtualenv/mon_armoire/backend/3.12/bin/activate
cd /home/VOTRE_LOGIN/mon_armoire/backend
pip install -r requirements.txt
chmod 600 .env vapid_private.pem

python manage.py migrate
python manage.py collectstatic --noinput
python manage.py createsuperuser            # compte du back-office (e-mail + mot de passe fort)
python manage.py seed_verses                # versets de la rotation quotidienne
python manage.py generate_thumbnails        # miniatures des photos déjà envoyées
```

Contenus éditoriaux (guide des symboles, lookbook, occasions) : `python manage.py seed_content` crée des entrées modèles ; les relire dans le back-office avant d'ouvrir.

Redémarrer l'application : « Setup Python App » › **Restart**, ou `touch /home/VOTRE_LOGIN/mon_armoire/backend/tmp/restart.txt`.

---

## 5. Réglages à faire dans le back-office (`https://backend.monarmoire.store/<ADMIN_URL>`)

À créer avant l'ouverture : **zones de livraison** (nom, tarif, délais), catégories, produits (photos + variantes + stock), coffrets, et vérifier les textes de la page d'accueil.

---

## 6. Contrôle automatique de mise en ligne

```bash
python manage.py preflight --send-test-mail ton.adresse@exemple.com
```

Tout doit afficher `OK` (code de sortie 0). Il vérifie : `DEBUG` désactivé, clé secrète, domaines en HTTPS, PostgreSQL joignable + `pg_trgm`, migrations, cache, dossiers `media` et `logs` en écriture, statique collecté, e-mail, clés push, clés de paiement. Un `ECHEC` = ne pas ouvrir le site.

Si la page d'une URL boucle en redirection HTTPS : mettre `SECURE_PROXY_SSL_HEADER_ENABLED=True` dans `.env` puis redémarrer.

---

## 7. Tâches planifiées (cPanel › Tâches Cron)

Préfixe commun, noté `ENV` : `source /home/VOTRE_LOGIN/virtualenv/mon_armoire/backend/3.12/bin/activate && cd /home/VOTRE_LOGIN/mon_armoire/backend &&`

| Fréquence | Commande | Rôle |
|---|---|---|
| `0 * * * *` (toutes les heures) | `ENV python manage.py expire_pending_orders` | annule les commandes impayées depuis 24 h et rend cartes cadeaux/points |
| `0 7 * * *` | `ENV python manage.py send_daily_verse_push` | verset du jour (arrêt automatique après 20 min) |
| `30 2 * * *` | `bash /home/VOTRE_LOGIN/mon_armoire/deploy/backup.sh` | sauvegarde de la base (+ photos le dimanche) |
| `*/30 * * * *` | `ENV python manage.py send_restock_notifications` | e-mails « de retour en stock » (100 maximum par exécution) |
| `0 4 * * 0` | `ENV python manage.py flushexpiredtokens` | purge les anciens jetons de connexion |
| `30 4 * * 0` | `ENV python manage.py clearsessions` | purge les anciennes sessions de l'admin |

(Le dossier `deploy/` est déjà là grâce au clone GitHub : faire `chmod 700 ~/mon_armoire/deploy/*.sh`.)

---

## 8. Sauvegardes : mise en place et **test de restauration**

1. Créer `~/.pgpass` (une ligne) puis `chmod 600 ~/.pgpass` :
   `localhost:5432:VOTRE_LOGIN_monarmoire:VOTRE_LOGIN_maruser:MOT_DE_PASSE_BASE`
2. Lancer une première fois à la main : `bash ~/mon_armoire/deploy/backup.sh` → crée `~/backups/monarmoire/db_AAAA-MM-JJ.sql.gz`.
3. **Tester la restauration** (sans toucher à la vraie base) : `bash ~/mon_armoire/deploy/restore_test.sh ~/backups/monarmoire/db_AAAA-MM-JJ.sql.gz` → doit finir par « Sauvegarde restaurable. » (nécessite le droit de créer une base ; sinon créer `VOTRE_LOGIN_monarmoire_restoretest` dans cPanel et lancer avec `TEST_DB=...`).
4. **Copie hors serveur** : télécharger régulièrement `~/backups/monarmoire/` sur ton ordinateur (une sauvegarde qui reste sur le même serveur ne protège pas d'une panne du serveur).

---

## 9. Paiements : déclarer les webhooks

- **GeniusPay** : `https://backend.monarmoire.store/api/payments/geniuspay/webhook/` (secret = `GENIUSPAY_WEBHOOK_SECRET`)
- **Paystack** : `https://backend.monarmoire.store/api/payments/paystack/webhook/`

Sans secret configuré, le serveur **refuse** les webhooks (réponse 503) : c'est voulu.

---

## 10. Recette finale (à faire sur un vrai téléphone, en 4G)

- [ ] `https://monarmoire.store` : accueil, photos des tuiles, verset du jour
- [ ] `https://monarmoire.store/catalogue` puis **F5** (pas d'erreur 404) ; « Voir plus de bijoux »
- [ ] `https://backend.monarmoire.store/api/products/` renvoie du JSON ; `/api/` n'affiche **aucune** page HTML de débogage
- [ ] Inscription, connexion, mot de passe oublié (le mail arrive)
- [ ] Panier → commande invité → **paiement réel de petit montant** par mobile money, puis par carte ; la commande passe en « Payée » toute seule ; mail reçu
- [ ] Carte cadeau : achat, réception du code, utilisation à la commande
- [ ] Back-office : changer le statut d'une commande, ajouter un produit avec photo (la photo s'affiche sur le site)
- [ ] Cadenas valide sur les 3 adresses ; `https://monarmoire.store/media/…jpg` s'affiche ; `…/media/test.html` est refusé
- [ ] `https://backend.monarmoire.store/admin/` introuvable (l'admin est sur `ADMIN_URL`)
- [ ] Installation « Ajouter à l'écran d'accueil » sur Android
- [ ] Premier lendemain : le cron du verset a tourné (`logs/app.log`), la sauvegarde existe

---

## 11. Mettre à jour le site plus tard

1. Sur ton ordinateur : tests, `pip-audit`, `npm run build`, puis `git push` vers GitHub.
2. **Sauvegarder d'abord** : `bash ~/mon_armoire/deploy/backup.sh`.
3. Serveur : `cd ~/mon_armoire && git pull` (ou cPanel › Git Version Control › *Update from Remote*). Envoyer le nouveau contenu de `dist/` dans `public_html/` si le frontend a changé.
4. Serveur : `pip install -r backend/requirements.txt` · `python manage.py migrate` · `python manage.py collectstatic --noinput` · redémarrer l'application · `python manage.py preflight`.
5. Si un problème apparaît : `git checkout <ancien commit>` (ou `git revert`) ; pour la base, restaurer la sauvegarde (jamais de `migrate` en arrière sans sauvegarde).
6. Les visiteurs récupèrent la nouvelle version à leur prochaine visite (le service worker recharge les pages en priorité depuis le réseau).

---

## 12. Dépannage

| Symptôme | Cause probable / action |
|---|---|
| API : « Service temporairement indisponible » (503) | Django n'a pas démarré : lire `mon_armoire/backend/logs/startup_error.log` |
| « PostgreSQL 14 or later is required » | Django 5.2 installé par erreur : réinstaller `requirements.txt` (Django 5.1.15) |
| Erreur au démarrage « SECRET_KEY trop faible » | renseigner une clé de 50 caractères minimum dans `.env` |
| Page blanche sur `monarmoire.store` | `index.html` absent de `public_html/` |
| 404 en rechargeant `/catalogue` | `.htaccess` absent de `public_html/` (fichier caché) |
| Photos cassées | `MEDIA_ROOT`/`MEDIA_URL` du `.env` ; photos présentes dans `public_html/media/` ; lancer `generate_thumbnails` |
| Erreur CORS dans la console du navigateur | `CORS_ALLOWED_ORIGINS` du `.env` ; redémarrer l'application |
| Boucle de redirections HTTPS | `SECURE_PROXY_SSL_HEADER_ENABLED=True` |
| Paiement fait mais commande « En attente » | webhook non déclaré ou secret erroné (étape 9) ; la page de retour du client déclenche aussi la vérification |
| Mails non reçus | `preflight --send-test-mail` ; essayer `EMAIL_HOST=mail.monarmoire.store`, port 465, `EMAIL_USE_SSL=True` |
| Admin Django sans style | `collectstatic` non lancé |
| Photos du catalogue qui apparaissent lentement ou pas du tout par moments | normal avec l'hébergement mutualisé : la file d'attente d'images (6 à la fois) les recharge automatiquement |
