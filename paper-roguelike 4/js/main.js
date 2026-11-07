/* main.js
   GAME_CONFIG (tuning numbers), textures drawn from shapes, the scenes
   (Boot, Game, GameOver) and the Phaser game setup. Loaded LAST. */

const GAME_CONFIG = {
  width: 960,
  height: 640,
  tile: 64,                  // room = 15 x 10 tiles
  maxEnemies: 30,            // hard cap on enemies alive at once
  maxProjectiles: 120,       // player bullet pool
  maxEnemyProjectiles: 80,   // enemy bullet pool
  maxCoins: 120,             // coin pool
  maxFrameMs: 50,            // clamp delta so a lag spike can't teleport things
  healOnRoomClearPct: 15,    // % of max HP restored when a room is cleared
  spawnDelayMs: 800,         // warning marker time before an enemy appears
  spawnStaggerMs: 120,       // extra delay between each enemy in a room
  spawnMinDistance: 240,     // enemies never appear this close to a player
  // 2 players (keyboard share): more enemies and more gold per enemy, so a
  // co-op run earns a bit more than double the gold (tested: 2.1x-2.3x per room).
  secrets: { gnomeFirsts: 5 },
  coop: {
    budgetMul: 1.6,          // enemy "cost" budget per room
    maxEnemiesMul: 1.5,      // max enemies per room
    coinMul: 1.4,            // coins per enemy / small worm segment
    bossCoinMul: 1.6,        // extra on boss segments + boss reward (1.4 x 1.6 = 2.24x; the boss has the same number of segments)
    reviveHpPct: 35          // a knocked-out player comes back with this % HP when the room is cleared
  },
  levels: {
    gridSize: 5,             // level map fits in 5 x 5 rooms
    roomsBase: 5,            // rooms in level 1 (including start room)
    extraRoomEvery: 2,       // +1 room every 2 levels...
    roomsMax: 8,             // ...up to this many
    baseBudget: 5,           // enemy "cost" budget per room in level 1
    budgetPerLevel: 1.9,
    exitBudgetMul: 1.4,      // the exit room is tougher
    maxEnemiesPerRoom: 12,
    hpPerLevel: 0.22,        // enemies +22% HP per level
    damagePerLevel: 0.15     // enemies +15% damage per level
  },
  bosses: {
    every: 3,                // a boss after every 3rd level (level 3, 6, 9...)
    order: ['bookworm']      // which boss each time (repeats if the list runs out)
  },
  debug: {
    startLevel: 1,           // set to 2+ to test later levels quickly
    startCoins: 0,           // set to e.g. 200 to test the shop
    bossNow: false,          // true = skip straight to the boss fight
    startInShop: false,      // true = the run starts in the shop (as if startLevel - 1 was just cleared)
    // Starting at a later level counts the bosses you "skipped" as beaten, so
    // post-boss items and enemies show up (e.g. startLevel 6 = 1 boss beaten,
    // startLevel 7 = 2). Set false to keep post-boss stuff locked.
    skippedBossesCount: true,
    god: false,              // full HP and mana all the time
    enemyHpPct: 100,         // tuning: enemy HP % (bosses too)
    enemyDmgPct: 100,        // tuning: enemy damage %
    bossArenaPct: 100,       // tuning: boss arena size % (smaller = harder)
    postBossShopOnly: false  // true = shops only offer post-boss items (when any boss is beaten)
  },
  colors: {
    paper: 0xf3ead8,
    gridLine: 0xb9cfe0,
    marginLine: 0xe8a3a3,
    ink: 0x37474f,
    wall: 0x6d5a4a,
    block: 0xb08d6e,
    door: 0x8e3b3b,
    danger: 0xd84315,
    hpBack: 0x5d4037,
    hpPlayer: 0x66bb6a,
    hpEnemy: 0xef5350,
    mana: 0x42a5f5,
    manaLow: 0x5c6f82,       // mana bar color when too low to cast
    dashReady: 0xfdf6e3,
    dashCharging: 0x8d7b6a,
    coin: 0xffc107,
    charged1: 0xffb300,      // bow full charge
    charged2: 0xe53935,      // bow pierce charge
    arcane: 0x9c6ade
  }
};

/* ---------- Textures drawn with shapes (no image files) ---------- */
const TextureFactory = {
  darker(color, amount) {
    return Phaser.Display.Color.ValueToColor(color).darken(amount).color;
  },
  lighter(color, amount) {
    return Phaser.Display.Color.ValueToColor(color).lighten(amount).color;
  },

  withGraphics(scene, key, w, h, drawFn) {
    if (scene.textures.exists(key)) return;
    const g = scene.make.graphics({ x: 0, y: 0, add: false });
    drawFn(g);
    g.generateTexture(key, w, h);
    g.destroy();
  },

  makeSquare(scene, key, size, color, withEye) {
    this.withGraphics(scene, key, size, size, (g) => {
      g.fillStyle(color, 1);
      g.fillRect(0, 0, size, size);
      g.lineStyle(2, this.darker(color, 35), 1);
      g.strokeRect(1, 1, size - 2, size - 2);
      if (withEye) {
        g.fillStyle(0xffffff, 1);
        g.fillRect(size - 9, size / 2 - 3, 6, 6);
      } else {
        const eye = Math.max(3, Math.round(size / 7));
        g.fillStyle(this.darker(color, 45), 1);
        g.fillRect(size * 0.25, size * 0.3, eye, eye);
        g.fillRect(size * 0.75 - eye, size * 0.3, eye, eye);
      }
    });
  },

  makeCircle(scene, key, radius, color, ring) {
    this.withGraphics(scene, key, radius * 2, radius * 2, (g) => {
      g.fillStyle(color, 1);
      g.fillCircle(radius, radius, radius);
      if (ring) {
        g.lineStyle(2, ring, 1);
        g.strokeCircle(radius, radius, radius - 1);
      }
    });
  },

  makeTile(scene, key, size, color, pattern) {
    this.withGraphics(scene, key, size, size, (g) => {
      g.fillStyle(color, 1);
      g.fillRect(0, 0, size, size);
      g.fillStyle(this.lighter(color, 8), 1);
      g.fillRect(0, 0, size, 4);
      g.fillStyle(this.darker(color, 20), 1);
      g.fillRect(0, size - 6, size, 6);
      g.lineStyle(2, this.darker(color, 30), 1);
      g.strokeRect(1, 1, size - 2, size - 2);
      if (pattern === 'stripes') {
        g.lineStyle(4, this.lighter(color, 15), 1);
        for (let x = -size; x < size; x += 16) g.lineBetween(x, size, x + size, 0);
        g.lineStyle(2, this.darker(color, 30), 1);
        g.strokeRect(1, 1, size - 2, size - 2);
      }
    });
  },

  makeArrow(scene, key, color) {
    this.withGraphics(scene, key, 22, 8, (g) => {
      g.fillStyle(color, 1);
      g.fillRect(0, 3, 16, 2);
      g.fillTriangle(14, 0, 22, 4, 14, 8);
      g.fillRect(0, 1, 4, 6);
    });
  },

  // The Bookworm: kraft-paper segments with ink stripes. k = scale (Small Worm uses a smaller set).
  makeWorm(scene, prefix, k) {
    prefix = prefix || 'worm'; k = k || 1;
    const ink = 0x3e2723;
    const q = (v) => v * k;
    this.withGraphics(scene, prefix + '_head', Math.ceil(q(44)), Math.ceil(q(40)), (g) => {
      g.fillStyle(ink, 1);                                   // mandibles (pointing right)
      g.fillTriangle(q(26), q(4), q(44), q(10), q(30), q(16)); g.fillTriangle(q(26), q(36), q(44), q(30), q(30), q(24));
      g.fillStyle(0x8d6e63, 1); g.fillCircle(q(20), q(20), q(18));
      g.lineStyle(Math.max(1.5, q(3)), ink, 1); g.strokeCircle(q(20), q(20), q(17));
      g.fillStyle(0xd7ccc8, 1); g.fillCircle(q(24), q(20), q(9));     // paper mouth plate
      g.fillStyle(ink, 1); g.fillCircle(q(29), q(20), q(4));
      g.fillStyle(0xe53935, 1); g.fillCircle(q(16), q(11), q(3)); g.fillCircle(q(16), q(29), q(3));   // eyes
    });
    const body = (key, fill) => this.withGraphics(scene, key, Math.ceil(q(30)), Math.ceil(q(30)), (g) => {
      g.fillStyle(fill, 1); g.fillCircle(q(15), q(15), q(14));
      g.lineStyle(Math.max(1.5, q(2)), ink, 1); g.strokeCircle(q(15), q(15), q(13));
      g.lineStyle(Math.max(1, q(2)), ink, 0.7); g.lineBetween(q(15), q(3), q(15), q(27));
      g.lineStyle(1, 0xffffff, 0.35); g.lineBetween(q(9), q(6), q(9), q(24));
      g.fillStyle(ink, 1); g.fillTriangle(q(13), 0, q(17), 0, q(15), q(2));
      g.fillTriangle(q(13), q(30), q(17), q(30), q(15), q(26));
    });
    body(prefix + '_body', 0xa1887f);
    body(prefix + '_body2', 0x8d6e63);
    this.withGraphics(scene, prefix + '_tail', Math.ceil(q(26)), Math.ceil(q(22)), (g) => {
      g.fillStyle(0xa1887f, 1); g.fillEllipse(q(14), q(11), q(24), q(18));
      g.fillStyle(0x8d6e63, 1); g.fillTriangle(0, q(11), q(8), q(4), q(8), q(18));
      g.lineStyle(Math.max(1.5, q(2)), ink, 1); g.strokeEllipse(q(14), q(11), q(22), q(16));
    });
    if (prefix !== 'worm') return;
    this.withGraphics(scene, 'spit', 16, 16, (g) => {
      g.fillStyle(0x4a148c, 0.35); g.fillCircle(8, 8, 8);
      g.fillStyle(0x6a1b9a, 1); g.fillCircle(8, 8, 5.5);
      g.fillStyle(0xce93d8, 1); g.fillCircle(6, 6, 2);
    });
  },

  // Pyre casters: hooded robe, glowing eyes, a flame on the chest
  // Gnome: tall red hat, white beard, tiny angry eyes (texture bigger than its 16 px body)
  makeGnome(scene, key) {
    this.withGraphics(scene, key, 26, 30, (g) => {
      g.fillStyle(0x1565c0, 1); g.fillRoundedRect(7, 19, 12, 10, 3);                 // blue coat
      g.fillStyle(0xffcc80, 1); g.fillCircle(13, 15, 6);                             // face
      g.fillStyle(0xfafafa, 1); g.fillTriangle(6, 15, 20, 15, 13, 27);              // beard
      g.fillStyle(0xc62828, 1); g.fillTriangle(5, 12, 21, 12, 15, 0);               // hat
      g.fillStyle(0x8e0000, 1); g.fillRect(5, 11, 16, 3);
      g.fillStyle(0x212121, 1); g.fillRect(10, 14, 2, 2); g.fillRect(15, 14, 2, 2);  // eyes
      g.lineStyle(1, 0x212121, 1); g.lineBetween(9, 13, 12, 14); g.lineBetween(18, 13, 15, 14);   // angry brows
      g.fillStyle(0x6d4c41, 1); g.fillCircle(21, 22, 2.5);                          // little knife hilt
      g.fillStyle(0xbdbdbd, 1); g.fillTriangle(22, 21, 26, 18, 23, 23);
    });
  },

  makeCaster(scene, key, size, color, elite) {
    this.withGraphics(scene, key, size, size, (g) => {
      const S = size, dark = this.darker(color, 45);
      g.fillStyle(color, 1); g.fillRoundedRect(S * 0.08, S * 0.3, S * 0.84, S * 0.7, 3);   // robe
      g.fillStyle(dark, 1); g.fillTriangle(S * 0.5, 0, S * 0.12, S * 0.55, S * 0.88, S * 0.55);   // hood
      g.fillStyle(0x1a0a05, 1); g.fillEllipse(S * 0.5, S * 0.42, S * 0.46, S * 0.24);              // face shadow
      g.fillStyle(0xffd54f, 1); g.fillRect(S * 0.36, S * 0.39, S * 0.09, S * 0.06); g.fillRect(S * 0.55, S * 0.39, S * 0.09, S * 0.06);
      g.fillStyle(0xff9100, 1); g.fillTriangle(S * 0.5, S * 0.58, S * 0.4, S * 0.86, S * 0.6, S * 0.86); // flame
      g.fillStyle(0xffecb3, 1); g.fillTriangle(S * 0.5, S * 0.7, S * 0.45, S * 0.86, S * 0.55, S * 0.86);
      g.lineStyle(elite ? 2.5 : 1.5, elite ? 0xffc107 : dark, 1); g.strokeRoundedRect(S * 0.08 + 1, S * 0.3, S * 0.84 - 2, S * 0.7 - 1, 3);
    });
  },

  // Inkblobs: a rounded square of ink with drips
  makeBlob(scene, key, size, color) {
    this.withGraphics(scene, key, size + 4, size + 6, (g) => {
      const r = size / 2, c = size / 2 + 2;
      g.fillStyle(color, 1); g.fillRoundedRect(2, 2, size, size, Math.max(3, size * 0.28));
      g.fillCircle(c - r * 0.55, c + r, r * 0.22); g.fillCircle(c + r * 0.45, c + r * 1.02, r * 0.18);
      g.fillStyle(0xffffff, 0.25); g.fillCircle(c - r * 0.35, c - r * 0.35, r * 0.25);
      g.fillStyle(0xffffff, 1); g.fillCircle(c - r * 0.3, c - r * 0.1, Math.max(1.5, r * 0.14)); g.fillCircle(c + r * 0.3, c - r * 0.1, Math.max(1.5, r * 0.14));
    });
  },

  // Projectiles and allies for the Precision class
  makePrecision(scene) {
    this.withGraphics(scene, 'bolt', 20, 8, (g) => {
      g.fillStyle(0x4e342e, 1); g.fillRect(0, 3, 15, 2);
      g.fillStyle(0x90a4ae, 1); g.fillTriangle(13, 0, 20, 4, 13, 8);
    });
    this.withGraphics(scene, 'slug', 14, 6, (g) => {
      g.fillStyle(0xffd54f, 0.5); g.fillRect(0, 1, 8, 4);
      g.fillStyle(0x6d4c41, 1); g.fillEllipse(10, 3, 8, 5);
    });
    this.withGraphics(scene, 'manaarrow', 26, 12, (g) => {
      g.fillStyle(0x9575cd, 0.35); g.fillEllipse(13, 6, 26, 12);
      g.fillStyle(0x5e35b1, 1); g.fillRect(2, 5, 16, 2); g.fillTriangle(16, 1, 26, 6, 16, 11);
    });
    this.withGraphics(scene, 'axe', 22, 22, (g) => {
      g.fillStyle(0x8d6e63, 1); g.fillRect(9, 2, 4, 20);
      g.fillStyle(0x90a4ae, 1); g.fillTriangle(12, 1, 22, 4, 12, 11);
      g.lineStyle(1, 0x455a64, 1); g.strokeTriangle(12, 1, 22, 4, 12, 11);
    });
    this.withGraphics(scene, 'hog', 30, 24, (g) => {
      g.fillStyle(0x8d6e63, 1); g.fillEllipse(14, 12, 26, 20);
      g.fillStyle(0xd7a28b, 1); g.fillEllipse(26, 12, 8, 9);
      g.fillStyle(0x3e2723, 1); g.fillCircle(25, 10, 1.3); g.fillCircle(25, 14, 1.3); g.fillCircle(20, 7, 1.6);
      g.fillStyle(0xfff8e1, 1); g.fillTriangle(24, 16, 28, 19, 23, 18);
      g.lineStyle(2, 0x5d4037, 1); g.strokeEllipse(14, 12, 25, 19);
    });
    this.withGraphics(scene, 'decoy', 30, 30, (g) => {
      g.fillStyle(0xfdf6e3, 1); g.fillCircle(15, 15, 14);
      g.fillStyle(0xc62828, 1); g.fillCircle(15, 15, 10);
      g.fillStyle(0xfdf6e3, 1); g.fillCircle(15, 15, 6);
      g.fillStyle(0xc62828, 1); g.fillCircle(15, 15, 2.5);
      g.lineStyle(2, 0x5d4037, 1); g.strokeCircle(15, 15, 14);
    });
  },

  makeHatch(scene, key, size) {
    this.withGraphics(scene, key, size, size, (g) => {
      g.fillStyle(0x3e2f25, 1);
      g.fillRect(0, 0, size, size);
      g.lineStyle(3, 0xd7ccb7, 1);
      g.strokeRect(2, 2, size - 4, size - 4);
      for (let y = 12; y < size - 6; y += 10) g.lineBetween(10, y, size - 10, y);
    });
  }
};

/* ---------- Boot: create all textures once ---------- */
class BootScene extends Phaser.Scene {
  constructor() { super('BootScene'); }

  create() {
    const c = GAME_CONFIG.colors, T = GAME_CONFIG.tile;
    TextureFactory.makeSquare(this, 'player_0', PLAYER_BASE_STATS.size, PLAYER_BASE_STATS.color, true);
    TextureFactory.makeSquare(this, 'player_1', PLAYER_BASE_STATS.size, 0xef8f2f, true);   // player 2 (orange)
    TextureFactory.makeCircle(this, 'bullet', 5, c.ink, 0);
    TextureFactory.makeCircle(this, 'ebullet', 7, 0xff8a65, c.danger);
    TextureFactory.makeArrow(this, 'arrow', c.ink);
    TextureFactory.makeCircle(this, 'magic', 6, 0xd1b3ff, c.arcane);
    TextureFactory.makeCircle(this, 'reflect', 7, 0xfff3c4, c.charged1);
    TextureFactory.makeCircle(this, 'fireball', 10, 0xff7043, 0xbf360c);
    TextureFactory.withGraphics(this, 'firebolt', 16, 16, (g) => {        // Pyre Warlock arcs
      g.fillStyle(0xff3d00, 0.35); g.fillCircle(8, 8, 8);
      g.fillStyle(0xff9100, 1); g.fillCircle(8, 8, 5.5);
      g.fillStyle(0xffecb3, 1); g.fillCircle(8, 8, 2.5);
    });
    TextureFactory.makeWorm(this);
    TextureFactory.makeWorm(this, 'sworm', 0.62);
    TextureFactory.withGraphics(this, 'wormling_head', 18, 16, (g) => {
      g.fillStyle(0x4a148c, 1); g.fillTriangle(11, 1, 18, 4, 12, 7); g.fillTriangle(11, 15, 18, 12, 12, 9);
      g.fillStyle(0xb39ddb, 1); g.fillCircle(8, 8, 7);
      g.lineStyle(2, 0x4a148c, 1); g.strokeCircle(8, 8, 6);
      g.fillStyle(0x4a148c, 1); g.fillCircle(7, 5, 1.5); g.fillCircle(7, 11, 1.5);
    });
    TextureFactory.withGraphics(this, 'wormling_body', 12, 12, (g) => {
      g.fillStyle(0x9575cd, 1); g.fillCircle(6, 6, 5.5);
      g.lineStyle(1.5, 0x4a148c, 1); g.strokeCircle(6, 6, 5);
    });
    TextureFactory.withGraphics(this, 'spark', 10, 10, (g) => {          // wand
      g.fillStyle(0xe1bee7, 1); g.fillTriangle(5, 0, 10, 5, 5, 10); g.fillTriangle(5, 0, 0, 5, 5, 10);
      g.fillStyle(0xffffff, 1); g.fillCircle(5, 5, 1.5);
    });
    TextureFactory.withGraphics(this, 'spectral', 34, 12, (g) => {       // enchanted sword
      g.fillStyle(0x80d8ff, 0.85); g.fillRect(6, 4, 20, 4); g.fillTriangle(26, 1, 34, 6, 26, 11);
      g.fillStyle(0x283593, 0.9); g.fillRect(4, 1, 3, 10); g.fillRect(0, 5, 5, 2);
      g.fillStyle(0xffffff, 0.8); g.fillRect(8, 5, 18, 1);
    });
    TextureFactory.withGraphics(this, 'sunwave', 30, 22, (g) => {        // Sunsteel Greatsword heavy waves
      g.fillStyle(0xffca28, 0.35); g.fillEllipse(14, 11, 26, 22);
      g.lineStyle(4, 0xffb300, 1); g.beginPath(); g.arc(6, 11, 18, -1.1, 1.1); g.strokePath();
      g.lineStyle(2, 0xfffde7, 1); g.beginPath(); g.arc(6, 11, 18, -0.8, 0.8); g.strokePath();
    });
    TextureFactory.withGraphics(this, 'boomerang', 24, 24, (g) => {
      g.lineStyle(5, 0xa1887f, 1); g.lineBetween(3, 4, 12, 13); g.lineBetween(12, 13, 21, 4);
      g.lineStyle(1, 0x4e342e, 1); g.lineBetween(4, 5, 12, 13); g.lineBetween(12, 13, 20, 5);
    });
    TextureFactory.withGraphics(this, 'aurafist', 20, 20, (g) => {       // 1st aura scroll
      g.fillStyle(0xffd54f, 0.35); g.fillCircle(10, 10, 10);
      g.fillStyle(0xffee58, 0.9); g.fillCircle(11, 10, 6);
      g.fillStyle(0xffffff, 1); g.fillCircle(12, 10, 2.5);
    });
    TextureFactory.withGraphics(this, 'auraorb', 18, 18, (g) => {        // 2nd aura scroll
      g.fillStyle(0xffa000, 0.35); g.fillCircle(9, 9, 9);
      g.fillStyle(0xffca28, 1); g.fillCircle(9, 9, 6);
      g.fillStyle(0xfff8e1, 1); g.fillCircle(8, 8, 2.5);
    });
    TextureFactory.makeCircle(this, 'bomb', 9, 0x37474f, 0x212121);
    TextureFactory.withGraphics(this, 'coin', 10, 10, (g) => {
      g.fillStyle(c.coin, 1); g.fillRect(0, 0, 10, 10);
      g.lineStyle(2, 0x8d6e00, 1); g.strokeRect(1, 1, 8, 8);
    });
    TextureFactory.makeTile(this, 'wall', T, c.wall, null);
    TextureFactory.makeTile(this, 'block', T, c.block, null);
    TextureFactory.makeTile(this, 'door', T, c.door, 'stripes');
    TextureFactory.makeHatch(this, 'hatch', 52);
    FoeTextures.makeProps(this);
    ArcaneTextures.make(this);
    Arcane3bTextures.make(this);                   // merchant, chests, shrine
    for (const id in ENEMY_TYPES) {
      const def = ENEMY_TYPES[id];
      if (!def.size) continue;                     // pairs / worms have no texture of their own
      if (FoeTextures.make(this, id, def)) continue;          // Phase 1 enemies / bosses (foes2.js)
      if (def.ai === 'hop' || id === 'inkdrop') TextureFactory.makeBlob(this, 'enemy_' + id, def.size, def.color);
      else if (def.ai === 'warlock' || def.ai === 'fireWarlock') TextureFactory.makeCaster(this, 'enemy_' + id, def.size, def.color, !!def.elite);
      else if (def.ai === 'gnome') TextureFactory.makeGnome(this, 'enemy_' + id);
      else TextureFactory.makeSquare(this, 'enemy_' + id, def.size, def.color, false);
    }
    TextureFactory.makePrecision(this);
    this.scene.start('MainMenuScene');
  }
}

/* (Main menu, Pencil Case and the start select are in menus.js; the Bestiary in bestiary.js) */

/* ---------- Game: the actual gameplay ---------- */
class GameScene extends Phaser.Scene {
  constructor() { super('GameScene'); }

  // data.weapons = one weapon id per player, from the weapon select screen
  init(data) {
    this.startWeapons = (data && data.weapons) || ['bow'];
    this.testMode = !!(data && data.test);
    this.startArmors = (data && data.armors) || [];   // starter kits come with an armor
    this.startSkills = (data && data.skills) || [];   // ...and some with a skill
    this.playerCount = (data && data.players === 2) ? 2 : 1;   // only an explicit 2 makes a co-op run
    this.controlTypes = Controls.fix(data && data.controls, this.playerCount);
  }

  create() {
    const cfg = GAME_CONFIG;
    const W = cfg.width, H = cfg.height;
    this.physics.world.setBounds(0, 0, W, H);
    this.input.mouse.disableContextMenu();
    this.input.setDefaultCursor('crosshair');
    this.floorGfx = this.add.graphics().setDepth(0);
    this.drawFloor(W, H);

    // State (reset every time the scene starts, so restart is clean)
    this.elapsedMs = 0;
    this.gameOver = false;
    this.level = 0;
    this.map = null;
    this.room = null;
    this.transitionLockMs = 0;
    this._pt = { x: 0, y: 0 };
    this.mode = 'play';      // 'play' | 'inventory' | 'shop' | 'buffs'
    this.menu = null;        // the open menu screen
    this.shop = null;
    this.team = new Team();  // shared coins + shared inventory
    Meta.off = this.testMode;                     // Pencil Case upgrades + shavings don't apply in the Test Dungeon
    this.runShavings = 0;
    this.team.coins = cfg.debug.startCoins + Meta.startCoins();

    // Systems
    this.rooms = new RoomManager(this, cfg);
    this.playerBullets = new ProjectileManager(this, cfg.maxProjectiles, W, H, 'bullet');
    this.enemyBullets = new ProjectileManager(this, cfg.maxEnemyProjectiles, W, H, 'ebullet');
    this.enemies = new EnemyManager(this, cfg.maxEnemies);
    this.coins = new CoinManager(this, cfg.maxCoins, cfg);
    this.boss = new BossManager(this, cfg);
    this.minorWorms = new BossManager(this, cfg);   // Small Worms in normal rooms
    this.allies = new AllyManager(this, 16);
    this.hazards = new HazardManager(this);
    this.chains = new ChainManager(this);
    this.chains.rooms = this.rooms;
    this.throws = new ThrowManager(this, 4);
    this.throws.rooms = this.rooms;
    this.bossesBeaten = 0;

    // Players: each with the control type chosen on the start screen
    this.players = [];
    for (let i = 0; i < this.playerCount; i++) {
      const ctl = Controls.make(this, this.controlTypes[i]);
      if (ctl.layout) ctl.findTarget = (c, x, y) => this.autoAimTarget(c, x, y);    // keyboard-only = auto-aim
      this.players.push(new Player(this, i, W / 2 + i * 40, H / 2, ctl, this.startWeapons[i] || 'bow'));
    }
    for (let i = 0; i < this.players.length; i++) {
      if (this.startArmors[i]) { this.players[i].armor = this.startArmors[i]; this.players[i].recalcStats(); this.players[i].hp = this.players[i].stats.maxHp; }
      if (this.startSkills[i]) this.players[i].skills[0] = this.startSkills[i];
    }
    for (let i = 0; i < this.players.length; i++) {
      const p = this.players[i];
      p.metaMods = Meta.playerMods();             // Pencil Case: Thick Paper
      p.recalcStats(); p.hp = p.stats.maxHp;
      p.erasers = Meta.rank('eraser');            // Pencil Case: Eraser (one lethal hit survived)
      Loadout.giveConsumable(this.team, p, 'healthPotion', Meta.startPotions());
    }
    this.playerSprites = [];
    for (let i = 0; i < this.players.length; i++) this.playerSprites.push(this.players[i].sprite);

    // Collisions (groups vs groups, Phaser handles this efficiently)
    const walls = [this.rooms.blocks, this.rooms.doorBlocks];
    this.physics.add.collider(this.playerSprites, walls);
    this.physics.add.collider(this.enemies.group, walls);
    this.physics.add.collider(this.enemies.group, this.enemies.group);
    this.physics.add.overlap(this.playerBullets.group, walls, this.onBulletHitsWall, null, this);
    this.physics.add.overlap(this.enemyBullets.group, walls, this.onBulletHitsWall, null, this);
    this.physics.add.overlap(this.playerBullets.group, this.enemies.group, this.onBulletHitsEnemy, null, this);
    this.physics.add.overlap(this.enemyBullets.group, this.playerSprites, this.onEnemyBulletHitsPlayer, null, this);
    this.physics.add.overlap(this.playerSprites, this.enemies.group, this.onEnemyTouchesPlayer, null, this);
    this.physics.add.overlap(this.playerBullets.group, this.boss.group, this.onBulletHitsEnemy, null, this);
    this.physics.add.overlap(this.playerSprites, this.boss.group, this.onBossTouchesPlayer, null, this);
    this.physics.add.overlap(this.playerBullets.group, this.minorWorms.group, this.onBulletHitsEnemy, null, this);
    this.physics.add.overlap(this.playerSprites, this.minorWorms.group, this.onBossTouchesPlayer, null, this);

    // Everything enemy AI is allowed to know about
    this.aiContext = { players: this.players, rooms: this.rooms, enemyBullets: this.enemyBullets, hazards: this.hazards };
    // Everything a player's weapons / skills / items are allowed to use
    this.combatContext = {
      scene: this,
      playerBullets: this.playerBullets,
      enemyBullets: this.enemyBullets,
      enemies: this.enemies,
      hitEnemy: (e, dmg, dx, dy, kb, kbMs, owner, source) => this.hitEnemy(e, dmg, dx, dy, kb, kbMs, owner, source),
      slowEnemy: (e, ms, pct) => this.enemies.slow(e, ms, pct),
      wallStun: (e, ms, stunMs) => this.enemies.wallStun(e, ms, stunMs),
      rooms: this.rooms,
      allies: this.allies,
      throws: this.throws,
      useConsumable: (p) => this.useConsumable(p),
      stunEnemy: (e, ms) => this.enemies.stun(e, ms),
      knockEnemy: (e, dx, dy, speed, ms) => { if (e.def.hitKnockbackMs > 0) this.enemies.push(e, dx, dy, speed, ms); },
      fx: (x, y, r, color, ms) => this.hud.addFx(x, y, r, color, ms),
      shake: (ms, k) => this.cameras.main.shake(ms, k),
      hole: (x, y) => this.boss.addHole(x, y),
      mineAt: (p, ax, ay, range) => this.mineAt(p, ax, ay, range)
    };
    this.enemies.onParry = (p, e) => this.onParry(p, e);
    this.enemies.onPlayerHit = (p, res, e) => this.onPlayerHit(p, res, e);
    this.enemies.extraTargets = (arr) => { this.boss.pushTargets(arr); this.minorWorms.pushTargets(arr); };
    this.enemies.onSpecialSpawn = (def, x, y) => this.specialSpawn(def, x, y);
    this.enemies.onDot = (e, dmg, owner) => this.hitEnemy(e, dmg, 0, 0, 0, 0, owner, 'dot');
    this.enemies.onSplit = (x, y) => this.hud.addFx(x, y, 26, 0x263238, 220);
    this.hazards.players = this.players;
    this.hazards.ctx = this.combatContext;
    this.hazards.onPlayerHit = (p, res, e) => this.onPlayerHit(p, res, e);
    this.chains.onPlayerHit = (p, res, e) => this.onPlayerHit(p, res, e);
    this.chains.onParry = (p, e) => this.onParry(p, e);
    this.enemies.allies = this.allies.alive;
    this.playerBullets.homingTargets = { getChildren: () => this.enemies.targets() };
    this.playerBullets.onExplode = (b) => {
      if (b.ignite || b.chill || b.stunHit || b.hex || b.poison) GearFx.burst(this, b.owner, b.x, b.y, b.aoeRadius, { damage: 0, ignite: b.ignite, chill: b.chill, stunMs: b.stunHit, hex: b.hex, poison: b.poison, color: null });
      this.explode(b.x, b.y, b.aoeRadius, b.damage, b.owner);
    };

    this.hud = new Hud(this, cfg);
    this.hud.world = { minor: this.minorWorms, hazards: this.hazards, chains: this.chains };
    this.setupSpecials();
    this.zones = new ZoneManager(this);          // lasting spell areas (Hurricane, Fire Pillar, storms...)
    // Save data: bestiary pages + kit unlocks (not in the Test Dungeon)
    this._newKits = [];
    this.kitCheckMs = 500;
    this.enemies.onSpawned = (e) => this.discover(bestiaryIdFor(e.typeId), e.x, e.y);
    if (!this.testMode) SaveData.runStarted();
    // F8: performance overlay (FPS, frame time, objects) for checking slow lab PCs
    this.perfText = this.add.text(GAME_CONFIG.width - 10, 8, '', { fontFamily: 'monospace', fontSize: '13px', color: '#fdf6e3', backgroundColor: '#3e2f25' })
      .setOrigin(1, 0).setDepth(200).setVisible(false).setScrollFactor(0);
    this.perfMs = 0; this.perfWorst = 0;
    this.input.keyboard.on('keydown-F8', () => this.perfText.setVisible(!this.perfText.visible));

    this.events.once('shutdown', this.cleanup, this);
    const dbg = cfg.debug;
    if (this.testMode) { this.startTestDungeon(); return; }
    this.startRun(dbg.startLevel, dbg);
  }

  /* ----- The run: stages -> steps (level, arena, level, boss) ----- */
  // startLevel (debug) = which level to begin at: stages have 2 levels each, so
  // level 3 = stage 2's first level (the stage 1 boss counts as beaten when
  // debug.skippedBossesCount is on).
  startRun(startLevel, dbg) {
    const levelsPerStage = RUN_PLAN.steps.filter((s) => s === 'level').length;
    const n = Math.max(1, startLevel || 1);
    const stageIdx = Math.min(RUN_PLAN.stages.length - 1, Math.floor((n - 1) / levelsPerStage));
    const within = (n - 1) - stageIdx * levelsPerStage;          // 0 = first level of the stage
    let step = 0, seen = -1;
    for (let i = 0; i < RUN_PLAN.steps.length; i++) if (RUN_PLAN.steps[i] === 'level' && ++seen === within) { step = i; break; }
    this.run = { stageNum: stageIdx + 1, stageId: RUN_PLAN.stages[stageIdx][0], step: step, levelNum: n - 1, path: [], reserved: [] };
    if (dbg && dbg.skippedBossesCount) this.bossesBeaten = stageIdx;
    if (dbg && dbg.bossesBeaten) this.bossesBeaten = dbg.bossesBeaten;   // debug: see later shop tiers
    this.enemies.bossesBeaten = this.bossesBeaten;
    this.applyStage();
    if (dbg && dbg.bossNow) { this.run.step = RUN_PLAN.steps.indexOf('boss'); this.level = Math.max(1, this.run.levelNum); }
    if (dbg && dbg.startInShop && !dbg.bossNow) {
      this.level = Math.max(1, n - 1);
      this.run.levelNum = n - 1;
      this.openShop({ subtitle: 'DEBUG: start in shop', after: () => this.runStep() });
      return;
    }
    if (Meta.rank('supplyRun') && n === 1 && !(dbg && dbg.bossNow)) {   // Pencil Case: Supply Run
      this.level = 1;
      this.openShop({ subtitle: 'Supply Run · stock up before you go', after: () => this.runStep() });
      return;
    }
    this.runStep();
  }

  stage() { return STAGE_TYPES[this.run ? this.run.stageId : 'notebook']; }

  // Look + enemy pool of the current stage.
  applyStage() {
    const st = this.stage();
    this.enemies.pool = st.enemies;
    this.rooms.look = st.look;
    this.cameras.main.setBackgroundColor(st.look.bg);
  }

  // Starts whatever the current step of the stage is.
  runStep() {
    const step = RUN_PLAN.steps[this.run.step];
    this.planMerchant();
    if (step === 'level') { this.run.levelNum++; this.startLevel(this.run.levelNum); }
    else if (step === 'arena') this.startArena();
    else if (step === 'boss') this.startBoss(this.stage().boss);
  }

  advanceRun() {
    this.merchantStepEnd();
    this.run.step++;
    if (this.run.step < RUN_PLAN.steps.length) { this.runStep(); return; }
    // stage finished
    if (this.run.stageNum >= RUN_PLAN.stages.length) { this.winRun(); return; }
    const options = RUN_PLAN.stages[this.run.stageNum];
    const go = (id) => {
      this.run.path.push(this.run.stageId);
      this.run.stageNum++; this.run.stageId = id; this.run.step = 0;
      this.applyStage();
      this.menu = null; this.setMode('play');
      this.runStep();
    };
    if (options.length === 1) { go(options[0]); return; }
    this.menu = new PathMenu(this, this.players, options, go);
    this.setMode('path');
  }

  // Pencil Case currency: saved at once (see meta.js).
  earnShavings(n, x, y) {
    const got = Meta.earn(n);
    if (!got) return;
    this.runShavings += got;
    const p = this.players.find((q) => q.alive) || this.players[0];
    this.hud.floatText(x !== undefined ? x : p.sprite.x, (y !== undefined ? y : p.sprite.y) - 50, '+' + got + ' shavings', '#6d4c41');
  }

  winRun() {
    if (this.gameOver) return;
    this.gameOver = true;
    SaveData.data.stats.wins = (SaveData.data.stats.wins || 0) + 1;
    this.earnShavings(SHAVINGS_EARN.win);
    SaveData.save();
    let kills = 0;
    for (let i = 0; i < this.players.length; i++) kills += this.players[i].kills;
    this.time.delayedCall(300, () => this.scene.start('GameOverScene', {
      victory: true, seconds: Math.floor(this.elapsedMs / 1000), kills: kills, coins: this.team.coins,
      level: this.level, players: this.players.length, path: this.run.path.concat([this.run.stageId]),
      shavings: this.runShavings, testMode: this.testMode }));
  }

  // Floor of the current stage (notebook paper, sewer tiles, castle stones).
  drawFloor(W, H) {
    const c = GAME_CONFIG.colors;
    const g = this.floorGfx;
    g.clear();
    const look = (this.rooms && this.rooms.look) || STAGE_TYPES.notebook.look;
    g.fillStyle(look.bg, 1); g.fillRect(0, 0, W, H);
    if (look.style === 'sewer') {
      g.lineStyle(1, look.line, 0.7);
      for (let y = 0; y < H; y += 32) g.lineBetween(0, y, W, y);
      for (let y = 0, row = 0; y < H; y += 32, row++) for (let x = (row % 2) * 32; x < W; x += 64) g.lineBetween(x, y, x, y + 32);
      // a dark channel of ink running through the middle
      g.fillStyle(look.accent, 0.12); g.fillRect(0, H / 2 - 40, W, 80);
      g.lineStyle(2, look.accent, 0.25); g.lineBetween(0, H / 2 - 40, W, H / 2 - 40); g.lineBetween(0, H / 2 + 40, W, H / 2 + 40);
      const rnd = this.floorRandom(W, H);
      for (let k = 0; k < Math.floor(W * H / 90000); k++) {
        g.fillStyle(0x263238, 0.12 + rnd() * 0.1);
        g.fillEllipse(rnd() * W, rnd() * H, 30 + rnd() * 50, 16 + rnd() * 24);
      }
    } else if (look.style === 'castle') {
      g.lineStyle(1, look.line, 0.8);
      for (let y = 0, row = 0; y < H; y += 48, row++) {
        g.lineBetween(0, y, W, y);
        for (let x = (row % 2) * 40; x < W; x += 80) g.lineBetween(x, y, x, y + 48);
      }
      g.fillStyle(look.accent, 0.18); g.fillRect(W / 2 - 60, 0, 120, H);      // red carpet
      g.lineStyle(3, 0xc9a227, 0.35); g.lineBetween(W / 2 - 60, 0, W / 2 - 60, H); g.lineBetween(W / 2 + 60, 0, W / 2 + 60, H);
    } else {
      g.lineStyle(1, c.gridLine, 0.6);
      for (let y = 40; y < H; y += 32) g.lineBetween(0, y, W, y);
      g.lineStyle(2, c.marginLine, 0.7);
      g.lineBetween(112, 0, 112, H);
    }
  }

  // Same "random" decorations every time a room is drawn (seeded by room position).
  floorRandom(W, H) {
    const r = this.room || { gx: 0, gy: 0 };
    let seed = (r.gx * 73856093) ^ (r.gy * 19349663) ^ (W * 83492791) ^ (this.level * 2654435761);
    return () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  }

  /* ----- Room size + camera ----- */
  // After a room is built: world bounds, floor, coin area and camera limits
  // follow the room's size (big arenas are bigger than the screen).
  applyRoomSize() {
    const W = this.rooms.W, H = this.rooms.H, T = this.rooms.T;
    this.physics.world.setBounds(0, 0, W, H);
    this.drawFloor(W, H);
    this.coins.setArea(T, T, W - T, H - T);
    this.playerBullets.setArea(W, H); this.enemyBullets.setArea(W, H);   // shots live in the whole room, not just the screen
    this.cameras.main.setBounds(0, 0, W, H);
    this.camSnap = true;
  }

  // The camera looks at the middle of the living players. In a room that is
  // bigger than the screen it scrolls smoothly; co-op players can't walk out
  // of the picture (they are held at the screen edge).
  updateCamera(dt) {
    const cam = this.cameras.main, W = this.rooms.W, H = this.rooms.H;
    const vw = GAME_CONFIG.width, vh = GAME_CONFIG.height;
    if (W <= vw && H <= vh) { cam.setScroll(0, 0); return; }
    let x = 0, y = 0, n = 0;
    for (let i = 0; i < this.players.length; i++) {
      const p = this.players[i];
      if (!p.alive) continue;
      x += p.sprite.x; y += p.sprite.y; n++;
    }
    if (!n) return;
    x /= n; y /= n;
    const tx = Phaser.Math.Clamp(x - vw / 2, 0, W - vw), ty = Phaser.Math.Clamp(y - vh / 2, 0, H - vh);
    const k = this.camSnap ? 1 : Math.min(1, dt / 90);
    this.camSnap = false;
    cam.setScroll(cam.scrollX + (tx - cam.scrollX) * k, cam.scrollY + (ty - cam.scrollY) * k);
    if (n > 1) {
      const m = 28;
      for (let i = 0; i < this.players.length; i++) {
        const p = this.players[i];
        if (!p.alive) continue;
        const cx = Phaser.Math.Clamp(p.sprite.x, cam.scrollX + m, cam.scrollX + vw - m);
        const cy = Phaser.Math.Clamp(p.sprite.y, cam.scrollY + m, cam.scrollY + vh - m);
        if (cx !== p.sprite.x || cy !== p.sprite.y) p.sprite.setPosition(cx, cy);
      }
    }
  }

  /* ----- Co-op ----- */
  // Coin multiplier: coin-bonus gear (Prince Armor...) + the co-op bonus.
  coinMul() {
    let mul = 1;
    for (let i = 0; i < this.players.length; i++) mul += this.players[i].stats.coinMul;
    if (this.players.length > 1) mul *= GAME_CONFIG.coop.coinMul;
    return mul;
  }

  bossCoinMul() { return this.players.length > 1 ? GAME_CONFIG.coop.bossCoinMul : 1; }

  // Player 2 auto-aim: keep the current target while it is alive, in range and
  // visible; otherwise pick the nearest visible enemy (re-checked 6x per second).
  autoAimTarget(ctl, x, y) {
    const range = ctl.layout.autoAimRange, r2 = range * range;
    let t = ctl.target;
    const ok = (e) => e && e.active && (!e.isBossPart || e.surfaced) && ((e.x - x) * (e.x - x) + (e.y - y) * (e.y - y)) <= r2;
    ctl.aimCheckMs = (ctl.aimCheckMs || 0) - this.game.loop.delta;
    if (ok(t) && ctl.aimCheckMs > 0) return t;
    ctl.aimCheckMs = 160;
    const list = this.enemies.targets();
    let best = null, bd = r2;
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      if (!ok(e)) continue;
      const d = (e.x - x) * (e.x - x) + (e.y - y) * (e.y - y);
      if (d >= bd) continue;
      if (!this.rooms.hasLineOfSight(x, y, e.x, e.y)) continue;
      bd = d; best = e;
    }
    // stick to the old target unless the new one is clearly closer
    if (ok(t) && best && best !== t) {
      const dt2 = (t.x - x) * (t.x - x) + (t.y - y) * (t.y - y);
      if (bd > dt2 * 0.5) best = t;
    }
    return best;
  }

  // Knocked-out players come back next to a living teammate.
  reviveDowned() {
    let host = null;
    for (let i = 0; i < this.players.length; i++) if (this.players[i].alive) { host = this.players[i]; break; }
    if (!host) return;
    for (let i = 0; i < this.players.length; i++) {
      const p = this.players[i];
      if (p.alive) continue;
      p.revive(host.sprite.x + 30, host.sprite.y, GAME_CONFIG.coop.reviveHpPct);
      this.hud.floatText(p.sprite.x, p.sprite.y - 30, 'P' + (i + 1) + ' is back!', '#2e7d32');
    }
  }

  /* ----- Mining (pickaxe, minecart) ----- */
  // Breaks the first obstacle block found in front of the player (one per call).
  mineAt(p, ax, ay, range) {
    const x0 = p.sprite.x, y0 = p.sprite.y;
    const dists = [34, 56, range];
    const angs = [0, 0.4, -0.4];
    const base = Math.atan2(ay, ax);
    for (let i = 0; i < dists.length; i++) {
      for (let k = 0; k < angs.length; k++) {
        const x = x0 + Math.cos(base + angs[k]) * dists[i], y = y0 + Math.sin(base + angs[k]) * dists[i];
        const c = this.rooms.breakBlockAt(x, y);
        if (!c) continue;
        const coins = Math.max(1, Math.round((p.stats.mineCoins > 1 ? 2 : 1) * this.coinMul()));   // 1 coin, 2 with the helmet
        this.coins.drop(c.x, c.y, coins, this.team);
        if (p.stats.mineHeal > 0 && p.alive) { p.hp = Math.min(p.stats.maxHp, p.hp + p.stats.mineHeal); }
        this.hud.addFx(c.x, c.y, 40, 0x8d6e63, 260);
        this.cameras.main.shake(70, 0.003);
        return true;
      }
    }
    return false;
  }

  /* ----- The gnome secret ----- */
  // Killing a gnome as the FIRST kill of a room, 5 times in one run, unlocks the Gnome kit.
  onGnomeFirst(e) {
    if (this.testMode) return;
    this.gnomeFirsts = (this.gnomeFirsts || 0) + 1;
    const need = GAME_CONFIG.secrets.gnomeFirsts;
    if (this.gnomeFirsts < need) { this.hud.floatText(e.x, e.y - 24, '...' + this.gnomeFirsts + '/' + need, '#c62828'); return; }
    if (this.gnomeFirsts === need && SaveData.unlockKit('gnome')) {
      this.hud.showBanner('SECRET: the Gnome kit is yours!');
      this.cameras.main.flash(400, 255, 205, 210);
    }
  }

  /* ----- Save data: bestiary + kits ----- */
  discover(id, x, y) {
    if (this.testMode) return;
    if (SaveData.seen(id)) this.hud.floatText(x, y - 30, 'New Bestiary page!', '#6a1b9a');
  }

  recordKill(id) {
    if (!this.testMode) SaveData.kill(id);
  }

  // Every 0.5 s: did someone just complete a kit (all slots = one class)?
  checkKits(dt) {
    if (this.testMode || this.gameOver) return;
    this.kitCheckMs -= dt;
    if (this.kitCheckMs > 0) return;
    this.kitCheckMs = 500;
    if ((this.flushTick = (this.flushTick || 0) + 1) % 4 === 0) SaveData.flush();   // kill counts, every ~2 s
    for (let i = 0; i < this.players.length; i++) {
      const got = Kits.check(this.players[i], this._newKits);
      for (let k = 0; k < got.length; k++) {
        this.hud.showBanner('You unlocked the ' + KIT_TYPES[got[k]].name + ' starter kit!');
        this.cameras.main.flash(250, 255, 236, 179);
      }
    }
  }

  /* ----- Test Dungeon (debug menu) ----- */
  startTestDungeon() {
    this.bossesBeaten = ShopLogic.maxTier();   // every shop tier unlocked in the test shop
    this.team.coins = Math.max(this.team.coins, 500);
    this.testLayout = 0;
    this.level = Math.max(1, GAME_CONFIG.debug.startLevel);
    this.enemies.setLevel(this.level, GAME_CONFIG.levels);
    this.enemies.bossesBeaten = this.bossesBeaten;
    this.minorWorms.startMinor('smallWorm', this.enemies.hpMul, this.enemies.dmgMul, this.players.length, this.wormCallbacks());
    this.startTestRoom();
    this.testPanel = new TestPanel(this);
    this.hud.showBanner('Test Dungeon');
  }

  // One closed room with nothing in it. Enemies come from the side panel.
  startTestRoom() {
    this.boss.clear();
    this.hud.setBoss(null);
    const room = { gx: 0, gy: 0, doors: { up: false, down: false, left: false, right: false },
                   layout: this.testLayout || 0, type: 'test', depth: 0, visited: true, cleared: false, fightStarted: false };
    if (this.testLayout >= ROOM_LAYOUTS.length) {          // last option: a big scrolling arena
      room.layout = 0; room.cols = 36; room.rows = 24; room.layoutRows = RoomGen.arena(36, 24);
    }
    this.map = { level: this.level, rooms: [room], byKey: { '0,0': room }, start: room, exit: room, gridSize: 1 };
    this.enterRoom(room, null);
  }

  /* ----- Levels and rooms ----- */
  startLevel(n) {
    const lv = GAME_CONFIG.levels;
    this.boss.clear();
    this.hud.setBoss(null);
    this.level = n;
    this.enemies.setLevel(n, lv);
    this.enemies.bossesBeaten = this.bossesBeaten;
    if (!this.testMode) { SaveData.reachedLevel(n); SaveData.flush(); }
    this.minorWorms.startMinor('smallWorm', this.enemies.hpMul, this.enemies.dmgMul, this.players.length, this.wormCallbacks());
    const roomCount = Math.min(lv.roomsMax, lv.roomsBase + Math.floor((n - 1) / lv.extraRoomEvery));
    const st = this.run ? this.stage() : STAGE_TYPES.notebook;
    const theme = st.themes[Math.floor(Math.random() * st.themes.length)];
    this.map = LevelGenerator.generate(n, roomCount, lv.gridSize, { specials: true, theme: theme, merchant: this.merchantHere === 'sell' || this.merchantHere === 'deliver' });
    if (this.merchantHere === 'deliver') {               // he waits for you: his room is on the map from the start
      const mr = this.map.rooms.find((r) => r.type === 'merchant');
      if (mr) mr.revealed = true;
      this.time.delayedCall(1600, () => { if (!this.gameOver) this.hud.showBanner('The merchant has your order!'); });
    }
    this.enterRoom(this.map.start, null);
    this.hud.showBanner(this.run ? st.name : 'Level ' + n);
    if (this.run) this.hud.floatText(this.rooms.W / 2, this.rooms.H / 2 - 60, 'Stage ' + this.run.stageNum + ' · level ' + n, '#5d4037');
  }

  enterRoom(room, viaDir) {
    this.collectAllBlueprints();
    this.roomKills = 0;
    if (this.zones) this.zones.clear();
    this.arena = null;
    this.endBar();
    this.coins.collectAll(this.team);
    this.enemies.clearAll();
    this.allies.killAll();
    this.hazards.clear();
    this.chains.clear();
    this.throws.recallAll();
    this.minorWorms.clearWorms();
    this.playerBullets.killAll();
    this.enemyBullets.killAll();

    this.room = room;
    room.visited = true;
    this.rooms.buildRoom(room);
    this.applyRoomSize();

    // Place players just inside the door they came through
    this.rooms.entryPoint(viaDir, this._pt);
    const n = this.players.length;
    for (let i = 0; i < n; i++) {
      const off = (i - (n - 1) / 2) * 36;
      const horizontal = viaDir === 'left' || viaDir === 'right';
      const x = this._pt.x + (horizontal ? 0 : off);
      const y = this._pt.y + (horizontal ? off : 0);
      if (this.players[i].alive) this.players[i].sprite.body.reset(x, y);
    }
    this.enterSpecialRoom(room);

    if (room.type === 'boss' || room.type === 'test') {
      // boss arena / test room: no doors, nothing spawns on its own
    } else if (!room.cleared) {
      this.rooms.closeDoors();
      this.startRoomFight(room);
    } else if (room.type === 'exit') {
      this.rooms.showHatch();
    }

    this.transitionLockMs = 250;
    this.hud.drawMinimap(this.map, room);
    this.cameras.main.fadeIn(180, 243, 234, 216);
  }

  startRoomFight(room) {
    this.roomFirstKill = false;      // for the gnome secret
    if (room.type === 'arena') { this.startArenaFight(room); return; }
    if (room.theme) { this.startThemedFight(room); return; }
    const cfg = GAME_CONFIG, lv = cfg.levels;
    let budget = lv.baseBudget + (this.level - 1) * lv.budgetPerLevel;
    let maxCount = lv.maxEnemiesPerRoom;
    if (room.type === 'exit') budget *= lv.exitBudgetMul;
    if (this.players.length > 1) { budget *= cfg.coop.budgetMul; maxCount = Math.round(maxCount * cfg.coop.maxEnemiesMul); }
    const wave = this.enemies.buildWave(this.level, budget, maxCount);
    for (let i = 0; i < wave.length; i++) {
      if (this.rooms.randomSpawnPoint(this.players, cfg.spawnMinDistance, this._pt)) {
        const jx = (Math.random() - 0.5) * 20, jy = (Math.random() - 0.5) * 20;
        this.enemies.queueSpawn(wave[i], this._pt.x + jx, this._pt.y + jy, cfg.spawnDelayMs + i * cfg.spawnStaggerMs);
      }
    }
    room.fightStarted = true;
  }

  /* ----- Special spawns: chained pairs and small worms ----- */
  specialSpawn(def, x, y) {
    if (def.worm) { this.minorWorms.spawnWorm(x, y); this.discover('smallWorm', x, y); return; }
    if (def.pair === 'chain') {
      const a = this.enemies.spawn(def.member, x - 45, y);
      const b = this.enemies.spawn(def.member, x + 45, y);
      if (a && b) this.chains.create(a, b, def.chain, this.enemies.dmgMul);
    }
  }

  wormCallbacks() {
    return {
      onWormDead: () => this.recordKill('smallWorm'),
      getPlayers: () => this.players,
      getAllies: () => this.allies.alive,
      onSegmentKilled: (x, y, seg, owner, source) => {
        if (owner) owner.kills++;
        this.trySummon(x, y, owner, source);
        const mul = this.coinMul();
        this.coins.drop(x, y, Math.floor(seg.def.coins[0] * mul + Math.random()), this.team);
        this.hud.addFx(x, y, 16, 0x8d6e63, 220);
      },
      onDefeated: () => {}
    };
  }

  /* ----- Hatches and bosses ----- */
  // Every step ends at a hatch:
  //   level -> shop (+ free buff) -> next step   (no buff when the boss is next)
  //   arena -> straight to the next step
  //   boss  -> boss loot shop (+ free buff) -> path choice -> next stage
  onHatch() {
    if (this.mode !== 'play' || !this.rooms.hatchActive) return;   // never twice for the same hatch
    this.rooms.hideHatch();
    this.collectAllBlueprints();
    if (this.testMode) { this.startTestRoom(); return; }
    const t = this.room.type;
    if (t === 'boss') {
      this.openShop({ bossLoot: this.currentBossId, subtitle: this.bossName(this.currentBossId) + ' defeated · boss loot',
                      after: () => this.openBuffs(() => this.advanceRun()) });
    } else if (t === 'arena') {
      this.advanceRun();
    } else {
      this.earnShavings(SHAVINGS_EARN.level);
      const next = RUN_PLAN.steps[this.run.step + 1];
      if (next === 'boss') {
        this.openShop({ subtitle: 'Level cleared · ' + this.bossName(this.stage().boss) + ' awaits', after: () => this.advanceRun() });
      } else {
        this.openShop({ after: () => this.openBuffs(() => this.advanceRun()) });
      }
    }
  }

  bossName(id) {
    return BOSS_TYPES[id] ? BOSS_TYPES[id].name : ENEMY_TYPES[id].name;
  }

  // Worm bosses live in BOSS_TYPES (BossManager); the others are big enemies
  // with ai of their own (ENEMY_TYPES with boss: {...}).
  startBoss(bossId) {
    bossId = bossId || (this.run ? this.stage().boss : 'bookworm');
    this.currentBossId = bossId;
    this.level = Math.max(1, this.run ? this.run.levelNum : this.level);
    this.enemies.setLevel(this.level, GAME_CONFIG.levels);
    if (!BOSS_TYPES[bossId]) { this.startEnemyBoss(bossId); return; }
    const def = BOSS_TYPES[bossId];
    const room = { gx: 0, gy: 0, doors: { up: false, down: false, left: false, right: false },
                   layout: 0, type: 'boss', depth: 0, visited: true, cleared: false, fightStarted: true };
    this.map = { level: this.level, rooms: [room], byKey: { '0,0': room }, start: room, exit: room, gridSize: 1 };
    this.enterRoom(room, null);
    this.boss.start(bossId, this.level, this.players.length, this.enemies.hpMul, this.enemies.dmgMul, {
      getPlayers: () => this.players,
      getAllies: () => this.allies.alive,
      onSegmentKilled: (x, y, seg, owner, source) => {
        if (owner) owner.kills++;
        this.trySummon(x, y, owner, source);
        const mul = this.coinMul();
        this.coins.drop(x, y, Math.floor(def.coinsPerSegment * mul * this.bossCoinMul() + Math.random()), this.team);
        this.hud.addFx(x, y, 22, 0x8d6e63, 260);
      },
      onDefeated: (x, y) => this.onBossDefeated(def, x, y)
    });
    this.hud.setBoss(this.boss);
    this.hud.showBanner(def.name);
    this.discover(bossId, this.rooms.W / 2, this.rooms.H / 2);
  }

  onBossDefeated(def, x, y) {
    this.recordKill(this.currentBossId);
    this.reviveDowned();
    SaveData.flush();
    this.bossesBeaten++;
    this.enemies.bossesBeaten = this.bossesBeaten;
    if (this.run) this.earnShavings(SHAVINGS_EARN.bossBase + SHAVINGS_EARN.bossPerStage * this.run.stageNum, x, y);
    this.dropBlueprint('boss', x, y);
    const mul = this.coinMul();
    this.coins.drop(Phaser.Math.Clamp(x, 100, this.rooms.W - 100), Phaser.Math.Clamp(y, 100, this.rooms.H - 100),
                    Math.round(def.defeatCoins * mul * this.bossCoinMul()), this.team);
    this.enemyBullets.killAll();
    this.hud.setBoss(null);
    this.hud.showBanner(def.name + ' defeated!');
    this.cameras.main.shake(400, 0.008);
    this.room.cleared = true;
    for (let i = 0; i < this.players.length; i++) {
      const p = this.players[i];
      if (!p.alive) continue;
      const before = p.hp;
      p.heal(50);
      if (p.hp > before) this.hud.floatText(p.sprite.x, p.sprite.y - 30, '+' + (p.hp - before) + ' HP', '#2e7d32');
    }
    this.rooms.showHatch();
    this.hud.drawMinimap(this.map, this.room);
  }

  onBossTouchesPlayer(a, b) {
    const pSprite = a.player ? a : b;
    const seg = a.player ? b : a;
    const player = pSprite.player;
    if (!player || !player.alive || !seg.active || !seg.surfaced) return;
    const res = player.takeHit(seg.def.contact, seg.x, seg.y);
    if (res === 'parry') this.onParry(player, seg);
    else this.onPlayerHit(player, res, seg);
  }

  onRoomCleared() {
    SaveData.flush();
    const room = this.room;
    room.cleared = true;
    this.reviveDowned();
    this.rooms.openDoors();
    for (let i = 0; i < this.players.length; i++) {
      const p = this.players[i];
      if (!p.alive) continue;
      const before = p.hp;
      p.heal(GAME_CONFIG.healOnRoomClearPct + Meta.roomHealBonus());
      if (p.hp > before) this.hud.floatText(p.sprite.x, p.sprite.y - 30, '+' + (p.hp - before) + ' HP', '#2e7d32');
    }
    if (room.type === 'exit') this.rooms.showHatch();
    if (room.type === 'arena') { this.arenaReward(room); this.rooms.showHatch(); this.earnShavings(SHAVINGS_EARN.arena); }
    this.hud.drawMinimap(this.map, room);
  }

  checkRoomState() {
    if (this.room.type === 'boss' || this.room.type === 'test') return;   // the boss decides when the arena is cleared
    if (this.room.type === 'arena' && this.arena && this.arena.kind === 'survival') return;   // the timer decides
    if (!this.room.cleared && this.room.fightStarted && this.enemies.isEmpty() && this.minorWorms.worms.length === 0) {
      if (this.room.waves && this.room.waves.length) { this.spawnThemedWave(this.room); return; }
      this.onRoomCleared();
    }
  }

  checkTransitions(dt) {
    if (this.transitionLockMs > 0) { this.transitionLockMs -= dt; return; }
    if (!this.room.cleared) return;
    // the hatch only works once everyone has stepped off it (no instant exit if it opens under your feet)
    if (this.rooms.hatchActive && !this.rooms.hatchArmed) {
      let on = false;
      for (let i = 0; i < this.players.length; i++) if (this.players[i].alive && this.rooms.isOnHatch(this.players[i].sprite.x, this.players[i].sprite.y, 46)) on = true;
      if (!on) this.rooms.hatchArmed = true;
    }
    for (let i = 0; i < this.players.length; i++) {
      const p = this.players[i];
      if (!p.alive) continue;
      if (this.rooms.hatchArmed && this.rooms.isOnHatch(p.sprite.x, p.sprite.y)) { this.onHatch(); return; }
      const dir = this.rooms.exitDirection(p.sprite.x, p.sprite.y);
      if (dir && this.room.doors[dir]) {
        const next = LevelGenerator.neighbor(this.map, this.room, dir);
        if (next) { this.enterRoom(next, dir); return; }
      }
    }
  }

  /* ----- Main loop ----- */
  update(time, delta) {
    const dt = Math.min(delta, GAME_CONFIG.maxFrameMs);
    this.checkKits(dt);
    if (this.perfText.visible) {
      if (delta > this.perfWorst) this.perfWorst = delta;
      this.perfMs -= delta;
      if (this.perfMs <= 0) {
        this.perfMs = 500;
        const mem = (performance && performance.memory) ? Math.round(performance.memory.usedJSHeapSize / 1048576) + 'MB' : '-';
        this.perfText.setText(Math.round(this.game.loop.actualFps) + ' fps  worst ' + Math.round(this.perfWorst) + 'ms\n' +
          'objects ' + this.children.length + '  enemies ' + this.enemies.group.countActive(true) + '  mem ' + mem +
          '\nrenderer ' + (this.game.renderer.type === Phaser.WEBGL ? 'WebGL' : 'Canvas'));
        this.perfWorst = 0;
      }
    }
    for (let i = 0; i < this.players.length; i++) this.players[i].controller.poll();

    // Menus pause the game
    if (this.mode !== 'play') {
      if (this.menu) this.menu.update(dt);
      this.hud.updatePanel(this.players, this.team, this.level, this.elapsedMs);
      return;
    }

    // 1) INPUT: copy controller output into each player's input state
    for (let i = 0; i < this.players.length; i++) {
      const p = this.players[i];
      const inp = p.input;
      const st = p.controller.state;
      if (st.inventory && !this.gameOver) { this.openInventory('play'); return; }
      if (!p.alive) { inp.moveX = 0; inp.moveY = 0; inp.attack = false; inp.dash = false; continue; }
      const m = p.controller.getMoveDirection();
      const a = p.controller.getAimDirection(p.sprite.x, p.sprite.y);
      inp.moveX = m.x; inp.moveY = m.y;
      inp.aimX = a.x; inp.aimY = a.y;
      inp.attack = st.attackHeld;
      inp.attackPressed = st.attackPressed;
      if (this.testPanel && p.controller.hasPointer && this.testPanel.contains(this.input.activePointer)) { inp.attack = false; inp.attackPressed = false; }
      if (GAME_CONFIG.debug.god) { p.hp = p.stats.maxHp; p.mana = p.stats.maxMana; }
      inp.dash = st.dash;
      inp.swap = st.swap;
      inp.skill1 = st.skill1;
      inp.skill2 = st.skill2;
      inp.consumable = st.consumable;
    }

    // 2) LOGIC
    if (!this.gameOver) {
      this.elapsedMs += dt;
      for (let i = 0; i < this.players.length; i++) this.players[i].update(dt, this.combatContext);
    }
    this.rooms.updateFlowField(this.players);
    this.enemies.update(dt, this.aiContext);
    this.boss.update(dt, this.enemyBullets);
    this.minorWorms.update(dt, this.enemyBullets);
    this.allies.update(dt, this.combatContext);
    this.hazards.update(dt);
    this.chains.update(dt, this.players);
    this.throws.update(dt, this.combatContext);
    this.playerBullets.update(dt);
    this.enemyBullets.update(dt);
    this.coins.update(dt, this.players, this.room.cleared, this.team);
    if (!this.gameOver) {
      this.checkGameOver();
      if (!this.gameOver) {
        this.checkRoomState();
        this.checkTransitions(dt);
        if (this.mode === 'play') { this.updateSpecials(dt); this.zones.update(dt); }
        for (let i = 0; i < this.players.length; i++) {
          const p = this.players[i];
          if (!p.erasedFx) continue;                   // Pencil Case: Eraser saved this player
          p.erasedFx = false;
          this.hud.floatText(p.sprite.x, p.sprite.y - 34, 'ERASED! (saved)', '#ad1457');
          this.hud.addFx(p.sprite.x, p.sprite.y, 60, 0xf8bbd0, 400);
          this.cameras.main.shake(200, 0.006);
        }
      }
    }

    // 3) VIEW
    this.updateCamera(dt);
    for (let i = 0; i < this.players.length; i++) this.players[i].updateView();
    this.enemies.updateView(dt);
    this.hud.drawOverlay(dt, this.players, this.enemies);
    this.hud.drawBoss(dt);
    this.hud.updatePanel(this.players, this.team, this.level, this.elapsedMs);
  }

  /* ----- Menus (inventory, shop, buff pick) ----- */
  setMode(mode) {
    this.mode = mode;
    if (mode === 'play') {
      this.physics.world.resume();
      this.input.setDefaultCursor('crosshair');
    } else {
      this.physics.world.pause();
      this.input.setDefaultCursor('default');
    }
  }

  openInventory(from) {
    const backToShop = from === 'shop';
    if (backToShop && this.shop) this.shop.hide();
    this.menu = new InventoryMenu(this, this.players, this.team, backToShop ? 'shop' : 'play', () => {
      if (backToShop && this.shop) { this.shop.show(); this.menu = this.shop; this.setMode('shop'); }
      else { this.menu = null; this.setMode('play'); }
    });
    this.setMode('inventory');
  }

  // opts: { next: 'boss' (go to the boss, no buff pick), bossLoot: bossId, subtitle }
  openShop(opts) {
    opts = opts || {};
    this.coins.collectAll(this.team);
    const piggy = this.testMode ? 0 : Meta.piggyBank(this.team.coins);   // Pencil Case: Piggy Bank
    this.team.coins += piggy;
    this.shop = new ShopMenu(this, this.players, this.team, this.level, {
      onInventory: () => this.openInventory('shop'),
      onDone: () => {
        this.shop = null;
        this.menu = null; this.setMode('play');
        if (this.testMode) return;
        if (opts.after) opts.after();
      }
    }, { bossesBeaten: this.bossesBeaten, bossLoot: opts.bossLoot || null, subtitle: opts.subtitle,
         reserved: this.run ? this.run.reserved : null, freeReroll: Meta.rank('luckyDice') > 0 });
    if (piggy) this.shop.say('Piggy Bank: +' + piggy + ' coins');
    if (this.run) this.run.reserved = [];             // reserved items are in this shop now
    this.menu = this.shop;
    this.setMode('shop');
  }

  openBuffs(after) {
    this.menu = new BuffMenu(this, this.players, () => {
      this.menu = null;
      this.setMode('play');
      if (after) after();
    });
    this.setMode('buffs');
  }

  /* ----- Combat ----- */
  // Every hit on an enemy goes through here (bullets, arrows, sword).
  // source: 'ally' when a wormling did it (so its kills don't summon more wormlings)
  hitEnemy(e, dmg, dirX, dirY, kb, kbMs, owner, source) {
    if (!e.active) return;
    if (owner && owner.sprite && owner.stats) { e.awareOf = owner; e.awareMs = 10000; }   // it knows where you are now (10 s)
    if (owner && owner.stats && owner.stats.critChance > 0 && Math.random() < owner.stats.critChance) {
      dmg = Math.round(dmg * CRIT_MULTIPLIER);
      this.hud.addFx(e.x, e.y, 18, 0xffeb3b, 180);
    }
    if (owner && owner.stats && owner.stats.stillDamage > 0 && owner.stillMs > 400 && source !== 'dot') {
      dmg = Math.round(dmg * (1 + owner.stats.stillDamage));
    }
    if (owner && owner.stats && owner.stats.bossDamage > 0 && GearFx.isBoss(e)) dmg = Math.round(dmg * (1 + owner.stats.bossDamage));
    if (e.hexUntil > this.time.now) dmg = Math.round(dmg * 1.25);              // Witch hex: +25% from everything
    if (owner && owner.stats && owner.stats.hexChance > 0 && source !== 'dot' && Math.random() < owner.stats.hexChance) GearFx.hex(this.enemies, e, { ms: 3000 }, owner);
    if (owner && owner.stats && owner.stats.lifeSteal > 0 && owner.alive && source !== 'dot') {
      owner.lifeStealAcc = (owner.lifeStealAcc || 0) + dmg * owner.stats.lifeSteal;   // whole HP points only
      if (owner.lifeStealAcc >= 1) { const h = Math.floor(owner.lifeStealAcc); owner.lifeStealAcc -= h; owner.hp = Math.min(owner.stats.maxHp, owner.hp + h); }
    }
    if (e.isBossPart) { e.mgr.damage(e, dmg, owner, source); return; }
    // Shield Guard: hits from the front mostly bounce off its shield
    const sh = e.def.shield;
    if (sh && source !== 'dot' && e.stunnedMs <= 0 && (dirX || dirY)) {
      const fx = Math.cos(e.faceAng), fy = Math.sin(e.faceAng);
      if (-(dirX * fx + dirY * fy) > Math.cos(sh.arcDeg * Math.PI / 360)) {
        dmg = Math.max(1, Math.round(dmg * sh.blockMul));
        this.hud.addFx(e.x + fx * 16, e.y + fy * 16, 14, 0xcfd8dc, 140);
      }
    }
    if (this.enemies.damage(e, dmg, dirX, dirY, kb, kbMs)) this.onEnemyKilled(e, owner, source);
    else this.afterEnemyHurt(e);
  }

  onEnemyKilled(e, owner, source) {
    if (owner) owner.kills++;
    this.roomKills = (this.roomKills || 0) + 1;          // Army of the Dead raises this many
    this.afterEnemyKilled(e);
    // Necromancer: the dead may rise and fight for you
    if (owner && owner.stats && owner.stats.raiseChance > 0 && !GearFx.isBoss(e) && Math.random() < owner.stats.raiseChance) {
      if (this.allies.spawn('skeleton', e.x, e.y, owner)) this.hud.addFx(e.x, e.y, 20, 0xeceff1, 260);
    }
    if (owner && owner.stats && owner.stats.inklingChance > 0 && source !== 'ally' && Math.random() < owner.stats.inklingChance) {
      if (this.allies.spawn('inkling', e.x, e.y, owner)) this.hud.addFx(e.x, e.y, 18, 0x263238, 220);
    }
    if (this.roomFirstKill === false) {
      this.roomFirstKill = true;
      if (e.typeId === 'gnome') this.onGnomeFirst(e);
    }
    this.recordKill(bestiaryIdFor(e.typeId));
    this.trySummon(e.x, e.y, owner, source);
    const mul = this.coinMul();
    const raw = this.enemies.coinsFor(e) * mul;
    this.coins.drop(e.x, e.y, Math.floor(raw + Math.random()), this.team);
  }

  // Devourer Sword: kills may summon a wormling.
  trySummon(x, y, owner, source) {
    if (source === 'ally' || !owner || !owner.weapon) return;
    const s = owner.weapon.def.summonOnKill;
    if (!s || Math.random() >= s.chance) return;
    if (this.allies.spawn(s.ally, x, y, owner)) this.hud.addFx(x, y, 20, 0x7b1fa2, 260);
  }

  // After an enemy attack reached a player (not parried).
  onPlayerHit(p, res, attacker) {
    if (res === 'none' || res === 'parry') return;
    if (res === 'dodge') this.hud.floatText(p.sprite.x, p.sprite.y - 26, 'Dodge', '#1565c0');
    // Amulet Robe: whoever hits you gets stunned, shorter for tanky enemies
    if (p.stats.stunOnHit > 0 && attacker && attacker.active && attacker.isEnemy) {
      const ms = Math.max(150, Math.min(1000, 800 * 35 / attacker.maxHp));
      this.enemies.stun(attacker, ms);
    }
  }

  // Damages every enemy in a circle (fireball, bomb).
  explode(x, y, radius, damage, owner) {
    const list = this.enemies.targets();
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      if (!e.active) continue;
      const dx = e.x - x, dy = e.y - y;
      const r = radius + e.def.size / 2;
      if (dx * dx + dy * dy > r * r) continue;
      const len = Math.sqrt(dx * dx + dy * dy) || 1;
      this.hitEnemy(e, damage, dx / len, dy / len, 220, 120, owner);
    }
    this.hud.addFx(x, y, radius, 0xff7043, 320);
  }

  // A shield parried `attacker`: stun it and deal a little damage.
  onParry(p, attacker) {
    const d = p.weapon ? p.weapon.def : null;
    this.hud.addFx(p.sprite.x, p.sprite.y, 40, 0xffd54f, 220);
    if (!d || !attacker || !attacker.active || !attacker.isEnemy) return;
    if (!attacker.isBossPart) this.enemies.stun(attacker, d.stunMs);
    else attacker.stunnedMs = 600;   // bosses aren't stunned, but Kaan Sai can still target it
    const dx = attacker.x - p.sprite.x, dy = attacker.y - p.sprite.y;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    this.hitEnemy(attacker, Math.max(1, Math.round(d.parryDamage * p.stats.damageMul)), dx / len, dy / len, 0, 0, p);
  }

  // F key. Returns true if something was used.
  useConsumable(p) {
    const id = p.consumableId;
    const def = Catalog.get('consumable', id);
    if (!def || p.consumableCount <= 0) return false;
    if (def.kind === 'heal') {
      if (p.hp >= p.stats.maxHp) return false;
      p.heal(def.healPct);
    } else if (def.kind === 'mana') {
      if (p.mana >= p.stats.maxMana) return false;
      p.mana = Math.min(p.stats.maxMana, p.mana + p.stats.maxMana * def.manaPct / 100);
    } else if (def.kind === 'effect') {
      p.addEffect(def.effect);
      this.hud.floatText(p.sprite.x, p.sprite.y - 30, EFFECT_TYPES[def.effect].name, '#6d4c41');
    } else if (def.kind === 'sand') {
      // Stun the nearest enemies
      const list = this.enemies.targets();
      const hits = [];
      for (let i = 0; i < list.length; i++) {
        const e = list[i];
        if (!e.active) continue;
        const dx = e.x - p.sprite.x, dy = e.y - p.sprite.y;
        const d2 = dx * dx + dy * dy;
        if (d2 <= def.radius * def.radius) hits.push({ e: e, d2: d2 });
      }
      if (hits.length === 0) return false;
      hits.sort((a, b) => a.d2 - b.d2);
      for (let i = 0; i < Math.min(def.targets, hits.length); i++) {
        this.enemies.stun(hits[i].e, def.stunMs);
        this.hud.addFx(hits[i].e.x, hits[i].e.y, 22, 0xd7ccb7, 300);
      }
    } else if (def.kind === 'trap') {
      if (!this.hazards.placeTrap(p.sprite.x, p.sprite.y, def, p)) return false;
    } else if (def.kind === 'bomb') {
      const b = WeaponSystem.shoot(p, this.combatContext, p.input.aimX, p.input.aimY, def.speed, def.damage, def.fuseMs, 'bomb');
      if (!b) return false;
      b.fuse = true;
      b.aoeRadius = def.radius;
    }
    p.consumableCount--;
    if (p.consumableCount <= 0) { p.consumableId = null; p.consumableCount = 0; } // used up: slot is empty
    return true;
  }

  /* ----- Collision callbacks ----- */
  onBulletHitsWall(a, b) {
    const bullet = a.isBullet ? a : b;
    if (!bullet.active) return;
    if (bullet.aoeRadius > 0) this.explode(bullet.x, bullet.y, bullet.aoeRadius, bullet.damage, bullet.owner);
    bullet.manager.kill(bullet);
  }

  onBulletHitsEnemy(a, b) {
    const bullet = a.isBullet ? a : b;
    const enemy = a.isBullet ? b : a;
    if (!bullet.active || !enemy.active || bullet.fuse) return;

    // Fireballs explode on the first enemy they touch
    if (bullet.aoeRadius > 0) {
      const x = bullet.x, y = bullet.y, r = bullet.aoeRadius, dmg = bullet.damage, owner = bullet.owner;
      const ig = bullet.ignite, ch = bullet.chill, st = bullet.stunHit, hx = bullet.hex, ps = bullet.poison;
      this.playerBullets.kill(bullet);
      if (ig || ch || st || hx || ps) GearFx.burst(this, owner, x, y, r, { damage: 0, ignite: ig, chill: ch, stunMs: st, hex: hx, poison: ps, color: null });
      this.explode(x, y, r, dmg, owner);
      return;
    }

    // Piercing arrows remember who they hit, so they hit each enemy once
    if (bullet.hitList.length > 0 && bullet.hitList.indexOf(enemy) !== -1) return;

    const vx = bullet.body.velocity.x, vy = bullet.body.velocity.y;
    const len = Math.sqrt(vx * vx + vy * vy) || 1;
    const owner = bullet.owner;
    const f = bullet.flags;
    let damage = bullet.damage;
    // Crippling Crossbow: unmarked enemy = weak bolt that marks + slows;
    // marked enemy = strong bolt with a bonus. (Bolts of one volley land one
    // after another, so the first marks and the rest get the bonus.)
    const cr = bullet.crippling;
    let markNow = false;
    if (cr) {
      if (enemy.markedBy === owner && enemy.markMs > 0) damage = Math.round(damage * (1 + cr.markBonus));
      else { damage = bullet.firstDamage; markNow = true; }
    }
    if (bullet.reflected && enemy.def && enemy.def.reflectWeak) {         // its own ink, sent back: hurts a lot
      damage = Math.round(damage * enemy.def.reflectWeak);
      this.hud.addFx(enemy.x, enemy.y, 26, 0x263238, 220);
    }
    const kb = bullet.knockback || undefined;
    const mercury = bullet.isArrow && owner && owner.stats && owner.stats.mercury > 0;
    const split = bullet.split, bx = bullet.x, by = bullet.y;
    if (bullet.pierceLeft > 0) {
      bullet.pierceLeft--;
      bullet.hitList.push(enemy);
    } else {
      this.playerBullets.kill(bullet);
    }
    this.hitEnemy(enemy, damage, vx / len, vy / len, kb, kb ? 160 : undefined, owner);
    if (bullet.ignite || bullet.chill || bullet.chain || bullet.stunHit || bullet.hex || bullet.poison || bullet.wind) GearFx.onBulletHit(this, bullet, enemy, owner);
    if (split) {   // Blot Staff: bursts into smaller shots that fly past the enemy it hit
      const base = Math.atan2(vy, vx), mul = owner && owner.stats ? owner.stats.damageMul : 1;
      for (let i = 0; i < split.count; i++) {
        const a = base + (i - (split.count - 1) / 2) * 0.55;
        const nb = this.playerBullets.fire(bx, by, Math.cos(a), Math.sin(a), split.speed, Math.round(split.damage * mul), split.lifetimeMs, owner, split.texture);
        if (nb && enemy.active) nb.hitList.push(enemy);
      }
    }
    if (!enemy.active) return;
    if (mercury) this.enemies.slow(enemy, 1500, 0.35);
    if (markNow) {
      this.enemies.mark(enemy, cr.mark, owner); this.enemies.slow(enemy, cr.slow.ms, cr.slow.pct);
      this.hud.addFx(enemy.x, enemy.y, 18, 0xc62828, 200);
    }
    if (f) {
      if (f.mark) { this.enemies.mark(enemy, f.mark, owner); this.hud.addFx(enemy.x, enemy.y, 18, 0xc62828, 200); }
      if (f.slow) this.enemies.slow(enemy, f.slow.ms, f.slow.pct);
      if (f.bleed) this.enemies.bleed(enemy, f.bleed.ms, Math.max(1, Math.round(f.bleed.tick * (owner ? owner.stats.damageMul : 1))), owner);
    }
  }

  onEnemyBulletHitsPlayer(a, b) {
    const bullet = a.isBullet ? a : b;
    const pSprite = a.isBullet ? b : a;
    const player = pSprite.player;
    if (!bullet.active || !player || !player.alive) return;
    if (player.isDashing()) return; // dash goes through bullets
    const res = player.takeHit(bullet.damage, bullet.x, bullet.y);
    const owner = bullet.owner;
    if (bullet.burnMs > 0 && (res === 'hit' || res === 'block')) player.applyBurn(bullet.burnMs, bullet.burnTick);
    this.enemyBullets.kill(bullet);
    if (res === 'parry') this.onParry(player, owner);
    else this.onPlayerHit(player, res, owner);
  }

  onEnemyTouchesPlayer(a, b) {
    const pSprite = a.player ? a : b;
    const enemy = a.player ? b : a;
    const player = pSprite.player;
    if (!player || !player.alive || !enemy.active) return;
    this.enemies.handlePlayerContact(enemy, player);
  }

  checkGameOver() {
    for (let i = 0; i < this.players.length; i++) if (this.players[i].alive) return;
    this.collectAllBlueprints();

    this.gameOver = true;
    let kills = 0;
    for (let i = 0; i < this.players.length; i++) kills += this.players[i].kills;
    const result = { seconds: Math.floor(this.elapsedMs / 1000), kills: kills, coins: this.team.coins, level: this.level, players: this.players.length,
                     shavings: this.runShavings, testMode: this.testMode };
    SaveData.flush();
    this.time.delayedCall(900, () => this.scene.start('GameOverScene', result));
  }

  cleanup() {
    for (let i = 0; i < this.players.length; i++) {
      if (this.players[i].controller.destroy) this.players[i].controller.destroy();
    }
    this.players = [];
    this.playerSprites = [];
    // Phaser destroys the scene's game objects, physics colliders, tweens
    // and timers automatically when the scene shuts down.
  }
}

/* ---------- Game Over ---------- */
// merchant / treasure / shrine / themed rooms / arena / enemy bosses (specials.js)
Object.assign(GameScene.prototype, RunRoomsMixin);

class GameOverScene extends Phaser.Scene {
  constructor() { super('GameOverScene'); }

  create(data) {
    const W = GAME_CONFIG.width, H = GAME_CONFIG.height;
    this.restarting = false;
    this.playerCount = data.players || 1;
    this.input.setDefaultCursor('default');

    this.add.text(W / 2, H / 2 - 70, data.victory ? 'RUN COMPLETE!' : 'GAME OVER', {
      fontFamily: 'Arial, sans-serif', fontSize: '56px', color: data.victory ? '#2e7d32' : '#37474f', fontStyle: 'bold'
    }).setOrigin(0.5);
    if (data.victory) {
      const names = (data.path || []).map((id) => STAGE_TYPES[id] ? STAGE_TYPES[id].name : id).join('  →  ');
      this.add.text(W / 2, H / 2 - 130, names, { fontFamily: 'Arial, sans-serif', fontSize: '16px', color: '#5d4037' }).setOrigin(0.5);
      this.add.text(W / 2, H / 2 + 110, 'That\'s the end of the paper so far... deeper stages are being drawn.', {
        fontFamily: 'Arial, sans-serif', fontSize: '15px', color: '#8d6e63' }).setOrigin(0.5);
    }
    this.add.text(W / 2, H / 2 - 5,
      'Reached level ' + data.level + '   ·   ' + data.seconds + 's   ·   ' + data.kills + ' kills   ·   ' + data.coins + ' coins', {
      fontFamily: 'Arial, sans-serif', fontSize: '24px', color: '#37474f'
    }).setOrigin(0.5);
    if (!data.testMode) {
      this.add.text(W / 2, H / 2 + 28, '+' + (data.shavings || 0) + ' shavings  ·  ' + Meta.shavings() + ' in your Pencil Case', {
        fontFamily: 'Arial, sans-serif', fontSize: '18px', color: '#6d4c41', fontStyle: 'bold' }).setOrigin(0.5);
    }
    const prompt = this.add.text(W / 2, H / 2 + 62, 'Click or press R to play again  ·  M = main menu', {
      fontFamily: 'Arial, sans-serif', fontSize: '20px', color: '#c0392b'
    }).setOrigin(0.5).setAlpha(0);

    // Short delay so a held mouse button doesn't instantly restart
    this.time.delayedCall(600, () => {
      prompt.setAlpha(1);
      this.input.once('pointerdown', this.restart, this);
      this.input.keyboard.once('keydown-R', this.restart, this);
      this.input.keyboard.once('keydown-M', () => { if (!this.restarting) { this.restarting = true; this.scene.start('MainMenuScene'); } });
    });
  }

  restart() {
    if (this.restarting) return;
    this.restarting = true;
    this.scene.start('WeaponSelectScene', { players: this.playerCount });
  }
}

/* ---------- Start Phaser ---------- */
if (typeof Phaser === 'undefined') {
  document.body.innerHTML = '<p style="color:#fff;font:18px Arial;padding:20px">' +
    'phaser.min.js was not found. Put it in the same folder as index.html.</p>';
} else {
  window.game = new Phaser.Game({
    // open index.html?canvas to force the Canvas renderer (for PCs with bad GPU drivers)
    type: (location.search.indexOf('canvas') >= 0) ? Phaser.CANVAS : Phaser.AUTO,
    parent: 'game',
    width: GAME_CONFIG.width,
    height: GAME_CONFIG.height,
    backgroundColor: GAME_CONFIG.colors.paper,
    physics: { default: 'arcade', arcade: { debug: false } },
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    input: { activePointers: 4 },                                  // phones: two thumbs + buttons
    render: { preserveDrawingBuffer: IS_TOUCH },                   // (the hold-to-read magnifier copies the screen)
    scene: [BootScene, MainMenuScene, PencilCaseScene, BestiaryScene, WeaponSelectScene, PadSetupScene, ControlsScene, TouchLayoutScene, GameScene, GameOverScene]
  });
  Magnifier.init(window.game);
  MobileScreen.init();
  // phone version (served from a website): works offline after the first visit
  if ('serviceWorker' in navigator && /^https?:/.test(location.protocol)) navigator.serviceWorker.register('sw.js').catch(() => {});
}
