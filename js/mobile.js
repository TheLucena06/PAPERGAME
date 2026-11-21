/* mobile.js  (Phase 3c: phones and tablets)
   One game for PC and phones: on a touch screen the "Touch" control type is
   picked automatically (single player). PC keeps everything it had.

   Touch controls (Brawl Stars style, landscape):
   - LEFT side: a floating stick appears where your thumb lands = move.
   - RIGHT side: a floating stick = aim + attack. Drag it to attack where it
     points. Charge weapons (bows, crossbows) fire when you let go; everything
     else keeps attacking while you hold. Double-tap it = swap weapon.
   - Buttons: Dash, Skill 1, Skill 2, Item, Pause (= inventory).
     Move / resize them in "Touch layout" (main menu), with a reset.
   - Menus: tap = click. Touch and HOLD on anything = a magnifier, so small
     text can be read (letting go after a hold doesn't click).

   The phone version is the same files, served from a website (see HOSTING.md). */

const IS_TOUCH = (function () {
  try {
    const coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
    return !!(coarse && (navigator.maxTouchPoints > 0 || 'ontouchstart' in window)) || /[?&]touch\b/.test(location.search);
  } catch (e) { return false; }
})();

CONTROL_TYPES.touch = { name: 'Touch screen', short: 'Touch', touch: true, hint: 'left thumb: move · right thumb: drag to aim + attack (double-tap: swap) · buttons: dash, skills, item' };
if (IS_TOUCH) CONTROL_ORDER.unshift('touch');
(function () {
  const allowed = Controls.allowed, fix = Controls.fix, make = Controls.make;
  Controls.allowed = function (type, playerCount) {
    if (type === 'touch') return IS_TOUCH && playerCount < 2;      // co-op on phones = online, later
    return allowed.call(Controls, type, playerCount);
  };
  Controls.fix = function (choices, playerCount) {
    if (IS_TOUCH && playerCount < 2 && !(choices && choices[0] && Controls.allowed(choices[0], 1) && choices[0] !== 'kbm')) return ['touch'];
    return fix.call(Controls, choices, playerCount);
  };
  Controls.make = function (scene, type) {
    if (type === 'touch') return new TouchController(scene);
    return make.call(Controls, scene, type);
  };
})();

/* ---------------- layout (positions in game pixels, 960 x 640) ---------------- */
const TOUCH_LAYOUT_DEFAULT = {
  dash:     { x: 868, y: 540, r: 46, label: 'DASH' },
  skill1:   { x: 770, y: 594, r: 33, label: 'S1' },
  skill2:   { x: 778, y: 486, r: 33, label: 'S2' },
  item:     { x: 880, y: 426, r: 29, label: 'ITEM' },
  pause:    { x: 480, y: 26,  r: 22, label: 'II' },
  moveStick: { x: 150, y: 500, r: 62, label: 'MOVE', stick: true },
  aimStick:  { x: 640, y: 500, r: 62, label: 'AIM', stick: true }
};
const TouchLayout = {
  get(id) {
    const d = TOUCH_LAYOUT_DEFAULT[id];
    const s = (typeof SaveData !== 'undefined' && SaveData.data && SaveData.data.settings.touch) ? SaveData.data.settings.touch[id] : null;
    return { x: s ? s.x : d.x, y: s ? s.y : d.y, r: d.r * (s ? s.s : 1), s: s ? s.s : 1, label: d.label, stick: d.stick };
  },
  set(id, x, y, s) {
    const st = SaveData.data.settings;
    if (!st.touch) st.touch = {};
    st.touch[id] = { x: Math.round(x), y: Math.round(y), s: Math.round(s * 100) / 100 };
    SaveData.save();
  },
  reset() { if (SaveData.data.settings.touch) SaveData.data.settings.touch = {}; SaveData.save(); },
  buttons: ['dash', 'skill1', 'skill2', 'item', 'pause']
};

/* ---------------- the controller ---------------- */
class TouchController {
  constructor(scene) {
    this.scene = scene;
    this.type = 'touch';
    this.hasPointer = true;           // menus: tap = click
    this.layout = null;               // (not auto-aim)
    this.findTarget = null; this.target = null;
    this.labels = { attack: 'R', dash: 'DASH', swap: '2x', skill1: 'S1', skill2: 'S2', consumable: 'ITEM', inventory: 'II' };
    this.state = { attackHeld: false, attackPressed: false, dash: false, swap: false, skill1: false, skill2: false, consumable: false, inventory: false };
    this.menu = { dx: 0, dy: 0, confirm: false, back: false, hasPointer: true, pointerMoved: false, click: false, px: 0, py: 0 };
    this._move = { x: 0, y: 0 }; this._aim = { x: 1, y: 0 };
    this.moveT = null;                // { id, bx, by, x, y }
    this.aimT = null;                 // { id, bx, by, x, y, startMs, dragged }
    this.btnT = {};                   // pointer id -> button id
    this.lastTapEnd = -1e9;
    this.wasDown = {};                // pointer id -> was down last frame
    this.menuDown = null;             // { id, x, y, ms } for taps in menus
    this.pressed = {};                // button presses this frame
    this.g = scene.add.graphics().setDepth(260).setScrollFactor(0);
    this.texts = {};
    for (let i = 0; i < TouchLayout.buttons.length; i++) {
      const id = TouchLayout.buttons[i];
      this.texts[id] = scene.add.text(0, 0, '', { fontFamily: 'Arial, sans-serif', fontSize: '13px', color: '#fdf6e3', fontStyle: 'bold', align: 'center' })
        .setOrigin(0.5).setDepth(261).setScrollFactor(0);
    }
    this.reloadLayout();
  }

  reloadLayout() {
    this.L = {};
    for (const id in TOUCH_LAYOUT_DEFAULT) this.L[id] = TouchLayout.get(id);
  }

  pointers() { return this.scene.input.manager.pointers.filter((p) => p.wasTouch || p.pointerType === 'touch' || p.id > 0); }

  buttonAt(x, y) {
    for (let i = 0; i < TouchLayout.buttons.length; i++) {
      const id = TouchLayout.buttons[i], b = this.L[id];
      const dx = x - b.x, dy = y - b.y, rr = b.r + 8;
      if (dx * dx + dy * dy <= rr * rr) return id;
    }
    return null;
  }

  poll() {
    const s = this.state, m = this.menu, sc = this.scene;
    const playing = sc.mode === 'play' && !sc.gameOver;
    const now = sc.time.now;
    s.dash = s.swap = s.skill1 = s.skill2 = s.consumable = s.inventory = false;
    m.click = false; m.confirm = false; m.back = false; m.dx = 0; m.dy = 0; m.pointerMoved = false;
    const ps = this.scene.input.manager.pointers;
    const seen = {};
    for (let i = 0; i < ps.length; i++) {
      const p = ps[i];
      if (p === this.scene.input.mousePointer && !p.wasTouch) continue;
      const id = p.id, down = p.isDown, was = !!this.wasDown[id];
      seen[id] = true;
      if (down && !was) this.onDown(p, playing, now);
      else if (down) this.onHold(p, playing);
      else if (!down && was) this.onUp(p, playing, now);
      this.wasDown[id] = down;
    }
    // sticks
    if (this.moveT) {
      const dx = this.moveT.x - this.moveT.bx, dy = this.moveT.y - this.moveT.by, len = Math.sqrt(dx * dx + dy * dy), r = this.L.moveStick.r;
      if (len < 10) { this._move.x = 0; this._move.y = 0; }
      else { const k = Math.min(1, len / r); this._move.x = dx / len * k; this._move.y = dy / len * k; }
    } else { this._move.x = 0; this._move.y = 0; }
    let atk = false;
    if (this.aimT) {
      const dx = this.aimT.x - this.aimT.bx, dy = this.aimT.y - this.aimT.by, len = Math.sqrt(dx * dx + dy * dy);
      if (len > 16) { this.aimT.dragged = true; this._aim.x = dx / len; this._aim.y = dy / len; }
      atk = this.aimT.dragged;
    }
    s.attackPressed = atk && !s.attackHeld;
    s.attackHeld = playing && atk;
    this.draw(playing);
  }

  onDown(p, playing, now) {
    if (!playing) {                                   // menus: remember the press; a click on release
      this.menuDown = { id: p.id, x: p.x, y: p.y, ms: now };
      this.menu.px = p.x; this.menu.py = p.y; this.menu.pointerMoved = true;
      return;
    }
    const b = this.buttonAt(p.x, p.y);
    if (b) {
      this.btnT[p.id] = b;
      if (b === 'dash') this.state.dash = true;
      else if (b === 'skill1') this.state.skill1 = true;
      else if (b === 'skill2') this.state.skill2 = true;
      else if (b === 'item') this.state.consumable = true;
      else if (b === 'pause') this.state.inventory = true;
      this.pressed[b] = now;
      return;
    }
    if (p.x < GAME_CONFIG.width * 0.45) {
      if (!this.moveT) this.moveT = { id: p.id, bx: p.x, by: p.y, x: p.x, y: p.y };
    } else if (!this.aimT) {
      // double-tap on the aim side = swap weapon
      if (now - this.lastTapEnd < 420) { this.state.swap = true; this.lastTapEnd = -1e9; }
      this.aimT = { id: p.id, bx: p.x, by: p.y, x: p.x, y: p.y, startMs: now, dragged: false };
    }
  }

  onHold(p, playing) {
    if (!playing) {
      if (this.menuDown && this.menuDown.id === p.id) { this.menu.px = p.x; this.menu.py = p.y; this.menu.pointerMoved = true; }
      return;
    }
    if (this.moveT && this.moveT.id === p.id) {
      this.moveT.x = p.x; this.moveT.y = p.y;
      // floating: if the thumb goes far, the base follows it
      const dx = p.x - this.moveT.bx, dy = p.y - this.moveT.by, len = Math.sqrt(dx * dx + dy * dy), r = this.L.moveStick.r * 1.3;
      if (len > r) { this.moveT.bx = p.x - dx / len * r; this.moveT.by = p.y - dy / len * r; }
    } else if (this.aimT && this.aimT.id === p.id) { this.aimT.x = p.x; this.aimT.y = p.y; }
  }

  onUp(p, playing, now) {
    if (this.btnT[p.id]) { delete this.btnT[p.id]; return; }
    if (this.moveT && this.moveT.id === p.id) { this.moveT = null; return; }
    if (this.aimT && this.aimT.id === p.id) {
      if (!this.aimT.dragged && now - this.aimT.startMs < 350) this.lastTapEnd = now;   // a tap (for double-tap)
      this.aimT = null;
      return;
    }
    if (this.menuDown && this.menuDown.id === p.id) {
      const md = this.menuDown;
      this.menuDown = null;
      if (Magnifier.consumeHold()) return;            // it was a hold to read: no click
      const dx = p.x - md.x, dy = p.y - md.y;
      if (dx * dx + dy * dy < 30 * 30) { this.menu.click = true; this.menu.px = p.x; this.menu.py = p.y; }
    }
  }

  getMoveDirection() { return this._move; }
  getAimDirection() { return this._aim; }

  // on-screen sticks and buttons
  draw(playing) {
    const g = this.g, sc = this.scene;
    g.clear();
    for (const id in this.texts) this.texts[id].setVisible(playing);
    if (!playing) return;
    const now = sc.time.now;
    const stick = (t, def, col) => {
      if (t) {
        g.fillStyle(0x000000, 0.12); g.fillCircle(t.bx, t.by, def.r);
        g.lineStyle(2, col, 0.5); g.strokeCircle(t.bx, t.by, def.r);
        const dx = t.x - t.bx, dy = t.y - t.by, len = Math.sqrt(dx * dx + dy * dy) || 1, k = Math.min(len, def.r);
        g.fillStyle(col, 0.55); g.fillCircle(t.bx + dx / len * k, t.by + dy / len * k, def.r * 0.42);
      } else {
        g.lineStyle(2, col, 0.16); g.strokeCircle(def.x, def.y, def.r);        // where to put your thumb
      }
    };
    stick(this.moveT, this.L.moveStick, 0x37474f);
    stick(this.aimT, this.L.aimStick, this.aimT && this.aimT.dragged ? 0xc62828 : 0x37474f);
    // buttons (with cooldowns from the player)
    const pl = sc.players && sc.players.find((q) => q.controller === this);
    for (let i = 0; i < TouchLayout.buttons.length; i++) {
      const id = TouchLayout.buttons[i], b = this.L[id];
      const hot = this.pressed[id] && now - this.pressed[id] < 140;
      let label = b.label, cd = 0;
      if (pl) {
        if (id === 'skill1' || id === 'skill2') {
          const k = id === 'skill1' ? 0 : 1, sd = Catalog.get('skill', pl.skills[k]);
          label = sd ? sd.short : '-';
          if (sd && pl.skillCdMs[k] > 0) cd = Math.min(1, pl.skillCdMs[k] / (sd.cooldownMs * pl.stats.skillCooldownMul || 1));
        } else if (id === 'item') {
          const cdef = Catalog.get('consumable', pl.consumableId);
          label = cdef ? cdef.short + '\nx' + pl.consumableCount : '-';
        } else if (id === 'dash' && pl.dashCdMs > 0) cd = Math.min(1, pl.dashCdMs / pl.stats.dashCooldownMs);
      }
      g.fillStyle(hot ? 0xffb300 : 0x263238, hot ? 0.8 : 0.42); g.fillCircle(b.x, b.y, b.r);
      if (cd > 0) { g.fillStyle(0x000000, 0.35); g.slice(b.x, b.y, b.r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * cd, false); g.fillPath(); }
      g.lineStyle(2, 0xfdf6e3, 0.55); g.strokeCircle(b.x, b.y, b.r);
      const t = this.texts[id];
      if (t.text !== label) t.setText(label);
      t.setPosition(b.x, b.y).setFontSize(Math.max(10, Math.round(b.r * 0.38)) + 'px');
    }
  }

  destroy() {
    if (this.g) this.g.destroy();
    for (const id in this.texts) this.texts[id].destroy();
  }
}

/* ---------------- magnifier: touch and hold to read ---------------- */
const Magnifier = {
  el: null, ctx: null, timer: null, shown: false, used: false, x: 0, y: 0, sx: 0, sy: 0, raf: 0,
  init(game) {
    if (!IS_TOUCH) return;
    this.game = game;
    const c = document.createElement('canvas');
    c.style.cssText = 'position:fixed;display:none;pointer-events:none;z-index:50;border:3px solid #37474f;border-radius:10px;box-shadow:0 4px 14px rgba(0,0,0,.5);background:#fdf6e3';
    document.body.appendChild(c);
    this.el = c; this.ctx = c.getContext('2d');
    const opts = { passive: true };
    window.addEventListener('touchstart', (e) => this.start(e), opts);
    window.addEventListener('touchmove', (e) => this.move(e), opts);
    window.addEventListener('touchend', () => this.end(), opts);
    window.addEventListener('touchcancel', () => this.end(), opts);
  },
  // not while playing (the sticks need long presses)
  allowed() {
    const g = this.game;
    if (!g) return false;
    const gs = g.scene.getScene('GameScene');
    if (gs && gs.scene.isActive() && gs.mode === 'play' && !gs.gameOver) return false;
    return true;
  },
  start(e) {
    if (e.touches.length !== 1) { this.end(); return; }
    this.used = false;
    const t = e.touches[0];
    this.sx = this.x = t.clientX; this.sy = this.y = t.clientY;
    clearTimeout(this.timer);
    this.timer = setTimeout(() => { if (this.allowed()) this.show(); }, 450);
  },
  move(e) {
    const t = e.touches[0];
    if (!t) return;
    this.x = t.clientX; this.y = t.clientY;
    if (!this.shown && Math.abs(this.x - this.sx) + Math.abs(this.y - this.sy) > 14) clearTimeout(this.timer);
  },
  end() {
    clearTimeout(this.timer);
    if (this.shown) { this.shown = false; this.el.style.display = 'none'; cancelAnimationFrame(this.raf); }
  },
  show() {
    this.shown = true; this.used = true;
    const w = Math.min(420, window.innerWidth * 0.6), h = w * 0.45;
    this.el.width = Math.round(w * (window.devicePixelRatio || 1)); this.el.height = Math.round(h * (window.devicePixelRatio || 1));
    this.el.style.width = w + 'px'; this.el.style.height = h + 'px';
    this.el.style.display = 'block';
    const loop = () => { if (!this.shown) return; this.draw(w, h); this.raf = requestAnimationFrame(loop); };
    loop();
  },
  draw(w, h) {
    const src = this.game.canvas, r = src.getBoundingClientRect();
    const zoom = 2.2, sw = w / zoom, sh = h / zoom;
    const kx = src.width / r.width, ky = src.height / r.height;
    const cx = (this.x - r.left) * kx, cy = (this.y - r.top) * ky;
    this.ctx.fillStyle = '#fdf6e3'; this.ctx.fillRect(0, 0, this.el.width, this.el.height);
    try {
      this.ctx.drawImage(src, cx - sw * kx / 2, cy - sh * ky / 2, sw * kx, sh * ky, 0, 0, this.el.width, this.el.height);
    } catch (e) { /* (canvas not ready) */ }
    // above the finger (below it near the top of the screen)
    let top = this.y - h - 50;
    if (top < 6) top = this.y + 50;
    this.el.style.left = Math.max(6, Math.min(window.innerWidth - w - 6, this.x - w / 2)) + 'px';
    this.el.style.top = top + 'px';
  },
  // true once after a hold (so letting go doesn't click)
  consumeHold() { const u = this.used; this.used = false; return u; }
};

// Phaser buttons outside the game scene (main menu, Pencil Case...): a hold to read is not a click.
function touchHoldGuard(fn) {
  return function () { if (IS_TOUCH && Magnifier.used) { Magnifier.used = false; return; } return fn.apply(this, arguments); };
}

/* ---------------- full screen + landscape (phones) ---------------- */
const MobileScreen = {
  init() {
    if (!IS_TOUCH) return;
    const go = () => {
      const el = document.documentElement;
      try {
        if (!document.fullscreenElement && el.requestFullscreen) el.requestFullscreen({ navigationUI: 'hide' }).then(() => {
          if (screen.orientation && screen.orientation.lock) screen.orientation.lock('landscape').catch(() => {});
        }).catch(() => {});
      } catch (e) { /* iPhone: no fullscreen in the browser; "Add to Home Screen" instead */ }
    };
    window.addEventListener('touchend', go, { once: true });
  }
};

/* ---------------- touch layout editor ---------------- */
class TouchLayoutScene extends Phaser.Scene {
  constructor() { super('TouchLayoutScene'); }
  init(data) { this.back = (data && data.back) || 'MainMenuScene'; this.sel = (data && data.sel) || 'dash'; }
  create() {
    const W = GAME_CONFIG.width, H = GAME_CONFIG.height;
    MenuUI.paper(this);
    MenuUI.text(this, null, W / 2, 70, 'Touch layout', 30, '#37474f', true).setOrigin(0.5);
    MenuUI.text(this, null, W / 2, 104, 'Drag a button to move it. Tap one, then use − / + to resize it.\nThe two dashed circles show where the sticks first appear (they float under your thumb).', 13, '#8d6e63').setOrigin(0.5).setAlign('center');
    MenuUI.button(this, null, W / 2 - 170, 150, '  −  ', () => this.resize(-0.1), '#5d4037', 18);
    this.selText = MenuUI.text(this, null, W / 2, 158, '', 16, '#37474f', true).setOrigin(0.5, 0);
    MenuUI.button(this, null, W / 2 + 130, 150, '  +  ', () => this.resize(0.1), '#5d4037', 18);
    MenuUI.button(this, null, W / 2 - 230, 200, ' Reset to default ', () => { TouchLayout.reset(); this.scene.restart({ back: this.back, sel: this.sel }); }, '#c62828', 15);
    MenuUI.button(this, null, W / 2 + 60, 200, '   Done   ', () => this.scene.start(this.back), '#2e7d32', 15);
    this.g = this.add.graphics();
    this.labels = {};
    for (const id in TOUCH_LAYOUT_DEFAULT) this.labels[id] = this.add.text(0, 0, TOUCH_LAYOUT_DEFAULT[id].label, { fontFamily: 'Arial', fontSize: '13px', color: '#fdf6e3', fontStyle: 'bold' }).setOrigin(0.5);
    this.drag = null;
    this.input.on('pointerdown', (p) => {
      const id = this.hit(p.x, p.y);
      if (!id) return;
      this.sel = id;
      const L = TouchLayout.get(id);
      this.drag = { id: id, ox: L.x - p.x, oy: L.y - p.y };
      this.redraw();
    });
    this.input.on('pointermove', (p) => {
      if (!this.drag || !p.isDown) return;
      const L = TouchLayout.get(this.drag.id);
      TouchLayout.set(this.drag.id, Phaser.Math.Clamp(p.x + this.drag.ox, 20, W - 20), Phaser.Math.Clamp(p.y + this.drag.oy, 20, H - 20), L.s);
      this.redraw();
    });
    this.input.on('pointerup', () => { this.drag = null; });
    this.redraw();
  }
  hit(x, y) {
    let best = null, bd = 1e9;
    for (const id in TOUCH_LAYOUT_DEFAULT) {
      const L = TouchLayout.get(id), dx = x - L.x, dy = y - L.y, d = dx * dx + dy * dy;
      if (d <= (L.r + 10) * (L.r + 10) && d < bd) { bd = d; best = id; }
    }
    return best;
  }
  resize(k) {
    const L = TouchLayout.get(this.sel);
    TouchLayout.set(this.sel, L.x, L.y, Phaser.Math.Clamp(L.s + k, 0.6, 1.8));
    this.redraw();
  }
  redraw() {
    const g = this.g;
    g.clear();
    for (const id in TOUCH_LAYOUT_DEFAULT) {
      const L = TouchLayout.get(id), on = id === this.sel;
      if (L.stick) {
        g.lineStyle(2, on ? 0xffb300 : 0x37474f, 0.8);
        for (let a = 0; a < 24; a += 2) { g.beginPath(); g.arc(L.x, L.y, L.r, a * Math.PI / 12, (a + 1) * Math.PI / 12); g.strokePath(); }
      } else {
        g.fillStyle(on ? 0xffb300 : 0x263238, 0.6); g.fillCircle(L.x, L.y, L.r);
        g.lineStyle(2, 0xfdf6e3, 0.7); g.strokeCircle(L.x, L.y, L.r);
      }
      this.labels[id].setPosition(L.x, L.y).setColor(L.stick ? '#37474f' : '#fdf6e3');
    }
    const L = TouchLayout.get(this.sel);
    this.selText.setText(TOUCH_LAYOUT_DEFAULT[this.sel].label + '  ·  size ' + Math.round(L.s * 100) + '%');
  }
}
