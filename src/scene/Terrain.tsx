import { useThree, type ThreeEvent } from '@react-three/fiber';
import { useLayoutEffect, useRef } from 'react';
import * as THREE from 'three';
import { seasonOf, type SeasonId } from '../game/config';
import { hash2 } from '../game/rng';
import { featureAt, ownsParcel, parcelOf } from '../game/parcels';
import { buildingAt, hasModifier } from '../game/rules';
import type { GameMap, TileType } from '../game/types';
import { reinforceCost } from '../game/hazards';
import { wasCameraDrag } from '../vr/clicks';
import { lastDragEnd } from '../vr/Drag';
import { onBuildingPointerDown } from '../vr/grab';
import { FLOOD } from '../game/mechanics/flood';
import { useGame } from '../store/gameStore';
import { tileToWorld } from './shared';
import { PAL } from '../palette';
import { GROUND } from './handmade';

const TILE_COLORS: Record<TileType, string> = {
  grass: PAL.sage,
  fertile: PAL.moss,
  forest: PAL.forest,
  rock: PAL.stone,
  water: PAL.woad,
};

const SNOW = new THREE.Color(PAL.bone);
const LOCKED = new THREE.Color(PAL.ink);
const ICE = new THREE.Color(PAL.frost);
const MUD = new THREE.Color(PAL.umber);
const AUTUMN = new THREE.Color(PAL.ochre);
export function tileColor(type: TileType, season: SeasonId, jitter: number, out: THREE.Color, harsh = false) {
  out.set(TILE_COLORS[type]);
  out.offsetHSL(0, 0, (jitter - 0.5) * 0.05);
  if (season === 'autumn' && type !== 'water' && type !== 'rock') out.lerp(AUTUMN, 0.22 + jitter * 0.12);
  // Hiver rude : neige bien plus épaisse et rivière presque gelée
  if (season === 'winter') out.lerp(type === 'water' ? ICE : SNOW, type === 'water' ? (harsh ? 0.7 : 0.35) : harsh ? 0.92 : 0.65);
  return out;
}

/**
 * Plateau de cases instancié (1 draw call) + gestion du survol / clic. Cases bosselées, nuancées et
 * tournées au hasard ; les touffes d'herbe et les chemins de terre qui cassent le damier sont posés
 * par Nature (taches irrégulières).
 */
export function Terrain({ map }: { map: GameMap }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const season = useGame((s) => seasonOf(s.game.day).id);
  const harsh = useGame((s) => hasModifier(s.game, 'harshWinter'));
  const owned = useGame((s) => s.game.parcels.owned);
  const get = useThree((s) => s.get);
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
    const q = new THREE.Quaternion();
    const c = new THREE.Color();
    const up = new THREE.Vector3(0, 1, 0);
    for (let z = 0; z < map.height; z++) {
      for (let x = 0; x < map.width; x++) {
        const i = z * map.width + x;
        const type = map.tiles[i];
        const [wx, , wz] = tileToWorld(x, z, map.width, map.height);
        const water = type === 'water';
        const h = water ? 0.2 + swell * 0.06 : 0.3;
        // Quart de tour au hasard : les bosses et nuances du dessus ne se répètent pas
        q.setFromAxisAngle(up, Math.floor(hash2(x, z, map.seed + 50) * 4) * (Math.PI / 2));
        m.compose(new THREE.Vector3(wx, (water ? -0.1 + swell * 0.06 : 0) - h / 2, wz), q, new THREE.Vector3(1, h, 1));
        mesh.setMatrixAt(i, m);
        tileColor(type, season, hash2(x, z, map.seed), c, harsh);
        if (water && swell > 0) c.lerp(MUD, swell * 0.65);
        // Parcelles non achetées : assombries
        if (!owned.includes(parcelOf(x, z))) c.lerp(LOCKED, 0.5);
        mesh.setColorAt(i, c);
      }
    }
    mesh.computeBoundingSphere();
  }, [map, season, harsh, owned, swell]);

  const toTile = (e: ThreeEvent<PointerEvent | MouseEvent>) => {
    if (e.instanceId === undefined) return null;
    return { x: e.instanceId % map.width, z: Math.floor(e.instanceId / map.width) };
  };

  return (
    <instancedMesh
      ref={ref}
      matrixAutoUpdate={false}
      args={[GROUND, undefined, count]}
      receiveShadow
      onPointerMove={(e) => {
        e.stopPropagation();
        setHover(toTile(e));
      }}
      onPointerOut={() => setHover(null)}
      onPointerDown={(e) => {
        // VR : saisir un champ (instancié, donc sans groupe propre) pour le déplacer
        const t = toTile(e);
        const b = t ? buildingAt(useGame.getState().game, t.x, t.z) : undefined;
        if (b?.type === 'field') onBuildingPointerDown(e, b.id, get);
      }}
      onClick={(e) => {
        // Ignore les clics qui terminent un glisser de caméra (ou un glisser-déposer VR)
        if (wasCameraDrag(e) || performance.now() - lastDragEnd < 400) return;
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
      <meshStandardMaterial flatShading roughness={0.95} vertexColors />
    </instancedMesh>
  );
}
