// Réglages de rendu qui dépendent du mode : en réalité mixte, les petits objets (villageois,
// bandits, cultures, rochers, planches…) ne projettent pas d'ombre (moins d'appels dans la passe d'ombre).

import { useVR } from '../vr/store';

/** Les petits objets projettent-ils une ombre ? (oui sur PC, non en VR) */
export function useSmallShadows(): boolean {
  return useVR((s) => !s.active);
}
