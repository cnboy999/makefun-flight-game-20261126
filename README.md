[![make.fun · best-flight-game-20261126-0057](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![rank](https://make.fun/badge/best-flight-game-20261126-0057/cnboy999/makefun-flight-game-20261126/rank.svg)](https://make.fun/bounty/best-flight-game-20261126-0057/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![reward](https://make.fun/badge/best-flight-game-20261126-0057/cnboy999/makefun-flight-game-20261126/reward.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)

Bounty: https://make.fun/bounty/best-flight-game-20261126-0057

# Skyline Courier

Fly a courier aeroplane down a winding river valley: thread the rings, watch
your fuel, and put her down on the far strip. A complete, original flight
game that plays offline in a desktop browser — no libraries, no network, no
copied assets. Every pixel is drawn in code and every sound is synthesised
live with the Web Audio API.

## The flight

Three sorties, one valley, one tank of fuel:

1. **Ring Run** — 8 amber rings down the valley. Each clean pass scores 100
   plus a combo bonus; every fourth ring is green and refuels you.
2. **Valley Slalom** — 10 rings with real wind gusts pushing you sideways.
   Fuel burns faster, so the green rings matter more.
3. **Strip Landing** — 3 guide rings, then land: at 30–62 m/s, level,
   straight, and on the asphalt. A good landing pays 500 plus a fuel bonus.

Miss a ring and the combo resets. Run dry and the throttle dies. Hit the
hillside and the flight is over. The wing stalls below 34 m/s — keep the
speed up or the nose drops on its own.

## Controls

- **↑ / ↓** — climb and descend
- **← / →** — bank and turn
- **W / S** — throttle up and down
- **Mouse** — drag to steer (bank and pitch together)
- **Space** — fly / fly again
- **P** — pause
- **M** — mute

## Instruments

The HUD shows altitude (feet), speed (knots) and heading (degrees) across
the top, a fuel gauge, the current sortie and ring count, a next-ring pointer
with distance and turn direction, an attitude indicator (bottom left) and a
throttle gauge (bottom right). The aeroplane casts a shadow on the ground
below it, and speed streaks appear at the screen edges when you are fast.

## How to play

```
node serve.ts
```

Then open http://localhost:8080 in desktop Chrome. Or open `game/index.html`
through any static server — the game loads nothing from the network.

## Files

| File | Job |
| --- | --- |
| `game/index.html` | The page: canvas, help line, nothing else |
| `game/src/main.js` | The loop: screens, timing, sound, best score |
| `game/src/config.js` | Every tuning number in one place |
| `game/src/random.js` | Seeded random numbers and value noise |
| `game/src/terrain.js` | The valley: height, river, strips, rings, clouds |
| `game/src/plane.js` | The aeroplane: stall, bank, pitch, fuel |
| `game/src/world.js` | Sorties, rings, scoring, landings and crashes |
| `game/src/render.js` | Sky, terrain, rings, aeroplane, HUD, screens |
| `game/src/input.js` | Keyboard and pointer input |
| `game/src/audio.js` | Synthesised engine, wind, chimes and crashes |
| `game/src/shots.js` | The four staged scenes behind `?shot=` |
| `main.ts` | The hand-in program: copies the game and writes the dossier |
| `serve.ts` | A tiny static server for local play-testing |
| `shots.json` | The four screenshot scenes and their URLs |

Screenshots are taken from the running game with `?shot=start|play|slalom|land`
— the same seeded valley every time, so each shot is reproducible.

## Tested

An in-page autopilot flies the whole route with keyboard input only
(`tools/autopilot.mjs`, not part of the entry): take-off, 17 of 21 rings,
all three sorties, refuel rings topping the tank back up, and a landing on
the strip at 60 m/s, dead on the centre line, for a final score of 4,064
(3,500 flying + 500 landing bonus + 64 fuel bonus). No page errors.
`tools/playtest.mjs` checks the title screen, take-off, pause and resume.
`tools/shots.mjs` captures the four screenshots at 1280×800 JPEG, each
under 256 KiB.
