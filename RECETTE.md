# HOLMIA — Recette des exigences obligatoires

- **Date :** 24 novembre 2026 — **Responsable :** ABD
- **Base testée :** `main` au commit `8132f07` (PR #16 + « notif »), puis branche `feature/abd-recette-2026-11-24` avec les corrections ci-dessous.
- **Environnement :** Windows 11, Node.js 24, Expo SDK 58, Supabase (projet HOLMIA, clé publique uniquement).

## 1. Contrôles automatiques

| Contrôle | Commande | Avant corrections | Après corrections |
| :--- | :--- | :--- | :--- |
| Tests métier locaux (SQLite) | `npm run test:all` | ✅ passent | ✅ passent (12 suites) |
| Parcours Buyer / Seller / Agent sur une même base | `npm run test:e2e` | ✅ 35 vérifications | ✅ 40 vérifications (favoris ajoutés) |
| Filtres du catalogue contre Supabase (lecture seule) | `npm run test:catalogue:supabase` | ❌ échouait (lancé sans `.env`, absent de `test:all`) | ✅ 25 vérifications, aucune ligne modifiée |
| Lint | `npm run lint` | ❌ **21 erreurs** | ✅ 0 erreur (15 avertissements non bloquants) |
| Configuration Expo | `npx expo-doctor` | ✅ 20/20 | ✅ 20/20 |
| Bundles | `npx expo export --platform android --platform ios --platform web` | ✅ | ✅ |

Les tests sur appareil (Expo Go / development build) restent distincts de ces contrôles et sont à faire avant la soutenance.

## 2. Matrice des exigences

Légende : **L** = validé par test automatique sur la base locale. **S** = règle écrite dans une migration Supabase avec son script de vérification (`scripts/check-*.sql`), à exécuter après application des migrations.

| Exigence | Ce qui est vérifié | Preuve | Statut |
| :--- | :--- | :--- | :--- |
| **Buyer** | Catalogue filtré, favoris, demande + réponse, offre et suivi, candidature et suivi (10 fonctions) | `test:e2e`, `test:catalogue:supabase` | ✅ L + Supabase (filtres) |
| **Seller** | Créer, modifier, publier, voir les offres, accepter, historique, portefeuille, supprimer (7 fonctions) | `test:e2e`, `test:seller-edit`, `test:seller-form` | ✅ L, S |
| **Agent** | Publier, demandes, répondre, statut, candidatures, décider, « loué », portefeuille multi-biens, modifier (9 fonctions) | `test:e2e`, `test:transitions` | ✅ L, S |
| **CRUD** | Création, lecture, modification, suppression des biens ; droits propriétaire / agent ; verrous Under Offer ; aucune ligne orpheline | `test:repositories`, `test:seller-edit`, `test:persistence` | ✅ L, S |
| **Filtres** | Prix, lieu, type, vente/location, réinitialisation, prix invalides | `test:repositories`, `test:catalogue:supabase` | ✅ L + Supabase en direct |
| **Favoris** | Ajout sans doublon, suppression, privés par acheteur, réservés aux acheteurs, persistants | `test:e2e` | ✅ L — ⚠️ table Supabase hors dépôt (D-11) |
| **Offres** | Seuls propriétaire / agent assigné décident ; une seule acceptée ; autres refusées ; bien Under Offer ; décision visible par l'acheteur | `test:offers`, `test:e2e`, `check-offers.sql` | ✅ L, S |
| **Locations** | Date d'emménagement et notes ; décision visible ; Active → Under Offer → Rented ; Rented définitif | `test:rentals`, `test:e2e`, `check-rental-decisions.sql` | ✅ L, S — ⚠️ table Supabase hors dépôt (D-11) |
| **Statistiques** | Biens actifs, prix moyen, biens par vendeur, offres par bien (agent connecté uniquement) | `test:repositories` (métriques), `check-recette.sql` | ✅ L, S (corrigé : D-05) |
| **Historique** | Chaque changement de statut enregistré (auteur, date, note) ; Sold/Rented définitifs ; erreurs explicites | `test:transitions`, `test:e2e`, `check-property-transitions.sql` | ✅ L, S |

## 3. Défauts constatés

| ID | Gravité | Défaut | Correction | Statut |
| :--- | :--- | :--- | :--- | :--- |
| D-01 | **Bloquant** | Écran Add/Edit (`AgentModerationScreen`) : variable `isLocked` non définie → l'écran plante côté vendeur | Alias vers `isCommercialLocked` | ✅ Corrigé |
| D-02 | **Bloquant** | Écran Add/Edit : un nouveau bien n'était jamais créé, mais « ✅ Draft saved (Live in Supabase) » s'affichait ; toutes les erreurs masquées (« saved locally ») | Création réelle (`createProperty`), un seul chemin d'enregistrement, erreur affichée, rien n'est annoncé enregistré en cas d'échec | ✅ Corrigé |
| D-03 | **Bloquant** | `propertyService` : en cas de refus de Supabase, création/modification appliquées à une liste en mémoire et annoncées réussies ; catalogue remplacé par des biens inventés en cas d'erreur | Erreurs Supabase remontées ; la liste en mémoire ne sert qu'en mode démo sans Supabase configuré | ✅ Corrigé |
| D-04 | **Bloquant** | ID « agent de démo » codé en dur = identifiant d'un **bien** → Supabase refuse l'agent | Vrais agents via `list_agents()` (écran Add/Edit et service de messagerie) | ✅ Corrigé |
| D-05 | **Bloquant** | Statistiques agent : « offres par bien » inventées (2 si Under Offer, 1 si Active), biens de tous les agents comptés, chiffres de démo en cas d'erreur | Fonction `agent_dashboard()` calculée par la base pour l'agent connecté ; erreur affichée | ✅ Corrigé |
| D-06 | **Bloquant** | Messagerie : message annoncé « envoyé » alors que Supabase l'a refusé ; faux agents proposés | Erreur affichée, plus de faux agents | ✅ Corrigé |
| D-07 | **Bloquant (sécurité)** | Messages privés vendeur ↔ agent recopiés dans `public.messages`, lisible **sans compte** ; fils mélangés (messages d'autres conversations attribués à la mauvaise personne) | Plus de copie ni de mélange ; `public.messages` fermée aux visiteurs non connectés ; l'agent lit/répond au vendeur via Received → Messages (`property_messages`, protégé) | ✅ Corrigé |
| D-08 | **Bloquant (publication)** | `npm run lint` : 21 erreurs (exigé par AGENTS.md avant publication) | Corrections sans changement de comportement (chargements initiaux, refs d'animation) | ✅ Corrigé |
| D-09 | Majeur | Portefeuilles : « My listings » du vendeur affichait les biens des autres vendeurs ; portefeuille agent = biens de tous les agents ; nombre d'offres inventé | Filtre sur l'utilisateur connecté ; vrais compteurs d'offres | ✅ Corrigé |
| D-10 | Majeur | Cycle de vie → « See offers » : offres fictives, Accept/Reject sans effet réel ; validation de brouillon par l'agent annoncée réussie même en cas de refus | Vraies offres / candidatures du bien, décisions transactionnelles ; erreur affichée | ✅ Corrigé |
| D-11 | **Bloquant (livraison)** | La migration Supabase « final_workflows » (tables `rental_applications`, `favourites`, fonctions d'origine) a été appliquée dans le tableau de bord mais **n'est pas dans le dépôt** : une installation depuis le dépôt échoue (`20261124095144` et suivantes en dépendent) | Hors de portée : seul son autrice a le SQL. Les migrations ABD s'arrêtent avec un message clair si la table manque | ❌ **Ouvert** — Ariel |
| D-12 | Mineur | Test des filtres en direct absent de `npm run` | Script `test:catalogue:supabase` | ✅ Corrigé |
| D-13 | Mineur | `public.messages` reste lisible par **tout utilisateur connecté** (pas de colonne participant) | À revoir : faire migrer l'écran Messages de l'équipe vers `property_messages` | ⏳ Ouvert (non bloquant) |
| D-14 | Mineur | Agent → Review → « Reject » : le brouillon disparaît localement mais réapparaît au rafraîchissement (aucun état « refusé » en base) | À décider en équipe (statut ou note de refus) | ⏳ Ouvert (non bloquant) |

## 4. Recette Supabase à exécuter

Dans le SQL Editor, après avoir ajouté au dépôt et appliqué la migration « final_workflows » (D-11), appliquer dans l'ordre les migrations encore absentes du projet, puis lancer chaque script de vérification. Chaque script annule tout ce qu'il crée et affiche une ligne `TEST_RESULT` à comparer avec la valeur attendue en tête de fichier.

| Migration | Script de vérification |
| :--- | :--- |
| `20261119130000_seller_edit_delete_rules.sql` | `scripts/check-seller-edit-delete.sql` |
| `20261120120000_seller_agent_messaging.sql` | `scripts/check-messaging.sql` |
| `20261121120000_offers_decisions.sql` | `scripts/check-offers.sql` |
| `20261122120000_enquiries.sql` | `scripts/check-enquiries.sql` |
| `20261124120000_rental_decisions.sql` | `scripts/check-rental-decisions.sql` |
| `20261124130000_property_transitions.sql` | `scripts/check-property-transitions.sql` |
| `20261124140000_recette_fixes.sql` | `scripts/check-recette.sql` |

## 5. Conclusion

Toutes les exigences obligatoires sont validées sur la base locale, et leurs règles Supabase sont écrites et vérifiables. Les dix défauts bloquants ou majeurs trouvés dans l'application sont corrigés. **Un défaut bloquant reste ouvert (D-11)**. Il ne dépend pas de l'application : il faut ajouter au dépôt la migration « final_workflows » déjà appliquée dans Supabase, puis exécuter la recette Supabase (section 4).
