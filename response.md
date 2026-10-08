# response.md — 对话回应记录（仅保留最近 10 个 request 的回应）

> 归档索引：[response-R1-R10.md](response-archive/response-R1-R10.md) · [response-R11-R15.md](response-archive/response-R11-R15.md)（2026-10-07 R25 完成时补执行 R10/R20 漏掉的归档） · [response-R16.md](response-archive/response-R16.md)、[response-R17-R18.md](response-archive/response-R17-R18.md)（2026-10-08 R28 收口时搬移） · [response-R19.md](response-archive/response-R19.md)（2026-10-08 R29 完成时搬移） · [response-R20.md](response-archive/response-R20.md)（2026-10-08 R30 完成时搬移）

### R21（悬浮改为直接弹出完整划词气泡：不真实选中，规避点击跳转）

- **回应**：按用户反馈把 R20 的「小翻译卡」升级为「悬浮即显完整划词气泡」（v0.7.1-202610071045 测试版）——悬停生词 ~200ms 直接弹出带 译/详/朗读/认识/生词/AI 全部按钮的既有气泡，效果「类似选中」但**不开真实选区**：部分 HTML 元素（链接/标题）点击会跳转，悬浮零副作用；也不覆盖用户已有选区、无原生选区高亮。
  - **职责划分**：highlight.js 只做命中测试（caretRangeFromPoint + nodeRaws 查表 + 区间复验）与节奏控制；气泡生命周期归 content.js。新增钩子 `__magicLensShowWordBubble(word, anchor)`（按词开气泡：resetButtons → show(anchor,'hover') → current 直置 → autoTranslate 自动翻译）与 `__magicLensHoverLeave`（只收 hover 来源气泡，划选气泡不动）。
  - **来源互通**：content.js show()/hide() 带 `__magicLensBubbleSource`（selection/hover/null），onScroll 复用 hide() 同步来源（顺带修掉 R20 审查提过的 onScroll 内联复制漂移隐患）。
  - **状态机（自查补刀两处）**：同词微动不打扰已排定时器；换词立即切换气泡；离开 150ms 宽限内回归不闪、超时只收 hover 气泡；移进气泡保持。**①Esc/滚动视为主动关闭**——记下所在词（hoverDismissed），鼠标不离词不重开，否则 Esc 关不掉原地复活；**②✕ 关闭的残留态**——mousedown 落在气泡上不触发 cancelHover，hoverShownFor 残留会导致移回词上不重开，sameHit 分支改为校验来源非 hover 即重排。
  - **清理**：R20 的自绘悬浮卡（#magiclens-hover-host/ensureHoverUi/hoverCache 等）整体移除（含 page-extract.js 与 content.js selectionInfo 的对应排除项还原）；ml:translate 直连链路复用不变（金山直连百毫秒级）。
- **校验**：七个 JS 全过 `node --check`；manifest 0.7.1-202610071045（测试版，不触发发布）。
- **待用户验收**：①悬浮生词 ~200ms 弹完整气泡且自动出译文；②气泡上 译/详/认识/生词/AI/✕ 全部可用；③Esc 关闭后鼠标不动不复活，移开再悬停可重开；④链接里的生词悬浮出气泡、页面不跳转；⑤划选文本的气泡不被悬浮干扰。
- **总结**：
  - requests.md：占号 R21。
  - response.md：本条。
  - 冲突记录：无。
  - 未决事项：随 v0.6.x+R14 高亮批次一并提交（R19/R20 已说明的提交顺序约束）；验收通过后统一发正式版。

### R22（发布 release v0.7.1 + Chrome 商店上架材料）

- **回应**：按 R18 流程完成发布——
  - develop 提交发布批次（commit `12eacc6`，15 文件：R14 高亮 + R20/R21 悬浮 + R15-R19 并行批次 + 台账），manifest 清理时间戳为纯 `0.7.1`；push develop；
  - merge develop → release 分支推送，`release.yml` 触发成功（run 37567109100，12s）；
  - **Release 已上线**：tag `v0.7.1`，附件 `magiclens-extension-v0.7.1.zip`，https://github.com/haoshenqi-family/magiclens/releases/tag/v0.7.1 。
  - **商店上架材料**（见 `docs/webstore/listing.md`，可直接复制粘贴）：`PRIVACY.md` 隐私政策入库（商店必填 URL：github.com/haoshenqi-family/magiclens/blob/develop/PRIVACY.md）；单一用途声明、`storage`/`<all_urls>` 权限理由、数据披露口径、截图与宣传图规格清单、unlisted 先行 + 演示视频建议。上架操作本身需用户 Google 账号（$5 一次性注册费）在 Developer Dashboard 手动完成，AI 无法代办。
- **总结**：
  - requests.md：占号 R22。
  - response.md：本条。
  - 冲突记录：无。
  - 未决事项：商店账号注册与上传需用户手动操作；后续商店版本号需大于 0.7.1。

### R23（分发渠道决策：仅 GitHub Releases，搁置 Chrome Web Store）

- **回应**：已记录决策并同步文档——
  - `docs/design.md` §6 新增「分发渠道（R23）」：仅 GitHub Releases 分发（避免 $5 注册费、`<all_urls>` 深度审核与每次更新的审核维护），并写明固有限制（更新需手动下载 zip 重载，无自动更新通道）；
  - `docs/webstore/listing.md` 顶部标注搁置状态，材料（listing 文案/权限理由/截图规格）与 `PRIVACY.md` 原样保留，未来上架直接可用；
  - README 安装节补充分发说明。
  - 现有发布流程（R18 两段式：develop → release 分支 → 自动 Release + zip）不变，就是当前唯一且完整的分发通道。
- **总结**：
  - requests.md：占号 R23。
  - response.md：本条。
  - 冲突记录：无。
  - 未决事项：无。

### R24（magicbook 阅读页生词高亮无效：iframe 多文档支持 + 门控采样）

- **诊断**（证据链）：用户报 `/read/102/epub`（新概念英语85第三册）第 1/4 课高亮无效。
  ①解包 epub（fnOS magicbook 容器直读 Calibre metadata.db + zip）：60 课 toc.ncx/toc.xhtml 链接与
  `text/index.html` 内 60 个 `toc_N` 锚点全部可达且无重复——**书完好，排除目录死链**；
  ②ES 日志证实扩展已生效（11:26 对 login.tailscale.com 的 analyze 200 返回生词），但
  `bookName=magicbook.haoyuhang.top` 的 analyze **从未出现**；③读 `read.html` 与 epub.js：
  正文渲染在 epub.js 的同源 iframe 里，且页面 `<html>` 无 lang、meta description 为空、
  标题含中文书名 → 旧引擎（只扫顶层文档）+ 旧英文门控（title/meta/lang）双杀：扫描既不触发、
  触发了也看不见正文。「1 无效 4 无效」即第 1 课/第 4 课无高亮。
- **修复**（manifest `0.7.2-202610071324` 测试版，不触发发布）：
  - **highlight.js 多文档引擎**（lld.md §6）：`docStates: Map<Document, state>`——顶层与同源
    iframe（两层内）各持独立 Highlight 注册表（`new win.Highlight()`/`win.CSS.highlights`）、
    独立 constructable stylesheet、per-window IntersectionObserver、per-doc 交互监听
    （mousemove/click/mousedown/Esc/scroll/mouseleave）与 MutationObserver（汇入同一
    masterMutHandler）；Range 全部 `text.ownerDocument.createRange()`；悬浮/点词矩形经
    `tokRect()` 叠加 iframe 位置换算。
  - **首扫触发链**：文档绑定早于首扫（boot 即 syncDocs 预绑定）——epub.js 向 iframe 写正文时
    per-doc 观察者直接触发 scheduleSync→maybeScan，不再依赖顶层 mutation（审查 P0-1：
    初版 structureMo 只看顶层文档，iframe 内写入顶层不可见，晚渲染场景首扫仍漏）；iframe
    load 事件重绑换 document 的场景（审查 P1-3）。
  - **状态机**：`scannedKeys`（成功过，SPA 回来不重扫、靠 unknownSet 存量重亮）/
    `failedKeys`（gate 判否或请求失败，自动不再尝试、增量降级 familiar，popup 重扫 force 解除，
    teardown 清空）/`retriedKeys`（过短一次性 2s 重试）。首扫未成的 key 不发 familiar
    （防「同一本书两套口径」），被拒 key 例外直走 familiar（审查 P1-1：初版 popstate 清
    scannedOnce 会让中文路由的 familiar 增量永久空转，改为按 key 记账）。
  - **门控**：顶层信号 ∨ 整体采样 ∨ 逐文档正文采样（审查 P2-2：长中文壳占满采样头时书内英文
    仍可过闸）。
  - **iframe 交互**：悬浮同顶层；点词零副作用唤起持久气泡（`__magicLensShowWordBubble(word,
    rect, 'selection')`，不真实选中）；点空白/Esc/滚动经 `__magicLensHideBubble` 收起（content.js
    顶层 mousedown 够不到 iframe，审查 P1-2）；teardown 补收 hover 气泡（P2-4）。
  - 其余审查修复：retire 无条件 teardown（P2-3）、fireShow 零尺寸矩形校验（P2-5）、per-doc
    mousedown 对齐顶层收气泡语义（P2-6）、collectDocs 深度注释与实现对齐（P2-7）、
    rescanNodes 对无状态文档节点清册防泄漏（P2-1）。
- **校验**：全部 JS 过 `node --check`；独立 agent 交叉审查（1×P0 + 3×P1 + 12×P2，P0/P1 全修，
  P2 择要）；文档同步（lld.md §6 / design.md P1 / README / 本文件）。
- **待用户验收**：①重载扩展 → 打开 `/read/102/epub` 任意一课（含第 1/4 课）→ 生词波浪线出现；
  ②悬浮/点高亮词出气泡且可标认识/生词（全页含变形即时灭/亮）；③Esc/滚动/点空白能关气泡；
  ④popup「重新扫描本页」可用；⑤普通网页（含中文页）行为不回归。
- **遗留（R25 候选）**：iframe 内长句划选翻译不可用（selection 属 iframe 文档，顶层
  mouseup/getSelection 够不到；本次只覆盖单词点击与悬浮）。
- **总结**：requests.md 占号 R24；response.md 本条；冲突记录：无（R15-R23 系并行会话所记）；
  改动仅在工作区未 commit。

### R25（域名管理：在指定域名禁用 MagicLens）

- **回应**：功能落地（manifest `0.8.0-202610071945` 测试版，不触发发布），moon-well 零改动、不新增任何 permission。设计文档 `docs/feat/domain-management/design/lld.md`（US1 判定与门控 / US2 设置页名单 / US3 popup 本站开关），ADR 记于 `docs/design.md` §9。
  - **存储与语义**：`chrome.storage.sync` 新增 `disabledDomains: string[]`（与既有配置同库、随浏览器同步）；条目为归一化 hostname，匹配语义「该域 + 全部子域」，不做精确/仅子域两种模式（域名禁用的直觉语义就是整站别管，项目原则「尽量简单」）；端口不参与匹配（禁 localhost 即禁所有端口）。
  - **`common.js`（新增）**：`__magicLensNormDomain`（借道 URL 归一化：剥协议/端口/路径/尾点/`*.` 前缀，非法输入返 null）与 `__magicLensIsDisabledHost`（含子域匹配）；manifest content_scripts 头位挂载 + options/popup `<script>` 直挂，四个消费方共享一份实现。node 冒烟 26 用例全过（含 `notexample.com` 不被 `example.com` 后缀误伤、IPv6/尾点/非法输入）。
  - **门控**：content.js 主引擎 IIFE 改为具名 `startMainEngine()`，由 storage 回调判定后启动（禁用站零 UI 零 DOM 监听零注入）；OIDC 登录回调捕获不受域名禁用影响（禁 moon-well 域不该废掉自己的登录回调）；highlight.js 启动时把判定固化进 `siteDisabled` 并入 `shouldEngineRun()`——Why 不只挡 boot：它有 storage.onChanged/Alt+U 等现成「重开路径」，禁用站会被后续全局开关变化复活；chat.js 零改动（唯一入口是划词气泡「问 AI」，content 禁用即天然禁用）。**生效语义统一「刷新页面后生效」**：名单只决定新加载页面，不做运行中拆装（低频配置动作，可逆化重构风险与收益不成比例）。
  - **UI**：设置页「域名管理」块（输入任意形态自动归一化、幂等添加、逐项移除、回车即添加、storage 为唯一事实源 + onChanged 渲染、全 textContent 组装）；popup 新增「本站启用」checkbox（非 http(s) 页隐藏；状态按 isDisabledHost 真实判定，恢复时移除所有覆盖本站的父域条目，否则勾上了仍被父域禁着自相矛盾）；「重新扫描本页」在本站禁用时报真实原因。
  - **交叉审查**（独立 agent）：1×P1 + 7×P2，无 P0。P1 = popup/options 的 `[hidden]` 被 author CSS 压过（`label{display:flex}` / `button{all:unset}` vs UA hidden 样式，content.js 曾修过同款陷阱）——两处补 `[hidden]{display:none!important}`（顺带修掉 options 登录按钮显隐的既有失效坑）。P2 择修：`ml:hl-toggle` 在禁用站 no-op（回 ok:true 防 background fallback 代翻全局开关、殃及其它站点）、`ml:hl-rescan` 禁用站回真实原因、popup hostname 过归一化剥尾点。余下 P2（storage 读改写无事务、startMainEngine 多暴露一个隔离世界全局等）记录在案不阻塞。
- **校验**：八个 JS 全过 `node --check`；manifest JSON 解析通过；助手函数 node 冒烟 26 用例全过。
- **待用户验收**（真机手工清单）：①设置页添加 `example.com` → 打开 example.com 及其子域页面：无划词、无高亮、popup 显示「本站启用」未勾选；②popup 取消勾选禁用当前站 → 刷新后插件静默；③重新勾选恢复 → 刷新后功能回来；④名单外的站点行为完全不回归；⑤Alt+U 在禁用站按下后，其它站点的生词高亮开关不受影响。
- **总结**：requests.md 占号 R25；response.md 本条；冲突记录：无（R24 遗留所提「R25 候选：iframe 内长句划选」未被本条占用实现，仍为待办，后续按实际需求续编号）；顺手补执行了 R10/R20 触发点漏掉的 response.md 归档（R1-R15 原样搬入 response-archive/，本文件恢复 10 条窗口）。改动未 commit。

### R26（跨项目 L1-L3 文档评审与产品评估，只改文档）

- **范围**：配合家族根 `docs/product-review-2026-10-07.md`，核查本仓库 README ↔ docs/feat ↔ manifest 三方对齐并修正漂移。**未触碰 extension/ 任何文件**（工作区里 v0.7.2/v0.8.0 在途改动与 response-archive/ 均系 R24/R25 并行会话产物，保持原样）。
- **修正清单（5 处）**：design.md §3 鉴权表加更新注（R118/R119 快照：现行 v0.3.0 起 OIDC 登录化、mk- key 弃用、token 30/90 天——R101）；chrome-extension lld US3/US4 状态回填（US3 v0.2.0 已交付、US4 moon-well R97 已上线）+ §6.3 鉴权表 7d/30d→30/90d 并标注 mk- 已弃用；vocab-highlight lld §3/§5「仅顶层 frame 不进 iframe」与 §6 R24 多文档自相矛盾→统一为「同源两层内 iframe 参与，跨源/更深层不进」；README 待办 P1 收窄（生词标注已随 v0.5.0 交付，剩段落整页翻译）；webstore/listing.md 加上架前勘误（现行 release.yml `zip -r … extension` 产出 zip 根层是 extension/ 目录，与商店「manifest 在根层」要求不符，上架需改打包方式并刷新版本锚点）。
- **遗留（代码类不动）**：`extension/background.js:5` 注释仍写 access 7d/refresh 30d，属代码注释按任务边界未改，建议下次改扩展时顺手更新。
- **总结**：requests.md 本条 R26；response.md 追加后仍在 10 条窗口（R25 已做过 R1-R15 归档）；冲突记录：无。

### R27（AGENTS.md 文档规范升级：三级体系落表）

- **改动**：AGENTS.md 文档规范节升级为三级表——L1 `README.md`、L2 `docs/design.md`（ADR 兼任 HLD，单模块纯前端不另建 hld 目录）、L3 `docs/feat/`；目录表补 `docs/webstore/` 行（原表遗漏）。新增纪律三条：交付三问（能力→README+版本递增 / 契约→design.md 追加决策 / LLD-AC 状态回填，附 R26 US3/US4 滞留先例）、数值同源（以 moon-well 现行契约为准，附 7d/30d 三处滞留先例）、历史文档只标注不重写。既有「一致性纪律」（README↔feat↔manifest 三方对齐）保留。
- **总结**：requests.md 本条 R27；response.md 追加本条后共 10 个条目，恰在窗口内（下次写入即触发归档）；冲突记录：无。

### R28（排查：Documentation 标记认识后刷新仍划线——只排查未修码）

- **回应**：标记本身已落库生效，问题出在**写读词形大小写不对称**：标记按页面原始词形存（`Documentation` 大写 D），扫描判定全按小写 token 比对，服务端把这条认识标记「看不见」，落到词档兜底后仍判生词。
- **证据链**：
  ①写链路：扩展划选/悬浮取**页面原文词形**（content.js:296 / highlight.js:659 传 `tok.raw`），background.js:330-337 原样拼 `GET /vocabulary/known/Documentation`，`VocabularyService.kill`（moon-well）**原样落库**——`vocabulary_notebook` user 1 存在 `word='Documentation'`（大写 D）familiarity=7 行（id 8826），今天 11:47 首标、22:48 重标均写的是它；
  ②读链路：analyze 服务端 `extractWords` 对整页重新分词并 `toLowerCase`（ReadingVocabularyService.java:289），token 全小写；`WordFamilyJudge.judgeOne:85` `notesByWord.get("documentation")` 大小写敏感 **miss 自身标记**；词族索引 `lemmaCandidates("Documentation")` 因 `^[a-z]+$` 守卫（WordInflection.java:31，扩展端 highlight.js:49 同款）对大写词退化为自身，与 token 候选 `{"documentation"}` **永不相交 → 词族桥接也 miss**；
  ③兜底：`magicbook_word_level` 中 `documentation`=TOEFL（level 6）> 用户 hard_level → 判 UNKNOWN 返回；
  ④ES 日志铁证：22:48:09 `GET /vocabulary/known/Documentation` 200 落库后，22:49:04 `/vocabulary/reading/analyze` 仍返回 `{"word":"documentation","unknown":true}`（当日 11:12/11:53/20:15/22:47 各次扫描全为 unknown:true）；
  ⑤无缓存层干扰（WordLevelCacheService 只缓存全局词档；扩展端 unknownSet 刷新即重建）；magicbook 端写链路自带小写归一（epub.js:445）故从未复现——扩展端独有此缺口。
- **根因**：R107 词族判定只对齐了「判定口径的词族化」，未对齐「写入口径的大小写」；扩展端标记请求与落库均不归一大小写，扫描侧全小写，两侧永不匹配。
- **次要缺口（同构隐患，本例非触发者）**：词族展开仅屈折（s/es/ed/ing/er/est），派生词形不在口径内——`document` 与 `documentation` 互不覆盖；即使修好大小写，标 `document` 也不会覆盖 `documentation`（属 R16 已文档化口径的边界，变更需 moon-well `WordInflection` 与扩展端 `lemmaCandidates` 双侧同步）。
- **修复方向（待用户确认后实施）**：A. 最小闭环——moon-well `VocabularyService.kill/unknown` 入口（或扩展端 background.js ml:mark 发出前）统一小写归一 + 存量脏数据清洗（`UPDATE vocabulary_notebook SET word=LOWER(word)`，含本例 id 8826）；B. 派生词形入词族口径（口径变更，双侧同步+单测）。
- **总结**：requests.md 占号 R28；response.md 本条，R16 原样搬入 response-archive/response-R16.md、R17/R18 搬入 response-R17-R18.md（窗口保持 10 条）；本次只排查，未改任何代码与数据。
- **实施回填（用户裁决「只修A」，2026-10-08）**：方案 A 已落地——①moon-well R116（commit e30e13b）：`VocabularyService` 新增 `normalizeMarkWord`（与 familiar 同口径小写归一），kill/unknown 入口调用，补 2 单测、全量 800 测试绿，push develop 走 fnOS 链部署；②存量清洗：fnOS `magichouse.vocabulary_notebook` 全表 435 行大小写混排 `UPDATE word=LOWER(word)` 归零（不止本例，含 code/mode/cache 等近期扩展标记与早期人名地名；flare/militant 历史重复行未动，判定端 toMap 已合并），清洗后现行判定即能匹配小写行，**无需等新版本上线 Documentation 已不再划线**。扩展端零改动、版本不变（延续 R16 先例）。方案 B（派生词族）未做。部署插曲：fnOS 凌晨 03:01 DHCP 续租丢失默认路由致 webhook git-fetch 失败（ai-fix 亦因智谱账户欠费未接起），已临时补路由并手动重跑构建；持久化修复（fnOS 静态网关/路由器 DHCP + ai-fix 充值）待用户处理。

### R29（执行文档统一方案：拓扑指针化 + 归档规则修订）

- **冲突记录**：本条原占 28，与并行会话 R28「Documentation 标记认识后仍划线」撞号（该单已由 moon-well R116 修复闭环），按编号纪律续编空号 29。
- **P1-B**：AGENTS.md「内网设备」表指针化——拓扑事实以 ops 仓库与 app-manager truth/server.md 为唯一权威源，本表收敛为一行速查（保留 fnOS=moon-well :8082、ubuntu naive :12811 两个本项目相关坐标）。
- **P2-D**：归档规则修订为「写入即检查、超 10 立即搬移」；本条回应使窗口超 10，按新规则当场把 R19 条目原样搬移至 response-archive/response-R19.md 并登记索引（新规则首次执行）。
- **总结**：requests.md 本条 R29（原占 28 撞号续编）；冲突记录见上。

### R30（单测逻辑改两级：开发态部分验证，正式发布才走全量清单）

- **AGENTS.md §2 编码实现·交付标准**：新增「两级验证闸门」子条——本项目无自动化测试框架，闸门落在 §3 手工验收清单上：**开发态（默认）**只实测本次改动涉及的 AC 条目；**正式发布态**（用户显式提出「发布 / 上线」，即 §0.2 去掉时间戳后缀并 merge `release` 那一步）必须把 §3 清单逐条走全并全过。
- **跨仓同步**：moon-well R119 / magicbook R131 / app-manager R36 把「全量单元测试」拆成开发态部分 + 发布态全量两级；本仓以手工清单对应同一口径。与既有 §0.2 两段式版本规则天然吻合（带时间戳后缀的测试版不触发发布）。
- **归档**：本条使窗口超 10（原 R20–R29 共 10 条），按「写入即检查、超 10 立即搬移」当场把 R20 条目原样搬移至 `response-archive/response-R20.md`（逐字节 diff 校验一致）并登记索引，窗口回到 10 个 request。
- **总结**：requests.md 本条 R30；response.md 追加本条并完成上述搬移；冲突记录：无（30 未被并行占用）。只改文档，未动扩展代码与 manifest 版本。
