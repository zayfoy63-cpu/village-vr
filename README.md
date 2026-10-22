# Village Médiéval — roguelite de gestion (PC → Meta Quest 3)

Développez un village médiéval le plus loin possible en survivant aux imprévus.
Chaque partie est générée à partir d'une **seed** ; la partie se termine quand il n'y a plus d'habitants.

## Lancer

```bash
npm install
npm run dev       # http://localhost:5173
npm run build     # vérification TypeScript + build de production dans dist/
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
| Pause / reprise | Espace, ou boutons ⏸ / x0,5 / x1 / x2 |
| Intercepter un bandit | clic sur le bandit (les gardes sortent des tours) |
| Renforcer un bâtiment | clic dessus pendant un orage ou une crue (coût en bois) |

## Architecture

```
src/
├─ game/            Logique pure TypeScript (aucun import React / Three)
│  ├─ types.ts        Types partagés
│  ├─ config.ts       Constantes (durée du jour, saisons, ressources de départ…)
│  ├─ buildings.ts    ⭐ Tableau de configuration des bâtiments
│  ├─ events.ts       ⭐ Tableau de configuration des événements
│  ├─ mapgen.ts       Génération de carte à partir d'une seed
│  ├─ rules.ts        Placement, travailleurs, production, score
│  ├─ simulation.ts   Temps qui passe, journée, construction, choix, réparations
│  ├─ hazards.ts      Actions du joueur sur les dangers (éteindre, gardes, renforts) + délais de choix
│  ├─ realtime.ts     Bandits, gardes, orage et crue en temps réel (trajets déterministes)
│  ├─ seasons.ts      ⭐ Effets cachés des saisons, météo, nuit
│  ├─ mechanics/      ⭐ Mécaniques cachées (un fichier chacune) + registre
│  ├─ parcels.ts      ⭐ Parcelles : découpage, prix, contenu, camps de bandits et ruines
│  ├─ rng.ts          PRNG déterministe (état sauvegardé)
│  └─ save.ts         Sauvegarde localStorage (try/catch)
├─ store/gameStore.ts Zustand : relie logique, rendu et UI
├─ scene/           Rendu React Three Fiber (low-poly, flat shading, instancing)
│  ├─ models/         Un modèle par bâtiment + registre MODELS
│  └─ xr.ts           Store WebXR (bouton "Entrer en VR")
└─ ui/              HUD, barre de construction, notifications, fin de partie
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
- Nourriture : Champ (🌾 blé) → **Moulin** (🥣 farine, dès 8 habitants ; le moulin de départ se met en marche)
  → **Boulangerie** (🍞 pain, dès 10). Les habitants mangent le pain d'abord : 1 pain = 3 rations.
- Bois : Cabane de bûcheron → **Scierie** (🪚 planches, dès 12).
- Fer : **Mine** (🔩 minerai, touche des rochers, dès 15 ; améliorable niveaux 2 et 3) → **Forge** (🛠️ outils, dès 20 + 1 mine) ;
  forge niveau 2 : ⚔️ armes (défense contre les bandits).
- Outils : équipent automatiquement champs, bûcherons, carrières et mines (+30 %, usure 0,1/bâtiment/jour).
- Maisons bourgeoises, manoirs et niveaux 3 demandent des planches et/ou des outils.
- Les recettes (`consumes` → `produces`) sont dans les niveaux des bâtiments ; un transformateur s'arrête seul
  quand son stock est plein (`CHAINS.stockCap`) et peut être mis à l'arrêt depuis son panneau.
- HUD : ligne de base + ligne avancée qui n'affiche que les ressources découvertes. Icône d'alerte au-dessus d'un
  bâtiment à l'arrêt (rouge : matière première, orange : travailleurs).

### Décisions
- Pause automatique quand une carte à choix apparaît (désactivable dans ⚙️ Paramètres) ; reprise après la décision.
- Chaque option affiche ses conséquences chiffrées ; les événements annoncés sont listés dans « Menaces à venir ».

### Parcelles (`game/parcels.ts`, réglages dans `PARCELS`)
- La carte est découpée en 4 × 3 parcelles ; seules les 2 parcelles centrales sont possédées au départ.
- Les parcelles verrouillées sont assombries et couvertes d'un brouillard léger, avec une pastille : prix
  (ou 🔒 si trop loin) et aperçu du contenu (🌲 forêt, 🪨 rochers, 🌼 terre fertile, 🌊 rivière, ⛺ camp, 🏛️ ruines).
- Achat d'une parcelle voisine en cliquant dessus : prix en or croissant (10 × 1,45ⁿ) et habitants requis à partir du 3e achat.
- Dangers générés avec la seed : **camp de bandits** (attaques plus fréquentes tant qu'il existe, à détruire au combat
  pour un butin) et **ruines** (bloquent 2 cases, à déblayer contre du bois : trésor, risque d'éboulement).

### Sauvegardes
`game/save.ts` migre les anciennes sauvegardes (`migrate`) : la v1 reçoit les niveaux (1), les déblocages
correspondant à la situation actuelle et les nouveaux compteurs ; la v3 reçoit les parcelles (toute la carte possédée,
sans danger) ; la v6 reçoit une forêt intacte, des sols neufs et une météo vide ; la v5 abandonne l'ancien format d'attaque et reçoit orage, crue et blessés vides. Une sauvegarde illisible est ignorée sans planter.

### Ajouter un bâtiment
1. Ajouter l'id dans `BuildingTypeId` (`game/types.ts`).
2. Ajouter une entrée dans `BUILDINGS` (`game/buildings.ts`) : niveaux (coût, places, travailleurs, production,
   défense, condition de déblocage), contraintes de terrain…
3. Créer son modèle dans `scene/models/` (il reçoit `id` et `level`) et l'enregistrer dans `scene/models/index.tsx`.

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
    ombre au sol. Pendant l'approche : renforcer un bâtiment (clic, 4 🪵), rentrer les villageois (pas de blessés,
    production réduite), protéger les récoltes. Sous le nuage : pluie, éclairs (incendies), dégâts sur ce qui
    n'est pas renforcé.
  - **Crue** (`TUNING.flood`, déclenchée par la mécanique cachée « La rivière ») : l'eau monte progressivement le
    long de la rivière ; les bâtiments menacés sont entourés d'un cercle bleu jusqu'au pic (sacs de sable : clic,
    3 🪵) ; un champ non protégé est détruit.
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

### Mécaniques cachées (`game/mechanics/`) — ⚠️ solutions
Chaque mécanique est un fichier avec sa config `{ conditions, hint, effect, solution }` et ses crochets
(`endOfDay`, `startOfDay`, `due`/`update` en temps réel). Pour en ajouter une : un fichier dans ce dossier, son id dans
`MechanicId` (`types.ts`) et une ligne dans `MECHANICS` (`mechanics/index.ts`). **Aucune solution n'est écrite en jeu** :
seulement des indices visuels, et des descriptions de bâtiments volontairement vagues.

| Mécanique | Condition | Indice visuel | Effet | Solution |
| --- | --- | --- | --- | --- |
| Crue (`flood.ts`) | jours de pluie : rivière +0,34 / jour de pluie, −0,15 / jour sec ; crue à 1 | rivière plus sombre et plus haute | bâtiments collés à l'eau détruits / abîmés | **Digue** (protège à 2,6 cases) ou ne pas bâtir collé à l'eau ; compromis : champ au bord de l'eau x1,3 |
| Épuisement des sols (`soil.ts`) | champ cultivé : +0,02 / jour | cultures qui jaunissent | jusqu'à −50 % de production | **jachère** (mettre le champ à l'arrêt : −0,1 / jour) ou **Bergerie** à moins de 2 cases (fumier) |
| Froid (`cold.ts`) | hiver : bois par habitation (château 0,6, cabane 0,3, maison 0,45…) | cheminées sans fumée, villageois qui tremblent | 3 jours sans bois : 15 % de malades ; 6 jours : morts | **stocker du bois** à l'automne |
| Propagation du feu (`fire.ts`) | maisons collées ; l'été, quartier entassé (≥ 2 voisins) : 5 % / jour | escarbilles au-dessus des maisons entassées l'été | feu en chaîne | **espacer**, ou **Puits** à moins de 3 cases (propagation x0,3, extinction 2x plus rapide) |
| Rats (`rats.ts`) | plus de 40 🌾 hors des greniers | petits points gris autour du château | après 5 jours : 20 % de l'excédent dévoré (+5 %/sévérité) | **Grenier** assez grand |
| Maladie (`disease.ts`) | sans-abri, maisons collées à ≥ 3 bâtiments, puits à < 2,5 cases du **cimetière** | villageois plus lents et plus pâles | fièvre : 8 % des habitants emportés | **Herboriste**, espacer, éloigner le puits des tombes |
| Éclaireur (`scout.ts`) | chaque attaque annoncée | silhouette immobile au bord de la carte | l'attaque a lieu | **cliquer dessus** : un garde l'attrape, l'attaque est annulée |
| Déforestation (`deforestation.ts`) | bûcherons : −0,003 de forêt par bois produit | arbres qui se clairsèment, souches | bûcherons moins productifs ; > 35 % abattus : crues plus fortes et plus larges | laisser repousser (+0,006 / jour près d'une forêt saine) |
| Loups (`wolves.ts`) | nuits d'hiver dès j25 (30 % + 10 %/an) | yeux qui brillent à la lisière | moutons perdus, villageois isolé tué ou blessé | **Torches** (2,6 cases) ou **Palissade** (2,1 cases) près de ce qui est isolé |
| Effondrement de mine (`mine.ts`) | mine niveau 2+ sans planches | secousses et poussière | effondrement : mine perdue, mineurs tués | avoir des **planches** (0,5 / jour niv. 2, 1 / jour niv. 3) |

Le cimetière apparaît de lui-même après les premiers décès, une stèle par mort.

### Chronique du village (`store/chronicle.ts`, `ui/Chronicle.tsx`)
- La première fois qu'une mécanique frappe, une page vague s'ajoute (petit message « 📜 Une page s'ajoute… »).
- Quand le joueur applique la bonne solution, même par hasard, la page se complète (dans n'importe quelle partie).
- Sauvegardée à part dans `localStorage` (`village-vr-chronicle`), donc conservée entre les parties ; bouton
  « 📜 Chronique 3/10 » dans le menu.

### Logique en temps réel
`simulation.ts` → `advanceTime(state, dt)` fait avancer le temps de jeu continu (jour + avancement) ;
`hazards.ts` gère incendies et délais des choix ; `realtime.ts` calcule à l'avance le trajet de chaque bandit, garde
et nuage (position = fonction du temps), puis traite vols, captures, fuites et dégâts dans l'ordre chronologique,
de façon déterministe (le PRNG est dans l'état). Le rendu ne fait que lire ces positions à chaque image.

## Passage en VR (Meta Quest 3)
- `@react-three/xr` est déjà branché : le `<Canvas>` est enveloppé dans `<XR store={xrStore}>`.
- Le bouton **Entrer en VR** n'est actif que si `navigator.xr.isSessionSupported('immersive-vr')` répond oui.
- En VR, `WorldRoot` (`scene/Scene.tsx`) réduit le monde à l'échelle d'une maquette sur table (`VR_WORLD_SCALE`).
- Les événements pointeur R3F (survol, clic) fonctionnent aussi avec les rayons des manettes XR.
- Prochaines étapes : barre de construction et HUD en 3D (panneaux flottants), réglage des ombres pour l'échelle VR.

## Déploiement
`vercel.json` est configuré pour Vite (build `npm run build`, sortie `dist/`).
