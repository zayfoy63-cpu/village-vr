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
| Choisir un bâtiment | barre du bas ou touches 1 à 6 |
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
│  ├─ simulation.ts   Passage d'un jour, construction, échanges
│  ├─ rng.ts          PRNG déterministe (état sauvegardé)
│  └─ save.ts         Sauvegarde localStorage (try/catch)
├─ store/gameStore.ts Zustand : relie logique, rendu et UI
├─ scene/           Rendu React Three Fiber (low-poly, flat shading, instancing)
│  ├─ models/         Un modèle par bâtiment + registre MODELS
│  └─ xr.ts           Store WebXR (bouton "Entrer en VR")
└─ ui/              HUD, barre de construction, notifications, fin de partie
```

### Ajouter un bâtiment
1. Ajouter l'id dans `BuildingTypeId` (`game/types.ts`).
2. Ajouter une entrée dans `BUILDINGS` (`game/buildings.ts`) : coût, travailleurs, production, contraintes…
3. Créer son modèle dans `scene/models/` et l'enregistrer dans `scene/models/index.tsx`.

### Ajouter un événement
Ajouter une entrée dans `EVENTS` (`game/events.ts`) avec `weight(state)` (probabilité selon la situation)
et `apply(ctx)` (effet + texte de la carte de notification).

## Passage en VR (Meta Quest 3)
- `@react-three/xr` est déjà branché : le `<Canvas>` est enveloppé dans `<XR store={xrStore}>`.
- Le bouton **Entrer en VR** n'est actif que si `navigator.xr.isSessionSupported('immersive-vr')` répond oui.
- En VR, `WorldRoot` (`scene/Scene.tsx`) réduit le monde à l'échelle d'une maquette sur table (`VR_WORLD_SCALE`).
- Les événements pointeur R3F (survol, clic) fonctionnent aussi avec les rayons des manettes XR.
- Prochaines étapes : barre de construction et HUD en 3D (panneaux flottants), réglage des ombres pour l'échelle VR.

## Déploiement
`vercel.json` est configuré pour Vite (build `npm run build`, sortie `dist/`).
