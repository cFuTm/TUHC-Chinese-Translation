'use strict';

let api;
let pages;
const RUNTIME = '__uhcZhEnRuntime_v1';

function runtimeFor(vm) {
  const root = vm.$root;
  if (!root[RUNTIME]) {
    const Vue = vm.$options._base;
    root[RUNTIME] = {
      state: Vue.observable({ language: api.store.get('language', 'zh') === 'en' ? 'en' : 'zh' }),
      buttons: new Set(),
      revision: 0
    };
  }
  return root[RUNTIME];
}

function isMainStory(vm) {
  for (let parent = vm; parent; parent = parent.$parent) {
    if (parent.$options.name === 'page') {
      return !parent.isRyanquest && Number(parent.storyId) === 6;
    }
  }
  return false;
}

// Wrap the live Vue getter. UHC's computed-hook $super is a creation-time value.
function wrapComputed(vm, key, transform) {
  const watcher = vm._computedWatchers && vm._computedWatchers[key];
  if (!watcher) throw new Error('中英切换：当前 UHC 缺少组件接口 ' + vm.$options.name + '.' + key);
  const previous = watcher.getter;
  const runtime = runtimeFor(vm);
  watcher.getter = function () {
    return transform.call(this, previous.call(this), runtime.state.language);
  };
  watcher.dirty = true;
}

function translatedTitle(page, language) {
  const entry = page && pages[page.pageId];
  return language === 'zh' && entry && typeof entry.title === 'string'
    ? Object.assign({}, page, { title: entry.title }) : page;
}

function toggle(vm) {
  const runtime = runtimeFor(vm);
  const scroll = Array.from(document.querySelectorAll('.tabFrame, .tabFrame *'))
    .filter(el => el.scrollTop || el.scrollLeft)
    .map(el => [el, el.scrollTop, el.scrollLeft]);
  const revision = ++runtime.revision;
  runtime.state.language = runtime.state.language === 'zh' ? 'en' : 'zh';
  api.store.set('language', runtime.state.language);
  const restore = () => {
    if (runtime.revision !== revision) return;
    scroll.forEach(([el, top, left]) => {
      if (el.isConnected) { el.scrollTop = top; el.scrollLeft = left; }
    });
  };
  vm.$nextTick(() => {
    restore();
    window.requestAnimationFrame(restore);
  });
}

const button = {
  name: 'uhcZhEnButton',
  created() { runtimeFor(this); },
  mounted() {
    const runtime = runtimeFor(this);
    runtime.buttons.add(this);
    if (!runtime.keydown) {
      runtime.keydown = event => {
        if (event.code !== 'KeyL' || !event.altKey || !event.shiftKey || event.ctrlKey ||
            event.metaKey || event.repeat || event.isComposing || event.defaultPrevented) return;
        const target = event.target;
        if (target && (target.isContentEditable || target.closest &&
            target.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"])'))) return;
        const owner = runtime.buttons.values().next().value;
        if (!owner) return;
        event.preventDefault();
        event.stopPropagation();
        toggle(owner);
      };
      window.addEventListener('keydown', runtime.keydown, true);
    }
  },
  destroyed() {
    const runtime = runtimeFor(this);
    runtime.buttons.delete(this);
    if (!runtime.buttons.size && runtime.keydown) {
      window.removeEventListener('keydown', runtime.keydown, true);
      runtime.keydown = null;
    }
  },
  render(h) {
    const language = runtimeFor(this).state.language;
    const id = this.$parent.thisTabPageId;
    const entry = id && pages[id];
    const fallback = language === 'zh' && id && Number(id) >= 1901 && Number(id) <= 10030 &&
      (!entry || typeof entry.content !== 'string');
    const label = language === 'en' ? 'EN' : fallback ? '中文·原文' : '中文';
    const hint = fallback ? '本页暂无中文正文，显示原文。' : '';
    return h('button', {
      class: ['systemButton', 'uhc-zh-en-button'],
      attrs: {
        type: 'button', 'aria-pressed': String(language === 'zh'),
        'aria-label': '切换到' + (language === 'zh' ? '英文' : '简体中文'),
        title: hint + '当前：' + (language === 'zh' ? '简体中文' : '英文') +
          '；点击切换。快捷键 Alt+Shift+L。仅切换页面文本。'
      },
      on: { click: event => { event.stopPropagation(); toggle(this); } }
    }, [label]);
  }
};

module.exports = {
  title: '简体中文 / English 一键切换',
  summary: '点击地址栏“中文 / EN”或按 Alt+Shift+L，切换主线正文、标题和下一页文字。',
  description: '默认显示简体中文，缺译正文回退原文。记住语言选择，保留聊天展开状态。' +
    '范围为 Homestuck 主线页面文本；图片内文字、Flash 和游戏内文字仍使用原资源。' +
    '译文来自用户提供的繁中底本和 homestuckjz 站点，经过 OpenCC 转换，尚未人工校对。',
  author: 'UHC 简中整合；原译文作者署名见 README',
  modVersion: '1.1.0',
  minAppVersion: '2.8.1',
  computed(modApi) {
    api = modApi;
    pages = pages || api.readJson('./translations.json').pages;
  },
  styles: [{ source: './style.css' }, { source: './formatted.css' }],
  browserActions: { language: { component: button } },
  vueHooks: [{
    matchName: 'page',
    created() {
      wrapComputed(this, 'thisPage', function (page, language) {
        if (!isMainStory(this)) return page;
        const view = translatedTitle(page, language);
        const entry = page && pages[page.pageId];
        // UHC hides PageText when the original content prop is empty. Some XML
        // posts supply translated text for image-only pages; expose that text
        // in the view copy so UHC can classify and render it without an archive edit.
        return language === 'zh' && entry && entry.content && !page.content
          ? Object.assign({}, view, { content: entry.content }) : view;
      });
    }
  }, {
    matchName: 'pageText',
    created() {
      wrapComputed(this, 'displayContent', function (original, language) {
        const entry = pages[this.pageId];
        return language === 'zh' && isMainStory(this) && entry && typeof entry.content === 'string'
          ? entry.content : original;
      });
      wrapComputed(this, 'logButtonText', function (original, language) {
        if (language !== 'zh' || !isMainStory(this)) return original;
        const match = (this.content || '').match(/^\|([^|]+)\|/);
        if (!match || /P4SSWORD H1NT/i.test(match[1])) return original;
        const names = { PESTERLOG: '聊天记录', DIALOGLOG: '对话记录', SPRITELOG: '精灵对话',
          JOURNALOG: '日志', RECAPLOG: '回顾', TRKSTRLOG: '捣蛋鬼对话', SRIOSBIZ: '严肃对话' };
        return (this.logHidden ? '显示' : '隐藏') + (names[match[1].toUpperCase()] || match[1]);
      });
      // Re-run UHC's URL, image and contrast filters after v-html changes.
      this.__uhcZhEnUnwatch = this.$watch('displayContent', () => {
        this.$nextTick(() => { if (!this._isDestroyed && this.isMounted) this.filterDOM(); });
      });
    },
    destroyed() { if (this.__uhcZhEnUnwatch) this.__uhcZhEnUnwatch(); }
  }, {
    matchName: 'pageNav',
    methods: {
      commandText(page, previous) {
        const language = runtimeFor(this).state.language;
        return previous(isMainStory(this) ? translatedTitle(page, language) : page);
      }
    }
  }]
};
