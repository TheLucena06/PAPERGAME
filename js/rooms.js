/* rooms.js
   ROOM_LAYOUTS (data only). Each layout is the 13 x 8 INSIDE of a room:
     '#' = block (stops players, enemies and bullets)
     '.' = floor
   Outer walls and doors are added by code (level.js).

   RULES when adding a layout (or doors/hatch get blocked):
   - Row 1 and row 8: the 3 middle tiles (columns 6-8) must be '.'
   - Column 1 and column 13: the 2 middle tiles (rows 4-5) must be '.'
   - The 2 center tiles (column 7, rows 4-5) must be '.'
   - Every floor tile must be reachable (no closed pockets).
   Layout 0 is always used for the start room. */

const ROOM_LAYOUTS = [
  { name: 'open', rows: [
    '.............',
    '.............',
    '.............',
    '.............',
    '.............',
    '.............',
    '.............',
    '.............'
  ] },
  { name: 'pillars', rows: [
    '.............',
    '..##.....##..',
    '..##.....##..',
    '.............',
    '.............',
    '..##.....##..',
    '..##.....##..',
    '.............'
  ] },
  { name: 'bars', rows: [
    '.............',
    '.............',
    '...#######...',
    '.............',
    '.............',
    '...#######...',
    '.............',
    '.............'
  ] },
  { name: 'corners', rows: [
    '.............',
    '.##.......##.',
    '.#.........#.',
    '.............',
    '.............',
    '.#.........#.',
    '.##.......##.',
    '.............'
  ] },
  { name: 'scattered', rows: [
    '.............',
    '...#.....#...',
    '.......#.....',
    '.#.........#.',
    '.#.........#.',
    '.....#.......',
    '...#.....#...',
    '.............'
  ] },
  { name: 'box', rows: [
    '.............',
    '.............',
    '....##.##....',
    '....#...#....',
    '....#...#....',
    '....##.##....',
    '.............',
    '.............'
  ] },
  { name: 'columns', rows: [
    '.............',
    '...#.....#...',
    '...#.....#...',
    '...#.....#...',
    '.............',
    '...#.....#...',
    '...#.....#...',
    '.............'
  ] },
  { name: 'walls', rows: [
    '.............',
    '.###.....###.',
    '.............',
    '....#...#....',
    '....#...#....',
    '.............',
    '.###.....###.',
    '.............'
  ] }
];

/* Generated insides for rooms that are bigger than the screen. */
const RoomGen = {
  // Big open arena with a few 2x2 pillars (center and door lanes kept free).
  arena(cols, rows) {
    const iw = cols - 2, ih = rows - 2;
    const g = [];
    for (let r = 0; r < ih; r++) g.push(new Array(iw).fill('.'));
    const cx = iw / 2, cy = ih / 2;
    for (let r = 2; r < ih - 3; r += 5) {
      for (let c = 2; c < iw - 3; c += 6) {
        const pc = c + ((r / 5) % 2 ? 3 : 0);
        if (pc + 1 >= iw - 1) continue;
        if (Math.abs(pc + 1 - cx) < 4 && Math.abs(r + 1 - cy) < 4) continue;   // keep the middle open
        if (Math.abs(pc + 1 - cx) < 3 || Math.abs(r + 1 - cy) < 3) continue;   // and the lanes to the doors
        if (Math.random() < 0.25) continue;
        g[r][pc] = g[r][pc + 1] = g[r + 1][pc] = g[r + 1][pc + 1] = '#';
      }
    }
    return g.map((row) => row.join(''));
  }
};
