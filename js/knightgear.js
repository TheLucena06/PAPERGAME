/* knightgear.js  (v3.4, owner's designs)
   - Arrow Volley ("Salva de flechas"): ★★★ Archer skill. A wide piercing volley where you aim. Copies the held bow's
     special effect at a smaller scale. Without a bow (or crossbow) it does much less damage.
   - Brigade Armor: ★★★ Knight armor. Your hits can RESTRAIN enemies (slower, take more damage; stacks).
   - Knight Shield (new ★★, the Buckler is unchanged): raising it gives a 15 HP guard that soaks hits. Broken = 4 s before it comes
     back. Dash INTO an enemy attack while holding the shield up: most of the damage goes back to the attacker,
     with knockback and a short stun.
   - Gargoyles: they tense up (eyes flare, hover) right before each swoop, so the shield parry can be timed;
     a melee dash-attack on a gargoyle bashes it (stun).
   Hooks: main.js hitEnemy -> knightOnHit (damage multiplier + restrain proc); onPlayerHit -> knightHitCheck. */

const KNIGHT_RULES = {
  restrain: { ms: 4000, maxStacks: 3, slowPer: 0.15, dmgPer: 0.10 },   // enemies restrained by the Brigade Armor
  gargoyleBashStunMs: 1200
};

Object.assign(STAT_DEFAULTS, { restrainChance: 0 });

/* ---------------- items ---------------- */
SKILL_TYPES.arrowVolley = {
  name: 'Arrow Volley', short: 'VOLY', kind: 'arrowVolley', class: 'precision', sub: 'Archer', price: 150, postBoss: POST_BOSS_2,
  desc: 'A block of 15 arrows flies where you aim:\n5 wide (4 of you) x 3 deep, all parallel.\nEach: 40% of your bow\'s full shot (min 30),\npierce 3. Copies your bow\'s effect,\nsmaller. No bow held: only 35% damage.',
  manaCost: 70, cooldownMs: 9000,
  lanes: 5, rows: 3, widthBodies: 4, rowGap: 30, bowMul: 0.4, minDamage: 30, noBowMul: 0.35, pierce: 3,
  speed: 940, lifetimeMs: 950
};

ARMOR_TYPES.brigadeArmor = {
  name: 'Brigade Armor', short: 'BRGD', class: 'melee', sub: 'Knight', price: 140, postBoss: POST_BOSS_2,
  desc: '+25 max HP, defense 26%.\nEvery hit you deal: 15% chance to\nRESTRAIN the enemy for 4 s (stacks 3x):\n-15% speed, +10% damage taken each.',
  mods: { maxHp: 25, defense: 0.26, restrainChance: 0.15 }
};

// Knight Shield: a new ★★ Knight shield (the Buckler stays as it was).
WEAPON_TYPES.knightShield = {
  name: 'Knight Shield', short: 'KSHD', kind: 'shield', class: 'melee', sub: 'Knight', type: 'shield', price: 90, postBoss: POST_BOSS_1,
  desc: 'Hold attack to raise: blocks 45% from\nthe front + a 15 HP guard that soaks hits\n(broken: back after 4 s). Raise right before\na hit to parry (stun 1.8 s). Dash INTO an\nattack with it up: 80% of the damage goes\nback, knockback + stun 0.9 s.',
  arcDeg: 170, blockPct: 0.45, parryWindowMs: 180, stunMs: 1800, parryDamage: 6, reraiseDelayMs: 380,
  guard: { hp: 15, breakCdMs: 4000, regenDelayMs: 1500, regenPerSec: 6 },
  reflect: { pct: 0.8, knockback: 420, knockbackMs: 180, stunMs: 900 },
  visual: { style: 'shield', color: 0x1565c0 }
};

// Recurve Bow: owner's call, Test Dungeon only (few use cases).
WEAPON_TYPES.recurveBow.debugOnly = true;
delete WEAPON_TYPES.recurveBow.blueprint;
delete BLUEPRINT_TYPES.recurveBow;

/* ---------------- Arrow Volley ---------------- */
SKILL_BEHAVIORS.arrowVolley = function (p, d, ctx) {
  const wd = p.weapon && p.weapon.def, bow = !!wd && (wd.type === 'bow' || wd.type === 'crossbow');
  const full = bow ? (wd.fullDamage || wd.damage || 40) : 0;
  let dmg = bow ? Math.max(d.minDamage, full * d.bowMul) : d.minDamage * d.noBowMul;
  dmg = Math.round(dmg * p.stats.damageMul);
  const homing = bow && wd.homing ? wd.homing * 0.5 : 0;
  const pierce = d.pierce + (bow && wd.pierceCount ? Math.floor(wd.pierceCount / 3) : 0) + (bow && wd.pierce ? wd.pierce : 0);
  const rows = d.rows + (bow && wd.fullFan ? 1 : 0);                      // Composite Bow: one more row
  const mana = bow && wd.manaArrow ? wd.manaArrow : null;                  // Mana Bow: every 3rd arrow pops (small)
  const love = bow && wd.love ? { charge: (wd.love.charge || 0.3) * 0.35, chance: wd.love.chance ? wd.love.chance * 0.35 : 0 } : null;
  const tex = bow ? (wd.texture || 'arrow') : 'arrow';
  // a rectangle: lanes side by side (about 4 player bodies wide), rows one behind the other, all flying the same way
  const ax = p.input.aimX, ay = p.input.aimY, base = Math.atan2(ay, ax), nx = -ay, ny = ax;
  const width = p.stats.size * d.widthBodies, R = ctx.scene ? ctx.scene.rooms : null;
  let k = 0;
  for (let row = 0; row < rows; row++) for (let lane = 0; lane < d.lanes; lane++, k++) {
    const side = (lane / (d.lanes - 1) - 0.5) * width, back = row * d.rowGap;
    let x = p.sprite.x + nx * side - ax * back + ax * p.stats.size * 0.7, y = p.sprite.y + ny * side - ay * back + ay * p.stats.size * 0.7;
    if (R && R.solidAt(x, y)) { x = p.sprite.x - ax * back; y = p.sprite.y - ay * back; }
    const b = WeaponSystem.fireArrow(p, ctx, ax, ay, d.speed, dmg, d.lifetimeMs + back * 1000 / d.speed, tex, pierce, homing, null, true);
    if (!b) continue;
    b.setPosition(x, y); b.body.reset(x, y); b.body.setVelocity(ax * d.speed, ay * d.speed);
    b.love = love;
    if (mana && k % 3 === 1) b.aoeRadius = Math.round(mana.radius * 0.5);
  }
  if (ctx.fx) { ctx.fx(p.sprite.x + Math.cos(base) * 30, p.sprite.y + Math.sin(base) * 30, 34, bow ? 0xffb300 : 0x9e9e9e, 200); }
  if (ctx.shake) ctx.shake(70, 0.003);
  return true;
};

/* ---------------- player hooks: guard + reflect ---------------- */
(function () {
  const takeHit = Player.prototype.takeHit;
  Player.prototype.takeHit = function (amount, srcX, srcY) {
    const w = this.weapon, d = w && w.def;
    // dashing into an attack with the Knight Shield up: remember it; knightHitCheck sends it back to the attacker
    if (d && d.reflect && this.alive && this.isDashing() && this.input && this.input.attack) {
      if (!this.shieldReflect || amount > this.shieldReflect.amount) this.shieldReflect = { amount: amount, x: srcX, y: srcY };
      return 'none';
    }
    // Knight Shield raised: the guard soaks damage first (it rides on the barrier, which takeHit already uses)
    if (d && d.guard && w.raised && this.guardHp > 0 && !(this.guardCdMs > 0)) {
      const b0 = this.barrierHp || 0, g = this.guardHp;
      this.barrierHp = b0 + g;
      const res = takeHit.call(this, amount, srcX, srcY);
      const used = (b0 + g) - (this.barrierHp || 0), gu = Math.min(used, g);
      this.guardHp = g - gu;
      this.barrierHp = Math.max(0, b0 - (used - gu));
      if (gu > 0) this.guardIdleMs = 0;
      if (this.guardHp <= 0) {
        this.guardCdMs = d.guard.breakCdMs;
        const sc = this.scene;
        if (sc && sc.hud) { sc.hud.floatText(this.sprite.x, this.sprite.y - 40, 'Guard broken!', '#90a4ae'); sc.hud.addFx(this.sprite.x, this.sprite.y, 30, 0xcfd8dc, 200); }
      }
      return res;
    }
    return takeHit.call(this, amount, srcX, srcY);
  };
})();

/* ---------------- the mixin ---------------- */
const KnightMixin = {
  setupKnight() {
    this.knightG = this.add.graphics().setDepth(84);
  },

  // From hitEnemy (before the damage lands). Returns the damage to use.
  knightOnHit(e, dmg, owner, source) {
    const now = this.time.now, R = KNIGHT_RULES.restrain;
    if (e.restrainUntil > now) dmg = Math.round(dmg * (1 + R.dmgPer * e.restrainN));
    if (!owner || !owner.stats || source === 'dot' || source === 'love' || source === 'cart' || source === 'wall') return dmg;
    if (owner.stats.restrainChance > 0 && Math.random() < owner.stats.restrainChance) {
      e.restrainN = Math.min(R.maxStacks, (e.restrainUntil > now ? e.restrainN || 0 : 0) + 1);
      e.restrainUntil = now + R.ms;
      this.enemies.slow(e, R.ms, R.slowPer * e.restrainN);
      this.hud.floatText(e.x, e.y - (e.def.size / 2) - 14, 'Restrained x' + e.restrainN, '#78909c');
    }
    // melee dash-attack on a gargoyle: bashed out of the air
    const wd = owner.weapon && owner.weapon.def;
    if (e.typeId === 'gargoyle' && wd && wd.class === 'melee' && owner.reflectMs > 0 && source !== 'aoe' && !(e.stunnedMs > 0)) {
      this.enemies.stun(e, KNIGHT_RULES.gargoyleBashStunMs);
      this.hud.floatText(e.x, e.y - 26, 'Bash!', '#ffd54f');
      this.hud.addFx(e.x, e.y, 26, 0xffd54f, 200);
    }
    return dmg;
  },

  // From onPlayerHit: the Knight Shield dash reflect.
  knightHitCheck(p, res, attacker) {
    const r = p.shieldReflect;
    if (!r) return;
    p.shieldReflect = null;
    const d = p.weapon && p.weapon.def && p.weapon.def.reflect;
    if (!d || !attacker || !attacker.active || !attacker.isEnemy) return;
    const now = this.time.now;
    if (attacker.reflectedAt > now) return;
    attacker.reflectedAt = now + 400;
    const dx = attacker.x - p.sprite.x, dy = attacker.y - p.sprite.y, len = Math.sqrt(dx * dx + dy * dy) || 1;
    this.hitEnemy(attacker, Math.max(1, Math.round(r.amount * d.pct * p.stats.damageMul)), dx / len, dy / len, d.knockback, d.knockbackMs, p, 'reflect');
    if (attacker.active && !attacker.isBossPart) this.enemies.stun(attacker, d.stunMs);
    this.hud.floatText(p.sprite.x, p.sprite.y - 42, 'Reflect!', '#ffd54f');
    this.hud.addFx(p.sprite.x + dx / len * 20, p.sprite.y + dy / len * 20, 34, 0xffd54f, 240);
    this.cameras.main.shake(90, 0.006);
  },

  updateKnight(dt) {
    const g = this.knightG, now = this.time.now, playing = this.mode === 'play';
    g.clear();
    for (let i = 0; i < this.players.length; i++) {
      const p = this.players[i], d = p.weapon && p.weapon.def;
      p.shieldReflect = null;                                   // a reflect only counts in the frame it happened
      const G = WEAPON_TYPES.knightShield.guard;
      if (p.guardHp === undefined) p.guardHp = G.hp;
      if (playing) {
        if (p.guardCdMs > 0) { p.guardCdMs -= dt; if (p.guardCdMs <= 0) { p.guardHp = G.hp; p.guardCdMs = 0; } }
        else if (p.guardHp < G.hp) {
          p.guardIdleMs = (p.guardIdleMs || 0) + dt;
          if (p.guardIdleMs > G.regenDelayMs) p.guardHp = Math.min(G.hp, p.guardHp + G.regenPerSec * dt / 1000);
        }
      }
      // guard bar under the player while the Knight Shield is in hand
      if (!p.alive || !d || !d.guard) continue;
      const x = p.sprite.x, y = p.sprite.y + p.stats.size / 2 + 8, w = 34;
      const k = p.guardCdMs > 0 ? 1 - p.guardCdMs / G.breakCdMs : p.guardHp / G.hp;
      g.fillStyle(0x263238, 0.55); g.fillRect(x - w / 2 - 1, y - 1, w + 2, 6);
      g.fillStyle(p.guardCdMs > 0 ? 0x78909c : (p.weapon.raised ? 0x90caf9 : 0xcfd8dc), p.guardCdMs > 0 ? 0.6 : 1);
      g.fillRect(x - w / 2, y, w * Math.max(0, Math.min(1, k)), 4);
    }
    // restrained enemies: chain links over their heads; gargoyles about to swoop: eyes flare
    const list = this.enemies.group.getChildren();
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      if (!e.active || !e.def) continue;
      if (e.restrainUntil > now) {
        const n = e.restrainN || 1, y = e.y - e.def.size / 2 - 8;
        g.lineStyle(2.5, 0x78909c, 0.95);
        for (let k = 0; k < n; k++) g.strokeEllipse(e.x - (n - 1) * 6 + k * 12, y, 9, 6);
      }
      if (e.typeId === 'gargoyle' && e.gTell) {
        const pulse = 0.5 + 0.5 * Math.sin(now / 40);
        g.lineStyle(2, 0xff1744, 0.5 + pulse * 0.4); g.strokeCircle(e.x, e.y, e.def.size * 0.75 + pulse * 4);
        g.fillStyle(0xff1744, 0.9); g.fillCircle(e.x - 5, e.y - 4, 3); g.fillCircle(e.x + 5, e.y - 4, 3);
      }
    }
  }
};
