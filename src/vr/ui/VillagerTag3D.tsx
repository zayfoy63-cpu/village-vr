import { useFrame } from '@react-three/fiber';
import { useRef, useState } from 'react';
import type * as THREE from 'three';
import { villagerName } from '../../game/names';
import { villagerPositions } from '../../scene/villagerHover';
import { tileToWorld } from '../../scene/shared';
import { useGame } from '../../store/gameStore';
import { useVR } from '../store';
import { BOARD_BASE } from '../VRRig';
import { FacePlayer, Label, Panel, textWidth } from './kit';

/** Distance max (cases) entre la case visée et le villageois nommé */
const NEAR = 0.7;

/**
 * Petite étiquette au nom du villageois le plus proche de la case visée (rayon, doigt), qui le suit
 * au-dessus de sa tête. Les villageois ne captent pas les rayons en VR (ils masqueraient les bâtiments).
 */
export function VillagerTag3D() {
  const scale = useVR((s) => s.board.scale);
  const map = useGame((s) => s.game.map);
  const [who, setWho] = useState<number | null>(null);
  const ref = useRef<THREE.Group>(null);
  const timer = useRef(0);
  useFrame((_, dt) => {
    if ((timer.current += dt) > 0.2) {
      timer.current = 0;
      const tile = useGame.getState().hover;
      let best: number | null = null;
      if (tile) {
        const [cx, , cz] = tileToWorld(tile.x, tile.z, map.width, map.height);
        let bd = NEAR;
        villagerPositions.forEach((p, i) => {
          const d = Math.hypot(p.x - cx, p.z - cz);
          if (d < bd) [bd, best] = [d, i];
        });
      }
      if (best !== who) setWho(best);
    }
    const g = ref.current;
    const p = who !== null ? villagerPositions[who] : undefined;
    if (g && p) g.position.set(p.x * scale, (BOARD_BASE + 0.45) * scale + 0.025, p.z * scale);
  });
  if (who === null) return null;
  const name = villagerName(who, map.seed);
  const size = 0.024;
  const w = textWidth(name, size, 400, true) + 0.02;
  return (
    <group ref={ref}>
      <FacePlayer tilt={0.2}>
        <Panel width={w} height={size * 1.7}>
          <Label title text={name} size={size} weight={400} />
        </Panel>
      </FacePlayer>
    </group>
  );
}
