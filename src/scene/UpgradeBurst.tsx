import { useFrame } from '@react-three/fiber';
import { useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { GEO } from './shared';
import { PAL } from '../palette';

const DURATION = 1.2;
const SPARKS = 22;
const DUST = 12;

const sparkMat = new THREE.MeshStandardMaterial({
  color: PAL.straw,
  emissive: new THREE.Color(PAL.straw),
  emissiveIntensity: 1.8,
  flatShading: true,
});
const dustMat = new THREE.MeshStandardMaterial({ color: PAL.parchment, flatShading: true, transparent: true, opacity: 0.8, depthWrite: false });

/**
 * Effet ponctuel : gerbe d'étincelles dorées (amélioration) et anneau de poussière.
 * 2 draw calls, se démonte tout seul après ~1 s.
 */
export function UpgradeBurst({ kind = 'upgrade', size = 1 }: { kind?: 'upgrade' | 'build'; size?: number }) {
  const sparks = useRef<THREE.InstancedMesh>(null);
  const dust = useRef<THREE.InstancedMesh>(null);
  const t = useRef(0);
  const [done, setDone] = useState(false);
  const seeds = useMemo(
    () =>
      Array.from({ length: SPARKS }, (_, i) => ({
        a: (i / SPARKS) * Math.PI * 2 + Math.sin(i * 12.9) * 0.4,
        up: 1.4 + ((i * 37) % 10) / 10,
        out: 0.5 + ((i * 53) % 10) / 20,
      })),
    [],
  );
  const tmp = useMemo(() => ({ m: new THREE.Matrix4(), q: new THREE.Quaternion(), p: new THREE.Vector3(), s: new THREE.Vector3() }), []);

  useFrame((_, dt) => {
    if (done) return;
    t.current += dt;
    const k = t.current / DURATION;
    if (k >= 1) {
      setDone(true);
      return;
    }
    if (sparks.current && kind === 'upgrade') {
      seeds.forEach((sd, i) => {
        // Trajectoire balistique : monte puis retombe en s'éloignant
        const r = sd.out * k * size;
        const y = 0.3 + sd.up * k - 1.8 * k * k;
        const sc = 0.1 * (1 - k) + 0.01;
        tmp.m.compose(tmp.p.set(Math.cos(sd.a) * r, Math.max(0.02, y), Math.sin(sd.a) * r), tmp.q, tmp.s.setScalar(sc));
        sparks.current!.setMatrixAt(i, tmp.m);
      });
      sparks.current.instanceMatrix.needsUpdate = true;
    }
    if (dust.current) {
      for (let i = 0; i < DUST; i++) {
        const a = (i / DUST) * Math.PI * 2;
        const r = (0.35 + k * 0.45) * size;
        const sc = 0.12 * Math.sin(Math.min(1, k * 1.3) * Math.PI) + 0.005;
        tmp.m.compose(tmp.p.set(Math.cos(a) * r, 0.05 + k * 0.1, Math.sin(a) * r), tmp.q, tmp.s.setScalar(sc));
        dust.current.setMatrixAt(i, tmp.m);
      }
      dust.current.instanceMatrix.needsUpdate = true;
    }
  });

  if (done) return null;
  return (
    <group>
      {kind === 'upgrade' && <instancedMesh ref={sparks} args={[GEO.ball, sparkMat, SPARKS]} frustumCulled={false} />}
      <instancedMesh ref={dust} args={[GEO.ball, dustMat, DUST]} frustumCulled={false} />
    </group>
  );
}
