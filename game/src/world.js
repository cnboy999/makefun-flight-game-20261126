// Skyline Courier — the world: sorties, rings, fuel, landings and crashes.
//
// The world owns the flight's story: which ring is next, what the score is,
// whether the tank is low, and whether the last thing that happened was a
// clean pass, a miss, a landing or a crash. The aeroplane itself lives in
// plane.js; this file decides what its flying means.

import { STEP, MISSIONS, RUNWAY, RING, FUEL, LANDING } from './config.js';
import { createRandom } from './random.js';
import { buildCourse, buildClouds, terrainHeight, isRunway, isLandingZone, isDepartureStrip, DEPARTURE } from './terrain.js';
import { createPlane, stepPlane, resetPlane } from './plane.js';

export const EVENT_NONE = 0;
export const EVENT_RING = 1;
export const EVENT_MISS = 2;
export const EVENT_MISSION = 4;
export const EVENT_CRASH = 8;
export const EVENT_LAND = 16;
export const EVENT_FUEL_LOW = 32;
export const EVENT_REFUEL = 64;

/** A fresh world: mission 1, first ring, full tank, no score. */
export function createWorld(random) {
  const world = {
    random,
    seed: 20261126,
    plane: createPlane(),
    course: buildCourse(random, 20261126),
    clouds: buildClouds(random),
    mission: 0,
    ringIndex: 0,
    score: 0,
    combo: 0,
    ringsHit: 0,
    ringsMissed: 0,
    time: 0,
    fuelLowWarned: false,
    over: false,
    landed: false,
    complete: false,
    crashReason: '',
    /** Short-lived messages the HUD shows, newest last. */
    toasts: [],
    /** The last event bits, for the loop to sound and announce. */
    events: EVENT_NONE,
  };
  return world;
}

/** The ring the pilot is aiming at right now, or null past the last one. */
export function nextRing(world) {
  return world.ringIndex < world.course.length ? world.course[world.ringIndex] : null;
}

/** Metres from the nose to the next ring, along the valley. */
export function distanceToRing(world) {
  const ring = nextRing(world);
  if (!ring) return 0;
  const dx = ring.x - world.plane.x;
  const dz = ring.z - world.plane.z;
  return Math.sqrt(dx * dx + dz * dz);
}

/** Push a toast the HUD shows for a few seconds. */
function toast(world, text) {
  world.toasts.push({ text, age: 0 });
  if (world.toasts.length > 3) world.toasts.shift();
}

/** The wind at this point of the flight: gusts only on the slalom sortie. */
function windAt(world) {
  const spec = MISSIONS[world.mission];
  if (!spec || spec.wind === 0) return 0;
  return Math.sin(world.plane.z * 0.01 + world.time * 0.7) * spec.wind;
}

/** Pass or miss the ring the nose just crossed, and score it. */
function crossRing(world, ring) {
  const plane = world.plane;
  const dx = plane.x - ring.x;
  const dy = plane.alt - ring.alt;
  const through = Math.sqrt(dx * dx + dy * dy) < ring.radius;
  if (through) {
    const points = RING.points + world.combo * RING.comboBonus;
    world.score += points;
    world.combo += 1;
    world.ringsHit += 1;
    if (ring.kind === 'refuel') {
      plane.fuel = Math.min(FUEL.capacity, plane.fuel + FUEL.refuelAmount);
      toast(world, `REFUEL +${FUEL.refuelAmount}  •  RING +${points}`);
      world.events |= EVENT_REFUEL;
    } else {
      toast(world, ring.kind === 'guide' ? `GUIDE RING +${points}` : `RING +${points}`);
    }
    world.events |= EVENT_RING;
  } else {
    world.combo = 0;
    world.ringsMissed += 1;
    toast(world, 'RING MISSED');
    world.events |= EVENT_MISS;
  }
  world.ringIndex += 1;
  // A mission ends when its rings run out: the next sortie begins.
  const spec = MISSIONS[world.mission];
  const missionRings = world.course.filter((item) => item.mission === world.mission).length;
  const doneInMission = world.course
    .slice(0, world.ringIndex)
    .filter((item) => item.mission === world.mission).length;
  if (doneInMission >= missionRings) {
    if (world.mission < MISSIONS.length - 1) {
      world.mission += 1;
      toast(world, `${MISSIONS[world.mission].name} — ${MISSIONS[world.mission].blurb}`);
      world.events |= EVENT_MISSION;
    }
  }
}

/** The strip landing: gentle, slow, straight, on the asphalt. */
function tryLand(world) {
  const plane = world.plane;
  const speedOk = plane.speed >= LANDING.minSpeed && plane.speed <= LANDING.maxSpeed;
  const sinkOk = plane.touchdownVspeed >= -LANDING.maxSink;
  const headingOk = Math.abs(plane.heading - RUNWAY.heading) < LANDING.maxHeadingError;
  if (speedOk && sinkOk && headingOk) {
    const fuelBonus = Math.round(plane.fuel);
    world.score += LANDING.bonus + fuelBonus;
    world.landed = true;
    world.complete = true;
    world.over = true;
    toast(world, `LANDED! +${LANDING.bonus}  •  FUEL BONUS +${fuelBonus}`);
    world.events |= EVENT_LAND;
    return true;
  }
  return false;
}

/** Advance the world one fixed step. Returns the event bits of this step. */
export function stepWorld(world, input) {
  world.events = EVENT_NONE;
  if (world.over) return world.events;
  const plane = world.plane;
  const spec = MISSIONS[world.mission];
  const prevZ = plane.z;
  const ground = terrainHeight(plane.x, plane.z, world.seed);
  // Flat graded ground: the landing strip, or the departure strip.
  const onStrip = isRunway(plane.x, plane.z) || isDepartureStrip(plane.x, plane.z);
  const wasGrounded = plane.grounded;
  stepPlane(plane, input, windAt(world), STEP, spec.fuelMultiplier, ground, onStrip);
  world.time += STEP;

  // Age the toasts out after a few seconds.
  for (const item of world.toasts) item.age += STEP;
  world.toasts = world.toasts.filter((item) => item.age < 3.5);

  // Low fuel: warn once, and the tank itself forces the throttle shut.
  if (!world.fuelLowWarned && plane.fuel < FUEL.lowLevel) {
    world.fuelLowWarned = true;
    toast(world, 'LOW FUEL — FIND A GREEN RING');
    world.events |= EVENT_FUEL_LOW;
  }

  // Rings: the nose crossing a ring's plane decides pass or miss.
  const ring = nextRing(world);
  if (ring && prevZ < ring.z && plane.z >= ring.z) crossRing(world, ring);

  // Touchdown: an airborne plane that reaches strip height over flat graded
  // ground has its wheels on it. The band is three metres, so a plane
  // flying level just above the strip settles onto it instead of floating
  // the whole runway length without ever landing — but only while it is
  // descending: a plane climbing away from the strip is taking off, and
  // must not be pulled back down on the very next step.
  const groundNow = terrainHeight(plane.x, plane.z, world.seed);
  const onStripNow = isRunway(plane.x, plane.z) || isDepartureStrip(plane.x, plane.z);
  if (!plane.grounded && plane.vspeed < 0 && plane.alt <= groundNow + 3 && onStripNow) {
    plane.touchdownVspeed = plane.vspeed;
    plane.grounded = true;
    plane.alt = groundNow + 2;
    plane.vspeed = 0;
  }

  // A touchdown on the landing strip, with every ring flown: a gentle one
  // ends the route, a hard one ends the flight. Anywhere else a touchdown
  // is just a chance to take off again.
  if (!wasGrounded && plane.grounded) {
    if (
      world.mission === MISSIONS.length - 1 &&
      world.ringIndex >= world.course.length &&
      isLandingZone(plane.x, plane.z)
    ) {
      if (tryLand(world)) return world.events;
      world.over = true;
      world.crashReason = 'HARD LANDING — TOO FAST, TOO STEEP OR CROOKED';
      toast(world, `CRASHED — ${world.crashReason}`);
      world.events |= EVENT_CRASH;
      return world.events;
    }
  }

  // The ground, anywhere but a strip: a crash. A plane that rolled off a
  // strip into rough ground is already sinking into it.
  if (!plane.grounded && plane.alt <= groundNow + 1.5) {
    plane.alt = groundNow + 1.5;
    world.over = true;
    world.crashReason = plane.groundStrike
      ? 'RAN OFF THE END OF THE STRIP — PULL UP (↑) TO TAKE OFF'
      : plane.fuel <= 0
        ? 'OUT OF FUEL'
        : plane.stalled
          ? 'STALLED INTO THE HILLSIDE'
          : 'TERRAIN STRIKE';
    toast(world, `CRASHED — ${world.crashReason}`);
    world.events |= EVENT_CRASH;
  }
  return world.events;
}

/** Back to the departure strip: a new flight, same valley. */
export function resetWorld(world) {
  resetPlane(world.plane);
  world.mission = 0;
  world.ringIndex = 0;
  world.score = 0;
  world.combo = 0;
  world.ringsHit = 0;
  world.ringsMissed = 0;
  world.time = 0;
  world.fuelLowWarned = false;
  world.over = false;
  world.landed = false;
  world.complete = false;
  world.crashReason = '';
  world.toasts = [];
  world.events = EVENT_NONE;
}

/** A world for a fresh seed, used by the shot scenes and the loop alike. */
export function makeWorld(seed) {
  return createWorld(createRandom(seed));
}

/** The departure strip's coordinates, for the renderer and the shots. */
export function departureStrip() {
  return DEPARTURE;
}
