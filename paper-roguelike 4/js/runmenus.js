/* runmenus.js
   Screens that belong to the run structure:
   - PathMenu: after a boss, pick the next stage (any player can decide).
   - MerchantMenu: the wandering merchant. Every item that can show up in a
     shop right now, by category, in pages. You ORDER (pay now, x1.3) and he
     delivers when you meet him again on the next step of the stage.
   Both use MenuNav (one cursor per player) and run while the game is paused. */

class PathMenu {
  constructor(scene, players, options, onPick) {
    this.scene = scene;
    this.players = players;
    this.options = options;
    this.onPick = onPick;
    this.nav = new MenuNav(players.length);
    this.build();
  }

  build() {
    const sc = this.scene, W = GAME_CONFIG.width, H = GAME_CONFIG.height;
    const root = sc.add.container(0, 0).setDepth(300).setScrollFactor(0);
    this.root = root;
    MenuDraw.panel(sc, root, W, H);
    const T = (x, y, s, size, color, bold) => MenuDraw.text(sc, root, x, y, s, size, color, bold);
    T(W / 2, 48, 'Choose your path', 34, null, true).setOrigin(0.5);
    T(W / 2, 84, 'Two ways down. You can\'t come back.', 15, '#8d6e63').setOrigin(0.5);
    const g = sc.add.graphics(); root.add(g);
    const n = this.options.length, cw = 360, ch = 400, gap = 40;
    const x0 = W / 2 - (n * cw + (n - 1) * gap) / 2, y = 120;
    const nodes = [];
    for (let i = 0; i < n; i++) {
      const st = STAGE_TYPES[this.options[i]], x = x0 + i * (cw + gap);
      nodes.push({ kind: 'path', id: this.options[i], x: x, y: y, w: cw, h: ch });
      // a little window showing the stage's floor
      g.fillStyle(0xffffff, 1); g.fillRect(x, y, cw, ch);
      g.lineStyle(2, 0x37474f, 0.4); g.strokeRect(x, y, cw, ch);
      this.preview(g, st.look, x + 20, y + 20, cw - 40, 170);
      T(x + cw / 2, y + 210, st.name, 26, null, true).setOrigin(0.5, 0);
      T(x + cw / 2, y + 252, st.tagline, 15, '#5d4037').setOrigin(0.5, 0).setAlign('center').setWordWrapWidth(cw - 40);
      T(x + cw / 2, y + ch - 40, '[' + (i + 1) + ']', 14, '#8d6e63').setOrigin(0.5, 0);
    }
    this.cursorG = sc.add.graphics(); root.add(this.cursorG);
    this.nav.setNodes(nodes);
    this.keyHandler = (ev) => { const k = parseInt(ev.key, 10); if (k >= 1 && k <= n) this.pick(this.options[k - 1]); };
    sc.input.keyboard.on('keydown', this.keyHandler);
  }

  preview(g, look, x, y, w, h) {
    g.fillStyle(look.bg, 1); g.fillRect(x, y, w, h);
    g.lineStyle(1, look.line, 0.9);
    if (look.style === 'castle') {
      for (let yy = y; yy < y + h; yy += 24) g.lineBetween(x, yy, x + w, yy);
      g.fillStyle(look.accent, 0.25); g.fillRect(x + w / 2 - 30, y, 60, h);
    } else if (look.style === 'sewer') {
      for (let yy = y; yy < y + h; yy += 16) g.lineBetween(x, yy, x + w, yy);
      g.fillStyle(look.accent, 0.2); g.fillRect(x, y + h / 2 - 20, w, 40);
      g.fillStyle(0x263238, 0.2); g.fillEllipse(x + w * 0.3, y + h * 0.3, 50, 20); g.fillEllipse(x + w * 0.7, y + h * 0.75, 60, 24);
    } else {
      for (let yy = y + 10; yy < y + h; yy += 16) g.lineBetween(x, yy, x + w, yy);
    }
    const wall = look.wall || 0xa1887f;
    g.fillStyle(wall, 1); g.fillRect(x, y, w, 14); g.fillRect(x, y + h - 14, w, 14); g.fillRect(x, y, 14, h); g.fillRect(x + w - 14, y, 14, h);
    if (look.block) { g.fillStyle(look.block, 1); g.fillRect(x + w * 0.25, y + h * 0.4, 28, 28); g.fillRect(x + w * 0.65, y + h * 0.35, 28, 28); }
  }

  pick(id) {
    if (this.done) return;
    this.done = true;
    this.close();
    this.onPick(id);
  }

  update() {
    for (let pi = 0; pi < this.players.length; pi++) {
      const node = this.nav.handle(pi, this.players[pi].controller.menu);
      if (node) { this.pick(node.id); return; }
    }
    this.cursorG.clear();
    this.nav.drawCursors(this.cursorG);
  }

  close() {
    this.scene.input.keyboard.off('keydown', this.keyHandler);
    if (this.root) { this.root.destroy(true); this.root = null; }
  }
}

/* ---------------- Wandering merchant ---------------- */
const MERCHANT_TABS = [['weapon', 'Weapons'], ['armor', 'Armor'], ['skill', 'Skills'], ['consumable', 'Items']];
const MERCHANT_PER_PAGE = 12;

class MerchantMenu {
  // m = the run's merchant data: { order: [{cat, id, player, paid}], ... } (see specials.js)
  constructor(scene, players, team, level, bossesBeaten, m, callbacks) {
    this.scene = scene;
    this.players = players;
    this.team = team;
    this.level = level;
    this.bossesBeaten = bossesBeaten;
    this.m = m;
    this.cb = callbacks;                    // { onInventory(), onDone() }
    this.tab = 0;
    this.page = 0;
    this.nav = new MenuNav(players.length);
    this.messageMs = 0;
    this.build();
  }

  items() {
    const cat = MERCHANT_TABS[this.tab][0], t = Catalog.table(cat);
    return Object.keys(t).filter((id) => ShopLogic.unlocked(t[id], this.level, this.bossesBeaten))
      .sort((a, b) => t[a].price - t[b].price);
  }

  priceOf(cat, id) {
    return Math.ceil(Catalog.get(cat, id).price * Meta.merchantOrderMul());
  }

  // index in the order list (-1 = not ordered)
  orderIndex(cat, id) {
    const o = this.m.order;
    for (let i = 0; i < o.length; i++) if (o[i].cat === cat && o[i].id === id) return i;
    return -1;
  }
  isReserved(cat, id) { return this.orderIndex(cat, id) !== -1; }

  build() {
    const keep = [];
    for (let pi = 0; pi < this.players.length; pi++) { const n = this.nav.current(pi); keep.push(n ? this.nav.nodes.indexOf(n) : -1); }
    if (this.root) this.root.destroy(true);
    const sc = this.scene, W = GAME_CONFIG.width, H = GAME_CONFIG.height;
    const root = sc.add.container(0, 0).setDepth(300).setScrollFactor(0);
    this.root = root;
    MenuDraw.panel(sc, root, W, H);
    const T = (x, y, s, size, color, bold) => MenuDraw.text(sc, root, x, y, s, size, color, bold);
    T(28, 18, 'Wandering Merchant', 26, null, true);
    T(300, 22, '"Pay now. I\'ll bring it to you on your next stop."', 13, '#8d6e63');
    const g = sc.add.graphics(); root.add(g);
    MenuDraw.coin(g, 560, 24, 18);
    this.coinText = T(584, 20, '' + this.team.coins, 22, null, true);

    const nodes = [];
    // tabs
    for (let i = 0; i < MERCHANT_TABS.length; i++) {
      const n = { kind: 'tab', index: i, x: 28 + i * 118, y: 58, w: 110, h: 30 };
      nodes.push(n);
      g.fillStyle(i === this.tab ? 0x37474f : 0xd7ccc8, 1); g.fillRoundedRect(n.x, n.y, n.w, n.h, 5);
      T(n.x + n.w / 2, n.y + 7, MERCHANT_TABS[i][1], 14, i === this.tab ? '#fdf6e3' : '#4e342e', true).setOrigin(0.5, 0);
    }
    // cards
    const ids = this.items(), cat = MERCHANT_TABS[this.tab][0];
    const pages = Math.max(1, Math.ceil(ids.length / MERCHANT_PER_PAGE));
    if (this.page >= pages) this.page = pages - 1;
    const LX = 28, cw = 140, ch = 62, gap = 9;
    for (let k = 0; k < MERCHANT_PER_PAGE; k++) {
      const id = ids[this.page * MERCHANT_PER_PAGE + k];
      if (!id) break;
      const def = Catalog.get(cat, id);
      const n = { kind: 'item', cat: cat, id: id, x: LX + (k % 4) * (cw + gap), y: 104 + Math.floor(k / 4) * (ch + gap), w: cw, h: ch };
      nodes.push(n);
      const res = this.isReserved(cat, id), price = this.priceOf(cat, id);
      const col = def.class ? CLASS_COLORS[def.class] : '#8d6e63';
      g.fillStyle(res ? 0xe8f5e9 : 0xffffff, 1); g.fillRect(n.x, n.y, n.w, n.h);
      g.lineStyle(1, 0x37474f, 0.35); g.strokeRect(n.x, n.y, n.w, n.h);
      g.fillStyle(Phaser.Display.Color.HexStringToColor(col).color, 1); g.fillRect(n.x, n.y, 5, n.h);
      T(n.x + 11, n.y + 6, def.name, def.name.length > 20 ? 11 : (def.name.length > 16 ? 12 : 14), null, true);
      T(n.x + 11, n.y + 25, res ? 'ORDERED' : (def.class ? Catalog.classLine(def) : 'Item'), 11, res ? '#2e7d32' : col, res);
      MenuDraw.coin(g, n.x + 11, n.y + 44, 11);
      T(n.x + 27, n.y + 41, '' + price, 14, this.team.coins >= price ? '#37474f' : '#c62828', true);
      TierStars.draw(g, n.x + n.w - 7, n.y + 50, cat, def, this.scene.bossesBeaten, 5);
    }
    if (!ids.length) T(LX, 120, 'Nothing here yet.', 16, '#9e9e9e');
    // pages
    const py = 104 + 3 * (ch + gap) + 4;
    if (pages > 1) {
      const prev = { kind: 'page', dir: -1, x: LX, y: py, w: 80, h: 30 }, next = { kind: 'page', dir: 1, x: LX + 3 * (cw + gap) + cw - 80, y: py, w: 80, h: 30 };
      nodes.push(prev, next);
      g.fillStyle(0x8d6e63, 1); g.fillRoundedRect(prev.x, prev.y, prev.w, prev.h, 5); g.fillRoundedRect(next.x, next.y, next.w, next.h, 5);
      T(prev.x + 40, py + 7, '◀ prev', 13, '#fdf6e3', true).setOrigin(0.5, 0);
      T(next.x + 40, py + 7, 'next ▶', 13, '#fdf6e3', true).setOrigin(0.5, 0);
      T(LX + 2 * (cw + gap) - 4, py + 7, 'page ' + (this.page + 1) + ' / ' + pages, 13, '#8d6e63').setOrigin(0.5, 0);
    }

    // right side: details + buttons
    const RX = 640, RW = W - 28 - RX, top = 58, btnH = 54, btnY = H - 28 - btnH;
    const per = (btnY - 12 - top) / this.players.length;
    this.details = [];
    for (let pi = 0; pi < this.players.length; pi++) {
      const dy = top + pi * per;
      g.fillStyle(0xffffff, 1); g.fillRoundedRect(RX, dy, RW, per - 10, 6);
      g.lineStyle(1, 0x37474f, 0.35); g.strokeRoundedRect(RX, dy, RW, per - 10, 6);
      const d = { name: T(RX + 14, dy + 12, '', 20, null, true), desc: T(RX + 14, dy + 44, '', 14, '#4e342e'),
                  price: T(RX + 14, dy + per - 40, '', 14, '#37474f', true), key: null };
      d.desc.setWordWrapWidth(RW - 28).setLineSpacing(3);
      this.details.push(d);
    }
    const bw = (RW - 16) / 3;
    const btns = [{ kind: 'mode' }, { kind: 'inventory' }, { kind: 'leave' }];   // 'mode' = the order summary
    for (let i = 0; i < btns.length; i++) {
      const n = btns[i];
      n.x = RX + i * (bw + 8); n.y = btnY; n.w = bw; n.h = btnH;
      nodes.push(n);
      const bg = n.kind === 'mode' ? 0x2e7d32 : (n.kind === 'leave' ? 0x6d4c41 : 0x37474f);
      g.fillStyle(bg, 1); g.fillRoundedRect(n.x, n.y, n.w, n.h, 5);
      let title = '', sub = '';
      if (n.kind === 'mode') { title = 'Order: ' + this.m.order.length; sub = this.m.order.length ? 'arrives next stop' : 'nothing yet'; }
      if (n.kind === 'inventory') { title = 'Inventory'; sub = 'equip / sell'; }
      if (n.kind === 'leave') { title = 'Leave'; sub = 'back to the level'; }
      T(n.x + n.w / 2, n.y + 18, title, 16, '#fdf6e3', true).setOrigin(0.5);
      T(n.x + n.w / 2, n.y + 39, sub, 11, '#e0d6c4').setOrigin(0.5);
    }
    this.messageText = T(LX, H - 44, '', 15, '#c62828', true);
    this.cursorG = sc.add.graphics(); root.add(this.cursorG);
    this.nav.setNodes(nodes);
    for (let pi = 0; pi < keep.length; pi++) if (keep[pi] >= 0 && keep[pi] < nodes.length) this.nav.setCurrent(pi, nodes[keep[pi]]);
  }

  showDetail(pi) {
    const d = this.details[pi], n = this.nav.current(pi);
    const key = (n ? n.kind + (n.id || n.index || n.dir || '') : '') + this.m.order.length + this.team.coins;
    if (d.key === key) return;
    d.key = key;
    let name = '', desc = '', price = '';
    if (n && n.kind === 'item') {
      const def = Catalog.get(n.cat, n.id);
      name = def.name;
      const tt = TierStars.text(n.cat, def, this.scene.bossesBeaten);
      desc = (def.class ? Catalog.classLine(def) + (tt ? '  ·  ' + tt : '') + '\n\n' : '') + def.desc.replace(/\n/g, ' ');
      const sl = ItemStats.lines(n.cat, def, null);
      if (sl.length) desc += '\n\n' + sl.join('\n');
      price = 'Order: ' + this.priceOf(n.cat, n.id) + ' coins now (normal ' + def.price + ')';
      if (this.isReserved(n.cat, n.id)) price = 'Ordered. Click again to cancel (refund).';
    } else if (n && n.kind === 'mode') {
      name = 'Your order';
      desc = (this.m.order.length ? this.m.order.map((o) => '· ' + Catalog.get(o.cat, o.id).name).join('\n') + '\n\n' : 'Nothing ordered.\n\n') +
        'You pay now; he brings it when you meet him again on your NEXT stop (next level or arena). ' +
        'If you order nothing, he won\'t come back this section.';
    } else if (n && n.kind === 'tab') { name = MERCHANT_TABS[n.index][1]; desc = 'Everything of this kind that can show up in shops right now.'; }
    else if (n && n.kind === 'leave') { name = 'Leave'; desc = 'He waits here while you\'re on this stop.'; }
    else if (n && n.kind === 'inventory') { name = 'Inventory'; desc = 'Equip what you bought or sell things.'; }
    d.name.setText(name); d.desc.setText(desc); d.price.setText(price);
  }

  say(msg, ok) { this.messageText.setText(msg).setColor(ok ? '#2e7d32' : '#c62828'); this.messageMs = 2000; }

  select(pi, node) {
    const p = this.players[pi];
    if (node.kind === 'tab') { this.tab = node.index; this.page = 0; this.build(); return false; }
    if (node.kind === 'page') { this.page = Math.max(0, this.page + node.dir); this.build(); return false; }
    if (node.kind === 'mode') return false;
    if (node.kind === 'inventory') { this.cb.onInventory(); return true; }
    if (node.kind === 'leave') { this.close(); this.cb.onDone(); return true; }
    if (node.kind === 'item') {
      const def = Catalog.get(node.cat, node.id), price = this.priceOf(node.cat, node.id);
      const oi = this.orderIndex(node.cat, node.id);
      if (oi !== -1) {                                   // cancel = refund
        this.team.coins += this.m.order[oi].paid;
        this.m.order.splice(oi, 1);
        this.say('Order cancelled: ' + def.name + '.', true);
        this.build();
        return false;
      }
      if (this.team.coins < price) { this.say('Not enough coins.'); return false; }
      this.team.coins -= price;
      this.m.order.push({ cat: node.cat, id: node.id, player: pi, paid: price });
      this.say('Ordered ' + def.name + '. He\'ll bring it on your next stop.', true);
      this.build();
    }
    return false;
  }

  update(dt) {
    if (this.messageMs > 0) { this.messageMs -= dt; if (this.messageMs <= 0) this.messageText.setText(''); }
    for (let pi = 0; pi < this.players.length; pi++) {
      const c = this.players[pi].controller;
      if (c.state.inventory) { this.cb.onInventory(); return; }
      if (c.menu.back) { this.close(); this.cb.onDone(); return; }
      const node = this.nav.handle(pi, c.menu);
      if (node && this.select(pi, node)) return;
    }
    this.cursorG.clear();
    this.nav.drawCursors(this.cursorG);
    for (let pi = 0; pi < this.details.length; pi++) this.showDetail(pi);
    if (this.coinText.text !== '' + this.team.coins) this.coinText.setText('' + this.team.coins);
  }

  hide() { if (this.root) this.root.setVisible(false); }
  show() { if (this.root) { this.build(); this.root.setVisible(true); } }
  close() { if (this.root) { this.root.destroy(true); this.root = null; } }
}
