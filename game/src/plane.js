// Skyline Courier — the aeroplane: one state, one step, no surprises.
//
// An arcade flight model with three honest limits: the wing stalls when slow,
// the nose drops when it stalls, and the tank runs dry when the pilot wastes
// it. Everything else is smooth: bank chases the stick, pitch chases the
// stick, and the aeroplane goes where its nose points.

import { PLANE, FUEL } from './config.js';

/** The aeroplane's fresh state, sitting on the departure strip. */
export function createPlane() {
  return {
    x: 0,
    z: 0,
    alt: 42,
    heading: 0,
    pitch: 0,
    bank: 0,
    speed: 0,
    throttle: PLANE.startThrottle,
    fuel: FUEL.capacity,
    /** Vertical speed, metres per second, for the landing check. */
    vspeed: 0,
    /** True once the wing has given up. */
    stalled: false,
    /** True while the wheels are on a strip: the ground holds the plane up. */
    grounded: true,
    /** True when the plane rolled off a strip into rough ground. */
    groundStrike: false,
    /** Vertical speed at the last touchdown, for the landing check. */
    touchdownVspeed: 0,
  };
}

/**
 * Advance the aeroplane one fixed step.
 * `input` is { steer: -1..1, pitch: -1..1, throttleUp, throttleDown },
 * `wind` is a lateral gust in metres per second, `ground` is the terrain
 * height under the nose, and `onStrip` says the wheels are over flat graded
 * ground. Returns nothing; the state is mutated in place.
 */
export function stepPlane(plane, input, wind, dt, fuelMultiplier, ground, onStrip) {
  // Throttle: held keys walk it up or down, never past the stops.
  if (input.throttleUp) plane.throttle += PLANE.throttleRate * dt;
  if (input.throttleDown) plane.throttle -= PLANE.throttleRate * dt;
  plane.throttle = Math.max(0, Math.min(1, plane.throttle));

  // Bank chases the stick; with no input the wings level themselves.
  const targetBank = input.steer * PLANE.maxBank;
  const bankRate = PLANE.bankRate * dt;
  plane.bank += Math.max(-bankRate, Math.min(bankRate, targetBank - plane.bank));

  // Pitch chases the stick; with no input the nose eases back to level.
  const targetPitch = input.pitch * PLANE.maxPitch;
  const pitchRate = PLANE.pitchRate * dt;
  plane.pitch += Math.max(-pitchRate, Math.min(pitchRate, targetPitch - plane.pitch));

  // The wing stalls below its flying speed: the nose drops on its own —
  // but only in the air. On the ground the wheels hold the aeroplane up.
  plane.stalled = plane.speed < PLANE.stallSpeed;
  if (plane.stalled && !plane.grounded) plane.pitch -= 0.6 * dt;

  // Speed: thrust against drag, gravity along the flight path, and the sink
  // of a stalled wing. A parked aeroplane still rolls forward on throttle.
  const thrust = plane.throttle * 34;
  const drag = 8 + plane.speed * 0.16;
  const gravity = Math.sin(plane.pitch) * 14;
  plane.speed += (thrust - drag - gravity) * dt;
  plane.speed = Math.max(0, Math.min(PLANE.maxSpeed, plane.speed));

  // A coordinated turn: bank turns the nose, faster when faster.
  const turnRate = plane.bank * (PLANE.turnBase + plane.speed * PLANE.turnSpeed);
  plane.heading += turnRate * dt;

  // Climb and sink: the nose points the velocity, plus idle sink and stall.
  plane.vspeed = Math.sin(plane.pitch) * plane.speed;
  if (plane.throttle < 0.25) plane.vspeed -= (0.25 - plane.throttle) * PLANE.sinkAtIdle;
  if (plane.stalled && !plane.grounded) plane.vspeed -= 9;

  if (plane.grounded) {
    // Rolling: the ground holds the plane at strip height. Lift off only
    // when the nose is up and the wing is flying; roll off the end of the
    // strip and the rough ground beyond it ends the flight.
    if (plane.vspeed > 0 && plane.speed >= PLANE.stallSpeed) {
      plane.grounded = false;
      plane.alt += plane.vspeed * dt;
    } else if (!onStrip) {
      plane.grounded = false;
      plane.groundStrike = true;
      plane.alt = ground;
    } else {
      plane.vspeed = 0;
      plane.alt = ground + 2;
    }
  } else {
    plane.alt += plane.vspeed * dt;
    if (plane.alt < 0) plane.alt = 0;
  }

  // Forward motion along the heading, plus the wind pushing sideways.
  plane.x += Math.sin(plane.heading) * plane.speed * dt + wind * dt;
  plane.z += Math.cos(plane.heading) * plane.speed * dt;

  // Fuel: idle burn plus throttle burn, faster on the slalom sortie.
  plane.fuel -= (FUEL.idleBurn + plane.throttle * FUEL.throttleBurn) * fuelMultiplier * dt;
  if (plane.fuel <= 0) {
    plane.fuel = 0;
    plane.throttle = 0;
  }
}

/** Reset the aeroplane to the departure strip, tank full. */
export function resetPlane(plane) {
  const fresh = createPlane();
  Object.assign(plane, fresh);
}
