/**
 * tests/test_teacher_desk.mjs
 * Unit test for js/scene/teacherDeskInteract.js
 */

import * as THREE from 'three';
import { createCanvas } from '@napi-rs/canvas';

// Setup DOM mocks for headless Node test environment
if (typeof globalThis.document === 'undefined') {
  globalThis.document = {
    createElement(tag) {
      if (tag === 'canvas') {
        const c = createCanvas(512, 512);
        c.style = {};
        return c;
      }
      return {
        style: {},
        addEventListener() {},
        removeEventListener() {},
        classList: {
          add() {},
          remove() {},
          contains() { return false; }
        }
      };
    },
    getElementById(id) {
      return {
        id,
        classList: {
          classes: new Set(['hidden']),
          add(c) { this.classes.add(c); },
          remove(c) { this.classes.delete(c); },
          contains(c) { return this.classes.has(c); }
        },
        addEventListener() {},
        removeEventListener() {},
        style: {}
      };
    },
    body: {
      style: {}
    }
  };
}

if (typeof globalThis.window === 'undefined') {
  globalThis.window = {
    innerWidth: 1920,
    innerHeight: 1080,
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent(event) {
      // console.log('[MockWindow] Dispatched event:', event.type);
    }
  };
}

if (typeof globalThis.CustomEvent === 'undefined') {
  globalThis.CustomEvent = class CustomEvent {
    constructor(type, params = {}) {
      this.type = type;
      this.detail = params.detail;
    }
  };
}

console.log('--- Testing TeacherDeskInteract ---');

// Import module under test
const deskInteract = await import('../js/scene/teacherDeskInteract.js');

// 1. Verify module exports
console.log('Verifying exports...');
const requiredExports = [
  'initTeacherDesk',
  'envelopeMesh',
  'openLetter',
  'closeLetter',
  'isLetterOpen',
  'updateEnvelope'
];

for (const exp of requiredExports) {
  if (deskInteract[exp] === undefined) {
    throw new Error(`Missing required export: ${exp}`);
  }
}
console.log('✓ All 6 required exports are present.');

// 2. Initialize in Three.js scene
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(52, 1920 / 1080, 1, 2000);
camera.position.set(-220, 145, 120);
camera.lookAt(45, 155, 485);

// Create a mock teacher desk mesh to test desk positioning
const deskGeom = new THREE.BoxGeometry(176.54, 78.98, 106.15);
const deskMat = new THREE.MeshBasicMaterial({ color: 0x4a2c18 });
const deskMesh = new THREE.Mesh(deskGeom, deskMat);
// Desk center X=2.44, Y=39.11, Z=343.40 (top Y = 78.60)
deskMesh.position.set(2.44, 39.11, 343.40);
scene.add(deskMesh);

const envelopeGroup = deskInteract.initTeacherDesk(scene, camera, deskMesh);

if (!envelopeGroup || !envelopeGroup.isObject3D) {
  throw new Error('initTeacherDesk must return a valid THREE.Object3D or THREE.Group');
}
console.log('✓ initTeacherDesk returned valid THREE.Group');

// 3. Verify spatial coordinates on teacher desk
console.log(`Envelope position: [${envelopeGroup.position.x.toFixed(2)}, ${envelopeGroup.position.y.toFixed(2)}, ${envelopeGroup.position.z.toFixed(2)}]`);
if (Math.abs(envelopeGroup.position.x - 2.44) > 0.5) {
  throw new Error(`Envelope X position mismatch: expected ~2.44, got ${envelopeGroup.position.x}`);
}
if (Math.abs(envelopeGroup.position.y - 78.60) > 1.5) {
  throw new Error(`Envelope Y position mismatch: expected ~78.60-78.98, got ${envelopeGroup.position.y}`);
}
if (Math.abs(envelopeGroup.position.z - 343.40) > 1.0) {
  throw new Error(`Envelope Z position mismatch: expected ~343.40, got ${envelopeGroup.position.z}`);
}
console.log('✓ Spatial coordinates correctly align with Teacher Desk surface (X ≈ 2.44, Y ≈ 78.60, Z ≈ 343.40)');

// 4. Verify scene hierarchy: Flap, Wax Seal, Letter Paper, Aura Light, Halo
const flapPivot = envelopeGroup.getObjectByName('envelopeFlapPivot');
const waxSeal = envelopeGroup.getObjectByName('waxSealGroup');
const letterPaper = envelopeGroup.getObjectByName('letterPaper');
const auraLight = envelopeGroup.getObjectByName('envelopeAuraLight');

if (!flapPivot) throw new Error('Missing envelopeFlapPivot in envelope hierarchy');
if (!waxSeal) throw new Error('Missing waxSealGroup in envelope hierarchy');
if (!letterPaper) throw new Error('Missing letterPaper in envelope hierarchy');
if (!auraLight) throw new Error('Missing envelopeAuraLight in envelope hierarchy');
console.log('✓ Scene hierarchy verified (Flap, Crimson Wax Seal, Letter Paper, Aura Light)');

// 5. Test updateEnvelope loop when closed
deskInteract.updateEnvelope(0.016);
const closedFlapAngle = flapPivot.rotation.x;
console.log(`Flap rotation when closed: ${closedFlapAngle.toFixed(3)} rad`);
if (Math.abs(closedFlapAngle) > 0.05) {
  throw new Error('Flap must be closed (rotation ≈ 0) initially');
}

// 6. Test openLetter()
console.log('Testing openLetter()...');
deskInteract.openLetter();

if (!deskInteract.isLetterOpen && !deskInteract.getIsLetterOpen()) {
  throw new Error('isLetterOpen must be true after openLetter()');
}
console.log('✓ isLetterOpen is true after openLetter()');

// Advance time to animate opening
for (let i = 0; i < 60; i++) {
  deskInteract.updateEnvelope(0.016);
}

const openedFlapAngle = flapPivot.rotation.x;
console.log(`Flap rotation after opening animation: ${openedFlapAngle.toFixed(3)} rad`);
if (openedFlapAngle > -1.5) {
  throw new Error(`Flap failed to rotate open: rotation ${openedFlapAngle}`);
}
console.log(`Letter paper position: Z=${letterPaper.position.z.toFixed(2)}, Y=${letterPaper.position.y.toFixed(2)}`);
if (letterPaper.position.z < 5.0) {
  throw new Error('Letter paper failed to slide out forward upon opening');
}
console.log('✓ Flap opens and letter paper slides out smoothly');

// 7. Test closeLetter()
console.log('Testing closeLetter()...');
deskInteract.closeLetter();

if (deskInteract.isLetterOpen && deskInteract.getIsLetterOpen()) {
  throw new Error('isLetterOpen must be false after closeLetter()');
}
console.log('✓ isLetterOpen is false after closeLetter()');

// Advance time to animate closing
for (let i = 0; i < 60; i++) {
  deskInteract.updateEnvelope(0.016);
}
const reclosedFlapAngle = flapPivot.rotation.x;
console.log(`Flap rotation after closing animation: ${reclosedFlapAngle.toFixed(3)} rad`);
if (Math.abs(reclosedFlapAngle) > 0.3) {
  throw new Error(`Flap failed to fold back closed: rotation ${reclosedFlapAngle}`);
}
console.log('✓ Flap folded back cleanly');

// 8. Test Raycasting & Hover Aura Lift
console.log('Testing Raycasting & Hover...');
envelopeGroup.updateMatrixWorld(true);
const testRaycaster = new THREE.Raycaster();
// Aim ray from above directly at the envelope center
testRaycaster.set(new THREE.Vector3(2.44, 100, 343.40), new THREE.Vector3(0, -1, 0));
const isHit = deskInteract.checkIntersection(testRaycaster);
console.log('Raycast hit envelope:', isHit);
if (!isHit) {
  throw new Error('Raycast failed to intersect 3D envelope');
}
console.log('✓ checkIntersection() verified with 3D Raycaster');

console.log('\n ALL TEACHER DESK INTERACTION TESTS PASSED CLEANLY! ');
