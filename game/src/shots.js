// Skyline Courier — the shot scenes: the game, posed for its photographs.
//
// The entry needs real screenshots of the running game, so this file puts the
// world into four fixed moments — take-off, a ring pass, the slalom, and the
// final approach — and leaves the camera running so the renderer can be
// captured exactly as a player would see it. Nothing here changes how the
// game plays; the scenes only set the aeroplane down somewhere and let it
// fly straight for a moment.

import { makeWorld, stepWorld } from './world.js';
import { terrainHeight } from './terrain.js';

export const SHOT_SCENES = ['start', 'play', 'slalom', 'land'];

/** The seed each scene uses, so the valley is the same every time. */
const SEED = 20261126;

/**
 * Build the world for one scene: the aeroplane placed, aimed and flying
 * straight, so the screenshot shows the game mid-flight, not a freeze-frame.
 * Returns the world, already stepped forward a little.
 */
export function buildShotWorld(scene) {
  const world = makeWorld(SEED);
  const plane = world.plane;
  if (scene === 'start') {
    // On the departure strip, throttle up, nose on the valley ahead.
    plane.alt = 42;
    plane.speed = 34;
    plane.throttle = 0.85;
    plane.heading = 0;
  } else if (scene === 'play') {
    // Mid-valley on the first sortie, the next ring dead ahead.
    const ring = world.course[2];
    plane.grounded = false;
    plane.x = ring.x - 60;
    plane.z = ring.z - 240;
    plane.alt = ring.alt;
    plane.speed = 95;
    plane.throttle = 0.8;
    plane.heading = Math.atan2(ring.x - plane.x, ring.z - plane.z);
    world.ringIndex = 2;
    world.score = 250;
    world.combo = 2;
    world.ringsHit = 2;
  } else if (scene === 'slalom') {
    // The slalom sortie, low over the river between two rings, wind blowing.
    world.mission = 1;
    world.ringIndex = 9;
    const ring = world.course[9];
    plane.grounded = false;
    plane.x = ring.x + 70;
    plane.z = ring.z - 260;
    plane.alt = ring.alt - 12;
    plane.speed = 105;
    plane.throttle = 0.85;
    plane.heading = Math.atan2(ring.x - plane.x, ring.z - plane.z);
    plane.bank = 0.35;
    world.score = 1150;
    world.combo = 3;
    world.ringsHit = 9;
  } else if (scene === 'land') {
    // Final approach: slow, low, straight at the strip, the last guide ring
    // ahead and the strip itself visible beyond it.
    world.mission = 2;
    world.ringIndex = 20;
    const strip = { x: 0, z: 6600 };
    plane.grounded = false;
    plane.x = 8;
    plane.z = strip.z - 700;
    plane.alt = 85;
    plane.speed = 60;
    plane.throttle = 0.35;
    plane.heading = 0;
    plane.pitch = -0.04;
    world.score = 2350;
    world.combo = 5;
    world.ringsHit = 19;
  }
  // Let the aeroplane fly straight for a second so the terrain, the rings
  // and the HUD all settle into their natural positions.
  for (let step = 0; step < 60; step += 1) {
    stepWorld(world, { steer: 0, pitch: 0, throttleUp: false, throttleDown: false });
    if (world.over) break;
  }
  // A scene that ended in a crash is no use as a photograph: put the
  // aeroplane back where it started and leave it there, unstepped.
  if (world.over) {
    const fresh = makeWorld(SEED);
    const freshPlane = fresh.plane;
    freshPlane.grounded = false;
    freshPlane.x = plane.x;
    freshPlane.z = plane.z;
    freshPlane.alt = Math.max(plane.alt, terrainHeight(plane.x, plane.z, SEED) + 60);
    freshPlane.speed = 80;
    freshPlane.throttle = 0.8;
    freshPlane.heading = plane.heading;
    fresh.mission = world.mission;
    fresh.ringIndex = world.ringIndex;
    fresh.score = world.score;
    return fresh;
  }
  return world;
}
