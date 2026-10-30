import type { Resources } from './types';
import { I } from '../ui/icons';

export const MAP_WIDTH = 20;
export const MAP_HEIGHT = 14;

/** Durée d'un jour en secondes réelles (vitesse x1) */
export const DAY_DURATION_SEC = 20;
export const DAYS_PER_SEASON = 10;

export const START_POPULATION = 3;

// ---------------------------------------------------------------------------
// Niveaux de difficulté : un jeu de coefficients par niveau (choisi au lancement d'une nouvelle partie).
// Normal = l'équilibrage de référence ; les autres niveaux le déforment.
// ---------------------------------------------------------------------------

export type DifficultyId = 'peaceful' | 'normal' | 'hard' | 'nightmare';

export interface DifficultyDef {
  id: DifficultyId;
  name: string;
  icon: string;
  /** Une phrase pour le choix au lancement */
  blurb: string;
  /** Multiplicateur du score final */
  scoreMult: number;
  /** Ressources au départ. Chaque niveau couvre au moins 1 bûcheron + 1 champ + 1 maison (27 bois). */
  start: Resources;
  /** Jours de grâce : seulement des événements positifs ou neutres, aucune mécanique cachée ne frappe */
  graceDays: number;
  /** Après la grâce : jours pour que les menaces passent des « petits » événements (1-2 bandits…) à leur pleine force */
  rampDays: number;
  /** Multiplicateur de la fréquence des événements aléatoires */
  eventFreq: number;
  /** Multiplicateur de la force des événements (taille des bandes, dégâts, sévérité qui monte par saison) */
  eventStrength: number;
  /** Décalage de la part d'événements favorables (+ = plus de bonnes nouvelles) */
  goodShareShift: number;
  /** Crises superposées : 2e événement le même jour, à partir de cette saison, avec cette chance × */
  secondFromSeason: number;
  secondChance: number;
  /** Intensité des mécaniques cachées (froid, rats, fièvre, feu, crue, sols, loups, mines, forêt) */
  mechanics: number;
  /** Multiplicateur du prix des parcelles */
  parcelPrice: number;
}

const startRes = (r: Partial<Resources>): Resources => ({
  food: 0, wood: 0, stone: 0, gold: 0, flour: 0, bread: 0, planks: 0, ironOre: 0, tools: 0, weapons: 0, ...r,
});

export const DIFFICULTIES: DifficultyDef[] = [
  {
    id: 'peaceful',
    name: 'Paisible',
    icon: I.flower,
    blurb: 'Peu de malheurs, de belles réserves, des dangers qui dorment encore.',
    scoreMult: 0.6,
    start: startRes({ food: 20, wood: 50, stone: 8, gold: 12 }),
    graceDays: 14,
    rampDays: 40,
    eventFreq: 0.55,
    eventStrength: 0.7,
    goodShareShift: 0.25,
    secondFromSeason: 4,
    secondChance: 0.3,
    mechanics: 0.5,
    parcelPrice: 0.7,
  },
  {
    id: 'normal',
    name: 'Normal',
    icon: I.scales,
    blurb: 'Huit jours de répit, puis des ennuis qui grossissent saison après saison.',
    scoreMult: 1,
    start: startRes({ food: 12, wood: 30, stone: 2 }),
    graceDays: 8,
    rampDays: 30,
    eventFreq: 1,
    eventStrength: 1,
    goodShareShift: 0,
    secondFromSeason: 2,
    secondChance: 1,
    mechanics: 1,
    parcelPrice: 1,
  },
  {
    id: 'hard',
    name: 'Difficile',
    icon: I.dagger,
    blurb: 'Quatre jours de répit, des événements plus fréquents et plus forts.',
    scoreMult: 1.5,
    start: startRes({ food: 10, wood: 28 }),
    graceDays: 4,
    rampDays: 16,
    eventFreq: 1.3,
    eventStrength: 1.3,
    goodShareShift: -0.08,
    secondFromSeason: 1,
    secondChance: 1.5,
    mechanics: 1.25,
    parcelPrice: 1.25,
  },
  {
    id: 'nightmare',
    name: 'Cauchemar',
    icon: I.skull,
    blurb: "Aucun répit. Les crises s'empilent, la terre elle-même est contre vous.",
    scoreMult: 2.2,
    start: startRes({ food: 8, wood: 27 }),
    graceDays: 0,
    rampDays: 0,
    eventFreq: 1.5,
    eventStrength: 1.6,
    goodShareShift: -0.15,
    secondFromSeason: 0,
    secondChance: 2.2,
    mechanics: 1.6,
    parcelPrice: 1.5,
  },
];

export const DEFAULT_DIFFICULTY: DifficultyId = 'normal';
export const DIFFICULTY_BY_ID = Object.fromEntries(DIFFICULTIES.map((d) => [d.id, d])) as Record<DifficultyId, DifficultyDef>;

/** Ressources de départ du niveau Normal (anciennes parties et valeur par défaut) */
export const START_RESOURCES: Resources = DIFFICULTY_BY_ID[DEFAULT_DIFFICULTY].start;

/** Nourriture mangée par villageois et par jour */
export const FOOD_PER_VILLAGER = 1;

/** Moral : règles de base (les variations dues aux événements sont dans events.ts) */
export const MORALE = {
  start: 70,
  /** Valeur vers laquelle le moral tend chaque jour, avant bonus / malus */
  base: 58,
  /** Part de l'écart à la cible rattrapée chaque jour */
  drift: 0.2,
  /** Bonus si les réserves couvrent au moins 3 jours de repas */
  fedBonus: 10,
  /** Malus le jour où la nourriture manque */
  hungerPenalty: 25,
  /** Malus par habitant sans logement (plafonné à 20) */
  overcrowdPenalty: 3,
  /** Bonus par marché en activité (plafonné à 15) */
  marketBonus: 5,
  /** Bonus par tour de garde en service (sécurité, plafonné à 6) */
  towerBonus: 2,
  /** Malus par bâtiment endommagé (plafonné à 15) */
  damagedPenalty: 2,
  /** Sous ce seuil, la production baisse (jusqu'à -40 % à 0) */
  lowProduction: 40,
  /** Sous ce seuil, des habitants partent chaque jour */
  leaveBelow: 25,
  /** Part de la population qui part chaque jour sous le seuil */
  leaveRatio: 0.08,
  /** Sous ce seuil : révolte */
  revoltBelow: 10,
  /** Pas de nouveaux habitants sous ce seuil */
  growthMin: 40,
};

/** Bâtiment endommagé : production / défense multipliée par ce facteur */
export const DAMAGED_FACTOR = 0.5;
/** Coût de réparation = cette part du coût de construction (arrondi au supérieur) */
export const REPAIR_COST_RATIO = 0.5;

export const SAVE_KEY = 'village-vr-save-v1';
export const SAVE_VERSION = 8;

export type SeasonId = 'spring' | 'summer' | 'autumn' | 'winter';

export interface SeasonDef {
  id: SeasonId;
  name: string;
  icon: string;
}

export const SEASONS: SeasonDef[] = [
  { id: 'spring', name: 'Printemps', icon: I.spring },
  { id: 'summer', name: 'Été', icon: I.summer },
  { id: 'autumn', name: 'Automne', icon: I.autumn },
  { id: 'winter', name: 'Hiver', icon: I.winter },
];

export function seasonOf(day: number): SeasonDef {
  return SEASONS[Math.floor((day - 1) / DAYS_PER_SEASON) % SEASONS.length];
}

export function dayInSeason(day: number): number {
  return ((day - 1) % DAYS_PER_SEASON) + 1;
}

export function yearOf(day: number): number {
  return Math.floor((day - 1) / (DAYS_PER_SEASON * SEASONS.length)) + 1;
}

/** Index de la saison depuis le début de la partie (0 = premier printemps) */
export function seasonIndex(day: number): number {
  return Math.floor((day - 1) / DAYS_PER_SEASON);
}

/** Nom complet, nom court (conséquences des choix : « −15 Bois ») et icône de chaque ressource */
export const RESOURCE_META: Record<keyof Resources, { name: string; short: string; icon: string }> = {
  food: { name: 'Blé (nourriture de base)', short: 'Blé', icon: I.wheat },
  wood: { name: 'Bois', short: 'Bois', icon: I.wood },
  stone: { name: 'Pierre', short: 'Pierre', icon: I.stone },
  gold: { name: 'Or', short: 'Or', icon: I.gold },
  flour: { name: 'Farine', short: 'Farine', icon: I.flour },
  bread: { name: 'Pain', short: 'Pain', icon: I.bread },
  planks: { name: 'Planches', short: 'Planches', icon: I.planks },
  ironOre: { name: 'Minerai de fer', short: 'Minerai', icon: I.ironOre },
  tools: { name: 'Outils', short: 'Outils', icon: I.tools },
  weapons: { name: 'Armes', short: 'Armes', icon: I.weapons },
};

/** Ligne de base du HUD (toujours visible) */
export const BASE_RESOURCES: (keyof Resources)[] = ['food', 'wood', 'stone', 'gold'];
/** Ligne avancée du HUD (chaque ressource n'apparaît qu'une fois découverte) */
export const ADVANCED_RESOURCES: (keyof Resources)[] = ['flour', 'bread', 'planks', 'ironOre', 'tools', 'weapons'];
export const RESOURCE_KEYS: (keyof Resources)[] = [...BASE_RESOURCES, ...ADVANCED_RESOURCES];
