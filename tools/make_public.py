"""make_public.py - copy the game into the GitHub repo folder WITHOUT the secret.

Usage:  python3 tools/make_public.py /path/to/papergame-repo [--full]
        --full = copy EVERYTHING, secret included (the owner's choice since Nov 2026)

What it does:
- copies every game file (index.html, js/, docs, tools...) into the repo folder,
  except the secret files (js/russi.js, js/russi_art.js) and stray screenshots;
- swaps the secret for js/extras.js: the "russi" menu code only unlocks the
  Cupid starter kit there (no boss, no photos, no message);
- renames the secret hooks in main.js and drops the SECRET notes from the docs;
- fails loudly if the word "russi" is left anywhere except extras.js' code word.
"""
import os, re, shutil, sys

SRC = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ARGS = [a for a in sys.argv[1:] if not a.startswith('--')]
FULL = '--full' in sys.argv
DST = ARGS[0] if ARGS else '/home/claude/papergame'
SKIP_FILES = {'tools/balance/previous.json'} if FULL else {'js/russi.js', 'js/russi_art.js', 'tools/balance/previous.json', 'tools/make_public.py'}
SKIP_ROOT = re.compile(r'^[^/]+\.png$')          # stray screenshots in the root (icons are kept below)
KEEP_ROOT_PNG = {'icon-192.png', 'icon-512.png'}

EXTRAS = """/* extras.js - small extras for the public build.
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
"""


def main():
    # clear the repo folder (keep .git, README.md, .nojekyll)
    for name in os.listdir(DST):
        if name in ('.git', 'README.md', '.nojekyll'):
            continue
        p = os.path.join(DST, name)
        shutil.rmtree(p) if os.path.isdir(p) else os.remove(p)
    for root, dirs, files in os.walk(SRC):
        dirs[:] = [d for d in dirs if d not in ('.git', '__pycache__')]
        for f in files:
            rel = os.path.relpath(os.path.join(root, f), SRC).replace(os.sep, '/')
            if rel in SKIP_FILES or (SKIP_ROOT.match(rel) and rel not in KEEP_ROOT_PNG):
                continue
            out = os.path.join(DST, rel)
            os.makedirs(os.path.dirname(out), exist_ok=True)
            shutil.copy2(os.path.join(root, f), out)

    if FULL:
        print('full copy (secret included) ready in', DST)
        return

    def edit(rel, fn):
        p = os.path.join(DST, rel)
        s = open(p, encoding='utf-8').read()
        open(p, 'w', encoding='utf-8').write(fn(s))

    edit('index.html', lambda s: s.replace('  <script src="js/russi_art.js"></script>\n  <script src="js/russi.js"></script>\n', '  <script src="js/extras.js"></script>\n'))

    def main_js(s):
        s = re.sub(r'this\.russiRunStart\(\);[^\n]*', 'this.extrasRunStart();', s)
        return s.replace('this.russiBossId(', 'this.extrasBossId(').replace('this.updateRussi(dt);', 'this.updateExtras(dt);').replace('RussiMixin', 'ExtrasMixin')
    edit('js/main.js', main_js)
    open(os.path.join(DST, 'js/extras.js'), 'w', encoding='utf-8').write(EXTRAS)

    def drop_secret_notes(s):
        out, skip = [], False
        for line in s.split('\n'):
            if line.startswith('- SECRET'):
                skip = True
                continue
            if skip and line.startswith('  '):
                continue
            skip = False
            if re.search('russi', line, re.I):
                continue
            out.append(line)
        return '\n'.join(out)
    for doc in ('NOTES.md', 'CONTENT.md'):
        edit(doc, drop_secret_notes)

    # nothing secret may be left (extras.js holds only the code word)
    bad = []
    for root, dirs, files in os.walk(DST):
        dirs[:] = [d for d in dirs if d != '.git']
        for f in files:
            p = os.path.join(root, f)
            rel = os.path.relpath(p, DST)
            if rel == os.path.join('js', 'extras.js'):
                continue
            try:
                if re.search('russi', open(p, encoding='utf-8', errors='ignore').read(), re.I):
                    bad.append(rel)
            except Exception:
                pass
    if bad:
        sys.exit('SECRET LEFT IN: ' + ', '.join(bad))
    print('public copy ready in', DST)


main()
