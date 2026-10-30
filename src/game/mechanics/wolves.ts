// Loups : les nuits d'hiver, une meute sort de la forêt et s'en prend aux moutons et aux villageois
// isolés. Indice : des yeux qui brillent à la lisière des bois, la nuit.
// Solution (jamais dite) : des torches ou une palissade près de ce qui est exposé.

import { seasonOf } from '../config';
import { mechIntensity } from '../difficulty';
import { loseVillagers, playerBuildings } from '../events';
import { NIGHT } from '../seasons';
import { pushNotice } from '../stateUtils';
import type { Building, GameState, Point } from '../types';
import { type Mechanic, center, dist, gap, solve, strike, within } from './common';
import { isForest } from './deforestation';
import { I } from '../../ui/icons';

export const WOLVES = {
  conditions: {
    /** Pas de loups avant ce jour */
    fromDay: 25,
    /** Chance qu'une meute sorte une nuit d'hiver (+ par année) */
    chance: 0.3,
    perYear: 0.1,
  },
  hint: {
    /** Yeux visibles à la lisière les nuits d'hiver (rendu) */
    eyes: 4,
  },
  effect: {
    pack: [1, 3] as [number, number],
    /** Vitesse (cases / jour) */
    speed: 12,
    /** Temps passé sur place avant de repartir */
    stay: 0.08,
    /** Villageois isolé attaqué : chance qu'il meure (sinon blessé) */
    killChance: 0.45,
    injuryDays: 4,
    /** Poids de tirage d'une bergerie comme cible */
    sheepWeight: 3,
  },
  solution: {
    torchRadius: 2.6,
    palisadeRadius: 2.1,
  },
};

/** Bâtiments exposés aux loups : bergeries, et constructions sans voisin proche */
export function exposedBuildings(state: GameState): Building[] {
  return playerBuildings(state).filter(
    (b) =>
      !['torch', 'palisade', 'dike', 'well'].includes(b.type) &&
      (b.type === 'sheepfold' || !state.buildings.some((o) => o.id !== b.id && gap(b, o) <= 1)),
  );
}

export function guardedAgainstWolves(state: GameState, b: Building): boolean {
  const c = center(b);
  return within(state, c, ['torch'], WOLVES.solution.torchRadius).length > 0 || within(state, c, ['palisade'], WOLVES.solution.palisadeRadius).length > 0;
}

function nearestForest(state: GameState, p: Point): Point {
  let best: Point | null = null;
  for (let z = 0; z < state.map.height; z++)
    for (let x = 0; x < state.map.width; x++) {
      if (!isForest(state, x, z)) continue;
      const q = { x: x + 0.5, z: z + 0.5 };
      if (!best || dist(q, p) < dist(best, p)) best = q;
    }
  return best ?? { x: p.x < state.map.width / 2 ? -1 : state.map.width + 1, z: p.z };
}

export const wolves: Mechanic<typeof WOLVES> = {
  id: 'wolves',
  icon: I.wolf,
  title: 'Les yeux dans le noir',
  page: 'Une nuit de neige, des yeux ont brillé à la lisière. Au matin, il y avait des traces, et du sang.',
  solvedPage: 'Les hurlements ont tourné autour du village toute la nuit, sans jamais approcher : les bêtes n\'aiment ni les flammes ni les pieux.',
  config: WOLVES,
  startOfDay: ({ state, rng }) => {
    const W = WOLVES;
    if (seasonOf(state.day).id !== 'winter' || state.day < W.conditions.fromDay || state.mech.wolves) return;
    const year = Math.floor((state.day - 1) / 40);
    if (!rng.chance((W.conditions.chance + W.conditions.perYear * year) * mechIntensity(state))) return;
    const exposed = exposedBuildings(state);
    if (!exposed.length) return;
    const target = rng.weighted(exposed, (b) => (b.type === 'sheepfold' ? W.effect.sheepWeight : 1))!;
    const c = center(target);
    const from = nearestForest(state, c);
    const repelled = guardedAgainstWolves(state, target);
    // Protégée : la meute s'arrête à la limite de la lumière / des pieux
    const stopAt = repelled ? W.solution.torchRadius + 0.3 : 0.2;
    const d = Math.max(0.01, dist(from, c));
    const k = Math.max(0, (d - stopAt) / d);
    const to = { x: from.x + (c.x - from.x) * k, z: from.z + (c.z - from.z) * k };
    const startT = state.day + NIGHT.winterFrom + 0.04 + rng.range(0, 0.05);
    const arriveT = startT + dist(from, to) / W.effect.speed;
    state.mech.wolves = {
      count: rng.int(W.effect.pack[0], W.effect.pack[1]),
      from,
      to,
      targetId: target.id,
      startT,
      arriveT,
      leaveT: arriveT + W.effect.stay,
      repelled,
      resolved: false,
    };
  },
  due: (state, t) => {
    const w = state.mech.wolves;
    return !!w && ((!w.resolved && t >= w.arriveT) || t >= w.leaveT + dist(w.from, w.to) / WOLVES.effect.speed);
  },
  update: ({ state, rng, now }) => {
    const W = WOLVES;
    const w = state.mech.wolves!;
    if (!w.resolved && now >= w.arriveT) {
      w.resolved = true;
      const target = state.buildings.find((b) => b.id === w.targetId);
      if (w.repelled) solve(state, 'wolves');
      else if (target) {
        strike(state, 'wolves');
        if (target.type === 'sheepfold') {
          target.damaged = true;
          pushNotice(state, { kind: 'bad', icon: I.wolf, title: 'La bergerie', text: 'Au matin, l\'enclos est éventré : il manque des bêtes.' });
        } else if (state.population > 1) {
          const dead = rng.chance(Math.min(0.9, W.effect.killChance * mechIntensity(state))) ? loseVillagers(state, 1, 1) : 0;
          if (!dead) state.injuries.push({ count: 1, untilDay: state.day + W.effect.injuryDays });
          pushNotice(state, {
            kind: 'bad',
            icon: I.wolf,
            title: 'Une nuit de neige',
            text: dead ? 'On a retrouvé des traces dans la neige… et personne au bout.' : 'Un villageois rentre au petit jour, mordu et transi.',
          });
        }
      }
    }
    if (now >= w.leaveT + dist(w.from, w.to) / W.effect.speed) state.mech.wolves = null;
  },
};

/** Position de la meute au temps t (aller, attente, retour), null si elle n'est pas dehors */
export function wolvesAt(w: GameState['mech']['wolves'], t: number): Point | null {
  if (!w || t < w.startT) return null;
  const back = w.leaveT + dist(w.from, w.to) / WOLVES.effect.speed;
  if (t >= back) return null;
  const k = t < w.arriveT ? (t - w.startT) / Math.max(1e-6, w.arriveT - w.startT) : t < w.leaveT ? 1 : 1 - (t - w.leaveT) / Math.max(1e-6, back - w.leaveT);
  return { x: w.from.x + (w.to.x - w.from.x) * k, z: w.from.z + (w.to.z - w.from.z) * k };
}
