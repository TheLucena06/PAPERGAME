# Putting PaperGame online (GitHub Pages, free)

One set of files runs everywhere. The same folder works from a USB stick on the
lab PCs and from a website on phones, and the game switches to touch controls on
its own when it runs on a phone or tablet. When you update the game, you update
the website once and every device gets the new version.

## First time (about 5 minutes, only you need an account)

1. Go to github.com and sign in, or make a free account.
2. Click **+** (top right), then **New repository**.
   - Name: `papergame` (any name works; it becomes part of the link).
   - Visibility: **Public**. Free GitHub Pages needs a public repo. A private
     repo with Pages needs a paid plan.
   - Click **Create repository**.
3. On the new repo page, click **uploading an existing file**.
   - Unzip the build on your computer first.
   - Drag in **everything inside** the `paper-roguelike` folder:
     `index.html`, `phaser.min.js`, `manifest.json`, `sw.js`, `icon-192.png`,
     `icon-512.png`, and the `js` and `art` folders.
   - `index.html` must sit at the top level, not inside another folder.
   - Click **Commit changes**.
4. Open **Settings**, then **Pages** (left menu).
   - Source: **Deploy from a branch**.
   - Branch: **main**, folder **/ (root)**.
   - Click **Save**.
5. Wait 1–2 minutes and refresh the Pages screen. It shows your link:
   `https://YOUR-NAME.github.io/papergame/`

Send that link to your friends. They just open it. No account, no login, nothing to install.

## On the phone

- Open the link in Safari (iPhone) or Chrome (Android).
- Turn the phone sideways. The game is landscape only.
- Optional, but it feels like a real app:
  - iPhone: **Share**, then **Add to Home Screen**.
  - Android: **⋮**, then **Add to Home screen** (or **Install app**).
  - The icon then opens the game full screen. After the first visit it also
    works offline.
- Main menu, then **Touch layout**, lets each player move and resize the buttons.
  **Reset to default** undoes it.

## Updating the public build

1. Open the repo, click **Add file**, then **Upload files**.
2. Drag in the new files and folders. Files with the same name get replaced.
3. Click **Commit changes**. The site updates in about a minute.

Players get the new version the next time they open the game with internet.
If a phone still shows the old one, close the game and open it again.

Saves are stored per device and per browser. A phone save and a PC save are
separate. **Export save / Import save** on the main menu moves a save between devices.

## About "closed beta"

- The link is not listed anywhere, but anyone who has it can play.
- The code is visible to anyone who finds the repo.
- That is the trade-off for "no login for players" on the free plan.
- To stop sharing, delete the repo or turn Pages off (Settings, then Pages).

## Let Claude upload updates for you (optional)

Connect GitHub in claude.ai (Settings, then Connectors / GitHub) and tell Claude
the repo name. Claude can then push each new build straight to the site, with no
dragging files.
