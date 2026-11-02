// Restore archive media URLs without reserializing translated HTML or text.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');
const root = path.resolve(__dirname, '../../..');
const out = path.resolve(__dirname, '../uhc-zh-en');
const story = JSON.parse(fs.readFileSync(path.join(root, 'unofficial-homestuck-collection/Asset_Pack/archive/data/mspa.json'))).story;
const file = path.join(out, 'translations.json');
const data = JSON.parse(fs.readFileSync(file));
const document = new JSDOM('').window.document;
const media = u => /\.(?:gif|png|jpe?g|webp|mp4|webm|swf|mp3)(?:[?!#]|$)/i.test(u);
const candidate = u => media(u) || /tinyurl\.com\/|docs\.google\.com\/uc/i.test(u);
function elements(content, selector) {
  document.body.innerHTML = content || '';
  return [...document.querySelectorAll(selector)].map(e => ({url: e.getAttribute(e.tagName === 'A' ? 'href' : 'src'), text: e.textContent}));
}
function text(content) { document.body.innerHTML = content; return document.body.textContent; }
const archiveImages = new Map();
for (const page of Object.values(story)) {
  for (const image of elements(page.content, 'img[src]')) archiveImages.set(image.url.split('/').pop(), image.url);
}
const changes = [];
for (const [id, entry] of Object.entries(data.pages)) {
  if (!entry.content) continue;
  const before = entry.content;
  const original = story[id].content;
  const originals = elements(original, 'a[href]');
  const translated = elements(before, 'a[href]');
  const a = originals.filter(e => media(e.url));
  const b = translated.filter(e => candidate(e.url));
  const replacements = new Map();
  if (a.length === b.length) b.forEach((e, i) => replacements.set(e.url, a[i].url));
  // Visible URL labels also identify media links among many unrelated links.
  for (const e of translated) {
    const match = originals.find(o => o.text.trim() === e.text.trim() && media(o.url));
    if (match) replacements.set(e.url, match.url);
  }
  const imgs = elements(original, 'img[src]');
  const translatedImgs = elements(before, 'img[src]');
  let index = 0;
  entry.content = before.replace(/<(a|img)\b[^>]*>/gi, tag => {
    const isImage = /^<img\b/i.test(tag);
    const attr = isImage ? 'src' : 'href';
    const re = new RegExp('\\b' + attr + '\\s*=\\s*(["\'])(.*?)\\1', 'i');
    const m = tag.match(re);
    if (!m) return tag;
    document.body.innerHTML = tag;
    const url = document.body.firstElementChild.getAttribute(attr);
    let target;
    if (isImage) {
      const i = index++;
      const basename = u => u.split('/').pop().replace(/[?#].*$/, '');
      const same = imgs.find(e => basename(e.url) === basename(url));
      target = same ? same.url : imgs.length === translatedImgs.length ? imgs[i].url : undefined;
      if (!target) {
        // A translated walkthrough can embed the image that was originally a link.
        const linked = a.find(e => basename(e.url) === basename(url).replace(/_ct(?=\.)/, ''));
        if (linked) target = linked.url;
        else if (archiveImages.has(basename(url))) target = archiveImages.get(basename(url));
        else {
          changes.push({id, from: url, to: null, reason: 'extra translation image; original page media remains rendered by UHC'});
          return '';
        }
      }
    } else target = replacements.get(url);
    if (!target || target === url) return tag;
    changes.push({id, from: url, to: target});
    return tag.replace(re, (_, quote) => attr + '=' + quote + target.replace(/&/g, '&amp;').replace(/"/g, '&quot;') + quote);
  });
  assert.equal(text(entry.content), text(before), 'Translated text changed: ' + id);
}
fs.writeFileSync(file, JSON.stringify(data) + '\n');
fs.writeFileSync(path.join(out, 'media-url-report.json'), JSON.stringify(changes, null, 2) + '\n');
console.log(`Restored media: ${changes.length} changes on ${new Set(changes.map(e => e.id)).size} pages; translated text verified unchanged.`);
