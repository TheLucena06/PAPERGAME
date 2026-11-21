/* pickups.js
   Things lying on the floor of a room.
   HEALTH POTIONS: clearing a fight room may leave a Health Potion on the floor:
   3% chance on level 1, +2% every level (level 6: 13%). Walk over it to take it. */

const PICKUP_RULES = { potionBase: 0.03, potionPerLevel: 0.02, reach: 34 };

const PickupMixin = {
  setupPickups() {
    if (!this.textures.exists('potionPickup')) {
      TextureFactory.withGraphics(this, 'potionPickup', 22, 28, (g) => {
        g.fillStyle(0x8d6e63, 1); g.fillRect(8, 0, 6, 5);                 // cork
        g.fillStyle(0xeeeeee, 0.9); g.fillRect(7, 5, 8, 5);                // neck
        g.fillStyle(0xe53935, 1); g.fillCircle(11, 18, 9);                 // potion
        g.fillStyle(0xffffff, 0.6); g.fillCircle(8, 15, 2.5);
        g.lineStyle(2, 0x4e342e, 1); g.strokeCircle(11, 18, 9);
      });
    }
    this.pickupImg = this.add.image(0, 0, 'potionPickup').setDepth(5).setVisible(false);
  },

  // A fight room was cleared: maybe leave a potion.
  rollRoomPotion(room) {
    if (this.testMode || room.potionRolled || (room.type !== 'normal' && room.type !== 'exit')) return;
    room.potionRolled = true;
    const chance = PICKUP_RULES.potionBase + PICKUP_RULES.potionPerLevel * Math.max(0, (this.level || 1) - 1);
    if (Math.random() >= chance) return;
    const pt = { x: this.rooms.W / 2, y: this.rooms.H / 2 };
    if (room.type === 'exit') pt.y += 90;                               // not on the hatch
    if (this.rooms.solidAt(pt.x, pt.y)) pt.y = this.rooms.H / 2;
    room.potion = pt;
    this.hud.floatText(pt.x, pt.y - 24, 'A potion!', '#e53935');
  },

  // Every frame: draw / take the potion lying in this room.
  updatePickups() {
    const room = this.room, img = this.pickupImg;
    if (!img) return;
    if (!room || !room.potion) { img.setVisible(false); return; }
    const pt = room.potion;
    img.setVisible(true).setPosition(pt.x, pt.y + Math.sin(this.time.now / 250) * 3);
    if (this.lighting) this.lighting.add(pt.x, pt.y, 70);
    for (let i = 0; i < this.players.length; i++) {
      const p = this.players[i];
      if (!p.alive) continue;
      const dx = p.sprite.x - pt.x, dy = p.sprite.y - pt.y;
      if (dx * dx + dy * dy > PICKUP_RULES.reach * PICKUP_RULES.reach) continue;
      Loadout.giveConsumable(this.team, p, 'healthPotion', 1);
      this.hud.floatText(p.sprite.x, p.sprite.y - 34, '+1 Health Potion', '#e53935');
      this.hud.addFx(pt.x, pt.y, 24, 0xe53935, 220);
      room.potion = null; img.setVisible(false);
      return;
    }
  }
};
