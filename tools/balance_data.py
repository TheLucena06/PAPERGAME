"""Builds the data for the live balance table (tools/balance/data.json) straight from the game code.

    python3 tools/balance_data.py "Alpha 3.2 dev"

Loads index.html in a headless browser (Playwright), reads every table (weapons, armor, skills,
items, set bonuses, buffs, Pencil Case, enemies, level scaling) and compares it with the last
build (tools/balance/previous.json) so the page can show what changed.
Dev tool only: the game never needs it."""
import json, os, re, sys, datetime
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DIR = os.path.join(ROOT, 'tools', 'balance')
BUILD = sys.argv[1] if len(sys.argv) > 1 else 'dev build'

DUMP_JS = """() => {
  const clean = (o, d = 0) => { if (typeof o === 'function') { try { return o(0); } catch (e) { return 'fn'; } }
    if (o === null || typeof o !== 'object') return o; if (d > 6) return null;
    if (Array.isArray(o)) return o.map((x) => clean(x, d + 1)); const r = {}; for (const k in o) r[k] = clean(o[k], d + 1); return r; };
  const out = {};
  for (const [n, t] of [['weapon', WEAPON_TYPES], ['armor', ARMOR_TYPES], ['skill', SKILL_TYPES], ['consumable', CONSUMABLE_TYPES]]) {
    out[n] = {}; for (const k in t) { const o = clean(t[k]); try { o._lines = ItemStats.lines(n, t[k]); } catch (e) { o._lines = []; } out[n][k] = o; } }
  out.effects = clean(EFFECT_TYPES); out.statNames = clean(STAT_NAMES); out.sets = clean(SET_BONUSES); out.buffs = clean(PASSIVE_BUFFS);
  out.upgrades = {}; for (const k in UPGRADE_TYPES) { const u = UPGRADE_TYPES[k]; out.upgrades[k] = Object.assign(clean(u), { desc: u.desc(0) }); }
  out.branches = clean(UPGRADE_BRANCHES); out.blueprints = clean(BLUEPRINT_TYPES);
  out.enemies = clean(Object.fromEntries(Object.entries(ENEMY_TYPES).filter(([k, v]) => !v.secret))); out.stages = clean(STAGE_TYPES); out.runPlan = clean(RUN_PLAN); out.levels = clean(GAME_CONFIG.levels);
  out.rules = { defenseCap: DEFENSE_CAP, dodgeMaxHit: DODGE_MAX_HIT_PCT, crit: typeof CRIT_MULTIPLIER !== 'undefined' ? CRIT_MULTIPLIER : 2,
    shield: SHIELD_RULES, mark: HUNTER_RULES, potion: PICKUP_RULES, personalShop: PERSONAL_SHOP, coinIncome: GAME_CONFIG.coinIncome, sell: typeof SELL_RATE !== 'undefined' ? SELL_RATE : null, player: clean(PLAYER_BASE_STATS) };
  return out; }"""

CLASS_ORDER = {'melee': 0, 'precision': 1, 'arcane': 2, 'boss': 3, None: 4}


def stars(d, cat):
    if cat == 'consumable': return ''
    if d.get('bossItem'): return 'boss'
    return (d.get('postBoss') or 0) + 1


def statfmt(D, mods):
    out = []
    for k, v in (mods or {}).items():
        nm = D['statNames'].get(k)
        if not nm or not isinstance(v, (int, float)): out.append('%s %s' % (k, v)); continue
        label, kind = nm
        out.append('%s %+g' % (label, v) if kind == 'add' else '%s %+g%%' % (label, round(v * 100, 1)))
    return ', '.join(out)


def classmods(D, d):
    out = []
    for cm in d.get('classMods') or []:
        who = cm.get('class') or cm.get('sub') or '?'
        out.append('%s: %s' % (who, statfmt(D, cm.get('mods'))))
    return '; '.join(out)


def flags(d):
    f = []
    if d.get('starter'): f.append('starter')
    if d.get('blueprint'): f.append('blueprint')
    if d.get('bossItem'): f.append('boss loot')
    if d.get('phaseOut') is not None: f.append('leaves shops at ' + '★' * (d['phaseOut'] + 1))
    if d.get('debugOnly'): f.append('debug only')
    if d.get('mega'): f.append('MEGA')
    return f


def num(lines, pat):
    m = re.search(pat, lines[0]) if lines else None
    return float(m.group(1)) if m else None


def skill_dmg(d):
    for key in ('damage', 'maxDamage', 'fullDamage', 'firstDamage'):
        if isinstance(d.get(key), (int, float)): return d[key]
    for sub in ('shot', 'zone'):
        if isinstance(d.get(sub), dict) and isinstance(d[sub].get('damage'), (int, float)): return d[sub]['damage']
    return None


def build(D):
    rows = {}
    # weapons
    W = []
    for k, d in D['weapon'].items():
        L = d.get('_lines') or []
        W.append({'id': k, 'name': d['name'], 'class': d.get('class'), 'sub': d.get('sub'), 'type': d.get('type') or d.get('kind'),
                  'tier': stars(d, 'weapon'), 'price': d.get('price'),
                  'dmg': num(L, r'Damage (\d+(?:\.\d+)?)') or (d.get('damage') if isinstance(d.get('damage'), (int, float)) else None),
                  'rate': num(L, r'([\d.]+) (?:hits|shots|casts)/s'), 'dps': num(L, r'~(\d+) DPS'),
                  'mana': d.get('manaCost'), 'notes': [x for x in (L[1:] if L and L[0].startswith('Damage') else L)],
                  'flags': flags(d), 'desc': (d.get('desc') or '').replace('\n', ' ')})
    rows['weapons'] = W
    A = []
    for k, d in D['armor'].items():
        A.append({'id': k, 'name': d['name'], 'class': d.get('class'), 'sub': d.get('sub'), 'tier': stars(d, 'armor'), 'price': d.get('price'),
                  'stats': statfmt(D, d.get('mods')), 'classStats': classmods(D, d), 'flags': flags(d), 'desc': (d.get('desc') or '').replace('\n', ' ')})
    rows['armor'] = A
    S = []
    for k, d in D['skill'].items():
        S.append({'id': k, 'name': d['name'], 'class': d.get('class'), 'sub': d.get('sub'), 'tier': stars(d, 'skill'), 'price': d.get('price'),
                  'mana': d.get('manaCost'), 'cd': round(d['cooldownMs'] / 1000, 1) if d.get('cooldownMs') else None, 'dmg': skill_dmg(d),
                  'kind': d.get('kind'), 'effect': statfmt(D, (D['effects'].get(d.get('effect')) or {}).get('mods')) if d.get('effect') else '',
                  'flags': flags(d), 'desc': (d.get('desc') or '').replace('\n', ' ')})
    rows['skills'] = S
    C = []
    for k, d in D['consumable'].items():
        eff = D['effects'].get(d.get('effect')) if d.get('effect') else None
        e = ''
        if eff:
            e = '%s, %ss' % (eff.get('name'), round((eff.get('durationMs') or 0) / 1000))
            m = statfmt(D, eff.get('mods')); cm = classmods(D, eff)
            if m: e += ': ' + m
            if cm: e += ' (' + cm + ')'
        elif d.get('healPct'): e = 'heal %s%% max HP' % d['healPct']
        C.append({'id': k, 'name': d['name'], 'class': d.get('class'), 'sub': d.get('sub'), 'price': d.get('price'), 'amount': d.get('amount'),
                  'effect': e, 'flags': flags(d), 'desc': (d.get('desc') or '').replace('\n', ' ')})
    rows['items'] = C
    rows['sets'] = [{'id': s, 'name': s, 'two': next((t[1] for t in v if t[0] == 2), ''), 'four': next((t[1] for t in v if t[0] == 4), ''),
                     'six': next((t[1] for t in v if t[0] == 6), '')} for s, v in D['sets'].items()]
    rows['buffs'] = [{'id': k, 'name': d['name'], 'stats': statfmt(D, d.get('mods')) or classmods(D, d), 'desc': (d.get('desc') or '').replace('\n', ' ')}
                     for k, d in D['buffs'].items()]
    br = {b['id']: b['name'] for b in D['branches']}
    rows['pencil'] = [{'id': k, 'name': u['name'], 'path': br.get(u['branch'], u['branch']), 'ranks': u['ranks'], 'costs': ' / '.join(str(c) for c in u['cost']),
                       'total': sum(u['cost']), 'needs': ', '.join('%s %s' % (D['upgrades'][n]['name'], r) for n, r in (u.get('needs') or {}).items()),
                       'desc': u['desc']} for k, u in D['upgrades'].items()]
    # enemies: which sections they appear in
    where = {}
    for sid, st in D['stages'].items():
        for e in st.get('enemies') or []: where.setdefault(e, []).append(st['name'])
        if st.get('boss'): where.setdefault(st['boss'], []).append(st['name'] + ' (boss)')
    E = []
    for k, d in D['enemies'].items():
        if not isinstance(d, dict) or not d.get('name'): continue
        hits = []
        for key in ('slash', 'arrow', 'bolt', 'hop', 'punch', 'slam', 'ribs', 'laser', 'bullet'):
            v = d.get(key)
            if isinstance(v, dict) and isinstance(v.get('damage'), (int, float)): hits.append('%s %s' % (key, v['damage']))
        for key in ('dashDamage', 'bulletDamage', 'explodeDamage', 'shotDamage'):
            if isinstance(d.get(key), (int, float)): hits.append('%s %s' % (key.replace('Damage', ''), d[key]))
        kind = 'boss' if d.get('boss') else 'mini-boss' if d.get('miniBoss') else 'part' if d.get('bossPart') else 'enemy'
        E.append({'id': k, 'name': d['name'], 'kind': kind, 'where': ', '.join(where.get(k, [])) or '—', 'hp': d.get('maxHp'), 'speed': d.get('speed'),
                  'touch': d.get('contactDamage'), 'hits': ', '.join(hits), 'cost': d.get('cost'), 'tier': (d.get('postBoss') or 0) + 1 if kind == 'enemy' else None,
                  'size': d.get('size'), 'special': ', '.join(x for x in ['ghost' if d.get('ghost') else '', 'gets back up' if d.get('revives') else '',
                                                                        'shield' if d.get('shield') else '', 'unique' if d.get('unique') else ''] if x)})
    rows['enemies'] = E
    lv = D['levels']
    rows['scaling'] = [{'id': 'L%d' % n, 'level': n, 'hp': round(1 + (n - 1) * lv['hpPerLevel'], 2), 'dmg': round(1 + (n - 1) * lv['damagePerLevel'], 2),
                        'budget': round(lv['baseBudget'] + (n - 1) * lv['budgetPerLevel'], 1)} for n in range(1, 9)]
    R = D['rules']
    rows['rules'] = [
        {'id': 'def', 'name': 'Defense', 'value': 'Cut on every hit, capped at %d%%' % round(R['defenseCap'] * 100)},
        {'id': 'dodge', 'name': 'Dodge', 'value': 'Only on hits up to %d%% of max HP; no cap' % round(R['dodgeMaxHit'] * 100)},
        {'id': 'crit', 'name': 'Crit', 'value': '×%s damage' % R['crit']},
        {'id': 'shield', 'name': 'Shield enemies', 'value': 'front ×0.15 · blasts ×%s · melee dash-attack = full + stun %ss · shield stuck %ss after its dash' % (
            R['shield']['aoeMul'], R['shield']['bashStunMs'] / 1000, R['shield']['lockMs'] / 1000)},
        {'id': 'mark', 'name': 'Marked (Hunter)', 'value': '×%s damage for %ss' % (R['mark']['markMul'], R['mark']['markMs'] / 1000)},
        {'id': 'hex', 'name': 'Hexed (Witch)', 'value': '×1.25 damage from everything'},
        {'id': 'potion', 'name': 'Room potion', 'value': '%d%% + %d%% per level' % (round(R['potion']['potionBase'] * 100), round(R['potion']['potionPerLevel'] * 100))},
        {'id': 'shop', 'name': 'Personalized Shop', 'value': '%d%% your class (+ universal items), +%d%% per rank' % (round(R['personalShop']['base'] * 100), round(R['personalShop']['perRank'] * 100))},
        {'id': 'coins', 'name': 'Coin income', 'value': '×%s' % R['coinIncome']},
        {'id': 'sell', 'name': 'Sell price', 'value': '%d%% of the shop price' % round((R.get('sell') or 0.5) * 100)},
        {'id': 'player', 'name': 'Player', 'value': 'HP %s · mana %s · speed %s · dash cooldown %ss' % (R['player']['maxHp'], R['player']['maxMana'], R['player']['moveSpeed'], R['player']['dashCooldownMs'] / 1000)}
    ]
    return rows


def diff(prev, cur):
    """What changed since the last build: added / removed / changed rows (with the fields)."""
    changes = []
    for tab, rows in cur.items():
        old = {r['id']: r for r in prev.get(tab, [])}
        new = {r['id']: r for r in rows}
        for k, r in new.items():
            if k not in old: changes.append({'tab': tab, 'id': k, 'name': r.get('name', k), 'what': 'added', 'fields': []}); continue
            f = [x for x in r if x != 'id' and r.get(x) != old[k].get(x)]
            if f: changes.append({'tab': tab, 'id': k, 'name': r.get('name', k), 'what': 'changed', 'fields': f,
                                  'before': {x: old[k].get(x) for x in f}, 'after': {x: r.get(x) for x in f}})
        for k, r in old.items():
            if k not in new: changes.append({'tab': tab, 'id': k, 'name': r.get('name', k), 'what': 'removed', 'fields': []})
    return changes


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    with sync_playwright() as p:
        b = p.chromium.launch(); pg = b.new_page()
        errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
        src = os.environ.get('BALANCE_SRC') or os.path.join(ROOT, 'index.html')   # (another build's html, to compare against)
        pg.goto('file://' + src); pg.wait_for_timeout(2000)
        D = pg.evaluate(DUMP_JS); b.close()
        if errs: print('page errors:', errs)
    rows = build(D)
    prev_path, out_path = os.path.join(OUT_DIR, 'previous.json'), os.path.join(OUT_DIR, 'data.json')
    prev = {}
    if os.path.exists(out_path):
        old = json.load(open(out_path))
        if old.get('build') != BUILD:                    # a new build: the last one becomes "previous"
            json.dump(old, open(prev_path, 'w'))
    if os.path.exists(prev_path): prev = json.load(open(prev_path))
    data = {'build': BUILD, 'date': datetime.date.today().isoformat(), 'previous': prev.get('build'), 'tabs': rows,
            'changes': diff(prev.get('tabs', {}), rows) if prev else []}
    json.dump(data, open(out_path, 'w'), ensure_ascii=False, separators=(',', ':'))
    print(out_path, round(os.path.getsize(out_path) / 1024), 'KB ·', sum(len(v) for v in rows.values()), 'rows ·', len(data['changes']), 'changes vs', prev.get('build'))


if __name__ == '__main__':
    main()
