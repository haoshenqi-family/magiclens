# response.md — 对话回应记录（仅保留最近 10 个 request 的回应）

> 归档索引：[response-R1-R10.md](response-archive/response-R1-R10.md) · [response-R11-R15.md](response-archive/response-R11-R15.md)（2026-10-07 R25 完成时补执行 R10/R20 漏掉的归档） · [response-R16.md](response-archive/response-R16.md)、[response-R17-R18.md](response-archive/response-R17-R18.md)（2026-10-08 R28 收口时搬移） · [response-R19.md](response-archive/response-R19.md)（2026-10-08 R29 完成时搬移） · [response-R20.md](response-archive/response-R20.md)（2026-10-08 R30 完成时搬移） · [response-R21-R22.md](response-archive/response-R21-R22.md)（2026-10-08 R32 完成时搬移） · [response-R23-R24.md](response-archive/response-R23-R24.md) · [response-R28.md](response-archive/response-R28.md) · [response-R25.md](response-archive/response-R25.md)（2026-10-10 R35 完成时搬移） · [response-R26.md](response-archive/response-R26.md)（2026-10-10 R36 写入触发轮转搬移） · [response-R27.md](response-archive/response-R27.md)（2026-10-10 R38 写入触发轮转搬移） · [response-R29.md](response-archive/response-R29.md)（2026-10-11 R40 写入触发轮转搬移） · [response-R30-R31.md](response-archive/response-R30-R31.md)（2026-10-11 R41 集成时窗口超限搬移） · [response-R32.md](response-archive/response-R32.md)（2026-10-13 R43 写入触发轮转搬移） · [response-R33.md](response-archive/response-R33.md)（2026-10-14 R44 写入触发轮转搬移） · [response-R34.md](response-archive/response-R34.md)（2026-10-15 R45 写入触发轮转搬移） · [response-R35-R38.md](response-archive/response-R35-R38.md)（2026-10-16 R50 写入触发轮转搬移，窗口回 10 条 request 内） · [response-R45.md](response-archive/response-R45.md)（2026-10-21 R51 写入触发轮转搬移） · [response-R39.md](response-archive/response-R39.md)（2026-10-27 R52 写入触发轮转搬移） · [response-R46.md](response-archive/response-R46.md)（2026-10-27 R53 写入触发轮转搬移） · [response-R40.md](response-archive/response-R40.md)（2026-10-27 R54 写入触发轮转搬移） · [response-R47.md](response-archive/response-R47.md)（2026-10-27 R55 写入触发轮转搬移）

## 2026-10-11（R40：金山直连查词补报四股台账）

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

## 2026-10-16（R50：docs v2 迁移——单模块退化形态）

### R50（用户指令「moon-well 和 magiclens 也整理 docs」：家族文档架构 v2 试点第三仓）

- **范围**：纯文档结构迁移（`git mv` + 链接 / 口径改写），**零代码行为改动**——`extension/` 只动了 `background.js` 一行 Javadoc 里的文档路径；manifest 版本未递增，不触发发布。
- **前置处置（用户拍板「先原样提交再迁移」）**：主检出在途未提交的台账与文档先原样落库（commit `888a84e`）——requests 补落 R45/R46/R47/R49 四条、response 补 R45/R46/R47 三条回应、design.md §15/§16、架构评审 overview 状态行、R34 归档。「原样」提交：R48 台账条目仍缺这一既存缺口也照原样保留（见 R49 条目自述）。
- **窗口轮转（本条写入触发）**：写入前 response.md 实含 12 个 request（并行会话插入 R45–R47 时未按纪律轮转，窗口已超限）；本条写入前先把最旧的 R35 / R36 / R38 三节原样搬至新建的 `response-archive/response-R35-R38.md` 并登记索引（与占号同 commit `786961b`），窗口回 10 个 request（R39–R44 / R45–R47 / R50）。
- **物理搬迁（`git mv`，内容不改写）**：本仓为**单模块纯前端扩展**，按 v2 **退化形态**落地——**L1 仍是根 `README.md`**（不建 `docs/product/readme/`，不为目录对称把单模块硬拆）；`docs/design.md`（L2 ADR 兼任）→`docs/product/design.md`；`docs/feat/`（5 个：arch-review-2026-10 / chrome-extension / domain-management / vocab-highlight / word-detail）→`docs/project/_legacy/feat/`（**冻结归档、不回溯**）；`docs/webstore/listing.md`→`docs/product/webstore/listing.md`（产品级静态）；仓库根 `requests.md` / `response.md` / `requests-archive/` / `response-archive/`→`docs/project/requests/`。
- **链接口径**：脚本改写 8 条（`./docs/design.md` → `docs/product/design.md`、`./feat/...` → `../project/_legacy/feat/...` 等）+ 手工修 5 条随迁移变深 / 变浅的根文件相对链（`docs/product/design.md` 与 `docs/product/webstore/listing.md` 指向 `PRIVACY.md`、`.github/workflows/release.yml`）。改后 `docs/product`、`README.md`、`AGENTS.md` 相对链接存在性校验 **0 坏链**。代码侧同步 1 处（`extension/background.js` Javadoc）。
- **文档改写**：`AGENTS.md` 文档规范节整体改 v2 **退化形态**（L1 = 根 `README.md` / L2 = `docs/product/design.md` ADR 兼任 / L3 = `docs/product/features/<FEATURE>.md`；工作项目录标准结构；其他目录表；「交付四问」），工作流目标路径、前置阅读（补 L1/L2 入口）与「对话记录」节路径同步。
- **占号与基线**：台账占号 **R50**（全史最大 49 + 1，49 为家族迁入 PingCode 条目）；worktree 从本地 `develop` 切出（与 `origin/develop` 同点，0/0）。
- **未做 / 待决**：① Wiki 镜像重刷与前两仓同批**暂缓**（用户拍板）；② `docs/product/features/`（L3）与 `docs/project/iterations/` 从新工作开始建；③ 本仓无 `docs/tasks/`，未新建 `docs/project/tasks/`。
- **验证**：目录树与 `git status` 复核；相对链接存在性脚本 0 坏链；`AGENTS.md` 三处路径口径自检；`extension/` 无行为改动（无需手工清单全跑）。
- **收尾**：merge 本地 `develop`；worktree `../magiclens-docs-v2` 与分支 `refactor/r50-docs-v2` **原样保留待验收**（本仓验收方式 = `chrome://extensions` 加载该目录实测；本轮零代码改动，验收以目录与文档口径复核为主）。push 一条另行待批。

### R51（发布链纯文档跳过打包发布）

- **范围**：用户指令「修改一下部署脚本，如果只有文档更新，则不触发部署」；四仓同源 + 「触发但跳过」两口径拍板。本仓无部署产物，对应的是 `release` 分支的**发布**流程。
- **改动**：`.github/workflows/release.yml` 新增 `changes` job（compare API 取本次 push 改动文件 + 文档口径正则），`release` job 加 `needs` / `if` 门禁；纯文档 push 到 `release` 时打包 zip 与 GitHub Release 创建整体跳过，step summary 留痕。
- **文档口径**：`docs/`、`doc/` 下任意文件、`*.md`、`LICENSE`、`.gitignore`、`.gitattributes`；判定失败 / 首次推送一律走原判定（安全侧）。
- **验证**：YAML 解析通过、`bash -n` 通过、桩响应端到端 5 例符合预期（纯文档 true，其余 false）。
- **驻留**：worktree `../magiclens-doc-skip-deploy`，分支 `chore/r51-doc-skip-deploy`，合并 commit `875166e`（本地 `develop`，未 push）。

### R52（伴读抽屉对齐 magicbook R232/R233：回复不显示 token 用量、站内链接新窗口可点）

- **背景**：用户指令「阅读近期 magicbook 的能力提升，同步到 magiclens」。盘点 magicbook 2026-10-26 批次：R232（伴读面板隐藏 token 用量）在本仓有**已登记遗留**（magicbook R232 LLD §5 点名 `chat.js` onFinal 的 `tokens x+y`，彼时「只记录、不夹带修改」）；R233（AI 回复站内链接可点、新窗口）同期上线；R234（悬浮球快捷动作 chat 钉首位）本仓无快捷动作 UI，**不适用**。
- **交付（worktree `../magiclens-r52-buddy-parity`，分支 `feat/r52-buddy-parity`，版本 0.8.15-202610271026 测试版）**：
  - `common.js`：新增 `__magicLensSiteOrigin` 常量（`https://magicbook.haoshenqi.top`）与 `__magicLensAssistantHtml()` 助手消息安全渲染器（纯函数，node 可直测）——安全口径逐条移植 magicbook `ai_chat.js` R233：先整段转义再受控还原、href 白名单归一化（拒控制字符/反斜杠/`//host`/外部 origin/userinfo/非 http(s)）、`target="_blank" rel="noopener noreferrer"`、围栏代码隔离、尾随标点出链。**三处刻意分叉**：① origin 用常量（content script 的 location 是宿主页）；② href 写绝对地址（相对路径会解析到宿主页 origin）；③ 裸路径 token 只吃 ASCII（上游字符类放行 CJK，`/credits，或者` 会被整段吞进 href；本仓顺带修掉、未回提上游）。
  - `chat.js`：`onFinal` 删 token 用量展示（`usage` 不再消费；`conversationId` 回填与非 COMPLETED 状态提示保留——R232 守卫口径「删用量不许顺手删分支」）；流式原文缓冲 `acc`，final 与历史渲染统一走渲染器（历史里书内会话的 `/book/N` 同样可点）；抽屉 CSS 补链接/代码样式。
  - moon-well 零改动：`final` 帧 `usage` 照旧下发，扩展只是不消费；用量唯一入口 = magicbook 设置·积分。
- **验证（诚实）**：`node --check` 两文件全过；渲染器 node 冒烟 23 例全过（链接/CJK 断词/标点出链/同源归一/query·fragment 保留/外链·`//host`·`javascript:`·userinfo·反斜杠·控制字符拒绝/HTML 转义/代码块隔离/粗体/换行/空串/注入 origin 隔离）；**真机手工清单待用户**：从本 worktree 重载扩展 → ① 回复气泡下不再出现 `tokens x+y`；② 让 AI 给本站链接（如「我的积分页在哪」），点击新窗口打开 magicbook 对应页；③ 历史会话里的旧回复同样可点链接、无 token 行；④ 代码块与外链仍为文本。
- **文档**：README 功能表回填；LLD `iterations/1.0/r52-buddy-parity/lld.md`；迭代 `plan.md` 增 MAGICLENS-6。
- **台账**：worktree `../magiclens-r52-buddy-parity`（分支 `feat/r52-buddy-parity`）merge 后驻留待验收，验收通过后 remove + branch -d；未 push（push develop 不触发发布；正式发布需用户确认后去时间戳 merge release）。窗口轮转：本条写入前已把最旧的 R39 原样搬至 `response-archive/response-R39.md` 并登记索引，写入后窗口 10 条未超限。
- **总结**：requests.md 占号 R52（claim.sh `e56575e`）；PingCode idea [ML-51 / 6Lljn2pb](https://haoshenqi.pingcode.com/ship/ideas/6Lljn2pb)（Pending → In progress，待验收后 Completed）；response.md 本条；冲突记录：无。

### R53（伴读抽屉语音双向，对齐 magicbook R227：麦克风转写输入 + 回复朗读）

- **背景**：用户对 R52 汇报的拍板「要做」。R227 双向口径承接：录音→16k wav→ASR 转写→**追加**输入框不自动发送；每条助手回复「🔊 朗读本条」手动点，≤1800 字分段顺序播，`/tts/speak` 听=消费、不带书籍上下文落 7 天临时档。moon-well/magicbook 零改动。
- **交付（分支 `feat/r52-buddy-parity` 同树续作（家族口径第 7 条），版本 0.8.16-202610271104 测试版，manifest permissions + `offscreen`）**：
  - **录音宿主 = offscreen 文档**（D1）：content 录音要逐站点授权麦克风、http 页拿不到 getUserMedia，SW 无 DOM；offscreen 属扩展 origin 一次授权。消息两套：`ml:rec-start/stop/cancel`（content→SW）与 `ml:rec-go/done`（SW→offscreen 转发）——content 的 runtime.sendMessage 广播到全部扩展上下文，offscreen 只认自己那组、其余不回话；popup/options/content/highlight 四处监听器逐一核实不会抢响应。
  - **采集核心移植 magicbook learning-voice.js**（D2）：16k wav 采集端编码（webm/opus 兼容性存疑不用 MediaRecorder）、R159 全静音 −46dB 判定、R158 失败必复位；新增 5 分钟硬顶（停采保音频 + 清引用，content 计时同步封顶）。
  - **播放 = Web Audio + 字节走消息通道**（D3）：SW 取 TTS 二进制转 base64 回传，content 解码播放——比 magicbook 的 CSP 规避更彻底，宿主页 media-src/connect-src 都不占用；自动播放拦截/suspended/老 Safari 回调形态三处兼容照搬。
  - **background 抽出 `callMoonWellRaw`**（D4）：鉴权+超时+401 静默刷新单点，callApi（JSON）委托之，ASR（multipart）与 TTS（二进制）复用同分支；TTS 失败体 Result 信封必带出 message（积分不足不伪装成播放器坏了）；TTS 超时 180s（本地 Qwen3-TTS 分钟级）、ASR 60s。
- **验证（诚实）**：node --check 五文件全过；node 冒烟 22 例全过（分段边界×8、base64 跨块往返、**encodeWav 抽源码实跑**校验 RIFF 头/16k/16bit/样本数）；MSG 表 23 键引用一致；callApi 重构 diff 逐行自审（retried 守卫保留）。**真机手工清单待用户**：①🎤 说一句→停止→转写进输入框可编辑发送；②首次授权只弹一次；③🔊 出声/再点停止；④长回复「朗读中 n/m」；⑤关抽屉朗读立停；⑥积分不足报「积分不足」。
- **文档**：README 功能表与 API 契约表回填（`/tts/speak` 转「部分接入」+ 补 ASR 行）；LLD `iterations/1.0/r53-buddy-voice/lld.md`；迭代 plan.md 增 MAGICLENS-7。
- **台账**：worktree `../magiclens-r52-buddy-parity`（分支 `feat/r52-buddy-parity`）merge 后驻留待验收（R52+R53 两批一起验）；未 push（正式发布需用户确认后去时间戳 merge release）。窗口轮转：最旧的 R46 原样搬至 `response-archive/response-R46.md` 并登记索引，写入后窗口 10 条。
- **总结**：requests.md 占号 R53（claim.sh `f9805c8`）；PingCode idea [ML-52 / 1nxbdoBF](https://haoshenqi.pingcode.com/ship/ideas/1nxbdoBF)（Pending → In progress，待验收后 Completed）；response.md 本条；冲突记录：无。

### R54（常驻入口悬浮球：设置开关 + 首次安装引导选择）

- **背景**：用户需求「添加一个常驻入口，可以用户选择是否开启常驻。首次安装插件的时候，提示用户选择。」此前伴读抽屉唯一入口是划词「问 AI」（R52 汇报指出，用户随即拍板补常驻入口）。
- **交付（分支 `feat/r52-buddy-parity` 同树续作（家族口径第 7 条），版本 0.8.17-202610271714 测试版）**：
  - `ball.js`（新 content script，manifest 组 2 末位=仅顶层文档）：右下角 44px 圆钮（AI 字样，closed Shadow DOM），点击经同隔离世界钩子 `__magicLensAsk('')` 直接打开伴读抽屉——零新消息类型、零 background 改动；显隐判定走 common.js 新纯函数 `__magicLensBallVisible`（主开关 × 球开关 × 顶层文档 × 域名管理名单，名单复用 `__magicLensIsDisabledHost` 同一份语义）；挂 `storage.onChanged` **实时显隐**（已打开页面无需刷新）；rpc `onInvalidated` 失效退役（扩展重载后旧球自行摘除）。
  - 设置页：新增「常驻入口」复选框；页首引导卡片「要把伴读入口常驻到每个网页吗？【开启常驻入口】【暂不开启】」——只问一次（`ballAsked` 落库后永不再问），安装时 background 既有 `onInstalled(install) → openOptionsPage()` 自动打开本页正好承接。
  - **默认关闭**：常驻悬浮球属侵入性 UI，未经选择不突现；存量用户升级（update 不自动开设置页）行为零变化。任何一次明确选择都同时写 `ballEnabled+ballAsked`，避免「关了开关又被问一遍」；走 `storage.sync` 跨设备一致。
  - 交叉审查修掉一个穿层：球 z-index 2147483646→**2147483645**，抽屉打开时球被半透明遮罩盖住不浮在遮罩上。
  - v1 不做拖拽换位与 popup 快捷开关（LLD §1 遗留登记）。
- **验证（诚实）**：`node --check` 三文件全过；`__magicLensBallVisible` node 冒烟 10 例全过（全开/球关/主开关关/iframe/禁用域名及子域/其他域名/URL 形态条目/默认值两项）；options DOM id 齐全性脚本 html+js 双侧命中。**真机手工清单待用户**：① 设置页出现引导卡片；② 点「开启」→ 已打开网页不刷新即现球；③ 点球开抽屉；④ 关开关球立刻消失；⑤ 域名管理站点球不显示；⑥ 抽屉打开时球不穿层；⑦ 重载扩展旧球随旧副本退役。
- **文档**：README 功能表增「常驻入口悬浮球」行；LLD `iterations/1.0/r54-ball/lld.md`；迭代 plan.md 增 MAGICLENS-8。
- **台账**：worktree `../magiclens-r52-buddy-parity`（分支 `feat/r52-buddy-parity`）merge 后驻留待验收（R52/R53/R54 三批一起验）；未 push（正式发布需用户确认后去时间戳 merge release）。窗口轮转：最旧的 R40 原样搬至 `response-archive/response-R40.md` 并登记索引，写入后窗口 10 条。
- **验收修订 v2（2026-10-27 同日，0.8.18-202610271758，同 worktree 续作）**：用户修改意见「这个悬浮球和 magicbook 的保持一致，使用 buddy 形象，悬浮提供更多选项。」ball.js 重写为 magicbook R223 同形态——①**buddy 形象**：56px 透明头像球（moon-well `/buddy/catalog` JWT 取 equipped 伙伴 MinIO 直链，probe 成功才切、失败保蓝色「AI」兜底；`ML_API` 白名单加 `/buddy/catalog`）；②**hover 径向快捷气泡**（类 iPhone AssistiveTouch）：五项动作 💬 对话（恒首位，R234 扩展侧同构）/〰 生词高亮（background 新增 `ML_HL_TOGGLE` 转发，与 Alt+U 同链路）/🎓 每日学习 /📚 书库 /👤 我的（新标签开 magicbook）；扇区 120°/贴边 90°、半径 74px、弹簧曲线、350ms 延迟关闭、方向自适应——几何与交互逐段移植 magicbook；③**拖拽吸附 + 位置记忆**：pointer-capture 延迟 6px 阈值（R223 真机修法），位置存 `chrome.storage.local` per-hostname（禁污染宿主 localStorage）。验证：node --check 过 + 几何冒烟 12 例全过（径向数学独立复算，初版预期按「向上扇」误算 5 例、复核公式后全绿，生产代码为逐行移植未改）；手工清单追加 ⑧-⑪（头像同步/五气泡动作/拖拽吸附/延迟关闭）。LLD §5 修订版含与 magicbook 的四处刻意分叉表（头像通道/动作集配置性/位置存储/动作语义）。
- **总结**：requests.md 占号 R54（claim.sh `c0e00fd`）；PingCode idea [ML-53 / G8snk5AS](https://haoshenqi.pingcode.com/ship/ideas/G8snk5AS)（Pending → In progress，待验收后 Completed）；response.md 本条；冲突记录：无。

### R55（缺陷：R48 金山直连模块化回归——`icibaLookupWithStemming` 未导出）

- **根因**：R48 把金山直连域从 `background.js` 迁到 `iciba.js` 时，模块公开键写成 `lookupWithStemming`，但 `background.js` 仍按内部函数名解构：
  `const { WORD_PATTERN, icibaLookupWithStemming } = __magicLensIciba;`
  得到 `undefined`。错误只在 `ML_TRANSLATE` 消息回调触发时暴露，因此模块加载与 `node --check` 均不报错；用户划词即看到 `TypeError: icibaLookupWithStemming is not a function`。
- **修复（分支 `feat/r52-buddy-parity` 同树续作，版本 0.8.19-202610272026 测试版）**：`background.js` 改按模块公开键解构并显式别名 `lookupWithStemming: icibaLookupWithStemming`；新增 `scripts/check-extension-modules.js`，在 Node VM 中真实执行 `common.js → rpc.js → iciba.js → background.js`，触发 `ML_TRANSLATE('hello')`，断言直连响应 `{ok:true,data:{text,translation,source:'iciba'}}`。
- **验证（诚实）**：`node --check extension/*.js scripts/*.js` 全过；新守卫通过。**鉴别力对照**：把同一守卫指向修复前 `background.js`（HEAD 版本）会复现 `TypeError: icibaLookupWithStemming is not a function`，证明断言不是自证。未改动金山查词行为、词干口径、缓存或 moon-well 回退。
- **文档四问**：用户可见能力未变 → README 不改；契约边界（模块公开键与 SW 消费键）变了 → L2 `docs/product/design.md` §7 追加更新注记；实现/边界回填 → 新增 L3 `docs/product/features/iciba-direct.md`；本次怎么实现 → LLD `iterations/1.0/r55-iciba-export/lld.md`（状态已回填）。
- **台账**：`requests.md` 占号 R55（claim.sh `872578a`）；worktree `../magiclens-r52-buddy-parity`（分支 `feat/r52-buddy-parity`）merge 后驻留待验收。R48 历史台账缺条按原样保留，不借本轮静默补写。
- **待用户真机验收**：`chrome://extensions` 从该 worktree 重载 → 任意网页划单个英文单词，应正常出词典译文（无 `TypeError`）；再验证 miss 单词仍回退 moon-well、短语翻译不受影响。
- **总结**：response.md 本条；冲突记录：无。本条写入后 response 窗口 11 条，按纪律把最旧的 R47 原样搬至 `response-archive/response-R47.md` 并登记索引。
