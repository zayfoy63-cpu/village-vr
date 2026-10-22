// Outils de test (développement uniquement) : expose la scène, la caméra et les calculs de repère,
// pour que les scripts d'émulation puissent viser des objets 3D précis.

import { useThree } from '@react-three/fiber';
import { useEffect } from 'react';
import * as THREE from 'three';
import * as frame from './frame';
import * as layout from './layout';

export function DevHook() {
  const get = useThree((s) => s.get);
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const w = window as unknown as Record<string, unknown>;
    w.__T = {
      THREE,
      frame,
      layout,
      get,
      /** Position monde (centre) d'un bouton 3D par son libellé ou son icône ; null s'il est caché */
      findUI: (id: string) => {
        type Node = { userData?: Record<string, unknown>; visible: boolean; parent: Node | null; getWorldPosition: (v: THREE.Vector3) => THREE.Vector3 };
        let found: Node | null = null;
        get().scene.traverse((o) => {
          const n = o as unknown as Node;
          if (found || n.userData?.testId !== id) return;
          let vis = true;
          for (let p: Node | null = n; p; p = p.parent) if (!p.visible) vis = false;
          if (vis) found = n;
        });
        if (!found) return null;
        const v = new THREE.Vector3();
        (found as Node).getWorldPosition(v);
        return [v.x, v.y, v.z];
      },
      /** Projette un point monde sur l'écran (pixels) */
      project: (x: number, y: number, z: number) => {
        const s = get();
        const v = new THREE.Vector3(x, y, z).project(s.camera);
        return { x: ((v.x + 1) / 2) * s.size.width, y: ((1 - v.y) / 2) * s.size.height, visible: v.z < 1 };
      },
    };
  }, [get]);
  return null;
}
