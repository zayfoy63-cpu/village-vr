// Pose du plateau sur la vraie table (réalité mixte) : on pointe la table, un aperçu suit la surface,
// on valide (gâchette / pincement). Sans table détectée, « Poser devant moi » apparaît à hauteur confortable.

import { useFrame, useThree } from '@react-three/fiber';
import { useXRHitTest, useXRInputSourceEvent, useXRInputSourceState } from '@react-three/xr';
import { useRef, useState } from 'react';
import * as THREE from 'three';
import { VR_CONFIG } from './config';
import { feedback } from './feedback';
import { useVR } from './store';
import { Button3D, FacePlayer, Label, Panel } from './ui/kit';
import { I } from '../ui/icons';

const _m = new THREE.Matrix4();
const _pos = new THREE.Vector3();
const _up = new THREE.Vector3();
const _cam = new THREE.Vector3();

/** Position « devant moi » : à distance et hauteur confortables, dans la direction du regard (à plat) */
export function frontOfPlayer(camera: THREE.Camera, seated: boolean) {
  const B = VR_CONFIG.board;
  camera.getWorldPosition(_cam);
  const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
  fwd.y = 0;
  if (fwd.lengthSq() < 1e-4) fwd.set(0, 0, -1);
  fwd.normalize();
  const x = _cam.x + fwd.x * B.frontDistance;
  const z = _cam.z + fwd.z * B.frontDistance;
  return { x, y: seated ? B.frontHeightSeated : B.frontHeightStanding, z, yaw: Math.atan2(_cam.x - x, _cam.z - z) };
}

export function Placement() {
  const phase = useVR((s) => s.phase);
  const prefs = useVR((s) => s.prefs);
  const tableFound = useVR((s) => s.tableFound);
  const camera = useThree((s) => s.camera);
  const dom = prefs.dominant;
  const ctrl = useXRInputSourceState('controller', dom);
  const hand = useXRInputSourceState('hand', dom);
  const space = ctrl?.inputSource.targetRaySpace ?? hand?.inputSource.targetRaySpace ?? 'viewer';
  const since = useRef(0);
  const placed = useRef(false);
  const [fallback, setFallback] = useState<{ x: number; y: number; z: number; yaw: number } | null>(null);
  const lastHit = useRef(0);

  // Aperçu : le plateau suit la surface visée (horizontale, entre 0,3 et 1,6 m du sol)
  useXRHitTest(
    phase === 'placing'
      ? (results, getWorldMatrix) => {
          for (const r of results) {
            if (!getWorldMatrix(_m, r)) continue;
            _pos.setFromMatrixPosition(_m);
            _up.setFromMatrixColumn(_m, 1);
            if (_up.y < 0.85 || _pos.y < 0.3 || _pos.y > 1.6) continue;
            camera.getWorldPosition(_cam);
            useVR.getState().setBoard({ x: _pos.x, y: _pos.y, z: _pos.z, yaw: Math.atan2(_cam.x - _pos.x, _cam.z - _pos.z) });
            lastHit.current = performance.now();
            if (!useVR.getState().tableFound) useVR.getState().setTableFound(true);
            return;
          }
          if (performance.now() - lastHit.current > 600 && useVR.getState().tableFound) useVR.getState().setTableFound(false);
        }
      : undefined,
    space,
    ['plane', 'mesh'],
  );

  // Validation : gâchette ou pincement, quand une table est visée
  useXRInputSourceEvent(
    'all',
    'select',
    () => {
      const st = useVR.getState();
      if (st.phase !== 'placing' || !st.tableFound || placed.current) return;
      placed.current = true;
      feedback('drop');
      st.setPhase('playing');
    },
    [],
  );

  useFrame((_, dt) => {
    const st = useVR.getState();
    if (st.phase !== 'placing') {
      since.current = 0;
      placed.current = false;
      if (fallback) setFallback(null);
      return;
    }
    since.current = st.tableFound ? 0 : since.current + dt;
    if (!st.tableFound && since.current > VR_CONFIG.comfort.noTableAfterSec && !fallback) {
      const f = frontOfPlayer(camera, st.prefs.seated);
      // Le plateau d'aperçu reste devant le joueur tant qu'aucune table n'est visée
      st.setBoard(f);
      setFallback({ x: f.x, y: f.y, z: f.z, yaw: f.yaw });
    }
    if (st.tableFound && fallback) setFallback(null);
  });

  if (phase !== 'placing') return null;
  const place = (e: object) => {
    const f = fallback ?? frontOfPlayer(camera, prefs.seated);
    useVR.getState().setBoard(f);
    feedback('drop', e);
    useVR.getState().setPhase('playing');
  };
  // Consigne et bouton de secours : posés dans le monde au-dessus du plateau d'aperçu (jamais sur la tête)
  const b = useVR.getState().board;
  return (
    <group position={[b.x, b.y, b.z]} rotation={[0, b.yaw, 0]}>
      <FacePlayer position={[0, 0.32, 0.1]} tilt={0.2}>
        <Panel width={0.5} height={fallback ? 0.2 : 0.11}>
          <Label text={tableFound ? `${I.check} Valider pour poser ici` : `${I.point} Pointez votre table`} size={0.034} position={[0, fallback ? 0.055 : 0, 0]} />
          {fallback && <Button3D width={0.36} height={0.07} icon={I.pin} label="Poser devant moi" position={[0, -0.04, 0.004]} onActivate={place} />}
        </Panel>
      </FacePlayer>
    </group>
  );
}
