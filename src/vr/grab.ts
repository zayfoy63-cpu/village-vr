// Saisie d'un bâtiment déjà posé : grip / pincement proche = immédiat ; gâchette, pincement à distance ou
// souris = maintien d'un instant (un appui bref reste un « tap » qui ouvre le panneau) ; doigt = tap seulement.

import type { RootState, ThreeEvent } from '@react-three/fiber';
import { useGame } from '../store/gameStore';
import { VR_CONFIG } from './config';
import { beginMove, isDragging } from './Drag';
import { samplePointer } from './pointers';
import { useVR } from './store';

const HOLD_MS = 240;

export function onBuildingPointerDown(e: ThreeEvent<PointerEvent>, buildingId: number, get: () => RootState) {
  if (!useVR.getState().active || isDragging() || useVR.getState().phase !== 'playing') return;
  const type = (e as unknown as { pointerType?: string }).pointerType;
  if (type === 'touch') return;
  const b = useGame.getState().game.buildings.find((x) => x.id === buildingId);
  if (!b || b.fire) return;
  if (type === 'grab') {
    e.stopPropagation();
    beginMove(e, buildingId);
    return;
  }
  const pointerId = e.pointerId;
  const fake = { pointerId, pointerState: (e as unknown as { pointerState?: unknown }).pointerState } as unknown as ThreeEvent<PointerEvent>;
  window.setTimeout(() => {
    if (isDragging()) return;
    const s = samplePointer(get(), pointerId);
    // Toujours enfoncé ? alors c'est une saisie, pas un tap
    if (s?.down) beginMove(fake, buildingId);
  }, HOLD_MS);
  void VR_CONFIG;
}
