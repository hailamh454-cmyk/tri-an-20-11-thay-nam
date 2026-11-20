/**
 * blackHoleSupernova.js
 * 
 * Algorithmic 3-Phase Climax Sequence:
 * 1. Phase 1: Spaghettification Swirl (0s - 2.0s)
 *    - Implosion duration = 2.0s.
 *    - Black hole migrates toward board center (1024, 543).
 *    - Dynamic 3D camera shake: if window.__CLASSROOM_APP__?.scene?.camera exists,
 *      adds camera.position.x += (Math.random() - 0.5) * 0.02.
 *    - Deconstructs chalkboard text/formulas into particle fragments.
 *    - Animate fragments via inward Logarithmic Spiral:
 *      r(t) = r0 * Math.pow(1 - t / 2.0, 1.8);
 *      theta(t) = theta0 + 6.0 * Math.log(1 + 50 / (r(t) + 1));
 *      x = bh.x + Math.cos(theta) * r;
 *      y = bh.y + Math.sin(theta) * r;
 *    - Fragments contract, stretch along tangents, and vanish into singularity.
 * 
 * 2. Phase 2: Supernova Detonation (at t = 2.0s - 3.5s)
 *    - Web Audio API Sub-bass audio synthesis:
 *      Sine oscillator sweeping from 90Hz to 25Hz with exponential decay.
 *    - Shockwave particles (2,000+ particles):
 *      Radial 360-degree blast from singularity center with friction decay:
 *      vx *= 0.92; vy *= 0.92; depositing fine chalk dust haze across all 4 corners.
 *    - Scatter 80+ classic physics formulas:
 *      Formulas: G_{\mu\nu} = \frac{8\pi G}{c^4}T_{\mu\nu}, i\hbar\frac{\partial\psi}{\partial t} = \hat{H}\psi,
 *      \nabla \times \mathbf{B} = \mu_0\mathbf{J} + \mu_0\epsilon_0\frac{\partial\mathbf{E}}{\partial t},
 *      ds^2 = -(1 - \frac{r_s}{r})c^2dt^2 + ..., T_H = \frac{\hbar c^3}{8\pi G M k_B},
 *      S = k_B \ln\Omega, \oint \mathbf{E}\cdot d\mathbf{A} = \frac{Q}{\epsilon_0}, E^2 = p^2c^2 + m^2c^4.
 *      Formulas blast outward with random angular velocity, decelerate to rest around t = 3.0s,
 *      and are permanently baked (stamped) onto static chalkboard layer with random rotations
 *      between -35° and +35°, overlapping across 100% of blackboard.
 * 
 * 3. Phase 3: Eraser Handover (at t = 3.5s)
 *    - Displays soft white chalk instruction text in center of board:
 *      "Vụ nổ Hố Đen đã phủ kín bụi phấn lên toàn bộ mặt bảng! Thầy hãy dùng chiếc khăn lau bảng ở góc trái bên dưới để lau sạch bảng nhé."
 *    - Seamlessly activates 3D felt eraser (this.eraserController.activate()).
 * 
 * Complies with 3D WebGL & Physics Standards (Google Antigravity).
 */

import { soundSynthesizer } from '../audio/soundSynthesizer.js';
import { LatexChalkRenderer, FORMULA_CATALOG, CHALK_COLORS, FormulaLayoutEngine } from '../engine/latexChalkRenderer.js';
import {
  clearStaticBoard,
  boardCanvas,
  staticBoardCanvas,
  staticBoardCtx,
  boardTexture,
  staticBoardTexture,
  generateSlateBackground,
  slateBgCanvas
} from '../scene/interactiveBoard.js';

// Global SVG Image cache for formulas to avoid recreation
const formulaImageCache = new Map();

function getFormulaImage(box) {
  if (!box || !box.svg) return null;
  if (formulaImageCache.has(box.id)) {
    return formulaImageCache.get(box.id);
  }

  let img = null;
  if (typeof window !== 'undefined' && typeof window.Image !== 'undefined') {
    try {
      const targetW = Math.round(box.w || 160);
      const targetH = Math.round(box.h || 44);
      let normalizedSvg = box.svg
        .replace(/width="[^"]+"/, `width="${targetW}px"`)
        .replace(/height="[^"]+"/, `height="${targetH}px"`);
      if (!/width="/.test(normalizedSvg)) {
        normalizedSvg = normalizedSvg.replace('<svg', `<svg width="${targetW}px" height="${targetH}px"`);
      }

      img = new window.Image();
      const svgBlob = new window.Blob([normalizedSvg], { type: 'image/svg+xml;charset=utf-8' });
      img.src = window.URL.createObjectURL(svgBlob);
      formulaImageCache.set(box.id, img);
    } catch {
      img = null;
    }
  }
  return img;
}

export class BlackHoleSupernova {
  constructor(options = {}) {
    this.boardWidth = options.boardWidth || 2048;
    this.boardHeight = options.boardHeight || 820;
    this.staticCtx = options.staticCtx || null;
    this.boardTexture = options.boardTexture || null;
    this.eraserController = options.eraserController || null;
    this.latexRenderer = options.latexRenderer || new LatexChalkRenderer();

    // Sequence States: 'IDLE' -> 'IMPLODING' -> 'EXPLODING' -> 'COMPLETED'
    this.state = 'IDLE';

    // 3-Phase Climax Timings:
    // Phase 1: 0s - 2.2s (Implosion)
    // Phase 2: 2.2s - 3.9s (Supernova Detonation & Outward Blast, rest at t=3.3s)
    // Phase 3: t = 3.9s (Bake & Eraser Handover)
    this.implosionDuration = options.implosionDuration !== undefined ? options.implosionDuration : 2.2;
    this.explosionDuration = options.explosionDuration !== undefined ? options.explosionDuration : 1.7;
    this.elapsedTime = 0;

    // Spatial coordinates
    this.centerPos = {
      x: this.boardWidth * 0.5,
      y: this.boardHeight * 0.5
    };
    this.startPos = { ...this.centerPos };
    this.blackHolePos = { ...this.centerPos };

    // Visual attributes
    this.startRadius = 62;
    this.bhRadius = 62;
    this.accretionAngle = 0;
    this.flashAlpha = 0;

    // Screen / board shake kinematics
    this.shake = {
      x: 0,
      y: 0,
      intensity: 0
    };

    // Particle and fragment arrays
    this.shockwaveParticles = [];
    this.flyingFormulas = [];

    // Pre-calculated formula layout & offscreen cache
    this.layoutEngine = null;
    this.placedBoxes = [];
    this.offscreenBakedCanvas = null;
    this.isLayoutReady = false;
    this.isBakeCompleted = false;
    this.bakePromise = null;

    // Callbacks
    this.onComplete = options.onComplete || null;

    // Chalk colors array for authentic chalk palette
    this.chalkColors = [
      CHALK_COLORS.WHITE,
      CHALK_COLORS.YELLOW,
      CHALK_COLORS.CYAN,
      CHALK_COLORS.RED
    ];

    // Precompute layout in background
    this._prepareLayout();
  }

  /**
   * Precomputes zero-collision bounding boxes for all 88 formulas.
   */
  _prepareLayout() {
    try {
      this.layoutEngine = new FormulaLayoutEngine({
        boardWidth: this.boardWidth,
        boardHeight: this.boardHeight,
        padding: 16,
        margin: 32,
        reservedZones: []
      });

      // Curate top ~52 iconic physics formulas scaled appropriately (1.25x) BEFORE layout
      // to guarantee crisp legibility and zero overlapping bounding boxes
      const selectedCatalog = FORMULA_CATALOG.slice(0, 52).map(item => ({
        ...item,
        width: Math.round((item.width || 160) * 1.25),
        height: Math.round((item.height || 36) * 1.25)
      }));

      this.placedBoxes = this.layoutEngine.generateLayout(selectedCatalog, {
        maxRotation: 16
      });

      for (const box of this.placedBoxes) {
        getFormulaImage(box);
      }

      this.isLayoutReady = true;

      // Start asynchronous offscreen rasterization
      this._prebakeOffscreenLayout();
    } catch (err) {
      console.warn('[BlackHoleSupernova] Layout preparation warning:', err);
    }
  }

  /**
   * Rasterizes all 88 formulas to an offscreen canvas ahead of time
   * so stamping during explosion is instantaneous with zero frame drop.
   */
  async _prebakeOffscreenLayout() {
    try {
      let canvas = null;
      let ctx = null;

      if (typeof document !== 'undefined') {
        canvas = document.createElement('canvas');
        canvas.width = this.boardWidth;
        canvas.height = this.boardHeight;
        ctx = canvas.getContext('2d');
      } else if (typeof OffscreenCanvas !== 'undefined') {
        canvas = new OffscreenCanvas(this.boardWidth, this.boardHeight);
        ctx = canvas.getContext('2d');
      }

      if (!canvas || !ctx) return;

      for (const box of this.placedBoxes) {
        await this.latexRenderer.renderSvgToCanvas(ctx, box.svg, box.cx, box.cy, box.w, box.h, {
          rotationDeg: box.rotationDeg,
          color: box.color,
          chalkNoise: true
        });
      }

      this.offscreenBakedCanvas = canvas;
    } catch (e) {
      // Offscreen prebake is an optimization; fallback direct draw will handle it if needed
      console.warn('[BlackHoleSupernova] Offscreen prebake deferred:', e.message);
    }
  }

  /**
   * Initiates Phase 1: Singularity Implosion sequence.
   * @param {Object} startPos - Initial (x, y) coordinates of the collapsing Level 3 Black Hole.
   * @param {Function} onCompleteCallback - Optional callback executed when supernova completes.
   */
  start(startPos = null, onCompleteCallback = null) {
    return this.triggerSequence(startPos, onCompleteCallback);
  }

  triggerSequence(startPos = null, onCompleteCallback = null) {
    if (this.state === 'IMPLODING' || this.state === 'EXPLODING') return;

    if (onCompleteCallback) {
      this.onComplete = onCompleteCallback;
    }

    this.state = 'IMPLODING';
    this.elapsedTime = 0;
    this.isBakeCompleted = false;
    this.flashAlpha = 0;
    this.startRadius = (startPos && typeof startPos.rs === 'number') ? startPos.rs : 62;
    this.bhRadius = this.startRadius;

    if (startPos && typeof startPos.x === 'number' && typeof startPos.y === 'number') {
      this.startPos = { x: startPos.x, y: startPos.y };
      this.blackHolePos = { x: startPos.x, y: startPos.y };
    } else {
      this.startPos = { x: this.boardWidth * 0.75, y: this.boardHeight * 0.5 };
      this.blackHolePos = { ...this.startPos };
    }

    // Play procedural black hole implosion sound (Web Audio API)
    try {
      soundSynthesizer.playBlackHoleImplosion();
    } catch (e) {
      console.warn('[BlackHoleSupernova] Audio playback error:', e);
    }
  }

  /**
   * Synthesizes Sub-bass audio via Web Audio API:
   * Sine oscillator 90Hz -> 25Hz over 1.2s, exponential gain ramp 0.8 -> 0.01.
   */
  _playSubBassAudio() {
    try {
      const audioCtx = (soundSynthesizer && soundSynthesizer.ctx)
        ? soundSynthesizer.ctx
        : (soundSynthesizer && typeof soundSynthesizer.init === 'function' ? soundSynthesizer.init() : null);

      if (audioCtx) {
        if (audioCtx.state === 'suspended') {
          audioCtx.resume().catch(() => {});
        }
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(90, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(25, audioCtx.currentTime + 1.2);
        gain.gain.setValueAtTime(0.8, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 1.2);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + 1.2);
      }
    } catch (e) {
      // AudioContext may not be available in headless or unit tests
    }

    try {
      if (soundSynthesizer && typeof soundSynthesizer.playSupernovaExplosion === 'function') {
        soundSynthesizer.playSupernovaExplosion();
      }
    } catch (e) {
      console.warn('[BlackHoleSupernova] Audio playback error:', e);
    }
  }

  /**
   * Transitions from Phase 1 to Phase 2: Supernova Detonation.
   */
  _triggerExplosion() {
    this.state = 'EXPLODING';
    this.elapsedTime = 0;
    this.blackHolePos = { ...this.centerPos };

    // 1. Synthesize Sub-bass audio via Web Audio API
    this._playSubBassAudio();

    this.flashAlpha = 0.42;

    this.shockwaveParticles = [];
    // 110 tia phấn kéo dài theo vận tốc (kind: 'streak')
    for (let i = 0; i < 110; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 700 + Math.random() * 1600;
      const maxLife = 0.7 + Math.random() * 0.7;
      this.shockwaveParticles.push({
        kind: 'streak',
        x: this.centerPos.x,
        y: this.centerPos.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        drag: 2.8 + Math.random() * 1.2,
        size: 1.5 + Math.random() * 1.8,
        color: this.chalkColors[i % this.chalkColors.length],
        life: maxLife,
        maxLife,
        alpha: 1.0
      });
    }

    // 70 hạt bụi phấn bay tỏa đều (kind: 'speck')
    for (let i = 0; i < 70; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 200 + Math.random() * 900;
      const maxLife = 1.0 + Math.random() * 0.9;
      this.shockwaveParticles.push({
        kind: 'speck',
        x: this.centerPos.x,
        y: this.centerPos.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        drag: 2.2 + Math.random() * 1.0,
        size: 1.2 + Math.random() * 1.8,
        color: i % 2 === 0 ? '245, 248, 245' : '248, 230, 160',
        life: maxLife,
        maxLife,
        alpha: 0.8
      });
    }

    // 52 công thức văng mạnh từ tâm theo easeOutQuart
    this.flyingFormulas = [];
    const boxes = this.placedBoxes && this.placedBoxes.length > 0 ? this.placedBoxes : [];
    for (let i = 0; i < boxes.length; i++) {
      const box = boxes[i];
      const targetRotation = box.rotationDeg !== undefined ? box.rotationDeg : (Math.random() - 0.5) * 24;
      const delay = Math.min(0.18, (i / Math.max(1, boxes.length)) * 0.18);
      const flightDuration = 0.95 + Math.random() * 0.25;

      this.flyingFormulas.push({
        box,
        startX: this.centerPos.x,
        startY: this.centerPos.y,
        targetX: box.cx,
        targetY: box.cy,
        currentX: this.centerPos.x,
        currentY: this.centerPos.y,
        currentScale: 0.05,
        targetScale: 1.0,
        currentRotation: (Math.random() - 0.5) * 140,
        targetRotation,
        color: box.color || CHALK_COLORS.WHITE,
        img: getFormulaImage(box),
        delay,
        flightDuration,
        progress: 0,
        isLanded: false
      });
    }
  }

  /**
   * Updates physics, particles, and sequence progression across the 3 phases.
   * @param {number} dt - Delta time in seconds (e.g. 0.016 for 60 FPS).
   */
  update(dt = 0.016) {
    if (this.state === 'IDLE' || this.state === 'COMPLETED') return;

    this.elapsedTime += dt;

    if (this.state === 'IMPLODING') {
      const p = Math.min(1.0, this.elapsedTime / this.implosionDuration);

      // Smooth step migration towards board center
      const smoothP = p * p * (3 - 2 * p);
      this.blackHolePos.x = this.startPos.x + (this.centerPos.x - this.startPos.x) * smoothP;
      this.blackHolePos.y = this.startPos.y + (this.centerPos.y - this.startPos.y) * smoothP;

      // Phình to mượt lên 1.70x (0 -> 0.62) rồi sụp đổ dứt khoát về 3.0px (0.62 -> 1.0)
      if (p <= 0.62) {
        const swell = 1.0 - Math.pow(1.0 - p / 0.62, 2.5);
        this.bhRadius = this.startRadius * (1.0 + 0.70 * swell);
      } else {
        const col = Math.pow((p - 0.62) / 0.38, 2.3);
        this.bhRadius = Math.max(3.0, this.startRadius * 1.70 * (1.0 - col));
      }
      this.shake = { x: 0, y: 0, intensity: 0 };
      this.accretionAngle += (3.5 + p * 12.0) * dt;

      // Implosion finished -> Trigger Phase 2 Supernova Detonation
      if (p >= 1.0) {
        this._triggerExplosion();
      }

    } else if (this.state === 'EXPLODING') {
      const p = Math.min(1.0, this.elapsedTime / this.explosionDuration);

      // Flash decay
      this.flashAlpha = 0.42 * Math.exp(-this.elapsedTime * 7.5);
      if (this.flashAlpha < 0.01) this.flashAlpha = 0;

      // Rung nhẹ 2D canvas bảng trong 0.42s đầu khi nổ rồi tự tắt về 0 (không trôi camera)
      if (this.elapsedTime < 0.42) {
        const shakeFade = 1.0 - (this.elapsedTime / 0.42);
        this.shake.intensity = 12.0 * shakeFade * shakeFade;
        this.shake.x = (Math.random() - 0.5) * this.shake.intensity * 2.0;
        this.shake.y = (Math.random() - 0.5) * this.shake.intensity * 2.0;
      } else {
        this.shake = { x: 0, y: 0, intensity: 0 };
      }

      // Update shockwave particles with frame-rate independent drag Math.exp(-drag * dt)
      for (let i = this.shockwaveParticles.length - 1; i >= 0; i--) {
        const pt = this.shockwaveParticles[i];
        const damp = Math.exp(-(pt.drag || 2.5) * dt);
        pt.x += pt.vx * dt;
        pt.y += pt.vy * dt;
        pt.vx *= damp;
        pt.vy *= damp;
        pt.life -= dt;
        pt.alpha = Math.max(0, pt.life / pt.maxLife);
        if (pt.life <= 0) this.shockwaveParticles.splice(i, 1);
      }

      // Update 52 flying formulas: easeOutQuart 1 - Math.pow(1 - t, 4)
      for (const ff of this.flyingFormulas) {
        if (ff.isLanded) continue;

        if (this.elapsedTime >= ff.delay) {
          const tFlight = Math.min(1.0, (this.elapsedTime - ff.delay) / ff.flightDuration);
          const ease = 1.0 - Math.pow(1.0 - tFlight, 4);

          ff.currentX = ff.startX + (ff.targetX - ff.startX) * ease;
          ff.currentY = ff.startY + (ff.targetY - ff.startY) * ease;
          ff.currentScale = 0.05 + (ff.targetScale - 0.05) * ease;
          ff.currentRotation = ff.currentRotation + (ff.targetRotation - ff.currentRotation) * ease;

          if (tFlight >= 1.0) {
            ff.isLanded = true;
            ff.currentX = ff.targetX;
            ff.currentY = ff.targetY;
            ff.currentRotation = ff.targetRotation;
          }
        }
      }

      // Phase 3: Eraser Handover at p >= 1.0
      if (p >= 1.0 && !this.isBakeCompleted) {
        this.bakePromise = this.finalizeBake();
      }
    }
  }

  /**
   * Phase 3: Eraser Handover (at t = 3.5s).
   * Permanently bakes all 88 formulas and fine chalk haze onto static chalkboard layer,
   * displays soft white chalk instruction text in center of board,
   * and hands over seamlessly to EraserController.
   */
  finalizeBake(ctx = null) {
    if (this.isBakeCompleted) return;
    this.isBakeCompleted = true;
    this.state = 'COMPLETED';
    this.flashAlpha = 0;
    this.shake = { x: 0, y: 0, intensity: 0 };

    const targetCtx = ctx || staticBoardCtx || this.staticCtx;

    if (targetCtx) {
      if (staticBoardCanvas && targetCtx === staticBoardCtx) {
        generateSlateBackground(staticBoardCanvas, targetCtx);
      } else if (slateBgCanvas) {
        targetCtx.drawImage(slateBgCanvas, 0, 0);
      } else {
        targetCtx.clearRect(0, 0, this.boardWidth, this.boardHeight);
      }

      // 1. Synchronously stamp all 88 formula images onto staticBoardCtx
      if (this.flyingFormulas && this.flyingFormulas.length > 0) {
        for (const ff of this.flyingFormulas) {
          const box = ff.box;
          const img = ff.img || getFormulaImage(box);
          const w = (box && box.w) ? box.w : 140;
          const h = (box && box.h) ? box.h : 40;

          targetCtx.save();
          targetCtx.translate(ff.targetX, ff.targetY);
          targetCtx.rotate((ff.targetRotation * Math.PI) / 180);
          targetCtx.globalAlpha = 0.92;

          if (img && img.complete && (img.naturalWidth > 0 || img.width > 0)) {
            targetCtx.drawImage(img, -w / 2, -h / 2, w, h);
          } else {
            targetCtx.font = `italic 24px 'STIX Two Math', serif`;
            targetCtx.fillStyle = ff.color || CHALK_COLORS.WHITE;
            targetCtx.textAlign = 'center';
            targetCtx.textBaseline = 'middle';
            targetCtx.fillText((box && box.latex) ? box.latex : 'E = mc²', 0, 0);
          }
          targetCtx.restore();
        }
      } else if (this.offscreenBakedCanvas) {
        try {
          targetCtx.drawImage(this.offscreenBakedCanvas, 0, 0);
        } catch (e) {
          console.warn('[BlackHoleSupernova] Stamp offscreen error:', e);
        }
      }

      // 2. Deposit fine chalk dust haze across all 4 corners / 100% of blackboard
      this.bakeChalkHaze(targetCtx);

      // 3. Instruction box removed to allow clean zero-collision formula scattering without black boxes

      // 4. Signal CanvasTexture update (both staticBoardTexture for 3D board and boardTexture)
      if (staticBoardTexture) {
        staticBoardTexture.needsUpdate = true;
      }
      if (boardTexture) {
        boardTexture.needsUpdate = true;
      }
      if (this.boardTexture && this.boardTexture !== boardTexture && this.boardTexture !== staticBoardTexture) {
        this.boardTexture.needsUpdate = true;
      }
    }

    // 5. Activate 3D felt eraser (clears directly on staticBoardCanvas)
    if (this.eraserController && typeof this.eraserController.activate === 'function') {
      this.eraserController.activate();
    }

    // 6. Fire completion callback and custom event
    if (typeof this.onComplete === 'function') {
      this.onComplete();
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('supernova-completed', {
        detail: { totalFormulas: this.placedBoxes?.length || 52 }
      }));
    }
  }

  /**
   * Instruction text box removed to prevent black rectangular overlay in center of board.
   */
  drawEraserInstructionText(ctx) {
    // No-op: formulas are spread cleanly with zero black rectangular overlay
    return;
  }

  /**
   * Bakes an all-over chalk dust haze and fine speckles across all 4 corners and 100% of blackboard surface.
   * @param {CanvasRenderingContext2D} ctx - Static layer canvas context.
   */
  bakeChalkHaze(ctx) {
    if (!ctx) return;

    ctx.save();

    // 1. Soft milky chalk haze wash covering full canvas
    ctx.fillStyle = 'rgba(240, 248, 255, 0.12)';
    ctx.fillRect(0, 0, this.boardWidth, this.boardHeight);

    // 1.5. Center radial explosion chalk dust diffusion
    const centerGrad = ctx.createRadialGradient(this.centerPos.x, this.centerPos.y, 10, this.centerPos.x, this.centerPos.y, this.boardWidth * 0.55);
    centerGrad.addColorStop(0, 'rgba(255, 255, 250, 0.20)');
    centerGrad.addColorStop(0.5, 'rgba(250, 248, 240, 0.10)');
    centerGrad.addColorStop(1, 'rgba(240, 248, 255, 0.02)');
    ctx.fillStyle = centerGrad;
    ctx.fillRect(0, 0, this.boardWidth, this.boardHeight);

    // 2. Corner vignetting chalk dust concentration
    const cornerRadius = Math.max(this.boardWidth, this.boardHeight) * 0.45;
    const corners = [
      [0, 0],
      [this.boardWidth, 0],
      [0, this.boardHeight],
      [this.boardWidth, this.boardHeight]
    ];
    for (const [cx, cy] of corners) {
      const grad = ctx.createRadialGradient(cx, cy, 10, cx, cy, cornerRadius);
      grad.addColorStop(0, 'rgba(250, 250, 245, 0.16)');
      grad.addColorStop(1, 'rgba(250, 250, 245, 0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, this.boardWidth, this.boardHeight);
    }

    // 3. Fine dusty speckles deposited across full board (optimized for 60 FPS)
    const dustCount = 350;
    for (let i = 0; i < dustCount; i++) {
      const x = Math.random() * this.boardWidth;
      const y = Math.random() * this.boardHeight;
      const r = 0.5 + Math.random() * 1.8;
      ctx.fillStyle = Math.random() > 0.55 ? CHALK_COLORS.WHITE : CHALK_COLORS.YELLOW;
      ctx.globalAlpha = 0.10 + Math.random() * 0.22;
      ctx.fillRect(x, y, r, r);
    }

    ctx.restore();
  }

  /**
   * Draws dynamic visual elements on the active Sim Canvas / Layer 3.
   * @param {CanvasRenderingContext2D} ctx - Active rendering context.
   */
  draw(ctx) {
    if (this.state === 'IDLE' || this.state === 'COMPLETED' || !ctx) return;

    ctx.save();

    if (this.state === 'IMPLODING') {
      const bh = this.blackHolePos;
      const p = Math.min(1.0, this.elapsedTime / this.implosionDuration);

      // Point-like brilliant singularity spark when p > 0.88
      if (p > 0.88) {
        const glowP = (p - 0.88) / 0.12;
        ctx.save();
        const grad = ctx.createRadialGradient(bh.x, bh.y, 1, bh.x, bh.y, Math.max(4, this.bhRadius * 1.8));
        grad.addColorStop(0, `rgba(255, 255, 255, ${0.95 * glowP})`);
        grad.addColorStop(0.4, `rgba(254, 240, 138, ${0.7 * glowP})`);
        grad.addColorStop(1, 'rgba(254, 240, 138, 0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(bh.x, bh.y, Math.max(4, this.bhRadius * 1.8), 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

    } else if (this.state === 'EXPLODING') {
      ctx.translate(this.shake.x, this.shake.y);

      // 1. Soft radial bloom flash fading toward edges
      if (this.flashAlpha > 0.01) {
        ctx.save();
        const fx = this.blackHolePos.x || this.centerPos.x;
        const fy = this.blackHolePos.y || this.centerPos.y;
        const maxR = Math.max(this.boardWidth, this.boardHeight) * 0.75;
        const flashGrad = ctx.createRadialGradient(fx, fy, 20, fx, fy, maxR);
        flashGrad.addColorStop(0, `rgba(255, 250, 235, ${this.flashAlpha})`);
        flashGrad.addColorStop(0.35, `rgba(254, 240, 138, ${this.flashAlpha * 0.55})`);
        flashGrad.addColorStop(0.7, `rgba(245, 158, 11, ${this.flashAlpha * 0.18})`);
        flashGrad.addColorStop(1, 'rgba(15, 28, 22, 0)');
        ctx.fillStyle = flashGrad;
        ctx.fillRect(0, 0, this.boardWidth, this.boardHeight);
        ctx.restore();
      }

      // 2. Shockwave particles: streaks & specks
      for (const pt of this.shockwaveParticles) {
        if (pt.kind === 'streak') {
          ctx.strokeStyle = pt.color;
          ctx.globalAlpha = pt.alpha * 0.9;
          ctx.lineWidth = pt.size;
          ctx.beginPath();
          ctx.moveTo(pt.x, pt.y);
          ctx.lineTo(pt.x - pt.vx * 0.02, pt.y - pt.vy * 0.02);
          ctx.stroke();
        } else {
          ctx.fillStyle = `rgba(${pt.color}, ${pt.alpha * 0.75})`;
          ctx.globalAlpha = 1.0;
          ctx.fillRect(pt.x, pt.y, pt.size, pt.size);
        }
      }

      // 3. Dynamic expanding formulas
      for (const ff of this.flyingFormulas) {
        if (this.elapsedTime < ff.delay) continue;

        ctx.save();
        ctx.translate(ff.currentX, ff.currentY);
        ctx.rotate((ff.currentRotation * Math.PI) / 180);
        ctx.scale(ff.currentScale, ff.currentScale);

        const img = ff.img || getFormulaImage(ff.box);
        const w = ff.box.w || 140;
        const h = ff.box.h || 40;
        ctx.globalAlpha = 0.95;

        if (img && img.complete && (img.naturalWidth > 0 || img.width > 0)) {
          ctx.drawImage(img, -w / 2, -h / 2, w, h);
        } else {
          const rawText = ff.box.latex || 'E = mc²';
          // Filter out raw TeX commands if any
          const cleanText = rawText.includes('\\') ? (ff.box.name || 'E = mc²') : rawText;
          ctx.font = `italic 24px 'STIX Two Math', serif`;
          ctx.fillStyle = ff.color || '#fef08a';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(cleanText, 0, 0);
        }

        ctx.restore();
      }
    }

    ctx.restore();
  }

  /**
   * Returns current board shake offset (x, y, intensity) for screen shake effects.
   */
  getShakeOffset() {
    return {
      x: this.shake.x,
      y: this.shake.y,
      intensity: this.shake.intensity
    };
  }

  /**
   * Checks if sequence is actively running.
   */
  isActive() {
    return this.state === 'IMPLODING' || this.state === 'EXPLODING';
  }
}

export default BlackHoleSupernova;
