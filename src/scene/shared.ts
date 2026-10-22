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
  thatch: std('#c9a24e'),
  roofSlate: std('#4c5a6b'),
  roofBurgundy: std('#7c2f3b'),
  plaster: std('#f4e7cf'),
  hedge: std('#3d7a34'),
  gold: std('#f0c040', { emissive: new THREE.Color('#a06a00'), emissiveIntensity: 0.4, metalness: 0.3 }),
  water: std('#4a9ad8', { roughness: 0.3 }),
  white: std('#ffffff'),
  // Niveaux : bois brut (1), tuiles et couleurs vives (2), pierre taillée (3)
  woodRaw: std('#7d6148'),
  roofTile: std('#c9572e'),
  roofTileDark: std('#8e3518'),
  paintBlue: std('#2f6fd0'),
  paintYellow: std('#e8b830'),
  paintGreen: std('#3f9a4a'),
  whitewash: std('#f7f0e1'),
  stoneLight: std('#b9b5ab'),
  ironDark: std('#3b3b40'),
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
  /** Toit à deux pans : base 1x1 au sol (y=0), faîtage à y=1 orienté selon z */
  gable: (() => {
    const g = new THREE.CylinderGeometry(0.5, 0.5, 1, 3, 1);
    g.rotateX(-Math.PI / 2);
    g.translate(0, 0.25, 0);
    g.scale(1 / (0.5 * Math.sqrt(3)), 1 / 0.75, 1);
    return g;
  })(),
  rock: new THREE.DodecahedronGeometry(0.5, 0),
};
