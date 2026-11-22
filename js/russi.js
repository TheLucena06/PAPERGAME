/* russi.js  - SECRET. Don't put this in the bestiary hints or the balance sheet.

   Type "russi" on the main menu (or tap the title 5 times on a phone and
   type it). Then:
   - the Cupid starter kit unlocks (the Harp, until Cupid gets an armor);
   - the NEXT run, the Notebook's boss is not the Bookworm but BIG RUSSI:
     a giant floating head, a bullet-hell fight (spirals of teeth, laughing
     rings, hair curtains, head-butt charges, mini heads); 3 phases;
   - the run AFTER that fight, every normal enemy wears his face (and
     flinches when you hit it).

   Faces are two photos embedded in russi_art.js and drawn into canvas
   textures (works offline, no files to load). */

/* ---------------- art ---------------- */
const RussiArt = {
  img: {},
  pending: [],           // canvas textures waiting for the photos to decode
  init() {
    for (const k in RUSSI_ART) {
      const im = new Image();
      im.onload = () => { const list = this.pending.slice(); this.pending.length = 0; for (let i = 0; i < list.length; i++) this.paint(list[i]); };
      im.src = RUSSI_ART[k].src;
      this.img[k] = im;
    }
  },
  ready(k) { const im = this.img[k]; return !!(im && im.complete && im.naturalWidth); },
  // A canvas texture (key, w x h) with photo `which` drawn in it. fit: 'contain' or 'cover'.
  texture(scene, key, w, h, which, fit, zoom) {
    if (scene.textures.exists(key)) return key;
    const tex = scene.textures.createCanvas(key, w, h);
    const job = { tex: tex, w: w, h: h, which: which, fit: fit || 'contain', zoom: zoom || 1 };
    if (this.ready(which)) this.paint(job); else this.pending.push(job);
    return key;
  },
  paint(job) {
    if (!this.ready(job.which)) { this.pending.push(job); return; }
    const im = this.img[job.which], ctx = job.tex.getContext();
    const s = (job.fit === 'cover' ? Math.max(job.w / im.width, job.h / im.height) : Math.min(job.w / im.width, job.h / im.height)) * job.zoom;
    const dw = im.width * s, dh = im.height * s;
    ctx.clearRect(0, 0, job.w, job.h);
    ctx.drawImage(im, (job.w - dw) / 2, (job.h - dh) / 2, dw, dh);
    job.tex.refresh();
  }
};
RussiArt.init();

/* ---------------- the boss ---------------- */
const RUSSI_TEX = { boss: [210, 230], mini: [40, 44] };

ENEMY_TYPES.russiHead = {
  name: 'BIG RUSSI', ai: 'russiHead', immovable: true, noIdle: true, secret: true, lootAs: 'bookworm',
  boss: { arena: [15, 10], defeatCoins: 60 },
  cost: 0, weight: 0, coins: [0, 0],
  maxHp: 1900, speed: 240, speedVariance: 0, size: 120, color: 0xffccbc, mass: 100,
  contactDamage: 12, dashDamage: 22,
  hitKnockback: 0, hitKnockbackMs: 0, contactPushback: 0, contactPushbackMs: 0,
  bullet: 11,                                  // every bullet (x the level's damage)
  phase2At: 0.55, phase3At: 0.2,
  maxMinis: 6
};
ENEMY_TYPES.russiMini = {
  name: 'Mini Russi', ai: 'chase', secret: true,
  cost: 0, weight: 0, coins: [1, 1],
  maxHp: 36, speed: 150, speedVariance: 0.15, size: 30, color: 0xffccbc, mass: 1,
  contactDamage: 9, hitKnockback: 260, hitKnockbackMs: 120, contactPushback: 200, contactPushbackMs: 120
};

const RUSSI_LINES = {
  intro: ['* Big Russi blocks the way!', '* It smells like teeth.'],
  phase2: ['* Big Russi is laughing at you.', 'KKKKKKKKKKKK'],
  phase3: ['* Big Russi gives it everything!', '* ...he is not okay.'],
  laugh: ['KKKKKK', 'kkkkk', 'HAHAHA', 'kkkkkkkkkk', 'ai ai'],
  charge: ['* HEADBUTT', 'vrummm', 'sai da frente!'],
  minis: ['* there are more of him', 'mini russis!'],
  win: ['* Big Russi was defeated.', '* (he will be back)']
};
const pickLine = (k) => RUSSI_LINES[k][Math.floor(Math.random() * RUSSI_LINES[k].length)];

const RussiBoss = {
  patterns: {
    1: ['spiral', 'fans', 'rings', 'charge', 'curtain', 'minis'],
    2: ['spiral', 'curtain', 'rings', 'charge', 'fans', 'minis', 'cross'],
    3: ['flower']
  },
  init(e) {
    e.rb = { t: 0, phase: 1, pat: null, patMs: 0, restMs: 1400, fireMs: 0, ang: 0, queue: [], tele: null, charge: null, n: 0 };
    e.forceFlinch = false;
  },
  speedMul(e) { return e.rb.phase === 1 ? 1 : (e.rb.phase === 2 ? 1.18 : 1.3); },
  shoot(e, ctx, ang, speed, tex, from) {
    const x = from ? from.x : e.x + Math.cos(ang) * 56, y = from ? from.y : e.y + Math.sin(ang) * 56;
    return ctx.enemyBullets.fire(x, y, Math.cos(ang), Math.sin(ang), speed, Math.round(e.def.bullet * e.dmgMul), 6500, e, tex || 'rtooth');
  },
  say(m, e, text, color) { if (m.scene.hud) m.scene.hud.floatText(e.x, e.y - 120, text, color || '#ad1457'); },

  update(m, e, t, dt, ctx) {
    if (!e.rb) this.init(e);
    const rb = e.rb, R = ctx.rooms, sc = m.scene;
    rb.t += dt;
    // phases
    const pct = e.hp / e.maxHp, ph = pct < e.def.phase3At ? 3 : (pct < e.def.phase2At ? 2 : 1);
    if (ph !== rb.phase) {
      rb.phase = ph; rb.pat = null; rb.queue.length = 0; rb.restMs = 900; rb.charge = null; rb.tele = null;
      e.state = 'move';
      if (sc.hud) sc.hud.showBanner(pickLine(ph === 2 ? 'phase2' : 'phase3'));
      sc.cameras.main.shake(400, 0.01);
      sc.cameras.main.flash(200, 255, 205, 210);
      e.faceFlinchMs = 900;
    }
    if (rb.t < 50 && sc.hud) sc.hud.showBanner(pickLine('intro'));
    // movement: drift around the top of the room (unless charging)
    if (!rb.charge) {
      const hx = R.W / 2 + Math.sin(rb.t / 1700) * R.W * 0.26, hy = R.H * 0.3 + Math.sin(rb.t / 650) * 30;
      const vx = (hx - e.x) * 2.6, vy = (hy - e.y) * 2.6, v = Math.sqrt(vx * vx + vy * vy), cap = 260;
      e.setVelocity(v > cap ? vx / v * cap : vx, v > cap ? vy / v * cap : vy);
    }
    e.forceFlinch = false;
    // patterns
    if (!rb.pat) {
      rb.restMs -= dt;
      if (rb.restMs > 0) return;
      if (!rb.queue.length) rb.queue = Phaser.Utils.Array.Shuffle(this.patterns[rb.phase].slice());
      rb.pat = rb.queue.shift();
      rb.patMs = 0; rb.fireMs = 0; rb.n = 0;
      if (rb.pat === 'minis' && m.group.getChildren().filter((o) => o.active && o.typeId === 'russiMini').length >= e.def.maxMinis) rb.pat = 'spiral';
    }
    rb.patMs += dt;
    const done = this[rb.pat](m, e, t, dt, ctx, rb);
    if (done) { rb.pat = null; rb.restMs = rb.phase === 1 ? 650 : (rb.phase === 2 ? 450 : 200); e.state = 'move'; }
  },

  // 3-5 armed rotating spiral of teeth (phase 2: plus hair going the other way)
  spiral(m, e, t, dt, ctx, rb) {
    const sp = this.speedMul(e), arms = rb.phase === 1 ? 3 : 4;
    rb.fireMs -= dt;
    while (rb.fireMs <= 0) {
      rb.fireMs += 120 / sp;
      rb.ang += 0.21;
      for (let k = 0; k < arms; k++) this.shoot(e, ctx, rb.ang + k * Math.PI * 2 / arms, 175 * sp);
      if (rb.phase >= 2 && (rb.n++ % 2 === 0)) for (let k = 0; k < 3; k++) this.shoot(e, ctx, -rb.ang * 1.3 + k * Math.PI * 2 / 3, 150 * sp, 'rstrand');
    }
    return rb.patMs > 3600;
  },
  // laughing: rings with a gap-shifted offset each time
  rings(m, e, t, dt, ctx, rb) {
    const sp = this.speedMul(e), n = rb.phase === 1 ? 16 : 22;
    e.forceFlinch = true;
    rb.fireMs -= dt;
    if (rb.fireMs <= 0) {
      rb.fireMs = 640 / sp;
      const off = (rb.n++ % 2) * Math.PI / n + Math.random() * 0.2;
      for (let k = 0; k < n; k++) this.shoot(e, ctx, off + k * Math.PI * 2 / n, 165 * sp);
      if (rb.n % 2) this.say(m, e, pickLine('laugh'), '#c2185b');
    }
    return rb.patMs > 3000;
  },
  // aimed fans
  fans(m, e, t, dt, ctx, rb) {
    const sp = this.speedMul(e), n = rb.phase === 1 ? 5 : 7, spread = 0.95;
    rb.fireMs -= dt;
    if (rb.fireMs <= 0 && rb.n < 4) {
      rb.fireMs = 520 / sp; rb.n++;
      const a = Math.atan2(t.sprite.y - e.y, t.sprite.x - e.x);
      for (let k = 0; k < n; k++) this.shoot(e, ctx, a - spread / 2 + spread * k / (n - 1), 255 * sp);
    }
    return rb.patMs > 2500;
  },
  // Undertale-style curtain: rows of hair fall from the top with a gap to slip through
  curtain(m, e, t, dt, ctx, rb) {
    const sp = this.speedMul(e), R = ctx.rooms, T = 64;
    rb.fireMs -= dt;
    if (rb.fireMs <= 0 && rb.n < (rb.phase === 1 ? 5 : 6)) {
      rb.fireMs = 760 / sp; rb.n++;
      const gap = 120 - (rb.phase - 1) * 14, gx = T + 40 + Math.random() * (R.W - 2 * T - 80 - gap);
      const sideways = rb.phase >= 2 && rb.n % 3 === 0;      // phase 2: some rows come from the side
      if (!sideways) {
        for (let x = T + 12; x < R.W - T; x += 32) if (x < gx || x > gx + gap) this.shoot(e, ctx, Math.PI / 2, 185 * sp, 'rstrand', { x: x, y: T + 14 });
      } else {
        const gy = T + 40 + Math.random() * (R.H - 2 * T - 80 - gap), left = Math.random() < 0.5;
        for (let y = T + 12; y < R.H - T; y += 32) if (y < gy || y > gy + gap) this.shoot(e, ctx, left ? 0 : Math.PI, 185 * sp, 'rstrand', { x: left ? T + 14 : R.W - T - 14, y: y });
      }
    }
    return rb.patMs > (rb.phase === 1 ? 4200 : 5000);
  },
  // shake + aim line, then a headbutt across the room
  charge(m, e, t, dt, ctx, rb) {
    const R = ctx.rooms;
    if (!rb.charge) {
      rb.charge = { stage: 'aim', ms: 0, tx: t.sprite.x, ty: t.sprite.y, n: 0 };
      this.say(m, e, pickLine('charge'), '#d84315');
    }
    const c = rb.charge;
    c.ms += dt;
    e.forceFlinch = true;
    if (c.stage === 'aim') {
      e.setVelocity((Math.random() - 0.5) * 120, (Math.random() - 0.5) * 120);    // shaking
      c.tx = c.tx + (t.sprite.x - c.tx) * Math.min(1, dt / 160); c.ty = c.ty + (t.sprite.y - c.ty) * Math.min(1, dt / 160);
      rb.tele = { x1: e.x, y1: e.y, x2: c.tx, y2: c.ty, k: Math.min(1, c.ms / 700) };
      if (c.ms >= (rb.phase === 1 ? 750 : 600)) {
        const dx = c.tx - e.x, dy = c.ty - e.y, len = Math.sqrt(dx * dx + dy * dy) || 1;
        c.dx = dx / len; c.dy = dy / len; c.stage = 'go'; c.ms = 0; rb.tele = null;
        e.state = 'dash';
      }
    } else if (c.stage === 'go') {
      const v = 820 * this.speedMul(e);
      e.setVelocity(c.dx * v, c.dy * v);
      const hitWall = R.solidAt(e.x + c.dx * 70, e.y + c.dy * 70);
      if (hitWall || c.ms > 900) {
        e.setVelocity(0, 0); e.state = 'move';
        m.scene.cameras.main.shake(220, 0.012);
        // bonk: a burst of teeth from the wall
        const n = rb.phase === 1 ? 10 : 14;
        for (let k = 0; k < n; k++) this.shoot(e, ctx, k * Math.PI * 2 / n, 150 * this.speedMul(e));
        c.n++;
        if (rb.phase >= 2 && c.n < 2) { c.stage = 'aim'; c.ms = 0; c.tx = t.sprite.x; c.ty = t.sprite.y; }   // phase 2: a second headbutt
        else { c.stage = 'back'; c.ms = 0; }
      }
    } else if (c.ms > 700) { rb.charge = null; return true; }
    return false;
  },
  // mini heads + a small spiral while they come in
  minis(m, e, t, dt, ctx, rb) {
    if (rb.n === 0) {
      rb.n = 1;
      const count = rb.phase === 1 ? 2 : 3;
      for (let k = 0; k < count; k++) {
        const a = Math.PI * 2 * k / count + Math.random();
        const o = m.spawn('russiMini', e.x + Math.cos(a) * 90, e.y + Math.sin(a) * 90);
        if (o) { o.maxHp = Math.round(o.maxHp); o.hp = o.maxHp; }
      }
      this.say(m, e, pickLine('minis'), '#6a1b9a');
      e.faceFlinchMs = 400;
    }
    return this.spiral(m, e, t, dt, ctx, rb) || rb.patMs > 2200;
  },
  // phase 2: a big rotating cross of teeth + aimed shots
  cross(m, e, t, dt, ctx, rb) {
    const sp = this.speedMul(e);
    rb.fireMs -= dt;
    while (rb.fireMs <= 0) {
      rb.fireMs += 70;
      rb.ang += 0.045;
      for (let k = 0; k < 4; k++) this.shoot(e, ctx, rb.ang + k * Math.PI / 2, 230 * sp);
      if (rb.n++ % 12 === 0) this.shoot(e, ctx, Math.atan2(t.sprite.y - e.y, t.sprite.x - e.x), 300 * sp, 'rstrand');
    }
    return rb.patMs > 3400;
  },
  // phase 3: never stops. A swaying flower + rings
  flower(m, e, t, dt, ctx, rb) {
    e.forceFlinch = (Math.floor(rb.patMs / 400) % 2) === 0;
    rb.fireMs -= dt;
    while (rb.fireMs <= 0) {
      rb.fireMs += 105;
      const base = Math.sin(rb.patMs / 650) * 2.4;
      for (let k = 0; k < 5; k++) this.shoot(e, ctx, base + k * Math.PI * 2 / 5, 165, k % 2 ? 'rstrand' : 'rtooth');
    }
    rb.ringMs = (rb.ringMs || 0) - dt;
    if (rb.ringMs <= 0) {
      rb.ringMs = 1500;
      const a0 = Math.random();
      for (let k = 0; k < 14; k++) this.shoot(e, ctx, a0 + k * Math.PI * 2 / 14, 140);
      this.say(m, e, pickLine('laugh'), '#c2185b');
    }
    return rb.patMs > 6000;
  }
};
ENEMY_AI.russiHead = function (m, e, t, dt, ctx) { RussiBoss.update(m, e, t, dt, ctx); };

/* ---------------- hooks ---------------- */
// textures: canvas textures that show the photos (filled in as soon as the photos decode)
(function () {
  const make = FoeTextures.make;
  FoeTextures.make = function (scene, id, def) {
    if (id === 'russiHead') {
      const [w, h] = RUSSI_TEX.boss;
      RussiArt.texture(scene, 'enemy_russiHead', w, h, 'face', 'contain');
      RussiArt.texture(scene, 'flinch_russiHead', w, h, 'flinch', 'contain');
      return true;
    }
    if (id === 'russiMini') {
      const [w, h] = RUSSI_TEX.mini;
      RussiArt.texture(scene, 'enemy_russiMini', w, h, 'face', 'contain');
      RussiArt.texture(scene, 'flinch_russiMini', w, h, 'flinch', 'contain');
      return true;
    }
    return make.call(this, scene, id, def);
  };
  const tex = Arcane3bTextures.make;
  Arcane3bTextures.make = function (scene) {
    tex.call(this, scene);
    const W = (k, w, h, fn) => TextureFactory.withGraphics(scene, k, w, h, fn);
    W('rtooth', 12, 14, (g) => {
      g.fillStyle(0x5d4037, 1); g.fillRoundedRect(0, 0, 12, 14, 4);
      g.fillStyle(0xfffde7, 1); g.fillRoundedRect(1.5, 1.5, 9, 11, 3);
      g.fillStyle(0xffffff, 1); g.fillRect(3, 3, 2, 5);
    });
    W('rstrand', 14, 14, (g) => {
      g.lineStyle(3, 0x1b1b1b, 1);
      g.beginPath(); g.moveTo(2, 12); g.lineTo(5, 6); g.lineTo(9, 9); g.lineTo(12, 2); g.strokePath();
      g.fillStyle(0x3e2723, 0.5); g.fillCircle(7, 7, 7);
    });
  };
  // he drops the Bookworm's loot (he took its place)
  const bossLoot = ShopLogic.bossLoot;
  ShopLogic.bossLoot = function (id) {
    const d = ENEMY_TYPES[id];
    return bossLoot.call(this, d && d.lootAs ? d.lootAs : id);
  };
  // enemies that wear the face flinch when hurt
  const damage = EnemyManager.prototype.damage;
  EnemyManager.prototype.damage = function (e) {
    const killed = damage.apply(this, arguments);
    if (!killed && e.active && e.faceKeys) e.faceFlinchMs = 220;
    return killed;
  };
  // faces run: swap the texture when an enemy spawns (same size texture, so the hitbox doesn't move)
  const spawn = EnemyManager.prototype.spawn;
  EnemyManager.prototype.spawn = function (typeId, x, y) {
    const e = spawn.call(this, typeId, x, y);
    if (!e) return e;
    e.faceKeys = null; e.faceFlinchMs = 0; e.forceFlinch = false; e.rb = null;
    if (typeId === 'russiHead' || typeId === 'russiMini') e.faceKeys = ['enemy_' + typeId, 'flinch_' + typeId];
    else if (this.scene.facesRun && RussiFaces.can(e.def)) e.faceKeys = RussiFaces.keys(this.scene, typeId);
    if (e.faceKeys) e.setTexture(e.faceKeys[0]);
    return e;
  };
  // secret save fields
  const clean = SaveData.clean;
  SaveData.clean = function (d) {
    const b = clean.call(this, d);
    b.secret = (d && d.secret && typeof d.secret === 'object') ? d.secret : {};
    return b;
  };
  // the Cupid starter kit (secret; the Harp until Cupid gets an armor)
  KIT_TYPES.cupid = { name: 'Cupid', class: 'arcane', sub: 'Cupid', weapon: 'harp', armor: null, secret: true, hint: 'Some codes are better left unsaid.' };
  // main menu: the code (typed, or tap the title 5x on a phone)
  MENU_CODES.russi = (scene) => RussiCode.trigger(scene);
})();

const RussiFaces = {
  can(def) { return !!def && !def.boss && !def.bossPart && !def.secret && !def.noFace; },
  keys(scene, id) {
    const src = scene.textures.get('enemy_' + id).getSourceImage();
    const w = Math.max(8, src.width || 32), h = Math.max(8, src.height || 32);
    return [RussiArt.texture(scene, 'rface_' + id, w, h, 'face', 'cover', 1.05), RussiArt.texture(scene, 'rflinch_' + id, w, h, 'flinch', 'cover', 1.05)];
  }
};

const RussiCode = {
  word: 'russi',
  trigger(scene) {
    const s = SaveData.data.secret || (SaveData.data.secret = {});
    s.russiBoss = true;
    SaveData.unlockKit('cupid');
    SaveData.save();
    scene.cameras.main.shake(250, 0.006);    // the only sign it worked: no message, no face
  }
};

/* ---------------- the run hooks (GameScene) ---------------- */
const RussiMixin = {
  // called at the start of every run
  russiRunStart() {
    this.russiRun = false; this.facesRun = false;
    if (this.testMode) return;
    const s = SaveData.data.secret || (SaveData.data.secret = {});
    if (s.russiFaces) { this.facesRun = true; s.russiFaces = false; }      // the run after the fight
    else if (s.russiBoss) { this.russiRun = true; s.russiBoss = false; }    // the next run after the code
    SaveData.save();
  },
  // the Notebook's boss becomes Big Russi on that run
  russiBossId(id) {
    if (this.russiRun && id === 'bookworm') {
      const s = SaveData.data.secret || (SaveData.data.secret = {});
      s.russiFaces = true;           // whatever happens in this fight, the next run has faces
      SaveData.save();
      return 'russiHead';
    }
    return id;
  },
  updateRussi(dt) {
    if (!this.russiG || !this.russiG.scene) this.russiG = this.add.graphics().setDepth(83);   // (scenes get reused on restart)
    const g = this.russiG;
    g.clear();
    const list = this.enemies.group.getChildren();
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      if (!e.active || !e.faceKeys || e.state === 'bones' || e.state === 'dust') continue;   // bone piles stay bones
      if (e.faceFlinchMs > 0) e.faceFlinchMs -= dt;
      const want = (e.faceFlinchMs > 0 || e.forceFlinch) ? e.faceKeys[1] : e.faceKeys[0];
      if (e.texture.key !== want) e.setTexture(want);
      // the headbutt aim line
      if (g && e.rb && e.rb.tele) {
        const T = e.rb.tele;
        g.lineStyle(6, 0xd50000, 0.15 + 0.35 * T.k); g.lineBetween(T.x1, T.y1, T.x2, T.y2);
        g.lineStyle(2, 0xffffff, 0.5 * T.k); g.lineBetween(T.x1, T.y1, T.x2, T.y2);
      }
    }
  }
};
