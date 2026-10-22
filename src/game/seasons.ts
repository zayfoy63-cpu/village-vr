// Saisons à double effet. Rien de tout cela n'est affiché au joueur : il le découvre par le décor
// (couleurs, pluie, neige) et par les résultats (récoltes, stocks, événements).

import { seasonOf, type SeasonId } from './config';
import type { Rng } from './rng';
import type { Building, BuildingTypeId, GameState } from './types';

export interface SeasonEffect {
  /** Multiplicateur de production des cultures (0 = rien ne pousse) */
  crops: number;
  /** Multiplicateur d'extraction (carrières, mines) */
  extraction: number;
  /** Chance qu'il pleuve chaque jour (les pluies successives font gonfler la rivière) */
  rainChance: number;
  /** Multiplicateurs de probabilité des imprévus (id d'événement → facteur) */
  events: Record<string, number>;
}

export const SEASON_EFFECTS: Record<SeasonId, SeasonEffect> = {
  // Croissance des champs, mais pluies → crues
  spring: { crops: 1.15, extraction: 1, rainChance: 0.5, events: { storm: 1.3, drought: 0.4 } },
  // Récoltes au maximum, mais sécheresse et incendies
  summer: { crops: 1.35, extraction: 1, rainChance: 0.08, events: { drought: 2.2, fire: 1.8, storm: 1.2 } },
  // Récolte bonus et marchands de passage… mais l'hiver approche
  autumn: { crops: 1.2, extraction: 1, rainChance: 0.3, events: { merchant: 3, refugees: 1.3, drought: 0.5 } },
  // Rien ne pousse et il faut se chauffer, mais pierre et fer sortent plus vite, et les bandits se terrent
  winter: { crops: 0, extraction: 1.4, rainChance: 0, events: { bandits: 0.35, drought: 0, goodHarvest: 0, storm: 0.5 } },
};

const EXTRACTION: BuildingTypeId[] = ['quarry', 'mine'];

export function seasonEffect(state: GameState): SeasonEffect {
  return SEASON_EFFECTS[seasonOf(state.day).id];
}

/** Facteur saisonnier de production d'un bâtiment */
export function seasonFactor(state: GameState, b: Building, seasonal: boolean): number {
  const e = seasonEffect(state);
  if (seasonal) return e.crops;
  if (EXTRACTION.includes(b.type)) return e.extraction;
  return 1;
}

/** Facteur saisonnier sur le tirage d'un imprévu */
export function seasonEventWeight(state: GameState, eventId: string): number {
  return seasonEffect(state).events[eventId] ?? 1;
}

/** Météo du nouveau jour (mutation) */
export function rollWeather(state: GameState, rng: Rng) {
  const rain = rng.chance(seasonEffect(state).rainChance);
  state.mech.rain = rain;
  state.mech.rainStreak = rain ? state.mech.rainStreak + 1 : 0;
}

/** Nuit : fin de journée (plus tôt en hiver). Affichage (lumière) et loups. */
export const NIGHT = {
  /** Avancement du jour où la nuit commence */
  from: 0.8,
  winterFrom: 0.68,
  /** Durée du crépuscule (avancement) */
  dusk: 0.08,
};

/** Niveau de nuit 0 (plein jour) → 1 (nuit noire) */
export function nightLevel(day: number, progress: number): number {
  const from = seasonOf(day).id === 'winter' ? NIGHT.winterFrom : NIGHT.from;
  if (progress < from) return 0;
  return Math.min(1, (progress - from) / NIGHT.dusk);
}
