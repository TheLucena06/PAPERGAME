/* castletown.js
   The CASTLE path, rebuilt (owner's design, v3.3):
     Stage 2 "The Paper Castle" is now two different levels and no arena:
       1. MARKET TOWN: a bigger level of busy market streets: booths, wells,
          crates, banners, lanterns. SHOP CARTS roll in and out of the rooms
          along the street lanes: they block shots and bodies, and anything
          they run over is shoved aside and takes a little damage.
          One room is the MARKET BRAWL (a quick timed arena inside the level).
          The level's exit is the prison GATE.
       2. THE PRISON: a bigger level of cell blocks (more prisoners and
          bombers), with two new enemies:
            - Mace Guard: slow, heavy, a telegraphed overhead smash.
            - Brigade Guard: a fast shield guard that comes with other guards.
              Its shove pushes you; hitting a wall while shoved hurts more.
              Every hit restrains you: slower and you take more damage (stacks).
          One room is the PRISON BRAWL. Then a quick shop, then the Warden.
   The Sewer path is unchanged.

   How it plugs in:
   - STAGE_TYPES.castle gets `steps` (its own step list, used instead of
     RUN_PLAN.steps) and `levels` (which STAGE_TYPES entry each of its levels
     uses). GameScene.stage() returns the current level's entry.
   - TownMixin goes onto GameScene: townAssign (after a level is generated),
     townRoom (after a room is built), startBrawl / brawlReward, updateTown.
   - Floors: drawTownFloor / drawPrisonFloor (main.js drawFloor branches on look.style). */

/* ---------------- stages ---------------- */
Object.assign(STAGE_TYPES, {
  town: {
    name: 'Market Town', tagline: 'Busy streets. Mind the carts.', subLevelOf: 'castle',
    look: { style: 'town', bg: 0xe4d6bd, line: 0xc4b49a, accent: 0xc0392b, wall: 0xa1887f, block: null, door: 0x795548 },
    enemies: ['guard', 'bomber', 'warlock', 'fireWarlock', 'charger', 'tank', 'gnome'],
    boss: 'warden',
    themes: ['marketRiot', 'siege', 'pyreRitual'],
    champions: ['guard', 'charger', 'tank'],
    roomsBonus: 2,                                         // a longer level than the others
    brawl: 'market'
  },
  prison: {
    name: 'The Prison', tagline: 'Cells, chains, and the Warden.', subLevelOf: 'castle',
    look: { style: 'prison', bg: 0xb9b1a4, line: 0x9c9384, accent: 0x6d4c41, wall: 0x6d6259, block: null, door: 0x4e342e },
    enemies: ['prisoners', 'bomber', 'guard', 'maceGuard', 'brigadeGuard', 'warlock', 'gnome'],
    boss: 'warden',
    themes: ['prisonBreak', 'riotSquad', 'siege'],
    champions: ['guard', 'maceGuard', 'warlock'],
    roomsBonus: 2,
    brawl: 'prison',
    boost: { ids: ['prisoners', 'bomber'], chance: 0.3 },  // 30% of other picks become prisoners / bombers
    squads: true                                           // guards come in squads with Brigade Guards
  }
});
STAGE_TYPES.castle.tagline = 'Market streets, then the prison and its Warden.';
STAGE_TYPES.castle.steps = ['level', 'level', 'boss'];      // town -> prison -> (quick shop) -> Warden. No arena.
STAGE_TYPES.castle.levels = ['town', 'prison'];

Object.assign(THEMED_ROOMS, {
  marketRiot: { name: 'Market Riot', layout: 0, waves: [[['charger', 2], ['bomber', 2]], [['guard', 2], ['warlock', 2]], [['charger', 3], ['tank', 1]]] },
  riotSquad:  { name: 'Riot Squad', layout: 0, waves: [[['guard', 2], ['brigadeGuard', 2]], [['maceGuard', 1], ['brigadeGuard', 2], ['prisoners', 1]], [['maceGuard', 2], ['guard', 2]]] }
});

// The brawl rooms: a timed fight inside the level (like the old arena, but quicker).
const BRAWL_TYPES = {
  market: { name: 'Market Brawl', sub: 'The whole market is fighting! Hold out.', cols: 24, rows: 15,
            durationMs: 35000, spawnEveryMs: 2200, waveBudget: 3, budgetGrowth: 0.06, maxAlive: 10, cartEveryMs: [2600, 4200] },
  prison: { name: 'Prison Brawl', sub: 'The cells are open! Hold out.', cols: 24, rows: 15,
            durationMs: 40000, spawnEveryMs: 2000, waveBudget: 3.5, budgetGrowth: 0.06, maxAlive: 11 }
};

const TOWN_RULES = {
  roomCols: 15, roomRows: 10,                 // town + prison rooms: mostly the regular size...
  largeCols: 20, largeRows: 13, largeChance: 0.25,   // ...25% are bigger than the screen (they scroll)
  cart: { everyMs: [4500, 7500], warnMs: 1000, speed: [165, 205], max: 2, len: 104, wide: 58,
          playerDamage: 6, enemyDamage: 22, hitCdMs: 800, shoveSpeed: 260, shoveMs: 200 },
  restrain: { ms: 4000, maxStacks: 3, slowPer: 0.12, defPer: 0.1 }   // Brigade Guard: per stack
};

/* ---------------- enemies ---------------- */
Object.assign(ENEMY_TYPES, {
  // Prison: a heavy guard with a mace. Slow, with a big telegraphed smash.
  maceGuard: {
    name: 'Mace Guard', ai: 'maceGuard',
    cost: 4, minLevel: 1, postBoss: 1, weight: 2, coins: [4, 5],
    maxHp: 130, speed: 72, speedVariance: 0.05, size: 30, color: 0x455a64, mass: 6,
    contactDamage: 10,
    hitKnockback: 40, hitKnockbackMs: 30, contactPushback: 220, contactPushbackMs: 160,
    smash: { range: 125, reach: 58, radius: 68, damage: 22, windupMs: 720, lockMs: 220 },
    recoverMs: 850, attackCooldownMs: 1500
  },
  // Prison: a fast shield guard that holds prisoners back. Shoves you; every hit restrains you.
  brigadeGuard: {
    name: 'Brigade Guard', ai: 'guard',
    cost: 3, minLevel: 1, postBoss: 1, weight: 1, coins: [3, 4],
    maxHp: 70, speed: 128, speedVariance: 0.05, size: 26, color: 0x5d4037, mass: 4,
    contactDamage: 8, dashDamage: 12,
    hitKnockback: 70, hitKnockbackMs: 40, contactPushback: 200, contactPushbackMs: 160,
    shield: { arcDeg: 100, blockMul: 0.3 },
    turnSpeed: 3.4,
    attackRange: 95, windupMs: 320, dashMs: 220, dashSpeed: 500, recoverMs: 500, attackCooldownMs: 1200,
    brigade: { shoveSpeed: 330, shoveMs: 260, wallDamage: 14 }
  }
});

Object.assign(ENEMY_AI, {
  maceGuard(m, e, t, dt, ctx) {
    const d = e.def, S = d.smash;
    if (e.state === 'move') {
      if (e.hasLos && e.tdist < S.range && e.attackCdMs <= 0) {
        e.mAim = Math.atan2(e.tdy, e.tdx);
        e.setVelocity(0, 0);
        m.setState(e, 'windup', S.windupMs);
        return;
      }
      m.steer(e, t, e.spd, ctx.rooms);
      return;
    }
    if (e.state === 'windup') {
      e.setVelocity(0, 0);
      if (e.stateMs > S.lockMs) e.mAim = Math.atan2(e.tdy, e.tdx);       // stops turning just before it swings
      if (e.stateMs <= 0) {
        const x = e.x + Math.cos(e.mAim) * S.reach, y = e.y + Math.sin(e.mAim) * S.reach;
        m.damagePlayersInRadius(ctx.players, x, y, S.radius, S.damage * e.dmgMul, e);
        e.smashX = x; e.smashY = y; e.fxMs = 220;
        if (m.scene) m.scene.cameras.main.shake(110, 0.005);
        m.setState(e, 'recover', d.recoverMs);
        e.attackCdMs = d.attackCooldownMs;
      }
      return;
    }
    e.setVelocity(0, 0);
    if (e.stateMs <= 0) m.setState(e, 'move', 0);
  }
});

// Guards come in squads in the Prison; prisoners and bombers show up more.
(function () {
  const bw = EnemyManager.prototype.buildWave;
  EnemyManager.prototype.buildWave = function (level, budget, maxCount) {
    const wave = bw.call(this, level, budget, maxCount);
    const sc = this.scene, st = sc && sc.stage ? sc.stage() : null;
    if (!st || (!st.boost && !st.squads)) return wave;
    if (st.boost) {
      const B = st.boost;
      for (let i = 0; i < wave.length; i++) {
        if (B.ids.indexOf(wave[i]) !== -1 || Math.random() >= B.chance) continue;
        const pick = B.ids[Math.floor(Math.random() * B.ids.length)];
        if (this.canAppear(ENEMY_TYPES[pick], level) || ENEMY_TYPES[pick].pair) wave[i] = pick;
      }
    }
    if (st.squads) {
      const extra = [], brigadeOk = this.canAppear(ENEMY_TYPES.brigadeGuard, level);
      for (let i = 0; i < wave.length; i++) {
        if (wave[i] === 'brigadeGuard' && Math.random() < 0.75) extra.push('guard');
        else if (wave[i] === 'guard' && brigadeOk && Math.random() < 0.4) extra.push('brigadeGuard');
      }
      for (let i = 0; i < extra.length && i < 2; i++) wave.push(extra[i]);
    }
    return wave;
  };
})();

/* ---------------- run helpers (stage with its own steps / levels) ---------------- */
// Which RUN_PLAN.stages index a stage id (or a level of one, e.g. 'town') belongs to. -1 = none.
function runStageIndex(id) {
  for (let i = 0; i < RUN_PLAN.stages.length; i++) {
    const opts = RUN_PLAN.stages[i];
    for (let k = 0; k < opts.length; k++) {
      if (opts[k] === id) return i;
      const lv = STAGE_TYPES[opts[k]].levels;
      if (lv && lv.indexOf(id) !== -1) return i;
    }
  }
  return -1;
}
// 'town' -> 'castle'; a normal stage id -> itself.
function runStageParent(id) { return (STAGE_TYPES[id] && STAGE_TYPES[id].subLevelOf) || id; }

/* ---------------- textures ---------------- */
const TownTextures = {
  stall(g, colA, colB, goods) {                      // a 128 x 64 market booth (drawn in two 64 px halves)
    g.fillStyle(0x000000, 0.18); g.fillRoundedRect(6, 50, 118, 12, 4);                      // shadow
    g.fillStyle(0x8d6e63, 1); g.fillRect(8, 30, 112, 26);                                     // counter
    g.lineStyle(2, 0x4e342e, 1); g.strokeRect(8, 30, 112, 26);
    g.lineStyle(1, 0x6d4c41, 0.8); g.lineBetween(8, 43, 120, 43);
    g.fillStyle(0x5d4037, 1); g.fillRect(10, 4, 5, 28); g.fillRect(113, 4, 5, 28);           // poles
    for (let i = 0; i < 8; i++) {                                                             // striped awning
      g.fillStyle(i % 2 ? colB : colA, 1);
      g.fillRect(4 + i * 15, 2, 15, 18);
      g.fillCircle(11.5 + i * 15, 20, 7.5);                                                   // scalloped edge
    }
    g.lineStyle(2, 0x4e342e, 0.9); g.strokeRect(4, 2, 120, 18);
    // goods on the counter
    for (let i = 0; i < 6; i++) {
      const x = 20 + i * 17, y = 36;
      if (goods === 0) { g.fillStyle(0xc62828, 1); g.fillCircle(x, y, 5); g.fillCircle(x + 6, y + 4, 5); g.fillStyle(0x2e7d32, 1); g.fillRect(x - 1, y - 7, 2, 3); }
      else if (goods === 1) { g.fillStyle(0xd7a35b, 1); g.fillEllipse(x + 3, y + 2, 15, 9); g.lineStyle(1, 0x8d5a2b, 1); g.lineBetween(x - 1, y, x + 2, y + 4); g.lineBetween(x + 4, y, x + 7, y + 4); }
      else { g.fillStyle(i % 2 ? 0x1e88e5 : 0x8e24aa, 1); g.fillRect(x - 5, y - 4, 14, 10); g.lineStyle(1, 0x37474f, 0.6); g.strokeRect(x - 5, y - 4, 14, 10); }
    }
  },
  crate(g) {
    g.fillStyle(0x000000, 0.18); g.fillEllipse(34, 56, 52, 12);
    g.fillStyle(0xb08a5a, 1); g.fillRect(10, 10, 44, 44);
    g.lineStyle(3, 0x6d4c41, 1); g.strokeRect(10, 10, 44, 44); g.lineBetween(10, 10, 54, 54); g.lineBetween(54, 10, 10, 54);
    g.lineStyle(1.5, 0x8d6e63, 1); g.lineBetween(10, 24, 54, 24); g.lineBetween(10, 40, 54, 40);
  },
  barrel(g) {
    g.fillStyle(0x000000, 0.18); g.fillEllipse(34, 56, 46, 12);
    g.fillStyle(0x8d5a2b, 1); g.fillCircle(32, 32, 22);
    g.lineStyle(3, 0x4e342e, 1); g.strokeCircle(32, 32, 22); g.strokeCircle(32, 32, 15);
    g.lineStyle(2, 0x78909c, 1); g.strokeCircle(32, 32, 19);
    g.fillStyle(0x5d3a1a, 1); g.fillCircle(32, 32, 4);
  },
  well(g) {
    g.fillStyle(0x000000, 0.2); g.fillEllipse(34, 58, 58, 12);
    g.fillStyle(0x9e9e9e, 1); g.fillCircle(32, 34, 25);
    g.lineStyle(2, 0x616161, 1); g.strokeCircle(32, 34, 25);
    for (let k = 0; k < 10; k++) { const a = k * Math.PI / 5; g.lineBetween(32 + Math.cos(a) * 17, 34 + Math.sin(a) * 17, 32 + Math.cos(a) * 25, 34 + Math.sin(a) * 25); }
    g.fillStyle(0x1f3a52, 1); g.fillCircle(32, 34, 16);                                       // water
    g.fillStyle(0x90caf9, 0.5); g.fillEllipse(27, 30, 10, 4);
    g.fillStyle(0x5d4037, 1); g.fillRect(6, 6, 4, 30); g.fillRect(54, 6, 4, 30); g.fillRect(4, 4, 56, 6);   // crank frame
    g.lineStyle(1.5, 0x3e2723, 1); g.lineBetween(32, 10, 32, 30);
    g.fillStyle(0x795548, 1); g.fillRect(27, 26, 10, 8);                                      // bucket
  },
  cellWall(g) {
    g.fillStyle(0x7d7366, 1); g.fillRect(0, 0, 64, 64);
    g.lineStyle(2, 0x5a5248, 1);
    for (let r = 0; r < 4; r++) {
      g.lineBetween(0, r * 16, 64, r * 16);
      for (let c = (r % 2) * 16; c < 64; c += 32) g.lineBetween(c, r * 16, c, r * 16 + 16);
    }
    g.lineStyle(3, 0x3e3830, 1); g.strokeRect(1, 1, 62, 62);
  },
  bars(g) {
    g.fillStyle(0x1b1512, 0.85); g.fillRect(0, 0, 64, 64);                                    // dark cell behind
    g.fillStyle(0x4a4038, 1); g.fillRect(0, 52, 64, 12);                                      // stone sill
    g.fillStyle(0x37474f, 1); g.fillRect(0, 6, 64, 6);                                        // crossbar
    for (let k = 0; k < 5; k++) { g.fillStyle(0x546e7a, 1); g.fillRect(4 + k * 13, 0, 6, 54); g.fillStyle(0x90a4ae, 0.7); g.fillRect(5 + k * 13, 0, 2, 54); }
    g.lineStyle(2, 0x263238, 1); g.lineBetween(0, 54, 64, 54);
  },
  jailer(g, W, H) {                                   // The Warden, owner's pick: "The Jailer"
    const x = W / 2, ink = 0x2b2420;
    g.fillStyle(0x000000, 0.15); g.fillEllipse(x, H - 6, W * 0.8, 12);
    g.fillStyle(0x37474f, 1); g.fillRoundedRect(x - 26, H - 30, 18, 26, 4); g.fillRoundedRect(x + 8, H - 30, 18, 26, 4);   // legs
    g.lineStyle(2.5, ink, 1); g.strokeRoundedRect(x - 26, H - 30, 18, 26, 4); g.strokeRoundedRect(x + 8, H - 30, 18, 26, 4);
    const bx = x - 38, by = 36, bw = 76, bh = 50;                                             // barrel of plate armor
    g.fillStyle(0x607d8b, 1); g.fillRoundedRect(bx, by, bw, bh, 16);
    g.lineStyle(2, 0x455a64, 1); for (let k = 0; k < 3; k++) g.lineBetween(bx + 6, by + 14 + k * 11, bx + bw - 6, by + 14 + k * 11);
    g.lineStyle(3, ink, 1); g.strokeRoundedRect(bx, by, bw, bh, 16);
    g.fillStyle(0x4e342e, 1); g.fillRect(bx - 1, by + bh - 14, bw + 2, 9);                    // belt
    g.lineStyle(2, ink, 1); g.strokeRect(bx - 1, by + bh - 14, bw + 2, 9);
    g.lineStyle(3.5, 0xffca28, 1); g.strokeCircle(x, by + bh - 6, 9);                         // the giant key ring
    for (let k = 0; k < 4; k++) {
      const a = 0.5 + k * 0.55, kx = x + Math.cos(a) * 9, ky = by + bh - 6 + Math.sin(a) * 9;
      g.lineStyle(3, 0xffca28, 1); g.lineBetween(kx, ky, kx + Math.cos(a) * 9, ky + Math.sin(a) * 9);
      g.fillStyle(0xffca28, 1); g.fillCircle(kx + Math.cos(a) * 10, ky + Math.sin(a) * 10, 2.5);
    }
    for (const s of [-1, 1]) {                                                                // spiked pauldrons
      const px = x + s * 38, py = by + 6;
      for (let k = 0; k < 3; k++) { g.fillStyle(0xb0bec5, 1); g.fillTriangle(px + s * (k * 6 - 8), py - 10, px + s * (k * 6 - 4), py - 20, px + s * (k * 6), py - 10); }
      g.fillStyle(0x78909c, 1); g.fillCircle(px, py, 15);
      g.lineStyle(3, ink, 1); g.strokeCircle(px, py, 15);
    }
    const hx = x - 22, hy = 2, hw = 44, hh = 40;                                              // bucket helm
    g.fillStyle(0xb0bec5, 1); g.fillTriangle(x - 4, hy + 4, x + 4, hy + 4, x, hy - 2);
    g.fillStyle(0x546e7a, 1); g.fillRoundedRect(hx, hy + 2, hw, hh, 8);
    g.lineStyle(3, ink, 1); g.strokeRoundedRect(hx, hy + 2, hw, hh, 8);
    g.fillStyle(0x1c1c1c, 1); g.fillRect(hx + 5, hy + 15, hw - 10, 7);                        // eye slit
    g.fillStyle(0xff7043, 1); g.fillRect(hx + 10, hy + 16, 7, 4); g.fillRect(hx + hw - 17, hy + 16, 7, 4);
    g.fillStyle(0x263238, 1); for (let k = -2; k <= 2; k++) g.fillCircle(x + k * 7, hy + 32, 1.6);   // breathing holes
  },
  make(scene) {
    const W = (k, w, h, fn) => TextureFactory.withGraphics(scene, k, w, h, fn);
    const awn = [[0xc62828, 0xfafafa], [0x1565c0, 0xfafafa], [0x2e7d32, 0xffeb3b]];
    for (let i = 0; i < awn.length; i++) {
      W('tw_stall' + i + 'L', 64, 64, (g) => this.stall(g, awn[i][0], awn[i][1], i));
      W('tw_stall' + i + 'R', 64, 64, (g) => { g.translateCanvas(-64, 0); this.stall(g, awn[i][0], awn[i][1], i); });
    }
    W('tw_crate', 64, 64, (g) => this.crate(g));
    W('tw_barrel', 64, 64, (g) => this.barrel(g));
    W('tw_well', 64, 64, (g) => this.well(g));
    W('tw_cellWall', 64, 64, (g) => this.cellWall(g));
    W('tw_bars', 64, 64, (g) => this.bars(g));
  }
};

(function () {
  const make = Arcane3bTextures.make;
  Arcane3bTextures.make = function (scene) { make.call(this, scene); TownTextures.make(scene); };
  const foe = FoeTextures.make;
  FoeTextures.make = function (scene, id, def) {
    const W = (k, w, h, fn) => { TextureFactory.withGraphics(scene, k, w, h, fn); return true; };
    if (id === 'warden') return W('enemy_warden', 100, 96, (g) => TownTextures.jailer(g, 100, 96));
    if (id === 'maceGuard') return W('enemy_maceGuard', 40, 40, (g) => {
      g.fillStyle(0x455a64, 1); g.fillRoundedRect(4, 6, 32, 30, 6);                           // heavy plate
      g.fillStyle(0x263238, 1); g.fillRoundedRect(9, 2, 22, 16, 4);                           // great helm
      g.fillStyle(0xffd54f, 1); g.fillRect(13, 8, 4, 3); g.fillRect(23, 8, 4, 3);
      g.lineStyle(2, 0x1c1c1c, 1); g.strokeRoundedRect(4, 6, 32, 30, 6);
      g.fillStyle(0x6d4c41, 1); g.fillRect(31, 14, 4, 18);                                    // mace handle
      g.fillStyle(0x78909c, 1); g.fillCircle(33, 12, 6);
      g.fillStyle(0xb0bec5, 1); for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2; g.fillCircle(33 + Math.cos(a) * 7, 12 + Math.sin(a) * 7, 2); }
    });
    if (id === 'brigadeGuard') return W('enemy_brigadeGuard', 30, 30, (g) => {
      g.fillStyle(0x6d4c41, 1); g.fillRoundedRect(3, 3, 24, 24, 4);                           // leather + brass
      g.fillStyle(0x3e2723, 1); g.fillRect(6, 8, 18, 4);
      g.fillStyle(0xffb300, 1); g.fillRect(9, 9, 3, 2); g.fillRect(18, 9, 3, 2);
      g.fillStyle(0xffca28, 1); g.fillCircle(15, 20, 3);                                       // badge
      g.lineStyle(2, 0x3e2723, 1); g.strokeRoundedRect(3, 3, 24, 24, 4);
    });
    return foe.call(this, scene, id, def);
  };
  // Restrained players (Brigade Guard) take more damage.
  const takeHit = Player.prototype.takeHit;
  Player.prototype.takeHit = function (amount, srcX, srcY) {
    if (this.restrainMs > 0 && this.restrainN > 0 && amount > 0) amount = amount * (1 + TOWN_RULES.restrain.defPer * this.restrainN);
    return takeHit.call(this, amount, srcX, srcY);
  };
  // Bestiary pages for the new guards (after the Shield Guard).
  if (typeof BESTIARY_ENTRIES !== 'undefined') {
    const at = BESTIARY_ENTRIES.findIndex((q) => q.id === 'guard') + 1 || BESTIARY_ENTRIES.length;
    BESTIARY_ENTRIES.splice(at, 0,
      { id: 'maceGuard', enemy: 'maceGuard', tag: 'The Prison',
        desc: 'Too heavy to chase you. It just waits for you to come close.',
        abilities: (d) => ['Overhead smash: ' + d.smash.damage + ' damage in a circle in front of it.', 'It flashes and stops aiming just before the smash: step out!'] },
      { id: 'brigadeGuard', enemy: 'brigadeGuard', tag: 'The Prison',
        desc: 'Trained to hold back prisoners. Comes with other guards.',
        abilities: (d) => ['Fast shield charge (' + d.dashDamage + ') that shoves you. Into a wall: +' + d.brigade.wallDamage + '.',
                           'Every hit restrains you (up to 3x): -12% speed and +10% damage taken each, 4 s.'] });
  }
})();

/* ---------------- room layouts ---------------- */
const TownGen = {
  // Lanes (always clear): the street through the left/right doors and the one through the up/down doors.
  lanes(cols, rows) {
    const mcI = Math.floor(cols / 2) - 1, mrI = Math.floor(rows / 2) - 1;
    return { mcI: mcI, mrI: mrI, inH: (r) => r >= mrI - 2 && r <= mrI + 1, inV: (c) => Math.abs(c - mcI) <= 2 };
  },
  blank(iw, ih) { const g = []; for (let r = 0; r < ih; r++) g.push(new Array(iw).fill('.')); return g; },
  finish(room, cols, rows, g, tiles) {
    room.cols = cols; room.rows = rows; room.shape = null;
    room.layoutRows = g.map((row) => row.join(''));
    room.townTiles = tiles;
  },

  // Anything the player can't walk to (a pocket behind booths or cells) is filled in, so nothing spawns there.
  fillPockets(g, tiles, L, filler) {
    const ih = g.length, iw = g[0].length, seen = [];
    for (let r = 0; r < ih; r++) seen.push(new Array(iw).fill(false));
    const q = [[L.mcI, L.mrI]];
    if (g[L.mrI][L.mcI] !== '.') return;
    seen[L.mrI][L.mcI] = true;
    while (q.length) {
      const [c, r] = q.pop();
      for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const x = c + dc, y = r + dr;
        if (x < 0 || y < 0 || x >= iw || y >= ih || seen[y][x] || g[y][x] !== '.') continue;
        seen[y][x] = true; q.push([x, y]);
      }
    }
    for (let r = 0; r < ih; r++) for (let c = 0; c < iw; c++) if (g[r][c] === '.' && !seen[r][c]) { g[r][c] = '#'; tiles[c + ',' + r] = filler; }
  },
  // The cross through the four doors: never blocked.
  corridor(L, c, r) { return (r >= L.mrI - 1 && r <= L.mrI) || (c >= L.mcI - 1 && c <= L.mcI + 1); },

  market(room, cols, rows, big) {
    const iw = cols - 2, ih = rows - 2, L = this.lanes(cols, rows), g = this.blank(iw, ih), tiles = {};
    const free = (c, r) => c >= 0 && r >= 0 && c < iw && r < ih && !L.inH(r) && !L.inV(c) && g[r][c] === '.';
    const put = (c, r, k) => { if (!free(c, r)) return false; g[r][c] = '#'; tiles[c + ',' + r] = k; return true; };
    // booths along the top and bottom walls
    const regions = [[0, L.mcI - 3], [L.mcI + 3, iw - 1]];
    for (const row of [0, ih - 1]) for (const [a, b] of regions) {
      for (let c = a; c + 1 <= b; c += 3) {
        if (Math.random() > 0.8) continue;
        if (!free(c, row) || !free(c + 1, row)) continue;
        const v = Math.floor(Math.random() * 3);
        put(c, row, 'stall' + v + 'L'); put(c + 1, row, 'stall' + v + 'R');
      }
    }
    // wells (1, or 2 in the big plaza) and some crates / barrels (off the walls and the streets)
    const spots = [];
    for (let r = 1; r < ih - 1; r++) for (let c = 1; c < iw - 1; c++) {
      if (!free(c, r)) continue;
      if (big || cols > 15) { if (!L.inH(r - 1) && !L.inH(r + 1)) spots.push([c, r]); }
      else spots.push([c, r]);
    }
    const take = () => spots.length ? spots.splice(Math.floor(Math.random() * spots.length), 1)[0] : null;
    for (let i = 0; i < (big ? 2 : 1); i++) { const s = take(); if (s) put(s[0], s[1], 'well'); }
    const n = (big ? 5 : cols > 15 ? 3 : 2) + Math.floor(Math.random() * 2);
    for (let i = 0; i < n; i++) { const s = take(); if (s) put(s[0], s[1], Math.random() < 0.5 ? 'crate' : 'barrel'); }
    this.fillPockets(g, tiles, L, 'crate');
    this.finish(room, cols, rows, g, tiles);
  },

  /* Prison rooms: one of five layouts. A cell = { c0, c1, r0, r1, dc, dr, dir } (interior coords; dc/dr = its open
     door tile; dir = the way out of the door). */
  PRISON_LAYOUTS: ['cellsTB', 'cellsLR', 'hall', 'pens', 'block'],
  prison(room, cols, rows, big) {
    const iw = cols - 2, ih = rows - 2, L = this.lanes(cols, rows), g = this.blank(iw, ih), tiles = {}, cells = [];
    const ok = (c, r) => c >= 0 && r >= 0 && c < iw && r < ih && !this.corridor(L, c, r);
    const set = (c, r, k) => { if (!ok(c, r)) return false; g[r][c] = '#'; tiles[c + ',' + r] = k; return true; };
    const open = (c, r) => { g[r][c] = '.'; delete tiles[c + ',' + r]; };
    const kind = this.PRISON_LAYOUTS[Math.floor(Math.random() * this.PRISON_LAYOUTS.length)];
    room.prisonLayout = kind;

    // a row of cells along a wall. side: 'top' | 'bottom' | 'left' | 'right'; [a, b] = the span along that wall
    const wallCells = (side, a, b) => {
      const horiz = side === 'top' || side === 'bottom';
      const inner = side === 'top' ? [0, 1] : side === 'bottom' ? [ih - 1, ih - 2] : side === 'left' ? [0, 1] : [iw - 1, iw - 2];
      const front = side === 'top' ? 2 : side === 'bottom' ? ih - 3 : side === 'left' ? 2 : iw - 3;
      const dir = side === 'top' ? 'down' : side === 'bottom' ? 'up' : side === 'left' ? 'right' : 'left';
      const at = (along, across) => horiz ? [along, across] : [across, along];
      let x = a;
      while (x + 1 <= b) {
        const x1 = Math.min(b, x + 1);
        let fine = true;
        for (let k = x; k <= x1; k++) { for (const i of inner) { const [c, r] = at(k, i); if (!ok(c, r)) fine = false; } const [c, r] = at(k, front); if (!ok(c, r)) fine = false; }
        if (!fine) { x++; continue; }
        for (let k = x; k <= x1; k++) { const [c, r] = at(k, front); set(c, r, 'bars'); }
        const sep = x1 + 1;                                   // the wall between this cell and the next
        if (sep <= b) { for (const i of inner) { const [c, r] = at(sep, i); set(c, r, 'cellWall'); } const [c, r] = at(sep, front); set(c, r, 'cellWall'); }
        const door = x + Math.floor(Math.random() * (x1 - x + 1)), [dc, dr] = at(door, front);
        open(dc, dr);
        const [c0, r0] = at(x, Math.min(inner[0], inner[1])), [c1, r1] = at(x1, Math.max(inner[0], inner[1]));
        cells.push({ c0: Math.min(c0, c1), c1: Math.max(c0, c1), r0: Math.min(r0, r1), r1: Math.max(r0, r1), dc: dc, dr: dr, dir: dir });
        x = sep + 1;
      }
    };
    // a free-standing pen: bars all round a 2x1 (or 2x2) floor, door on one side
    const pen = (c, r, w, h) => {
      for (let y = r; y < r + h; y++) for (let x = c; x < c + w; x++) if (!ok(x, y) || g[y][x] !== '.') return false;
      for (let y = r; y < r + h; y++) for (let x = c; x < c + w; x++) {
        const edge = y === r || y === r + h - 1 || x === c || x === c + w - 1;
        if (edge) set(x, y, (x === c || x === c + w - 1) && (y === r || y === r + h - 1) ? 'cellWall' : 'bars');
      }
      const sides = [['up', c + 1 + Math.floor(Math.random() * (w - 2)), r], ['down', c + 1 + Math.floor(Math.random() * (w - 2)), r + h - 1],
                     ['left', c, r + 1 + Math.floor(Math.random() * (h - 2))], ['right', c + w - 1, r + 1 + Math.floor(Math.random() * (h - 2))]];
      const s = sides[Math.floor(Math.random() * 4)];
      open(s[1], s[2]);
      cells.push({ c0: c + 1, c1: c + w - 2, r0: r + 1, r1: r + h - 2, dc: s[1], dr: s[2], dir: s[0] });
      return true;
    };
    const left = [0, L.mcI - 2], right = [L.mcI + 2, iw - 1], top = [0, L.mrI - 2], bottom = [L.mrI + 1, ih - 1];
    if (kind === 'cellsTB') {
      for (const side of ['top', 'bottom']) { wallCells(side, left[0], left[1]); wallCells(side, right[0], right[1]); }
    } else if (kind === 'cellsLR') {
      for (const side of ['left', 'right']) { wallCells(side, top[0], top[1]); wallCells(side, bottom[0], bottom[1]); }
    } else if (kind === 'hall') {
      // a guard hall: rows of stone pillars
      for (let r = 1; r < ih - 1; r += 3) for (let c = 1; c < iw - 1; c += 3) set(c, r, 'cellWall');
    } else if (kind === 'pens') {
      // free-standing pens in the corners of the yard
      const w = 4, h = big || ih >= 11 ? 4 : 3;
      for (const [cx, cy] of [[left[0] + 1, top[0] + (ih >= 11 ? 1 : 0)], [right[1] - w, top[0] + (ih >= 11 ? 1 : 0)], [left[0] + 1, bottom[1] - h + 1 - (ih >= 11 ? 1 : 0)], [right[1] - w, bottom[1] - h + 1 - (ih >= 11 ? 1 : 0)]]) {
        if (Math.random() < 0.8) pen(cx, cy, w, h);
      }
    } else {
      // 'block': cells on one wall, pillars on the other half
      const side = Math.random() < 0.5 ? 'top' : 'bottom';
      wallCells(side, left[0], left[1]); wallCells(side, right[0], right[1]);
      const rows2 = side === 'top' ? [bottom[0] + 1, ih - 2] : [1, top[1] - 1];
      for (let r = rows2[0]; r <= rows2[1]; r += 3) for (let c = 1; c < iw - 1; c += 3) set(c, r, 'cellWall');
    }
    // a couple of barrels / crates in the yard
    for (let i = 0; i < 2; i++) {
      const c = Math.floor(Math.random() * iw), r = Math.floor(Math.random() * ih);
      if (ok(c, r) && g[r][c] === '.' && c > 0 && r > 0 && c < iw - 1 && r < ih - 1 && !cells.some((q) => c >= q.c0 - 1 && c <= q.c1 + 1 && r >= q.r0 - 1 && r <= q.r1 + 1)) set(c, r, Math.random() < 0.5 ? 'barrel' : 'crate');
    }
    this.fillPockets(g, tiles, L, 'cellWall');
    room.prisonCells = cells;
    this.finish(room, cols, rows, g, tiles);
  },

  // After a town / prison level is generated: room shapes + the brawl room.
  assign(map, scene, st) {
    const style = st.look && st.look.style;
    if (style !== 'town' && style !== 'prison') return;
    const R = TOWN_RULES;
    // the brawl: a normal room away from the start
    const cand = map.rooms.filter((r) => r.type === 'normal' && !r.section && r.depth >= 2);
    const pool = cand.length ? cand : map.rooms.filter((r) => r.type === 'normal' && !r.section);
    const br = st.brawl && pool.length ? pool[Math.floor(Math.random() * pool.length)] : null;
    for (let i = 0; i < map.rooms.length; i++) {
      const r = map.rooms[i];
      if (r.type !== 'normal' && r.type !== 'start' && r.type !== 'exit') continue;
      // mostly regular rooms (15x10); some bigger ones (20x13); the brawl room is the biggest (24x15)
      const brawl = r === br, large = !brawl && r.type !== 'start' && Math.random() < R.largeChance;
      const cols = brawl ? BRAWL_TYPES[st.brawl].cols : large ? R.largeCols : R.roomCols;
      const rows = brawl ? BRAWL_TYPES[st.brawl].rows : large ? R.largeRows : R.roomRows;
      if (style === 'town') this.market(r, cols, rows, brawl); else this.prison(r, cols, rows, brawl);
      const big = brawl;
      if (big) r.brawl = st.brawl;
    }
  }
};

/* ---------------- the mixin ---------------- */
const TownMixin = {
  setupTown() {
    this.cartG = this.add.graphics().setDepth(-1);        // carts roll UNDER the walls (out of / into the doorways)
    this.townDecoG = this.add.graphics().setDepth(1);     // banners, chains, lanterns on the walls (static per room)
    this.townTopG = this.add.graphics().setDepth(11);     // bunting over the street (static per room)
    this.townFxG = this.add.graphics().setDepth(84);      // telegraphs, cart warnings, restrain marks, the gate
    this.carts = [];
    this.cartMs = 2000;
    this.cartLanes = null;
  },

  // This stage's step list (the Castle has its own: no arena).
  runSteps() {
    const st = this.run && STAGE_TYPES[this.run.stageId];
    return (st && st.steps) || RUN_PLAN.steps;
  },
  // 0 = first level of the stage, 1 = second... (the boss uses the last level's look)
  stageLevelIdx() {
    const steps = this.runSteps();
    let k = -1;
    for (let i = 0; i <= this.run.step && i < steps.length; i++) if (steps[i] === 'level') k++;
    return Math.max(0, k);
  },

  townAssign(map, st) { TownGen.assign(map, this, st); },

  // After a room is built: block textures, carts, wall decorations.
  townRoom(room) {
    this.carts.length = 0;
    this.cartLanes = null;
    this.townDecoG.clear(); this.townTopG.clear();
    const look = this.rooms.look, style = look && look.style;
    if (style !== 'town' && style !== 'prison') return;
    const T = this.rooms.T;
    if (room.townTiles) {
      const list = this.rooms.blocks.getChildren();
      for (let i = 0; i < list.length; i++) {
        const b = list[i];
        if (b.texture.key === 'wall') continue;
        const c = Math.round((b.x - T / 2) / T) - 1, r = Math.round((b.y - T / 2) / T) - 1, k = room.townTiles[c + ',' + r];
        if (k) { b.setTexture('tw_' + k); b.clearTint(); }
      }
    }
    if (style === 'town') this.setupCartLanes(room);
    this.drawTownDeco(style);
    this.cartMs = 600 + Math.random() * 1200;
  },

  // Which lanes are clear for carts in this room (the street rows / columns through the doors).
  setupCartLanes(room) {
    const R = this.rooms, T = R.T, cols = R.cols, rows = R.rows, mc = Math.floor(cols / 2), mr = Math.floor(rows / 2);
    let h = true, v = true;
    for (let c = 1; c < cols - 1 && h; c++) for (const r of [mr - 1, mr]) if (R.grid[r * cols + c] === 1) h = false;
    for (let r = 1; r < rows - 1 && v; r++) if (R.grid[r * cols + mc] === 1) v = false;
    if (room.type === 'boss') { h = false; v = false; }
    this.cartLanes = (h || v) ? { h: h, v: v, y: mr * T, x: (mc + 0.5) * T } : null;
  },

  drawTownDeco(style) {
    const g = this.townDecoG, top = this.townTopG, W = this.rooms.W, H = this.rooms.H, T = this.rooms.T;
    const rnd = this.floorRandom(W, H + 7);
    if (style === 'town') {
      // banners hanging on the top wall
      const cols = [0xc62828, 0x1565c0, 0x2e7d32, 0xf9a825];
      for (let x = T * 1.5; x < W - T; x += T * 2.5) {
        if (Math.abs(x - W / 2) < T * 1.6) continue;                   // not over the door
        const c = cols[Math.floor(rnd() * cols.length)];
        g.fillStyle(0x5d4037, 1); g.fillRect(x - 16, T * 0.25, 32, 4);
        g.fillStyle(c, 1); g.fillRect(x - 13, T * 0.25 + 4, 26, 38); g.fillTriangle(x - 13, T * 0.25 + 42, x + 13, T * 0.25 + 42, x, T * 0.25 + 30);
        g.fillStyle(0xffeb3b, 1); g.fillCircle(x, T * 0.25 + 18, 5);
        g.lineStyle(1.5, 0x2b2420, 0.8); g.strokeRect(x - 13, T * 0.25 + 4, 26, 26);
      }
      // lantern posts at the street corners
      const lx = [W / 2 - T * 3, W / 2 + T * 3], ly = [this.cartLanes ? this.cartLanes.y - T * 2.2 : H / 2 - T * 2, this.cartLanes ? this.cartLanes.y + T * 2.2 : H / 2 + T * 2];
      for (const x of lx) for (const y of ly) {
        if (this.rooms.solidAt(x, y)) continue;
        g.fillStyle(0x000000, 0.15); g.fillEllipse(x, y + 4, 18, 6);
        g.fillStyle(0x37474f, 1); g.fillRect(x - 2, y - 34, 4, 36);
        g.fillStyle(0xffb300, 0.25); g.fillCircle(x, y - 40, 16);
        g.fillStyle(0x263238, 1); g.fillRect(x - 6, y - 46, 12, 12);
        g.fillStyle(0xffd54f, 1); g.fillRect(x - 4, y - 44, 8, 8);
      }
      // bunting strung across the top of the street (thin: it never hides a fight)
      const by = T * 1.35, flags = [0xe53935, 0xfdd835, 0x1e88e5, 0x43a047];
      top.lineStyle(1.5, 0x5d4037, 0.8);
      top.beginPath(); top.moveTo(T, by);
      for (let x = T; x <= W - T; x += 16) top.lineTo(x, by + Math.sin((x - T) / (W - 2 * T) * Math.PI) * 26);
      top.strokePath();
      for (let x = T + 20, i = 0; x < W - T - 10; x += 34, i++) {
        const y = by + Math.sin((x - T) / (W - 2 * T) * Math.PI) * 26;
        top.fillStyle(flags[i % flags.length], 0.9); top.fillTriangle(x - 7, y, x + 7, y, x, y + 14);
      }
    } else {
      // prison: torches and hanging chains on the walls
      for (let x = T * 2; x < W - T; x += T * 3) {
        if (Math.abs(x - W / 2) < T * 1.6) continue;
        for (const y of [T * 0.55, H - T * 0.55]) {
          g.fillStyle(0x4e342e, 1); g.fillRect(x - 3, y - 6, 6, 16);
          g.fillStyle(0xff9800, 0.3); g.fillCircle(x, y - 10, 15);
          g.fillStyle(0xffb300, 1); g.fillTriangle(x - 5, y - 6, x + 5, y - 6, x, y - 20);
          g.fillStyle(0xfff176, 1); g.fillTriangle(x - 2, y - 6, x + 2, y - 6, x, y - 13);
        }
      }
      for (const x of [T * 0.5, W - T * 0.5]) for (let y = T * 2.5; y < H - T * 2; y += T * 2.5) {
        if (Math.abs(y - H / 2) < T * 1.2) continue;
        g.lineStyle(3, 0x455a64, 1);
        for (let k = 0; k < 5; k++) g.strokeEllipse(x, y + k * 8, k % 2 ? 4 : 7, k % 2 ? 7 : 4);
        g.lineStyle(3, 0x37474f, 1); g.strokeCircle(x, y + 46, 7);
      }
    }
  },

  /* ---- brawl rooms ---- */
  startBrawl(room) {
    const B = BRAWL_TYPES[room.brawl];
    room.fightStarted = true;
    this.arena = { kind: 'survival', msLeft: B.durationMs, spawnMs: 900, wave: 0, cfg: B, label: B.name + '!' };
    this.barAdapter.def.name = B.name;
    this.barAdapter.totalMaxHp = B.durationMs;
    this.barKind = 'timer';
    this.hud.setBoss(this.barAdapter);
    this.hud.showBanner(B.name.toUpperCase() + '!');
    this.hud.floatText(this.rooms.W / 2, this.rooms.H / 2 - 70, B.sub, '#5d4037');
    if (room.brawl === 'market') this.cartMs = 800;
  },

  brawlReward(room) {
    this.arenaReward(room);                       // coins + a reward chest (specials.js)
    this.earnShavings(SHAVINGS_EARN.arena);
  },

  /* ---- carts ---- */
  spawnCart(brawl) {
    const L = this.cartLanes, C = TOWN_RULES.cart;
    if (!L) return;
    const horiz = L.h && (!L.v || Math.random() < 0.65), sgn = Math.random() < 0.5 ? 1 : -1;
    const W = this.rooms.W, H = this.rooms.H, len = C.len;
    // never two carts on the same lane going the same way too close together
    for (let i = 0; i < this.carts.length; i++) if (this.carts[i].horiz === horiz && this.carts[i].sgn === sgn && this.carts[i].warnMs > 0) return;
    this.carts.push({
      horiz: horiz, sgn: sgn, warnMs: C.warnMs,
      x: horiz ? (sgn > 0 ? -len : W + len) : L.x, y: horiz ? L.y : (sgn > 0 ? -len : H + len),
      speed: (C.speed[0] + Math.random() * (C.speed[1] - C.speed[0])) * (brawl ? 1.12 : 1),
      goods: Math.floor(Math.random() * 4), wob: Math.random() * 10
    });
  },

  cartRect(k) {
    const C = TOWN_RULES.cart, hl = C.len / 2, hw = C.wide / 2;
    return k.horiz ? { x: k.x, y: k.y, hw: hl, hh: hw } : { x: k.x, y: k.y, hw: hw, hh: hl };
  },

  updateCarts(dt) {
    const C = TOWN_RULES.cart, playing = this.mode === 'play';
    if (!this.cartLanes) { this.carts.length = 0; this.cartG.clear(); return; }
    if (playing) {
      const brawl = this.room && this.room.brawl === 'market' && this.arena;
      this.cartMs -= dt;
      const alive = this.carts.length;
      const done = this.room && this.room.type === 'exit' && this.rooms.hatchActive;   // the gate is open: the street goes quiet
      if (this.cartMs <= 0 && !done) {
        const every = brawl ? BRAWL_TYPES.market.cartEveryMs : C.everyMs;
        this.cartMs = every[0] + Math.random() * (every[1] - every[0]);
        if (alive < (brawl ? 3 : C.max)) this.spawnCart(brawl);
      }
    }
    const W = this.rooms.W, H = this.rooms.H, now = this.time.now;
    for (let i = this.carts.length - 1; i >= 0; i--) {
      const k = this.carts[i];
      if (!playing) continue;
      if (k.warnMs > 0) { k.warnMs -= dt; continue; }
      const step = k.sgn * k.speed * dt / 1000;
      if (k.horiz) k.x += step; else k.y += step;
      if ((k.horiz && (k.x < -C.len * 1.2 || k.x > W + C.len * 1.2)) || (!k.horiz && (k.y < -C.len * 1.2 || k.y > H + C.len * 1.2))) { this.carts.splice(i, 1); continue; }
      this.cartCollide(k, now);
    }
    this.drawCarts();
  },

  // Players and enemies are pushed out of the cart's way (and hurt); shots stop on it.
  cartCollide(k, now) {
    const C = TOWN_RULES.cart, r = this.cartRect(k);
    const fx = k.horiz ? k.sgn : 0, fy = k.horiz ? 0 : k.sgn;
    const out = (x, y, rad) => {
      // side to push to: away from the lane's middle line; across the lane from the cart's nose if hit head-on
      let side = k.horiz ? (y >= r.y ? 1 : -1) : (x >= r.x ? 1 : -1);
      if (k.horiz && Math.abs(y - r.y) < 2) side = Math.random() < 0.5 ? 1 : -1;
      if (!k.horiz && Math.abs(x - r.x) < 2) side = Math.random() < 0.5 ? 1 : -1;
      let nx = k.horiz ? x : r.x + side * (r.hw + rad + 2), ny = k.horiz ? r.y + side * (r.hh + rad + 2) : y;
      if (this.rooms.solidAt(nx, ny)) { side = -side; nx = k.horiz ? x : r.x + side * (r.hw + rad + 2); ny = k.horiz ? r.y + side * (r.hh + rad + 2) : y; }
      return { x: nx, y: ny, sx: k.horiz ? 0 : side, sy: k.horiz ? side : 0 };
    };
    const inside = (x, y, rad) => Math.abs(x - r.x) < r.hw + rad && Math.abs(y - r.y) < r.hh + rad;
    for (let i = 0; i < this.players.length; i++) {
      const p = this.players[i];
      if (!p.alive || p.burrow) continue;
      const rad = p.stats.size / 2, x = p.sprite.x, y = p.sprite.y;
      if (!inside(x, y, rad)) continue;
      const o = out(x, y, rad);
      p.sprite.body.reset(o.x, o.y);
      p.shoveMs = C.shoveMs; p.shoveX = o.sx * 0.7 + fx * 0.7; p.shoveY = o.sy * 0.7 + fy * 0.7; p.shoveSpeed = C.shoveSpeed; p.shoveWall = 0;
      if (!(p.cartHitAt > now)) {
        p.cartHitAt = now + C.hitCdMs;
        const res = p.takeHit(Math.round(C.playerDamage * Math.max(1, this.enemies.dmgMul * 0.8)), r.x - fx * r.hw, r.y - fy * r.hh);
        if (res === 'hit') this.hud.floatText(o.x, o.y - 28, 'Run over!', '#8d6e63');
      }
    }
    const list = this.enemies.group.getChildren();
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      if (!e.active || !e.def || e.def.boss || e.def.miniBoss || e.isBossPart || e.state === 'air') continue;
      const rad = e.def.size / 2 * (e.scaleX || 1);
      if (!inside(e.x, e.y, rad)) continue;
      const o = out(e.x, e.y, rad);
      e.body.reset(o.x, o.y);
      if (!(e.cartHitAt > now)) {
        e.cartHitAt = now + C.hitCdMs;
        this.hitEnemy(e, C.enemyDamage, o.sx * 0.6 + fx * 0.8, o.sy * 0.6 + fy * 0.8, 260, 140, null, 'cart');
      }
    }
    for (const pool of [this.playerBullets, this.enemyBullets]) {
      const bl = pool.group.getChildren();
      for (let i = 0; i < bl.length; i++) {
        const b = bl[i];
        if (b.active && inside(b.x, b.y, 3)) { this.hud.addFx(b.x, b.y, 10, 0x8d6e63, 120); pool.kill(b); }
      }
    }
  },

  drawCarts() {
    const g = this.cartG, C = TOWN_RULES.cart, fx = this.townFxG, now = this.time.now;
    g.clear();
    const goodsCol = [[0xc62828, 0xe53935], [0x558b2f, 0x7cb342], [0xd4a83a, 0xe8c15a], [0x6a1b9a, 0x1e88e5]];
    for (let i = 0; i < this.carts.length; i++) {
      const k = this.carts[i];
      if (k.warnMs > 0) {                                   // telegraph: arrows where it will come in
        const W = this.rooms.W, H = this.rooms.H, T = this.rooms.T;
        const ex = k.horiz ? (k.sgn > 0 ? T * 1.3 : W - T * 1.3) : k.x, ey = k.horiz ? k.y : (k.sgn > 0 ? T * 1.3 : H - T * 1.3);
        const blink = Math.floor(k.warnMs / 140) % 2 === 0 ? 0.9 : 0.4;
        fx.fillStyle(0xd84315, blink);
        for (let a = 0; a < 3; a++) {
          const o = a * 18, dx = k.horiz ? k.sgn : 0, dy = k.horiz ? 0 : k.sgn, px = ex + dx * o, py = ey + dy * o, nx = -dy, ny = dx;
          fx.fillTriangle(px + dx * 10, py + dy * 10, px - dx * 4 + nx * 10, py - dy * 4 + ny * 10, px - dx * 4 - nx * 10, py - dy * 4 - ny * 10);
        }
        continue;
      }
      const hl = C.len / 2, hw = C.wide / 2, dx = k.horiz ? k.sgn : 0, dy = k.horiz ? 0 : k.sgn, nx = -dy, ny = dx;
      const P = (a, b) => ({ x: k.x + dx * a + nx * b, y: k.y + dy * a + ny * b });     // a = along the lane, b = across
      const quad = (a0, b0, a1, b1, col, alpha) => {
        const p1 = P(a0, b0), p2 = P(a1, b0), p3 = P(a1, b1), p4 = P(a0, b1);
        g.fillStyle(col, alpha === undefined ? 1 : alpha);
        g.fillTriangle(p1.x, p1.y, p2.x, p2.y, p3.x, p3.y); g.fillTriangle(p1.x, p1.y, p3.x, p3.y, p4.x, p4.y);
      };
      quad(-hl + 4, -hw - 2, hl - 14, hw + 2, 0x000000, 0.16);                            // shadow
      const wob = Math.sin(now / 60 + k.wob) * 1.2;
      for (const a of [-hl * 0.55, hl * 0.4]) for (const s of [-1, 1]) quad(a - 9, s * (hw - 2), a + 9, s * (hw + 6), 0x3e2723);   // wheels
      quad(-hl, -hw + 6, hl - 22, hw - 6, 0x8d6e63);                                      // bed
      g.lineStyle(2, 0x4e342e, 1);
      const c1 = P(-hl, -hw + 6), c2 = P(hl - 22, -hw + 6), c3 = P(hl - 22, hw - 6), c4 = P(-hl, hw - 6);
      g.strokePoints([c1, c2, c3, c4], true);
      for (let s = -1; s <= 1; s += 2) { const a = P(hl - 22, s * 8), b = P(hl, s * 5); g.lineBetween(a.x, a.y, b.x, b.y); }   // shafts
      const gc = goodsCol[k.goods];
      for (let a = -hl + 12; a < hl - 30; a += 13) for (let b = -hw + 14; b <= hw - 14; b += 12) {
        const q = P(a, b + wob);
        g.fillStyle((a + b) % 2 ? gc[0] : gc[1], 1); g.fillCircle(q.x, q.y, 6);
      }
      const ln = P(-hl - 2, 0); g.fillStyle(0xffd54f, 1); g.fillCircle(ln.x, ln.y, 4);    // lantern on the back
      for (let s = -1; s <= 1; s += 2) {                                                  // speed lines
        const a = P(-hl - 14, s * 14), b = P(-hl - 34, s * 14);
        g.lineStyle(2, 0x5d4037, 0.35); g.lineBetween(a.x, a.y, b.x, b.y);
      }
    }
  },

  /* ---- every frame ---- */
  updateTown(dt) {
    const fx = this.townFxG, playing = this.mode === 'play', R = TOWN_RULES.restrain;
    fx.clear();
    this.updateCarts(dt);
    // shoves (carts, Brigade Guards): a push that can slam you into a wall
    for (let i = 0; i < this.players.length; i++) {
      const p = this.players[i];
      if (p.restrainMs > 0) {
        if (playing) p.restrainMs -= dt;
        if (p.restrainMs <= 0) p.restrainN = 0;
        else if (p.alive) {
          p.extraSlow += R.slowPer * p.restrainN;
          const x = p.sprite.x, y = p.sprite.y - 32;
          for (let k = 0; k < p.restrainN; k++) { fx.lineStyle(2.5, 0x78909c, 0.95); fx.strokeEllipse(x - (p.restrainN - 1) * 6 + k * 12, y, 9, 6); }
        }
      }
      if (!(p.shoveMs > 0) || !p.alive || !playing) continue;
      p.shoveMs -= dt;
      p.pullX += p.shoveX * p.shoveSpeed; p.pullY += p.shoveY * p.shoveSpeed;
      const len = Math.sqrt(p.shoveX * p.shoveX + p.shoveY * p.shoveY) || 1, ahead = p.stats.size / 2 + 8;
      if (p.shoveWall > 0 && this.rooms.solidAt(p.sprite.x + p.shoveX / len * ahead, p.sprite.y + p.shoveY / len * ahead)) {
        p.dotHit(Math.round(p.shoveWall * (1 + R.defPer * (p.restrainN || 0))));
        this.hud.floatText(p.sprite.x, p.sprite.y - 40, 'Slammed!', '#c62828');
        this.hud.addFx(p.sprite.x + p.shoveX / len * ahead, p.sprite.y + p.shoveY / len * ahead, 26, 0x9e9e9e, 220);
        this.cameras.main.shake(140, 0.007);
        p.shoveMs = 0; p.shoveWall = 0;
      }
    }
    // Mace Guard: the smash telegraph and its impact
    const list = this.enemies.group.getChildren();
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      if (!e.active || e.typeId !== 'maceGuard') continue;
      const S = e.def.smash;
      if (e.state === 'windup' && e.mAim !== undefined) {
        const x = e.x + Math.cos(e.mAim) * S.reach, y = e.y + Math.sin(e.mAim) * S.reach, k = 1 - Math.max(0, e.stateMs) / S.windupMs;
        fx.lineStyle(2, 0xc62828, 0.75); fx.strokeCircle(x, y, S.radius);
        fx.fillStyle(0xc62828, 0.16); fx.fillCircle(x, y, S.radius * k);
        fx.lineStyle(5, 0x78909c, 1); fx.lineBetween(e.x, e.y, e.x - Math.cos(e.mAim) * 22 * k, e.y - Math.sin(e.mAim) * 22 * k - 18 * k);   // the mace goes up
      }
      if (e.fxMs > 0 && e.smashX !== undefined) {
        fx.fillStyle(0x8d6e63, 0.35); fx.fillCircle(e.smashX, e.smashY, S.radius);
        fx.lineStyle(3, 0x5d4037, 0.8); for (let k = 0; k < 6; k++) { const a = k * 1.05; fx.lineBetween(e.smashX, e.smashY, e.smashX + Math.cos(a) * S.radius * 0.8, e.smashY + Math.sin(a) * S.radius * 0.8); }
      }
    }
    // the prison gate around the town's exit hatch
    const look = this.rooms.look;
    if (look && look.style === 'town' && this.rooms.hatchActive && this.room && this.room.type === 'exit') {
      const h = this.rooms.hatch, x = h.x, y = h.y;
      fx.fillStyle(0x6d6259, 1); fx.fillRect(x - 62, y - 70, 18, 96); fx.fillRect(x + 44, y - 70, 18, 96);   // posts
      fx.fillStyle(0x7d7366, 1); fx.fillRect(x - 66, y - 84, 132, 20);                                         // lintel
      fx.lineStyle(2, 0x3e3830, 1); fx.strokeRect(x - 62, y - 70, 18, 96); fx.strokeRect(x + 44, y - 70, 18, 96); fx.strokeRect(x - 66, y - 84, 132, 20);
      for (let k = -3; k <= 3; k++) { fx.fillStyle(0x546e7a, 1); fx.fillRect(x + k * 12 - 2, y - 64, 4, 22); fx.fillTriangle(x + k * 12 - 3, y - 42, x + k * 12 + 3, y - 42, x + k * 12, y - 34); }   // raised portcullis
      fx.fillStyle(0x546e7a, 1); fx.fillRect(x - 42, y - 62, 84, 4);
      fx.fillStyle(0xffca28, 1); fx.fillRect(x - 7, y - 80, 14, 11); fx.lineStyle(3, 0xffca28, 1); fx.beginPath(); fx.arc(x, y - 80, 5, Math.PI, 0); fx.strokePath();   // padlock sign
    }
  },

  // Brigade Guard hits: shove + restrain. (called from onPlayerHit)
  townHitCheck(p, res, attacker) {
    if ((res !== 'hit' && res !== 'block') || !attacker || !attacker.def || !attacker.def.brigade) return;
    const B = attacker.def.brigade, R = TOWN_RULES.restrain;
    const dx = p.sprite.x - attacker.x, dy = p.sprite.y - attacker.y, len = Math.sqrt(dx * dx + dy * dy) || 1;
    p.shoveMs = B.shoveMs; p.shoveX = dx / len; p.shoveY = dy / len; p.shoveSpeed = B.shoveSpeed;
    p.shoveWall = Math.round(B.wallDamage * (attacker.dmgMul || 1));
    if (res !== 'hit') return;
    p.restrainN = Math.min(R.maxStacks, (p.restrainMs > 0 ? p.restrainN || 0 : 0) + 1);
    p.restrainMs = R.ms;
    this.hud.floatText(p.sprite.x, p.sprite.y - 44, 'Restrained x' + p.restrainN, '#546e7a');
  },

  /* ---- floors ---- */
  drawTownFloor(g, W, H, look) {
    const rnd = this.floorRandom(W, H), T = this.rooms.T, room = this.room || {};
    const mr = Math.floor(this.rooms.rows / 2), mc = Math.floor(this.rooms.cols / 2), ly = mr * T, lx = (mc + 0.5) * T;
    // cobblestones
    for (let y = 0, row = 0; y < H; y += 22, row++) {
      for (let x = (row % 2) * 14 - 14; x < W; x += 28) {
        const v = rnd();
        g.fillStyle(v < 0.33 ? 0xd9c9ab : v < 0.66 ? 0xd2c09f : 0xdccfb4, 1);
        g.fillRoundedRect(x + 2 + rnd() * 2, y + 2 + rnd() * 2, 23, 17, 6);
      }
    }
    // the streets: flat paving with cart ruts
    const street = (horiz) => {
      g.fillStyle(0xbfae90, 0.75);
      if (horiz) g.fillRect(0, ly - T * 1.25, W, T * 2.5); else g.fillRect(lx - T * 1.25, 0, T * 2.5, H);
      g.lineStyle(1, 0xa8977a, 0.7);
      if (horiz) { for (let x = 0; x < W; x += 48) g.lineBetween(x, ly - T * 1.25, x, ly + T * 1.25); }
      else { for (let y = 0; y < H; y += 48) g.lineBetween(lx - T * 1.25, y, lx + T * 1.25, y); }
      g.lineStyle(3, 0x8a7a60, 0.55);
      for (const o of [-22, 22]) { if (horiz) g.lineBetween(0, ly + o, W, ly + o); else g.lineBetween(lx + o, 0, lx + o, H); }
    };
    street(true); street(false);
    // drain grate where the streets cross
    g.fillStyle(0x4e4a44, 0.9); g.fillRect(lx - 14, ly - 14, 28, 28);
    g.lineStyle(2, 0x2b2722, 1); for (let k = -1; k <= 1; k++) g.lineBetween(lx + k * 8, ly - 13, lx + k * 8, ly + 13);
    // litter: straw, cabbage leaves, apples, puddles, chalk
    for (let k = 0; k < Math.floor(W * H / 9000); k++) {
      const x = rnd() * W, y = rnd() * H, v = rnd();
      if (v < 0.35) { g.lineStyle(1.5, 0xd4b24c, 0.8); g.lineBetween(x, y, x + 8, y - 3); g.lineBetween(x + 2, y + 2, x + 9, y + 4); }
      else if (v < 0.5) { g.fillStyle(0x7cb342, 0.75); g.fillEllipse(x, y, 10, 6); }
      else if (v < 0.58) { g.fillStyle(0xc62828, 0.85); g.fillCircle(x, y, 4); }
      else if (v < 0.66) { g.fillStyle(0x90a4ae, 0.35); g.fillEllipse(x, y, 40 + rnd() * 30, 14 + rnd() * 8); }
    }
    // shadows under the booths
    if (room.townTiles) for (const key in room.townTiles) {
      if (room.townTiles[key].indexOf('stall') !== 0) continue;
      const [c, r] = key.split(',').map(Number);
      g.fillStyle(0x000000, 0.08); g.fillRect((c + 1) * T - 4, (r + 1) * T + T * 0.75, T + 8, T * 0.4);
    }
    // a hopscotch someone chalked
    const hx = T * 2 + rnd() * (W - T * 6), hy = ly + T * 1.6;
    if (hy < H - T * 2) { g.lineStyle(1.5, 0xffffff, 0.55); for (let k = 0; k < 4; k++) g.strokeRect(hx + k * 22, hy, 22, 22); }
  },

  drawPrisonFloor(g, W, H, look) {
    const rnd = this.floorRandom(W, H), T = this.rooms.T, room = this.room || {};
    // big flagstones
    for (let y = 0, row = 0; y < H; y += 48, row++) {
      for (let x = (row % 2) * 32 - 32; x < W; x += 64) {
        g.fillStyle(rnd() < 0.5 ? 0xb2aa9c : 0xaaa294, 1); g.fillRect(x + 2, y + 2, 60, 44);
      }
    }
    g.lineStyle(1, 0x8a8275, 0.7);
    for (let y = 0; y < H; y += 48) g.lineBetween(0, y, W, y);
    // stains, straw, puddles, a drain
    for (let k = 0; k < Math.floor(W * H / 22000); k++) { g.fillStyle(0x5d5348, 0.15 + rnd() * 0.1); g.fillEllipse(rnd() * W, rnd() * H, 30 + rnd() * 60, 14 + rnd() * 26); }
    for (let k = 0; k < Math.floor(W * H / 12000); k++) {
      const x = rnd() * W, y = rnd() * H;
      g.lineStyle(1.5, 0xc9a94a, 0.7); g.lineBetween(x, y, x + 9, y - 2); g.lineBetween(x + 3, y + 3, x + 10, y + 2);
    }
    g.fillStyle(0x3e3a35, 1); g.fillCircle(W / 2, H / 2, 16);
    g.lineStyle(2, 0x23201c, 1); for (let k = -1; k <= 1; k++) g.lineBetween(W / 2 + k * 7, H / 2 - 13, W / 2 + k * 7, H / 2 + 13);
    // inside the cells: dark floor, a straw bed and a bucket; open doors swung out
    if (room.prisonCells) for (const c of room.prisonCells) {
      const x0 = (c.c0 + 1) * T, y0 = (c.r0 + 1) * T, w = (c.c1 - c.c0 + 1) * T, h = (c.r1 - c.r0 + 1) * T;
      g.fillStyle(0x3b342d, 0.85); g.fillRect(x0, y0, w, h);
      const vert = c.dir === 'up' || c.dir === 'down';
      const far = c.dir === 'down' || c.dir === 'right';                                          // the bed goes away from the door
      if (vert) { g.fillStyle(0xc9a94a, 0.8); g.fillRoundedRect(x0 + 8, far ? y0 + 6 : y0 + h - 32, Math.min(w - 16, 70), 26, 6); }
      else { g.fillStyle(0xc9a94a, 0.8); g.fillRoundedRect(far ? x0 + 6 : x0 + w - 32, y0 + 8, 26, Math.min(h - 16, 70), 6); }
      g.fillStyle(0x6d4c41, 1); g.fillCircle(x0 + w / 2 + (vert ? w / 2 - 16 : 0), y0 + h / 2 + (vert ? 0 : h / 2 - 16), 7);   // the bucket
      const tx = (c.dc + 1) * T, ty = (c.dr + 1) * T;
      g.fillStyle(0x1b1512, 0.6); g.fillRect(tx + 2, ty + 2, T - 4, T - 4);
      const hx = c.dir === 'right' ? tx + T : c.dir === 'left' ? tx : tx + 4, hy = c.dir === 'down' ? ty + T : c.dir === 'up' ? ty : ty + 4;
      const ex = hx + (c.dir === 'right' ? 50 : c.dir === 'left' ? -50 : 12), ey = hy + (c.dir === 'down' ? 50 : c.dir === 'up' ? -50 : 12);
      g.lineStyle(7, 0x37474f, 1); g.lineBetween(hx, hy, ex, ey);                                // the barred door, swung open
      g.lineStyle(3, 0x90a4ae, 1); g.lineBetween(hx, hy, ex, ey);
      g.fillStyle(0x263238, 1); g.fillCircle(hx, hy, 5);
    }
  }
};
