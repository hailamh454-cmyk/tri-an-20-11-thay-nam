import { chromium } from 'playwright';

async function run() {
  const browser = await chromium.launch({
    headless: true,
    executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
  });
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await context.newPage();

  const consoleLogs = [];
  const consoleErrors = [];

  page.on('console', msg => {
    const text = msg.text();
    const type = msg.type();
    consoleLogs.push({ type, text });
    if (type === 'error') {
      consoleErrors.push(text);
    }
  });

  page.on('pageerror', err => {
    consoleErrors.push(err.toString());
  });

  console.log('Navigating to http://localhost:3000/...');
  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle' });

  // Wait for loading screen to completely hide
  try {
    await page.waitForFunction(() => {
      const el = document.getElementById('loading-screen');
      return !el || window.getComputedStyle(el).display === 'none';
    }, { timeout: 12000 });
  } catch {
    await page.waitForTimeout(4000);
  }
  await page.waitForTimeout(500);

  // Check elements at (400, 400)
  const elementsAt400 = await page.evaluate(() => {
    const els = document.elementsFromPoint(400, 400);
    return els.map(el => ({
      tagName: el.tagName,
      id: el.id,
      className: el.className,
      rect: {
        top: el.getBoundingClientRect().top,
        left: el.getBoundingClientRect().left,
        width: el.getBoundingClientRect().width,
        height: el.getBoundingClientRect().height
      }
    }));
  });

  console.log('Elements at (400, 400):', JSON.stringify(elementsAt400, null, 2));
  console.log('Total console errors:', consoleErrors.length);
  if (consoleErrors.length > 0) {
    console.log('Errors:', consoleErrors);
  }

  // Also check loading screen visibility
  const loadingScreenStyle = await page.evaluate(() => {
    const ls = document.getElementById('loading-screen');
    if (!ls) return null;
    const computed = window.getComputedStyle(ls);
    return {
      display: computed.display,
      opacity: computed.opacity,
      visibility: computed.visibility,
      pointerEvents: computed.pointerEvents
    };
  });
  console.log('Loading screen computed style:', loadingScreenStyle);

  // Take screenshot
  await page.screenshot({ path: 'assets/verify_cinematic.png' });
  console.log('Screenshot saved to assets/verify_cinematic.png');

  await browser.close();
}

run().catch(err => {
  console.error('Test run failed:', err);
  process.exit(1);
});
