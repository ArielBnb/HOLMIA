# HOLMIA

Application mobile universitaire de marketplace immobilière pour la vente et la location, destinée aux **Buyer, Seller et Agent**.

Équipe : **Ariel, ABD et Timothé**. Livraison : **2 décembre 2026 à 17 h**, horaire du cahier des charges.

## Technologies

- React Native, Expo SDK 58 et JavaScript, modèle officiel `blank`.
- npm et `package-lock.json` pour reproduire les installations.
- GitHub privé, branche principale `main`.
- Prévu en mission 2 : **Supabase (PostgreSQL)** et **Supabase Auth**. Aucun client ni secret Supabase n'est configuré ici.

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

L'écran temporaire affiche **Welcome to HOLMIA**, avec le vert forêt `#183D35` et le fond ivoire `#F6F5F0`. Aucune fonctionnalité métier n'est développée.

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

1. Créer ou sélectionner le projet Supabase de l'équipe et sa région.
2. Définir les tables PostgreSQL et leurs relations.
3. Préparer Supabase Auth pour Buyer, Seller et Agent.
4. Activer la Row Level Security et définir les politiques d'accès.
5. Installer le client et ajouter un `.env.example` sans secret.
6. Utiliser uniquement l'URL et la clé publishable/anon destinées au client mobile. Les variables `EXPO_PUBLIC_*` sont publiques dans l'application : ne jamais y placer une clé `service_role` ou un secret serveur.

## Validation initiale

La préparation et les contrôles initiaux sont réalisés dans un environnement Linux distant. Cela ne certifie pas l'installation des outils ou du projet sur le PC Windows. Un lancement sur appareil reste nécessaire pour valider l'affichage natif.
