/**
 * test_latex_renderer.mjs
 * Comprehensive Unit Test Suite for LatexChalkRenderer & Zero-Collision Layout Engine.
 * Verifies MathJax 3 vector SVG generation, exact bounding box measurement,
 * zero-collision spatial placement (padding >= 24px), chalk noise rasterization,
 * and the 88 classic theoretical physics formulas.
 */

import assert from 'assert';
import { createCanvas } from '@napi-rs/canvas';
import {
  LatexChalkRenderer,
  FormulaLayoutEngine,
  SpatialHashGrid,
  CHALK_COLORS,
  FORMULA_CATALOG,
  PHYSICS_FORMULAS_LIBRARY
} from '../js/engine/latexChalkRenderer.js';

console.log('================================================================');
console.log('      LATEX CHALK RENDERER & ZERO-COLLISION TEST SUITE         ');
console.log('================================================================\n');

async function runTests() {
  const renderer = new LatexChalkRenderer();

  // -------------------------------------------------------------
  // TEST 1: CHALK COLOR VARIANTS
  // -------------------------------------------------------------
  console.log('[Test 1] Verifying Authentic Chalk Color Palette:');
  assert.strictEqual(CHALK_COLORS.WHITE, '#f8fafc', 'Chalk white must match #f8fafc');
  assert.strictEqual(CHALK_COLORS.YELLOW, '#fef08a', 'Chalk yellow must match #fef08a');
  assert.strictEqual(CHALK_COLORS.CYAN, '#93c5fd', 'Chalk cyan must match #93c5fd');
  assert.strictEqual(CHALK_COLORS.RED, '#fca5a5', 'Chalk red must match #fca5a5');
  console.log('  -> All 4 chalk color constants verified.');
  console.log('  [PASS] Test 1: Color variants match specification.\n');

  // -------------------------------------------------------------
  // TEST 2: 85+ CLASSIC PHYSICS FORMULAS LIBRARY
  // -------------------------------------------------------------
  console.log('[Test 2] Verifying 85+ Classic Physics Formulas Library:');
  console.log(`  -> Total formulas count: ${FORMULA_CATALOG.length}`);
  assert(FORMULA_CATALOG.length >= 85, `Must have at least 85 formulas, found ${FORMULA_CATALOG.length}`);

  const categories = new Set(FORMULA_CATALOG.map(f => f.category));
  console.log(`  -> Covered Physics Pillars: ${Array.from(categories).join(', ')}`);
  assert(categories.size >= 5, 'Must cover at least 5 distinct theoretical physics pillars');

  for (const item of FORMULA_CATALOG) {
    assert(item.id, `Formula missing id: ${JSON.stringify(item)}`);
    assert(item.name, `Formula ${item.id} missing name`);
    assert(item.latex, `Formula ${item.id} missing latex`);
    assert(item.svg && item.svg.includes('<svg'), `Formula ${item.id} missing valid SVG`);
    assert(item.width > 0 && item.height > 0, `Formula ${item.id} has invalid dimensions: ${item.width}x${item.height}`);
  }
  console.log(`  -> Verified ${FORMULA_CATALOG.length} precompiled vector SVGs with non-zero bounding boxes.`);
  console.log('  [PASS] Test 2: Formula library satisfies all curriculum pillars.\n');

  // -------------------------------------------------------------
  // TEST 3: MATHJAX 3 DYNAMIC VECTOR SVG COMPILATION
  // -------------------------------------------------------------
  console.log('[Test 3] Testing Dynamic MathJax 3 LaTeX-to-Vector-SVG Compilation:');
  const customLatex = '\\oint_C \\mathbf{B} \\cdot d\\boldsymbol{\\ell} = \\mu_0 I_{\\text{enc}} + \\mu_0\\varepsilon_0 \\frac{d\\Phi_E}{dt}';
  const compiled = await renderer.convertLatexToSvg(customLatex, CHALK_COLORS.YELLOW);

  assert(compiled.svg.startsWith('<svg') || compiled.svg.includes('<svg'), 'Output must contain valid SVG tag');
  assert(compiled.svg.includes('<path'), 'Output SVG must contain vector glyph paths');
  assert(compiled.width > 0, 'Measured width must be positive');
  assert(compiled.height > 0, 'Measured height must be positive');
  assert(compiled.svg.includes(CHALK_COLORS.YELLOW), 'Output SVG must contain target chalk yellow color');
  console.log(`  -> Compiled arbitrary dynamic formula: width=${compiled.width}px, height=${compiled.height}px`);
  console.log('  [PASS] Test 3: MathJax 3 dynamic vector SVG compilation verified.\n');

  // -------------------------------------------------------------
  // TEST 4: SPATIAL HASH GRID & AABB MEASUREMENT
  // -------------------------------------------------------------
  console.log('[Test 4] Testing SpatialHashGrid and Bounding Box Calculations:');
  const grid = new SpatialHashGrid(2048, 1086, 128);
  const box1 = { id: 'box1', left: 100, right: 250, top: 100, bottom: 150 };
  const box2 = { id: 'box2', left: 260, right: 400, top: 100, bottom: 150 };
  const box3 = { id: 'box3', left: 150, right: 300, top: 120, bottom: 180 }; // overlaps box1 and box2

  grid.insert(box1);
  grid.insert(box2);

  const queryCandidates = grid.query(box3);
  assert(queryCandidates.has(box1), 'Query must identify box1 as potential collider');
  assert(queryCandidates.has(box2), 'Query must identify box2 as potential collider');
  console.log('  -> Spatial hash grid spatial indexing verified.');
  console.log('  [PASS] Test 4: SpatialHashGrid operates efficiently.\n');

  // -------------------------------------------------------------
  // TEST 5: ZERO-COLLISION LAYOUT ENGINE (PADDING >= 24px)
  // -------------------------------------------------------------
  console.log('[Test 5] Testing Zero-Collision Layout Engine with 88 Formulas:');
  const boardWidth = 2048;
  const boardHeight = 1086;
  const padding = 24; // Standard required safety padding
  const margin = 35;
  const reservedZones = [
    // Reserved Teacher Desk zone at bottom-left corner
    { x: 35, y: boardHeight - 240, width: 320, height: 200 }
  ];

  const layoutEngine = new FormulaLayoutEngine({
    boardWidth,
    boardHeight,
    padding,
    margin,
    reservedZones
  });

  const startTime = Date.now();
  const placedBoxes = layoutEngine.generateLayout(FORMULA_CATALOG, {
    centerX: boardWidth / 2,
    centerY: boardHeight / 2,
    maxRotation: 8 // organic chalk tilt [-8 deg, +8 deg]
  });
  const duration = Date.now() - startTime;

  console.log(`  -> Placed all ${placedBoxes.length}/${FORMULA_CATALOG.length} formulas in ${duration}ms.`);
  assert.strictEqual(placedBoxes.length, FORMULA_CATALOG.length, 'Every formula in catalog must be placed!');

  // Strict N^2 pairwise collision verification
  const verification = layoutEngine.verifyZeroCollisions(placedBoxes);
  console.log(`  -> Zero-collision check: collisions found = ${verification.collisionCount}`);
  assert.strictEqual(verification.isValid, true, 'Zero collisions must be strictly guaranteed!');
  assert.strictEqual(verification.collisionCount, 0, 'Collision count must be 0!');

  // Verify boundary adherence and reserved zone clearance
  for (const b of placedBoxes) {
    assert(b.left >= margin, `Box ${b.id} violated left margin: ${b.left} < ${margin}`);
    assert(b.right <= boardWidth - margin, `Box ${b.id} violated right margin: ${b.right} > ${boardWidth - margin}`);
    assert(b.top >= margin, `Box ${b.id} violated top margin: ${b.top} < ${margin}`);
    assert(b.bottom <= boardHeight - margin, `Box ${b.id} violated bottom margin: ${b.bottom} > ${boardHeight - margin}`);

    // Check reserved zone clearance
    for (const rz of reservedZones) {
      const overlapX = (b.left < rz.x + rz.width) && (b.right > rz.x);
      const overlapY = (b.top < rz.y + rz.height) && (b.bottom > rz.y);
      assert(!(overlapX && overlapY), `Box ${b.id} collided with reserved teacher desk zone!`);
    }
  }
  console.log(`  -> All ${placedBoxes.length} formulas respect >= 24px safety padding & reserved zones.`);
  console.log('  [PASS] Test 5: Zero-collision layout engine verified with 100% mathematical guarantee.\n');

  // -------------------------------------------------------------
  // TEST 6: CANVAS RASTERIZATION WITH PROCEDURAL CHALK NOISE
  // -------------------------------------------------------------
  console.log('[Test 6] Testing Canvas Rasterization & Procedural Chalk Texture:');
  const canvas = createCanvas(boardWidth, boardHeight);
  const ctx = canvas.getContext('2d');

  // Background
  ctx.fillStyle = '#162821';
  ctx.fillRect(0, 0, boardWidth, boardHeight);

  // Single formula render with procedural chalk effect
  const testFormula = FORMULA_CATALOG.find(f => f.id === 'schrodinger_td');
  await renderer.renderFormula(ctx, testFormula, 500, 300, {
    rotationDeg: -5,
    color: CHALK_COLORS.YELLOW,
    chalkNoise: true
  });

  // Verify non-zero chalk pixels in target region
  const sampleData = ctx.getImageData(450, 270, 100, 60).data;
  let chalkPixelCount = 0;
  for (let i = 0; i < sampleData.length; i += 4) {
    const r = sampleData[i];
    const g = sampleData[i + 1];
    const b = sampleData[i + 2];
    // Check if pixel shifted from background #162821 (r=22, g=40, b=33) towards chalk yellow #fef08a
    if (r > 60 || g > 80) {
      chalkPixelCount++;
    }
  }
  console.log(`  -> Detected ${chalkPixelCount} textured chalk pixels in rendered formula region.`);
  assert(chalkPixelCount > 100, 'Rendered formula must produce visible chalk pixels on canvas');

  // Full Supernova layout render test
  console.log('  -> Rendering full 88-formula Supernova layout onto 2048x1086 canvas...');
  const supernovaResult = await renderer.renderFullSupernovaLayout(ctx, boardWidth, boardHeight, {
    padding: 24,
    margin: 35,
    reservedZones,
    chalkNoise: true
  });
  assert(supernovaResult.verification.isValid, 'Full Supernova layout must maintain zero collisions');
  assert.strictEqual(supernovaResult.placedBoxes.length, FORMULA_CATALOG.length, 'All 88 formulas rendered');
  console.log('  -> Complete Supernova blackboard rasterization succeeded without errors.');
  console.log('  [PASS] Test 6: Canvas rasterization and procedural chalk texture verified.\n');

  console.log('================================================================');
  console.log('      ALL TESTS PASSED SUCCESSFULLY! (6/6 SUITES PASS)          ');
  console.log('================================================================');
}

runTests().catch(err => {
  console.error('\n[FATAL ERROR IN TEST SUITE]:', err);
  process.exit(1);
});
