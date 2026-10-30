// Registre des mécaniques cachées et crochets appelés par la simulation.
// Pour ajouter une mécanique : un fichier dans ce dossier + son id dans MechanicId (types.ts) + une ligne ici.

import { inGrace } from '../difficulty';
import type { Rng } from '../rng';
import { rollWeather } from '../seasons';
import type { GameState, MechanicId } from '../types';
import type { Mechanic, MechanicContext } from './common';
import { cold } from './cold';
import { deforestation } from './deforestation';
import { disease } from './disease';
import { fire } from './fire';
import { flood } from './flood';
import { mine } from './mine';
import { rats } from './rats';
import { scout } from './scout';
import { soil } from './soil';
import { wolves } from './wolves';

export const MECHANICS: Mechanic<unknown>[] = [flood, soil, cold, fire, rats, disease, scout, deforestation, wolves, mine] as Mechanic<unknown>[];

export const MECHANIC_BY_ID = Object.fromEntries(MECHANICS.map((m) => [m.id, m])) as Record<MechanicId, Mechanic<unknown>>;

/** Fin de journée : effets de la journée écoulée (mutation) */
export function mechanicsEndOfDay(state: GameState, rng: Rng, now: number) {
  // Période de grâce : aucune mécanique cachée ne frappe (ni ne s'accumule)
  if (inGrace(state)) return;
  const ctx: MechanicContext = { state, rng, now };
  for (const m of MECHANICS) m.endOfDay?.(ctx);
}

/** Début de journée : météo, puis ce qui se prépare (mutation) */
export function mechanicsStartOfDay(state: GameState, rng: Rng, now: number) {
  rollWeather(state, rng);
  if (inGrace(state)) return;
  const ctx: MechanicContext = { state, rng, now };
  for (const m of MECHANICS) m.startOfDay?.(ctx);
}

export function mechanicsDue(state: GameState, t: number): boolean {
  return MECHANICS.some((m) => m.due?.(state, t));
}

export function updateMechanics(state: GameState, t: number, rng: Rng) {
  const ctx: MechanicContext = { state, rng, now: t };
  for (const m of MECHANICS) if (m.due?.(state, t)) m.update?.(ctx);
}
