// Sky rings for the Ring Run and ground targets for the Supply Drop.
// A ring is passed when the plane crosses its disc; a drop scores when its
// crate lands near a target circle.
import { THREE } from './three.js';
import { PALETTE } from './config.js';
import { heightAt } from './terrain.js';
import { clamp } from './random.js';

function numberSprite(n) {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = 'rgba(10,14,20,0.72)';
  g.beginPath();
  g.arc(64, 64, 56, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = '#ffb020';
  g.lineWidth = 6;
  g.stroke();
  g.fillStyle = '#ffffff';
  g.font = 'bold 64px system-ui, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(String(n), 64, 68);
  const tex = new THREE.CanvasTexture(c);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  sprite.scale.set(22, 22, 1);
  return sprite;
}

// The Ring Run course: out over the south coast, around the volcano's
// shoulder, back down the east coast to Coral Coast, then home.
const COURSE = [
  { x: 60, z: 620, y: 150 },
  { x: -140, z: 240, y: 170 },
  { x: -420, z: -120, y: 210 },
  { x: -260, z: -420, y: 230 },
  { x: 120, z: -520, y: 200 },
  { x: 560, z: -260, y: 170 },
  { x: 880, z: 120, y: 140 },
  { x: 420, z: 560, y: 150 },
];

export function createRings(scene) {
  const group = new THREE.Group();
  group.name = 'sky-rings';
  scene.add(group);
  const rings = [];
  const ringGeo = new THREE.TorusGeometry(15, 1.4, 10, 40);
  COURSE.forEach((spot, i) => {
    const mat = new THREE.MeshBasicMaterial({ color: PALETTE.ring });
    const mesh = new THREE.Mesh(ringGeo, mat);
    mesh.position.set(spot.x, spot.y, spot.z);
    // Face the ring along the course: toward the next ring (or back home).
    const next = COURSE[(i + 1) % COURSE.length];
    mesh.lookAt(next.x, next.y, next.z);
    group.add(mesh);
    const label = numberSprite(i + 1);
    label.position.set(spot.x, spot.y + 24, spot.z);
    group.add(label);
    const normal = new THREE.Vector3(next.x - spot.x, next.y - spot.y, next.z - spot.z).normalize();
    rings.push({ mesh, label, center: new THREE.Vector3(spot.x, spot.y, spot.z), normal, passed: false });
  });

  let nextIndex = 0;
  let prevSide = null;

  function reset() {
    nextIndex = 0;
    prevSide = null;
    for (const r of rings) {
      r.passed = false;
      r.mesh.material.color.set(PALETTE.ring);
      r.mesh.visible = true;
      r.label.visible = true;
    }
  }

  function setVisible(v) {
    group.visible = v;
  }

  // Call every frame with the plane position. Returns the ring just passed.
  function checkPass(position) {
    if (nextIndex >= rings.length) return null;
    const ring = rings[nextIndex];
    const rel = new THREE.Vector3().subVectors(position, ring.center);
    const side = Math.sign(rel.dot(ring.normal)) || 1;
    let passed = null;
    if (prevSide !== null && side !== prevSide) {
      const dist = rel.length();
      if (dist < 15) {
        ring.passed = true;
        ring.mesh.material.color.set(PALETTE.ringDone);
        passed = ring;
        nextIndex += 1;
      } else {
        // Clipped the post: crossed the plane outside the disc.
        passed = { clipped: true, ring };
      }
    }
    prevSide = side;
    return passed;
  }

  function nextRing() {
    return nextIndex < rings.length ? rings[nextIndex] : null;
  }

  function passedCount() {
    return nextIndex;
  }

  function totalCount() {
    return rings.length;
  }

  // Screenshot helper: mark the first n rings as already flown through.
  function markPassed(n) {
    for (let i = 0; i < Math.min(n, rings.length); i += 1) {
      rings[i].passed = true;
      rings[i].mesh.material.color.set(PALETTE.ringDone);
    }
    nextIndex = Math.min(n, rings.length);
    prevSide = null;
  }

  return { reset, setVisible, checkPass, nextRing, passedCount, totalCount, markPassed, group };
}

const DROP_SPOTS = [
  { x: 240, z: 640, name: 'Merapi Village' },
  { x: 700, z: 260, name: 'Coral Village' },
  { x: -40, z: -560, name: 'Crater Village' },
];

export function createDropTargets(scene) {
  const group = new THREE.Group();
  group.name = 'drop-targets';
  scene.add(group);
  const targets = [];
  for (const spot of DROP_SPOTS) {
    const y = heightAt(spot.x, spot.z);
    const outer = new THREE.Mesh(
      new THREE.RingGeometry(9, 26, 32),
      new THREE.MeshBasicMaterial({ color: PALETTE.ring, transparent: true, opacity: 0.85, side: THREE.DoubleSide }),
    );
    outer.rotation.x = -Math.PI / 2;
    outer.position.set(spot.x, y + 0.6, spot.z);
    group.add(outer);
    const inner = new THREE.Mesh(
      new THREE.CircleGeometry(9, 24),
      new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.5, side: THREE.DoubleSide }),
    );
    inner.rotation.x = -Math.PI / 2;
    inner.position.set(spot.x, y + 0.65, spot.z);
    group.add(inner);
    // A beacon pole so the target is findable from the air.
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.4, 0.4, 26, 6),
      new THREE.MeshBasicMaterial({ color: PALETTE.ring }),
    );
    pole.position.set(spot.x, y + 13, spot.z);
    group.add(pole);
    targets.push({ ...spot, y, outer, inner, done: false });
  }

  function reset() {
    for (const t of targets) {
      t.done = false;
      t.outer.visible = true;
      t.inner.visible = true;
    }
  }

  function setVisible(v) {
    group.visible = v;
  }

  // Score a crate landing: bullseye < 10 m, outer ring < 26 m.
  function scoreLanding(x, z) {
    let best = null;
    for (const t of targets) {
      if (t.done) continue;
      const d = Math.hypot(x - t.x, z - t.z);
      if (d < 26 && (!best || d < best.d)) best = { target: t, d };
    }
    if (!best) return null;
    best.target.done = true;
    best.target.outer.visible = false;
    best.target.inner.visible = false;
    return { target: best.target, distance: best.d, bullseye: best.d < 10 };
  }

  function remaining() {
    return targets.filter((t) => !t.done).length;
  }

  return { reset, setVisible, scoreLanding, remaining, targets };
}

export function createCrates(scene) {
  const group = new THREE.Group();
  group.name = 'cargo-crates';
  scene.add(group);
  const falling = [];
  const landed = [];
  const mat = new THREE.MeshLambertMaterial({ color: '#c98a2e' });
  const edgeMat = new THREE.MeshLambertMaterial({ color: '#7a5212' });

  function drop(position) {
    const crate = new THREE.Group();
    const box = new THREE.Mesh(new THREE.BoxGeometry(3, 3, 3), mat);
    crate.add(box);
    const band = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.5, 3.2), edgeMat);
    crate.add(band);
    crate.position.copy(position);
    group.add(crate);
    falling.push({ mesh: crate, vy: 0 });
    return crate;
  }

  function update(dt, heightAtFn) {
    for (let i = falling.length - 1; i >= 0; i -= 1) {
      const c = falling[i];
      c.vy = Math.min(c.vy + 22 * dt, 16);
      c.mesh.position.y -= c.vy * dt;
      c.mesh.rotation.y += dt * 0.8;
      const ground = heightAtFn(c.mesh.position.x, c.mesh.position.z);
      if (c.mesh.position.y <= ground + 1.5) {
        c.mesh.position.y = ground + 1.5;
        falling.splice(i, 1);
        landed.push({ mesh: c.mesh, x: c.mesh.position.x, z: c.mesh.position.z, age: 0 });
      }
    }
    for (const l of landed) l.age += dt;
    void clamp;
  }

  function lastLanded() {
    return landed.length ? landed[landed.length - 1] : null;
  }

  function fallingCount() {
    return falling.length;
  }

  function reset() {
    for (const c of falling) group.remove(c.mesh);
    for (const l of landed) group.remove(l.mesh);
    falling.length = 0;
    landed.length = 0;
  }

  return { drop, update, lastLanded, fallingCount, reset };
}
