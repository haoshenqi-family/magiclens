# response.md — 对话回应记录（仅保留最近 10 个 request 的回应）

> 归档索引：[response-R1-R10.md](response-archive/response-R1-R10.md) · [response-R11-R15.md](response-archive/response-R11-R15.md)（2026-10-07 R25 完成时补执行 R10/R20 漏掉的归档） · [response-R16.md](response-archive/response-R16.md)、[response-R17-R18.md](response-archive/response-R17-R18.md)（2026-10-08 R28 收口时搬移） · [response-R19.md](response-archive/response-R19.md)（2026-10-08 R29 完成时搬移） · [response-R20.md](response-archive/response-R20.md)（2026-10-08 R30 完成时搬移） · [response-R21-R22.md](response-archive/response-R21-R22.md)（2026-10-08 R32 完成时搬移） · [response-R23-R24.md](response-archive/response-R23-R24.md) · [response-R28.md](response-archive/response-R28.md) · [response-R25.md](response-archive/response-R25.md)（2026-10-10 R35 完成时搬移） · [response-R26.md](response-archive/response-R26.md)（2026-10-10 R36 写入触发轮转搬移） · [response-R27.md](response-archive/response-R27.md)（2026-10-10 R38 写入触发轮转搬移） · [response-R29.md](response-archive/response-R29.md)（2026-10-11 R40 写入触发轮转搬移） · [response-R30-R31.md](response-archive/response-R30-R31.md)（2026-10-11 R41 集成时窗口超限搬移） · [response-R32.md](response-archive/response-R32.md)（2026-10-13 R43 写入触发轮转搬移）

### R33（整理 requests.md：已完成条目按区间归档）

- **回应**：R01–R27（28 条）与 R29–R31（3 条）共 31 条确认完成，原样搬移至 `requests-archive/`（只搬原文、不改写、不改编号）；保留 R28（方案 A 已上线；方案 B 派生词族口径未做 + fnOS DHCP 丢路由持久化修复遗留）与 R32（v0.8.1 测试版在途，真机验收与正式发布未完成），各附归档整理注。编号纪律不变：归档不释放编号，新任务按全史最大编号 +1（32 → 本条 33）。AGENTS.md「requests.md 永不归档」条款同步废止为区间归档制，目录表补 `requests-archive/` 行。验证：原 33 条 = 归档 31 + 保留 2 + 新占号 1，计数守恒。
- **总结**：requests.md 占号 R33；response.md 本条；冲突记录：无。

### R35（bug 修复：伴读 AI 永远「未配置服务地址或 Token」，重新登录无效）

- **诊断**（证据链）：chat.js 自带 `getCfg()` 直读 `chrome.storage.sync`，默认对象里 `apiBase` 与 `token` 两个字段均为空串（原始代码为键值对字面量，2026-10-10 R38 经用户裁决改为键名表述——安全护栏对含空赋值形态的文件写入一律拦截，语义不变）；发送前守卫 `if (!cfg.apiBase || !cfg.token)` 一票否决。而 v0.3.0 起设置页已无地址/Token 手动配置项，`apiBase` 公网域名只作为 background.js `DEFAULT_CFG` 兜底存在——storage 里根本**没有 `apiBase` 这个键**（仅 v0.2 存量内网地址会被一次性迁移写入；全新安装永不写入），登录回调（content.js）也只写 `token/refreshToken`。于是：伴读面板永远命中 `!cfg.apiBase` → 报「未配置服务地址或 Token」；点「重新登录」走完 OIDC 只补了 token，`apiBase` 仍为空 → 报错不变，即用户所见「跳转登录也不行」。其他功能（翻译/标记/详解/高亮）全部经 background `callApi`（其 `getCfg` 有域名兜底）故不受影响，与「插件明明已登录」的直觉自洽。次要缺口：chat.js 要求 `token` 非空才放行，而 `callApi` 允许 token 空 + refreshToken 有效（401 时静默刷新），两侧口径不一致。
- **修复**（manifest `0.8.3-202610101524` 测试版，不触发发布）：
  - background.js 新增 `ml:auth` 消息：凭据只此一处出——返回 `{ apiBase, token }`；token 空而 refreshToken 有效时先经 `/auth/refreshToken` 静默刷新（超时不清凭据只报稍后重试、确定性失败清凭据引导重登，与 `callApi` 的 401 分支同语义）；未登录返回 `auth: true`。
  - chat.js 删除本地 `getCfg`，原 `api()` 的消息收发泛化为 `bg(msg)`（保留 R13 的 Invalidated 分类），JSON 面板端点与 SSE 前置凭据解析都走它；SSE 直连仍留在 content script 消费（LLD 决策 A1 不变），URL/Bearer 改用 `ml:auth` 返回值；错误分支的「重新登录」链接改按 `resp.auth` 判定（扩展重载类错误不再误挂登录链接）。
  - LLD 变更记录追加本条；apiBase/凭据出口收敛的约束写入 chat.js 与 background.js 注释。
- **验证**：`node --check` chat.js/background.js 通过；分支推演覆盖 未登录（auth 链接）/ token 空+refresh 有效（静默刷新后放行）/ 刷新超时（保凭据提示重试）/ 刷新被拒（清凭据+重登链接）/ 扩展重载（刷新页面提示，无登录链接）。真机清单（需用户 chrome://extensions 重载后实测）：① 退出登录 → 问 AI 提示「未登录，请先在设置页登录」+ 链接；② 点链接完成 OIDC 登录 → 回页直接发送 → SSE 流式回复正常；③ 会话列表/记忆/学情面板正常；④ 划词翻译等其他功能回归正常。
- **总结**：requests.md 占号 R35；response.md 本条；归档 R23–R24（窗口回到 10 条内）。冲突记录：与 R34（iframe 划词，另一会话在途）并行——manifest.json 版本竞态（R34 会话 15:23 写入 `0.8.2-202610101523`，本会话按「每次修改完成递增」续增为 `0.8.3-202610101524`）；本会话未触碰 content.js/highlight.js。
- **更新（2026-10-10 发布）**：用户真机验收通过后已发正式版 **v0.8.3**（run 38035576570，Release 含 magiclens-extension-v0.8.3.zip，zip 内 manifest version/version_name 均为纯 0.8.3）。发布锚定 9e57c04（R34+R35），**不含其后未验收的 R36 选区中继重构**（c64b541 待其自行验收走 v0.8.4）；去时间戳提交 a0ccbc8 仅落 release 分支（develop 已被 R36 前移、避免非快返推送），下次发版 merge 时 manifest 以新版为准。

### R34（补 iframe 内拖选划词：阅读器里选中单词没反应）

- **用户报告**：magicbook 阅读器里「选中单词没有反应，但波浪线正常生成」，并问是否是后端接口改动导致。
- **结论：不是后端，是插件自身的覆盖缺口**。`manifest.json` 未声明 `all_frames` → content.js（气泡与划词流程）只在顶层文档运行；highlight.js 的 per-doc 监听只有 `mousemove/mousedown/click/keydown/scroll`，**没有 `mouseup`**；而 iframe 内的 mouseup 不跨文档冒泡、其选区也不属于顶层 `window.getSelection()`，于是 `mouseup → processSelection → selectionInfo` 一次都没触发。波浪线之所以正常，是因为高亮引擎本就按文档实例化（往每个同源 iframe 注入 `::highlight()` 样式表 + 各自的 IntersectionObserver）；hover 生词与点高亮词能弹气泡，是因为 R24 专门搭了 `__magicLensShowWordBubble` 这条跨文档钩子——**当年只搬了这两条交互，选区那条从来没接进来**。
- **该缺口原本有账**：`docs/feat/vocab-highlight/design/lld.md` §6.5 写着「iframe 内长句划选翻译不可用……阅读场景影响小」并列为 R25 候选，一直没闭。magicbook R141/R143 把口径定为「只隐藏 magiclens 已实现的部分」并下线内置气泡后，这个「影响小」的判断直接变成用户可感知的故障。
- **交付（commit `ba0eaa8`）**：highlight.js 给 **iframe 文档单独**加绑 `mouseup`（延迟 60ms 等选区稳定；顶层不绑——与 content.js 同绑会双开气泡、双发翻译请求，两个入口算出的矩形一个原生一个换算、未必逐字相等，500ms 去重兜不住），取选区文本 + Range 矩形按 `tokRect` 同款换算叠加 iframe 偏移，经新钩子 `__magicLensShowIframeSelection(text, rect)` 交顶层；content.js 把 `processSelection` 的呈现部分抽成共用 `openBubble(text, word, rect)`，词形前缀口径、2000 字符上限、`autoTranslate` 与译/详/🔊/认识/生词/问 AI 全部复用同一条链路，不复制第二套语义。文档同步：lld.md §6.4/§6.5、README 功能表、design.md §11。
- **验证状态（诚实）**：本项目无自动化测试；`node --check` 两文件通过、相邻同文行扫描无异常，但**扩展装载与真机效果未验**——需你在 `chrome://extensions` 重新加载插件并刷新阅读页（插件自带旧脚本退役保护，不刷新不生效），然后拖选书页里任意单词应出气泡、点空白/Esc 能收。AGENTS §3 手工清单的「划词→翻译展示」此前只在顶层文档验过，iframe 路径属新增覆盖面。
- **版本冲突记录**：manifest 的 `version/version_name` 不由我的 commit 携带——写码期间 R35 会话已把它推到 `0.8.3-202610101524`，其 `background.js`/`chat.js`/`docs/feat/chrome-extension/design/lld.md`/`requests.md#35` 仍是未提交在途改动，我不代为收编；我的代码已在工作区，随那个版本号一起被浏览器加载即可。
- **代提交记录**：本条下方的 response.md 窗口轮转（R23、R24 原样搬至 `response-archive/response-R23-R24.md`）系 R35 会话在 2026-10-10 做的，已逐字核对为原文搬移、未改写，随本条一起入库；另 R32 会话 2026-10-08 未提交的 v0.8.1「错误文案卫生」已由 commit `b74cea0` 单独收编并注明其自记验收状态。
- **总结**：requests.md 占号 R34（`a94de1c` 单独锁号；占号时确认 34 未占用，随后发现 35 已被并行会话占用，按不回改纪律保留）；response.md 本条，当前窗口 10 条、无需再搬。

### R36（iframe 选区与生词高亮解耦：all_frames 选区中继）

- **触发**：用户要求「不考虑顶层/iframe 那层分工，未来 magicbook 阅读能力可能移植进 magiclens」。据此复核 R34，查出真缺陷——`highlight.js:35` 的 `shouldEngineRun()` 要求 `!siteDisabled && cfg.enabled && cfg.hlEnabled && token` 才执行 per-doc 装配（`syncDocs` 只在它为真时跑），而我把 iframe 的 `mouseup` 绑在那套装配里：**关掉生词高亮（popup / `Alt+U`）或未登录时，`teardownDoc` 摘掉监听，阅读器里的划词跟着一起没**。划词是主能力、生词高亮只是旁边一个开关，生命周期绑错了。
- **交付（v0.8.4）**：新增 `extension/selection-relay.js`，manifest 里作为第二条 content_scripts 注入项、`all_frames: true`、只挂它自己——非顶层文档监听 `mouseup`/`touchend`（60/80ms 与顶层同节奏），取本文档选区文本 + Range 矩形，逐层累加 `frameElement` 矩形换算到顶层视口，经 `ml:selection` 上报；顶层直接 return（避免与 content.js 双绑导致双气泡、双发翻译请求）。`background.js` 的 `ml:selection` 用 `chrome.tabs.sendMessage(sender.tab.id, …)` 投回同一 tab——content script 用不了 `chrome.tabs`，这一跳必须；不指定 `frameId` 即投全部文档，中继不认识该类型自行忽略，**因此不必新增 `"tabs"` 权限**，R25 的「不新增 permission」约束保持。`content.js` 把 R34 的跨文档钩子收归内部 `openIframeSelection`，由新增的 `runtime.onMessage` 监听调用，仍复用同一 `openBubble`。`highlight.js` 撤掉 R34 的 `mouseup` 绑定与 `pushIframeSelection`。
- **骨架意义（对齐移植意图）**：「帧内采集 → background 路由 → 顶层呈现」此后与高亮无关；朗读、标记、详解、整页翻译每往 magiclens 移一项，只是给这对中继加一个消息类型，不必再把能力塞进 `shouldEngineRun()` 的生命周期里。收起语义复用既有路径（`highlight.js:182` 的 `hideSelectionBubble` → `window.__magicLensHideBubble` 收的就是顶层那一个气泡），无需新增分支。
- **文档**：`docs/design.md` 新增 §12（根因 + 为什么不新增权限 + 边界），§11 加「已被 §12 取代」更新注记、原分析保留；`docs/feat/vocab-highlight/design/lld.md` §6.4 同样加注；README 功能表版本号改指 v0.8.4。
- **验证状态（诚实）**：`node --check` 四个 JS 全过、manifest 解析通过（两条注入项：5 文件顶层 / 1 文件 all_frames）。**扩展装载与真机效果未验**——需在 `chrome://extensions` 重新加载（新增注入项必须重载，旧页面还要刷新），然后：① 阅读器正文拖选任意单词出气泡，译/详/🔊/认识/生词/问 AI 可用；② **用 `Alt+U` 关掉生词高亮后，划词仍要可用**（本次修的正是这条）；③ 普通网页划词无变化（无双气泡、无重复翻译请求）；④ iframe 内点空白/Esc/滚动能收起气泡。
- **并发记录**：R35（聊天 token 修复）已自行提交 `4090202`，manifest 版本从它的 `0.8.3-202610101524` 递增到 `0.8.4-202610101538`，未改写他人内容；工作区本轮只有 4 改 + 1 新增。
- **总结**：requests.md 占号 R36（`d296f61` 单独锁号）；response.md 本条使窗口达 11 条，最旧条目按区间纪律原样搬至 `response-archive/` 并在索引登记。

### R36 补记（2026-10-10：v0.8.5 正式版已发布，真机验收仍未回）

- **发布动作**：develop 的 `version_name` 去时间戳（`0.8.5-202610101609` → `0.8.5`，commit `40ce473`）并推送 develop；随后 merge develop → release 并 push（合并 commit `4091160`），`release.yml` run `38040355307` 11s success，GitHub Release **v0.8.5** 已生成并附 `magiclens-extension-v0.8.5.zip`（`gh release view` 核对：draft=false、asset 在位）。
- **合并冲突记录**：`extension/manifest.json` 版本字段冲突（release 侧是发布提交写的 `0.8.3/0.8.3`，develop 侧是 `0.8.5/0.8.5`）——按发布意图取 develop 值解决，其余字段无冲突；解决后复核合并树：注入项两条 `(5 文件, all_frames=false)` 与 `(1 文件, all_frames=true, match_origin_as_fallback=true)`、`selection-relay.js` 在位、`background.js` 有 `ml:selection`、`content.js` 有 `ml:openSelection`、`highlight.js` 无残留 `mouseup` 绑定，六个 JS 全部 `node --check` 通过。
- **并发处理**：merge 与 push 全程在 `git worktree`（/tmp/ml-release）里完成，**没有在并行会话共用的工作目录切分支**；本地 `release` 指针落后于 `origin/release` 且确认是其祖先，用 `merge --ff-only origin/release` 对齐而非 reset。完成后 worktree 已移除。
- **诚实状态**：本轮修复（`match_origin_as_fallback`）的**真机效果尚未回收**——用户上一轮反馈的是 v0.8.4 的表现（波浪线正常、拖选无反应），我在其后定位到 about:srcdoc frame 不被注入并修好、由用户指示「发布一下」即发版。Release 说明里没有写「未验」，因此下面这条要记住：若用户回报阅读器仍无反应，按我给的探针分流——书本 frame 上下文里 `window.__magicLensRelayLoaded` 为 `undefined` 就放弃子文档注入路线、改回「顶层伸手绑定但脱离 `shouldEngineRun()`」；为 `true` 就查 `ml:selection → background → ml:openSelection` 这一跳。修复后需再发一版（v0.8.6），因为 v0.8.5 已经是公开产物、不便改写。
- **窗口**：本补记属同一 request（R36），未新增条目，response.md 仍为 10 条。

### R38（为四个项目添加 worktree 使用说明：临时模式 vs 占用池模式）

- **结论与依据**：选定**方式一「一任务一临时 worktree，合并后即删」**（收尾闸门 + 鰁任务例外登记），不采用方式二「固定 worktree 池循环占用」。依据是本机实证：moon-well 2026-10-10 实测两个已完全合并的 worktree 无人收尾、一个落后 origin/develop 3 提交、其中 feat/r145 还带未提交改动——池模式三大风险（残留继承/漂移腐化/占用无判定）本机已各有一例；而 magicbook R144 靠干净 worktree 复跑才把 25 个测试失败定性为本地运行态污染，干净检出本身就是被验证过的价值。本仓无构建链，worktree 即装即用，冷启动不构成选池模式的理由。
- **落地改动**：家族根 `AGENTS.md` 新增「Git Worktree 开发纪律」统一口径节；本仓 AGENTS.md 新增「🔀 Git Worktree 使用规范」节——命令模板（从 `origin/develop` 切、`<type>/r<编号>-<slug>` 命名、仓库外兄弟目录）、收尾闸门（merge → `worktree remove` → `branch -d`，只用小写 `-d`）、发布 merge（develop → release）建议在临时 worktree 内完成（R36 先例）；发布流程本身不变。R35 节一处代码空值字面量经用户裁决改为键名表述（护栏对含空赋值形态的整文件写入一律拦截，语义不变，见该行注）。
- **编号说明**：原按同源预留 R37，占号时发现已被并行会话的「能力握手标记」（magicbook R146 配套）占用，按纪律续编 **R38**；同源任务 moon-well R146 / magicbook R147（同理被抢号续编）/ app-manager R38。
- **窗口**：本条写入触发轮转——R27 节原样搬至 `response-archive/response-R27.md` 并登记索引，窗口保持 10 个 request（R28–R38，R36 含补记）。
- **总结**：requests.md 占号 R38；response.md 本条；冲突记录：R37 编号冲突（已按纪律续编，未回改他人条目）。本任务只改文档与对话记录，未动任何代码与 manifest（版本号不变）。

### R39（真机两问题：`Error://(:0)` 与「译点几下就卡死」）

- **用户报告**：装上 0.8.6 后控制台出现 `Error://(:0)`；阅读器里选中一个单词后，「译」点几下就卡死。
- **卡死根因（代码级，非推测）**：`content.js` 的 `translate()` **没有在途守卫**，`background.js` 的 `ml:translate` 也没有去重——每次点击都实打实发一条请求（单词走金山+词形还原，短语/句子走 moon-well LLM，一条可能十几秒）。连点就是把慢响应一个个压进气泡、并把 moon-well 免费档并发占满，表现为一直转圈的「卡死」。这是扩展既有缺陷，但 R36/R37 之后阅读器里的划词第一次真正高频走这条链路，所以现在就暴露了。
- **修复**：
  - `translate()` 加 `translateInflight`（同文本在途时点「译」直接忽略），完成回调里按文本解锁；`hide()` 与每次 `openBubble()` 都复位锁——这样即使某条请求因扩展重载永久不回（`askBackground` 在 invalidated 分支不调 onResult），也不会把这个词此后锁死。
  - `Error://(:0)` 归因到「扩展重载后残留在页上的旧副本」：孤立世界里抛出的 `Extension context invalidated` 没有源文件与行号，就显示成这种无名错误。`selection-relay.js` 改为一次性 `try getManifest` 失败即整体不注册；`sendMessage` 包 try/catch，抛错就 `retire()` 摘掉自己的监听并**收回 `data-magiclens-selection` 标记**（宿主的内置气泡因此能立刻回来，而不是留一个不会工作的空声明）；`highlight.js` 的 `markTakenOver()` 同样吞掉失效异常。
  - 顺带修一处我自己引入的漏洞：`retireOrphan()` 原来只摘 DOM 监听，R36 新加的 `chrome.runtime.onMessage` 监听摘不掉（匿名箭头），退役副本仍会接住 `ml:openSelection` 并在已 remove 的宿主上开气泡。现改为具名 `function onRuntimeMessage`（声明提升，退役路径任何顺序都能引用）并在 `retireOrphan()` 里 `removeListener`。
- **验证状态（诚实）**：`node --check` 四个 JS 全过；**未做真机验证**——扩展装不进这台自动化浏览器，且 magicbook 阅读器正文在自动化浏览器里渲染不出来（`file.epub` 200 但 iframe 不产生，控制台无 JS 报错，换书同样）。需要你在自己 Chrome 里重载 0.8.7 后验三件事：① 连点「译」不再叠请求（DevTools Network 里 `ml:translate` 对应的那次 moon-well/金山调用应当只有一条在途）；② 控制台不再出现 `:0` 那类无名错误；③ 重载扩展后旧标签页刷新前不应再有报错。
- **版本**：manifest `0.8.6 → 0.8.7-202610110826`（测试版，不触发发布）。0.8.6 已推 origin/develop 但**未发 GitHub Release**，所以线上扩展 zip 仍是 v0.8.5——它不写接管标记，magicbook 的探测版已上线，两者会同时出现（双气泡、双波浪线），**请尽快重载到 0.8.7**。
- **总结**：requests.md 占号 R39（`e0eda8e` 单独锁号）；本条写入使窗口达 11 个 request，最旧的 R28 原样搬至 `response-archive/response-R28.md` 并在索引登记；冲突记录：无（39 未被占用，顶端他人 commit 未动）。

## 2026-10-11（R40：金山直连查词补报四股台账）

### R40（background.js 直连命中上报 /learning/strands/lookup；随 moon-well R152 端点）

- **交付**（worktree `../magiclens-lookup-report`，分支 `feat/r40-lookup-report`，基于 origin/develop a73fd95；worktree 驻留待用户确认）：`ml:translate` 的 iciba 直连命中分支加 `reportLookup(text)`——fire-and-forget POST `/learning/strands/lookup {word}`（复用 callApi 的 Bearer 与 401 静默续期），会话内 Set 去重（SW 挂起重置由服务端同词同日 doc id 幂等兜底），失败静默不打断翻译快路径。miss 回退路径本经 moon-well（logWord→LOOKUP_DAY）无需处理。
- **语义**：纯遥测——moon-well R152 端点只发 LOOKUP_DAY 事件（canonical 归一），不建生词本行、不建词典文档；直连命中因此计入词汇股而零建档副作用。
- **版本**：0.8.7 → **0.8.8-202610111039**（测试版：带时间戳不触发发布，`chrome://extensions` 重载即用；正式发布仍走用户确认 + release 分支两段式）。
- **README（L1）**：API 契约速查表补 `/learning/strands/lookup` 一行。
- **总结**：requests.md 占号 R40；本条为回应；冲突记录：无。

### R41（worktree 规范微调：merge 后保留待验收，验收通过后删除）

- **用户指令**：不要 merge 即删除 worktree，改为 merge 后保留等用户验收，验收通过后再删除。规范主体（临时 worktree、非占用池、无构建链即装即用、发布 merge 在 worktree 内做）不变，只改收尾时序。
- **落地改动**：家族根「Git Worktree 开发纪律」收尾闸门改两段式；本仓 AGENTS.md 收尾闸门同步微调，新增「验收期驻留（正常状态）」条——本仓验收方式：`chrome://extensions` 从该 worktree 目录「加载已解压的扩展程序」实测；验收发现新问题时在原 worktree 内继续修（manifest 版本按 §0.2 再次递增），修完重新 merge 后再等验收。
- **窗口**：与远端 R40 集成后窗口含 R30–R41 共 12 个 request，把最旧的 R30、R31 两节原样搬至 `response-archive/response-R30-R31.md` 并登记索引，窗口恢复 10 个（R32–R41）；此前本条初版已搬 R29（当时窗口 11）。
- **总结**：requests.md 占号 R41（与并行会话金山直连查词补报撞号 40 后按纪律续编）；response.md 本条；冲突记录：R40 撞号如上。本任务只改文档与对话记录，未动任何代码与 manifest（版本号不变）。

### R42（bug 修复：详解面板滚动时丢失 ✕）

- **根因**：`.detail` 面板自身是滚动容器（`max-height: min(70vh, 560px)` + `overflow-y: auto`），词名与 ✕ 位于滚动内容之内的 `.d-head`，滚到底时头部整体移出可视区；面板关闭路径只有 ✕ 与 Esc，于是「看到最后没法关」。
- **修复**：`.d-head` 改 `position: sticky; top: 0` 吸顶，白底铺满整行内宽。**两个坑都靠实测纠出**：① sticky 的吸顶边界是「滚动容器 padding 内缩后的区域」，第一版用 `margin-top: -12px` 把头部顶进面板那 12px 上内边距被约束回弹（头部仍停在 133px），那 12px 反成头部上方一条漏字的缝——改为把 `.detail` 的 `padding-top` 移交 `.d-head`（面板 `padding: 0 14px 12px`）；② 交叉审查指出头部的 8px 下内边距若再用 `margin-bottom: -8px` 收回（本想换取未滚动时逐像素不变），带 z-index 的白底板会压住下一行——变体说明行只有 2px 上边距，`elementFromPoint` 在变体行 top+2 处返回的是头部（gap −6px），故最终不收回负 margin，下方各行下移 8px 换零遮挡。
- **验证**（本仓无自动化框架）：用**真实影子模板 + 真实 reader.css** 搭同源复刻页，headless Chrome 154 跑三态对照（控制组 develop 未修版 / 初版 `-8px` / 最终版）——① 滚到底时 ✕ 的 `elementFromPoint` 判定 `clickable=true` 且 `X.top` 与未滚动时相同（控制组 false，✕ 落在 −1389px）；② 未滚动时 `head.bottom` 与变体行 `top` 的 gap：控制组 +2、初版 −6（被盖）、最终 +2；③ 盒模型量（词目/✕ 的 top 两态相等）与截图确认头部常驻、内容干净穿过、圆角未被白底方角破坏。真机验收仍待用户在 `chrome://extensions` 加载本 worktree 目录实测。
- **版本**：0.8.8 → **0.8.9-202610122121**（测试版，带时间戳不触发发布）。
- **文档**：`docs/feat/word-detail/design/lld.md` 交互细节补吸顶一条（两个坑都记）。
- **交付**：用户批准「merge + push（等于上线）」后，主检出（工作区干净、develop==origin/develop ec9ae45）`git merge --ff-only fix/r42-sticky-detail-head`，push `ec9ae45..0499029`；带时间戳后缀不触发商店发布，正式发布仍走 §0.2 两段式待用户确认。**worktree 驻留待验收**：`chrome://extensions` 重载 `../magiclens-sticky-detail-head` 后划词→「详」→滚到底应仍见词目与 ✕。
- **同源**：magicbook R165 用同一修法改其 `.reading-word-detail` / `.wd-head`，两仓详解面板保持同构。
- **总结**：requests.md 占号 R42；本条为回应；冲突记录：无。窗口 R32–R42 共 10 个 request，未超限不搬移。

### R43（排查并补齐朗读引擎：单词发音应有词典真人音频）

- **用户诉求**：「朗读引擎选了 AI，最近又变成本地」，且「理论上还应该有个词典发音，默认应该是词典」。
- **排查结论（三层，都不是配置被改）**：
  1. 本仓 `content.js` 的 `speak()` 从来只有浏览器 `speechSynthesis` 一条路（`git log -S ml:tts` / `-S dictvoice` 全仓零命中，moon-well 声音朗读是 README/design.md 里的**规划 P2**，未实现）；
  2. 用户看到的「朗读引擎 = AI/browser」下拉在 **magicbook 阅读器**（`epub.js:1093 getTtsEngine()`，`read.html:145-148` 只有 ai/browser 两项），它只管**段落朗读与整本连播**，管不到划词气泡的 🔊；
  3. 「最近」的成因是划词让位落地：magicbook R141→R143→**R146（2026-10-10）**把让位改成运行时探测本扩展 v0.8.6 在正文帧上留的 `data-magiclens-selection` 标记，标记一通，阅读器里的划词气泡就换成扩展这份——magicbook 那份气泡里**单个英文单词走有道 dictvoice 真人词库音频**（`epub.js:477-505`），扩展没有这一层，于是发音退化成机械音。
- **交付**：按 magicbook `speakSelection` 成例给 `speak()` 补词典分支——`SINGLE_WORD_RE` 命中的单词走 `https://dict.youdao.com/dictvoice?type=2&audio=`（type=2 美式，与 magicbook 同一条正则、同一个源），`onerror` 与 `play()` reject 都回退浏览器合成且**只回退一次**（`dictAudio` 引用判重，防旧词迟到兜底音盖在新词上）；短语/句子仍走浏览器合成；新增 `stopSpeak()`，`hide()` 与再次朗读统一先停旧音。气泡按钮 title 同步改写。**AI 声音（US6/P2）本条不做**，词典音频是零成本一层、不替代 P2。
- **验证**（本仓无自动化框架）：
  - 前提实测：`curl dictvoice?type=2&audio=example` → 200 / `audio/mpeg` / 11949 字节真 MP3（`file` 判为 MPEG layer III 64kbps 单声道），`ran`/`hello`/`chiaroscuro` 同样有音频；本机大陆网络直连可用，0.37s。
  - 行为实测：用脚本从 `extension/content.js` **抽出真实的朗读代码段**（47 行）注入 stub（`Audio`/`speechSynthesis`/`SpeechSynthesisUtterance`/`window`），headless Chrome 154 跑 17 条断言**全 PASS**——单词走 dictvoice 且不调合成音、短语只走合成音、`onerror` 与 `play()` reject 各回退一次、换词先 `pause()` 旧音、旧词迟到回调不覆盖新词、`stopSpeak()` 同时 pause+cancel、`don’t`/`well-known` 判定为单词、中文走 `zh-CN`、无选区与无 `speechSynthesis` 均不抛错。
  - `node --check extension/content.js` 通过。
- **版本**：0.8.9 → **0.8.10-202610131011**（测试版，带时间戳不触发发布）。
- **文档**：L1 `README.md` 功能表「本地朗读」行改写为「划词朗读（词典优先 + 浏览器兜底）」；L2 `docs/design.md` §4.3 追加更新注记；L3 `docs/feat/chrome-extension/design/lld.md` US2 状态行 + §10 变更记录（含跨仓成因链）。
- **worktree 台账**：复用 R42 那棵树 `../magiclens-sticky-detail-head`（家族纪律第 7 条「一次会话一个 worktree」，目录名沿用 R42 的 slug 未改，因为用户可能已把它加载进 `chrome://extensions` 验收 R42——移动目录会让扩展失联），新分支 `fix/r43-dictvoice` 基于 origin/develop 826f6b0（R42 已合入，behind=0）。
- **交付（用户选 merge + push develop）**：主检出工作区干净、`behind=0`，`git merge --ff-only fix/r43-dictvoice` 后 push `826f6b0..0bac2f0`；版本带时间戳后缀，**不触发商店发布**（正式发布仍等用户确认去后缀 + merge release）。worktree 原样驻留等真机验收，验收通过后按闸门 `git worktree remove` + `git branch -d`（R42/R43 两条分支同树，需一并清）。
- **待用户真机验收**：`chrome://extensions` 重载该目录 → 任意网页划一个单词点 🔊，应听到真人词库音频；划一个短语点 🔊，仍是浏览器合成音；在 magicbook 阅读器里划词点 🔊，应与未装扩展时一致。
- **总结**：requests.md 占号 R43；本条为回应；冲突记录：无。窗口轮转：写入前含 R32–R42 共 10 个 request（另有 R36 补记一节），本条写入达 11，按纪律把最旧的 R32 原样搬至 `response-archive/response-R32.md`，窗口回到 R33–R43 共 10 个。
