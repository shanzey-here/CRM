import { chromium } from 'playwright';
import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

async function runTest() {
  console.log('Starting Next.js production server...');
  const server = spawn('npm', ['start'], { stdio: 'pipe', shell: true });
  
  await new Promise((resolve) => {
    server.stdout.on('data', (data) => {
      const output = data.toString();
      if (output.includes('Ready in') || output.includes('started server on') || output.includes('ready in')) {
        resolve(true);
      }
    });
  });
  
  console.log('Server is ready. Launching browser...');
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  page.on('console', msg => console.log('BROWSER:', msg.text()));
  page.on('pageerror', err => console.error('BROWSER ERROR:', err.message));
  page.on('requestfailed', request => console.error('FAILED REQ:', request.url(), request.failure()?.errorText));

  console.log('Loading /crew/test (public offline test page)...');
  await page.goto('http://localhost:3000/crew/test');
  console.log('Current URL after load:', page.url());
  
  console.log('Testing IndexedDB read/write...');
  await page.fill('input[placeholder="Enter a value to save..."]', 'Offline Storage Test Data', { timeout: 10000 });
  await page.click('button:has-text("Save Data")');
  
  await page.waitForFunction(() => document.body.innerText.includes('Saved to IndexedDB successfully!'));

  // Give the SW a moment to register and install
  await new Promise(r => setTimeout(r, 2000));

  console.log('Checking Service Worker Registration...');
  const isRegistered = await page.evaluate(async () => {
    try {
      const reg = await navigator.serviceWorker.getRegistration('/crew/');
      if (reg) {
        console.log('SW Registration found:', reg.scope);
        return true;
      }
      return false;
    } catch (e) {
      console.error('Error getting registration', e);
      return false;
    }
  });

  console.log('Service worker registered?', isRegistered);

  if (isRegistered) {
    console.log('Reloading page ONLINE to populate SW cache...');
    await page.reload({ waitUntil: 'domcontentloaded' });
    await new Promise(r => setTimeout(r, 2000)); // wait for network first cache to store the page

    console.log('Going Offline...');
    await context.setOffline(true);
    
    console.log('Reloading page in Offline Mode...');
    await page.reload({ waitUntil: 'domcontentloaded' }).catch(e => console.log('Reload failed:', e.message));
    
    const offlineIndicatorVisible = await page.evaluate(() => document.body.innerText.includes('You are currently offline.')).catch(() => false);
    console.log('Offline indicator visible?', offlineIndicatorVisible);
    
    const dataSurvived = await page.evaluate(() => document.body.innerText.includes('Offline Storage Test Data')).catch(() => false);
    console.log('Data survived in IndexedDB?', dataSurvived);

    if (!fs.existsSync('scripts/screenshots')) {
      fs.mkdirSync('scripts/screenshots', { recursive: true });
    }
    await page.screenshot({ path: 'scripts/screenshots/crew-offline.png' });
    console.log('Saved screenshot to scripts/screenshots/crew-offline.png');
  }
  
  await context.close();
  await browser.close();
  server.kill();
  console.log('Test completed.');
  process.exit(isRegistered ? 0 : 1);
}

runTest().catch(e => {
  console.error(e);
  process.exit(1);
});
