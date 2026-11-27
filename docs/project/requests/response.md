# response.md — 对话回应记录（仅保留最近 10 个 request 的回应）

> 归档索引：[response-R1-R10.md](response-archive/response-R1-R10.md) · [response-R11-R15.md](response-archive/response-R11-R15.md)（2026-10-07 R25 完成时补执行 R10/R20 漏掉的归档） · [response-R16.md](response-archive/response-R16.md)、[response-R17-R18.md](response-archive/response-R17-R18.md)（2026-10-08 R28 收口时搬移） · [response-R19.md](response-archive/response-R19.md)（2026-10-08 R29 完成时搬移） · [response-R20.md](response-archive/response-R20.md)（2026-10-08 R30 完成时搬移） · [response-R21-R22.md](response-archive/response-R21-R22.md)（2026-10-08 R32 完成时搬移） · [response-R23-R24.md](response-archive/response-R23-R24.md) · [response-R28.md](response-archive/response-R28.md) · [response-R25.md](response-archive/response-R25.md)（2026-10-10 R35 完成时搬移） · [response-R26.md](response-archive/response-R26.md)（2026-10-10 R36 写入触发轮转搬移） · [response-R27.md](response-archive/response-R27.md)（2026-10-10 R38 写入触发轮转搬移） · [response-R29.md](response-archive/response-R29.md)（2026-10-11 R40 写入触发轮转搬移） · [response-R30-R31.md](response-archive/response-R30-R31.md)（2026-10-11 R41 集成时窗口超限搬移） · [response-R32.md](response-archive/response-R32.md)（2026-10-13 R43 写入触发轮转搬移） · [response-R33.md](response-archive/response-R33.md)（2026-10-14 R44 写入触发轮转搬移） · [response-R34.md](response-archive/response-R34.md)（2026-10-15 R45 写入触发轮转搬移） · [response-R35-R38.md](response-archive/response-R35-R38.md)（2026-10-16 R50 写入触发轮转搬移，窗口回 10 条 request 内） · [response-R41.md](response-archive/response-R41.md)（2026-10-27 R56 写入触发轮转搬移） · [response-R45.md](response-archive/response-R45.md)（2026-10-21 R51 写入触发轮转搬移） · [response-R39.md](response-archive/response-R39.md)（2026-10-27 R52 写入触发轮转搬移） · [response-R46.md](response-archive/response-R46.md)（2026-10-27 R53 写入触发轮转搬移） · [response-R40.md](response-archive/response-R40.md)（2026-10-27 R54 写入触发轮转搬移） · [response-R47.md](response-archive/response-R47.md)（2026-10-27 R55 写入触发轮转搬移） · [response-R42.md](response-archive/response-R42.md)（2026-10-29 R57 写入触发轮转搬移） · [response-R43.md](response-archive/response-R43.md)（2026-11-02 R58 写入触发轮转搬移） · [response-R44.md](response-archive/response-R44.md)（2026-11-08 R59 写入触发轮转搬移） · [response-R59.md](response-archive/response-R59.md)（2026-11-23 R71 写入触发轮转搬移） · [response-R60.md](response-archive/response-R60.md)（2026-11-23 R72 写入触发轮转搬移） · [response-R62.md](response-archive/response-R62.md)（2026-11-23 R73 写入触发轮转搬移） · [response-R63.md](response-archive/response-R63.md)（2026-11-23 R74 写入触发轮转搬移） · [response-R64-R68.md](response-archive/response-R64-R68.md)（2026-11-27 R78 写入触发轮转搬移，窗口回 10 条）

- `response-archive/response-R50-R52.md`：R50 docs v2 迁移 / R51 发布链纯文档跳过打包 / R52 伴读抽屉去 token+站内链接——2026-11-13 R62 写入触发轮转搬移（窗口 12→13 压回 10），原样搬移不改写

- `response-archive/response-R54.md`：R54 常驻入口悬浮球（buddy 形象+径向气泡+拖拽记忆，R56/R57 验收修订同节）——2026-11-15 R70 写入触发轮转搬移，原样搬移不改写

- `response-archive/response-R53.md`：R53 伴读抽屉语音双向（麦克风转写 + 回复朗读）——2026-11-13 R63 写入触发轮转搬移，原样搬移不改写

## 2026-11-15（R69：悬浮球气泡功能逐项配置——registry 单源 + 守卫双锁）

**对 R69 的回应**：用户指令「buddy 整页翻译 回顾等气泡功能都要能在悬浮球那里配置。
代码层面写清楚，避免下次再犯」——清 R54 头注释登记的「可配置性 LLD 遗留」。
配置入口用户拍板：设置页「悬浮球」区块。

- **交付（0.8.30-202611152156 测试版）**：
  - `common.js`：`__magicLensBallActions` 注册表（frozen 纯数据 {id,icon,label,cfgKey} ×6，
    单源——ball.js 渲染、options.js 配置 UI、守卫对账三方共读；数据进 common 的 Why：
    options 页不加载 ball.js，表须可独立求值）+ `__magicLensDefaults` 新增
    `bubbleChat/bubbleHighlight/bubblePageTranslate/bubbleLearning/bubbleLibrary/bubbleMe/ballReview`
    七布尔键，**默认全 true=升级零变化**。
  - `ball.js`：ACTIONS 改注册表驱动 + RUNS 按 id 映射；`build(cfg)` 过滤气泡；
    配置变更**即时生效**（onChanged 盯全部视觉键 → visualSignature 判重 →
    remove+build+applySavedPosition 整体重建，token 等非视觉键不触发）；
    FAB 本体点击跟随配置（chat 开→抽屉 / 关→第一个启用气泡 / 全关→ML_OPENOPTIONS
    开设置页）；滚动复习词卡 `ballReview` 门控（关=不 initReview、零队列请求，
    与暂停/收起独立）；`openBubbles()` 零气泡早退（bubbles-open 兼管复习卡让位）。
  - `options.html/js`：「悬浮球」区块循环注册表自动渲染逐气泡开关 + 词卡开关，
    storage 为唯一事实源（onChanged 跨页同步）。
  - **守卫双锁（check-ball-visibility.js）**：锁 A=registry cfgKey ↔ defaults
    bubble* 键双向覆盖（ballReview 非气泡单独断言）；锁 B=ball.js 禁私挂字面量
    ACTIONS + RUNS 按注册表 id 全覆盖 + options.js 必须引用注册表——
    「新增气泡绕过配置面」从纪律变成挂门禁的结构性约束。
- **验证**：node --check 全过；三守卫全绿（双锁输出 `6 actions two-way locked`）；
  套件同任务内同步（matrix/magiclens.csv +1 ml-ball-bubbles=17 行、run.js 新用例、
  e2e_bridge +1）：`guard.py` 三向全绿、浏览器全特性回归 **17/17**（含并行 R68 的
  ml-control-selection）、runner magiclens **20/20**。
- **文档四问**：L1 README 悬浮球行补逐项开关说明；L2 design.md 追加决策 21；
  LLD 落 `iterations/1.0/r69-ball-bubbles-config/lld.md`（含并行 R68 版本漂移插曲：
  本条语义化 +1 落 0.8.30）。
- **手工 AC（待真机验收）**：设置页逐项开关即时生效（已打开页 hover 立即少一项）；
  全关点球本体落设置页；词卡关闭消失、恢复复活；升级用户默认全开零变化。
- **PingCode**：idea 未建，待用户令补建（R66-R68 同口径，本条先台账承载）。

**台账总结**：`requests.md` 第 69 条由 `claim.sh` 占号即 push（`c2555c4`）、详情已回填；
response.md 现 10 节未超窗口。冲突记录：无撞号；占号时 R68 已被并行会话占用（划词链路
加固），本条顺延 69，版本顺延 0.8.30。

## 2026-11-15（R70：悬浮球配置切 buddy 页服务端真值——三仓接力收官）

**对 R70 的回应**：用户对 R69 纠偏「还是不行啊」+ buddy 页截图——真意是与 magicbook buddy 页
**同一份服务端配置**。三仓接力：moon-well R260（白名单+3）→ magicbook R294（薄代理+懒迁移
+配置面）→ 本仓只读消费。

- **交付（0.8.31-202611152331 测试版）**：
  - `background.js` ML_API 白名单 +`/buddy/quick-actions`（buddy 域全 POST 约定）。
  - `ball.js`：**缓存先行+服务端校正**——storage.local `magiclens.ballQuickActions` 先行
    渲染（首屏零等待），启动即 fetch，回包落缓存、visualSignature 变化才重建，失败静默
    保留缓存；`stored=true` 按 `selected ∩ registry` **服务端顺序**渲染、词卡=selected 含
    `'review'`；`stored=false`/无缓存=注册表全量（升级零变化）；FAB fallback 链不变。
  - `common.js`：R69 本地键（bubble*×6+ballReview）删除（单一真值不留影子开关）；
    registry 去 cfgKey（id=服务端白名单 id）；`options.js` 开关区换「打开 magicbook 伙伴页
    配置」直达按钮。
  - **守卫双锁升级**：锁 A=跨仓断言 registry id ⊆ moon-well BuddyService.QUICK_ACTION_IDS
    （家族两仓同层文本解析，缺失/漂移即挂）；锁 B 增补「options 不得再引用 registry」。
- **验证**：node --check 全过；三守卫全绿（`6 actions ⊆ moon-well whitelist (10)`）；
  套件 mock `/buddy/quick-actions`（t.qa 注入）+ ml-ball-bubbles 四段 reload 断言 +
  matrix note 更新——guard.py 三向全绿、浏览器全特性 **17/17**、runner magiclens **20/20**。
- **踩坑（详见 LLD §3）**：moon-well client 回包是 response.text（magicbook 侧首版字符串当
  dict 全 502）；守卫 `registry.size` 应为 `length`；E2E 词卡探针——reviewLoad 每次激活只发
  一次、请求计数差有竞态 → 改词卡 DOM 渲染直证。
- **文档四问**：L1 README 悬浮球行改「伙伴页统一配置」口径；L2 design.md 追加决策 22；
  L3 LLD 落 `iterations/1.0/r70-server-ball-config/lld.md`；台账 requests.md 70 回填。
- **手工 AC（待真机，依赖 moon-well/magicbook dev 部署）**：buddy 页勾掉「整页翻译」保存 →
  扩展球刷新后无 🌐；勾「回顾」→ 词卡现；从未保存账号全量默认；宿主球不渲染扩展项气泡；
  断网用缓存。
- **PingCode**：idea 未建，待用户令补建（R66-R69 同口径）。

**台账总结**：`requests.md` 第 70 条由 `claim.sh` 占号即 push（`688207f`）；response.md 现
11 节——超窗口 1 节，最旧 R54 节原样搬入 `response-archive/response-R54.md` 并登记索引，
压回 10 节。冲突记录：无撞号。

## 2026-11-23（R71：翻译快捷键——Alt+A 整页开关 + Alt+P 悬停单段 + 设置页录制）

### R71（用户：「magiclens 的段落翻译是否已经发布了，加一个快捷键设置。给翻译段落和整页翻译增加快捷键，参考沉浸式翻译。」）

**先答问题**：R67 段落整页翻译**已开发完成、随测试版可用**（0.8.28 起，当前主检出 0.8.31），但**正式版未发布**（release 分支未 merge、无 GitHub Release，R66–R70 攒批次待用户确认按 §0.2 两段式），真机 AC 也未走。本 R71 在其上加快捷键。

**口径拍板**（AskUserQuestion 二轮确认）：①「翻译段落」快捷键=**悬停单段翻译**（翻译/撤销鼠标所在段，与沉浸式翻译「鼠标悬停段落翻译」同款），非与整页同开关；②默认键位 `Alt+A`=整页开/关（与沉浸式翻译一致）+ `Alt+P`=单段，设置页可录制/清除。

**设计决策**（详见 `iterations/1.0/r71-translate-shortcuts/lld.md` + design.md §23 ADR）——①**方案 A=扩展内 keydown 录制式**（沉浸式翻译同款），被否 chrome.commands（自定义 UI 归 Chrome 不可编程设置）；②键位串=`修饰键(固定序)+e.code` 存 storage.sync（**Why e.code**：mac Option 死键 å/π 使 e.key 匹配整段失效），''=禁用，defaults 两键进 `__magicLensDefaults`（R46 单点）；③combo 三件套（FromEvent/Matches/Label）落 common.js 纯函数（options 不加载 page-translate 同因 + Node 守卫可锁）；④单段=顶层 mousemove 记锚点 → elementFromPoint→closest(TEXT_TAGS)→`qualifies`（从 paragraphText 拆出的纯资格判定，两入口同门槛）；状态机 done→撤销（置 `dismissed` **防 MO 重扫复活**，sessionCache 留译文=复活零计费）、pending/loading→忽略、否则 `start(false)` 保底开启（**不做全页发现**，视口段落不得被放大成批量计费）→ enqueue 享既有攒批；⑤触发守卫=编辑态不触发（mac 死键不搞双重效果）+扩展自建 shadow host 忽略（closed shadow 重定向外层只见 host div，伴读抽屉打字不误触）+域名禁用站静默+未命中零拦截；命中才 preventDefault；⑥chip 分层重构：host/errBox 与 chipRow 拆开（inactive 时快捷键反馈走独立提示条 4s 消隐，✕ 的关闭语义只在 active 成立）——**坑：closed shadow 的 host.shadowRoot 恒 null，必须持 attachShadow 返回引用**。

**落位**：common.js（defaults+三件套）/ page-translate.js（keydown capture 分发+单段+start(discover) 增参+storage.onChanged 即时采纳）/ options.html+js（「快捷键」节录制器：Esc 取消、冲突拒绝、清除=禁用）/ manifest 0.8.32-202611231607 测试版。moon-well 零改动。

**验证**：node --check 全过；`check-extension-modules.js` +R71 契约段（combo round-trip/defaults 在册/page-translate 与 options 装配静态断言）全绿；套件同任务内同步：matrix +1（ml-shortcuts，18 行）、run.js 新特性用例（单段 1 请求 1 块→撤销零请求+900ms 防复活窗→编辑态守卫→Alt+A 两按=关再开、整页批次只含未缓存 5 段（**单段→整页不重复计费**实证）→再按关清干净→未命中零拦截）、e2e_bridge FEATURES +1，guard.py 三向全绿（缺口 0）；浏览器全特性回归 **18/18 PASS**、runner magiclens **21/21 PASS**。

**遗留**：真机 AC 待用户（`ac/manual-ac.md` 16 条：录制/即时生效/编辑态/禁用站/mac 死键）；正式发布待用户确认按 §0.2 两段式（可与 R66–R70 同车）；PingCode idea 未建待用户令（R66–R70 同口径）。

## 2026-11-23（R72：翻译快捷键对齐沉浸式补充——双击 Alt 别名 + Shift 悬停单段 + Mac 说明）

### R72（用户：「悬停单段翻译 沉浸式翻译的快捷键是什么？我记得是按两下 alt，注意也要给 mac 用户提供快捷键」）

**先答核实**（官方文档/FAQ 实测，回复已附来源）：沉浸式翻译整页开关=`Alt+A`（我们 R71 已同键位）；悬停段落翻译**无独立快捷键**=「按住 Shift+悬停」且**默认关闭**（Shift 避开 mac Option 死键，代价选区冲突误触，官方 issue #1749 在讨论长按误触）；**「双击 Alt」不是官方功能**（用户记忆来自其他工具）。**Mac 现状**：R71 的 Alt+A/Alt+P 在 Mac 即 ⌥A/⌥P，e.code 匹配天然可用。**用户拍板：两个都加**。

**设计**（`iterations/1.0/r72-shortcut-it-parity/lld.md` + design.md §23.1）——①双击 Alt（裸 AltLeft/Right、仅 altKey、≤500ms `DOUBLE_ALT_MS`）走 `toggle()` 同路径；其他键断连击、单按不拦截零干扰；固定别名不进 storage（冗余别名不增设面）。②按住 Shift 悬停单段=裸 Shift（ShiftLeft/Right、仅 shiftKey）→ `translateParagraphAt(lastX,lastY)` 复用 Alt+P 全套状态机；**Why 敢默认启用而沉浸式默认关**：触发前提是光标悬停在合格段落上（elementFromPoint 资格闸），其他位置零反应；Shift+Tab/方向键/字母非裸 Shift 不命中。③**录制器怪串根修**：`__magicLensComboFromEvent` 拒修饰键物理 code（AltLeft 族→null）——录制器自动继续等待、匹配器永不命中裸修饰键（双击连击不误碰已录串），源头一处修三处受益。④options hint 补 Mac ⌥ 说明与两固定别名。

**落位**：common.js（COMBO_MOD_CODE_RE 闸）/page-translate.js（onAliasKeydown 独立监听，onInvalidated 一并退役）/options.html 文案/manifest **0.8.33-202611231637** 测试版；ops 套件 run.js `ml-shortcuts` 用例 +4 段（单按 Alt 零反应→断连击→双击 Alt 开（6 段全缓存零请求）→双击 Alt 关→Shift 悬停单段→Shift 撤销）、matrix 行 note 增补、e2e_bridge 不变（slug 同行）。moon-well 零改动。

**验证**：node --check 全过；check-extension-modules R71 段扩 R72 断言（修饰键 code 拒录 round-trip 反例、onAliasKeydown/DOUBLE_ALT_MS/BARE_*_RE 装配断言）全绿；guard.py 三向 18 行缺口 0；浏览器全特性 **18/18 PASS**、runner magiclens **21/21 PASS**。

**遗留**：真机 AC 待用户（R71 16 条 + R72 13 条，重点=双击窗口手感 500ms 是否合意、Shift 悬停误触观察）；正式发布 R66–R72 攒批次待用户确认；PingCode idea 待用户令。

## 2026-11-23（R73：缺陷——整页翻译「已译 0 段」，TreeWalker FILTER_REJECT 跳子树）

### R73（用户验收 R71/R72 时报：「段落翻译没有问题，整页翻译有问题」→ 症状确认：开了整页不翻译、chip 恒「已译 0 段」、同页 Alt+P 单段正常）

**定性**：非 R71/R72 回归，是 **R67 原始缺陷真机首测暴露**。根因=`rescanDoc` 元素级 TreeWalker 对不匹配元素返回 `FILTER_REJECT`——**REJECT 语义=连整棵子树一起剪**：真实页面 `<p>` 都嵌在 div/article 容器里，从 body 遇第一个容器即全灭 → 发现数恒 0；Alt+P 走 `elementFromPoint+closest` 不经 walker 故正常，症状完全吻合。**为何漏网**：E2E fixture 的 6 个 `<p>` 恰是 body 直接子元素（扁平结构侥幸绕过 walker 剪枝）。

**顺带发现同根因第二处**：`page-extract.js`（伴读「问 AI」网页上下文采集）第 32 行一字不差同款 REJECT——嵌套页面上伴读上下文也在采零（只带标题）。同次排查定位、同一行级修法，随 R73 一并修（条目注明，非无主修复）。highlight.js 的 SHOW_TEXT walker REJECT 打在无子树的文本节点上，无此缺陷不在范围。

**修复**：两处 `FILTER_REJECT` → `FILTER_SKIP`（只跳节点本身、继续下钻）+ ⚠️ 语义注释；**回归锁两把**：①fixture 嵌套化（`article.html` 正文包进 `<article><div class="prose">`，真实页面形态，扁平结构永不再掩护此缺陷）；②守卫 R73 段（page-translate/page-extract 禁含 FILTER_REJECT、必含 FILTER_SKIP、fixture 嵌套结构在册）。**TDD 顺序**：先嵌套 fixture 复现 FAIL（批量请求 0 次）→ 改 SKIP → 全绿。

**验证**：嵌套 fixture 下 `ml-page-translate`/`ml-shortcuts` 全过（6 段断言不变）；浏览器全特性 **18/18**、runner magiclens **21/21**、guard 三向 18 行缺口 0、模块契约守卫 6 段全绿。0.8.34-202611231721 测试版。

**遗留**：真机复测整页翻译（嵌套正文页应正常翻译）；正式发布 R66–R73 攒批次待用户确认；PingCode idea 待用户令。

## 2026-11-23（R74：缺陷——双击 Alt 键序误伤 + 在途回包跨会话重复渲染，浏览器实测发现）

### R74（用户令「使用浏览器测试一下」→ CfT 真实浏览器实测暴露两个键序/时序缺陷）

**实测环境**：CfT 加载 0.8.34 扩展 + 真实 dev moon-well 令牌 + 可信键盘事件（CDP Input 域），发现：①双击 Alt 开后 300ms 按 Alt+A → 撤销步失效、**同段两条不同译文**、chip「已译 13 段」；②页面出现重复真实翻译。

**插桩实锤**：①keydown 时间线 `t=11 双击第二击→ON` → `t=313 Alt+A 的 Alt down（303ms<500ms 窗口）被当下一组双击第二击→误 toggle` → `t=314 A→再 toggle`——「双击后 ≤500ms 内任何 Alt 组合键」其前半按都误判，长按 Alt 的 keydown 重复（e.repeat）同样中招（**R72 缺陷**）。②`sendBatch` 回包仅守 `!active`：快速 OFF→ON 时旧会话在途回包落进新会话重复插 DOM（**R67 潜伏**，误伤放大器）。

**修复**（page-translate.js）：`e.repeat` 守卫 + **静默确认窗**（第二击判定延迟 150ms，窗内任何其他 keydown 经 `cancelPendingDouble` 取消；stop 同步取消防幽灵 toggle）+ **会话代守卫**（`sessionSeq` 每次 start()+1，回包 stale 时仍写页内缓存——翻译费已花重开零计费——但跳过 DOM/chip/续发）。

**回归锁**：套件 `ml-shortcuts` +⑩（双击开→立刻 Alt+A→恰好关闭不复活、零幽灵 toggle、repeat 零反应）；守卫 R74 段（repeat/静默窗/三处 cancelPendingDouble/会话代四断言）。

**验证**：ml-shortcuts 全过；浏览器 18/18；guard 三向 18 行 0 缺口；契约守卫 7 段全绿；**CfT 真实浏览器端到端复测全过**——修复前失败的完整键序（整页→关→双击别名→Alt+P 单段→撤销）+ Wikipedia 真实页（首屏 8 段真实中文译文、scrollTo 后 IO 续批至 16 段、关闭清零），截图存档 /tmp/ml-browser-test/。0.8.35-202611232133 测试版。

**遗留**：真机抽查 AC（`r74-shortcut-misfire/ac/manual-ac.md` 8 条，重点=双击后快速 Alt+A 手感）；正式发布 R66–R74 攒批次待用户确认；PingCode idea 待用户令。

## 2026-11-27（R75：网页正文段落朗读——默认 AI 音 + 每段 ▶ + 快捷键/右键菜单）

### R75（用户：以 Anthropic《Building always-on agents》为例问「能让 magiclens 也朗读段落吗」→ 拍板「默认 AI 音 / 不弹计费确认 / 快捷键和右键菜单，增加每段 ▶」）

**做了什么**：新增 `extension/page-speak.js`，把网页正文变成可连播的「文章」——段落悬浮
「▶ 朗读」、`Alt+S` 整页连播（设置页可改）、右键「朗读本段 / 朗读全文」；当前段高亮并自动
滚屏，控制条支持暂停/继续、下一段、1.0/0.75/0.5 变速、停止。默认全程走 moon-well
`/tts/speak` AI 音（≤1800 字符切句顺序播），失败不回落浏览器机械音；401/积分不足文案在
控制条上方可见。

**省钱与口径**：用户拍板不做计费二次确认，因此 SW 增文本级 IndexedDB `ttsaudio` 缓存
（200 段 LRU / 7 天，与服务端临时语音档同寿命）+ `ttsInflight` single-flight；播放前预取
下一段，同一段重听零网络零积分。首次仍按 moon-well 口径 `floor(字符/50)` 计费、服务端缓存
命中 1 积分/段。UI 全挂 closed Shadow DOM `#magiclens-read-host`；只装配顶层文档
（magicbook 阅读器 iframe 交给站点自身朗读）；禁用站零 host 零监听。

**验证**：`node --check extension/*.js` 全过；`check-extension-modules.js` 新增 R75 契约段
全绿（AI 音链路/注入顺序/右键菜单/缓存/设置项/握手）；集成套件同任务同步 matrix +1
（ml-read-aloud，19 行）+ `e2e_bridge` +1 + `run.js` 用例（握手→悬浮▶→`/tts/speak`→
控制条 2/7→变速持久化→停止→Alt+S 再播），`guard.py` 19 行缺口 0；**浏览器全特性
19/19 PASS**（mock `/tts/speak` 改为可解码静音 WAV 以稳定观察播放条）。

**验收反馈（同日，0.8.37-202611271555）**：用户要求「朗读按钮放段落末尾，就像 magicbook
那样」。共享浮钮改为 **段末 24px 圆 ▶**：`Range.getClientRects()` 取段落最后一行，贴行尾
右侧与行垂直居中（末行顶到视口右缘时落到行下右对齐），滚动/自动滚屏跟随段落；播放中同一
按钮变 ■、请求在途为 ⟳，再点即停（对齐 magicbook R215 段落工具）。仍是一个固定按钮、
不向宿主插 DOM。E2E 增加「▶ 贴在最后一行行尾」位置断言与「▶→■→再点停止」链路；
`guard.py` 19 行缺口 0、**浏览器全特性 19/19 PASS**。

**遗留**：真机 AC 10 条待用户（`r75-page-read-aloud/ac/manual-ac.md`）；正式发布
R66–R75 攒批次待用户确认；PingCode idea 未建待用户令。

## 2026-11-27（R76：段末工具加「译」——只保留朗读 + 翻译两个按钮）

### R76（用户：R75 验收中追加「把段落末尾的翻译的按钮也加上，只要这两个，其他不要」）

**做了什么**：段末从单个 ▶ 扩为**一组两个 24px 圆钮**：`▶ 朗读` + `译`。位置仍是段落
最后一行行尾（右侧放不下落到行下右对齐），滚动跟随段落，仍是一个共享固定按钮、
不向宿主 DOM 插节点。段末**只有这两个动作**，不附标注/问 AI 等其它按钮。

**翻译怎么接**：不新建第二套翻译实现。`page-translate.js` 把 R71 的单段翻译核心抽成
`translateParagraphEl(el)`，`Alt+P`、按住 Shift 悬停、段末「译」三个入口共用它；
只暴露 `__magicLensParagraphTranslate(el)` 与 `__magicLensParagraphTranslateState(el)`，
资格闸/页内缓存/计费护栏/撤销语义都不复制。点「译」只发 **1 段** `translate-batch`
（`start(false)`，不会放大成整页计费）；再点撤销零请求，再点复活走页内缓存。

**不出现「点了才报错」**：状态接口对未翻译段落现场判资格（≥40 字符、CJK ≤30%、排除
代码/编辑器/扩展 UI），不合格返回 `n/a`，段末工具据此不渲染「译」——短标题只留 ▶，
与 `Alt+P` 同一口径。`译` 请求在途显示 `⟳`、已译显示 `is-done`（半透明，语义=再点撤销）。

**验证**：`node --check` 全过；契约守卫新增 R76 段（只两个按钮 / 状态机单源 / Alt+P 同函数）；
`ml-read-aloud` 增加「短标题无译 / 点译只发 1 段 / `is-done` / 撤销零新请求」断言后 PASS；
`guard.py` 19 行缺口 0；**浏览器全特性 19/19 PASS**。版本 0.8.38-202611271605 测试版。

**遗留**：真机 AC 10 条待用户（`r76-para-tools/ac/manual-ac.md`）；已随 **v0.8.38** 正式发布
（2026-11-27）。

## 2026-11-27（R77：发布正式版 v0.8.38）

### R77（用户：「release magiclens」）

**回应**：按 AGENTS.md §0.2 两段式执行正式发布，把 v0.8.24 之后攒批的 **R63–R76** 合成
正式版 **v0.8.38**。

**发布前闸门（正式发布态）**：`runner.py --repo magiclens --tier T1` **22/22 PASS**
（19 个浏览器特性 + 3 个静态守卫，0 FAIL / 0 SKIP，48s，报告
`reports/fnos-dev-T1-1795767375.json`）；`guard.py` magiclens 19 行缺口 0；`node --check`
全部扩展脚本通过。R75/R76 的手工 AC 中「视觉/手感」项需人眼，行为链路已由套件覆盖
（段末定位、▶→■→停止、译单段计费/撤销、缓存零请求等）。

**发布动作**：

- `2999bb7` chore(release)：`version_name` 去时间戳（`0.8.38-202611271605` → `0.8.38`）
  push `develop`。
- `b5329b4` release 合并提交：在 `origin/release` 头上 `--no-ff` 合并 `origin/develop`
  push `release`；合并后 `git diff --stat origin/develop HEAD` 为空（测的就是发的）。

**发布产物验证**：workflow run `45964579755` 成功（改动范围判定 docs-only=false）；
GitHub Release **v0.8.38**（Latest，2026-11-27T08:18:09Z），资产
`magiclens-extension-v0.8.38.zip`（148187 B），包内 `extension/manifest.json`
`version=0.8.38`、`version_name=0.8.38`。

**遗留**：真机装 v0.8.38 后按 `r75-page-read-aloud/ac/manual-ac.md`（10 条）与
`r76-para-tools/ac/manual-ac.md`（10 条）做视觉/手感抽查；PingCode 版本 Published 与
idea 回写待用户令（本仓 idea 未建）。

## 2026-11-27（R78：缺陷——气泡「译」点击无效 + Alt+P/段末工具识别不到 html-blob 正文）

### R78（用户：「这里点击翻译无效，快捷键也识别不到段落」（Google 支持社区截图））

- **根因 ①：点击气泡按钮会重开气泡，吞掉在途译文（content.js）**——气泡按钮的 `mouseup`
  冒泡到 `document`，旧 `onMouseUp` 无条件 60ms 后 `processSelection`；closed Shadow DOM
  的点击又不清页面选区，用户读完提示再点「译」时已越过 `claimSelection` 500ms 去重窗，
  `openBubble()` 重开并把 `current/seq/`「已选中…」文案重置，回包按 R68 判代规则被丢弃。
  真机表现就是「点『译』完全没反应」。
- **根因 ②：正文不在标准标签里（page-translate / page-speak）**——Google 支持社区帖子正文
  是 `<html-blob>…<br><br>…</html-blob>`，实测该页 `<p>` 数量为 0；`TEXT_TAGS`/`BLOCK_SEL`
  只认 `P/LI/…`，`closest()` 恒 null → `Alt+P` 只报「未找到可翻译段落」，段末 ▶/译 也不出现。
- **修复**：
  - `content.js`：`onMouseUp` 与 `onMouseDown` 同一道闸，`composedPath()` 命中任意
    `#magiclens-*` host 即忽略（不排 `processSelection`）。
  - `common.js`：新增 `__magicLensTextBlockSelector`（并入 `HTML-BLOB`）与
    `__magicLensClosestTextBlock()`（未命中时向上找最近的块级文本容器，兜住 div 正文站点；
    统一排除代码/编辑器/导航/页脚/地标 role）。
  - `page-translate.js`：`TEXT_TAGS` 引用共享选择器；`Alt+P` 改用共享解析器；整页发现遇到
    「html-blob 内含标准段落」时跳过外层，避免重复计费。
  - `page-speak.js`：`BLOCK_SEL` 并入 `html-blob`；悬停/右键改用共享解析器。
- **验证**：
  - `node --check` 四文件通过；`check-extension-modules.js` R71–R76 契约段全绿。
  - 集成套件同任务内同步：新增 `pages/google-community.html`（html-blob、0 个 `<p>`）；
    `ml-bubble-translate` 增「长选区点译 → 译文必须落进气泡」（去掉 mouseup 闸会 FAIL，
    已用旧文件反向验证）；`ml-shortcuts` 增 html-blob `Alt+P` 单段 + 撤销；`ml-read-aloud`
    增 html-blob 段末 ▶/译 + 单段翻译/撤销。`guard.py --repo magiclens` 19 行缺口 0；
    浏览器全特性 **19/19 PASS**。
  - 真实页面（CfT + 真实 Google 社区 URL + moon-well mock）：点「译」→
    `POST /vocabulary/reading/translate` 并渲染译文；`Alt+P` →
    `POST /vocabulary/reading/translate-batch` 并插入译文块；段末 ▶/译 贴末行行尾出现。
- **版本/状态**：`0.8.39-202611271639` 测试版；LLD `r78-blob-paragraphs/lld.md`、手工 AC
  `r78-blob-paragraphs/ac/manual-ac.md`（6 条）；L1 README / L2 design §26 / L3 两篇已回填。
  待真机验收；正式发布待用户确认。
