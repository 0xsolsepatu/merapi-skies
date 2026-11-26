// Tiny adapter: three.js r128 ships as a classic UMD script that puts its
// API on window.THREE. Every game module imports THREE from here so the
// engine stays one explicit dependency instead of a bare global.
export const THREE = window.THREE;
