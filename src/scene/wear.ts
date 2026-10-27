// Usure du sol : chemins de terre qui serpentent entre les bâtiments et se creusent là où les
// villageois passent souvent, terre battue autour des maisons. Grille fine (3 cellules par case),
// non sauvegardée : la base se recalcule à partir de l'emplacement des bâtiments, les pas des
// villageois s'y ajoutent pendant la partie.

import { BUILDING_BY_ID } from '../game/buildings';
import type { Building, GameMap } from '../game/types';
import { spread } from './handmade';
import { TILE, tileToWorld } from './shared';

export const WEAR = {
  /** Cellules par côté de case */
  res: 3,
  /** Usure laissée par un villageois qui marche (par seconde de jeu) */
  step: 0.05,
  /** Plafond d'usure d'une cellule */
  max: 1.6,
  /** Seuil à partir duquel la terre apparaît */
  show: 0.22,
  /** Écart des chemins par rapport à la ligne droite (cases) */
  meander: 0.35,
};

/** Bâtiments qui ne génèrent pas de chemin */
const NO_PATH = new Set(['palisade', 'torch', 'dike']);

let width = 0;
let height = 0;
let mapSeed = 0;
let base = new Float32Array(0);
let walk = new Float32Array(0);
let layoutKey = '';
let version = 0;

export function wearVersion() {
  return version;
}

export function wearSize() {
  return { w: width * WEAR.res, h: height * WEAR.res };
}

/** Usure totale d'une cellule */
export function wearAt(i: number): number {
  return Math.min(WEAR.max, base[i] + walk[i]);
}

/** Centre monde d'une cellule */
export function cellCenter(cx: number, cz: number): [number, number] {
  const c = TILE / WEAR.res;
  return [(cx + 0.5) * c - (width * TILE) / 2, (cz + 0.5) * c - (height * TILE) / 2];
}

function cellOf(x: number, z: number): number {
  const c = TILE / WEAR.res;
  const cx = Math.floor((x + (width * TILE) / 2) / c);
  const cz = Math.floor((z + (height * TILE) / 2) / c);
  if (cx < 0 || cz < 0 || cx >= width * WEAR.res || cz >= height * WEAR.res) return -1;
  return cz * width * WEAR.res + cx;
}

/** Marque une cellule (sans cumuler : repasser au même endroit ne creuse pas la base) */
function add(grid: Float32Array, x: number, z: number, amount: number) {
  const i = cellOf(x, z);
  if (i >= 0) grid[i] = Math.min(WEAR.max, Math.max(grid[i], amount));
}

/** Trace un chemin qui serpente de a à b */
function trail(a: [number, number], b: [number, number], seed: number, amount: number) {
  const dx = b[0] - a[0];
  const dz = b[1] - a[1];
  const len = Math.hypot(dx, dz);
  if (len < 0.2) return;
  const nx = -dz / len;
  const nz = dx / len;
  const bend = spread(seed, 1, 31, WEAR.meander) * Math.min(1, len / 3);
  const phase = spread(seed, 2, 32, Math.PI);
  const steps = Math.ceil(len / (TILE / WEAR.res / 2));
  for (let s = 0; s <= steps; s++) {
    const t = s / steps;
    // Grande courbe + petites hésitations
    const off = Math.sin(t * Math.PI) * bend + Math.sin(t * Math.PI * 3 + phase) * 0.07 * Math.sin(t * Math.PI);
    const x = a[0] + dx * t + nx * off;
    const z = a[1] + dz * t + nz * off;
    add(base, x, z, amount);
    // Bords irréguliers : la terre déborde parfois d'un côté
    const side = spread(seed, s, 33, 1);
    if (Math.abs(side) > 0.4) add(base, x + nx * side * 0.25, z + nz * side * 0.25, amount * 0.5);
  }
}

/** Recalcule la base (chemins entre bâtiments, terre battue) si la carte ou les bâtiments ont bougé */
export function layoutWear(map: GameMap, buildings: Building[]) {
  const key = `${map.seed}|${buildings.map((b) => `${b.type}${b.x},${b.z}`).join(';')}`;
  if (key === layoutKey) return;
  const sameMap = map.seed === mapSeed && map.width === width && map.height === height;
  layoutKey = key;
  width = map.width;
  height = map.height;
  mapSeed = map.seed;
  const n = width * height * WEAR.res * WEAR.res;
  base = new Float32Array(n);
  if (!sameMap) walk = new Float32Array(n);

  const spots = buildings
    .filter((b) => !NO_PATH.has(b.type))
    .map((b) => {
      const size = BUILDING_BY_ID[b.type].size;
      const [x, , z] = tileToWorld(b.x, b.z, width, height, size);
      return { id: b.id, size, field: b.type === 'field', front: [x, z + size * 0.5 + 0.15] as [number, number], center: [x, z] as [number, number] };
    });
  // Terre battue devant et autour des bâtiments (pas des champs)
  for (const s of spots) {
    if (s.field) continue;
    const r = s.size * 0.5 + 0.2;
    for (let k = 0; k < 10; k++) {
      const a = (k / 10) * Math.PI * 2 + spread(s.id, k, 34, 0.3);
      add(base, s.center[0] + Math.cos(a) * r, s.center[1] + Math.sin(a) * r, 0.18 + Math.max(0, Math.sin(a)) * 0.3);
    }
    add(base, s.front[0], s.front[1], 0.6);
  }
  // Réseau de chemins : chaque bâtiment est relié au plus proche déjà relié (arbre couvrant)
  if (spots.length > 1) {
    const done = [spots[0]];
    const left = spots.slice(1);
    while (left.length) {
      let bi = 0;
      let bj = 0;
      let bd = Infinity;
      left.forEach((s, i) =>
        done.forEach((d, j) => {
          const dd = Math.hypot(s.front[0] - d.front[0], s.front[1] - d.front[1]);
          if (dd < bd) [bd, bi, bj] = [dd, i, j];
        }),
      );
      const s = left.splice(bi, 1)[0];
      const d = done[bj];
      trail(s.front, d.front, s.id * 31 + d.id, s.field || d.field ? 0.3 : 0.5);
      done.push(s);
    }
  }
  version++;
}

/** Pas d'un villageois : use un peu le sol sous ses pieds */
export function treadWear(x: number, z: number, dt: number) {
  if (!walk.length) return;
  const i = cellOf(x, z);
  if (i < 0 || walk[i] + base[i] >= WEAR.max) return;
  const before = walk[i] + base[i];
  walk[i] += WEAR.step * dt;
  // Ne signale un changement que lorsqu'un palier visible est franchi
  if (Math.floor(before * 8) !== Math.floor((walk[i] + base[i]) * 8)) version++;
}
