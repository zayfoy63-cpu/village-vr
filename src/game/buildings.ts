// Tableau de configuration des bâtiments.
// Pour ajouter un bâtiment : ajouter une entrée ici + un modèle 3D dans scene/models.

import type { BuildingTypeId, Resources, TileType } from './types';

export interface BuildingDef {
  id: BuildingTypeId;
  name: string;
  icon: string;
  description: string;
  /** false = bâtiment de départ, absent de la barre de construction */
  buildable: boolean;
  /** Côté de l'emprise au sol en cases */
  size: number;
  cost: Partial<Resources>;
  /** Places d'habitants fournies */
  housing?: number;
  /** Nombre maximal de travailleurs */
  workers?: number;
  /** Production par jour à effectif complet */
  produces?: Partial<Resources>;
  /** Multiplicateur de production si le bâtiment est sur une case fertile */
  fertileBonus?: number;
  /** Ne produit rien en hiver */
  seasonal?: boolean;
  /** Doit toucher (8 voisins) au moins une case de ce type */
  requiresAdjacent?: TileType;
  /** Puissance défensive contre les bandits (à effectif complet) */
  defense?: number;
  /** Ordre d'affectation des travailleurs : plus petit = servi en premier */
  priority: number;
  /** Cases sur lesquelles on peut construire */
  allowedTiles: TileType[];
  /** Raccourci clavier dans la barre de construction */
  hotkey?: string;
}

const LAND: TileType[] = ['grass', 'fertile'];

export const BUILDINGS: BuildingDef[] = [
  {
    id: 'castle',
    name: 'Château',
    icon: '🏰',
    description: 'Le cœur du village. Loge 4 habitants.',
    buildable: false,
    size: 2,
    cost: {},
    housing: 4,
    priority: 99,
    allowedTiles: LAND,
  },
  {
    id: 'mill',
    name: 'Moulin',
    icon: '🌬️',
    description: 'Le vieux moulin du village.',
    buildable: false,
    size: 1,
    cost: {},
    priority: 99,
    allowedTiles: LAND,
  },
  {
    id: 'house',
    name: 'Maison',
    icon: '🏠',
    description: '+3 places d\'habitants.',
    buildable: true,
    size: 1,
    cost: { wood: 12 },
    housing: 3,
    priority: 99,
    allowedTiles: LAND,
    hotkey: '1',
  },
  {
    id: 'field',
    name: 'Champ',
    icon: '🌾',
    description: '+4 nourriture/jour (x1,75 sur zone fertile). Rien en hiver. 1 travailleur.',
    buildable: true,
    size: 1,
    cost: { wood: 5 },
    workers: 1,
    produces: { food: 4 },
    fertileBonus: 1.75,
    seasonal: true,
    priority: 1,
    allowedTiles: LAND,
    hotkey: '2',
  },
  {
    id: 'lumber',
    name: 'Cabane de bûcheron',
    icon: '🪓',
    description: '+3 bois/jour. Doit toucher une forêt. 1 travailleur.',
    buildable: true,
    size: 1,
    cost: { wood: 10 },
    workers: 1,
    produces: { wood: 3 },
    requiresAdjacent: 'forest',
    priority: 2,
    allowedTiles: LAND,
    hotkey: '3',
  },
  {
    id: 'quarry',
    name: 'Carrière',
    icon: '⛏️',
    description: '+3 pierre/jour. Doit toucher des rochers. 2 travailleurs.',
    buildable: true,
    size: 1,
    cost: { wood: 15 },
    workers: 2,
    produces: { stone: 3 },
    requiresAdjacent: 'rock',
    priority: 3,
    allowedTiles: LAND,
    hotkey: '4',
  },
  {
    id: 'market',
    name: 'Marché',
    icon: '⚖️',
    description: '+2 or/jour. 1 travailleur.',
    buildable: true,
    size: 1,
    cost: { wood: 20, stone: 10 },
    workers: 1,
    produces: { gold: 2 },
    priority: 4,
    allowedTiles: LAND,
    hotkey: '5',
  },
  {
    id: 'tower',
    name: 'Tour de garde',
    icon: '🗼',
    description: 'Réduit les vols des bandits. 1 garde.',
    buildable: true,
    size: 1,
    cost: { wood: 10, stone: 15 },
    workers: 1,
    defense: 1,
    priority: 5,
    allowedTiles: LAND,
    hotkey: '6',
  },
];

export const BUILDING_BY_ID: Record<BuildingTypeId, BuildingDef> = Object.fromEntries(
  BUILDINGS.map((b) => [b.id, b]),
) as Record<BuildingTypeId, BuildingDef>;

export const BUILDABLE = BUILDINGS.filter((b) => b.buildable);
