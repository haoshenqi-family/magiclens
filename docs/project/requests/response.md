# response.md — 对话回应记录（仅保留最近 10 个 request 的回应）

> 归档索引：[response-R1-R10.md](response-archive/response-R1-R10.md) · [response-R11-R15.md](response-archive/response-R11-R15.md)（2026-10-07 R25 完成时补执行 R10/R20 漏掉的归档） · [response-R16.md](response-archive/response-R16.md)、[response-R17-R18.md](response-archive/response-R17-R18.md)（2026-10-08 R28 收口时搬移） · [response-R19.md](response-archive/response-R19.md)（2026-10-08 R29 完成时搬移） · [response-R20.md](response-archive/response-R20.md)（2026-10-08 R30 完成时搬移） · [response-R21-R22.md](response-archive/response-R21-R22.md)（2026-10-08 R32 完成时搬移） · [response-R23-R24.md](response-archive/response-R23-R24.md) · [response-R28.md](response-archive/response-R28.md) · [response-R25.md](response-archive/response-R25.md)（2026-10-10 R35 完成时搬移） · [response-R26.md](response-archive/response-R26.md)（2026-10-10 R36 写入触发轮转搬移） · [response-R27.md](response-archive/response-R27.md)（2026-10-10 R38 写入触发轮转搬移） · [response-R29.md](response-archive/response-R29.md)（2026-10-11 R40 写入触发轮转搬移） · [response-R30-R31.md](response-archive/response-R30-R31.md)（2026-10-11 R41 集成时窗口超限搬移） · [response-R32.md](response-archive/response-R32.md)（2026-10-13 R43 写入触发轮转搬移） · [response-R33.md](response-archive/response-R33.md)（2026-10-14 R44 写入触发轮转搬移） · [response-R34.md](response-archive/response-R34.md)（2026-10-15 R45 写入触发轮转搬移） · [response-R35-R38.md](response-archive/response-R35-R38.md)（2026-10-16 R50 写入触发轮转搬移，窗口回 10 条 request 内） · [response-R41.md](response-archive/response-R41.md)（2026-10-27 R56 写入触发轮转搬移） · [response-R45.md](response-archive/response-R45.md)（2026-10-21 R51 写入触发轮转搬移） · [response-R39.md](response-archive/response-R39.md)（2026-10-27 R52 写入触发轮转搬移） · [response-R46.md](response-archive/response-R46.md)（2026-10-27 R53 写入触发轮转搬移） · [response-R40.md](response-archive/response-R40.md)（2026-10-27 R54 写入触发轮转搬移） · [response-R47.md](response-archive/response-R47.md)（2026-10-27 R55 写入触发轮转搬移） · [response-R42.md](response-archive/response-R42.md)（2026-10-29 R57 写入触发轮转搬移） · [response-R43.md](response-archive/response-R43.md)（2026-11-02 R58 写入触发轮转搬移） · [response-R44.md](response-archive/response-R44.md)（2026-11-08 R59 写入触发轮转搬移）

- `response-archive/response-R50-R52.md`：R50 docs v2 迁移 / R51 发布链纯文档跳过打包 / R52 伴读抽屉去 token+站内链接——2026-11-13 R62 写入触发轮转搬移（窗口 12→13 压回 10），原样搬移不改写

- `response-archive/response-R54.md`：R54 常驻入口悬浮球（buddy 形象+径向气泡+拖拽记忆，R56/R57 验收修订同节）——2026-11-15 R70 写入触发轮转搬移，原样搬移不改写

- `response-archive/response-R53.md`：R53 伴读抽屉语音双向（麦克风转写 + 回复朗读）——2026-11-13 R63 写入触发轮转搬移，原样搬移不改写


## 2026-11-08（R59：同步 magicbook 近期功能——悬浮球滚动复习 + 语速三档）

### R59（同步 magicbook R285/R289/R263：悬浮球 SRS 滚动复习轮播 + 回复朗读语速三档）

- **做了什么**：对齐 magicbook 上次同步点（10-27 R52-R54）之后的两个用户可见能力——**A 滚动复习**（R285 词卡轮播 + R289 详情分页）与 **B 语速三档**（R263）；R261 行内 gloss 用户拍板不做（涉及任意网页排版、改动大，且 magicbook 站内已接受「扩展接管高亮时该开关不生效」）。
- **A 交付（`ball.js` + `rpc.js` + `background.js` + `chat.js` 抽屉事件）**：球 shadow root 内 `wrap` 兄弟节点常驻词卡（不进 wrap——径向气泡与拖拽命中区冲突，R285 同源教训）；`ML_REVIEW_QUEUE`→`GET /learning/srs/queue` 20 词洗牌 8s 轮播、「认识」复用 `ML_MARK`→`GET /vocabulary/known/{word}` 按点击瞬间下标删词；`ML_REVIEW_DETAIL_BATCH`→`POST /vocabulary/detail/cached-batch`（moon-well R248 只读缓存零计费）详情分页：每词基本意思前 2 义项 + 随机 1 模块 ≤4 页、line-clamp 3 硬钳、同词连翻、无缓存/端点未发生产/失败三路静默回退简卡；**计费红线**：绝不调 `/vocabulary/detail/{word}`（miss 现场生成计费）；暂停矩阵对齐 R285（页面不可见/气泡展开/抽屉打开/inFlight…），抽屉开合经 chat.js 派发的 `magiclens-chat` 事件感知（closed shadow 唯一通道）；paused/collapsed 走 `chrome.storage.local`（禁污染宿主 localStorage——magicbook 用页面 localStorage 是站内特权不能照抄）；未登录静默隐藏、登录成功（token 落库）自动补拉。
- **B 交付（`chat.js`）**：抽屉头部语速按钮 1.0/0.75/0.5x 循环（R263 顺序），档位 `chrome.storage.local` `magiclens.ttsSpeed`（设备相关体验，不进 sync）；播放分叉：1.0x 恒走原 BufferSource 链路零回归，非 1.0x 走 `<audio>` + `preservesPitch`/`webkit`/`moz` 三连钉变速不变调（Why：BufferSource 只有重采样必变调，`preservesPitch` 是 HTMLMediaElement 专属），blob 被页面 CSP `media-src` 拦时回退 BufferSource 套 `playbackRate`（变调降级好过无声）；换档不打断当前段、下一段生效。
- **⚠ 发版时序**：`cached-batch` 在 moon-well develop（dev 环境），生产 release 尚未携带（2026-11-08 release 落后 develop 22 提交）——扩展直连生产 moon-well，该端点 404 期间详情分页自动回退简卡（与「无缓存词」同一降级路径），moon-well R248 发生产后详情自动生效，扩展无需再发版。
- **集成套件（R185 门禁）**：`matrix/magiclens.csv` +2 行（`ml-ball-review`/`ml-chat-speed`）、`e2e_bridge.py` FEATURES 同步、run.js mock 层补 `/learning/srs/queue` 与 `cached-batch`（fixture：队列两词、批量表 apple 命中/terrible 有意 miss 验简卡分叉）；**坑**：`/vocabulary/detail/` 前缀规则抢配批量端点致前端全量 miss（详情失败不可见口径反而掩盖 mock 配错）——精确规则必须排在前缀之前（已写进 run.js 注释）；悬浮球默认关闭须显式 `sSet ballEnabled:true`；harness 默认装主检出，验 worktree 必须 `--ext`。**实测**：CfT chrome@157 全量 **14/14 pass**（worktree 扩展）、静态守卫 3/3、`guard.py` 三向对账全绿；套件变更已 push ops main（303de4f）。
- **版本**：0.8.21 → **0.8.22-202611082233**（测试版，带时间戳不触发发布）。
- **文档四问**：能力变了吗 → README 功能表 3 处（悬浮球行补滚动复习、语音双向行补语速、契约速查 +2 端点）；实现/边界 → 本 LLD `r59-sync-review-speed/lld.md`（含 4 条踩坑）；本次怎么实现 → 同文件；契约速查以 moon-well 现行代码为准（`LearningController.srs/queue`、`VocabularyController.detail/cached-batch` 均已核对源码）。
- **台账**：requests.md 占号 R59（claim.sh `f18f602`，push 即占）；PingCode idea **ML-55**（J5QST1pL）已建 → In progress；worktree `../magiclens-r59-buddy-review-speed` / 分支 `feat/r59-buddy-review-speed` merge 后**驻留待真机验收**。窗口轮转：写入前含 R44/R50–R58 共 10 条，本条写入达 11，最旧的 R44 原样搬至 `response-archive/response-R44.md` 并登记索引，窗口回 10。
- **总结**：requests.md 条目 59 已回填；本条为回应；冲突记录：无。


## 2026-11-11（R60 注册死链修复 + R61 邀请链接改后端动态获取）

### R60（用户：「检查magiclens 的注册链接是不是失效的那个」→「改」）

- **排查**：`background.js` 的 `ENROLLMENT_URL` 常量（v0.3.1 引入后从未更新）仍指 2026-10-30 过期且已从 Authentik 库删除的旧邀请 `5566492c`——10-23 邀请轮换（新邀请 `1572b336`、过期 2027-01-21、single_use=false）只同步了 magicbook `.env`，扩展侧所有已发布版本（商店 zip 手动装、无自动更新）注册按钮自 10-30 起全是死链。域名 `authentik.haoshenqi.top` 301→`account.haoshenqi.top` 保留 query，域名无罪。
- **修复**：常量换现役邀请 + 域名改 `account.haoshenqi.top` 免 301；manifest 0.8.23-202611111026 测试版（`447eebf` push develop，worktree `magiclens-r60-enroll-url-refresh`）。
- **教训沉淀**：邀请轮换是「magicbook .env + 扩展常量发版」双落点——此教训随即被 R61 从根上消除（见下）。
- **总结**：requests.md 占号 R60（`445febc`）；本条为回应；冲突记录：无。

### R61（用户：「邀请链接改为从后端获取，避免两端不一致。注意这个后端接口要开发白名单，不登录也可以获取」）

- **做了什么**：`ML_REGISTER` 从「硬编码常量」改为运行时获取 moon-well 匿名端点 `GET /auth/enrollment-invite`（对端 moon-well R250：Nacos `app.auth.enrollment-invite-url` 真值源，热重绑，轮换改后端一处即全端生效）；**删除 `ENROLLMENT_URL` 内置常量**——保留即残留漂移面，违背真值收敛初衷；失败不静默（options 结果区 `showResult` 明示原因）。Why 匿名直连不走 callApi：其「无 token 即拒」闸门与注册按钮场景（未登录态）冲突，也不透传本地令牌避免无谓 401/静默刷新链。
- **测试**：本项目无自动化测试框架——`node --check` 双文件语法过、旧 token 全仓零残留、manifest JSON 合法；集成套件侧语义用例落在 moon-well R250 的 `mw-get-auth-enrollment-invite`（dev 12/12 全绿），magiclens 矩阵 14 行无 ML_REGISTER 独立行（消息行为=开浏览器标签，非 API 契约，无需增行）。
- **验收（用户真机）**：`chrome://extensions` 加载 `magiclens-r60-enroll-url-refresh/extension/` → 设置页点「注册」→ 应打开邀请流程页进入表单；断网/后端不可达时应看到 `✗` 错误文案而非无反应。
- **部署**：`b43ad2f..f709a89` push `origin/develop`；0.8.24-202611111044 测试版（不触发发布）；正式版待用户验收后去时间戳 merge `release`。
- **运维口径**：邀请轮换从此=Nacos 键（热重绑）+ magicbook `.env`（登录页）两处同步——扩展侧零动作。
- **总结**：requests.md 占号 R61（`b43ad2f`）；本条为回应；冲突记录：无（与 R60 同树续作，一次会话一树）。

## 2026-11-13（R62：发布正式版 v0.8.24）

### R62（用户：「release magiclens」）

**回应**：执行两段式正式发布（AGENTS.md §0.2），把 develop 上的 R59/R60/R61 三个测试版（0.8.22→0.8.24）合成正式版 **v0.8.24** 发布。

- **发布前验证（正式发布态）**：家族套件 magiclens T1 **17/17 PASS 全绿**（含 R59 的 ml-ball-review 悬浮球滚动复习 1263ms/intercepted=9 与 ml-chat-speed 语速 E2E 实测；无 FAIL 无 SKIP）；`guard.py` magiclens 矩阵 14 行缺口 0——另报出 4 条 **moonwell** 缺口（`/yakka/*` 端点在 dev /v3/api-docs 出现但矩阵未收）系**另一会话在途的 moon-well 新模块**，与 magiclens 无关、不拦本次发布，已如实登记待该任务收口。
- **发布动作**（worktree `../magiclens-r62-release-v0824`，R36 先例）：① `28a1075` chore(release) 去时间戳后缀（`0.8.24-202611111044` → `0.8.24`）push develop；② release 头（2202000）上 `--no-ff` merge develop → `f03fcc3` push release（release 分支含 v0.8.20 独有提交，非 FF，须在 release 头上合）；③ `release.yml` 自动跑成功（16s）。
- **发布产物验证**：GitHub Release **v0.8.24**（Latest）已建，资产 `magiclens-extension-v0.8.24.zip`，changelog `v0.8.20...v0.8.24`（涵盖 R57 划词直译/R58 README/R59 悬浮球滚动复习+详情分页+语速三档/R60+R61 注册链接两修）。
- **驻留**：worktree `../magiclens-r62-release-v0824`、分支 `chore/r62-release-v0824`（已全部推远端），与 R59/R60/R61 驻留一同待用户装 v0.8.24 实测后清理。

**台账总结**：`requests.md` 第 62 条占号（5c69f6c）本处回填；`response.md` 写入前 12 节（历史欠账），本次压回 10 节，最旧 R50–R52 原样搬入 `response-archive/response-R50-R52.md` 并登记索引。

## 2026-11-13（R63：缺陷——滚动复习词卡报 unknown message type）

### R63（用户：「fix this bug」+ 截图：滚动复习词卡红字 unknown message type + 重试）

- **现象**：悬浮球旁「滚动复习」词卡整卡变红字 `unknown message type`，「重试」恒失败；同页其它功能（划词、高亮、伴读）正常。
- **根因（实测证据，非 R59 代码回归，是 SW 与 content script 版本错位）**：报错串全仓唯一来源是 `background.js` 的 `default` 分支；词卡拉队列只发 `ml:review-queue`（R59 新增类型）。Chrome（Default profile）加载的是解包扩展 `magiclens/extension`，而其 **SW ScriptCache 仍是 2026-10-29 的构建**——`rpc.js` 的 MSG 表没有 `ML_REVIEW_QUEUE`、`background.js` 仍含 R61 已删除的 `ENROLLMENT_URL` 常量，整个 ScriptCache 目录 grep `ml:review-queue` 命中 0；对应 V8 code cache 时间戳却是 2026-11-13 16:14，说明今天 SW 被唤醒时仍在跑旧脚本。content script 则是每页从磁盘重读的，所以页面里是 R59 之后的新版（词卡在）→ 新类型落到旧 SW 的 `default`。MV3 解包扩展改消息表后，SW 只有在 `chrome://extensions` 重新加载或扩展更新时才重新注册，SW 脚本缓存（含 `importScripts` 的 `rpc.js`）会把旧构建一直沿用。
- **处置 A（根因动作，用户侧 2 步）**：`chrome://extensions` → MagicLens 词镜 → **重新加载** → 刷新出问题的页面，词卡即恢复。
- **处置 B（代码加固，本次提交）**：`ball.js` 新增 `reviewErrorText()`，把 `unknown message type` / `Extension context invalidated` 两类环境错误翻成可行动中文（「扩展版本未同步：请在 chrome://extensions 重新加载扩展，再刷新本页」/「扩展已更新，请刷新本页后重试」），业务错误（积分不足/超时/401 话术）原样透出——不静默降级；`background.js` 的 `default` 回带 `type` 便于 console 定位，错误串前缀保持不变；版本 0.8.24 → **0.8.25-202611131705** 测试版（带时间戳不触发发布；合并时与并行 R64 撞 0.8.25，按推送序顺延 **0.8.26-202611141315**）。
- **验证**：`node --check` 双文件过、`manifest.json` JSON 合法；`reviewErrorText` 抽源码实跑 5 例断言全过（unknown→重载指引、invalidated→刷新指引、积分不足原样透出、空串兜底、「重新加载」关键词）；确认 `background.js` default 回带 `type`。**真机待用户按处置 A 验收**：重载扩展 + 刷新后词卡正常轮播。
- **文档四问**：能力未变（仅错误话术）→ README 不动；契约未变（无新消息类型/新端点）→ design.md 不动；实现/边界 → LLD `iterations/1.0/r63-review-sw-skew/lld.md`；本次怎么实现 → 同文件。集成矩阵无新行（不新增/修改路由与特性，guard 三向对账不触发）。
- **教训**：本仓新增消息类型的验收必须「**先 `chrome://extensions` 重新加载，再刷新页面**」——只刷新页面会得到「新 content script + 旧 SW」的假失败（与 R62「harness 默认装主检出、验 worktree 必须 `--ext`」同类：验收前先确认被测的是哪一版构建）。
- **台账**：requests.md 占号 R63（claim.sh `0931667`，已 push）；worktree `../magiclens-r63-review-sw-skew`、分支 `fix/r63-review-sw-skew`，已 merge 本地 develop；**2026-11-14 用户令与 R64 一并 merge develop 并 push**（合并版顺延 0.8.26-202611141315），按 ops R187 merge 即清口径，其 worktree/分支待 worktree-doctor 巡检清理；窗口轮转：写入前 R53–R62 共 10 条，R53 原样搬至 `response-archive/response-R53.md` 并登记索引，窗口回到 R54–R63 共 10 条。
- **总结**：本条为回应；冲突记录：无。

## 2026-11-14（R64：登录成功回调页不自动关闭修复）

### R64（用户：「✓ MagicLens 登录成功 / 令牌已自动保存，本窗口稍后自动关闭。然后一直没有关闭」）

- **做了什么**：登录成功回调页的两条关闭链路（background 收 ML_LOGIN_OK 后 2.5s `chrome.tabs.remove` 为主、content 3s `window.close` 为兜底）双双哑火，断点是同一处——`oidc-callback.js` 引用裸 `MSG`，而 `MSG` 从非全局（rpc.js 只挂 `__magicLensRpc`，全仓口径 `const MSG = __magicLensRpc.MSG`）；R47（906e232）迁独立 content script 时把裸引用带了过来、解构行丢了。ReferenceError 抛在 `chrome.storage.sync.set` 异步回调里、外层 try/catch 接不住：横幅照常渲染（用户看得到「登录成功」），但 ML_LOGIN_OK 发不出、兜底定时器不注册、background 永不 `tabs.remove`，标签页永久停留。修复：① storage 回调内解构 `MSG`（异步执行时两条注入条目的 rpc.js 必已落定；刻意不放 IIFE 顶层——条目顺序变动会先崩、连令牌捕获一起丢）；② `sendMessage` 包 try/catch，发送失败不吞兜底定时器；③ manifest 回调条目显式先注入 `rpc.js`（依赖显式化，不借道 catch-all 条目的注入）。潜伏期自 2026-10-15（token 90 天有效、登录罕见故一直未炸）。
- **测试**：`scripts/check-extension-modules.js` +1 段回调页契约——VM 按 manifest 注入顺序真实执行 rpc.js → oidc-callback.js，锁「存令牌→渲染横幅→发 ML_LOGIN_OK（类型取自 MSG 表）→注册兜底定时器」链路；storage 回调按浏览器语义异步投递（同步调用会被外层 try/catch 接住，掩盖真实失败形态——首版测试即踩此坑）；**旧版缺陷回放 FAIL 证明守卫有效**（0c4b792 旧文件换入重跑 = `ReferenceError: MSG is not defined` 复现 + 套件 exit 1，恢复修复版全绿）；node --check + manifest JSON 合法性过；本套件之外 T1 手工矩阵无登录回调独立行（真机验收覆盖）。
- **验收（用户真机）**：`chrome://extensions` 加载本 worktree `extension/` → 设置页「登录」→ Authentik 登录完成 → 回调页应显示「✓ MagicLens 登录成功」并在约 2.5-3s 内自动关闭（修复前永不关闭）；回 options 页登录状态应已刷新。
- **部署**：`0c4b792..dd08928` push `origin/develop`（R64 先行，0.8.25-202611141302 测试版）；2026-11-14 用户令「merge 到 develop」——R63（5805c32/d45b580）与 R64 在主检出正式合并推送，合并结果顺延 **0.8.26-202611141315**（含两修）；正式版随下一轮发布去时间戳 merge `release`。
- **总结**：requests.md 占号 R64（`0c4b792`）本条为回应；冲突记录：R63 并行会话同日开发且测试版同递增至 0.8.25——其提交（5805c32/d45b580）驻主检出树尚未 push，曾致主检出试合并 manifest 冲突（即时 abort，未留痕）；R64 先以纯快进推上 origin/develop；同日用户令合并，已在合并中把撞号顺延为 0.8.26（R63 修复同车），其台账撞号条目（Worktree 纪律修订）重编为 65。

## 2026-11-14（R66：划词发音四级链路——IndexedDB 词音缓存 + moon-well 词典代理）

**对 R66 的回应**：用户要「缓存每个单词的真人发音、不要机械合成音」，并拍板链路与边界：
不预取；词典直连失效走后端（后端给的也必须是词典音），后端也失效才机器合成。

- **交付（版本 0.8.27-202611141415 测试版）**：
  - 四级的第 1~3 级收进 background SW（新消息 `ML_DICT_SPEAK`）：① IndexedDB 词音缓存
    （库 `magiclens`/store `dictvoice`，键=trim+弯撇号归一+小写，与 moon-well R259 同口径；
    软上限 3000 词 LRU，`ts` 索引剪枝；读写失败按 miss/跳过降级）；② 有道 dictvoice 直连
    （SW fetch 吃 host_permissions 豁免，5s 超时，形制校验同服务端）；③ moon-well
    `POST /tts/dict-voice`（R259 词典真人音非 TTS，10s，404/断网/未登录都落下一级）。
    同词并发 single-flight；L2/L3 字节均回写客户端缓存。
  - content `speak()` 改 Web Audio 解码播放（`decodeAudioData` 老 Safari 回调形态兼容，
    chat.js 同款）：字节经消息通道，**对宿主页 CSP 免疫**——根治 R43 起 media-src 严格
    站点被页面 CSP 打回机械音的问题。`speakSeq`（stopSpeak 时 +1）+ `current.text` 双闸
    作废迟到响应/迟到回退；AudioContext 每页复用；`ctx` 悬挂或解码失败退机器合成。
  - 机器合成（speechSynthesis）退居最终兜底：四级全空 / 短语句子 / 解码或播放被拦。
- **守卫**：`scripts/check-extension-modules.js` 增 R66 契约段（VM 内存 IndexedDB 桩 +
  可控 fetch 真实执行 background.js）：直连命中回传形制与归一词序 / 缓存命中零出网 /
  直连失败→代理命中（登录态）/ 四级全空 `{ok:false}` / 形状闸零出网，5 组断言全绿。
- **集成套件**：`matrix/magiclens.csv` ml-speak 行改四级口径；`browser/run.js` 用例断言
  「SW 直连 dictvoice」+「二次朗读 IndexedDB 缓存零出网」+「直连命中不叠打代理」
  （mock 对 youdao 域有 R43 遗留成功路由，即第 2 级命中短路；第 3 级代理由 VM 契约测试
  与 moonwell T1 dict-voice 用例覆盖）——**magiclens T1 17/0/0/0 全绿**。
- **服务端配对**：moon-well R259（`/tts/dict-voice` + MinIO 永久缓存），其仓 LLD/台账各自
  回写；dev 已部署验证（api-docs 见端点）。
- **文档四问**：L1 README 功能表「划词朗读」行 + API 契约速查新增 `/tts/dict-voice`；
  L2 design.md 追加决策 19；LLD 落 `iterations/1.0/r66-dictvoice-cache/lld.md`。
- **发布范围**：push develop `b034224`（测试版不触发发布）；正式发布待用户确认后按
  §0.2 两段式（去时间戳后缀 → merge release）。
- **手工 AC（待真机验收）**：单词点 🔊 真人音；同词第二次秒出（缓存）；短语/句子合成音；
  关气泡即停；断网单词仍机械音兜底。
- **PingCode**：idea 未建，待用户令补建挂 ML-56+（本条先台账承载）。

**台账总结**：`requests.md` 第 66 条由 `claim.sh` 占号即 push（`ce139f3`）；response.md 现
7 节未超窗口。冲突记录：无撞号；R65 为今日已完成的 docs-only 任务（worktree 纪律同源修订，主号 ops R187），本条顺延 R66。

## 2026-11-14（R67：段落整页翻译——translate-batch 攒批懒加载 + 双语内联渲染）

**对 R67 的回应**：用户指令「把这个功能上线」——补齐 design.md §5 P1 收尾项
「剩段落整页翻译（translate-batch）」（R1-R66 全台账从未立项）。moon-well 零改动。

- **交付（0.8.28-202611142136 测试版）**：
  - `page-translate.js` 新模块（manifest 主清单 highlight.js 之后）：视口懒加载
    （IO rootMargin 400px per-doc）+ 攒满 8 段或 800ms 即发、单飞行顺序；译文以兄弟块
    插原段下方（textContent-only、内联 style 自包含，LI/TD 类插元素内部——ul/tr 下兄弟
    div 非法）；状态 chip closed Shadow DOM 左下角（进度/达上限提示/✕ 关闭/401 重新登录链）；
    页内内存缓存挡 toggle 循环重复扣费；单次开启 ≤100 段护栏；生命周期三件
    （storage.onChanged / onInvalidated / bfcache pageshow）与 highlight/content/ball 同模式；
    能力握手 `data-magiclens-page-translate`。
  - rpc.js MSG +2（ML_TRANSLATE_BATCH / ML_PT_TOGGLE）；background 两 case：批量端点
    `/vocabulary/reading/translate-batch`（60s 超时，SW 侧兜底归一/去空白/≤20 段/每段 ≤2000
    ——服务端 `@Size` 镜像）；toggle 转发给 sender tab（收不到回「请刷新页面」可行动文案，
    R63 教训）。悬浮球 +1 气泡（🌐，经 SW 转发）；popup +1 按钮（直发 tabs.sendMessage）；
    highlight.js `skipped()` 排除译文标记（译文英文词不进判定矩阵）。
  - **设计要点**（design.md §20 ADR）：攒批是契约级设计——服务端把一次请求内的 miss 段
    合并为一次 LLM 调用（8 段 1 积分 vs 逐段 8 积分）；译文块是内容性插入不属 UI 面板，
    §0.2 的 Shadow DOM 约束精神（样式隔离/无全局污染）不受损。
- **守卫**：check-extension-modules.js +R67 契约段全绿（MSG 两键 / manifest 注入位 /
  归一过滤截断与 20 段上限 / 空段落护栏零出网 / 积分不足文案透传 / `""` 段透传）；
  node --check 全过。
- **集成套件（同任务内同步）**：matrix/magiclens.csv +1（ml-page-translate，15 行）；
  e2e_bridge.py +1；browser/run.js +1 特性用例（开启 → 6 段单批 body 断言 → 内联块渲染 →
  关闭清干净 → 三开页内缓存零新请求）+ translate-batch mock 路由（result 按请求段落序动态
  生成）+ pages/article.html fixture——`guard.py` 三向对账全绿，套件 magiclens 18/18 PASS
  （0 FAIL 0 SKIP），浏览器全特性回归 15/15。
- **文档四问**：L1 README 新「整页翻译」节 + 悬浮球气泡清单 +「规划中」注记移除；
  L2 design.md 追加决策 20；LLD 落 `iterations/1.0/r67-page-translate/lld.md`。
- **手工 AC（待真机验收）**：英文页开/关与滚动渐进出译文；关闭移除干净、刷新重置；
  同源 iframe 页出译文；积分不足/401 文案；生词高亮不点亮译文；magicbook 域球让位但
  popup 按钮可用。
- **PingCode**：idea 未建，待用户令补建挂 ML-56+（R66 同口径，本条先台账承载）。

**台账总结**：`requests.md` 第 67 条由 `claim.sh` 占号即 push（`5122f3d`）；response.md 现
8 节未超窗口。冲突记录：无撞号。

## 2026-11-15（R68：划词链路加固——控件选区双轨检测 + 气泡响应判代防漂移）

**对 R68 的回应**：wupage（GPL-3.0，只学思路不搬码）研读报告 P0 两项落地 + 在册缺陷
「GitHub code view 划词不弹」。moon-well 零改动，纯扩展侧。

- **交付（0.8.29-202611150857 测试版，`5b38c49` merge 即清分支）**：
  - `content.js selectionInfo` 双轨制：控件轨（textarea/input 文本类读
    `selectionStart/End`——控件选区不进 `window.getSelection()`，旧逻辑在此整段失效；
    readOnly 允许查询只挡替换）+ range 轨保留并加 shadow 探针（`ShadowRoot.getSelection`
    有值优先）；只读零干扰（不 focus/不 setSelectionRange/不拦事件）。
  - 控件锚点：光标行号 × 行高近似定位，三重回退字段矩形（GitHub 整文件透明 textarea
    直接贴字段矩形会把气泡钉在文件顶部）。
  - `selection-relay.js` 同口径控件轨（iframe 内输入框此前同样不弹）+ `sendSelection` 抽取。
  - **translate 判代**：`current` 加 `seq`，三赋值点统一 `seq: ++bubbleSeq`，回调 stale
    检查文本比对 → seq 比对（同词关泡重开旧响应不得复活——R63 词卡漂移的机制层收尾）；
    详解/朗读此前已有各自判代不动。
- **GitHub 边界实测（修正 11-14 判断）**：扩展注入正常、单击定位写 textarea，但拖选/
  双击/键盘 Shift 选择均由 GitHub JS 层自管（三路径实测不落任何标准选区 API，渲染层
  无稳定契约）→ 本修复恢复「标准控件行为」站点；GitHub 拖选特例不可行（wupage 同样
  无此特判），是否立项待用户拍板。
- **集成套件（同任务内同步）**：matrix +1（ml-control-selection，16 行）、run.js 新用例
  （普通 textarea + readOnly 模拟 GitHub 透明层）+ iframe-relay 控件轨补断言 +
  control-selection.html/iframe-child.html fixture；**顺手修 run.js 预存 ReferenceError**
  （总结打印引用循环内变量 → 全 PASS 也 exit 2，退出码门禁被废）。`guard.py` 三向全绿、
  套件 16/16 PASS、真站四场景全绿（详见 LLD §4）。
- **调试教训（存档）**：closed Shadow DOM 主世界 `host.shadowRoot` 恒 null——页面级
  探测必须走 CDP pierce（diag8-12 连续假阴性根因）；CDP pierce 的 closed shadow root
  在 `shadowRoots` 字段不在 `children`；品牌 Chrome 136+ 忽略 --load-extension，扩展
  E2E 必须用 CfT（套件 findCft 已有）。
- **文档四问**：L1 功能不变不涉；L2 架构不变不涉；LLD 落
  `iterations/1.0/r68-selection-hardening/lld.md`（状态行随验收回填）。
- **手工 AC（待真机验收）**：标准输入框/textarea 划词应弹、普通网页划词零回归、
  同词关泡重开无旧译文复活、GitHub blob 拖选不弹属预期（自管选择壁垒）。
- **PingCode**：idea 未建，待用户令补建（R66/R67 同口径，本条先台账承载）。

**台账总结**：`requests.md` 第 68 条由 `claim.sh` 占号即 push（`433b573`）、详情已回填；
response.md 现 9 节未超窗口。冲突记录：无撞号。配套 ops 仓套件改动随 ops main
`53d04ef` push。

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
