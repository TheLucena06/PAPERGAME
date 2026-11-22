# CONTENT – what is in the game, with numbers

(Was SPOILERS.md. No more secrets: the player is part of the design now.)

## Secrets
- Gnome kit: in ONE run, kill a gnome as the first kill of a room 5 times
  (GAME_CONFIG.secrets.gnomeFirsts). Unlocks the Gnome kit: Gnomish Pickaxe + Miner's Helmet
  + Minecart skill (all `blueprint: 'gnome'`: never in shops until the gnome blueprint is found –
  gnome kills drop the blueprint, 7%).
- A small "...n/5" pops over the gnome when it counts.

## Gnome (enemy)
- Rare (weight 0.7, cost 3, max one per room), from level 1, pre-boss too. ~20% of level-1 rooms.
- 55 HP, speed 255, weaves side to side, stab dash (20) when within 95 px, then flees 0.65 s.

## Miner items
- Gnomish Pickaxe: 24 dmg, 0.54 s, 3rd swing in a row = heavy (42, stun 0.4 s). Breaks obstacle blocks:
  1 coin each (the room remembers broken blocks).
- Miner's Helmet: 4% def, broken blocks give 2 coins and heal 1, +10% Miner damage.
- Minecart: 30 mana, 9 s cd. Ride 1.4 s, 22 dmg + big knockback, bounces twice, smashes blocks, invulnerable.
  (Nerfed in v2.1: the kit was far too strong, mining gave 6–12 coins per block.)

## Run structure (Phase 1) – js/stages.js
- RUN_PLAN: stage 1 = notebook, then path choice: sewer OR castle. Steps per stage: level, arena, level, boss.
  Run is won after the stage-2 boss (more stages in Phase 6). Debug startLevel maps 2 levels per stage.
- Shop after every level (+ buff unless the boss is next). Arena → straight to next step. Boss → loot shop + buff → path.
- Arena: survival 60 s in a tight 18×12 room (v2.2, was 36×24; max 12 alive), champion 32×22 (camera follows) (waves, timer bar) / champion (scale 1.9, ×9 HP, ×1.4 dmg, + escorts).
  Reward: coins + a real chest (never a mimic).
- Special rooms (dead ends, generated each level): merchant always; treasure 60% (of those 70% are MIMICS);
  shrine 35% (pay 25% max HP → pick a buff).
- Merchant (v3a.2): per stage section (level 1, arena, level 2) he SELLS at most once: step 1 50%, else step 2 60%,
  never first on the last step. You ORDER (pay now, ×1.3; Merchant's Friend ×1.15 / ×1.0; click again = cancel/refund)
  and he DELIVERS on the very next step (his room is on the minimap; in the arena he shows up after it's cleared).
  No order = gone for the section. Missed delivery = the items wait in the next shop (RESERVED).
- Themed exit rooms (waves): notebook wormNest/paperTigers/tankWall/crossfire; sewer flood/leechNest/whirlpool;
  castle prisonBreak/pyreRitual/siege.

## Stage 2 enemies
- Ink Leech (sewer): 26 HP, no contact damage; latches on: 3 dmg/0.5 s, −4 mana, −30% speed, up to 3.5 s.
  Hitting it knocks it off.
- Shield Guard (castle): 80 HP, shield arc 120° in front takes only 15% damage, turns slowly (2.6 rad/s) → flank.
  Bash dash 16.
- Mimic (treasure rooms, mini-boss): 420 HP, touch 9, hop slam (18) then stuck 1 s (dizzy dots), tongue lash (16), spit fan
  (5×9, its coins parried back hurt it ×3). Melee dash-attack into the tongue: it bites itself (6% max HP, 2 s stunned). Faster under 50%.
  Drops a better-than-average item + 20 coins.

## Stage 2 bosses (v2.2: every boss fights in a single-room arena, 15×10; debug "Boss arena size %" can enlarge it)
- King Inkblot (sewer): 2900 HP, hops (windup 0.52 s, landing 26 + ink drops), every 3rd landing a
  ring of 16 shots (2 rings under 50%). At 50% splits into 2 Inkblot Princes (800 HP each, faster).
  Weak spot: its ink shots reflected back (melee dash-attack window / parry) deal ×4 to the King and Princes. Loot: Blot Staff (orbs burst into 4 drops),
  Inkblot Crown (+20 HP, 8% def, 30% on kill: friendly ink drop for 9 s, max 4).
- The Warden (castle): 3000 HP, speed 105, ball-and-chain spin (3.2 s, r175, walks 100),
  ball throw (windup 0.46 s, 26 impact, range 560) + reel; enraged (<50%): 3 throws in a row.
  Cell trap: on you + 2 cells around you (4 when enraged), root 1.3 s, 12 dmg. At 50% releases chained prisoners.
  Loot: Warden's Flail (360° swing, 38), Lockdown skill (12 dmg + 1.8 s lock in 230 px).

## Phase 2: Pencil Case
- Shavings: level 2, arena 4, champion 3, mimic 4, boss 10+5×stage, win 20. Saved instantly (Meta.earn).
- Upgrades (meta.js UPGRADE_TYPES), total cost ~1175: Survival (Thick Paper +8 HP ×3, Spare Potion ×2, Second Wind +5% room
  heal ×2, Eraser = survive one knockout at 30%), Wealth (Pocket Money +15 coins ×3, Lucky Dice free first reroll,
  Piggy Bank interest, Merchant's Friend, Supply Run = shop before level 1), Discovery (Tracing Paper +25% blueprint
  drops ×2, Treasure Sense 85% treasure / 50% mimic, Graphite Pact shrine 15%, Bigger Menu 4 buff choices).
- Blueprints: Flamberge (Knight T0, replaced Paper Cutter), Recurve Bow (Archer T0), Boomerang (Hunter T0), Iron Knuckles (Monk T1)
  from champions 35% / mimics 50% / bosses 100% (if any left). Gnome Gear (pickaxe, helmet, minecart, Mithril
  Pickaxe T2) from gnome kills 7%.
- Tier 2 weapons (postBoss 2): Sunsteel Greatsword (heavy = 3 sun waves), Executioner's Blade (x2 under 35% HP),
  3rd Martial Arts Scroll (ramp +120%, spin kick ring of 8 fists), 3rd Aura Scroll (2 homing orbs), Composite Bow
  (150 + 2 side arrows), Repeating Crossbow (5 bolts), Double Tomahawk (moved here from tier 1), Machete
  (+40% vs bleeding), Mithril Pickaxe (gnome blueprint). Bone Tomahawks = debugOnly (Test Dungeon), maybe final stage. Shops: newest tier ×2.5, older tiers ×1.2, tier 0 ×0.6 after 2 bosses.

## v2.1 balance
- Level scaling: budget 5 + 1.9/level, enemy HP +22%/level, damage +15%/level (was 4 / 1.5 / 15% / 10%).
- Camo Cloak: an enemy you hit knows where you are for 10 s (e.awareOf / awareMs).
- Debug tuning: Enemy HP %, Enemy damage %, Boss arena size %.

## Phase 3a: Arcane rework, full sub classes, melee vs bosses
- Arcane only: tier-1 weapons are slow (Mage Staff 0.45 s, Wand 0.26 s, Ember Staff 0.52 s, Frost Wand 0.36 s);
  higher tiers faster (Archmage Staff 0.21 s, Chain Wand 0.15 s); slow heavy ones stay (Meteor Staff 0.9 s, 70 + area).
- Weapon types: staff / wand (hold = keep casting), ORB (kind orbit: hold = orbs circle you, drain mana/s; let go
  after 0.4 s = throw them), TOME (kind tome: every cast = next page/spell; pages: bolt, fan, nova).
- MAGE (v3a.1: Sorcerer and Pyromancer merged in; Twin Wands, Spark Orb, Ember Staff, Mana Surge, Static Charm removed).
  Three build directions inside one class:
  · Arcane bolts: Mage Staff → Runed Staff★★ → Archmage Staff★★★ / Meteor Staff★★★ · Crystal Orb★★ · Mage Robe,
    Archmage Mantle★★★ · Arcane Barrier, Blink★★, STARFALL★★★ · Focus Crystal.
  · Storm (fast sparks, chains, crits): Wand → Chain Wand★★★ · Storm Sash★★ (+1 chain jump, crit, attack speed)
    · Spark Nova, THUNDERSTORM★★★.
  · Fire (explosions, burning): Apprentice Tome → Flame Tome★★ → Phoenix Orb★★★ / Grimoire of Stars★★★ ·
    Ashen Robe★★ (burn +40% dmg, +30% time) · Fireball, Fire Pillar★★, INFERNO★★★ · Lamp Oil (burn +50%/+50%).
  New stats: burnDamage, burnTime, chainBonus. Mage set: 2 = +20 mana, 4 = +20% regen + 5% crit, 6 = +15% dmg, -10% cost.
- North Wizard: Frost Wand, Tide Tome★★ (Flood page), Glacier Orb★★★, Gale Staff★★★ · Snow Coat, NOELLE'S CLOAK★★
  (+70 mana, NW costs -20%) · Wave (skill id flood; worms resist it: endless-pierce shots hit one segment, ×0.75), Hurricane★★ (pulls in 170,
  holds, 3 dmg/tick; enemies inside take +40% from piercing shots — hidden), SNOWGRAVE★★★ (mega 150: freeze all on screen,
  shatter after 1.4 s for 80 + 35% max HP; bosses 160 + short freeze) · Hot Cocoa.
- Mega spells cost >100 mana: max mana from Noelle's Cloak, Archmage Mantle, Grimoire (+20 held), set bonuses, Deep Inkwell.
- Berserker (new full set): Battle Axe, Bloodletter★★ (4% life steal held), Ragnarok★★★ (rage = up to +100% at low HP)
  · Berserker Hide · Whirlwind, War Cry★★ · Grog.
- Fills: Knight Holy Oil (+30% boss damage 60 s), Miner Dynamite + Miner's Lunch (gnome blueprint), Hunter's Net.
- Set bonuses (gear3.js SET_BONUSES): 2 / 4 / 6 items of one sub class (2 weapons, armor, 2 skills, item).
- Melee vs bosses: every melee weapon +25% vs bosses/champions/mini-bosses; swords +35–60% (bossMul).
  Projectile swords: Starfury Saber★★ (homing star every swing), Paper Crane Blade★★ (2 cranes every 2nd),
  Verdant Blade★★★ (beam every swing, pierce 4), Dusk Edge★★★ (3 shadow shards every swing).
- Warden weak spot: with a melee weapon, dash then hold attack into his ball (throw/spin/reel; it glows) within
  0.45 s of the dash: the ball flies back into him: 7% of his max HP + 2.2 s real stun.
- Every melee weapon reflects enemy shots in that same dash-attack window (not only parry swords).

## Phase 3b
- Builds are not labelled in item texts (user's wish): items just interact.
- Plain bolt weapons leave the shops at ★★★ (phaseOut: Mage Staff, Wand, Frost Wand, Runed Staff, Thorn Staff).
  Archmage Staff★★★: its bolts borrow the effects of your OTHER weapon (burn/slow/chain/hex/poison/wind).
- Hidden element reactions (GearFx.react), on an enemy that already has the other element:
  fire → chilled = Thermal shock (+80% hit) · ice → burning = Steam (blast 75 px, 70%, knockback, puts fire out)
  · shock (chain sparks, Thunderstorm) → chilled = Conducted (0.7 s stun) · shock → burning = Wildfire (fire jumps
  to 2 enemies) · wind (Gale Staff, Hurricane) → burning = Firestorm (fire spreads to all within 120).
  A word pops up the first time (max once per 2 s per kind).
- Necromancer: Grave Staff (35% raise while held), Soul Lantern★★ (6% life steal held), Book of the Dead★★★
  (bone spear, raise skeleton, hex nova) · Gravecloth · Raise Dead, Soul Siphon★★ (heal 40%), ARMY OF THE DEAD★★★
  (mega 130: room's kills rise, 3–8), SOUL HARVEST★★★ (mega 140) · Bone Dust. Skeleton ally: 50 HP, 12 bite, 15 s, max 10.
- Druid: Thorn Staff, Bramble Orb★★, Tome of the Wilds★★★ (thorns, roots, heal bloom) · Bark Armor · Vine Snare,
  Healing Grove★★, Bear Form★★, WILD GROWTH★★★ (mega 120) · Herbal Tea.
- Witch: Hex Wand (hex = +25% damage taken from everything), Bubbling Cauldron★★ (poison, hex potions), Witch's
  Grimoire★★★ · Witch Hat (hexes +50% time) · Broom Dash, Curse of Frailty★★, TOIL AND TROUBLE★★★ (mega 120) · Eye of Newt.
- Monk: AURA DRAGON★★★ (mega, all 100 mana): an invulnerable dragon ally, 30 per bite, 12 s.

## Phase 3c: Mobile controls (js/mobile.js)
- Turns on by itself on phones/tablets (touch screen with a coarse pointer). Add ?touch to the link to test on PC.
- Left 45% of the screen: move stick appears under the thumb. Right side: aim stick. Dragging it aims + attacks
  (spam weapons keep firing, charge weapons fire when you let go). Double-tap it = swap weapon. No auto-aim.
- Buttons: DASH, skill 1, skill 2 (cooldown pie + name), item (name + count), pause (opens the inventory).
- Menus: tap = click. Hold still for ~0.5 s = magnifier (a hold never clicks).
- Main menu → Touch layout: drag buttons, − / + size (60–180%), Reset to default. Saved per device.
- Solo only for now (co-op on phones later). No vibration.

## v3c.2 playtest balance
- Money: every coin source in a run ×0.8 (GAME_CONFIG.coinIncome, inside GameScene.coinMul). Selling is unchanged.
- Early swords +25%: Blacksmith's First Sword 30, Longsword 42, Flamberge 37 (heavy 78).

## Alpha 3: The Necrotery (stage 3; lighting.js, necrotery.js, titan.js)
Darkness: alpha 0.96 / 0.92 / 0.82 (brightness Dark / Normal / Bright). Light radius: player 175, magic shot 100,
other shot 58, enemy shot 46, lit torch 215, burning floor 125+, explosions 1.5x their size, the Titan's eyes 165.
Torches: start lit in start / special / arena / boss rooms, unlit in fight rooms. Lit by: a shot passing within 30 px or
hitting the wall next to it, a melee swing, any blast. All torches of a room lit (3+): 8+ coins, +10% HP, full mana (once per room).
Burning floor: exploding fire shots (fireball texture or ignite) 2.6 s, Inferno 7 patches 3.5–5 s. Ignites enemies in it.
| Enemy | HP | Hits | Notes |
|---|---|---|---|
| Skeleton | 46 | slash 15 (110° arc) | red slice = warning |
| Skeleton Archer | 34 | arrow 13 | aim line locks 0.22 s before the shot |
| Skeleton Guard | 95 | bash 17 | shield: front hits ×0.15 |
| Dark versions | same | same | fall into bones 2.6 s and get up at 60% HP, 1–2 times; bones in fire = dead for good |
| Necromancer | 90 | 3 shadow bolts 11 | raises 2 skeletons (max 5), wakes bone piles at once; 1 per room |
| Candle Wisp | 18 | touch 6 | ghost (through walls); blows out lit torches |
| Phantom | 64 | lunge 18 | ghost; see-through = half damage, no touch damage |
The Dead Titan: 3800 HP (×level, ×co-op). Punch 26 (dazed 1 s after: +50% damage), slam 28 + ring 20 (dash through),
ribcage 30 + stuck 1 s, beams 16 every 0.5 s (exposed: +25%), summons 2–3 skeletons (max 5), roar every 16 s if 3+ torches lit.
Phase 2 at 50%: faster windups, punch→slam combos, 3 beams, 2 extra cages, dark skeletons in summons.
Boss loot: Titan's Wrath (MEGA, 110 mana, 18 s): fist 80 + stun 1.5 s (r130), ring 35, ribcages on up to 4 enemies 40 + stun 2 s.
Titan Ribcage (armor): +30 HP, 12% defense, 30% chance an enemy that hits you is caged (25, stun 1.5 s).

## Alpha 3.1 balance
- Shield enemies (Shield Guard, Skeleton Guards): front hits ×0.15 as before, but area attacks / blasts do ×0.75,
  a melee dash-attack into the shield = full damage + guard stunned 1.8 s ("Shield bash!"), and after its own dash
  the shield is stuck facing that way for 2.5 s (spinning dots). SHIELD_RULES in main.js.
- Pencil Case: Piggy Bank → PERSONALIZED SHOP (Wealth, needs Pocket Money 1, 4 ranks: 40/60/90/120).
  Shops always guarantee 35% of the weapon / armor / skill / item cards for your class (most of your gear),
  +10% per rank → 75%. Co-op: the share is split between the players' classes. Old Piggy Bank ranks are refunded.
- Clearing a fight room: 3% chance (+2% per level; level 6 = 13%) of a Health Potion on the floor (pickups.js).
- New Hunter skills (hunter.js): Bear Trap ★ (35, stuck 2.5 s, 2 traps), Tomahawk Volley ★ (5 × 22),
  Hawk Strike ★★ (4 dives × 26 + MARK), Apex Predator ★★★ (8 s: +25% dmg, +20% speed, +15% crit, hits MARK).
  Marked enemies take +25% damage from everyone for 5 s.
- Dead Titan: new look ("Shattered Sentinel": cracked bone plates with glowing seams, skeletal arms, bony fists).
  Slam: windup 1.15 s (phase 2: 0.88 s), aim locks at half of it; ring 420 px/s (phase 2: 510). Punch fist radius 62.

## Alpha 3.2 (dev)
- Shop: universal items (no class: Health Potion...) count toward your class's guaranteed share (potions ~10% → ~19% of shops).
- Aimed spells (Fire Pillar, Vine Snare, Hurricane, Curse of Frailty, Drain...) land on the mouse cursor.
- Druid: Bear Form now +10% speed (was −10%). NEW Vine Armor ★★ (85): +20 max HP, +20 max mana, 7% defense, +10% mana regen.
- Crossbows: holding again right after a shot always starts a new load (releasing the button clears the block).
- Shielded enemies: a frontal shield stops piercing shots (the shot still deals its pierce-bonus damage, then ends).
- Tomahawks light torches and give a little light while flying. Tomahawk is now ★★ (price 80, after boss 1).
- Economy: items sell for 30% of their price (was 50%); coin income ×0.8 again (coinIncome 0.64).
- Live balance table: new "By subclass" tab with a coverage matrix and a full per-subclass list.
- Berserker pass:
  - Whirlwind: 1.5x your held weapon's damage (26 with no weapon), knockback 380; knocked into a wall = 0.8 s stun.
  - War Cry: +30% attack speed / +20% damage with a melee weapon, only +10% / +10% with any other weapon.
  - Heavy weapons: Battle Axe and Bloodletter -10% move speed while held, Ragnarok -15%.
  - Berserker Hide: lifesteal removed (+15 max HP, 4% defense).
  - NEW Boulder ★★ (90, after boss 1; boulder.js): smash 95, cooldown 1.25 s, range 66, every hit slows 40% for 1.5 s, -10% speed.
    Dash-attack: it rolls off (580 px/s, slows down, bounces off walls) piercing enemies for 70 (+slow, wall stun).
    Until you walk over it: "weight off" punches (14, 0.23 s, 170° arc, range 58, knockback 470) and +25% speed.
    Off screen: a small faint arrow at the screen edge; on the floor: a faint ring above the darkness. Comes back on room change.
- Blacksmith's First Sword: 30 → 26 damage (no longer one-shots level 3 runners, 29 HP).
- Aura Dragon: now a fire dragon (new sprite), bites also burn (3/tick for 2 s); lasts 5 s + 1 s per Monk item equipped (was 12 s).
- NEW Wizard kit (Arcane · Mage): Wand + Mage Robe. Unlocks like the others (one run with only Mage gear).
- NEW Tower Shield (Melee · Berserker, ★, 45, from level 2): blocks 60% in a 160° front, parry stun 1.5 s, 60% walk speed while raised,
  -10% speed held. Hold 0.7 s + let go = slam (44 all around, range 120, knockback 420, stun 0.7 s, cooldown 2.2 s).
  Dash-attack = bash (30, 120° front, knockback 560, wall stun 0.9 s).
- Heavy merged into Berserker. Low-HP damage boost stays only on the axes (Battle Axe, Bloodletter, Ragnarok).
- NEW Earthbreaker ★★★ hammer (145): 72 dmg, cooldown 0.9 s, range 92; every 3rd hit in a row: 150 + stun 1.2 s; -15% speed.
- NEW Earthsplitter ★★★ skill (140; 30 mana, 7 s): 4 spiky rocks in a line, 140 ms apart, 54 px apart; each enemy hit once
  for 90% of your melee weapon's damage (other weapons: 16), stun 0.45 s. Stops at walls.
- NEW Thorn Armor ★★ (85): +15 HP, 20% defense; 30% of hits taken bounce 50% of the damage back + small knockback.
- NEW Brotherhood Armor ★★★ (135): +40 HP, 25% defense; co-op: takes half of the ally's hits while above 50% HP.
- NEW subclass Cupid (Arcane, by Nicolas):
  - Lovestruck: can't hurt you, follows you, stops attacking, 5-10 s; then Heartbreak (30 + 20% max HP).
    Bosses / mini-bosses / champions: half as long, they chase and hit OTHER enemies (or a far spot if alone);
    Heartbreak 4% max HP. Worm bosses immune. Love bar: fills from some hits, drains after 3 s.
  - Harp ★ (35): sound waves 24, pierce all, short range, 0.76 s, 5 mana.
  - Heart Wand ★★ (85): hearts 9, 0.46 s, 3 mana, 12% Lovestruck.
  - Cupid's Bow "My Pretty Valentine" ★★★ (150): charge bow, full 85, love bar +34% per hit; counts as Archer/precision
    for item bonuses; +15% dmg, +10% charge speed, +10% love per other Cupid item.
  - Wing Flap ★ (35; 15 mana, 5 s): push 120 radius, 6 dmg; wall hit: +22 and stun 1.2 s.
  - Cupid's Flight ★★ (85; 20 mana, 6 s): 300 px flight through walls/enemies, pink trail 4 s (+25% love per 0.4 s).
  - Cupid's Book ★★★ (145; 75 mana, 16 s): everything within 240 Lovestruck + 12 dmg.
  - Set: 2 = +20 mana, love +15%; 4 = Lovestruck +25% longer, Heartbreak +50%.
- Miner (secret class, gnome blueprint) is rare unless someone already uses Miner gear: shop weight x0.2,
  chests keep Miner loot in their pool only 25% of the time.
- NEW tier ★★★★ (POST_BOSS_3 = after the 3rd boss; shows in shops once stage 4 exists, usable in the Test Dungeon now).
- Coal dirty (status): slowed, enemy shots go +-28° wild, fire x2 (burn ticks double, fire hits deal double).
- NEW Coal Lump ★★ (80): thrown 14, 0.52 s, no mana; coal dirty 4 s, slow 30%.
- NEW Hot Coal Lump ★★★★ (210): thrown 26, 0.48 s; coal dirty 5 s (slow 35%) + burn 4/tick (so 8 while dirty).
- NEW Cafézin ★★ skill (80; 50 mana, 32 s): 10 s of +25% attack speed, +20% damage, +20% speed.
- NEW Torch ★★ skill (75; 25 mana, 7 s): torch 30 + burn; fire jumps between enemies within 85 px of a burning one (max 12).
- NEW Mine Train ★★★ MEGA (150; 100 mana, 26 s): tracks laid wall to wall in 0.9 s (axis closest to your aim, no diagonals),
  0.35 s rumble, train (loco + 3 ore cars) crosses at 1500 px/s: 170 + stun 0.9 s to everything in the lane (84 px wide),
  thrown sideways out of the lane.
- SECRET (see NOTES.md): code "russi" -> Cupid kit + BIG RUSSI replaces the Bookworm next run (1900 HP, 15x10 arena,
  teeth spirals, laughing rings, hair curtains with a gap, double headbutts, mini heads, cross, phase-3 flower),
  then a run where every normal enemy has his face. Drops the Bookworm's loot.
- Aura Dragon: speed 330 -> 540, turn 6 -> 11 (it catches fleeing enemies now).
- Harp reworked: close-range strum (kind 'harp'): 34 dmg (was 24) to everything in a 150° arc, range 96, 0.68 s, 5 mana;
  pink smear + white streaks + music notes.
- Debug on phones: tap the main-menu title 5x and type "debug" (all menu codes work this way). Test Dungeon panel:
  tap "hide", a TEST tab brings it back; taps on the panel don't aim/attack.
- NEW SECTIONS (graveyard.js): a level can have a cluster of connected rooms with their own look and rules.
  Necrotery GRAVEYARD (85% of Necrotery levels, 2-4 connected rooms, 20x13): outside, dark, heavy rain, lightning
  flashes + thunder. Tombstones break in 3 hits (melee, shots, pickaxes): 50% 1-3 coins, 5% a weapon.
  Each graveyard fight adds 1-2 Gargoyles.
- NEW Gargoyle: 40 HP, fast, surges every 0.76 s (440 speed) while it keeps moving and turning; hits hex you.
- Gargoyles are the graveyard's common enemy: 2-3 join EVERY graveyard fight (statue or not).
- Demonic Gargoyle loot: like a Mimic (good item, coins, shavings) + always the GARGOYLE EYE (exclusive consumable:
  90 s, your light is 2.6x bigger in the dark) + 60% a blueprint:
  - Gargoyle Claw ★★ (Melee · Knight, 95): short quick slashes 24, range 70, 0.34 s, every hit hexes 3 s.
  - Hex Lightning ★★★ (Arcane · Witch, 140; 35 mana, 7 s): strike where you aim (50, radius 60, hexes 4 s); from each
    enemy hit it jumps to enemies within 95 px for 80% (each enemy once, max 14 hits, stops below 8 damage).
- NEW Hex on players: take 25% more damage (4-5 s). Purple mark over your head.
- NEW mini-boss DEMONIC GARGOYLE (max 2 per Necrotery, 70% per graveyard section): a statue in the middle of a
  graveyard room; get within 170 px -> lightning strikes it, room locks. 950 HP. Lightning storms (5 strikes, 7 when
  furious, one after another, 20 dmg, no hex), dashes (2 in a row when furious), slashes (118 range, parryable),
  summons 2 Gargoyles (max 4). Physical hits hex. Drops good loot + 24 coins + shavings like a mimic.
- Pets, homing shots and auto-aim ignore bone piles (dark skeletons that will get back up).

## Future content plans
(filled in as phases are built)
