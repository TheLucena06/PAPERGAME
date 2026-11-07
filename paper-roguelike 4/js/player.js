/* player.js
   PLAYER_BASE_STATS (data) + Player class.
   A Player has a loadout (2 weapons, armor, 2 skills, consumable), passive
   buffs, hp, mana, dash and a sprite. this.stats = final stats (base +
   equipment), rebuilt by recalcStats() when equipment changes.
   It never reads input devices: the scene fills player.input each frame. */

const PLAYER_BASE_STATS = {
  maxHp: 100,
  moveSpeed: 220,          // pixels per second
  size: 26,                // square side in pixels
  color: 0x4f8fc0,
  invulnMs: 700,           // invulnerability after being hit

  maxMana: 100,
  manaRegen: 6,            // per second, always
  manaRegenFast: 20,       // per second, after not spending for a while
  manaRegenDelayMs: 1000,

  dashSpeed: 650,
  dashMs: 160,             // invulnerable while dashing
  dashCooldownMs: 800,
  dashParryExtraMs: 150,   // melee parry still works this long after a dash ends
  consumableCooldownMs: 400
};

class Player {
  constructor(scene, id, x, y, controller, weaponId) {
    this.id = id;
    this.controller = controller;

    // Loadout
    this.weapons = [weaponId, null];
    this.weaponStates = [WeaponSystem.createState(weaponId), null];
    this.activeWeapon = 0;
    this.weapon = this.weaponStates[0];
    this.armor = null;
    this.skills = [null, null];
    this.skillCdMs = [0, 0];
    this.skillCdTotal = [1, 1];
    this.consumableId = null;  // the item stack in the F slot (it is NOT also in the shared inventory)
    this.consumableCount = 0;
    this.buffs = [];
    this.effects = [];         // timed effects: { id, ms } (see EFFECT_TYPES)

    this.stats = null;
    this.recalcStats();
    this.hp = this.stats.maxHp;
    this.mana = this.stats.maxMana;

    this.manaIdleMs = 0;
    this.alive = true;
    this.kills = 0;
    this.invulnMs = 0;
    this.dashMs = 0;
    this.dashCdMs = 0;
    this.dashParryMs = 0;
    this.dashX = 1; this.dashY = 0;
    this.consumableCdMs = 0;
    this.barrierHp = 0; this.barrierMs = 0;
    this.spinFxMs = 0; this.spinRange = 0;
    this.skillDash = null;     // active dash skill (Lunge, Kaan Sai)
    this.flurry = null;        // active Onslaught flurry
    this.burrow = null;        // active Burrow skill { def, ms }
    this.flurryFxMs = 0; this.flurryAngle = 0; this.flurryRange = 0; this.flurryArc = 0; this.flurryLast = false;
    this.dashTrailMs = 0;
    this.pullX = 0; this.pullY = 0;   // pushed by enemies (Gale whirlwind), used once per frame
    this.extraSlow = 0;               // 0..0.8, set by enemies each frame (leeches), used once per frame
    this.rootMs = 0;
    this.burnMs = 0; this.burnTickMs = 0; this.burnTick = 0;
    this.stillMs = 0;                 // how long the player has been standing still (Camo Cloak)
    this.shotQueue = [];              // extra arrows fired one after another (Extra Loaded, crossbows)
    for (let i = 0; i < 12; i++) this.shotQueue.push({ active: false, ms: 0, dirX: 0, dirY: 0, speed: 0, damage: 0, life: 0, tex: '', pierce: 0, homing: 0, flags: null, aoe: 0 });

    // Filled by the scene's input step every frame.
    this.input = { moveX: 0, moveY: 0, aimX: 1, aimY: 0, attack: false, attackPressed: false, dash: false,
                   swap: false, skill1: false, skill2: false, consumable: false };

    this.sprite = scene.physics.add.image(x, y, 'player_' + id);
    this.sprite.setDepth(10); // walls keep the player in (doors are gaps)
    this.sprite.player = this; // lets collision callbacks find the Player
  }

  // ---- Equipment ----
  recalcStats() {
    const old = this.stats;
    this.stats = Stats.build(this);
    if (old) {
      if (this.stats.maxHp > old.maxHp) this.hp += this.stats.maxHp - old.maxHp;
      if (this.stats.maxMana > old.maxMana) this.mana += this.stats.maxMana - old.maxMana;
      this.hp = Math.min(this.hp, this.stats.maxHp);
      this.mana = Math.min(this.mana, this.stats.maxMana);
    }
  }

  setWeapon(slot, weaponId) {
    this.weapons[slot] = weaponId;
    this.weaponStates[slot] = weaponId ? WeaponSystem.createState(weaponId) : null;
    if (!this.weaponStates[this.activeWeapon]) this.activeWeapon = this.weaponStates[0] ? 0 : 1;
    this.weapon = this.weaponStates[this.activeWeapon];
    this.recalcStats();
  }

  swapWeapon() {
    const other = 1 - this.activeWeapon;
    if (!this.weaponStates[other]) return false;
    WeaponSystem.resetTransient(this.weapon);
    this.activeWeapon = other;
    this.weapon = this.weaponStates[other];
    this.recalcStats();
    return true;
  }

  isDashing() {
    return this.dashMs > 0 || (!!this.skillDash && !this.skillDash.vulnerable) || !!this.burrow;
  }

  // Pyre casters: damage over time. Refreshes, doesn't stack.
  // Small damage that ignores hit invulnerability (leeches, curses). Defense still counts.
  dotHit(dmg) {
    if (!this.alive || this.isDashing()) return;
    const d = Math.max(1, Math.round(dmg * (1 - this.stats.defense)));
    this.hp -= d;
    this.flashMs = Math.max(this.flashMs || 0, 60);
    if (this.hp <= 0 && GAME_CONFIG.debug.god) this.hp = 1;
    if (this.hp <= 0) { this.hp = 0; this.die(); }
  }

  applyBurn(ms, tickDamage) {
    this.burnMs = Math.max(this.burnMs, ms);
    this.burnTick = Math.max(this.burnTick, tickDamage);
    if (this.burnTickMs <= 0) this.burnTickMs = 500;
  }

  // Queue an arrow to fire after `ms` (multi-shot, crossbow volleys).
  // aoe (optional): the shot explodes on the first enemy (Mana Bow's mana arrow)
  queueShot(ms, dirX, dirY, speed, damage, life, tex, pierce, homing, flags, aoe) {
    for (let i = 0; i < this.shotQueue.length; i++) {
      const q = this.shotQueue[i];
      if (q.active) continue;
      q.active = true; q.ms = ms; q.dirX = dirX; q.dirY = dirY; q.speed = speed; q.damage = damage;
      q.life = life; q.tex = tex; q.pierce = pierce; q.homing = homing; q.flags = flags; q.aoe = aoe || 0;
      return true;
    }
    return false;
  }

  // Timed effects (Sharpening Stone, Mana Candle, Amulet Rush). Re-using one refreshes it.
  addEffect(id) {
    const def = EFFECT_TYPES[id];
    if (!def) return;
    for (let i = 0; i < this.effects.length; i++) {
      if (this.effects[i].id === id) { this.effects[i].ms = def.durationMs; return; }
    }
    this.effects.push({ id: id, ms: def.durationMs });
    this.recalcStats();
  }

  hasEffect(id) {
    for (let i = 0; i < this.effects.length; i++) if (this.effects[i].id === id) return true;
    return false;
  }

  // ---- LOGIC (uses delta time in ms) ----
  update(dt, ctx) {
    if (!this.alive) return;
    const s = this.stats;
    const inp = this.input;

    // Mana: always regenerates, faster after a pause in spending
    if (this.manaIdleMs < s.manaRegenDelayMs) this.manaIdleMs += dt;
    const regen = (this.manaIdleMs >= s.manaRegenDelayMs ? s.manaRegenFast : s.manaRegen) * s.manaRegenMul;
    this.mana = Math.min(s.maxMana, this.mana + regen * dt / 1000);

    // Timers
    if (this.skillCdMs[0] > 0) this.skillCdMs[0] -= dt;
    if (this.skillCdMs[1] > 0) this.skillCdMs[1] -= dt;
    if (this.consumableCdMs > 0) this.consumableCdMs -= dt;
    if (this.invulnMs > 0) this.invulnMs -= dt;
    if (this.dashParryMs > 0) this.dashParryMs -= dt;
    if (this.reflectMs > 0) this.reflectMs -= dt;
    if (this.spinFxMs > 0) this.spinFxMs -= dt;
    if (this.barrierMs > 0) { this.barrierMs -= dt; if (this.barrierMs <= 0) this.barrierHp = 0; }
    if (this.dashTrailMs > 0) this.dashTrailMs -= dt;
    if (this.flurryFxMs > 0) this.flurryFxMs -= dt;
    if (inp.moveX === 0 && inp.moveY === 0) this.stillMs += dt; else this.stillMs = 0;
    if (this.rootMs > 0) this.rootMs -= dt;
    if (this.burnMs > 0) {
      this.burnMs -= dt;
      this.burnTickMs -= dt;
      if (this.burnTickMs <= 0) {
        this.burnTickMs += 500;
        const dmg = Math.max(1, Math.round(this.burnTick * (1 - this.stats.defense)));
        this.hp -= dmg;
        if (this.hp <= 0 && GAME_CONFIG.debug.god) this.hp = 1;
        if (this.hp <= 0) { this.hp = 0; this.die(); return; }
      }
      if (this.burnMs <= 0) { this.burnTick = 0; this.burnTickMs = 0; }
    }
    // queued arrows
    for (let i = 0; i < this.shotQueue.length; i++) {
      const q = this.shotQueue[i];
      if (!q.active) continue;
      q.ms -= dt;
      if (q.ms > 0) continue;
      q.active = false;
      const b = WeaponSystem.fireArrow(this, ctx, q.dirX, q.dirY, q.speed, q.damage, q.life, q.tex, q.pierce, q.homing, q.flags, true);
      if (b && q.aoe) b.aoeRadius = q.aoe;
    }
    if (this.effects.length > 0) {
      let expired = false;
      for (let i = this.effects.length - 1; i >= 0; i--) {
        this.effects[i].ms -= dt;
        if (this.effects[i].ms <= 0) { this.effects.splice(i, 1); expired = true; }
      }
      if (expired) this.recalcStats();
    }

    // Dash: in the move direction, or toward the aim if standing still
    if (this.dashCdMs > 0) this.dashCdMs -= dt;
    if (inp.dash && this.dashCdMs <= 0 && !this.skillDash && !this.flurry && !this.burrow) {
      const moving = inp.moveX !== 0 || inp.moveY !== 0;
      this.dashX = moving ? inp.moveX : inp.aimX;
      this.dashY = moving ? inp.moveY : inp.aimY;
      this.dashMs = s.dashMs;
      this.dashCdMs = s.dashCooldownMs;
      this.dashParryMs = s.dashMs + s.dashParryExtraMs;
      this.reflectMs = 450;               // dash-attack window for knocking back the Warden's ball
      if (s.amuletDash > 0) this.addEffect('amuletRush');
    }
    const busy = SkillSystem.updateFlurry(this, dt, ctx);
    if (this.burrow) {
      // underground: free movement, faster
      this.burrow.ms -= dt;
      const bs = s.moveSpeed * this.burrow.def.speedMul;
      this.sprite.setVelocity(inp.moveX * bs, inp.moveY * bs);
      if (this.burrow.ms <= 0) SkillSystem.emerge(this, ctx);
    } else if (busy) {
      // planted: Onslaught flurry
    } else if (SkillSystem.updateDash(this, dt, ctx)) {
      // a dash skill is moving the player
    } else if (this.dashMs > 0) {
      this.dashMs -= dt;
      this.sprite.setVelocity(this.dashX * s.dashSpeed, this.dashY * s.dashSpeed);
    } else {
      const sp = this.rootMs > 0 ? 0 : s.moveSpeed * (1 - Math.min(0.8, this.extraSlow));   // rooted = can't walk (Warden cells)
      this.sprite.setVelocity(inp.moveX * sp + this.pullX, inp.moveY * sp + this.pullY);
    }
    this.pullX = 0; this.pullY = 0; this.extraSlow = 0;

    if (inp.swap) this.swapWeapon();
    if (inp.skill1) SkillSystem.tryUse(this, 0, ctx);
    if (inp.skill2) SkillSystem.tryUse(this, 1, ctx);
    if (inp.consumable && this.consumableCdMs <= 0 && ctx.useConsumable(this)) {
      this.consumableCdMs = s.consumableCooldownMs;
    }

    if (!this.flurry && !this.burrow) WeaponSystem.update(this, dt, ctx);
  }

  // Returns true if the mana was there and got spent.
  spendMana(amount) {
    if (this.mana < amount) return false;
    this.mana -= amount;
    this.manaIdleMs = 0;
    return true;
  }

  // Every hit on a player goes through here. (srcX, srcY) = where the hit
  // comes from (for shields). Returns 'none', 'parry', 'dodge', 'block' or 'hit'.
  takeHit(amount, srcX, srcY) {
    if (!this.alive || this.isDashing()) return 'none';

    const shield = WeaponSystem.checkShield(this, srcX, srcY);
    if (shield === 'parry') {
      this.weapon.parryFxMs = 250;
      this.invulnMs = Math.max(this.invulnMs, 250);
      return 'parry';
    }
    if (this.invulnMs > 0) return 'none';

    let dmg = amount * this.stats.damageTakenMul * (1 - this.stats.defense);
    if (this.stats.dodgeChance > 0 && dmg <= this.stats.maxHp * DODGE_MAX_HIT_PCT && Math.random() < this.stats.dodgeChance) {
      this.invulnMs = 300;
      return 'dodge';
    }
    if (shield === 'block') dmg *= 1 - Math.min(0.9, this.weapon.def.blockPct + this.stats.blockBonus);
    if (this.barrierHp > 0) {
      const absorbed = Math.min(this.barrierHp, dmg);
      this.barrierHp -= absorbed;
      dmg -= absorbed;
    }
    this.invulnMs = this.stats.invulnMs;
    dmg = Math.round(dmg);
    if (dmg > 0) {
      this.hp -= dmg;
      if (this.hp <= 0 && GAME_CONFIG.debug.god) this.hp = 1;
      if (this.hp <= 0) { this.hp = 0; this.die(); }
    }
    return shield === 'block' ? 'block' : 'hit';
  }

  heal(percentOfMax) {
    if (!this.alive) return;
    this.hp = Math.min(this.stats.maxHp, this.hp + Math.round(this.stats.maxHp * percentOfMax / 100));
  }

  die() {
    if (this.erasers > 0) {               // Pencil Case: Eraser. The knockout is erased once per run.
      this.erasers--;
      this.hp = Math.max(1, Math.round(this.stats.maxHp * 0.3));
      this.invulnMs = 1500;
      this.erasedFx = true;
      return;
    }
    this.alive = false;
    this.dashMs = 0;
    this.skillDash = null;
    this.flurry = null;
    this.burrow = null;
    this.burnMs = 0;
    for (let i = 0; i < this.shotQueue.length; i++) this.shotQueue[i].active = false;
    this.sprite.setVelocity(0, 0);
    this.sprite.body.enable = false;
  }

  // Co-op: a knocked-out player comes back (room cleared / boss beaten).
  revive(x, y, hpPct) {
    if (this.alive) return;
    this.alive = true;
    this.hp = Math.max(1, Math.round(this.stats.maxHp * hpPct / 100));
    this.sprite.body.enable = true;
    this.sprite.body.reset(x, y);
    this.sprite.clearTint().setAlpha(1);
    this.invulnMs = 1200;
  }

  // ---- VIEW (visual only, no game rules) ----
  updateView() {
    const spr = this.sprite;
    if (!this.alive) { spr.setAlpha(0.35); spr.setTint(0x888888); return; }
    spr.rotation = Math.atan2(this.input.aimY, this.input.aimX);
    if (this.burrow) { spr.setAlpha(0); return; }      // drawn as moving dirt by the HUD
    if (this.isDashing()) { spr.setAlpha(0.55); spr.setTint(this.skillDash ? 0xffe082 : 0xb3e5fc); return; }
    spr.clearTint();
    const blink = this.invulnMs > 0 && Math.floor(this.invulnMs / 80) % 2 === 0;
    spr.setAlpha(blink ? 0.35 : 1);
  }
}
