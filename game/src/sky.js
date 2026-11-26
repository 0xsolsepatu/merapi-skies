// Sky, sun and clouds for Merapi Skies. The dome is a canvas gradient so
// the horizon always matches the fog, and the clouds are soft sprites that
// drift slowly — frozen in screenshot mode so a shot is reproducible.
import { THREE } from './three.js';
import { PALETTE } from './config.js';
import { makeRng } from './random.js';

function skyTexture() {
  const c = document.createElement('canvas');
  c.width = 4;
  c.height = 256;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, PALETTE.skyTop);
  grad.addColorStop(0.55, '#7fb8e6');
  grad.addColorStop(0.78, PALETTE.skyHorizon);
  grad.addColorStop(1, '#e8f2f6');
  g.fillStyle = grad;
  g.fillRect(0, 0, 4, 256);
  const tex = new THREE.CanvasTexture(c);
  return tex;
}

function cloudTexture() {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 128;
  const g = c.getContext('2d');
  for (const [x, y, r, a] of [
    [70, 80, 46, 0.85], [120, 66, 56, 0.9], [175, 82, 48, 0.85],
    [100, 92, 50, 0.7], [150, 96, 44, 0.7], [200, 95, 34, 0.6],
  ]) {
    const grad = g.createRadialGradient(x, y, 4, x, y, r);
    grad.addColorStop(0, `rgba(255,255,255,${a})`);
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 256, 128);
  }
  return new THREE.CanvasTexture(c);
}

export function createSky(scene) {
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(4200, 24, 16),
    new THREE.MeshBasicMaterial({ map: skyTexture(), side: THREE.BackSide, fog: false }),
  );
  dome.name = 'sky-dome';
  scene.add(dome);

  // Low sun in the west, warm and big enough to read in a screenshot.
  const sun = new THREE.Mesh(
    new THREE.CircleGeometry(90, 32),
    new THREE.MeshBasicMaterial({ color: '#fff3c4', fog: false }),
  );
  sun.position.set(-2600, 620, -1900);
  sun.lookAt(0, 0, 0);
  scene.add(sun);
  const glow = new THREE.Mesh(
    new THREE.CircleGeometry(190, 32),
    new THREE.MeshBasicMaterial({ color: '#ffe9a8', transparent: true, opacity: 0.35, fog: false }),
  );
  glow.position.copy(sun.position).multiplyScalar(1.001);
  glow.lookAt(0, 0, 0);
  scene.add(glow);

  const tex = cloudTexture();
  const clouds = [];
  const rng = makeRng(99);
  for (let i = 0; i < 42; i += 1) {
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, opacity: rng.range(0.55, 0.9), depthWrite: false });
    const sprite = new THREE.Sprite(mat);
    const scale = rng.range(180, 420);
    sprite.scale.set(scale, scale * 0.45, 1);
    sprite.position.set(rng.range(-2600, 2600), rng.range(230, 420), rng.range(-2600, 2600));
    sprite.userData.drift = rng.range(1.5, 4);
    scene.add(sprite);
    clouds.push(sprite);
  }

  return {
    update(dt, frozen) {
      if (frozen) return;
      for (const cloud of clouds) {
        cloud.position.x += cloud.userData.drift * dt;
        if (cloud.position.x > 2800) cloud.position.x = -2800;
      }
    },
  };
}
