# R73 LLD：缺陷修复——整页翻译「已译 0 段」与伴读上下文采零（TreeWalker FILTER_REJECT 跳子树）

状态：开发完成（2026-11-23，0.8.34-202611231721 测试版；TDD 复现→修复→回归全绿，待真机验收）

## 0. 缺陷定性（缺陷环：定位到 R67 整页翻译 / P0 上下文采集）

- **用户报告**（R71/R72 真机验收，2026-11-23）：「段落翻译没有问题，整页翻译有问题」→ 症状确认：整页开启后 chip 显示「已译 0 段」，从不翻译；**同页 Alt+P 单段正常**。
- **根因**：`rescanDoc` 的元素级 TreeWalker 过滤器对不匹配元素返回 `FILTER_REJECT`——**REJECT 语义=跳过该元素连同整棵子树**。真实页面的正文 `<p>` 都嵌在 `div/article/section` 容器里，walker 从 body 出发遇到第一个容器即剪掉整棵子树 → 发现数恒 0。Alt+P 走 `elementFromPoint + closest` 不经 walker，故单段不受影响——与症状完全吻合。
- **为何 R67 上线时未暴露**：E2E fixture `article.html` 的 6 个 `<p>` 恰好是 body 的**直接子元素**（扁平结构），walker 直接命中；嵌套容器会掩盖问题——fixture 的偶然形态掩护了缺陷。
- **同根因顺带发现**：`page-extract.js`（伴读「问 AI」发送时网页上下文采集，P0 简版）第 32 行一字不差的同款 REJECT——嵌套页面上伴读上下文也在采零（只带标题）。同根因同修（条目内注明，非无主修复：同一次缺陷排查定位、同一行级修法）。
- **highlight.js 不在范围**：其 walker 是 `SHOW_TEXT` 且 REJECT 只打在文本节点上（无子树，REJECT≡SKIP），无此缺陷。

## 1. 修复

- `page-translate.js rescanDoc` / `page-extract.js collectPageContext`：`FILTER_REJECT` → `FILTER_SKIP`（SKIP 只跳节点本身、继续下钻，由 `TEXT_TAGS` 精确命中嵌套段落）；各留 ⚠️ 注释写明语义差异。

## 2. 回归锁（测试用例跟着产品走）

- **fixture 嵌套化**：`article.html` 的 6 段正文包进 `<article><div class="prose">`（真实页面形态）——扁平 `<p>` 会掩盖 REJECT/SKIP 语义回归，嵌套后该缺陷在套件里**永不再逃逸**。
- **TDD 顺序**：先嵌套 fixture → `ml-page-translate` 复现 FAIL（批量请求 0 次）→ 改 SKIP → 全绿。
- **守卫**：`check-extension-modules.js` 增 R73 段——page-translate.js/page-extract.js 禁含 `FILTER_REJECT`、必含 `FILTER_SKIP`；fixture 必须保持嵌套结构（`<article>`/`prose` 在册）。

## 3. 验证

- 嵌套 fixture 下 `ml-page-translate` / `ml-shortcuts` 全过（6 段发现/批量/缓存断言不变）；浏览器全特性 **18/18**、runner magiclens **21/21**、guard 三向 18 行缺口 0、模块契约守卫 6 段全绿。

## 4. 交付四问

- L1：不变（修复恢复 README 既有承诺的行为）。
- L2：不变。
- L3/LLD：实现边界修正（walker 过滤语义 + fixture 形态），本 LLD 承载。
