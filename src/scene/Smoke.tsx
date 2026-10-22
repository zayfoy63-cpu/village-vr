import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { BUILDING_BY_ID } from '../game/buildings';
import type { Building, BuildingTypeId, GameMap } from '../game/types';
import { useGame } from '../store/gameStore';
import { CASTLE_CHIMNEY } from './models/Castle';
import { HOUSE_CHIMNEY, houseRotation } from './models/House';
import { HUT_CHIMNEYS, MANOR_CHIMNEYS, TOWNHOUSE_CHIMNEYS } from './models/Housing';
import { BAKERY_CHIMNEYS, FORGE_CHIMNEYS } from './models/Craft';
import { LUMBER_CHIMNEYS } from './models/Lumber';
import { QUARRY_CHIMNEYS } from './models/Quarry';

/** Cheminées qui n'apparaissent qu'à certains niveaux (bâtiments de production, non tournés) */
const LEVEL_CHIMNEYS: Partial<Record<BuildingTypeId, Record<number, [number, number, number][]>>> = {
  lumber: LUMBER_CHIMNEYS,
  quarry: QUARRY_CHIMNEYS,
  bakery: BAKERY_CHIMNEYS,
  forge: FORGE_CHIMNEYS,
};
import { GEO, tileToWorld } from './shared';

const PUFFS = 4;

/** Cheminées par type de bâtiment (coordonnées locales avant rotation) */
const CHIMNEYS: Partial<Record<BuildingTypeId, [number, number, number][]>> = {
  castle: [CASTLE_CHIMNEY],
  hut: HUT_CHIMNEYS,
  house: [HOUSE_CHIMNEY],
  townhouse: TOWNHOUSE_CHIMNEYS,
  manor: MANOR_CHIMNEYS,
};
const MAX_CHIMNEYS = 120;

/** Fumée des cheminées : petites boules qui montent, grossissent puis disparaissent (1 draw call) */
export function Smoke({ buildings, map }: { buildings: Building[]; map: GameMap }) {
  const ref = useRef<THREE.InstancedMesh>(null);

  const chimneys = useMemo(() => {
    const out: { p: THREE.Vector3; home: boolean }[] = [];
    const up = new THREE.Vector3(0, 1, 0);
    for (const b of buildings) {
      const locals = CHIMNEYS[b.type] ?? LEVEL_CHIMNEYS[b.type]?.[b.level];
      if (!locals) continue;
      const [x, y, z] = tileToWorld(b.x, b.z, map.width, map.height, BUILDING_BY_ID[b.type].size);
      for (const l of locals) {
        const local = new THREE.Vector3(...l);
        // Seules les habitations sont tournées selon leur id
        if (CHIMNEYS[b.type] && b.type !== 'castle') local.applyAxisAngle(up, houseRotation(b.id));
        // home : cheminée d'habitation (éteinte quand il n'y a plus de bois de chauffage)
        out.push({ p: local.add(new THREE.Vector3(x, y, z)), home: !!CHIMNEYS[b.type] });
      }
      if (out.length >= MAX_CHIMNEYS) break;
    }
    return out.slice(0, MAX_CHIMNEYS);
  }, [buildings, map]);

  const tmp = useMemo(
    () => ({ m: new THREE.Matrix4(), q: new THREE.Quaternion(), p: new THREE.Vector3(), s: new THREE.Vector3() }),
    [],
  );

  useFrame(({ clock }) => {
    const mesh = ref.current;
    if (!mesh) return;
    const t = clock.elapsedTime;
    // Plus de bois de chauffage : les foyers s'éteignent (indice du froid)
    const cold = useGame.getState().game.mech.cold > 0;
    let i = 0;
    chimneys.forEach(({ p: c, home }, ci) => {
      if (cold && home) return;
      for (let k = 0; k < PUFFS; k++) {
        const life = (t * 0.28 + k / PUFFS + ci * 0.137) % 1;
        const size = Math.sin(life * Math.PI) * (0.09 + life * 0.14);
        tmp.p.set(c.x + Math.sin(t + ci + k) * 0.04 + life * 0.18, c.y + life * 0.9, c.z + life * 0.05);
        tmp.m.compose(tmp.p, tmp.q, tmp.s.setScalar(Math.max(0.001, size)));
        mesh.setMatrixAt(i++, tmp.m);
      }
    });
    mesh.count = i;
    mesh.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={ref} args={[GEO.ball, undefined, MAX_CHIMNEYS * PUFFS]} frustumCulled={false}>
      <meshStandardMaterial color="#d9d4cc" flatShading transparent opacity={0.75} depthWrite={false} />
    </instancedMesh>
  );
}
