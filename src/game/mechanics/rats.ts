// Rats : un gros stock de nourriture entassé hors d'un grenier attire la vermine.
// Indice : des petits points gris apparaissent près des réserves, de plus en plus nombreux.
// Effet : au bout de quelques jours, une partie de la nourriture disparaît.
// Solution (jamais dite) : un grenier assez grand pour les réserves.

import { addMorale, severity } from '../events';
import { storageCapacity } from '../rules';
import { pushNotice } from '../stateUtils';
import type { GameState } from '../types';
import { type Mechanic, solve, strike } from './common';
import { I } from '../../ui/icons';

export const RATS = {
  conditions: {
    /** Nourriture au-delà de la capacité des greniers qui attire les rats */
    excess: 40,
  },
  hint: {
    /** Points gris visibles dès le premier jour d'exposition (leur nombre suit ce compteur) */
    showFrom: 1,
  },
  effect: {
    /** Jours d'exposition avant la razzia */
    daysBeforeLoss: 5,
    /** Part de l'excédent dévorée : base + par point de sévérité (plafonnée) */
    lossRatio: 0.2,
    lossPerSeverity: 0.05,
    maxLoss: 0.5,
    morale: -3,
  },
  solution: {
    /** Réserves d'au moins X entièrement à l'abri dans les greniers : la page se complète */
    protectedFood: 50,
  },
};

/** Nourriture exposée aux rats */
export function ratsExposure(state: GameState): number {
  return Math.max(0, state.resources.food - storageCapacity(state));
}

export const rats: Mechanic<typeof RATS> = {
  id: 'rats',
  icon: I.rat,
  title: 'Les petites ombres grises',
  page: 'On a d\'abord vu de petites ombres filer le long des murs. Puis, un matin, une bonne part des réserves avait disparu.',
  solvedPage: 'Derrière des murs secs, sur un plancher surélevé, le grain dort tranquille. Les chats du village y veillent.',
  config: RATS,
  endOfDay: ({ state }) => {
    const R = RATS;
    const m = state.mech;
    const excess = ratsExposure(state);
    if (excess > R.conditions.excess) m.rats++;
    else m.rats = Math.max(0, m.rats - 2);
    if (m.rats >= R.effect.daysBeforeLoss) {
      const ratio = Math.min(R.effect.maxLoss, R.effect.lossRatio + R.effect.lossPerSeverity * (severity(state.day) - 1));
      const lost = Math.floor(excess * ratio);
      state.resources.food -= lost;
      addMorale(state, R.effect.morale);
      m.rats = 0;
      strike(state, 'rats');
      pushNotice(state, {
        kind: 'bad',
        icon: I.rat,
        title: 'Réserves rongées',
        text: `Au matin, ${lost} ${I.wheat} ont disparu. On entend gratter sous les planchers.`,
      });
    }
    const storage = storageCapacity(state);
    if (storage > 0 && state.resources.food >= R.solution.protectedFood && state.resources.food <= storage) solve(state, 'rats');
  },
};
