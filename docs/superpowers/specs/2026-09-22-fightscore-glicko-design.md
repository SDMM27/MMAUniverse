# FightScore v2 : une note globale (Glicko) pour un classement juste par catégorie et P4P

Date : 2026-09-22. Approche **A** validée par l'utilisateur le 2026-09-22.
Remplace le moteur de classement de `2026-09-14-fighter-rating-algorithm-design.md` (flux de points par catégorie). Le flux de points reste en service **uniquement** comme entrée du modèle de probabilité de victoire (voir § 6).

## 1. Problème (constaté en base le 2026-09-21)

- N°1 P4P affiché : Sean Strickland. N°1 welterweight : Carlos Prates (6 combats notés), devant le champion Islam Makhachev (69.3, **1 seul combat noté** en WW ; ses 15 combats LW sont sur une ligne « inactive »).
- Le champion n'est pas n°1 de sa catégorie dans 5 catégories sur 11 (WW, LW, LHW, HW, Women's Strawweight).

## 2. Diagnostic chiffré (même holdout chronologique que le réglage : 1 468 combats depuis le 2023-03-11, référence log-loss 0.6767)

| Mesure | Résultat |
|---|---|
| Combats du holdout impliquant un combattant déjà passé par une autre catégorie | **49,9 %** |
| Flux de points par catégorie (prod) | log-loss 0.6767, précision 57,0 % |
| Même formule, simulation unique toutes catégories, report 0 / 50 / 70 / 100 % | 0.6799 / 0.6752 / **0.6746** / 0.6777 |
| … sur les seuls « changeurs de catégorie » (prod → report 70 %) | 0.6763 → **0.6689** |
| Glicko global (report complet, incertitude accrue au changement), réglage exploratoire | **0.6745** |
| Max / moyenne des points des actifs, selon la catégorie | de 1,3 à 5,6 : échelle non comparable |

Conclusions :

1. **Remise à zéro au changement de catégorie** : c'est le défaut principal, et il nuit **aussi** à la prédiction.
2. **Le flux de points récompense le volume.** Chaque victoire crée des points (crédit d'activité) : le système n'est pas à somme nulle. Même en simulation globale, le top P4P reste Strickland (23 combats), Prates, Chimaev… et Makhachev n'est que 9e. Réparer le point 1 ne suffit donc pas.
3. **Pas d'échelle commune** : chaque n°1 vaut 100, et les points bruts dépendent de l'activité de la catégorie.
4. **Pas de frein à l'incertitude** : 6 combats dominants contre des adversaires moyens suffisent pour être n°1.

Avec le Glicko exploratoire, sans aucun nom codé, le top P4P devient Makhachev, Gane, Aspinall, Chimaev, Du Plessis, Topuria, Volkanovski.

## 3. Décisions

1. **Une note par combattant, toutes catégories confondues : Glicko-1.** On la calcule en un seul passage chronologique sur tous les combats UFC. Elle est à somme quasi nulle : battre quelqu'un vaut ce que vaut cet adversaire, pas le nombre de combats.
2. **Changement de catégorie** : la note est reportée (part `carryOverShare`, réglée par la mesure ; décote vers la moyenne si elle est < 1). L'incertitude (RD) augmente de `rdOnDivisionChange`. On ne repart jamais de zéro.
3. **Dominance** : le score du vainqueur dans la mise à jour Glicko vaut `winScoreFloor + (1 − winScoreFloor) × dominance` (entre 0,5 et 1) ; celui du perdant en est le complément. Un finish écrasant rapporte plus qu'une décision partagée, dans la continuité de `computeDominanceScore`.
4. **Inactivité** : la note ne baisse pas, mais l'incertitude grandit (`rdPerMonth`), plafonnée à `initialRd`.
5. **Classement = note prudente** `R − 2 × RD` (« on est raisonnablement sûr qu'il vaut au moins ça »). Elle freine à la fois les nouveaux venus et les longues inactivités. Le coefficient 2 est fixé (convention Glicko), pas réglé.
6. **Paramètres réglés par log-loss** sur les combats d'avant 2023-03-11, puis jugés sur le holdout, avec le même `patternSearch` (rendu générique). Garde-fou : la log-loss du holdout ne doit pas dépasser 0.6767 + 0.002.
7. **Palmarès** (titres, défenses) : pas de bonus explicite en v2. Battre un adversaire bien noté (un champion, un top 5) rapporte déjà beaucoup par construction. L'approche C (bonus borné) n'est ajoutée **que si** le jeu de contrôles échoue, et fera l'objet d'une validation à part.
8. **Aucun nom dans la méthode.** Les noms n'apparaissent que dans le script de contrôle, comme attentes d'experts rapportées, jamais utilisées pour régler.

## 4. Affichage : contrat conservé

`fighter_ratings` garde une ligne par (combattant, catégorie) et les mêmes colonnes lues par l'interface :

| Colonne | v2 |
|---|---|
| `points` | note Glicko R (ex. 2102). La même sur toutes les lignes d'un combattant. |
| `rating_deviation` *(nouvelle)* | RD à la date du jour |
| `display_score` | score 0-100 **dans la catégorie** (voir ci-dessous) |
| `p4p_score` *(nouvelle)* | score 0-100 sur l'échelle commune (hommes et femmes séparés) |
| `is_ranking_eligible` | règle actuelle (actif depuis ≤ 18 mois **dans cette catégorie**, ou champion) **et** catégorie la plus récente du combattant ou champion de celle-ci. Évite qu'un combattant qui vient de monter apparaisse dans deux listes avec la même note. |
| `current_streak`, `is_former_champion`, `fights_rated`, `last_fight_date`, `style_archetype`, `ml_win_probability` | inchangés (par catégorie) |

**Score 0-100** : `score = 200 × P(battre la référence)`, avec `P = 1 / (1 + 10^((R_réf − R_prudente) / 400))`, calculé sur les notes prudentes. La référence est le meilleur éligible de la liste : il vaut 100, un combattant 200 points de Glicko en dessous vaut environ 48. Lecture : « deux fois sa chance de battre le n°1 ».

**Règle du champion (demande utilisateur : « le champion est forcément n°1 à 100 »)** : dans sa catégorie, le champion reçoit `display_score = 100`. Tous les autres sont plafonnés à 99,9 et gardent l'ordre de leur note. C'est une règle d'affichage éditoriale fondée sur `is_champion` (donnée officielle), pas sur un nom. Conséquence : l'astérisque « champion devancé » (`orderDivisionWithChampionPinned`) ne se déclenche plus. Le code reste en place, sans changement d'UI.

**P4P** : `p4p_score` n'applique **pas** la règle du champion (sinon chaque champion vaudrait 100). `fetchTopPoundForPound` trie par `p4p_score` et le renvoie sous le nom `display_score`, donc l'UI ne change pas. Il prend une ligne par combattant (de préférence celle où il est champion).

## 5. Jeu de contrôles de bon sens

C'est un script de validation (`npm run check:ratings`) qui s'appuie sur des fonctions pures testées dans `data/lib/rating/sanity-checks.ts`. Il rapporte chaque contrôle en OK/ÉCHEC, sans rien corriger.

Contrôles génériques (sans nom), calculés sur la note prudente, **avant** la règle du champion :

1. **Report** : aucun combattant ayant déjà combattu à l'UFC n'aborde un combat dans une nouvelle catégorie à la note initiale.
2. **Petit effectif** : aucun n°1 de catégorie avec ≤ 6 combats UFC et aucune victoire contre un adversaire du top 10 de la note au moment du combat.
3. **Champions qui défendent** : un champion en place avec ≥ 1 défense réussie est dans le top 3 de sa catégorie.
4. **N°1 P4P** : il a gagné au moins un combat de titre.

Attentes d'experts (nommées, **rapportées seulement**) : Makhachev dans le top 3 P4P hommes ; les champions à plusieurs défenses dans le top 10 P4P.

## 6. Probabilité de victoire (`ml_win_probability`)

Le modèle entraîné (`data/ml-models/win-predictor.json`) utilise les points du flux de points parmi ses variables. Pour ne pas l'invalider, `compute-fighter-ratings.ts` continue de lancer `simulateDivisionRatings` par catégorie **uniquement** pour alimenter le modèle (et `current_streak` / `is_former_champion` / `fights_rated` par catégorie). Réentraîner le modèle sur la note Glicko est hors périmètre et sera un chantier ultérieur éventuel.

## 7. Page méthodologie

`app/classement-calcule/methodologie/page.tsx` : on réécrit les sections sur le moteur (note globale, report entre catégories, dominance, incertitude, note prudente, score 0-100, règle du champion, P4P), en français, dans la même mise en page. On garde les sections sur la dominance, les styles et la probabilité de victoire.

## 8. Hors périmètre

Données hors UFC (Sherdog) pour une note de départ ; bonus palmarès (approche C, conditionnel) ; réentraînement du win predictor ; changement d'UI.
