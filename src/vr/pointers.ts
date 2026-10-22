// Lecture de la position d'un pointeur à chaque image, pour le glisser-déposer : le même code sert
// à la souris (PC), au rayon d'une manette et au pincement / toucher d'une main.

import { getPointerById } from '@pmndrs/pointer-events';
import type { RootState } from '@react-three/fiber';
import * as THREE from 'three';

export interface PointerSample {
  /** Origine du rayon (ray) ou position du pointeur (grab / touch / main) */
  origin: THREE.Vector3;
  /** Direction du rayon ; null pour un pointeur de position (saisie directe, toucher) */
  dir: THREE.Vector3 | null;
  type: string;
  /** Un bouton est encore enfoncé (le geste continue) */
  down: boolean;
  /** Main à l'origine du pointeur, si connue */
  hand?: 'left' | 'right';
}

let mouseDown = false;
if (typeof window !== 'undefined') {
  window.addEventListener('pointerdown', () => (mouseDown = true), true);
  window.addEventListener('pointerup', () => (mouseDown = false), true);
  window.addEventListener('pointercancel', () => (mouseDown = false), true);
}

const _o = new THREE.Vector3();
const _d = new THREE.Vector3();
const _q = new THREE.Quaternion();

export function samplePointer(state: RootState, pointerId: number | undefined): PointerSample | null {
  if (state.gl.xr.isPresenting) {
    const pointer = pointerId === undefined ? undefined : getPointerById(pointerId);
    const hit = pointer?.getIntersection();
    if (!pointer || !hit) return null;
    _o.copy(hit.pointerPosition);
    _q.copy(hit.pointerQuaternion);
    const isRay = pointer.type === 'ray';
    const st = pointer.state as { inputSource?: { handedness?: string } } | undefined;
    const h = st?.inputSource?.handedness;
    return {
      origin: _o.clone(),
      dir: isRay ? _d.set(0, 0, -1).applyQuaternion(_q).clone() : null,
      type: pointer.type,
      down: pointer.getButtonsDown().size > 0,
      hand: h === 'left' || h === 'right' ? h : undefined,
    };
  }
  // Souris : rayon de la caméra à travers le curseur
  state.raycaster.setFromCamera(state.pointer, state.camera);
  return { origin: state.raycaster.ray.origin.clone(), dir: state.raycaster.ray.direction.clone(), type: 'mouse', down: mouseDown };
}

const _plane = new THREE.Plane();
const _hit = new THREE.Vector3();

/** Point où le pointeur vise le plan horizontal y = height (rayon), ou sa projection verticale (position) */
export function pointOnHorizontalPlane(sample: PointerSample, height: number, out = new THREE.Vector3()): THREE.Vector3 | null {
  if (!sample.dir) return out.set(sample.origin.x, height, sample.origin.z);
  _plane.set(new THREE.Vector3(0, 1, 0), -height);
  const hit = sample.dir.lengthSq() > 0 ? new THREE.Ray(sample.origin, sample.dir).intersectPlane(_plane, _hit) : null;
  return hit ? out.copy(hit) : null;
}
