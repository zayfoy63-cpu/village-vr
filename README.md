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
| Pause / reprise | Espace, ou boutons ⏸ / x1 / x2 |

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
│  ├─ hazards.ts      Dangers en temps réel : incendies, bandits, délais de choix
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
sans danger). Une sauvegarde illisible est ignorée sans planter.

### Ajouter un bâtiment
1. Ajouter l'id dans `BuildingTypeId` (`game/types.ts`).
2. Ajouter une entrée dans `BUILDINGS` (`game/buildings.ts`) : niveaux (coût, places, travailleurs, production,
   défense, condition de déblocage), contraintes de terrain…
3. Créer son modèle dans `scene/models/` (il reçoit `id` et `level`) et l'enregistrer dans `scene/models/index.tsx`.

### Imprévus (`game/events.ts`)
Tous les réglages sont dans l'objet `TUNING` en tête de fichier (fréquence, sévérité par saison, délais,
incendies, bandits, variations de moral, révolte, hiver rude, grands événements de fin d'année).
- **Annoncés avec compte à rebours** : bandits (1-2 j), tempête (1 j, renforcer les toits), crue (2 j, renforcer
  les berges), hiver rude (3 j), et chaque fin d'année (j40, j80…) un grand événement : invasion, grande famine
  ou grande épidémie (3 j).
- **À choix** (délai de 10 s à x1, sinon option par défaut) : bandits (rançon / combattre / les laisser venir),
  épidémie (quarantaine / médecin / ignorer → seconde vague), réfugiés (accueillir / refuser), marchand.
- **En temps réel, en 3D** : incendie (clic sur le bâtiment pour l'éteindre, sinon propagation puis destruction),
  bandits (marchent sur le château, les tours tirent, clic pour les abattre et récupérer le butin), crue, neige.
- **Autres** : rats (dévorent la nourriture hors des greniers), sécheresse, bonne récolte, nouveaux arrivants.
- **Bâtiments endommagés** : production x0,5 tant qu'ils ne sont pas réparés (panneau du bâtiment) ; un second
  dégât les détruit.
- **Moral** (règles de base dans `config.ts`, `MORALE`) : < 40 production réduite, < 25 départs, < 10 révolte.

Pour ajouter un événement : une entrée dans `EVENTS` avec `weight`, `roll` (paramètres), `announce` (optionnel),
`trigger` (effet / choix) et `resolve` (effet du choix).

### Logique en temps réel
`simulation.ts` → `advanceTime(state, dt)` fait avancer le temps de jeu continu (jour + avancement) ;
`hazards.ts` gère incendies, attaques et délais des choix, de façon déterministe (le PRNG est dans l'état).

## Passage en VR (Meta Quest 3)
- `@react-three/xr` est déjà branché : le `<Canvas>` est enveloppé dans `<XR store={xrStore}>`.
- Le bouton **Entrer en VR** n'est actif que si `navigator.xr.isSessionSupported('immersive-vr')` répond oui.
- En VR, `WorldRoot` (`scene/Scene.tsx`) réduit le monde à l'échelle d'une maquette sur table (`VR_WORLD_SCALE`).
- Les événements pointeur R3F (survol, clic) fonctionnent aussi avec les rayons des manettes XR.
- Prochaines étapes : barre de construction et HUD en 3D (panneaux flottants), réglage des ombres pour l'échelle VR.

## Déploiement
`vercel.json` est configuré pour Vite (build `npm run build`, sortie `dist/`).
