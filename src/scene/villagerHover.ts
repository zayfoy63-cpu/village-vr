// Villageois survolé (souris, rayon de manette, doigt) : son nom s'affiche en infobulle (PC) ou
// sur une petite étiquette au-dessus de lui (VR).

import { create } from 'zustand';
import * as THREE from 'three';

interface VillagerHover {
  /** Numéro du villageois survolé et son nom */
  hover: { i: number; name: string } | null;
  /** Position de la souris (infobulle PC) */
  x: number;
  y: number;
  set: (hover: { i: number; name: string } | null, x?: number, y?: number) => void;
}

export const useVillagerHover = create<VillagerHover>((set) => ({
  hover: null,
  x: 0,
  y: 0,
  set: (hover, x = 0, y = 0) => set({ hover, x, y }),
}));

/** Positions courantes des villageois (unités du jeu), tenues à jour par <Villagers> */
export const villagerPositions: THREE.Vector3[] = [];
