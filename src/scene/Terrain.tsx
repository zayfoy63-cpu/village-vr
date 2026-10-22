import type { ThreeEvent } from '@react-three/fiber';
import { useLayoutEffect, useRef } from 'react';
import * as THREE from 'three';
import { seasonOf, type SeasonId } from '../game/config';
import { hash2 } from '../game/rng';
import { featureAt, ownsParcel, parcelOf } from '../game/parcels';
import { buildingAt, hasModifier } from '../game/rules';
import type { GameMap, TileType } from '../game/types';
import { reinforceCost } from '../game/hazards';
import { FLOOD } from '../game/mechanics/flood';
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
const LOCKED = new THREE.Color('#2a2622');
const ICE = new THREE.Color('#9cc7e6');
const MUD = new THREE.Color('#4d5640');

export function tileColor(type: TileType, season: SeasonId, jitter: number, out: THREE.Color, harsh = false) {
  out.set(TILE_COLORS[type]);
  out.offsetHSL(0, 0, (jitter - 0.5) * 0.06);
  if (season === 'autumn' && type !== 'water' && type !== 'rock') out.offsetHSL(-0.04, -0.05, 0);
  // Hiver rude : neige bien plus épaisse et rivière presque gelée
  if (season === 'winter') out.lerp(type === 'water' ? ICE : SNOW, type === 'water' ? (harsh ? 0.7 : 0.35) : harsh ? 0.92 : 0.65);
  return out;
}

/** Plateau de cases instancié (1 draw call) + gestion du survol / clic */
export function Terrain({ map }: { map: GameMap }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const season = useGame((s) => seasonOf(s.game.day).id);
  const harsh = useGame((s) => hasModifier(s.game, 'harshWinter'));
  const owned = useGame((s) => s.game.parcels.owned);
  // Rivière qui gonfle après des jours de pluie : plus sombre, un peu plus haute (indice de crue)
  const swell = useGame((s) => {
    const r = s.game.mech.river;
    return r < FLOOD.hint.darkFrom ? 0 : Math.round(((r - FLOOD.hint.darkFrom) / (1 - FLOOD.hint.darkFrom)) * 10) / 10;
  });
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
        const h = water ? 0.2 + swell * 0.06 : 0.3;
        m.compose(
          new THREE.Vector3(wx, (water ? -0.1 + swell * 0.06 : 0) - h / 2, wz),
          new THREE.Quaternion(),
          new THREE.Vector3(0.995, h, 0.995),
        );
        mesh.setMatrixAt(i, m);
        tileColor(type, season, hash2(x, z, map.seed), c, harsh);
        if (water && swell > 0) c.lerp(MUD, swell * 0.65);
        // Parcelles non achetées : assombries
        if (!owned.includes(parcelOf(x, z))) c.lerp(LOCKED, 0.5);
        mesh.setColorAt(i, c);
      }
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [map, season, harsh, owned, swell]);

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
        if (!t) return;
        const state = useGame.getState();
        // Parcelle non achetée : ouvre son panneau d'achat
        const parcel = parcelOf(t.x, t.z);
        if (!ownsParcel(state.game, parcel)) {
          state.inspectParcel(parcel);
          return;
        }
        const feature = featureAt(state.game, t.x, t.z);
        if (feature) {
          state.inspectFeature(feature.id);
          return;
        }
        const here = buildingAt(state.game, t.x, t.z);
        // Les champs (instanciés) s'éteignent en cliquant sur leur case
        if (here?.fire && here.fire.extinguishEnd === undefined) {
          state.extinguish(here.id);
          return;
        }
        if (here && reinforceCost(state.game, here.id)) {
          state.reinforce(here.id);
          return;
        }
        if (state.selected) build(t.x, t.z);
        else state.inspect(here?.id ?? null);
      }}
      onContextMenu={(e) => {
        e.nativeEvent.preventDefault();
        select(null);
        useGame.getState().inspect(null);
      }}
    >
      <meshStandardMaterial flatShading roughness={0.95} />
    </instancedMesh>
  );
}
