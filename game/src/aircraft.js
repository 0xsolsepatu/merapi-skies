// The bush plane: a low-poly STOL aircraft built from primitives, and the
// flight model that flies it. The model is deliberately forgiving at low
// speed and punishing at the edges — stall, overheat and hard landings are
// the decisions a sortie turns on.
import { THREE } from './three.js';
import { FLIGHT, PALETTE, RUNWAYS } from './config.js';
import { clamp, lerp } from './random.js';

function buildPlaneModel() {
  const orange = new THREE.MeshLambertMaterial({ color: PALETTE.planeOrange });
  const cream = new THREE.MeshLambertMaterial({ color: PALETTE.planeCream });
  const dark = new THREE.MeshLambertMaterial({ color: PALETTE.planeDark });
  const glass = new THREE.MeshPhongMaterial({ color: '#1c2f42', shininess: 120 });
  const group = new THREE.Group();
  group.name = 'bush-plane';

  // Fuselage: a tapered cylinder along +z (the nose), with a cone nose.
  const fuselage = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 0.75, 6.4, 10), orange);
  fuselage.rotation.x = Math.PI / 2;
  fuselage.position.set(0, 0, 0.4);
  group.add(fuselage);
  const nose = new THREE.Mesh(new THREE.ConeGeometry(1.05, 1.8, 10), cream);
  nose.rotation.x = Math.PI / 2;
  nose.position.set(0, 0, 4.5);
  group.add(nose);
  // Cabin with dark windows, so the plane reads as crewed, not a toy.
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.7, 1.15, 2.6), cream);
  cabin.position.set(0, 0.75, 0.6);
  group.add(cabin);
  const windows = new THREE.Mesh(new THREE.BoxGeometry(1.78, 0.62, 2.0), glass);
  windows.position.set(0, 0.85, 0.6);
  group.add(windows);
  // Belly stripe.
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.02, 0.22, 5.6), cream);
  stripe.position.set(0, -0.35, 0.4);
  group.add(stripe);

  // High wing with struts, plus tail feathers.
  const wing = new THREE.Mesh(new THREE.BoxGeometry(15.5, 0.28, 2.7), cream);
  wing.position.set(0, 1.25, 0.9);
  group.add(wing);
  const wingTipL = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 2.7), orange);
  wingTipL.position.set(-7.6, 1.25, 0.9);
  group.add(wingTipL);
  const wingTipR = wingTipL.clone();
  wingTipR.position.x = 7.6;
  group.add(wingTipR);
  for (const s of [-1, 1]) {
    const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 2.6, 5), dark);
    strut.position.set(s * 2.6, 0.3, 0.9);
    strut.rotation.z = s * 0.5;
    group.add(strut);
  }
  const tailplane = new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.22, 1.6), cream);
  tailplane.position.set(0, 0.35, -2.9);
  group.add(tailplane);
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.22, 2.4, 1.9), orange);
  fin.position.set(0, 1.15, -2.9);
  group.add(fin);

  // Propeller: two blades plus a translucent blur disc that fades in with rpm.
  const prop = new THREE.Group();
  prop.position.set(0, 0, 5.5);
  const hub = new THREE.Mesh(new THREE.ConeGeometry(0.35, 0.9, 8), dark);
  hub.rotation.x = Math.PI / 2;
  prop.add(hub);
  const bladeGeo = new THREE.BoxGeometry(0.42, 3.4, 0.12);
  const bladeMat = new THREE.MeshLambertMaterial({ color: '#2b2b2b' });
  const bladeA = new THREE.Mesh(bladeGeo, bladeMat);
  prop.add(bladeA);
  const bladeB = new THREE.Mesh(bladeGeo, bladeMat);
  bladeB.rotation.z = Math.PI / 2;
  prop.add(bladeB);
  const disc = new THREE.Mesh(
    new THREE.CircleGeometry(1.9, 24),
    new THREE.MeshBasicMaterial({ color: '#cccccc', transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false }),
  );
  prop.add(disc);
  group.add(prop);

  // Wingtip nav lights + tail light: small unlit dots that read in a shot.
  const navL = new THREE.Mesh(
    new THREE.SphereGeometry(0.35, 8, 6),
    new THREE.MeshBasicMaterial({ color: '#ff2a1e' }),
  );
  navL.position.set(-7.85, 1.25, 0.9);
  group.add(navL);
  const navR = new THREE.Mesh(
    new THREE.SphereGeometry(0.35, 8, 6),
    new THREE.MeshBasicMaterial({ color: '#2aff5e' }),
  );
  navR.position.set(7.85, 1.25, 0.9);
  group.add(navR);
  const tailLight = new THREE.Mesh(
    new THREE.SphereGeometry(0.25, 8, 6),
    new THREE.MeshBasicMaterial({ color: '#ffffff' }),
  );
  tailLight.position.set(0, 0.6, -3.85);
  group.add(tailLight);

  // Fixed tricycle gear.
  for (const s of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 1.6, 5), dark);
    leg.position.set(s * 1.1, -1.3, 1.2);
    group.add(leg);
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.4, 12), dark);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(s * 1.1, -2.0, 1.2);
    group.add(wheel);
  }
  const tailWheel = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.25, 10), dark);
  tailWheel.rotation.z = Math.PI / 2;
  tailWheel.position.set(0, -1.2, -2.9);
  group.add(tailWheel);

  return { group, prop, disc };
}

function runwayAt(x, z) {
  for (const rw of RUNWAYS) {
    const hr = (rw.heading * Math.PI) / 180;
    const dx = x - rw.x;
    const dz = z - rw.z;
    const u = dx * Math.sin(hr) + dz * Math.cos(hr);
    const v = dx * Math.cos(hr) - dz * Math.sin(hr);
    if (Math.abs(u) < rw.length / 2 && Math.abs(v) < rw.width / 2) return rw;
  }
  return null;
}

export function createAircraft(scene) {
  const { group, prop, disc } = buildPlaneModel();
  scene.add(group);

  const state = {
    position: new THREE.Vector3(60, 10, 820),
    heading: Math.PI, // facing north, down Merapi Field
    pitch: 0,
    roll: 0,
    speed: 0,
    throttle: 0,
    flaps: false,
    brake: false,
    fuel: FLIGHT.fuelCapacity,
    heat: 0,
    heatLimited: false,
    damage: 0,
    onGround: true,
    airborne: false,
    verticalSpeed: 0,
    distanceFlown: 0,
    stalled: false,
    crashed: false,
    crashReason: '',
    shake: 0,
  };

  function reset(spawn) {
    state.position.set(spawn.x, spawn.y, spawn.z);
    state.heading = spawn.heading;
    state.pitch = 0;
    state.roll = 0;
    state.speed = 0;
    state.throttle = 0;
    state.flaps = false;
    state.brake = false;
    state.fuel = FLIGHT.fuelCapacity;
    state.heat = 0;
    state.heatLimited = false;
    state.damage = 0;
    state.onGround = true;
    state.airborne = false;
    state.verticalSpeed = 0;
    state.distanceFlown = 0;
    state.stalled = false;
    state.crashed = false;
    state.crashReason = '';
    state.shake = 0;
    syncVisual(0);
  }

  function syncVisual(dt) {
    group.position.copy(state.position);
    group.rotation.set(-state.pitch, state.heading, -state.roll, 'YXZ');
    const rpm = state.throttle * (state.fuel > 0 ? 1 : 0);
    prop.rotation.z += dt * (4 + rpm * 55);
    disc.material.opacity = clamp(rpm * 0.35 - 0.05, 0, 0.3);
  }

  // One physics step. Returns a list of events for the game to score:
  // touchdown { vspeed, bank, runway }, crash { reason }, liftoff {}.
  function step(dt, input, heightAt) {
    const events = [];
    if (state.crashed) return events;
    const F = FLIGHT;

    // Throttle, with the overheat limiter.
    if (input.throttleUp) state.throttle = clamp(state.throttle + F.throttleRate * dt, 0, 1);
    if (input.throttleDown) state.throttle = clamp(state.throttle - F.throttleRate * dt, 0, 1);
    if (input.throttleSet !== undefined && input.throttleSet !== null) {
      state.throttle = clamp(input.throttleSet, 0, 1);
    }
    state.brake = !!input.brake;
    if (input.flapsToggle) state.flaps = !state.flaps;

    // Fuel burn and engine heat: full throttle is fast, not free.
    const burn = (F.fuelBurnIdle + (F.fuelBurn - F.fuelBurnIdle) * state.throttle) * dt;
    state.fuel = Math.max(0, state.fuel - burn);
    if (state.throttle > 0.9 && state.fuel > 0) state.heat += F.heatRate * dt;
    else state.heat = Math.max(0, state.heat - F.heatCool * dt);
    if (state.heat >= F.overheatAt && !state.heatLimited) {
      state.heatLimited = true;
      state.heat = 62;
      state.damage = Math.min(100, state.damage + 15);
      events.push({ type: 'overheat' });
    }
    if (state.heatLimited && state.heat < 38) state.heatLimited = false;
    const throttle = state.heatLimited ? Math.min(state.throttle, 0.55) : state.throttle;
    if (state.fuel <= 0) state.throttle = 0;

    const stallSpeed = state.flaps ? F.stallSpeed - 6 : F.stallSpeed;
    const wasGround = state.onGround;

    // Attitude targets from the controls.
    const pitchTarget = state.onGround
      ? 0
      : clamp(input.pitch * 0.55, -0.5, 0.5);
    const rollTarget = clamp(input.roll * 0.95, -1.1, 1.1);
    const pitchRate = state.onGround ? 0 : F.pitchRate;
    state.pitch = lerp(state.pitch, pitchTarget, clamp(pitchRate * dt * 2.2, 0, 1));
    state.roll = lerp(state.roll, rollTarget, clamp(F.rollRate * dt * 1.6, 0, 1));

    // Speed: throttle sets the target, climb and drag take their cut.
    let targetSpeed = throttle * F.maxSpeed;
    if (!state.onGround) {
      targetSpeed -= Math.max(0, state.pitch) * 26;
      targetSpeed += Math.max(0, -state.pitch) * 12;
      if (state.flaps) targetSpeed -= 8;
    }
    const drag = state.brake ? 1.6 : state.flaps ? 0.5 : F.drag;
    state.speed += (targetSpeed - state.speed) * clamp((0.32 + drag * 0.4) * dt * 2, 0, 1);
    state.speed = clamp(state.speed, 0, F.maxSpeed);

    // Stall: below flying speed the wing quits and the nose drops.
    state.stalled = !state.onGround && state.speed < stallSpeed;
    if (state.stalled) {
      state.pitch = lerp(state.pitch, -0.22, clamp(2.5 * dt, 0, 1));
    }

    // Coordinated turn: bank turns the nose, gently at low speed.
    if (!state.onGround) {
      state.heading -= Math.sin(state.roll) * F.turnCoordination * (0.35 + 0.65 * (state.speed / F.cruiseSpeed)) * dt;
    } else if (state.speed > 4) {
      state.heading -= state.roll * 0.35 * dt * (state.speed / 30);
    }

    // Integrate.
    const cp = Math.cos(state.pitch);
    const forward = new THREE.Vector3(
      Math.sin(state.heading) * cp,
      Math.sin(state.pitch),
      Math.cos(state.heading) * cp,
    );
    let vy = state.speed * Math.sin(state.pitch);
    if (state.stalled) vy -= (stallSpeed - state.speed) * 0.55;
    if (!state.onGround && state.speed < 4) vy -= F.sinkRate * 0.4;
    state.verticalSpeed = vy;
    const prevY = state.position.y;
    state.position.addScaledVector(forward, state.speed * dt);
    state.position.y = prevY + vy * dt;
    state.distanceFlown += state.speed * dt;
    if (state.shake > 0) state.shake = Math.max(0, state.shake - dt * 2.2);

    // Ground contact.
    const groundH = heightAt(state.position.x, state.position.z);
    const gearY = groundH + 1.4;
    if (state.position.y <= gearY) {
      state.position.y = gearY;
      if (!wasGround) {
        // Touchdown: judge it by sink rate, bank and surface.
        const rw = runwayAt(state.position.x, state.position.z);
        const bank = Math.abs(state.roll);
        if (groundH < 0.5) {
          crash('ditched in the sea');
          events.push({ type: 'crash', reason: 'ditched in the sea' });
        } else if (!rw && state.speed > 45) {
          // Flying into rising ground at speed is a crash, not a landing.
          crash('flew into the hillside');
          events.push({ type: 'crash', reason: state.crashReason });
        } else if (vy < -9 || bank > 0.7) {
          crash(vy < -9 ? 'slammed into the ground' : 'cartwheeled on touchdown');
          events.push({ type: 'crash', reason: state.crashReason });
        } else {
          state.onGround = true;
          state.pitch = 0;
          if (vy < -F.hardTouchdownVSpeed || bank > F.maxBankForLanding) {
            state.damage = Math.min(100, state.damage + F.damageHardLanding);
            state.shake = 1;
            events.push({ type: 'hard-landing', vspeed: vy, bank, runway: rw ? rw.id : null });
          } else {
            state.shake = 0.35;
            events.push({ type: 'touchdown', vspeed: vy, bank, runway: rw ? rw.id : null });
          }
          if (state.damage >= 100) {
            crash('airframe gave out after a hard landing');
            events.push({ type: 'crash', reason: state.crashReason });
          }
        }
      } else {
        state.onGround = true;
        state.pitch = 0;
        if (state.brake) state.speed = Math.max(0, state.speed - 26 * dt);
        // Rolling drag on grass and dirt.
        state.speed = Math.max(0, state.speed - 1.6 * dt);
        if (state.speed > F.takeoffSpeed && input.pitch > 0.25) {
          state.onGround = false;
          state.airborne = true;
          events.push({ type: 'liftoff' });
        }
      }
    } else if (wasGround && state.position.y > gearY + 0.5) {
      state.onGround = false;
      state.airborne = true;
    }
    if (state.damage >= 100 && !state.crashed) {
      crash('airframe damage reached 100%');
      events.push({ type: 'crash', reason: state.crashReason });
    }
    syncVisual(dt);
    return events;
  }

  function crash(reason) {
    state.crashed = true;
    state.crashReason = reason;
    state.shake = 1;
  }

  function spawnFor(runway) {
    const hr = (runway.heading * Math.PI) / 180;
    return {
      x: runway.x - Math.sin(hr) * (runway.length / 2 - 60),
      y: runway.elevation + 1.4,
      z: runway.z - Math.cos(hr) * (runway.length / 2 - 60),
      heading: hr,
    };
  }

  return { group, state, reset, step, spawnFor, crash };
}
