# MMA Universe — Priorité UFC sur la home

Date : 2026-09-03

## Contexte

La home (`/`, [app/page.tsx](../../../app/page.tsx)) affiche trois sections : le hero (`NextEventHero`), "Combats à venir" (fight card de l'event du hero), et "Derniers résultats" (4 derniers combats terminés). Le choix de l'event du hero et le tri des résultats se font aujourd'hui uniquement par proximité/ancienneté de date, toutes organisations confondues — `computeNextEvent` ([data/lib/event-utils.ts](../../../data/lib/event-utils.ts)) et `fetchRecentFinishedFights` ([data/lib/data.ts](../../../data/lib/data.ts)) n'ont aucune notion d'organisation "prioritaire".

L'UFC est l'organisation la plus suivie et doit être mise en avant en premier sur la home. Une vraie notion de "popularité d'event" (basée sur les favoris utilisateur, les organisations/combattants suivis après création de compte) est une idée pour plus tard, explicitement hors périmètre ici — ce chantier fixe l'UFC comme organisation prioritaire codée en dur (`organization_abbreviation === 'UFC'`), sans système générique de scoring.

## Périmètre

Deux sections de la home sont concernées : le hero et "Derniers résultats". "Combats à venir" n'a pas de changement propre — il suit automatiquement l'event choisi par le hero, comme aujourd'hui.

## 1. Hero — prochain event UFC en priorité

Nouvelle fonction `computeNextEventForHome` dans [data/lib/event-utils.ts](../../../data/lib/event-utils.ts), utilisée par `app/page.tsx` à la place de l'appel direct actuel à `computeNextEvent(events)` :

1. Filtrer `events` sur `organization_abbreviation === 'UFC'`.
2. Appliquer `computeNextEvent` à ce sous-ensemble.
3. Si un event UFC **à venir** (`isUpcoming: true`) est trouvé → c'est le hero.
4. Sinon (aucun event UFC à venir en base — que la liste UFC soit vide ou que son "next" retombe sur un event passé) → fallback : `computeNextEvent(events)` sur la liste complète, toutes orgs confondues (comportement actuel inchangé : prochain event le plus proche tous orgs, ou dernier event passé si rien n'est à venir nulle part).

Comportement résultant :
- Un event UFC à venir existe → toujours affiché en hero, même si une autre org a un event chronologiquement plus proche.
- Aucun event UFC à venir, mais une autre org en a un → cette autre org s'affiche en hero (jamais de hero vide s'il existe un event à venir quelque part).
- Aucun event à venir nulle part → fallback actuel sur le dernier event passé (toutes orgs), inchangé.
- Aucun event du tout en base → `EmptyState`, inchangé.

`app/page.tsx` : remplacer `computeNextEvent(events)` par `computeNextEventForHome(events)`. Le reste de la page (fetch des fights du hero, `mainEvent`/`rest`, "Combats à venir") ne change pas — il consomme déjà `next.event` / `next.isUpcoming` sans savoir quelle org a été choisie.

## 2. Derniers résultats — UFC priorisé parmi les résultats récents

Dans `fetchRecentFinishedFights(limit)` ([data/lib/data.ts](../../../data/lib/data.ts:393)) :

- La requête SQL récupère un pool plus large que `limit`, trié par date d'event décroissante (comme aujourd'hui) — `POOL_SIZE = 20` (constante locale au fichier), plutôt que `LIMIT ${limit}` directement.
- Le tri du pool est délégué à une nouvelle fonction pure `prioritizeOrganization` dans [data/lib/event-utils.ts](../../../data/lib/event-utils.ts) (testable unitairement sans DB, voir section Tests) : prend un tableau d'éléments portant `organization_abbreviation` + un critère de tri secondaire déjà appliqué en amont (ici l'ordre par date, préservé), et renvoie le tableau réordonné avec l'org prioritaire (`'UFC'`) en tête, tri stable (`Array.prototype.sort` est stable en JS/V8 — l'ordre par date déjà appliqué par SQL est donc préservé à l'intérieur de chaque groupe UFC / non-UFC).
- `fetchRecentFinishedFights` appelle `prioritizeOrganization(rows, 'UFC')` après le mapping des lignes, puis coupe à `limit` (4 aujourd'hui, appelant inchangé).

Effet : les résultats UFC parmi les 20 plus récents (toutes orgs) remontent en tête des 4 affichés, sans jamais faire apparaître un vieux résultat UFC (en dehors du pool des 20 plus récents) au-dessus d'un résultat récent d'une autre org — le pool borne la fraîcheur avant que la priorité UFC ne s'applique.

`POOL_SIZE = 20` est un choix arbitraire raisonnable (large marge par rapport à `limit = 4` actuel) ; pas de justification produit particulière au-delà de "assez large pour ne pas couper avant que le tri UFC ait un effet, assez borné pour rester 'récent'".

## Ce qui ne change pas

- Aucun système de score de popularité générique.
- Aucune dépendance aux comptes utilisateurs, favoris, organisations/combattants suivis — remis à plus tard, hors périmètre.
- `computeNextEvent`, `computeNextEventByOrg` : inchangées, réutilisées telles quelles.
- Signature de `fetchRecentFinishedFights(limit)` : inchangée côté appelant (`app/page.tsx`).
- "Combats à venir" : aucun changement de code, comportement dérivé du hero comme aujourd'hui.

## Données

Aucun changement de schéma. `organization_abbreviation` est déjà exposé par `fetchAllEvents()` (jointure `organizations`) et par `fetchRecentFinishedFights()` (déjà présent dans `FightResultWithContext`).

## États vides

Inchangés par rapport au comportement actuel :
- Aucun event en base → `EmptyState`.
- Hero retombé sur un event passé (`isUpcoming: false`) → "Combats à venir" masquée.
- Aucun combat terminé en base → "Derniers résultats" masquée (pool vide → `limit` résultats vide après tri).

## Tests

Le projet a une suite de tests unitaires (`npm test` → `tsx --test "data/**/*.test.ts"`, runner natif Node) pour les fonctions pures de `data/lib/`, dont déjà [event-utils.test.ts](../../../data/lib/event-utils.test.ts). `computeNextEventForHome` étant une fonction pure (pas d'accès DB), elle est testable unitairement selon les mêmes conventions — cas à couvrir :
- Event UFC à venir + event d'une autre org chronologiquement plus proche → retourne l'event UFC.
- Aucun event UFC à venir, autre org en a un → retourne l'event de cette autre org (fallback).
- Aucun event à venir nulle part (toutes orgs) → retourne le dernier event passé, `isUpcoming: false` (fallback du fallback).
- Liste d'events vide → retourne `null`.
- Plusieurs events UFC à venir → retourne le plus proche (pas juste le premier de la liste).

`fetchRecentFinishedFights` touche la DB (comme le reste de `data/lib/data.ts`, qui n'a aucun test unitaire aujourd'hui — pas de mock DB dans le projet) ; le tri UFC-d'abord qu'elle applique est en revanche une fonction pure et peut être extraite dans `event-utils.ts` (ex. `sortWithOrgFirst` ou logique inline testable séparément) plutôt que testée seulement via la DB. Vérification manuelle via navigateur pour l'intégration bout-en-bout (hero + section résultats sur la page réelle).

## Hors périmètre (rappel)

- Notion générique de "popularité d'event" (score, engagement, etc.).
- Priorisation basée sur les favoris utilisateur (organisations/combattants suivis) — nécessite des comptes utilisateurs, qui n'existent pas encore (cf. spec refonte home du 2026-08-20, section Profile).
- Extension de la logique UFC-first à d'autres pages (`/events`, `/organizations`, etc.).
