# MMA Universe — Agrégation de news MMA par flux RSS

Date : 2026-09-04

## Contexte

Le site n'a aujourd'hui aucune section "actualités". Il existe déjà un pipeline d'ingestion de données externes bien établi pour les events/combats/classements : des scrapers dans `data/scrapers/*` (Sherdog, sites d'organisations) déclenchés par des scripts npm (`scrape:ufc`, `sync:ufc-rankings`, ...), qui écrivent dans Neon Postgres, consommé ensuite par `data/lib/data.ts` puis affiché via des routes/pages Next.js.

On veut ajouter un flux de news MMA agrégées depuis des sites tiers (pas de rédaction éditoriale maison), en réutilisant les mêmes grands principes (ingestion → DB → lecture), mais avec un déclenchement automatique périodique plutôt que manuel, car la fraîcheur compte pour des news.

## Périmètre

**Dans le périmètre (V1) :**
- Ingestion périodique (cron) de flux RSS de sites MMA francophones et anglophones, mélangés dans un seul flux
- Affichage : titre + image + court extrait, avec lien externe vers l'article source (pas de republication du texte complet)
- Une section "Actus" sur la home + une page dédiée `/actualites` avec filtre par organisation
- Dédoublonnage automatique basique (par URL, puis quasi-doublons par titre similaire) — pas de file de validation manuelle
- Web uniquement

**Explicitement hors périmètre (V1), reporté à une itération suivante :**
- Contenu éditorial original (rédaction maison)
- Lien automatique d'une news vers une fiche combattant précise (matching de noms) — seul le lien vers l'organisation source est fait, statiquement, par source
- Écran mobile (Expo) — l'API sera conçue pour être réutilisable telle quelle, mais aucune UI mobile n'est livrée dans cette itération
- Scraping HTML de secours pour les sources sans flux RSS (à évaluer si une source jugée indispensable n'a pas de flux)

## Design

### Flux de données

```
Flux RSS des sources (data/news/sources.config.ts)
        │  fetch HTTP périodique
        ▼
Vercel Cron  →  app/api/cron/news/route.ts
        │  rss-parser : parse chaque flux
        ▼
data/news/fetch-news.ts
  - normalisation (titre, extrait, lien, image, source, org, langue, published_at)
  - dédoublonnage (URL déjà connue, puis quasi-doublons par titre sur 48h)
        ▼
Upsert Neon Postgres — table news_articles
        ▼
app/api/news/route.ts  (lecture publique, paginée, filtre ?org=)
        ▼
Home ("Actus") + app/actualites/page.tsx
```

Reprend le pattern existant scraper → DB → route → UI (cf. `data/scrapers/*` → `data/lib/data.ts` → `app/page.tsx`), avec un cron à la place d'un lancement manuel.

### Sources

`data/news/sources.config.ts`, sur le modèle de `data/scrapers/orgs.config.ts` :

```ts
export const NEWS_SOURCES: NewsSourceConfig[] = [
  { sourceId: 'mma-fighting', feedUrl: '...', orgKey: null, language: 'en' },
  { sourceId: 'sherdog', feedUrl: '...', orgKey: null, language: 'en' },
  { sourceId: 'lequipe-mma', feedUrl: '...', orgKey: null, language: 'fr' },
  // ...
];
```

Liste de départ à valider pendant l'implémentation (les URLs de flux RSS doivent être vérifiées une par une — certaines bougent ou disparaissent). Chaque source peut optionnellement être rattachée à un `orgKey` existant (ex. un flux UFC.com → `'ufc'`) ; sinon `orgKey: null` (ex. un flux généraliste comme Sherdog ou MMA Fighting qui couvre plusieurs organisations).

### Modèle de données

Nouvelle table `news_articles`, indépendante des tables existantes :

| Colonne | Type | Notes |
|---|---|---|
| `id` | serial | clé primaire |
| `source_id` | text | référence `NewsSourceConfig.sourceId` |
| `org_id` | int \| null | organisation associée à la source, si connue |
| `title` | text | |
| `excerpt` | text | description du flux RSS |
| `url` | text, unique | lien vers l'article original ; clé de dédoublonnage principale |
| `image_url` | text \| null | |
| `language` | text (`'fr'` \| `'en'`) | déduite de la source |
| `published_at` | timestamptz | date annoncée par la source |
| `fetched_at` | timestamptz | date d'ingestion par notre cron |

### Composants

**Backend**
- `data/news/sources.config.ts` — configuration des sources (voir ci-dessus)
- `data/news/fetch-news.ts` — fetch + parse (`rss-parser`) + normalisation + dédoublonnage + upsert ; fonction pure testable, séparée de l'accès DB comme le reste de `data/scrapers`
- `app/api/cron/news/route.ts` — déclenchée par Vercel Cron (`vercel.json`, ex. `*/20 * * * *`), appelle `fetch-news.ts`
- `app/api/news/route.ts` — lecture publique paginée, `?org=<orgKey>` optionnel

**Frontend (web)**
- `components/ui/news/news-card.tsx` — une carte article (image, titre, extrait, source, date relative, lien externe `target="_blank"`)
- `components/ui/news/news-section.tsx` — bloc réutilisé sur la home et sur `/actualites`, sur le modèle de la section "Derniers résultats" (`app/page.tsx`)
- `app/actualites/page.tsx` — page dédiée, filtre par organisation, pagine via `app/api/news/route.ts`

Le pipeline d'ingestion ne connaît rien de l'UI ; les composants d'affichage ne connaissent que la forme JSON renvoyée par `/api/news`.

### Gestion des erreurs

- Une source en échec (timeout, erreur HTTP, XML malformé) est ignorée pour ce passage de cron et logguée ; les autres sources continuent d'être traitées — une source cassée ne doit jamais bloquer les autres.
- Article déjà connu (`url` déjà en base) : upsert silencieux, pas une erreur.
- Champs optionnels absents du flux (`image_url`, `excerpt`) : `null` accepté, l'UI gère leur absence (visuel de remplacement par défaut si pas d'image).
- Pas de mécanisme de retry applicatif en V1 : chaque flux étant relu en entier à chaque passage, le prochain cron rattrape naturellement un passage manqué.

### États vides

Aucun article en base (premier déploiement avant le premier passage de cron, ou toutes les sources en échec) → section "Actus" masquée sur la home et `/actualites` affiche un `EmptyState`, cohérent avec le traitement des autres sections vides du site (`components/ui/shared/empty-state.tsx`).

## Tests

Suit le pattern existant (`npm test` → `tsx --test "data/**/*.test.ts"`) :

- `data/news/fetch-news.test.ts` avec des fixtures de flux RSS (`data/news/__fixtures__/*.xml`), aucun appel réseau réel dans les tests :
  - parsing d'un flux valide → articles normalisés correctement
  - flux vide → aucun article, pas d'erreur
  - flux malformé → ignoré, ne fait pas planter le traitement des autres sources
  - doublon par URL déjà connue → pas de ré-insertion
  - quasi-doublon par titre similaire dans la fenêtre de 48h → un seul conservé
- Pas de test pour les routes API elles-mêmes, cohérent avec le reste du projet (pas de mock DB) ; vérification manuelle via le navigateur pour l'intégration bout-en-bout.

## Ce qui ne change pas

- Tables et pipelines existants (events, fighters, rankings) : aucun changement de schéma ni de scraper existant.
- `app/page.tsx` : ajout d'une section, sans modification des sections existantes (hero, combats à venir, derniers résultats).
