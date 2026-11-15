# Steroids-Alpha: Long Game Design (clans, home planets, territory, economy, seasons)

Status: design doc, owner-directed (15 November 2026). Nothing in this file is built until the
owner moves a piece of it into `BRIEF.md`, which stays the source of truth for what gets built.
Decisions marked **Decided** come from the owner; **Proposal** items are drafts for the owner to
accept, change or drop; **Open** items need an owner answer.

---

## 1. Goals

- Give players a reason to come back beyond a single run: a social layer (clans) with slow,
  SLG-style progression.
- Create epic, planned clan-versus-clan fights (sieges) on top of everyday skirmishes.
- Keep the current rogue-like extraction loop intact: drop in, fight and mine, extract or lose
  what you carry.
- Keep open-planet runs fair: clan progression never makes a ship stronger in a normal run.

## 2. The three layers

| Layer | What it is | Time scale |
|---|---|---|
| **Runs** | The current game: .io-style fights and mining on open planets, extraction banks the haul. | Minutes |
| **Clan home planet and territory** | Shared clan buildings, defenses, satellite planets for farming. SLG-style timers and upkeep. | Days to weeks |
| **Clan wars** | Declared sieges on another clan's home planet; contested satellites. | Scheduled events |

Each layer feeds the next: runs produce resources, resources build the clan, the clan fights
for territory, territory produces more resources.

## 3. Clans

- **Decided:** a social system with SLG-style clan progression.
- **Decided:** target siege size 50 to 100 players eventually. Built within today's technical
  limits first; scaled up once there are players (see section 10).
- **Decided:** leaving a clan removes all clan perks immediately. Every resource a player
  contributed stays with the clan ("parked with the clan").
- **Proposal:** clan basics: name, short tag shown on member ships, roster with roles
  (leader, officers, members), join by invite or request.
- **Open:** clan size cap for launch (suggest a low cap such as 20 to 30 until sieges are
  proven, raised later).
- **Open:** who can declare war, spend the treasury and issue friendly passes (suggest leader
  and officers).
- **Open:** rejoin cooldown after leaving, to stop members hopping between clans before a war.

## 4. Home planets

- **Decided:** each clan has a home planet. Clan power shows **only** here: shields, static
  defenses and buildings. Ships in open runs are never boosted by clan progression.
- **Decided:** home planets are **shielded by default**. The shield drops only during a declared
  war or an event. Solo raids are impossible by design.
- **Decided:** **friendly passes** let guests visit: while a guest visit is active, shields are
  down and turrets are disabled for those guests.
- **Proposal:** buildings bought from the clan treasury on SLG-style build timers, for example:
  - Shield generator (siege shield strength and regeneration)
  - Defense turrets and platforms (static defenses during sieges)
  - Docks (spawn points and respawn speed for defenders during a siege)
  - Storage vault (how much of the treasury is protected from siege loot)
  - Satellite relay (how many satellite planets the clan can hold)
- **Proposal:** the home planet doubles as a hangout and lobby outside wars.
- **Risk noted:** a friendly pass lets a guest scout defenses before a war. Options: allow it
  (spies are fun), limit passes to clans with a non-aggression pact, or log every visit.
  **Open:** which option.

## 5. Wars and sieges

- **Decided:** sieges happen through a **war declaration** or an event, never as surprise
  raids on an unshielded base.
- **Decided:** a reinforcement-timer model (EVE Online style), so both sides can show up:
  - Attackers break the outer shield during the declared window.
  - The base goes "reinforced" and the final fight is scheduled for a set time, inside a window
    the defender chose in advance.
- **Proposal:** the shield cannot be broken by a single ship (for example it needs several ships
  in range at once, or out-regenerates any solo damage), so a siege needs a group.
- **Proposal:** a war declaration costs clan treasury and has a cooldown, so wars stay rare
  and meaningful.
- **Open:** whether bots can fill in as defenders or attackers while player counts are low.

## 6. Territory: satellite planets

- **Decided:** each clan can hold **satellite planets** for PvE and farming.
- **Decided:** satellites are **not shielded**: other clans and players can fight there at
  any time. This is where most everyday PvP between clans happens.
- **Decided:** **basic resources drop only on satellites** (not on the open planets used today),
  so territory matters.
- **Proposal:** holding a satellite generates clan treasury income over time.
- **Open:** how a satellite changes hands (capture point held for a time, destroying a beacon,
  or winning a timed contest).
- **Open:** whether unclaimed or neutral satellites exist for clanless players.

## 7. Economy

### 7.1 Principles

- **Decided:** **no trading** between players (like SLGs). Everything is bound to the player or
  the clan.
- **Decided:** **resource contribution is limited per clan member per time frame**, so there is
  no reason to overfarm. Run currencies (power, salvage) stay limited by the 400 cargo hold.
- **Decided:** **clan buildings have upkeep**: an ongoing cost that keeps clans active and stops
  inactive clans from holding territory forever.
- **Decided:** several economy levels: basic resources, seasonal resources and clan resources,
  alongside the existing run and personal currencies.
- **Proposal:** at most four visible layers plus one seasonal currency, each with one clear job,
  so the economy stays readable.

### 7.2 Layers (proposal)

| Layer | Earned by | Spent on | Lost on death? |
|---|---|---|---|
| **Run power** (minerals) | Mining and kills during a run | In-run upgrades, evolve | Yes (spills) |
| **Salvage, banked as credits** (personal) | Extracting | Hangar: ships, cosmetics, QoL | Carried: yes. Banked: no |
| **Basic resources** (for example Ore, Alloy, Fuel) | Mining on satellites only, then extracting | Contributed to the clan for buildings and upkeep | Carried: yes |
| **Clan treasury** (for example Influence) | Holding satellites over time, winning sieges | Home-planet buildings, war declarations, new satellites, upkeep | Can be looted in a lost siege (minus the storage vault's protected share) |
| **Seasonal currency** | Season activities | That season's cosmetics and clan structures | Resets each season |

### 7.3 Flows (proposal)

- Extraction splits the haul: **salvage goes to the player's personal credits**, **basic
  resources go to the player's clan** (up to the per-member contribution limit).
- A clanless player still has a full personal economy (credits, Hangar), so solo play is never
  punished; clans add a second track.
- **Open:** what happens to basic resources a clanless player extracts (not collectable, held
  until they join a clan, or converted to a small amount of credits).
- **Open:** the contribution limit's size and time frame (for example per day or per week).

## 8. Seasons

- **Decided:** themed seasons. Details stay in this design doc until the owner schedules them.
- **Proposal ideas:** a seasonal currency and cosmetics; a season leaderboard for sieges and
  territory; a season-end reset of territory and treasury so new clans can catch up, while
  personal Hangar unlocks are never reset.
- **Open:** what resets at the end of a season and what carries over.

## 9. What stays the same

- The rogue-like run loop: drop in, fight, mine, extract or die. Carried salvage and power are
  lost on death.
- Fairness in open runs: no stat boosts from clans, accounts or purchases ("never raw power").
- The never-block-the-player rule.

## 10. Technical notes

- **Persistence:** planets today live in server memory; a server update restarts them and loses
  every ship. Home planets, buildings, territory and treasuries must survive updates: Durable
  Object storage for live planet state, plus the existing D1 database (already used for the bank)
  for clans, membership, treasuries and ledgers.
- **Scale:** one planet is one server instance today, capped at 12 players, running on one
  thread. 50 to 100 ships in a single siege will need interest management (each client receives
  only what is near it) and possibly splitting a planet into zones. Postponed until there are
  players, but nothing built earlier should rule it out.
- **Timers and upkeep:** build timers and upkeep run on server time (stored timestamps), never
  on a client clock.
- **Accounts:** clans build on the existing anonymous accounts and recovery codes; a clan
  membership belongs to the account.

## 11. Suggested phases

Each phase should be fun on its own with few players.

1. **Clans lite:** create or join a clan, clan tag on ships, roster, per-member contribution to
   a clan treasury.
2. **Home planet:** a visitable clan planet (no combat yet) with buildings on timers, upkeep,
   and friendly passes. Doubles as a lobby.
3. **Satellites and basic resources:** clan-held satellites with basic-resource mining and
   unshielded PvP; territory income.
4. **Sieges:** war declarations, shields that need a group, defenses, reinforcement timer and
   scheduled war windows.
5. **Seasons:** themed seasons, seasonal currency, leaderboards and resets.

## 12. Open questions (summary)

1. Clan size cap at launch.
2. Clan roles and permissions (war, treasury, passes).
3. Rejoin cooldown after leaving a clan.
4. Friendly-pass scouting: allow, pact-only or logged.
5. Bots as siege fillers while player counts are low.
6. How satellites change hands.
7. Neutral satellites for clanless players.
8. Basic resources extracted by clanless players.
9. Contribution limit size and time frame.
10. Season reset scope.
