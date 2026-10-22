import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { BUILDING_BY_ID } from '../game/buildings';
import type { Building, GameMap } from '../game/types';
import { CASTLE_CHIMNEY } from './models/Castle';
import { HOUSE_CHIMNEY, houseRotation } from './models/House';
import { GEO, tileToWorld } from './shared';

const PUFFS = 4;
const MAX_CHIMNEYS = 120;

/** Fumée des cheminées : petites boules qui montent, grossissent puis disparaissent (1 draw call) */
export function Smoke({ buildings, map }: { buildings: Building[]; map: GameMap }) {
  const ref = useRef<THREE.InstancedMesh>(null);

  const chimneys = useMemo(() => {
    const out: THREE.Vector3[] = [];
    for (const b of buildings) {
      if (b.type !== 'house' && b.type !== 'castle') continue;
      const [x, y, z] = tileToWorld(b.x, b.z, map.width, map.height, BUILDING_BY_ID[b.type].size);
      const local = new THREE.Vector3(...(b.type === 'house' ? HOUSE_CHIMNEY : CASTLE_CHIMNEY));
      if (b.type === 'house') local.applyAxisAngle(new THREE.Vector3(0, 1, 0), houseRotation(b.id));
      out.push(local.add(new THREE.Vector3(x, y, z)));
      if (out.length >= MAX_CHIMNEYS) break;
    }
    return out;
  }, [buildings, map]);

  const tmp = useMemo(
    () => ({ m: new THREE.Matrix4(), q: new THREE.Quaternion(), p: new THREE.Vector3(), s: new THREE.Vector3() }),
    [],
  );

  useFrame(({ clock }) => {
    const mesh = ref.current;
    if (!mesh) return;
    const t = clock.elapsedTime;
    let i = 0;
    chimneys.forEach((c, ci) => {
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
