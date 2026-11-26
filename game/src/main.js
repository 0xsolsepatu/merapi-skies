// Merapi Skies: boot, game loop, missions, camera and screens.
// This file wires the modules together; the flying lives in aircraft.js,
// the island in terrain.js, the instruments in hud.js.
import { THREE } from './three.js';
import { GAME_TITLE, GAME_SUBTITLE, MISSIONS, RUNWAYS, SCORES, FLIGHT, CONTROLS_TEXT } from './config.js';
import { createWorld, heightAt } from './terrain.js';
import { createSky } from './sky.js';
import { createAircraft } from './aircraft.js';
import { createRings, createDropTargets, createCrates } from './rings.js';
import { createHud } from './hud.js';
import { createAudio } from './audio.js';
import { createInput } from './input.js';
import { applyShot } from './shots.js';
import { clamp } from './random.js';

const canvas3d = document.getElementById('scene');
const hudCanvas = document.getElementById('hud');
const statusEl = document.getElementById('status');
const menuEl = document.getElementById('menu');
const pauseEl = document.getElementById('pause');
const endEl = document.getElementById('end');
const toastEl = document.getElementById('toast');

const params = new URLSearchParams(window.location.search);
const shotName = params.get('shot');
const SHOT_MODE = !!shotName;

const renderer = new THREE.WebGLRenderer({ canvas: canvas3d, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xcfe4ef, 700, 3600);
const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.5, 9000);

const hemi = new THREE.HemisphereLight(0xbfd9ff, 0x4a6b3a, 0.85);
scene.add(hemi);
const sunLight = new THREE.DirectionalLight(0xfff2cc, 1.05);
sunLight.position.set(-1400, 900, -900);
scene.add(sunLight);

const world = createWorld(scene);
const sky = createSky(scene);
const aircraft = createAircraft(scene);
const rings = createRings(scene);
const targets = createDropTargets(scene);
const crates = createCrates(scene);
const hud = createHud(hudCanvas);
const audio = createAudio();
const input = createInput(canvas3d);

hud.resize(window.innerWidth, window.innerHeight);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  hud.resize(window.innerWidth, window.innerHeight);
});

// --- Dust puffs on touchdown and dirt-strip taxiing ---
const DUST_MAX = 240;
const dustGeo = new THREE.BufferGeometry();
const dustPos = new Float32Array(DUST_MAX * 3);
for (let i = 0; i < DUST_MAX; i += 1) dustPos[i * 3 + 1] = -1000;
dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({
  color: 0xd8c49a, size: 7, transparent: true, opacity: 0.55, depthWrite: false,
}));
dust.frustumCulled = false;
scene.add(dust);
const puffs = [];
function spawnDust(x, y, z, n) {
  for (let i = 0; i < n; i += 1) {
    if (puffs.length >= DUST_MAX) puffs.shift();
    puffs.push({
      x: x + (Math.random() - 0.5) * 8,
      y: y + Math.random() * 2,
      z: z + (Math.random() - 0.5) * 8,
      vx: (Math.random() - 0.5) * 6,
      vy: Math.random() * 3 + 1,
      vz: (Math.random() - 0.5) * 6,
      life: 2.6,
    });
  }
}
function updateDust(dt) {
  for (let i = 0; i < DUST_MAX; i += 1) {
    const p = puffs[i];
    if (!p) {
      dustPos[i * 3 + 1] = -1000;
      continue;
    }
    p.life -= dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.z += p.vz * dt;
    dustPos[i * 3] = p.x;
    dustPos[i * 3 + 1] = p.y;
    dustPos[i * 3 + 2] = p.z;
    if (p.life <= 0) puffs.splice(i, 1);
  }
  dustGeo.attributes.position.needsUpdate = true;
}

// --- Game state ---
let screen = 'menu';
let missionId = 'rings';
let mission = MISSIONS[0];
let score = 0;
let elapsed = 0;
let cameraMode = 'chase';
let toast = '';
let toastUntil = 0;
let lastTouchdown = null;
let stoppedTimer = 0;
let landedStrips = new Set();
let cratesLeft = 3;
let lastLandedCount = 0;
let endReason = '';
let endStars = 0;
let framesRendered = 0;
let menuOrbit = 0;

function missionById(id) {
  return MISSIONS.find((m) => m.id === id) || MISSIONS[0];
}

function setMission(id) {
  missionId = id;
  mission = missionById(id);
  document.querySelectorAll('.mission-card').forEach((card) => {
    card.classList.toggle('selected', card.dataset.mission === id);
  });
}

function resetToSpawn() {
  aircraft.reset(aircraft.spawnFor(RUNWAYS[0]));
  lastTouchdown = null;
  stoppedTimer = 0;
  landedStrips = new Set();
  cratesLeft = 3;
  lastLandedCount = 0;
  freeLandingBonus = 0;
}

function startMission() {
  resetToSpawn();
  rings.reset();
  targets.reset();
  crates.reset();
  rings.setVisible(missionId === 'rings');
  targets.setVisible(missionId === 'drop');
  score = 0;
  elapsed = 0;
  endReason = '';
  toast = mission.goal;
  toastUntil = performance.now() + 5000;
  screen = 'playing';
  menuEl.classList.add('hidden');
  pauseEl.classList.add('hidden');
  endEl.classList.add('hidden');
  statusEl.textContent = `${GAME_TITLE}: ${mission.name} started. ${mission.goal}`;
  audio.ensure();
  audio.click();
}

function showMenu() {
  screen = 'menu';
  resetToSpawn();
  rings.reset();
  targets.reset();
  crates.reset();
  rings.setVisible(false);
  targets.setVisible(false);
  menuEl.classList.remove('hidden');
  pauseEl.classList.add('hidden');
  endEl.classList.add('hidden');
}

function showEnd(title, reason, stars) {
  screen = 'over';
  endReason = reason;
  endStars = stars;
  const mins = Math.floor(elapsed / 60);
  const secs = Math.floor(elapsed % 60);
  document.getElementById('end-title').textContent = title;
  document.getElementById('end-reason').textContent = reason;
  document.getElementById('end-stars').textContent = '★'.repeat(stars) + '☆'.repeat(3 - stars);
  document.getElementById('end-stats').textContent =
    `Score ${score}  ·  Time ${mins}:${String(secs).padStart(2, '0')}  ·  ` +
    `Distance ${(aircraft.state.distanceFlown / 1000).toFixed(1)} km  ·  Damage ${Math.round(aircraft.state.damage)}%`;
  endEl.classList.remove('hidden');
  statusEl.textContent = `${title}. ${reason} Score ${score}.`;
}

function setCamera(mode) {
  cameraMode = mode;
}

function starsFor() {
  if (score >= 900) return 3;
  if (score >= 450) return 2;
  return 1;
}

function missionProgress() {
  const s = aircraft.state;
  if (missionId === 'rings') {
    const next = rings.nextRing();
    let dist = '';
    if (next) {
      dist = ` · NEXT RING ${rings.passedCount() + 1} — ${Math.round(s.position.distanceTo(next.center))} M`;
    }
    const timeLeft = mission.timeLimit > 0 ? ` · ${Math.max(0, Math.ceil(mission.timeLimit - elapsed))} S LEFT` : '';
    return `RINGS ${rings.passedCount()}/${rings.totalCount()}${dist}${timeLeft}`;
  }
  if (missionId === 'hop') {
    const names = [...landedStrips].map((id) => RUNWAYS.find((r) => r.id === id)?.name ?? id);
    return `STRIPS ${landedStrips.size}/3${names.length ? ` — ${names.join(', ')}` : ''}`;
  }
  if (missionId === 'drop') {
    return `CRATES ${cratesLeft} LEFT · TARGETS HIT ${3 - targets.remaining()}/3`;
  }
  return `DISTANCE ${(s.distanceFlown / 1000).toFixed(1)} KM · LANDINGS SCORED`;
}

function handleEvents(events) {
  const s = aircraft.state;
  for (const ev of events) {
    if (ev.type === 'touchdown' || ev.type === 'hard-landing') {
      lastTouchdown = { ...ev, time: elapsed };
      audio.thud();
      spawnDust(s.position.x, s.position.y, s.position.z, ev.type === 'hard-landing' ? 22 : 10);
      if (missionId === 'free') {
        const pts = ev.type === 'hard-landing' ? 40 : SCORES.landing;
        freeLandingBonus += pts;
        toast = ev.type === 'hard-landing' ? 'Rough landing — bush planes forgive, barely.' : `Smooth landing! +${pts}`;
        toastUntil = performance.now() + 2600;
      } else if (ev.type === 'hard-landing') {
        toast = 'Hard landing! Airframe damage +34%.';
        toastUntil = performance.now() + 3000;
      }
    } else if (ev.type === 'overheat') {
      toast = 'Engine overheat! Throttle limited — cool it down.';
      toastUntil = performance.now() + 3000;
      audio.beep();
    } else if (ev.type === 'liftoff') {
      toast = 'Airborne!';
      toastUntil = performance.now() + 1800;
    } else if (ev.type === 'crash') {
      audio.crash();
      showEnd('Flight over', `The plane ${s.crashReason}.`, 0);
    }
  }
}

function updateMission(dt, inp) {
  const s = aircraft.state;
  elapsed += dt;

  if (missionId === 'rings') {
    const passed = rings.checkPass(s.position);
    if (passed && !passed.clipped) {
      score += SCORES.ring;
      audio.chime();
      toast = `Ring ${rings.passedCount()} of ${rings.totalCount()}! +${SCORES.ring}`;
      toastUntil = performance.now() + 2200;
      if (rings.passedCount() >= rings.totalCount()) {
        const bonus = Math.max(0, Math.round((mission.timeLimit - elapsed) * SCORES.ringTimeBonus));
        score += bonus;
        audio.fanfare();
        showEnd('Ring Run complete!', `All 8 rings flown with ${Math.max(0, Math.ceil(mission.timeLimit - elapsed))} s to spare. Time bonus +${bonus}.`, starsFor());
        return;
      }
    } else if (passed && passed.clipped) {
      s.damage = Math.min(100, s.damage + FLIGHT.damageRingClip);
      toast = 'Clipped the ring post! Damage +12%.';
      toastUntil = performance.now() + 2600;
      audio.beep();
    }
  }

  if (missionId === 'hop' && lastTouchdown && lastTouchdown.runway) {
    // A full stop on a new strip counts once the plane has sat still on it.
    if (s.onGround && s.speed < 5) {
      stoppedTimer += dt;
      if (stoppedTimer > 1.2 && !landedStrips.has(lastTouchdown.runway)) {
        landedStrips.add(lastTouchdown.runway);
        const gentle = lastTouchdown.vspeed > -FLIGHT.safeTouchdownVSpeed;
        const pts = SCORES.landing + (gentle ? SCORES.landingSmoothBonus : 0);
        score += pts;
        const rw = RUNWAYS.find((r) => r.id === lastTouchdown.runway);
        toast = `${rw ? rw.name : 'Strip'} landed${gentle ? ' — butter smooth' : ''}! +${pts}`;
        toastUntil = performance.now() + 3000;
        audio.chime();
        if (landedStrips.size >= 3) {
          audio.fanfare();
          showEnd('Island Hop complete!', 'All three airstrips landed on, full stop each.', starsFor());
          return;
        }
      }
    } else {
      stoppedTimer = 0;
    }
  }

  if (missionId === 'drop') {
    if (inp.drop && cratesLeft > 0 && !s.onGround) {
      const p = s.position.clone();
      p.y -= 2;
      crates.drop(p);
      cratesLeft -= 1;
      audio.click();
      if (s.position.y > 120 || s.speed > 55) {
        toast = 'Too high or too fast — that crate will miss. Drop under 120 m and 55 m/s.';
        toastUntil = performance.now() + 3000;
      }
    }
    const landed = crates.lastLanded();
    if (landed && crates.fallingCount() === 0) {
      // Score the most recent crate once, when nothing is still falling.
      if (lastLandedCount < 3 - cratesLeft) {
        lastLandedCount += 1;
        const result = targets.scoreLanding(landed.x, landed.z);
        if (result) {
          const pts = result.bullseye ? SCORES.dropBullseye : SCORES.dropOuter;
          score += pts;
          toast = result.bullseye
            ? `Bullseye on ${result.target.name}! +${pts}`
            : `Crate down ${Math.round(result.distance)} m from ${result.target.name} centre. +${pts}`;
          audio.chime();
          if (targets.remaining() === 0) {
            audio.fanfare();
            showEnd('Supply Drop complete!', 'All three villages supplied.', starsFor());
            return;
          }
        } else {
          toast = 'Crate missed every target.';
        }
        toastUntil = performance.now() + 3000;
      }
    }
  }

  if (missionId === 'free') {
    // Distance points accrue live; landing bonuses sit on top of them.
    score = Math.floor(s.distanceFlown / 1000) * SCORES.distancePerKm + freeLandingBonus;
  }

  if (mission.timeLimit > 0 && elapsed > mission.timeLimit) {
    showEnd('Out of time', `The ${mission.name} clock ran out.`, 0);
  }
}
let freeLandingBonus = 0;

// --- Camera ---
const camTarget = new THREE.Vector3(60, 30, 760);
const camLook = new THREE.Vector3(60, 10, 820);
function updateCamera(dt) {
  const s = aircraft.state;
  const fwd = new THREE.Vector3(
    Math.sin(s.heading) * Math.cos(s.pitch),
    Math.sin(s.pitch),
    Math.cos(s.heading) * Math.cos(s.pitch),
  );
  if (screen === 'menu') {
    menuOrbit += dt * 0.12;
    const r = 34;
    camTarget.set(
      s.position.x + Math.sin(menuOrbit) * r,
      s.position.y + 9,
      s.position.z + Math.cos(menuOrbit) * r,
    );
    // Look at a point to the side of the plane, so the plane itself sits
    // off-centre — the menu panel covers the middle of the screen.
    const viewDir = new THREE.Vector3().subVectors(s.position, camTarget).normalize();
    const right = new THREE.Vector3().crossVectors(viewDir, new THREE.Vector3(0, 1, 0)).normalize();
    camLook.copy(s.position).add(new THREE.Vector3(0, 2, 0)).addScaledVector(right, 15);
    if (SHOT_MODE) camera.position.copy(camTarget);
    else camera.position.lerp(camTarget, 1 - Math.exp(-2.5 * dt));
    camera.lookAt(camLook);
    return;
  }
  if (cameraMode === 'cockpit') {
    camTarget.copy(s.position).addScaledVector(fwd, 1.6);
    camTarget.y += 1.5;
    camera.position.copy(camTarget);
    camLook.copy(s.position).addScaledVector(fwd, 80);
    camLook.y += 1;
    camera.lookAt(camLook);
    return;
  }
  // Chase: behind and above, easing after the plane, never snapping.
  // In screenshot mode the camera snaps: a lerping camera would still be
  // hundreds of metres out when the shot is taken after a few frames.
  camTarget.copy(s.position).addScaledVector(fwd, -26);
  camTarget.y += 9;
  const ground = heightAt(camTarget.x, camTarget.z) + 3;
  if (camTarget.y < ground) camTarget.y = ground;
  if (SHOT_MODE) camera.position.copy(camTarget);
  else camera.position.lerp(camTarget, 1 - Math.exp(-5 * dt));
  camLook.copy(s.position).addScaledVector(fwd, 24);
  camLook.y += 1.5;
  camera.lookAt(camLook);
  if (s.shake > 0) {
    camera.position.x += (Math.random() - 0.5) * s.shake * 1.6;
    camera.position.y += (Math.random() - 0.5) * s.shake * 1.2;
  }
}

// --- Menu wiring ---
function buildMenu() {
  document.getElementById('game-title').textContent = GAME_TITLE;
  document.getElementById('game-subtitle').textContent = GAME_SUBTITLE;
  const list = document.getElementById('mission-list');
  MISSIONS.forEach((m, i) => {
    const card = document.createElement('button');
    card.className = 'mission-card' + (i === 0 ? ' selected' : '');
    card.dataset.mission = m.id;
    card.innerHTML = `<b>${i + 1}. ${m.name}</b><span>${m.goal}</span><em>${m.tip}</em>`;
    card.addEventListener('click', () => {
      setMission(m.id);
      audio.ensure();
      audio.click();
    });
    list.appendChild(card);
  });
  const controls = document.getElementById('controls-list');
  CONTROLS_TEXT.forEach(([key, desc]) => {
    const row = document.createElement('div');
    row.innerHTML = `<b>${key}</b> ${desc}`;
    controls.appendChild(row);
  });
  document.getElementById('start-btn').addEventListener('click', () => startMission());
  document.getElementById('resume-btn').addEventListener('click', () => {
    screen = 'playing';
    pauseEl.classList.add('hidden');
  });
  document.getElementById('restart-btn').addEventListener('click', () => startMission());
  document.getElementById('menu-btn').addEventListener('click', () => showMenu());
  document.getElementById('again-btn').addEventListener('click', () => startMission());
  document.getElementById('end-menu-btn').addEventListener('click', () => showMenu());
}
buildMenu();

// --- Shot-mode API (screenshots) ---
const api = {
  aircraft,
  rings,
  targets,
  crates,
  setMission,
  startMission,
  resetToSpawn,
  setCamera,
  showMenu,
  spawnDust,
};
window.__game = api;
window.__world = {
  get state() {
    return aircraft.state;
  },
  get score() {
    return score;
  },
  get mission() {
    return missionId;
  },
  get screen() {
    return screen;
  },
};

if (SHOT_MODE) {
  applyShot(api, shotName);
  screen = shotName === 'menu' ? 'menu' : 'playing';
} else {
  showMenu();
}

// --- Main loop ---
const clock = new THREE.Clock();
function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(clock.getDelta(), 0.05);
  const inp = input.getInput();

  if (inp.muteToggle) {
    audio.ensure();
    audio.setMuted(!audio.isMuted());
    toast = audio.isMuted() ? 'Muted.' : 'Sound on.';
    toastUntil = performance.now() + 1500;
  }

  if (screen === 'menu') {
    if (inp.missionKey) {
      const idx = Number(inp.missionKey.slice(-1)) - 1;
      if (MISSIONS[idx]) setMission(MISSIONS[idx].id);
    }
    if (inp.start) startMission();
    world.update(dt, 0);
    sky.update(dt, SHOT_MODE);
    updateCamera(dt);
  } else if (screen === 'playing') {
    if (inp.pauseToggle) {
      screen = 'paused';
      pauseEl.classList.remove('hidden');
      statusEl.textContent = 'Paused.';
    } else if (inp.restart) {
      startMission();
    } else {
      if (inp.cameraToggle) {
        cameraMode = cameraMode === 'chase' ? 'cockpit' : 'chase';
        toast = cameraMode === 'chase' ? 'Chase camera.' : 'Cockpit camera.';
        toastUntil = performance.now() + 1500;
      }
      const events = aircraft.step(dt, inp, heightAt);
      handleEvents(events);
      if (screen === 'playing') {
        updateMission(dt, inp);
      }
      world.update(dt, elapsed);
      sky.update(dt, SHOT_MODE);
      crates.update(dt, heightAt);
      updateDust(dt);
      updateCamera(dt);
      audio.update(aircraft.state.throttle, aircraft.state.speed, !aircraft.state.onGround);
    }
  } else if (screen === 'paused') {
    if (inp.pauseToggle) {
      screen = 'playing';
      pauseEl.classList.add('hidden');
    } else if (inp.restart) {
      startMission();
    }
  } else if (screen === 'over') {
    if (inp.restart) startMission();
    world.update(dt, elapsed);
    sky.update(dt, SHOT_MODE);
    updateDust(dt);
    updateCamera(dt);
  }

  // HUD: instruments while flying, mission strip while playing.
  const toastText = performance.now() < toastUntil ? toast : '';
  hud.draw(aircraft.state, { name: mission.name, score, progress: missionProgress() }, {
    menu: screen === 'menu',
    toast: toastText,
  });
  if (screen === 'menu') {
    // Keep the parked plane visible behind the menu overlay.
    aircraft.state.position.y = heightAt(aircraft.state.position.x, aircraft.state.position.z) + 1.4;
  }

  renderer.render(scene, camera);
  framesRendered += 1;
  if (SHOT_MODE && framesRendered >= 30) {
    window.__shotReady = true;
  }
  input.consumeEdges();
}
frame();
