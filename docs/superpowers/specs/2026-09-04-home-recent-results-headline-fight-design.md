# MMA Universe — Un seul combat (le main event) par événement dans "Derniers résultats"

Date : 2026-09-04

## Contexte

La section "Derniers résultats" de la home ([app/page.tsx:88](../../../app/page.tsx)) affiche `RECENT_RESULTS_COUNT = 4` combats via `fetchRecentFinishedFights(4)` ([data/lib/data.ts:469](../../../data/lib/data.ts)). Cette fonction récupère un pool des `POOL_SIZE = 20` combats terminés les plus récents (`ORDER BY e.date DESC`, sans tri secondaire), fait remonter ceux de l'UFC en tête via `prioritizeOrganization` (cf. [2026-09-03-home-ufc-priority-design.md](2026-09-03-home-ufc-priority-design.md)), puis coupe à 4.

Problème : la requête n'a aucune notion de place du combat sur la carte. Un événement récent avec beaucoup de combats terminés (ex. UFC Fight Night 286 en a 13 en base) peut à lui seul remplir les 4 places affichées avec des combats pris dans un ordre non significatif — vérifié en base, le main event réel (`is_main_event = true`) n'était pas garanti d'en faire partie. Résultat perçu par l'utilisateur : des combats "au hasard" plutôt que les têtes d'affiche.

`is_main_event` est fiable pour les événements récents (le pipeline de sync actuel le renseigne correctement — confirmé sur les events du 28 et 29/08/2026, un seul `true` par event), mais pas pour les plus anciens (ex. UFC 330 du 15/08/2026 : `false` sur tous les combats, jamais backfillé). La convention déjà utilisée ailleurs dans le code pour ce cas — `fetchFightsByEvent` ([data/lib/data.ts:132](../../../data/lib/data.ts)) et `splitMainEvent` ([data/lib/fight-utils.ts:9](../../../data/lib/fight-utils.ts)) — est de retomber sur l'`id` le plus bas du combat (les scrapers insèrent le main event en premier). On réutilise la même convention ici plutôt que d'introduire une nouvelle règle.

## Périmètre

Seule la section "Derniers résultats" de la home est concernée. Le hero, "Combats à venir" et "Cette semaine" n'ont aucun changement.

## Design

Nouvelle fonction pure `selectHeadlineFightPerEvent` dans [data/lib/event-utils.ts](../../../data/lib/event-utils.ts), à côté de `prioritizeOrganization` qu'elle précède dans le pipeline :

- Entrée : un tableau d'éléments portant `event_id`, `id`, `is_main_event` (ex. `FightResultWithContext[]`).
- Pour chaque `event_id` rencontré, garde un seul élément : celui avec `is_main_event === true` s'il y en a un, sinon celui avec le plus petit `id`.
- Préserve l'ordre de première apparition des `event_id` dans le tableau d'entrée (déjà trié par date décroissante en amont par la requête SQL) — pas de re-tri interne.

Dans `fetchRecentFinishedFights(limit)` ([data/lib/data.ts:469](../../../data/lib/data.ts)) :

- `POOL_SIZE` passe de 20 à 60 (combats bruts, pas événements) : avec un seul combat retenu par événement, il faut un pool de combats plus large pour couvrir suffisamment d'événements distincts derrière les cartes les plus fournies. 60 reste un choix arbitraire raisonnable (marge large par rapport à des cartes de 13 combats), pas de justification produit au-delà de "assez large pour ne pas couper la sélection avant d'atteindre plusieurs événements distincts".
- Pipeline après mapping des lignes : `selectHeadlineFightPerEvent(mapped)` → `prioritizeOrganization(..., 'UFC')` (inchangé) → `.slice(0, limit)` (inchangé).

Effet : les 4 lignes affichées viennent chacune d'un événement différent, chacune étant le main event de sa carte ; le dernier main event UFC apparaît toujours en premier tant qu'il est dans le pool des 60 combats les plus récents.

Limite connue et acceptée : si un événement à la limite du pool (le plus ancien inclus) a une carte si longue que son main event tombe hors des 60 combats retenus, ce main event ne sera pas repêché pour cet événement précis — comportement déjà présent aujourd'hui (même limite sur le pool actuel de 20), pas une régression.

## Ce qui ne change pas

- `prioritizeOrganization`, `computeNextEventForHome` : inchangées, réutilisées telles quelles.
- Signature de `fetchRecentFinishedFights(limit)` : inchangée côté appelant (`app/page.tsx`).
- `FightResultRow`, le composant d'affichage : inchangé, continue de recevoir des `FightResultWithContext`.
- Aucun changement de schéma ni de scraper : on consomme `is_main_event`/`id` tels qu'ils existent déjà.

## États vides

Inchangés : aucun combat terminé en base → pool vide → `selectHeadlineFightPerEvent` et `prioritizeOrganization` reçoivent/renvoient `[]` → section masquée comme aujourd'hui.

## Tests

Cas à ajouter dans [event-utils.test.ts](../../../data/lib/event-utils.test.ts) pour `selectHeadlineFightPerEvent` :
- Deux combats du même `event_id`, un seul `is_main_event: true` → garde celui-là, peu importe sa position dans le tableau d'entrée.
- Deux combats du même `event_id`, aucun `is_main_event: true` → garde celui avec le plus petit `id`.
- Deux combats du même `event_id`, plusieurs `is_main_event: true` (cas observé en base, ex. Road to UFC Season 5 Shanghai Semifinals) → garde le premier rencontré parmi ceux marqués `true` (le plus petit `id` parmi eux), pour un résultat déterministe.
- Plusieurs `event_id` distincts → un élément par event_id en sortie, ordre de première apparition préservé.
- Tableau vide → `[]`.

`fetchRecentFinishedFights` reste non testée unitairement (accès DB direct, comme le reste de `data/lib/data.ts` — pas de mock DB dans le projet, cf. spec du 2026-09-03). Vérification manuelle via navigateur sur la home réelle pour l'intégration bout-en-bout.

## Hors périmètre (rappel)

- Toute notion de "main card" au-delà du seul main event (co-main, etc.) — explicitement reporté par l'utilisateur ("et après on avise").
- Backfill de `is_main_event` pour les anciens événements en base.
- Changement du nombre de résultats affichés (`RECENT_RESULTS_COUNT = 4`, inchangé).
