import { useFrame } from '@react-three/fiber';
import { useGame } from '../store/gameStore';

/** Fait avancer la simulation à chaque image (fonctionne aussi en VR) */
export function GameClock() {
  const tick = useGame((s) => s.tick);
  useFrame((_, dt) => tick(dt));
  return null;
}
