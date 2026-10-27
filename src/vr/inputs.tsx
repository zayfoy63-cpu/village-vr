// Entrées XR : manettes et mains, avec des modèles low-poly maison (aucun fichier chargé depuis un CDN).
// Les pointeurs (rayon, saisie, toucher) viennent de @react-three/xr : ils émettent les mêmes événements
// que la souris, donc toute l'interface 3D n'a qu'un seul jeu de gestionnaires.

import { useFrame } from '@react-three/fiber';
import { CombinedPointer, DefaultXRController, DefaultXRHand, PointerCursorModel, XRSpace, useTouchPointer, useXRInputSourceStateContext } from '@react-three/xr';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { VR_CONFIG } from './config';
import { useVR } from './store';
import { PAL } from '../palette';

const bodyMat = new THREE.MeshStandardMaterial({ color: PAL.ink, roughness: 0.6, flatShading: true });
const ringMat = new THREE.MeshStandardMaterial({ color: PAL.straw, roughness: 0.4, flatShading: true });
const handMat = new THREE.MeshStandardMaterial({ color: PAL.parchment, roughness: 0.7, transparent: true, opacity: 0.92, flatShading: true });

const CLICK_MS: number = VR_CONFIG.interact.clickMs;
const RAY = { color: PAL.bone, opacity: 0.5, maxLength: 3 };
const CURSOR = { size: 0.012, opacity: 0.9 };

/** Manette : poignée, anneau et nez, très simples (reconnaissable dans le passthrough) */
function ControllerBody({ dominant }: { dominant: boolean }) {
  return (
    <group rotation={[-0.6, 0, 0]}>
      <mesh material={bodyMat} position={[0, 0, 0.02]} rotation={[Math.PI / 2, 0, 0]} castShadow={false}>
        <cylinderGeometry args={[0.017, 0.02, 0.1, 8]} />
      </mesh>
      <mesh material={dominant ? ringMat : bodyMat} position={[0, 0.02, -0.04]} rotation={[0.3, 0, 0]}>
        <torusGeometry args={[0.03, 0.008, 6, 14]} />
      </mesh>
    </group>
  );
}

export function VRController() {
  const state = useXRInputSourceStateContext('controller');
  const dominant = useVR((s) => s.prefs.dominant);
  const isDominant = state.inputSource.handedness === dominant;
  return (
    <>
      <XRSpace space="grip-space">
        <ControllerBody dominant={isDominant} />
      </XRSpace>
      <DefaultXRController model={false} rayPointer={{ rayModel: RAY, cursorModel: CURSOR, minDistance: 0.02, clickThresholdMs: CLICK_MS }} grabPointer={{ cursorModel: { size: 0.014, opacity: 0.8 }, clickThresholdMs: CLICK_MS }} />
    </>
  );
}

const JOINT_RADIUS = 0.0085;

/** Main : une petite sphère par articulation (25), lue directement dans la pose WebXR */
function HandJoints() {
  const state = useXRInputSourceStateContext('hand');
  const mesh = useRef<THREE.InstancedMesh>(null);
  const m = useMemo(() => new THREE.Matrix4(), []);
  const p = useMemo(() => new THREE.Vector3(), []);
  const q = useMemo(() => new THREE.Quaternion(), []);
  const s = useMemo(() => new THREE.Vector3(1, 1, 1), []);
  useFrame(() => {
    const im = mesh.current;
    if (!im) return;
    const data = state.pose.data;
    let n = 0;
    for (let i = 0; i < 25; i++) {
      m.fromArray(data, i * 16);
      m.decompose(p, q, s);
      if (!Number.isFinite(p.x) || (p.x === 0 && p.y === 0 && p.z === 0)) continue;
      const tip = i % 5 === 4 ? 1.15 : 1;
      im.setMatrixAt(n++, m.compose(p, q.identity(), s.setScalar(JOINT_RADIUS * tip)));
    }
    im.count = n;
    im.instanceMatrix.needsUpdate = true;
    im.visible = n > 0;
  });
  return <instancedMesh ref={mesh} args={[undefined, handMat, 25]} frustumCulled={false}>
    <icosahedronGeometry args={[1, 1]} />
  </instancedMesh>;
}

/**
 * Toucher du doigt : @pmndrs/pointer-events considère un pointeur « enfoncé » dès que la distance de
 * l'intersection est petite, or le vide renvoie une distance de 0 : le pointeur resterait enfoncé en
 * permanence et ne produirait jamais de nouvel appui. On remplace donc sa logique d'appui : appui quand
 * le bout du doigt est à moins de `touchDown` d'un objet réel, relâchement un peu plus loin (hystérésis).
 */
function FingerTouch() {
  const state = useXRInputSourceStateContext('hand');
  const ref = useRef<THREE.Object3D>(null);
  const pointer = useTouchPointer(ref, state, { clickThresholdMs: CLICK_MS });
  useMemo(() => {
    const p = pointer as unknown as { onMoveCommited?: (p: typeof pointer) => void };
    let down = false;
    let pressed: ReturnType<typeof pointer.getIntersection>;
    const press = VR_CONFIG.interact.touchDown;
    p.onMoveCommited = (ptr) => {
      if (!ptr.getEnabled()) return;
      const hit = ptr.getIntersection();
      const real = !!hit && !(hit.object as unknown as { isVoidObject?: boolean }).isVoidObject;
      
      const next = real && hit.distance <= (down ? press * 1.6 : press);
      if (next === down) return;
      down = next;
      const ev = { timeStamp: performance.now(), button: 0 };
      if (next) {
        pressed = hit;
        ptr.down(ev as never);
        return;
      }
      // Un modèle est fait de plusieurs maillages : au retrait du doigt le plus proche a pu changer.
      // Le relâchement est donc adressé à l'objet touché à l'appui (un tap = appui puis retrait au même endroit).
      // Tap : le bout du doigt a peu bougé depuis l'appui (le retrait vertical compris)
      if (pressed && hit && pressed.pointerPosition.distanceTo(hit.pointerPosition) < VR_CONFIG.interact.tapSlop) {
        ptr.setIntersection(pressed);
        ptr.up(ev as never);
        ptr.setIntersection(hit);
      } else ptr.up(ev as never);
    };
  }, [pointer]);
  return (
    <XRSpace ref={ref} space={state.inputSource.hand!.get('index-finger-tip')!}>
      <PointerCursorModel pointer={pointer} opacity={0.9} size={0.008} />
    </XRSpace>
  );
}

export function VRHand() {
  return (
    <>
      <HandJoints />
      <DefaultXRHand model={false} rayPointer={{ rayModel: { ...RAY, maxLength: 0.6 }, cursorModel: CURSOR, minDistance: 0.02, clickThresholdMs: CLICK_MS }} touchPointer={false} grabPointer={{ cursorModel: { size: 0.012, opacity: 0.8 }, clickThresholdMs: CLICK_MS }} />
      {/* Le toucher du doigt vit dans son propre groupe : à égalité de distance, le pointeur de saisie (même point) le masquerait */}
      <CombinedPointer>
        <FingerTouch />
      </CombinedPointer>
    </>
  );
}
