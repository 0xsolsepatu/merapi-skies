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
    // Approach ring 3 ON its normal axis (it faces ring 4), ~220 m back,
    // so after 30 frames of sim drift the ring reads as a full circle
    // framing the sky instead of an edge-on bar — and the clip check never
    // fires. Ring 3 (-420, 210, -120) faces ring 4 (-260, 230, -420):
    // normal ≈ (0.47, -0.88), heading ≈ 2.65 rad.
    a.position.set(-524, 205, 74);
    a.heading = 2.65;
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
    // On final approach to Merapi Field: closer in than v1, so the runway
    // fills the lower frame; threshold at z=1030, plane ends right over it.
    a.position.set(60, 32, 1080);
    a.heading = Math.PI;
    a.pitch = -0.06;
    a.roll = 0;
    a.speed = 32;
    a.throttle = 0.32;
    a.flaps = true;
    a.onGround = false;
    a.airborne = true;
    a.verticalSpeed = -2.8;
    api.setCamera('chase');
  }
  return name;
}
