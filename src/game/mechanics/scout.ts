// Éclaireur bandit : quelques jours avant une attaque, une silhouette immobile observe le village
// depuis le bord de la carte. Si on la laisse repartir, la bande attaque.
// Solution (jamais dite) : cliquer dessus pour l'attraper — l'attaque n'a alors pas lieu.

import { TUNING } from '../events';
import { pushNotice } from '../stateUtils';
import type { GameState, Point } from '../types';
import { type Mechanic, center, dist, solve, strike } from './common';

export const SCOUT = {
  conditions: {
    /** Attaques précédées d'un éclaireur */
    events: ['bandits', 'invasion'],
  },
  hint: {
    /** Distance hors de la carte où il se tient (cases) */
    outside: 0.4,
  },
  effect: {
    /** Vitesse du poursuivant (cases / jour) : celle des gardes */
    chaseSpeed: () => TUNING.raid.guardSpeed,
  },
  solution: {},
};

function edgeSpot(state: GameState, edge: number, along: number): Point {
  const { width: w, height: h } = state.map;
  const o = SCOUT.hint.outside;
  return [
    { x: along * w, z: -o },
    { x: w + o, z: along * h },
    { x: along * w, z: h + o },
    { x: -o, z: along * h },
  ][((edge % 4) + 4) % 4];
}

/** Action joueur (mutation) : un garde (ou un villageois) part attraper l'éclaireur */
export function chaseScout(state: GameState, t: number): string | null {
  const scout = state.mech.scout;
  if (!scout) return 'Il n\'y a personne';
  if (scout.chase) return 'Quelqu\'un est déjà parti';
  const pending = state.pending.find((p) => p.id === scout.pendingId);
  if (!pending) return 'Il est déjà reparti';
  const towers = state.buildings.filter((b) => b.type === 'tower' && b.workers > 0);
  const castle = state.buildings.find((b) => b.type === 'castle');
  const starts = (towers.length ? towers : castle ? [castle] : []).map(center);
  if (!starts.length) return 'Personne pour y aller';
  const from = starts.sort((a, b) => dist(a, scout) - dist(b, scout))[0];
  const meetT = t + dist(from, scout) / SCOUT.effect.chaseSpeed();
  if (meetT >= pending.arriveDay) return 'Trop loin : il repartira avant';
  scout.chase = { from, startT: t, meetT };
  return null;
}

export const scout: Mechanic<typeof SCOUT> = {
  id: 'scout',
  icon: '👁️',
  title: 'La silhouette',
  page: 'La veille de l\'attaque, quelqu\'un se tenait immobile à la lisière. Personne n\'y a prêté attention.',
  solvedPage: 'L\'homme de la lisière a été pris avant de pouvoir rapporter ce qu\'il avait vu. Sa bande n\'est jamais venue.',
  config: SCOUT,
  startOfDay: ({ state, rng }) => {
    const m = state.mech;
    // L'attaque est arrivée alors que l'éclaireur avait été vu : la page s'écrit
    if (m.scout && !state.pending.some((p) => p.id === m.scout!.pendingId)) {
      strike(state, 'scout');
      m.scout = null;
    }
    if (m.scout) return;
    const raid = state.pending.find((p) => SCOUT.conditions.events.includes(p.eventId) && p.arriveDay > state.day);
    if (!raid) return;
    const spot = edgeSpot(state, raid.params.edge ?? 0, rng.range(0.25, 0.75));
    m.scout = { pendingId: raid.id, x: spot.x, z: spot.z };
  },
  due: (state, t) => !!state.mech.scout?.chase && t >= state.mech.scout.chase.meetT,
  update: ({ state }) => {
    const sc = state.mech.scout;
    if (!sc?.chase) return;
    const pending = state.pending.find((p) => p.id === sc.pendingId);
    state.mech.scout = null;
    if (!pending) return;
    state.pending = state.pending.filter((p) => p.id !== pending.id);
    const notice = state.notices.find((n) => n.id === pending.noticeId);
    if (notice?.threat) {
      notice.threat.done = true;
      if (notice.choice && !notice.choice.resolved) notice.choice.resolved = true;
    }
    solve(state, 'scout');
    pushNotice(state, {
      kind: 'good',
      icon: '👁️',
      title: 'L\'homme de la lisière',
      text: 'On ramène un inconnu qui épiait le village. Les jours suivants, personne ne vient.',
    });
  },
};
