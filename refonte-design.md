# Refonte design — MMA Universe « fight night »

Prompt à coller dans une nouvelle session Claude Code ouverte dans ce repo.

```text
Refonte graphique de MMA Universe selon le design « fight night » que j'ai validé.

SOURCES DE VÉRITÉ
- Maquettes : canevas https://claude.ai/artifact/Vbxx9FJqKA8saM3UdqQ8wu, artboards « MMA.dc.html » (sombre) et « MMA-clair.dc.html » (clair). Lis-les avec l'outil Artifact (action read) avant de coder ; ce sont des maquettes HTML, pas du code à copier tel quel.
- Design system : @sdmm/design, à installer avec `npm i github:SDMM27/sdmm-design#v1.0.0`. Lis son README : thème « mma », preset Tailwind 3 (`@sdmm/design/tailwind/preset`) + `css/all-mma.css`, fontsUrl('mma') (Bricolage Grotesque avec l'axe wdth), .sd-display, .sd-marquee, .sd-punch, initCountUp, initTheme/themeScript.

DIRECTION VALIDÉE
Ambiance affiche de combat. Titres en Bricolage Grotesque condensé (wdth 75), en capitales. Accent rouge, ambre en secondaire. Formes : octogones (rangs, initiales, anneau du N°1 qui tourne), boutons coupés en biais, bloc incliné derrière le hero. BEAUCOUP d'animation, c'est une demande explicite :
- bandeau rouge qui défile avec les chiffres clés ;
- reflet qui balaie le hero, mot « calculé » souligné en biais ;
- compteurs (704 combattants, 12 catégories, 13 organisations) et score du N°1 qui comptent jusqu'à leur valeur ;
- compte à rebours en direct jusqu'au recalcul du lundi ;
- face-à-face façon pesée avec un « VS » qui tombe comme un coup de poing, barres miroir et barre de probabilité ;
- classement en cascade, N°1 encadré de rouge ;
- cartes de champions qui se soulèvent au survol, octogone qui tremble.
Mode sombre (par défaut) ET clair, avec un bouton de bascule.

PÉRIMÈTRE
- Site Next.js : accueil, /classement-calcule et sa méthodologie, /simulateur (applique-lui le face-à-face animé, avec les vraies probabilités), fiches combattants, événements, recherche. Transpose le style sur chaque page, au-delà de l'accueil de la maquette.
- Toutes les données restent réelles (FightScore, classements). N'invente aucun chiffre.
- Ne change ni le pipeline, ni le scraping, ni le moteur FightScore, ni les routes. C'est une refonte visuelle uniquement.
- App mobile Expo (mobile/, NativeWind) : hors périmètre de cette PR. Termine par un plan pour la porter ensuite avec `@sdmm/design/native` (getTheme('mma'), nativewindPreset('mma'), Reanimated).
- prefers-reduced-motion respecté partout, contraste AA, cibles tactiles ≥ 44 px, aucun scroll horizontal à 360 px. Surveille les performances : les animations doivent rester fluides sur mobile.

MÉTHODE
1. Explore le code et propose un plan court, puis attends mon accord.
2. Travaille sur une branche `redesign/fight-night`, en commits atomiques. Build, lint et typecheck doivent rester verts.
3. Vérifie chaque page dans le navigateur, en sombre et en clair, sur desktop et mobile.
4. Ouvre une PR avec les captures avant/après et le lien de preview Vercel. Ne merge pas.
```
