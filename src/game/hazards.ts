// Dangers en temps réel (au fil de la journée) : incendies, attaques de bandits, délais des choix.
// Toutes les durées sont en temps de jeu (jours), réglables dans TUNING (events.ts).

import { BUILDING_BY_ID } from './buildings';
import { RESOURCE_KEYS } from './config';
import { TUNING, addMorale, applyChoice, formatResources, loseVillagers } from './events';
import { Rng } from './rng';
import { assignWorkers, defensePower } from './rules';
import { cloneState, gameTime, pushNotice } from './stateUtils';
import type { Building, GameState, Raid, Resources } from './types';

/** Position d'un bandit (coordonnées de cases, continues) au temps t — partagé avec le rendu */
export function banditPosition(raid: Raid, index: number, t: number): { x: number; z: number; leaving: boolean } {
  const n = raid.killedAt.length;
  // Petit décalage latéral et temporel par bandit pour former une colonne
  const lateral = (index - (n - 1) / 2) * 0.35;
  const lag = index * 0.012;
  const dx = raid.to.x - raid.from.x;
  const dz = raid.to.z - raid.from.z;
  const len = Math.hypot(dx, dz) || 1;
  const px = -dz / len;
  const pz = dx / len;
  let k: number;
  let leaving = false;
  if (t < raid.arriveT) {
    k = Math.min(1, Math.max(0, (t - raid.startT - lag) / (raid.arriveT - raid.startT)));
  } else {
    leaving = true;
    k = 1 - Math.min(1, Math.max(0, (t - raid.arriveT - lag) / (raid.leaveT - raid.arriveT)));
  }
  // Ils s'arrêtent un peu avant le centre du château
  k *= 0.92;
  return { x: raid.from.x + dx * k + px * lateral, z: raid.from.z + dz * k + pz * lateral, leaving };
}

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
  const r = state.raid;
  if (r && (t >= r.nextTowerKill || (!r.arrived && t >= r.arriveT) || t >= r.leaveT)) return true;
  for (const n of state.notices) if (n.choice && !n.choice.resolved && t >= n.choice.expiresT) return true;
  return false;
}

/** Met à jour les dangers jusqu'au temps t. Renvoie un nouvel état (ou le même si rien à faire). */
export function updateHazards(state: GameState, t: number): GameState {
  if (!hazardsDue(state, t)) return state;
  const s = cloneState(state);
  const rng = new Rng(s.rngState);
  updateFires(s, t, rng);
  updateRaid(s, t, rng);
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
        delete b.fire;
        b.damaged = true;
        s.stats.firesPutOut++;
      }
      continue;
    }
    while (t >= f.nextSpread && f.nextSpread < f.destroyAt) {
      const at = f.nextSpread;
      f.nextSpread += F.spreadEvery;
      if (!rng.chance(F.spreadChance)) continue;
      const near = neighborsOf(s, b).filter((o) => o.type !== 'castle');
      if (!near.length) continue;
      const target = rng.pick(near);
      target.fire = { start: at, nextSpread: at + F.spreadEvery, destroyAt: at + F.destroyAfter };
      addMorale(s, TUNING.morale.fireStarted);
      pushNotice(s, { kind: 'bad', icon: '🔥', title: 'Le feu se propage', text: `${name} → ${BUILDING_BY_ID[target.type].name}. Cliquez dessus pour l'éteindre !` });
    }
    if (t >= f.destroyAt) {
      if (b.type === 'castle') {
        delete b.fire;
        b.damaged = true;
        pushNotice(s, { kind: 'bad', icon: '🔥', title: 'Château incendié', text: 'Le feu s\'éteint de lui-même, mais le château est endommagé.' });
      } else {
        s.buildings = s.buildings.filter((x) => x.id !== b.id);
        addMorale(s, TUNING.morale.buildingLost);
        const victims = b.type === 'field' ? 0 : loseVillagers(s, rng.chance(0.3) ? 1 : 0, 1);
        pushNotice(s, {
          kind: 'bad',
          icon: '🔥',
          title: 'Bâtiment réduit en cendres',
          text: `${name} a entièrement brûlé${victims ? ', 1 villageois a péri' : ''}.`,
        });
      }
    }
  }
}

function aliveIndexes(raid: Raid): number[] {
  return raid.killedAt.map((k, i) => (k < 0 ? i : -1)).filter((i) => i >= 0);
}

/** Tue un bandit ; s'il fuyait avec du butin, le butin est récupéré */
export function killBandit(s: GameState, index: number, at: number) {
  const raid = s.raid;
  if (!raid || raid.killedAt[index] >= 0) return;
  raid.killedAt[index] = at;
  s.stats.banditsKilled++;
  if (raid.arrived && raid.lootEach) {
    for (const k of RESOURCE_KEYS) s.resources[k] += raid.lootEach[k] ?? 0;
  }
}

/** Termine l'attaque si tous les bandits sont tombés. Renvoie vrai si c'est le cas. */
function endRaidIfDefeated(s: GameState): boolean {
  const raid = s.raid;
  if (!raid || aliveIndexes(raid).length) return false;
  s.raid = null;
  if (!raid.arrived) {
    addMorale(s, TUNING.morale.repelled);
    pushNotice(s, { kind: 'good', icon: '🛡️', title: 'Bandits repoussés', text: `Les ${raid.killedAt.length} bandits ont été abattus avant d'atteindre le château !` });
  } else {
    pushNotice(s, { kind: 'good', icon: '🛡️', title: 'Butin récupéré', text: 'Tous les pillards ont été rattrapés.' });
  }
  return true;
}

function updateRaid(s: GameState, t: number, rng: Rng) {
  const raid = s.raid;
  if (!raid) return;
  const R = TUNING.raid;

  // Tirs des tours (avant et après le pillage)
  const end = Math.min(t, raid.leaveT);
  while (raid.nextTowerKill <= end) {
    const alive = aliveIndexes(raid);
    if (!alive.length) break;
    killBandit(s, rng.pick(alive), raid.nextTowerKill);
    const d = defensePower(s);
    raid.nextTowerKill = d > 0 ? raid.nextTowerKill + R.towerKillInterval / d : 1e9;
  }

  if (endRaidIfDefeated(s)) return;

  if (!raid.arrived && t >= raid.arriveT) {
    raid.arrived = true;
    const alive = aliveIndexes(raid).length;
    const ratio = Math.min(R.maxSteal, alive * R.stealPerBandit);
    const stolen: Partial<Resources> = {};
    const each: Partial<Resources> = {};
    for (const k of RESOURCE_KEYS) {
      stolen[k] = Math.floor(s.resources[k] * ratio);
      s.resources[k] -= stolen[k]!;
      each[k] = stolen[k]! / alive;
    }
    raid.lootEach = each;
    addMorale(s, TUNING.morale.pillage * Math.min(1, alive / 4));
    pushNotice(s, {
      kind: 'bad',
      icon: '💰',
      title: 'Pillage !',
      text: `${alive} bandits pillent le château : ${formatResources(stolen)}. Abattez-les avant qu'ils ne s'enfuient pour récupérer le butin !`,
    });
  }

  if (t >= raid.leaveT) {
    s.raid = null;
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
  target.fire!.extinguishEnd = t + TUNING.fire.extinguishTime;
  target.fire!.crew = crew;
  // Pendant l'extinction, le feu ne détruit plus et ne se propage plus
  target.fire!.destroyAt = 1e9;
  target.fire!.nextSpread = 1e9;
  assignWorkers(s);
  return s;
}

/** Action joueur : attaquer un bandit (risque de perdre un villageois) */
export function fightBandit(state: GameState, index: number): GameState | null {
  const raid = state.raid;
  if (!raid || raid.killedAt[index] === undefined || raid.killedAt[index] >= 0 || state.gameOver) return null;
  const s = cloneState(state);
  const rng = new Rng(s.rngState);
  const t = gameTime(s);
  killBandit(s, index, t);
  const risk = TUNING.raid.clickDeathChance * Math.max(0.2, 1 - defensePower(s) * 0.15);
  if (rng.chance(risk)) {
    const lost = loseVillagers(s, 1, 1);
    if (lost) pushNotice(s, { kind: 'bad', icon: '⚔️', title: 'Mort au combat', text: 'Un villageois est tombé en affrontant un bandit.' });
  }
  s.rngState = rng.state;
  endRaidIfDefeated(s);
  if (s.population <= 0) s.gameOver = true;
  return s;
}
