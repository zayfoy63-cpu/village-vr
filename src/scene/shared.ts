// Géométries et matériaux partagés (créés une seule fois) + conversion case → monde.

import * as THREE from 'three';
import { PAL } from '../palette';

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
  wall: std(PAL.parchment),
  timber: std(PAL.umber),
  roofRed: std(PAL.brick),
  roofBrown: std(PAL.wood),
  roofBlue: std(PAL.woad),
  stone: std(PAL.stone),
  stoneDark: std(PAL.slate),
  wood: std(PAL.wood),
  woodLight: std(PAL.ochre),
  plank: std(PAL.wood),
  window: std(PAL.straw, { emissive: new THREE.Color(PAL.straw), emissiveIntensity: 1.1 }),
  door: std(PAL.umber),
  cloth: std(PAL.brick),
  clothWhite: std(PAL.bone),
  flag: std(PAL.straw),
  soil: std(PAL.wood),
  hay: std(PAL.straw),
  millBlade: std(PAL.bone),
  thatch: std(PAL.ochre),
  roofSlate: std(PAL.slate),
  roofBurgundy: std(PAL.madder),
  plaster: std(PAL.parchment),
  hedge: std(PAL.forest),
  gold: std(PAL.straw, { emissive: new THREE.Color(PAL.ochre), emissiveIntensity: 0.4, metalness: 0.3 }),
  water: std(PAL.woad, { roughness: 0.3 }),
  white: std(PAL.bone),
  // Niveaux : bois brut (1), tuiles et couleurs vives (2), pierre taillée (3)
  woodRaw: std(PAL.umber),
  roofTile: std(PAL.brick),
  roofTileDark: std(PAL.madder),
  paintBlue: std(PAL.woad),
  paintYellow: std(PAL.straw),
  paintGreen: std(PAL.moss),
  whitewash: std(PAL.bone),
  stoneLight: std(PAL.parchment),
  ironDark: std(PAL.slate),
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
