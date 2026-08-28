# Adversaires cliquables sur la fiche combattant

## Contexte

Sur `/fighters/[id]`, `FighterHistoryList` affiche deux sections :
- les combats à venir (`upcoming`, lus depuis `fights`/`events`/`fighters` — voir `fetchFighterFightHistory` dans [data/lib/data.ts](../../../data/lib/data.ts)) ;
- l'historique complet (`history`, lu depuis `fighter_fight_history`, scrapé depuis Sherdog).

Dans les deux cas, le nom de l'adversaire est actuellement du texte brut, non cliquable. La colonne « Événement » de l'historique, elle, est déjà cliquable (lien interne `/events/{id}` si l'événement est connu, sinon lien externe vers Sherdog) depuis le commit `785630d` *fix(web): link fighter history to internal events, not just Sherdog*. Ce spec applique le même principe à la colonne « Adversaire ».

## Objectif

Chaque adversaire listé sur la fiche combattant (à venir et historique) doit être cliquable et renvoyer vers sa propre fiche combattant interne quand elle existe, avec un repli vers Sherdog sinon.

## Comportement attendu

### Combats à venir (`upcoming`)

La requête SQL de `fetchFighterFightHistory` joint déjà `fighters opponent` pour récupérer `opponent_name`/`opponent_image_url` — l'adversaire est donc toujours une ligne interne connue. Il suffit d'exposer `opponent.id` et de toujours lier vers `/fighters/{opponent_id}`.

### Historique (`history`, table `fighter_fight_history`)

Cette table ne connaît l'adversaire que par `opponent_name` (texte) et `opponent_sherdog_url` (déjà stockée en base — voir la colonne créée dans [data/scrapers/sync-fighter-history.ts](../../../data/scrapers/sync-fighter-history.ts) — mais non sélectionnée ni exploitée aujourd'hui).

Résolution de `opponent_id`, par ordre de priorité :
1. **Match par `opponent_sherdog_url` = `fighters.sherdog_url`** (sous-requête corrélée, `LIMIT 1`, même style que la résolution `event_id` déjà en place). Préféré à un rapprochement par nom, qui risquerait de confondre deux combattants homonymes.
2. Si aucun match interne mais `opponent_sherdog_url` est renseignée → lien externe vers Sherdog (nouvel onglet), même traitement que pour les événements non trackés.
3. Sinon (ni id ni URL Sherdog) → texte brut, comportement actuel inchangé.

## Changements

- **[data/lib/definitions.ts](../../../data/lib/definitions.ts)** — ajoute `opponent_id: number | null` à `FightHistoryEntry`, avec un commentaire sur sa provenance (jointure directe pour `upcoming`, résolution par `opponent_sherdog_url` pour `history`), sur le modèle du commentaire existant pour `event_id`.
- **[data/lib/data.ts](../../../data/lib/data.ts)** :
  - `upcoming` : sélectionne `opponent.id AS opponent_id` dans la jointure existante.
  - `history` : ajoute `opponent_sherdog_url` à la sélection (déjà en base) et une sous-requête `opponent_id` matchant `fhh.opponent_sherdog_url` contre `fighters.sherdog_url`.
  - Mappe ces deux nouveaux champs dans les `FightHistoryEntry` retournés.
- **[components/ui/fighters/fighter-history-list.tsx](../../../components/ui/fighters/fighter-history-list.tsx)** :
  - Ligne "à venir" : le nom de l'adversaire devient un lien interne vers `/fighters/{opponent_id}` (toujours défini pour cette section).
  - Colonne "Adversaire" de la table historique : même logique conditionnelle que la colonne "Événement" — `opponent_id` connu → `Link` interne ; sinon `opponent_sherdog_url` connue → `<a>` externe (`target="_blank"`, `rel="noreferrer"`) ; sinon texte brut.

## Hors scope

- Pas de migration DB (la colonne `opponent_sherdog_url` existe déjà dans `fighter_fight_history`).
- Pas de changement à l'app mobile (React Native) — ce spec ne couvre que le web (`app/`, `components/ui/fighters/fighter-history-list.tsx`).
- Pas de changement au rapprochement par nom déjà utilisé ailleurs (`resolveFighterIds`) — on introduit un rapprochement supplémentaire, distinct, limité à cette fonctionnalité.

## Vérification

- Requête manuelle contre la base live : un combat historique dont l'adversaire est un fighter tracké (même `sherdog_url`) résout bien un `opponent_id` non nul.
- Un combat historique dont l'adversaire n'est pas tracké résout `opponent_id: null` et conserve son `opponent_sherdog_url`.
- Rendu de la fiche combattant : vérifier visuellement (ou via `read_page`) que les noms d'adversaires sont bien des liens, internes ou externes selon le cas.

## Statut

Implémenté — voir `docs/superpowers/plans/2026-08-28-clickable-fighter-opponents.md`.
