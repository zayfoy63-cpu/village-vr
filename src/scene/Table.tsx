import { GEO } from './shared';
import { Part } from './models/Part';
import * as THREE from 'three';
import { PAL } from '../palette';

const tableWood = new THREE.MeshStandardMaterial({ color: PAL.umber, flatShading: true, roughness: 0.8 });
const tableWoodDark = new THREE.MeshStandardMaterial({ color: PAL.umber, flatShading: true, roughness: 0.8 });
const plateauSide = new THREE.MeshStandardMaterial({ color: PAL.umber, flatShading: true, roughness: 1 });
const plateauRim = new THREE.MeshStandardMaterial({ color: PAL.wood, flatShading: true, roughness: 0.9 });
const floor = new THREE.MeshStandardMaterial({ color: PAL.ink, roughness: 1 });

/** Plateau de jeu (socle sous la carte) posé sur une table en bois */
export function Table({ width, height, plinthOnly = false }: { width: number; height: number; plinthOnly?: boolean }) {
  const plankCount = 9;
  const tableW = width + 8;
  const tableD = height + 7;
  const plankW = tableD / plankCount;
  const topY = -0.75;
  return (
    <group>
      {/* Socle du plateau */}
      <mesh geometry={GEO.box} material={plateauSide} position={[0, -0.45, 0]} scale={[width + 0.3, 0.3, height + 0.3]} castShadow={!plinthOnly} receiveShadow />
      <mesh geometry={GEO.box} material={plateauRim} position={[0, -0.6, 0]} scale={[width + 0.7, 0.12, height + 0.7]} castShadow={!plinthOnly} receiveShadow />
      {/* Plateau de table en planches, pieds et sol (réalité mixte : on garde la vraie table) */}
      {!plinthOnly && Array.from({ length: plankCount }, (_, i) => (
        <mesh
          key={i}
          geometry={GEO.box}
          material={i % 2 ? tableWood : tableWoodDark}
          position={[0, topY - 0.2, -tableD / 2 + plankW * (i + 0.5)]}
          scale={[tableW, 0.4, plankW * 0.98]}
          receiveShadow
        />
      ))}
      {/* Pieds */}
      {!plinthOnly && [-1, 1].flatMap((sx) =>
        [-1, 1].map((sz) => (
          <Part key={`${sx}${sz}`} g="box" m={tableWoodDark} p={[sx * (tableW / 2 - 1), topY - 5.4, sz * (tableD / 2 - 1)]} s={[1, 10, 1]} />
        )),
      )}
      {!plinthOnly && <mesh material={floor} rotation={[-Math.PI / 2, 0, 0]} position={[0, topY - 10.4, 0]} receiveShadow>
        <planeGeometry args={[200, 200]} />
      </mesh>}
    </group>
  );
}
