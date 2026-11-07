/* level.js
   LevelGenerator: builds a small random map of connected rooms for a level.
   RoomManager: builds the current room (walls, blocks, doors, exit hatch),
   and answers questions about it: "is this spot solid?", "can A see B?",
   "which way to the nearest player?" (one shared path map, not per enemy). */

const DIRS = {
  up:    { dx: 0,  dy: -1, opposite: 'down' },
  down:  { dx: 0,  dy: 1,  opposite: 'up' },
  left:  { dx: -1, dy: 0,  opposite: 'right' },
  right: { dx: 1,  dy: 0,  opposite: 'left' }
};
const DIR_NAMES = ['up', 'down', 'left', 'right'];

/* ---------------- Level generator ---------------- */
const LevelGenerator = {
  // opts (optional): { specials: true, theme: themedRoomId } -> merchant / treasure /
  // shrine rooms in dead ends, and a themed last room.
  generate(levelNum, roomCount, gridSize, opts) {
    opts = opts || {};
    let specials = [];
    if (opts.specials) {
      const sp = SPECIAL_ROOMS;
      if (opts.merchant) specials.push('merchant');
      if (Math.random() < Meta.treasureChance()) specials.push('treasure');
      if (Math.random() < sp.shrineChance) specials.push('shrine');
      roomCount += specials.length;          // special rooms come on top of the fights
      gridSize = Math.max(gridSize, 6);
    }
    const rooms = [];
    const byKey = {};
    const make = (x, y) => {
      const r = {
        gx: x, gy: y,
        doors: { up: false, down: false, left: false, right: false },
        layout: 0, type: 'normal', depth: 0,
        visited: false, cleared: false, fightStarted: false
      };
      rooms.push(r);
      byKey[x + ',' + y] = r;
      return r;
    };

    const mid = Math.floor(gridSize / 2);
    const start = make(mid, mid);
    start.type = 'start';
    start.cleared = true;

    let tries = 0;
    while (rooms.length < roomCount && tries < 1000) {
      tries++;
      const from = rooms[Math.floor(Math.random() * rooms.length)];
      const dName = DIR_NAMES[Math.floor(Math.random() * 4)];
      const d = DIRS[dName];
      const nx = from.gx + d.dx, ny = from.gy + d.dy;
      if (nx < 0 || ny < 0 || nx >= gridSize || ny >= gridSize) continue;
      if (byKey[nx + ',' + ny]) continue;
      // Prefer branches: the new room may touch only its parent
      if (tries < 700 && this.countNeighbors(byKey, nx, ny) > 1) continue;

      const r = make(nx, ny);
      r.depth = from.depth + 1;
      r.layout = 1 + Math.floor(Math.random() * (ROOM_LAYOUTS.length - 1));
      from.doors[dName] = true;
      r.doors[d.opposite] = true;
    }

    // Exit = the room farthest from the start
    let exit = null;
    for (let i = 1; i < rooms.length; i++) {
      if (!exit || rooms[i].depth > exit.depth) exit = rooms[i];
    }
    if (exit) { exit.type = 'exit'; if (opts.theme) { exit.theme = opts.theme; exit.layout = THEMED_ROOMS[opts.theme].layout; } }

    // Special rooms go in dead ends first (one door), never start / exit
    if (specials.length) {
      const cand = rooms.filter((r) => r.type === 'normal');
      const doorsOf = (r) => (r.doors.up ? 1 : 0) + (r.doors.down ? 1 : 0) + (r.doors.left ? 1 : 0) + (r.doors.right ? 1 : 0);
      cand.sort((a, b) => doorsOf(a) - doorsOf(b) || Math.random() - 0.5);
      for (let i = 0; i < specials.length && i < cand.length - 1; i++) {   // keep at least one normal fight room
        const r = cand[i];
        r.type = specials[i];
        r.layout = 0;
        r.cleared = true;                    // no fight (a mimic starts one itself)
        if (r.type === 'treasure') r.mimic = Math.random() < Meta.mimicChance();
      }
    }

    return { level: levelNum, rooms: rooms, byKey: byKey, start: start, exit: exit, gridSize: gridSize };
  },

  countNeighbors(byKey, x, y) {
    let n = 0;
    for (let i = 0; i < 4; i++) {
      const d = DIRS[DIR_NAMES[i]];
      if (byKey[(x + d.dx) + ',' + (y + d.dy)]) n++;
    }
    return n;
  },

  get(map, x, y) {
    return map.byKey[x + ',' + y] || null;
  },

  neighbor(map, room, dirName) {
    const d = DIRS[dirName];
    return this.get(map, room.gx + d.dx, room.gy + d.dy);
  }
};

/* ---------------- Room manager ---------------- */
// Rooms can be bigger than the screen (arenas): the camera then follows the
// players. Normal rooms are 15 x 10 tiles = exactly one screen.
const ROOM_MAX_COLS = 48, ROOM_MAX_ROWS = 32;

class RoomManager {
  constructor(scene, cfg) {
    this.scene = scene;
    this.T = cfg.tile;
    this.screenCols = Math.floor(cfg.width / cfg.tile);   // 15
    this.screenRows = Math.floor(cfg.height / cfg.tile);  // 10
    this.setSize(this.screenCols, this.screenRows);

    this.blocks = scene.physics.add.staticGroup();
    this.doorBlocks = scene.physics.add.staticGroup();

    const n = ROOM_MAX_COLS * ROOM_MAX_ROWS;
    this.blockAt = new Array(n).fill(null);   // obstacle block sprite per tile (walls are not breakable)
    this.grid = new Uint8Array(n);       // 1 = solid
    this.flowNext = new Int16Array(n);   // next tile toward nearest player
    this.queue = new Int16Array(n);
    this.flowKey = -1;

    this.room = null;
    this.doorsClosed = false;

    this.hatch = scene.add.image(this.W / 2, this.H / 2, 'hatch').setDepth(1).setVisible(false);
    this.hatchActive = false;
  }

  // Room size in tiles (walls included) + the door gap tiles for that size.
  setSize(cols, rows) {
    this.cols = Math.min(ROOM_MAX_COLS, cols);
    this.rows = Math.min(ROOM_MAX_ROWS, rows);
    this.W = this.cols * this.T;
    this.H = this.rows * this.T;
    const mc = Math.floor(this.cols / 2), mr = Math.floor(this.rows / 2);
    const lastC = this.cols - 1, lastR = this.rows - 1;
    this.doorTiles = {
      up:    [[mc - 1, 0], [mc, 0], [mc + 1, 0]],
      down:  [[mc - 1, lastR], [mc, lastR], [mc + 1, lastR]],
      left:  [[0, mr - 1], [0, mr]],
      right: [[lastC, mr - 1], [lastC, mr]]
    };
  }

  // Inside of the room (no walls) as rows of '#' / '.'. A room can bring its
  // own (big arenas are generated); otherwise one of ROOM_LAYOUTS.
  layoutRows(room) {
    return room.layoutRows || ROOM_LAYOUTS[room.layout].rows;
  }

  doorDirAt(c, r) {
    for (let i = 0; i < 4; i++) {
      const dir = DIR_NAMES[i];
      const tiles = this.doorTiles[dir];
      for (let k = 0; k < tiles.length; k++) {
        if (tiles[k][0] === c && tiles[k][1] === r) return dir;
      }
    }
    return null;
  }

  buildRoom(room) {
    this.blocks.clear(true, true);
    this.doorBlocks.clear(true, true);
    this.setSize(room.cols || this.screenCols, room.rows || this.screenRows);
    this.grid.fill(0);
    this.blockAt.fill(null);
    this.room = room;
    this.flowKey = -1;
    this.doorsClosed = false;
    this.hideHatch();
    this.hatch.setPosition(this.W / 2, this.H / 2);

    const layout = this.layoutRows(room);
    const T = this.T;
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const border = r === 0 || c === 0 || r === this.rows - 1 || c === this.cols - 1;
        if (border) {
          this.grid[r * this.cols + c] = 1; // door gaps count as solid for enemy paths
          const dir = this.doorDirAt(c, r);
          if (dir && room.doors[dir]) continue; // leave a gap
          const w = this.blocks.create(c * T + T / 2, r * T + T / 2, 'wall');
          if (this.look && this.look.wall) w.setTint(this.look.wall);
        } else if ((layout[r - 1] || '').charAt(c - 1) === '#') {
          if (room.mined && room.mined[r * this.cols + c]) continue;     // broken by a pickaxe earlier
          this.grid[r * this.cols + c] = 1;
          const b = this.blocks.create(c * T + T / 2, r * T + T / 2, 'block');
          if (this.look && this.look.block) b.setTint(this.look.block);
          this.blockAt[r * this.cols + c] = b;
        }
      }
    }
  }

  // Pickaxe / minecart: removes the obstacle block at this point. Returns its
  // center ({x, y}, reused object) or null. The room remembers it.
  breakBlockAt(x, y) {
    const i = this.tileIndex(x, y);
    if (i < 0 || !this.blockAt[i]) return null;
    const b = this.blockAt[i];
    this.blockAt[i] = null;
    this.grid[i] = 0;
    this.flowKey = -1;
    if (this.room) { this.room.mined = this.room.mined || {}; this.room.mined[i] = true; }
    this._broken = this._broken || { x: 0, y: 0 };
    this._broken.x = b.x; this._broken.y = b.y;
    this.blocks.remove(b, true, true);
    return this._broken;
  }

  closeDoors() {
    if (this.doorsClosed || !this.room) return;
    const T = this.T;
    for (let i = 0; i < 4; i++) {
      const dir = DIR_NAMES[i];
      if (!this.room.doors[dir]) continue;
      const tiles = this.doorTiles[dir];
      for (let k = 0; k < tiles.length; k++) {
        const d = this.doorBlocks.create(tiles[k][0] * T + T / 2, tiles[k][1] * T + T / 2, 'door');
        if (this.look && this.look.door) d.setTint(this.look.door);
      }
    }
    this.doorsClosed = true;
  }

  openDoors() {
    this.doorBlocks.clear(true, true);
    this.doorsClosed = false;
  }

  showHatch() { this.hatchActive = true; this.hatchArmed = false; this.hatch.setVisible(true); }
  hideHatch() { this.hatchActive = false; this.hatch.setVisible(false); }

  isOnHatch(x, y, r) {
    if (!this.hatchActive) return false;
    const dx = x - this.hatch.x, dy = y - this.hatch.y, rr = r || 26;
    return dx * dx + dy * dy < rr * rr;
  }

  // Which door the point has walked out through (or null)
  exitDirection(x, y) {
    const edge = this.T * 0.3;
    if (x < edge) return 'left';
    if (x > this.W - edge) return 'right';
    if (y < edge) return 'up';
    if (y > this.H - edge) return 'down';
    return null;
  }

  // Where players appear after walking through a door in direction viaDir
  entryPoint(viaDir, out) {
    const inset = this.T * 1.6;
    out.x = this.W / 2; out.y = this.H / 2;
    if (viaDir === 'right') out.x = inset;
    else if (viaDir === 'left') out.x = this.W - inset;
    else if (viaDir === 'down') out.y = inset;
    else if (viaDir === 'up') out.y = this.H - inset;
    return out;
  }

  tileIndex(x, y) {
    const c = Math.floor(x / this.T), r = Math.floor(y / this.T);
    if (c < 0 || r < 0 || c >= this.cols || r >= this.rows) return -1;
    return r * this.cols + c;
  }

  solidAt(x, y) {
    const i = this.tileIndex(x, y);
    return i < 0 || this.grid[i] === 1;
  }

  hasLineOfSight(x1, y1, x2, y2) {
    const dx = x2 - x1, dy = y2 - y1;
    const steps = Math.ceil(Math.sqrt(dx * dx + dy * dy) / 16);
    for (let i = 1; i < steps; i++) {
      if (this.solidAt(x1 + dx * i / steps, y1 + dy * i / steps)) return false;
    }
    return true;
  }

  // One breadth-first search from all alive players. Only re-run when a
  // player moves to a different tile, so it's almost free.
  updateFlowField(players) {
    let key = 0, any = false;
    for (let i = 0; i < players.length; i++) {
      const p = players[i];
      if (!p.alive) continue;
      any = true;
      key = key * 211 + this.clampedTile(p.sprite.x, p.sprite.y) + 1;
    }
    if (!any || key === this.flowKey) return;
    this.flowKey = key;

    const cols = this.cols, rows = this.rows;
    const flow = this.flowNext, grid = this.grid, q = this.queue;
    flow.fill(-2); // -2 = unreachable, -1 = a player's tile
    let head = 0, tail = 0;
    for (let i = 0; i < players.length; i++) {
      if (!players[i].alive) continue;
      const t = this.clampedTile(players[i].sprite.x, players[i].sprite.y);
      if (flow[t] !== -1) { flow[t] = -1; q[tail++] = t; }
    }
    while (head < tail) {
      const cur = q[head++];
      const cx = cur % cols, cy = (cur / cols) | 0;
      for (let k = 0; k < 4; k++) {
        const nx = cx + (k === 0 ? 1 : k === 1 ? -1 : 0);
        const ny = cy + (k === 2 ? 1 : k === 3 ? -1 : 0);
        if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
        const ni = ny * cols + nx;
        if (grid[ni] === 1 || flow[ni] !== -2) continue;
        flow[ni] = cur;
        q[tail++] = ni;
      }
    }
  }

  clampedTile(x, y) {
    let c = Math.floor(x / this.T), r = Math.floor(y / this.T);
    if (c < 1) c = 1; if (c > this.cols - 2) c = this.cols - 2;
    if (r < 1) r = 1; if (r > this.rows - 2) r = this.rows - 2;
    return r * this.cols + c;
  }

  // Fills out with the center of the next tile toward the nearest player.
  // Returns false if already on the player's tile or no path.
  getFlowStep(x, y, out) {
    const i = this.tileIndex(x, y);
    if (i < 0) return false;
    const next = this.flowNext[i];
    if (next < 0) return false;
    out.x = (next % this.cols) * this.T + this.T / 2;
    out.y = ((next / this.cols) | 0) * this.T + this.T / 2;
    return true;
  }

  randomSpawnPoint(players, minDist, out) {
    const minD2 = minDist * minDist;
    for (let tries = 0; tries < 40; tries++) {
      const c = 1 + Math.floor(Math.random() * (this.cols - 2));
      const r = 1 + Math.floor(Math.random() * (this.rows - 2));
      if (this.grid[r * this.cols + c] === 1) continue;
      const x = c * this.T + this.T / 2, y = r * this.T + this.T / 2;
      let ok = true;
      for (let i = 0; i < players.length; i++) {
        const p = players[i];
        if (!p.alive) continue;
        const dx = p.sprite.x - x, dy = p.sprite.y - y;
        if (dx * dx + dy * dy < minD2) { ok = false; break; }
      }
      if (ok) { out.x = x; out.y = y; return true; }
    }
    return false;
  }
}
