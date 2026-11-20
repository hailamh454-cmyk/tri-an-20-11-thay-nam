import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.glb': 'model/gltf-binary',
  '.gltf': 'model/gltf+json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.mp4': 'video/mp4',
  '.wasm': 'application/wasm'
};

function createStaticServer(port = 8080) {
  const server = http.createServer((req, res) => {
    let reqUrl = req.url.split('?')[0];
    if (reqUrl === '/') reqUrl = '/index.html';

    const safePath = path.normalize(decodeURIComponent(reqUrl)).replace(/^(\.\.[\/\\])+/, '');
    const filePath = path.join(rootDir, safePath);

    fs.stat(filePath, (err, stats) => {
      if (err || !stats.isFile()) {
        res.statusCode = 404;
        res.end(`File not found: ${reqUrl}`);
        return;
      }

      const ext = path.extname(filePath).toLowerCase();
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';

      res.writeHead(200, {
        'Content-Type': contentType,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Access-Control-Allow-Origin': '*'
      });

      const stream = fs.createReadStream(filePath);
      stream.pipe(res);
    });
  });

  return new Promise((resolve) => {
    server.listen(port, '127.0.0.1', () => {
      console.log(`[Server] Static server running on http://127.0.0.1:${port}`);
      resolve(server);
    });
    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.log(`[Server] Port ${port} is already active, reusing existing server.`);
        resolve({ close: (cb) => { if (cb) cb(); } });
      } else {
        throw err;
      }
    });
  });
}

async function runE2ETests() {
  console.log('=== STARTING 3D CLASSROOM E2E BROWSER TEST (PLAYWRIGHT) ===');
  
  const server = await createStaticServer(8080);
  
  let browser = null;
  const consoleErrors = [];
  const consoleLogs = [];

  try {
    // Launch browser using system Chrome
    browser = await chromium.launch({
      executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-gpu',
        '--use-gl=angle',
        '--use-angle=swiftshader'
      ]
    });

    const context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
      deviceScaleFactor: 2 // High-DPI Retina simulation
    });

    const page = await context.newPage();

    page.on('console', msg => {
      const text = msg.text();
      const type = msg.type();
      if (type === 'error') {
        // Filter out non-fatal WebGL / font warnings if any
        consoleErrors.push(text);
        console.error(`[Browser Error] ${text}`);
      } else {
        consoleLogs.push(text);
        console.log(`[Browser Log] ${text}`);
      }
    });

    page.on('pageerror', err => {
      consoleErrors.push(err.message);
      console.error(`[Page Error] ${err.message}`);
    });

    console.log('Navigating to http://127.0.0.1:8080/ ...');
    await page.goto('http://127.0.0.1:8080/', { waitUntil: 'domcontentloaded' });
    
    // 1. Verify Page Title
    const title = await page.title();
    console.log(`Page title: "${title}"`);
    if (!title.includes('20/11') || !title.includes('Thầy Nam')) {
      throw new Error(`Unexpected page title: ${title}`);
    }
    console.log('[PASS] Page title verified.');

    // 2. Verify Full-Screen 3D WebGL Canvas
    const canvas = await page.$('#webgl-canvas');
    if (!canvas) throw new Error('#webgl-canvas element not found in DOM!');
    
    const box = await canvas.boundingBox();
    console.log(`WebGL Canvas Dimensions: ${box.width}x${box.height}`);
    if (box.width < 1000 || box.height < 600) {
      throw new Error('Canvas is not full-screen!');
    }
    console.log('[PASS] Full-Screen 3D WebGL Canvas verified.');

    // 3. Verify ZERO External HTML Control Panels
    const htmlHud = await page.$('#chalk-hud');
    const rangeInputs = await page.$$('input[type="range"]');
    if (htmlHud || rangeInputs.length > 0) {
      throw new Error('Detected external HTML control panels or sliders! Must be 100% diegetic!');
    }
    console.log('[PASS] Zero external HTML control panels verified (100% Diegetic Chalkboard UI).');

    // 4. Wait for 3D Classroom & App bootstrap
    console.log('Waiting for 3D Classroom assets to load and initialize...');
    await page.waitForFunction(() => window.__CLASSROOM_APP__ && window.__CLASSROOM_APP__.state !== 'LOADING', {
      timeout: 25000
    });
    console.log('[PASS] 3D Classroom and app bootstrap completed.');

    // 5. Test Teacher Desk Tribute Letter Modal
    console.log('Testing Tribute Letter modal interaction...');
    await page.evaluate(() => {
      window.__CLASSROOM_APP__.openTributeLetter();
    });
    await page.waitForTimeout(300);

    const letterModal = await page.$('#letter-modal');
    const isVisible = await page.evaluate(el => !el.classList.contains('hidden'), letterModal);
    if (!isVisible) throw new Error('Letter modal did not open!');
    console.log('[PASS] Tribute Letter modal opened successfully.');

    // Click "Bước Lên Bục Giảng"
    await page.evaluate(() => document.getElementById('btn-start-chalkboard').click());
    await page.waitForTimeout(400);

    const isClosed = await page.evaluate(el => el.classList.contains('hidden'), letterModal);
    if (!isClosed) throw new Error('Letter modal did not close on button click!');
    console.log('[PASS] Started chalkboard simulation.');

    // 6. Test Level 1 Ballistics & Fire Projectile
    console.log('Testing Level 1 (Ballistics with Quadratic Drag)...');
    await page.evaluate(() => {
      window.__CLASSROOM_APP__.setLevel(1);
      window.__CLASSROOM_APP__.gameplay.fireProjectile(45, 36);
    });
    await page.waitForTimeout(600);

    const isBulletActive = await page.evaluate(() => {
      const g = window.__CLASSROOM_APP__.gameplay;
      return g.bullet !== null || g.persistentTrails.length > 0;
    });
    if (!isBulletActive) throw new Error('Level 1 projectile failed to fire!');
    console.log('[PASS] Level 1 projectile dynamics verified.');

    // 7. Test Level 2 (Kepler Gravitational Slingshot)
    console.log('Testing Level 2 (Kepler Gravitational Slingshot)...');
    await page.evaluate(() => {
      window.__CLASSROOM_APP__.setLevel(2);
    });
    await page.waitForTimeout(300);

    const stateLvl2 = await page.evaluate(() => window.__CLASSROOM_APP__.state);
    if (stateLvl2 !== 'LEVEL_2_ORBITAL') throw new Error(`Expected LEVEL_2_ORBITAL, got ${stateLvl2}`);
    console.log('[PASS] Level 2 orbital state verified.');

    // 8. Test Level 3 (Schwarzschild Black Hole)
    console.log('Testing Level 3 (Schwarzschild Black Hole)...');
    await page.evaluate(() => {
      window.__CLASSROOM_APP__.setLevel(3);
    });
    await page.waitForTimeout(300);

    const stateLvl3 = await page.evaluate(() => window.__CLASSROOM_APP__.state);
    if (stateLvl3 !== 'LEVEL_3_BLACKHOLE') throw new Error(`Expected LEVEL_3_BLACKHOLE, got ${stateLvl3}`);
    console.log('[PASS] Level 3 black hole state verified.');

    // 9. Test Black Hole Singularity & Supernova Sequence
    console.log('Triggering Black Hole Singularity & Supernova sequence...');
    await page.evaluate(() => {
      // Simulate black hole capture
      window.__CLASSROOM_APP__.handleBlackHoleSingularity({ x: 1220, y: 520 });
    });

    const isSupernovaActive = await page.evaluate(() => {
      return window.__CLASSROOM_APP__.supernova.isActive();
    });
    if (!isSupernovaActive) throw new Error('Supernova sequence failed to activate!');
    console.log('[PASS] Singularity Implosion sequence started.');

    // Complete supernova and handover to eraser
    console.log('Simulating completion of Supernova and transition to Eraser...');
    await page.evaluate(() => {
      window.__CLASSROOM_APP__.handleSupernovaComplete();
    });
    await page.waitForTimeout(400);

    const isEraserActive = await page.evaluate(() => {
      return window.__CLASSROOM_APP__.eraser.isActive;
    });
    if (!isEraserActive) throw new Error('Eraser failed to activate after supernova!');
    console.log('[PASS] Felt Eraser wiping mode activated.');

    // 10. Test Eraser Wiping & Auto-Clean Completion
    console.log('Simulating board wiping to >= 80% completion...');
    await page.evaluate(() => {
      const eraser = window.__CLASSROOM_APP__.eraser;
      // Mark 85% of cells as cleaned
      eraser.cleanedCells = Math.floor(eraser.totalCells * 0.85);
      eraser.cleanedPercentage = 85;
      eraser.update(0.1);
      eraser.update(0.7); // Complete 0.6s auto-clean duration
    });
    await page.waitForTimeout(1000);

    // Verify Phase 2 modal appears
    const phase2Modal = await page.$('#phase2-modal');
    const isPhase2Visible = await page.evaluate(el => !el.classList.contains('hidden'), phase2Modal);
    if (!isPhase2Visible) throw new Error('Phase 2 readiness modal did not appear!');
    console.log('[PASS] Phase 2 readiness modal verified upon board cleaning.');

    // 11. Test Audio Mute Toggle
    console.log('Testing Audio Toggle button...');
    await page.evaluate(() => document.getElementById('audio-toggle-btn').click());
    await page.waitForTimeout(200);
    const isMuted = await page.evaluate(() => window.__CLASSROOM_APP__.isAudioMuted);
    if (!isMuted) throw new Error('Audio failed to mute on button click!');
    console.log('[PASS] Audio mute toggle verified.');

    // 12. Take Verification Screenshot
    try {
      await page.screenshot({ path: 'assets/e2e_verified_phase1.png', timeout: 3000 });
      console.log('[PASS] Verification screenshot captured at assets/e2e_verified_phase1.png');
    } catch (ssErr) {
      console.warn('[Screenshot Warning] Non-critical screenshot skip in headless mode:', ssErr.message);
      const dataUrl = await page.evaluate(() => {
        const c = document.getElementById('webgl-canvas');
        return c ? c.toDataURL('image/png') : null;
      });
      if (dataUrl) {
        fs.writeFileSync('assets/e2e_verified_phase1.png', Buffer.from(dataUrl.replace(/^data:image\/png;base64,/, ''), 'base64'));
        console.log('[PASS] WebGL canvas captured directly to assets/e2e_verified_phase1.png');
      }
    }

    // 13. Verify Zero Console Errors
    console.log(`Total console errors: ${consoleErrors.length}`);
    if (consoleErrors.length > 0) {
      throw new Error(`Browser console errors detected: ${JSON.stringify(consoleErrors)}`);
    }
    console.log('[PASS] ZERO console errors verified.');

  } finally {
    if (browser) await browser.close();
    server.close();
    console.log('[Server] Static server closed.');
  }

  console.log('================================================================');
  console.log('   ALL E2E BROWSER INTEGRATION TESTS PASSED WITH 100% SUCCESS!   ');
  console.log('================================================================');
}

runE2ETests().catch(err => {
  console.error('E2E TEST FAILED:', err);
  process.exit(1);
});
