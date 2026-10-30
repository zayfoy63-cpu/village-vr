# Village Médiéval — roguelite de gestion (PC → Meta Quest 3)

Développez un village médiéval le plus loin possible en survivant aux imprévus.
Chaque partie est générée à partir d'une **seed** ; la partie se termine quand il n'y a plus d'habitants.

## Lancer

```bash
npm install
npm run dev       # http://localhost:5173
npm run build     # vérification TypeScript + build de production dans dist/
npm test          # tests automatiques : chaînes de production, travailleurs, bergerie (scripts/tests.ts)
npm run bot       # bot de test : 20 seeds × 4 difficultés (voir « Difficulté »)
```

## Contrôles (PC)

| Action | Contrôle |
| --- | --- |
| Tourner la caméra | clic gauche + glisser |
| Zoom | molette |
| Choisir un bâtiment | barre du bas (onglets), touches 1 à 6 dans l'onglet actif |
| Changer d'onglet | Tab (Maj+Tab : onglet précédent) |
| Détails / amélioration | clic sur un bâtiment existant |
| Construire | clic sur une case (aperçu vert = possible, rouge = impossible) |
| Annuler la sélection | clic droit ou Échap |
| Pause / reprise | Espace, ou boutons pause / x0,5 / x1 / x2 |
| Intercepter un bandit | clic sur le bandit (les gardes sortent des tours) |
| Renforcer un bâtiment | clic dessus pendant un orage ou une crue (coût en bois) |

## Architecture

**Règle de nommage** : jamais deux fichiers dont le nom ne diffère que par la casse (compatibilité Windows) — extension exclue : `BoardGrab.tsx` et `boardGrab.ts` entrent en collision, car `import './BoardGrab'` résout alors vers le mauvais fichier.

```
src/
├─ game/            Logique pure TypeScript (aucun import React / Three)
│  ├─ types.ts        Types partagés
│  ├─ config.ts       * Constantes (durée du jour, saisons…) et niveaux de difficulté (DIFFICULTIES)
│  ├─ difficulty.ts   Lecture des coefficients d'une partie : grâce, montée en puissance, intensité cachée
│  ├─ buildings.ts    * Tableau de configuration des bâtiments
│  ├─ events.ts       * Tableau de configuration des événements
│  ├─ mapgen.ts       Génération de carte à partir d'une seed
│  ├─ rules.ts        Placement, travailleurs, production, score
│  ├─ simulation.ts   Temps qui passe, journée, construction, choix, réparations
│  ├─ hazards.ts      Actions du joueur sur les dangers (éteindre, gardes, renforts) + délais de choix
│  ├─ realtime.ts     Bandits, gardes, orage et crue en temps réel (trajets déterministes)
│  ├─ seasons.ts      * Effets cachés des saisons, météo, nuit
│  ├─ mechanics/      * Mécaniques cachées (un fichier chacune) + registre
│  ├─ parcels.ts      * Parcelles : découpage, prix, contenu, camps de bandits et ruines
│  ├─ rng.ts          PRNG déterministe (état sauvegardé)
│  └─ save.ts         Sauvegarde localStorage (try/catch)
├─ store/gameStore.ts Zustand : relie logique, rendu et UI
├─ scene/           Rendu React Three Fiber (low-poly, flat shading, instancing)
│  ├─ models/         Un modèle par bâtiment + registre MODELS
│  └─ xr.ts           Store WebXR (réalité mixte immersive-ar)
├─ vr/              * Mode VR / réalité mixte (Quest 3) : interface 100 % 3D, voir « Passage en VR »
│  ├─ config.ts       * Tous les réglages VR (tailles, tolérances, vitesses, coûts de déplacement, perf)
│  ├─ store.ts        État VR (plateau, entrée mains/manettes, panneaux, préférences)
│  ├─ ui/             Éléments d'interface en 3D (HUD, boîte de construction, cartes, panneaux…) + kit.tsx
│  └─ …               Placement (hit-test), glisser-déposer, entrées, session, perf, émulateur
└─ ui/              HUD, barre de construction, notifications, fin de partie (version PC)
   └─ icons/          * Icônes dessinées (SVG), partagées par l'interface PC et l'atlas VR
```

### Progression
Tout est réglable dans `src/game/buildings.ts` :
- **Habitations** débloquées par conditions (`levels[0].unlock`) : Cabane (2 places) → Maison (3, dès 6 habitants)
  → Maison bourgeoise (5, dès 15 habitants + 1 marché) → Manoir (8, dès 30 habitants + 1 tour de garde).
- **Bâtiments de production** améliorables niveaux 1 → 3 (`levels[1]`, `levels[2]`) : chaque niveau a son coût,
  sa production / défense et sa condition (`UPGRADE_LEVEL_2` = 10 habitants, `UPGRADE_LEVEL_3` = 25 habitants).
- Chaque niveau demande plus de **travailleurs** (`workers` par niveau) ; s'il en manque, la production baisse en proportion.
- Chaque niveau a un **aspect bien distinct** : bois brut (1), tuiles + clôture + couleurs vives (2),
  pierre + étage/tour + bannière + détails animés (3), avec une gerbe d'étincelles à l'amélioration.
- Un déblocage est définitif une fois obtenu et déclenche une notification.
- Clic sur un bâtiment : panneau avec niveau, production actuelle et suivante, coût et bouton « Améliorer ».

### Chaînes de production (`game/buildings.ts`, réglages dans `CHAINS`)
Débloquées progressivement (onglet **Artisanat**, visible au premier déblocage) :
- Nourriture : Champ (blé) → **Moulin** (farine, dès 8 habitants ; le moulin de départ se met en marche)
  → **Boulangerie** (pain, dès 10). Les habitants mangent le pain d'abord : 1 pain = 3 rations.
- Bois : Cabane de bûcheron → **Scierie** (planches, dès 12).
- Fer : **Mine** (minerai, touche des rochers, dès 15 ; améliorable niveaux 2 et 3) → **Forge** (outils, dès 20 + 1 mine) ;
  forge niveau 2 : armes (défense contre les bandits).
- Outils : équipent automatiquement champs, bûcherons, carrières et mines (+30 %, usure 0,1/bâtiment/jour).
- Maisons bourgeoises, manoirs et niveaux 3 demandent des planches et/ou des outils.
- Les recettes (`consumes` → `produces`) sont dans les niveaux des bâtiments ; un transformateur s'arrête seul
  quand son stock est plein (`CHAINS.stockCap`) et peut être mis à l'arrêt depuis son panneau.
- HUD : ligne de base + ligne avancée qui n'affiche que les ressources découvertes. Icône d'alerte au-dessus d'un
  bâtiment à l'arrêt (rouge : matière première, orange : travailleurs).
- **Panneau d'un bâtiment de production** (PC et VR, `rules.ts` → `chainReport`) : stock d'entrée et besoin par jour,
  production en cours, et la raison exacte d'un arrêt (à l'arrêt par le joueur, en feu, pas encore en service, hors
  saison, stock plein, aucun travailleur libre, à sec : quelle matière manque et combien il en reste).
- **Affectation des travailleurs** (`assignWorkers`) : par priorité (champs 1, bûcherons 2, moulin 2,2, scierie 2,3,
  boulangerie 2,4, carrières et mines 3, forge 3,5, marché 4, tours 5). Deux règles évitent que les chaînes restent muettes :
  un champ ne garde aucun travailleur en hiver (il ne produit rien), et un transformateur à sec (moins du quart d'une journée
  de matière, en comptant la récolte du jour) libère les siens.
- Farine et pain se mangent le jour même (le pain d'abord) : leur stock reste souvent à 0 alors que la chaîne tourne ;
  le panneau montre ce qui est produit chaque jour.

### Bergerie (`game/sheep.ts`, coûts et production dans `buildings.ts`)
Niveaux 1 → 3 (dès 10 puis 25 habitants), 1 / 2 / 3 bergers, **laine** (1 / 2,5 / 4,5 par jour : nouvelle ressource, réservée
à la future chaîne de vêtements contre le froid) et un peu de lait (0,5 / 1 / 1,5 blé). Le **fumier** (mécanique des sols) a une
portée de 2,2 cases + 0,4 par niveau et une efficacité de ×1 / ×1,4 / ×1,8 : un champ voisin récupère de l'épuisement.
**Hiver** : le troupeau mange du blé (0,6 / 1,2 / 1,8 par jour, après les repas du village). Sans blé, les moutons maigrissent
(+0,25 par jour, jusqu'à −70 % de laine, lait et fumier, moutons plus fins à l'écran) ; ils reprennent du poids en mangeant ou
au pré. Visuel par niveau (`scene/models/Hidden.tsx`) : abri de chaume et 3 moutons / étable, abreuvoir et 5 moutons /
pierre, tuiles, lanterne, meules et 8 moutons.

### Décisions
- Pause automatique quand une carte à choix apparaît (désactivable dans Paramètres) ; reprise après la décision.
- Chaque option affiche ses conséquences chiffrées ; les événements annoncés sont listés dans « Menaces à venir ».

### Parcelles (`game/parcels.ts`, réglages dans `PARCELS`)
- La carte est découpée en 4 × 3 parcelles ; seules les 2 parcelles centrales sont possédées au départ.
- Les parcelles verrouillées sont assombries et couvertes d'un brouillard léger, avec une pastille : prix
  (ou un cadenas si trop loin) et aperçu du contenu (forêt, rochers, terre fertile, rivière, camp, ruines).
- Achat d'une parcelle voisine en cliquant dessus : prix en or croissant (10 × 1,45ⁿ) et habitants requis à partir du 3e achat.
- Dangers générés avec la seed : **camp de bandits** (attaques plus fréquentes tant qu'il existe, à détruire au combat
  pour un butin) et **ruines** (bloquent 2 cases, à déblayer contre du bois : trésor, risque d'éboulement).

### Difficulté et début de partie (`game/config.ts` → `DIFFICULTIES`, `game/difficulty.ts`)
**Choix au lancement** : à chaque nouvelle partie (premier lancement, bouton « Nouvelle partie », fin de partie), un
menu propose les quatre niveaux — DOM sur PC (`ui/NewGameMenu.tsx`), panneau parchemin 3D en VR (`NewGameMenu3D` dans
`vr/ui/TableObjects.tsx`, même état `menu` du store). Le dernier choix est mémorisé (`Settings.difficulty`) et le niveau
est affiché dans le HUD (PC et VR) et sur l'écran de fin, avec le score multiplié (`score` = `baseScore` × `scoreMult`).
Les anciennes sauvegardes (sans niveau, `SAVE_VERSION` 8) passent en **Normal**.

Chaque niveau est **un jeu de coefficients** dans `DIFFICULTIES` (Normal = l'équilibrage de référence) :

| | Paisible | Normal | Difficile | Cauchemar |
|---|---|---|---|---|
| Ressources de départ (blé / bois / pierre / or) | 20 / 50 / 8 / 12 | 12 / 30 / 2 / 0 | 10 / 28 / 0 / 0 | 8 / 27 / 0 / 0 |
| Période de grâce (`graceDays`) | 14 j | 8 j | 4 j | aucune |
| Montée en puissance (`rampDays`) | 40 j | 30 j | 16 j | aucune |
| Fréquence des événements (`eventFreq`) | ×0,55 | ×1 | ×1,3 | ×1,5 |
| Force des événements (`eventStrength`) | ×0,7 | ×1 | ×1,3 | ×1,6 |
| Part d'événements favorables (`goodShareShift`) | +25 pts | 0 | −8 pts | −15 pts |
| Crises superposées (dès la saison, chance ×) | 4, ×0,3 | 2, ×1 | 1, ×1,5 | 0, ×2,2 |
| Mécaniques cachées (`mechanics`) | ×0,5 | ×1 | ×1,25 | ×1,6 |
| Prix des parcelles | ×0,7 | ×1 | ×1,25 | ×1,5 |
| Score | ×0,6 | ×1 | ×1,5 | ×2,2 |

Les ressources de départ couvrent au minimum **1 cabane de bûcheron + 1 champ + 1 maison** (27 bois) à tous les niveaux.

- **Période de grâce** : tant que `jour ≤ graceDays` (`inGrace`), `pickEvent` n'écarte que les événements négatifs
  (positifs et marchands restent), aucun 2e événement n'est tiré, l'hiver rude et les grands événements d'année sont
  repoussés, et `mechanics/index.ts` ne lance aucune mécanique cachée (ni leur accumulation).
- **Montée en puissance** (`rampFactor`, 0 → 1 après la grâce) : les premiers événements sont petits. Tant qu'elle n'est
  pas finie, la n-ième bande de bandits compte au plus n + 1 bandits (`raidSize`), l'orage touche moins et les
  événements sont plus rares ; la sévérité monte ensuite à chaque saison (`severity(state)`).
- **Intensité des mécaniques cachées** (`mechIntensity`) : multiplie la vitesse ou la gravité de chaque mécanique (froid,
  fièvre, rats, feu d'été, crue, sols, forêt, loups, mines) sans en changer les solutions.
- **Début de partie sûr** : `mapgen.ts` (étape 7) garantit, pour toute seed, dans la zone de départ de l'herbe ou de la
  terre libre qui touche une forêt (bûcheron), des rochers (carrière) et au moins 4 cases fertiles. Ancien générateur :
  184 cartes sur 3 000 n'avaient pas toutes ces ressources ; nouveau : 0 sur 3 000.
- **Filet de sécurité du bois** (`rules.ts`, `hasWoodSource` / `woodSafetyGain`) : sans bûcheron au travail devant une forêt
  vivante, et sans pouvoir en construire un (bois ou case manquants), les villageois sans travail (au moins un) ramassent
  0,5 bois/jour chacun (3 au plus), annoncé par une notification « Bois mort ». Une partie ne peut donc pas se bloquer.

**Bot de test** (`scripts/bot.ts`, `npm run bot -- --seeds 20 --days 300 --levels normal,hard`) : joue des parties
complètes sans interface (construction près du château, améliorations, stocks d'hiver, réponses aux cartes, gardes,
feux). Il vérifie sur 3 000 cartes que le trio de départ est constructible, sur chaque seed que la grâce est respectée
(aucun événement négatif, aucune page de Chronique), et donne le jour de fin de partie par niveau. Le bot est
volontairement prudent mais sans finesse : comparer les niveaux entre eux, pas à un joueur humain.

### Sauvegardes
`game/save.ts` migre les anciennes sauvegardes (`migrate`) : la v1 reçoit les niveaux (1), les déblocages
correspondant à la situation actuelle et les nouveaux compteurs ; la v3 reçoit les parcelles (toute la carte possédée,
sans danger) ; la v6 reçoit une forêt intacte, des sols neufs et une météo vide ; la v7 reçoit la difficulté Normal ; la v5 abandonne l'ancien format d'attaque et reçoit orage, crue et blessés vides. Une sauvegarde illisible est ignorée sans planter.

### Ajouter un bâtiment
1. Ajouter l'id dans `BuildingTypeId` (`game/types.ts`).
2. Ajouter une entrée dans `BUILDINGS` (`game/buildings.ts`) : niveaux (coût, places, travailleurs, production,
   défense, condition de déblocage), contraintes de terrain…
3. Créer son modèle dans `scene/models/` (il reçoit `id` et `level`) et l'enregistrer dans `scene/models/index.tsx`.
   Le modèle s'assemble **uniquement avec `<Part>`** (primitives partagées de `GEO`, matériaux de `MAT`) : c'est ce
   qui le fait entrer dans le regroupement d'instances (voir « Performances VR »). Pas de `<mesh>` direct.

### Imprévus (`game/events.ts`)
Tous les réglages sont dans l'objet `TUNING` en tête de fichier (fréquence, sévérité par saison, délais,
incendies, bandits, variations de moral, révolte, hiver rude, grands événements de fin d'année).
- **Annoncés avec compte à rebours** : bandits (2-3 j, précédés d'un éclaireur), orage (1 j), hiver rude (3 j),
  et chaque fin d'année (j40, j80…) un grand événement : invasion, grande famine ou grande épidémie (3 j).
- **À choix** (délai de 10 s à x1, sinon option par défaut) : épidémie (quarantaine / médecin / ignorer → seconde
  vague), réfugiés (accueillir / refuser), marchand.
- **En temps réel, en 3D** (ne mettent pas le jeu en pause ; flash discret + petit son au début, son désactivable) :
  - **Bandits** (`TUNING.raid`) : apparaissent au bord de la carte (flèche rouge au bord de l'écran s'ils sont hors
    champ), courent vers un grenier, un marché, la maison la plus riche ou le château (trajet en pointillés rouges),
    volent quelques secondes puis repartent avec un sac. Clic sur un bandit : le garde libre de la tour la plus
    rapide court l'intercepter (sans tour : des villageois, qui peuvent être blessés). Les tours envoient aussi
    leurs gardes seules sur les bandits à portée. Attrapé : butin rendu + or ; enfui : ressources perdues.
    Nombre et vitesse augmentent avec la sévérité. La carte « Bandits » propose aussi rançon ou charge générale.
  - **Orage** (`TUNING.storm`) : un nuage sombre se forme au bord (`warningTime`), puis traverse la carte avec son
    ombre au sol. Pendant l'approche : renforcer un bâtiment (clic, 4 bois), rentrer les villageois (pas de blessés,
    production réduite), protéger les récoltes. Sous le nuage : pluie, éclairs (incendies), dégâts sur ce qui
    n'est pas renforcé.
  - **Crue** (`TUNING.flood`, déclenchée par la mécanique cachée « La rivière ») : l'eau monte progressivement le
    long de la rivière ; les bâtiments menacés sont entourés d'un cercle bleu jusqu'au pic (sacs de sable : clic,
    3 bois) ; un champ non protégé est détruit.
  - **Incendie** : clic sur le bâtiment pour l'éteindre, sinon propagation puis destruction. Neige en hiver.
- **Autres** : sécheresse, bonne récolte, nouveaux arrivants (les rats et la crue sont devenus des mécaniques cachées).
- **Bâtiments endommagés** : production x0,5 tant qu'ils ne sont pas réparés (panneau du bâtiment) ; un second
  dégât les détruit.
- **Moral** (règles de base dans `config.ts`, `MORALE`) : < 40 production réduite, < 25 départs, < 10 révolte.

Pour ajouter un événement : une entrée dans `EVENTS` avec `weight`, `roll` (paramètres), `announce` (optionnel),
`trigger` (effet / choix) et `resolve` (effet du choix).

### Saisons à double effet (`game/seasons.ts`, `SEASON_EFFECTS`)
Rien n'est affiché en jeu : le joueur le devine au décor (couleurs, pluie, neige, nuits plus longues) et aux résultats.

| Saison | Positif | Négatif |
| --- | --- | --- |
| Printemps | cultures x1,15 | pluie 1 jour sur 2 → la rivière gonfle (crues) |
| Été | cultures x1,35 | sécheresses x2,2, incendies x1,8, maisons entassées qui s'enflamment |
| Automne | cultures x1,2, marchands x3 | il faut rentrer le bois pour l'hiver |
| Hiver | carrières et mines x1,4, bandits x0,35 | rien ne pousse, bois de chauffage, loups la nuit |

La nuit tombe à 80 % de la journée (68 % en hiver) : la lumière baisse et bleuit.

### Mécaniques cachées (`game/mechanics/`) — attention : solutions
Chaque mécanique est un fichier avec sa config `{ conditions, hint, effect, solution }` et ses crochets
(`endOfDay`, `startOfDay`, `due`/`update` en temps réel). Pour en ajouter une : un fichier dans ce dossier, son id dans
`MechanicId` (`types.ts`) et une ligne dans `MECHANICS` (`mechanics/index.ts`). **Aucune solution n'est écrite en jeu** :
seulement des indices visuels, et des descriptions de bâtiments volontairement vagues.

| Mécanique | Condition | Indice visuel | Effet | Solution |
| --- | --- | --- | --- | --- |
| Crue (`flood.ts`) | jours de pluie : rivière +0,34 / jour de pluie, −0,15 / jour sec ; crue à 1 | rivière plus sombre et plus haute | bâtiments collés à l'eau détruits / abîmés | **Digue** (protège à 2,6 cases) ou ne pas bâtir collé à l'eau ; compromis : champ au bord de l'eau x1,3 |
| Épuisement des sols (`soil.ts`) | champ cultivé : +0,02 / jour | cultures qui jaunissent | jusqu'à −50 % de production | **jachère** (mettre le champ à l'arrêt : −0,1 / jour) ou **Bergerie** à portée (fumier, voir « Bergerie ») |
| Froid (`cold.ts`) | hiver : bois par habitation (château 0,6, cabane 0,3, maison 0,45…) | cheminées sans fumée, villageois qui tremblent | 3 jours sans bois : 15 % de malades ; 6 jours : morts | **stocker du bois** à l'automne |
| Propagation du feu (`fire.ts`) | maisons collées ; l'été, quartier entassé (≥ 2 voisins) : 5 % / jour | escarbilles au-dessus des maisons entassées l'été | feu en chaîne | **espacer**, ou **Puits** à moins de 3 cases (propagation x0,3, extinction 2x plus rapide) |
| Rats (`rats.ts`) | plus de 40 blé hors des greniers | petits points gris autour du château | après 5 jours : 20 % de l'excédent dévoré (+5 %/sévérité) | **Grenier** assez grand |
| Maladie (`disease.ts`) | sans-abri, maisons collées à ≥ 3 bâtiments, puits à < 2,5 cases du **cimetière** | villageois plus lents et plus pâles | fièvre : 8 % des habitants emportés | **Herboriste**, espacer, éloigner le puits des tombes |
| Éclaireur (`scout.ts`) | chaque attaque annoncée | silhouette immobile au bord de la carte | l'attaque a lieu | **cliquer dessus** : un garde l'attrape, l'attaque est annulée |
| Déforestation (`deforestation.ts`) | bûcherons : −0,003 de forêt par bois produit | arbres qui se clairsèment, souches | bûcherons moins productifs ; > 35 % abattus : crues plus fortes et plus larges | laisser repousser (+0,006 / jour près d'une forêt saine) |
| Loups (`wolves.ts`) | nuits d'hiver dès j25 (30 % + 10 %/an) | yeux qui brillent à la lisière | moutons perdus, villageois isolé tué ou blessé | **Torches** (2,6 cases) ou **Palissade** (2,1 cases) près de ce qui est isolé |
| Effondrement de mine (`mine.ts`) | mine niveau 2+ sans planches | secousses et poussière | effondrement : mine perdue, mineurs tués | avoir des **planches** (0,5 / jour niv. 2, 1 / jour niv. 3) |

Le cimetière apparaît de lui-même après les premiers décès, une stèle par mort.

### Chronique du village (`store/chronicle.ts`, `ui/Chronicle.tsx`)
- La première fois qu'une mécanique frappe, une page vague s'ajoute (petit message « Une page s'ajoute… »).
- Quand le joueur applique la bonne solution, même par hasard, la page se complète (dans n'importe quelle partie).
- Sauvegardée à part dans `localStorage` (`village-vr-chronicle`), donc conservée entre les parties ; bouton
  « Chronique 3/10 » dans le menu.

### Logique en temps réel
`simulation.ts` → `advanceTime(state, dt)` fait avancer le temps de jeu continu (jour + avancement) ;
`hazards.ts` gère incendies et délais des choix ; `realtime.ts` calcule à l'avance le trajet de chaque bandit, garde
et nuage (position = fonction du temps), puis traite vols, captures, fuites et dégâts dans l'ordre chronologique,
de façon déterministe (le PRNG est dans l'état). Le rendu ne fait que lire ces positions à chaque image.

## Passage en VR (Meta Quest 3, réalité mixte)

Le plateau se manipule comme un vrai plateau de jeu de société et se pose sur une vraie table (passthrough,
`immersive-ar`) ; tout se joue en 3D, aux mains ou aux manettes. La version PC reste inchangée (souris, interface DOM).

### Le plateau en main (`vr/BoardGrab.tsx`, `vr/boardGrabLogic.ts`)
- **Au lancement**, le plateau apparaît devant le joueur, à hauteur de taille, légèrement incliné vers lui ; ses bords
  brillent doucement et deux mains fantômes montrent le geste. Pas de table à viser : on l'attrape et on le pose
  (« Jouer ici » le laisse où il est).
- **Les 4 bords sont des poignées** : pincer (mains) ou serrer le grip (manettes) près d'un bord saisit le plateau ; le bord
  s'illumine quand la main approche. Une main : déplacer et tourner autour de la verticale ; deux mains sur deux bords :
  porter comme une planche, très stable (mouvement lissé). Le plateau reste toujours à l'horizontale. Pendant la saisie,
  le jeu continue mais les clics sur le village sont coupés.
- **Pose** : relâché juste au-dessus (ou un peu en dessous) d'une vraie table, il s'y aimante (courte descente, petit
  rebond, « toc » de bois et vibration). La table vient des plans détectés par le casque, à défaut du hit-test vers le bas.
  Relâché en l'air, il flotte. Pendant le déplacement, une ombre douce sur la table aide à juger la hauteur.
- **Cadenas** près du coin avant droit (en retrait du présentoir) : verrouillé après chaque pose (les bords ne s'attrapent plus), un tapotement le libère.
  **Paramètres → Recentrer devant moi** en secours. La position est mémorisée pour la session (`sessionStorage`).
- **Zoom** : deux pincements (ou deux grips) au-dessus des cases, loin des bords, puis écarter / rapprocher les mains.
- Réglages : `VR_CONFIG.grab` (distances de saisie, pincement, lissage, zoom) et `VR_CONFIG.snap` (force et durée de
  l'aimantation, sondage de la table, ombre) dans `src/vr/config.ts`.

### Règle d'architecture : une seule couche d'interaction
Toute l'interface VR (HUD, boîte de construction, panneaux de bâtiment, cartes d'événement, menaces, Chronique, fin de
partie, paramètres, tutoriel…) est faite d'éléments de la scène (`src/vr/ui/*`, briques dans `kit.tsx` : `Button3D`,
`Panel`, `Label`, `FacePlayer`…). Ces éléments ne réagissent **qu'aux événements pointeur R3F** (`onClick`,
`onPointerDown`, `onPointerOver`…) : `@react-three/xr` les émet à l'identique pour la souris, le rayon d'une manette,
le pincement à distance, la saisie directe (`pointerType: 'grab'`) et le bout du doigt (`'touch'`).

> **Toute nouvelle fonctionnalité passe par cette couche** : un nouvel élément 3D avec des gestionnaires pointeur, jamais
> un composant qui lit la manette ou la main directement. Ainsi elle marche d'office à la souris, au rayon, au pincement
> et au toucher. Les actions de jeu passent toujours par le store (`useGame`), comme à la souris.
> Les rares entrées « hors pointeur » sont centralisées : boutons A/B/X/Y, sticks et retrait du casque dans
> `vr/Session.tsx` ; saisie du plateau par ses bords et zoom à deux mains (proximité de la main, pas de cible pointée)
> dans `vr/BoardGrab.tsx`.

### Réglages
Tout est dans **`src/vr/config.ts`** : taille et hauteur du plateau, zoom, rotation, tolérances de saisie, durée de maintien,
coûts / délais de déplacement (`moves`), durée de l'annulation, seuils de confort, qualité visuelle VR (`perf`), étapes du
tutoriel, vibrations. Les préférences du joueur (main dominante, assis/debout, son, FPS…) sont sauvées à part
(`village-vr-xr-prefs`) ; les parties gardent leur format (SAVE_VERSION inchangée par la VR).

### Commandes
| | Mains | Manettes |
|-|-|-|
| Choisir / valider | toucher du doigt ou pincer à distance | gâchette (main dominante) |
| Attraper un bâtiment, un bandit | pincer près de l'objet | grip |
| Porter le plateau | pincer un bord (une ou deux mains) | grip près d'un bord |
| Libérer / verrouiller le plateau | tapoter le cadenas | gâchette sur le cadenas |
| Poser un bâtiment | pincer dans la boîte, déposer sur une case (aperçu vert / rouge) | idem |
| Détruire | remettre le bâtiment dans la boîte (remboursement partiel) | idem |
| Annuler (30 s) | bouton « Annuler » près du plateau | B |
| Tourner le plateau | le porter et tourner la main (ou les deux mains) | stick de la main dominante |
| Zoom | deux pincements au-dessus des cases, écarter les mains | stick de la main dominante, ou deux grips au-dessus |
| Monter / descendre le plateau | le porter | stick de l'autre main |
| Boîte de construction | toujours là | A |
| Pause / menu | sablier (toucher), engrenage | X / Y |
| Aide | regarder l'intérieur du poignet gauche | regarder la manette gauche |

Bascule mains / manettes automatique. Retrait du casque ou fin de session : pause + sauvegarde.

### Tester sans casque (Immersive Web Emulator / IWER)
- `npm run dev` puis ouvrir `http://localhost:5173/?emulate=controller` (ou `?emulate=hands`) : un Quest 3 virtuel est
  installé dans la page (`src/vr/emulator.ts`, salon simulé avec table). Cliquer sur **Réalité mixte**.
- `?ui3d` affiche l'interface 3D VR sur PC (aperçu à la souris, sans casque).
- En mode dev, `window.__xrDevice` pilote le casque et les contrôleurs émulés (voir les scripts de test du dépôt de travail :
  visée, gâchette, pincement, doigt posé sur un point).

### Icônes (`src/ui/icons/`)
Aucun emoji dans le jeu : leur affichage dépend des polices du système (carrés vides sous Windows pour les plus
récents). Toutes les icônes (ressources, bâtiments, événements, HUD, Chronique, paramètres, aide VR) sont dessinées
dans `ui/icons/defs.ts`, façon enluminure : trait d'encre brune un peu tremblé et lavis de couleurs de la palette
posé légèrement à côté du trait, dans un repère 24 x 24.
- Dans les textes, une icône est un **jeton** : `` `${I.wood} Bois` `` (`I` exporté par `ui/icons`). Les données du jeu
  (ressources, bâtiments, notifications, conséquences des choix) ne contiennent que des jetons.
- PC : `<RichText text={…} />` (`ui/icons/Icon.tsx`) remplace chaque jeton par un SVG ; `<Icon id="wood" />` pour une
  icône seule. Les icônes de ressources montrent leur nom au survol. Pour un attribut `title`, `plainText(texte)`.
- VR : l'atlas de caractères dessine chaque icône une seule fois avec les mêmes tracés (aucune texture en plus) ;
  le présentoir affiche le nom d'une ressource au survol de son icône.
- Conséquences des choix toujours écrites « icône + chiffre + nom » (`−15 Bois`, `−5 Moral`).
- Les anciennes sauvegardes (avec emojis) sont converties au chargement (`game/legacyIcons.ts`).
- Ajouter une icône : une entrée dans `ICON_DEFS` ; elle est aussitôt disponible en `I.monIcone` et `<Icon id>`.

### Performances VR (objectif Quest 3 : 72 images/s)
Mesure de référence (émulateur, même partie de 35 bâtiments, pluie + nuit + bandits + 2 incendies) :
2 072 appels de dessin et 101 textures (environ 310 après quelques jours de jeu : les textures de texte n'étaient pas
libérées) **→ 116 appels (passe d'ombre comprise) et 2 textures, stables en jeu**.
- **Modèles regroupés** (`scene/partPool.ts`, `scene/PartPools.tsx`) : chaque `<Part>` ne rend qu'un repère invisible
  (aucun dessin, mais toujours cible des clics, rayons et doigts) ; toutes les pièces de tous les bâtiments, miniatures
  et décors sont dessinées par quelques `InstancedMesh` partagés, un par (forme, famille de matériau, ombre). Les
  matériaux standard opaques ne diffèrent que par la couleur : un seul matériau blanc, couleur par instance. Les
  matrices sont recopiées juste avant chaque rendu (après le calcul des matrices) : animations et plateau suivent.
- **Interface en un seul maillage** (`vr/ui/uiBatchCore.ts`, `vr/ui/atlas.ts`) : tous les fonds de panneaux, boutons, textes
  et emojis de l'interface 3D sont des triangles d'un même maillage, dessinés en un appel avec **un atlas de caractères
  unique** (couleur du texte = couleur de sommet). Ordre de dessin : du plus loin au plus proche, panneau par panneau.
  Les éléments du kit (`Label`, `Plate`, `Panel`, `Button3D`) gardent la même interface : rien à changer pour s'en servir.
- **Zones de clic** : matériau `visible: false` (jamais dessinées, toujours touchées). Un élément fermé est démonté ou caché.
- **Ombres** : une seule lumière en projette ; en VR, carte de `perf.shadowMap` limitée au plateau (`perf.shadowExtent`) ;
  les petits objets (villageois, bandits, cultures, rochers, planches) n'en projettent pas (`scene/quality.ts`).
- **Particules** : un système instancié par type (pluie, neige, fumée, flammes, escarbilles, poussière), plafonné en VR
  (`perf.rainDrops`, `snowFlakes`, `smokePuffs`, `smokeChimneys`, `sparks`, `dust`).
- **Divers** : rendu fovéal fixe (`perf.foveation`), résolution `perf.frameBufferScaling`, `matrixAutoUpdate = false`
  sur les objets immobiles, aucun objet ni matériau recréé à chaque image (textures et géométries stables en jeu).
- **Compteur** (Paramètres → « Compteur de perf. ») : FPS, appels de dessin, triangles et textures, sur le présentoir.

### Vitesse du jeu et effets d'ambiance (`scene/ambient.ts`)
À x0,5 / x1 / x2, seul le gameplay change de rythme : villageois, bandits, cycle jour/nuit, production. Fumée, pluie, neige,
flammes, étincelles, pales du moulin, roues et scies gardent une vitesse naturelle : leurs animations lisent `clock.elapsedTime`
ou `ambientRate()` (1 en marche, 0 en pause), jamais la vitesse du jeu.

### Style « fait main » (`src/palette.ts`, `scene/handmade.ts`, `scene/wear.ts`)
Rien n'est parfaitement droit, et rien ne coûte un appel de dessin ni une texture de plus :
- **Palette unique** (`palette.ts`) : 16 couleurs inspirées des miniatures médiévales (terres, ocres, verts mousse,
  rouge brique, bleu guède). Matériaux 3D, sol, végétation, interface PC (variables CSS `--pal-*`) et VR, icônes : tout en
  dérive (`palMix` pour une nuance intermédiaire). Lumière dorée et contrastée le jour, bleutée la nuit (`Scene.tsx`).
- **Pièces des modèles** : primitives légèrement déformées (`ROUGH` : murs qui penchent, faîtages affaissés, pointes
  décalées) ; chaque pièce et chaque bâtiment reçoit une inclinaison, une rotation, une taille et une teinte seedées
  (`VariantSeed`, `partJitter`, `buildingJitter`) : deux maisons du même type ne sont jamais identiques. La teinte passe
  par la couleur d'instance des regroupements (`partPool.ts`). Réglages dans `HANDMADE`.
- **Nature** : sapins à 2 ou 3 étages de travers, feuillus en une à trois boules bosselées (chêne, peuplier, buisson),
  rochers et cailloux tous différents, herbes folles et touffes d'herbe rase à cheval sur les cases.
- **Sol** : cases bosselées aux nuances irrégulières, tournées au hasard ; chemins de terre (`wear.ts`) qui serpentent
  entre les bâtiments (arbre couvrant), terre battue autour des maisons, et qui s'élargissent et s'assombrissent là où
  les villageois passent souvent (usure non sauvegardée, recalculée au chargement).
- **Villageois** : taille, carrure, démarche et tunique propres à chacun ; un prénom médiéval (`game/names.ts`) au survol
  (infobulle PC, étiquette VR).
- **Signes de vie** (`models/LifeProps.tsx`) : bûches, tonneaux, seau, linge, outils, caisses selon le type de bâtiment.
- **Interface « registre »** : papier, encre brune, coins inégaux, sceaux de cire pour les actions importantes ; aucune
  ombre portée ni dégradé. Polices embarquées (`@fontsource`, aucun chargement extérieur) : IM Fell English pour les
  titres (chiffres modernes pour rester lisible), Alegreya Sans pour les textes et les chiffres. En VR, elles sont dessinées
  dans l'atlas unique, avec le grain du papier et les bords irréguliers des plaques (`atlas.ts`, `uiBatchCore.ts`).
- **Annales** (`game/annals.ts`) : les grands événements reçoivent un nom (« Le Grand Feu de l'an 2 ») dans la Chronique.
  Champ facultatif de la sauvegarde : les anciennes parties commencent avec des annales vides.

Compteur avant / après (même partie de 35 bâtiments) : VR crise 116 → 116 appels, 2 → 2 textures ; VR jour 102 → 102 ;
PC 46 → 46 appels, 1 → 1 texture. Les triangles augmentent (VR crise 77 640 → 114 190) : formes moins régulières et
taches au sol, sans effet sur le nombre d'appels.

## Déploiement
`vercel.json` est configuré pour Vite (build `npm run build`, sortie `dist/`).
