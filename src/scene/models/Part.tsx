import { useContext, useLayoutEffect, useMemo, useRef } from 'react';
import type * as THREE from 'three';
import { ROUGH, VariantSeed, partJitter, partKey } from '../handmade';
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
 *
 * Style fait main : les primitives sont légèrement déformées (ROUGH) et, dans un modèle qui fournit
 * une graine (VariantSeed), chaque pièce penche, tourne et change de teinte un peu, de façon stable.
 */
export function Part({ g, m, p = [0, 0, 0], s = 1, r, shadow = true }: PartProps) {
  const ref = useRef<THREE.Mesh>(null);
  const seed = useContext(VariantSeed);
  const geometry = ROUGH[g];
  const material = typeof m === 'string' ? MAT[m] : m;
  const [px, py, pz] = p;
  const [sx, sy, sz] = typeof s === 'number' ? [s, s, s] : s;
  const [rx, ry, rz] = r ?? [0, 0, 0];
  const j = useMemo(() => (seed === null ? null : partJitter(seed, partKey(g, [px, py, pz], [sx, sy, sz]))), [seed, g, px, py, pz, sx, sy, sz]);
  const pos: Vec3 = j ? [px + j.dx, py, pz + j.dz] : p;
  const scale: Vec3 = j ? [sx * j.sx, sy * j.sy, sz * j.sz] : [sx, sy, sz];
  const rot: Vec3 = j ? [rx + j.rx, ry + j.ry, rz + j.rz] : [rx, ry, rz];
  const tint = j?.tint ?? 1;
  // Pièce immobile dans son parent : sa matrice locale n'est recalculée que si ses props changent
  useLayoutEffect(() => {
    ref.current?.updateMatrix();
  });
  useLayoutEffect(() => {
    const o = ref.current;
    if (!o) return;
    return addPart(geometry, material, shadow, o, tint);
  }, [geometry, material, shadow, tint]);
  return <mesh ref={ref} geometry={geometry} material={HIDDEN} position={pos} scale={scale} rotation={rot} matrixAutoUpdate={false} />;
}
