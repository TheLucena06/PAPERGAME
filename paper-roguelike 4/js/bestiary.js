/* bestiary.js
   BESTIARY_ENTRIES (data, in page order) + BestiaryScene (a book: two pages
   per spread). An entry is "known" once that enemy has been seen in a run
   (SaveData.seen). Unknown entries show a dark silhouette and "(unknown)".
   Numbers come straight from ENEMY_TYPES / BOSS_TYPES, so they stay in sync.

   Entry fields: id (save key), enemy (ENEMY_TYPES id) or boss (BOSS_TYPES id),
   tag, desc, abilities(def) -> array of lines. */

const BESTIARY_ENTRIES = [
  { id: 'runner', enemy: 'runner', tag: 'Common',
    desc: 'A scrap of red paper that only knows how to run at you.',
    abilities: (d) => ['Runs straight at you and hits on touch (' + d.contactDamage + ').'] },
  { id: 'shooter', enemy: 'shooter', tag: 'Common',
    desc: 'Keeps its distance and strafes around you.',
    abilities: (d) => ['Shoots ink drops (' + d.bulletDamage + '). +1 drop every ' + d.extraShotEvery + ' levels.',
                       'Flashes before it shoots.'] },
  { id: 'charger', enemy: 'charger', tag: 'Level 2+',
    desc: 'Lines up, stops aiming at the last moment, then charges.',
    abilities: (d) => ['Charge: ' + d.dashDamage + ' damage. The red line shows where it goes.',
                       'Rests after a charge: your chance to hit back.'] },
  { id: 'tank', enemy: 'tank', tag: 'Level 2+',
    desc: 'Slow, heavy and impossible to push around.',
    abilities: (d) => ['Ground slam around itself: ' + d.attackDamage + ' damage.', 'Ignores knockback.'] },
  { id: 'gnome', enemy: 'gnome', tag: 'Rare',
    desc: 'Small. Fast. Rude. Weaves at you, stabs, and runs off laughing.',
    abilities: (d) => ['Stab dash: ' + d.dashDamage + ' damage. Touch: ' + d.contactDamage + '.', 'Runs away after every stab.'] },
  { id: 'bookworm', boss: 'bookworm', tag: 'BOSS · after level 3',
    desc: 'Devourer of Pages. Swims under the floor and through the walls.',
    abilities: (b) => ['Red cracks show where it bursts out.',
                       'Killing a body segment SPLITS it into two worms.',
                       'Bites: head ' + b.contact.head + ', body ' + b.contact.body + '. Spits ink (' + b.spit.damage + ').'] },
  { id: 'bomber', enemy: 'bomber', tag: 'After boss 1',
    desc: 'Throws bombs over walls at where you stand.',
    abilities: (d) => ['Direct hit: ' + d.bomb.directDamage + ' + blast.',
                       'Missed bombs blink on the floor, then explode (' + d.bomb.damage + ').'] },
  { id: 'prisoners', enemy: 'prisoner', tag: 'After boss 1 · pair',
    desc: 'Two prisoners, one chain. The chain wraps around walls.',
    abilities: (d) => ['Line up in front of you, flash, then run through you: the chain sweeps across you (' + ENEMY_TYPES.prisoners.chain.damage + ').',
                       'When one dies, the other swings the chain like a flail (' + ENEMY_TYPES.prisoners.chain.flailDamage + ').'] },
  { id: 'bigInkblob', enemy: 'bigInkblob', tag: 'After boss 1',
    desc: 'A big wobbly square of ink.',
    abilities: (d) => ['Hops at you (' + d.contactDamage + ').', 'Splits into 2 Inkblobs when killed.'] },
  { id: 'inkblob', enemy: 'inkblob', tag: 'After boss 1',
    desc: 'Medium ink. Still splits.',
    abilities: (d) => ['Hops at you (' + d.contactDamage + ').', 'Splits into 2 Ink Drops when killed.'] },
  { id: 'inkdrop', enemy: 'inkdrop', tag: 'After boss 1',
    desc: 'The smallest, fastest bit of ink.',
    abilities: (d) => ['Runs at you (' + d.contactDamage + ').'] },
  { id: 'gale', enemy: 'gale', tag: 'After boss 1',
    desc: 'A little whirlwind. It does no damage itself.',
    abilities: (d) => ['Pulls you toward it from far away, strongest up close.',
                       'Walking out is slow: dash out of it.'] },
  { id: 'warlock', enemy: 'warlock', tag: 'After boss 1',
    desc: 'Pyre Acolyte. Gets close and breathes fire.',
    abilities: (d) => ['Fire cone (' + d.fire.arcDeg + '°): ' + d.fire.damage + ' + Burning.',
                       'Shows the cone first and stops aiming just before.'] },
  { id: 'fireWarlock', enemy: 'fireWarlock', tag: 'ELITE · after boss 1',
    desc: 'Pyre Warlock. Leader of the Acolytes.',
    abilities: (d) => ['From far away: ' + d.arc.volleys + ' arcs of ' + d.arc.count + ' fire bolts (' + d.arc.damage + ' + Burning).',
                       'Up close: a stronger fire cone (' + d.fire.damage + ').'] },
  { id: 'leech', enemy: 'leech', tag: 'The Ink Sewers',
    desc: 'Sticks to you and sucks. Hit it and it lets go.',
    abilities: (d) => ['Latched: ' + d.latchDamage + ' damage and -' + d.manaDrain + ' mana every 0.5 s, and you walk slower.', 'Dashing past it avoids the bite.'] },
  { id: 'guard', enemy: 'guard', tag: 'The Paper Castle',
    desc: 'Behind that shield is a very patient soldier.',
    abilities: (d) => ['Hits from the front deal only ' + Math.round(d.shield.blockMul * 100) + '%. Its shield turns slowly: get behind it.', 'Shield bash: ' + d.dashDamage + '.'] },
  { id: 'mimic', enemy: 'mimic', tag: 'Treasure rooms',
    desc: 'Not every chest wants to be opened.',
    abilities: (d) => ['Hops onto you (' + d.hop.damage + '), lashes its tongue (' + d.tongue.damage + '), spits coins.', 'Drops something good.'] },
  { id: 'kingInkblot', enemy: 'kingInkblot', tag: 'BOSS · The Ink Sewers',
    desc: 'The biggest blot in the drain, and he knows it.',
    abilities: (d) => ['Jumps onto you: ' + d.hop.damage + ' where he lands (the red circle).', 'Every few jumps he slams the middle and splashes ink everywhere.', 'Hurt him enough and he splits in two.', 'Weak spot (melee): dash + attack into his ink shots to send them back: they hurt him x' + d.reflectWeak + '.'] },
  { id: 'warden', enemy: 'warden', tag: 'BOSS · The Paper Castle',
    desc: 'Keeper of the keys. Never lost a prisoner. Never lost a fight.',
    abilities: (d) => ['Swings his ball and chain around (' + d.ball.damage + ') or throws it (' + d.throwB.impactDamage + ').', 'Cells: stand in the red squares and you get locked in.', 'Calls the prisoners when he is hurt.', 'Weak spot (melee): dash + attack into the ball (it glows) to send it back into him: stun + ' + Math.round(d.reflect.hpPct * 100) + '% of his HP.'] },
  { id: 'smallWorm', boss: 'smallWorm', tag: 'After boss 1',
    desc: 'A Bookworm hatchling. Small, but it splits too.',
    abilities: (b) => ['Burrows and bursts out like the Bookworm.', 'Bites: head ' + b.contact.head + ', body ' + b.contact.body + '.'] }
];

// enemy type id -> bestiary id (prisoners spawn as two 'prisoner' enemies)
const BESTIARY_ID = { prisoner: 'prisoners', inkPrince: 'kingInkblot' };
function bestiaryIdFor(typeId) { return BESTIARY_ID[typeId] || typeId; }

/* ---------------- Bestiary screen ---------------- */
class BestiaryScene extends Phaser.Scene {
  constructor() { super('BestiaryScene'); }

  create() {
    this.spread = 0;
    this.input.setDefaultCursor('default');
    this.build();
    const kb = this.input.keyboard;
    kb.on('keydown-A', () => this.turn(-1)); kb.on('keydown-LEFT', () => this.turn(-1));
    kb.on('keydown-D', () => this.turn(1));  kb.on('keydown-RIGHT', () => this.turn(1));
    kb.on('keydown-ESC', () => this.scene.start('MainMenuScene'));
  }

  turn(dir) {
    const max = Math.ceil(BESTIARY_ENTRIES.length / 2) - 1;
    const n = Math.max(0, Math.min(max, this.spread + dir));
    if (n !== this.spread) { this.spread = n; this.build(); }
  }

  build() {
    if (this.root) this.root.destroy(true);
    const W = GAME_CONFIG.width, H = GAME_CONFIG.height;
    const root = this.add.container(0, 0);
    this.root = root;
    const g = this.add.graphics();
    root.add(g);
    // book
    g.fillStyle(0x6d4c41, 1); g.fillRoundedRect(28, 70, W - 56, H - 110, 12);
    g.fillStyle(0xfdf6e3, 1); g.fillRect(44, 82, W / 2 - 50, H - 134); g.fillRect(W / 2 + 6, 82, W / 2 - 50, H - 134);
    g.lineStyle(2, 0x5d4037, 0.5); g.lineBetween(W / 2, 82, W / 2, H - 52);

    let known = 0;
    for (let i = 0; i < BESTIARY_ENTRIES.length; i++) if (SaveData.isKnown(BESTIARY_ENTRIES[i].id)) known++;
    MenuUI.text(this, root, 40, 22, 'Bestiary', 32, '#37474f', true);
    MenuUI.text(this, root, 200, 36, known + ' / ' + BESTIARY_ENTRIES.length + ' pages filled', 15, '#8d6e63');
    MenuUI.button(this, root, W - 130, 24, '  Back  ', () => this.scene.start('MainMenuScene'), '#37474f');

    const i0 = this.spread * 2;
    this.drawPage(root, BESTIARY_ENTRIES[i0], 44, 82, W / 2 - 50, i0 + 1);
    if (BESTIARY_ENTRIES[i0 + 1]) this.drawPage(root, BESTIARY_ENTRIES[i0 + 1], W / 2 + 6, 82, W / 2 - 50, i0 + 2);

    const max = Math.ceil(BESTIARY_ENTRIES.length / 2) - 1;
    if (this.spread > 0) MenuUI.button(this, root, 44, H - 36, ' ◀ prev  [A] ', () => this.turn(-1), '#5d4037');
    if (this.spread < max) MenuUI.button(this, root, W - 150, H - 36, ' [D]  next ▶ ', () => this.turn(1), '#5d4037');
    MenuUI.text(this, root, W / 2, H - 32, 'Spread ' + (this.spread + 1) + ' / ' + (max + 1), 14, '#5d4037', true).setOrigin(0.5, 0);
  }

  drawPage(root, en, x, y, w, pageNo) {
    const known = SaveData.isKnown(en.id);
    const def = en.enemy ? ENEMY_TYPES[en.enemy] : BOSS_TYPES[en.boss];
    const cx = x + w / 2;
    // ruled lines like a notebook page
    const g = this.add.graphics(); root.add(g);
    g.lineStyle(1, GAME_CONFIG.colors.gridLine, 0.5);
    for (let ly = y + 190; ly < y + 500; ly += 22) g.lineBetween(x + 10, ly, x + w - 10, ly);
    MenuUI.text(this, root, x + w - 30, y + 8, '' + pageNo, 12, '#8d6e63');

    // picture
    this.drawSprite(root, en, cx, y + 92, known);

    if (!known) {
      MenuUI.text(this, root, cx, y + 175, '(unknown)', 26, '#757575', true).setOrigin(0.5, 0);
      MenuUI.text(this, root, cx, y + 215, 'Meet it in a run to fill in this page.', 14, '#9e9e9e').setOrigin(0.5, 0);
      return;
    }
    const name = en.boss ? def.name : def.name;
    MenuUI.text(this, root, cx, y + 160, name, 24, '#37474f', true).setOrigin(0.5, 0);
    MenuUI.text(this, root, cx, y + 190, en.tag, 13, en.tag.indexOf('ELITE') === 0 || en.tag.indexOf('BOSS') === 0 ? '#c62828' : '#8d6e63', true).setOrigin(0.5, 0);
    MenuUI.text(this, root, x + 20, y + 216, en.desc, 15, '#4e342e').setWordWrapWidth(w - 40);

    // stats (level 1 values)
    let stats;
    if (en.enemy) stats = 'HP ' + def.maxHp + '   ·   Speed ' + def.speed + '   ·   Touch ' + def.contactDamage;
    else stats = 'HP per segment: head ' + def.hp.head + ', body ' + def.hp.body + '   ·   ' + def.segments + ' segments';
    MenuUI.text(this, root, x + 20, y + 268, stats, 14, '#37474f', true).setWordWrapWidth(w - 40);
    const lines = en.abilities(def);
    let ly = y + 300;
    for (let i = 0; i < lines.length; i++) {
      const t = MenuUI.text(this, root, x + 20, ly, '• ' + lines[i], 14, '#4e342e').setWordWrapWidth(w - 40);
      ly += t.height + 6;
    }
    MenuUI.text(this, root, x + 20, y + 470, 'Level 1 values (enemies get stronger every level).', 11, '#9e9e9e');
    MenuUI.text(this, root, x + w - 20, y + 470, 'Defeated: ' + SaveData.kills(en.id), 13, '#2e7d32', true).setOrigin(1, 0);
  }

  // The enemy's own texture, scaled up. Unknown = dark silhouette.
  drawSprite(root, en, cx, cy, known) {
    const add = (key, x, y, scale, rot) => {
      const im = this.add.image(x, y, key).setScale(scale).setRotation(rot || 0);
      if (!known) im.setTintFill(0x37474f).setAlpha(0.85);
      root.add(im);
      return im;
    };
    if (en.boss) {
      const p = BOSS_TYPES[en.boss].tex, s = en.boss === 'bookworm' ? 1.4 : 2.2;
      const step = (en.boss === 'bookworm' ? 26 : 16) * s;
      add(p + '_tail', cx - step * 3, cy + 6, s);
      add(p + '_body2', cx - step * 2, cy + 3, s, Math.PI / 2);
      add(p + '_body', cx - step, cy, s, Math.PI / 2);
      add(p + '_head', cx + step * 0.4, cy - 2, s);
      return;
    }
    if (en.id === 'prisoners') {
      const g = this.add.graphics(); root.add(g);
      g.lineStyle(3, known ? 0x78909c : 0x37474f, known ? 1 : 0.85);
      g.beginPath(); g.moveTo(cx - 60, cy); g.lineTo(cx - 20, cy + 22); g.lineTo(cx + 20, cy + 22); g.lineTo(cx + 60, cy); g.strokePath();
      add('enemy_prisoner', cx - 60, cy, 2.4); add('enemy_prisoner', cx + 60, cy, 2.4);
      return;
    }
    const size = ENEMY_TYPES[en.enemy].size;
    add('enemy_' + en.enemy, cx, cy, Math.min(4, 90 / size));
  }
}
