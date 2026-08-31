# MMA Universe — Format Google pour les Events (semaine en cours + onglets d'event)

Date : 2026-08-31

## Contexte

Origine : carte Trello ["Changer le format en reprenant un format Google"](https://trello.com/c/1K9cBBOo/5-changer-le-format-en-reprenant-un-format-google). Le screenshot joint montre le panneau Google pour l'UFC : un bandeau d'onglets horizontal listant plusieurs events de l'organisation ("Road to UFC 5.3" / "UFC Fight Night: Nurmagomedov vs. Song" (actif) / "UFC Fight Night: …"), un sous-onglet Carte Principale/Carte Préliminaire, puis les combats en lignes horizontales (photo ronde, palmarès, méthode/round, statut).

Décisions issues de la discussion d'archi :

- Le format "ligne horizontale" existe déjà quasiment tel quel dans `FightRow` (`components/ui/fights/fight-row.tsx`) — pas de refonte de ce composant.
- **Pas de choix d'organisation forcé avant d'atteindre les events.** `/events` reste toutes-organisations confondues : ça sert le cas d'usage "qu'est-ce qu'il y a ce week-end" (plusieurs orgas peuvent tomber le même jour). Le bandeau d'onglets Google-style est ajouté sur la page détail d'un event, **scopé à son organisation**, comme outil de navigation latérale une fois qu'on y est déjà — pas comme préalable obligatoire.
- `/events` ne doit plus tout jeter en vrac dans "À venir" — grouper **Cette semaine** en avant, puis **À venir** pour le reste.
- **Hors scope pour l'instant** : split Carte Principale / Préliminaire / Early Prelims. Sherdog (seule source actuelle, `data/scrapers/sherdog.ts`) ne distingue pas ces tiers — seul `is_main_event` (un seul combat) existe, le reste de la card est une liste plate sans marqueur de position. Un vrai 3-tiers demanderait une autre source (fiable seulement pour l'UFC, pas pour la douzaine d'autres orgas suivies) ou une heuristique approximative. Rouvrira plus tard si besoin.
- `/organizations` (page liste + lien nav) : question séparée, non touchée par ce chantier.

## 1. `/events` — regroupement "Cette semaine" / "À venir"

Nouvelle fonction pure dans `data/lib/event-utils.ts`, même esprit que `splitEventsByStatus` :

```ts
export function groupUpcomingByWeek<T extends Event>(upcoming: T[]): { thisWeek: T[]; later: T[] }
```

- Prend en entrée la liste déjà filtrée "upcoming" (sortie de `splitEventsByStatus`) — ne duplique pas la logique de filtre passé/futur.
- **"Cette semaine" = semaine calendaire ISO en cours (lundi → dimanche)**, pas une fenêtre glissante de 7 jours. Choisi pour que "cette semaine" corresponde à un intervalle fixe et prévisible plutôt que de dépendre du jour de consultation (sinon un event de lundi prochain apparaîtrait dans "cette semaine" dès dimanche soir). À confirmer/amender si tu préfères la fenêtre glissante.

`EventsByStatus` (`components/ui/events/events-by-status.tsx`) : sous l'onglet "À venir", remplacer la grille unique par deux sous-sections titrées — "Cette semaine (N)" en premier, "À venir (N)" pour le reste — chacune sa propre grille (vide → pas de sous-titre affiché si N=0 côté "Cette semaine"). L'onglet "Passés" ne change pas.

## 2. `/events/[slug]` — bandeau d'onglets Google-style

Nouveau composant `components/ui/events/event-org-tabs.tsx` :

- Reçoit la liste des events de l'organisation courante — via `fetchEventsByOrg(String(event.organization_id))`, **fonction déjà existante** dans `data/lib/data.ts` (déjà utilisée par `/organizations/[slug]`), aucune nouvelle requête SQL nécessaire.
- Reçoit aussi l'id de l'event affiché pour marquer l'onglet actif.
- Rendu : bandeau horizontal scrollable, un onglet par event (nom de l'event), tri chronologique par date, event courant mis en avant. Chaque onglet est un `Link` vers `/events/[id]`.
- Placé en haut de la page détail, au-dessus du header event actuel (photo/nom/date) — cohérent avec le screenshot où le bandeau surplombe le contenu de l'event affiché.

`app/events/[slug]/page.tsx` : ajouter l'appel `fetchEventsByOrg(String(event.organization_id))` en parallèle des fetches existants (mutualisable dans le `Promise.all` avec `fetchFightsByEvent`, etc.), passer le résultat à `EventOrgTabs`.

## Hors périmètre (rappel)

- Split Carte Principale / Préliminaire / Early Prelims — pas de donnée fiable, reporté.
- `/organizations` (page liste + nav globale) — inchangé.
- Sous-onglets Carte Principale/Préliminaire du screenshot — dépendent du point précédent, donc absents de ce chantier.

## Données

Aucune nouvelle fonction de requête SQL nécessaire — `fetchEventsByOrg` (déjà existante) suffit pour le bandeau d'onglets. Nouvelle fonction pure (pas de DB) : `groupUpcomingByWeek` dans `event-utils.ts`.

## Composants

- Nouveau : `EventOrgTabs` (bandeau d'onglets, page détail).
- Modifié : `EventsByStatus` (sous-groupement Cette semaine/À venir dans l'onglet "À venir").
- Inchangés : `EventCard`, `FightRow`, `FightCard`, `NextEventHero`, `OrganizationsList`/`OrganizationCard`.

## Tests

Pas de suite de tests automatisés pour les pages/composants (cf. specs précédentes). `data/lib/event-utils.test.ts` existe déjà pour la logique pure — `groupUpcomingByWeek` devrait y avoir sa propre suite de cas (semaine avec/sans events, event le dimanche soir vs. lundi matin, liste "upcoming" vide). Vérification manuelle en navigateur pour le rendu (bandeau d'onglets, sous-sections).
