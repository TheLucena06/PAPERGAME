/* shop.js
   SHOP_SETTINGS (data), ShopLogic (stock, buying, reroll, buff choices),
   ShopMenu (shop screen) and BuffMenu (free passive buff pick).
   Both screens use MenuNav, so every player has their own cursor.
   Bought items go into the buyer's empty matching slot, otherwise into the
   shared inventory (equip them from the Inventory button / Tab). */

const SHOP_SETTINGS = {
  // Always this many offers of each kind (boss loot comes on top, in its own cards)
  solo: { weapon: 4, armor: 3, skill: 2, consumable: 2 },
  coop: { weapon: 4, armor: 3, skill: 2, consumable: 2 },
  rerollBase: 5,
  rerollStep: 5,      // each reroll in the same visit costs this much more
  buffChoices: 3,
  postBossWeight: 2.5   // after a boss, post-boss items are this many times more likely to be offered
};

const ShopLogic = {
  // Can this item show up in a normal shop right now?
  unlocked(def, level, bossesBeaten) {
    if (def.debugOnly && !Meta.off) return false;          // Test Dungeon only
    if (def.phaseOut && (bossesBeaten || 0) >= def.phaseOut) return false;   // plain bolts leave the shops at ★★★
    if (def.bossItem) return false;                       // boss loot only in its own shop
    if (def.blueprint && !SaveData.hasBlueprint(def.blueprint)) return false;   // not found yet
    if (def.postBoss && (bossesBeaten || 0) < def.postBoss) return false;
    if (GAME_CONFIG.debug.postBossShopOnly && bossesBeaten > 0 && !def.postBoss) return false;
    return !level || (def.minLevel || 1) <= level;
  },

  // Highest postBoss tier of any shop item.
  maxTier() {
    let m = 0;
    const cats = ['weapon', 'armor', 'skill', 'consumable'];
    for (let c = 0; c < cats.length; c++) { const tb = Catalog.table(cats[c]); for (const id in tb) m = Math.max(m, tb[id].postBoss || 0); }
    return m;
  },

  // Is there any shop item of exactly this tier?
  hasTier(t) {
    const cats = ['weapon', 'armor', 'skill', 'consumable'];
    for (let c = 0; c < cats.length; c++) { const tb = Catalog.table(cats[c]); for (const id in tb) if ((tb[id].postBoss || 0) === t && !tb[id].bossItem) return true; }
    return false;
  },

  // Every boss unlocks a new tier (postBoss: N). The newest tier is offered most,
  // older tiers less, and tier-0 starters fade out after 2 bosses.
  tierWeight(def, bossesBeaten) {
    const t = def.postBoss || 0, b = bossesBeaten || 0;
    if (!b) return 1;
    if (t === b) return SHOP_SETTINGS.postBossWeight;
    if (t > 0) return 1.2;
    return b >= 2 ? 0.6 : 1;
  },

  // Picks n different ids (weighted: post-boss items are favored after a boss).
  pickRandom(table, n, level, bossesBeaten) {
    const ids = Object.keys(table).filter((id) => level === undefined || this.unlocked(table[id], level, bossesBeaten));
    const w = ids.map((id) => this.tierWeight(table[id], bossesBeaten));
    const out = [];
    while (out.length < n && ids.length) {
      let total = 0;
      for (let i = 0; i < w.length; i++) total += w[i];
      let r = Math.random() * total, k = 0;
      for (; k < w.length - 1; k++) { r -= w[k]; if (r <= 0) break; }
      out.push(ids[k]); ids.splice(k, 1); w.splice(k, 1);
    }
    return out;
  },

  // level = the level just cleared (items with a higher minLevel don't show up yet)
  generate(playerCount, level, bossesBeaten) {
    const counts = playerCount > 1 ? SHOP_SETTINGS.coop : SHOP_SETTINGS.solo;
    const offers = [];
    const cats = ['weapon', 'armor', 'skill', 'consumable'];
    for (let c = 0; c < cats.length; c++) {
      const want = counts[cats[c]];
      const ids = this.pickRandom(Catalog.table(cats[c]), want, level, bossesBeaten);
      // Early levels have few unlocked items (most armor starts at level 2):
      // fill the missing cards with the next items to unlock, lowest level first.
      if (ids.length < want) this.fillUp(Catalog.table(cats[c]), ids, want, bossesBeaten);
      for (let i = 0; i < ids.length; i++) offers.push({ cat: cats[c], id: ids[i], sold: false });
    }
    return offers;
  },

  fillUp(table, ids, want, bossesBeaten) {
    const extra = Object.keys(table).filter((id) => ids.indexOf(id) === -1 && this.unlocked(table[id], 0, bossesBeaten));
    for (let i = extra.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const t = extra[i]; extra[i] = extra[j]; extra[j] = t; }
    extra.sort((a, b) => (table[a].minLevel || 1) - (table[b].minLevel || 1));
    for (let i = 0; i < extra.length && ids.length < want; i++) ids.push(extra[i]);
  },

  // Every item dropped by this boss (all offered at once after beating it).
  bossLoot(bossId) {
    const out = [];
    const cats = ['weapon', 'armor', 'skill', 'consumable'];
    for (let c = 0; c < cats.length; c++) {
      const t = Catalog.table(cats[c]);
      for (const id in t) if (t[id].bossItem === bossId) out.push({ cat: cats[c], id: id, sold: false, boss: true });
    }
    return out;
  },

  price(offer) {
    return Catalog.get(offer.cat, offer.id).price;
  },

  // Returns '' on success, or a short reason why not.
  buy(team, player, offer) {
    if (offer.sold) return 'Sold out.';
    const def = Catalog.get(offer.cat, offer.id);
    if (team.coins < def.price) return 'Not enough coins.';
    team.coins -= def.price;
    if (offer.cat === 'consumable') {
      Loadout.giveConsumable(team, player, offer.id, def.amount);
    } else {
      team.addItem(offer.cat, offer.id);
      const slot = Loadout.firstEmpty(player, offer.cat);
      if (slot) Loadout.equip(team, player, slot, offer.id);
      offer.sold = true;
      return '';
    }
    offer.sold = true;
    return '';
  },

  buffChoices() {
    return this.pickRandom(PASSIVE_BUFFS, SHOP_SETTINGS.buffChoices + Meta.rank('biggerMenu'));
  },

  // Hands an item over (no paying): equips it in an empty slot, else into the
  // shared inventory. Used by the merchant, chests and mimics.
  give(team, player, cat, id) {
    const def = Catalog.get(cat, id);
    if (cat === 'consumable') { Loadout.giveConsumable(team, player, id, def.amount || 1); return; }
    team.addItem(cat, id);
    const slot = Loadout.firstEmpty(player, cat);
    if (slot) Loadout.equip(team, player, slot, id);
  }
};

/* ---------- small drawing helpers shared by the shop screens ---------- */
const MenuDraw = {
  panel(sc, root, W, H) {
    const bg = sc.add.graphics();
    bg.fillStyle(0x2b2622, 0.6); bg.fillRect(0, 0, W, H);
    bg.fillStyle(0xfdf6e3, 1); bg.fillRoundedRect(12, 10, W - 24, H - 20, 10);
    bg.lineStyle(3, 0x37474f, 0.5); bg.strokeRoundedRect(12, 10, W - 24, H - 20, 10);
    root.add(bg);
  },
  text(sc, root, x, y, str, size, color, bold) {
    const t = sc.add.text(x, y, str, { fontFamily: 'Arial, sans-serif', fontSize: size + 'px',
      color: color || '#37474f', fontStyle: bold ? 'bold' : 'normal', lineSpacing: 2 });
    root.add(t);
    return t;
  },
  coin(g, x, y, s) {
    g.fillStyle(GAME_CONFIG.colors.coin, 1); g.fillRect(x, y, s, s);
    g.lineStyle(2, 0x8d6e00, 1); g.strokeRect(x, y, s, s);
  }
};

/* ---------------- Shop screen ---------------- */
class ShopMenu {
  // opts: { bossesBeaten, bossLoot: bossId or null, subtitle }
  constructor(scene, players, team, level, callbacks, opts) {
    this.scene = scene;
    this.players = players;
    this.team = team;
    this.level = level;
    this.cb = callbacks; // { onInventory(), onDone() }
    this.opts = opts || {};
    this.offers = ShopLogic.generate(players.length, level, this.opts.bossesBeaten);
    this.loot = this.opts.bossLoot ? ShopLogic.bossLoot(this.opts.bossLoot) : [];
    // items reserved at the wandering merchant (guaranteed here, normal price)
    const res = this.opts.reserved || [];
    for (let i = 0; i < res.length; i++) this.loot.push({ cat: res[i].cat, id: res[i].id, sold: false, reserved: true });
    this.rerolls = 0;
    this.ready = [];
    for (let i = 0; i < players.length; i++) this.ready.push(false);
    this.nav = new MenuNav(players.length);
    this.root = null;
    this.messageMs = 0;
    this.build();
  }

  rerollCost() {
    if (this.rerolls === 0 && this.opts.freeReroll) return 0;            // Lucky Dice (Pencil Case)
    const n = this.opts.freeReroll ? this.rerolls - 1 : this.rerolls;
    return SHOP_SETTINGS.rerollBase + n * SHOP_SETTINGS.rerollStep;
  }

  // Layout: small cards on the left (name, class, price), a big detail panel
  // on the right for what each player's cursor is on, buttons under it.
  build() {
    const keep = [];
    for (let pi = 0; pi < this.players.length; pi++) {
      const n = this.nav.current(pi);
      keep.push(n ? this.nav.nodes.indexOf(n) : -1);
    }
    if (this.root) this.root.destroy(true);
    const sc = this.scene, W = GAME_CONFIG.width, H = GAME_CONFIG.height;
    const root = sc.add.container(0, 0).setDepth(300).setScrollFactor(0);   // screen space (camera may scroll)
    this.root = root;
    MenuDraw.panel(sc, root, W, H);
    const T = (x, y, s, size, color, bold) => MenuDraw.text(sc, root, x, y, s, size, color, bold);

    T(28, 18, 'Shop', 28, null, true);
    T(118, 30, this.opts.subtitle || ('Level ' + this.level + ' cleared'), 14, this.loot.length ? '#6a1b9a' : '#8d6e63', !!this.loot.length);
    const g = sc.add.graphics();
    root.add(g);
    MenuDraw.coin(g, 520, 26, 18);
    this.coinText = T(544, 22, '' + this.team.coins, 22, null, true);

    const nodes = [];
    const LX = 28, cw = 140, ch = 62, gap = 9, cols = 4;
    let y = 66;
    const section = (label, items) => {
      if (!items.length) return;
      T(LX, y, label, 13, '#8d6e63', true);
      y += 19;
      for (let i = 0; i < items.length; i++) {
        const n = items[i];
        n.x = LX + (i % cols) * (cw + gap); n.y = y + Math.floor(i / cols) * (ch + gap); n.w = cw; n.h = ch;
        nodes.push(n);
      }
      y += Math.ceil(items.length / cols) * (ch + gap) + 6;
    };
    const all = this.offers.concat(this.loot);
    const by = (cat) => all.filter((o) => o.cat === cat).map((o) => ({ kind: 'offer', offer: o, cat: o.cat, id: o.id }));
    section('Weapons', by('weapon'));
    section('Armor', by('armor'));
    section('Skills', by('skill'));
    section('Items', by('consumable'));

    // Cards
    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i];
      const def = Catalog.get(n.cat, n.id);
      const sold = n.offer.sold;
      const col = def.class ? CLASS_COLORS[def.class] : '#8d6e63';
      g.fillStyle(sold ? 0xeeeeee : 0xffffff, 1); g.fillRect(n.x, n.y, n.w, n.h);
      g.lineStyle(1, 0x37474f, 0.35); g.strokeRect(n.x, n.y, n.w, n.h);
      g.fillStyle(Phaser.Display.Color.HexStringToColor(col).color, 1); g.fillRect(n.x, n.y, 5, n.h);
      if (n.offer.boss || n.offer.reserved) { g.lineStyle(3, n.offer.boss ? BOSS_LOOT_COLOR : 0x2e7d32, sold ? 0.3 : 0.9); g.strokeRect(n.x + 1, n.y + 1, n.w - 2, n.h - 2); }
      const nm = T(n.x + 11, n.y + 6, def.name, def.name.length > 20 ? 11 : (def.name.length > 16 ? 12 : 14), sold ? '#9e9e9e' : null, true);
      nm.setFontStyle(Catalog.nameStyle(def));
      const tag = n.offer.boss ? 'BOSS LOOT' : (n.offer.reserved ? 'RESERVED' : null);
      T(n.x + 11, n.y + 25, tag || (def.class ? Catalog.classLine(def) : 'Item'), 11, n.offer.boss ? '#6a1b9a' : (n.offer.reserved ? '#2e7d32' : col), !!tag);
      if (!sold) TierStars.draw(g, n.x + n.w - 7, n.y + 50, n.cat, def, this.opts.bossesBeaten, 5);   // gear tier: gold = newest
      if (sold) T(n.x + 11, n.y + 41, 'SOLD', 13, '#9e9e9e', true);
      else {
        MenuDraw.coin(g, n.x + 11, n.y + 44, 11);
        T(n.x + 27, n.y + 41, '' + def.price, 14, this.team.coins >= def.price ? '#37474f' : '#c62828', true);
      }
    }

    // Right side: detail panel(s) + buttons
    const RX = 640, RW = W - 28 - RX, top = 62, btnH = 54, btnY = H - 28 - btnH;
    const per = (btnY - 12 - top) / this.players.length;
    this.details = [];
    for (let pi = 0; pi < this.players.length; pi++) {
      const dy = top + pi * per;
      g.fillStyle(0xffffff, 1); g.fillRoundedRect(RX, dy, RW, per - 10, 6);
      g.lineStyle(this.players.length > 1 ? 2 : 1, this.players.length > 1 ? PLAYER_CURSOR_COLORS[pi] : 0x37474f, this.players.length > 1 ? 0.8 : 0.35);
      g.strokeRoundedRect(RX, dy, RW, per - 10, 6);
      const big = this.players.length === 1;
      const d = {
        name: T(RX + 14, dy + 12, '', big ? 22 : 18, null, true),
        cls: T(RX + 14, dy + (big ? 42 : 36), '', big ? 14 : 13, '#8d6e63', true),
        desc: T(RX + 14, dy + (big ? 68 : 58), '', big ? 15 : 13, '#4e342e'),
        price: T(RX + 14, dy + per - (big ? 44 : 36), '', big ? 16 : 14, '#37474f', true),
        key: null
      };
      d.desc.setWordWrapWidth(RW - 28).setLineSpacing(big ? 5 : 3);
      this.details.push(d);
    }
    const allReady = this.ready.filter((r) => r).length;
    const bw = (RW - 16) / 3;
    const btns = [{ kind: 'reroll' }, { kind: 'inventory' }, { kind: 'ready' }];
    for (let i = 0; i < btns.length; i++) {
      const n = btns[i];
      n.x = RX + i * (bw + 8); n.y = btnY; n.w = bw; n.h = btnH;
      nodes.push(n);
      g.fillStyle(n.kind === 'ready' ? 0x2e7d32 : 0x37474f, 1); g.fillRoundedRect(n.x, n.y, n.w, n.h, 5);
      let title = '', sub = '';
      if (n.kind === 'reroll') { title = 'Reroll'; sub = this.rerollCost() + ' coins'; }
      if (n.kind === 'inventory') { title = 'Inventory'; sub = 'equip / sell [Tab]'; }
      if (n.kind === 'ready') { title = 'Ready'; sub = this.players.length > 1 ? allReady + '/' + this.players.length + ' ready' : 'leave shop'; }
      T(n.x + n.w / 2, n.y + 18, title, 16, '#fdf6e3', true).setOrigin(0.5);
      T(n.x + n.w / 2, n.y + 39, sub, 11, '#e0d6c4').setOrigin(0.5);
    }

    if (this.players.length > 1) T(LX, H - 64, 'Each player: move keys (or the mouse) to pick, attack / dash to press, back key to go back.', 12, '#8d6e63');
    this.messageText = T(LX, H - 44, '', 15, '#c62828', true);
    this.cursorG = sc.add.graphics();
    root.add(this.cursorG);

    this.nav.setNodes(nodes);
    for (let pi = 0; pi < keep.length; pi++) if (keep[pi] >= 0 && keep[pi] < nodes.length) this.nav.setCurrent(pi, nodes[keep[pi]]);
  }

  // Fills a detail panel (only when the cursor moved to a different card).
  showDetail(pi) {
    const d = this.details[pi];
    const n = this.nav.current(pi);
    const key = n ? (n.kind === 'offer' ? n.cat + ':' + n.id + (n.offer.sold ? ':s' : '') : n.kind) : '';
    if (d.key === key && d.coins === this.team.coins) return;
    d.key = key; d.coins = this.team.coins;
    let name = '', cls = '', desc = '', price = '', clsCol = '#8d6e63', priceCol = '#37474f';
    if (n && n.kind === 'offer') {
      const def = Catalog.get(n.cat, n.id);
      name = def.name;
      cls = (n.offer.boss ? 'Boss loot  ·  ' : '') + (def.class ? Catalog.classLine(def) : 'Item');
      if (def.class) clsCol = CLASS_COLORS[def.class];
      if (n.offer.boss) clsCol = '#6a1b9a';
      desc = def.desc.replace(/\n/g, ' ');   // the panel wraps the text itself
      const tt = TierStars.text(n.cat, def, this.opts.bossesBeaten);
      if (tt) cls += '  ·  ' + tt;
      const sl = ItemStats.lines(n.cat, def, this.players[pi]);
      if (sl.length) desc += '\n\n' + sl.join('\n');
      if (n.cat === 'consumable' && def.amount > 1) desc += '\n(' + def.amount + ' per purchase)';
      if (n.offer.sold) { price = 'Sold'; priceCol = '#9e9e9e'; }
      else { price = 'Price: ' + def.price + ' coins'; if (this.team.coins < def.price) { price += '  (not enough)'; priceCol = '#c62828'; } }
    } else if (n && n.kind === 'reroll') { name = 'Reroll'; desc = 'Replace the normal stock with new items.' + (this.loot.length ? ' Boss loot stays.' : '') + '\nEach reroll this visit costs 5 more.'; price = 'Cost: ' + this.rerollCost() + ' coins'; }
    else if (n && n.kind === 'inventory') { name = 'Inventory'; desc = 'Equip what you bought, swap slots, or SELL items you don\'t need for half their price.'; }
    else if (n && n.kind === 'ready') { name = 'Ready'; desc = this.players.length > 1 ? 'The shop closes when every player is ready.' : 'Leave the shop and go to the next level.'; }
    d.name.setText(name);
    d.cls.setText(cls).setColor(clsCol);
    d.desc.setText(desc);
    d.price.setText(price).setColor(priceCol);
    if (n && n.kind === 'offer') d.name.setFontStyle(Catalog.nameStyle(Catalog.get(n.cat, n.id)));
  }

  say(msg) {
    this.messageText.setText(msg);
    this.messageMs = 1800;
  }

  update(dt) {
    if (this.messageMs > 0) { this.messageMs -= dt; if (this.messageMs <= 0) this.messageText.setText(''); }
    for (let pi = 0; pi < this.players.length; pi++) {
      const c = this.players[pi].controller;
      if (c.state.inventory) { this.cb.onInventory(); return; }
      const node = this.nav.handle(pi, c.menu);
      if (node && this.select(pi, node)) return;
    }
    this.draw();
  }

  // Returns true if the shop is finished (or another screen opened).
  select(pi, node) {
    const p = this.players[pi];
    if (node.kind === 'offer') {
      const why = ShopLogic.buy(this.team, p, node.offer);
      if (why) { this.say(why); return false; }
      const def = Catalog.get(node.cat, node.id);
      this.build();
      if (node.cat === 'consumable') this.say(p.consumableId === node.id ? def.name + ' added to your item slot [F].' : def.name + ' went to the shared inventory.');
      else if (Loadout.get(p, Loadout.autoSlot(p, node.cat)) === node.id) this.say(def.name + ' equipped.');
      else this.say(def.name + ' went to the shared inventory.');
      return false;
    }
    if (node.kind === 'reroll') {
      const cost = this.rerollCost();
      if (this.team.coins < cost) { this.say('Not enough coins.'); return false; }
      this.team.coins -= cost;
      this.rerolls++;
      this.offers = ShopLogic.generate(this.players.length, this.level, this.opts.bossesBeaten);   // boss loot stays
      this.build();
      return false;
    }
    if (node.kind === 'inventory') { this.cb.onInventory(); return true; }
    if (node.kind === 'ready') {
      this.ready[pi] = !this.ready[pi];
      if (this.ready.every((r) => r)) { this.close(); this.cb.onDone(); return true; }
      this.build();
    }
    return false;
  }

  draw() {
    const g = this.cursorG;
    g.clear();
    this.nav.drawCursors(g);
    for (let pi = 0; pi < this.details.length; pi++) this.showDetail(pi);
    if (this.coinText.text !== '' + this.team.coins) this.coinText.setText('' + this.team.coins);
  }

  // Shop hides while the inventory is open, then comes back.
  hide() { if (this.root) this.root.setVisible(false); }
  show() { if (this.root) { this.build(); this.root.setVisible(true); } }

  close() {
    if (this.root) { this.root.destroy(true); this.root = null; }
  }
}

/* ---------------- Free passive buff pick ---------------- */
class BuffMenu {
  // opts (optional): { title, sub }
  constructor(scene, players, onDone, opts) {
    this.opts = opts || {};
    this.scene = scene;
    this.players = players;
    this.onDone = onDone;
    this.nav = new MenuNav(players.length);
    this.picked = [];
    this.choices = [];
    for (let i = 0; i < players.length; i++) { this.picked.push(null); this.choices.push(ShopLogic.buffChoices()); }
    this.root = null;
    this.build();
  }

  build() {
    if (this.root) this.root.destroy(true);
    const sc = this.scene, W = GAME_CONFIG.width, H = GAME_CONFIG.height;
    const root = sc.add.container(0, 0).setDepth(300).setScrollFactor(0);   // screen space (camera may scroll)
    this.root = root;
    MenuDraw.panel(sc, root, W, H);
    const T = (x, y, s, size, color, bold) => MenuDraw.text(sc, root, x, y, s, size, color, bold);
    T(W / 2, 50, this.opts.title || 'Choose a free buff', 32, null, true).setOrigin(0.5);
    T(W / 2, 84, this.opts.sub || (this.players.length > 1 ? 'Each player picks one with their own controls. It lasts for the whole run.'
                                          : 'Pick one. It lasts for the whole run.'), 14, '#8d6e63').setOrigin(0.5);

    const g = sc.add.graphics();
    root.add(g);
    const nodes = [];
    const four = this.choices[0] && this.choices[0].length > 3;
    const cw = four ? 205 : 240, ch = 150, gap = four ? 16 : 24;
    const rowH = this.players.length > 1 ? 230 : 0;
    const startY = this.players.length > 1 ? 140 : 210;
    for (let pi = 0; pi < this.players.length; pi++) {
      const y = startY + pi * rowH;
      if (this.players.length > 1) T(40, y - 24, 'Player ' + (pi + 1), 16, '#' + PLAYER_CURSOR_COLORS[pi].toString(16).padStart(6, '0'), true);
      const ids = this.choices[pi];
      const total = ids.length * cw + (ids.length - 1) * gap;
      for (let i = 0; i < ids.length; i++) {
        const def = PASSIVE_BUFFS[ids[i]];
        const n = { kind: 'buff', owner: pi, id: ids[i], x: W / 2 - total / 2 + i * (cw + gap), y: y, w: cw, h: ch,
                    selectable: !this.picked[pi] };
        nodes.push(n);
        const chosen = this.picked[pi] === ids[i];
        g.fillStyle(chosen ? 0xfff3c4 : 0xffffff, 1); g.fillRect(n.x, n.y, n.w, n.h);
        g.lineStyle(chosen ? 3 : 1, chosen ? 0xffa000 : 0x37474f, chosen ? 1 : 0.35); g.strokeRect(n.x, n.y, n.w, n.h);
        T(n.x + n.w / 2, n.y + 40, def.name, 20, this.picked[pi] && !chosen ? '#9e9e9e' : null, true).setOrigin(0.5);
        T(n.x + n.w / 2, n.y + 86, def.desc, 14, '#5d4037').setOrigin(0.5).setWordWrapWidth(n.w - 24).setAlign('center');
        if (chosen) T(n.x + n.w / 2, n.y + n.h - 22, 'Picked', 13, '#ef6c00', true).setOrigin(0.5);
      }
    }
    this.cursorG = sc.add.graphics();
    root.add(this.cursorG);
    this.nav.setNodes(nodes);
  }

  update() {
    for (let pi = 0; pi < this.players.length; pi++) {
      if (this.picked[pi]) continue;
      const node = this.nav.handle(pi, this.players[pi].controller.menu);
      if (!node) continue;
      this.picked[pi] = node.id;
      const p = this.players[pi];
      p.buffs.push(node.id);
      p.recalcStats();
      if (this.picked.every((x) => x)) { this.close(); this.onDone(); return; }
      this.build();
    }
    this.cursorG.clear();
    this.nav.drawCursors(this.cursorG);
  }

  close() {
    if (this.root) { this.root.destroy(true); this.root = null; }
  }
}
