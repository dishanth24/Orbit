import puppeteer from 'puppeteer-core'

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'

const routes = [
  '/',
  '/insights',
  '/trends',
  '/nudges',
  '/ask',
  '/privacy',
  '/settings',
]

async function run() {
  console.log('Launching browser with Edge...')
  const browser = await puppeteer.launch({
    executablePath: EDGE_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  })

  const page = await browser.newPage()
  const errors = []

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      errors.push(`Console error on ${page.url()}: ${msg.text()}`)
    }
  })

  page.on('pageerror', (err) => {
    errors.push(`Page error on ${page.url()}: ${err.message}`)
  })

  console.log('--- Testing Desktop (1280x800) ---')
  await page.setViewport({ width: 1280, height: 800 })

  for (const route of routes) {
    const url = `http://localhost:5173${route}`
    console.log(`Navigating to ${url}...`)
    await page.goto(url, { waitUntil: 'networkidle0', timeout: 15000 })
    await new Promise((r) => setTimeout(r, 800))
    const title = await page.title()
    console.log(`  Loaded: "${title}"`)
  }

  console.log('--- Testing Mobile (390x844 - iPhone) ---')
  await page.setViewport({ width: 390, height: 844, isMobile: true })

  for (const route of routes) {
    const url = `http://localhost:5173${route}`
    console.log(`Navigating to ${url} (mobile)...`)
    await page.goto(url, { waitUntil: 'networkidle0', timeout: 15000 })
    await new Promise((r) => setTimeout(r, 600))
    // Verify no horizontal overflow
    const overflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > window.innerWidth
    })
    console.log(`  Horizontal overflow: ${overflow ? 'YES (BAD)' : 'NO (GOOD)'}`)
    if (overflow) {
      errors.push(`Horizontal overflow detected on ${route} at 390px viewport`)
    }
  }

  await browser.close()

  console.log('=============================')
  if (errors.length === 0) {
    console.log('ALL ROUTES PASSED WITH ZERO CONSOLE ERRORS AND ZERO OVERFLOW!')
  } else {
    console.error(`Found ${errors.length} error(s):`)
    errors.forEach((e) => console.error(' -', e))
    process.exit(1)
  }
}

run().catch((e) => {
  console.error('Test run failed:', e)
  process.exit(1)
})
