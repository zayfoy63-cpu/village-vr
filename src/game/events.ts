// Tableau de configuration des imprévus : probabilités, dégâts, annonces, choix.
// Tous les réglages d'équilibrage sont dans TUNING ; chaque événement est une entrée de EVENTS.
//
// Cycle de vie d'un événement :
//   1. tirage (weight) → paramètres (roll)
//   2. s'il a `announce` : carte "menace" avec compte à rebours (+ choix de préparation éventuel)
//   3. arrivée → trigger() : effet immédiat et/ou carte à choix (resolve() à la réponse)
//   4. sans réponse avant la fin du délai : l'option par défaut s'applique

import { BUILDING_BY_ID } from './buildings';
import { RESOURCE_KEYS, RESOURCE_META, seasonIndex, seasonOf } from './config';
import { neighbors8, tileAt } from './mapgen';
import { PARCELS, activeCamps } from './parcels';
import type { Rng } from './rng';
import { canAfford, defensePower, housingCapacity, storageCapacity } from './rules';
import { clamp, pushNotice } from './stateUtils';
import type {
  Building,
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
  severityPerSeason: 0.42,
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

  raid: {
    /** Taille de la bande : base + parSévérité × sévérité + population / popDiviseur */
    base: 2,
    perSeverity: 1.6,
    popDivisor: 10,
    /** Durées (jours de jeu) : approche jusqu'au château, puis fuite */
    approach: 0.4,
    leave: 0.35,
    /** Une tour de défense 1 abat un bandit tous les X jours (défense 2 = deux fois plus vite) */
    towerKillInterval: 0.2,
    /** Part de chaque ressource volée par bandit arrivé au château */
    stealPerBandit: 0.07,
    maxSteal: 0.8,
    /** Clic sur un bandit : risque de perdre un villageois (réduit par la défense) */
    clickDeathChance: 0.12,
    /** Rançon : base + par bandit (or) */
    ransomBase: 4,
    ransomPerBandit: 2.5,
  },

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

export function startFire(state: GameState, b: Building, now: number) {
  if (b.fire || b.type === 'mill') return;
  b.fire = { start: now, nextSpread: now + TUNING.fire.spreadEvery, destroyAt: now + TUNING.fire.destroyAfter };
  addMorale(state, TUNING.morale.fireStarted);
}

export function raidSize(state: GameState, sev: number, mult = 1): number {
  const r = TUNING.raid;
  return Math.max(2, Math.round((r.base + r.perSeverity * sev + state.population / r.popDivisor) * mult));
}

/** Lance une attaque de bandits visible en 3D depuis un bord de la carte */
export function startRaid(state: GameState, count: number, edge: number, now: number, rng: Rng) {
  const { width: w, height: h } = state.map;
  const castle = state.buildings.find((b) => b.type === 'castle');
  const to = castle ? { x: castle.x + 1, z: castle.z + 1 } : { x: w / 2, z: h / 2 };
  const along = rng.range(0.2, 0.8);
  const from = [
    { x: along * w, z: -1 },
    { x: w + 1, z: along * h },
    { x: along * w, z: h + 1 },
    { x: -1, z: along * h },
  ][edge % 4];
  const d = defensePower(state);
  state.raid = {
    startT: now,
    arriveT: now + TUNING.raid.approach,
    leaveT: now + TUNING.raid.approach + TUNING.raid.leave,
    from,
    to,
    killedAt: new Array(Math.min(count, 40)).fill(-1),
    nextTowerKill: d > 0 ? now + TUNING.raid.towerKillInterval / d : 1e9,
    arrived: false,
  };
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

/** Choix commun aux bandits et à l'invasion */
function banditChoice(count: number, ransom: number): ChoiceSpec {
  return {
    defaultId: 'let',
    options: [
      { id: 'ransom', label: 'Payer la rançon', detail: 'Ils repartent sans combattre. Le village se sent humilié.', cost: { gold: ransom } },
      { id: 'fight', label: 'Combattre', detail: `Affrontement immédiat contre ${count} bandits : pertes selon votre défense.` },
      { id: 'let', label: 'Les laisser venir', detail: 'Ils marchent sur le château : vos tours tirent, cliquez sur eux pour les arrêter.' },
    ],
  };
}

function resolveBandits({ state, rng, now }: EventContext, optionId: string, params: EventParams): EventOutcome {
  const count = params.count;
  if (optionId === 'ransom') {
    addMorale(state, TUNING.morale.ransom);
    return { text: 'Les bandits empochent la rançon et disparaissent.', kind: 'info' };
  }
  if (optionId === 'fight') {
    const defense = defensePower(state) * 2 + Math.min(state.population, 40) * 0.12;
    const roll = rng.range(0.6, 1.1);
    if (defense >= count * roll) {
      const lost = loseVillagers(state, rng.chance(0.4) ? 1 : 0, 1);
      addMorale(state, TUNING.morale.fightWon);
      state.stats.banditsKilled += count;
      return { text: `Victoire ! Les bandits sont mis en déroute${lost ? ', 1 villageois tombé au combat' : ' sans pertes'}.`, kind: 'good' };
    }
    const deaths = loseVillagers(state, Math.max(1, Math.round((count * roll - defense) * 0.5)), 1);
    const ratio = Math.min(TUNING.raid.maxSteal, count * TUNING.raid.stealPerBandit) * 0.5;
    const stolen: Partial<Resources> = {};
    for (const k of RESOURCE_KEYS) stolen[k] = loseResource(state, k, ratio);
    const targets = playerBuildings(state);
    const dmg = targets.length ? damageBuilding(state, rng.pick(targets)) : null;
    addMorale(state, TUNING.morale.fightLost);
    return {
      text: `Défaite : ${deaths} ${plural(deaths, 'mort', 'morts')}, volé : ${formatResources(stolen)}${dmg ? `, ${dmg}` : ''}.`,
      kind: 'bad',
    };
  }
  startRaid(state, count, params.edge ?? 0, now, rng);
  return { text: `${count} bandits marchent sur le château ! Cliquez sur eux pour les arrêter.`, kind: 'bad' };
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
      days: [1, 2],
      text: (p, d) => `Environ ${p.count} bandits aperçus ${DIRECTIONS[p.edge]} – arrivée dans ${d} ${plural(d, 'jour', 'jours')}. Tours de garde et or seront utiles.`,
    },
    trigger: ({ state }, p) => {
      const ransom = fmt(TUNING.raid.ransomBase + p.count * TUNING.raid.ransomPerBandit + state.population * 0.2);
      return { text: `${p.count} bandits sont aux portes. Que faire ?`, choice: banditChoice(p.count, ransom) };
    },
    resolve: resolveBandits,
  },
  {
    id: 'storm',
    title: 'Tempête',
    icon: '⛈️',
    kind: 'bad',
    weight: (s) => (playerBuildings(s).length >= 2 ? 2 : 0),
    roll: ({ rng, severity: sev }) => ({ hits: Math.min(5, 1 + Math.floor(sev / 1.4)), lightning: rng.chance(0.35) ? 1 : 0 }),
    announce: {
      days: [1, 1],
      text: (p) => `Tempête en approche : environ ${p.hits} ${plural(p.hits, 'bâtiment menacé', 'bâtiments menacés')} demain. Réparez ce qui est abîmé !`,
      prepare: (_ctx, p) => ({
        defaultId: 'none',
        options: [
          { id: 'reinforce', label: 'Renforcer les toits', detail: 'Moitié moins de dégâts, pas de foudre.', cost: { wood: 6 + 3 * p.hits } },
          { id: 'none', label: 'Ne rien faire', detail: 'Croiser les doigts.' },
        ],
      }),
      onPrepare: (_ctx, id, p) => {
        if (id === 'reinforce') p.reinforced = 1;
        return id === 'reinforce' ? 'Les toits sont renforcés.' : 'Le village attend la tempête.';
      },
    },
    trigger: ({ state, rng, now }, p) => {
      const hits = p.reinforced ? Math.floor(p.hits / 2) : p.hits;
      const results: string[] = [];
      for (let i = 0; i < hits; i++) {
        const targets = playerBuildings(state);
        if (!targets.length) break;
        results.push(damageBuilding(state, rng.pick(targets)));
      }
      if (p.lightning && !p.reinforced) {
        const targets = playerBuildings(state).filter((b) => !b.fire);
        if (targets.length) {
          const b = rng.pick(targets);
          startFire(state, b, now);
          results.push(`la foudre enflamme : ${BUILDING_BY_ID[b.type].name}`);
        }
      }
      return { text: results.length ? `${results.join(', ')}.` : 'Les toits ont tenu, aucun dégât !', kind: results.length ? 'bad' : 'good' };
    },
  },
  {
    id: 'flood',
    title: 'Crue',
    icon: '🌊',
    kind: 'bad',
    weight: (s) => {
      const exposed = s.buildings.some((b) => neighbors8(b.x, b.z).some(([x, z]) => tileAt(s.map, x, z) === 'water'));
      const wet = ['spring', 'autumn'].includes(seasonOf(s.day).id) ? 1.5 : 0.6;
      return exposed ? 2 * wet : 0;
    },
    roll: ({ severity: sev }) => ({ sev }),
    announce: {
      days: [2, 2],
      text: (_p, d) => `La rivière monte : crue dans ${d} jours. Les champs collés à l'eau seront détruits.`,
      prepare: (_ctx, p) => ({
        defaultId: 'none',
        options: [
          { id: 'dikes', label: 'Renforcer les berges', detail: 'Protège tous les bâtiments au bord de l\'eau.', cost: { wood: fmt(10 + 4 * p.sev), stone: fmt(3 * p.sev) } },
          { id: 'none', label: 'Ne rien faire', detail: 'Les champs riverains seront perdus.' },
        ],
      }),
      onPrepare: (_ctx, id, p) => {
        if (id === 'dikes') p.protected = 1;
        return id === 'dikes' ? 'Les berges sont renforcées.' : 'Rien n\'est fait contre la crue.';
      },
    },
    trigger: ({ state, now }, p) => {
      state.floodUntil = now + 1;
      if (p.protected) return { text: 'La rivière déborde… mais les berges tiennent bon !', kind: 'good' };
      const lost: string[] = [];
      for (const b of [...state.buildings]) {
        const wet = neighbors8(b.x, b.z).some(([x, z]) => tileAt(state.map, x, z) === 'water');
        if (!wet || !BUILDING_BY_ID[b.type].buildable) continue;
        if (b.type === 'field') {
          state.buildings = state.buildings.filter((x) => x.id !== b.id);
          addMorale(state, TUNING.morale.buildingLost / 2);
          lost.push('Champ détruit');
        } else lost.push(damageBuilding(state, b));
      }
      return { text: lost.length ? `La rivière déborde : ${lost.join(', ')}.` : 'La rivière déborde sans rien toucher.' };
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
    trigger: ({ severity: sev }, p) => ({
      text: 'Une fièvre se répand dans le village.',
      choice: {
        defaultId: 'ignore',
        options: [
          { id: 'quarantine', label: 'Quarantaine', detail: `Production -40 % pendant ${p.quarantineDays} jours, 1 mort au plus.` },
          { id: 'doctor', label: 'Faire venir un médecin', detail: 'Personne ne meurt.', cost: { gold: fmt(6 + 4 * sev) } },
          { id: 'ignore', label: 'Ignorer', detail: `~${Math.round(p.rate * 100)} % de morts, et la maladie se propage.` },
        ],
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
          { id: 'welcome', label: 'Les accueillir', detail: `+${p.n} habitants (même sans logement) : plus de bras, plus de bouches à nourrir.` },
          { id: 'refuse', label: 'Les refuser', detail: 'Le village a mauvaise conscience (moral en baisse).' },
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
        return { id: `o${i}`, label: `Obtenir ${formatResources(get)}`, detail: `contre ${formatResources(give)}`, cost: give };
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
    id: 'rats',
    title: 'Invasion de rats',
    icon: '🐀',
    kind: 'bad',
    weight: (s) => {
      const excess = s.resources.food - storageCapacity(s);
      return excess > 30 ? 2 + excess / 100 : 0;
    },
    trigger: ({ state, severity: sev }) => {
      const excess = Math.max(0, state.resources.food - storageCapacity(state));
      const lost = Math.floor(excess * Math.min(0.7, 0.3 + 0.08 * sev));
      state.resources.food -= lost;
      addMorale(state, -3);
      const hint = storageCapacity(state) ? 'Agrandissez vos greniers.' : 'Construisez un grenier !';
      return { text: `Les rats dévorent ${lost} 🍞 stockés hors des greniers. ${hint}` };
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
      return { text: `+${bonus} 🍞 et les champs produisent +50 % pendant 3 jours.` };
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
        return { text: 'Faute de place, des voyageurs repartent en laissant 6 🍞.' };
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
    trigger: ({ state }, p) => {
      const ransom = fmt((TUNING.raid.ransomBase + p.count * TUNING.raid.ransomPerBandit + state.population * 0.2) * 1.5);
      return { text: `L'armée de ${p.count} pillards est là.`, choice: banditChoice(p.count, ransom) };
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
          { id: 'seal', label: 'Sceller les réserves', detail: 'Pertes de stock divisées par deux.', cost: { wood: fmt(10 + 5 * sev), gold: fmt(4 * sev) } },
          { id: 'none', label: 'Ne rien faire', detail: '' },
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
      return { text: `-${lost} 🍞 gâtés, et les champs produisent 60 % de moins pendant ${p.days} jours.` };
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
    trigger: ({ severity: sev }, p) => ({
      text: 'La peste est dans le village !',
      choice: {
        defaultId: 'ignore',
        options: [
          { id: 'quarantine', label: 'Quarantaine stricte', detail: `Production -40 % pendant ${p.quarantineDays} jours, 1 mort au plus.` },
          { id: 'doctor', label: 'Faire venir des médecins', detail: 'Personne ne meurt.', cost: { gold: fmt(12 + 6 * sev) } },
          { id: 'ignore', label: 'Prier', detail: `~${Math.round(p.rate * 100)} % de morts, puis une seconde vague.` },
        ],
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
  if (state.raid) busy.add('bandits');
  const pool = EVENTS.filter((e) => !e.major && !e.scheduled && !busy.has(e.id));
  const side = pool.filter((e) => (e.kind !== 'bad') === wantGood);
  return rng.weighted(side, (e) => e.weight(state)) ?? rng.weighted(pool, (e) => e.weight(state));
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
        }
      : undefined,
  });
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
