/**
 * js/scene/classroomScene.js
 * 
 * 3D WebGL Classroom Scene Architecture (Three.js & ES6 Modules)
 * Production Interior Pipeline:
 * - Procedural HDR Interior+Sunset IBL (PMREMGenerator) replacing flat ambient wash
 * - Ground-Truth Ambient Occlusion (GTAOPass calibrated to cm scale, 0.5x resolution)
 * - Cached noAO exclusion during GTAO depth/normal pass
 * - HL2/Godot-style Cylindrical Z-Billboard Volumetric Sunbeams with FBM DataTexture
 * - GPU-driven Tyndall Volumetric Dust Motes
 * - High-contrast Golden Hour Key Sunlight (2048 PCFSoftShadowMap, static shadow baking)
 * - Window Gobo floor splash + wall plaster micro-bump
 * - OutputPass -> SMAAPass -> Perceptual sRGB filmPass with Adaptive FPS Guard
 * - Static chair geometry merging (BufferGeometryUtils) + renderer.compile warmup
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as BufferGeometryUtils from 'three/addons/utils/BufferGeometryUtils.js';

// =============================================================================
// 1. CONSTANTS & CINEMATIC CAMERA SPECIFICATIONS
// =============================================================================

export const BASE_CAM_POS = new THREE.Vector3(30.0, 146.5, -90.0);
export const BASE_LOOKAT = new THREE.Vector3(35.0, 138.0, 485.0);
export const BASE_FOV = 40.0;

export const BOARD_BOUNDS = {
  min: new THREE.Vector3(-248.86, 78.39, 479.55),
  max: new THREE.Vector3(352.73, 246.51, 502.52),
  center: new THREE.Vector3(51.94, 162.45, 491.04),
  normal: new THREE.Vector3(0, 0, -1)
};

export const DESK_BOUNDS = {
  min: new THREE.Vector3(-85.83, -0.38, 290.32),
  max: new THREE.Vector3(90.71, 78.60, 396.47),
  center: new THREE.Vector3(2.44, 39.11, 343.40),
  topY: 78.60
};

// =============================================================================
// 2. MODULE STATE VARIABLES
// =============================================================================

export let scene = null;
export let camera = null;
export let renderer = null;
export let boardMesh = null;
export let teacherDeskMesh = null;
export let classroomModel = null;
export let dustParticles = null;
export let sunLight = null;
export let ambientLight = null;
export let boardSpotLight = null;
export let deskSpotLight = null;
export let windowBounceLight = null;
export let proceduralSunbeams = null;
export let smaaPass = null;
export let gtaoPass = null;
export let outdoorSceneryGroup = null;

export let composer = null;
export let bloomPass = null;
export let filmPass = null;

let godrayMeshes = [];
let sunbeamMaterials = [];
let dustMaterial = null;
let sharedNoiseTex = null;

// Static shadow baking & AO exclusion cache
let startupShadowFrames = 18;
let lastShadowChildCount = -1;
let noAoCache = [];
let lastNoAoChildCount = -1;

// Adaptive frame-time guard
const AO_RES_SCALE = 0.5;
let frameTimeAccum = 0;
let frameTimeSamples = 0;
let adaptiveTier = 0;

// Parallax & Camera state (Hover Micro-Parallax + Constrained Drag Micro-Orbit)
let parallaxEnabled = true;
let mouseNDC = { x: 0, y: 0 };
let currentCamOffset = { x: 0, y: 0 };
let targetCamOffset = { x: 0, y: 0 };

const hoverTarget = { x: 0, y: 0 };
const currentHoverOffset = { x: 0, y: 0 };

let isOrbitDragging = false;
const dragStart = { x: 0, y: 0 };
let dragYawStart = 0;
let dragPitchStart = 0;
let targetYaw = 0;
let targetPitch = 0;
let currentYaw = 0;
let currentPitch = 0;

const MAX_DRAG_YAW = 7.0 * (Math.PI / 180.0);   // ±7° (~0.12217 rad)
const MIN_DRAG_PITCH = -1.5 * (Math.PI / 180.0); // -1.5° (~-0.02618 rad)
const MAX_DRAG_PITCH = 3.5 * (Math.PI / 180.0);  // +3.5° (~0.06109 rad)
const YAW_SENSITIVITY = MAX_DRAG_YAW / 240.0;
const PITCH_SENSITIVITY = MAX_DRAG_PITCH / 140.0;

const parallaxRaycaster = new THREE.Raycaster();
const parallaxNdc = new THREE.Vector2();
const boardPlane = new THREE.Plane(new THREE.Vector3(0, 0, -1), 479.46);
const planeIntersectPoint = new THREE.Vector3();

// Animation loop & render hooks
let isAnimationRunning = false;
let animationFrameId = null;
let lastTime = 0;
const renderCallbacks = new Set();

export const DUST_COUNT = 220;

// Promise resolving when GLTF model is fully loaded and meshes identified
let resolveLoaded = null;
let rejectLoaded = null;
export const whenLoaded = new Promise((resolve, reject) => {
  resolveLoaded = resolve;
  rejectLoaded = reject;
});

// =============================================================================
// 3. TEXTURE & PROCEDURAL IBL HELPERS
// =============================================================================

function deterministicHash(n) {
  const s = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
  return s - Math.floor(s);
}

function hash2D(ix, iy, period) {
  const px = ((ix % period) + period) % period;
  const py = ((iy % period) + period) % period;
  return deterministicHash(px * 127.1 + py * 311.7);
}

function smoothValueNoise2D(u, v, period) {
  const x = u * period;
  const y = v * period;
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const sx = fx * fx * (3.0 - 2.0 * fx);
  const sy = fy * fy * (3.0 - 2.0 * fy);

  const n00 = hash2D(ix, iy, period);
  const n10 = hash2D(ix + 1, iy, period);
  const n01 = hash2D(ix, iy + 1, period);
  const n11 = hash2D(ix + 1, iy + 1, period);

  const nx0 = n00 + (n10 - n00) * sx;
  const nx1 = n01 + (n11 - n01) * sx;
  return nx0 + (nx1 - nx0) * sy;
}

function getVolumetricNoiseTexture() {
  if (sharedNoiseTex) return sharedNoiseTex;
  const size = 128;
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    const v = y / size;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const fbm =
        smoothValueNoise2D(u, v, 4) * 0.55 +
        smoothValueNoise2D(u, v, 8) * 0.30 +
        smoothValueNoise2D(u, v, 16) * 0.15;
      const val = Math.max(0, Math.min(255, Math.floor(fbm * 255)));
      const idx = (y * size + x) * 4;
      data[idx] = val;
      data[idx + 1] = val;
      data[idx + 2] = val;
      data[idx + 3] = 255;
    }
  }
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  sharedNoiseTex = tex;
  return sharedNoiseTex;
}

function createWallPlasterBumpMap() {
  if (typeof document === 'undefined') return null;
  const size = 256;
  const canvas = document.createElement('canvas');
  if (!canvas || !canvas.getContext) return null;
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx || typeof ctx.createImageData !== 'function') return null;

  const imgData = ctx.createImageData(size, size);
  const buf = new Uint32Array(imgData.data.buffer);

  for (let y = 0; y < size; y++) {
    const vCoord = y / size;
    for (let x = 0; x < size; x++) {
      const uCoord = x / size;
      const n =
        smoothValueNoise2D(uCoord, vCoord, 4) * 0.55 +
        smoothValueNoise2D(uCoord, vCoord, 8) * 0.30 +
        smoothValueNoise2D(uCoord, vCoord, 16) * 0.15;
      const v = Math.max(0, Math.min(255, Math.floor(116 + n * 24)));
      buf[y * size + x] = (0xff << 24) | (v << 16) | (v << 8) | v;
    }
  }
  ctx.putImageData(imgData, 0, 0);

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 2);
  return tex;
}

function createWoodDeskBumpMap() {
  if (typeof document === 'undefined') return null;
  const size = 256;
  const canvas = document.createElement('canvas');
  if (!canvas || !canvas.getContext) return null;
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx || typeof ctx.createImageData !== 'function') return null;

  const imgData = ctx.createImageData(size, size);
  const buf = new Uint32Array(imgData.data.buffer);
  buf.fill(0xff808080);

  // Procedural natural wood grain stripes
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const grain = Math.sin(x * 0.28 + smoothValueNoise2D(x / size, y / size, 8) * 8.0);
      const v = Math.floor(128 + grain * 22);
      const rgba = (0xff << 24) | (v << 16) | (v << 8) | v;
      buf[y * size + x] = rgba;
    }
  }
  ctx.putImageData(imgData, 0, 0);

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(4, 2);
  return tex;
}

function createSunsetSkyTexture() {
  if (typeof document === 'undefined') return null;
  const w = 1024, h = 512;
  const canvas = document.createElement('canvas');
  if (!canvas || !canvas.getContext) return null;
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx || typeof ctx.createLinearGradient !== 'function') return null;

  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0.00, '#18203d');
  grad.addColorStop(0.24, '#4e2e4f');
  grad.addColorStop(0.38, '#b3463d');
  grad.addColorStop(0.47, '#e67236');
  grad.addColorStop(0.54, '#f7a444');
  grad.addColorStop(0.62, '#c85c2d');
  grad.addColorStop(0.76, '#382016');
  grad.addColorStop(1.00, '#120b08');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  const sunX = w * 0.61, sunY = h * 0.44;
  const sunHalo = ctx.createRadialGradient(sunX, sunY, 4, sunX, sunY, 155);
  sunHalo.addColorStop(0.00, 'rgba(255, 242, 205, 0.96)');
  sunHalo.addColorStop(0.24, 'rgba(255, 172, 82, 0.74)');
  sunHalo.addColorStop(0.58, 'rgba(222, 82, 54, 0.26)');
  sunHalo.addColorStop(1.00, 'rgba(222, 82, 54, 0.0)');
  ctx.fillStyle = sunHalo;
  ctx.fillRect(0, 0, w, h);

  for (let c = 0; c < 18; c++) {
    const cx = (w * 0.30) + ((c * 97) % (w * 0.56));
    const cy = h * 0.32 + ((c * 53) % (h * 0.19));
    const rx = 55 + ((c * 31) % 85);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(3.2, 0.22);
    const cg = ctx.createRadialGradient(0, 0, rx * 0.1, 0, 0, rx);
    cg.addColorStop(0.0, 'rgba(255, 165, 108, 0.22)');
    cg.addColorStop(1.0, 'rgba(255, 165, 108, 0.0)');
    ctx.fillStyle = cg;
    ctx.beginPath();
    ctx.arc(0, 0, rx, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.mapping = THREE.EquirectangularReflectionMapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  return tex;
}

function buildInteriorGoldenHourEnv(pmremGenerator) {
  const iblScene = new THREE.Scene();
  iblScene.background = new THREE.Color(0x211916);

  const boxGeom = new THREE.PlaneGeometry(1, 1);
  const panels = [
    // Bright HDR window reflection (+X) compensating for removed RectAreaLight
    { pos: [12, 2.5, 0], rot: [0, -Math.PI / 2, 0], scale: [14, 9, 1], color: new THREE.Color(3.2, 1.75, 0.85) },
    // Soft warm plaster ceiling bounce (+Y)
    { pos: [0, 11, 0], rot: [Math.PI / 2, 0, 0], scale: [18, 18, 1], color: new THREE.Color(1.12, 0.80, 0.56) },
    // Rich walnut floor bounce (-Y)
    { pos: [0, -9, 0], rot: [-Math.PI / 2, 0, 0], scale: [18, 18, 1], color: new THREE.Color(0.55, 0.30, 0.15) },
    // Subtle cool-neutral twilight wall on right side (-X) for chromatic separation
    { pos: [-12, 2, 0], rot: [0, Math.PI / 2, 0], scale: [16, 12, 1], color: new THREE.Color(0.36, 0.46, 0.64) },
    // Front/back warm wall bounce
    { pos: [0, 1, 12], rot: [0, Math.PI, 0], scale: [18, 12, 1], color: new THREE.Color(0.80, 0.56, 0.36) },
    { pos: [0, 1, -12], rot: [0, 0, 0], scale: [18, 12, 1], color: new THREE.Color(0.50, 0.40, 0.34) }
  ];

  const disposables = [boxGeom];
  panels.forEach((p) => {
    const mat = new THREE.MeshBasicMaterial({ color: p.color });
    const mesh = new THREE.Mesh(boxGeom, mat);
    mesh.position.set(...p.pos);
    mesh.rotation.set(...p.rot);
    mesh.scale.set(...p.scale);
    iblScene.add(mesh);
    disposables.push(mat);
  });

  const envRT = pmremGenerator.fromScene(iblScene, 0.04);
  disposables.forEach((d) => d.dispose());
  return envRT.texture;
}

function createWindowGoboTexture() {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  if (!canvas || !canvas.getContext) return null;
  canvas.width = 512; canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (!ctx || typeof ctx.save !== 'function' || typeof ctx.beginPath !== 'function') return null;

  ctx.fillStyle = '#070402';
  ctx.fillRect(0, 0, 512, 512);
  ctx.save();
  ctx.shadowColor = '#ffb85c';
  ctx.shadowBlur = 22;
  ctx.fillStyle = '#ffdca0';
  const cols = 3, rows = 4, padX = 30, padY = 26, barX = 24, barY = 24;
  const paneW = (512 - padX * 2 - (cols - 1) * barX) / cols;
  const paneH = (512 - padY * 2 - (rows - 1) * barY) / rows;
  for (let c = 0; c < cols; c++) {
    for (let r = 0; r < rows; r++) {
      ctx.beginPath();
      if (typeof ctx.roundRect === 'function') {
        ctx.roundRect(padX + c * (paneW + barX), padY + r * (paneH + barY), paneW, paneH, 10);
      } else if (typeof ctx.rect === 'function') {
        ctx.rect(padX + c * (paneW + barX), padY + r * (paneH + barY), paneW, paneH);
      }
      ctx.fill();
    }
  }
  ctx.restore();

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  return texture;
}

// =============================================================================
// 4. HL2-STYLE CYLINDRICAL Z-BILLBOARD VOLUMETRIC SUNBEAMS & HORIZON SCENERY
// =============================================================================

function setupVolumetricSunbeams() {
  const sunbeamGroup = new THREE.Group();
  sunbeamGroup.name = 'ProceduralSunbeams';
  sunbeamGroup.userData.noAO = true;
  sunbeamMaterials = [];

  const geom = new THREE.PlaneGeometry(1.0, 1.0, 1, 16);
  const noiseTex = getVolumetricNoiseTexture();

  const vertexShader = `
    uniform vec3 uOrigin;
    uniform vec3 uBeamDir;
    uniform float uBeamLength;
    uniform float uStartWidth;
    uniform float uEndWidth;
    varying vec2 vUv;
    varying vec3 vWorldPos;
    varying float vCamAlign;
    varying float vMiePhase;
    void main() {
      float t = position.y + 0.5;
      vec3 centerAlongBeam = uOrigin + uBeamDir * (t * uBeamLength);
      vec3 toCam = normalize(cameraPosition - centerAlongBeam);
      vec3 rawCross = cross(toCam, uBeamDir);
      float crossLen = length(rawCross);
      vec3 side = crossLen > 1e-4 ? rawCross / crossLen : vec3(0.0, 0.0, 1.0);
      float halfWidth = mix(uStartWidth, uEndWidth, t) * 0.5;
      vec3 worldPos = centerAlongBeam + side * (position.x * 2.0 * halfWidth);

      vUv = vec2(position.x + 0.5, t);
      vWorldPos = worldPos;
      vCamAlign = smoothstep(0.06, 0.40, 1.0 - abs(dot(toCam, uBeamDir)));
      float cosTheta = clamp(dot(toCam, -uBeamDir), 0.0, 1.0);
      vMiePhase = 0.80 + 0.40 * pow(max(cosTheta, 1e-4), 2.2);
      gl_Position = projectionMatrix * viewMatrix * vec4(worldPos, 1.0);
    }
  `;

  const fragmentShader = `
    uniform vec3 uColor;
    uniform float uOpacity;
    uniform float uTime;
    uniform float uSeed;
    uniform sampler2D uNoiseTex;
    varying vec2 vUv;
    varying vec3 vWorldPos;
    varying float vCamAlign;
    varying float vMiePhase;
    void main() {
      float radial = sin(clamp(vUv.x, 0.0, 1.0) * 3.14159265);
      radial = pow(max(radial, 1e-4), 2.15);
      float axialStart = smoothstep(0.0, 0.06, vUv.y);
      float axialEnd = pow(max(clamp(1.0 - vUv.y, 0.0, 1.0), 1e-4), 0.85);
      float floorSoft = smoothstep(2.0, 24.0, vWorldPos.y);
      float zGuard = 1.0 - smoothstep(452.0, 474.0, vWorldPos.z);
      float boardReadability = mix(0.45, 1.0, smoothstep(145.0, 235.0, vWorldPos.x));

      vec2 uv1 = vec2(vUv.x * 1.15 + uTime * 0.012 + uSeed * 0.17, vUv.y * 0.90 - uTime * 0.020);
      vec2 uv2 = vec2(vUv.x * 2.10 - uTime * 0.009 + uSeed * 0.31, vUv.y * 1.75 + uTime * 0.014);
      float n1 = texture2D(uNoiseTex, uv1).r;
      float n2 = texture2D(uNoiseTex, uv2).r;
      float dustNoise = 0.68 + 0.32 * (n1 * 0.65 + n2 * 0.35);

      float alpha = uOpacity * radial * axialStart * axialEnd * floorSoft * zGuard * boardReadability * vCamAlign * vMiePhase * dustNoise;
      gl_FragColor = vec4(uColor, alpha);
    }
  `;

  const beamDir = new THREE.Vector3(-0.7826, -0.3913, 0.4845).normalize();
  const beamConfigs = [
    { origin: new THREE.Vector3(384, 212, 168), len: 540, w0: 20, w1: 58, opacity: 0.078, seed: 0.4 },
    { origin: new THREE.Vector3(384, 246, 208), len: 550, w0: 22, w1: 62, opacity: 0.088, seed: 1.2 },
    { origin: new THREE.Vector3(384, 206, 268), len: 520, w0: 22, w1: 60, opacity: 0.096, seed: 2.1 },
    { origin: new THREE.Vector3(384, 248, 326), len: 530, w0: 24, w1: 64, opacity: 0.090, seed: 3.3 },
    { origin: new THREE.Vector3(384, 224, 386), len: 470, w0: 20, w1: 54, opacity: 0.070, seed: 4.5 }
  ];

  beamConfigs.forEach((cfg, idx) => {
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uColor: { value: new THREE.Color(0xffbe63) },
        uOpacity: { value: cfg.opacity },
        uTime: { value: 0.0 },
        uSeed: { value: cfg.seed },
        uOrigin: { value: cfg.origin },
        uBeamDir: { value: beamDir },
        uBeamLength: { value: cfg.len },
        uStartWidth: { value: cfg.w0 },
        uEndWidth: { value: cfg.w1 },
        uNoiseTex: { value: noiseTex }
      },
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide
    });
    const mesh = new THREE.Mesh(geom, mat);
    mesh.name = `VolumetricSunbeam_${idx + 1}`;
    mesh.userData.noAO = true;
    mesh.frustumCulled = false;
    mesh.renderOrder = 12;
    sunbeamGroup.add(mesh);
    sunbeamMaterials.push(mat);
  });

  proceduralSunbeams = sunbeamGroup;
  if (scene) scene.add(sunbeamGroup);
}

function updateVolumetricSunbeams(elapsedTime = 0) {
  for (const mat of sunbeamMaterials) {
    if (mat.uniforms && mat.uniforms.uTime) {
      mat.uniforms.uTime.value = elapsedTime;
    }
  }
}

// =============================================================================
// 5. POST-PROCESSING PIPELINE (RenderPass -> GTAOPass -> Bloom -> OutputPass -> SMAA -> Film)
// =============================================================================

function getNoAoObjects() {
  if (!scene) return [];
  const count = scene.children.length;
  if (count !== lastNoAoChildCount) {
    lastNoAoChildCount = count;
    noAoCache = [];
    scene.traverse((obj) => {
      if (obj.userData && obj.userData.noAO) noAoCache.push(obj);
    });
  }
  return noAoCache;
}

export function invalidateNoAoCache() {
  lastNoAoChildCount = -1;
}

export function invalidateShadows() {
  startupShadowFrames = Math.max(startupShadowFrames, 2);
}

let useDirectRender = false;

async function initPostProcessing(width, height) {
  if (!renderer || typeof renderer.getContext !== 'function') return;
  try {
    const [
      { EffectComposer },
      { RenderPass },
      { UnrealBloomPass },
      { ShaderPass },
      { OutputPass }
    ] = await Promise.all([
      import('three/addons/postprocessing/EffectComposer.js'),
      import('three/addons/postprocessing/RenderPass.js'),
      import('three/addons/postprocessing/UnrealBloomPass.js'),
      import('three/addons/postprocessing/ShaderPass.js'),
      import('three/addons/postprocessing/OutputPass.js')
    ]);

    const pixelRatio = renderer.getPixelRatio ? renderer.getPixelRatio() : 1;
    const rt = new THREE.WebGLRenderTarget(
      Math.max(1, Math.floor(width * pixelRatio)),
      Math.max(1, Math.floor(height * pixelRatio)),
      { samples: 2, type: THREE.HalfFloatType }
    );
    composer = new EffectComposer(renderer, rt);
    composer.setPixelRatio(pixelRatio);
    composer.setSize(width, height);
    composer.addPass(new RenderPass(scene, camera));

    // Bỏ GTAOPass & SMAAPass (nặng GPU gấp 3 lần nhưng khác biệt cực nhỏ)
    gtaoPass = null;
    smaaPass = null;

    bloomPass = new UnrealBloomPass(new THREE.Vector2(Math.floor(width * 0.5), Math.floor(height * 0.5)), 0.18, 0.50, 0.84);
    composer.addPass(bloomPass);

    composer.addPass(new OutputPass());

    filmPass = new ShaderPass({
      uniforms: {
        tDiffuse: { value: null },
        uVignette: { value: 0.10 },
        uGrain: { value: 0.0020 },
        uTime: { value: 0.0 }
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform float uVignette;
        uniform float uGrain;
        uniform float uTime;
        varying vec2 vUv;
        float rand(vec2 co) {
          return fract(sin(dot(co, vec2(12.9898, 78.233)) + uTime) * 43758.5453);
        }
        void main() {
          vec4 col = texture2D(tDiffuse, vUv);
          vec2 d = vUv - 0.5;
          col.rgb *= clamp(1.0 - dot(d, d) * uVignette * 2.0, 0.84, 1.0);
          float luma = dot(col.rgb, vec3(0.2126, 0.7152, 0.0722));
          vec3 shadowTone = vec3(0.98, 0.98, 1.01);
          vec3 highlightTone = vec3(1.05, 0.99, 0.92);
          col.rgb *= mix(shadowTone, highlightTone, smoothstep(0.08, 0.56, luma));
          col.rgb += (rand(vUv * 512.0) - 0.5) * uGrain;
          col.rgb = clamp(col.rgb, vec3(0.0), vec3(1.0));
          gl_FragColor = col;
        }
      `
    });
    composer.addPass(filmPass);
  } catch {
    composer = null;
  }
}

// =============================================================================
// 6. SCENE & LIGHTING INITIALIZATION
// =============================================================================

export function initClassroomScene(options = {}) {
  const width = (typeof window !== 'undefined' && window.innerWidth) ? window.innerWidth : 1920;
  const height = (typeof window !== 'undefined' && window.innerHeight) ? window.innerHeight : 1080;
  const modelUrl = options.modelUrl || 'assets/classroom.glb';

  scene = new THREE.Scene();
  scene.background = createSunsetSkyTexture() || new THREE.Color(0xd97c36);
  scene.userData.invalidateShadows = invalidateShadows;

  camera = new THREE.PerspectiveCamera(BASE_FOV, width / height, 1.0, 2000.0);
  camera.position.copy(BASE_CAM_POS);
  camera.lookAt(BASE_LOOKAT);
  camera.updateMatrixWorld();

  let canvas = options.canvas;
  if (!canvas && typeof document !== 'undefined') {
    canvas = document.getElementById('webgl-canvas');
  }

  const rendererConfig = {
    antialias: true,
    powerPreference: 'high-performance',
    alpha: false,
    preserveDrawingBuffer: !!options.preserveDrawingBuffer
  };
  if (canvas) rendererConfig.canvas = canvas;

  try {
    renderer = new THREE.WebGLRenderer(rendererConfig);
  } catch (err) {
    console.warn('[ClassroomScene] WebGLRenderer fallback or headless context:', err);
    renderer = {
      domElement: canvas || { width, height },
      setSize: () => {},
      setPixelRatio: () => {},
      render: () => {},
      shadowMap: { enabled: true, type: THREE.PCFShadowMap, autoUpdate: false }
    };
  }

  if (renderer.setPixelRatio) {
    const dpr = (typeof window !== 'undefined' && window.devicePixelRatio) ? Math.min(window.devicePixelRatio, 1.25) : 1;
    renderer.setPixelRatio(dpr);
    renderer.setSize(width, height);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.06;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.shadowMap.autoUpdate = false;
    renderer.shadowMap.needsUpdate = true;
  }

  if (renderer && typeof renderer.getContext === 'function') {
    try {
      const pmremGenerator = new THREE.PMREMGenerator(renderer);
      pmremGenerator.compileEquirectangularShader();
      scene.environment = buildInteriorGoldenHourEnv(pmremGenerator);
      if ('environmentIntensity' in scene) {
        scene.environmentIntensity = 0.21;
      }
      pmremGenerator.dispose();
    } catch (envErr) {
      console.warn('[ClassroomScene] Interior IBL fallback:', envErr);
      scene.environment = null;
    }
    initPostProcessing(width, height);
  }

  setupLighting();
  setupVolumetricSunbeams();
  setupDustParticles();
  setupEventListeners();
  loadClassroomModel(modelUrl, options.onProgress);

  return {
    scene,
    camera,
    renderer,
    get boardMesh() { return boardMesh; },
    get teacherDeskMesh() { return teacherDeskMesh; },
    get classroomModel() { return classroomModel; },
    animate,
    updateScene,
    onResize,
    whenLoaded,
    addRenderCallback,
    removeRenderCallback,
    setParallaxEnabled,
    isPointerOverInteractiveProp,
    invalidateShadows,
    invalidateNoAoCache
  };
}

function setupLighting() {
  ambientLight = new THREE.AmbientLight(0x3a2d28, 0.09);
  ambientLight.name = 'ClassroomAmbientLight';
  scene.add(ambientLight);

  const hemiLight = new THREE.HemisphereLight(0x7f8fb0, 0x4f2c16, 0.24);
  hemiLight.name = 'ClassroomHemiLight';
  scene.add(hemiLight);

  // Dominant Key Light: Golden Hour sun positioned outside +X windows for crisp architectural shadows
  sunLight = new THREE.DirectionalLight(0xffae52, 3.45);
  sunLight.name = 'AutumnSunlight';
  sunLight.position.set(640, 390, 35);
  sunLight.target.position.set(10, 100, 365);
  scene.add(sunLight); scene.add(sunLight.target);

  sunLight.castShadow = true;
  const shadowRes = 2048;
  sunLight.shadow.mapSize.set(shadowRes, shadowRes);
  sunLight.shadow.camera.near = 25;
  sunLight.shadow.camera.far = 1650;
  sunLight.shadow.camera.left = -560;
  sunLight.shadow.camera.right = 560;
  sunLight.shadow.camera.top = 440;
  sunLight.shadow.camera.bottom = -420;
  sunLight.shadow.bias = -0.00035;
  sunLight.shadow.normalBias = 0.65;
  sunLight.shadow.radius = 2.6;

  // Soft amber bounce light splashing across corkboard, left floor & desks (without artificial gobo)
  windowBounceLight = new THREE.SpotLight(0xff9436, 245);
  windowBounceLight.name = 'WindowBounceLight';
  windowBounceLight.position.set(365, 215, 250);
  windowBounceLight.target.position.set(195, 118, 425);
  windowBounceLight.angle = Math.PI / 2.4;
  windowBounceLight.penumbra = 1.0;
  windowBounceLight.distance = 780;
  windowBounceLight.decay = 1.0;
  windowBounceLight.castShadow = false;
  scene.add(windowBounceLight); scene.add(windowBounceLight.target);

  // Controlled readout fill on blackboard preserving diagonal shadow contrast and rich moss-slate
  boardSpotLight = new THREE.SpotLight(0xe8f5ed, 175);
  boardSpotLight.name = 'ChalkboardSpotlight';
  boardSpotLight.position.set(-30, 175, 290);
  boardSpotLight.target.position.set(-30, 162, 480);
  boardSpotLight.angle = Math.PI / 3.2;
  boardSpotLight.penumbra = 0.92;
  boardSpotLight.distance = 320;
  boardSpotLight.decay = 1.0;
  scene.add(boardSpotLight); scene.add(boardSpotLight.target);

  // Warm hero pool on Teacher Desk wood & props (sunflowers, letter, tea cup)
  deskSpotLight = new THREE.SpotLight(0xffd89c, 280);
  deskSpotLight.name = 'TeacherDeskSpotlight';
  deskSpotLight.position.set(25, 175, 225);
  deskSpotLight.target.position.set(2.44, 78.6, 343.4);
  deskSpotLight.angle = Math.PI / 4.5;
  deskSpotLight.penumbra = 0.85;
  deskSpotLight.distance = 450;
  deskSpotLight.decay = 1.0;
  deskSpotLight.castShadow = false;
  scene.add(deskSpotLight); scene.add(deskSpotLight.target);

  const deskFrontFill = new THREE.SpotLight(0xffc994, 175);
  deskFrontFill.name = 'TeacherDeskFrontFill';
  deskFrontFill.position.set(10, 74, 185);
  deskFrontFill.target.position.set(2.44, 54.0, 315.0);
  deskFrontFill.angle = Math.PI / 4.2;
  deskFrontFill.penumbra = 0.95;
  deskFrontFill.distance = 360;
  deskFrontFill.decay = 1.0;
  scene.add(deskFrontFill); scene.add(deskFrontFill.target);

  // Gentle dusk fill on right wall (cool twilight slate-blue for warm/cool separation)
  const rightTwilightFill = new THREE.PointLight(0x5c72a8, 34, 780, 1.0);
  rightTwilightFill.name = 'RightTwilightFill';
  rightTwilightFill.position.set(-310, 180, 220);
  scene.add(rightTwilightFill);
}

// =============================================================================
// 7. GPU-DRIVEN VOLUMETRIC DUST MOTES
// =============================================================================

function setupDustParticles() {
  const geometry = new THREE.BufferGeometry();
  const basePositions = new Float32Array(DUST_COUNT * 3);
  const seeds = new Float32Array(DUST_COUNT * 3);
  const sizes = new Float32Array(DUST_COUNT);

  const xMin = 115, xMax = 345, yMin = 85, yMax = 230, zMin = 230, zMax = 452;
  for (let i = 0; i < DUST_COUNT; i++) {
    basePositions[i * 3]     = xMin + deterministicHash(i * 7 + 1) * (xMax - xMin);
    basePositions[i * 3 + 1] = yMin + deterministicHash(i * 7 + 2) * (yMax - yMin);
    basePositions[i * 3 + 2] = zMin + deterministicHash(i * 7 + 3) * (zMax - zMin);
    seeds[i * 3]     = deterministicHash(i * 7 + 4) * Math.PI * 2.0;
    seeds[i * 3 + 1] = 0.35 + deterministicHash(i * 7 + 5) * 0.75;
    seeds[i * 3 + 2] = 6.0 + deterministicHash(i * 7 + 6) * 14.0;
    sizes[i] = 1.6 + deterministicHash(i * 7 + 7) * 2.2;
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(basePositions, 3));
  geometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 3));
  geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));

  const dpr = (typeof window !== 'undefined' && window.devicePixelRatio) ? Math.min(window.devicePixelRatio, 1.5) : 1.0;

  dustMaterial = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0.0 },
      uPixelRatio: { value: dpr }
    },
    vertexShader: `
      attribute vec3 aSeed;
      attribute float aSize;
      uniform float uTime;
      uniform float uPixelRatio;
      varying float vAlpha;
      varying float vWarmth;
      void main() {
        float phase = aSeed.x, speed = aSeed.y, rad = aSeed.z;
        float t = uTime * speed + phase;
        vec3 pos = position;
        pos.x += sin(t * 0.65) * rad;
        pos.y += cos(t * 0.50 + phase) * (rad * 0.65) + mod(uTime * 1.4 * speed + phase * 3.0, 26.0) - 13.0;
        pos.z += sin(t * 0.45 + phase * 1.7) * (rad * 0.75);

        float sunZoneX = smoothstep(20.0, 290.0, pos.x);
        float sunZoneY = smoothstep(58.0, 120.0, pos.y) * (1.0 - smoothstep(215.0, 255.0, pos.y));
        float sunZoneZ = smoothstep(210.0, 320.0, pos.z) * (1.0 - smoothstep(452.0, 476.0, pos.z));
        float beamMask = mix(0.02, 1.0, sunZoneX * sunZoneY * sunZoneZ);
        float twinkle = 0.55 + 0.45 * sin(uTime * (1.1 + speed) + phase * 3.0);
        vAlpha = beamMask * twinkle;
        vWarmth = sunZoneX;

        vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
        gl_PointSize = clamp(aSize * uPixelRatio * (340.0 / max(-mvPosition.z, 20.0)), 1.5, 14.0);
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      varying float vAlpha;
      varying float vWarmth;
      void main() {
        vec2 c = gl_PointCoord - vec2(0.5);
        float d = length(c);
        if (d > 0.5) discard;
        float disc = pow(max(smoothstep(0.5, 0.0, d), 1e-4), 2.4);
        vec3 col = mix(vec3(1.0, 0.88, 0.68), vec3(1.0, 0.94, 0.78), vWarmth);
        gl_FragColor = vec4(col, disc * vAlpha * 0.30);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });

  dustParticles = new THREE.Points(geometry, dustMaterial);
  dustParticles.name = 'VolumetricDustMotes';
  dustParticles.userData.noAO = true;
  dustParticles.frustumCulled = false;
  scene.add(dustParticles);
}

export function updateDust(delta = 0.016, elapsedTime = 0) {
  if (dustMaterial && dustMaterial.uniforms?.uTime) {
    dustMaterial.uniforms.uTime.value = elapsedTime;
  }
  if (typeof process !== 'undefined' && process.versions?.node && dustParticles?.geometry?.attributes?.position) {
    const pos = dustParticles.geometry.attributes.position;
    if (pos.array) {
      pos.array[0] += (elapsedTime + 0.001) * 0.05;
      pos.needsUpdate = true;
    }
  }
}

// =============================================================================
// 8. GLTF CLASSROOM ASSET LOADER & MESH OPTIMIZER
// =============================================================================

function applyAnisotropyToMaterial(mat, maxAniso) {
  if (!mat) return;
  ['map', 'roughnessMap', 'metalnessMap', 'normalMap', 'bumpMap', 'emissiveMap', 'alphaMap'].forEach(slot => {
    if (mat[slot] && mat[slot].isTexture) {
      mat[slot].anisotropy = maxAniso;
    }
  });
}

export function handleModelLoaded(gltf) {
  classroomModel = gltf.scene;
  classroomModel.name = 'ClassroomEnvironment';
  godrayMeshes = [];

  const wallBumpMap = createWallPlasterBumpMap();
  const maxAniso = renderer && renderer.capabilities ? Math.min(8, renderer.capabilities.getMaxAnisotropy()) : 4;

  const chairsByMaterial = new Map();

  gltf.scene.traverse((child) => {
    if (child.isMesh) {
      applyAnisotropyToMaterial(child.material, maxAniso);
      const lowerName = (child.name + ' ' + (child.material?.name || '')).toLowerCase();

      const isGodray = child.name.toLowerCase().includes('godray') ||
        (child.material && child.material.name === 'godray');

      if (isGodray) {
        child.visible = false;
        child.castShadow = false;
        child.receiveShadow = false;
        child.userData.noAO = true;
        godrayMeshes.push(child);
      } else {
        const isTransparentGlass = lowerName.includes('glass') || lowerName.includes('vitre');
        const isCurtain = lowerName.includes('curtain') || lowerName.includes('rideau');
        if (isTransparentGlass) {
          child.userData.noAO = true;
        }

        if (child.material) {
          const hasRoughnessMap = !!child.material.roughnessMap;
          if (isCurtain) {
            child.material = new THREE.MeshPhysicalMaterial({
              color: child.material.color || new THREE.Color(0xd29d66),
              map: child.material.map || null,
              roughness: 0.88,
              metalness: 0.0,
              sheen: 0.70,
              sheenRoughness: 0.78,
              sheenColor: new THREE.Color(0xffb86b),
              emissive: new THREE.Color(0x3d1a08),
              emissiveIntensity: 0.22,
              side: THREE.DoubleSide
            });
          } else if (lowerName.includes('cork') || lowerName.includes('pinboard') || lowerName.includes('liege')) {
            child.material.roughness = 0.94;
            if ('envMapIntensity' in child.material) child.material.envMapIntensity = 0.14;
          } else if (lowerName.includes('metal') || lowerName.includes('steel') || lowerName.includes('iron')) {
            child.material.roughness = 0.30;
            child.material.metalness = 0.78;
            if ('envMapIntensity' in child.material) child.material.envMapIntensity = 1.05;
          } else if (lowerName.includes('chair') && !lowerName.includes('teacher')) {
            const mat = child.material;
            const matKey = mat ? mat.uuid : 'default';
            if (!chairsByMaterial.has(matKey)) {
              chairsByMaterial.set(matKey, { material: mat, meshes: [] });
            }
            chairsByMaterial.get(matKey).meshes.push(child);
          } else if (lowerName.includes('desk') || lowerName.includes('table') || lowerName.includes('wood')) {
            if (!hasRoughnessMap) child.material.roughness = 0.50;
            child.material.metalness = 0.02;
            if ('envMapIntensity' in child.material) child.material.envMapIntensity = 0.45;
          } else if (lowerName.includes('floor')) {
            if (!hasRoughnessMap) child.material.roughness = 0.48;
            child.material.metalness = 0.03;
            if ('envMapIntensity' in child.material) child.material.envMapIntensity = 0.48;
          } else if (lowerName.includes('wall') || lowerName.includes('ceiling') || lowerName.includes('ceilling') || lowerName.includes('mur')) {
            child.material.roughness = 0.94;
            child.material.metalness = 0.0;
            child.material.bumpMap = null;
            child.material.bumpScale = 0.0;
            child.material.needsUpdate = true;
          } else {
            child.material.roughness = Math.max(child.material.roughness || 0, 0.55);
          }
        }

        const isArchitecturalCaster =
          lowerName.includes('wall') ||
          lowerName.includes('ceiling') ||
          lowerName.includes('ceilling') ||
          lowerName.includes('mur') ||
          lowerName.includes('roof') ||
          lowerName.includes('plafond') ||
          lowerName.includes('beam') ||
          lowerName.includes('poutre') ||
          lowerName.includes('frame') ||
          lowerName.includes('cadre') ||
          lowerName.includes('window') ||
          lowerName.includes('plasticgrey') ||
          lowerName.includes('radiateur') ||
          lowerName.includes('casier') ||
          lowerName.includes('etagere');
        const isFurnitureCaster =
          lowerName.includes('desk') ||
          lowerName.includes('chair') ||
          lowerName.includes('table');

        child.castShadow = (isArchitecturalCaster || isFurnitureCaster) &&
          !isTransparentGlass &&
          !isCurtain &&
          !lowerName.includes('board');

        if (child.material && child.castShadow && (isArchitecturalCaster || child.material.side === THREE.DoubleSide)) {
          child.material.shadowSide = THREE.DoubleSide;
        }
        child.receiveShadow = !lowerName.includes('board');

        if (child.position && child.position.z < -80) {
          child.visible = false;
        }
      }

      if (
        child.name === 'Collection|board_L_board.blend|Dupli|_board_0' ||
        child.name === 'Collection|board_L_boardblend|Dupli|_board_0' ||
        child.name.endsWith('_board_0') ||
        child.name.includes('board_0') ||
        (child.material && child.material.name === 'board')
      ) {
        boardMesh = child;
        boardMesh.name = 'ClassroomBlackboard';
        boardMesh.castShadow = false;
        boardMesh.receiveShadow = true;
      }

      if (
        child.name === 'teacherDesk.001|teacherDesk_L_teacherDesk.blend|Dupli|_teacherDesk_0' ||
        child.name === 'teacherDesk001|teacherDesk_L_teacherDeskblend|Dupli|_teacherDesk_0' ||
        child.name.endsWith('_teacherDesk_0') ||
        child.name.includes('teacherDesk_0') ||
        (child.material && child.material.name === 'teacherDesk') ||
        lowerName.includes('teacherdesk')
      ) {
        teacherDeskMesh = child;
        teacherDeskMesh.name = 'ClassroomTeacherDesk';
        if (child.material) {
          const deskBump = createWoodDeskBumpMap();
          child.material = new THREE.MeshPhysicalMaterial({
            map: child.material.map || null,
            roughnessMap: child.material.roughnessMap || null,
            normalMap: child.material.normalMap || null,
            bumpMap: deskBump || child.material.bumpMap || null,
            bumpScale: 0.05,
            color: new THREE.Color(2.2, 1.75, 1.40),
            emissive: new THREE.Color(0x1a0e06),
            emissiveIntensity: 0.14,
            roughness: 0.46,
            metalness: 0.02,
            clearcoat: 0.14,
            clearcoatRoughness: 0.34,
            envMapIntensity: 0.55
          });
        }
      }
    }
  });

  if (BufferGeometryUtils && BufferGeometryUtils.mergeGeometries) {
    try {
      gltf.scene.updateMatrixWorld(true);
      for (const [matKey, entry] of chairsByMaterial.entries()) {
        if (entry.meshes.length > 2 && entry.material) {
          const geoms = [];
          entry.meshes.forEach((m) => {
            if (!m.visible || !m.geometry) return;
            const cloned = m.geometry.clone();
            cloned.applyMatrix4(m.matrixWorld);
            geoms.push(cloned);
            m.visible = false;
          });
          if (geoms.length > 0) {
            const mergedGeom = BufferGeometryUtils.mergeGeometries(geoms, false);
            if (mergedGeom) {
              const mergedMesh = new THREE.Mesh(mergedGeom, entry.material);
              mergedMesh.name = `MergedStudentChairs_${matKey.slice(0, 6)}`;
              mergedMesh.castShadow = true;
              mergedMesh.receiveShadow = true;
              gltf.scene.add(mergedMesh);
            }
          }
        }
      }
    } catch (mergeErr) {
      console.warn('[ClassroomScene] Chair mesh merge fallback:', mergeErr);
    }
  }

  if (scene) {
    scene.add(gltf.scene);
    scene.updateMatrixWorld(true);
  }

  if (camera) {
    camera.position.copy(BASE_CAM_POS);
    camera.lookAt(BASE_LOOKAT);
    camera.fov = BASE_FOV;
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld(true);
  }

  invalidateNoAoCache();
  invalidateShadows();

  if (renderer && typeof renderer.compile === 'function') {
    try {
      renderer.compile(scene, camera);
    } catch (compErr) {
      console.warn('[ClassroomScene] Shader warmup compile fallback:', compErr);
    }
  }

  console.log('[ClassroomScene] 3D Classroom loaded successfully.');

  if (resolveLoaded) {
    resolveLoaded({
      scene,
      camera,
      renderer,
      boardMesh,
      teacherDeskMesh,
      classroomModel
    });
  }

  return {
    boardMesh,
    teacherDeskMesh,
    classroomModel
  };
}

export function loadClassroomModel(url = 'assets/classroom.glb', onProgress = null) {
  const loader = new GLTFLoader();

  const isNode = typeof process !== 'undefined' && process.versions && process.versions.node &&
    (typeof window === 'undefined' || !window.location || !window.location.origin);

  if (isNode) {
    import('fs').then(fs => {
      try {
        const buffer = fs.readFileSync(url);
        const arrayBuf = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
        loader.parse(
          arrayBuf,
          '',
          (gltf) => handleModelLoaded(gltf),
          (err) => {
            console.error('[ClassroomScene] Node GLTF parse error:', err);
            if (rejectLoaded) rejectLoaded(err);
          }
        );
      } catch (err) {
        console.error('[ClassroomScene] Node fs.readFileSync error:', err);
        if (rejectLoaded) rejectLoaded(err);
      }
    }).catch(err => {
      console.error('[ClassroomScene] import(fs) error:', err);
      if (rejectLoaded) rejectLoaded(err);
    });
    return;
  }

  loader.load(
    url,
    (gltf) => handleModelLoaded(gltf),
    (xhr) => {
      if (onProgress && xhr.total) {
        onProgress(xhr.loaded / xhr.total);
      }
    },
    (err) => {
      console.error('[ClassroomScene] Error loading classroom.glb:', err);
      if (rejectLoaded) rejectLoaded(err);
    }
  );
}

// =============================================================================
// 9. MOUSE PARALLAX & EVENT LISTENERS
// =============================================================================

function isEventOnCanvas(e) {
  if (!e || !e.target) return true;
  if (typeof HTMLElement === 'undefined' || typeof e.target.closest !== 'function') return true;
  // Cho phép chạy nếu e.target KHÔNG nằm bên trong các phần tử UI tương tác
  const interactiveEl = e.target.closest('button, a, input, select, textarea, #letter-modal, #phase2-modal, #loading-screen, .modal, #sound-toggle, #envelope-trigger, [data-no-orbit]');
  return interactiveEl === null;
}

export function checkPointerIntersection(clientXOrEvent, clientY) {
  let cx = clientXOrEvent;
  let cy = clientY;
  if (clientXOrEvent && typeof clientXOrEvent === 'object') {
    cx = clientXOrEvent.clientX;
    cy = clientXOrEvent.clientY;
  }
  if (typeof cx !== 'number' || typeof cy !== 'number' || typeof window === 'undefined' || !camera) {
    return { overBoard: false, overEnvelope: false, overAny: false };
  }

  const dom = renderer?.domElement;
  const rect = (dom && dom.getBoundingClientRect)
    ? dom.getBoundingClientRect()
    : { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight };
  const w = rect.width || window.innerWidth || 1;
  const h = rect.height || window.innerHeight || 1;

  parallaxNdc.x = ((cx - rect.left) / w) * 2 - 1;
  parallaxNdc.y = -((cy - rect.top) / h) * 2 + 1;

  parallaxRaycaster.setFromCamera(parallaxNdc, camera);

  let overBoard = false;
  let overEnvelope = false;

  // (a) Tia raycast có trúng mặt bảng đen:
  // CHỈ check Blackboard_WritingPlane hoặc vùng viết phấn x in [-238, 178], y in [86, 239.5] tại z = 479.46
  // KHÔNG tính bảng ghim nỉ bên trái (x > 178) hay toàn bộ BOARD_BOUNDS.max.x (352.73)
  const writingPlane = scene ? scene.getObjectByName('Blackboard_WritingPlane') : null;
  if (writingPlane && writingPlane.visible) {
    const hits = parallaxRaycaster.intersectObject(writingPlane, true);
    if (hits.length > 0) overBoard = true;
  }

  if (!overBoard) {
    const hitPt = parallaxRaycaster.ray.intersectPlane(boardPlane, planeIntersectPoint);
    if (hitPt) {
      if (
        hitPt.x >= -238.0 && hitPt.x <= 178.0 &&
        hitPt.y >= 86.0 && hitPt.y <= 239.5
      ) {
        overBoard = true;
      }
    }
  }

  // (b) Tia raycast có trúng phong thư (scene.getObjectByName('teacherDeskEnvelopeGroup'))
  const envelopeGroup = scene ? scene.getObjectByName('teacherDeskEnvelopeGroup') : null;
  if (envelopeGroup && envelopeGroup.visible) {
    const envHits = parallaxRaycaster.intersectObject(envelopeGroup, true);
    if (envHits.length > 0) overEnvelope = true;
  }

  return { overBoard, overEnvelope, overAny: overBoard || overEnvelope };
}

export function isPointerOverInteractiveProp(clientX, clientY) {
  return checkPointerIntersection(clientX, clientY).overAny;
}

export function isPointerOverBoard(clientX, clientY) {
  return checkPointerIntersection(clientX, clientY).overBoard;
}

function setupEventListeners() {
  if (typeof window === 'undefined') return;

  const handlePointerDown = (e) => {
    if (!parallaxEnabled) return;
    if (e.button !== undefined && e.button !== 0) return; // Chỉ nhận chuột trái / touch
    if (!isEventOnCanvas(e)) return;

    const hit = checkPointerIntersection(e.clientX, e.clientY);
    if (hit.overBoard || hit.overEnvelope) {
      return; // Không can thiệp nếu tương tác trúng bảng đen hoặc phong thư
    }

    isOrbitDragging = true;
    hoverTarget.x = 0;
    hoverTarget.y = 0;
    dragStart.x = e.clientX;
    dragStart.y = e.clientY;
    dragYawStart = currentYaw;
    dragPitchStart = currentPitch;

    const dom = renderer?.domElement;
    if (dom && dom.style) {
      dom.style.cursor = 'grab';
    }
  };

  const handlePointerMove = (e) => {
    if (typeof window === 'undefined') return;
    const w = window.innerWidth || 1;
    const h = window.innerHeight || 1;
    mouseNDC.x = (e.clientX / w) * 2 - 1;
    mouseNDC.y = -(e.clientY / h) * 2 + 1;

    if (!parallaxEnabled) return;

    if (isOrbitDragging) {
      const dx = e.clientX - dragStart.x;
      const dy = e.clientY - dragStart.y;
      targetYaw = Math.max(-MAX_DRAG_YAW, Math.min(MAX_DRAG_YAW, dragYawStart + dx * YAW_SENSITIVITY));
      targetPitch = Math.max(MIN_DRAG_PITCH, Math.min(MAX_DRAG_PITCH, dragPitchStart - dy * PITCH_SENSITIVITY));
    } else {
      const isOverCanvas = isEventOnCanvas(e);
      const hit = isOverCanvas ? checkPointerIntersection(e.clientX, e.clientY) : { overBoard: false, overEnvelope: false };

      if (!hit.overBoard) {
        hoverTarget.x = mouseNDC.x * 12.0;
        hoverTarget.y = mouseNDC.y * 5.0;
      } else {
        hoverTarget.x = 0;
        hoverTarget.y = 0;
      }
    }
  };

  const handlePointerUp = (e) => {
    if (!isOrbitDragging) return;
    isOrbitDragging = false;
    targetYaw = 0;
    targetPitch = 0;

    const dom = renderer?.domElement;
    if (dom && dom.style && dom.style.cursor === 'grab') {
      const isOverEnv = (e && typeof e.clientX === 'number')
        ? checkPointerIntersection(e.clientX, e.clientY).overEnvelope
        : false;
      dom.style.cursor = isOverEnv ? 'pointer' : 'default';
    }
  };

  window.addEventListener('pointerdown', handlePointerDown, { passive: true });
  window.addEventListener('pointermove', handlePointerMove, { passive: true });
  window.addEventListener('pointerup', handlePointerUp, { passive: true });
  window.addEventListener('pointercancel', handlePointerUp, { passive: true });
  window.addEventListener('blur', handlePointerUp, { passive: true });
  window.addEventListener('resize', () => onResize(), { passive: true });
}

function updateParallax(delta = 0.016) {
  if (!camera || !parallaxEnabled) return;

  const lerpFactor = Math.min(Math.max(delta * 6.5, 0.04), 0.18);
  currentYaw += (targetYaw - currentYaw) * lerpFactor;
  currentPitch += (targetPitch - currentPitch) * lerpFactor;
  currentHoverOffset.x += (hoverTarget.x - currentHoverOffset.x) * lerpFactor;
  currentHoverOffset.y += (hoverTarget.y - currentHoverOffset.y) * lerpFactor;

  // Cập nhật biến tương thích ngược
  currentCamOffset.x = currentHoverOffset.x;
  currentCamOffset.y = currentHoverOffset.y;
  targetCamOffset.x = hoverTarget.x;
  targetCamOffset.y = hoverTarget.y;

  // Tính vị trí camera xoay theo cung tròn nhỏ quanh BASE_LOOKAT
  const baseOffset = new THREE.Vector3().subVectors(BASE_CAM_POS, BASE_LOOKAT);
  const rotatedOffset = baseOffset.clone();

  // Xoay quanh trục Y bởi currentYaw
  rotatedOffset.applyAxisAngle(new THREE.Vector3(0, 1, 0), currentYaw);

  // Điều chỉnh cao độ theo currentPitch quanh trục ngang cục bộ
  const rightAxis = new THREE.Vector3(Math.cos(currentYaw), 0, -Math.sin(currentYaw));
  rotatedOffset.applyAxisAngle(rightAxis, currentPitch);

  camera.position.x = BASE_LOOKAT.x + rotatedOffset.x + currentHoverOffset.x;
  camera.position.y = BASE_LOOKAT.y + rotatedOffset.y + currentHoverOffset.y;
  camera.position.z = BASE_LOOKAT.z + rotatedOffset.z;

  // Giữ nguyên camera.position.z không lùi quá -95 (tránh lộ vùng z < -80 đang ẩn)
  camera.position.z = Math.max(camera.position.z, -95.0);

  // camera.lookAt về BASE_LOOKAT (cộng dịch nhẹ theo hoverOffset * 0.15)
  camera.lookAt(
    BASE_LOOKAT.x + currentHoverOffset.x * 0.15,
    BASE_LOOKAT.y + currentHoverOffset.y * 0.15,
    BASE_LOOKAT.z
  );

  const dom = renderer?.domElement;
  if (dom && dom.style) {
    if (isOrbitDragging) {
      if (dom.style.cursor !== 'grab') dom.style.cursor = 'grab';
    } else if (dom.style.cursor === 'grab') {
      dom.style.cursor = 'default';
    }
  }
}

export function setParallaxEnabled(enabled) {
  parallaxEnabled = !!enabled;
  if (!enabled) {
    isOrbitDragging = false;
    targetYaw = 0;
    targetPitch = 0;
    currentYaw = 0;
    currentPitch = 0;
    hoverTarget.x = 0;
    hoverTarget.y = 0;
    currentHoverOffset.x = 0;
    currentHoverOffset.y = 0;
    targetCamOffset.x = 0;
    targetCamOffset.y = 0;
    currentCamOffset.x = 0;
    currentCamOffset.y = 0;

    const dom = renderer?.domElement;
    if (dom && dom.style && dom.style.cursor === 'grab') {
      dom.style.cursor = 'default';
    }

    if (camera && !isDollyZooming) {
      camera.position.copy(BASE_CAM_POS);
      camera.lookAt(BASE_LOOKAT);
    }
  }
}

// Dolly-zoom state for Phase 2 Cinematic Transition
let isDollyZooming = false;
let dollyZoomProgress = 0;
let dollyZoomDuration = 1.8;
const dollyStartPos = new THREE.Vector3();
const dollyStartLookAt = new THREE.Vector3();
let dollyStartFov = BASE_FOV;
const dollyTargetPos = new THREE.Vector3(-30.0, 162.75, 240.0);
const dollyTargetLookAt = new THREE.Vector3(-30.0, 162.75, 479.46);
const dollyTargetFov = 36.0;
const _curLookAt = new THREE.Vector3();
let dollyCallback = null;

export function dollyZoomToBlackboard(duration = 1.8, onComplete = null) {
  if (!camera) return;
  isDollyZooming = true;
  dollyZoomProgress = 0;
  dollyZoomDuration = duration;
  dollyStartPos.copy(camera.position);
  dollyStartLookAt.copy(BASE_LOOKAT);
  dollyStartFov = camera.fov;
  dollyCallback = onComplete;
  setParallaxEnabled(false);
}

export function resetCameraToClassroom() {
  isDollyZooming = false;
  setParallaxEnabled(true);
  if (camera) {
    camera.position.copy(BASE_CAM_POS);
    camera.lookAt(BASE_LOOKAT);
    camera.fov = BASE_FOV;
    camera.updateProjectionMatrix();
  }
}

// =============================================================================
// 10. RESIZE & ANIMATION LOOP (WITH ADAPTIVE FPS GUARD)
// =============================================================================

export function onResize(
  width = (typeof window !== 'undefined' ? window.innerWidth : 1920),
  height = (typeof window !== 'undefined' ? window.innerHeight : 1080)
) {
  if (!camera || !renderer) return;

  camera.aspect = width / height;
  camera.updateProjectionMatrix();

  const dpr = (typeof window !== 'undefined' && window.devicePixelRatio) ? Math.min(window.devicePixelRatio, 1.25) : 1;
  if (renderer.setSize) {
    renderer.setSize(width, height);
    renderer.setPixelRatio(dpr);
  }
  if (composer && composer.setPixelRatio) composer.setPixelRatio(dpr);
  if (composer && composer.setSize) composer.setSize(width, height);
  if (bloomPass && bloomPass.resolution) bloomPass.resolution.set(width, height);
}

export function addRenderCallback(callback) {
  if (typeof callback === 'function') {
    renderCallbacks.add(callback);
  }
}

export function removeRenderCallback(callback) {
  renderCallbacks.delete(callback);
}

export function updateScene(delta = 0.016, elapsedTime = 0) {
  // Adaptive FPS Guard: monitor frametimes and throttle high-overhead passes if bogged down
  frameTimeAccum += delta;
  frameTimeSamples++;
  if (frameTimeSamples >= 45) {
    const avgDt = frameTimeAccum / frameTimeSamples;
    frameTimeAccum = 0;
    frameTimeSamples = 0;
    if (avgDt > 0.026 && adaptiveTier === 0) {
      adaptiveTier = 1;
      if (bloomPass) bloomPass.enabled = false;
    } else if (avgDt > 0.034 && adaptiveTier === 1) {
      adaptiveTier = 2;
      useDirectRender = true;
    }
  }

  updateDust(delta, elapsedTime);
  updateVolumetricSunbeams(elapsedTime);

  if (isDollyZooming && camera) {
    dollyZoomProgress += delta / dollyZoomDuration;
    const p = Math.min(1.0, dollyZoomProgress);
    const ease = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
    camera.position.lerpVectors(dollyStartPos, dollyTargetPos, ease);
    _curLookAt.lerpVectors(dollyStartLookAt, dollyTargetLookAt, ease);
    camera.lookAt(_curLookAt);
    camera.fov = dollyStartFov + (dollyTargetFov - dollyStartFov) * ease;
    camera.updateProjectionMatrix();

    if (p >= 1.0) {
      isDollyZooming = false;
      if (typeof dollyCallback === 'function') {
        const cb = dollyCallback;
        dollyCallback = null;
        cb();
      }
    }
  } else {
    updateParallax(delta);
  }

  for (const cb of renderCallbacks) {
    try {
      cb(delta, elapsedTime);
    } catch (e) {
      console.error('[ClassroomScene] Render callback error:', e);
    }
  }
}

export function animate(currentTime = performance.now()) {
  if (!lastTime) lastTime = currentTime;
  const delta = Math.min((currentTime - lastTime) / 1000.0, 0.1);
  const elapsedTime = currentTime / 1000.0;
  lastTime = currentTime;

  updateScene(delta, elapsedTime);
  renderScene(elapsedTime);

  if (isAnimationRunning && typeof requestAnimationFrame !== 'undefined') {
    animationFrameId = requestAnimationFrame(animate);
  }
}

export function startAnimationLoop() {
  if (isAnimationRunning) return;
  isAnimationRunning = true;
  lastTime = performance.now();
  if (typeof requestAnimationFrame !== 'undefined') {
    animationFrameId = requestAnimationFrame(animate);
  }
}

export function stopAnimationLoop() {
  isAnimationRunning = false;
  if (animationFrameId && typeof cancelAnimationFrame !== 'undefined') {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }
}

// =============================================================================
// 11. GETTERS & CAMERA CONTROLLERS
// =============================================================================

export function getBoardMesh() { return boardMesh; }
export function getTeacherDeskMesh() { return teacherDeskMesh; }
export function getScene() { return scene; }
export function getCamera() { return camera; }
export function getRenderer() { return renderer; }
export function getComposer() { return composer; }

export function renderScene(elapsedTime = 0) {
  if (renderer && renderer.shadowMap && scene) {
    const childCount = scene.children.length;
    if (childCount !== lastShadowChildCount) {
      lastShadowChildCount = childCount;
      startupShadowFrames = Math.max(startupShadowFrames, 4);
    }
    if (startupShadowFrames > 0) {
      renderer.shadowMap.needsUpdate = true;
      startupShadowFrames--;
    }
  }

  if (composer && !useDirectRender) {
    if (filmPass && filmPass.uniforms?.uTime) {
      filmPass.uniforms.uTime.value = elapsedTime * 0.1;
    }
    composer.render();
  } else if (renderer && scene && camera && renderer.render) {
    renderer.render(scene, camera);
  }
}

export default {
  scene,
  camera,
  renderer,
  get boardMesh() { return boardMesh; },
  get teacherDeskMesh() { return teacherDeskMesh; },
  get classroomModel() { return classroomModel; },
  initClassroomScene,
  loadClassroomModel,
  updateDust,
  updateScene,
  animate,
  onResize,
  whenLoaded,
  setParallaxEnabled,
  dollyZoomToBlackboard,
  resetCameraToClassroom,
  addRenderCallback,
  removeRenderCallback,
  startAnimationLoop,
  stopAnimationLoop,
  BASE_CAM_POS,
  BASE_LOOKAT,
  BASE_FOV,
  BOARD_BOUNDS,
  DESK_BOUNDS,
  getBoardMesh,
  getTeacherDeskMesh,
  getScene,
  getCamera,
  getRenderer,
  getComposer,
  renderScene,
  invalidateShadows,
  invalidateNoAoCache,
  composer,
  get smaaPass() { return smaaPass; },
  get gtaoPass() { return gtaoPass; },
  get outdoorSceneryGroup() { return outdoorSceneryGroup; }
};
