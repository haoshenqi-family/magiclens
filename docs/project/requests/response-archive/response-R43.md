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
