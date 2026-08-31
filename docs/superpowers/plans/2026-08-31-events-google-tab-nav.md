# Format Google pour les Events (semaine en cours + onglets d'event) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Regrouper `/events` en "Cette semaine" / "À venir" au lieu d'une grille unique, et ajouter sur la page détail d'un event (`/events/[slug]`) un bandeau d'onglets scopé à l'organisation de cet event, pour naviguer latéralement entre ses events sans repasser par la liste. Voir [docs/superpowers/specs/2026-08-31-events-google-tab-nav-design.md](../specs/2026-08-31-events-google-tab-nav-design.md) pour le contexte et les décisions d'archi.

**Architecture:** Une nouvelle fonction pure (`groupUpcomingByWeek`) dans `data/lib/event-utils.ts`, un nouveau composant (`EventOrgTabs`), une modification de `EventsByStatus` pour le sous-groupement, et le branchement de `EventOrgTabs` dans `app/events/[slug]/page.tsx` via `fetchEventsByOrg` (déjà existante, aucune nouvelle requête SQL). Rien dans `/organizations`, `FightRow`/`FightCard`, ou la nav globale n'est touché.

**Tech Stack:** Next.js 14 App Router (Server + Client Components), TypeScript, Tailwind (Dark Combat palette), `node:test` pour la logique pure.

**Testing note:** Cohérent avec le reste du projet — pas de suite de tests pour les pages/composants, uniquement pour la logique pure (`data/lib/*.test.ts`). Vérification manuelle via navigateur + DB seedée pour le rendu.

---

### Task 1: `groupUpcomingByWeek` dans `event-utils.ts`

**Files:**
- Modify: `data/lib/event-utils.ts`
- Modify: `data/lib/event-utils.test.ts`

- [x] **Step 1: Ajouter la fonction**

Dans `data/lib/event-utils.ts`, ajouter après `splitEventsByStatus` :

```ts
/**
 * Splits an already-upcoming event list (soonest-first, from
 * splitEventsByStatus) into the current calendar week (through the coming
 * Sunday, Monday-start ISO week) and everything after — so /events can put
 * "cette semaine" front and center instead of dumping every future event
 * into one flat list.
 *
 * Uses UTC day-of-week to match splitEventsByStatus's UTC-based "today"
 * (toISOString().slice(0, 10)) — mixing local and UTC calendars here would
 * make the week boundary drift by up to a day from the upcoming/past split
 * it's built on top of.
 */
export function groupUpcomingByWeek<T extends Event>(upcoming: T[]): { thisWeek: T[]; later: T[] } {
  const now = new Date();
  const day = now.getUTCDay(); // 0 (Sun) .. 6 (Sat)
  const daysUntilSunday = day === 0 ? 0 : 7 - day;
  const endOfWeek = new Date(now);
  endOfWeek.setUTCDate(now.getUTCDate() + daysUntilSunday);
  const endOfWeekDate = endOfWeek.toISOString().slice(0, 10);

  const thisWeek = upcoming.filter((event) => event.date <= endOfWeekDate);
  const later = upcoming.filter((event) => event.date > endOfWeekDate);
  return { thisWeek, later };
}
```

- [x] **Step 2: Ajouter les tests**

Dans `data/lib/event-utils.test.ts`, ajouter (après les tests existants de `splitEventsByStatus`, en réutilisant `makeEvent`) :

```ts
import { groupUpcomingByWeek, splitEventsByStatus } from './event-utils';

test('groupUpcomingByWeek puts an event dated today in thisWeek', () => {
  const today = new Date().toISOString().slice(0, 10);
  const { thisWeek, later } = groupUpcomingByWeek([makeEvent(1, today)]);

  assert.deepEqual(thisWeek.map((e) => e.id), [1]);
  assert.equal(later.length, 0);
});

test('groupUpcomingByWeek puts an event 60 days out in later', () => {
  const farFuture = new Date();
  farFuture.setUTCDate(farFuture.getUTCDate() + 60);
  const farFutureDate = farFuture.toISOString().slice(0, 10);

  const { thisWeek, later } = groupUpcomingByWeek([makeEvent(1, farFutureDate)]);

  assert.equal(thisWeek.length, 0);
  assert.deepEqual(later.map((e) => e.id), [1]);
});

test('groupUpcomingByWeek splits a mixed list correctly', () => {
  const today = new Date().toISOString().slice(0, 10);
  const farFuture = new Date();
  farFuture.setUTCDate(farFuture.getUTCDate() + 60);
  const farFutureDate = farFuture.toISOString().slice(0, 10);

  const { thisWeek, later } = groupUpcomingByWeek([makeEvent(1, today), makeEvent(2, farFutureDate)]);

  assert.deepEqual(thisWeek.map((e) => e.id), [1]);
  assert.deepEqual(later.map((e) => e.id), [2]);
});

test('groupUpcomingByWeek returns empty groups for an empty input', () => {
  const { thisWeek, later } = groupUpcomingByWeek([]);

  assert.deepEqual(thisWeek, []);
  assert.deepEqual(later, []);
});
```

Note : le fichier importe déjà `splitEventsByStatus` seul depuis `./event-utils` (ligne 4) — étendre cet import existant plutôt que d'en ajouter un second, i.e. `import { groupUpcomingByWeek, splitEventsByStatus } from './event-utils';`.

Un event dated aujourd'hui tombe toujours dans `thisWeek` par construction (`endOfWeek >= today`, 0 à 6 jours plus tard) — assertion stable peu importe le jour d'exécution des tests, même logique que le commentaire "dates far enough... to stay stable" déjà en tête du fichier. +60 jours est strictement hors de toute semaine ISO en cours, donc toujours dans `later`.

- [x] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [x] **Step 4: Run tests**

Run: `npm test`
Expected: les tests existants (20) + les 4 nouveaux passent.

- [x] **Step 5: Commit**

```bash
git add data/lib/event-utils.ts data/lib/event-utils.test.ts
git commit -m "feat(events): add groupUpcomingByWeek

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 2: Sous-groupement "Cette semaine" / "À venir" dans `EventsByStatus`

**Files:**
- Modify: `components/ui/events/events-by-status.tsx`

- [x] **Step 1: Importer `groupUpcomingByWeek` et l'appliquer côté "upcoming"**

Le fichier importe actuellement :

```ts
import { splitEventsByStatus } from '@/data/lib/event-utils';
```

Changer en :

```ts
import { groupUpcomingByWeek, splitEventsByStatus } from '@/data/lib/event-utils';
```

- [x] **Step 2: Remplacer le rendu de la grille active**

Le bloc de rendu actuel (fin du composant `EventsByStatusInner`) est :

```tsx
  const active = tab === 'upcoming' ? upcoming : past;
  const emptyMessage = tab === 'upcoming' ? emptyUpcoming : emptyPast;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2" role="tablist" aria-label="Filtrer les événements">
        {(
          [
            ['upcoming', `À venir (${upcoming.length})`],
            ['past', `Passés (${past.length})`],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={tab === value}
            onClick={() => selectTab(value)}
            className={`rounded-full border px-4 py-1.5 font-display text-sm uppercase tracking-wide transition-colors ${
              tab === value
                ? 'border-accent bg-accent text-white'
                : 'border-base-border bg-base-card text-ink-secondary hover:border-accent'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      {active.length === 0 ? (
        <p className="text-sm text-ink-secondary">{emptyMessage}</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
          {active.map((event) => (
            <EventCard key={event.id} event={event} />
          ))}
        </div>
      )}
    </div>
  );
```

Remplacer par (le bandeau d'onglets À venir/Passés ne change pas — seul ce qui suit change) :

```tsx
  const active = tab === 'upcoming' ? upcoming : past;
  const emptyMessage = tab === 'upcoming' ? emptyUpcoming : emptyPast;
  const { thisWeek, later } = tab === 'upcoming' ? groupUpcomingByWeek(upcoming) : { thisWeek: [], later: [] };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2" role="tablist" aria-label="Filtrer les événements">
        {(
          [
            ['upcoming', `À venir (${upcoming.length})`],
            ['past', `Passés (${past.length})`],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={tab === value}
            onClick={() => selectTab(value)}
            className={`rounded-full border px-4 py-1.5 font-display text-sm uppercase tracking-wide transition-colors ${
              tab === value
                ? 'border-accent bg-accent text-white'
                : 'border-base-border bg-base-card text-ink-secondary hover:border-accent'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      {active.length === 0 ? (
        <p className="text-sm text-ink-secondary">{emptyMessage}</p>
      ) : tab === 'upcoming' ? (
        <div className="flex flex-col gap-6">
          {thisWeek.length > 0 && (
            <EventGroup title={`Cette semaine (${thisWeek.length})`} events={thisWeek} />
          )}
          {later.length > 0 && <EventGroup title={`À venir (${later.length})`} events={later} />}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
          {active.map((event) => (
            <EventCard key={event.id} event={event} />
          ))}
        </div>
      )}
    </div>
  );
```

- [x] **Step 3: Ajouter le composant `EventGroup`**

Ajouter avant `EventsByStatusInner` (ou juste après, peu importe — regrouper avec les autres fonctions internes du fichier) :

```tsx
function EventGroup<T extends Event>({ title, events }: { title: string; events: T[] }) {
  return (
    <div className="flex flex-col gap-3">
      <h2 className="font-display text-sm uppercase tracking-wide text-ink-secondary">{title}</h2>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
        {events.map((event) => (
          <EventCard key={event.id} event={event} />
        ))}
      </div>
    </div>
  );
}
```

- [x] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [x] **Step 5: Manual verification**

Avec `npm run dev` :
- `/events`, onglet "À venir" : si des events tombent cette semaine (calendaire, lundi-dimanche) ET plus tard, les deux sous-titres "Cette semaine (N)" / "À venir (N)" apparaissent, avec les bons events dans chaque groupe.
- Si aucun event cette semaine mais des events plus tard : seul "À venir (N)" s'affiche (pas de "Cette semaine (0)" vide).
- Onglet "Passés" : rendu inchangé (grille unique, pas de sous-titres).
- `/organizations/[slug]` (qui réutilise `EventsByStatus`) : même comportement, vérifier sur une orga avec plusieurs events à venir.

- [x] **Step 6: Commit**

```bash
git add components/ui/events/events-by-status.tsx
git commit -m "feat(events): group upcoming events by this-week vs later

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 3: Composant `EventOrgTabs`

**Files:**
- Create: `components/ui/events/event-org-tabs.tsx`

- [x] **Step 1: Écrire le composant**

```tsx
import Link from 'next/link';
import { Event } from '@/data/lib/definitions';

/**
 * Horizontal tab strip of an organization's events (Google's UFC schedule
 * panel is the reference), so a visitor already on one event can hop
 * sideways to another without going back through /events. Renders nothing
 * when the org has one event on file or fewer — a single-tab strip has
 * nothing to navigate to.
 */
export default function EventOrgTabs({ events, currentEventId }: { events: Event[]; currentEventId: number }) {
  if (events.length <= 1) {
    return null;
  }

  const sorted = [...events].sort((a, b) => a.date.localeCompare(b.date));

  return (
    <nav
      aria-label="Autres événements de cette organisation"
      className="flex gap-6 overflow-x-auto border-b border-base-border pb-3"
    >
      {sorted.map((event) => {
        const active = event.id === currentEventId;
        return (
          <Link
            key={event.id}
            href={`/events/${event.id}`}
            aria-current={active ? 'page' : undefined}
            className={`shrink-0 whitespace-nowrap font-display text-sm uppercase tracking-wide transition-colors ${
              active ? 'text-accent' : 'text-ink-secondary hover:text-accent'
            }`}
          >
            {event.name}
          </Link>
        );
      })}
    </nav>
  );
}
```

- [x] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors (composant pas encore utilisé nulle part — pas d'erreur d'import à ce stade).

- [x] **Step 3: Commit**

```bash
git add components/ui/events/event-org-tabs.tsx
git commit -m "feat(events): add EventOrgTabs component

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

(Composant pas encore branché — 404 impossible puisque ce n'est pas une route, mais il reste inutilisé jusqu'à la Task 4. Attendu, pas un bug.)

**Addendum (trouvé en vérification manuelle, Task 5) :** le rendu ci-dessus liste `sorted` en entier. Sur une orga avec un long historique (l'UFC a des centaines d'events en base), ça produit un bandeau de centaines d'onglets — inutilisable, et pas ce que montre la référence Google (qui n'affiche que quelques events voisins). Correction appliquée : fenêtrage à `WINDOW_RADIUS = 2` events avant/après l'event courant (5 onglets max), via `currentIndex`/`slice` sur `sorted`, et rendu de `windowed` au lieu de `sorted`. Voir le fichier réel `components/ui/events/event-org-tabs.tsx` pour le code final.

---

### Task 4: Brancher `EventOrgTabs` dans `/events/[slug]`

**Files:**
- Modify: `app/events/[slug]/page.tsx`

- [x] **Step 1: Importer `fetchEventsByOrg` et `EventOrgTabs`**

Les imports actuels commencent par :

```tsx
import { notFound } from 'next/navigation';
import { fetchEventById, fetchFightsByEvent } from '@/data/lib/data';
```

Changer en :

```tsx
import { notFound } from 'next/navigation';
import { fetchEventById, fetchEventsByOrg, fetchFightsByEvent } from '@/data/lib/data';
```

Et ajouter, avec les autres imports de composants (après `CoverImage` par exemple) :

```tsx
import EventOrgTabs from '@/components/ui/events/event-org-tabs';
```

- [x] **Step 2: Fetcher les events de l'organisation en parallèle avec les fights**

Le code actuel est :

```tsx
  const fights = await fetchFightsByEvent(params.slug);
  const { mainEvent, rest } = splitMainEvent(fights);
```

Changer en :

```tsx
  const [fights, orgEvents] = await Promise.all([
    fetchFightsByEvent(params.slug),
    fetchEventsByOrg(String(event.organization_id)),
  ]);
  const { mainEvent, rest } = splitMainEvent(fights);
```

- [x] **Step 3: Rendre le bandeau au-dessus du header de l'event**

Le header actuel est :

```tsx
  return (
    <main className="flex min-h-screen flex-col gap-6 p-6">
      <div className="flex items-center gap-4 border-b border-base-border pb-6">
```

Changer en :

```tsx
  return (
    <main className="flex min-h-screen flex-col gap-6 p-6">
      <EventOrgTabs events={orgEvents} currentEventId={event.id} />
      <div className="flex items-center gap-4 border-b border-base-border pb-6">
```

- [x] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [x] **Step 5: Manual verification**

Avec `npm run dev` :
- Ouvrir un event d'une organisation qui a plusieurs events en base (ex: UFC) → le bandeau d'onglets apparaît en haut, avec l'event courant mis en avant (texte accent) et les autres cliquables, triés par date.
- Cliquer un autre onglet → navigue vers `/events/[autre-id]`, le bandeau se met à jour avec le nouvel event actif.
- Ouvrir un event d'une organisation qui n'a qu'un seul event en base → le bandeau ne s'affiche pas (pas d'espace vide au-dessus du header).
- Aucune erreur console, aucune régression sur le reste de la page (fights, picks, leaderboard).

- [x] **Step 6: Commit**

```bash
git add app/events/\[slug\]/page.tsx
git commit -m "feat(events): show org-scoped event tabs on event detail page

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 5: Final full-flow verification

**Files:** none (verification only)

- [x] **Step 1: Full typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [x] **Step 2: Run the full test suite**

Run: `npm test`
Expected: tous les tests passent (existants + les 4 ajoutés en Task 1).

- [x] **Step 3: Full manual pass**

Avec `npm run dev` :
- `/events` : onglet "À venir" groupé Cette semaine/À venir, onglet "Passés" inchangé.
- `/organizations/[slug]` : même comportement de groupement (composant partagé).
- `/events/[slug]` d'une orga multi-events : bandeau d'onglets présent, navigation latérale fonctionnelle.
- `/events/[slug]` d'une orga à un seul event : pas de bandeau.
- `/`, `/fighters`, `/organizations`, nav globale : inchangés (aucun fichier de ces zones touché par ce plan).

No commit for this task — verification only.
