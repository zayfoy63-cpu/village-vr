// Règles de base, sans effet de bord : capacité, placement, niveaux, déblocages, production.

import {
  BUILDING_BY_ID,
  BUILDINGS,
  buildCost,
  levelDef,
  maxLevel,
  unlockKey,
  type LevelDef,
  type UnlockCondition,
} from './buildings';
import { DAMAGED_FACTOR, FOOD_PER_VILLAGER, MORALE, REPAIR_COST_RATIO, RESOURCE_KEYS, RESOURCE_META, seasonOf } from './config';
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

/** Caractéristiques actuelles d'un bâtiment, selon son niveau */
export function statsOf(b: Building): LevelDef {
  return levelDef(b.type, b.level);
}

export function housingCapacity(state: GameState): number {
  return state.buildings.reduce((sum, b) => sum + (statsOf(b).housing ?? 0), 0);
}

export function jobsCapacity(state: GameState): number {
  return state.buildings.reduce((sum, b) => sum + (statsOf(b).workers ?? 0), 0);
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

// ---------- Déblocages ----------

export function countBuildings(state: GameState, type: BuildingTypeId): number {
  return state.buildings.filter((b) => b.type === type).length;
}

export function conditionMet(state: GameState, cond: UnlockCondition | undefined): boolean {
  if (!cond) return true;
  if (cond.population && state.population < cond.population) return false;
  for (const [type, n] of Object.entries(cond.buildings ?? {})) {
    if (countBuildings(state, type as BuildingTypeId) < (n ?? 0)) return false;
  }
  return true;
}

/** Texte lisible d'une condition, ex. "15 habitants + 1 marché" */
export function conditionLabel(cond: UnlockCondition | undefined): string {
  if (!cond) return '';
  const parts: string[] = [];
  if (cond.population) parts.push(`${cond.population} habitants`);
  for (const [type, n] of Object.entries(cond.buildings ?? {})) {
    parts.push(`${n} ${BUILDING_BY_ID[type as BuildingTypeId].name.toLowerCase()}`);
  }
  return parts.join(' + ');
}

export function isUnlocked(state: GameState, type: BuildingTypeId, level = 1): boolean {
  const cond = levelDef(type, level).unlock;
  return !cond || state.unlocked.includes(unlockKey(type, level));
}

/** Nouvelles clés débloquées par l'état actuel (sans modifier l'état) */
export function findNewUnlocks(state: GameState): { type: BuildingTypeId; level: number }[] {
  const out: { type: BuildingTypeId; level: number }[] = [];
  for (const def of BUILDINGS) {
    if (!def.buildable) continue;
    def.levels.forEach((lvl, i) => {
      const level = i + 1;
      if (!lvl.unlock || state.unlocked.includes(unlockKey(def.id, level))) return;
      if (conditionMet(state, lvl.unlock)) out.push({ type: def.id, level });
    });
  }
  return out;
}

// ---------- Construction / amélioration ----------

export function canPlace(state: GameState, type: BuildingTypeId, x: number, z: number): PlacementCheck {
  const def = BUILDING_BY_ID[type];
  if (!isUnlocked(state, type)) {
    return { ok: false, reason: `🔒 Requiert ${conditionLabel(def.levels[0].unlock)}` };
  }
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
  if (!canAfford(state.resources, buildCost(type))) return { ok: false, reason: 'Ressources insuffisantes' };
  return { ok: true };
}

export interface UpgradeCheck extends PlacementCheck {
  /** Niveau visé (absent si déjà au maximum) */
  next?: LevelDef;
  locked?: boolean;
}

export function canUpgrade(state: GameState, b: Building): UpgradeCheck {
  if (b.level >= maxLevel(b.type)) return { ok: false, reason: 'Niveau maximum atteint' };
  const next = levelDef(b.type, b.level + 1);
  if (!isUnlocked(state, b.type, b.level + 1)) {
    return { ok: false, next, locked: true, reason: `🔒 Requiert ${conditionLabel(next.unlock)}` };
  }
  if (!canAfford(state.resources, next.cost)) return { ok: false, next, reason: 'Ressources insuffisantes' };
  return { ok: true, next };
}

// ---------- Travail et production ----------

/** Villageois mobilisés pour éteindre des incendies (ne travaillent pas) */
export function busyCrew(state: GameState): number {
  return state.buildings.reduce((sum, b) => sum + (b.fire?.crew ?? 0), 0);
}

/** Facteur d'état d'un bâtiment : endommagé ou en feu = production réduite */
export function conditionFactor(b: Building): number {
  if (b.fire) return 0;
  return b.damaged ? DAMAGED_FACTOR : 1;
}

/** Facteur de production dû au moral (1 au-dessus du seuil, jusqu'à 0,6 à 0) */
export function moraleFactor(state: GameState): number {
  const m = state.morale ?? MORALE.start;
  if (m >= MORALE.lowProduction) return 1;
  return 0.6 + 0.4 * (Math.max(0, m) / MORALE.lowProduction);
}

/** Facteur global de production : moral et quarantaine */
export function globalProductionFactor(state: GameState): number {
  return moraleFactor(state) * (hasModifier(state, 'quarantine') ? 0.6 : 1);
}

export function storageCapacity(state: GameState): number {
  return state.buildings.reduce((sum, b) => sum + (b.damaged ? 0.5 : 1) * (statsOf(b).storage ?? 0), 0);
}

export function repairCost(b: Building): Partial<Resources> {
  const base = levelDef(b.type, 1).cost;
  const out: Partial<Resources> = {};
  for (const k of RESOURCE_KEYS) if (base[k]) out[k] = Math.ceil(base[k]! * REPAIR_COST_RATIO * (1 + (b.level - 1) * 0.5));
  if (!Object.keys(out).length) out.wood = 5;
  return out;
}

/** Répartit la population sur les bâtiments selon leur priorité (mutation) */
export function assignWorkers(state: GameState): void {
  let free = Math.max(0, state.population - busyCrew(state));
  const sorted = [...state.buildings].sort(
    (a, b) => BUILDING_BY_ID[a.type].priority - BUILDING_BY_ID[b.type].priority || a.id - b.id,
  );
  for (const b of sorted) {
    const n = Math.min(statsOf(b).workers ?? 0, free);
    b.workers = n;
    free -= n;
  }
}

/** Production d'un bâtiment à effectif complet, hors saison et événements (bonus fertile inclus) */
export function nominalProduction(state: GameState, b: Building, level = b.level): Partial<Resources> {
  const def = BUILDING_BY_ID[b.type];
  const produces = levelDef(b.type, level).produces ?? {};
  const fertile = def.fertileBonus && tileAt(state.map, b.x, b.z) === 'fertile' ? def.fertileBonus : 1;
  const out: Partial<Resources> = {};
  for (const k of RESOURCE_KEYS) if (produces[k]) out[k] = Math.round(produces[k]! * fertile * 10) / 10;
  return out;
}

/** Production journalière brute (avant consommation), selon l'état actuel */
export function computeProduction(state: GameState): Resources {
  const out = emptyResources();
  const winter = seasonOf(state.day).id === 'winter';
  const drought = hasModifier(state, 'drought');
  const harvest = hasModifier(state, 'goodHarvest');
  const blight = hasModifier(state, 'blight');
  const global = globalProductionFactor(state);
  for (const b of state.buildings) {
    const def = BUILDING_BY_ID[b.type];
    const stats = statsOf(b);
    if (!stats.produces || !stats.workers) continue;
    if (def.seasonal && winter) continue;
    let factor = (b.workers / stats.workers) * conditionFactor(b) * global;
    if (def.fertileBonus && tileAt(state.map, b.x, b.z) === 'fertile') factor *= def.fertileBonus;
    if (def.seasonal && drought) factor *= 0.5;
    if (def.seasonal && harvest) factor *= 1.5;
    if (def.seasonal && blight) factor *= 0.4;
    for (const k of RESOURCE_KEYS) out[k] += (stats.produces[k] ?? 0) * factor;
  }
  return out;
}

export function foodConsumption(state: GameState): number {
  const harsh = hasModifier(state, 'harshWinter') ? 2 : 1;
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
    const stats = statsOf(b);
    if (!stats.defense || !stats.workers) return sum;
    return sum + stats.defense * (b.workers / stats.workers) * conditionFactor(b);
  }, 0);
}

/** Effet d'un niveau en texte court : "+4 🍞/jour", "+3 places", "Défense +2" */
export function effectLabel(lvl: LevelDef, produces: Partial<Resources> = lvl.produces ?? {}): string {
  const parts: string[] = [];
  if (lvl.housing) parts.push(`+${lvl.housing} places`);
  for (const k of RESOURCE_KEYS) {
    if (produces[k]) parts.push(`+${produces[k]} ${RESOURCE_META[k].icon}/jour`);
  }
  if (lvl.defense) parts.push(`Défense +${lvl.defense}`);
  if (lvl.storage) parts.push(`Protège ${lvl.storage} ${RESOURCE_META.food.icon}`);
  return parts.join(' · ');
}

export function score(state: GameState): number {
  const builtValue = state.buildings.filter((b) => BUILDING_BY_ID[b.type].buildable).length;
  return Math.round(
    (state.day - 1) * 10 +
      state.stats.maxPopulation * 25 +
      builtValue * 5 +
      state.stats.upgrades * 5 +
      state.stats.eventsSurvived * 8 +
      state.resources.gold,
  );
}
