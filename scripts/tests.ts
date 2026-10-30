// Tests automatiques de la logique de jeu (sans interface) : `npm test`.
// Chaque chaîne de production est testée de bout en bout ; les raisons d'arrêt aussi.
// Un test qui échoue fait sortir le processus en erreur.

import assert from 'node:assert/strict';
import { BUILDING_BY_ID } from '../src/game/buildings';
import { migrate } from '../src/game/save';
import { advanceDay, applyUnlocks, createInitialState } from '../src/game/simulation';
import { assignWorkers, chainReport, simulateProduction } from '../src/game/rules';
import type { Building, BuildingTypeId, GameState, Resources } from '../src/game/types';

let passed = 0;
const failures: string[] = [];
function test(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log(`  ok   ${name}`);
  } catch (e) {
    failures.push(name);
    console.log(`  FAIL ${name}\n       ${(e as Error).message.split('\n').join('\n       ')}`);
  }
}

let nextId = 100;
/** Partie neuve (jour 1, printemps), villageois et stocks imposés, bâtiments posés directement */
function village(pop: number, stock: Partial<Resources>, builds: [BuildingTypeId, number?][], opts: { day?: number } = {}): GameState {
  const s = createInitialState(104729, 'normal');
  s.population = pop;
  s.resources = { ...s.resources, food: 0, wood: 0, stone: 0, gold: 0, ...stock };
  s.day = opts.day ?? 3;
  s.parcels.owned = Array.from({ length: 12 }, (_, i) => i);
  s.buildings = s.buildings.filter((b) => b.type === 'castle' || b.type === 'mill');
  let x = 0;
  for (const [type, level = 1] of builds) {
    if (type === 'mill') continue; // le moulin de départ est déjà là
    s.buildings.push({ id: nextId++, type, x: x++ % 19, z: 0, level, workers: 0, builtDay: 1 } as Building);
  }
  applyUnlocks(s, false);
  assignWorkers(s);
  return s;
}
const of = (s: GameState, t: BuildingTypeId) => s.buildings.find((b) => b.type === t)!;
const run = (s: GameState, t: BuildingTypeId) => simulateProduction(s).status.get(of(s, t).id)!;

console.log('Chaînes de production');

test('blé → moulin → farine : le moulin de départ tourne dès 8 habitants', () => {
  const s = village(8, { food: 0 }, [['field'], ['field']]);
  const r = simulateProduction(s);
  assert.equal(of(s, 'mill').workers, 1, 'le moulin doit avoir un travailleur');
  assert.ok(r.produced.flour >= 3.99, `farine produite : ${r.produced.flour}`);
  assert.ok(r.consumed.food >= 3.99, `blé consommé : ${r.consumed.food}`);
  assert.equal(chainReport(s, of(s, 'mill')).stop, null);
});

test('le moulin utilise le blé récolté le jour même (stock de départ vide)', () => {
  const s = village(10, { food: 0 }, [['field'], ['field']]);
  assert.ok(simulateProduction(s).produced.flour > 0);
});

test('le moulin est verrouillé avec moins de 8 habitants, et le dit', () => {
  const s = village(5, { food: 50 }, [['field']]);
  const rep = chainReport(s, of(s, 'mill'));
  assert.equal(rep.stop?.kind, 'locked');
  assert.match(rep.stop!.text, /8 habitants/);
});

test('farine → boulangerie → pain', () => {
  const s = village(12, { flour: 20 }, [['bakery']]);
  assert.ok(of(s, 'bakery').workers >= 1);
  const r = simulateProduction(s);
  assert.ok(r.produced.bread >= 2.99, `pain produit : ${r.produced.bread}`);
  assert.ok(r.consumed.flour >= 2.99, `farine consommée : ${r.consumed.flour}`);
});

test('blé → moulin → boulangerie → pain, sur plusieurs jours, et le village mange du pain', () => {
  let s = village(12, { food: 40 }, [['field'], ['field'], ['field'], ['bakery']]);
  let bread = 0;
  for (let d = 0; d < 5; d++) {
    bread += simulateProduction(s).produced.bread;
    s = advanceDay(s);
  }
  assert.ok(bread >= 14, `pain sur 5 jours : ${bread}`);
  assert.ok(s.discovered.includes('bread') && s.discovered.includes('flour'));
});

test('bois → scierie → planches', () => {
  let s = village(12, { wood: 50, food: 200 }, [['sawmill']]);
  assert.equal(of(s, 'sawmill').workers, 1);
  for (let d = 0; d < 4; d++) s = advanceDay(s);
  assert.ok(s.resources.planks >= 7.9, `planches : ${s.resources.planks}`);
});

test('fer → forge → outils', () => {
  let s = village(25, { wood: 30, ironOre: 10, food: 300 }, [['mine'], ['forge']]);
  assert.ok(of(s, 'forge').workers >= 1, 'la forge doit avoir des forgerons');
  for (let d = 0; d < 4; d++) s = advanceDay(s);
  assert.ok(s.resources.tools >= 3, `outils : ${s.resources.tools}`);
});

test('forge niveau 2 : outils et armes', () => {
  let s = village(30, { wood: 30, ironOre: 40, food: 300 }, [['forge', 2]]);
  for (let d = 0; d < 3; d++) s = advanceDay(s);
  assert.ok(s.resources.weapons >= 2, `armes : ${s.resources.weapons}`);
});

console.log('Affectation des travailleurs');

test("en hiver, les champs endormis libèrent leurs travailleurs : le moulin travaille", () => {
  // Jour 33 = hiver. 8 champs auraient pris les 8 villageois avant la correction.
  const s = village(8, { food: 40 }, Array.from({ length: 8 }, () => ['field'] as [BuildingTypeId]), { day: 33 });
  assert.equal(of(s, 'field').workers, 0, 'un champ ne garde personne en hiver');
  assert.equal(of(s, 'mill').workers, 1, 'le moulin reçoit un travailleur');
  assert.ok(simulateProduction(s).produced.flour > 0);
});

test('un transformateur à sec libère ses travailleurs et annonce « à sec »', () => {
  const s = village(10, { food: 0 }, [['bakery']]);
  const b = of(s, 'bakery');
  assert.equal(b.workers, 0);
  const rep = chainReport(s, b);
  assert.equal(rep.stop?.kind, 'input');
  assert.match(rep.stop!.text, /farine/);
});

test("les transformateurs passent avant la carrière et le marché", () => {
  // 6 habitants, 4 champs, un bûcheron, une carrière : le moulin (verrouillé) ne compte pas ; la scierie oui
  const s = village(12, { wood: 30, food: 10 }, [['field'], ['field'], ['field'], ['field'], ['lumber'], ['quarry'], ['market'], ['sawmill']]);
  assert.equal(of(s, 'sawmill').workers, 1, 'la scierie doit être servie');
});

console.log('Raisons d\'arrêt affichées');

test('à l\'arrêt (joueur)', () => {
  const s = village(12, { flour: 20 }, [['bakery']]);
  of(s, 'bakery').paused = true;
  assert.equal(chainReport(s, of(s, 'bakery')).stop?.kind, 'paused');
});

test('stock plein', () => {
  const s = village(12, { flour: 20, bread: 160 }, [['bakery']]);
  assert.equal(chainReport(s, of(s, 'bakery')).stop?.kind, 'capped');
});

test('en feu', () => {
  const s = village(12, { flour: 20 }, [['bakery']]);
  of(s, 'bakery').fire = { start: 0, nextSpread: 9, destroyAt: 9 };
  assert.equal(chainReport(s, of(s, 'bakery')).stop?.kind, 'fire');
});

test('champ en hiver : « hors saison »', () => {
  const s = village(8, {}, [['field']], { day: 33 });
  assert.equal(chainReport(s, of(s, 'field')).stop?.kind, 'season');
});

test('aucun travailleur libre', () => {
  const s = village(2, { flour: 50 }, [['field'], ['field'], ['bakery']]);
  of(s, 'bakery').workers = 0;
  assert.equal(chainReport(s, of(s, 'bakery')).stop?.kind, 'locked');
  const t = village(10, { food: 50, flour: 50 }, Array.from({ length: 10 }, () => ['field'] as [BuildingTypeId]).concat([['bakery']]));
  assert.equal(chainReport(t, of(t, 'bakery')).stop?.kind, 'workers');
});

test('le panneau donne stock d\'entrée et production en cours', () => {
  const s = village(12, { flour: 20 }, [['bakery']]);
  const rep = chainReport(s, of(s, 'bakery'));
  assert.deepEqual(rep.inputs.map((i) => [i.key, i.have, i.perDay]), [['flour', 20, 3]]);
  assert.deepEqual(rep.outputs.map((o) => [o.key, o.perDay]), [['bread', 3]]);
  void BUILDING_BY_ID;
  void run;
});

console.log('Bergerie');

test('la bergerie produit de la laine et un peu de lait, de plus en plus aux niveaux 2 et 3', () => {
  const wool = [1, 2, 3].map((lvl) => {
    const s = village(30, { food: 100, wood: 50 }, [['sheepfold', lvl]]);
    const b = of(s, 'sheepfold');
    assert.equal(b.workers, BUILDING_BY_ID.sheepfold.levels[lvl - 1].workers, `bergers niveau ${lvl}`);
    const r = simulateProduction(s);
    assert.ok(r.produced.food >= 0.4 * lvl - 1e-9 && r.produced.wool > 0);
    return r.produced.wool;
  });
  assert.deepEqual(wool, [1, 2.5, 4.5]);
});

test('en hiver, les moutons mangent du blé ; sans blé ils maigrissent et produisent moins', () => {
  let s = village(8, { food: 100 }, [['sheepfold', 2]], { day: 33 });
  const before = s.resources.food;
  s = advanceDay(s);
  assert.ok(s.resources.food < before - 8 - 1.1, `le troupeau doit manger du blé (reste ${s.resources.food})`);
  assert.equal(of(s, 'sheepfold').lean ?? 0, 0);
  // Pas assez de blé pour les moutons (les villageois mangent d'abord) : le troupeau maigrit
  let hungry = village(3, { food: 3 }, [['sheepfold', 2]], { day: 33 });
  hungry.unlocked.push('sheepfold:2');
  assignWorkers(hungry);
  const full = simulateProduction(hungry).produced.wool;
  hungry = advanceDay(hungry);
  assert.equal(of(hungry, 'sheepfold').lean, 0.25, 'un jour sans blé : maigreur +0,25');
  of(hungry, 'sheepfold').lean = 0.6;
  hungry.resources.food = 0;
  assert.ok(simulateProduction(hungry).produced.wool < full * 0.7, 'la laine baisse');
  assert.match(chainReport(hungry, of(hungry, 'sheepfold')).slow ?? '', /maigre/);
});

test('hors hiver, les moutons broutent et reprennent du poids', () => {
  let s = village(8, { food: 100 }, [['sheepfold']], { day: 13 });
  of(s, 'sheepfold').lean = 0.6;
  s = advanceDay(s);
  assert.ok((of(s, 'sheepfold').lean ?? 0) < 0.6);
});

test('le fumier régénère les champs voisins, plus fort aux niveaux supérieurs', () => {
  const fatigue = (level: number | null) => {
    let s = village(30, { food: 400 }, [['field'], ...(level ? ([['sheepfold', level]] as [BuildingTypeId, number][]) : [])], { day: 15 });
    const f = of(s, 'field');
    f.fatigue = 0.5;
    f.x = 5;
    f.z = 5;
    if (level) {
      const fold = of(s, 'sheepfold');
      fold.x = 6;
      fold.z = 5;
    }
    s = advanceDay(s);
    return of(s, 'field').fatigue ?? 0;
  };
  const none = fatigue(null);
  const l1 = fatigue(1);
  const l3 = fatigue(3);
  assert.ok(l1 < none - 0.02, `sans bergerie ${none}, niveau 1 ${l1}`);
  assert.ok(l3 < l1, `niveau 3 ${l3} doit faire mieux que niveau 1 ${l1}`);
});

test('une ancienne sauvegarde sans laine la reçoit à 0', () => {
  const old: any = JSON.parse(JSON.stringify(createInitialState(5, 'normal')));
  delete old.resources.wool;
  old.version = 7;
  assert.equal(migrate(old)!.resources.wool, 0);
});

console.log(`\n${passed} réussis, ${failures.length} échoués`);
if (failures.length) process.exit(1);
