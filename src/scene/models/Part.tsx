import { useLayoutEffect, useRef } from 'react';
import type * as THREE from 'three';
import { HIDDEN, addPart } from '../partPool';
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

/**
 * Petit raccourci pour assembler des modèles low-poly à partir des primitives partagées.
 * La pièce est dessinée par le regroupement d'instances (partPool) ; le maillage rendu ici est
 * invisible : il sert de repère (position, parents animés) et de cible aux clics.
 */
export function Part({ g, m, p = [0, 0, 0], s = 1, r, shadow = true }: PartProps) {
  const ref = useRef<THREE.Mesh>(null);
  const geometry = GEO[g];
  const material = typeof m === 'string' ? MAT[m] : m;
  // Pièce immobile dans son parent : sa matrice locale n'est recalculée que si ses props changent
  useLayoutEffect(() => {
    ref.current?.updateMatrix();
  });
  useLayoutEffect(() => {
    const o = ref.current;
    if (!o) return;
    return addPart(geometry, material, shadow, o);
  }, [geometry, material, shadow]);
  return <mesh ref={ref} geometry={geometry} material={HIDDEN} position={p} scale={s} rotation={r} matrixAutoUpdate={false} />;
}
