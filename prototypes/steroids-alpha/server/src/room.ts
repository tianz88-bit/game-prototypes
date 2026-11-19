import { isClanId, isWarPlanet,TUTORIAL } from '../../sim/planets';
import { bundledRecord } from '../../sim/liveConfig';
import type { ConfigRecord } from '../../sim/liveConfig';
// One running planet room: the authority for every ship on that planet.
// Players drop in and out at any time; the tick loop runs only while someone is connected.
import { TUNE, stepSeconds } from '../../sim/tune';
import { bankedMinerals, copyShip, maxShield, hullCapacity, mineralBalance } from '../../sim/ship';
import {EVOLVE_ITEM} from '../../sim/shop';
import { SPARROW } from '../../sim/chassis';
import type { ShipInput, ShipState } from '../../sim/ship';
import { selectedFighter, cleanLook, evolutionBuild } from '../../sim/unlocks';
import type { Look } from '../../sim/unlocks';
import { World } from '../../sim/world';
import type { WorldEvents } from '../../sim/world';
import { TURRET_SIDE } from '../../sim/turrets';
import { BOT_NAMES, botThink, newBrain, tutorialBotThink } from '../../sim/bots';
import type { TutorialBotKind } from '../../sim/bots';
import type { BotBrain } from '../../sim/bots';
import { BUY_BYTES, INPUT_BYTES, PING_BYTES, CLOSE, MSG, cleanName, decodeClient, encodeAsteroids, encodeGone, encodePing, encodeShots, encodeSnapshot, encodeWelcome, encodeOrdnance } from '../../sim/protocol';
import type { OrdnanceView } from '../../sim/protocol';
import type { SnapshotShip } from '../../sim/protocol';
import { wrapDist2 } from '../../sim/wrap';

/** A Cloudflare server-side socket: accepted in this object, not hibernated (the room ticks continuously). */
export interface CfSocket extends WebSocket {
  accept(): void;
}

/** Accept a server-side socket and ask for binary frames as ArrayBuffer (the runtime default can be Blob). */
export function acceptBinary(ws: CfSocket): void {
  ws.accept();
  try {
    ws.binaryType = 'arraybuffer';
  } catch {
    // Older runtimes without settable binaryType: onMessage falls back to reading Blobs in order.
  }
}

interface Player {
  id: number;
  ws: CfSocket;
  ship: ShipState;
  /** Inputs received and not yet applied, oldest first. */
  queue: ShipInput[];
  /** Last applied input, repeated (without dash) when the queue runs dry. */
  last: ShipInput;
  /** Steps simulated with a guessed input because the real one was late. Late inputs fill these slots and are dropped. */
  deficit: number;
  /** A dash from a dropped late input, applied on the next step. */
  owedDash: boolean;
  owedMissile: boolean;
  owedMine: boolean;
  /** A warp press from a dropped (late) input, applied on the next step. */
  owedWarp: boolean;
  /** Keeps incoming messages in arrival order when any must be read asynchronously. */
  reading: Promise<void>;
  /** False until the first input arrives. */
  started: boolean;
  /** Consecutive ticks with a non-zero deficit. */
  deficitTicks: number;
  budgetAt:number;
  packets:number;
  /** Shown under the ship and on the leaderboard. */
  name: string;
  /** Ships this player has destroyed since they last dropped in. Resets on death (a new life). */
  kills: number;
  /** Unique id of this run (this drop-in): the bank credits each run at most once. */
  runId: string;
  /** Account secret from the client's one 'auth' message, checked by the bank only when crediting. */
  secret: string | null;
  /** Cosmetics worn: what the client asked for, kept only where the account owns it. */
  look: Look;
  /** Only an auth initiated before the first binary intent may equip this run. */
  loadoutOpen:boolean;
  /** Room tick at drop-in: the chosen ship type applies only within its first moments. */
  joinedAt: number;
  /** Clan chosen in the menu (0: none). Trusted from the client in the Clan planets v0 demo. */
  clan: number;
  /** Secret the client presents (?resume=) to take this ship back after a dropped connection. */
  resume: string;
  /**
   * Connection lost (owner, 15 November 2026: reconnect grace): the ship stays on the planet, flying
   * on idle input, until this tick; the pilot can resume it before then. -1 while connected.
   */
  awayUntil: number;
  /** Warzone: destroyed at war and waiting to respawn in place until this tick (-1: flying). */
  down: number;
}

/** Warzone round flow (owner, 16 November 2026). */
export type SiegePhase = 'peace' | 'countdown' | 'war' | 'release' | 'over' | 'cooldown';

/**
 * Banks an extraction (server/src/bank.ts creditExtraction, through D1): returns the new balance,
 * or null if the secret is unknown. Absent when the room runs without a bank (tests, local runs).
 */
export type BankCredit = (secret: string, amount: number, runId: string) => Promise<number | null>;
/** The unlocks an account owns (null for an unknown secret): what its pilot may wear. */
export type BankOwned = (secret: string) => Promise<string[] | null>;


const IDLE_INPUT: ShipInput = { seq: 0, turn: 0, aim: NaN, thrust: 0, dash: false, fire: false, missile: false, mine: false, warp: false };
const upgradeCount = (s: ShipState): number => s.turrets + s.shieldTier + s.damageTier + s.missileTier + s.mineTier;

export class Room {
  private players = new Map<number, Player>();
  private nextId = 1;
  /** Game rules for this planet: ships, bullets, asteroids. Its tick is the room's clock. */
  private world: World;

  /** shipHp (any value) makes ships take no damage, for local test runs only (see TEST_SHIP_HP in index.ts). */
  private config:ConfigRecord=bundledRecord();
  private tune=structuredClone(TUNE);
  constructor(private shipHp?: number, private refreshConfig:()=>void=()=>{}, private bank?: BankCredit, private owned?: BankOwned) {
    this.world = new World(this.tune);
    if(shipHp)this.world.invulnerable=true;
    this.world.payoutFactor = (victim, killer) => this.repeatKillFactor(victim, killer);
    this.world.moveHotZone(); // in place before the first pilot joins
    this.world.drain();
  }
  /** Called between fixed ticks. Announce a complete version before its new snapshots. */
  applyConfig(record:ConfigRecord):void{
    if(record.version===this.config.version)return;
    const ships=[...this.players.values(),...this.bots.values()].map(p=>p.ship);
    const wallets=ships.map(s=>mineralBalance(s,this.tune));
    this.config=record;
    for(const group of ['grip','ship','weapon','turret','shop','missile','mine','bots','warp','salvage','hotZone','sparrow','interceptor','battlecruiser','missileCruiser','ciws','heavyTower','asteroid','planet','base'] as const)Object.assign(this.tune[group],structuredClone(record.data.tune[group]));
    ships.forEach((s,i)=>{s.hullMax=this.tune.ship.maxHp+Math.min(wallets[i],Math.max(0,this.tune.ship.powerCap-this.tune.ship.maxHp));s.hp=Math.min(hullCapacity(s,this.tune),s.hp);s.shield=Math.min(maxShield(s,this.tune),s.shield);});
    for(const p of this.players.values()){
      p.ship.speed=Math.max(this.tune.ship.minSpeed,Math.min(this.tune.ship.maxSpeed,p.ship.speed));
      if(p.queue.length)p.last=p.queue[p.queue.length-1];p.queue=[];p.deficit=0;p.deficitTicks=0;p.owedDash=false;p.owedMissile=false;p.owedMine=false;p.owedWarp=false;p.started=false;
      this.send(p,JSON.stringify({type:'config',record}));this.send(p,this.snapshotFor(p));
    }
  }

  private get tick(): number {
    return this.world.tick;
  }
  private timer: ReturnType<typeof setInterval> | null = null;
  private lastStepAt = 0;
  private readonly dt = stepSeconds(TUNE);
  private readonly snapshotEvery = Math.max(1, Math.round(TUNE.net.tickHz / TUNE.net.snapshotHz));

  get playerCount(): number {
    return this.players.size;
  }

  /**
   * AI pilots (owner: Planet A only). They exist only while at least one real player is on the
   * planet: they join when someone does, respawn after respawnSeconds, and all leave with the last
   * player. A destroyed player is still "on the planet" for bots.lingerSeconds (owner, 15 November
   * 2026: bots go only when players leave, not when one is destroyed), so a respawn finds them.
   * Set once from the planet the room serves.
   */
  private botsEnabled = false;
  /** Tick until which the bots stay after the last player was destroyed (-1: not lingering). */
  private lingerUntil = -1;
  private bots = new Map<number, { id: number; name: string; kills: number; brain: BotBrain; ship: ShipState }>();
  private botRespawnAt: number[] = [];
  /** Clan home planets: the clan treasury (persisted by the Durable Object through onTreasury). */
  treasury = 0;
  onTreasury: ((total: number) => void) | null = null;
  setTreasury(total: number): void {
    this.treasury = Math.max(0, Math.floor(Number(total) || 0));
  }

  /** The planet this room serves: clan home planets get the base layout (sim/clanBase.ts). */
  setPlanet(planet: string): void {
    if (this.planetSet) return;
    this.planetSet = true;
    this.tutorial=planet===TUTORIAL;
    this.world.setPlanet(planet);
    if (isWarPlanet(planet) && this.world.siege) {
      this.war = true;
      this.manualBots = true;
    }
  }

  // --- Warzone (siege v0, owner 16 November 2026) ---
  /** This room serves the Warzone. */
  private war = false;
  siegePhase: SiegePhase = 'peace';
  /** Tick the current countdown (start, release, round over) ends. */
  private phaseUntil = 0;
  private siegeKey = '';
  /** Wall-clock end of the post-round cooldown (Date.now ms). */
  private cooldownUntilMs = 0;

  /** Phase and seconds left, for the planet list (stellar map): works while the room is idle too. */
  siegeStatus(): { phase: SiegePhase; left: number } | null {
    if (!this.war) return null;
    if (this.siegePhase === 'cooldown') {
      const left = Math.ceil((this.cooldownUntilMs - Date.now()) / 1000);
      return left > 0 ? { phase: 'cooldown', left } : { phase: 'peace', left: 0 };
    }
    const f = this.siegeFrame();
    return { phase: f.phase, left: f.left };
  }

  /**
   * End of a session (owner, 17 November 2026): every pilot goes back to the menu with the result,
   * the base resets, and the Warzone stays closed for siege.cooldownSeconds.
   */
  private closeSession(result: string): void {
    for (const p of [...this.players.values()]) {
      this.send(p, JSON.stringify({ type: 'roundEnd', result }));
      const ws = p.ws;
      this.leave(p.id);
      try {
        ws.close(CLOSE.ROUND_OVER, result);
      } catch {
        // Already closed.
      }
    }
    this.endWar();
    this.cooldownUntilMs = Date.now() + this.tune.siege.cooldownSeconds * 1000;
    this.setPhase('cooldown');
  }
  /** War bots waiting to come back: their clan and the tick. */
  private warBotRespawns: { clan: number; at: number }[] = [];

  private humans(clan: number): number {
    let n = 0;
    for (const p of this.players.values()) if (p.clan === clan && p.awayUntil < 0) n++;
    return n;
  }

  private setPhase(phase: SiegePhase, seconds = 0): void {
    this.siegePhase = phase;
    this.phaseUntil = this.tick + Math.round(seconds * this.tune.net.tickHz);
  }

  /** Where a pilot of this clan (re)enters the Warzone: defenders by the pads, attackers at the gate. */
  private warSpawn(id: number, clan: number): ShipState {
    const base = this.world.layout!;
    if (clan === base.clan) {
      const pad = base.pads[Math.floor(Math.random() * base.pads.length)];
      return this.world.addShipNear(id, pad.x, pad.y, 20);
    }
    return this.world.addShipNear(id, base.gate.x, base.gate.y, 120);
  }

  private addWarBot(clan: number): void {
    const id = this.allocateId();
    const used = new Set([...this.bots.values()].map((b) => b.name));
    const name = `BOT ${BOT_NAMES.find((n) => !used.has(`BOT ${n}`)) ?? id}`;
    const ship = this.warSpawn(id, clan);
    this.world.botIds.add(id);
    this.world.clanOf.set(id, clan);
    this.bots.set(id, { id, name, kills: 0, brain: { ...newBrain(Math.random), bornAt: this.tick }, ship });
    this.broadcastRoster();
  }

  /** Everyone back to their side's spawn, fresh structures, fresh war bots. */
  private beginWar(): void {
    const sg = this.tune.siege;
    this.world.startWar();
    for (const b of [...this.bots.keys()]) this.removeBot(b);
    this.warBotRespawns = [];
    for (const p of this.players.values()) {
      if (p.down >= 0) this.respawnInWar(p);
      else {
        const at = this.warSpawn(p.id, p.clan);
        p.ship.x = at.x;
        p.ship.y = at.y;
        this.world.ships.set(p.id, p.ship);
        this.world.clanOf.set(p.id, p.clan);
      }
    }
    for (const clan of [1, 2]) for (let i = 0; i < sg.botsPerSide; i++) this.addWarBot(clan);
    this.setPhase('war');
  }

  /** Back to peace: structures restored, war bots gone, the planet open again. */
  private endWar(): void {
    this.world.endPeace();
    for (const b of [...this.bots.keys()]) this.removeBot(b);
    this.warBotRespawns = [];
    for (const p of this.players.values()) if (p.down >= 0) this.respawnInWar(p);
    this.setPhase('peace');
  }

  /** A pilot destroyed at war stays connected and comes back at its side's spawn. */
  private downInWar(p: Player): void {
    const defender = p.clan === this.world.layout!.clan;
    const seconds = defender ? this.tune.siege.defenderRespawnSeconds : 0;
    this.world.removeShip(p.id);
    p.down = this.tick + Math.max(1, Math.round(seconds * this.tune.net.tickHz));
    this.send(p, JSON.stringify({ type: 'warDown', seconds }));
  }

  private respawnInWar(p: Player): void {
    p.ship = this.warSpawn(p.id, p.clan);
    this.world.clanOf.set(p.id, p.clan);
    p.down = -1;
    p.queue = [];
    this.send(p, JSON.stringify({ type: 'warUp' }));
  }

  private stepSiege(): void {
    if (!this.war) return;
    const sg = this.world.siege!;
    const both = this.humans(1) > 0 && this.humans(2) > 0;
    const t = this.tune.siege;
    for (const p of this.players.values()) if (p.down >= 0 && this.tick >= p.down) this.respawnInWar(p);
    if (this.siegePhase === 'peace' || this.siegePhase === 'countdown') this.warBotRespawns = [];
    else
      this.warBotRespawns = this.warBotRespawns.filter((r) => {
        if (this.tick < r.at) return true;
        this.addWarBot(r.clan);
        return false;
      });
    switch (this.siegePhase) {
      case 'peace':
        if (both) this.setPhase('countdown', t.startCountdownSeconds);
        break;
      case 'countdown':
        if (!both) this.setPhase('peace');
        else if (this.tick >= this.phaseUntil) this.beginWar();
        break;
      case 'war':
        if (sg.phase === 'over') this.setPhase('over', t.overSeconds);
        else if (!both) this.setPhase('release', t.endCountdownSeconds);
        break;
      case 'release':
        // A side with no pilots left: the session ends after the release countdown (owner).
        if (sg.phase === 'over') this.setPhase('over', t.overSeconds);
        else if (both) this.siegePhase = 'war';
        else if (this.tick >= this.phaseUntil) this.closeSession('A side left the war: no winner');
        break;
      case 'over':
        if (this.tick >= this.phaseUntil) {
          const who = sg.winner === 1 ? 'Crimson' : 'Azure';
          const why = sg.reason === 'treasury' ? 'Nexus destroyed' : sg.reason === 'tickets' ? 'attackers out of tickets' : 'the defence held until time ran out';
          this.closeSession(`${who} wins: ${why}`);
        }
        break;
      case 'cooldown':
        break;
    }
    // Siege state for the HUD: on any change, and a few times a second while it runs.
    const frame = this.siegeFrame();
    const key = JSON.stringify(frame);
    if (key !== this.siegeKey && (this.tick % 8 === 0 || frame.phase !== JSON.parse(this.siegeKey || '{}').phase)) {
      this.siegeKey = key;
      this.broadcast(key);
    }
  }

  private siegeFrame(): { type: 'siege'; phase: SiegePhase; left: number; tickets: number; turrets: number[]; shield: number; broken: boolean; treasury: number; winner: number; reason: string; crimson: number; azure: number } {
    const sg = this.world.siege!;
    const hz = this.tune.net.tickHz;
    const until = this.siegePhase === 'war' || this.siegePhase === 'release' ? sg.endsAt : this.phaseUntil;
    return { type: 'siege', phase: this.siegePhase, left: Math.max(0, Math.ceil((until - this.tick) / hz)), tickets: sg.tickets, turrets: sg.turretHp.map((v) => Math.round(v)), shield: Math.round(sg.shield), broken: sg.shieldBroken, treasury: Math.round(sg.treasury), winner: sg.winner, reason: sg.reason, crimson: this.humans(1), azure: this.humans(2) };
  }
  private planetSet = false;

  setBots(enabled: boolean): void {
    this.botsEnabled = enabled;
  }

  /**
   * Tutorial planet (owner, 16 November 2026): the room runs in the player's browser and the tutorial
   * script places bots itself. No automatic bots, no respawns; direct access to the world.
   */
  private manualBots = false;
  private tutorial=false;
  onTutorialTick?: (id: number, ship: ShipState, events: WorldEvents) => void;
  private tutorialShop=false;
  private tutorialFire=true;
  private tutorialWarp=false;
  /** Only the in-page tutorial guide can change these; online rooms ignore them. */
  setTutorialRules(rules:{shop:boolean;fire:boolean;minerals:boolean;warp?:boolean}):void {
    if(!this.tutorial)return;
    this.tutorialShop=rules.shop;this.tutorialFire=rules.fire;
    this.tutorialWarp=rules.warp??true;
    for(const p of this.players.values()){
      if(rules.fire)this.world.quiet.delete(p.id);else this.world.quiet.add(p.id);
      if(!this.tutorialWarp){p.last={...p.last,warp:false};p.queue=p.queue.map(i=>({...i,warp:false}));p.owedWarp=false;}
    }
    this.world.setTutorialMinerals(rules.minerals);
    if(!rules.shop)this.buys=[];
    if(!rules.fire){
      for(const p of this.players.values()){
        p.owedMissile = false;
        p.owedMine = false;
        p.last={...p.last,fire:false,missile:false,mine:false};
        p.queue=p.queue.map(i=>({...i,fire:false,missile:false,mine:false}));
      }
      this.world.clearTutorialShots();
    }
  }
  get sim(): World {
    return this.world;
  }
  get tutorialBots(): number[] {
    return [...this.bots.keys()];
  }
  setManualBots(on: boolean): void {
    this.manualBots = on;
  }
  /**
   * Lockstep (tutorial only): the room steps once per input its single pilot sends, instead of by
   * the wall clock, so the in-page room keeps exact pace with the client on any device speed.
   */
  private lockstep = false;
  setLockstep(on: boolean): void {
    this.lockstep = on;
  }
  addTutorialBot(kind: TutorialBotKind, x: number, y: number, name: string): number {
    const id = this.allocateId();
    const ship = this.world.addShipNear(id, x, y, 0);
    this.world.botIds.add(id);
    if (kind !== 'noob') this.world.quiet.add(id);
    ship.arrival = 0;
    this.bots.set(id, { id, name, kills: 0, brain: { ...newBrain(Math.random), bornAt: this.tick, tutorial: kind }, ship });
    this.broadcastRoster();
    return id;
  }
  removeTutorialBot(id: number): void {
    this.removeBot(id);
  }

  private stepBots(): void {
    if (this.manualBots) {
      const brains = [...this.bots.values()].map((x) => x.brain);
      for (const b of this.bots.values()) {
        if(b.brain.tutorial==='target'){b.ship.speed=0;continue;}
        if (b.brain.tutorial) {
          this.world.stepShip(b.id, tutorialBotThink(b.id, b.ship, this.world, b.brain, this.tune, Math.random));
          continue;
        }
        // Warzone bots: the ordinary bot brain, which fights the other clan at war (sim/bots.ts).
        const { input, buy } = botThink(b.id, b.ship, this.world, b.brain, this.tune, Math.random, brains);
        if (buy) this.world.buy(b.id, buy.item, buy.tier);
        this.world.stepShip(b.id, input);
      }
      return;
    }
    const present = this.players.size > 0 || this.tick < this.lingerUntil;
    const want = this.botsEnabled && present ? Math.max(0, Math.min(this.tune.bots.count, TUNE.net.maxPlayersPerRoom - this.players.size)) : 0;
    // Too many (players joined, or the last player left): the newest go first.
    while (this.bots.size > want) {
      const last = [...this.bots.keys()].pop() as number;
      this.removeBot(last);
    }
    // Too few: one at a time, once their respawn delay is over.
    this.botRespawnAt = this.botRespawnAt.filter((t) => t > this.tick);
    if (this.bots.size + this.botRespawnAt.length < want) this.addBot();
    const brains = [...this.bots.values()].map((x) => x.brain);
    for (const b of this.bots.values()) {
      const { input, buy } = botThink(b.id, b.ship, this.world, b.brain, this.tune, Math.random, brains);
      if (buy) this.world.buy(b.id, buy.item, buy.tier);
      this.world.stepShip(b.id, input);
    }
  }

  private addBot(): void {
    const id = this.allocateId();
    const used = new Set([...this.bots.values()].map((b) => b.name));
    const name = `BOT ${BOT_NAMES.find((n) => !used.has(`BOT ${n}`)) ?? id}`;
    const ship = this.world.addShip(id, true); // spread out, away from players
    this.world.botIds.add(id);
    this.bots.set(id, { id, name, kills: 0, brain: { ...newBrain(Math.random), bornAt: this.tick }, ship });
    this.broadcastRoster();
  }

  private removeBot(id: number): void {
    if (!this.bots.delete(id)) return;
    this.world.removeShip(id);
    this.broadcastRoster();
  }

  /** Attach a freshly accepted socket. Returns false (and closes it) when the room is full. */
  join(ws: CfSocket, requestedName?: string | null, resume?: string | null, requestedClan?: string | number | null): boolean {
    if (resume) {
      const back = [...this.players.values()].find((p) => p.resume === resume);
      if (!back) {
        // Lost while away, or the planet restarted (a server update): the client offers Respawn.
        ws.close(CLOSE.RESUME_LOST, 'ship lost');
        return false;
      }
      this.reattach(back, ws);
      return true;
    }
    if (this.players.size >= TUNE.net.maxPlayersPerRoom) {
      ws.close(CLOSE.ROOM_FULL, 'room full');
      return false;
    }
    const clan = isClanId(Number(requestedClan)) ? Number(requestedClan) : 0;
    // Warzone: clan pilots only, and nobody new once the war has begun (owner: lockdown).
    if (this.war) {
      if (!clan) {
        ws.close(CLOSE.NEED_CLAN, 'pick a clan to fight in the Warzone');
        return false;
      }
      // After a round the Warzone resets for siege.cooldownSeconds (wall clock: the room may be idle).
      if (this.siegePhase === 'cooldown') {
        const left = Math.ceil((this.cooldownUntilMs - Date.now()) / 1000);
        if (left > 0) {
          ws.close(CLOSE.WAR_RESETTING, String(left));
          return false;
        }
        this.setPhase('peace');
      }
      if (this.siegePhase === 'war' || this.siegePhase === 'release' || this.siegePhase === 'over') {
        ws.close(CLOSE.WAR_LOCKED, 'a war is on: try again when it ends');
        return false;
      }
    }
    const id = this.allocateId();
    // Clan home planets (owner): members drop in by the landing pads, everyone else at the gate.
    const base = this.world.layout;
    const spawn = !base ? this.world.addShip(id) : clan === base.clan ? this.world.addShipNear(id, base.treasury.x, base.treasury.y, this.tune.base.padRing) : this.world.addShipNear(id, base.gate.x, base.gate.y, 120);
    this.world.clanOf.set(id, clan);
    const player: Player = { id, ws, ship: spawn, queue: [], last: { ...IDLE_INPUT }, deficit: 0, owedDash: false, owedMissile: false, owedMine: false, owedWarp: false, reading: Promise.resolve(), started: false, deficitTicks: 0, budgetAt:Date.now(), packets:0, name: cleanName(requestedName) || `Pilot ${id}`, kills: 0, runId: crypto.randomUUID(), secret: null, look: {},loadoutOpen:true, joinedAt: this.tick, resume: crypto.randomUUID(), awayUntil: -1, clan, down: -1 };
    this.players.set(id, player);
    this.lingerUntil = -1;
    this.attach(player, ws);
    return true;
  }

  /** A dropped pilot is back within the grace period: same ship, same id, a fresh socket. */
  private reattach(player: Player, ws: CfSocket): void {
    const old = player.ws;
    player.ws = ws;
    player.awayUntil = -1;
    player.queue = [];
    player.deficit = 0;
    player.deficitTicks = 0;
    player.started = false;
    player.budgetAt = Date.now();
    player.packets = 0;
    // If the server had not noticed the old socket was gone, retire it quietly.
    if (old !== ws) try { old.close(1000, 'resumed'); } catch { /* already closed */ }
    this.attach(player, ws);
  }

  /** Wire a socket to its player and send the state a client starts from. */
  private attach(player: Player, ws: CfSocket): void {
    ws.addEventListener('message', (e: MessageEvent) => { if (player.ws === ws) this.onMessage(player, e.data); });
    ws.addEventListener('close', () => this.dropped(player, ws));
    ws.addEventListener('error', () => this.dropped(player, ws));

    this.send(player,JSON.stringify({type:'config',record:this.config}));
    this.send(player, encodeWelcome(player.id, this.tick));
    this.send(player, encodeAsteroids([...this.world.asteroids.values()]));
    this.send(player, JSON.stringify({ type: 'pickups', add: [...this.world.pickups.values()].map(({ id, x, y, kind, value, mined }) => ({ id, x, y, kind, value, mined })), remove: [] }));
    this.send(player, this.hotZoneFrame());
    this.send(player, this.snapshotFor(player));
    this.send(player, JSON.stringify({ type: 'resume', token: player.resume, seconds: this.tune.net.reconnectGraceSeconds }));
    if (this.world.layout) this.send(player, JSON.stringify({ type: 'treasury', clan: this.world.layout.clan, total: this.treasury }));
    this.broadcastRoster();
    this.start();
  }

  /** The socket closed without the room closing it: keep the ship for the grace period. */
  private dropped(player: Player, ws: CfSocket): void {
    if (player.ws !== ws || !this.players.has(player.id) || player.awayUntil >= 0) return;
    const grace = Math.round(this.tune.net.reconnectGraceSeconds * this.tune.net.tickHz);
    if (grace <= 0) return this.leave(player.id);
    player.awayUntil = this.tick + grace;
    // Nobody at the controls: the ship flies on with nothing pressed (it eases to minimum speed).
    player.queue = [];
    player.last = { ...IDLE_INPUT, seq: player.last.seq };
    player.deficit = 0;
    player.owedDash = false;
    player.owedMissile = false;
    player.owedMine = false;
    player.owedWarp = false;
  }

  /** The hot zone for clients: centre, radius and seconds until it moves. */
  private hotZoneFrame(): string {
    const z = this.world.hotZone;
    return JSON.stringify({ type: 'hotzone', x: Math.round(z.x), y: Math.round(z.y), r: z.r, seconds: Math.max(0, (z.until - this.tick) / this.tune.net.tickHz) });
  }

  /**
   * Repeat-kill guard (BRIEF.md): the kill payout halves for each repeat kill of the same pilot by
   * the same killer within salvage.repeatKillWindowSeconds. Pilots are matched by name until
   * accounts exist (bank milestone), since a respawn is a new ship id.
   */
  private killLog = new Map<string, { n: number; at: number }>();
  private repeatKillFactor(victim: number, killer: number): number {
    const name = (id: number): string => this.players.get(id)?.name ?? this.bots.get(id)?.name ?? '';
    if (!killer) return 1;
    const key = `${name(killer)}\u0000${name(victim)}`;
    const window = this.tune.salvage.repeatKillWindowSeconds * this.tune.net.tickHz;
    const prev = this.killLog.get(key);
    const n = prev && this.tick - prev.at <= window ? prev.n + 1 : 1;
    this.killLog.set(key, { n, at: this.tick });
    if (this.killLog.size > 500) for (const [k, v] of this.killLog) if (this.tick - v.at > window) this.killLog.delete(k);
    return Math.pow(0.5, n - 1);
  }

  private allocateId(): number {
    // u16 ids, skipping any still in use.
    for (;;) {
      const id = this.nextId;
      this.nextId = this.nextId >= 0xffff ? 1 : this.nextId + 1;
      if (!this.players.has(id) && !this.bots.has(id)) return id;
    }
  }

  private onMessage(player: Player, data: unknown): void {
    if(Date.now()-player.budgetAt>=1000){player.budgetAt=Date.now();player.packets=0;}
    if(++player.packets>120){player.ws.close(1008,'input rate exceeded');return;}
    // One text frame is allowed, first: {type:'auth', secret} naming the pilot's bank account. It is
    // only stored here; the bank checks it when crediting an extraction.
    if (typeof data === 'string' && player.secret === null && data.length <= 600) {
      try {
        const m = JSON.parse(data) as { type?: unknown; secret?: unknown; look?: unknown };
        if (m.type === 'auth' && typeof m.secret === 'string' && /^[A-Za-z0-9_-]{40,64}$/.test(m.secret)) {
          const preMission=player.loadoutOpen&&this.tick-player.joinedAt<=3*this.tune.net.tickHz;player.loadoutOpen=false;
          player.secret = m.secret;
          // Cosmetics: worn only once the bank confirms they are owned; everyone hears via the roster.
          if (this.owned && m.look) {
            this.owned(m.secret)
              .then((ids) => {
                if (this.players.get(player.id)!==player) return;
                player.look = cleanLook(m.look, ids ?? []);
                if(!preMission)delete player.look.evolution;
                // Ship chosen in the menu (owner design): an owned fighter replaces the starter,
                // only right after drop-in so nobody swaps ship mid-run.
                const s = player.ship;
                if (s.chassis === SPARROW && this.tick - player.joinedAt <= 3 * this.tune.net.tickHz) {
                  s.chassis = selectedFighter(player.look, ids ?? []).index!;
                  s.shield = maxShield(s, this.tune);
                }
                this.broadcastRoster();
              })
              .catch(() => {
                // Bank unreachable: fly without cosmetics.
              });
          }
          return;
        }
      } catch {
        // Falls through to the binary-only close.
      }
    }
    player.loadoutOpen=false;
    const bytes=data instanceof ArrayBuffer?data.byteLength:data instanceof Blob?data.size:0;
    if(bytes!==PING_BYTES&&bytes!==INPUT_BYTES&&bytes!==BUY_BYTES){player.ws.close(CLOSE.BAD_PROTOCOL,'invalid input size');return;}
    if (typeof data === 'string' || data === null || typeof data !== 'object') {
      player.ws.close(CLOSE.BAD_PROTOCOL, 'binary only');
      return;
    }
    // binaryType is set to arraybuffer on accept. If a runtime still hands over a Blob, read it
    // asynchronously but in arrival order, so inputs are never reordered.
    if (typeof (data as Blob).arrayBuffer === 'function' && !(data as ArrayBuffer).byteLength) {
      player.reading = player.reading.then(async () => this.handleBuffer(player, await (data as Blob).arrayBuffer()));
      return;
    }
    player.reading = player.reading.then(() => this.handleBuffer(player, data as ArrayBuffer));
  }

  private handleBuffer(player: Player, buf: ArrayBuffer): void {
    if (!this.players.has(player.id)) return;
    let msg;
    try {
      msg = decodeClient(buf);
    } catch {
      msg = null;
    }
    if (!msg) return;
    if (msg.type === MSG.PING) {
      this.send(player, encodePing(MSG.PONG, msg.clientTime));
      return;
    }
    // Shop purchases wait for the next tick, so they land between whole steps like everything else.
    if (msg.type === MSG.BUY) {
      if(this.tutorial&&!this.tutorialShop)return;
      if (this.buys.length < 64) this.buys.push({ id: player.id, item: msg.item, tier: msg.tier });
      return;
    }
    // Ignore replays and out-of-order inputs.
    const newest = player.queue.length ? player.queue[player.queue.length - 1].seq : player.last.seq;
    if (msg.input.seq <= newest || msg.input.seq > newest + 512) return;
    let input=msg.input;
    if(this.tutorial&&!this.tutorialFire)input={...input,fire:false,missile:false,mine:false};
    if(this.tutorial&&!this.tutorialWarp)input={...input,warp:false};
    player.queue.push(input);
    while (player.queue.length > TUNE.net.maxQueuedInputs) {
      const dropped = player.queue.shift()!;
      player.owedMissile ||= dropped.missile;
      player.owedMine ||= dropped.mine;
    }
    if (this.lockstep) this.step();
  }

  private leave(id: number, destroyed = false): void {
    if (!this.players.delete(id)) return;
    this.world.removeShip(id);
    // Destroyed with nobody else here: keep the planet (and its bots) running for a respawn.
    if (this.players.size === 0 && destroyed && this.botsEnabled && this.bots.size > 0) this.lingerUntil = this.tick + Math.round(this.tune.bots.lingerSeconds * this.tune.net.tickHz);
    if (this.players.size === 0 && this.tick >= this.lingerUntil) this.empty();
    this.broadcastRoster();
  }

  /** The last player is gone for good: the bots leave and the planet stops. */
  private empty(): void {
    this.lingerUntil = -1;
    for (const b of [...this.bots.keys()]) this.removeBot(b);
    this.stop();
  }

  private start(): void {
    if (this.timer || this.lockstep) return;
    this.lastStepAt = Date.now();
    this.timer = setInterval(() => this.pump(), 1000 / TUNE.net.tickHz / 2);
  }

  private stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  /** Run as many fixed steps as real time calls for (at most a few, so a stall does not spiral). */
  private pump(): void {
    this.refreshConfig();
    const now = Date.now();
    const stepMs = this.dt * 1000;
    let steps = 0;
    while (now - this.lastStepAt >= stepMs && steps < 4) {
      this.step();
      this.lastStepAt += stepMs;
      steps++;
    }
    if (now - this.lastStepAt > stepMs * 4) this.lastStepAt = now;
  }

  private buys: { id: number; item: number; tier: number }[] = [];
  private pickupMoves=new Map<number,{id:number;x:number;y:number;value:number}>();
  private step(): void {
    for (const b of this.buys.splice(0)){const p=this.players.get(b.id);if(p&&(b.item!==EVOLVE_ITEM||evolutionBuild(p.look)===b.tier))this.world.buy(b.id,b.item,b.tier);}
    // Pilots away longer than the grace period lose their ship.
    for (const p of [...this.players.values()]) if (p.awayUntil >= 0 && this.tick >= p.awayUntil) this.leave(p.id);
    this.stepSiege();
    for (const p of this.players.values()) if (p.down < 0) this.stepPlayer(p);
    this.stepBots();
    if (this.players.size === 0) {
      // Only a lingering planet ticks with nobody on it; it empties when the linger runs out.
      if (this.tick >= this.lingerUntil) return this.empty();
    }
    this.world.step();
    const ev = this.world.drain();
    if (this.tutorial && this.onTutorialTick) {
      for (const p of this.players.values()) this.onTutorialTick(p.id, p.ship, ev);
    }
    if (ev.asteroids.length) this.broadcast(encodeAsteroids(ev.asteroids));
    if (ev.gone.length) this.broadcast(encodeGone(ev.gone));
    if (ev.shots.length) {
      // Each player hears every shot but their own main-gun shots, which they drew when they fired.
      // Turret shots are the server's decision, so their owner hears those too.
      for (const p of this.players.values()) {
        const others = ev.shots.filter((s) => s.owner !== p.id || s.side >= TURRET_SIDE);
        if (others.length) this.send(p, encodeShots(this.tick, others));
      }
    }
    if (ev.hits.length) this.broadcast(JSON.stringify({ type: 'hits', hits: ev.hits }));
    // Docked members unloaded salvage into the clan treasury (owner, Clan planets v0).
    if (ev.deposits.length && this.world.layout) {
      for (const d of ev.deposits) {
        this.treasury += d.amount;
        const p = this.players.get(d.id);
        if (p) this.send(p, JSON.stringify({ type: 'deposited', amount: d.amount }));
      }
      this.onTreasury?.(this.treasury);
      this.broadcast(JSON.stringify({ type: 'treasury', clan: this.world.layout.clan, total: this.treasury }));
    }
    if (ev.rams.length) this.broadcast(JSON.stringify({ type: 'rams', rams: ev.rams }));
    if (ev.hotZone) this.broadcast(this.hotZoneFrame());
    if (ev.blasts.length) this.broadcast(JSON.stringify({ type: 'blasts', blasts: ev.blasts }));
    for(const p of ev.pickupsMoved)this.pickupMoves.set(p.id,p);
    for(const p of ev.pickupsGone)this.pickupMoves.delete(p.id);
    const moveTick=this.tick%Math.max(1,Math.round(this.tune.net.tickHz/this.tune.net.snapshotHz))===0;
    if(ev.pickups.length||ev.pickupsGone.length||(moveTick&&this.pickupMoves.size)){
      this.broadcast(JSON.stringify({type:'pickups',add:ev.pickups,remove:ev.pickupsGone,move:[...this.pickupMoves.values()]}));this.pickupMoves.clear();
    }
    const dead = new Set(ev.deaths.map((d) => d.id));
    if (ev.deaths.length) {
      // Everyone sees the explosion; whoever fired the killing shot scores.
      this.broadcast(JSON.stringify({ type: 'deaths', deaths: ev.deaths }));
      for (const d of ev.deaths) {
        const killer = d.killer ? (this.players.get(d.killer) ?? this.bots.get(d.killer)) : undefined;
        if (killer && !dead.has(killer.id)) killer.kills++;
      }
    }
    // Power changes all the time; the leaderboard hears about it twice a second at most.
    if (this.tick % Math.max(1, Math.round(this.tune.net.tickHz / 2)) === 0) {
      const key = [...this.players.values(), ...this.bots.values()].map((p) => `${p.id}:${Math.floor(mineralBalance(p.ship,this.tune))}:${p.kills}:${upgradeCount(p.ship)}`).join(',');
      if (key !== this.rosterKey) this.broadcastRoster();
      this.broadcastBounty();
    }
    if (this.tick % this.snapshotEvery === 0 || dead.size) {
      for (const p of this.players.values()) {
        if (this.tick % this.snapshotEvery === 0 || dead.has(p.id)) {
          this.send(p, this.snapshotFor(p));
          this.send(p, this.ordnanceFor(p));
        }
      }
    }
    // A destroyed bot leaves too and a new one comes after respawnSeconds.
    for (const id of dead) {
      if (!this.bots.has(id)) continue;
      const warClan = this.war ? this.world.clanOf.get(id) ?? 0 : 0;
      this.removeBot(id);
      if (warClan) this.warBotRespawns.push({ clan: warClan, at: this.tick + Math.max(1, Math.round((warClan === this.world.layout!.clan ? this.tune.siege.defenderRespawnSeconds : 0) * this.tune.net.tickHz)) });
      if (!this.manualBots) this.botRespawnAt.push(this.tick + Math.round(this.tune.bots.respawnSeconds * this.tune.net.tickHz));
    }
    // A destroyed ship leaves the planet. (Wrecks and loot come with the stash milestone.)
    for (const id of dead) {
      const p = this.players.get(id);
      if (!p) continue;
      if (this.war && (this.siegePhase === 'war' || this.siegePhase === 'release')) {
        this.downInWar(p);
        continue;
      }
      this.leave(id, true);
      try {
        p.ws.close(CLOSE.DESTROYED, 'destroyed');
      } catch {
        // Already closed.
      }
    }
    // Extracted: the warp run is complete and the ship launches off the planet. Everyone sees it
    // go; the pilot gets a result frame, the salvage carried out is banked (the room's own count,
    // once per run), the pilot hears the result, then the room closes their connection.
    const out = ev.extracted.filter((x) => this.players.has(x.id) && !dead.has(x.id));
    // Bots warp out too (owner): everyone sees them go, and a fresh bot follows after respawnSeconds.
    const botsOut = ev.extracted.filter((x) => this.bots.has(x.id) && !dead.has(x.id));
    if (out.length || botsOut.length) this.broadcast(JSON.stringify({ type: 'warpouts', ships: [...out, ...botsOut] }));
    for (const x of botsOut) {
      this.removeBot(x.id);
      this.botRespawnAt.push(this.tick + Math.round(this.tune.bots.respawnSeconds * this.tune.net.tickHz));
    }
    for (const x of out) {
      const p = this.players.get(x.id)!;
      // One currency (owner, 19 November 2026): the minerals carried out bank as credits, at this
      // planet's bank rate (none from the safe clan home planets, so they cannot be farmed).
      const salvage = bankedMinerals(p.ship, this.tune, !!this.world.layout && !this.world.siege);
      this.send(p, JSON.stringify({ type: 'extracted', power: Math.floor(mineralBalance(p.ship,this.tune)), kills: p.kills, salvage }));
      this.leave(x.id);
      void this.bankRun(p, salvage).then((result) => {
        this.send(p, JSON.stringify({ type: 'banked', ...result }));
        try {
          p.ws.close(CLOSE.EXTRACTED, 'extracted');
        } catch {
          // Already closed.
        }
      });
    }
  }

  /** Credit an extraction to the pilot's account, giving up after a few seconds. */
  private async bankRun(p: Player, salvage: number): Promise<{ amount: number; balance: number | null; error?: string }> {
    if (!this.bank) return { amount: 0, balance: null, error: 'no bank' };
    if (!p.secret) return { amount: 0, balance: null, error: 'no account' };
    try {
      const balance = await Promise.race([
        this.bank(p.secret, salvage, p.runId),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000)),
      ]);
      return balance === null ? { amount: 0, balance: null, error: 'unknown account' } : { amount: salvage, balance };
    } catch {
      return { amount: 0, balance: null, error: 'bank unavailable' };
    }
  }

  /** Names, kills and power (hull, i.e. minerals carried) for the leaderboard and name tags. */
  private rosterKey = '';
  private broadcastRoster(): void {
    const players = [...this.players.values(), ...this.bots.values()];
    this.rosterKey = players.map((p) => `${p.id}:${Math.floor(mineralBalance(p.ship,this.tune))}:${p.kills}:${upgradeCount(p.ship)}`).join(',');
    this.broadcast(JSON.stringify({ type: 'roster', players: players.map((p) => ({ id: p.id, name: p.name, kills: p.kills, power: Math.floor(mineralBalance(p.ship,this.tune)), level: upgradeCount(p.ship), bot: this.bots.has(p.id), look: (p as Partial<Player>).look ?? {}, clan: (p as Partial<Player>).clan ?? 0 })) }));
  }

  /**
   * Bounty (owner design): a marker on the strongest real player (bots never carry it), with
   * their position, so everyone else can track them from anywhere on the planet. Needs at least
   * two players. The holder keeps it on a tie, so it does not flicker between equals.
   */
  private bountyId = 0;
  private broadcastBounty(): void {
    const humans = [...this.players.values()].filter((p) => p.ship.hp > 0);
    let leader = 0;
    if (humans.length >= 2) {
      const top = Math.max(...humans.map((p) => p.ship.hullMax));
      const holder = this.players.get(this.bountyId);
      leader = holder && holder.ship.hp > 0 && holder.ship.hullMax >= top ? holder.id : humans.find((p) => p.ship.hullMax === top)!.id;
    }
    this.bountyId = leader;
    const s = this.players.get(leader)?.ship;
    this.broadcast(JSON.stringify({ type: 'bounty', id: leader, x: s ? Math.round(s.x) : 0, y: s ? Math.round(s.y) : 0 }));
  }

  private broadcast(buf: ArrayBuffer | string): void {
    for (const p of this.players.values()) this.send(p, buf);
  }

  /**
   * One simulation step per tick, each consuming one client input, so the server and the
   * client's prediction take the same number of steps. Ships always fly forward, so a late
   * input cannot simply be waited for: the step runs with the last input repeated, and the
   * late input, when it arrives, is acknowledged and dropped in place of that guessed slot.
   */
  private stepPlayer(p: Player): void {
    // The ship waits at its spawn until a small buffer of inputs has arrived (jitter buffer). Input 1
    // then fills the first step, and a client whose frames are uneven never runs the queue dry.
    // Starting with an empty queue would put the server permanently ahead of the input stream.
    if (!p.started) {
      if (p.queue.length < TUNE.net.inputBufferSteps) return;
      p.started = true;
    }
    while (p.deficit > 0 && p.queue.length) {
      const late = p.queue.shift() as ShipInput;
      p.owedDash ||= late.dash;
      p.owedMissile ||= late.missile;
      p.owedMine ||= late.mine;
      p.owedWarp = p.owedWarp !== late.warp; // two dropped presses cancel out
      p.last = late;
      p.deficit--;
    }
    // A deficit that does not drain means this client sends fewer inputs than real time (a long frame,
    // a throttled tab). Waiting would leave every later input applied one step late, so forgive it:
    // the client sees one correction and the ship goes back to real inputs.
    p.deficitTicks = p.deficit > 0 ? p.deficitTicks + 1 : 0;
    if (p.deficitTicks > TUNE.net.forgiveGuessAfterTicks) {
      p.deficit = 0;
      p.deficitTicks = 0;
    }
    const steps = 1; // Server clock is authoritative, even when a client floods the queue
    for (let i = 0; i < steps; i++) {
      const input = p.queue.shift();
      if (input) p.last = input;
      else if (p.deficit < TUNE.net.maxGuessedSteps) p.deficit++;
      // A guessed step repeats the last input without its one-shot presses (dash, missile, mine,
      // warp): repeating them would fire twice or toggle the warp back off. A dash or warp owed
      // from a dropped input applies now.
      const dash = (input ? input.dash : false) || p.owedDash;
      const warp = (input ? input.warp : false) !== p.owedWarp;
      p.owedDash = false;
      p.owedWarp = false;
      const missile = (input?.missile ?? false) || p.owedMissile;
      const mine = (input?.mine ?? false) || p.owedMine;
      p.owedMissile = false;
      p.owedMine = false;
      this.world.stepShip(p.id, { ...p.last, dash, warp, missile, mine });
    }
  }

  /** Everything near this player, using wrapped distance. Their own ship always comes first. */
  private snapshotFor(p: Player): ArrayBuffer {
    const r2 = TUNE.net.interestRadius * TUNE.net.interestRadius;
    const ships: SnapshotShip[] = [{ id: p.id, ...copyShip(p.ship) }];
    for (const o of [...this.players.values(), ...this.bots.values()]) {
      if (o.id === p.id || ((o as Partial<Player>).down ?? -1) >= 0) continue;
      if (wrapDist2(o.ship.x, o.ship.y, p.ship.x, p.ship.y, TUNE.world.width, TUNE.world.height) > r2) continue;
      ships.push({ id: o.id, ...copyShip(o.ship) });
    }
    // Acknowledge the guessed slots too: the ship already includes those steps, so the client must not
    // replay its own inputs for them on top. If a guess was wrong, the client sees a real correction.
    return encodeSnapshot(this.tick, p.last.seq + p.deficit, ships);
  }

  /** Missiles and mines near this player. */
  private ordnanceFor(p: Player): ArrayBuffer {
    const r2 = TUNE.net.interestRadius * TUNE.net.interestRadius;
    const items: OrdnanceView[] = [];
    for (const o of this.world.ordnance.values()) {
      if (wrapDist2(o.x, o.y, p.ship.x, p.ship.y, TUNE.world.width, TUNE.world.height) > r2) continue;
      const max = o.kind === 'missile' ? this.tune.missile.hp : this.tune.mine.hp;
      items.push({ id: o.id, kind: o.kind === 'missile' ? o.heavy?2:0 : 1, owner: o.owner, target: Math.max(0,o.target), x: o.x, y: o.y, heading: o.heading, hp: o.hp / max, armed: this.tick >= o.armAt });
    }
    return encodeOrdnance(items);
  }

  private send(p: Player, buf: ArrayBuffer|string): void {
    if (p.awayUntil >= 0) return;
    try {
      p.ws.send(buf);
    } catch {
      this.leave(p.id);
    }
  }
}
