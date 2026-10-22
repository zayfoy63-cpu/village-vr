import { GEO } from './shared';
import { Part } from './models/Part';
import * as THREE from 'three';

const tableWood = new THREE.MeshStandardMaterial({ color: '#6e4a30', flatShading: true, roughness: 0.8 });
const tableWoodDark = new THREE.MeshStandardMaterial({ color: '#5a3b26', flatShading: true, roughness: 0.8 });
const plateauSide = new THREE.MeshStandardMaterial({ color: '#5b4330', flatShading: true, roughness: 1 });
const plateauRim = new THREE.MeshStandardMaterial({ color: '#7d5a3a', flatShading: true, roughness: 0.9 });
const floor = new THREE.MeshStandardMaterial({ color: '#3b2c22', roughness: 1 });

/** Plateau de jeu (socle sous la carte) posé sur une table en bois */
export function Table({ width, height }: { width: number; height: number }) {
  const plankCount = 9;
  const tableW = width + 8;
  const tableD = height + 7;
  const plankW = tableD / plankCount;
  const topY = -0.75;
  return (
    <group>
      {/* Socle du plateau */}
      <mesh geometry={GEO.box} material={plateauSide} position={[0, -0.45, 0]} scale={[width + 0.3, 0.3, height + 0.3]} castShadow receiveShadow />
      <mesh geometry={GEO.box} material={plateauRim} position={[0, -0.6, 0]} scale={[width + 0.7, 0.12, height + 0.7]} castShadow receiveShadow />
      {/* Plateau de table en planches */}
      {Array.from({ length: plankCount }, (_, i) => (
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
      {[-1, 1].flatMap((sx) =>
        [-1, 1].map((sz) => (
          <Part key={`${sx}${sz}`} g="box" m={tableWoodDark} p={[sx * (tableW / 2 - 1), topY - 5.4, sz * (tableD / 2 - 1)]} s={[1, 10, 1]} />
        )),
      )}
      {/* Sol de la pièce */}
      <mesh material={floor} rotation={[-Math.PI / 2, 0, 0]} position={[0, topY - 10.4, 0]} receiveShadow>
        <planeGeometry args={[200, 200]} />
      </mesh>
    </group>
  );
}
