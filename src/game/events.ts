// Tableau de configuration des événements aléatoires.
// Pour ajouter un événement : ajouter une entrée dans EVENTS.

import { BUILDING_BY_ID } from './buildings';
import { RESOURCE_META, seasonOf } from './config';
import type { Rng } from './rng';
import { defensePower, housingCapacity } from './rules';
import type { GameState, ModifierId, NoticeKind, Resources, TradeOption } from './types';

export interface EventContext {
  /** Brouillon modifiable de l'état */
  state: GameState;
  rng: Rng;
  /** Sévérité qui augmente avec les jours (1 au départ) */
  severity: number;
}

export interface EventOutcome {
  text: string;
  trade?: TradeOption[];
}

export interface EventDef {
  id: string;
  title: string;
  icon: string;
  kind: Extract<NoticeKind, 'good' | 'bad' | 'trade'>;
  /** Poids de tirage (0 = impossible maintenant) */
  weight: (state: GameState) => number;
  apply: (ctx: EventContext) => EventOutcome;
}

const fmt = (n: number) => Math.round(n);

/** La force des bandits est multipliée par (1 + population / N) : les grands villages attirent de plus grosses bandes */
const BANDITS_POP_SCALE = 30;

function addModifier(state: GameState, id: ModifierId, days: number) {
  state.modifiers = state.modifiers.filter((m) => m.id !== id);
  state.modifiers.push({ id, untilDay: state.day + days - 1 });
}

function loseResource(state: GameState, key: keyof Resources, ratio: number): number {
  const lost = Math.floor(state.resources[key] * Math.min(0.9, ratio));
  state.resources[key] -= lost;
  return lost;
}

export const EVENTS: EventDef[] = [
  // ---------- Négatifs ----------
  {
    id: 'drought',
    title: 'Sécheresse',
    icon: '🌵',
    kind: 'bad',
    weight: (s) => (seasonOf(s.day).id === 'winter' ? 0 : s.buildings.some((b) => b.type === 'field') ? 3 : 1),
    apply: ({ state, severity }) => {
      const days = Math.min(8, Math.round(3 * severity));
      addModifier(state, 'drought', days);
      return { text: `Les champs produisent 50 % de moins pendant ${days} jours.` };
    },
  },
  {
    id: 'storm',
    title: 'Tempête',
    icon: '⛈️',
    kind: 'bad',
    weight: (s) => (s.buildings.some((b) => BUILDING_BY_ID[b.type].buildable) ? 2 : 0),
    apply: ({ state, rng }) => {
      const targets = state.buildings.filter((b) => BUILDING_BY_ID[b.type].buildable);
      const victim = rng.pick(targets);
      state.buildings = state.buildings.filter((b) => b.id !== victim.id);
      return { text: `La tempête a détruit : ${BUILDING_BY_ID[victim.type].name}.` };
    },
  },
  {
    id: 'harshWinter',
    title: 'Hiver rude',
    icon: '🥶',
    kind: 'bad',
    weight: (s) => {
      const season = seasonOf(s.day).id;
      return season === 'winter' || season === 'autumn' ? 3 : 0;
    },
    apply: ({ state, severity }) => {
      const days = Math.min(10, Math.round(4 * severity));
      addModifier(state, 'harshWinter', days);
      return { text: `Le froid mord : les villageois mangent 50 % de plus pendant ${days} jours.` };
    },
  },
  {
    id: 'epidemic',
    title: 'Épidémie',
    icon: '🤒',
    kind: 'bad',
    weight: (s) => (s.population >= 4 ? 1.5 : 0),
    apply: ({ state, severity, rng }) => {
      const ratio = Math.min(0.35, rng.range(0.1, 0.18) * severity);
      const lost = Math.max(1, Math.min(state.population - 1, Math.round(state.population * ratio)));
      state.population -= lost;
      return { text: `${lost} villageois ${lost > 1 ? 'ont succombé' : 'a succombé'} à la maladie.` };
    },
  },
  {
    id: 'shortage',
    title: 'Pénurie',
    icon: '🐀',
    kind: 'bad',
    weight: () => 2,
    apply: ({ state, severity, rng }) => {
      const key = rng.pick<keyof Resources>(['food', 'wood', 'stone']);
      const lost = loseResource(state, key, Math.min(0.45, rng.range(0.15, 0.25) * severity));
      return {
        text: lost > 0 ? `Rats et moisissure : -${lost} ${RESOURCE_META[key].name.toLowerCase()}.` : 'Les réserves étaient vides, rien de perdu.',
      };
    },
  },
  {
    id: 'bandits',
    title: 'Attaque de bandits',
    icon: '🗡️',
    kind: 'bad',
    weight: (s) => (s.day >= 8 ? 2.5 : 0),
    apply: ({ state, severity, rng }) => {
      const defense = defensePower(state);
      // Les grands villages attirent des bandes plus nombreuses
      const attack = rng.range(0.8, 1.4) * severity * (1 + state.population / BANDITS_POP_SCALE);
      if (defense >= attack) {
        return { text: `Les tours de garde ont repoussé les bandits ! (défense ${defense.toFixed(1)} / attaque ${attack.toFixed(1)})` };
      }
      const ratio = Math.min(0.5, 0.15 * (attack - defense) + 0.1);
      const stolen = (['food', 'gold', 'wood', 'stone'] as const)
        .map((k) => [k, loseResource(state, k, ratio)] as const)
        .filter(([, n]) => n > 0)
        .map(([k, n]) => `${n} ${RESOURCE_META[k].icon}`);
      const note = defense > 0 ? ' Les gardes ont limité les dégâts.' : ' Construisez des tours de garde !';
      return { text: (stolen.length ? `Volé : ${stolen.join(', ')}.` : 'Rien à voler…') + note };
    },
  },

  // ---------- Positifs ----------
  {
    id: 'merchant',
    title: 'Un marchand passe',
    icon: '🧳',
    kind: 'trade',
    weight: () => 2,
    apply: ({ state, rng }) => {
      const sev = 1 + state.day / 40;
      const offers: TradeOption[] = [
        { label: 'Acheter de la nourriture', give: { gold: fmt(6 * sev) }, get: { food: fmt(15 * sev) } },
        { label: 'Acheter du bois', give: { gold: fmt(5 * sev) }, get: { wood: fmt(15 * sev) } },
        { label: 'Acheter de la pierre', give: { gold: fmt(6 * sev) }, get: { stone: fmt(12 * sev) } },
        { label: 'Vendre du bois', give: { wood: fmt(12 * sev) }, get: { gold: fmt(5 * sev) } },
        { label: 'Troquer bois → nourriture', give: { wood: fmt(10 * sev) }, get: { food: fmt(12 * sev) } },
        { label: 'Troquer pierre → nourriture', give: { stone: fmt(8 * sev) }, get: { food: fmt(14 * sev) } },
      ];
      const first = rng.pick(offers);
      const second = rng.pick(offers.filter((o) => o !== first));
      return { text: 'Il propose deux échanges (valable 2 jours).', trade: [first, second] };
    },
  },
  {
    id: 'goodHarvest',
    title: 'Bonne récolte',
    icon: '🌻',
    kind: 'good',
    weight: (s) => (seasonOf(s.day).id === 'winter' ? 0 : 2),
    apply: ({ state }) => {
      const fields = state.buildings.filter((b) => b.type === 'field').length;
      const bonus = 5 + fields * 3;
      state.resources.food += bonus;
      addModifier(state, 'goodHarvest', 3);
      return { text: `+${bonus} nourriture, et les champs produisent +50 % pendant 3 jours.` };
    },
  },
  {
    id: 'newcomers',
    title: 'Nouveaux arrivants',
    icon: '🧑‍🌾',
    kind: 'good',
    weight: () => 1.5,
    apply: ({ state, rng }) => {
      const free = housingCapacity(state) - state.population;
      const n = Math.min(free, rng.int(1, 3));
      if (n <= 0) {
        state.resources.food += 6;
        return { text: 'Faute de place, des voyageurs repartent en laissant 6 nourriture.' };
      }
      state.population += n;
      return { text: `${n} villageois ${n > 1 ? 's\'installent' : 's\'installe'} au village.` };
    },
  },
];

/** Probabilité qu'un événement soit négatif : augmente avec le temps */
export function badEventChance(day: number): number {
  return Math.min(0.85, 0.5 + day / 120);
}

/** Délai avant le prochain événement : se raccourcit avec le temps */
export function nextEventDelay(day: number, rng: Rng): number {
  const base = Math.max(2, Math.round(7 - day / 8));
  return base + rng.int(0, 2);
}

export function pickEvent(state: GameState, rng: Rng): EventDef | undefined {
  const wantBad = rng.chance(badEventChance(state.day));
  const pool = EVENTS.filter((e) => (e.kind === 'bad') === wantBad);
  return rng.weighted(pool, (e) => e.weight(state)) ?? rng.weighted(EVENTS, (e) => e.weight(state));
}

