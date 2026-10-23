// Aide toujours accessible : regarder l'intérieur du poignet gauche (mode mains) ou la manette gauche
// (mode manettes) affiche un petit rappel, avec des icônes d'abord.

import { useFrame } from '@react-three/fiber';
import { useXR, useXRInputSourceState } from '@react-three/xr';
import { useRef, useState } from 'react';
import * as THREE from 'three';
import { VR_CONFIG } from '../config';
import { useVR } from '../store';
import { FacePlayer, Label, Panel, THEME } from './kit';
import { I } from '../../ui/icons';

const _p = new THREE.Vector3();
const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _n = new THREE.Vector3();
const _cam = new THREE.Vector3();
const _look = new THREE.Vector3();

function Rows({ input }: { input: 'hand' | 'controller' }) {
  const rows =
    input === 'hand'
      ? [
          [I.pinch, 'Attraper · poser'],
          [I.tap, 'Tapoter : détails'],
          [I.hand, 'Bord du plateau : tourner'],
          [I.twoHands, 'Deux mains : zoom'],
          [I.hourglass, 'Sablier : pause · vitesse'],
          [I.box, 'Détruire : remettre dans la boîte'],
        ]
      : [
          [I.trigger, 'Gâchette : choisir · poser'],
          [I.grip, 'Grip : attraper'],
          [I.btnA, `A : boîte   ${I.btnB} B : annuler`],
          [I.btnX, 'X : pause   Y : menu'],
          [I.stick, 'Stick : tourner · zoom'],
          [I.updown, 'Autre stick : monter · descendre'],
        ];
  const h = rows.length * 0.04 + 0.05;
  return (
    <Panel width={0.4} height={h} border={THEME.accent}>
      {rows.map(([icon, text], i) => (
        <group key={text} position={[0, h / 2 - 0.04 - i * 0.04, 0]}>
          <Label text={icon} size={0.03} position={[-0.17, 0, 0]} />
          <Label text={text} size={0.022} align="left" weight={600} position={[-0.135, 0, 0]} />
        </group>
      ))}
    </Panel>
  );
}

export function WristHelp() {
  const mode = useXR((s) => s.mode);
  const input = useVR((s) => s.input);
  const left = useXRInputSourceState('hand', 'left');
  const leftCtrl = useXRInputSourceState('controller', 'left');
  const group = useRef<THREE.Group>(null);
  const [show, setShow] = useState(false);
  const shown = useRef(false);

  useFrame((state, _dt, frame) => {
    if (mode === null || !frame) return;
    const ref = state.gl.xr.getReferenceSpace();
    const g = group.current;
    if (!ref || !g) return;
    state.camera.getWorldPosition(_cam);
    _look.set(0, 0, -1).applyQuaternion(state.camera.quaternion);
    let visible = false;
    if (left?.inputSource.hand) {
      const hand = left.inputSource.hand;
      const w = hand.get('wrist');
      const i = hand.get('index-finger-metacarpal');
      const k = hand.get('pinky-finger-metacarpal');
      const pw = w && frame.getJointPose?.(w, ref);
      const pi = i && frame.getJointPose?.(i, ref);
      const pk = k && frame.getJointPose?.(k, ref);
      if (pw && pi && pk) {
        _p.set(pw.transform.position.x, pw.transform.position.y, pw.transform.position.z);
        _a.set(pi.transform.position.x, pi.transform.position.y, pi.transform.position.z).sub(_p);
        _b.set(pk.transform.position.x, pk.transform.position.y, pk.transform.position.z).sub(_p);
        _n.crossVectors(_a, _b).negate().normalize();
        const toCam = _cam.clone().sub(_p);
        const dist = toCam.length();
        // Intérieur du poignet tourné vers les yeux, main à portée de regard
        visible = dist < 0.7 && _n.dot(toCam.normalize()) > Math.cos((VR_CONFIG.help.wristAngle * Math.PI) / 180) && _look.dot(toCam.negate()) > 0.6;
      }
    } else if (leftCtrl?.inputSource.gripSpace) {
      const pose = frame.getPose(leftCtrl.inputSource.gripSpace, ref);
      if (pose) {
        _p.set(pose.transform.position.x, pose.transform.position.y, pose.transform.position.z);
        const toCtrl = _p.clone().sub(_cam);
        visible = toCtrl.length() < 0.7 && _look.dot(toCtrl.normalize()) > 0.93;
      }
    }
    if (visible !== shown.current) {
      shown.current = visible;
      setShow(visible);
      useVR.getState().setWristHelp(visible);
    }
    if (visible) g.position.copy(_p).add(_a.set(0, 0.14, 0));
  });

  return (
    <group ref={group}>
      {show && (
        <FacePlayer tilt={0.2}>
          <Rows input={input === 'hand' ? 'hand' : 'controller'} />
        </FacePlayer>
      )}
    </group>
  );
}
