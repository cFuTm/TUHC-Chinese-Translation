// UHC 2.8.1 ships Sass.js 0.11.1 / LibSass 3.6.2, rather than a CSS-only parser.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Sass = require('sass.js/dist/sass.sync.js');
const { JSDOM } = require('jsdom');
const folder = path.resolve(__dirname, '../uhc-zh-en');
const mod = require(path.join(folder, 'mod.js'));
const compile = body => new Promise(resolve => Sass.compile(body, resolve));

async function main() {
  assert.equal(mod.version, mod.modVersion, 'UHC stylesheet cache must be invalidated for this release');
  const original = await compile('.animation03229{height:30px!;font-size:24px}');
  assert.notEqual(original.status, 0, 'Regression fixture must reproduce the original Sass failure');
  const results = [];
  for (const style of mod.styles) {
    const result = await compile(fs.readFileSync(path.join(folder, style.source), 'utf8'));
    results.push({ source: style.source, status: result.status });
    if (result.status) throw new Error(style.source + '\n' + result.formatted);
  }
  const pages = JSON.parse(fs.readFileSync(path.join(folder, 'translations.json'), 'utf8')).pages;
  const dom = new JSDOM();
  const decoder = dom.window.document.createElement('textarea');
  const unique = new Set();
  for (const page of Object.values(pages)) {
    for (const match of (page.content || '').matchAll(/\bstyle="([^"]*)"/g)) {
      decoder.innerHTML = match[1];
      unique.add(decoder.value);
    }
  }
  const inline = await compile(Array.from(unique, (value, i) => '.inline-' + i + '{' + value + '}').join('\n'));
  if (inline.status) throw new Error('Inline formatting\n' + inline.formatted);
  dom.window.close();
  const report = { compiler: 'Sass.js 0.11.1 / LibSass 3.6.2',
    originalErrorReproduced: true, stylesheets: results, inlineDeclarations: unique.size, status: 'passed' };
  fs.writeFileSync(path.join(__dirname, 'css-test-report.json'), JSON.stringify(report, null, 2) + '\n');
  console.log('PASS: original failure reproduced; all mod stylesheets and ' + unique.size + ' distinct inline styles compile with the UHC Sass compiler version.');
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
