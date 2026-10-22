// Performance : mesure du rythme d'images, qualité réduite automatique en réalité mixte,
// et compteur discret (activable dans les paramètres).

import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import { VR_CONFIG } from './config';
import { useVR } from './store';

/** Mesure le FPS (moyenne sur une seconde) ; en XR, bascule en qualité réduite sous le seuil pendant 3 s */
export function PerfMonitor() {
  const acc = useRef({ t: 0, n: 0, slow: 0 });
  useFrame((_, dt) => {
    const a = acc.current;
    a.t += dt;
    a.n++;
    if (a.t < 1) return;
    const fps = a.n / a.t;
    a.t = 0;
    a.n = 0;
    const vr = useVR.getState();
    if (!vr.active) return;
    a.slow = fps < VR_CONFIG.perf.lowFps ? a.slow + 1 : Math.max(0, a.slow - 1);
    const low = vr.lowQuality ? a.slow > 0 : a.slow >= 3;
    vr.setFps(Math.round(fps), low);
  });
  return null;
}
