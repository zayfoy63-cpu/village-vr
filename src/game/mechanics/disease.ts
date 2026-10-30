// Maladie : maisons surpeuplées, habitations entassées, ou puits trop proche du cimetière font couver
// une fièvre lente. Indice : les villageois marchent plus lentement et pâlissent.
// Effet : quand elle éclate, elle emporte des villageois.
// Solution (jamais dite) : une herboriste, de la place, et l'eau loin des tombes.
// Le cimetière apparaît de lui-même après les premiers décès.

import { mechIntensity } from '../difficulty';
import { loseVillagers } from '../events';
import { tileAt } from '../mapgen';
import { featureAt, ownsTile } from '../parcels';
import { buildingAt, housingCapacity } from '../rules';
import { pushNotice } from '../stateUtils';
import type { GameState } from '../types';
import { HOUSING, type Mechanic, center, dist, memo, solve, strike, touching, within } from './common';
import { I } from '../../ui/icons';

export const DISEASE = {
  conditions: {
    /** Gain par jour et par habitant sans logement */
    perHomeless: 0.02,
    /** Gain par jour et par habitation collée à 3 bâtiments ou plus */
    perCrowdedHouse: 0.006,
    crowdedNeighbors: 3,
    /** Puits à moins de X cases du cimetière : gain par jour */
    wellNearGrave: { radius: 2.5, gain: 0.05 },
  },
  hint: {
    /** Villageois plus lents et plus pâles au-delà de ce niveau (rendu) */
    paleFrom: 0.3,
  },
  effect: {
    /** Production réduite quand la fièvre couve fort */
    productionFrom: 0.6,
    production: 0.9,
    /** Part des habitants emportés quand elle éclate (au moins 1) */
    deathRatio: 0.08,
    /** Niveau après l'épisode */
    after: 0.45,
  },
  solution: {
    /** Baisse naturelle par jour */
    decay: 0.03,
    /** Herboriste au travail : baisse supplémentaire et gain réduit */
    herbalistDecay: 0.06,
    herbalistGain: 0.4,
    /** Une fièvre qui a dépassé `from` et retombe sous `to` complète la page */
    recovered: { from: 0.4, to: 0.1 },
  },
  cemetery: {
    /** Distance minimale au château */
    minDistance: 3.5,
  },
};

/** Facteur de production dû à la fièvre */
export function diseaseFactor(state: GameState): number {
  return (state.mech?.sickness ?? 0) >= DISEASE.effect.productionFrom ? DISEASE.effect.production : 1;
}

/** Pose le cimetière sur une case libre, un peu à l'écart du château */
function placeCemetery(state: GameState) {
  const castle = state.buildings.find((b) => b.type === 'castle');
  if (!castle) return;
  const c = center(castle);
  let best: { x: number; z: number; d: number } | null = null;
  for (let z = 0; z < state.map.height; z++)
    for (let x = 0; x < state.map.width; x++) {
      const t = tileAt(state.map, x, z);
      if ((t !== 'grass' && t !== 'fertile') || !ownsTile(state, x, z) || featureAt(state, x, z) || buildingAt(state, x, z)) continue;
      const d = dist(c, { x: x + 0.5, z: z + 0.5 });
      if (d < DISEASE.cemetery.minDistance) continue;
      if (!best || d < best.d) best = { x, z, d };
    }
  if (!best) return;
  state.buildings.push({ id: state.nextBuildingId++, type: 'cemetery', x: best.x, z: best.z, level: 1, workers: 0, builtDay: state.day });
}

export const disease: Mechanic<typeof DISEASE> = {
  id: 'disease',
  icon: I.sick,
  title: 'La fièvre lente',
  page: 'Les gens traînaient le pas, le teint gris. Puis la fièvre a éclaté et le cimetière s\'est agrandi.',
  solvedPage: 'La fièvre a reculé. De l\'air entre les maisons, une eau propre et une femme qui connaît les plantes : le village respire.',
  config: DISEASE,
  endOfDay: ({ state }) => {
    const D = DISEASE;
    const m = state.mech;
    if (m.deaths > 0 && !state.buildings.some((b) => b.type === 'cemetery')) placeCemetery(state);
    let gain = Math.max(0, state.population - housingCapacity(state)) * D.conditions.perHomeless;
    const houses = state.buildings.filter((b) => HOUSING.includes(b.type));
    gain += houses.filter((h) => touching(state, h).length >= D.conditions.crowdedNeighbors).length * D.conditions.perCrowdedHouse;
    for (const grave of state.buildings.filter((b) => b.type === 'cemetery')) {
      gain += within(state, center(grave), ['well'], D.conditions.wellNearGrave.radius).length * D.conditions.wellNearGrave.gain;
    }
    gain *= mechIntensity(state);
    const herbalist = state.buildings.some((b) => b.type === 'herbalist' && b.workers > 0 && !b.fire);
    if (herbalist) gain *= D.solution.herbalistGain;
    const decay = D.solution.decay + (herbalist ? D.solution.herbalistDecay : 0);
    m.sickness = Math.max(0, Math.min(1, m.sickness + gain - decay));
    m.sickness = Math.round(m.sickness * 1000) / 1000;
    if (m.sickness >= 1 && state.population > 1) {
      const lost = loseVillagers(state, Math.max(1, Math.ceil(state.population * D.effect.deathRatio * mechIntensity(state))), 1);
      m.sickness = D.effect.after;
      strike(state, 'disease');
      pushNotice(state, {
        kind: 'bad',
        icon: I.sick,
        title: 'La fièvre',
        text: `Une fièvre lente emporte ${lost} villageois.`,
      });
    }
    const peak = Math.max(memo(state, 'sickPeak'), m.sickness);
    memo(state, 'sickPeak', peak);
    if (peak >= D.solution.recovered.from && m.sickness <= D.solution.recovered.to) {
      solve(state, 'disease');
      memo(state, 'sickPeak', 0);
    }
  },
};

