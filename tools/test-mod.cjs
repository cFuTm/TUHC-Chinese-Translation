const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { JSDOM } = require('jsdom');
const dom = new JSDOM('<!doctype html><html><body><div id="mount"></div></body></html>', {
  pretendToBeVisual: true, url: 'http://uhc.test/'
});
global.window = dom.window;
global.document = dom.window.document;
global.navigator = dom.window.navigator;
global.Option = dom.window.Option;
global.getComputedStyle = dom.window.getComputedStyle;
const Vue = require('vue');
Vue.config.productionTip = false;
Vue.config.devtools = false;
const warnings = [];
Vue.config.errorHandler = error => { throw error; };
Vue.config.warnHandler = warning => warnings.push(warning);
const { sourceWith, component } = require('./uhc-source.cjs');
const modRoot = path.resolve(__dirname, '../uhc-zh-en');
const mod = require(path.join(modRoot, 'mod.js'));
const dictionary = JSON.parse(fs.readFileSync(path.join(modRoot, 'translations.json'))).pages;
const values = new Map();
const api = { store: { get: (k, d) => values.has(k) ? values.get(k) : d, set: (k, v) => values.set(k, v) },
  readJson: p => JSON.parse(fs.readFileSync(path.join(modRoot, p))) };
mod.computed(api);
const formattedStyle = document.createElement('style');
formattedStyle.textContent = fs.readFileSync(path.join(modRoot, 'formatted.css'), 'utf8');
document.head.appendChild(formattedStyle);
const archive = JSON.parse(fs.readFileSync(path.resolve(__dirname,
  '../../../unofficial-homestuck-collection/Asset_Pack/archive/data/mspa.json')));
const originalStory = JSON.stringify(archive.story);
archive.audioData = {};
archive.tweaks = {};
const localData = Vue.observable({ settings: {
  textOverride: { fontSize: 0, lineHeight: 1 }, reducedMotion: false, openLogs: false,
  pixelScaling: false, devMode: false
}, temp: { visited: [] }, allHistory: [] });
Object.assign(Vue.prototype, {
  $archive: { mspa: archive, audioData: {}, tweaks: {} }, $localData: localData,
  $isVizBase: base => base === 'homestuck',
  $vizToMspa: (_, n) => ({ p: String(Number(n) + 1900).padStart(6, '0') }),
  $getStoryNum: () => 6, $shouldRetcon: () => true,
  $getResourceURL: value => value, $filterURL: value => value,
  $isWebApp: true, $logger: { info() {}, warn() {}, error() {} },
  $resolvePath: value => '/' + value,
  $mspaToViz: id => ({ s: 'homestuck', p: Number(id) - 1900 })
});
const Dummy = { render(h) { return h('span'); } };
let mediaMounts = 0;
const Media = { props: ['url'], mounted() { mediaMounts++; }, render(h) { return h('img', { attrs: { src: this.url } }); } };
const Color = class { getLightness() { return 1; } };
const text = component('PageTextvue_type_script_lang_js_', {
  Color, ipcRenderer: {}, getComputedStyle: global.getComputedStyle, document
});
const nav = component('PageNavvue_type_script_lang_js_', {
  __webpack_require__: () => ({ DateTime: { fromSeconds: () => ({ setZone: () => ({ toFormat: () => 'date' }) }) } }),
  Option: dom.window.Option
});
const page = component('Pagevue_type_script_lang_js_', {
  NavBanner: { default: Dummy }, PageBanner: { default: Dummy }, MediaEmbed: { default: Media },
  PageText: { default: text }, PageNav: { default: nav }, PageFooter: { default: Dummy },
  Firefly: Dummy, FlashCredit: { default: Dummy }, PageFootnotes: { a: Dummy }, PageMetadata: { default: Dummy }
});
const code = sourceWith('async function getMixinsAsync()');
const start = code.indexOf('async function getMixinsAsync()');
const end = code.indexOf('function jsToChoice', start);
const getMixins = vm.runInNewContext(code.slice(start, end) + ';getMixinsAsync', {
  getEnabledModsJsAsync: async () => [Object.assign({ _id: 'uhc-zh-en' }, mod)],
  flag_failures_dont_interrupt: false, console
});

async function main() {
  const mixins = await getMixins();
  mixins.forEach(m => Vue.mixin(m));
  const Address = {
    name: 'addressBar', data: () => ({ browserActions: {} }),
    created() { Object.assign(this.$options.components, this.browserActions); },
    computed: { thisTabPageId() { return String(Number(this.$root.params.p) + (this.$root.params.base === 'homestuck' ? 1900 : 0)).padStart(6, '0'); } },
    render(h) { return h('div', { attrs: { id: 'browserActions' } }, Object.keys(this.browserActions).map(k => h(k))); }
  };
  const mountApp = () => new Vue({
    data: () => ({ params: { base: 'mspa', p: '001904' }, tabTheme: { rendered: 'default' } }),
    render(h) { return h('div', { attrs: { id: 'app' } }, [h(Address), h('div', { class: 'tabFrame' }, [h(page, { ref: 'page', props: { tab: {}, routeParams: this.params } })])]); }
  }).$mount(document.body.appendChild(document.createElement('div')));
  const app = mountApp();
  const tick = () => new Promise(resolve => Vue.nextTick(() => Vue.nextTick(resolve)));
  const click = async () => { app.$el.querySelector('button.uhc-zh-en-button').click(); await tick(); };
  const current = () => app.$refs.page.$refs.textContent;
  assert.match(app.$el.textContent, /你的名字/);
  assert.equal(app.$el.querySelector('h2').textContent, dictionary['001904'].title);
  assert.equal(app.$refs.page.$refs.pageNav.commandText(archive.story['001905']), dictionary['001905'].title);
  const initialMedia = app.$refs.page.$refs.media.firstElementChild;
  const mounts = mediaMounts;
  const english = archive.story['001904'].content;
  await click();
  assert.equal(current().displayContent, english);
  assert.equal(app.$el.querySelector('h2').textContent, archive.story['001904'].title);
  assert.equal(app.$refs.page.$refs.pageNav.commandText(archive.story['001905']), archive.story['001905'].title);
  assert.equal(values.get('language'), 'en');
  assert.equal(app.$refs.page.$refs.media.firstElementChild, initialMedia);
  assert.equal(mediaMounts, mounts, 'Toggling must not remount media');
  app.params = { base: 'mspa', p: '009900' }; await tick();
  assert.equal(current().displayContent, archive.story['009900'].content, 'English must track the current page');
  current().open(); await tick();
  const log = current();
  await click();
  assert.equal(current(), log, 'Toggling must retain the log component');
  assert.equal(log.logHidden, false);
  assert.match(app.$el.textContent, /Jade，再见/);
  assert.equal(log.logButtonText, '隐藏对话记录');
  assert.equal(log.$el.querySelector('span').getAttribute('style').includes('#ff0000'), true);
  await click(); await click();
  assert.equal(log.logHidden, false);
  app.params = { base: 'homestuck', p: '8000' }; await tick();
  assert.match(current().displayContent, /Jade，再见/);
  app.params = { base: 'mspa', p: '008270' }; await tick();
  assert.equal(current().displayContent, archive.story['008270'].content);
  assert.match(app.$el.querySelector('.uhc-zh-en-button').textContent, /原文/);
  app.params = { base: 'mspa', p: '002427' }; await tick();
  assert.equal(current().displayContent, archive.story['002427'].content, 'Missing body must not erase original');
  app.params = { base: 'mspa', p: '007923' }; await tick();
  assert.equal(current().displayContent, '', 'An intentionally empty body remains empty');
  app.params = { base: 'ryanquest', p: '000001' }; await tick();
  assert.equal(current().displayContent, archive.ryanquest['000001'].content, 'Ryanquest must stay unchanged');
  app.params = { base: 'mspa', p: '001904' }; await tick();
  app.params = { base: 'mspa', p: '001902' }; await tick();
  assert.equal(getComputedStyle(app.$el.querySelector('.uhc-zh-en-format span[style]')).color, 'rgb(255, 0, 0)');
  app.params = { base: 'mspa', p: '007661' }; await tick();
  assert.equal(getComputedStyle(app.$el.querySelector('span[style*="font-size:0.5em"]')).fontSize, '0.5em');
  app.params = { base: 'mspa', p: '007477' }; await tick();
  const wizard = app.$el.querySelector('#wizardyherberttexts');
  assert.equal(getComputedStyle(wizard).fontSize, '1.125em');
  assert.match(getComputedStyle(wizard).fontFamily, /DFKai-SB/);
  await click();
  assert.equal(app.$el.querySelector('.uhc-zh-en-format'), null, 'Source formatting must disappear in English');
  await click();
  app.params = { base: 'mspa', p: '007623' }; await tick();
  assert.equal(getComputedStyle(app.$el.querySelector('.animation07423')).fontSize, '5em');
  app.params = { base: 'mspa', p: '001935' }; await tick();
  assert.match(current().displayContent, /哈希/);
  assert.doesNotMatch(current().displayContent, /杂凑/);
  app.params = { base: 'mspa', p: '001904' }; await tick();
  const key = target => target.dispatchEvent(new window.KeyboardEvent('keydown', { code: 'KeyL', altKey: true, shiftKey: true, bubbles: true, cancelable: true }));
  key(window); await tick(); assert.equal(values.get('language'), 'en');
  const input = document.createElement('input'); app.$el.appendChild(input);
  key(input); await tick(); assert.equal(values.get('language'), 'en', 'Typing in an input must not toggle');
  key(window); await tick(); assert.equal(values.get('language'), 'zh');
  const frame = app.$el.querySelector('.tabFrame');
  frame.scrollTop = 120;
  await click();
  assert.equal(frame.scrollTop, 120, 'Toggling must restore reading scroll');
  assert.equal(values.get('language'), 'en');
  const button = app.$children[0].$children[0];
  button.$destroy();
  key(window); await tick(); assert.equal(values.get('language'), 'en', 'Destroyed button must remove keyboard listener');
  assert.equal(JSON.stringify(archive.story), originalStory, 'The original archive must remain unchanged');
  assert.equal(warnings.length, 0, warnings.join('\n'));
  app.$destroy();
  const reopened = mountApp();
  await tick();
  assert.equal(reopened.$refs.page.$refs.textContent.displayContent, archive.story['001904'].content,
    'A new reader root must restore persisted English preference');
  reopened.$destroy();
  console.log('PASS: real UHC 2.8.1 mixins, Page, PageText and PageNav on Vue 2.7.16: button, reactive navigation, Chinese/English title/body/links, log state/colors, media identity, fallback, empty pages, Viz numbering, Ryanquest exclusion and keyboard cleanup.');
  dom.window.close();
}
main().catch(error => { console.error(error); process.exitCode = 1; dom.window.close(); });
