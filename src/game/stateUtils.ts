// Petits utilitaires partagés par la simulation, les événements et les dangers en temps réel.

import type { GameState, Notice } from './types';

const MAX_NOTICES = 40;

/** Copie profonde de l'état, en partageant la carte (immuable) */
export function cloneState(state: GameState): GameState {
  const { map, ...rest } = state;
  return { ...structuredClone(rest), map };
}

/** Temps de jeu continu : jour + avancement (ex. 12.5 = milieu du jour 12) */
export function gameTime(state: GameState): number {
  return state.day + state.dayProgress;
}

export function pushNotice(state: GameState, notice: Omit<Notice, 'id' | 'day'>): Notice {
  const n: Notice = { ...notice, id: state.nextNoticeId++, day: state.day };
  state.notices.push(n);
  if (state.notices.length > MAX_NOTICES) {
    // On garde en priorité les cartes encore actives (choix / menaces)
    const active = (x: Notice) => (x.choice && !x.choice.resolved) || (x.threat && !x.threat.done);
    while (state.notices.length > MAX_NOTICES) {
      const i = state.notices.findIndex((x) => !active(x));
      state.notices.splice(i >= 0 ? i : 0, 1);
    }
  }
  return n;
}

export function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}
