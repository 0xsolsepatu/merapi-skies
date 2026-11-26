// Keyboard + mouse for Merapi Skies. Arrows and WASD fly the plane, the
// mouse is a virtual stick (move to bank, wheel for throttle), and every
// one-shot key (flaps, drop, pause, camera, restart, mute) is an edge:
// the game consumes it once instead of reading a held key.
export function createInput(canvas) {
  const keys = new Set();
  const edges = new Set();
  let mouseX = 0; // -1..1 from centre
  let mouseY = 0;
  let mouseActive = false;
  let lastMouseMove = 0;
  let wheelThrottle = null;

  const EDGE_KEYS = new Set(['KeyF', 'Space', 'KeyC', 'KeyP', 'KeyR', 'KeyM', 'Digit1', 'Digit2', 'Digit3', 'Digit4', 'Enter']);

  function onKeyDown(e) {
    if (e.repeat) return;
    keys.add(e.code);
    if (EDGE_KEYS.has(e.code)) edges.add(e.code);
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
      e.preventDefault();
    }
  }

  function onKeyUp(e) {
    keys.delete(e.code);
  }

  function onMouseMove(e) {
    const rect = canvas.getBoundingClientRect();
    mouseX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    mouseY = ((e.clientY - rect.top) / rect.height) * 2 - 1;
    mouseActive = true;
    lastMouseMove = performance.now();
  }

  function onWheel(e) {
    e.preventDefault();
    wheelThrottle = (wheelThrottle ?? 0) + (e.deltaY < 0 ? 0.06 : -0.06);
  }

  function onPointerDown(e) {
    if (e.target === canvas) edges.add('PointerDrop');
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  canvas.addEventListener('mousemove', onMouseMove);
  canvas.addEventListener('wheel', onWheel, { passive: false });
  canvas.addEventListener('pointerdown', onPointerDown);

  function axis(neg, pos) {
    return (keys.has(pos) ? 1 : 0) - (keys.has(neg) ? 1 : 0);
  }

  function getInput() {
    // Keyboard wins when a key is held; the mouse stick fills the rest.
    let pitch = axis('ArrowDown', 'ArrowUp');
    let roll = axis('ArrowLeft', 'ArrowRight');
    const mouseFresh = mouseActive && performance.now() - lastMouseMove < 4000;
    if (pitch === 0 && mouseFresh) pitch = -mouseY * 0.85;
    if (roll === 0 && mouseFresh) roll = mouseX * 0.9;
    const throttleSet = wheelThrottle;
    wheelThrottle = null;
    return {
      pitch: Math.max(-1, Math.min(1, pitch)),
      roll: Math.max(-1, Math.min(1, roll)),
      throttleUp: keys.has('KeyW'),
      throttleDown: keys.has('KeyS'),
      throttleSet,
      brake: keys.has('KeyB'),
      flapsToggle: edges.has('KeyF'),
      drop: edges.has('Space') || edges.has('PointerDrop'),
      cameraToggle: edges.has('KeyC'),
      pauseToggle: edges.has('KeyP'),
      restart: edges.has('KeyR'),
      muteToggle: edges.has('KeyM'),
      start: edges.has('Enter') || edges.has('Space'),
      missionKey: ['Digit1', 'Digit2', 'Digit3', 'Digit4'].find((k) => edges.has(k)) || null,
    };
  }

  function consumeEdges() {
    edges.clear();
  }

  function resetMouse() {
    mouseActive = false;
    mouseX = 0;
    mouseY = 0;
  }

  return { getInput, consumeEdges, resetMouse };
}
