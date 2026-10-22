// Simulation : création de partie, construction, passage d'un jour, échanges.
// Toutes les fonctions renvoient un NOUVEL état (l'état reçu n'est jamais modifié).

import { BUILDING_BY_ID, buildCost, maxLevel, unlockKey } from './buildings';
import {
  DAYS_PER_SEASON,
  FIRST_EVENT_DAY,
  RESOURCE_KEYS,
  SAVE_VERSION,
  START_POPULATION,
  START_RESOURCES,
  difficulty,
  seasonOf,
} from './config';
import { nextEventDelay, pickEvent } from './events';
import { generateMap } from './mapgen';
import { Rng } from './rng';
import {
  assignWorkers,
  canAfford,
  canPlace,
  canUpgrade,
  computeProduction,
  findNewUnlocks,
  foodConsumption,
  housingCapacity,
} from './rules';
import type { BuildingTypeId, GameState, Notice } from './types';

const MAX_NOTICES = 40;

/** Copie profonde de l'état, en partageant la carte (immuable) */
function cloneState(state: GameState): GameState {
  const { map, ...rest } = state;
  return { ...structuredClone(rest), map };
}

function pushNotice(state: GameState, notice: Omit<Notice, 'id' | 'day'>) {
  state.notices.push({ ...notice, id: state.nextNoticeId++, day: state.day });
  if (state.notices.length > MAX_NOTICES) state.notices.splice(0, state.notices.length - MAX_NOTICES);
}

export function createInitialState(seed: number): GameState {
  const { map, castle, mill } = generateMap(seed);
  const state: GameState = {
    version: SAVE_VERSION,
    seed,
    rngState: (seed * 7919 + 12345) >>> 0,
    map,
    resources: { ...START_RESOURCES },
    population: START_POPULATION,
    buildings: [
      { id: 1, type: 'castle', x: castle.x, z: castle.z, level: 1, workers: 0, builtDay: 0 },
      { id: 2, type: 'mill', x: mill.x, z: mill.z, level: 1, workers: 0, builtDay: 0 },
    ],
    nextBuildingId: 3,
    day: 1,
    dayProgress: 0,
    modifiers: [],
    notices: [],
    nextNoticeId: 1,
    nextEventDay: FIRST_EVENT_DAY + 1,
    unlocked: [],
    stats: { maxPopulation: START_POPULATION, buildingsBuilt: 0, upgrades: 0, eventsSurvived: 0 },
    gameOver: false,
  };
  pushNotice(state, {
    kind: 'info',
    icon: '🏰',
    title: 'Un nouveau départ',
    text: 'Trois villageois s\'installent au pied du château. Construisez un champ avant l\'hiver !',
  });
  applyUnlocks(state, false);
  return state;
}

/**
 * Enregistre les nouveaux déblocages (mutation). Une notification groupée est émise
 * pour les nouveaux bâtiments et une autre pour les nouvelles améliorations.
 */
export function applyUnlocks(state: GameState, notify: boolean): void {
  const found = findNewUnlocks(state);
  if (!found.length) return;
  for (const u of found) state.unlocked.push(unlockKey(u.type, u.level));
  if (!notify) return;
  const builds = found.filter((u) => u.level === 1);
  const upgrades = found.filter((u) => u.level > 1);
  if (builds.length) {
    pushNotice(state, {
      kind: 'good',
      icon: '🔓',
      title: builds.length > 1 ? 'Nouveaux bâtiments' : 'Nouveau bâtiment',
      text: `Vous pouvez maintenant construire : ${builds.map((u) => `${BUILDING_BY_ID[u.type].icon} ${BUILDING_BY_ID[u.type].name}`).join(', ')}.`,
    });
  }
  for (const level of [...new Set(upgrades.map((u) => u.level))]) {
    const names = upgrades.filter((u) => u.level === level).map((u) => BUILDING_BY_ID[u.type].name);
    pushNotice(state, {
      kind: 'good',
      icon: '⬆️',
      title: `Améliorations niveau ${level}`,
      text: `Débloqué pour : ${names.join(', ')}. Cliquez sur un bâtiment pour l'améliorer.`,
    });
  }
}

export function placeBuilding(state: GameState, type: BuildingTypeId, x: number, z: number): GameState | null {
  if (state.gameOver || !BUILDING_BY_ID[type].buildable) return null;
  if (!canPlace(state, type, x, z).ok) return null;
  const s = cloneState(state);
  const cost = buildCost(type);
  for (const k of RESOURCE_KEYS) s.resources[k] -= cost[k] ?? 0;
  s.buildings.push({ id: s.nextBuildingId++, type, x, z, level: 1, workers: 0, builtDay: s.day });
  s.stats.buildingsBuilt++;
  assignWorkers(s);
  applyUnlocks(s, true);
  return s;
}

export function upgradeBuilding(state: GameState, buildingId: number): GameState | null {
  const b = state.buildings.find((x) => x.id === buildingId);
  if (state.gameOver || !b || b.level >= maxLevel(b.type)) return null;
  const check = canUpgrade(state, b);
  if (!check.ok || !check.next) return null;
  const s = cloneState(state);
  for (const k of RESOURCE_KEYS) s.resources[k] -= check.next.cost[k] ?? 0;
  s.buildings.find((x) => x.id === buildingId)!.level++;
  s.stats.upgrades++;
  assignWorkers(s);
  return s;
}

/** Fait passer un jour complet : production, repas, population, événements */
export function advanceDay(state: GameState): GameState {
  if (state.gameOver) return state;
  const s = cloneState(state);
  const rng = new Rng(s.rngState);

  // 1. Production de la journée écoulée
  assignWorkers(s);
  const prod = computeProduction(s);
  for (const k of RESOURCE_KEYS) s.resources[k] += prod[k];

  // 2. Repas
  s.resources.food -= foodConsumption(s);
  if (s.resources.food < 0) {
    const deficit = -s.resources.food;
    // Départs proportionnels au manque, mais au plus ~20 % de la population par jour
    const leaving = Math.min(s.population, Math.max(1, Math.ceil(deficit / 3)), Math.max(1, Math.ceil(s.population * 0.2)));
    s.population -= leaving;
    s.resources.food = 0;
    pushNotice(s, {
      kind: 'bad',
      icon: '🍽️',
      title: 'Famine',
      text: `Faute de nourriture, ${leaving} villageois ${leaving > 1 ? 'quittent' : 'quitte'} le village.`,
    });
  } else {
    // 3. Croissance : place libre + nourriture suffisante
    const free = housingCapacity(s) - s.population;
    if (free > 0 && s.resources.food >= s.population * 2 + 4) {
      const arrivals = free > 1 && s.resources.food >= s.population * 5 ? 2 : 1;
      s.population += arrivals;
      pushNotice(s, {
        kind: 'info',
        icon: '👋',
        title: arrivals > 1 ? 'Nouveaux villageois' : 'Nouveau villageois',
        text: `${arrivals} ${arrivals > 1 ? 'personnes rejoignent' : 'personne rejoint'} le village, attirée${arrivals > 1 ? 's' : ''} par vos réserves.`,
      });
    }
  }

  // 4. Jour suivant
  s.day++;
  s.dayProgress = 0;
  s.modifiers = s.modifiers.filter((m) => m.untilDay >= s.day);
  for (const n of s.notices) {
    if (n.trade && !n.trade.resolved && n.trade.expiresDay < s.day) n.trade.resolved = true;
  }
  if ((s.day - 1) % DAYS_PER_SEASON === 0) {
    const season = seasonOf(s.day);
    pushNotice(s, {
      kind: 'info',
      icon: season.icon,
      title: season.name,
      text: season.id === 'winter' ? 'L\'hiver arrive : les champs ne produisent plus.' : `Début de la saison : ${season.name.toLowerCase()}.`,
    });
  }

  // 5. Événement aléatoire
  if (s.day >= s.nextEventDay && s.population > 0) {
    const ev = pickEvent(s, rng);
    if (ev) {
      const outcome = ev.apply({ state: s, rng, severity: difficulty(s.day) });
      pushNotice(s, {
        kind: ev.kind,
        icon: ev.icon,
        title: ev.title,
        text: outcome.text,
        trade: outcome.trade ? { options: outcome.trade, expiresDay: s.day + 1, resolved: false } : undefined,
      });
      if (ev.kind === 'bad') s.stats.eventsSurvived++;
    }
    s.nextEventDay = s.day + nextEventDelay(s.day, rng);
  }

  // 6. Arrondis, travailleurs, déblocages, fin de partie
  for (const k of RESOURCE_KEYS) s.resources[k] = Math.max(0, Math.round(s.resources[k] * 10) / 10);
  assignWorkers(s);
  if (s.population > 0) applyUnlocks(s, true);
  s.stats.maxPopulation = Math.max(s.stats.maxPopulation, s.population);
  if (s.population <= 0) {
    s.population = 0;
    s.gameOver = true;
  }
  s.rngState = rng.state;
  return s;
}

export function resolveTrade(state: GameState, noticeId: number, optionIndex: number | null): GameState {
  const notice = state.notices.find((n) => n.id === noticeId);
  if (!notice?.trade || notice.trade.resolved) return state;
  const s = cloneState(state);
  const n = s.notices.find((x) => x.id === noticeId)!;
  if (optionIndex !== null) {
    const opt = n.trade!.options[optionIndex];
    if (!opt || !canAfford(s.resources, opt.give)) return state;
    for (const k of RESOURCE_KEYS) {
      s.resources[k] += (opt.get[k] ?? 0) - (opt.give[k] ?? 0);
    }
  }
  n.trade!.resolved = true;
  return s;
}

