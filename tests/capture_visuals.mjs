import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

async function capture() {
  console.log('Connecting to http://localhost:3000 ...');
  const browser = await chromium.launch({
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

  const page = await browser.newPage({
    viewport: { width: 1280, height: 720 }
  });

  const consoleLogs = [];
  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
    else consoleLogs.push(msg.text());
  });

  await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded' });

  // Wait until app is ready
  console.log('Waiting for app ready...');
  await page.waitForFunction(() => window.__CLASSROOM_APP__ && window.__CLASSROOM_APP__.gameplay, { timeout: 20000 });
  await page.waitForTimeout(1000);

  // Helper to extract canvas as buffer
  async function saveCanvas(canvasSelector, filePath) {
    const dataUrl = await page.evaluate((sel) => {
      const c = document.querySelector(sel);
      return c ? c.toDataURL('image/png') : null;
    }, canvasSelector);
    if (dataUrl) {
      const base64 = dataUrl.replace(/^data:image\/png;base64,/, '');
      fs.writeFileSync(filePath, Buffer.from(base64, 'base64'));
      console.log(`Saved canvas ${canvasSelector} to ${filePath}`);
    }
  }

  // Level 1 Visual Check
  console.log('Inspecting Level 1...');
  await page.evaluate(() => {
    window.__CLASSROOM_APP__.setLevel(1);
  });
  await page.waitForTimeout(500);

  // Capture board canvas directly
  const boardL1DataUrl = await page.evaluate(() => {
    return window.__CLASSROOM_APP__.boardApi.boardCanvas.toDataURL('image/png');
  });
  fs.writeFileSync(path.join(rootDir, 'assets/board_l1.png'), Buffer.from(boardL1DataUrl.replace(/^data:image\/png;base64,/, ''), 'base64'));
  await saveCanvas('#webgl-canvas', path.join(rootDir, 'assets/webgl_l1.png'));

  // Level 2 Visual Check
  console.log('Inspecting Level 2...');
  await page.evaluate(() => {
    window.__CLASSROOM_APP__.setLevel(2);
  });
  await page.waitForTimeout(500);

  const boardL2DataUrl = await page.evaluate(() => {
    return window.__CLASSROOM_APP__.boardApi.boardCanvas.toDataURL('image/png');
  });
  fs.writeFileSync(path.join(rootDir, 'assets/board_l2.png'), Buffer.from(boardL2DataUrl.replace(/^data:image\/png;base64,/, ''), 'base64'));
  await saveCanvas('#webgl-canvas', path.join(rootDir, 'assets/webgl_l2.png'));

  // Level 3 Visual Check
  console.log('Inspecting Level 3...');
  await page.evaluate(() => {
    window.__CLASSROOM_APP__.setLevel(3);
  });
  await page.waitForTimeout(500);

  const boardL3DataUrl = await page.evaluate(() => {
    return window.__CLASSROOM_APP__.boardApi.boardCanvas.toDataURL('image/png');
  });
  fs.writeFileSync(path.join(rootDir, 'assets/board_l3.png'), Buffer.from(boardL3DataUrl.replace(/^data:image\/png;base64,/, ''), 'base64'));
  await saveCanvas('#webgl-canvas', path.join(rootDir, 'assets/webgl_l3.png'));

  // Check Gunny trajectory prediction state
  const trajectoryPointsCount = await page.evaluate(() => {
    const gameplay = window.__CLASSROOM_APP__.gameplay;
    const pts = gameplay.calculateTrajectoryPrediction(gameplay.angleDeg, gameplay.v0, 50);
    return pts ? pts.length : 0;
  });
  console.log(`Gunny trajectory prediction points: ${trajectoryPointsCount}`);

  console.log(`Console errors count: ${consoleErrors.length}`);
  if (consoleErrors.length > 0) {
    console.error('Console errors:', consoleErrors);
  }

  await browser.close();
  console.log('Visual inspection finished successfully.');
}

capture().catch(err => {
  console.error('Capture failed:', err);
  process.exit(1);
});
