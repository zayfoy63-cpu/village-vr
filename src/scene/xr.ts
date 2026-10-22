import { createXRStore } from '@react-three/xr';
import { VR_CONFIG } from '../vr/config';
import { VRController, VRHand } from '../vr/inputs';

/**
 * Store WebXR unique. Session en réalité mixte (immersive-ar, passthrough) avec hit-test pour poser
 * le plateau sur la vraie table. Aucun émulateur n'est injecté par le store : les tests passent par
 * vr/emulator.ts (?emulate dans l'URL). Sans casque, le bouton VR reste inactif.
 */
export const xrStore = createXRStore({
  // Profils de manettes servis localement (public/xr-profiles) : aucun CDN, fonctionne hors ligne
  baseAssetPath: new URL(`${import.meta.env.BASE_URL}xr-profiles/`, location.origin).href,
  controller: VRController,
  hand: VRHand,
  emulate: false,
  offerSession: false,
  foveation: VR_CONFIG.perf.foveation,
  frameBufferScaling: VR_CONFIG.perf.frameBufferScaling,
  hitTest: true,
  handTracking: true,
  anchors: true,
  planeDetection: true,
  domOverlay: false,
  layers: false,
  meshDetection: false,
});

if (import.meta.env.DEV) (window as unknown as Record<string, unknown>).__xrStore = xrStore;

