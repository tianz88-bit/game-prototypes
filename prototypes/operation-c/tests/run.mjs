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
  assert.equal(s.units.length, 2, 'both affordable connected placements spawn immediately at the same simulation time');
});

test('all presentation settings, including event capacity, leave authoritative state and entity IDs identical', () => {
  assert.deepEqual(DEFAULT_TUNE.presentation, { captureFlipMs: 900, captureLift: 0.9, shotTraceMs: 220, maxShotEvents: 128 });
  const normal = fixture();
  const variants = [normal, ...[0, 2].map(cap => fixture(t => {
    t.presentation = { captureFlipMs: 99999, captureLift: 10, shotTraceMs: 1, maxShotEvents: cap };
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
    const duration = 1000 * (owner === null ? 1 : 2);
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
  assert.equal(gun.hp, 28); assert(gun.retreatUntilMs > exposed.timeMs);
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

test('both aircraft cost twelve, cannot capture, and share spawn occupancy with ground troops', () => {
  for (const kind of ['helicopter', 'fighter']) {
    assert.equal(DEFAULT_TUNE.cards[kind].cost, 12); assert.equal(DEFAULT_TUNE.cards[kind].captureRate, 0);
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
  for (let i = 0; i < 600; i++) {
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

console.log(`${passed} Operation C simulation behavior tests passed.`);
