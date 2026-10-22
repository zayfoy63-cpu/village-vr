// Chronique du village : mémoire des mécaniques découvertes, conservée d'une partie à l'autre
// (localStorage, protégé par try/catch).

import type { GameState, MechanicId } from '../game/types';

export interface ChroniclePage {
  /** La mécanique a frappé au moins une fois : la page existe */
  struck: boolean;
  /** Le joueur a trouvé la parade (même par hasard) : la page est complète */
  solved: boolean;
  /** Jour et partie où la page a été écrite */
  day: number;
  seed: number;
}

export type Chronicle = Partial<Record<MechanicId, ChroniclePage>>;

const KEY = 'village-vr-chronicle';

export function loadChronicle(): Chronicle {
  try {
    const raw = localStorage.getItem(KEY);
    const data = raw ? (JSON.parse(raw) as Chronicle) : {};
    return data && typeof data === 'object' ? data : {};
  } catch {
    return {};
  }
}

export function saveChronicle(c: Chronicle): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(c));
  } catch {
    // stockage indisponible : la Chronique vit le temps de la session
  }
}

/**
 * Reporte dans la Chronique ce que la partie a révélé. Une solution trouvée ne complète
 * qu'une page déjà écrite (dans cette partie ou une précédente).
 */
export function mergeChronicle(c: Chronicle, game: GameState): { next: Chronicle; added: MechanicId[]; completed: MechanicId[] } {
  const next: Chronicle = { ...c };
  const added: MechanicId[] = [];
  const completed: MechanicId[] = [];
  const { struck, solved } = game.mech.chronicle;
  for (const id of struck) {
    if (next[id]?.struck) continue;
    next[id] = { struck: true, solved: solved.includes(id), day: game.day, seed: game.seed };
    added.push(id);
  }
  for (const id of solved) {
    const page = next[id];
    if (!page?.struck || page.solved) continue;
    next[id] = { ...page, solved: true };
    if (!added.includes(id)) completed.push(id);
  }
  return { next, added, completed };
}
