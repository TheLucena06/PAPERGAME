/* extras.js - small extras for the public build.
   A code typed on the main menu unlocks the Cupid starter kit (the Harp, until Cupid gets an armor).
   Phones: tap the title 5 times quickly, then type it. */
const ExtrasMixin = {
  extrasRunStart() {},
  extrasBossId(id) { return id; },
  updateExtras() {}
};

KIT_TYPES.cupid = { name: 'Cupid', class: 'arcane', sub: 'Cupid', weapon: 'harp', armor: null, secret: true, hint: 'Some codes are better left unsaid.' };

const ExtrasCode = {
  word: 'russi',
  listen(scene) {
    let buf = '';
    scene.input.keyboard.on('keydown', (ev) => {
      if (!ev.key || ev.key.length !== 1) return;
      buf = (buf + ev.key.toLowerCase()).slice(-this.word.length);
      if (buf === this.word) { buf = ''; this.trigger(scene); }
    });
    let taps = 0, last = 0;
    const zone = scene.add.zone(GAME_CONFIG.width / 2, 120, 460, 110).setInteractive();
    zone.on('pointerdown', () => {
      const now = scene.time.now;
      taps = now - last < 600 ? taps + 1 : 1; last = now;
      if (taps >= 5) {
        taps = 0;
        let typed = null;
        try { typed = window.prompt('?'); } catch (e) { typed = null; }
        if (typed && typed.trim().toLowerCase() === this.word) this.trigger(scene);
      }
    });
  },
  trigger(scene) {
    SaveData.unlockKit('cupid');
    SaveData.save();
    scene.cameras.main.shake(250, 0.006);
  }
};

(function () {
  const create = MainMenuScene.prototype.create;
  MainMenuScene.prototype.create = function () { create.call(this); ExtrasCode.listen(this); };
})();
