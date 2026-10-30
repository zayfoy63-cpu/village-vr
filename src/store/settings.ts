// Réglages du joueur (préférences locales à ce navigateur, protégées par try/catch).

import { DEFAULT_DIFFICULTY, DIFFICULTY_BY_ID, type DifficultyId } from '../game/config';

export interface Settings {
  /** Met le jeu en pause quand une carte d'événement à choix apparaît */
  autoPause: boolean;
  /** Petit son au début d'un événement en temps réel (bandits, orage, crue, incendie) */
  sound: boolean;
  /** Dernière difficulté choisie (préselectionnée au prochain lancement) */
  difficulty: DifficultyId;
}

const KEY = 'village-vr-settings';
export const DEFAULT_SETTINGS: Settings = { autoPause: true, sound: true, difficulty: DEFAULT_DIFFICULTY };

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    const s = raw ? { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<Settings>) } : { ...DEFAULT_SETTINGS };
    if (!DIFFICULTY_BY_ID[s.difficulty]) s.difficulty = DEFAULT_DIFFICULTY;
    return s;
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(s: Settings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    // stockage indisponible : réglage gardé pour la session seulement
  }
}
