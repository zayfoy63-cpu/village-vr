// Disposition des éléments autour du plateau (mètres, repère de l'interface : origine au centre du plateau).
// +x = droite du joueur, +z = vers le joueur.

import { VR_CONFIG } from './config';
import type { Hand } from './store';

/** Demi-dimensions du plateau pour une échelle donnée */
export const boardHalf = (scale: number) => ({ hw: 10 * scale, hd: 7 * scale });

export const BOX = { w: 0.34, d: 0.4, h: 0.03 };

/** La boîte est du côté de la main qui n'est pas dominante (la main dominante pioche et pose) */
export function boxCenter(dominant: Hand, scale: number): { x: number; z: number } {
  const { hw } = boardHalf(scale);
  const side = dominant === 'right' ? -1 : 1;
  return { x: side * (hw + VR_CONFIG.ui.margin + BOX.w / 2), z: 0 };
}

export function insideBox(x: number, z: number, dominant: Hand, scale: number, pad = 0.03): boolean {
  const c = boxCenter(dominant, scale);
  return Math.abs(x - c.x) <= BOX.w / 2 + pad && Math.abs(z - c.z) <= BOX.d / 2 + pad;
}
