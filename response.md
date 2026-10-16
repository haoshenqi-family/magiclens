# response.md — 对话回应记录（仅保留最近 10 个 request 的回应）

> 归档索引：[response-R1-R10.md](response-archive/response-R1-R10.md) · [response-R11-R15.md](response-archive/response-R11-R15.md)（2026-10-07 R25 完成时补执行 R10/R20 漏掉的归档） · [response-R16.md](response-archive/response-R16.md)、[response-R17-R18.md](response-archive/response-R17-R18.md)（2026-10-08 R28 收口时搬移） · [response-R19.md](response-archive/response-R19.md)（2026-10-08 R29 完成时搬移） · [response-R20.md](response-archive/response-R20.md)（2026-10-08 R30 完成时搬移） · [response-R21-R22.md](response-archive/response-R21-R22.md)（2026-10-08 R32 完成时搬移） · [response-R23-R24.md](response-archive/response-R23-R24.md) · [response-R28.md](response-archive/response-R28.md) · [response-R25.md](response-archive/response-R25.md)（2026-10-10 R35 完成时搬移） · [response-R26.md](response-archive/response-R26.md)（2026-10-10 R36 写入触发轮转搬移） · [response-R27.md](response-archive/response-R27.md)（2026-10-10 R38 写入触发轮转搬移） · [response-R29.md](response-archive/response-R29.md)（2026-10-11 R40 写入触发轮转搬移） · [response-R30-R31.md](response-archive/response-R30-R31.md)（2026-10-11 R41 集成时窗口超限搬移） · [response-R32.md](response-archive/response-R32.md)（2026-10-13 R43 写入触发轮转搬移） · [response-R33.md](response-archive/response-R33.md)（2026-10-14 R44 写入触发轮转搬移） · [response-R34.md](response-archive/response-R34.md)（2026-10-15 R45 写入触发轮转搬移）

### R45（家族根架构评审任务拆分建档，只写文档）

- **范围**：阅读家族根 `../docs/architecture-review-2026-10-14.md`，将其中本仓相关结论（§2.3 L1–L7、§3.3 严重度标记、§2.5 X1/X2 本仓部分、§5 冲突清单）拆分为待办任务落档。**零 `extension/` 代码改动，manifest 版本不递增**（无代码修改，不触发测试版递增规则）；纯文档任务不建 worktree。
- **建档**：新建 `docs/feat/arch-review-2026-10/design/` 三份——
  - overview.md：任务总表（L1 波 1【X1】/ L4、L5 波 2 / L2 波 3 / L7 波 4【X2】/ L3、L6 未排——**L6 失败可见为 🔴，建议尽早** + U1–U2 + DF1–DF4）；
  - refactor-items.md：每项含现状问题（文件:行号）、任务内容、验收判据；L6 验收强调真机模拟接口故障验证「失败可见」；L7 为本仓首个 node 断言向量入口；
  - doc-fixes.md：DF1 N4 design.md §3 表体 token 时效改 30/90（表体直接改正文，保留 R26 更新注）、DF2 K3 README 兼 L1+契约速查二义（A 下沉 / B 豁免，待用户决策）、DF3 悬空 feat 补索引、DF4 三方一致性检查。
- **索引登记**：`docs/design.md` 追加 §15 决策记录指向该目录（L2 层引用，消灭悬空）。
- **归档**：R34 原样搬至 `response-archive/response-R34.md`（写入后窗口 11 条触发轮转，回 10 条内）。
- **跨仓**：四仓同源建档（moon-well R180 / magicbook R174 / app-manager R42）；X1（L1 与 moon-well M4 / magicbook B5 同窗口）与 X2（四组镜像向量）协同口径见家族根 `../docs/arch-review-2026-10-tasks-crossrepo.md`。
- **总结**：requests.md 占号 R45；response.md 本条；冲突记录：无。

### R46（架构评审波 1+2 · L1+L4+L5+L6：rpc 门面 / 令牌刷新单点 / 默认值单点 / 失败可见）

- **交付（commit `2b7be68`，分支 `refactor/r46-rpc-facade`，已 merge 本地 develop；版本 0.8.12-202610151621 测试版）**：
  - **L1**：新增 `rpc.js`——send 统一传输与失效分类（同步抛/lastError 两路同一分类器）、onInvalidated 退役钩子（content=retireOrphan、highlight=teardown）、MSG 表 16 键（全仓 type 字面量清零）；三份薄包装保留各自契约（content {ok,error} / highlight 吞错返 null / chat Promise+失效文案）；manifest 两处 content_scripts 组与 background（importScripts）都载 rpc.js，globalThis 挂载兼容 SW 与页面；
  - **L4**：`refreshOrClear` 单点——callApi 401 与 ml:auth 的超时/清凭据分支合一（R35 口径从注释对齐变代码单点）；
  - **L5**：`__magicLensDefaults` 冻结表入 common.js（globalThis 挂载），五处内联默认与 DEFAULT_CFG 全部引用单点，新增设置键只改一处；
  - **L6**：highlight analyze 失败不再纯静默（console.warn + storage.local 上报 + popup 常驻失败原因行，高亮页本身仍不打扰阅读）；chat memory save/delete 补失败提示。
- **验证（诚实）**：node --check 10 文件全过；node 冒烟（SW/页面双环境挂载、DEFAULTS 取值、失效双钩子触发均过，**冒烟曾抓到 onInvalidated 未定义的真 bug**——node --check 只查语法不查引用，已补）；MSG 表-引用一致性脚本核验无缺失无冗余；真机手工清单待用户重载验收（划词/高亮/伴读全链路 + popup 失败行 + 记忆保存失败提示）。
- **X1 合围收官**：moon-well M4（包装兑底）+ magicbook B5（统一解包）+ magiclens L1（rpc 门面）三端齐——R44/R173 类事故链从「三端各自防御」变「两端机制 + 一端可见」，联合验收待三仓真机同步。
- **台账**：worktree `../magiclens-arch-l1`（分支 `refactor/r46-rpc-facade`，merge commit `2b7be68`）驻留待验收，验收通过后 remove + branch -d；验收发现新问题在原 worktree 修（manifest 按 §0.2 再递增）。未 push（push develop 不触发发布；正式发布需用户确认后去时间戳 merge release）。
- **总结**：requests.md 占号 R46；response.md 本条；冲突记录：无。

### R47（架构评审波 3 · L2 阶段一：OIDC 回调迁独立 content_script）

- **交付（commit `906e232`，分支 `refactor/r46-rpc-facade` 同分支第二 commit，已 merge 本地 develop；版本 0.8.13-202610151643 测试版）**：新增 `oidc-callback.js`（matches 仅 moon-well.haoshenqi.top）——回调捕获不再依赖全站注入的 content.js；content.js 734→688 行（回调段迁出），回调页不再跑完整划词引擎启动门控，其余页面卸下永不生效的死逻辑。
- **L2 阶段二（登记）**：bubble.js / detail-panel.js / tts.js 三模块拆分（共享 shadow 状态需重构为 window 命名空间互调）与 magicbook epub.js 拆分（B4）同批——同属前端巨石拆分，模式统一后一次做。
- **验证**：node --check 全过；真机验收点：moon-well 登录回调仍能自动捕获 token 写 storage + 三秒关页（独立脚本在新条目下首次真机验证）；划词/高亮/伴读回归。
- **台账**：worktree `../magiclens-arch-l1` 同树第二 commit（r46→r47），merge 后驻留待验收。未 push；正式发布待用户确认后去时间戳 merge release（会同时带上 R46+R47 两批）。
- **总结**：requests.md 占号 R47；冲突记录：无。

### R35（bug 修复：伴读 AI 永远「未配置服务地址或 Token」，重新登录无效）

- **诊断**（证据链）：chat.js 自带 `getCfg()` 直读 `chrome.storage.sync`，默认对象里 `apiBase` 与 `token` 两个字段均为空串（原始代码为键值对字面量，2026-10-10 R38 经用户裁决改为键名表述——安全护栏对含空赋值形态的文件写入一律拦截，语义不变）；发送前守卫 `if (!cfg.apiBase || !cfg.token)` 一票否决。而 v0.3.0 起设置页已无地址/Token 手动配置项，`apiBase` 公网域名只作为 background.js `DEFAULT_CFG` 兜底存在——storage 里根本**没有 `apiBase` 这个键**（仅 v0.2 存量内网地址会被一次性迁移写入；全新安装永不写入），登录回调（content.js）也只写 `token/refreshToken`。于是：伴读面板永远命中 `!cfg.apiBase` → 报「未配置服务地址或 Token」；点「重新登录」走完 OIDC 只补了 token，`apiBase` 仍为空 → 报错不变，即用户所见「跳转登录也不行」。其他功能（翻译/标记/详解/高亮）全部经 background `callApi`（其 `getCfg` 有域名兜底）故不受影响，与「插件明明已登录」的直觉自洽。次要缺口：chat.js 要求 `token` 非空才放行，而 `callApi` 允许 token 空 + refreshToken 有效（401 时静默刷新），两侧口径不一致。
- **修复**（manifest `0.8.3-202610101524` 测试版，不触发发布）：
  - background.js 新增 `ml:auth` 消息：凭据只此一处出——返回 `{ apiBase, token }`；token 空而 refreshToken 有效时先经 `/auth/refreshToken` 静默刷新（超时不清凭据只报稍后重试、确定性失败清凭据引导重登，与 `callApi` 的 401 分支同语义）；未登录返回 `auth: true`。
  - chat.js 删除本地 `getCfg`，原 `api()` 的消息收发泛化为 `bg(msg)`（保留 R13 的 Invalidated 分类），JSON 面板端点与 SSE 前置凭据解析都走它；SSE 直连仍留在 content script 消费（LLD 决策 A1 不变），URL/Bearer 改用 `ml:auth` 返回值；错误分支的「重新登录」链接改按 `resp.auth` 判定（扩展重载类错误不再误挂登录链接）。
  - LLD 变更记录追加本条；apiBase/凭据出口收敛的约束写入 chat.js 与 background.js 注释。
- **验证**：`node --check` chat.js/background.js 通过；分支推演覆盖 未登录（auth 链接）/ token 空+refresh 有效（静默刷新后放行）/ 刷新超时（保凭据提示重试）/ 刷新被拒（清凭据+重登链接）/ 扩展重载（刷新页面提示，无登录链接）。真机清单（需用户 chrome://extensions 重载后实测）：① 退出登录 → 问 AI 提示「未登录，请先在设置页登录」+ 链接；② 点链接完成 OIDC 登录 → 回页直接发送 → SSE 流式回复正常；③ 会话列表/记忆/学情面板正常；④ 划词翻译等其他功能回归正常。
- **总结**：requests.md 占号 R35；response.md 本条；归档 R23–R24（窗口回到 10 条内）。冲突记录：与 R34（iframe 划词，另一会话在途）并行——manifest.json 版本竞态（R34 会话 15:23 写入 `0.8.2-202610101523`，本会话按「每次修改完成递增」续增为 `0.8.3-202610101524`）；本会话未触碰 content.js/highlight.js。
- **更新（2026-10-10 发布）**：用户真机验收通过后已发正式版 **v0.8.3**（run 38035576570，Release 含 magiclens-extension-v0.8.3.zip，zip 内 manifest version/version_name 均为纯 0.8.3）。发布锚定 9e57c04（R34+R35），**不含其后未验收的 R36 选区中继重构**（c64b541 待其自行验收走 v0.8.4）；去时间戳提交 a0ccbc8 仅落 release 分支（develop 已被 R36 前移、避免非快返推送），下次发版 merge 时 manifest 以新版为准。

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
- **正式发布（2026-10-13，用户指令「release」并确认已真机走过 §3 手工清单）**：`version_name` 去时间戳后缀 → `0.8.10` 推 develop（`4eea63c`）；`release` 分支在临时 worktree `../magiclens-release-0810` 内 `merge --no-ff origin/develop` 成 `23833cd` 后 push（推前实测 `git diff origin/develop -- extension` 为空，打包内容与 develop 一致）→ workflow run 38356015482 10 秒 success，GitHub Release `v0.8.10` 已建（zip 17 文件、manifest 0.8.10）。本次发布覆盖自 v0.8.5 以来的六笔功能面：R37 握手标记、R39 选区两修、R40 直连查词补报、R42 详解面板吸顶、R43 词典发音。**遗留口径**：workflow 用 `gh release create` 未带 `--target`，tag 落在默认分支（develop 的 `4eea63c`）而非 release 分支的 merge commit——与 v0.8.5 当时的表现一致，属既有 workflow 行为，本次未改。发布 worktree 已即时 `git worktree remove`（无独有产物，验收物即 Release 本身）。
- **总结**：requests.md 占号 R43；本条为回应；冲突记录：无。窗口轮转：写入前含 R32–R42 共 10 个 request（另有 R36 补记一节），本条写入达 11，按纪律把最旧的 R32 原样搬至 `response-archive/response-R32.md`，窗口回到 R33–R43 共 10 个。

### R44（面板端点解包容错 + 失败可见，同源 moon-well R173）

- **根因链（三层）**：① moon-well `/ai/agent` 的 8 个面板端点返回裸 VO，而本仓 `callApi` 按统一 `Result{success,...}` 判定 `payload.success !== true` → 成功响应被判失败；② `chat.js refreshConversations()` 写的是 `if (!resp.ok) return;` → 误判被静默吞掉；③ 抽屉本身每次都以「＋ 新会话」开场（`conversationId` 是页面级内存状态、无持久化）。三者叠加，用户报告＝「同一网站之前的记录没有了」，而界面与「真的没有历史」完全同形。
- **交付**：① 解包抽成纯函数 `unwrapMoonWellResponse(resp, payload)`（只有 HTTP 不成功 / 非 JSON / 显式 `success === false` 才算失败，其余取 `result`、裸 payload 原样透出），与 magicbook `ai_chat.js unwrap()` 同口径；② 会话列表失败时下拉显示「⚠ 会话列表加载失败：<原因>」且该项 disabled，不再静默空列表（历史/记忆/学情三块原本已有错误态）；③ 契约表 §6.1 按统一 Result 形制逐端点更正（旧表把「裸 VO 列表」和「Result」混着记，记的就是漂移本身）。
- **验证**（本仓无测试框架）：把 `background.js` 里**真实的** `unwrapMoonWellResponse` 源码抽出来在 node 跑 12 条断言全过——包装列表/对象/`result:null`、裸数组/空数组/裸对象六类都判成功；`success:false`、非 JSON、HTTP 500、401/403（带 `auth`）四类都判失败；另加一条「裸 payload 无 success 字段」回归断言。**控制组**用旧判定跑同一批 payload：裸数组与裸对象确实「判失败」，证明断言有鉴别力。首跑 2 条 FAIL 是探针 stub 漏给 `status` 默认值（`ok()` → `HTTP undefined`），修探针后全绿，不是被测代码问题。`node --check` 全 9 个 JS 通过。
- **版本**：0.8.10 → **0.8.11-202610141053**（测试版，带时间戳不触发发布）。
- **复查修正（交叉审查后）**：错误态下拉原本只留一条禁用的「⚠ 加载失败」，会把「＋ 新会话」这个可用出口一起抹掉，且当前正在追问的会话在界面上被谎称成新会话。现按状态分叉：无当前会话 → 保留可选的「＋ 新会话」+ 禁用原因行；有当前会话 → 显示「当前会话 #id（列表加载失败，暂无法切换）」（禁用但仍为选中值，DOM 允许禁用项作当前值）+ 原因行，`state.conversationId` 不动，所以继续发送/重命名/删除都照旧。**两条探针自身的假故障也记一笔**（避免下次误判被测代码）：① 首轮 2 条 FAIL 是 stub `ok()` 没给 `status` 默认值，产出 `HTTP undefined`；② 次轮 1 条 FAIL 是 fake `<select>` 用 `===` 比 `option.value`（真实 DOM 读出必为字符串，number 7 对不上 '7'）——两处都是修探针而不是改代码，修完 11 条断言全过。

- **文档**：L1 README 伴读行补「默认起新会话、续聊从下拉选、失败显示原因」；L2 `docs/design.md` 新增 §14 决策记录；L3 `docs/feat/chrome-extension/design/lld.md` §6.1 契约表更正 + §10 变更记录。
- **交付（用户选「两仓都 merge + push develop」）**：主检出工作区干净、`behind=0`，`git merge --ff-only fix/r44-agent-result-tolerant` 后 push `6cdc08d..3ea50bd`；版本带时间戳后缀不触发商店发布（正式发布仍等用户确认）。worktree 原样驻留等真机验收。
- **待用户真机验收**：重载扩展 → 打开伴读抽屉，左上角下拉应列出既有会话（网页会话带 `[通用]` 前缀）；🧠 记忆面板不再显示 `HTTP 200` 之类假错误。注意：**后端那半（moon-well R173）未上线前，本仓容错已足以让列表恢复**——上线顺序不敏感。
- **总结**：requests.md 占号 R44；本条为回应；冲突记录：无。窗口轮转：写入前含 R33–R43 共 10 个 request（另有 R36 补记一节），本条写入达 11，按纪律把最旧的 R33 原样搬至 `response-archive/response-R33.md` 并登记索引，窗口回到 R34–R44 共 10 个。
