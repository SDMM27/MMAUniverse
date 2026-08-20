# MMA Universe — Nav globale + page Organisations

Date : 2026-08-20

## Contexte

Suite à la refonte éditoriale de la Home (`docs/superpowers/specs/2026-08-20-home-editorial-redesign-design.md`), la grille "Organisations" a été retirée de `/` et n'a nulle part où vivre : le composant `OrganizationsList`/`OrganizationCard` et la fonction `computeNextEventByOrg` sont toujours dans le code mais inutilisés (commentés comme "réservés pour une future page `/organizations`" au moment de cette refonte).

L'IA cible dessinée par l'utilisateur (Home / News / Events / Rankings / Profile) ne prévoyait pas d'onglet "Organisations" séparé — les organisations y apparaissent comme filtres (ex: Rankings > UFC/PFL/ONE). Décision prise pour ce chantier : on garde malgré tout une page `/organizations` dédiée, car on suit une douzaine d'organisations assez différentes et le composant de listing existe déjà, prêt à l'emploi. Ce choix pourra être reconsidéré plus tard si la nav cible (News/Rankings/Profile) voit le jour.

Ce chantier ne couvre que : nav globale (ajout du lien) + nouvelle page `/organizations` (liste). La page détail `/organizations/[slug]` reste inchangée (pas de roster de combattants — hors périmètre, chantier séparé). News, Rankings et Profile restent hors périmètre pour les raisons déjà documentées dans la spec Home (pas de source de données News, pas de vrais rankings, pas de comptes utilisateurs).

## Nav

Le nav actuel (`components/ui/nav.tsx`) a 3 liens : `Home` (`/`), `Events` (`/events`), `Fighters` (`/fighters`). On ajoute un 4ᵉ lien à la suite : **Organisations** → `/organizations`.

## Nouvelle page `/organizations`

Fichier : `app/organizations/page.tsx` (n'existe pas encore — seul `app/organizations/[slug]/page.tsx` existe aujourd'hui).

- Server Component, `export const dynamic = 'force-dynamic'` (même contrainte que les autres pages : le build Vercel n'a pas accès à `DATABASE_URL`, cf. `data/lib/db.ts`)
- Fetch `fetchOrganizations()` et `fetchAllEvents()` en parallèle (`Promise.all`)
- Calcule `nextByOrg` via `computeNextEventByOrg(events)` (existe déjà dans `data/lib/event-utils.ts`, actuellement non appelée)
- Construit `organizationsWithActivity` : pour chaque organisation, ajoute `nextEvent` (event + `isUpcoming`) et `eventCount` depuis `nextByOrg` — reprise exacte de la logique qui existait dans l'ancienne `app/page.tsx` avant la refonte Home (récupérable dans l'historique git, commit `0535375` ou antérieur)
- Titre de page : `Organisations (N)` où N est le nombre total d'organisations
- Rendu de la grille via `OrganizationsList` (`components/ui/organizations/organizations-list.tsx`) → `OrganizationCard` (`components/ui/organizations/organization-card.tsx`), tous deux déjà prêts et inchangés
- État vide : `EmptyState` (composant déjà existant) si `organizations.length === 0`
- Chaque `OrganizationCard` pointe vers `/organizations/[id]` (page détail existante, inchangée par ce chantier)

## Nettoyage des commentaires "réservé pour plus tard"

Deux endroits ont été annotés lors de la refonte Home comme "non utilisé, réservé pour une future page `/organizations`" :

- `computeNextEventByOrg` dans `data/lib/event-utils.ts` — le commentaire redevient faux une fois la fonction appelée par cette nouvelle page ; on le repasse en docstring factuelle (ce que fait la fonction, plus de mention de non-usage)
- `components/ui/organizations/organizations-list.tsx` — même chose, le commentaire "non rendu nulle part" devient faux ; on le retire

## Données

Aucune nouvelle fonction de requête nécessaire — `fetchOrganizations`, `fetchAllEvents` et `computeNextEventByOrg` existent déjà et sont utilisées telles quelles.

## Composants

Aucun nouveau composant — `OrganizationsList` et `OrganizationCard` existent déjà et sont utilisés tels quels.

## Tests

Pas de suite de tests automatisés dans le projet pour les pages/composants (cf. specs précédentes) ; vérification manuelle via navigateur, cohérent avec le reste du projet.

## Hors périmètre (rappel)

- Redesign de `/organizations/[slug]` (roster de combattants, etc.)
- Nav complète cible (News / Rankings / Profile)
- Onglets Events (Aujourd'hui / Cette semaine / À venir / Terminés)
- Rankings (bloqué : pas de vraies données de classement)
- News (bloqué : pas de source de données)
- Profile (différé)
