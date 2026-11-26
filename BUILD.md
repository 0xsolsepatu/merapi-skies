# Merapi Skies — Island Bush Pilot — build notes

## The game

**Merapi Skies** is an original 3D flight game, written for this competition
in this session. One bush plane, one volcanic island (Pulau Merapi), three
airstrips, four missions. Built on vendored three.js r128 UMD
(`game/vendor/three.min.js`, 603,445 B, from cdnjs) with a custom flight
model, procedural island, canvas instruments and synthesised WebAudio.

### Depth

- **4 missions.** Ring Run (8 numbered sky rings in order, 240 s clock),
  Island Hop (full-stop landings on all three strips), Supply Drop (3 crates
  on marked village circles, under 120 m and 55 m/s to score), Free Flight
  (distance + smooth-landing scoring).
- **Flying has stakes.** Stall below ~27 m/s (nose drops), engine overheat
  past 90% throttle (throttle limited until cooled), fuel burn with throttle
  (about 65 s of full power), damage on hard landings / ring clips /
  hillside strikes; 100% damage ends the flight.
- **Throttle and turn discipline pay.** Coordinated banks turn the nose,
  sloppy turns bleed speed, gentle touchdowns (sink under 3.2 m/s, wings
  level) score a smooth-landing bonus; flaps lower the stall speed, the
  airbrake kills speed on final.

### Feel and polish

- Chase and cockpit cameras (C), screen shake on hard landings, dust puffs
  on dirt strips, spinning propeller with blur disc, windsock flutter,
  drifting clouds, engine hum + wind noise that follow throttle and
  airspeed (WebAudio synth, no files), ring chimes, touchdown thuds.
- HUD is a 2D canvas overlay with big bold numbers (airspeed KT, altitude
  FT, heading, artificial horizon, heading tape, fuel/heat/damage bars,
  mission strip) — readable when shrunk onto the judge's contact sheet.

## Controls

W/S throttle, Arrow Up/Down pitch, Arrow Left/Right bank and turn, mouse
steers (move to bank, wheel = throttle), F flaps, B airbrake, Space drops
a crate (Supply Drop) / starts, C camera, P pause, R restart, M mute,
1–4 mission select, Enter start.

## Screenshots

All four are real renders of the game's own code, taken in headless
Chromium (WebGL 2.0 via SwiftShader) at 1280×720 against `node serve.ts`,
via deterministic `?shot=` scenes (seed 1). The first by name is the cover.

| File | Size | What it shows |
| --- | --- | --- |
| `1-cover.jpg` | 103,353 B | Chase view mid-flight: plane banking over Merapi Field, ring 1 ahead with its number badge, volcano, trees, villages, coast and sea, full lit HUD (122 KT, 561 FT, 178° S) |
| `2-menu.jpg` | 88,215 B | Title screen: Merapi Skies, 4 mission cards, full controls list, Start button, island behind |
| `3-rings.jpg` | 76,682 B | Through ring 3 on the course, trees and coastline, sun glow |
| `4-landing.jpg` | 64,646 B | Final approach to Merapi Field: runway centreline + threshold ahead, dust on the strip, flaps down, volcano and villages beyond |

## Verification (all run in this session)

- **Deterministic screenshots:** `~/workspace/makefun-watch/tools-flight/shoot.mjs`
  drives the Playwright Chromium build over CDP; each `?shot=` scene sets
  `window.__shotReady` after 30 frames (camera snaps in shot mode so the
  chase camera is settled). All four reported `shotReady=true`.
- **Zero console errors, zero failed requests** in every run. The only
  requests the page makes are its own files from localhost (index.html +
  three.min.js + 12 ES modules); no network, no external assets.
- **Live play-test with real key presses** (`tools-flight/flytest.mjs`):
  menu → Enter starts Ring Run; 12 s of W → throttle 0.88, speed 34.8 on
  the ground; pull up → airborne, climbing to 30 m, speed 61.8; bank right
  → heading 180° → 169°; throttle back + pitch down → descending at
  64.6 m/s, still airborne. Pause/resume verified. No console errors.
- **Headless frame rate is 3.7 fps** (SwiftShader software rendering);
  sim time runs compressed there, which is why the holds are long. A real
  GPU will run the scene (one 190×190 terrain mesh, instanced trees,
  ~100 meshes) far faster.
- **Hand-in run:** `MAKEFUN_OUTPUT_DIR=<tmp> node main.ts` run twice
  writes byte-identical output (diff clean): `game/` + `screenshots/` +
  `dossier.json` (528,935 B, under the 1.5 MiB cap), total 1.6 MiB.
- **Gemini reviews:** spec review before building — all 5 judge criteria
  PASS, 3 fixes applied (three.js adapter file, `__shotReady` flag,
  canvas HUD with big fonts; plus prop disc, shake, dust, deterministic
  cover, audio-on-gesture). Post-build code review — no blocking issues
  found (flight model, mission logic, shot determinism, offline gate all
  pass; one Gemini claim about shot planes being parked is inaccurate —
  the airborne poses were verified visually in the screenshots).

## Bugs found and fixed while testing

- `showMenu(false)` in the shot scenes re-showed the menu and reset the
  plane (first screenshots were all menu). Removed those calls; shots now
  stage correctly.
- Chase camera was still lerping from the origin when `__shotReady` fired
  after 4 frames, so the plane rendered tiny and distant. Camera now snaps
  in shot mode and `__shotReady` fires after 30 frames.
- Heading tape labels overlapped at 15° spacing; now ticks every 15°,
  labels every 30°.
- Menu camera looked at the plane dead-centre, hiding it behind the panel;
  the look target is now offset so the plane sits off-centre.

## Layout

```
merapi-skies/
  main.ts            Node 22 hand-in program (stdlib only)
  serve.ts           tiny static server for local play (from the kit starter)
  shots.json         the four screenshot scenes
  LICENSE            MIT
  README.md          (make.fun badges, 0xsolsepatu/merapi-skies)
  BUILD.md           this file
  .makefun/owner.json  {"wallet": "4ytnkRAdSTtF4jJfETcc95efktzKDZABoEMLXSJxNAPP"}
  game/
    index.html       canvases + menu/pause/end overlays, data-URI favicon
    vendor/three.min.js   three.js r128 UMD (vendored, not my source)
    src/
      three.js       adapter exporting window.THREE
      config.js      tuning, runways, missions, palette, controls text
      random.js      seeded RNG + value noise / fbm
      terrain.js     island heightmap, sea, runways, trees, villages
      sky.js         gradient dome, sun, drifting cloud sprites
      aircraft.js    bush-plane model + flight model (stall/heat/fuel/damage)
      rings.js       sky rings, drop targets, cargo crates
      hud.js         canvas instruments (airspeed/altitude/heading/horizon)
      audio.js       synthesised WebAudio engine/wind/effects
      input.js       keyboard + mouse (virtual stick, wheel throttle)
      shots.js       deterministic ?shot= scenes
      main.js        boot, loop, missions, camera, screens, dust
  screenshots/       1-cover.jpg, 2-menu.jpg, 3-rings.jpg, 4-landing.jpg
  vendor/
    makefun-game.ts  kit file, unchanged
```

## Status (26 Nov 2026, ~10:00 WIB)

Built, tested and committed locally (`afdcaa4d2074aeb7a8b00a2084cfbb76fc9ea199`).
**Not yet pushed or submitted** — the GitHub connector cannot create the
repo (403, App lacks repo-creation scope) and there is no authenticated git
remote on this machine, so the parent must create `merapi-skies` under
0xsolsepatu via the browser, upload the files (screenshots are binary),
set About (website https://make.fun, topic makefun), then bundle
(with `--muse-usage` rows — 0 rows exist yet for this subagent; they are
written when its run completes), run `makefun check`, and submit with
`--keypair /home/hatch/.makefun/keypairs/https_make.fun.json` before the
round-1 cutoff 19:57 WIB today. Exact commands are in the handoff to the
parent agent.
