// Déforestation : les bûcherons abattent les arbres voisins. Une forêt rasée repousse très lentement,
// et une vallée sans arbres laisse la rivière déborder plus fort.
// Indice : les arbres se clairsèment et rapetissent, puis il ne reste que des souches.

import { tileAt, neighbors8 } from '../mapgen';
import { statsOf } from '../rules';
import type { Building, GameState } from '../types';
import { type Mechanic, solve, strike } from './common';
import { I } from '../../ui/icons';

export const DEFORESTATION = {
  conditions: {
    /** Santé de forêt perdue par unité de bois produite (répartie sur les cases boisées voisines) */
    cutPerWood: 0.003,
  },
  hint: {
    /** En dessous de cette santé, les arbres disparaissent un à un (rendu) */
    thinFrom: 0.85,
  },
  effect: {
    /** En dessous : la case n'est plus une forêt (souches) */
    clearedBelow: 0.12,
    /** Santé de forêt voisine qui suffit à un bûcheron pour tourner à plein */
    fullLumberHealth: 0.8,
    /** Part de la forêt d'origine abattue à partir de laquelle les crues sont plus violentes */
    floodRatio: 0.35,
  },
  solution: {
    /** Repousse par jour (case voisine d'une forêt saine), sinon `regrowAlone` */
    regrow: 0.006,
    regrowAlone: 0.0015,
    /** Une case rasée qui retrouve cette santé complète la page */
    regrownAt: 0.6,
  },
};

const idx = (state: GameState, x: number, z: number) => z * state.map.width + x;

export function forestHealth(state: GameState, x: number, z: number): number {
  if (tileAt(state.map, x, z) !== 'forest') return 0;
  return state.mech?.forest?.[idx(state, x, z)] ?? 1;
}

/** Case boisée encore debout (les souches ne comptent plus) */
export function isForest(state: GameState, x: number, z: number): boolean {
  return forestHealth(state, x, z) >= DEFORESTATION.effect.clearedBelow;
}

/** Facteur de production d'un bûcheron selon la forêt qui l'entoure */
export function lumberForestFactor(state: GameState, b: Building): number {
  const total = neighbors8(b.x, b.z).reduce((sum, [x, z]) => sum + (isForest(state, x, z) ? forestHealth(state, x, z) : 0), 0);
  return Math.min(1, total / DEFORESTATION.effect.fullLumberHealth);
}

/** Part de la forêt d'origine abattue (0 → 1) */
export function deforestedRatio(state: GameState): number {
  let total = 0;
  let cut = 0;
  state.map.tiles.forEach((t, i) => {
    if (t !== 'forest') return;
    total++;
    cut += 1 - (state.mech.forest[i] ?? 1);
  });
  return total ? cut / total : 0;
}

export const deforestation: Mechanic<typeof DEFORESTATION> = {
  id: 'deforestation',
  icon: I.wood,
  title: 'Les souches',
  page: 'Là où chantaient les bois, il ne reste que des souches. Les anciens regardent la rivière en hochant la tête.',
  solvedPage: 'Quelques pousses vertes percent entre les souches. Laissée en paix, la forêt finit par revenir — mais elle prend son temps.',
  config: DEFORESTATION,
  endOfDay: ({ state }) => {
    const C = DEFORESTATION;
    const forest = state.mech.forest;
    // Abattage autour de chaque bûcheron au travail
    for (const b of state.buildings) {
      if (b.type !== 'lumber' || b.workers <= 0 || b.fire) continue;
      const stats = statsOf(b);
      const wood = (stats.produces?.wood ?? 0) * (b.workers / (stats.workers ?? 1));
      const spots = neighbors8(b.x, b.z).filter(([x, z]) => isForest(state, x, z));
      if (!spots.length) continue;
      const cut = (wood * C.conditions.cutPerWood) / spots.length;
      for (const [x, z] of spots) {
        const i = idx(state, x, z);
        forest[i] = Math.max(0, forest[i] - cut);
        if (forest[i] < C.effect.clearedBelow) {
          strike(state, 'deforestation');
          state.mech.memo[`cleared:${i}`] = 1;
        }
      }
    }
    // Repousse lente
    state.map.tiles.forEach((t, i) => {
      if (t !== 'forest' || forest[i] >= 1) return;
      const x = i % state.map.width;
      const z = Math.floor(i / state.map.width);
      const healthy = neighbors8(x, z).some(([nx, nz]) => forestHealth(state, nx, nz) >= 0.8);
      const lumberNear = state.buildings.some((b) => b.type === 'lumber' && b.workers > 0 && Math.abs(b.x - x) <= 1 && Math.abs(b.z - z) <= 1);
      if (lumberNear) return;
      forest[i] = Math.min(1, forest[i] + (healthy ? C.solution.regrow : C.solution.regrowAlone));
      if (state.mech.memo[`cleared:${i}`] && forest[i] >= C.solution.regrownAt) solve(state, 'deforestation');
    });
  },
};
