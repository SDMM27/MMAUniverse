# MMA Universe — App mobile (chantier 4)

Date : 2026-08-18

## Contexte

C'est le chantier 4 des 4 sous-chantiers du projet (voir `docs/superpowers/specs/2026-08-15-web-frontend-redesign-design.md` pour le contexte des 4 chantiers). Chantier 1 (migration Neon), chantier 2 (scraping Sherdog + seed complet) et chantier 3 (refonte front "Dark Combat") sont déjà faits — le site web dispose maintenant de données réelles pour UFC/PFL/Bellator et d'un thème visuel abouti.

Il existe déjà une surface JSON sous `pages/api/*` (`event/[slug].js`, `events/[slug].js`, `fighter/[slug].js`, `fights/[slug].js`, `orgs/[slug].js`), laissée de côté pendant le chantier 3 avec l'intention explicite de la réutiliser pour l'app mobile. En l'état ces routes sont inutilisables : commentaires placeholder en français ("Assurez-vous que cette fonction est correctement implémentée..."), usage de `data.rowCount` non garanti avec le driver Neon actuel, aucune jointure (pas de nom d'organisation/adversaire), et couverture incomplète (pas de route pour la home, pas de liste d'organisations). Ce chantier les remplace plutôt que de les réparer (voir Architecture).

## Décisions actées (issues du brainstorming)

- **Objectif : miroir mobile du site web**, en lecture seule — mêmes données (orgs/events/fighters), pas de fonctionnalité mobile-only en v1.
- **Aucun compte utilisateur, aucun favori, aucune notification push, aucun mode hors-ligne** en v1.
- **Distribution v1 : Expo Go**, iOS + Android simultanément — pas de build EAS natif ni de compte developer Apple/Google dans ce chantier.
- **Navigation : 4 onglets en bas** — Home / Events / Fighters / Orgs — validé visuellement pendant le brainstorming (préféré à un drawer ou des onglets en haut).
- **Emplacement du code : `mobile/` à la racine de ce repo**, projet Expo autonome avec son propre `package.json`. Pas de monorepo tooling (Turborepo/pnpm workspaces) — hors scope.
- **Style : NativeWind**, tokens Dark Combat repris du `tailwind.config.ts` web.

## Architecture

### Nouveau projet Expo — `mobile/`

```
mobile/
  app/                        // Expo Router — routing par fichiers
    (tabs)/
      _layout.tsx              // <Tabs> — Home / Events / Fighters / Orgs
      index.tsx                 // Home
      events/
        index.tsx               // Events (liste, filtre par org)
        [id].tsx                 // Event detail (fight card)
      fighters/
        index.tsx               // Fighters (liste, filtre par org)
        [id].tsx                 // Fighter profile (stats + historique)
      orgs/
        index.tsx               // Orgs (liste des 3 organisations)
        [id].tsx                 // Org detail (ses events)
    _layout.tsx                 // Root layout — polices, thème
  components/                  // équivalents mobiles des cards web (organization-card, event-card, fighter-card, fight-row)
  lib/
    api.ts                      // client fetch vers l'API mobile (voir ci-dessous)
    types.ts                    // réutilise les shapes de data/lib/definitions.ts (dupliquées ici, pas d'import cross-projet — mobile/ est un package Expo autonome)
  tailwind.config.js            // tokens Dark Combat copiés du tailwind.config.ts racine
  app.json / package.json / tsconfig.json
```

**Stack** : Expo + Expo Router (TypeScript) + NativeWind. Expo Router est retenu plutôt que React Navigation "bare" car il reprend la même logique de routing par fichiers que l'App Router déjà utilisé côté web — mental model familier, pas de configuration de navigateur à la main.

### Couche API — `app/api/mobile/**/route.ts` (Next.js, App Router)

Nouvelles routes ajoutées au projet Next.js existant (pas dans `mobile/`), qui **réutilisent directement les fonctions de `data/lib/data.ts`** déjà utilisées par les Server Components du site — aucune nouvelle logique de requête SQL, juste un wrapper JSON autour de fonctions existantes :

| Route | Fonction réutilisée | Usage mobile |
|---|---|---|
| `GET /api/mobile/home` | `fetchAllEvents` + `computeNextEvent` (`data/lib/event-utils.ts`) | Écran Home |
| `GET /api/mobile/orgs` | `fetchOrganizations` | Onglet Orgs |
| `GET /api/mobile/orgs/[id]` | `fetchOrganizationById` + `fetchEventsByOrg` | Org detail |
| `GET /api/mobile/events` | `fetchAllEvents` | Onglet Events |
| `GET /api/mobile/events/[id]` | `fetchEventById` + `fetchFightsByEvent` | Event detail |
| `GET /api/mobile/fighters` | `fetchAllFighters` | Onglet Fighters |
| `GET /api/mobile/fighters/[id]` | `fetchFighterById` + `fetchFightsByFighterId` + `computeFighterStats` (`data/lib/fighter-stats.ts`) | Fighter profile |

Les anciennes routes `pages/api/*` (`event`, `events`, `fighter`, `fights`, `orgs`) sont **supprimées** — remplacées par le tableau ci-dessus, plus complet et alignées sur le driver Neon actuel.

### Client de données mobile — `mobile/lib/api.ts`

Un client `fetch` minimal, une fonction par endpoint (`getHome()`, `getOrgs()`, `getEvent(id)`, etc.), pointant vers l'URL du déploiement Vercel du site web via une variable d'env Expo (`EXPO_PUBLIC_API_URL`). Pas de librairie de cache réseau (React Query, SWR) en v1 — le volume d'écrans est faible et les données changent rarement (seed statique) ; un simple `useEffect` + `useState` par écran suffit. À réévaluer si l'app grossit.

### Styling — NativeWind

`mobile/tailwind.config.js` copie les tokens de couleur/police du `tailwind.config.ts` racine (`base.bg #0a0a0a`, `base.card #161616`, `base.border #262626`, `accent #ff3b30`, `ink.primary #f5f5f5`, `ink.secondary #9a9a9a`, police Oswald pour les titres via `expo-font`). Duplication volontaire plutôt que partage de fichier — `mobile/` reste un package Expo autonome sans dépendance de build vers le projet Next.js.

## Navigation & écrans

Validé visuellement pendant le brainstorming : 4 onglets en bas, chacun avec sa propre pile de navigation (`Stack` Expo Router imbriqué sous chaque onglet, pour empiler le detail par-dessus la liste sans perdre l'onglet actif) :

- **Home** — hero du prochain event à venir (reprend `computeNextEvent`), overview des 3 organisations
- **Events** — liste de tous les events (3 organisations mélangées), filtre par organisation, tri par date → **Event detail** (fight card complète : liste des combats, méthode/round/temps, vainqueur)
- **Fighters** — liste de tous les combattants, filtre par organisation → **Fighter profile** (photo, record, historique de combats avec win/loss/draw)
- **Orgs** — les 3 organisations (UFC/PFL/Bellator) → **Org detail** (ses events)

## Gestion des erreurs et états de chargement

Chaque écran de liste/detail gère 3 états, cohérents avec les patterns déjà en place côté web (`data/lib` + composants d'état chantier 3) :
- **Chargement** : squelette simple (placeholder gris pulsant) le temps du fetch
- **Vide** : message "Aucune donnée" si la liste/l'organisation est vide (les données PFL/Bellator restent partielles par endroits, cf. hors périmètre du chantier 2)
- **Erreur réseau** : message d'erreur + bouton "Réessayer" qui relance le fetch — pertinent en mobile où la connectivité est moins fiable qu'en web

## Vérification manuelle

1. `npx expo start` dans `mobile/`, ouvrir dans Expo Go sur téléphone (iOS et Android) — l'app se charge sans crash.
2. Onglet Home → hero affiche un event réel à venir cohérent avec le site web.
3. Onglet Orgs → 3 organisations, tap sur une → ses events réels s'affichent.
4. Onglet Events → mélange des 3 organisations trié par date, filtre par org fonctionne, tap sur un event → fight card correcte.
5. Onglet Fighters → filtre par org fonctionne, tap sur un combattant → historique avec les bons win/loss/draw (pas de faux "draw" — même garantie que sur le web depuis le chantier 2).
6. Couper le réseau en cours de navigation → écran d'erreur avec bouton "Réessayer" plutôt qu'un crash silencieux.

## Hors périmètre

- Comptes utilisateurs, favoris, authentification
- Notifications push (même locales)
- Mode hors-ligne / cache persistant
- Build natif EAS et publication App Store / Play Store
- Monorepo tooling (Turborepo, pnpm workspaces) — `mobile/` reste un package autonome dupliquant certains types plutôt que de les partager avec le projet Next.js
- Librairie de cache réseau (React Query/SWR) — réévaluer si le volume d'écrans grossit
- Toute fonctionnalité au-delà du miroir du site web existant (recherche, classements affinés, contenu éditorial, etc.)
