// Outils partagés par les mécaniques cachées.
//
// Une mécanique est un fichier de ce dossier qui exporte une définition `Mechanic` :
//   - textes de la Chronique (page vague quand elle frappe, complément quand le joueur a trouvé la parade) ;
//   - `config` : conditions, indice visuel, effets, solution (toutes les valeurs réglables) ;
//   - crochets appelés par la simulation : fin de journée, début de journée, temps réel.
// Pour en ajouter une : créer le fichier, ajouter son id dans `MechanicId` (types.ts) et l'enregistrer
// dans `MECHANICS` (index.ts).

import { BUILDING_BY_ID } from '../buildings';
import type { Rng } from '../rng';
import type { Building, BuildingTypeId, GameState, MechanicId, MechState, Point } from '../types';

export interface MechanicContext {
  /** Brouillon modifiable de l'état */
  state: GameState;
  rng: Rng;
  /** Temps de jeu courant (jour + avancement) */
  now: number;
}

export interface Mechanic<C = unknown> {
  id: MechanicId;
  icon: string;
  /** Titre de la page de Chronique */
  title: string;
  /** Texte de la page la première fois que la mécanique frappe (vague, jamais la solution) */
  page: string;
  /** Texte qui complète la page quand le joueur a appliqué la bonne solution (même par hasard) */
  solvedPage: string;
  /** Conditions, indice, effets et solution */
  config: C;
  /** Fin d'une journée (après production et repas) */
  endOfDay?: (ctx: MechanicContext) => void;
  /** Début d'une nouvelle journée (après la météo) */
  startOfDay?: (ctx: MechanicContext) => void;
  /** Mise à jour en temps réel nécessaire au temps t ? */
  due?: (state: GameState, t: number) => boolean;
  update?: (ctx: MechanicContext) => void;
}

export function emptyMech(tiles: number): MechState {
  return {
    rain: false,
    rainStreak: 0,
    river: 0,
    forest: new Array(tiles).fill(1),
    cold: 0,
    coldThisWinter: 0,
    sickness: 0,
    rats: 0,
    scout: null,
    wolves: null,
    deaths: 0,
    memo: {},
    chronicle: { struck: [], solved: [] },
  };
}

/** La mécanique vient de frapper : une page s'ajoute à la Chronique (une seule fois par partie) */
export function strike(state: GameState, id: MechanicId) {
  if (!state.mech.chronicle.struck.includes(id)) state.mech.chronicle.struck.push(id);
}

/** Le joueur a appliqué la bonne solution : la page se complète */
export function solve(state: GameState, id: MechanicId) {
  if (!state.mech.chronicle.solved.includes(id)) state.mech.chronicle.solved.push(id);
}

export function center(b: Building): Point {
  const s = BUILDING_BY_ID[b.type].size;
  return { x: b.x + s / 2, z: b.z + s / 2 };
}

export function dist(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

/** Écart en cases entre deux emprises (0 = elles se touchent ou se chevauchent) */
export function gap(a: Building, b: Building): number {
  const sa = BUILDING_BY_ID[a.type].size;
  const sb = BUILDING_BY_ID[b.type].size;
  const gx = Math.max(b.x - (a.x + sa), a.x - (b.x + sb), 0);
  const gz = Math.max(b.z - (a.z + sa), a.z - (b.z + sb), 0);
  return Math.max(gx, gz);
}

/** Bâtiments d'un type donné à moins de `radius` cases (centre à centre) */
export function within(state: GameState, p: Point, types: BuildingTypeId[], radius: number): Building[] {
  return state.buildings.filter((o) => types.includes(o.type) && dist(center(o), p) <= radius);
}

/** Voisins directs (emprises qui se touchent, diagonales comprises) */
export function touching(state: GameState, b: Building): Building[] {
  return state.buildings.filter((o) => o.id !== b.id && gap(b, o) === 0);
}

export const HOUSING: BuildingTypeId[] = ['hut', 'house', 'townhouse', 'manor'];

/** Compteur interne (mémo) */
export function memo(state: GameState, key: string, value?: number): number {
  if (value !== undefined) state.mech.memo[key] = value;
  return state.mech.memo[key] ?? 0;
}
