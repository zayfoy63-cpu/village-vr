// Froid : en hiver, chaque maison brûle du bois pour se chauffer. Sans bois, les villageois
// grelottent, puis tombent malades (et les plus faibles n'y survivent pas).
// Indices : plus de fumée aux cheminées, villageois qui tremblent.
// Solution (jamais dite) : rentrer du bois avant l'hiver.

import { seasonOf } from '../config';
import { mechIntensity } from '../difficulty';
import { addMorale, loseVillagers } from '../events';
import { pushNotice } from '../stateUtils';
import type { BuildingTypeId, GameState } from '../types';
import { type Mechanic, memo, solve, strike } from './common';
import { I } from '../../ui/icons';

export const COLD = {
  conditions: {
    /** Bois brûlé par jour d'hiver et par habitation */
    woodPerHome: { castle: 0.6, hut: 0.3, house: 0.45, townhouse: 0.7, manor: 1 } as Partial<Record<BuildingTypeId, number>>,
  },
  hint: {
    /** Dès le premier jour sans bois : cheminées éteintes et villageois qui grelottent (rendu) */
    shiverFrom: 1,
  },
  effect: {
    /** Après X jours sans bois, une part des villageois tombe malade (ne travaille plus) */
    sickAfter: 3,
    sickRatio: 0.15,
    sickDays: 3,
    /** Au-delà de X jours, le froid tue */
    deadlyAfter: 6,
    moralePerDay: -3,
  },
  solution: {
    /** Un hiver complet sans manquer de bois (avec au moins X habitations) complète la page */
    minHomes: 3,
  },
};

/** Bois de chauffage nécessaire aujourd'hui (0 hors hiver) */
export function heatingNeed(state: GameState): number {
  if (seasonOf(state.day).id !== 'winter') return 0;
  return state.buildings.reduce((sum, b) => sum + (COLD.conditions.woodPerHome[b.type] ?? 0), 0);
}

export const cold: Mechanic<typeof COLD> = {
  id: 'cold',
  icon: I.winter,
  title: 'Les nuits blanches',
  page: 'Un matin d\'hiver, plus une cheminée ne fumait. Les enfants grelottaient et les toux ont commencé.',
  solvedPage: 'Un hiver entier sans que les foyers s\'éteignent : les piles de bûches de l\'automne ont tenu jusqu\'au dégel.',
  config: COLD,
  endOfDay: ({ state, rng }) => {
    const C = COLD;
    const winter = seasonOf(state.day).id === 'winter';
    const m = state.mech;
    if (!winter) {
      m.cold = 0;
      return;
    }
    const need = heatingNeed(state);
    if (state.resources.wood >= need) {
      state.resources.wood -= need;
      m.cold = 0;
    } else {
      state.resources.wood = 0;
      m.cold++;
      m.coldThisWinter++;
      addMorale(state, C.effect.moralePerDay * mechIntensity(state));
      if (m.cold >= C.effect.sickAfter && state.population > 1) {
        const sick = Math.max(1, Math.ceil(state.population * C.effect.sickRatio * mechIntensity(state)));
        state.injuries.push({ count: sick, untilDay: state.day + C.effect.sickDays });
        let dead = 0;
        if (m.cold >= C.effect.deadlyAfter) dead = loseVillagers(state, rng.chance(0.6) ? 1 : 0, 1);
        strike(state, 'cold');
        pushNotice(state, {
          kind: 'bad',
          icon: I.sick,
          title: 'Toux et fièvres',
          text: `${sick} ${sick > 1 ? 'villageois gardent' : 'villageois garde'} le lit${dead ? ', et un ancien ne s\'est pas réveillé' : ''}.`,
        });
      }
    }
    // Dernier jour de l'hiver : bilan
    const next = seasonOf(state.day + 1).id;
    if (next !== 'winter') {
      const homes = state.buildings.filter((b) => (C.conditions.woodPerHome[b.type] ?? 0) > 0).length - 1;
      if (m.coldThisWinter === 0 && homes >= C.solution.minHomes) solve(state, 'cold');
      memo(state, 'winters', memo(state, 'winters') + 1);
      m.coldThisWinter = 0;
    }
  },
};
