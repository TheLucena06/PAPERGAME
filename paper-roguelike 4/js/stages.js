/* stages.js
   The shape of a run (Dead Cells style), all data:
   - RUN_PLAN.stages: one list of stage choices per stage. Stage 1 is fixed;
     after each boss the players pick one of the next stage's options.
   - RUN_PLAN.steps: what happens inside every stage, in order.
   - STAGE_TYPES: each stage's look, enemies, boss, themed final rooms and
     arena champions.
   - THEMED_ROOMS: the special last room of a level (set pieces with waves).
   - ARENA_TYPES: the big scrolling room in the middle of a stage.
   - SPECIAL_ROOMS: how often merchant / treasure / shrine rooms appear.
   The GameScene reads these (startRun / runStep / onHatch). */

const RUN_PLAN = {
  stages: [
    ['notebook'],
    ['sewer', 'castle']
    // more stages come in later phases
  ],
  steps: ['level', 'arena', 'level', 'boss']
};

const STAGE_TYPES = {
  notebook: {
    name: 'The Notebook', tagline: 'Where it all starts. Blue lines, red margin.',
    look: { style: 'notebook', bg: 0xf3ead8, line: 0xb9cfe0, accent: 0xe8a3a3, wall: null, block: null, door: null },
    enemies: ['runner', 'shooter', 'charger', 'tank', 'gnome'],
    boss: 'bookworm',
    themes: ['wormNest', 'paperTigers', 'tankWall', 'crossfire'],
    champions: ['charger', 'tank', 'shooter']
  },
  sewer: {
    name: 'The Ink Sewers', tagline: 'Wet, dark, and full of things that split.',
    look: { style: 'sewer', bg: 0xcfd8dc, line: 0xa7b6bd, accent: 0x455a64, wall: 0x8fa3ad, block: 0x9fb2ba, door: 0x607d8b, puddles: true },
    enemies: ['inkdrop', 'inkblob', 'bigInkblob', 'smallWorm', 'gale', 'leech', 'shooter', 'gnome'],
    boss: 'kingInkblot',
    themes: ['flood', 'leechNest', 'whirlpool'],
    champions: ['bigInkblob', 'gale', 'leech']
  },
  castle: {
    name: 'The Paper Castle', tagline: 'Cells, chains, and things that burn.',
    look: { style: 'castle', bg: 0xebdfcb, line: 0xcdbba5, accent: 0xa52a2a, wall: 0xb39b86, block: 0xc8b49c, door: 0x8d6e63 },
    enemies: ['prisoners', 'warlock', 'fireWarlock', 'bomber', 'guard', 'charger', 'tank', 'gnome'],
    boss: 'warden',
    themes: ['prisonBreak', 'pyreRitual', 'siege'],
    champions: ['guard', 'warlock', 'charger']
  }
};

// Last room of a level. waves: list of waves, each a list of [enemyId, count].
// Co-op adds 50% to every count. layout: ROOM_LAYOUTS index (0 = open).
const THEMED_ROOMS = {
  wormNest:    { name: 'Worm Nest', layout: 0, waves: [[['smallWorm', 3]], [['smallWorm', 3], ['runner', 3]]] },
  paperTigers: { name: 'Paper Tigers', layout: 4, waves: [[['runner', 6]], [['charger', 3], ['runner', 3]], [['charger', 4]]] },
  tankWall:    { name: 'The Wall', layout: 1, waves: [[['tank', 2], ['shooter', 2]], [['tank', 3], ['shooter', 3]]] },
  crossfire:   { name: 'Crossfire', layout: 3, waves: [[['shooter', 4]], [['shooter', 5], ['runner', 2]]] },
  flood:       { name: 'The Flood', layout: 0, waves: [[['inkblob', 3]], [['bigInkblob', 2]], [['bigInkblob', 2], ['inkblob', 2]]] },
  leechNest:   { name: 'Leech Nest', layout: 6, waves: [[['leech', 5]], [['leech', 6], ['shooter', 2]]] },
  whirlpool:   { name: 'Whirlpool', layout: 0, waves: [[['gale', 2], ['inkdrop', 4]], [['gale', 3], ['inkblob', 3]]] },
  prisonBreak: { name: 'Prison Break', layout: 7, waves: [[['prisoners', 2]], [['prisoners', 3]]] },
  pyreRitual:  { name: 'Pyre Ritual', layout: 3, waves: [[['warlock', 4]], [['fireWarlock', 1], ['warlock', 3]]] },
  siege:       { name: 'Siege', layout: 1, waves: [[['bomber', 3], ['guard', 1]], [['bomber', 3], ['guard', 2]], [['guard', 3], ['charger', 2]]] }
};

// Middle of a stage: one big scrolling room (the camera follows you).
const ARENA_TYPES = {
  // v2.2: survival is a tight 18x12 room (much harder than the old 36x24: nowhere to kite)
  survival: { name: 'Hold out!', sub: 'Survive until the timer runs out', cols: 18, rows: 12,
              durationMs: 60000, spawnEveryMs: 2400, waveBudget: 3, budgetGrowth: 0.06, maxAlive: 12 },
  champion: { name: 'Champion', sub: 'A champion and its guards', cols: 32, rows: 22,
              escorts: 4 }
};

// Champions: a normal enemy, much bigger and tougher, with a boss bar.
const CHAMPION = { scale: 1.9, hpMul: 9, dmgMul: 1.4, speedMul: 0.95, coins: 25 };

// Non-fight rooms that the level generator places in dead ends.
const SPECIAL_ROOMS = {
  // Wandering merchant (see specials.js planMerchant): per stage section (level, arena, level) he shows up
  // at most once to take an order, and once more (the next step) to deliver it. Never first on the last step.
  merchantChance: [0.5, 0.6],   // chance to show up on step 1, and on step 2 if he didn't on step 1
  treasureChance: 0.6,      // chance of a treasure room
  mimicChance: 0.7,         // ...and of its chest being a mimic
  shrineChance: 0.35,
  shrineHpPct: 25,          // a shrine costs this % of max HP (per player) for a free buff pick
  merchant: { orderMul: 1.3 },   // orders cost 130% (paid now, delivered when you meet him again)
  chestCoins: [10, 18]
};
