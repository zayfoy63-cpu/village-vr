import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { seasonOf } from '../game/config';
import { tileAt } from '../game/mapgen';
import { hasModifier } from '../game/rules';
import type { GameMap } from '../game/types';
import { useGame } from '../store/gameStore';
import { GEO, tileToWorld } from './shared';

const floodMat = new THREE.MeshStandardMaterial({
  color: '#3f8fd0',
  transparent: true,
  opacity: 0.75,
  roughness: 0.25,
  flatShading: true,
  depthWrite: false,
});

/** Crue : l'eau monte sur les cases qui bordent la rivière, puis redescend (1 draw call) */
export function Flood({ map }: { map: GameMap }) {
  const until = useGame((s) => s.game.floodUntil);
  const ref = useRef<THREE.InstancedMesh>(null);
  const tiles = useMemo(() => {
    const out: [number, number, number][] = [];
    for (let z = 0; z < map.height; z++)
      for (let x = 0; x < map.width; x++) {
        if (tileAt(map, x, z) === 'water') continue;
        let wet = false;
        for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) if (tileAt(map, x + dx, z + dz) === 'water') wet = true;
        if (wet) out.push(tileToWorld(x, z, map.width, map.height));
      }
    return out;
  }, [map]);
  const tmp = useMemo(() => ({ m: new THREE.Matrix4(), q: new THREE.Quaternion(), p: new THREE.Vector3(), s: new THREE.Vector3() }), []);

  useFrame(({ clock }) => {
    const mesh = ref.current;
    if (!mesh) return;
    const g = useGame.getState().game;
    const k = Math.max(0, Math.min(1, (until - (g.day + g.dayProgress)) / 1));
    // Monte vite, redescend lentement, avec une petite houle
    const level = Math.sin(Math.min(1, (1 - k) * 4) * Math.PI * 0.5) * k * 0.14;
    tiles.forEach(([x, , z], i) => {
      const wave = Math.sin(clock.elapsedTime * 2 + x + z) * 0.01;
      mesh.setMatrixAt(i, tmp.m.compose(tmp.p.set(x, level / 2 + wave, z), tmp.q, tmp.s.set(1.001, Math.max(0.001, level), 1.001)));
    });
    mesh.count = level > 0.002 ? tiles.length : 0;
    mesh.instanceMatrix.needsUpdate = true;
  });

  const now = useGame.getState().game;
  if (until <= now.day + now.dayProgress - 0.01) return null;
  return <instancedMesh ref={ref} args={[GEO.box, floodMat, Math.max(1, tiles.length)]} frustumCulled={false} />;
}

const snowMat = new THREE.MeshBasicMaterial({ color: '#ffffff' });
const MAX_FLAKES = 450;

/** Flocons en hiver ; beaucoup plus pendant un hiver rude (1 draw call) */
export function Snowfall({ map }: { map: GameMap }) {
  const winter = useGame((s) => seasonOf(s.game.day).id === 'winter');
  const harsh = useGame((s) => hasModifier(s.game, 'harshWinter'));
  const ref = useRef<THREE.InstancedMesh>(null);
  const flakes = useMemo(
    () =>
      Array.from({ length: MAX_FLAKES }, (_, i) => ({
        x: ((i * 7919) % 1000) / 1000 - 0.5,
        z: ((i * 104729) % 1000) / 1000 - 0.5,
        phase: ((i * 3571) % 1000) / 1000,
        speed: 0.6 + ((i * 31) % 100) / 200,
      })),
    [],
  );
  const tmp = useMemo(() => ({ m: new THREE.Matrix4(), q: new THREE.Quaternion(), p: new THREE.Vector3(), s: new THREE.Vector3() }), []);
  const count = harsh ? MAX_FLAKES : winter ? 140 : 0;

  useFrame(({ clock }) => {
    const mesh = ref.current;
    if (!mesh) return;
    const t = clock.elapsedTime;
    const H = 7;
    for (let i = 0; i < count; i++) {
      const f = flakes[i];
      const y = H - ((t * f.speed * (harsh ? 1.6 : 1) + f.phase * H) % H);
      const drift = Math.sin(t * 0.8 + f.phase * 10) * 0.3 + (harsh ? (H - y) * 0.25 : 0);
      tmp.p.set(f.x * map.width + drift, y, f.z * map.height);
      mesh.setMatrixAt(i, tmp.m.compose(tmp.p, tmp.q, tmp.s.setScalar(harsh ? 0.05 : 0.04)));
    }
    mesh.count = count;
    mesh.instanceMatrix.needsUpdate = true;
  });

  if (!count) return null;
  return <instancedMesh ref={ref} args={[GEO.box, snowMat, MAX_FLAKES]} frustumCulled={false} />;
}
