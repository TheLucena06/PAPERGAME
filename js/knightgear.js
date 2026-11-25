/* knightgear.js  (v3.4, owner's designs)
   - Arrow Volley ("Salva de flechas"): ★★★ Archer skill. A wide piercing volley where you aim. Copies the held bow's
     special effect at a smaller scale. Without a bow (or crossbow) it does much less damage.
   - Brigade Armor: ★★★ Knight armor. Your hits can RESTRAIN enemies (slower, take more damage; stacks).
   - Buckler (Knight shield) rework: raising it gives a 15 HP guard that soaks hits. Broken = 4 s before it comes
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
  desc: 'A wide volley of 15 arrows where you aim\n(40% of your bow\'s full shot each, min 30;\npierce 3). Copies your bow\'s effect,\nsmaller. No bow held: only 35% damage.',
  manaCost: 70, cooldownMs: 9000,
  count: 15, spreadDeg: 64, bowMul: 0.4, minDamage: 30, noBowMul: 0.35, pierce: 3,
  speed: [820, 1000], lifetimeMs: 950
};

ARMOR_TYPES.brigadeArmor = {
  name: 'Brigade Armor', short: 'BRGD', class: 'melee', sub: 'Knight', price: 140, postBoss: POST_BOSS_2,
  desc: '+25 max HP, defense 26%.\nEvery hit you deal: 15% chance to\nRESTRAIN the enemy for 4 s (stacks 3x):\n-15% speed, +10% damage taken each.',
  mods: { maxHp: 25, defense: 0.26, restrainChance: 0.15 }
};

Object.assign(WEAPON_TYPES.buckler, {
  desc: 'Hold attack to raise: blocks 40% from\nthe front + a 15 HP guard that soaks hits\n(broken: back after 4 s). Raise right before\na hit to parry (stun 2 s). Dash INTO an\nattack with it up: 80% of the damage goes\nback, knockback + stun 0.9 s.',
  guard: { hp: 15, breakCdMs: 4000, regenDelayMs: 1500, regenPerSec: 6 },
  reflect: { pct: 0.8, knockback: 420, knockbackMs: 180, stunMs: 900 }
});

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
  const count = d.count + (bow && wd.fullFan ? 4 : 0);                     // Composite Bow: a wider volley
  const mana = bow && wd.manaArrow ? wd.manaArrow : null;                  // Mana Bow: every 3rd arrow pops (small)
  const love = bow && wd.love ? { charge: (wd.love.charge || 0.3) * 0.35, chance: wd.love.chance ? wd.love.chance * 0.35 : 0 } : null;
  const tex = bow ? (wd.texture || 'arrow') : 'arrow';
  const base = Math.atan2(p.input.aimY, p.input.aimX), step = d.spreadDeg / (count - 1) * Math.PI / 180;
  for (let i = 0; i < count; i++) {
    const a = base - (d.spreadDeg / 2) * Math.PI / 180 + i * step + (Math.random() - 0.5) * 0.03;
    const spd = d.speed[0] + Math.random() * (d.speed[1] - d.speed[0]);
    const b = WeaponSystem.fireArrow(p, ctx, Math.cos(a), Math.sin(a), spd, dmg, d.lifetimeMs, tex, pierce, homing, null, true);
    if (!b) continue;
    b.love = love;
    if (mana && i % 3 === 1) b.aoeRadius = Math.round(mana.radius * 0.5);
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
    // dashing into an attack with the Buckler up: remember it; knightHitCheck sends it back to the attacker
    if (d && d.reflect && this.alive && this.isDashing() && this.input && this.input.attack) {
      if (!this.shieldReflect || amount > this.shieldReflect.amount) this.shieldReflect = { amount: amount, x: srcX, y: srcY };
      return 'none';
    }
    // Buckler raised: the guard soaks damage first (it rides on the barrier, which takeHit already uses)
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

  // From onPlayerHit: the Buckler dash reflect.
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
      if (p.guardHp === undefined) p.guardHp = WEAPON_TYPES.buckler.guard.hp;
      const G = WEAPON_TYPES.buckler.guard;
      if (playing) {
        if (p.guardCdMs > 0) { p.guardCdMs -= dt; if (p.guardCdMs <= 0) { p.guardHp = G.hp; p.guardCdMs = 0; } }
        else if (p.guardHp < G.hp) {
          p.guardIdleMs = (p.guardIdleMs || 0) + dt;
          if (p.guardIdleMs > G.regenDelayMs) p.guardHp = Math.min(G.hp, p.guardHp + G.regenPerSec * dt / 1000);
        }
      }
      // guard bar under the player while the Buckler is in hand
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
