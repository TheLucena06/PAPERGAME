/* controls.js
   Input layer. Turns keyboard + mouse into simple values the game uses.
   Game logic and menus NEVER read keys or the mouse directly; they read
   controller.state (gameplay) and controller.menu (menus) after poll().
   Every player picks a control type (CONTROL_TYPES) on the start screen:
   - Keyboard + mouse (only one player can have it)
   - Keyboard only, left or right side (co-op only): AUTO-AIM
   - Controller 1 / 2 (GamepadController): right stick aims. Buttons come
     from the controller setup screen (PadBindings), so cheap adapters with
     strange button numbers work too.
   makeController(type) builds the right one.

   Keyboard + mouse layout:
     WASD move · mouse aim · LMB attack · RMB swap weapon · Space dash
     Q skill 1 · E skill 2 · F consumable · Tab inventory (pause)
   Menus: WASD move the cursor · Space/Enter/click confirm · Esc/RMB back */

// Keyboard-only layouts (Phaser key names). Several keys per action = alternatives.

/* KEYBOARD SCHEMES. Every keyboard control type is a scheme: keys per action
   (Phaser key names, several = alternatives) and whether the mouse aims.
   mouse: true  -> mouse aims, LMB = attack, RMB = swap (keys add to that).
   mouse: false -> AUTO-AIM at the nearest enemy (co-op only).
   Players can rebind every key in the Controls menu (ControlsScene); the
   changes are saved in SaveData.settings.keys[scheme][action]. */
const KEY_ACTIONS = ['up', 'down', 'left', 'right', 'attack', 'dash', 'swap', 'skill1', 'skill2', 'consumable', 'inventory', 'back'];
const KEY_ACTION_NAMES = { up: 'Move up', down: 'Move down', left: 'Move left', right: 'Move right', attack: 'Attack', dash: 'Dash / confirm',
  swap: 'Swap weapon', skill1: 'Skill 1', skill2: 'Skill 2', consumable: 'Use item', inventory: 'Inventory / pause', back: 'Back (menus)' };
const KEY_SCHEMES = {
  kbm: { mouse: true, keys: {
    up: ['W'], down: ['S'], left: ['A'], right: ['D'], attack: [], dash: ['SPACE'], swap: [],
    skill1: ['Q'], skill2: ['E'], consumable: ['F'], inventory: ['TAB'], back: ['ESC'] } },
  // right side of the keyboard: left hand on the arrows (+ the keys around them), right hand on the mouse
  arrowsMouse: { mouse: true, keys: {
    up: ['UP'], down: ['DOWN'], left: ['LEFT'], right: ['RIGHT'], attack: [], dash: ['SHIFT', 'NUMPAD_ZERO'], swap: [],
    skill1: ['DELETE', 'NUMPAD_ONE'], skill2: ['END', 'NUMPAD_TWO'], consumable: ['PAGE_DOWN', 'NUMPAD_THREE'],
    inventory: ['HOME', 'NUMPAD_ADD'], back: ['BACKSPACE'] } },
  keysLeft: { mouse: false, autoAimRange: 520, keys: {
    up: ['W'], down: ['S'], left: ['A'], right: ['D'], attack: ['F'], dash: ['SPACE'], swap: ['R'],
    skill1: ['Q'], skill2: ['E'], consumable: ['C'], inventory: ['TAB'], back: ['X'] } },
  keysRight: { mouse: false, autoAimRange: 520, keys: {
    up: ['UP'], down: ['DOWN'], left: ['LEFT'], right: ['RIGHT'], attack: ['K', 'NUMPAD_ZERO'], dash: ['L', 'NUMPAD_ONE'], swap: ['J', 'NUMPAD_TWO'],
    skill1: ['I', 'NUMPAD_FOUR'], skill2: ['O', 'NUMPAD_FIVE'], consumable: ['U', 'NUMPAD_SIX'], inventory: ['P', 'NUMPAD_ADD'], back: ['BACKSPACE'] } }
};
// old names (kept so older code still works)
const CONTROL_LAYOUTS = { left: KEY_SCHEMES.keysLeft, right: KEY_SCHEMES.keysRight, p2: KEY_SCHEMES.keysRight };

// What each player can choose. coopOnly = auto-aim types (not offered solo).
const CONTROL_TYPES = {
  kbm:         { name: 'Keyboard + mouse (left side)', short: 'KB+Mouse', scheme: 'kbm' },
  arrowsMouse: { name: 'Arrows + mouse (right side)', short: 'Arrows+Mouse', scheme: 'arrowsMouse' },
  keysLeft:    { name: 'Keyboard left (auto-aim)', short: 'Keys left', coopOnly: true, scheme: 'keysLeft' },
  keysRight:   { name: 'Keyboard right (auto-aim)', short: 'Keys right', coopOnly: true, scheme: 'keysRight' },
  pad0:        { name: 'Controller 1', short: 'Pad 1', pad: 0, hint: 'left stick move · right stick aim · buttons from the controller setup' },
  pad1:        { name: 'Controller 2', short: 'Pad 2', pad: 1, hint: 'left stick move · right stick aim · buttons from the controller setup' }
};
const CONTROL_ORDER = ['kbm', 'arrowsMouse', 'pad0', 'pad1', 'keysLeft', 'keysRight'];

// Short key names for labels / hints
const KEY_SHORT = { SPACE: 'Space', ESC: 'Esc', TAB: 'Tab', SHIFT: 'Shift', CTRL: 'Ctrl', ALT: 'Alt', ENTER: 'Enter', BACKSPACE: 'Bksp',
  DELETE: 'Del', INSERT: 'Ins', HOME: 'Home', END: 'End', PAGE_UP: 'PgUp', PAGE_DOWN: 'PgDn', UP: '↑', DOWN: '↓', LEFT: '←', RIGHT: '→',
  NUMPAD_ADD: 'Num+', NUMPAD_SUBTRACT: 'Num-', NUMPAD_MULTIPLY: 'Num*', NUMPAD_DIVIDE: 'Num/', COMMA: ',', PERIOD: '.', FORWARD_SLASH: '/',
  BACK_SLASH: '\\', SEMICOLON: ';', QUOTES: "'", OPEN_BRACKET: '[', CLOSED_BRACKET: ']', MINUS: '-', PLUS: '=', BACKTICK: '`' };

const KeyBinds = {
  // Current keys of a scheme (saved changes over the defaults).
  get(scheme) {
    const def = KEY_SCHEMES[scheme], saved = (typeof SaveData !== 'undefined' && SaveData.data && SaveData.data.settings.keys) ? SaveData.data.settings.keys[scheme] : null;
    const out = {};
    for (let i = 0; i < KEY_ACTIONS.length; i++) {
      const a = KEY_ACTIONS[i];
      out[a] = (saved && Array.isArray(saved[a])) ? saved[a].slice() : def.keys[a].slice();
    }
    return out;
  },
  set(scheme, action, keys) {
    const st = SaveData.data.settings;
    if (!st.keys) st.keys = {};
    if (!st.keys[scheme]) st.keys[scheme] = {};
    st.keys[scheme][action] = keys.slice();
    SaveData.save();
  },
  reset(scheme) {
    const st = SaveData.data.settings;
    if (st.keys) delete st.keys[scheme];
    SaveData.save();
  },
  keyName(k) {
    if (KEY_SHORT[k]) return KEY_SHORT[k];
    if (k.indexOf('NUMPAD_') === 0) return 'Num' + ({ ZERO: 0, ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5, SIX: 6, SEVEN: 7, EIGHT: 8, NINE: 9 }[k.slice(7)] ?? k.slice(7));
    if (k.length > 1 && /^(ZERO|ONE|TWO|THREE|FOUR|FIVE|SIX|SEVEN|EIGHT|NINE)$/.test(k)) return '' + ['ZERO', 'ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT', 'NINE'].indexOf(k);
    return k;
  },
  // Text of one action: "LMB / F" etc.
  label(scheme, action, binds) {
    const b = binds || this.get(scheme), sc = KEY_SCHEMES[scheme];
    const parts = [];
    if (sc.mouse && action === 'attack') parts.push('LMB');
    if (sc.mouse && action === 'swap') parts.push('RMB');
    for (let i = 0; i < b[action].length; i++) parts.push(this.keyName(b[action][i]));
    return parts.join(' / ') || '—';
  },
  first(scheme, action, binds) {
    const b = binds || this.get(scheme), sc = KEY_SCHEMES[scheme];
    if (sc.mouse && action === 'attack') return 'LMB';
    if (sc.mouse && action === 'swap') return 'RMB';
    return b[action].length ? this.keyName(b[action][0]) : '-';
  },
  // Every key a scheme uses (to find clashes between players)
  allKeys(scheme) {
    const b = this.get(scheme), out = [];
    for (const a in b) for (let i = 0; i < b[a].length; i++) out.push(b[a][i]);
    return out;
  }
};

const Controls = {
  // Two choices that can't be used together (same keys / both need the mouse / same device)?
  clash(a, b) {
    if (a === b) return true;
    const sa = CONTROL_TYPES[a] && CONTROL_TYPES[a].scheme, sb = CONTROL_TYPES[b] && CONTROL_TYPES[b].scheme;
    if (!sa || !sb) return false;
    if (KEY_SCHEMES[sa].mouse && KEY_SCHEMES[sb].mouse) return true;
    const ka = KeyBinds.allKeys(sa), kb = KeyBinds.allKeys(sb);
    for (let i = 0; i < ka.length; i++) if (kb.indexOf(ka[i]) !== -1) return true;
    return false;
  },
  allowed(type, playerCount) { return !!CONTROL_TYPES[type] && !(CONTROL_TYPES[type].coopOnly && playerCount < 2); },
  // Next valid choice for player i (cycles), given the others' choices.
  next(choices, i, playerCount) {
    const cur = CONTROL_ORDER.indexOf(choices[i]);
    for (let k = 1; k <= CONTROL_ORDER.length; k++) {
      const t = CONTROL_ORDER[(cur + k) % CONTROL_ORDER.length];
      if (!this.allowed(t, playerCount)) continue;
      let ok = true;
      for (let j = 0; j < playerCount; j++) if (j !== i && this.clash(t, choices[j])) ok = false;
      if (ok) return t;
    }
    return choices[i];
  },
  // Makes a valid set (saved choices may not fit the current player count).
  // Co-op default: P1 left side of the keyboard, P2 arrows + the mouse (it's on the right).
  fix(choices, playerCount) {
    const def = playerCount > 1 ? ['keysLeft', 'arrowsMouse'] : ['kbm'];
    const out = [];
    const ok = (t) => CONTROL_TYPES[t] && this.allowed(t, playerCount) && out.every((o) => !this.clash(t, o));
    for (let i = 0; i < playerCount; i++) {
      let t = choices && choices[i];
      if (!ok(t)) t = def[i];
      if (!ok(t)) t = CONTROL_ORDER.find(ok);
      out.push(t);
    }
    return out;
  },
  // One line of help for the HUD / start screen.
  hint(type) {
    const ct = CONTROL_TYPES[type];
    if (!ct) return '';
    if (!ct.scheme) return ct.hint;
    const sc = ct.scheme, b = KeyBinds.get(sc), L = (a) => KeyBinds.label(sc, a, b);
    const mv = [b.up, b.left, b.down, b.right].map((k) => k.length ? KeyBinds.keyName(k[0]) : '').join('');
    return (mv === 'WASD' ? 'WASD' : (mv === '↑←↓→' ? 'arrows' : mv)) + ' move · ' + (KEY_SCHEMES[sc].mouse ? 'mouse aim · ' : 'auto-aim · ') +
      L('attack') + ' attack · ' + L('swap') + ' swap · ' + L('dash') + ' dash · ' + L('skill1') + '/' + L('skill2') + ' skills · ' +
      L('consumable') + ' item · ' + L('inventory') + ' inventory';
  },
  make(scene, type) {
    if (type === 'pad0' || type === 'pad1') return new GamepadController(scene, CONTROL_TYPES[type].pad);
    if (!CONTROL_TYPES[type] || !CONTROL_TYPES[type].scheme) type = 'kbm';
    return new KeyboardController(scene, type);
  }
};

/* One keyboard player (any scheme). With the mouse: aim at the pointer.
   Without: findTarget(controller, x, y) (set by the scene) gives the enemy to auto-aim at. */
class KeyboardController {
  constructor(scene, type) {
    this.scene = scene;
    this.type = type;
    this.scheme = CONTROL_TYPES[type].scheme;
    const sc = KEY_SCHEMES[this.scheme];
    this.hasPointer = !!sc.mouse;
    this.layout = sc.mouse ? null : sc;      // keyboard-only = auto-aim (GameScene checks .layout)
    this.pointer = scene.input.activePointer;
    this.findTarget = null;
    this.target = null;
    const binds = KeyBinds.get(this.scheme);
    const kb = scene.input.keyboard;
    this.keys = {};
    for (let i = 0; i < KEY_ACTIONS.length; i++) {
      const a = KEY_ACTIONS[i];
      this.keys[a] = binds[a].filter((k) => Phaser.Input.Keyboard.KeyCodes[k] !== undefined).map((k) => kb.addKey(Phaser.Input.Keyboard.KeyCodes[k], true));
    }
    kb.addCapture('UP,DOWN,LEFT,RIGHT,TAB,SPACE');   // stop the browser from scrolling / changing focus
    this.labels = {};
    const names = ['attack', 'dash', 'swap', 'skill1', 'skill2', 'consumable', 'inventory'];
    for (let i = 0; i < names.length; i++) this.labels[names[i]] = KeyBinds.first(this.scheme, names[i], binds);
    if (this.labels.dash === 'Space') this.labels.dash = 'SPC';
    this._move = { x: 0, y: 0 };
    this._aim = { x: 1, y: 0 };
    this._face = { x: 1, y: 0 };
    this._prevAttack = false; this._prevLeft = false; this._prevRight = false;
    this._prevPX = -1; this._prevPY = -1;
    this.state = { attackHeld: false, attackPressed: false, dash: false, swap: false, skill1: false, skill2: false, consumable: false, inventory: false };
    this.menu = { dx: 0, dy: 0, confirm: false, back: false, hasPointer: this.hasPointer, pointerMoved: false, click: false, px: 0, py: 0 };
    this._enter = this.hasPointer ? kb.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER, true) : null;
  }

  down(name) { const a = this.keys[name]; for (let i = 0; i < a.length; i++) if (a[i].isDown) return true; return false; }
  just(name) { const a = this.keys[name], JD = Phaser.Input.Keyboard.JustDown; let r = false; for (let i = 0; i < a.length; i++) if (JD(a[i])) r = true; return r; }

  // Call exactly once per frame, before reading state or menu.
  poll() {
    const s = this.state, m = this.menu;
    let left = false, right = false;
    if (this.hasPointer) { left = this.pointer.leftButtonDown(); right = this.pointer.rightButtonDown(); }
    const leftPressed = left && !this._prevLeft, rightPressed = right && !this._prevRight;
    this._prevLeft = left; this._prevRight = right;
    const atk = left || this.down('attack');
    s.attackHeld = atk;
    s.attackPressed = atk && !this._prevAttack;
    this._prevAttack = atk;
    s.swap = rightPressed || this.just('swap');
    s.dash = this.just('dash');
    s.skill1 = this.just('skill1');
    s.skill2 = this.just('skill2');
    s.consumable = this.just('consumable');
    s.inventory = this.just('inventory');
    m.dx = (this.just('right') ? 1 : 0) - (this.just('left') ? 1 : 0);
    m.dy = (this.just('down') ? 1 : 0) - (this.just('up') ? 1 : 0);
    const keyAttack = s.attackPressed && !leftPressed;
    m.confirm = s.dash || keyAttack || (this._enter ? Phaser.Input.Keyboard.JustDown(this._enter) : false);
    m.back = this.just('back') || (s.swap && !this.hasPointer) || rightPressed;
    m.click = leftPressed;
    if (this.hasPointer) {
      m.px = this.pointer.x; m.py = this.pointer.y;
      m.pointerMoved = (m.px !== this._prevPX || m.py !== this._prevPY);
      this._prevPX = m.px; this._prevPY = m.py;
    }
  }

  // Normalized move direction (length 0 or 1).
  getMoveDirection() {
    let x = 0, y = 0;
    if (this.down('left')) x -= 1;
    if (this.down('right')) x += 1;
    if (this.down('up')) y -= 1;
    if (this.down('down')) y += 1;
    if (x !== 0 && y !== 0) { x *= Math.SQRT1_2; y *= Math.SQRT1_2; }
    this._move.x = x; this._move.y = y;
    if (x !== 0 || y !== 0) { this._face.x = x; this._face.y = y; }
    return this._move;
  }

  getAimDirection(fromX, fromY) {
    if (this.hasPointer) {
      // screen -> world every frame (the camera can scroll while the mouse stands still)
      const wp = this.scene.cameras.main.getWorldPoint(this.pointer.x, this.pointer.y, this._wp || (this._wp = { x: 0, y: 0 }));
      const dx = wp.x - fromX, dy = wp.y - fromY;
      const len = Math.sqrt(dx * dx + dy * dy);
      if (len > 0.001) { this._aim.x = dx / len; this._aim.y = dy / len; }
      return this._aim;
    }
    // Auto-aim: the nearest enemy it can see; otherwise the way you last walked.
    const t = this.findTarget ? this.findTarget(this, fromX, fromY) : null;
    this.target = t;
    if (t) {
      const dx = t.x - fromX, dy = t.y - fromY;
      const len = Math.sqrt(dx * dx + dy * dy);
      if (len > 0.001) { this._aim.x = dx / len; this._aim.y = dy / len; return this._aim; }
    }
    this._aim.x = this._face.x; this._aim.y = this._face.y;
    return this._aim;
  }

  destroy() {
    const kb = this.scene.input.keyboard;
    if (!kb) return;
    for (const n in this.keys) for (let i = 0; i < this.keys[n].length; i++) kb.removeKey(this.keys[n][i], true);
    if (this._enter) kb.removeKey(this._enter, true);
  }
}
// old names
const KeyboardMouseController = KeyboardController;
const KeyboardOnlyController = KeyboardController;


/* ---------------- Gamepads ----------------
   Read straight from navigator.getGamepads() (works offline and on file://).
   "Controller 1" = the first connected pad, "Controller 2" = the second.
   PadBindings keeps one button/axis map per controller model (its id text),
   saved in SaveData; standard-mapping pads get a sensible default. */
const PAD_ACTIONS = ['attack', 'dash', 'swap', 'skill1', 'skill2', 'consumable', 'inventory', 'back'];
const PAD_ACTION_NAMES = { attack: 'Attack (hold)', dash: 'Dash / confirm', swap: 'Swap weapon', skill1: 'Skill 1', skill2: 'Skill 2',
                           consumable: 'Use item', inventory: 'Inventory / pause', back: 'Back (menus)' };
const STD_BUTTON_NAMES = ['X', 'O', 'Sq', 'Tri', 'L1', 'R1', 'L2', 'R2', 'Sel', 'Start', 'L3', 'R3', 'Up', 'Down', 'Left', 'Right'];

const PadBindings = {
  standard() {
    return { buttons: { attack: 7, dash: 0, swap: 3, skill1: 4, skill2: 5, consumable: 2, inventory: 9, back: 1 },
             moveX: { axis: 0, sign: 1 }, moveY: { axis: 1, sign: 1 }, aimX: { axis: 2, sign: 1 }, aimY: { axis: 3, sign: 1 },
             dpad: true, standard: true };
  },
  connected() {
    const all = (navigator.getGamepads && navigator.getGamepads()) || [];
    const out = [];
    for (let i = 0; i < all.length; i++) if (all[i] && all[i].connected !== false) out.push(all[i]);
    return out;
  },
  pad(slot) { return this.connected()[slot] || null; },
  saved(pad) {
    const s = SaveData.data.settings && SaveData.data.settings.pads;
    return s && s[pad.id] ? s[pad.id] : null;
  },
  get(pad) {
    return this.saved(pad) || this.standard();   // non-standard pads: same numbers as a guess until set up
  },
  save(pad, map) {
    SaveData.data.settings.pads[pad.id] = map;
    SaveData.save();
  },
  label(map, action) {
    const b = map.buttons[action];
    if (b === undefined || b < 0) return '-';
    return map.standard ? (STD_BUTTON_NAMES[b] || ('B' + b)) : ('B' + b);
  }
};

class GamepadController {
  constructor(scene, slot) {
    this.scene = scene;
    this.slot = slot;
    this.type = 'pad' + slot;
    this.hasPointer = false;
    this.map = PadBindings.standard();
    this.padId = null;
    this._move = { x: 0, y: 0 };
    this._aim = { x: 1, y: 0 };
    this._prev = {};
    this._held = {};
    this._menuDir = { x: 0, y: 0, ms: 0 };
    this.state = { attackHeld: false, attackPressed: false, dash: false, swap: false, skill1: false, skill2: false, consumable: false, inventory: false };
    this.menu = { dx: 0, dy: 0, confirm: false, back: false, hasPointer: false, pointerMoved: false, click: false, px: 0, py: 0 };
    this.labels = {};
    this.pad = null;
    this.refreshMap();
  }

  refreshMap() {
    const pad = PadBindings.pad(this.slot);
    this.pad = pad;
    if (pad && pad.id !== this.padId) {
      this.padId = pad.id;
      this.map = PadBindings.get(pad);
    }
    for (let i = 0; i < PAD_ACTIONS.length; i++) this.labels[PAD_ACTIONS[i]] = PadBindings.label(this.map, PAD_ACTIONS[i]);
  }

  btn(name) {
    const p = this.pad, i = this.map.buttons[name];
    if (!p || i === undefined || i < 0 || !p.buttons[i]) return false;
    const b = p.buttons[i];
    return b.pressed || b.value > 0.5;
  }

  axis(a) {
    const p = this.pad;
    if (!p || !a || a.axis < 0 || p.axes[a.axis] === undefined) return 0;
    return p.axes[a.axis] * a.sign;
  }

  poll() {
    // gamepad objects are snapshots in some browsers: fetch a fresh one every frame
    const pad = PadBindings.pad(this.slot);
    if (!pad || pad.id !== this.padId) this.refreshMap(); else this.pad = pad;
    const s = this.state, held = this._held, prev = this._prev;
    for (let i = 0; i < PAD_ACTIONS.length; i++) { const a = PAD_ACTIONS[i]; prev[a] = held[a]; held[a] = this.btn(a); }
    const just = (a) => held[a] && !prev[a];
    s.attackHeld = held.attack;
    s.attackPressed = just('attack');
    s.dash = just('dash');
    s.swap = just('swap');
    s.skill1 = just('skill1');
    s.skill2 = just('skill2');
    s.consumable = just('consumable');
    s.inventory = just('inventory');

    // menus: stick / d-pad with key-repeat
    const mv = this.readMove();
    const m = this.menu, md = this._menuDir;
    const dx = Math.abs(mv.x) > 0.5 ? Math.sign(mv.x) : 0, dy = Math.abs(mv.y) > 0.5 ? Math.sign(mv.y) : 0;
    m.dx = 0; m.dy = 0;
    if (dx !== md.x || dy !== md.y) { md.x = dx; md.y = dy; md.ms = 380; m.dx = dx; m.dy = dy; }
    else if (dx || dy) { md.ms -= this.scene.game.loop.delta; if (md.ms <= 0) { md.ms = 140; m.dx = dx; m.dy = dy; } }
    m.confirm = s.dash || s.attackPressed;
    m.back = just('back') || s.swap;
  }

  readMove() {
    let x = this.axis(this.map.moveX), y = this.axis(this.map.moveY);
    if (Math.abs(x) < 0.22) x = 0;
    if (Math.abs(y) < 0.22) y = 0;
    const p = this.pad;
    if (this.map.dpad && p && p.buttons.length > 15) {
      if (p.buttons[14].pressed) x = -1; else if (p.buttons[15].pressed) x = 1;
      if (p.buttons[12].pressed) y = -1; else if (p.buttons[13].pressed) y = 1;
    }
    this._move.x = x; this._move.y = y;
    return this._move;
  }

  getMoveDirection() {
    const m = this.readMove();
    const len = Math.sqrt(m.x * m.x + m.y * m.y);
    if (len > 1) { m.x /= len; m.y /= len; }
    if (len > 0.3 && !this.aimedOnce) { this._aim.x = m.x / Math.max(len, 1e-3); this._aim.y = m.y / Math.max(len, 1e-3); }
    return m;
  }

  // Right stick aims; let go and the aim stays where it was.
  getAimDirection() {
    const x = this.axis(this.map.aimX), y = this.axis(this.map.aimY);
    const len = Math.sqrt(x * x + y * y);
    if (len > 0.35) { this._aim.x = x / len; this._aim.y = y / len; this.aimedOnce = true; }
    return this._aim;
  }

  destroy() {}
}
