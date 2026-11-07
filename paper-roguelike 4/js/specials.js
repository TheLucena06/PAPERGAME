/* specials.js
   GameScene methods for the run's special rooms (mixed into GameScene in main.js):
   - merchant / treasure (chest or mimic) / shrine rooms: one prop in the middle,
     walk into it to use it
   - themed last rooms: several waves
   - the mid-stage arena: survival timer or a champion
   - big enemy bosses (King Inkblot, The Warden) and the shared boss bar
   Data lives in stages.js (SPECIAL_ROOMS, THEMED_ROOMS, ARENA_TYPES, CHAMPION). */

const RunRoomsMixin = {
  setupSpecials() {
    this.prop = this.add.image(-200, -200, 'chest').setDepth(4).setVisible(false);
    this.mprop = this.add.image(-200, -200, 'merchant').setDepth(4).setVisible(false).setScale(1.3);   // the merchant
    this.merchantHere = null;
    this.barList = [];
    this.barKind = null;
    this.arena = null;
    this.barAdapter = { def: { name: '' }, holes: [], worms: [], minor: false, totalMaxHp: 1,
                        totalHp: () => this.barHp() };
    this.bpDrops = [];
    for (let i = 0; i < 3; i++) this.bpDrops.push({ active: false, id: '', x: 0, y: 0, ms: 0,
      sprite: this.add.image(-200, -200, 'blueprint').setDepth(6).setVisible(false) });
  },

  /* ---------- blueprint drops (Pencil Case, see meta.js) ---------- */
  dropBlueprint(source, x, y) {
    const id = Meta.rollBlueprint(source);
    if (!id) return;
    for (let i = 0; i < this.bpDrops.length; i++) if (this.bpDrops[i].active && this.bpDrops[i].id === id) return;
    const d = this.bpDrops.find((q) => !q.active);
    if (!d) { this.collectBlueprint({ id: id, active: true, sprite: null, x: x, y: y }); return; }
    d.active = true; d.id = id; d.ms = 0;
    d.x = Phaser.Math.Clamp(x, 90, this.rooms.W - 90); d.y = Phaser.Math.Clamp(y, 90, this.rooms.H - 90);
    d.sprite.setPosition(d.x, d.y).setVisible(true).setScale(1.2);
    this.hud.floatText(d.x, d.y - 30, 'Blueprint!', '#1565c0');
  },

  updateBlueprints(dt) {
    for (let i = 0; i < this.bpDrops.length; i++) {
      const d = this.bpDrops[i];
      if (!d.active) continue;
      d.ms += dt;
      d.sprite.setPosition(d.x, d.y - 4 + Math.sin(d.ms / 180) * 4).setAngle(Math.sin(d.ms / 300) * 8);
      if (d.ms < 400) continue;                       // let it pop out first
      for (let k = 0; k < this.players.length; k++) {
        const p = this.players[k];
        if (!p.alive) continue;
        const dx = p.sprite.x - d.x, dy = p.sprite.y - d.y;
        if (dx * dx + dy * dy < 36 * 36) { this.collectBlueprint(d); break; }
      }
    }
  },

  collectBlueprint(d) {
    d.active = false;
    if (d.sprite) d.sprite.setVisible(false);
    if (!SaveData.unlockBlueprint(d.id)) return;
    const bp = BLUEPRINT_TYPES[d.id];
    this.hud.showBanner('Blueprint: ' + bp.name);
    const p = this.players.find((q) => q.alive) || this.players[0];
    this.hud.floatText(p.sprite.x, p.sprite.y - 44, 'Now in shops: ' + Meta.blueprintItems(d.id).join(', '), '#1565c0');
  },

  // Leaving the room / the run never loses a dropped blueprint.
  collectAllBlueprints() {
    for (let i = 0; i < this.bpDrops.length; i++) if (this.bpDrops[i].active) this.collectBlueprint(this.bpDrops[i]);
  },

  /* ---------- props in special rooms ---------- */
  enterSpecialRoom(room) {
    this.prop.setVisible(false).clearTint();
    this.mprop.setVisible(false);
    this.propArmed = true; this.mpropArmed = true;
    const cx = this.rooms.W / 2, cy = this.rooms.H / 2;
    if (room.type === 'merchant' && this.merchantHere && this.merchantHere !== 'gone') this.showMerchant(cx, cy);
    if (room.type === 'arena' && room.cleared && this.merchantHere && this.merchantHere !== 'gone') this.showMerchant(cx + 120, cy - 80);
    let tex = null;
    if (room.type === 'treasure' || room.rewardChest) tex = room.chestOpened ? 'chest_open' : 'chest';
    else if (room.type === 'shrine') tex = 'shrine';
    if (!tex) return;
    this.prop.setTexture(tex).setPosition(cx, cy).setVisible(true).setScale(1.3);
    if (room.type === 'shrine' && room.shrineUsed) this.prop.setTint(0x9e9e9e);
  },

  /* ---------- wandering merchant ----------
     Per stage section (the steps before the boss: level, arena, level) he comes at most once to SELL
     (you order + pay) and, if you ordered, once more on the very next step to DELIVER.
     No order = he's gone for this section. He never shows up first on the last step. */
  merchantData() {
    const r = this.run;
    if (!r) return null;
    if (!r.merchant || r.merchant.stage !== r.stageNum) r.merchant = { stage: r.stageNum, state: 'unseen', order: [], step: -1 };
    return r.merchant;
  },
  planMerchant() {
    this.merchantHere = null;
    const m = this.merchantData();
    if (!m) return;
    const step = this.run.step, kind = RUN_PLAN.steps[step];
    if (kind === 'boss') return;
    let lastPre = 0;
    for (let i = 0; i < RUN_PLAN.steps.length; i++) if (RUN_PLAN.steps[i] !== 'boss') lastPre = i;
    if (m.state === 'ordered' && m.step === step - 1) { this.merchantHere = 'deliver'; return; }
    if (m.state !== 'unseen' || step >= lastPre) return;
    const ch = SPECIAL_ROOMS.merchantChance[Math.min(step, SPECIAL_ROOMS.merchantChance.length - 1)];
    if (Math.random() < ch) { this.merchantHere = 'sell'; m.state = 'met'; m.step = step; }
  },
  // Leaving a step: a visit without an order ends him for this section; a missed delivery goes to the next shop.
  merchantStepEnd() {
    const m = this.merchantData();
    if (!m) return;
    if (this.merchantHere === 'sell') m.state = m.order.length ? 'ordered' : 'done';
    else if (this.merchantHere === 'deliver' && m.state === 'ordered') {
      for (let i = 0; i < m.order.length; i++) this.run.reserved.push({ cat: m.order[i].cat, id: m.order[i].id });
      m.order = []; m.state = 'done';
    }
    this.merchantHere = null;
  },
  showMerchant(x, y) {
    this.mprop.setPosition(x, y).setVisible(true);
    this.hud.floatText(x, y - 46, this.merchantHere === 'deliver' ? 'Your order is here!' : 'Wandering Merchant', '#5d4037');
  },
  touchMerchant(p) {
    const m = this.merchantData();
    if (this.merchantHere === 'deliver' && m.state === 'ordered') {
      for (let i = 0; i < m.order.length; i++) {
        const o = m.order[i];
        const to = this.players[o.player] && this.players[o.player].alive ? this.players[o.player] : p;
        ShopLogic.give(this.team, to, o.cat, o.id);
      }
      const names = m.order.map((o) => Catalog.get(o.cat, o.id).name).join(', ');
      this.hud.showBanner('Delivered!');
      this.hud.floatText(this.mprop.x, this.mprop.y - 60, names, '#2e7d32');
      m.order = []; m.state = 'done';
      this.merchantHere = 'gone';
      this.tweens.add({ targets: this.mprop, alpha: 0, delay: 900, duration: 600, onComplete: () => this.mprop.setVisible(false).setAlpha(1) });
      return;
    }
    if (this.merchantHere === 'sell') this.openMerchant();
  },

  updateSpecials(dt) {
    if (this.arena) this.updateArena(dt);
    this.updateBlueprints(dt);
    if (this.mprop.visible && this.mprop.alpha === 1) {
      let best = null, bd = 1e9;
      for (let i = 0; i < this.players.length; i++) {
        const p = this.players[i];
        if (!p.alive) continue;
        const dx = p.sprite.x - this.mprop.x, dy = p.sprite.y - this.mprop.y, d = dx * dx + dy * dy;
        if (d < bd) { bd = d; best = p; }
      }
      if (best && bd > 95 * 95) this.mpropArmed = true;
      else if (best && bd < 44 * 44 && this.mpropArmed) { this.mpropArmed = false; this.touchMerchant(best); }
    }
    const room = this.room;
    if (!this.prop.visible || !room) return;
    // nearest living player to the prop
    let near = null, nd = 1e9;
    for (let i = 0; i < this.players.length; i++) {
      const p = this.players[i];
      if (!p.alive) continue;
      const dx = p.sprite.x - this.prop.x, dy = p.sprite.y - this.prop.y, d = dx * dx + dy * dy;
      if (d < nd) { nd = d; near = p; }
    }
    if (!near) return;
    if (nd > 95 * 95) { this.propArmed = true; return; }
    if (nd > 44 * 44 || !this.propArmed) return;
    this.propArmed = false;
    if ((room.type === 'treasure' || room.rewardChest) && !room.chestOpened) {
      if (room.mimic) this.triggerMimic(room); else this.openChest(near, room);
    } else if (room.type === 'shrine' && !room.shrineUsed) this.useShrine(room);
  },

  openMerchant() {
    this.coins.collectAll(this.team);
    this.shop = new MerchantMenu(this, this.players, this.team, this.level, this.bossesBeaten, this.merchantData(), {
      onInventory: () => this.openInventory('shop'),
      onDone: () => { this.shop = null; this.menu = null; this.setMode('play'); }
    });
    this.menu = this.shop;
    this.setMode('shop');
  },

  // A random item that can show up in shops a little later (better than average for mimics).
  rollLoot(good) {
    const cats = ['weapon', 'armor', 'skill'];
    const cat = cats[Math.floor(Math.random() * cats.length)], t = Catalog.table(cat);
    let ids = Object.keys(t).filter((id) => ShopLogic.unlocked(t[id], this.level + 2, this.bossesBeaten));
    if (!ids.length) ids = Object.keys(t).filter((id) => ShopLogic.unlocked(t[id], 0, this.bossesBeaten));
    if (good && ids.length > 3) { ids.sort((a, b) => t[b].price - t[a].price); ids = ids.slice(0, Math.ceil(ids.length / 2)); }
    return { cat: cat, id: ids[Math.floor(Math.random() * ids.length)] };
  },

  giveLoot(p, loot, x, y) {
    if (!loot.id) return;
    ShopLogic.give(this.team, p, loot.cat, loot.id);
    const def = Catalog.get(loot.cat, loot.id);
    this.hud.floatText(x, y - 40, def.name + '!', '#6a1b9a');
    this.hud.showBanner('Found: ' + def.name);
  },

  openChest(p, room) {
    room.chestOpened = true;
    this.prop.setTexture('chest_open');
    const c = SPECIAL_ROOMS.chestCoins;
    this.coins.drop(this.prop.x, this.prop.y + 20, Math.round((c[0] + Math.random() * (c[1] - c[0])) * this.coinMul()), this.team);
    this.giveLoot(p, this.rollLoot(false), this.prop.x, this.prop.y);
    this.hud.addFx(this.prop.x, this.prop.y, 40, 0xffca28, 300);
  },

  triggerMimic(room) {
    room.chestOpened = true;
    room.cleared = false;
    room.fightStarted = true;
    this.rooms.closeDoors();
    this.prop.setVisible(false);
    this.hud.showBanner("It's a MIMIC!");
    this.cameras.main.shake(250, 0.008);
    const e = this.enemies.spawn('mimic', this.prop.x, this.prop.y);
    if (!e) return;
    e.maxHp = Math.round(e.maxHp * (1 + 0.6 * (this.players.length - 1)));
    e.hp = e.maxHp;
    e.attackCdMs = 700;
    this.startBar('mimic', [e], 'Mimic');
  },

  useShrine(room) {
    room.shrineUsed = true;
    this.prop.setTint(0x9e9e9e);
    for (let i = 0; i < this.players.length; i++) {
      const p = this.players[i];
      if (!p.alive) continue;
      const cost = Math.round(p.stats.maxHp * Meta.shrineHpPct() / 100);
      p.hp = Math.max(1, p.hp - cost);
      this.hud.floatText(p.sprite.x, p.sprite.y - 30, '-' + cost + ' HP', '#c62828');
    }
    this.hud.addFx(this.prop.x, this.prop.y, 70, 0x7e57c2, 400);
    this.time.delayedCall(350, () => {
      this.menu = new BuffMenu(this, this.players, () => { this.menu = null; this.setMode('play'); },
        { title: 'Shrine of Graphite', sub: 'You paid ' + Meta.shrineHpPct() + '% of your max HP. Take a buff for the rest of the run.' });
      this.setMode('buffs');
    });
  },

  /* ---------- themed last rooms (waves) ---------- */
  startThemedFight(room) {
    const th = THEMED_ROOMS[room.theme];
    room.waves = th.waves.map((w) => w.map((x) => x.slice()));
    room.wavesTotal = room.waves.length;
    room.fightStarted = true;
    this.hud.showBanner(th.name);
    this.spawnThemedWave(room);
  },

  spawnThemedWave(room) {
    const wave = room.waves.shift();
    const coop = this.players.length > 1 ? 1.5 : 1;
    let k = 0;
    for (let i = 0; i < wave.length; i++) {
      const n = Math.max(1, Math.round(wave[i][1] * coop));
      for (let j = 0; j < n; j++, k++) {
        if (this.rooms.randomSpawnPoint(this.players, GAME_CONFIG.spawnMinDistance, this._pt)) {
          this.enemies.queueSpawn(wave[i][0], this._pt.x, this._pt.y, GAME_CONFIG.spawnDelayMs + k * 160);
        }
      }
    }
    const done = room.wavesTotal - room.waves.length;
    if (room.wavesTotal > 1) this.hud.floatText(this.rooms.W / 2, 120, 'Wave ' + done + ' / ' + room.wavesTotal, '#c62828');
  },

  /* ---------- the mid-stage arena ---------- */
  startArena() {
    const kinds = Object.keys(ARENA_TYPES);
    const kind = kinds[Math.floor(Math.random() * kinds.length)];
    const A = ARENA_TYPES[kind];
    const room = { gx: 0, gy: 0, doors: { up: false, down: false, left: false, right: false }, layout: 0,
                   type: 'arena', arenaKind: kind, cols: A.cols, rows: A.rows, layoutRows: RoomGen.arena(A.cols, A.rows),
                   depth: 0, visited: true, cleared: false, fightStarted: false };
    this.map = { level: this.level, rooms: [room], byKey: { '0,0': room }, start: room, exit: room, gridSize: 1 };
    this.enterRoom(room, null);
    // start near the bottom edge so nothing spawns on top of you
    for (let i = 0; i < this.players.length; i++) if (this.players[i].alive) this.players[i].sprite.body.reset(this.rooms.W / 2 + (i - 0.5) * 48 * (this.players.length - 1), this.rooms.H - 170);
    this.camSnap = true;
    this.hud.showBanner(A.name);
    this.hud.floatText(this.rooms.W / 2, this.rooms.H / 2 - 70, A.sub, '#5d4037');
  },

  startArenaFight(room) {
    const A = ARENA_TYPES[room.arenaKind];
    room.fightStarted = true;
    if (room.arenaKind === 'survival') {
      this.arena = { kind: 'survival', msLeft: A.durationMs, spawnMs: 1200, wave: 0 };
      this.barAdapter.def.name = A.name;
      this.barAdapter.totalMaxHp = A.durationMs;
      this.barKind = 'timer';
      this.hud.setBoss(this.barAdapter);
      return;
    }
    // champion + escorts
    const st = this.stage();
    const id = st.champions[Math.floor(Math.random() * st.champions.length)];
    const e = this.enemies.spawn(id, this.rooms.W / 2, this.rooms.H / 2 - 200);
    if (e) {
      this.makeChampion(e);
      this.startBar('champion', [e], 'Champion ' + e.def.name);
    }
    const wave = this.enemies.buildWave(this.level, 2 + this.level * 0.8, A.escorts * this.players.length);
    for (let i = 0; i < wave.length; i++) {
      if (this.rooms.randomSpawnPoint(this.players, 260, this._pt)) this.enemies.queueSpawn(wave[i], this._pt.x, this._pt.y, 900 + i * 200);
    }
  },

  makeChampion(e) {
    const C = CHAMPION;
    e.champion = true;
    e.setScale(C.scale);
    e.maxHp = Math.round(e.maxHp * C.hpMul * (1 + 0.5 * (this.players.length - 1)));
    e.hp = e.maxHp;
    e.dmgMul *= C.dmgMul;
    e.speed *= C.speedMul; e.spd = e.speed;
  },

  updateArena(dt) {
    const a = this.arena;
    if (a.kind !== 'survival' || this.room.cleared) return;
    a.msLeft -= dt;
    const sec = Math.ceil(Math.max(0, a.msLeft) / 1000);
    const name = 'Hold out!  ' + Math.floor(sec / 60) + ':' + ('0' + (sec % 60)).slice(-2);
    if (this.barAdapter.def.name !== name) this.barAdapter.def.name = name;
    if (a.msLeft <= 0) { this.endSurvival(); return; }
    a.spawnMs -= dt;
    if (a.spawnMs > 0) return;
    const A = ARENA_TYPES.survival;
    a.spawnMs = A.spawnEveryMs * (this.players.length > 1 ? 0.75 : 1);
    if (this.enemies.countActive() >= A.maxAlive * (this.players.length > 1 ? 1.4 : 1)) return;
    a.wave++;
    const budget = A.waveBudget + this.level * 0.7 + a.wave * A.budgetGrowth * this.level;
    const wave = this.enemies.buildWave(this.level, budget, 6);
    for (let i = 0; i < wave.length; i++) {
      if (this.rooms.randomSpawnPoint(this.players, 250, this._pt)) this.enemies.queueSpawn(wave[i], this._pt.x, this._pt.y, 700 + i * 150);
    }
  },

  // Time's up: everything left melts away, then the arena counts as cleared.
  endSurvival() {
    const list = this.enemies.group.getChildren();
    for (let i = 0; i < list.length; i++) if (list[i].active) this.hud.addFx(list[i].x, list[i].y, 24, 0x8d6e63, 300);
    this.enemies.clearAll(); this.minorWorms.clearWorms(); this.chains.clear(); this.hazards.clear(); this.enemyBullets.killAll();
    this.arena = null;
    this.endBar();
    this.hud.showBanner('Survived!');
    this.onRoomCleared();
  },

  // Arena reward: coins + a real chest; the hatch appears.
  arenaReward(room) {
    this.coins.drop(this.rooms.W / 2, this.rooms.H / 2 + 40, Math.round((20 + this.level * 4) * this.coinMul()), this.team);
    room.rewardChest = true; room.mimic = false; room.chestOpened = false;
    this.enterSpecialRoom(room);
    this.prop.setPosition(this.rooms.W / 2, this.rooms.H / 2 - 80);
  },

  /* ---------- enemy bosses ---------- */
  startEnemyBoss(id) {
    const def = ENEMY_TYPES[id];
    const pct = (GAME_CONFIG.debug.bossArenaPct || 100) / 100;          // debug menu: boss arena size
    const cols = Phaser.Math.Clamp(Math.round(def.boss.arena[0] * pct), 15, ROOM_MAX_COLS);
    const rows = Phaser.Math.Clamp(Math.round(def.boss.arena[1] * pct), 10, ROOM_MAX_ROWS);
    const inside = [];
    for (let r = 0; r < rows - 2; r++) inside.push('.'.repeat(cols - 2));
    const room = { gx: 0, gy: 0, doors: { up: false, down: false, left: false, right: false }, layout: 0, type: 'boss',
                   cols: cols, rows: rows, layoutRows: inside, depth: 0, visited: true, cleared: false, fightStarted: true };
    this.map = { level: this.level, rooms: [room], byKey: { '0,0': room }, start: room, exit: room, gridSize: 1 };
    this.enterRoom(room, null);
    // players start at the bottom, the boss at the top
    for (let i = 0; i < this.players.length; i++) if (this.players[i].alive) this.players[i].sprite.body.reset(this.rooms.W / 2 + (i - 0.5) * 40 * (this.players.length - 1), this.rooms.H - 140);
    this.camSnap = true;
    const e = this.enemies.spawn(id, this.rooms.W / 2, Math.max(170, this.rooms.H - 140 - 460));   // on screen from the start
    if (!e) return;
    e.maxHp = Math.round(e.maxHp * (1 + 0.6 * (this.players.length - 1)));
    e.hp = e.maxHp;
    e.attackCdMs = 1500;
    this.startBar('boss', [e], def.name);
    this.hud.showBanner(def.name);
    this.discover(id, e.x, e.y);
  },

  /* ---------- shared boss bar (bosses, mimics, champions, survival timer) ---------- */
  startBar(kind, list, name) {
    this.barKind = kind;
    this.barList = list.slice();
    let max = 0;
    for (let i = 0; i < list.length; i++) { list[i].barTag = kind; max += list[i].maxHp; }
    this.barAdapter.def.name = name;
    this.barAdapter.totalMaxHp = Math.max(1, max);
    this.hud.setBoss(this.barAdapter);
  },

  barHp() {
    if (this.barKind === 'timer') return this.arena ? Math.max(0, this.arena.msLeft) : 0;
    let hp = 0;
    for (let i = 0; i < this.barList.length; i++) { const e = this.barList[i]; if (e.active && e.barTag === this.barKind) hp += Math.max(0, e.hp); }
    return hp;
  },

  endBar() {
    this.barKind = null;
    this.barList.length = 0;
    this.hud.setBoss(null);
  },

  // After every hit on an enemy that survived it: King Inkblot splits in two.
  afterEnemyHurt(e) {
    const d = e.def;
    if (d.splitAt && d.prince && !e.split && e.hp <= e.maxHp * d.splitAt) {
      e.split = true;
      const hpEach = Math.max(1, Math.round(e.hp / 2));
      for (let k = -1; k <= 1; k += 2) {
        const c = this.enemies.spawn(d.prince, e.x + k * 70, e.y);
        if (!c) continue;
        c.maxHp = hpEach; c.hp = hpEach; c.dmgMul = e.dmgMul; c.barTag = this.barKind; c.attackCdMs = 900 + (k > 0 ? 500 : 0);
        this.barList.push(c);
        this.enemies.push(c, k, 0, 300, 250);
      }
      this.hud.addFx(e.x, e.y, 90, 0x263238, 400);
      this.cameras.main.shake(300, 0.01);
      this.hud.showBanner('The King splits!');
      e.barTag = 0;
      this.enemies.kill(e);
    }
  },

  // An enemy died: was it part of the boss bar?
  afterEnemyKilled(e) {
    if (e.typeId === 'mimic') {
      const p = this.players.find((q) => q.alive) || this.players[0];
      this.giveLoot(p, this.rollLoot(true), e.x, e.y);
      this.coins.drop(e.x, e.y, Math.round(20 * this.coinMul()), this.team);
      this.earnShavings(SHAVINGS_EARN.mimic, e.x, e.y);
      this.dropBlueprint('mimic', e.x, e.y);
    }
    if (e.champion) {
      this.coins.drop(e.x, e.y, Math.round(CHAMPION.coins * this.coinMul()), this.team);
      this.earnShavings(SHAVINGS_EARN.champion, e.x, e.y);
      this.dropBlueprint('champion', e.x, e.y);
    }
    if (e.typeId === 'gnome') this.dropBlueprint('gnome', e.x, e.y);
    if (!this.barKind || this.barKind === 'timer' || e.barTag !== this.barKind) return;
    for (let i = 0; i < this.barList.length; i++) if (this.barList[i].active && this.barList[i].barTag === this.barKind) return;
    const kind = this.barKind;
    this.endBar();
    if (kind === 'boss') {
      this.enemies.clearAll(); this.enemyBullets.killAll(); this.minorWorms.clearWorms(); this.chains.clear();
      const def = ENEMY_TYPES[this.currentBossId];
      this.onBossDefeated({ name: def.name, defeatCoins: def.boss.defeatCoins }, e.x, e.y);
    } else if (kind === 'champion') this.hud.showBanner('Champion defeated!');
  }
};
