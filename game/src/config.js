// Tuning, world layout and mission definitions for Merapi Skies.
// One file holds every number a designer would tweak, so the flight model,
// the terrain and the missions never disagree about a constant.

export const GAME_TITLE = 'Merapi Skies';
export const GAME_SUBTITLE = 'Island Bush Pilot';
export const WORLD_SEED = 20261126;

export const WORLD = {
  size: 2600, // island spans -1300..1300 on x and z; sea beyond
  seaLevel: 0,
  volcano: { x: -260, z: -420, height: 195, radius: 620 },
  beachWidth: 26,
  treeLine: 95, // trees grow below this height
};

export const RUNWAYS = [
  {
    id: 'merapi-field',
    name: 'Merapi Field',
    x: 60, z: 820, heading: 180, // heading deg, runway runs north-south
    length: 420, width: 34, elevation: 6, surface: 'grass',
  },
  {
    id: 'coral-coast',
    name: 'Coral Coast',
    x: 880, z: 120, heading: 90, // runs east-west along the coast
    length: 380, width: 30, elevation: 4, surface: 'sand',
  },
  {
    id: 'crater-high',
    name: 'Crater High',
    x: -180, z: -760, heading: 200,
    length: 340, width: 28, elevation: 118, surface: 'dirt',
  },
];

export const FLIGHT = {
  maxSpeed: 92, // m/s at full throttle, level
  cruiseSpeed: 58,
  stallSpeed: 27, // below this the wing stops flying
  minFlySpeed: 24,
  maxThrottle: 1,
  throttleRate: 0.55, // per second while held
  climbRate: 9.5, // m/s at full power, best climb
  sinkRate: 3.2, // m/s gliding, throttle idle
  pitchRate: 0.85, // rad/s at full elevator
  rollRate: 1.5, // rad/s at full aileron
  turnCoordination: 0.55, // heading change per radian of bank per second
  drag: 0.12,
  fuelCapacity: 100,
  fuelBurn: 1.55, // units/s at full throttle (about 65 s of full power)
  fuelBurnIdle: 0.25,
  heatRate: 9, // overheat points/s above 90% throttle
  heatCool: 14, // points/s while throttled back
  overheatAt: 100,
  damageHardLanding: 34,
  damageCrash: 100,
  damageRingClip: 12,
  damageGroundStrike: 100,
  safeTouchdownVSpeed: 3.2, // m/s sink at touchdown: gentle
  hardTouchdownVSpeed: 6.5, // above this costs damage
  maxBankForLanding: 0.38, // rad (~22 deg)
  takeoffSpeed: 30,
};

export const MISSIONS = [
  {
    id: 'rings',
    name: 'Ring Run',
    short: 'RINGS',
    goal: 'Fly through all 8 sky rings in order, against the clock.',
    tip: 'Smooth banks win: sloppy turns bleed speed and the clock does not wait.',
    rings: 8,
    timeLimit: 240,
  },
  {
    id: 'hop',
    name: 'Island Hop',
    short: 'HOP',
    goal: 'Take off and land full-stop on all three airstrips.',
    tip: 'Come in slow, wings level, flaps down. A gentle touchdown scores best.',
    rings: 0,
    timeLimit: 600,
  },
  {
    id: 'drop',
    name: 'Supply Drop',
    short: 'DROP',
    goal: 'Drop 3 crates on the marked village circles. Low and slow over each.',
    tip: 'Press SPACE (or click DROP) under 120 m and under 55 m/s to score.',
    rings: 0,
    timeLimit: 420,
  },
  {
    id: 'free',
    name: 'Free Flight',
    short: 'FREE',
    goal: 'Explore Pulau Merapi. Score for distance flown and smooth landings.',
    tip: 'No clock, no rings. Just you, the island and the fuel gauge.',
    rings: 0,
    timeLimit: 0,
  },
];

export const SCORES = {
  ring: 100,
  ringTimeBonus: 2, // per second left when the run finishes
  landing: 250,
  landingSmoothBonus: 120,
  dropBullseye: 150,
  dropOuter: 60,
  distancePerKm: 25,
  damagePenalty: 1,
};

export const PALETTE = {
  skyTop: '#2a63c8',
  skyHorizon: '#bfe3f2',
  sea: '#14688f',
  seaDeep: '#0d4d6e',
  seaShallow: '#46b3c9',
  grass: '#4c8a3c',
  grassDry: '#7d9a44',
  fieldA: '#6da344',
  fieldB: '#93a848',
  sand: '#e3cf9e',
  rock: '#7d7468',
  volcanoRock: '#5d534a',
  dirt: '#9a7b52',
  runwayGrass: '#3f6d33',
  runwaySand: '#cbb37e',
  runwayDirt: '#8a6b45',
  planeOrange: '#e8641c',
  planeCream: '#f5ead6',
  planeDark: '#33302c',
  ring: '#ffb020',
  ringDone: '#37d67a',
  hudAmber: '#ffb020',
  hudGreen: '#4be38a',
  hudRed: '#ff5a4e',
  hudWhite: '#f4f8ff',
};

export const CONTROLS_TEXT = [
  ['W / S', 'throttle up / down'],
  ['Arrow Up / Down', 'pitch down / up'],
  ['Arrow Left / Right', 'bank and turn'],
  ['Mouse', 'steer (move to bank, wheel = throttle)'],
  ['F', 'flaps'],
  ['B', 'airbrake'],
  ['Space', 'drop crate (Supply Drop)'],
  ['C', 'chase / cockpit camera'],
  ['P', 'pause'],
  ['R', 'restart flight'],
  ['M', 'mute'],
];
