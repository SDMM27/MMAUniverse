# FightScore v2 (note globale Glicko) : plan d'implémentation

**Spec :** `docs/superpowers/specs/2026-09-22-fightscore-glicko-design.md`

**Objectif :** remplacer le flux de points par catégorie par une note Glicko-1 globale pour le classement (par catégorie et P4P), sans toucher l'UI, en gardant la log-loss du holdout ≤ 0.6787 et en passant le jeu de contrôles.

**Règles :** TDD sur `data/lib/rating/` ; les scripts sont de l'orchestration I/O vérifiée à la main. **Aucun `npm run compute:ratings` avant validation des tops en simulation par l'utilisateur.** Commits uniquement à la demande.

---

### Tâche 1 : moteur Glicko pur (`data/lib/rating/glicko-rating.ts` + test)
- [ ] `GlickoParams` (`initialRating`, `initialRd`, `rdPerMonth`, `rdOnDivisionChange`, `carryOverShare`, `winScoreFloor`, `minRd`), `DEFAULT_GLICKO_PARAMS`
- [ ] `rdAfterInactivity(rd, months, params)` : √(rd² + c²·mois), plafonné à `initialRd`
- [ ] `applyDivisionChange(state, params)` : décote vers `initialRating` + RD accrue
- [ ] `winnerOutcomeScore(dominance, params)` ∈ [0,5 ; 1]
- [ ] `updateGlicko(a, b, scoreA)` : mise à jour Glicko-1 standard d'un combattant
- [ ] `conservativeRating(r, rd)` = r − 2·rd ; `scoreAgainstReference(r, ref)` = 200·E, plafonné à 100
- [ ] Tests : symétrie, un favori qui gagne gagne peu, un outsider qui gagne gagne beaucoup, RD qui baisse après un combat et monte avec l'inactivité, report complet quand `carryOverShare` = 1

### Tâche 2 : simulation de carrière (`data/lib/rating/simulate-career.ts` + test)
- [ ] Entrée : combats de toutes les catégories (`CareerFightInput` = `DivisionFightInput` + `division`), triés, et les no contests / nuls avec leur catégorie
- [ ] Un passage chronologique unique ; changement de catégorie détecté par rapport à la catégorie du combat précédent
- [ ] Sortie : états par combattant (`rating`, `rd`, `lastFightDate`, `lastDivision`, `ufcFights`) et historique par combat (notes/RD avant et après, catégorie, titre)
- [ ] `ratingAsOf(state, date)` : RD gonflée jusqu'à la date du jour
- [ ] Tests : report entre catégories (pas de retour à la note initiale), un nul/NC remet l'horloge d'inactivité à zéro, ordre chronologique respecté

### Tâche 3 : réglage générique
- [ ] `patternSearch` générique sur `Record<string, number>` (les tests existants restent verts)
- [ ] `collectCareerRatingDiffs(fights, noResults, params, testFromDate)` → train/test de (R_vainqueur − R_perdant), évalués avec `fitScale` / `evaluateLogRatios` + test
- [ ] Script `data/scripts/tune-glicko.ts` (`npm run tune:glicko`) : réglage sur le train, rapport sur le holdout (et sur le sous-ensemble des changeurs de catégorie), comparaison avec le flux de points ; écrit `data/ml-models/glicko-params.json` ; les valeurs retenues sont recopiées à la main dans `DEFAULT_GLICKO_PARAMS`

### Tâche 4 : scores d'affichage (`data/lib/rating/display-scores.ts` + test)
- [ ] `isEligibleInDivision({ lastFightDateInDivision, isChampion, isLatestDivision }, today)`
- [ ] `divisionDisplayScores(rows)` : référence = meilleure note prudente éligible ; champion = 100 ; autres ≤ 99,9
- [ ] `poundForPoundScores(rows)` : échelle commune, sans règle du champion
- [ ] Tests : champion devancé → quand même 100, challengers à 99,9 au plus, ordre conservé ; P4P : le meilleur vaut 100, un champion faible n'y est pas à 100

### Tâche 5 : jeu de contrôles (`data/lib/rating/sanity-checks.ts` + test, `data/scripts/check-ratings.ts`, `npm run check:ratings`)
- [ ] Les 4 contrôles génériques de la spec § 5, sous forme de fonctions pures sur l'historique de simulation et les états
- [ ] Attentes d'experts nommées, dans le script seulement, rapportées sans être appliquées
- [ ] Le script (lecture seule sur Neon : combats + champions) affiche le top 10 P4P hommes et femmes, le top 5 par catégorie, la log-loss du holdout et les contrôles

**➡ Point d'arrêt : montrer les résultats à l'utilisateur et attendre sa validation.**

### Tâche 6 : intégration à `compute-fighter-ratings.ts`
- [ ] Colonnes `rating_deviation`, `p4p_score` (`ALTER TABLE … ADD COLUMN IF NOT EXISTS`) + type `FighterRating`
- [ ] `points` = R, `display_score` / `p4p_score` / `is_ranking_eligible` issus de la tâche 4 ; historique = notes avant/après
- [ ] `simulateDivisionRatings` conservé pour `ml_win_probability`, la série, l'ancien champion et le nombre de combats par catégorie

### Tâche 7 : requêtes
- [ ] `fetchTopPoundForPound` : tri par `p4p_score`, renvoyé comme `display_score` ; une ligne par combattant (celle de champion en priorité)
- [ ] `app/page.tsx` : le tri local suit le même ordre

### Tâche 8 : page méthodologie
- [ ] Réécriture des sections sur le moteur (spec § 7), en français, même mise en page

### Tâche 9 : mise en production (après validation)
- [ ] `npm test`, `npm run build`, puis `npm run compute:ratings`, puis vérification dans le navigateur (`/`, `/classement-calcule`, fiche combattant)
