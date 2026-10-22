import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { BUILDING_BY_ID } from '../game/buildings';
import type { Building, GameMap } from '../game/types';
import { useGame } from '../store/gameStore';
import { GEO, tileToWorld } from './shared';

const MAX_FIRES = 24;
const FLAMES = 4;
const SMOKE = 4;
const DROPS = 6;

const flameMat = new THREE.MeshStandardMaterial({
  color: '#ff8a1f',
  emissive: new THREE.Color('#ff5a00'),
  emissiveIntensity: 1.6,
  flatShading: true,
  transparent: true,
  opacity: 0.92,
});
const coreMat = new THREE.MeshStandardMaterial({ color: '#ffe066', emissive: new THREE.Color('#ffc400'), emissiveIntensity: 2, flatShading: true });
const smokeMat = new THREE.MeshStandardMaterial({ color: '#2f2a27', flatShading: true, transparent: true, opacity: 0.7, depthWrite: false });
const dropMat = new THREE.MeshStandardMaterial({ color: '#7cc4ff', emissive: new THREE.Color('#2a7fd4'), emissiveIntensity: 0.6, flatShading: true });

/**
 * Flammes, fumée noire et gouttes d'eau (pendant l'extinction) sur les bâtiments en feu.
 * 4 draw calls au total, quel que soit le nombre d'incendies (plafonné à 24).
 */
export function FireFx({ buildings, map }: { buildings: Building[]; map: GameMap }) {
  const flames = useRef<THREE.InstancedMesh>(null);
  const cores = useRef<THREE.InstancedMesh>(null);
  const smoke = useRef<THREE.InstancedMesh>(null);
  const drops = useRef<THREE.InstancedMesh>(null);

  const fires = useMemo(
    () =>
      buildings
        .filter((b) => b.fire)
        .slice(0, MAX_FIRES)
        .map((b) => {
          const size = BUILDING_BY_ID[b.type].size;
          const [x, y, z] = tileToWorld(b.x, b.z, map.width, map.height, size);
          return { id: b.id, x, y, z, size, fire: b.fire! };
        }),
    [buildings, map],
  );

  const tmp = useMemo(() => ({ m: new THREE.Matrix4(), q: new THREE.Quaternion(), p: new THREE.Vector3(), s: new THREE.Vector3() }), []);

  useFrame(({ clock }) => {
    if (!flames.current || !cores.current || !smoke.current || !drops.current) return;
    const t = clock.elapsedTime;
    const g = useGame.getState().game;
    const now = g.day + g.dayProgress;
    let fi = 0;
    let si = 0;
    let di = 0;
    fires.forEach((f, n) => {
      const spread = 0.28 * f.size;
      // Pendant l'extinction, les flammes rapetissent
      const ext = f.fire.extinguishEnd;
      const k = ext !== undefined ? Math.max(0.05, (ext - now) / 0.1) : Math.min(1, 0.4 + (now - f.fire.start) * 3);
      for (let i = 0; i < FLAMES; i++) {
        const a = (i / FLAMES) * Math.PI * 2 + n;
        const flick = 0.75 + 0.25 * Math.sin(t * 12 + i * 2.1 + n);
        // Les flammes partent du toit et le dépassent nettement
        const h = (0.6 + 0.35 * Math.sin(t * 7 + i)) * k * flick;
        const base = 0.15 + (i % 2) * 0.35;
        tmp.p.set(f.x + Math.cos(a) * spread * 0.55, base + h / 2, f.z + Math.sin(a) * spread * 0.55);
        tmp.m.compose(tmp.p, tmp.q, tmp.s.set(0.42 * k + 0.02, h + 0.01, 0.42 * k + 0.02));
        flames.current!.setMatrixAt(fi, tmp.m);
        tmp.p.y = base + h * 0.3;
        tmp.m.compose(tmp.p, tmp.q, tmp.s.set(0.2 * k + 0.01, h * 0.6 + 0.01, 0.2 * k + 0.01));
        cores.current!.setMatrixAt(fi++, tmp.m);
      }
      for (let i = 0; i < SMOKE; i++) {
        const life = (t * 0.45 + i / SMOKE + n * 0.31) % 1;
        const size = Math.sin(life * Math.PI) * (0.18 + life * 0.25) * (0.5 + k * 0.5);
        tmp.p.set(f.x + Math.sin(t + i) * 0.08 + life * 0.3, 1.0 + life * 1.6, f.z + life * 0.1);
        tmp.m.compose(tmp.p, tmp.q, tmp.s.setScalar(Math.max(0.001, size)));
        smoke.current!.setMatrixAt(si++, tmp.m);
      }
      if (ext !== undefined) {
        for (let i = 0; i < DROPS; i++) {
          const life = (t * 1.6 + i / DROPS) % 1;
          const a = (i / DROPS) * Math.PI * 2;
          tmp.p.set(f.x + Math.cos(a) * 0.35 * (1 - life), 0.9 - life * 0.8, f.z + Math.sin(a) * 0.35 * (1 - life));
          tmp.m.compose(tmp.p, tmp.q, tmp.s.setScalar(0.05));
          drops.current!.setMatrixAt(di++, tmp.m);
        }
      }
    });
    flames.current.count = fi;
    cores.current.count = fi;
    smoke.current.count = si;
    drops.current.count = di;
    for (const mesh of [flames.current, cores.current, smoke.current, drops.current]) mesh.instanceMatrix.needsUpdate = true;
  });

  if (!fires.length) return null;
  return (
    <group>
      <instancedMesh ref={flames} args={[GEO.cone6, flameMat, MAX_FIRES * FLAMES]} frustumCulled={false} />
      <instancedMesh ref={cores} args={[GEO.cone6, coreMat, MAX_FIRES * FLAMES]} frustumCulled={false} />
      <instancedMesh ref={smoke} args={[GEO.ball, smokeMat, MAX_FIRES * SMOKE]} frustumCulled={false} />
      <instancedMesh ref={drops} args={[GEO.ball, dropMat, MAX_FIRES * DROPS]} frustumCulled={false} />
    </group>
  );
}
