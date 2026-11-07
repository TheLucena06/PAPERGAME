/* hud.js
   Hud: everything that is only drawn, never game rules.
   Top-left panel (HP, MP, slot bar: weapons / skills / item / dash, coins),
   info line, minimap, enemy health bars + stun dots, aim line, bow charge
   ring, sword swing, shield, barrier, explosions, attack warnings, spawn
   markers, level banner. */

const HUD_MAX_FX = 16;

class Hud {
  constructor(scene, cfg) {
    this.scene = scene;
    this.cfg = cfg;
    const W = cfg.width, H = cfg.height;

    this.overlay = scene.add.graphics().setDepth(50);
    this.floorG = scene.add.graphics().setDepth(1);     // holes, underground dirt (under everything)
    this.bossG = scene.add.graphics().setDepth(100);    // boss health bar
    this.bossName = scene.add.text(W / 2, H - 46, '', { fontFamily: 'Arial, sans-serif', fontSize: '16px', color: '#fdf6e3',
      fontStyle: 'bold', stroke: '#3e2f25', strokeThickness: 4 }).setOrigin(0.5).setDepth(102).setVisible(false);
    this.boss = null;
    this._bossStr = '';
    this.panel = scene.add.graphics().setDepth(100);
    this.minimap = scene.add.graphics().setDepth(101);

    const small = { fontFamily: 'Arial, sans-serif', fontSize: '13px', color: '#fdf6e3' };
    const light = { fontFamily: 'Arial, sans-serif', fontSize: '15px', color: '#fdf6e3',
                    stroke: '#3e2f25', strokeThickness: 3 };

    // One panel per player: P1 top-left, P2 top-right (left of the minimap)
    this.panels = [];
    const players = scene.players || [];
    for (let i = 0; i < Math.max(1, players.length); i++) {
      const px = i === 0 ? 10 : W - 346 - 124;
      const ctl = players[i] ? players[i].controller : null;
      this.panels.push(this.makePanel(scene, px, 8, i, players.length > 1, ctl ? ctl.labels : null));
    }
    const P0 = this.panels[0];
    this.coinText = scene.add.text(P0.px + P0.pw + 30, P0.py + 4, '', light).setDepth(102);
    this.infoText = scene.add.text(P0.px + 2, P0.py + P0.ph + 4, '', light).setDepth(100);
    this.coinIconX = P0.px + P0.pw + 10; this.coinIconY = P0.py + 8;
    // Pencil Case shavings earned this run (hidden in the Test Dungeon)
    this.shavText = scene.add.text(P0.px + P0.pw + 30, P0.py + 26, '', light).setDepth(102).setScrollFactor(0);
    this.shavIconX = P0.px + P0.pw + 10; this.shavIconY = P0.py + 30;
    // P1's panel also owns the coin/shaving counters and the info line (they fade together)
    P0.objs.push(this.coinText, this.shavText, this.infoText);
    P0.rect = { x: P0.px, y: P0.py, w: P0.pw + 80, h: P0.ph + 44 };
    this.miniRect = null; this.miniFade = 1;

    // control hint from each player's chosen control type
    const hints = [];
    for (let i = 0; i < players.length; i++) {
      hints.push((players.length > 1 ? 'P' + (i + 1) + ': ' : '') + Controls.hint(players[i].controller.type));
    }
    this.hint = scene.add.text(W / 2, H - 32 - (players.length - 1) * 9, hints.join('\n'),
      Object.assign({}, light, { fontSize: players.length > 1 ? '12px' : '15px', align: 'center' })).setOrigin(0.5).setDepth(100);
    scene.tweens.add({ targets: this.hint, alpha: 0, delay: 8000, duration: 1500 });

    this.banner = scene.add.text(W / 2, H / 2 - 120, '', {
      fontFamily: 'Arial, sans-serif', fontSize: '44px', color: '#37474f', fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(102).setAlpha(0);

    // Short-lived effects (explosions, parry flashes), pooled
    this.fx = [];
    for (let i = 0; i < HUD_MAX_FX; i++) this.fx.push({ active: false, x: 0, y: 0, r: 0, ms: 0, total: 1, color: 0 });

    this.cache = { coins: -1, kills: -1, sec: -1, level: -1 };

    // Screen-space things stay put when the camera scrolls (big rooms).
    const fixed = [this.bossG, this.bossName, this.panel, this.minimap, this.coinText, this.infoText, this.hint, this.banner];
    for (let i = 0; i < fixed.length; i++) fixed[i].setScrollFactor(0);
  }

  // HP/MP bars, slot boxes (weapons, skills, item, dash) and texts for one player.
  makePanel(scene, px, py, index, coop, labels) {
    const small = { fontFamily: 'Arial, sans-serif', fontSize: '13px', color: '#fdf6e3' };
    const pan = { px: px, py: py, pw: 346, ph: 104, index: index, coop: coop,
                  cache: { hp: -1, maxHp: -1, mp: -1, maxMp: -1 }, effectStr: '' };
    pan.barX = px + 34; pan.barW = 220; pan.hpY = py + 9; pan.mpY = py + 29;
    pan.labelHp = scene.add.text(px + 9, pan.hpY - 1, coop ? 'P' + (index + 1) : 'HP', Object.assign({}, small, coop ? { color: '#' + PLAYER_CURSOR_COLORS[index].toString(16).padStart(6, '0'), fontStyle: 'bold' } : {})).setDepth(102);
    pan.labelMp = scene.add.text(px + 9, pan.mpY - 1, 'MP', small).setDepth(102);
    pan.hpText = scene.add.text(pan.barX + pan.barW + 8, pan.hpY - 1, '', small).setDepth(102);
    pan.mpText = scene.add.text(pan.barX + pan.barW + 8, pan.mpY - 1, '', small).setDepth(102);
    pan.effectText = scene.add.text(px + 2, py + pan.ph + (index === 0 ? 24 : 4), '', { fontFamily: 'Arial, sans-serif', fontSize: '13px',
      color: '#ffe082', stroke: '#3e2f25', strokeThickness: 3 }).setDepth(100);
    const L = labels || {};
    const defs = [['w0', '1'], ['w1', '2'], ['s0', L.skill1 || 'Q'], ['s1', L.skill2 || 'E'], ['c', L.consumable || 'F'], ['dash', L.dash || 'SPC']];
    const gapAfter = { w1: 10, s1: 10 };
    // own graphics so the whole panel can fade when something is behind it
    pan.g = scene.add.graphics().setDepth(100).setScrollFactor(0);
    pan.fade = 1;
    pan.rect = { x: px, y: py, w: pan.pw, h: pan.ph + 22 };
    pan.objs = [pan.labelHp, pan.labelMp, pan.hpText, pan.mpText, pan.effectText];
    pan.labelHp.setScrollFactor(0); pan.labelMp.setScrollFactor(0);
    pan.hpText.setScrollFactor(0); pan.mpText.setScrollFactor(0); pan.effectText.setScrollFactor(0);
    pan.boxes = [];
    let bx = px + 9;
    for (let i = 0; i < defs.length; i++) {
      const b = { key: defs[i][0], x: bx, y: py + 52, w: 50, h: 44 };
      b.keyText = scene.add.text(b.x + 3, b.y + 2, defs[i][1], { fontFamily: 'Arial, sans-serif', fontSize: '10px', color: '#bcaaa4' }).setDepth(103);
      b.nameText = scene.add.text(b.x + b.w / 2, b.y + 22, '', { fontFamily: 'Arial, sans-serif', fontSize: '12px', color: '#fdf6e3', fontStyle: 'bold' }).setOrigin(0.5).setDepth(103);
      b.subText = scene.add.text(b.x + b.w - 3, b.y + b.h - 2, '', { fontFamily: 'Arial, sans-serif', fontSize: '10px', color: '#fdf6e3' }).setOrigin(1, 1).setDepth(103);
      b.cache = { name: null, sub: null, alpha: -1 };
      b.keyText.setScrollFactor(0); b.nameText.setScrollFactor(0); b.subText.setScrollFactor(0);
      pan.objs.push(b.keyText, b.nameText, b.subText);
      pan.boxes.push(b);
      bx += b.w + 5 + (gapAfter[b.key] || 0);
    }
    return pan;
  }

  showBanner(message) {
    this.scene.tweens.killTweensOf(this.banner);
    this.banner.setText(message).setAlpha(1);
    this.scene.tweens.add({ targets: this.banner, alpha: 0, delay: 1200, duration: 600 });
  }

  // Rising text that fades out (rare events only, e.g. room-clear heal).
  floatText(x, y, str, color) {
    const t = this.scene.add.text(x, y, str, {
      fontFamily: 'Arial, sans-serif', fontSize: '18px', color: color, fontStyle: 'bold',
      stroke: '#fdf6e3', strokeThickness: 4
    }).setOrigin(0.5).setDepth(60);
    this.scene.tweens.add({ targets: t, y: y - 40, alpha: 0, delay: 500, duration: 900, onComplete: () => t.destroy() });
  }

  setBoss(boss) {
    this.boss = boss;
    if (boss) { this.scene.tweens.killTweensOf(this.hint); this.hint.setAlpha(0); }
    this.bossName.setVisible(!!boss);
    this.bossG.clear();
    this.floorG.clear();
    this._bossStr = '';
  }

  // Boss bar at the bottom + underground dirt, warnings and holes.
  // Floor layer + world effects: worm holes / dirt / warnings (boss and small
  // worms), bombs, traps, chains; plus the boss health bar.
  drawBoss(dt) {
    const fg = this.floorG, g = this.overlay, bg = this.bossG;
    fg.clear(); bg.clear();
    const now = this.scene.time.now;
    const w = this.world;
    if (this.boss) this.drawWorms(this.boss, fg, g, now);
    if (w && w.minor && w.minor.active) this.drawWorms(w.minor, fg, g, now);
    if (w && w.hazards) this.drawHazards(w.hazards, fg, g, now);
    if (w && w.chains) this.drawChains(w.chains, g);
    const b = this.boss;
    if (!b) return;

    // health bar
    const W = this.cfg.width, H = this.cfg.height;
    const bw = 520, bx = W / 2 - bw / 2, by = H - 30;
    const frac = b.totalHp() / b.totalMaxHp;
    bg.fillStyle(0x3e2f25, 0.85); bg.fillRoundedRect(bx - 8, by - 26, bw + 16, 42, 6);
    this.drawBar(bg, bx, by, bw, 10, frac, 0x8e24aa);
    const str = b.def.name + (b.worms.length > 1 ? '   ×' + b.worms.length : '');
    if (str !== this._bossStr) { this._bossStr = str; this.bossName.setText(str); this.bossName.setPosition(W / 2, by - 12); }
  }

  drawWorms(b, fg, g, now) {
    const big = !b.minor;
    for (let i = 0; i < b.holes.length; i++) {
      const h = b.holes[i];
      if (!h.active) continue;
      const a = Math.min(1, h.ms / 1500), k = big ? 1 : 0.6;
      fg.fillStyle(0x3e2723, 0.55 * a); fg.fillEllipse(h.x, h.y, 50 * k, 42 * k);
      fg.fillStyle(0x1b0f0b, 0.6 * a); fg.fillEllipse(h.x, h.y, 30 * k, 24 * k);
      fg.lineStyle(3, 0x6d4c41, 0.6 * a); fg.strokeEllipse(h.x, h.y, 56 * k, 48 * k);
    }
    for (let wi = 0; wi < b.worms.length; wi++) {
      const w = b.worms[wi];
      const k = big ? 1 : 0.6;
      if (!w.surfaced) {
        fg.fillStyle(0x5d4037, 0.45); fg.fillEllipse(w.hx, w.hy, 34 * k, 28 * k);
        fg.fillStyle(0x8d6e63, 0.6);
        for (let c = 0; c < 4; c++) {
          const a = now / 90 + c * 1.57;
          fg.fillCircle(w.hx + Math.cos(a) * 14 * k, w.hy + Math.sin(a) * 11 * k, 3 * k);
        }
      }
      for (let i = 2; i < w.segs.length; i += 3) {
        const s = w.segs[i];
        if (s.surfaced) continue;
        fg.fillStyle(0x5d4037, 0.18); fg.fillEllipse(s.x, s.y, 22 * k, 18 * k);
      }
      if (w.state === 'warn') {
        const t = 1 - Math.max(0, w.stateMs) / b.def.warnMs;
        const pulse = 0.5 + 0.5 * Math.sin(now / 60);
        g.fillStyle(0xd84315, 0.15 + 0.2 * t); g.fillCircle(w.warnX, w.warnY, 44 * k);
        g.lineStyle(3, 0xd84315, 0.5 + 0.4 * pulse); g.strokeCircle(w.warnX, w.warnY, (30 + 16 * t) * k);
        g.lineStyle(2, 0x3e2723, 0.8);
        for (let c = 0; c < 6; c++) {
          const a = c * 1.047 + 0.3;
          g.lineBetween(w.warnX + Math.cos(a) * 8 * k, w.warnY + Math.sin(a) * 8 * k,
                        w.warnX + Math.cos(a + 0.25) * (22 + 20 * t) * k, w.warnY + Math.sin(a + 0.25) * (22 + 20 * t) * k);
        }
      }
    }
  }

  drawHazards(hz, fg, g, now) {
    for (let i = 0; i < hz.list.length; i++) {
      const h = hz.list[i];
      if (!h.active) continue;
      if (h.kind === 'lob') {
        const t = 1 - Math.max(0, h.ms) / h.total;
        const lift = Math.sin(t * Math.PI) * 60;
        fg.lineStyle(2, 0xd84315, 0.5); fg.strokeCircle(h.x1, h.y1, h.def.hitRadius);   // where it lands
        fg.fillStyle(0x000000, 0.2); fg.fillEllipse(h.x, h.y, 14, 8);                   // shadow
        g.fillStyle(0x37474f, 1); g.fillCircle(h.x, h.y - lift, 8);
        g.fillStyle(0xff7043, 1); g.fillCircle(h.x + 4, h.y - lift - 7, 2.5);
      } else if (h.kind === 'bomb') {
        const t = 1 - h.ms / h.total;
        const blink = Math.floor(now / (t > 0.7 ? 70 : 160)) % 2 === 0;
        fg.fillStyle(0xd84315, 0.08 + 0.18 * t); fg.fillCircle(h.x, h.y, h.def.radius);
        fg.lineStyle(2, 0xd84315, 0.4 + 0.4 * t); fg.strokeCircle(h.x, h.y, h.def.radius);
        g.fillStyle(blink ? 0xff7043 : 0x37474f, 1); g.fillCircle(h.x, h.y, 9);
        g.lineStyle(2, 0x212121, 1); g.strokeCircle(h.x, h.y, 9);
      } else if (h.kind === 'trap') {
        const armed = h.armMs <= 0;
        fg.lineStyle(3, 0x616161, armed ? 1 : 0.4); fg.strokeCircle(h.x, h.y, 14);
        fg.lineStyle(2, 0x9e9e9e, armed ? 1 : 0.4);
        for (let c = 0; c < 8; c++) {
          const a = c * 0.785;
          fg.lineBetween(h.x + Math.cos(a) * 8, h.y + Math.sin(a) * 8, h.x + Math.cos(a) * 15, h.y + Math.sin(a) * 15);
        }
      }
    }
  }

  drawChains(ch, g) {
    for (let ci = 0; ci < ch.list.length; ci++) {
      const c = ch.list[ci];
      if (!c.active) continue;
      for (let i = 1; i < c.n; i++) {
        const fast = c.speed[i] >= c.def.minSpeed;
        g.lineStyle(fast ? 4 : 3, fast ? 0x455a64 : 0x78909c, 1);
        g.lineBetween(c.x[i - 1], c.y[i - 1], c.x[i], c.y[i]);
      }
      g.fillStyle(0x90a4ae, 1);
      for (let i = 1; i < c.n - 1; i++) g.fillCircle(c.x[i], c.y[i], 2.5);
      // flail end ball when only one prisoner is left
      if (!ch.alive(c, c.b)) { g.fillStyle(0x37474f, 1); g.fillCircle(c.x[c.n - 1], c.y[c.n - 1], 7); }
    }
  }

  addFx(x, y, r, color, ms) {
    for (let i = 0; i < this.fx.length; i++) {
      const f = this.fx[i];
      if (f.active) continue;
      f.active = true; f.x = x; f.y = y; f.r = r; f.color = color; f.ms = ms || 260; f.total = f.ms; f.line = false;
      return;
    }
  }

  // A short-lived zig-zag line (lightning, chain sparks).
  lineFx(x1, y1, x2, y2, color) {
    for (let i = 0; i < this.fx.length; i++) {
      const f = this.fx[i];
      if (f.active) continue;
      f.active = true; f.line = true; f.x = x1; f.y = y1; f.x2 = x2; f.y2 = y2; f.color = color; f.ms = 180; f.total = 180;
      return;
    }
  }

  setBox(b, name, sub, alpha) {
    const c = b.cache;
    if (c.name !== name) { c.name = name; b.nameText.setText(name); }
    if (c.sub !== sub) { c.sub = sub; b.subText.setText(sub); }
    if (c.alpha !== alpha) { c.alpha = alpha; b.nameText.setAlpha(alpha); }
  }

  // Bars are redrawn every frame (cheap); text only when a value changes.
  // Is any enemy, enemy shot or player on screen inside this rect? (then the HUD there fades)
  covered(r) {
    const sc = this.scene, cam = sc.cameras.main, x0 = r.x - 12 + cam.scrollX, y0 = r.y - 12 + cam.scrollY, x1 = x0 + r.w + 24, y1 = y0 + r.h + 24;
    const inside = (x, y) => x > x0 && x < x1 && y > y0 && y < y1;
    if (sc.players) for (let i = 0; i < sc.players.length; i++) { const p = sc.players[i]; if (p.alive && inside(p.sprite.x, p.sprite.y)) return true; }
    if (sc.enemies && sc.enemies.group) {
      const l = sc.enemies.group.getChildren();
      for (let i = 0; i < l.length; i++) if (l[i].active && inside(l[i].x, l[i].y)) return true;
    }
    if (sc.enemyBullets && sc.enemyBullets.group) {
      const l = sc.enemyBullets.group.getChildren();
      for (let i = 0; i < l.length; i++) if (l[i].active && inside(l[i].x, l[i].y)) return true;
    }
    const bosses = [sc.boss, sc.minorWorms];
    for (let k = 0; k < bosses.length; k++) {
      const bm = bosses[k];
      if (!bm || !bm.worms) continue;
      for (let w = 0; w < bm.worms.length; w++) { const segs = bm.worms[w].segs || []; for (let i = 0; i < segs.length; i++) if (segs[i].surfaced && inside(segs[i].x, segs[i].y)) return true; }
    }
    return false;
  }

  fadeTo(cur, covered, dt) {
    const target = covered ? 0.22 : 1;
    const k = Math.min(1, dt / 1000 * (covered ? 10 : 4));
    const f = cur + (target - cur) * k;
    return Math.abs(target - f) < 0.01 ? target : f;
  }

  updatePanel(players, team, level, elapsedMs) {
    const g = this.panels[0].g;
    for (let i = 0; i < this.panels.length; i++) this.panels[i].g.clear();
    const dt = this.scene.game.loop.delta;
    const play = this.scene.mode === 'play';
    for (let i = 0; i < this.panels.length; i++) {
      const pan = this.panels[i];
      const f = this.fadeTo(pan.fade, play && this.covered(pan.rect), dt);
      if (f !== pan.fade) {
        pan.fade = f;
        pan.g.setAlpha(f);
        for (let k = 0; k < pan.objs.length; k++) pan.objs[k].setAlpha(f);
      }
    }
    if (this.miniRect) {
      const f = this.fadeTo(this.miniFade, play && this.covered(this.miniRect), dt);
      if (f !== this.miniFade) { this.miniFade = f; this.minimap.setAlpha(f); }
    }
    // Text is a canvas texture re-upload to the GPU on every change, which was
    // the main "eventual slowdown" (mana regen changed the text every frame).
    // So text is refreshed at most 5 times per second.
    this._textMs = (this._textMs || 0) - this.scene.game.loop.delta;
    const doText = this._textMs <= 0;
    if (doText) this._textMs = 200;
    for (let i = 0; i < this.panels.length && i < players.length; i++) this.drawPanel(this.panels[i].g, this.panels[i], players[i], doText);

    const c = this.cfg.colors;
    g.fillStyle(c.coin, 1);
    g.fillRect(this.coinIconX, this.coinIconY, 12, 12);
    g.lineStyle(2, 0x8d6e00, 1);
    g.strokeRect(this.coinIconX, this.coinIconY, 12, 12);
    if (!this.scene.testMode) {                        // shaving icon: a little pencil tip
      const x = this.shavIconX, y = this.shavIconY;
      g.fillStyle(0xe0a96d, 1); g.fillTriangle(x, y, x + 12, y, x + 6, y + 12);
      g.fillStyle(0x37474f, 1); g.fillTriangle(x + 4, y + 8, x + 8, y + 8, x + 6, y + 12);
    }
    if (!doText) return;
    const ca = this.cache;
    if (!this.scene.testMode && this.scene.runShavings !== ca.shav) { ca.shav = this.scene.runShavings; this.shavText.setText('' + ca.shav); }
    let kills = 0;
    for (let i = 0; i < players.length; i++) kills += players[i].kills;
    const sec = Math.floor(elapsedMs / 1000);
    if (team.coins !== ca.coins) { ca.coins = team.coins; this.coinText.setText('' + team.coins); }
    if (kills !== ca.kills || sec !== ca.sec || level !== ca.level) {
      ca.kills = kills; ca.sec = sec; ca.level = level;
      const run = this.scene.run;
      this.infoText.setText((run ? STAGE_TYPES[run.stageId].name + ' · ' : '') + 'Level ' + level + '    Kills ' + kills + '    ' + sec + 's');
    }
  }

  drawPanel(g, pan, p, doText) {
    const s = p.stats;
    const c = this.cfg.colors;
    g.fillStyle(0x3e2f25, 0.82);
    g.fillRoundedRect(pan.px, pan.py, pan.pw, pan.ph, 6);
    if (pan.coop) { g.lineStyle(2, PLAYER_CURSOR_COLORS[pan.index], 0.9); g.strokeRoundedRect(pan.px, pan.py, pan.pw, pan.ph, 6); }
    this.drawBar(g, pan.barX, pan.hpY, pan.barW, 12, p.hp / s.maxHp, c.hpPlayer);
    const cost = (p.weapon && p.weapon.def.manaCost) ? p.weapon.def.manaCost * s.manaCostMul : 0;
    this.drawBar(g, pan.barX, pan.mpY, pan.barW, 12, p.mana / s.maxMana, p.mana >= cost ? c.mana : c.manaLow);
    if (p.barrierHp > 0) this.drawBar(g, pan.barX, pan.hpY + 13, pan.barW * Math.min(1, p.barrierHp / 40), 2, 1, 0x80deea);

    for (let i = 0; i < pan.boxes.length; i++) {
      const b = pan.boxes[i];
      let name = '-', sub = '', alpha = 1, cd = 0, active = false;
      if (b.key === 'w0' || b.key === 'w1') {
        const slot = b.key === 'w0' ? 0 : 1;
        const def = Catalog.get('weapon', p.weapons[slot]);
        if (def) name = def.short;
        active = p.activeWeapon === slot && !!def;
        alpha = active ? 1 : 0.55;
      } else if (b.key === 's0' || b.key === 's1') {
        const slot = b.key === 's0' ? 0 : 1;
        const def = Catalog.get('skill', p.skills[slot]);
        if (def) {
          name = def.short;
          sub = '' + def.manaCost;
          cd = p.skillCdMs[slot] > 0 ? p.skillCdMs[slot] / p.skillCdTotal[slot] : 0;
          alpha = p.mana >= def.manaCost ? 1 : 0.45;
        }
      } else if (b.key === 'c') {
        const def = Catalog.get('consumable', p.consumableId);
        if (def) { name = def.short; sub = 'x' + p.consumableCount; }
      } else if (b.key === 'dash') {
        name = 'DASH';
        cd = p.dashCdMs > 0 ? p.dashCdMs / s.dashCooldownMs : 0;
      }
      g.fillStyle(0x5d4a3c, 1);
      g.fillRect(b.x, b.y, b.w, b.h);
      if (cd > 0) { g.fillStyle(0x000000, 0.45); g.fillRect(b.x, b.y, b.w, b.h * cd); }
      g.lineStyle(active ? 3 : 1, active ? 0xfdf6e3 : 0x8d7b6a, 1);
      g.strokeRect(b.x, b.y, b.w, b.h);
      this.setBox(b, name, sub, alpha);
    }
    if (!p.alive) {   // knocked out: dim the panel
      g.fillStyle(0x000000, 0.45); g.fillRoundedRect(pan.px, pan.py, pan.pw, pan.ph, 6);
    }
    if (!doText) return;
    const ca = pan.cache;
    const hp = p.hp, mp = Math.floor(p.mana);
    if (hp !== ca.hp || s.maxHp !== ca.maxHp) { ca.hp = hp; ca.maxHp = s.maxHp; pan.hpText.setText(p.alive ? hp + '/' + s.maxHp : 'DOWN'); }
    if (mp !== ca.mp || s.maxMana !== ca.maxMp) { ca.mp = mp; ca.maxMp = s.maxMana; pan.mpText.setText(mp + '/' + s.maxMana); }
    // Active timed effects, e.g. "Sharpened 42s · Mana Candle 12s"
    let es = !p.alive && pan.coop ? 'Knocked out: back when the room is cleared' : (p.burnMs > 0 ? 'Burning ' + Math.ceil(p.burnMs / 1000) + 's' : '');
    for (let i = 0; p.alive && i < p.effects.length; i++) {
      if (es) es += '  ·  ';
      es += EFFECT_TYPES[p.effects[i].id].name + ' ' + Math.ceil(p.effects[i].ms / 1000) + 's';
    }
    if (es !== pan.effectStr) { pan.effectStr = es; pan.effectText.setText(es); }
  }

  /* ---- weapon visuals ---- */
  // The weapon drawn in the player's hand, pointing at the aim.
  drawHeldWeapon(g, p, w, x, y, half, a, now) {
    const v = w.def.visual;
    if (!v) return;
    const ax = Math.cos(a), ay = Math.sin(a);
    const nx = -ay, ny = ax;                  // sideways
    const swinging = w.swingFxMs > 0;

    if (v.style === 'blade') {
      if (swinging) return;                   // the swing effect replaces the blade
      const bx = x + ax * (half - 2) + nx * 9, by = y + ay * (half - 2) + ny * 9;
      const tx = bx + ax * v.length, ty = by + ay * v.length;
      if (v.glow) { g.lineStyle(v.width + 6, v.glow, 0.25 + 0.15 * Math.sin(now / 150)); g.lineBetween(bx, by, tx, ty); }
      g.lineStyle(v.width, v.color, 1); g.lineBetween(bx, by, tx, ty);
      g.lineStyle(1, 0xffffff, 0.7); g.lineBetween(bx + ax * 3, by + ay * 3, tx - ax * 2, ty - ay * 2);
      g.lineStyle(3, v.guard, 1); g.lineBetween(bx - nx * 6, by - ny * 6, bx + nx * 6, by + ny * 6);
      if (w.def.heavyEvery && w.combo === w.def.heavyEvery - 1) {     // next swing is heavy
        g.lineStyle(2, v.heavySwing, 0.6 + 0.4 * Math.sin(now / 60)); g.strokeCircle(tx, ty, 5);
      }
    } else if (v.style === 'fist') {
      const reach = swinging && w.swingKind !== 'spin' ? (w.swingFxMs / (w.def.swingFxMs || 90)) : 0;
      const jab = reach > 0 ? Math.sin(reach * Math.PI) * 14 : 0;
      for (let side = -1; side <= 1; side += 2) {
        const lead = (side === 1) ? jab : 0;
        const fx = x + ax * (half + 2 + lead) + nx * 9 * side, fy = y + ay * (half + 2 + lead) + ny * 9 * side;
        if (v.aura) { g.fillStyle(v.aura, 0.25 + 0.15 * Math.sin(now / 130 + side)); g.fillCircle(fx, fy, 8); }
        g.fillStyle(v.color, 1); g.fillCircle(fx, fy, 5);
        g.lineStyle(2, v.outline, 1); g.strokeCircle(fx, fy, 5);
        if (v.wrap) { g.lineStyle(2, v.wrap, 1); g.lineBetween(fx - nx * 4, fy - ny * 4, fx + nx * 4, fy + ny * 4); }
      }
    } else if (v.style === 'bow') {
      const cx = x + ax * (half + 2) - ax * v.size * 0.4, cy = y + ay * (half + 2) - ay * v.size * 0.4;
      if (v.glow) { g.lineStyle(7, v.glow, 0.25 + 0.15 * Math.sin(now / 150)); g.beginPath(); g.arc(cx, cy, v.size, a - 1.0, a + 1.0); g.strokePath(); }
      g.lineStyle(3, v.color, 1);
      g.beginPath(); g.arc(cx, cy, v.size, a - 1.0, a + 1.0); g.strokePath();
      const e1x = cx + Math.cos(a - 1.0) * v.size, e1y = cy + Math.sin(a - 1.0) * v.size;
      const e2x = cx + Math.cos(a + 1.0) * v.size, e2y = cy + Math.sin(a + 1.0) * v.size;
      const pull = w.charging ? Math.min(1, w.chargeMs / w.def.fullChargeMs) * 9 : 0;
      const sx = (e1x + e2x) / 2 - ax * pull, sy = (e1y + e2y) / 2 - ay * pull;
      g.lineStyle(1, 0x37474f, 1); g.lineBetween(e1x, e1y, sx, sy); g.lineBetween(sx, sy, e2x, e2y);
      if (w.charging) { g.lineStyle(2, 0x37474f, 1); g.lineBetween(sx, sy, sx + ax * 20, sy + ay * 20); }
    } else if (v.style === 'stick') {
      const bx = x + ax * (half - 4) + nx * 8, by = y + ay * (half - 4) + ny * 8;
      const tx = bx + ax * v.length, ty = by + ay * v.length;
      g.lineStyle(3, v.color, 1); g.lineBetween(bx, by, tx, ty);
      g.fillStyle(v.orb, 0.3 + 0.2 * Math.sin(now / 120)); g.fillCircle(tx, ty, v.orbSize + 4);
      g.fillStyle(v.orb, 1); g.fillCircle(tx, ty, v.orbSize);
    } else if (v.style === 'orb') {
      // crystal ball in the hand; orbit weapons: the orbs circle you while you hold attack
      const d = w.def, hx = x + ax * (half + 6) + nx * 8, hy = y + ay * (half + 6) + ny * 8;
      g.fillStyle(v.glow, 0.25 + 0.15 * Math.sin(now / 140)); g.fillCircle(hx, hy, 10);
      g.fillStyle(v.color, 1); g.fillCircle(hx, hy, 6);
      g.fillStyle(0xffffff, 0.8); g.fillCircle(hx - 2, hy - 2, 2);
      if (d.kind === 'orbit') {
        const n = d.orbs, ch = w.channel, r = ch ? d.radius : 16, sz = ch ? d.orbSize : 3;
        for (let k = 0; k < n; k++) {
          const oa = (w.orbAng || 0) + k * Math.PI * 2 / n;
          const ox = (ch ? x : hx) + Math.cos(oa) * r, oy = (ch ? y : hy) + Math.sin(oa) * r;
          if (ch) { g.fillStyle(v.glow, 0.3); g.fillCircle(ox, oy, sz + 5); }
          g.fillStyle(v.color, 1); g.fillCircle(ox, oy, sz);
        }
      }
    } else if (v.style === 'tome') {
      // an open book; dots = pages (the next spell is the bright one)
      const d = w.def, hx = x + ax * (half + 6) + nx * 8, hy = y + ay * (half + 6) + ny * 8;
      const casting = w.swingFxMs > 0;
      if (casting) { g.fillStyle(v.glow, 0.35); g.fillCircle(hx, hy, 14); }
      g.fillStyle(v.color, 1); g.fillRect(hx - 9, hy - 6, 18, 12);
      g.fillStyle(0xfdf6e3, 1); g.fillRect(hx - 8, hy - 5, 7, 10); g.fillRect(hx + 1, hy - 5, 7, 10);
      g.lineStyle(1, 0x8d6e63, 1); g.lineBetween(hx, hy - 6, hx, hy + 6);
      const pages = d.pages ? d.pages.length : 0;
      for (let k = 0; k < pages; k++) {
        g.fillStyle(k === (w.page || 0) ? v.glow : 0x8d6e63, k === (w.page || 0) ? 1 : 0.6);
        g.fillCircle(x - (pages - 1) * 4 + k * 8, y + half + 9, 2.5);
      }
    } else if (v.style === 'flail') {
      // handle in the hand, ball swinging around on its chain
      const hx = x + ax * (half - 2), hy = y + ay * (half - 2);
      const hx2 = hx + ax * 12, hy2 = hy + ay * 12;
      g.lineStyle(4, 0x6d4c41, 1); g.lineBetween(hx, hy, hx2, hy2);
      const sa = a + (swinging ? (1 - w.swingFxMs / 220) * Math.PI * 2 : Math.sin(now / 200) * 0.5);
      const bx = hx2 + Math.cos(sa) * v.length, by = hy2 + Math.sin(sa) * v.length;
      g.lineStyle(2, 0x455a64, 1); g.lineBetween(hx2, hy2, bx, by);
      g.fillStyle(v.head, 1); g.fillCircle(bx, by, 7);
    } else if (v.style === 'pick') {
      const hx = x + ax * (half - 4), hy = y + ay * (half - 4);
      const tx = hx + ax * v.length, ty = hy + ay * v.length;
      g.lineStyle(4, v.color, 1); g.lineBetween(hx, hy, tx, ty);                      // handle
      g.lineStyle(5, v.head, 1);                                                       // curved head
      g.beginPath(); g.arc(tx - ax * 10, ty - ay * 10, 13, a - 1.25, a + 1.25); g.strokePath();
    } else if (v.style === 'crossbow') {
      const bx = x + ax * (half - 2), by = y + ay * (half - 2);
      const tx = bx + ax * 22, ty = by + ay * 22;
      g.lineStyle(4, v.color, 1); g.lineBetween(bx, by, tx, ty);                         // stock
      g.lineStyle(3, 0x5d4037, 1); g.lineBetween(tx - ax * 4 - nx * 12, ty - ay * 4 - ny * 12, tx - ax * 4 + nx * 12, ty - ay * 4 + ny * 12);
      for (let k = 0; k < w.loaded; k++) {                                              // loaded bolts
        const off = (k - (w.loaded - 1) / 2) * 4, ox = nx * off, oy = ny * off;
        g.lineStyle(2, v.tip || 0x90a4ae, 1); g.lineBetween(bx + ox, by + oy, tx + ax * 6 + ox, ty + ay * 6 + oy);
      }
      if (w.charging && w.loaded < w.def.maxLoaded) {
        const k = w.chargeMs / w.def.loadMs;
        g.lineStyle(3, 0x37474f, 0.8);
        g.beginPath(); g.arc(x, y, half + 10, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * k); g.strokePath();
      }
      for (let k = 0; k < w.def.maxLoaded; k++) {                                       // pips
        g.fillStyle(k < w.loaded ? 0xffb300 : 0x5d4a3c, 1); g.fillRect(x - w.def.maxLoaded * 4 + 1 + k * 8, y + half + 8, 6, 4);
      }
    } else if (v.style === 'axe') {
      for (let k = 0; k < w.ammo; k++) {
        const side = k === 0 ? 1 : (k === 1 ? -1 : 0);
        const hx = x + ax * (half - 2) + nx * 10 * side, hy = y + ay * (half - 2) + ny * 10 * side;
        const tx = hx + ax * 16, ty = hy + ay * 16;
        g.lineStyle(3, v.color, 1); g.lineBetween(hx, hy, tx, ty);
        g.fillStyle(v.head, 1); g.fillTriangle(tx, ty, tx - ax * 6 + nx * 8 * side, ty - ay * 6 + ny * 8 * side, tx - ax * 9, ty - ay * 9);
      }
    } else if (v.style === 'boomerang') {
      if (w.ammo > 0) {
        const hx = x + ax * (half + 2) + nx * 6, hy = y + ay * (half + 2) + ny * 6;
        g.lineStyle(4, v.color, 1);
        g.lineBetween(hx - nx * 8, hy - ny * 8, hx + ax * 7, hy + ay * 7);
        g.lineBetween(hx + ax * 7, hy + ay * 7, hx + nx * 8, hy + ny * 8);
      }
    } else if (v.style === 'gun') {
      const bx = x + ax * (half - 4) + nx * 6, by = y + ay * (half - 4) + ny * 6;
      g.lineStyle(5, v.color, 1); g.lineBetween(bx, by, bx + ax * 12, by + ay * 12);
      g.lineStyle(3, v.barrel, 1); g.lineBetween(bx + ax * 10, by + ay * 10, bx + ax * 32, by + ay * 32);
      if (w.swingFxMs > 0 && w.swingKind === 'muzzle') {
        g.fillStyle(0xffd54f, 0.9); g.fillCircle(bx + ax * 36, by + ay * 36, 7);
      }
      for (let k = 0; k < w.def.shells; k++) {
        g.fillStyle(k < w.shells ? 0xc62828 : 0x5d4a3c, 1); g.fillRect(x - 7 + k * 8, y + half + 8, 6, 5);
      }
      if (w.shells <= 0 && w.chargeMs > 0) {
        const k = w.chargeMs / w.def.reloadMs;
        g.lineStyle(3, 0xc62828, 0.8);
        g.beginPath(); g.arc(x, y, half + 10, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * k); g.strokePath();
      }
    } else if (v.style === 'shield' && !w.raised) {
      const sx = x + nx * (half + 4), sy = y + ny * (half + 4);
      g.fillStyle(v.color, 1); g.fillCircle(sx, sy, 7);
      g.lineStyle(2, 0x455a64, 1); g.strokeCircle(sx, sy, 7);
    }
  }

  // The swing effect for melee weapons (normal / parry / heavy / spin kick).
  drawSwing(g, w, d, x, y) {
    const v = d.visual || {};
    const kind = w.swingKind;
    const range = w.swingRange || d.range, arc = w.swingArc || d.arcDeg;
    const ha = (Math.min(arc, 359) / 2) * Math.PI / 180;
    const total = kind === 'heavy' ? 220 : (kind === 'spin' ? 200 : d.swingFxMs);
    const k = Math.max(0, w.swingFxMs / total);
    let fill = v.swing || 0xffffff, line = 0x37474f, alpha = 0.55;
    if (kind === 'parry') { fill = 0xffd54f; line = 0xff8f00; alpha = 0.8; }
    if (kind === 'heavy') { fill = v.heavySwing || 0xff3d00; line = 0xbf360c; alpha = 0.75; }
    if (kind === 'spin')  { fill = v.swing || 0xffb74d; line = v.outline || 0xe65100; alpha = 0.6; }
    const r = range + 8;
    g.fillStyle(fill, alpha * k);
    g.slice(x, y, r, w.swingAngle - ha, w.swingAngle + ha, false);
    g.fillPath();
    g.lineStyle(kind === 'heavy' ? 5 : 3, line, 0.7 * k);
    g.beginPath(); g.arc(x, y, r, w.swingAngle - ha, w.swingAngle + ha); g.strokePath();
    if (v.style === 'blade' && kind !== 'spin') {
      const ea = w.swingAngle + ha * (1 - 2 * k);   // the blade sweeping through the arc
      g.lineStyle(v.width || 4, v.color, 0.9);
      g.lineBetween(x + Math.cos(ea) * 14, y + Math.sin(ea) * 14, x + Math.cos(ea) * r, y + Math.sin(ea) * r);
    }
  }

  // Redrawn only when the room changes or gets cleared.
  drawMinimap(map, current) {
    const g = this.minimap;
    g.clear();
    const cw = 14, ch = 9, gap = 3;
    const size = map.gridSize;
    const ox = this.cfg.width - 14 - size * (cw + gap) + gap;
    const oy = 6;
    g.fillStyle(0x000000, 0.25);
    g.fillRect(ox - 4, oy - 3, size * (cw + gap) - gap + 8, size * (ch + gap) - gap + 6);
    this.miniRect = { x: ox - 4, y: oy - 3, w: size * (cw + gap) - gap + 8, h: size * (ch + gap) - gap + 6 };

    for (let i = 0; i < map.rooms.length; i++) {
      const r = map.rooms[i];
      if (!this.isKnown(map, r)) continue;
      const x = ox + r.gx * (cw + gap), y = oy + r.gy * (ch + gap);
      let color = 0x9e9e9e;                       // seen, not visited
      if (r.visited) color = r.cleared ? 0xd7ccb7 : 0xe57373;
      if (r === current) color = 0xffffff;
      g.fillStyle(color, 1);
      g.fillRect(x, y, cw, ch);
      if (r.type === 'exit') { g.fillStyle(r.theme ? 0xc62828 : 0x37474f, 1); g.fillRect(x + cw / 2 - 2, y + ch / 2 - 2, 4, 4); }
      const ic = r.type === 'merchant' ? 0xffc107 : (r.type === 'treasure' ? (r.chestOpened ? 0x8d6e63 : 0xff9800) : (r.type === 'shrine' ? 0x7e57c2 : 0));
      if (ic) { g.fillStyle(ic, 1); g.fillCircle(x + cw / 2, y + ch / 2, 3); }
    }
  }

  isKnown(map, room) {
    if (room.visited || room.revealed) return true;
    for (let i = 0; i < 4; i++) {
      const dir = DIR_NAMES[i];
      if (!room.doors[dir]) continue;
      const n = LevelGenerator.neighbor(map, room, dir);
      if (n && n.visited) return true;
    }
    return false;
  }

  drawOverlay(dt, players, enemies) {
    const g = this.overlay;
    const c = this.cfg.colors;
    const now = this.scene.time.now;
    g.clear();

    // Spawn markers: a shrinking ring where an enemy is about to appear
    for (let i = 0; i < enemies.pending.length; i++) {
      const p = enemies.pending[i];
      if (!p.active) continue;
      const k = p.ms / p.totalMs;
      g.lineStyle(3, c.danger, 0.6);
      g.strokeCircle(p.x, p.y, 8 + 22 * k);
      g.lineBetween(p.x - 6, p.y - 6, p.x + 6, p.y + 6);
      g.lineBetween(p.x - 6, p.y + 6, p.x + 6, p.y - 6);
    }

    // Enemies: attack warnings, stun dots, health bars
    const list = enemies.group.getChildren();
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      if (!e.active) continue;
      const d = e.def;

      if (d.ai === 'tank') {
        if (e.state === 'windup') {
          const k = 1 - Math.max(0, e.stateMs) / d.windupMs;
          g.lineStyle(2, c.danger, 0.7);
          g.strokeCircle(e.x, e.y, d.attackRadius);
          g.fillStyle(c.danger, 0.18);
          g.fillCircle(e.x, e.y, d.attackRadius * k);
        }
        if (e.fxMs > 0) {
          g.fillStyle(c.danger, 0.35);
          g.fillCircle(e.x, e.y, d.attackRadius);
        }
      } else if (d.ai === 'charger' && e.state === 'windup') {
        const len = d.dashSpeed * d.dashMs / 1000;
        const locked = e.stateMs <= d.lockMs;
        g.lineStyle(locked ? 6 : 3, c.danger, locked ? 0.6 : 0.35);
        g.lineBetween(e.x, e.y, e.x + e.dashX * len, e.y + e.dashY * len);
      } else if (d.ai === 'shooter' && e.state === 'windup') {
        g.lineStyle(2, c.danger, 0.5);
        g.lineBetween(e.x, e.y, e.x + (e.tdx / e.tdist) * 36, e.y + (e.tdy / e.tdist) * 36);
      }

      if (e.champion) {   // champions: gold ring
        g.lineStyle(3, 0xffc107, 0.7); g.strokeCircle(e.x, e.y, d.size * e.scaleX * 0.5 + 6);
      }
      if (d.shield) {     // Shield Guard: the shield in front
        const a = e.faceAng, half = d.shield.arcDeg * Math.PI / 360, r = d.size / 2 + 7;
        g.lineStyle(6, 0x90a4ae, 1); g.beginPath(); g.arc(e.x, e.y, r, a - half * 0.8, a + half * 0.8); g.strokePath();
        g.lineStyle(2, 0x37474f, 1); g.beginPath(); g.arc(e.x, e.y, r + 3, a - half * 0.8, a + half * 0.8); g.strokePath();
        if (e.state === 'windup') { g.lineStyle(2, c.danger, 0.6); g.lineBetween(e.x, e.y, e.x + Math.cos(a) * 110, e.y + Math.sin(a) * 110); }
      }
      if (e.state === 'hopWind' || e.state === 'air') {   // King Inkblot / Mimic: where they will land
        const rad = d.hop.radius * (e.slamming ? 1.25 : 1);
        const t = e.state === 'air' ? 1 - Math.max(0, e.stateMs) / e.airTotal : 0;
        g.fillStyle(c.danger, 0.10 + 0.15 * t); g.fillCircle(e.hopX1, e.hopY1, rad);
        g.lineStyle(2, c.danger, 0.6); g.strokeCircle(e.hopX1, e.hopY1, rad);
        if (e.state === 'air') { g.fillStyle(0x000000, 0.2); g.fillEllipse(e.x, e.y + d.size * 0.45, d.size * 0.9, d.size * 0.3); }
      }
      if (e.state === 'tongueWind' || e.state === 'tongue') {   // Mimic tongue
        const L = d.tongue.length, a = e.aimAng;
        if (e.state === 'tongueWind') { g.lineStyle(d.tongue.width, c.danger, 0.15); g.lineBetween(e.x, e.y, e.x + Math.cos(a) * L, e.y + Math.sin(a) * L); }
        else { g.lineStyle(10, 0xe57373, 1); g.lineBetween(e.x, e.y, e.x + Math.cos(a) * L, e.y + Math.sin(a) * L); g.fillStyle(0xc62828, 1); g.fillCircle(e.x + Math.cos(a) * L, e.y + Math.sin(a) * L, 9); }
      }
      if (d.ai === 'warden' && e.ballX !== undefined) {         // ball and chain, throw line, cells
        g.lineStyle(3, 0x455a64, 1); g.lineBetween(e.x, e.y, e.ballX, e.ballY);
        g.fillStyle(0x37474f, 1); g.fillCircle(e.ballX, e.ballY, d.ball.radius);
        g.fillStyle(0x78909c, 1); g.fillCircle(e.ballX - 5, e.ballY - 5, 5);
        if (e.state === 'throw' || e.state === 'spin' || e.state === 'reel') {   // hint: it can be knocked back with a dash attack
          g.lineStyle(2, 0xffd54f, 0.35 + 0.25 * Math.sin(this.scene.time.now / 90)); g.strokeCircle(e.ballX, e.ballY, d.ball.radius + 5);
        }
        if (e.state === 'throwWind') { g.lineStyle(3, c.danger, 0.5); g.lineBetween(e.x, e.y, e.throwX, e.throwY); g.strokeCircle(e.throwX, e.throwY, d.throwB.impactRadius); }
        if ((e.state === 'cellsWind' || e.cellsShownMs > 0) && e.cells) {
          const h = d.cells.size / 2, now2 = e.state === 'cellsWind';
          for (let k = 0; k < e.cells.length; k++) {
            const cl = e.cells[k];
            g.lineStyle(now2 ? 2 : 4, now2 ? c.danger : 0x37474f, now2 ? 0.6 : 1); g.strokeRect(cl.x - h, cl.y - h, h * 2, h * 2);
            if (!now2) for (let b = 1; b < 5; b++) g.lineBetween(cl.x - h + b * h / 2.5, cl.y - h, cl.x - h + b * h / 2.5, cl.y + h);
          }
        }
      }
      if (d.elite) {   // elites: gold frame + little crown
        const h = d.size / 2 + 3;
        g.lineStyle(2, 0xffc107, 0.9); g.strokeRect(e.x - h, e.y - h, h * 2, h * 2);
        g.fillStyle(0xffc107, 1);
        g.fillTriangle(e.x - 9, e.y - h - 2, e.x - 9, e.y - h - 10, e.x - 3, e.y - h - 2);
        g.fillTriangle(e.x - 5, e.y - h - 2, e.x, e.y - h - 12, e.x + 5, e.y - h - 2);
        g.fillTriangle(e.x + 3, e.y - h - 2, e.x + 9, e.y - h - 10, e.x + 9, e.y - h - 2);
      }
      if (d.ai === 'fireWarlock' && e.state === 'windup' && !e.castClose) {
        // ranged: show the arc's spread as fiery lines
        const a = d.arc, sp = a.spreadDeg * Math.PI / 180;
        const locked = e.stateMs <= d.lockMs;
        g.lineStyle(locked ? 3 : 2, 0xff6d00, locked ? 0.7 : 0.35);
        for (let k = 0; k < a.count; k += 2) {
          const ang = e.fireAng - sp / 2 + k * sp / (a.count - 1);
          g.lineBetween(e.x + Math.cos(ang) * 24, e.y + Math.sin(ang) * 24, e.x + Math.cos(ang) * 70, e.y + Math.sin(ang) * 70);
        }
        g.fillStyle(0xff9100, 0.3 + 0.3 * Math.sin(now / 60)); g.fillCircle(e.x, e.y, d.size * 0.7);
      }
      if ((d.ai === 'warlock' || (d.ai === 'fireWarlock' && e.castClose)) && (e.state === 'windup' || e.state === 'cast')) {
        const f = d.fire, ha = (f.arcDeg / 2) * Math.PI / 180;
        if (e.state === 'windup') {
          const locked = e.stateMs <= d.lockMs;
          g.fillStyle(0xff7043, locked ? 0.22 : 0.12);
          g.slice(e.x, e.y, f.radius, e.fireAng - ha, e.fireAng + ha, false); g.fillPath();
          g.lineStyle(2, c.danger, locked ? 0.8 : 0.4);
          g.beginPath(); g.arc(e.x, e.y, f.radius, e.fireAng - ha, e.fireAng + ha); g.strokePath();
        } else {
          for (let k = 0; k < 3; k++) {
            g.fillStyle(k === 0 ? 0xff3d00 : (k === 1 ? 0xff9100 : 0xffd54f), 0.45);
            g.slice(e.x, e.y, f.radius * (1 - k * 0.25) * (0.9 + 0.1 * Math.sin(now / 40 + k)), e.fireAng - ha, e.fireAng + ha, false); g.fillPath();
          }
        }
      } else if (d.ai === 'gale' && (e.state === 'windup' || e.state === 'whirl')) {
        const r = e.state === 'whirl' ? d.pullRadius : 40;
        g.lineStyle(2, 0x4dd0e1, e.state === 'whirl' ? 0.55 : 0.8);
        for (let k = 0; k < 4; k++) {
          const a0 = now / 140 + k * 1.57;
          g.beginPath(); g.arc(e.x, e.y, r * (0.35 + 0.18 * k), a0, a0 + 1.4); g.strokePath();
        }
        if (e.state === 'whirl') { g.fillStyle(0x80deea, 0.08); g.fillCircle(e.x, e.y, r); }
      } else if (d.ai === 'prisoner' && e.state === 'windup' && e.chain && e.chain.b && e.chain.b.active && e.chain.b.chain === e.chain) {
        // pair: show the lane the chain is about to sweep (drawn once, by the lead)
        const ch = e.chain;
        if (ch.a === e) {
          const sw = d.sweep, px = -ch.dirY, py = ch.dirX, L = sw.sweepDist + sw.lineUpDist * 0.3;
          const x0 = ch.cx + px * sw.halfWidth, y0 = ch.cy + py * sw.halfWidth;
          const x1 = ch.cx - px * sw.halfWidth, y1 = ch.cy - py * sw.halfWidth;
          g.fillStyle(c.danger, 0.12 + 0.08 * Math.sin(now / 50));
          g.fillTriangle(x0, y0, x1, y1, x1 + ch.dirX * L, y1 + ch.dirY * L);
          g.fillTriangle(x0, y0, x0 + ch.dirX * L, y0 + ch.dirY * L, x1 + ch.dirX * L, y1 + ch.dirY * L);
          g.lineStyle(2, c.danger, 0.6);
          g.lineBetween(x0, y0, x0 + ch.dirX * L, y0 + ch.dirY * L);
          g.lineBetween(x1, y1, x1 + ch.dirX * L, y1 + ch.dirY * L);
        }
      } else if (d.ai === 'prisoner' && e.state === 'windup' && d.flail) {
        const f = d.flail, ha = (f.arcDeg / 2) * Math.PI / 180;
        g.fillStyle(c.danger, 0.15);
        g.slice(e.x, e.y, f.range + 70, e.swingAng - ha, e.swingAng + ha, false); g.fillPath();
        g.lineStyle(2, c.danger, 0.6);
        g.beginPath(); g.arc(e.x, e.y, f.range + 70, e.swingAng - ha, e.swingAng + ha); g.strokePath();
      }

      if (e.stunnedMs > 0) {
        g.fillStyle(0xffd54f, 1);
        for (let k = 0; k < 3; k++) {
          const a = now / 200 + k * 2.094;
          g.fillCircle(e.x + Math.cos(a) * 12, e.y - d.size / 2 - 10 + Math.sin(a) * 4, 3);
        }
      }

      if (e.hp < e.maxHp) {
        this.drawBarCentered(g, e.x, e.y - d.size / 2 - 7, d.size + 4, e.hp / e.maxHp, c.hpEnemy);
      }
    }

    // Players: aim line, weapon effects
    for (let i = 0; i < players.length; i++) {
      const p = players[i];
      if (!p.alive) continue;
      const x = p.sprite.x, y = p.sprite.y, half = p.stats.size / 2;
      const aimA = Math.atan2(p.input.aimY, p.input.aimX);

      if (players.length > 1) {   // co-op: colored ring under each player + auto-aim marker
        const col = PLAYER_CURSOR_COLORS[i];
        g.lineStyle(2, col, 0.8); g.strokeCircle(x, y, half + 5);
        const t = p.controller.target;
        if (t && t.active) {
          const r = (t.def && t.def.size ? t.def.size / 2 : 14) + 6;
          g.lineStyle(2, col, 0.9);
          for (let k = 0; k < 4; k++) {
            const a0 = k * Math.PI / 2 + now / 400;
            g.beginPath(); g.arc(t.x, t.y, r, a0, a0 + 0.8); g.strokePath();
          }
        }
      }

      if (p.burrow) {   // underground: a moving mound of dirt + time left
        g.fillStyle(0x5d4037, 0.55); g.fillEllipse(x, y, 36, 30);
        g.fillStyle(0x8d6e63, 0.8);
        for (let k = 0; k < 5; k++) {
          const a = now / 80 + k * 1.256;
          g.fillCircle(x + Math.cos(a) * 15, y + Math.sin(a) * 12, 3);
        }
        const k = Math.max(0, p.burrow.ms) / p.burrow.def.durationMs;
        g.lineStyle(3, 0x6a1b9a, 0.8);
        g.beginPath(); g.arc(x, y, 24, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * k); g.strokePath();
        continue;
      }

      if (p.skillDash && p.skillDash.mode === 'cart') {   // riding the minecart: you sit in it
        g.fillStyle(0x6d4c41, 1); g.fillRect(x - 18, y + 2, 36, 14);
        g.lineStyle(2, 0x3e2723, 1); g.strokeRect(x - 18, y + 2, 36, 14);
        g.fillStyle(0x90a4ae, 1); g.fillRect(x - 18, y + 6, 36, 3);
        g.fillStyle(0x263238, 1); g.fillCircle(x - 11, y + 18, 4); g.fillCircle(x + 11, y + 18, 4);
        g.fillStyle(0xffd54f, 0.8); g.fillCircle(x - p.skillDash.dirX * 22, y + 12 - p.skillDash.dirY * 8, 2 + Math.random() * 2);   // sparks
      }

      g.lineStyle(2, c.ink, 0.3);
      g.lineBetween(x + p.input.aimX * (half + 6), y + p.input.aimY * (half + 6),
                    x + p.input.aimX * (half + 34), y + p.input.aimY * (half + 34));

      if (p.burnMs > 0) {
        for (let k = 0; k < 3; k++) {
          const a = now / 110 + k * 2.1;
          g.fillStyle(k % 2 ? 0xff9100 : 0xff3d00, 0.75);
          g.fillCircle(x + Math.cos(a) * 9, y - 6 + Math.sin(a) * 5 - ((now / 6 + k * 30) % 14), 3);
        }
      }
      if (p.dashTrailMs > 0) {
        g.fillStyle(0xffe082, 0.35);
        g.fillCircle(x - p.sprite.body.velocity.x * 0.03, y - p.sprite.body.velocity.y * 0.03, half);
        g.fillStyle(0xffe082, 0.18);
        g.fillCircle(x - p.sprite.body.velocity.x * 0.06, y - p.sprite.body.velocity.y * 0.06, half * 0.8);
      }
      if (p.barrierMs > 0 && p.barrierHp > 0) {
        g.lineStyle(3, 0x4dd0e1, 0.5 + 0.3 * Math.sin(now / 120));
        g.strokeCircle(x, y, half + 14);
      }
      if (p.flurryFxMs > 0) {
        const tot = p.flurryLast ? 200 : 130, k = p.flurryFxMs / tot;
        const ha = (p.flurryArc / 2) * Math.PI / 180 * (p.flurryLast ? 1 : 0.7);
        g.fillStyle(p.flurryLast ? 0xffcc80 : 0xffffff, 0.6 * k);
        g.slice(x, y, p.flurryRange + 8, p.flurryAngle - ha, p.flurryAngle + ha, false); g.fillPath();
        g.lineStyle(p.flurryLast ? 5 : 3, p.flurryLast ? 0xe65100 : 0x37474f, 0.7 * k);
        g.beginPath(); g.arc(x, y, p.flurryRange + 8, p.flurryAngle - ha, p.flurryAngle + ha); g.strokePath();
      }
      if (p.spinFxMs > 0) {
        g.fillStyle(0xffffff, 0.45 * p.spinFxMs / 220);
        g.fillCircle(x, y, p.spinRange);
        g.lineStyle(3, c.ink, 0.5 * p.spinFxMs / 220);
        g.strokeCircle(x, y, p.spinRange);
      }

      const w = p.weapon;
      if (!w) continue;
      const d = w.def;

      if (d.kind === 'charge' && w.charging) {
        const r = half + 10;
        if (w.chargeMs >= d.pierceChargeMs) {
          g.lineStyle(5, c.charged2, 0.6 + 0.4 * Math.sin(now / 60));
          g.strokeCircle(x, y, r);
        } else if (w.chargeMs >= d.fullChargeMs) {
          g.lineStyle(4, c.charged1, 0.9);
          g.strokeCircle(x, y, r);
          const k = (w.chargeMs - d.fullChargeMs) / (d.pierceChargeMs - d.fullChargeMs);
          g.lineStyle(4, c.charged2, 0.9);
          g.beginPath(); g.arc(x, y, r + 6, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * k); g.strokePath();
        } else {
          const k = w.chargeMs / d.fullChargeMs;
          g.lineStyle(3, c.ink, 0.25);
          g.strokeCircle(x, y, r);
          g.lineStyle(3, c.ink, 0.8);
          g.beginPath(); g.arc(x, y, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * k); g.strokePath();
        }
      }

      this.drawHeldWeapon(g, p, w, x, y, half, aimA, now);

      if (d.kind === 'melee' && w.swingFxMs > 0) this.drawSwing(g, w, d, x, y);

      if (d.kind === 'shield') {
        const ha = (d.arcDeg / 2) * Math.PI / 180;
        const r = half + 12;
        if (w.raised) {
          const inWindow = w.raiseMs <= d.parryWindowMs * p.stats.parryWindowMul;
          g.lineStyle(7, inWindow ? 0xffd54f : 0x90a4ae, 1);
          g.beginPath(); g.arc(x, y, r, aimA - ha, aimA + ha); g.strokePath();
        } else {
          g.lineStyle(3, 0x90a4ae, 0.35);
          g.beginPath(); g.arc(x, y, r, aimA - ha * 0.6, aimA + ha * 0.6); g.strokePath();
        }
        if (w.parryFxMs > 0) {
          g.lineStyle(10, 0xffffff, w.parryFxMs / 250);
          g.beginPath(); g.arc(x, y, r + 6, aimA - ha, aimA + ha); g.strokePath();
        }
      }
    }

    // Effects
    for (let i = 0; i < this.fx.length; i++) {
      const f = this.fx[i];
      if (!f.active) continue;
      f.ms -= dt;
      if (f.ms <= 0) { f.active = false; continue; }
      const k = f.ms / f.total;
      if (f.line) {
        g.lineStyle(3, f.color, k);
        g.beginPath(); g.moveTo(f.x, f.y);
        for (let s = 1; s <= 4; s++) { const t = s / 5; g.lineTo(f.x + (f.x2 - f.x) * t + (s % 2 ? 7 : -7), f.y + (f.y2 - f.y) * t); }
        g.lineTo(f.x2, f.y2); g.strokePath();
        continue;
      }
      g.fillStyle(f.color, 0.35 * k);
      g.fillCircle(f.x, f.y, f.r * (1.1 - 0.3 * k));
      g.lineStyle(3, f.color, 0.8 * k);
      g.strokeCircle(f.x, f.y, f.r * (1.1 - 0.3 * k));
    }
  }

  drawBar(g, x, y, w, h, frac, color) {
    g.fillStyle(this.cfg.colors.hpBack, 0.9);
    g.fillRect(x - 1, y - 1, w + 2, h + 2);
    g.fillStyle(color, 1);
    g.fillRect(x, y, w * Math.max(0, Math.min(1, frac)), h);
  }

  drawBarCentered(g, cx, y, w, frac, color) {
    this.drawBar(g, cx - w / 2, y, w, 4, frac, color);
  }
}
