/**
 * tests/test_rk4_solver.mjs
 * Unit test for js/physics/rk4Solver.js
 */

import { RK4Solver, rk4Solver } from '../js/physics/rk4Solver.js';

console.log('--- Testing RK4Solver ---');

// 1. Basic RK4 step test with simple harmonic oscillator: d^2x/dt^2 = -x (omega = 1)
// Analytic solution: x(t) = cos(t), v(t) = -sin(t) with x(0) = 1, v(0) = 0.
const solver = new RK4Solver();
let state = [1.0, 0.0, 0.0, 0.0]; // x = 1, y = 0, vx = 0, vy = 0
const dt = 0.01;
const totalSteps = 100; // t = 1.0s

for (let i = 0; i < totalSteps; i++) {
  state = solver.step(state, dt, (x, y, vx, vy) => [-x, 0]);
}

const expectedX = Math.cos(1.0);
const expectedVx = -Math.sin(1.0);
console.log(`Harmonic Oscillator at t=1.0s: x = ${state[0].toFixed(6)} (expected ${expectedX.toFixed(6)})`);
console.log(`Harmonic Oscillator at t=1.0s: vx = ${state[2].toFixed(6)} (expected ${expectedVx.toFixed(6)})`);

if (Math.abs(state[0] - expectedX) > 1e-4 || Math.abs(state[2] - expectedVx) > 1e-4) {
  throw new Error('RK4 harmonic oscillator precision test failed');
}
console.log('✓ Generic RK4 precision verified');

// 2. Level 1: Classical Ballistics with Quadratic Drag
const telem = solver.calculateBallisticsTelemetry(45, 30);
console.log('Level 1 Telemetry (alpha=45°, v0=30m/s):', telem);
if (parseFloat(telem.range) < 80 || parseFloat(telem.height) < 20) {
  throw new Error('Level 1 telemetry calculation failed');
}

// Integrate Level 1 trajectory
const lvl1Trajectory = solver.predictTrajectory([180, 880, 500, -500], 1, {
  bounds: { width: 2048, height: 1086 },
  target: { x: 1820, y: 720, radius: 50 }
}, 150, 0.02);

console.log(`Level 1 trajectory points: ${lvl1Trajectory.length}, last point:`, lvl1Trajectory[lvl1Trajectory.length - 1]);
if (lvl1Trajectory.length < 10) {
  throw new Error('Level 1 trajectory prediction failed');
}
console.log('✓ Level 1 Ballistics & Drag verified');

// 3. Level 2: Kepler Gravity Assist (Slingshot)
const planet = { x: 1000, y: 300, radius: 60, gm: 850000 };
const keplerAcc = solver.getKeplerAcceleration(1000, 100, 0, 0, planet);
console.log('Level 2 Kepler Acceleration at (1000, 100):', keplerAcc);
if (Math.abs(keplerAcc[0]) > 1e-6 || keplerAcc[1] <= 0) {
  // At (1000, 100), dy = -200, so ay should be positive (pulling towards +y where planet is)
  throw new Error('Level 2 Kepler gravity direction invalid');
}

const keplerMetrics = solver.calculateKeplerMetrics([1000, 150, 200, 0], planet);
console.log('Level 2 Kepler Metrics:', keplerMetrics);
if (keplerMetrics.proximity <= 0 || keplerMetrics.proximity > 1.0) {
  throw new Error('Level 2 proximity factor out of bounds');
}
console.log('✓ Level 2 Kepler Slingshot verified');

// 4. Level 3: Relativistic Schwarzschild Black Hole
const blackHole = { x: 1200, y: 540, gm: 980000, rs: 64, c: 175 };
const bhStateInside = [1200 + 40, 540, 0, 0];
const bhStateOutside = [1200 + 150, 540, 0, 0];

if (!solver.isEventHorizonCrossed(bhStateInside, blackHole)) {
  throw new Error('Failed to detect Event Horizon crossing inside rs');
}
if (solver.isEventHorizonCrossed(bhStateOutside, blackHole)) {
  throw new Error('Incorrectly detected Event Horizon crossing outside rs');
}

const bhMetrics = solver.calculateSchwarzschildMetrics(bhStateOutside, blackHole);
console.log('Level 3 Schwarzschild Metrics outside horizon:', bhMetrics);
if (parseFloat(bhMetrics.rs) !== 64 || parseFloat(bhMetrics.rPhoton) <= 64) {
  throw new Error('Level 3 Schwarzschild metrics invalid');
}

// Predict trajectory spiraling into black hole
const bhTrajectory = solver.predictTrajectory([180, 880, 580, -250], 3, {
  bounds: { width: 2048, height: 1086 },
  blackHole
}, 200, 0.015);

console.log(`Level 3 trajectory points: ${bhTrajectory.length}, last event:`, bhTrajectory[bhTrajectory.length - 1].event);
console.log('✓ Level 3 Relativistic Schwarzschild verified');

console.log('\n ALL RK4 SOLVER TESTS PASSED CLEANLY! ');
