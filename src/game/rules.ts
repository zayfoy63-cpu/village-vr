// Règles de base, sans effet de bord : capacité, placement, niveaux, déblocages, production.

import {
  BUILDING_BY_ID,
  BUILDINGS,
  CHAINS,
  buildCost,
  levelDef,
  maxLevel,
  unlockKey,
  type LevelDef,
  type UnlockCondition,
} from './buildings';
import { DAMAGED_FACTOR, FOOD_PER_VILLAGER, MORALE, REPAIR_COST_RATIO, RESOURCE_KEYS, RESOURCE_META } from './config';
import { difficultyOf } from './difficulty';
import { TUNING } from './events';
import { neighbors8, tileAt } from './mapgen';
import { heatingNeed } from './mechanics/cold';
import { isForest, lumberForestFactor } from './mechanics/deforestation';
import { diseaseFactor } from './mechanics/disease';
import { riversideFactor } from './mechanics/flood';
import { soilFactor } from './mechanics/soil';
import { seasonEffect, seasonFactor } from './seasons';
import { feedNeed, leanFactor, sheepFeedNeed, SHEEP } from './sheep';
import { featureAt, ownsTile } from './parcels';
import type {
  Building,
  BuildingTypeId,
  GameState,
  ModifierId,
  PlacementCheck,
  Resources,
} from './types';
import { I } from '../ui/icons';

export function emptyResources(): Resources {
  return { food: 0, wood: 0, stone: 0, gold: 0, flour: 0, bread: 0, planks: 0, ironOre: 0, tools: 0, weapons: 0, wool: 0 };
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
    return { ok: false, reason: `${I.lock} Requiert ${conditionLabel(def.levels[0].unlock)}` };
  }
  for (let dz = 0; dz < def.size; dz++) {
    for (let dx = 0; dx < def.size; dx++) {
      const t = tileAt(state.map, x + dx, z + dz);
      if (!t) return { ok: false, reason: 'Hors de la carte' };
      if (!ownsTile(state, x + dx, z + dz)) return { ok: false, reason: 'Parcelle non achetée : cliquez dessus pour l\'acheter' };
      const feature = featureAt(state, x + dx, z + dz);
      if (feature) return { ok: false, reason: feature.type === 'camp' ? 'Camp de bandits à détruire' : 'Ruines à déblayer' };
      if (!def.allowedTiles.includes(t)) return { ok: false, reason: 'Terrain impossible' };
      if (buildingAt(state, x + dx, z + dz)) return { ok: false, reason: 'Case occupée' };
    }
  }
  if (def.requiresAdjacent) {
    // Une forêt rasée (souches) ne compte plus
    const touches = neighbors8(x, z).some(([nx, nz]) =>
      def.requiresAdjacent === 'forest' ? isForest(state, nx, nz) : tileAt(state.map, nx, nz) === def.requiresAdjacent,
    );
    if (!touches) {
      const what = { forest: 'une forêt', rock: 'des rochers', water: 'l\'eau' } as Partial<Record<string, string>>;
      return { ok: false, reason: `Doit toucher ${what[def.requiresAdjacent] ?? 'le bon terrain'}` };
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
    return { ok: false, next, locked: true, reason: `${I.lock} Requiert ${conditionLabel(next.unlock)}` };
  }
  if (!canAfford(state.resources, next.cost)) return { ok: false, next, reason: 'Ressources insuffisantes' };
  return { ok: true, next };
}

// ---------- Travail et production ----------

/** Villageois mobilisés pour éteindre des incendies (ne travaillent pas) */
export function busyCrew(state: GameState): number {
  const crews = state.buildings.reduce((sum, b) => sum + (b.fire?.crew ?? 0), 0);
  return crews + injuredCount(state);
}

/** Villageois blessés (ne travaillent pas en attendant de guérir) */
export function injuredCount(state: GameState): number {
  return (state.injuries ?? []).reduce((n, i) => n + (i.untilDay >= state.day ? i.count : 0), 0);
}

/** Filet de sécurité du bois : sans bûcheron possible, les villageois sans travail ramassent du bois mort */
export const WOOD_SAFETY = {
  /** Bois par jour et par villageois (lent : il faut des jours pour retrouver de quoi bâtir) */
  perVillager: 0.5,
  /** Villageois mobilisés au plus */
  maxGatherers: 3,
};

/**
 * Le joueur a-t-il encore un moyen d'obtenir du bois ? Oui s'il a un bûcheron au travail devant une
 * forêt vivante, ou s'il peut en construire un (assez de bois et une case qui touche une forêt).
 */
export function hasWoodSource(state: GameState): boolean {
  if (state.buildings.some((b) => b.type === 'lumber' && b.workers > 0 && !b.fire && !b.paused && lumberForestFactor(state, b) > 0)) return true;
  if ((state.resources.wood ?? 0) < (buildCost('lumber').wood ?? 0)) return false;
  for (let z = 0; z < state.map.height; z++)
    for (let x = 0; x < state.map.width; x++) if (canPlace(state, 'lumber', x, z).ok) return true;
  return false;
}

/** Bois ramassé aujourd'hui par le filet de sécurité (0 si le joueur a d'autres moyens) */
export function woodSafetyGain(state: GameState): number {
  if (state.population <= 0 || hasWoodSource(state)) return 0;
  const working = state.buildings.reduce((n, b) => n + b.workers, 0);
  const idle = Math.max(0, state.population - busyCrew(state) - working);
  // Même sans villageois libre, un travailleur quitte son poste le temps de ramasser du bois mort
  const gatherers = Math.min(WOOD_SAFETY.maxGatherers, Math.max(1, idle));
  return gatherers * WOOD_SAFETY.perVillager;
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
  return (
    moraleFactor(state) *
    diseaseFactor(state) *
    (hasModifier(state, 'quarantine') ? 0.6 : 1) *
    (hasModifier(state, 'sheltered') ? TUNING.storm.shelterProduction : 1)
  );
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

/** Transformateur à l'arrêt car tous ses produits sont au plafond de stock */
export function isCapped(state: GameState, b: Building): boolean {
  const lvl = statsOf(b);
  if (!lvl.consumes || !lvl.produces) return false;
  const outs = RESOURCE_KEYS.filter((k) => lvl.produces![k]);
  return outs.length > 0 && outs.every((k) => CHAINS.stockCap[k] !== undefined && (state.resources[k] ?? 0) >= CHAINS.stockCap[k]!);
}

/**
 * Bâtiment inactif : pause joueur, stock plein, ou pas encore débloqué (ex. le moulin de départ
 * avant 8 habitants). Il n'emploie personne et ne produit rien.
 */
export function isIdle(state: GameState, b: Building): boolean {
  return !!b.paused || !!b.moving || isDormant(state, b) || isCapped(state, b) || !isUnlocked(state, b.type, b.level);
}

/** Bâtiment saisonnier hors saison (champ en hiver) : il ne produit rien et ne garde personne */
export function isDormant(state: GameState, b: Building): boolean {
  return !!BUILDING_BY_ID[b.type].seasonal && seasonEffect(state).crops <= 0;
}

/** Part d'une journée de matières premières en dessous de laquelle un transformateur est « à sec » */
const STARVED_BELOW = 0.25;

/** Matières premières manquantes d'un transformateur pour tourner à plein (stock en dessous du quart d'une journée) */
export function inputShortage(stock: Resources, lvl: LevelDef): (keyof Resources)[] {
  return RESOURCE_KEYS.filter((k) => (lvl.consumes?.[k] ?? 0) > 0 && (stock[k] ?? 0) < (lvl.consumes![k] ?? 0) * STARVED_BELOW);
}

/** Répartit la population sur les bâtiments selon leur priorité (mutation) */
export function assignWorkers(state: GameState): void {
  let free = Math.max(0, state.population - busyCrew(state));
  const sorted = [...state.buildings].sort(
    (a, b) => BUILDING_BY_ID[a.type].priority - BUILDING_BY_ID[b.type].priority || a.id - b.id,
  );
  // Prévision des stocks de la journée : les producteurs servis avant un transformateur lui fournissent sa matière
  const supply: Resources = { ...emptyResources(), ...state.resources };
  for (const b of sorted) {
    const stats = statsOf(b);
    let n = isIdle(state, b) ? 0 : Math.min(stats.workers ?? 0, free);
    // Un transformateur à sec ne garde pas de travailleurs : ils vont là où ils servent
    if (n > 0 && stats.consumes && inputShortage(supply, stats).length) n = 0;
    b.workers = n;
    free -= n;
    if (n > 0 && stats.workers) {
      const f = (n / stats.workers) * seasonFactor(state, b, !!BUILDING_BY_ID[b.type].seasonal);
      for (const k of RESOURCE_KEYS) supply[k] += ((stats.produces?.[k] ?? 0) - (stats.consumes?.[k] ?? 0)) * f;
    }
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

/** État de marche d'un bâtiment pendant la journée */
export interface BuildingRun {
  /** Part de la production réellement atteinte (0 = à l'arrêt) */
  ratio: number;
  /** Raison de l'arrêt complet (alerte au-dessus du bâtiment) */
  blocked: 'workers' | 'input' | null;
  /** Matières premières manquantes (bâtiment de transformation) */
  missing: (keyof Resources)[];
  /** Équipé d'outils aujourd'hui */
  equipped: boolean;
  /** Matières consommées et produites aujourd'hui par ce bâtiment */
  used: Partial<Resources>;
  made: Partial<Resources>;
}

export interface ProductionReport {
  produced: Resources;
  consumed: Resources;
  status: Map<number, BuildingRun>;
}

/**
 * Simule la production d'une journée : d'abord les producteurs de base (éventuellement équipés
 * d'outils), puis les transformateurs par ordre de priorité, qui puisent dans le stock disponible.
 */
export function simulateProduction(state: GameState): ProductionReport {
  const produced = emptyResources();
  const consumed = emptyResources();
  const status = new Map<number, BuildingRun>();
  const stock: Resources = { ...emptyResources(), ...state.resources };
  const drought = hasModifier(state, 'drought');
  const harvest = hasModifier(state, 'goodHarvest');
  const blight = hasModifier(state, 'blight');
  const global = globalProductionFactor(state);
  const T = CHAINS.tools;

  // Outils : les bâtiments équipables en activité se partagent le stock d'outils
  const equippable = state.buildings.filter((b) => T.equips.includes(b.type) && b.workers > 0 && !b.fire);
  const toolsNeed = equippable.length * T.wearPerBuilding;
  const toolsRatio = toolsNeed > 0 ? Math.min(1, (stock.tools ?? 0) / toolsNeed) : 0;
  if (toolsNeed > 0) {
    consumed.tools += toolsNeed * toolsRatio;
    stock.tools -= toolsNeed * toolsRatio;
  }

  const baseFactor = (b: Building, stats: LevelDef) => {
    const def = BUILDING_BY_ID[b.type];
    if (!stats.workers) return 0;
    let f = (b.workers / stats.workers) * conditionFactor(b) * global;
    if (def.fertileBonus && tileAt(state.map, b.x, b.z) === 'fertile') f *= def.fertileBonus;
    // Saisons (cultures, extraction), sol épuisé, bord de l'eau, forêt abattue : effets cachés
    f *= seasonFactor(state, b, !!def.seasonal);
    if (b.type === 'field') f *= soilFactor(b) * riversideFactor(state, b);
    if (b.type === 'lumber') f *= lumberForestFactor(state, b);
    if (b.type === 'sheepfold') f *= leanFactor(b);
    if (def.seasonal && drought) f *= 0.5;
    if (def.seasonal && harvest) f *= 1.5;
    if (def.seasonal && blight) f *= 0.4;
    return f;
  };

  const producers = state.buildings.filter((b) => statsOf(b).produces && !statsOf(b).consumes);
  const processors = state.buildings
    .filter((b) => statsOf(b).produces && statsOf(b).consumes)
    .sort((a, b) => BUILDING_BY_ID[a.type].priority - BUILDING_BY_ID[b.type].priority || a.id - b.id);

  for (const b of producers) {
    const stats = statsOf(b);
    const equipped = T.equips.includes(b.type) && b.workers > 0 && toolsRatio > 0;
    const f = baseFactor(b, stats) * (equipped ? 1 + T.bonus * toolsRatio : 1);
    const made: Partial<Resources> = {};
    for (const k of RESOURCE_KEYS) {
      const q = (stats.produces![k] ?? 0) * f;
      produced[k] += q;
      stock[k] += q;
      if (q > 0) made[k] = q;
    }
    status.set(b.id, {
      ratio: f > 0 ? 1 : 0,
      blocked: stats.workers && b.workers === 0 && !isIdle(state, b) ? 'workers' : null,
      missing: [],
      equipped,
      used: {},
      made,
    });
  }

  for (const b of processors) {
    const stats = statsOf(b);
    const f = baseFactor(b, stats);
    let ratio = 1;
    const missing: (keyof Resources)[] = [];
    for (const k of RESOURCE_KEYS) {
      const need = (stats.consumes![k] ?? 0) * f;
      if (need <= 0) continue;
      const r = Math.min(1, Math.max(0, stock[k]) / need);
      if (r < 1) missing.push(k);
      ratio = Math.min(ratio, r);
    }
    const used: Partial<Resources> = {};
    const made: Partial<Resources> = {};
    for (const k of RESOURCE_KEYS) {
      const use = (stats.consumes![k] ?? 0) * f * ratio;
      consumed[k] += use;
      stock[k] -= use;
      const out = (stats.produces![k] ?? 0) * f * ratio;
      produced[k] += out;
      stock[k] += out;
      if (use > 0) used[k] = use;
      if (out > 0) made[k] = out;
    }
    // Sans travailleur, on distingue « personne » de « à sec » (les travailleurs quittent un transformateur sans matière)
    const noWorkers = !!stats.workers && b.workers === 0 && !isIdle(state, b);
    const dry = noWorkers ? inputShortage(stock, stats) : [];
    status.set(b.id, {
      ratio: f > 0 ? ratio : 0,
      blocked: dry.length ? 'input' : noWorkers ? 'workers' : f > 0 && ratio <= 0.001 ? 'input' : null,
      missing: dry.length ? dry : missing,
      equipped: false,
      used,
      made,
    });
  }
  produced.wood += woodSafetyGain(state);
  return { produced, consumed, status };
}

export type StopKind = 'paused' | 'moving' | 'locked' | 'season' | 'capped' | 'fire' | 'workers' | 'input';

/** Ce que le joueur doit savoir d'un bâtiment de production ou de transformation : entrées, sorties, raison d'arrêt */
export interface ChainReport {
  /** Transformateur : stock d'entrée et besoin par jour à plein effectif */
  inputs: { key: keyof Resources; have: number; perDay: number }[];
  /** Production d'aujourd'hui, par jour, au rythme actuel */
  outputs: { key: keyof Resources; perDay: number }[];
  /** Part de la production nominale réellement atteinte */
  ratio: number;
  /** Arrêt complet et sa raison exacte (texte à afficher) */
  stop: { kind: StopKind; text: string } | null;
  /** Marche réduite : pourquoi */
  slow: string | null;
}

const resName = (k: keyof Resources) => RESOURCE_META[k].short.toLowerCase();
const round1 = (n: number) => Math.round(n * 10) / 10;

export function chainReport(state: GameState, b: Building, run = simulateProduction(state).status.get(b.id)): ChainReport {
  const stats = statsOf(b);
  const stock = state.resources;
  const inputs = RESOURCE_KEYS.filter((k) => stats.consumes?.[k]).map((k) => ({ key: k, have: Math.floor(stock[k] ?? 0), perDay: stats.consumes![k]! }));
  // Bergerie : en hiver, le troupeau mange du blé (comptée comme entrée)
  const feed = feedNeed(state, b);
  if (feed > 0) inputs.push({ key: 'food', have: Math.floor(stock.food ?? 0), perDay: feed });
  const outputs = RESOURCE_KEYS.filter((k) => run?.made[k]).map((k) => ({ key: k, perDay: round1(run!.made[k]!) }));
  const ratio = run?.ratio ?? 0;
  const out: ChainReport = { inputs, outputs, ratio, stop: null, slow: null };
  const stop = (kind: StopKind, text: string) => {
    out.stop = { kind, text };
    return out;
  };
  if (b.fire) return stop('fire', "En feu : ne produit plus rien tant que le feu n'est pas éteint.");
  if (b.moving) return stop('moving', "Soulevé : en pause jusqu'à ce qu'on le repose.");
  if (b.paused) return stop('paused', "Mis à l'arrêt : ses travailleurs sont affectés ailleurs.");
  if (!isUnlocked(state, b.type, b.level)) {
    return stop('locked', `Pas encore en service : il faut ${conditionLabel(levelDef(b.type, b.level).unlock)} (le village en compte ${state.population}).`);
  }
  if (isDormant(state, b)) return stop('season', 'Hors saison : rien ne pousse en hiver. Le bâtiment dort et libère ses travailleurs.');
  if (isCapped(state, b)) {
    const full = RESOURCE_KEYS.filter((k) => stats.produces?.[k]).map((k) => `${Math.floor(stock[k] ?? 0)} ${resName(k)}`).join(', ');
    return stop('capped', `Stock plein (${full}) : pause automatique, travailleurs libérés.`);
  }
  if (stats.workers && b.workers === 0) {
    if (run?.blocked === 'input') {
      return stop('input', `À sec : il manque ${run.missing.map(resName).join(', ')} (réserve ${run.missing.map((k) => Math.floor(stock[k] ?? 0)).join(', ')} ; il en faut ${run.missing.map((k) => stats.consumes![k]).join(', ')} par jour). Les travailleurs sont partis ailleurs.`);
    }
    return stop('workers', `Aucun travailleur : les ${state.population} habitants sont tous déjà employés par des bâtiments prioritaires. Logez plus d'habitants.`);
  }
  if (run?.blocked === 'input') {
    return stop('input', `À l'arrêt : il manque ${run.missing.map(resName).join(', ')} (réserve ${run.missing.map((k) => Math.floor(stock[k] ?? 0)).join(', ')} ; il en faut ${run.missing.map((k) => round1((stats.consumes![k] ?? 0) * (b.workers / (stats.workers || 1)))).join(', ')} par jour).`);
  }
  if (b.type === 'sheepfold' && (b.lean ?? 0) >= 0.05) out.slow = `Troupeau ${(b.lean ?? 0) >= SHEEP.thinFrom ? 'maigre' : 'amaigri'} faute de blé : production à ${Math.round(leanFactor(b) * 100)} %.`;
  else if (stats.consumes && ratio < 0.999 && run?.missing.length) out.slow = `Tourne à ${Math.round(ratio * 100)} % : pas assez de ${run.missing.map(resName).join(', ')}.`;
  else if (stats.workers && b.workers < stats.workers) out.slow = `Tourne à ${Math.round((b.workers / stats.workers) * 100)} % : il manque ${stats.workers - b.workers} ${stats.workers - b.workers > 1 ? 'travailleurs' : 'travailleur'}.`;
  return out;
}

/** Variation des stocks due aux bâtiments (production − matières premières − usure des outils) */
export function computeProduction(state: GameState): Resources {
  const { produced, consumed } = simulateProduction(state);
  const out = emptyResources();
  for (const k of RESOURCE_KEYS) out[k] = produced[k] - consumed[k];
  return out;
}

/** Rations nécessaires pour la journée (1 par habitant, x2 en hiver rude) */
export function foodConsumption(state: GameState): number {
  const harsh = hasModifier(state, 'harshWinter') ? 2 : 1;
  return state.population * FOOD_PER_VILLAGER * harsh;
}

/** Ce que les habitants mangent (pain d'abord, puis farine, puis blé) et les rations manquantes */
export function mealPlan(state: GameState, stock: Resources): { eaten: Resources; missing: number } {
  let need = foodConsumption(state);
  const eaten = emptyResources();
  for (const k of CHAINS.eatOrder) {
    const value = CHAINS.nourishment[k] ?? 1;
    const use = Math.min(Math.max(0, stock[k]), need / value);
    eaten[k] += use;
    need -= use * value;
    if (need <= 1e-9) break;
  }
  return { eaten, missing: Math.max(0, need) };
}

/** Réserves en rations (pain x3) : sert au moral et aux conseils */
export function foodReserve(res: Resources): number {
  return CHAINS.eatOrder.reduce((sum, k) => sum + Math.max(0, res[k] ?? 0) * (CHAINS.nourishment[k] ?? 1), 0);
}

/** Bilan net par jour, utile pour le HUD */
export function computeNet(state: GameState): Resources {
  const net = computeProduction(state);
  const stock = emptyResources();
  for (const k of RESOURCE_KEYS) stock[k] = (state.resources[k] ?? 0) + net[k];
  const { eaten } = mealPlan(state, stock);
  for (const k of RESOURCE_KEYS) net[k] -= eaten[k];
  // Bois de chauffage (hiver)
  net.wood -= heatingNeed(state);
  // Blé des moutons (hiver)
  net.food -= sheepFeedNeed(state);
  return net;
}

export function weaponsDefense(state: GameState): number {
  return Math.min(CHAINS.weapons.maxDefense, (state.resources.weapons ?? 0) * CHAINS.weapons.defenseEach);
}

export function defensePower(state: GameState): number {
  return weaponsDefense(state) + state.buildings.reduce((sum, b) => {
    const stats = statsOf(b);
    if (!stats.defense || !stats.workers) return sum;
    return sum + stats.defense * (b.workers / stats.workers) * conditionFactor(b);
  }, 0);
}

/** Effet d'un niveau en texte court : "+4 [blé]/jour", "+3 places", "Défense +2" */
export function effectLabel(lvl: LevelDef, produces: Partial<Resources> = lvl.produces ?? {}): string {
  const parts: string[] = [];
  if (lvl.housing) parts.push(`+${lvl.housing} places`);
  const list = (r: Partial<Resources>) =>
    RESOURCE_KEYS.filter((k) => r[k])
      .map((k) => `${r[k]} ${RESOURCE_META[k].icon}`)
      .join(' + ');
  if (lvl.consumes) {
    // Transformation : entrée → sortie
    parts.push(`${list(lvl.consumes)} → ${list(produces)} /jour`);
  } else {
    for (const k of RESOURCE_KEYS) {
      if (produces[k]) parts.push(`+${produces[k]} ${RESOURCE_META[k].icon}/jour`);
    }
  }
  if (lvl.defense) parts.push(`Défense +${lvl.defense}`);
  if (lvl.storage) parts.push(`Protège ${lvl.storage} ${RESOURCE_META.food.icon}`);
  return parts.join(' · ');
}

/** "[travailleurs] 2 travailleurs" (vide si le bâtiment n'emploie personne) */
export function workersLabel(lvl: LevelDef): string {
  if (!lvl.workers) return '';
  return `${I.worker} ${lvl.workers} ${lvl.workers > 1 ? 'travailleurs' : 'travailleur'}`;
}

/** Score brut, avant le multiplicateur de difficulté */
export function baseScore(state: GameState): number {
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

/** Score affiché : multiplié selon la difficulté (Paisible ×0,6 … Cauchemar ×2,2) */
export function score(state: GameState): number {
  return Math.round(baseScore(state) * difficultyOf(state).scoreMult);
}
