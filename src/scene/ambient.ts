// Règle des effets d'ambiance : fumée, pluie, neige, flammes, roues et pales gardent une vitesse naturelle
// quelle que soit la vitesse du jeu (utiliser `clock.elapsedTime` ou ce facteur, jamais `speed`).
// Seul le gameplay accélère : villageois, bandits, cycle jour/nuit, production.

import { useGame } from '../store/gameStore';

/** Facteur d'écoulement du temps des animations d'ambiance : 1 en marche (x0,5, x1 ou x2), 0 en pause */
export function ambientRate(): number {
  return useGame.getState().speed === 0 ? 0 : 1;
}
