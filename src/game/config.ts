import type { Resources } from './types';

export const MAP_WIDTH = 20;
export const MAP_HEIGHT = 14;

/** Durée d'un jour en secondes réelles (vitesse x1) */
export const DAY_DURATION_SEC = 20;
export const DAYS_PER_SEASON = 10;

export const START_POPULATION = 3;
export const START_RESOURCES: Resources = { food: 10, wood: 20, stone: 0, gold: 0 };

/** Nourriture mangée par villageois et par jour */
export const FOOD_PER_VILLAGER = 1;

/** Moral : règles de base (les variations dues aux événements sont dans events.ts) */
export const MORALE = {
  start: 70,
  /** Valeur vers laquelle le moral tend chaque jour, avant bonus / malus */
  base: 58,
  /** Part de l'écart à la cible rattrapée chaque jour */
  drift: 0.2,
  /** Bonus si les réserves couvrent au moins 3 jours de repas */
  fedBonus: 10,
  /** Malus le jour où la nourriture manque */
  hungerPenalty: 25,
  /** Malus par habitant sans logement (plafonné à 20) */
  overcrowdPenalty: 3,
  /** Bonus par marché en activité (plafonné à 15) */
  marketBonus: 5,
  /** Bonus par tour de garde en service (sécurité, plafonné à 6) */
  towerBonus: 2,
  /** Malus par bâtiment endommagé (plafonné à 15) */
  damagedPenalty: 2,
  /** Sous ce seuil, la production baisse (jusqu'à -40 % à 0) */
  lowProduction: 40,
  /** Sous ce seuil, des habitants partent chaque jour */
  leaveBelow: 25,
  /** Part de la population qui part chaque jour sous le seuil */
  leaveRatio: 0.08,
  /** Sous ce seuil : révolte */
  revoltBelow: 10,
  /** Pas de nouveaux habitants sous ce seuil */
  growthMin: 40,
};

/** Bâtiment endommagé : production / défense multipliée par ce facteur */
export const DAMAGED_FACTOR = 0.5;
/** Coût de réparation = cette part du coût de construction (arrondi au supérieur) */
export const REPAIR_COST_RATIO = 0.5;

export const SAVE_KEY = 'village-vr-save-v1';
export const SAVE_VERSION = 4;

export type SeasonId = 'spring' | 'summer' | 'autumn' | 'winter';

export interface SeasonDef {
  id: SeasonId;
  name: string;
  icon: string;
}

export const SEASONS: SeasonDef[] = [
  { id: 'spring', name: 'Printemps', icon: '🌱' },
  { id: 'summer', name: 'Été', icon: '☀️' },
  { id: 'autumn', name: 'Automne', icon: '🍂' },
  { id: 'winter', name: 'Hiver', icon: '❄️' },
];

export function seasonOf(day: number): SeasonDef {
  return SEASONS[Math.floor((day - 1) / DAYS_PER_SEASON) % SEASONS.length];
}

export function dayInSeason(day: number): number {
  return ((day - 1) % DAYS_PER_SEASON) + 1;
}

export function yearOf(day: number): number {
  return Math.floor((day - 1) / (DAYS_PER_SEASON * SEASONS.length)) + 1;
}

/** Index de la saison depuis le début de la partie (0 = premier printemps) */
export function seasonIndex(day: number): number {
  return Math.floor((day - 1) / DAYS_PER_SEASON);
}

export const RESOURCE_META: Record<keyof Resources, { name: string; icon: string }> = {
  food: { name: 'Nourriture', icon: '🍞' },
  wood: { name: 'Bois', icon: '🪵' },
  stone: { name: 'Pierre', icon: '🪨' },
  gold: { name: 'Or', icon: '🪙' },
};

export const RESOURCE_KEYS: (keyof Resources)[] = ['food', 'wood', 'stone', 'gold'];
