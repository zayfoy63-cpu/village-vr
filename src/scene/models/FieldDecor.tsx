import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import type * as THREE from 'three';
import { Banner, Fence } from './Decor';
import { Part } from './Part';

/** Épouvantail dont les bras oscillent au vent */
function Scarecrow({ p }: { p: [number, number, number] }) {
  const arms = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (arms.current) arms.current.rotation.z = Math.sin(clock.elapsedTime * 2.2 + p[0] * 7) * 0.12;
  });
  return (
    <group position={p}>
      <Part g="box" m="timber" p={[0, 0.17, 0]} s={[0.02, 0.34, 0.02]} />
      <group ref={arms} position={[0, 0.26, 0]}>
        <Part g="box" m="timber" s={[0.22, 0.018, 0.018]} shadow={false} />
        <Part g="box" m="cloth" p={[0, -0.04, 0]} s={[0.1, 0.1, 0.05]} shadow={false} />
      </group>
      <Part g="ball" m="hay" p={[0, 0.36, 0]} s={0.07} shadow={false} />
      <Part g="cone6" m="woodRaw" p={[0, 0.41, 0]} s={[0.1, 0.05, 0.1]} shadow={false} />
    </group>
  );
}

/**
 * Décor posé au-dessus des rangées instanciées (Fields.tsx).
 * Niv. 1 : champ nu. Niv. 2 : clôture en bois. Niv. 3 : muret de pierre, épouvantail, bannière.
 */
export function FieldDecor({ level = 1 }: { level?: number }) {
  if (level <= 1) return null;
  if (level === 2) return <Fence w={0.94} d={0.94} m="woodLight" />;
  const wall = 0.47;
  return (
    <group>
      {[
        [0, wall, 0.96, 0.05],
        [0, -wall, 0.96, 0.05],
        [wall, 0, 0.05, 0.96],
        [-wall, 0, 0.05, 0.96],
      ].map(([x, z, sx, sz], i) =>
        i === 0 ? (
          <group key={i}>
            <Part g="box" m="stoneLight" p={[-0.28, 0.04, z]} s={[0.4, 0.08, sz]} />
            <Part g="box" m="stoneLight" p={[0.28, 0.04, z]} s={[0.4, 0.08, sz]} />
          </group>
        ) : (
          <Part key={i} g="box" m="stoneLight" p={[x, 0.04, z]} s={[sx, 0.08, sz]} />
        ),
      )}
      <Scarecrow p={[0.12, 0.04, 0.05]} />
      <Banner p={[-0.42, 0.06, 0.42]} h={0.45} m="paintGreen" />
    </group>
  );
}
