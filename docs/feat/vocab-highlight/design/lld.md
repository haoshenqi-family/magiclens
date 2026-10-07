# LLD — 生词智能高亮（P1 生词波浪线标注）

> R14。机制借鉴「明畅·个人词库」扩展（github.com/wamich/personal-vocabulary，v26.9.27 逆向分析，
> 逆向结论存项目记忆 `mingchang-extension-highlight-analysis`），数据与判定全部复用 moon-well 既有契约，后端零改动。

## 1. 用户故事

浏览任意网页时，扩展自动把「我的生词」用波浪线标出（无需划词）；点击高亮词唤起既有划词气泡
（翻译/详解/朗读/认识/生词/AI 全部可用）；在气泡里标「认识/生词」后，本页所有该词（含常见变形）
即时点亮/熄灭，无需重扫。

## 2. 判定链路（borrowing 明畅判定矩阵 → moon-well 契约映射）

明畅 = 内置分级词库 + 个人词库 + 客户端判定。magiclens 无本地词典（纯前端约束），判定整体下沉到
moon-well `/vocabulary/reading/analyze`——其服务端语义恰是明畅矩阵的同构实现：

| 词的处境 | analyze 服务端判定 | magiclens 表现 |
| --- | --- | --- |
| 单词本手动标记 familiarity>0 | familiarity≥7（FLUENT）→ 认识；否则生词，**永远参与判定** | 标过「认识」不亮；标过「生词」必亮 |
| 无标记、分级表（magicbook_word_level）档位 > 用户 hard_level | 默认生词 | 亮（超纲默认高亮，明畅 gt 语义） |
| 无标记、同档/以下/表外词 | 默认认识 | 不亮（防噪音，明畅 out 语义） |

- **初次扫描**：`POST /vocabulary/reading/analyze {pageText, bookName=hostname, chapter=pathname}`
  → `List<{word, unknown:true}>`（只回生词）。附带收益：网页生词进入与 magicbook 同一条
  reading_vocabulary 阅读事件流（学情/复习数据互通），这是选择 analyze 而非纯查询接口的决定性理由。
  同 URL 会话内不重复扫描（避免 studyTimes 虚增；去重键为 origin+pathname+search，**不含 hash**，
  TOC 锚点跳转不触发重扫），popup「重新扫描」可 force；首屏文本过短（<300 字符）延迟 2s 重试一次。
  analyze 请求在途前即启动引擎（装 MutationObserver），等待响应期间 SPA 渲染的内容由增量链路接管。
- **动态增量**（SPA 新增内容）：`POST /vocabulary/familiar {words[≤300]}`（单词本批量判定，
  无 ES 事件副作用）。已知妥协：增量词不吃「词档兜底」，只命中手动标记词——与 analyze 的差异
  可接受，静态正文（词档兜底的主战场）在初次扫描已覆盖。

## 3. 渲染引擎（borrowing 明畅核心工程，零 DOM 改动）

- **CSS Custom Highlight API**：`Highlight` 实例注册为 `CSS.highlights.set('ml-vocab', …)`，
  样式 `::highlight(ml-vocab)`（紫色波浪线 + 淡底）经 constructable stylesheet
  （`document.adoptedStyleSheets`）注入文档级——::highlight() 伪元素必须挂文档样式，不能进 Shadow DOM。
  minimum_chrome_version 110 ≥ 105（API 落地版本），无兼容问题。
- **两级缓存 + 视口懒渲染**（明畅 parent2Text2RawsAll / hlParentSecOb 同构）：
  全量匹配结果存 `nodeRaws: Map<Text, {start,end,norm}[]>`（纯数据，无 Range）；
  IntersectionObserver 只把**视口内段落**（匹配文本节点的 parentElement）的 Range 物化进 Highlight，
  滚出即移除、滚回按缓存重建。万级 token 页面只持可见区的 Range。
- **MutationObserver 增量维护**：childList + characterData 防抖 800ms——移除节点即摘其 raws/ranges；
  新增/变更文本重扫描，其中未判定过的新词走 §2 增量链路后点亮。
- **变形归并**（客户端规则版，替代明畅的词典 exchange 字段）：`lemmaCandidates()` 正则还原
  复数（-s/-es/-ies→y/-ves）、过去式/分词（-ed/-ied、去尾 e、双写辅音）、进行时（-ing/+e/双写）、
  比较级/最高级（-er/-est）、所有格（'s）。双向匹配：token 还原候选 ∩ 生词集，或 token ∈ 生词集的
  还原候选并集。**不规则变形（went）是已知缺口**——与 magicbook 现状一致（服务端 extractWords
  同样不分词形），待后续词典数据接入。
- **点词交互**：document 捕获 click → `caretRangeFromPoint` → 命中生词 token → 程序化选中该词
  → 调 content.js 暴露的 `__magicLensProcessSelection()` 复用既有气泡全流程（零新 UI）。
- **悬浮即显划词气泡（R20 起、R21 定稿）**：悬浮已高亮生词 ~200ms 直接打开**完整划词气泡**
  （译/详/朗读/认识/生词/AI 全部可用），借鉴明畅 hover 词典卡交互但升级为全功能气泡。
  **不开真实选区**（部分页面元素点击会跳转，悬浮零副作用；也不覆盖用户已有选区/无原生选区高亮）。
  - 命中测试 = `caretRangeFromPoint` + nodeRaws 查表（仅生词节点有登记，非高亮区 O(1) 拒绝），
    建卡前复验 `data.slice(start,end)===raw` 防错位。
  - 状态机：highlight.js 只管命中与节奏，气泡生命周期归 content.js，经
    `__magicLensBubbleSource`（selection/hover/null）互通。同词微动不打扰已排定时器
    （防手抖把延迟无限重排）；换词立即切换气泡；离开 150ms 宽限内回归不闪、超时收气泡
    （只收 hover 来源，划选气泡不动）；移进气泡保持显示。
  - 抑制与关闭：拖选中（e.buttons）、划选气泡打开（source=selection）、鼠标离窗；
    Esc/滚动视为主动关闭——记下所在词（hoverDismissed），鼠标不离词不重开，否则气泡关不掉。
  - content.js 新钩子：`__magicLensShowWordBubble(word, anchor)`（按词开气泡、
    current 直置、autoTranslate 自动翻译）与 `__magicLensHoverLeave`（只收 hover 来源）；
    show()/hide() 带 source 标记，onScroll 复用 hide() 同步来源。
- **排除面**：SCRIPT/STYLE/NOSCRIPT/CODE/PRE/KBD/SAMP/TEXTAREA/INPUT/SELECT 及 contenteditable
  祖先、`#magiclens-host`/`#magiclens-chat-host` 自身 UI；仅顶层 frame（不进 iframe）。

## 4. 门控与开关

- 生效条件：已登录（storage.sync token 非空）∧ 总开关 `enabled` ∧ `hlEnabled`（默认开）。
- 自动扫描仅英文页（borrowing 明畅 RR 检测：title/meta description/keywords + html[lang]，
  字母占比 ≥60%）；非英文页可手动扫描/开关。
- `Alt+U`（commands `toggle-highlight`）全局开关，与 popup 开关同一 storage 键；
  popup 另提供「重新扫描本页」。

## 5. 边界与不做（v1）

- 不进 iframe / 页面 Shadow DOM；不规则变形（went）不高亮；`::highlight` 样式暂不开放自定义；
  pushState 路由切换到新 pathname 时自动重扫（popstate，按去重键判定），同页 hash 变化不重扫。
- analyze 请求体上限 150,000 字符（服务端 DTO 无硬限制，防御性截断）。
- 已知竞态防护：登录态/开关在 analyze 在途期间变化时，响应回调复查启用条件后丢弃（teardown 清场后不复活）；
  扩展重载后旧副本经 askBackground 失效路径轻量退役（摘样式与 Highlight 注册，对齐 content.js R13）。
