/* debug.js
   DebugMenu: opened by typing "debug" on the weapon select screen. Changes
   GAME_CONFIG.debug for this session only (reloading the page resets it).
   TestPanel: the side menu inside the Test Dungeon (an empty room where you
   spawn enemies and swap gear). Three tabs: Spawn · Gear · Room. [T] hides/shows it.
   GearPicker: a big list to pick a weapon / armor / skill / item for one slot,
   filtered by class and subclass.
   In the Test Dungeon you never get a game over: you get back up with the same gear,
   and your test gear is remembered until the page is reloaded (GAME_CONFIG.debug.testLoadout).
   Nothing here runs during a normal run. */

const DEBUG_COLORS = {
  panel: 0x231d19, panelEdge: 0x6d4c41, ink: '#fdf6e3', quiet: '#bcaaa4', head: '#ffcc80', red: '#ef9a9a',
  btn: '#4e3f33', btnHot: '#8d6e63', on: '#2e7d32', off: '#616161', boss: '#6a1b9a', gold: '#8d6e00', danger: '#c62828'
};
const CLASS_LABELS = { melee: 'Melee', precision: 'Precision', arcane: 'Arcane', boss: 'Boss loot', any: 'Anyone' };

// Every stage in run order, e.g. [{id:'notebook', idx:0}, {id:'sewer', idx:1}, {id:'castle', idx:1}, {id:'necrotery', idx:2}]
function debugSections() {
  const out = [];
  for (let i = 0; i < RUN_PLAN.stages.length; i++) for (let k = 0; k < RUN_PLAN.stages[i].length; k++) out.push({ id: RUN_PLAN.stages[i][k], idx: i });
  return out;
}

const DebugUI = {
  // A clickable text "button". Returns the Text object.
  button(scene, root, x, y, label, size, onClick, color, bg, width) {
    const t = scene.add.text(x, y, label, {
      fontFamily: 'Arial, sans-serif', fontSize: size + 'px', color: color || DEBUG_COLORS.ink,
      backgroundColor: bg || DEBUG_COLORS.btn, padding: { x: 6, y: 3 }
    });
    if (width) t.setFixedSize(width, 0);
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
  },
  stars(d) { return d.bossItem ? '◆' : '★'.repeat((d.postBoss || 0) + 1); }
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
    const pw = 900, ph = 590, px = W / 2 - pw / 2, py = H / 2 - ph / 2;
    const g = sc.add.graphics();
    g.fillStyle(0xfdf6e3, 1); g.fillRoundedRect(px, py, pw, ph, 10);
    g.lineStyle(3, 0xc62828, 0.8); g.strokeRoundedRect(px, py, pw, ph, 10);
    g.lineStyle(1, 0x8d6e63, 0.3); g.lineBetween(px + 450, py + 80, px + 450, py + ph - 70);
    root.add(g);
    const T = (x, y, s, size, color, bold) => DebugUI.text(sc, root, x, y, s, size, color, bold);
    const B = (x, y, s, fn, bg) => DebugUI.button(sc, root, x, y, s, 15, fn, null, bg);
    T(px + 20, py + 14, 'DEBUG MENU', 24, '#c62828', true);
    T(px + 20, py + 46, 'Settings last until the page is reloaded. Then pick a weapon to start (or open the Test Dungeon).', 12, '#8d6e63');

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
    // Section: which stage the run starts in (Auto = the one Start level falls in)
    const secs = debugSections();
    const cur = d.startSection ? STAGE_TYPES[d.startSection].name : 'Auto (from Start level)';
    T(cx, y + 3, 'Start section', 16, null, true);
    B(cx + 140, y, ' ' + cur + ' ▸ ', () => {
      const ids = [null].concat(secs.map((s) => s.id));
      d.startSection = ids[(ids.indexOf(d.startSection || null) + 1) % ids.length];
      if (d.startSection) {                       // jump Start level to that section's first level
        const lps = RUN_PLAN.steps.filter((s) => s === 'level').length, sec = secs.find((s) => s.id === d.startSection);
        d.startLevel = sec.idx * lps + 1;
      }
      this.build();
    }, '#4a148c');
    y += 34;
    num('Start level', () => d.startLevel, (v) => { d.startLevel = v; d.startSection = null; }, 1, 1, 30);
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
    B(cx + 135, y, 'Forget test gear', () => { d.testLoadout = null; this.note('Test Dungeon gear reset.'); }, '#6d4c41');
    this.noteText = T(cx, y + 40, '', 13, '#2e7d32', true);

    B(px + 20, py + ph - 52, '  TEST DUNGEON  ', () => this.onTestDungeon(), '#c62828').setFontSize(18);
    T(px + 210, py + ph - 44, 'Test gear stays on, even after you die there.', 12, '#8d6e63');
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
    this.tab = 'spawn';
    this.filter = 'section';   // spawn list: 'section' = this section's enemies, 'all' = every enemy
    this.w = 228;
    this.x = GAME_CONFIG.width - this.w;
    this.picker = null;
    this.build();
    scene.input.keyboard.on('keydown-T', () => this.toggle());
  }

  toggle() {
    this.visible = !this.visible;
    this.root.setVisible(this.visible);
  }

  // Is the mouse over one of the panel's buttons (or the gear picker)? Then clicks don't attack.
  contains(ptr) {
    if (this.picker) return true;
    if (!this.visible) return false;
    const hits = this.scene.input.hitTestPointer(ptr);
    for (let i = 0; i < hits.length; i++) if (hits[i].parentContainer === this.root) return true;
    return false;
  }

  build() {
    if (this.root) this.root.destroy(true);
    const sc = this.scene, H = GAME_CONFIG.height, x = this.x, w = this.w, C = DEBUG_COLORS;
    const root = sc.add.container(0, 0).setDepth(260).setVisible(this.visible).setScrollFactor(0);
    this.root = root;
    const bg = sc.add.graphics();
    bg.fillStyle(C.panel, 0.92); bg.fillRect(x, 0, w, H);
    bg.lineStyle(2, C.panelEdge, 1); bg.lineBetween(x + 1, 0, x + 1, H);
    root.add(bg);
    const hit = sc.add.rectangle(x + w / 2, H / 2, w, H, 0, 0.001).setInteractive();
    root.add(hit);
    this.T = (xx, yy, s, size, color, bold) => DebugUI.text(sc, root, xx, yy, s, size, color || C.ink, bold !== false);
    this.B = (xx, yy, s, fn, bgc, width, size) => DebugUI.button(sc, root, xx, yy, s, size || 12, fn, null, bgc, width);

    // header + tabs
    const sec = STAGE_TYPES[sc.testStage || 'notebook'];
    this.T(x + 10, 8, 'TEST DUNGEON', 14, C.head);
    this.T(x + w - 10, 10, '[T] hide', 11, C.quiet, false).setOrigin(1, 0);
    this.T(x + 10, 28, sec.name + '  ·  Level ' + sc.level, 11, C.quiet, false);
    const tabs = [['spawn', 'Spawn'], ['gear', 'Gear'], ['room', 'Room']];
    for (let i = 0; i < tabs.length; i++) {
      const on = this.tab === tabs[i][0];
      this.B(x + 8 + i * 72, 48, tabs[i][1], () => { this.tab = tabs[i][0]; this.build(); }, on ? '#a1887f' : C.btn, 66, 13).setColor(on ? '#231d19' : C.ink);
    }
    let y = 82;
    if (this.tab === 'spawn') y = this.buildSpawn(y);
    else if (this.tab === 'gear') y = this.buildGear(y);
    else y = this.buildRoom(y);
    // children need it too, or their clicks are tested against the scrolled world
    for (let i = 0; i < root.list.length; i++) root.list[i].setScrollFactor(0);
  }

  head(y, s) { this.T(this.x + 10, y, s, 12, DEBUG_COLORS.red); return y + 18; }

  buildSpawn(y) {
    const sc = this.scene, x = this.x, C = DEBUG_COLORS, B = this.B;
    // filter + how many
    B(x + 8, y, this.filter === 'section' ? 'This section' : 'All enemies', () => { this.filter = this.filter === 'section' ? 'all' : 'section'; this.build(); }, '#4a148c', 104);
    B(x + 118, y, '×' + this.count, () => { this.count = this.count === 1 ? 3 : this.count === 3 ? 5 : 1; this.build(); }, '#6d4c41', 44);
    B(x + 168, y, 'Clear', () => this.clear(), '#37474f', 50);
    y += 26;
    // enemies
    const pool = (STAGE_TYPES[sc.testStage || 'notebook'].enemies || []);
    const ids = [];
    for (const id in ENEMY_TYPES) {
      const def = ENEMY_TYPES[id];
      if (!def.ai && !def.pair && !def.worm) continue;
      if (def.boss || def.bossPart || def.miniBoss) continue;
      if (id === 'prisoner') continue;
      if (this.filter === 'section' && pool.indexOf(id) === -1 && !(id === 'prisoners' && pool.indexOf('prisoners') !== -1)) continue;
      ids.push(id);
    }
    y = this.head(y, 'Enemies (' + ids.length + ')');
    let col = 0;
    for (let i = 0; i < ids.length; i++) {
      const id = ids[i], def = ENEMY_TYPES[id];
      let label = (def.elite ? '★ ' : '') + (def.pair ? 'Prisoners (2)' : def.name);
      if (label.length > 17) label = label.slice(0, 16) + '.';
      B(x + 8 + col * 106, y, label, () => this.spawn(id), def.postBoss ? '#5d4037' : C.btn, 102, 11);
      col++;
      if (col === 2) { col = 0; y += 21; }
      if (y > 470) { this.T(x + 10, y + 2, '…more under "All enemies" / other sections', 10, C.quiet, false); y += 16; break; }
    }
    if (col) y += 21;
    y += 6;
    // bosses + mini-bosses
    y = this.head(y, 'Bosses');
    const bosses = ['bookworm'].concat(Object.keys(ENEMY_TYPES).filter((k) => ENEMY_TYPES[k].boss));
    col = 0;
    for (let i = 0; i < bosses.length; i++) {
      const id = bosses[i], name = id === 'bookworm' ? 'Bookworm' : ENEMY_TYPES[id].name.replace(/^The /, '');
      B(x + 8 + col * 106, y, name, () => { this.clear(); sc.startBoss(id); this.build(); }, C.boss, 102, 11);
      col++;
      if (col === 2) { col = 0; y += 21; }
    }
    if (col) y += 21;
    B(x + 8, y, 'Mimic', () => { const e = sc.enemies.spawn('mimic', sc.rooms.W / 2, sc.rooms.H / 2 - 100); if (e) sc.startBar('mimic', [e], 'Mimic'); }, '#6d4c41', 102, 11);
    B(x + 114, y, 'Champion', () => {
      const pool2 = pool.filter((k) => ENEMY_TYPES[k] && ENEMY_TYPES[k].weight && ENEMY_TYPES[k].size && !ENEMY_TYPES[k].pair && !ENEMY_TYPES[k].unique);
      const list = pool2.length ? pool2 : Object.keys(ENEMY_TYPES).filter((k) => ENEMY_TYPES[k].weight && ENEMY_TYPES[k].size && !ENEMY_TYPES[k].pair);
      const e = sc.enemies.spawn(list[Math.floor(Math.random() * list.length)], sc.rooms.W / 2, sc.rooms.H / 2 - 120);
      if (e) { sc.makeChampion(e); sc.startBar('champion', [e], 'Champion ' + e.def.name); }
    }, C.gold, 102, 11);
    return y + 24;
  }

  buildGear(y) {
    const sc = this.scene, x = this.x, C = DEBUG_COLORS, p = sc.players[0];
    y = this.head(y, 'Player 1 · click a slot to pick');
    const name = (cat, id) => { const d = id && Catalog.get(cat, id); return d ? DebugUI.stars(d) + ' ' + d.name : '— empty —'; };
    const slots = [
      ['Weapon 1', 'weapon', 0], ['Weapon 2', 'weapon', 1], ['Armor', 'armor', 0],
      ['Skill 1', 'skill', 0], ['Skill 2', 'skill', 1], ['Item', 'consumable', 0]
    ];
    for (let i = 0; i < slots.length; i++) {
      const [label, cat, slot] = slots[i];
      const cur = cat === 'weapon' ? p.weapons[slot] : cat === 'armor' ? p.armor : cat === 'skill' ? p.skills[slot] : p.consumableId;
      this.T(x + 10, y, label, 11, C.quiet, false);
      let nm = name(cat, cur);
      if (nm.length > 27) nm = nm.slice(0, 26) + '.';
      this.B(x + 8, y + 15, nm, () => this.openPicker(cat, slot, label), cat === 'weapon' && slot === p.activeWeapon ? '#5d4037' : C.btn, w(this) - 16, 12);
      y += 44;
    }
    function w(t) { return t.w; }
    y += 4;
    this.B(x + 8, y, 'Refill: HP, mana, cooldowns, items', () => {
      p.hp = p.stats.maxHp; p.mana = p.stats.maxMana; p.skillCdMs[0] = 0; p.skillCdMs[1] = 0; if (p.consumableId) p.consumableCount = Math.max(p.consumableCount, 5);
    }, '#1565c0', this.w - 16, 11);
    y += 28;
    this.T(x + 10, y, 'Your test gear stays on after you die\nhere and next time you open the\nTest Dungeon (until page reload).', 10, C.quiet, false);
    return y + 48;
  }

  buildRoom(y) {
    const sc = this.scene, x = this.x, C = DEBUG_COLORS, B = this.B, d = GAME_CONFIG.debug;
    y = this.head(y, 'Section (look + enemies)');
    const secs = debugSections();
    for (let i = 0; i < secs.length; i++) {
      const id = secs[i].id, on = (sc.testStage || 'notebook') === id;
      B(x + 8 + (i % 2) * 106, y, STAGE_TYPES[id].name.replace(/^The /, ''), () => this.setSection(id), on ? '#4a148c' : C.btn, 102, 11);
      if (i % 2 === 1) y += 21;
    }
    if (secs.length % 2) y += 21;
    y += 6;
    y = this.head(y, 'Room');
    B(x + 8, y, 'Layout: ' + (sc.testLayout < ROOM_LAYOUTS.length ? ROOM_LAYOUTS[sc.testLayout].name : 'BIG arena'), () => {
      sc.testLayout = (sc.testLayout + 1) % (ROOM_LAYOUTS.length + 1); sc.startTestRoom(); this.build();
    }, C.btn, this.w - 16, 11);
    y += 22;
    B(x + 8, y, 'Dark: ' + (sc.testDark ? 'ON' : 'OFF'), () => { sc.testDark = !sc.testDark; sc.startTestRoom(); this.build(); }, sc.testDark ? '#4a148c' : C.off, 102, 11);
    B(x + 114, y, 'Survival arena', () => { this.clear(); sc.startArena(); }, '#37474f', 102, 11);
    y += 28;
    y = this.head(y, 'Difficulty');
    B(x + 8, y, ' − ', () => this.setLevel(sc.level - 1), C.btn, 30, 12);
    this.T(x + 60, y + 3, 'Level ' + sc.level, 12, C.ink).setOrigin(0.5, 0).setX(x + 72);
    B(x + 108, y, ' + ', () => this.setLevel(sc.level + 1), C.btn, 30, 12);
    y += 26;
    B(x + 8, y, 'God: ' + (d.god ? 'ON' : 'OFF'), () => { d.god = !d.god; this.build(); }, d.god ? C.on : C.off, 102, 11);
    B(x + 114, y, '+500 coins', () => { sc.team.coins += 500; }, C.gold, 102, 11);
    y += 28;
    y = this.head(y, 'Other');
    B(x + 8, y, 'Open shop', () => sc.openShop({ subtitle: 'Test dungeon shop' }), C.on, 102, 11);
    B(x + 114, y, 'Exit to menu', () => sc.scene.start('MainMenuScene'), C.danger, 102, 11);
    return y + 24;
  }

  /* ---- actions ---- */
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

  // A section = its floor / walls / darkness + its enemies in the Spawn list; the level jumps to its first level.
  setSection(id) {
    const s = this.scene, sec = debugSections().find((q) => q.id === id);
    s.testStage = id;
    s.testDark = !!STAGE_TYPES[id].look.dark;
    const lps = RUN_PLAN.steps.filter((q) => q === 'level').length;
    this.clear();
    s.applyStage();
    this.setLevel(sec.idx * lps + 1);
    s.startTestRoom();
    GAME_CONFIG.debug.testSection = id;            // remembered for the next Test Dungeon
    this.build();
  }

  /* ---- gear ---- */
  openPicker(cat, slot, label) {
    if (this.picker) this.picker.close();
    this.picker = new GearPicker(this.scene, cat, slot, label, () => { this.picker = null; this.build(); });
  }

  // The current gear of player 1 → remembered for this session (only the Test Dungeon uses it).
  static saveLoadout(p) {
    GAME_CONFIG.debug.testLoadout = { weapons: p.weapons.slice(), armor: p.armor, skills: p.skills.slice(), consumableId: p.consumableId, consumableCount: p.consumableCount };
  }
  static applyLoadout(p, L) {
    if (!L) return;
    for (let i = 0; i < L.weapons.length; i++) if (L.weapons[i] && Catalog.get('weapon', L.weapons[i])) p.setWeapon(i, L.weapons[i]);
    p.armor = L.armor && Catalog.get('armor', L.armor) ? L.armor : null;
    for (let i = 0; i < L.skills.length; i++) p.skills[i] = L.skills[i] && Catalog.get('skill', L.skills[i]) ? L.skills[i] : null;
    p.consumableId = L.consumableId && Catalog.get('consumable', L.consumableId) ? L.consumableId : null;
    p.consumableCount = p.consumableId ? Math.max(1, L.consumableCount || 1) : 0;
    p.recalcStats();
    p.hp = p.stats.maxHp; p.mana = p.stats.maxMana;
  }
}

/* ---------------- Gear picker (Test Dungeon) ---------------- */
class GearPicker {
  constructor(scene, cat, slot, label, onClose) {
    this.scene = scene; this.cat = cat; this.slot = slot; this.label = label; this.onClose = onClose;
    this.cls = 'all'; this.sub = 'all'; this.page = 0;
    this.prevMode = scene.mode;
    scene.mode = 'debugPick';                       // the game waits while you pick
    this.build();
  }

  items() {
    const t = Catalog.table(this.cat), out = [];
    for (const id in t) {
      const d = t[id];
      const c = d.class || 'any';
      if (this.cls !== 'all' && c !== this.cls) continue;
      if (this.sub !== 'all' && d.sub !== this.sub) continue;
      out.push({ id: id, d: d });
    }
    const order = { melee: 0, precision: 1, arcane: 2, boss: 3, any: 4 };
    out.sort((a, b) => (order[a.d.class || 'any'] - order[b.d.class || 'any']) || String(a.d.sub || '').localeCompare(String(b.d.sub || '')) ||
                       ((a.d.postBoss || 0) - (b.d.postBoss || 0)) || ((a.d.price || 0) - (b.d.price || 0)));
    return out;
  }

  build() {
    if (this.root) this.root.destroy(true);
    const sc = this.scene, W = GAME_CONFIG.width, H = GAME_CONFIG.height, C = DEBUG_COLORS;
    const root = sc.add.container(0, 0).setDepth(520).setScrollFactor(0);
    this.root = root;
    const dim = sc.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.55).setInteractive();
    dim.on('pointerdown', (ptr, lx, ly, ev) => { if (ev) ev.stopPropagation(); this.close(); });
    root.add(dim);
    const pw = 700, ph = 560, px = (W - pw) / 2, py = (H - ph) / 2;
    const card = sc.add.rectangle(W / 2, H / 2, pw, ph, 0x2b2420, 1).setStrokeStyle(2, 0xa1887f).setInteractive();
    card.on('pointerdown', (ptr, lx, ly, ev) => { if (ev) ev.stopPropagation(); });
    root.add(card);
    const T = (x, y, s, size, color, bold) => DebugUI.text(sc, root, x, y, s, size, color || C.ink, bold);
    const B = (x, y, s, fn, bg, width, size) => DebugUI.button(sc, root, x, y, s, size || 12, fn, null, bg, width);
    const catName = { weapon: 'weapon', armor: 'armor', skill: 'skill', consumable: 'item' }[this.cat];
    T(px + 18, py + 14, 'Pick a ' + catName + ' for ' + this.label, 18, C.head, true);
    B(px + pw - 44, py + 12, ' ✕ ', () => this.close(), C.danger, 0, 14);

    // class filter
    let x = px + 18, y = py + 50;
    const classes = ['all', 'melee', 'precision', 'arcane', 'boss', 'any'].filter((c) => c === 'all' || this.hasClass(c));
    for (let i = 0; i < classes.length; i++) {
      const c = classes[i], on = this.cls === c;
      const b = B(x, y, c === 'all' ? 'All' : CLASS_LABELS[c], () => { this.cls = c; this.sub = 'all'; this.page = 0; this.build(); }, on ? '#a1887f' : C.btn, 0, 13);
      if (on) b.setColor('#231d19');
      x += b.width + 6;
    }
    // subclass filter
    x = px + 18; y += 30;
    if (this.cls !== 'all') {
      const subs = [];
      const t = Catalog.table(this.cat);
      for (const id in t) { const d = t[id]; if ((d.class || 'any') === this.cls && d.sub && subs.indexOf(d.sub) === -1) subs.push(d.sub); }
      subs.sort();
      const list = ['all'].concat(subs);
      for (let i = 0; i < list.length; i++) {
        const s = list[i], on = this.sub === s;
        const b = B(x, y, s === 'all' ? 'Every subclass' : s, () => { this.sub = s; this.page = 0; this.build(); }, on ? '#6d4c41' : '#3e322a', 0, 11);
        x += b.width + 5;
        if (x > px + pw - 90 && i < list.length - 1) { x = px + 18; y += 24; }
      }
    }
    y += 32;
    // the list
    const items = this.items(), perCol = 15, cols = 3, per = perCol * cols, pages = Math.max(1, Math.ceil(items.length / per));
    this.page = Math.min(this.page, pages - 1);
    const p = sc.players[0];
    const cur = this.cat === 'weapon' ? p.weapons[this.slot] : this.cat === 'armor' ? p.armor : this.cat === 'skill' ? p.skills[this.slot] : p.consumableId;
    const colW = (pw - 36 - 2 * 8) / cols;
    const top = y;
    for (let i = 0; i < per; i++) {
      const it = items[this.page * per + i];
      if (!it) break;
      const c = Math.floor(i / perCol), r = i % perCol;
      let label = DebugUI.stars(it.d) + ' ' + it.d.name;
      if (label.length > 27) label = label.slice(0, 26) + '.';
      const color = { melee: '#5d2f28', precision: '#2e4a2c', arcane: '#2f3557', boss: '#4a2a5a' }[it.d.class] || '#4e3f33';
      const b = B(px + 18 + c * (colW + 8), top + r * 25, label, () => this.pick(it.id), it.id === cur ? '#a1887f' : color, colW, 12);
      if (it.id === cur) b.setColor('#231d19');
      if (it.d.debugOnly) b.setAlpha(0.7);
    }
    if (!items.length) T(px + 18, top, 'Nothing here.', 13, C.quiet);
    // footer
    const fy = py + ph - 40;
    T(px + 18, fy + 4, items.length + ' to pick from  ·  ★ tier, ◆ boss loot  ·  colour = class', 11, C.quiet);
    if (this.cat !== 'weapon' || this.slot === 1) B(px + pw - 250, fy, 'Empty slot', () => this.pick(null), '#37474f', 0, 12);
    if (pages > 1) {
      B(px + pw - 150, fy, ' ◀ ', () => { this.page = (this.page + pages - 1) % pages; this.build(); }, C.btn, 0, 12);
      T(px + pw - 98, fy + 3, (this.page + 1) + '/' + pages, 12, C.ink).setOrigin(0.5, 0);
      B(px + pw - 72, fy, ' ▶ ', () => { this.page = (this.page + 1) % pages; this.build(); }, C.btn, 0, 12);
    }
  }

  hasClass(c) { const t = Catalog.table(this.cat); for (const id in t) if ((t[id].class || 'any') === c) return true; return false; }

  pick(id) {
    const p = this.scene.players[0];
    if (this.cat === 'weapon') { p.setWeapon(this.slot, id || null); }
    else if (this.cat === 'armor') p.armor = id;
    else if (this.cat === 'skill') { p.skills[this.slot] = id; p.skillCdMs[this.slot] = 0; }
    else { p.consumableId = id; p.consumableCount = id ? 5 : 0; }
    p.recalcStats();
    TestPanel.saveLoadout(p);
    this.close();
  }

  close() {
    if (this.root) { this.root.destroy(true); this.root = null; }
    if (this.scene.mode === 'debugPick') this.scene.mode = this.prevMode === 'debugPick' ? 'play' : (this.prevMode || 'play');
    if (this.onClose) { const f = this.onClose; this.onClose = null; f(); }
  }
}
