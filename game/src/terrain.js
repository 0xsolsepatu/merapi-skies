// Pulau Merapi: the island itself. One height function drives the mesh,
// the colours, the trees, the villages and the flight model's ground
// collisions, so the ground you see is the ground you can hit.
import { THREE } from './three.js';
import { WORLD, RUNWAYS, PALETTE } from './config.js';
import { fbm, makeRng, clamp, smoothstep, lerp } from './random.js';

const SEED = 20261126;

function islandMask(x, z) {
  const coast = 980 + 170 * fbm(x * 0.0016 + 7, z * 0.0016 - 3, SEED, 3);
  const r = Math.hypot(x, z);
  return 1 - smoothstep(coast - 90, coast + 130, r);
}

function volcanoHeight(x, z) {
  const v = WORLD.volcano;
  const d = Math.hypot(x - v.x, z - v.z) / v.radius;
  if (d >= 1) return 0;
  const cone = Math.pow(1 - d, 1.6) * v.height;
  const crater = -26 * Math.exp(-(d * d) / 0.012);
  return cone + crater;
}

function runwayBlend(x, z) {
  // Returns { elevation, weight } of the strongest runway flattening here.
  // A runway's length axis is (sin h, cos h) for its heading h in radians.
  let best = { elevation: 0, weight: 0 };
  for (const rw of RUNWAYS) {
    const hr = (rw.heading * Math.PI) / 180;
    const dx = x - rw.x;
    const dz = z - rw.z;
    const u = dx * Math.sin(hr) + dz * Math.cos(hr);
    const v = dx * Math.cos(hr) - dz * Math.sin(hr);
    const du = Math.max(0, Math.abs(u) - rw.length / 2);
    const dv = Math.max(0, Math.abs(v) - rw.width / 2);
    const dist = Math.hypot(du, dv);
    const w = 1 - smoothstep(40, 130, dist);
    if (w > best.weight) best = { elevation: rw.elevation, weight: w };
  }
  return best;
}

export function heightAt(x, z) {
  const mask = islandMask(x, z);
  if (mask <= 0) return -6; // open sea floor, well below the water
  let h = 10 + 95 * fbm(x * 0.0011 + 11, z * 0.0011 - 5, SEED + 31, 4);
  h += volcanoHeight(x, z);
  h *= 0.35 + 0.65 * mask; // sink the rim into the sea
  const flat = runwayBlend(x, z);
  if (flat.weight > 0) h = lerp(h, flat.elevation, flat.weight);
  return h;
}

function colourFor(x, z, h, rngPatch) {
  const c = new THREE.Color();
  const patch = fbm(x * 0.004 + 40, z * 0.004 - 17, SEED + 77, 3);
  // Slope from the height function itself (build-time only, once per vertex):
  // steep HIGH ground reads as bare rock, which gives the volcano and
  // ridges their shape. Kept above h>85 on purpose — painting rock on
  // mid-elevation hillsides turned the whole island grey (v2 first pass).
  const slope = Math.max(
    Math.abs(heightAt(x + 12, z) - h) / 12,
    Math.abs(heightAt(x, z + 12) - h) / 12,
  );
  if (h < 3.5) {
    c.set(PALETTE.sand);
  } else if (h > 170) {
    c.set(PALETTE.volcanoRock);
  } else if (h > 135 || (slope > 0.6 && h > 120)) {
    c.set(PALETTE.rock);
  } else if (patch > 0.62) {
    c.set(PALETTE.fieldA);
  } else if (patch > 0.52) {
    c.set(PALETTE.fieldB);
  } else if (patch < 0.18) {
    c.set(PALETTE.grassDry);
  } else {
    c.set(PALETTE.grass);
  }
  // Gentle mottling so the ground never reads as one flat colour.
  const m = 0.92 + 0.16 * rngPatch;
  c.multiplyScalar(m);
  return c;
}

function buildGround(scene) {
  const size = WORLD.size;
  const seg = 190;
  const geo = new THREE.PlaneGeometry(size, size, seg, seg);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const colours = new Float32Array(pos.count * 3);
  const tmp = new THREE.Color();
  for (let i = 0; i < pos.count; i += 1) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const h = heightAt(x, z);
    pos.setY(i, h);
    tmp.copy(colourFor(x, z, h, fbm(x * 0.02, z * 0.02, SEED + 5, 2)));
    colours[i * 3] = tmp.r;
    colours[i * 3 + 1] = tmp.g;
    colours[i * 3 + 2] = tmp.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colours, 3));
  geo.computeVertexNormals();
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
  const ground = new THREE.Mesh(geo, mat);
  ground.name = 'island-ground';
  scene.add(ground);
}

function buildSea(scene) {
  const geo = new THREE.CircleGeometry(5200, 48);
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.MeshPhongMaterial({
    color: PALETTE.sea,
    shininess: 90,
    specular: 0x99ccdd,
    transparent: true,
    opacity: 0.96,
  });
  const sea = new THREE.Mesh(geo, mat);
  sea.position.y = WORLD.seaLevel;
  sea.name = 'sea';
  scene.add(sea);
  // Shallow turquoise band hugging the coast: where the island's slope
  // sinks below it the band hides under the terrain, so it reads as a
  // lagoon fringe instead of a flat blue disc.
  const shallow = new THREE.Mesh(
    new THREE.RingGeometry(880, 1320, 64),
    new THREE.MeshBasicMaterial({ color: PALETTE.seaShallow, transparent: true, opacity: 0.5, side: THREE.DoubleSide }),
  );
  shallow.rotation.x = -Math.PI / 2;
  shallow.position.y = WORLD.seaLevel + 0.4;
  shallow.name = 'sea-shallow';
  scene.add(shallow);
}

function runwayMaterial(surface) {
  const colour = surface === 'sand'
    ? PALETTE.runwaySand
    : surface === 'dirt'
      ? PALETTE.runwayDirt
      : PALETTE.runwayGrass;
  return new THREE.MeshLambertMaterial({ color: colour });
}

function buildRunways(scene) {
  const windsocks = [];
  const white = new THREE.MeshLambertMaterial({ color: '#f2f2e8' });
  for (const rw of RUNWAYS) {
    const group = new THREE.Group();
    group.name = `runway-${rw.id}`;
    const strip = new THREE.Mesh(
      new THREE.PlaneGeometry(rw.length, rw.width),
      runwayMaterial(rw.surface),
    );
    strip.rotation.x = -Math.PI / 2;
    strip.position.y = rw.elevation + 0.35;
    group.add(strip);
    // Threshold bars and centreline dashes, so a runway reads at a glance.
    for (const end of [-1, 1]) {
      for (let b = -2; b <= 2; b += 1) {
        const bar = new THREE.Mesh(new THREE.PlaneGeometry(14, 3), white);
        bar.rotation.x = -Math.PI / 2;
        bar.position.set(end * (rw.length / 2 - 14), rw.elevation + 0.45, b * 6);
        group.add(bar);
      }
    }
    for (let d = -rw.length / 2 + 40; d < rw.length / 2 - 30; d += 34) {
      const dash = new THREE.Mesh(new THREE.PlaneGeometry(16, 2.4), white);
      dash.rotation.x = -Math.PI / 2;
      dash.position.set(d, rw.elevation + 0.45, 0);
      group.add(dash);
    }
    // Windsock on a pole beside the threshold.
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.5, 0.7, 16, 6),
      new THREE.MeshLambertMaterial({ color: '#dddddd' }),
    );
    pole.position.set(-rw.length / 2 + 8, rw.elevation + 8, rw.width / 2 + 12);
    group.add(pole);
    const sock = new THREE.Mesh(
      new THREE.ConeGeometry(2.2, 9, 8),
      new THREE.MeshLambertMaterial({ color: '#ff6a00' }),
    );
    sock.rotation.z = Math.PI / 2;
    sock.position.set(-rw.length / 2 + 12, rw.elevation + 15, rw.width / 2 + 12);
    group.add(sock);
    windsocks.push(sock);
    group.position.set(rw.x, 0, rw.z);
    // Strip length axis is local x; rotate it onto (sin h, cos h).
    group.rotation.y = ((rw.heading - 90) * Math.PI) / 180;
    scene.add(group);
  }
  return windsocks;
}

function buildTrees(scene, rng) {
  const count = 650;
  const trunkGeo = new THREE.CylinderGeometry(0.7, 1.1, 7, 5);
  const canopyGeo = new THREE.ConeGeometry(4.4, 13, 7);
  const topGeo = new THREE.ConeGeometry(2.9, 9, 7);
  const trunkMat = new THREE.MeshLambertMaterial({ color: '#6b4a2c' });
  const canopyMat = new THREE.MeshLambertMaterial({ color: '#ffffff' });
  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, count);
  const canopies = new THREE.InstancedMesh(canopyGeo, canopyMat, count);
  const tops = new THREE.InstancedMesh(topGeo, canopyMat.clone(), count);
  const greens = ['#2f7a33', '#357f2f', '#2a6e35', '#3d8a37', '#2e7d32'];
  const tmpColor = new THREE.Color();
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const s = new THREE.Vector3();
  const p = new THREE.Vector3();
  let placed = 0;
  let guard = 0;
  while (placed < count && guard < count * 40) {
    guard += 1;
    const x = rng.range(-1150, 1150);
    const z = rng.range(-1150, 1150);
    const h = heightAt(x, z);
    if (h < 5 || h > WORLD.treeLine) continue;
    // Keep trees off the runways and out of the villages.
    let clear = true;
    for (const rw of RUNWAYS) {
      if (Math.hypot(x - rw.x, z - rw.z) < rw.length * 0.75) { clear = false; break; }
    }
    if (!clear) continue;
    const scale = rng.range(0.8, 1.7);
    p.set(x, h + 3 * scale, z);
    s.set(scale, scale, scale);
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rng.range(0, Math.PI * 2));
    m.compose(p, q, s);
    trunks.setMatrixAt(placed, m);
    p.y = h + (7 + 6) * scale;
    m.compose(p, q, s);
    canopies.setMatrixAt(placed, m);
    // Second, smaller tier on top, so a tree reads as a tree, not a cone.
    p.y = h + (7 + 13 + 3.5) * scale;
    m.compose(p, q, s);
    tops.setMatrixAt(placed, m);
    tmpColor.set(greens[Math.floor(rng.range(0, greens.length))]);
    canopies.setColorAt(placed, tmpColor);
    tops.setColorAt(placed, tmpColor);
    placed += 1;
  }
  trunks.count = placed;
  canopies.count = placed;
  tops.count = placed;
  trunks.instanceMatrix.needsUpdate = true;
  canopies.instanceMatrix.needsUpdate = true;
  tops.instanceMatrix.needsUpdate = true;
  if (canopies.instanceColor) canopies.instanceColor.needsUpdate = true;
  if (tops.instanceColor) tops.instanceColor.needsUpdate = true;
  scene.add(trunks);
  scene.add(canopies);
  scene.add(tops);
}

function buildVillages(scene, rng) {
  const wallMat = new THREE.MeshLambertMaterial({ color: '#f0e2c8' });
  const wallMat2 = new THREE.MeshLambertMaterial({ color: '#e8b48a' });
  const roofMat = new THREE.MeshLambertMaterial({ color: '#b8452c' });
  const roofMat2 = new THREE.MeshLambertMaterial({ color: '#3f6d8e' });
  const spots = [
    { x: 240, z: 640, n: 14 },
    { x: 700, z: 260, n: 10 },
    { x: -40, z: -560, n: 12 },
  ];
  for (const spot of spots) {
    for (let i = 0; i < spot.n; i += 1) {
      const x = spot.x + rng.range(-90, 90);
      const z = spot.z + rng.range(-70, 70);
      const h = heightAt(x, z);
      if (h < 4) continue;
      const g = new THREE.Group();
      const w = rng.range(7, 12);
      const d = rng.range(7, 11);
      const walls = new THREE.Mesh(new THREE.BoxGeometry(w, 5, d), rng.chance(0.5) ? wallMat : wallMat2);
      walls.position.y = 2.5;
      const roof = new THREE.Mesh(new THREE.ConeGeometry(Math.max(w, d) * 0.75, 4, 4), rng.chance(0.5) ? roofMat : roofMat2);
      roof.position.y = 7;
      roof.rotation.y = Math.PI / 4;
      g.add(walls);
      g.add(roof);
      g.position.set(x, h, z);
      g.rotation.y = rng.range(0, Math.PI * 2);
      scene.add(g);
    }
  }
}

function smokeTexture() {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 4, 64, 64, 62);
  grad.addColorStop(0, 'rgba(205,205,200,0.9)');
  grad.addColorStop(0.6, 'rgba(185,185,180,0.5)');
  grad.addColorStop(1, 'rgba(180,180,175,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

function buildSmoke(scene) {
  // A lazy grey plume over the crater: the volcano's landmark, static so
  // a screenshot is reproducible.
  const v = WORLD.volcano;
  const tex = smokeTexture();
  const rng = makeRng(SEED + 913);
  const topY = v.height + 26;
  for (let i = 0; i < 7; i += 1) {
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, opacity: 0.65 - i * 0.05, depthWrite: false });
    const sprite = new THREE.Sprite(mat);
    const sc = 95 + i * 42;
    sprite.scale.set(sc, sc * 0.75, 1);
    sprite.position.set(
      v.x + rng.range(-24, 24) + i * 14,
      topY + i * 26,
      v.z + rng.range(-18, 18) - i * 6,
    );
    scene.add(sprite);
  }
}

export function createWorld(scene) {
  const rng = makeRng(SEED);
  buildGround(scene);
  buildSea(scene);
  const windsocks = buildRunways(scene);
  buildTrees(scene, rng);
  buildVillages(scene, rng);
  buildSmoke(scene);
  return {
    heightAt,
    update(dt, time) {
      // Windsock flutter: the only thing on the ground that moves.
      for (const sock of windsocks) {
        sock.rotation.y = Math.sin(time * 1.7) * 0.35;
      }
      void dt;
    },
  };
}
