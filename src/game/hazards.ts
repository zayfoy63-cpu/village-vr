// Dangers en temps réel (au fil de la journée) : incendies, délais des choix, et actions du joueur
// pendant les événements en temps réel (bandits, orage, crue : voir realtime.ts).
// Toutes les durées sont en temps de jeu (jours), réglables dans TUNING (events.ts).

import { BUILDING_BY_ID } from './buildings';
import { RESOURCE_KEYS } from './config';
import { TUNING, addMorale, applyChoice, loseVillagers } from './events';
import { mechanicsDue, updateMechanics } from './mechanics';
import { extinguishFactor, onFireEnd, onFireSpread, spreadChance } from './mechanics/fire';
import { chaseScout } from './mechanics/scout';
import { dispatchGuard, realtimeDue, seizeBandit, updateRealtime } from './realtime';
import { Rng } from './rng';
import { assignWorkers, canAfford } from './rules';
import { cloneState, gameTime, pushNotice } from './stateUtils';
import type { Building, GameState, Resources } from './types';
import { I } from '../ui/icons';

function burning(state: GameState): Building[] {
  return state.buildings.filter((b) => b.fire);
}

/** Vrai si un incendie, un raid ou un délai de choix demande une mise à jour au temps t */
export function hazardsDue(state: GameState, t: number): boolean {
  for (const b of state.buildings) {
    const f = b.fire;
    if (!f) continue;
    if (f.extinguishEnd !== undefined ? t >= f.extinguishEnd : t >= f.nextSpread || t >= f.destroyAt) return true;
  }
  if (realtimeDue(state, t) || mechanicsDue(state, t)) return true;
  for (const n of state.notices) if (n.choice && !n.choice.resolved && t >= n.choice.expiresT) return true;
  return false;
}

/** Met à jour les dangers jusqu'au temps t. Renvoie un nouvel état (ou le même si rien à faire). */
export function updateHazards(state: GameState, t: number): GameState {
  if (!hazardsDue(state, t)) return state;
  const s = cloneState(state);
  const rng = new Rng(s.rngState);
  updateFires(s, t, rng);
  updateRealtime(s, t, rng);
  updateMechanics(s, t, rng);
  for (const n of s.notices) {
    if (n.choice && !n.choice.resolved && t >= n.choice.expiresT) applyChoice(s, n, n.choice.defaultId, rng, t, true);
  }
  assignWorkers(s);
  if (s.population <= 0) {
    s.population = 0;
    s.gameOver = true;
  }
  s.rngState = rng.state;
  return s;
}

function neighborsOf(state: GameState, b: Building): Building[] {
  const size = BUILDING_BY_ID[b.type].size;
  return state.buildings.filter((o) => {
    if (o.id === b.id || o.fire || o.type === 'mill') return false;
    const os = BUILDING_BY_ID[o.type].size;
    // Distance de Chebyshev entre emprises ≤ 1 case
    const gapX = Math.max(o.x - (b.x + size - 1), b.x - (o.x + os - 1), 0);
    const gapZ = Math.max(o.z - (b.z + size - 1), b.z - (o.z + os - 1), 0);
    return gapX <= 1 && gapZ <= 1;
  });
}

function updateFires(s: GameState, t: number, rng: Rng) {
  const F = TUNING.fire;
  for (const b of burning(s).sort((a, c) => a.id - c.id)) {
    const f = b.fire!;
    const name = BUILDING_BY_ID[b.type].name;
    if (f.extinguishEnd !== undefined) {
      if (t >= f.extinguishEnd) {
        onFireEnd(s, b);
        delete b.fire;
        b.damaged = true;
        s.stats.firesPutOut++;
      }
      continue;
    }
    while (t >= f.nextSpread && f.nextSpread < f.destroyAt) {
      const at = f.nextSpread;
      f.nextSpread += F.spreadEvery;
      if (!rng.chance(spreadChance(s, b))) continue;
      const near = neighborsOf(s, b).filter((o) => o.type !== 'castle');
      if (!near.length) continue;
      const target = rng.pick(near);
      onFireSpread(s, b);
      target.fire = { start: at, nextSpread: at + F.spreadEvery, destroyAt: at + F.destroyAfter };
      addMorale(s, TUNING.morale.fireStarted);
      pushNotice(s, { kind: 'bad', icon: I.fire, title: 'Le feu se propage', text: `${name} → ${BUILDING_BY_ID[target.type].name}. Cliquez dessus pour l'éteindre !`, at: { x: target.x, z: target.z } });
    }
    if (t >= f.destroyAt) {
      onFireEnd(s, b);
      if (b.type === 'castle') {
        delete b.fire;
        b.damaged = true;
        pushNotice(s, { kind: 'bad', icon: I.fire, title: 'Château incendié', text: 'Le feu s\'éteint de lui-même, mais le château est endommagé.' });
      } else {
        s.buildings = s.buildings.filter((x) => x.id !== b.id);
        addMorale(s, TUNING.morale.buildingLost);
        const victims = b.type === 'field' ? 0 : loseVillagers(s, rng.chance(0.3) ? 1 : 0, 1);
        pushNotice(s, {
          at: { x: b.x, z: b.z },
          kind: 'bad',
          icon: I.fire,
          title: 'Bâtiment réduit en cendres',
          text: `${name} a entièrement brûlé${victims ? ', 1 villageois a péri' : ''}.`,
        });
      }
    }
  }
}

/** Action joueur : envoyer des villageois éteindre un incendie */
export function extinguishFire(state: GameState, buildingId: number): GameState | null {
  const b = state.buildings.find((x) => x.id === buildingId);
  if (!b?.fire || b.fire.extinguishEnd !== undefined || state.gameOver) return null;
  const s = cloneState(state);
  const t = gameTime(s);
  const target = s.buildings.find((x) => x.id === buildingId)!;
  const crew = Math.min(TUNING.fire.crew, Math.max(1, s.population - 1));
  target.fire!.extinguishEnd = t + TUNING.fire.extinguishTime * extinguishFactor(s, target);
  target.fire!.crew = crew;
  // Pendant l'extinction, le feu ne détruit plus et ne se propage plus
  target.fire!.destroyAt = 1e9;
  target.fire!.nextSpread = 1e9;
  assignWorkers(s);
  return s;
}

/** Action joueur : clic sur l'éclaireur au bord de la carte */
export function catchScout(state: GameState): { state: GameState | null; reason?: string } {
  if (!state.mech.scout || state.gameOver) return { state: null };
  const s = cloneState(state);
  const reason = chaseScout(s, gameTime(s));
  return reason ? { state: null, reason } : { state: s };
}

/** Action joueur (VR) : saisir un bandit à la main */
export function grabBandit(state: GameState, banditId: number): GameState | null {
  if (!state.raid || state.gameOver) return null;
  const s = cloneState(state);
  const rng = new Rng(s.rngState);
  if (!seizeBandit(s, banditId, gameTime(s), rng)) return null;
  s.rngState = rng.state;
  return s;
}

/** Action joueur : clic sur un bandit → un garde (ou des villageois) part l'intercepter */
export function sendGuard(state: GameState, banditId: number): { state: GameState | null; reason?: string } {
  if (!state.raid || state.gameOver) return { state: null, reason: 'Aucune attaque en cours' };
  const s = cloneState(state);
  const res = dispatchGuard(s, banditId, gameTime(s));
  if (!res.ok) return { state: null, reason: res.reason };
  return { state: s };
}

/** Coût pour renforcer ce bâtiment maintenant (null = rien à renforcer : pas d'orage ni de crue qui le menace) */
export function reinforceCost(state: GameState, buildingId: number): Partial<Resources> | null {
  const b = state.buildings.find((x) => x.id === buildingId);
  if (!b || b.reinforced || state.gameOver) return null;
  const floodThreat = state.flood && !state.flood.resolved && state.flood.threatened.includes(b.id);
  if (floodThreat) return TUNING.flood.sandbagCost;
  const stormActive = state.storm && gameTime(state) < state.storm.endT && BUILDING_BY_ID[b.type].buildable;
  return stormActive ? TUNING.storm.reinforceCost : null;
}

export function reinforceBuilding(state: GameState, buildingId: number): GameState | null {
  const cost = reinforceCost(state, buildingId);
  if (!cost || !canAfford(state.resources, cost)) return null;
  const s = cloneState(state);
  for (const k of RESOURCE_KEYS) s.resources[k] -= cost[k] ?? 0;
  s.buildings.find((x) => x.id === buildingId)!.reinforced = true;
  return s;
}

/** Action joueur : mettre les villageois à l'abri pendant l'orage (production du jour réduite, pas de blessés) */
export function shelterVillagers(state: GameState): GameState | null {
  if (!state.storm || state.storm.shelter || state.gameOver) return null;
  const s = cloneState(state);
  s.storm!.shelter = true;
  s.modifiers = s.modifiers.filter((m) => m.id !== 'sheltered');
  s.modifiers.push({ id: 'sheltered', untilDay: s.day });
  return s;
}

export function cropsProtectionCost(state: GameState): Partial<Resources> {
  const fields = state.buildings.filter((b) => b.type === 'field').length;
  const out: Partial<Resources> = {};
  for (const k of RESOURCE_KEYS) if (TUNING.storm.cropsCostPerField[k]) out[k] = Math.max(1, fields * TUNING.storm.cropsCostPerField[k]!);
  return out;
}

/** Action joueur : bâcher les récoltes (les champs sous l'orage ne sont pas abîmés) */
export function protectCrops(state: GameState): GameState | null {
  if (!state.storm || state.storm.cropsProtected || state.gameOver) return null;
  const cost = cropsProtectionCost(state);
  if (!canAfford(state.resources, cost)) return null;
  const s = cloneState(state);
  for (const k of RESOURCE_KEYS) s.resources[k] -= cost[k] ?? 0;
  s.storm!.cropsProtected = true;
  return s;
}
