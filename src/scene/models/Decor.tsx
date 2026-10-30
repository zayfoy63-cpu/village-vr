// Éléments de décor réutilisés par les modèles améliorables : toit de tuiles, bannière animée,
// clôture, roue qui tourne, torche, cheminée. Tous en primitives partagées (low-poly).

import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import type * as THREE from 'three';
import { ambientRate } from '../ambient';
import type { MAT } from '../shared';
import { Part } from './Part';

type V3 = [number, number, number];
type MatKey = keyof typeof MAT;

/** Toit à deux pans en tuiles : faîtage selon z (rotY pour le tourner), rangées de tuiles plus sombres */
export function TileRoof({ p, w, h, d, rotY = 0, m = 'roofTile' }: { p: V3; w: number; h: number; d: number; rotY?: number; m?: MatKey }) {
  const rows = [0.22, 0.48, 0.74];
  return (
    <group position={p} rotation={[0, rotY, 0]}>
      <Part g="gable" m={m} s={[w, h, d]} />
      {[-1, 1].flatMap((side) =>
        rows.map((f) => (
          <Part
            key={`${side}${f}`}
            g="box"
            m="roofTileDark"
            p={[side * (w / 2) * (1 - f) + side * 0.008, h * f + 0.006, 0]}
            s={[0.025, 0.025, d + 0.01]}
            shadow={false}
          />
        )),
      )}
      <Part g="box" m="roofTileDark" p={[0, h, 0]} s={[0.04, 0.04, d + 0.03]} shadow={false} />
    </group>
  );
}

/** Bannière sur mât qui ondule au vent */
export function Banner({ p, h = 0.5, m = 'cloth' }: { p: V3; h?: number; m?: MatKey }) {
  const cloth = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (cloth.current) cloth.current.rotation.y = Math.sin(clock.elapsedTime * 3 + p[0] * 5) * 0.35;
  });
  return (
    <group position={p}>
      <Part g="cylinderLow" m="timber" p={[0, h / 2, 0]} s={[0.022, h, 0.022]} />
      <Part g="ball" m="paintYellow" p={[0, h + 0.02, 0]} s={0.04} shadow={false} />
      <group ref={cloth} position={[0, h - 0.08, 0]}>
        <Part g="box" m={m} p={[0.08, 0, 0]} s={[0.15, 0.13, 0.012]} shadow={false} />
      </group>
    </group>
  );
}

/** Clôture rectangulaire en bois (poteaux + deux lisses) autour d'une zone */
export function Fence({ w, d, p = [0, 0, 0], m = 'woodLight', gap = 'front' }: { w: number; d: number; p?: V3; m?: MatKey; gap?: 'front' | 'none' }) {
  const posts: V3[] = [];
  const nx = Math.max(2, Math.round(w / 0.22));
  const nz = Math.max(2, Math.round(d / 0.22));
  for (let i = 0; i <= nx; i++) {
    const x = -w / 2 + (i * w) / nx;
    posts.push([x, 0, -d / 2]);
    if (gap === 'none' || Math.abs(x) > 0.12) posts.push([x, 0, d / 2]);
  }
  for (let i = 1; i < nz; i++) {
    const z = -d / 2 + (i * d) / nz;
    posts.push([-w / 2, 0, z], [w / 2, 0, z]);
  }
  const half = (w - 0.24) / 2;
  return (
    <group position={p}>
      {posts.map((q, i) => (
        <Part key={i} g="box" m={m} p={[q[0], 0.07, q[2]]} s={[0.025, 0.14, 0.025]} shadow={false} />
      ))}
      {[0.05, 0.11].map((y) => (
        <group key={y}>
          <Part g="box" m={m} p={[0, y, -d / 2]} s={[w, 0.015, 0.012]} shadow={false} />
          <Part g="box" m={m} p={[-w / 2, y, 0]} s={[0.012, 0.015, d]} shadow={false} />
          <Part g="box" m={m} p={[w / 2, y, 0]} s={[0.012, 0.015, d]} shadow={false} />
          {gap === 'none' ? (
            <Part g="box" m={m} p={[0, y, d / 2]} s={[w, 0.015, 0.012]} shadow={false} />
          ) : (
            <>
              <Part g="box" m={m} p={[-w / 2 + half / 2, y, d / 2]} s={[half, 0.015, 0.012]} shadow={false} />
              <Part g="box" m={m} p={[w / 2 - half / 2, y, d / 2]} s={[half, 0.015, 0.012]} shadow={false} />
            </>
          )}
        </group>
      ))}
    </group>
  );
}

/** Groupe qui tourne en continu (roue, scie, poulie) ; s'arrête en pause, mais garde sa vitesse naturelle en x2 */
export function Spinner({ p, axis = 'x', speed = 1.5, children }: { p: V3; axis?: 'x' | 'y' | 'z'; speed?: number; children: React.ReactNode }) {
  const ref = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (ref.current) ref.current.rotation[axis] += dt * speed * ambientRate();
  });
  return (
    <group position={p}>
      <group ref={ref}>{children}</group>
    </group>
  );
}

/** Roue à rayons (moulin à eau, roue de carrière, scie) dans le plan yz : tourne autour de x */
export function Wheel({ r, m = 'woodLight', spokes = 6 }: { r: number; m?: MatKey; spokes?: number }) {
  return (
    <group>
      <Part g="cylinder" m={m} s={[r * 2, 0.03, r * 2]} r={[0, 0, Math.PI / 2]} />
      {Array.from({ length: spokes }, (_, i) => (
        <Part key={i} g="box" m="timber" p={[0.02, 0, 0]} s={[0.02, r * 2.1, 0.025]} r={[(i * Math.PI) / spokes, 0, 0]} shadow={false} />
      ))}
    </group>
  );
}

/** Torche à flamme vacillante */
export function Torch({ p }: { p: V3 }) {
  const flame = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (flame.current) flame.current.scale.setScalar(0.85 + Math.sin(clock.elapsedTime * 17 + p[0] * 9) * 0.15);
  });
  return (
    <group position={p}>
      <Part g="cylinderLow" m="timber" p={[0, 0.06, 0]} s={[0.02, 0.12, 0.02]} shadow={false} />
      <group ref={flame} position={[0, 0.14, 0]}>
        <Part g="cone6" m="window" s={[0.05, 0.08, 0.05]} shadow={false} />
      </group>
    </group>
  );
}

/** Cheminée en pierre (la fumée est ajoutée par Smoke.tsx via CHIMNEYS) */
export function Chimney({ p, h = 0.3 }: { p: V3; h?: number }) {
  return <Part g="box" m="stoneDark" p={[p[0], p[1] - h / 2, p[2]]} s={[0.08, h, 0.08]} />;
}
