// Propagation du feu : des maisons collées les unes aux autres brûlent en chaîne, et l'été
// une étincelle suffit à enflammer un quartier trop serré.
// Indice : l'été, des escarbilles s'échappent des cheminées des maisons entassées.
// Solution (jamais dite) : espacer les maisons, ou un puits à proximité.

import { seasonOf } from '../config';
import { mechIntensity } from '../difficulty';
import { TUNING, startFire } from '../events';
import { pushNotice } from '../stateUtils';
import type { Building, GameState } from '../types';
import { HOUSING, type Mechanic, center, solve, strike, touching, within } from './common';
import { I } from '../../ui/icons';

export const FIRE = {
  conditions: {
    /** Une habitation collée à au moins X bâtiments est "entassée" */
    crowdedNeighbors: 2,
  },
  hint: {
    /** Escarbilles visibles l'été au-dessus des habitations entassées sans puits (rendu) */
    season: 'summer' as const,
  },
  effect: {
    /** Chance par jour d'été qu'un quartier entassé s'enflamme tout seul */
    summerIgnite: 0.05,
  },
  solution: {
    /** Un puits à moins de X cases : propagation et départ de feu réduits, extinction plus rapide */
    wellRadius: 3,
    wellSpread: 0.3,
    wellIgnite: 0.2,
    wellExtinguish: 0.5,
  },
};

export function wellNear(state: GameState, b: Building): boolean {
  return within(state, center(b), ['well'], FIRE.solution.wellRadius).length > 0;
}

/** Habitations entassées (candidates à l'incendie d'été) */
export function crowdedHouses(state: GameState): Building[] {
  return state.buildings.filter((b) => HOUSING.includes(b.type) && touching(state, b).length >= FIRE.conditions.crowdedNeighbors);
}

/** Chance qu'un feu gagne un voisin à chaque tentative */
export function spreadChance(state: GameState, b: Building): number {
  return Math.min(0.95, TUNING.fire.spreadChance * mechIntensity(state)) * (wellNear(state, b) ? FIRE.solution.wellSpread : 1);
}

/** Durée d'extinction (facteur) */
export function extinguishFactor(state: GameState, b: Building): number {
  return wellNear(state, b) ? FIRE.solution.wellExtinguish : 1;
}

/** Le feu a gagné un voisin : la page s'écrit */
export function onFireSpread(state: GameState, from: Building) {
  if (from.fire) from.fire.spread = true;
  strike(state, 'fire');
}

/** Un feu s'éteint sans s'être propagé, grâce à un puits ou à des maisons bien espacées */
export function onFireEnd(state: GameState, b: Building) {
  if (b.fire?.spread) return;
  if (wellNear(state, b) || (HOUSING.includes(b.type) && touching(state, b).length === 0)) solve(state, 'fire');
}

export const fire: Mechanic<typeof FIRE> = {
  id: 'fire',
  icon: I.fire,
  title: 'Le feu qui court',
  page: 'Une étincelle, un toit de chaume, et le feu a sauté de maison en maison plus vite qu\'on ne pouvait courir.',
  solvedPage: 'Le feu a pris, mais il est resté seul : de l\'espace entre les toits et de l\'eau à portée de seau l\'ont privé de proies.',
  config: FIRE,
  startOfDay: ({ state, rng, now }) => {
    if (seasonOf(state.day).id !== FIRE.hint.season) return;
    const crowded = crowdedHouses(state).filter((b) => !b.fire);
    if (!crowded.length) return;
    const target = rng.pick(crowded);
    const chance = FIRE.effect.summerIgnite * mechIntensity(state) * (wellNear(state, target) ? FIRE.solution.wellIgnite : 1);
    if (!rng.chance(chance)) return;
    startFire(state, target, now);
    pushNotice(state, { kind: 'bad', icon: I.fire, title: 'Incendie !', text: 'La chaleur, une escarbille… une maison prend feu.' });
  },
};
