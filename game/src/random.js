// Skyline Courier — a small seeded random source and smooth value noise.
//
// Everything the valley is made of comes from here, so the same seed always
// builds the same valley, the same rings and the same clouds. The game never
// reads Math.random after the world is built.

/** mulberry32: a tiny deterministic generator with a long period. */
export function createRandom(seed) {
  let state = seed >>> 0;
  return {
    /** Next float in [0, 1). */
    next() {
      state |= 0;
      state = (state + 0x6d2b79f5) | 0;
      let t = Math.imul(state ^ (state >>> 15), 1 | state);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
    /** Next float in [min, max). */
    range(min, max) {
      return min + (max - min) * this.next();
    },
    /** Next integer in [min, max]. */
    int(min, max) {
      return Math.floor(this.range(min, max + 1));
    },
  };
}

/** Smoothstep easing between 0 and 1. */
function smooth(t) {
  return t * t * (3 - 2 * t);
}

/** Hash a pair of integers into a stable pseudo-random value in [0, 1). */
function hash2(ix, iz, seed) {
  let h = (ix * 374761393 + iz * 668265263 + seed * 974634211) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** 2D value noise: smooth, continuous, and seeded. */
export function noise2(x, z, seed) {
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fz = z - iz;
  const a = hash2(ix, iz, seed);
  const b = hash2(ix + 1, iz, seed);
  const c = hash2(ix, iz + 1, seed);
  const d = hash2(ix + 1, iz + 1, seed);
  const ux = smooth(fx);
  const uz = smooth(fz);
  return (a + (b - a) * ux + (c - a) * uz + (a - b - c + d) * ux * uz) * 2 - 1;
}

/** Fractal noise: three octaves of value noise, still in roughly [-1, 1]. */
export function fbm2(x, z, seed) {
  return (
    noise2(x, z, seed) * 0.55 +
    noise2(x * 2.13, z * 2.13, seed + 11) * 0.3 +
    noise2(x * 4.31, z * 4.31, seed + 29) * 0.15
  );
}
