// Saisie du plateau par ses bords, comme un vrai plateau de jeu de société : géométrie des bords et
// lecture directe des mains (pincement) et des manettes (grip) à chaque image. Les positions sont
// celles du monde (= espace de référence XR : la scène n'a pas d'origine décalée).

import * as THREE from 'three';
import { VR_CONFIG } from './config';
import { insideBox } from './layout';
import type { Board, Hand } from './store';
import { BOARD_BASE } from './VRRig';

/** Bords : 0 = devant (côté joueur, +z), 1 = fond, 2 = droite (+x), 3 = gauche */
export type Edge = 0 | 1 | 2 | 3;

/** Demi-dimensions extérieures du plateau (socle compris), en mètres */
export function boardOuter(scale: number) {
  return { hw: (10 + 0.35) * scale, hd: (7 + 0.35) * scale };
}

/** Hauteur du dessus des cases au-dessus du bas du plateau (m) */
export const boardTop = (scale: number) => BOARD_BASE * scale;

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _one = new THREE.Vector3(1, 1, 1);
const _p = new THREE.Vector3();

/** Monde → repère du plateau (mètres, origine au centre du dessous, +z vers le joueur) */
export function toBoardLocal(p: THREE.Vector3, b: Board, tilt: number, out = new THREE.Vector3()): THREE.Vector3 {
  _m.compose(_p.set(b.x, b.y, b.z), _q.setFromEuler(_e.set(tilt, b.yaw, 0, 'YXZ')), _one).invert();
  return out.copy(p).applyMatrix4(_m);
}

/**
 * Bord le plus proche d'un point (repère du plateau) et distance au contour (négative à l'intérieur).
 * null si le point est trop loin (au-delà de `reach`), trop à l'intérieur ou trop haut / bas.
 */
export function edgeNear(local: THREE.Vector3, scale: number, reach: number = VR_CONFIG.grab.reach): { edge: Edge; d: number } | null {
  const G = VR_CONFIG.grab;
  if (Math.abs(local.y - boardTop(scale)) > G.height) return null;
  const { hw, hd } = boardOuter(scale);
  const ox = Math.abs(local.x) - hw;
  const oz = Math.abs(local.z) - hd;
  const d = ox <= 0 && oz <= 0 ? Math.max(ox, oz) : Math.hypot(Math.max(ox, 0), Math.max(oz, 0));
  if (d > reach || d < -G.inside) return null;
  const edge: Edge = ox > oz ? (local.x > 0 ? 2 : 3) : local.z > 0 ? 0 : 1;
  return { edge, d };
}

/** Au-dessus des cases (zone du zoom à deux mains), loin des bords */
export function overBoard(local: THREE.Vector3, scale: number): boolean {
  const G = VR_CONFIG.grab;
  const { hw, hd } = boardOuter(scale);
  const top = boardTop(scale);
  return Math.abs(local.x) < hw - G.inside && Math.abs(local.z) < hd - G.inside && local.y > top - 0.02 && local.y < top + G.zoomHeight;
}

/** Point de saisie valable sur un bord (hors de la boîte de construction posée à côté) */
export function grabEdgeAt(world: THREE.Vector3, b: Board, tilt: number, dominant: Hand): Edge | null {
  const local = toBoardLocal(world, b, tilt);
  if (insideBox(local.x, local.z, dominant, b.scale, 0.01)) return null;
  return edgeNear(local, b.scale)?.edge ?? null;
}

// --- Lecture des mains et des manettes -------------------------------------------------------

export interface GrabInput {
  /** Identifiant stable : « hand-left », « controller-right »… */
  key: string;
  hand: Hand;
  kind: 'hand' | 'controller';
  /** Point de saisie : entre le pouce et l'index (main), centre de la poignée (manette) */
  point: THREE.Vector3;
  /** Orientation autour de la verticale (rad) : sert à tourner le plateau tenu d'une main */
  yaw: number;
  /** Pincé (main) ou grip enfoncé (manette) */
  pressed: boolean;
}

const pinched = new Map<string, boolean>();
const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _qq = new THREE.Quaternion();
const _ee = new THREE.Euler();

const yawOf = (o: DOMPointReadOnly) => _ee.setFromQuaternion(_qq.set(o.x, o.y, o.z, o.w), 'YXZ').y;

export function readInputs(frame: XRFrame, ref: XRReferenceSpace): GrabInput[] {
  const G = VR_CONFIG.grab;
  const out: GrabInput[] = [];
  for (const src of frame.session.inputSources) {
    const hand = src.handedness === 'left' ? 'left' : src.handedness === 'right' ? 'right' : null;
    if (!hand) continue;
    if (src.hand) {
      const thumb = src.hand.get('thumb-tip');
      const index = src.hand.get('index-finger-tip');
      const wrist = src.hand.get('wrist');
      const pt = thumb && frame.getJointPose?.(thumb, ref);
      const pi = index && frame.getJointPose?.(index, ref);
      const pw = wrist && frame.getJointPose?.(wrist, ref);
      if (!pt || !pi || !pw) continue;
      _a.set(pt.transform.position.x, pt.transform.position.y, pt.transform.position.z);
      _b.set(pi.transform.position.x, pi.transform.position.y, pi.transform.position.z);
      const key = `hand-${hand}`;
      // Hystérésis : on pince franchement, on relâche franchement
      const dist = _a.distanceTo(_b);
      const was = pinched.get(key) ?? false;
      const now = was ? dist < G.pinchOff : dist < G.pinchOn;
      pinched.set(key, now);
      out.push({ key, hand, kind: 'hand', point: _a.clone().add(_b).multiplyScalar(0.5), yaw: yawOf(pw.transform.orientation), pressed: now });
    } else if (src.gripSpace) {
      const pose = frame.getPose(src.gripSpace, ref);
      if (!pose) continue;
      const p = pose.transform.position;
      // Disposition « xr-standard » : bouton 1 = grip
      const squeeze = !!src.gamepad?.buttons[1]?.pressed;
      out.push({ key: `controller-${hand}`, hand, kind: 'controller', point: new THREE.Vector3(p.x, p.y, p.z), yaw: yawOf(pose.transform.orientation), pressed: squeeze });
    }
  }
  return out;
}
