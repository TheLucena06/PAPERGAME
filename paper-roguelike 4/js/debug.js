/* debug.js
   DebugMenu: opened by typing "debug" on the weapon select screen. Changes
   GAME_CONFIG.debug for this session only (reloading the page resets it).
   TestPanel: the side menu inside the Test Dungeon (an empty room where you
   spawn enemies and swap gear). [T] hides/shows it.
   Nothing here runs during a normal run. */

const DebugUI = {
  // A clickable text "button". Returns the Text object.
  button(scene, root, x, y, label, size, onClick, color, bg) {
    const t = scene.add.text(x, y, label, {
      fontFamily: 'Arial, sans-serif', fontSize: size + 'px', color: color || '#fdf6e3',
      backgroundColor: bg || '#4e3f33', padding: { x: 6, y: 2 }
    });
    t.setInteractive({ useHandCursor: true });
    t.on('pointerdown', (ptr, lx, ly, ev) => { if (ev) ev.stopPropagation(); onClick(); });
    t.on('pointerover', () => t.setAlpha(0.8));
    t.on('pointerout', () => t.setAlpha(1));
    root.add(t);
    return t;
  },
  text(scene, root, x, y, str, size, color, bold) {
    const t = scene.add.text(x, y, str, { fontFamily: 'Arial, sans-serif', fontSize: size + 'px', color: color || '#37474f', fontStyle: bold ? 'bold' : 'normal' });
    root.add(t);
    return t;
  }
};

/* ---------------- Debug menu (weapon select screen) ---------------- */
class DebugMenu {
  constructor(scene, onTestDungeon, onClose) {
    this.scene = scene;
    this.onTestDungeon = onTestDungeon;
    this.onClose = onClose;
    this.build();
  }

  build() {
    if (this.root) this.root.destroy(true);
    const sc = this.scene, W = GAME_CONFIG.width, H = GAME_CONFIG.height, d = GAME_CONFIG.debug;
    const root = sc.add.container(0, 0).setDepth(500);
    this.root = root;
    // full-screen blocker so clicks don't reach the weapon cards
    const block = sc.add.rectangle(W / 2, H / 2, W, H, 0x2b2622, 0.65).setInteractive();
    root.add(block);
    const pw = 900, ph = 560, px = W / 2 - pw / 2, py = H / 2 - ph / 2;
    const g = sc.add.graphics();
    g.fillStyle(0xfdf6e3, 1); g.fillRoundedRect(px, py, pw, ph, 10);
    g.lineStyle(3, 0xc62828, 0.8); g.strokeRoundedRect(px, py, pw, ph, 10);
    g.lineStyle(1, 0x8d6e63, 0.3); g.lineBetween(px + 450, py + 80, px + 450, py + ph - 70);
    root.add(g);
    const T = (x, y, s, size, color, bold) => DebugUI.text(sc, root, x, y, s, size, color, bold);
    const B = (x, y, s, fn, bg) => DebugUI.button(sc, root, x, y, s, 15, fn, null, bg);
    T(px + 20, py + 14, 'DEBUG MENU', 24, '#c62828', true);
    T(px + 20, py + 46, 'Settings last until the page is reloaded. Then pick a weapon to start.', 12, '#8d6e63');

    let y = py + 80, cx = px + 20;
    const num = (label, get, set, step, min, max) => {
      T(cx, y + 3, label, 16, null, true);
      T(cx + 280, y + 3, '' + get(), 16, null, true).setOrigin(0.5, 0);
      B(cx + 230, y, ' − ', () => { set(Math.max(min, get() - step)); this.build(); });
      B(cx + 304, y, ' + ', () => { set(Math.min(max, get() + step)); this.build(); });
      y += 34;
    };
    const tog = (label, key, hint) => {
      T(cx, y + 3, label, 16, null, true);
      if (hint) T(cx, y + 22, hint, 11, '#8d6e63');
      B(cx + 230, y, d[key] ? '  ON  ' : '  OFF  ', () => { d[key] = !d[key]; this.build(); }, d[key] ? '#2e7d32' : '#757575');
      y += hint ? 42 : 34;
    };
    // ---- left: the run ----
    num('Start level', () => d.startLevel, (v) => { d.startLevel = v; }, 1, 1, 30);
    num('Start coins', () => d.startCoins, (v) => { d.startCoins = v; }, 100, 0, 5000);
    tog('Start in shop', 'startInShop');
    tog('Boss fight right away', 'bossNow');
    tog('Count skipped bosses', 'skippedBossesCount', 'Start level 3+ = post-boss items and enemies unlocked');
    num('Bosses beaten (tiers)', () => d.bossesBeaten || 0, (v) => { d.bossesBeaten = v; }, 1, 0, 4);
    tog('Post-boss items only', 'postBossShopOnly');
    tog('God mode', 'god', 'Full HP and mana all the time');

    // ---- right: tuning + save data ----
    y = py + 80; cx = px + 470;
    T(cx, y - 2, 'Difficulty tuning', 13, '#c62828', true); y += 22;
    num('Enemy HP %', () => d.enemyHpPct, (v) => { d.enemyHpPct = v; }, 25, 25, 500);
    num('Enemy damage %', () => d.enemyDmgPct, (v) => { d.enemyDmgPct = v; }, 25, 25, 500);
    num('Boss arena size %', () => d.bossArenaPct, (v) => { d.bossArenaPct = v; }, 10, 60, 200);
    T(cx, y - 4, 'Arena %: 100 = default size, smaller = less room to dodge (min. one screen).', 11, '#8d6e63');
    y += 30;
    T(cx, y - 2, 'Save data', 13, '#c62828', true); y += 22;
    B(cx, y, 'Unlock all kits', () => { for (const id in KIT_TYPES) SaveData.unlockKit(id); this.note('All kits unlocked.'); }, '#2e7d32');
    B(cx + 135, y, 'Reveal bestiary', () => { for (let i = 0; i < BESTIARY_ENTRIES.length; i++) SaveData.seen(BESTIARY_ENTRIES[i].id); this.note('Every bestiary page filled.'); }, '#2e7d32');
    y += 34;
    B(cx, y, '+200 shavings', () => { Meta.data().shavings += 200; SaveData.save(); this.note('+200 shavings.'); }, '#6d4c41');
    B(cx + 135, y, 'All blueprints', () => { for (const id in BLUEPRINT_TYPES) SaveData.unlockBlueprint(id); this.note('Every blueprint found.'); }, '#1565c0');
    y += 34;
    B(cx, y, this.confirmDelete ? 'Sure? Click again' : 'Delete save', () => {
      if (!this.confirmDelete) { this.confirmDelete = true; this.build(); return; }
      this.confirmDelete = false; SaveData.reset(); this.build(); this.note('Save deleted.');
    }, '#c62828');
    this.noteText = T(cx, y + 40, '', 13, '#2e7d32', true);

    B(px + 20, py + ph - 52, '  TEST DUNGEON  ', () => this.onTestDungeon(), '#c62828').setFontSize(18);
    B(px + pw - 110, py + ph - 52, '  Close  ', () => this.close(), '#37474f').setFontSize(18);
  }

  note(m) { if (this.noteText) this.noteText.setText(m); }

  close() {
    if (this.root) { this.root.destroy(true); this.root = null; }
    if (this.onClose) this.onClose();
  }
}

/* ---------------- Test Dungeon side panel ---------------- */
class TestPanel {
  constructor(scene) {
    this.scene = scene;
    this.visible = true;
    this.count = 1;            // enemies per click
    this.w = 186;
    this.x = GAME_CONFIG.width - this.w;
    this.build();
    scene.input.keyboard.on('keydown-T', () => this.toggle());
  }

  toggle() {
    this.visible = !this.visible;
    this.root.setVisible(this.visible);
  }

  // Is the mouse over one of the panel's buttons? (then clicks don't attack).
  // Only real buttons block: aiming/attacking toward that side of the room still works.
  contains(ptr) {
    if (!this.visible) return false;
    const hits = this.scene.input.hitTestPointer(ptr);
    for (let i = 0; i < hits.length; i++) if (hits[i].parentContainer === this.root) return true;
    return false;
  }

  cycle(list, current) {
    const i = list.indexOf(current);
    return list[(i + 1) % list.length];
  }

  build() {
    if (this.root) this.root.destroy(true);
    const sc = this.scene, H = GAME_CONFIG.height, x = this.x;
    const root = sc.add.container(0, 0).setDepth(260).setVisible(this.visible).setScrollFactor(0);
    this.root = root;
    const bg = sc.add.rectangle(x + this.w / 2, H / 2, this.w, H, 0x2b2622, 0.82).setInteractive();
    root.add(bg);
    const T = (yy, s, size, color) => DebugUI.text(sc, root, x + 8, yy, s, size, color || '#ffcc80', true);
    const B = (yy, s, fn, bg2, xx) => DebugUI.button(sc, root, xx || x + 8, yy, s, 12, fn, null, bg2);
    let y = 6;
    T(y, 'TEST DUNGEON  [T] hide', 12); y += 18;

    // --- spawn ---
    T(y, 'Spawn', 12, '#ef9a9a');
    B(y - 2, 'x' + this.count, () => { this.count = this.count === 1 ? 3 : 1; this.build(); }, '#6d4c41', x + 70);
    y += 18;
    let col = 0;
    for (const id in ENEMY_TYPES) {
      const def = ENEMY_TYPES[id];
      if (!def.ai && !def.pair && !def.worm) continue;
      if (def.boss || def.bossPart || def.miniBoss) continue;  // bosses have their own buttons
      if (id === 'prisoner') continue;                       // spawned as a pair
      let label = (def.elite ? '★ ' : '') + (def.pair ? 'Prisoners (2)' : def.name);
      if (label.length > 14) label = label.slice(0, 13) + '.';
      B(y, label, () => this.spawn(id), def.postBoss ? '#5d4037' : '#4e3f33', x + 6 + col * 89)
        .setFontSize(11).setFixedSize(86, 0);
      col++;
      if (col === 2) { col = 0; y += 20; }
    }
    if (col) y += 20;
    y += 4;

    // --- tools ---
    const s = this.scene, p = s.players[0];
    T(y, 'Tools', 12, '#ef9a9a'); y += 18;
    B(y, 'Clear enemies', () => this.clear(), '#37474f');
    const bosses = ['bookworm'].concat(Object.keys(ENEMY_TYPES).filter((k) => ENEMY_TYPES[k].boss));
    this.bossIdx = this.bossIdx || 0;
    B(y, 'Boss ▸', () => { this.clear(); s.startBoss(bosses[this.bossIdx % bosses.length]); this.bossIdx++; this.build(); }, '#6a1b9a', x + 110); y += 20;
    B(y, 'Mimic', () => { const e = s.enemies.spawn('mimic', s.rooms.W / 2, s.rooms.H / 2 - 100); if (e) s.startBar('mimic', [e], 'Mimic'); }, '#6d4c41');
    B(y, 'Champion', () => {
      const ids = Object.keys(ENEMY_TYPES).filter((k) => ENEMY_TYPES[k].weight && ENEMY_TYPES[k].size && !ENEMY_TYPES[k].pair);
      const e = s.enemies.spawn(ids[Math.floor(Math.random() * ids.length)], s.rooms.W / 2, s.rooms.H / 2 - 120);
      if (e) { s.makeChampion(e); s.startBar('champion', [e], 'Champion ' + e.def.name); }
    }, '#8d6e00', x + 70); y += 20;
    B(y, 'Arena', () => { this.clear(); s.startArena(); }, '#37474f');
    B(y, 'God: ' + (GAME_CONFIG.debug.god ? 'ON' : 'OFF'), () => { GAME_CONFIG.debug.god = !GAME_CONFIG.debug.god; this.build(); }, GAME_CONFIG.debug.god ? '#2e7d32' : '#757575', x + 55);
    B(y, '+500', () => { s.team.coins += 500; }, '#8d6e00', x + 125); y += 20;
    B(y, 'Lvl −', () => this.setLevel(s.level - 1));
    T(y + 2, '' + s.level, 12, '#fdf6e3').setX(x + 60);
    B(y, 'Lvl +', () => this.setLevel(s.level + 1), null, x + 80);
    B(y, 'Shop', () => s.openShop({ subtitle: 'Test dungeon shop' }), '#2e7d32', x + 130); y += 20;
    B(y, 'Room: ' + (s.testLayout < ROOM_LAYOUTS.length ? ROOM_LAYOUTS[s.testLayout].name : 'BIG arena (camera)'), () => {
      s.testLayout = (s.testLayout + 1) % (ROOM_LAYOUTS.length + 1); s.startTestRoom(); this.build();
    }, '#37474f'); y += 24;

    // --- gear (player 1) ---
    T(y, 'Gear (click = next)', 12, '#ef9a9a'); y += 18;
    const name = (cat, id) => { const d = Catalog.get(cat, id); return d ? d.name : '-'; };
    const gear = (label, cat, get, set) => {
      B(y, label + ': ' + name(cat, get()), () => { set(this.cycle(Object.keys(Catalog.table(cat)), get())); p.recalcStats(); this.build(); });
      y += 20;
    };
    gear('Weapon', 'weapon', () => p.weapons[p.activeWeapon], (id) => p.setWeapon(p.activeWeapon, id));
    gear('2nd weapon', 'weapon', () => p.weapons[1 - p.activeWeapon], (id) => p.setWeapon(1 - p.activeWeapon, id));
    gear('Armor', 'armor', () => p.armor, (id) => { p.armor = id; });
    gear('Skill Q', 'skill', () => p.skills[0], (id) => { p.skills[0] = id; p.skillCdMs[0] = 0; });
    gear('Skill E', 'skill', () => p.skills[1], (id) => { p.skills[1] = id; p.skillCdMs[1] = 0; });
    gear('Item F', 'consumable', () => p.consumableId, (id) => { p.consumableId = id; p.consumableCount = 5; });
    y += 4;
    B(y, 'Exit to menu', () => s.scene.start('MainMenuScene'), '#c62828');
    // children need it too, or their clicks are tested against the scrolled world
    for (let i = 0; i < root.list.length; i++) root.list[i].setScrollFactor(0);
  }

  spawn(id) {
    const s = this.scene;
    for (let i = 0; i < this.count; i++) {
      if (!s.rooms.randomSpawnPoint(s.players, 180, s._pt)) return;
      s.enemies.queueSpawn(id, s._pt.x, s._pt.y, 350 + i * 120);
    }
  }

  clear() {
    const s = this.scene;
    s.enemies.clearAll(); s.chains.clear(); s.hazards.clear(); s.minorWorms.clearWorms();
    s.enemyBullets.killAll(); s.allies.killAll();
    if (s.boss.active || s.room.type === 'boss') s.startTestRoom();
  }

  setLevel(n) {
    const s = this.scene;
    s.level = Math.max(1, Math.min(30, n));
    s.enemies.setLevel(s.level, GAME_CONFIG.levels);
    s.minorWorms.startMinor('smallWorm', s.enemies.hpMul, s.enemies.dmgMul, s.players.length, s.wormCallbacks());
    this.build();
  }
}
