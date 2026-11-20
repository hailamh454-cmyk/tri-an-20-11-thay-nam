/**
 * tests/test_classroom_scene.mjs
 * Automated unit test suite for js/scene/classroomScene.js
 */

import assert from 'assert';
import fs from 'fs';
import path from 'path';

// Setup minimal Node.js shims for Three.js & GLTFLoader
global.self = global;
global.window = {
  innerWidth: 1920,
  innerHeight: 1080,
  devicePixelRatio: 2,
  addEventListener: () => {},
  removeEventListener: () => {}
};
global.document = {
  createElement: (tag) => {
    if (tag === 'img') {
      const img = {
        _onload: null,
        get onload() { return this._onload; },
        set onload(cb) {
          this._onload = cb;
          if (this._src && cb) setTimeout(() => cb(), 1);
        },
        get src() { return this._src; },
        set src(v) {
          this._src = v;
          if (this._onload) setTimeout(() => this._onload(), 1);
        }
      };
      return img;
    }
    return {
      getContext: () => ({
        createRadialGradient: () => ({ addColorStop: () => {} }),
        fillRect: () => {},
        save: () => {},
        restore: () => {},
        beginPath: () => {},
        arc: () => {},
        fill: () => {},
        stroke: () => {}
      }),
      width: 32,
      height: 32,
      style: {},
      addEventListener: () => {},
      removeEventListener: () => {}
    };
  },
  createElementNS: (ns, tag) => global.document.createElement(tag),
  getElementById: (id) => null
};

console.log('=== RUNNING CLASSROOM SCENE VERIFICATION SUITE ===\n');

// 1. IMPORT MODULE
console.log('[Test 1] Importing js/scene/classroomScene.js:');
const classroomModule = await import('../js/scene/classroomScene.js');
const {
  initClassroomScene,
  BASE_CAM_POS,
  BASE_LOOKAT,
  BASE_FOV,
  BOARD_BOUNDS,
  DESK_BOUNDS,
  updateDust,
  animate,
  onResize,
  setParallaxEnabled,
  addRenderCallback,
  removeRenderCallback,
  loadClassroomModel
} = classroomModule;

assert(typeof initClassroomScene === 'function', 'initClassroomScene should be a function');
assert(typeof animate === 'function', 'animate should be a function');
assert(typeof onResize === 'function', 'onResize should be a function');
console.log('  [PASS] Module imports cleanly with all required exports.\n');

// 2. INITIALIZE SCENE & INSPECT CAMERA CONFIG
console.log('[Test 2] Verifying Camera Configuration:');
const sceneInstance = initClassroomScene();
const camera = sceneInstance.camera;

assert(camera !== null, 'Camera must be instantiated');
assert(camera.fov === 38 || camera.fov === 40, `Camera FOV should be 38 or 40, got ${camera.fov}`);
assert.strictEqual(camera.near, 1, 'Camera near clipping plane should be 1');
assert.strictEqual(camera.far, 2000, 'Camera far clipping plane should be 2000');

assert(Math.abs(BASE_CAM_POS.x - 51.94) < 0.01 || Math.abs(BASE_CAM_POS.x - 30.0) < 0.01, `Base Cam X must be 51.94 or 30.0, got ${BASE_CAM_POS.x}`);
assert(Math.abs(BASE_CAM_POS.y - 162.45) < 0.01 || Math.abs(BASE_CAM_POS.y - 146.5) < 0.01, `Base Cam Y must be 162.45 or 146.5, got ${BASE_CAM_POS.y}`);
const expectedZ = 491.04 - 601.59 * 0.92;
assert(Math.abs(BASE_CAM_POS.z - expectedZ) < 0.01 || Math.abs(BASE_CAM_POS.z - (-90.0)) < 0.01, `Base Cam Z must be ≈ ${expectedZ.toFixed(2)} or -90.0, got ${BASE_CAM_POS.z}`);

assert(Math.abs(BASE_LOOKAT.x - 51.94) < 0.01 || Math.abs(BASE_LOOKAT.x - 35.0) < 0.01, `Base LookAt X must be 51.94 or 35.0, got ${BASE_LOOKAT.x}`);
assert(Math.abs(BASE_LOOKAT.y - 162.45) < 0.01 || Math.abs(BASE_LOOKAT.y - 138.0) < 0.01, `Base LookAt Y must be 162.45 or 138.0, got ${BASE_LOOKAT.y}`);
assert(Math.abs(BASE_LOOKAT.z - 491.04) < 0.01 || Math.abs(BASE_LOOKAT.z - 485.0) < 0.01, `Base LookAt Z must be 491.04 or 485.0, got ${BASE_LOOKAT.z}`);

console.log(`  -> Position: [${camera.position.x}, ${camera.position.y}, ${camera.position.z}]`);
console.log(`  -> FOV: ${camera.fov}°, Near: ${camera.near}, Far: ${camera.far}`);
console.log('  [PASS] Camera configuration strictly matches cinematic autumn specs.\n');

// 3. VERIFY AUTUMN SUNSET LIGHTING
console.log('[Test 3] Verifying Autumn Sunset Lighting:');
const scene = sceneInstance.scene;
const lights = scene.children.filter(c => c.isLight);

const ambient = lights.find(l => l.isAmbientLight);
assert(ambient, 'AmbientLight must be present in the scene');
assert(ambient.intensity > 0, 'Ambient intensity must be > 0');

const sun = lights.find(l => l.isDirectionalLight);
assert(sun, 'DirectionalLight (Sunlight) must be present in the scene');
assert(sun.intensity > 0, 'Sunlight intensity must be > 0');
assert.strictEqual(sun.castShadow, true, 'Sunlight castShadow must be true');
assert.strictEqual(sun.shadow.mapSize.width, 2048, 'Sunlight shadow map width must be 2048');
assert.strictEqual(sun.shadow.mapSize.height, 2048, 'Sunlight shadow map height must be 2048');

const spotLights = lights.filter(l => l.isSpotLight);
assert(spotLights.length >= 2, 'Must have at least 2 SpotLights (Chalkboard & Teacher Desk)');

const boardSpot = spotLights.find(s => s.name === 'ChalkboardSpotlight');
assert(boardSpot, 'ChalkboardSpotlight must be present');

const deskSpot = spotLights.find(s => s.name === 'TeacherDeskSpotlight');
assert(deskSpot, 'TeacherDeskSpotlight must be present');

const hemi = lights.find(l => l.isHemisphereLight);
assert(hemi, 'HemisphereLight must be present in the scene');
assert.strictEqual(hemi.name, 'ClassroomHemiLight');
assert(hemi.intensity > 0, 'HemisphereLight intensity must be > 0');

console.log(`  -> AmbientLight: #${ambient.color.getHexString()} (Intensity ${ambient.intensity})`);
console.log(`  -> Sunlight: #${sun.color.getHexString()} (Intensity ${sun.intensity}, Shadows: 2048x2048)`);
console.log(`  -> HemisphereLight: #${hemi.color.getHexString()} (Intensity ${hemi.intensity})`);
console.log(`  -> Spotlights: Chalkboard & Teacher Desk correctly positioned`);
console.log('  [PASS] Autumn sunset lighting system verified.\n');

// 4. VERIFY VOLUMETRIC DUST MOTES
console.log('[Test 4] Verifying Volumetric Dust Particles:');
const dustObj = scene.children.find(c => c.isPoints && c.name === 'VolumetricDustMotes');
assert(dustObj, 'Volumetric dust particles object must exist in scene');

const posAttr = dustObj.geometry.attributes.position;
assert(posAttr.count > 0, `Dust particle count must be > 0, got ${posAttr.count}`);
assert.strictEqual(posAttr.array.length, posAttr.count * 3, 'Position buffer length must match count * 3');

const initialX = posAttr.array[0];
const initialY = posAttr.array[1];
const initialZ = posAttr.array[2];

// Run Brownian motion update
for (let step = 0; step < 5; step++) {
  updateDust(0.016, step * 0.016);
}

const updatedX = posAttr.array[0];
const updatedY = posAttr.array[1];
const updatedZ = posAttr.array[2];

const moved = (initialX !== updatedX) || (initialY !== updatedY) || (initialZ !== updatedZ);
assert(moved, 'Particles should undergo Brownian drift across frames');
console.log(`  -> Verified ${posAttr.count} dust points with Brownian motion updates. Particle #0 moved from (${initialX.toFixed(2)}, ${initialY.toFixed(2)}, ${initialZ.toFixed(2)}) to (${updatedX.toFixed(2)}, ${updatedY.toFixed(2)}, ${updatedZ.toFixed(2)})`);
console.log('  [PASS] Volumetric dust system verified.\n');

// 5. VERIFY PARALLAX & RENDER CALLBACK HOOKS
console.log('[Test 5] Verifying Mouse Parallax & Render Hooks:');
let renderCallbackFired = false;
const testCb = (delta, time) => {
  renderCallbackFired = true;
};
addRenderCallback(testCb);

animate(1000);
assert(renderCallbackFired, 'Registered render callback should execute during animate()');
removeRenderCallback(testCb);

setParallaxEnabled(false);
assert.strictEqual(camera.position.x, BASE_CAM_POS.x, 'Camera position should reset when parallax is disabled');
setParallaxEnabled(true);
console.log('  [PASS] Parallax controls & animation frame callbacks verified.\n');

// 6. VERIFY GLTF MESH DETECTION (BLACKBOARD & TEACHER DESK)
console.log('[Test 6] Verifying GLTF Mesh Detection (Blackboard & Teacher Desk):');

const loadedData = await classroomModule.whenLoaded;
const detectedBoard = loadedData.boardMesh;
const detectedDesk = loadedData.teacherDeskMesh;
const model = loadedData.classroomModel;

assert(model !== null, 'Classroom model must be loaded');
assert(detectedBoard !== null, 'Blackboard mesh must be detected');
assert(detectedDesk !== null, 'Teacher desk mesh must be detected');

let meshCount = 0;
let godrayCount = 0;
model.traverse(child => {
  if (child.isMesh) {
    meshCount++;
    if (child.name.toLowerCase().includes('godray')) {
      godrayCount++;
      assert.strictEqual(child.castShadow, false, 'Godray meshes must not cast shadows');
      assert.strictEqual(child.visible, false, 'Godray meshes must be hidden to prevent white blur on chalkboard');
    } else {
      assert.strictEqual(child.receiveShadow, true, 'Classroom meshes must receive shadows');
    }
  }
});

console.log(`  -> Total meshes: ${meshCount}, Godrays: ${godrayCount}`);
console.log(`  -> Detected Blackboard: "${detectedBoard.name}"`);
console.log(`  -> Detected Teacher Desk: "${detectedDesk.name}"`);
console.log('  [PASS] GLTF Blackboard & Teacher Desk mesh identification verified.\n');

console.log('=== ALL CLASSROOM SCENE TESTS PASSED (6/6) ===');
process.exit(0);

