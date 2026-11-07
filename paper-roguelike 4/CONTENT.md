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
- Mimic (treasure rooms, mini-boss): 420 HP, hop slam (18), tongue lash (16), spit fan (5×9). Faster under 50%.
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
  (+70 mana, NW costs -20%) · Flood, Hurricane★★ (pulls, not bosses), SNOWGRAVE★★★ (mega 150: freeze all on screen,
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

## Future content plans
(filled in as phases are built)
