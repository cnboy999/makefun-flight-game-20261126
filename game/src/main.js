// Skyline Courier — the game loop: screens, timing, sound and best score.
//
// The loop owns the state machine: title, playing, paused, crashed, and route
// complete. It steps the world at a fixed 60 Hz, keeps the audio in step with
// the throttle and the airspeed, remembers the best score in local storage,
// and hands every frame to the renderer. A `?shot=` parameter stages one of
// the four photograph scenes instead of the title screen.

import { STEP } from './config.js';
import { makeWorld, stepWorld, resetWorld, EVENT_RING, EVENT_MISS, EVENT_MISSION, EVENT_CRASH, EVENT_LAND, EVENT_REFUEL } from './world.js';
import { createRenderer, SCREEN_TITLE, SCREEN_PLAY, SCREEN_PAUSED, SCREEN_OVER, SCREEN_COMPLETE } from './render.js';
import { createInput, ACTION_CONFIRM, ACTION_PAUSE, ACTION_MUTE } from './input.js';
import { createAudio } from './audio.js';
import { buildShotWorld, SHOT_SCENES } from './shots.js';

const BEST_KEY = 'skyline-courier-best';
const SEED = 20261126;

const canvas = document.getElementById('game');
const renderer = createRenderer(canvas);
const input = createInput(canvas);
const audio = createAudio();

/** The best score this browser has seen, or 0 on a fresh machine. */
function loadBest() {
  try {
    return Number(localStorage.getItem(BEST_KEY) || 0) || 0;
  } catch (error) {
    return 0;
  }
}

/** Remember a new best score, silently if storage is unavailable. */
function saveBest(score) {
  try {
    localStorage.setItem(BEST_KEY, String(score));
  } catch (error) {
    // A blocked storage is not a reason to stop the game.
  }
}

let world = makeWorld(SEED);
let screen = SCREEN_TITLE;
let best = loadBest();
let lastTime = performance.now();
let accumulator = 0;
let shotScene = null;

// A `?shot=start|play|slalom|land` URL stages a photograph scene: the world
// is posed mid-flight and the loop draws it without stepping, so the
// screenshot is the same every time the page is opened.
const params = new URLSearchParams(window.location.search);
const shotName = params.get('shot');
if (shotName && SHOT_SCENES.includes(shotName)) {
  shotScene = shotName;
  world = buildShotWorld(shotName);
  screen = SCREEN_PLAY;
  document.title = `Skyline Courier — shot ${shotName}`;
}

/** The pilot pressed start: the engine hums, the valley opens, we fly. */
function startFlight() {
  audio.unlock();
  resetWorld(world);
  screen = SCREEN_PLAY;
  lastTime = performance.now();
  accumulator = 0;
}

/** Play the sounds for the events this step produced. */
function soundEvents(events) {
  if (events & EVENT_RING) audio.ring();
  if (events & EVENT_MISS) audio.miss();
  if (events & EVENT_MISSION) audio.mission();
  if (events & EVENT_CRASH) audio.crash();
  if (events & EVENT_LAND) audio.land();
  void EVENT_REFUEL;
}

/** One animation frame: take input, step the world, draw the frame. */
function frame(now) {
  const actions = input.takeActions();
  if (actions & ACTION_MUTE) audio.toggleMute();
  if (shotScene) {
    // A staged scene does not step: the photograph is the same every time.
    renderer.draw(world, SCREEN_PLAY, best, now / 1000);
    requestAnimationFrame(frame);
    return;
  }
  if (actions & ACTION_CONFIRM) {
    audio.unlock();
    if (screen === SCREEN_TITLE || screen === SCREEN_OVER || screen === SCREEN_COMPLETE) {
      startFlight();
    } else if (screen === SCREEN_PAUSED) {
      screen = SCREEN_PLAY;
      lastTime = performance.now();
    }
  }
  if (actions & ACTION_PAUSE) {
    if (screen === SCREEN_PLAY) screen = SCREEN_PAUSED;
    else if (screen === SCREEN_PAUSED) screen = SCREEN_PLAY;
  }
  if (screen === SCREEN_PLAY) {
    const elapsed = Math.min(0.25, (now - lastTime) / 1000);
    lastTime = now;
    accumulator += elapsed;
    while (accumulator >= STEP) {
      const events = stepWorld(world, input.steering());
      soundEvents(events);
      accumulator -= STEP;
      if (world.over) {
        if (world.complete) {
          screen = SCREEN_COMPLETE;
        } else {
          screen = SCREEN_OVER;
        }
        if (world.score > best) {
          best = world.score;
          saveBest(best);
        }
        break;
      }
    }
    audio.update(world.plane.throttle, world.plane.speed);
  } else {
    lastTime = now;
  }
  renderer.draw(world, screen, best, now / 1000);
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);

// A small handle for automated tests: the world and the current screen.
window.__skyline = {
  get world() {
    return world;
  },
  get screen() {
    return screen;
  },
  startFlight,
};
