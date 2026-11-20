/**
 * eraserController.js
 * 
 * 100% Diegetic Chalkboard Felt Eraser Controller.
 * Complies with 3D WebGL & Physics Standards (Google Antigravity).
 * 
 * Features:
 * - 3D Felt Eraser at bottom-left ledge that glows invitingly after supernova explosion.
 * - Raycast cursor tracking across 3D blackboard texture (2048x1086).
 * - Multi-stroke destination-out felt footprint erasure of static chalk layer.
 * - High-speed continuous line interpolation to prevent gaps during fast dragging.
 * - Falling chalk crumb particles with gravity and velocity dispersion.
 * - Procedural Web Audio API sound synthesis (playEraserWipe).
 * - High-performance 80x45 downsampled grid tracking (3600 cells) for 60 FPS monitoring.
 * - Threshold completion (>= 80%):
 *   * Auto-cleans remaining 20% in a smooth 0.6s fade.
 *   * Parks eraser back to bottom-left ledge dock.
 *   * Plays procedural success chime.
 *   * Dispatches `window.dispatchEvent(new CustomEvent('phase1-completed'))`.
 */

import { soundSynthesizer } from '../audio/soundSynthesizer.js';
import {
  canvasToWorldPosition,
  staticBoardCanvas,
  staticBoardCtx,
  staticBoardTexture,
  boardTexture,
  slateBgCanvas,
  generateSlateBackground,
  BOARD_WORLD
} from '../scene/interactiveBoard.js';

export class EraserController {
  constructor(options = {}) {
    // If called with (boardWidth, boardHeight, staticCanvas, staticCtx) legacy signature
    if (typeof options === 'number') {
      const w = arguments[0];
      const h = arguments[1];
      const sCanvas = arguments[2];
      const sCtx = arguments[3];
      options = { boardWidth: w, boardHeight: h, staticCanvas: sCanvas, staticCtx: sCtx };
    }

    this.boardWidth = options.boardWidth || 2048;
    this.boardHeight = options.boardHeight || 820;
    this.staticCanvas = options.staticCanvas || staticBoardCanvas;
    this.staticCtx = options.staticCtx || staticBoardCtx || (this.staticCanvas ? this.staticCanvas.getContext('2d') : null);
    this.boardTexture = options.boardTexture || null;
    this.eraser3D = options.eraser3D || null;

    // Eraser dimensions (proportioned for 2048x820 blackboard, matching 3D felt mesh)
    this.eraserWidth = options.eraserWidth || 140;
    this.eraserHeight = options.eraserHeight || 68;

    // Khớp với vị trí thực của eraser3D ở mép phải khay phấn (worldX = -202 => canvasX ≈ 1871)
    this.dockPos = {
      x: options.dockX || 1871,
      y: options.dockY || this.boardHeight - 24
    };
    this.pos = { ...this.dockPos };
    this.prevPos = { ...this.dockPos };
    this.velocity = { x: 0, y: 0 };
    this.tilt = 0;

    // State machine
    this.isActive = false;       // Activated after supernova
    this.isEquipped = false;     // Picked up by user
    this.isDragging = false;     // Pointer is actively pressed & wiping
    this.glowPhase = 0;
    this.autoCleaning = false;
    this.autoCleanTimer = 0;
    this.autoCleanDuration = 0.6; // 0.6s smooth clear
    this.hasTriggeredCompletion = false;

    // 80x45 Downsampled Grid (80 cols x 45 rows = 3600 cells)
    this.gridCols = 80;
    this.gridRows = 45;
    this.cellWidth = this.boardWidth / this.gridCols;
    this.cellHeight = this.boardHeight / this.gridRows;
    this.totalCells = this.gridCols * this.gridRows;
    this.grid = new Uint8Array(this.totalCells);
    this.cleanedCells = 0;
    this.cleanedPercentage = 0;

    // Falling chalk crumb particles
    this.crumbs = [];
    this.maxCrumbs = 200;

    // Audio throttle
    this.lastSoundTime = 0;
    this.soundThrottle = 0.08; // seconds

    // Callback
    this.onPhase1Completed = options.onPhase1Completed || null;

    // DOM UI elements (optional fallback for non-diegetic displays)
    this.cardEl = typeof document !== 'undefined' ? document.getElementById('wipe-progress-card') : null;
    this.percentEl = typeof document !== 'undefined' ? document.getElementById('wipe-percentage') : null;
    this.fillEl = typeof document !== 'undefined' ? document.getElementById('wipe-progress-fill') : null;
    this.eraserDOM = typeof document !== 'undefined' ? document.getElementById('chalk-eraser') : null;
  }

  /**
   * Resets the 80x45 downsampled grid and cleaning progress.
   */
  resetGrid() {
    this.grid.fill(0);
    this.cleanedCells = 0;
    this.cleanedPercentage = 0;
    this.hasTriggeredCompletion = false;
    this.autoCleaning = false;
    this.autoCleanTimer = 0;
    this.crumbs = [];
    this.updateUI();
  }

  /**
   * Activates eraser mode after Supernova Explosion.
   * Eraser begins glowing at bottom-left ledge.
   */
  activate() {
    this.isActive = true;
    this.resetGrid();

    if (!slateBgCanvas && !this.bgCanvas && typeof document !== 'undefined') {
      try {
        this.bgCanvas = document.createElement('canvas');
        this.bgCanvas.width = this.boardWidth;
        this.bgCanvas.height = this.boardHeight;
        const bgCtx = this.bgCanvas.getContext('2d');
        generateSlateBackground(this.bgCanvas, bgCtx);
      } catch (e) {
        // Fallback
      }
    }

    if (this.cardEl) this.cardEl.classList.remove('hidden');
    if (this.eraserDOM) this.eraserDOM.classList.add('hint-active');

    const handle = this.eraser3D?.getObjectByName('EraserHandleMesh');
    if (handle?.material?.emissive) {
      handle.material.emissive.setHex(0xf8e6a0);
      handle.material.emissiveIntensity = 0.25;
    }
  }

  /**
   * Equips the eraser and docks or attaches to cursor.
   */
  equip() {
    if (!this.isActive) return;
    this.isEquipped = true;

    if (this.eraserDOM) {
      this.eraserDOM.classList.remove('hint-active');
      this.eraserDOM.style.opacity = '0.35';
    }
  }

  /**
   * Smoothly returns the eraser to resting dock on the bottom-left rail.
   */
  dock() {
    this.isEquipped = false;
    this.isDragging = false;
    this.pos = { ...this.dockPos };
    this.prevPos = { ...this.dockPos };
    this.velocity = { x: 0, y: 0 };
    this.tilt = 0;

    if (this.eraserDOM) {
      this.eraserDOM.classList.remove('hint-active');
      this.eraserDOM.style.opacity = '1.0';
    }

    if (this.eraser3D) {
      this.eraser3D.scale.setScalar(1.0);
      const dockWorldX = BOARD_WORLD ? BOARD_WORLD.min.x + 36.0 : -202.0;
      const dockWorldY = 85.6 + 0.56;
      const dockWorldZ = BOARD_WORLD ? BOARD_WORLD.frontZ - 5.4 : 474.06;
      this.eraser3D.position.set(dockWorldX, dockWorldY, dockWorldZ);
      this.eraser3D.rotation.order = 'XYZ';
      this.eraser3D.rotation.set(0, 0.06, 0);

      const shadow = this.eraser3D.getObjectByName('EraserContactShadow');
      if (shadow) shadow.visible = true;

      const aura = this.eraser3D.getObjectByName('EraserGlowAura');
      if (aura && aura.material) {
        aura.material.opacity = 0.0;
      }
      const handle = this.eraser3D.getObjectByName('EraserHandleMesh');
      if (handle?.material?.emissive) {
        handle.material.emissiveIntensity = 0.0;
      }
    }
  }

  /**
   * Handles pointer input mapped from 3D Raycasting onto blackboard canvas coordinates.
   * Accepts both 'pointerdown'/'pointermove'/'pointerup' and 'down'/'move'/'up'.
   * @param {string} type - 'pointerdown' | 'pointermove' | 'pointerup' | 'down' | 'move' | 'up'
   * @param {number} x - Board canvas X coordinate (0 to 2048)
   * @param {number} y - Board canvas Y coordinate (0 to 820)
   */
  handlePointer(type, x, y) {
    if (!this.isActive || this.hasTriggeredCompletion) return;
    const evType = typeof type === 'string' ? type.replace(/^pointer/, '') : '';

    if (evType === 'down') {
      this.equip();
      this.isDragging = true;
      const cx = Math.max(0, Math.min(this.boardWidth, x));
      const cy = Math.max(0, Math.min(this.boardHeight, y));
      this.pos.x = cx;
      this.pos.y = cy;
      this.prevPos.x = cx;
      this.prevPos.y = cy;
      this.eraseAt(cx, cy);
      this._syncEraser3D();
    } else if (evType === 'move') {
      if (this.isDragging) {
        const cx = Math.max(0, Math.min(this.boardWidth, x));
        const cy = Math.max(0, Math.min(this.boardHeight, y));
        const dx = cx - this.pos.x;
        const dy = cy - this.pos.y;
        const dist = Math.hypot(dx, dy);

        if (dist > 1.5) {
          this.prevPos.x = this.pos.x;
          this.prevPos.y = this.pos.y;
          this.pos.x = cx;
          this.pos.y = cy;
          this.velocity.x = dx;
          this.velocity.y = dy;

          const targetTilt = Math.max(-0.32, Math.min(0.32, dx * 0.008));
          this.tilt += (targetTilt - this.tilt) * 0.25;

          this._syncEraser3D();
          this.eraseLine(this.prevPos.x, this.prevPos.y, this.pos.x, this.pos.y);
          this._spawnCrumbs(cx, cy, dx, dy, dist);
          this._triggerWipeSound(dist);
        }
      }
    } else if (evType === 'up') {
      this.isDragging = false;
      this.velocity = { x: 0, y: 0 };
      this._syncEraser3D();
    }
  }

  /**
   * Erases a continuous line from (x0, y0) to (x1, y1) via multiple stamp samples.
   */
  eraseLine(x0, y0, x1, y1) {
    const dist = Math.hypot(x1 - x0, y1 - y0);
    const step = Math.max(12, this.eraserHeight * 0.35);
    const numSteps = Math.max(1, Math.ceil(dist / step));

    for (let i = 0; i <= numSteps; i++) {
      const t = i / numSteps;
      const curX = x0 + (x1 - x0) * t;
      const curY = y0 + (y1 - y0) * t;
      this.eraseAt(curX, curY);
    }
  }

  /**
   * Erases at a specific point on the static canvas layer using destination-out,
   * and updates the 80x45 downsampled grid.
   */
  eraseAt(x, y) {
    if (!this.staticCtx) return;

    const ctx = this.staticCtx;
    const hw = this.eraserWidth * 0.5;
    const hh = this.eraserHeight * 0.5;

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(this.tilt);

    // If slate background is available, restore the authentic moss-slate background instead of turning black
    let bg = slateBgCanvas || this.bgCanvas;
    if (!bg && typeof document !== 'undefined') {
      try {
        this.bgCanvas = document.createElement('canvas');
        this.bgCanvas.width = this.boardWidth;
        this.bgCanvas.height = this.boardHeight;
        const bgCtx = this.bgCanvas.getContext('2d');
        generateSlateBackground(this.bgCanvas, bgCtx);
        bg = this.bgCanvas;
      } catch (e) {}
    }

    if (bg) {
      const pad = Math.ceil(Math.hypot(hw, hh)) + 4;
      const sx = Math.max(0, Math.floor(x - pad));
      const sy = Math.max(0, Math.floor(y - pad));
      const ex = Math.min(this.boardWidth, Math.ceil(x + pad));
      const ey = Math.min(this.boardHeight, Math.ceil(y + pad));
      const sw = ex - sx;
      const sh = ey - sy;

      ctx.beginPath();
      if (typeof ctx.roundRect === 'function') {
        ctx.roundRect(-hw, -hh, this.eraserWidth, this.eraserHeight, 10);
      } else {
        ctx.rect(-hw, -hh, this.eraserWidth, this.eraserHeight);
      }
      ctx.clip();

      if (sw > 0 && sh > 0) {
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.globalAlpha = 0.92; // Làm mềm rìa khi các stamp đè lên nhau
        ctx.drawImage(bg, sx, sy, sw, sh, sx, sy, sw, sh);
      }
    } else {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.fillStyle = 'rgba(0, 0, 0, 0.96)';
      ctx.beginPath();
      if (typeof ctx.roundRect === 'function') {
        ctx.roundRect(-hw, -hh, this.eraserWidth, this.eraserHeight, 10);
      } else {
        ctx.rect(-hw, -hh, this.eraserWidth, this.eraserHeight);
      }
      ctx.fill();
    }

    ctx.restore();

    // Signal Three.js texture update (both staticBoardTexture and boardTexture)
    if (staticBoardTexture) {
      staticBoardTexture.needsUpdate = true;
    }
    if (boardTexture) {
      boardTexture.needsUpdate = true;
    }
    if (this.boardTexture && this.boardTexture !== boardTexture && this.boardTexture !== staticBoardTexture) {
      this.boardTexture.needsUpdate = true;
    }

    // Update 80x45 grid coverage
    this._markGridCells(x, y, hw, hh);
  }

  /**
   * Marks corresponding cells in the 80x45 downsampled grid as cleaned.
   */
  _markGridCells(x, y, hw, hh) {
    const minCol = Math.max(0, Math.floor((x - hw) / this.cellWidth));
    const maxCol = Math.min(this.gridCols - 1, Math.floor((x + hw) / this.cellWidth));
    const minRow = Math.max(0, Math.floor((y - hh) / this.cellHeight));
    const maxRow = Math.min(this.gridRows - 1, Math.floor((y + hh) / this.cellHeight));

    let newlyCleaned = 0;

    for (let r = minRow; r <= maxRow; r++) {
      const rowOffset = r * this.gridCols;
      for (let c = minCol; c <= maxCol; c++) {
        const idx = rowOffset + c;
        if (this.grid[idx] === 0) {
          this.grid[idx] = 1;
          this.cleanedCells++;
          newlyCleaned++;
        }
      }
    }

    if (newlyCleaned > 0) {
      this.cleanedPercentage = Math.min(100, Math.round((this.cleanedCells / this.totalCells) * 100));
      this.updateUI();
    }
  }

  /**
   * Spawns falling chalk crumb debris along the felt brush trailing edge.
   */
  _spawnCrumbs(x, y, dx, dy, dist) {
    const count = Math.min(6, Math.max(2, Math.floor(dist * 0.12)));

    for (let i = 0; i < count; i++) {
      if (this.crumbs.length >= this.maxCrumbs) {
        this.crumbs.shift();
      }

      const offsetAlongWidth = (Math.random() - 0.5) * (this.eraserWidth * 0.85);
      const angle = this.tilt;
      const crumbX = x + Math.cos(angle) * offsetAlongWidth;
      const crumbY = y + Math.sin(angle) * offsetAlongWidth + (this.eraserHeight * 0.45);

      this.crumbs.push({
        kind: 'crumb',
        x: crumbX,
        y: crumbY,
        vx: (Math.random() - 0.5) * 55 + dx * 0.12,
        vy: 25 + Math.random() * 85 + Math.abs(dy) * 0.1,
        size: 1.0 + Math.random() * 2.2,
        color: Math.random() > 0.4 ? '#f8fafc' : '#fef08a',
        alpha: 0.8 + Math.random() * 0.2,
        life: 0.6 + Math.random() * 0.8,
        maxLife: 1.4
      });
    }
  }

  /**
   * Triggers procedural eraser wipe audio with velocity scaling.
   */
  _triggerWipeSound(dist) {
    const now = performance.now() * 0.001;
    if (now - this.lastSoundTime > this.soundThrottle) {
      this.lastSoundTime = now;
      const speedNorm = Math.min(2.5, Math.max(0.4, dist * 0.06));
      try {
        soundSynthesizer.playEraserWipe(speedNorm);
      } catch (e) {
        // Silently catch audio errors
      }
    }
  }

  /**
   * Synchronizes the 3D Felt Eraser mesh position, tilt, and gentle glow with 2D coordinates.
   */
  _syncEraser3D() {
    if (!this.eraser3D) return;

    const shadow = this.eraser3D.getObjectByName('EraserContactShadow');
    const aura = this.eraser3D.getObjectByName('EraserGlowAura');
    const handle = this.eraser3D.getObjectByName('EraserHandleMesh');

    if (this.isDragging) {
      const worldPos = canvasToWorldPosition(this.pos.x, this.pos.y);
      worldPos.z = BOARD_WORLD.frontZ - 0.65;
      this.eraser3D.position.lerp(worldPos, 0.45);
      this.eraser3D.scale.setScalar(1.32);
      this.eraser3D.rotation.order = 'ZXY';
      this.eraser3D.rotation.set(-Math.PI / 2, 0, -this.tilt);

      if (shadow) shadow.visible = false;
      if (aura && aura.material) aura.material.opacity = 0.0;
      if (handle?.material?.emissive) handle.material.emissiveIntensity = 0.0;
    } else if (this.isActive && !this.hasTriggeredCompletion) {
      this.eraser3D.scale.setScalar(1.0);
      const pulse = 0.5 + 0.5 * Math.sin(this.glowPhase);
      const bounceY = Math.sin(this.glowPhase) * 0.35;
      const dockWorldX = BOARD_WORLD ? BOARD_WORLD.min.x + 36.0 : -202.0;
      const dockWorldY = 85.6 + 0.56 + bounceY;
      const dockWorldZ = BOARD_WORLD ? BOARD_WORLD.frontZ - 5.4 : 474.06;

      this.eraser3D.position.set(dockWorldX, dockWorldY, dockWorldZ);
      this.eraser3D.rotation.order = 'XYZ';
      this.eraser3D.rotation.set(0, 0.06, 0);

      if (shadow) shadow.visible = true;
      if (aura && aura.material) aura.material.opacity = 0.05 + 0.12 * pulse;
      if (handle?.material?.emissive) handle.material.emissiveIntensity = 0.12 + 0.25 * pulse;
    } else {
      this.eraser3D.scale.setScalar(1.0);
      if (shadow) shadow.visible = true;
      if (aura && aura.material) aura.material.opacity = 0.0;
      if (handle?.material?.emissive) handle.material.emissiveIntensity = 0.0;
    }
  }

  /**
   * Updates crumbs, glow animation, and checks completion threshold (>= 80%).
   * @param {number} dt - Delta time in seconds.
   * @param {Function} onPhase2Trigger - Optional callback hook.
   */
  update(dt = 0.016, onPhase2Trigger = null) {
    if (this.isActive) {
      this._syncEraser3D();
    }

    // 1. Pulsing glow animation on ledge dock
    this.glowPhase += dt * 3.8;

    // 2. Update falling chalk crumb debris & floating dust puffs
    for (let i = this.crumbs.length - 1; i >= 0; i--) {
      const c = this.crumbs[i];
      c.x += c.vx * dt;
      c.y += c.vy * dt;
      if (c.kind === 'puff') {
        c.vx *= 0.92;
        c.vy *= 0.92;
        c.size += 8 * dt;
      } else {
        c.vy += 420 * dt; // Gravity
      }
      c.life -= dt;
      c.alpha = Math.max(0, c.life / c.maxLife);

      if (c.life <= 0 || c.y >= this.boardHeight - 6) {
        this.crumbs.splice(i, 1);
      }
    }

    // 3. Auto-clean transition once >= 72% threshold reached
    if (this.cleanedPercentage >= 72 && !this.hasTriggeredCompletion) {
      this.hasTriggeredCompletion = true;
      this.autoCleaning = true;
      this.autoCleanTimer = 0;
    }

    if (this.autoCleaning) {
      this.autoCleanTimer += dt;
      const fadeProgress = Math.min(1.0, this.autoCleanTimer / this.autoCleanDuration);

      if (this.staticCtx) {
        // Smoothly fade remaining chalk marks back to pristine moss-slate background
        const bg = slateBgCanvas || this.bgCanvas;
        if (bg) {
          this.staticCtx.save();
          this.staticCtx.globalAlpha = Math.min(1.0, dt * 5.0);
          this.staticCtx.drawImage(bg, 0, 0);
          this.staticCtx.restore();
        } else {
          this.staticCtx.save();
          this.staticCtx.globalCompositeOperation = 'destination-out';
          this.staticCtx.fillStyle = `rgba(0, 0, 0, ${Math.min(1.0, dt * 5.0)})`;
          this.staticCtx.fillRect(0, 0, this.boardWidth, this.boardHeight);
          this.staticCtx.restore();
        }

        if (staticBoardTexture) {
          staticBoardTexture.needsUpdate = true;
        }
        if (this.boardTexture) {
          this.boardTexture.needsUpdate = true;
        }
      }

      if (fadeProgress >= 1.0) {
        this.autoCleaning = false;
        this.finishWiping(onPhase2Trigger);
      }
    }
  }

  /**
   * Completes the wiping phase:
   * - Fully clears static layer back to pristine moss-slate background.
   * - Parks eraser back to ledge dock.
   * - Plays procedural success chime.
   * - Dispatches CustomEvent 'phase1-completed'.
   */
  finishWiping(onPhase2Trigger = null) {
    if (this.staticCtx) {
      const bg = slateBgCanvas || this.bgCanvas;
      if (bg) {
        this.staticCtx.drawImage(bg, 0, 0);
      } else {
        this.staticCtx.clearRect(0, 0, this.boardWidth, this.boardHeight);
      }
      if (staticBoardTexture) {
        staticBoardTexture.needsUpdate = true;
      }
      if (this.boardTexture) {
        this.boardTexture.needsUpdate = true;
      }
    }

    this.isActive = false;
    this.crumbs = [];
    if (this.cardEl) {
      this.cardEl.classList.add('hidden');
    }

    this.cleanedPercentage = 100;
    this.updateUI();
    this.dock();

    // Play procedural victory chime
    try {
      soundSynthesizer.playSuccess();
    } catch (e) {
      // Audio fallback
    }

    // Dispatch global Phase 1 completion event
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('phase1-completed', {
        detail: {
          cleanedPercentage: 100,
          timestamp: Date.now()
        }
      }));
    }

    const callback = onPhase2Trigger || this.onPhase1Completed;
    if (typeof callback === 'function') {
      setTimeout(() => {
        callback();
      }, 500);
    }
  }

  /**
   * Updates DOM UI indicators if present.
   */
  updateUI() {
    if (this.percentEl) {
      this.percentEl.textContent = `${this.cleanedPercentage}%`;
    }
    if (this.fillEl) {
      this.fillEl.style.width = `${this.cleanedPercentage}%`;
    }
  }

  /**
   * Renders the active felt eraser, glowing aura, and falling chalk crumbs.
   * @param {CanvasRenderingContext2D} ctx - Sim canvas context.
   */
  draw(ctx) {
    if (!ctx) return;

    ctx.save();

    // 1. Render falling chalk crumbs
    for (const c of this.crumbs) {
      ctx.fillStyle = c.color;
      ctx.globalAlpha = c.alpha;
      ctx.fillRect(c.x, c.y, c.size, c.size);
    }
    ctx.globalAlpha = 1.0;

    // Notice: 2D radial gradient circle and "CẦM KHĂN LAU BẢNG" text removed.
    // The inviting glow is rendered cleanly in 3D directly on EraserGlowAura / eraser3D.

    ctx.restore();
  }

  /**
   * Binds a Three.js Mesh instance for 3D synchronization.
   * @param {THREE.Mesh} mesh - Eraser 3D mesh.
   */
  bindThreeMesh(mesh) {
    this.eraser3D = mesh;
  }

  getCleanedPercentage() {
    return this.cleanedPercentage;
  }

  isCompleted() {
    return this.hasTriggeredCompletion;
  }
}

export default EraserController;
