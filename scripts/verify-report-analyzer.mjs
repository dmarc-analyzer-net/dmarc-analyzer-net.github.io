// Drive the shipped UI with Chromium, rather than emulating DOMParser in Node.
// Setup: npx playwright install --with-deps chromium
// Run against a local preview: node scripts/verify-report-analyzer.mjs http://localhost:4321
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const base = process.argv[2];
if (!base) throw new Error('Usage: node scripts/verify-report-analyzer.mjs <preview-url>');

// Synthetic input using the namespace and structure from RFC 9990 Appendix A:
// https://www.rfc-editor.org/rfc/rfc9990.html#appendix-A
const qualified = await readFile(new URL('./fixtures/aggregate-report-namespaced.xml', import.meta.url), 'utf8');
const unqualified = qualified.replace(' xmlns="urn:ietf:params:xml:ns:dmarc-2.0"', '');
// Prefix every element, keeping exactly the same expanded names and content.
const prefixed = qualified.replace(/<(\/?)([a-z_][\w.-]*)(?=[\s>])/g, '<$1d:$2')
  .replace('xmlns=', 'xmlns:d=');

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ locale: 'en-US', reducedMotion: 'reduce' });
  page.setDefaultTimeout(10_000);
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(new URL('/tools/dmarc-report-analyzer/', base).href);

  async function output() {
    await page.locator('#results').waitFor({ state: 'visible' });
    assert.equal(await page.locator('#errorMsg').isVisible(), false, 'No error should be shown');
    return page.locator('#results').evaluate((el) => ({
      summary: Array.from(el.firstElementChild.children, (box) => box.textContent),
      metadata: el.querySelector('p').textContent,
      rows: Array.from(el.querySelectorAll('tbody tr'), (row) =>
        Array.from(row.cells, (cell) => cell.textContent)),
    }));
  }

  const expected = {
    summary: ['Domainyourdomain.com', 'DMARC pass rate75%', 'Messages40', 'Sources2'],
    metadata: 'Reported by Example Reporter · policy p=quarantine · 2025-07-22 to 2025-07-23',
    rows: [
      ['203.0.113.10', '30', 'fail', 'pass', 'pass', 'pass'],
      ['192.0.2.77', '10', 'fail', 'fail', 'quarantine', 'fail'],
    ],
  };
  await page.locator('#fileInput').setInputFiles({
    name: 'aggregate-report.xml', mimeType: 'application/xml', buffer: Buffer.from(qualified),
  });
  // File reading is asynchronous; wait for the textarea to receive its contents.
  await page.waitForFunction((xml) => document.querySelector('#xmlInput').value === xml, qualified);
  assert.deepEqual(await output(), expected, 'namespaced XML upload');
  console.log('PASS: namespaced XML file upload');

  for (const [name, xml] of [['unqualified', unqualified], ['default namespace', qualified], ['prefixed namespace', prefixed]]) {
    await page.reload();
    await page.locator('#xmlInput').fill(xml);
    assert.equal(await page.locator('#xmlInput').inputValue(), xml);
    await page.locator('#analyzeBtn').click();
    assert.deepEqual(await output(), expected, name);
    console.log(`PASS: ${name} — metadata, dates, totals, sorting and every table cell`);
  }

  await page.locator('#xmlInput').fill('<feedback><record></feedback>');
  await page.locator('#analyzeBtn').click();
  await page.locator('#errorMsg').waitFor({ state: 'visible' });
  assert.equal(await page.locator('#results').isVisible(), false);

  await page.locator('#sampleBtn').click();
  const sample = await page.locator('#xmlInput').inputValue();
  assert.match(sample, /<feedback>/, 'Load sample must remain unqualified');
  assert.doesNotMatch(sample, /xmlns/);
  assert.deepEqual(await output(), {
    summary: ['Domainexample.com', 'DMARC pass rate98%', 'Messages915', 'Sources3'],
    metadata: 'Reported by google.com · policy p=none · 2025-07-22 to 2025-07-23',
    rows: [
      ['203.0.113.10', '842', 'pass', 'pass', 'none', 'pass'],
      ['198.51.100.24', '57', 'pass', 'fail', 'none', 'pass'],
      ['192.0.2.77', '16', 'fail', 'fail', 'none', 'fail'],
    ],
  }, 'Load sample after invalid input');
  console.log('PASS: invalid XML rejected; Load sample clears the error and renders unchanged');
  assert.deepEqual(errors, [], 'No uncaught browser errors');
} finally {
  await browser.close();
}
