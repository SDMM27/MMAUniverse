# Priorité UFC sur la home — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sur la home (`/`), le hero affiche en priorité le prochain event UFC (fallback sur le comportement actuel si aucun UFC à venir), et "Derniers résultats" fait remonter les résultats UFC récents en tête des 4 combats affichés.

**Architecture:** Deux nouvelles fonctions pures dans `data/lib/event-utils.ts` (`computeNextEventForHome`, `prioritizeOrganization`), testables unitairement sans DB comme le reste de ce fichier. `data/lib/data.ts` (`fetchRecentFinishedFights`) et `app/page.tsx` sont modifiés pour les utiliser — pas de nouveau fichier.

**Tech Stack:** Next.js 14 (App Router), TypeScript, Neon Postgres (`@neondatabase/serverless`), runner de test natif Node (`node:test` + `tsx`, via `npm test`).

---

Spec de référence : [docs/superpowers/specs/2026-09-03-home-ufc-priority-design.md](../specs/2026-09-03-home-ufc-priority-design.md)

## Task 1: `computeNextEventForHome` — prochain event UFC en priorité, avec fallback

**Files:**
- Modify: `data/lib/event-utils.ts` (ajout en fin de fichier, après `computeNextEventByOrg`)
- Test: `data/lib/event-utils.test.ts`

- [ ] **Step 1: Write the failing tests**

Modifier l'import de `data/lib/event-utils.test.ts` :

```typescript
import { computeNextEventForHome, groupUpcomingByWeek, splitEventsByStatus } from './event-utils';
```

Ajouter en fin de `data/lib/event-utils.test.ts` :

```typescript
function makeEventWithOrg(id: number, date: string, organizationAbbreviation: string): Event & { organization_abbreviation: string } {
  return { ...makeEvent(id, date), organization_abbreviation: organizationAbbreviation };
}

test('computeNextEventForHome returns the next UFC event even when another org has a sooner one', () => {
  const events = [
    makeEventWithOrg(1, FUTURE[0], 'PFL'),
    makeEventWithOrg(2, FUTURE[1], 'UFC'),
  ];

  const result = computeNextEventForHome(events);

  assert.equal(result?.event.id, 2);
  assert.equal(result?.isUpcoming, true);
});

test('computeNextEventForHome picks the soonest UFC event when several are upcoming', () => {
  const events = [
    makeEventWithOrg(1, FUTURE[2], 'UFC'),
    makeEventWithOrg(2, FUTURE[0], 'UFC'),
    makeEventWithOrg(3, FUTURE[1], 'UFC'),
  ];

  const result = computeNextEventForHome(events);

  assert.equal(result?.event.id, 2);
});

test('computeNextEventForHome falls back to the next event of any org when no UFC event is upcoming', () => {
  const events = [
    makeEventWithOrg(1, PAST[0], 'UFC'),
    makeEventWithOrg(2, FUTURE[0], 'PFL'),
  ];

  const result = computeNextEventForHome(events);

  assert.equal(result?.event.id, 2);
  assert.equal(result?.isUpcoming, true);
});

test('computeNextEventForHome falls back to the last past event of any org when nothing is upcoming anywhere', () => {
  const events = [
    makeEventWithOrg(1, PAST[0], 'UFC'),
    makeEventWithOrg(2, PAST[1], 'PFL'),
  ];

  const result = computeNextEventForHome(events);

  assert.equal(result?.event.id, 2);
  assert.equal(result?.isUpcoming, false);
});

test('computeNextEventForHome returns null for an empty input', () => {
  assert.equal(computeNextEventForHome([]), null);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx tsx --test data/lib/event-utils.test.ts`
Expected: FAIL — `computeNextEventForHome` is not exported from `./event-utils` (module error, tests don't even start running).

- [ ] **Step 3: Implement `computeNextEventForHome`**

Ajouter en fin de `data/lib/event-utils.ts` :

```typescript
// UFC is the most-followed organization and gets priority placement on the
// home hero. This is a hardcoded rule, not a generic popularity system — a
// real preference-based ranking (favorited orgs/fighters) needs user
// accounts, which don't exist yet (see docs/superpowers/specs/2026-08-20-home-editorial-redesign-design.md,
// Profile section).
const PRIORITY_ORGANIZATION_ABBREVIATION = 'UFC';

/**
 * Home hero event selection: prefers the next upcoming UFC event over any
 * other organization's, even when another org's event is chronologically
 * sooner. Falls back to computeNextEvent's normal any-org behavior (soonest
 * upcoming event, or last past event if nothing is upcoming anywhere) when
 * there's no upcoming UFC event in `events`.
 */
export function computeNextEventForHome<T extends Event & { organization_abbreviation: string }>(
  events: T[],
): { event: T; isUpcoming: boolean } | null {
  const priorityEvents = events.filter(
    (event) => event.organization_abbreviation === PRIORITY_ORGANIZATION_ABBREVIATION,
  );
  const nextPriorityEvent = computeNextEvent(priorityEvents);

  if (nextPriorityEvent && nextPriorityEvent.isUpcoming) {
    return nextPriorityEvent;
  }

  return computeNextEvent(events);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx tsx --test data/lib/event-utils.test.ts`
Expected: PASS — `ℹ tests 14`, `ℹ pass 14`, `ℹ fail 0` (9 pré-existants + 5 nouveaux).

- [ ] **Step 5: Commit**

```bash
git add data/lib/event-utils.ts data/lib/event-utils.test.ts
git commit -m "feat(home): add computeNextEventForHome (UFC-first hero selection)" -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

## Task 2: `prioritizeOrganization` — tri stable priorité-org-d'abord

**Files:**
- Modify: `data/lib/event-utils.ts` (ajout en fin de fichier)
- Test: `data/lib/event-utils.test.ts`

- [ ] **Step 1: Write the failing tests**

Modifier l'import de `data/lib/event-utils.test.ts` (ajouter `prioritizeOrganization`) :

```typescript
import { computeNextEventForHome, groupUpcomingByWeek, prioritizeOrganization, splitEventsByStatus } from './event-utils';
```

Ajouter en fin de `data/lib/event-utils.test.ts` :

```typescript
test('prioritizeOrganization moves priority-org items before others, preserving relative order within each group', () => {
  const items = [
    { id: 1, organization_abbreviation: 'PFL' },
    { id: 2, organization_abbreviation: 'UFC' },
    { id: 3, organization_abbreviation: 'PFL' },
    { id: 4, organization_abbreviation: 'UFC' },
  ];

  const result = prioritizeOrganization(items, 'UFC');

  assert.deepEqual(
    result.map((item) => item.id),
    [2, 4, 1, 3],
  );
});

test('prioritizeOrganization returns items unchanged in order when none match', () => {
  const items = [
    { id: 1, organization_abbreviation: 'PFL' },
    { id: 2, organization_abbreviation: 'Bellator' },
  ];

  const result = prioritizeOrganization(items, 'UFC');

  assert.deepEqual(
    result.map((item) => item.id),
    [1, 2],
  );
});

test('prioritizeOrganization returns an empty array for an empty input', () => {
  assert.deepEqual(prioritizeOrganization([], 'UFC'), []);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx tsx --test data/lib/event-utils.test.ts`
Expected: FAIL — `prioritizeOrganization` is not exported from `./event-utils`.

- [ ] **Step 3: Implement `prioritizeOrganization`**

Ajouter en fin de `data/lib/event-utils.ts`, après `computeNextEventForHome` :

```typescript
/**
 * Stable-sorts `items` so every item whose `organization_abbreviation`
 * matches `priorityAbbreviation` comes before every item that doesn't,
 * preserving relative order within each group. Used to bubble UFC results
 * to the top of "Derniers résultats" without disturbing the date ordering
 * already applied upstream (Array.prototype.sort is a stable sort in
 * Node/V8, guaranteed by the spec since ES2019).
 */
export function prioritizeOrganization<T extends { organization_abbreviation: string }>(
  items: T[],
  priorityAbbreviation: string,
): T[] {
  const rank = (item: T) => (item.organization_abbreviation === priorityAbbreviation ? 0 : 1);
  return [...items].sort((a, b) => rank(a) - rank(b));
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx tsx --test data/lib/event-utils.test.ts`
Expected: PASS — `ℹ tests 17`, `ℹ pass 17`, `ℹ fail 0` (9 pré-existants + 5 de `computeNextEventForHome` + 3 de `prioritizeOrganization`).

- [ ] **Step 5: Commit**

```bash
git add data/lib/event-utils.ts data/lib/event-utils.test.ts
git commit -m "feat(home): add prioritizeOrganization sort helper" -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

## Task 3: Wire `prioritizeOrganization` into `fetchRecentFinishedFights`

**Files:**
- Modify: `data/lib/data.ts:393-481`

`fetchRecentFinishedFights` touche la DB — pas de test unitaire possible ici (le fichier n'a aucun mock DB, cf. spec). Vérification par lecture de code + vérification manuelle en Task 5.

- [ ] **Step 1: Add the import**

Dans `data/lib/data.ts`, modifier l'import existant en haut du fichier :

```typescript
import { sql } from '@/data/lib/db';
import {
    Organization,
    Event,
    Fighter,
    FightHistoryEntry,
    FightWithFighters,
    FightResultWithContext,
  } from './definitions';
import { prioritizeOrganization } from './event-utils';
```

- [ ] **Step 2: Fetch a wider pool and cap it to at least `limit`**

Dans `fetchRecentFinishedFights`, remplacer la ligne `LIMIT ${limit}` par une constante de pool, en gardant la requête SQL identique sinon :

```typescript
export async function fetchRecentFinishedFights(limit: number) {
  try {
    // Widened pool so prioritizeOrganization below has recent-but-not-UFC
    // results to compare against — see docs/superpowers/specs/2026-09-03-home-ufc-priority-design.md.
    const POOL_SIZE = 20;
    const poolLimit = Math.max(POOL_SIZE, limit);

    const data = await sql<{
```

(Le reste du bloc de type et de la requête SQL est inchangé jusqu'à la clause `LIMIT`, qui devient :)

```typescript
      WHERE f.fight_finished = true
      ORDER BY e.date DESC
      LIMIT ${poolLimit}
    `;
```

- [ ] **Step 3: Prioritize UFC within the pool, then cut to `limit`**

Remplacer le `return data.rows.map(...) as FightResultWithContext[];` final par :

```typescript
    const mapped = data.rows.map((row) => ({
      id: row.id,
      event_id: row.event_id,
      fighter1_id: row.fighter1_id,
      fighter2_id: row.fighter2_id,
      fight_finished: row.fight_finished,
      winner_id: row.winner_id,
      method: row.method,
      round: row.round,
      time: row.time,
      weight_class: row.weight_class,
      event_name: row.event_name,
      event_date: row.event_date,
      organization_abbreviation: row.organization_abbreviation,
      fighter1: row.f1_id
        ? {
            id: row.f1_id,
            name: row.f1_name,
            image_url: row.f1_image_url,
            weight_class: row.f1_weight_class,
            organization_id: row.f1_organization_id,
            record: row.f1_record,
            ranking: row.f1_ranking,
          }
        : null,
      fighter2: row.f2_id
        ? {
            id: row.f2_id,
            name: row.f2_name,
            image_url: row.f2_image_url,
            weight_class: row.f2_weight_class,
            organization_id: row.f2_organization_id,
            record: row.f2_record,
            ranking: row.f2_ranking,
          }
        : null,
    })) as FightResultWithContext[];

    return prioritizeOrganization(mapped, 'UFC').slice(0, limit);
```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: Pas de nouvelle erreur liée à `data/lib/data.ts` ou `data/lib/event-utils.ts` (le projet peut avoir des erreurs préexistantes ailleurs — ne pas les corriger ici, seulement s'assurer qu'aucune n'apparaît sur ces deux fichiers).

- [ ] **Step 5: Commit**

```bash
git add data/lib/data.ts
git commit -m "feat(home): prioritize UFC in fetchRecentFinishedFights" -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

## Task 4: Wire `computeNextEventForHome` into the home page

**Files:**
- Modify: `app/page.tsx:1-19`

- [ ] **Step 1: Swap the import and the call site**

Dans `app/page.tsx`, remplacer :

```typescript
import { computeNextEvent } from '@/data/lib/event-utils';
```

par :

```typescript
import { computeNextEventForHome } from '@/data/lib/event-utils';
```

Et remplacer :

```typescript
  const events = await fetchAllEvents();
  const next = computeNextEvent(events);
```

par :

```typescript
  const events = await fetchAllEvents();
  const next = computeNextEventForHome(events);
```

Rien d'autre ne change dans `app/page.tsx` — `next.event` / `next.isUpcoming` sont consommés exactement comme avant par le reste de la fonction (`heroEvent`, `heroFights`, `NextEventHero`, la section "Combats à venir").

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: Pas de nouvelle erreur sur `app/page.tsx`.

- [ ] **Step 3: Commit**

```bash
git add app/page.tsx
git commit -m "feat(home): use UFC-first event selection for the hero" -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

## Task 5: Manual verification in the browser

**Files:** aucun — vérification uniquement, cf. spec (pas de fixtures DB pour un test end-to-end automatisé de cette page).

- [ ] **Step 1: Run the full test suite one more time**

Run: `npm test`
Expected: PASS, tous les fichiers `data/**/*.test.ts` — `ℹ fail 0`.

- [ ] **Step 2: Start the dev server and open the home page**

Démarrer le serveur de dev du projet (`npm run dev`) et ouvrir `/` dans le navigateur.

- [ ] **Step 3: Verify the hero shows a UFC event when one is upcoming in the DB**

Si la base a un event UFC à venir : le hero doit l'afficher, même si une autre organisation a un event daté plus tôt. Comparer visuellement avec `/organizations/[slug]` de l'org UFC (ou la donnée en base) pour confirmer que c'est bien le bon event.

- [ ] **Step 4: Verify "Derniers résultats" surfaces UFC results first among recent ones**

Si des combats terminés existent pour plusieurs orgs récemment : les résultats UFC doivent apparaître avant les résultats non-UFC dans la liste des 4 affichés, sans faire disparaître un résultat non-UFC très récent au profit d'un vieux résultat UFC (le pool de 20 borne la fraîcheur — cf. spec).

- [ ] **Step 5: Verify the fallback when there's no upcoming UFC event**

Si la base actuelle n'a pas ce cas de figure, c'est couvert par les tests unitaires de la Task 1 (`computeNextEventForHome falls back...`) — pas besoin de le forcer manuellement en DB pour ce chantier.

- [ ] **Step 6: Screenshot the home page as proof**

Prendre une capture d'écran de la home (hero + "Combats à venir" + "Derniers résultats") pour vérifier visuellement qu'aucune régression de mise en page n'a été introduite par ces changements.
