# response-archive — R11~R15（原样搬移自 response.md，2026-10-07 R25 完成时补归档）

## 2026-10-06（二）

### R11（发布流程：X.Y.Z 验证通过后自动发 GitHub Release，-YYYYMMDDHHmm 测试版不发布）

- **回应**：已按两段式版本规则补齐自动发布链路（仓库 public 后启用）：
  - **新增 `.github/workflows/release.yml`**：push 到 `develop` 后读 `manifest.json` 的 `version_name`——纯 `X.Y.Z`（功能验证通过后清理了时间戳）→ 打 `vX.Y.Z` tag、创建 GitHub Release（`--generate-notes`）并附 `extension/` 打包 zip（`magiclens-extension-vX.Y.Z.zip`，排除 `.DS_Store`）；带 `-YYYYMMDDHHmm` 后缀（测试版）或 Release 已存在 → 跳过。workflow 权限仅 `contents: write`。
  - **文档同步**：AGENTS.md §0.2 版本号规则升级为两段式（测试版=修改完成即递增带时间戳、不发布；正式版=验证通过后去时间戳再推送，自动发 Release），§3 验收流程补「发布正式版」步骤，§2 交付标准标注测试版不触发发布；`docs/design.md` 新增 §6 ADR；README 安装章节补 GitHub Releases 下载方式。
  - **校验**：workflow YAML 解析通过；版本判定门用真实 manifest 实测——`0.4.1-202610061607`→跳过、`0.5.0`→发布、`0.5.0-202610071200`→跳过、异常 `0.5`→保守跳过。
  - 当前工作区 `0.4.1-202610061607` 属测试版，推送后不会触发 Release；首次发布将发生在验收通过、清理时间戳（如 `0.4.1`）推送后。
- **总结**：
  - requests.md：占号 R11。
  - response.md：本条。
  - 冲突记录：无。

## 2026-10-06（三）

### R12（GitHub 没有Release → 确认验收后发布 v0.4.1）

- **回应**：先说明这是规则内的正常状态——此前推送的是测试版 `0.4.1-202610061607`（带时间戳，按 R11 规则不触发发布，workflow 日志确认走了跳过分支）。经用户确认 v0.4.1 验收通过后执行发布：
  - `manifest.json` 的 `version_name` 清理时间戳为纯 `0.4.1`（`version` 不变），commit `432eef1` 推送 develop；
  - `release.yml` 自动跑完（run 37453547448，10s），**首个 GitHub Release 已上线**：tag `v0.4.1`，标题「MagicLens 词镜 v0.4.1」，附 `magiclens-extension-v0.4.1.zip`，https://github.com/haoshenqi-family/magiclens/releases/tag/v0.4.1 ；
  - 已下载 zip 实测：`extension/` 文件齐全，manifest 为 `0.4.1 / 0.4.1`，可直接「加载已解压的扩展程序」。两段式发布的「正式版路径」至此在真实 CI 上全链路验证通过。
- **总结**：
  - requests.md：占号 R12。
  - response.md：本条。
  - 冲突记录：无。

## 2026-10-06（四）

### R13（划词翻译 `exact` 卡死：排查 + 扩展侧超时/孤儿上下文修复）

- **回应**：排查定位为**两条互相独立的缺陷**，按用户选定范围 A+C 修复（B「收紧交互 LLM 超时」未选，不动）。
  - **① 卡死本体在客户端（本次症状）**：「译」气泡永久转圈。证据链——后端 `app-log-moon-well` 近 3 天日志检索该单词**零 translate 请求**（`HttpLoggingFilter` 只在请求完成时落日志，配合 18:58 容器重建会抹掉未 flush 的在途请求，故补测了网络链路：Server 2→fnOS moon-well 9ms、公网入口 195ms，均 401 正常响应，链路健康），说明请求**从未发出**。根因：今日发布 v0.4.1 后用户在 `chrome://extensions` 重载扩展，已打开标签页里的旧脚本副本上下文失效，`chrome.runtime.sendMessage` 改为**同步抛** `Extension context invalidated`，四个调用点都没接住 → loading 文案无人改写。
  - **② 顺带查出的服务端真缺陷（「详」，另行批准）**：单词详解缓存 100% 失效——`elasticsearch-rest-high-level-client 7.5.0` 的 `indices().exists()` 仍带 ES 8 已删除的 `include_type_name=true`，对 ES 8.11.3 每个索引必返 400 `illegal_argument_exception` → 索引 `magicbook-vocabulary` 从未建成（`nas_file_analysis_v1` 同样缺失，互证）→ 每次点「详」都进 LLM（烧额度）→ 智谱 GLM Coding 端点 60s 读超时、60.5s 返 500。已在 moon-well 侧修复并全量测试绿，见该仓库 **R104**（DDL 改走低层 `RestClient`）。
  - **修复（扩展侧，manifest `0.4.2-202610062017` 测试版，不触发发布）**：
    - `background.js`：`callApi` 增 `timeoutMs`（默认 `TIMEOUT_MS=20000`，`ml:detail` 单独 `DETAIL_TIMEOUT_MS=120000`，冷词要整段 LLM 生成），`fetch` 带 `AbortSignal.timeout()`（manifest 已有 `minimum_chrome_version: 110`，Chrome 103+ 才有该 API），`TimeoutError/AbortError` 归一成「请求超时（20s），请稍后重试」；401 重试分支透传 `timeoutMs`；`refreshTokens` 一并加超时。至此**任何上游卡住都会以错误文案收尾，不再有永久转圈**。
    - `content.js`：新增 `askBackground()` 统一中转——先探 `chrome.runtime.id`，同步抛且命中 `invalidated|disposed` 即 `retireOrphan()`（置 `dormant`、摘四类监听、移除 Shadow DOM host、console.warn 提示刷新），其余错误归一成 `{ok:false,error}` 交给调用方展示；`translate/mark/detail/登录链接` 四处调用点全部改走它，删掉原先重复的 `chrome.runtime.lastError` 分支；四个匿名监听改为具名 `onMouseUp/onMouseDown/onKeyDown/onScroll`，否则孤儿副本的监听摘不掉、会在页面上留一个「点了没反应」的幽灵气泡。
    - `chat.js`：伴读抽屉的 `api()` 同样补 try/catch（失效文案「扩展已更新，请刷新本页面（F5）」）、「重新登录」链接改带回调并吞掉 `lastError`；SSE 直连已有 `state.abort`（停止按钮 / 关抽屉即断），不在本次范围。
  - **交叉审查**（独立 agent 复审两条修复）：结论「无 P0，修复方案技术上成立」（并核实 7.5.0 HLRC 的 `IndicesRequestConverters` 确实无条件带 `include_type_name`）。采纳并修掉两条：
    - **`background.js` 续期超时不得清凭据**（P1，由本次新增超时的副作用引出）：`refreshTokens` 加超时后，一次慢网络轮会让 `catch` 把 `token`/`refreshToken` 一起抹掉，把抖动升级成全标签页强制重登。现按错误类型分流——`TimeoutError/AbortError` 只回「登录续期超时（20s），请稍后重试」（`status:0`、不带 `auth`，因此不出现「重新登录」链接），只有 refresh 真被服务端拒绝才清凭据强制重登。
    - **失效文案统一走分类器**（P2）：`askBackground` 的同步抛与异步 `lastError`（请求在途时重载扩展）两条路共用同一判定，命中 `invalidated|disposed` 一律退役，不再把英文原文糊进气泡；`chat.js` 的 `api()` 同样归一为「扩展已更新，请刷新本页面（F5）」。
    - **记为遗留、本轮不动**（避免事故轮夹带语义变更）：①两个并发 401 同用旧 refreshToken 续期，若服务端轮换令牌，失败方仍会清掉成功方的新令牌对（既有竞态，需改为「比对存储里的 refreshToken 是否已变」再决定是否清）；②`content.js` 登录回调页 `ml:login-ok` 的同步抛未包 try，扩展在登录过程中重载会导致 `window.close()` 那行不执行、回调标签页不自动关（令牌已存，影响极小）；③`chat.js` 发首句前 `await getCfg()` 在 try 之外，孤儿上下文下是静默失败（非永久转圈），SSE 仍只靠「停止」按钮 abort。
- **校验**：五个 JS 全过 `node --check`；manifest JSON 解析通过；`version_name` 带时间戳（popup 动态读 `getManifest()`，无需改文案），按 R11 规则不会触发 Release。
- **待用户验收**（本机无浏览器扩展运行时，无法 E2E）：①重载扩展 → 任意网页划词 → 「译」正常返回或**报错即显示文案、不永久转圈**；②再次重载扩展后在旧标签页划词 → 气泡退役、console 出现 `[MagicLens] 扩展已更新…刷新页面（F5）后生效`；③moon-well 重新部署后点「详」：首次在线生成并落 ES 索引，第二次应几十毫秒命中缓存。
- **总结**：
  - requests.md：占号 R13。
  - response.md：本条。
  - 冲突记录：无。
  - 未决事项：②的服务端修复需 moon-well 重新部署才生效（R104 已本地绿，部署与推送待用户单独确认）；扩展改动同样只在工作区，未 commit/push；按 AGENTS.md §4「验证通过后同步更新文档」，把「每个中转请求必须带超时」「content script 发消息必须走 askBackground、上下文失效即退役」写进 §0.2 硬性约定与 `docs/design.md` ADR 的动作，留到上述手工验收通过之后。

### R14（生词智能高亮：借鉴「明畅」机制落地 P1 生词标注）

- **回应**：按既定借鉴方案完成开发（manifest `0.5.0-202610062153` 测试版，不触发发布）。机制来源：对「明畅·个人词库」扩展（mingchang.wang，开源 github.com/wamich/personal-vocabulary）的静态逆向（逆向结论存家族项目记忆 `mingchang-extension-highlight-analysis`），设计文档 `docs/feat/vocab-highlight/design/lld.md`，moon-well 后端零改动。
  - **判定链路（borrowing 明畅判定矩阵 → moon-well 同构实现）**：初次扫描 `POST /vocabulary/reading/analyze`（服务端语义恰为明畅矩阵：单词本手动标记 familiarity 优先 + magicbook_word_level 词档 > 用户 hard_level 兜底，其余默认认识）→ 生词列表渲染；网页生词顺带进 reading_vocabulary 阅读事件流，与 magicbook 学情/复习互通（选 analyze 而非纯查询接口的决定性理由）。SPA 动态增量走 `POST /vocabulary/familiar`（无事件副作用）。去重键 origin+pathname+search（不含 hash，锚点跳转不重扫虚增学情）；首屏 <300 字符延迟 2s 重试一次；请求体防御性截断 150,000 字符。
  - **渲染引擎（borrowing 明畅核心工程）**：CSS Custom Highlight API（`::highlight(ml-vocab)` 紫色波浪线，constructable stylesheet 挂文档级——::highlight 只认文档样式的规范例外已在设计文档批准）零 DOM 改动；两级缓存（nodeRaws 纯数据 / nodeRanges 已物化 Range）+ IntersectionObserver 视口懒渲染 + MutationObserver 800ms 防抖增量；变形归并规则版（-s/-ed/-ing/-er/-est/双写/去 e/ies/ves，双向匹配）；点高亮词 `caretRangeFromPoint` 程序化选中后复用划词气泡全流程（preventDefault 阻断 <a> 导航）；气泡里标认识/生词经 `window.__magicLensOnMarked` 全页即时回写（含变形）；扩展重载后旧副本经 askBackground 失效路径轻量退役（对齐 R13「失效即退役」）。
  - **配套**：`background.js` 新增 `ml:analyze`/`ml:familiar` 中转与 `chrome.commands` Alt+U（无 content script 页面回退为直接翻转 storage）；`content.js` 补 host id、暴露 `__magicLensProcessSelection`、mark 成功回调回写高亮（闭包捕获词，防气泡关闭/换词错写）；popup 增生词高亮开关与「重新扫描本页」；`manifest.json` 注册 highlight.js 与 commands，版本两段式递增 0.5.0。
  - **交叉审查**（独立 agent，只读）：反馈 2×P0 + 7×P1 + 若干 P2，**全部采纳修复**——P0① boot 在 storage 回填前执行导致自动扫描永不触发（boot 挪进回调）；P0② 在途 analyze/familiar 响应在关停后复活引擎（回调复查启用条件 + teardown 清 scanning/防抖队列）；P1：mark 回调引用 `current.word`（闭包捕获）、hash 触发重扫（pageKey 去重）、MO 在响应后才安装漏标在途渲染（引擎预启动）、mouseup/click 双路重复翻译（processSelection 同选区 500ms 去重）、链接内高亮词点击跳转（命中时 preventDefault）、allTexts 死节点泄漏（dropNode/rescan 同步剔除）、popup 假成功（runScan 据实返回）；P2 择要：Alt+U 现读现翻、familiar 候选用 matchWord 判定、dropNode 快路径、bfcache 重建注册表、caretRangeFromPoint 存在性守卫、重试保留最短文本检查、analyze 成功后旧节点一并重估。
- **校验**：七个 JS 全过 `node --check`，manifest JSON 解析通过；文档四件套同步（design.md 分期 / README 功能表 / AGENTS.md §0.1 / 本文件）。
- **待用户验收**（真机手工清单，对应 lld.md）：①已登录状态打开英文页 → 生词自动波浪线高亮；②点击高亮词 → 划词气泡弹出（含链接内词条不跳转）；③气泡标「认识」→ 全页该词含变形熄灭，标「生词」→ 点亮；④Alt+U 与 popup 开关即时生效、刷新后保持；⑤popup「重新扫描本页」真实生效；⑥moon-well 侧词汇表/复习队列出现网页生词（学情互通）；⑦中文页/未登录不发扫描请求。
- **总结**：
  - requests.md：占号 R14。
  - response.md：本条。
  - 冲突记录：无。
  - 未决事项：改动仅在工作区未 commit/push；不规则变形（went）不高亮为已知缺口（与 magicbook 现状一致，待词典数据接入）；真机验收通过后再按两段式规则发正式版。

## R15 回应：金山 API 前端直连可行性评估

**结论：可行，且纯扩展侧改动（moon-well 零改动、magicbook 不受影响），但收益仅限「单个英文单词」场景。**

关键事实（实读代码核实）：

1. **无权限障碍**：manifest.json 已是 `host_permissions: ["<all_urls>"]`，background service worker 直连 `dict-mobile.iciba.com` 天然豁免 CORS（也符合 AGENTS.md「请求必须经 SW 中转」硬约定——「放前端」= SW 直连，content script 仍不直接发请求）。
2. **无凭证风险**：金山 suggest 接口免费无凭证（`IcibaDictClient.java` 注释确认），不存在密钥下发问题。
3. **复刻成本低**：解析逻辑 = 取 `message[0]` 且 `key` 与查询词全等（忽略大小写）→ `paraphrase`；词形还原 `WordStemmer.java` 仅 65 行，JS 照抄即可。

能省多少时间：现路径为浏览器 → Traefik(Server 2) → Tailscale → fnOS moon-well → ES 缓存 → NAS 出网查金山 → 原路返回（两段 TLS + 一段隧道）；直连只有浏览器 → 金山一跳（国内百毫秒级）。R122 诊断显示浏览器→moon-well 入口间存在 ~5.9s 未解释盲区（疑似 PMTU/Traefik，未复现），若该链路问题同样作用于词典请求，直连收益更大；重复词再配 `chrome.storage.session` 本地缓存可零网络命中。注意 LLM 兜底路径（短语/句子/词典 miss）的时间大头是 LLM 生成本身，本改动帮不了那些场景。

设计要点（供确认后实施）：

- background SW 对单词正则（`^[A-Za-z][A-Za-z'’-]*$`，与后端 WORD_PATTERN 一致）命中的划词先直连金山；miss/异常静默回退现有 `/vocabulary/reading/translate`——金山是非公开接口随时可能变，与后端同款降级哲学，ES 缓存/LLM/积分链路全部保留。
- 词干还原必须一并复刻（sidebars→sidebar、dog's→dog），否则变形词全 miss 落 LLM 反而更慢；Java/JS 两份 WordStemmer 需同步维护。
- 影响面：扩展直查后词典释义不再从插件侧写入 ES（magicbook 链路仍在写，无实际损失）；miss 时后端会再查一次金山但有 LRU 负缓存，代价可忽略；`source` 标签前端自产（tooltip「来源：iciba」）。

**总结**：requests.md 占号 R15；用户确认后已按编码工作流实施（v0.6.0-202610070816 测试版，moon-well 零改动）：

- `extension/background.js`：新增金山 suggest 直连块（URL/超时 2.5s/单词正则与后端一致）+ JS 版 Porter 词干还原 + `chrome.storage.session` 512 条 LRU 缓存（含 miss 负缓存）；`ml:translate` 改为单词先直查、miss/异常回退 moon-well 全链路。附带收益：未登录用户单词翻译也可用。
- **词干还原口径修正**：后端注释的 `wolves→wolve` 实为 Lucene 8.3.0 实测 `wolv`（`agreed→agre` 同理，原论文示例是 step1 中间值）；JS 版按 Lucene 实测口径实现（含 Lucene 特有 `bli→ble`、`logi→log` 规则），94 向量 + 停用词过滤全部对照真实 Lucene 验证通过。已在 `docs/design.md` §7 记录，moon-well 侧注释未动（纯措辞问题，不为其触发发版）。
- **验证**：`node --check` 语法通过；94 向量 Porter 对齐测试全过；真实金山接口验证解析口径（`sidebar` 命中/`sidebars` 模糊匹配被拒/乱码词负缓存）；chrome API mock + 真实金山接口的端到端模拟 10 项全过（直查/词干还原/session 缓存直出/trim/所有格/乱码回退/短语不查金山/未登录单词可用/未登录短语报登录/停用词）。
- **文档同步**：`docs/design.md` 新增 §7 ADR；README 架构图加金山直连虚线、划词翻译功能行更新。manifest 递增 `0.6.0-202610070816`。
- **待用户验收**：`chrome://extensions` 重新加载扩展 → 任意网页划单词（原生词/复数/所有格/短语/乱码词）核对气泡与 tooltip 来源；验收通过后去时间戳发正式版。
