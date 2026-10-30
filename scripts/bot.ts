// Bot de test : joue des parties entières sans interface, avec une stratégie d'humain « raisonnable ».
// Sert à vérifier (1) qu'aucune partie n'est bloquée au départ, (2) à comparer les niveaux de difficulté.
//
//   npm run bot                       20 seeds × 4 niveaux
//   npm run bot -- --seeds 40 --days 300 --levels hard,nightmare
//
// Tout est déterministe : même seed, même niveau, même résultat.

import { BUILDING_BY_ID, buildCost, unlockKey } from '../src/game/buildings';
import { DIFFICULTIES, type DifficultyId } from '../src/game/config';
import { extinguishFire, sendGuard } from '../src/game/hazards';
import { neighbors8, tileAt } from '../src/game/mapgen';
import { PARCEL_COUNT, canBuyParcel, parcelContents } from '../src/game/parcels';
import { canPlace, canUpgrade, computeNet, isIdle, simulateProduction, housingCapacity, woodSafetyGain } from '../src/game/rules';
import { heatingNeed } from '../src/game/mechanics/cold';
import { advanceTime, buyParcel, createInitialState, placeBuilding, resolveChoice, upgradeBuilding } from '../src/game/simulation';
import { seasonOf } from '../src/game/config';
import type { BuildingTypeId, GameState } from '../src/game/types';

const args = process.argv.slice(2);
const opt = (name: string, def: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : def;
};
const SEEDS = Number(opt('seeds', '20'));
const MAX_DAYS = Number(opt('days', '240'));
const LEVELS = opt('levels', 'peaceful,normal,hard,nightmare').split(',') as DifficultyId[];
const STEP = 0.05;

const count = (s: GameState, t: BuildingTypeId) => s.buildings.filter((b) => b.type === t).length;

function castleCenter(s: GameState) {
  const c = s.buildings.find((b) => b.type === 'castle')!;
  return { x: c.x + 1, z: c.z + 1 };
}

/** Meilleure case pour un bâtiment : près du château, loin de l'eau, peu collé aux autres (feu), sur mesure pour chaque type */
function bestTile(s: GameState, type: BuildingTypeId): { x: number; z: number } | null {
  const c = castleCenter(s);
  const def = BUILDING_BY_ID[type];
  const housing = ['hut', 'house', 'townhouse', 'manor'].includes(type);
  let best: { x: number; z: number; score: number } | null = null;
  for (let z = 0; z < s.map.height; z++)
    for (let x = 0; x < s.map.width; x++) {
      if (!canPlace(s, type, x, z).ok) continue;
      let score = Math.hypot(x + 0.5 - c.x, z + 0.5 - c.z);
      const near = neighbors8(x, z);
      if (type !== 'dike' && near.some(([nx, nz]) => tileAt(s.map, nx, nz) === 'water')) score += 4;
      const touching = s.buildings.filter((b) => Math.abs(b.x - x) <= 1 && Math.abs(b.z - z) <= 1).length;
      if (housing || type === 'granary' || type === 'market') score += Math.max(0, touching - 1) * 2.5;
      if (type === 'field' && tileAt(s.map, x, z) === 'fertile') score -= 3;
      if (type !== 'field' && type !== 'lumber' && type !== 'quarry' && tileAt(s.map, x, z) === 'fertile') score += 2;
      if (type === 'lumber') score -= near.filter(([nx, nz]) => tileAt(s.map, nx, nz) === 'forest').length * 0.6;
      if (type === 'quarry') score -= near.filter(([nx, nz]) => tileAt(s.map, nx, nz) === 'rock').length * 0.6;
      if (def.requiresAdjacent === 'water') score -= 5;
      if (!best || score < best.score) best = { x, z, score };
    }
  return best;
}

function tryBuild(s: GameState, type: BuildingTypeId, keep: Partial<Record<keyof GameState['resources'], number>> = {}): GameState {
  const cost = buildCost(type);
  for (const [k, v] of Object.entries(keep)) if (s.resources[k as keyof GameState['resources']] - (cost[k as keyof typeof cost] ?? 0) < (v ?? 0)) return s;
  const spot = bestTile(s, type);
  if (!spot) return s;
  return placeBuilding(s, type, spot.x, spot.z) ?? s;
}

/** Décisions de la journée : construire, améliorer, acheter une parcelle */
function plan(s: GameState): GameState {
  const pop = s.population;
  const cap = housingCapacity(s);
  const net = computeNet(s);
  const season = seasonOf(s.day).id;
  // En automne et en hiver, on garde du bois de chauffage
  const reserve = season === 'autumn' ? heatingNeed({ ...s, day: s.day + 12 }) * 8 + 10 : season === 'winter' ? 10 : 0;
  const keep = { wood: reserve };

  const wants: BuildingTypeId[] = [];
  if (count(s, 'lumber') < 1) wants.push('lumber');
  if (count(s, 'field') < 1) wants.push('field');
  // On ne loge pas de nouveaux bras si les greniers ne tiendront pas l'hiver
  const stocked = season === 'winter' || s.resources.food >= pop * 12 || season === 'spring';
  if (cap - pop < 2 && stocked) wants.push(pop >= 15 && count(s, 'market') > 0 ? 'townhouse' : s.unlocked.includes(unlockKey('house', 1)) ? 'house' : 'hut');
  // Greniers pleins avant l'hiver (rien ne pousse pendant 10 jours, et l'hiver rude double les repas)
  const foodTarget = pop * (season === 'summer' || season === 'autumn' ? 14 : 8);
  if (count(s, 'field') < Math.ceil(pop / 2.2) + 1 && (net.food < 0.5 || count(s, 'field') * 3 < pop || (season !== 'winter' && s.resources.food < foodTarget))) wants.push('field');
  if (net.wood < 2 + pop / 6 || count(s, 'lumber') < 1 + Math.floor(pop / 6)) wants.push('lumber');
  if (count(s, 'quarry') < 1 && pop >= 4) wants.push('quarry');
  if (pop >= 8 && count(s, 'well') < 1) wants.push('well');
  if (pop >= 8 && count(s, 'tower') < Math.floor(pop / 9)) wants.push('tower');
  if (pop >= 10 && count(s, 'market') < 1) wants.push('market');
  if (pop >= 10 && count(s, 'granary') < 1) wants.push('granary');
  if (pop >= 12 && count(s, 'herbalist') < 1) wants.push('herbalist');
  if (pop >= 14 && count(s, 'sheepfold') < 1) wants.push('sheepfold');
  if (pop >= 14 && count(s, 'torch') < 2) wants.push('torch');
  if (pop >= 16 && count(s, 'market') < 2) wants.push('market');
  if (pop >= 20 && count(s, 'tower') < Math.floor(pop / 7)) wants.push('tower');

  let cur = s;
  let built = 0;
  for (const t of wants) {
    const before = cur;
    cur = tryBuild(cur, t, t === 'lumber' || t === 'field' || t === 'hut' || t === 'house' ? {} : keep);
    if (cur !== before && ++built >= 2) break; // deux chantiers par jour au plus
  }

  // Améliorations : champs, bûcherons, carrières
  for (const b of cur.buildings) {
    if (!['field', 'lumber', 'quarry', 'market', 'tower'].includes(b.type)) continue;
    const check = canUpgrade(cur, b);
    if (!check.ok || !check.next) continue;
    if (cur.resources.wood - (check.next.cost.wood ?? 0) < reserve) continue;
    const up = upgradeBuilding(cur, b.id);
    if (up) {
      cur = up;
      break;
    }
  }

  // Parcelle : la moins dangereuse que l'or permet
  for (let id = 0; id < PARCEL_COUNT; id++) {
    if (!canBuyParcel(cur, id).ok) continue;
    if (parcelContents(cur, id).features.some((f) => f.type === 'camp')) continue;
    cur = buyParcel(cur, id) ?? cur;
    break;
  }
  return cur;
}

/** Réactions immédiates : cartes à choix, bandits, feux */
function react(s: GameState): GameState {
  let cur = s;
  for (const n of cur.notices) {
    if (!n.choice || n.choice.resolved) continue;
    const ch = n.choice;
    const afford = (o: { cost?: Partial<GameState['resources']> }) => Object.entries(o.cost ?? {}).every(([k, v]) => cur.resources[k as keyof GameState['resources']] >= (v ?? 0));
    let pick = ch.defaultId;
    if (ch.eventId === 'bandits' || ch.eventId === 'invasion') {
      const ransom = ch.options.find((o) => o.id === 'ransom');
      pick = ransom && afford(ransom) && cur.population < 25 ? 'ransom' : 'none';
    } else if (ch.eventId === 'epidemic' || ch.eventId === 'plague') {
      const doc = ch.options.find((o) => o.id === 'doctor');
      pick = doc && afford(doc) ? 'doctor' : ch.options.some((o) => o.id === 'quarantine') ? 'quarantine' : ch.defaultId;
    } else if (ch.eventId === 'refugees') {
      pick = cur.population + 3 <= housingCapacity(cur) + 2 ? 'welcome' : 'refuse';
    }
    if (ch.params.pendingId !== undefined) pick = ch.defaultId;
    const next = resolveChoice(cur, n.id, pick);
    if (next !== cur) cur = next;
  }
  if (cur.raid) {
    for (const b of cur.raid.bandits) {
      if (b.status !== 'active' || b.chasedBy !== undefined) continue;
      const r = sendGuard(cur, b.id);
      if (r.state) cur = r.state;
    }
  }
  for (const b of cur.buildings) {
    if (!b.fire || b.fire.extinguishEnd !== undefined) continue;
    const r = extinguishFire(cur, b.id);
    if (r) cur = r;
  }
  return cur;
}

interface Result {
  seed: number;
  level: DifficultyId;
  endDay: number;
  dead: boolean;
  startOk: boolean;
  woodNet: boolean;
  peakPop: number;
  firstBadEvent: number | null;
  /** Événements négatifs ou mécaniques cachées apparus pendant la période de grâce (doit être 0) */
  graceBreaches: number;
  firstBandits: { day: number; count: number } | null;
}

/** Une case de terre fertile où poser un champ, dans la zone de départ */
function fertileSpot(s: GameState): boolean {
  for (let z = 0; z < s.map.height; z++)
    for (let x = 0; x < s.map.width; x++) if (tileAt(s.map, x, z) === 'fertile' && canPlace(s, 'field', x, z).ok) return true;
  return false;
}

/** Vérifie qu'au départ on peut poser 1 bûcheron + 1 champ + 1 maison (déblocage de la maison mis à part) */
function checkStart(s: GameState): boolean {
  let cur = s;
  for (const t of ['lumber', 'field'] as BuildingTypeId[]) {
    const spot = bestTile(cur, t);
    if (!spot) return false;
    const next = placeBuilding(cur, t, spot.x, spot.z);
    if (!next) return false;
    cur = next;
  }
  const withHouse: GameState = { ...cur, unlocked: [...cur.unlocked, unlockKey('house', 1)] };
  const spot = bestTile(withHouse, 'house');
  return !!spot && !!placeBuilding(withHouse, 'house', spot.x, spot.z);
}

function play(seed: number, level: DifficultyId): Result {
  let s = createInitialState(seed, level);
  const startOk = checkStart(s);
  let woodNet = false;
  let firstBad: number | null = null;
  let breaches = 0;
  let firstBandits: { day: number; count: number } | null = null;
  const grace = DIFFICULTIES.find((d) => d.id === level)!.graceDays;
  const ECONOMY = ['Famine', 'Mécontentement', 'Révolte !'];
  let lastDay = 0;
  const seenNotices = new Set<number>();
  while (!s.gameOver && s.day <= MAX_DAYS) {
    if (s.day !== lastDay) {
      lastDay = s.day;
      if (args.includes('--trace') && s.day % 10 === 1) console.log(`  [${level} ${seed}] j${s.day} pop ${s.population}/${housingCapacity(s)} food ${Math.round(s.resources.food)} wood ${Math.round(s.resources.wood)} stone ${Math.round(s.resources.stone)} gold ${Math.round(s.resources.gold)} morale ${Math.round(s.morale)} bld ${Object.entries(s.buildings.reduce((m: Record<string, number>, b) => ((m[b.type] = (m[b.type] ?? 0) + 1), m), {})).map(([k, v]) => k + v).join(' ')} net.food ${computeNet(s).food.toFixed(1)} mill ${(() => { const m = s.buildings.find((b) => b.type === 'mill')!; const r = simulateProduction(s).status.get(m.id); return `w${m.workers} idle${isIdle(s, m)} ${JSON.stringify(r)} flour${Math.round(s.resources.flour)} bread${Math.round(s.resources.bread)}`; })()}`);
      s = plan(s);
    }
    s = react(s);
    if (woodSafetyGain(s) > 0 && !woodNet) {
      woodNet = true;
      if (args.includes('--verbose')) console.log(`  [${level} seed ${seed}] bois mort au jour ${s.day}: bois=${Math.round(s.resources.wood)} pop=${s.population} bûcherons=${s.buildings.filter((b) => b.type === 'lumber').map((b) => `${b.workers}t${b.fire ? 'F' : ''}${b.paused ? 'P' : ''}`).join(',')}`);
    }
    s = advanceTime(s, STEP);
    for (const n of s.notices) {
      if (seenNotices.has(n.id)) continue;
      seenNotices.add(n.id);
      if (firstBad === null && (n.kind === 'bad' || n.kind === 'threat') && !ECONOMY.includes(n.title)) firstBad = n.day;
      if (n.day <= grace && (n.kind === 'bad' || n.kind === 'threat') && !ECONOMY.includes(n.title)) breaches++;
    }
    if (s.day <= grace) breaches += s.mech.chronicle.struck.length;
    if (!firstBandits) {
      const p = s.pending.find((x) => x.eventId === 'bandits' || x.eventId === 'invasion');
      if (p) firstBandits = { day: s.day, count: p.params.count };
    }
  }
  if (s.gameOver && args.includes('--deaths')) {
    const last = s.notices.filter((n) => n.kind === 'bad' || n.kind === 'threat').slice(-4).map((n) => `j${n.day} ${n.title}`);
    console.log(`  [${level} seed ${seed}] fin j${s.day} pop max ${s.stats.maxPopulation} morale ${Math.round(s.morale)} nourriture ${Math.round(s.resources.food)} : ${last.join(' | ')}`);
  }
  return { seed, level, endDay: s.day, dead: s.gameOver, startOk, woodNet, peakPop: s.stats.maxPopulation, firstBadEvent: firstBad, graceBreaches: breaches, firstBandits };
}

const median = (a: number[]) => {
  const v = [...a].sort((x, y) => x - y);
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
};

// 1. Garantie de la carte : forêt, rochers et terre fertile utilisables dans la zone de départ, sur beaucoup de seeds
{
  const N = Number(opt('mapseeds', '3000'));
  let bad = 0;
  for (let seed = 1; seed <= N; seed++) {
    const s = createInitialState(seed * 7919);
    const trio = checkStart(s);
    const rock = bestTile(s, 'quarry') !== null;
    const fertile = fertileSpot(s);
    if (!trio || !rock || !fertile) {
      bad++;
      if (bad <= 5) console.log(`  carte problématique : seed ${seed * 7919} trio=${trio} rock=${rock} fertile=${fertile}`);
    }
  }
  console.log(`Cartes : ${N - bad}/${N} avec forêt, rochers, terre fertile et trio de départ constructible (${bad} échec)`);
}

// 2. Parties complètes
console.log(`\nParties du bot : ${SEEDS} seeds, ${MAX_DAYS} jours maximum\n`);
console.log('niveau     | départ ok | bois mort | grâce violée | 1er mal (j) | 1re bande (j, n) | fin : médiane | min | max | survivants');
for (const level of LEVELS) {
  const results: Result[] = [];
  for (let i = 1; i <= SEEDS; i++) results.push(play(i * 104729, level));
  const ends = results.map((r) => r.endDay);
  const bad = results.map((r) => r.firstBadEvent).filter((x): x is number => x !== null);
  const def = DIFFICULTIES.find((d) => d.id === level)!;
  const bands = results.map((r) => r.firstBandits).filter((x): x is { day: number; count: number } => x !== null);
  console.log(
    [
      def.name.padEnd(10),
      `${String(results.filter((r) => r.startOk).length).padStart(2)}/${SEEDS}`.padEnd(9),
      String(results.filter((r) => r.woodNet).length).padEnd(9),
      String(results.reduce((n, r) => n + r.graceBreaches, 0)).padEnd(12),
      String(bad.length ? median(bad) : '-').padEnd(11),
      (bands.length ? `${median(bands.map((b) => b.day))}, ${median(bands.map((b) => b.count))}` : '-').padEnd(16),
      String(median(ends)).padEnd(13),
      String(Math.min(...ends)).padEnd(3),
      String(Math.max(...ends)).padEnd(3),
      `${results.filter((r) => !r.dead).length}/${SEEDS}`,
    ].join(' | '),
  );
}
