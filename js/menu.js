/* menu.js
   MenuNav: shared cursor logic for all menus (shop, inventory, buff pick).
   A menu is a list of "nodes" (rectangles). Each player has their own
   cursor, moved with the movement keys (nearest node in that direction),
   so two players can browse at the same time. The mouse player can also
   hover/click nodes. Nodes can belong to one player (owner) or everyone. */

const PLAYER_CURSOR_COLORS = [0x1e88e5, 0xfb8c00, 0x43a047, 0x8e24aa];

class MenuNav {
  constructor(playerCount) {
    this.nodes = [];
    this.cursors = [];
    for (let i = 0; i < playerCount; i++) this.cursors.push(-1);
  }

  // node: { x, y, w, h, owner (optional player index), selectable (default true), ...anything }
  setNodes(nodes) {
    this.nodes = nodes;
    for (let i = 0; i < this.cursors.length; i++) {
      const c = this.cursors[i];
      if (c < 0 || c >= nodes.length || !this.canSelect(nodes[c], i)) this.cursors[i] = this.firstSelectable(i);
    }
  }

  canSelect(n, pi) {
    return n.selectable !== false && (n.owner === undefined || n.owner === pi);
  }

  firstSelectable(pi) {
    for (let i = 0; i < this.nodes.length; i++) if (this.canSelect(this.nodes[i], pi)) return i;
    return -1;
  }

  current(pi) {
    const c = this.cursors[pi];
    return c >= 0 ? this.nodes[c] : null;
  }

  setCurrent(pi, node) {
    const i = this.nodes.indexOf(node);
    if (i >= 0 && this.canSelect(node, pi)) this.cursors[pi] = i;
  }

  move(pi, dx, dy) {
    const cur = this.current(pi);
    if (!cur) { this.cursors[pi] = this.firstSelectable(pi); return; }
    const cx = cur.x + cur.w / 2, cy = cur.y + cur.h / 2;
    let best = -1, bestScore = Infinity;
    for (let i = 0; i < this.nodes.length; i++) {
      const n = this.nodes[i];
      if (n === cur || !this.canSelect(n, pi)) continue;
      const nx = n.x + n.w / 2 - cx, ny = n.y + n.h / 2 - cy;
      const along = nx * dx + ny * dy;
      if (along <= 4) continue;
      const perp = Math.abs(nx * dy - ny * dx);
      const score = along + perp * 2.5;
      if (score < bestScore) { bestScore = score; best = i; }
    }
    if (best >= 0) this.cursors[pi] = best;
  }

  nodeAt(x, y, pi) {
    for (let i = 0; i < this.nodes.length; i++) {
      const n = this.nodes[i];
      if (x >= n.x && x <= n.x + n.w && y >= n.y && y <= n.y + n.h && this.canSelect(n, pi)) return i;
    }
    return -1;
  }

  // Moves the cursor from menu input. Returns the node if confirmed, else null.
  handle(pi, m) {
    if (m.dx) this.move(pi, m.dx, 0);
    if (m.dy) this.move(pi, 0, m.dy);
    let confirmed = m.confirm;
    if (m.hasPointer) {
      const hit = (m.pointerMoved || m.click) ? this.nodeAt(m.px, m.py, pi) : -1;
      if (hit >= 0) this.cursors[pi] = hit;
      if (m.click && hit >= 0) confirmed = true;
    }
    return confirmed ? this.current(pi) : null;
  }

  // Draws each player's cursor frame (call every frame on a cleared Graphics).
  drawCursors(g) {
    for (let pi = 0; pi < this.cursors.length; pi++) {
      const n = this.current(pi);
      if (!n) continue;
      const o = 3 + pi * 4;
      g.lineStyle(3, PLAYER_CURSOR_COLORS[pi], 1);
      g.strokeRect(n.x - o, n.y - o, n.w + o * 2, n.h + o * 2);
      if (this.cursors.length > 1) {
        g.fillStyle(PLAYER_CURSOR_COLORS[pi], 1);
        g.fillRect(n.x - o, n.y - o - 10, 18, 10);
      }
    }
  }
}
