// Niveaux de difficulté : lecture des coefficients (config.ts) pour une partie donnée.
// Les anciennes sauvegardes n'ont pas de niveau : elles sont en Normal.

import { DEFAULT_DIFFICULTY, DIFFICULTY_BY_ID, type DifficultyDef, type DifficultyId } from './config';
import { clamp } from './stateUtils';

interface HasDifficulty {
  difficulty?: DifficultyId;
}
interface HasDay extends HasDifficulty {
  day: number;
}

export function difficultyOf(state: HasDifficulty): DifficultyDef {
  return DIFFICULTY_BY_ID[state.difficulty ?? DEFAULT_DIFFICULTY] ?? DIFFICULTY_BY_ID[DEFAULT_DIFFICULTY];
}

/** Période de grâce : ni événement négatif ni mécanique cachée qui frappe */
export function inGrace(state: HasDay): boolean {
  return state.day <= difficultyOf(state).graceDays;
}

/**
 * Montée en puissance après la grâce : 0 juste après, 1 quand les menaces ont leur pleine force.
 * Sans période de montée (Cauchemar), toujours 1.
 */
export function rampFactor(state: HasDay): number {
  const d = difficultyOf(state);
  return d.rampDays <= 0 ? 1 : clamp((state.day - d.graceDays) / d.rampDays, 0, 1);
}

/** Intensité des mécaniques cachées (1 = référence) */
export function mechIntensity(state: HasDifficulty): number {
  return difficultyOf(state).mechanics;
}
