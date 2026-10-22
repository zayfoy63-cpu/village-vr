// Sauvegarde automatique dans localStorage (toujours protégée par try/catch).

import { SAVE_KEY, SAVE_VERSION } from './config';
import type { GameState } from './types';

export function saveGame(state: GameState): void {
  try {
    if (state.gameOver) {
      localStorage.removeItem(SAVE_KEY);
      return;
    }
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
  } catch {
    // Stockage indisponible (navigation privée, quota…) : on joue sans sauvegarde.
  }
}

export function loadGame(): GameState | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as GameState;
    if (data?.version !== SAVE_VERSION || !data.map?.tiles || data.gameOver) return null;
    return data;
  } catch {
    return null;
  }
}

export function clearSave(): void {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    // ignoré
  }
}
