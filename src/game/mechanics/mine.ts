// Effondrement de mine : une mine creusée profond (niveau 2 et plus) doit être étayée avec des
// planches. Sans étais, ses galeries deviennent instables et finissent par s'effondrer.
// Indice : la mine tremble et crache de petits nuages de poussière.
// Solution (jamais dite) : avoir des planches en stock (la mine les prend d'elle-même).

import { BUILDING_BY_ID } from '../buildings';
import { mechIntensity } from '../difficulty';
import { addMorale, loseVillagers, TUNING } from '../events';
import { pushNotice } from '../stateUtils';
import { type Mechanic, memo, solve, strike } from './common';
import { I } from '../../ui/icons';

export const MINE = {
  conditions: {
    /** Niveau à partir duquel les galeries doivent être étayées */
    minLevel: 2,
  },
  hint: {
    /** Tremblements et poussière au-delà de cette instabilité (rendu) */
    tremorFrom: 0.35,
  },
  effect: {
    /** Instabilité gagnée par jour de travail sans étais (par niveau : index = niveau) */
    gain: [0, 0, 0.12, 0.18],
    /** Mineurs pris dans l'effondrement (au plus) */
    victims: 2,
  },
  solution: {
    /** Planches consommées par jour pour étayer (par niveau) */
    planks: [0, 0, 0.5, 1],
    /** Baisse de l'instabilité par jour étayé */
    shoredDecay: 0.2,
    /** Jours étayés d'affilée qui complètent la page */
    shoredDays: 5,
  },
};

export const mine: Mechanic<typeof MINE> = {
  id: 'mine',
  icon: I.pickaxe,
  title: 'Le grondement',
  page: 'La mine tremblait depuis des jours, et la poussière sortait par la bouche des galeries. Puis le sol a grondé.',
  solvedPage: 'De bonnes planches calées sous la voûte, et la montagne se tient tranquille.',
  config: MINE,
  endOfDay: ({ state }) => {
    const M = MINE;
    for (const b of [...state.buildings]) {
      if (b.type !== 'mine' || b.level < M.conditions.minLevel || b.workers <= 0) continue;
      const lvl = Math.min(b.level, M.solution.planks.length - 1);
      const need = M.solution.planks[lvl];
      const key = `shored:${b.id}`;
      if ((state.resources.planks ?? 0) >= need) {
        state.resources.planks -= need;
        b.instability = Math.max(0, (b.instability ?? 0) - M.solution.shoredDecay);
        const days = memo(state, key, memo(state, key) + 1);
        if (days >= M.solution.shoredDays) solve(state, 'mine');
        continue;
      }
      memo(state, key, 0);
      b.instability = Math.round(Math.min(1, (b.instability ?? 0) + M.effect.gain[lvl] * mechIntensity(state)) * 1000) / 1000;
      if (b.instability < 1) continue;
      // Effondrement : la mine est perdue, des mineurs y restent
      state.buildings = state.buildings.filter((x) => x.id !== b.id);
      const dead = loseVillagers(state, Math.min(b.workers, M.effect.victims), 1);
      addMorale(state, TUNING.morale.buildingLost);
      strike(state, 'mine');
      pushNotice(state, {
        kind: 'bad',
        icon: I.pickaxe,
        title: BUILDING_BY_ID.mine.name,
        text: `Un grondement sourd, un nuage de poussière : la galerie s'est effondrée${dead ? ` sur ${dead} ${dead > 1 ? 'mineurs' : 'mineur'}` : ''}.`,
      });
    }
  },
};
