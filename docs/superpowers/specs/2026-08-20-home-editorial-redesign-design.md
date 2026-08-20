# MMA Universe — Home éditoriale (v1)

Date : 2026-08-20

## Contexte

La home actuelle (`/`) fait double emploi avec une page organisations : hero "prochain événement" + grille des events à venir + grille de toutes les organisations. Le nav labellise d'ailleurs le lien `/` "Organisations", pas "Home". Il n'existe par ailleurs aucune page `/organizations` (liste) — seulement `/organizations/[slug]` (détail).

L'utilisateur a proposé une IA cible bien plus large, structurée en 4 sections de nav (Home / News / Events / Rankings / Profile). Cette vision a été décomposée en sous-chantiers indépendants car deux d'entre eux nécessitent des fondations qui n'existent pas encore :

- **News** — aucune source de données (pas de table articles, pas de scraper d'actus)
- **Rankings** — le champ `fighters.ranking` est actuellement codé en dur à `0` par le scraper (`data/scrapers/sherdog.ts:104`) ; aucun vrai classement n'est stocké
- **Profile** — aucun compte utilisateur / auth aujourd'hui (l'utilisateur a lui-même mis ce chantier "pour plus tard")

Cette spec ne couvre que le **premier sous-chantier retenu : la refonte éditoriale de la Home**, seule section réalisable immédiatement avec les données existantes (organizations, events, fights, fighters). Nav globale (renommage du lien), Events (onglets Aujourd'hui/Cette semaine/À venir/Terminés), page organisation (roster), Rankings et News restent hors périmètre et feront l'objet de specs séparées — à l'exception d'un renommage minimal du lien de nav couplé à ce chantier (voir plus bas), car il devient franchement trompeur une fois la home changée.

## Structure de la Home (remplace l'existante)

Trois sections, dans cet ordre :

### 1. Hero — inchangé

`NextEventHero` tel qu'il existe déjà : affiche l'event le plus proche dans le temps toutes orgs confondues (`computeNextEvent`), avec fallback sur le dernier event passé si aucun event à venir n'est en base.

### 2. "Combats à venir"

Le fight card complet de l'event affiché dans le hero, rendu en rows `FightRow` (réutilisation telle quelle du composant existant — grands avatars, catégorie de poids + statut au centre).

- Titre de section avec lien "Voir l'événement" → `/events/[id]`
- Affiche **tous** les combats de l'event (pas de plafond — un fight card fait rarement plus de 8-10 combats)
- **Masquée entièrement** si `next.isUpcoming` est `false` (aucun event à venir en base, hero retombé sur le dernier event passé) ou si l'event n'a aucun combat enregistré

### 3. "Derniers résultats"

Les 4 derniers combats terminés (`fight_finished = true`), toutes organisations confondues, triés par date d'event décroissante.

- Même style de row que la section précédente (`FightRow`), mais chaque row porte en plus un petit tag org + nom/date de l'event : comme le flux est multi-orgs, on perd le contexte sans ça (contrairement à la section "Combats à venir" où le hero au-dessus donne déjà le contexte)
- Pas de lien "voir tout" en v1 — il n'existe pas encore de page listant les résultats à laquelle renvoyer (viendra avec le chantier Events/Rankings)
- **Masquée entièrement** si aucun combat terminé n'est en base

## Ce qui disparaît de la Home

- La grille d'events "À venir" (`EventCard` en grille) — remplacée par la section "Combats à venir" au niveau combat plutôt qu'au niveau event
- La grille "Organisations" en bas de page — repoussée à une future page `/organizations` (liste), hors périmètre ici

## Nav (changement minimal couplé)

Le lien de nav "Organisations" (qui pointe vers `/`) devient **"Home"**. C'est le seul changement de nav dans ce chantier — la restructuration complète (News/Rankings/Profile, page organisations liste) est un chantier séparé.

## Données

- `fetchFightsByEvent(eventId)` — **existe déjà**, réutilisée telle quelle pour le fight card du hero.
- **Nouvelle fonction** `fetchRecentFinishedFights(limit: number)` dans `data/lib/data.ts` :
  - Combats où `fight_finished = true`
  - Jointure fighters (fighter1 + fighter2, même pattern que `fetchFightsByEvent`) + events (nom, date) + organizations (abréviation)
  - Triés par date d'event décroissante, plafonnés à `limit`
  - Retourne un type `FightWithFighters` étendu avec `event_id`, `event_name`, `event_date`, `organization_abbreviation` (nouveau type à ajouter dans `data/lib/definitions.ts`, ex. `FightResultWithContext`)
- Sur `app/page.tsx` : les fetch orgs/events existants, le fetch du fight card du hero (conditionnel à `next.isUpcoming`), et `fetchRecentFinishedFights(4)` tournent en parallèle (`Promise.all`)

## Composants

- `FightRow` (`components/ui/fights/fight-row.tsx`) — réutilisé sans modification pour "Combats à venir"
- Nouvelle prop optionnelle sur `FightRow` (ou variante dédiée si l'ajout complexifie trop le composant existant — décision d'implémentation) pour afficher le tag org + event, utilisée uniquement par "Derniers résultats"

## États vides

- Aucun event en base → `EmptyState` existant sous le hero, inchangé
- Hero à venir mais fight card vide → section "Combats à venir" masquée silencieusement (pas de message vide, juste absente)
- Aucun combat terminé en base → section "Derniers résultats" masquée silencieusement

## Tests

Pas de suite de tests automatisés dans le projet (cf. spec refonte front web du 2026-08-15) ; vérification manuelle via navigateur, cohérent avec le reste du projet.

## Hors périmètre (rappel)

- Nav globale complète (News / Rankings / Profile, page `/organizations` liste)
- Onglets Events (Aujourd'hui / Cette semaine / À venir / Terminés)
- Redesign de `/organizations/[slug]` (roster de combattants, etc.)
- Rankings (bloqué : pas de vraies données de classement)
- News (bloqué : pas de source de données)
- Profile (explicitement différé par l'utilisateur)
