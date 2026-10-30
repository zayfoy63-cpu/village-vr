// Génération procédurale de la carte à partir d'une seed.

import { MAP_HEIGHT, MAP_WIDTH } from './config';
import { PARCELS, parcelRect } from './parcels';
import { Rng } from './rng';
import type { GameMap, TileType } from './types';

/** Bruit de valeur lissé : grille grossière aléatoire + interpolation bilinéaire */
function valueNoise(rng: Rng, w: number, h: number, cell: number): number[] {
  const gw = Math.ceil(w / cell) + 2;
  const gh = Math.ceil(h / cell) + 2;
  const grid = Array.from({ length: gw * gh }, () => rng.next());
  const smooth = (t: number) => t * t * (3 - 2 * t);
  const out: number[] = [];
  for (let z = 0; z < h; z++) {
    for (let x = 0; x < w; x++) {
      const gx = x / cell;
      const gz = z / cell;
      const x0 = Math.floor(gx);
      const z0 = Math.floor(gz);
      const tx = smooth(gx - x0);
      const tz = smooth(gz - z0);
      const v = (ix: number, iz: number) => grid[iz * gw + ix];
      const a = v(x0, z0) * (1 - tx) + v(x0 + 1, z0) * tx;
      const b = v(x0, z0 + 1) * (1 - tx) + v(x0 + 1, z0 + 1) * tx;
      out.push(a * (1 - tz) + b * tz);
    }
  }
  return out;
}

export function tileAt(map: GameMap, x: number, z: number): TileType | undefined {
  if (x < 0 || z < 0 || x >= map.width || z >= map.height) return undefined;
  return map.tiles[z * map.width + x];
}

export function neighbors8(x: number, z: number): [number, number][] {
  const out: [number, number][] = [];
  for (let dz = -1; dz <= 1; dz++)
    for (let dx = -1; dx <= 1; dx++) if (dx || dz) out.push([x + dx, z + dz]);
  return out;
}

export interface GeneratedMap {
  map: GameMap;
  /** Coin haut-gauche de l'emprise 2x2 du château */
  castle: { x: number; z: number };
  mill: { x: number; z: number };
}

export function generateMap(seed: number): GeneratedMap {
  const rng = new Rng(seed);
  const w = MAP_WIDTH;
  const h = MAP_HEIGHT;
  const tiles: TileType[] = new Array(w * h).fill('grass');
  const idx = (x: number, z: number) => z * w + x;

  // 1. Rivière : traverse la carte de haut en bas en serpentant
  const riverCells = new Set<number>();
  let rx = rng.int(Math.floor(w * 0.2), Math.floor(w * 0.8));
  let drift = 0;
  for (let z = 0; z < h; z++) {
    riverCells.add(idx(rx, z));
    if (z < h - 1) {
      drift = Math.max(-1, Math.min(1, drift + rng.int(-1, 1)));
      const nx = Math.max(1, Math.min(w - 2, rx + (rng.chance(0.55) ? drift : 0)));
      // Garde la rivière continue en diagonale
      if (nx !== rx) riverCells.add(idx(nx, z));
      rx = nx;
    }
  }
  riverCells.forEach((i) => (tiles[i] = 'water'));

  const distToRiver = (x: number, z: number) => {
    let best = 99;
    riverCells.forEach((i) => {
      const d = Math.max(Math.abs((i % w) - x), Math.abs(Math.floor(i / w) - z));
      if (d < best) best = d;
    });
    return best;
  };

  // 2. Forêts, rochers, zones fertiles via bruit
  const forest = valueNoise(rng, w, h, 4);
  const rock = valueNoise(rng, w, h, 3);
  const fertile = valueNoise(rng, w, h, 4);
  for (let z = 0; z < h; z++) {
    for (let x = 0; x < w; x++) {
      const i = idx(x, z);
      if (tiles[i] === 'water') continue;
      const edge = x === 0 || z === 0 || x === w - 1 || z === h - 1 ? 0.08 : 0;
      if (rock[i] > 0.79) tiles[i] = 'rock';
      else if (forest[i] + edge > 0.66) tiles[i] = 'forest';
      else if ((distToRiver(x, z) <= 2 && fertile[i] > 0.35) || fertile[i] > 0.78) tiles[i] = 'fertile';
    }
  }

  // Limite la forêt pour garder de la place pour construire
  const forestCells = tiles.map((t, i) => (t === 'forest' ? i : -1)).filter((i) => i >= 0);
  const MAX_FOREST = Math.floor(w * h * 0.3);
  if (forestCells.length > MAX_FOREST) {
    forestCells.sort((a, b) => forest[a] - forest[b]);
    for (const i of forestCells.slice(0, forestCells.length - MAX_FOREST)) tiles[i] = 'grass';
  }

  // 3. Garantir assez de forêts et de rochers pour une partie jouable
  const stamp = (type: TileType, count: number) => {
    for (let tries = 0; tries < 50; tries++) {
      const cx = rng.int(1, w - 2);
      const cz = rng.int(1, h - 2);
      if (tiles[idx(cx, cz)] === 'water') continue;
      let placed = 0;
      for (const [nx, nz] of [[cx, cz], ...neighbors8(cx, cz)]) {
        if (nx < 0 || nz < 0 || nx >= w || nz >= h) continue;
        if (tiles[idx(nx, nz)] === 'water') continue;
        if (rng.chance(0.75)) {
          tiles[idx(nx, nz)] = type;
          placed++;
        }
      }
      if (placed >= count) return;
    }
  };
  const count = (t: TileType) => tiles.filter((x) => x === t).length;
  while (count('forest') < 20) stamp('forest', 4);
  while (count('rock') < 7) stamp('rock', 3);

  // Zone de départ (parcelles possédées au début) : rectangle englobant
  const startRects = PARCELS.start.map(parcelRect);
  const zone = {
    x0: Math.min(...startRects.map((r) => r.x0)),
    x1: Math.max(...startRects.map((r) => r.x1)),
    z0: Math.min(...startRects.map((r) => r.z0)),
    z1: Math.max(...startRects.map((r) => r.z1)),
  };

  // 4. Emplacement du château : zone 2x2 sans eau, la plus proche du centre, dans la zone de départ
  let castle = { x: Math.floor(w / 2) - 1, z: Math.floor(h / 2) - 1 };
  let best = Infinity;
  for (let z = zone.z0 + 1; z <= zone.z1 - 3; z++) {
    for (let x = zone.x0 + 1; x <= zone.x1 - 3; x++) {
      let ok = true;
      for (let dz = -1; dz <= 2 && ok; dz++)
        for (let dx = -1; dx <= 2 && ok; dx++) if (tiles[idx(x + dx, z + dz)] === 'water') ok = false;
      if (!ok) continue;
      const d = Math.hypot(x + 1 - w / 2, z + 1 - h / 2);
      if (d < best) {
        best = d;
        castle = { x, z };
      }
    }
  }
  // Dégage un anneau d'herbe autour du château
  for (let dz = -1; dz <= 2; dz++)
    for (let dx = -1; dx <= 2; dx++) {
      const i = idx(castle.x + dx, castle.z + dz);
      if (tiles[i] !== 'fertile') tiles[i] = 'grass';
    }

  // 5. Le moulin se pose juste à côté du château
  const millSpots = [
    { x: castle.x + 2, z: castle.z + 2 },
    { x: castle.x - 1, z: castle.z + 2 },
    { x: castle.x + 2, z: castle.z - 1 },
    { x: castle.x - 1, z: castle.z - 1 },
  ];
  const mill = millSpots.find((p) => p.x >= 0 && p.z >= 0 && p.x < w && p.z < h) ?? millSpots[0];
  tiles[idx(mill.x, mill.z)] = 'grass';

  // 6. Bois et pierre accessibles dès le départ : forêt et rochers dans la zone de départ ou juste au bord
  const reserved = (x: number, z: number) =>
    (x >= castle.x - 1 && x <= castle.x + 2 && z >= castle.z - 1 && z <= castle.z + 2) || (x === mill.x && z === mill.z);
  const nearZone = (t: TileType) => {
    let n = 0;
    for (let z = zone.z0 - 1; z <= zone.z1; z++)
      for (let x = zone.x0 - 1; x <= zone.x1; x++) if (x >= 0 && z >= 0 && x < w && z < h && tiles[idx(x, z)] === t) n++;
    return n;
  };
  const edgeTiles: [number, number][] = [];
  for (let z = zone.z0; z < zone.z1; z++)
    for (let x = zone.x0; x < zone.x1; x++) {
      const edge = x === zone.x0 || x === zone.x1 - 1 || z === zone.z0 || z === zone.z1 - 1;
      if (edge && !reserved(x, z) && tiles[idx(x, z)] !== 'water') edgeTiles.push([x, z]);
    }
  const ensure = (t: TileType, min: number, cluster: number) => {
    for (let tries = 0; tries < 10 && nearZone(t) < min && edgeTiles.length; tries++) {
      const [cx, cz] = rng.pick(edgeTiles);
      let placed = 0;
      for (const [nx, nz] of [[cx, cz], ...neighbors8(cx, cz)]) {
        if (placed >= cluster || nx < 0 || nz < 0 || nx >= w || nz >= h) continue;
        if (reserved(nx, nz) || tiles[idx(nx, nz)] === 'water') continue;
        tiles[idx(nx, nz)] = t;
        placed++;
      }
    }
  };
  ensure('forest', 5, 3);
  ensure('rock', 3, 2);

  // 7. Garantie de début de partie : quelle que soit la seed, la zone de départ contient une forêt, des
  //    rochers et de la terre fertile, avec une case libre pour poser la cabane de bûcheron et la carrière
  //    (elles doivent toucher leur terrain). Ne consomme le hasard que si l'un des trois manque.
  const zoneTiles: [number, number][] = [];
  for (let z = zone.z0; z < zone.z1; z++) for (let x = zone.x0; x < zone.x1; x++) zoneTiles.push([x, z]);
  const occupied = (x: number, z: number) =>
    (x >= castle.x && x <= castle.x + 1 && z >= castle.z && z <= castle.z + 1) || (x === mill.x && z === mill.z);
  const isLand = (x: number, z: number) => tiles[idx(x, z)] === 'grass' || tiles[idx(x, z)] === 'fertile';
  const usable = (t: TileType) => zoneTiles.filter(([x, z]) => !reserved(x, z) && tiles[idx(x, z)] === t).length;
  const hasSpot = (t: TileType) =>
    zoneTiles.some(
      ([x, z]) =>
        !occupied(x, z) &&
        isLand(x, z) &&
        neighbors8(x, z).some(([nx, nz]) => nx >= 0 && nz >= 0 && nx < w && nz < h && tiles[idx(nx, nz)] === t),
    );
  const guarantee = (t: TileType, min: number, cluster: number, needSpot: boolean) => {
    for (let tries = 0; tries < 200 && (usable(t) < min || (needSpot && !hasSpot(t))); tries++) {
      const free = zoneTiles.filter(([x, z]) => !reserved(x, z) && isLand(x, z));
      if (!free.length) return;
      const [cx, cz] = rng.pick(free);
      let placed = 0;
      for (const [nx, nz] of [[cx, cz], ...neighbors8(cx, cz)]) {
        if (placed >= cluster) break;
        if (nx < zone.x0 || nx >= zone.x1 || nz < zone.z0 || nz >= zone.z1) continue;
        if (reserved(nx, nz) || !isLand(nx, nz)) continue;
        tiles[idx(nx, nz)] = t;
        placed++;
      }
    }
  };
  // Plusieurs passes : poser les rochers peut grignoter la case libre qui touchait la forêt
  for (let pass = 0; pass < 3; pass++) {
    guarantee('forest', 4, 3, true);
    guarantee('rock', 3, 2, true);
    guarantee('fertile', 4, 4, false);
  }

  return { map: { seed, width: w, height: h, tiles }, castle, mill };
}
