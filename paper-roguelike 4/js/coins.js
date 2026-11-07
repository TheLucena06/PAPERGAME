/* coins.js
   CoinManager: a pool of placeholder coin squares.
   Coins pop out of defeated enemies, fly to a nearby player, and fly to the
   players automatically once the room is cleared. Coins go into the shared
   team wallet (team.coins). */

const COIN_SETTINGS = {
  pickupRadius: 70,     // coins closer than this fly to the player
  collectRadius: 18,
  magnetSpeed: 460,
  popSpeedMin: 60, popSpeedMax: 150,
  popDelayMs: 300,      // coins can't be collected for a moment after dropping
  friction: 6
};

class CoinManager {
  constructor(scene, maxCoins, cfg) {
    this.scene = scene;
    this.setArea(cfg.tile, cfg.tile, cfg.width - cfg.tile, cfg.height - cfg.tile);
    this.coins = [];
    for (let i = 0; i < maxCoins; i++) {
      const c = scene.add.image(-100, -100, 'coin').setDepth(6).setVisible(false);
      c.active = false;
      c.vx = 0; c.vy = 0; c.ageMs = 0;
      this.coins.push(c);
    }
  }
  // Coins stay inside this rectangle (the current room, minus walls).
  setArea(minX, minY, maxX, maxY) {
    this.minX = minX; this.minY = minY; this.maxX = maxX; this.maxY = maxY;
  }


  // Drops `count` coins. If the pool is full, the coin goes straight to the wallet.
  drop(x, y, count, team) {
    const S = COIN_SETTINGS;
    for (let n = 0; n < count; n++) {
      const c = this.getFree();
      if (!c) { team.coins++; continue; }
      const a = Math.random() * Math.PI * 2;
      const sp = S.popSpeedMin + Math.random() * (S.popSpeedMax - S.popSpeedMin);
      c.active = true;
      c.setVisible(true).setPosition(x, y);
      c.vx = Math.cos(a) * sp; c.vy = Math.sin(a) * sp;
      c.ageMs = 0;
    }
  }

  getFree() {
    for (let i = 0; i < this.coins.length; i++) if (!this.coins[i].active) return this.coins[i];
    return null;
  }

  update(dt, players, magnetAll, team) {
    const S = COIN_SETTINGS;
    const sec = dt / 1000;
    const f = Math.max(0, 1 - S.friction * sec);
    for (let i = 0; i < this.coins.length; i++) {
      const c = this.coins[i];
      if (!c.active) continue;
      c.ageMs += dt;

      // Find nearest alive player
      let best = null, bestD2 = Infinity;
      for (let k = 0; k < players.length; k++) {
        const p = players[k];
        if (!p.alive) continue;
        const dx = p.sprite.x - c.x, dy = p.sprite.y - c.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < bestD2) { bestD2 = d2; best = p; }
      }

      if (best && c.ageMs > S.popDelayMs) {
        if (bestD2 < S.collectRadius * S.collectRadius) {
          team.coins++;
          this.kill(c);
          continue;
        }
        if (magnetAll || bestD2 < S.pickupRadius * S.pickupRadius) {
          const d = Math.sqrt(bestD2) || 1;
          c.vx = (best.sprite.x - c.x) / d * S.magnetSpeed;
          c.vy = (best.sprite.y - c.y) / d * S.magnetSpeed;
          c.x += c.vx * sec; c.y += c.vy * sec;
          continue;
        }
      }

      c.vx *= f; c.vy *= f;
      c.x = Math.min(this.maxX, Math.max(this.minX, c.x + c.vx * sec));
      c.y = Math.min(this.maxY, Math.max(this.minY, c.y + c.vy * sec));
    }
  }

  // Leaving a room: any coins still lying around go into the wallet.
  collectAll(team) {
    for (let i = 0; i < this.coins.length; i++) {
      const c = this.coins[i];
      if (!c.active) continue;
      team.coins++;
      this.kill(c);
    }
  }

  kill(c) {
    c.active = false;
    c.setVisible(false);
  }
}
