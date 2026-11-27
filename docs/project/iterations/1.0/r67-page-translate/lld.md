# LLD — R67 段落整页翻译（translate-batch 攒批懒加载 + 双语内联渲染）

> 状态：**开发完成待真机验收**（2026-11-14；服务端零改动配对 moon-well 既有 `POST /vocabulary/reading/translate-batch`；分支 `feat/r67-page-translate`；版本 0.8.28-202611142136 测试版）
> 来源：用户指令「把这个功能上线」——design.md §5 P1 收尾项「剩段落整页翻译（translate-batch）」；R1-R66 全台账从未立项，本次补齐。

## 1. 决策

- **入口两条，按页手动开关，绝不自动翻译**：悬浮球径向气泡「🌐 整页翻译」（经 SW 转发 `ML_PT_TOGGLE`，与高亮气泡同构，Why 不直调 window 钩子：扩展重载后的旧页面钩子缺失，SW 转发能回「请刷新页面」类可行动文案）+ popup「整页翻译」按钮（直发 `chrome.tabs.sendMessage`——popup 发出的消息 sender 无 tab，必须自己指到当前标签页，不能走 SW 转发）。按页临时态、无全局设置键：刷新即回关闭，计费敏感场景不给「忘了关」留口子。
- **懒加载攒批**：`IntersectionObserver`（rootMargin 400px，比高亮的 200px 宽——翻译是整段请求，提前起批减少滚动等待感）段落进视口才排队；**攒满 8 段或 800ms 防抖即发、单飞行顺序**。Why 批量是省钱关键：服务端把一次请求内的 miss 段合并为一次 LLM 调用（`perCall: {"reading-translate": 1}`）——8 段一批 = 1 积分，逐段发 = 8 积分；缓存命中段恒 1 积分/段（服务端口径）。8 段/批 × 数百字符一般 <20s，`callApi` 超时放宽到 60s。
- **计费护栏**：单次开启最多请求 100 段（chip 提示「达本页上限」；已入队批次照常完成）；页内内存缓存（归一化文本 → 译文）让重复开关零请求零计费——Why 双层：服务端 ES 缓存命中仍计 1 积分/段，只有页内缓存能挡住 toggle 循环的重复扣费。
- **渲染：内容性插入，不属 UI 面板**——译文以兄弟块插在原段下方（LI/TD/TH/DD/DT 插元素内部：表格外层是 ul/tr，兄弟位放 div 非法；块级容器走 `afterend`，与 magicbook 阅读器同款）。`textContent`-only 永不 innerHTML（R32/content.js L479 口径）；内联 `style.cssText` 自包含——**不注入全局样式表、不污染 window**，不违反 AGENTS.md §0.2「UI 一律 closed Shadow DOM」的精神：该约束管的是 UI 面板（气泡/抽屉/chip），译文块是内容性插入，状态 chip 照旧走 closed Shadow DOM（`#magiclens-pt-host`，z-index 2147483644 压在球与抽屉之下）。
- **三处排除标记**：译文块带 `data-magiclens-translation` 属性，page-translate 自身发现（div 不在 TEXT_TAGS 选择器天然排除 + closest 显式拦）、highlight.js `skipped()` 加一行祖先检查（译文里偶带的英文词入判定矩阵是纯噪声）、page-extract 不受影响（TEXT_TAGS 不含 div）。
- **文本口径**：`\s+ → 空格` 归一 + 2000 截断后发送（与 magicbook `paragraphSpeechText` 缓存键对齐：服务端键 = SHA-256(trim 文本)，客户端归一让同段跨端命中）；段落资格 = TEXT_TAGS 块级（剔除 PRE——代码块不该翻译）+ 可见 + ≥40 字符（导航/按钮/页脚噪声线，比 page-extract 给 LLM 上下文的 2 字下限严）+ CJK 占比 ≤30%（中文主导段落翻译无意义）+ 页面级文本去重。
- **多文档**：顶层 + 同源 iframe ≤2 层经 `contentDocument` 伸手（highlight.js `collectDocs` 同款，design.md §12 L165 口径），跨源 iframe 不做；IO/MO per-document（iframe 段落必须用 iframe 自己的视口判交）、iframe `load` 监听（epub 翻章换 contentDocument 时 iframe 元素不动，靠 load 重扫）。

## 2. 消息契约

- `MSG.ML_TRANSLATE_BATCH = 'ml:translate-batch'`：content → SW。请求 `{paragraphs[], bookName, chapter}`（SW 侧兜底：归一/过滤空白/≤20 段/每段 ≤2000/host-path 各截 200——服务端 `@Size` 上限的镜像）；响应 `{ok, data: List<String>}`（顺序/数量与输入一致，`""` = 该段失败可重试且服务端未缓存）或 `{ok:false, error}`（积分不足 code 1101 文案原样透传、401 带 auth 标志）。60s 超时。
- `MSG.ML_PT_TOGGLE = 'ml:pt-toggle'`：popup 直发 / 悬浮球经 SW 转发，同落 page-translate 的 onMessage；响应 `{ok, active}`（SW 转发收不到 lastError 时回「本页尚未加载段落翻译，请刷新页面后重试」——R63 教训：unknown message type 不进 UI）。
- 两类消息都进 rpc.js 注册表（R46 口径：新增消息一律从表取）；`ML_TRANSLATE_BATCH` 不走 `ML_API` 白名单——白名单是 chat 面板域的 POST 代理，批量翻译语义独立且超时口径不同，与 `ML_REVIEW_QUEUE` 同构。

## 3. page-translate.js（新模块，manifest 主清单 highlight.js 之后）

- **发现**：per-doc `TreeWalker(SHOW_ELEMENT)` 过 TEXT_TAGS + visible（尺寸/hidden/opacity，不含视口窗口——交由 IO），`records` Map（Element → {el, doc, text, state, node}）跨文档共用（与 highlight.js nodeRaws 同模式）。
- **批量管线**：IO 回调命中 → `enqueue`（页内缓存命中直接渲染短路；`scheduled >= 100` 拒入队）→ `pending` 队列 → 满 8 段立即 `flushNow`，否则 800ms 防抖（inflight 时不另起 timer，回包后续发）→ 请求前落「翻译中…」占位块（长批次下用户立刻看到在动）→ 回包按序 `fillBlock`/失败摘除。单飞行：一次只有一个批量请求在途。
- **失败语义**：整批失败摘占位块 + chip 红条（`__magicLensUserFacingError` 归一技术细节，401 加内联「重新登录」链——content.js setError 同款）；`""` 段按失败丢弃。失败两端都不缓存，重开开关即重试。
- **chip**：closed Shadow DOM 固定左下角，`段落翻译 · 已译 N 段（，进行中 M 段）（达本页上限 100 段）` + ✕ 关闭按钮。
- **生命周期三件**（与 highlight/content/ball 同模式）：`storage.onChanged` 主开关关闭联动 stop；`__magicLensRpc.onInvalidated` 失效自清理（摘 chip 与译文块）；bfcache `pageshow` persisted 重建文档绑定（records/译文块随堆存活，重扫按 records 去重不会二次插入，已译段零请求零计费）。启动挂**能力握手** `documentElement.dataset.magiclensPageTranslate = '1'`（与 highlight/selection 分能力标记同口径——「装了 ≠ 通」给显式探针）。
- **stop 后在途回包**：响应回调先查 `active`——否则 stop() 后回包会把译文块重新插回已关闭页面（写模块时自查出的竞态，同 content.js stale-response 判重思路）。
- **iframe 内 getComputedStyle**：用 `st.win.getComputedStyle`——模块只执行一次（顶层隔离世界），裸调用恒是顶层 window，iframe 段落会拿错视口关联。

## 4. 测试

- `scripts/check-extension-modules.js` 增补 R67 契约段：MSG 表两键存在、manifest 注入位（page-translate.js 在主清单且晚于 rpc.js、不得进 all_frames）、批量请求「归一/过滤/截断/20 段上限 → envelope 解包 → 顺序数组透传」「空段落护栏零出网」「积分不足文案透传」「`""` 段原样透传」——连同既有 ML_TRANSLATE/R64/R66 段全绿。
- `node --check` 全部 extension/*.js + scripts/*.js 过；check-ball-visibility / check-selection-ai 不受影响。
- 集成套件（同任务内同步，ops AGENTS.md B-4）：`matrix/magiclens.csv` +1 行（ml-page-translate，15 行）、`cases/magiclens/e2e_bridge.py` +1 注册、`browser/run.js` +1 特性用例（握手 → 开启 → 6 段单批断言 body/顺序 → 内联块渲染 → 关闭清干净 → 三开缓存零新请求）+ `/vocabulary/reading/translate-batch` mock 路由（result 按请求段落序动态生成，静态 fixture 表达不了与 body 等长的数组）+ `pages/article.html` fixture（6 段 ≥40 字符全在首屏）；`guard.py` 三向对账全绿；套件 magiclens 侧 18/18 PASS（0 FAIL 0 SKIP），全特性浏览器回归 15/15。
- 手工 AC（真机，验收态）：英文文章页开/关、滚动渐进出译文、关闭移除干净、刷新重置；同源 iframe 页（epub 正文）出译文；积分不足见「积分不足，无法使用AI功能」、401 见「重新登录」链；生词高亮不点亮译文里的词；magicbook 域悬浮球让位、popup 按钮仍可用；HTTP 页与非英文页段落被资格闸跳过。
