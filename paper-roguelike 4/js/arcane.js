/* arcane.js  (Phase 3a)
   Arcane rework + new gear so every sub class can fill all its slots
   (2 weapons, armor, 2 skills, item). Uses the mechanics in gear3.js.

   ARCANE IS SLOWER now: tier-1 (★) weapons cast slowly but hit harder; higher tiers
   get faster (a few slow, heavy ones stay for variety). Weapon types:
   staff (hold = keep casting), wand (fast sparks), orb (hold = orbs circle you,
   let go = throw them), tome (every cast = the next page / spell).

   Sub classes: MAGE (one big class with 3 build directions: arcane bolts, storm =
   sparks/chains/crits, fire = explosions/burning) and North Wizard
   (+ Necromancer, Druid, Witch in Phase 3b). Mega spells cost more than 100 mana: you need max mana from
   items / sets / buffs to cast them.

   Also here: Knight projectile swords + sword boss bonus, Berserker gear,
   and the missing Knight / Miner / Hunter items. */

/* ---------------- textures ---------------- */
const ArcaneTextures = {
  make(scene) {
    const W = (k, w, h, fn) => TextureFactory.withGraphics(scene, k, w, h, fn);
    W('iceshard', 18, 8, (g) => { g.fillStyle(0xb3e5fc, 1); g.fillTriangle(0, 4, 12, 0, 12, 8); g.fillStyle(0xe1f5fe, 1); g.fillTriangle(12, 0, 18, 4, 12, 8); });
    W('wave', 26, 46, (g) => { g.fillStyle(0x4fc3f7, 0.45); g.fillEllipse(10, 23, 18, 44); g.lineStyle(4, 0x0288d1, 1); g.beginPath(); g.arc(-4, 23, 24, -1.1, 1.1); g.strokePath(); g.lineStyle(2, 0xe1f5fe, 1); g.beginPath(); g.arc(-6, 23, 24, -0.9, 0.9); g.strokePath(); });
    W('ember', 12, 12, (g) => { g.fillStyle(0xff8f00, 0.5); g.fillCircle(6, 6, 6); g.fillStyle(0xffca28, 1); g.fillCircle(6, 6, 3); });
    W('star', 16, 16, (g) => {
      const pts = []; for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 3 : 8; pts.push({ x: 8 + Math.cos(a) * r, y: 8 + Math.sin(a) * r }); }
      g.fillStyle(0xfff176, 1); g.fillPoints(pts, true); g.lineStyle(1, 0xf9a825, 1); g.strokePoints(pts, true);
    });
    W('shadow', 18, 10, (g) => { g.fillStyle(0x4a148c, 0.6); g.fillEllipse(9, 5, 18, 10); g.fillStyle(0xce93d8, 1); g.fillEllipse(11, 5, 8, 4); });
    W('verdant', 36, 16, (g) => { g.fillStyle(0x76ff03, 0.35); g.fillEllipse(18, 8, 36, 16); g.lineStyle(3, 0x33691e, 1); g.beginPath(); g.arc(4, 8, 22, -0.9, 0.9); g.strokePath(); g.lineStyle(2, 0xccff90, 1); g.beginPath(); g.arc(2, 8, 22, -0.7, 0.7); g.strokePath(); });
    W('crane', 18, 14, (g) => { g.fillStyle(0xffffff, 1); g.fillTriangle(0, 7, 18, 2, 10, 7); g.fillTriangle(0, 7, 18, 12, 10, 7); g.lineStyle(1, 0x90a4ae, 1); g.strokeTriangle(0, 7, 18, 2, 10, 7); g.strokeTriangle(0, 7, 18, 12, 10, 7); });
    W('dynamite', 16, 8, (g) => { g.fillStyle(0xc62828, 1); g.fillRect(0, 1, 12, 6); g.fillStyle(0xffca28, 1); g.fillRect(12, 3, 4, 2); });
    W('orbshot', 14, 14, (g) => { g.fillStyle(0x80deea, 0.4); g.fillCircle(7, 7, 7); g.fillStyle(0xe0f7fa, 1); g.fillCircle(7, 7, 4); });
    W('gust', 22, 14, (g) => { g.lineStyle(2, 0xb2ebf2, 1); g.beginPath(); g.arc(4, 7, 9, -1, 1); g.strokePath(); g.beginPath(); g.arc(10, 7, 7, -1, 1); g.strokePath(); });
  }
};

/* ---------------- slower Arcane: the old placeholders, reworked ---------------- */
Object.assign(WEAPON_TYPES.staff, {
  desc: 'Hold to keep casting magic bolts (24).\nSlow but steady. Each bolt costs mana.',
  damage: 24, speed: 520, lifetimeMs: 950, fireDelayMs: 450, manaCost: 7
});
Object.assign(WEAPON_TYPES.wand, {
  desc: 'Hold to fire sparks (12), a bit random.\nCheap on mana.',
  damage: 12, speed: 620, lifetimeMs: 650, fireDelayMs: 260, manaCost: 3, spreadDeg: 7
});
Object.assign(SKILL_TYPES.fireball, {
  desc: 'Slow fireball that explodes for 30\nin an area and sets enemies on fire.',
  kind: 'shot', shot: { damage: 30, speed: 420, lifetimeMs: 1300, texture: 'fireball', aoe: 80, ignite: { ms: 3000, tick: 4 } }
});
Object.assign(ARMOR_TYPES.mageRobe, {});   // (kept: +30 max mana, arcane costs -25%)

const ARC_VIS = {
  staff: (c, o) => ({ style: 'stick', length: 30, color: c, orb: o, orbSize: 6 }),
  wand: (c, o) => ({ style: 'stick', length: 18, color: c, orb: o, orbSize: 4 }),
  orb: (c, o) => ({ style: 'orb', color: c, glow: o }),
  tome: (c, o) => ({ style: 'tome', color: c, glow: o })
};

Object.assign(WEAPON_TYPES, {
  /* ---- Mage ---- */
  apprenticeTome: {
    name: 'Apprentice Tome', short: 'TOME', kind: 'tome', class: 'arcane', sub: 'Mage', type: 'tome', price: 35,
    desc: 'Hold to cast; every cast turns the page:\nbolt (18) → bolt (18) → 3 sparks (12).',
    fireDelayMs: 520, manaCost: 6,
    pages: [
      { damage: 18, speed: 520, lifetimeMs: 900, texture: 'magic' },
      { damage: 18, speed: 520, lifetimeMs: 900, texture: 'magic' },
      { damage: 12, speed: 560, lifetimeMs: 700, texture: 'spark', count: 3, spreadDeg: 30 }
    ],
    visual: ARC_VIS.tome(0x5d4037, 0xb39ddb)
  },
  runedStaff: {
    name: 'Runed Staff', short: 'RUNE', kind: 'projectile', class: 'arcane', sub: 'Mage', type: 'staff', price: 85, postBoss: POST_BOSS_1,
    desc: 'Hold to cast runes (30) that pierce\n1 enemy. Faster than the Mage Staff.',
    damage: 30, speed: 600, lifetimeMs: 950, fireDelayMs: 340, manaCost: 7, texture: 'magic', pierce: 1,
    visual: ARC_VIS.staff(0x4e342e, 0x7e57c2)
  },
  crystalOrb: {
    name: 'Crystal Orb', short: 'CRYS', kind: 'orbit', class: 'arcane', sub: 'Mage', type: 'orb', price: 90, postBoss: POST_BOSS_1,
    desc: 'Hold: 3 crystal orbs circle you (18 per\ntouch, drains mana). Let go after 0.4 s:\nthey fly at your aim (26, homing).',
    orbs: 3, radius: 60, orbSize: 9, orbDamage: 18, hitCdMs: 450, spinSpeed: 3.4, manaPerSec: 14,
    releaseAfterMs: 400, releaseCdMs: 500,
    release: { damage: 26, speed: 520, lifetimeMs: 1100, texture: 'orbshot', spreadDeg: 24, homing: 4 },
    visual: ARC_VIS.orb(0x80deea, 0xe0f7fa)
  },
  archmageStaff: {
    name: 'Archmage Staff', short: 'ARCH', kind: 'projectile', class: 'arcane', sub: 'Mage', type: 'staff', price: 135, postBoss: POST_BOSS_2,
    desc: 'Hold to cast fast bolts (34) that\npierce 2 enemies.',
    damage: 34, speed: 680, lifetimeMs: 950, fireDelayMs: 210, manaCost: 6, texture: 'magic', pierce: 2,
    visual: ARC_VIS.staff(0x37474f, 0xffd54f)
  },
  meteorStaff: {
    name: 'Meteor Staff', short: 'METR', kind: 'projectile', class: 'arcane', sub: 'Mage', type: 'staff', price: 130, postBoss: POST_BOSS_2,
    desc: 'Very slow, very heavy: a meteor (70)\nthat explodes in a big area.',
    damage: 70, speed: 380, lifetimeMs: 1500, fireDelayMs: 900, manaCost: 16, texture: 'fireball', aoe: 90,
    visual: ARC_VIS.staff(0x3e2723, 0xff7043)
  },
  starGrimoire: {
    name: 'Grimoire of Stars', short: 'GRIM', kind: 'tome', class: 'arcane', sub: 'Mage', type: 'tome', price: 140, postBoss: POST_BOSS_2,
    desc: 'Fast pages: star (36, pierce 1) → 5 stars\n(22 each) → star nova around you (40).\nWhile held: +20 max mana.',
    fireDelayMs: 260, manaCost: 8, mods: { maxMana: 20 },
    pages: [
      { damage: 36, speed: 700, lifetimeMs: 900, texture: 'star', pierce: 1 },
      { damage: 22, speed: 640, lifetimeMs: 800, texture: 'star', count: 5, spreadDeg: 50 },
      { type: 'nova', radius: 120, damage: 40, color: 0xfff176, manaCost: 12, delayMs: 420 }
    ],
    visual: ARC_VIS.tome(0x1a237e, 0xfff176)
  },

  /* ---- Mage · storm build ---- */
  chainWand: {
    name: 'Chain Wand', short: 'CHAN', kind: 'projectile', class: 'arcane', sub: 'Mage', type: 'wand', price: 135, postBoss: POST_BOSS_2,
    desc: 'Hold: fast sparks (16) that jump to\n2 more enemies (70% damage each jump).',
    damage: 16, speed: 760, lifetimeMs: 650, fireDelayMs: 150, manaCost: 4, texture: 'spark', chain: { n: 2, range: 220, dmgMul: 0.7 },
    visual: ARC_VIS.wand(0x263238, 0x40c4ff)
  },

  /* ---- Mage · fire build ---- */
  flameTome: {
    name: 'Flame Tome', short: 'FLAM', kind: 'tome', class: 'arcane', sub: 'Mage', type: 'tome', price: 85, postBoss: POST_BOSS_1,
    desc: 'Pages: fireball (26, area, burn) → 3 embers\n(14, burn) → fire ring around you (30, burn).',
    fireDelayMs: 380, manaCost: 8,
    pages: [
      { damage: 26, speed: 460, lifetimeMs: 1000, texture: 'fireball', aoe: 60, ignite: { ms: 3000, tick: 4 } },
      { damage: 14, speed: 560, lifetimeMs: 700, texture: 'ember', count: 3, spreadDeg: 34, ignite: { ms: 3000, tick: 3 } },
      { type: 'nova', radius: 110, damage: 30, color: 0xff7043, ignite: { ms: 3000, tick: 4 } }
    ],
    visual: ARC_VIS.tome(0xbf360c, 0xffab40)
  },
  phoenixOrb: {
    name: 'Phoenix Orb', short: 'PHNX', kind: 'orbit', class: 'arcane', sub: 'Mage', type: 'orb', price: 135, postBoss: POST_BOSS_2,
    desc: 'Hold: 3 fire orbs circle you (22 + burn).\nLet go: 3 fireballs (34, area, burn).',
    orbs: 3, radius: 64, orbSize: 10, orbDamage: 22, hitCdMs: 350, spinSpeed: 4, manaPerSec: 14, ignite: { ms: 3000, tick: 5 },
    releaseAfterMs: 400, releaseCdMs: 450,
    release: { damage: 34, speed: 560, lifetimeMs: 1000, texture: 'fireball', spreadDeg: 26, aoe: 60, ignite: { ms: 3000, tick: 5 } },
    visual: ARC_VIS.orb(0xff7043, 0xffd180)
  },

  /* ---- North Wizard ---- */
  frostWand: {
    name: 'Frost Wand', short: 'FRST', kind: 'projectile', class: 'arcane', sub: 'North Wizard', type: 'wand', price: 35,
    desc: 'Hold: ice shards (15) that slow enemies\nby 35% for 1.5 s.',
    damage: 15, speed: 600, lifetimeMs: 750, fireDelayMs: 360, manaCost: 4, texture: 'iceshard', chill: { ms: 1500, pct: 0.35 },
    visual: ARC_VIS.wand(0x546e7a, 0xb3e5fc)
  },
  tideTome: {
    name: 'Tide Tome', short: 'TIDE', kind: 'tome', class: 'arcane', sub: 'North Wizard', type: 'tome', price: 85, postBoss: POST_BOSS_1,
    desc: 'Pages: water bolt (22, push) → a FLOOD\nwave (28, goes through everything, big push)\n→ 3 ice shards (14, slow).',
    fireDelayMs: 420, manaCost: 7,
    pages: [
      { damage: 22, speed: 560, lifetimeMs: 850, texture: 'orbshot', knockback: 260 },
      { damage: 28, speed: 360, lifetimeMs: 1200, texture: 'wave', pierce: 99, knockback: 420, manaCost: 12, delayMs: 560 },
      { damage: 14, speed: 620, lifetimeMs: 750, texture: 'iceshard', count: 3, spreadDeg: 30, chill: { ms: 1500, pct: 0.35 } }
    ],
    visual: ARC_VIS.tome(0x01579b, 0x81d4fa)
  },
  glacierOrb: {
    name: 'Glacier Orb', short: 'GLAC', kind: 'orbit', class: 'arcane', sub: 'North Wizard', type: 'orb', price: 135, postBoss: POST_BOSS_2,
    desc: 'Hold: 3 ice orbs circle you (20 + slow).\nLet go: 3 ice spears (30, pierce 2, slow).',
    orbs: 3, radius: 62, orbSize: 10, orbDamage: 20, hitCdMs: 380, spinSpeed: 3.8, manaPerSec: 13, chill: { ms: 1500, pct: 0.4 },
    releaseAfterMs: 400, releaseCdMs: 450,
    release: { damage: 30, speed: 700, lifetimeMs: 900, texture: 'iceshard', spreadDeg: 22, pierce: 2, chill: { ms: 1800, pct: 0.4 } },
    visual: ARC_VIS.orb(0x81d4fa, 0xe1f5fe)
  },
  galeStaff: {
    name: 'Gale Staff', short: 'GALE', kind: 'projectile', class: 'arcane', sub: 'North Wizard', type: 'staff', price: 130, postBoss: POST_BOSS_2,
    desc: 'Hold: fast gusts (18) that pierce 1\nand push enemies back.',
    damage: 18, speed: 720, lifetimeMs: 700, fireDelayMs: 200, manaCost: 4, texture: 'gust', pierce: 1, knockback: 220,
    visual: ARC_VIS.staff(0x90a4ae, 0xe0f7fa)
  },

  /* ---- Knight: projectile swords (late) ---- */
  starfurySaber: {
    name: 'Starfury Saber', short: 'STAR', kind: 'melee', class: 'melee', sub: 'Knight', type: 'sword', price: 90, postBoss: POST_BOSS_1,
    desc: 'Slashes (38). Every swing also throws a\nhoming star (20). Parry: attack while dashing.',
    damage: 38, range: 92, arcDeg: 130, cooldownMs: 420, knockback: 220, knockbackMs: 100, swingFxMs: 120,
    dashParry: true, parryDamageMul: 2, reflectDamageMul: 1.5, reflectSpeed: 640, bossMul: 1.4,
    projectileEvery: 1, projectile: { damage: 20, speed: 640, lifetimeMs: 900, texture: 'star', pierce: 1, homing: 3 },
    visual: { style: 'blade', length: 32, width: 5, color: 0x90caf9, guard: 0xffd54f, swing: 0xfff59d, glow: 0xfff176 }
  },
  craneBlade: {
    name: 'Paper Crane Blade', short: 'CRNE', kind: 'melee', class: 'melee', sub: 'Knight', type: 'sword', price: 85, postBoss: POST_BOSS_1,
    desc: 'Folded steel (34). Every 2nd swing sends\n2 homing paper cranes (18 each).',
    damage: 34, range: 90, arcDeg: 130, cooldownMs: 400, knockback: 200, knockbackMs: 100, swingFxMs: 120,
    dashParry: true, parryDamageMul: 2, reflectDamageMul: 1.5, reflectSpeed: 640, bossMul: 1.4,
    projectileEvery: 2, projectile: { damage: 18, speed: 520, lifetimeMs: 1300, texture: 'crane', count: 2, spreadDeg: 40, homing: 5 },
    visual: { style: 'blade', length: 30, width: 5, color: 0xeceff1, guard: 0xe57373, swing: 0xffffff }
  },
  verdantBlade: {
    name: 'Verdant Blade', short: 'VERD', kind: 'melee', class: 'melee', sub: 'Knight', type: 'sword', price: 145, postBoss: POST_BOSS_2,
    desc: 'Big slashes (54). EVERY swing fires a green\nbeam (40) that cuts through 4 enemies.',
    damage: 54, range: 100, arcDeg: 140, cooldownMs: 430, knockback: 280, knockbackMs: 120, swingFxMs: 140,
    dashParry: true, parryDamageMul: 2, reflectDamageMul: 1.6, reflectSpeed: 680, bossMul: 1.5,
    projectileEvery: 1, projectile: { damage: 40, speed: 760, lifetimeMs: 700, texture: 'verdant', pierce: 4 },
    visual: { style: 'blade', length: 36, width: 7, color: 0x76ff03, guard: 0x33691e, swing: 0xccff90, glow: 0x76ff03 }
  },
  duskEdge: {
    name: 'Dusk Edge', short: 'DUSK', kind: 'melee', class: 'melee', sub: 'Knight', type: 'sword', price: 140, postBoss: POST_BOSS_2,
    desc: 'Dark slashes (50). Every swing scatters\n3 shadow shards (18 each, pierce 1).',
    damage: 50, range: 96, arcDeg: 140, cooldownMs: 410, knockback: 240, knockbackMs: 110, swingFxMs: 130,
    dashParry: true, parryDamageMul: 2, reflectDamageMul: 1.6, reflectSpeed: 680, bossMul: 1.5,
    projectileEvery: 1, projectile: { damage: 18, speed: 600, lifetimeMs: 600, texture: 'shadow', count: 3, spreadDeg: 30, pierce: 1 },
    visual: { style: 'blade', length: 34, width: 6, color: 0x7e57c2, guard: 0x212121, swing: 0xce93d8, glow: 0x4a148c }
  },

  /* ---- Berserker (axes) ---- */
  battleAxe: {
    name: 'Battle Axe', short: 'BAXE', kind: 'melee', class: 'melee', sub: 'Berserker', type: 'greataxe', price: 35,
    desc: 'Heavy chops (34). The lower your HP,\nthe harder it hits (up to +80%).',
    damage: 34, range: 88, arcDeg: 140, cooldownMs: 620, knockback: 300, knockbackMs: 130, swingFxMs: 150, rage: 0.8, bossMul: 1.3,
    visual: { style: 'pick', length: 26, color: 0x5d4037, head: 0xb0bec5 }
  },
  bloodletter: {
    name: 'Bloodletter', short: 'BLOD', kind: 'melee', class: 'melee', sub: 'Berserker', type: 'greataxe', price: 90, postBoss: POST_BOSS_1,
    desc: 'Chops (46), up to +100% at low HP.\nWhile held: 4% of your damage heals you.',
    damage: 46, range: 92, arcDeg: 140, cooldownMs: 600, knockback: 300, knockbackMs: 130, swingFxMs: 150, rage: 1.0, bossMul: 1.35,
    mods: { lifeSteal: 0.04 },
    visual: { style: 'pick', length: 28, color: 0x3e2723, head: 0xc62828 }
  },
  ragnarok: {
    name: 'Ragnarok', short: 'RAGN', kind: 'melee', class: 'melee', sub: 'Berserker', type: 'greataxe', price: 140, postBoss: POST_BOSS_2,
    desc: 'Huge chops (66), up to +100% at low HP.\nEvery 3rd in a row: earth-splitting\nslam (150, all around you, stun 1 s).',
    damage: 66, range: 98, arcDeg: 150, cooldownMs: 680, knockback: 340, knockbackMs: 140, swingFxMs: 160, rage: 1.0, bossMul: 1.4,
    heavyEvery: 3, comboResetMs: 1300,
    heavy: { damage: 150, rangeMul: 1.25, arcDeg: 360, knockback: 600, knockbackMs: 210, stunMs: 1000 },
    visual: { style: 'pick', length: 32, color: 0x212121, head: 0xff6f00 }
  }
});
// Swords hit bosses harder than other melee (melee default is +25%)
const SWORD_BOSS = { sword: 1.35, longsword: 1.4, dragonsteel: 1.5, enchantedSword: 1.4, sunsteel: 1.6, executioner: 1.5, flamberge: 1.4 };
for (const id in SWORD_BOSS) if (WEAPON_TYPES[id]) WEAPON_TYPES[id].bossMul = SWORD_BOSS[id];

/* ---------------- armor ---------------- */
Object.assign(ARMOR_TYPES, {
  archmageMantle: {
    name: 'Archmage Mantle', short: 'MNTL', class: 'arcane', sub: 'Mage', price: 130, postBoss: POST_BOSS_2,
    desc: '+50 max mana, +30% mana regen,\ndefense 6%.', mods: { maxMana: 50, manaRegenMul: 0.30, defense: 0.06 }
  },
  stormSash: {
    name: 'Storm Sash', short: 'SASH', class: 'arcane', sub: 'Mage', price: 85, postBoss: POST_BOSS_1,
    desc: 'Storm build: +12% attack speed, 5% crit,\nchain sparks jump to 1 more enemy.\nDefense 4%.', mods: { attackSpeedMul: 0.12, critChance: 0.05, chainBonus: 1, defense: 0.04 }
  },
  ashenRobe: {
    name: 'Ashen Robe', short: 'ASHN', class: 'arcane', sub: 'Mage', price: 85, postBoss: POST_BOSS_1,
    desc: 'Fire build: burning hurts 40% more and\nlasts 30% longer. +15 max mana, defense 6%.', mods: { maxMana: 15, defense: 0.06, burnDamage: 0.4, burnTime: 0.3 }
  },
  snowCoat: {
    name: 'Snow Coat', short: 'SNOW', class: 'arcane', sub: 'North Wizard', price: 35,
    desc: '+20 max mana, defense 8%.', mods: { maxMana: 20, defense: 0.08 }
  },
  noellesCloak: {
    name: "Noelle's Cloak", short: 'NOEL', class: 'arcane', sub: 'North Wizard', price: 110, postBoss: POST_BOSS_1,
    desc: '+70 max mana (enough for Snowgrave),\ndefense 8%. North Wizard spells and\nweapons cost 20% less mana.',
    mods: { maxMana: 70, defense: 0.08 }, classMods: [{ sub: 'North Wizard', mods: { manaCostMul: -0.20 } }]
  },
  berserkerHide: {
    name: 'Berserker Hide', short: 'HIDE', class: 'melee', sub: 'Berserker', price: 35,
    desc: '+15 max HP, defense 4%.\n3% of your damage heals you.', mods: { maxHp: 15, defense: 0.04, lifeSteal: 0.03 }
  }
});

/* ---------------- skills ---------------- */
Object.assign(SKILL_TYPES, {
  /* Mage */
  arcaneBarrier: {
    name: 'Arcane Barrier', short: 'BARR', kind: 'barrier', class: 'arcane', sub: 'Mage', price: 35,
    desc: 'A shield of magic absorbs the next 40\ndamage (lasts 5 s).', manaCost: 30, cooldownMs: 9000, absorb: 40, durationMs: 5000
  },
  blink: {
    name: 'Blink', short: 'BLNK', kind: 'blink', class: 'arcane', sub: 'Mage', price: 80, postBoss: POST_BOSS_1,
    desc: 'Teleport up to 200 px toward your aim\n(not through walls). Arriving zaps\nenemies around you (20).',
    manaCost: 25, cooldownMs: 4500, distance: 200, radius: 70, damage: 20, color: 0xb39ddb, invulnMs: 300
  },
  starfall: {
    name: 'Starfall', short: 'STRF', kind: 'storm', mega: true, megaColor: 0xfff176, class: 'arcane', sub: 'Mage', price: 140, postBoss: POST_BOSS_2,
    desc: 'MEGA SPELL (130 mana: needs more than the\nbase 100). For 3 s, stars rain on random\nenemies: 18 strikes, 45 each.',
    manaCost: 130, cooldownMs: 20000,
    zone: { durationMs: 3000, everyMs: 160, radius: 55, damage: 45, color: 0xfff176 }
  },
  /* Mage · storm */
  sparkNova: {
    name: 'Spark Nova', short: 'NOVA', kind: 'shot', class: 'arcane', sub: 'Mage', price: 35,
    desc: 'A ring of 12 sparks (14 each) bursts\nout from you.', manaCost: 25, cooldownMs: 5000,
    shot: { damage: 14, speed: 560, lifetimeMs: 600, texture: 'spark', count: 12, spreadDeg: 330 }
  },
  thunderstorm: {
    name: 'Thunderstorm', short: 'THDR', kind: 'storm', mega: true, megaColor: 0x40c4ff, class: 'arcane', sub: 'Mage', price: 140, postBoss: POST_BOSS_2,
    desc: 'MEGA SPELL (130 mana). For 3 s lightning\nhits random enemies: 12 strikes, 60 each,\nshort stun.',
    manaCost: 130, cooldownMs: 20000,
    zone: { durationMs: 3000, everyMs: 240, radius: 50, damage: 60, stunMs: 400, color: 0x40c4ff, bolt: true }
  },
  /* Mage · fire */
  firePillar: {
    name: 'Fire Pillar', short: 'PLLR', kind: 'zone', class: 'arcane', sub: 'Mage', price: 80, postBoss: POST_BOSS_1,
    desc: 'A pillar of fire where you aim for 3 s:\n12 damage every 0.4 s + burn.', manaCost: 30, cooldownMs: 8000, atAim: 220,
    zone: { durationMs: 3000, tickMs: 400, radius: 70, damage: 12, ignite: { ms: 2500, tick: 4 }, color: 0xff7043 }
  },
  inferno: {
    name: 'Inferno', short: 'INFR', kind: 'burst', mega: true, megaColor: 0xff6d00, class: 'arcane', sub: 'Mage', price: 140, postBoss: POST_BOSS_2,
    desc: 'MEGA SPELL (140 mana). Explode in a huge\nfire blast around you: 90 damage, burning\n5 s, big knockback.',
    manaCost: 140, cooldownMs: 20000, radius: 360, damage: 90, ignite: { ms: 5000, tick: 8 }, knockback: 340, color: 0xff6d00, fxMs: 500
  },
  /* North Wizard */
  flood: {
    name: 'Flood', short: 'FLOD', kind: 'shot', class: 'arcane', sub: 'North Wizard', price: 35,
    desc: 'A wide wave (26) that goes through\neverything and washes enemies away.', manaCost: 25, cooldownMs: 5000,
    shot: { damage: 26, speed: 340, lifetimeMs: 1400, texture: 'wave', count: 3, spreadDeg: 16, pierce: 99, knockback: 460 }
  },
  hurricane: {
    name: 'Hurricane', short: 'HURR', kind: 'zone', class: 'arcane', sub: 'North Wizard', price: 85, postBoss: POST_BOSS_1,
    desc: 'A whirlwind where you aim for 3.5 s:\npulls enemies in (not bosses) and hits\nthem (8 every 0.35 s).', manaCost: 35, cooldownMs: 10000, atAim: 240,
    zone: { durationMs: 3500, tickMs: 350, radius: 90, damage: 8, pull: 170, pullRadius: 240, color: 0x80deea }
  },
  snowgrave: {
    name: 'Snowgrave', short: 'SNWG', kind: 'freezeAll', mega: true, megaColor: 0xe1f5fe, class: 'arcane', sub: 'North Wizard', price: 150, postBoss: POST_BOSS_2,
    desc: 'MEGA SPELL (150 mana). Everything on\nscreen freezes, then shatters 1.4 s later:\n80 + 35% of its max HP (bosses: 160, short\nfreeze).',
    manaCost: 150, cooldownMs: 26000, freezeMs: 1600, bossFreezeMs: 900, shatterDelayMs: 1400, shatterDamage: 80, shatterPct: 0.35, bossMul: 2
  },
  /* Berserker / Hunter / Miner fills */
  warCry: {
    name: 'War Cry', short: 'CRY!', kind: 'effect', class: 'melee', sub: 'Berserker', price: 80, postBoss: POST_BOSS_1,
    desc: 'For 6 s: +30% attack speed, +20% damage.', manaCost: 25, cooldownMs: 14000, effect: 'warCry'
  },
  huntersNet: {
    name: "Hunter's Net", short: 'NET', kind: 'burst', class: 'precision', sub: 'Hunter', price: 40,
    desc: 'Throw a net where you aim: everything\ninside is held in place for 2 s\n(bosses: a moment) and slowed after.',
    manaCost: 25, cooldownMs: 9000, atAim: 220, radius: 75, damage: 6, stunMs: 2000, chill: { ms: 2500, pct: 0.4 }, color: 0xa1887f
  },
  dynamite: {
    name: 'Dynamite', short: 'TNT', kind: 'shot', class: 'melee', sub: 'Miner', price: 40, blueprint: 'gnome',
    desc: 'Throw a stick of dynamite: explodes for\n45 in an area.', manaCost: 25, cooldownMs: 6000,
    shot: { damage: 45, speed: 380, lifetimeMs: 650, texture: 'dynamite', aoe: 85 }
  }
});

/* ---------------- items (consumables) + their effects ---------------- */
Object.assign(EFFECT_TYPES, {
  focusCrystal: { name: 'Focus', durationMs: 60000, classMods: [{ class: 'arcane', mods: { damageMul: 0.15, manaCostMul: -0.15 } }] },
  lampOil: { name: 'Lamp Oil', durationMs: 60000, mods: { burnDamage: 0.5, burnTime: 0.5 } },
  hotCocoa: { name: 'Hot Cocoa', durationMs: 60000, mods: { manaRegenMul: 0.40 }, classMods: [{ class: 'arcane', mods: { damageMul: 0.10 } }] },
  warCry: { name: 'War Cry', durationMs: 6000, mods: { attackSpeedMul: 0.30, damageMul: 0.20 } },
  holyOil: { name: 'Holy Oil', durationMs: 60000, mods: { bossDamage: 0.30, defense: 0.05 } },
  grog: { name: 'Grog', durationMs: 60000, mods: { defense: -0.08 }, classMods: [{ class: 'melee', mods: { damageMul: 0.15 } }] },
  minersLunch: { name: "Miner's Lunch", durationMs: 60000, mods: { moveSpeedMul: 0.10 }, classMods: [{ sub: 'Miner', mods: { damageMul: 0.15 } }] }
});
const EFFECT_ITEM = (name, short, price, cls, sub, effect, desc, extra) =>
  Object.assign({ name: name, short: short, price: price, amount: 1, kind: 'effect', effect: effect, class: cls, sub: sub, desc: desc }, extra || {});
Object.assign(CONSUMABLE_TYPES, {
  focusCrystal: EFFECT_ITEM('Focus Crystal', 'FOCS', 15, 'arcane', 'Mage', 'focusCrystal', '60 s: Arcane +15% damage\nand -15% mana cost.'),
  lampOil: EFFECT_ITEM('Lamp Oil', 'OIL', 14, 'arcane', 'Mage', 'lampOil', '60 s: burning hurts 50% more\nand lasts 50% longer.'),
  hotCocoa: EFFECT_ITEM('Hot Cocoa', 'COCO', 14, 'arcane', 'North Wizard', 'hotCocoa', '60 s: +40% mana regen,\nArcane +10% damage.'),
  holyOil: EFFECT_ITEM('Holy Oil', 'HOLY', 16, 'melee', 'Knight', 'holyOil', '60 s: +30% damage to bosses\nand champions, +5% defense.'),
  grog: EFFECT_ITEM('Grog', 'GROG', 12, 'melee', 'Berserker', 'grog', '60 s: Melee +15% damage,\nbut -8% defense.'),
  minersLunch: EFFECT_ITEM("Miner's Lunch", 'LNCH', 12, 'melee', 'Miner', 'minersLunch', '60 s: +10% speed,\nMiner weapons +15% damage.', { blueprint: 'gnome' })
});
