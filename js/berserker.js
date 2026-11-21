/* berserker.js
   Berserker additions (Heavy is merged into Berserker: big, slow, hits hard).
   Only the axes (Battle Axe, Bloodletter, Ragnarok) get stronger at low HP.

   - Earthbreaker (★★★ hammer): slow, huge hits; every 3rd hit in a row
     stuns and hits much harder.
   - Earthsplitter (★★★ skill): smash the ground; 4 spiky rocks burst out
     in a line, one after the other. Their damage follows your held melee
     weapon (non-melee weapons: a low flat damage).
   - Thorn Armor (★★): 30% of the hits you take bounce part of the damage
     back to the attacker and push it a little.
   - Brotherhood Armor (★★★): co-op; half of every hit your ally takes is
     taken by you instead, as long as you're above 50% HP.

   RockLineManager is a scene system: BerserkerMixin setupBerserker /
   updateBerserker. Thorns live in GameScene.onPlayerHit, Brotherhood in
   Player.takeHit (patched below). */

WEAPON_TYPES.earthbreaker = {
  name: 'Earthbreaker', short: 'ERTH', kind: 'melee', class: 'melee', sub: 'Berserker', type: 'hammer', price: 145, postBoss: POST_BOSS_2,
  desc: 'A huge hammer: slow, crushing hits (72).\nEvery 3rd hit in a row: a quake blow\n(150, stuns 1.2 s).\nVery heavy: -15% speed while held.',
  mods: { moveSpeedMul: -0.15 },
  damage: 72, range: 92, arcDeg: 130, cooldownMs: 900, knockback: 360, knockbackMs: 150, swingFxMs: 190, bossMul: 1.4,
  heavyEvery: 3, comboResetMs: 1600,
  heavy: { damage: 150, rangeMul: 1.15, arcDeg: 170, knockback: 520, knockbackMs: 190, stunMs: 1200 },
  visual: { style: 'hammer', length: 28, color: 0x4e342e, head: 0x546e7a, band: 0xffb300 }
};

ARMOR_TYPES.thornArmor = {
  name: 'Thorn Armor', short: 'THRN', class: 'melee', sub: 'Berserker', price: 85, postBoss: POST_BOSS_1,
  desc: '+15 max HP, defense 20%.\nHits you take: 30% chance to bounce\nhalf the damage back to the attacker\nand push it away a little.',
  mods: { maxHp: 15, defense: 0.20, thornsChance: 0.30, thornsPct: 0.5 }
};
ARMOR_TYPES.brotherhoodArmor = {
  name: 'Brotherhood Armor', short: 'BROS', class: 'melee', sub: 'Berserker', price: 135, postBoss: POST_BOSS_2,
  desc: '+40 max HP, defense 25%.\nCo-op: you take half of every hit your\nally takes, while you are above 50% HP.',
  mods: { maxHp: 40, defense: 0.25, brotherhood: 1 }
};

SKILL_TYPES.earthsplitter = {
  name: 'Earthsplitter', short: 'SPLT', kind: 'rockLine', class: 'melee', sub: 'Berserker', price: 140, postBoss: POST_BOSS_2,
  desc: 'Smash the ground: 4 spiky rocks burst\nout in a line, one after another.\nEach hits for 90% of your melee\nweapon\'s damage (other weapons: 16).',
  manaCost: 30, cooldownMs: 7000,
  count: 4, gapMs: 140, spacing: 54, firstDist: 52, radius: 36, weaponMul: 0.9, baseDamage: 16,
  stunMs: 450, knockback: 260, knockbackMs: 140, lingerMs: 650
};

Object.assign(STAT_DEFAULTS, { thornsChance: 0, thornsPct: 0, brotherhood: 0 });

SKILL_BEHAVIORS.rockLine = function (p, d, ctx) {
  if (!ctx.scene.rockLines) return false;
  const wd = p.weapon ? p.weapon.def : null;
  const melee = wd && wd.class === 'melee' && wd.damage;
  const dmg = melee ? Math.round(wd.damage * d.weaponMul * p.stats.damageMul) : Math.round(d.baseDamage * p.stats.damageMul);
  ctx.scene.rockLines.add(p, d, p.sprite.x, p.sprite.y, p.input.aimX, p.input.aimY, dmg);
  if (ctx.shake) ctx.shake(120, 0.006);
  ctx.fx(p.sprite.x, p.sprite.y, 30, 0x8d6e63, 220);
  return true;
};

class RockLineManager {
  constructor(scene) {
    this.scene = scene;
    this.lines = [];      // { owner, d, x, y, dx, dy, dmg, ms, next, rocks: [{x,y,age}], stopped }
    this.g = scene.add.graphics().setDepth(9);
  }
  add(owner, d, x, y, dx, dy, dmg) {
    this.lines.push({ owner: owner, d: d, x: x, y: y, dx: dx, dy: dy, dmg: dmg, ms: 0, next: 0, rocks: [], stopped: false, hit: [] });
  }
  clear() { this.lines.length = 0; this.g.clear(); }
  update(dt, ctx) {
    for (let i = this.lines.length - 1; i >= 0; i--) {
      const L = this.lines[i], d = L.d;
      L.ms += dt;
      while (!L.stopped && L.next < d.count && L.ms >= L.next * d.gapMs) {
        const dist = d.firstDist + L.next * d.spacing;
        const rx = L.x + L.dx * dist, ry = L.y + L.dy * dist;
        L.next++;
        if (this.scene.rooms.solidAt(rx, ry)) { L.stopped = true; break; }   // the line stops at walls
        L.rocks.push({ x: rx, y: ry, age: 0 });
        this.burst(L, rx, ry, ctx);
      }
      for (let k = 0; k < L.rocks.length; k++) L.rocks[k].age += dt;
      const done = (L.stopped || L.next >= d.count) && L.rocks.every((r) => r.age > d.lingerMs);
      if (done) this.lines.splice(i, 1);
    }
  }
  burst(L, x, y, ctx) {
    const d = L.d, list = ctx.enemies.targets();
    for (let k = 0; k < list.length; k++) {
      const e = list[k];
      if (!e.active || e.state === 'bones' || e.state === 'dust' || L.hit.indexOf(e) !== -1) continue;
      const dx = e.x - x, dy = e.y - y, r = d.radius + e.def.size / 2;
      if (dx * dx + dy * dy > r * r) continue;
      L.hit.push(e);                                   // each line hits an enemy once
      ctx.hitEnemy(e, L.dmg, L.dx, L.dy, d.knockback, d.knockbackMs, L.owner, 'aoe');
      if (e.active) ctx.stunEnemy(e, d.stunMs);
    }
    if (this.scene.hud) this.scene.hud.addFx(x, y, d.radius, 0x8d6e63, 200);
    if (this.scene.lighting) this.scene.lighting.lightNear(x, y, d.radius);
  }
  draw() {
    const g = this.g;
    g.clear();
    for (let i = 0; i < this.lines.length; i++) {
      const L = this.lines[i], d = L.d;
      for (let k = 0; k < L.rocks.length; k++) {
        const r = L.rocks[k];
        const grow = Math.min(1, r.age / 90), fade = r.age > d.lingerMs - 200 ? Math.max(0, (d.lingerMs - r.age) / 200) : 1;
        const h = 30 * grow * fade, w = 13;
        if (h <= 0.5) continue;
        if (this.scene.lighting) this.scene.lighting.add(r.x, r.y, 56 * fade);   // the rocks glow a little in dark rooms
        // cracked ground + three jagged spikes
        g.fillStyle(0x3e2723, 0.35 * fade); g.fillEllipse(r.x, r.y + 4, 44, 16);
        g.fillStyle(0x6d4c41, fade);
        g.fillTriangle(r.x - w, r.y + 6, r.x - 3, r.y + 6, r.x - 8, r.y + 6 - h * 0.7);
        g.fillTriangle(r.x + 3, r.y + 6, r.x + w, r.y + 6, r.x + 8, r.y + 6 - h * 0.65);
        g.fillStyle(0x8d6e63, fade);
        g.fillTriangle(r.x - 7, r.y + 6, r.x + 7, r.y + 6, r.x, r.y + 6 - h);
        g.fillStyle(0xbcaaa4, 0.8 * fade); g.fillTriangle(r.x - 2, r.y + 6 - h * 0.45, r.x + 1, r.y + 6 - h * 0.45, r.x, r.y + 6 - h);
      }
    }
  }
}

const BerserkerMixin = {
  setupBerserker() { this.rockLines = new RockLineManager(this); },
  berserkerRoom() { if (this.rockLines) this.rockLines.clear(); },
  updateBerserker(dt) {
    if (!this.rockLines) return;
    if (this.mode === 'play') this.rockLines.update(dt, this.combatContext);
    this.rockLines.draw();
  },
  // Thorn Armor: some hits bounce back
  thornsCheck(p, res, attacker) {
    if (!(p.stats.thornsChance > 0) || (res !== 'hit' && res !== 'block')) return;
    if (!attacker || !attacker.active || !attacker.isEnemy || attacker.state === 'bones') return;
    if (Math.random() >= p.stats.thornsChance) return;
    const dmg = Math.max(3, Math.round((p.lastHitRaw || 0) * p.stats.thornsPct));
    const dx = attacker.x - p.sprite.x, dy = attacker.y - p.sprite.y, len = Math.sqrt(dx * dx + dy * dy) || 1;
    this.hitEnemy(attacker, dmg, dx / len, dy / len, 240, 110, p, 'thorns');
    this.hud.addFx(p.sprite.x, p.sprite.y, 24, 0x7cb342, 180);
  }
};

// Brotherhood Armor: an ally wearing it takes half of your hit (while above 50% HP).
(function () {
  const takeHit = Player.prototype.takeHit;
  Player.prototype.takeHit = function (amount, srcX, srcY) {
    this.lastHitRaw = amount;
    const sc = this.sprite && this.sprite.scene, list = sc && sc.players;
    if (!list || list.length < 2 || !(amount > 0)) return takeHit.call(this, amount, srcX, srcY);
    let bro = null;
    for (let i = 0; i < list.length; i++) {
      const q = list[i];
      if (q !== this && q.alive && q.stats.brotherhood > 0 && q.hp > q.stats.maxHp * 0.5) { bro = q; break; }
    }
    if (!bro || !this.alive || this.isDashing() || this.invulnMs > 0) return takeHit.call(this, amount, srcX, srcY);
    // half of this hit (before your own defense) goes to your brother, never pushing him below 50%
    const room = Math.floor(bro.hp - bro.stats.maxHp * 0.5);
    const share = Math.max(0, Math.min(Math.round(amount / 2), room));
    const res = takeHit.call(this, amount - share, srcX, srcY);
    if (share > 0 && (res === 'hit' || res === 'block')) {
      bro.hp -= Math.max(1, Math.round(share * (1 - bro.stats.defense)));
      if (bro.hp < 1) bro.hp = 1;
      bro.broFxMs = 300;
    }
    return res;
  };
})();
