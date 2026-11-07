/* items.js
   Data: classes, ARMOR_TYPES, CONSUMABLE_TYPES, EFFECT_TYPES, PASSIVE_BUFFS.
   Helpers: Catalog (look up any item by category + id) and Stats (builds a
   player's final stats from base stats + weapon + armor + buffs + effects).

   Every item has a main class (arcane / melee / precision / shield), a sub
   class (e.g. "Knight", "Monk") and weapons also have a type (e.g. "sword",
   "fist"). Bonuses are written on each item:
     mods:      always active, e.g. { maxHp: 20, damageMul: 0.1 }
     classMods: active only while HOLDING a matching weapon. Each entry can
                match class, sub and/or type, e.g.
                [{ class: 'melee', mods: { damageMul: 0.15 } },
                 { sub: 'Monk', mods: { attackSpeedMul: 0.15 } },
                 { type: 'sword', mods: { damageMul: 0.2 } }]
   Stat keys ending in "Mul" start at 1 and add up (0.1 = +10%).
   minLevel = first shop it can appear in (shop after clearing that level).
   postBoss: N = only after N bosses were beaten (POST_BOSS_1 = after boss 1).
   blueprint: 'id' = only in shops once that blueprint was found (see meta.js).
   bossItem: 'bookworm' = boss loot: only in the shop right after beating
   that boss (all of its loot is offered at once). */

const POST_BOSS_1 = 1;
const POST_BOSS_2 = 2;   // every boss unlocks a stronger tier for every sub class (more tiers come with more stages)

const STAT_DEFAULTS = {
  damageMul: 1,         // all weapon/skill damage
  attackSpeedMul: 1,    // weapon cooldowns are divided by this
  manaCostMul: 1,       // weapon + skill mana costs
  chargeSpeedMul: 1,    // bow charge speed
  damageTakenMul: 1,
  moveSpeedMul: 1,
  dashCooldownMul: 1,
  parryWindowMul: 1,
  skillCooldownMul: 1,
  manaRegenMul: 1,
  blockBonus: 0,        // added to a shield's block %
  defense: 0,           // % of damage blocked (0.2 = 20%), capped at 60%
  critChance: 0,        // chance for 2x damage
  dodgeChance: 0,       // chance to ignore a hit of up to 25% max HP
  coinMul: 0,           // extra coins (0.5 = +50%)
  stunOnHit: 0,         // 1 = enemies that hit you get stunned (Amulet Robe)
  amuletDash: 0,        // 1 = dashing gives the Amulet Rush effect
  multiShot: 0,         // extra arrows per shot (Extra Loaded)
  mercury: 0,           // 1 = arrows slow enemies (Mercury Dip)
  axeReturn: 0,         // 1 = tomahawks come back almost instantly (hunting gear)
  stealthRange: 0,      // > 0 = enemies only notice you within this many pixels (Camo Cloak)
  stillDamage: 0,       // extra damage while standing still (Camo Cloak)
  mineCoins: 1,         // coins from a broken block x this (Miner's Helmet)
  mineHeal: 0,          // HP back for every block you break
  inklingChance: 0      // chance that a kill makes a friendly ink drop (Inkblot Crown)
};

const DEFENSE_CAP = 0.6;
const DODGE_MAX_HIT_PCT = 0.25;   // dodge only works on hits up to 25% of max HP
const CRIT_MULTIPLIER = 2;

const CLASS_NAMES = { arcane: 'Arcane', melee: 'Melee', precision: 'Precision', boss: 'Boss' };
const CLASS_COLORS = { arcane: '#7e57c2', melee: '#c62828', precision: '#2e7d32', boss: '#6a1b9a' };
const BOSS_LOOT_COLOR = 0x6a1b9a;

const ARMOR_TYPES = {
  // King Inkblot loot
  inkCrown: {
    name: 'Inkblot Crown', short: 'CRWN', class: 'boss', sub: 'Inkblot', price: 90, bossItem: 'kingInkblot',
    desc: '+20 max HP. Defense 8%. Every kill has a\n30% chance to drip a friendly ink drop that\nfights for you for 9 s (max 4).',
    mods: { maxHp: 20, defense: 0.08, inklingChance: 0.3 }
  },
  // Secret Gnome kit (later a blueprint): weak, but great at mining
  minerHelmet: {
    name: "Miner's Helmet", short: 'MINE', class: 'melee', sub: 'Miner', price: 30, blueprint: 'gnome',
    desc: 'Defense 4%. Broken blocks drop 2 coins\ninstead of 1 and heal 1 HP.\n+10% Miner damage.',
    mods: { defense: 0.04, mineCoins: 1, mineHeal: 1 }, classMods: [{ sub: 'Miner', mods: { damageMul: 0.10 } }]
  },
  /* ---- Knight ---- */
  knightArmor: {
    name: 'Knight Armor', short: 'KNGT', class: 'melee', sub: 'Knight', price: 40, minLevel: 2,
    desc: 'High defense (20%).\nWhile holding a Melee weapon:\n+12% speed, +15% damage.',
    mods: { defense: 0.20 }, classMods: [{ class: 'melee', mods: { moveSpeedMul: 0.12, damageMul: 0.15 } }]
  },
  blacksmithArmor: {
    name: 'Blacksmith Armor', short: 'SMTH', class: 'melee', sub: 'Knight', price: 85, postBoss: POST_BOSS_1,
    desc: 'Defense 28%. Skills recharge 20% faster.\nSword attacks +20% damage.\nKnight weapons attack 20% faster.',
    mods: { defense: 0.28, skillCooldownMul: -0.20 },
    classMods: [{ type: 'sword', mods: { damageMul: 0.20 } }, { sub: 'Knight', mods: { attackSpeedMul: 0.20 } }]
  },
  princeArmor: {
    name: 'Prince Armor', short: 'PRNC', class: 'melee', sub: 'Knight', price: 110, postBoss: POST_BOSS_1,
    desc: 'Very high defense (35%).\n+50% coins from every source.',
    mods: { defense: 0.35, coinMul: 0.5 }
  },
  /* ---- Monk ---- */
  monkVest: {
    name: 'Monk Vest', short: 'VEST', class: 'melee', sub: 'Monk', price: 35, minLevel: 2,
    desc: 'Low defense (5%). +20% attack speed\n(+35% with Monk weapons). 15% dodge.\n+25 max mana, +30% mana regen.',
    mods: { defense: 0.05, attackSpeedMul: 0.20, dodgeChance: 0.15, maxMana: 25, manaRegenMul: 0.30 },
    classMods: [{ sub: 'Monk', mods: { attackSpeedMul: 0.15 } }]
  },
  amuletRobe: {
    name: 'Amulet Robe', short: 'AMLT', class: 'melee', sub: 'Monk', price: 95, postBoss: POST_BOSS_1,
    desc: 'Def 15%, dodge 20%, +40 mana, +60% regen.\n+20% atk speed (Monk: +35%, +20% dmg).\nDash: 3 s rush. Enemies that hit you\nget stunned (less if tanky).',
    mods: { defense: 0.15, dodgeChance: 0.20, maxMana: 40, manaRegenMul: 0.60, attackSpeedMul: 0.20, amuletDash: 1, stunOnHit: 1 },
    classMods: [{ sub: 'Monk', mods: { attackSpeedMul: 0.15, damageMul: 0.20 } }]
    // Sound note: special hit sound when wearing the Amulet Robe.
  },
  /* ---- Precision · Archer ---- */
  archerRobes: {
    name: 'Training Archer Robes', short: 'TARB', class: 'precision', sub: 'Archer', price: 40, minLevel: 2,
    desc: 'Defense 12%. Bows and crossbows load 25%\nfaster. Precision weapons +15% damage.',
    mods: { defense: 0.12, chargeSpeedMul: 0.25 }, classMods: [{ class: 'precision', mods: { damageMul: 0.15 } }]
  },
  agilityCloak: {
    name: 'Agility Cloak', short: 'AGIL', class: 'precision', sub: 'Archer', price: 85, postBoss: POST_BOSS_1,
    desc: 'Defense 8%. Dash -30% and skills -25% cooldown.\n+30 max mana, +15% attack speed.\nPrecision weapons +20% damage.',
    mods: { defense: 0.08, dashCooldownMul: -0.30, skillCooldownMul: -0.25, maxMana: 30, attackSpeedMul: 0.15, chargeSpeedMul: 0.15 },
    classMods: [{ class: 'precision', mods: { damageMul: 0.20 } }]
  },
  dragonHide: {
    name: 'Dragon Hide Cloak', short: 'DRGH', class: 'precision', sub: 'Archer', price: 110, postBoss: POST_BOSS_1,
    desc: 'High dodge (25%), defense 22%.\n+20% damage with every weapon.',
    mods: { dodgeChance: 0.25, defense: 0.22, damageMul: 0.20 }
  },
  /* ---- Precision · Hunter ---- */
  apprenticeHunting: {
    name: 'Apprentice Hunting Gear', short: 'APHG', class: 'precision', sub: 'Hunter', price: 40, minLevel: 2,
    desc: 'Defense 10%. Hunter weapons +20% damage.\nTomahawks come back almost instantly.',
    mods: { defense: 0.10, axeReturn: 1 }, classMods: [{ sub: 'Hunter', mods: { damageMul: 0.20 } }]
  },
  camoCloak: {
    name: 'Camo Cloak', short: 'CAMO', class: 'precision', sub: 'Hunter', price: 90, postBoss: POST_BOSS_1,
    desc: 'Enemies must be much closer to notice you.\nDefense 15%, +10% speed. Hunter weapons +20%\ndamage, +30% more while standing still.',
    mods: { stealthRange: 240, defense: 0.15, moveSpeedMul: 0.10 },
    classMods: [{ sub: 'Hunter', mods: { damageMul: 0.20, stillDamage: 0.30 } }]
  },
  soloHunting: {
    name: 'Solo Hunting Gear', short: 'SOLO', class: 'precision', sub: 'Hunter', price: 95, postBoss: POST_BOSS_1,
    desc: 'Defense 22%. Reload/loading 30% faster.\nHunter weapons +30% damage. Tomahawks\ncome back almost instantly.',
    mods: { defense: 0.22, chargeSpeedMul: 0.30, axeReturn: 1 }, classMods: [{ sub: 'Hunter', mods: { damageMul: 0.30 } }]
  },

  /* ---- placeholders (to be remade) ---- */
  mageRobe: {
    name: 'Mage Robe', short: 'ROBE', class: 'arcane', sub: 'Mage', price: 30,
    desc: '+30 max mana.\nArcane weapons cost 25% less mana.',
    mods: { maxMana: 30 }, classMods: [{ class: 'arcane', mods: { manaCostMul: -0.25 } }]
  }
};

// Timed effects (from consumables and armor abilities). Same mods format.
const EFFECT_TYPES = {
  sharpened:  { name: 'Sharpened', durationMs: 60000,
                classMods: [{ class: 'melee', mods: { damageMul: 0.20, critChance: 0.10 } }] },
  manaCandle: { name: 'Mana Candle', durationMs: 60000,
                mods: { manaCostMul: -0.20 }, classMods: [{ sub: 'Monk', mods: { manaCostMul: -0.10 } }] },
  extraLoaded: { name: 'Extra Loaded', durationMs: 10000, mods: { multiShot: 2 } },
  mercury:     { name: 'Mercury Dip', durationMs: 60000,
                 classMods: [{ class: 'precision', mods: { damageMul: 0.12, mercury: 1 } }] },
  flurryGuard: { name: 'Onslaught', durationMs: 850, mods: { damageTakenMul: -0.30 } },
  amuletRush: { name: 'Amulet Rush', durationMs: 3000,
                mods: { moveSpeedMul: 0.20, dodgeChance: 0.15, attackSpeedMul: 0.20 } }
};

const CONSUMABLE_TYPES = {
  healthPotion: {
    name: 'Health Potion', short: 'HP+', price: 12, amount: 1, kind: 'heal', healPct: 35,
    desc: 'Restores 35% of max HP.'
  },
  manaPotion: {
    name: 'Mana Potion', short: 'MP+', price: 8, amount: 1, kind: 'mana', manaPct: 100,
    desc: 'Fully restores mana.'
  },
  bomb: {
    name: 'Paper Bomb', short: 'BOMB', price: 10, amount: 2, kind: 'bomb',
    damage: 50, radius: 90, speed: 380, fuseMs: 650,
    desc: 'Thrown toward your aim, explodes\nfor 50 damage. You get 2.'
  },
  sharpeningStone: {
    name: 'Sharpening Stone', short: 'STON', price: 15, amount: 1, kind: 'effect', effect: 'sharpened',
    class: 'melee', sub: 'Any',
    desc: '60 s: Melee attacks +20% damage\nand 10% chance to crit (2x).'
  },
  pocketSand: {
    name: 'Pocket Sand', short: 'SAND', price: 14, amount: 2, kind: 'sand', targets: 3, stunMs: 4000, radius: 320,
    class: 'melee', sub: 'Monk',
    desc: 'Stuns the 3 nearest enemies for 4 s.\nYou get 2.'
  },
  mercuryDip: {
    name: 'Mercury Dip', short: 'MERC', price: 14, amount: 1, kind: 'effect', effect: 'mercury',
    class: 'precision', sub: 'Archer',
    desc: '60 s: arrows and bolts deal +12% damage and\nslow enemies (movement and attacks).'
  },
  bearTrap: {
    name: 'Bear Trap', short: 'TRAP', price: 16, amount: 2, kind: 'trap',
    class: 'precision', sub: 'Hunter',
    damage: 90, stunMs: 1800, slowMs: 4000, slowPct: 0.35,
    desc: 'Set at your feet. The first enemy to step on it\ntakes 90, is stunned, then slowed. You get 2.'
  },
  manaCandle: {
    name: 'Mana Candle', short: 'CNDL', price: 14, amount: 1, kind: 'effect', effect: 'manaCandle',
    class: 'melee', sub: 'Monk',
    desc: '60 s: mana costs -30% for Monks,\n-20% for everyone else.'
  }
};

const PASSIVE_BUFFS = {
  thickPaper:   { name: 'Thick Paper',   desc: '+20 max HP.',                   mods: { maxHp: 20 } },
  sharpEdges:   { name: 'Sharp Edges',   desc: '+12% damage.',                  mods: { damageMul: 0.12 } },
  lightFeet:    { name: 'Light Feet',    desc: '+10% move speed.',              mods: { moveSpeedMul: 0.10 } },
  deepInkwell:  { name: 'Deep Inkwell',  desc: '+25 max mana.',                 mods: { maxMana: 25 } },
  inkFlow:      { name: 'Ink Flow',      desc: '+30% mana regeneration.',       mods: { manaRegenMul: 0.30 } },
  quickHands:   { name: 'Quick Hands',   desc: '+12% attack speed.',            mods: { attackSpeedMul: 0.12 } },
  foldedTwice:  { name: 'Folded Twice',  desc: '+8% defense.',                  mods: { defense: 0.08 } },
  paperPlane:   { name: 'Paper Plane',   desc: 'Dash recharges 25% faster.',    mods: { dashCooldownMul: -0.25 } },
  focus:        { name: 'Focus',         desc: 'Skills recharge 20% faster.',   mods: { skillCooldownMul: -0.20 } },
  luckyFold:    { name: 'Lucky Fold',    desc: '5% chance to crit (2x).',       mods: { critChance: 0.05 } },
  runeInk:      { name: 'Rune Ink',      desc: 'Arcane weapons: +20% damage.',  classMods: [{ class: 'arcane', mods: { damageMul: 0.20 } }] },
  whetstone:    { name: 'Whetstone',     desc: 'Melee weapons: +20% damage.',   classMods: [{ class: 'melee', mods: { damageMul: 0.20 } }] },
  steadyAim:    { name: 'Steady Aim',    desc: 'Precision weapons charge 20% faster.', classMods: [{ class: 'precision', mods: { chargeSpeedMul: 0.20 } }] },
  brace:        { name: 'Brace',         desc: 'Shields block 20% more damage.', classMods: [{ type: 'shield', mods: { blockBonus: 0.20 } }] }
};

const Catalog = {
  table(cat) {
    if (cat === 'weapon') return WEAPON_TYPES;
    if (cat === 'armor') return ARMOR_TYPES;
    if (cat === 'skill') return SKILL_TYPES;
    if (cat === 'consumable') return CONSUMABLE_TYPES;
    if (cat === 'buff') return PASSIVE_BUFFS;
    return null;
  },
  get(cat, id) {
    const t = this.table(cat);
    return (t && id) ? t[id] || null : null;
  },
  classLine(def) {
    if (!def || !def.class) return '';
    let s = CLASS_NAMES[def.class] + ' · ' + def.sub;
    if (def.type) s += ' · ' + def.type.charAt(0).toUpperCase() + def.type.slice(1);
    return s;
  },
  nameStyle(def) {
    return def && def.italic ? 'bold italic' : 'bold';
  }
};

const Stats = {
  addMods(s, mods) {
    if (!mods) return;
    for (const k in mods) s[k] = (s[k] || 0) + mods[k];
  },

  matches(cond, w) {
    if (!w) return false;
    if (cond.class && cond.class !== w.class) return false;
    if (cond.sub && cond.sub !== w.sub) return false;
    if (cond.type && cond.type !== w.type) return false;
    return true;
  },

  addSource(s, def, weaponDef) {
    if (!def) return;
    this.addMods(s, def.mods);
    if (def.classMods && weaponDef) {
      for (let i = 0; i < def.classMods.length; i++) {
        if (this.matches(def.classMods[i], weaponDef)) this.addMods(s, def.classMods[i].mods);
      }
    }
  },

  // Final stats for a player. Only runs when equipment/effects change, not every frame.
  build(player) {
    const s = Object.assign({}, PLAYER_BASE_STATS, STAT_DEFAULTS);
    const wd = player.weapon ? player.weapon.def : null;
    if (wd) this.addSource(s, wd, wd);
    this.addSource(s, Catalog.get('armor', player.armor), wd);
    for (let i = 0; i < player.buffs.length; i++) this.addSource(s, Catalog.get('buff', player.buffs[i]), wd);
    for (let i = 0; i < player.effects.length; i++) this.addSource(s, EFFECT_TYPES[player.effects[i].id], wd);
    if (player.metaMods) this.addMods(s, player.metaMods);   // Pencil Case upgrades

    s.moveSpeed *= s.moveSpeedMul;
    s.dashCooldownMs *= Math.max(0.3, s.dashCooldownMul);
    s.damageTakenMul = Math.max(0.3, s.damageTakenMul);
    s.defense = Math.min(DEFENSE_CAP, s.defense);
    s.skillCooldownMul = Math.max(0.3, s.skillCooldownMul);
    s.manaCostMul = Math.max(0.2, s.manaCostMul);
    s.maxHp = Math.round(s.maxHp);
    s.maxMana = Math.round(s.maxMana);
    return s;
  },

  // How many of a player's equipped items have this sub class (for Lunge).
  countSub(player, sub) {
    let n = 0;
    for (let i = 0; i < 2; i++) { const d = Catalog.get('weapon', player.weapons[i]); if (d && d.sub === sub) n++; }
    const a = Catalog.get('armor', player.armor); if (a && a.sub === sub) n++;
    for (let i = 0; i < 2; i++) { const d = Catalog.get('skill', player.skills[i]); if (d && d.sub === sub) n++; }
    return n;
  }
};
