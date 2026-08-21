# MMA Universe — Pick'em / Pronostics (chantier 5)

Date : 2026-08-21

## Contexte

Le site web et l'app mobile sont aujourd'hui un miroir en lecture seule des données UFC/PFL/Bellator (voir `docs/superpowers/specs/2026-08-15-web-frontend-redesign-design.md` et `docs/superpowers/specs/2026-08-18-mobile-app-design.md`) — aucun compte utilisateur, aucune fonctionnalité mobile-only n'existe nulle part dans le projet. Ce chantier ajoute un système de pronostics ("pick'em") : pour chaque combat d'un event, l'utilisateur prédit le vainqueur, la catégorie de méthode et (si pertinent) le round, et gagne des points une fois le résultat réel connu. C'est la première fonctionnalité du projet qui nécessite des comptes utilisateurs — l'auth est construite ici uniquement pour servir le pick'em, pas comme un système de profils social plus large.

## Décisions actées (issues du brainstorming)

- **Format : pick'em par event**, pas de draft saison longue façon fantasy football (roster de combattants sur plusieurs mois) — scope trop lourd pour une v1.
- **Scoring détaillé** : vainqueur + catégorie de méthode + round, pas seulement le vainqueur.
- **Classement global uniquement** — pas de ligues privées entre amis en v1.
- **Auth minimale**, dédiée au pick'em (pas de profils publics, pas d'historique social affiché à d'autres utilisateurs).
- **Verrou unique par event** au moment du coup d'envoi de la card, pas de verrou combat par combat.
- **Web + mobile en parallèle** dès le lancement — l'auth et les écrans de pick sont construits sur les deux plateformes dans ce chantier (voir note de découpage en fin de section Architecture).
- **Provider d'auth** : provisionné via le Vercel Marketplace au moment du planning d'implémentation (workflow `vercel:marketplace`), pas choisi dans cette spec. Contrainte fixée ici : le provider doit exposer un SDK/flow utilisable à la fois côté Next.js (web) et Expo (mobile) avec le même compte utilisateur cross-plateforme.
- **Pas de job de scoring pré-calculé** : le score se calcule à la volée par requête SQL (jointure `picks` ↔ `fights`), cohérent avec l'absence de couche de cache/queue ailleurs dans le projet.

## Modèle de données

Nouvelles tables Postgres/Neon (SQL brut, comme le reste du projet — pas d'ORM) :

```sql
-- Un utilisateur inscrit. external_auth_id référence l'identité côté provider marketplace.
CREATE TABLE users (
  id BIGSERIAL PRIMARY KEY,
  external_auth_id TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Un pronostic sur un combat, par utilisateur.
CREATE TABLE picks (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id),
  fight_id BIGINT NOT NULL REFERENCES fights(id),
  predicted_winner_id BIGINT NOT NULL REFERENCES fighters(id),
  predicted_method_category TEXT NOT NULL CHECK (predicted_method_category IN ('ko_tko', 'submission', 'decision')),
  predicted_round SMALLINT, -- NULL si predicted_method_category = 'decision'
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, fight_id)
);
```

**Extension d'un champ existant** : `events.date` est aujourd'hui stocké en `YYYY-MM-DD` seul (voir `data/scrapers/shared/normalize-date.ts`) — la donnée source Sherdog expose pourtant un `startDate` ISO 8601 complet avec heure, dont seule la partie date est actuellement conservée. Ce chantier étend `events` avec une colonne `start_time TIMESTAMPTZ` (nullable pour les events déjà en base sans heure connue) et met à jour `normalize-date.ts`/les scrapers pour la capturer. C'est ce champ qui sert de référence au verrou des picks (voir section suivante).

Pas de table `scores` séparée — voir section Scoring.

## Fenêtre de pick & verrouillage

- Un combat devient pronosticable dès qu'il existe en base (event publié via seed/sync).
- **Verrou unique par event**, à `events.start_time`. Si `start_time` est `NULL` (event historique ou scrapé avant cette extension), le verrou retombe sur 00:00 UTC le jour de `date` — comportement dégradé mais jamais bloquant.
- Le verrou est vérifié **côté serveur** à l'écriture d'un pick (insert/update rejetés si `now() >= events.start_time`), pas seulement masqué côté UI — un utilisateur avec un onglet resté ouvert pendant que l'event démarre ne doit pas pouvoir soumettre après coup.
- Un pick est modifiable librement (UPSERT sur `(user_id, fight_id)`) tant que l'event n'a pas démarré.

## Scoring

Calculé à la volée par requête (jointure `picks` ↔ `fights`), par combat pronostiqué :

| Condition | Points |
|---|---|
| `predicted_winner_id = fights.winner_id` | +10 |
| … et `predicted_method_category` correspond à la catégorie du `fights.method` réel | +5 bonus |
| … et `predicted_round = fights.round` (uniquement si la méthode réelle n'est pas une décision) | +5 bonus |

Score max par combat : 20 points.

**Cas limites** :
- Pas de pick soumis avant le verrou → 0 pt, n'empêche pas de scorer les autres combats du même event.
- Match nul / no-contest (`fights.winner_id IS NULL` avec `fight_finished = true`) → 0 pt pour tout le monde sur ce combat ; ce n'est pas une option proposée dans l'UI de pick.
- Combat retiré de la card après que des picks ont été faits → exclu du calcul de score pour tous, comme s'il n'avait jamais existé.
- Main event vs prelims → **points uniformes**, pas de pondération plus forte pour le main event (simplicité, pas de débat sur le multiplicateur).

Le texte libre de `fights.method` (ex. "Submission (Rear-Naked Choke)", "TKO (Punches)", "Decision (Unanimous)") doit être mappé vers l'une des trois catégories (`ko_tko` / `submission` / `decision`) par une fonction de normalisation dédiée, sur le même principe que `normalizeDate` — à écrire et tester au moment de l'implémentation, avec la liste réelle des valeurs déjà en base comme fixture de test.

## Classements

- **Par event** : somme des points des combats de cet event, classement qui se reconstruit à chaque card.
- **All-time** : cumul des points sur tous les events pronostiqués par l'utilisateur.
- Tri par points décroissant ; égalité = même rang affiché, pas de tie-break au-delà.

## Écrans web

- **Page event** (`app/events/[slug]`) : nouvelle section "Pronostics" sous la fight card existante. Par combat non commencé : formulaire (sélecteur vainqueur, sélecteur méthode, sélecteur round conditionnel à la méthode). Une fois l'event verrouillé/terminé : pick affiché à côté du résultat réel, badge correct/incorrect, points gagnés.
- **Nouvelle page classement** (`app/classement`) : toggle "Cet event" / "All-time".
- **Nouvelle page "Mes pronostics"** (connecté uniquement) : historique des picks à travers tous les events + score total.
- **Nav globale** : état connecté/déconnecté (lien connexion, ou avatar + déconnexion).

## Écrans mobile

- **Event detail** (`mobile/app/(tabs)/events/[id].tsx`) : même section pronostics sous la fight card, sous la même logique que le web.
- **Classement** : accessible depuis l'onglet Events (lien en haut de la liste), pas de 5e onglet — la nav à 4 onglets (Home/Events/Fighters/Orgs) reste stable.
- **Écran "Mes pronostics"** : nécessite un point d'entrée auth net-new (l'app mobile n'a aujourd'hui aucune notion de compte — c'était explicitement hors périmètre du chantier 4).
- **Auth mobile** : via le SDK du provider marketplace retenu, état géré côté client (contexte React), cross-plateforme avec le même compte que le web.

## Gestion des erreurs et états de chargement

- Non connecté + tentative de pick → invite à se connecter, redirection post-login vers le combat concerné.
- Erreur réseau à la soumission d'un pick → message inline + bouton retry, la sélection déjà faite dans le formulaire n'est pas perdue.
- Pick tenté après verrouillage (event démarré pendant que la page était ouverte) → rejet serveur explicite ("Cet event a démarré, les pronostics sont clos"), état du formulaire resynchronisé avec le serveur.
- Chargement/vide/erreur du classement et de l'historique de picks → réutilise le pattern 3-états déjà établi côté web (chantier 3) et mobile (chantier 4) : squelette / "Aucune donnée" / erreur + "Réessayer".

## Tests

- Fonction pure de scoring (pick + résultat réel → points) testée unitairement sur tous les cas limites : bonne méthode mauvais round, méthode et round corrects, tout faux, draw/no-contest, pas de pick soumis, combat retiré de la card — même pattern que `data/lib/fight-utils.test.ts`.
- Fonction de normalisation `method` texte libre → catégorie (`ko_tko`/`submission`/`decision`) testée contre l'ensemble des valeurs de `method` réellement présentes en base au moment de l'implémentation.
- Test d'intégration : un insert/update de pick après `events.start_time` est rejeté côté serveur (pas seulement masqué côté UI).

## Vérification manuelle

1. Créer un compte (web puis mobile avec le même compte), se connecter sur les deux.
2. Sur un event à venir : soumettre un pick sur chaque combat (web), vérifier qu'il apparaît identique côté mobile (même compte).
3. Modifier un pick avant le verrou → la modification est prise en compte.
4. Après l'heure de `start_time` de l'event (ou en simulant via une date de test) : tenter de soumettre un nouveau pick → rejeté avec message explicite, sur web et mobile.
5. Une fois les résultats synchronisés (`sync-upcoming-to-db`) : la page event affiche les picks vs résultats réels avec le bon nombre de points ; le classement (event + all-time) reflète ces points.
6. Vérifier un cas de draw/no-contest et un cas de combat retiré de la card (si disponible en données réelles ou via une donnée de test) : 0 pt pour tous, pas d'erreur.
7. Couper le réseau pendant la soumission d'un pick → écran d'erreur avec retry, sélection non perdue.

## Hors périmètre

- Ligues privées entre amis / groupes / invitations — classement global uniquement en v1.
- Draft saison longue façon fantasy football (roster de combattants sur plusieurs events/mois).
- Profils publics, avatars, historique de picks visible par d'autres utilisateurs.
- Pondération différente par combat (main event, co-main, etc.) — points uniformes.
- Notifications (rappel de verrou imminent, résultat disponible) — aucune notification n'existe nulle part dans le projet aujourd'hui.
- Job de scoring pré-calculé / cache — calcul à la volée uniquement en v1, à réévaluer si le volume grossit.

## Risques / points d'attention

- **Automatisation du sync des résultats** : `sync-upcoming-to-db.ts` / `rescrape-upcoming.ts` sont aujourd'hui lancés manuellement, sans cron. Sans automatisation, le scoring peut rester bloqué plusieurs heures/jours après un event tant que personne ne relance le script manuellement. Ce chantier suppose l'ajout d'un cron (ex. Vercel Cron) déclenchant le sync peu après chaque `events.start_time` connu — à traiter comme une tâche du plan d'implémentation, pas une extension optionnelle.
- **Couverture de données PFL/Bellator partielle par endroits** (héritée du chantier 2) : le pick'em sur des events dont les résultats ne sont jamais synchronisés resterait bloqué en "en attente" indéfiniment. Pas bloquant pour livrer la fonctionnalité, mais à surveiller — un pick'em sur un event dont les données ne se complètent jamais nuit à la confiance dans le classement.
- **Scope web + mobile en parallèle** double le travail (deux implémentations d'écran de pick, deux intégrations auth). Recommandation pour le plan d'implémentation : découper en deux plans séquentiels avec revue à chaque étape — (1) backend partagé (schéma, endpoints, scoring, verrouillage) + web, (2) mobile — plutôt qu'un unique plan monolithique, pour garder des points de revue gérables comme les chantiers précédents.
- **Bloquant, trouvé en préparant le plan d'implémentation : `sync-upcoming-to-db.ts` fait un `DELETE FROM fights WHERE event_id = ...` puis ré-`INSERT` la totalité des combats de l'event à *chaque* exécution — même quand rien n'a changé.** C'est exactement le script que ce chantier veut automatiser en cron pour faire remonter les résultats. Avec `picks.fight_id REFERENCES fights(id)` : soit la FK n'a pas de `ON DELETE CASCADE` et le `DELETE` échoue dès qu'un utilisateur a pronostiqué un combat de cet event (le sync plante) ; soit elle a un `ON DELETE CASCADE` et chaque sync efface silencieusement les pronostics des utilisateurs sur cet event. Les deux issues sont inacceptables pour une fonctionnalité dont la valeur repose sur la persistance des picks. **Ce chantier doit donc faire évoluer `sync-upcoming-to-db.ts` pour mettre à jour les combats en place (upsert matché sur `(event_id, fighter1_id, fighter2_id)`) au lieu de les supprimer/recréer**, avant d'ajouter la table `picks` — traité comme une tâche obligatoire du plan, pas une extension. `app/seed/route.ts` a le même défaut sur `seedFights()` (déjà documenté comme risque connu pour `is_main_event` dans `docs/superpowers/specs/2026-08-21-fight-card-component-design.md`) mais reste hors périmètre ici : c'est un script de seed initial/dev, pas le chemin de mise à jour en production une fois des picks existent — à ne plus ré-exécuter en production après le lancement du pick'em.
