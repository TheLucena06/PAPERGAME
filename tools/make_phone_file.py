"""Builds the ONE-FILE phone version: every script (Phaser included) packed into a single .html.
Phones often can't open a folder, but they can open one downloaded file.

    python3 tools/make_phone_file.py "Alpha 2"

-> "papergame alpha 2.html" next to the project folder. The game folder itself is unchanged
(it stays the dev version for PCs / the website). Nothing here is needed to PLAY the game."""
import os, re, sys, base64

root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
name = sys.argv[1] if len(sys.argv) > 1 else 'Alpha'
html = open(os.path.join(root, 'index.html'), encoding='utf-8').read()

def inline(m):
    src = m.group(1)
    code = open(os.path.join(root, src), encoding='utf-8').read()
    code = code.replace('</script', '<\\/script')          # can't close the tag early
    return '<script>/* ' + src + ' */\n' + code + '\n</script>'

html = re.sub(r'<script src="([^"]+)"></script>', inline, html)
# a single file has no manifest / service worker; the icon goes in as data
html = re.sub(r'\s*<link rel="manifest"[^>]*>', '', html)
icon = base64.b64encode(open(os.path.join(root, 'icon-192.png'), 'rb').read()).decode()
html = html.replace('href="icon-192.png"', 'href="data:image/png;base64,' + icon + '"')
html = html.replace("window.GAME_BUILD = 'dev build';", "window.GAME_BUILD = " + repr(name) + ";")
html = html.replace('<title>PaperGame</title>', '<title>PaperGame ' + name + '</title>')
assert '<script src=' not in html

out = os.path.join(os.path.dirname(root), 'papergame ' + name.lower() + '.html')
open(out, 'w', encoding='utf-8').write(html)
print(out, round(os.path.getsize(out) / 1024), 'KB')
