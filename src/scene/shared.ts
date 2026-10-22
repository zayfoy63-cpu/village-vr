// Géométries et matériaux partagés (créés une seule fois) + conversion case → monde.

import * as THREE from 'three';

export const TILE = 1;
/** Hauteur du dessus du plateau de jeu */
export const GROUND_Y = 0;

export function tileToWorld(
  x: number,
  z: number,
  width: number,
  height: number,
  size = 1,
): [number, number, number] {
  return [(x + size / 2 - width / 2) * TILE, GROUND_Y, (z + size / 2 - height / 2) * TILE];
}

export function worldToTile(px: number, pz: number, width: number, height: number) {
  return { x: Math.floor(px / TILE + width / 2), z: Math.floor(pz / TILE + height / 2) };
}

const std = (color: string, extra: THREE.MeshStandardMaterialParameters = {}) =>
  new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.9, metalness: 0, ...extra });

export const MAT = {
  wall: std('#f1e4c8'),
  timber: std('#5a3a22'),
  roofRed: std('#b5523b'),
  roofBrown: std('#8a5a33'),
  roofBlue: std('#3f6fb5'),
  stone: std('#9a9a96'),
  stoneDark: std('#6f6f6c'),
  wood: std('#9b6a3c'),
  woodLight: std('#c79a5e'),
  plank: std('#7a4f2b'),
  window: std('#ffcf6b', { emissive: new THREE.Color('#ffb340'), emissiveIntensity: 1.1 }),
  door: std('#4a2e18'),
  cloth: std('#c43c3c'),
  clothWhite: std('#f3efe6'),
  flag: std('#d9a521'),
  soil: std('#7b5534'),
  hay: std('#e0c25a'),
  millBlade: std('#e9dcc0'),
  white: std('#ffffff'),
};

export const GEO = {
  box: new THREE.BoxGeometry(1, 1, 1),
  /** Pyramide à 4 pans pour les toits (base 1x1, hauteur 1) */
  pyramid: (() => {
    const g = new THREE.ConeGeometry(Math.SQRT1_2, 1, 4, 1);
    g.rotateY(Math.PI / 4);
    return g;
  })(),
  cylinder: new THREE.CylinderGeometry(0.5, 0.5, 1, 8),
  cylinderLow: new THREE.CylinderGeometry(0.5, 0.5, 1, 6),
  cone: new THREE.ConeGeometry(0.5, 1, 8),
  cone6: new THREE.ConeGeometry(0.5, 1, 6),
  ball: new THREE.IcosahedronGeometry(0.5, 0),
  rock: new THREE.DodecahedronGeometry(0.5, 0),
};
