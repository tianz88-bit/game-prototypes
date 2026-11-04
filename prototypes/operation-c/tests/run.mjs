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
let passed = 0, failed = 0;
function test(name, run) { try { run(); passed++; console.log(`PASS ${name}`); } catch (error) { failed++; console.error(`FAIL ${name}: ${error.message} ${error.stack?.split('\n').find(line => line.includes('/tests/run.mjs:')) ?? ''}`); } }
function fixture(edit = () => {}) {
  const tune = structuredClone(DEFAULT_TUNE);
  tune.capture.hqRate = 0;
  tune.hq.defenseDamage = 0;
  // Legacy unit/economy fixtures isolate military rules from the new worker economy.
  tune.hq.workerLimit = 0; tune.hq.captureRings = 2; tune.hq.workerGatherRadius = 9;
  tune.resources.destroyReleaseMs = 0;
  // Legacy movement/combat fixtures isolate those rules from construction/tier timing.
  for (const card of Object.values(tune.cards)) { card.buildMs = 0; card.capturePriority = false; }
  edit(tune);
  // Older isolated fixtures acquire only within their weapon band; full sight
  // and local engagement scenarios use milestone() with the live sight tuning.
  for (const card of Object.values(tune.cards)) card.sightRange = card.range;
  const s = new OperationSim({ tune, bot: false, loadouts: [['infantry', 'tank', 'artillery', 'helicopter', 'fighter', 'bunker', 'silo']] }); for (const p of s.players) p.techTier = 3;
  for (const b of s.buildings) if (b.kind === 'hq') b.hqLevel = 3;
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
  const tune = structuredClone(DEFAULT_TUNE); tune.capture.hqRate = 0; tune.hq.workerLimit = 0; tune.hq.captureRings = 2; edit(tune);
  return new OperationSim({ tune, bot: false, loadouts: [['infantry', 'tank', 'artillery', 'helicopter', 'fighter', 'bunker', 'silo']], ...options });
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
  advance(s, 100); assert(b.unitId); const spawned = s.units.find(x => x.id === b.unitId); assert.equal(spawned.fromHexId ?? spawned.hexId, opened);
  assertOccupancy(s);
});

test('capture pauses during own attack, retains progress, continues under unanswered ranged fire', () => {
  const s = fixture(t => { t.capture.neutralMs = 1000; t.cards.artillery.attackMs = 100; t.cards.artillery.damage = 1; });
  const victim = unit(s, '0,0', 0); unit(s, '2,0', 1, 'artillery');
  h(s, '0,0').owner = 1;
  advance(s, 100); assert(victim.hp < 1000); assert.equal(victim.attacking, false); assert(h(s, '0,0').capture > 0);
  const progress = h(s, '0,0').capture;
  const closeEnemy = unit(s, '1,0', 1); advance(s, 100);
  assert(victim.attacking); assert.equal(h(s, '0,0').capture, progress);
  closeEnemy.hp = 0; advance(s, 100);
  assert.equal(victim.attacking, false); assert(h(s, '0,0').capture > progress);
});

test('ground moves across burnt/locked tiles but cannot cross allied or enemy buildings', () => {
  const s = fixture(); ownAll(s);
  const corridor = new Set(['-2,0', '-1,0', '0,0', '1,0', '2,0']);
  // Buildings seal every alternative route. This is a fixture, not a placement command.
  for (const x of s.hexes) if (!corridor.has(x.id) && !s.buildings.some(b => b.hexId === x.id)) {
    s.buildings.push({ id: `wall-${x.id}`, hexId: x.id, owner: 0, kind: 'bunker', hp: 1000, maxHp: 1000, readyAtMs: 0, unitId: null });
  }
  const u = unit(s, '-2,0', 0, 'worker'); h(s, '-1,0').burnt = true; h(s, '-1,0').lockedBy = 'fixture'; h(s, '2,0').owner = null;
  advance(s, 100); assert.equal(u.hexId, '-1,0'); assertOccupancy(s);
  s.buildings.push({ id: 'barrier', hexId: '0,0', owner: 0, kind: 'bunker', hp: 1000, maxHp: 1000, readyAtMs: 0, unitId: null });
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
    const capturer = unit(s, '0,0', 0, owner === null ? 'worker' : 'infantry'); advance(s, 500);
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
  tile.owner = 1;
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
  for (const d of [1, 2, 3, 4, 5]) {
    const s = fixture(t => { t.cards.infantry.range = 0; }); const artillery = unit(s, '0,0', 0, 'artillery', 38);
    unit(s, `${d},0`, 1); advance(s, 100);
    assert.equal(artillery.attacking, d >= 2 && d <= 3);
    assert.equal(s.shots.filter(x => x.unitId === artillery.id).length, d >= 2 && d <= 3 ? 1 : 0);
    assert.equal(artillery.retreatUntilMs, undefined); assert.equal(artillery.hp, 38);
  }
});

test('artillery retreats only after actual damage; a frontline screen prevents that trigger', () => {
  const exposed = fixture(); const gun = unit(exposed, '0,0', 0, 'artillery', 38);
  // Finish a movement segment on the damage step so normal homeward defense
  // movement cannot carry the now non-capturing gun away from this fixture.
  gun.movingUntilMs = 200;
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

test('both aircraft cost eight, cannot capture, and share spawn occupancy with ground troops', () => {
  for (const kind of ['helicopter', 'fighter']) {
    assert.equal(DEFAULT_TUNE.cards[kind].cost, 8); assert.equal(DEFAULT_TUNE.cards[kind].captureRate, 0);
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

test('air defenders acquire eligible enemies only within individual sight across territory and return home after losing sight', () => {
  for (const kind of ['helicopter', 'fighter']) {
    const s = milestone(); ownAll(s); h(s, '5,0').owner = 1;
    const defender = unit(s, '-4,0', 0, kind), intruder = unit(s, '0,0', 1, kind === 'fighter' ? 'helicopter' : 'tank');
    intruder.movingUntilMs = 100000;
    advance(s, 100); assert.equal(defender.hexId, '-4,0', 'distant intruder on owned land is outside individual sight');
    intruder.hexId = '-1,0'; h(s, intruder.hexId).owner = 1; advance(s, 100);
    assert(distance(h(s, defender.hexId), h(s, intruder.hexId)) < 3, 'defender pursues a visible enemy on hostile land');
    advance(s, 3000); assert(s.shots.some(x => x.unitId === defender.id));
    intruder.hexId = '4,3';
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
    s.buildings.push({ id: `wall-${tile.id}`, hexId: tile.id, owner: 0, kind: 'bunker', hp: 1000, maxHp: 1000, readyAtMs: 0, unitId: null });
  }
  const plane = unit(s, '0,0', 0, 'fighter'), blocker = unit(s, '-2,0', 0);
  blocker.movingUntilMs = 100000; advance(s, 100); assert.equal(plane.hexId, '0,0'); assertOccupancy(s);
  blocker.hp = 0; advance(s, 100); assert.equal(plane.hexId, '-1,0'); assertOccupancy(s);
  s.buildings.push({ id: 'barrier', hexId: '-2,0', owner: 0, kind: 'bunker', hp: 1000, maxHp: 1000, readyAtMs: 0, unitId: null });
  advance(s, 2000); assert.equal(plane.hexId, '-1,0'); assertOccupancy(s);
});

test('default construction reserves and blocks immediately, never heals, then spawns with an idle casualty-triggered clock', () => {
  const s = milestone(); ownAll(s); const b = producer(s);
  assert.equal(b.hp, 110); assert.equal(b.completeAtMs, 3000); assert.equal(b.unitId, null);
  assert.equal(s.resources(0).committed, 5); assert.equal(h(s, b.hexId).commitment, 'building');
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

test('research reserves sixteen disconnected cells and releases full commitment after losses on cancel or completion', () => {
  for (const complete of [false, true]) {
    const s = milestone(); for (const x of s.hexes) x.owner = null;
    const cells = s.hexes.filter(x => !s.buildings.some(b => b.hexId === x.id) && ((x.q - x.r) % 3 + 3) % 3 === 0).slice(0, 16);
    assert.equal(cells.length, 16); for (const x of cells) x.owner = 0;
    assert(s.startResearch(0).ok); assert.equal(s.resources(0).committed, 16);
    assert.equal(s.players[0].research.completeAtMs, 30000);
    assert(cells.every(x => x.commitment === 'research' && x.lockedBy === 'research-0'));
    loseSupports(s, cells.slice(0, 7).map(x => x.id)); advance(s, 1000);
    assert.equal(s.resources(0).committed, 16); assert.equal(s.resources(0).capacity, 9);
    if (complete) { advance(s, 29000); assert.equal(s.players[0].techTier, 2); }
    else { assert(s.cancelResearch(0).ok); assert.equal(s.players[0].techTier, 1); }
    assert.equal(s.resources(0).committed, 0); assert.equal(s.resources(0).stranded, 0);
    assert.equal(s.players[0].research, null); assert(!s.hexes.some(x => x.lockedBy === 'research-0'));
  }
});

test('research cancellation loses progress; T3 costs sixteen for a fresh sixty-second interval', () => {
  const s = milestone(); ownAll(s);
  assert(s.startResearch(0).ok); advance(s, 10000); assert(s.cancelResearch(0).ok);
  assert(s.startResearch(0).ok); assert.equal(s.players[0].research.completeAtMs, 40000);
  advance(s, 30000); assert.equal(s.players[0].techTier, 2); assert(s.startResearch(0).ok);
  assert.equal(s.players[0].research.completeAtMs, 100000); assert.equal(s.resources(0).committed, 16);
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
  assert.equal(s.resources(0).committed, 7); assert.equal(s.units.some(x => x.id === oldId), false);
  assert.equal(s.retirements.at(-1).unitId, oldId); assert.equal(s.reinforcements.length, 0);
  assert(openBefore.slice(0, 2).every(x => x.lockedBy === b.id && x.commitment === 'upgrade'));
  advance(s, 4900); assert.equal(b.unitId, null); assert.equal(b.kind, 'infantry');
  advance(s, 100); assert.equal(b.kind, 'missile'); assert.equal(b.hp, 51); assert.equal(s.resources(0).committed, 7);
  const squad = s.units.find(x => x.id === b.unitId); assert.deepEqual(squad.members, [7, 7, 7, 7, 7]);
  assert.equal(b.readyAtMs, 0); assert.equal(b.cooldownActive, false); assert(!s.canUpgrade(0, b.id).ok); assert(!s.cancelUpgrade(0, b.id).ok);
});

test('cancelled conversion strands captured upgrade supports and starts full base cooldown without restoring retired forces', () => {
  const s = milestone(); ownAll(s); const b = producer(s); advance(s, 3000); const oldId = b.unitId;
  assert(s.upgrade(0, b.id).ok); const extra = s.hexes.filter(x => x.lockedBy === b.id && x.commitment === 'upgrade');
  loseSupports(s, [extra[0].id]); advance(s, 1000); assert(s.cancelUpgrade(0, b.id).ok);
  assert.equal(b.kind, 'infantry'); assert.equal(b.unitId, null); assert.equal(b.readyAtMs, s.timeMs + 8000);
  assert.equal(s.resources(0).committed, 6); assert.equal(s.resources(0).stranded, 1);
  assert.equal(extra[1].lockedBy, null); assert.equal(extra[1].commitment, undefined);
  advance(s, 7900); assert.equal(b.unitId, null); advance(s, 100); assert(b.unitId && b.unitId !== oldId);
  assert.equal(b.readyAtMs, 0); assert.equal(b.cooldownActive, false);
});

test('squad members focus one target; each single-target hit damages one member without spillover', () => {
  const s = fixture(t => { t.cards.tank.damage = 100; t.cards.tank.range = 0; });
  const squad = unit(s, '0,0', 0); squad.members = [8, 8, 8, 8, 8]; squad.hp = 40; squad.maxHp = 40;
  const target = unit(s, '1,0', 1, 'tank'), second = unit(s, '0,1', 1, 'tank'); target.movingUntilMs = second.movingUntilMs = 100000; advance(s, 100);
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

test('destruction holds surviving assignments and full commitment for ten seconds, then releases only survivors', () => {
  const s = milestone(); ownAll(s); const b = producer(s, '0,0', 'tank');
  const supports = s.hexes.filter(x => x.lockedBy === b.id);
  loseSupports(s, supports.filter(x => x.id !== b.hexId).slice(0, 3).map(x => x.id));
  b.hp = 0; advance(s, 100);
  const release = s.pendingReleases[0]; assert.equal(release.supportIds.length, 4); assert.equal(release.releaseAtMs, 10100);
  assert.equal(s.resources(0).committed, 7); assert.equal(s.resources(0).stranded, 3);
  const reserved = s.hexes.find(x => x.commitment === 'release' && !x.burnt);
  assert.equal(reserved.releaseAtMs, release.releaseAtMs); assert(!s.placement(0, reserved.id, 'infantry').ok);
  assert(s.startResearch(0).ok); assert(!s.players[0].research.supportIds.includes(reserved.id)); s.cancelResearch(0);
  advance(s, 9900); assert.equal(s.timeMs, 10000); assert.equal(s.resources(0).committed, 7); assert.equal(reserved.commitment, 'release');
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
  assert.equal(s.resources(0).committed, 5); assert.equal(s.resources(0).stranded, 1); assert.equal(release.supportIds.length, 4);
  invading.hp = 0; advance(s, 100); unit(s, tile.id, 0); advance(s, 200);
  assert.equal(tile.owner, 0); assert.equal(tile.lockedBy, null); assert.equal(tile.commitment, undefined);
  advance(s, release.releaseAtMs - s.timeMs);
  assert.equal(s.pendingReleases.length, 0); assert.equal(s.resources(0).committed, 1); assert.equal(s.resources(0).stranded, 1);
});

test('infantry, missile and gunner capture before retaliating, including when damaged and on attack orders', () => {
  for (const kind of ['infantry', 'missile', 'gunner']) {
    const s = milestone(t => { t.capture.neutralMs = 1000; }); const capturer = unit(s, '0,0', 0, kind);
    h(s, '0,0').owner = 1;
    unit(s, '2,0', 1, 'artillery'); unit(s, '1,0', 1, 'tank').movingUntilMs = 100000;
    s.setTarget(0, 1); advance(s, 100);
    assert(capturer.hp < 1000); assert.equal(capturer.attacking, false); assert(h(s, '0,0').capture > 0);
    assert(!s.shots.some(x => x.unitId === capturer.id));
    advance(s, 1400); assert.equal(h(s, '0,0').owner, 0);
    advance(s, 100); assert(s.shots.some(x => x.unitId === capturer.id), 'combat resumes after ownership is secured');
  }
});

test('ground defenders seek hostile intruders on owned land before neutral expansion goals', () => {
  const s = milestone(); ownAll(s); h(s, '1,0').owner = null; h(s, '0,0').owner = null;
  const tank = unit(s, '0,0', 0, 'tank'), intruder = unit(s, '-3,0', 1); intruder.movingUntilMs = 100000;
  advance(s, 100); assert(distance(h(s, tank.hexId), h(s, intruder.hexId)) < 3); assert.notEqual(tank.hexId, '1,0');
});

test('new roster domains enforce flak anti-air, walker flexibility, and air-to-ground-only strike forms', () => {
  const matrix = { scout: ['ground'], gunner: ['ground'], flak: ['air'], walker: ['ground', 'air'], destroyer: ['ground'], gunship: ['ground'], siege: ['ground'], carrier: ['ground'] };
  const costs = { scout: 8, gunner: 6, flak: 5, walker: 10, destroyer: 8, gunship: 10, siege: 13, carrier: 15 };
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
    s.buildings.push({ id: `siege-cover-${tile.id}`, hexId: tile.id, owner: 1, kind: 'tank', hp: 100000, maxHp: 100000, readyAtMs: 0, unitId: 'fixture-no-spawn' });
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
  advance(s, 100); assert.equal(ground.hp, 992); assert.equal(air.hp, 1000);
  assert(s.shots.some(x => x.unitId === 'hq0' && x.sourceKind === 'hq' && x.targetDomain === 'ground'));
  advance(s, 900); assert.equal(ground.hp, 992); advance(s, 100); assert.equal(ground.hp, 984);
  const wounded = fixture(); ownAll(wounded); const b = producer(wounded); const squad = wounded.units.find(u => u.id === b.unitId);
  squad.movingUntilMs = 100000; wounded.tune.cards.tank.damage = 3; unit(wounded, '2,0', 1, 'tank'); advance(wounded, 100);
  assert.equal(squad.members.length, 5); assert.equal(squad.hp, 37); assert.equal(b.cooldownActive, false);
  const vulnerable = milestone(); const tank = unit(vulnerable, '-4,0', 1, 'tank', 130); vulnerable.setTarget(1, 0); advance(vulnerable, 100);
  assert(vulnerable.buildings.find(b => b.id === 'hq0').hp < 650); assert(tank.hp < 130);
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

test('basic HQ defense holds an unsupported T1 infantry rush and its first kill triggers the supported squad timer', () => {
  const held = milestone(); held.setTarget(1, 0);
  const rush = unit(held, '-4,0', 1, 'infantry', 40); rush.members = [8, 8, 8, 8, 8]; rush.maxHp = 40;
  advance(held, 15000); assert(!held.units.includes(rush)); assert(held.buildings.find(b => b.id === 'hq0').hp > 0);
  assert.equal(held.buildings.find(b => b.id === 'hq0').hp, 650, 'HQ repels the lone capture-first rush before six-second enemy capture finishes');
  assert(held.shots.some(s => s.unitId === 'hq0' && s.sourceKind === 'hq'));
  const s = milestone(t => { t.capture.hqRate = 0; }); ownAll(s, 1);
  assert(s.place(1, '0,0', 'infantry').ok); advance(s, 3000);
  const b = s.buildings.find(b => b.kind === 'infantry'), squad = s.units.find(u => u.id === b.unitId);
  squad.hexId = '-4,0'; squad.fromHexId = undefined; squad.movingUntilMs = 100000;
  assert.equal(b.cooldownActive, false); advance(s, 100); assert.equal(squad.members.length, 4); assert.equal(b.cooldownActive, true);
  const firstKillAt = s.timeMs; advance(s, 1000); assert.equal(squad.members.length, 3); assert.equal(b.cooldownActive, true);
  assert.equal(b.productionStartedAtMs, firstKillAt); assert.equal(b.readyAtMs, firstKillAt + 8000);
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
  const intruder = unit(hq, '-3,0', 1); intruder.movingUntilMs = 100000; advance(hq, 100); assert.equal(intruder.hp, 992);
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
      const s = fixture(t => { t.cards[kind].captureRate = 0; }), source = owner === 0 ? '-2,2' : '2,-2';
      h(s, source).owner = ownership === 'friendly' ? owner : ownership === 'neutral' ? null : 1 - owner;
      for (const neighbor of s.neighbors(source)) neighbor.owner = ownership === 'friendly' ? (kind === 'worker' ? null : 1 - owner) : owner;
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
    assert.equal(mover.movingUntilMs - mover.movedAtMs, s.tune.cards.fighter.moveMs / (sourceOwner === 0 ? 1 : 1.25));
    assert.deepEqual(recovered.checkpoint(), s.checkpoint());
  }
});

test('retreats and traversable burnt/committed friendly hexes use the same source-owned speed rule', () => {
  for (const sourceOwner of [0, null, 1]) {
    const s = fixture(); ownAll(s); h(s, '0,0').owner = sourceOwner; h(s, '1,0').owner = 1;
    const artillery = unit(s, '0,0', 0, 'artillery', 38); unit(s, '1,0', 1);
    advance(s, 100); assert(artillery.retreatUntilMs > s.timeMs);
    assert.equal(artillery.movingUntilMs - artillery.movedAtMs, s.tune.cards.artillery.moveMs / (sourceOwner === 0 ? 1.25 : 1));
    assertOccupancy(s);
  }
  const s = fixture(); const tile = h(s, '-2,2'); tile.owner = 0; tile.burnt = true; tile.lockedBy = 'fixture-support';
  const mover = unit(s, tile.id, 0, 'fighter'); s.setTarget(0, 1); advance(s, 100);
  assert.equal(mover.movingUntilMs - mover.movedAtMs, s.tune.cards.fighter.moveMs / 1.25);
});

test('v7 custom tuning without the optional movement rule keeps base speed and remains checkpoint-compatible', () => {
  const s = fixture(t => { delete t.movement; }); const source = '-2,2'; h(s, source).owner = 0;
  const mover = unit(s, source, 0, 'fighter'); s.setTarget(0, 1); advance(s, 100);
  assert.equal(mover.movingUntilMs - mover.movedAtMs, s.tune.cards.fighter.moveMs);
  const saved = JSON.parse(JSON.stringify(s.checkpoint())); assert.equal(saved.version, 7); assert.equal(saved.tune.movement, undefined);
  const restored = OperationSim.restore(saved); assert.equal(restored.units[0].movingUntilMs, mover.movingUntilMs);
  assert.throws(() => fixture(t => { t.movement.friendlySpeedMultiplier = 0; }), /finite and positive/);
});

test('cheaper advanced producers fit the new real support budgets while upgrade surcharges use total-minus-base costs', () => {
  const costs = { helicopter: 8, fighter: 8, bomber: 8, destroyer: 8, walker: 10, gunship: 10, mlrs: 10, siege: 13, carrier: 15, silo: 20 };
  for (const [kind, cost] of Object.entries(costs)) assert.equal(DEFAULT_TUNE.cards[kind].cost, cost);
  const carrier = milestone(() => {}, { loadouts: [['infantry', 'carrier']] }); carrier.players[0].techTier = 3;
  assert.equal(carrier.resources(0).capacity, 18); const airbase = producer(carrier, '-4,0', 'carrier');
  assert.equal(carrier.resources(0).committed, 15); assert.equal(carrier.hexes.filter(h => h.lockedBy === airbase.id).length, 15);
  const silo = milestone(); silo.players[0].techTier = 3;
  for (let i = 0; i < 2; i++) {
    const next = silo.hexes.find(h => h.owner === null && silo.neighbors(h.id).some(n => n.owner === 0)); assert(next); next.owner = 0;
  }
  assert.equal(silo.resources(0).capacity, 20); const nuclear = producer(silo, '-4,0', 'silo');
  assert.equal(silo.resources(0).committed, 20); assert.equal(silo.hexes.filter(h => h.lockedBy === nuclear.id).length, 20);
  assert.equal(nuclear.completeAtMs - silo.timeMs, 15000); assert.equal(silo.tune.cards.silo.productionMs, 60000);
  assert.deepEqual(DEFAULT_TUNE.research, { cost: 16, tier2Ms: 30000, tier3Ms: 60000 });
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

test('scout chip damage now needs three hits per fresh infantry member with balanced travel/replacement and unchanged weapon cadence', () => {
  const s = fixture(), scout = unit(s, '0,0', 0, 'scout'), victim = unit(s, '1,0', 1, 'infantry', 40);
  victim.members = [8, 8, 8, 8, 8]; victim.movingUntilMs = 100000;
  advance(s, 100); assert.equal(victim.members[0], 5); advance(s, 700); assert.equal(victim.members[0], 2);
  assert.equal(victim.members.length, 5); advance(s, 700); assert.deepEqual(victim.members, [8, 8, 8, 8]); assert.equal(victim.hp, 32);
  assert.equal(scout.nextAttackAtMs, s.timeMs + 700);
  assert.equal(s.tune.cards.scout.moveMs, 630); assert.equal(s.tune.cards.scout.productionMs, 10000); assert.equal(s.tune.cards.infantry.productionMs, 8000);
});

test('field artillery needs two direct hits to wipe a fresh squad, chips adjacent members at 35%, and preserves domains, cadence and minimum range', () => {
  const s = fixture(), gun = unit(s, '0,0', 0, 'artillery', 38);
  const centre = unit(s, '2,0', 1, 'infantry', 40); centre.members = [8, 8, 8, 8, 8]; centre.movingUntilMs = 100000;
  const infantry = unit(s, '3,0', 1, 'infantry', 40); infantry.members = [8, 8, 8, 8, 8]; infantry.movingUntilMs = 100000;
  const missile = unit(s, '2,1', 1, 'missile', 35); missile.members = [7, 7, 7, 7, 7]; missile.movingUntilMs = 100000;
  const tank = unit(s, '3,-1', 1, 'tank', 180); tank.movingUntilMs = 100000;
  const friendly = unit(s, '1,1', 0, 'tank', 180); friendly.movingUntilMs = 100000;
  const air = unit(s, '2,-1', 1, 'fighter', 60); air.movingUntilMs = 100000;
  const tooClose = unit(s, '1,0', 1, 'tank'); tooClose.movingUntilMs = 100000;
  advance(s, 100); assert(s.units.includes(centre)); assert.equal(centre.hp, 20); assert.deepEqual(centre.members, [4, 4, 4, 4, 4]);
  for (const hp of infantry.members) assert(Math.abs(hp - 6.6) < 1e-10);
  for (const hp of missile.members) assert(Math.abs(hp - 5.6) < 1e-10);
  assert(Math.abs(tank.hp - 178.6) < 1e-10); assert(Math.abs(tooClose.hp - 998.6) < 1e-10, 'splash can reach the dead zone without aiming inside it');
  assert.equal(friendly.hp, 180); assert.equal(air.hp, 60); assert.equal(gun.hp, 38);
  assert.equal(s.shots.find(x => x.unitId === gun.id).targetHexId, '2,0'); assert.equal(gun.nextAttackAtMs, 1900);
  advance(s, 1700); assert.equal(s.shots.filter(x => x.unitId === gun.id).length, 1);
  advance(s, 100); assert.equal(s.shots.filter(x => x.unitId === gun.id).at(-1).timeMs, 1900);
  assert(!s.units.includes(centre)); assert.equal(centre.hp, 0, 'second full-centre hit removes every remaining member');
  for (const hp of infantry.members) assert(Math.abs(hp - 5.2) < 1e-10);
  assert(!s.shots.some(x => x.unitId === gun.id && x.targetHexId === tooClose.hexId));
  assert.equal(s.tune.cards.artillery.damage, 4); assert.equal(s.tune.cards.artillery.minRange, 2);
  assert.equal(s.tune.cards.artillery.productionMs, 14000); assert.equal(s.tune.cards.artillery.buildMs, 0, 'legacy fixture only disables construction');
});

test('stronger bunker still takes ordinary damage and is destructible by sustained ground armour', () => {
  const s = fixture(); ownAll(s); const b = producer(s, '0,0', 'bunker'), attacker = unit(s, '1,0', 1, 'tank');
  assert.equal(b.hp, 280); advance(s, 100); assert.equal(b.hp, 257); assert.equal(attacker.hp, 992);
  advance(s, 14300); assert.equal(b.hp, 4); assert(s.buildings.includes(b));
  advance(s, 1300); assert(!s.buildings.includes(b)); assert(h(s, b.hexId).burnt); assert(s.units.includes(attacker));
});

test('specialists, flak and aircraft cannot capture even while stationary on neutral or enemy land', () => {
  for (const kind of ['artillery', 'mlrs', 'destroyer', 'siege', 'flak', 'helicopter', 'fighter', 'bomber', 'gunship', 'carrier']) {
    assert.equal(DEFAULT_TUNE.cards[kind].captureRate, 0);
    for (const owner of [null, 1]) {
      const s = milestone(t => { t.hq.defenseDamage = 0; }); const site = h(s, '-4,0'); site.owner = owner;
      const guard = unit(s, site.id, 0, kind); advance(s, 20000);
      assert.equal(guard.hexId, site.id, `${kind} holds beside home without seeking neutral expansion`);
      assert.equal(site.owner, owner); assert.equal(site.capture, 0); assert.equal(site.capturePlayer, null);
      assert(!s.hexes.some(x => x.captureUnitId === guard.id));
    }
  }
});

test('zero-capture ground specialists still move to defend intruders and attack the selected HQ without gaining land', () => {
  for (const kind of ['artillery', 'mlrs', 'destroyer', 'siege']) {
    const defense = milestone(t => { t.hq.defenseDamage = 0; }); ownAll(defense);
    const guard = unit(defense, '-2,3', 0, kind), intruder = unit(defense, `${-2 + defense.tune.cards[kind].sightRange},3`, 1, 'tank'); intruder.movingUntilMs = 100000;
    const initialDistance = distance(h(defense, guard.hexId), h(defense, intruder.hexId));
    advance(defense, 100);
    assert(distance(h(defense, guard.hexId), h(defense, intruder.hexId)) < initialDistance, `${kind} pursues a distant intruder`);
    advance(defense, 12000);
    assert(defense.shots.some(x => x.unitId === guard.id && x.targetHexId === intruder.hexId), `${kind} reaches firing range while defending`);
    assertOccupancy(defense);

    const attack = milestone(t => { t.hq.defenseDamage = 0; });
    const attacker = unit(attack, '-3,3', 0, kind), hq = attack.buildings.find(b => b.kind === 'hq' && b.owner === 1);
    const ownership = attack.hexes.map(x => x.owner), startDistance = distance(h(attack, attacker.hexId), h(attack, hq.hexId));
    attack.setTarget(0, 1); advance(attack, 100);
    assert(distance(h(attack, attacker.hexId), h(attack, hq.hexId)) < startDistance, `${kind} advances on the selected faction`);
    advance(attack, 20000);
    assert(attack.shots.some(x => x.unitId === attacker.id && x.targetHexId === hq.hexId), `${kind} reaches a legal HQ firing position`);
    assert.deepEqual(attack.hexes.map(x => x.owner), ownership, `${kind} gains no territory en route`);
    assert(!attack.hexes.some(x => x.captureUnitId === attacker.id)); assertOccupancy(attack);
  }
});

test('individual sight tuning preserves short-range infantry and the ranged-unit exceptions', () => {
  const expected = { infantry: 1, gunner: 1, missile: 3, tank: 3, scout: 3, walker: 3,
    artillery: 4, flak: 4, destroyer: 4, siege: 4, mlrs: 6,
    helicopter: 3, fighter: 3, bomber: 3, gunship: 3, carrier: 3 };
  for (const [kind, sight] of Object.entries(expected)) assert.equal(DEFAULT_TUNE.cards[kind].sightRange, sight, kind);
  assert.equal(DEFAULT_TUNE.hq.defenseRange, 2); assert.equal(DEFAULT_TUNE.cards.bunker.range, 2);
});

test('one-hex infantry sight does not chase distant enemies and ranged missile squads finish capture before using their full weapon range', () => {
  for (const kind of ['infantry', 'gunner']) {
    const s = milestone(); ownAll(s); const actor = unit(s, '0,3', 0, kind), enemy = unit(s, '2,3', 1, 'tank'); enemy.movingUntilMs = 100000;
    advance(s, 100); assert.equal(actor.attacking, false); assert(distance(h(s, actor.hexId), h(s, '-5,0')) < 8);
    enemy.hexId = s.neighbors(actor.hexId).find(x => !s.buildings.some(b => b.hexId === x.id) && x.id !== actor.fromHexId).id;
    actor.movingUntilMs = 0; advance(s, 100);
    assert(s.shots.some(x => x.unitId === actor.id && x.targetHexId === enemy.hexId));
  }
  const s = milestone(); ownAll(s); h(s, '0,3').owner = 1;
  const squad = unit(s, '0,3', 0, 'missile', 35); squad.members = [7, 7, 7, 7, 7];
  const enemy = unit(s, '3,3', 1, 'tank'); enemy.movingUntilMs = 100000;
  advance(s, s.tune.capture.neutralMs * s.tune.capture.ownedMultiplier - 100); assert.equal(squad.hexId, '0,3'); assert(h(s, '0,3').capture > 0);
  assert(!s.shots.some(x => x.unitId === squad.id));
  advance(s, 200); assert.equal(h(s, '0,3').owner, 0); assert.equal(squad.fromHexId, '0,3');
  assert.equal(distance(h(s, squad.hexId), h(s, enemy.hexId)), 2);
  advance(s, Math.ceil((squad.movingUntilMs - s.timeMs) / s.tune.stepMs) * s.tune.stepMs);
  assert(s.shots.some(x => x.unitId === squad.id && x.targetHexId === enemy.hexId));
  assert.equal(enemy.hp, 1000 - 5 * 6, 'all five members fire the armoured bonus at weapon range two');
});

test('MLRS uses individual sight six, fires at full range five, and approaches a legal minimum-range firing band', () => {
  for (const d of [1, 2, 3, 5, 6, 7]) {
    const s = milestone(t => { t.hq.defenseDamage = 0; }); ownAll(s);
    const launcher = unit(s, '-4,3', 0, 'mlrs'), enemy = unit(s, `${-4 + d},3`, 1, 'tank'); enemy.movingUntilMs = 100000;
    advance(s, 100);
    const shots = s.shots.filter(x => x.unitId === launcher.id);
    assert.equal(shots.length, d >= 3 && d <= 5 ? 1 : 0, `initial distance ${d}`);
    if (d === 6) assert.equal(distance(h(s, launcher.hexId), h(s, enemy.hexId)), 5, 'sight beyond the weapon band enables approach');
    if (d < 3) assert(distance(h(s, launcher.hexId), h(s, enemy.hexId)) > d, 'inside minimum range moves outward to a legal firing cell');
    if (d <= 6) {
      advance(s, 4000); assert(s.shots.some(x => x.unitId === launcher.id && x.targetHexId === enemy.hexId));
      for (const shot of s.shots.filter(x => x.unitId === launcher.id)) {
        const range = distance(h(s, shot.fromHexId), h(s, shot.targetHexId)); assert(range >= 3 && range <= 5);
      }
    } else assert.equal(enemy.hp, 1000, 'outside sight does not acquire a target');
    assertOccupancy(s);
  }
});

test('explicit HQ attacks navigate beyond sight, engage a visible enemy along the way, then resume the strategic order', () => {
  for (const kind of ['tank', 'artillery', 'mlrs', 'fighter', 'missile']) {
    const s = milestone(t => { t.hq.defenseDamage = 0; }); ownAll(s);
    const actor = unit(s, '-6,3', 0, kind), hq = s.buildings.find(b => b.id === 'hq1');
    const start = distance(h(s, actor.hexId), h(s, hq.hexId)); assert(start > s.tune.cards[kind].sightRange);
    s.setTarget(0, 1); advance(s, 100);
    assert(distance(h(s, actor.hexId), h(s, hq.hexId)) < start, `${kind} follows explicit orders toward the unseen HQ`);
  }
  const s = milestone(t => { t.hq.defenseDamage = 0; }); ownAll(s);
  const actor = unit(s, '0,3', 0, 'tank'), enemy = unit(s, '-3,3', 1, 'tank', 23); enemy.movingUntilMs = 100000;
  s.setTarget(0, 1); advance(s, 100); assert.equal(actor.hexId, '-1,3', 'local engagement can divert from the HQ route');
  advance(s, 4000); assert(!s.units.includes(enemy)); assert(s.shots.some(x => x.unitId === actor.id && x.targetHexId === '-3,3'));
  assert.equal(s.players[0].targetId, 1); assert(h(s, actor.hexId).q > -2, 'resumes the eastward HQ advance after engagement');
});

test('v7 sight checkpoints preserve deterministic pursuit and reject missing sight or prior room rules', () => {
  const s = milestone(); ownAll(s); const actor = unit(s, '0,3', 0, 'tank');
  unit(s, '3,3', 1, 'tank').movingUntilMs = 100000; advance(s, 100);
  const saved = JSON.parse(JSON.stringify(s.checkpoint())); assert.equal(saved.version, 7);
  const restored = OperationSim.restore(saved); assert.equal(restored.tune.cards.tank.sightRange, 3);
  for (const dt of [37, 63, 1900, 17, 83, 3000]) { advance(s, dt); advance(restored, dt); }
  assert.deepEqual(restored.checkpoint(), s.checkpoint()); assert(s.shots.some(x => x.unitId === actor.id));
  for (const version of [1, 2, 3, 4, 5, 6]) assert.throws(() => OperationSim.restore({ ...saved, version }), /Unsupported/);
  for (const value of [undefined, -1, NaN]) assert.throws(() => milestone(t => { t.cards.tank.sightRange = value; }), /Individual sight/);
});

test('opening commitments distinguish a twelve-resource mixed force from ten-resource double Barracks without delaying first production', () => {
  const mixed = milestone(), first = producer(mixed, '-4,0');
  const tankSite = mixed.hexes.find(x => mixed.placement(0, x.id, 'tank').ok); assert(tankSite);
  const motor = producer(mixed, tankSite.id, 'tank');
  assert.equal(mixed.resources(0).capacity, 18); assert.equal(mixed.resources(0).committed, 12);
  assert.equal(mixed.hexes.filter(x => x.lockedBy === first.id).length, 5);
  assert.equal(mixed.hexes.filter(x => x.lockedBy === motor.id).length, 7);
  advance(mixed, 2900); assert.equal(first.unitId, null); assert.equal(motor.unitId, null);
  advance(mixed, 100); assert(first.unitId); assert.equal(motor.unitId, null);
  assert.equal(first.cooldownActive, false); assert.equal(first.readyAtMs, 0);
  advance(mixed, 2000); assert(motor.unitId); assert.equal(motor.cooldownActive, false);
  assert.equal(motor.readyAtMs, 0, 'first spawn needs construction only, not an extra eleven-second replacement interval');

  const double = milestone(), a = producer(double, '-4,0');
  const next = double.hexes.find(x => double.placement(0, x.id, 'infantry').ok); assert(next);
  const b = producer(double, next.id); assert.equal(double.resources(0).committed, 10);
  assert.equal(double.resources(0).capacity - double.resources(0).committed, 8);
  advance(double, 3000); assert(a.unitId && b.unitId); assert.equal(double.units.length, 2);
  assert.equal(DEFAULT_TUNE.cards.scout.cost, 8); assert.equal(DEFAULT_TUNE.cards.gunner.cost, 6);
  assert.equal(DEFAULT_TUNE.cards.missile.cost - DEFAULT_TUNE.cards.infantry.cost, 2);
  for (const [kind, cost] of [['flak', 5], ['tank', 7], ['artillery', 7], ['bunker', 7]]) assert.equal(DEFAULT_TUNE.cards[kind].cost, cost);
});

test('squad capture strength follows living member count rather than health across all three infantry forms', () => {
  assert.equal(DEFAULT_TUNE.capture.neutralMs, 6000); assert.equal(DEFAULT_TUNE.capture.ownedMultiplier, 1.5);
  for (const kind of ['infantry', 'missile', 'gunner']) for (const count of [1, 2, 3, 4, 5]) for (const wounded of [false, true]) for (const owner of [1]) {
    const s = milestone(), site = h(s, '0,3'); site.owner = owner;
    const members = Array(count).fill(wounded ? 0.1 : s.tune.cards[kind].unitHp);
    const squad = unit(s, site.id, 0, kind, members.reduce((a, b) => a + b, 0)); squad.members = members;
    advance(s, 1000);
    const expected = 1000 / (owner === null ? 6000 : 9000) * count / 5;
    assert(Math.abs(site.capture - expected) < 1e-10, `${kind}: ${count} members, wounded=${wounded}, owner=${owner}`);
    assert.equal(squad.hexId, site.id); assert.equal(squad.members.length, count);
  }
  for (const [count, owner, duration] of [[5, 1, 9000], [1, 1, 45000]]) {
    const s = milestone(), site = h(s, '0,3'); site.owner = owner;
    const squad = unit(s, site.id, 0, 'infantry', count * 8); squad.members = Array(count).fill(8);
    advance(s, duration - 100); assert.equal(site.owner, owner, 'cannot finish early');
    advance(s, 200); assert.equal(site.owner, 0, `count=${count} capture completes within one step of ${duration}ms`);
  }
  for (const size of [4, 6]) {
    const s = milestone(t => { t.cards.infantry.squadSize = size; }), site = h(s, '0,3'); site.owner = 1;
    const squad = unit(s, site.id, 0, 'infantry', 16); squad.members = [8, 8]; advance(s, 1000);
    assert(Math.abs(site.capture - 1000 / 9000 * 2 / size) < 1e-10, 'fraction uses configured squad size rather than a hardcoded five');
  }
});

test('visual incoming reinforcements add no capture pressure until merge and do not heal the wounded survivor', () => {
  for (const kind of ['infantry', 'missile', 'gunner']) {
    // A real base producer supplies the survivor; conversion is only needed for Missile.
    const base = kind === 'missile' ? 'infantry' : kind;
    const custom = milestone(() => {}, { loadouts: [[base]] });
    ownAll(custom); const b = producer(custom, '0,0', base); advance(custom, custom.tune.cards[base].buildMs);
    if (kind === 'missile') { assert(custom.upgrade(0, b.id).ok); advance(custom, 5000); }
    const squad = custom.units.find(x => x.id === b.unitId), site = h(custom, '0,3'); site.owner = 1;
    squad.hexId = site.id; delete squad.fromHexId; delete squad.movingUntilMs; squad.members = [0.1]; squad.hp = 0.1;
    custom.reinforcements.push({ id: 'capture-incoming', unitId: squad.id, buildingId: b.id, owner: 0, count: 4,
      fromHexId: b.hexId, startedAtMs: custom.timeMs, arriveAtMs: custom.timeMs + 1000 });
    advance(custom, 900); assert.equal(squad.members.length, 1); assert.equal(custom.reinforcements.length, 1);
    assert(Math.abs(site.capture - 900 * 0.2 / 9000) < 1e-10, 'travelling members do not increase pressure');
    advance(custom, 100); assert.equal(squad.members.length, 5); assert.equal(custom.reinforcements.length, 0);
    assert.equal(squad.members[0], 0.1); assert(squad.members.slice(1).every(hp => hp === custom.tune.cards[kind].unitHp));
    assert(Math.abs(site.capture - (900 * 0.2 / 9000 + 100 / 9000)) < 1e-10, 'merged members contribute on arrival');
  }
});

test('Defend can fire at in-range structures but only Attack pursues them beyond weapon range', () => {
  for (const kind of ['tank', 'scout', 'walker', 'artillery', 'mlrs', 'helicopter', 'gunship', 'destroyer', 'siege', 'bomber', 'carrier']) {
    for (const attack of [false, true]) for (const outside of [false, true]) {
      const s = milestone(t => { t.hq.defenseDamage = 0; }); ownAll(s); const source = '-4,3'; h(s, source).owner = null;
      const actor = unit(s, source, 0, kind), card = s.tune.cards[kind], d = card.range + (outside ? 1 : 0);
      const targetHex = `${-4 + d},3`;
      s.buildings.push({ id: 'passive-structure', owner: 1, kind: 'tank', hexId: targetHex, hp: 1000, maxHp: 1000, readyAtMs: 0, unitId: 'fixture' });
      if (attack) s.setTarget(0, 1); advance(s, 100);
      assert.equal(s.shots.some(x => x.unitId === actor.id), !outside, `${kind}: attack=${attack} outside=${outside}`);
      if (!outside) { assert.equal(actor.hexId, source); assert.equal(h(s, source).capture, 0); }
      else if (attack) assert.equal(distance(h(s, actor.hexId), h(s, targetHex)), d - 1, `${kind} pursues the visible structure on Attack`);
      else if (card.captureRate > 0) { assert.equal(actor.hexId, source); assert(h(s, source).capture > 0, 'distant structure cannot freeze vehicle expansion'); }
      else assert(distance(h(s, actor.hexId), h(s, '-5,0')) < distance(h(s, source), h(s, '-5,0')), `${kind} returns toward home instead of chasing the structure`);
      assertOccupancy(s);
    }
  }
});

test('live-tuned Recon and Tank defeat adjacent artillery on an open map without trapping or freezing either side', () => {
  for (const kind of ['scout', 'tank']) {
    const s = milestone();
    const counter = unit(s, '0,3', 0, kind, s.tune.cards[kind].unitHp), gun = unit(s, '1,3', 1, 'artillery', 38);
    assert.equal(distance(h(s, counter.hexId), h(s, gun.hexId)), 1);
    for (let i = 0; i < 300 && s.units.includes(counter) && s.units.includes(gun); i++) {
      const retreating = (gun.retreatUntilMs ?? 0) > s.timeMs, before = s.shots.filter(x => x.unitId === gun.id).length;
      advance(s, 100); assertOccupancy(s);
      if (retreating) assert.equal(s.shots.filter(x => x.unitId === gun.id).length, before, 'damage-trigger retreat cannot auto-fire');
    }
    assert(!s.units.includes(gun), `${kind} must finish the close-range counter within thirty seconds`);
    assert(s.units.includes(counter)); assert.equal(counter.hp, s.tune.cards[kind].unitHp);
    assert.equal(s.shots.filter(x => x.unitId === gun.id).length, 0, 'adjacent target is illegal and retreat never produces an automatic shot');
    assert.equal(s.shots.filter(x => x.unitId === counter.id).length, kind === 'scout' ? 13 : 2);
    assert.equal(s.tune.cards.artillery.moveMs, 1610); assert.equal(s.tune.cards.artillery.attackMs, 1800);
  }
});

test('650 HP HQ withstands two and three fresh adjacent infantry squads without extra support', () => {
  for (const count of [2, 3]) {
    const s = milestone(); s.setTarget(1, 0);
    const hq = s.buildings.find(x => x.id === 'hq0'), squads = [];
    for (const site of ['-4,0', '-5,1', '-6,1'].slice(0, count)) {
      const squad = unit(s, site, 1, 'infantry', 40); squad.members = [8, 8, 8, 8, 8]; squads.push(squad);
      assert.equal(distance(h(s, site), h(s, hq.hexId)), 1); assert.equal(h(s, site).owner, 0);
    }
    assert.equal(squads.reduce((sum, x) => sum + x.members.length, 0), count * 5);
    assert.equal(hq.hp, 650); assert.equal(s.tune.hq.defenseDamage, 8);
    for (let i = 0; i < 200 && squads.some(x => s.units.includes(x)); i++) { advance(s, 100); assertOccupancy(s); }
    assert(s.buildings.includes(hq) && hq.hp > 0, `HQ survives a ${count}-squad gang-up`);
    assert(squads.every(x => !s.units.includes(x)), 'all unsupported attacking squads are repelled');
    assert.equal(s.shots.filter(x => x.unitId === hq.id).length, count * 5, 'eight-damage HQ gun removes one fresh member per shot');
    assert.equal(s.winner, null); assert.equal(s.buildings.filter(x => x.kind !== 'hq').length, 0, 'no defensive producer or bunker supports the HQ');
  }
});

// Controlled bot decisions use ordinary producers/spawns on a rich test board;
// the real-map opening and scripted matches above separately cover fair budgets.
function preparedBot(kinds, loadout = [...DEFAULT_LOADOUT], tier = 3) {
  const tune = structuredClone(DEFAULT_TUNE); tune.bot.heuristic.initialBuildMs = 20000;
  const s = new OperationSim({ tune, loadouts: [[...DEFAULT_LOADOUT], loadout] }); ownAll(s, 1);
  const home = h(s, '5,0');
  for (const kind of kinds) {
    const site = s.hexes.filter(x => s.placement(1, x.id, kind).ok).sort((a, b) => distance(a, home) - distance(b, home))[0];
    assert(site); assert(s.place(1, site.id, kind).ok);
  }
  if (kinds.length >= 3) {
    const site = s.hexes.filter(x => s.placement(1, x.id, 'hq').ok).sort((a, b) => distance(a, h(s, '8,-3')) - distance(b, h(s, '8,-3')))[0];
    assert(site); assert(s.place(1, site.id, 'hq').ok);
  }
  advance(s, 19900); s.players[1].techTier = tier; s.buildings.find(b => b.id === 'hq1').hqLevel = tier; return s;
}

test('bot counters choose legal available artillery, anti-air and anti-armour rather than inventing loadout cards', () => {
  const cases = [
    { loadout: [...DEFAULT_LOADOUT], tier: 1, enemy: 'infantry', expected: 'artillery' },
    { loadout: [...DEFAULT_LOADOUT], tier: 2, enemy: 'helicopter', expected: 'fighter' },
    { loadout: ['infantry', 'tank', 'flak'], tier: 1, enemy: 'helicopter', expected: 'flak' },
    { loadout: ['infantry', 'tank', 'artillery'], tier: 1, enemy: 'helicopter', expected: 'infantry' },
    { loadout: ['infantry', 'tank', 'destroyer'], tier: 2, enemy: 'tank', expected: 'destroyer' },
    { loadout: ['scout', 'tank', 'artillery'], tier: 1, enemy: 'infantry', expected: 'artillery', capture: 'scout' },
  ];
  for (const scenario of cases) {
    const s = preparedBot([scenario.capture ?? 'infantry'], scenario.loadout, scenario.tier), before = new Set(s.buildings.map(b => b.id));
    const enemy = unit(s, '0,3', 0, scenario.enemy); enemy.movingUntilMs = 100000;
    if (scenario.enemy === 'infantry') { enemy.members = [8, 8, 8, 8, 8]; enemy.hp = 40; enemy.maxHp = 40; }
    advance(s, 100);
    const built = s.buildings.filter(b => !before.has(b.id)); assert.equal(built.length, 1); assert.equal(built[0].kind, scenario.expected);
    assert(scenario.loadout.includes(built[0].kind)); assert(s.tune.cards[built[0].kind].tier <= scenario.tier);
    assert.equal(built[0].unitId, null); assert.equal(built[0].completeAtMs, s.timeMs + s.tune.cards[built[0].kind].buildMs);
  }
});

test('bot safer producer placements avoid an enemy firing envelope when legal protected support remains', () => {
  const s = preparedBot(['infantry'], ['infantry', 'tank'], 1), before = new Set(s.buildings.map(b => b.id));
  const threat = unit(s, '3,0', 0, 'artillery'); threat.movingUntilMs = 100000;
  advance(s, 100); const built = s.buildings.find(b => !before.has(b.id)); assert.equal(built.kind, 'tank');
  assert(distance(h(s, built.hexId), h(s, threat.hexId)) > s.tune.cards.artillery.range + 1);
  assert.equal(s.hexes.filter(x => x.lockedBy === built.id).length, 7); assert.equal(h(s, built.hexId).owner, 1);
});

test('pressure returns the bot to a friendly bunker anchor, cancels research and funds a forward bunker without retiring defenders', () => {
  const s = preparedBot(['infantry', 'infantry', 'tank', 'artillery', 'bunker'], [...DEFAULT_LOADOUT], 1);
  const existing = s.buildings.find(b => b.kind === 'bunker'), before = new Set(s.buildings.map(b => b.id)), army = s.units.filter(u => u.kind !== 'worker').map(u => u.id);
  assert(s.startResearch(1).ok); s.setTarget(1, 0);
  const threat = unit(s, '3,0', 0, 'tank'); threat.movingUntilMs = 100000;
  advance(s, 100);
  assert.equal(s.players[1].targetId, 1); assert.equal(s.players[1].defendTargetId, existing.id); assert.equal(s.players[1].research, null);
  assert(!s.hexes.some(x => x.lockedBy === 'research-1'));
  const forward = s.buildings.find(b => !before.has(b.id)); assert.equal(forward.kind, 'bunker');
  assert(distance(h(s, forward.hexId), h(s, threat.hexId)) <= s.tune.cards.bunker.range);
  assert.equal(forward.completeAtMs, s.timeMs + 6000); assert.equal(forward.hp, 280);
  assert(army.every(id => s.units.some(u => u.id === id)), 'defensive pressure cannot trigger force-retiring upgrades');
  assert(s.checkpoint().botOrderUntilMs >= s.timeMs + s.tune.bot.heuristic.orderHoldMs);
});

test('bot uses anti-armour Missile conversion only with a second living capture force and an ordinary surcharge', () => {
  for (const captureCount of [1, 2]) {
    const kinds = captureCount === 1 ? ['infantry', 'tank', 'artillery'] : ['infantry', 'infantry', 'tank', 'artillery'];
    const s = preparedBot(kinds), producer = s.buildings.find(b => b.owner === 1 && b.kind === 'infantry');
    const original = producer.unitId, otherCapturers = s.units.filter(u => u.kind === 'infantry' && u.buildingId !== producer.id).map(u => u.id);
    const before = s.resources(1).committed, enemy = unit(s, '0,3', 0, 'tank'); enemy.movingUntilMs = 100000;
    advance(s, 100);
    if (captureCount === 1) {
      assert.equal(producer.upgradeKind, undefined); assert.equal(producer.unitId, original); assert(s.units.some(u => u.id === original));
    } else {
      assert.equal(producer.upgradeKind, 'missile'); assert.equal(producer.upgradeCost, 2); assert.equal(producer.unitId, null);
      assert.equal(s.resources(1).committed, before + 2); assert.equal(s.hexes.filter(x => x.lockedBy === producer.id && x.commitment === 'upgrade').length, 2);
      assert(otherCapturers.every(id => s.units.some(u => u.id === id)), 'a living capturing squad remains during conversion');
    }
  }
});

test('bot attacks with an assembled healthy mixed force, retreats after depletion and rebuilds without order flapping', () => {
  const s = new OperationSim(); let attackAt = null;
  for (let i = 0; i < 1200 && s.players[1].targetId !== 0; i++) advance(s, 100);
  assert.equal(s.players[1].targetId, 0); attackAt = s.timeMs;
  const force = s.units.filter(u => u.owner === 1), cfg = s.tune.bot.heuristic;
  assert(force.filter(u => u.hp / u.maxHp >= cfg.healthyFraction).length >= cfg.minAttackUnits);
  assert(new Set(force.map(u => u.kind)).size > 1); assert(force.some(u => s.tune.cards[u.kind].capturePriority));
  assert(force.reduce((sum, u) => sum + s.tune.cards[u.kind].cost * u.hp / u.maxHp, 0) >= cfg.minAttackStrength);
  const survivor = force.find(u => u.kind === 'infantry'); for (const u of force) if (u !== survivor) u.hp = 0;
  for (let i = 0; i < 60 && s.players[1].targetId === 0; i++) { for (const u of s.units) if (u.owner === 1 && u.kind !== 'worker' && u !== survivor) u.hp = 0; advance(s, 100); }
  assert.equal(s.players[1].targetId, 1); const retreatAt = s.timeMs, holdUntil = s.checkpoint().botOrderUntilMs;
  assert(holdUntil >= retreatAt + cfg.orderHoldMs);
  while (s.timeMs < holdUntil - 100) { advance(s, 100); assert.equal(s.players[1].targetId, 1, 'recovery hold prevents repeated attack toggles'); }
  for (let i = 0; i < 1200 && s.players[1].targetId !== 0 && s.winner === null; i++) advance(s, 100);
  assert.equal(s.players[1].targetId, 0, 'healthy replacement force can attack again');
  assert(s.timeMs >= retreatAt + cfg.orderHoldMs); assert(s.timeMs > attackAt);
});

test('bot decisions, saving and order hysteresis are checkpoint and tick-partition deterministic with old-v7 defaults', () => {
  const a = new OperationSim(), b = new OperationSim();
  for (let t = 0; t < 90000; t += 100) advance(a, 100);
  for (let t = 0; t < 90000; t += 500) advance(b, 500);
  assert.deepEqual(a.checkpoint(), b.checkpoint());
  const staged = new OperationSim(); for(let i=0;i<1200&&staged.players[1].targetId!==0;i++)advance(staged,100); advance(staged,37);
  const restored = OperationSim.restore(JSON.parse(JSON.stringify(staged.checkpoint())));
  assert(restored.checkpoint().botOrderUntilMs > staged.timeMs);
  for (const dt of [63, 5000, 17, 83, 20000]) { advance(staged, dt); advance(restored, dt); }
  assert.deepEqual(staged.checkpoint(), restored.checkpoint());
  const original = new OperationSim(); advance(original, 100); const old = JSON.parse(JSON.stringify(original.checkpoint()));
  delete old.botOrderUntilMs; delete old.tune.bot.heuristic;
  const compatible = OperationSim.restore(old); assert.equal(compatible.checkpoint().botOrderUntilMs, 0);
  advance(original, 12000); advance(compatible, 12000);
  const comparable = compatible.checkpoint(); comparable.tune.bot.heuristic = original.tune.bot.heuristic;
  assert.deepEqual(comparable, original.checkpoint());
});

function economyWorld(edit = () => {}, options = {}) {
  const tune = structuredClone(DEFAULT_TUNE); edit(tune); return new OperationSim({ tune, bot: false, ...options });
}
function laborWorld(edit = () => {}) { return economyWorld(t => { t.hq.workerLimit = 0; edit(t); }); }
function extraHQ(s, owner = 0, site = '0,0') {
  assert(s.place(owner, site, 'hq').ok); return s.buildings.find(b => b.hexId === site);
}

test('v7 starts with six productive hexes, three ordinary workers per HQ and seven selectable cards plus implicit HQ', () => {
  const s = economyWorld();
  assert.deepEqual(s.resources(0), { committed: 0, capacity: 6, stranded: 0 });
  assert.equal(s.units.length, 6); assert.equal(DEFAULT_LOADOUT.length, 7); assert.equal(Object.keys(DEFAULT_TUNE.cards).length, 19);
  assert.deepEqual(DEFAULT_LOADOUT, ['infantry', 'tank', 'artillery', 'fighter', 'scout', 'bunker', 'silo']);
  for (const p of s.players) {
    const workers = s.units.filter(u => u.owner === p.id);
    assert.equal(workers.length, 3); assert(workers.every(u => u.kind === 'worker' && u.hp === 1 && u.buildingId === `hq${p.id}`));
    assert.equal(s.buildings.find(b => b.id === `hq${p.id}`).hqLevel, 1);
  }
  assert(!BASE_CARDS.includes('worker')); assert(!BASE_CARDS.includes('hq'));
  assert(!s.placement(0, '0,0', 'worker').ok); assert.throws(() => economyWorld(() => {}, { loadouts: [[...BASE_CARDS.slice(0, 8)]] }), /Invalid loadout/);
  const site = s.hexes.find(x => s.placement(0, x.id, 'infantry').ok); assert(site, 'workers leave a legal initial Barracks site');
  assert(s.place(0, site.id, 'infantry').ok); assert.equal(s.resources(0).committed, 5); assertOccupancy(s);
});

test('HQ has no capture aura even when legacy hqRate is huge', () => {
  const s = laborWorld(t => { t.capture.hqRate = 100; });
  const neutral = h(s, '-4,0'), enemy = h(s, '-5,1'); neutral.owner = null; enemy.owner = 1;
  advance(s, 20000); assert.equal(neutral.owner, null); assert.equal(enemy.owner, 1);
  assert.equal(neutral.capture, 0); assert.equal(enemy.capture, 0);
});

test('only workers capture neutral land, only infantry forms capture enemy land, and attack orders do not stop gathering', () => {
  for (const kind of Object.keys(DEFAULT_TUNE.cards).filter(k => !DEFAULT_TUNE.cards[k].utility)) for (const owner of [null, 1]) {
    const s = laborWorld(t => { t.hq.defenseDamage = 0; }); ownAll(s); const site = h(s, '-2,0'); site.owner = owner;
    const actor = unit(s, site.id, 0, kind, DEFAULT_TUNE.cards[kind].unitHp);
    if (['infantry', 'missile', 'gunner'].includes(kind)) { actor.members = Array(5).fill(s.tune.cards[kind].unitHp); actor.hp *= 5; actor.maxHp = actor.hp; }
    s.setTarget(0, 1); advance(s, 1000);
    const canCapture = kind === 'worker' ? owner === null : ['infantry', 'missile', 'gunner'].includes(kind) && owner === 1;
    assert.equal(site.capture > 0, canCapture, `${kind} on owner=${owner}`);
    if (canCapture) assert(Math.abs(site.capture - 1000 / (owner === null ? 6000 : 9000)) < 1e-10);
    if (!['worker', 'infantry', 'missile', 'gunner'].includes(kind)) assert.equal(s.tune.cards[kind].captureRate, 0);
  }
});

test('military HQ and building commands never redirect HQ-bound worker gathering', () => {
  for (const order of ['home', 'anchor', 'attack']) {
    const s = laborWorld(); ownAll(s);
    s.buildings.push({ id: 'army-anchor', owner: 0, kind: 'bunker', hexId: '3,0', hp: 280, maxHp: 280, unitId: null, readyAtMs: 0 });
    h(s, '-2,0').owner = null; h(s, '3,1').owner = null;
    const worker = unit(s, '-3,0', 0, 'worker', 1); worker.buildingId = 'hq0';
    if (order !== 'home') assert(s.setDefendTarget(0, 'army-anchor').ok);
    if (order === 'attack') assert(s.setAttackTarget(0, 'hq1').ok);
    advance(s, 10000);
    assert.equal(h(s, '-2,0').owner, 0); assert.equal(h(s, '3,1').owner, null);
    assert.equal(worker.hexId, '-2,0'); assert.equal(worker.buildingId, 'hq0');
    assert.equal(s.players[0].targetId, order === 'attack' ? 1 : 0); assertOccupancy(s);
  }
});

test('additional HQ commits sixteen connected cells, builds thirty seconds and sequentially produces three workers at eight-second intervals', () => {
  const s = economyWorld(); ownAll(s); const b = extraHQ(s);
  assert.equal(b.committedCost, 16); assert.equal(s.resources(0).committed, 16); assert.equal(s.hexes.filter(x => x.lockedBy === b.id).length, 16);
  const count = () => s.units.filter(u => u.buildingId === b.id && u.kind === 'worker').length;
  advance(s, 29900); assert.equal(count(), 0); advance(s, 100); assert.equal(count(), 0);
  assert.equal(b.hqLevel, 1); advance(s, 7900); assert.equal(count(), 0); advance(s, 100); assert.equal(count(), 1);
  advance(s, 8000); assert.equal(count(), 2); advance(s, 8000); assert.equal(count(), 3);
  advance(s, 16000); assert.equal(count(), 3); assert.equal(b.workerReadyAtMs, undefined);
  const workers = s.units.filter(u => u.buildingId === b.id); workers[0].hp = workers[1].hp = 0; advance(s, 100);
  const due = b.workerReadyAtMs; assert.equal(count(), 1); assert.equal(due, s.timeMs + 8000);
  advance(s, 7900); assert.equal(count(), 1); advance(s, 100); assert.equal(count(), 2);
  advance(s, 8000); assert.equal(count(), 3); assertOccupancy(s);
});

test('blocked worker production cannot jump occupied neighbors and resumes one-by-one when a real slot opens', () => {
  const s = economyWorld(); ownAll(s); const b = extraHQ(s);
  const guards = s.neighbors(b.hexId).map(x => { const u = unit(s, x.id, 0, 'tank'); u.movingUntilMs = 100000; return u; });
  advance(s, 38000); assert.equal(s.units.filter(u => u.buildingId === b.id).length, 0);
  guards[0].hp = 0; advance(s, 100);
  const worker = s.units.find(u => u.buildingId === b.id); assert(worker); assert.equal(worker.hexId, guards[0].hexId);
  assert.equal(b.workerReadyAtMs, s.timeMs + 8000); assertOccupancy(s);
});

test('any positive damaging hit kills a worker and never grants a special retreat', () => {
  const s = laborWorld(t => { t.cards.tank.damage = 0.01; }); ownAll(s);
  const tank = unit(s, '0,3', 0, 'tank'), worker = unit(s, '1,3', 1, 'worker', 1); worker.movingUntilMs = 100000;
  advance(s, 100); assert(!s.units.includes(worker)); assert.equal(worker.hp, 0); assert.equal(worker.retreatUntilMs, undefined);
  assert(s.shots.some(x => x.unitId === tank.id && x.targetHexId === worker.hexId));
});

test('workers survive source HQ destruction as gathering orphans and do not consume another HQ replacement slots', () => {
  const s = economyWorld(); ownAll(s); const b = extraHQ(s); advance(s, 54000);
  const orphans = s.units.filter(u => u.buildingId === 'hq0'); assert.equal(orphans.length, 3);
  s.buildings.find(x => x.id === 'hq0').hp = 0; advance(s, 100);
  assert(s.players[0].alive); assert(orphans.every(u => s.units.includes(u) && u.buildingId === null));
  const destination = h(s, '2,0'); destination.owner = null; advance(s, 20000);
  assert.equal(destination.owner, 0, 'orphans and surviving HQ workers continue gathering');
  orphans[0].hp = 0; advance(s, 100);
  assert.equal(s.units.filter(u => u.buildingId === b.id).length, 3); assert.equal(b.workerReadyAtMs, undefined);
});

test('last completed HQ determines elimination; an unfinished expansion does not keep a faction alive', () => {
  const s = economyWorld(); ownAll(s); const b = extraHQ(s); assert(b.completeAtMs > s.timeMs);
  s.buildings.find(x => x.id === 'hq0').hp = 0; advance(s, 100);
  assert.equal(s.winner, 1); assert(!s.players[0].alive); assert(!s.buildings.some(x => x.owner === 0)); assert(!s.units.some(x => x.owner === 0));
  assert(!h(s, b.hexId).burnt, 'elimination removes unfinished expansions without a burn cascade');
});

test('HQ loss retains ordinary support debt and delayed release while another completed HQ survives', () => {
  const s = laborWorld(); ownAll(s); const b = extraHQ(s); advance(s, 30000);
  const lost = s.hexes.filter(x => x.lockedBy === b.id && x.id !== b.hexId).slice(0, 3); loseSupports(s, lost.map(x => x.id));
  b.hp = 0; advance(s, 100); assert(s.players[0].alive); assert(h(s, b.hexId).burnt);
  assert.equal(s.resources(0).stranded, 3); assert.equal(s.resources(0).committed, 16);
  advance(s, 10000); assert.equal(s.resources(0).committed, 3);
});

test('HQ research is linked, upgrades only its HQ and derives faction tech from completed surviving levels', () => {
  const s = laborWorld(); ownAll(s); const b = extraHQ(s); assert(!s.startResearch(0, b.id).ok); advance(s, 30000);
  assert(s.startResearch(0, 'hq0').ok); assert.equal(s.players[0].research.hqId, 'hq0'); assert.equal(s.players[0].research.supportIds.length, 16);
  advance(s, 30000); assert.equal(s.buildings.find(x => x.id === 'hq0').hqLevel, 2); assert.equal(b.hqLevel, 1); assert.equal(s.players[0].techTier, 2);
  assert(s.startResearch(0).ok); assert.equal(s.players[0].research.hqId, 'hq0'); advance(s, 60000); assert.equal(s.players[0].techTier, 3);
  assert(s.startResearch(0, b.id).ok, 'a lower-level second HQ can still be upgraded at faction T3'); assert.equal(s.players[0].research.fromTier, 1);
  advance(s, 30000); assert.equal(b.hqLevel, 2); assert.equal(s.players[0].techTier, 3);
  s.buildings.find(x => x.id === 'hq0').hp = 0; advance(s, 100); assert(s.players[0].alive); assert.equal(s.players[0].techTier, 2);
});

test('research survives another HQ loss, but losing its linked HQ cancels and releases every temporary support', () => {
  for (const sourceDies of [false, true]) {
    const s = laborWorld(); ownAll(s); const b = extraHQ(s); advance(s, 30000);
    assert(s.startResearch(0, b.id).ok); loseSupports(s, s.players[0].research.supportIds.slice(0, 4));
    s.buildings.find(x => x.id === (sourceDies ? b.id : 'hq0')).hp = 0; advance(s, 100);
    if (sourceDies) { assert.equal(s.players[0].research, null); assert(!s.hexes.some(x => x.lockedBy === 'research-0')); }
    else { assert.equal(s.players[0].research.hqId, b.id); advance(s, 29900); assert.equal(b.hqLevel, 2); }
    assert(s.players[0].alive);
  }
});

test('advanced producers and supported replacements keep functioning after the high-level HQ is lost', () => {
  const s = laborWorld(); ownAll(s); const b = extraHQ(s); advance(s, 30000);
  assert(s.startResearch(0).ok); advance(s, 30000); assert(s.startResearch(0).ok); advance(s, 60000);
  assert(s.place(0, '0,3', 'fighter').ok); const airbase = s.buildings.find(x => x.hexId === '0,3'); advance(s, 6000);
  assert(s.upgrade(0, airbase.id).ok); advance(s, 8000); assert.equal(airbase.kind, 'bomber');
  s.buildings.find(x => x.id === 'hq0').hp = 0; advance(s, 100); assert.equal(s.players[0].techTier, 1); assert.equal(b.hqLevel, 1);
  assert(!s.placement(0, '4,3', 'fighter').ok); const old = airbase.unitId; s.units.find(x => x.id === old).hp = 0; advance(s, 100);
  advance(s, 24000); assert(airbase.unitId && airbase.unitId !== old); assert.equal(s.units.find(x => x.id === airbase.unitId).kind, 'bomber');
});

test('completed buildings cannot be sold, while unfinished HQ or producer cancellation releases surviving support only', () => {
  const s = laborWorld(); ownAll(s); assert(!s.sell(0, 'hq0').ok); const b = extraHQ(s);
  assert(s.cancelConstruction(0, b.id).ok); assert.equal(s.resources(0).committed, 0); assert(!h(s, b.hexId).burnt);
  assert(s.place(0, '0,0', 'tank').ok); const tank = s.buildings.find(x => x.hexId === '0,0');
  loseSupports(s, s.hexes.filter(x => x.lockedBy === tank.id && x.id !== tank.hexId).slice(0, 2).map(x => x.id));
  assert(s.cancelConstruction(0, tank.id).ok); assert.equal(s.resources(0).stranded, 2); assert.equal(s.resources(0).committed, 2);
  ownAll(s); assert(s.place(0, '0,0', 'infantry').ok); const barracks = s.buildings.find(x => x.hexId === '0,0'); advance(s, 3000);
  const supported = barracks.unitId; assert(!s.sell(0, barracks.id).ok); assert(!s.cancelConstruction(0, barracks.id).ok); assert.equal(barracks.unitId, supported);
  assert(s.upgrade(0, barracks.id).ok); assert(s.cancelUpgrade(0, barracks.id).ok, 'conversion cancellation remains available');
});

test('Recon chases a visible worker before firing at a nearby tank in either faction order mode', () => {
  for (const attack of [false, true]) {
    const s = laborWorld(t => { t.hq.defenseDamage = 0; }); ownAll(s);
    const scout = unit(s, '0,3', 0, 'scout', 35), tank = unit(s, '1,3', 1, 'tank', 180), worker = unit(s, '3,3', 1, 'worker', 1);
    tank.movingUntilMs = worker.movingUntilMs = 100000; if (attack) s.setTarget(0, 1);
    advance(s, 100); assert.equal(scout.attacking, false); assert.equal(scout.fromHexId, '0,3'); assert.equal(tank.hp, 180);
    advance(s, 3000); const first = s.shots.find(x => x.unitId === scout.id); assert(first); assert.equal(first.targetHexId, worker.hexId); assert(!s.units.includes(worker));
  }
});

test('building Attack Here uses that strategic destination and returns to the nearest friendly HQ on its destruction', () => {
  const s = laborWorld(); ownAll(s); const b = extraHQ(s, 0, '2,0'); advance(s, 30000);
  const enemy = { id: 'enemy-outpost', owner: 1, kind: 'tank', hexId: '4,2', hp: 180, maxHp: 180, unitId: 'fixture', readyAtMs: 0 }; s.buildings.push(enemy);
  const soldier = unit(s, '0,3', 0, 'tank'); assert(s.setAttackTarget(0, enemy.id).ok); assert.equal(s.players[0].attackTargetId, enemy.id);
  advance(s, 100); assert.equal(soldier.fromHexId, '0,3'); assert(!s.setAttackTarget(0, b.id).ok); assert(!s.setAttackTarget(0, soldier.id).ok);
  enemy.hp = 0; advance(s, 100); assert.equal(s.players[0].attackTargetId, null); assert.equal(s.players[0].targetId, 0); assert.equal(s.players[0].defendTargetId, b.id);
});

test('bot economy expands a real HQ and researches through it while respecting seven-card legality and worker limits', () => {
  const s = economyWorld(t => { t.bot.heuristic.initialBuildMs = 20000; t.bot.heuristic.minAttackStrength = 1000; }, { bot: true }); ownAll(s, 1);
  for (const kind of ['infantry', 'infantry', 'tank', 'artillery']) {
    const site = s.hexes.filter(x => s.placement(1, x.id, kind).ok).sort((a, b) => distance(a, h(s, '5,0')) - distance(b, h(s, '5,0')))[0]; assert(site); assert(s.place(1, site.id, kind).ok);
  }
  advance(s, 20000); const expansion = s.buildings.find(b => b.kind === 'hq' && b.id !== 'hq0' && b.id !== 'hq1');
  assert(expansion); assert.equal(expansion.committedCost, 16); assert.equal(expansion.completeAtMs, 50000); assert.equal(expansion.hqLevel, 1);
  assert.equal(s.units.filter(u => u.buildingId === expansion.id).length, 0); advance(s, 54000);
  assert(s.players[1].techTier >= 2); assert.equal(s.units.filter(u => u.buildingId === expansion.id).length, 3);
  for (const building of s.buildings.filter(x => x.owner === 1 && x.kind !== 'hq')) assert(s.loadouts[1].includes(building.kind));
});

test('worker economy and HQ orders are deterministic through v7 checkpoint recovery and tick partitions', () => {
  const a = economyWorld(), b = economyWorld(); advance(a, 40137); advance(b, 40137);
  const saved = JSON.parse(JSON.stringify(a.checkpoint())); assert.equal(saved.version, 7); const restored = OperationSim.restore(saved);
  for (let i = 0; i < 100; i++) advance(a, 100); for (let i = 0; i < 20; i++) advance(b, 500); advance(restored, 10000);
  assert.deepEqual(a.checkpoint(), b.checkpoint()); assert.deepEqual(a.checkpoint(), restored.checkpoint());
  for (const version of [1, 2, 3, 4, 5, 6]) assert.throws(() => OperationSim.restore({ ...saved, version }), /Unsupported/);
});

test('an expansion HQ can be funded by exactly sixteen productive cells without losing one capacity on placement', () => {
  const s = laborWorld(); for (const tile of s.hexes) tile.owner = null; h(s, '-5,0').owner = 0;
  const cells = [h(s, '0,0')], seen = new Set(['0,0']);
  for (let i = 0; cells.length < 16; i++) for (const next of s.neighbors(cells[i].id)) if (!seen.has(next.id)) { seen.add(next.id); cells.push(next); if (cells.length === 16) break; }
  for (const tile of cells) tile.owner = 0; assert.equal(s.resources(0).capacity, 16);
  extraHQ(s); assert.deepEqual(s.resources(0), { committed: 16, capacity: 16, stranded: 0 });
});

test('unarmed enemy workers are raid targets but cannot cause bot emergency retreat or research cancellation', () => {
  const s = preparedBot(['infantry', 'infantry', 'tank', 'artillery'], [...DEFAULT_LOADOUT], 1);
  assert(s.startResearch(1, 'hq1').ok); s.setTarget(1, 0); const due = s.players[1].research.completeAtMs;
  unit(s, '3,0', 0, 'worker', 1).movingUntilMs = 100000; advance(s, 100);
  assert.equal(s.players[1].targetId, 0); assert(s.players[1].research); assert.equal(s.players[1].research.completeAtMs, due);
  assert(!s.buildings.some(b => b.kind === 'bunker'));
});


test('worker routes refuse hostile territory but resume when a neutral corridor opens', () => {
  const s = laborWorld(t => { t.hq.defenseDamage = 0; });
  for (const tile of s.hexes) tile.owner = 1;
  h(s, '0,0').owner = 0; h(s, '2,0').owner = null;
  s.buildings.find(b => b.id === 'hq0').hexId = '0,-1';
  assert(s.setDefendTarget(0, 'hq0').ok);
  const worker = unit(s, '0,0', 0, 'worker', 1); worker.buildingId = 'hq0';
  advance(s, 5000); assert.equal(worker.hexId, '0,0'); assert.equal(h(s, '2,0').owner, null);
  h(s, '1,0').owner = null;
  for (let i = 0; i < 200; i++) { advance(s, 100); assert.notEqual(h(s, worker.hexId).owner, 1, 'worker never enters enemy territory'); }
  assert.equal(h(s, '1,0').owner, 0); assert.equal(h(s, '2,0').owner, 0); assertOccupancy(s);
});

test('radius-four gathering coverage extends only through a completed forward HQ and its own worker queue', () => {
  const s = economyWorld(); ownAll(s); s.buildings.find(b => b.id === 'hq0').hexId = '0,0';
  const worker = s.units.find(u => u.owner === 0 && u.kind === 'worker'); worker.hexId = '0,3';
  h(s, '0,4').owner = h(s, '0,5').owner = null;
  s.buildings.push({ id: 'army-anchor', owner: 0, kind: 'bunker', hexId: '0,1', hp: 280, maxHp: 280, unitId: null, readyAtMs: 0 });
  assert(s.setDefendTarget(0, 'army-anchor').ok); assert(s.setAttackTarget(0, 'hq1').ok);
  advance(s, 20000); assert.equal(h(s, '0,4').owner, 0); assert.equal(h(s, '0,5').owner, null);
  const forward = extraHQ(s, 0, '0,2');
  advance(s, s.tune.hq.buildMs + s.tune.hq.workerProductionMs - 100);
  assert.equal(s.units.filter(u => u.buildingId === forward.id).length, 0); assert.equal(h(s, '0,5').owner, null);
  const restored = OperationSim.restore(JSON.parse(JSON.stringify(s.checkpoint())));
  advance(s, 12100); for (let i = 0; i < 121; i++) advance(restored, 100);
  assert.equal(h(s, '0,5').owner, 0); assert(s.units.some(u => u.buildingId === forward.id));
  assert.equal(worker.buildingId, 'hq0'); assert.equal(worker.hexId, '0,4', 'original workers stay bound to the original HQ coverage');
  assert.equal(s.players[0].targetId, 1); assert.deepEqual(restored.checkpoint(), s.checkpoint()); assertOccupancy(s);
});

test('gather radius remains tunable and old or missing gathering tuning is rejected', () => {
  const s = laborWorld(t => { t.hq.workerGatherRadius = 2; }); ownAll(s);
  h(s, '-2,0').owner = null;
  const worker = unit(s, '-3,0', 0, 'worker', 1); worker.buildingId = 'hq0';
  advance(s, 10000); assert.equal(h(s, '-2,0').owner, null); assert.equal(worker.hexId, '-3,0');
  for (const radius of [undefined, 0, NaN, 1.5]) assert.throws(() => laborWorld(t => { t.hq.workerGatherRadius = radius; }), /gathering/);
  assert.equal(DEFAULT_TUNE.hq.cost, 16); assert.equal(DEFAULT_TUNE.hq.buildMs, 30000);
  assert.equal(DEFAULT_TUNE.hq.workerProductionMs, 8000); assert.equal(DEFAULT_TUNE.hq.workerGatherRadius, 4);
});

test('a worker standing on neutral radius five cannot capture it while returning toward a legal home-radius goal', () => {
  const s = laborWorld(); ownAll(s); s.buildings.find(b => b.id === 'hq0').hexId = '0,0';
  h(s, '0,5').owner = h(s, '0,4').owner = null;
  const worker = unit(s, '0,5', 0, 'worker', 1); worker.buildingId = 'hq0';
  advance(s, 100); assert.equal(h(s, '0,5').capture, 0); assert.equal(h(s, '0,5').owner, null);
  assert.equal(worker.fromHexId, '0,5'); assert.equal(worker.hexId, '0,4');
  advance(s, 10000); assert.equal(h(s, '0,4').owner, 0); assert.equal(h(s, '0,5').owner, null);
});

test('orphan workers choose the closest surviving completed HQ while ignoring the military anchor', () => {
  const s = economyWorld(); ownAll(s); s.buildings.find(b => b.id === 'hq0').hexId = '0,0';
  const forward = extraHQ(s, 0, '0,2'); advance(s, s.tune.hq.buildMs);
  const worker = s.units.find(u => u.buildingId === 'hq0'); worker.hexId = '0,4'; delete worker.fromHexId; delete worker.movingUntilMs;
  h(s, '0,5').owner = null;
  s.buildings.push({ id: 'distant-army-anchor', owner: 0, kind: 'bunker', hexId: '-5,0', hp: 280, maxHp: 280, unitId: null, readyAtMs: 0 });
  assert(s.setDefendTarget(0, 'distant-army-anchor').ok); assert(s.setAttackTarget(0, 'hq1').ok);
  advance(s, 1000); assert.equal(worker.hexId, '0,4'); assert.equal(h(s, '0,5').capture, 0);
  s.buildings.find(b => b.id === 'hq0').hp = 0; advance(s, 100);
  assert.equal(worker.buildingId, null); assert.equal(worker.hexId, '0,5'); assert.equal(s.players[0].defendTargetId, 'distant-army-anchor');
  advance(s, 1000); assert.equal(h(s, '0,5').captureUnitId, worker.id, 'orphan starts gathering before the new HQ can produce another worker');
  advance(s, 6000); assert.equal(h(s, '0,5').owner, 0); assert(s.buildings.includes(forward)); assertOccupancy(s);
});

console.log(`${passed} Operation C simulation behavior tests passed.`);
assert.equal(failed, 0, `${failed} simulation behavior tests failed`);
