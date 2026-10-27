// Repère de la réalité mixte : le plateau (monde du jeu) est posé sur la table à l'échelle `board.scale`,
// l'interface vit tout autour, à l'échelle réelle (mètres). Rien n'est accroché à la tête.
// Sur PC (?ui3d), la même interface est affichée en agrandissant le tout (aperçu et tests à la souris).

import { useFrame } from '@react-three/fiber';
import { useEffect, useRef, type ReactNode } from 'react';
import type * as THREE from 'three';
import { BoardEdges } from './BoardGrab';
import { useVR } from './store';
import { VRUI } from './VRUI';

/** Hauteur du dessous du socle du plateau, en unités du jeu (le haut des cases est à 0) */
export const BOARD_BASE = 0.66;

/** Désactive le lancer de rayon sur tout un sous-arbre (aperçu du plateau pendant la pose) */
function useNoRaycast(ref: React.RefObject<THREE.Group | null>, disabled: boolean) {
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const noop = () => {};
    const saved: [{ raycast: unknown }, unknown][] = [];
    if (disabled) {
      root.traverse((o) => {
        saved.push([o, o.raycast]);
        o.raycast = noop;
      });
    }
    return () => {
      for (const [o, r] of saved) o.raycast = r as never;
    };
  }, [ref, disabled]);
}

export function VRRig({ world }: { world: ReactNode }) {
  const scale = useVR((s) => s.board.scale);
  const pc = useVR((s) => s.pcPreview);
  const phase = useVR((s) => s.phase);
  // Pendant la présentation et tant qu'on tient le plateau : pas de clic sur le village
  const grabbing = useVR((s) => s.grabbing > 0);
  const rig = useRef<THREE.Group>(null);
  const worldRef = useRef<THREE.Group>(null);
  useNoRaycast(worldRef, phase === 'placing' || grabbing);

  // Position, orientation et inclinaison suivies à chaque image, sans redessiner l'arbre React
  useFrame(() => {
    const g = rig.current;
    if (!g) return;
    const { board, tilt } = useVR.getState();
    if (pc) {
      g.position.set(0, 0, 0);
      g.rotation.set(0, 0, 0);
    } else {
      g.position.set(board.x, board.y, board.z);
      g.rotation.set(tilt, board.yaw, 0, 'YXZ');
    }
  }, -1);

  const ws = pc ? 1 : scale;
  const us = pc ? 1 / scale : 1;
  return (
    <group ref={rig}>
      <group ref={worldRef} scale={ws} position={[0, BOARD_BASE * ws, 0]}>
        {world}
      </group>
      <group scale={us}>
        <VRUI />
        {!pc && <BoardEdges />}
      </group>
    </group>
  );
}
