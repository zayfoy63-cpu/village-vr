// Déplacer, détruire et annuler (interactions VR « plateau d'échecs »). Pure logique, sans rendu.
// Toutes les fonctions renvoient un NOUVEL état (ou null si l'action est impossible).

import { BUILDING_BY_ID, buildCost, levelDef } from './buildings';
import { DAY_DURATION_SEC, RESOURCE_KEYS } from './config';
import { assignWorkers, buildingAt, canAfford, canPlace } from './rules';
import { cloneState, gameTime } from './stateUtils';
import type { Building, GameState, Resources } from './types';
import { VR_CONFIG } from '../vr/config';

const M = VR_CONFIG.moves;

/** Ce qu'il faut pour revenir en arrière après une action (gardé hors de l'état de jeu, donc hors sauvegarde) */
export type UndoRecord =
  | { kind: 'move'; id: number; from: { x: number; z: number }; paid: Partial<Resources>; at: number }
  | { kind: 'demolish'; building: Building; refund: Partial<Resources>; at: number }
  | { kind: 'place'; id: number; cost: Partial<Resources>; at: number };

const add = (res: Resources, r: Partial<Resources>, sign: 1 | -1) => {
  for (const k of RESOURCE_KEYS) res[k] = Math.max(0, res[k] + sign * (r[k] ?? 0));
};

/** Vrai si le bâtiment vient d'être posé : le déplacer ne coûte rien */
export function isFreeMove(state: GameState, b: Building): boolean {
  if (b.placedT === undefined) return false;
  return (gameTime(state) - b.placedT) * DAY_DURATION_SEC <= M.freeSeconds;
}

/** Coût d'un déplacement : gratuit juste après la pose, sinon une petite part du coût de construction */
export function moveCost(state: GameState, b: Building): Partial<Resources> {
  if (isFreeMove(state, b)) return {};
  const base = buildCost(b.type);
  const out: Partial<Resources> = {};
  for (const k of RESOURCE_KEYS) if (base[k]) out[k] = Math.max(1, Math.ceil(base[k]! * M.costRatio));
  return out;
}

/** Part rendue quand on détruit un bâtiment (coût cumulé de ses niveaux) */
export function refundOf(b: Building): Partial<Resources> {
  const out: Partial<Resources> = {};
  for (let lvl = 1; lvl <= b.level; lvl++) {
    const c = levelDef(b.type, lvl).cost;
    for (const k of RESOURCE_KEYS) if (c[k]) out[k] = (out[k] ?? 0) + c[k]!;
  }
  for (const k of RESOURCE_KEYS) if (out[k]) out[k] = Math.floor(out[k]! * M.refundRatio);
  return out;
}

/** Peut-on poser ce type de bâtiment ici, sans tenir compte du coût (déplacement d'un bâtiment existant) ? */
export function canMoveTo(state: GameState, b: Building, x: number, z: number): { ok: boolean; reason?: string } {
  if (!BUILDING_BY_ID[b.type].buildable) return { ok: false, reason: 'Ce bâtiment ne se déplace pas' };
  const without = { ...state, buildings: state.buildings.filter((o) => o.id !== b.id) };
  // Coût ignoré : on triche avec un stock illimité pour ne tester que le terrain
  const rich = { ...without, resources: Object.fromEntries(RESOURCE_KEYS.map((k) => [k, 1e9])) as Resources };
  const check = canPlace(rich, b.type, x, z);
  return check.ok ? { ok: true } : { ok: false, reason: check.reason };
}

/** Soulève un bâtiment : sa production est en pause jusqu'à la repose (ou l'annulation) */
export function beginMove(state: GameState, id: number): GameState | null {
  const b = state.buildings.find((x) => x.id === id);
  if (!b || state.gameOver || b.moving || !BUILDING_BY_ID[b.type].buildable) return null;
  const s = cloneState(state);
  s.buildings.find((x) => x.id === id)!.moving = true;
  assignWorkers(s);
  return s;
}

/** Repose un bâtiment soulevé là où il était (geste annulé) */
export function cancelMove(state: GameState, id: number): GameState | null {
  const b = state.buildings.find((x) => x.id === id);
  if (!b?.moving) return null;
  const s = cloneState(state);
  delete s.buildings.find((x) => x.id === id)!.moving;
  assignWorkers(s);
  return s;
}

/** Repose un bâtiment soulevé sur une autre case (gratuit si récent, sinon petit coût) */
export function moveBuilding(state: GameState, id: number, x: number, z: number): { state: GameState; record: UndoRecord } | null {
  const b = state.buildings.find((o) => o.id === id);
  if (!b || state.gameOver) return null;
  if (!canMoveTo(state, b, x, z).ok) return null;
  const cost = moveCost(state, b);
  if (!canAfford(state.resources, cost)) return null;
  const s = cloneState(state);
  const t = s.buildings.find((o) => o.id === id)!;
  const from = { x: t.x, z: t.z };
  add(s.resources, cost, -1);
  t.x = x;
  t.z = z;
  delete t.moving;
  assignWorkers(s);
  return { state: s, record: { kind: 'move', id, from, paid: cost, at: Date.now() } };
}

/** Détruit un bâtiment en le remettant dans la boîte : une partie du coût est rendue */
export function demolishBuilding(state: GameState, id: number): { state: GameState; record: UndoRecord } | null {
  const b = state.buildings.find((o) => o.id === id);
  if (!b || state.gameOver || !BUILDING_BY_ID[b.type].buildable) return null;
  const refund = isFreeMove(state, b) ? buildCost(b.type) : refundOf(b);
  const s = cloneState(state);
  const gone = s.buildings.find((o) => o.id === id)!;
  s.buildings = s.buildings.filter((o) => o.id !== id);
  add(s.resources, refund, 1);
  assignWorkers(s);
  const record: UndoRecord = { kind: 'demolish', building: { ...gone, moving: undefined }, refund, at: Date.now() };
  return { state: s, record };
}

/** Annule la dernière action (poser, déplacer, détruire) si le délai n'est pas écoulé */
export function undoAction(state: GameState, rec: UndoRecord): GameState | null {
  if (state.gameOver || Date.now() - rec.at > M.undoSeconds * 1000) return null;
  const s = cloneState(state);
  if (rec.kind === 'move') {
    const b = s.buildings.find((o) => o.id === rec.id);
    if (!b || !canMoveTo(s, b, rec.from.x, rec.from.z).ok) return null;
    b.x = rec.from.x;
    b.z = rec.from.z;
    add(s.resources, rec.paid, 1);
  } else if (rec.kind === 'demolish') {
    const b = rec.building;
    if (!canAfford(s.resources, rec.refund)) return null;
    if (buildingAt(s, b.x, b.z)) return null;
    add(s.resources, rec.refund, -1);
    s.buildings.push({ ...b });
  } else {
    if (!s.buildings.some((o) => o.id === rec.id)) return null;
    s.buildings = s.buildings.filter((o) => o.id !== rec.id);
    add(s.resources, rec.cost, 1);
  }
  assignWorkers(s);
  return s;
}
