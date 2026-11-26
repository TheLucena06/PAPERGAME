# CLAUDE.md: instructions for any Claude working on PaperGame

PaperGame is a top-down roguelike drawn on notebook paper (think "top-down Dead Cells with Terraria and
Deltarune flavour"). Owner: TheLucena06 (Lucena). It is built by a small group of friends, each prompting their
own Claude. Several Claudes edit this same repo, so follow these rules exactly.

## Hard rules (never break these)
- Phaser 3 is loaded from the LOCAL file `phaser.min.js`. No CDN links, no network requests at runtime.
- Classic `<script src>` tags only. NO ES modules, NO npm, NO bundlers, NO build step. Every file in `js/` is a
  plain script that defines globals; load order is the order of the tags in `index.html`.
- Draw everything with Phaser shapes / Graphics-generated textures. The only exception is art embedded
  as data URIs in a .js file (see `js/russi_art.js`): never load image or sound FILES at runtime, because
  `file://` (opening index.html straight from a folder) blocks them.
- Everything must work offline: school lab PCs (keyboard, mouse, cheap PS2-style USB gamepads) and phones (touch).
- In-game text is in English for now (a Portuguese translation comes later). Designs from the team often arrive in
  Portuguese: build them in English and keep the item names they chose unless asked otherwise.
- Don't remove or spoil the secret content: the "russi" main-menu code, `js/russi.js` and `js/russi_art.js`.

## Where things are
- `index.html`: script order. New systems go in a NEW file, added before `js/debug.js` / `js/main.js`.
- `js/main.js`: `GameScene` + `GAME_CONFIG` (level scaling, co-op, debug flags). Systems are mixins assigned at the
  bottom (`Object.assign(GameScene.prototype, ..., HunterMixin, BoulderMixin, ...)`); each has `setupX()` (in
  create), `updateX(dt)` (view step) and often `xRoom()` (room change). Copy that pattern.
- Content tables (globals): `WEAPON_TYPES`, `ARMOR_TYPES`, `SKILL_TYPES`, `CONSUMABLE_TYPES`, `EFFECT_TYPES`,
  `ENEMY_TYPES` + `ENEMY_AI`, `WEAPON_BEHAVIORS`, `SKILL_BEHAVIORS`, `SET_BONUSES`, `KIT_TYPES`, `STAGE_TYPES`,
  `BLUEPRINT_TYPES`. Files by theme: `weapons.js`, `skills.js`, `items.js`, `arcane*.js`, `gear3.js`,
  `hunter.js`, `cupid.js`, `berserker.js`, `boulder.js`, `miner.js`, `necrotery.js`, `titan.js`, `graveyard.js`...
- Item fields that matter: `class` (melee / arcane / precision), `sub` (Knight, Monk, Berserker, Miner, Archer,
  Hunter, Mage, North Wizard, Druid, Necromancer, Witch, Cupid...), `price`, tier = `postBoss` (none = ★,
  `POST_BOSS_1` = ★★, `POST_BOSS_2` = ★★★, `POST_BOSS_3` = ★★★★), `blueprint` (locked until found),
  `bossItem` (boss loot only), `debugOnly` (Test Dungeon only), `desc` (what the player reads: keep the numbers
  in it true).
- `js/mobile.js` = touch controls, `js/controls.js` = keyboard / mouse / gamepad, `js/debug.js` = debug menu +
  Test Dungeon, `js/hud.js` = HUD and weapon drawing, `js/lighting.js` = darkness / torches.

## Docs: update them with every change
- `CONTENT.md`: a line for EVERY gameplay change, with the numbers (it's the changelog the owner reads).
- `NOTES.md`: how the code works (for the next Claude).
- `ROADMAP.md` (plans) and `VISION.md` (the owner's original brief + a built / not-built checklist; don't edit the quote).

## Testing
- Open `index.html` in a browser (Chrome). Type `debug` on the main menu (phones: tap the title 5 times and type
  it) for the debug menu: Test Dungeon (spawn any enemy, equip any gear, pick a stage / room / graveyard), save
  tools, tuning. F8 = performance overlay.
- If you can run headless Chromium + Playwright, play the scene through `game.scene.getScene('GameScene')` and
  check `pageerror`s. Test what you changed AND that a normal run still starts.

## Builds
- Single-file phone build: `python3 tools/make_phone_file.py "Alpha N"` -> `papergame alpha N.html`
  (the owner decides when a build is "published" and its name).
- `tools/balance_data.py` regenerates the data behind the owner's live balance table (needs Playwright).
- GitHub Pages serves `main` as the website: https://thelucena06.github.io/PAPERGAME/ , so `main` must always work.

## Working together (several people + several Claudes)
- Never commit straight to `main`. Make a branch (`yourname/what-it-does`), commit, open a pull request; the owner
  merges. Keep each PR about ONE thing: small PRs merge without conflicts.
- Pull `main` before you start. Don't reformat or reorder code you didn't need to touch (it causes conflicts).
- Add new content in its own file or at the end of a table instead of rewriting shared files.
- Describe in the PR what changed for the PLAYER (with numbers) and how you tested it.
- NEW ITEMS ARE DESIGNED BY THE DEVS, NOT BY CLAUDE (owner's rule): build what they describe, and don't invent
  new items, effects or numbers they didn't ask for. If a design is missing something (tier, price, a number), ask in
  the PR instead of making it up.
- Balance: keep money tight, enemies readable (telegraph attacks), bosses challenging. When unsure about a design
  decision, write it in the PR and ask the owner instead of guessing big.
