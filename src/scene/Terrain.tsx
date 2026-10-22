import type { ThreeEvent } from '@react-three/fiber';
import { useLayoutEffect, useRef } from 'react';
import * as THREE from 'three';
import { seasonOf, type SeasonId } from '../game/config';
import { hash2 } from '../game/rng';
import type { GameMap, TileType } from '../game/types';
import { useGame } from '../store/gameStore';
import { GEO, tileToWorld } from './shared';

const TILE_COLORS: Record<TileType, string> = {
  grass: '#94c257',
  fertile: '#4f9a2c',
  forest: '#4f7d33',
  rock: '#8f9478',
  water: '#3f93d6',
};

const SNOW = new THREE.Color('#eef3f7');
const ICE = new THREE.Color('#9cc7e6');

export function tileColor(type: TileType, season: SeasonId, jitter: number, out: THREE.Color) {
  out.set(TILE_COLORS[type]);
  out.offsetHSL(0, 0, (jitter - 0.5) * 0.06);
  if (season === 'autumn' && type !== 'water' && type !== 'rock') out.offsetHSL(-0.04, -0.05, 0);
  if (season === 'winter') out.lerp(type === 'water' ? ICE : SNOW, type === 'water' ? 0.35 : 0.65);
  return out;
}

/** Plateau de cases instancié (1 draw call) + gestion du survol / clic */
export function Terrain({ map }: { map: GameMap }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const season = useGame((s) => seasonOf(s.game.day).id);
  const setHover = useGame((s) => s.setHover);
  const build = useGame((s) => s.build);
  const select = useGame((s) => s.select);
  const count = map.width * map.height;

  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const m = new THREE.Matrix4();
    const c = new THREE.Color();
    for (let z = 0; z < map.height; z++) {
      for (let x = 0; x < map.width; x++) {
        const i = z * map.width + x;
        const type = map.tiles[i];
        const [wx, , wz] = tileToWorld(x, z, map.width, map.height);
        const water = type === 'water';
        const h = water ? 0.2 : 0.3;
        m.compose(
          new THREE.Vector3(wx, (water ? -0.1 : 0) - h / 2, wz),
          new THREE.Quaternion(),
          new THREE.Vector3(0.995, h, 0.995),
        );
        mesh.setMatrixAt(i, m);
        mesh.setColorAt(i, tileColor(type, season, hash2(x, z, map.seed), c));
      }
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [map, season]);

  const toTile = (e: ThreeEvent<PointerEvent | MouseEvent>) => {
    if (e.instanceId === undefined) return null;
    return { x: e.instanceId % map.width, z: Math.floor(e.instanceId / map.width) };
  };

  return (
    <instancedMesh
      ref={ref}
      args={[GEO.box, undefined, count]}
      receiveShadow
      onPointerMove={(e) => {
        e.stopPropagation();
        setHover(toTile(e));
      }}
      onPointerOut={() => setHover(null)}
      onClick={(e) => {
        // Ignore les clics qui terminent un glisser de caméra
        if (e.delta > 6) return;
        e.stopPropagation();
        const t = toTile(e);
        if (t) build(t.x, t.z);
      }}
      onContextMenu={(e) => {
        e.nativeEvent.preventDefault();
        select(null);
      }}
    >
      <meshStandardMaterial flatShading roughness={0.95} />
    </instancedMesh>
  );
}
