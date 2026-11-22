/* extras.js - small extras for the public build.
   The main-menu code "russi" unlocks the Cupid starter kit (the Harp, until Cupid gets an armor).
   Phones: tap the title 5 times quickly, then type it. */
const ExtrasMixin = {
  extrasRunStart() {},
  extrasBossId(id) { return id; },
  updateExtras() {}
};

KIT_TYPES.cupid = { name: 'Cupid', class: 'arcane', sub: 'Cupid', weapon: 'harp', armor: null, secret: true, hint: 'Some codes are better left unsaid.' };

MENU_CODES.russi = function (scene) {
  SaveData.unlockKit('cupid');
  SaveData.save();
  scene.cameras.main.shake(250, 0.006);
};
