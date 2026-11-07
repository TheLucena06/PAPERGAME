/* meta.js
   Progress that lasts between runs (stored through SaveData, see save.js):

   SHAVINGS: the Pencil Case currency. Earned during a run (levels, arenas,
   champions, mimics, bosses, winning) and saved right away, so dying or
   closing the tab never loses them. Spent on UPGRADE_TYPES in the Pencil Case.

   UPGRADE_TYPES (data): permanent upgrades. ranks = how many times it can be
   bought, cost[i] = price of rank i+1, needs = { upgradeId: rank } that must
   be owned first. Effects are read where they matter through Meta.rank(id).

   BLUEPRINT_TYPES (data): a found blueprint adds its items to the shops for
   every future run (items have blueprint: 'id'). from = what can drop it,
   chance per source in BLUEPRINT_DROP. Bosses always drop one if any is left. */

const SHAVINGS_EARN = {
  level: 2,          // a level cleared (its hatch taken)
  arena: 4,          // an arena survived / its champion beaten
  champion: 3,
  mimic: 4,
  bossBase: 10,      // + bossPerStage x stage number
  bossPerStage: 5,
  win: 20
};

const UPGRADE_TYPES = {
  // ---- Survival (red) ----
  thickPaper:   { branch: 'survival', name: 'Thick Paper',   ranks: 3, cost: [20, 40, 70],
                  desc: (r) => '+8 max HP per rank.' + (r ? '  Now: +' + 8 * r : '') },
  sparePotion:  { branch: 'survival', name: 'Spare Potion',  ranks: 2, cost: [30, 60],
                  desc: () => 'Start every run with +1 Health Potion per rank.' },
  secondWind:   { branch: 'survival', name: 'Second Wind',   ranks: 2, cost: [40, 80], needs: { thickPaper: 2 },
                  desc: () => 'Clearing a room heals +5% more per rank.' },
  eraser:       { branch: 'survival', name: 'Eraser',        ranks: 1, cost: [90], needs: { thickPaper: 1 },
                  desc: () => 'Once per run, a hit that would knock you out leaves you at 30% HP instead.' },
  // ---- Wealth (gold) ----
  pocketMoney:  { branch: 'wealth', name: 'Pocket Money',    ranks: 3, cost: [15, 30, 50],
                  desc: (r) => 'Start every run with +15 coins per rank.' + (r ? '  Now: +' + 15 * r : '') },
  luckyDice:    { branch: 'wealth', name: 'Lucky Dice',      ranks: 1, cost: [45],
                  desc: () => 'The first reroll in every shop is free.' },
  piggyBank:    { branch: 'wealth', name: 'Piggy Bank',      ranks: 2, cost: [50, 100], needs: { pocketMoney: 1 },
                  desc: () => 'Entering a shop: +1 coin for every 10 you carry (max 8, rank 2: max 15).' },
  merchantFriend: { branch: 'wealth', name: "Merchant's Friend", ranks: 2, cost: [40, 80], needs: { pocketMoney: 1 },
                  desc: () => 'Merchant orders cost x1.15 (rank 2: x1.0) instead of x1.3.' },
  supplyRun:    { branch: 'wealth', name: 'Supply Run',      ranks: 1, cost: [80], needs: { pocketMoney: 2 },
                  desc: () => 'Every run starts with a visit to the shop.' },
  // ---- Discovery (blue) ----
  tracingPaper: { branch: 'discovery', name: 'Tracing Paper', ranks: 2, cost: [35, 70],
                  desc: () => 'Blueprints drop 25% more often per rank.' },
  treasureSense:{ branch: 'discovery', name: 'Treasure Sense', ranks: 1, cost: [50],
                  desc: () => 'Treasure rooms show up more often (85%) and fewer chests bite (50%).' },
  graphitePact: { branch: 'discovery', name: 'Graphite Pact', ranks: 1, cost: [40],
                  desc: () => 'Shrines only take 15% of your max HP.' },
  biggerMenu:   { branch: 'discovery', name: 'Bigger Menu',   ranks: 1, cost: [60], needs: { tracingPaper: 1 },
                  desc: () => 'Free buff picks show 4 choices instead of 3.' }
};

const UPGRADE_BRANCHES = [
  { id: 'survival',  name: 'Survival',  color: 0xc62828, text: '#c62828' },
  { id: 'wealth',    name: 'Wealth',    color: 0xb28704, text: '#9a7400' },
  { id: 'discovery', name: 'Discovery', color: 0x1565c0, text: '#1565c0' }
];

const BLUEPRINT_TYPES = {
  flamberge:    { name: 'Flamberge',     from: ['champion', 'mimic', 'boss'] },
  recurveBow:   { name: 'Recurve Bow',   from: ['champion', 'mimic', 'boss'] },
  boomerang:    { name: 'Boomerang',     from: ['champion', 'mimic', 'boss'] },
  ironKnuckles: { name: 'Iron Knuckles', from: ['champion', 'mimic', 'boss'] },
  gnome:        { name: 'Gnome Gear',    from: ['gnome'] }
};

const BLUEPRINT_DROP = { champion: 0.35, mimic: 0.5, boss: 1, gnome: 0.07 };

const Meta = {
  data() {
    const d = SaveData.data;
    if (!d.meta) d.meta = { shavings: 0, total: 0, upgrades: {} };
    return d.meta;
  },

  // Off in the Test Dungeon (GameScene sets Meta.off) so tests stay predictable.
  off: false,
  rank(id) { return this.off ? 0 : (this.data().upgrades[id] | 0); },
  owned(id) { return this.data().upgrades[id] | 0; },     // for the Pencil Case (ignores off)

  shavings() { return this.data().shavings; },
  earn(n) {
    if (this.off || !n) return 0;
    const m = this.data();
    m.shavings += n; m.total += n;
    SaveData.save();
    return n;
  },

  // '' if it can be bought, otherwise why not
  whyNot(id) {
    const u = UPGRADE_TYPES[id], r = this.owned(id);
    if (r >= u.ranks) return 'Maxed';
    if (u.needs) for (const k in u.needs) if (this.owned(k) < u.needs[k]) return 'Needs ' + UPGRADE_TYPES[k].name + ' ' + u.needs[k];
    if (this.shavings() < u.cost[r]) return 'Not enough shavings';
    return '';
  },
  buy(id) {
    if (this.whyNot(id)) return false;
    const m = this.data(), u = UPGRADE_TYPES[id], r = this.owned(id);
    m.shavings -= u.cost[r];
    m.upgrades[id] = r + 1;
    SaveData.save();
    return true;
  },
  // Everything back (to try other builds)
  refundAll() {
    const m = this.data();
    let back = 0;
    for (const id in m.upgrades) { const u = UPGRADE_TYPES[id]; if (!u) continue; for (let i = 0; i < m.upgrades[id]; i++) back += u.cost[i]; }
    m.upgrades = {}; m.shavings += back;
    SaveData.save();
    return back;
  },
  spent() {
    const m = this.data();
    let n = 0;
    for (const id in m.upgrades) { const u = UPGRADE_TYPES[id]; if (u) for (let i = 0; i < m.upgrades[id]; i++) n += u.cost[i]; }
    return n;
  },

  /* ---- effects (read by the game) ---- */
  playerMods() { const r = this.rank('thickPaper'); return r ? { maxHp: 8 * r } : null; },
  startPotions() { return 1 + this.rank('sparePotion'); },
  startCoins() { return 15 * this.rank('pocketMoney'); },
  roomHealBonus() { return 5 * this.rank('secondWind'); },
  piggyBank(coins) { const r = this.rank('piggyBank'); return r ? Math.min(r > 1 ? 15 : 8, Math.floor(coins / 10)) : 0; },
  merchantOrderMul() { return [SPECIAL_ROOMS.merchant.orderMul, 1.15, 1.0][this.rank('merchantFriend')]; },
  shrineHpPct() { return this.rank('graphitePact') ? 15 : SPECIAL_ROOMS.shrineHpPct; },
  treasureChance() { return this.rank('treasureSense') ? 0.85 : 0.6; },
  mimicChance() { return this.rank('treasureSense') ? 0.5 : 0.7; },

  /* ---- blueprints ---- */
  // A blueprint id that this source drops right now, or null.
  rollBlueprint(source) {
    if (this.off) return null;
    const left = [];
    for (const id in BLUEPRINT_TYPES) if (!SaveData.hasBlueprint(id) && BLUEPRINT_TYPES[id].from.indexOf(source) !== -1) left.push(id);
    if (!left.length) return null;
    const chance = Math.min(1, (BLUEPRINT_DROP[source] || 0) * (1 + 0.25 * this.rank('tracingPaper')));
    if (Math.random() >= chance) return null;
    return left[Math.floor(Math.random() * left.length)];
  },
  // Item names a blueprint adds to the shops.
  blueprintItems(id) {
    const out = [];
    const cats = ['weapon', 'armor', 'skill', 'consumable'];
    for (let c = 0; c < cats.length; c++) {
      const t = Catalog.table(cats[c]);
      for (const k in t) if (t[k].blueprint === id) out.push(t[k].name);
    }
    return out;
  }
};
