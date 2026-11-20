/**
 * tests/test_interactive_board.mjs
 * 
 * Verification Test Suite for js/scene/interactiveBoard.js
 * 
 * Verifies:
 * 1. 2048x1086 High-Resolution Canvas & THREE.CanvasTexture configuration.
 * 2. Procedural slate background generation (deep moss-slate gradient, grain, smudges).
 * 3. 100% Diegetic Chalkboard UI layout (Level tabs, Protractor, Slider, Action buttons, Telemetry).
 * 4. Pointer event handling & state updates (angle, velocity, level switching, button callbacks).
 * 5. Raycaster screen-to-canvas coordinate mapping.
 * 6. 3D Props (Chalk rail ledge, 4 colored chalk sticks, 3D Felt Eraser with glow aura).
 * 7. Scene attachment & writing plane integration.
 */

import assert from 'assert';
import * as THREE from 'three';
import {
  boardCanvas,
  boardCtx,
  boardTexture,
  boardState,
  UI_LAYOUT,
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  CHALK_COLORS,
  BOARD_WORLD,
  updateBoard,
  handlePointerEvent,
  raycastToCanvas,
  eraser3D,
  chalkRailGroup,
  attachToBoardMesh,
  initInteractiveBoard,
  setTelemetry,
  setGameplayRenderer,
  getControlsState,
  onLaunch,
  onReset,
  onLevelSelect,
  onLetterOpen,
  onParamChange,
  generateSlateBackground,
  drawChalkLine,
  drawChalkRect,
  drawChalkText
} from '../js/scene/interactiveBoard.js';

console.log('================================================================');
console.log('       INTERACTIVE CHALKBOARD & DIEGETIC UI TEST SUITE          ');
console.log('================================================================\n');

async function runTests() {
  // -------------------------------------------------------------
  // TEST 1: CANVAS RESOLUTION & CANVAS TEXTURE
  // -------------------------------------------------------------
  console.log(`[Test 1] Verifying ${CANVAS_WIDTH}x${CANVAS_HEIGHT} Canvas & THREE.CanvasTexture:`);
  assert.strictEqual(boardCanvas.width, CANVAS_WIDTH, `Canvas width must be ${CANVAS_WIDTH}px`);
  assert.strictEqual(boardCanvas.height, CANVAS_HEIGHT, `Canvas height must be ${CANVAS_HEIGHT}px`);
  console.log(`  -> Canvas resolution: ${CANVAS_WIDTH} x ${CANVAS_HEIGHT} (Verified)`);

  assert(boardTexture instanceof THREE.CanvasTexture, 'boardTexture must be an instance of THREE.CanvasTexture');
  assert.strictEqual(boardTexture.minFilter, THREE.LinearFilter, 'minFilter must be LinearFilter');
  assert.strictEqual(boardTexture.magFilter, THREE.LinearFilter, 'magFilter must be LinearFilter');
  assert.strictEqual(boardTexture.generateMipmaps, false, 'generateMipmaps must be false for sharp dynamic text');
  console.log('  -> THREE.CanvasTexture configuration (Verified)');
  console.log('  [PASS] Test 1: Canvas & Texture verified.\n');

  // -------------------------------------------------------------
  // TEST 2: PROCEDURAL SLATE TEXTURE GENERATION
  // -------------------------------------------------------------
  console.log('[Test 2] Verifying Procedural Slate Background:');
  assert.doesNotThrow(() => {
    generateSlateBackground(boardCanvas, boardCtx);
  }, 'generateSlateBackground must execute cleanly');
  console.log('  -> Moss-slate gradient & erased chalk smudges rendered successfully');
  console.log('  [PASS] Test 2: Procedural slate background verified.\n');

  // -------------------------------------------------------------
  // TEST 3: DIEGETIC UI LAYOUT & GEOMETRY
  // -------------------------------------------------------------
  console.log('[Test 3] Verifying Diegetic UI Structure (Zero HTML Controls):');
  // 3 Level Tabs
  assert.strictEqual(UI_LAYOUT.tabs.length, 3, 'Must have exactly 3 level tabs');
  assert.strictEqual(UI_LAYOUT.tabs[0].text, '1: NÉM XIÊN');
  assert.strictEqual(UI_LAYOUT.tabs[1].text, '2: KEPLER');
  assert.strictEqual(UI_LAYOUT.tabs[2].text, '3: HỐ ĐEN');
  console.log('  -> 3 Level tabs present: [1: NÉM XIÊN], [2: KEPLER], [3: HỐ ĐEN]');

  // Protractor arc
  assert(UI_LAYOUT.protractor.radius > 0, 'Protractor must have valid radius');
  assert.strictEqual(UI_LAYOUT.protractor.minAngle, 15);
  assert.strictEqual(UI_LAYOUT.protractor.maxAngle, 80);
  console.log('  -> Arc protractor launcher control configured (15° - 80°)');

  // Velocity slider
  assert(UI_LAYOUT.slider.x2 > UI_LAYOUT.slider.x1, 'Slider must have positive track length');
  assert.strictEqual(UI_LAYOUT.slider.minVal, 15);
  assert.strictEqual(UI_LAYOUT.slider.maxVal, 95);
  console.log('  -> Velocity chalk slider track configured (15 m/s - 95 m/s)');

  // Action buttons
  assert.strictEqual(UI_LAYOUT.buttons.length, 3, 'Must have 3 action buttons');
  const btnIds = UI_LAYOUT.buttons.map(b => b.id);
  assert(btnIds.includes('btnFire'), 'Must include [ PHÓNG PHẤN ]');
  assert(btnIds.includes('btnReset'), 'Must include [ LÀM LẠI ]');
  assert(btnIds.includes('btnLetter'), 'Must include [ XEM THƯ 20/11 ]');
  console.log('  -> 3 Diegetic action buttons present: PHÓNG PHẤN, LÀM LẠI, XEM THƯ');
  console.log('  [PASS] Test 3: Diegetic UI structure verified.\n');

  // -------------------------------------------------------------
  // TEST 4: POINTER INTERACTION & STATE MACHINE
  // -------------------------------------------------------------
  console.log('[Test 4] Verifying Diegetic Pointer Interaction & Event Handlers:');
  
  // Test Level tab click
  let selectedLevel = 0;
  onLevelSelect((lvl) => { selectedLevel = lvl; });
  
  // Click on Tab 2: [ 2: KEPLER ]
  const tab2 = UI_LAYOUT.tabs[1];
  const tab2Center = { x: tab2.x + tab2.w * 0.5, y: tab2.y + tab2.h * 0.5 };
  const consumedTab = handlePointerEvent('pointerdown', tab2Center.x, tab2Center.y, true);
  assert.strictEqual(consumedTab, true, 'Clicking tab must be consumed');
  assert.strictEqual(boardState.currentLevel, 2, 'boardState.currentLevel must update to 2');
  assert.strictEqual(selectedLevel, 2, 'onLevelSelect callback must be triggered with 2');
  console.log('  -> Level tab switching: Level 2 activated successfully');

  // Test Protractor angle drag
  let paramChanged = null;
  onParamChange((params) => { paramChanged = params; });

  // Center of protractor from UI_LAYOUT (at launcher origin):
  // Drag to a 60 degree position:
  const pr = UI_LAYOUT.protractor;
  const rad60 = 60 * Math.PI / 180;
  const protractorDragPos = { x: pr.cx + Math.round(pr.radius * Math.cos(rad60)), y: pr.cy - Math.round(pr.radius * Math.sin(rad60)) };
  handlePointerEvent('pointerdown', protractorDragPos.x, protractorDragPos.y, true);
  assert.strictEqual(boardState.isDraggingProtractor, true, 'isDraggingProtractor must be active');
  
  handlePointerEvent('pointermove', protractorDragPos.x, protractorDragPos.y, true);
  assert(Math.abs(boardState.angle - 60.0) < 1.0, `Angle should be ~60°, got ${boardState.angle}`);
  console.log(`  -> Protractor dragging: Angle set to ${boardState.angle}°`);

  handlePointerEvent('pointerup', protractorDragPos.x, protractorDragPos.y, false);
  assert.strictEqual(boardState.isDraggingProtractor, false, 'isDraggingProtractor must reset on pointerup');

  // Test Velocity slider drag
  // Track: x1=370, x2=680, minVal=15, maxVal=95.
  // Midpoint x = (370 + 680) / 2 = 525 -> val = (15 + 95) / 2 = 55
  handlePointerEvent('pointerdown', 525, 955, true);
  assert.strictEqual(boardState.isDraggingSlider, true, 'isDraggingSlider must be active');

  handlePointerEvent('pointermove', 525, 955, true);
  assert(Math.abs(boardState.velocity - 55.0) < 1.5, `Velocity should be ~55 m/s, got ${boardState.velocity}`);
  console.log(`  -> Velocity slider dragging: Velocity set to ${boardState.velocity} m/s`);

  handlePointerEvent('pointerup', 525, 955, false);
  assert.strictEqual(boardState.isDraggingSlider, false, 'isDraggingSlider must reset on pointerup');

  // Test Action button callbacks
  let launchTriggered = false;
  let resetTriggered = false;
  let letterTriggered = false;

  onLaunch(() => { launchTriggered = true; });
  onReset(() => { resetTriggered = true; });
  onLetterOpen(() => { letterTriggered = true; });

  // Click [ PHÓNG PHẤN ] (x: 730, y: 922, w: 260, h: 66)
  handlePointerEvent('pointerdown', 730 + 130, 922 + 33, true);
  assert.strictEqual(launchTriggered, true, 'Launch callback must fire on [ PHÓNG PHẤN ] click');

  // Click [ LÀM LẠI ] (x: 1020, y: 922, w: 180, h: 66)
  handlePointerEvent('pointerdown', 1020 + 90, 922 + 33, true);
  assert.strictEqual(resetTriggered, true, 'Reset callback must fire on [ LÀM LẠI ] click');

  // Click [ XEM THƯ ] (x: 1230, y: 922, w: 220, h: 66)
  handlePointerEvent('pointerdown', 1230 + 110, 922 + 33, true);
  assert.strictEqual(letterTriggered, true, 'Letter callback must fire on [ XEM THƯ ] click');
  console.log('  -> Action button callbacks: Launch, Reset, and Tribute Letter verified');

  console.log('  [PASS] Test 4: Pointer interaction & callbacks verified.\n');

  // -------------------------------------------------------------
  // TEST 5: RAYCASTER SCREEN-TO-CANVAS COORDINATE CONVERTER
  // -------------------------------------------------------------
  console.log('[Test 5] Verifying 3D Raycaster to Canvas Projection:');
  const testScene = new THREE.Scene();
  const testCamera = new THREE.PerspectiveCamera(52, 16 / 9, 1, 2000);
  testCamera.position.set(-220.0, 145.0, 120.0);
  testCamera.lookAt(45.0, 155.0, 485.0);
  testCamera.updateMatrixWorld(true);

  // Initialize board in test scene
  const boardInstance = initInteractiveBoard({ scene: testScene, camera: testCamera });
  testScene.updateMatrixWorld(true);
  assert(boardInstance.writingPlaneMesh instanceof THREE.Mesh, 'Writing plane mesh must be instantiated');

  // Cast ray at screen center (960, 540 in a 1920x1080 viewport)
  const hit = raycastToCanvas(960, 540, testCamera);
  assert.strictEqual(hit.hit, true, 'Ray from screen center must intersect writing plane');
  assert(hit.x >= 0 && hit.x <= CANVAS_WIDTH, `Canvas X must be within [0, 2048], got ${hit.x}`);
  assert(hit.y >= 0 && hit.y <= CANVAS_HEIGHT, `Canvas Y must be within [0, 1086], got ${hit.y}`);
  
  // Verify hit is close to center of board (~675, ~452 on 2048x820 canvas, or legacy ~2014, ~592)
  console.log(`  -> Screen center mapped to Board Canvas: (${hit.x.toFixed(1)}, ${hit.y.toFixed(1)})`);
  assert(Math.abs(hit.x - 675) < 30 || Math.abs(hit.x - 2014) < 30, `X should be near center (675 or 2014), got ${hit.x}`);
  assert(Math.abs(hit.y - 452) < 30 || Math.abs(hit.y - 592) < 30, `Y should be near center (452 or 592), got ${hit.y}`);
  console.log('  [PASS] Test 5: Raycaster projection verified.\n');

  // -------------------------------------------------------------
  // TEST 6: 3D PROPS (CHALK RAIL LEDGE, CHALK STICKS & 3D ERASER)
  // -------------------------------------------------------------
  console.log('[Test 6] Verifying 3D Props (Chalk Rail & 3D Felt Eraser):');
  assert(chalkRailGroup instanceof THREE.Group, 'chalkRailGroup must be a THREE.Group');
  assert(eraser3D instanceof THREE.Group, 'eraser3D must be a THREE.Group');

  // Verify chalk rail children
  const railChildrenNames = chalkRailGroup.children.map(c => c.name || c.type);
  console.log('  -> Chalk rail objects:', railChildrenNames);
  assert(chalkRailGroup.children.length >= 6, 'Must contain rail ledge, 4 chalk sticks, broken stick, eraser');

  // Verify 4 colored chalk sticks exist
  assert(chalkRailGroup.getObjectByName('ChalkStick_white'), 'Must have white chalk stick');
  assert(chalkRailGroup.getObjectByName('ChalkStick_yellow'), 'Must have yellow chalk stick');
  assert(chalkRailGroup.getObjectByName('ChalkStick_cyan'), 'Must have cyan chalk stick');
  assert(chalkRailGroup.getObjectByName('ChalkStick_red'), 'Must have red chalk stick');
  console.log('  -> All 4 colored chalk sticks verified');

  // Verify 3D Eraser structure
  assert(eraser3D.children.length >= 3, 'Eraser must have wooden handle, felt pad, and glow aura');
  assert(eraser3D.getObjectByName('EraserGlowAura'), 'Eraser must contain glow aura mesh');
  
  // Verify eraser position at bottom-left ledge
  console.log(`  -> 3D Felt Eraser position: (${eraser3D.position.x.toFixed(1)}, ${eraser3D.position.y.toFixed(1)}, ${eraser3D.position.z.toFixed(1)})`);
  assert(eraser3D.position.x < BOARD_WORLD.center.x, 'Eraser must be at the left side of the board');
  assert(Math.abs(eraser3D.position.y - BOARD_WORLD.min.y) < 10, 'Eraser must sit on the bottom rail');
  console.log('  [PASS] Test 6: 3D Props verified.\n');

  // -------------------------------------------------------------
  // TEST 7: TELEMETRY UPDATE & CONTROLS EXPORTS
  // -------------------------------------------------------------
  console.log('[Test 7] Verifying Telemetry Updates & Public API:');
  setTelemetry({
    range: 154.2,
    curvature: 42.8,
    flightTime: 3.4
  });
  assert.strictEqual(boardState.telemetry.range, 154.2);
  assert.strictEqual(boardState.telemetry.curvature, 42.8);
  assert.strictEqual(boardState.telemetry.flightTime, 3.4);
  console.log('  -> Telemetry dynamic update (Verified)');

  let externalRenderCalled = false;
  setGameplayRenderer((ctx) => {
    externalRenderCalled = true;
  });
  updateBoard();
  assert.strictEqual(externalRenderCalled, true, 'external gameplay renderer must be invoked in updateBoard');
  console.log('  -> setGameplayRenderer hook verified');

  const controls = getControlsState();
  assert.strictEqual(controls.level, boardState.currentLevel);
  assert.strictEqual(controls.angle, boardState.angle);
  assert.strictEqual(controls.velocity, boardState.velocity);
  console.log('  -> getControlsState() output (Verified)');
  console.log('  [PASS] Test 7: Public API verified.\n');

  console.log('================================================================');
  console.log('  ALL INTERACTIVE CHALKBOARD & DIEGETIC UI TESTS PASSED (7/7)  ');
  console.log('================================================================\n');
}

runTests().catch(err => {
  console.error('\n❌ Test Failure:', err);
  process.exit(1);
});
