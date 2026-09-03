# MMA Universe — Section "Cette semaine" et main event seul sur la home

Date : 2026-09-03

## Contexte

La home web ([app/page.tsx](../../../app/page.tsx)) et la home mobile ([mobile/app/(tabs)/index.tsx](../../../mobile/app/(tabs)/index.tsx)) affichent toutes les deux un hero pour le prochain event mis en avant (UFC en priorité depuis [2026-09-03-home-ufc-priority-design.md](2026-09-03-home-ufc-priority-design.md)), suivi d'une tentative d'afficher son "main event" via `splitMainEvent` (web : [data/lib/fight-utils.ts](../../../data/lib/fight-utils.ts), mobile : [mobile/lib/fight-utils.ts](../../../mobile/lib/fight-utils.ts)).

`splitMainEvent` cherche un combat `is_main_event === true`, mais ce flag n'est jamais réellement positionné par les scrapers/seed — `mainEvent` vaut donc toujours `null` en pratique :
- Sur le web, `app/page.tsx` retombe alors sur `rest` = la liste complète des combats de l'event, rendue en `FightRow` sous le titre "Combats à venir".
- Sur mobile, `mainEvent && nextEvent && <FightCard .../>` ne rend jamais rien — la home mobile n'affiche aujourd'hui aucun combat, seulement le hero et la liste d'organisations.

Par ailleurs, aucune des deux homes ne donne de vue sur ce qui se passe *cette semaine* toutes organisations confondues — cette vue existe déjà sur `/events` ([components/ui/events/events-by-status.tsx](../../../components/ui/events/events-by-status.tsx)) via `groupUpcomingByWeek`, mais n'est pas reprise sur la home.

Ce chantier corrige les deux : n'afficher que le main event sous le hero (web + mobile), et ajouter une section "Cette semaine" listant les autres events à venir dans la semaine ISO en cours (web + mobile).

## Périmètre

- `app/page.tsx` (home web)
- `mobile/app/(tabs)/index.tsx` (home mobile)
- `app/api/mobile/home/route.ts` (API consommée par la home mobile)
- Aucun changement à `splitMainEvent` lui-même (toujours utilisé tel quel par les pages détail d'event, web et mobile, hors périmètre ici) ni à `groupUpcomingByWeek` / `splitEventsByStatus` (déjà existants et suffisants).

## 1. Hero — n'afficher que le main event

Le "main event" d'un event est approximé par le premier combat renvoyé par `fetchFightsByEvent` (`ORDER BY f.is_main_event DESC, f.id ASC` — voir [data/lib/data.ts:132](../../../data/lib/data.ts)) : c'est déjà ce que `heroFight = nextEventFights[0]` utilise pour l'illustration du hero web aujourd'hui.

**Web** ([app/page.tsx](../../../app/page.tsx)) :
- La section sous le hero n'affiche plus que `heroFight` (déjà calculé) dans un unique `FightCard`, à la place du bloc `mainEvent && <FightCard/>` + `rest.map(FightRow)`.
- Retrait des imports/variables devenus inutiles à cet endroit : `splitMainEvent`, `mainEvent`, `rest`, `FightRow` (`FightCard` reste utilisé).
- Titre de section renommé de "Combats à venir" à **"Combat principal"** (il n'y a plus qu'un seul combat affiché ici). Le lien "Voir l'événement" est conservé.
- Condition d'affichage inchangée : la section ne s'affiche que si `heroEvent` existe et `heroFights.length > 0` (donc jamais quand le hero est retombé sur un event passé) — seul son contenu change.

**Mobile** ([mobile/app/(tabs)/index.tsx](../../../mobile/app/(tabs)/index.tsx)) :
- Remplacer `const { mainEvent } = splitMainEvent(fights)` par `const mainEvent = fights[0] ?? null` (même approximation "1er combat renvoyé" que le web — l'API mobile utilise la même requête SQL triée `is_main_event DESC, id ASC`).
- Le rendu conditionnel `mainEvent && nextEvent && <FightCard .../>` est inchangé structurellement, seule la source de `mainEvent` change. Résultat concret : le `FightCard` main event, invisible aujourd'hui, s'affiche enfin.
- Pas de nouveau titre de section ajouté ici (la home mobile n'a pas de titre au-dessus du `FightCard` aujourd'hui et n'en avait pas demandé un).

## 2. Nouvelle section "Cette semaine"

Liste les events à venir (toutes organisations) dont la date tombe dans la semaine ISO en cours (lundi→dimanche, même définition que `/events`), **à l'exclusion de l'event déjà mis en avant dans le hero** — pour ne pas le montrer deux fois sur la même page.

Calcul (identique conceptuellement web et mobile, réutilise `splitEventsByStatus` + `groupUpcomingByWeek` de [data/lib/event-utils.ts](../../../data/lib/event-utils.ts), aucune nouvelle fonction pure nécessaire) :

```
upcoming = splitEventsByStatus(events).upcoming
thisWeek = groupUpcomingByWeek(upcoming).thisWeek
weeklyEvents = thisWeek.filter(e => e.id !== heroEvent?.id)
```

**Web** ([app/page.tsx](../../../app/page.tsx)) :
- Calculé directement dans la page (elle a déjà `events` via `fetchAllEvents()`), pas de nouvel appel réseau/DB.
- Rendu : grille `EventCard` ([components/ui/events/event-card.tsx](../../../components/ui/events/event-card.tsx)), même composant que `/events`, cohérence visuelle garantie gratuitement.
- Titre de section : **"Cette semaine"**, avec un lien "Voir tous les événements" vers `/events` (même pattern que le lien "Voir l'événement" des autres sections de la home).
- Placement : juste après "Combat principal", avant "Derniers résultats".

**Mobile** :
- `app/api/mobile/home/route.ts` (route serveur Next.js — a accès direct à `data/lib/event-utils.ts`, contrairement au reste de l'app mobile) calcule `weeklyEvents` avec la même logique que ci-dessus et l'ajoute au JSON déjà renvoyé : `{ nextEvent, organizations, fights, weeklyEvents }`.
- Le mobile ne recalcule rien côté client : il consomme `weeklyEvents` tel quel. Ça évite de dupliquer une 3e fois la logique de "semaine ISO" dans `mobile/lib/` (le mobile duplique déjà `splitEventsByStatus`/`splitMainEvent` parce qu'il n'a accès qu'au JSON servi, pas au code serveur — mais ici le serveur peut faire le calcul directement, donc pas besoin).
- `mobile/lib/types.ts` : `HomeResponse` gagne un champ `weeklyEvents: EventWithOrganization[]`.
- Rendu : `EventCard` ([mobile/components/cards.tsx](../../../mobile/components/cards.tsx)) en liste sous un titre "Cette semaine", inséré dans le `ScrollView` entre le `FightCard` main event et la section "Organisations".

## États vides

- Aucun event du tout en base → `EmptyState`, inchangé (couvre déjà le hero absent, donc pas de "Cette semaine" non plus).
- Hero retombé sur un event passé (`isUpcoming: false`) → la section "Combat principal" reste masquée comme aujourd'hui ; "Cette semaine" reste indépendante et peut quand même s'afficher s'il existe des events à venir cette semaine ailleurs (rare en pratique si le fallback s'est déclenché, mais pas structurellement impossible — pas de garde artificielle ajoutée).
- Aucun autre event que celui du hero dans la semaine en cours (`weeklyEvents` vide, avant ou après filtrage du hero) → section "Cette semaine" masquée entièrement (pas de titre affiché sans contenu), même pattern que les autres sections de la home.

## Ce qui ne change pas

- `splitMainEvent`, `groupUpcomingByWeek`, `splitEventsByStatus`, `computeNextEventForHome`, `prioritizeOrganization` : inchangées, réutilisées telles quelles.
- Pages détail d'event (web `app/events/[slug]/page.tsx`, mobile `mobile/app/(tabs)/events/[id].tsx`) : toujours basées sur `splitMainEvent`, non concernées par ce chantier.
- Section "Derniers résultats" : inchangée.
- Aucun tri "UFC d'abord" appliqué à "Cette semaine" — ordre chronologique simple (comme `/events`), volontairement laissé simple (YAGNI) : contrairement au hero qui isole *un* event, cette section liste plusieurs orgs côte à côte.
- Aucun changement de schéma DB.

## Tests

Aucune nouvelle fonction pure n'est introduite (`groupUpcomingByWeek` et `splitEventsByStatus` sont déjà couvertes par [data/lib/event-utils.test.ts](../../../data/lib/event-utils.test.ts)), donc pas de nouveau test unitaire ciblé côté `data/lib/`. Le filtrage "exclure l'event du hero" et l'assemblage `weeklyEvents` sont de simples one-liners inline dans `app/page.tsx` et `route.ts`, pas extraits en fonction pure séparée (trop triviaux pour justifier l'indirection).

Vérification manuelle via navigateur (web) pour l'intégration bout-en-bout :
- Home avec un hero UFC à venir + au moins un autre event dans la semaine → "Combat principal" (1 seul combat) + "Cette semaine" (sans l'event du hero) tous deux visibles.
- Home avec un hero mais aucun autre event cette semaine → "Cette semaine" absente de la page.
- Home sans event à venir nulle part (hero retombé sur un event passé) → "Combat principal" absente ; "Cette semaine" absente aussi dans ce cas (aucun `upcoming` par définition).

Côté mobile, vérification manuelle via l'app Expo (pas de suite de tests existante pour les écrans mobile) : le `FightCard` main event s'affiche désormais sous le hero, et la liste "Cette semaine" apparaît avec les mêmes events que sur le web (moins l'event du hero).

## Hors périmètre (rappel)

- Modifier `is_main_event` en base ou dans les scrapers pour qu'il reflète un vrai main event — l'approximation "1er combat trié par l'API" reste en place, comme pour le hero aujourd'hui.
- Tri "UFC d'abord" ou toute autre notion de priorité au sein de la section "Cette semaine".
- Étendre `groupUpcomingByWeek`/pagination à la section "Cette semaine" de la home (pas de "voir plus" dédié, le lien renvoie vers `/events` en entier).
