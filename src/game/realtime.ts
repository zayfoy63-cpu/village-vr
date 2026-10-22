// Événements en temps réel : bandits qui courent, gardes qui les interceptent, orage qui traverse
// la carte, crue qui monte. Tout est déterministe : les trajets sont calculés à l'avance et les
// événements (vol, capture, fuite, dégâts) sont traités dans l'ordre chronologique.
// Réglages : TUNING.raid / TUNING.storm / TUNING.flood dans events.ts.

import { BUILDING_BY_ID } from './buildings';
import { RESOURCE_KEYS } from './config';
import {
  TUNING,
  addMorale,
  damageBuilding,
  formatResources,
  playerBuildings,
  severity,
  startFire,
  wearWeapons,
} from './events';
import { neighbors8, tileAt } from './mapgen';
import type { Rng } from './rng';
import { statsOf } from './rules';
import { clamp, pushNotice } from './stateUtils';
import type { Bandit, Building, Flood, GameState, Guard, Point, Raid, Resources, Storm } from './types';

const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.z - b.z);
const lerp = (a: Point, b: Point, k: number): Point => ({ x: a.x + (b.x - a.x) * k, z: a.z + (b.z - a.z) * k });

/** Centre d'un bâtiment en coordonnées de cases (continues) */
export function buildingCenter(b: Building): Point {
  const s = BUILDING_BY_ID[b.type].size;
  return { x: b.x + s / 2, z: b.z + s / 2 };
}

function addTo(target: Partial<Resources>, add: Partial<Resources>) {
  for (const k of RESOURCE_KEYS) if (add[k]) target[k] = (target[k] ?? 0) + add[k]!;
}

// ============================================================================
// BANDITS
// ============================================================================

export type BanditPhase = 'waiting' | 'run' | 'steal' | 'flee' | 'caught' | 'escaped';

/** Position et phase d'un bandit au temps t */
export function banditAt(b: Bandit, t: number): { p: Point; phase: BanditPhase } {
  const at = b.status !== 'active' && b.endT !== undefined ? Math.min(t, b.endT) : t;
  let p: Point;
  let phase: BanditPhase;
  if (at < b.startT) {
    p = b.from;
    phase = 'waiting';
  } else if (at < b.arriveT) {
    p = lerp(b.from, b.target, (at - b.startT) / (b.arriveT - b.startT));
    phase = 'run';
  } else if (at < b.stealEndT) {
    p = b.target;
    phase = 'steal';
  } else {
    p = lerp(b.target, b.exit, clamp((at - b.stealEndT) / Math.max(1e-6, b.escapeT - b.stealEndT), 0, 1));
    phase = 'flee';
  }
  if (b.status === 'caught') phase = 'caught';
  if (b.status === 'escaped') phase = 'escaped';
  return { p, phase };
}

/** Position d'un garde au temps t (aller vers le point d'interception, puis retour) */
export function guardAt(g: Guard, t: number): Point {
  if (t <= g.startT) return g.from;
  if (t < g.meetT) return lerp(g.from, g.meet, (t - g.startT) / (g.meetT - g.startT));
  return lerp(g.meet, g.from, clamp((t - g.meetT) / Math.max(1e-6, g.backT - g.meetT), 0, 1));
}

export function banditSpeed(sev: number): number {
  return TUNING.raid.speed + TUNING.raid.speedPerSeverity * Math.max(0, sev - 1);
}

/** Ressources visées selon la cible */
function lootKeys(target: Building | undefined): (keyof Resources)[] {
  switch (target?.type) {
    case 'granary':
      return ['food', 'flour', 'bread'];
    case 'market':
      return ['gold'];
    case 'house':
    case 'townhouse':
    case 'manor':
    case 'hut':
      return ['gold', 'tools', 'weapons', 'bread'];
    case undefined:
      return ['food', 'wood', 'stone', 'gold'];
    default:
      return ['wood', 'stone', 'planks'];
  }
}

/** Cibles possibles : entrepôts (greniers), marchés, maison la plus riche, château */
function pickTargets(state: GameState): { b?: Building; w: number }[] {
  const out: { b?: Building; w: number }[] = [];
  for (const b of state.buildings) {
    if (b.type === 'granary') out.push({ b, w: 3 });
    if (b.type === 'market') out.push({ b, w: 3 });
  }
  const houses = state.buildings.filter((b) => statsOf(b).housing && b.type !== 'castle');
  const richest = houses.sort((a, c) => (statsOf(c).housing ?? 0) - (statsOf(a).housing ?? 0))[0];
  if (richest) out.push({ b: richest, w: 2 });
  out.push({ w: 1.5 });
  return out;
}

/** Point d'apparition sur un bord (hors de la carte, à spawnDistance) */
function edgePoint(state: GameState, edge: number, along: number, out: number): Point {
  const { width: w, height: h } = state.map;
  return [
    { x: along * w, z: -out },
    { x: w + out, z: along * h },
    { x: along * w, z: h + out },
    { x: -out, z: along * h },
  ][((edge % 4) + 4) % 4];
}

/** Lance une attaque : la bande apparaît hors de la carte et court vers ses cibles */
export function startRaid(state: GameState, count: number, edge: number, now: number, rng: Rng): Raid {
  const R = TUNING.raid;
  const sev = severity(state.day);
  const v = banditSpeed(sev);
  const castle = state.buildings.find((b) => b.type === 'castle');
  const castlePoint = castle ? buildingCenter(castle) : { x: state.map.width / 2, z: state.map.height / 2 };
  const targets = pickTargets(state);
  const center = rng.range(0.25, 0.75);
  const bandits: Bandit[] = [];
  for (let i = 0; i < Math.min(count, 40); i++) {
    const along = clamp(center + rng.range(-0.08, 0.08), 0.05, 0.95);
    const from = edgePoint(state, edge, along, R.spawnDistance + rng.range(0, 0.6));
    const exit = edgePoint(state, edge, clamp(along + rng.range(-0.15, 0.15), 0.05, 0.95), R.spawnDistance);
    const pick = rng.weighted(targets, (t) => t.w)!;
    const base = pick.b ? buildingCenter(pick.b) : castlePoint;
    const target = { x: base.x + rng.range(-0.35, 0.35), z: base.z + rng.range(-0.35, 0.35) };
    const startT = now + i * R.stagger;
    const arriveT = startT + dist(from, target) / v;
    const stealEndT = arriveT + R.stealTime;
    bandits.push({
      id: i,
      from,
      target,
      exit,
      targetId: pick.b?.id ?? -1,
      startT,
      arriveT,
      stealEndT,
      escapeT: stealEndT + dist(target, exit) / v,
      loot: {},
      looted: false,
      status: 'active',
    });
  }
  const raid: Raid = {
    bandits,
    guards: [],
    nextGuardId: 1,
    nextCheckT: now,
    report: { caught: 0, escaped: 0, lost: {}, recovered: {}, reward: 0, injured: 0 },
  };
  state.raid = raid;
  return raid;
}

/** Gardes libres d'une tour (tour en service, pas en feu) */
function freeGuards(state: GameState, tower: Building, t: number): number {
  if (tower.workers <= 0 || tower.fire) return 0;
  const cap = tower.level * TUNING.raid.guardsPerTowerLevel;
  const busy = state.raid?.guards.filter((g) => g.towerId === tower.id && !g.done && g.backT > t).length ?? 0;
  return cap - busy;
}

/** Premier instant où un poursuivant parti de `from` au temps t rattrape le bandit (ou null) */
function intercept(b: Bandit, from: Point, speed: number, t: number): { meet: Point; meetT: number } | null {
  const step = 0.003;
  for (let tau = t; tau <= b.escapeT; tau += step) {
    const p = banditAt(b, tau).p;
    if (dist(from, p) <= speed * (tau - t) + 0.25) return { meet: p, meetT: tau };
  }
  return null;
}

export type DispatchResult = { ok: true; guard: Guard } | { ok: false; reason: string };

/**
 * Envoie un garde intercepter un bandit (mutation). Tour la plus rapide parmi celles qui ont un
 * garde libre ; sinon (sauf en automatique) des villageois partent du château.
 */
export function dispatchGuard(state: GameState, banditId: number, t: number, auto = false): DispatchResult {
  const raid = state.raid;
  const b = raid?.bandits.find((x) => x.id === banditId);
  if (!raid || !b || b.status !== 'active') return { ok: false, reason: 'Bandit introuvable' };
  if (b.chasedBy !== undefined) return { ok: false, reason: 'Déjà poursuivi' };
  if (t < b.startT) return { ok: false, reason: 'Pas encore arrivé' };
  const R = TUNING.raid;
  let best: { tower: Building | null; meet: Point; meetT: number; from: Point } | null = null;
  for (const tower of state.buildings.filter((x) => x.type === 'tower')) {
    if (freeGuards(state, tower, t) <= 0) continue;
    const from = buildingCenter(tower);
    const hit = intercept(b, from, R.guardSpeed, t);
    if (hit && (!best || hit.meetT < best.meetT)) best = { tower, from, ...hit };
  }
  if (!best && !auto) {
    const castle = state.buildings.find((x) => x.type === 'castle');
    if (castle && state.population > 1) {
      const from = buildingCenter(castle);
      const hit = intercept(b, from, R.villagerSpeed, t);
      if (hit) best = { tower: null, from, ...hit };
    }
  }
  if (!best) return { ok: false, reason: auto ? 'Aucun garde libre' : 'Trop loin : il va s\'échapper' };
  const speed = best.tower ? R.guardSpeed : R.villagerSpeed;
  const guard: Guard = {
    id: raid.nextGuardId++,
    banditId,
    villager: !best.tower,
    towerId: best.tower?.id ?? -1,
    from: best.from,
    meet: best.meet,
    startT: t,
    meetT: best.meetT,
    backT: best.meetT + dist(best.meet, best.from) / speed,
    done: false,
  };
  raid.guards.push(guard);
  b.chasedBy = guard.id;
  return { ok: true, guard };
}

function steal(state: GameState, b: Bandit) {
  const R = TUNING.raid;
  const target = state.buildings.find((x) => x.id === b.targetId);
  for (const k of lootKeys(target)) {
    const amount = Math.min(R.maxStealPerBandit, Math.floor((state.resources[k] ?? 0) * R.stealPerBandit));
    if (amount <= 0) continue;
    state.resources[k] -= amount;
    b.loot[k] = (b.loot[k] ?? 0) + amount;
  }
  b.looted = true;
}

function catchBandit(state: GameState, b: Bandit, g: Guard, at: number, rng: Rng) {
  const raid = state.raid!;
  b.status = 'caught';
  b.endT = at;
  // Butin rendu + petite récompense
  for (const k of RESOURCE_KEYS) state.resources[k] += b.loot[k] ?? 0;
  addTo(raid.report.recovered, b.loot);
  const reward = Math.round(TUNING.raid.rewardGold + TUNING.raid.rewardPerSeverity * (severity(state.day) - 1));
  state.resources.gold += reward;
  raid.report.reward += reward;
  raid.report.caught++;
  state.stats.banditsKilled++;
  if (g.villager && rng.chance(TUNING.raid.injuryChance)) {
    state.injuries.push({ count: 1, untilDay: state.day + TUNING.raid.injuryDays });
    raid.report.injured++;
  }
}

/** Fin de l'attaque : bilan, moral, carte rançon close */
function finishRaid(state: GameState) {
  const raid = state.raid!;
  const r = raid.report;
  const total = raid.bandits.length;
  const card = state.notices.find((n) => n.id === raid.noticeId);
  if (card?.choice && !card.choice.resolved) {
    card.choice.resolved = true;
    card.choice.picked = 'none';
  }
  if (r.escaped === 0 && r.caught === total) addMorale(state, TUNING.morale.repelled);
  else addMorale(state, TUNING.morale.pillage * Math.min(1, r.escaped / 4));
  wearWeapons(state);
  const parts = [
    `${r.caught}/${total} ${r.caught > 1 ? 'attrapés' : 'attrapé'}`,
    r.escaped ? `${r.escaped} en fuite avec ${formatResources(r.lost)}` : '',
    r.reward ? `récompense +${r.reward} 🪙` : '',
    r.injured ? `${r.injured} villageois ${r.injured > 1 ? 'blessés' : 'blessé'}` : '',
  ].filter(Boolean);
  pushNotice(state, {
    kind: r.escaped === 0 ? 'good' : 'bad',
    icon: r.escaped === 0 ? '🛡️' : '💰',
    title: r.escaped === 0 ? 'Bandits arrêtés' : 'Les bandits se sont enfuis',
    text: `${parts.join(' · ')}.`,
  });
  state.raid = null;
}

function nextRaidEventTime(raid: Raid): number {
  let next = raid.nextCheckT;
  for (const b of raid.bandits) {
    if (b.status !== 'active') continue;
    next = Math.min(next, b.looted ? b.escapeT : b.stealEndT);
  }
  for (const g of raid.guards) {
    if (g.done) continue;
    const b = raid.bandits.find((x) => x.id === g.banditId);
    // Capture à venir tant que le bandit court encore, sinon seulement le retour du garde
    next = Math.min(next, b && b.status === 'active' && b.chasedBy === g.id ? g.meetT : g.backT);
  }
  return next;
}

/** Fait avancer l'attaque jusqu'au temps t (mutation) */
export function updateRaid(state: GameState, t: number, rng: Rng) {
  const raid = state.raid;
  if (!raid) return;
  // Événements dans l'ordre chronologique : vols, captures, fuites
  type Ev = { at: number; run: () => void };
  const evs: Ev[] = [];
  for (const b of raid.bandits) {
    if (b.status !== 'active') continue;
    if (!b.looted && b.stealEndT <= t) evs.push({ at: b.stealEndT, run: () => b.status === 'active' && steal(state, b) });
    if (b.escapeT <= t)
      evs.push({
        at: b.escapeT + 1e-6,
        run: () => {
          if (b.status !== 'active') return;
          if (!b.looted) steal(state, b);
          b.status = 'escaped';
          b.endT = b.escapeT;
          raid.report.escaped++;
          addTo(raid.report.lost, b.loot);
        },
      });
  }
  for (const g of raid.guards) {
    if (g.done) continue;
    const b = raid.bandits.find((x) => x.id === g.banditId);
    if (g.meetT <= t && b && b.status === 'active' && b.chasedBy === g.id)
      evs.push({ at: g.meetT, run: () => b.status === 'active' && catchBandit(state, b, g, g.meetT, rng) });
  }
  evs.sort((a, b) => a.at - b.at).forEach((e) => e.run());
  for (const g of raid.guards) if (!g.done && g.backT <= t) g.done = true;

  // Gardes automatiques : un bandit à portée d'une tour avec un garde libre
  if (t >= raid.nextCheckT) {
    raid.nextCheckT = t + TUNING.raid.checkEvery;
    for (const b of raid.bandits) {
      if (b.status !== 'active' || b.chasedBy !== undefined || t < b.startT) continue;
      const p = banditAt(b, t).p;
      const near = state.buildings.some(
        (x) => x.type === 'tower' && freeGuards(state, x, t) > 0 && dist(buildingCenter(x), p) <= TUNING.raid.autoGuardRange,
      );
      if (near) dispatchGuard(state, b.id, t, true);
    }
  }

  if (raid.bandits.every((b) => b.status !== 'active') && raid.guards.every((g) => g.done || g.backT <= t)) finishRaid(state);
}

/** Option "rançon" : toute la bande fait demi-tour sans plus rien voler */
export function raidTurnBack(state: GameState, t: number) {
  const raid = state.raid;
  if (!raid) return;
  const v = banditSpeed(severity(state.day));
  for (const b of raid.bandits) {
    if (b.status !== 'active') continue;
    const p = banditAt(b, t).p;
    b.target = p;
    b.arriveT = Math.max(t, b.startT);
    b.stealEndT = b.arriveT;
    b.looted = true;
    b.escapeT = b.stealEndT + dist(p, b.exit) / v;
    // Marché conclu : les gardes en route rentrent sans capture
    b.chasedBy = undefined;
  }
}

// ============================================================================
// ORAGE
// ============================================================================

export function stormCenter(storm: Storm, t: number): Point {
  const k = Math.max(0, t - storm.startT) * storm.speed;
  return { x: storm.from.x + storm.dir.x * k, z: storm.from.z + storm.dir.z * k };
}

/** Un orage naît hors de la carte et la traverse en ligne droite */
export function startStorm(state: GameState, edge: number, now: number, rng: Rng): Storm {
  const S = TUNING.storm;
  const { width: w, height: h } = state.map;
  const base = [
    { x: 0, z: 1 },
    { x: -1, z: 0 },
    { x: 0, z: -1 },
    { x: 1, z: 0 },
  ][((edge % 4) + 4) % 4];
  const a = rng.range(-0.5, 0.5);
  const dir = { x: base.x * Math.cos(a) - base.z * Math.sin(a), z: base.x * Math.sin(a) + base.z * Math.cos(a) };
  const half = 0.5 * (Math.abs(dir.x) * w + Math.abs(dir.z) * h);
  // Le nuage se forme au bord (son ombre mord un peu sur la carte), puis traverse après warningTime
  const back = half + S.radius * 0.6;
  const center = { x: w / 2 + rng.range(-w * 0.2, w * 0.2), z: h / 2 + rng.range(-h * 0.2, h * 0.2) };
  const from = { x: center.x - dir.x * back, z: center.z - dir.z * back };
  const moveT = now + S.warningTime;
  const storm: Storm = {
    startT: moveT,
    from,
    dir,
    speed: S.speed,
    radius: S.radius,
    arriveT: moveT,
    endT: moveT + (2 * back) / S.speed,
    rolled: [],
    nextCheckT: now,
    nextLightningT: moveT + rng.range(S.lightningEvery[0], S.lightningEvery[1]),
    strikes: [],
    hits: [],
    shelter: false,
    cropsProtected: false,
  };
  state.storm = storm;
  return storm;
}

function clearReinforcements(state: GameState) {
  if (state.storm || (state.flood && !state.flood.resolved)) return;
  for (const b of state.buildings) delete b.reinforced;
}

export function updateStorm(state: GameState, t: number, rng: Rng) {
  const storm = state.storm;
  if (!storm) return;
  const S = TUNING.storm;
  const sev = severity(state.day);
  const hits = storm.hits;
  while (storm.nextCheckT <= Math.min(t, storm.endT)) {
    const at = storm.nextCheckT;
    storm.nextCheckT += S.checkEvery;
    const c = stormCenter(storm, at);
    // Pendant qu'il se forme au bord, le nuage ne fait pas encore de dégâts
    if (at < storm.startT) continue;
    for (const b of playerBuildings(state)) {
      if (storm.rolled.includes(b.id) || dist(buildingCenter(b), c) > storm.radius) continue;
      storm.rolled.push(b.id);
      if (b.reinforced || (b.type === 'field' && storm.cropsProtected)) continue;
      if (rng.chance(S.hitChance + S.hitPerSeverity * Math.max(0, sev - 1))) {
        hits.push(damageBuilding(state, b));
        if (!storm.shelter && statsOf(b).housing && rng.chance(S.injureChance)) {
          state.injuries.push({ count: 1, untilDay: state.day + TUNING.raid.injuryDays });
          hits.push('1 villageois blessé');
        }
      }
    }
    // Éclairs sous le nuage
    if (at >= storm.nextLightningT) {
      storm.nextLightningT = at + rng.range(S.lightningEvery[0], S.lightningEvery[1]);
      const under = state.buildings.filter((b) => dist(buildingCenter(b), c) <= storm.radius && b.type !== 'castle');
      const target = under.length && rng.chance(0.6) ? rng.pick(under) : null;
      const p = target ? buildingCenter(target) : { x: c.x + rng.range(-1, 1) * storm.radius * 0.7, z: c.z + rng.range(-1, 1) * storm.radius * 0.7 };
      storm.strikes = [...storm.strikes.filter((s) => at - s.t < 0.05).slice(-4), { x: p.x, z: p.z, t: at }];
      if (target && !target.fire && rng.chance(S.lightningFireChance * (target.reinforced ? 0.3 : 1))) {
        startFire(state, target, at);
        hits.push(`la foudre enflamme : ${BUILDING_BY_ID[target.type].name}`);
      }
    }
  }
  if (t >= storm.endT) {
    pushNotice(state, {
      kind: hits.length ? 'bad' : 'good',
      icon: '⛈️',
      title: 'L\'orage est passé',
      text: hits.length ? `${hits.join(', ')}.` : 'Aucun dégât : bien joué !',
    });
    state.storm = null;
    clearReinforcements(state);
  }
}

// ============================================================================
// CRUE
// ============================================================================

/** Bâtiments au bord de l'eau */
export function riversideBuildings(state: GameState): Building[] {
  return playerBuildings(state).filter((b) => neighbors8(b.x, b.z).some(([x, z]) => tileAt(state.map, x, z) === 'water'));
}

export function startFlood(state: GameState, now: number, isProtected: boolean): Flood {
  const F = TUNING.flood;
  const flood: Flood = {
    startT: now,
    peakT: now + F.riseTime,
    endT: now + F.riseTime + F.holdTime + F.recedeTime,
    protected: isProtected,
    threatened: riversideBuildings(state).map((b) => b.id),
    resolved: false,
  };
  state.flood = flood;
  return flood;
}

/** Niveau de l'eau (0 → 1 au pic → 0), pour l'affichage */
export function floodLevel(f: Flood, t: number): number {
  if (t <= f.startT || t >= f.endT) return 0;
  if (t < f.peakT) return (t - f.startT) / (f.peakT - f.startT);
  const hold = f.peakT + TUNING.flood.holdTime;
  if (t < hold) return 1;
  return 1 - (t - hold) / (f.endT - hold);
}

export function updateFlood(state: GameState, t: number) {
  const f = state.flood;
  if (!f) return;
  if (!f.resolved && t >= f.peakT) {
    f.resolved = true;
    const lost: string[] = [];
    if (!f.protected) {
      for (const id of f.threatened) {
        const b = state.buildings.find((x) => x.id === id);
        if (!b || b.reinforced) continue;
        if (b.type === 'field') {
          state.buildings = state.buildings.filter((x) => x.id !== b.id);
          addMorale(state, TUNING.morale.buildingLost / 2);
          lost.push('Champ détruit');
        } else lost.push(damageBuilding(state, b));
      }
    }
    pushNotice(state, {
      kind: lost.length ? 'bad' : 'good',
      icon: '🌊',
      title: 'La crue est au plus haut',
      text: f.protected ? 'Les berges tiennent bon !' : lost.length ? `${lost.join(', ')}.` : 'Les sacs de sable ont tout protégé !',
    });
    clearReinforcements(state);
  }
  if (t >= f.endT) {
    state.flood = null;
    clearReinforcements(state);
  }
}

/** Prochaine échéance d'un événement en temps réel (pour éviter les mises à jour inutiles) */
export function realtimeDue(state: GameState, t: number): boolean {
  if (state.raid && t >= nextRaidEventTime(state.raid)) return true;
  if (state.storm && (t >= state.storm.nextCheckT || t >= state.storm.endT)) return true;
  if (state.flood && ((!state.flood.resolved && t >= state.flood.peakT) || t >= state.flood.endT)) return true;
  return false;
}

export function updateRealtime(state: GameState, t: number, rng: Rng) {
  updateRaid(state, t, rng);
  updateStorm(state, t, rng);
  updateFlood(state, t);
}
