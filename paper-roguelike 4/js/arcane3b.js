/* arcane3b.js  (Phase 3b)
   - Simple bolt weapons leave the shops once tier 3 (★★★, after boss 2) starts: phaseOut.
   - ★★★ Arcane weapons do something more interesting than plain bolts.
   - Builds are not labelled: items just work together. Elements (fire, ice, shock, wind)
     react with each other on enemies (see GearFx.react in gear3.js).
   - New sub classes: Necromancer (skeleton allies, life drain, 2 mega spells),
     Druid (thorns, roots, healing, bear form), Witch (hexes, poison, potions, broom).
   - Monk: Aura Dragon (mega spell). */

const Arcane3bTextures = {
  make(scene) {
    const W = (k, w, h, fn) => TextureFactory.withGraphics(scene, k, w, h, fn);
    W('bone', 18, 8, (g) => { g.fillStyle(0xeceff1, 1); g.fillRect(3, 3, 12, 2); g.fillCircle(3, 2, 2); g.fillCircle(3, 6, 2); g.fillCircle(15, 2, 2); g.fillCircle(15, 6, 2); });
    W('thorn', 16, 8, (g) => { g.fillStyle(0x558b2f, 1); g.fillTriangle(0, 4, 16, 1, 16, 7); g.fillStyle(0x33691e, 1); g.fillTriangle(4, 4, 9, 0, 9, 4); });
    W('hex', 14, 14, (g) => { g.fillStyle(0x7b1fa2, 0.45); g.fillCircle(7, 7, 7); g.lineStyle(2, 0xe1bee7, 1); g.strokeCircle(7, 7, 4); g.lineBetween(7, 1, 7, 13); });
    W('potion', 14, 16, (g) => { g.fillStyle(0x76ff03, 1); g.fillCircle(7, 10, 6); g.fillStyle(0x8d6e63, 1); g.fillRect(5, 0, 4, 5); g.fillStyle(0xccff90, 1); g.fillCircle(5, 9, 2); });
    W('skeleton', 22, 22, (g) => {
      g.fillStyle(0xeceff1, 1); g.fillCircle(11, 8, 7); g.fillRect(8, 13, 6, 8);
      g.fillStyle(0x263238, 1); g.fillCircle(8, 8, 2); g.fillCircle(14, 8, 2); g.fillRect(9, 12, 4, 1);
      g.lineStyle(2, 0xeceff1, 1); g.lineBetween(4, 15, 18, 15);
    });
    W('dragon_head', 30, 24, (g) => {
      g.fillStyle(0xffb300, 0.35); g.fillEllipse(15, 12, 30, 24);
      g.fillStyle(0xff8f00, 1); g.fillTriangle(30, 12, 6, 2, 6, 22);
      g.fillStyle(0xfff59d, 1); g.fillCircle(17, 8, 2.5); g.fillCircle(17, 16, 2.5);
      g.lineStyle(2, 0xffecb3, 1); g.lineBetween(6, 2, 0, 0); g.lineBetween(6, 22, 0, 24);
    });
    W('dragon_body', 20, 20, (g) => { g.fillStyle(0xffb300, 0.35); g.fillCircle(10, 10, 10); g.fillStyle(0xff8f00, 1); g.fillCircle(10, 10, 6); g.fillStyle(0xffe082, 1); g.fillCircle(10, 10, 3); });
  }
};

/* ---------------- allies ---------------- */
Object.assign(ALLY_TYPES, {
  skeleton: {
    tex: 'skeleton',
    hp: 50, speed: 215, turn: 7, size: 20, segments: 0,
    biteDamage: 12, biteCdMs: 500, biteKnockback: 90,
    lifeMs: 15000, max: 10, seekRange: 560, invulnMs: 300
  },
  auraDragon: {
    tex: 'dragon_head', tailTex: 'dragon_body', scale: 1.3,
    hp: 9999, speed: 330, turn: 6, size: 30, segments: 3, spacing: 14,
    biteDamage: 30, biteCdMs: 300, biteKnockback: 220,
    lifeMs: 12000, max: 1, seekRange: 900, invulnMs: 99999
  }
});

/* ---------------- phase-out + better ★★★ ---------------- */

Object.assign(WEAPON_TYPES.archmageStaff, {
  desc: 'Hold to cast fast bolts (34) that pierce\n2 enemies. Its bolts borrow the magic of\nyour other weapon.',
  borrow: true
});
Object.assign(WEAPON_TYPES.galeStaff, {
  desc: 'Hold: fast gusts (18) that pierce 1\nand push enemies back.',
  wind: true
});
SKILL_TYPES.hurricane.zone.wind = true;
SKILL_TYPES.thunderstorm.zone.shock = true;
// no build labels: items just say what they do
ARMOR_TYPES.stormSash.desc = '+12% attack speed, 5% crit. Chain\nsparks jump to 1 more enemy. Defense 4%.';
ARMOR_TYPES.ashenRobe.desc = 'Burning you cause hurts 40% more and\nlasts 30% longer. +15 max mana, def 6%.';

const ARC3B_VIS = {
  staff: (c, o) => ({ style: 'stick', length: 30, color: c, orb: o, orbSize: 6 }),
  wand: (c, o) => ({ style: 'stick', length: 18, color: c, orb: o, orbSize: 4 }),
  orb: (c, o) => ({ style: 'orb', color: c, glow: o }),
  tome: (c, o) => ({ style: 'tome', color: c, glow: o })
};

Object.assign(WEAPON_TYPES, {
  /* ---- Necromancer ---- */
  graveStaff: {
    name: 'Grave Staff', short: 'GRAV', kind: 'projectile', class: 'arcane', sub: 'Necromancer', type: 'staff', price: 35,
    desc: 'Hold to cast bone shards (20).\nWhile held: enemies you kill have a\n35% chance to rise as your skeleton.',
    damage: 20, speed: 560, lifetimeMs: 900, fireDelayMs: 480, manaCost: 7, texture: 'bone', mods: { raiseChance: 0.35 },
    visual: ARC3B_VIS.staff(0x37474f, 0xeceff1)
  },
  soulLantern: {
    name: 'Soul Lantern', short: 'SOUL', kind: 'orbit', class: 'arcane', sub: 'Necromancer', type: 'orb', price: 85, postBoss: POST_BOSS_1,
    desc: 'Hold: 2 souls circle you (16 per touch).\nLet go: they fly out (24, homing).\nWhile held: 6% of your damage heals you.',
    orbs: 2, radius: 56, orbSize: 10, orbDamage: 16, hitCdMs: 380, spinSpeed: 3.6, manaPerSec: 11, mods: { lifeSteal: 0.06 },
    releaseAfterMs: 400, releaseCdMs: 450,
    release: { damage: 24, speed: 500, lifetimeMs: 1100, texture: 'orbshot', spreadDeg: 20, homing: 5 },
    visual: ARC3B_VIS.orb(0x9575cd, 0xd1c4e9)
  },
  bookOfTheDead: {
    name: 'Book of the Dead', short: 'DEAD', kind: 'tome', class: 'arcane', sub: 'Necromancer', type: 'tome', price: 140, postBoss: POST_BOSS_2,
    desc: 'Pages: bone spear (32, pierce 3) →\nraise a skeleton → cursed nova (24,\nhexes and slows everything around you).',
    fireDelayMs: 340, manaCost: 8,
    pages: [
      { damage: 32, speed: 640, lifetimeMs: 900, texture: 'bone', pierce: 3 },
      { type: 'summon', ally: 'skeleton', manaCost: 14, delayMs: 420 },
      { type: 'nova', radius: 120, damage: 24, color: 0x7b1fa2, hex: { ms: 3000 }, chill: { ms: 1500, pct: 0.3 } }
    ],
    visual: ARC3B_VIS.tome(0x212121, 0xb39ddb)
  },

  /* ---- Druid ---- */
  thornStaff: {
    name: 'Thorn Staff', short: 'THRN', kind: 'projectile', class: 'arcane', sub: 'Druid', type: 'staff', price: 35,
    desc: 'Hold: thorns (16) that pierce 1\nand slow by 20%.',
    damage: 16, speed: 580, lifetimeMs: 800, fireDelayMs: 420, manaCost: 5, texture: 'thorn', pierce: 1, chill: { ms: 1200, pct: 0.2 },
    visual: ARC3B_VIS.staff(0x5d4037, 0x8bc34a)
  },
  brambleOrb: {
    name: 'Bramble Orb', short: 'BRMB', kind: 'orbit', class: 'arcane', sub: 'Druid', type: 'orb', price: 85, postBoss: POST_BOSS_1,
    desc: 'Hold: 3 bramble balls circle you\n(14 + slow). Let go: 3 thorn spears\n(22, pierce 2).',
    orbs: 3, radius: 58, orbSize: 9, orbDamage: 14, hitCdMs: 400, spinSpeed: 3.2, manaPerSec: 11, chill: { ms: 1200, pct: 0.3 },
    releaseAfterMs: 400, releaseCdMs: 450,
    release: { damage: 22, speed: 620, lifetimeMs: 900, texture: 'thorn', spreadDeg: 24, pierce: 2 },
    visual: ARC3B_VIS.orb(0x7cb342, 0xdcedc8)
  },
  wildsTome: {
    name: 'Tome of the Wilds', short: 'WILD', kind: 'tome', class: 'arcane', sub: 'Druid', type: 'tome', price: 135, postBoss: POST_BOSS_2,
    desc: 'Pages: 5 thorns (16, slow) → roots\nwhere you aim (20, hold 0.9 s) →\nbloom: heal 10 and hit around you (20).',
    fireDelayMs: 380, manaCost: 7,
    pages: [
      { damage: 16, speed: 600, lifetimeMs: 750, texture: 'thorn', count: 5, spreadDeg: 50, chill: { ms: 1200, pct: 0.25 } },
      { type: 'point', range: 220, radius: 80, damage: 20, stunMs: 900, color: 0x689f38 },
      { type: 'nova', radius: 100, damage: 20, heal: 10, color: 0x81c784 }
    ],
    visual: ARC3B_VIS.tome(0x33691e, 0xc5e1a5)
  },

  /* ---- Witch ---- */
  hexWand: {
    name: 'Hex Wand', short: 'HEXW', kind: 'projectile', class: 'arcane', sub: 'Witch', type: 'wand', price: 35,
    desc: 'Hold: hex bolts (16). Hexed enemies\ntake 25% more damage from everything\nfor 3 s.',
    damage: 16, speed: 560, lifetimeMs: 800, fireDelayMs: 400, manaCost: 5, texture: 'hex', hex: { ms: 3000 },
    visual: ARC3B_VIS.wand(0x4a148c, 0xce93d8)
  },
  cauldron: {
    name: 'Bubbling Cauldron', short: 'CLDR', kind: 'orbit', class: 'arcane', sub: 'Witch', type: 'orb', price: 90, postBoss: POST_BOSS_1,
    desc: 'Hold: 3 bubbles circle you (14 + poison).\nLet go: 3 potions that splash (28, area,\npoison, hex).',
    orbs: 3, radius: 58, orbSize: 9, orbDamage: 14, hitCdMs: 420, spinSpeed: 3.4, manaPerSec: 12, poison: { ms: 3000, tick: 3 },
    releaseAfterMs: 400, releaseCdMs: 500,
    release: { damage: 28, speed: 460, lifetimeMs: 700, texture: 'potion', spreadDeg: 26, aoe: 70, poison: { ms: 3500, tick: 4 }, hex: { ms: 3000 } },
    visual: ARC3B_VIS.orb(0x76ff03, 0xccff90)
  },
  witchGrimoire: {
    name: "Witch's Grimoire", short: 'WGRM', kind: 'tome', class: 'arcane', sub: 'Witch', type: 'tome', price: 140, postBoss: POST_BOSS_2,
    desc: 'Pages: hex bolt (26) → toxic splash\n(30, area, poison) → curse wave around\nyou (20, hexes + slows everything).',
    fireDelayMs: 330, manaCost: 8,
    pages: [
      { damage: 26, speed: 600, lifetimeMs: 850, texture: 'hex', hex: { ms: 3000 } },
      { damage: 30, speed: 480, lifetimeMs: 700, texture: 'potion', aoe: 80, poison: { ms: 3500, tick: 5 } },
      { type: 'nova', radius: 130, damage: 20, color: 0x8e24aa, hex: { ms: 4000 }, chill: { ms: 1500, pct: 0.3 } }
    ],
    visual: ARC3B_VIS.tome(0x311b92, 0xea80fc)
  }
});

// Plain bolt weapons stop showing up in shops from tier 3 on (ShopLogic.unlocked checks phaseOut).
for (const id of ['staff', 'wand', 'frostWand', 'runedStaff', 'thornStaff']) if (WEAPON_TYPES[id]) WEAPON_TYPES[id].phaseOut = POST_BOSS_2;

/* ---------------- armor ---------------- */
Object.assign(ARMOR_TYPES, {
  gravecloth: {
    name: 'Gravecloth', short: 'GRVC', class: 'arcane', sub: 'Necromancer', price: 35,
    desc: '+15 max HP, defense 5%. Your allies hit\n30% harder; kills have a 10% chance to\nrise as skeletons.', mods: { maxHp: 15, defense: 0.05, allyDamage: 0.30, raiseChance: 0.10 }
  },
  barkArmor: {
    name: 'Bark Armor', short: 'BARK', class: 'arcane', sub: 'Druid', price: 35,
    desc: '+20 max HP, defense 14%.', mods: { maxHp: 20, defense: 0.14 }
  },
  witchHat: {
    name: 'Witch Hat', short: 'HAT', class: 'arcane', sub: 'Witch', price: 35,
    desc: '+15 max mana, defense 5%.\nYour hexes last 50% longer.', mods: { maxMana: 15, defense: 0.05, hexTime: 0.5 }
  }
});

/* ---------------- skills ---------------- */
Object.assign(SKILL_TYPES, {
  /* Necromancer */
  raiseDead: {
    name: 'Raise Dead', short: 'RAIS', kind: 'summon', class: 'arcane', sub: 'Necromancer', price: 35,
    desc: 'Two skeletons climb out of the floor\nand fight for you for 15 s.', manaCost: 30, cooldownMs: 10000, ally: 'skeleton', count: 2
  },
  soulSiphon: {
    name: 'Soul Siphon', short: 'SIPH', kind: 'burst', class: 'arcane', sub: 'Necromancer', price: 80, postBoss: POST_BOSS_1,
    desc: 'Rip the life out of everything where\nyou aim (30). You heal 40% of it.', manaCost: 30, cooldownMs: 7000,
    atAim: 220, radius: 90, damage: 30, drain: 0.4, color: 0x7b1fa2
  },
  armyOfTheDead: {
    name: 'Army of the Dead', short: 'ARMY', kind: 'raiseArmy', mega: true, megaColor: 0xeceff1, class: 'arcane', sub: 'Necromancer', price: 145, postBoss: POST_BOSS_2,
    desc: 'MEGA SPELL (130 mana). Everything that\ndied in this room rises as a skeleton\n(at least 3, at most 8).', manaCost: 130, cooldownMs: 24000, ally: 'skeleton', min: 3, max: 8
  },
  soulHarvest: {
    name: 'Soul Harvest', short: 'HARV', kind: 'harvest', mega: true, megaColor: 0x9c27b0, class: 'arcane', sub: 'Necromancer', price: 145, postBoss: POST_BOSS_2,
    desc: 'MEGA SPELL (140 mana). Every enemy on\nscreen loses 60 + 15% of its HP (bosses\n60). You heal 25% of it (max half your HP).',
    manaCost: 140, cooldownMs: 24000, damage: 60, pct: 0.15, healPct: 0.25, maxHealPct: 0.5
  },
  /* Druid */
  vineSnare: {
    name: 'Vine Snare', short: 'VINE', kind: 'zone', class: 'arcane', sub: 'Druid', price: 35,
    desc: 'Vines grow where you aim for 3 s:\nanything inside is held (0.5 s at a\ntime), slowed and hit for 6.', manaCost: 25, cooldownMs: 8000, atAim: 220,
    zone: { durationMs: 3000, tickMs: 500, radius: 85, damage: 6, stunMs: 500, chill: { ms: 800, pct: 0.4 }, color: 0x689f38 }
  },
  healingGrove: {
    name: 'Healing Grove', short: 'GROV', kind: 'zone', class: 'arcane', sub: 'Druid', price: 80, postBoss: POST_BOSS_1,
    desc: 'A grove grows around you for 5 s:\nplayers inside heal 4 HP every 0.5 s.', manaCost: 35, cooldownMs: 16000,
    zone: { durationMs: 5000, tickMs: 500, radius: 110, damage: 0, heal: 4, color: 0x81c784 }
  },
  bearForm: {
    name: 'Bear Form', short: 'BEAR', kind: 'effect', class: 'arcane', sub: 'Druid', price: 85, postBoss: POST_BOSS_1,
    desc: 'For 8 s: +30 max HP, +30% defense,\n+25% damage, but 10% slower.', manaCost: 35, cooldownMs: 18000, effect: 'bearForm'
  },
  wildGrowth: {
    name: 'Wild Growth', short: 'WGRO', kind: 'zone', mega: true, megaColor: 0x7cb342, class: 'arcane', sub: 'Druid', price: 140, postBoss: POST_BOSS_2,
    desc: 'MEGA SPELL (120 mana). The whole floor\naround you grows wild for 6 s: enemies\nare held and hit (14), players heal.', manaCost: 120, cooldownMs: 24000,
    zone: { durationMs: 6000, tickMs: 600, radius: 270, damage: 14, stunMs: 450, heal: 3, chill: { ms: 900, pct: 0.4 }, color: 0x7cb342 }
  },
  /* Witch */
  broomDash: {
    name: 'Broom Dash', short: 'BROM', kind: 'blink', class: 'arcane', sub: 'Witch', price: 35,
    desc: 'Fly 260 px toward your aim on your\nbroom (can\'t be hit on the way).', manaCost: 15, cooldownMs: 3500, distance: 260, color: 0x8e24aa, invulnMs: 350
  },
  curseOfFrailty: {
    name: 'Curse of Frailty', short: 'CURS', kind: 'burst', class: 'arcane', sub: 'Witch', price: 80, postBoss: POST_BOSS_1,
    desc: 'Curse a big area where you aim: hexed\nfor 6 s (+25% damage taken) and slowed.', manaCost: 30, cooldownMs: 9000,
    atAim: 220, radius: 150, damage: 8, hex: { ms: 6000 }, chill: { ms: 2500, pct: 0.35 }, color: 0x8e24aa
  },
  toilAndTrouble: {
    name: 'Toil and Trouble', short: 'TOIL', kind: 'storm', mega: true, megaColor: 0x76ff03, class: 'arcane', sub: 'Witch', price: 140, postBoss: POST_BOSS_2,
    desc: 'MEGA SPELL (120 mana). For 3 s, cauldrons\nboil over on random enemies: 15 splashes\n(30, poison, hex).', manaCost: 120, cooldownMs: 22000,
    zone: { durationMs: 3000, everyMs: 200, radius: 70, damage: 30, poison: { ms: 3000, tick: 4 }, hex: { ms: 3000 }, color: 0x76ff03 }
  },
  /* Monk mega */
  auraDragon: {
    name: 'Aura Dragon', short: 'DRGN', kind: 'summon', mega: true, megaColor: 0xffb300, class: 'melee', sub: 'Monk', price: 140, postBoss: POST_BOSS_2,
    desc: 'MEGA SPELL (all 100 mana). Your aura\ntakes the shape of a dragon that hunts\nfor 12 s (30 per bite, can\'t be hurt).', manaCost: 100, cooldownMs: 26000, ally: 'auraDragon', count: 1
  }
});
// summon skills are mega too sometimes
(function () {
  const summon = SKILL_BEHAVIORS.summon;
  SKILL_BEHAVIORS.summon = function (p, d, ctx) {
    const ok = summon(p, d, ctx);
    if (ok) SkillFx.mega(ctx, p, d);
    return ok;
  };
})();

/* ---------------- items ---------------- */
Object.assign(EFFECT_TYPES, {
  bearForm: { name: 'Bear Form', durationMs: 8000, mods: { maxHp: 30, defense: 0.30, damageMul: 0.25, moveSpeedMul: -0.10 } },
  boneDust: { name: 'Bone Dust', durationMs: 60000, mods: { raiseChance: 0.25 } },
  eyeOfNewt: { name: 'Eye of Newt', durationMs: 60000, mods: { hexChance: 0.15 } }
});
Object.assign(CONSUMABLE_TYPES, {
  boneDust: { name: 'Bone Dust', short: 'BONE', price: 14, amount: 1, kind: 'effect', effect: 'boneDust', class: 'arcane', sub: 'Necromancer',
    desc: '60 s: kills have a 25% chance\nto rise as skeletons.' },
  herbalTea: { name: 'Herbal Tea', short: 'TEA', price: 14, amount: 1, kind: 'heal', healPct: 30, class: 'arcane', sub: 'Druid',
    desc: 'Restores 30% of max HP.' },
  eyeOfNewt: { name: 'Eye of Newt', short: 'NEWT', price: 14, amount: 1, kind: 'effect', effect: 'eyeOfNewt', class: 'arcane', sub: 'Witch',
    desc: '60 s: every hit has a 15%\nchance to hex.' }
});

/* ---------------- set bonuses ---------------- */
Object.assign(SET_BONUSES, {
  Necromancer: [[2, 'allies +25% damage', { allyDamage: 0.25 }], [4, '+15% raise chance', { raiseChance: 0.15 }], [6, '+15% damage, 4% life steal', { damageMul: 0.15, lifeSteal: 0.04 }]],
  Druid:       [[2, '+15 max HP', { maxHp: 15 }], [4, '+8% defense, +10% speed', { defense: 0.08, moveSpeedMul: 0.10 }], [6, '+15% damage, +20 max HP', { damageMul: 0.15, maxHp: 20 }]],
  Witch:       [[2, 'hexes last 50% longer', { hexTime: 0.5 }], [4, '+15 max mana, 5% crit', { maxMana: 15, critChance: 0.05 }], [6, '+15% damage, 10% hex chance', { damageMul: 0.15, hexChance: 0.10 }]]
});
