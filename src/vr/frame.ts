// Géométrie du plateau : passage entre le monde (mètres réels) et les cases du jeu.

import * as THREE from 'three';
import { MAP_HEIGHT, MAP_WIDTH } from '../game/config';
import { BOARD_BASE } from './VRRig';
import { useVR } from './store';

export interface Frame {
  pos: THREE.Vector3;
  yaw: number;
  /** Échelle du monde du jeu (mètres par unité) */
  ws: number;
  /** Échelle de l'interface */
  us: number;
}

export function boardFrame(): Frame {
  const { board, pcPreview } = useVR.getState();
  return pcPreview
    ? { pos: new THREE.Vector3(0, 0, 0), yaw: 0, ws: 1, us: 1 / board.scale }
    : { pos: new THREE.Vector3(board.x, board.y, board.z), yaw: board.yaw, ws: board.scale, us: 1 };
}

const _v = new THREE.Vector3();

/** Monde → repère de l'interface (mètres réels, origine au centre du plateau, sur la table) */
export function worldToUI(p: THREE.Vector3, f = boardFrame(), out = new THREE.Vector3()): THREE.Vector3 {
  _v.copy(p).sub(f.pos);
  const c = Math.cos(-f.yaw);
  const s = Math.sin(-f.yaw);
  // Rotation autour de y d'angle -yaw, puis mise à l'échelle de l'interface
  out.set((_v.x * c + _v.z * s) / f.us, _v.y / f.us, (-_v.x * s + _v.z * c) / f.us);
  return out;
}

/** Repère de l'interface → monde */
export function uiToWorld(p: THREE.Vector3, f = boardFrame(), out = new THREE.Vector3()): THREE.Vector3 {
  const c = Math.cos(f.yaw);
  const s = Math.sin(f.yaw);
  const x = p.x * f.us;
  const y = p.y * f.us;
  const z = p.z * f.us;
  return out.set(f.pos.x + x * c + z * s, f.pos.y + y, f.pos.z - x * s + z * c);
}

/** Hauteur du dessus des cases dans le monde */
export function boardTopY(f = boardFrame()): number {
  return f.pos.y + BOARD_BASE * f.ws;
}

/** Position monde → case du jeu (null hors de la carte) */
export function worldToTile(p: THREE.Vector3, f = boardFrame()): { x: number; z: number } | null {
  const u = worldToUI(p, f);
  // En unités du jeu : l'interface est en mètres, le monde du jeu est à l'échelle ws / us
  const k = f.us / f.ws;
  const x = Math.floor(u.x * k + MAP_WIDTH / 2);
  const z = Math.floor(u.z * k + MAP_HEIGHT / 2);
  if (x < 0 || z < 0 || x >= MAP_WIDTH || z >= MAP_HEIGHT) return null;
  return { x, z };
}

/** Centre d'une case du jeu dans le monde (à la hauteur du dessus des cases) */
export function tileToWorldPos(x: number, z: number, size = 1, f = boardFrame(), out = new THREE.Vector3()): THREE.Vector3 {
  const k = f.ws / f.us;
  const u = new THREE.Vector3(((x + size / 2 - MAP_WIDTH / 2)) * k, 0, ((z + size / 2 - MAP_HEIGHT / 2)) * k);
  uiToWorld(u, f, out);
  out.y = boardTopY(f);
  return out;
}
