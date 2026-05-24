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
      fullPage: options.fullPage ?? false,
      ...options 
    });
    console.log(`   ✅ Saved`);
  } catch (err) {
    console.log(`   ⚠️ Failed: ${err.message}`);
  }
}

async function safeClick(locator, name) {
  try {
    if (await locator.isVisible({ timeout: 3000 })) {
      console.log(`   🔘 Clicking: ${name}`);
      await locator.click({ timeout: 5000, force: true });
      await delay(1500);
      return true;
    }
  } catch (err) {
    console.log(`   ⚠️ Click failed for ${name}: ${err.message}`);
  }
  return false;
}

async function main() {
  console.log('🚀 Starting dialog capture...');
  console.log('📂 Output:', SCREENSHOTS_DIR);
  
  const browser = await chromium.launch({ 
    headless: false,
    slowMo: 400,
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
    console.log('Step 1: Login');
    console.log('========================================');
    
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await delay(2000);
    
    const emailInput = page.locator('input[id="login-email"]').first();
    const passwordInput = page.locator('input[id="login-password"]').first();
    
    if (await emailInput.isVisible({ timeout: 5000 })) {
      await emailInput.click();
      await emailInput.fill(LOGIN_EMAIL);
    }
    if (await passwordInput.isVisible({ timeout: 5000 })) {
      await passwordInput.click();
      await passwordInput.fill(LOGIN_PASSWORD);
    }
    
    const signInButton = page.locator('button', { hasText: 'Sign in' }).first();
    await signInButton.click();
    await delay(5000);
    
    console.log('📍 URL after login:', page.url());

    console.log('\n========================================');
    console.log('Step 2: Pipeline - Create Lead Dialog');
    console.log('========================================');
    
    await page.goto(APP_URL.replace(/\/$/, '') + '/pipeline', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await delay(3000);
    
    const newLeadBtn = page.locator('button:has-text("New Lead"), button:has-text("+ New Lead"), a:has-text("New Lead"), a:has-text("+ New Lead")').first();
    const addBtn = page.locator('button', { hasText: 'Add' }).first();
    const createBtn = page.locator('button', { hasText: 'Create' }).first();
    
    console.log('🔍 Looking for New Lead button...');
    if (await safeClick(newLeadBtn, 'New Lead')) {
      await captureScreenshot(page, '08-pipeline-create-lead.png');
      await page.keyboard.press('Escape');
      await delay(1000);
    } else {
      console.log('🔍 Trying generic Add/Create buttons...');
      await safeClick(addBtn, 'Add button');
      await safeClick(createBtn, 'Create button');
    }
    
    console.log('\n========================================');
    console.log('Step 3: Customers - Add/Edit Form');
    console.log('========================================');
    
    await page.goto(APP_URL.replace(/\/$/, '') + '/customers', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await delay(3000);
    
    const addCustomerBtn = page.locator('button:has-text("Add Customer"), button:has-text("+ Add"), a:has-text("Add Customer")').first();
    const editBtn = page.locator('button').filter({ hasText: /Edit|edit/ }).first();
    
    if (await safeClick(addCustomerBtn, 'Add Customer')) {
      await delay(1000);
      await captureScreenshot(page, '11-customers-edit.png');
      await page.keyboard.press('Escape');
      await delay(1000);
    } else if (await safeClick(editBtn, 'Edit button')) {
      await delay(1000);
      await captureScreenshot(page, '11-customers-edit.png');
    }

    console.log('\n========================================');
    console.log('Step 4: Products - Add Form');
    console.log('========================================');
    
    await page.goto(APP_URL.replace(/\/$/, '') + '/products', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await delay(3000);
    
    const addProductBtn = page.locator('button:has-text("Add Product"), button:has-text("+ Add"), a:has-text("Add Product")').first();
    
    if (await safeClick(addProductBtn, 'Add Product')) {
      await delay(1000);
      await captureScreenshot(page, '13-products-add.png');
      await page.keyboard.press('Escape');
    }

    console.log('\n========================================');
    console.log('Step 5: Inventory - Add Movement Dialog');
    console.log('========================================');
    
    await page.goto(APP_URL.replace(/\/$/, '') + '/inventory', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await delay(3000);
    
    const addMovementBtn = page.locator('button:has-text("Add Movement"), button:has-text("Movement")').first();
    
    if (await safeClick(addMovementBtn, 'Add Movement')) {
      await delay(1000);
      await captureScreenshot(page, '15-inventory-movement.png');
      await page.keyboard.press('Escape');
    }

    console.log('\n========================================');
    console.log('Step 6: Samples - Add Dispatch Dialog');
    console.log('========================================');
    
    await page.goto(APP_URL.replace(/\/$/, '') + '/samples', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await delay(3000);
    
    const addSampleBtn = page.locator('button:has-text("Add Sample"), button:has-text("Sample Dispatch")').first();
    
    if (await safeClick(addSampleBtn, 'Add Sample Dispatch')) {
      await delay(1000);
      await captureScreenshot(page, '17-samples-add.png');
      await page.keyboard.press('Escape');
    }

    console.log('\n========================================');
    console.log('Step 7: Inbox - Draft Panel');
    console.log('========================================');
    
    await page.goto(APP_URL.replace(/\/$/, '') + '/inbox', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await delay(3000);
    
    const draftReadyFilter = page.locator('a:has-text("Draft Ready"), a:has-text("Draft")').first();
    const generateReplyBtn = page.locator('button:has-text("Generate"), button:has-text("Reply")').first();
    
    console.log('🔍 Looking for a thread to open...');
    const threads = page.locator('a[href*="inbox?"]');
    const threadCount = await threads.count();
    console.log(`   Found ${threadCount} threads`);
    
    if (threadCount > 0) {
      await threads.first().click({ force: true });
      await delay(2500);
      
      const draftPanel = page.locator('text=Generate Reply, text=Draft, text=AI').first();
      if (await draftPanel.isVisible({ timeout: 2000 })) {
        await captureScreenshot(page, '06-inbox-draft-panel.png');
      } else {
        console.log('🔍 Looking for Generate Reply button...');
        const genBtn = page.locator('button').filter({ hasText: /Generate.*Reply|Draft.*Reply|Generate/i }).first();
        if (await safeClick(genBtn, 'Generate Reply')) {
          await delay(2500);
          await captureScreenshot(page, '06-inbox-draft-panel.png');
        } else {
          console.log('📸 Capturing current inbox thread view anyway...');
          await captureScreenshot(page, '06-inbox-draft-panel.png');
        }
      }
    }

    console.log('\n========================================');
    console.log('Summary');
    console.log('========================================');
    
    const files = fs.readdirSync(SCREENSHOTS_DIR);
    console.log(`\n📁 Total files: ${files.length}`);
    files.sort().forEach(f => {
      if (f.endsWith('.png') && !f.startsWith('error') && !f.startsWith('debug')) {
        console.log(`   ✅ ${f}`);
      }
    });

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    try {
      await captureScreenshot(page, 'dialog-error.png');
    } catch {}
  } finally {
    console.log('\n⏳ Keeping browser open for 5 seconds...');
    await delay(5000);
    await browser.close();
  }
}

main().catch(console.error);
