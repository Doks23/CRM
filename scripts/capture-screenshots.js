const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const APP_URL = process.env.SCREENSHOT_APP_URL || 'http://localhost:3000';
const LOGIN_EMAIL = process.env.SCREENSHOT_EMAIL || '';
const LOGIN_PASSWORD = process.env.SCREENSHOT_PASSWORD || '';
const SCREENSHOTS_DIR = path.join(__dirname, '..', 'docs', 'screenshots');

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function captureScreenshot(page, name, options = {}) {
  const filePath = path.join(SCREENSHOTS_DIR, name);
  console.log(`📸 Capturing: ${name}`);
  try {
    await page.screenshot({ 
      path: filePath, 
      fullPage: options.fullPage ?? true,
      ...options 
    });
    console.log(`   ✅ Saved to ${filePath}`);
  } catch (err) {
    console.log(`   ⚠️ Failed: ${err.message}`);
  }
}

async function main() {
  console.log('🚀 Starting screenshot capture...');
  console.log('📍 App URL:', APP_URL);
  console.log('📂 Output directory:', SCREENSHOTS_DIR);
  
  if (!fs.existsSync(SCREENSHOTS_DIR)) {
    fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
  }

  console.log('🔧 Launching browser (windowed mode)...');
  const browser = await chromium.launch({ 
    headless: false,
    slowMo: 300,
    args: ['--start-maximized']
  });
  
  const context = await browser.newContext({
    viewport: { width: 1680, height: 1050 },
    locale: 'en-US',
    timezoneId: 'Asia/Kolkata'
  });
  
  const page = await context.newPage();

  try {
    console.log('\n========================================');
    console.log('Step 1: Login Page');
    console.log('========================================');
    
    console.log('🌐 Navigating to login page...');
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await delay(2000);
    
    console.log('📸 01-login.png');
    await captureScreenshot(page, '01-login.png');

    console.log('\n========================================');
    console.log('Step 2: Login Attempt');
    console.log('========================================');
    
    const emailInput = page.locator('input[id="login-email"]').first();
    const passwordInput = page.locator('input[id="login-password"]').first();
    
    console.log('📝 Filling email...');
    if (await emailInput.isVisible({ timeout: 5000 })) {
      await emailInput.click();
      await emailInput.fill(LOGIN_EMAIL);
    }
    
    console.log('📝 Filling password...');
    if (await passwordInput.isVisible({ timeout: 5000 })) {
      await passwordInput.click();
      await passwordInput.fill(LOGIN_PASSWORD);
    }
    
    console.log('🔘 Clicking "Sign in" button...');
    const signInButton = page.locator('button', { hasText: 'Sign in' }).first();
    
    try {
      await Promise.all([
        page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 30000 }).catch(e => console.log('   Navigation event:', e.message)),
        signInButton.click()
      ]);
    } catch (err) {
      console.log('   WaitForNavigation caught (expected for SPA):', err.message);
    }
    
    await delay(5000);
    
    const currentUrl = page.url();
    console.log('📍 Current URL after click:', currentUrl);
    
    if (currentUrl.includes('login')) {
      console.log('⚠️ Still on login page, checking for errors...');
      await captureScreenshot(page, 'debug-after-login-attempt.png');
      
      const pageContent = await page.content();
      if (pageContent.includes('Invalid') || pageContent.includes('deactivated') || pageContent.includes('error')) {
        console.log('❌ Login error visible on page');
      }
    }

    console.log('\n========================================');
    console.log('Step 3: Navigate to all pages');
    console.log('========================================');
    
    const pagesToCapture = [
      { name: 'dashboard', url: '/dashboard', file: '03-dashboard.png' },
      { name: 'inbox', url: '/inbox', file: '04-inbox-overview.png' },
      { name: 'pipeline', url: '/pipeline', file: '07-pipeline.png' },
      { name: 'customers', url: '/customers', file: '10-customers.png' },
      { name: 'products', url: '/products', file: '12-products.png' },
      { name: 'inventory', url: '/inventory', file: '14-inventory.png' },
      { name: 'samples', url: '/samples', file: '16-samples.png' },
      { name: 'reports', url: '/reports', file: '18-reports.png' },
      { name: 'employees', url: '/employees', file: '21-employees.png' },
      { name: 'settings', url: '/settings', file: '22-settings.png' },
    ];

    for (const p of pagesToCapture) {
      console.log(`\n--- ${p.name.toUpperCase()} ---`);
      try {
        const fullUrl = APP_URL.replace(/\/$/, '') + p.url;
        console.log('🌐 Navigating to:', fullUrl);
        await page.goto(fullUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
        await delay(3000);
        
        const urlAfterNav = page.url();
        console.log('📍 URL after nav:', urlAfterNav);
        
        if (urlAfterNav.includes('login')) {
          console.log('⚠️ Redirected to login - need to check auth');
          await captureScreenshot(page, `debug-${p.name}-login-redirect.png`);
          continue;
        }
        
        await captureScreenshot(page, p.file);
      } catch (err) {
        console.log(`❌ Failed: ${err.message}`);
        try {
          await captureScreenshot(page, `error-${p.name}.png`);
        } catch {}
      }
    }

    try {
      console.log('\n--- INBOX DETAIL (for sidebar) ---');
      await page.goto(APP_URL.replace(/\/$/, '') + '/inbox', { waitUntil: 'domcontentloaded', timeout: 60000 });
      await delay(3000);
      
      if (!page.url().includes('login')) {
        console.log('📸 02-navigation.png (sidebar)');
        await captureScreenshot(page, '02-navigation.png', { fullPage: false });
        
        console.log('🔍 Looking for first thread...');
        const threads = page.locator('a[href*="inbox?"]');
        const count = await threads.count();
        console.log(`   Found ${count} thread links`);
        
        if (count > 0) {
          console.log('📧 Clicking first thread for thread view...');
          const firstThread = threads.first();
          await firstThread.click({ timeout: 10000, force: true });
          await delay(2500);
          await captureScreenshot(page, '05-inbox-thread.png');
        }
      }
    } catch (err) {
      console.log('❌ Inbox detail failed:', err.message);
    }

    try {
      console.log('\n--- SETTINGS SUB-PAGES ---');
      
      console.log('📝 Settings -> Profile...');
      await page.goto(APP_URL.replace(/\/$/, '') + '/settings/profile', { waitUntil: 'domcontentloaded', timeout: 60000 });
      await delay(2500);
      if (!page.url().includes('login')) {
        await captureScreenshot(page, '23-settings-profile.png');
      }
      
      console.log('📝 Settings -> Gmail...');
      await page.goto(APP_URL.replace(/\/$/, '') + '/settings/gmail', { waitUntil: 'domcontentloaded', timeout: 60000 });
      await delay(2500);
      if (!page.url().includes('login')) {
        await captureScreenshot(page, '24-settings-gmail.png');
      }
      
      console.log('📝 Settings -> Team...');
      await page.goto(APP_URL.replace(/\/$/, '') + '/settings/team', { waitUntil: 'domcontentloaded', timeout: 60000 });
      await delay(2500);
      if (!page.url().includes('login')) {
        await captureScreenshot(page, 'settings-team.png');
      }
    } catch (err) {
      console.log('❌ Settings sub-pages failed:', err.message);
    }

    try {
      console.log('\n--- REPORTS SCROLL SECTIONS ---');
      await page.goto(APP_URL.replace(/\/$/, '') + '/reports', { waitUntil: 'domcontentloaded', timeout: 60000 });
      await delay(3000);
      
      if (!page.url().includes('login')) {
        console.log('📜 Scrolling for funnel...');
        await page.evaluate(() => window.scrollBy(0, 400));
        await delay(1000);
        await captureScreenshot(page, '19-reports-funnel.png', { fullPage: false });
        
        console.log('📜 Scrolling for leaderboard...');
        await page.evaluate(() => window.scrollBy(0, 500));
        await delay(1000);
        await captureScreenshot(page, '20-reports-leaderboard.png', { fullPage: false });
      }
    } catch (err) {
      console.log('❌ Reports scroll failed:', err.message);
    }

    console.log('\n========================================');
    console.log('Summary');
    console.log('========================================');
    
    const files = fs.readdirSync(SCREENSHOTS_DIR);
    console.log(`\n📁 Total files in screenshots folder: ${files.length}`);
    files.sort().forEach(f => console.log(`   - ${f}`));

  } catch (error) {
    console.error('\n❌ FATAL Error:', error.message);
    console.error('Stack:', error.stack);
    try {
      await captureScreenshot(page, 'error-final-state.png');
    } catch {}
  } finally {
    console.log('\n⏳ Keeping browser open for 10 seconds so you can see...');
    await delay(10000);
    await browser.close();
    console.log('✅ Browser closed.');
  }
}

main().catch(console.error);
