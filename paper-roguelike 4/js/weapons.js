/* weapons.js
   WEAPON_TYPES (data), WEAPON_BEHAVIORS (how each "kind" attacks) and
   WeaponSystem (weapon state, melee arc hits, combos, parry, shield checks).
   Kinds: charge (bows), melee (swords, daggers, fists), projectile (staffs,
   wands), shield. To add a weapon: add an entry using an existing kind.
   starter: 1/2/3 = offered on the weapon select screen, in that order.
   minLevel = first shop it can appear in. visual = how it's drawn in hand.

   Optional melee features (any melee weapon can use them):
     dashParry        attack during a dash = reflect bullets / 2x vs dashing enemies
     maxTargets       hits at most N enemies per swing (closest first)
     heavyEvery: 3    every 3rd swing in a row is a heavy attack (heavy: {...})
     projectileEvery  every Nth swing also fires a projectile (projectile: {...})
     auraShot         each swing also costs mana and fires a projectile (auraShot: {...})
     spinKick         double-tap attack = spin kick (spinKick: {...})
     ramp             hitting the same enemy again and again ramps damage (ramp: {...}) */

const ARROW_HIT_RADIUS = 7;   // arrows and bolts (thin textures would give ~4)

const WEAPON_TYPES = {
  /* ================= MELEE · KNIGHT ================= */
  // ---- Miner (secret Gnome kit; later a blueprint) ----
  pickaxe: {
    name: 'Gnomish Pickaxe', short: 'PICK', kind: 'melee', class: 'melee', sub: 'Miner', type: 'pickaxe', price: 45,
    blueprint: 'gnome',
    desc: 'Swings (24). Breaks obstacle blocks you\nhit: each drops a coin. Every 3rd swing\nin a row is a big overhead strike (42).',
    damage: 24, range: 74, arcDeg: 100, cooldownMs: 540,
    knockback: 220, knockbackMs: 110, swingFxMs: 140,
    heavyEvery: 3, comboResetMs: 1100,
    heavy: { damage: 42, rangeMul: 1.15, arcDeg: 140, knockback: 380, knockbackMs: 150, stunMs: 400 },
    mines: true,
    visual: { style: 'pick', length: 24, color: 0x8d6e63, head: 0x90a4ae }
  },
  sword: {
    name: "Blacksmith's First Sword", short: 'BSWD', kind: 'melee', class: 'melee', sub: 'Knight', type: 'sword',
    price: 30, starter: 2,
    desc: 'Slash hits every enemy in the arc.\nHigh damage, slight knockback.\nParry: attack while dashing.',
    damage: 24, range: 78, arcDeg: 120, cooldownMs: 380,
    knockback: 260, knockbackMs: 110, swingFxMs: 120,
    dashParry: true, parryDamageMul: 2, reflectDamageMul: 1.5, reflectSpeed: 620,
    visual: { style: 'blade', length: 24, width: 4, color: 0xb0bec5, guard: 0x8d6e63, swing: 0xffffff }
  },
  longsword: {
    name: 'Longsword', short: 'LSWD', kind: 'melee', class: 'melee', sub: 'Knight', type: 'sword',
    price: 40, minLevel: 2,
    desc: 'Slower, but longer reach, a wider\narc and harder hits.\nParry: attack while dashing.',
    damage: 34, range: 102, arcDeg: 150, cooldownMs: 550,
    knockback: 320, knockbackMs: 130, swingFxMs: 150,
    dashParry: true, parryDamageMul: 2, reflectDamageMul: 1.5, reflectSpeed: 620,
    visual: { style: 'blade', length: 34, width: 5, color: 0xcfd8dc, guard: 0x5d4037, swing: 0xeceff1 }
  },
  dragonsteel: {
    name: 'Dragonsteel Longsword', short: 'DRGN', kind: 'melee', class: 'melee', sub: 'Knight', type: 'sword',
    price: 90, postBoss: POST_BOSS_1,
    desc: 'Longsword speed and reach, 46 damage.\nEvery 3rd swing in a row: a heavy\nslash for 110 that stuns for 1.5 s.',
    damage: 46, range: 102, arcDeg: 150, cooldownMs: 550,
    knockback: 340, knockbackMs: 130, swingFxMs: 150,
    dashParry: true, parryDamageMul: 2, reflectDamageMul: 1.5, reflectSpeed: 650,
    heavyEvery: 3, comboResetMs: 1200,
    heavy: { damage: 110, rangeMul: 1.15, arcDeg: 175, knockback: 560, knockbackMs: 200, stunMs: 1500 },
    visual: { style: 'blade', length: 34, width: 6, color: 0xff7043, guard: 0x3e2723, swing: 0xffab91, heavySwing: 0xff3d00 }
  },
  enchantedSword: {
    name: 'Enchanted Sword', short: 'ENCH', kind: 'melee', class: 'melee', sub: 'Knight', type: 'sword',
    price: 85, postBoss: POST_BOSS_1,
    desc: '40 damage, longsword reach.\nEvery 2nd swing releases a spectral\nsword that pierces 3 enemies.',
    damage: 40, range: 100, arcDeg: 130, cooldownMs: 550,
    knockback: 300, knockbackMs: 120, swingFxMs: 150,
    dashParry: true, parryDamageMul: 2, reflectDamageMul: 1.5, reflectSpeed: 650,
    projectileEvery: 2,
    projectile: { damage: 30, speed: 540, lifetimeMs: 700, pierce: 3, texture: 'spectral' },
    visual: { style: 'blade', length: 32, width: 5, color: 0x80d8ff, guard: 0x283593, swing: 0xb3e5fc, glow: 0x40c4ff }
  },

  /* ================= MELEE · MONK ================= */
  martialScroll1: {
    name: '1st Martial Arts Scroll', short: 'MAS1', kind: 'melee', class: 'melee', sub: 'Monk', type: 'fist',
    price: 30, minLevel: 1,
    desc: 'Punches (24) hit up to 2 enemies at\nvery close range. Double-tap: spin kick\n(270°, 40 dmg, stun 1 s, big knockback).',
    damage: 24, range: 46, arcDeg: 90, cooldownMs: 380, maxTargets: 2,
    knockback: 140, knockbackMs: 80, swingFxMs: 90,
    spinKick: { damage: 40, range: 70, arcDeg: 270, knockback: 520, knockbackMs: 200, stunMs: 1000, cooldownMs: 2000, doubleTapMs: 280 },
    visual: { style: 'fist', color: 0xffcc80, outline: 0xe65100, swing: 0xffb74d }
  },
  martialScroll2: {
    name: '2nd Martial Arts Scroll', short: 'MAS2', kind: 'melee', class: 'melee', sub: 'Monk', type: 'fist',
    price: 80, postBoss: POST_BOSS_1,
    desc: 'Stronger, longer punches (30). The longer\nyou keep hitting the same enemy, the harder\nyou hit (up to +80%). Double-tap: spin kick.',
    damage: 30, range: 58, arcDeg: 95, cooldownMs: 360, maxTargets: 2,
    knockback: 150, knockbackMs: 80, swingFxMs: 90,
    ramp: { perHit: 0.08, max: 0.8, resetMs: 1200 },
    spinKick: { damage: 55, range: 80, arcDeg: 270, knockback: 560, knockbackMs: 200, stunMs: 1100, cooldownMs: 1800, doubleTapMs: 280 },
    visual: { style: 'fist', color: 0xffe0b2, outline: 0xbf360c, swing: 0xff9800, wrap: 0xd32f2f }
  },
  auraScroll1: {
    name: '1st Aura Scroll', short: 'AUR1', kind: 'melee', class: 'melee', sub: 'Monk', type: 'fist',
    price: 40, minLevel: 3,
    desc: 'Punches (24, up to 2 enemies). Each punch\nalso costs 5 mana and launches an aura fist\n(18 dmg, pierces 3). No mana = plain punches.',
    damage: 24, range: 46, arcDeg: 90, cooldownMs: 380, maxTargets: 2,
    knockback: 140, knockbackMs: 80, swingFxMs: 90,
    auraShot: { manaCost: 5, damage: 18, speed: 430, lifetimeMs: 420, pierce: 3, texture: 'aurafist' },
    spinKick: { damage: 40, range: 70, arcDeg: 270, knockback: 520, knockbackMs: 200, stunMs: 1000, cooldownMs: 2000, doubleTapMs: 280 },
    visual: { style: 'fist', color: 0xfff59d, outline: 0xf57f17, swing: 0xffee58, aura: 0xffd54f }
  },
  auraScroll2: {
    name: '2nd Aura Scroll', short: 'AUR2', kind: 'melee', class: 'melee', sub: 'Monk', type: 'fist',
    price: 85, postBoss: POST_BOSS_1,
    desc: 'Punches (28). Each punch also costs 6 mana\nand launches a homing aura sphere (24 dmg).\nDouble-tap: spin kick.',
    damage: 28, range: 50, arcDeg: 90, cooldownMs: 380, maxTargets: 2,
    knockback: 150, knockbackMs: 80, swingFxMs: 90,
    auraShot: { manaCost: 6, damage: 24, speed: 340, lifetimeMs: 1300, pierce: 0, homing: 5.5, texture: 'auraorb' },
    spinKick: { damage: 50, range: 75, arcDeg: 270, knockback: 540, knockbackMs: 200, stunMs: 1000, cooldownMs: 1900, doubleTapMs: 280 },
    visual: { style: 'fist', color: 0xfff9c4, outline: 0xff6f00, swing: 0xffca28, aura: 0xffa000 }
  },

  /* ================= PRECISION · ARCHER ================= */
  bow: {
    name: 'Short Bow', short: 'SBOW', kind: 'charge', class: 'precision', sub: 'Archer', type: 'bow', price: 30, starter: 1,
    desc: 'Hold to charge, release to shoot. Taps are weak.\n1 s: heavy fast arrow (60).\n2 s: pierces 4 enemies.',
    fullChargeMs: 1000, pierceChargeMs: 2000,
    minDamage: 5, maxDamage: 30, minSpeed: 400, maxSpeed: 680,
    fullDamage: 60, fullSpeed: 980, pierceCount: 4,
    cooldownMs: 280, lifetimeMs: 1700, texture: 'arrow',
    visual: { style: 'bow', color: 0x8d6e63, size: 15 }
  },
  longbow: {
    name: 'Long Bow', short: 'LBOW', kind: 'charge', class: 'precision', sub: 'Archer', type: 'bow', price: 40, minLevel: 2,
    desc: 'Slower to charge, hits much harder.\n1.4 s: heavy fast arrow (95).\n2.4 s: pierces 6 enemies.',
    fullChargeMs: 1400, pierceChargeMs: 2400,
    minDamage: 6, maxDamage: 40, minSpeed: 420, maxSpeed: 720,
    fullDamage: 95, fullSpeed: 1150, pierceCount: 6,
    cooldownMs: 340, lifetimeMs: 1600, texture: 'arrow',
    visual: { style: 'bow', color: 0x5d4037, size: 20 }
  },
  crossbow: {
    name: 'Crossbow', short: 'XBOW', kind: 'crossbow', class: 'precision', sub: 'Archer', type: 'crossbow', price: 90, postBoss: POST_BOSS_1,
    desc: 'Hold to load up to 3 bolts (0.45 s each).\nThey stay loaded (swaps, rooms). Click to fire\nALL loaded bolts at once, 45 damage each.',
    loadMs: 450, maxLoaded: 3, spreadDeg: 4, cooldownMs: 300,
    damage: 45, speed: 1000, lifetimeMs: 1100, pierce: 1, texture: 'bolt',
    visual: { style: 'crossbow', color: 0x6d4c41 }
  },
  manaBow: {
    name: 'Mana Bow', short: 'MBOW', kind: 'charge', class: 'precision', sub: 'Archer', type: 'bow', price: 95, postBoss: POST_BOSS_1,
    desc: 'Stronger than the Long Bow (105 at 1.2 s).\nFull shots also spend 14 mana on a 2nd arrow,\nfired right after: a mana arrow (55) that\nexplodes on the first enemy it hits.',
    fullChargeMs: 1200, pierceChargeMs: 2200,
    minDamage: 8, maxDamage: 45, minSpeed: 420, maxSpeed: 720,
    fullDamage: 105, fullSpeed: 1150, pierceCount: 5,
    cooldownMs: 320, lifetimeMs: 1600, texture: 'arrow',
    manaArrow: { manaCost: 14, damage: 55, radius: 75, speed: 1000, texture: 'manaarrow', delayMs: 140 },
    visual: { style: 'bow', color: 0x5e35b1, size: 18, glow: 0x9575cd }
  },

  /* ================= PRECISION · HUNTER ================= */
  hunterKnife: {
    name: 'Hunter Knife', short: 'KNIF', kind: 'melee', class: 'precision', sub: 'Hunter', type: 'knife', price: 30, minLevel: 1,
    desc: 'Quick short slashes (20), same reach as the\nstarter sword. 50% chance to Injure: bleeding\n(4 every 0.5 s for 3 s) + 30% slower.\nWhile held: +15% speed, dash cooldown -35%.',
    damage: 20, range: 78, arcDeg: 110, cooldownMs: 300,
    knockback: 120, knockbackMs: 70, swingFxMs: 100,
    injure: { chance: 0.5, bleedMs: 3000, bleedTick: 4, slowMs: 1500, slowPct: 0.3 },
    mods: { moveSpeedMul: 0.15, dashCooldownMul: -0.35 },     // only while this weapon is held
    visual: { style: 'blade', length: 13, width: 3, color: 0xbdbdbd, guard: 0x3e2723, swing: 0xffffff }
  },
  tomahawk: {
    name: 'Tomahawk', short: 'AXE', kind: 'throw', class: 'precision', sub: 'Hunter', type: 'axe', price: 40, minLevel: 2,
    desc: 'Throw a heavy axe (40) that pierces and knocks\nback. Enemies knocked into a wall get stunned.\nIt comes back after a moment (or pick it up).',
    ammo: 1, cooldownMs: 250, damage: 40, speed: 640, range: 380,
    knockback: 320, knockbackMs: 160, wallStunMs: 1200, stuckMs: 1100, returnSpeed: 720,
    visual: { style: 'axe', color: 0x8d6e63, head: 0x90a4ae }
  },
  doubleTomahawk: {
    name: 'Double Tomahawk', short: 'AXE2', kind: 'throw', class: 'precision', sub: 'Hunter', type: 'axe', price: 130, postBoss: POST_BOSS_2,
    desc: 'Two tomahawks (36 each): throw one, then\nthe other. Same pierce, knockback and wall stun.',
    ammo: 2, cooldownMs: 180, damage: 36, speed: 660, range: 380,
    knockback: 300, knockbackMs: 150, wallStunMs: 1200, stuckMs: 1000, returnSpeed: 760,
    visual: { style: 'axe', color: 0x6d4c41, head: 0xb0bec5, two: true }
  },
  winchester: {
    name: 'Winchester', short: 'WNCH', kind: 'gun', class: 'precision', sub: 'Hunter', type: 'gun', price: 100, postBoss: POST_BOSS_1,
    desc: 'Old rifle, 2 shots (75 each): pierce many enemies,\nknockback, slow, and Injured (bleeding). When\nempty, hold attack 1.6 s to reload.',
    shells: 2, reloadMs: 1600, shotCdMs: 200,
    damage: 75, speed: 1500, lifetimeMs: 700, pierce: 8, knockback: 300, texture: 'slug',
    flags: { slow: { ms: 700, pct: 0.5 }, bleed: { ms: 4000, tick: 4 } },
    visual: { style: 'gun', color: 0x5d4037, barrel: 0x455a64 }
  },
  cripplingCrossbow: {
    name: 'Crippling Crossbow', short: 'CXBW', kind: 'crossbow', class: 'precision', sub: 'Hunter', type: 'crossbow', price: 95, postBoss: POST_BOSS_1,
    desc: 'Hold to load up to 3 bolts, click to fire them\nall at once. A bolt hitting an unmarked enemy\ndeals 28, marks and slows it. Bolts hitting a\nmarked enemy deal 50 +60%.',
    loadMs: 450, maxLoaded: 3, spreadDeg: 4, cooldownMs: 300,
    damage: 50, firstDamage: 28, speed: 1000, lifetimeMs: 1100, pierce: 0, texture: 'bolt',
    crippling: { mark: 6000, slow: { ms: 2000, pct: 0.4 }, markBonus: 0.6 },
    visual: { style: 'crossbow', color: 0x4e342e, tip: 0xc62828 }
  },

  /* ================= TIER 2 (after boss 2) + BLUEPRINT weapons ================= */
  // ---- Knight ----
  sunsteel: {
    name: 'Sunsteel Greatsword', short: 'SUN', kind: 'melee', class: 'melee', sub: 'Knight', type: 'sword',
    price: 140, postBoss: POST_BOSS_2,
    desc: 'Huge slow swings (58), very long reach.\nEvery 3rd swing in a row: a heavy slash (130,\nstun 1.5 s) that also throws 3 sun waves.',
    damage: 58, range: 112, arcDeg: 160, cooldownMs: 640,
    knockback: 360, knockbackMs: 140, swingFxMs: 170,
    dashParry: true, parryDamageMul: 2, reflectDamageMul: 1.6, reflectSpeed: 680,
    heavyEvery: 3, comboResetMs: 1300,
    heavy: { damage: 130, rangeMul: 1.15, arcDeg: 180, knockback: 600, knockbackMs: 210, stunMs: 1500 },
    heavyWave: { count: 3, spreadDeg: 22, damage: 40, speed: 560, lifetimeMs: 650, pierce: 5, texture: 'sunwave' },
    visual: { style: 'blade', length: 38, width: 7, color: 0xffd54f, guard: 0x6d4c41, swing: 0xfff59d, heavySwing: 0xffab00, glow: 0xffca28 }
  },
  executioner: {
    name: "Executioner's Blade", short: 'EXEC', kind: 'melee', class: 'melee', sub: 'Knight', type: 'sword',
    price: 135, postBoss: POST_BOSS_2,
    desc: 'Heavy blade (50). Enemies under 35% HP\ntake DOUBLE damage (bosses +40%).\nParry: attack while dashing.',
    damage: 50, range: 100, arcDeg: 140, cooldownMs: 520,
    knockback: 300, knockbackMs: 120, swingFxMs: 150,
    dashParry: true, parryDamageMul: 2, reflectDamageMul: 1.5, reflectSpeed: 660,
    execute: { below: 0.35, mul: 2, bossMul: 1.4 },
    visual: { style: 'blade', length: 34, width: 8, color: 0x78909c, guard: 0x212121, swing: 0xcfd8dc, glow: 0xb71c1c }
  },
  flamberge: {
    name: 'Flamberge', short: 'FLMB', kind: 'melee', class: 'melee', sub: 'Knight', type: 'sword',
    price: 45, blueprint: 'flamberge',
    desc: 'A wavy knightly greatsword. Wide swings (30)\nthat tear wounds: 35% chance to Injure.\nEvery 3rd swing: heavy cleave (64, stun 0.8 s).\nParry: attack while dashing.',
    damage: 30, range: 96, arcDeg: 150, cooldownMs: 540,
    knockback: 240, knockbackMs: 110, swingFxMs: 140,
    dashParry: true, parryDamageMul: 2, reflectDamageMul: 1.5, reflectSpeed: 640,
    heavyEvery: 3, comboResetMs: 1200,
    heavy: { damage: 64, rangeMul: 1.1, arcDeg: 170, knockback: 420, knockbackMs: 160, stunMs: 800 },
    injure: { chance: 0.35, bleedMs: 3000, bleedTick: 4, slowMs: 1200, slowPct: 0.25 },
    visual: { style: 'blade', length: 34, width: 6, color: 0xb0bec5, guard: 0xffb300, swing: 0xeceff1 }
  },
  // ---- Monk ----
  martialScroll3: {
    name: '3rd Martial Arts Scroll', short: 'MAS3', kind: 'melee', class: 'melee', sub: 'Monk', type: 'fist',
    price: 130, postBoss: POST_BOSS_2,
    desc: 'Punches (36) hit up to 3 enemies. Keep\nhitting the same enemy: up to +120%.\nDouble-tap: spin kick (75) + a ring of\n8 aura fists.',
    damage: 36, range: 62, arcDeg: 100, cooldownMs: 340, maxTargets: 3,
    knockback: 160, knockbackMs: 80, swingFxMs: 90,
    ramp: { perHit: 0.1, max: 1.2, resetMs: 1300 },
    spinKick: { damage: 75, range: 92, arcDeg: 360, knockback: 600, knockbackMs: 210, stunMs: 1200, cooldownMs: 1500, doubleTapMs: 280,
                ring: { count: 8, damage: 22, speed: 430, lifetimeMs: 380, pierce: 2, texture: 'aurafist' } },
    visual: { style: 'fist', color: 0xffccbc, outline: 0x4e342e, swing: 0xff7043, wrap: 0x212121 }
  },
  auraScroll3: {
    name: '3rd Aura Scroll', short: 'AUR3', kind: 'melee', class: 'melee', sub: 'Monk', type: 'fist',
    price: 135, postBoss: POST_BOSS_2,
    desc: 'Punches (32). Each punch also costs 7 mana\nand launches TWO homing aura spheres\n(26 each, pierce 1). Double-tap: spin kick.',
    damage: 32, range: 54, arcDeg: 95, cooldownMs: 380, maxTargets: 2,
    knockback: 160, knockbackMs: 80, swingFxMs: 90,
    auraShot: { manaCost: 7, damage: 26, speed: 360, lifetimeMs: 1400, pierce: 1, homing: 6, count: 2, spreadDeg: 26, texture: 'auraorb' },
    spinKick: { damage: 60, range: 80, arcDeg: 270, knockback: 560, knockbackMs: 200, stunMs: 1100, cooldownMs: 1800, doubleTapMs: 280 },
    visual: { style: 'fist', color: 0xfffde7, outline: 0xe65100, swing: 0xffd740, aura: 0xff6d00 }
  },
  ironKnuckles: {
    name: 'Iron Knuckles', short: 'KNUK', kind: 'melee', class: 'melee', sub: 'Monk', type: 'fist',
    price: 85, postBoss: POST_BOSS_1, blueprint: 'ironKnuckles',
    desc: 'Slow, heavy punches (38, up to 2 enemies)\nthat stun for 0.3 s. Double-tap: spin kick.',
    damage: 38, range: 50, arcDeg: 90, cooldownMs: 480, maxTargets: 2, stunMs: 300,
    knockback: 220, knockbackMs: 100, swingFxMs: 100,
    spinKick: { damage: 50, range: 72, arcDeg: 270, knockback: 560, knockbackMs: 200, stunMs: 1100, cooldownMs: 2000, doubleTapMs: 280 },
    visual: { style: 'fist', color: 0xb0bec5, outline: 0x37474f, swing: 0x90a4ae }
  },
  // ---- Archer ----
  compositeBow: {
    name: 'Composite Bow', short: 'CBOW', kind: 'charge', class: 'precision', sub: 'Archer', type: 'bow', price: 140, postBoss: POST_BOSS_2,
    desc: 'The strongest bow. 1.1 s: arrow (150)\nplus 2 side arrows (60). 2 s: all of\nthem pierce 8 enemies.',
    fullChargeMs: 1100, pierceChargeMs: 2000,
    minDamage: 8, maxDamage: 55, minSpeed: 440, maxSpeed: 760,
    fullDamage: 150, fullSpeed: 1250, pierceCount: 8,
    cooldownMs: 320, lifetimeMs: 1600, texture: 'arrow',
    fullFan: { count: 2, spreadDeg: 9, damageMul: 0.4 },
    visual: { style: 'bow', color: 0x3e2723, size: 21, glow: 0xffb300 }
  },
  repeatingCrossbow: {
    name: 'Repeating Crossbow', short: 'RXBW', kind: 'crossbow', class: 'precision', sub: 'Archer', type: 'crossbow', price: 135, postBoss: POST_BOSS_2,
    desc: 'Hold to load up to 5 bolts (0.3 s each).\nClick to fire them all: 52 each,\npierce 2 enemies.',
    loadMs: 300, maxLoaded: 5, spreadDeg: 5, cooldownMs: 280,
    damage: 52, speed: 1050, lifetimeMs: 1100, pierce: 2, texture: 'bolt',
    visual: { style: 'crossbow', color: 0x3e2723, tip: 0xffb300 }
  },
  recurveBow: {
    name: 'Recurve Bow', short: 'RBOW', kind: 'charge', class: 'precision', sub: 'Archer', type: 'bow', price: 35, blueprint: 'recurveBow',
    desc: 'Quick bow. 0.7 s: fast arrow (46).\n1.5 s: pierces 3 enemies.',
    fullChargeMs: 700, pierceChargeMs: 1500,
    minDamage: 5, maxDamage: 24, minSpeed: 420, maxSpeed: 700,
    fullDamage: 46, fullSpeed: 1000, pierceCount: 3,
    cooldownMs: 240, lifetimeMs: 1500, texture: 'arrow',
    visual: { style: 'bow', color: 0xa1887f, size: 14 }
  },
  // ---- Hunter ----
  boneTomahawks: {
    name: 'Bone Tomahawks', short: 'AXE3', kind: 'throw', class: 'precision', sub: 'Hunter', type: 'axe', price: 135, postBoss: POST_BOSS_2,
    debugOnly: true,   // too strong for now: Test Dungeon only (planned for the final stage)
    desc: 'THREE tomahawks (44 each). Pierce,\nknockback, wall stun, and 60% chance\nto Injure (bleed + slow).',
    ammo: 3, cooldownMs: 160, damage: 44, speed: 680, range: 420,
    knockback: 320, knockbackMs: 160, wallStunMs: 1300, stuckMs: 900, returnSpeed: 800,
    injure: { chance: 0.6, bleedMs: 3500, bleedTick: 5, slowMs: 1500, slowPct: 0.3 },
    visual: { style: 'axe', color: 0xeeeeee, head: 0xd7ccc8, two: true }
  },
  machete: {
    name: 'Machete', short: 'MACH', kind: 'melee', class: 'precision', sub: 'Hunter', type: 'knife', price: 130, postBoss: POST_BOSS_2,
    desc: 'Fast long slashes (34). 65% chance to\nInjure. Bleeding enemies take +40%.\nWhile held: +15% speed, dash cooldown -35%.',
    damage: 34, range: 90, arcDeg: 125, cooldownMs: 320,
    knockback: 140, knockbackMs: 70, swingFxMs: 110,
    injure: { chance: 0.65, bleedMs: 3500, bleedTick: 6, slowMs: 1500, slowPct: 0.3 },
    bleedBonus: 0.4,
    mods: { moveSpeedMul: 0.15, dashCooldownMul: -0.35 },
    visual: { style: 'blade', length: 26, width: 6, color: 0x9e9e9e, guard: 0x4e342e, swing: 0xffffff }
  },
  boomerang: {
    name: 'Boomerang', short: 'BOOM', kind: 'throw', class: 'precision', sub: 'Hunter', type: 'boomerang', price: 35, blueprint: 'boomerang',
    desc: 'Throw it (22): it curves back on its own\nright away and hits again on the way back.',
    ammo: 1, cooldownMs: 200, damage: 22, speed: 620, range: 330,
    knockback: 160, knockbackMs: 100, wallStunMs: 600, stuckMs: 0, returnSpeed: 640, flyTexture: 'boomerang',
    visual: { style: 'boomerang', color: 0xa1887f }
  },
  // ---- Miner (gnome blueprint) ----
  mithrilPick: {
    name: 'Mithril Pickaxe', short: 'MITH', kind: 'melee', class: 'melee', sub: 'Miner', type: 'pickaxe', price: 130,
    postBoss: POST_BOSS_2, blueprint: 'gnome',
    desc: 'Heavy swings (46). Breaks blocks (coins).\nEvery 3rd swing: a huge strike (100,\nstun 0.8 s) that hits all around you.',
    damage: 46, range: 82, arcDeg: 110, cooldownMs: 500,
    knockback: 260, knockbackMs: 120, swingFxMs: 140,
    heavyEvery: 3, comboResetMs: 1100,
    heavy: { damage: 100, rangeMul: 1.2, arcDeg: 360, knockback: 460, knockbackMs: 170, stunMs: 800 },
    mines: true,
    visual: { style: 'pick', length: 26, color: 0x5d4037, head: 0x80deea }
  },

  /* ================= BOSS LOOT · The Bookworm ================= */
  // ---- King Inkblot loot ----
  blotStaff: {
    name: 'Blot Staff', short: 'BLOT', kind: 'projectile', class: 'arcane', sub: 'Inkblot', type: 'staff',
    price: 95, bossItem: 'kingInkblot',
    desc: 'Slow ink orbs (28) that burst into 4\nink drops (10 each) when they hit.',
    damage: 28, speed: 330, lifetimeMs: 1500, fireDelayMs: 620, manaCost: 9, texture: 'magic',
    split: { count: 4, damage: 10, speed: 420, lifetimeMs: 380, texture: 'spark' },
    visual: { style: 'stick', length: 24, color: 0x37474f, orb: 0x263238, orbSize: 7 }
  },
  // ---- The Warden loot ----
  wardenFlail: {
    name: "Warden's Flail", short: 'FLAI', kind: 'melee', class: 'melee', sub: 'Warden', type: 'flail',
    price: 95, bossItem: 'warden',
    desc: 'Swing the ball all around you: hits every\nenemy within reach (38), huge knockback,\nshort stun. Slow.',
    damage: 38, range: 108, arcDeg: 360, cooldownMs: 860,
    knockback: 440, knockbackMs: 170, swingFxMs: 220, stunMs: 400,
    visual: { style: 'flail', length: 30, color: 0x455a64, head: 0x37474f }
  },
  devourerSword: {
    name: 'Devourer Sword', short: 'DVOR', kind: 'melee', class: 'melee', sub: 'Bookworm', type: 'sword',
    price: 95, bossItem: 'bookworm',
    desc: '36 damage, wide arc. Every kill has a 30%\nchance to summon a wormling that hunts\nenemies for 10 s (max 3). Parry: attack\nwhile dashing.',
    damage: 36, range: 96, arcDeg: 135, cooldownMs: 500,
    knockback: 280, knockbackMs: 120, swingFxMs: 140,
    dashParry: true, parryDamageMul: 2, reflectDamageMul: 1.5, reflectSpeed: 640,
    summonOnKill: { chance: 0.3, ally: 'wormling' },
    visual: { style: 'blade', length: 32, width: 6, color: 0xa1887f, guard: 0x4a148c, swing: 0xd1c4e9, glow: 0x7b1fa2 }
  },
  dorsalBow: {
    name: 'Dorsal Bow', short: 'DRSL', kind: 'charge', class: 'precision', sub: 'Bookworm', type: 'bow',
    price: 95, bossItem: 'bookworm',
    desc: 'Homing arrows. Quick charge: 0.65 s for a\nfull shot (30), 1.4 s to pierce 2 enemies.',
    fullChargeMs: 650, pierceChargeMs: 1400,
    minDamage: 3, maxDamage: 14, minSpeed: 360, maxSpeed: 560,
    fullDamage: 30, fullSpeed: 720, pierceCount: 2,
    cooldownMs: 260, lifetimeMs: 1800, texture: 'arrow', homing: 4.5,
    visual: { style: 'bow', color: 0x6a1b9a, size: 16 }
  },

  /* ================= placeholders (to be remade) ================= */
  staff: {
    name: 'Mage Staff', short: 'STAF', kind: 'projectile', class: 'arcane', sub: 'Mage', type: 'staff', price: 30,
    desc: 'Fast magic bolts, no charge-up.\nEach bolt costs mana. No mana =\nno bolts.',
    damage: 10, speed: 560, lifetimeMs: 900, fireDelayMs: 170, manaCost: 6, texture: 'magic',
    visual: { style: 'stick', length: 30, color: 0x6d4c41, orb: 0x9c6ade, orbSize: 6 }
  },
  wand: {
    name: 'Wand', short: 'WAND', kind: 'projectile', class: 'arcane', sub: 'Mage', type: 'wand', price: 35, starter: 3,
    desc: 'Rapid weak sparks.\nCheap on mana, slightly random aim.',
    damage: 5, speed: 640, lifetimeMs: 650, fireDelayMs: 90, manaCost: 2.5, spreadDeg: 7, texture: 'spark',
    visual: { style: 'stick', length: 18, color: 0x8d6e63, orb: 0xe1bee7, orbSize: 4 }
  },
  buckler: {
    name: 'Buckler', short: 'SHLD', kind: 'shield', class: 'melee', sub: 'Knight', type: 'shield', price: 30,
    desc: 'Hold attack to raise. Blocks 40%\nfrom the front. Raise right before\na hit to parry: stun 2 s.',
    arcDeg: 180, blockPct: 0.4, parryWindowMs: 200, stunMs: 2000, parryDamage: 4, reraiseDelayMs: 350,
    visual: { style: 'shield', color: 0x90a4ae }
  }
};

const WEAPON_BEHAVIORS = {
  // Bow: charge while held, fire on release.
  charge(p, w, dt, ctx) {
    const d = w.def, s = p.stats;
    if (w.cooldownMs > 0) w.cooldownMs -= dt;

    if (p.input.attack) {
      if (w.cooldownMs <= 0) {
        w.charging = true;
        w.chargeMs = Math.min(w.chargeMs + dt * s.chargeSpeedMul, d.pierceChargeMs);
      }
      return;
    }
    if (!w.charging) return;

    let dmg, spd, pierce = 0;
    const full = w.chargeMs >= d.fullChargeMs;
    if (full) {
      dmg = d.fullDamage; spd = d.fullSpeed;
      if (w.chargeMs >= d.pierceChargeMs) pierce = d.pierceCount;
    } else {
      const t = w.chargeMs / d.fullChargeMs;
      dmg = d.minDamage + (d.maxDamage - d.minDamage) * t;
      spd = d.minSpeed + (d.maxSpeed - d.minSpeed) * t;
    }
    const homing = d.homing || 0;   // no aim assist (only weapons that are homing by design)
    WeaponSystem.fireArrow(p, ctx, p.input.aimX, p.input.aimY, spd, Math.round(dmg * s.damageMul), d.lifetimeMs, d.texture, pierce, homing, null, false);
    // Composite Bow: full shots also fire weaker side arrows
    if (full && d.fullFan) {
      const base = Math.atan2(p.input.aimY, p.input.aimX), f = d.fullFan;
      for (let i = 1; i <= f.count; i++) {
        const side = (i % 2 ? 1 : -1) * Math.ceil(i / 2) * f.spreadDeg * Math.PI / 180;
        WeaponSystem.fireArrow(p, ctx, Math.cos(base + side), Math.sin(base + side), spd, Math.round(dmg * f.damageMul * s.damageMul), d.lifetimeMs, d.texture, pierce, homing, null, true);
      }
    }
    // Mana Bow: an extra exploding mana arrow right AFTER the normal one (same line)
    if (full && d.manaArrow && p.spendMana(d.manaArrow.manaCost * s.manaCostMul)) {
      const m = d.manaArrow;
      p.queueShot(m.delayMs, p.input.aimX, p.input.aimY, m.speed, Math.round(m.damage * s.damageMul), d.lifetimeMs, m.texture, 0, homing, null, m.radius);
    }

    w.charging = false;
    w.chargeMs = 0;
    w.cooldownMs = d.cooldownMs / s.attackSpeedMul;
  },

  // Swords, daggers, fists: swing on a cooldown while held, plus optional features.
  melee(p, w, dt, ctx) {
    const d = w.def;
    if (w.cooldownMs > 0) w.cooldownMs -= dt;
    if (w.spinCdMs > 0) w.spinCdMs -= dt;
    if (w.comboMs > 0) { w.comboMs -= dt; if (w.comboMs <= 0) w.combo = 0; }
    if (w.rampMs > 0) { w.rampMs -= dt; if (w.rampMs <= 0) { w.rampStacks = 0; w.rampTarget = null; } }
    w.sincePressMs += dt;

    // Double-tap = spin kick
    if (d.spinKick && p.input.attackPressed) {
      const k = d.spinKick;
      if (w.sincePressMs < k.doubleTapMs && w.spinCdMs <= 0) {
        w.sincePressMs = 9999;
        w.spinCdMs = k.cooldownMs;
        w.cooldownMs = d.cooldownMs / p.stats.attackSpeedMul;
        w.swingAngle = Math.atan2(p.input.aimY, p.input.aimX);
        w.swingFxMs = 200; w.swingKind = 'spin'; w.swingRange = k.range; w.swingArc = k.arcDeg;
        WeaponSystem.meleeArc(p, k, ctx, false, w);
        if (k.ring) WeaponSystem.fan(p, ctx, k.ring, w.swingAngle, k.ring.count, 360 - 360 / k.ring.count);
        return;
      }
      w.sincePressMs = 0;
    }

    // Dash + attack into the Warden's ball and chain: it flies back into the Warden.
    // Checked every frame while you dash with attack held (the ball moves fast).
    if (d.class === 'melee' && p.input.attack && p.reflectMs > 0 && ctx.enemies.reflectBall &&
        ctx.enemies.reflectBall(p, Math.atan2(p.input.aimY, p.input.aimX), Math.max(d.range, 70))) {
      w.swingAngle = Math.atan2(p.input.aimY, p.input.aimX); w.swingFxMs = 160; w.swingKind = 'parry'; w.swingRange = d.range; w.swingArc = d.arcDeg;
      return;
    }
    // ...and enemy shots that fly into your blade in that window go back (King Inkblot hates his own ink)
    if (d.class === 'melee' && p.input.attack && p.reflectMs > 0 &&
        WeaponSystem.reflectShots(p, ctx, d, Math.max(d.range, 70) + 12, Math.cos(Math.min(Math.max(d.arcDeg, 120), 359) / 2 * Math.PI / 180)) > 0) {
      w.swingAngle = Math.atan2(p.input.aimY, p.input.aimX); w.swingFxMs = 120; w.swingKind = 'parry'; w.swingRange = d.range; w.swingArc = d.arcDeg;
    }
    if (!p.input.attack || w.cooldownMs > 0) return;
    // parry (reflect enemy shots): dash-parry swords right after a dash; every melee weapon in the dash-attack window
    const parry = (!!d.dashParry && p.dashParryMs > 0) || (d.class === 'melee' && p.reflectMs > 0);
    w.cooldownMs = d.cooldownMs / p.stats.attackSpeedMul;
    w.swingAngle = Math.atan2(p.input.aimY, p.input.aimX);
    w.swingParry = parry;

    // Heavy attack every Nth swing in a row
    let hit = d;
    w.swingKind = parry ? 'parry' : 'normal';
    w.swingRange = d.range; w.swingArc = d.arcDeg;
    if (d.heavyEvery) {
      w.combo++;
      w.comboMs = d.comboResetMs;
      if (w.combo >= d.heavyEvery) {
        w.combo = 0;
        hit = w.heavyDef;
        w.swingKind = 'heavy'; w.swingRange = hit.range; w.swingArc = hit.arcDeg;
        if (ctx.shake) ctx.shake(120, 0.006);
      }
    }
    w.swingFxMs = w.swingKind === 'heavy' ? 220 : d.swingFxMs;
    WeaponSystem.meleeArc(p, hit, ctx, parry, w);
    if (d.heavyWave && w.swingKind === 'heavy') WeaponSystem.fan(p, ctx, d.heavyWave, w.swingAngle, d.heavyWave.count, d.heavyWave.spreadDeg * (d.heavyWave.count - 1));
    // Pickaxe: also breaks an obstacle block in front of you
    if (d.mines && ctx.mineAt) ctx.mineAt(p, p.input.aimX, p.input.aimY, d.range);

    // Projectile every Nth swing (Enchanted Sword and the other projectile swords)
    if (d.projectileEvery) {
      w.swingCount++;
      if (w.swingCount % d.projectileEvery === 0) WeaponSystem.castShot(p, ctx, d.projectile, w.swingAngle);
    }

    // Aura shot on every punch (costs mana)
    if (d.auraShot && p.spendMana(d.auraShot.manaCost * p.stats.manaCostMul)) {
      const a = d.auraShot;
      if (a.count > 1) WeaponSystem.fan(p, ctx, a, w.swingAngle, a.count, a.spreadDeg);
      else {
        const b = WeaponSystem.shoot(p, ctx, p.input.aimX, p.input.aimY, a.speed, Math.round(a.damage * p.stats.damageMul), a.lifetimeMs, a.texture);
        if (b) { b.pierceLeft = a.pierce; b.homing = a.homing || 0; }
      }
    }
  },

  // Crossbow: works like a gun. Holding attack (when empty) loads bolts one
  // by one; letting go KEEPS them loaded (also through swaps and rooms).
  // A click while loaded fires every loaded bolt at once (tiny spread).
  crossbow(p, w, dt, ctx) {
    const d = w.def, s = p.stats;
    if (w.cooldownMs > 0) w.cooldownMs -= dt;
    if (!p.input.attack) { w.charging = false; w.chargeMs = 0; return; }
    if (w.cooldownMs > 0) return;
    // fresh click with bolts in it = shoot
    if (p.input.attackPressed && w.loaded > 0 && !w.charging) {
      const base = Math.atan2(p.input.aimY, p.input.aimX), sp = d.spreadDeg * Math.PI / 180;
      const dmg = Math.round(d.damage * s.damageMul);
      for (let i = 0; i < w.loaded; i++) {
        const a = base + (i - (w.loaded - 1) / 2) * sp;
        const b = WeaponSystem.fireArrow(p, ctx, Math.cos(a), Math.sin(a), d.speed, dmg, d.lifetimeMs, d.texture, d.pierce, 0, null, i > 0);
        if (b && d.crippling) { b.crippling = d.crippling; b.firstDamage = Math.round(d.firstDamage * s.damageMul); }
      }
      w.loaded = 0;
      w.cooldownMs = d.cooldownMs / s.attackSpeedMul;
      w.swingFxMs = 90; w.swingKind = 'muzzle';
      w.blockLoadUntilRelease = true;      // this click doesn't start loading
      return;
    }
    if (w.blockLoadUntilRelease) { if (p.input.attackPressed) w.blockLoadUntilRelease = false; else return; }
    // holding = load
    if (w.loaded < d.maxLoaded) {
      w.charging = true;
      w.chargeMs += dt * s.chargeSpeedMul * s.attackSpeedMul;
      if (w.chargeMs >= d.loadMs) { w.chargeMs = 0; w.loaded++; }
    } else { w.charging = false; w.chargeMs = 0; }
  },

  // Tomahawk: throw (uses ammo), it comes back on its own.
  throw(p, w, dt, ctx) {
    const d = w.def;
    if (w.cooldownMs > 0) w.cooldownMs -= dt;
    if (!p.input.attack || w.cooldownMs > 0 || w.ammo <= 0 || !ctx.throws) return;
    if (ctx.throws.throwAxe(p, w, p.input.aimX, p.input.aimY)) {
      w.ammo--;
      w.cooldownMs = d.cooldownMs / p.stats.attackSpeedMul;
    }
  },

  // Winchester: 2 shells. Click = shoot one. Empty: hold attack to reload.
  gun(p, w, dt, ctx) {
    const d = w.def, s = p.stats;
    if (w.cooldownMs > 0) w.cooldownMs -= dt;
    if (w.shells <= 0) {
      if (p.input.attack) {
        w.charging = true;
        w.chargeMs += dt * s.chargeSpeedMul;
        if (w.chargeMs >= d.reloadMs) { w.shells = d.shells; w.chargeMs = 0; w.charging = false; w.cooldownMs = 250; }
      } else if (w.charging) { w.charging = false; }   // keeps reload progress
      return;
    }
    if (p.input.attackPressed && w.cooldownMs <= 0) {
      const ax = p.input.aimX, ay = p.input.aimY;
      const b = WeaponSystem.fireArrow(p, ctx, ax, ay, d.speed, Math.round(d.damage * s.damageMul), d.lifetimeMs, d.texture, d.pierce, 0, d.flags, false);
      if (b) b.knockback = d.knockback;
      w.shells--;
      w.cooldownMs = d.shotCdMs;
      w.swingFxMs = 90; w.swingKind = 'muzzle';
      if (ctx.shake) ctx.shake(70, 0.003);
    }
  },

  // Staff/wand: shoot on a short delay while held, if there is enough mana.
  projectile(p, w, dt, ctx) {
    const d = w.def, s = p.stats;
    w.cooldownMs -= dt;
    if (p.input.attack && w.cooldownMs <= 0 && p.spendMana(d.manaCost * s.manaCostMul)) {
      // the weapon itself is the shot definition (damage, speed, pierce, aoe, ignite, chill, chain, split...).
      // One shot: spreadDeg = random aim wobble. Several (count): spread evenly.
      if (!w.shot || d.borrow) w.shot = Object.assign({}, d, (d.count || 1) > 1 ? {} : { spreadDeg: 0, jitterDeg: d.spreadDeg || 0 }, d.borrow ? GearFx.borrowed(p, w) : null);
      WeaponSystem.castShot(p, ctx, w.shot, Math.atan2(p.input.aimY, p.input.aimX));
      w.cooldownMs += d.fireDelayMs / s.attackSpeedMul;
      w.swingFxMs = 90; w.swingKind = 'cast';
    }
    if (w.cooldownMs < 0) w.cooldownMs = 0;
  },

  // Shield: raised while attack is held. Damage checks happen in WeaponSystem.checkShield.
  shield(p, w, dt, ctx) {
    const d = w.def;
    if (w.parryFxMs > 0) w.parryFxMs -= dt;
    if (w.cooldownMs > 0) w.cooldownMs -= dt;
    if (p.input.attack) {
      if (!w.raised && w.cooldownMs <= 0) { w.raised = true; w.raiseMs = 0; }
      if (w.raised) w.raiseMs += dt;
    } else if (w.raised) {
      w.raised = false;
      w.cooldownMs = d.reraiseDelayMs;
    }
  }
};

const WeaponSystem = {
  _targets: [],   // reused list (no allocations per swing)

  createState(weaponId) {
    const def = WEAPON_TYPES[weaponId];
    if (!def) return null;
    const st = {
      id: weaponId, def: def,
      cooldownMs: 0, chargeMs: 0, charging: false,
      swingFxMs: 0, swingAngle: 0, swingParry: false, swingKind: 'normal', swingRange: 0, swingArc: 0,
      raised: false, raiseMs: 0, parryFxMs: 0,
      combo: 0, comboMs: 0, swingCount: 0,
      spinCdMs: 0, sincePressMs: 9999,
      rampTarget: null, rampStacks: 0, rampMs: 0,
      heavyDef: null,
      loaded: 0,                       // crossbow bolts (kept between swaps/rooms)
      shells: def.shells || 0,         // Winchester
      ammo: def.ammo || 0              // tomahawks in hand
    };
    if (def.heavy) {
      const h = def.heavy;
      st.heavyDef = { damage: h.damage, range: def.range * h.rangeMul, arcDeg: h.arcDeg,
                      knockback: h.knockback, knockbackMs: h.knockbackMs, stunMs: h.stunMs,
                      parryDamageMul: def.parryDamageMul, reflectDamageMul: def.reflectDamageMul, reflectSpeed: def.reflectSpeed };
    }
    return st;
  },

  // Called when switching away from a weapon (cancels charge / lowers shield / resets combos).
  resetTransient(w) {
    if (!w) return;
    w.charging = false; w.chargeMs = 0;
    w.raised = false; w.raiseMs = 0;
    w.combo = 0; w.rampStacks = 0; w.rampTarget = null;
  },

  update(p, dt, ctx) {
    const w = p.weapon;
    if (!w) return;
    if (w.swingFxMs > 0) w.swingFxMs -= dt;
    const fn = WEAPON_BEHAVIORS[w.def.kind];
    if (fn) fn(p, w, dt, ctx);
  },

  // Precision shots: arrows/bolts. Handles multi-shot (Extra Loaded) and
  // carries on-hit flags (mark, slow, bleed, mark bonus). Returns the bullet.
  fireArrow(p, ctx, dirX, dirY, speed, damage, life, tex, pierce, homing, flags, queued) {
    const b = this.shoot(p, ctx, dirX, dirY, speed, damage, life, tex);
    if (b) {
      b.pierceLeft = pierce || 0; b.homing = homing || 0; b.flags = flags || null; b.isArrow = true;
      // arrows/bolts get a slightly bigger hitbox than their thin texture
      const r = ARROW_HIT_RADIUS;
      b.body.setCircle(r, b.width / 2 - r, b.height / 2 - r);
      b.customBody = true;
    }
    if (!queued && p.stats.multiShot > 0) {
      for (let i = 1; i <= p.stats.multiShot; i++) {
        p.queueShot(i * 85, dirX, dirY, speed, damage, life, tex, pierce, homing, flags);
      }
    }
    return b;
  },

  // n shots spread evenly over totalDeg around angle (sword waves, aura rings). sh: {damage, speed, lifetimeMs, pierce, homing, texture}
  fan(p, ctx, sh, angle, n, totalDeg) {
    const step = n > 1 ? totalDeg / (n - 1) : 0, start = angle - (totalDeg / 2) * Math.PI / 180;
    for (let i = 0; i < n; i++) {
      const a = start + i * step * Math.PI / 180;
      const b = this.shoot(p, ctx, Math.cos(a), Math.sin(a), sh.speed, Math.round(sh.damage * p.stats.damageMul), sh.lifetimeMs, sh.texture);
      if (b) { b.pierceLeft = sh.pierce || 0; b.homing = sh.homing || 0; }
    }
  },

  shoot(p, ctx, dirX, dirY, speed, damage, lifetimeMs, texture) {
    const off = p.stats.size * 0.7;
    return ctx.playerBullets.fire(
      p.sprite.x + dirX * off, p.sprite.y + dirY * off,
      dirX, dirY, speed, damage, lifetimeMs, p, texture
    );
  },

  inArc(px, py, ax, ay, x, y, reach, cosHalf, innerRadius) {
    const dx = x - px, dy = y - py;
    const dist = Math.sqrt(dx * dx + dy * dy) || 0.001;
    if (dist > reach) return false;
    if (dist < innerRadius) return true;
    return (dx * ax + dy * ay) / dist >= cosHalf;
  },

  // Hits enemies in the arc in front of the player.
  // h: { damage, range, arcDeg, knockback, knockbackMs, stunMs?, maxTargets? }
  // parry: reflect bullets + bonus vs dashing enemies. w: weapon state (for ramp).
  meleeArc(p, h, ctx, parry, w) {
    const px = p.sprite.x, py = p.sprite.y;
    const ax = p.input.aimX, ay = p.input.aimY;
    const cosHalf = Math.cos((Math.min(h.arcDeg, 359.9) / 2) * Math.PI / 180);
    const inner = p.stats.size;
    const wd = w ? w.def : null;

    // Collect targets (closest first if limited)
    const t = this._targets;
    t.length = 0;
    const list = ctx.enemies.targets();
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      if (!e.active) continue;
      if (this.inArc(px, py, ax, ay, e.x, e.y, h.range + e.def.size / 2, cosHalf, inner)) t.push(e);
    }
    const max = h.maxTargets || (h === wd ? wd.maxTargets : 0) || 0;
    if (max && t.length > max) {
      t.sort((a, b) => ((a.x - px) * (a.x - px) + (a.y - py) * (a.y - py)) - ((b.x - px) * (b.x - px) + (b.y - py) * (b.y - py)));
      t.length = max;
    }

    // Ramp (2nd Martial Arts Scroll): same target again = stronger
    let rampMul = 1;
    if (w && wd && wd.ramp && t.length > 0) {
      if (w.rampTarget && t.indexOf(w.rampTarget) !== -1 && w.rampTarget.active) w.rampStacks++;
      else { w.rampTarget = t[0]; w.rampStacks = 0; }
      w.rampMs = wd.ramp.resetMs;
      rampMul = 1 + Math.min(wd.ramp.max, w.rampStacks * wd.ramp.perHit);
    }

    let base = h.damage * p.stats.damageMul * rampMul;
    if (wd && wd.rage) base *= 1 + wd.rage * (1 - p.hp / p.stats.maxHp);   // Berserker: stronger the more hurt you are
    // melee vs bosses: every melee weapon hits bosses harder (+25%), swords more (bossMul)
    const bossMul = wd ? (wd.bossMul || (wd.class === 'melee' ? 1.25 : 1)) : 1;
    for (let i = 0; i < t.length; i++) {
      const e = t[i];
      let dmg = base;
      if (parry && (e.state === 'dash' || e.dashGraceMs > 0)) dmg *= (h.parryDamageMul || 2);
      if (wd && wd.execute && e.maxHp > 0 && e.hp / e.maxHp < wd.execute.below) dmg *= (e.isBossPart || (e.def && (e.def.boss || e.def.bossPart)) || e.champion) ? wd.execute.bossMul : wd.execute.mul;
      if (wd && wd.bleedBonus && e.bleedMs > 0) dmg *= 1 + wd.bleedBonus;
      if (bossMul !== 1 && GearFx.isBoss(e)) dmg *= bossMul;
      const dx = e.x - px, dy = e.y - py;
      const len = Math.sqrt(dx * dx + dy * dy) || 1;
      ctx.hitEnemy(e, Math.round(dmg), dx / len, dy / len, h.knockback, h.knockbackMs, p);
      if (h.stunMs && e.active && ctx.stunEnemy) ctx.stunEnemy(e, h.stunMs);
      // Hunter Knife: chance to Injure (bleed + slow)
      if (h.injure && e.active && !e.isBossPart && Math.random() < h.injure.chance) {
        const inj = h.injure;
        ctx.enemies.bleed(e, inj.bleedMs, Math.max(1, Math.round(inj.bleedTick * p.stats.damageMul)), p);
        ctx.enemies.slow(e, inj.slowMs, inj.slowPct);
      }
    }

    if (!parry) return;
    this.reflectShots(p, ctx, h, h.range + 12, cosHalf);
  },

  // Sends enemy shots in front of you back where you aim (parry / dash-attack). Returns how many.
  reflectShots(p, ctx, h, range, cosHalf) {
    const px = p.sprite.x, py = p.sprite.y, ax = p.input.aimX, ay = p.input.aimY, inner = p.stats.size;
    const bl = ctx.enemyBullets.group.getChildren();
    let n = 0;
    for (let i = 0; i < bl.length; i++) {
      const b = bl[i];
      if (!b.active) continue;
      if (!this.inArc(px, py, ax, ay, b.x, b.y, range, cosHalf, inner + 10)) continue;
      const x = b.x, y = b.y, dmg = Math.round(b.damage * (h.reflectDamageMul || 1.5) * p.stats.damageMul);
      ctx.enemyBullets.kill(b);
      const rb = ctx.playerBullets.fire(x, y, ax, ay, h.reflectSpeed || 620, dmg, 1200, p, 'reflect');
      if (rb) rb.reflected = true;          // some enemies take extra damage from their own shots (King Inkblot)
      n++;
    }
    return n;
  },

  // Returns 'parry', 'block' or null for a hit coming from (srcX, srcY).
  checkShield(p, srcX, srcY) {
    const w = p.weapon;
    if (!w || w.def.kind !== 'shield' || !w.raised) return null;
    const d = w.def;
    const dx = srcX - p.sprite.x, dy = srcY - p.sprite.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > 1) {
      const cos = (dx * p.input.aimX + dy * p.input.aimY) / dist;
      if (cos < Math.cos((d.arcDeg / 2) * Math.PI / 180)) return null;
    }
    return w.raiseMs <= d.parryWindowMs * p.stats.parryWindowMul ? 'parry' : 'block';
  }
};
