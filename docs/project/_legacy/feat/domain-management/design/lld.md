# LLD — 域名管理（在某些域名禁用 MagicLens）

> 需求：requests.md R25（2026-10-07）。用户希望把插件在特定域名上整体关掉（如办公页、
> 本地开发页、与页面自身交互冲突的站点），而不是每次靠全局开关来回切。
> 后端零改动，纯扩展端功能。

## US1 禁用判定与注入门控（引擎侧）

### 存储

- `chrome.storage.sync` 新增 `disabledDomains: string[]`（默认 `[]`），元素为归一化后的
  hostname（小写、无协议、无端口、无路径、去末尾点、剥 `*.` 前缀）。
  Why sync：与 token/enabled/hlEnabled/autoTranslate 同处一库、随浏览器账号同步，
  与既有配置口径一致。
- **匹配语义**：条目 `example.com` 命中 `example.com` 自身与其任意层级子域
  （`a.b.example.com`）。不做「仅精确域名」与「仅子域」两种模式——域名禁用的直觉语义
  就是「这个站及其子站都别管我」，多一种模式多一份理解成本（项目原则：尽量简单）。
  `localhost`、IP（`192.168.31.9`）均可作为条目；端口不参与匹配
  （禁 `localhost` 即禁所有端口的 localhost，输入时端口被剥掉并在 UI 说明）。

### 判定助手（`common.js`，新增）

- 无构建链，四个消费方（content / highlight / options / popup）共享一份实现：
  新增 `common.js`，定义 `window.__magicLensNormDomain(input)`（归一化，非法输入返 null）
  与 `window.__magicLensIsDisabledHost(host, list)`（含子域匹配）。
  Why 放 window：content script 同一隔离世界共享（与 `__magicLens*` 钩子同模式）；
  options/popup 是扩展页，`<script src="common.js">` 直挂。manifest `content_scripts.js`
  头部插入 `common.js`（先于 page-extract/highlight/content/chat 执行）。
- 归一化借道 `new URL`：无协议输入补 `http://` 前缀再取 hostname，避免手写解析漏掉
  IPv6/大小写/末尾点等边角；解析失败（非法字符等）返回 null，UI 层拒绝入库。

### 门控位置

- **content.js**：主引擎 IIFE 改为具名函数 `startMainEngine()`，由 storage 回调决定是否
  调用。命中禁用名单 → 不建 Shadow DOM、不挂任何监听、不设 `__magicLens*` 钩子。
  `window.__magicLensLoaded` 防重入门保持在 `startMainEngine` 内。
  OIDC 回调捕获 IIFE **不受**域名禁用影响（仅登录回调用途，禁 moon-well 域不该连
  自己的登录回调一起废掉）。
- **highlight.js**：boot 的 storage 回调里同判一次，禁用站直接 return（不 syncDocs、
  不 analyze）。highlight 与 content 在 manifest 中是两个独立脚本、同隔离世界，
  各自独立判定同一份名单（谁先谁后互不依赖）。
- **chat.js 零改动**：其唯一入口是 content.js 气泡的「问 AI」（`__magicLensAsk` 全仓库
  仅 content.js 调用），content 禁用即天然禁用，且 chat UI 本就懒构建。
- **生效语义（两处门控一致）**：名单只决定**新加载页面**是否注入。名单变更后：
  - 对禁用名单里**新增**域名：已打开页面继续可用，刷新后失效；
  - 从名单**移除**域名：本页 content script 未注入，刷新后恢复。
  统一口径「**刷新页面后生效**」，popup/options 文案明示。Why 不做运行中即时拆装：
  content.js 的 UI 与监听是顶层一次性装配，即时拆装需把装配逻辑重写为可逆
  （init/retire 对称化），风险与收益不成比例——域名名单是低频配置动作。

## US2 设置页名单管理（options）

- options.html 新增「域名管理」field：单行输入框 + 「添加」按钮 + 已禁用域名列表
  （每项一枚「移除」）。样式沿用页面既有 `.field`/`.hint`/`button` 体系，零新 CSS 依赖。
- 输入归一化经 `__magicLensNormDomain`：允许用户粘贴 `https://a.example.com/page`、
  `*.example.com`、`localhost:8080` 等任意形态，统一落库为 hostname；空串/非法输入
  给出行内错误提示，不入库。重复条目幂等（已存在则不重复添加）。
- 列表渲染全部 `textContent` 组装（与详解面板同哲学，杜绝注入）。

## US3 popup 本站快捷开关

- popup.html 新增「本站」行：checkbox「在本站启用 MagicLens」+ 域名展示。
  未勾选 = 该域名在禁用名单（写入 `disabledDomains`）；勾选 = 从名单移除。
  Why checkbox 而非按钮：与 popup 既有「启用划词翻译/生词高亮」两个开关的交互同构。
- 当前域名取自 `chrome.tabs.query` 活动标签页：非 `http(s)` 页（chrome:// 内置页等）
  隐藏本区块。扩展持 `<all_urls>` host_permissions，读取 `tab.url` 无需 tabs 权限。
- 切换后状态行提示「刷新本页后生效」；「重新扫描本页」在本站禁用时直接提示
  「本站已禁用」，不再报「不支持扫描」误导。

## 边界与不做的事

- 不新增任何 permission（仍是 `storage` + `host_permissions`）。
- 不做「白名单模式」（仅在某些域名启用）——需求是反向的禁用名单，且全局开关已存在，
  两者组合已覆盖场景。
- 不做按子路径/按页禁用，粒度到域名（含子域）为止。
- 名单不参与 background 的 API 中转判定：禁用站连页面注入都没有，不存在孤儿请求。
- **Alt+U 快捷键在禁用站为 no-op**（交叉审查补，US1）：highlight.js `ml:hl-toggle`
  在 `siteDisabled` 时直接回 `ok:true` 且不翻全局 `hlEnabled`——Why 回 ok：background
  的 fallback 是「收不到 ok 就代翻 storage」，回 false 反而触发那次翻转；静默翻转全局
  开关会殃及其它站点。同理 `ml:hl-rescan` 在禁用站回「本站已在域名管理中禁用」。
- 扩展页（popup/options）的 `[hidden]` 需 author CSS 兜底 `[hidden]{display:none!important}`：
  popup 的 `label{display:flex}` 与 options 的 `button{all:unset}` 都会压过 UA 的
  hidden 样式（与 content.js 阴影样式同款陷阱，options 的登录按钮显隐属既有坑一并修复）。
