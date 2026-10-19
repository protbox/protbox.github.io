# Game Boy pattern library: one-bar templates in C

Every file is one bar, one track, at 120 bpm (patterns don't depend on tempo). Everything is built on a **C chord**, so transpose each pattern to your chord's root.

- **Bass** (`bass/`, wave channel, MIDI ch 3): root is **C3**, and nothing goes below C3, so it's valid in hUGETracker as-is.
- **Rhythm** (`rhythm/`, pulse channel, MIDI ch 1): root is **C4**, and the range is C4 to C6.
- **Drums** (`drums/`, noise channel, MIDI ch 10): uses General MIDI drum numbers. The mapping is below.
- **`_maj` / `_min`**: patterns that use the 3rd, 6th or 7th come in both versions. Files without a suffix fit any chord quality.
- **Velocity** is used on purpose. Accents ~115–120, normal ~100, ghost notes ~65. Fast arps and bell patterns keep their accents loud and the in-between notes soft, so they pulse rather than hammer.
- **Time signature** is in each file: 4/4 is 16 steps per bar, 3/4 and 6/8 are 12 steps per bar (16th-note grid).
- **In fUGE**: open ♫ Builder… in the arrangement bar to use these patterns. After adding or changing files here, run `node tools/patterns.js` to rebundle `patterns.js`, which is what fUGE loads. The audition MP3s from the original library aren't included; the builder plays patterns through fUGE's own sound engine instead.

## Bass (wave)

| Audition | File | Chord | Time | What it's for |
|---|---|---|---|---|
| 0:00 | `bass01_whole` | any | 4/4 | Held root. Pads, slow intros, breakdowns. |
| 0:08 | `bass02_half_root5` | any | 4/4 | Root then fifth in half notes. Calm, ballads, title screens. |
| 0:17 | `bass03_quarters` | any | 4/4 | Steady quarter-note root. Marches, simple pop. |
| 0:25 | `bass04_driving_8ths` | any | 4/4 | Driving 8th-note root. Rock, battle, chase. |
| 0:34 | `bass05_octave_pump` | any | 4/4 | Root/octave 8ths. Disco-chip, upbeat overworld. |
| 0:42 | `bass06_tresillo_3_3_2` | any | 4/4 | 3+3+2 with octave pops (Legend of the Last Light / Salt & Sails groove). |
| 0:51 | `bass07_gallop` | any | 4/4 | Dotted gallop. Horse riding, adventure, battle. |
| 1:00 | `bass08_bossa` | any | 4/4 | Bossa root-fifth (dotted quarter + 8th). Shops, cafes, lounges. |
| 1:08 | `bass09_syncopated_push` | any | 4/4 | Syncopated with a push into the next bar (ends on the 7th, a half step under the octave, leading into the next chord). Jazzy shop, town. |
| 1:17 | `bass10_disco_offbeat` | any | 4/4 | Same as pump but staccato; pair with 4-on-floor. |
| 1:25 | `bass11_boogie_maj` | maj | 4/4 | Boogie walk up and down. Saloon, playful town, swing. |
| 1:34 | `bass11_boogie_min` | min | 4/4 | Boogie walk up and down. Saloon, playful town, swing. |
| 1:43 | `bass12_walk_up_maj` | maj | 4/4 | Quarter-note walk 1-2-3-5. Gentle movement between chords. |
| 1:51 | `bass12_walk_up_min` | min | 4/4 | Quarter-note walk 1-2-3-5. Gentle movement between chords. |
| 2:00 | `bass13_one_drop` | any | 4/4 | Reggae one-drop: silent beat 1, lands on beat 3. Beach, island, laid-back. |
| 2:08 | `bass14_halftime_dub` | any | 4/4 | Half-time dubstep feel. Heavy dungeon, water temple. |
| 2:17 | `bass15_oompah` | any | 4/4 | Oom-pah on 1 and 3. March, circus, tuba. |
| 2:26 | `bass16_chip_16ths` | any | 4/4 | Fast root/octave 16ths. Classic chiptune energy, boss, speed stage. |
| 2:34 | `bass17_funk` | any | 4/4 | Funky syncopated 16ths with ghost notes. Uses b7 (fits minor or dominant chords). |
| 2:43 | `bass18_maqsum_phrygdom_maj` | maj | 4/4 | Arabic/maqsum riff with b2 (Sunken Shrine style). Use maj = Phrygian dominant. |
| 2:51 | `bass18_maqsum_phrygdom_min` | min | 4/4 | Arabic/maqsum riff with b2 (Sunken Shrine style). Use maj = Phrygian dominant. |
| 3:00 | `bass19_wobble_long` | any | 4/4 | Re-triggered long root with fading volumes; fake wobble. Dubstep-ish. |
| 3:09 | `bass20_climb_8ths_maj` | maj | 4/4 | Climbing 8ths, builds tension into the next bar. Pre-chorus, rising action. |
| 3:17 | `bass20_climb_8ths_min` | min | 4/4 | Climbing 8ths, builds tension into the next bar. Pre-chorus, rising action. |
| 3:26 | `bass21_waltz_3-4` | any | 3/4 | Waltz root-fifth-fifth. Ballroom, music box, spooky waltz. |
| 3:32 | `bass22_6-8_rolling_maj` | maj | 6/8 | Rolling 6/8 arpeggio bass (barcarolle). Sea, sailing, lullaby. |
| 3:39 | `bass22_6-8_rolling_min` | min | 6/8 | Rolling 6/8 arpeggio bass (barcarolle). Sea, sailing, lullaby. |
| 3:46 | `bass23_6-8_jig` | any | 6/8 | Jig long-short. Folk, tavern, Celtic. |

## Rhythm (pulse)

| Audition | File | Chord | Time | What it's for |
|---|---|---|---|---|
| 0:00 | `pulse01_arp_up_16_maj` | maj | 4/4 | Rising 1-3-5-8 16ths. Classic chip arp. |
| 0:08 | `pulse01_arp_up_16_min` | min | 4/4 | Rising 1-3-5-8 16ths. Classic chip arp. |
| 0:17 | `pulse02_arp_updown_16_maj` | maj | 4/4 | Up-down 16ths over an octave and a bit. Flowing, magical. |
| 0:25 | `pulse02_arp_updown_16_min` | min | 4/4 | Up-down 16ths over an octave and a bit. Flowing, magical. |
| 0:34 | `pulse03_bells_3_3_2_sus` | any | 4/4 | Bell ostinato 3+3+2 (5-8-9, works on any chord). Accented, ghost notes soft. |
| 0:42 | `pulse04_bells_3_3_2_triad_maj` | maj | 4/4 | Bell ostinato 3+3+2 on the triad. |
| 0:51 | `pulse04_bells_3_3_2_triad_min` | min | 4/4 | Bell ostinato 3+3+2 on the triad. |
| 1:00 | `pulse05_bells_3_3_2_down_maj` | maj | 4/4 | The bell ostinato flipped downward. Use for variation. |
| 1:08 | `pulse05_bells_3_3_2_down_min` | min | 4/4 | The bell ostinato flipped downward. Use for variation. |
| 1:17 | `pulse06_bells_gallop_maj` | maj | 4/4 | Gappy gallop ostinato. Lighter variation of the bells. |
| 1:25 | `pulse06_bells_gallop_min` | min | 4/4 | Gappy gallop ostinato. Lighter variation of the bells. |
| 1:34 | `pulse07_broken_8ths_maj` | maj | 4/4 | Broken-chord 8ths. Calm accompaniment, towns, harp-like. |
| 1:43 | `pulse07_broken_8ths_min` | min | 4/4 | Broken-chord 8ths. Calm accompaniment, towns, harp-like. |
| 1:51 | `pulse08_alberti_maj` | maj | 4/4 | Alberti 1-5-3-5. Classical, castle, music box. |
| 2:00 | `pulse08_alberti_min` | min | 4/4 | Alberti 1-5-3-5. Classical, castle, music box. |
| 2:08 | `pulse09_offbeat_skank_maj` | maj | 4/4 | Offbeat chord stabs on the "and". Reggae/ska, beach, upbeat towns. |
| 2:17 | `pulse09_offbeat_skank_min` | min | 4/4 | Offbeat chord stabs on the "and". Reggae/ska, beach, upbeat towns. |
| 2:26 | `pulse10_stabs_2_and_4_maj` | maj | 4/4 | Stabs on 2 and 4. Country, oom-pah partner to bass15. |
| 2:34 | `pulse10_stabs_2_and_4_min` | min | 4/4 | Stabs on 2 and 4. Country, oom-pah partner to bass15. |
| 2:43 | `pulse11_bossa_guide_tones_maj` | maj | 4/4 | Guide-tone comping (3rd and 7th) in bossa rhythm. maj = maj7, min = m7. |
| 2:51 | `pulse11_bossa_guide_tones_min` | min | 4/4 | Guide-tone comping (3rd and 7th) in bossa rhythm. maj = maj7, min = m7. |
| 3:00 | `pulse12_shop_plucks_maj` | maj | 4/4 | Sparse syncopated plucks of 3-7-9 (Shopkeeper style). Jazzy, airy. |
| 3:09 | `pulse12_shop_plucks_min` | min | 4/4 | Sparse syncopated plucks of 3-7-9 (Shopkeeper style). Jazzy, airy. |
| 3:17 | `pulse13_tremolo_octave` | any | 4/4 | Octave tremolo 16ths. Tension, suspense, sparkle under a pad. |
| 3:26 | `pulse14_shimmer_trill_maj` | maj | 4/4 | 5-6 trill. Shimmer, magic, water. |
| 3:34 | `pulse14_shimmer_trill_min` | min | 4/4 | 5-6 trill. Shimmer, magic, water. |
| 3:43 | `pulse15_powerchug` | any | 4/4 | Root-fifth chug. Rock, boss, action. |
| 3:52 | `pulse16_echo_stab` | any | 4/4 | One stab with dotted-8th echoes fading out. Space, caves, transitions. |
| 4:00 | `pulse17_harp_sweep_maj` | maj | 4/4 | Two-octave harp sweep (1-5-8-10-12-15...). Title screens, fairy fountains. |
| 4:09 | `pulse17_harp_sweep_min` | min | 4/4 | Two-octave harp sweep (1-5-8-10-12-15...). Title screens, fairy fountains. |
| 4:17 | `pulse18_counter_offbeats` | any | 4/4 | Two-note offbeat 8ths (5, 8, 9). A light, non-busy pulse. |
| 4:26 | `pulse19_maqsum_pluck_phrygdom_maj` | maj | 4/4 | Arabic pluck riff with b2 (Sunken Shrine Pulse 2). maj = Phrygian dominant. |
| 4:35 | `pulse19_maqsum_pluck_phrygdom_min` | min | 4/4 | Arabic pluck riff with b2 (Sunken Shrine Pulse 2). maj = Phrygian dominant. |
| 4:43 | `pulse20_build_16ths_maj` | maj | 4/4 | Rising arp with a volume crescendo. Use the bar before a big section. |
| 4:52 | `pulse20_build_16ths_min` | min | 4/4 | Rising arp with a volume crescendo. Use the bar before a big section. |
| 5:00 | `pulse21_waltz_pah_pah_maj` | maj | 3/4 | Waltz "pah-pah" on beats 2 and 3. Pair with bass21. |
| 5:07 | `pulse21_waltz_pah_pah_min` | min | 3/4 | Waltz "pah-pah" on beats 2 and 3. Pair with bass21. |
| 5:14 | `pulse22_6-8_arp_maj` | maj | 6/8 | 6/8 broken chord. Lilting, sea, lullaby. |
| 5:20 | `pulse22_6-8_arp_min` | min | 6/8 | 6/8 broken chord. Lilting, sea, lullaby. |
| 5:27 | `pulse23_6-8_bells` | any | 6/8 | 6/8 bell ostinato in triplet groups. |

## Drums (noise)

| Audition | File | Chord | Time | What it's for |
|---|---|---|---|---|
| 0:00 | `drums01_rock` | any | 4/4 | Basic rock: kick 1 & 3, snare 2 & 4, 8th hats. |
| 0:08 | `drums02_rock_16th_hats` | any | 4/4 | Busy rock with 16th hats. Hats are soft in the MIDI so the backbeat cuts through. |
| 0:17 | `drums03_halftime` | any | 4/4 | Half-time: snare on 3 only. Heavy, slow, epic. |
| 0:25 | `drums04_four_on_floor` | any | 4/4 | Four-on-the-floor kicks with offbeat open hats. Disco/dance. |
| 0:34 | `drums05_march` | any | 4/4 | Snare-driven march. Soldiers, parades, castles. |
| 0:42 | `drums06_maqsum` | any | 4/4 | Maqsum (dum-tek-tek-dum-tek). Desert, bazaar, Arabic. |
| 0:51 | `drums07_bossa` | any | 4/4 | Bossa: rim clave over a kick on 1 and 3, shaker filling the gaps. |
| 1:00 | `drums08_woodblock_partido` | any | 4/4 | Syncopated woodblock and shaker (Shopkeeper v2). Shops, quirky towns. |
| 1:08 | `drums09_one_drop` | any | 4/4 | Reggae one-drop: nothing on 1, kick+rim on 3. Pair with bass13. |
| 1:17 | `drums10_breakbeat` | any | 4/4 | Syncopated rock with a pickup kick (Clash v2). Battles, action. |
| 1:25 | `drums11_3_3_2_groove` | any | 4/4 | 3+3+2 kick pattern under a backbeat (Legend of the Last Light). Pair with bass06. |
| 1:34 | `drums12_dock_clank` | any | 4/4 | Clanky work rhythm (cargo clank). Factories, docks, mines. |
| 1:43 | `drums13_tribal_toms` | any | 4/4 | Tribal tom groove. Jungle, ritual, drums of war. |
| 1:51 | `drums14_shaker_only` | any | 4/4 | Just 8th-note shaker. Ambient, intros, quiet towns. |
| 2:00 | `drums15_dnb` | any | 4/4 | Two-step / drum-and-bass feel. Speed, tech, chase. |
| 2:08 | `drums16_fill_snare_roll` | any | 4/4 | Fill: snare roll into the next bar. |
| 2:17 | `drums17_fill_toms` | any | 4/4 | Fill: toms + snare. |
| 2:26 | `drums18_fill_build_16ths` | any | 4/4 | Build: 16th snare crescendo. Last bar before a drop. |
| 2:34 | `drums19_stop_time` | any | 4/4 | Stop-time: crash on 1, then silence. Pair with all channels hitting beat 1. |
| 2:43 | `drums20_crash_swell` | any | 4/4 | Reverse-cymbal swell over the whole bar. Use the bar before a crash. |
| 2:51 | `drums21_timpani_roll` | any | 4/4 | Timpani hits into a roll. Fanfares, title screens. |
| 3:00 | `drums22_waltz_3-4` | any | 3/4 | Waltz: kick 1, hats 2 & 3. |
| 3:07 | `drums23_6-8_sway` | any | 6/8 | 6/8 sway: kick 1, rim on 4, shaker between. |
| 3:13 | `drums24_6-8_jig` | any | 6/8 | 6/8 jig: kick, hat, snare on beat 2. |

## Drum note map (GM → suggested noise sound)

| GM | Sound | GM | Sound |
|---|---|---|---|
| 36 | Kick (low, long-ish noise) | 46 | Open hat (bright, longer decay) |
| 37 | Rim / tek (short 7-bit noise) | 49 | Crash (bright, long tail) |
| 38 | Snare (mid noise burst) | 54 | Tambourine (short bright 7-bit) |
| 39 | Clap | 56 | Clank / cowbell (metallic 7-bit) |
| 41 | Timpani (low, long) | 57 | Swell (reverse cymbal, volume ramps up) |
| 42 | Closed hat (very short, bright) | 70 | Shaker (very short, soft) |
| 45 | Tom (low-mid) | 76 | Woodblock (short, pitched 7-bit) |

## Good pairings

- **3+3+2 groove** (Legend of the Last Light): `bass06` + `pulse03`/`pulse04` + `drums11`. Vary it with `pulse05` (downward) and `pulse06` (gallop).
- **Water temple / desert**: `bass18` or `bass14` + `pulse19` + `drums06`.
- **Shop / jazzy town**: `bass09` + `pulse12` or `pulse11` + `drums08` or `drums07`.
- **Beach / island**: `bass13` + `pulse09` + `drums09`.
- **Battle**: `bass04` or `bass16` + `pulse15` + `drums10`, with `drums16`/`drums17` fills.
- **Sea / lullaby (6/8)**: `bass22` + `pulse22` or `pulse23` + `drums23`.
- **Waltz (3/4)**: `bass21` + `pulse21` + `drums22`.
- **Section changes**: `pulse20` + `drums18` builds into a big section, and `drums19` (with every channel hitting beat 1) gives a stop-time.
