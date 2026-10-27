import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import type * as THREE from 'three';
import { useVillagerHover, villagerPositions } from '../../scene/villagerHover';
import { useVR } from '../store';
import { BOARD_BASE } from '../VRRig';
import { FacePlayer, Label, Panel, textWidth } from './kit';

/** Petite étiquette au nom du villageois visé (rayon, doigt), qui le suit au-dessus de sa tête */
export function VillagerTag3D() {
  const hover = useVillagerHover((s) => s.hover);
  const scale = useVR((s) => s.board.scale);
  const ref = useRef<THREE.Group>(null);
  useFrame(() => {
    const g = ref.current;
    const p = hover ? villagerPositions[hover.i] : undefined;
    if (!g || !p) return;
    g.position.set(p.x * scale, (BOARD_BASE + 0.45) * scale + 0.025, p.z * scale);
  });
  if (!hover) return null;
  const size = 0.024;
  const w = textWidth(hover.name, size, 400, true) + 0.02;
  return (
    <group ref={ref}>
      <FacePlayer tilt={0.2}>
        <Panel width={w} height={size * 1.7}>
          <Label title text={hover.name} size={size} weight={400} />
        </Panel>
      </FacePlayer>
    </group>
  );
}
