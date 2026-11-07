"""Builds the Inkscape sprite-sheet template (SVG) + the slicing map (JSON).
Everything is at 2x the in-game size."""
import json, base64, io
from PIL import Image

S = 2
G = json.load(open('grab.json'))
tex, weapons, room = G['tex'], G['weapons'], G['room']

def img_of(url):
    return Image.open(io.BytesIO(base64.b64decode(url.split(',', 1)[1]))).convert('RGBA')

def url_of(im):
    b = io.BytesIO(); im.save(b, 'PNG')
    return 'data:image/png;base64,' + base64.b64encode(b.getvalue()).decode()

def tiles(key, nx, ny):
    t = img_of(tex[key]['url']); w, h = t.size
    out = Image.new('RGBA', (w * nx, h * ny))
    for i in range(nx):
        for j in range(ny): out.paste(t, (i * w, j * h))
    return url_of(out)

def pad(url, size):
    # centers a 1x texture (rendered at 2x) in a bigger box
    im = img_of(url); out = Image.new('RGBA', (size * S, size * S))
    out.paste(im, ((size * S - im.width) // 2, (size * S - im.height) // 2)); return url_of(out)

# ---- sprite list: (section, rotates note, [(id, label, w1x, h1x, placeholder_url)]) ----
def T(k, label=None): return (k, label or k, tex[k]['w'], tex[k]['h'], tex[k]['url'])

enemy_names = {'enemy_runner': 'Runner', 'enemy_shooter': 'Shooter', 'enemy_charger': 'Charger', 'enemy_tank': 'Tank',
               'enemy_bomber': 'Bomber', 'enemy_prisoner': 'Chained Prisoner', 'enemy_inkdrop': 'Ink Drop',
               'enemy_inkblob': 'Inkblob', 'enemy_bigInkblob': 'Big Inkblob', 'enemy_gale': 'Gale',
               'enemy_warlock': 'Pyre Acolyte', 'enemy_fireWarlock': 'Pyre Warlock (elite)'}
sections = [
    ('Players', 'turn to face the aim: draw them FACING RIGHT. Bigger box than the old square (32x32): the hitbox stays 26x26 in the middle',
     [('player_0', 'Player 1 (no armor)', 32, 32, pad(tex['player_0']['url'], 32)), ('player_1', 'Player 2 (no armor)', 32, 32, pad(tex['player_1']['url'], 32))]),
    ('Players wearing armor', 'one look per armor, used by both players (P2 also gets its orange ring). FACING RIGHT',
     [('armor_' + k, n, 32, 32, pad(tex['player_0']['url'], 32)) for k, n, c in G['armors']]),
    ('Enemies', 'drawn as they are (they do not turn)',
     [T(k, enemy_names[k]) for k in enemy_names]),
    ('Bookworm (boss) + Small Worm', 'segments turn to face where they move: FACING RIGHT (head points right)',
     [T('worm_head', 'Bookworm head'), T('worm_body', 'Bookworm body A'), T('worm_body2', 'Bookworm body B'), T('worm_tail', 'Bookworm tail'),
      T('sworm_head', 'Small Worm head'), T('sworm_body', 'Small Worm body A'), T('sworm_body2', 'Small Worm body B'), T('sworm_tail', 'Small Worm tail'),
      T('spit', 'Ink spit')]),
    ('Helpers (allies)', 'wormling + hog turn to face where they move (FACING RIGHT); the target does not turn',
     [T('wormling_head', 'Wormling head'), T('wormling_body', 'Wormling body'), T('hog', 'Hog'), T('decoy', 'Prop Target')]),
    ('Projectiles + pickups', 'shots turn to face where they fly: FACING RIGHT',
     [T('arrow', 'Arrow'), T('bolt', 'Crossbow bolt'), T('manaarrow', 'Mana arrow'), T('slug', 'Winchester shot'), T('axe', 'Tomahawk (spins)'),
      T('bullet', 'Player shot'), T('spark', 'Wand spark'), T('magic', 'Staff bolt'), T('fireball', 'Fireball'),
      T('spectral', 'Spectral sword'), T('aurafist', 'Aura fist'), T('auraorb', 'Aura orb'), T('reflect', 'Reflected shot'), T('bomb', 'Paper bomb'),
      T('ebullet', 'Enemy ink shot'), T('firebolt', 'Pyre fire bolt'), T('coin', 'Coin')]),
    ('Weapons in hand', 'just the weapon, pointing RIGHT. RED DOT = the player\'s center: the weapon is placed and turned around it. Charge rings, ammo pips and swing arcs are drawn by the game',
     [('weapon_' + k, v['name'], v['w'], v['h'], v['url']) for k, v in weapons.items()]),
    ('Room pieces', 'tiles are 64x64 in game (128 here). Obstacles get picked at random from the 3 versions',
     [('block_1', 'Obstacle A', 64, 64, tex['block']['url']), ('block_2', 'Obstacle B', 64, 64, tex['block']['url']),
      ('block_3', 'Obstacle C', 64, 64, tex['block']['url']), ('hatch', 'Exit hatch', 52, 52, tex['hatch']['url']),
      ('door_top', 'Closed door TOP', 192, 64, tiles('door', 3, 1)), ('door_bottom', 'Closed door BOTTOM', 192, 64, tiles('door', 3, 1)),
      ('door_left', 'Closed door LEFT', 64, 128, tiles('door', 1, 2)), ('door_right', 'Closed door RIGHT', 64, 128, tiles('door', 1, 2)),
      ('wall_top', 'No door: wall TOP', 192, 64, tiles('wall', 3, 1)), ('wall_bottom', 'No door: wall BOTTOM', 192, 64, tiles('wall', 3, 1)),
      ('wall_left', 'No door: wall LEFT', 64, 128, tiles('wall', 1, 2)), ('wall_right', 'No door: wall RIGHT', 64, 128, tiles('wall', 1, 2))]),
    ('Room background', 'the whole room (960x640 in game): floor + walls, with ALL 4 door gaps open. Closed doors / wall patches above go on top of the gaps',
     [('room', 'Room background', room['w'], room['h'], room['url'])]),
]

SW = 2100            # sheet width
M = 60               # margin
GAPX, GAPY = 46, 40  # space between boxes
LAB = 46             # label height above each box
y = 330              # leave room for the instructions
guides, places, mapping = [], [], {}

def esc(t): return t.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')

for title, note, items in sections:
    guides.append(f'<text x="{M}" y="{y}" font-size="40" font-weight="bold" fill="#37474f">{esc(title)}</text>')
    guides.append(f'<text x="{M}" y="{y + 32}" font-size="22" fill="#8d6e63">{esc(note)}</text>')
    y += 60
    x, rowH = M, 0
    for sid, label, w1, h1, url in items:
        w, h = w1 * S, h1 * S
        cellW = max(w, 190)
        if x + cellW > SW - M and x > M:
            x = M; y += rowH + LAB + GAPY; rowH = 0
        by = y + LAB
        bx = x + (cellW - w) // 2
        guides.append(f'<text x="{x}" y="{y + 18}" font-size="{18 if len(label) < 19 else 15}" font-weight="bold" fill="#c62828">{esc(label)}</text>')
        guides.append(f'<text x="{x}" y="{y + 38}" font-size="15" fill="#757575">{w1}x{h1} in game</text>')
        guides.append(f'<rect x="{bx}" y="{by}" width="{w}" height="{h}" fill="none" stroke="#e53935" stroke-width="2" stroke-dasharray="8,5"/>')
        if sid.startswith('weapon_'):
            guides.append(f'<circle cx="{bx + 24 * S}" cy="{by + 28 * S}" r="5" fill="#e53935"/>')
        places.append(f'<image x="{bx}" y="{by}" width="{w}" height="{h}" xlink:href="{url}" preserveAspectRatio="none" style="image-rendering:optimizeSpeed"/>')
        mapping[sid] = {'x': bx, 'y': by, 'w': w, 'h': h, 'gameW': w1, 'gameH': h1, 'label': label}
        if sid.startswith('weapon_'): mapping[sid]['handX'] = 24; mapping[sid]['handY'] = 28
        x += cellW + GAPX
        rowH = max(rowH, h)
    y += rowH + LAB + 90

SH = y
intro = [
    'PaperGame sprite sheet template (everything is 2x the in-game size)',
    '1. Draw on the layer "3 - YOUR ART" (the other two layers are locked).',
    '2. Keep each drawing INSIDE its red dashed box. Anything outside the box gets cut off.',
    '3. Sprites that turn in the game (players, worms, shots, weapons) must face RIGHT.',
    '4. Leave the background transparent. Don\'t move or resize the boxes.',
    '5. To export: hide layers 1 and 2, then File > Export > Page, PNG, 96 dpi (1 px = 1 px). Send me the PNG (or this SVG).',
]
for i, t in enumerate(intro):
    guides.insert(i, f'<text x="{M}" y="{70 + i * 38}" font-size="{34 if i == 0 else 24}" font-weight="{"bold" if i == 0 else "normal"}" fill="#37474f">{esc(t)}</text>')

svg = f'''<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"
     xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape"
     xmlns:sodipodi="http://sodipodi.sourceforge.net/DTD/sodipodi-0.dtd"
     width="{SW}" height="{SH}" viewBox="0 0 {SW} {SH}" version="1.1" font-family="Arial, sans-serif">
  <sodipodi:namedview id="view" pagecolor="#ffffff" bordercolor="#666666" inkscape:document-units="px"
     inkscape:current-layer="layer_art" inkscape:pageopacity="0"/>
  <g inkscape:groupmode="layer" id="layer_guides" inkscape:label="1 - Guides (hide before export)" sodipodi:insensitive="true">
    {chr(10).join('    ' + g for g in guides)}
  </g>
  <g inkscape:groupmode="layer" id="layer_placeholders" inkscape:label="2 - Current art (hide before export)" sodipodi:insensitive="true" opacity="0.35">
    {chr(10).join('    ' + p for p in places)}
  </g>
  <g inkscape:groupmode="layer" id="layer_art" inkscape:label="3 - YOUR ART">
  </g>
</svg>
'''
open('papergame-sprite-template.svg', 'w').write(svg)
json.dump({'scale': S, 'sheetW': SW, 'sheetH': SH, 'sprites': mapping}, open('sprite_map.json', 'w'), indent=1)
print(SW, SH, len(mapping))
