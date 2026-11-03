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
const { OperationSim, DEFAULT_TUNE, BASE_CARDS, DEFAULT_LOADOUT, distance } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);
let passed = 0;
function test(name, run) { run(); passed++; console.log(`PASS ${name}`); }
function fixture(edit = () => {}) {
  const tune = structuredClone(DEFAULT_TUNE);
  tune.capture.hqRate = 0;
  tune.hq.defenseDamage = 0;
  tune.resources.destroyReleaseMs = 0;
  // Legacy movement/combat fixtures isolate those rules from construction/tier timing.
  for (const card of Object.values(tune.cards)) { card.buildMs = 0; card.capturePriority = false; }
  edit(tune);
  const s = new OperationSim({ tune, bot: false }); for (const p of s.players) p.techTier = 3;
  return s;
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
function milestone(edit = () => {}, options = {}) {
  const tune = structuredClone(DEFAULT_TUNE); tune.capture.hqRate = 0; edit(tune);
  return new OperationSim({ tune, bot: false, ...options });
}
function loseSupports(s, ids) {
  for (const id of ids) { const tile = h(s, id); tile.owner = 1; tile.lockedBy = null; delete tile.commitment; }
}
function producer(s, id = '0,0', kind = 'infantry') {
  assert(s.place(0, id, kind).ok); return s.buildings.find(b => b.hexId === id);
}
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
  assert.equal(s.units.length, 1, 'immediate first spawn'); assert.equal(b.readyAtMs, 0); assert.equal(b.cooldownActive, false);
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

test('enemy capture permanently clears local lock; destruction discounts release and strands lost support debt', () => {
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
  assert.deepEqual(s.resources(0), { committed: 4, capacity: 1, stranded: 0 });
  assert(!s.placement(0, '2,0', 'infantry').ok, 'capacity debt cannot fund another producer');
  s.units.splice(0); b.hp = 0; advance(s, 100);
  assert.equal(s.resources(0).committed, 1); assert.equal(s.resources(0).stranded, 1); assert(h(s, b.hexId).burnt);
  assert.equal(s.resources(0).capacity, 0); assert(!s.placement(0, b.hexId, 'infantry').ok);
});

test('non-squad production clock starts on death only and becomes idle again after replacement', () => {
  const s = fixture(); ownAll(s); s.place(0, '0,0', 'tank');
  const b = s.buildings.find(x => x.kind === 'tank'), first = b.unitId, interval = s.tune.cards.tank.productionMs;
  advance(s, interval * 2); assert.equal(b.unitId, first); assert.equal(b.cooldownActive, false);
  s.units.find(u => u.id === first).hp = 0; advance(s, 100); assert.equal(b.unitId, null);
  assert.equal(b.readyAtMs, s.timeMs + interval); assert.equal(b.productionStartedAtMs, s.timeMs);
  advance(s, interval - 100); assert.equal(b.unitId, null); advance(s, 100);
  assert(b.unitId && b.unitId !== first); assert.equal(b.readyAtMs, 0); assert.equal(b.cooldownActive, false);
  const second = b.unitId; advance(s, interval + 100); assert.equal(b.unitId, second);
  s.units.find(x => x.id === second).hp = 0; advance(s, 100);
  assert.equal(b.unitId, null); assert.equal(b.readyAtMs, s.timeMs + interval);
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

test('owned capture uses the configured one-and-a-half multiplier; HQ pressure respects enemy occupants', () => {
  assert.equal(DEFAULT_TUNE.capture.ownedMultiplier, 1.5);
  const s = fixture(t => { t.capture.neutralMs = 1000; t.cards.infantry.range = 0; });
  unit(s, '0,0', 0); h(s, '0,2').owner = 1; unit(s, '0,2', 0);
  advance(s, 1000); assert.equal(h(s, '0,0').owner, 0); assert.equal(h(s, '0,2').owner, 1);
  advance(s, 400); assert.equal(h(s, '0,2').owner, 1);
  advance(s, 100); assert.equal(h(s, '0,2').owner, 0);
  const p = fixture(t => { t.capture.hqRate = 1; t.capture.neutralMs = 1000; t.cards.infantry.captureRate = 0; t.cards.infantry.range = 0; });
  h(p, '-3,0').owner = 1; unit(p, '-3,0', 1).movingUntilMs = 100000; advance(p, 2000); assert.equal(h(p, '-3,0').owner, 1);
  p.units.splice(0); advance(p, 1400); assert.equal(h(p, '-3,0').owner, 1);
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
    assert.deepEqual(s.shots.filter(x => x.unitId === attacker.id).map(x => ({
      unitId: x.unitId, owner: x.owner, kind: x.kind, fromHexId: x.fromHexId, targetHexId: x.targetHexId, timeMs: x.timeMs,
    })), [{ unitId: attacker.id, owner: 0, kind: 'infantry', fromHexId: '0,0',
      targetHexId: attackOrder ? building.hexId : encountered.hexId, timeMs: 100 }]);
    assert.equal(building.hp, attackOrder ? 1000 - s.tune.cards.infantry.damage : 1000);
    assert.equal(encountered.hp, attackOrder ? 1000 : 1000 - s.tune.cards.infantry.damage);
    const buildingHp = building.hp, troopHp = encountered.hp;
    advance(s, 100);
    assert(attacker.attacking); assert.equal(attacker.attackTargetHexId, attackOrder ? building.hexId : encountered.hexId);
    assert.equal(s.shots.filter(x => x.unitId === attacker.id).length, 1, 'aiming during reload creates no phantom shot');
    assert.equal(building.hp, buildingHp); assert.equal(encountered.hp, troopHp, 'reload timing is unchanged');
    building.hp = 0; encountered.hp = 0;
    advance(s, 100);
    assert.equal(attacker.attacking, false); assert.equal(attacker.attackTargetHexId, undefined, 'clear stale indicator after engagement ends');
  }
});

test('confirmed building costs, opening capacity eighteen, and no global placement timer', () => {
  const opening = new OperationSim({ bot: false });
  assert.equal(DEFAULT_TUNE.cards.infantry.cost, 4); assert.equal(DEFAULT_TUNE.cards.tank.cost, 8); assert.equal(DEFAULT_TUNE.cards.artillery.cost, 8);
  assert.equal(opening.resources(0).capacity, 18);
  assert(opening.place(0, '-4,0', 'infantry').ok); assert.equal(opening.resources(0).committed, 4);
  const b = opening.buildings.find(x => x.kind === 'infantry');
  assert.equal(opening.hexes.filter(x => x.lockedBy === b.id).length, 4);
  const s = new OperationSim({ bot: false }); ownAll(s);
  assert(s.place(0, '0,0', 'infantry').ok); assert(s.place(0, '4,0', 'infantry').ok);
  assert.equal(s.timeMs, 0); assert.equal(s.resources(0).committed, 8);
  assert.equal(s.units.length, 0, 'both placements begin construction without a global timer');
  advance(s, s.tune.cards.infantry.buildMs); assert.equal(s.units.length, 2, 'both complete at the same simulation time');
});

test('all presentation settings, including event capacity, leave authoritative state and entity IDs identical', () => {
  assert.deepEqual(DEFAULT_TUNE.presentation, { captureFlipMs: 900, captureLift: 0.9, shotTraceMs: 220, retreatMs: 650, maxShotEvents: 128, commandPulseMs: 1800, upgradeBobMs: 1400, upgradeBobLift: 0.1, mushroomMs: 3000 });
  const normal = fixture();
  const variants = [normal, ...[0, 2].map(cap => fixture(t => {
    t.presentation = { ...t.presentation, captureFlipMs: 99999, captureLift: 10, shotTraceMs: 1, maxShotEvents: cap, commandPulseMs: 1, upgradeBobMs: 99999, upgradeBobLift: 10 };
  }))];
  for (const s of variants) {
    unit(s, '0,0', 0); unit(s, '1,0', 1); unit(s, '-1,3', 0);
    advance(s, 10000);
    assert(s.place(0, '-4,0', 'infantry').ok);
    assert(s.buildings.some(b => b.id === 'b1'), 'shot IDs must not consume building IDs');
    assert(s.units.some(u => u.id === 'u2'), 'shot IDs must not consume unit IDs');
  }
  const state = s => JSON.stringify({ hexes: s.hexes, units: s.units, buildings: s.buildings, players: s.players, timeMs: s.timeMs, winner: s.winner });
  for (const s of variants.slice(1)) assert.equal(state(normal), state(s));
  assert(normal.shots.length > 2); assert.equal(variants[1].shots.length, 0); assert.equal(variants[2].shots.length, 2);
});

test('shots follow actual weapon cadence and retain a final shot when the shooter dies simultaneously', () => {
  const s = fixture(); const shooter = unit(s, '0,0', 0), enemy = unit(s, '1,0', 1);
  advance(s, 100);
  assert.deepEqual(s.shots.map(x => x.id), [1, 2]);
  assert.deepEqual(s.shots[0], { id: 1, unitId: shooter.id, owner: 0, kind: 'infantry', fromHexId: '0,0', targetHexId: '1,0', targetDomain: 'ground', timeMs: 100 });
  advance(s, 800); assert.equal(s.shots.length, 2, 'no shots between firing instants');
  advance(s, 100); assert.equal(s.shots.length, 4);
  assert.equal(s.shots[2].timeMs, 1000); assert.equal(s.shots[3].timeMs, 1000);
  assert.equal(enemy.hp, 1000 - 2 * s.tune.cards.infantry.damage);
  assert.equal(shooter.hp, 1000 - 2 * s.tune.cards.infantry.damage);
  const lethal = fixture(); const doomed = unit(lethal, '0,0', 0, 'infantry', 1);
  const other = unit(lethal, '1,0', 1, 'infantry', 1); advance(lethal, 100);
  assert.equal(lethal.units.length, 0);
  assert.deepEqual(lethal.shots.map(x => x.unitId), [doomed.id, other.id], 'death cleanup preserves shots already fired');
});

test('shot storage drops oldest events at cap and a fresh simulation resets events and sequence', () => {
  const s = fixture(t => { t.presentation.maxShotEvents = 3; });
  unit(s, '0,0', 0); unit(s, '1,0', 1); advance(s, 1900);
  assert.equal(s.shots.length, 3); assert.deepEqual(s.shots.map(x => x.id), [4, 5, 6]);
  assert.deepEqual(s.shots.map(x => x.timeMs), [1000, 1900, 1900]);
  const fresh = fixture(); assert.deepEqual(fresh.shots, []);
  unit(fresh, '0,0', 0); unit(fresh, '1,0', 1); advance(fresh, 100);
  assert.equal(fresh.shots[0].id, 1);
});

test('movement and blocked movement do not emit shots', () => {
  const s = fixture(); ownAll(s); const mover = unit(s, '0,0', 0); h(s, '2,0').owner = null;
  advance(s, 100); assert(mover.movingUntilMs > s.timeMs); assert.equal(s.shots.length, 0);
  const blocked = fixture(); ownAll(blocked); const waiting = unit(blocked, '0,0', 0);
  for (const n of blocked.neighbors('0,0')) unit(blocked, n.id, 0);
  advance(blocked, 100); assert.equal(waiting.hexId, '0,0'); assert.equal(blocked.shots.length, 0);
});

test('capturer death reverses partial capture slowly to the unchanged original controller', () => {
  for (const owner of [null, 1]) {
    const s = fixture(t => { t.capture.neutralMs = 1000; }); const tile = h(s, '0,0'); tile.owner = owner;
    const capturer = unit(s, '0,0', 0); advance(s, 500);
    const progress = tile.capture; assert(progress > 0); assert.equal(tile.captureUnitId, capturer.id);
    capturer.hp = 0; advance(s, 100);
    const duration = 1000 * (owner === null ? 1 : s.tune.capture.ownedMultiplier);
    assert(Math.abs(tile.capture - (progress - 100 * s.tune.capture.rollbackRate / duration)) < 1e-10);
    assert.equal(tile.owner, owner); assert.equal(tile.captureReversing, true);
    advance(s, 5000); assert.equal(tile.capture, 0); assert.equal(tile.capturePlayer, null);
    assert.equal(tile.owner, owner); assert.equal(tile.captureReversing, undefined);
  }
});

test('living absence does not trigger reversal; replacement capture cancels casualty rollback and attack pauses it', () => {
  const s = fixture(t => { t.capture.neutralMs = 1000; }); const tile = h(s, '0,0');
  const capturer = unit(s, '0,0', 0); advance(s, 500); const before = tile.capture;
  capturer.hexId = '0,3'; capturer.movingUntilMs = 100000; advance(s, 500);
  assert.equal(tile.capture, before); assert.equal(tile.captureReversing, undefined);
  capturer.hp = 0; advance(s, 100); assert(tile.capture < before); assert(tile.captureReversing);
  const resumedAt = tile.capture; const replacement = unit(s, '0,0', 0); replacement.id = 'replacement';
  advance(s, 100); assert(tile.capture > resumedAt); assert.equal(tile.captureReversing, undefined);
  assert.equal(tile.captureUnitId, replacement.id);
  const pausedAt = tile.capture; unit(s, '1,0', 1); advance(s, 200);
  assert(replacement.attacking); assert.equal(tile.capture, pausedAt); assert.equal(tile.captureReversing, undefined);
});

test('artillery has a two-to-three-hex firing band and never retreats solely from proximity', () => {
  assert.equal(DEFAULT_TUNE.cards.artillery.unitHp, 38);
  for (const d of [1, 2, 3, 4]) {
    const s = fixture(t => { t.cards.infantry.range = 0; }); const artillery = unit(s, '0,0', 0, 'artillery', 38);
    unit(s, `${d},0`, 1); advance(s, 100);
    assert.equal(artillery.attacking, d >= 2 && d <= 3);
    assert.equal(s.shots.filter(x => x.unitId === artillery.id).length, d >= 2 && d <= 3 ? 1 : 0);
    assert.equal(artillery.retreatUntilMs, undefined); assert.equal(artillery.hp, 38);
  }
});

test('artillery retreats only after actual damage; a frontline screen prevents that trigger', () => {
  const exposed = fixture(); const gun = unit(exposed, '0,0', 0, 'artillery', 38);
  const threat = unit(exposed, '1,0', 1); threat.nextAttackAtMs = 100000;
  advance(exposed, 100); assert.equal(gun.hexId, '0,0'); assert.equal(gun.retreatUntilMs, undefined);
  threat.nextAttackAtMs = exposed.timeMs; advance(exposed, 100);
  assert.equal(gun.hp, 38 - exposed.tune.cards.infantry.damage); assert(gun.retreatUntilMs > exposed.timeMs);
  assert(distance(h(exposed, gun.hexId), h(exposed, threat.hexId)) > 1); assertOccupancy(exposed);
  const screened = fixture(); const supported = unit(screened, '0,0', 0, 'artillery', 38);
  const screen = unit(screened, '1,0', 0); unit(screened, '2,0', 1); advance(screened, 100);
  assert.equal(supported.hp, 38); assert.equal(supported.retreatUntilMs, undefined);
  assert(screen.hp < screen.maxHp); assert(supported.attacking); assertOccupancy(screened);
});

test('all five weapon types enforce their ground/air target matrix and report target altitude', () => {
  const allowed = { infantry: ['ground', 'air'], tank: ['ground'], artillery: ['ground'], helicopter: ['ground'], fighter: ['air'] };
  for (const kind of Object.keys(allowed)) for (const domain of ['ground', 'air']) {
    const s = fixture(), attacker = unit(s, '0,0', 0, kind);
    const target = unit(s, kind === 'artillery' ? '2,0' : '1,0', 1, domain === 'air' ? 'helicopter' : 'tank');
    target.movingUntilMs = 100000; s.setTarget(0, 1); advance(s, 100);
    const shots = s.shots.filter(x => x.unitId === attacker.id), valid = allowed[kind].includes(domain);
    assert.equal(shots.length, valid ? 1 : 0, `${kind} -> ${domain}`);
    assert.equal(target.hp, valid ? 1000 - s.tune.cards[kind].damage : 1000);
    if (valid) assert.equal(shots[0].targetDomain, domain);
  }
});

test('expansion fills reachable neutral goals in HQ ring order before nearer hostile or distant neutral land', () => {
  const s = fixture(); ownAll(s);
  h(s, '-4,1').owner = null; h(s, '0,1').owner = null; h(s, '1,0').owner = 1;
  const scout = unit(s, '0,0', 0); const initial = distance(h(s, scout.hexId), h(s, '-4,1'));
  advance(s, 100); assert(distance(h(s, scout.hexId), h(s, '-4,1')) < initial);
  assert.notEqual(scout.hexId, '0,1'); assert.notEqual(scout.hexId, '1,0'); assertOccupancy(s);
});

test('both aircraft cost ten, cannot capture, and share spawn occupancy with ground troops', () => {
  for (const kind of ['helicopter', 'fighter']) {
    assert.equal(DEFAULT_TUNE.cards[kind].cost, 10); assert.equal(DEFAULT_TUNE.cards[kind].captureRate, 0);
    const still = fixture(t => { t.cards[kind].captureRate = 100; });
    const aircraft = unit(still, '0,0', 0, kind); aircraft.movingUntilMs = 100000;
    advance(still, 10000); assert.equal(h(still, '0,0').owner, null); assert.equal(h(still, '0,0').capture, 0);
    const s = fixture(); ownAll(s);
    for (const n of s.neighbors('0,0')) unit(s, n.id, 0);
    assert(s.place(0, '0,0', kind).ok);
    const producer = s.buildings.find(b => b.kind === kind); assert.equal(producer.unitId, null, 'ground encirclement blocks aircraft spawning');
    const opened = s.units[0].hexId; s.units[0].hp = 0; advance(s, 100);
    assert(producer.unitId); const spawned = s.units.find(u => u.id === producer.unitId);
    assert.equal(spawned.fromHexId ?? spawned.hexId, opened); assertOccupancy(s);
    assert(!s.placement(0, opened, 'infantry').ok, 'aircraft occupancy blocks building placement');
  }
});

test('air defenders pursue eligible intruders on owned territory and return home after they leave', () => {
  for (const kind of ['helicopter', 'fighter']) {
    const s = fixture(); ownAll(s); h(s, '5,0').owner = 1;
    const defender = unit(s, '-4,0', 0, kind), intruder = unit(s, '0,0', 1, kind === 'fighter' ? 'helicopter' : 'tank');
    intruder.movingUntilMs = 100000; h(s, intruder.hexId).owner = 1;
    advance(s, 100); assert.equal(defender.hexId, '-4,0', 'passive aircraft does not hunt outside its territory');
    h(s, intruder.hexId).owner = 0; advance(s, 100);
    assert(distance(h(s, defender.hexId), h(s, intruder.hexId)) < 4, 'defender moves toward eligible intruder');
    advance(s, 3000); assert(s.shots.some(x => x.unitId === defender.id));
    h(s, intruder.hexId).owner = 1;
    advance(s, 6000); assert(distance(h(s, defender.hexId), h(s, '-5,0')) <= 1, 'defender returns to home ring');
    assertOccupancy(s);
  }
});

test('attack fighters approach the enemy HQ without firing on buildings or ground troops', () => {
  const s = fixture(); const fighter = unit(s, '-4,0', 0, 'fighter');
  const ground = unit(s, '0,0', 1, 'tank'); ground.movingUntilMs = 100000;
  s.setTarget(0, 1);
  for (let i = 0; i < 200; i++) { advance(s, 100); assertOccupancy(s); }
  const hq = s.buildings.find(b => b.id === 'hq1');
  assert(distance(h(s, fighter.hexId), h(s, hq.hexId)) <= s.tune.cards.fighter.range);
  assert.equal(hq.hp, hq.maxHp); assert.equal(ground.hp, ground.maxHp);
  assert(!s.shots.some(x => x.unitId === fighter.id)); assert.equal(fighter.attacking, false);
  const aerial = unit(s, s.neighbors(fighter.hexId).find(n => !s.units.some(u => u.hexId === n.id) && !s.buildings.some(b => b.hexId === n.id)).id, 1, 'helicopter');
  aerial.movingUntilMs = 100000; advance(s, 100);
  assert(s.shots.some(x => x.unitId === fighter.id && x.targetHexId === aerial.hexId && x.targetDomain === 'air'));
});

test('ground troops and buildings block aircraft paths; origins/destinations use one shared reservation set', () => {
  const s = fixture(); ownAll(s);
  const corridor = new Set(['0,0', '-1,0', '-2,0', '-3,0', '-4,0']);
  for (const tile of s.hexes) if (!corridor.has(tile.id) && !s.buildings.some(b => b.hexId === tile.id)) {
    s.buildings.push({ id: `wall-${tile.id}`, hexId: tile.id, owner: 0, kind: 'hq', hp: 1000, maxHp: 1000, readyAtMs: 0, unitId: null });
  }
  const plane = unit(s, '0,0', 0, 'fighter'), blocker = unit(s, '-2,0', 0);
  blocker.movingUntilMs = 100000; advance(s, 100); assert.equal(plane.hexId, '0,0'); assertOccupancy(s);
  blocker.hp = 0; advance(s, 100); assert.equal(plane.hexId, '-1,0'); assertOccupancy(s);
  s.buildings.push({ id: 'barrier', hexId: '-2,0', owner: 0, kind: 'hq', hp: 1000, maxHp: 1000, readyAtMs: 0, unitId: null });
  advance(s, 2000); assert.equal(plane.hexId, '-1,0'); assertOccupancy(s);
});

test('normal bot cycle can build and spawn both aircraft types', () => {
  const tune = structuredClone(DEFAULT_TUNE); tune.hq.hp = 100000;
  const s = new OperationSim({ tune }); ownAll(s, 1);
  const seen = new Set();
  for (let i = 0; i < 1200; i++) {
    advance(s, 100); for (const u of s.units) seen.add(u.kind); assertOccupancy(s);
  }
  assert(seen.has('helicopter')); assert(seen.has('fighter'));
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

test('default construction reserves and blocks immediately, never heals, then spawns with an idle casualty-triggered clock', () => {
  const s = milestone(); ownAll(s); const b = producer(s);
  assert.equal(b.hp, 110); assert.equal(b.completeAtMs, 3000); assert.equal(b.unitId, null);
  assert.equal(s.resources(0).committed, 4); assert.equal(h(s, b.hexId).commitment, 'building');
  assert(!s.placement(0, b.hexId, 'tank').ok);
  b.hp = 65; advance(s, 2900); assert.equal(b.unitId, null);
  advance(s, 100); assert.equal(b.hp, 65); assert(b.unitId);
  const squad = s.units.find(u => u.id === b.unitId);
  assert.deepEqual(squad.members, [8, 8, 8, 8, 8]); assert.equal(squad.hp, 40); assert.equal(squad.maxHp, 40);
  assert.equal(b.readyAtMs, 0); assert.equal(b.cooldownActive, false); assertOccupancy(s);
});

test('unfinished construction is vulnerable and selling/destruction strand only lost assignments', () => {
  for (const sell of [true, false]) {
    const s = milestone(); ownAll(s); const b = producer(s, '0,0', 'tank');
    const supports = s.hexes.filter(x => x.lockedBy === b.id);
    loseSupports(s, supports.filter(x => x.id !== b.hexId).slice(0, 3).map(x => x.id));
    if (sell) assert(s.sell(0, b.id).ok);
    else { b.hp = 0; advance(s, 100); advance(s, s.tune.resources.destroyReleaseMs); }
    assert(!s.buildings.includes(b)); assert.equal(s.units.length, 0);
    assert.equal(s.resources(0).committed, 3); assert.equal(s.resources(0).stranded, 3);
    assert.equal(h(s, b.hexId).burnt, !sell); assert.equal(h(s, b.hexId).lockedBy, null);
    assert(!s.sell(0, 'hq0').ok);
  }
  const attacked = milestone(); ownAll(attacked); const b = producer(attacked);
  const enemy = unit(attacked, '2,0', 1, 'artillery'); enemy.nextAttackAtMs = attacked.timeMs;
  advance(attacked, 100); assert(b.hp < b.maxHp); assert.equal(b.unitId, null);
});

test('research reserves twenty disconnected cells and releases full commitment after losses on cancel or completion', () => {
  for (const complete of [false, true]) {
    const s = milestone(); for (const x of s.hexes) x.owner = null;
    const cells = s.hexes.filter(x => !s.buildings.some(b => b.hexId === x.id) && ((x.q - x.r) % 3 + 3) % 3 === 0).slice(0, 20);
    assert.equal(cells.length, 20); for (const x of cells) x.owner = 0;
    assert(s.startResearch(0).ok); assert.equal(s.resources(0).committed, 20);
    assert.equal(s.players[0].research.completeAtMs, 30000);
    assert(cells.every(x => x.commitment === 'research' && x.lockedBy === 'research-0'));
    loseSupports(s, cells.slice(0, 7).map(x => x.id)); advance(s, 1000);
    assert.equal(s.resources(0).committed, 20); assert.equal(s.resources(0).capacity, 13);
    if (complete) { advance(s, 29000); assert.equal(s.players[0].techTier, 2); }
    else { assert(s.cancelResearch(0).ok); assert.equal(s.players[0].techTier, 1); }
    assert.equal(s.resources(0).committed, 0); assert.equal(s.resources(0).stranded, 0);
    assert.equal(s.players[0].research, null); assert(!s.hexes.some(x => x.lockedBy === 'research-0'));
  }
});

test('research cancellation loses progress; T3 costs twenty for a fresh sixty-second interval', () => {
  const s = milestone(); ownAll(s);
  assert(s.startResearch(0).ok); advance(s, 10000); assert(s.cancelResearch(0).ok);
  assert(s.startResearch(0).ok); assert.equal(s.players[0].research.completeAtMs, 40000);
  advance(s, 30000); assert.equal(s.players[0].techTier, 2); assert(s.startResearch(0).ok);
  assert.equal(s.players[0].research.completeAtMs, 100000); assert.equal(s.resources(0).committed, 20);
  advance(s, 59900); assert.equal(s.players[0].techTier, 2); advance(s, 100);
  assert.equal(s.players[0].techTier, 3); assert.equal(s.resources(0).committed, 0); assert(!s.startResearch(0).ok);
});

test('placement validates base-only loadouts and technology; conversions consume no loadout slots', () => {
  for (const cards of [[], ['infantry', 'infantry'], ['fighter'], ['infantry', 'missile'], ['infantry', 'bomber'], ['unknown']]) {
    assert.throws(() => milestone(() => {}, { loadouts: [cards] }), /Invalid loadout/);
  }
  const s = milestone(() => {}, { loadouts: [['infantry', 'fighter', 'carrier']] }); ownAll(s);
  assert.deepEqual(BASE_CARDS, ['infantry', 'tank', 'artillery', 'helicopter', 'fighter', 'scout', 'gunner', 'flak', 'walker', 'destroyer', 'carrier', 'bunker', 'silo']);
  assert(!s.place(0, '0,0', 'tank').ok); assert(!s.place(0, '0,0', 'fighter').ok);
  assert(!s.place(0, '0,0', 'missile').ok); assert(!s.place(0, '0,0', 'bomber').ok);
  s.players[0].techTier = 2; assert(s.place(0, '0,0', 'fighter').ok);
  assert(!s.place(0, '4,0', 'carrier').ok); s.players[0].techTier = 3; assert(s.place(0, '4,0', 'carrier').ok);
  assert(!s.place(0, '-4,0', 'mlrs').ok);
});

test('Armoury reserves disconnected extra supports, retires squad, preserves HP, completes once without healing', () => {
  const s = milestone(); ownAll(s); const b = producer(s); advance(s, 3000);
  const oldId = b.unitId; b.hp = 51;
  // All immediately surrounding land can be locked; surcharge deliberately uses arbitrary distant cells.
  const openBefore = s.hexes.filter(x => x.lockedBy === null && x.owner === 0 && !s.buildings.some(v => v.hexId === x.id));
  assert(s.upgrade(0, b.id).ok); assert.equal(b.upgradeKind, 'missile'); assert.equal(b.upgradeCompleteAtMs, s.timeMs + 5000);
  assert.equal(s.resources(0).committed, 6); assert.equal(s.units.some(x => x.id === oldId), false);
  assert.equal(s.retirements.at(-1).unitId, oldId); assert.equal(s.reinforcements.length, 0);
  assert(openBefore.slice(0, 2).every(x => x.lockedBy === b.id && x.commitment === 'upgrade'));
  advance(s, 4900); assert.equal(b.unitId, null); assert.equal(b.kind, 'infantry');
  advance(s, 100); assert.equal(b.kind, 'missile'); assert.equal(b.hp, 51); assert.equal(s.resources(0).committed, 6);
  const squad = s.units.find(x => x.id === b.unitId); assert.deepEqual(squad.members, [7, 7, 7, 7, 7]);
  assert.equal(b.readyAtMs, 0); assert.equal(b.cooldownActive, false); assert(!s.canUpgrade(0, b.id).ok); assert(!s.cancelUpgrade(0, b.id).ok);
});

test('cancelled conversion strands captured upgrade supports and starts full base cooldown without restoring retired forces', () => {
  const s = milestone(); ownAll(s); const b = producer(s); advance(s, 3000); const oldId = b.unitId;
  assert(s.upgrade(0, b.id).ok); const extra = s.hexes.filter(x => x.lockedBy === b.id && x.commitment === 'upgrade');
  loseSupports(s, [extra[0].id]); advance(s, 1000); assert(s.cancelUpgrade(0, b.id).ok);
  assert.equal(b.kind, 'infantry'); assert.equal(b.unitId, null); assert.equal(b.readyAtMs, s.timeMs + 8000);
  assert.equal(s.resources(0).committed, 5); assert.equal(s.resources(0).stranded, 1);
  assert.equal(extra[1].lockedBy, null); assert.equal(extra[1].commitment, undefined);
  advance(s, 7900); assert.equal(b.unitId, null); advance(s, 100); assert(b.unitId && b.unitId !== oldId);
  assert.equal(b.readyAtMs, 0); assert.equal(b.cooldownActive, false);
});

test('free Bomber conversion requires T3 and is permanent; sale/destroy during upgrade discounts combined support release', () => {
  const s = milestone(); ownAll(s); s.players[0].techTier = 2; const airfield = producer(s, '0,0', 'fighter'); advance(s, 6000);
  assert(!s.upgrade(0, airfield.id).ok); s.players[0].techTier = 3; airfield.hp = 47;
  assert(s.upgrade(0, airfield.id).ok); assert.equal(s.resources(0).committed, 10); assert.equal(airfield.upgradeCost, 0);
  advance(s, 8000); assert.equal(airfield.kind, 'bomber'); assert.equal(airfield.hp, 47);
  assert(s.units.some(x => x.id === airfield.unitId && x.kind === 'bomber')); assert(!s.canUpgrade(0, airfield.id).ok);
  for (const sell of [true, false]) {
    const t = milestone(); ownAll(t); const b = producer(t); advance(t, 3000); assert(t.upgrade(0, b.id).ok);
    const supports = t.hexes.filter(x => x.lockedBy === b.id); loseSupports(t, supports.filter(x => x.id !== b.hexId).slice(0, 3).map(x => x.id));
    if (sell) assert(t.sell(0, b.id).ok); else { b.hp = 0; advance(t, 100); advance(t, t.tune.resources.destroyReleaseMs); }
    assert.equal(t.resources(0).committed, 3); assert.equal(t.resources(0).stranded, 3);
    assert.equal(h(t, b.hexId).burnt, !sell); assert.equal(t.units.length, 0);
  }
});

test('squad members focus one target; each single-target hit damages one member without spillover', () => {
  const s = fixture(t => { t.cards.tank.damage = 100; t.cards.tank.range = 0; });
  const squad = unit(s, '0,0', 0); squad.members = [8, 8, 8, 8, 8]; squad.hp = 40; squad.maxHp = 40;
  const target = unit(s, '1,0', 1, 'tank'), second = unit(s, '0,1', 1, 'tank'); advance(s, 100);
  assert.equal(target.hp, 990); assert.equal(second.hp, 1000); assert.equal(s.shots.filter(x => x.unitId === squad.id).length, 1);
  squad.members = [8, 8]; squad.hp = 16; squad.nextAttackAtMs = s.timeMs;
  advance(s, 100); assert.equal(target.hp, 986, 'losing three members removes exactly three members of damage');
  assert.equal(second.hp, 1000, 'surviving members retain the same shared focus');
  const t = fixture(); const victim = unit(t, '0,0', 0); victim.members = [3, 8, 8, 8, 8]; victim.hp = 35; victim.maxHp = 40;
  victim.nextAttackAtMs = 100000; unit(t, '1,0', 1, 'tank'); advance(t, 100);
  assert.deepEqual(victim.members, [8, 8, 8, 8]); assert.equal(victim.hp, 32, 'tank overkill does not spill into another member');
});

test('MLRS respects minimum range and splashes multiple enemy members with no friendly damage', () => {
  const s = fixture(); const gun = unit(s, '0,0', 0, 'mlrs');
  const centre = unit(s, '3,0', 1, 'tank'); centre.movingUntilMs = 100000;
  const adjacent = unit(s, '3,1', 1); adjacent.members = [8, 8, 8, 8, 8]; adjacent.hp = 40; adjacent.movingUntilMs = 100000;
  const friend = unit(s, '2,1', 0); friend.movingUntilMs = 100000; advance(s, 100);
  assert.equal(centre.hp, 970); assert.equal(adjacent.hp, 0); assert(!s.units.includes(adjacent)); assert.equal(friend.hp, 1000);
  assert(s.shots.some(x => x.unitId === gun.id));
  const close = fixture(); const nearGun = unit(close, '0,0', 0, 'mlrs'); unit(close, '2,0', 1, 'tank').movingUntilMs = 100000;
  advance(close, 100); assert(!close.shots.some(x => x.unitId === nearGun.id && x.targetHexId === '2,0'));
});

test('reinforcement counts include in-flight members, restart cooldown, and merge full HP without healing survivors', () => {
  const s = milestone(t => { t.reinforcements.minTravelMs = 2000; }); ownAll(s); const b = producer(s); advance(s, 3000);
  const squad = s.units.find(x => x.id === b.unitId); squad.members = [3, 8]; squad.hp = 11; squad.movingUntilMs = 100000;
  b.cooldownActive = true; b.readyAtMs = s.timeMs; advance(s, 100);
  assert.equal(s.reinforcements.length, 1); assert.equal(s.reinforcements[0].count, 3); assert.equal(b.cooldownActive, false);
  b.cooldownActive = true; b.readyAtMs = s.timeMs; advance(s, 100); assert.equal(s.reinforcements.length, 1, 'existing in-flight members prevent over-dispatch');
  advance(s, 1900); assert.deepEqual(squad.members, [3, 8, 8, 8, 8]); assert.equal(squad.hp, 35); assert.equal(s.reinforcements.length, 0);
  squad.members = [3, 8]; squad.hp = 11;
  s.reinforcements.push({ id: 'fixture-arrival', unitId: squad.id, buildingId: b.id, owner: 0, count: 1, fromHexId: b.hexId, startedAtMs: s.timeMs, arriveAtMs: s.timeMs + 10000 });
  b.cooldownActive = true; b.readyAtMs = s.timeMs; advance(s, 100);
  assert.equal(s.reinforcements.reduce((n, r) => n + r.count, 0), 3, 'two living plus one incoming dispatches only two');
  assert.equal(s.units.length, 1); assertOccupancy(s);
});

test('squad wipe deletes every incoming member permanently; producer death still permits merge into a living orphan', () => {
  for (const wipe of [true, false]) {
    const s = milestone(t => { t.reinforcements.minTravelMs = 1000; }); ownAll(s); const b = producer(s); advance(s, 3000);
    const squad = s.units.find(x => x.id === b.unitId); squad.members = [4, 8]; squad.hp = 12; squad.movingUntilMs = 100000;
    b.cooldownActive = true; b.readyAtMs = s.timeMs; advance(s, 100); assert.equal(s.reinforcements[0].count, 3);
    if (wipe) { b.readyAtMs = 100000; squad.hp = 0; }
    else b.hp = 0;
    advance(s, 1000);
    assert.equal(s.reinforcements.length, 0);
    if (wipe) { assert(!s.units.some(x => x.id === squad.id)); assert.equal(s.units.length, 0); }
    else { assert.equal(squad.buildingId, null); assert.deepEqual(squad.members, [4, 8, 8, 8, 8]); assert.equal(squad.hp, 36); }
  }
});

test('upgrade/sale retire current squads and incoming reinforcements, with casualty rollback and bounded cosmetic events', () => {
  for (const sell of [true, false]) {
    const s = milestone(); ownAll(s); const b = producer(s); advance(s, 3000);
    const squad = s.units.find(x => x.id === b.unitId); squad.members = [8]; squad.hp = 8;
    const tile = h(s, squad.hexId); tile.owner = null; tile.capture = 0.5; tile.capturePlayer = 0; tile.captureUnitId = squad.id;
    b.cooldownActive = true; b.readyAtMs = s.timeMs; squad.movingUntilMs = 100000; advance(s, 100); assert(s.reinforcements.length);
    if (sell) assert(s.sell(0, b.id).ok); else assert(s.upgrade(0, b.id).ok);
    assert.equal(s.units.length, 0); assert.equal(s.reinforcements.length, 0); assert(tile.captureReversing);
    assert.equal(s.retirements.at(-1).unitId, squad.id); assert.deepEqual(s.retirements.at(-1).members, [8]);
  }
  const s = fixture(); ownAll(s);
  for (let i = 0; i < 130; i++) { const b = producer(s); assert(s.sell(0, b.id).ok); }
  assert.equal(s.retirements.length, 128); assert.equal(s.retirements[0].id, 3);
  const fresh = milestone(); assert.equal(fresh.retirements.length, 0); assert.equal(fresh.reinforcements.length, 0);
});

test('bot advances technology, skips locked cards, and eventually uses conversions and T3 base cards', () => {
  const tune = structuredClone(DEFAULT_TUNE); tune.hq.hp = 1000000;
  const s = new OperationSim({ tune }); ownAll(s, 1); const seen = new Set();
  for (let i = 0; i < 1800; i++) { advance(s, 100); for (const b of s.buildings) seen.add(b.kind); assertOccupancy(s); }
  assert.equal(s.players[1].techTier, 3); assert(seen.has('missile')); assert(seen.has('helicopter'));
  assert(seen.has('fighter')); assert(seen.has('bomber')); assert(seen.has('mlrs'));
});

test('construction, research, conversion, debt, squads, reinforcements and events remain tick-partition deterministic', () => {
  const run = dt => {
    const tune = structuredClone(DEFAULT_TUNE); tune.hq.hp = 1000000;
    const s = new OperationSim({ tune }); ownAll(s, 1);
    for (let t = 0; t < 180000; t += dt) s.tick(dt);
    return JSON.stringify({ hexes: s.hexes, buildings: s.buildings, units: s.units, players: s.players,
      reinforcements: s.reinforcements, retirements: s.retirements, shots: s.shots,
      pendingReleases: s.pendingReleases, resources: s.players.map(p => s.resources(p.id)), timeMs: s.timeMs, winner: s.winner });
  };
  assert.equal(run(100), run(500));
  const fresh = new OperationSim(); assert.equal(fresh.players[0].techTier, 1); assert.equal(fresh.players[0].research, null);
  assert.equal(fresh.resources(0).stranded, 0); assert.equal(fresh.resources(0).committed, 0);
});

test('eighteen forms, thirteen base cards, eight-card defaults and five permanent upgrade paths are distinct', () => {
  assert.equal(Object.keys(DEFAULT_TUNE.cards).length, 18); assert.equal(BASE_CARDS.length, 13);
  assert.equal(DEFAULT_LOADOUT.length, 8); assert.equal(new Set(DEFAULT_LOADOUT).size, 8);
  assert(DEFAULT_LOADOUT.includes('scout')); assert(!DEFAULT_LOADOUT.includes('gunner')); assert(BASE_CARDS.includes('gunner'));
  assert(!BASE_CARDS.includes('mlrs')); assert.throws(() => milestone(() => {}, { loadouts: [BASE_CARDS.slice(0, 9)] }), /Invalid loadout/);
  for (const [base, upgraded, extra] of [['infantry', 'missile', 2], ['fighter', 'bomber', 0], ['artillery', 'mlrs', 4], ['tank', 'siege', 8], ['helicopter', 'gunship', 2]]) {
    const s = fixture(); ownAll(s); const b = producer(s, '0,0', base); b.hp = 50;
    assert.equal(s.tune.cards[base].upgradeTo, upgraded); assert(s.upgrade(0, b.id).ok);
    assert.equal(b.upgradeCost, extra); advance(s, s.tune.cards[base].upgradeMs);
    assert.equal(b.kind, upgraded); assert.equal(b.hp, 50); assert.equal(s.resources(0).committed, s.tune.cards[upgraded].cost);
    assert(!s.canUpgrade(0, b.id).ok); assert(!BASE_CARDS.includes(upgraded));
  }
  for (const kind of ['bomber', 'mlrs', 'siege', 'carrier']) assert(DEFAULT_TUNE.cards[kind].productionMs >= 24000 && DEFAULT_TUNE.cards[kind].productionMs <= 30000);
  assert.equal(DEFAULT_TUNE.cards.mlrs.minRange, 3); assert.equal(DEFAULT_TUNE.cards.mlrs.cost, 12);
});

test('destruction holds surviving assignments and full commitment for ten seconds, then releases only survivors', () => {
  const s = milestone(); ownAll(s); const b = producer(s, '0,0', 'tank');
  const supports = s.hexes.filter(x => x.lockedBy === b.id);
  loseSupports(s, supports.filter(x => x.id !== b.hexId).slice(0, 3).map(x => x.id));
  b.hp = 0; advance(s, 100);
  const release = s.pendingReleases[0]; assert.equal(release.supportIds.length, 5); assert.equal(release.releaseAtMs, 10100);
  assert.equal(s.resources(0).committed, 8); assert.equal(s.resources(0).stranded, 3);
  const reserved = s.hexes.find(x => x.commitment === 'release' && !x.burnt);
  assert.equal(reserved.releaseAtMs, release.releaseAtMs); assert(!s.placement(0, reserved.id, 'infantry').ok);
  assert(s.startResearch(0).ok); assert(!s.players[0].research.supportIds.includes(reserved.id)); s.cancelResearch(0);
  advance(s, 9900); assert.equal(s.timeMs, 10000); assert.equal(s.resources(0).committed, 8); assert.equal(reserved.commitment, 'release');
  advance(s, 100); assert.equal(s.resources(0).committed, 3); assert.equal(s.pendingReleases.length, 0);
  assert.equal(reserved.lockedBy, null); assert.equal(reserved.releaseAtMs, undefined); assert(s.placement(0, reserved.id, 'infantry').ok);
  const sale = milestone(); ownAll(sale); const selling = producer(sale, '0,0', 'tank');
  loseSupports(sale, sale.hexes.filter(x => x.lockedBy === selling.id && x.id !== selling.hexId).slice(0, 3).map(x => x.id));
  assert(sale.sell(0, selling.id).ok); assert.equal(sale.resources(0).committed, 3); assert.equal(sale.pendingReleases.length, 0);
});

test('enemy capture during delayed release becomes permanent debt and recapture cannot restore its countdown assignment', () => {
  const s = milestone(t => { t.capture.neutralMs = 100; }); ownAll(s); const b = producer(s);
  b.hp = 0; advance(s, 100); const release = s.pendingReleases[0];
  const tile = s.hexes.find(x => x.lockedBy === release.id && !x.burnt);
  const invading = unit(s, tile.id, 1); advance(s, 200);
  assert.equal(tile.owner, 1); assert.equal(tile.lockedBy, null); assert.equal(tile.releaseAtMs, undefined);
  assert.equal(s.resources(0).committed, 4); assert.equal(s.resources(0).stranded, 1); assert.equal(release.supportIds.length, 3);
  invading.hp = 0; advance(s, 100); unit(s, tile.id, 0); advance(s, 200);
  assert.equal(tile.owner, 0); assert.equal(tile.lockedBy, null); assert.equal(tile.commitment, undefined);
  advance(s, release.releaseAtMs - s.timeMs);
  assert.equal(s.pendingReleases.length, 0); assert.equal(s.resources(0).committed, 1); assert.equal(s.resources(0).stranded, 1);
});

test('infantry, missile and gunner capture before retaliating, including when damaged and on attack orders', () => {
  for (const kind of ['infantry', 'missile', 'gunner']) {
    const s = milestone(t => { t.capture.neutralMs = 1000; }); const capturer = unit(s, '0,0', 0, kind);
    unit(s, '2,0', 1, 'artillery'); unit(s, '1,0', 1, 'tank').movingUntilMs = 100000;
    s.setTarget(0, 1); advance(s, 100);
    assert(capturer.hp < 1000); assert.equal(capturer.attacking, false); assert(h(s, '0,0').capture > 0);
    assert(!s.shots.some(x => x.unitId === capturer.id));
    advance(s, 900); assert.equal(h(s, '0,0').owner, 0);
    advance(s, 100); assert(s.shots.some(x => x.unitId === capturer.id), 'combat resumes after ownership is secured');
  }
});

test('other ground captures only while expanding with no hostile unit anywhere on owned territory, including aircraft', () => {
  for (const kind of ['tank', 'artillery', 'scout', 'walker', 'destroyer', 'siege', 'mlrs']) {
    const s = milestone(); ownAll(s); const site = '-2,2'; h(s, site).owner = null;
    const ground = unit(s, site, 0, kind), intruder = unit(s, '-1,2', 1, 'helicopter'); intruder.movingUntilMs = 100000;
    advance(s, 100); assert.equal(h(s, site).capture, 0, `${kind} cannot expand while owned land has an air intruder`);
    intruder.hp = 0; advance(s, 100); assert(h(s, site).capture > 0, `${kind} resumes expansion once territory is clear`);
    const progress = h(s, site).capture; s.setTarget(0, 1); advance(s, 100);
    assert.equal(h(s, site).capture, progress, `${kind} cannot capture on attack orders`); assertOccupancy(s);
  }
});

test('ground defenders seek hostile intruders on owned land before neutral expansion goals', () => {
  const s = milestone(); ownAll(s); h(s, '1,0').owner = null; h(s, '0,0').owner = null;
  const tank = unit(s, '0,0', 0, 'tank'), intruder = unit(s, '-3,0', 1); intruder.movingUntilMs = 100000;
  advance(s, 100); assert(distance(h(s, tank.hexId), h(s, intruder.hexId)) < 3); assert.notEqual(tank.hexId, '1,0');
});

test('new roster domains enforce flak anti-air, walker flexibility, and air-to-ground-only strike forms', () => {
  const matrix = { scout: ['ground'], gunner: ['ground'], flak: ['air'], walker: ['ground', 'air'], destroyer: ['ground'], gunship: ['ground'], siege: ['ground'], carrier: ['ground'] };
  const costs = { scout: 4, gunner: 5, flak: 6, walker: 12, destroyer: 10, gunship: 12, siege: 16, carrier: 18 };
  for (const kind of Object.keys(matrix)) for (const domain of ['ground', 'air']) {
    const s = fixture(), card = s.tune.cards[kind], range = card.minRange;
    assert.equal(card.cost, costs[kind]);
    const attacker = unit(s, '0,0', 0, kind), target = unit(s, `${range},0`, 1, domain === 'air' ? 'fighter' : 'tank');
    target.movingUntilMs = 100000; h(s, target.hexId).owner = 0; advance(s, 100);
    const shot = s.shots.find(x => x.unitId === attacker.id && x.targetHexId === target.hexId);
    assert.equal(!!shot, matrix[kind].includes(domain), `${kind} -> ${domain}`);
    if (shot) assert.equal(shot.targetDomain, domain);
  }
  const squad = milestone(() => {}, { loadouts: [['gunner']] }); ownAll(squad);
  const b = producer(squad, '0,0', 'gunner'); advance(squad, squad.tune.cards.gunner.buildMs);
  assert.equal(squad.units.find(u => u.id === b.unitId).members.length, 5);
});

test('zero-capture flak guards home and pursues aircraft without seeking neutral expansion', () => {
  const s = milestone(); assert.equal(s.tune.cards.flak.captureRate, 0);
  const guard = unit(s, '-4,0', 0, 'flak'); advance(s, 1000);
  assert.equal(guard.hexId, '-4,0'); assert.equal(guard.attacking, false);
  const intruder = unit(s, '-1,0', 1, 'fighter'); h(s, intruder.hexId).owner = 0; intruder.movingUntilMs = 100000;
  advance(s, 100); assert(s.shots.some(x => x.unitId === guard.id && x.targetHexId === intruder.hexId));
  assert.equal(s.hexes.some(h => h.captureUnitId === guard.id), false);
});

test('a T1 infantry squad defeats an unescorted siege vehicle trapped inside its minimum range', () => {
  const s = milestone(t => { t.hq.defenseDamage = 0; }); h(s, '0,0').owner = 0; h(s, '1,0').owner = 0;
  const infantry = unit(s, '0,0', 0, 'infantry', 40); infantry.maxHp = 40; infantry.members = [8, 8, 8, 8, 8];
  const siege = unit(s, '1,0', 1, 'siege', s.tune.cards.siege.unitHp);
  // Tight terrain formed by the siege player's own buildings prevents backing
  // out of the dead zone; the infantry entered through the one open approach.
  for (const tile of s.neighbors(siege.hexId)) if (tile.id !== infantry.hexId) {
    s.buildings.push({ id: `siege-cover-${tile.id}`, hexId: tile.id, owner: 1, kind: 'hq', hp: 100000, maxHp: 100000, readyAtMs: 0, unitId: null });
  }
  for (let i = 0; i < 250 && s.units.includes(siege); i++) { advance(s, 100); assertOccupancy(s); }
  assert(!s.units.includes(siege)); assert(s.units.includes(infantry)); assert.equal(infantry.hp, 40);
  assert(!s.shots.some(shot => shot.unitId === siege.id && shot.targetHexId === infantry.hexId));
  assert(s.tune.cards.infantry.cost < s.tune.cards.siege.cost);
});

test('a fighter intercepts and defeats an unsupported carrier which cannot retaliate against aircraft', () => {
  const s = milestone(); const fighter = unit(s, '0,0', 0, 'fighter', s.tune.cards.fighter.unitHp);
  const carrier = unit(s, '1,0', 1, 'carrier', s.tune.cards.carrier.unitHp); s.setTarget(0, 1);
  for (let i = 0; i < 300 && s.units.includes(carrier); i++) { advance(s, 100); assertOccupancy(s); }
  assert(!s.units.includes(carrier)); assert(s.units.includes(fighter)); assert.equal(fighter.hp, s.tune.cards.fighter.unitHp);
  assert(s.shots.some(shot => shot.unitId === fighter.id && shot.targetDomain === 'air'));
  assert(!s.shots.some(shot => shot.unitId === carrier.id && shot.targetDomain === 'air'));
  assert(s.tune.cards.fighter.cost < s.tune.cards.carrier.cost);
});

test('squad clock starts on first member death, later losses join without reset, and dispatch ends that cycle', () => {
  const s = fixture(t => { t.reinforcements.minTravelMs = 10000; }); ownAll(s); const b = producer(s);
  const squad = s.units.find(u => u.id === b.unitId); squad.movingUntilMs = 100000;
  const attacker = unit(s, '2,0', 1, 'tank'); attacker.nextAttackAtMs = 100000;
  advance(s, 12000); assert.equal(b.cooldownActive, false); assert.equal(s.reinforcements.length, 0);
  attacker.nextAttackAtMs = s.timeMs; advance(s, 100); assert.equal(squad.members.length, 4);
  const start = s.timeMs, deadline = start + s.tune.cards.infantry.productionMs;
  assert.equal(b.readyAtMs, deadline); assert.equal(b.productionStartedAtMs, start);
  advance(s, 1300); assert.equal(squad.members.length, 3); assert.equal(b.readyAtMs, deadline);
  attacker.hp = 0; advance(s, deadline - s.timeMs - 100); assert.equal(s.reinforcements.length, 0);
  advance(s, 100); assert.equal(s.reinforcements[0].count, 2); assert.equal(b.cooldownActive, false);
  const incoming = s.reinforcements[0]; const nextThreat = unit(s, '2,0', 1, 'tank'); advance(s, 100);
  assert.equal(squad.members.length, 2); assert.equal(b.readyAtMs, s.timeMs + 8000);
  assert.equal(incoming.count + squad.members.length, 4); nextThreat.hp = 0;
});

test('nonlethal member damage does not start production, and HQ defense is ground-only with real firing cadence', () => {
  const s = milestone(); const ground = unit(s, '-3,0', 1); ground.movingUntilMs = 100000;
  const air = unit(s, '-4,0', 1, 'fighter'); air.movingUntilMs = 100000;
  advance(s, 100); assert.equal(ground.hp, 995); assert.equal(air.hp, 1000);
  assert(s.shots.some(x => x.unitId === 'hq0' && x.sourceKind === 'hq' && x.targetDomain === 'ground'));
  advance(s, 900); assert.equal(ground.hp, 995); advance(s, 100); assert.equal(ground.hp, 990);
  const wounded = fixture(); ownAll(wounded); const b = producer(wounded); const squad = wounded.units.find(u => u.id === b.unitId);
  squad.movingUntilMs = 100000; wounded.tune.cards.tank.damage = 3; unit(wounded, '2,0', 1, 'tank'); advance(wounded, 100);
  assert.equal(squad.members.length, 5); assert.equal(squad.hp, 37); assert.equal(b.cooldownActive, false);
  const vulnerable = milestone(); const tank = unit(vulnerable, '-4,0', 1, 'tank', 130); vulnerable.setTarget(1, 0); advance(vulnerable, 100);
  assert(vulnerable.buildings.find(b => b.id === 'hq0').hp < 420); assert(tank.hp < 130);
});

test('bunkers wait for completion, defend ground and air, never spawn troops and sell normally', () => {
  const s = milestone(); ownAll(s); const b = producer(s, '0,0', 'bunker');
  const air = unit(s, '1,0', 1, 'fighter'); air.movingUntilMs = 100000;
  const ground = unit(s, '2,0', 1, 'tank'); ground.movingUntilMs = 100000;
  advance(s, 5900); assert.equal(air.hp, 1000); advance(s, 100); assert.equal(air.hp, 992); assert.equal(b.unitId, null);
  assert(!s.units.some(u => u.owner === 0)); assert(s.shots.some(x => x.unitId === b.id && x.sourceKind === 'bunker' && x.targetDomain === 'air'));
  air.hp = 0; advance(s, 1000); assert.equal(ground.hp, 992);
  assert(s.sell(0, b.id).ok); assert.equal(s.resources(0).committed, 0); assert.equal(h(s, b.hexId).burnt, false);
  assert.throws(() => milestone(() => {}, { loadouts: [['bunker', 'silo']] }), /Invalid loadout/);
});

test('silo makes one payload after construction, launch alone restarts its timer, and invalid actions leave readiness intact', () => {
  const s = milestone(); ownAll(s); s.players[0].techTier = 3; const b = producer(s, '0,0', 'silo');
  assert(!s.canLaunchNuke(0, b.id).ok); advance(s, 15000); assert.equal(b.nukeReadyAtMs, 75000); assert.equal(b.unitId, null);
  advance(s, 59900); assert(!s.launchNuke(0, b.id, '0,2').ok); advance(s, 100); assert(s.canLaunchNuke(0, b.id).ok);
  advance(s, 10000); const readyAt = b.nukeReadyAtMs; assert.equal(readyAt, 75000);
  assert(!s.launchNuke(1, b.id, '0,2').ok); assert(!s.launchNuke(0, b.id, '99,99').ok); assert.equal(b.nukeReadyAtMs, readyAt);
  assert(s.launchNuke(0, b.id, '0,2').ok); assert.equal(s.nukeFlights.length, 1); assert.equal(b.nukeReadyAtMs, s.timeMs + 60000);
  assert(!s.launchNuke(0, b.id, '0,2').ok); assert.equal(s.nukeFlights.length, 1);
});

test('nukes hit both factions, all squad members, ground/air and buildings without directly burning empty terrain', () => {
  const s = fixture(t => { t.cards.bunker.damage = 0; }); ownAll(s);
  const outerBuilding = producer(s, '-1,0', 'bunker'); const silo = producer(s, '-4,0', 'silo'); silo.nukeReadyAtMs = 0;
  const centre = unit(s, '0,0', 1, 'tank', 300); centre.movingUntilMs = 100000;
  const friend = unit(s, '1,0', 0, 'fighter', 150); friend.movingUntilMs = 100000;
  const squad = unit(s, '0,1', 1); squad.members = [8, 8, 8, 8, 8]; squad.hp = 40; squad.movingUntilMs = 100000;
  assert(s.launchNuke(0, silo.id, '0,0').ok); advance(s, 7900); assert.equal(centre.hp, 300);
  advance(s, 100); assert.equal(centre.hp, 100); assert.equal(friend.hp, 70); assert(!s.units.includes(squad));
  assert.equal(outerBuilding.hp, 200); assert.equal(h(s, '0,0').burnt, false); assert.equal(h(s, '0,1').burnt, false);
  assert.equal(s.nukeFlights.length, 0); assert.deepEqual(s.nuclearImpacts[0], { id: 1, owner: 0, hexId: '0,0', timeMs: 8000, radius: 1 });
});

test('launched nukes survive silo loss and JSON checkpoint recovery, but owner elimination cancels them', () => {
  for (const eliminate of [false, true]) {
    const s = fixture(); ownAll(s); const b = producer(s, '0,0', 'silo'); b.nukeReadyAtMs = 0;
    assert(s.launchNuke(0, b.id, '3,-3').ok); b.hp = 0; advance(s, 100);
    assert.equal(s.nukeFlights.length, 1);
    const restored = OperationSim.restore(JSON.parse(JSON.stringify(s.checkpoint())));
    if (eliminate) { restored.buildings.find(b => b.id === 'hq0').hp = 0; advance(restored, 100); assert.equal(restored.nukeFlights.length, 0); }
    else { advance(restored, 7900); assert.equal(restored.nuclearImpacts.length, 1); assert.equal(restored.nukeFlights.length, 0); }
  }
});

test('friendly defend targets accept buildings only, move expansion anchors without adding capture aura, and clear on HQ orders or sale', () => {
  const s = fixture(); ownAll(s); const home = producer(s, '0,0', 'bunker'); const scout = unit(s, '0,2', 0, 'scout');
  assert(!s.setDefendTarget(0, scout.id).ok); assert(!s.setDefendTarget(0, 'hq1').ok); assert(!s.setDefendTarget(0, 'missing').ok);
  assert(s.setDefendTarget(0, home.id).ok); assert.equal(s.players[0].targetId, 0); assert.equal(s.players[0].defendTargetId, home.id);
  h(s, '1,1').owner = null; h(s, '-4,1').owner = null;
  advance(s, 100); assert(distance(h(s, scout.hexId), h(s, '1,1')) < 2, 'expansion heads toward the chosen building ring');
  assert.equal(h(s, '-1,0').capture, 0, 'non-HQ building does not project a new capture aura');
  s.setTarget(0, 1); assert.equal(s.players[0].defendTargetId, null);
  assert(s.setDefendTarget(0, home.id).ok); assert(s.sell(0, home.id).ok); assert.equal(s.players[0].defendTargetId, null);
  s.setTarget(0, 0); assert.equal(s.players[0].targetId, 0); assert.equal(s.players[0].defendTargetId, null);
  const aura = milestone(t => { t.capture.neutralMs = 1000; }); ownAll(aura);
  const anchor = producer(aura, '0,0', 'bunker'); advance(aura, 6000); h(aura, '1,0').owner = null;
  assert(aura.setDefendTarget(0, anchor.id).ok); advance(aura, 2000);
  assert.equal(h(aura, '1,0').owner, null); assert.equal(h(aura, '1,0').capture, 0, 'ordinary defend anchor adds no HQ aura even with HQ pressure enabled');
});

test('basic HQ defense holds an unsupported T1 infantry rush and its first kill triggers the supported squad timer', () => {
  const held = milestone(); held.setTarget(1, 0);
  const rush = unit(held, '-4,0', 1, 'infantry', 40); rush.members = [8, 8, 8, 8, 8]; rush.maxHp = 40;
  advance(held, 15000); assert(!held.units.includes(rush)); assert(held.buildings.find(b => b.id === 'hq0').hp > 0);
  assert(held.buildings.find(b => b.id === 'hq0').hp < 420, 'rush can still hurt HQ before being repelled');
  assert(held.shots.some(s => s.unitId === 'hq0' && s.sourceKind === 'hq'));
  const s = milestone(t => { t.capture.hqRate = 0; }); ownAll(s, 1);
  assert(s.place(1, '0,0', 'infantry').ok); advance(s, 3000);
  const b = s.buildings.find(b => b.kind === 'infantry'), squad = s.units.find(u => u.id === b.unitId);
  squad.hexId = '-4,0'; squad.fromHexId = undefined; squad.movingUntilMs = 100000;
  assert.equal(b.cooldownActive, false); advance(s, 100); assert.equal(squad.members.length, 5); assert.equal(b.cooldownActive, false);
  advance(s, 1000); assert.equal(squad.members.length, 4); assert.equal(b.cooldownActive, true);
  assert.equal(b.productionStartedAtMs, s.timeMs); assert.equal(b.readyAtMs, s.timeMs + 8000);
});

test('unit classes are independent of tier/domain, while every producer and HQ is always structure', () => {
  const s = fixture();
  const light = ['infantry', 'missile', 'gunner', 'scout', 'helicopter', 'fighter', 'flak', 'artillery'];
  const armoured = ['tank', 'walker', 'destroyer', 'mlrs', 'gunship', 'siege', 'bomber', 'carrier'];
  for (const kind of light) assert.equal(s.tune.cards[kind].damageClass, 'light');
  for (const kind of armoured) assert.equal(s.tune.cards[kind].damageClass, 'armoured');
  for (const kind of [...light, ...armoured]) {
    const u = unit(s, '0,0', 1, kind); assert.equal(s.targetDamageClass(u), s.tune.cards[kind].damageClass); s.units.splice(0);
    const b = { id: 'class-building', hexId: '0,0', kind, owner: 1, hp: 1000, maxHp: 1000, readyAtMs: 0, unitId: null };
    assert.equal(s.targetDamageClass(b), 'structure', `${kind} producer does not inherit its unit class`);
  }
  assert.equal(s.targetDamageClass(s.buildings[0]), 'structure');
  assert.equal(s.tune.cards.bunker.damageClass, 'structure'); assert.equal(s.tune.cards.silo.damageClass, 'structure');
  const staleTune = structuredClone(DEFAULT_TUNE); delete staleTune.cards.infantry.damageClass;
  assert.throws(() => new OperationSim({ tune: staleTune }), /current tuning/);
});

test('matching bonuses add to each weapon hit and nonmatching classes keep exact base damage', () => {
  const bonuses = { gunner: ['light', 0.5], missile: ['armoured', 2], destroyer: ['armoured', 24], bomber: ['structure', 15], siege: ['structure', 20] };
  for (const [kind, [matching, extra]] of Object.entries(bonuses)) for (const damageClass of ['light', 'armoured', 'structure']) {
    const s = fixture(), card = s.tune.cards[kind], range = card.minRange;
    const attacker = unit(s, '0,0', 0, kind); h(s, '0,0').owner = 0;
    let target;
    if (damageClass === 'structure') {
      target = { id: 'bonus-structure', hexId: `${range},0`, kind: 'tank', owner: 1, hp: 1000, maxHp: 1000, readyAtMs: 100000, completeAtMs: 100000, unitId: null };
      s.buildings.push(target);
    } else { target = unit(s, `${range},0`, 1, damageClass === 'light' ? 'infantry' : 'tank'); target.movingUntilMs = 100000; }
    h(s, target.hexId).owner = 0;
    const expected = card.damage + (damageClass === matching ? extra : 0);
    assert.equal(s.weaponDamage(kind, target), expected); assert.equal(s.weaponDamage(card, target), expected);
    advance(s, 100); assert(s.shots.some(x => x.unitId === attacker.id && x.targetHexId === target.hexId));
    assert.equal(target.hp, 1000 - expected, `${kind} -> ${damageClass}`);
  }
});

test('squad bonuses apply per living member on one shared target, not once per volley', () => {
  for (const [kind, targetKind, expected] of [['missile', 'tank', 30], ['missile', 'infantry', 20], ['gunner', 'infantry', 10], ['gunner', 'tank', 7.5]]) {
    const s = fixture(), squad = unit(s, '0,0', 0, kind); squad.members = Array(5).fill(s.tune.cards[kind].unitHp);
    squad.hp = squad.members.reduce((a, b) => a + b, 0); h(s, '0,0').owner = 0;
    const target = unit(s, '1,0', 1, targetKind); target.movingUntilMs = 100000;
    advance(s, 100); assert.equal(target.hp, 1000 - expected);
    assert.equal(s.shots.filter(x => x.unitId === squad.id).length, 1);
  }
});

test('splash evaluates each recipient class before falloff and retains ground-only and friendly-fire restrictions', () => {
  const s = fixture(t => { t.cards.mlrs.damageBonus = { light: 10, armoured: 20, structure: 30 }; }); ownAll(s);
  const launcher = unit(s, '0,0', 0, 'mlrs'), primary = unit(s, '3,0', 1, 'infantry'); primary.movingUntilMs = 100000;
  const armoured = unit(s, '3,1', 1, 'tank'); armoured.movingUntilMs = 100000;
  const light = unit(s, '4,0', 1, 'gunner'); light.movingUntilMs = 100000;
  const building = { id: 'splash-structure', owner: 1, hexId: '2,0', kind: 'tank', hp: 1000, maxHp: 1000, completeAtMs: 100000, readyAtMs: 100000, unitId: null }; s.buildings.push(building);
  const friendly = unit(s, '2,1', 0, 'tank'); friendly.movingUntilMs = 100000;
  const air = unit(s, '3,-1', 1, 'fighter'); air.movingUntilMs = 100000;
  advance(s, 100); assert(s.shots.some(x => x.unitId === launcher.id && x.targetHexId === primary.hexId));
  assert.equal(primary.hp, 960); assert.equal(armoured.hp, 975); assert.equal(light.hp, 980); assert.equal(building.hp, 970);
  assert.equal(friendly.hp, 1000); assert.equal(air.hp, 1000);
});

test('bonus hits preserve single-member no-spill damage and start casualty cooldown only on an actual member death', () => {
  const s = milestone(t => { t.cards.gunner.buildMs = 0; t.cards.gunner.capturePriority = false; t.hq.defenseDamage = 0; }, { loadouts: [['gunner']] }); ownAll(s);
  const b = producer(s, '0,0', 'gunner'), squad = s.units.find(u => u.id === b.unitId); squad.movingUntilMs = 100000;
  unit(s, '2,0', 1, 'gunner'); advance(s, 900);
  assert.equal(squad.members.length, 5); assert.equal(squad.hp, 29); assert.equal(b.cooldownActive, false);
  advance(s, 400); assert.equal(squad.members.length, 4); assert.equal(squad.hp, 28, 'the overkill point does not spill into the next member');
  const deadline = s.timeMs + 7500; assert.equal(b.readyAtMs, deadline); assert.equal(b.productionStartedAtMs, s.timeMs);
  advance(s, 400); assert.equal(b.readyAtMs, deadline);
});

test('class bonuses never unlock invalid weapon domains and generalists have no tier-based armour reduction', () => {
  const s = fixture(t => { t.cards.destroyer.damageBonus = { light: 9999 }; });
  const destroyer = unit(s, '0,0', 0, 'destroyer'), fighter = unit(s, '2,0', 1, 'fighter'); fighter.movingUntilMs = 100000;
  advance(s, 100); assert(!s.shots.some(x => x.unitId === destroyer.id)); assert.equal(fighter.hp, 1000);
  const target = { ...fighter, kind: 'carrier' }; assert.equal(s.weaponDamage('infantry', target), 2);
  s.tune.cards.carrier.tier = 1; assert.equal(s.weaponDamage('infantry', target), 2);
});

test('HQ/bunker and nuclear damage bypass class bonuses', () => {
  const hq = milestone(t => { t.cards.infantry.damageBonus = { light: 9999 }; });
  const intruder = unit(hq, '-3,0', 1); intruder.movingUntilMs = 100000; advance(hq, 100); assert.equal(intruder.hp, 995);
  const bunker = fixture(t => { t.cards.bunker.damageBonus = { armoured: 9999 }; }); ownAll(bunker); producer(bunker, '0,0', 'bunker');
  const armoured = unit(bunker, '2,0', 1, 'tank'); armoured.movingUntilMs = 100000; advance(bunker, 100); assert.equal(armoured.hp, 992);
  const s = fixture(t => { for (const card of Object.values(t.cards)) card.damageBonus = { light: 9999, armoured: 9999, structure: 9999 }; }); ownAll(s);
  const silo = producer(s, '0,0', 'silo'); silo.nukeReadyAtMs = 0;
  const centre = unit(s, '3,-3', 1, 'tank', 500); centre.movingUntilMs = 100000;
  const outer = unit(s, '4,-3', 0, 'fighter', 500); outer.movingUntilMs = 100000;
  const building = { id: 'nuclear-structure', kind: 'tank', owner: 1, hexId: '2,-3', hp: 500, maxHp: 500, completeAtMs: 100000, readyAtMs: 100000, unitId: null }; s.buildings.push(building);
  assert(s.launchNuke(0, silo.id, centre.hexId).ok); advance(s, 8000);
  assert.equal(centre.hp, 300); assert.equal(outer.hp, 420); assert.equal(building.hp, 420);
});

test('every mobile ground/air form gets exactly 25% speed from its own source hex, never from its destination', () => {
  assert.equal(DEFAULT_TUNE.movement.friendlySpeedMultiplier, 1.25);
  for (const owner of [0, 1]) for (const [kind, card] of Object.entries(DEFAULT_TUNE.cards).filter(([, c]) => !c.utility)) {
    for (const ownership of ['friendly', 'neutral', 'enemy']) {
      const s = fixture(), source = owner === 0 ? '-2,2' : '2,-2';
      h(s, source).owner = ownership === 'friendly' ? owner : ownership === 'neutral' ? null : 1 - owner;
      for (const neighbor of s.neighbors(source)) neighbor.owner = ownership === 'friendly' ? 1 - owner : owner;
      const mover = unit(s, source, owner, kind); s.setTarget(owner, 1 - owner); advance(s, 100);
      assert.equal(mover.fromHexId, source, `${kind}/${owner}/${ownership} actually moves`);
      assert.equal(mover.movedAtMs, 100);
      assert.equal(mover.movingUntilMs - mover.movedAtMs, card.moveMs / (ownership === 'friendly' ? 1.25 : 1), `${kind}/${owner}/${ownership}`);
      assertOccupancy(s);
    }
  }
});

test('ownership flips during a move cannot change its latched arrival, including JSON checkpoint recovery', () => {
  for (const sourceOwner of [0, null, 1]) {
    const s = fixture(), source = '-2,2'; h(s, source).owner = sourceOwner;
    for (const n of s.neighbors(source)) n.owner = sourceOwner === 0 ? 1 : 0;
    const mover = unit(s, source, 0, 'fighter'); s.setTarget(0, 1); advance(s, 100);
    const arrival = mover.movingUntilMs, destination = mover.hexId;
    h(s, source).owner = sourceOwner === 0 ? 1 : 0; h(s, destination).owner = sourceOwner === 0 ? 1 : 0;
    s.tick(50); const recovered = OperationSim.restore(JSON.parse(JSON.stringify(s.checkpoint())));
    const restoredMover = recovered.units.find(u => u.id === mover.id);
    assert.equal(restoredMover.movingUntilMs, arrival);
    while (s.timeMs + 100 < arrival) {
      s.tick(100); recovered.tick(100);
      assert.equal(mover.movingUntilMs, arrival); assert.equal(restoredMover.movingUntilMs, arrival);
      assertOccupancy(s); assertOccupancy(recovered);
    }
    s.tick(100); recovered.tick(100);
    assert.equal(mover.fromHexId, destination, 'the next step samples the newly owned source');
    assert.equal(mover.movingUntilMs - mover.movedAtMs, 450 / (sourceOwner === 0 ? 1 : 1.25));
    assert.deepEqual(recovered.checkpoint(), s.checkpoint());
  }
});

test('retreats and traversable burnt/committed friendly hexes use the same source-owned speed rule', () => {
  for (const sourceOwner of [0, null, 1]) {
    const s = fixture(); ownAll(s); h(s, '0,0').owner = sourceOwner; h(s, '1,0').owner = 1;
    const artillery = unit(s, '0,0', 0, 'artillery', 38); unit(s, '1,0', 1);
    advance(s, 100); assert(artillery.retreatUntilMs > s.timeMs);
    assert.equal(artillery.movingUntilMs - artillery.movedAtMs, 1400 / (sourceOwner === 0 ? 1.25 : 1));
    assertOccupancy(s);
  }
  const s = fixture(); const tile = h(s, '-2,2'); tile.owner = 0; tile.burnt = true; tile.lockedBy = 'fixture-support';
  const mover = unit(s, tile.id, 0, 'fighter'); s.setTarget(0, 1); advance(s, 100);
  assert.equal(mover.movingUntilMs - mover.movedAtMs, 360);
});

test('older v3 tuning without the optional movement rule keeps base speed and remains checkpoint-compatible', () => {
  const s = fixture(t => { delete t.movement; }); const source = '-2,2'; h(s, source).owner = 0;
  const mover = unit(s, source, 0, 'fighter'); s.setTarget(0, 1); advance(s, 100);
  assert.equal(mover.movingUntilMs - mover.movedAtMs, 450);
  const saved = JSON.parse(JSON.stringify(s.checkpoint())); assert.equal(saved.version, 3); assert.equal(saved.tune.movement, undefined);
  const restored = OperationSim.restore(saved); assert.equal(restored.units[0].movingUntilMs, mover.movingUntilMs);
  assert.throws(() => fixture(t => { t.movement.friendlySpeedMultiplier = 0; }), /finite and positive/);
});

test('cheaper advanced producers fit the new real support budgets while upgrade surcharges use total-minus-base costs', () => {
  const costs = { helicopter: 10, fighter: 10, bomber: 10, destroyer: 10, walker: 12, gunship: 12, mlrs: 12, siege: 16, carrier: 18, silo: 24 };
  for (const [kind, cost] of Object.entries(costs)) assert.equal(DEFAULT_TUNE.cards[kind].cost, cost);
  const carrier = milestone(() => {}, { loadouts: [['infantry', 'carrier']] }); carrier.players[0].techTier = 3;
  assert.equal(carrier.resources(0).capacity, 18); const airbase = producer(carrier, '-4,0', 'carrier');
  assert.equal(carrier.resources(0).committed, 18); assert.equal(carrier.hexes.filter(h => h.lockedBy === airbase.id).length, 18);
  const silo = milestone(); silo.players[0].techTier = 3;
  for (let i = 0; i < 6; i++) {
    const next = silo.hexes.find(h => h.owner === null && silo.neighbors(h.id).some(n => n.owner === 0)); assert(next); next.owner = 0;
  }
  assert.equal(silo.resources(0).capacity, 24); const nuclear = producer(silo, '-4,0', 'silo');
  assert.equal(silo.resources(0).committed, 24); assert.equal(silo.hexes.filter(h => h.lockedBy === nuclear.id).length, 24);
  assert.equal(nuclear.completeAtMs - silo.timeMs, 15000); assert.equal(silo.tune.cards.silo.productionMs, 60000);
  assert.deepEqual(DEFAULT_TUNE.research, { cost: 20, tier2Ms: 30000, tier3Ms: 60000 });
  assert.equal(DEFAULT_TUNE.movement.friendlySpeedMultiplier, 1.25);
});

test('180 HP tank survives two anti-armour destroyer hits but still loses to a third; tank fire remains 1300ms', () => {
  const s = fixture(), destroyer = unit(s, '0,0', 0, 'destroyer');
  const tank = unit(s, '2,0', 1, 'tank', s.tune.cards.tank.unitHp); tank.movingUntilMs = 100000;
  assert.equal(tank.hp, 180); advance(s, 100); assert.equal(tank.hp, 108);
  advance(s, 1900); assert.equal(tank.hp, 108); advance(s, 100); assert.equal(tank.hp, 36); assert(s.units.includes(tank));
  advance(s, 2000); assert(!s.units.includes(tank)); assert(s.units.includes(destroyer));
  const firing = fixture(), attacker = unit(firing, '0,0', 0, 'tank'), victim = unit(firing, '1,0', 1, 'scout'); victim.movingUntilMs = 100000;
  advance(firing, 100); assert.equal(victim.hp, 977); assert.equal(attacker.nextAttackAtMs, 1400);
  advance(firing, 1200); assert.equal(victim.hp, 977); advance(firing, 100); assert.equal(victim.hp, 954);
});

test('scout chip damage now needs three hits per fresh infantry member without changing scout speed or weapon cadence', () => {
  const s = fixture(), scout = unit(s, '0,0', 0, 'scout'), victim = unit(s, '1,0', 1, 'infantry', 40);
  victim.members = [8, 8, 8, 8, 8]; victim.movingUntilMs = 100000;
  advance(s, 100); assert.equal(victim.members[0], 5); advance(s, 700); assert.equal(victim.members[0], 2);
  assert.equal(victim.members.length, 5); advance(s, 700); assert.deepEqual(victim.members, [8, 8, 8, 8]); assert.equal(victim.hp, 32);
  assert.equal(scout.nextAttackAtMs, s.timeMs + 700);
  assert.equal(s.tune.cards.scout.moveMs, 350); assert.equal(s.tune.cards.scout.productionMs, 7000); assert.equal(s.tune.cards.infantry.productionMs, 8000);
});

test('field artillery wipes a central five-member squad, chips adjacent members at 35%, and preserves domains, cadence and minimum range', () => {
  const s = fixture(), gun = unit(s, '0,0', 0, 'artillery', 38);
  const centre = unit(s, '2,0', 1, 'infantry', 40); centre.members = [8, 8, 8, 8, 8]; centre.movingUntilMs = 100000;
  const infantry = unit(s, '3,0', 1, 'infantry', 40); infantry.members = [8, 8, 8, 8, 8]; infantry.movingUntilMs = 100000;
  const missile = unit(s, '2,1', 1, 'missile', 35); missile.members = [7, 7, 7, 7, 7]; missile.movingUntilMs = 100000;
  const tank = unit(s, '3,-1', 1, 'tank', 180); tank.movingUntilMs = 100000;
  const friendly = unit(s, '1,1', 0, 'tank', 180); friendly.movingUntilMs = 100000;
  const air = unit(s, '2,-1', 1, 'fighter', 60); air.movingUntilMs = 100000;
  const tooClose = unit(s, '1,0', 1, 'tank'); tooClose.movingUntilMs = 100000;
  advance(s, 100); assert(!s.units.includes(centre)); assert.equal(centre.hp, 0);
  for (const hp of infantry.members) assert(Math.abs(hp - 1.35) < 1e-10);
  for (const hp of missile.members) assert(Math.abs(hp - 0.35) < 1e-10);
  assert(Math.abs(tank.hp - 173.35) < 1e-10); assert(Math.abs(tooClose.hp - 993.35) < 1e-10, 'splash can reach the dead zone without aiming inside it');
  assert.equal(friendly.hp, 180); assert.equal(air.hp, 60); assert.equal(gun.hp, 38);
  assert.equal(s.shots.find(x => x.unitId === gun.id).targetHexId, '2,0'); assert.equal(gun.nextAttackAtMs, 1900);
  advance(s, 1700); assert.equal(s.shots.filter(x => x.unitId === gun.id).length, 1);
  advance(s, 100); assert.equal(s.shots.filter(x => x.unitId === gun.id).at(-1).timeMs, 1900);
  assert(!s.shots.some(x => x.unitId === gun.id && x.targetHexId === tooClose.hexId));
  assert.equal(s.tune.cards.artillery.damage, 19); assert.equal(s.tune.cards.artillery.minRange, 2);
  assert.equal(s.tune.cards.artillery.productionMs, 14000); assert.equal(s.tune.cards.artillery.buildMs, 0, 'legacy fixture only disables construction');
});

test('stronger bunker still takes ordinary damage and is destructible by sustained ground armour', () => {
  const s = fixture(); ownAll(s); const b = producer(s, '0,0', 'bunker'), attacker = unit(s, '1,0', 1, 'tank');
  assert.equal(b.hp, 280); advance(s, 100); assert.equal(b.hp, 257); assert.equal(attacker.hp, 992);
  advance(s, 14300); assert.equal(b.hp, 4); assert(s.buildings.includes(b));
  advance(s, 1300); assert(!s.buildings.includes(b)); assert(h(s, b.hexId).burnt); assert(s.units.includes(attacker));
});

console.log(`${passed} Operation C simulation behavior tests passed.`);
