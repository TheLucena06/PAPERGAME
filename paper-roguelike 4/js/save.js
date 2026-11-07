/* save.js
   SaveData: progress that survives closing the game (unlocked kits,
   bestiary, a few run stats). Stored in the browser's localStorage, which
   works on file:// in Chrome/Edge, but belongs to ONE browser on ONE PC.
   Lab PCs may wipe it at logout, so the main menu also has "Export save"
   (downloads a small .json file, e.g. to the USB stick) and "Import save".
   No network is used for any of this.

   KIT_TYPES (data) + Kits: unlockable starter kits. A kit unlocks when, in
   one run, every slot is filled with items of that sub class (see Kits.check). */

const SAVE_KEY = 'papergame.save.v1';

const SaveData = {
  data: null,
  dirty: false,
  ok: true,          // false if this browser blocks localStorage (then progress lasts until the tab closes)

  blank() {
    return { version: 1, kits: {}, bestiary: {}, blueprints: {}, stats: { runs: 0, bestLevel: 0, wins: 0 },
             meta: { shavings: 0, total: 0, upgrades: {} },
             settings: { controls: { solo: ['kbm'], coop: ['keysLeft', 'arrowsMouse'] }, pads: {}, keys: {} } };
  },

  // Fills in anything missing (older saves, hand-edited files).
  clean(d) {
    const b = this.blank();
    if (!d || typeof d !== 'object') return b;
    b.kits = (d.kits && typeof d.kits === 'object') ? d.kits : {};
    b.bestiary = (d.bestiary && typeof d.bestiary === 'object') ? d.bestiary : {};
    b.blueprints = (d.blueprints && typeof d.blueprints === 'object') ? d.blueprints : {};
    if (b.blueprints.paperCutter) { delete b.blueprints.paperCutter; b.blueprints.flamberge = true; }   // Paper Cutter was replaced
    if (d.stats && typeof d.stats === 'object') {
      b.stats.runs = d.stats.runs | 0;
      b.stats.bestLevel = d.stats.bestLevel | 0;
      b.stats.wins = d.stats.wins | 0;
    }
    if (d.meta && typeof d.meta === 'object') {
      b.meta.shavings = Math.max(0, d.meta.shavings | 0);
      b.meta.total = Math.max(0, d.meta.total | 0);
      if (d.meta.upgrades && typeof d.meta.upgrades === 'object') b.meta.upgrades = d.meta.upgrades;
    }
    const st = d.settings;
    if (st && typeof st === 'object') {
      if (st.controls && typeof st.controls === 'object') {
        if (Array.isArray(st.controls.solo)) b.settings.controls.solo = st.controls.solo.slice(0, 1);
        if (Array.isArray(st.controls.coop)) b.settings.controls.coop = st.controls.coop.slice(0, 2);
        // the old co-op default -> the new one (P2 on the arrows gets the mouse)
        if (b.settings.controls.coop.join() === 'kbm,keysRight') b.settings.controls.coop = ['keysLeft', 'arrowsMouse'];
      }
      if (st.pads && typeof st.pads === 'object') b.settings.pads = st.pads;
      if (st.keys && typeof st.keys === 'object') b.settings.keys = st.keys;
    }
    return b;
  },

  load() {
    let raw = null;
    try { raw = window.localStorage.getItem(SAVE_KEY); } catch (e) { this.ok = false; }
    let parsed = null;
    try { parsed = raw ? JSON.parse(raw) : null; } catch (e) { parsed = null; }
    this.data = this.clean(parsed);
    return this.data;
  },

  save() {
    this.dirty = false;
    try { window.localStorage.setItem(SAVE_KEY, JSON.stringify(this.data)); this.ok = true; }
    catch (e) { this.ok = false; }
  },

  flush() { if (this.dirty) this.save(); },

  reset() {
    const keep = this.data && this.data.settings;     // controls + controller setup are settings, not progress
    this.data = this.blank();
    if (keep) this.data.settings = keep;
    try { window.localStorage.removeItem(SAVE_KEY); } catch (e) { /* ignore */ }
    this.save();
  },

  /* ---- settings ---- */
  controlsFor(playerCount) { return this.data.settings.controls[playerCount > 1 ? 'coop' : 'solo']; },
  setControls(playerCount, list) { this.data.settings.controls[playerCount > 1 ? 'coop' : 'solo'] = list.slice(); this.save(); },

  /* ---- bestiary ---- */
  entry(id) {
    const b = this.data.bestiary;
    return b[id] || (b[id] = { seen: false, kills: 0 });
  },
  isKnown(id) { const e = this.data.bestiary[id]; return !!(e && e.seen); },
  // Returns true the first time this enemy is ever seen.
  seen(id) {
    const e = this.entry(id);
    if (e.seen) return false;
    e.seen = true;
    this.save();
    return true;
  },
  kill(id) { this.entry(id).kills++; this.dirty = true; },
  kills(id) { const e = this.data.bestiary[id]; return e ? e.kills : 0; },

  /* ---- blueprints: items that only enter the shops once found ---- */
  hasBlueprint(id) { return !!this.data.blueprints[id]; },
  unlockBlueprint(id) { if (this.data.blueprints[id]) return false; this.data.blueprints[id] = true; this.save(); return true; },

  /* ---- kits ---- */
  hasKit(id) { return !!this.data.kits[id]; },
  unlockKit(id) {
    if (this.data.kits[id]) return false;
    this.data.kits[id] = true;
    this.save();
    return true;
  },

  /* ---- run stats ---- */
  runStarted() { this.data.stats.runs++; this.save(); },
  reachedLevel(n) { if (n > this.data.stats.bestLevel) { this.data.stats.bestLevel = n; this.dirty = true; } },

  /* ---- export / import (a .json file the player keeps) ---- */
  exportFile() {
    this.flush();
    const blob = new Blob([JSON.stringify(this.data, null, 1)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'papergame-save.json';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  },

  // Opens a file picker. onDone(ok, message)
  importFile(onDone) {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = '.json,application/json';
    input.onchange = () => {
      const f = input.files && input.files[0];
      if (!f) return;
      const r = new FileReader();
      r.onload = () => {
        try {
          const d = JSON.parse(r.result);
          if (!d || d.version !== 1) throw new Error('not a PaperGame save');
          this.data = this.clean(d);
          this.save();
          onDone(true, 'Save loaded!');
        } catch (e) { onDone(false, 'That file is not a PaperGame save.'); }
      };
      r.readAsText(f);
    };
    input.click();
  }
};
SaveData.load();
// write pending changes (kill counts) when the tab is closed or hidden
window.addEventListener('pagehide', () => SaveData.flush());
document.addEventListener('visibilitychange', () => { if (document.hidden) SaveData.flush(); });

/* ---------------- Starter kits ----------------
   weapon + armor you start a run with. Unlock: fill every slot with items of
   `sub` (class 'Any' items of the same main class count too, e.g. the
   Sharpening Stone for Knight and Monk). If a sub class has fewer items of a
   kind than you have slots (Hunter has 1 skill), only that many are needed
   and the other slot must stay empty. */
const KIT_TYPES = {
  knight: { name: 'Knight',  class: 'melee',     sub: 'Knight', weapon: 'sword',          armor: 'knightArmor' },
  monk:   { name: 'Monk',    class: 'melee',     sub: 'Monk',   weapon: 'martialScroll1', armor: 'monkVest' },
  archer: { name: 'Archer',  class: 'precision', sub: 'Archer', weapon: 'bow',            armor: 'archerRobes' },
  hunter: { name: 'Hunter',  class: 'precision', sub: 'Hunter', weapon: 'hunterKnife',    armor: 'apprenticeHunting' },
  // secret: unlocked by the gnome (see GameScene.onGnomeFirst), not by gear
  gnome:  { name: 'Gnome',   class: 'melee',     sub: 'Miner',  weapon: 'pickaxe',        armor: 'minerHelmet', skill: 'minecart', secret: true,
            hint: 'Some say small red hats hide big secrets.' }
};

const Kits = {
  _need: null,

  fits(kit, def) {
    if (!def) return false;
    if (def.bossItem) return false;
    return def.sub === kit.sub || (def.sub === 'Any' && def.class === kit.class);
  },

  // How many items of each kind the kit needs (cached once).
  need(kitId) {
    if (!this._need) this._need = {};
    if (this._need[kitId]) return this._need[kitId];
    const kit = KIT_TYPES[kitId], slots = { weapon: 2, armor: 1, skill: 2, consumable: 1 }, out = {};
    for (const cat in slots) {
      const t = Catalog.table(cat);
      let n = 0;
      for (const id in t) if (this.fits(kit, t[id])) n++;
      out[cat] = Math.min(slots[cat], n);
    }
    return (this._need[kitId] = out);
  },

  // Does this player's loadout complete the kit?
  complete(kitId, p) {
    const kit = KIT_TYPES[kitId], need = this.need(kitId);
    const check = (cat, ids) => {
      let fit = 0;
      for (let i = 0; i < ids.length; i++) {
        if (!ids[i]) continue;
        if (!this.fits(kit, Catalog.get(cat, ids[i]))) return false;   // an item of another class
        fit++;
      }
      return fit >= need[cat];
    };
    return check('weapon', p.weapons) &&
           check('armor', [p.armor]) &&
           check('skill', p.skills) &&
           check('consumable', [p.consumableCount > 0 ? p.consumableId : null]);
  },

  // Returns the ids of kits this player just unlocked.
  check(p, out) {
    out.length = 0;
    for (const id in KIT_TYPES) {
      if (SaveData.hasKit(id) || KIT_TYPES[id].secret) continue;
      if (this.complete(id, p) && SaveData.unlockKit(id)) out.push(id);
    }
    return out;
  },

  // Text for the locked card.
  howTo(kitId) {
    const kit = KIT_TYPES[kitId], n = this.need(kitId);
    if (kit.secret) return kit.hint;
    const parts = [];
    if (n.weapon) parts.push(n.weapon + ' weapon' + (n.weapon > 1 ? 's' : ''));
    if (n.armor) parts.push('armor');
    if (n.skill) parts.push(n.skill + ' skill' + (n.skill > 1 ? 's' : ''));
    if (n.consumable) parts.push('an item');
    return 'In one run, equip only ' + kit.name + ' gear: ' + parts.join(', ') + '.';
  }
};
