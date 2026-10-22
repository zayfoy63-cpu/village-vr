import type * as THREE from 'three';
import { GEO, MAT } from '../shared';

type Vec3 = [number, number, number];

interface PartProps {
  g: keyof typeof GEO;
  m: keyof typeof MAT | THREE.Material;
  p?: Vec3;
  s?: Vec3 | number;
  r?: Vec3;
  shadow?: boolean;
}

/** Petit raccourci pour assembler des modèles low-poly à partir des primitives partagées */
export function Part({ g, m, p = [0, 0, 0], s = 1, r, shadow = true }: PartProps) {
  return (
    <mesh
      geometry={GEO[g]}
      material={typeof m === 'string' ? MAT[m] : m}
      position={p}
      scale={s}
      rotation={r}
      castShadow={shadow}
      receiveShadow={shadow}
    />
  );
}
