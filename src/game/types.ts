// Types partagés par toute la logique de jeu (aucune dépendance React / Three).

export type TileType = 'grass' | 'fertile' | 'forest' | 'rock' | 'water';

export interface GameMap {
  seed: number;
  width: number;
  height: number;
  /** Index = z * width + x */
  tiles: TileType[];
}

export type ResourceKey = 'food' | 'wood' | 'stone' | 'gold';
export type Resources = Record<ResourceKey, number>;

export type BuildingTypeId =
  | 'castle'
  | 'mill'
  | 'house'
  | 'field'
  | 'lumber'
  | 'quarry'
  | 'market'
  | 'tower';

export interface Building {
  id: number;
  type: BuildingTypeId;
  x: number;
  z: number;
  /** Nombre de villageois actuellement affectés */
  workers: number;
  /** Jour de construction */
  builtDay: number;
}

export type ModifierId = 'drought' | 'harshWinter' | 'goodHarvest';

export interface Modifier {
  id: ModifierId;
  /** Dernier jour (inclus) où le modificateur s'applique */
  untilDay: number;
}

export type NoticeKind = 'good' | 'bad' | 'info' | 'trade';

export interface TradeOption {
  label: string;
  give: Partial<Resources>;
  get: Partial<Resources>;
}

export interface Notice {
  id: number;
  day: number;
  kind: NoticeKind;
  icon: string;
  title: string;
  text: string;
  /** Présent uniquement pour une offre de marchand */
  trade?: {
    options: TradeOption[];
    expiresDay: number;
    resolved: boolean;
  };
}

export interface GameStats {
  maxPopulation: number;
  buildingsBuilt: number;
  eventsSurvived: number;
}

export interface GameState {
  version: number;
  seed: number;
  /** État interne du PRNG, sauvegardé pour rester déterministe */
  rngState: number;
  map: GameMap;
  resources: Resources;
  population: number;
  buildings: Building[];
  nextBuildingId: number;
  /** Jour courant (commence à 1) */
  day: number;
  /** Avancement du jour courant, 0..1 */
  dayProgress: number;
  modifiers: Modifier[];
  notices: Notice[];
  nextNoticeId: number;
  nextEventDay: number;
  stats: GameStats;
  gameOver: boolean;
}

export interface PlacementCheck {
  ok: boolean;
  reason?: string;
}
