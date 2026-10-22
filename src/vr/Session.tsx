// Vie de la session XR : bascule manettes ↔ mains, mains perdues, pause quand le casque est retiré,
// boutons et joysticks des manettes.

import { useFrame } from '@react-three/fiber';
import { useXR, useXRInputSourceState } from '@react-three/xr';
import { useEffect, useRef } from 'react';
import { saveGame } from '../game/save';
import { xrStore } from '../scene/xr';
import { useGame } from '../store/gameStore';
import { VR_CONFIG } from './config';
import { cancelDrag } from './Drag';
import { feedback } from './feedback';
import { useVR } from './store';

let pausedByXR: number | null = null;

/** Met le jeu en pause (casque retiré, menu système, session quittée) et sauvegarde */
export function pauseForXR() {
  cancelDrag();
  const { speed, game } = useGame.getState();
  saveGame(game);
  if (speed > 0 && pausedByXR === null) {
    pausedByXR = speed;
    useGame.setState({ speed: 0 });
  }
}

export function resumeFromXR() {
  if (pausedByXR !== null) {
    // Seulement si le joueur n'a pas changé la vitesse entre-temps
    if (useGame.getState().speed === 0) useGame.setState({ speed: pausedByXR as 0.5 | 1 | 2 });
    pausedByXR = null;
  }
}

export function SessionControl() {
  const states = useXR((s) => s.inputSourceStates);
  const visibility = useXR((s) => s.visibilityState);
  const mode = useXR((s) => s.mode);
  const setInput = useVR((s) => s.setInput);
  const setHandsLost = useVR((s) => s.setHandsLost);
  const dominant = useVR((s) => s.prefs.dominant);
  const lostFor = useRef(0);
  const hadInput = useRef(false);
  const prev = useRef<Record<string, boolean>>({});
  const left = useXRInputSourceState('controller', 'left');
  const right = useXRInputSourceState('controller', 'right');

  // Manettes ↔ mains : automatique, sans menu
  useEffect(() => {
    const first = states[0];
    setInput(first ? (first.type === 'hand' ? 'hand' : first.type === 'controller' ? 'controller' : 'none') : 'none');
  }, [states, setInput]);

  // Pause automatique quand le casque est retiré (ou qu'un menu système passe devant)
  useEffect(() => {
    if (!VR_CONFIG.comfort.pauseOnHidden || mode === null) return;
    if (visibility === 'hidden' || visibility === 'visible-blurred') pauseForXR();
    else if (visibility === 'visible') resumeFromXR();
  }, [visibility, mode]);

  // Session quittée : pause + sauvegarde
  useEffect(() => xrStore.onSessionEnd(() => pauseForXR()), []);

  useFrame((_, dt) => {
    if (mode === null) return;
    // Mains perdues : ni main ni manette suivie depuis un moment
    if (states.length === 0) {
      // Seulement après avoir déjà vu des mains ou des manettes (pas pendant le démarrage de la session)
      lostFor.current += hadInput.current ? dt : 0;
      if (lostFor.current > VR_CONFIG.comfort.handsLostAfterSec) setHandsLost(true);
    } else {
      hadInput.current = true;
      lostFor.current = 0;
      setHandsLost(false);
    }

    const edge = (key: string, pressed: boolean) => {
      const was = prev.current[key] ?? false;
      prev.current[key] = pressed;
      return pressed && !was;
    };
    const vr = useVR.getState();
    const game = useGame.getState();
    const domCtrl = dominant === 'left' ? left : right;
    const otherCtrl = dominant === 'left' ? right : left;
    if (right) {
      if (edge('a', right.gamepad['a-button']?.state === 'pressed')) {
        vr.toggleBox();
        feedback('click');
      }
      if (edge('b', right.gamepad['b-button']?.state === 'pressed')) {
        if (!game.undoLast()) feedback('error');
        else feedback('drop');
      }
    }
    if (left) {
      if (edge('x', left.gamepad['x-button']?.state === 'pressed')) {
        if (game.speed === 0) game.setSpeed(1);
        else game.setSpeed(0);
        feedback('click');
      }
      if (edge('y', left.gamepad['y-button']?.state === 'pressed')) {
        vr.setPanel(vr.panel === 'settings' ? null : 'settings');
        feedback('click');
      }
    }
    // Joysticks : main dominante = tourner (x) et zoomer (y) ; l'autre = monter / descendre le plateau
    const B = VR_CONFIG.board;
    const dead = (v: number | undefined) => (Math.abs(v ?? 0) < 0.15 ? 0 : (v as number));
    const d = domCtrl?.gamepad['xr-standard-thumbstick'];
    const o = otherCtrl?.gamepad['xr-standard-thumbstick'];
    if (d && vr.phase === 'playing') {
      const x = dead(d.xAxis);
      const y = dead(d.yAxis);
      if (x || y) {
        vr.setBoard({ yaw: vr.board.yaw - x * B.turnSpeed * dt, scale: Math.min(B.maxScale, Math.max(B.minScale, vr.board.scale * Math.exp(-y * B.zoomSpeed * dt))) });
      }
    }
    if (o && vr.phase === 'playing') {
      const y = dead(o.yAxis);
      if (y) vr.setBoard({ y: Math.min(B.maxHeight, Math.max(B.minHeight, vr.board.y - y * B.liftSpeed * dt)) });
    }
  });
  return null;
}
