// Skyline Courier — every tuning number and colour in one place.
//
// Units are metres and seconds. The plane flies north (+z) up a winding river
// valley, through glowing rings, and finally lands on a mountain strip. The
// renderer is a row-strip pseudo-3D projector, so nothing here depends on the
// screen size: the focal length is derived from the canvas height each frame.

/** The simulation's fixed step, in seconds: 60 updates a second. */
export const STEP = 1 / 60;

/** Seconds of real time the shot scenes play for. */
export const SHOT_PLAY_SECONDS = 22;
export const SHOT_LAND_LIMIT_SECONDS = 90;
export const SHOT_END_LIMIT_SECONDS = 120;

export const PLANE = {
  /** Top speed the engine can hold, metres per second. */
  maxSpeed: 118,
  /** Below this the wing gives up and the nose drops. */
  stallSpeed: 34,
  /** Throttle the plane starts with, and how fast it moves. */
  startThrottle: 0.55,
  throttleRate: 0.9,
  /** How fast the bank and pitch chase the pilot's input, per second. */
  bankRate: 3.2,
  pitchRate: 2.4,
  /** Hard limits on bank and pitch, radians. */
  maxBank: 0.85,
  maxPitch: 0.42,
  /** How sharply bank turns the nose, at low and high speed. */
  turnBase: 0.32,
  turnSpeed: 0.0042,
  /** Climb and sink behaviour. */
  climbAuthority: 1.0,
  sinkAtIdle: 6,
};

export const FUEL = {
  /** Full tank, in units. */
  capacity: 100,
  /** Burn per second at idle, plus this times throttle. */
  idleBurn: 0.45,
  throttleBurn: 0.85,
  /** Mission 2 burns faster than the rest. */
  slalomMultiplier: 1.25,
  /** What a green refuel ring puts back in the tank. */
  refuelAmount: 30,
  /** The fuel gauge turns red and the alarm sounds below this. */
  lowLevel: 22,
};

export const RING = {
  /** The ring's hole radius, in metres: generous, so a clean line scores. */
  radius: 26,
  /** Points for a clean pass, before the combo bonus. */
  points: 100,
  /** Extra points per ring of the current streak. */
  comboBonus: 25,
  /** How far ahead a ring is drawn and counted, in metres. */
  drawDistance: 1500,
};

export const LANDING = {
  /** Touchdown speed window, metres per second. */
  minSpeed: 30,
  maxSpeed: 62,
  /** Gentlest allowed sink rate at touchdown, metres per second. */
  maxSink: 5,
  /** How far off the strip heading the nose may be, radians. */
  maxHeadingError: 0.3,
  /** Bonus for a clean landing, plus the fuel left over. */
  bonus: 500,
};

/** The three sorties, in order: rings, count, wind and fuel pressure. */
export const MISSIONS = [
  {
    name: 'RING RUN',
    blurb: 'Thread the amber rings down the valley',
    rings: 8,
    spacing: 300,
    firstZ: 420,
    wind: 0,
    fuelMultiplier: 1,
    refuelEvery: 4,
  },
  {
    name: 'VALLEY SLALOM',
    blurb: 'Tighter turns, gusts across the valley',
    rings: 10,
    spacing: 230,
    firstZ: 3060,
    wind: 5,
    fuelMultiplier: FUEL.slalomMultiplier,
    refuelEvery: 4,
  },
  {
    name: 'STRIP LANDING',
    blurb: 'Follow the guide rings and put her down',
    rings: 3,
    spacing: 300,
    firstZ: 5560,
    wind: 3,
    fuelMultiplier: 1,
    refuelEvery: 0,
  },
];

/** The landing strip at the end of the valley. */
export const RUNWAY = {
  x: 0,
  z0: 6460,
  z1: 6760,
  width: 26,
  /** The strip is graded flat at this height. */
  height: 52,
  heading: 0,
};

/** Golden-hour palette: one warm style for sky, land and instruments. */
export const COLORS = {
  skyTop: '#2c4a7c',
  skyMid: '#7d9ec4',
  skyLow: '#f7b267',
  horizon: '#ffd9a0',
  sun: '#fff3c4',
  cloud: 'rgba(255, 246, 230, 0.85)',
  grassLow: '#7da05c',
  grassHigh: '#a8b06a',
  rock: '#8a7a66',
  snow: '#e9eef2',
  water: '#3f8f9e',
  runway: '#3c3f46',
  runwayLine: '#f2f0e6',
  ring: '#ffb703',
  ringPassed: '#8ac926',
  refuel: '#2ec4b6',
  planeOrange: '#f4842b',
  planeWhite: '#f7f3ea',
  planeTeal: '#177e89',
  hudPanel: 'rgba(12, 20, 36, 0.62)',
  hudText: '#f7f3ea',
  hudAmber: '#ffb703',
  hudRed: '#ef476f',
  hudGreen: '#8ac926',
};
