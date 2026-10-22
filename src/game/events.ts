// Tableau de configuration des imprévus : probabilités, dégâts, annonces, choix.
// Tous les réglages d'équilibrage sont dans TUNING ; chaque événement est une entrée de EVENTS.
//
// Cycle de vie d'un événement :
//   1. tirage (weight) → paramètres (roll)
//   2. s'il a `announce` : carte "menace" avec compte à rebours (+ choix de préparation éventuel)
//   3. arrivée → trigger() : effet immédiat et/ou carte à choix (resolve() à la réponse)
//   4. sans réponse avant la fin du délai : l'option par défaut s'applique

import { BUILDING_BY_ID, CHAINS } from './buildings';
import { RESOURCE_KEYS, RESOURCE_META, seasonIndex, seasonOf } from './config';
import { PARCELS, activeCamps } from './parcels';
import { raidTurnBack, startRaid, startStorm } from './realtime';
import type { Rng } from './rng';
import { seasonEventWeight } from './seasons';
import { canAfford, defensePower, housingCapacity } from './rules';
import { clamp, pushNotice } from './stateUtils';
import type {
  Building,
  ChoiceEffect,
  ChoiceOption,
  EventParams,
  GameState,
  ModifierId,
  Notice,
  NoticeKind,
  Resources,
} from './types';

// ============================================================================
// RÉGLAGES
// ============================================================================

export const TUNING = {
  /** Sévérité = 1 + X par saison écoulée (printemps an 1 = 1 ; hiver an 1 = 2,05 ; hiver an 2 = 3,45) */
  severityPerSeason: 0.38,
  /** Pas d'événement aléatoire avant ce jour */
  firstEventDay: 3,
  /** Chance d'un événement chaque jour */
  dailyChance: { base: 0.26, perSeason: 0.07, max: 0.85 },
  /** Chance d'un 2e événement le même jour (crises superposées) */
  secondEvent: { fromSeason: 2, base: 0.1, perSeason: 0.06, max: 0.5 },
  /** Part d'événements favorables, qui baisse à chaque saison */
  goodShare: { start: 0.4, perSeason: -0.03, min: 0.15 },
  /** Délai pour répondre à une carte à choix, en jours de jeu (0,5 j = 10 s à vitesse x1) */
  choiceTimeout: 0.5,

  fire: {
    /** Toutes les X j, le feu peut gagner un bâtiment voisin */
    spreadEvery: 0.25,
    spreadChance: 0.6,
    /** Bâtiment détruit si le feu dure plus que ça */
    destroyAfter: 0.7,
    /** Durée de l'extinction et villageois mobilisés */
    extinguishTime: 0.1,
    crew: 2,
  },

  /**
   * Bandits en temps réel. Vitesses en cases par jour de jeu (à x1, un jour = 20 s :
   * 16 cases/jour ≈ 0,8 case/s). Les durées sont en jours de jeu.
   */
  raid: {
    /** Taille de la bande : base + parSévérité × sévérité + population / popDiviseur */
    base: 2,
    perSeverity: 1.6,
    popDivisor: 10,
    /** Vitesse de course (+ par point de sévérité au-delà de 1) */
    speed: 16,
    speedPerSeverity: 3,
    /** Distance hors de la carte où ils apparaissent : c'est le temps de réaction avant qu'ils n'entrent */
    spawnDistance: 3,
    /** Écart entre les départs de deux bandits */
    stagger: 0.025,
    /** Durée du vol sur place */
    stealTime: 0.15,
    /** Part de chaque ressource visée volée par bandit (plafonnée par bandit) */
    stealPerBandit: 0.08,
    maxStealPerBandit: 40,
    /** Gardes : vitesse, nombre par niveau de tour (tour avec au moins un travailleur), portée de sortie automatique */
    guardSpeed: 26,
    guardsPerTowerLevel: 1,
    autoGuardRange: 3.5,
    /** Sans garde libre, des villageois partent du château : plus lents, risquent d'être blessés */
    villagerSpeed: 18,
    injuryChance: 0.35,
    injuryDays: 3,
    /** Récompense en or par bandit attrapé : base + par point de sévérité */
    rewardGold: 2,
    rewardPerSeverity: 1,
    /** Intervalle des vérifications (gardes automatiques) */
    checkEvery: 0.02,
    /** Rançon : base + par bandit (or) */
    ransomBase: 4,
    ransomPerBandit: 2.5,
  },

  /** Orage qui traverse la carte (vitesses en cases / jour, rayon en cases) */
  storm: {
    radius: 3,
    speed: 26,
    /**
     * Temps de réaction (jours de jeu ; 1 jour = 20 s à x1) : le nuage se forme au bord de la carte
     * et y reste ce temps-là avant de la traverser
     */
    warningTime: 0.4,
    /** Chance qu'un bâtiment non renforcé sous le nuage soit endommagé (+ par point de sévérité) */
    hitChance: 0.3,
    hitPerSeverity: 0.06,
    /** Intervalle entre deux éclairs (min, max) et chance qu'un éclair mette le feu */
    lightningEvery: [0.05, 0.11] as [number, number],
    lightningFireChance: 0.5,
    /** Actions rapides */
    reinforceCost: { wood: 4 } as Partial<Resources>,
    cropsCostPerField: { wood: 1 } as Partial<Resources>,
    /** Villageois à l'abri : production du jour multipliée par ce facteur */
    shelterProduction: 0.6,
    /** Sans abri, un bâtiment habité endommagé peut blesser un villageois */
    injureChance: 0.3,
    checkEvery: 0.02,
  },

  /** Crue : l'eau monte jusqu'au pic (dégâts), reste, puis redescend */
  flood: {
    riseTime: 0.45,
    holdTime: 0.2,
    recedeTime: 0.6,
    /** Sacs de sable sur un bâtiment menacé (clic pendant la montée) */
    sandbagCost: { wood: 3 } as Partial<Resources>,
  },

  /** Effet discret au début d'un événement en temps réel */
  alert: { flashMs: 600 },

  /** Variations instantanées du moral */
  morale: {
    perDeath: -3,
    deathCap: -20,
    pillage: -8,
    ransom: -3,
    repelled: 8,
    fightWon: 6,
    fightLost: -8,
    buildingLost: -4,
    fireStarted: -2,
    quarantine: -6,
    refuseRefugees: -5,
    welcomeRefugees: 3,
    harvest: 6,
    revoltReset: 35,
  },

  revolt: {
    /** Part des stocks détruits, bâtiments endommagés, part des habitants qui partent */
    stockLoss: 0.3,
    damaged: 2,
    leaveRatio: 0.15,
  },

  /** Grand événement de fin d'année, annoncé X jours avant le jour 40, 80, 120… */
  yearEnd: { every: 40, announceDays: 3 },

  /** Hiver rude : annoncé en fin d'automne avec cette probabilité (+ par année) */
  harshWinter: { chance: 0.2, perYear: 0.25 },
};

/** Sévérité qui monte nettement à chaque saison */
export function severity(day: number): number {
  return 1 + TUNING.severityPerSeason * seasonIndex(day);
}

// ============================================================================
// TYPES
// ============================================================================

export interface EventContext {
  /** Brouillon modifiable de l'état */
  state: GameState;
  rng: Rng;
  severity: number;
  /** Temps de jeu courant */
  now: number;
}

export interface ChoiceSpec {
  options: ChoiceOption[];
  defaultId: string;
  /** Événement en temps réel : la carte ne met pas le jeu en pause */
  realtime?: boolean;
  /** Délai de réponse en jours (défaut : TUNING.choiceTimeout) */
  timeout?: number;
}

export interface EventOutcome {
  text: string;
  choice?: ChoiceSpec;
  kind?: NoticeKind;
}

export interface EventDef {
  id: string;
  title: string;
  icon: string;
  kind: 'good' | 'bad' | 'trade';
  /** Grand événement de fin d'année (jamais tiré au hasard) */
  major?: boolean;
  /** Déclenché par une règle dédiée (jamais tiré au hasard) */
  scheduled?: boolean;
  /** Poids de tirage (0 = impossible maintenant) */
  weight: (state: GameState) => number;
  /** Paramètres tirés au déclenchement (force, quantités…) */
  roll?: (ctx: EventContext) => EventParams;
  /** Annonce à l'avance avec compte à rebours */
  announce?: {
    days: [number, number];
    text: (params: EventParams, days: number) => string;
    /** Choix de préparation proposé pendant le compte à rebours */
    prepare?: (ctx: EventContext, params: EventParams) => ChoiceSpec;
    /** Effet du choix de préparation (modifie params) ; renvoie le texte de résultat */
    onPrepare?: (ctx: EventContext, optionId: string, params: EventParams) => string;
  };
  /** Effet à l'arrivée (ou immédiat si pas d'annonce) */
  trigger: (ctx: EventContext, params: EventParams) => EventOutcome;
  /** Effet de l'option choisie sur la carte à choix */
  resolve?: (ctx: EventContext, optionId: string, params: EventParams) => EventOutcome;
}

// ============================================================================
// AIDES (utilisées aussi par la simulation et les dangers en temps réel)
// ============================================================================

const fmt = (n: number) => Math.round(n);
const plural = (n: number, one: string, many: string) => (n > 1 ? many : one);
const DIRECTIONS = ['au nord', 'à l\'est', 'au sud', 'à l\'ouest'];

/** Bord de carte du côté d'un camp de bandits actif (les attaques en viennent) */
function campEdge(state: GameState): number | undefined {
  const camp = activeCamps(state)[0];
  if (!camp) return undefined;
  const dx = camp.x + 1 - state.map.width / 2;
  const dz = camp.z + 1 - state.map.height / 2;
  if (Math.abs(dx) / state.map.width > Math.abs(dz) / state.map.height) return dx > 0 ? 1 : 3;
  return dz > 0 ? 2 : 0;
}

export function addModifier(state: GameState, id: ModifierId, days: number) {
  state.modifiers = state.modifiers.filter((m) => m.id !== id);
  state.modifiers.push({ id, untilDay: state.day + days - 1 });
}

export function addMorale(state: GameState, delta: number) {
  state.morale = clamp((state.morale ?? 70) + delta, 0, 100);
}

/** Tue / fait partir n villageois (en gardant au moins `keep`) et applique la perte de moral */
export function loseVillagers(state: GameState, n: number, keep = 0): number {
  const lost = Math.max(0, Math.min(n, state.population - keep));
  state.population -= lost;
  // Les morts reposent au cimetière (voir mechanics/disease.ts)
  if (state.mech) state.mech.deaths += lost;
  if (lost > 0) addMorale(state, Math.max(TUNING.morale.deathCap, lost * TUNING.morale.perDeath));
  return lost;
}

export function loseResource(state: GameState, key: keyof Resources, ratio: number): number {
  const lost = Math.floor(state.resources[key] * clamp(ratio, 0, 0.95));
  state.resources[key] -= lost;
  return lost;
}

export function formatResources(r: Partial<Resources>): string {
  const parts = RESOURCE_KEYS.filter((k) => (r[k] ?? 0) > 0).map((k) => `${fmt(r[k]!)} ${RESOURCE_META[k].icon}`);
  return parts.length ? parts.join(', ') : 'rien';
}

/** Bâtiments construits par le joueur (hors château et moulin) */
export function playerBuildings(state: GameState): Building[] {
  return state.buildings.filter((b) => BUILDING_BY_ID[b.type].buildable);
}

/** Endommage un bâtiment ; s'il l'était déjà, il est détruit (sauf le château). Renvoie le texte. */
export function damageBuilding(state: GameState, b: Building): string {
  const name = BUILDING_BY_ID[b.type].name;
  if (b.damaged && b.type !== 'castle') {
    state.buildings = state.buildings.filter((x) => x.id !== b.id);
    addMorale(state, TUNING.morale.buildingLost);
    return `${name} détruit`;
  }
  b.damaged = true;
  return `${name} endommagé`;
}

/** Chaque combat use une partie des armes */
export function wearWeapons(state: GameState) {
  const w = state.resources.weapons ?? 0;
  if (w > 0) state.resources.weapons = Math.max(0, w - Math.ceil(w * CHAINS.weapons.lostPerFight));
}

export function startFire(state: GameState, b: Building, now: number) {
  if (b.fire || b.type === 'mill') return;
  b.fire = { start: now, nextSpread: now + TUNING.fire.spreadEvery, destroyAt: now + TUNING.fire.destroyAfter };
  addMorale(state, TUNING.morale.fireStarted);
}

export function raidSize(state: GameState, sev: number, mult = 1): number {
  const r = TUNING.raid;
  return Math.max(2, Math.round((r.base + r.perSeverity * sev + state.population / r.popDivisor) * mult));
}


/** Fait planifier un événement annoncé (compte à rebours + carte menace) */
export function scheduleEvent(state: GameState, ev: EventDef, days: number, params: EventParams, rng: Rng, now: number) {
  const ctx: EventContext = { state, rng, severity: severity(state.day), now };
  const arriveDay = state.day + days;
  const pendingId = state.nextPendingId++;
  const prep = ev.announce?.prepare?.(ctx, params);
  const notice = pushNotice(state, {
    kind: 'threat',
    icon: ev.icon,
    title: ev.title,
    text: ev.announce ? ev.announce.text(params, days) : '',
    threat: { arriveDay, done: false },
    choice: prep
      ? { eventId: ev.id, options: prep.options, defaultId: prep.defaultId, expiresT: arriveDay, params: { pendingId }, resolved: false }
      : undefined,
  });
  state.pending.push({ id: pendingId, eventId: ev.id, arriveDay, params, noticeId: notice.id });
}

// ============================================================================
// ÉVÉNEMENTS
// ============================================================================

const fx = (icon: string, text: string, tone: ChoiceEffect['tone'] = 'neutral'): ChoiceEffect => ({ icon, text, tone });

/**
 * Carte en temps réel des bandits (ne met pas le jeu en pause) : ils courent déjà vers leurs cibles.
 * Par défaut, c'est au joueur de cliquer sur eux pour envoyer les gardes.
 */
function banditChoice(state: GameState, count: number, ransom: number): ChoiceSpec {
  const defense = defensePower(state);
  const power = defense * 2 + Math.min(state.population, 40) * 0.12;
  // Victoire si power >= count × roll, roll uniforme dans [0,6 ; 1,1]
  const win = clamp((power / count - 0.6) / 0.5, 0, 1);
  const lossIfLost = Math.max(1, Math.round((count * 0.85 - power) * 0.5));
  const towers = state.buildings.filter((b) => b.type === 'tower' && b.workers > 0);
  const guards = towers.reduce((n, b) => n + b.level * TUNING.raid.guardsPerTowerLevel, 0);
  return {
    defaultId: 'none',
    realtime: true,
    timeout: 3,
    options: [
      {
        id: 'none',
        label: 'Les intercepter',
        detail: 'Cliquez sur un bandit : un garde sort d\'une tour pour l\'attraper (sinon des villageois, qui peuvent être blessés).',
        effects: [
          fx('🛡️', guards ? `${guards} garde(s) disponible(s)` : 'aucune tour : villageois', guards ? 'good' : 'bad'),
          fx('🪙', `+${Math.round(TUNING.raid.rewardGold + TUNING.raid.rewardPerSeverity * (severity(state.day) - 1))} par bandit attrapé`, 'good'),
        ],
      },
      {
        id: 'ransom',
        label: 'Payer la rançon',
        detail: 'Ils font demi-tour sans rien voler de plus.',
        cost: { gold: ransom },
        effects: [fx('🪙', `-${ransom}`, 'bad'), fx('😟', `moral ${TUNING.morale.ransom}`, 'bad')],
      },
      {
        id: 'fight',
        label: 'Charger en masse',
        detail: `Tout le village attaque les ${count} bandits d'un coup (force : ${power.toFixed(1)}).`,
        effects: [
          fx('🎲', `victoire ~${Math.round(win * 100)} %`, win >= 0.6 ? 'good' : win >= 0.3 ? 'neutral' : 'bad'),
          fx('💀', `si défaite : ~${lossIfLost} morts et ils s'enfuient`, 'bad'),
        ],
      },
    ],
  };
}

function resolveBandits({ state, rng, now }: EventContext, optionId: string): EventOutcome {
  const raid = state.raid;
  const active = raid ? raid.bandits.filter((b) => b.status === 'active') : [];
  if (!raid || !active.length) return { text: 'Les bandits sont déjà partis.', kind: 'info' };
  if (optionId === 'ransom') {
    raidTurnBack(state, now);
    addMorale(state, TUNING.morale.ransom);
    return { text: 'Les bandits empochent la rançon et font demi-tour.', kind: 'info' };
  }
  if (optionId === 'fight') {
    const count = active.length;
    const defense = defensePower(state) * 2 + Math.min(state.population, 40) * 0.12;
    const roll = rng.range(0.6, 1.1);
    if (defense >= count * roll) {
      for (const b of active) {
        b.status = 'caught';
        b.endT = now;
        for (const k of RESOURCE_KEYS) state.resources[k] += b.loot[k] ?? 0;
      }
      raid.report.caught += count;
      state.stats.banditsKilled += count;
      const lost = loseVillagers(state, rng.chance(0.4) ? 1 : 0, 1);
      addMorale(state, TUNING.morale.fightWon);
      return { text: `Victoire ! ${count} bandits capturés${lost ? ', 1 villageois tombé au combat' : ' sans pertes'}.`, kind: 'good' };
    }
    const deaths = loseVillagers(state, Math.max(1, Math.round((count * roll - defense) * 0.5)), 1);
    addMorale(state, TUNING.morale.fightLost);
    return { text: `Défaite : ${deaths} ${plural(deaths, 'mort', 'morts')}. Les bandits continuent leur pillage !`, kind: 'bad' };
  }
  return { text: 'Cliquez sur les bandits pour envoyer les gardes.', kind: 'info' };
}


/** Options communes à l'épidémie et à la grande épidémie */
function epidemicOptions(state: GameState, p: EventParams, doctorCost: number, q: string, d: string, i: string): ChoiceOption[] {
  const deaths = Math.ceil(state.population * p.rate);
  return [
    {
      id: 'quarantine',
      label: q,
      detail: 'On isole les malades.',
      effects: [
        fx('⚙️', `production -40 % (${p.quarantineDays} j)`, 'bad'),
        fx('💀', '0 à 1 mort', 'neutral'),
        fx('😟', `moral ${TUNING.morale.quarantine}`, 'bad'),
      ],
    },
    { id: 'doctor', label: d, detail: 'Personne ne meurt.', cost: { gold: doctorCost }, effects: [fx('🪙', `-${doctorCost}`, 'bad'), fx('💀', 'aucun mort', 'good')] },
    {
      id: 'ignore',
      label: i,
      detail: 'La maladie suit son cours.',
      effects: [fx('💀', `~${deaths} morts`, 'bad'), fx('🤢', `2e vague dans 2 j (~${Math.ceil(deaths * 1.2)})`, 'bad')],
    },
  ];
}

export const EVENTS: EventDef[] = [
  // ---------------- Annoncés à l'avance ----------------
  {
    id: 'bandits',
    title: 'Bandits',
    icon: '🗡️',
    kind: 'bad',
    // Les camps de bandits proches (parcelles) rendent les attaques plus fréquentes
    weight: (s) => (s.day >= 6 ? (2.5 + 0.3 * seasonIndex(s.day)) * (1 + PARCELS.camp.banditWeightBonus * activeCamps(s).length) : 0),
    roll: ({ state, rng, severity: sev }) => ({ count: raidSize(state, sev), edge: campEdge(state) ?? rng.int(0, 3) }),
    announce: {
      days: [2, 3],
      text: (p, d) => `Environ ${p.count} bandits aperçus ${DIRECTIONS[p.edge]} – arrivée dans ${d} ${plural(d, 'jour', 'jours')}. Tours de garde et or seront utiles.`,
    },
    trigger: ({ state, rng, now }, p) => {
      const ransom = fmt(TUNING.raid.ransomBase + p.count * TUNING.raid.ransomPerBandit + state.population * 0.2);
      startRaid(state, p.count, p.edge ?? 0, now, rng);
      return {
        text: `${p.count} bandits surgissent ${DIRECTIONS[p.edge ?? 0]} ! Cliquez sur eux pour envoyer les gardes.`,
        choice: banditChoice(state, p.count, ransom),
      };
    },
    resolve: resolveBandits,
  },
  {
    id: 'storm',
    title: 'Orage',
    icon: '⛈️',
    kind: 'bad',
    weight: (s) => (playerBuildings(s).length >= 2 ? 2 : 0),
    roll: ({ rng }) => ({ edge: rng.int(0, 3) }),
    announce: {
      days: [1, 1],
      text: (p) => `Un orage se forme ${DIRECTIONS[p.edge]} : il traversera le village demain. Réparez ce qui est abîmé et gardez du bois pour renforcer.`,
    },
    trigger: ({ state, rng, now }, p) => {
      startStorm(state, p.edge ?? 0, now, rng);
      return {
        text: `Le nuage arrive ${DIRECTIONS[p.edge ?? 0]} ! Son ombre montre la zone touchée : cliquez sur les bâtiments pour les renforcer, abritez les villageois, bâchez les récoltes.`,
      };
    },
  },
  {
    id: 'harshWinter',
    title: 'Hiver rude',
    icon: '🥶',
    kind: 'bad',
    scheduled: true,
    weight: () => 0,
    announce: {
      days: [3, 3],
      text: (_p, d) => `Les anciens prédisent un hiver rude dans ${d} jours : la consommation de nourriture doublera tout l'hiver. Faites des réserves !`,
    },
    trigger: ({ state }) => {
      addModifier(state, 'harshWinter', 10);
      return { text: 'Le grand froid est là : les villageois mangent deux fois plus jusqu\'au printemps.' };
    },
  },
  {
    id: 'epidemicWave',
    title: 'La maladie se propage',
    icon: '🤢',
    kind: 'bad',
    scheduled: true,
    weight: () => 0,
    announce: { days: [2, 2], text: (_p, d) => `Faute de soins, une nouvelle vague de maladie frappera dans ${d} jours.` },
    trigger: ({ state }, p) => {
      const lost = loseVillagers(state, Math.ceil(state.population * p.rate * 1.2), 1);
      return { text: `${lost} ${plural(lost, 'villageois emporté', 'villageois emportés')} par la seconde vague.` };
    },
  },

  // ---------------- Immédiats, avec choix ----------------
  {
    id: 'epidemic',
    title: 'Épidémie',
    icon: '🤒',
    kind: 'bad',
    weight: (s) => (s.population >= 5 ? 1.5 + 0.2 * seasonIndex(s.day) : 0),
    roll: ({ severity: sev }) => ({ rate: Math.min(0.4, 0.07 * sev), quarantineDays: 4 }),
    trigger: ({ state, severity: sev }, p) => ({
      text: 'Une fièvre se répand dans le village.',
      choice: {
        defaultId: 'ignore',
        options: epidemicOptions(state, p, fmt(6 + 4 * sev), 'Quarantaine', 'Faire venir un médecin', 'Ignorer'),
      },
    }),
    resolve: ({ state, rng, now }, id, p) => {
      if (id === 'doctor') return { text: 'Le médecin soigne les malades : personne ne meurt.', kind: 'good' };
      if (id === 'quarantine') {
        addModifier(state, 'quarantine', p.quarantineDays);
        addMorale(state, TUNING.morale.quarantine);
        const lost = loseVillagers(state, rng.chance(0.5) ? 1 : 0, 1);
        return { text: `Quarantaine : production réduite ${p.quarantineDays} jours${lost ? ', 1 mort' : ', aucun mort'}.`, kind: 'info' };
      }
      const lost = loseVillagers(state, Math.ceil(state.population * p.rate), 1);
      scheduleEvent(state, EVENT_BY_ID.epidemicWave, 2, { rate: p.rate }, rng, now);
      return { text: `${lost} ${plural(lost, 'mort', 'morts')}. La maladie continue de se propager…`, kind: 'bad' };
    },
  },
  {
    id: 'refugees',
    title: 'Réfugiés',
    icon: '🧳',
    kind: 'trade',
    weight: (s) => (s.day >= 8 ? 1.2 : 0),
    roll: ({ rng, severity: sev }) => ({ n: 2 + rng.int(0, 2) + Math.floor(sev) }),
    trigger: (_ctx, p) => ({
      text: `${p.n} réfugiés fuyant la guerre demandent asile.`,
      choice: {
        defaultId: 'refuse',
        options: [
          {
            id: 'welcome',
            label: 'Les accueillir',
            detail: 'Plus de bras, plus de bouches à nourrir (même sans logement).',
            effects: [
              fx('👥', `+${p.n} habitants`, 'good'),
              fx('🌾', `-${p.n} nourriture/jour`, 'bad'),
              fx('😄', `moral +${TUNING.morale.welcomeRefugees}`, 'good'),
            ],
          },
          {
            id: 'refuse',
            label: 'Les refuser',
            detail: 'Le village a mauvaise conscience.',
            effects: [fx('😟', `moral ${TUNING.morale.refuseRefugees}`, 'bad')],
          },
        ],
      },
    }),
    resolve: ({ state }, id, p) => {
      if (id === 'welcome') {
        state.population += p.n;
        addMorale(state, TUNING.morale.welcomeRefugees);
        const crowd = state.population - housingCapacity(state);
        return { text: `${p.n} nouveaux habitants.${crowd > 0 ? ` ${crowd} sans logement : construisez des maisons !` : ''}`, kind: 'good' };
      }
      addMorale(state, TUNING.morale.refuseRefugees);
      return { text: 'Les réfugiés reprennent la route. Le village a honte.', kind: 'info' };
    },
  },
  {
    id: 'merchant',
    title: 'Un marchand passe',
    icon: '🐴',
    kind: 'trade',
    weight: () => 1.6,
    roll: ({ state, rng }) => {
      const k = 1 + state.day / 40;
      const offers: { give: Partial<Resources>; get: Partial<Resources> }[] = [
        { give: { gold: fmt(6 * k) }, get: { food: fmt(18 * k) } },
        { give: { gold: fmt(5 * k) }, get: { wood: fmt(15 * k) } },
        { give: { gold: fmt(6 * k) }, get: { stone: fmt(12 * k) } },
        { give: { wood: fmt(12 * k) }, get: { gold: fmt(5 * k) } },
        { give: { wood: fmt(10 * k) }, get: { food: fmt(14 * k) } },
        { give: { stone: fmt(8 * k) }, get: { food: fmt(16 * k) } },
      ];
      const a = rng.int(0, offers.length - 1);
      let b = rng.int(0, offers.length - 2);
      if (b >= a) b++;
      const p: EventParams = {};
      [offers[a], offers[b]].forEach((o, i) => {
        for (const key of RESOURCE_KEYS) {
          if (o.give[key]) p[`o${i}_give_${key}`] = o.give[key]!;
          if (o.get[key]) p[`o${i}_get_${key}`] = o.get[key]!;
        }
      });
      return p;
    },
    trigger: (_ctx, p) => {
      const opt = (i: number): ChoiceOption => {
        const give: Partial<Resources> = {};
        const get: Partial<Resources> = {};
        for (const k of RESOURCE_KEYS) {
          if (p[`o${i}_give_${k}`]) give[k] = p[`o${i}_give_${k}`];
          if (p[`o${i}_get_${k}`]) get[k] = p[`o${i}_get_${k}`];
        }
        return {
          id: `o${i}`,
          label: `Obtenir ${formatResources(get)}`,
          detail: `contre ${formatResources(give)}`,
          cost: give,
          effects: [
            ...RESOURCE_KEYS.filter((k) => get[k]).map((k) => fx(RESOURCE_META[k].icon, `+${get[k]}`, 'good')),
            ...RESOURCE_KEYS.filter((k) => give[k]).map((k) => fx(RESOURCE_META[k].icon, `-${give[k]}`, 'bad')),
          ],
        };
      };
      return { text: 'Il propose deux échanges.', choice: { defaultId: 'none', timeout: 1, options: [opt(0), opt(1), { id: 'none', label: 'Refuser', detail: '' }] } };
    },
    resolve: ({ state }, id, p) => {
      if (id === 'none') return { text: 'Le marchand reprend la route.', kind: 'info' };
      for (const k of RESOURCE_KEYS) state.resources[k] += p[`${id}_get_${k}`] ?? 0;
      return { text: 'Marché conclu !', kind: 'good' };
    },
  },

  // ---------------- Immédiats ----------------
  {
    id: 'fire',
    title: 'Incendie !',
    icon: '🔥',
    kind: 'bad',
    weight: (s) => (playerBuildings(s).length >= 2 ? 2 + 0.25 * seasonIndex(s.day) : 0),
    roll: ({ severity: sev }) => ({ n: 1 + (sev >= 2.4 ? 1 : 0) + (sev >= 3.8 ? 1 : 0) }),
    trigger: ({ state, rng, now }, p) => {
      const names: string[] = [];
      for (let i = 0; i < p.n; i++) {
        const targets = playerBuildings(state).filter((b) => !b.fire);
        if (!targets.length) break;
        const b = rng.pick(targets);
        startFire(state, b, now);
        names.push(BUILDING_BY_ID[b.type].name);
      }
      return { text: `Le feu prend : ${names.join(', ')}. Cliquez sur les bâtiments en feu pour les éteindre (${TUNING.fire.crew} villageois mobilisés) !` };
    },
  },
  {
    id: 'drought',
    title: 'Sécheresse',
    icon: '🌵',
    kind: 'bad',
    weight: (s) => (seasonOf(s.day).id === 'winter' ? 0 : s.buildings.some((b) => b.type === 'field') ? 2 : 0.5),
    trigger: ({ state }) => {
      const days = Math.min(8, 3 + seasonIndex(state.day));
      addModifier(state, 'drought', days);
      return { text: `Les champs produisent 50 % de moins pendant ${days} jours.` };
    },
  },

  // ---------------- Favorables ----------------
  {
    id: 'goodHarvest',
    title: 'Bonne récolte',
    icon: '🌻',
    kind: 'good',
    weight: (s) => (seasonOf(s.day).id === 'winter' ? 0 : 2),
    trigger: ({ state }) => {
      const fields = state.buildings.filter((b) => b.type === 'field').length;
      const bonus = 5 + fields * 3;
      state.resources.food += bonus;
      addModifier(state, 'goodHarvest', 3);
      addMorale(state, TUNING.morale.harvest);
      return { text: `+${bonus} 🌾 et les champs produisent +50 % pendant 3 jours.` };
    },
  },
  {
    id: 'newcomers',
    title: 'Nouveaux arrivants',
    icon: '🧑‍🌾',
    kind: 'good',
    weight: (s) => (s.morale >= 40 ? 1.2 : 0),
    trigger: ({ state, rng }) => {
      const free = housingCapacity(state) - state.population;
      const n = Math.min(free, rng.int(1, 3));
      if (n <= 0) {
        state.resources.food += 6;
        return { text: 'Faute de place, des voyageurs repartent en laissant 6 🌾.' };
      }
      state.population += n;
      return { text: `${n} ${plural(n, 'villageois s\'installe', 'villageois s\'installent')} au village.` };
    },
  },

  // ---------------- Grands événements de fin d'année ----------------
  {
    id: 'invasion',
    title: 'Invasion',
    icon: '⚔️',
    kind: 'bad',
    major: true,
    weight: () => 1,
    roll: ({ state, rng, severity: sev }) => ({ count: raidSize(state, sev, 2), edge: rng.int(0, 3) }),
    announce: {
      days: [3, 3],
      text: (p, d) => `Une armée de ${p.count} pillards approche ${DIRECTIONS[p.edge]} – arrivée dans ${d} jours ! Tours, or et réserves seront décisifs.`,
    },
    trigger: ({ state, rng, now }, p) => {
      const ransom = fmt((TUNING.raid.ransomBase + p.count * TUNING.raid.ransomPerBandit + state.population * 0.2) * 1.5);
      startRaid(state, p.count, p.edge ?? 0, now, rng);
      return {
        text: `L'armée de ${p.count} pillards déferle ${DIRECTIONS[p.edge ?? 0]} ! Cliquez sur eux pour envoyer les gardes.`,
        choice: banditChoice(state, p.count, ransom),
      };
    },
    resolve: resolveBandits,
  },
  {
    id: 'greatFamine',
    title: 'Grande famine',
    icon: '🥀',
    kind: 'bad',
    major: true,
    weight: () => 1,
    roll: () => ({ loss: 0.4, days: 10 }),
    announce: {
      days: [3, 3],
      text: (_p, d) => `Une maladie des récoltes s'annonce dans ${d} jours : stocks gâtés et champs presque stériles pendant 10 jours.`,
      prepare: ({ severity: sev }) => ({
        defaultId: 'none',
        options: [
          {
            id: 'seal',
            label: 'Sceller les réserves',
            detail: 'Pertes de stock divisées par deux.',
            cost: { wood: fmt(10 + 5 * sev), gold: fmt(4 * sev) },
            effects: [fx('🌾', '-20 % du stock', 'neutral')],
          },
          { id: 'none', label: 'Ne rien faire', detail: '', effects: [fx('🌾', '-40 % du stock', 'bad')] },
        ],
      }),
      onPrepare: (_ctx, id, p) => {
        if (id === 'seal') p.loss = 0.2;
        return id === 'seal' ? 'Les réserves sont scellées.' : 'Rien n\'est fait.';
      },
    },
    trigger: ({ state }, p) => {
      const lost = loseResource(state, 'food', p.loss);
      addModifier(state, 'blight', p.days);
      addMorale(state, -10);
      return { text: `-${lost} 🌾 gâtés, et les champs produisent 60 % de moins pendant ${p.days} jours.` };
    },
  },
  {
    id: 'plague',
    title: 'Grande épidémie',
    icon: '☠️',
    kind: 'bad',
    major: true,
    weight: () => 1,
    roll: ({ severity: sev }) => ({ rate: Math.min(0.5, 0.12 * sev), quarantineDays: 6 }),
    announce: {
      days: [3, 3],
      text: (_p, d) => `La peste ravage les villages voisins : elle arrivera dans ${d} jours. Prévoyez de l'or pour un médecin.`,
    },
    trigger: ({ state, severity: sev }, p) => ({
      text: 'La peste est dans le village !',
      choice: {
        defaultId: 'ignore',
        options: epidemicOptions(state, p, fmt(12 + 6 * sev), 'Quarantaine stricte', 'Faire venir des médecins', 'Prier'),
      },
    }),
    resolve: (ctx, id, p) => EVENT_BY_ID.epidemic.resolve!(ctx, id, p),
  },
];

export const EVENT_BY_ID: Record<string, EventDef> = Object.fromEntries(EVENTS.map((e) => [e.id, e]));

// ============================================================================
// TIRAGE, CHOIX, RÉVOLTE
// ============================================================================

/** Tire un événement aléatoire (hors grands événements et événements programmés) */
export function pickEvent(state: GameState, rng: Rng): EventDef | undefined {
  const season = seasonIndex(state.day);
  const g = TUNING.goodShare;
  const wantGood = rng.chance(Math.max(g.min, g.start + g.perSeason * season));
  const busy = new Set(state.pending.map((p) => p.eventId));
  if (state.raid) {
    busy.add('bandits');
    busy.add('invasion');
  }
  if (state.storm) busy.add('storm');
  if (state.flood) busy.add('flood');
  const pool = EVENTS.filter((e) => !e.major && !e.scheduled && !busy.has(e.id));
  const side = pool.filter((e) => (e.kind !== 'bad') === wantGood);
  // Les saisons pèsent sur le tirage (sécheresse l'été, marchands l'automne, bandits rares l'hiver…)
  const w = (e: EventDef) => e.weight(state) * seasonEventWeight(state, e.id);
  return rng.weighted(side, w) ?? rng.weighted(pool, w);
}

/** Déclenche un événement : annonce (compte à rebours) ou effet immédiat */
export function startEvent(state: GameState, ev: EventDef, rng: Rng, now: number) {
  const ctx: EventContext = { state, rng, severity: severity(state.day), now };
  const params = ev.roll?.(ctx) ?? {};
  if (ev.announce) {
    const [a, b] = ev.announce.days;
    scheduleEvent(state, ev, rng.int(a, b), params, rng, now);
  } else {
    showOutcome(state, ev, ev.trigger(ctx, params), params, now);
  }
  if (ev.kind === 'bad') state.stats.eventsSurvived++;
}

/** Arrivée d'un événement annoncé */
export function arriveEvent(state: GameState, pendingId: number, rng: Rng, now: number) {
  const p = state.pending.find((x) => x.id === pendingId);
  if (!p) return;
  state.pending = state.pending.filter((x) => x.id !== pendingId);
  const notice = state.notices.find((n) => n.id === p.noticeId);
  if (notice?.threat) notice.threat.done = true;
  const ev = EVENT_BY_ID[p.eventId];
  if (!ev) return;
  const ctx: EventContext = { state, rng, severity: severity(state.day), now };
  showOutcome(state, ev, ev.trigger(ctx, p.params), p.params, now);
}

function showOutcome(state: GameState, ev: EventDef, out: EventOutcome, params: EventParams, now: number) {
  pushNotice(state, {
    kind: out.kind ?? (out.choice ? 'trade' : ev.kind),
    icon: ev.icon,
    title: ev.title,
    text: out.text,
    choice: out.choice
      ? {
          eventId: ev.id,
          options: out.choice.options,
          defaultId: out.choice.defaultId,
          expiresT: now + (out.choice.timeout ?? TUNING.choiceTimeout),
          params,
          resolved: false,
          realtime: out.choice.realtime,
        }
      : undefined,
  });
  // La carte des bandits se ferme d'elle-même à la fin de l'attaque
  if (out.choice?.realtime && state.raid && state.raid.noticeId === undefined) state.raid.noticeId = state.nextNoticeId - 1;
}

/** Applique une option d'une carte à choix (mutation). `auto` = délai écoulé. */
export function applyChoice(state: GameState, notice: Notice, optionId: string, rng: Rng, now: number, auto = false): boolean {
  const choice = notice.choice;
  if (!choice || choice.resolved) return false;
  let opt = choice.options.find((o) => o.id === optionId);
  if (!opt) return false;
  if (opt.cost && !canAfford(state.resources, opt.cost)) {
    if (!auto) return false;
    opt = choice.options.find((o) => o.id === choice.defaultId)!;
  }
  for (const k of RESOURCE_KEYS) state.resources[k] -= opt.cost?.[k] ?? 0;
  choice.resolved = true;
  choice.picked = opt.id;
  const ev = EVENT_BY_ID[choice.eventId];
  if (!ev) return true;
  const ctx: EventContext = { state, rng, severity: severity(state.day), now };
  const prefix = auto ? 'Sans réponse : ' : '';
  // Choix de préparation d'un événement annoncé
  if (choice.params.pendingId !== undefined) {
    const pending = state.pending.find((p) => p.id === choice.params.pendingId);
    if (pending && ev.announce?.onPrepare) {
      const text = ev.announce.onPrepare(ctx, opt.id, pending.params);
      notice.text = `${notice.text} → ${prefix}${text}`;
    }
    return true;
  }
  const out = ev.resolve?.(ctx, opt.id, choice.params);
  if (out) {
    pushNotice(state, { kind: out.kind ?? 'info', icon: ev.icon, title: `${ev.title} : ${opt.label}`, text: prefix + out.text });
  }
  return true;
}

/** Révolte (moral au plus bas) : stocks détruits, bâtiments endommagés, départs */
export function revolt(state: GameState, rng: Rng): string {
  const r = TUNING.revolt;
  for (const k of RESOURCE_KEYS) loseResource(state, k, r.stockLoss);
  const hit: string[] = [];
  for (let i = 0; i < r.damaged; i++) {
    const targets = playerBuildings(state);
    if (targets.length) hit.push(damageBuilding(state, rng.pick(targets)));
  }
  const left = Math.max(1, Math.ceil(state.population * r.leaveRatio));
  state.population = Math.max(0, state.population - left);
  state.morale = TUNING.morale.revoltReset;
  return `Les habitants se révoltent ! ${Math.round(r.stockLoss * 100)} % des stocks pillés${hit.length ? `, ${hit.join(', ')}` : ''}, ${left} ${plural(left, 'meneur chassé', 'meneurs chassés')}.`;
}
