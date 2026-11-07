/* inventory.js
   Team: the shared wallet and shared inventory (stash) for all players.
   Loadout: rules for equipping items from the stash into a player's slots.
   InventoryMenu: the Tab screen. During a level only consumables can be
   changed; inside the shop everything can be equipped.

   Slots per player: weapon 1, weapon 2, armor, skill 1, skill 2, consumable.
   Consumables: the stack in a player's F slot (consumableId + consumableCount)
   is NOT in the shared inventory; team.consumables only holds stacks nobody
   has equipped. Every item is in exactly one place. */

class Team {
  constructor() {
    this.coins = 0;
    this.stash = { weapon: [], armor: [], skill: [] };
    this.consumables = {};
  }

  addItem(cat, id, count) {
    if (cat === 'consumable') this.consumables[id] = (this.consumables[id] || 0) + (count || 1);
    else this.stash[cat].push(id);
  }

  takeFromStash(cat, id) {
    const a = this.stash[cat];
    const i = a.indexOf(id);
    if (i < 0) return false;
    a.splice(i, 1);
    return true;
  }
}

const SLOT_LIST = [
  { cat: 'weapon', index: 0, label: 'Weapon 1' },
  { cat: 'weapon', index: 1, label: 'Weapon 2' },
  { cat: 'armor', index: 0, label: 'Armor' },
  { cat: 'skill', index: 0, label: 'Skill 1 [Q]' },
  { cat: 'skill', index: 1, label: 'Skill 2 [E]' },
  { cat: 'consumable', index: 0, label: 'Item [F]' }
];

const Loadout = {
  get(p, slot) {
    if (slot.cat === 'weapon') return p.weapons[slot.index];
    if (slot.cat === 'armor') return p.armor;
    if (slot.cat === 'skill') return p.skills[slot.index];
    if (slot.cat === 'consumable') return p.consumableId;
    return null;
  },

  set(p, slot, id) {
    if (slot.cat === 'weapon') { p.setWeapon(slot.index, id); return; }
    if (slot.cat === 'armor') p.armor = id;
    else if (slot.cat === 'skill') { p.skills[slot.index] = id; p.skillCdMs[slot.index] = 0; }
    else if (slot.cat === 'consumable') p.consumableId = id;
    p.recalcStats();
  },

  slotFor(cat, index) {
    for (let i = 0; i < SLOT_LIST.length; i++) if (SLOT_LIST[i].cat === cat && SLOT_LIST[i].index === index) return SLOT_LIST[i];
    return null;
  },

  firstEmpty(p, cat) {
    for (let i = 0; i < SLOT_LIST.length; i++) {
      const s = SLOT_LIST[i];
      if (s.cat === cat && !this.get(p, s)) return s;
    }
    return null;
  },

  // Where an item goes if the player didn't pick a slot: an empty one, else
  // the held weapon / skill 1 / the only armor or item slot.
  autoSlot(p, cat) {
    const empty = this.firstEmpty(p, cat);
    if (empty) return empty;
    if (cat === 'weapon') return this.slotFor('weapon', p.activeWeapon);
    return this.slotFor(cat, 0);
  },

  // Swaps two slots of the same kind (weapon 1 <-> 2, skill 1 <-> 2).
  swapSlots(p, a, b) {
    if (a.cat !== b.cat || a === b) return;
    if (a.cat === 'weapon') {
      const held = p.weapons[p.activeWeapon];
      const t = p.weapons[a.index]; p.weapons[a.index] = p.weapons[b.index]; p.weapons[b.index] = t;
      const ts = p.weaponStates[a.index]; p.weaponStates[a.index] = p.weaponStates[b.index]; p.weaponStates[b.index] = ts;
      p.activeWeapon = p.weapons[p.activeWeapon] === held ? p.activeWeapon : 1 - p.activeWeapon;   // keep holding the same weapon
      if (!p.weaponStates[p.activeWeapon]) p.activeWeapon = p.weaponStates[0] ? 0 : 1;
      p.weapon = p.weaponStates[p.activeWeapon];
      p.recalcStats();
    } else if (a.cat === 'skill') {
      const t = p.skills[a.index]; p.skills[a.index] = p.skills[b.index]; p.skills[b.index] = t;
      const c = p.skillCdMs[a.index]; p.skillCdMs[a.index] = p.skillCdMs[b.index]; p.skillCdMs[b.index] = c;
      p.recalcStats();
    }
  },

  // New consumables: into the player's slot if it's empty or the same item,
  // otherwise into the shared inventory.
  giveConsumable(team, p, id, count) {
    if (!p.consumableId) { p.consumableId = id; p.consumableCount = 0; }
    if (p.consumableId === id) p.consumableCount += count;
    else team.addItem('consumable', id, count);
  },

  // Moves `id` from the stash into the slot; the old item goes back to the stash.
  equip(team, p, slot, id) {
    if (slot.cat === 'consumable') {
      const n = team.consumables[id] || 0;
      if (n <= 0) return false;
      delete team.consumables[id];
      if (p.consumableId === id) { p.consumableCount += n; return true; }
      if (p.consumableId) team.addItem('consumable', p.consumableId, p.consumableCount);
      p.consumableId = id;
      p.consumableCount = n;
      return true;
    }
    if (!team.takeFromStash(slot.cat, id)) return false;
    const old = this.get(p, slot);
    this.set(p, slot, id);
    if (old) team.stash[slot.cat].push(old);
    return true;
  },

  // Moves the slot's item to the stash (slots may be left empty).
  unequip(team, p, slot) {
    const id = this.get(p, slot);
    if (!id) return false;
    if (slot.cat === 'consumable') {
      team.addItem('consumable', id, p.consumableCount);
      p.consumableId = null; p.consumableCount = 0;
      return true;
    }
    this.set(p, slot, null);
    team.stash[slot.cat].push(id);
    return true;
  }
};

/* Selling (only in the shop's inventory): half the price.
   Consumables sell one at a time, for half of one unit's price. */
const SELL_RATE = 0.5;
const Selling = {
  value(cat, id) {
    const def = Catalog.get(cat, id);
    if (!def) return 0;
    const unit = cat === 'consumable' ? (def.price || 0) / (def.amount || 1) : (def.price || 0);
    return Math.max(1, Math.floor(unit * SELL_RATE));
  },
  // Returns '' on success or a reason.
  fromStash(team, cat, id) {
    if (cat === 'consumable') {
      if (!(team.consumables[id] > 0)) return 'Nothing to sell.';
      team.consumables[id]--;
      if (team.consumables[id] <= 0) delete team.consumables[id];
    } else if (!team.takeFromStash(cat, id)) return 'Nothing to sell.';
    team.coins += this.value(cat, id);
    return '';
  },
  fromSlot(team, p, slot) {
    const id = Loadout.get(p, slot);
    if (!id) return 'That slot is empty.';
    if (slot.cat === 'consumable') {
      p.consumableCount--;
      if (p.consumableCount <= 0) { p.consumableId = null; p.consumableCount = 0; }
    } else {
      Loadout.set(p, slot, null);
      if (slot.cat === 'weapon' && !p.weapons[p.activeWeapon]) p.activeWeapon = 1 - slot.index;
    }
    team.coins += this.value(slot.cat, id);
    return '';
  }
};

/* ---------------- Tier stars ----------------
   Every boss unlocks a stronger gear tier (postBoss N). Stars = tier + 1.
   Gold stars = the newest tier you can get right now, grey = an older tier. */
const TierStars = {
  tier(cat, def) {
    if (!def || def.bossItem || cat === 'consumable') return -1;
    return def.postBoss || 0;
  },
  // Draws the stars right-aligned at (rx, cy). Returns their width.
  draw(g, rx, cy, cat, def, bossesBeaten, r) {
    const t = this.tier(cat, def);
    if (t < 0) return 0;
    r = r || 5;
    const n = t + 1, step = r * 2 + 2;
    const col = t >= (bossesBeaten || 0) ? 0xffb300 : 0xbdbdbd;
    for (let i = 0; i < n; i++) this.star(g, rx - r - i * step, cy, r, col);
    return n * step;
  },
  star(g, cx, cy, r, col) {
    const pts = [];
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r;
      pts.push({ x: cx + Math.cos(a) * rr, y: cy + Math.sin(a) * rr });
    }
    g.fillStyle(col, 1); g.fillPoints(pts, true);
    g.lineStyle(1, 0x5d4037, 0.6); g.strokePoints(pts, true);
  },
  text(cat, def, bossesBeaten) {
    const t = this.tier(cat, def);
    if (t < 0) return '';
    return 'Tier ' + (t + 1) + (t >= (bossesBeaten || 0) ? ' (newest)' : (t + 1 < (bossesBeaten || 0) ? ' (outdated)' : ' (older)'));
  }
};

/* ---------------- Item stats (numbers for the inventory / shop details) ---------------- */
const STAT_NAMES = {
  maxHp: ['Max HP', 'add'], maxMana: ['Max mana', 'add'], defense: ['Defense', 'pct'], damageMul: ['Damage', 'mulpct'],
  attackSpeedMul: ['Attack speed', 'mulpct'], moveSpeedMul: ['Speed', 'mulpct'], manaRegenMul: ['Mana regen', 'mulpct'],
  manaCostMul: ['Mana cost', 'mulpct'], chargeSpeedMul: ['Charge speed', 'mulpct'], dashCooldownMul: ['Dash cooldown', 'mulpct'],
  skillCooldownMul: ['Skill cooldown', 'mulpct'], critChance: ['Crit', 'pct'], dodgeChance: ['Dodge', 'pct'],
  coinMul: ['Coins', 'pct'], bossDamage: ['Boss damage', 'pct'], lifeSteal: ['Life steal', 'pct'], burnDamage: ['Burn damage', 'pct'], burnTime: ['Burn time', 'pct'], chainBonus: ['Chain jumps', 'add'], allyDamage: ['Ally damage', 'pct'], raiseChance: ['Raise chance', 'pct'], hexTime: ['Hex time', 'pct'], hexChance: ['Hex chance', 'pct'], multiShot: ['Extra arrows', 'add'], damageTakenMul: ['Damage taken', 'mulpct'], blockBonus: ['Block', 'pct'], manaRegen: ['Mana regen', 'add']
};
const ItemStats = {
  f(n) { return Math.round(n * 10) / 10; },
  // Short lines with the numbers that matter. p (optional) = the player, for "with your gear".
  lines(cat, def, p) {
    if (!def) return [];
    const out = [], f = this.f, cd = (ms) => f(ms / 1000) + ' s';
    if (cat === 'weapon') {
      const k = def.kind;
      if (k === 'melee') {
        const dps = def.damage * 1000 / def.cooldownMs;
        out.push('Damage ' + def.damage + '  ·  ' + f(1000 / def.cooldownMs) + ' hits/s  ·  ~' + Math.round(dps) + ' DPS');
        const bm = def.bossMul || (def.class === 'melee' ? 1.25 : 1);
        if (bm > 1 || def.projectile) out.push((bm > 1 ? 'Bosses take +' + Math.round((bm - 1) * 100) + '%' : '') +
          (def.projectile ? (bm > 1 ? '  ·  ' : '') + 'Shoots ' + (def.projectile.count || 1) + ' × ' + def.projectile.damage + (def.projectileEvery > 1 ? ' every ' + def.projectileEvery + ' swings' : ' every swing') : ''));
        out.push('Reach ' + def.range + '  ·  Arc ' + def.arcDeg + '°' + (def.maxTargets ? '  ·  Max ' + def.maxTargets + ' targets' : '') +
                 (def.heavy ? '  ·  Heavy ' + def.heavy.damage + ' every ' + def.heavyEvery : '') + (def.spinKick ? '  ·  Spin kick ' + def.spinKick.damage : ''));
      } else if (k === 'charge') {
        out.push('Full charge: ' + def.fullDamage + ' in ' + cd(def.fullChargeMs) + '  ·  Pierces ' + def.pierceCount + ' at ' + cd(def.pierceChargeMs));
        out.push('Quick shot: ' + def.minDamage + '–' + def.maxDamage + (def.manaCost ? '  ·  Mana ' + def.manaCost : ''));
      } else if (k === 'crossbow') {
        out.push('Bolt ' + def.damage + ' × up to ' + def.maxLoaded + '  ·  Load ' + cd(def.loadMs) + ' each' + (def.pierce ? '  ·  Pierce ' + def.pierce : ''));
      } else if (k === 'throw') {
        out.push('Damage ' + def.damage + ' × ' + def.ammo + ' throw' + (def.ammo > 1 ? 's' : '') + '  ·  Range ' + def.range + '  ·  Wall stun ' + cd(def.wallStunMs));
      } else if (k === 'gun') {
        out.push('Damage ' + def.damage + '  ·  ' + def.shells + ' shells  ·  Reload ' + cd(def.reloadMs) + (def.pierce ? '  ·  Pierce ' + def.pierce : ''));
      } else if (k === 'projectile') {
        const n = def.count || 1;
        out.push('Damage ' + def.damage + (n > 1 ? ' × ' + n : '') + '  ·  ' + f(1000 / def.fireDelayMs) + ' casts/s  ·  ~' + Math.round(def.damage * n * 1000 / def.fireDelayMs) + ' DPS  ·  Mana ' + def.manaCost);
        const extra = this.shotExtras(def);
        if (extra) out.push(extra);
      } else if (k === 'orbit') {
        out.push(def.orbs + ' orbs × ' + def.orbDamage + ' per touch (every ' + cd(def.hitCdMs) + ' per enemy)  ·  Drains ' + def.manaPerSec + ' mana/s');
        out.push('Let go: ' + def.orbs + ' × ' + def.release.damage + (this.shotExtras(def.release) ? '  ·  ' + this.shotExtras(def.release) : ''));
      } else if (k === 'tome') {
        out.push('Pages (' + f(1000 / def.fireDelayMs) + ' casts/s, mana ' + def.manaCost + '): ' + def.pages.map((pg) =>
          pg.type === 'nova' ? 'nova ' + pg.damage : pg.type === 'summon' ? 'summon' : pg.type === 'point' ? 'area ' + pg.damage :
          (pg.count > 1 ? pg.count + '×' + pg.damage : 'bolt ' + pg.damage)).join(' → '));
      } else if (k === 'shield') {
        out.push('Blocks ' + Math.round(def.blockPct * 100) + '% (' + def.arcDeg + '° front)  ·  Parry stun ' + cd(def.stunMs));
      }
      if (def.mods) out.push('While held: ' + this.mods(def.mods));
    } else if (cat === 'armor') {
      if (def.mods) out.push(this.mods(def.mods));
    } else if (cat === 'skill') {
      out.push((def.mega ? 'MEGA SPELL  ·  ' : '') + 'Mana ' + (def.manaCost || 0) + '  ·  Cooldown ' + cd(def.cooldownMs || 0) + (def.damage ? '  ·  Damage ' + def.damage : ''));
      if (def.mega && p && p.stats) out.push('Your max mana: ' + p.stats.maxMana + (p.stats.maxMana < def.manaCost ? '  (not enough yet!)' : '  (enough)'));
    }
    if (p && p.stats && cat !== 'consumable' && p.stats.damageMul !== 1) out.push('Your damage bonus now: ×' + f(p.stats.damageMul));
    return out;
  },
  shotExtras(sh) {
    const e = [];
    if (sh.pierce) e.push(sh.pierce >= 99 ? 'goes through everything' : 'pierce ' + sh.pierce);
    if (sh.aoe) e.push('area ' + sh.aoe);
    if (sh.ignite) e.push('burn ' + this.f(sh.ignite.ms / 1000) + ' s');
    if (sh.chill) e.push('slow ' + Math.round(sh.chill.pct * 100) + '%');
    if (sh.chain) e.push('jumps to ' + sh.chain.n + ' more');
    if (sh.homing) e.push('homing');
    if (sh.knockback) e.push('pushes back');
    return e.join('  ·  ');
  },
  mods(m) {
    const parts = [];
    for (const k in m) {
      const n = STAT_NAMES[k];
      if (!n) continue;
      const v = m[k];
      if (n[1] === 'add') parts.push(n[0] + ' ' + (v > 0 ? '+' : '') + v);
      else parts.push(n[0] + ' ' + (v > 0 ? '+' : '') + Math.round(v * 100) + '%');
    }
    return parts.join('  ·  ');
  }
};

/* ---------------- Inventory screen ----------------
   Click (or confirm) anything to SELECT it: its details + numbers appear at the
   bottom right with action buttons (Equip into a slot, Unequip, Swap slots, Sell).
   Shortcuts: slot then item (or item then slot) = put it there; a slot then the
   other slot of the same kind = swap them. Slots may be left empty.
   mode 'play': only the item slot [F] can change. mode 'shop': everything + selling. */
class InventoryMenu {
  constructor(scene, players, team, mode, onClose) {
    this.scene = scene;
    this.players = players;
    this.team = team;
    this.mode = mode;
    this.onClose = onClose;
    this.nav = new MenuNav(players.length);
    this.sel = [];
    for (let i = 0; i < players.length; i++) this.sel.push(null);
    this.root = null;
    this.cursorG = null;
    this.build();
  }

  canChange(cat) {
    return this.mode === 'shop' || cat === 'consumable';
  }

  bossesBeaten() { return this.scene.bossesBeaten || 0; }

  build() {
    if (this.root) this.root.destroy(true);
    const sc = this.scene, W = GAME_CONFIG.width, H = GAME_CONFIG.height, np = this.players.length;
    const root = sc.add.container(0, 0).setDepth(300).setScrollFactor(0);   // screen space (camera may scroll)
    this.root = root;
    const ink = '#37474f';
    const T = (x, y, str, size, color, bold) => {
      const t = sc.add.text(x, y, str, { fontFamily: 'Arial, sans-serif', fontSize: size + 'px', color: color || ink, fontStyle: bold ? 'bold' : 'normal' });
      root.add(t);
      return t;
    };
    this.T = T;

    const bg = sc.add.graphics();
    bg.fillStyle(0x2b2622, 0.55); bg.fillRect(0, 0, W, H);
    bg.fillStyle(0xfdf6e3, 1); bg.fillRoundedRect(16, 12, W - 32, H - 24, 10);
    bg.lineStyle(3, 0x37474f, 0.5); bg.strokeRoundedRect(16, 12, W - 32, H - 24, 10);
    root.add(bg);
    const boxes = sc.add.graphics();
    root.add(boxes);
    this.boxes = boxes;

    T(32, 22, 'Inventory', 28, ink, true);
    T(200, 22, this.mode === 'play'
      ? 'Game paused. Click anything to see its numbers.\nOnly the item slot [F] can change during a level (gear: in the shop).'
      : 'Click anything to see its numbers and what you can do with it.\nShortcut: click a slot, then an item (or the other way round).', 12, '#8d6e63');

    const nodes = [];
    nodes.push({ kind: 'close', x: W - 150, y: 22, w: 118, h: 30 });
    if (this.mode === 'shop') T(W - 150 - 130, 29, 'Coins: ' + this.team.coins, 15, '#8d6e00', true);

    // ---- player slots (left) ----
    const rowH = np > 1 ? 32 : 40, rowGap = np > 1 ? 5 : 7;
    for (let pi = 0; pi < np; pi++) {
      const p = this.players[pi];
      const top = 70 + pi * 270;
      T(32, top, np > 1 ? 'Player ' + (pi + 1) : 'Your gear', 16, np > 1 ? '#' + PLAYER_CURSOR_COLORS[pi].toString(16).padStart(6, '0') : ink, true);
      for (let i = 0; i < SLOT_LIST.length; i++) {
        const slot = SLOT_LIST[i];
        const id = Loadout.get(p, slot);
        const def = Catalog.get(slot.cat, id);
        const n = { kind: 'slot', owner: pi, slot: slot, id: id, cat: slot.cat, x: 32, y: top + 24 + i * (rowH + rowGap), w: 300, h: rowH };
        nodes.push(n);
        let name = def ? def.name : '— empty —';
        if (slot.cat === 'weapon' && slot.index === p.activeWeapon && def) name += '  (held)';
        if (slot.cat === 'consumable' && def) name += '  x' + p.consumableCount;
        T(n.x + 8, n.y + (np > 1 ? 2 : 4), slot.label + (this.canChange(slot.cat) ? '' : '  · locked until the shop'), 10, '#8d6e63');
        const nt = T(n.x + 8, n.y + (np > 1 ? 14 : 18), name, np > 1 ? 13 : 14, def ? ink : '#b0a49a', !!def);
        if (def) nt.setFontStyle(Catalog.nameStyle(def));
      }
      // a compact stat summary under the slots
      const s = p.stats;
      const sumY = top + 24 + SLOT_LIST.length * (rowH + rowGap) + 2;
      T(32, sumY, 'HP ' + s.maxHp + '  ·  MP ' + s.maxMana + '  ·  Def ' + Math.round(Math.min(DEFENSE_CAP, s.defense) * 100) + '%  ·  Dmg ×' + ItemStats.f(s.damageMul) +
        '  ·  Speed ×' + ItemStats.f(s.moveSpeedMul), 11, '#6d4c41', true);
      // set bonuses (2 / 4 / 6 items of one sub class)
      const sets = Stats.sets(p);
      let sy = sumY + 16;
      for (let k = 0; k < sets.length && k < (np > 1 ? 0 : 3); k++) {
        const st = sets[k];
        T(32, sy, st.sub + ' set ' + st.count + '/6: ' + st.tiers.map((t) => (t[2] ? '✓' : '·') + t[0] + ' ' + t[1]).join('   '), 10, '#2e7d32', true).setWordWrapWidth(300);
        sy += 28;
      }
    }

    // ---- shared stash (right) ----
    const sx = 356, cw = 136, ch = 32, gap = 6, cols = 4, stashBottom = H - 214;
    let y = 66;
    T(sx, y, 'Shared bag', 16, ink, true);
    y += 24;
    const sections = [['weapon', 'Weapons'], ['armor', 'Armor'], ['skill', 'Skills'], ['consumable', 'Items']];
    for (let s = 0; s < sections.length; s++) {
      const cat = sections[s][0];
      const entries = [];
      if (cat === 'consumable') { for (const id in this.team.consumables) if (this.team.consumables[id] > 0) entries.push(id); }
      else for (let i = 0; i < this.team.stash[cat].length; i++) entries.push(this.team.stash[cat][i]);
      T(sx, y, sections[s][1] + (entries.length ? '' : ':  (none)'), 11, '#8d6e63', true);
      y += 15;
      for (let i = 0; i < entries.length; i++) {
        const id = entries[i], def = Catalog.get(cat, id);
        const n = { kind: 'stash', cat: cat, id: id, x: sx + (i % cols) * (cw + gap), y: y + Math.floor(i / cols) * (ch + gap), w: cw, h: ch };
        if (n.y + ch > stashBottom) break;            // (very full bag) keep the details panel visible
        nodes.push(n);
        let label = def.name;
        if (cat === 'consumable') label += ' x' + this.team.consumables[id];
        T(n.x + 6, n.y + 2, label, label.length > 15 ? 10 : 12, ink, true).setFontStyle(Catalog.nameStyle(def));
        T(n.x + 6, n.y + 17, Catalog.classLine(def) || 'Item', 10, def.class ? CLASS_COLORS[def.class] : '#8d6e63');
      }
      if (entries.length) y += Math.ceil(entries.length / cols) * (ch + gap) + 4;
    }

    // ---- details + actions (bottom right), one column per player ----
    this.details = [];
    const dx0 = sx, dy = H - 206, dwAll = W - 32 - sx, dh = 182;
    for (let pi = 0; pi < np; pi++) {
      const dw = dwAll / np, x = dx0 + pi * dw;
      boxes.fillStyle(0xffffff, 1); boxes.fillRoundedRect(x, dy, dw - 8, dh, 6);
      boxes.lineStyle(np > 1 ? 2 : 1, np > 1 ? PLAYER_CURSOR_COLORS[pi] : 0x37474f, np > 1 ? 0.8 : 0.35); boxes.strokeRoundedRect(x, dy, dw - 8, dh, 6);
      const d = { x: x, y: dy, w: dw - 8, h: dh,
        name: T(x + 10, dy + 7, '', 16, ink, true),
        cls: T(x + 10, dy + 27, '', 11, '#8d6e63', true),
        desc: T(x + 10, dy + 44, '', np > 1 ? 11 : 12, '#4e342e'),
        stats: T(x + 10, dy + 100, '', 11, '#1565c0', true),
        stars: sc.add.graphics(), key: '' };
      root.add(d.stars);
      d.desc.setWordWrapWidth(d.w - 20).setLineSpacing(1);
      d.stats.setWordWrapWidth(d.w - 20).setLineSpacing(2);
      this.details.push(d);
      // action buttons for this player's selection
      const acts = this.actions(pi);
      let ax = x + 8, ay = dy + dh - 32;
      for (let k = 0; k < acts.length; k++) {
        const a = acts[k];
        const aw = Math.min(d.w - 16, Math.max(70, a.label.length * 6.6 + 18));
        if (ax + aw > x + d.w - 4) { ax = x + 8; ay -= 30; }
        const n = { kind: 'act', owner: pi, act: a, x: ax, y: ay, w: aw, h: 26 };
        nodes.push(n);
        boxes.fillStyle(a.color || 0x37474f, 1); boxes.fillRoundedRect(n.x, n.y, n.w, n.h, 4);
        T(n.x + n.w / 2, n.y + 13, a.label, 12, '#fdf6e3', true).setOrigin(0.5);
        ax += aw + 6;
      }
    }

    // boxes for slots / stash / close
    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i];
      if (n.kind === 'act') continue;
      if (n.kind === 'close') { boxes.fillStyle(0x37474f, 1); boxes.fillRect(n.x, n.y, n.w, n.h); continue; }
      const locked = !this.canChange(n.cat);
      boxes.fillStyle(locked ? 0xf3efe6 : 0xffffff, 1); boxes.fillRect(n.x, n.y, n.w, n.h);
      boxes.lineStyle(1, 0x37474f, 0.35); boxes.strokeRect(n.x, n.y, n.w, n.h);
      if (n.id) TierStars.draw(boxes, n.x + n.w - 5, n.y + 9, n.cat, Catalog.get(n.cat, n.id), this.bossesBeaten(), 4);
    }
    T(W - 136, 28, 'Close [Tab]', 15, '#fdf6e3', true);

    this.message = T(32, H - 40, '', 13, '#c62828', true);
    this.message.setWordWrapWidth(310);
    this.cursorG = sc.add.graphics();
    root.add(this.cursorG);
    this.nav.setNodes(nodes);
  }

  // The buttons a player gets for what they selected.
  actions(pi) {
    const sel = this.sel[pi], p = this.players[pi], out = [];
    if (!sel) return out;
    const shop = this.mode === 'shop';
    if (!this.canChange(sel.cat)) return out;
    if (sel.kind === 'stash') {
      for (let i = 0; i < SLOT_LIST.length; i++) {
        const slot = SLOT_LIST[i];
        if (slot.cat !== sel.cat) continue;
        const cur = Catalog.get(slot.cat, Loadout.get(p, slot));
        out.push({ type: 'equip', slot: slot, label: 'Equip → ' + slot.label.replace(/ \[.\]/, '') + (cur && sel.cat !== 'consumable' ? ' (swap)' : ''), color: 0x2e7d32 });
      }
      if (shop) out.push({ type: 'sell', label: 'Sell +' + Selling.value(sel.cat, sel.id), color: 0xc62828 });
    } else if (sel.kind === 'slot' && sel.id) {
      out.push({ type: 'unequip', label: 'Unequip (to bag)', color: 0x6d4c41 });
      if (sel.cat === 'weapon' || sel.cat === 'skill') {
        const other = Loadout.slotFor(sel.cat, 1 - sel.slot.index);
        out.push({ type: 'swap', slot: other, label: (Loadout.get(p, other) ? 'Swap with ' : 'Move to ') + other.label.replace(/ \[.\]/, ''), color: 0x37474f });
      }
      if (shop) out.push({ type: 'sell', label: 'Sell +' + Selling.value(sel.cat, sel.id) + (sel.cat === 'consumable' ? ' (one)' : ''), color: 0xc62828 });
    }
    out.push({ type: 'cancel', label: 'Cancel', color: 0x9e9e9e });
    return out;
  }

  // Called every frame while open. Returns true when the menu closed.
  update() {
    for (let pi = 0; pi < this.players.length; pi++) {
      const c = this.players[pi].controller;
      if (c.state.inventory) { this.close(); return true; }
      if (c.menu.back) {
        if (this.sel[pi]) { this.sel[pi] = null; this.rebuild(); continue; }
        this.close(); return true;
      }
      const node = this.nav.handle(pi, c.menu);
      if (node && this.select(pi, node)) return true;
    }
    this.draw();
    return false;
  }

  say(msg, color) { this.message.setText(msg).setColor(color || '#c62828'); }

  // Returns true if the menu closed.
  select(pi, node) {
    const p = this.players[pi], sel = this.sel[pi];
    this.message.setText('');
    if (node.kind === 'close') { this.close(); return true; }
    if (node.kind === 'act') { this.doAction(pi, node.act); return false; }
    if (!this.canChange(node.cat)) {
      this.sel[pi] = { kind: node.kind, cat: node.cat, id: node.id, slot: node.slot };
      this.rebuild();
      this.say('You can only change this in the shop.', '#8d6e63');
      return false;
    }
    if (node.kind === 'slot') {
      if (sel && sel.kind === 'stash' && sel.cat === node.cat) { this.equip(pi, node.slot, sel.id); return false; }
      if (sel && sel.kind === 'slot' && sel.slot !== node.slot && sel.cat === node.cat && sel.owner === pi) { this.swap(pi, sel.slot, node.slot); return false; }
      this.sel[pi] = (sel && sel.kind === 'slot' && sel.slot === node.slot) ? null : { kind: 'slot', cat: node.cat, id: node.id, slot: node.slot, owner: pi };
      this.rebuild();
      if (this.sel[pi] && !node.id) this.say('Now pick an item from the bag to put in ' + node.slot.label + '.', '#ef6c00');
      return false;
    }
    if (node.kind === 'stash') {
      if (sel && sel.kind === 'slot' && sel.cat === node.cat) { this.equip(pi, sel.slot, node.id); return false; }
      this.sel[pi] = (sel && sel.kind === 'stash' && sel.id === node.id && sel.cat === node.cat) ? null : { kind: 'stash', cat: node.cat, id: node.id };
      this.rebuild();
    }
    return false;
  }

  equip(pi, slot, id) {
    const def = Catalog.get(slot.cat, id);
    if (Loadout.equip(this.team, this.players[pi], slot, id)) this.say('Equipped ' + def.name + '.', '#2e7d32');
    this.sel[pi] = null;
    this.rebuild();
  }

  swap(pi, a, b) {
    Loadout.swapSlots(this.players[pi], a, b);
    this.sel[pi] = null;
    this.rebuild();
    this.say('Swapped.', '#2e7d32');
  }

  doAction(pi, a) {
    const p = this.players[pi], sel = this.sel[pi];
    if (!sel) return;
    if (a.type === 'cancel') { this.sel[pi] = null; this.rebuild(); return; }
    if (a.type === 'equip') { this.equip(pi, a.slot, sel.id); return; }
    if (a.type === 'swap') { this.swap(pi, sel.slot, a.slot); return; }
    if (a.type === 'unequip') {
      Loadout.unequip(this.team, p, sel.slot);
      this.sel[pi] = null; this.rebuild();
      this.say('Moved to the bag.', '#2e7d32');
      return;
    }
    if (a.type === 'sell') {
      const def = Catalog.get(sel.cat, sel.id), val = Selling.value(sel.cat, sel.id);
      const why = sel.kind === 'slot' ? Selling.fromSlot(this.team, p, sel.slot) : Selling.fromStash(this.team, sel.cat, sel.id);
      // a stack of items: keep it selected while some are left
      const left = sel.kind === 'slot' ? Loadout.get(p, sel.slot) === sel.id : (sel.cat === 'consumable' ? this.team.consumables[sel.id] > 0 : false);
      if (!left) this.sel[pi] = null;
      this.rebuild();
      if (why) this.say(why);
      else this.say('Sold ' + def.name + ' for ' + val + ' coins.', '#2e7d32');
    }
  }

  rebuild() {
    const keep = [];
    for (let pi = 0; pi < this.players.length; pi++) {
      const n = this.nav.current(pi);
      keep.push(n ? { kind: n.kind, cat: n.cat, slot: n.slot, id: n.id } : null);
    }
    const msg = this.message ? this.message.text : '', col = this.message ? this.message.style.color : null;
    this.build();
    this.message.setText(msg); if (col) this.message.setColor(col);
    for (let pi = 0; pi < keep.length; pi++) {
      const k = keep[pi];
      if (!k) continue;
      for (let i = 0; i < this.nav.nodes.length; i++) {
        const n = this.nav.nodes[i];
        if (n.kind === k.kind && n.kind !== 'act' && (n.kind === 'slot' ? (n.slot === k.slot && n.owner === pi) : (n.cat === k.cat && n.id === k.id))) {
          this.nav.setCurrent(pi, n); break;
        }
      }
    }
  }

  draw() {
    const g = this.cursorG;
    g.clear();
    for (let pi = 0; pi < this.players.length; pi++) {
      const sel = this.sel[pi];
      if (sel) {
        for (let i = 0; i < this.nav.nodes.length; i++) {
          const n = this.nav.nodes[i];
          const isSel = (n.kind === sel.kind) && (n.kind === 'slot' ? (n.slot === sel.slot && n.owner === pi) : (n.kind === 'stash' && n.cat === sel.cat && n.id === sel.id));
          const fits = this.canChange(sel.cat) && n.cat === sel.cat && !isSel && ((sel.kind === 'slot' && n.kind === 'stash') || (n.kind === 'slot' && n.owner === pi));
          if (isSel) { g.fillStyle(0xffc107, 0.28); g.fillRect(n.x, n.y, n.w, n.h); g.lineStyle(3, 0xffa000, 1); g.strokeRect(n.x, n.y, n.w, n.h); }
          else if (fits) { g.lineStyle(2, 0xffa000, 0.6); g.strokeRect(n.x + 1, n.y + 1, n.w - 2, n.h - 2); }
        }
      }
      // details: the selected thing, else what the cursor is on
      const cur = this.nav.current(pi);
      const focus = sel || (cur && cur.id ? cur : null);
      const d = this.details[pi];
      const key = focus ? focus.cat + ':' + focus.id + (sel ? '*' : '') : '';
      if (key === d.key) continue;
      d.key = key;
      d.stars.clear();
      const def = focus ? Catalog.get(focus.cat, focus.id) : null;
      if (!def) {
        d.name.setText(sel ? 'Empty slot' : ''); d.cls.setText(''); d.stats.setText('');
        d.desc.setText(sel ? 'Pick an item from the bag (highlighted) to put here.' : 'Point at an item to see its numbers.\nClick it for actions.');
        continue;
      }
      d.name.setText(def.name).setFontStyle(Catalog.nameStyle(def));
      const tierTxt = TierStars.text(focus.cat, def, this.bossesBeaten());
      d.cls.setText((def.class ? Catalog.classLine(def) : 'Item') + (tierTxt ? '   ·   ' + tierTxt : '') +
        (this.mode === 'shop' ? '   ·   sells for ' + Selling.value(focus.cat, focus.id) : ''));
      d.desc.setText(def.desc.replace(/\n/g, ' '));
      const sl = ItemStats.lines(focus.cat, def, this.players[pi]);
      d.stats.setY(d.desc.y + d.desc.height + 6).setText(sl.join('\n'));
      TierStars.draw(d.stars, d.x + d.w - 10, d.y + 15, focus.cat, def, this.bossesBeaten(), 7);
    }
    this.nav.drawCursors(g);
  }

  close() {
    if (this.root) { this.root.destroy(true); this.root = null; }
    if (this.onClose) this.onClose();
  }
}
