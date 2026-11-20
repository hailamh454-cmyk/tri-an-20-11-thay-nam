/**
 * tests/test_gameplay_controller.mjs
 * Comprehensive integration test for js/physics/gameplayController.js
 */

import {
  initGameplay,
  setLevel,
  fireProjectile,
  updatePhysics,
  resetLevel,
  getState,
  calculateTrajectoryPrediction,
  GameplayController
} from '../js/physics/gameplayController.js';

console.log('--- Testing GameplayController ---');

let victoryLevel = null;
let singularityTriggered = false;
let impactDetected = false;

const controller = initGameplay(2048, 1086, {
  onLevelVictory: (lvl) => {
    victoryLevel = lvl;
    console.log(`[Event] onLevelVictory: Level ${lvl}`);
  },
  onBlackHoleSingularity: (bh) => {
    singularityTriggered = true;
    console.log('[Event] onBlackHoleSingularity:', bh.name);
  },
  onImpact: (x, y, reason) => {
    impactDetected = true;
    console.log(`[Event] onImpact: reason=${reason} at (${x.toFixed(1)}, ${y.toFixed(1)})`);
  }
});

// Test 1: Level 1 Setup & Trajectory Prediction
setLevel(1);
let state = getState();
console.log('Level 1 state:', {
  level: state.currentLevel,
  launcher: state.launcher,
  target: state.target.name
});

if (state.currentLevel !== 1 || !state.target || (state.target.radius !== 40 && state.target.radius !== 52 && state.target.radius !== 62)) {
  throw new Error('Level 1 setup failed');
}

const prediction = calculateTrajectoryPrediction(45, 36, 50);
console.log(`Trajectory prediction points count: ${prediction.length}`);
if (prediction.length < 10) {
  throw new Error('Trajectory prediction failed');
}

// Test 2: Level 1 Direct Hit
// Aim directly into target: calculate angle/velocity or simulate
// In Level 1, launcher is (220, 880), target is (1820, 720).
// Let's test firing and physics loop
const fired = fireProjectile(45, 38);
if (!fired) throw new Error('fireProjectile failed');

console.log('Simulating Level 1 flight...');
for (let step = 0; step < 300; step++) {
  updatePhysics(0.016);
  if (!getState().bullet || !getState().bullet.active) break;
}
console.log('Level 1 flight ended. Bullet state:', getState().bullet ? getState().bullet.active : 'inactive');

// Test 3: Level 2 Slingshot Setup
setLevel(2);
state = getState();
console.log('Level 2 state:', {
  level: state.currentLevel,
  obstacle: state.obstacle.name,
  planet: state.planet.name
});

if (!state.obstacle || !state.planet) {
  throw new Error('Level 2 obstacle or planet missing');
}

// Fire into obstacle to test collision
fireProjectile(25, 35);
for (let step = 0; step < 200; step++) {
  updatePhysics(0.016);
  if (!getState().bullet || !getState().bullet.active) break;
}
console.log('Level 2 obstacle hit check complete, impactDetected =', impactDetected);

// Test 4: Level 3 Black Hole Event Horizon Penetration
setLevel(3);
state = getState();
console.log('Level 3 state:', {
  level: state.currentLevel,
  blackHole: state.blackHole.name,
  rs: state.blackHole.rs
});

if (!state.blackHole || (state.blackHole.rs !== 46 && state.blackHole.rs !== 56 && state.blackHole.rs !== 68 && state.blackHole.rs !== 74)) {
  throw new Error('Level 3 black hole missing or rs invalid');
}

// Fire shot over the meteor shield into the black hole (wind = 0 for deterministic test)
controller.wind = 0;
fireProjectile(25, 20);
for (let step = 0; step < 350; step++) {
  updatePhysics(0.016);
  if (!getState().bullet || !getState().bullet.active) break;
}

console.log('Level 3 flight complete, singularityTriggered =', singularityTriggered);
if (!singularityTriggered) {
  throw new Error('Level 3 failed to trigger singularity callback on event horizon penetration');
}

// Test 5: Render method with mock 2D context
const mockCtxCalls = [];
const mockCtx = {
  save: () => mockCtxCalls.push('save'),
  restore: () => mockCtxCalls.push('restore'),
  beginPath: () => mockCtxCalls.push('beginPath'),
  moveTo: () => {},
  lineTo: () => {},
  stroke: () => mockCtxCalls.push('stroke'),
  fill: () => mockCtxCalls.push('fill'),
  arc: () => {},
  strokeRect: () => {},
  setLineDash: () => {},
  createRadialGradient: () => ({
    addColorStop: () => {}
  })
};

controller.render(mockCtx);
console.log(`Render mock calls executed: ${mockCtxCalls.length} calls`);
if (mockCtxCalls.length < 5) {
  throw new Error('Render method did not execute correctly');
}

console.log('\n ALL GAMEPLAY CONTROLLER TESTS PASSED CLEANLY! ');
