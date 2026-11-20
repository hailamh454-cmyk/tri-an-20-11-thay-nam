/**
 * js/scene/teacherDeskInteract.js
 * 3D Kraft Envelope with Crimson Wax Seal & Tribute Letter Interaction.
 * 
 * Features:
 * - Placed precisely on the Teacher Desk surface (X ≈ 2.44, Y = 78.60, Z ≈ 343.40).
 * - High-fidelity 3D Kraft paper envelope with procedural vintage calligraphy & postal stamp.
 * - 3D Crimson wax seal stamped with embossed "20/11" emblem and glossy wax specular.
 * - Flap opening kinematics (pivots backwards) with parchment letter slide-out.
 * - Raycasting hover & click interactions:
 *   * Hover: Golden autumn aura light, soft desk pool halo, and gentle floating lift.
 *   * Click: Plays procedural sound via soundSynthesizer.js, unfolds flap, and displays handwritten letter modal.
 * - Seamless integration with DOM letter modal and Three.js scene loop.
 * 
 * Complies with Google Antigravity 3D WebGL & Physics Standards.
 */

import * as THREE from 'three';
import { soundSynthesizer } from '../audio/soundSynthesizer.js';

// Exported State
export let envelopeMesh = null; // Root THREE.Group for the envelope prop
export let isLetterOpen = false;

// Internal Module State
let activeScene = null;
let activeCamera = null;
let activeDomElement = null;

let flapPivot = null;
let waxSealGroup = null;
let letterPaperMesh = null;
let auraLight = null;
let auraHaloMesh = null;
let contactShadowMesh = null;
let sparklePoints = null;
let steamPoints = null;
let steamBaseY = [];

let deskPropsGroup = null;
let basePosition = new THREE.Vector3(2.44, 78.60 + 0.14, 343.40);
let currentOffsetY = 0;
let targetOffsetY = 0;

let hoverFactor = 0; // 0.0 -> 1.0
let openFactor = 0;  // 0.0 -> 1.0
let isHovered = false;
let animationTime = 0;

let boundTarget = null, boundPointerMove = null, boundPointerDown = null, boundKeyDown = null;

function deterministicHash(n) {
  const s = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
  return s - Math.floor(s);
}

function createKraftPaperSurfaceMaps() {
  if (typeof document === 'undefined') return { bumpMap: null, roughnessMap: null };
  const size = 512;
  const bCanvas = document.createElement('canvas'); bCanvas.width = size; bCanvas.height = size;
  const bCtx = bCanvas.getContext('2d');
  if (!bCtx || typeof bCtx.createImageData !== 'function') return { bumpMap: null, roughnessMap: null };

  const bImg = bCtx.createImageData(size, size);
  const bBuf = new Uint32Array(bImg.data.buffer);
  bBuf.fill(0xff808080); // mid-gray baseline

  for (let i = 0; i < 6500; i++) {
    const x = Math.floor(deterministicHash(i * 5 + 1) * (size - 1));
    const y = Math.floor(deterministicHash(i * 5 + 2) * (size - 1));
    const len = Math.floor(2 + deterministicHash(i * 5 + 3) * 7);
    const v = Math.floor(106 + deterministicHash(i * 5 + 5) * 44);
    const col = (0xff << 24) | (v << 16) | (v << 8) | v;
    for (let k = 0; k < len; k++) {
      const px = x + k;
      if (px >= size) break;
      bBuf[y * size + px] = col;
    }
  }
  bCtx.putImageData(bImg, 0, 0);

  const rCanvas = document.createElement('canvas'); rCanvas.width = size; rCanvas.height = size;
  const rCtx = rCanvas.getContext('2d');
  if (!rCtx || typeof rCtx.createImageData !== 'function') return { bumpMap: null, roughnessMap: null };
  const rImg = rCtx.createImageData(size, size);
  const rBuf = new Uint32Array(rImg.data.buffer);
  rBuf.fill(0xffdcdcdc); // rough kraft paper ~0.86
  for (let i = 0; i < 4000; i++) {
    const rx = Math.floor(deterministicHash(i * 7 + 1) * (size - 1));
    const ry = Math.floor(deterministicHash(i * 7 + 2) * (size - 1));
    const rv = Math.floor(205 + deterministicHash(i * 7 + 3) * 45);
    rBuf[ry * size + rx] = (0xff << 24) | (rv << 16) | (rv << 8) | rv;
  }
  rCtx.putImageData(rImg, 0, 0);

  const bumpMap = new THREE.CanvasTexture(bCanvas);
  bumpMap.wrapS = THREE.RepeatWrapping; bumpMap.wrapT = THREE.RepeatWrapping; bumpMap.repeat.set(2, 2);
  const roughnessMap = new THREE.CanvasTexture(rCanvas);
  roughnessMap.wrapS = THREE.RepeatWrapping; roughnessMap.wrapT = THREE.RepeatWrapping;
  return { bumpMap, roughnessMap };
}

function createSoftSparkleTexture() {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas'); canvas.width = 32; canvas.height = 32;
  const ctx = canvas.getContext('2d');
  if (!ctx || typeof ctx.createRadialGradient !== 'function') return null;
  const grad = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
  grad.addColorStop(0.0, 'rgba(255, 248, 220, 0.95)');
  grad.addColorStop(0.4, 'rgba(254, 232, 160, 0.45)');
  grad.addColorStop(1.0, 'rgba(254, 232, 160, 0.0)');
  ctx.fillStyle = grad; ctx.fillRect(0, 0, 32, 32);
  const tex = new THREE.CanvasTexture(canvas);
  tex.minFilter = THREE.LinearFilter;
  return tex;
}

const raycaster = new THREE.Raycaster();
const mouseNdc = new THREE.Vector2(-999, -999);
const envelopeHitSphere = new THREE.Sphere(new THREE.Vector3(2.44, 78.75, 343.40), 22.0);

/**
 * Creates a high-resolution CanvasTexture for the Kraft envelope top face.
 * Features realistic paper fibers, vintage postal stamp, and handwritten calligraphy.
 */
function createKraftFaceTexture() {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 680;
  const ctx = canvas.getContext('2d');
  if (!ctx || typeof ctx.createLinearGradient !== 'function') return null;

  // 1. Warm vintage Kraft paper background
  const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  grad.addColorStop(0, '#c8a577');
  grad.addColorStop(0.5, '#bc9665');
  grad.addColorStop(1, '#ab8454');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // 2. Procedural paper fibers / grain noise using fast Uint32Array
  if (typeof ctx.createImageData === 'function') {
    const fiberCanvas = document.createElement('canvas');
    fiberCanvas.width = canvas.width;
    fiberCanvas.height = canvas.height;
    const fCtx = fiberCanvas.getContext('2d');
    if (fCtx && typeof fCtx.createImageData === 'function') {
      const fImg = fCtx.createImageData(canvas.width, canvas.height);
      const fBuf = new Uint32Array(fImg.data.buffer);
      fBuf.fill(0); // transparent
      for (let i = 0; i < 8000; i++) {
        const fx = Math.floor(deterministicHash(i * 3 + 1) * (canvas.width - 6));
        const fy = Math.floor(deterministicHash(i * 3 + 2) * canvas.height);
        const flen = Math.floor(1 + deterministicHash(i * 3 + 3) * 5);
        const fa = Math.floor((0.03 + deterministicHash(i * 3 + 4) * 0.05) * 255);
        const fCol = (fa << 24) | (24 << 16) | (44 << 8) | 74;
        for (let k = 0; k < flen; k++) {
          fBuf[fy * canvas.width + fx + k] = fCol;
        }
      }
      fCtx.putImageData(fImg, 0, 0);
      ctx.drawImage(fiberCanvas, 0, 0);
    }
  }

  // 3. Envelope Fold Crease Lines (faint darker diagonal shading)
  ctx.strokeStyle = 'rgba(100, 65, 35, 0.15)';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(canvas.width / 2, canvas.height * 0.58);
  ctx.lineTo(canvas.width, 0);
  ctx.moveTo(0, canvas.height);
  ctx.lineTo(canvas.width / 2, canvas.height * 0.58);
  ctx.lineTo(canvas.width, canvas.height);
  ctx.stroke();

  // 4. Vintage Postage Stamp (Top Right)
  const stampX = canvas.width - 190;
  const stampY = 40;
  const stampW = 140;
  const stampH = 170;

  // Stamp perforated edge background
  ctx.fillStyle = '#faf4e6';
  ctx.fillRect(stampX - 5, stampY - 5, stampW + 10, stampH + 10);

  // Stamp inner artwork
  ctx.fillStyle = '#8f1c1f';
  ctx.fillRect(stampX, stampY, stampW, stampH);

  ctx.strokeStyle = '#fef08a';
  ctx.lineWidth = 2;
  ctx.strokeRect(stampX + 6, stampY + 6, stampW - 12, stampH - 12);

  ctx.fillStyle = '#fef08a';
  ctx.font = 'bold 16px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('VIỆT NAM', stampX + stampW / 2, stampY + 28);
  ctx.font = 'bold 26px serif';
  ctx.fillText('20/11', stampX + stampW / 2, stampY + 70);

  // Stamped atom emblem inside postage stamp
  ctx.strokeStyle = '#fef08a';
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.arc(stampX + stampW / 2, stampY + 115, 18, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(stampX + stampW / 2, stampY + 115, 24, 9, Math.PI / 4, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(stampX + stampW / 2, stampY + 115, 24, 9, -Math.PI / 4, 0, Math.PI * 2);
  ctx.stroke();

  // 5. Postal Postmark Ink Stamp (Overlapping circular stamp)
  ctx.save();
  ctx.strokeStyle = 'rgba(30, 20, 15, 0.45)';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(stampX - 25, stampY + 65, 45, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(stampX - 25, stampY + 65, 30, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = 'rgba(30, 20, 15, 0.55)';
  ctx.font = 'bold 11px sans-serif';
  ctx.fillText('BƯU CHÍNH VN', stampX - 25, stampY + 45);
  ctx.fillText('20 . 11 . 2026', stampX - 25, stampY + 68);
  ctx.fillText('HÀ NỘI', stampX - 25, stampY + 86);

  // Wavy postmark cancel lines
  for (let w = -2; w <= 2; w++) {
    ctx.beginPath();
    const yOff = stampY + 65 + w * 9;
    ctx.moveTo(stampX + 15, yOff);
    ctx.bezierCurveTo(stampX + 35, yOff - 5, stampX + 55, yOff + 5, stampX + 75, yOff);
    ctx.stroke();
  }
  ctx.restore();

  // 6. Handwritten Calligraphy Address
  ctx.save();
  ctx.fillStyle = '#2c180e';
  ctx.textAlign = 'left';

  // Sender line (top left)
  ctx.font = 'italic 20px serif';
  ctx.fillText('Học trò Hải Lâm', 60, 75);

  // Recipient lines (center)
  ctx.font = 'bold italic 44px serif';
  ctx.fillText('Kính gửi: Thầy Nam', 140, 390);

  ctx.font = 'italic 26px serif';
  ctx.fillStyle = '#422415';
  ctx.fillText('Chủ nhiệm Đội tuyển HSG Quốc Gia môn Vật Lý', 145, 440);
  ctx.fillText('Trường THPT Chuyên', 145, 480);
  ctx.restore();

  // 7. Subtle Gold Leaf Border Line
  ctx.strokeStyle = 'rgba(217, 119, 6, 0.4)';
  ctx.lineWidth = 2;
  ctx.strokeRect(20, 20, canvas.width - 40, canvas.height - 40);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  return texture;
}

function createWaxSealBumpMap() {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = 256; canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (!ctx || typeof ctx.createRadialGradient !== 'function') return null;

  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, 256, 256);
  const cx = 128, cy = 128;

  // Stamped rim
  ctx.strokeStyle = '#c4c4c4';
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.arc(cx, cy, 96, 0, Math.PI * 2);
  ctx.stroke();

  // Embossed 20/11
  ctx.fillStyle = '#f0f0f0';
  ctx.font = 'bold 58px serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('20/11', cx, cy);

  const tex = new THREE.CanvasTexture(canvas);
  return tex;
}

function createNotebookCoverTexture() {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = 256; canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  ctx.fillStyle = '#3a1a18';
  ctx.fillRect(0, 0, 256, 256);

  // Gold ornamental border
  ctx.strokeStyle = '#d4af37';
  ctx.lineWidth = 3;
  ctx.strokeRect(12, 12, 232, 232);
  ctx.strokeRect(18, 18, 220, 220);

  // Lettering
  ctx.fillStyle = '#fef08a';
  ctx.textAlign = 'center';
  ctx.font = 'bold 22px serif';
  ctx.fillText('GIÁO ÁN', 128, 95);
  ctx.font = 'bold 24px serif';
  ctx.fillText('VẬT LÝ 12', 128, 132);
  ctx.font = 'italic 13px serif';
  ctx.fillStyle = '#ebd8b0';
  ctx.fillText('Chuyên Đề Bồi Dưỡng HSG', 128, 168);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createSunflowerDiskTexture() {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = 128; canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  ctx.fillStyle = '#261205';
  ctx.fillRect(0, 0, 128, 128);
  const cx = 64, cy = 64;
  const phi = (1 + Math.sqrt(5)) / 2;
  ctx.fillStyle = '#6e3810';
  for (let i = 0; i < 220; i++) {
    const r = Math.sqrt(i) * 3.8;
    const theta = i * 2 * Math.PI * (phi - 1);
    const px = cx + Math.cos(theta) * r;
    const py = cy + Math.sin(theta) * r;
    ctx.beginPath();
    ctx.arc(px, py, 1.2, 0, Math.PI * 2);
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(canvas);
  return tex;
}

/**
 * Creates a circular CanvasTexture for the Crimson Wax Seal medallion with embossed "20/11".
 */
function createWaxSealTexture() {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const cx = canvas.width / 2;
  const cy = canvas.height / 2;
  const radius = 230;

  // Deep crimson wax gradient
  const grad = ctx.createRadialGradient(cx, cy, 30, cx, cy, radius);
  grad.addColorStop(0, '#af1f24');
  grad.addColorStop(0.7, '#881317');
  grad.addColorStop(1, '#5e0a0d');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fill();

  // Wax melted puddle edge irregularities
  ctx.fillStyle = 'rgba(94, 10, 13, 0.5)';
  for (let a = 0; a < Math.PI * 2; a += 0.3) {
    const rx = cx + Math.cos(a) * (radius - 8 + Math.sin(a * 5) * 12);
    const ry = cy + Math.sin(a) * (radius - 8 + Math.cos(a * 4) * 12);
    ctx.beginPath();
    ctx.arc(rx, ry, 26, 0, Math.PI * 2);
    ctx.fill();
  }

  // Inner stamped ring groove
  ctx.strokeStyle = 'rgba(254, 240, 138, 0.65)';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.arc(cx, cy, radius * 0.76, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(60, 6, 8, 0.8)';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(cx, cy, radius * 0.73, 0, Math.PI * 2);
  ctx.stroke();

  // Embossed Golden "20/11" with drop shadow for 3D stamp effect
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Emboss shadow
  ctx.font = 'bold 110px serif';
  ctx.fillStyle = 'rgba(50, 4, 6, 0.9)';
  ctx.fillText('20/11', cx + 3, cy + 4);

  // Emboss highlight
  ctx.fillStyle = '#fef08a';
  ctx.fillText('20/11', cx - 2, cy - 2);

  // Laurel branch / decorative star arcs
  ctx.font = '32px sans-serif';
  ctx.fillStyle = 'rgba(254, 240, 138, 0.75)';
  ctx.fillText('★  ★  ★', cx, cy - 85);
  ctx.font = 'bold 24px serif';
  ctx.fillText('TRI ÂN THẦY', cx, cy + 85);
  ctx.restore();

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  return texture;
}

/**
 * Creates a parchment letter texture for the inside sheet.
 */
function createLetterPaperTexture() {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = 768;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  // Vintage ivory parchment
  ctx.fillStyle = '#faf6ed';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Soft aged paper border vignette
  const grad = ctx.createRadialGradient(
    canvas.width / 2, canvas.height / 2, 200,
    canvas.width / 2, canvas.height / 2, 420
  );
  grad.addColorStop(0, 'rgba(0, 0, 0, 0)');
  grad.addColorStop(1, 'rgba(180, 140, 90, 0.3)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Gold ornamental border
  ctx.strokeStyle = '#c5a06c';
  ctx.lineWidth = 3;
  ctx.strokeRect(16, 16, canvas.width - 32, canvas.height - 32);

  // Handwritten lines
  ctx.fillStyle = '#2b1a0e';
  ctx.textAlign = 'center';
  ctx.font = 'bold 32px serif';
  ctx.fillText('Kính Gửi Thầy Nam Kính Yêu!', canvas.width / 2, 80);

  ctx.font = 'italic 20px serif';
  ctx.fillStyle = '#422818';
  ctx.fillText('Tri ân Ngày Nhà giáo Việt Nam 20/11', canvas.width / 2, 120);

  ctx.textAlign = 'left';
  ctx.font = '17px serif';
  const textLines = [
    'Chúng em xin kính chúc Thầy luôn dồi dào sức khỏe và ngập tràn niềm vui!',
    'Cảm ơn Thầy đã luôn kiên nhẫn dìu dắt, thắp sáng tình yêu Vật lý trong mỗi chúng em.',
    'Từ phương trình Cơ học Lagrange tới vẻ đẹp kỳ vĩ của Thuyết Tương Đối và Vũ trụ...',
    'Từng nét phấn trắng của Thầy trên bảng là hành trang vô giá cho chúng em vững bước.'
  ];
  textLines.forEach((line, idx) => {
    ctx.fillText(line, 55, 180 + idx * 42);
  });

  ctx.textAlign = 'right';
  ctx.font = 'bold italic 22px serif';
  ctx.fillStyle = '#8f1c1f';
  ctx.fillText('Học trò Hải Lâm', canvas.width - 60, 420);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  return texture;
}

/**
 * Creates a soft golden pool halo on the desk underneath the envelope.
 */
function createDeskAuraHaloTexture() {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const cx = 128;
  const cy = 128;
  const rad = 120;
  const grad = ctx.createRadialGradient(cx, cy, 10, cx, cy, rad);
  grad.addColorStop(0, 'rgba(251, 191, 36, 0.7)');
  grad.addColorStop(0.45, 'rgba(245, 158, 11, 0.35)');
  grad.addColorStop(0.8, 'rgba(217, 119, 6, 0.1)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0)');

  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(cx, cy, rad, 0, Math.PI * 2);
  ctx.fill();

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  return texture;
}

/**
 * Creates a soft dark-brown Ambient Occlusion / Contact Shadow texture
 * directly beneath the Kraft envelope so it grounds solidly onto the wooden desk.
 */
function createContactShadowTexture() {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 192;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Soft elliptical radial occlusion shadow centered under the envelope
  ctx.save();
  ctx.translate(canvas.width * 0.52, canvas.height * 0.52);
  ctx.scale(1.25, 0.9);
  const grad = ctx.createRadialGradient(0, 0, 22, 0, 0, 102);
  grad.addColorStop(0.0, 'rgba(10, 5, 2, 0.72)');
  grad.addColorStop(0.55, 'rgba(15, 8, 4, 0.38)');
  grad.addColorStop(0.85, 'rgba(15, 8, 4, 0.08)');
  grad.addColorStop(1.0, 'rgba(15, 8, 4, 0.0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(0, 0, 102, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  return texture;
}

const ENV_WIDTH = 26;
const ENV_HEIGHT = 0.48;
const ENV_DEPTH = 17.5;

function buildEnvelopeModel() {
  const group = new THREE.Group();
  group.name = 'teacherDeskEnvelopeGroup';

  const { bumpMap, roughnessMap } = createKraftPaperSurfaceMaps();
  const kraftFaceTexture = createKraftFaceTexture();

  const kraftBaseMat = new THREE.MeshStandardMaterial({
    color: 0xb68f5e, bumpMap, bumpScale: 0.05, roughnessMap, roughness: 0.88, metalness: 0.02
  });
  const kraftTopMat = kraftFaceTexture
    ? new THREE.MeshStandardMaterial({
        map: kraftFaceTexture, bumpMap, bumpScale: 0.04, roughnessMap, roughness: 0.85, metalness: 0.02
      })
    : kraftBaseMat;

  const bodyMesh = new THREE.Mesh(
    new THREE.BoxGeometry(ENV_WIDTH, ENV_HEIGHT, ENV_DEPTH),
    [kraftBaseMat, kraftBaseMat, kraftTopMat, kraftBaseMat, kraftBaseMat, kraftBaseMat]
  );
  bodyMesh.castShadow = true; bodyMesh.receiveShadow = true; bodyMesh.name = 'envelopeBody';
  group.add(bodyMesh);

  const paperMat = new THREE.MeshStandardMaterial({
    map: createLetterPaperTexture(), color: 0xffffff, roughness: 0.78, side: THREE.DoubleSide
  });
  letterPaperMesh = new THREE.Mesh(new THREE.PlaneGeometry(ENV_WIDTH * 0.88, ENV_DEPTH * 0.84), paperMat);
  letterPaperMesh.rotation.x = -Math.PI / 2;
  letterPaperMesh.position.set(0, ENV_HEIGHT * 0.2, 0);
  letterPaperMesh.visible = false;
  letterPaperMesh.name = 'letterPaper';
  group.add(letterPaperMesh);

  const ribbonMat = new THREE.MeshStandardMaterial({
    color: 0x8f1c1f,
    roughness: 0.42,
    metalness: 0.08
  });
  const ribbonMesh = new THREE.Mesh(
    new THREE.BoxGeometry(1.15, ENV_HEIGHT + 0.06, ENV_DEPTH + 0.08),
    ribbonMat
  );
  ribbonMesh.name = 'envelopeRibbon';
  ribbonMesh.castShadow = true;
  group.add(ribbonMesh);

  flapPivot = new THREE.Group();
  flapPivot.position.set(0, ENV_HEIGHT * 0.52, -ENV_DEPTH / 2);
  flapPivot.name = 'envelopeFlapPivot';

  const flapShape = new THREE.Shape();
  flapShape.moveTo(-ENV_WIDTH / 2, 0); flapShape.lineTo(ENV_WIDTH / 2, 0); flapShape.lineTo(0, ENV_DEPTH * 0.56); flapShape.closePath();

  const flapMesh = new THREE.Mesh(
    new THREE.ShapeGeometry(flapShape),
    new THREE.MeshStandardMaterial({ color: 0xc29b6a, bumpMap, bumpScale: 0.04, roughness: 0.86, metalness: 0.02, side: THREE.DoubleSide })
  );
  flapMesh.rotation.x = Math.PI / 2;
  flapMesh.castShadow = true; flapMesh.receiveShadow = true; flapMesh.name = 'envelopeFlapMesh';
  flapPivot.add(flapMesh);

  waxSealGroup = new THREE.Group();
  waxSealGroup.name = 'waxSealGroup';
  const sealRadius = 2.05, sealThickness = 0.36;
  const waxBump = createWaxSealBumpMap();
  const waxMat = new THREE.MeshPhysicalMaterial({
    color: 0x8a1418, roughness: 0.38, metalness: 0.08, clearcoat: 0.85, clearcoatRoughness: 0.16,
    bumpMap: waxBump || null, bumpScale: 0.08
  });

  const sealBaseMesh = new THREE.Mesh(new THREE.CylinderGeometry(sealRadius, sealRadius * 1.08, sealThickness, 32), waxMat);
  sealBaseMesh.castShadow = true;
  waxSealGroup.add(sealBaseMesh);

  const sealRimMesh = new THREE.Mesh(new THREE.TorusGeometry(sealRadius * 0.94, 0.26, 16, 32), waxMat);
  sealRimMesh.rotation.x = Math.PI / 2; sealRimMesh.position.y = sealThickness * 0.28;
  waxSealGroup.add(sealRimMesh);

  const waxTexture = createWaxSealTexture();
  if (waxTexture) {
    const sealFaceMesh = new THREE.Mesh(
      new THREE.CircleGeometry(sealRadius * 0.88, 32),
      new THREE.MeshStandardMaterial({ map: waxTexture, roughness: 0.32, metalness: 0.16 })
    );
    sealFaceMesh.rotation.x = -Math.PI / 2; sealFaceMesh.position.y = sealThickness * 0.52;
    waxSealGroup.add(sealFaceMesh);
  }

  flapPivot.add(waxSealGroup);
  waxSealGroup.position.set(0, 0.16, ENV_DEPTH * 0.52);
  group.add(flapPivot);

  // Replaced heavy dynamic PointLight with lightweight Object3D dummy + self-emissive mesh
  auraLight = new THREE.Object3D();
  auraLight.position.set(0, 8.0, 2.0);
  auraLight.name = 'envelopeAuraLight';
  auraLight.intensity = 0.0;
  group.add(auraLight);

  contactShadowMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(ENV_WIDTH * 1.26, ENV_DEPTH * 1.30),
    new THREE.MeshBasicMaterial({ map: createContactShadowTexture(), transparent: true, opacity: 0.95, depthWrite: false })
  );
  contactShadowMesh.rotation.x = -Math.PI / 2;
  contactShadowMesh.position.y = -ENV_HEIGHT * 0.505;
  contactShadowMesh.name = 'envelopeContactShadow';
  contactShadowMesh.userData.noAO = true;
  group.add(contactShadowMesh);

  auraHaloMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(36, 26),
    new THREE.MeshBasicMaterial({ map: createDeskAuraHaloTexture(), transparent: true, opacity: 0.0, depthWrite: false, blending: THREE.AdditiveBlending })
  );
  auraHaloMesh.rotation.x = -Math.PI / 2;
  auraHaloMesh.position.y = -ENV_HEIGHT * 0.495;
  auraHaloMesh.name = 'envelopeHalo';
  auraHaloMesh.userData.noAO = true;
  group.add(auraHaloMesh);

  const sparkleCount = 20;
  const sparkleGeom = new THREE.BufferGeometry();
  const positions = new Float32Array(sparkleCount * 3);
  const phases = new Float32Array(sparkleCount);
  const speeds = new Float32Array(sparkleCount);
  for (let i = 0; i < sparkleCount; i++) {
    positions[i * 3 + 0] = (deterministicHash(i * 7 + 1) - 0.5) * 26;
    positions[i * 3 + 1] = deterministicHash(i * 7 + 2) * 8 + 0.8;
    positions[i * 3 + 2] = (deterministicHash(i * 7 + 3) - 0.5) * 18;
    phases[i] = deterministicHash(i * 7 + 4) * Math.PI * 2;
    speeds[i] = 0.8 + deterministicHash(i * 7 + 5) * 0.8;
  }
  sparkleGeom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  sparkleGeom.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));
  sparkleGeom.setAttribute('aSpeed', new THREE.BufferAttribute(speeds, 1));

  const sparkleTex = createSoftSparkleTexture();
  const sparkleMat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uHover: { value: 0 },
      uTex: { value: sparkleTex },
      uColor: { value: new THREE.Color(0xfef08a) }
    },
    vertexShader: `
      uniform float uTime;
      uniform float uHover;
      attribute float aPhase;
      attribute float aSpeed;
      varying float vAlpha;
      void main() {
        vec3 p = position;
        float t = uTime * aSpeed + aPhase;
        p.y += mod(t * 1.5, 9.5);
        p.x += sin(t * 2.0 + p.z) * 0.45;
        p.z += cos(t * 2.0 + p.x) * 0.45;
        vec4 mvPos = modelViewMatrix * vec4(p, 1.0);
        gl_PointSize = (22.0 / -mvPos.z) * (1.0 + 0.35 * sin(t * 3.0));
        gl_Position = projectionMatrix * mvPos;
        vAlpha = smoothstep(0.0, 1.5, p.y) * (1.0 - smoothstep(6.0, 10.0, p.y)) * mix(0.18, 0.85, uHover);
      }
    `,
    fragmentShader: `
      uniform sampler2D uTex;
      uniform vec3 uColor;
      varying float vAlpha;
      void main() {
        vec4 tex = texture2D(uTex, gl_PointCoord);
        gl_FragColor = vec4(uColor, tex.a * vAlpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });
  sparklePoints = new THREE.Points(sparkleGeom, sparkleMat);
  sparklePoints.userData.noAO = true;
  group.add(sparklePoints);

  return group;
}

function buildCompanionDeskProps(deskTopY, centerX, centerZ) {
  const props = new THREE.Group();
  props.name = 'teacherDeskCompanionProps';
  const shadowTex = createContactShadowTexture();

  // 1. Sổ giáo án (màu đỏ đô trầm + nhãn giấy ngà để nổi rõ trên mặt bàn gỗ)
  const bookW = 30, bookH = 2.1, bookD = 22;
  const bookGroup = new THREE.Group();
  bookGroup.position.set(centerX + 46.0, deskTopY + bookH / 2 + 0.03, centerZ + 4.0);
  bookGroup.rotation.y = 0.24;
  const bookCover = new THREE.Mesh(
    new THREE.BoxGeometry(bookW, bookH, bookD),
    new THREE.MeshStandardMaterial({ color: 0x5c2b28, roughness: 0.78, metalness: 0.04 })
  );
  bookCover.castShadow = true; bookCover.receiveShadow = true;
  bookGroup.add(bookCover);

  // Nhãn tên vở màu giấy ngà trên bìa
  const coverTex = createNotebookCoverTexture();
  const labelMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(12.0, 8.0),
    new THREE.MeshStandardMaterial({ map: coverTex || null, color: coverTex ? 0xffffff : 0xe6dcc8, roughness: 0.82 })
  );
  labelMesh.rotation.x = -Math.PI / 2;
  labelMesh.position.set(0, bookH / 2 + 0.02, -1.5);
  bookGroup.add(labelMesh);

  const pageBlock = new THREE.Mesh(
    new THREE.BoxGeometry(bookW - 1.2, bookH * 0.74, bookD - 1.4),
    new THREE.MeshStandardMaterial({ color: 0xdfd8c8, roughness: 0.90, metalness: 0.0 })
  );
  pageBlock.position.set(-0.4, 0, 0);
  bookGroup.add(pageBlock);

  // Bookmark ribbon red
  const bookmarkMat = new THREE.MeshStandardMaterial({ color: 0x8f1c1f, roughness: 0.45 });
  const bookmarkMesh = new THREE.Mesh(
    new THREE.BoxGeometry(1.4, 0.22, 4.2),
    bookmarkMat
  );
  bookmarkMesh.position.set(2.5, -bookH / 2 + 0.25, bookD / 2 + 1.1);
  bookGroup.add(bookmarkMesh);

  // Viền chỉ vàng mỏng trên bìa (khung rỗng không che phủ mặt bìa đỏ đô)
  const outerHalfW = (bookW - 3.0) / 2;
  const outerHalfD = (bookD - 3.0) / 2;
  const stitchWidth = 0.28;
  const stitchShape = new THREE.Shape();
  stitchShape.moveTo(-outerHalfW, -outerHalfD);
  stitchShape.lineTo(outerHalfW, -outerHalfD);
  stitchShape.lineTo(outerHalfW, outerHalfD);
  stitchShape.lineTo(-outerHalfW, outerHalfD);
  stitchShape.closePath();

  const innerHalfW = outerHalfW - stitchWidth;
  const innerHalfD = outerHalfD - stitchWidth;
  const stitchHole = new THREE.Path();
  stitchHole.moveTo(-innerHalfW, -innerHalfD);
  stitchHole.lineTo(-innerHalfW, innerHalfD);
  stitchHole.lineTo(innerHalfW, innerHalfD);
  stitchHole.lineTo(innerHalfW, -innerHalfD);
  stitchHole.closePath();
  stitchShape.holes.push(stitchHole);

  const goldStitch = new THREE.Mesh(
    new THREE.ShapeGeometry(stitchShape),
    new THREE.MeshStandardMaterial({ color: 0xd4a448, roughness: 0.35, metalness: 0.7 })
  );
  goldStitch.rotation.x = -Math.PI / 2;
  goldStitch.position.set(0, bookH / 2 + 0.015, 0);
  bookGroup.add(goldStitch);

  if (shadowTex) {
    const bShadow = new THREE.Mesh(
      new THREE.PlaneGeometry(bookW * 1.24, bookD * 1.24),
      new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, opacity: 0.9, depthWrite: false })
    );
    bShadow.rotation.x = -Math.PI / 2; bShadow.position.y = -bookH / 2 - 0.01;
    bShadow.userData.noAO = true;
    bookGroup.add(bShadow);
  }
  props.add(bookGroup);

  // 2. Bút máy
  const penGroup = new THREE.Group();
  penGroup.position.set(centerX + 19.5, deskTopY + 0.45, centerZ - 6.5);
  penGroup.rotation.y = -0.58;
  const penBodyMat = new THREE.MeshStandardMaterial({ color: 0x161414, roughness: 0.28, metalness: 0.25 });
  const penGoldMat = new THREE.MeshStandardMaterial({ color: 0xd4a448, roughness: 0.26, metalness: 0.85 });
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.36, 15.5, 16), penBodyMat);
  barrel.rotation.z = Math.PI / 2; barrel.castShadow = true; penGroup.add(barrel);
  const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.65, 16), penGoldMat);
  ring.rotation.z = Math.PI / 2; ring.position.x = 1.6; penGroup.add(ring);
  const nib = new THREE.Mesh(new THREE.ConeGeometry(0.32, 1.8, 12), penGoldMat);
  nib.rotation.z = -Math.PI / 2; nib.position.x = 8.4; penGroup.add(nib);
  if (shadowTex) {
    const pShadow = new THREE.Mesh(
      new THREE.PlaneGeometry(18.0, 2.8),
      new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, opacity: 0.78, depthWrite: false })
    );
    pShadow.rotation.x = -Math.PI / 2; pShadow.position.y = -0.42;
    pShadow.userData.noAO = true;
    penGroup.add(pShadow);
  }
  props.add(penGroup);

  // 3. Cốc trà gốm men nâu ấm (LatheGeometry có độ dày miệng cốc + đĩa lót + quai xoay đúng hướng)
  const mugGroup = new THREE.Group();
  mugGroup.position.set(centerX - 48.0, deskTopY + 0.02, centerZ - 14.0);

  const ceramicMat = new THREE.MeshPhysicalMaterial({
    color: 0x8f7760,
    roughness: 0.34,
    metalness: 0.02,
    clearcoat: 0.45,
    clearcoatRoughness: 0.22
  });

  // Đĩa lót gốm nhỏ
  const saucerPts = [
    new THREE.Vector2(0.0, 0.0),
    new THREE.Vector2(3.4, 0.0),
    new THREE.Vector2(5.2, 0.65),
    new THREE.Vector2(5.1, 0.85),
    new THREE.Vector2(3.1, 0.35),
    new THREE.Vector2(0.0, 0.35)
  ];
  const saucerMesh = new THREE.Mesh(new THREE.LatheGeometry(saucerPts, 28), ceramicMat);
  saucerMesh.castShadow = true; saucerMesh.receiveShadow = true;
  mugGroup.add(saucerMesh);

  // Thân cốc gốm
  const cupPts = [
    new THREE.Vector2(0.0, 0.35),
    new THREE.Vector2(2.4, 0.35),
    new THREE.Vector2(2.6, 1.0),
    new THREE.Vector2(3.1, 4.4),
    new THREE.Vector2(3.45, 7.6),
    new THREE.Vector2(3.52, 8.0),
    new THREE.Vector2(3.18, 8.0),
    new THREE.Vector2(2.82, 4.4),
    new THREE.Vector2(2.2, 1.2),
    new THREE.Vector2(0.0, 1.2)
  ];
  const mugBody = new THREE.Mesh(new THREE.LatheGeometry(cupPts, 28), ceramicMat);
  mugBody.castShadow = true; mugBody.receiveShadow = true;
  mugGroup.add(mugBody);

  const teaSurface = new THREE.Mesh(
    new THREE.CircleGeometry(2.98, 24),
    new THREE.MeshStandardMaterial({ color: 0x522d12, roughness: 0.16, metalness: 0.08 })
  );
  teaSurface.rotation.x = -Math.PI / 2;
  teaSurface.position.y = 6.4;
  mugGroup.add(teaSurface);

  const mugHandle = new THREE.Mesh(new THREE.TorusGeometry(1.9, 0.40, 12, 20, Math.PI), ceramicMat);
  mugHandle.rotation.z = Math.PI / 2;
  mugHandle.position.set(-3.05, 4.5, 0);
  mugHandle.castShadow = true;
  mugGroup.add(mugHandle);

  if (shadowTex) {
    const mShadow = new THREE.Mesh(
      new THREE.PlaneGeometry(14.0, 14.0),
      new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, opacity: 0.9, depthWrite: false })
    );
    mShadow.rotation.x = -Math.PI / 2;
    mShadow.position.set(-0.6, 0.02, 0.4);
    mShadow.userData.noAO = true;
    mugGroup.add(mShadow);
  }

  // GPU Shader-driven Tea Steam
  const steamCount = 8;
  const steamGeom = new THREE.BufferGeometry();
  const steamPos = new Float32Array(steamCount * 3);
  const steamPhases = new Float32Array(steamCount);
  for (let s = 0; s < steamCount; s++) {
    steamPos[s * 3 + 0] = (deterministicHash(s * 11 + 1) - 0.5) * 2.2;
    steamPos[s * 3 + 1] = 8.4;
    steamPos[s * 3 + 2] = (deterministicHash(s * 11 + 2) - 0.5) * 2.2;
    steamPhases[s] = deterministicHash(s * 11 + 3) * Math.PI * 2;
  }
  steamGeom.setAttribute('position', new THREE.BufferAttribute(steamPos, 3));
  steamGeom.setAttribute('aPhase', new THREE.BufferAttribute(steamPhases, 1));
  const steamTex = createSoftSparkleTexture();
  const steamMat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uTex: { value: steamTex }
    },
    vertexShader: `
      uniform float uTime;
      attribute float aPhase;
      varying float vAlpha;
      void main() {
        vec3 p = position;
        float t = uTime * 0.9 + aPhase;
        p.y += mod(t * 2.2, 9.0);
        p.x += sin(t * 1.8 + aPhase) * 0.4;
        p.z += cos(t * 1.5 + aPhase) * 0.4;
        vec4 mvPos = modelViewMatrix * vec4(p, 1.0);
        gl_PointSize = (48.0 / -mvPos.z) * (1.0 + (p.y - 8.4) * 0.12);
        gl_Position = projectionMatrix * mvPos;
        vAlpha = smoothstep(8.4, 10.0, p.y) * (1.0 - smoothstep(14.0, 17.4, p.y)) * 0.18;
      }
    `,
    fragmentShader: `
      uniform sampler2D uTex;
      varying float vAlpha;
      void main() {
        vec4 tex = texture2D(uTex, gl_PointCoord);
        gl_FragColor = vec4(0.97, 0.94, 0.89, tex.a * vAlpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.NormalBlending
  });
  steamPoints = new THREE.Points(steamGeom, steamMat);
  steamPoints.userData.noAO = true;
  mugGroup.add(steamPoints);
  props.add(mugGroup);

  // 4. Lọ hoa gốm dáng bầu Bát Tràng + InstancedMesh 64 cánh hoa hướng dương
  const vaseGroup = new THREE.Group();
  vaseGroup.position.set(centerX + 52.0, deskTopY + 0.02, centerZ - 11.0);

  const vasePts = [
    new THREE.Vector2(0.0, 0.0),
    new THREE.Vector2(2.6, 0.0),
    new THREE.Vector2(3.6, 2.2),
    new THREE.Vector2(3.8, 4.8),
    new THREE.Vector2(2.5, 7.8),
    new THREE.Vector2(1.9, 9.6),
    new THREE.Vector2(2.4, 11.0),
    new THREE.Vector2(2.05, 11.0),
    new THREE.Vector2(1.65, 9.4),
    new THREE.Vector2(0.0, 9.0)
  ];
  const vaseMat = new THREE.MeshPhysicalMaterial({
    color: 0x3b6e5c,
    roughness: 0.24,
    metalness: 0.04,
    clearcoat: 0.78,
    clearcoatRoughness: 0.14
  });
  const vaseMesh = new THREE.Mesh(new THREE.LatheGeometry(vasePts, 28), vaseMat);
  vaseMesh.castShadow = true; vaseMesh.receiveShadow = true;
  vaseGroup.add(vaseMesh);

  const stemMat = new THREE.MeshStandardMaterial({ color: 0x3f6212, roughness: 0.72 });
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x4d7c0f, roughness: 0.65, side: THREE.DoubleSide });
  const centerMat = new THREE.MeshStandardMaterial({
    map: createSunflowerDiskTexture(),
    color: 0x3b1704,
    roughness: 0.88
  });
  const petalMat = new THREE.MeshStandardMaterial({
    color: 0xf7b21b,
    roughness: 0.48,
    side: THREE.DoubleSide,
    emissive: 0x542600,
    emissiveIntensity: 0.32
  });

  const petalShape = new THREE.Shape();
  petalShape.moveTo(0, 0);
  petalShape.bezierCurveTo(0.64, 0.65, 0.56, 1.55, 0, 2.15);
  petalShape.bezierCurveTo(-0.56, 1.55, -0.64, 0.65, 0, 0);
  const petalGeom = new THREE.ShapeGeometry(petalShape, 5);
  const pPos = petalGeom.attributes.position;
  for (let i = 0; i < pPos.count; i++) {
    const py = pPos.getY(i);
    const px = pPos.getX(i);
    pPos.setZ(i, -Math.sin(py * 1.25) * 0.22 + (px * px) * 0.09);
  }
  petalGeom.computeVertexNormals();

  const instancedPetals = new THREE.InstancedMesh(petalGeom, petalMat, 112);
  instancedPetals.castShadow = true;
  instancedPetals.receiveShadow = true;

  const flowerConfigs = [
    { tip: [1.4, 17.2, 1.2], mid: [0.5, 13.8, 0.4], tiltX: 0.28, tiltZ: -0.16, scale: 1.08 },
    { tip: [-2.2, 15.8, 1.8], mid: [-0.9, 13.0, 0.7], tiltX: 0.34, tiltZ: 0.22, scale: 0.96 },
    { tip: [0.2, 18.6, -1.0], mid: [0.1, 14.5, -0.4], tiltX: 0.22, tiltZ: 0.04, scale: 1.02 },
    { tip: [-1.1, 14.4, -1.6], mid: [-0.5, 12.2, -0.7], tiltX: 0.26, tiltZ: 0.12, scale: 0.88 }
  ];

  const dummy = new THREE.Object3D();
  let petalIndex = 0;

  flowerConfigs.forEach((cfg, idx) => {
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 8.8, 0),
      new THREE.Vector3(cfg.mid[0], cfg.mid[1], cfg.mid[2]),
      new THREE.Vector3(cfg.tip[0], cfg.tip[1], cfg.tip[2])
    ]);
    const stem = new THREE.Mesh(new THREE.TubeGeometry(curve, 12, 0.20, 6, false), stemMat);
    stem.castShadow = true;
    vaseGroup.add(stem);

    const leaf = new THREE.Mesh(new THREE.CircleGeometry(1.15, 8), leafMat);
    leaf.scale.set(0.65, 1.4, 1.0);
    leaf.position.set(cfg.mid[0] + (idx % 2 === 0 ? 0.8 : -0.8), cfg.mid[1] - 0.6, cfg.mid[2] + 0.4);
    leaf.rotation.set(0.6, idx * 0.8, idx % 2 === 0 ? -0.7 : 0.7);
    vaseGroup.add(leaf);

    const headGroup = new THREE.Group();
    headGroup.position.set(cfg.tip[0], cfg.tip[1], cfg.tip[2]);
    headGroup.scale.setScalar(cfg.scale * 1.28);
    headGroup.rotation.set(cfg.tiltX, Math.PI, cfg.tiltZ);

    const disk = new THREE.Mesh(new THREE.SphereGeometry(1.05, 14, 10), centerMat);
    disk.scale.set(1.0, 1.0, 0.35);
    disk.castShadow = true;
    headGroup.add(disk);
    vaseGroup.add(headGroup);

    const headPos = new THREE.Vector3(cfg.tip[0], cfg.tip[1], cfg.tip[2]);
    const headRot = new THREE.Euler(cfg.tiltX, Math.PI, cfg.tiltZ);
    const headScale = cfg.scale * 1.28;
    const headQuat = new THREE.Quaternion().setFromEuler(headRot);

    // Outer ring: 16 petals
    for (let p = 0; p < 16; p++) {
      const a = (p / 16) * Math.PI * 2;
      const localPos = new THREE.Vector3(Math.cos(a) * 1.52, Math.sin(a) * 1.52, (p % 2) * 0.04);
      const localRot = new THREE.Euler(0.24, 0, a - Math.PI / 2);
      const localQuat = new THREE.Quaternion().setFromEuler(localRot);

      dummy.position.copy(localPos).multiplyScalar(headScale).applyQuaternion(headQuat).add(headPos);
      dummy.quaternion.copy(headQuat).multiply(localQuat);
      dummy.scale.set(0.60 * headScale, 1.80 * headScale, headScale);
      dummy.updateMatrix();

      instancedPetals.setMatrixAt(petalIndex++, dummy.matrix);
    }

    // Inner ring: 12 petals (staggered)
    for (let p = 0; p < 12; p++) {
      const a = ((p + 0.5) / 12) * Math.PI * 2;
      const localPos = new THREE.Vector3(Math.cos(a) * 1.22, Math.sin(a) * 1.22, 0.12 + (p % 2) * 0.04);
      const localRot = new THREE.Euler(0.32, 0, a - Math.PI / 2);
      const localQuat = new THREE.Quaternion().setFromEuler(localRot);

      dummy.position.copy(localPos).multiplyScalar(headScale).applyQuaternion(headQuat).add(headPos);
      dummy.quaternion.copy(headQuat).multiply(localQuat);
      dummy.scale.set(0.52 * headScale, 1.52 * headScale, headScale);
      dummy.updateMatrix();

      instancedPetals.setMatrixAt(petalIndex++, dummy.matrix);
    }
  });

  instancedPetals.instanceMatrix.needsUpdate = true;
  vaseGroup.add(instancedPetals);

  if (shadowTex) {
    const vShadow = new THREE.Mesh(
      new THREE.PlaneGeometry(13.5, 13.5),
      new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, opacity: 0.90, depthWrite: false })
    );
    vShadow.rotation.x = -Math.PI / 2;
    vShadow.position.set(0, 0.02, 0);
    vShadow.userData.noAO = true;
    vaseGroup.add(vShadow);
  }
  props.add(vaseGroup);

  return props;
}

export function initTeacherDesk(scene, camera, deskMesh = null, options = {}) {
  activeScene = scene;
  activeCamera = camera;
  activeDomElement = options.domElement || (typeof document !== 'undefined' ? (document.getElementById('webgl-canvas') || window) : null);

  envelopeMesh = buildEnvelopeModel();

  let deskTopY = 78.60, deskCenterX = 2.44, deskCenterZ = 343.40;
  if (deskMesh && deskMesh.isObject3D) {
    try {
      const box = new THREE.Box3().setFromObject(deskMesh);
      deskCenterX = (box.min.x + box.max.x) / 2;
      deskTopY = box.max.y;
      deskCenterZ = (box.min.z + box.max.z) / 2;
    } catch (e) {
      console.warn('[TeacherDesk] Could not calculate desk bounding box, using defaults:', e);
    }
  }

  basePosition.set(deskCenterX, deskTopY + ENV_HEIGHT * 0.58 + 0.02, deskCenterZ);
  if (options.position) basePosition.copy(options.position);

  envelopeMesh.position.copy(basePosition);
  envelopeMesh.scale.setScalar(1.26);
  envelopeMesh.rotation.y = -0.24;
  envelopeMesh.rotation.x = -0.025;
  scene.add(envelopeMesh);

  if (!deskPropsGroup) {
    deskPropsGroup = buildCompanionDeskProps(deskTopY, deskCenterX, deskCenterZ);
    scene.add(deskPropsGroup);
  }

  bindModalDOM();
  bindPointerEvents();
  return envelopeMesh;
}

function bindPointerEvents() {
  if (typeof window === 'undefined') return;

  const target = activeDomElement && activeDomElement.addEventListener ? activeDomElement : window;
  boundTarget = target;

  const checkPointerHitEnvelope = (e) => {
    if (!activeCamera || !envelopeMesh) return false;
    envelopeHitSphere.center.copy(envelopeMesh.position);
    const touch = (e.touches && e.touches[0]) || (e.changedTouches && e.changedTouches[0]);
    const clientX = e.clientX !== undefined ? e.clientX : (touch ? touch.clientX : 0);
    const clientY = e.clientY !== undefined ? e.clientY : (touch ? touch.clientY : 0);
    const rect = activeDomElement && activeDomElement.getBoundingClientRect
      ? activeDomElement.getBoundingClientRect()
      : { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight };
    mouseNdc.x = ((clientX - rect.left) / Math.max(1, rect.width)) * 2 - 1;
    mouseNdc.y = -((clientY - rect.top) / Math.max(1, rect.height)) * 2 + 1;
    raycaster.setFromCamera(mouseNdc, activeCamera);
    if (!raycaster.ray.intersectsSphere(envelopeHitSphere)) {
      return false;
    }
    return raycaster.intersectObjects(envelopeMesh.children, true).length > 0;
  };

  boundPointerMove = (e) => {
    const wasHovered = isHovered;
    isHovered = checkPointerHitEnvelope(e);

    if (isHovered !== wasHovered) {
      if (document.body) {
        document.body.style.cursor = isHovered ? 'pointer' : 'default';
      }
    }
  };

  boundPointerDown = (e) => {
    const hit = checkPointerHitEnvelope(e);
    if (!hit) return;
    e.stopPropagation();
    if (!isLetterOpen) {
      openLetter();
    } else {
      closeLetter();
    }
  };

  boundKeyDown = (e) => {
    if (e.key === 'Escape' && isLetterOpen) {
      closeLetter();
    }
  };

  target.addEventListener('pointermove', boundPointerMove, { passive: true });
  target.addEventListener('pointerdown', boundPointerDown);
  window.addEventListener('keydown', boundKeyDown);
}

export function disposeTeacherDesk() {
  if (boundTarget && boundPointerMove) boundTarget.removeEventListener('pointermove', boundPointerMove);
  if (boundTarget && boundPointerDown) boundTarget.removeEventListener('pointerdown', boundPointerDown);
  if (typeof window !== 'undefined' && boundKeyDown) window.removeEventListener('keydown', boundKeyDown);
  boundTarget = null;
}

/**
 * Connects DOM modal buttons to open/close state.
 */
function bindModalDOM() {
  if (typeof document === 'undefined') return;

  const closeBtn = document.getElementById('close-letter-btn');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => closeLetter());
  }

  const startBoardBtn = document.getElementById('btn-start-chalkboard');
  if (startBoardBtn) {
    startBoardBtn.addEventListener('click', () => closeLetter());
  }

  const modalBackdrop = document.getElementById('letter-modal');
  if (modalBackdrop) {
    modalBackdrop.addEventListener('click', (e) => {
      if (e.target === modalBackdrop) {
        closeLetter();
      }
    });
  }

  // Also listen for external DOM triggers (e.g. HUD "Xem Thư" button)
  const hudOpenBtn = document.getElementById('btn-open-letter');
  if (hudOpenBtn) {
    hudOpenBtn.addEventListener('click', () => openLetter());
  }

  const envelopeCardTrigger = document.getElementById('envelope-trigger');
  if (envelopeCardTrigger) {
    envelopeCardTrigger.addEventListener('click', () => openLetter());
  }
}

/**
 * Opens the 3D Kraft envelope, unfolds flap, slides out paper,
 * triggers procedural sound, and reveals tribute modal.
 */
export function openLetter() {
  if (isLetterOpen) return;
  isLetterOpen = true;

  // 1. Play procedural sound via soundSynthesizer
  try {
    if (soundSynthesizer && typeof soundSynthesizer.playEnvelopeOpen === 'function') {
      soundSynthesizer.playEnvelopeOpen();
    }
  } catch (err) {
    console.warn('[TeacherDesk] Sound error on envelope open:', err);
  }

  // 2. Display warm handwritten letter modal
  if (typeof document !== 'undefined') {
    const modal = document.getElementById('letter-modal');
    if (modal) {
      modal.classList.remove('hidden');
    }
    const envCard = document.getElementById('envelope-trigger');
    if (envCard) {
      envCard.classList.add('opened');
    }
  }

  // 3. Dispatch global event for other components
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('teacher-letter-opened', { detail: { timestamp: Date.now() } }));
  }

  console.log('[TeacherDeskInteract] Letter opened.');
}

/**
 * Closes the letter modal and smoothly folds flap back.
 */
export function closeLetter() {
  if (!isLetterOpen) return;
  isLetterOpen = false;

  if (typeof document !== 'undefined') {
    const modal = document.getElementById('letter-modal');
    if (modal) {
      modal.classList.add('hidden');
    }
    const envCard = document.getElementById('envelope-trigger');
    if (envCard) {
      envCard.classList.remove('opened');
    }
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('teacher-letter-closed', { detail: { timestamp: Date.now() } }));
  }

  console.log('[TeacherDeskInteract] Letter closed.');
}

/**
 * Helper getter for letter open status.
 */
export function getIsLetterOpen() {
  return isLetterOpen;
}

/**
 * Updates envelope animations every frame (called in main render loop).
 * 
 * @param {number} dt Delta time in seconds (default ~0.016s)
 */
export function updateEnvelope(dt = 0.016) {
  if (!envelopeMesh) return;
  const safeDt = Math.min(dt, 0.1);
  animationTime += safeDt;

  const hoverSpeed = safeDt * 8.0;
  hoverFactor += ((isHovered ? 1.0 : 0.0) - hoverFactor) * hoverSpeed;

  targetOffsetY = isHovered ? 2.0 : 0.0;
  currentOffsetY += (targetOffsetY - currentOffsetY) * (safeDt * 7.0);

  const floatingBob = isHovered ? Math.sin(animationTime * 3.0) * 0.22 : 0;
  envelopeMesh.position.y = basePosition.y + currentOffsetY + floatingBob;

  const idlePulse = 0.5 + 0.5 * Math.sin(animationTime * 2.2);
  const idleGlow = (isHovered || isLetterOpen) ? 0.0 : (0.10 + idlePulse * 0.12);

  // Self-emissive envelope mesh highlight when hovered
  const body = envelopeMesh.getObjectByName('envelopeBody');
  if (body && Array.isArray(body.material)) {
    const emissiveVal = hoverFactor * 0.22 + (isHovered ? 0.06 : 0);
    body.material.forEach(m => {
      if (m && m.emissive) {
        m.emissive.setHex(0xfbbf24);
        m.emissiveIntensity = emissiveVal;
      }
    });
  }

  if (auraLight) {
    auraLight.intensity = 2.8 * (1.0 - hoverFactor) * (0.6 + 0.4 * idlePulse) + hoverFactor * 18.0 + (isLetterOpen ? 14.0 : 0);
  }
  if (auraHaloMesh && auraHaloMesh.material) {
    auraHaloMesh.material.opacity = Math.max(idleGlow, hoverFactor * 0.42);
    const pulseScale = 1.0 + Math.sin(animationTime * 2.4) * 0.04;
    auraHaloMesh.scale.set(pulseScale, pulseScale, 1.0);
  }
  if (contactShadowMesh && contactShadowMesh.material) {
    contactShadowMesh.material.opacity = Math.max(0.22, 0.95 - hoverFactor * 0.65);
    contactShadowMesh.position.y = -ENV_HEIGHT * 0.505 - (currentOffsetY + floatingBob);
  }

  const openSpeed = safeDt * 4.2;
  openFactor += ((isLetterOpen ? 1.0 : 0.0) - openFactor) * openSpeed;

  if (flapPivot) {
    flapPivot.rotation.x = -2.85 * (1.0 - Math.pow(1.0 - openFactor, 3));
  }
  if (letterPaperMesh) {
    letterPaperMesh.visible = openFactor > 0.03;
    letterPaperMesh.position.z = openFactor * 10.0;
    letterPaperMesh.position.y = ENV_HEIGHT * 0.52 + openFactor * 2.1;
    letterPaperMesh.rotation.x = -Math.PI / 2 + openFactor * 0.24;
  }

  // GPU Shader uniform update (zero CPU array reallocation)
  if (sparklePoints && sparklePoints.material && sparklePoints.material.uniforms) {
    sparklePoints.material.uniforms.uTime.value = animationTime;
    sparklePoints.material.uniforms.uHover.value = hoverFactor;
  }
  if (steamPoints && steamPoints.material && steamPoints.material.uniforms) {
    steamPoints.material.uniforms.uTime.value = animationTime;
  }
}

/**
 * External raycast intersection check for unified coordinators.
 * 
 * @param {THREE.Raycaster} customRaycaster
 * @returns {boolean} True if intersecting the envelope
 */
export function checkIntersection(customRaycaster) {
  if (!envelopeMesh || !customRaycaster) return false;
  envelopeMesh.updateMatrixWorld(true);
  envelopeHitSphere.center.copy(envelopeMesh.position);
  if (!customRaycaster.ray.intersectsSphere(envelopeHitSphere)) {
    return false;
  }
  const hits = customRaycaster.intersectObjects(envelopeMesh.children, true);
  return hits.length > 0;
}
