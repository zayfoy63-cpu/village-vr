// Parcelles : découpage de la carte, achat, contenu et dangers (camps de bandits, ruines).
// Tous les réglages sont dans PARCELS.

import { Rng } from './rng';
import type { GameMap, GameState, ParcelFeature, Resources, TileType } from './types';

export const PARCELS = {
  /** Limites des colonnes et des rangées de parcelles (en cases) : 4 × 3 parcelles sur la carte 20 × 14 */
  cols: [0, 5, 10, 15, 20],
  rows: [0, 4, 10, 14],
  /** Parcelles possédées au départ (rangée centrale, deux colonnes du milieu) */
  start: [5, 6],
  /** Prix en or du n-ième achat : base × croissance^n */
  priceBase: 10,
  priceGrowth: 1.45,
  /** Habitants requis pour le n-ième achat (au-delà de la liste : dernière valeur + 5 par achat) */
  minPopulation: [0, 0, 8, 12, 16, 20, 25, 30, 35, 40],
  /** Chances qu'une parcelle verrouillée contienne un camp de bandits / des ruines */
  campChance: 0.2,
  ruinsChance: 0.25,
  camp: {
    /** Force du camp (multipliée par la sévérité du moment), butin en or si on le détruit */
    strength: [5, 9],
    loot: [15, 35],
    /** Tant qu'il existe un camp sur une parcelle possédée ou voisine, les bandits viennent plus souvent */
    banditWeightBonus: 0.8,
  },
  ruins: {
    /** Coût du déblaiement, trésor trouvé, risque d'éboulement (1 villageois) */
    clearCost: { wood: 10 } as Partial<Resources>,
    stone: [15, 35],
    gold: [5, 20],
    collapseChance: 0.2,
  },
};

const NCOLS = PARCELS.cols.length - 1;
const NROWS = PARCELS.rows.length - 1;
export const PARCEL_COUNT = NCOLS * NROWS;

export interface ParcelRect {
  id: number;
  col: number;
  row: number;
  x0: number;
  z0: number;
  x1: number;
  z1: number;
}

export function parcelRect(id: number): ParcelRect {
  const col = id % NCOLS;
  const row = Math.floor(id / NCOLS);
  return { id, col, row, x0: PARCELS.cols[col], x1: PARCELS.cols[col + 1], z0: PARCELS.rows[row], z1: PARCELS.rows[row + 1] };
}

export const ALL_PARCELS: ParcelRect[] = Array.from({ length: PARCEL_COUNT }, (_, i) => parcelRect(i));

/** Parcelle contenant une case (−1 hors carte) */
export function parcelOf(x: number, z: number): number {
  const col = PARCELS.cols.findIndex((c, i) => i < NCOLS && x >= c && x < PARCELS.cols[i + 1]);
  const row = PARCELS.rows.findIndex((r, i) => i < NROWS && z >= r && z < PARCELS.rows[i + 1]);
  return col < 0 || row < 0 ? -1 : row * NCOLS + col;
}

export function ownsParcel(state: GameState, id: number): boolean {
  return state.parcels.owned.includes(id);
}

export function ownsTile(state: GameState, x: number, z: number): boolean {
  const id = parcelOf(x, z);
  return id >= 0 && ownsParcel(state, id);
}

/** Parcelles voisines (par un côté) */
export function neighborParcels(id: number): number[] {
  const { col, row } = parcelRect(id);
  const out: number[] = [];
  if (col > 0) out.push(id - 1);
  if (col < NCOLS - 1) out.push(id + 1);
  if (row > 0) out.push(id - NCOLS);
  if (row < NROWS - 1) out.push(id + NCOLS);
  return out;
}

export function isAdjacentToOwned(state: GameState, id: number): boolean {
  return neighborParcels(id).some((n) => ownsParcel(state, n));
}

export function parcelPrice(state: GameState): number {
  return Math.round(PARCELS.priceBase * PARCELS.priceGrowth ** state.parcels.bought);
}

export function parcelMinPopulation(state: GameState): number {
  const n = state.parcels.bought;
  const list = PARCELS.minPopulation;
  return n < list.length ? list[n] : list[list.length - 1] + 5 * (n - list.length + 1);
}

export interface ParcelCheck {
  ok: boolean;
  reason?: string;
  price: number;
  minPopulation: number;
}

export function canBuyParcel(state: GameState, id: number): ParcelCheck {
  const price = parcelPrice(state);
  const minPopulation = parcelMinPopulation(state);
  const base = { price, minPopulation };
  if (id < 0 || id >= PARCEL_COUNT) return { ok: false, reason: 'Parcelle inconnue', ...base };
  if (ownsParcel(state, id)) return { ok: false, reason: 'Déjà achetée', ...base };
  if (!isAdjacentToOwned(state, id)) return { ok: false, reason: 'Doit toucher une parcelle déjà possédée', ...base };
  if (state.population < minPopulation) return { ok: false, reason: `Requiert ${minPopulation} habitants`, ...base };
  if (state.resources.gold < price) return { ok: false, reason: `Requiert ${price} 🪙`, ...base };
  return { ok: true, ...base };
}

/** Résumé de ce que contient une parcelle (aperçu affiché sur les parcelles verrouillées) */
export function parcelContents(state: GameState, id: number) {
  const r = parcelRect(id);
  const counts: Record<TileType, number> = { grass: 0, fertile: 0, forest: 0, rock: 0, water: 0 };
  for (let z = r.z0; z < r.z1; z++) for (let x = r.x0; x < r.x1; x++) counts[state.map.tiles[z * state.map.width + x]]++;
  const features = state.features.filter((f) => f.parcel === id && !f.cleared);
  return { counts, features, buildable: counts.grass + counts.fertile };
}

// ---------- Dangers ----------

export function featureAt(state: GameState, x: number, z: number): ParcelFeature | undefined {
  return state.features.find((f) => !f.cleared && x >= f.x && x < f.x + f.w && z >= f.z && z < f.z + f.h);
}

/** Camps encore actifs sur une parcelle possédée ou voisine : ils attirent les bandits */
export function activeCamps(state: GameState): ParcelFeature[] {
  return state.features.filter(
    (f) => f.type === 'camp' && !f.cleared && (ownsParcel(state, f.parcel) || isAdjacentToOwned(state, f.parcel)),
  );
}

/** Génère les dangers des parcelles verrouillées, à partir de la seed (déterministe) */
export function generateFeatures(map: GameMap, seed: number): ParcelFeature[] {
  const rng = new Rng((seed ^ 0x5bd1e995) >>> 0);
  const out: ParcelFeature[] = [];
  const land = (x: number, z: number) => {
    const t = map.tiles[z * map.width + x];
    return t === 'grass' || t === 'fertile';
  };
  for (const r of ALL_PARCELS) {
    if (PARCELS.start.includes(r.id)) continue;
    const roll = rng.next();
    const type = roll < PARCELS.campChance ? 'camp' : roll < PARCELS.campChance + PARCELS.ruinsChance ? 'ruins' : null;
    if (!type) continue;
    const w = 2;
    const h = type === 'camp' ? 2 : 1;
    // Cherche un emplacement libre (herbe / terre fertile) dans la parcelle
    const spots: [number, number][] = [];
    for (let z = r.z0; z <= r.z1 - h; z++)
      for (let x = r.x0; x <= r.x1 - w; x++) {
        let ok = true;
        for (let dz = 0; dz < h && ok; dz++) for (let dx = 0; dx < w && ok; dx++) if (!land(x + dx, z + dz)) ok = false;
        if (ok) spots.push([x, z]);
      }
    if (!spots.length) continue;
    const [x, z] = rng.pick(spots);
    const range = (a: number[]) => rng.int(a[0], a[1]);
    out.push(
      type === 'camp'
        ? { id: out.length + 1, parcel: r.id, type, x, z, w, h, cleared: false, strength: range(PARCELS.camp.strength), loot: { gold: range(PARCELS.camp.loot) } }
        : { id: out.length + 1, parcel: r.id, type, x, z, w, h, cleared: false, strength: 0, loot: { stone: range(PARCELS.ruins.stone), gold: range(PARCELS.ruins.gold) } },
    );
  }
  return out;
}
