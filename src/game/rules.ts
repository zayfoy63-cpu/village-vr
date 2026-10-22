// Règles de base, sans effet de bord : capacité, placement, travailleurs, production.

import { BUILDING_BY_ID, BUILDINGS } from './buildings';
import { FOOD_PER_VILLAGER, RESOURCE_KEYS, seasonOf } from './config';
import { neighbors8, tileAt } from './mapgen';
import type {
  Building,
  BuildingTypeId,
  GameState,
  ModifierId,
  PlacementCheck,
  Resources,
} from './types';

export function emptyResources(): Resources {
  return { food: 0, wood: 0, stone: 0, gold: 0 };
}

export function hasModifier(state: GameState, id: ModifierId): boolean {
  return state.modifiers.some((m) => m.id === id && m.untilDay >= state.day);
}

export function housingCapacity(state: GameState): number {
  return state.buildings.reduce((sum, b) => sum + (BUILDING_BY_ID[b.type].housing ?? 0), 0);
}

export function jobsCapacity(state: GameState): number {
  return state.buildings.reduce((sum, b) => sum + (BUILDING_BY_ID[b.type].workers ?? 0), 0);
}

export function canAfford(res: Resources, cost: Partial<Resources>): boolean {
  return RESOURCE_KEYS.every((k) => res[k] >= (cost[k] ?? 0));
}

export function buildingAt(state: GameState, x: number, z: number): Building | undefined {
  return state.buildings.find((b) => {
    const s = BUILDING_BY_ID[b.type].size;
    return x >= b.x && x < b.x + s && z >= b.z && z < b.z + s;
  });
}

export function canPlace(state: GameState, type: BuildingTypeId, x: number, z: number): PlacementCheck {
  const def = BUILDING_BY_ID[type];
  for (let dz = 0; dz < def.size; dz++) {
    for (let dx = 0; dx < def.size; dx++) {
      const t = tileAt(state.map, x + dx, z + dz);
      if (!t) return { ok: false, reason: 'Hors de la carte' };
      if (!def.allowedTiles.includes(t)) return { ok: false, reason: 'Terrain impossible' };
      if (buildingAt(state, x + dx, z + dz)) return { ok: false, reason: 'Case occupée' };
    }
  }
  if (def.requiresAdjacent) {
    const touches = neighbors8(x, z).some(([nx, nz]) => tileAt(state.map, nx, nz) === def.requiresAdjacent);
    if (!touches) {
      return {
        ok: false,
        reason: def.requiresAdjacent === 'forest' ? 'Doit toucher une forêt' : 'Doit toucher des rochers',
      };
    }
  }
  if (!canAfford(state.resources, def.cost)) return { ok: false, reason: 'Ressources insuffisantes' };
  return { ok: true };
}

/** Répartit la population sur les bâtiments selon leur priorité (mutation) */
export function assignWorkers(state: GameState): void {
  let free = state.population;
  const sorted = [...state.buildings].sort(
    (a, b) => BUILDING_BY_ID[a.type].priority - BUILDING_BY_ID[b.type].priority || a.id - b.id,
  );
  for (const b of sorted) {
    const max = BUILDING_BY_ID[b.type].workers ?? 0;
    const n = Math.min(max, free);
    b.workers = n;
    free -= n;
  }
}

/** Production journalière brute (avant consommation), selon l'état actuel */
export function computeProduction(state: GameState): Resources {
  const out = emptyResources();
  const winter = seasonOf(state.day).id === 'winter';
  const drought = hasModifier(state, 'drought');
  const harvest = hasModifier(state, 'goodHarvest');
  for (const b of state.buildings) {
    const def = BUILDING_BY_ID[b.type];
    if (!def.produces || !def.workers) continue;
    if (def.seasonal && winter) continue;
    let factor = b.workers / def.workers;
    if (def.fertileBonus && tileAt(state.map, b.x, b.z) === 'fertile') factor *= def.fertileBonus;
    if (def.seasonal && drought) factor *= 0.5;
    if (def.seasonal && harvest) factor *= 1.5;
    for (const k of RESOURCE_KEYS) out[k] += (def.produces[k] ?? 0) * factor;
  }
  return out;
}

export function foodConsumption(state: GameState): number {
  const harsh = hasModifier(state, 'harshWinter') ? 1.5 : 1;
  return state.population * FOOD_PER_VILLAGER * harsh;
}

/** Bilan net par jour, utile pour le HUD */
export function computeNet(state: GameState): Resources {
  const p = computeProduction(state);
  p.food -= foodConsumption(state);
  return p;
}

export function defensePower(state: GameState): number {
  return state.buildings.reduce((sum, b) => {
    const def = BUILDING_BY_ID[b.type];
    if (!def.defense || !def.workers) return sum;
    return sum + def.defense * (b.workers / def.workers);
  }, 0);
}

export function score(state: GameState): number {
  const builtValue = state.buildings.filter((b) => BUILDING_BY_ID[b.type].buildable).length;
  return Math.round(
    (state.day - 1) * 10 + state.stats.maxPopulation * 25 + builtValue * 5 + state.stats.eventsSurvived * 8 + state.resources.gold,
  );
}

export function isBuildable(type: BuildingTypeId): boolean {
  return BUILDINGS.some((b) => b.id === type && b.buildable);
}
