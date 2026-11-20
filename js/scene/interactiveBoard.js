/**
 * js/scene/interactiveBoard.js
 * 
 * 100% Diegetic Chalkboard UI and Dynamic Three.js CanvasTexture Engine.
 * 
 * Features:
 * - 2048x1086 High-Resolution Slate Canvas & THREE.CanvasTexture.
 * - Procedural Slate Texture: Deep moss-slate (#15261f / #0f1c16), cloudy chalk smudges (rgba(255, 255, 255, 0.02)), fine grain noise.
 * - Authentic Chalk Color Palette (0% neon yellow #ffe600):
 *   * WHITE: rgba(240, 243, 240, 0.92)
 *   * YELLOW: rgba(248, 230, 160, 0.88) (soft vintage chalk yellow)
 *   * CYAN: rgba(165, 214, 195, 0.85) (chalk turquoise)
 *   * RED: rgba(235, 155, 155, 0.85)
 * - Realistic Chalk Bristle Line Algorithm with stippling jitter.
 * - ZERO external HTML control panels or sliders:
 *   * Level tabs: [Bài 1: Ném Xiên], [Bài 2: Kepler], [Bài 3: Hố Đen].
 *   * Arc protractor launch angle control with degree indicator.
 *   * Sketched chalk velocity slider with 3D-styled chalk stick cursor.
 *   * Action buttons: [ Phóng Phấn ], [ Làm Lại ], [ Xem Thư 20/11 ].
 *   * Real-time chalk telemetry & theoretical physics formula readouts.
 * - Precise Three.js Raycaster UV to Canvas pixel coordinate converter.
 * - 3D Chalk Rail props with colored chalk sticks and 3D Felt Eraser at bottom-left ledge.
 * - Full export interface: { boardCanvas, boardCtx, boardTexture, updateBoard, handlePointerEvent, raycastToCanvas, eraser3D }
 */

import * as THREE from 'three';
import { ChalkRenderer } from '../chalkRenderer.js';

const lectureChalkRenderer = new ChalkRenderer();

// Optional sound synthesizer import for procedural audio feedback
let soundSynth = null;
try {
  const audioModule = await import('../audio/soundSynthesizer.js');
  soundSynth = audioModule.soundSynthesizer || null;
} catch {
  // Graceful fallback if sound module is unavailable
}

// ============================================================================
// 1. CONSTANTS & COLOR PALETTE
// ============================================================================

export const CANVAS_WIDTH = 2048;
export const CANVAS_HEIGHT = 820;

export const BOARD_WORLD = {
  min: new THREE.Vector3(-238.0, 86.0, 479.55),
  max: new THREE.Vector3(178.0, 239.5, 502.52),
  center: new THREE.Vector3(-30.0, 162.75, 491.04),
  size: new THREE.Vector3(416.0, 153.5, 22.97),
  writingWidth: 416.0,
  frontZ: 479.46
};

// Authentic Chalk Color Palette (0% neon yellow #ffe600)
export const CHALK_COLORS = {
  WHITE: 'rgba(240, 243, 240, 0.92)',
  YELLOW: 'rgba(248, 230, 160, 0.88)', // Soft vintage chalk yellow
  CYAN: 'rgba(165, 214, 195, 0.85)',   // Chalk turquoise
  RED: 'rgba(235, 155, 155, 0.85)',
  AMBER: 'rgba(245, 190, 110, 0.88)', // Soft warm amber chalk
  GOLD: 'rgba(235, 180, 80, 0.88)',
  SLATE_DEEP: '#15261f',
  SLATE_DARK: '#0f1c16',
  SLATE_ACCENT: '#1a3026'
};

// ============================================================================
// 2. CANVAS & TEXTURE INITIALIZATION
// ============================================================================

export let boardCanvas = null;
export let boardCtx = null;
export let boardTexture = null;

export let slateBgCanvas = null;
let isSlateBgReady = false;
export let staticBoardCanvas = null;
export let staticBoardCtx = null;
let staticChalkCanvas = null;
let staticChalkCtx = null;
let dynamicChalkCanvas = null;
let dynamicChalkCtx = null;
let slateGrainMaskCanvas = null;
let isStaticDirty = true;

export let staticBoardTexture = null;
export let dynamicChalkTexture = null;
export let slateGrainTexture = null;
let cachedGrainPattern = null;
let wasDynamicActive = false;

function createOffscreenCanvas(w, h, canvasModule = null) {
  if (typeof document !== 'undefined') {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return c;
  }
  if (canvasModule) {
    return canvasModule.createCanvas(w, h);
  }
  return { width: w, height: h, getContext: () => null };
}

function get2dContext(canvas, alpha = true) {
  if (!canvas || typeof canvas.getContext !== 'function') return null;
  try {
    return canvas.getContext('2d', { alpha });
  } catch {
    return canvas.getContext('2d');
  }
}

if (typeof document !== 'undefined') {
  boardCanvas = createOffscreenCanvas(CANVAS_WIDTH, CANVAS_HEIGHT);
  boardCtx = get2dContext(boardCanvas, false);
  slateBgCanvas = createOffscreenCanvas(CANVAS_WIDTH, CANVAS_HEIGHT);
  staticBoardCanvas = createOffscreenCanvas(CANVAS_WIDTH, CANVAS_HEIGHT);
  staticBoardCtx = get2dContext(staticBoardCanvas, false);
  staticChalkCanvas = createOffscreenCanvas(CANVAS_WIDTH, CANVAS_HEIGHT);
  staticChalkCtx = get2dContext(staticChalkCanvas, true);
  dynamicChalkCanvas = createOffscreenCanvas(CANVAS_WIDTH, CANVAS_HEIGHT);
  dynamicChalkCtx = get2dContext(dynamicChalkCanvas, true);
  slateGrainMaskCanvas = createOffscreenCanvas(512, 512);
} else {
  try {
    const canvasModule = await import('' + '@napi-rs/canvas');
    boardCanvas = createOffscreenCanvas(CANVAS_WIDTH, CANVAS_HEIGHT, canvasModule);
    boardCtx = get2dContext(boardCanvas, false);
    slateBgCanvas = createOffscreenCanvas(CANVAS_WIDTH, CANVAS_HEIGHT, canvasModule);
    staticBoardCanvas = createOffscreenCanvas(CANVAS_WIDTH, CANVAS_HEIGHT, canvasModule);
    staticBoardCtx = get2dContext(staticBoardCanvas, false);
    staticChalkCanvas = createOffscreenCanvas(CANVAS_WIDTH, CANVAS_HEIGHT, canvasModule);
    staticChalkCtx = get2dContext(staticChalkCanvas, true);
    dynamicChalkCanvas = createOffscreenCanvas(CANVAS_WIDTH, CANVAS_HEIGHT, canvasModule);
    dynamicChalkCtx = get2dContext(dynamicChalkCanvas, true);
    slateGrainMaskCanvas = createOffscreenCanvas(512, 512, canvasModule);
  } catch {
    boardCanvas = { width: CANVAS_WIDTH, height: CANVAS_HEIGHT, getContext: () => null };
    boardCtx = null;
  }
}

if (boardCanvas && typeof THREE.CanvasTexture !== 'undefined') {
  boardTexture = new THREE.CanvasTexture(boardCanvas);
  boardTexture.generateMipmaps = false;
  boardTexture.minFilter = THREE.LinearFilter;
  boardTexture.magFilter = THREE.LinearFilter;
  boardTexture.anisotropy = 8;
  boardTexture.colorSpace = THREE.SRGBColorSpace;
}

if (staticBoardCanvas && typeof THREE.CanvasTexture !== 'undefined') {
  staticBoardTexture = new THREE.CanvasTexture(staticBoardCanvas);
  staticBoardTexture.generateMipmaps = true;
  staticBoardTexture.minFilter = THREE.LinearMipmapLinearFilter;
  staticBoardTexture.magFilter = THREE.LinearFilter;
  staticBoardTexture.anisotropy = 8;
  staticBoardTexture.colorSpace = THREE.SRGBColorSpace;
}

if (dynamicChalkCanvas && typeof THREE.CanvasTexture !== 'undefined') {
  dynamicChalkTexture = new THREE.CanvasTexture(dynamicChalkCanvas);
  dynamicChalkTexture.generateMipmaps = false;
  dynamicChalkTexture.minFilter = THREE.LinearFilter;
  dynamicChalkTexture.magFilter = THREE.LinearFilter;
}

// ============================================================================
// 3. DIEGETIC UI STATE & LAYOUT GEOMETRY
// ============================================================================

export const boardState = {
  currentLevel: 1, // 1: Ném Xiên, 2: Kepler, 3: Hố Đen
  angle: 45.0,     // Launch angle in degrees [15, 80]
  velocity: 45.0,  // Launch velocity in m/s [15, 95]
  isAiming: false,
  isDraggingSlider: false,
  isDraggingProtractor: false,
  isDraggingGunnyAim: false,
  isFiring: false,
  hideProtractor: false,
  isBoardCleaned: false,
  hoveredElement: null,

  // Real-time telemetry data passed from physics engine
  telemetry: {
    range: 0,
    theoreticalRange: 196.2,
    curvature: 0,
    currentSpeed: 45.0,
    flightTime: 0,
    altitude: 0,
    slingshotAngle: 0,
    schwarzschildRadius: 55,
    hawkingTemp: '1.23 × 10⁻⁸ K',
    statusText: 'Sẵn sàng phóng'
  },

  // Target and obstacle layouts per level
  target: { x: 1720, y: 580, radius: 46, hit: false },
  obstacles: []
};

// UI Element bounding geometry on 3886x1086 canvas
export const UI_LAYOUT = {
  // Level selection tabs (Off-board coordinates to prevent drawing/interaction)
  tabs: [
    { id: 'tab1', level: 1, text: '1: NÉM XIÊN', title: 'Bài 1: Ném Xiên', label: 'Bài 1: Ném Xiên', x: 2920, y: 24, w: 196, h: 46 },
    { id: 'tab2', level: 2, text: '2: KEPLER', title: 'Bài 2: Kepler', label: 'Bài 2: Kepler', x: 3230, y: 24, w: 196, h: 46 },
    { id: 'tab3', level: 3, text: '3: HỐ ĐEN', title: 'Bài 3: Hố Đen', label: 'Bài 3: Hố Đen', x: 3530, y: 24, w: 196, h: 46 }
  ],

  // Protractor arc control (at launcher origin matching gameplayController)
  protractor: {
    cx: 200,
    cy: 635,
    radius: 90,
    minAngle: 15,
    maxAngle: 80,
    handleRadius: 18
  },

  // Velocity slider control (Bottom-Center-Left)
  slider: {
    x1: 370,
    x2: 680,
    y: 955,
    minVal: 15,
    maxVal: 95,
    handleWidth: 26,
    handleHeight: 46
  },

  // Action buttons (Bottom-Center-Right)
  buttons: [
    { id: 'btnFire', text: 'Phóng Phấn', subtext: '[SPACE]', x: 730, y: 922, w: 260, h: 66, primary: true },
    { id: 'btnReset', text: 'Làm Lại', subtext: '[R]', x: 1020, y: 922, w: 180, h: 66, primary: false },
    { id: 'btnLetter', text: 'Xem Thư 20/11', subtext: '✉', x: 1230, y: 922, w: 220, h: 66, primary: false }
  ]
};

// Callbacks registered by gameplay controller and scene orchestrator
const eventListeners = {
  launch: [],
  reset: [],
  levelSelect: [],
  letterOpen: [],
  paramChange: []
};

export function onLaunch(cb) { if (typeof cb === 'function') eventListeners.launch.push(cb); }
export function onReset(cb) { if (typeof cb === 'function') eventListeners.reset.push(cb); }
export function onLevelSelect(cb) { if (typeof cb === 'function') eventListeners.levelSelect.push(cb); }
export function onLetterOpen(cb) { if (typeof cb === 'function') eventListeners.letterOpen.push(cb); }
export function onParamChange(cb) { if (typeof cb === 'function') eventListeners.paramChange.push(cb); }

// ============================================================================
// 4. PROCEDURAL SLATE TEXTURE GENERATOR (CACHED)
// ============================================================================

function deterministicHash(n) {
  const s = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
  return s - Math.floor(s);
}

function ensureSlateGrainMask() {
  if (!slateGrainMaskCanvas) return null;
  if (slateGrainMaskCanvas._ready) return slateGrainMaskCanvas;
  const gCtx = slateGrainMaskCanvas.getContext('2d');
  if (!gCtx || typeof gCtx.createImageData !== 'function') return null;

  const w = slateGrainMaskCanvas.width;
  const h = slateGrainMaskCanvas.height;
  const imgData = gCtx.createImageData(w, h);
  const buf = new Uint32Array(imgData.data.buffer);
  buf.fill(0); // transparent black

  for (let i = 0; i < 16000; i++) {
    const x = Math.floor(deterministicHash(i * 5 + 1) * (w - 1));
    const y = Math.floor(deterministicHash(i * 5 + 2) * (h - 1));
    const a = Math.floor((0.25 + deterministicHash(i * 5 + 4) * 0.75) * 255);
    const pixel = (a << 24);
    buf[y * w + x] = pixel;
    if (x + 1 < w) buf[y * w + x + 1] = pixel;
  }
  for (let s = 0; s < 140; s++) {
    const sx = Math.floor(deterministicHash(s * 7 + 11) * (w - 1));
    const sy = Math.floor(deterministicHash(s * 7 + 12) * (h - 1));
    const len = Math.floor(8 + deterministicHash(s * 7 + 13) * 26);
    const a = Math.floor((0.25 + deterministicHash(s * 7 + 15) * 0.35) * 255);
    const pixel = (a << 24);
    for (let k = 0; k < len; k++) {
      const px = sx + k;
      if (px >= w) break;
      buf[sy * w + px] = pixel;
    }
  }
  gCtx.putImageData(imgData, 0, 0);
  slateGrainMaskCanvas._ready = true;
  return slateGrainMaskCanvas;
}

function applyChalkGrainPorosity(ctx, strength = 0.12) {
  const mask = ensureSlateGrainMask();
  if (!ctx || !mask) return;
  ctx.save();
  ctx.globalCompositeOperation = 'destination-out';
  ctx.globalAlpha = strength;
  if (!cachedGrainPattern && typeof ctx.createPattern === 'function') {
    cachedGrainPattern = ctx.createPattern(mask, 'repeat');
  }
  if (cachedGrainPattern) {
    ctx.fillStyle = cachedGrainPattern;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  } else {
    for (let x = 0; x < CANVAS_WIDTH; x += mask.width) {
      for (let y = 0; y < CANVAS_HEIGHT; y += mask.height) {
        ctx.drawImage(mask, x, y);
      }
    }
  }
  ctx.restore();
}

function createSlateSurfaceMaps() {
  if (typeof document === 'undefined') return { roughnessMap: null, bumpMap: null };

  const w = 1024;
  const h = 512;

  const rCanvas = document.createElement('canvas');
  if (!rCanvas || !rCanvas.getContext) return { roughnessMap: null, bumpMap: null };
  rCanvas.width = w;
  rCanvas.height = h;
  const rCtx = rCanvas.getContext('2d');
  if (!rCtx || typeof rCtx.createImageData !== 'function') return { roughnessMap: null, bumpMap: null };

  const rData = rCtx.createImageData(w, h);
  const rBuf = new Uint32Array(rData.data.buffer);
  rBuf.fill(0xffdcdcdc);

  // Giữ nền rBuf.fill(0xffdcdcdc) đồng đều có nhiễu hạt rất nhỏ (bỏ 24 khối elip to gây đốm loang)
  for (let i = 0; i < 8000; i++) {
    const rx = Math.floor(deterministicHash(i * 3 + 1) * (w - 1));
    const ry = Math.floor(deterministicHash(i * 3 + 2) * (h - 1));
    const noise = Math.floor(215 + deterministicHash(i * 3 + 3) * 12);
    rBuf[ry * w + rx] = (0xff << 24) | (noise << 16) | (noise << 8) | noise;
  }
  rCtx.putImageData(rData, 0, 0);

  const bCanvas = document.createElement('canvas');
  if (!bCanvas || !bCanvas.getContext) return { roughnessMap: null, bumpMap: null };
  bCanvas.width = 512;
  bCanvas.height = 512;
  const bCtx = bCanvas.getContext('2d');
  if (!bCtx || typeof bCtx.createImageData !== 'function') return { roughnessMap: null, bumpMap: null };

  const bData = bCtx.createImageData(512, 512);
  const bBuf = new Uint32Array(bData.data.buffer);
  bBuf.fill(0xff808080);
  for (let i = 0; i < 18000; i++) {
    const bx = Math.floor(deterministicHash(i * 3 + 1) * 511);
    const by = Math.floor(deterministicHash(i * 3 + 2) * 511);
    const bv = Math.floor(105 + deterministicHash(i * 3 + 3) * 46);
    bBuf[by * 512 + bx] = (0xff << 24) | (bv << 16) | (bv << 8) | bv;
  }
  bCtx.putImageData(bData, 0, 0);

  const roughnessMap = new THREE.CanvasTexture(rCanvas);
  roughnessMap.minFilter = THREE.LinearMipmapLinearFilter;
  roughnessMap.generateMipmaps = true;

  const bumpMap = new THREE.CanvasTexture(bCanvas);
  bumpMap.wrapS = THREE.RepeatWrapping;
  bumpMap.wrapT = THREE.RepeatWrapping;
  bumpMap.repeat.set(4, 2);

  return { roughnessMap, bumpMap };
}

export function generateSlateBackground(canvas, ctx) {
  if (!canvas || !ctx) return;
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);

  const baseGrad = ctx.createLinearGradient(0, 0, 0, h);
  baseGrad.addColorStop(0.0, '#1d4532');
  baseGrad.addColorStop(0.5, '#173828');
  baseGrad.addColorStop(1.0, '#122c1f');
  ctx.fillStyle = baseGrad;
  ctx.fillRect(0, 0, w, h);

  const borderVig = ctx.createRadialGradient(w * 0.5, h * 0.5, w * 0.25, w * 0.5, h * 0.5, w * 0.62);
  borderVig.addColorStop(0.0, 'rgba(0, 0, 0, 0.0)');
  borderVig.addColorStop(1.0, 'rgba(4, 10, 8, 0.42)');
  ctx.fillStyle = borderVig;
  ctx.fillRect(0, 0, w, h);

  ctx.save();
  for (let i = 0; i < 20; i++) {
    const rx = w * 0.10 + deterministicHash(i * 7 + 1) * w * 0.80;
    const ry = h * 0.14 + deterministicHash(i * 7 + 2) * h * 0.72;
    const radius = 110 + deterministicHash(i * 7 + 3) * 190;
    const cloudGrad = ctx.createRadialGradient(rx, ry, radius * 0.12, rx, ry, radius);
    cloudGrad.addColorStop(0.0, 'rgba(225, 240, 232, 0.012)');
    cloudGrad.addColorStop(0.55, 'rgba(215, 232, 224, 0.005)');
    cloudGrad.addColorStop(1.0, 'rgba(215, 232, 224, 0.0)');
    ctx.fillStyle = cloudGrad;
    ctx.beginPath();
    ctx.arc(rx, ry, radius, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  ctx.save();
  ctx.font = 'italic 30px "Caveat", "Patrick Hand", serif';
  ctx.fillStyle = 'rgba(235, 244, 238, 0.015)';
  const ghostNotes = [
    { text: 'L = T - V', x: 1180, y: 210, rot: -0.02 },
    { text: 'd/dt (∂L/∂q̇) - ∂L/∂q = 0', x: 1120, y: 265, rot: 0.01 },
    { text: '∮ E · dA = Q/ε₀', x: 640, y: 515, rot: -0.015 },
    { text: 'ΔS ≥ 0', x: 1460, y: 420, rot: 0.02 }
  ];
  ghostNotes.forEach(note => {
    ctx.save();
    ctx.translate(note.x, note.y);
    ctx.rotate(note.rot);
    ctx.fillText(note.text, 0, 0);
    ctx.restore();
  });

  for (let s = 0; s < 14; s++) {
    const cx = w * 0.15 + deterministicHash(s * 11 + 1) * (w * 0.72);
    const cy = h * 0.18 + deterministicHash(s * 11 + 2) * (h * 0.64);
    const rx = 70 + deterministicHash(s * 11 + 3) * 95;
    const angle = (deterministicHash(s * 11 + 4) - 0.5) * 0.24;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle);
    ctx.scale(3.4, 0.34);
    const wipeGrad = ctx.createRadialGradient(0, 0, rx * 0.1, 0, 0, rx);
    wipeGrad.addColorStop(0.0, 'rgba(232, 242, 236, 0.020)');
    wipeGrad.addColorStop(0.5, 'rgba(230, 240, 234, 0.008)');
    wipeGrad.addColorStop(1.0, 'rgba(230, 240, 234, 0.0)');
    ctx.fillStyle = wipeGrad;
    ctx.beginPath();
    ctx.arc(0, 0, rx, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();

  ctx.save();
  const railGrad = ctx.createLinearGradient(0, h - 46, 0, h);
  railGrad.addColorStop(0.0, 'rgba(245, 242, 230, 0.0)');
  railGrad.addColorStop(0.7, 'rgba(245, 242, 230, 0.045)');
  railGrad.addColorStop(1.0, 'rgba(245, 242, 230, 0.095)');
  ctx.fillStyle = railGrad;
  ctx.fillRect(0, h - 46, w, 46);

  ctx.fillStyle = 'rgba(242, 240, 232, 0.025)';
  for (let d = 0; d < 120; d++) {
    const gx = deterministicHash(d * 13 + 1) * w;
    const gy = (h - 32) + deterministicHash(d * 13 + 2) * 32;
    const gsz = 1 + deterministicHash(d * 13 + 3) * 1.8;
    ctx.fillRect(gx, gy, gsz, gsz);
  }
  ctx.restore();
}

export function ensureSlateBackground() {
  if (!isSlateBgReady && slateBgCanvas) {
    const sCtx = slateBgCanvas.getContext('2d');
    if (sCtx) {
      generateSlateBackground(slateBgCanvas, sCtx);
      isSlateBgReady = true;
    }
  }
}

export function drawRealisticChalkLine(ctx, x1, y1, x2, y2, color = CHALK_COLORS.WHITE, thickness = 3) {
  const dist = Math.hypot(x2 - x1, y2 - y1);
  const steps = Math.max(2, Math.floor(dist / 3.0));
  const seedOffset = Math.round(x1 * 0.37 + y1 * 0.73);
  ctx.save();

  if (typeof ctx.beginPath === 'function' && typeof ctx.stroke === 'function') {
    ctx.strokeStyle = color;
    ctx.lineWidth = thickness * 1.8;
    ctx.globalAlpha = 0.12;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }

  ctx.fillStyle = color;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const jx = (deterministicHash(seedOffset + i * 3 + 1) - 0.5) * 1.4;
    const jy = (deterministicHash(seedOffset + i * 3 + 2) - 0.5) * 1.4;
    const x = x1 + (x2 - x1) * t + jx;
    const y = y1 + (y2 - y1) * t + jy;
    const h3 = deterministicHash(seedOffset + i * 3 + 3);
    ctx.globalAlpha = 0.32 + h3 * 0.56;
    const sz = thickness * (0.6 + h3 * 0.5);
    if (typeof ctx.fillRect === 'function') {
      ctx.fillRect(x - sz * 0.5, y - sz * 0.5, sz, sz);
    }
  }
  ctx.restore();
}

export function drawRealisticChalkArc(ctx, cx, cy, radius, startAngle, endAngle, color = CHALK_COLORS.WHITE, thickness = 2.5) {
  const span = Math.abs(endAngle - startAngle);
  const arcLength = radius * span;
  const steps = Math.max(2, Math.floor(arcLength / 3.0));
  const seedOffset = Math.round(cx * 0.29 + cy * 0.53);
  ctx.save();

  if (typeof ctx.beginPath === 'function' && typeof ctx.stroke === 'function') {
    ctx.strokeStyle = color;
    ctx.lineWidth = thickness * 1.8;
    ctx.globalAlpha = 0.12;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, startAngle, endAngle);
    ctx.stroke();
  }

  ctx.fillStyle = color;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const a = startAngle + (endAngle - startAngle) * t;
    const jr = (deterministicHash(seedOffset + i * 5 + 1) - 0.5) * 1.3;
    const r = radius + jr;
    const x = cx + Math.cos(a) * r;
    const y = cy + Math.sin(a) * r;
    const h2 = deterministicHash(seedOffset + i * 5 + 2);
    ctx.globalAlpha = 0.32 + h2 * 0.54;
    const sz = thickness * (0.6 + h2 * 0.5);
    if (typeof ctx.fillRect === 'function') {
      ctx.fillRect(x - sz * 0.5, y - sz * 0.5, sz, sz);
    }
  }
  ctx.restore();
}

export function drawChalkLine(ctx, x1, y1, x2, y2, options = {}) {
  const { color = CHALK_COLORS.WHITE, width = 3, dashes = [] } = options;
  if (dashes.length === 0) {
    drawRealisticChalkLine(ctx, x1, y1, x2, y2, color, width);
    return;
  }
  const dx = x2 - x1;
  const dy = y2 - y1;
  const dist = Math.hypot(dx, dy);
  const dashLen = dashes[0] || 8;
  const gapLen = dashes[1] || dashLen;
  const totalSeg = dashLen + gapLen;
  let traveled = 0;
  while (traveled < dist) {
    const tStart = traveled / dist;
    const tEnd = Math.min(1.0, (traveled + dashLen) / dist);
    drawRealisticChalkLine(ctx, x1 + dx * tStart, y1 + dy * tStart, x1 + dx * tEnd, y1 + dy * tEnd, color, width);
    traveled += totalSeg;
  }
}

export function drawChalkRect(ctx, x, y, w, h, options = {}) {
  const { color = CHALK_COLORS.WHITE, width = 2.5, fill = null, doubleBorder = false, hovered = false } = options;
  ctx.save();
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fillRect(x, y, w, h);
  }
  const effectiveColor = hovered ? CHALK_COLORS.YELLOW : color;
  const effectiveThickness = hovered ? width + 0.8 : width;
  const overshoot = 4.5 + deterministicHash(Math.round(x + y)) * 2.5;

  drawRealisticChalkLine(ctx, x - overshoot, y, x + w + overshoot, y, effectiveColor, effectiveThickness);
  drawRealisticChalkLine(ctx, x + w, y - overshoot, x + w, y + h + overshoot, effectiveColor, effectiveThickness);
  drawRealisticChalkLine(ctx, x + w + overshoot, y + h, x - overshoot, y + h, effectiveColor, effectiveThickness);
  drawRealisticChalkLine(ctx, x, y + h + overshoot, x, y - overshoot, effectiveColor, effectiveThickness);

  if (doubleBorder) {
    const inset = 4;
    const t = Math.max(1.5, effectiveThickness * 0.7);
    drawRealisticChalkLine(ctx, x + inset, y + inset, x + w - inset, y + inset, effectiveColor, t);
    drawRealisticChalkLine(ctx, x + w - inset, y + inset, x + w - inset, y + h - inset, effectiveColor, t);
    drawRealisticChalkLine(ctx, x + w - inset, y + h - inset, x + inset, y + h - inset, effectiveColor, t);
    drawRealisticChalkLine(ctx, x + inset, y + h - inset, x + inset, y + inset, effectiveColor, t);
  }
  ctx.restore();
}

export function drawChalkText(ctx, text, x, y, options = {}) {
  const {
    font = '28px "Caveat", "Plus Jakarta Sans", cursive, sans-serif',
    color = CHALK_COLORS.WHITE,
    align = 'left',
    baseline = 'middle',
    alpha = 0.94,
    glow = false
  } = options;

  ctx.save();
  ctx.font = font;
  ctx.textAlign = align;
  ctx.textBaseline = baseline;
  ctx.fillStyle = color;
  ctx.globalAlpha = alpha;
  ctx.fillText(text, x, y);

  if (glow) {
    const jx = (deterministicHash(Math.round(x * 3 + y)) - 0.5) * 0.9;
    const jy = (deterministicHash(Math.round(x + y * 5)) - 0.5) * 0.9;
    ctx.globalAlpha = alpha * 0.35;
    ctx.fillText(text, x + jx, y + jy);
  }
  ctx.restore();
}

// ============================================================================
// 6. DIEGETIC UI RENDERING COMPONENTS
// ============================================================================

/**
 * Renders the top title banner & level tabs (zero intro spam).
 */
function renderHeader(ctx) {
  // Level tabs: [Bài 1: Ném Xiên], [Bài 2: Kepler], [Bài 3: Hố Đen] (Top-Right)
  for (const tab of UI_LAYOUT.tabs) {
    const isActive = boardState.currentLevel === tab.level;
    const isHovered = boardState.hoveredElement === tab.id;
    const tabLabel = tab.label || tab.title || tab.text;

    drawChalkRect(ctx, tab.x, tab.y, tab.w, tab.h, {
      color: isActive ? CHALK_COLORS.YELLOW : CHALK_COLORS.WHITE,
      fill: isActive ? 'rgba(248, 230, 160, 0.16)' : (isHovered ? 'rgba(240, 243, 240, 0.08)' : null),
      doubleBorder: isActive,
      hovered: isHovered,
      width: isActive ? 3 : 2
    });

    drawChalkText(ctx, tabLabel, tab.x + tab.w / 2, tab.y + tab.h / 2, {
      font: `bold ${isActive ? '22px' : '20px'} "Plus Jakarta Sans", sans-serif`,
      color: isActive ? CHALK_COLORS.YELLOW : (isHovered ? CHALK_COLORS.YELLOW : 'rgba(240, 243, 240, 0.85)'),
      align: 'center',
      glow: isActive
    });
  }

  // Divider chalk line across header
  drawRealisticChalkLine(ctx, 40, 108, CANVAS_WIDTH - 40, 108, 'rgba(240, 243, 240, 0.35)', 2);
}

/**
 * Renders the curated, formatted physics lecture formulas for the current Level.
 * Uses ChalkRenderer with real horizontal fraction lines, vector arrows, and sub/superscripts.
 * Zero raw ASCII strings or fillText formulas.
 */
function renderTelemetryPanel(ctx) {
  ensureSlateBackground();
  if (slateBgCanvas) {
    ctx.drawImage(slateBgCanvas, 0, 0);
  }
}

function renderProtractor(ctx) {
  const { cx, cy, radius } = UI_LAYOUT.protractor;
  ctx.save();

  drawRealisticChalkLine(ctx, cx - 14, cy, cx + 14, cy, 'rgba(240, 243, 240, 0.8)', 2.2);
  drawRealisticChalkLine(ctx, cx, cy - 14, cx, cy + 14, 'rgba(240, 243, 240, 0.8)', 2.2);

  if (boardState.isDraggingGunnyAim) {
    const activeRad = -(boardState.angle * Math.PI / 180);
    const dashStep = 0.085;
    for (let a = activeRad; a < 0; a += dashStep * 1.8) {
      drawRealisticChalkArc(ctx, cx, cy, radius, a, Math.min(0, a + dashStep), CHALK_COLORS.YELLOW, 2.4);
    }
    drawChalkLine(
      ctx, cx, cy,
      cx + Math.cos(activeRad) * (radius + 20),
      cy + Math.sin(activeRad) * (radius + 20),
      { color: CHALK_COLORS.YELLOW, width: 2.4, dashes: [8, 6] }
    );

    drawChalkText(
      ctx,
      `α = ${boardState.angle.toFixed(0)}° | v₀ = ${boardState.velocity.toFixed(0)} m/s`,
      cx + 28, cy - radius - 22,
      { font: '34px "Patrick Hand", cursive', color: CHALK_COLORS.YELLOW, align: 'left' }
    );
  }

  ctx.restore();
}

/**
 * Renders the Sketched Chalk Velocity Slider with Chalk Stick Cursor.
 * Uses realistic chalk lines and stippling.
 */
function renderSpeedSlider(ctx) {
  const { x1, x2, y, minVal, maxVal, handleWidth, handleHeight } = UI_LAYOUT.slider;
  const val = boardState.velocity;
  const isHovered = boardState.hoveredElement === 'slider';
  const isDragging = boardState.isDraggingSlider;

  ctx.save();

  // Slider title
  drawChalkText(ctx, 'VẬN TỐC ĐẦU v₀:', x1, y - 48, {
    font: 'bold 18px "Plus Jakarta Sans", sans-serif',
    color: CHALK_COLORS.WHITE,
    alpha: 0.9
  });

  drawChalkText(ctx, `v₀ = ${val.toFixed(1)} m/s`, x2, y - 48, {
    font: 'bold 22px "Caveat", cursive',
    color: CHALK_COLORS.YELLOW,
    align: 'right',
    glow: true
  });

  // Ruler track using realistic chalk line
  drawRealisticChalkLine(ctx, x1, y, x2, y, isHovered || isDragging ? CHALK_COLORS.YELLOW : CHALK_COLORS.WHITE, 3.5);

  // Graduation marks along slider
  const numTicks = 8;
  for (let i = 0; i <= numTicks; i++) {
    const t = i / numTicks;
    const tx = x1 + (x2 - x1) * t;
    const tickH = i % 2 === 0 ? 14 : 8;
    drawRealisticChalkLine(ctx, tx, y - tickH, tx, y + tickH, CHALK_COLORS.WHITE, 1.8);

    if (i % 2 === 0) {
      const markVal = (minVal + (maxVal - minVal) * t).toFixed(0);
      drawChalkText(ctx, `${markVal}`, tx, y + 24, {
        font: '13px "Plus Jakarta Sans", sans-serif',
        color: 'rgba(240, 243, 240, 0.65)',
        align: 'center'
      });
    }
  }

  // Thumb position
  const norm = (val - minVal) / (maxVal - minVal);
  const thumbX = x1 + (x2 - x1) * norm;

  // Render Thumb as a 3D-styled Chalk Stick
  ctx.save();
  ctx.translate(thumbX, y);

  // Soft drop shadow
  ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
  ctx.beginPath();
  ctx.ellipse(3, 4, handleWidth / 1.8, handleHeight / 1.8, 0.1, 0, Math.PI * 2);
  ctx.fill();

  // Chalk stick cylinder body with authentic vintage chalk gradient
  const chalkGrad = ctx.createLinearGradient(-handleWidth / 2, 0, handleWidth / 2, 0);
  chalkGrad.addColorStop(0.0, isHovered || isDragging ? 'rgba(248, 230, 160, 0.95)' : 'rgba(240, 243, 240, 0.92)');
  chalkGrad.addColorStop(0.5, isHovered || isDragging ? 'rgba(248, 230, 160, 0.88)' : 'rgba(240, 243, 240, 0.98)');
  chalkGrad.addColorStop(1.0, isHovered || isDragging ? 'rgba(235, 180, 80, 0.88)' : 'rgba(215, 225, 220, 0.9)');

  ctx.fillStyle = chalkGrad;
  ctx.beginPath();
  ctx.roundRect(-handleWidth / 2, -handleHeight / 2, handleWidth, handleHeight, 5);
  ctx.fill();

  // Chalk stick outline
  ctx.strokeStyle = isHovered || isDragging ? CHALK_COLORS.GOLD : 'rgba(15, 28, 22, 0.7)';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Subtle grip grooves on chalk stick
  ctx.strokeStyle = 'rgba(100, 116, 139, 0.5)';
  ctx.lineWidth = 1.5;
  for (let g = -10; g <= 10; g += 10) {
    ctx.beginPath();
    ctx.moveTo(-handleWidth / 2 + 4, g);
    ctx.lineTo(handleWidth / 2 - 4, g);
    ctx.stroke();
  }

  ctx.restore();

  ctx.restore();
}

/**
 * Renders the Action Buttons: [ Phóng Phấn ], [ Làm Lại ], [ Xem Thư 20/11 ].
 * Borders hand-sketched with realistic chalk lines, on hover highlighted with soft chalk yellow (no sci-fi neon glow).
 */
function renderActionButtons(ctx) {
  for (const btn of UI_LAYOUT.buttons) {
    const isHovered = boardState.hoveredElement === btn.id;

    let fillColor = null;
    if (btn.primary) {
      fillColor = isHovered ? 'rgba(248, 230, 160, 0.22)' : 'rgba(248, 230, 160, 0.10)';
    } else {
      fillColor = isHovered ? 'rgba(240, 243, 240, 0.12)' : 'rgba(21, 38, 31, 0.65)';
    }

    drawChalkRect(ctx, btn.x, btn.y, btn.w, btn.h, {
      color: btn.primary ? CHALK_COLORS.YELLOW : CHALK_COLORS.WHITE,
      fill: fillColor,
      doubleBorder: btn.primary,
      hovered: isHovered,
      width: btn.primary ? 3.0 : 2.2
    });

    // Main text
    drawChalkText(ctx, btn.text, btn.x + btn.w / 2, btn.y + btn.h / 2 - (btn.subtext ? 6 : 0), {
      font: `bold ${btn.primary ? '22px' : '20px'} "Plus Jakarta Sans", sans-serif`,
      color: btn.primary ? CHALK_COLORS.YELLOW : (isHovered ? CHALK_COLORS.YELLOW : CHALK_COLORS.WHITE),
      align: 'center',
      glow: btn.primary || isHovered
    });

    // Shortcut / subtext
    if (btn.subtext) {
      drawChalkText(ctx, btn.subtext, btn.x + btn.w / 2, btn.y + btn.h / 2 + 16, {
        font: '13px "Plus Jakarta Sans", sans-serif',
        color: btn.primary ? CHALK_COLORS.AMBER : 'rgba(240, 243, 240, 0.6)',
        align: 'center'
      });
    }
  }
}

/**
 * Renders the target bullseye and level obstacles.
 */
function renderTargetAndObstacles(ctx) {
  const { target } = boardState;

  ctx.save();

  // 1. Draw Target Bullseye
  const concentricRings = [target.radius, target.radius * 0.66, target.radius * 0.33];
  concentricRings.forEach((r, idx) => {
    ctx.strokeStyle = target.hit ? CHALK_COLORS.YELLOW : (idx === 0 ? CHALK_COLORS.WHITE : (idx === 1 ? CHALK_COLORS.CYAN : CHALK_COLORS.RED));
    ctx.lineWidth = idx === 0 ? 3 : 2;
    if (idx === 1) ctx.setLineDash([6, 6]);
    else ctx.setLineDash([]);

    ctx.beginPath();
    ctx.arc(target.x, target.y, r, 0, Math.PI * 2);
    ctx.stroke();
  });

  // Target Crosshairs with realistic chalk lines
  drawRealisticChalkLine(ctx, target.x - target.radius - 12, target.y, target.x + target.radius + 12, target.y, target.hit ? CHALK_COLORS.YELLOW : CHALK_COLORS.RED, 2);
  drawRealisticChalkLine(ctx, target.x, target.y - target.radius - 12, target.x, target.y + target.radius + 12, target.hit ? CHALK_COLORS.YELLOW : CHALK_COLORS.RED, 2);

  // Label above target
  drawChalkText(ctx, target.hit ? 'TRÚNG ĐÍCH! ★' : 'MỤC TIÊU', target.x, target.y - target.radius - 22, {
    font: 'bold 18px "Caveat", cursive',
    color: target.hit ? CHALK_COLORS.YELLOW : CHALK_COLORS.RED,
    align: 'center',
    glow: target.hit
  });

  // 2. Level 2: Planetary gravitational well / Slingshot obstacle
  if (boardState.currentLevel === 2) {
    const planetX = 920;
    const planetY = 580;
    const planetRadius = 75;

    // Gravitational field equipotential rings
    ctx.strokeStyle = 'rgba(165, 214, 195, 0.3)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([8, 8]);
    for (let pr = planetRadius + 30; pr <= planetRadius + 140; pr += 35) {
      ctx.beginPath();
      ctx.arc(planetX, planetY, pr, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    // Planet body
    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    ctx.arc(planetX, planetY, planetRadius, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = CHALK_COLORS.CYAN;
    ctx.lineWidth = 3;
    ctx.stroke();

    drawChalkText(ctx, 'HÀNH TINH (M)', planetX, planetY - 10, {
      font: 'bold 17px "Plus Jakarta Sans", sans-serif',
      color: CHALK_COLORS.CYAN,
      align: 'center'
    });
    drawChalkText(ctx, 'Giếng thế U(r)', planetX, planetY + 14, {
      font: '14px "Caveat", cursive',
      color: CHALK_COLORS.WHITE,
      align: 'center',
      alpha: 0.8
    });

    // Barrier / Wall blocking direct straight aim
    const wallX = 1350;
    const wallY = 430;
    const wallH = 260;
    drawChalkRect(ctx, wallX - 12, wallY, 24, wallH, {
      color: CHALK_COLORS.RED,
      fill: 'rgba(235, 155, 155, 0.18)',
      width: 2.5
    });
    drawChalkText(ctx, 'CHƯỚNG NGẠI VẬT', wallX, wallY - 18, {
      font: 'bold 16px "Plus Jakarta Sans", sans-serif',
      color: CHALK_COLORS.RED,
      align: 'center'
    });
  }

  // 3. Level 3: Relativistic Schwarzschild Black Hole
  if (boardState.currentLevel === 3) {
    const bhX = 1024;
    const bhY = 543;
    const rs = 55; // Event horizon radius

    // Accretion disk halo
    const diskGrad = ctx.createRadialGradient(bhX, bhY, rs, bhX, bhY, rs * 2.8);
    diskGrad.addColorStop(0.0, 'rgba(248, 230, 160, 0.40)');
    diskGrad.addColorStop(0.4, 'rgba(235, 180, 80, 0.22)');
    diskGrad.addColorStop(1.0, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = diskGrad;
    ctx.beginPath();
    ctx.arc(bhX, bhY, rs * 2.8, 0, Math.PI * 2);
    ctx.fill();

    // Photon Sphere (r = 1.5 rs)
    ctx.strokeStyle = CHALK_COLORS.AMBER;
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.arc(bhX, bhY, rs * 1.5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // Event Horizon (Black Void)
    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.arc(bhX, bhY, rs, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = CHALK_COLORS.RED;
    ctx.lineWidth = 3.5;
    ctx.stroke();

    drawChalkText(ctx, 'HỐ ĐEN (r ≤ rs)', bhX, bhY - 8, {
      font: 'bold 18px "Plus Jakarta Sans", sans-serif',
      color: CHALK_COLORS.WHITE,
      align: 'center'
    });
    drawChalkText(ctx, 'Chân trời sự kiện', bhX, bhY + 14, {
      font: '14px "Caveat", cursive',
      color: CHALK_COLORS.AMBER,
      align: 'center'
    });
  }

  ctx.restore();
}

// ============================================================================
// 7. BOARD UPDATE & RENDER LOOP
// ============================================================================

// External gameplay renderer hook
let externalGameplayRenderer = null;
export function setGameplayRenderer(fn) {
  externalGameplayRenderer = typeof fn === 'function' ? fn : null;
}

/**
 * Redraws the complete diegetic chalkboard UI and flushes to boardTexture.
 */
export function updateBoard() {
  if (!boardCanvas || !boardCtx) return;

  ensureSlateBackground();

  // If the board has been cleaned, ensure nothing is drawn on the blackboard
  if (boardState.isBoardCleaned) {
    if (staticBoardCanvas && staticBoardCtx) {
      staticBoardCtx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      if (isSlateBgReady && slateBgCanvas) {
        staticBoardCtx.drawImage(slateBgCanvas, 0, 0);
      }
      if (staticBoardTexture) staticBoardTexture.needsUpdate = true;
    }
    if (dynamicChalkCanvas && dynamicChalkCtx) {
      dynamicChalkCtx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      if (dynamicChalkTexture) dynamicChalkTexture.needsUpdate = true;
    }
    if (boardCtx) {
      boardCtx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      if (isSlateBgReady && slateBgCanvas) {
        boardCtx.drawImage(slateBgCanvas, 0, 0);
      }
      if (boardTexture) boardTexture.needsUpdate = true;
    }
    return;
  }

  const hasGpuDualLayer = !!(writingPlaneMesh?.material?.userData?.hasGpuDualLayer);
  const isHeadless = typeof document === 'undefined' || !hasGpuDualLayer;

  if (isStaticDirty) {
    if (staticBoardCanvas && staticBoardCtx) {
      staticBoardCtx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      renderTelemetryPanel(staticBoardCtx);
    }
    if (staticBoardTexture) {
      staticBoardTexture.needsUpdate = true;
    }
    isStaticDirty = false;
  }

  const isDynamicActive = !!externalGameplayRenderer ||
    boardState.isDraggingGunnyAim ||
    boardState.isDraggingProtractor ||
    boardState.isDraggingSlider;

  if (dynamicChalkCanvas && dynamicChalkCtx) {
    if (isDynamicActive || isHeadless) {
      dynamicChalkCtx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      if (externalGameplayRenderer) {
        try { externalGameplayRenderer(dynamicChalkCtx); } catch {}
      }
      if (!boardState.hideProtractor) {
        renderProtractor(dynamicChalkCtx);
      }
      if (dynamicChalkTexture) {
        dynamicChalkTexture.needsUpdate = true;
      }
      wasDynamicActive = true;
    } else if (wasDynamicActive) {
      dynamicChalkCtx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      if (dynamicChalkTexture) {
        dynamicChalkTexture.needsUpdate = true;
      }
      wasDynamicActive = false;
    }
  }

  // Composite fallback for headless tests or legacy boardTexture consumers
  if (isHeadless || !hasGpuDualLayer) {
    boardCtx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    if (staticBoardCanvas) {
      boardCtx.drawImage(staticBoardCanvas, 0, 0);
    } else if (isSlateBgReady && slateBgCanvas) {
      boardCtx.drawImage(slateBgCanvas, 0, 0);
    }

    if (dynamicChalkCanvas) {
      boardCtx.drawImage(dynamicChalkCanvas, 0, 0);
    } else {
      if (externalGameplayRenderer) {
        try { externalGameplayRenderer(boardCtx); } catch {}
      }
      if (!boardState.hideProtractor) {
        renderProtractor(boardCtx);
      }
    }

    if (boardTexture) {
      boardTexture.needsUpdate = true;
    }
  }
}

// ============================================================================
// 8. RAYCASTER SCREEN-TO-CANVAS MAPPING
// ============================================================================

const raycaster = new THREE.Raycaster();
const mouseNdc = new THREE.Vector2();

// Reference to attached 3D objects
let attachedBoardMesh = null;
let writingPlaneMesh = null;

/**
 * Converts screen coordinates (clientX, clientY) to exact board canvas coordinates.
 * Supports both writingPlaneMesh and original GLTF boardMesh.
 */
export function raycastToCanvas(clientX, clientY, camera, customMesh = null) {
  if (!camera) return { hit: false, x: 0, y: 0 };

  let rect = { left: 0, top: 0, width: 1920, height: 1080 };
  if (typeof document !== 'undefined') {
    const domCanvas = document.getElementById('webgl-canvas');
    if (domCanvas && domCanvas.getBoundingClientRect) {
      rect = domCanvas.getBoundingClientRect();
    } else if (typeof window !== 'undefined') {
      rect = { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight };
    }
  }

  mouseNdc.x = ((clientX - rect.left) / Math.max(1, rect.width)) * 2 - 1;
  mouseNdc.y = -((clientY - rect.top) / Math.max(1, rect.height)) * 2 + 1;

  raycaster.setFromCamera(mouseNdc, camera);

  // Targets: CHỈ nhắm writingPlaneMesh (hoặc customMesh).
  // KHÔNG đưa attachedBoardMesh vào targets vì attachedBoardMesh chứa cả bảng ghim nỉ (x > 178).
  const targets = [];
  if (writingPlaneMesh) {
    writingPlaneMesh.updateMatrixWorld(true);
    targets.push(writingPlaneMesh);
  }
  if (customMesh && customMesh !== writingPlaneMesh) {
    customMesh.updateMatrixWorld(true);
    targets.push(customMesh);
  }

  if (targets.length > 0) {
    const intersects = raycaster.intersectObjects(targets, false);
    if (intersects.length > 0) {
      const hit = intersects[0];
      if (hit.object === writingPlaneMesh && hit.uv) {
        return {
          hit: true,
          x: hit.uv.x * CANVAS_WIDTH,
          y: (1.0 - hit.uv.y) * CANVAS_HEIGHT,
          uv: hit.uv,
          point: hit.point,
          distance: hit.distance
        };
      }
    }
  }

  // Giao cắt với mặt phẳng bảng đen z = frontZ (479.46)
  // Vùng viết phấn hợp lệ: x in [-238, 178], y in [86, 239.5]
  const plane = new THREE.Plane(new THREE.Vector3(0, 0, -1), BOARD_WORLD.frontZ);
  const hitPoint = new THREE.Vector3();
  const hitPlane = raycaster.ray.intersectPlane(plane, hitPoint);

  if (hitPlane) {
    const writingWidth = BOARD_WORLD.writingWidth; // 416.0
    const halfW = writingWidth / 2;
    const minX = BOARD_WORLD.center.x - halfW; // -238.0
    const maxX = BOARD_WORLD.center.x + halfW; // 178.0
    const minY = BOARD_WORLD.min.y; // 86.0
    const maxY = BOARD_WORLD.max.y; // 239.5

    const u = 1.0 - (hitPoint.x - minX) / writingWidth;
    const v = (hitPoint.y - minY) / (maxY - minY);
    const canvasX = u * CANVAS_WIDTH;
    const canvasY = (1.0 - v) * CANVAS_HEIGHT;

    const isInsideWritingPlane = (
      hitPoint.x >= minX && hitPoint.x <= maxX &&
      hitPoint.y >= minY && hitPoint.y <= maxY
    );

    return {
      hit: isInsideWritingPlane,
      x: canvasX,
      y: canvasY,
      uv: new THREE.Vector2(u, v),
      point: hitPoint,
      distance: raycaster.ray.origin.distanceTo(hitPoint)
    };
  }

  return { hit: false, x: 0, y: 0 };
}

// ============================================================================
// 9. DIEGETIC POINTER & INTERACTION ENGINE
// ============================================================================

/**
 * Handles pointer events (move, down, up, click) mapped to canvas coordinates.
 * Returns true if an interactive UI element consumed the event.
 */
export function handlePointerEvent(type, canvasX, canvasY, isDown = false, originalEvent = null) {
  // 1. Check Level tabs
  for (const tab of UI_LAYOUT.tabs) {
    if (canvasX >= tab.x && canvasX <= tab.x + tab.w && canvasY >= tab.y && canvasY <= tab.y + tab.h) {
      if (type === 'pointerdown' || type === 'click') {
        boardState.currentLevel = tab.level;
        eventListeners.levelSelect.forEach(cb => cb(tab.level));
        setBoardLevel(tab.level);
        updateBoard();
        return true;
      }
      boardState.hoveredElement = tab.id;
      return true;
    }
  }

  // 2. Check Action buttons
  for (const btn of UI_LAYOUT.buttons) {
    if (canvasX >= btn.x && canvasX <= btn.x + btn.w && canvasY >= btn.y && canvasY <= btn.y + btn.h) {
      if (type === 'pointerdown' || type === 'click') {
        if (btn.id === 'btnFire') eventListeners.launch.forEach(cb => cb({ angle: boardState.angle, velocity: boardState.velocity }));
        else if (btn.id === 'btnReset') eventListeners.reset.forEach(cb => cb());
        else if (btn.id === 'btnLetter') eventListeners.letterOpen.forEach(cb => cb());
        updateBoard();
        return true;
      }
      boardState.hoveredElement = btn.id;
      return true;
    }
  }

  // 3. Check Velocity slider
  const sl = UI_LAYOUT.slider;
  if (canvasX >= sl.x1 - 25 && canvasX <= sl.x2 + 25 && canvasY >= sl.y - 35 && canvasY <= sl.y + 35) {
    if (type === 'pointerdown') {
      boardState.isDraggingSlider = true;
      boardState.hoveredElement = 'slider';
      const norm = Math.max(0, Math.min(1, (canvasX - sl.x1) / (sl.x2 - sl.x1)));
      boardState.velocity = Math.round((sl.minVal + norm * (sl.maxVal - sl.minVal)) * 10) / 10;
      eventListeners.paramChange.forEach(cb => cb({ angle: boardState.angle, velocity: boardState.velocity }));
      updateBoard();
      return true;
    }
  }
  if (boardState.isDraggingSlider) {
    if (type === 'pointermove') {
      const norm = Math.max(0, Math.min(1, (canvasX - sl.x1) / (sl.x2 - sl.x1)));
      boardState.velocity = Math.round((sl.minVal + norm * (sl.maxVal - sl.minVal)) * 10) / 10;
      eventListeners.paramChange.forEach(cb => cb({ angle: boardState.angle, velocity: boardState.velocity }));
      updateBoard();
      return true;
    }
    if (type === 'pointerup') {
      boardState.isDraggingSlider = false;
      boardState.hoveredElement = null;
      updateBoard();
      return true;
    }
  }

  // 4. Check Protractor arc control
  const pr = UI_LAYOUT.protractor;
  const pDist = Math.hypot(canvasX - pr.cx, canvasY - pr.cy);
  if (pDist <= pr.radius + 35 && pDist >= pr.radius - 35) {
    if (type === 'pointerdown') {
      boardState.isDraggingProtractor = true;
      boardState.hoveredElement = 'protractor';
      const rad = Math.atan2(-(canvasY - pr.cy), canvasX - pr.cx);
      let deg = Math.round((rad * 180 / Math.PI) * 10) / 10;
      deg = Math.max(pr.minAngle, Math.min(pr.maxAngle, deg));
      boardState.angle = deg;
      eventListeners.paramChange.forEach(cb => cb({ angle: boardState.angle, velocity: boardState.velocity }));
      updateBoard();
      return true;
    }
  }
  if (boardState.isDraggingProtractor) {
    if (type === 'pointermove') {
      const rad = Math.atan2(-(canvasY - pr.cy), canvasX - pr.cx);
      let deg = Math.round((rad * 180 / Math.PI) * 10) / 10;
      deg = Math.max(pr.minAngle, Math.min(pr.maxAngle, deg));
      boardState.angle = deg;
      eventListeners.paramChange.forEach(cb => cb({ angle: boardState.angle, velocity: boardState.velocity }));
      updateBoard();
      return true;
    }
    if (type === 'pointerup') {
      boardState.isDraggingProtractor = false;
      boardState.hoveredElement = null;
      updateBoard();
      return true;
    }
  }

  // 5. Slingshot / Gunny Aim fallback for canvas drag
  const cx = UI_LAYOUT.protractor.cx;
  const cy = UI_LAYOUT.protractor.cy;
  const updateSlingshotFromPointer = (px, py) => {
    const dx = px - cx;
    const dy = py - cy;
    const dist = Math.hypot(dx, dy);

    let deg = dx < 0
      ? (Math.atan2(dy, -dx) * 180 / Math.PI)
      : (Math.atan2(-dy, dx) * 180 / Math.PI);

    deg = Math.max(12, Math.min(82, Math.round(deg * 2) / 2));
    const normDist = Math.max(0, Math.min(1, (dist - 20) / 360));
    const newVel = Math.round((15 + normDist * (75 - 15)) * 2) / 2;

    boardState.angle = deg;
    boardState.velocity = newVel;
    eventListeners.paramChange.forEach(cb => cb({ angle: boardState.angle, velocity: boardState.velocity }));
  };

  if (type === 'pointerdown') {
    // Chỉ kích hoạt Gunny aim khi điểm nhấn nằm đúng trong giới hạn bảng đen
    if (canvasX < 0 || canvasX > CANVAS_WIDTH || canvasY < 0 || canvasY > CANVAS_HEIGHT) {
      return false;
    }
    boardState.isDraggingGunnyAim = true;
    boardState.hoveredElement = 'launcherAim';
    updateSlingshotFromPointer(canvasX, canvasY);
    updateBoard();
    return true;
  }

  if (type === 'pointermove' && boardState.isDraggingGunnyAim) {
    boardState.hoveredElement = 'launcherAim';
    updateSlingshotFromPointer(canvasX, canvasY);
    updateBoard();
    return true;
  }

  if (type === 'pointerup' && boardState.isDraggingGunnyAim) {
    boardState.isDraggingGunnyAim = false;
    boardState.hoveredElement = null;
    eventListeners.launch.forEach(cb => cb({ angle: boardState.angle, velocity: boardState.velocity }));
    updateBoard();
    return true;
  }

  return false;
}

// ============================================================================
// 10. 3D CHALK RAIL PROPS & 3D FELT ERASER
// ============================================================================

export const chalkRailGroup = new THREE.Group();
chalkRailGroup.name = 'ChalkRailGroup';

export const eraser3D = new THREE.Group();
eraser3D.name = 'Eraser3D_Prop';

/**
 * Builds the 3D Chalk Rail with 4 authentic chalk sticks and the 3D Felt Eraser.
 */
function createWoodGrainTextures() {
  if (typeof document === 'undefined') return { map: null, roughnessMap: null };
  const w = 512, h = 256;
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#472816'; ctx.fillRect(0, 0, w, h);

  const r = document.createElement('canvas'); r.width = w; r.height = h;
  const rCtx = r.getContext('2d');
  rCtx.fillStyle = 'rgb(155, 155, 155)'; rCtx.fillRect(0, 0, w, h);

  for (let i = 0; i < 160; i++) {
    const y = deterministicHash(i * 3 + 1) * h;
    const thick = 1 + deterministicHash(i * 3 + 2) * 3.5;
    const tone = deterministicHash(i * 3 + 3);
    ctx.strokeStyle = tone > 0.5 ? 'rgba(92, 54, 28, 0.35)' : 'rgba(30, 15, 7, 0.35)';
    ctx.lineWidth = thick;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.bezierCurveTo(w * 0.33, y + (tone - 0.5) * 14, w * 0.66, y - (tone - 0.5) * 14, w, y);
    ctx.stroke();

    const rv = Math.floor(135 + tone * 55);
    rCtx.strokeStyle = `rgb(${rv},${rv},${rv})`;
    rCtx.lineWidth = thick;
    rCtx.beginPath(); rCtx.moveTo(0, y); rCtx.lineTo(w, y); rCtx.stroke();
  }

  const dustGrad = ctx.createRadialGradient(w * 0.25, h * 0.5, 4, w * 0.25, h * 0.5, 90);
  dustGrad.addColorStop(0.0, 'rgba(235, 236, 228, 0.14)');
  dustGrad.addColorStop(1.0, 'rgba(235, 236, 228, 0.0)');
  ctx.fillStyle = dustGrad; ctx.fillRect(0, 0, w, h);

  const map = new THREE.CanvasTexture(c);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = THREE.RepeatWrapping; map.wrapT = THREE.RepeatWrapping; map.repeat.set(4, 1);

  const roughnessMap = new THREE.CanvasTexture(r);
  roughnessMap.wrapS = THREE.RepeatWrapping; roughnessMap.wrapT = THREE.RepeatWrapping; roughnessMap.repeat.set(4, 1);
  return { map, roughnessMap };
}

function createPropContactShadowTexture() {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas'); c.width = 128; c.height = 64;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(64, 32, 8, 64, 32, 58);
  g.addColorStop(0.0, 'rgba(10, 6, 3, 0.68)');
  g.addColorStop(0.55, 'rgba(10, 6, 3, 0.30)');
  g.addColorStop(1.0, 'rgba(10, 6, 3, 0.0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 128, 64);
  const tex = new THREE.CanvasTexture(c);
  tex.minFilter = THREE.LinearFilter;
  return tex;
}

function createBeveledBoxGeometry(w, h, d, bevel = 0.35) {
  const shape = new THREE.Shape();
  const hw = w / 2 - bevel, hh = h / 2 - bevel;
  shape.moveTo(-hw, -hh); shape.lineTo(hw, -hh); shape.lineTo(hw, hh); shape.lineTo(-hw, hh); shape.closePath();
  const geom = new THREE.ExtrudeGeometry(shape, {
    depth: Math.max(0.1, d - bevel * 2),
    bevelEnabled: true, bevelSegments: 2, steps: 1, bevelSize: bevel, bevelThickness: bevel
  });
  geom.center();
  return geom;
}

function build3DProps() {
  const { map: woodMap, roughnessMap: woodRough } = createWoodGrainTextures();
  const contactTex = createPropContactShadowTexture();

  const railWidth = 423.0;
  const railHeight = 5.4;
  const railDepth = 13.5;
  const railTopY = 85.6;

  const railLedgeGeom = createBeveledBoxGeometry(railWidth, railHeight, railDepth, 0.45);
  const railLedgeMat = new THREE.MeshStandardMaterial({
    map: woodMap, roughnessMap: woodRough, color: 0xffffff, roughness: 0.72, metalness: 0.04
  });
  const railMesh = new THREE.Mesh(railLedgeGeom, railLedgeMat);
  railMesh.name = 'BlackboardChalkRail';
  railMesh.position.set(BOARD_WORLD.center.x, railTopY - railHeight / 2, BOARD_WORLD.frontZ - 5.2);
  railMesh.castShadow = false;
  railMesh.receiveShadow = true;
  chalkRailGroup.add(railMesh);

  const lipGeom = createBeveledBoxGeometry(railWidth, 0.70, 1.6, 0.20);
  const lipMesh = new THREE.Mesh(lipGeom, railLedgeMat);
  lipMesh.position.set(BOARD_WORLD.center.x, railTopY + 0.35, BOARD_WORLD.frontZ - 11.1);
  lipMesh.castShadow = false; lipMesh.receiveShadow = true;
  chalkRailGroup.add(lipMesh);

  const chalkColorsList = [
    { name: 'white', color: 0xdedbd2, x: -72, rotZ: 0.10, len: 8.6 },
    { name: 'yellow', color: 0xe6d494, x: -53, rotZ: -0.07, len: 9.2 },
    { name: 'cyan', color: 0x98c2b0, x: -34, rotZ: 0.06, len: 7.8 },
    { name: 'red', color: 0xd18a8a, x: -16, rotZ: -0.14, len: 8.4 }
  ];

  const chalkRadius = 1.28;
  chalkColorsList.forEach((item, idx) => {
    const chalkGeom = new THREE.CylinderGeometry(chalkRadius * 0.90, chalkRadius, item.len, 16);
    const chalkMat = new THREE.MeshStandardMaterial({ color: item.color, roughness: 0.95, metalness: 0.0 });
    const stick = new THREE.Mesh(chalkGeom, chalkMat);
    stick.name = `ChalkStick_${item.name}`;
    stick.rotation.x = (idx === 1) ? (Math.PI / 2 - 0.14) : (Math.PI / 2);
    stick.rotation.z = item.rotZ;
    stick.position.set(BOARD_WORLD.center.x + item.x, railTopY + chalkRadius * 1.12, BOARD_WORLD.frontZ - 6.8);
    stick.castShadow = false; stick.receiveShadow = true;
    chalkRailGroup.add(stick);

    if (contactTex) {
      const cs = new THREE.Mesh(
        new THREE.PlaneGeometry(3.2, item.len * 1.15),
        new THREE.MeshBasicMaterial({ map: contactTex, transparent: true, opacity: 0.85, depthWrite: false })
      );
      cs.rotation.x = -Math.PI / 2; cs.rotation.z = item.rotZ;
      cs.position.set(BOARD_WORLD.center.x + item.x + 0.15, railTopY + 0.04, BOARD_WORLD.frontZ - 6.8);
      cs.userData.noAO = true;
      chalkRailGroup.add(cs);
    }
  });

  let trayDustTex = null;
  if (typeof document !== 'undefined') {
    const dustCanvas = document.createElement('canvas');
    if (dustCanvas && dustCanvas.getContext) {
      dustCanvas.width = 512; dustCanvas.height = 64;
      const dCtx = dustCanvas.getContext('2d');
      if (dCtx && typeof dCtx.beginPath === 'function') {
        for (let i = 0; i < 420; i++) {
          const dx = deterministicHash(i * 5 + 1) * 512;
          const dy = deterministicHash(i * 5 + 2) * 64;
          const r = 1 + deterministicHash(i * 5 + 3) * 6;
          dCtx.fillStyle = `rgba(238, 240, 234, ${0.03 + deterministicHash(i * 5 + 4) * 0.08})`;
          dCtx.beginPath(); dCtx.arc(dx, dy, r, 0, Math.PI * 2); dCtx.fill();
        }
      }
      trayDustTex = new THREE.CanvasTexture(dustCanvas);
    }
  }

  const trayDustPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(railWidth - 8, 10.5),
    new THREE.MeshBasicMaterial({ map: trayDustTex, transparent: true, opacity: 0.85, depthWrite: false })
  );
  trayDustPlane.rotation.x = -Math.PI / 2;
  trayDustPlane.position.set(BOARD_WORLD.center.x, railTopY + 0.03, BOARD_WORLD.frontZ - 5.2);
  trayDustPlane.userData.noAO = true;
  chalkRailGroup.add(trayDustPlane);

  const chalkBox = new THREE.Group();
  chalkBox.position.set(BOARD_WORLD.center.x - 112, railTopY + 2.1, BOARD_WORLD.frontZ - 6.4);
  chalkBox.rotation.y = -0.18;
  const boxMat = new THREE.MeshStandardMaterial({ color: 0xc8a472, roughness: 0.88 });
  const boxBody = new THREE.Mesh(createBeveledBoxGeometry(11.0, 4.2, 7.2, 0.2), boxMat);
  boxBody.receiveShadow = true;
  chalkBox.add(boxBody);
  for (let c = 0; c < 4; c++) {
    const upright = new THREE.Mesh(
      new THREE.CylinderGeometry(0.65, 0.70, 5.4, 12),
      new THREE.MeshStandardMaterial({ color: c === 2 ? 0xe6d494 : 0xdedbd2, roughness: 0.95 })
    );
    upright.position.set(-3.0 + c * 2.0, 1.4, (c % 2 - 0.5) * 1.4);
    upright.rotation.z = (c - 1.5) * 0.06;
    chalkBox.add(upright);
  }
  chalkRailGroup.add(chalkBox);

  const brokenStick = new THREE.Mesh(
    new THREE.CylinderGeometry(0.75, 0.72, 3.8, 14),
    new THREE.MeshStandardMaterial({ color: 0xdcd9d0, roughness: 0.96 })
  );
  brokenStick.rotation.x = Math.PI / 2; brokenStick.rotation.z = 0.48;
  brokenStick.position.set(BOARD_WORLD.center.x + 4, railTopY + 0.68, BOARD_WORLD.frontZ - 6.6);
  brokenStick.castShadow = false;
  chalkRailGroup.add(brokenStick);

  const handleMesh = new THREE.Mesh(
    createBeveledBoxGeometry(18.5, 4.2, 7.8, 0.45),
    new THREE.MeshStandardMaterial({ map: woodMap, roughnessMap: woodRough, color: 0xc28e64, roughness: 0.58, metalness: 0.05 })
  );
  handleMesh.name = 'EraserHandleMesh';
  handleMesh.position.set(0, 4.2, 0);
  handleMesh.castShadow = false; handleMesh.receiveShadow = true;
  eraser3D.add(handleMesh);

  const trimMesh = new THREE.Mesh(
    createBeveledBoxGeometry(18.2, 1.1, 7.6, 0.18),
    new THREE.MeshStandardMaterial({ color: 0xd8d2c7, roughness: 0.92, metalness: 0.0 })
  );
  trimMesh.position.set(0, 1.85, 0); trimMesh.castShadow = false;
  eraser3D.add(trimMesh);

  const feltMesh = new THREE.Mesh(
    createBeveledBoxGeometry(18.0, 2.2, 7.5, 0.25),
    new THREE.MeshStandardMaterial({ color: 0x2d3136, roughness: 0.98, metalness: 0.0 })
  );
  feltMesh.position.set(0, 0.5, 0);
  feltMesh.castShadow = false; feltMesh.receiveShadow = true;
  eraser3D.add(feltMesh);

  if (contactTex) {
    const eShadow = new THREE.Mesh(
      new THREE.PlaneGeometry(22.5, 10.5),
      new THREE.MeshBasicMaterial({ map: contactTex, transparent: true, opacity: 0.9, depthWrite: false })
    );
    eShadow.name = 'EraserContactShadow';
    eShadow.rotation.x = -Math.PI / 2; eShadow.position.set(0.3, -0.52, 0);
    eShadow.userData.noAO = true;
    eraser3D.add(eShadow);
  }

  const auraMesh = new THREE.Mesh(
    new THREE.BoxGeometry(20.5, 8.2, 9.6),
    new THREE.MeshBasicMaterial({
      color: 0xf8e6a0,
      transparent: true,
      opacity: 0.0,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    })
  );
  auraMesh.name = 'EraserGlowAura';
  auraMesh.userData.noAO = true;
  eraser3D.add(auraMesh);

  eraser3D.position.set(BOARD_WORLD.min.x + 36.0, railTopY + 0.56, BOARD_WORLD.frontZ - 5.4);
  eraser3D.rotation.y = 0.06;
  eraser3D.castShadow = false;
  eraser3D.visible = true;
  chalkRailGroup.add(eraser3D);
}

build3DProps();

function createWritingPlaneMaterial() {
  const { roughnessMap, bumpMap } = createSlateSurfaceMaps();
  const mat = new THREE.MeshPhysicalMaterial({
    map: staticBoardTexture || boardTexture,
    color: new THREE.Color(0xffffff),
    transparent: false,
    depthWrite: true,
    roughness: 0.92,
    roughnessMap: roughnessMap || null,
    bumpMap: bumpMap || null,
    bumpScale: 0.19,
    metalness: 0.0,
    sheen: 0.0,
    sheenRoughness: 0.88,
    sheenColor: new THREE.Color(0xd2e6dc),
    envMapIntensity: 0.12,
    emissive: new THREE.Color(0x000000),
    emissiveIntensity: 0.0
  });

  if (dynamicChalkTexture) {
    mat.userData.hasGpuDualLayer = true;
    mat.customProgramCacheKey = () => 'chalkboard_dual_layer_v1';
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uDynamicChalkMap = { value: dynamicChalkTexture };
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <common>',
        `#include <common>
        uniform sampler2D uDynamicChalkMap;`
      );
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <map_fragment>',
        `#include <map_fragment>
        vec4 dynamicChalk = texture2D(uDynamicChalkMap, vMapUv);
        diffuseColor.rgb = diffuseColor.rgb * (1.0 - dynamicChalk.a) + dynamicChalk.rgb;`
      );
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
        roughnessFactor = mix(roughnessFactor, 0.98, dynamicChalk.a);`
      );
    };
  }
  return mat;
}

export function attachToBoardMesh(boardMesh, scene = null) {
  if (!boardMesh) return;
  attachedBoardMesh = boardMesh;

  if (boardMesh.material) {
    boardMesh.receiveShadow = true;
    boardMesh.material.color = new THREE.Color(0xffffff);
    boardMesh.material.roughness = 0.86;
    boardMesh.material.metalness = 0.03;
    boardMesh.material.needsUpdate = true;
  }

  const writingPlaneWidth = BOARD_WORLD.writingWidth;
  if (!writingPlaneMesh) {
    const planeGeom = new THREE.PlaneGeometry(writingPlaneWidth, BOARD_WORLD.size.y);
    writingPlaneMesh = new THREE.Mesh(planeGeom, createWritingPlaneMaterial());
    writingPlaneMesh.name = 'Blackboard_WritingPlane';
    writingPlaneMesh.position.set(BOARD_WORLD.center.x, BOARD_WORLD.center.y, BOARD_WORLD.frontZ);
    writingPlaneMesh.rotation.y = Math.PI;
    writingPlaneMesh.receiveShadow = true;
    writingPlaneMesh.castShadow = false;
  }

  const parent = scene || boardMesh.parent;
  if (parent) {
    if (!parent.getObjectByName('Blackboard_WritingPlane')) parent.add(writingPlaneMesh);
    if (!parent.getObjectByName('ChalkRailGroup')) parent.add(chalkRailGroup);
    initBlackHoleVideo(parent);
  }

  isStaticDirty = true;
  updateBoard();
}

export function initInteractiveBoard(options = {}) {
  const { scene, boardMesh, renderer } = options;

  if (boardTexture && renderer?.capabilities?.getMaxAnisotropy) {
    boardTexture.anisotropy = Math.min(16, renderer.capabilities.getMaxAnisotropy());
    boardTexture.needsUpdate = true;
  }

  if (boardMesh) {
    attachToBoardMesh(boardMesh, scene);
  } else if (scene) {
    if (!writingPlaneMesh) {
      const writingPlaneWidth = BOARD_WORLD.writingWidth;
      writingPlaneMesh = new THREE.Mesh(
        new THREE.PlaneGeometry(writingPlaneWidth, BOARD_WORLD.size.y),
        createWritingPlaneMaterial()
      );
      writingPlaneMesh.name = 'Blackboard_WritingPlane';
      writingPlaneMesh.position.set(BOARD_WORLD.center.x, BOARD_WORLD.center.y, BOARD_WORLD.frontZ);
      writingPlaneMesh.rotation.y = Math.PI;
      writingPlaneMesh.receiveShadow = true;
      writingPlaneMesh.castShadow = false;
      scene.add(writingPlaneMesh);
    }
    scene.add(chalkRailGroup);
    initBlackHoleVideo(scene);
  }

  isStaticDirty = true;
  updateBoard();

  return {
    boardCanvas, boardCtx, boardTexture, writingPlaneMesh,
    chalkRailGroup, eraser3D, updateBoard, handlePointerEvent, raycastToCanvas, setBoardLevel,
    blackHoleVideoGroup, syncBlackHoleVideo
  };
}

// ============================================================================
// 3D BLACK HOLE ACCRETION DISK VIDEO MESH
// ============================================================================

export let blackHoleVideoGroup = null;
export let blackHoleVideoMesh = null;
let blackHoleVideoElement = null;
let blackHoleVideoTexture = null;
let blackHoleMaterial = null;
let blackHoleCoreMesh = null;

export function initBlackHoleVideo(parent) {
  if (typeof document === 'undefined') return null;

  if (blackHoleVideoGroup) {
    if (parent && blackHoleVideoGroup.parent !== parent) {
      parent.add(blackHoleVideoGroup);
    }
    return blackHoleVideoGroup;
  }

  blackHoleVideoGroup = new THREE.Group();
  blackHoleVideoGroup.name = 'BlackHoleVideoGroup';
  blackHoleVideoGroup.visible = false;
  blackHoleVideoGroup.userData.noAO = true;

  // Video element for accretion disk simulation
  blackHoleVideoElement = document.createElement('video');
  blackHoleVideoElement.src = 'assets/bh_clean.mp4';
  blackHoleVideoElement.muted = true;
  blackHoleVideoElement.loop = true;
  blackHoleVideoElement.playsInline = true;
  blackHoleVideoElement.setAttribute('playsinline', '');
  blackHoleVideoElement.setAttribute('webkit-playsinline', '');
  blackHoleVideoElement.preload = 'auto';

  // THREE.VideoTexture configuration
  blackHoleVideoTexture = new THREE.VideoTexture(blackHoleVideoElement);
  blackHoleVideoTexture.colorSpace = THREE.SRGBColorSpace;
  blackHoleVideoTexture.minFilter = THREE.LinearFilter;
  blackHoleVideoTexture.magFilter = THREE.LinearFilter;
  blackHoleVideoTexture.generateMipmaps = false;

  // Shader material with AdditiveBlending, luma keying, and soft radial edge falloff
  const uniforms = {
    tVideo: { value: blackHoleVideoTexture },
    uOpacity: { value: 1.0 }
  };

  const vertexShader = `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `;

  const fragmentShader = `
    uniform sampler2D tVideo;
    uniform float uOpacity;
    varying vec2 vUv;

    void main() {
      vec4 tex = texture2D(tVideo, vUv);
      float luma = dot(tex.rgb, vec3(0.299, 0.587, 0.114));
      float alpha = smoothstep(0.03, 0.16, luma);

      // Horizontal elliptical soft mask to keep accretion disk wings intact
      vec2 d = (vUv - 0.5) * vec2(1.35, 2.0);
      float dist = length(d);
      alpha *= smoothstep(1.0, 0.65, dist);

      gl_FragColor = vec4(tex.rgb, alpha * uOpacity);
    }
  `;

  blackHoleMaterial = new THREE.ShaderMaterial({
    uniforms,
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide
  });

  // Unit square plane geometry (scaled dynamically based on radiusPx)
  const geom = new THREE.PlaneGeometry(1, 1);
  blackHoleVideoMesh = new THREE.Mesh(geom, blackHoleMaterial);
  blackHoleVideoMesh.name = 'BlackHoleVideoMesh';
  blackHoleVideoMesh.renderOrder = 4;
  blackHoleVideoMesh.userData.noAO = true;

  // Black core circle behind the light layer to mask the event horizon void
  const coreCanvas = document.createElement('canvas');
  coreCanvas.width = 128;
  coreCanvas.height = 128;
  const cCtx = coreCanvas.getContext('2d');
  const cg = cCtx.createRadialGradient(64, 64, 16, 64, 64, 62);
  cg.addColorStop(0.0, 'rgba(2, 4, 4, 0.98)');
  cg.addColorStop(0.52, 'rgba(2, 4, 4, 0.86)');
  cg.addColorStop(0.80, 'rgba(2, 4, 4, 0.30)');
  cg.addColorStop(1.0, 'rgba(2, 4, 4, 0.0)');
  cCtx.fillStyle = cg;
  cCtx.fillRect(0, 0, 128, 128);
  const coreTex = new THREE.CanvasTexture(coreCanvas);
  coreTex.minFilter = THREE.LinearFilter;
  const coreGeom = new THREE.PlaneGeometry(0.24, 0.24);
  const coreMat = new THREE.MeshBasicMaterial({
    map: coreTex,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide
  });
  blackHoleCoreMesh = new THREE.Mesh(coreGeom, coreMat);
  blackHoleCoreMesh.name = 'BlackHoleCoreMesh';
  blackHoleCoreMesh.position.set(0, 0, 0.02);
  blackHoleCoreMesh.renderOrder = 3;
  blackHoleCoreMesh.userData.noAO = true;

  blackHoleVideoGroup.add(blackHoleCoreMesh);
  blackHoleVideoGroup.add(blackHoleVideoMesh);
  blackHoleVideoGroup.rotation.y = Math.PI;

  if (parent) {
    parent.add(blackHoleVideoGroup);
  }

  return blackHoleVideoGroup;
}

export function syncBlackHoleVideo({ visible, canvasX = 1180, canvasY = 410, radiusPx = 74, opacity = 1.0 }) {
  if (typeof document === 'undefined') return;

  if (!blackHoleVideoGroup) {
    const parent = writingPlaneMesh?.parent;
    if (parent) {
      initBlackHoleVideo(parent);
    } else {
      return;
    }
  }

  if (!visible) {
    if (blackHoleVideoGroup.visible) {
      blackHoleVideoGroup.visible = false;
    }
    if (blackHoleVideoElement && !blackHoleVideoElement.paused) {
      blackHoleVideoElement.pause();
    }
    return;
  }

  if (!blackHoleVideoGroup.visible) {
    blackHoleVideoGroup.visible = true;
  }
  if (blackHoleVideoElement && blackHoleVideoElement.paused) {
    blackHoleVideoElement.play().catch(() => {});
  }

  if (blackHoleMaterial && blackHoleMaterial.uniforms?.uOpacity) {
    blackHoleMaterial.uniforms.uOpacity.value = Math.max(0.0, Math.min(1.0, opacity));
  }

  // Convert canvas pixel coordinates (canvasX, canvasY) to 3D world position at blackboard plane
  const u = Math.max(0, Math.min(1, canvasX / CANVAS_WIDTH));
  const v = 1.0 - Math.max(0, Math.min(1, canvasY / CANVAS_HEIGHT));
  const writingWidth = BOARD_WORLD.writingWidth || (BOARD_WORLD.size.y * (CANVAS_WIDTH / CANVAS_HEIGHT));
  const worldX = BOARD_WORLD.center.x + (0.5 - u) * writingWidth;
  const worldY = BOARD_WORLD.min.y + v * BOARD_WORLD.size.y;
  const worldZ = BOARD_WORLD.frontZ - 0.12;

  blackHoleVideoGroup.position.set(worldX, worldY, worldZ);

  // Scale proportional to radiusPx: visible accretion disk extends ~7.8 * rs
  const worldUnitsPerPixel = BOARD_WORLD.size.y / CANVAS_HEIGHT;
  const diskWorldDiameter = (radiusPx * 7.8) * worldUnitsPerPixel;
  blackHoleVideoGroup.scale.set(diskWorldDiameter, diskWorldDiameter, 1.0);
}

export function canvasToWorldPosition(canvasX, canvasY) {
  const u = Math.max(0, Math.min(1, canvasX / CANVAS_WIDTH));
  const v = 1.0 - Math.max(0, Math.min(1, canvasY / CANVAS_HEIGHT));
  const writingWidth = BOARD_WORLD.writingWidth || (BOARD_WORLD.size.y * (CANVAS_WIDTH / CANVAS_HEIGHT));
  const worldX = BOARD_WORLD.center.x + (0.5 - u) * writingWidth;
  const worldY = BOARD_WORLD.min.y + v * BOARD_WORLD.size.y;
  const worldZ = BOARD_WORLD.frontZ - 3.5;
  return new THREE.Vector3(worldX, worldY, worldZ);
}

/**
 * Clears the static board cache (e.g. when Black Hole implosion consumes lecture text).
 */
export function clearStaticBoard() {
  ensureSlateBackground();
  if (staticBoardCtx && slateBgCanvas) {
    staticBoardCtx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    staticBoardCtx.drawImage(slateBgCanvas, 0, 0);
  } else if (staticBoardCtx) {
    staticBoardCtx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  }
  if (boardCtx && slateBgCanvas) {
    boardCtx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    boardCtx.drawImage(slateBgCanvas, 0, 0);
  } else if (boardCtx) {
    boardCtx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  }
  if (staticBoardTexture) staticBoardTexture.needsUpdate = true;
  if (boardTexture) boardTexture.needsUpdate = true;
  isStaticDirty = false;
}

/**
 * Synchronizes the diegetic board UI with an external level switch.
 */
export function setBoardLevel(level) {
  if (level >= 1 && level <= 3) {
    boardState.currentLevel = level;
    boardState.isBoardCleaned = false;
    boardState.hideProtractor = false;
    isStaticDirty = true;
    updateBoard();
  }
}

/**
 * External helper to update real-time telemetry from gameplay controller.
 */
export function setTelemetry(telemetryData) {
  if (telemetryData) {
    Object.assign(boardState.telemetry, telemetryData);
  }
}

/**
 * Returns current control parameters { level, angle, velocity }.
 */
export function getControlsState() {
  return {
    level: boardState.currentLevel,
    angle: boardState.angle,
    velocity: boardState.velocity,
    isAiming: boardState.isAiming,
    isFiring: boardState.isFiring
  };
}

// Initial render call on module load
updateBoard();

if (typeof document !== 'undefined' && document.fonts && document.fonts.ready) {
  document.fonts.ready.then(() => {
    isStaticDirty = true;
    updateBoard();
  });
}
