// Épuisement des sols : un champ cultivé sans pause s'épuise et produit de moins en moins.
// Indice : ses cultures jaunissent progressivement.
// Solution (jamais dite) : le laisser en jachère (mis à l'arrêt), ou une bergerie juste à côté (fumier).

import { seasonOf } from '../config';
import type { Building, GameState } from '../types';
import { type Mechanic, center, memo, solve, strike, within } from './common';
import { I } from '../../ui/icons';

export const SOIL = {
  conditions: {
    /** Épuisement gagné par jour de culture (champ au travail, hors hiver) */
    gainPerDay: 0.02,
  },
  hint: {
    /** Les cultures commencent à jaunir à partir de cet épuisement (rendu) */
    yellowFrom: 0.2,
  },
  effect: {
    /** Production perdue à épuisement complet */
    maxLoss: 0.5,
    /** La page s'écrit quand un champ atteint cet épuisement */
    strikeAt: 0.5,
  },
  solution: {
    /** Récupération par jour en jachère (champ mis à l'arrêt) */
    fallowRecovery: 0.1,
    /** Récupération naturelle en hiver */
    winterRecovery: 0.02,
    /** Fumier d'une bergerie en service à moins de X cases : épuisement réduit + récupération */
    manureRadius: 2.2,
    manureGain: 0.35,
    manureRecovery: 0.015,
    /** Jours de culture fumée qui complètent la page */
    manureDays: 12,
    /** Un champ épuisé (≥ from) qui redescend à `to` complète la page */
    recovered: { from: 0.4, to: 0.15 },
  },
};

/** Production d'un champ selon l'épuisement de son sol */
export function soilFactor(b: Building): number {
  return 1 - SOIL.effect.maxLoss * Math.min(1, b.fatigue ?? 0);
}

function manured(state: GameState, b: Building): boolean {
  return within(state, center(b), ['sheepfold'], SOIL.solution.manureRadius).some((s) => s.workers > 0 && !s.damaged);
}

export const soil: Mechanic<typeof SOIL> = {
  id: 'soil',
  icon: I.wheat,
  title: 'La terre fatiguée',
  page: 'Les blés ont jauni avant l\'heure et les épis sont maigres. On dirait que la terre elle-même est lasse.',
  solvedPage: 'Un champ qui se repose, ou qu\'on nourrit, retrouve sa vigueur. Les bêtes ont du bon.',
  config: SOIL,
  endOfDay: ({ state }) => {
    const S = SOIL;
    const winter = seasonOf(state.day).id === 'winter';
    let manureWorked = false;
    for (const b of state.buildings) {
      if (b.type !== 'field') continue;
      const before = b.fatigue ?? 0;
      const dung = manured(state, b);
      let f = before;
      if (b.paused) f -= S.solution.fallowRecovery;
      else if (winter) f -= S.solution.winterRecovery;
      else if (b.workers > 0) {
        f += S.conditions.gainPerDay * (dung ? S.solution.manureGain : 1);
        if (dung) manureWorked = true;
      }
      if (dung) f -= S.solution.manureRecovery;
      f = Math.max(0, Math.min(1, f));
      b.fatigue = Math.round(f * 1000) / 1000;
      if (f >= S.effect.strikeAt) strike(state, 'soil');
      // Plus haut épuisement atteint par ce champ, pour reconnaître une vraie récupération
      const key = `soilMax:${b.id}`;
      const max = Math.max(memo(state, key), f);
      memo(state, key, max);
      if (max >= S.solution.recovered.from && f <= S.solution.recovered.to) solve(state, 'soil');
    }
    const days = manureWorked ? memo(state, 'manureDays') + 1 : 0;
    memo(state, 'manureDays', days);
    if (days >= S.solution.manureDays) solve(state, 'soil');
  },
};
