import { createXRStore } from '@react-three/xr';

/**
 * Store WebXR unique. emulate: false pour que le bouton VR reste inactif
 * sans vrai casque (pas d'émulateur injecté en développement).
 */
export const xrStore = createXRStore({ emulate: false, offerSession: false });

/** Échelle du monde en VR : le plateau de 20 unités devient une maquette d'environ 1 m sur la table */
export const VR_WORLD_SCALE = 0.05;
