import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { seasonOf, type SeasonId } from '../game/config';
import { DEFORESTATION } from '../game/mechanics/deforestation';
import { hash2 } from '../game/rng';
import type { GameMap } from '../game/types';
import { useGame } from '../store/gameStore';
import { GEO, tileToWorld } from './shared';
import { useSmallShadows } from './quality';

interface TreeSpot {
  x: number;
  z: number;
  scale: number;
  pine: boolean;
  /** Case et rang de l'arbre dans sa case (déforestation : les arbres disparaissent un à un) */
  tile: number;
  rank: number;
}

interface RockSpot {
  x: number;
  z: number;
  scale: number;
  rot: number;
}

const LEAF_COLORS: Record<SeasonId, string> = {
  spring: '#7cc04a',
  summer: '#4f9a35',
  autumn: '#d98a2b',
  winter: '#e8eef0',
};

function layout(map: GameMap) {
  const trees: TreeSpot[] = [];
  const rocks: RockSpot[] = [];
  const flowers: { x: number; z: number; c: number }[] = [];
  for (let z = 0; z < map.height; z++) {
    for (let x = 0; x < map.width; x++) {
      const type = map.tiles[z * map.width + x];
      const [cx, , cz] = tileToWorld(x, z, map.width, map.height);
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
  return { trees, rocks, flowers };
}

/** Arbres (cônes / boules) et rochers, entièrement instanciés : 5 draw calls au total */
export function Nature({ map }: { map: GameMap }) {
  const smallShadows = useSmallShadows();
  const { trees, rocks, flowers } = useMemo(() => layout(map), [map]);
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

  useLayoutEffect(() => {
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const p = new THREE.Vector3();
    const s = new THREE.Vector3();
    const c = new THREE.Color();

    // Arbre encore debout ? Sinon une souche. Les survivants rapetissent avec la santé de la forêt.
    const health = (t: TreeSpot) => forest[t.tile] ?? 1;
    const standing = (t: TreeSpot) => health(t) >= DEFORESTATION.effect.clearedBelow && health(t) >= t.rank * DEFORESTATION.hint.thinFrom;
    const size = (t: TreeSpot) => (standing(t) ? t.scale * (0.6 + 0.4 * health(t)) : 0.0001);
    trees.forEach((t, i) => {
      if (standing(t)) {
        const k = size(t);
        m.compose(p.set(t.x, 0.12 * k, t.z), q.identity(), s.set(0.08 * k, 0.24 * k, 0.08 * k));
      } else {
        m.compose(p.set(t.x, 0.025, t.z), q.identity(), s.set(0.09, 0.05, 0.09));
      }
      trunkRef.current!.setMatrixAt(i, m);
    });

    pines.forEach((tree, i) => {
      const t = { ...tree, scale: size(tree) };
      // Deux cônes empilés par sapin
      m.compose(p.set(t.x, 0.42 * t.scale, t.z), q.identity(), s.set(0.42 * t.scale, 0.5 * t.scale, 0.42 * t.scale));
      coneRef.current!.setMatrixAt(i * 2, m);
      m.compose(p.set(t.x, 0.68 * t.scale, t.z), q.identity(), s.set(0.3 * t.scale, 0.4 * t.scale, 0.3 * t.scale));
      coneRef.current!.setMatrixAt(i * 2 + 1, m);
      c.set(season === 'winter' ? '#a9c4b4' : '#2f6b34').offsetHSL(0, 0, (tree.scale - 1) * 0.05);
      coneRef.current!.setColorAt(i * 2, c);
      coneRef.current!.setColorAt(i * 2 + 1, c);
    });

    rounds.forEach((tree, i) => {
      const t = { ...tree, scale: size(tree) };
      m.compose(p.set(t.x, 0.45 * t.scale, t.z), q.identity(), s.set(0.42 * t.scale, 0.42 * t.scale, 0.42 * t.scale));
      ballRef.current!.setMatrixAt(i, m);
      c.set(LEAF_COLORS[season]).offsetHSL((tree.scale - 1) * 0.04, 0, (tree.scale - 1) * 0.06);
      ballRef.current!.setColorAt(i, c);
    });

    rocks.forEach((r, i) => {
      q.setFromEuler(new THREE.Euler(r.rot * 0.3, r.rot, 0));
      m.compose(p.set(r.x, r.scale * 0.3, r.z), q, s.set(r.scale, r.scale * 0.75, r.scale));
      rockRef.current!.setMatrixAt(i, m);
      c.set(season === 'winter' ? '#c9ccd0' : '#8b8d8f').offsetHSL(0, 0, (r.scale - 0.35) * 0.3);
      rockRef.current!.setColorAt(i, c);
    });

    flowers.forEach((f, i) => {
      m.compose(p.set(f.x, 0.03, f.z), q.identity(), s.setScalar(0.07));
      flowerRef.current!.setMatrixAt(i, m);
      c.set(season === 'winter' ? '#e8eef0' : f.c > 0.6 ? '#ffffff' : f.c > 0.3 ? '#f4d03f' : '#e57373');
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
        <meshStandardMaterial color="#6b4428" flatShading />
      </instancedMesh>
      <instancedMesh matrixAutoUpdate={false} ref={coneRef} args={[GEO.cone6, undefined, pines.length * 2]} castShadow receiveShadow>
        <meshStandardMaterial flatShading roughness={0.9} />
      </instancedMesh>
      <instancedMesh matrixAutoUpdate={false} ref={ballRef} args={[GEO.ball, undefined, rounds.length]} castShadow receiveShadow>
        <meshStandardMaterial flatShading roughness={0.9} />
      </instancedMesh>
      <instancedMesh matrixAutoUpdate={false} ref={rockRef} args={[GEO.rock, undefined, rocks.length]} castShadow={smallShadows} receiveShadow>
        <meshStandardMaterial flatShading roughness={1} />
      </instancedMesh>
      <instancedMesh matrixAutoUpdate={false} ref={flowerRef} args={[GEO.ball, undefined, flowers.length]}>
        <meshStandardMaterial flatShading roughness={0.8} />
      </instancedMesh>
    </group>
  );
}
