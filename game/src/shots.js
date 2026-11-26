// Deterministic screenshot scenes for Merapi Skies. Each ?shot= scene puts
// the plane, the mission and the camera in one fixed pose so a headless
// run renders the same frame every time — the cover especially is staged:
// runway below, a ring ahead, coast and volcano in the distance, HUD lit.
export function applyShot(api, name) {
  const a = api.aircraft.state;
  if (name === 'cover') {
    api.setMission('rings');
    api.startMission();
    a.position.set(100, 170, 1000);
    a.heading = Math.PI;
    a.pitch = 0.03;
    a.roll = 0.22;
    a.speed = 55;
    a.throttle = 0.72;
    a.onGround = false;
    a.airborne = true;
    api.setCamera('chase');
  } else if (name === 'menu') {
    api.setMission('rings');
    api.resetToSpawn();
    api.setCamera('chase');
    api.showMenu(true);
  } else if (name === 'rings') {
    api.setMission('rings');
    api.startMission();
    api.rings.markPassed(2);
    // 60 m before ring 3, on the course line from ring 2.
    a.position.set(-370, 205, -52);
    a.heading = 3.81; // ~218 deg, along the course toward ring 3
    a.pitch = 0.02;
    a.roll = -0.18;
    a.speed = 62;
    a.throttle = 0.8;
    a.onGround = false;
    a.airborne = true;
    api.setCamera('chase');
  } else if (name === 'landing') {
    api.setMission('hop');
    api.startMission();
    // On final approach to Merapi Field: runway ahead, island behind it.
    a.position.set(60, 38, 1140);
    a.heading = Math.PI;
    a.pitch = -0.06;
    a.roll = 0;
    a.speed = 32;
    a.throttle = 0.32;
    a.flaps = true;
    a.onGround = false;
    a.airborne = true;
    a.verticalSpeed = -2.8;
    api.spawnDust(60, 8, 950, 18);
    api.setCamera('chase');
  }
  return name;
}
