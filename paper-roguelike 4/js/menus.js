/* menus.js
   Out-of-run screens: MainMenuScene ("PaperGame"), PencilCaseScene (unlocked
   kits; permanent upgrades later) and WeaponSelectScene (choose a basic
   starter or an unlocked kit). MenuUI = small drawing helpers.
   Typing "debug" on the main menu or the start select opens the DebugMenu. */

const MenuUI = {
  text(scene, root, x, y, str, size, color, bold) {
    const t = scene.add.text(x, y, str, { fontFamily: 'Arial, sans-serif', fontSize: size + 'px',
      color: color || '#37474f', fontStyle: bold ? 'bold' : 'normal', lineSpacing: 3 });
    if (root) root.add(t);
    return t;
  },
  button(scene, root, x, y, label, onClick, bg, size) {
    const t = scene.add.text(x, y, label, { fontFamily: 'Arial, sans-serif', fontSize: (size || 16) + 'px',
      color: '#fdf6e3', backgroundColor: bg || '#37474f', padding: { x: 8, y: 5 }, fontStyle: 'bold' });
    t.setInteractive({ useHandCursor: true });
    t.on('pointerover', () => t.setAlpha(0.82));
    t.on('pointerout', () => t.setAlpha(1));
    t.on('pointerup', touchHoldGuard(onClick));     // (phones: a hold to read is not a click)
    if (root) root.add(t);
    return t;
  },
  // Notebook paper: blue lines + red margin
  paper(scene) {
    const W = GAME_CONFIG.width, H = GAME_CONFIG.height, c = GAME_CONFIG.colors;
    const g = scene.add.graphics();
    g.lineStyle(1, c.gridLine, 0.6);
    for (let y = 40; y < H; y += 32) g.lineBetween(0, y, W, y);
    g.lineStyle(2, c.marginLine, 0.7);
    g.lineBetween(112, 0, 112, H);
    return g;
  },
  // Simple drawings of starter weapons (s = scale)
  weaponIcon(scene, root, id, x, y, s) {
    s = s || 1;
    const g = scene.add.graphics();
    if (root) root.add(g);
    const ink = GAME_CONFIG.colors.ink, q = (v) => v * s;
    if (id === 'bow') {
      g.lineStyle(q(5), 0x8d6e63, 1);
      g.beginPath(); g.arc(x - q(10), y, q(34), -1.1, 1.1); g.strokePath();
      g.lineStyle(1, ink, 1);
      g.lineBetween(x - q(10) + q(34) * Math.cos(-1.1), y + q(34) * Math.sin(-1.1), x - q(10) + q(34) * Math.cos(1.1), y + q(34) * Math.sin(1.1));
      g.lineStyle(2, ink, 1); g.lineBetween(x - q(5), y, x + q(34), y);
      g.fillStyle(ink, 1); g.fillTriangle(x + q(30), y - q(5), x + q(40), y, x + q(30), y + q(5));
    } else if (id === 'sword' || id === 'hunterKnife') {
      const L = id === 'sword' ? 52 : 30;
      g.fillStyle(0xb0bec5, 1); g.fillRect(x - q(4), y - q(L - 14), q(8), q(L));
      g.fillStyle(0x8d6e63, 1); g.fillRect(x - q(16), y + q(14), q(32), q(6)); g.fillRect(x - q(3), y + q(20), q(6), q(16));
      g.lineStyle(2, ink, 1); g.strokeRect(x - q(4), y - q(L - 14), q(8), q(L));
    } else if (id === 'wand') {
      g.lineStyle(q(5), 0x8d6e63, 1); g.lineBetween(x - q(22), y + q(30), x + q(10), y - q(12));
      g.fillStyle(0xd1b3ff, 1); g.fillCircle(x + q(14), y - q(17), q(7));
      g.lineStyle(2, GAME_CONFIG.colors.arcane, 1); g.strokeCircle(x + q(14), y - q(17), q(7));
    } else if (id === 'pickaxe') {
      g.lineStyle(q(5), 0x8d6e63, 1); g.lineBetween(x - q(18), y + q(30), x + q(8), y - q(14));
      g.lineStyle(q(6), 0x90a4ae, 1);
      g.beginPath(); g.arc(x + q(12), y + q(2), q(26), -2.2, -0.75); g.strokePath();
    } else if (id === 'martialScroll1') {
      g.fillStyle(0xffcc80, 1); g.fillRoundedRect(x - q(18), y - q(16), q(36), q(30), q(8));
      g.lineStyle(2, 0xe65100, 1); g.strokeRoundedRect(x - q(18), y - q(16), q(36), q(30), q(8));
      for (let k = 0; k < 3; k++) g.lineBetween(x - q(10) + k * q(10), y - q(16), x - q(10) + k * q(10), y - q(4));
    } else {
      g.fillStyle(0x8d6e63, 1); g.fillCircle(x, y, q(16));
    }
    return g;
  },
  // A little armor shirt in the class color
  armorIcon(scene, root, x, y, color) {
    const g = scene.add.graphics();
    if (root) root.add(g);
    g.fillStyle(color, 1);
    g.fillRect(x - 12, y - 10, 24, 26);
    g.fillTriangle(x - 12, y - 10, x - 22, y, x - 12, y + 4);
    g.fillTriangle(x + 12, y - 10, x + 22, y, x + 12, y + 4);
    g.lineStyle(2, 0x37474f, 0.8); g.strokeRect(x - 12, y - 10, 24, 26);
    return g;
  },
  hexColor(str) { return Phaser.Display.Color.HexStringToColor(str).color; }
};

// Typing "debug" opens the debug menu (main menu and start select).
const DebugHotkey = {
  attach(scene) {
    scene.typed = '';
    scene.debugMenu = null;
    scene.input.keyboard.on('keydown', (ev) => {
      if (ev.key && ev.key.length === 1) scene.typed = (scene.typed + ev.key.toLowerCase()).slice(-5);
      if (scene.typed === 'debug' && !scene.debugMenu) {
        scene.typed = '';
        scene.debugMenu = new DebugMenu(scene,
          () => scene.scene.start('GameScene', { weapons: ['bow'], test: true }),
          () => { scene.debugMenu = null; scene.scene.restart(); });   // restart = show changed save data
      }
    });
  }
};

/* ---------------- Main menu ---------------- */
class MainMenuScene extends Phaser.Scene {
  constructor() { super('MainMenuScene'); }

  create() {
    const W = GAME_CONFIG.width, H = GAME_CONFIG.height;
    this.input.setDefaultCursor('default');
    SaveData.flush();
    MenuUI.paper(this);

    // title with a pencil scribble under it
    MenuUI.text(this, null, W / 2, 120, 'PaperGame', 84, '#37474f', true).setOrigin(0.5);
    const g = this.add.graphics();
    g.lineStyle(4, 0xc62828, 0.8);
    g.beginPath(); g.moveTo(W / 2 - 220, 172);
    for (let i = 1; i <= 22; i++) g.lineTo(W / 2 - 220 + i * 20, 172 + (i % 2 ? 5 : -3));
    g.strokePath();
    this.drawPencil(g, W / 2 + 250, 158);

    const B = (y, label, fn, bg) => MenuUI.button(this, null, W / 2, y, label, fn, bg, 26).setOrigin(0.5).setPadding(26, 10);
    B(265, '   Play   ', () => this.scene.start('WeaponSelectScene', { players: 1 }), '#2e7d32');
    B(345, ' Pencil Case ', () => this.scene.start('PencilCaseScene'), '#5d4037');
    B(425, '  Bestiary  ', () => this.scene.start('BestiaryScene'), '#37474f');
    if (IS_TOUCH) MenuUI.button(this, null, W - 190, 20, ' Touch layout ', () => this.scene.start('TouchLayoutScene', { back: 'MainMenuScene' }), '#37474f', 16);
    else MenuUI.button(this, null, W - 150, 20, ' Controls ', () => this.scene.start('ControlsScene', { back: 'MainMenuScene' }), '#37474f', 16);

    // save file (for lab PCs that wipe the browser)
    const st = SaveData.data.stats;
    MenuUI.text(this, null, W / 2, 500, 'Runs: ' + st.runs + '   ·   Best level: ' + st.bestLevel, 15, '#8d6e63').setOrigin(0.5);
    this.msg = MenuUI.text(this, null, W / 2, 600, SaveData.ok ? '' : 'This browser is blocking saves: progress is lost when you close the tab. Use Export save!', 13, '#c62828').setOrigin(0.5);
    MenuUI.button(this, null, W / 2 - 150, 530, 'Export save (file)', () => { SaveData.exportFile(); this.say('Saved to papergame-save.json (check Downloads).'); }, '#6d4c41', 14);
    MenuUI.button(this, null, W / 2 + 10, 530, 'Import save (file)', () => SaveData.importFile((ok, m) => { this.say(m); if (ok) this.time.delayedCall(700, () => this.scene.restart()); }), '#6d4c41', 14);

    DebugHotkey.attach(this);
    this.input.keyboard.on('keydown-ENTER', () => { if (!this.debugMenu) this.scene.start('WeaponSelectScene', { players: 1 }); });
  }

  say(m) { this.msg.setText(m).setColor('#2e7d32'); }

  drawPencil(g, x, y) {
    g.fillStyle(0xffc107, 1); g.fillRect(x, y - 7, 70, 14);
    g.fillStyle(0xf8bbd0, 1); g.fillRect(x + 70, y - 7, 12, 14);
    g.fillStyle(0xe0c097, 1); g.fillTriangle(x, y - 7, x, y + 7, x - 16, y);
    g.fillStyle(0x37474f, 1); g.fillTriangle(x - 10, y - 3, x - 10, y + 3, x - 16, y);
    g.lineStyle(1.5, 0x8d6e00, 1); g.strokeRect(x, y - 7, 70, 14);
  }
}

/* ---------------- Pencil Case (unlocks) ---------------- */
class PencilCaseScene extends Phaser.Scene {
  constructor() { super('PencilCaseScene'); }

  init(data) { this.tab = (data && data.tab) || 'upgrades'; this.msg = (data && data.msg) || ''; }

  create() {
    const W = GAME_CONFIG.width;
    this.input.setDefaultCursor('default');
    MenuUI.paper(this);
    MenuUI.text(this, null, 40, 20, 'Pencil Case', 34, '#37474f', true);
    MenuUI.button(this, null, W - 100, 24, ' Back ', () => this.scene.start('MainMenuScene'));
    this.input.keyboard.on('keydown-ESC', () => this.scene.start('MainMenuScene'));
    // shavings (the Pencil Case currency)
    const g = this.add.graphics();
    const sx = W - 330, sy = 30;
    g.fillStyle(0xe0a96d, 1); g.fillTriangle(sx, sy, sx + 18, sy, sx + 9, sy + 18);
    g.fillStyle(0x37474f, 1); g.fillTriangle(sx + 6, sy + 12, sx + 12, sy + 12, sx + 9, sy + 18);
    MenuUI.text(this, null, sx + 26, sy - 2, Meta.shavings() + ' shavings', 20, '#6d4c41', true);

    const tabs = [['upgrades', 'Upgrades', '1'], ['kits', 'Starter kits', '2'], ['blueprints', 'Blueprints', '3']];
    let tx = 40;
    for (let i = 0; i < tabs.length; i++) {
      const on = this.tab === tabs[i][0];
      const b = MenuUI.button(this, null, tx, 72, ' ' + tabs[i][1] + ' ', () => this.scene.restart({ tab: tabs[i][0] }), on ? '#37474f' : '#a1887f', 15);
      tx += b.width + 10;
      this.input.keyboard.on('keydown-' + ['ONE', 'TWO', 'THREE'][i], () => this.scene.restart({ tab: tabs[i][0] }));
    }
    if (this.msg) MenuUI.text(this, null, W - 40, 80, this.msg, 14, '#2e7d32', true).setOrigin(1, 0);

    if (this.tab === 'upgrades') this.drawUpgrades();
    else if (this.tab === 'kits') this.drawKits();
    else this.drawBlueprints();
  }

  drawUpgrades() {
    const W = GAME_CONFIG.width, H = GAME_CONFIG.height;
    const colW = 286, gap = 16, x0 = (W - (colW * 3 + gap * 2)) / 2, cardH = 82, top = 140;
    for (let b = 0; b < UPGRADE_BRANCHES.length; b++) {
      const br = UPGRADE_BRANCHES[b], x = x0 + b * (colW + gap);
      MenuUI.text(this, null, x, top - 26, br.name, 17, br.text, true);
      const ids = Object.keys(UPGRADE_TYPES).filter((id) => UPGRADE_TYPES[id].branch === br.id);
      for (let i = 0; i < ids.length; i++) this.upgradeCard(ids[i], br, x, top + i * (cardH + 7), colW, cardH);
    }
    const spent = Meta.spent();
    MenuUI.text(this, null, x0, H - 26, 'Shavings: clear levels and arenas, beat champions, mimics and bosses, win runs. They are saved right away.', 12, '#8d6e63');
    if (spent > 0) MenuUI.button(this, null, W - 168, 70, ' Refund all (' + spent + ') ', () => {
      const back = Meta.refundAll();
      this.scene.restart({ tab: 'upgrades', msg: back + ' shavings refunded' });
    }, '#8d6e63', 13);
  }

  upgradeCard(id, br, x, y, w, h) {
    const u = UPGRADE_TYPES[id], r = Meta.owned(id), why = Meta.whyNot(id);
    const maxed = r >= u.ranks, locked = why.indexOf('Needs') === 0, canBuy = !why;
    const g = this.add.graphics();
    g.fillStyle(maxed ? 0xf1f8e9 : 0xffffff, locked ? 0.6 : 1); g.fillRoundedRect(x, y, w, h, 6);
    g.fillStyle(br.color, locked ? 0.35 : 1); g.fillRect(x, y + 6, 4, h - 12);
    g.lineStyle(canBuy ? 2 : 1, canBuy ? br.color : 0x37474f, canBuy ? 0.9 : 0.3); g.strokeRoundedRect(x, y, w, h, 6);
    // rank pips
    for (let k = 0; k < u.ranks; k++) {
      g.fillStyle(k < r ? br.color : 0xd7ccc8, 1);
      g.fillCircle(x + w - 14 - (u.ranks - 1 - k) * 14, y + 15, 5);
    }
    const dim = locked ? '#9e9e9e' : null;
    MenuUI.text(this, null, x + 14, y + 6, u.name, 15, dim || '#37474f', true);
    MenuUI.text(this, null, x + 14, y + 27, u.desc(r), 11, dim || '#5d4037').setWordWrapWidth(w - 26);
    let foot, col;
    if (maxed) { foot = 'MAXED'; col = '#2e7d32'; }
    else if (locked) { foot = why; col = '#9e9e9e'; }
    else { foot = 'Rank ' + (r + 1) + ': ' + u.cost[r] + ' shavings'; col = canBuy ? br.text : '#b0a49a'; }
    MenuUI.text(this, null, x + 14, y + h - 19, foot, 12, col, true);
    if (canBuy) {
      const zone = this.add.zone(x, y, w, h).setOrigin(0).setInteractive({ useHandCursor: true });
      zone.on('pointerover', () => g.setAlpha(0.85));
      zone.on('pointerout', () => g.setAlpha(1));
      zone.on('pointerup', touchHoldGuard(() => { if (Meta.buy(id)) this.scene.restart({ tab: 'upgrades', msg: u.name + (u.ranks > 1 ? ' rank ' + (r + 1) : '') + ' bought!' }); }));
    }
  }

  drawKits() {
    const W = GAME_CONFIG.width;
    MenuUI.text(this, null, 40, 118, 'An unlocked kit replaces its basic starter (or is added) when you press Play.', 14, '#8d6e63');
    const ids = Object.keys(KIT_TYPES);
    const gap = 14, cw = Math.min(205, Math.floor((W - 60 - gap * (ids.length - 1)) / ids.length)), ch = 250;
    const x0 = W / 2 - (ids.length * cw + (ids.length - 1) * gap) / 2;
    for (let i = 0; i < ids.length; i++) KitCard.draw(this, null, ids[i], x0 + i * (cw + gap), 160, cw, ch, true);
  }

  drawBlueprints() {
    const W = GAME_CONFIG.width, H = GAME_CONFIG.height;
    MenuUI.text(this, null, 40, 118, 'A found blueprint adds its gear to the shops in every future run.', 14, '#8d6e63');
    const ids = Object.keys(BLUEPRINT_TYPES);
    const cw = 280, ch = 92, gap = 14, cols = 3, x0 = (W - (cw * cols + gap * (cols - 1))) / 2;
    const fromText = { champion: 'champions', mimic: 'mimics', boss: 'bosses', gnome: '???' };
    let found = 0;
    for (let i = 0; i < ids.length; i++) {
      const id = ids[i], bp = BLUEPRINT_TYPES[id], has = SaveData.hasBlueprint(id);
      if (has) found++;
      const x = x0 + (i % cols) * (cw + gap), y = 150 + Math.floor(i / cols) * (ch + gap);
      const g = this.add.graphics();
      g.fillStyle(has ? 0x1565c0 : 0xffffff, has ? 1 : 0.8); g.fillRoundedRect(x, y, cw, ch, 6);
      g.lineStyle(1, 0x1565c0, has ? 1 : 0.35); g.strokeRoundedRect(x, y, cw, ch, 6);
      if (has) {
        g.lineStyle(1, 0xffffff, 0.15);
        for (let gx = x + 10; gx < x + cw; gx += 14) g.lineBetween(gx, y + 2, gx, y + ch - 2);
        MenuUI.text(this, null, x + 12, y + 8, bp.name, 16, '#ffffff', true);
        MenuUI.text(this, null, x + 12, y + 32, 'In shops: ' + Meta.blueprintItems(id).join(', '), 12, '#e3f2fd').setWordWrapWidth(cw - 24);
      } else {
        MenuUI.text(this, null, x + 12, y + 8, '???', 16, '#90a4ae', true);
        const src = bp.from.map((f) => fromText[f] || f).filter((v, k, a) => a.indexOf(v) === k).join(', ');
        MenuUI.text(this, null, x + 12, y + 32, 'Dropped by: ' + src, 12, '#90a4ae').setWordWrapWidth(cw - 24);
      }
    }
    const st = SaveData.data.stats, m = Meta.data();
    MenuUI.text(this, null, 40, H - 70, 'Blueprints found: ' + found + ' / ' + ids.length, 16, '#1565c0', true);
    MenuUI.text(this, null, 40, H - 44, 'Runs: ' + st.runs + '    Wins: ' + (st.wins || 0) + '    Best level: ' + st.bestLevel +
      '    Shavings earned in total: ' + m.total, 14, '#8d6e63');
  }
}

// One kit card (used by the Pencil Case and the start select).
const KitCard = {
  draw(scene, root, kitId, x, y, w, h, showHowTo) {
    const kit = KIT_TYPES[kitId], open = SaveData.hasKit(kitId);
    const col = CLASS_COLORS[kit.class];
    const g = scene.add.graphics(); if (root) root.add(g);
    g.fillStyle(open ? 0xfffaf0 : 0xeeeeee, 1); g.fillRect(x, y, w, h);
    g.lineStyle(open ? 3 : 2, open ? MenuUI.hexColor(col) : 0x9e9e9e, open ? 0.9 : 0.6); g.strokeRect(x, y, w, h);
    g.fillStyle(MenuUI.hexColor(col), open ? 1 : 0.35); g.fillRect(x, y, w, 6);
    const cx = x + w / 2;
    const hide = kit.secret && !open;
    MenuUI.text(scene, root, cx, y + 16, hide ? '??? kit' : kit.name + ' kit', 20, open ? '#37474f' : '#9e9e9e', true).setOrigin(0.5, 0);
    MenuUI.text(scene, root, cx, y + 42, hide ? 'secret' : CLASS_NAMES[kit.class] + ' · ' + kit.sub, 12, open ? col : '#9e9e9e').setOrigin(0.5, 0);
    if (hide) {
      MenuUI.text(scene, root, cx, y + 80, '?', 60, '#bdbdbd', true).setOrigin(0.5, 0);
      MenuUI.text(scene, root, cx, y + 152, Kits.howTo(kitId), 12, '#757575').setOrigin(0.5, 0).setAlign('center').setWordWrapWidth(w - 20);
      return g;
    }
    const wi = MenuUI.weaponIcon(scene, root, kit.weapon, cx - 34, y + 92, 0.7);
    const ai = MenuUI.armorIcon(scene, root, cx + 38, y + 92, MenuUI.hexColor(col));
    if (!open) { wi.setAlpha(0.3); ai.setAlpha(0.3); }
    const wd = WEAPON_TYPES[kit.weapon], ad = ARMOR_TYPES[kit.armor];
    if (open) {
      MenuUI.text(scene, root, cx, y + 130, wd.name + '\n+ ' + ad.name + (kit.skill ? '\n+ ' + SKILL_TYPES[kit.skill].name : ''), 13, '#4e342e', true).setOrigin(0.5, 0).setAlign('center').setWordWrapWidth(w - 16);
      MenuUI.text(scene, root, cx, y + h - 30, 'UNLOCKED', 13, '#2e7d32', true).setOrigin(0.5, 0);
    } else {
      MenuUI.text(scene, root, cx, y + 128, 'LOCKED', 14, '#757575', true).setOrigin(0.5, 0);
      if (showHowTo) MenuUI.text(scene, root, cx, y + 152, Kits.howTo(kitId), 12, '#757575').setOrigin(0.5, 0).setAlign('center').setWordWrapWidth(w - 20);
    }
    return g;
  }
};

/* ---------------- Start select (before every run) ----------------
   One row of starting classes. A basic starter is replaced by its kit once
   that kit is unlocked (Short Bow -> Archer kit, Sword -> Knight kit); kits
   without a basic starter (Monk, Hunter) are added once unlocked. Locked
   kits are not shown here (see the Pencil Case).
   2 players: Player 1 picks (mouse / number keys), then Player 2 (arrows +
   K/L or Enter, or number keys). */
class WeaponSelectScene extends Phaser.Scene {
  constructor() { super('WeaponSelectScene'); }

  init(data) {
    this.playerCount = (data && data.players === 2) ? 2 : 1;
  }

  // The list of starting choices: { weapon, armor, kitId }
  buildOptions() {
    const out = [];
    const starters = Object.keys(WEAPON_TYPES).filter((id) => WEAPON_TYPES[id].starter)
      .sort((a, b) => WEAPON_TYPES[a].starter - WEAPON_TYPES[b].starter);
    const used = {};
    for (let i = 0; i < starters.length; i++) {
      let opt = { weapon: starters[i], armor: null, kitId: null };
      for (const k in KIT_TYPES) {
        if (KIT_TYPES[k].weapon === starters[i] && SaveData.hasKit(k)) { opt = { weapon: starters[i], armor: KIT_TYPES[k].armor, kitId: k }; used[k] = true; break; }
      }
      out.push(opt);
    }
    for (const k in KIT_TYPES) {
      if (used[k] || !SaveData.hasKit(k)) continue;
      out.push({ weapon: KIT_TYPES[k].weapon, armor: KIT_TYPES[k].armor, skill: KIT_TYPES[k].skill || null, kitId: k });
    }
    return out;
  }

  create() {
    const W = GAME_CONFIG.width, H = GAME_CONFIG.height;
    this.chosen = false;
    this.picks = [];
    this.cursor2 = 0;
    this.input.setDefaultCursor('default');
    MenuUI.paper(this);
    this.title = MenuUI.text(this, null, W / 2, 68, '', 30, '#37474f', true).setOrigin(0.5);
    MenuUI.button(this, null, 24, 18, ' ◀ Menu ', () => this.scene.start('MainMenuScene'), '#5d4037', 14);
    // Player count: always visible, starts at 1. Switching restarts the picks.
    const solo = this.playerCount === 1;
    MenuUI.button(this, null, W - 252, 12, ' 1 Player ', () => { if (!solo) this.scene.restart({ players: 1 }); }, solo ? '#2e7d32' : '#9e9e9e', 14);
    MenuUI.button(this, null, W - 150, 12, ' 2 Players ', () => { if (solo) this.scene.restart({ players: 2 }); }, solo ? '#9e9e9e' : '#1565c0', 14);

    this.options = this.buildOptions();
    const n = this.options.length, gap = 18;
    const cw = Math.min(270, Math.floor((W - 60 - gap * (n - 1)) / n)), ch = this.playerCount > 1 ? 370 : 410;
    const x0 = W / 2 - (n * cw + (n - 1) * gap) / 2, y = 100;
    this.cards = [];
    for (let i = 0; i < n; i++) {
      const o = this.options[i], x = x0 + i * (cw + gap);
      const card = this.add.rectangle(x + cw / 2, y + ch / 2, cw, ch, 0xfffaf0).setStrokeStyle(3, GAME_CONFIG.colors.ink, 0.6);
      card.setInteractive({ useHandCursor: true });
      card.on('pointerover', () => { this.hoverIndex = i; this.refresh(); });
      card.on('pointerout', () => { if (this.hoverIndex === i) this.hoverIndex = -1; this.refresh(); });
      card.on('pointerup', touchHoldGuard(() => this.choose(i, this.mouseTurn() ? this.picks.length : 0)));
      this.cards.push(card);
      this.drawOption(o, x, y, cw, ch, i + 1);
    }
    this.marks = this.add.graphics().setDepth(5);
    this.hoverIndex = -1;

    // Controls: one row per player (click to change). Saved for next time.
    this.controls = Controls.fix(SaveData.controlsFor(this.playerCount), this.playerCount);
    const t2 = this.playerCount > 1 ? CONTROL_TYPES[this.controls[1]] : null;
    this.p2Keys = t2 && t2.scheme ? KeyBinds.get(t2.scheme) : null;
    const rowY = y + ch + 14;
    for (let i = 0; i < this.playerCount; i++) {
      const ry = rowY + i * 46;
      const t = CONTROL_TYPES[this.controls[i]];
      MenuUI.text(this, null, 60, ry + 6, (this.playerCount > 1 ? 'P' + (i + 1) + ' ' : '') + 'controls:', 15,
        this.playerCount > 1 ? '#' + PLAYER_CURSOR_COLORS[i].toString(16).padStart(6, '0') : '#37474f', true);
      MenuUI.button(this, null, 175, ry, ' ' + t.name + '  ▸ ', () => {
        this.controls[i] = Controls.next(this.controls, i, this.playerCount);
        SaveData.setControls(this.playerCount, this.controls);
        this.scene.restart({ players: this.playerCount });
      }, '#5d4037', 14);
      let hint = Controls.hint(this.controls[i]);
      if (t.pad !== undefined) {
        const pad = PadBindings.pad(t.pad);
        hint = pad ? 'Found: ' + pad.id.slice(0, 48) + (PadBindings.saved(pad) ? '  (set up)' : '  (not set up yet: use Controller setup)')
                   : 'No controller found: plug it in and press any button on it';
      }
      MenuUI.text(this, null, 175, ry + 30, hint, 11, '#8d6e63');
    }
    MenuUI.button(this, null, W - 190, rowY, ' Controller setup ', () => this.scene.start('PadSetupScene', { back: { players: this.playerCount } }), '#37474f', 14);
    MenuUI.button(this, null, W - 190, rowY + 34, ' Keyboard keys ', () => this.scene.start('ControlsScene', { back: 'WeaponSelectScene', backData: { players: this.playerCount } }), '#37474f', 14);
    // refresh when a controller appears / disappears
    this._padCount = PadBindings.connected().length;
    this.time.addEvent({ delay: 500, loop: true, callback: () => {
      const n = PadBindings.connected().length;
      if (n !== this._padCount && !this.debugMenu && !this.chosen) this.scene.restart({ players: this.playerCount });
    } });

    this.ready = false;
    this.time.delayedCall(250, () => {
      this.ready = true;
      this.input.keyboard.on('keydown', (ev) => {
        if (this.debugMenu) return;
        const k = parseInt(ev.key, 10);
        if (k >= 1 && k <= this.options.length) { this.choose(k - 1, this.picks.length); return; }
        if (this.picks.length !== 1) return;                         // P2's turn: their move keys + attack/dash/Enter (or the mouse)
        const b = this.p2Keys;
        if (!b) return;
        const code = ev.keyCode, has = (a) => b[a].some((k) => Phaser.Input.Keyboard.KeyCodes[k] === code);
        if (has('left') || has('up')) { this.cursor2 = (this.cursor2 + n - 1) % n; this.refresh(); }
        else if (has('right') || has('down')) { this.cursor2 = (this.cursor2 + 1) % n; this.refresh(); }
        else if (has('attack') || has('dash') || ev.key === 'Enter') this.choose(this.cursor2, 1);
      });
    });
    this.input.keyboard.on('keydown-ESC', () => { if (!this.debugMenu) this.scene.start('MainMenuScene'); });
    DebugHotkey.attach(this);
    this.refresh();
  }

  drawOption(o, x, y, cw, ch, num) {
    const cx = x + cw / 2, wd = WEAPON_TYPES[o.weapon];
    MenuUI.text(this, null, x + cw - 26, y + 8, '[' + num + ']', 13, '#8d6e63');
    if (!o.kitId) {
      MenuUI.weaponIcon(this, null, o.weapon, cx, y + 62, 0.85);
      const t = MenuUI.text(this, null, cx, y + 112, wd.name, wd.name.length > 16 ? 17 : 22, '#37474f', true).setOrigin(0.5, 0).setAlign('center').setWordWrapWidth(cw - 16);
      const c = MenuUI.text(this, null, cx, t.y + t.height + 6, Catalog.classLine(wd), 13, CLASS_COLORS[wd.class]).setOrigin(0.5, 0);
      MenuUI.text(this, null, cx, c.y + c.height + 14, wd.desc.replace(/\n/g, ' '), 13, '#4e342e').setOrigin(0.5, 0).setAlign('center').setWordWrapWidth(cw - 24);
      return;
    }
    const kit = KIT_TYPES[o.kitId], ad = ARMOR_TYPES[o.armor], col = CLASS_COLORS[kit.class];
    const g = this.add.graphics();
    g.fillStyle(MenuUI.hexColor(col), 1); g.fillRect(x, y, cw, 6);
    MenuUI.weaponIcon(this, null, o.weapon, cx - 34, y + 62, 0.75);
    MenuUI.armorIcon(this, null, cx + 38, y + 62, MenuUI.hexColor(col));
    MenuUI.text(this, null, cx, y + 106, kit.name, 26, '#37474f', true).setOrigin(0.5, 0);
    MenuUI.text(this, null, cx, y + 140, CLASS_NAMES[kit.class] + ' · ' + kit.sub + ' kit', 13, col, true).setOrigin(0.5, 0);
    const t = MenuUI.text(this, null, cx, y + 166, wd.name + '\n+ ' + ad.name + (o.skill ? '\n+ ' + SKILL_TYPES[o.skill].name : ''), 14, '#37474f', true).setOrigin(0.5, 0).setAlign('center').setWordWrapWidth(cw - 16);
    // narrow cards (4-5 options): only the armor's text, the weapon is the same as its basic starter
    let ty = t.y + t.height + 10;
    if (cw >= 220) { const t2 = MenuUI.text(this, null, cx, ty, wd.desc.replace(/\n/g, ' '), 12, '#4e342e').setOrigin(0.5, 0).setAlign('center').setWordWrapWidth(cw - 24); ty = t2.y + t2.height + 8; }
    MenuUI.text(this, null, cx, ty, ad.desc.replace(/\n/g, ' '), 12, '#5d4037', true).setOrigin(0.5, 0).setAlign('center').setWordWrapWidth(cw - 24);
  }

  // Title, hover frame, "P1"/"P2" marks on picked cards, P2's cursor.
  refresh() {
    const twoP = this.playerCount > 1;
    const who = this.picks.length;
    this.title.setText(twoP ? 'Player ' + (who + 1) + ': choose your start' : 'Choose your start')
      .setColor(twoP ? '#' + PLAYER_CURSOR_COLORS[Math.min(who, 1)].toString(16).padStart(6, '0') : '#37474f');
    for (let i = 0; i < this.cards.length; i++) {
      const hot = (i === this.hoverIndex && who === 0) || (twoP && who === 1 && i === this.cursor2);
      this.cards[i].setStrokeStyle(hot ? 5 : 3, hot ? PLAYER_CURSOR_COLORS[Math.min(who, 1)] : GAME_CONFIG.colors.ink, hot ? 1 : 0.6);
    }
    const g = this.marks;
    g.clear();
    for (let p = 0; p < this.picks.length; p++) {
      const c = this.cards[this.picks[p]];
      g.fillStyle(PLAYER_CURSOR_COLORS[p], 1);
      g.fillRoundedRect(c.x - c.width / 2 + 8 + p * 46, c.y + c.height / 2 - 36, 40, 26, 5);
    }
    if (!this.pickLabels) this.pickLabels = [];
    for (let p = 0; p < 2; p++) {
      if (!this.pickLabels[p]) this.pickLabels[p] = MenuUI.text(this, null, 0, 0, 'P' + (p + 1), 15, '#ffffff', true).setDepth(6).setOrigin(0.5);
      const on = p < this.picks.length;
      this.pickLabels[p].setVisible(on);
      if (on) { const c = this.cards[this.picks[p]]; this.pickLabels[p].setPosition(c.x - c.width / 2 + 28 + p * 46, c.y + c.height / 2 - 23); }
    }
  }

  // i = option index, who = which player is picking (only the player whose turn it is can pick)
  // Is it the turn of a player who uses the mouse? (then a click picks for them)
  mouseTurn() {
    const t = CONTROL_TYPES[this.controls[this.picks.length]];
    return !!(t && t.scheme && KEY_SCHEMES[t.scheme].mouse);
  }

  choose(i, who) {
    if (this.chosen || !this.ready || this.debugMenu) return;
    if (who !== this.picks.length) return;
    this.picks.push(i);
    if (this.picks.length < this.playerCount) { this.cursor2 = i; this.refresh(); return; }
    this.chosen = true;
    const ws = [], as = [], ss = [];
    for (let p = 0; p < this.picks.length; p++) {
      const o = this.options[this.picks[p]];
      ws.push(o.weapon); as.push(o.armor); ss.push(o.skill || null);
    }
    this.scene.start('GameScene', { weapons: ws, armors: as, skills: ss, players: this.playerCount, controls: this.controls });
  }
}

/* ---------------- Controller setup ----------------
   Cheap USB adapters (like PS2 -> USB) number their buttons and sticks in
   strange ways, so instead of guessing we ask: "push the left stick right",
   "press the button you want for Attack"... The result is saved per
   controller model (SaveData.settings.pads). Keyboard: S = skip a step,
   Backspace = redo the last step, Esc = leave. */
class PadSetupScene extends Phaser.Scene {
  constructor() { super('PadSetupScene'); }

  init(data) { this.backData = (data && data.back) || { players: 1 }; }

  create() {
    const W = GAME_CONFIG.width;
    MenuUI.paper(this);
    MenuUI.text(this, null, 40, 22, 'Controller setup', 32, '#37474f', true);
    MenuUI.button(this, null, W - 130, 24, '  Back  ', () => this.leave(), '#37474f');
    this.steps = [
      { kind: 'axis', key: 'moveX', text: 'Push the LEFT stick to the RIGHT' },
      { kind: 'axis', key: 'moveY', text: 'Push the LEFT stick DOWN' },
      { kind: 'axis', key: 'aimX', text: 'Push the RIGHT stick to the RIGHT  (no right stick? press S to skip)' },
      { kind: 'axis', key: 'aimY', text: 'Push the RIGHT stick DOWN  (S to skip)' }
    ];
    for (let i = 0; i < PAD_ACTIONS.length; i++) {
      this.steps.push({ kind: 'button', key: PAD_ACTIONS[i], text: 'Press the button for:  ' + PAD_ACTION_NAMES[PAD_ACTIONS[i]] });
    }
    this.pad = null;          // the controller being set up
    this.index = -1;          // -1 = waiting for "press any button"
    this.map = null;
    this.waitRelease = false;
    this.rest = null;
    this.prompt = MenuUI.text(this, null, W / 2, 120, '', 26, '#37474f', true).setOrigin(0.5, 0).setAlign('center').setWordWrapWidth(W - 120);
    this.sub = MenuUI.text(this, null, W / 2, 190, '', 15, '#8d6e63').setOrigin(0.5, 0).setAlign('center').setWordWrapWidth(W - 140);
    this.list = MenuUI.text(this, null, 120, 250, '', 16, '#4e342e');
    this.live = this.add.graphics();
    this.setPrompt();
    const kb = this.input.keyboard;
    kb.on('keydown-ESC', () => this.leave());
    kb.on('keydown-S', () => { if (this.index >= 0 && this.index < this.steps.length) this.skip(); });
    kb.on('keydown-BACKSPACE', () => { if (this.index > 0) { this.index--; this.waitRelease = true; this.setPrompt(); } });
  }

  leave() { this.scene.start('WeaponSelectScene', this.backData); }

  setPrompt() {
    if (this.index < 0) {
      this.prompt.setText('Press any button on the controller you want to set up');
      this.sub.setText('Plug it in first. PS2 adapters: if the sticks do nothing later, press the ANALOG button on the controller (red light on).');
    } else if (this.index < this.steps.length) {
      this.prompt.setText(this.steps[this.index].text);
      this.sub.setText((this.pad ? this.pad.id.slice(0, 70) : '') + '\nStep ' + (this.index + 1) + ' / ' + this.steps.length + '   ·   S = skip   ·   Backspace = redo the last one   ·   Esc = leave');
    } else {
      this.prompt.setText('All set! Try it: move both sticks and press the buttons.');
      this.sub.setText('Saved for this controller. Esc or Back to return.');
    }
    let txt = '';
    for (let i = 0; i < this.steps.length && this.map; i++) {
      const st = this.steps[i], done = i < this.index;
      let val = '';
      if (done) val = st.kind === 'axis' ? (this.map[st.key].axis < 0 ? 'skipped' : 'axis ' + this.map[st.key].axis + (this.map[st.key].sign < 0 ? ' (flipped)' : ''))
                                       : (this.map.buttons[st.key] < 0 ? 'skipped' : 'button ' + this.map.buttons[st.key]);
      txt += (i === this.index ? '▶ ' : '   ') + (st.kind === 'axis' ? st.text.split('  (')[0] : PAD_ACTION_NAMES[st.key]) + (done ? '  —  ' + val : '') + '\n';
    }
    this.list.setText(txt);
  }

  skip() {
    const st = this.steps[this.index];
    if (st.kind === 'axis') this.map[st.key] = { axis: -1, sign: 1 }; else this.map.buttons[st.key] = -1;
    this.next();
  }

  next() {
    this.index++;
    this.waitRelease = true;
    if (this.index >= this.steps.length) {
      this.map.dpad = this.pad.mapping === 'standard';
      this.map.standard = this.pad.mapping === 'standard';
      PadBindings.save(this.pad, this.map);
    }
    this.setPrompt();
  }

  anyPressed(p) {
    for (let i = 0; i < p.buttons.length; i++) if (p.buttons[i].pressed || p.buttons[i].value > 0.6) return i;
    return -1;
  }

  update() {
    const pads = PadBindings.connected();
    if (this.index < 0) {
      for (let i = 0; i < pads.length; i++) {
        if (this.anyPressed(pads[i]) >= 0) {
          this.pad = pads[i];
          this.map = { buttons: {}, moveX: { axis: -1, sign: 1 }, moveY: { axis: -1, sign: 1 }, aimX: { axis: -1, sign: 1 }, aimY: { axis: -1, sign: 1 } };
          this.index = 0; this.waitRelease = true; this.setPrompt();
          break;
        }
      }
      return;
    }
    // fresh snapshot of the same controller
    let p = null;
    for (let i = 0; i < pads.length; i++) if (pads[i].index === this.pad.index) p = pads[i];
    if (!p) return;
    this.pad = p;
    this.drawLive(p);
    if (this.index >= this.steps.length) return;

    // wait until everything is let go, and remember the sticks' resting values
    if (this.waitRelease) {
      let calm = this.anyPressed(p) < 0;
      if (this.rest) for (let i = 0; i < p.axes.length; i++) if (Math.abs(p.axes[i] - this.rest[i]) > 0.3) calm = false;
      if (calm) { this.waitRelease = false; if (!this.rest || this.index === 0) this.rest = p.axes.slice(); }
      return;
    }
    const st = this.steps[this.index];
    if (st.kind === 'axis') {
      let best = -1, bv = 0.6;
      for (let i = 0; i < p.axes.length; i++) {
        const d = p.axes[i] - (this.rest[i] || 0);
        if (Math.abs(d) > bv) { bv = Math.abs(d); best = i; }
      }
      if (best >= 0) { this.map[st.key] = { axis: best, sign: p.axes[best] - (this.rest[best] || 0) > 0 ? 1 : -1 }; this.next(); }
    } else {
      const b = this.anyPressed(p);
      if (b < 0) return;
      for (const k in this.map.buttons) {
        if (this.map.buttons[k] === b && k !== st.key) { this.sub.setText('That button is already "' + PAD_ACTION_NAMES[k] + '". Pick another one.'); this.waitRelease = true; return; }
      }
      this.map.buttons[st.key] = b; this.next();
    }
  }

  // Little test view: two stick dots + which buttons are pressed.
  drawLive(p) {
    const g = this.live, W = GAME_CONFIG.width;
    g.clear();
    const box = (cx, cy, a) => {
      g.lineStyle(2, 0x8d6e63, 1); g.strokeCircle(cx, cy, 40);
      const ax = a && a.axis >= 0 ? (p.axes[a.axis] || 0) * a.sign : 0;
      return ax;
    };
    const m = this.map || PadBindings.standard();
    const lx = box(W - 260, 520, m.moveX), ly = box(W - 260, 520, m.moveY);
    const rx = box(W - 140, 520, m.aimX), ry = box(W - 140, 520, m.aimY);
    g.fillStyle(0x1565c0, 1); g.fillCircle(W - 260 + lx * 36, 520 + ly * 36, 8);
    g.fillStyle(0xc62828, 1); g.fillCircle(W - 140 + rx * 36, 520 + ry * 36, 8);
    for (let i = 0; i < p.buttons.length && i < 20; i++) {
      g.fillStyle(p.buttons[i].pressed ? 0x2e7d32 : 0xd7ccc8, 1);
      g.fillRect(W - 300 + (i % 10) * 26, 580 + Math.floor(i / 10) * 22, 20, 16);
    }
  }
}

/* ---------------- Keyboard controls ----------------
   Rebind every key of every keyboard control type (KEY_SCHEMES in controls.js).
   Click "Change" and press a key (Esc = cancel). "+" adds a second key for the
   same action, "×" clears it. Saved in SaveData.settings.keys. */
class ControlsScene extends Phaser.Scene {
  constructor() { super('ControlsScene'); }

  init(data) {
    this.back = (data && data.back) || 'MainMenuScene';
    this.backData = (data && data.backData) || {};
    this.scheme = (data && data.scheme) || 'kbm';
    this.waiting = (data && data.waiting) || null;    // { action, add } while waiting for a key
  }

  create() {
    const W = GAME_CONFIG.width, H = GAME_CONFIG.height;
    this.input.setDefaultCursor('default');
    MenuUI.paper(this);
    MenuUI.text(this, null, 40, 18, 'Keyboard keys', 32, '#37474f', true);
    MenuUI.button(this, null, W - 110, 22, '  Back  ', () => this.leave(), '#37474f');
    MenuUI.text(this, null, 40, 60, 'Pick a control type, then change any key. Saved for next time. Controllers: use "Controller setup".', 12, '#8d6e63');

    // control type tabs
    const tabs = ['kbm', 'arrowsMouse', 'keysLeft', 'keysRight'];
    let tx = 40;
    for (let i = 0; i < tabs.length; i++) {
      const on = tabs[i] === this.scheme;
      const b = MenuUI.button(this, null, tx, 82, ' ' + CONTROL_TYPES[tabs[i]].name + ' ', () => this.scene.restart({ back: this.back, backData: this.backData, scheme: tabs[i] }),
        on ? '#37474f' : '#a1887f', 13);
      tx += b.width + 8;
    }

    const sc = KEY_SCHEMES[this.scheme], binds = KeyBinds.get(this.scheme);
    // keys used twice inside this scheme
    const count = {};
    for (const a in binds) for (let i = 0; i < binds[a].length; i++) count[binds[a][i]] = (count[binds[a][i]] || 0) + 1;
    const y0 = 130, rowH = 36;
    for (let i = 0; i < KEY_ACTIONS.length; i++) {
      const a = KEY_ACTIONS[i], col = i < 6 ? 0 : 1, row = i % 6;
      const x = 40 + col * 450, y = y0 + row * (rowH + 8);
      const g = this.add.graphics();
      const twice = binds[a].some((k) => count[k] > 1);
      g.fillStyle(this.waiting && this.waiting.action === a ? 0xfff3c4 : 0xffffff, 1); g.fillRoundedRect(x, y, 430, rowH, 5);
      g.lineStyle(1, twice ? 0xc62828 : 0x37474f, twice ? 0.9 : 0.3); g.strokeRoundedRect(x, y, 430, rowH, 5);
      MenuUI.text(this, null, x + 10, y + 9, KEY_ACTION_NAMES[a], 15, '#37474f', true);
      let label = KeyBinds.label(this.scheme, a, binds);
      if (this.waiting && this.waiting.action === a) label = 'press a key...  (Esc = cancel)';
      MenuUI.text(this, null, x + 165, y + 9, label, 15, twice ? '#c62828' : '#1565c0', true);
      const fixedMouse = sc.mouse && (a === 'attack' || a === 'swap');
      MenuUI.button(this, null, x + 300, y + 5, 'Change', () => this.wait(a, false), '#5d4037', 12);
      MenuUI.button(this, null, x + 366, y + 5, ' + ', () => this.wait(a, true), '#6d4c41', 12);
      if (binds[a].length) MenuUI.button(this, null, x + 398, y + 5, ' × ', () => { KeyBinds.set(this.scheme, a, []); this.redraw(); }, '#9e9e9e', 12);
      if (fixedMouse && !binds[a].length) MenuUI.text(this, null, x + 165, y + 23, '(mouse; + adds a key)', 9, '#8d6e63');
    }
    const by = y0 + 6 * (rowH + 8) + 6;
    // clashes with the other keyboard types (only matters if two players pick both)
    const others = ['kbm', 'arrowsMouse', 'keysLeft', 'keysRight'].filter((t) => t !== this.scheme && !Controls.clash(this.scheme, t));
    MenuUI.text(this, null, 40, by, 'Can play together with: ' + (others.length ? others.map((t) => CONTROL_TYPES[t].short).join(', ') : 'nothing (shares keys or the mouse with every other type)') +
      (Object.keys(count).some((k) => count[k] > 1) ? '      Red = a key used for two actions.' : ''), 13, '#6d4c41', true);
    MenuUI.button(this, null, 40, by + 30, ' Reset this type to default ', () => { KeyBinds.reset(this.scheme); this.redraw(); }, '#c62828', 13);
    MenuUI.text(this, null, 40, by + 66, 'Mouse types: the mouse aims, left button attacks, right button swaps. Keyboard-only types aim by themselves (co-op).', 12, '#8d6e63');

    this.input.keyboard.on('keydown', (ev) => this.onKey(ev));
  }

  wait(action, add) { this.waiting = { action: action, add: add }; this.redraw(); }

  redraw() { this.scene.restart({ back: this.back, backData: this.backData, scheme: this.scheme, waiting: this.waiting }); }

  onKey(ev) {
    if (!this.waiting) { if (ev.key === 'Escape') this.leave(); return; }
    ev.preventDefault && ev.preventDefault();
    const name = ev.keyCode === 27 ? null : this.keyName(ev.keyCode);
    if (name) {
      const cur = KeyBinds.get(this.scheme)[this.waiting.action];
      KeyBinds.set(this.scheme, this.waiting.action, this.waiting.add ? cur.filter((k) => k !== name).concat([name]) : [name]);
    }
    this.waiting = null;
    this.redraw();
  }

  // keyCode -> Phaser key name (first match)
  keyName(code) {
    const kc = Phaser.Input.Keyboard.KeyCodes;
    for (const k in kc) if (kc[k] === code) return k;
    return null;
  }

  leave() { this.scene.start(this.back, this.backData); }
}
