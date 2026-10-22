// Simulation : création de partie, construction, passage d'un jour, échanges.
// Toutes les fonctions renvoient un NOUVEL état (l'état reçu n'est jamais modifié).

import { BUILDING_BY_ID } from './buildings';
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
  computeProduction,
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
      { id: 1, type: 'castle', x: castle.x, z: castle.z, workers: 0, builtDay: 0 },
      { id: 2, type: 'mill', x: mill.x, z: mill.z, workers: 0, builtDay: 0 },
    ],
    nextBuildingId: 3,
    day: 1,
    dayProgress: 0,
    modifiers: [],
    notices: [],
    nextNoticeId: 1,
    nextEventDay: FIRST_EVENT_DAY + 1,
    stats: { maxPopulation: START_POPULATION, buildingsBuilt: 0, eventsSurvived: 0 },
    gameOver: false,
  };
  pushNotice(state, {
    kind: 'info',
    icon: '🏰',
    title: 'Un nouveau départ',
    text: 'Trois villageois s\'installent au pied du château. Construisez un champ avant l\'hiver !',
  });
  return state;
}

export function placeBuilding(state: GameState, type: BuildingTypeId, x: number, z: number): GameState | null {
  if (state.gameOver || !BUILDING_BY_ID[type].buildable) return null;
  if (!canPlace(state, type, x, z).ok) return null;
  const s = cloneState(state);
  const def = BUILDING_BY_ID[type];
  for (const k of RESOURCE_KEYS) s.resources[k] -= def.cost[k] ?? 0;
  s.buildings.push({ id: s.nextBuildingId++, type, x, z, workers: 0, builtDay: s.day });
  s.stats.buildingsBuilt++;
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

  // 6. Arrondis, travailleurs, fin de partie
  for (const k of RESOURCE_KEYS) s.resources[k] = Math.max(0, Math.round(s.resources[k] * 10) / 10);
  assignWorkers(s);
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

