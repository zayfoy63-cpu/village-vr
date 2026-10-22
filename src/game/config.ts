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

/** Premier jour possible pour un événement aléatoire */
export const FIRST_EVENT_DAY = 4;

export const SAVE_KEY = 'village-vr-save-v1';
export const SAVE_VERSION = 2;

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

/** Facteur de difficulté qui augmente avec le temps (1 au départ) */
export function difficulty(day: number): number {
  return 1 + day / 30;
}

export const RESOURCE_META: Record<keyof Resources, { name: string; icon: string }> = {
  food: { name: 'Nourriture', icon: '🍞' },
  wood: { name: 'Bois', icon: '🪵' },
  stone: { name: 'Pierre', icon: '🪨' },
  gold: { name: 'Or', icon: '🪙' },
};

export const RESOURCE_KEYS: (keyof Resources)[] = ['food', 'wood', 'stone', 'gold'];
