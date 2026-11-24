/* lighting.js  (Alpha 3: The Necrotery)
   Lighting: darkness for dark stages + torches + burning floors.

   DARKNESS: a screen-sized RenderTexture (depth 80, above the world, under the
   HUD) filled almost black every frame, with soft light circles erased out of it:
     players (big), player shots (magic shots much bigger), enemy shots (small,
     so you always see what's coming), lit torches, burning floors, explosions
     and other short flashes (hud fx), spell zones, the exit hatch, and extra
     lights other code adds for one frame with Lighting.add(x, y, r).
   Enemy eyes glow on top of the darkness so threats are never invisible.
   Brightness setting (main menu): SaveData.settings.brightness 0 dark / 1 normal / 2 bright.

   TORCHES: wall torches in dark rooms. Hit them with anything (a shot, a melee
   swing, an explosion, fire) to light them. Wisps and the Dead Titan's roar blow
   them out. Light every torch in a room: a small reward (once per room).

   BURNING FLOORS (every stage): exploding fire shots, Inferno... leave fire on
   the floor for a few seconds. It keeps enemies in it burning and gives light. */

const LIGHT_SETTINGS = {
  darkColor: 0x05030b,
  alpha: [0.96, 0.92, 0.82],          // by brightness setting
  radiusMul: [0.9, 1, 1.18],
  player: 175, magicShot: 100, shot: 58, enemyShot: 46, torch: 215, fire: 125, hatch: 110, coin: 0,
  torchHitRange: 30,                // a shot this close to a torch lights it
  fire: { tickMs: 450, ignite: { ms: 1600, tick: 3 }, max: 14 }
};
const BRIGHTNESS_NAMES = ['Dark', 'Normal', 'Bright'];

class Lighting {
  constructor(scene) {
    this.scene = scene;
    const W = GAME_CONFIG.width, H = GAME_CONFIG.height;
    if (!scene.textures.exists('lightGrad')) {
      const t = scene.textures.createCanvas('lightGrad', 128, 128), ctx = t.getContext();
      const gr = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
      gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.45, 'rgba(255,255,255,0.85)');
      gr.addColorStop(0.75, 'rgba(255,255,255,0.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = gr; ctx.fillRect(0, 0, 128, 128); t.refresh();
    }
    // half resolution (soft darkness doesn't need more) and every light in ONE batched draw: cheap on lab PCs
    this.scale = 0.5;
    this.rt = scene.add.renderTexture(0, 0, Math.ceil(W * this.scale), Math.ceil(H * this.scale)).setOrigin(0, 0).setScrollFactor(0).setDepth(80).setVisible(false);
    this.rt.setScale(1 / this.scale);
    this.maxLights = 48;
    this.stamps = [];                                    // one image per light, all erased in a single call
    for (let i = 0; i < this.maxLights; i++) this.stamps.push(scene.make.image({ x: 0, y: 0, key: 'lightGrad', add: false }).setOrigin(0.5));
    this.batch = [];
    this.top = scene.add.graphics().setDepth(81);        // torch flames, glowing eyes (above the darkness)
    this.floor = scene.add.graphics().setDepth(3);       // burning floors, torch brackets
    this.active = false;
    this.torches = [];
    this.fires = [];
    for (let i = 0; i < LIGHT_SETTINGS.fire.max; i++) this.fires.push({ active: false });
    this.extra = [];                                     // one-frame lights added by other code
    this.extraN = 0;
    this.rewarded = false;
  }

  brightness() { const b = SaveData.data && SaveData.data.settings ? SaveData.data.settings.brightness : 1; return (b === 0 || b === 2) ? b : 1; }

  // A new room: dark or not, no torches, no fire.
  setRoom(dark) {
    this.active = !!dark;
    this.rt.setVisible(this.active);
    this.torches = [];                                   // a NEW array: the old one belongs to the last room (room.torches), keep it intact
    for (let i = 0; i < this.fires.length; i++) this.fires[i].active = false;
    this.rewarded = false;
    this.top.clear(); this.floor.clear();
    if (this.scene.hud && this.scene.hud.overlay) this.scene.hud.overlay.setDepth(this.active ? 85 : 50);   // warnings stay readable in the dark
  }

  addTorch(x, y, lit, side) { this.torches.push({ x: x, y: y, lit: !!lit, side: side || 'up', seed: Math.random() * 10, blowMs: 0 }); }

  // Something hit near here: light the torches it touched.
  lightNear(x, y, r) {
    if (!this.torches.length) return;
    for (let i = 0; i < this.torches.length; i++) {
      const t = this.torches[i];
      if (t.lit) continue;
      const dx = t.x - x, dy = t.y - y;
      if (dx * dx + dy * dy > r * r) continue;
      t.lit = true;
      if (this.scene.hud) this.scene.hud.addFx(t.x, t.y, 30, 0xffb74d, 300);
      this.checkAllLit();
    }
  }

  checkAllLit() {
    if (this.rewarded || this.torches.length < 3) return;
    for (let i = 0; i < this.torches.length; i++) if (!this.torches[i].lit) return;
    this.rewarded = true;
    const sc = this.scene, room = sc.room;
    if (!room || room.torchReward) return;
    room.torchReward = true;                         // once per room, even if they get blown out
    const p = sc.players.find((q) => q.alive);
    if (!p) return;
    sc.hud.floatText(p.sprite.x, p.sprite.y - 50, 'All torches lit!', '#ffb74d');
    sc.coins.drop(p.sprite.x, p.sprite.y - 30, Math.round(8 * sc.coinMul()) + 2, sc.team);
    for (let i = 0; i < sc.players.length; i++) { const q = sc.players[i]; if (q.alive) { q.hp = Math.min(q.stats.maxHp, q.hp + Math.round(q.stats.maxHp * 0.1)); q.mana = q.stats.maxMana; } }
  }

  // Wind: blows out torches in range (all of them with r = Infinity).
  blowOut(x, y, r) {
    let n = 0;
    for (let i = 0; i < this.torches.length; i++) {
      const t = this.torches[i];
      if (!t.lit) continue;
      const dx = t.x - x, dy = t.y - y;
      if (r !== Infinity && dx * dx + dy * dy > r * r) continue;
      t.lit = false; t.blowMs = 500; n++;
    }
    return n;
  }

  nearestLitTorch(x, y) {
    let best = null, bd = Infinity;
    for (let i = 0; i < this.torches.length; i++) {
      const t = this.torches[i];
      if (!t.lit) continue;
      const d = (t.x - x) * (t.x - x) + (t.y - y) * (t.y - y);
      if (d < bd) { bd = d; best = t; }
    }
    return best;
  }

  // One-frame light (boss eyes, lasers...).
  add(x, y, r) {
    if (!this.active) return;
    let L = this.extra[this.extraN];
    if (!L) { L = { x: 0, y: 0, r: 0 }; this.extra.push(L); }
    L.x = x; L.y = y; L.r = r; this.extraN++;
  }

  /* ---- burning floors (all stages) ---- */
  addFire(x, y, r, ms, owner) {
    if (this.scene.rooms && this.scene.rooms.solidAt(x, y)) return;
    let f = this.fires.find((q) => !q.active);
    if (!f) { f = this.fires[0]; for (let i = 1; i < this.fires.length; i++) if (this.fires[i].ms < f.ms) f = this.fires[i]; }
    f.active = true; f.x = x; f.y = y; f.r = r; f.ms = ms; f.total = ms; f.owner = owner; f.tick = 0; f.seed = Math.random() * 10;
    this.lightNear(x, y, r + 20);
  }

  updateFires(dt) {
    const sc = this.scene, set = LIGHT_SETTINGS.fire;
    let list = null;
    for (let i = 0; i < this.fires.length; i++) {
      const f = this.fires[i];
      if (!f.active) continue;
      f.ms -= dt;
      if (f.ms <= 0) { f.active = false; continue; }
      f.tick -= dt;
      if (f.tick > 0) continue;
      f.tick += set.tickMs;
      list = list || sc.enemies.targets();
      for (let k = 0; k < list.length; k++) {
        const e = list[k];
        if (!e.active || (e.def && e.def.ghost)) continue;
        const dx = e.x - f.x, dy = e.y - f.y, rr = f.r + ((e.def && e.def.size) || 20) / 2;
        if (dx * dx + dy * dy > rr * rr) continue;
        if (e.state === 'bones') { e.burnBones = true; e.burnOwner = f.owner || null; continue; }
        if (!e.isBossPart && e.burnUntil > sc.time.now + 400) continue;     // already burning: don't stack
        GearFx.ignite(sc.enemies, e, set.ignite, f.owner && f.owner.stats ? f.owner : null);
      }
    }
  }

  drawFires(g, now) {
    for (let i = 0; i < this.fires.length; i++) {
      const f = this.fires[i];
      if (!f.active) continue;
      const k = Math.min(1, f.ms / 600);
      g.fillStyle(0xff6d00, 0.16 * k); g.fillCircle(f.x, f.y, f.r);
      g.fillStyle(0xffab40, 0.22 * k); g.fillCircle(f.x, f.y, f.r * 0.55);
      for (let j = 0; j < 5; j++) {
        const a = f.seed + j * 1.26, rr = f.r * (0.25 + 0.5 * ((j * 37) % 10) / 10);
        const fx = f.x + Math.cos(a) * rr, fy = f.y + Math.sin(a) * rr, h = 7 + 5 * Math.sin(now / 90 + j * 2);
        g.fillStyle(0xff9800, 0.85 * k); g.fillTriangle(fx - 4, fy + 3, fx + 4, fy + 3, fx, fy - h);
        g.fillStyle(0xffeb3b, 0.9 * k); g.fillTriangle(fx - 2, fy + 2, fx + 2, fy + 2, fx, fy - h * 0.5);
      }
    }
  }

  /* ---- every frame ---- */
  update(dt) {
    const sc = this.scene, now = sc.time.now;
    if (sc.mode === 'play') this.updateFires(dt);
    // shots that pass by an unlit torch light it
    if (this.torches.length) {
      const r = LIGHT_SETTINGS.torchHitRange, list = sc.playerBullets.group.getChildren();
      for (let i = 0; i < list.length; i++) { const b = list[i]; if (b.active) this.lightNear(b.x, b.y, r); }
      if (sc.throws) for (let i = 0; i < sc.throws.pool.length; i++) { const a = sc.throws.pool[i]; if (a.active) this.lightNear(a.x, a.y, r + 6); }   // tomahawks, boomerangs
    }
    const fg = this.floor; fg.clear();
    this.drawFires(fg, now);
    const top = this.top; top.clear();
    this.drawTorches(fg, top, now, dt);
    if (!this.active) { this.extraN = 0; return; }

    const S = LIGHT_SETTINGS, b = this.brightness(), rm = S.radiusMul[b];
    const cam = sc.cameras.main, cx = cam.scrollX, cy = cam.scrollY, vw = cam.width, vh = cam.height;
    const rt = this.rt, k = this.scale, batch = this.batch;
    rt.clear();
    rt.fill(S.darkColor, S.alpha[b]);
    batch.length = 0;
    const L = (x, y, r) => {
      r *= rm;
      const sx = x - cx, sy = y - cy;
      if (batch.length >= this.maxLights || sx < -r || sy < -r || sx > vw + r || sy > vh + r) return;
      const st = this.stamps[batch.length];
      st.setPosition(sx * k, sy * k).setScale(r * k / 64);
      batch.push(st);
    };
    for (let i = 0; i < sc.players.length; i++) {
      const p = sc.players[i];
      if (p.alive || p.downed) L(p.sprite.x, p.sprite.y, S.player * (1 + ((p.stats && p.stats.lightBonus) || 0)));   // Gargoyle Eye: see far
    }
    let list = sc.playerBullets.group.getChildren();
    for (let i = 0; i < list.length; i++) {
      const q = list[i];
      if (!q.active) continue;
      L(q.x, q.y, Lighting.isMagic(q) ? S.magicShot : S.shot);
    }
    list = sc.enemyBullets.group.getChildren();
    for (let i = 0; i < list.length; i++) if (list[i].active) L(list[i].x, list[i].y, S.enemyShot);
    if (sc.throws) for (let i = 0; i < sc.throws.pool.length; i++) { const a = sc.throws.pool[i]; if (a.active) L(a.x, a.y, S.shot); }
    for (let i = 0; i < this.torches.length; i++) {
      const t = this.torches[i];
      if (t.lit) L(t.x, t.y + (t.side === 'up' ? 18 : 0), S.torch * (0.95 + 0.05 * Math.sin(now / 70 + t.seed)));
    }
    for (let i = 0; i < this.fires.length; i++) { const f = this.fires[i]; if (f.active) L(f.x, f.y, Math.max(S.fire, f.r * 1.8) * Math.min(1, f.ms / 600)); }
    const fx = sc.hud.fx;
    for (let i = 0; i < fx.length; i++) { const f = fx[i]; if (f.active && !f.line && f.r >= 20) L(f.x, f.y, f.r * 1.5 * Math.min(1, f.ms / f.total + 0.3)); }
    if (sc.zones) for (let i = 0; i < sc.zones.list.length; i++) {
      const z = sc.zones.list[i];
      if (z.active && z.z && !z.z.freeze && !z.z.storm) L(z.x, z.y, (z.z.radius || 60) * 1.5);
    }
    if (sc.rooms.hatchActive) L(sc.rooms.hatch.x, sc.rooms.hatch.y, S.hatch);
    if (sc.allies) for (let i = 0; i < sc.allies.alive.length; i++) { const a = sc.allies.alive[i]; if (a.active) L(a.x, a.y, 60); }
    if (sc.prop && sc.prop.visible) L(sc.prop.x, sc.prop.y, 120);          // chests, shrines, the merchant
    for (let i = 0; i < this.extraN; i++) L(this.extra[i].x, this.extra[i].y, this.extra[i].r);
    this.extraN = 0;
    for (let i = 0; i < batch.length; i++) rt.erase(batch[i]);      // (one call per light: erasing an array doesn't work in this Phaser)
    this.drawEyes(top, now);
  }

  // Magic = arcane weapons / spells (they light up more than arrows and knives).
  static isMagic(b) {
    if (b.ignite || b.chill || b.hex || b.poison || b.wind || b.chain || b.aoeRadius > 0) return true;
    const o = b.owner;
    return !!(o && o.weapon && o.weapon.def && o.weapon.def.class === 'arcane');
  }

  drawTorches(fg, top, now, dt) {
    for (let i = 0; i < this.torches.length; i++) {
      const t = this.torches[i];
      // bracket on the wall
      fg.fillStyle(0x3e2723, 1); fg.fillRect(t.x - 3, t.y - 2, 6, 14);
      fg.fillStyle(0x5d4037, 1); fg.fillRect(t.x - 6, t.y - 6, 12, 6);
      if (t.lit) {
        const h = 12 + 3 * Math.sin(now / 80 + t.seed) + 2 * Math.sin(now / 37 + t.seed * 3);
        top.fillStyle(0xff6d00, 0.25); top.fillCircle(t.x, t.y - 8, 16);
        top.fillStyle(0xff9800, 1); top.fillTriangle(t.x - 6, t.y - 4, t.x + 6, t.y - 4, t.x + Math.sin(now / 120 + t.seed) * 2, t.y - 4 - h);
        top.fillStyle(0xffeb3b, 1); top.fillTriangle(t.x - 3, t.y - 4, t.x + 3, t.y - 4, t.x, t.y - 4 - h * 0.55);
      } else {
        top.fillStyle(0x6d4c41, this.active ? 0.9 : 1); top.fillRect(t.x - 5, t.y - 9, 10, 5);   // dead torch: still visible, so you know it's there
        top.lineStyle(1, 0xffcc80, 0.35 + 0.15 * Math.sin(now / 300 + t.seed)); top.strokeRect(t.x - 6, t.y - 10, 12, 7);
        if (t.blowMs > 0) {                       // a puff of smoke after being blown out
          t.blowMs -= dt;
          const k = 1 - t.blowMs / 500;
          top.fillStyle(0x9e9e9e, 0.5 * (1 - k)); top.fillCircle(t.x + k * 8, t.y - 12 - k * 18, 4 + k * 6);
        }
      }
    }
  }

  // Glowing eyes: you can always see where enemies are, even in the dark.
  drawEyes(g, now) {
    const list = this.scene.enemies.group.getChildren();
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      if (!e.active || e.visible === false || e.state === 'bones' || e.state === 'dust') continue;
      const d = e.def;
      if (d.boss) continue;                       // bosses draw their own
      const col = d.eyeColor || 0xff5252, s = (d.size || 20) * (e.scaleX || 1);
      const fx = Math.cos(e.faceAng || 0) * s * 0.12, y = e.y - s * 0.15, w = Math.max(2.5, s * 0.13);
      g.fillStyle(col, 0.25 * (e.alpha === undefined ? 1 : e.alpha)); g.fillCircle(e.x + fx, y, w * 2.4);
      g.fillStyle(col, 0.95 * (e.alpha === undefined ? 1 : e.alpha));
      g.fillCircle(e.x - s * 0.17 + fx, y, w * 0.55); g.fillCircle(e.x + s * 0.17 + fx, y, w * 0.55);
    }
  }
}
