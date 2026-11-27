# LLD · R78 正文块兼容（html-blob / div）+ 气泡「译」被重开回归

> 状态：开发中（0.8.39-202611271639 测试版）
> 关联：`requests.md` R78；L3 `docs/product/features/page-read-aloud.md`、`selection-routing.md`

## 现象

Google 账号社区帖子（`support.google.com/accounts/thread/413866495`）上：

1. 选中一段英文 → 气泡显示「已选中，点「AI」带入伴读，或点「译」手动翻译」→ 点「译」后气泡
   回到原提示，既无 loading 也无译文（截图 1）。
2. 鼠标移到正文段落按 `Alt+P` → 底部红条「未找到可翻译段落（把鼠标移到正文段落上再按）」
   （截图 2）。段末 ▶/译 也不出现。

## 根因

**① 点击气泡按钮触发选区重采，气泡被重开、在途回包被丢弃（content.js）**

- 气泡按钮上的 `mouseup` 会冒泡到 `document`，`onMouseUp` 无条件 `setTimeout(processSelection, 60)`。
- 气泡是 fixed 定位的 closed Shadow DOM，点击它并不会清掉页面选区；60ms 后 `processSelection`
  仍能读到同一段选区，`claimSelection` 的 500ms 去重窗早已过期（用户读完提示再点是常态），
  于是 `openBubble()` 再次执行：`current`/`bubbleSeq`/提示文案全部重置。
- 第一次点击发出的翻译回包回来时 `current.seq !== seq`，按 R68 判代规则被丢弃 →
  真机表现「点「译」完全没反应」。`onMouseDown` 早已用 `composedPath().includes(host)` 忽略自建 UI，
  `onMouseUp` 漏了同一道闸。

**② 段落选择器只认标准标签，Google 社区正文在 `<html-blob>` 里（page-translate / page-speak）**

- 实测该页 `document.querySelectorAll('p').length === 0`；帖子正文是
  `<html-blob>text<br><br>text</html-blob>`（回复里也可能用 `<div>` 分行）。
- `page-translate.js` 的 `TEXT_TAGS` 与 `page-speak.js` 的 `BLOCK_SEL` 都不含自定义元素，
  `closest()` 恒 `null` → `Alt+P` 只报「未找到可翻译段落」；段末工具与整页发现同样落空。

## 方案

### content.js：mouseup 一律忽略自建 UI

```js
const onMouseUp = (e) => {
  if (e && typeof e.composedPath === 'function'
    && e.composedPath().some((n) => n && n.id && /^magiclens-/.test(n.id))) return;
  setTimeout(processSelection, 60);
};
```

- 覆盖气泡、伴读抽屉、悬浮球、段落 chip、朗读工具等全部 `#magiclens-*` host；
  点击这些 UI 不再触发任何选区采集，与 `onMouseDown` 同一口径。
- 只拦「鼠标落在扩展 UI 上」的 mouseup；页面正文里的划选不受影响。

### common.js：共享「正文块解析」单点

```js
window.__magicLensTextBlockSelector
  = 'P,LI,BLOCKQUOTE,TD,TH,DD,DT,H1,H2,H3,H4,H5,H6,HTML-BLOB';
window.__magicLensClosestTextBlock(el);
```

- 先 `el.closest(标准段标签 + HTML-BLOB)`；
- 未命中则从命中元素向上最多 8 层，取第一个「`display` 非 inline 且 `innerText` ≥40 字符」的
  块级容器（兜住 X/Twitter 这类用 `<div>` 承载段落的站点）；
- 统一排除 `pre/code/[contenteditable]/nav/header/footer/aside/form/[aria-hidden]` 与
  地标 role，避免把代码、导航、页脚当正文；
- 只解析候选元素，长度/CJK 占比/去重仍由各模块自己的 `qualifies()` 判定，口径不复制。

### page-translate.js

- `TEXT_TAGS` 引用共享选择器（并入 `HTML-BLOB`）；整页发现因此能发现 html-blob 正文。
- `translateParagraphAt()` 改用 `__magicLensClosestTextBlock(hit)`，`Alt+P` 与
  `Shift` 悬停同时受益。
- `html-blob` 内若还有标准段落标签（`P/LI/...`），整页发现跳过外层 blob，交给内层，
  避免整块 + 逐段重复计费。

### page-speak.js

- `BLOCK_SEL` 并入 `html-blob`：整页连播的 `collectParagraphs()` 能发现该块；
  内部有标准段落时同样跳过外层。
- `onMouseMove` / `onContextMenu` 改用共享解析器，段末 ▶/译 与右键「朗读本段」在
  自定义元素/div 正文上同样可用。

## 兼容与边界

- 标准 `<p>` 页面行为不变：`closest()` 先命中标准标签，通用兜底不会触发。
- 通用兜底只服务「命中点 → 最近文本块」的单段入口；整页发现仍只认标准标签 +
  `html-blob`（不做全页 div 遍历，避免把布局容器整块计费）。
- `html-blob` 作为**一个块**处理：Google 社区用 `<br><br>` 分段的帖子会整帖作为一段
  翻译/朗读；回复里用 `<div>` 分行时仍整块一块（后续如需按 `<br>` 细分，另立需求）。
- 点击扩展 UI 不再重开气泡：✕/认识/生词/AI/详解/朗读按钮的状态不再被 60ms 后的
  选区采集覆盖。

## 验证

- `node --check extension/{common,content,page-translate,page-speak}.js`
- `node scripts/check-extension-modules.js`（R71–R76 契约段全绿）
- `python3 ../ops/tools/integration-suite/guard.py --repo magiclens`（19 行缺口 0）
- 浏览器套件新增/加强：
  - `ml-bubble-translate`：长选区点「译」后译文必须落进气泡（去掉 mouseup 闸会 FAIL）；
  - `ml-shortcuts`：html-blob 正文 `Alt+P` 发出 1 段 `translate-batch`、再按撤销；
  - `ml-read-aloud`：html-blob 段末 ▶/译 出现，点「译」单段翻译、再点撤销。
- 真实页面（CfT + 真实 Google 社区 URL + moon-well mock）：
  气泡「译」→ `POST /vocabulary/reading/translate` 并渲染译文；
  `Alt+P` → `POST /vocabulary/reading/translate-batch` 并插入译文块；
  段末 ▶/译 贴最后一行行尾出现。
