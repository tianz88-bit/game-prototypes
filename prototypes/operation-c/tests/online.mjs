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
const simModule = await load('../src/sim.ts'), protocol = await load('../src/online-protocol.ts');
const roomModule = await load('../server/src/room.ts', { '../../src/sim': urls.get('../src/sim.ts'), '../../src/online-protocol': urls.get('../src/online-protocol.ts') });
const worker = await load('../server/src/index.ts', { './room': urls.get('../server/src/room.ts'), '../../src/online-protocol': urls.get('../src/online-protocol.ts') });
const { OperationSim, DEFAULT_LOADOUT } = simModule, { OnlineRoom } = roomModule;
const jsonShape = value => JSON.parse(JSON.stringify(value));
let passed = 0;
async function test(name, run) { await run(); passed++; console.log(`PASS ${name}`); }

function harness() {
  let wall = 1000000, tokenSerial = 0;
  const messages = new Map(), closed = [], mirrors = new Map();
  const env = { now: () => wall, token: () => (++tokenSerial).toString(16).padStart(32, '0'),
    send: (id, message) => {
      if (!messages.has(id)) messages.set(id, []);
      const cloned = structuredClone(message); messages.get(id).push(cloned);
      if (cloned.t === 'state') { const next = protocol.applyOnlineState(mirrors.get(id) ?? null, cloned); assert(next, `delta gap for ${id}`); mirrors.set(id, next); }
    }, close: (id, code, reason) => closed.push({ id, code, reason }) };
  let room = new OnlineRoom('ABCDE', env);
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
  h.send('a', request); h.send('a', request); assert(h.latest('a', 'ack').ok); assert.equal(h.room.sim.resources(0).committed, 4);
  h.send('a', { ...request, command: { kind: 'target', targetId: 1 } }); assert.equal(h.latest('a', 'error').code, 'requestIdReuse');
  const saved = JSON.parse(JSON.stringify(h.room.checkpoint())); h.room = OnlineRoom.restore(saved, h.env); h.connect('a2', token);
  h.send('a2', request); assert(h.latest('a2', 'ack').ok); assert.equal(h.room.sim.resources(0).committed, 4);
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
  for (const sim of [s, restored]) { assert(sim.place(0, '4,0', 'infantry').ok); sim.tick(3050); }
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
  assert.equal(status.service, 'operation-c-online'); assert.equal(status.protocol, 4);
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
    await object.webSocketMessage(sockets[0], JSON.stringify({ t: 'command', requestId: 2, command: { kind: 'place', hexId: '-4,0', card: 'infantry' } }));
    wall += 5000; object = new worker.OperationCRoom(state, env); await object.alarm();
    const stored = records.get('operation-c-room-v1'); assert.equal(stored.sim.timeMs, 5000); assert.equal(stored.sim.botEnabled, false);
    assert.equal(stored.seats[0].token, token); assert.equal(stored.sim.buildings.filter(b => b.kind !== 'hq').length, 1);
    assert(a.webSocket.messages.filter(m => m.t === 'welcome').length >= 2);
    const ack = a.webSocket.messages.find(m => m.t === 'ack' && m.requestId === 2); assert(ack.ok);
    for (const version of [1, 2, 3]) for (const layer of ['room', 'sim']) {
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

await test('v4 welcome carries authoritative individual sight, classes and bonuses; recovery retains them and rejects older rules', () => {
  const h = harness(); h.connect('a'); h.connect('b'); const welcome = h.latest('a', 'welcome');
  assert.equal(welcome.v, 4); assert.equal(welcome.tune.cards.tank.damageClass, 'armoured');
  assert.equal(welcome.tune.cards.tank.sightRange, 3); assert.equal(welcome.tune.cards.mlrs.sightRange, 6);
  assert.equal(welcome.tune.cards.fighter.damageClass, 'light'); assert.equal(welcome.tune.cards.silo.damageClass, 'structure');
  assert.deepEqual(welcome.tune.cards.destroyer.damageBonus, { armoured: 24 });
  h.ready(); const saved = JSON.parse(JSON.stringify(h.room.checkpoint()));
  assert.equal(saved.version, 4); assert.equal(saved.sim.version, 4);
  const recovered = OnlineRoom.restore(saved, h.env);
  assert.deepEqual(recovered.sim.tune.cards, h.room.sim.tune.cards);
  for (const version of [1, 2, 3]) {
    assert.throws(() => OnlineRoom.restore({ ...saved, version }, h.env), /Unsupported/);
    assert.throws(() => OperationSim.restore({ ...saved.sim, version }), /Unsupported/);
  }
});

await test('authoritative individual sight interrupts capture locally while both seats still receive the fully visible battlefield', () => {
  const h = harness(), custom = structuredClone(tune); custom.capture.hqRate = 0; custom.hq.defenseDamage = 0;
  h.room = new OnlineRoom('ABCDE', h.env, custom); h.connect('a'); h.connect('b'); h.ready();
  const s = h.room.sim, site = s.hexes.find(x => x.id === '0,3'); site.owner = null;
  const actor = { id: 'sight-actor', owner: 0, kind: 'tank', hexId: site.id, hp: 180, maxHp: 180, attacking: false, buildingId: null, nextAttackAtMs: 0 };
  const enemy = { ...actor, id: 'sight-enemy', owner: 1, hexId: '4,3', movingUntilMs: 100000 };
  const ally = { ...actor, id: 'sight-ally', kind: 'scout', hexId: '3,2', movingUntilMs: 100000 };
  s.units.push(actor, enemy, ally); h.step(200);
  assert(site.capture > 0, 'allied sight of the enemy does not block this unit capture');
  const progress = site.capture; assert.equal(actor.hexId, site.id);
  for (const seat of ['a', 'b']) {
    const mirror = h.mirrors.get(seat);
    assert(mirror.entities.units.some(x => x.id === enemy.id && x.hexId === '4,3'), 'full visibility is independent of engagement sight');
    assert(mirror.entities.units.some(x => x.id === ally.id));
  }
  enemy.hexId = '3,3'; h.step(200);
  assert.equal(site.capture, progress); assert.equal(actor.fromHexId, site.id);
  assert.equal(actor.hexId, '1,3', 'server advances toward a newly visible target beyond weapon range');
  assert.equal(actor.attacking, false, 'individual sight does not extend weapon range');
  for (const seat of ['a', 'b']) assert.equal(h.mirrors.get(seat).entities.units.find(x => x.id === actor.id).hexId, actor.hexId);
});

console.log(`${passed} Operation C online tests passed.`);
