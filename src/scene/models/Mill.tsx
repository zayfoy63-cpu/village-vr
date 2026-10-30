import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import type * as THREE from 'three';
import { ambientRate } from '../ambient';
import { Part } from './Part';

/** Moulin à vent : tour, toit conique et pales qui tournent */
export function Mill() {
  const blades = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (blades.current) blades.current.rotation.z += dt * ambientRate();
  });
  return (
    <group rotation={[0, Math.PI / 5, 0]}>
      <Part g="cylinder" m="wall" p={[0, 0.42, 0]} s={[0.5, 0.84, 0.5]} />
      <Part g="cylinder" m="timber" p={[0, 0.08, 0]} s={[0.56, 0.16, 0.56]} />
      <Part g="cone" m="roofBrown" p={[0, 1.04, 0]} s={[0.62, 0.42, 0.62]} />
      <Part g="box" m="door" p={[0, 0.12, 0.25]} s={[0.12, 0.22, 0.02]} shadow={false} />
      <Part g="box" m="window" p={[0, 0.55, 0.25]} s={[0.08, 0.08, 0.02]} shadow={false} />
      {/* Sacs de farine devant la porte */}
      <Part g="ball" m="whitewash" p={[0.18, 0.06, 0.3]} s={[0.1, 0.12, 0.09]} />
      <Part g="ball" m="whitewash" p={[0.27, 0.05, 0.24]} s={[0.09, 0.1, 0.08]} />
      {/* Moyeu + pales */}
      <group position={[0, 0.82, 0.3]}>
        <Part g="box" m="timber" p={[0, 0, -0.03]} s={[0.07, 0.07, 0.1]} shadow={false} />
        <group ref={blades}>
          {[0, 1, 2, 3].map((i) => (
            <group key={i} rotation={[0, 0, (i * Math.PI) / 2]}>
              <Part g="box" m="timber" p={[0, 0.3, 0]} s={[0.03, 0.6, 0.02]} />
              <Part g="box" m="millBlade" p={[0.06, 0.34, 0.005]} s={[0.1, 0.48, 0.01]} />
            </group>
          ))}
        </group>
      </group>
    </group>
  );
}
