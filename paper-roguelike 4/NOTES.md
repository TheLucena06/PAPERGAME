# NOTES — Paper-craft roguelike

## Current progress
- Phase 1: DONE (player, aim, shooting, chaser, HP, game over, restart).
- Phase 2: DONE. Multi-room levels (5–8 rooms, minimap), locked doors until cleared, exit hatch, 4 enemies (Runner, Shooter, Charger, Tank) with telegraphs, cover blocks, scaling, 15% heal per cleared room.
- Phase 3a: DONE. Weapon select, Bow/Sword/Staff, dash, mana, HUD, coins.
- Phase 3b-1: DONE (fix: consumable stacks / duplicates). New controls, loadout slots, shared inventory (Tab, pauses), consumables, 4 skills, 4 armors, 13 passive buffs, shop after every level (menu with per-player cursors, reroll, inventory), free buff pick, melee parry, basic shield (Buckler), 7 weapons.
- Phase 3b-2 BETA: BUILT, waiting for confirmation. Melee remake (Knight + Monk items), new systems: defense, crits, dodge, timed effects, coin bonus, homing shots, dash skills, combo inputs (double-tap spin kick, every-3rd heavy), shop level gating, unique weapon visuals. Mana fast regen 20/s, Wand = arcane starter, room-clear heal popup.
- Phase 3c (boss 1): BUILT, waiting for confirmation. The Bookworm after level 3.
- Post-boss enemies + Precision class: BUILT, waiting for confirmation. 6 post-boss enemies, Archer + Hunter item sets, shop redesign, selling, perf patch (F8 overlay).
- Save data + meta: BUILT, waiting for confirmation. Main menu "PaperGame", Pencil Case (kits; permanent upgrades later), Bestiary, starter kits (Knight/Monk/Archer/Hunter), localStorage save + export/import file, debug save tools. Removed: Dagger, Iron Plate, Shield class (Guardian Mail, Paper Barrier). Buckler = Melee · Knight · Shield.
- Local co-op (keyboard share, 2 players): BUILT, waiting for confirmation.
- AUTONOMOUS DEVELOPMENT from here (user asked Claude to keep building). Plan: ROADMAP.md (spoiler-free). Content details: CONTENT.md (no more spoiler hiding: the user asked to be part of the design again).
- Phase 0 (foundations): BUILT.
- Roadmap Phase 1 (run structure): BUILT. 2 stages (stage 2 = path choice).
- Roadmap Phase 2 (Pencil Case, blueprints, gear tiers): BUILT.
- v2.1 playtest fixes: BUILT.
- v2.2: boss arenas = one screen (15x10), survival 18x12.
- Phase 3a + 3b: BUILT, waiting for feedback. Next: Phase 4 (Melee: Paladin, Heavy, Samurai, shields).
- Phase 3a: BUILT. Sorcerer + Pyromancer merged into Mage (user: fewer arcane classes, more builds per class). Next: Phase 3b (Necromancer, Druid, Witch, Monk mega). Next: discuss boss mechanics with the user, then stage 3 / Phase 3.

## Co-op (2 players, one keyboard)
- Main menu: Play (always starts as 1 player). The start select has a 1 Player / 2 Players switch at the top right; only an explicit 2 makes a co-op run. Start select: P1 picks (mouse or number keys), then P2 (arrows + K/L/Enter, or number keys).
- P1 = keyboard + mouse (unchanged). P2 = keyboard only, AUTO-AIM (nearest enemy it can see within 520 px, sticky; otherwise the way it walks; ring marker on the target). P2 keys (CONTROL_LAYOUTS.p2 in controls.js): arrows move · K attack (hold) · L dash · J swap · I / O skills · U item · P inventory · Backspace back. Numpad alternatives: 0 attack, 1 dash, 2 swap, 4/5 skills, 6 item, + inventory.
- Shared coins and stash (as before). Shop/inventory/buffs already had one cursor per player.
- A player who dies is "knocked out" (panel dimmed) and comes back with 35% HP when the room is cleared or the boss dies. Game over only when both are down.
- Balance (GAME_CONFIG.coop): room enemy budget x1.6, max enemies per room x1.5, coins per enemy x1.4, boss coins x1.4 x1.6. Measured gold per room: 2.1x (level 1) to 2.3x (level 8) of solo. Boss HP was already +60% per extra player.
- HUD: P1 panel top-left, P2 panel top-right (orange), colored ring under each player.
- Risk: some cheap keyboards can't register many keys at once ("ghosting"). Arrows + K/L + WASD + Space is usually fine.

## Controls (keyboard + mouse player)
- WASD move · mouse aim · LMB attack · RMB swap weapon · Space dash (movement, NOT a skill)
- Q skill 1 · E skill 2 · F consumable · Tab inventory (pauses)
- Menus: WASD cursor · Space/Enter/click confirm · Esc/RMB back · Tab inventory (in shop)

## Design decisions
- Combat-focused, not pure bullet hell. Readable wind-ups, punish windows.
- Goal: local co-op on one PC. Player 2 will need keyboard aim / auto-aim / gamepad (decide in co-op phase).
- Slots per player: weapon 1, weapon 2, armor, skill 1, skill 2, consumable. Passive buffs = unlimited, not a slot.
- Inventory and coins are SHARED by the team. During a level, Tab can only change the consumable; everything else is equipped in the shop.
- Consumables: the F slot holds a real stack (e.g. Bomb x4). That stack is NOT also in the shared inventory: every item is in exactly one place. Used up = slot empties. Buying an item: goes into your F slot if it's empty or the same item, else into the shared inventory. Picking another item in the inventory swaps the stacks.
- Items have a main class (Arcane, Melee, Precision, Shield) + sub class (Knight, Monk, ...) + weapon type tag (Sword, Fist, ...). Monk is a Melee subclass. Bonuses can target class, sub or type (classMods).
- Starters: Bow, Blacksmith's First Sword, Wand (no scroll starter).
- POST_BOSS_1 items show up from the shop after level 3 (where boss 1 will be).
- Defense: % damage blocked, total capped at 60% (Low 5% · Medium 12% · High 20% · Very high 28%+). Crit = 2x damage. Dodge only works on hits up to 25% of max HP.
- NO tag-threshold synergies: every bonus is written on the specific item/armor/weapon/buff (e.g. "Arcane weapons cost 25% less mana").
- Shop: after every level for now (later: after bosses). Menu browsed by every player at once (own cursor). Solo stock: 3 weapons, 2 consumables, 2 skills, 2 armors. Co-op: 5 weapons. Reroll cost 5, +5 per reroll in the same visit. Bought items go to the buyer's empty slot, else the shared inventory. Then each player picks 1 free buff out of 3 (separate choices).
- Mana belongs to every player; upgradable via armor/buffs.
- Bow: taps weak; 1 s = heavy fast arrow; 2 s = pierces.
- Staff: nothing at 0 mana; short delay between bolts; mana always regenerates, faster after 1 s without spending.
- Melee parry (all Swords, Dagger): attack during a dash (or up to 0.15 s after) = reflect enemy bullets in the arc (1.5× damage) and 2× damage to charging enemies.
- Shields: hold attack to raise. Basic shield (Buckler): covers 180° in front, blocks 40% when raised, no slowdown, no bash. Raising within 0.2 s before a hit = parry: no damage, attacker stunned 2 s + tiny damage. Re-raise delay 0.35 s (no spam-parry). Future shields will each be unique (bash, slow, etc.).

## Bosses
- Flow: a boss after every 3rd level (GAME_CONFIG.bosses: every 3, order ['bookworm'], repeats with level scaling). Level 3's exit hatch → SHOP (no buff pick) → boss arena (one open room, no doors) → boss dies → heal 50%, big coin drop, hatch → LOOT SHOP (normal stock incl. post-boss items + ALL of that boss's loot at once, purple "BOSS LOOT" cards) + free buff → level 4. Normal levels: shop + buff as before.
- Post-boss gating: items with postBoss: POST_BOSS_1 (=1) only appear once 1 boss is beaten (scene.bossesBeaten). bossItem: 'bookworm' = only in that boss's loot shop (beat it again on a rematch = offered again).
- Warning fix: the worm stops under the warning spot and bursts out exactly there.
- Boss 1 — The Bookworm (top-down Eater of Worlds): 28 segments (head 160 HP, body 100, tail 80 at level 1; × enemy level HP scaling; +60% per extra player). Burrows under the floor and inside the walls (can't be hit; you see moving dirt), shows a red crack warning (0.75 s) where it will burst out (60% floor near the player, 40% out of the wall nearest the player), lunges at the player 1.2–1.7 s, flies straight 0.5 s, then dives back (leaves holes). Hitting a wall while surfaced = digs into it.
- Killing a body segment SPLITS it: the segment behind becomes a new head (new worm). Killing a head = next segment becomes the head. Shorter worms are up to 35% faster. Surfaced body segments drop slow ink spit (9 dmg). Contact: head 22, body 12, tail 8. Each segment drops 1 coin, defeat drops 40.
- Boss parts can't be stunned (they only "count" as stunned briefly so Kaan Sai can target them). A surfaced lunging head counts as "dashing" → sword dash-parry does 2x.
- Test: GAME_CONFIG.debug.bossNow = true (with startLevel 3 for correct scaling).
- Bookworm loot (95 / 95 / 90 coins):
  - Devourer Sword (Melee · Bookworm · Sword): 36 dmg, 0.5 s, 135°, parry. Each kill while holding it: 30% chance to summon a wormling (max 3 alive, 10 s, 40 HP, bites for 8 every 0.4 s ≈ 20 dps each; wormling kills don't summon more). Enemies and the boss target wormlings; touch damage and enemy bullets hurt them.
  - Dorsal Bow (Precision · Bookworm · Bow): homing arrows; 0.65 s full shot (30 dmg), 1.4 s pierces 2.
  - Burrow (skill, Boss · Bookworm): 45 mana, 9 s cd. 2 s underground (invulnerable, free movement at 130% speed, no attacks); press again to come up early. Coming up: 35 dmg + big knockback around you.

## Post-boss enemies (all postBoss: 1 → only after beating boss 1)
- Bomber: keeps distance, lobs a bomb over walls to where you stand (red circle = landing spot). Direct hit 16 + blast; if it misses, the bomb sits on the floor blinking (2.2 s fuse), then explodes (80 radius, 20).
- Chained Prisoners: a fast pair (speed 180) joined by a chain (rope physics, wraps around walls/blocks, never passes through). Pair attack "clothesline": they line up side by side in front of you with the chain tight, flash (red lane shown), then run THROUGH you so the chain sweeps across you, rest, repeat. A MOVING chain hurts (12); a still chain is harmless. When one dies, the other swings the chain like a flail (wind-up arc shown, 200° swing, 16).
- Big Inkblob → 2 Inkblobs → 2 Inkdrops each (7 enemies total). They hop toward you.
- Gale (whirlwind): starts a whirl from up to 560 px away, then pulls players in for 2.4 s (no damage). Pull: 80 at 380 px, 205 near the middle (you walk at 220), and a weak 65 anywhere further it can see you. Walking out is slow, a dash gets you out.
- Pyre Acolyte (id 'warlock'): hooded caster with a flame on its robe (own texture, so it doesn't look like a Runner). Close range. Shows a 120° cone, locks aim 0.25 s before casting, then breathes fire (12 + Burning 3 s, 3 per 0.5 s, reduced by defense).
- Pyre Warlock (ELITE, id 'fireWarlock'): 170 HP, gold frame + crown. From far away shoots 2 arcs of 9 fire bolts (14 + Burning; the 2nd arc's gaps are shifted). Up close (< 150) breathes a stronger fire cone (18). Max one elite per room (def.elite).
- All enemies: if they lose you (out of reach / Camo Cloak), an attack that already started finishes (aimed at where they last saw you), then they wander around slowly.
- Small Worm: a 7-segment mini Bookworm (same burrow/warn/surface behavior, splits too, no spit). The room is not cleared until every small worm is dead.

## Precision item sheet (beta values)
Archer:
- NO aim assist on Precision weapons (Dorsal Bow is still homing: that's its boss-loot identity). Arrows/bolts have a slightly bigger hitbox (ARROW_HIT_RADIUS 7 in weapons.js).
- Short Bow (starter, 30): taps weak; 1 s = 60; 2 s pierces 4.
- Long Bow (L2, 40): 1.4 s = 95; 2.4 s pierces 6.
- Mana Bow (post-boss, 95): 1.2 s = 105; full shots also spend 14 mana on a 2nd arrow fired 0.14 s AFTER the first, on the same line: a mana arrow (55) that explodes (75 radius).
- Crossbow (post-boss, 90): works like a gun. Hold attack (when empty) to load up to 3 bolts (0.45 s each); letting go KEEPS them (also through swaps and rooms). A click fires ALL loaded bolts at once (4° spread), 45 each.
- Extra Loaded (skill, L2, 40): 70 mana, 18 s cd. 10 s: every shot fires 3 arrows.
- Prop Target (skill, post-boss, 45): 35 mana, 12 s cd. Decoy (90 HP, 8 s) that enemies target first and can break.
- Mercury Dip (item, 14): 60 s: Precision +12% damage, arrows/bolts slow enemy movement and attacks.
- Training Archer Robes (L2, 40): def 12%, loading +25%, Precision +15% dmg.
- Agility Cloak (post-boss, 85): def 8%, dash -30% / skills -25% cd, +30 mana, +15% atk speed, Precision +20% dmg.
- Dragon Hide Cloak (post-boss, 110): dodge 25%, def 22%, +20% dmg with everything.
Hunter:
- Hunter Knife (L1, 30): short sword (melee kind): 20 dmg, 0.3 s, reach 78 (= starter sword), 110°. 50% chance to Injure: bleed 4 per 0.5 s for 3 s + 30% slow 1.5 s. While held: +15% move speed, dash cooldown -35%.
- Tomahawk (L2, 40): throw (40), pierces, knockback; enemies knocked into a wall are stunned 1.2 s. Sticks briefly, then flies back (or walk over it to pick it up).
- Double Tomahawk (post-boss, 90): 2 axes, 36 each.
- Winchester (post-boss, 100): 2 shots, 75, pierce 8, knockback, slow, Injured (bleed 4 per tick, 4 s). Empty: hold attack 1.6 s to reload.
- Crippling Crossbow (post-boss, 95): same loading as the Crossbow. A bolt hitting an enemy you haven't marked: 28 + mark (6 s) + slow. Hitting a marked enemy: 50 +60%. So a 3-bolt volley = 28 + 80 + 80.
- Hog Call (skill, post-boss, 50): 50 mana, 20 s cd. 1 hog per Hunter item equipped (max 5), 12 s, bite 14 + big knockback.
- Bear Trap (item, 16, x2): placed at your feet, arms in 0.5 s. 90 dmg (× your damage), stun 1.8 s, then slowed 35% for 4 s.
- Apprentice Hunting Gear (L2, 40): def 10%, Hunter +20% dmg, tomahawks return almost instantly.
- Camo Cloak (post-boss, 90): enemies notice you only within 240 px, def 15%, +10% speed, Hunter +20% dmg, +30% more while standing still.
- Solo Hunting Gear (post-boss, 95): def 22%, loading/reload +30%, Hunter +30% dmg, fast tomahawk return.
Removed: Leather Vest, Volley (replaced by the new Precision items).

## Phase 0 tech (camera, controls, blueprints)
- Rooms: RoomManager.setSize(cols, rows) per room (room.cols/rows, default 15x10 = one screen; max 48x32). room.layoutRows = generated inside (RoomGen.arena). GameScene.applyRoomSize() sets physics bounds, floor, coin area, camera bounds. updateCamera(): fixed for one-screen rooms; else smooth follow of the living players' midpoint; co-op players are held inside the view.
- Screen-space objects (HUD, menus, test panel) use setScrollFactor(0). Container children that take clicks need it too (TestPanel does this).
- Mouse aim converts the pointer to world coordinates every frame (camera may scroll).
- Controls: CONTROL_TYPES (kbm, keysLeft, keysRight, pad0, pad1), Controls.fix/next/clash/make (controls.js). Solo can't pick keyboard-only (auto-aim). Choice per player on the start screen, saved in SaveData.settings.controls.{solo,coop}.
- Gamepads: GamepadController reads navigator.getGamepads() (no Phaser plugin). PadBindings: per controller id map {buttons{attack,dash,swap,skill1,skill2,consumable,inventory,back}, moveX/moveY/aimX/aimY {axis, sign}, dpad}. Standard-mapping default (R2 attack, X dash, Tri swap, L1/R1 skills, Sq item, Start inventory, O back). PadSetupScene asks for every stick/button (duplicate check, S skip, Backspace redo) and saves to SaveData.settings.pads. SaveData.reset keeps settings.
- Blueprints: SaveData.blueprints; items with `blueprint: '<id>'` never appear in shops until SaveData.unlockBlueprint(id).
- Kits can include a skill (kit.skill). Secret kits (kit.secret) don't unlock from gear and show as "???" with a hint.
- Mining: weapon def `mines: true` -> ctx.mineAt(); RoomManager.breakBlockAt() (blockAt[] per tile, room.mined remembers). Stats mineCoins / mineHeal.
- Minecart = skill kind 'minecart' -> SkillSystem dash mode 'cart' (bounces, rehit cooldown, invulnerable).

## Phase 1 tech (run structure)
- js/stages.js = data: RUN_PLAN, STAGE_TYPES (look, enemy pool, boss, themes, champions), THEMED_ROOMS,
  ARENA_TYPES, CHAMPION, SPECIAL_ROOMS. Add a stage = add an entry + list it in RUN_PLAN.stages.
- GameScene.run = {stageNum, stageId, step, levelNum, path, reserved}. startRun → runStep → (hatch) → advanceRun.
  stage() falls back to the notebook when there's no run (Test Dungeon).
- js/specials.js = RunRoomsMixin (merchant/chest/shrine props, themed waves, arenas, enemy bosses, shared boss bar).
- js/foes2.js = stage-2 enemies + bosses (normal ENEMY_TYPES with def.boss / miniBoss / bossPart) and their textures.
- js/runmenus.js = PathMenu + MerchantMenu.
- Enemy bosses use the same bar as the worm boss through an adapter (startBar / endBar). The fight ends when every
  enemy with the bar's tag is dead.
- Hatch: must be stepped OFF once before it works (hatchArmed) and onHatch ignores repeats → no instant or double exits.
- Arena/boss rooms are generated on the fly (map with one room). Players start near the bottom, camera snaps.
- Projectile pools are removed only outside the ROOM (setArea in applyRoomSize). Before: hard-coded 960x640 → shots died instantly in big rooms.
- Phase 3c (mobile): BUILT. Touch controls, layout editor, magnifier, PWA files, HOSTING.md. Next: Phase 4.

## Phase 3c tech (mobile)
- js/mobile.js (after controls.js): IS_TOUCH (pointer: coarse + touch points, or ?touch), CONTROL_TYPES.touch
  (solo only; default on touch devices; Controls.allowed / fix / make wrapped), TOUCH_LAYOUT_DEFAULT
  (960x640 coords), TouchLayout (SaveData.settings.touch[id] = {x,y,s}), TouchController (poll() over
  scene.input.manager.pointers; same state/menu shape as KeyboardController), Magnifier (DOM canvas copy of the
  game canvas, needs render.preserveDrawingBuffer = IS_TOUCH), touchHoldGuard(fn) (no click after a hold),
  MobileScreen (Android fullscreen + landscape lock on first touch), TouchLayoutScene.
- main.js config: input.activePointers 4. Service worker (sw.js, network-first, cache papergame-v1) only on http(s),
  so file:// on lab PCs is untouched. Bump the cache name only if old files get stuck.
- index.html: viewport no-zoom, manifest, apple tags, #rotate overlay for portrait.
- Tests: CDP Input.dispatchTouchEvent (scratchpad tmob2.py). Double tap: tap < 350 ms, gap < 420 ms.

## Phase 3b tech
- js/arcane3b.js (after allies.js): textures (Arcane3bTextures in Boot), ally types skeleton + auraDragon
  (ALLY_TYPES tailTex/scale; AllyManager pool 16; allyDamage stat), Necromancer/Druid/Witch data, set bonuses.
- Reactions: GearFx.applyAll(scene, e, shotOrArea, owner, dmg) = react() first (needs e.burnUntil / chillUntil,
  set by GearFx.ignite / GearFx.chill with scene.time.now), then statuses. Tags: ignite=fire, chill=ice,
  chain|shock=shock, wind. Hex (e.hexUntil, x1.25 in hitEnemy), poison (bleed, no element).
- New stats: allyDamage, raiseChance (GameScene.onEnemyKilled), hexTime, hexChance. GameScene.roomKills.
- Skill kinds raiseArmy, harvest; tome page types summon / point / nova (+ heal); zone heal; burst drain.
- def.phaseOut (ShopLogic.unlocked), def.borrow (Archmage Staff, GearFx.borrowed).

## v3a.2 tech
- Merchant: run.merchant = {stage, state unseen/met/ordered/done, order[{cat,id,player,paid}], step}.
  GameScene.runStep -> planMerchant() sets this.merchantHere ('sell' | 'deliver' | null; 'gone' after delivery);
  advanceRun -> merchantStepEnd(). The merchant is its own sprite (this.mprop), so it can stand in a level room
  (room.type merchant, opts.merchant in LevelGenerator) or in a cleared arena next to the reward chest.
- Reflect: WeaponSystem.reflectShots (parry swings + every frame of the melee dash-attack window, Player.reflectMs).
  Reflected bullets have b.reflected; enemy def.reflectWeak multiplies their damage (King Inkblot / Princes x4).

## Phase 3a tech
- js/gear3.js (after skills.js): WeaponSystem.castShot(p, ctx, shot, angle) = one call for count/spread/pierce/
  homing/aoe/knockback/ignite/chill/chain/stun shots (GearFx.applyShot; effects on hit: GearFx.onBulletHit).
  GearFx.burst = circle hit (skills, tome novas). Weapon kinds orbit + tome. Skill kinds shot, burst, blink,
  zone, storm, freezeAll (+ d.mega -> SkillFx.mega banner/flash). ZoneManager (GameScene.zones; cleared on room change).
  SET_BONUSES + Stats.sets; Stats.build wrapped to add set mods. Stats.countSub now counts the item slot too.
  New stats: bossDamage, lifeSteal (GameScene.hitEnemy).
- js/arcane.js: textures (ArcaneTextures.make in Boot), reworks of staff/wand/fireball, all new gear data.
- Projectile weapons now go through castShot (weapon def = shot def; one shot: spreadDeg = random wobble).
- Bullets have ignite/chill/chain/stunHit (reset in ProjectileManager.fire). Careful: a killed bullet can be
  re-used by the next fire() in the same call, so copy its fields first (see GearFx.onBulletHit).
- Melee: wd.bossMul (default 1.25 for class melee), wd.rage; projectileEvery uses castShot (count/homing...).
- Warden reflect: Player.reflectMs (450 ms after a dash); melee behavior calls EnemyManager.reflectBall every
  frame while attack is held in that window; warden AI state 'ballBack' -> hit (reflect.hpPct) + stunnedMs.
- Enemy frozenMs (Snowgrave) = icy tint while stunned.

## v2.1 tech
- controls.js: KEY_SCHEMES (kbm, arrowsMouse, keysLeft, keysRight) + KeyBinds (saved overrides in
  SaveData.settings.keys) + one KeyboardController for all of them (mouse aim or auto-aim). Controls.clash =
  shared keys or both need the mouse. Controls.hint(type) builds help text from the real keys.
  ControlsScene (menus.js) = rebinding screen (main menu "Controls", start screen "Keyboard keys").
- inventory.js: TierStars (stars = tier+1, gold = newest), ItemStats.lines (numbers per weapon kind / armor / skill),
  InventoryMenu rewritten: select -> details + action buttons. Loadout.swapSlots. Empty weapon slots are allowed.
- hud.js: each player panel has its own graphics + objs list; Hud.covered(rect) fades panels/minimap to 22%
  when a player, enemy, enemy shot or worm segment is behind them.
- Debug menu is 2 columns: enemyHpPct, enemyDmgPct, bossArenaPct (GAME_CONFIG.debug), used by
  EnemyManager.setLevel and startEnemyBoss.
- Items can have debugOnly: true (only in the Test Dungeon, where Meta.off is true).
- TestPanel.contains(pointer) only blocks attacks over its real buttons.

## Phase 2 tech (Pencil Case, blueprints, tiers)
- js/meta.js: SHAVINGS_EARN, UPGRADE_TYPES (+ UPGRADE_BRANCHES), BLUEPRINT_TYPES, BLUEPRINT_DROP, Meta (rank/earn/buy/
  refundAll, effect helpers, rollBlueprint). Stored in SaveData.data.meta = {shavings, total, upgrades}.
- Meta.off = true in the Test Dungeon (no upgrades, no shavings, no blueprint drops there).
- Upgrade hooks: Player.metaMods (Stats.build), Player.erasers (die()), GameScene create (coins, potions), openShop
  (Piggy Bank, freeReroll), startRun (Supply Run), onRoomCleared (Second Wind), Meta.merchant*/shrineHpPct/treasure*.
- Blueprint drops: specials.js dropBlueprint/updateBlueprints/collectAllBlueprints (auto-collected on room change,
  hatch and game over, so they are never lost).
- Tiers: item postBoss N = shop tier N. ShopLogic.tierWeight favors the newest tier; shop cards show "★ NEW TIER".
  ShopLogic.maxTier() = Test Dungeon shop tier. Debug menu: "Bosses beaten (tiers)", "+200 shavings", "All blueprints".
- New weapon features: execute, bleedBonus (melee), heavyWave, spinKick.ring, auraShot.count/spreadDeg,
  fullFan (bows), injure + flyTexture (throws). WeaponSystem.fan() = n shots spread over an angle.

## Save data (js/save.js)
- localStorage key 'papergame.save.v1': { version 1, kits: {id: true}, bestiary: {id: {seen, kills}}, stats: {runs, bestLevel} }. Works on file:// (Chrome/Edge) but only in that browser on that PC → main menu has Export save (downloads papergame-save.json) / Import save (file picker). All offline.
- Writes: right away for new kits / new bestiary pages; kill counts every ~2 s, on room clear, boss, game over, and when the tab is closed/hidden. Test Dungeon never records anything.
- Starter kits (KIT_TYPES): Knight = Blacksmith's First Sword + Knight Armor · Monk = 1st Martial Arts Scroll + Monk Vest · Archer = Short Bow + Training Archer Robes · Hunter = Hunter Knife + Apprentice Hunting Gear.
- Unlock (Kits.check, every 0.5 s in a run): every slot holds items of that sub class ("Any" items of the same main class count, e.g. Sharpening Stone for Knight/Monk). If the sub class has fewer items of a kind than slots (Hunter: 1 skill), only that many are needed and the other slot must be empty. Adding items later updates this automatically. Boss loot never counts.
- Bestiary (js/bestiary.js): BESTIARY_ENTRIES in page order; known after first seen (spawn). Stats/abilities read from ENEMY_TYPES/BOSS_TYPES. Unknown = dark silhouette + "(unknown)".
- Screens (js/menus.js): MainMenuScene → WeaponSelectScene ("Choose your start": one row. An unlocked kit REPLACES its basic starter (Short Bow → Archer, Sword → Knight); Monk/Hunter kits are added once unlocked; locked kits are not shown) → GameScene → GameOverScene (R = again, M = menu). PencilCaseScene, BestiaryScene (A/D turn pages).

## Debug menu + Test Dungeon
- Type "debug" on the main menu or the start select. Save tools: Unlock all kits, Reveal bestiary, Delete save (click twice).
- Type "debug" (old note: on the weapon select screen). Settings (start level, coins, start in shop, boss now, count skipped bosses, post-boss only, god mode) last until the page is reloaded.
- TEST DUNGEON: one closed room, nothing spawns on its own. Side panel ([T] hides it): spawn any enemy (x1/x3), clear, boss, god, level ±, +500 coins, shop, room layout, cycle player 1's weapons/armor/skills/item. Code: js/debug.js (DebugMenu, TestPanel) + GameScene.startTestDungeon / startTestRoom.

## Shop / selling
- Shop stock is always 4 weapons, 3 armor, 2 skills, 2 items (solo and co-op). If a level has fewer unlocked items (level 1 has 1 armor), the next items to unlock fill the gap. Boss loot is shown on top of that.
- Shop: small cards (name, class, price) on the left, big detail panel on the right (one per player in co-op), Reroll / Inventory / Ready buttons under it.
- Selling: only in the shop's inventory ("Sell items" toggle, per player). Half price (SELL_RATE in inventory.js). Consumables sell one at a time for half of one unit's price. You can't sell your last weapon.

## Performance
- Profiled: no leaks (object count, memory and step time stay flat over many rooms). The slowdowns came from text: every setText re-uploads a texture to the GPU, and MP text changed every frame during regen. HUD text now refreshes max 5×/s.
- F8 = performance overlay (FPS, worst frame, objects, enemies, memory, renderer).
- If a lab PC is still slow: open index.html?canvas to force the Canvas renderer (bad GPU drivers).
- Below 20 FPS the game runs in slow motion on purpose (maxFrameMs 50) instead of teleporting.

## Melee item sheet (beta values)
Shared: Sharpening Stone (item, L1, 15): 60 s melee +20% dmg, 10% crit.
Knight:
- Blacksmith's First Sword (starter, 30): 24 dmg, 0.38 s, 120°, parry.
- Longsword (L2, 40): 34 dmg, 0.55 s, longer reach, 150°, parry.
- Knight Armor (L2, 40): def 20%; holding Melee: +12% speed, +15% dmg.
- Lunge (skill, L3, 40): 25 mana, 5 s. Homes through 2 + Knight items (max 6) enemies; 2.5x weapon hit with a Knight weapon, else 15.
- Onslaught (skill, L2, 40): 20 mana, 5 s. FLURRY: plant your feet, 5 slashes in front over ~0.8 s, each 0.6x your sword hit (6 without a sword), last one big knockback; -30% damage taken meanwhile.
- Dragonsteel Longsword (post-boss, 90): 46 dmg; every 3rd swing in a row = heavy slash 110, stun 1.5 s.
- Enchanted Sword (post-boss, 85): 40 dmg, 130°; every 2nd swing fires a spectral sword (30, pierces 3).
- Blacksmith Armor (post-boss, 85): def 28%, skills -20% cooldown, Sword +20% dmg, Knight weapons +20% attack speed.
- Prince Armor (post-boss, 110): def 35%, +50% coins.
Monk:
- 1st Martial Arts Scroll (L1, 30): punches 24, max 2 targets, very close. Double-tap: spin kick 270°, 40, stun 1 s, big knockback, 2 s cd.
- 2nd Martial Arts Scroll (post-boss, 80): 30 dmg, more reach; same target again = +8%/hit up to +80%. Spin kick 55.
- 1st Aura Scroll (L3, 40): punches + 5 mana per punch for an aura fist (18, pierces 3, short range).
- 2nd Aura Scroll (post-boss, 85): punches 28 + 6 mana per punch for a homing aura sphere (24).
- Monk Vest (L2, 35): def 5%, +20% atk speed (+35% Monk), 15% dodge, +25 mana, +30% regen.
- Amulet Robe (post-boss, 95): def 15%, dodge 20%, +40 mana, +60% regen, +20% atk speed (+35% Monk), Monk +20% dmg. Dash → 3 s Amulet Rush (+20% speed, +15% dodge, +20% atk speed). Enemies that hit you get stunned: 800 ms × 35 / their max HP (0.15–1 s). TODO sound: special hit sound.
- Aura Push (skill, L2, 30): 25 mana, 6 s. Radius ~2 tiles: 8 dmg, stun 1 s, huge knockback (tanks don't move).
- Kaan Sai (skill, italic, L3, 40): 30 mana, 6 s. Dashes into every stunned enemy nearby (max 6), 30 each; none stunned = kick nearest.
- Pocket Sand (item, L1, 14, x2): stuns the 3 nearest enemies for 4 s.
- Mana Candle (item, L1, 14): 60 s mana costs -30% Monk / -20% others.
Old Arcane items (Wand, Mage Staff, Mage Robe, Fireball) and Whirlwind = placeholders until remade. Dagger, Iron Plate, Guardian Mail, Paper Barrier were REMOVED. Buckler is now Melee · Knight · Shield.

## Files
- index.html — loads phaser.min.js, then: controls, mobile, menu, items, weapons, skills, gear3, arcane, player, projectiles, coins, enemies, foes2, bosses, allies, arcane3b, hazards, chains, throwables, rooms, level, hud, inventory, shop, stages, save, meta, menus, bestiary, runmenus, specials, debug, main.
- phaser.min.js — Phaser 3.90.0, local copy. Never use a CDN.
- js/controls.js — KeyboardMouseController: poll() once per frame → controller.state (gameplay buttons) and controller.menu (menu input). Only place that reads keyboard/mouse.
- js/mobile.js — touch controls, layout editor, magnifier (Phase 3c tech).
- manifest.json, sw.js, icon-*.png — phone install / offline (website only). HOSTING.md = how to put it online.
- js/menu.js — MenuNav: per-player cursors over menu "nodes" (keys + mouse hover/click).
- js/items.js — POST_BOSS_1, STAT_DEFAULTS, ARMOR_TYPES, EFFECT_TYPES (timed buffs), CONSUMABLE_TYPES, PASSIVE_BUFFS, Catalog, Stats (final stats; classMods match class/sub/type; countSub).
- js/weapons.js — WEAPON_TYPES (incl. visual), WEAPON_BEHAVIORS (charge / melee / projectile / shield), WeaponSystem (arc hits with max targets, ramp, heavy combo, spin kick, spectral/aura shots, parry, shield check).
- js/skills.js — SKILL_TYPES, SKILL_BEHAVIORS (incl. homingDash, lineDash, push), SkillSystem (tryUse, dash-skill movement).
- js/player.js — PLAYER_BASE_STATS + Player (loadout, effects, stats, hp/mana, dash, takeHit with shield/defense/dodge/barrier).
- js/projectiles.js — ProjectileManager (pools; pierce, explode-on-hit, bomb fuse, homing).
- js/coins.js — CoinManager (coins go to team.coins).
- js/enemies.js — ENEMY_TYPES, ENEMY_AI, EnemyManager (pool, stun, parry hook, targets() = enemies + surfaced boss parts for all weapons/skills).
- js/bosses.js — BOSS_TYPES (bookworm, smallWorm) + BossManager (worm trail/path, burrow-warn-surface states, splitting, spit, holes). A second BossManager (scene.minorWorms, minor mode) runs the Small Worms.
- js/allies.js — ALLY_TYPES (wormling, hog, decoy) + AllyManager (pooled helpers that hunt enemies; enemies target them via EnemyManager.allies; taunt = preferred target).
- js/hazards.js — HazardManager: enemy bombs (lob → direct hit or ground bomb with fuse) and bear traps. Pooled.
- js/chains.js — ChainManager: Chained Prisoners' chain (verlet rope, wall push-out, tether, flail, speed-gated damage). Pooled.
- js/throwables.js — ThrowManager: tomahawks (fly → stuck → return / pick up, wall stun).
- js/rooms.js — ROOM_LAYOUTS (8 layouts; rules at the top of the file).
- js/level.js — LevelGenerator + RoomManager.
- js/hud.js — Hud: panel (HP/MP + slot bar + effect timers), minimap, enemy bars/stun dots, held-weapon visuals, swings, shield, barrier, explosions, warnings, float text. Drawing only.
- js/inventory.js — Team (shared coins + stash), SLOT_LIST, Loadout (equip rules), Selling, InventoryMenu (Tab screen, sell mode in the shop).
- js/shop.js — SHOP_SETTINGS, ShopLogic, ShopMenu, BuffMenu.
- js/save.js — SaveData (localStorage + export/import), KIT_TYPES, Kits (unlock check).
- js/menus.js — MenuUI helpers, MainMenuScene, PencilCaseScene, KitCard, WeaponSelectScene (start select).
- js/bestiary.js — BESTIARY_ENTRIES + BestiaryScene.
- js/stages.js — run/stage data (see Phase 1 tech).
- js/foes2.js — stage-2 enemies + enemy bosses (AI mixed into ENEMY_AI / EnemyManager).
- js/runmenus.js — PathMenu, MerchantMenu.
- js/meta.js — Pencil Case upgrades, shavings, blueprints (see Phase 2 tech).
- js/specials.js — RunRoomsMixin: special rooms, arenas, enemy bosses, shared boss bar.
- js/debug.js — DebugMenu (select screen) + TestPanel (Test Dungeon side menu).
- js/main.js — GAME_CONFIG, TextureFactory, BootScene, WeaponSelectScene, GameScene (modes play/inventory/shop/buffs, rooms/levels, collisions, hitEnemy (crits), onEnemyKilled (coin bonus), onPlayerHit (dodge text, Amulet stun), explode, onParry, useConsumable), GameOverScene.

## Art (sprite sheet)
- art/papergame-sprite-template.svg: Inkscape template, everything at 2x game size. Layers: 1 Guides (locked), 2 Current art (locked, 35%), 3 YOUR ART. Export: hide 1+2, File > Export > Page, PNG, 96 dpi.
- Players: 32x32 sprite box (hitbox stays 26). One look per armor (armor_<id>), shared by both players; P1/P2 'no armor' looks are separate. Weapons: only the weapon; charge rings, ammo pips, swing arcs stay code-drawn. Weapon red dot = player center (rotation point), at (24, 28) in the 96x56 box.
- art/sprite_map.json: where every sprite box is (x, y, w, h in the 2x sheet, game size, hand point for weapons). Used to slice the finished sheet.
- art/make_template.py + grab_textures.py: tools that rebuilt the template (dev only, not used by the game).
- Plan when the art comes back: slice the PNG by sprite_map.json, embed it as base64 in js/assets.js (file:// can't load .png files into WebGL), and swap TextureFactory textures for the drawn ones. Room = one background image + door / wall patch pieces on the door gaps + random obstacle variant per block tile.

## Rules
- Runs from file:// offline. Classic <script> tags only. No modules, npm, build step, CDN or network.
- No image/audio files yet; shapes only. Later: assets.js with embedded data.
- `players` array always (even with 1). Each player has its own controller.
- Game loop: poll controllers → (menu open? update menu, game paused) → input → logic with delta time → view.
- Content = data objects (ENEMY_TYPES, WEAPON_TYPES, SKILL_TYPES, ARMOR_TYPES, CONSUMABLE_TYPES, PASSIVE_BUFFS, ROOM_LAYOUTS).
- Anything that hits "all enemies" loops over EnemyManager.targets() (never enemies.group directly), so bosses are included.
- Every hit on an enemy → GameScene.hitEnemy() (boss parts are routed to BossManager.damage); every kill → onEnemyKilled(); every hit on a player → Player.takeHit(amount, fromX, fromY).
- Stats are rebuilt (Stats.build) only when gear changes, never per frame.
- Pools for enemies, bullets, coins, effects, hazards, chains, axes, allies. Caps in GAME_CONFIG. No per-frame allocations.
- Text objects: only setText when the value changed, and throttle anything that changes every frame.
- Menus are built once when opened/changed (not every frame).

## Tuning quick reference
- Rooms, enemy budget, scaling, heal per room: GAME_CONFIG (main.js)
- Test helpers: GAME_CONFIG.debug (main.js): startLevel, startCoins, bossNow, startInShop (start in the shop before startLevel), skippedBossesCount (starting at level 4+ counts skipped bosses as beaten → post-boss items/enemies), postBossShopOnly.
- Shops favor post-boss items after a boss: SHOP_SETTINGS.postBossWeight (2.5x).
- Enemy stats, coin drops: ENEMY_TYPES (enemies.js)
- Player base stats, dash: PLAYER_BASE_STATS (player.js)
- Weapons / skills / armor / consumables / buffs: their *_TYPES tables (prices are there too)
- Shop stock counts, reroll price, buff choices: SHOP_SETTINGS (shop.js)
