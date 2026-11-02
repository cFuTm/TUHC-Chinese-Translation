# UHC 双语 mod 安装包

发布包是 `uhc-zh-en-1.1.1.zip`。可安装文件位于 `uhc-zh-en/`。1.1.1 修复了 XML 中残缺 CSS 导致的 Render error，并刷新 UHC 的样式缓存。带格式正文和 17 页术语修订继续保留。

完整使用说明见 [uhc-zh-en/README.md](uhc-zh-en/README.md)。

## 安装步骤

1. 退出 UHC。
2. 将 ZIP 解压到 `unofficial-homestuck-collection/Asset_Pack/mods/`。
3. 确认存在 `Asset_Pack/mods/uhc-zh-en/mod.js`。
4. 启动 UHC，并在地址栏输入 `/settings/mod`。
5. 将“简体中文 / English 一键切换”拖入右侧 Active 列表。
6. 点击 Reload Application。

阅读时，点击地址栏右侧的“中文 / EN”或按 `Alt+Shift+L` 切换语言。缺译页显示原文。本版本切换主线页面文本；图片、Flash 和游戏内部文字继续使用原资源。

## 构建与测试

`tools/` 仅供维护，不必安装到 UHC。

在工作区根目录运行：

```powershell
python locolization/mod/tools/build.py
npm ci --prefix locolization/mod/tools --no-audit --no-fund
node locolization/mod/tools/test-mod.cjs
node locolization/mod/tools/test-css.cjs
python locolization/mod/tools/package.py
```

构建工具读取 `locolization/simplified_Chinese/homestuck.simplified.json` 和本地 UHC 的 `mspa.json`，生成安装包内的译文数据。测试工具读取本地 `resources/app.asar`，使用真实 UHC 组件验证语言切换。打包工具只收录 `uhc-zh-en/` 内的发布文件，不包含测试依赖。

若更新了工作区根目录的 `blog.xml`，先运行 `locolization/simplified_Chinese/tools/formatted_xml.py`，再构建 mod。导入工具更新正文 JSON、纯文本导出、页索引及 XML 报告。`local-overrides.json` 保存从已安装版本识别的术语修订；构建工具只修改文本节点，不修改链接或样式。

CSS 测试使用与 UHC 2.8.1 相同的 Sass.js 0.11.1 / LibSass 3.6.2。测试会复现原始坏声明，再编译发布样式和所有不同的内联样式。打包工具也会执行该检查；编译失败时停止打包。

## 1.1.2 原版媒体链接

正文中的图片及媒体超链接恢复为本地原版 mspa.json 所记录的 URL，保留中文链接文字和可见的短链接文字。原版不存在的额外汉化主图已移除，由 UHC 原有主图继续显示。普通网页、中文百科链接不受影响。逐项变更见 media-url-report.json。构建时自动执行 tools/restore-media.cjs，避免重新构建后恢复汉化图片链接。
