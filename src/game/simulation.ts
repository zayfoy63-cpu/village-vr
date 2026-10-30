// Simulation : création de partie, temps qui passe, construction, choix, actions du joueur.
// Toutes les fonctions renvoient un NOUVEL état (l'état reçu n'est jamais modifié).

import { BUILDING_BY_ID, buildCost, maxLevel, unlockKey } from './buildings';
import {
  DAYS_PER_SEASON,
  MORALE,
  RESOURCE_KEYS,
  SAVE_VERSION,
  DEFAULT_DIFFICULTY,
  type DifficultyId,
  START_POPULATION,
  dayInSeason,
  seasonIndex,
  seasonOf,
  type SeasonId,
} from './config';
import {
  EVENTS,
  EVENT_BY_ID,
  TUNING,
  addMorale,
  applyChoice,
  formatResources,
  loseVillagers,
  arriveEvent,
  pickEvent,
  revolt,
  scheduleEvent,
  wearWeapons,
  severity,
  startEvent,
} from './events';
import { difficultyOf, inGrace, rampFactor } from './difficulty';
import { hazardsDue, updateHazards } from './hazards';
import { emptyMech, memo } from './mechanics/common';
import { mechanicsEndOfDay, mechanicsStartOfDay } from './mechanics';
import { generateMap } from './mapgen';
import {
  PARCELS,
  canBuyParcel,
  generateFeatures,
  ownsParcel,
  parcelContents,
  parcelPrice,
} from './parcels';
import { Rng } from './rng';
import {
  assignWorkers,
  canAfford,
  canPlace,
  canUpgrade,
  computeProduction,
  defensePower,
  findNewUnlocks,
  foodConsumption,
  foodReserve,
  mealPlan,
  statsOf,
  woodSafetyGain,
  housingCapacity,
  isUnlocked,
  repairCost,
} from './rules';
import { clamp, cloneState, gameTime, pushNotice } from './stateUtils';
import type { BuildingTypeId, GameState } from './types';
import { I } from '../ui/icons';

/** Une phrase d'ambiance par saison (aucun effet de jeu n'est dit) */
const SEASON_TEXT: Record<SeasonId, string> = {
  spring: 'La neige fond, la terre se réveille. Le ciel est souvent gris.',
  summer: 'Les journées sont longues et chaudes. L\'herbe jaunit au bord des chemins.',
  autumn: 'Les feuilles roussissent et les routes s\'animent.',
  winter: 'Le froid tombe sur la vallée. Les nuits s\'allongent.',
};

export function createInitialState(seed: number, difficulty: DifficultyId = DEFAULT_DIFFICULTY): GameState {
  const { map, castle, mill } = generateMap(seed);
  const state: GameState = {
    version: SAVE_VERSION,
    seed,
    difficulty,
    rngState: (seed * 7919 + 12345) >>> 0,
    map,
    resources: { ...difficultyOf({ difficulty }).start },
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
    unlocked: [],
    morale: MORALE.start,
    pending: [],
    nextPendingId: 1,
    raid: null,
    floodUntil: 0,
    storm: null,
    flood: null,
    injuries: [],
    mech: emptyMech(map.tiles.length),
    parcels: { owned: [...PARCELS.start], bought: 0 },
    features: generateFeatures(map, seed),
    discovered: ['food', 'wood', 'stone', 'gold'],
    stats: {
      maxPopulation: START_POPULATION,
      buildingsBuilt: 0,
      upgrades: 0,
      eventsSurvived: 0,
      banditsKilled: 0,
      firesPutOut: 0,
    },
    gameOver: false,
  };
  pushNotice(state, {
    kind: 'info',
    icon: I.castle,
    title: 'Un nouveau départ',
    text: 'Trois villageois s\'installent au pied du château. Construisez un champ avant l\'hiver, et surveillez le moral !',
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
      icon: I.unlock,
      title: builds.length > 1 ? 'Nouveaux bâtiments' : 'Nouveau bâtiment',
      text: `Vous pouvez maintenant construire : ${builds.map((u) => `${BUILDING_BY_ID[u.type].icon} ${BUILDING_BY_ID[u.type].name}`).join(', ')}.`,
    });
  }
  for (const level of [...new Set(upgrades.map((u) => u.level))]) {
    const names = upgrades.filter((u) => u.level === level).map((u) => BUILDING_BY_ID[u.type].name);
    pushNotice(state, {
      kind: 'good',
      icon: I.up,
      title: `Améliorations niveau ${level}`,
      text: `Débloqué pour : ${names.join(', ')}. Cliquez sur un bâtiment pour l'améliorer.`,
    });
  }
}

// ============================================================================
// ACTIONS DU JOUEUR
// ============================================================================

export function placeBuilding(state: GameState, type: BuildingTypeId, x: number, z: number): GameState | null {
  if (state.gameOver || !BUILDING_BY_ID[type].buildable) return null;
  if (!canPlace(state, type, x, z).ok) return null;
  const s = cloneState(state);
  const cost = buildCost(type);
  for (const k of RESOURCE_KEYS) s.resources[k] -= cost[k] ?? 0;
  s.buildings.push({ id: s.nextBuildingId++, type, x, z, level: 1, workers: 0, builtDay: s.day, placedT: gameTime(s) });
  s.stats.buildingsBuilt++;
  assignWorkers(s);
  applyUnlocks(s, true);
  updateDiscovered(s);
  return s;
}

export function upgradeBuilding(state: GameState, buildingId: number): GameState | null {
  const b = state.buildings.find((x) => x.id === buildingId);
  if (state.gameOver || !b || b.level >= maxLevel(b.type) || b.fire) return null;
  const check = canUpgrade(state, b);
  if (!check.ok || !check.next) return null;
  const s = cloneState(state);
  for (const k of RESOURCE_KEYS) s.resources[k] -= check.next.cost[k] ?? 0;
  s.buildings.find((x) => x.id === buildingId)!.level++;
  s.stats.upgrades++;
  assignWorkers(s);
  updateDiscovered(s);
  return s;
}

/** Met en pause / relance un bâtiment (ses travailleurs vont ailleurs) */
export function togglePause(state: GameState, buildingId: number): GameState | null {
  const b = state.buildings.find((x) => x.id === buildingId);
  if (state.gameOver || !b || !statsOf(b).workers) return null;
  const s = cloneState(state);
  const t = s.buildings.find((x) => x.id === buildingId)!;
  if (t.paused) delete t.paused;
  else t.paused = true;
  assignWorkers(s);
  return s;
}

export function repairBuilding(state: GameState, buildingId: number): GameState | null {
  const b = state.buildings.find((x) => x.id === buildingId);
  if (state.gameOver || !b?.damaged || b.fire) return null;
  const cost = repairCost(b);
  if (!canAfford(state.resources, cost)) return null;
  const s = cloneState(state);
  for (const k of RESOURCE_KEYS) s.resources[k] -= cost[k] ?? 0;
  delete s.buildings.find((x) => x.id === buildingId)!.damaged;
  return s;
}

/** Achète une parcelle voisine du territoire */
export function buyParcel(state: GameState, parcelId: number): GameState | null {
  if (state.gameOver || !canBuyParcel(state, parcelId).ok) return null;
  const s = cloneState(state);
  const price = parcelPrice(s);
  s.resources.gold -= price;
  s.parcels.owned.push(parcelId);
  s.parcels.bought++;
  const { counts, features } = parcelContents(s, parcelId);
  const found = [
    counts.forest ? `${counts.forest} ${I.tree}` : '',
    counts.rock ? `${counts.rock} ${I.stone}` : '',
    counts.fertile ? `${counts.fertile} ${I.flower}` : '',
    counts.water ? 'rivière' : '',
  ].filter(Boolean);
  const camp = features.find((f) => f.type === 'camp');
  const ruins = features.find((f) => f.type === 'ruins');
  pushNotice(s, {
    kind: camp ? 'bad' : 'good',
    icon: I.map,
    title: 'Nouvelle parcelle',
    text:
      `Terres acquises pour ${price} ${I.gold}${found.length ? ` : ${found.join(', ')}` : ''}.` +
      (camp ? ` ${I.warning} Un camp de bandits s'y cache : détruisez-le, sinon les attaques se multiplieront !` : '') +
      (ruins ? ' Des ruines y cachent peut-être un trésor : cliquez dessus pour les déblayer.' : ''),
  });
  return s;
}

/** Déblaie des ruines (parcelle possédée) : coûte du bois, rapporte un trésor, risque d'éboulement */
export function clearRuins(state: GameState, featureId: number): GameState | null {
  const f = state.features.find((x) => x.id === featureId);
  if (state.gameOver || !f || f.cleared || f.type !== 'ruins' || !ownsParcel(state, f.parcel)) return null;
  if (!canAfford(state.resources, PARCELS.ruins.clearCost)) return null;
  const s = cloneState(state);
  const rng = new Rng(s.rngState);
  const feature = s.features.find((x) => x.id === featureId)!;
  for (const k of RESOURCE_KEYS) s.resources[k] += (feature.loot[k] ?? 0) - (PARCELS.ruins.clearCost[k] ?? 0);
  feature.cleared = true;
  const collapse = rng.chance(PARCELS.ruins.collapseChance) ? loseVillagers(s, 1, 1) : 0;
  pushNotice(s, {
    kind: collapse ? 'bad' : 'good',
    icon: I.manor,
    title: 'Ruines déblayées',
    text: `Trésor : ${formatResources(feature.loot)}.${collapse ? ' Un éboulement a coûté la vie à un villageois.' : ''}`,
  });
  s.rngState = rng.state;
  finalize(s);
  return s;
}

/** Force contre laquelle il faut se battre pour détruire un camp (augmente avec les saisons) */
export function campStrength(state: GameState, strength: number): number {
  return Math.round(strength * severity(state) * 0.6);
}

/** Attaque un camp de bandits (parcelle possédée) : victoire = butin, défaite = pertes */
export function attackCamp(state: GameState, featureId: number): GameState | null {
  const f = state.features.find((x) => x.id === featureId);
  if (state.gameOver || !f || f.cleared || f.type !== 'camp' || !ownsParcel(state, f.parcel)) return null;
  const s = cloneState(state);
  const rng = new Rng(s.rngState);
  const feature = s.features.find((x) => x.id === featureId)!;
  const enemy = campStrength(s, feature.strength);
  const power = defensePower(s) * 2 + Math.min(s.population, 40) * 0.15;
  wearWeapons(s);
  const roll = rng.range(0.7, 1.25);
  if (power * roll >= enemy) {
    feature.cleared = true;
    for (const k of RESOURCE_KEYS) s.resources[k] += feature.loot[k] ?? 0;
    const lost = loseVillagers(s, rng.chance(0.35) ? 1 : 0, 1);
    addMorale(s, TUNING.morale.fightWon);
    s.stats.banditsKilled += enemy;
    pushNotice(s, {
      kind: 'good',
      icon: I.camp,
      title: 'Camp détruit',
      text: `Le camp est rasé ! Butin : ${formatResources(feature.loot)}${lost ? ', 1 villageois tombé' : ''}.`,
    });
  } else {
    const lost = loseVillagers(s, Math.max(1, Math.round((enemy - power * roll) * 0.4)), 1);
    addMorale(s, TUNING.morale.fightLost);
    pushNotice(s, {
      kind: 'bad',
      icon: I.camp,
      title: 'Attaque repoussée',
      text: `Les bandits tiennent bon : ${lost} ${lost > 1 ? 'morts' : 'mort'}. Renforcez votre défense (tours) avant de réessayer.`,
    });
  }
  s.rngState = rng.state;
  finalize(s);
  return s;
}

/** Répond à une carte à choix */
export function resolveChoice(state: GameState, noticeId: number, optionId: string): GameState {
  const n = state.notices.find((x) => x.id === noticeId);
  if (!n?.choice || n.choice.resolved || state.gameOver) return state;
  const s = cloneState(state);
  const rng = new Rng(s.rngState);
  const ok = applyChoice(s, s.notices.find((x) => x.id === noticeId)!, optionId, rng, gameTime(s));
  if (!ok) return state;
  s.rngState = rng.state;
  finalize(s);
  return s;
}

// ============================================================================
// TEMPS
// ============================================================================

/**
 * Fait avancer le temps de `dt` jours (fraction). Gère les dangers en temps réel
 * (incendies, bandits, délais de choix) et le passage au jour suivant.
 */
export function advanceTime(state: GameState, dt: number): GameState {
  if (state.gameOver || dt <= 0) return state;
  const progress = state.dayProgress + dt;
  if (progress < 1) {
    const s = { ...state, dayProgress: progress };
    const t = s.day + progress;
    return hazardsDue(s, t) ? updateHazards(s, t) : s;
  }
  let s: GameState = { ...state, dayProgress: 1 };
  s = updateHazards(s, s.day + 1);
  return s.gameOver ? s : advanceDay(s);
}

/** Moral : dérive quotidienne vers une cible, puis conséquences d'un moral bas */
function updateMorale(s: GameState, hungry: boolean, rng: Rng) {
  const M = MORALE;
  const capacity = housingCapacity(s);
  const markets = s.buildings.filter((b) => b.type === 'market' && b.workers > 0 && !b.damaged).length;
  const towers = s.buildings.filter((b) => b.type === 'tower' && b.workers > 0).length;
  const damaged = s.buildings.filter((b) => b.damaged).length;
  let target = M.base;
  if (foodReserve(s.resources) >= foodConsumption(s) * 3) target += M.fedBonus;
  target -= Math.min(20, Math.max(0, s.population - capacity) * M.overcrowdPenalty);
  target += Math.min(15, markets * M.marketBonus);
  target += Math.min(6, towers * M.towerBonus);
  target -= Math.min(15, damaged * M.damagedPenalty);
  if (hungry) target -= M.hungerPenalty;
  s.morale = clamp(s.morale + (target - s.morale) * M.drift - (hungry ? 10 : 0), 0, 100);

  if (s.population <= 0) return;
  if (s.morale < M.revoltBelow) {
    pushNotice(s, { kind: 'bad', icon: I.fire, title: 'Révolte !', text: revolt(s, rng) });
  } else if (s.morale < M.leaveBelow) {
    const n = Math.min(s.population, Math.max(1, Math.ceil(s.population * M.leaveRatio)));
    s.population -= n;
    pushNotice(s, {
      kind: 'bad',
      icon: I.angry,
      title: 'Mécontentement',
      text: `Le moral est au plus bas : ${n} ${n > 1 ? 'villageois quittent' : 'villageois quitte'} le village.`,
    });
  }
}

/** Ressources découvertes : en stock ou produites / consommées par un bâtiment existant */
function updateDiscovered(s: GameState) {
  const found = new Set(s.discovered);
  for (const k of RESOURCE_KEYS) if (s.resources[k] > 0) found.add(k);
  for (const b of s.buildings) {
    // Un bâtiment encore verrouillé (ex. le moulin de départ) ne fait rien découvrir
    if (!isUnlocked(s, b.type, b.level)) continue;
    const lvl = statsOf(b);
    for (const k of RESOURCE_KEYS) if (lvl.produces?.[k] || lvl.consumes?.[k]) found.add(k);
  }
  if (found.size !== s.discovered.length) s.discovered = RESOURCE_KEYS.filter((k) => found.has(k));
}

function finalize(s: GameState) {
  for (const k of RESOURCE_KEYS) s.resources[k] = Math.max(0, Math.round(s.resources[k] * 10) / 10);
  updateDiscovered(s);
  assignWorkers(s);
  if (s.population > 0) applyUnlocks(s, true);
  s.stats.maxPopulation = Math.max(s.stats.maxPopulation, s.population);
  if (s.population <= 0) {
    s.population = 0;
    s.gameOver = true;
  }
}

/** Fait passer un jour complet : production, repas, moral, annonces, événements */
export function advanceDay(state: GameState): GameState {
  if (state.gameOver) return state;
  const s = cloneState(state);
  const rng = new Rng(s.rngState);

  // 1. Production de la journée écoulée (producteurs, puis transformateurs, usure des outils)
  assignWorkers(s);
  const prod = computeProduction(s);
  for (const k of RESOURCE_KEYS) s.resources[k] = Math.max(0, s.resources[k] + prod[k]);
  // Filet de sécurité : plus aucun moyen d'obtenir du bois, les villageois sans travail en ramassent
  if (woodSafetyGain(s) > 0) {
    if (!memo(s, 'woodNet')) {
      pushNotice(s, {
        kind: 'info',
        icon: I.wood,
        title: 'Bois mort',
        text: "Faute de bûcherons, les villageois sans travail ramassent le bois mort. C'est lent, mais de quoi rebâtir viendra.",
      });
    }
    memo(s, 'woodNet', 1);
  } else {
    memo(s, 'woodNet', 0);
  }

  // 2. Repas : pain (3 rations), farine, puis blé
  const meal = mealPlan(s, s.resources);
  for (const k of RESOURCE_KEYS) s.resources[k] -= meal.eaten[k];
  const hungry = meal.missing > 0.01;
  if (hungry) {
    const deficit = meal.missing;
    // Départs proportionnels au manque, mais au plus ~20 % de la population par jour
    const leaving = Math.min(s.population, Math.max(1, Math.ceil(deficit / 3)), Math.max(1, Math.ceil(s.population * 0.2)));
    s.population -= leaving;
    pushNotice(s, {
      kind: 'bad',
      icon: I.plate,
      title: 'Famine',
      text: `Faute de nourriture, ${leaving} villageois ${leaving > 1 ? 'quittent' : 'quitte'} le village.`,
    });
  } else {
    // 3. Croissance : place libre, nourriture suffisante et moral correct
    const free = housingCapacity(s) - s.population;
    const reserve = foodReserve(s.resources);
    if (free > 0 && s.morale >= MORALE.growthMin && reserve >= s.population * 2 + 4) {
      const arrivals = free > 1 && reserve >= s.population * 5 ? 2 : 1;
      s.population += arrivals;
      pushNotice(s, {
        kind: 'info',
        icon: I.hand,
        title: arrivals > 1 ? 'Nouveaux villageois' : 'Nouveau villageois',
        text: `${arrivals} ${arrivals > 1 ? 'personnes rejoignent' : 'personne rejoint'} le village, attirée${arrivals > 1 ? 's' : ''} par vos réserves.`,
      });
    }
  }

  // 3 bis. Mécaniques cachées : sols, chauffage, rats, fièvre, forêt, mines…
  mechanicsEndOfDay(s, rng, s.day + 1);

  // 4. Moral du jour écoulé
  updateMorale(s, hungry, rng);

  // 5. Jour suivant
  s.day++;
  s.dayProgress = 0;
  const now = s.day;
  s.modifiers = s.modifiers.filter((m) => m.untilDay >= s.day);
  // Les blessés guérissent
  s.injuries = s.injuries.filter((i) => i.untilDay >= s.day);
  if ((s.day - 1) % DAYS_PER_SEASON === 0) {
    const season = seasonOf(s.day);
    // Aucun effet n'est annoncé : seulement l'ambiance
    pushNotice(s, { kind: 'info', icon: season.icon, title: season.name, text: SEASON_TEXT[season.id] });
  }

  if (s.population > 0) {
    // 6. Délais de choix expirés, puis arrivée des événements annoncés
    for (const n of s.notices) {
      if (n.choice && !n.choice.resolved && now >= n.choice.expiresT) applyChoice(s, n, n.choice.defaultId, rng, now, true);
    }
    for (const p of s.pending.filter((x) => x.arriveDay <= s.day)) arriveEvent(s, p.id, rng, now);

    // 7. Événements programmés : hiver rude (fin d'automne), grand événement de fin d'année
    const year = Math.floor((s.day - 1) / (DAYS_PER_SEASON * 4));
    const grace = inGrace(s);
    if (!grace && seasonOf(s.day).id === 'autumn' && dayInSeason(s.day) === DAYS_PER_SEASON - 2) {
      const hw = TUNING.harshWinter;
      if (rng.chance(hw.chance + hw.perYear * year)) scheduleEvent(s, EVENT_BY_ID.harshWinter, 3, {}, rng, now);
    }
    const ye = TUNING.yearEnd;
    if (!grace && (s.day + ye.announceDays) % ye.every === 0) {
      const major = rng.pick(EVENTS.filter((e) => e.major));
      const ctx = { state: s, rng, severity: 1 + TUNING.severityPerSeason * seasonIndex(s.day + ye.announceDays), now };
      scheduleEvent(s, major, ye.announceDays, major.roll?.(ctx) ?? {}, rng, now);
      s.stats.eventsSurvived++;
    }

    // 8. Imprévus aléatoires (de plus en plus fréquents, parfois superposés). Pendant la période de grâce,
    //    seuls des événements positifs ou neutres sont tirés (voir pickEvent) et jamais deux à la fois.
    if (s.day >= TUNING.firstEventDay) {
      const diff = difficultyOf(s);
      const season = seasonIndex(s.day);
      const d = TUNING.dailyChance;
      // Montée en puissance : les premiers jours après la grâce sont plus calmes
      const calm = 0.6 + 0.4 * rampFactor(s);
      if (rng.chance(Math.min(d.max, (d.base + d.perSeason * season) * diff.eventFreq * calm))) {
        const ev = pickEvent(s, rng);
        if (ev) startEvent(s, ev, rng, now);
        const se = TUNING.secondEvent;
        const from = diff.secondFromSeason;
        if (!grace && season >= from && rng.chance(Math.min(se.max, (se.base + se.perSeason * (season - from)) * diff.secondChance))) {
          const ev2 = pickEvent(s, rng);
          if (ev2) startEvent(s, ev2, rng, now);
        }
      }
    }

    // 9. Météo du jour et mécaniques cachées qui se préparent (crue, loups, éclaireur…)
    mechanicsStartOfDay(s, rng, now);
  }

  finalize(s);
  s.rngState = rng.state;
  return s;
}
