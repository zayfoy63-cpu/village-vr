// Sauvegarde automatique dans localStorage (toujours protégée par try/catch).

import { BUILDING_BY_ID, maxLevel, unlockKey } from './buildings';
import { SAVE_KEY, SAVE_VERSION } from './config';
import { applyUnlocks } from './simulation';
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

/**
 * Met à niveau une sauvegarde d'une version précédente.
 * v1 → v2 : niveaux de bâtiments, déblocages, compteur d'améliorations.
 * Renvoie null si la sauvegarde est inutilisable.
 */
export function migrate(data: GameState): GameState | null {
  if (!data || typeof data !== 'object' || !data.map?.tiles || !Array.isArray(data.buildings)) return null;
  const version = typeof data.version === 'number' ? data.version : 1;
  if (version > SAVE_VERSION) return null;
  const s: GameState = { ...data };
  // Bâtiments : types inconnus retirés, niveau borné
  s.buildings = data.buildings
    .filter((b) => b && BUILDING_BY_ID[b.type])
    .map((b) => ({ ...b, level: Math.max(1, Math.min(maxLevel(b.type), Number(b.level) || 1)) }));
  const defaults = { maxPopulation: 0, buildingsBuilt: 0, upgrades: 0, eventsSurvived: 0 };
  s.stats = { ...defaults, ...(data.stats as Partial<GameState['stats']>) };
  s.notices = Array.isArray(data.notices) ? data.notices : [];
  s.modifiers = Array.isArray(data.modifiers) ? data.modifiers : [];
  if (!Array.isArray(s.unlocked)) {
    // Anciennes parties : on accorde silencieusement ce que la situation actuelle débloque
    // (et tout type déjà présent sur la carte reste constructible).
    s.unlocked = [...new Set(s.buildings.filter((b) => BUILDING_BY_ID[b.type].buildable).map((b) => unlockKey(b.type, 1)))];
    applyUnlocks(s, false);
  }
  s.version = SAVE_VERSION;
  return s;
}

export function loadGame(): GameState | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = migrate(JSON.parse(raw) as GameState);
    if (!data || data.gameOver) return null;
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
