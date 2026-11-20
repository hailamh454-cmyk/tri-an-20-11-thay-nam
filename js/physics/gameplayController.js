/**
 * js/physics/gameplayController.js
 * 
 * Gameplay & Physics Orchestrator for 2011 Thầy Nam Diegetic Blackboard.
 * 
 * Responsibilities:
 * 1. Manages Level 1 (Ballistics + Drag), Level 2 (Kepler Slingshot), and Level 3 (Schwarzschild Black Hole).
 * 2. Fires chalk projectile with initial conditions derived from diegetic board controls.
 * 3. Uses RK4Solver for high-precision numerical integration.
 * 4. Generates dashed trajectory trails, drifting chalk dust, and impact particle sparks.
 * 5. Triggers procedural Web Audio sounds via soundSynthesizer (flight wind, slingshot hum, impact thuds).
 * 6. Detects target hits and Level 3 Event Horizon penetration (r <= rs) to trigger the Supernova Sequence.
 * 
 * Complies with Google Antigravity Architecture & Physics Standards.
 */

import { RK4Solver, rk4Solver } from './rk4Solver.js';
import { soundSynthesizer } from '../audio/soundSynthesizer.js';
import {
  drawRealisticChalkLine,
  drawRealisticChalkArc,
  drawChalkRect,
  CHALK_COLORS
} from '../scene/interactiveBoard.js';

export class GameplayController {
  constructor(options = {}) {
    this.width = options.width || 2048;
    this.height = options.height || 820;
    this.solver = options.solver || rk4Solver;
    this.audio = options.audio || soundSynthesizer;

    // Callbacks
    this.onLevelVictory = options.onLevelVictory || (() => {});
    this.onBlackHoleSingularity = options.onBlackHoleSingularity || (() => {});
    this.onImpact = options.onImpact || (() => {});
    this.onTelemetryUpdate = options.onTelemetryUpdate || (() => {});
    this.onStateChange = options.onStateChange || (() => {});

    // State
    this.currentLevel = 1;
    this.angleDeg = 45;
    this.v0 = 36; // m/s
    this.speedFactor = 23.5; // Maps m/s to Canvas pixels/s

    // Projectile state
    this.bullet = null; // { x, y, vx, vy, trail: [], active, color }
    this.dustParticles = [];
    this.sparkParticles = [];
    this.persistentTrails = []; // Past attempts (kept to 2 for clear calibration)

    // Gunny PC Wind & Power Bar mechanics
    this.wind = options.wind !== undefined ? options.wind : 0;
    this.consecutiveMisses = 0;
    this.lastPower = null;
    this.lastAngle = null;
    this.isChargingPower = false;
    this.chargePower = 0;
    this.chargeDirection = 1;
    this.chargeSpeed = 75; // 0 to 100 in ~1.33 seconds (classic Gunny timing)

    // Level objects
    this.launcher = { x: 200, y: 635, radius: 18 };
    this.target = null;
    this.obstacle = null;
    this.topObstacle = null;
    this.planet = null;
    this.blackHole = null;

    // Victory & completion flags
    this.isVictorious = false;
    this.isCaptured = false;
    this.telemetry = {};

    // Offscreen Canvas Cache for Static Props (Target, Obstacles, Planet, Ruler, Wind Meter)
    this.staticPropsCanvas = null;
    this.staticPropsCtx = null;
    if (typeof document !== 'undefined') {
      this.staticPropsCanvas = document.createElement('canvas');
      this.staticPropsCanvas.width = this.width;
      this.staticPropsCanvas.height = this.height;
      this.staticPropsCtx = this.staticPropsCanvas.getContext('2d');
    } else if (typeof OffscreenCanvas !== 'undefined') {
      this.staticPropsCanvas = new OffscreenCanvas(this.width, this.height);
      this.staticPropsCtx = this.staticPropsCanvas.getContext('2d');
    }

    this._setupLevel(1);
  }

  /**
   * Initializes or changes the active level (1, 2, or 3).
   * @param {number} levelIndex (1, 2, 3)
   */
  setLevel(levelIndex) {
    this.currentLevel = Math.max(1, Math.min(3, Math.floor(levelIndex)));
    this._setupLevel(this.currentLevel);
    this.updateTelemetry();
    this.onStateChange(this.getState());
  }

  /**
   * Randomizes horizontal wind in steps of 0.5 within [-4.0, +4.0].
   * If player missed >= 6 times on this level, narrows wind to [-1.0, +1.0] as a safety valve.
   */
  _randomizeWind() {
    const maxW = this.consecutiveMisses >= 6 ? 1.0 : 4.0;
    const steps = Math.round(maxW * 2); // e.g. 8 steps if maxW is 4.0
    const stepIdx = Math.floor(Math.random() * (steps * 2 + 1)) - steps;
    this.wind = Math.round((stepIdx * 0.5) * 10) / 10;
    this._updateStaticPropsCache();
  }

  /**
   * Updates cached rendering of static elements (target, obstacle, planet, black hole, ruler, wind).
   */
  _updateStaticPropsCache() {
    if (!this.staticPropsCtx || !this.staticPropsCanvas) return;
    const ctx = this.staticPropsCtx;
    ctx.clearRect(0, 0, this.width, this.height);

    // 1. Render Level Props (Target, Obstacles, Planet, Black Hole)
    this._renderLevelProps(ctx);

    // 2. Render Wind Meter (top-center y ≈ 44)
    this._renderWindMeter(ctx);

    // 3. Render 10-Part Gunny Screen Ruler (bottom edge y = 795)
    this._renderScreenRuler(ctx);
  }

  /**
   * Internal configuration of level physics bodies and targets on 2048x820 blackboard.
   */
  _setupLevel(level) {
    this.bullet = null;
    this.dustParticles = [];
    this.sparkParticles = [];
    this.persistentTrails = [];
    this.isVictorious = false;
    this.isCaptured = false;
    this.consecutiveMisses = 0;
    this._randomizeWind();

    // Standard Launcher base
    this.launcher = { x: 200, y: 635, radius: 18 };

    if (level === 1) {
      // Level 1: Classical Ballistics with Drag + Wind
      // Target at (1760, 620), radius 40
      this.target = {
        x: 1760,
        y: 620,
        radius: 40,
        isHit: false,
        name: 'Mục Tiêu Parabol'
      };
      // Middle barrier wall (x: 900, width: 48, y: 340..800) forcing high-arc lob with wind compensation
      this.obstacle = {
        x: 900,
        y: 340,
        width: 48,
        height: 460,
        name: 'Tường Chắn Giữa'
      };
      this.topObstacle = null;
      this.planet = null;
      this.blackHole = null;
      this.angleDeg = 45;
      this.v0 = 36;
    } else if (level === 2) {
      // Level 2: Kepler Celestial Mechanics & Slingshot
      // Target at (1720, 560), radius 42
      this.target = {
        x: 1720,
        y: 560,
        radius: 42,
        isHit: false,
        name: 'Mục Tiêu Quỹ Đạo'
      };
      // Bottom barrier wall (x: 990, width: 60, y: 410..800)
      this.obstacle = {
        x: 990,
        y: 410,
        width: 60,
        height: 390,
        name: 'Tường Chắn Dưới'
      };
      // Top barrier wall (x: 990, width: 60, y: 0..175) creating narrow gap around Planet M
      this.topObstacle = {
        x: 990,
        y: 0,
        width: 60,
        height: 175,
        name: 'Tường Chắn Trên'
      };
      // Massive celestial planet providing strong gravitational assist
      this.planet = {
        x: 1020,
        y: 300,
        radius: 58,
        gm: 78000000,
        epsilon: 22,
        name: 'Hành Tinh M'
      };
      this.blackHole = null;
      this.angleDeg = 34;
      this.v0 = 42;
    } else if (level === 3) {
      // Level 3: Relativistic Schwarzschild Black Hole
      this.target = null; // The Black Hole itself is the target
      // Meteor shield blocking direct line of sight from launcher to black hole (x: 820, width: 44, y: 390..660)
      this.obstacle = {
        x: 820,
        y: 390,
        width: 44,
        height: 270,
        name: 'Lá Chắn Thiên Thạch'
      };
      this.topObstacle = null;
      this.planet = null;

      const rs = 62;
      const c = 1400;
      const gm = 85000000;

      this.blackHole = {
        x: 1180,
        y: 410,
        rs: rs,
        rPhoton: 93,
        rIsco: 186,
        gm: gm,
        c: c,
        name: 'Hố Đen Schwarzschild'
      };
      this.angleDeg = 38;
      this.v0 = 28;
    }

    this._updateStaticPropsCache();
  }

  /**
   * Starts Gunny PC power charging (runs from 0 to 100, bounces back and forth).
   */
  startPowerCharge() {
    if (this.bullet && this.bullet.active) return false;
    this.isChargingPower = true;
    this.chargePower = 0;
    this.chargeDirection = 1;
    return true;
  }

  /**
   * Updates Gunny power charging over delta time dt.
   */
  updatePowerCharge(dt) {
    if (!this.isChargingPower) return;
    this.chargePower += this.chargeDirection * this.chargeSpeed * dt;
    if (this.chargePower >= 100) {
      this.chargePower = 100;
      this.chargeDirection = -1;
    } else if (this.chargePower <= 0) {
      this.chargePower = 0;
      this.chargeDirection = 1;
    }
    // Update v0 in real-time matching the charging power
    this.v0 = Math.round((15 + (this.chargePower / 100) * 60) * 10) / 10;
  }

  /**
   * Releases Gunny power charge and fires projectile at the charged power.
   */
  releasePowerCharge() {
    if (!this.isChargingPower) return false;
    this.isChargingPower = false;
    const finalPower = Math.round(this.chargePower);
    this.v0 = Math.round((15 + (finalPower / 100) * 60) * 10) / 10;
    return this.fireProjectile(this.angleDeg, this.v0);
  }

  /**
   * Resets the current level simulation state without switching levels.
   */
  resetLevel() {
    this._setupLevel(this.currentLevel);
    this.updateTelemetry();
    this.onStateChange(this.getState());
  }

  /**
   * Fires a chalk bullet with specified or current angle & initial velocity.
   * 
   * @param {number} [angleDeg] Launch angle in degrees [15 - 85]
   * @param {number} [v0] Initial velocity in m/s [15 - 65]
   * @returns {boolean} True if successfully launched
   */
  fireProjectile(angleDeg = this.angleDeg, v0 = this.v0) {
    if (this.bullet && this.bullet.active) {
      return false; // Already in flight
    }

    this.angleDeg = Math.max(10, Math.min(85, angleDeg));
    this.v0 = Math.max(10, Math.min(75, v0));

    // Save Gunny last power (0..100) and last angle for player reference
    this.lastPower = Math.max(0, Math.min(100, Math.round(((this.v0 - 15) / 60) * 100)));
    this.lastAngle = Math.round(this.angleDeg);

    this.updateTelemetry();

    // Trigger audio for chalk launch click & friction
    try {
      if (this.audio && typeof this.audio.playChalkStroke === 'function') {
        this.audio.playChalkStroke(1.2, 1.4, 0.16);
      }
    } catch (e) {
      // Web Audio guard
    }

    const rad = (this.angleDeg * Math.PI) / 180.0;
    const speed = this.v0 * this.speedFactor;

    this.bullet = {
      x: this.launcher.x,
      y: this.launcher.y,
      vx: speed * Math.cos(rad),
      vy: -speed * Math.sin(rad), // -y is upward in canvas
      trail: [{ x: this.launcher.x, y: this.launcher.y }],
      active: true,
      color: '#f8fafc',
      flightTime: 0,
      initialSpeed: speed
    };

    // Play flight wind tone
    try {
      if (this.audio && typeof this.audio.playFlightWind === 'function') {
        this.audio.playFlightWind(this.v0 / 25.0);
      }
    } catch (e) {}

    return true;
  }

  /**
   * Updates physics simulation by delta time (dt in seconds).
   * Runs RK4 sub-stepping and collision/event detection.
   * 
   * @param {number} dt Frame delta time in seconds
   */
  updatePhysics(dt) {
    // 1. Update active bullet
    if (this.bullet && this.bullet.active) {
      const b = this.bullet;
      b.flightTime += dt;

      // Sub-stepping for numerical precision
      const subSteps = (this.currentLevel === 3) ? 8 : 4;
      const subDt = dt / subSteps;

      for (let s = 0; s < subSteps; s++) {
        let accelFunc;
        if (this.currentLevel === 1) {
          accelFunc = (x, y, vx, vy) => this.solver.getBallisticsAcceleration(x, y, vx, vy, { wind: this.wind });
        } else if (this.currentLevel === 2) {
          accelFunc = (x, y, vx, vy) => this.solver.getKeplerAcceleration(x, y, vx, vy, this.planet, { wind: this.wind });
        } else if (this.currentLevel === 3) {
          accelFunc = (x, y, vx, vy) => this.solver.getSchwarzschildAcceleration(x, y, vx, vy, this.blackHole, { wind: this.wind });
        }

        const state = [b.x, b.y, b.vx, b.vy];
        const nextState = this.solver.step(state, subDt, accelFunc, b.flightTime + s * subDt);

        b.x = nextState[0];
        b.y = nextState[1];
        b.vx = nextState[2];
        b.vy = nextState[3];

        // Append to trail
        b.trail.push({ x: b.x, y: b.y });

        // Spawn chalk dust particles along the trajectory
        if (Math.random() < 0.45) {
          this._spawnChalkDust(b.x, b.y, b.vx * 0.05, b.vy * 0.05);
        }

        // --- LEVEL 2: Gravitational Slingshot audio feedback ---
        if (this.currentLevel === 2 && this.planet) {
          const metrics = this.solver.calculateKeplerMetrics([b.x, b.y, b.vx, b.vy], this.planet);
          if (metrics.proximity > 0.08) {
            try {
              if (this.audio && typeof this.audio.playSlingshotHum === 'function') {
                this.audio.playSlingshotHum(metrics.proximity);
              }
            } catch (e) {}
          }
        }

        // --- COLLISION CHECKS ---

        // A. Target Collision (Levels 1 & 2)
        if (this.target && this.currentLevel !== 3) {
          const distToTarget = Math.hypot(b.x - this.target.x, b.y - this.target.y);
          if (distToTarget <= this.target.radius) {
            b.active = false;
            this.isVictorious = true;
            this.target.isHit = true;
            this._handleHitSuccess(b.x, b.y);
            break;
          }
        }

        // B. Obstacle Collision (Level 1 middle wall, Level 2 top/bottom walls, Level 3 meteor shield)
        const obstaclesToCheck = [];
        if (this.obstacle) obstaclesToCheck.push(this.obstacle);
        if (this.topObstacle) obstaclesToCheck.push(this.topObstacle);

        for (const obs of obstaclesToCheck) {
          if (
            b.x >= obs.x &&
            b.x <= obs.x + obs.width &&
            b.y >= obs.y &&
            b.y <= obs.y + obs.height
          ) {
            b.active = false;
            this._handleImpact(b.x, b.y, 'OBSTACLE');
            break;
          }
        }
        if (!b.active) break;

        // C. Planet Surface Crash (Level 2)
        if (this.planet && this.currentLevel === 2) {
          const distToPlanet = Math.hypot(b.x - this.planet.x, b.y - this.planet.y);
          if (distToPlanet <= this.planet.radius) {
            b.active = false;
            this._handleImpact(b.x, b.y, 'PLANET');
            break;
          }
        }

        // D. Schwarzschild Event Horizon Penetration (Level 3)
        if (this.blackHole && this.currentLevel === 3) {
          const distToBh = Math.hypot(b.x - this.blackHole.x, b.y - this.blackHole.y);
          if (distToBh <= this.blackHole.rs) {
            b.active = false;
            this.isCaptured = true;
            this._handleBlackHoleSingularity();
            break;
          }
        }

        // E. Out of Blackboard Bounds
        if (
          b.x < -60 ||
          b.x > this.width + 60 ||
          b.y > this.height + 60 ||
          b.y < -150
        ) {
          b.active = false;
          this._handleImpact(b.x, b.y, 'OUT_OF_BOUNDS');
          break;
        }
      }

      // If bullet just finished, save trail to persistent previous attempts (keep 2 for clear calibration)
      if (!b.active && b.trail.length > 2 && !this.isCaptured) {
        this.persistentTrails.push([...b.trail]);
        if (this.persistentTrails.length > 2) {
          this.persistentTrails.shift();
        }
      }
    }

    // 2. Update dust & spark particles
    this._updateParticles(dt);
  }

  /**
   * Handles target hit victory.
   */
  _handleHitSuccess(x, y) {
    this.consecutiveMisses = 0;
    this._spawnSparks(x, y, 40, '#fef08a');
    this._updateStaticPropsCache();
    try {
      if (this.audio) {
        if (typeof this.audio.playChalkHit === 'function') this.audio.playChalkHit();
        if (typeof this.audio.playSuccess === 'function') this.audio.playSuccess();
      }
    } catch (e) {}

    this.onLevelVictory(this.currentLevel);
    this.onStateChange(this.getState());
  }

  /**
   * Handles obstacle or boundary impact.
   */
  _handleImpact(x, y, reason) {
    this.consecutiveMisses++;
    this._randomizeWind();

    this._spawnSparks(x, y, 16, '#fca5a5');
    try {
      if (this.audio && typeof this.audio.playChalkHit === 'function') {
        this.audio.playChalkHit();
      }
    } catch (e) {}

    this.onImpact(x, y, reason);
    this.onStateChange(this.getState());

    // Auto-reload after 650ms so player can drag and fire again immediately without Reset
    setTimeout(() => {
      if (this.bullet && !this.bullet.active) {
        this.bullet = null;
        this.onStateChange(this.getState());
      }
    }, 650);
  }

  /**
   * Handles black hole singularity event horizon crossing.
   */
  _handleBlackHoleSingularity() {
    this.bullet = null;
    this.dustParticles = [];
    this.sparkParticles = [];
    this.persistentTrails = [];

    try {
      if (this.audio) {
        if (typeof this.audio.playBlackHoleImplosion === 'function') {
          this.audio.playBlackHoleImplosion();
        }
      }
    } catch (e) {}

    this.onBlackHoleSingularity(this.blackHole);
    this.onStateChange(this.getState());
  }

  /**
   * Spawns floating chalk dust motes.
   */
  _spawnChalkDust(x, y, baseVx = 0, baseVy = 0) {
    this.dustParticles.push({
      x: x + (Math.random() - 0.5) * 6,
      y: y + (Math.random() - 0.5) * 6,
      vx: baseVx + (Math.random() - 0.5) * 15,
      vy: baseVy + 8 + Math.random() * 12, // Slow drift downwards
      size: 1.5 + Math.random() * 2.5,
      alpha: 0.65 + Math.random() * 0.35,
      life: 0,
      maxLife: 0.6 + Math.random() * 0.8,
      color: '#f8fafc'
    });
  }

  /**
   * Spawns burst of impact sparks.
   */
  _spawnSparks(x, y, count = 25, color = '#fef08a') {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 40 + Math.random() * 180;
      this.sparkParticles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 2.0 + Math.random() * 3.0,
        alpha: 1.0,
        life: 0,
        maxLife: 0.4 + Math.random() * 0.6,
        color
      });
    }
  }

  /**
   * Updates dust and spark particles.
   */
  _updateParticles(dt) {
    // Dust
    for (let i = this.dustParticles.length - 1; i >= 0; i--) {
      const p = this.dustParticles[i];
      p.life += dt;
      if (p.life >= p.maxLife) {
        this.dustParticles.splice(i, 1);
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.alpha = Math.max(0, 1.0 - p.life / p.maxLife);
    }

    // Sparks
    for (let i = this.sparkParticles.length - 1; i >= 0; i--) {
      const p = this.sparkParticles[i];
      p.life += dt;
      if (p.life >= p.maxLife) {
        this.sparkParticles.splice(i, 1);
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 200 * dt; // Gravity pull
      p.alpha = Math.max(0, 1.0 - p.life / p.maxLife);
    }
  }

  /**
   * Calculates telemetry data for the active level and invokes callback.
   */
  updateTelemetry() {
    if (this.currentLevel === 1) {
      this.telemetry = this.solver.calculateBallisticsTelemetry(this.angleDeg, this.v0);
    } else if (this.currentLevel === 2) {
      this.telemetry = {
        angle: `${this.angleDeg}°`,
        v0: `${this.v0} m/s`,
        planetMass: '8.5 × 10²⁴ kg',
        slingshotBoost: '+35% Δv'
      };
    } else if (this.currentLevel === 3) {
      this.telemetry = {
        angle: `${this.angleDeg}°`,
        v0: `${this.v0} m/s`,
        rs: `${this.blackHole ? this.blackHole.rs : 68} px`,
        rPhoton: `${this.blackHole ? this.blackHole.rPhoton : 102} px`,
        isco: `${this.blackHole ? this.blackHole.rIsco : 204} px`
      };
    }
    this.onTelemetryUpdate(this.telemetry);
    return this.telemetry;
  }

  /**
   * Computes trajectory prediction points for dotted guide lines on the diegetic board.
   * 
   * @param {number} [angleDeg]
   * @param {number} [v0]
   * @param {number} [maxSteps]
   * @returns {Object[]}
   */
  calculateTrajectoryPrediction(angleDeg = this.angleDeg, v0 = this.v0, maxSteps = 10) {
    const rad = (angleDeg * Math.PI) / 180.0;
    const speed = v0 * this.speedFactor;
    const initialState = [
      this.launcher.x,
      this.launcher.y,
      speed * Math.cos(rad),
      -speed * Math.sin(rad)
    ];

    return this.solver.predictTrajectory(initialState, this.currentLevel, {
      planet: this.planet,
      blackHole: this.blackHole,
      obstacle: this.obstacle,
      topObstacle: this.topObstacle,
      target: this.target,
      wind: this.wind,
      bounds: { width: this.width, height: this.height }
    }, maxSteps, 0.025);
  }

  /**
   * Returns complete snapshot of gameplay physics state.
   */
  getState() {
    return {
      currentLevel: this.currentLevel,
      launcher: this.launcher,
      target: this.target,
      obstacle: this.obstacle,
      topObstacle: this.topObstacle,
      planet: this.planet,
      blackHole: this.blackHole,
      bullet: this.bullet,
      angleDeg: this.angleDeg,
      v0: this.v0,
      wind: this.wind,
      consecutiveMisses: this.consecutiveMisses,
      lastPower: this.lastPower,
      lastAngle: this.lastAngle,
      isChargingPower: this.isChargingPower,
      chargePower: this.chargePower,
      isVictorious: this.isVictorious,
      isCaptured: this.isCaptured,
      telemetry: this.telemetry,
      dustCount: this.dustParticles.length,
      sparksCount: this.sparkParticles.length
    };
  }

  /**
   * Alias for render(ctx) to satisfy external orchestrator calls.
   * @param {CanvasRenderingContext2D} ctx
   */
  draw(ctx) {
    this.render(ctx);
  }

  /**
   * Renders dynamic gameplay physics elements onto a 2D Canvas context.
   * Renders:
   * 1. Persistent previous attempt trails (faint chalk).
   * 2. Active bullet trajectory with dashed stroke.
   * 3. Drifting dust motes and impact sparks.
   * 4. Target rings, obstacle, planet, or black hole props.
   * 
   * @param {CanvasRenderingContext2D} ctx
   */
  render(ctx) {
    if (!ctx) return;

    ctx.save();

    // 1. Draw cached static elements (Props, Wind, Ruler) in a single fast GPU drawImage
    if (this.staticPropsCanvas) {
      ctx.drawImage(this.staticPropsCanvas, 0, 0);
    } else {
      this._renderLevelProps(ctx);
      this._renderWindMeter(ctx);
      this._renderScreenRuler(ctx);
    }

    // 2. Render Launcher Base & Gunny Dotted Guide
    this._renderLauncher(ctx);

    // 3. Render Gunny Power Bar & Last Power Memory (bottom-left x: 60..460, y: 745)
    this._renderPowerBar(ctx);

    // 6. Render Persistent Previous Attempt Trails (last 2 attempts for clear calibration)
    const numTrails = this.persistentTrails.length;
    for (let tIdx = 0; tIdx < numTrails; tIdx++) {
      const trail = this.persistentTrails[tIdx];
      if (trail.length < 2) continue;
      const isMostRecent = (tIdx === numTrails - 1);
      ctx.save();
      ctx.strokeStyle = isMostRecent ? 'rgba(254, 240, 138, 0.45)' : 'rgba(248, 250, 252, 0.22)';
      ctx.lineWidth = isMostRecent ? 2.2 : 1.6;
      ctx.setLineDash(isMostRecent ? [6, 6] : [4, 6]);
      ctx.beginPath();
      ctx.moveTo(trail[0].x, trail[0].y);
      for (let i = 1; i < trail.length; i++) {
        ctx.lineTo(trail[i].x, trail[i].y);
      }
      ctx.stroke();
      ctx.restore();
    }

    // 7. Render Active Bullet Trajectory & Trail
    if (this.bullet && this.bullet.trail.length >= 2) {
      const trail = this.bullet.trail;
      ctx.strokeStyle = '#f8fafc';
      ctx.lineWidth = 2.8;
      ctx.setLineDash([8, 6]);
      ctx.beginPath();
      ctx.moveTo(trail[0].x, trail[0].y);
      for (let i = 1; i < trail.length; i++) {
        ctx.lineTo(trail[i].x, trail[i].y);
      }
      ctx.stroke();
      ctx.setLineDash([]); // Reset line dash

      // Active chalk stick projectile tilted along velocity vector
      if (this.bullet.active) {
        const angle = Math.atan2(this.bullet.vy, this.bullet.vx);
        ctx.save();
        ctx.translate(this.bullet.x, this.bullet.y);
        ctx.rotate(angle);
        ctx.fillStyle = '#f8fafc';
        ctx.strokeStyle = 'rgba(254, 240, 138, 0.75)';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        if (typeof ctx.roundRect === 'function') {
          ctx.roundRect(-9, -3.5, 18, 7, 3);
        } else {
          ctx.rect(-9, -3.5, 18, 7);
        }
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }
    }

    // 8. Render Chalk Dust Motes
    for (const p of this.dustParticles) {
      ctx.fillStyle = p.color;
      ctx.globalAlpha = p.alpha;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }

    // 9. Render Impact Sparks
    for (const p of this.sparkParticles) {
      ctx.fillStyle = p.color;
      ctx.globalAlpha = p.alpha;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  /**
   * Renders the Wind HUD at top center of blackboard (y ≈ 46, x ≈ 1024).
   */
  _renderWindMeter(ctx) {
    ctx.save();
    const cx = 1024;
    const cy = 46;
    const w = this.wind;

    // Outer chalk frame (~340x76 px)
    drawChalkRect(ctx, cx - 170, cy - 38, 340, 76, {
      color: 'rgba(248, 250, 252, 0.45)',
      width: 1.6,
      overshoot: 2
    });

    // Baseline axis
    drawRealisticChalkLine(ctx, cx - 120, cy + 18, cx + 120, cy + 18, 'rgba(248, 250, 252, 0.35)', 1.2);
    drawRealisticChalkLine(ctx, cx, cy + 12, cx, cy + 24, 'rgba(254, 240, 138, 0.75)', 1.6);

    // Tick marks on wind axis (-4 to +4)
    for (let t = -4; t <= 4; t += 2) {
      if (t === 0) continue;
      const tx = cx + (t / 4.0) * 115;
      drawRealisticChalkLine(ctx, tx, cy + 14, tx, cy + 22, 'rgba(248, 250, 252, 0.35)', 1.2);
    }

    // Text display with Plus Jakarta Sans bold 28px
    if (typeof ctx.fillText === 'function') {
      ctx.font = 'bold 28px "Plus Jakarta Sans", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      if (Math.abs(w) < 0.01) {
        ctx.fillStyle = '#f8fafc';
        ctx.fillText('GIÓ: 0.0', cx, cy - 10);
      } else if (w > 0) {
        ctx.fillStyle = '#fef08a';
        const arrowStr = w >= 2.5 ? '►►►' : (w >= 1.5 ? '►►' : '►');
        ctx.fillText(`GIÓ ${w.toFixed(1)} ${arrowStr}`, cx, cy - 10);
      } else {
        ctx.fillStyle = '#93c5fd';
        const arrowStr = w <= -2.5 ? '◄◄◄' : (w <= -1.5 ? '◄◄' : '◄');
        ctx.fillText(`${arrowStr} GIÓ ${Math.abs(w).toFixed(1)}`, cx, cy - 10);
      }
    }

    // Pointer dot on axis
    const pointerX = cx + (w / 4.0) * 115;
    ctx.fillStyle = w > 0 ? '#fef08a' : (w < 0 ? '#93c5fd' : '#f8fafc');
    ctx.beginPath();
    ctx.arc(pointerX, cy + 18, 4.0, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  /**
   * Renders 10-part Gunny screen ruler near bottom edge (y ≈ 798, numbers at y ≈ 776).
   */
  _renderScreenRuler(ctx) {
    ctx.save();
    const xStart = 200;
    const xEnd = 1880;
    const yRuler = 798;
    const totalSpan = xEnd - xStart; // 1680 px
    const partWidth = totalSpan / 10.0; // 168 px per screen part

    // Main horizontal chalk ruler baseline at y = 798
    drawRealisticChalkLine(ctx, xStart - 10, yRuler, xEnd + 10, yRuler, 'rgba(248, 250, 252, 0.35)', 1.4);

    ctx.font = 'bold 20px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillStyle = 'rgba(248, 250, 252, 0.75)';

    for (let i = 0; i <= 10; i++) {
      const rx = xStart + i * partWidth;

      // Major tick mark
      drawRealisticChalkLine(ctx, rx, yRuler - 8, rx, yRuler + 8, 'rgba(248, 250, 252, 0.55)', 1.4);
      if (typeof ctx.fillText === 'function') {
        ctx.fillText(String(i), rx, 776);
      }

      // Minor half-tick mark (0.5 part)
      if (i < 10) {
        const hx = rx + partWidth * 0.5;
        drawRealisticChalkLine(ctx, hx, yRuler - 4, hx, yRuler + 4, 'rgba(248, 250, 252, 0.30)', 1.0);
      }
    }

    ctx.restore();
  }

  /**
   * Renders Gunny Power Bar (0..100) and Last Power memory at bottom-left (x: 60..460, y ≈ 728..752).
   */
  _renderPowerBar(ctx) {
    ctx.save();
    const bx = 60;
    const by = 728;
    const bw = 400;
    const bh = 24;

    const currentPower = this.isChargingPower
      ? Math.round(this.chargePower)
      : Math.max(0, Math.min(100, Math.round(((this.v0 - 15) / 60) * 100)));

    // Text readout above power bar at y ≈ 706: GÓC: XX° | LỰC: YY
    if (typeof ctx.fillText === 'function') {
      ctx.font = 'bold 26px "Plus Jakarta Sans", sans-serif';
      ctx.fillStyle = '#fef08a';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      const lastStr = this.lastPower !== null ? ` (CŨ: ${this.lastPower})` : '';
      ctx.fillText(`GÓC: ${Math.round(this.angleDeg)}° | LỰC: ${currentPower}${lastStr}`, bx, 706);
    }

    // Power bar outer chalk border (y = 728..752)
    drawChalkRect(ctx, bx, by, bw, bh, {
      color: 'rgba(248, 250, 252, 0.55)',
      width: 1.6,
      overshoot: 2
    });

    // Fill current power
    if (currentPower > 0 && typeof ctx.fillRect === 'function') {
      const fillW = Math.max(2, (currentPower / 100.0) * (bw - 4));
      ctx.fillStyle = this.isChargingPower
        ? 'rgba(254, 240, 138, 0.85)'
        : 'rgba(254, 240, 138, 0.48)';
      ctx.fillRect(bx + 2, by + 2, fillW, bh - 4);
    }

    // Tick marks on power bar (every 10%)
    for (let p = 10; p < 100; p += 10) {
      const tx = bx + (p / 100.0) * bw;
      ctx.strokeStyle = 'rgba(248, 250, 252, 0.35)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(tx, by + 2);
      ctx.lineTo(tx, by + 7);
      ctx.moveTo(tx, by + bh - 7);
      ctx.lineTo(tx, by + bh - 2);
      ctx.stroke();
    }

    // Red tick mark for last shot's power (LAST)
    if (this.lastPower !== null && this.lastPower >= 0 && this.lastPower <= 100) {
      const lx = bx + (this.lastPower / 100.0) * bw;
      ctx.strokeStyle = '#fca5a5';
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      ctx.moveTo(lx, by - 5);
      ctx.lineTo(lx, by + bh + 5);
      ctx.stroke();

      if (typeof ctx.fillText === 'function') {
        ctx.font = 'bold 12px "Plus Jakarta Sans", sans-serif';
        ctx.fillStyle = '#fca5a5';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText('LAST', lx, by - 6);
      }
    }

    ctx.restore();
  }

  /**
   * Internal renderer for launcher stand and Gunny aim guide.
   */
  _renderLauncher(ctx) {
    const lx = this.launcher.x;
    const ly = this.launcher.y;

    ctx.strokeStyle = '#93c5fd';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(lx - 28, ly + 14);
    ctx.lineTo(lx + 28, ly + 14);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(lx, ly, 10, 0, Math.PI * 2);
    ctx.stroke();

    // Aim guide vector and Gunny-style curved trajectory prediction when not in flight
    if (!this.bullet || !this.bullet.active) {
      // 1. Dotted trajectory prediction line:
      // Exactly 10 short dots at muzzle initially; relaxes up to 28 after 6 consecutive misses
      const guideSteps = this.consecutiveMisses >= 6
        ? Math.min(28, 10 + (this.consecutiveMisses - 5) * 3)
        : 10;

      const prediction = this.calculateTrajectoryPrediction(this.angleDeg, this.v0, guideSteps);
      if (prediction && prediction.length > 0) {
        const total = prediction.length;
        for (let i = 0; i < total; i++) {
          const pt = prediction[i];
          const progress = i / Math.max(1, total - 1);
          // Dot size shrinks from 3.2px down to 1.4px
          const size = 3.2 - 1.8 * progress;
          // Alpha decays from 0.95 down to 0.40
          const alpha = 0.95 - 0.55 * progress;
          // Alternating chalk yellow & white
          const color = i % 2 === 0
            ? `rgba(254, 240, 138, ${alpha.toFixed(3)})`
            : `rgba(248, 250, 252, ${alpha.toFixed(3)})`;

          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, size, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // 2. Short launcher aim guide pointer
      const rad = (this.angleDeg * Math.PI) / 180.0;
      const len = 35 + this.v0 * 0.4;
      const ax = lx + Math.cos(rad) * len;
      const ay = ly - Math.sin(rad) * len;

      ctx.strokeStyle = 'rgba(254, 240, 138, 0.8)';
      ctx.lineWidth = 2.0;
      ctx.beginPath();
      ctx.moveTo(lx, ly);
      ctx.lineTo(ax, ay);
      ctx.stroke();

      // Arrowhead dot
      ctx.fillStyle = '#fef08a';
      ctx.beginPath();
      ctx.arc(ax, ay, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /**
   * Helper to render chalk obstacle blocks with warning stripes.
   * Keeps clean chalk borders and diagonal hatching without vertical text clutter.
   */
  _renderObstacle(ctx, o, label = '', color = CHALK_COLORS.RED, hatchColor = 'rgba(235, 155, 155, 0.65)') {
    if (!o) return;
    ctx.save();

    drawChalkRect(ctx, o.x, o.y, o.width, o.height, {
      color,
      width: 2.6,
      overshoot: 3
    });

    for (let y = o.y + 12; y < o.y + o.height; y += 18) {
      const endY = Math.min(o.y + o.height, y + 24);
      drawRealisticChalkLine(ctx, o.x, y, o.x + o.width, endY, hatchColor, 1.6);
    }

    ctx.restore();
  }

  /**
   * Internal renderer for level target, obstacle, planet, and black hole.
   * Renders with realistic handwritten chalk graphics matching the blackboard style.
   */
  _renderLevelProps(ctx) {
    // 1. Target (Levels 1 & 2)
    if (this.target) {
      const t = this.target;
      ctx.save();
      const targetColor = t.isHit ? CHALK_COLORS.YELLOW : CHALK_COLORS.RED;
      const innerColor = t.isHit ? CHALK_COLORS.YELLOW : '#fef08a';

      // Outer ring with realistic chalk arc
      drawRealisticChalkArc(ctx, t.x, t.y, t.radius, 0, Math.PI * 2, targetColor, 3.2);

      // Middle ring with realistic chalk arc
      drawRealisticChalkArc(ctx, t.x, t.y, t.radius * 0.55, 0, Math.PI * 2, innerColor, 2.2);

      // Bullseye center dot
      drawRealisticChalkArc(ctx, t.x, t.y, 6, 0, Math.PI * 2, targetColor, 2.5);
      ctx.fillStyle = targetColor;
      ctx.beginPath();
      ctx.arc(t.x, t.y, 3.5, 0, Math.PI * 2);
      ctx.fill();

      // Crosshairs with realistic chalk lines
      drawRealisticChalkLine(ctx, t.x - t.radius - 12, t.y, t.x + t.radius + 12, t.y, 'rgba(254, 240, 138, 0.55)', 1.8);
      drawRealisticChalkLine(ctx, t.x, t.y - t.radius - 12, t.x, t.y + t.radius + 12, 'rgba(254, 240, 138, 0.55)', 1.8);

      ctx.restore();
    }

    // 2. Obstacles (Level 1 middle wall, Level 2 top/bottom walls, Level 3 meteor shield)
    if (this.currentLevel === 1 && this.obstacle) {
      this._renderObstacle(ctx, this.obstacle, '', CHALK_COLORS.RED);
    } else if (this.currentLevel === 2) {
      if (this.obstacle) {
        this._renderObstacle(ctx, this.obstacle, '', CHALK_COLORS.RED);
      }
      if (this.topObstacle) {
        this._renderObstacle(ctx, this.topObstacle, '', CHALK_COLORS.RED);
      }
    } else if (this.currentLevel === 3 && this.obstacle) {
      this._renderObstacle(ctx, this.obstacle, '', '#93c5fd', 'rgba(147, 197, 253, 0.55)');
    }

    // 3. Planet (Level 2)
    if (this.planet && this.currentLevel === 2) {
      const p = this.planet;
      ctx.save();

      // Gravitational influence field rings (dashed realistic chalk arcs)
      const fieldRing1 = p.radius * 2.8;
      const fieldRing2 = p.radius * 1.8;
      const arcSegments = 24;
      for (let i = 0; i < arcSegments; i += 2) {
        const a1 = (i / arcSegments) * Math.PI * 2;
        const a2 = ((i + 1) / arcSegments) * Math.PI * 2;
        drawRealisticChalkArc(ctx, p.x, p.y, fieldRing1, a1, a2, 'rgba(147, 197, 253, 0.22)', 1.6);
        drawRealisticChalkArc(ctx, p.x, p.y, fieldRing2, a1, a2, 'rgba(254, 240, 138, 0.32)', 1.8);
      }

      // Planet main chalk perimeter
      drawRealisticChalkArc(ctx, p.x, p.y, p.radius, 0, Math.PI * 2, '#fef08a', 3.4);
      drawRealisticChalkArc(ctx, p.x, p.y, p.radius * 0.96, 0, Math.PI * 2, 'rgba(254, 240, 138, 0.45)', 1.8);

      // Shading / diagonal hatching strokes using pale yellow / amber chalk
      const hatchStep = 9;
      const r = p.radius - 2;
      for (let dy = -r + hatchStep; dy < r; dy += hatchStep) {
        const halfChord = Math.sqrt(Math.max(0, r * r - dy * dy));
        const norm = (dy + r) / (2 * r);
        const alpha = (0.22 + norm * 0.52).toFixed(2);
        drawRealisticChalkLine(
          ctx,
          p.x - halfChord,
          p.y + dy,
          p.x + halfChord,
          p.y + dy,
          `rgba(254, 240, 138, ${alpha})`,
          1.8
        );
      }

      // Atmospheric limb / crescent glow arcs
      drawRealisticChalkArc(ctx, p.x - p.radius * 0.12, p.y - p.radius * 0.12, p.radius * 0.68, 0, Math.PI * 2, 'rgba(254, 240, 138, 0.38)', 1.8);
      drawRealisticChalkArc(ctx, p.x - p.radius * 0.24, p.y - p.radius * 0.24, p.radius * 0.36, 0, Math.PI * 2, 'rgba(254, 240, 138, 0.52)', 2.0);

      ctx.restore();
    }

    // 4. Black Hole (Level 3): Accretion disk and void handled entirely by 3D video mesh (zero 2D circles)
    if (this.blackHole && this.currentLevel === 3) {
      // Intentionally left blank to avoid any 2D hard circle around 3D video
    }
  }
}

// Global factory & singleton helper
let _activeGameplayInstance = null;

export function initGameplay(canvasWidth = 2048, canvasHeight = 1086, callbacks = {}) {
  _activeGameplayInstance = new GameplayController({
    width: canvasWidth,
    height: canvasHeight,
    ...callbacks
  });
  return _activeGameplayInstance;
}

export function setLevel(levelIndex) {
  if (!_activeGameplayInstance) initGameplay();
  _activeGameplayInstance.setLevel(levelIndex);
}

export function fireProjectile(angleDeg, velocity) {
  if (!_activeGameplayInstance) initGameplay();
  return _activeGameplayInstance.fireProjectile(angleDeg, velocity);
}

export function updatePhysics(dt) {
  if (_activeGameplayInstance) {
    _activeGameplayInstance.updatePhysics(dt);
  }
}

export function resetLevel() {
  if (_activeGameplayInstance) {
    _activeGameplayInstance.resetLevel();
  }
}

export function getState() {
  if (!_activeGameplayInstance) initGameplay();
  return _activeGameplayInstance.getState();
}

export function calculateTrajectoryPrediction(angleDeg, velocity, steps) {
  if (!_activeGameplayInstance) initGameplay();
  return _activeGameplayInstance.calculateTrajectoryPrediction(angleDeg, velocity, steps);
}

export function startPowerCharge() {
  if (_activeGameplayInstance) return _activeGameplayInstance.startPowerCharge();
  return false;
}

export function updatePowerCharge(dt) {
  if (_activeGameplayInstance) _activeGameplayInstance.updatePowerCharge(dt);
}

export function releasePowerCharge() {
  if (_activeGameplayInstance) return _activeGameplayInstance.releasePowerCharge();
  return false;
}
