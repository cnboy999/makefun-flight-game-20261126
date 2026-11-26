// Skyline Courier — the valley: its height, its river, its strips and rings.
//
// The valley winds gently north. Its floor is low and flat enough to fly in,
// its sides rise into hills, and a river runs along the floor. Two flat graded
// strips sit in it: the departure strip at the start and the landing strip at
// the end. Rings hang along the valley line, each one high enough above the
// ground below it that a clean line through it is also a safe line.

import { MISSIONS, RUNWAY } from './config.js';
import { fbm2 } from './random.js';

/** How far the valley's centre line wanders from x = 0, in metres. */
export function valleyCentre(z) {
  // The valley starts straight, so a new pilot can take off and settle in,
  // and only bends properly once the flight is under way.
  const ramp = Math.min(1, Math.max(0, z) / 1500);
  return ramp * (55 * Math.sin(z * 0.003) + 35 * Math.sin(z * 0.0011));
}

/** The ground height with no strips: rolling hills, ridges and the river. */
function terrainHeightNatural(x, z, seed) {
  const centre = valleyCentre(z);
  const off = Math.abs(x - centre);
  // Rolling hills, stronger away from the valley floor.
  const hills = fbm2(x * 0.006, z * 0.006, seed) * 55 + 75;
  const ridge = fbm2(x * 0.0016 + 7, z * 0.0016, seed + 5) * 70 + 90;
  const side = Math.min(1, off / 600);
  let height = 42 + hills * (0.15 + 0.85 * side) + ridge * side * side * 0.8;
  // The river cuts the floor down where the valley runs.
  if (off < 80) height -= 16 * (1 - off / 80);
  return height;
}

/** The ground height at a world point, in metres above sea level. */
export function terrainHeight(x, z, seed) {
  // The departure strip: flat ground from just behind the start line.
  if (z > -80 && z < 320 && Math.abs(x) < 70) return 40;
  // The landing strip: graded flat, with a wide apron that slopes gently
  // down to it, so a slightly wide final approach meets grass, not a wall.
  const stripOff = Math.abs(x - RUNWAY.x);
  if (z > RUNWAY.z0 - 60 && z < RUNWAY.z1 + 60 && stripOff < 280) {
    if (stripOff < 160) return RUNWAY.height;
    const natural = terrainHeightNatural(x, z, seed);
    return RUNWAY.height + (natural - RUNWAY.height) * ((stripOff - 160) / 120);
  }
  return terrainHeightNatural(x, z, seed);
}

/** True when the point is on water: low ground near the valley floor. */
export function isWater(x, z, seed) {
  const centre = valleyCentre(z);
  return Math.abs(x - centre) < 34 && terrainHeight(x, z, seed) < 47;
}

/** True when the point is on the landing strip's asphalt. */
export function isRunway(x, z) {
  return (
    z >= RUNWAY.z0 && z <= RUNWAY.z1 && Math.abs(x - RUNWAY.x) <= RUNWAY.width / 2
  );
}

/**
 * True when the point is inside the landing zone: the strip itself or the
 * flat grass beside it, wide enough that a lined-up approach counts even
 * when the wheels miss the asphalt by a little.
 */
export function isLandingZone(x, z) {
  return z >= RUNWAY.z0 && z <= RUNWAY.z1 && Math.abs(x - RUNWAY.x) <= 40;
}

/** True when the point is on the flat departure strip. */
export function isDepartureStrip(x, z) {
  return z > -80 && z < 320 && Math.abs(x) < 70;
}

/**
 * True when the point is on the departure runway: a 22-metre asphalt strip
 * down the middle of the flat departure ground, where every flight begins.
 */
export function isDepartureRunway(x, z) {
  return z > -80 && z < 320 && Math.abs(x) <= 11;
}

/** The departure strip, where every flight begins. */
export const DEPARTURE = { x: 0, z: 0, heading: 0, height: 40 };

/**
 * Build the ring course for the whole flight: every mission's rings in order,
 * each one above the ground below it, with every fourth ring a green refuel
 * ring where the mission allows one. Returns an array of ring objects:
 * { x, z, alt, radius, kind: 'ring' | 'refuel' | 'guide', mission }.
 */
export function buildCourse(random, seed) {
  const rings = [];
  for (let mission = 0; mission < MISSIONS.length; mission += 1) {
    const spec = MISSIONS[mission];
    for (let index = 0; index < spec.rings; index += 1) {
      const z = spec.firstZ + index * spec.spacing;
      const centre = valleyCentre(z);
      // Rings wander off the centre line more as the missions get harder.
      // The guide rings are different: they funnel the pilot from the valley
      // line onto the runway's centre line, so the last one sits over the
      // strip and the final approach is already lined up.
      const wander = mission === 0 ? 55 : mission === 1 ? 95 : 40;
      let x = centre + (random.next() * 2 - 1) * wander;
      if (mission === 2) {
        const align = index / (spec.rings - 1);
        x = centre * (1 - align) + RUNWAY.x * align + (random.next() * 2 - 1) * wander * (1 - align * 0.7);
      }
      const ground = terrainHeight(x, z, seed);
      // Guide rings step down toward the strip, so the final approach is a
      // gentle glide instead of a dive: 140, then about 107, then about 75.
      let alt;
      if (mission === 2) {
        const align = index / (spec.rings - 1);
        alt = Math.max(ground + 35, 140 - align * 65);
      } else {
        alt = Math.max(95, ground + 48 + random.next() * 35);
      }
      const kind =
        mission === 2
          ? 'guide'
          : spec.refuelEvery > 0 && (index + 1) % spec.refuelEvery === 0
            ? 'refuel'
            : 'ring';
      rings.push({ x, z, alt, radius: 26, kind, mission });
    }
  }
  return rings;
}

/** Seeded cloud puffs scattered along the flight path. */
export function buildClouds(random) {
  const clouds = [];
  for (let index = 0; index < 46; index += 1) {
    clouds.push({
      x: (random.next() * 2 - 1) * 1500,
      z: random.next() * 7200 - 300,
      alt: 280 + random.next() * 160,
      size: 60 + random.next() * 130,
    });
  }
  return clouds;
}
