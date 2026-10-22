// Tableau de configuration des bâtiments : types, niveaux, coûts, productions, conditions.
// Pour ajouter un bâtiment : ajouter une entrée ici + un modèle 3D dans scene/models.
// Pour équilibrer : modifier les valeurs de `levels` (index 0 = niveau 1 = construction).

import type { BuildingTypeId, Resources, TileType } from './types';

/** Condition de déblocage : population actuelle minimale + bâtiments déjà construits */
export interface UnlockCondition {
  population?: number;
  buildings?: Partial<Record<BuildingTypeId, number>>;
}

/** Caractéristiques d'un niveau. Le niveau 1 décrit la construction. */
export interface LevelDef {
  /** Coût pour construire (niveau 1) ou pour passer à ce niveau (niveaux 2+) */
  cost: Partial<Resources>;
  /** Condition pour construire (niveau 1) ou pour passer à ce niveau */
  unlock?: UnlockCondition;
  /** Places d'habitants fournies */
  housing?: number;
  /** Travailleurs requis à ce niveau (production réduite en proportion s'il en manque) */
  workers?: number;
  /** Production par jour à effectif complet */
  produces?: Partial<Resources>;
  /** Matières premières consommées par jour à effectif complet (bâtiment de transformation) */
  consumes?: Partial<Resources>;
  /** Puissance défensive contre les bandits (à effectif complet) */
  defense?: number;
  /** Nourriture mise à l'abri des rats */
  storage?: number;
}

/** Onglets de la barre de construction (l'ordre ici = l'ordre affiché) */
export type BuildTab = 'housing' | 'production' | 'craft' | 'commerce' | 'defense';

export const BUILD_TABS: { id: BuildTab; label: string; icon: string; hiddenUntilUnlocked?: boolean }[] = [
  { id: 'housing', label: 'Habitations', icon: '🏠' },
  { id: 'production', label: 'Production', icon: '🌾' },
  // N'apparaît qu'une fois un premier bâtiment de transformation débloqué
  { id: 'craft', label: 'Artisanat', icon: '⚒️', hiddenUntilUnlocked: true },
  { id: 'commerce', label: 'Commerce', icon: '⚖️' },
  { id: 'defense', label: 'Défense', icon: '🛡️' },
];

/** Réglages des chaînes de production */
export const CHAINS = {
  /** Rations apportées par unité mangée ; les habitants mangent dans cet ordre */
  nourishment: { bread: 3, flour: 1, food: 1 } as Partial<Record<keyof Resources, number>>,
  eatOrder: ['bread', 'flour', 'food'] as (keyof Resources)[],
  tools: {
    /** Bonus de production des bâtiments équipés d'outils */
    bonus: 0.3,
    /** Outils usés par bâtiment équipé et par jour */
    wearPerBuilding: 0.1,
    /** Bâtiments qui peuvent être équipés */
    equips: ['field', 'lumber', 'quarry', 'mine'] as BuildingTypeId[],
  },
  /**
   * Stock au-delà duquel un bâtiment de transformation s'arrête de lui-même
   * (il libère ses travailleurs et n'use plus de matière première)
   */
  stockCap: { flour: 60, bread: 150, planks: 40, tools: 30, weapons: 25 } as Partial<Record<keyof Resources, number>>,
  weapons: {
    /** Défense ajoutée par arme en stock (plafonnée) */
    defenseEach: 0.15,
    maxDefense: 3,
    /** Part des armes perdues à chaque combat contre des bandits */
    lostPerFight: 0.15,
  },
};

export interface BuildingDef {
  id: BuildingTypeId;
  name: string;
  icon: string;
  description: string;
  /** Onglet de la barre de construction (absent = non constructible) */
  tab?: BuildTab;
  /** false = bâtiment de départ, absent de la barre de construction */
  buildable: boolean;
  /** Côté de l'emprise au sol en cases */
  size: number;
  /** Au moins un niveau ; plusieurs = bâtiment améliorable */
  levels: LevelDef[];
  /** Multiplicateur de production si le bâtiment est sur une case fertile */
  fertileBonus?: number;
  /** Ne produit rien en hiver */
  seasonal?: boolean;
  /** Doit toucher (8 voisins) au moins une case de ce type */
  requiresAdjacent?: TileType;
  /** Ordre d'affectation des travailleurs : plus petit = servi en premier */
  priority: number;
  /** Cases sur lesquelles on peut construire */
  allowedTiles: TileType[];
}

const LAND: TileType[] = ['grass', 'fertile'];

/** Seuils de population communs aux améliorations des bâtiments de production */
export const UPGRADE_LEVEL_2: UnlockCondition = { population: 10 };
export const UPGRADE_LEVEL_3: UnlockCondition = { population: 25 };

export const BUILDINGS: BuildingDef[] = [
  // ---------- Bâtiments de départ ----------
  {
    id: 'castle',
    name: 'Château',
    icon: '🏰',
    description: 'Le cœur du village.',
    buildable: false,
    size: 2,
    levels: [{ cost: {}, housing: 4 }],
    priority: 99,
    allowedTiles: LAND,
  },
  {
    id: 'mill',
    name: 'Moulin',
    icon: '🌬️',
    tab: 'craft',
    description: 'Moud le blé en farine. Le moulin de départ se met en marche dès qu\'il est débloqué.',
    buildable: true,
    size: 1,
    levels: [{ cost: { wood: 15, stone: 5 }, workers: 1, consumes: { food: 4 }, produces: { flour: 4 }, unlock: { population: 8 } }],
    priority: 6,
    allowedTiles: LAND,
  },

  // ---------- Habitations (débloquées au fil de la croissance) ----------
  {
    id: 'hut',
    name: 'Cabane',
    icon: '🛖',
    description: 'Un abri modeste en bois et chaume.',
    tab: 'housing',
    buildable: true,
    size: 1,
    levels: [{ cost: { wood: 6 }, housing: 2 }],
    priority: 99,
    allowedTiles: LAND,
  },
  {
    id: 'house',
    name: 'Maison',
    icon: '🏠',
    description: 'Maison à colombages.',
    tab: 'housing',
    buildable: true,
    size: 1,
    levels: [{ cost: { wood: 12 }, housing: 3, unlock: { population: 6 } }],
    priority: 99,
    allowedTiles: LAND,
  },
  {
    id: 'townhouse',
    name: 'Maison bourgeoise',
    icon: '🏘️',
    description: 'Deux étages, rez-de-chaussée en pierre.',
    tab: 'housing',
    buildable: true,
    size: 1,
    levels: [{ cost: { wood: 15, stone: 12, planks: 5 }, housing: 5, unlock: { population: 15, buildings: { market: 1 } } }],
    priority: 99,
    allowedTiles: LAND,
  },
  {
    id: 'manor',
    name: 'Manoir',
    icon: '🏛️',
    description: 'Grande demeure avec tourelle et jardin.',
    tab: 'housing',
    buildable: true,
    size: 1,
    levels: [{ cost: { wood: 20, stone: 25, gold: 12, planks: 10, tools: 3 }, housing: 8, unlock: { population: 30, buildings: { tower: 1 } } }],
    priority: 99,
    allowedTiles: LAND,
  },

  // ---------- Production (améliorables niveaux 1 → 3) ----------
  {
    id: 'field',
    name: 'Champ',
    icon: '🌾',
    description: 'Produit de la nourriture (x1,75 sur zone fertile).',
    tab: 'production',
    buildable: true,
    size: 1,
    levels: [
      { cost: { wood: 5 }, workers: 1, produces: { food: 4 } },
      { cost: { wood: 10, stone: 4 }, workers: 2, produces: { food: 9 }, unlock: UPGRADE_LEVEL_2 },
      { cost: { wood: 12, stone: 10, gold: 4, planks: 4, tools: 2 }, workers: 3, produces: { food: 15 }, unlock: UPGRADE_LEVEL_3 },
    ],
    fertileBonus: 1.75,
    seasonal: true,
    priority: 1,
    allowedTiles: LAND,
  },
  {
    id: 'lumber',
    name: 'Cabane de bûcheron',
    icon: '🪓',
    description: 'Produit du bois. Doit toucher une forêt.',
    tab: 'production',
    buildable: true,
    size: 1,
    levels: [
      { cost: { wood: 10 }, workers: 1, produces: { wood: 3 } },
      { cost: { wood: 15, stone: 5 }, workers: 2, produces: { wood: 7 }, unlock: UPGRADE_LEVEL_2 },
      { cost: { wood: 12, stone: 12, gold: 5, planks: 6, tools: 2 }, workers: 3, produces: { wood: 11 }, unlock: UPGRADE_LEVEL_3 },
    ],
    requiresAdjacent: 'forest',
    priority: 2,
    allowedTiles: LAND,
  },
  {
    id: 'quarry',
    name: 'Carrière',
    icon: '⛏️',
    description: 'Produit de la pierre. Doit toucher des rochers.',
    tab: 'production',
    buildable: true,
    size: 1,
    levels: [
      { cost: { wood: 15 }, workers: 2, produces: { stone: 3 } },
      { cost: { wood: 20, stone: 5 }, workers: 3, produces: { stone: 5 }, unlock: UPGRADE_LEVEL_2 },
      { cost: { wood: 20, stone: 10, gold: 6, planks: 6, tools: 3 }, workers: 4, produces: { stone: 8 }, unlock: UPGRADE_LEVEL_3 },
    ],
    requiresAdjacent: 'rock',
    priority: 3,
    allowedTiles: LAND,
  },
  {
    id: 'granary',
    name: 'Grenier',
    icon: '🏚️',
    tab: 'production',
    description: 'Des murs secs et un plancher surélevé. Les chats du village y ont élu domicile.',
    buildable: true,
    size: 1,
    levels: [
      { cost: { wood: 18 }, storage: 150 },
      { cost: { wood: 20, stone: 10 }, storage: 300, unlock: UPGRADE_LEVEL_2 },
      { cost: { wood: 15, stone: 20, gold: 5, planks: 8 }, storage: 500, unlock: UPGRADE_LEVEL_3 },
    ],
    priority: 99,
    allowedTiles: LAND,
  },
  // ---------- Artisanat : chaînes de production (débloquées progressivement) ----------
  {
    id: 'bakery',
    name: 'Boulangerie',
    icon: '🥖',
    tab: 'craft',
    description: 'Cuit la farine en pain. Un pain nourrit 3 habitants !',
    buildable: true,
    size: 1,
    levels: [{ cost: { wood: 15, stone: 10 }, workers: 1, consumes: { flour: 3 }, produces: { bread: 3 }, unlock: { population: 10 } }],
    priority: 7,
    allowedTiles: LAND,
  },
  {
    id: 'sawmill',
    name: 'Scierie',
    icon: '🪚',
    tab: 'craft',
    description: 'Débite le bois en planches (maisons bourgeoises, manoirs, niveaux 3).',
    buildable: true,
    size: 1,
    levels: [{ cost: { wood: 20, stone: 5 }, workers: 1, consumes: { wood: 3 }, produces: { planks: 2 }, unlock: { population: 12 } }],
    priority: 6,
    allowedTiles: LAND,
  },
  {
    id: 'mine',
    name: 'Mine de fer',
    icon: '⛏️',
    tab: 'craft',
    description: 'Extrait du minerai de fer. Doit toucher des rochers.',
    buildable: true,
    size: 1,
    levels: [
      { cost: { wood: 20, stone: 5 }, workers: 2, produces: { ironOre: 3 }, unlock: { population: 15 } },
      { cost: { wood: 20, stone: 10 }, workers: 3, produces: { ironOre: 6 }, unlock: UPGRADE_LEVEL_2 },
      { cost: { wood: 15, stone: 15, gold: 6, tools: 2 }, workers: 4, produces: { ironOre: 9 }, unlock: UPGRADE_LEVEL_3 },
    ],
    requiresAdjacent: 'rock',
    priority: 3,
    allowedTiles: LAND,
  },
  {
    id: 'forge',
    name: 'Forge',
    icon: '🔨',
    tab: 'craft',
    description: 'Forge des outils (+30 % de production des bâtiments équipés), puis des armes au niveau 2.',
    buildable: true,
    size: 1,
    levels: [
      { cost: { wood: 15, stone: 20, planks: 5 }, workers: 2, consumes: { ironOre: 2, wood: 1 }, produces: { tools: 1 }, unlock: { population: 20, buildings: { mine: 1 } } },
      { cost: { stone: 20, planks: 10, gold: 10 }, workers: 3, consumes: { ironOre: 4, wood: 2 }, produces: { tools: 1, weapons: 1 }, unlock: UPGRADE_LEVEL_3 },
    ],
    priority: 7,
    allowedTiles: LAND,
  },
  {
    id: 'market',
    name: 'Marché',
    icon: '⚖️',
    description: 'Produit de l\'or.',
    tab: 'commerce',
    buildable: true,
    size: 1,
    levels: [
      { cost: { wood: 20, stone: 10 }, workers: 1, produces: { gold: 2 } },
      { cost: { wood: 25, stone: 18 }, workers: 2, produces: { gold: 5 }, unlock: UPGRADE_LEVEL_2 },
      { cost: { wood: 20, stone: 28, gold: 10, planks: 8, tools: 2 }, workers: 3, produces: { gold: 8 }, unlock: UPGRADE_LEVEL_3 },
    ],
    priority: 4,
    allowedTiles: LAND,
  },
  {
    id: 'tower',
    name: 'Tour de garde',
    icon: '🗼',
    description: 'Réduit les vols des bandits.',
    tab: 'defense',
    buildable: true,
    size: 1,
    levels: [
      { cost: { wood: 10, stone: 15 }, workers: 1, defense: 1 },
      { cost: { wood: 15, stone: 25 }, workers: 2, defense: 2.2, unlock: UPGRADE_LEVEL_2 },
      { cost: { wood: 10, stone: 40, gold: 10, planks: 6, tools: 3 }, workers: 3, defense: 3.8, unlock: UPGRADE_LEVEL_3 },
    ],
    priority: 5,
    allowedTiles: LAND,
  },

  // ---------- Bâtiments liés aux mécaniques cachées : descriptions volontairement vagues ----------
  {
    id: 'well',
    name: 'Puits',
    icon: '🪣',
    tab: 'housing',
    description: 'Une eau fraîche, à portée de seau.',
    buildable: true,
    size: 1,
    levels: [{ cost: { wood: 4, stone: 8 } }],
    priority: 99,
    allowedTiles: LAND,
  },
  {
    id: 'herbalist',
    name: 'Herboriste',
    icon: '🌿',
    tab: 'housing',
    description: 'Elle connaît chaque plante des haies. On murmure qu\'elle n\'est jamais malade.',
    buildable: true,
    size: 1,
    levels: [{ cost: { wood: 12, stone: 4 }, workers: 1, unlock: { population: 6 } }],
    priority: 4,
    allowedTiles: LAND,
  },
  {
    id: 'sheepfold',
    name: 'Bergerie',
    icon: '🐑',
    tab: 'production',
    description: 'Quelques moutons, du lait, de la laine… et ce qu\'ils laissent derrière eux.',
    buildable: true,
    size: 1,
    levels: [{ cost: { wood: 14 }, workers: 1, produces: { food: 1.5 } }],
    priority: 2,
    allowedTiles: LAND,
  },
  {
    id: 'dike',
    name: 'Digue',
    icon: '🧱',
    tab: 'defense',
    description: 'Les anciens disaient que l\'eau finit toujours par revenir.',
    buildable: true,
    size: 1,
    levels: [{ cost: { wood: 8, stone: 10 } }],
    requiresAdjacent: 'water',
    priority: 99,
    allowedTiles: LAND,
  },
  {
    id: 'palisade',
    name: 'Palissade',
    icon: '🚧',
    tab: 'defense',
    description: 'Des pieux bien taillés. On dort mieux derrière.',
    buildable: true,
    size: 1,
    levels: [{ cost: { wood: 10 } }],
    priority: 99,
    allowedTiles: LAND,
  },
  {
    id: 'torch',
    name: 'Torches',
    icon: '🕯️',
    tab: 'defense',
    description: 'Une flamme qui veille. Certains yeux ne l\'aiment pas.',
    buildable: true,
    size: 1,
    levels: [{ cost: { wood: 4 } }],
    priority: 99,
    allowedTiles: LAND,
  },
  {
    id: 'cemetery',
    name: 'Cimetière',
    icon: '🪦',
    description: 'Ici reposent ceux qui ont bâti le village.',
    buildable: false,
    size: 1,
    levels: [{ cost: {} }],
    priority: 99,
    allowedTiles: LAND,
  },
];

export const BUILDING_BY_ID: Record<BuildingTypeId, BuildingDef> = Object.fromEntries(
  BUILDINGS.map((b) => [b.id, b]),
) as Record<BuildingTypeId, BuildingDef>;

export const BUILDABLE = BUILDINGS.filter((b) => b.buildable);

export function buildingsInTab(tab: BuildTab): BuildingDef[] {
  return BUILDABLE.filter((b) => b.tab === tab);
}

export function maxLevel(type: BuildingTypeId): number {
  return BUILDING_BY_ID[type].levels.length;
}

/** Caractéristiques d'un type à un niveau donné (borné aux niveaux existants) */
export function levelDef(type: BuildingTypeId, level: number): LevelDef {
  const levels = BUILDING_BY_ID[type].levels;
  return levels[Math.max(0, Math.min(levels.length - 1, level - 1))];
}

/** Coût de construction (= coût du niveau 1) */
export function buildCost(type: BuildingTypeId): Partial<Resources> {
  return BUILDING_BY_ID[type].levels[0].cost;
}

/** Identifiant de déblocage : "house" pour la construction, "field:2" pour une amélioration */
export function unlockKey(type: BuildingTypeId, level: number): string {
  return level <= 1 ? type : `${type}:${level}`;
}
