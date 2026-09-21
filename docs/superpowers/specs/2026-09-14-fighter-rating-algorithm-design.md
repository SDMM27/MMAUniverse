# Classement calculé (FightScore) — Design

Date : 2026-09-14

## Contexte

Le 2026-09-08, le projet avait déjà pivoté loin de « agréger toute la data MMA » (concurrence frontale avec octagonhub abandonnée, voir [[project-abandoned]]) vers « construire un système propriétaire de notation/classement des combattants » comme différenciateur (voir [[fighter-rating-ml-pivot]]). Ce chantier-ci concrétise cette direction : le classement **calculé** (pas le classement officiel des organisations) devient **le cœur du site**, à l'image de fight-minds.com (https://www.fight-minds.com/) — un score continu par division, pas un simple réordonnancement du Top 15 officiel.

Toutes les fonctionnalités existantes (events, fighters, actualités, pick'em, organisations, profils) sont conservées telles quelles ; ce chantier ajoute le classement calculé et **réorganise la hiérarchie du site autour de lui** (nav, accueil), sans les retirer.

## Décisions actées (session du 2026-09-14)

1. **Portée v1 : UFC uniquement.** Seule organisation avec des statistiques de combat détaillées (`fighter_fight_stats`, via UFCStats.com — voir [[fighter-rating-ml-pivot]]). Les autres organisations (PFL, Bellator, ONE, etc.) n'ont que le résultat brut (W/L/method/round) via `fighter_fight_history` — pas assez pour un vrai score de dominance/style. Extension multi-org explicitement hors périmètre v1.
2. **Le classement calculé devient LE classement principal du site** — mis en avant sur l'accueil et dans la nav. Le classement officiel UFC (déjà scrapé, `rankings` table, pages `/rankings`/`/classement`) reste consultable mais passe en second plan / à titre de comparaison.
3. **Plan avant code** — ce document + le plan d'implémentation associé sont rédigés et validés avant toute ligne de code, conformément au workflow déjà utilisé sur ce projet (`docs/superpowers/plans` + `specs`).

## État des lieux — données disponibles

- `fighters` (id, name, weight_class *(texte libre Sherdog, pas fiable pour grouper par division — voir plus bas)*, organization_id, record, ranking, nationality)
- `fighter_fight_history` : historique complet W/L/method/round/time, toutes organisations confondues, source Sherdog — voir [[fighter-history-backfill]]
- `fighter_fight_stats` (nouveau, branche `feat/ufcstats-fight-stats`) : une ligne par (combattant, combat), **UFC uniquement**, source UFCStats.com — frappes significatives/totales landed/attempted, takedowns landed/attempted, temps de contrôle, tentatives de soumission, reversals, knockdowns, et la ventilation des frappes par cible (tête/corps/jambe) et par position (distance/clinch/sol). 17 744 lignes déjà scrapées et committées dans `data/scraped/ufcstats-fight-stats.json` (787 events UFC complets au 2026-09-08). **À vérifier avant de démarrer l'implémentation : `sync:fighter-stats` a-t-il déjà été exécuté contre Neon ?** Si non, c'est un prérequis du Task 1 du plan (script déjà écrit, juste à lancer).
- `rankings` : classement **officiel** UFC (rank 0 = champion, 1-15 = contenders), `weight_class` = libellé verbatim ufc.com (ex. "Flyweight", "Women's Strawweight", "Pound-for-Pound"). C'est la **seule** source fiable de division normalisée dans la base aujourd'hui — voir plus bas.

### Problème à résoudre : normalisation des divisions

`fighters.weight_class` est du texte libre Sherdog (commentaire dans `data/lib/definitions.ts`), pas fiable pour grouper (ne distingue pas toujours les divisions féminines, orthographe non garantie identique à celle d'UFCStats). `fighter_fight_stats` n'a pas sa propre colonne `weight_class` aujourd'hui — seulement `fighters.weight_class`. Deux options :
- (a) ajouter `weight_class` à `fighter_fight_stats` en le récupérant depuis la page UFCStats de l'event (déjà scrapée) — nécessite de retoucher `parse-ufcstats.ts`/`scrape-ufcstats.ts`
- (b) dériver la division du combattant à partir de son combat le plus récent dans `fighter_fight_history` (qui a `weight_class` par combat, verbatim Sherdog) et normaliser vers les libellés `rankings.weight_class` (même famille de problème que `ranking-name-match.ts` a déjà résolu pour les **noms** de combattants — même logique à appliquer aux **divisions**).

**Décision : option (a).** Plus robuste (une division par combat réel, pas une heuristique "dernier combat connu" qui peut se tromper en cas de changement de catégorie), et le scraper UFCStats a déjà la donnée sous les yeux au moment du parsing (chaque `fight-details` UFCStats affiche la weight class du combat). Coût : un backfill à relancer (`npm run scrape:ufcstats` a un cache de checkpoint par event déjà "processed" — il faudra soit invalider le cache pour forcer une re-passe, soit écrire un script de complément ciblé). Détaillé dans le plan d'implémentation, Task 1.

## Architecture de l'algorithme — FightScore v1

Nom de travail : **FightScore**. Principe général : un moteur de notation **à flux de points** par division (voir section 0 — inspiré de l'algorithme réel de fight-minds, partagé par l'utilisateur), où le gain/la perte après chaque combat est modulé par un **score de dominance** calculé à partir des stats détaillées du combat (pas seulement win/loss) — c'est ce qui permet de distinguer un finish dominant d'une décision serrée, et de faire émerger un score continu façon fight-minds plutôt qu'un simple ordre.

### 0. Référence : l'algorithme fight-minds

**Ajouté 2026-09-14** — l'utilisateur a partagé la description publique de l'algorithme fight-minds (points de départ `0.01`, érosion mensuelle, gain = combinaison d'un vol de 50% des points de l'adversaire + crédit d'activité + bonus méthode/titre/streak/5-rounds/former-champion, perte = pénalité liée à la moyenne de catégorie, plus une règle de plancher garantissant qu'on ne peut jamais finir classé sous quelqu'un qu'on a battu). Ce texte contient par endroits des incohérences internes (la liste générale dit "perte = 10% de la moyenne de catégorie", l'exemple chiffré utilise 20% × un facteur "méthode de la défaite" non détaillé) — normal pour un explicatif public d'un algorithme propriétaire, probablement volontairement incomplet. On le traite comme **source d'inspiration structurelle forte, pas comme une spec à recopier telle quelle** :

**Repris tel quel (la mécanique elle-même, pas les constantes)** :
- Système additif à **flux de points** (pas un Elo relatif) : chaque combattant a un total de points qui évolue par gains/pertes absolus, pas par un ajustement basé sur une probabilité de victoire attendue.
- **Le vainqueur récupère une part des points de l'adversaire battu** (50% chez fight-minds) — c'est la réponse directe et explicite au retour utilisateur précédent ("il faut donner de l'importance à l'adversaire battu, s'il est bien classé") : battre quelqu'un avec beaucoup de points en rapporte mécaniquement beaucoup, plus lisible et plus fort que l'effet implicite d'un Elo classique.
- **Règle de plancher** : si le gain ne suffit pas à dépasser les points de l'adversaire battu, le vainqueur est remonté à `points_adversaire + 0.01` — garantit qu'on ne peut jamais être classé sous quelqu'un qu'on a légitimement battu (tant que ce dernier n'a pas depuis progressé davantage). Repris tel quel, c'est une propriété de cohérence forte et facile à défendre.
- **Érosion temporelle** des points selon l'inactivité, **crédit d'activité** à chaque victoire basé sur la moyenne de la catégorie (encourage à combattre plutôt qu'à rester inactif avec un score gelé), **bonus de titre**, **multiplicateur de streak**.

**Adapté (mécanique reprise, constantes/détail remplacés par nos propres travaux déjà actés)** :
- La table de coefficients par méthode de fight-minds (KO/TKO `1.2`, décision unanime `1.5`, décision partagée `1.1`) est **remplacée par notre `computeDominanceScore` round-by-round** (section 1 ci-dessous) — plus fin (round par round, pas juste la méthode) et cohérent avec ce qu'on a déjà tranché avec l'utilisateur (un round-1 KO et une décision où le vainqueur remporte tous les rounds doivent être comparables ; un finish reste au-dessus d'une décision équivalente en dominance). On ne reprend donc **pas** le fait que fight-minds note une décision unanime plus haut qu'un KO/TKO (`1.5` > `1.2`) — ça contredirait directement ce qu'on a validé.
- Bonus "ancien champion" (`1.5×`) : repris, mais dérivé de nos propres données (`fights.is_title_fight` + `winner_id` déjà scrapés pour l'UFC — un combattant ayant remporté un combat de titre UFC dans cette division devient `isFormerChampion` pour cette division, sans scraping supplémentaire) plutôt que d'une source externe.

**Délibérément non repris en v1 (donnée manquante, pas dans le périmètre de ce chantier)** :
- **Bonus "Performance of the Night" / "Fight of the Night"** : nécessite une source qui n'est pas scrapée aujourd'hui (ufc.com ou Wikipédia listent les bonus par event, pas UFCStats à notre connaissance) — v1 fixe ce multiplicateur à `1.0` pour tout le monde, noté comme simplification connue (voir Hors périmètre).
- **Pénalité "missed weight"** : même problème, donnée absente de nos sources actuelles — `1.0` partout en v1.
- **Format 5 rounds** : *repris quand même*, contrairement aux deux ci-dessus — UFCStats affiche le format du combat ("Time format: 5 Rnd...") sur la même page déjà fetchée pour le round-by-round (Task 1), donc capturable sans coût de scraping supplémentaire.

### 1. Score de dominance par combat (`computeDominanceScore`)

**Révisé 2026-09-14** (avant tout début de code — voir échange avec l'utilisateur) : la première version ci-dessous donnait un poids fixe et bas (0.4) à toute décision, peu importe son écart réel — ça sous-note un combattant qui remporte chaque round de façon écrasante (ex. Khabib Nurmagomedov, qui gagne l'essentiel de ses combats à la décision en dominant intégralement chaque round). La dominance doit être mesurée **round par round**, pas seulement au niveau du combat entier, pour qu'un balayage total (3/3 ou 5/5 rounds) score aussi haut qu'un finish, et qu'une décision serrée score bas — peu importe que le combat se soit terminé par KO, soumission ou décision.

**Prérequis data — changement de décision sur le scraper UFCStats** : `parse-ufcstats.ts` ignore aujourd'hui volontairement le tableau round-by-round d'UFCStats (commentaire "fight-level totals are enough for a rating model" — ce commentaire datait d'avant ce chantier et ne tient plus). UFCStats expose bien un round-by-round complet (knockdowns, frappes sig./totales, takedowns, tentatives de soumission, reversals, temps de contrôle — mêmes colonnes que le tableau de totaux, mais par round) sur la même page déjà fetchée. Comme le Task 1 du plan force de toute façon un re-scrape complet pour capturer `weight_class`, capturer le round-by-round dans la même passe ne coûte aucune requête réseau supplémentaire, seulement du parsing en plus — décision actée : on le fait dans le même chantier, pas en v2.

**Re-révisé 2026-09-14 (même session)** : le premier passage ci-dessus avait fait tomber le poids de la méthode à 0.15 pour laisser la part belle au round-by-round — mais la méthode compte pour de vraies raisons, pas seulement comme un signal parmi d'autres : un combattant qui finit systématiquement ses adversaires **retire toute chance à l'adversaire de rester dans le combat**, ce qui est une forme de dominance à part entière, indépendante de savoir si les rounds précédents étaient déjà acquis. Le poids de la méthode remonte à 0.30 (repassant devant le différentiel de frappes, mais toujours derrière `roundsWonShare` qui reste le terme le plus lourd — les deux objectifs, valoriser les finisseurs ET valoriser les décisions ultra-dominantes façon Khabib, coexistent sans que l'un écrase l'autre).

Fonction pure, calculée pour le **vainqueur** d'un combat terminé (win/loss uniquement — draw/NC ignorés, même convention que `scoring.ts`/`fighter-stats.ts` existants), à partir des lignes round-by-round pairées (les deux combattants, round par round, jusqu'au round où le combat s'est arrêté) :

```
dominanceScore ∈ [0, 1] = bonus_finish           × 0.30
                         + roundsWonShare         × 0.35
                         + différentiel_frappes   × 0.20
                         + différentiel_grappling  × 0.15
```

- **bonus_finish** : 1.0 si KO/TKO, 0.9 si soumission, **0 si décision**. Plus petit terme isolé comme avant la présente révision — c'est maintenant le deuxième poids le plus lourd de la formule, un finisseur récurrent doit clairement se détacher d'un décisionneur récurrent à dominance égale par ailleurs.
- **roundsWonShare** : part des rounds effectivement disputés que le vainqueur a "gagnés". Pour chaque round disputé, un round est attribué au combattant avec le `roundScore` le plus élevé : `roundScore = sig_strikes_landed_round + 0.5 × (control_time_seconds_round / 60) + 5 × knockdowns_round` (poids provisoires — voir calibration ci-dessous) ; égalité à ±5% → round partagé (0.5/0.5). **Le round où le combat se termine (KO/TKO/soumission) est automatiquement attribué au vainqueur**, sans passer par ce calcul — il vient de finir le combat dans ce round, point. `roundsWonShare = roundsGagnés / roundsDisputés`. Conséquence directe et recherchée : un KO round 1 a `roundsWonShare = 1/1 = 1.0` (trivial) — combiné au `bonus_finish` plein, un round-1 KO propre atteint un score proche du maximum. Une décision où le vainqueur remporte les 3 (ou 5) rounds a aussi `roundsWonShare = 1.0`, ce qui règle le cas Khabib (score nettement au-dessus d'une décision ordinaire) — **sans nécessairement égaler un finish équivalent**, puisque `bonus_finish` reste à 0 pour toute décision. C'est un choix assumé : à dominance round-par-round égale, finir le combat rapporte davantage que le laisser aux juges. Une décision 2 rounds sur 3 donne `roundsWonShare = 0.67` (dominance modérée), une décision perçue comme contestée peut tomber bien en dessous si le différentiel round par round est réellement serré.
- **différentiel_frappes** : identique à avant, agrégé sur l'ensemble du combat — `(sig_strikes_landed_winner − sig_strikes_landed_loser) / (somme)`, ramené sur [0, 1]
- **différentiel_grappling** : identique à avant, part du temps de contrôle total détenue par le vainqueur, 0.5 si aucun contrôle enregistré des deux côtés

Exemple chiffré (ordres de grandeur, à confirmer en calibration) : un round-1 KO propre → `1.0×0.30 + 1.0×0.35 + ~0.9×0.20 + ~0.7×0.15 ≈ 0.94`. Une décision où le vainqueur remporte les 3 rounds avec un net avantage stats (Khabib-like) → `0×0.30 + 1.0×0.35 + ~0.85×0.20 + ~0.9×0.15 ≈ 0.655`. Une décision serrée/contestée → `0×0.30 + ~0.33×0.35 + ~0.55×0.20 + ~0.5×0.15 ≈ 0.30`. L'écart entre le finish (≈0.94) et la décision ultra-dominante (≈0.66) reste net (méthode valorisée), mais l'écart entre la décision ultra-dominante (≈0.66) et la décision serrée (≈0.30) est au moins aussi net (le fix Khabib tient toujours) — ces trois chiffres sont indicatifs, la calibration (Task 6 du plan) les affine contre les vraies données plutôt que de les figer ici.

Fallback (round-by-round indisponible pour ce combat — combat antérieur au backfill round-by-round, ou anomalie de matching) : dominance = `bonus_finish` seul (1.0 KO/TKO, 0.9 soumission) ou 0.4 flat (décision, ancien comportement pré-révision) avec `estimated: true` stocké en base pour traçabilité — dégradé gracieusement, pas bloquant, mais moins précis, donc à suivre (proportion de combats en fallback dans le résumé du Task 7 du plan).

**"roundsWonShare" est une estimation, pas les cartes officielles des juges** — UFCStats ne publie pas les scores des juges, seulement des stats brutes. Le formuler ainsi (comme fait déjà par plusieurs sites d'analytics MMA) doit être écrit noir sur blanc dans la page méthodologie destinée aux lecteurs, pas seulement dans ce doc.

**Ces poids et le formule de `roundScore` sont un point de départ, pas une vérité gravée.** Le plan d'implémentation prévoit une étape de calibration empirique contre le dataset réel (Task 6) avant tout déploiement en production — distribution des scores obtenue, comparaison qualitative avec des cas connus, **explicitement y compris un cas comme Khabib (dominance de tous les rounds par décision) qui doit ressortir avec un score proche d'un finish, pas d'une décision quelconque**.

### 2. Moteur de notation — flux de points inspiré de fight-minds

Par division (voir normalisation ci-dessus), chaque combattant a un total de **points** initialisé à `BASE_POINTS = 0.01` (repris tel quel de fight-minds — juste un ordre de grandeur de départ, sans signification en soi). Pour chaque combat terminé (traité **chronologiquement**, du plus ancien au plus récent) :

**Étape 1 — érosion temporelle**, appliquée aux points des deux combattants avant tout calcul de gain/perte, basée sur le nombre de mois écoulés depuis leur dernier combat noté dans cette division :

```
erosion(points, moisInactivité) = points si moisInactivité ≤ 12
                                  sinon max(points × 0.98^(moisInactivité − 12), points × 0.4)
```

(pas d'érosion la première année d'inactivité, puis ~2%/mois au-delà, plancher à 40% des points jamais totalement effacé — un ancien grand champion inactif redescend mais ne disparaît pas du classement du jour au lendemain). Constantes provisoires, à calibrer (Task 6).

**Étape 2 — gain du vainqueur (W bat L)** :

**Calibré 2026-09-14 contre les vraies données (Task 6)** : les valeurs 0.5/0.5 ci-dessous, reprises telles quelles du texte fight-minds, produisaient une croissance exponentielle incontrôlée — les deux termes dépendent de valeurs qui grossissent elles-mêmes à chaque combat (les points de l'adversaire, la moyenne de division), donc ça compose à chaque combat. Résultat mesuré sur les 787 events réels : des maxima de division allant jusqu'à **~13 000** après quelques centaines de combats, sans rapport avec l'échelle réelle de fight-minds (leurs scores publiés vont de `0.01` à environ `250`). Réduits à `0.15`/`0.10` (voir `data/lib/rating/point-flow.ts`), le maximum toutes divisions confondues retombe à **~3.8**, une échelle plausible — et les classements qui en sortent ont l'air réels (ex. Featherweight : Topuria, Volkanovski, Holloway, Lopes, Sterling — le vrai top actuel ; Middleweight : Strickland/Du Plessis/Chimaev quasi à égalité, cohérent avec une division très disputée en ce moment). Le script de calibration (`data/scripts/calibrate-ratings.ts`, `npm run calibrate:ratings`) reste disponible pour re-calibrer après d'autres changements de formule.

```
opponentShare      = 0.15 × L.points_après_érosion                         // vol de 15% des points de l'adversaire — réduit de 0.5 après calibration, voir ci-dessus
categoryAvgTerm     = 0.10 × moyenneDivision                                 // crédit d'activité — réduit de 0.5 après calibration, voir ci-dessus
dominanceMultiplier = 0.8 + 0.9 × dominanceScore                             // remplace la table de coefficients méthode de fight-minds — voir section 1
streakMultiplier    = 1 + 0.005 × min(winStreakDeW, CAP)                     // repris de fight-minds
titleMultiplier     = is_title_fight ? 1.5 : 1.0                             // repris de fight-minds (fights.is_title_fight déjà scrapé)
fiveRoundMultiplier = combat_prévu_5_rounds ? 1.10 : 1.0                     // repris de fight-minds (capturable via Task 1, voir section 0)
formerChampMultiplier = W.déjà_champion_de_cette_division ? 1.5 : 1.0        // repris de fight-minds, dérivé de fights.is_title_fight (voir section 0)
performanceBonusMultiplier = 1.0                                             // POTN/FOTN non repris en v1 (donnée absente) — voir section 0
missedWeightPenalty = 1.0                                                    // non repris en v1 (donnée absente) — voir section 0

gain = (opponentShare × dominanceMultiplier + categoryAvgTerm)
       × streakMultiplier × titleMultiplier × fiveRoundMultiplier
       × formerChampMultiplier × performanceBonusMultiplier × missedWeightPenalty

W.points_après = W.points_après_érosion + gain

// Règle de plancher, reprise telle quelle de fight-minds :
si W.points_après ≤ L.points_après_érosion :
    W.points_après = L.points_après_érosion + 0.01
```

**Étape 3 — perte du vaincu (L)** :

```
lossBase             = 0.10 × moyenneDivision                                // constante de départ — voir note ci-dessous sur l'incohérence 10%/20% du texte fight-minds
lossDominanceFactor  = 0.6 + 0.8 × dominanceScore                             // notre propre ajout : être dominé plus fort côte perdant aussi, symétrique du gain du vainqueur — pas dans le texte fight-minds tel que partagé, mais cohérent avec le reste de la formule
lossStreakMultiplier = 1 + 0.005 × min(lossStreakDeL, CAP)                    // repris de fight-minds
titleLossDivisor     = is_title_fight ? 1.3 : 1.0                             // repris de fight-minds — perdre un combat de titre coûte MOINS cher (÷, pas ×)
missedWeightPenalty  = 1.0                                                    // non repris en v1 — voir section 0

perte = (lossBase × lossDominanceFactor × lossStreakMultiplier / titleLossDivisor) × missedWeightPenalty

L.points_après = max(L.points_après_érosion − perte, PLANCHER_MIN)            // ex. 0.001, jamais négatif/nul
```

`moyenneDivision` : moyenne des points de tous les combattants notés de la division, recalculée au fil du traitement chronologique (état qui évolue au fur et à mesure, pas une constante figée) — tenue à jour en mémoire par le script batch (Task 7 du plan).

**Note sur les 10%/20%** : le texte fight-minds partagé donne deux valeurs différentes pour la pénalité de défaite selon qu'on lit la liste générale (10%) ou l'exemple chiffré (20%, apparemment multiplié par un "facteur méthode de la défaite" non détaillé dans le texte). On part de 10% comme constante de départ plutôt que de deviner le facteur manquant — à ajuster en calibration (Task 6) si la distribution résultante semble trop indulgente envers les perdants.

Pourquoi ce système répond mieux que l'Elo classique à « il faut donner de l'importance à l'adversaire battu » : le gain est **directement proportionnel aux points de l'adversaire** (`opponentShare`), pas seulement à un delta de probabilité — battre le combattant #1 de la division avec 2.0 points (échelle réelle observée après calibration) rapporte mécaniquement `0.15 × 2.0 = 0.30` de base avant tout autre bonus, un signal beaucoup plus lisible et plus fort qu'un ajustement Elo implicite. La règle de plancher renforce encore ce principe : on ne peut jamais rester classé sous quelqu'un qu'on a battu.

### 3. Score affiché (0-100)

Les points bruts (petits nombres, ex. `0.01`-`0.4` dans l'exemple fight-minds) ne sont pas montrés tels quels. Rescale par division :

```
display_score = clamp(100 × (points_bruts − floor) / (ceiling − floor), 0, 100)
```

où `floor`/`ceiling` sont calibrés **par division**, pas globalement — un floor/ceiling unique pour tout le site écraserait les divisions à l'historique plus court (ex. Women's Featherweight, 25 combats traités, max brut ~0.04) au profit des divisions à l'historique long (ex. Middleweight, 421 combats, max brut ~3.78), ce qui n'aurait aucun rapport avec la qualité réelle des combattants — juste avec le nombre de combats déjà traités par le moteur à flux de points.

**Calibré 2026-09-14 (Task 6)**, à partir de la distribution réelle par division (`npm run calibrate:ratings`, après la réduction d'`opponentShare`/`categoryAvgTerm` ci-dessus) : `floor = 0`, `ceiling = points_bruts maximum observé dans la division` (pas de percentile, le combattant le plus haut de la division devient exactement 100). Conséquence de la forme très asymétrique de la distribution des points bruts (beaucoup de combattants proches de la base, une poignée qui se détache nettement) : le combattant médian d'une division retombe autour de 1-2 sur 100, la tranche p75-p90 autour de 5-15, et seule la queue haute (top ~10-15%) s'étale vraiment jusqu'à 100 — une allure proche de ce qu'affiche fight-minds (le gros du peloton en simple chiffre, la tête de division qui se détache), sans reproduire exactement leur courbe (indisponible, propriétaire). Un rescale par rang/percentile plutôt que linéaire sur les points bruts donnerait une tranche 1-15 plus graduée (plus proche visuellement de fight-minds, où le rang 10-15 reste souvent à 20-40 plutôt que single-digit) — noté comme amélioration possible du Task 7/9, pas bloquant pour lancer une v1.

**Position du champion — révisé 2026-09-14** : contrairement à la première version de ce doc (qui laissait le champion à sa position naturelle dans le tri par score, potentiellement pas 1er), décision actée : **le champion est toujours affiché en position 1 de sa division**, quel que soit son score calculé — c'est un choix éditorial assumé (la ceinture est un fait sportif, pas juste une opinion algorithmique), pas un artefact de calcul. Le champion vient de `rankings.rank = 0` pour cette division (classement officiel UFC déjà scrapé), toujours indépendant du calcul FightScore lui-même — seule la règle d'**affichage** change.

Une **astérisque** est ajoutée à côté du nom du champion quand son `display_score` n'est en réalité **pas** le plus élevé de la division parmi les combattants notés (`champion.display_score < max(display_score des autres combattants notés de la division)`) — calculée à l'affichage, pas stockée (simple comparaison sur des lignes déjà chargées). L'astérisque renvoie vers un texte court du type *"Porte la ceinture, mais [Nom] a le FightScore le plus élevé de la division en ce moment — voir la méthodologie."* Sans astérisque, le champion est aussi 1er au score, pas seulement au titre — les deux signaux concordent, rien à expliquer. Le reste de la division (hors champion) reste trié par `display_score` décroissant, à partir de la position 2.

Cas où le champion n'a pas encore de `fighter_ratings` row calculée (ex. tout juste transféré à l'UFC, aucun combat couvert) : pas d'astérisque possible (rien à comparer) — afficher le champion en position 1 avec le score marqué "en cours de calcul" plutôt qu'un astérisque qui impliquerait à tort qu'on sait qu'il est dépassé.

### 4. Pound-for-Pound

Liste cross-division = simplement les meilleurs `display_score` bruts tous poids confondus (sans renormalisation supplémentaire) — reconnu comme une simplification (ignore la difficulté propre à chaque division) mais c'est l'approche standard des sites qui publient un P4P, y compris apparemment fight-minds au vu du format observé.

### 5. Profils de style (« styles de combattant ») — clustering ML

Pour répondre spécifiquement à « les styles de combattant » demandé, en plus du score : un **profil de style** par combattant, dérivé de ses stats agrégées `fighter_fight_stats` (normalisées par 15 minutes de temps de cage pour comparer des combattants avec des historiques de durée différente) :
- taux de frappes significatives tentées/15min, par cible (tête/corps/jambe) et par position (distance/clinch/sol)
- taux de takedowns tentés/15min, taux de réussite
- temps de contrôle moyen/combat
- tentatives de soumission/15min

Ces vecteurs de features (normalisés en z-score par division) sont regroupés par **k-means** (implémentation main, pas de dépendance ML lourde nécessaire — dataset largement assez petit) en un nombre fixe d'archétypes par division (ex. k=4 : « frappeur de distance », « pressure fighter », « wrestler/contrôleur », « finisseur soumission »), avec un label lisible assigné à chaque cluster à partir de ses centroïdes dominants. C'est le composant **ML au sens strict** (apprentissage non supervisé) du système v1 — le moteur à flux de points, lui, est un algorithme statistique explicite inspiré de fight-minds (section 0), pas un modèle appris ; voir Roadmap v2 pour la suite logique (modèle entraîné).

**Honnêteté du positionnement** : le site communiquera sur « algorithme propriétaire basé sur la donnée, avec un volet ML pour les profils de style » plutôt que de prétendre que le score lui-même sort d'un modèle boîte noire — c'est plus défendable et plus facile à expliquer ("expertise apportée sur ce classement" implique de pouvoir justifier le score, pas juste l'afficher).

### 6. Décision EN ATTENTE : couverture de style des adversaires (cas Pereira)

**Ajouté 2026-09-14, non tranché.** L'utilisateur a soulevé un point distinct de « l'adversaire était-il bien classé » (réglé par `opponentShare`, section 2) : un combattant peut avoir battu une série d'adversaires bien classés **tout en n'ayant jamais été confronté à un style/archétype entier** — exemple donné : Alex Pereira, monté très vite dans les classements sans jamais avoir affronté un grappler/wrestler de haut niveau capable de le mettre en difficulté au sol, ce qui rend selon l'utilisateur son ascension "faussée".

Ce n'est **pas** couvert par le moteur à flux de points ci-dessus (qui ne regarde que la qualité des adversaires réellement affrontés, pas la diversité de leurs styles) — ce serait un signal **séparé**, construit sur les archétypes de style de la section 5 (k-means) : pour chaque combattant, quels archétypes de division a-t-il déjà affrontés (gagné ou perdu, peu importe) parmi ceux qui existent réellement dans sa division, et lequel(s) manque(nt).

**Question ouverte, posée à l'utilisateur, réponse en attente** : ce signal doit-il rester un **avertissement affiché à côté du score** (le FightScore reste purement basé sur la performance réelle, un badge/texte séparé signale par ex. "jamais affronté un profil wrestler/grappler" — même logique que l'astérisque du champion), ou doit-il **réduire le score affiché** (un facteur de confiance/incertitude qui pénalise numériquement un combattant tant qu'un archétype majeur de sa division n'a jamais été affronté) ? Ce choix change substantiellement le classement final dans certains cas (Pereira en tête ou non) — ne pas trancher sans réponse explicite de l'utilisateur. Le plan d'implémentation ne construit pas encore cette fonctionnalité tant que ce n'est pas tranché (voir Hors périmètre v1 ci-dessous — retiré du périmètre immédiat, pas abandonné).

### 7. Modèle entraîné (win predictor) — résolu 2026-09-16, voir plan dédié

**Contexte** : premier item de la Roadmap v2 ci-dessous, promu en chantier actif à la demande de l'utilisateur ("je veux continuer le classement basé sur le ML"). Avant d'écrire un plan de production, prototypage empirique first (`data/scripts/prototype-ml-rating.ts`, lecture seule, pas de plan/spec écrit avant — décision explicite de l'utilisateur de valider le signal avant d'investir dans le cadrage) :

1. **Rôle du modèle, tranché par l'utilisateur (AskUserQuestion) : "compléter", pas remplacer.** Le FightScore affiché reste le point-flow existant (explicable, audit trail par combat déjà construit) — le modèle entraîné tourne en parallèle et alimente une métrique complémentaire, pas le score principal. Positionnement éditorial de la section 5 inchangé.
2. **Round 1 du prototype** (features : différentiel de points point-flow + streak + ex-champion + taux de style **agrégés sur toute la carrière**) : à peine mieux qu'un pile-ou-face sur un test set chronologique (fights après 2023-03-11, jamais vus à l'entraînement) — accuracy 54.6% vs 53.1% pour le signe brut du différentiel de points, vs 50% pile-ou-face. Conclusion : le point-flow actuel (calibré pour produire un classement plausible a posteriori, pas pour prédire l'avenir) est un signal prédictif faible pris seul.
3. **Round 2, sur demande explicite de l'utilisateur ("enrichir les features") : fenêtre glissante des 5 derniers combats** au lieu de la moyenne carrière entière pour les taux de style, + `monthsSinceLastFightDiff` (inactivité), + `recentPerformanceDiff` (moyenne du dominance-score des 3 derniers combats, **du point de vue du combattant** : score de dominance brut s'il a gagné, `1 - score` s'il a perdu — donc une défaite serrée et une victoire serrée par les rounds atterrissent proche l'une de l'autre, signal distinct du simple W/L). Résultat : **accuracy 57.6%, log-loss 0.6855** (vs 0.6931 pile-ou-face) — gain net et qualitatif. `recentPerformanceDiff` devient le poids le plus important du modèle, devant `formerChampionDiff` et `streakDiff` — **la forme récente prédit mieux que les points cumulés sur toute la carrière**, confirmé empiriquement, pas juste une intuition.
4. **Décision utilisateur (AskUserQuestion) : passer à la production** avec ce jeu de features (15 au total : pointsDiff, streakDiff, formerChampionDiff, monthsSinceLastFightDiff, recentPerformanceDiff, + 10 différentiels de taux de style). Plan d'implémentation : `docs/superpowers/plans/2026-09-16-fightscore-win-predictor.md`.
5. **Honnêteté du positionnement (cohérent avec la section 5)** : 57.6% n'est pas un score impressionnant dans l'absolu — la page méthodologie doit afficher ce chiffre tel quel plutôt que de survendre "notre IA prédit les combats". C'est un signal utile en complément du FightScore, pas un oracle.
6. **Non résolu / hors périmètre de cette itération** : pas de features physiques (âge, taille, allonge — non scrapées aujourd'hui, nécessiterait une nouvelle source), pas d'historique d'adversaires communs, pas de fenêtres alternatives testées (3 vs 5 vs 10 combats) au-delà du choix initial de 5. Pistes explicites pour une v3 si le signal doit encore progresser.

## Roadmap v2 (hors périmètre de ce chantier, noté pour mémoire)

- ~~Remplacer/compléter le moteur à flux de points par un modèle entraîné~~ — **résolu, voir section 7 ci-dessus et le plan dédié.**
- Bonus "Performance/Fight of the Night" et pénalité "missed weight" (section 0) — nécessitent une nouvelle source de données, non scrapée aujourd'hui.
- Couverture de style des adversaires (section 6) — en attente d'arbitrage utilisateur, pas techniquement complexe une fois tranché (dépend uniquement du clustering déjà prévu en v1).
- Extension multi-organisation une fois qu'une source de stats détaillées équivalente à UFCStats est identifiée pour PFL/Bellator/ONE (ou un modèle dégradé assumé pour ces organisations, entraîné uniquement sur W/L + adversaire).
- Distinction décision unanime/majoritaire/partagée dans le score de dominance (nécessite de scraper les cartes de juges, pas capturées aujourd'hui).

## Schéma DB (nouveau)

```sql
CREATE TABLE IF NOT EXISTS fighter_ratings (
  id SERIAL PRIMARY KEY,
  fighter_id INT NOT NULL REFERENCES fighters(id) ON DELETE CASCADE,
  weight_class VARCHAR(100) NOT NULL,      -- libellé normalisé, aligné sur rankings.weight_class
  points NUMERIC NOT NULL,                  -- points bruts (flux de points), usage interne
  display_score NUMERIC NOT NULL,           -- 0-100, affiché en UI
  current_streak INT NOT NULL DEFAULT 0,    -- positif = série de victoires, négatif = série de défaites
  is_former_champion BOOLEAN NOT NULL DEFAULT false, -- a remporté un fights.is_title_fight dans cette division par le passé
  style_archetype VARCHAR(100),             -- label de cluster k-means, nullable tant que non calculé
  fights_rated INT NOT NULL DEFAULT 0,
  last_fight_date VARCHAR(255),
  is_champion BOOLEAN NOT NULL DEFAULT false, -- copié depuis rankings.rank=0 au moment du calcul, dénormalisé pour l'affichage
  updated_at TIMESTAMP NOT NULL DEFAULT now(),
  UNIQUE (fighter_id, weight_class)
);

CREATE TABLE IF NOT EXISTS fighter_rating_history (
  id SERIAL PRIMARY KEY,
  fighter_id INT NOT NULL REFERENCES fighters(id) ON DELETE CASCADE,
  weight_class VARCHAR(100) NOT NULL,
  fighter_fight_stats_id INT REFERENCES fighter_fight_stats(id),  -- nullable: fallback estimé sans stats détaillées
  points_before NUMERIC NOT NULL,
  points_after NUMERIC NOT NULL,
  opponent_points_before NUMERIC,           -- snapshot des points de l'adversaire juste avant ce combat -- "victoire de qualité" = adversaire avec des points élevés à ce moment-là
  dominance_score NUMERIC NOT NULL,
  dominance_estimated BOOLEAN NOT NULL DEFAULT false,
  computed_at TIMESTAMP NOT NULL DEFAULT now()
);
```

`opponent_points_before` sert directement à surfacer les « victoires de qualité » (adversaire déjà bien classé au moment du combat) sur la fiche combattant/page méthodologie — la réponse "rendre visible plutôt que masqué dans le calcul" à la première partie du retour utilisateur sur l'importance de l'adversaire battu.

`fighter_rating_history` sert à la fois d'audit trail (justifier le score = "expertise apportée") et de source pour une future visualisation "évolution de la note dans le temps" sur la fiche combattant — pas construite dans ce chantier mais le schéma la rend triviale à ajouter ensuite.

## Impact pages / navigation

- **Nouvelle page** `app/classement-calcule` : classement par division, score continu, badge champion, archétype de style.
- **Correction 2026-09-14 (implémentation, Task 9)** : l'hypothèse ci-dessus (« `/rankings` et `/classement` désignent la même chose officielle en 2 langues, une redondance à clarifier ») était **fausse**, jamais vérifiée contre le contenu réel des pages avant cette phase. En réalité : `/rankings` = classement officiel UFC (bien la table `rankings`) ; `/classement` = **le leaderboard du jeu de pronostics** (`fetchAllTimeLeaderboard`, classement des utilisateurs par précision de pronostic — une feature totalement différente, sans rapport avec les rankings officiels). Aucune redondance à résoudre — `/classement-calcule` est une route neuve, pas un renommage. Le nav garde "Rankings" (officiel) et renomme l'entrée pronostics de "Classement" à "Pronostics" (cohérent avec "Mes pronostics" déjà existant) pour libérer le mot "Classement" pour la nouvelle feature phare — voir le plan, Task 10.
- **Nav** (`components/ui/nav.tsx`) : le nouveau classement calculé prend la première position, libellé "Classement".
- **Accueil** (`app/page.tsx`) : une section met en avant le calculé (ex. Top 3 P4P + un encart "comment on calcule ça" pointant vers une page d'explication de la méthodologie) — la page d'explication elle-même est un asset éditorial ("expertise apportée"), pas juste un tableau de chiffres.
- Fiche combattant (`app/fighters/[slug]`) : ajoute le score calculé + l'archétype de style à côté du record W-L-D déjà affiché.

Détail de l'implémentation UI (composants exacts, wording définitif) laissé au plan d'implémentation / à l'exécution — ce document fixe l'architecture de données et de calcul, pas le pixel-perfect.

## Hors périmètre v1

- Autres organisations que l'UFC (voir Roadmap v2)
- Modèle entraîné (régression/gradient boosting) — v1 reste un moteur à flux de points explicite (inspiré fight-minds, section 0) + clustering k-means pour le style
- Distinction décision unanime/partagée/majoritaire
- Bonus "Performance/Fight of the Night" et pénalité "missed weight" — données non scrapées aujourd'hui (section 0)
- Couverture de style des adversaires / cas Pereira (section 6) — en attente d'arbitrage utilisateur, non construit tant que non tranché
- Visualisation de l'évolution de note dans le temps sur la fiche combattant (schéma prêt, UI non construite)
- Retrait des pages/nav de classement officiel — elles restent, juste reléguées en second plan
