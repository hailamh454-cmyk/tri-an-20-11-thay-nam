/**
 * physicsEngine.js
 * Adaptive 4th-Order Runge-Kutta (RK4) Numerical Integrator
 * Handles Ballistics (Uniform Gravity + Drag), Kepler Orbital Dynamics,
 * and Schwarzschild Relativistic Gravity for Black Holes.
 */

export class PhysicsEngine {
  constructor() {
    this.g = 9.81; // Base gravitational acceleration
    this.scale = 16; // Canvas pixels per meter
    this.c = 120; // Relativistic speed of light scale for simulation
  }

  /**
   * Classical 4th-Order Runge-Kutta (RK4) step for a 2D particle.
   * State: [x, y, vx, vy]
   * accelFunc: (x, y, vx, vy) => [ax, ay]
   */
  rk4Step(state, dt, accelFunc) {
    const [x, y, vx, vy] = state;

    // k1
    const [ax1, ay1] = accelFunc(x, y, vx, vy);
    const k1 = [vx, vy, ax1, ay1];

    // k2
    const x2 = x + 0.5 * dt * k1[0];
    const y2 = y + 0.5 * dt * k1[1];
    const vx2 = vx + 0.5 * dt * k1[2];
    const vy2 = vy + 0.5 * dt * k1[3];
    const [ax2, ay2] = accelFunc(x2, y2, vx2, vy2);
    const k2 = [vx2, vy2, ax2, ay2];

    // k3
    const x3 = x + 0.5 * dt * k2[0];
    const y3 = y + 0.5 * dt * k2[1];
    const vx3 = vx + 0.5 * dt * k2[2];
    const vy3 = vy + 0.5 * dt * k2[3];
    const [ax3, ay3] = accelFunc(x3, y3, vx3, vy3);
    const k3 = [vx3, vy3, ax3, ay3];

    // k4
    const x4 = x + dt * k3[0];
    const y4 = y + dt * k3[1];
    const vx4 = vx + dt * k3[2];
    const vy4 = vy + dt * k3[3];
    const [ax4, ay4] = accelFunc(x4, y4, vx4, vy4);
    const k4 = [vx4, vy4, ax4, ay4];

    // Combine RK4 increments
    const newX = x + (dt / 6) * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]);
    const newY = y + (dt / 6) * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1]);
    const newVx = vx + (dt / 6) * (k1[2] + 2 * k2[2] + 2 * k3[2] + k4[2]);
    const newVy = vy + (dt / 6) * (k1[3] + 2 * k2[3] + 2 * k3[3] + k4[3]);

    return [newX, newY, newVx, newVy];
  }

  /* ==========================================================================
     LEVEL CONFIGURATIONS & ACCELERATION FUNCTIONS
     ========================================================================== */

  /**
   * Level 1: Classical Ballistics
   * Uniform downward gravity + slight air drag.
   * Note: in Canvas coordinates, downwards is +y.
   */
  getBallisticsAcceleration(x, y, vx, vy) {
    const gCanvas = this.g * this.scale;
    const dragCoeff = 0.0008; // subtle air drag
    const vMag = Math.hypot(vx, vy);

    const ax = -dragCoeff * vMag * vx;
    const ay = gCanvas - dragCoeff * vMag * vy;
    return [ax, ay];
  }

  /**
   * Calculates Level 1 theoretical physics telemetry for UI display.
   */
  calculateBallisticsTelemetry(angleDeg, v0) {
    const alphaRad = (angleDeg * Math.PI) / 180;
    const g = this.g;

    // Range R = (v0^2 * sin(2*alpha)) / g
    const range = (Math.pow(v0, 2) * Math.sin(2 * alphaRad)) / g;
    // Max height H = (v0^2 * sin^2(alpha)) / (2*g)
    const height = (Math.pow(v0 * Math.sin(alphaRad), 2)) / (2 * g);
    // Initial radius of curvature at apex: rho = (v0 * cos(alpha))^2 / g
    const vApex = v0 * Math.cos(alphaRad);
    const rho = Math.pow(vApex, 2) / g;

    return {
      range: range.toFixed(1),
      height: height.toFixed(1),
      rho: rho.toFixed(1)
    };
  }

  /**
   * Level 2: Kepler Central Gravity Field (Gravity Assist / Slingshot).
   * a = - (G*M / r^3) * r
   */
  getKeplerAcceleration(x, y, vx, vy, planet) {
    const dx = x - planet.x;
    const dy = y - planet.y;
    const r = Math.hypot(dx, dy);

    // Softening parameter to prevent numerical singularities at r -> 0
    const eps = 12;
    const rEff = Math.max(r, eps);

    const gm = planet.gm || 120000;
    const aMag = gm / Math.pow(rEff, 3);

    const ax = -aMag * dx;
    const ay = -aMag * dy;
    return [ax, ay];
  }

  /**
   * Level 3: Relativistic Schwarzschild Black Hole.
   * a = - (G*M / r^3) * r - (3 * G*M * h^2) / (c^2 * r^5) * r
   * where h = |r x v| = angular momentum per unit mass.
   */
  getSchwarzschildAcceleration(x, y, vx, vy, blackHole) {
    const dx = x - blackHole.x;
    const dy = y - blackHole.y;
    const r = Math.hypot(dx, dy);

    const rs = blackHole.rs || 32;
    const eps = rs * 0.4;
    const rEff = Math.max(r, eps);

    const gm = blackHole.gm || 160000;
    const c2 = Math.pow(this.c, 2);

    // Specific angular momentum h = |dx*vy - dy*vx|
    const h = Math.abs(dx * vy - dy * vx);

    // Newtonian component: - (GM / r^3) * r
    const newtonian = gm / Math.pow(rEff, 3);

    // Relativistic correction: - (3 * GM * h^2) / (c^2 * r^5) * r
    const relativistic = (3 * gm * Math.pow(h, 2)) / (c2 * Math.pow(rEff, 5));

    const totalFactor = newtonian + relativistic;
    const ax = -totalFactor * dx;
    const ay = -totalFactor * dy;

    return [ax, ay];
  }
}
