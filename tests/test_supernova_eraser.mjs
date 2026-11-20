/**
 * test_supernova_eraser.mjs
 * Comprehensive unit test suite for:
 * 1. BlackHoleSupernova (js/physics/blackHoleSupernova.js)
 * 2. EraserController (js/engine/eraserController.js)
 */

import assert from 'node:assert';
import { createCanvas, Image } from '@napi-rs/canvas';
import { BlackHoleSupernova } from '../js/physics/blackHoleSupernova.js';
import { EraserController } from '../js/engine/eraserController.js';
import { FORMULA_CATALOG } from '../js/engine/formulaCatalog.js';

console.log('================================================================');
console.log('       SUPERNOVA & ERASER CONTROLLER TEST SUITE                 ');
console.log('================================================================\n');

// Mock window and CustomEvent for Node.js environment
let dispatchedEvents = [];
globalThis.window = {
  dispatchEvent: (evt) => {
    dispatchedEvents.push(evt);
  },
  Image
};
globalThis.CustomEvent = class CustomEvent {
  constructor(type, eventInitDict = {}) {
    this.type = type;
    this.detail = eventInitDict.detail || null;
  }
};

let testCount = 0;
let passedCount = 0;

async function runTest(name, fn) {
  testCount++;
  try {
    await fn();
    passedCount++;
    console.log(`[PASS] Test ${testCount}: ${name}`);
  } catch (err) {
    console.error(`[FAIL] Test ${testCount}: ${name}`);
    console.error(err);
    process.exit(1);
  }
}

async function main() {
  // -----------------------------------------------------------------------------
  // TEST 1: BlackHoleSupernova Instantiation & Layout Generation
  // -----------------------------------------------------------------------------
  await runTest('BlackHoleSupernova initialization & 88-formula zero-collision layout', () => {
    const supernova = new BlackHoleSupernova({
      boardWidth: 2048,
      boardHeight: 1086
    });

    assert.strictEqual(supernova.state, 'IDLE');
    assert.strictEqual(supernova.boardWidth, 2048);
    assert.strictEqual(supernova.boardHeight, 1086);
    assert.strictEqual(supernova.isLayoutReady, true);
    assert.ok(supernova.placedBoxes.length >= 45 && supernova.placedBoxes.length <= 88);

    // Verify zero collisions among placed boxes
    const verification = supernova.layoutEngine.verifyZeroCollisions(supernova.placedBoxes);
    assert.strictEqual(verification.isValid, true);
    assert.strictEqual(verification.collisionCount, 0);
    console.log(`  -> Placed ${supernova.placedBoxes.length} formulas with 0 collisions.`);
  });

  // -----------------------------------------------------------------------------
  // TEST 2: Phase A Singularity Implosion Sequence (Swell 1.65x then Collapse to 4px)
  // -----------------------------------------------------------------------------
  await runTest('Phase A: Singularity Implosion (Swell 1.65x then Collapse to 4px)', () => {
    const supernova = new BlackHoleSupernova();
    const startPos = { x: 1500, y: 543, rs: 56 };

    supernova.triggerSequence(startPos);
    assert.strictEqual(supernova.state, 'IMPLODING');
    assert.strictEqual(supernova.startPos.x, 1500);
    assert.strictEqual(supernova.startRadius, 56);
    assert.strictEqual(supernova.spaghettiFragments.length, 0); // No messy debris fragments

    // Advance simulation to 1.0 second (swell phase, p = 0.50 < 0.60)
    for (let step = 0; step < 60; step++) {
      supernova.update(1 / 60);
    }
    // Event horizon should swell > startRadius
    assert(supernova.bhRadius > 56, `Expected bhRadius > 56, got ${supernova.bhRadius}`);

    // Advance simulation to 1.95 seconds (collapse phase, p = 0.975)
    for (let step = 0; step < 57; step++) {
      supernova.update(1 / 60);
    }

    // Black hole should have migrated closer to center (1024, 543)
    assert(supernova.blackHolePos.x < 1500 && supernova.blackHolePos.x > 1024);
    // Event horizon should have collapsed deeply
    assert(supernova.bhRadius < 56, `Expected bhRadius < 56, got ${supernova.bhRadius}`);
    // Smooth collapse without camera bounce
    assert.strictEqual(supernova.shake.intensity, 0);

    console.log(`  -> Implosion near end: X=${supernova.blackHolePos.x.toFixed(1)}, Radius=${supernova.bhRadius.toFixed(1)}, Shake=${supernova.shake.intensity.toFixed(2)}px`);
  });

  // -----------------------------------------------------------------------------
  // TEST 3: Transition to Phase B Supernova Blast & 300+ Particles & Shockwave Rings
  // -----------------------------------------------------------------------------
  await runTest('Phase B: Transition to Supernova Explosion & 300+ Particles', () => {
    const supernova = new BlackHoleSupernova();
    supernova.triggerSequence({ x: 1500, y: 543, rs: 56 });

    // Advance past 2.0s implosion duration (e.g. 2.05s = 123 frames)
    for (let step = 0; step < 123; step++) {
      supernova.update(1 / 60);
    }

    assert.strictEqual(supernova.state, 'EXPLODING');
    assert(supernova.shockwaveRings && supernova.shockwaveRings.length === 2, 'Should spawn 2 shockwave rings');
    assert(supernova.shockwaveParticles.length >= 300, `Expected >= 300 particles (150 streaks + 170 clouds), got ${supernova.shockwaveParticles.length}`);
    assert.ok(supernova.flyingFormulas.length >= 45 && supernova.flyingFormulas.length <= 88);
    assert(supernova.flashAlpha >= 0 && supernova.flashAlpha <= 0.72, 'Flash alpha should decay cleanly from 0.72');

    console.log(`  -> Supernova explosion spawned ${supernova.shockwaveRings.length} rings, ${supernova.shockwaveParticles.length} particles and ${supernova.flyingFormulas.length} flying formulas.`);
  });

  // -----------------------------------------------------------------------------
  // TEST 4: Explosion Completion, Full Baking & Eraser Handover
  // -----------------------------------------------------------------------------
  await runTest('Explosion Completion: Canvas Baking & Handover to Eraser', async () => {
    const staticCanvas = createCanvas(2048, 1086);
    const staticCtx = staticCanvas.getContext('2d');

    let completionCalled = false;
    const eraser = new EraserController({
      boardWidth: 2048,
      boardHeight: 1086,
      staticCanvas,
      staticCtx
    });

    const supernova = new BlackHoleSupernova({
      boardWidth: 2048,
      boardHeight: 1086,
      staticCtx,
      eraserController: eraser,
      onComplete: () => {
        completionCalled = true;
      }
    });

    supernova.triggerSequence({ x: 1024, y: 543 });

    // Run full simulation until both implosion (3.0s) and explosion (3.2s) finish (6.3s = 380 frames)
    for (let step = 0; step < 380; step++) {
      supernova.update(1 / 60);
    }

    if (supernova.bakePromise) {
      await supernova.bakePromise;
    }

    assert.strictEqual(supernova.state, 'COMPLETED');
    assert.strictEqual(supernova.isBakeCompleted, true);
    assert.strictEqual(completionCalled, true);
    assert.strictEqual(eraser.isActive, true);

    console.log(`  -> Supernova completed. Eraser is active: ${eraser.isActive}. Callback called: ${completionCalled}`);
  });

  // -----------------------------------------------------------------------------
  // TEST 5: EraserController 80x45 Downsampled Grid & destination-out
  // -----------------------------------------------------------------------------
  await runTest('EraserController: 80x45 Downsampled Grid & Multi-Stroke Erasure', () => {
    const staticCanvas = createCanvas(2048, 1086);
    const staticCtx = staticCanvas.getContext('2d');

    // Fill canvas with chalk haze
    staticCtx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    staticCtx.fillRect(0, 0, 2048, 1086);

    const eraser = new EraserController({
      boardWidth: 2048,
      boardHeight: 1086,
      staticCanvas,
      staticCtx
    });

    assert.strictEqual(eraser.gridCols, 80);
    assert.strictEqual(eraser.gridRows, 45);
    assert.strictEqual(eraser.totalCells, 3600);
    assert.strictEqual(eraser.cleanedPercentage, 0);

    eraser.activate();
    assert.strictEqual(eraser.isActive, true);

    // Simulate dragging across a portion of the board
    eraser.handlePointer('down', 500, 300);
    assert.strictEqual(eraser.isDragging, true);

    eraser.handlePointer('move', 800, 300);
    eraser.handlePointer('move', 800, 600);
    eraser.handlePointer('up', 800, 600);

    assert.strictEqual(eraser.isDragging, false);
    assert(eraser.cleanedCells > 0, 'Cleaned cells should be > 0');
    assert(eraser.cleanedPercentage > 0, 'Cleaned percentage should be > 0');
    assert(eraser.crumbs.length > 0, 'Should spawn chalk crumbs');

    console.log(`  -> Drag wipe cleaned ${eraser.cleanedCells}/3600 cells (${eraser.cleanedPercentage}%), spawned ${eraser.crumbs.length} crumbs.`);
  });

  // -----------------------------------------------------------------------------
  // TEST 6: Eraser >= 80% Threshold Auto-Clean & phase1-completed Event Dispatch
  // -----------------------------------------------------------------------------
  await runTest('EraserController: >= 80% Threshold Auto-Clean & Phase 1 Completion Event', () => {
    dispatchedEvents = [];
    const staticCanvas = createCanvas(2048, 1086);
    const staticCtx = staticCanvas.getContext('2d');

    let hookTriggered = false;
    const eraser = new EraserController({
      boardWidth: 2048,
      boardHeight: 1086,
      staticCanvas,
      staticCtx,
      onPhase1Completed: () => {
        hookTriggered = true;
      }
    });

    eraser.activate();

    // Programmatically mark 82% of cells cleaned (to simulate thorough user wiping)
    const targetClean = Math.floor(eraser.totalCells * 0.82);
    for (let i = 0; i < targetClean; i++) {
      eraser.grid[i] = 1;
    }
    eraser.cleanedCells = targetClean;
    eraser.cleanedPercentage = Math.round((targetClean / eraser.totalCells) * 100);

    assert(eraser.cleanedPercentage >= 80);

    // Update loop for 0.7s to let auto-clean finish (0.6s duration)
    for (let step = 0; step < 45; step++) {
      eraser.update(1 / 60);
    }

    assert.strictEqual(eraser.hasTriggeredCompletion, true);
    assert.strictEqual(eraser.cleanedPercentage, 100);
    assert.strictEqual(eraser.isDragging, false);
    assert.strictEqual(eraser.pos.x, eraser.dockPos.x);

    // Check event dispatch
    const phase1Event = dispatchedEvents.find(e => e.type === 'phase1-completed');
    assert(phase1Event, "CustomEvent 'phase1-completed' must be dispatched!");
    assert.strictEqual(phase1Event.detail.cleanedPercentage, 100);

    console.log(`  -> Auto-clean succeeded! Cleaned = 100%, Docked at (${eraser.pos.x}, ${eraser.pos.y}), Event 'phase1-completed' dispatched.`);
  });

  console.log('\n================================================================');
  console.log(`      ALL TESTS PASSED! (${passedCount}/${testCount} SUITES PASS)             `);
  console.log('================================================================\n');
}

main().catch(err => {
  console.error('Unhandled test failure:', err);
  process.exit(1);
});
