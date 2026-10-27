// Style « fait main » : rien n'est parfaitement droit. Géométries légèrement déformées (arêtes qui
// bougent un peu, faîtages affaissés, pointes décalées) et petites variations seedées par pièce et par
// bâtiment (inclinaison, rotation, taille, teinte). Tout passe par la géométrie partagée et les
// attributs d'instance : aucun appel de dessin ni texture en plus.

import { createContext } from 'react';
import * as THREE from 'three';
import { hash2 } from '../game/rng';
import { GEO } from './shared';

/** Réglages des imperfections (unités du jeu : 1 = une case) */
export const HANDMADE = {
  /** Déformation des sommets des primitives (fraction de la taille de la pièce) */
  wobble: { box: 0.03, roof: 0.05, round: 0.06 },
  /** Affaissement du faîtage des toits à deux pans */
  ridgeSag: 0.07,
  /** Pièce : inclinaison (rad), rotation autour de la verticale (rad), taille (fraction), décalage (cases) */
  part: { tilt: 0.035, yaw: 0.05, scale: 0.05, shift: 0.01 },
  /** Bâtiment entier : rotation, inclinaison, taille, hauteur */
  building: { yaw: 0.07, tilt: 0.022, scale: 0.05, height: 0.07 },
  /** Teinte : écart de luminosité par bâtiment et par pièce */
  tint: { building: 0.09, part: 0.04 },
};

/** Nombre pseudo-aléatoire stable dans [0, 1[ à partir de trois entiers */
export function rnd(a: number, b: number, c: number): number {
  return hash2(Math.floor(a) | 0, Math.floor(b) | 0, Math.floor(c) | 0);
}

/** Écart symétrique dans [-amp, amp] */
export function spread(a: number, b: number, c: number, amp: number): number {
  return (rnd(a, b, c) - 0.5) * 2 * amp;
}

/** Déplace chaque sommet d'une valeur qui ne dépend que de sa position (les sommets confondus restent soudés) */
function wobble(geo: THREE.BufferGeometry, amount: number, seed: number, keepBase = true): THREE.BufferGeometry {
  const g = geo.clone();
  const pos = g.getAttribute('position') as THREE.BufferAttribute;
  g.computeBoundingBox();
  const minY = g.boundingBox!.min.y;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const kx = Math.round(x * 1000);
    const ky = Math.round(y * 1000);
    const kz = Math.round(z * 1000);
    // La base reste posée au sol ; le haut bouge davantage (murs qui penchent)
    const up = keepBase ? (y - minY) / Math.max(1e-6, g.boundingBox!.max.y - minY) : 1;
    pos.setXYZ(
      i,
      x + spread(kx, ky * 7 + kz, seed, amount) * (0.4 + 0.6 * up),
      y + (keepBase && y <= minY + 1e-6 ? 0 : spread(kz, kx * 3 + ky, seed + 1, amount * 0.6)),
      z + spread(kz * 5 + kx, ky, seed + 2, amount) * (0.4 + 0.6 * up),
    );
  }
  pos.needsUpdate = true;
  g.computeVertexNormals();
  return g;
}

/** Toit à deux pans dont le faîtage s'affaisse au milieu */
function saggingGable(): THREE.BufferGeometry {
  const g = new THREE.CylinderGeometry(0.5, 0.5, 1, 3, 4);
  g.rotateX(-Math.PI / 2);
  g.translate(0, 0.25, 0);
  g.scale(1 / (0.5 * Math.sqrt(3)), 1 / 0.75, 1);
  const pos = g.getAttribute('position') as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    const z = pos.getZ(i);
    // Faîtage (haut) : creusé au centre, plus haut aux pignons
    if (y > 0.9) pos.setY(i, y - HANDMADE.ridgeSag * (1 - (2 * z) ** 2));
  }
  pos.needsUpdate = true;
  g.computeVertexNormals();
  return g;
}

/** Pyramide dont la pointe n'est pas au centre */
function leaningPyramid(): THREE.BufferGeometry {
  const g = GEO.pyramid.clone();
  const pos = g.getAttribute('position') as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) if (pos.getY(i) > 0.45) pos.setXYZ(i, pos.getX(i) + 0.05, pos.getY(i) - 0.03, pos.getZ(i) - 0.03);
  pos.needsUpdate = true;
  return g;
}

/** Versions « faites main » des primitives des modèles (utilisées par <Part>) */
export const ROUGH: Record<keyof typeof GEO, THREE.BufferGeometry> = {
  box: wobble(GEO.box, HANDMADE.wobble.box, 11),
  pyramid: wobble(leaningPyramid(), HANDMADE.wobble.roof, 12),
  cylinder: wobble(GEO.cylinder, HANDMADE.wobble.box, 13),
  cylinderLow: wobble(GEO.cylinderLow, HANDMADE.wobble.box, 14),
  cone: wobble(GEO.cone, HANDMADE.wobble.roof, 15),
  cone6: wobble(GEO.cone6, HANDMADE.wobble.roof, 16),
  ball: wobble(GEO.ball, HANDMADE.wobble.round, 17, false),
  gable: wobble(saggingGable(), HANDMADE.wobble.box, 18),
  rock: wobble(GEO.rock, HANDMADE.wobble.round * 1.5, 19, false),
};

/** Arbre feuillu : boule bosselée (plus de facettes, rayon irrégulier) */
export const BLOB = (() => {
  const g = new THREE.IcosahedronGeometry(0.5, 1);
  const pos = g.getAttribute('position') as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const k = 1 + spread(Math.round(v.x * 997), Math.round(v.y * 991), Math.round(v.z * 983), 0.16);
    v.multiplyScalar(k);
    pos.setXYZ(i, v.x, v.y * 0.92, v.z);
  }
  pos.needsUpdate = true;
  g.computeVertexNormals();
  return g;
})();

/** Sapin : cône à 7 pans, étagé, pointe de travers */
export const PINE = (() => {
  const g = new THREE.ConeGeometry(0.5, 1, 7, 2);
  const pos = g.getAttribute('position') as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    const x = pos.getX(i);
    const z = pos.getZ(i);
    // Rangée du milieu rentrée (deux étages de branches), bords irréguliers
    const mid = Math.abs(y) < 0.01 ? 0.78 : 1;
    const j = 1 + spread(Math.round(x * 991), Math.round(z * 983), Math.round(y * 977), 0.14);
    pos.setXYZ(i, x * mid * j + (y > 0.45 ? 0.05 : 0), y + spread(Math.round(x * 13), Math.round(z * 17), 3, 0.04), z * mid * j);
  }
  pos.needsUpdate = true;
  g.computeVertexNormals();
  return g;
})();

/**
 * Graine de variation du modèle en cours (fournie par le bâtiment, la miniature…) : deux maisons du
 * même type ne sont jamais identiques, mais une maison donnée garde toujours la même allure.
 */
export const VariantSeed = createContext<number | null>(null);

/** Variation d'une pièce : stable pour une même graine et une même pièce (position, taille, forme) */
export function partJitter(seed: number, key: number) {
  const P = HANDMADE.part;
  return {
    rx: spread(seed, key, 1, P.tilt),
    ry: spread(seed, key, 2, P.yaw),
    rz: spread(seed, key, 3, P.tilt),
    sx: 1 + spread(seed, key, 4, P.scale),
    sy: 1 + spread(seed, key, 5, P.scale),
    sz: 1 + spread(seed, key, 6, P.scale),
    dx: spread(seed, key, 7, P.shift),
    dz: spread(seed, key, 8, P.shift),
    tint: 1 + spread(seed, 0, 9, HANDMADE.tint.building) + spread(seed, key, 10, HANDMADE.tint.part),
  };
}

/** Clé stable d'une pièce à partir de sa forme et de sa place dans le modèle */
export function partKey(g: string, p: readonly number[], s: number | readonly number[]): number {
  const ss = typeof s === 'number' ? [s, s, s] : s;
  let h = g.length * 131;
  for (const v of [...p, ...ss]) h = (Math.imul(h ^ Math.round(v * 1000), 2654435761) >>> 0) % 2147483647;
  return h;
}

/** Variation d'un bâtiment entier (rotation, inclinaison, taille) */
export function buildingJitter(id: number, mapSeed: number) {
  const B = HANDMADE.building;
  return {
    rotation: [spread(id, mapSeed, 21, B.tilt), spread(id, mapSeed, 22, B.yaw), spread(id, mapSeed, 23, B.tilt)] as [number, number, number],
    scale: [1 + spread(id, mapSeed, 24, B.scale), 1 + spread(id, mapSeed, 25, B.height), 1 + spread(id, mapSeed, 26, B.scale)] as [number, number, number],
    seed: Math.floor(rnd(id, mapSeed, 27) * 1e9),
  };
}

/**
 * Case de terrain : dessus en 3x3 facettes légèrement bosselées (bords plats pour joindre les
 * voisines), couleurs de sommet irrégulières (herbe plus ou moins drue), flancs couleur de terre.
 * Pas de dessous (jamais vu). Les instances tournent d'un quart de tour au hasard : le motif ne se
 * répète pas d'une case à l'autre.
 */
export const GROUND = (() => {
  const N = 3;
  const pos: number[] = [];
  const col: number[] = [];
  const idx: number[] = [];
  const shade = (x: number, z: number) => 0.9 + rnd(Math.round(x * 97) + 7, Math.round(z * 89) + 3, 41) * 0.18;
  // Dessus
  for (let j = 0; j <= N; j++) {
    for (let i = 0; i <= N; i++) {
      const x = i / N - 0.5;
      const z = j / N - 0.5;
      const inner = i > 0 && i < N && j > 0 && j < N;
      pos.push(x, 0.5 - (inner ? rnd(i, j, 42) * 0.03 : 0), z);
      const k = shade(x, z);
      col.push(k, k * (0.98 + rnd(i, j, 43) * 0.04), k * 0.96);
    }
  }
  for (let j = 0; j < N; j++) {
    for (let i = 0; i < N; i++) {
      const a = j * (N + 1) + i;
      // Diagonales alternées : facettes moins régulières
      if ((i + j) % 2) idx.push(a, a + N + 1, a + 1, a + 1, a + N + 1, a + N + 2);
      else idx.push(a, a + N + 1, a + N + 2, a, a + N + 2, a + 1);
    }
  }
  // Flancs (terre plus sombre en bas)
  const side = (ax: number, az: number, bx: number, bz: number) => {
    const s = pos.length / 3;
    pos.push(ax, 0.5, az, bx, 0.5, bz, bx, -0.5, bz, ax, -0.5, az);
    col.push(0.85, 0.8, 0.72, 0.85, 0.8, 0.72, 0.62, 0.55, 0.48, 0.62, 0.55, 0.48);
    idx.push(s, s + 2, s + 1, s, s + 3, s + 2);
  };
  side(-0.5, 0.5, 0.5, 0.5);
  side(0.5, 0.5, 0.5, -0.5);
  side(0.5, -0.5, -0.5, -0.5);
  side(-0.5, -0.5, -0.5, 0.5);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
})();

/**
 * Tache au sol : petit dôme à 9 pans au contour irrégulier (base à y = 0, sommet à y = 1). Sert aux
 * fleurs, herbes folles, touffes d'herbe rase et terre des chemins : 9 triangles par tache.
 */
export const DOT = (() => {
  const N = 9;
  const pos = [0, 1, 0];
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2;
    const r = 0.5 * (0.8 + rnd(i, 3, 151) * 0.3);
    pos.push(Math.cos(a) * r, 0, Math.sin(a) * r);
  }
  const idx: number[] = [];
  for (let i = 0; i < N; i++) idx.push(0, 1 + ((i + 1) % N), 1 + i);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
})();
