import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
const require = createRequire(process.env.OPERATION_C_DEPENDENCIES || import.meta.url), ts = require('typescript');
const tune = JSON.parse(await readFile(new URL('../tune.json', import.meta.url), 'utf8'));
const urls = new Map();
async function load(relative, imports = {}) {
  let source = await readFile(new URL(relative, import.meta.url), 'utf8');
  source = source.replace("import tuneJson from '../tune.json';", `const tuneJson = ${JSON.stringify(tune)};`);
  let code = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
  code = code.replace(/from (['"])([^'"]+)\1/g, (all, quote, path) => imports[path] ? `from ${JSON.stringify(imports[path])}` : all);
  const url = `data:text/javascript;base64,${Buffer.from(code).toString('base64')}`; urls.set(relative, url); return import(url);
}
const mapModule = await load('../src/maps.ts');
const simModule = await load('../src/sim.ts', { './maps': urls.get('../src/maps.ts') }), protocol = await load('../src/online-protocol.ts', { './maps': urls.get('../src/maps.ts') });
const roomModule = await load('../server/src/room.ts', { '../../src/sim': urls.get('../src/sim.ts'), '../../src/online-protocol': urls.get('../src/online-protocol.ts'), '../../src/maps': urls.get('../src/maps.ts') });
const worker = await load('../server/src/index.ts', { './room': urls.get('../server/src/room.ts'), '../../src/online-protocol': urls.get('../src/online-protocol.ts') });
const { OperationSim, DEFAULT_LOADOUT } = simModule, { OnlineRoom } = roomModule;
const jsonShape = value => JSON.parse(JSON.stringify(value));
let passed = 0;
async function test(name, run) { await run(); passed++; console.log(`PASS ${name}`); }

function harness(liveEconomy = false) {
  let wall = 1000000, tokenSerial = 0;
  const messages = new Map(), closed = [], mirrors = new Map();
  const env = { now: () => wall, token: () => (++tokenSerial).toString(16).padStart(32, '0'),
    send: (id, message) => {
      if (!messages.has(id)) messages.set(id, []);
      const cloned = structuredClone(message); messages.get(id).push(cloned);
      if (cloned.t === 'state') { const next = protocol.applyOnlineState(mirrors.get(id) ?? null, cloned); assert(next, `delta gap for ${id}`); mirrors.set(id, next); }
    }, close: (id, code, reason) => closed.push({ id, code, reason }) };
  const roomTune = structuredClone(tune); if (!liveEconomy) { roomTune.hq.workerLimit = 0; roomTune.hq.captureRings = 2; }
  let room = new OnlineRoom('ABCDE', env, roomTune);
  const send = (id, message) => room.receive(id, JSON.stringify(message));
  const latest = (id, type) => messages.get(id)?.filter(m => m.t === type).at(-1);
  const step = (ms, quantum = 100) => { for (let left = ms; left > 0;) { const dt = Math.min(left, quantum); wall += dt; room.advance(); left -= dt; } };
  const connect = (id, token) => room.connect(id, token);
  const ready = () => { send('a', { t: 'ready', requestId: 'ready-a', ready: true }); send('b', { t: 'ready', requestId: 'ready-b', ready: true }); step(3000); };
  return { env, messages, mirrors, closed, send, latest, step, connect, ready,
    get room() { return room; }, set room(value) { room = value; }, get wall() { return wall; }, set wall(value) { wall = value; } };
}

await test('strict wire validation rejects owner spoofing, arbitrary simulation data, malformed and oversized input', () => {
  const valid = { t: 'command', requestId: 'p1', command: { kind: 'place', hexId: '-4,0', card: 'infantry' } };
  assert(protocol.parseOnlineClientMessage(JSON.stringify(valid)));
  for (const invalid of [{ ...valid, owner: 1 }, { ...valid, command: { ...valid.command, owner: 1 } },
    { t: 'pause', requestId: 1 }, { t: 'state', entities: {} }, { ...valid, requestId: {} },
    { t: 'command', requestId: 1, command: { kind: 'target', targetId: 2 } },
    { t: 'loadout', requestId: 1, cards: Array(9).fill('infantry') }]) assert.equal(protocol.parseOnlineClientMessage(JSON.stringify(invalid)), null);
  assert.equal(protocol.parseOnlineClientMessage('{bad'), null);
  assert.equal(protocol.parseOnlineClientMessage('🦊'.repeat(2000)), null);
  assert.equal(protocol.generateRoomCode(a => { a.fill(255); return a; }).length, 5);
});

await test('two private seats have distinct tokens; room full and invalid token cannot claim disconnected seats', () => {
  const h = harness(); assert.equal(h.connect('a').seat, 0); assert.equal(h.connect('b').seat, 1);
  const ta = h.latest('a', 'welcome').token, tb = h.latest('b', 'welcome').token;
  assert.notEqual(ta, tb); assert.equal(h.connect('c').reason, 'roomFull');
  assert.equal(h.connect('c', 'f'.repeat(32)).reason, 'invalidToken'); h.room.disconnect('a');
  assert.equal(h.connect('c').reason, 'roomFull'); assert.equal(h.connect('a2', ta).seat, 0);
  assert(!JSON.stringify(h.messages.get('a')).includes(tb));
  for (const list of h.messages.values()) for (const m of list) if (m.t !== 'welcome') {
    const text = JSON.stringify(m); assert(!text.includes(ta)); assert(!text.includes(tb));
  }
});

await test('server validates loadouts and only two ready connected humans start the countdown', () => {
  const h = harness(); h.connect('a'); h.connect('b');
  for (const [i, cards] of [[], ['fighter'], ['infantry', 'infantry'], ['infantry', 'missile'], ['infantry', '__proto__']].entries()) {
    h.send('a', { t: 'loadout', requestId: `invalid-${i}`, cards }); assert.equal(h.latest('a', 'ack').ok, false);
  }
  h.send('a', { t: 'loadout', requestId: 'la', cards: ['infantry', 'helicopter'] }); assert(h.latest('a', 'ack').ok);
  h.send('b', { t: 'loadout', requestId: 'lb', cards: ['tank'] }); assert(h.latest('b', 'ack').ok);
  h.send('a', { t: 'ready', requestId: 'ra', ready: true }); assert.equal(h.room.phase, 'lobby');
  h.send('b', { t: 'ready', requestId: 'rb', ready: true }); assert.equal(h.room.phase, 'countdown');
  const deadline = h.room.lobby().countdownEndsAtMs;
  h.step(500); h.send('b', { t: 'ready', requestId: 'rb-again', ready: true }); assert.equal(h.room.lobby().countdownEndsAtMs, deadline);
  h.send('a', { t: 'command', requestId: 'early', command: { kind: 'place', hexId: '-4,0', card: 'infantry' } }); assert(!h.latest('a', 'ack').ok);
  h.step(2500); assert.equal(h.room.phase, 'playing'); assert.deepEqual(h.room.sim.loadouts, [['infantry', 'helicopter'], ['tank']]);
  assert.equal(h.room.sim.checkpoint().botEnabled, false);
});

await test('countdown cancels on disconnect and needs a fresh ready after authenticated reconnect', () => {
  const h = harness(); h.connect('a'); h.connect('b'); const token = h.latest('b', 'welcome').token;
  h.send('a', { t: 'ready', requestId: 1, ready: true }); h.send('b', { t: 'ready', requestId: 1, ready: true });
  h.room.disconnect('b'); h.step(4000); assert.equal(h.room.phase, 'lobby'); assert.equal(h.room.sim, null);
  h.connect('b2', token); assert.equal(h.room.phase, 'lobby');
  h.send('b2', { t: 'ready', requestId: 2, ready: true }); h.step(3000); assert.equal(h.room.phase, 'playing');
});

await test('commands derive their player from the seat and enforce territory, loadout, tiers and foreign ownership', () => {
  const h = harness(); h.connect('a'); h.connect('b'); h.ready();
  h.send('a', { t: 'command', requestId: 'p', command: { kind: 'place', hexId: '-4,0', card: 'infantry' } }); assert(h.latest('a', 'ack').ok);
  const building = h.room.sim.buildings.find(b => b.kind !== 'hq'); assert.equal(building.owner, 0);
  h.send('b', { t: 'command', requestId: 'steal', command: { kind: 'sell', buildingId: building.id } }); assert(!h.latest('b', 'ack').ok);
  h.send('b', { t: 'command', requestId: 'build-foreign', command: { kind: 'place', hexId: '-6,0', card: 'infantry' } }); assert(!h.latest('b', 'ack').ok);
  h.send('a', { t: 'command', requestId: 't2', command: { kind: 'place', hexId: '-6,0', card: 'helicopter' } }); assert(!h.latest('a', 'ack').ok);
  h.send('a', { t: 'command', requestId: 'upgrade-card', command: { kind: 'place', hexId: '-6,0', card: 'mlrs' } }); assert(!h.latest('a', 'ack').ok);
  h.send('b', { t: 'command', requestId: 'target', command: { kind: 'target', targetId: 0 } });
  assert.equal(h.room.sim.players[1].targetId, 0); assert.equal(h.room.sim.players[0].targetId, 0);
});

await test('retry deduplication survives reconnect and checkpoint; request ID reuse cannot mutate a second command', () => {
  const h = harness(); h.connect('a'); h.connect('b'); h.ready(); const token = h.latest('a', 'welcome').token;
  const request = { t: 'command', requestId: 'once', command: { kind: 'place', hexId: '-4,0', card: 'infantry' } };
  h.send('a', request); h.send('a', request); assert(h.latest('a', 'ack').ok); assert.equal(h.room.sim.resources(0).committed, 5);
  h.send('a', { ...request, command: { kind: 'target', targetId: 1 } }); assert.equal(h.latest('a', 'error').code, 'requestIdReuse');
  const saved = JSON.parse(JSON.stringify(h.room.checkpoint())); h.room = OnlineRoom.restore(saved, h.env); h.connect('a2', token);
  h.send('a2', request); assert(h.latest('a2', 'ack').ok); assert.equal(h.room.sim.resources(0).committed, 5);
});

await test('two independent client mirrors converge through 5Hz deltas, removals and mid-pulse reconnect', () => {
  const h = harness(); h.connect('a'); h.connect('b'); h.ready();
  assert(h.latest('a', 'state').full); const initial = h.latest('a', 'state');
  h.step(100); assert.equal(h.latest('a', 'state').revision, initial.revision);
  h.send('a', { t: 'command', requestId: 1, command: { kind: 'place', hexId: '-4,0', card: 'infantry' } });
  const token = h.latest('b', 'welcome').token; h.room.disconnect('b'); h.connect('b2', token);
  assert.equal(h.latest('b2', 'state').timeMs, 0, 'reconnect uses the revisioned baseline, never the intermediate tick');
  h.step(100); const delta = h.latest('a', 'state'); assert.equal(delta.full, false); assert.equal(delta.entities.buildings.length, 1);
  assert(delta.entities.hexes.length < 271); assert(JSON.stringify(delta).length < JSON.stringify(initial).length / 2);
  assert.deepEqual(h.mirrors.get('a'), h.mirrors.get('b2'));
  const id = h.room.sim.buildings.find(b => b.kind !== 'hq').id;
  h.send('a', { t: 'command', requestId: 2, command: { kind: 'sell', buildingId: id } }); h.step(200);
  assert(h.latest('a', 'state').removed.buildings.includes(id)); assert.deepEqual(h.mirrors.get('a'), h.mirrors.get('b2'));
  assert.equal(protocol.applyOnlineState(null, delta), null);
  assert.equal(protocol.applyOnlineState({ ...initial, revision: 999 }, delta), null);
});

await test('disconnect does not pause orders or production; both-offline elapsed time is caught up on reconnect', () => {
  const h = harness(); h.connect('a'); h.connect('b'); h.ready(); const token = h.latest('a', 'welcome').token;
  h.send('a', { t: 'command', requestId: 1, command: { kind: 'place', hexId: '-4,0', card: 'infantry' } });
  h.send('a', { t: 'command', requestId: 2, command: { kind: 'target', targetId: 1 } });
  h.room.disconnect('a'); h.step(4000); assert.equal(h.room.sim.timeMs, 4000); assert(h.room.sim.units.length);
  assert.equal(h.room.sim.players[0].targetId, 1);
  h.room.disconnect('b'); assert.equal(h.room.nextWakeAt(), null);
  h.wall += 25000; h.connect('a2', token); h.room.advance(); h.room.advance(); h.room.advance();
  assert.equal(h.room.sim.timeMs, 29000); assert.equal(h.room.sim.players[0].targetId, 1);
  h.send('a', { t: 'command', requestId: 3, command: { kind: 'target', targetId: 0 } });
  assert.equal(h.room.sim.players[0].targetId, 1, 'stale replaced socket cannot command the seat');
});

await test('rate limits and no-pause protocol reject floods without changing gameplay ownership', () => {
  const h = harness(); h.connect('a'); h.connect('b'); h.ready();
  for (let i = 0; i < 60; i++) h.send('a', { t: 'ping', clientMs: i });
  assert.equal(h.latest('a', 'error').code, 'rateLimited'); assert.equal(h.room.sim.players[0].targetId, 0);
  h.step(1000); h.send('a', { t: 'pause', requestId: 'pause' }); assert.equal(h.latest('a', 'error').code, 'badMessage');
  const previous = h.room.sim.timeMs; h.step(1000); assert.equal(h.room.sim.timeMs, previous + 1000);
});

await test('sim JSON checkpoint restores private IDs, fractional clock, stranded debt, pending releases and shared hex references', () => {
  const s = new OperationSim({ bot: false }); for (const x of s.hexes) x.owner = 0;
  assert(s.place(0, '0,0', 'tank').ok); const tank = s.buildings.find(b => b.kind === 'tank');
  for (const x of s.hexes.filter(h => h.lockedBy === tank.id && h.id !== tank.hexId).slice(0, 3)) { x.owner = 1; x.lockedBy = null; delete x.commitment; }
  tank.hp = 0; s.tick(150); assert.equal(s.resources(0).stranded, 3); assert(s.pendingReleases.length);
  assert(s.startResearch(0).ok);
  const checkpoint = JSON.parse(JSON.stringify(s.checkpoint())), restored = OperationSim.restore(checkpoint);
  assert.deepEqual(jsonShape(restored.checkpoint()), jsonShape(s.checkpoint()));
  assert.strictEqual(restored.neighbors('0,0')[0], restored.hexes.find(h => h.id === restored.neighbors('0,0')[0].id));
  for (const sim of [s, restored]) {
    const site = sim.hexes.find(x => sim.placement(0, x.id, 'infantry').ok); assert(site); assert(sim.place(0, site.id, 'infantry').ok); sim.tick(3050);
  }
  assert.deepEqual(jsonShape(restored.checkpoint()), jsonShape(s.checkpoint()));
  for (let i = 0; i < 350; i++) { s.tick(100); restored.tick(100); }
  assert.deepEqual(jsonShape(restored.checkpoint()), jsonShape(s.checkpoint())); assert.equal(restored.resources(0).stranded, 3);
  assert.throws(() => OperationSim.restore({ ...checkpoint, version: 99 }), /Unsupported/);
});

await test('room recovery preserves both humans, order, token identity, revisions and exact future simulation', () => {
  const h = harness(); h.connect('a'); h.connect('b'); h.ready(); const ta = h.latest('a', 'welcome').token, tb = h.latest('b', 'welcome').token;
  h.send('a', { t: 'command', requestId: 'p', command: { kind: 'place', hexId: '-4,0', card: 'infantry' } }); h.step(3500);
  const saved = JSON.parse(JSON.stringify(h.room.checkpoint())), original = h.room;
  h.room = OnlineRoom.restore(saved, h.env); assert(h.connect('a2', ta).ok); assert(h.connect('b2', tb).ok);
  for (let i = 0; i < 40; i++) { h.wall += 100; original.advance(); h.room.advance(); }
  assert.deepEqual(jsonShape(h.room.sim.checkpoint()), jsonShape(original.sim.checkpoint()));
  assert.equal(h.room.revision, original.revision); assert.deepEqual(h.mirrors.get('a2'), h.mirrors.get('b2'));
});

await test('HQ elimination sends winner/ended state to both clients and prevents later game commands', () => {
  const h = harness(); h.connect('a'); h.connect('b'); h.ready();
  h.room.sim.buildings.find(b => b.id === 'hq1').hp = 0; h.step(100);
  assert.equal(h.room.phase, 'ended'); assert.equal(h.latest('a', 'state').winner, 0); assert.equal(h.latest('b', 'lobby').phase, 'ended');
  h.send('b', { t: 'command', requestId: 'after', command: { kind: 'target', targetId: 1 } }); assert(!h.latest('b', 'ack').ok);
});

await test('two human contexts complete a real authoritative match from build/target commands without host simulation', () => {
  const h = harness(); h.connect('a'); h.connect('b'); h.ready();
  h.send('a', { t: 'command', requestId: 'build', command: { kind: 'place', hexId: '-4,0', card: 'tank' } });
  h.send('a', { t: 'command', requestId: 'attack', command: { kind: 'target', targetId: 1 } });
  for (let t = 0; t < 600000 && h.room.phase === 'playing'; t += 100) h.step(100);
  assert.equal(h.room.phase, 'ended'); assert.equal(h.room.sim.winner, 0);
  assert.equal(h.mirrors.get('a').winner, 0); assert.deepEqual(h.mirrors.get('a'), h.mirrors.get('b'));
  assert(h.room.sim.timeMs > 3000); assert(!h.room.sim.players[1].alive);
});

await test('Worker routing is isolated and rejects invalid routes or non-WebSocket requests', async () => {
  const env = { OPERATION_C_ROOMS: { idFromName: code => code, get: () => ({ fetch: async () => new Response('isolated') }) } };
  const health = await worker.default.fetch(new Request('https://example/health'), env); const status = await health.json();
  assert.equal(status.service, 'operation-c-online'); assert.equal(status.protocol, 9);
  assert.equal((await worker.default.fetch(new Request('https://example/ws/ABCDE'), env)).status, 426);
  assert.equal((await worker.default.fetch(new Request('https://example/ws/abcde'), env)).status, 404);
  assert.equal(await (await worker.default.fetch(new Request('https://example/ws/ABCDE', { headers: { upgrade: 'websocket' } }), env)).text(), 'isolated');
});

await test('Durable Object wrapper persists authenticated seats, catches up after restart, and rebinds retained sockets', async () => {
  const NativeResponse = globalThis.Response, nativeNow = Date.now; let wall = 2000000;
  class TestSocket {
    attachment = null; messages = []; closed = false;
    send(text) { this.peer.messages.push(JSON.parse(text)); }
    close() { this.closed = true; }
    accept() {}
    serializeAttachment(a) { this.attachment = structuredClone(a); }
    deserializeAttachment() { return this.attachment; }
  }
  class Pair { constructor() { this[0] = new TestSocket(); this[1] = new TestSocket(); this[0].peer = this[1]; this[1].peer = this[0]; } }
  class UpgradeResponse extends NativeResponse { constructor(body, init) { super(body, init?.status === 101 ? { status: 200 } : init); if (init?.status === 101) { Object.defineProperty(this, 'status', { value: 101 }); this.webSocket = init.webSocket; } } }
  const records = new Map(), sockets = []; let puts = 0, alarmAt = null;
  const state = { storage: {
    async get(key) { return structuredClone(records.get(key)); }, async put(key, value) { puts++; records.set(key, structuredClone(value)); },
    async deleteAll() { records.clear(); }, async setAlarm(at) { alarmAt = at; }, async deleteAlarm() { alarmAt = null; },
  }, blockConcurrencyWhile: cb => cb(), acceptWebSocket: socket => sockets.push(socket), getWebSockets: () => sockets.filter(s => !s.closed) };
  const env = { OPERATION_C_ROOMS: {} };
  try {
    globalThis.WebSocketPair = Pair; globalThis.Response = UpgradeResponse; Date.now = () => wall;
    let object = new worker.OperationCRoom(state, env);
    const request = query => new Request(`https://example/ws/ABCDE${query}`, { headers: { upgrade: 'websocket' } });
    const a = await object.fetch(request('?create=1')), b = await object.fetch(request(''));
    assert.equal(a.status, 101); assert.equal(b.status, 101); assert(puts >= 2);
    const token = a.webSocket.messages.find(m => m.t === 'welcome').token;
    const full = await object.fetch(request('')); assert.equal(full.status, 101);
    assert.equal(full.webSocket.messages[0].code, 'roomFull');
    const invalid = await object.fetch(request(`?token=${'f'.repeat(32)}`)); assert.equal(invalid.status, 101);
    assert.equal(invalid.webSocket.messages[0].code, 'invalidToken');
    assert.equal(sockets.length, 2, 'rejected sockets never obtain authenticated room attachments');
    await object.webSocketMessage(sockets[0], JSON.stringify({ t: 'ready', requestId: 1, ready: true }));
    await object.webSocketMessage(sockets[1], JSON.stringify({ t: 'ready', requestId: 1, ready: true }));
    wall += 3000; await object.alarm(); assert(alarmAt > wall);
    const opening = object.room.sim.hexes.find(x => object.room.sim.placement(0, x.id, 'infantry').ok); assert(opening);
    await object.webSocketMessage(sockets[0], JSON.stringify({ t: 'command', requestId: 2, command: { kind: 'place', hexId: opening.id, card: 'infantry' } }));
    wall += 5000; object = new worker.OperationCRoom(state, env); await object.alarm();
    const stored = records.get('operation-c-room-v1'); assert.equal(stored.sim.timeMs, 5000); assert.equal(stored.sim.botEnabled, false);
    assert.equal(stored.seats[0].token, token); assert.equal(stored.sim.buildings.filter(b => b.kind !== 'hq').length, 1);
    assert(a.webSocket.messages.filter(m => m.t === 'welcome').length >= 2);
    const ack = a.webSocket.messages.find(m => m.t === 'ack' && m.requestId === 2); assert(ack.ok);
    for (const version of [1, 2, 3, 4, 5, 6, 7, 8]) for (const layer of ['room', 'sim']) {
      const incompatible = layer === 'room' ? { ...stored, version } : { ...stored, sim: { ...stored.sim, version } };
      records.set('operation-c-room-v1', incompatible); const putsBefore = puts;
      const oldRoom = new worker.OperationCRoom(state, env), rejected = await oldRoom.fetch(request(''));
      assert.equal(rejected.status, 101); assert.equal(rejected.webSocket.messages[0].code, 'versionMismatch');
      assert.equal(alarmAt, null, 'unsupported persisted rooms stop waking and fail safely without HTTP 500');
      assert.equal(puts, putsBefore); assert.deepEqual(records.get('operation-c-room-v1'), incompatible, 'version rejection preserves old storage');
    }
  } finally { globalThis.Response = NativeResponse; Date.now = nativeNow; delete globalThis.WebSocketPair; }
});

await test('nuclear readiness and flight payload stay private through full snapshots, deltas, resync and recovered reconnect', () => {
  const h = harness(); h.connect('a'); h.connect('b'); h.ready();
  const ta = h.latest('a', 'welcome').token, tb = h.latest('b', 'welcome').token;
  for (const hex of h.room.sim.hexes) hex.owner = 0; h.room.sim.players[0].techTier = 3;
  h.send('a', { t: 'command', requestId: 'silo-build', command: { kind: 'place', hexId: '0,0', card: 'silo' } }); assert(h.latest('a', 'ack').ok);
  h.step(75000); const b = h.room.sim.buildings.find(b => b.kind === 'silo');
  const ownReady = h.mirrors.get('a').entities.buildings.find(x => x.id === b.id);
  const enemyReady = h.mirrors.get('b').entities.buildings.find(x => x.id === b.id);
  assert.equal(ownReady.nukeReadyAtMs, 75000); assert.equal(enemyReady.nukeReadyAtMs, undefined); assert.equal(enemyReady.readyAtMs, 0);
  h.send('b', { t: 'command', requestId: 'steal-launch', command: { kind: 'launchNuke', buildingId: b.id, hexId: '3,-3' } }); assert(!h.latest('b', 'ack').ok);
  h.send('a', { t: 'command', requestId: 'launch', command: { kind: 'launchNuke', buildingId: b.id, hexId: '3,-3' } }); assert(h.latest('a', 'ack').ok);
  h.step(200); const flightId = h.room.sim.nukeFlights[0].id;
  assert.equal(h.mirrors.get('a').entities.nukeFlights[0].targetHexId, '3,-3');
  assert.equal(h.mirrors.get('b').entities.nukeFlights.length, 0);
  h.send('b', { t: 'resync' }); assert(h.latest('b', 'state').full);
  for (const frame of h.messages.get('b').filter(m => m.t === 'state')) {
    assert.equal(frame.entities.nukeFlights.length, 0); assert.equal(frame.removed.nukeFlights.length, 0);
    assert(!JSON.stringify(frame).includes(flightId));
    for (const building of frame.entities.buildings) if (building.id === b.id) { assert.equal(building.nukeReadyAtMs, undefined); assert.equal(building.readyAtMs, 0); }
  }
  const saved = JSON.parse(JSON.stringify(h.room.checkpoint())); assert.equal(saved.sim.nukeFlights[0].targetHexId, '3,-3');
  assert.equal(saved.lastStates[0].entities.nukeFlights.length, 1); assert.equal(saved.lastStates[1].entities.nukeFlights.length, 0);
  h.room = OnlineRoom.restore(saved, h.env); assert(h.connect('a2', ta).ok); assert(h.connect('b2', tb).ok);
  assert.equal(h.latest('a2', 'state').entities.nukeFlights.length, 1); assert.equal(h.latest('b2', 'state').entities.nukeFlights.length, 0);
  assert.equal(h.latest('b2', 'state').entities.buildings.find(x => x.id === b.id).nukeReadyAtMs, undefined);
  h.step(7800); assert.equal(h.room.sim.nukeFlights.length, 0);
  assert.deepEqual(h.mirrors.get('a2').entities.nuclearImpacts, h.mirrors.get('b2').entities.nuclearImpacts);
  assert.equal(h.mirrors.get('b2').entities.nuclearImpacts[0].hexId, '3,-3');
  assert.equal(h.latest('b2', 'state').removed.nukeFlights.length, 0);
});

await test('nuclear flight IDs use separate owner sequences rather than leaking another seat launch count', () => {
  const s = new OperationSim({ bot: false }); for (const hex of s.hexes) hex.owner = 0; s.players[0].techTier = 3;
  assert(s.place(0, '0,0', 'silo').ok); const first = s.buildings.find(b => b.kind === 'silo'); first.nukeReadyAtMs = 0; first.completeAtMs = 0;
  assert(s.launchNuke(0, first.id, '0,2').ok);
  const enemy = { ...first, id: 'enemy-silo', owner: 1, hexId: '4,0', nukeReadyAtMs: 0 }; s.buildings.push(enemy);
  assert(s.launchNuke(1, enemy.id, '0,3').ok); first.nukeReadyAtMs = 0; assert(s.launchNuke(0, first.id, '0,4').ok);
  assert.deepEqual(s.nukeFlights.filter(f => f.owner === 0).map(f => f.id), ['nuke-0-1', 'nuke-0-2']);
});

await test('friendly defend commands validate building ownership and reject unit IDs or owner spoofing', () => {
  const h = harness(); h.connect('a'); h.connect('b'); h.ready();
  h.send('a', { t: 'command', requestId: 1, command: { kind: 'place', hexId: '-4,0', card: 'infantry' } }); h.step(3000);
  const b = h.room.sim.buildings.find(b => b.kind === 'infantry');
  h.send('a', { t: 'command', requestId: 2, command: { kind: 'defend', entityId: b.id } }); assert(h.latest('a', 'ack').ok);
  assert.equal(h.room.sim.players[0].defendTargetId, b.id);
  h.send('a', { t: 'command', requestId: 3, command: { kind: 'defend', entityId: b.unitId } }); assert(!h.latest('a', 'ack').ok);
  h.send('b', { t: 'command', requestId: 4, command: { kind: 'defend', entityId: b.id } }); assert(!h.latest('b', 'ack').ok);
  h.send('b', { t: 'command', requestId: 5, command: { kind: 'defend', entityId: b.id, owner: 0 } }); assert.equal(h.latest('b', 'error').code, 'badMessage');
  h.send('a', { t: 'command', requestId: 6, command: { kind: 'launchNuke', buildingId: b.id, hexId: '0,0', owner: 1 } }); assert.equal(h.latest('a', 'error').code, 'badMessage');
  h.send('a', { t: 'command', requestId: 7, command: { kind: 'target', targetId: 0 } }); assert.equal(h.room.sim.players[0].defendTargetId, null);
});

await test('v9 welcome carries authoritative individual sight, classes and bonuses; recovery retains them and rejects older rules', () => {
  const h = harness(); h.connect('a'); h.connect('b'); const welcome = h.latest('a', 'welcome');
  assert.equal(welcome.v, 9); assert.equal(welcome.tune.cards.tank.damageClass, 'armoured');
  assert.equal(welcome.tune.cards.tank.sightRange, 3); assert.equal(welcome.tune.cards.mlrs.sightRange, 6);
  assert.equal(welcome.tune.cards.fighter.damageClass, 'light'); assert.equal(welcome.tune.cards.silo.damageClass, 'structure');
  assert.deepEqual(welcome.tune.cards.destroyer.damageBonus, { armoured: 24 });
  h.ready(); const saved = JSON.parse(JSON.stringify(h.room.checkpoint()));
  assert.equal(saved.version, 9); assert.equal(saved.sim.version, 9);
  const recovered = OnlineRoom.restore(saved, h.env);
  assert.deepEqual(recovered.sim.tune.cards, h.room.sim.tune.cards);
  for (const version of [1, 2, 3, 4, 5, 6, 7, 8]) {
    assert.throws(() => OnlineRoom.restore({ ...saved, version }, h.env), /Unsupported/);
    assert.throws(() => OperationSim.restore({ ...saved.sim, version }), /Unsupported/);
  }
});

await test('authoritative individual sight stays local while workers gather and both seats receive the fully visible battlefield', () => {
  const h = harness(); h.connect('a'); h.connect('b'); h.ready();
  const s = h.room.sim, site = s.hexes.find(x => x.id === '-2,1'); site.owner = null;
  const actor = { id: 'sight-actor', owner: 0, kind: 'tank', hexId: '-4,0', hp: 180, maxHp: 180, attacking: false, buildingId: null, nextAttackAtMs: 0 };
  const enemy = { ...actor, id: 'sight-enemy', owner: 1, hexId: '0,0', movingUntilMs: 100000 };
  const ally = { ...actor, id: 'sight-ally', kind: 'scout', hexId: '-1,1', movingUntilMs: 100000 };
  const worker = { ...actor, id: 'sight-worker', kind: 'worker', hexId: site.id, hp: 1, maxHp: 1 };
  s.units.push(actor, enemy, ally, worker); h.step(200);
  assert(site.capture > 0); const progress = site.capture; assert.equal(actor.hexId, '-4,0', 'allied spotting cannot draw a defender out of home');
  for (const seat of ['a', 'b']) {
    const mirror = h.mirrors.get(seat);
    assert(mirror.entities.units.some(x => x.id === enemy.id && x.hexId === '0,0'), 'full visibility is independent of engagement sight');
    assert(mirror.entities.units.some(x => x.id === ally.id));
  }
  enemy.hexId = '-1,0'; h.step(200);
  assert(site.capture > progress, 'worker gathering continues during nearby military engagement'); assert.equal(actor.fromHexId, '-4,0');
  assert.equal(actor.hexId, '-3,0', 'server advances toward a newly visible target beyond weapon range');
  assert.equal(actor.attacking, false, 'individual sight does not extend weapon range');
  for (const seat of ['a', 'b']) assert.equal(h.mirrors.get(seat).entities.units.find(x => x.id === actor.id).hexId, actor.hexId);
});

await test('member-scaled capture and reinforcement merge stay authoritative through v9 room recovery and both seat mirrors', () => {
  const h = harness(); h.connect('a'); h.connect('b'); h.ready();
  const aToken = h.latest('a', 'welcome').token, bToken = h.latest('b', 'welcome').token;
  h.send('a', { t: 'command', requestId: 'capture-producer', command: { kind: 'place', hexId: '-4,0', card: 'infantry' } });
  assert(h.latest('a', 'ack').ok); h.step(3000);
  const s = h.room.sim, producer = s.buildings.find(x => x.kind === 'infantry'), squad = s.units.find(x => x.id === producer.unitId);
  squad.hexId = '0,3'; delete squad.fromHexId; delete squad.movingUntilMs; squad.members = [0.1]; squad.hp = 0.1;
  const site = s.hexes.find(x => x.id === squad.hexId); site.owner = 1;
  h.step(1000); assert(Math.abs(site.capture - (1/45)) < 1e-10);
  s.reinforcements.push({ id: 'capture-network-incoming', unitId: squad.id, buildingId: producer.id, owner: 0, count: 4,
    fromHexId: producer.hexId, startedAtMs: s.timeMs, arriveAtMs: s.timeMs + 1000 });
  const saved = JSON.parse(JSON.stringify(h.room.checkpoint())); assert.equal(saved.version, 9);
  h.room = OnlineRoom.restore(saved, h.env); h.connect('a2', aToken); h.connect('b2', bToken);
  h.step(900);
  const restoredSquad = h.room.sim.units.find(x => x.id === squad.id), restoredSite = h.room.sim.hexes.find(x => x.id === site.id);
  assert.equal(restoredSquad.members.length, 1); assert(Math.abs(restoredSite.capture - (19/450)) < 1e-10);
  h.step(100); assert.equal(restoredSquad.members.length, 5); assert.equal(restoredSquad.members[0], 0.1);
  assert(Math.abs(restoredSite.capture - (4/75)) < 1e-10);
  for (const seat of ['a2', 'b2']) {
    const mirror = h.mirrors.get(seat);
    assert.equal(mirror.entities.units.find(x => x.id === squad.id).members.length, 5);
    assert(Math.abs(mirror.entities.hexes.find(x => x.id === site.id).capture - (4/75)) < 1e-10);
  }
});

await test('two-human rooms never execute bot decisions before or after v8 checkpoint recovery', () => {
  const h = harness(); h.connect('a'); h.connect('b'); h.ready(); h.step(60000);
  const saved = h.room.checkpoint(); assert.equal(saved.sim.botEnabled, false); assert.equal(saved.sim.botCard, 0);
  assert.equal(saved.sim.botOrderUntilMs, 0); assert.equal(h.room.sim.units.length, 0); assert.equal(h.room.sim.buildings.length, 2);
  assert(h.room.sim.players.every(p => p.targetId === p.id && !p.research && p.techTier === 1));
  assert.deepEqual(h.room.sim.players.map(p => h.room.sim.resources(p.id).committed), [0, 0]);
  h.room = OnlineRoom.restore(JSON.parse(JSON.stringify(saved)), h.env); h.step(30000);
  assert.equal(h.room.sim.buildings.length, 2); assert.equal(h.room.sim.units.length, 0); assert.equal(h.room.sim.checkpoint().botCard, 0);
});

await test('live v8 rooms start with six capacity, three workers and seven selectable cards per seat', () => {
  const h = harness(true); h.connect('a'); h.connect('b');
  for (const [i, cards] of [['infantry', 'worker'], ['infantry', 'hq'], [...DEFAULT_LOADOUT, 'helicopter']].entries()) {
    h.send('a', { t: 'loadout', requestId: `worker-invalid-${i}`, cards });
    assert(h.latest('a', 'ack')?.ok === false || h.latest('a', 'error')?.code === 'badMessage');
  }
  h.ready(); assert.equal(h.latest('a', 'welcome').v, 9);
  for (const seat of ['a', 'b']) {
    const mirror = h.mirrors.get(seat); assert.equal(mirror.entities.units.length, 6); assert(mirror.entities.units.every(u => u.kind === 'worker' && u.hp === 1));
    assert.deepEqual(mirror.resources.map(x => x.capacity), [6, 6]); assert(mirror.loadouts.every(x => x.length === 7));
  }
  const site = h.room.sim.hexes.find(x => h.room.sim.placement(0, x.id, 'infantry').ok); assert(site);
  h.send('a', { t: 'command', requestId: 'first-paid', command: { kind: 'place', hexId: site.id, card: 'infantry' } });
  assert(h.latest('a', 'ack').ok); assert.equal(h.room.sim.resources(0).committed, 5);
});

await test('HQ worker queues, linked research, technology drop and surviving orphans replicate through v9 reconnect', () => {
  const h = harness(true); h.connect('a'); h.connect('b'); h.ready();
  const tokens = [h.latest('a', 'welcome').token, h.latest('b', 'welcome').token]; for (const hex of h.room.sim.hexes) hex.owner = 0;
  h.send('a', { t: 'command', requestId: 'build-hq', command: { kind: 'place', hexId: '0,0', card: 'hq' } }); assert(h.latest('a', 'ack').ok);
  const b = h.room.sim.buildings.find(x => x.hexId === '0,0'), count = () => h.room.sim.units.filter(u => u.buildingId === b.id).length;
  assert.equal(b.committedCost, 16); h.step(30000); assert.equal(count(), 0); h.step(8000); assert.equal(count(), 1);
  const saved = JSON.parse(JSON.stringify(h.room.checkpoint())); assert.equal(saved.version, 9); assert.equal(saved.sim.version, 9);
  h.room = OnlineRoom.restore(saved, h.env); h.connect('a2', tokens[0]); h.connect('b2', tokens[1]); h.step(16000); assert.equal(count(), 3);
  h.send('a2', { t: 'command', requestId: 'hq-specific-research', command: { kind: 'research', hqId: b.id } }); assert(h.latest('a2', 'ack').ok);
  assert.equal(h.room.sim.players[0].research.hqId, b.id); h.step(30000); assert.equal(h.room.sim.players[0].techTier, 2);
  const live = h.room.sim.buildings.find(x => x.id === b.id), workers = h.room.sim.units.filter(u => u.buildingId === b.id).map(u => u.id);
  live.hp = 0; h.step(200); assert.equal(h.room.phase, 'playing'); assert.equal(h.room.sim.players[0].techTier, 1);
  for (const seat of ['a2', 'b2']) {
    const mirror = h.mirrors.get(seat); assert(!mirror.entities.buildings.some(x => x.id === b.id));
    assert(workers.every(id => mirror.entities.units.some(u => u.id === id && u.buildingId === null)));
    assert.equal(mirror.players[0].techTier, 1); assert(mirror.players[0].alive);
  }
});

await test('wire Attack Here and construction cancellation enforce ownership and clear destroyed building targets without enabling completed sales', () => {
  const h = harness(true); h.connect('a'); h.connect('b'); h.ready(); for (const hex of h.room.sim.hexes) hex.owner = 0;
  h.send('a', { t: 'command', requestId: 'expansion', command: { kind: 'place', hexId: '0,0', card: 'hq' } }); assert(h.latest('a', 'ack').ok);
  const building = h.room.sim.buildings.find(x => x.hexId === '0,0');
  h.send('b', { t: 'command', requestId: 'target-expansion', command: { kind: 'attackBuilding', entityId: building.id } }); assert(h.latest('b', 'ack').ok);
  h.send('b', { t: 'command', requestId: 'steal-cancel', command: { kind: 'cancelConstruction', buildingId: building.id } }); assert(!h.latest('b', 'ack').ok);
  h.send('a', { t: 'command', requestId: 'cancel-own-expansion', command: { kind: 'cancelConstruction', buildingId: building.id } }); assert(h.latest('a', 'ack').ok);
  assert.equal(h.room.sim.players[1].targetId, 1); assert.equal(h.room.sim.players[1].attackTargetId, null); assert.equal(h.room.sim.players[1].defendTargetId, 'hq1');
  assert.equal(h.room.sim.resources(0).committed, 0);
  for (const kind of ['sell', 'cancelConstruction']) {
    h.send('a', { t: 'command', requestId: `completed-${kind}`, command: { kind, buildingId: 'hq0' } }); assert(!h.latest('a', 'ack').ok);
  }
  h.send('a', { t: 'command', requestId: 'spoof-attack', command: { kind: 'attackBuilding', entityId: 'hq1', owner: 1 } }); assert.equal(h.latest('a', 'error').code, 'badMessage');
  h.send('a', { t: 'command', requestId: 'foreign-research', command: { kind: 'research', hqId: 'hq1' } }); assert(!h.latest('a', 'ack').ok);
});


await test('v9 soft-radius gathering ignores military commands and additional HQ workers replicate through recovery', () => {
  const h = harness(true); h.connect('a'); h.connect('b'); h.ready();
  const welcome = h.latest('a', 'welcome'); assert.equal(welcome.tune.hq.cost, 16); assert.equal(welcome.tune.hq.buildMs, 30000); assert.equal(welcome.tune.hq.workerGatherRadius, 4);
  const sim = h.room.sim; for (const hex of sim.hexes) hex.owner = 0;
  for (const hexId of ['-1,0', '0,0']) sim.hexes.find(x => x.id === hexId).owner = null;
  h.step(12000); assert.equal(sim.hexes.find(x => x.id === '-1,0').owner, 0); assert.equal(sim.hexes.find(x => x.id === '0,0').owner, 0);
  const original = sim.units.find(u => u.owner === 0 && u.kind === 'worker'); assert(original);
  const tokens = [h.latest('a', 'welcome').token, h.latest('b', 'welcome').token];
  h.room = OnlineRoom.restore(JSON.parse(JSON.stringify(h.room.checkpoint())), h.env); h.connect('a2', tokens[0]); h.connect('b2', tokens[1]);
  h.room.sim.buildings.push({ id: 'army-anchor', owner: 0, kind: 'bunker', hexId: '-2,2', hp: 280, maxHp: 280, unitId: null, readyAtMs: 0 });
  h.send('a2', { t: 'command', requestId: 'army-defend', command: { kind: 'defend', entityId: 'army-anchor' } }); assert(h.latest('a2', 'ack').ok);
  h.send('a2', { t: 'command', requestId: 'army-attack', command: { kind: 'attackBuilding', entityId: 'hq1' } }); assert(h.latest('a2', 'ack').ok);
  h.step(10000);
  for (const seat of ['a2', 'b2']) {
    const mirror = h.mirrors.get(seat); assert.equal(mirror.entities.hexes.find(x => x.id === '0,0').owner, 0);
    const worker = mirror.entities.units.find(x => x.id === original.id); assert.equal(worker.buildingId, 'hq0');
    assert.equal(mirror.players[0].defendTargetId, 'army-anchor'); assert.equal(mirror.players[0].targetId, 1);
  }
  h.send('a2', { t: 'command', requestId: 'forward-hq', command: { kind: 'place', hexId: '-2,1', card: 'hq' } }); assert(h.latest('a2', 'ack').ok);
  const forward = h.room.sim.buildings.find(b => b.hexId === '-2,1'); h.step(48000);
  for (const seat of ['a2', 'b2']) {
    const mirror = h.mirrors.get(seat); assert.equal(mirror.entities.hexes.find(x => x.id === '0,0').owner, 0);
    assert(mirror.entities.units.some(u => u.buildingId === forward.id && u.kind === 'worker'));
    assert.equal(mirror.entities.units.find(u => u.id === original.id).buildingId, 'hq0');
  }
});

await test('map requests validate a strict preset and uint32 seed whitelist without accepting geometry or owner injection', () => {
  for (const shape of mapModule.MAP_SHAPES) for (const seed of [0, 1, 0xffffffff]) {
    assert(protocol.parseOnlineClientMessage(JSON.stringify({ t: 'map', requestId: 'valid-map', shape, seed })));
  }
  const valid = { t: 'map', requestId: 'invalid-map', shape: 'narrows', seed: 12 };
  for (const invalid of [{ ...valid, shape: 'unknown' }, { ...valid, shape: null }, { ...valid, seed: -1 },
    { ...valid, seed: 1.5 }, { ...valid, seed: 0x100000000 }, { ...valid, seed: '12' }, { ...valid, seed: null },
    { ...valid, radius: 12 }, { ...valid, owner: 0 }, { t: 'map', requestId: 'missing', shape: 'open' }]) {
    assert.equal(protocol.parseOnlineClientMessage(JSON.stringify(invalid)), null);
  }
});

await test('only the host changes lobby maps, accepted changes clear readiness, retries deduplicate and countdown locks the map', () => {
  const h = harness(); h.connect('a'); h.connect('b');
  h.send('b', { t: 'map', requestId: 'guest-map', shape: 'ring', seed: 42 }); assert(!h.latest('b', 'ack').ok);
  assert.equal(h.room.tune.map.shape, 'open');
  h.send('b', { t: 'ready', requestId: 'guest-ready', ready: true }); assert(h.room.lobby().players[1].ready);
  const change = { t: 'map', requestId: 'host-map', shape: 'ring', seed: 42 }; h.send('a', change); assert(h.latest('a', 'ack').ok);
  assert(h.room.lobby().players.every(p => !p.ready)); assert.equal(h.room.lobby().map.shape, 'ring');
  assert.equal(h.latest('b', 'lobby').map.seed, 42); assert.equal(h.room.tune.map.radius, 9);
  h.send('b', { t: 'ready', requestId: 'guest-ready-again', ready: true }); h.send('a', change);
  assert(h.latest('a', 'ack').ok); assert(h.room.lobby().players[1].ready, 'a retried map request cannot erase later readiness');
  h.send('a', { ...change, seed: 43 }); assert.equal(h.latest('a', 'error').code, 'requestIdReuse'); assert.equal(h.room.tune.map.seed, 42);
  h.send('a', { t: 'ready', requestId: 'host-ready', ready: true }); assert.equal(h.room.phase, 'countdown');
  h.send('a', { t: 'map', requestId: 'countdown-map', shape: 'forks', seed: 99 }); assert(!h.latest('a', 'ack').ok);
  h.step(3000); assert.equal(h.room.phase, 'playing'); assert.equal(h.room.sim.tune.map.shape, 'ring');
  h.send('a', { t: 'map', requestId: 'playing-map', shape: 'open', seed: 1 }); assert(!h.latest('a', 'ack').ok);
  assert.equal(h.room.sim.tune.map.seed, 42); assert(h.room.sim.hexes.some(x => x.gap));
});

await test('selected map topology is authoritative in lobby, welcome, reconnect, full states and v8 recovery', () => {
  const h = harness(true); h.connect('a'); h.connect('b'); const tokens = [h.latest('a', 'welcome').token, h.latest('b', 'welcome').token];
  h.send('a', { t: 'map', requestId: 'seeded-map', shape: 'forks', seed: 0xffffffff }); assert(h.latest('a', 'ack').ok);
  const saved = JSON.parse(JSON.stringify(h.room.checkpoint())); assert.equal(saved.version, 9);
  h.room = OnlineRoom.restore(saved, h.env); h.connect('a2', tokens[0]); h.connect('b2', tokens[1]);
  for (const seat of ['a2', 'b2']) {
    const welcome = h.latest(seat, 'welcome'); assert.equal(welcome.v, 9); assert.equal(welcome.tune.map.shape, 'forks');
    assert.equal(welcome.lobby.map.seed, 0xffffffff); assert.deepEqual(welcome.tune.map, h.room.lobby().map);
  }
  h.send('a2', { t: 'ready', requestId: 'ready-seeded-a', ready: true }); h.send('b2', { t: 'ready', requestId: 'ready-seeded-b', ready: true }); h.step(3000);
  const gaps = mapModule.generateMap(h.room.tune.map).filter(x => x.gap).map(x => x.id);
  for (const seat of ['a2', 'b2']) {
    const mirror = h.mirrors.get(seat); assert.deepEqual(mirror.entities.hexes.filter(x => x.gap).map(x => x.id), gaps);
    assert.deepEqual(mirror.resources.map(x => x.capacity), [6, 6]); assert(mirror.entities.units.every(u => !gaps.includes(u.hexId)));
  }
  const recovered = OnlineRoom.restore(JSON.parse(JSON.stringify(h.room.checkpoint())), h.env);
  assert.deepEqual(recovered.sim.checkpoint(), h.room.sim.checkpoint());
});

await test('mid-flight gap crossings retain geometry, reserved endpoints and distance-scaled timing through network recovery', () => {
  const h = harness(true); h.connect('a'); h.connect('b'); h.send('a', { t: 'map', requestId: 'flight-map', shape: 'narrows', seed: 2 }); h.ready();
  const tokens = [h.latest('a', 'welcome').token, h.latest('b', 'welcome').token], s = h.room.sim;
  s.units.splice(0); s.tune.hq.workerLimit = 0;
  for (const cell of s.hexes) { cell.owner = 0; if (Math.abs(cell.q) <= 1) cell.gap = true; }
  const plane = { id: 'network-flight', owner: 0, kind: 'fighter', hexId: '-2,0', hp: 60, maxHp: 60, attacking: false, buildingId: null, nextAttackAtMs: 0 };
  s.units.push(plane); s.setTarget(0, 1); h.step(200);
  assert.equal(plane.hexId, '2,0'); assert.equal(plane.fromHexId, '-2,0'); const arrival = plane.movingUntilMs;
  assert.equal(arrival - plane.movedAtMs, s.tune.cards.fighter.moveMs * 4 / 1.25);
  for (const seat of ['a', 'b']) {
    const mirrored = h.mirrors.get(seat).entities.units.find(u => u.id === plane.id); assert.equal(mirrored.movingUntilMs, arrival); assert.equal(mirrored.fromHexId, '-2,0');
  }
  const saved = JSON.parse(JSON.stringify(h.room.checkpoint())); h.room = OnlineRoom.restore(saved, h.env); h.connect('a2', tokens[0]); h.connect('b2', tokens[1]);
  h.step(1500); const live = h.room.sim.units.find(u => u.id === plane.id); assert.equal(live.movingUntilMs, arrival); assert.equal(live.movedAtMs, 100);
  h.step(200); assert(h.room.sim.timeMs >= arrival); assert(h.room.sim.hexes.find(x => x.id === '0,0').gap);
  for (const seat of ['a2', 'b2']) {
    const mirror = h.mirrors.get(seat); assert(mirror.entities.units.every(u => !mirror.entities.hexes.find(x => x.id === u.hexId).gap));
  }
});

await test('browser connection sends setMap and mirrors authoritative map changes and gap records without local simulation', async () => {
  const clientModule = await load('../src/online-client.ts', { './sim': urls.get('../src/sim.ts'), './online-protocol': urls.get('../src/online-protocol.ts') });
  const NativeWebSocket = globalThis.WebSocket, sockets = [];
  class TestSocket {
    static OPEN = 1; readyState = 1; sent = [];
    constructor(url) { this.url = url; sockets.push(this); }
    send(raw) { this.sent.push(JSON.parse(raw)); }
    close() { this.readyState = 3; }
    emit(message) { this.onmessage?.({ data: JSON.stringify(message) }); }
  }
  let connection;
  try {
    globalThis.WebSocket = TestSocket;
    connection = new clientModule.OnlineConnection('https://example.invalid', 'ABCDE', false, false, () => {});
    const socket = sockets[0], authoritative = structuredClone(tune); authoritative.map = { ...authoritative.map, shape: 'narrows', seed: 17 };
    socket.emit({ t: 'welcome', v: 9, seat: 0, token: 'a'.repeat(32), roomCode: 'ABCDE', tune: authoritative,
      lobby: { phase: 'lobby', countdownEndsAtMs: null, players: [], serverNow: 0, map: authoritative.map } });
    assert.equal(connection.sim.tune.map.shape, 'narrows');
    const pending = connection.setMap('ring', 99), request = socket.sent.at(-1);
    socket.emit({ t: 'ack', requestId: request.requestId, ok: true }); assert((await pending).ok);
    assert.deepEqual({ t: request.t, shape: request.shape, seed: request.seed }, { t: 'map', shape: 'ring', seed: 99 });
    const h = harness(true); h.connect('a'); h.connect('b'); h.send('a', { t: 'map', requestId: 'client-map', shape: 'ring', seed: 99 });
    socket.emit({ t: 'lobby', ...h.room.lobby() }); assert.equal(connection.lobby.map.seed, 99); assert.equal(connection.sim.tune.map.shape, 'ring');
    h.ready(); socket.emit(h.latest('a', 'state'));
    assert.deepEqual(connection.sim.hexes.filter(x => x.gap).map(x => x.id), h.room.sim.hexes.filter(x => x.gap).map(x => x.id));
    assert(!connection.sim.placement(0, connection.sim.hexes.find(x => x.gap).id, 'infantry').ok);
  } finally { connection?.close(); globalThis.WebSocket = NativeWebSocket; }
});

await test('dismantle wire validates ownership, releases after ten seconds, preserves units and survives room recovery',()=>{
  const h=harness(true);h.connect('a');h.connect('b');h.ready();for(const hex of h.room.sim.hexes)hex.owner=0;
  h.send('a',{t:'command',requestId:'build',command:{kind:'place',card:'infantry',hexId:'0,0'}});assert(h.latest('a','ack').ok);h.step(3000);
  const building=h.room.sim.buildings.find(b=>b.hexId==='0,0'),unitId=building.unitId;
  h.send('b',{t:'command',requestId:'steal-dismantle',command:{kind:'dismantle',buildingId:building.id}});assert(!h.latest('b','ack').ok);
  h.send('a',{t:'command',requestId:'keep-hq',command:{kind:'dismantle',buildingId:'hq0'}});assert(!h.latest('a','ack').ok);
  h.send('a',{t:'command',requestId:'dismantle',command:{kind:'dismantle',buildingId:building.id}});assert(h.latest('a','ack').ok);h.step(200);
  for(const seat of ['a','b']){const world=h.mirrors.get(seat);assert(!world.entities.buildings.some(b=>b.id===building.id));assert(world.entities.units.some(u=>u.id===unitId&&u.buildingId===null));assert(world.entities.hexes.find(x=>x.id==='0,0').burnt);assert(world.pendingReleases.length);}
  const saved=JSON.parse(JSON.stringify(h.room.checkpoint()));h.room=OnlineRoom.restore(saved,h.env);h.step(9800);assert.equal(h.room.sim.pendingReleases.length,0);assert.equal(h.room.sim.resources(0).committed,0);
  assert.equal(protocol.parseOnlineClientMessage(JSON.stringify({t:'command',requestId:1,command:{kind:'dismantle',buildingId:'hq0',owner:1}})),null);
});

console.log(`${passed} Operation C online tests passed.`);
