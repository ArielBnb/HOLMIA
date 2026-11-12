# HOLMIA

Application mobile universitaire de marketplace immobilière pour la vente et la location, destinée aux **Buyer, Seller et Agent**.

Équipe : **Ariel, ABD et Timothé**. Livraison : **2 décembre 2026 à 17 h**, horaire du cahier des charges.

## Technologies

- React Native, Expo SDK 58 et JavaScript, modèle officiel `blank`.
- npm et `package-lock.json` pour reproduire les installations.
- GitHub privé, branche principale `main`.
- Supabase PostgreSQL et Supabase Auth : client installé, tables et RLS en mission 2.

## Installation sur Windows

Prérequis : Node.js **24 LTS**, npm, Git et éventuellement VS Code. Sources officielles : https://nodejs.org/ et https://git-scm.com/downloads/win.

Vérifier dans PowerShell :

```powershell
node --version
npm --version
git --version
```

Choisir son dossier de travail, puis :

```powershell
git clone https://github.com/ArielBnb/HOLMIA.git
cd HOLMIA
npm ci
code .
```

Le dépôt est privé : utiliser un compte GitHub autorisé. Si le dossier HOLMIA existe déjà, vérifier son contenu avant toute nouvelle copie.

## Démarrer Expo

```powershell
npm start
```

- `npm run android` : ouvrir sur Android, avec un appareil ou émulateur compatible.
- `npm run ios` : ouvrir sur un simulateur iOS, sur macOS.
- `npx expo start --clear` : vider le cache Metro.
- `npx expo-doctor` : vérifier la configuration et les dépendances.
- `npx expo install --check` : vérifier les versions compatibles.
- `npx expo export --platform android --platform ios` : générer les bundles natifs sans compiler les applications.

Un appareil ou émulateur et un client natif compatible sont nécessaires pour vérifier l'affichage. Pendant la transition SDK 58, Expo recommande SDK 57 pour Expo Go sur appareil physique ; SDK 58 peut nécessiter un development build. Vérifier la compatibilité du client installé avant de scanner le QR code. Documentation : https://docs.expo.dev/more/create-expo/.

L'écran temporaire `DatabaseTestScreen` affiche les annonces actives venant de Supabase, avec le vert forêt `#183D35` et le fond ivoire `#F6F5F0`. `WelcomeScreen` est conservé. Le formulaire Login appartient à la mission 3.

## Structure

```text
HOLMIA/
├── assets/
├── src/
│   ├── components/
│   ├── screens/       # WelcomeScreen.js
│   ├── navigation/
│   ├── services/
│   ├── config/
│   └── styles/        # theme.js
├── App.js
├── index.js           # Point d'entrée Expo
├── app.json
├── package.json
├── package-lock.json
├── .gitignore
└── README.md
```

Les fichiers `.gitkeep` conservent les dossiers encore vides dans Git.

## Collaborer via GitHub

ABD et Timothé doivent fournir leurs identifiants GitHub exacts avant toute invitation. Ne pas inviter de compte supposé.

Pour chaque tâche :

```powershell
git switch main
git pull --ff-only origin main
git switch -c feature/nom-de-la-tache
# Modifier et vérifier les fichiers
git add chemin/du/fichier
git diff --cached
git commit -m "Describe the change"
git push -u origin feature/nom-de-la-tache
```

Ouvrir une Pull Request vers `main` et demander une revue à un membre de l'équipe. Après fusion, récupérer `main` avant la tâche suivante. Ne pas partager `node_modules`, les caches Expo ou les fichiers `.env`.

Ajouter les dépendances natives avec `npx expo install nom-du-paquet` et versionner ensemble `package.json` et `package-lock.json`.

## Mission 2 : Supabase

Projet : [HOLMIA](https://supabase.com/dashboard/project/icfqjwfmcwlejqpezhyi), offre Free, Irlande `eu-west-1`.
API : `https://icfqjwfmcwlejqpezhyi.supabase.co`.

### Configurer l'application

```powershell
npm ci
Copy-Item .env.example .env
# Remplir les deux variables publiques depuis Supabase > Settings > API Keys.
npm start
# Option de vérification dans un navigateur :
npx expo start --web
```

La clé requise commence par `sb_publishable_`. Les variables `EXPO_PUBLIC_*` sont incluses dans les bundles : elles sont publiques. Ne jamais y mettre `sb_secret_*`, `service_role`, un mot de passe de test ou PostgreSQL. `.env` et `.env.test.local` sont ignorés par Git ; `.env.example` est versionné sans valeurs secrètes. Chaque membre récupère la configuration publique depuis le dashboard. Aucune clé administrateur n'est utilisée dans l'application ni dans les tests.

`src/config/supabase.js` utilise AsyncStorage sur mobile pour les futures sessions, l'actualisation du jeton en premier plan et un nettoyage de l'écouteur AppState. Le Web utilise le stockage du navigateur. Le renouvellement effectif et la restauration d'une session native devront être vérifiés sur appareil en mission 3. AsyncStorage n'est pas un coffre chiffré : envisager SecureStore et une stratégie adaptée avant un usage en production.

### Schéma et installation reproductible

- `supabase/migrations/20261112120000_holmia_foundation.sql` : tables `profiles` et `properties`, index, contraintes, fonctions privées, triggers et politiques RLS. Appliquée via SQL Editor sur le projet ci-dessus le 12 novembre 2026.
- Un nouveau projet vide peut recevoir ce SQL via SQL Editor, ou via la CLI Supabase (`supabase link --project-ref VOTRE_REF`, puis `supabase db push`). La migration crée le schéma une seule fois ; ne pas la rejouer sur les tables existantes. Si vous reprenez le projet hébergé déjà initialisé via SQL Editor, réconciliez d'abord l'historique CLI avec `supabase migration repair --status applied 20261112120000`.
- `supabase/seed.sql` : six biens fictifs (trois ventes et trois locations), UUID stables et `ON CONFLICT DO NOTHING`. Exige les vrais comptes Auth créés au préalable. Peut être rejoué sans dupliquer ni réinitialiser les annonces.
- Créer dans Authentication > Users > Add user > Create new user les comptes `buyer@holmia.example`, `seller@holmia.example`, `agent@holmia.example`, avec des mots de passe distincts et une confirmation automatique pour ces comptes fictifs uniquement. Aucun e-mail n'est envoyé. Les trois comptes existent déjà sur HOLMIA. Ne pas réinsérer ces comptes ni leurs mots de passe dans le SQL.
- Exécuter ensuite le seed en administration : il recherche les UUID réels dans Auth et attribue les rôles de démonstration. Les mots de passe de test sont conservés uniquement dans un fichier local ignoré ; les transmettre à l'équipe par un gestionnaire de mots de passe, jamais via GitHub. Ils ne sont pas nécessaires pour lire le catalogue public.

`profiles.id` référence `auth.users.id` ; aucun mot de passe ne se trouve dans `profiles`. Chaque inscription crée un profil Buyer : la métadonnée de signup ne peut pas attribuer Seller/Agent. En mission 3, l'interface peut demander un rôle, mais seule une administration de confiance doit le valider ; ne pas ajouter de mise à jour du rôle dans le client. Les suppressions de comptes/profils liés à des propriétés sont restreintes pour éviter une perte de données.

### Autorisations contrôlées par PostgreSQL

| Accès | Buyer | Seller | Agent | Non connecté |
| --- | --- | --- | --- | --- |
| Lire les annonces actives | Oui | Oui | Oui | Oui |
| Lire les annonces non actives | Non | Ses biens | Biens attribués | Non |
| Créer une annonce | Non | Pour lui-même | Non | Non |
| Modifier/supprimer une annonce | Non | Ses biens | Biens attribués | Non |
| Modifier son profil | Nom et pseudonyme | Nom et pseudonyme | Nom et pseudonyme | Non |
| Modifier son rôle | Non | Non | Non | Non |

Le catalogue actif est volontairement public pour tester la connexion avant Login. Les profils restent privés (lecture du sien uniquement). L'identité, le propriétaire et la date de création d'une annonce sont immuables ; un Agent ne peut pas réattribuer un bien. Le vendeur doit avoir le rôle Seller et l'agent le rôle Agent. Prix strictement positif, statuts compatibles vente/location, clés étrangères et dates contrôlés en base. Les fonctions de trigger sont privées, avec `search_path` fixé, et non appelables depuis l'API.

### Tests réels

Pour rejouer sur le projet de démonstration, créer localement `.env.test.local` avec `HOLMIA_BUYER_PASSWORD`, `HOLMIA_SELLER_PASSWORD` et `HOLMIA_AGENT_PASSWORD`. Node 24 est requis pour la commande ci-dessous :

```powershell
node --env-file=.env --env-file=.env.test.local scripts/test-supabase.mjs
npm run lint
npx expo-doctor
npx expo export --platform android --platform ios --platform web
```

Le script utilise uniquement la clé publishable et de vraies sessions Auth. Il modifie temporairement les descriptions/statuts de deux annonces de démonstration et les restaure ; ne pas l'exécuter sur un projet de production. Il ne supprime ni n'ajoute d'annonce. En cas d'interruption réseau pendant un test, vérifier que les six annonces de démonstration ont retrouvé le statut `active`.

Validation du 12 novembre 2026 : 16 contrôles fonctionnels réussis (lecture anonyme, connexions des trois rôles, isolation des profils, refus d'escalade, écritures interdites, écriture Seller persistante via un nouveau client, écriture Agent attribué, interdiction de réattribution, visibilité des brouillons, contraintes prix/statut/rôle). État final : six annonces actives. Lint et Expo Doctor 20/20 réussis, bundles Android/iOS/Web exportés. Le bundle Web a également été exécuté dans un test DOM (JSDOM) : l'écran React Native Web a monté et affiché les six annonces réellement récupérées depuis Supabase. Ce contrôle n'est pas un test sur appareil ni une validation visuelle dans un navigateur. Le navigateur distant n'a pas pu démarrer (socket Unix refusé) ; lancement natif, persistance de session sur appareil et contrôle visuel restent à effectuer.

### Extension et persistance locale

Les prochaines tables pourront référencer les UUID stables `profiles.id` et `properties.id` : offres, candidatures de location, favoris, demandes de renseignements et historique des statuts. Elles ne sont pas créées en mission 2. Leur conception devra préciser les contraintes d'unicité et les politiques RLS par participant ; l'historique devra être généré côté serveur.

**Écart au cahier des charges :** celui-ci prévoit une base locale ; notre choix d'équipe est Supabase PostgreSQL, distant et persistant entre les redémarrages. AsyncStorage conserve les sessions, pas les annonces. Si le professeur exige également une base locale, proposer `expo-sqlite` comme cache du catalogue avec date de synchronisation, lecture hors ligne, remise à jour depuis Supabase au retour du réseau et purge des données privées à la déconnexion. Garder Supabase comme source de vérité et appliquer ses permissions lors de la synchronisation. Ce cache n'est pas implémenté ici ; faire valider ce choix avant la soutenance.

Sources officielles consultées : [Supabase Auth React Native](https://supabase.com/docs/guides/auth/quickstarts/react-native), [Expo Supabase](https://docs.expo.dev/guides/using-supabase/), [Expo CLI](https://docs.expo.dev/more/expo-cli/). Installation avec `npx expo install` ; la récupération en ligne des métadonnées a expiré via le proxy, puis le contrôle de compatibilité a réussi avec les métadonnées SDK locales (`EXPO_OFFLINE=1`). Versions retenues et résolutions exactes dans `package.json` et `package-lock.json`.

## Validation initiale

La préparation et les contrôles initiaux sont réalisés dans un environnement Linux distant. Cela ne certifie pas l'installation des outils ou du projet sur le PC Windows. Un lancement sur appareil reste nécessaire pour valider l'affichage natif.


Contrôles du 12 novembre 2026 :

- Node.js 24.22.1, npm 11.9.0 et Git 2.52.0 disponibles dans l'environnement distant.
- `npm run lint` : réussi.
- `npx expo-doctor` : 20/20 contrôles réussis.
- Exports Metro Android et iOS : réussis.
- Serveur Expo démarré en mode hors ligne ; endpoint `/status` : `packager-status:running`.
- Vérification en ligne des versions : une requête a expiré via le proxy ; le contrôle hors ligne confirme les versions à jour.
- Aucun appareil ni émulateur utilisé : affichage natif non vérifié.
