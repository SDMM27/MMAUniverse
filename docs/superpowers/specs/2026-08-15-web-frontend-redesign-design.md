# MMA Universe — Refonte du front web (Dark Combat)

Date : 2026-08-15

## Contexte

Le projet `mma-universe-old` (Next.js 14, App Router + Pages Router mixtes) a été fait rapidement : esthétique quasi inexistante (listes Tailwind par défaut, classes de couleur invalides, images forcées en cercle) et données incomplètes (seul PFL est réellement scrapé ; UFC et Bellator ne sont que des stubs, et le seed n'insère même pas les organisations/events/fighters actuellement — voir `app/seed/route.ts`).

Le projet a été décomposé en 4 sous-chantiers indépendants :

1. **Migration DB** (`@vercel/postgres`, déprécié → base Marketplace type Neon)
2. **Complétion des données** (scraping UFC + Bellator, réactivation du seed complet)
3. **Refonte du front web** ← objet de ce document
4. **App mobile iOS/Android en React Native / Expo** (codebase séparé, à spécifier plus tard ; réutilisera les types `data/lib/definitions.ts` et la couche API)

Cette spec ne couvre que le chantier 3. Les chantiers 1, 2 et 4 sont volontairement hors périmètre ici — l'architecture proposée doit rester tolérante à des données partielles (chantier 2 pas encore fait) et à la couche DB actuelle (chantier 1 pas encore fait).

## Sitemap

- `/` — Accueil : hero "prochain événement" + grille des organisations
- `/organizations/[slug]` — Événements de l'organisation
- `/events/[slug]` — Fights de l'événement
- `/fighters` — **Nouveau.** Annuaire de tous les combattants, toutes organisations confondues, filtrable par organisation
- `/fighters/[slug]` — **Nouveau.** Profil combattant
- Nav globale persistante sur toutes les pages : *Organisations / Events / Fighters* (n'existe pas aujourd'hui — navigation actuelle en entonnoir strict)

## Système visuel — "Dark Combat"

- Fond quasi noir (`#0a0a0a`), cards en `#161616` avec bordure `#262626`
- Rouge accent unique (`#ff3b30`-ish), réservé aux éléments clés (rank, records, liens actifs, séparateurs) — jamais en grande surface
- Typo : display condensée/bold en majuscules pour titres et noms de combattants (esprit affiche de fight), sans-serif neutre pour le texte courant
- Grille de cards pour tous les listings (events, organisations, fighters) — validé face à l'alternative liste horizontale
- Images avec ratio adapté au contenu : portraits en carré arrondi, posters d'event en 16:9 — plus de `rounded-full` sur du contenu rectangulaire

### Bugs corrigés au passage

- `text-white-900` / `text-white-500` utilisés dans les composants (`events-by-org.tsx`, `fights-by-event.tsx`, etc.) ne sont pas des classes Tailwind valides (pas de palette `white` custom définie dans `tailwind.config.ts`) → remplacées par de vraies couleurs déclarées dans la config Tailwind, cohérentes avec la palette Dark Combat.

## Détail des pages

**Accueil (`/`)**
- Hero pleine largeur : poster du prochain événement le plus proche dans le temps (toutes orgs confondues), nom, date, lieu, lien vers l'event
  - Si aucun événement futur en base (cas actuel : toutes les données PFL sont des events 2021 passés), le hero affiche l'événement le plus récent passé à la place, avec un badge "Dernier événement" plutôt que de laisser le hero vide
- Grille des organisations en dessous (logo, nom, abréviation)

**Organisation (`/organizations/[slug]`)**
- Bandeau logo + nom
- Grille des events de l'organisation (poster 16:9, nom, date, lieu)
- Passe en Server Component (actuellement `"use client"` + `useEffect` + `fetch`, cause un flash "Loading...")

**Événement (`/events/[slug]`)**
- Bandeau poster de l'event
- Liste des fights en lignes (fighter vs fighter), pas en grille — plus lisible pour une confrontation
- Fetch des fighters groupé côté serveur (actuellement boucle séquentielle fighter par fighter dans `fights-by-event.tsx`, cause une cascade de requêtes réseau)

**Annuaire combattants (`/fighters`) — nouveau**
- Grille de cards : portrait, nom, organisation, catégorie de poids, record
- Filtre par organisation (dropdown, interactif côté client sur données déjà chargées — pas de nouveau fetch)
- Pas de recherche texte en v1 (YAGNI)

**Profil combattant (`/fighters/[slug]`) — nouveau**
- Bandeau photo + grille de stats (W/L/D, décompte par méthode : KO/soumission/décision)
- Historique des fights en liste sous les stats
- Les stats par méthode sont calculées à la volée depuis la table `fights` (méthode + `winner_id`) plutôt que stockées en colonne dénormalisée sur `fighters`

## Architecture

- Toutes les pages listées passent en **Server Components** (fetch direct en base au rendu serveur), sauf le filtre par organisation sur `/fighters` qui reste interactif côté client sur des données déjà chargées.
- La couche données (`data/lib/data.ts`) et le schéma SQL existant sont conservés tels quels dans cette spec. La migration du provider DB (chantier 1) est indépendante ; l'API `sql\`...\`` utilisée ici reste compatible avec un driver Neon.
- Les routes `pages/api/*` actuelles restent en place pour l'instant (pas de migration forcée vers App Router Route Handlers dans ce chantier — hors scope, pas de gain direct sur le problème traité).

## États vides et erreurs

Remplacement du texte brut actuel (`Loading...`, `Error: {message}`) par des composants réutilisables dans le style Dark Combat :
- État de chargement : squelette sombre animé plutôt qu'un texte
- État vide : "Aucun combat programmé", "Aucun combattant dans cette catégorie" — généralisé à events et fighters (existe déjà partiellement pour les fights)
- État d'erreur : message stylé, cohérent avec le reste de l'UI

Nécessaire car UFC et Bellator resteront quasi vides tant que le chantier 2 (scraping) n'est pas fait — le site doit rester présentable avec des données partielles.

## Tests

Pas de suite de tests automatisés dans le projet actuel, et le périmètre de ce chantier est de l'affichage plutôt que de la logique métier complexe. Décision : vérification manuelle via navigateur, pas d'introduction de tests automatisés pour cette refonte.

## Hors périmètre (rappel)

- Migration de la base de données (chantier 1)
- Scraping UFC / Bellator et réactivation du seed complet (chantier 2)
- Application mobile React Native / Expo (chantier 4)
