import puppeteer from 'puppeteer-core';

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const BASE_URL = 'http://localhost:5173';

const ROUTES = [
  { name: 'Today', path: '/' },
  { name: 'Insights', path: '/insights' },
  { name: 'Trends', path: '/trends' },
  { name: 'Nudges', path: '/nudges' },
  { name: 'Ask', path: '/ask' },
  { name: 'Privacy', path: '/privacy' },
  { name: 'Settings', path: '/settings' },
];

async function runTests() {
  console.log('=== Starting Browser QA Testing with Edge ===');
  
  let browser;
  try {
    browser = await puppeteer.launch({
      executablePath: EDGE_PATH,
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
    });
  } catch (err) {
    console.error('Failed to launch Edge:', err.message);
    process.exit(1);
  }

  const page = await browser.newPage();
  
  let totalErrors = 0;
  const pageResults = [];

  for (const route of ROUTES) {
    const url = `${BASE_URL}${route.path}`;
    console.log(`\nTesting ${route.name} (${url})...`);
    
    const errors = [];
    const warnings = [];

    const consoleHandler = (msg) => {
      const type = msg.type();
      const text = msg.text();
      if (type === 'error') {
        errors.push(text);
      } else if (type === 'warning') {
        warnings.push(text);
      }
    };

    const errorHandler = (err) => {
      errors.push(`PageError: ${err.message}`);
    };

    page.on('console', consoleHandler);
    page.on('pageerror', errorHandler);
    page.on('response', (res) => {
      if (res.status() >= 400) {
        errors.push(`HTTP ${res.status()} on ${res.url()}`);
      }
    });

    try {
      const response = await page.goto(url, { waitUntil: 'networkidle0', timeout: 10000 });
      const status = response ? response.status() : 'no-response';
      
      // Wait for any animations and initial data fetch
      await new Promise((r) => setTimeout(r, 1200));

      const title = await page.title();
      const bodyText = await page.evaluate(() => document.body.innerText.slice(0, 100).replace(/\n/g, ' '));
      const hasRootContent = await page.evaluate(() => {
        const root = document.getElementById('root');
        return root && root.children.length > 0 && root.innerHTML.trim().length > 0;
      });

      pageResults.push({
        name: route.name,
        path: route.path,
        status,
        title,
        hasRootContent,
        bodySnippet: bodyText,
        errors,
        warnings,
      });

      if (errors.length > 0) {
        console.log(`  ❌ Errors found (${errors.length}):`);
        errors.forEach((e) => console.log(`     - ${e}`));
        totalErrors += errors.length;
      } else {
        console.log(`  ✅ Rendered successfully! (Root non-empty: ${hasRootContent})`);
        console.log(`     Snippet: "${bodyText.slice(0, 60)}..."`);
      }

      if (warnings.length > 0) {
        console.log(`  ⚠️  Warnings (${warnings.length}):`);
        warnings.forEach((w) => console.log(`     - ${w}`));
      }
    } catch (err) {
      console.error(`  ❌ Failed to test ${route.name}:`, err.message);
      totalErrors++;
    } finally {
      page.off('console', consoleHandler);
      page.off('pageerror', errorHandler);
    }
  }

  await browser.close();

  console.log('\n================ SUMMARY ================');
  for (const res of pageResults) {
    console.log(`${res.name.padEnd(10)} [${res.hasRootContent ? 'RENDERED' : 'BLANK'}] Errors: ${res.errors.length}, Warnings: ${res.warnings.length}`);
  }
  console.log(`Total Errors Across All Pages: ${totalErrors}`);

  if (totalErrors > 0) {
    process.exit(1);
  } else {
    console.log('\n🎉 ALL 7 PAGES RENDERED CLEANLY WITH 0 ERRORS!');
  }
}

runTests();
