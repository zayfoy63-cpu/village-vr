// Données du HUD (ressources, population, moral, date) calculées une fois pour toutes les interfaces.

import { useShallow } from 'zustand/react/shallow';
import {
  ADVANCED_RESOURCES,
  BASE_RESOURCES,
  DAYS_PER_SEASON,
  MORALE,
  RESOURCE_META,
  dayInSeason,
  seasonOf,
} from '../game/config';
import { computeNet, housingCapacity, injuredCount, jobsCapacity } from '../game/rules';
import type { ResourceKey } from '../game/types';
import { useGame } from '../store/gameStore';

export interface ResourceChip {
  key: ResourceKey;
  icon: string;
  name: string;
  value: number;
  net: number;
}

export interface HudModel {
  base: ResourceChip[];
  advanced: ResourceChip[];
  population: number;
  capacity: number;
  jobs: number;
  working: number;
  injured: number;
  morale: number;
  moraleEmoji: string;
  seasonIcon: string;
  seasonName: string;
  dayInSeason: number;
  daysPerSeason: number;
  day: number;
}

export function moraleEmoji(m: number): string {
  if (m < MORALE.revoltBelow) return '🤬';
  if (m < MORALE.leaveBelow) return '😠';
  if (m < MORALE.lowProduction) return '😟';
  if (m < 70) return '🙂';
  return '😄';
}

/** Re-calculé seulement quand ressources, bâtiments, population ou jour changent (pas à chaque image) */
export function useHudModel(): HudModel {
  const data = useGameData();
  const game = useGame.getState().game;
  const net = computeNet(game);
  const chip = (k: ResourceKey): ResourceChip => ({ key: k, icon: RESOURCE_META[k].icon, name: RESOURCE_META[k].name, value: Math.floor(data.resources[k]), net: net[k] });
  const season = seasonOf(data.day);
  const jobs = jobsCapacity(game);
  return {
    base: BASE_RESOURCES.map(chip),
    advanced: ADVANCED_RESOURCES.filter((k) => data.discovered.includes(k)).map(chip),
    population: data.population,
    capacity: housingCapacity(game),
    jobs,
    working: Math.min(data.population, jobs),
    injured: injuredCount(game),
    morale: Math.round(data.morale),
    moraleEmoji: moraleEmoji(data.morale),
    seasonIcon: season.icon,
    seasonName: season.name,
    dayInSeason: dayInSeason(data.day),
    daysPerSeason: DAYS_PER_SEASON,
    day: data.day,
  };
}

function useGameData() {
  return useGame(
    useShallow((s) => ({
      resources: s.game.resources,
      population: s.game.population,
      buildings: s.game.buildings,
      day: s.game.day,
      discovered: s.game.discovered,
      morale: s.game.morale,
      injuries: s.game.injuries,
    })),
  );
}
