const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const APP_URL = 'https://whitepops-saathi.vercel.app/';
const LOGIN_EMAIL = 'pd@whitepops.com';
const LOGIN_PASSWORD = 'c2ce9c5a-cdeAa1!';
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
    console.log(`   ✅ Saved to ${filePath}`);
  } catch (err) {
    console.log(`   ⚠️ Failed: ${err.message}`);
  }
}

async function main() {
  console.log('🚀 Final dialog capture...');
  
  const browser = await chromium.launch({ 
    headless: false,
    slowMo: 500,
    args: ['--start-maximized']
  });
  
  const context = await browser.newContext({
    viewport: { width: 1680, height: 1050 },
    locale: 'en-US',
    timezoneId: 'Asia/Kolkata'
  });
  
  const page = await context.newPage();

  try {
    console.log('\n--- Login ---');
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
    console.log('Step 1: Pipeline - "Add deal" Dialog');
    console.log('========================================');
    
    await page.goto(APP_URL.replace(/\/$/, '') + '/pipeline', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await delay(3000);
    
    const addDealBtn = page.locator('button:has-text("Add deal")').first();
    console.log('🔍 Looking for "Add deal" button...');
    
    if (await addDealBtn.isVisible({ timeout: 3000 })) {
      console.log('   🔘 Clicking "Add deal"...');
      await addDealBtn.click();
      await delay(2000);
      
      await captureScreenshot(page, '08-pipeline-create-lead.png');
      
      console.log('   Closing the sheet...');
      const cancelBtn = page.locator('button:has-text("Cancel")').first();
      if (await cancelBtn.isVisible({ timeout: 2000 })) {
        await cancelBtn.click();
      } else {
        await page.keyboard.press('Escape');
      }
      await delay(1000);
    } else {
      console.log('   ❌ "Add deal" button not found');
    }

    console.log('\n========================================');
    console.log('Step 2: Products - Add Product Form');
    console.log('========================================');
    
    await page.goto(APP_URL.replace(/\/$/, '') + '/products', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await delay(3000);
    
    const addProductVariants = [
      'button:has-text("Add product")',
      'button:has-text("Add Product")',
      'button:has-text("+ Add")',
      'a:has-text("Add product")',
      'a:has-text("Add Product")'
    ];
    
    let productButtonClicked = false;
    for (const selector of addProductVariants) {
      const btn = page.locator(selector).first();
      if (await btn.isVisible({ timeout: 1000 })) {
        console.log(`   🔘 Clicking product button via: ${selector}`);
        await btn.click();
        await delay(1500);
        await captureScreenshot(page, '13-products-add.png');
        productButtonClicked = true;
        break;
      }
    }
    
    if (!productButtonClicked) {
      console.log('   📸 Capturing products page for context...');
      await captureScreenshot(page, '13-products-add.png');
    }

    console.log('\n========================================');
    console.log('Summary');
    console.log('========================================');
    
    const files = fs.readdirSync(SCREENSHOTS_DIR);
    const pngFiles = files.filter(f => f.endsWith('.png') && !f.startsWith('error') && !f.startsWith('debug'));
    console.log(`\n📁 Total screenshots: ${pngFiles.length}`);
    pngFiles.sort().forEach(f => console.log(`   ✅ ${f}`));

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    console.log('\n⏳ Keeping browser open for 5 seconds...');
    await delay(5000);
    await browser.close();
  }
}

main().catch(console.error);
