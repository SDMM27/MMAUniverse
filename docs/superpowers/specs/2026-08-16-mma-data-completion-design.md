# MMA Universe — Complétion des données (scraping UFC/PFL/Bellator + seed complet)

Date : 2026-08-16

## Contexte

`mma-universe-old` tourne sur des données très partielles : `organizations` a 3 lignes en dur (id 1 = UFC, id 2 = PFL, id 3 = Bellator, référencées ailleurs — fixes), mais seul un sous-ensemble de PFL Europe est réellement scrapé et seedé (`data/scrapPFL.js` → `pastPflEvents`/`pastPflFighters`/`pastPflFights` dans `data/lib/placeholder-data.ts`). `app/seed/route.ts` n'appelle en prod que `seedFights()` ; `seedOrganizations()`, `seedEvents()`, `seedFighters()` sont commentées. `data/scrape.js` (UFC, `ufc-fr.com`) n'est qu'un stub. Aucun scraper Bellator n'existe.

C'est le chantier 2 des 4 sous-chantiers du projet (voir `docs/superpowers/specs/2026-08-15-web-frontend-redesign-design.md` pour le contexte des 4 chantiers). Chantier 1 (migration Neon) et chantier 3 (refonte front "Dark Combat") sont déjà faits.

## Enquête préalable — décisions actées

**Le bug `organizationId=3` dans `data/scrapPFL.js` est un vrai bug, pas un choix volontaire.** Vérifié en direct sur `pflmma.com` : le site est purement PFL-brandé (aucune mention Bellator), et les combattants scrapés depuis `/europe-event` (Doumbé, Chamsoudinov, Abdouraguimov...) sont le roster PFL Europe. Les données PFL Europe étaient mal étiquetées Bellator (org 3) au lieu de PFL (org 2). Ce chantier repart d'une extraction propre (voir Architecture ci-dessous), donc le bug ne se "corrige" pas in situ — il devient sans objet.

**Bellator n'existe plus comme organisation active.** PFL a racheté Bellator en 2023 ; en 2025 la marque Bellator a été retirée, son roster fondu dans PFL. Il n'y a donc plus de site officiel Bellator vivant à scraper — toute donnée Bellator est nécessairement historique (2009–2025).

**Source retenue : Sherdog.com, unique pour les 3 organisations** (décision prise après comparaison avec Wikipédia — voir Architecture). `robots.txt` de Sherdog : `Allow: /` pour tous les user-agents, aucune restriction.

**Granularité : historique complet + events à venir**, pour les 3 organisations (UFC ~816 events, PFL ~133 events, Bellator ~300 events sur 2009-2025).

**Capture du vainqueur (`winner_id`) activée** : la logique front actuelle (`data/lib/data.ts` → `fetchFightsByFighterId`, `data/lib/fighter-stats.ts`) traite tout combat terminé avec `winner_id = null` comme un **match nul**. Les données PFL actuelles ne renseignent jamais `winner_id` — tous les combats terminés s'affichent donc comme des draws sur les fiches combattant. Ce chantier corrige ça en capturant le vainqueur à la source.

**Format de stockage intermédiaire : un JSON par organisation** (`data/scraped/*.json`), pas d'ajout à `placeholder-data.ts` (déjà 5300+ lignes, plusieurs formats incohérents entre `pflEvents`/`pastPflEvents`/`fights` génériques).

## Architecture

### Pourquoi Sherdog plutôt que Wikipédia + sites officiels

Approche initiale envisagée (Wikipédia pour l'historique UFC/Bellator + `ufc-fr.com`/`pflmma.com` pour les events à venir) fonctionnelle mais hétérogène : 3 structures de site différentes à parser, pas de record combattant fiable pour l'historique, vainqueur à déduire par heuristique (ordre des noms avant "def.").

Vérification en direct de Sherdog : une page organisation par ligue (`sherdog.com/organizations/<slug>`) avec listing complet des events passés et à venir ; une page event par combat card avec WIN/LOSS explicite par combattant (pas d'heuristique), method/round/time/référee/weight class ; une page fighter par combattant avec record carrière réel (wins/losses décomposés KO/soumission/décision) et photo de profil. **Structure identique pour UFC, PFL et Bellator** — un seul scraper suffit, paramétré par organisation, au lieu de trois sources hétérogènes.

### Scraper unifié

```
data/scrapers/
  shared/
    fetch-throttled.ts   // fetch séquentiel, délai fixe 1-2s entre requêtes
    normalize-date.ts    // toute date Sherdog ('SEP 20, 2013' / 'Sep / 07 / 2024') → ISO 'YYYY-MM-DD'
    checkpoint.ts         // lecture/écriture d'un fichier de progression par org
  sherdog.ts              // scraper générique, appelé 1x par organisation
  run-all.ts               // orchestrateur : appelle sherdog.ts pour les 3 orgs, séquentiellement
```

`sherdog.ts` prend en paramètre `{ organizationId: number, sherdogOrgPath: string }` :

| Organisation | `organizationId` | `sherdogOrgPath` |
|---|---|---|
| UFC | 1 | `organizations/Ultimate-Fighting-Championship-UFC-2` |
| PFL | 2 | `organizations/Professional-Fighters-League-12241` |
| Bellator | 3 | `organizations/Bellator-MMA-1960` |

Déroulé pour une organisation :
1. Fetch la page organisation, extrait la liste des events passés (paginée — le mécanisme de pagination exact, page query param ou "load more" AJAX, est à vérifier en implémentation ; potentiellement plusieurs centaines d'entrées pour l'UFC) et à venir.
2. Pour chaque event : fetch la page event, extrait `name`/`date`/`event_location`/`event_poster` (si présent) et la table de combats (fighter1/fighter2/WIN-LOSS/method/round/time/weight_class).
3. Déduplique les combattants rencontrés (par URL `/fighter/<slug>-<id>`, pas par nom seul — évite les collisions de noms).
4. Pour chaque combattant unique : fetch sa page fighter, extrait `image_url`, `record` (format `"W-L-D"` reconstruit depuis wins/losses/draws), `ranking` (laissé à `0` par défaut si Sherdog n'expose pas de classement par organisation à cet endroit — pas de requête supplémentaire dédiée pour ça dans ce chantier).
5. Écrit un checkpoint après chaque event traité (reprise sur erreur — voir Robustesse).
6. En fin de run : écrit `data/scraped/<org>.json`.

### Format de sortie — `data/scraped/{ufc,pfl,bellator}.json`

Une forme commune, alignée sur `data/lib/definitions.ts`, avec des clés naturelles (pas d'ids numériques inventés — les vrais ids sont attribués par Postgres `SERIAL` à l'insertion, comme le fait déjà `pastPflFights` via `getEventIdByName`/`getFighterIdByName`) :

```ts
type ScrapedOrgData = {
  organization_id: number;          // 1 | 2 | 3, fixe
  events: Array<{
    name: string;                   // clé naturelle
    date: string;                   // ISO 'YYYY-MM-DD', obligatoire
    event_location: string;
    event_poster: string;
  }>;
  fighters: Array<{
    name: string;                   // clé naturelle
    image_url: string;
    weight_class: string;
    record: string;
    ranking: number;
  }>;
  fights: Array<{
    event_name: string;             // FK naturelle → events[].name
    fighter1_name: string;          // FK naturelle → fighters[].name
    fighter2_name: string;
    fight_finished: boolean;
    winner_name: string | null;     // null si non terminé ; sinon = fighter1_name ou fighter2_name
    method: string;
    round: number;
    time: string;
    weight_class: string;
  }>;
};
```

Limite connue et acceptée : deux combattants distincts partageant le même nom entreraient en collision au lookup par nom côté seed — risque déjà présent dans le code actuel (PFL), non résolu dans ce chantier.

### Nettoyage de `placeholder-data.ts`

Une fois `data/scraped/*.json` opérationnel, les tableaux `pflEvents`/`pflFighters`/`pflFights`/`pastPflEvents`/`pastPflFighters`/`pastPflFights`/`events`/`fighters`/`fights` génériques sont supprimés de `placeholder-data.ts` (obsolètes, remplacés). Seul `organizations` y reste (3 lignes fixes, toujours la source de vérité pour `seedOrganizations`). `data/scrapPFL.js` et `data/scrape.js`, ainsi que les fichiers de sortie intermédiaires épars (`detailedEvents.json`, `pflEventsDetails.js`, `fightersOutput.js`, etc.) sont supprimés — remplacés par `data/scrapers/`.

## Modifications `app/seed/route.ts`

```ts
import ufcData from '@/data/scraped/ufc.json';
import pflData from '@/data/scraped/pfl.json';
import bellatorData from '@/data/scraped/bellator.json';
import { organizations } from '@/data/lib/placeholder-data';

const orgDatasets = [ufcData, pflData, bellatorData];
```

Les 4 fonctions (`seedOrganizations`, `seedEvents`, `seedFighters`, `seedFights`) sont décommentées pour de vrai dans `GET()`, dans le même ordre qu'aujourd'hui (organizations → events/fighters → fights). `seedEvents`/`seedFighters`/`seedFights` bouclent sur `orgDatasets` au lieu de ne traiter que `pastPfl*`. `seedFights` résout `event_name`/`fighter1_name`/`fighter2_name`/`winner_name` en ids via les helpers existants (`getEventIdByName`, `getFighterIdByName`) et insère désormais `winner_id`. Le pattern `ON CONFLICT DO NOTHING` idempotent est conservé partout.

## Bug corrigé au passage : tri par date

`data/lib/event-utils.ts` (`computeNextEvent`) et `fetchAllEvents` (`ORDER BY e.date ASC`) comparent les dates comme des chaînes ISO. Les données actuelles ont des dates vides (`pastPflEvents`) ou non-ISO (`events` générique, format français). La normalisation systématique en `YYYY-MM-DD` dans `shared/normalize-date.ts` est un prérequis pour que le hero de la homepage et le tri de `/events` fonctionnent une fois les 3 organisations peuplées — traité comme correction de bug, pas comme nicety.

## Volumétrie et robustesse

| Org | Events estimés | Requêtes estimées (events + fighters dédupliqués) | Durée (@1-2s/requête séquentiel) |
|---|---|---|---|
| UFC | ~816 | ~2000-3000 | ~50-80 min |
| PFL | ~133 | ~500-800 | ~15-20 min |
| Bellator | ~300 | ~800-1200 | ~20-30 min |

Total estimé : 1h30-2h30 d'exécution pour les 3 scrapers. Conséquences sur le design :

- **Checkpoint après chaque event traité** (`data/scraped/.cache/<org>-progress.json`) — un plantage réseau ou une page introuvable en cours de run permet une reprise sans tout refaire.
- **Tolérance aux pages atypiques** : logue et passe à l'event suivant plutôt que de crasher tout le run (utile notamment pour les tout premiers events Bellator/PFL, potentiellement moins bien structurés).
- **Exécution en tâche de fond**, un run par organisation, suivi via les logs/checkpoints plutôt qu'en attente active.
- `data/scraped/*.json` est commité tel quel une fois généré — le seed lit un fichier statique versionné, pas une source live à chaque `npm run dev`/déploiement.

## Vérification manuelle

1. `npm run dev`, `GET /seed` → 200, logs sans erreur.
2. `/` → hero affiche un event réel cohérent (plus seulement PFL/Bellator par défaut), grille des 3 organisations cliquables.
3. `/organizations/1`, `/organizations/2`, `/organizations/3` → chacune affiche ses propres events réels.
4. `/events` → mélange des 3 organisations, trié par date croissante sans anomalie (dates ISO).
5. `/fighters` et `/fighters/[id]` → filtre par organisation fonctionne ; une fiche combattant montre un historique de combats avec les bons win/loss/draw (grâce à `winner_id`).

## Hors périmètre

- Chantier 4 (app mobile).
- Rankings par organisation (Sherdog n'expose pas ce champ au même endroit que le record — `ranking` reste à `0` par défaut comme aujourd'hui).
- Résolution des collisions de noms de combattants homonymes.
- Ajout d'organisations au-delà d'UFC/PFL/Bellator — le découpage en scraper générique paramétré (`{ organizationId, sherdogOrgPath }`) rend l'ajout futur trivial (un nouveau paramètre, pas un nouveau scraper), mais aucune autre organisation n'est scrapée dans ce chantier.
