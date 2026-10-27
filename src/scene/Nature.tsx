import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { seasonOf, type SeasonId } from '../game/config';
import { DEFORESTATION } from '../game/mechanics/deforestation';
import { hash2 } from '../game/rng';
import type { GameMap, TileType } from '../game/types';
import { useGame } from '../store/gameStore';
import { GEO, tileToWorld } from './shared';
import { BLOB, DOT, PINE, ROUGH, rnd, spread } from './handmade';
import { useFrame } from '@react-three/fiber';
import { hasModifier } from '../game/rules';
import { parcelOf } from '../game/parcels';
import { tileColor } from './Terrain';
import { WEAR, cellCenter, layoutWear, wearAt, wearSize, wearVersion } from './wear';
import { worldToTile } from './shared';
import { useSmallShadows } from './quality';
import { PAL } from '../palette';

interface TreeSpot {
  x: number;
  z: number;
  scale: number;
  pine: boolean;
  /** Case et rang de l'arbre dans sa case (déforestation : les arbres disparaissent un à un) */
  tile: number;
  rank: number;
  /** Graine de la silhouette (étages, penchant, nuance) */
  seed: number;
}

interface RockSpot {
  x: number;
  z: number;
  scale: number;
  rot: number;
  /** Caillou posé dans l'herbe (plus petit, plus plat) */
  pebble?: boolean;
}

/** Étages max par sapin et boules max par feuillu : silhouettes variées sans maillage de plus */
const PINE_TIERS = 3;
const ROUND_BLOBS = 3;
/** Places réservées aux taches de terre des chemins (même maillage que les fleurs) */
const PATH_CAP = 900;
/** Terre battue claire (chemins peu usés) et profonde (ornières) : mélanges de la palette */
const EARTH_LIGHT = new THREE.Color(PAL.ochre).lerp(new THREE.Color(PAL.stone), 0.5);
const EARTH_DEEP = new THREE.Color(PAL.wood).lerp(new THREE.Color(PAL.umber), 0.55);
const SNOW = new THREE.Color(PAL.bone);
const LOCKED = new THREE.Color(PAL.ink);
/** Teintes voisines des touffes d'herbe rase qui débordent d'une case à l'autre */
const CLUMP: Partial<Record<TileType, string[]>> = {
  grass: [PAL.moss, PAL.straw, PAL.sage],
  fertile: [PAL.sage, PAL.forest, PAL.straw],
  forest: [PAL.moss, PAL.umber],
};

interface Clump {
  x: number;
  z: number;
  sx: number;
  sz: number;
  yaw: number;
  type: TileType;
  tone: string;
  mix: number;
  jitter: number;
  tx: number;
  tz: number;
}

const PINE_TONES = [PAL.forest, PAL.forest, PAL.moss, PAL.slate];
const ROUND_TONES = [PAL.moss, PAL.forest, PAL.sage];

const LEAF_COLORS: Record<SeasonId, string> = {
  spring: PAL.sage,
  summer: PAL.moss,
  autumn: PAL.ochre,
  winter: PAL.bone,
};

function layout(map: GameMap) {
  const trees: TreeSpot[] = [];
  const rocks: RockSpot[] = [];
  const flowers: { x: number; z: number; c: number; tuft?: boolean }[] = [];
  const clumps: Clump[] = [];
  const isLand = (wx: number, wz: number) => {
    const t = worldToTile(wx, wz, map.width, map.height);
    return t.x >= 0 && t.z >= 0 && t.x < map.width && t.z < map.height && map.tiles[t.z * map.width + t.x] !== 'water';
  };
  for (let z = 0; z < map.height; z++) {
    for (let x = 0; x < map.width; x++) {
      const type = map.tiles[z * map.width + x];
      const [cx, , cz] = tileToWorld(x, z, map.width, map.height);
      // Touffes d'herbe d'une autre nuance, à cheval sur les bords des cases (jamais sur l'eau)
      const tones = CLUMP[type];
      const nc = tones ? Math.floor(hash2(x, z, map.seed + 51) * 2.6) : 0;
      for (let k = 0; k < nc; k++) {
        const px = cx + (hash2(x * 5 + k, z, map.seed + 52) - 0.5) * 0.95;
        const pz = cz + (hash2(x, z * 5 + k, map.seed + 53) - 0.5) * 0.95;
        const sx = 0.3 + hash2(x + k, z, map.seed + 54) * 0.4;
        const r = sx * 0.55;
        if (!isLand(px - r, pz - r) || !isLand(px + r, pz + r) || !isLand(px - r, pz + r) || !isLand(px + r, pz - r)) continue;
        clumps.push({
          x: px,
          z: pz,
          sx,
          sz: sx * (0.55 + hash2(x, z + k, map.seed + 55) * 0.45),
          yaw: hash2(x, z + k, map.seed + 58) * Math.PI,
          type,
          tone: tones![Math.floor(hash2(x + k, z + k, map.seed + 56) * tones!.length)],
          mix: 0.3 + hash2(x, z + k, map.seed + 57) * 0.3,
          jitter: hash2(x, z, map.seed),
          tx: x,
          tz: z,
        });
      }
      if (type === 'forest') {
        const n = 2 + Math.floor(hash2(x, z, map.seed + 1) * 2);
        for (let k = 0; k < n; k++) {
          const a = hash2(x * 3 + k, z, map.seed + 2) * Math.PI * 2;
          const r = 0.12 + hash2(x, z * 3 + k, map.seed + 3) * 0.25;
          trees.push({
            x: cx + Math.cos(a) * r,
            z: cz + Math.sin(a) * r,
            scale: 0.75 + hash2(x + k, z + k, map.seed + 4) * 0.5,
            pine: hash2(x, z + k * 7, map.seed + 5) > 0.45,
            tile: z * map.width + x,
            rank: (k + 1) / (n + 1),
            seed: Math.floor(hash2(x * 7 + k, z * 13 - k, map.seed + 14) * 1e6),
          });
        }
      } else if (type === 'fertile') {
        // Petites fleurs pour repérer les zones fertiles
        for (let k = 0; k < 4; k++) {
          flowers.push({
            x: cx + (hash2(x + k * 5, z, map.seed + 11) - 0.5) * 0.8,
            z: cz + (hash2(x, z + k * 5, map.seed + 12) - 0.5) * 0.8,
            c: hash2(x + k, z - k, map.seed + 13),
          });
        }
      } else if (type === 'grass') {
        // Herbes folles et cailloux : rien n'est tondu
        const nt = Math.floor(hash2(x, z, map.seed + 15) * 3);
        for (let k = 0; k < nt; k++) {
          flowers.push({
            x: cx + (hash2(x + k * 3, z, map.seed + 16) - 0.5) * 0.9,
            z: cz + (hash2(x, z + k * 3, map.seed + 17) - 0.5) * 0.9,
            c: hash2(x - k, z + k, map.seed + 18),
            tuft: true,
          });
        }
        if (hash2(x, z, map.seed + 19) > 0.6) {
          rocks.push({
            x: cx + (hash2(x, z, map.seed + 20) - 0.5) * 0.8,
            z: cz + (hash2(z, x, map.seed + 21) - 0.5) * 0.8,
            scale: 0.04 + hash2(x, z, map.seed + 22) * 0.05,
            rot: hash2(x, z, map.seed + 23) * Math.PI,
            pebble: true,
          });
        }
      } else if (type === 'rock') {
        const n = 2 + Math.floor(hash2(x, z, map.seed + 6) * 2);
        for (let k = 0; k < n; k++) {
          rocks.push({
            x: cx + (hash2(x + k, z, map.seed + 7) - 0.5) * 0.6,
            z: cz + (hash2(x, z + k, map.seed + 8) - 0.5) * 0.6,
            scale: 0.2 + hash2(x + k, z + k, map.seed + 9) * 0.3,
            rot: hash2(x * k, z, map.seed + 10) * Math.PI,
          });
        }
      }
    }
  }
  return { trees, rocks, flowers, clumps };
}

/** Arbres (cônes / boules) et rochers, entièrement instanciés : 5 draw calls au total */
export function Nature({ map }: { map: GameMap }) {
  const smallShadows = useSmallShadows();
  const { trees, rocks, flowers, clumps } = useMemo(() => layout(map), [map]);
  const harsh = useGame((s) => hasModifier(s.game, 'harshWinter'));
  const owned = useGame((s) => s.game.parcels.owned);
  const buildings = useGame((s) => s.game.buildings);
  const drawn = useRef(-1);
  const pines = trees.filter((t) => t.pine);
  const rounds = trees.filter((t) => !t.pine);
  const season = useGame((s) => seasonOf(s.game.day).id);
  // Santé de la forêt (déforestation) : relue une fois par jour
  const forest = useGame((s) => s.game.mech.forest);

  const trunkRef = useRef<THREE.InstancedMesh>(null);
  const coneRef = useRef<THREE.InstancedMesh>(null);
  const ballRef = useRef<THREE.InstancedMesh>(null);
  const rockRef = useRef<THREE.InstancedMesh>(null);
  const flowerRef = useRef<THREE.InstancedMesh>(null);

  /**
   * Taches au sol (même maillage que les fleurs, aplaties) : touffes d'herbe rase puis terre battue
   * des chemins, plus large et plus sombre là où l'on passe souvent (wear.ts).
   */
  const writeGround = () => {
    const mesh = flowerRef.current;
    if (!mesh) return;
    drawn.current = wearVersion();
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const p = new THREE.Vector3();
    const s = new THREE.Vector3();
    const c = new THREE.Color();
    const tc = new THREE.Color();
    let n = flowers.length;
    const finish = (tx: number, tz: number) => {
      if (season === 'winter') c.lerp(SNOW, harsh ? 0.85 : 0.55);
      if (!owned.includes(parcelOf(tx, tz))) c.lerp(LOCKED, 0.5);
      mesh.setColorAt(n, c);
    };
    for (const k of clumps) {
      m.compose(p.set(k.x, -0.002 + (n % 3) * 0.0008, k.z), q.setFromEuler(e.set(0, k.yaw, 0)), s.set(k.sx, 0.006, k.sz));
      mesh.setMatrixAt(n, m);
      tileColor(k.type, season, k.jitter, c, harsh).lerp(tc.set(k.tone), k.mix);
      finish(k.tx, k.tz);
      n++;
    }
    const { w, h } = wearSize();
    const end = flowers.length + clumps.length + PATH_CAP;
    for (let cz = 0; cz < h && n < end; cz++) {
      for (let cx = 0; cx < w && n < end; cx++) {
        const v = wearAt(cz * w + cx);
        if (v < WEAR.show) continue;
        const [wx, wz] = cellCenter(cx, cz);
        const px = wx + spread(cx, cz, map.seed + 61, 0.07);
        const pz = wz + spread(cz, cx, map.seed + 62, 0.07);
        const t = worldToTile(px, pz, map.width, map.height);
        const type = map.tiles[t.z * map.width + t.x];
        if (type === undefined || type === 'water' || type === 'rock') continue;
        const k = Math.min(1, (v - WEAR.show) / (1.3 - WEAR.show));
        const size = 0.4 + 0.2 * k;
        m.compose(
          p.set(px, k * 0.002 + rnd(cx, cz, map.seed + 64) * 0.0015, pz),
          q.setFromEuler(e.set(0, rnd(cx * 3, cz, map.seed + 67) * Math.PI, 0)),
          s.set(size * (0.85 + rnd(cz, cx, map.seed + 65) * 0.45), 0.006, size * (0.75 + rnd(cx, cz, map.seed + 66) * 0.35)),
        );
        mesh.setMatrixAt(n, m);
        c.copy(EARTH_LIGHT).lerp(EARTH_DEEP, k).offsetHSL(0, 0, spread(cx, cz, map.seed + 63, 0.025));
        finish(t.x, t.z);
        n++;
      }
    }
    mesh.count = n;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  };

  // Les pas des villageois creusent les chemins : redessinés de temps en temps, par paliers
  const timer = useRef(0);
  useFrame((_, dt) => {
    if ((timer.current += dt) < 2) return;
    timer.current = 0;
    if (wearVersion() !== drawn.current) writeGround();
  });

  useLayoutEffect(() => {
    layoutWear(map, buildings);
    writeGround();
  }, [map, buildings, season, harsh, owned, clumps]);

  useLayoutEffect(() => {
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const p = new THREE.Vector3();
    const s = new THREE.Vector3();
    const c = new THREE.Color();
    const tc = new THREE.Color();

    // Arbre encore debout ? Sinon une souche. Les survivants rapetissent avec la santé de la forêt.
    const health = (t: TreeSpot) => forest[t.tile] ?? 1;
    const standing = (t: TreeSpot) => health(t) >= DEFORESTATION.effect.clearedBelow && health(t) >= t.rank * DEFORESTATION.hint.thinFrom;
    const size = (t: TreeSpot) => (standing(t) ? t.scale * (0.6 + 0.4 * health(t)) : 0.0001);
    trees.forEach((t, i) => {
      if (standing(t)) {
        const k = size(t);
        const th = 0.8 + rnd(t.seed, 9, 104) * 0.5;
        q.setFromEuler(new THREE.Euler(spread(t.seed, 3, 83, 0.09), rnd(t.seed, 10, 105) * 3, spread(t.seed, 4, 84, 0.09)));
        m.compose(p.set(t.x, 0.12 * k * th, t.z), q, s.set(0.08 * k, 0.24 * k * th, 0.08 * k));
      } else {
        m.compose(p.set(t.x, 0.025, t.z), q.identity(), s.set(0.09, 0.05, 0.09));
      }
      trunkRef.current!.setMatrixAt(i, m);
    });

    const e = new THREE.Euler();

    // Sapins : 2 ou 3 étages décalés, de travers, plus ou moins élancés (instances tassées : rien n'est dessiné pour rien)
    let nc = 0;
    pines.forEach((tree) => {
      const k = size(tree);
      const sd = tree.seed;
      const tiers = 2 + (rnd(sd, 1, 81) > 0.55 ? 1 : 0);
      const slim = 0.8 + rnd(sd, 2, 82) * 0.4;
      const leanX = spread(sd, 3, 83, 0.09);
      const leanZ = spread(sd, 4, 84, 0.09);
      c.set(season === 'winter' ? PAL.frost : PINE_TONES[Math.floor(rnd(sd, 5, 85) * PINE_TONES.length)]);
      if (season !== 'winter') c.lerp(tc.set(PAL.forest), 0.55);
      c.offsetHSL(0, 0, spread(sd, 6, 86, 0.05));
      for (let t = 0; t < tiers && standing(tree); t++) {
        const j = nc++;
        const f = t / (tiers - 1); // 0 = bas, 1 = haut
        const y = (0.36 + f * (tiers === 3 ? 0.42 : 0.3)) * k;
        const w = (0.46 - f * 0.18) * k * slim;
        q.setFromEuler(e.set(leanX * (1 + f), rnd(sd, t, 87) * Math.PI * 2, leanZ * (1 + f)));
        m.compose(p.set(tree.x - leanZ * y, y, tree.z + leanX * y), q, s.set(w * (0.9 + rnd(sd, t, 88) * 0.2), (0.44 - f * 0.08) * k, w));
        coneRef.current!.setMatrixAt(j, m);
        coneRef.current!.setColorAt(j, tc.copy(c).offsetHSL(0, 0, f * 0.04));
      }
    });

    // Feuillus : une à trois boules bosselées (chêne trapu, peuplier, buisson rond)
    let nb = 0;
    rounds.forEach((tree) => {
      const k = size(tree);
      const sd = tree.seed;
      const shape = rnd(sd, 1, 91); // < 0.25 peuplier, < 0.65 rond, sinon chêne à plusieurs boules
      const blobs = shape < 0.65 ? 1 : 2 + (rnd(sd, 2, 92) > 0.5 ? 1 : 0);
      c.set(LEAF_COLORS[season]);
      if (season === 'summer' || season === 'spring') c.lerp(tc.set(ROUND_TONES[Math.floor(rnd(sd, 3, 93) * ROUND_TONES.length)]), 0.35);
      c.offsetHSL(spread(sd, 4, 94, 0.015), 0, spread(sd, 5, 95, 0.06));
      for (let b = 0; b < blobs && standing(tree); b++) {
        const j = nb++;
        let r = 0.42 * k;
        let sy = 1;
        let ox = 0;
        let oz = 0;
        let y = 0.45 * k;
        if (shape < 0.25) {
          r = 0.3 * k;
          sy = 1.9;
          y = 0.55 * k;
        } else if (b > 0) {
          const a = rnd(sd, b, 96) * Math.PI * 2;
          r = (0.28 + rnd(sd, b, 97) * 0.08) * k;
          ox = Math.cos(a) * 0.16 * k;
          oz = Math.sin(a) * 0.16 * k;
          y = (0.4 + rnd(sd, b, 98) * 0.18) * k;
        }
        q.setFromEuler(e.set(spread(sd, b, 99, 0.25), rnd(sd, b, 100) * Math.PI * 2, spread(sd, b, 101, 0.25)));
        m.compose(p.set(tree.x + ox, y, tree.z + oz), q, s.set(r * (0.9 + rnd(sd, b, 102) * 0.25), r * sy * (0.85 + rnd(sd, b, 103) * 0.25), r));
        ballRef.current!.setMatrixAt(j, m);
        ballRef.current!.setColorAt(j, tc.copy(c).offsetHSL(0, 0, b * 0.025));
      }
    });

    coneRef.current!.count = nc;
    ballRef.current!.count = nb;

    // Rochers et cailloux : jamais deux pareils
    rocks.forEach((r, i) => {
      const sd = Math.floor(r.rot * 1e5) + i;
      q.setFromEuler(e.set(spread(sd, 1, 111, 0.6), r.rot * 2, spread(sd, 2, 112, 0.6)));
      const flat = r.pebble ? 0.5 : 0.65 + rnd(sd, 3, 113) * 0.25;
      m.compose(p.set(r.x, r.scale * 0.3 * flat, r.z), q, s.set(r.scale * (0.85 + rnd(sd, 4, 114) * 0.4), r.scale * flat, r.scale * (0.85 + rnd(sd, 5, 115) * 0.3)));
      rockRef.current!.setMatrixAt(i, m);
      c.set(season === 'winter' && !r.pebble ? PAL.frost : PAL.stone);
      if (rnd(sd, 6, 116) > 0.6) c.lerp(tc.set(PAL.ochre), 0.18);
      else if (rnd(sd, 7, 117) > 0.6) c.lerp(tc.set(PAL.moss), 0.2);
      c.offsetHSL(0, 0, spread(sd, 8, 118, 0.07));
      rockRef.current!.setColorAt(i, c);
    });

    // Fleurs (zones fertiles) et touffes d'herbe haute (prés)
    flowers.forEach((f, i) => {
      if (f.tuft) {
        q.setFromEuler(e.set(spread(i, 1, 121, 0.3), f.c * Math.PI, spread(i, 2, 122, 0.3)));
        m.compose(p.set(f.x, 0, f.z), q, s.set(0.08 + f.c * 0.05, 0.05 + f.c * 0.04, 0.06));
        c.set(season === 'winter' ? PAL.bone : season === 'autumn' ? PAL.ochre : f.c > 0.5 ? PAL.moss : PAL.forest);
      } else {
        q.setFromEuler(e.set(0, f.c * 6, 0));
        m.compose(p.set(f.x, 0.004, f.z), q, s.set(0.06 + f.c * 0.04, 0.035, 0.06 + f.c * 0.04));
        c.set(season === 'winter' ? PAL.bone : f.c > 0.6 ? PAL.bone : f.c > 0.3 ? PAL.straw : PAL.brick);
      }
      flowerRef.current!.setMatrixAt(i, m);
      flowerRef.current!.setColorAt(i, c);
    });

    for (const mesh of [trunkRef.current, coneRef.current, ballRef.current, rockRef.current, flowerRef.current]) {
      if (!mesh) continue;
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      mesh.computeBoundingSphere();
    }
  }, [trees, pines, rounds, rocks, flowers, season, forest]);

  return (
    <group>
      <instancedMesh matrixAutoUpdate={false} ref={trunkRef} args={[GEO.cylinderLow, undefined, trees.length]} castShadow>
        <meshStandardMaterial color={PAL.umber} flatShading />
      </instancedMesh>
      <instancedMesh matrixAutoUpdate={false} ref={coneRef} args={[PINE, undefined, pines.length * PINE_TIERS]} castShadow receiveShadow>
        <meshStandardMaterial flatShading roughness={0.9} />
      </instancedMesh>
      <instancedMesh matrixAutoUpdate={false} ref={ballRef} args={[BLOB, undefined, rounds.length * ROUND_BLOBS]} castShadow receiveShadow>
        <meshStandardMaterial flatShading roughness={0.9} />
      </instancedMesh>
      <instancedMesh matrixAutoUpdate={false} ref={rockRef} args={[ROUGH.rock, undefined, rocks.length]} castShadow={smallShadows} receiveShadow>
        <meshStandardMaterial flatShading roughness={1} />
      </instancedMesh>
      <instancedMesh matrixAutoUpdate={false} ref={flowerRef} args={[DOT, undefined, flowers.length + clumps.length + PATH_CAP]} receiveShadow>
        <meshStandardMaterial flatShading roughness={0.8} />
      </instancedMesh>
    </group>
  );
}
