/**
 * js/physics/rk4Solver.js
 * 
 * High-Precision 4th-Order Runge-Kutta (RK4) Numerical Integrator
 * for 2011 Thầy Nam Physics Interactive Tribute.
 * 
 * Features:
 * 1. General RK4 2D state-space numerical integrator with adaptive sub-stepping.
 * 2. Level 1: Classical Ballistics with Quadratic Air Drag (ddot{r} = g - 1/2m * Cd * rho * A * |v| * v).
 * 3. Level 2: Kepler Celestial Mechanics & Gravitational Slingshot (ddot{r} = - GM/r^3 * r).
 * 4. Level 3: Relativistic Schwarzschild Black Hole Curvature with adaptive time-stepping
 *    (ddot{r} = - GM/r^3 * r - 3GM*h^2/(c^2 * r^5) * r).
 * 5. Trajectory predictor and analytical physics telemetry (Range, Max Height, Curvature Radius).
 * 
 * Complies with Google Antigravity Architecture & Physics Standards.
 */

export class RK4Solver {
  constructor(options = {}) {
    // Gravitational acceleration (m/s^2)
    this.g = options.g || 9.81;

    // Simulation scale: Canvas pixels per meter (default 24 px/m for 2048x1086 canvas)
    this.scale = options.scale || 24.0;

    // Relativistic speed of light scale for visual simulation
    this.c = options.c || 180.0;

    // Quadratic air drag coefficient for chalk projectile in Level 1
    // a_drag = -kDrag * |v| * v
    this.kDrag = options.kDrag || 0.00045;

    // Horizontal wind in range [-4.5, +4.5]. Positive = right (+x), Negative = left (-x)
    this.wind = options.wind !== undefined ? options.wind : 0;

    // Calibrated horizontal wind acceleration coefficient: 7.5 px/s^2 per wind unit
    // At alpha ~ 70 deg and range ~ 1500 px, 1.0 wind shifts landing point by ~114 px (~ 2 deg angle equivalent: 0.5 wind = 1 angle)
    this.kWind = options.kWind || 7.5;
  }

  /**
   * Classical 4th-Order Runge-Kutta (RK4) single numerical step.
   * State: [x, y, vx, vy]
   * accelFunc: (x, y, vx, vy, t) => [ax, ay]
   * 
   * @param {number[]} state [x, y, vx, vy]
   * @param {number} dt Time step in seconds
   * @param {Function} accelFunc Acceleration generator (x, y, vx, vy, t) => [ax, ay]
   * @param {number} t Current simulation time
   * @returns {number[]} Next state [x, y, vx, vy]
   */
  step(state, dt, accelFunc, t = 0) {
    const [x, y, vx, vy] = state;

    // k1 = f(t, y)
    const [ax1, ay1] = accelFunc(x, y, vx, vy, t);
    const k1 = [vx, vy, ax1, ay1];

    // k2 = f(t + dt/2, y + dt/2 * k1)
    const halfDt = 0.5 * dt;
    const x2 = x + halfDt * k1[0];
    const y2 = y + halfDt * k1[1];
    const vx2 = vx + halfDt * k1[2];
    const vy2 = vy + halfDt * k1[3];
    const [ax2, ay2] = accelFunc(x2, y2, vx2, vy2, t + halfDt);
    const k2 = [vx2, vy2, ax2, ay2];

    // k3 = f(t + dt/2, y + dt/2 * k2)
    const x3 = x + halfDt * k2[0];
    const y3 = y + halfDt * k2[1];
    const vx3 = vx + halfDt * k2[2];
    const vy3 = vy + halfDt * k2[3];
    const [ax3, ay3] = accelFunc(x3, y3, vx3, vy3, t + halfDt);
    const k3 = [vx3, vy3, ax3, ay3];

    // k4 = f(t + dt, y + dt * k3)
    const x4 = x + dt * k3[0];
    const y4 = y + dt * k3[1];
    const vx4 = vx + dt * k3[2];
    const vy4 = vy + dt * k3[3];
    const [ax4, ay4] = accelFunc(x4, y4, vx4, vy4, t + dt);
    const k4 = [vx4, vy4, ax4, ay4];

    // Combine RK4 increments: y_{n+1} = y_n + dt/6 * (k1 + 2*k2 + 2*k3 + k4)
    const dt6 = dt / 6.0;
    const nextX = x + dt6 * (k1[0] + 2.0 * k2[0] + 2.0 * k3[0] + k4[0]);
    const nextY = y + dt6 * (k1[1] + 2.0 * k2[1] + 2.0 * k3[1] + k4[1]);
    const nextVx = vx + dt6 * (k1[2] + 2.0 * k2[2] + 2.0 * k3[2] + k4[2]);
    const nextVy = vy + dt6 * (k1[3] + 2.0 * k2[3] + 2.0 * k3[3] + k4[3]);

    return [nextX, nextY, nextVx, nextVy];
  }

  /**
   * Adaptive sub-stepping RK4 integration for extreme precision under steep gradients.
   * Automatically calculates required sub-steps based on distance to celestial bodies or black hole.
   * 
   * @param {number[]} state [x, y, vx, vy]
   * @param {number} dt Total frame delta time
   * @param {Function} accelFunc
   * @param {number} minSubSteps Minimum sub-steps (default 4)
   * @param {number} maxSubSteps Maximum sub-steps (default 24)
   * @returns {number[]} Next integrated state
   */
  adaptiveStep(state, dt, accelFunc, minSubSteps = 4, maxSubSteps = 24) {
    let currentState = [...state];
    let subSteps = minSubSteps;

    // Check initial acceleration magnitude to scale sub-steps
    const [ax, ay] = accelFunc(state[0], state[1], state[2], state[3], 0);
    const aMag = Math.hypot(ax, ay);

    if (aMag > 2500) {
      subSteps = maxSubSteps;
    } else if (aMag > 800) {
      subSteps = Math.min(maxSubSteps, Math.max(minSubSteps, Math.floor(minSubSteps * 2.5)));
    }

    const subDt = dt / subSteps;
    for (let i = 0; i < subSteps; i++) {
      currentState = this.step(currentState, subDt, accelFunc, i * subDt);
    }
    return currentState;
  }

  // =========================================================================
  // LEVEL 1: CLASSICAL BALLISTICS WITH QUADRATIC AIR DRAG
  // =========================================================================

  /**
   * Acceleration function for Level 1 Ballistics.
   * ddot{r} = g - (1/2m * Cd * rho * A) * |v| * v
   * Note: in screen canvas coordinates, +y is downward, so gravity accelerates in +y.
   * 
   * @param {number} x
   * @param {number} y
   * @param {number} vx Velocity X in px/s
   * @param {number} vy Velocity Y in px/s
   * @param {Object} [customParams] Optional override for gCanvas or kDrag
   * @returns {[number, number]} [ax, ay] in px/s^2
   */
  getBallisticsAcceleration(x, y, vx, vy, customParams = {}) {
    const gCanvas = customParams.gCanvas !== undefined
      ? customParams.gCanvas
      : this.g * this.scale;
    const kDrag = customParams.kDrag !== undefined
      ? customParams.kDrag
      : this.kDrag;
    const wind = customParams.wind !== undefined
      ? customParams.wind
      : this.wind;

    const vMag = Math.hypot(vx, vy);

    // Quadratic air drag opposes velocity vector: -k * |v| * v
    const dragAx = -kDrag * vMag * vx;
    const dragAy = -kDrag * vMag * vy;

    // Horizontal acceleration includes air drag + calibrated wind push (0.5 wind = 1 deg rule)
    const windAx = wind * this.kWind;
    const ax = dragAx + windAx;
    const ay = gCanvas + dragAy;

    return [ax, ay];
  }

  /**
   * Calculates Level 1 theoretical physics telemetry for diegetic UI readouts.
   * Provides:
   * - Range R (m)
   * - Max Height H (m)
   * - Apex Radius of Curvature rho (m)
   * - Time of Flight T (s)
   * 
   * @param {number} angleDeg Launch angle in degrees [15 - 85]
   * @param {number} v0 Launch speed in m/s
   * @param {number} [gVal] Gravitational constant (default 9.81)
   * @returns {Object} { range, height, rho, timeOfFlight }
   */
  calculateBallisticsTelemetry(angleDeg, v0, gVal = this.g) {
    const alphaRad = (angleDeg * Math.PI) / 180.0;
    const sinAlpha = Math.sin(alphaRad);
    const cosAlpha = Math.cos(alphaRad);
    const sin2Alpha = Math.sin(2.0 * alphaRad);

    // Theoretical Vacuum formulas:
    // Range: R = (v0^2 * sin(2*alpha)) / g
    const range = (v0 * v0 * sin2Alpha) / gVal;

    // Max Height: H = (v0^2 * sin^2(alpha)) / (2*g)
    const height = (v0 * v0 * sinAlpha * sinAlpha) / (2.0 * gVal);

    // Initial radius of curvature at apex: rho = (v0 * cos(alpha))^2 / g
    const vApex = v0 * cosAlpha;
    const rho = (vApex * vApex) / gVal;

    // Time of flight: T = (2 * v0 * sin(alpha)) / g
    const timeOfFlight = (2.0 * v0 * sinAlpha) / gVal;

    return {
      range: range.toFixed(1),
      height: height.toFixed(1),
      rho: rho.toFixed(1),
      timeOfFlight: timeOfFlight.toFixed(2),
      alphaRad,
      v0
    };
  }

  // =========================================================================
  // LEVEL 2: KEPLER CELESTIAL MECHANICS & GRAVITATIONAL SLINGSHOT
  // =========================================================================

  /**
   * Acceleration function for Level 2 Kepler Gravitational Field.
   * ddot{r} = - (G*M / r^3) * r
   * Includes softening parameter epsilon to prevent numerical division by zero.
   * 
   * @param {number} x
   * @param {number} y
   * @param {number} vx
   * @param {number} vy
   * @param {Object} planet { x, y, radius, gm }
   * @returns {[number, number]} [ax, ay]
   */
  getKeplerAcceleration(x, y, vx, vy, planet, customParams = {}) {
    if (!planet) return [0, 0];

    const dx = x - planet.x;
    const dy = y - planet.y;
    const r = Math.hypot(dx, dy);

    // Softening parameter based on planet radius to avoid numerical divergence at core
    const eps = planet.epsilon || Math.max(14.0, (planet.radius || 40) * 0.25);
    const rEff = Math.max(r, eps);

    // Standard gravitational parameter GM (default 850,000 for 2048x1086 canvas)
    const gm = planet.gm || 850000;
    const aMag = gm / (rEff * rEff * rEff);

    let ax = -aMag * dx;
    const ay = -aMag * dy;

    // Support light wind ~35% in Kepler celestial mechanics if wind is provided
    const wind = customParams.wind !== undefined ? customParams.wind : this.wind;
    if (wind) {
      ax += wind * (this.kWind * 0.35);
    }

    return [ax, ay];
  }

  /**
   * Calculates Kepler orbital telemetry & proximity factor for audio synthesis.
   * 
   * @param {number[]} state [x, y, vx, vy]
   * @param {Object} planet
   * @returns {Object} { r, specificAngularMomentum, specificEnergy, proximity, speed }
   */
  calculateKeplerMetrics(state, planet) {
    if (!planet) return { r: Infinity, proximity: 0, speed: 0 };

    const [x, y, vx, vy] = state;
    const dx = x - planet.x;
    const dy = y - planet.y;
    const r = Math.hypot(dx, dy);
    const speed = Math.hypot(vx, vy);

    // Specific angular momentum: h = |r x v| = |dx * vy - dy * vx|
    const h = Math.abs(dx * vy - dy * vx);

    // Specific orbital energy: E = 1/2 * v^2 - GM / r
    const gm = planet.gm || 850000;
    const energy = 0.5 * speed * speed - gm / Math.max(r, 1);

    // Normalized proximity to planet surface [0.0 = far, 1.0 = surface]
    const surfaceDist = Math.max(0, r - (planet.radius || 50));
    const influenceRadius = (planet.radius || 50) * 3.0;
    const proximity = Math.max(0.0, Math.min(1.0, 1.0 - surfaceDist / influenceRadius));

    return {
      r: r.toFixed(1),
      h: h.toFixed(1),
      energy: energy.toFixed(0),
      proximity,
      speed: speed.toFixed(1)
    };
  }

  // =========================================================================
  // LEVEL 3: RELATIVISTIC SCHWARZSCHILD BLACK HOLE CURVATURE
  // =========================================================================

  /**
   * Acceleration function for Level 3 Relativistic Schwarzschild Black Hole.
   * ddot{r} = - (GM / r^3) * r - (3*GM * h^2) / (c^2 * r^5) * r
   * where h = |r x v| is the specific angular momentum.
   * 
   * @param {number} x
   * @param {number} y
   * @param {number} vx
   * @param {number} vy
   * @param {Object} blackHole { x, y, gm, rs, c }
   * @returns {[number, number]} [ax, ay]
   */
  getSchwarzschildAcceleration(x, y, vx, vy, blackHole, customParams = {}) {
    if (!blackHole) return [0, 0];

    const dx = x - blackHole.x;
    const dy = y - blackHole.y;
    const r = Math.hypot(dx, dy);

    // Event Horizon radius rs = 2*GM / c^2
    const c = blackHole.c || this.c;
    const gm = blackHole.gm || 980000;
    const c2 = c * c;
    const rs = blackHole.rs || (2.0 * gm) / c2;

    // Softening core to maintain finite numerical values inside the event horizon
    const eps = rs * 0.25;
    const rEff = Math.max(r, eps);

    // Specific angular momentum h = |r x v|
    const h = Math.abs(dx * vy - dy * vx);

    // Newtonian gravity factor: GM / r^3
    const newtonian = gm / (rEff * rEff * rEff);

    // General Relativistic correction factor: (3 * GM * h^2) / (c^2 * r^5)
    const r5 = rEff * rEff * rEff * rEff * rEff;
    const relativistic = (3.0 * gm * h * h) / (c2 * r5);

    const totalFactor = newtonian + relativistic;
    let ax = -totalFactor * dx;
    const ay = -totalFactor * dy;

    // Support light wind ~35% in Relativistic Schwarzschild field if wind is provided
    const wind = customParams.wind !== undefined ? customParams.wind : this.wind;
    if (wind) {
      ax += wind * (this.kWind * 0.35);
    }

    return [ax, ay];
  }

  /**
   * Checks whether the projectile state has crossed the Schwarzschild Event Horizon (r <= rs).
   * 
   * @param {number[]} state [x, y, vx, vy]
   * @param {Object} blackHole
   * @returns {boolean} True if inside event horizon
   */
  isEventHorizonCrossed(state, blackHole) {
    if (!blackHole) return false;
    const dx = state[0] - blackHole.x;
    const dy = state[1] - blackHole.y;
    const r = Math.hypot(dx, dy);
    const rs = blackHole.rs || 64;
    return r <= rs;
  }

  /**
   * Calculates Relativistic Schwarzschild metrics for diegetic UI readouts.
   * Provides:
   * - Event Horizon radius rs
   * - Photon Sphere radius r_photon = 1.5 * rs
   * - ISCO radius = 3.0 * rs
   * - Gravitational Redshift z
   * - Proximity to horizon
   * 
   * @param {number[]} state
   * @param {Object} blackHole
   * @returns {Object}
   */
  calculateSchwarzschildMetrics(state, blackHole) {
    if (!blackHole) return { r: Infinity, rs: 0, isCaptured: false, proximity: 0 };

    const [x, y, vx, vy] = state;
    const dx = x - blackHole.x;
    const dy = y - blackHole.y;
    const r = Math.hypot(dx, dy);
    const speed = Math.hypot(vx, vy);

    const c = blackHole.c || this.c;
    const gm = blackHole.gm || 980000;
    const rs = blackHole.rs || (2.0 * gm) / (c * c);
    const rPhoton = 1.5 * rs;
    const rIsco = 3.0 * rs;

    const h = Math.abs(dx * vy - dy * vx);

    // Gravitational redshift z = 1 / sqrt(1 - rs/r) - 1
    const rSafe = Math.max(r, rs * 1.01);
    const timeDilation = 1.0 / Math.sqrt(Math.max(0.001, 1.0 - rs / rSafe));
    const redshift = timeDilation - 1.0;

    // Horizon proximity [0.0 = far, 1.0 = at or inside horizon]
    const influenceRadius = rs * 5.0;
    const proximity = Math.max(0.0, Math.min(1.0, 1.0 - (r - rs) / influenceRadius));

    return {
      r: r.toFixed(1),
      rs: rs.toFixed(1),
      rPhoton: rPhoton.toFixed(1),
      rIsco: rIsco.toFixed(1),
      h: h.toFixed(1),
      speed: speed.toFixed(1),
      timeDilation: timeDilation.toFixed(2),
      redshift: redshift.toFixed(2),
      isCaptured: r <= rs,
      proximity
    };
  }

  // =========================================================================
  // TRAJECTORY PREDICTOR
  // =========================================================================

  /**
   * Predicts full projectile trajectory ahead of time using RK4 integration.
   * Used for diegetic dotted guide lines or aiming previews.
   * 
   * @param {number[]} initialState [x0, y0, vx0, vy0]
   * @param {number} level Current level (1, 2, or 3)
   * @param {Object} environmentParams { planet, blackHole, bounds, obstacle, target }
   * @param {number} maxSteps Maximum steps to predict (default 120)
   * @param {number} dt Time step per prediction sample (default 0.02s)
   * @returns {Object[]} Array of predicted points [{x, y, vx, vy, t, event}]
   */
  predictTrajectory(initialState, level, environmentParams = {}, maxSteps = 120, dt = 0.02) {
    const points = [];
    let state = [...initialState];
    const { planet, blackHole, obstacle, topObstacle, obstacles, target, bounds, wind } = environmentParams;
    const activeWind = wind !== undefined ? wind : this.wind;

    const width = bounds ? bounds.width : 2048;
    const height = bounds ? bounds.height : 1086;

    let accelFunc;
    if (level === 1) {
      accelFunc = (x, y, vx, vy) => this.getBallisticsAcceleration(x, y, vx, vy, { wind: activeWind });
    } else if (level === 2) {
      accelFunc = (x, y, vx, vy) => this.getKeplerAcceleration(x, y, vx, vy, planet, { wind: activeWind });
    } else if (level === 3) {
      accelFunc = (x, y, vx, vy) => this.getSchwarzschildAcceleration(x, y, vx, vy, blackHole, { wind: activeWind });
    } else {
      accelFunc = () => [0, 0];
    }

    // Collect all obstacles to check
    const obstaclesToCheck = [];
    if (Array.isArray(obstacles)) {
      obstaclesToCheck.push(...obstacles);
    } else {
      if (obstacle) obstaclesToCheck.push(obstacle);
      if (topObstacle) obstaclesToCheck.push(topObstacle);
    }

    points.push({ x: state[0], y: state[1], vx: state[2], vy: state[3], t: 0 });

    for (let i = 1; i <= maxSteps; i++) {
      // Use 2 sub-steps per prediction point for solid accuracy without performance hit
      state = this.step(state, dt * 0.5, accelFunc, (i - 0.5) * dt);
      state = this.step(state, dt * 0.5, accelFunc, i * dt);

      const [px, py, pvx, pvy] = state;
      let event = null;

      // Check collision with target
      if (target) {
        const distTarget = Math.hypot(px - target.x, py - target.y);
        if (distTarget <= (target.radius || 40)) {
          event = 'HIT_TARGET';
          points.push({ x: px, y: py, vx: pvx, vy: pvy, t: i * dt, event });
          break;
        }
      }

      // Check collision with obstacles (Level 1, 2, or 3)
      for (const obs of obstaclesToCheck) {
        if (
          px >= obs.x &&
          px <= obs.x + obs.width &&
          py >= obs.y &&
          py <= obs.y + obs.height
        ) {
          event = 'HIT_OBSTACLE';
          break;
        }
      }
      if (event === 'HIT_OBSTACLE') {
        points.push({ x: px, y: py, vx: pvx, vy: pvy, t: i * dt, event });
        break;
      }

      // Check collision with planet (Level 2)
      if (planet && level === 2) {
        const distPlanet = Math.hypot(px - planet.x, py - planet.y);
        if (distPlanet <= (planet.radius || 40)) {
          event = 'HIT_PLANET';
          points.push({ x: px, y: py, vx: pvx, vy: pvy, t: i * dt, event });
          break;
        }
      }

      // Check Event Horizon capture (Level 3)
      if (blackHole && level === 3) {
        const distBh = Math.hypot(px - blackHole.x, py - blackHole.y);
        if (distBh <= (blackHole.rs || 64)) {
          event = 'CAPTURED_BLACK_HOLE';
          points.push({ x: px, y: py, vx: pvx, vy: pvy, t: i * dt, event });
          break;
        }
      }

      // Check bounds
      if (px < -60 || px > width + 60 || py < -150 || py > height + 60) {
        event = 'OUT_OF_BOUNDS';
        points.push({ x: px, y: py, vx: pvx, vy: pvy, t: i * dt, event });
        break;
      }

      points.push({ x: px, y: py, vx: pvx, vy: pvy, t: i * dt, event: null });
    }

    return points;
  }
}

// Global singleton instance with default parameters
export const rk4Solver = new RK4Solver();
