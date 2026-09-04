# MMA Universe — Profil & préférences (combattants, nationalités) — web

Date : 2026-09-04

## Contexte

Le site a déjà un compte utilisateur minimal, construit pour le pick'em (voir `docs/superpowers/specs/2026-08-21-pickem-fantasy-design.md`) : Clerk pour l'auth, une table `users` interne (`external_auth_id`, `display_name`), et un flux `/sign-in` `/sign-up` fonctionnel. Aucune notion de profil ou de préférences n'existe au-delà de ça.

Ce chantier ajoute la possibilité pour un utilisateur connecté d'indiquer ses **combattants préférés** et ses **nationalités préférées**, capturées juste après l'inscription (skippable) et modifiables à tout moment depuis une page profil. C'est un chantier **web uniquement** — l'app mobile (Expo, `mobile/`) n'a aujourd'hui aucune auth ni profil ; elle fera l'objet d'une spec séparée qui réutilisera le même backend.

Cette version stocke et affiche les préférences ; elle ne modifie **aucun** autre écran du site (pas de personnalisation de la home, pas d'alertes) — voir Hors périmètre.

## Décisions actées (issues du brainstorming)

- **Onboarding proposé mais skippable** : après le sign-up Clerk, redirection vers `/onboarding` avec un bouton "Plus tard" ; jamais de blocage forcé.
- **Profil minimal** : uniquement les préférences (combattants + nationalités). Pas de pseudo/bio éditable dans cette spec — le pseudo reste géré par Clerk et continue de se resynchroniser automatiquement via `getOrCreateCurrentUser` (`data/lib/picks-data.ts`), sans changement.
- **Aucun usage des préférences ailleurs sur le site pour l'instant** — juste stockées et éditables. La personnalisation (home, alertes) est un chantier futur séparé.
- **Combattants préférés** : recherche + ajout, pas de limite imposée.
- **Nationalités préférées** : liste des nationalités réellement présentes en base (pas la liste ISO complète), affichée en grille de drapeaux cliquables.
- **Stockage en tables de jointure dédiées** (pas de colonnes tableau sur `users`, pas de table générique `type`/`value`) — cohérent avec le pattern déjà utilisé par `picks`, garde une vraie FK vers `fighters(id)`.

## Modèle de données

Deux nouvelles tables Postgres/Neon, créées dans `app/seed/route.ts` selon le même pattern `CREATE TABLE IF NOT EXISTS` que le reste du schéma :

```sql
-- Un combattant préféré par utilisateur.
CREATE TABLE IF NOT EXISTS user_fighter_preferences (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id),
  fighter_id INT NOT NULL REFERENCES fighters(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, fighter_id)
);

-- Une nationalité préférée par utilisateur. Pas de FK : nationality_code est
-- un TEXT libre, comme fighters.nationality lui-même (y compris les codes
-- non-ISO "en"/"wa"/"nb" documentés dans components/ui/shared/country-flag.tsx).
CREATE TABLE IF NOT EXISTS user_nationality_preferences (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id),
  nationality_code TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, nationality_code)
);
```

Nouveau module `data/lib/profile-data.ts`, calqué sur `data/lib/picks-data.ts` :

- `fetchPreferredFighters(userId)` — combattants préférés, jointure vers `fighters` pour nom/image/nationalité/organisation.
- `addPreferredFighter(userId, fighterId)` — `INSERT ... ON CONFLICT (user_id, fighter_id) DO NOTHING` (idempotent).
- `removePreferredFighter(userId, fighterId)` — `DELETE`, idempotent si absent.
- `fetchPreferredNationalities(userId)` — codes préférés de l'utilisateur.
- `addPreferredNationality(userId, code)` — valide `code` contre `fetchAvailableNationalities()` avant insert.
- `removePreferredNationality(userId, code)` — idempotent si absent.
- `fetchAvailableNationalities()` — `SELECT DISTINCT nationality FROM fighters WHERE nationality IS NOT NULL ORDER BY nationality`, pour peupler la grille de drapeaux.

## Écrans web

- **`/onboarding`** (nouvelle page, `app/onboarding/page.tsx`) : server component, redirige vers `/sign-in` si non connecté. Un seul écran (pas de wizard multi-étapes) avec deux blocs :
  1. **Combattants préférés** : champ de recherche live (nouvel endpoint `GET /api/fighters/search?q=`, réutilise `fetchFighters`), clic sur un résultat → ajouté à la liste avec bouton retirer.
  2. **Nationalités préférées** : grille de drapeaux (`CountryFlag`) construite depuis `fetchAvailableNationalities()`, toggle au clic.
  - Deux actions : **"Terminer"** (redirige vers `/`) et **"Plus tard"** (skip, redirige vers `/` — ce qui est déjà sélectionné au clic reste enregistré, seul le flux se termine).
  - Déclenché après inscription via `<SignUp fallbackRedirectUrl="/onboarding" />` dans `app/sign-up/[[...sign-up]]/page.tsx`.
- **`/profil`** (nouvelle page, `app/profil/page.tsx`) : mêmes deux blocs que l'onboarding, sans notion de "terminer/plus tard" — écran d'édition permanent. Réutilise les mêmes composants client (`FighterPreferencePicker`, `NationalityPreferencePicker`) que l'onboarding. Si non connecté : même état "Connecte-toi pour voir ton profil" que `/mes-pronostics`.
- **Nav** (`components/ui/nav.tsx`) : ajout d'un lien **"Mon profil"** à côté de "Mes pronostics", visible uniquement `SignedIn`.

## API

- `GET /api/fighters/search?q=` — recherche légère (réutilise `fetchFighters` avec juste `query`, résultats non paginés/limités raisonnablement) pour peupler le picker en live.
- `POST /api/profile/fighters` `{ fighterId }` → ajoute une préférence. `DELETE /api/profile/fighters` `{ fighterId }` → retire.
- `POST /api/profile/nationalities` `{ code }` → ajoute (400 si `code` absent de `fetchAvailableNationalities()`). `DELETE /api/profile/nationalities` `{ code }` → retire.
- Toutes les routes : `401` si non connecté (même message que `app/api/picks/route.ts` : "Vous devez être connecté..."), `export const dynamic = 'force-dynamic'` (même raison que `picks`/`seed` : éviter que le Data Cache de Next avale les requêtes `@neondatabase/serverless`).

## Gestion des erreurs et cas limites

- Non connecté sur `/onboarding` ou `/profil` → redirection / état "connecte-toi", jamais d'erreur brute.
- Ajout d'une préférence déjà existante → idempotent (`ON CONFLICT DO NOTHING`), réponse `200 { ok: true }`, pas une erreur.
- Retrait d'une préférence inexistante → idempotent, `200 { ok: true }`.
- `fighterId` inconnu en base → `404`, message FR ("Combattant introuvable."), même style que `fightId` dans `app/api/picks/route.ts`.
- `code` de nationalité hors de la liste disponible → `400` ("Nationalité invalide.").
- Aucune sélection + clic "Terminer" dans l'onboarding → autorisé, équivalent à "Plus tard".

## Tests

`data/lib/profile-data.test.ts` (même runner `tsx --test`, pattern `data/**/*.test.ts`) :

- `addPreferredFighter` / `removePreferredFighter` : idempotence (ajout deux fois de suite, retrait d'une préférence absente).
- `addPreferredNationality` rejette un code absent de `fetchAvailableNationalities()`.
- `fetchPreferredFighters` retourne les données jointes attendues (nom, image, nationalité).

Pas de test end-to-end de l'UI (le repo n'a pas d'infra de test de composants React aujourd'hui) — vérification manuelle du flux après implémentation.

## Vérification manuelle

1. Créer un compte via `/sign-up` → redirection automatique vers `/onboarding`.
2. Rechercher et ajouter 2-3 combattants préférés ; sélectionner 2-3 nationalités ; cliquer "Terminer" → redirection vers `/`, préférences bien enregistrées.
3. Recommencer avec un second compte, cliquer "Plus tard" sans rien sélectionner → redirection vers `/` sans erreur.
4. Depuis la nav, ouvrir "Mon profil" (connecté) → les préférences enregistrées à l'étape 2 s'affichent ; en retirer une, en ajouter une nouvelle → persisté après rechargement de la page.
5. Se déconnecter, visiter `/onboarding` puis `/profil` → état "connecte-toi", pas d'erreur serveur.
6. Tenter (via l'API directement, pas l'UI qui ne le permet pas) d'ajouter un `fighterId` inexistant → `404` ; un `code` de nationalité fantaisiste → `400`.

## Hors périmètre

- Personnalisation de la home ou d'autres écrans à partir des préférences (section "Vos combattants" mise en avant, alertes) — chantier futur séparé.
- Édition du pseudo ou d'une bio — reste géré par Clerk.
- Limite de nombre de combattants/nationalités préférés.
- Organisations préférées.
- Volet mobile (Expo) — spec séparée à venir, réutilisera ce backend (tables + endpoints `/api/profile/*` et `/api/fighters/search`).

## Risques / points d'attention

- **`GET /api/fighters/search` est un nouvel endpoint public** (pas de vérification d'auth nécessaire pour chercher un combattant, seulement pour enregistrer une préférence) — à borner correctement (ex. limite de résultats, pas de scan complet de la table) pour éviter qu'il devienne un vecteur d'abus, même si le volume actuel de `fighters` reste modeste.
- **`fallbackRedirectUrl` sur `<SignUp>`** : à vérifier contre la version exacte de `@clerk/nextjs` installée (`^6.39.6`) au moment de l'implémentation — le nom de la prop a changé entre versions majeures de Clerk (`afterSignUpUrl` → `fallbackRedirectUrl`/`forceRedirectUrl`).
