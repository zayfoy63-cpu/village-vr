// Crue : après plusieurs jours de pluie, la rivière gonfle puis sort de son lit et emporte ce qui
// la borde. Les champs au bord de l'eau sont pourtant plus fertiles : c'est un compromis.
// Indice : la rivière s'assombrit et monte un peu, jour de pluie après jour de pluie.
// Solution (jamais dite) : une digue au bord de l'eau, ou ne pas bâtir collé à la rivière.
// Une vallée déboisée (voir deforestation.ts) déborde plus vite et plus loin.

import { mechIntensity } from '../difficulty';
import { neighbors8, tileAt } from '../mapgen';
import { playerBuildings } from '../events';
import { startFlood } from '../realtime';
import { pushNotice } from '../stateUtils';
import type { Building, GameState } from '../types';
import { type Mechanic, center, solve, strike, within } from './common';
import { DEFORESTATION, deforestedRatio } from './deforestation';
import { I } from '../../ui/icons';

export const FLOOD = {
  conditions: {
    /** Gonflement par jour de pluie, décrue par jour sec (la crue part à 1) */
    swellPerRain: 0.34,
    dryRecovery: 0.15,
    /** Vallée déboisée : la rivière gonfle plus vite */
    deforestedSwell: 1.5,
  },
  hint: {
    /** La rivière s'assombrit et monte à partir de ce niveau (rendu) */
    darkFrom: 0.3,
  },
  effect: {
    /** Cases d'eau à portée (1 = bâtiments collés à l'eau ; 2 si la vallée est déboisée) */
    reach: 1,
    reachDeforested: 2,
    /** Niveau de la rivière après la crue */
    after: 0.3,
  },
  solution: {
    /** Une digue protège les bâtiments à moins de X cases */
    dikeRadius: 2.6,
    /** Bonus des champs au bord de l'eau (le compromis) */
    riversideFertility: 1.3,
    /** Une crue sans perte avec au moins X champs complète la page */
    minFields: 4,
  },
};

function nearWater(state: GameState, b: Building, reach: number): boolean {
  for (let dz = -reach; dz <= reach; dz++)
    for (let dx = -reach; dx <= reach; dx++) if (tileAt(state.map, b.x + dx, b.z + dz) === 'water') return true;
  return false;
}

/** Bonus caché des champs collés à l'eau */
export function riversideFactor(state: GameState, b: Building): number {
  if (b.type !== 'field') return 1;
  return neighbors8(b.x, b.z).some(([x, z]) => tileAt(state.map, x, z) === 'water') ? FLOOD.solution.riversideFertility : 1;
}

/** Bâtiments que la prochaine crue atteindrait, et ceux qu'une digue protège */
export function floodZone(state: GameState): { threatened: number[]; saved: number[] } {
  const reach = deforestedRatio(state) >= DEFORESTATION.effect.floodRatio ? FLOOD.effect.reachDeforested : FLOOD.effect.reach;
  const threatened: number[] = [];
  const saved: number[] = [];
  for (const b of playerBuildings(state)) {
    if (b.type === 'dike' || !nearWater(state, b, reach)) continue;
    const guarded = within(state, center(b), ['dike'], FLOOD.solution.dikeRadius).length > 0;
    (guarded ? saved : threatened).push(b.id);
  }
  return { threatened, saved };
}

/** Au pic de la crue (appelé par realtime.ts) */
export function onFloodPeak(state: GameState, lost: number) {
  const f = state.flood;
  if (lost > 0) strike(state, 'flood');
  else if ((f?.saved?.length ?? 0) > 0 || state.buildings.filter((b) => b.type === 'field').length >= FLOOD.solution.minFields) {
    solve(state, 'flood');
  }
}

export const flood: Mechanic<typeof FLOOD> = {
  id: 'flood',
  icon: I.flood,
  title: 'La rivière',
  page: 'Après des jours de pluie, la rivière a pris une couleur de boue et s\'est gonflée. Puis elle est sortie de son lit et a emporté ce qui la bordait.',
  solvedPage: 'La rivière a grondé, mais n\'a rien pris cette fois : ce qui reste loin des berges, ou derrière un bon talus, ne craint rien.',
  config: FLOOD,
  startOfDay: ({ state, rng, now }) => {
    const F = FLOOD;
    const m = state.mech;
    const swell = F.conditions.swellPerRain * mechIntensity(state) * (deforestedRatio(state) >= DEFORESTATION.effect.floodRatio ? F.conditions.deforestedSwell : 1);
    m.river = Math.max(0, Math.min(1, m.river + (m.rain ? swell : -F.conditions.dryRecovery)));
    if (m.river < 1 || state.flood) return;
    m.river = F.effect.after;
    const zone = floodZone(state);
    const f = startFlood(state, now + rng.range(0.05, 0.25), false);
    f.threatened = zone.threatened;
    f.saved = zone.saved;
    pushNotice(state, { kind: 'bad', icon: I.flood, title: 'Crue', text: 'La rivière sort de son lit !' });
  },
};
