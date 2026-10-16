# response-R35-R38.md — R35 / R36 / R38 归档

> 从 `response.md` 原样搬移（2026-10-16 R50 写入触发轮转，窗口回 10 条 request 内）；只搬移原文，不总结、不改写、不改编号。

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

