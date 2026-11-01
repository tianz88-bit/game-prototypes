import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';

// Optional path lets an isolated worktree use an existing installed dependency tree.
const require = createRequire(process.env.OPERATION_C_DEPENDENCIES || import.meta.url);
const ts = require('typescript');
const source = await readFile(new URL('../src/sim.ts', import.meta.url), 'utf8');
const tuneJson = await readFile(new URL('../tune.json', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source.replace("import tuneJson from '../tune.json';", `const tuneJson = ${tuneJson};`), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
}).outputText;
const { OperationSim, DEFAULT_TUNE, distance } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);
let passed = 0;
function test(name, run) { run(); passed++; console.log(`PASS ${name}`); }
function fixture(edit = () => {}) {
  const tune = structuredClone(DEFAULT_TUNE);
  tune.capture.hqRate = 0;
  edit(tune);
  return new OperationSim({ tune, bot: false });
}
// These fixtures exercise general economy invariants with a known cost, rather
// than prescribing the live Barracks balance value.
function costFourFixture(edit = () => {}) {
  return fixture(t => { t.cards.infantry.cost = 4; edit(t); });
}
function h(sim, id) { return sim.hexes.find(x => x.id === id); }
function ownAll(sim, owner = 0) { for (const x of sim.hexes) x.owner = owner; }
function inertProducers(sim) { sim.units.splice(0); for (const b of sim.buildings) if (b.kind !== 'hq') b.unitId = 'fixture'; }
function unit(sim, id, owner, kind = 'infantry', hp = 1000) {
  const u = { id: `fixture-${sim.units.length}`, hexId: id, owner, kind, hp, maxHp: hp,
    attacking: false, buildingId: null, nextAttackAtMs: sim.timeMs };
  sim.units.push(u); return u;
}
function advance(sim, ms) { sim.tick(ms); }
function assertOccupancy(sim) {
  assert.equal(new Set(sim.units.map(u => u.hexId)).size, sim.units.length, 'unique unit destinations');
  const reserved = new Set();
  for (const u of sim.units) {
    const ids = [u.hexId];
    if ((u.movingUntilMs ?? 0) > sim.timeMs && u.fromHexId) ids.push(u.fromHexId);
    for (const id of new Set(ids)) {
      assert(!sim.buildings.some(b => b.hexId === id), `unit reservation overlaps building ${id}`);
      assert(!reserved.has(id), `duplicate reservation ${id}`); reserved.add(id);
    }
  }
}

test('initial HQ capacity excludes centres; previews BFS connected supports including tile', () => {
  const s = costFourFixture(); assert.equal(s.resources(0).capacity, 18);
  const p = s.placement(0, '-4,0', 'infantry'); assert(p.ok); assert.equal(p.hexes.length, 4); assert.equal(p.hexes[0], '-4,0');
  const seen = new Set([p.hexes[0]]);
  for (const id of p.hexes.slice(1)) { assert(s.neighbors(id).some(n => seen.has(n.id))); seen.add(id); }
  assert(s.place(0, '-4,0', 'infantry').ok);
  const b = s.buildings.find(x => x.kind !== 'hq');
  assert.equal(s.resources(0).committed, 4); assert.equal(s.hexes.filter(x => x.lockedBy === b.id).length, 4);
  assert.equal(s.units.length, 1, 'immediate first spawn'); assert.equal(b.readyAtMs, s.tune.cards.infantry.productionMs);
});

test('local supports cannot cross neutral, enemy, locked or burnt bridges', () => {
  for (const blocker of ['neutral', 'enemy', 'locked', 'burnt']) {
    const s = costFourFixture(); for (const x of s.hexes) x.owner = null;
    for (const id of ['0,0', '1,0', '2,0', '3,0', '-7,0', '-7,1', '-7,2', '-7,3']) h(s, id).owner = 0;
    const bridge = h(s, '1,0');
    if (blocker === 'neutral') bridge.owner = null;
    if (blocker === 'enemy') bridge.owner = 1;
    if (blocker === 'locked') bridge.lockedBy = 'other';
    if (blocker === 'burnt') bridge.burnt = true;
    assert.equal(s.placement(0, '0,0', 'infantry').ok, false, blocker);
  }
});

test('enemy capture permanently clears local lock, preserves global debt; destruction releases full cost and burns', () => {
  const s = costFourFixture(t => { t.cards.infantry.range = 0; t.capture.neutralMs = 100; }); ownAll(s);
  assert(s.place(0, '0,0', 'infantry').ok); inertProducers(s);
  const b = s.buildings.find(x => x.kind === 'infantry');
  const support = s.hexes.find(x => x.lockedBy === b.id && x.id !== b.hexId);
  unit(s, support.id, 1); advance(s, 200);
  assert.equal(support.owner, 1); assert.equal(support.lockedBy, null); assert.equal(s.resources(0).committed, 4);
  s.units.splice(0); unit(s, support.id, 0); advance(s, 200);
  assert.equal(support.owner, 0); assert.equal(support.lockedBy, null, 'recapture cannot restore assignment');
  for (const x of s.hexes) x.owner = null;
  h(s, b.hexId).owner = 0;
  assert.deepEqual(s.resources(0), { committed: 4, capacity: 1 });
  assert(!s.placement(0, '2,0', 'infantry').ok, 'capacity debt cannot fund another producer');
  s.units.splice(0); b.hp = 0; advance(s, 100);
  assert.equal(s.resources(0).committed, 0); assert(h(s, b.hexId).burnt);
  assert.equal(s.resources(0).capacity, 0); assert(!s.placement(0, b.hexId, 'infantry').ok);
});

test('production requires both death and cooldown, and restarts cooldown on replacement', () => {
  const s = fixture(); ownAll(s); s.place(0, '0,0', 'infantry');
  const b = s.buildings.find(x => x.kind === 'infantry'); const first = b.unitId;
  s.units[0].hp = 0; advance(s, 100); assert.equal(b.unitId, null);
  advance(s, s.tune.cards.infantry.productionMs - 200); assert.equal(b.unitId, null);
  advance(s, 100); assert(b.unitId && b.unitId !== first);
  const second = b.unitId; advance(s, s.tune.cards.infantry.productionMs + 100);
  assert.equal(b.unitId, second, 'finished cooldown cannot replace living unit');
  s.units.find(x => x.id === second).hp = 0; advance(s, 100);
  assert(b.unitId && b.unitId !== second); assert.equal(b.readyAtMs, s.timeMs + s.tune.cards.infantry.productionMs);
});

test('destroyed producer leaves living orphan, creates no further replacements', () => {
  const s = fixture(); ownAll(s); s.place(0, '0,0', 'tank');
  const b = s.buildings.find(x => x.kind === 'tank'); const id = b.unitId;
  b.hp = 0; advance(s, 100);
  assert(s.units.some(x => x.id === id && x.buildingId === null));
  advance(s, s.tune.cards.tank.productionMs * 2);
  assert.equal(s.units.length, 1); assert.equal(s.resources(0).committed, 0);
});

test('HQ destruction eliminates units and territory; remaining structures removed without burn cascade', () => {
  const s = fixture(); ownAll(s); s.place(0, '0,0', 'infantry');
  s.buildings.find(x => x.id === 'hq0').hp = 0; advance(s, 100);
  assert.equal(s.winner, 1); assert.equal(s.players[0].alive, false);
  assert(!s.units.some(x => x.owner === 0)); assert(!s.buildings.some(x => x.owner === 0));
  assert(!s.hexes.some(x => x.owner === 0)); assert(!h(s, '0,0').burnt);
});

test('encircled spawn waits, then uses the opened adjacent hex; locked/burnt ground is eligible', () => {
  const s = fixture(); ownAll(s);
  for (const x of s.neighbors('0,0')) unit(s, x.id, 0);
  assert(s.place(0, '0,0', 'infantry').ok);
  const b = s.buildings.find(x => x.kind === 'infantry');
  assert.equal(b.unitId, null, 'cannot tunnel through six blocking units to an outer ring');
  const opened = s.units[0].hexId; s.units[0].hp = 0; h(s, opened).burnt = true;
  advance(s, 100); assert(b.unitId); assert.equal(s.units.find(x => x.id === b.unitId).hexId, opened);
  assertOccupancy(s);
});

test('capture pauses during own attack, retains progress, continues under unanswered ranged fire', () => {
  const s = fixture(t => { t.capture.neutralMs = 1000; t.cards.artillery.attackMs = 100; t.cards.artillery.damage = 1; });
  const victim = unit(s, '0,0', 0); unit(s, '2,0', 1, 'artillery');
  advance(s, 100); assert(victim.hp < 1000); assert.equal(victim.attacking, false); assert(h(s, '0,0').capture > 0);
  const progress = h(s, '0,0').capture;
  const closeEnemy = unit(s, '1,0', 1); advance(s, 100);
  assert(victim.attacking); assert.equal(h(s, '0,0').capture, progress);
  closeEnemy.hp = 0; advance(s, 100);
  assert.equal(victim.attacking, false); assert(h(s, '0,0').capture > progress);
});

test('owned capture takes twice neutral time; normal HQ pressure respects enemy occupants', () => {
  const s = fixture(t => { t.capture.neutralMs = 1000; t.cards.infantry.range = 0; });
  unit(s, '0,0', 0); h(s, '0,2').owner = 1; unit(s, '0,2', 0);
  advance(s, 1000); assert.equal(h(s, '0,0').owner, 0); assert.equal(h(s, '0,2').owner, 1);
  advance(s, 1000); assert.equal(h(s, '0,2').owner, 0);
  const p = fixture(t => { t.capture.hqRate = 1; t.capture.neutralMs = 1000; t.cards.infantry.captureRate = 0; t.cards.infantry.range = 0; });
  h(p, '-3,0').owner = 1; unit(p, '-3,0', 1).movingUntilMs = 100000; advance(p, 2000); assert.equal(h(p, '-3,0').owner, 1);
  p.units.splice(0); advance(p, 1900); assert.equal(h(p, '-3,0').owner, 1);
  advance(p, 100); assert.equal(h(p, '-3,0').owner, 0, 'provisional HQ pressure recaptures unoccupied enemy land');
});

test('ground moves across burnt/locked tiles but cannot cross allied or enemy buildings', () => {
  const s = fixture(); ownAll(s);
  const corridor = new Set(['-2,0', '-1,0', '0,0', '1,0', '2,0']);
  // Buildings seal every alternative route. This is a fixture, not a placement command.
  for (const x of s.hexes) if (!corridor.has(x.id) && !s.buildings.some(b => b.hexId === x.id)) {
    s.buildings.push({ id: `wall-${x.id}`, hexId: x.id, owner: 0, kind: 'hq', hp: 1000, maxHp: 1000, readyAtMs: 0, unitId: null });
  }
  const u = unit(s, '-2,0', 0); h(s, '-1,0').burnt = true; h(s, '-1,0').lockedBy = 'fixture'; h(s, '2,0').owner = null;
  advance(s, 100); assert.equal(u.hexId, '-1,0'); assertOccupancy(s);
  s.buildings.push({ id: 'barrier', hexId: '0,0', owner: 0, kind: 'hq', hp: 1000, maxHp: 1000, readyAtMs: 0, unitId: null });
  advance(s, 2000); assert.equal(u.hexId, '-1,0', 'cannot tunnel through friendly structure'); assertOccupancy(s);
});

test('repeat and tick partition invariance; many units retain exclusive reservations', () => {
  const run = chunks => {
    const s = new OperationSim();
    s.place(0, '-4,0', 'infantry'); s.place(0, '-5,1', 'infantry'); s.setTarget(0, 1);
    for (const dt of chunks) { s.tick(dt); assertOccupancy(s); }
    return JSON.stringify({ hexes: s.hexes, buildings: s.buildings, units: s.units, players: s.players, timeMs: s.timeMs, winner: s.winner });
  };
  const chunks = Array(600).fill(100);
  assert.equal(run(chunks), run(chunks)); assert.equal(run(chunks), run(Array(120).fill(500)));
  assert.equal(distance({ q: 0, r: 0 }, { q: 2, r: -1 }), 2);
});

test('attackers surround a building using distinct reachable adjacent hexes and queue when full', () => {
  const s = fixture(t => { t.cards.infantry.moveMs = 100; t.hq.hp = 100000; }); ownAll(s);
  s.setTarget(0, 1);
  for (const id of ['0,0', '0,1', '0,-1', '-1,0', '-1,1', '-1,-1', '-2,0', '-2,1']) unit(s, id, 0);
  const target = s.buildings.find(b => b.id === 'hq1');
  for (let i = 0; i < 150; i++) { advance(s, 100); assertOccupancy(s); }
  const adjacent = s.units.filter(u => distance(h(s, u.hexId), h(s, target.hexId)) === 1);
  assert.equal(adjacent.length, 6, 'all six adjacent attack positions can be filled');
  assert.equal(s.units.length, 8, 'extra attackers wait rather than overlap');
  assert(target.hp < target.maxHp, 'surrounded HQ takes damage');
});

test('global cap and debt are separate from connected supports', () => {
  const s = costFourFixture(t => { t.resources.capacityCap = 4; }); ownAll(s);
  assert(s.place(0, '0,0', 'infantry').ok);
  assert.equal(s.resources(0).capacity, 4);
  const denied = s.placement(0, '3,0', 'infantry');
  assert.equal(denied.ok, false); assert.match(denied.reason, /global capacity/);
  const producer = s.buildings.find(b => b.kind === 'infantry');
  for (const land of s.hexes) land.owner = null;
  assert.equal(s.resources(0).committed, 4);
  assert(producer.hp > 0); assert(s.units.some(u => u.buildingId === producer.id));
});

test('attack order prioritizes selected faction buildings over troops; defense responds to troops', () => {
  for (const attackOrder of [true, false]) {
    const s = fixture(t => { t.cards.infantry.range = 2; });
    const attacker = unit(s, '0,0', 0);
    const encountered = unit(s, '0,1', 1);
    const building = { id: 'priority-target', owner: 1, hexId: '2,0', kind: 'infantry', hp: 1000, maxHp: 1000,
      readyAtMs: 0, unitId: 'fixture-no-spawn' };
    s.buildings.push(building);
    s.setTarget(0, attackOrder ? 1 : 0);
    advance(s, 100);
    assert(attacker.attacking);
    assert.equal(attacker.attackTargetHexId, attackOrder ? building.hexId : encountered.hexId,
      'indicator uses the actual decision, even when a troop is closer than the prioritized building');
    assert.equal(building.hp, attackOrder ? 1000 - s.tune.cards.infantry.damage : 1000);
    assert.equal(encountered.hp, attackOrder ? 1000 : 1000 - s.tune.cards.infantry.damage);
    const buildingHp = building.hp, troopHp = encountered.hp;
    advance(s, 100);
    assert(attacker.attacking); assert.equal(attacker.attackTargetHexId, attackOrder ? building.hexId : encountered.hexId);
    assert.equal(building.hp, buildingHp); assert.equal(encountered.hp, troopHp, 'reload timing is unchanged');
    building.hp = 0; encountered.hp = 0;
    advance(s, 100);
    assert.equal(attacker.attacking, false); assert.equal(attacker.attackTargetHexId, undefined, 'clear stale indicator after engagement ends');
  }
});

test('default Barracks costs eight, opening capacity stays eighteen, and placement has no global timer', () => {
  const opening = new OperationSim({ bot: false });
  assert.equal(DEFAULT_TUNE.cards.infantry.cost, 8); assert.equal(opening.resources(0).capacity, 18);
  assert(opening.place(0, '-4,0', 'infantry').ok); assert.equal(opening.resources(0).committed, 8);
  const b = opening.buildings.find(x => x.kind === 'infantry');
  assert.equal(opening.hexes.filter(x => x.lockedBy === b.id).length, 8);
  const s = new OperationSim({ bot: false }); ownAll(s);
  assert(s.place(0, '0,0', 'infantry').ok); assert(s.place(0, '4,0', 'infantry').ok);
  assert.equal(s.timeMs, 0); assert.equal(s.resources(0).committed, 16);
  assert.equal(s.units.length, 2, 'both affordable connected placements spawn immediately at the same simulation time');
});

test('capture presentation settings do not influence authoritative simulation', () => {
  const normal = fixture(), exaggerated = fixture(t => { t.presentation.captureFlipMs = 99999; t.presentation.captureLift = 10; });
  assert.deepEqual(DEFAULT_TUNE.presentation, { captureFlipMs: 650, captureLift: 0.34 });
  for (const s of [normal, exaggerated]) { unit(s, '0,0', 0); advance(s, 10000); }
  const state = s => JSON.stringify({ hexes: s.hexes, units: s.units, buildings: s.buildings, timeMs: s.timeMs });
  assert.equal(state(normal), state(exaggerated));
});

test('ten-minute virtual playtests progress through contested frontlines to an HQ victory', () => {
  for (const scenario of ['idle-human', 'initial-defense', 'initial-attack']) {
    const s = new OperationSim();
    if (scenario !== 'idle-human') {
      assert(s.place(0, '-4,0', 'infantry').ok);
      const second = s.hexes.find(x => s.placement(0, x.id, 'infantry').ok);
      assert(second); assert(s.place(0, second.id, 'infantry').ok);
      if (scenario === 'initial-attack') s.setTarget(0, 1);
    }
    let peakUnits = 0;
    for (let ms = 0; ms < 600000 && s.winner === null; ms += 100) {
      s.tick(100); assertOccupancy(s); peakUnits = Math.max(peakUnits, s.units.length);
    }
    console.log(`  ${scenario}: winner=${s.winner}, elapsed=${s.timeMs / 1000}s, peakUnits=${peakUnits}`);
    assert.notEqual(s.winner, null, `${scenario} should resolve within ten virtual minutes`);
  }
});

console.log(`${passed} Operation C simulation behavior tests passed.`);
