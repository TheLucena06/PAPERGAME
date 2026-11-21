# PaperGame roadmap

Top-down roguelike: Dead Cells run structure + class builds, Terraria / Deltarune /
Binding of Isaac inspiration. Built for school lab PCs: one folder, opens from
`index.html`, fully offline. Claude keeps developing it phase by phase; every phase
ships as a playable zip. Content details with numbers: CONTENT.md.

## Phase 0 – Foundations  ✅
- Rooms can be bigger than the screen; the camera follows the players (co-op: keeps both in view).
- Every player picks their controls in solo and co-op: keyboard + mouse, gamepad (right stick aims),
  or keyboard-only with auto-aim (co-op only, left or right side of the keyboard).
- Controller setup screen for cheap / knockoff USB adapters (asks for each button and stick).
- Blueprints (items that only enter the shops after you find them).
- A small, rude new enemy and a secret.

## Phase 1 – The run (Dead Cells style)  ✅ (first 2 stages; the rest comes in Phase 6)
- ~5 stages per run, each visually different, with its own enemies, hazards and boss.
- After each boss, choose one of two paths. The last stage is full of mini-bosses, then the final boss.
- Special rooms: treasure rooms (often a mimic), a wandering merchant (buy now, or pay to reserve an item
  for the next shop), challenge rooms, risk/reward rooms.
- Every level ends in a special themed room. Between bosses: a big scrolling arena (survival waves or a mini-boss).
- Built so far: stage 1, a path choice, two different stage-2 paths (each with its own boss), merchant,
  treasure rooms, a risk/reward shrine, themed exit rooms, big arenas. Winning stage 2 = win the run (for now).

## Phase 2 – The Pencil Case  ✅
- A currency you keep between runs (shavings), and a tree of permanent upgrades (3 branches) that change how runs play.
- Blueprint drops add new items to the shops forever.
- Gear tiers: every boss beaten makes a stronger tier of weapons show up in the shops, for every sub class.
  (Tier 2 is in; tiers 3–4 arrive with stages 3–5. Arcane tiers come with the Arcane rework.)

## v2.1 – Playtest fixes  ✅
- Harder game (more/tougher enemies per level), harder + faster stage-2 bosses in smaller arenas, debug tuning.
- Gnome kit nerfed, Double Tomahawk moved to tier 2, Bone Tomahawks Test-Dungeon only, Flamberge replaces Paper Cutter.
- HUD fades when something is behind it. Tier stars instead of the "NEW TIER" banner.
- New inventory: numbers for every item, actions (equip/unequip/swap/sell), empty slots allowed.
- Controls: Arrows + mouse type (co-op default for P2), every keyboard key can be rebound (Controls menu).
- Camo Cloak can't be cheesed (hit enemies know where you are for 10 s). Throws near walls fixed.

## v2.2 – Boss rooms  ✅
- Every boss fights in a single-screen room (the player's call: tighter = harder). Survival arenas shrink to 18×12.

## Phase 3 – Arcane rework + new Arcane classes
- Slower, more deliberate Arcane combat; attack speeds become more varied the deeper you go.
- New subclasses (Mage, North Wizard, Druid, Necromancer, Witch, orb/tome casters...), mega spells (100+ mana),
  class set bonuses (more items of one subclass = stronger bonuses).

### Phase 3a (done)
- Arcane is slower at first and speeds up with tiers. Orbs and tomes are new Arcane weapon types.
- One big Mage class with 3 build directions (arcane bolts, storm, fire) + the new North Wizard.
- Mega spells (Starfall, Thunderstorm, Inferno, Snowgrave) and set bonuses for every sub class.
- Every existing sub class can now fill every slot (Berserker got a full set).
- Melee is stronger against bosses: bonus damage, projectile swords, and the Warden's ball can be knocked back.

### Phase 3b (done)
- Necromancer, Druid and Witch, each with a full set and mega spells; the Monk's Aura Dragon.
- Plain bolt weapons leave the shops at ★★★; hidden element reactions between items.

### Phase 3c – Mobile (done)
- Phones and tablets (Android + iPhone), landscape: floating move/aim sticks (Brawl Stars style),
  dash / skill / item buttons, double-tap the aim stick to swap weapons, editable touch layout.
- Same files as the PC version; hostable for free on GitHub Pages (HOSTING.md). Installable to the home screen.
- Later: co-op on phones.

## Alpha 3 – The Necrotery (stage 3)  ✅
- A dark graveyard crypt: the room is almost black except around you, your shots (magic glows more), lit torches,
  burning floors and explosions. Enemy eyes glow so you always see threats. Brightness setting on the main menu.
- Torches on the walls: hit them with anything to light them. Light every torch in a room for a small reward.
- New room shapes: long vertical halls and side galleries (the camera scrolls), cross-shaped crypts.
- Skeletons (sword, archer, shield guard) + Dark Skeletons that get back up 1–2 times (burn the bones to stop it),
  the Necromancer, Candle Wisps (fly through walls, blow out torches) and Phantoms (drift through walls, then lunge).
- Boss: THE DEAD TITAN. Skull in the wall; wall-bursting punches, fist slam + shockwave ring (dash through it),
  ribcage traps, spinning beams from the middle, summons, and a roar that blows out every torch. Phase 2 at half HP.
- Boss loot: Titan's Wrath (mega spell) and the Titan Ribcage (armor). Fire attacks now leave the floor burning.
- The run ends after the Dead Titan (for now). Next: ★★★★ gear tier for after boss 3.
## Phase 4 – Melee: Paladin, Heavy, Samurai, more shields, late-game sword projectiles.
- Heavy is MERGED into Berserker (owner, Alpha 3.2). Berserker = big, slow, hits hard; only axes get the low-HP boost.
- Started early: Tower Shield (Berserker). Raise to block 60% (walk slower), hold 0.7 s and let go to slam it into
  the ground (area damage + stun), dash-attack = shield bash. More Heavy: big swords, huge hammers, lava/rock.
- Full list of what the original brief still asks for: VISION.md ("Not built yet").

## Phase 5 – Precision: Ninja, a throwable shield, Outlaw (pirates, cangaceiros, cowboys, desperados, bushrangers).

## Phase 6 – Remaining stages, bosses, the final stage and final boss.

## Phase 7 – Bug hunt (automated playthroughs + fixes).

## Phase 8 – Menu polish (clearer, more satisfying menus; gamepad-friendly menus everywhere).

## Friend classes (designed by the owner's friends, in Portuguese; built in English for now)
- Cupid (Arcane) by Nicolas: DONE in Alpha 3.2 dev. Has no armor yet (set bonus stops at 4) - ask Nicolas for one.
