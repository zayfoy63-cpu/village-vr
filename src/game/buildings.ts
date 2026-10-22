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
  /** Nombre maximal de travailleurs */
  workers?: number;
  /** Production par jour à effectif complet */
  produces?: Partial<Resources>;
  /** Puissance défensive contre les bandits (à effectif complet) */
  defense?: number;
}

export type BuildingCategory = 'special' | 'housing' | 'production';

export interface BuildingDef {
  id: BuildingTypeId;
  name: string;
  icon: string;
  description: string;
  category: BuildingCategory;
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
  /** Raccourci clavier dans la barre de construction */
  hotkey?: string;
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
    category: 'special',
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
    description: 'Le vieux moulin du village.',
    category: 'special',
    buildable: false,
    size: 1,
    levels: [{ cost: {} }],
    priority: 99,
    allowedTiles: LAND,
  },

  // ---------- Habitations (débloquées au fil de la croissance) ----------
  {
    id: 'hut',
    name: 'Cabane',
    icon: '🛖',
    description: 'Un abri modeste en bois et chaume.',
    category: 'housing',
    buildable: true,
    size: 1,
    levels: [{ cost: { wood: 6 }, housing: 2 }],
    priority: 99,
    allowedTiles: LAND,
    hotkey: '1',
  },
  {
    id: 'house',
    name: 'Maison',
    icon: '🏠',
    description: 'Maison à colombages.',
    category: 'housing',
    buildable: true,
    size: 1,
    levels: [{ cost: { wood: 12 }, housing: 3, unlock: { population: 6 } }],
    priority: 99,
    allowedTiles: LAND,
    hotkey: '2',
  },
  {
    id: 'townhouse',
    name: 'Maison bourgeoise',
    icon: '🏘️',
    description: 'Deux étages, rez-de-chaussée en pierre.',
    category: 'housing',
    buildable: true,
    size: 1,
    levels: [{ cost: { wood: 22, stone: 12 }, housing: 5, unlock: { population: 15, buildings: { market: 1 } } }],
    priority: 99,
    allowedTiles: LAND,
    hotkey: '3',
  },
  {
    id: 'manor',
    name: 'Manoir',
    icon: '🏛️',
    description: 'Grande demeure avec tourelle et jardin.',
    category: 'housing',
    buildable: true,
    size: 1,
    levels: [{ cost: { wood: 35, stone: 30, gold: 12 }, housing: 8, unlock: { population: 30, buildings: { tower: 1 } } }],
    priority: 99,
    allowedTiles: LAND,
    hotkey: '4',
  },

  // ---------- Production (améliorables niveaux 1 → 3) ----------
  {
    id: 'field',
    name: 'Champ',
    icon: '🌾',
    description: 'Produit de la nourriture (x1,75 sur zone fertile). Rien en hiver.',
    category: 'production',
    buildable: true,
    size: 1,
    levels: [
      { cost: { wood: 5 }, workers: 1, produces: { food: 4 } },
      { cost: { wood: 10, stone: 4 }, workers: 1, produces: { food: 5 }, unlock: UPGRADE_LEVEL_2 },
      { cost: { wood: 18, stone: 10, gold: 4 }, workers: 1, produces: { food: 7 }, unlock: UPGRADE_LEVEL_3 },
    ],
    fertileBonus: 1.75,
    seasonal: true,
    priority: 1,
    allowedTiles: LAND,
    hotkey: '5',
  },
  {
    id: 'lumber',
    name: 'Cabane de bûcheron',
    icon: '🪓',
    description: 'Produit du bois. Doit toucher une forêt.',
    category: 'production',
    buildable: true,
    size: 1,
    levels: [
      { cost: { wood: 10 }, workers: 1, produces: { wood: 3 } },
      { cost: { wood: 15, stone: 5 }, workers: 1, produces: { wood: 5 }, unlock: UPGRADE_LEVEL_2 },
      { cost: { wood: 22, stone: 12, gold: 5 }, workers: 1, produces: { wood: 8 }, unlock: UPGRADE_LEVEL_3 },
    ],
    requiresAdjacent: 'forest',
    priority: 2,
    allowedTiles: LAND,
    hotkey: '6',
  },
  {
    id: 'quarry',
    name: 'Carrière',
    icon: '⛏️',
    description: 'Produit de la pierre. Doit toucher des rochers.',
    category: 'production',
    buildable: true,
    size: 1,
    levels: [
      { cost: { wood: 15 }, workers: 2, produces: { stone: 3 } },
      { cost: { wood: 20, stone: 5 }, workers: 2, produces: { stone: 5 }, unlock: UPGRADE_LEVEL_2 },
      { cost: { wood: 30, stone: 10, gold: 6 }, workers: 2, produces: { stone: 8 }, unlock: UPGRADE_LEVEL_3 },
    ],
    requiresAdjacent: 'rock',
    priority: 3,
    allowedTiles: LAND,
    hotkey: '7',
  },
  {
    id: 'market',
    name: 'Marché',
    icon: '⚖️',
    description: 'Produit de l\'or.',
    category: 'production',
    buildable: true,
    size: 1,
    levels: [
      { cost: { wood: 20, stone: 10 }, workers: 1, produces: { gold: 2 } },
      { cost: { wood: 25, stone: 18 }, workers: 1, produces: { gold: 4 }, unlock: UPGRADE_LEVEL_2 },
      { cost: { wood: 30, stone: 28, gold: 10 }, workers: 1, produces: { gold: 7 }, unlock: UPGRADE_LEVEL_3 },
    ],
    priority: 4,
    allowedTiles: LAND,
    hotkey: '8',
  },
  {
    id: 'tower',
    name: 'Tour de garde',
    icon: '🗼',
    description: 'Réduit les vols des bandits.',
    category: 'production',
    buildable: true,
    size: 1,
    levels: [
      { cost: { wood: 10, stone: 15 }, workers: 1, defense: 1 },
      { cost: { wood: 15, stone: 25 }, workers: 1, defense: 2, unlock: UPGRADE_LEVEL_2 },
      { cost: { wood: 20, stone: 40, gold: 10 }, workers: 1, defense: 3.5, unlock: UPGRADE_LEVEL_3 },
    ],
    priority: 5,
    allowedTiles: LAND,
    hotkey: '9',
  },
];

export const BUILDING_BY_ID: Record<BuildingTypeId, BuildingDef> = Object.fromEntries(
  BUILDINGS.map((b) => [b.id, b]),
) as Record<BuildingTypeId, BuildingDef>;

export const BUILDABLE = BUILDINGS.filter((b) => b.buildable);

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
