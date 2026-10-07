# response.md — 对话回应记录（仅保留最近 10 个 request 的回应）

## 2026-10-04

### R1（AGENTS.md 对齐 magicbook 模板重构）

- **回应**：已按 magicbook AGENTS.md 模板重构本仓库 AGENTS.md：①「🔄 核心工作流 + 📋 任务分类与执行策略 + 📁 项目文档规范 + 🚫 不纳入 Git + 📝 对话记录 + 内网设备 + 语言与术语规范」全量对齐家族模板（验收一节按扩展无自动化测试的现实改为手工清单）；②原轻量版的项目定位与硬性约定收进「## 0. 系统说明（AI 必读）」；③新增 §0.3 引用关系表（家族根 Agents.md / magicbook / moon-well AGENTS.md / API 权威源码 / docs/design.md / README，各自标注必读时机），文件头加必读声明（根 Agents.md 强制规则表已指向本文件）；④同步建立 requests.md / response.md 台账，本条为 R1。
- **总结**：
  - requests.md：占号 R1。
  - response.md：本条。
  - 冲突记录：无。

## 2026-10-04（二）

### R2（magiclens LLD：伴读聊天移植 + moon-well 侧设计）

- **回应**：按 R119 评估的规划完成 LLD，落盘 `docs/feat/chrome-extension/`（三级结构）：
  - `hls/md/r119-companion-chat.md`：R119 评估标准化入库，作为需求基线；
  - `design/lld.md`：主设计。全部 moon-well 契约经本轮实读源码核实（非转述），关键产出：①SSE 消费定案——`POST /ai/agent/chat` 长流在 content script 消费（A1，MV3 SW 生命周期约束），JSON 短请求仍走 background（A2）；②事件协议表（delta/tool_call/tool_result/final/error + usage），并纠正一处评估细节：服务端 `final` 后 `emitter.complete()` 关流、**无显式 [DONE] 帧**，解析器须兼容自然关流；③页面上下文采集器设计（发送时采集、pageText ≤6000 给 8000 截断留余量）；④moon-well 侧两项改动设计——`buildSystemPrompt` 按 `bookId==null` 判定 web 场景启用新键 `agent-chat-system-web`（Nacos 注册 + 本地兜底双处），`AgentChatRequest` 加 `skipMemoryExtract` 可空字段（null=false 完全向后兼容，`finishHooks` 跳过 extractOnFinish、保留 recordRun），均无 DDL；⑤分期调整定稿：伴读聊天并入 P0（US3），生词标注/段落翻译/TTS 顺位后移；⑥隐私决策：插件「本会话不记忆」默认勾选。
  - 同步：`docs/design.md` 分期改版、README 功能表与待办更新。
- **总结**：
  - requests.md：占号 R2。
  - response.md：本条。
  - 冲突记录：R119 评估称 SSE 协议含 [DONE] 帧，本轮实读 `AgentChatController` 未发现服务端发送 [DONE]（以 complete() 收尾），LLD 按「无 [DONE]、解析器兼容」落设计，已在本条记录差异。
  - 未决事项：US4（moon-well 两改动）需在 moon-well 仓库按其 AGENTS.md 工作流实施后才动 magiclens 代码；M1-M4 里程碑见 LLD §8。

## 2026-10-04（三）

### R3（实施 LLD M2+M3：伴读聊天抽屉 v0.2.0）

- **回应**：US3 全量落地（commit 039cdbf，manifest 0.2.0，~950 行 JS）：
  - `chat.js`（新增）：右侧抽屉（closed Shadow DOM + adoptedStyleSheets 免疫宿主 CSP）、SSE 手写帧解析（event:/data:、[DONE] 忽略、裸文本降级、自然关流容错，与「服务端无 [DONE]」结论对齐）、工具芯片（run/ok/fail/warn 四态，requireConfirm 醒目样式）、final 回填 conversationId + usage 展示、会话列表/重命名/删除/历史回放（toolTrace 折叠）、记忆面板（list/save/delete，手动记忆落 bookId=0）、学情面板（bookId 显式传 0，空态友好）、「停止」按钮（运行中 abort）、「本会话不记忆」勾选默认取设置页 skipMemoryDefault（默认 true）；
  - `page-extract.js`（新增）：发送时采集视口正文（TreeWalker + 可见性过滤 + 去重 + 6000 上限），跳过 MagicLens 自身 UI；
  - `background.js`：`ml:api` 白名单中转（8 个面板端点）；
  - `content.js`：划词气泡新增「问 AI」按钮 → `window.__magicLensAsk(text)` 引用进抽屉；
  - `options`：新增「伴读默认不记忆」开关；`manifest`：content_scripts 三文件 + 0.2.0。
- **交叉审查修正**（自审发现）：①closed shadow 的 `.on` 状态类原挂 host 上、CSS 在 shadow 内匹配不到 → 改挂 wrap；②`host.shadowRoot` 在 closed 模式返回 null → 缓存 shadow 引用；③page-extract 剔除 SPAN 降噪。全量 node --check 通过。
- **契约核实补充**（相对 LLD 的新确认）：moon-well WebConfig `allowedHeaders("*")` → content script 带 Bearer 的跨源 SSE preflight 可行；`AgentBookProfileRequest.bookId` 为 @NotNull（网页须显式传 0）；memory save 字段为 `{bookId, memory}`。
- **待用户验收**（本机无浏览器+无 token，无法 E2E）：chrome://extensions 重载 → 设置页配置 → 任意网页划词「问 AI」→ 提问验证 SSE/工具/记忆/学情。按 AGENTS.md 验收清单（LLD §4.5）逐条过。
- **总结**：
  - requests.md：占号 R3。
  - response.md：本条。
  - 冲突记录：无。

## 2026-10-04（四）

### R4（v0.3.0：登录化 + 公网域名 + 记忆始终开启）

- **回应**：按用户三项决策改版（commit 见 git log）：
  - **登录化**：设置页移除地址/Token 手动配置，改「登录」按钮 → `GET /auth/oidc/login`（Authentik 统一登录页，与 magicbook 同一账号）→ callback 页 body 的 `Result{accessToken, refreshToken}` 由 content.js 自动捕获入库并展示成功横幅（background 2.5s 后关标签）；background 增加 401 静默刷新（`/auth/refreshToken` 换新令牌对后重试一次，失败清令牌引导重登）；popup/划词气泡/抽屉的 401 文案统一为「重新登录」。**零 moon-well/Authentik 改动**。
  - **公网域名**：上线 `moon-well.haoshenqi.top` Traefik 路由（Server 2 `traefik-dynamic/moonwell.yml` → fnOS tailscale:8082，含 X-User-* 信任头剥离中间件；此前该域名 404——0929 只配了老域名 301 未配目标），实测：未登录 401、伪造 X-User-* 头 401（strip + 生产 INTERNAL_TRUST 未开启双保险）、301 保留 code/state query、Authentik authorize 可达；插件默认 apiBase 切公网并一次性迁移 v0.2 内网默认值；app-manager R27 配置入库。
  - **记忆始终开启**：移除抽屉「本会话不记忆」勾选、设置页默认项与 `skipMemoryExtract` 携带；moon-well 侧字段保留（默认抽取，向后兼容）。LLD §10 变更记录、README、AGENTS.md §0.2 已同步。
- **总结**：
  - requests.md：占号 R4。
  - response.md：本条。
  - 冲突记录：R4 推翻 R2 LLD 的「skipMemoryExtract 插件默认 true」决策（用户要求记忆始终开启）与 §6.3 mk- key 手动配置方案（改 OIDC 登录化）；均已在 LLD §10 记录。
  - 待用户验收：真机登录流（Authentik 页 → 回调捕获 → 划词/伴读）。

## 2026-10-04（五）

### R5（v0.3.1：注册按钮 + magicbook 关系说明）

- **回应**：①设置页账号卡新增「注册」按钮（未登录时与「登录」并列展示）→ `ml:register` 打开 Authentik 邀请制注册页（invitation-enrollment，链接与 magicbook 登录页注册入口同源：fnOS magicbook/.env `AUTHENTIK_ENROLLMENT_INVITE_URL`）；②账号卡 hint 补注册引导，新增「与 magicbook 的关系」说明块（同账号/同后端、数据互通、场景差异）；③README 同步。**运维耦合注意**：邀请令牌内置于扩展常量，fnOS 轮换 `AUTHENTIK_ENROLLMENT_INVITE_URL` 时需同步发版扩展。
- **总结**：requests.md 占号 R5；response.md 本条；冲突记录：无。

## 2026-10-05（六）

### R6（单词详解 · 第一步：整理提示词）

- **回应**：仅完成用户指定的第一步「整理提示词」，产出 `docs/feat/word-detail/design/prompts.md`（草案，待确认后实施）：
  - **反推来源**：实测 ES `vocabulary` 索引（165,743 条，logstash 导入的 LLM 单词卡），抽样反推出导入提示词的 8 小节模板（分析词义/列举例句/词根分析/词缀分析/发展历史和文化背景/单词变形/记忆辅助/小故事）；确认 `fullContent` 字段几乎未用（仅 21 条非空）、小节标题风格不统一（原提示词未锁输出格式）。
  - **缺口结论**：现有内容不含俚语/同义词/反义词/习语/冷知识，「起源」仅与「发展历史和文化背景」部分重叠 → 详解是增量内容。
  - **格式决策**：详解输出用结构化 JSON（六单元数组/字段，每单元条数与长度上限），不用 markdown——magiclens 弹窗目前只有 textContent 渲染，JSON 单元可直接渲染小卡片，也满足「每个小单元不要太长」。
  - **提示词成稿**：用户 R6 多版草稿合并为一个模板 `vocabulary-word-detail`（变量 word + context），风格对齐 moon-well `PromptDefinitions`（角色+任务+约束+输出格式，中文，宁缺毋滥防编造）；附 justice 输出示例。
  - **后续落位（未实施）**：moon-well 注册模板 + 详解接口 + ES 同 doc id 缓存；magiclens 划词气泡「详解」入口 + 六单元渲染。
- **总结**：requests.md 占号 R6；response.md 本条；冲突记录：无。

### R7（单词详解提示词 v2：板块重排 + 变体还原 + 新索引）

- **回应**：按用户五点反馈重设计，`docs/feat/word-detail/design/prompts.md` 更新至 v2：
  - **板块重排**：基本意思（meaning，2~4 义项）为板块 1，词源（etymology）升为板块 2 并标注重点；后接固定搭配/常见用法/习语（phrases，合计≤6 条，kind 区分）、变体与衍生词（forms，不规则变化逐条 + irregular 标注）、同义词/反义词、俚语/冷知识。
  - **变体还原**：提示词开头声明「传入词可能是变体，先还原词目，讲解针对词目展开」；JSON 增 `lemma / isVariant / variantNote`；**ES doc id = SHA-256(lemma)**，任何变体查询都落到词目文档，避免同词目多份缓存。
  - **新索引**：缓存改用 `magicbook-vocabulary`（旧 `vocabulary` 后续废弃，现有单词卡流程暂不动，下线另立任务）；mapping 建议 word/lemma 用 keyword 类型。
  - **示例重做**：传入 `ran`（变体）→ 词目 run，覆盖变体标注、run/ran/run 不规则形态、五板块全内容。
- **总结**：requests.md 占号 R7；response.md 本条；冲突记录：无（R6 的 JSON 输出决策保留，板块结构按 R7 全量替换）。

### R8（v0.4.0：单词详解开发落地）

- **回应**：两端开发完成，交叉审查通过（Explore agent 审出 1 P0/3 P1/7 P2，关键项全修）：
  - **moon-well 侧**（对应其 R100）：`GET /vocabulary/detail/{word}` 六板块结构化 JSON；新索引 `magicbook-vocabulary`（word/lemma/forms.form=keyword，doc id=SHA-256(lemma)，变体查询三路 term+词干兜底命中词目文档）；提示词 `vocabulary-word-detail` 入 MANAGED 清单；per-key 锁防同词并发重复计费；`mvn test` 全量 670 通过（新增 14 例）。**未部署**。
  - **magiclens 侧**：划词气泡增「详」按钮 → background `ml:detail` 中转（复用 callApi 401 静默刷新）→ 同 Shadow DOM 详解面板：按板块顺序渲染（基本意思→词源→搭配·用法·习语→变体与衍生词→同/反义词→俚语/冷知识），变体词显示词目标题+「变体」角标+说明行，不规则形态金色 chip；LLM 内容全 textContent 组装不进 innerHTML；请求序号防旧响应覆盖、面板内选区不误关、scroll capture 面板内滚动不关闭；manifest 0.3.1→**0.4.0**。
  - **审查修复**：P0 = HTTP 层 Jackson 序列化把 isVariant 漂移成 variant（服务端双注解 @JSONField+@JsonProperty 钉键，补回归测试）；P1 = 后端 saveToEs 宽捕、并发锁、假覆盖断言修正；P2 = lemma/forms 小写归一、词长 ≤64、README 过时表述（「后端零改动」/架构图内网 IP）更新等。
  - **文档**：`docs/feat/word-detail/design/lld.md`（US1/US2 + 验收清单 7 条 + 审查修复记录）、`prompts.md`（v2 权威源）、README 功能表与 API 表同步。
- **待办**：①真机手工验收（LLD 验收清单，重点 ran/running 变体与缓存秒回）②moon-well 部署需 push 触发构建链（待用户确认）③扩展控制台无新增报错待真机确认。
- **总结**：requests.md 占号 R8；response.md 本条；冲突记录：无。

## R9 回应：magicbook 上划词是否会双触发

**结论：不会同时触发，实际使用不冲突。**

- magicbook 划词只存在于 epub 阅读器：`cps/static/js/reading/epub.js` 的 `bindSelectionTranslation`（L866-895、L1981）把 mouseup/touchend 绑在 epub.js 渲染用 **iframe document** 上，iframe 内事件不冒泡到主文档（代码注释亦写明）。
- MagicLens content script 虽注入 `http(s)://*/*`（含 magicbook 域名，无排除逻辑），但 manifest 无 `all_frames`，只注入顶层 frame，监听主文档 mouseup——在 epub iframe 里划词不会触发 MagicLens。
- magicbook 其它页面（书架/详情/TXT 等）没有自带划词，选中只弹 MagicLens 气泡；txt/djvu reader 未绑定 bindSelectionTranslation，同理只有 MagicLens。
- 两端走同一 moon-well API、同一账号，生词标记数据收敛，无数据冲突。
- 若仍希望 MagicLens 在 magicbook 域名彻底静默，可在 content.js 初始化处加域名 early-return，或用 Chrome 按站点权限控制；当前无必要。

- **总结**：requests.md 占号 R9；response.md 本条；冲突记录：无。

## 2026-10-06

### R10（版本号规则：每次修改完成后按 0.0.0-Timesnap 递增）

- **回应**：已确立「时间戳版本号」规则并落地：
  - **规则定案 `X.Y.Z-YYYYMMDDHHmm`**：每次修改完成后必须递增版本号。因 Chrome manifest 的 `version` 字段只接受点分整数（写 `0.4.1-202610061607` 会被 Chrome 拒绝加载），落为双字段方案——`version` 按语义化版本递增（用户可读的版本基准），`version_name` 写完整 `X.Y.Z-YYYYMMDDHHmm`（修改完成时刻的时间戳，即用户所说的 0.0.0-Timesnap）。
  - **本次应用**：manifest `0.4.0 → 0.4.1`，`version_name = 0.4.1-202610061607`；`popup.js` 改为优先展示 `version_name`（弹窗可见 `v0.4.1-202610061607`，时间戳与具体一次修改一一对应）；AGENTS.md §0.2 硬性约定与「编码实现·交付标准」已固化该规则，后续任何修改完成时都必须执行。
  - **校验**：manifest JSON 解析通过；popup.js `node --check` 通过。改动未提交（工作区另有上一会话遗留的未提交内容），待用户验收后一并处理。
- **总结**：
  - requests.md：占号 R10。
  - response.md：本条。
  - 冲突记录：本次初占 R9 与上一会话既有 R9（magicbook 划词双触发问答）撞号（占号前台账核对遗漏），按编号纪律不修改既有记录，续编空号为 R10。

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

## R16 回应：标记认识后重新扫描仍出现（已修复：后端判定升级词族口径）

- **回应**：标记本身已生效，重新扫描把 installed「带回来」的是同页另一个未标记词形 **install**（GitHub 页的 Install 按钮），非 installed 自身。证据链：①`vocabulary_notebook` 中 user 1 `installed` familiarity=7 已落库（08:17:50）；②重扫（08:21:11）ES 阅读事件 `installed`=KNOWN（服务端已正确过滤、未进生词返回），`install`=UNKNOWN（无手动标记，magicbook_word_level 档位 3=CET4 > 用户 hard_level=2 → 词档兜底判生词返回）；③扩展 `highlight.js` `matchWord` 对 token 做屈折还原双向匹配，`lemmaCandidates("installed")` 含 `install` → 命中生词集合再次点亮。标记当下消失是 `__magicLensOnMarked` 全集清扫只清了页内集合，重扫以服务端为准。
- **根因**：手动标记「认识」只写精确词形；服务端 analyze 按精确 token 判定，客户端高亮按词族匹配，口径不一致。
- **修复（用户确认「单词判断都按单词来，仅翻译等信息按 token」后实施）**：moon-well 新增 `WordInflection`（屈折还原，与 highlight.js `lemmaCandidates` 逐条同规则，测试向量互为镜像）与 `WordFamilyJudge`（自身显式标记 > 词族显式标记（认识优先）> 词族最小档位兜底）；analyze 与 familiar 同矩阵，单词本/分级表查询按词族全集展开（跨页标记生效）；翻译/释义仍按 token。派生词（installation）与不规则变形（ran/run）不在还原范围，维持独立判定。备选「前端批量标词族」因会把 installe 等副产物写进单词本污染学习队列而否决。
- **验证**：moon-well 新增 25 个单测（WordInflection 6 / WordFamilyJudge 9 / analyze 词族场景 4 / familiar 6，含 R16 复现用例 `knownMarkOnInstalledFiltersSamePageInstallToken`），全量 709 测试通过后 push develop 走 fnOS 链部署。扩展端零改动、版本不变。
- **总结**：requests.md 占号 R16；跨查并修改 moon-well（其台账 R107）；ADR 记于 docs/design.md §8。

## R17 回应：设置页说明「单词等级等详细设置在 magicbook 管理」并提供跳转

- **改动**（`extension/options.html`，「与 magicbook 的关系」与「自动翻译」开关之间新增「更多设置」块（用户反馈后由初稿「单词等级等详细设置」改名），纯静态 HTML，options.js 零改动）：
  - 说明文案：MagicLens 本页只保留最常用的开关；**单词难度等级、词汇量测试（含难度推荐）**等详细设置统一在 magicbook「阅读设置」页管理，两者共用同一份数据。
  - 跳转链接：`https://magicbook.haoyuhang.top/reading/settings`（新标签打开，`rel="noopener"`）；路由实存核对过（magicbook `cps/web.py:307` `@web.route("/reading/settings")`，登录后可访问），页面内容即词汇难度档位 + 词汇量测试（R125 推荐档位）。
  - 生效口径如实说明：判定矩阵在 moon-well `/vocabulary/reading/analyze` 每次扫描时服务端计算，插件不缓存等级——文案写「在 magicbook 改完难度档位，新开或刷新网页，生词高亮与划词判定即按新等级生效」。
  - CSS 新增 `a.link` 样式（沿用主题紫色 #4f46e5）。
- **文档同步**：README 功能表「设置页」行补跳转说明（v0.6.1）；manifest 测试版 `0.6.1`，version_name 随文案微调更新为 `0.6.1-202610070858`（不触发发布）。
- **验证**：静态交叉审查（链接/文案/结构/JSON 合法性）通过；纯 HTML 无新增脚本，重载扩展即可验收：打开设置页看新块与链接跳转、magicbook 侧改档位后刷新网页核对高亮按新档判定。
- **总结**：requests.md 占号 R17；未提交 git（工作区仍有 v0.6.0 在途未提交改动，避免混入）；待用户真机验收。

## R18 回应：发布规则改为 release 分支触发（develop 不再发布）

- **规则定案**：日常开发在 `develop`（测试版节奏不变）；**用户确认**某版本可发布 → AI 把 `version_name` 时间戳清理为纯 `X.Y.Z` 推送 `develop` → merge `develop` 到 `release` 分支并 push → `release` 分支的 push 触发发布。
- **改动**：
  - `.github/workflows/release.yml`：`on.push.branches` 由 `[develop]` 改为 `[release]`，头部注释同步改写；「version_name 纯 X.Y.Z 才发布 / 测试后缀跳过 / Release 已存在跳过」三道闸门原样保留。
  - `release` 分支已自 develop HEAD（432eef1）建立并推 origin——本地与远端均存在，未夹带任何工作区未提交改动。建分支的这次 push 会让 workflow 跑一次，但该提交 version_name=0.4.1 且 Release 已存在，按闸门跳过，不产生重复发布。
  - 文档同步：AGENTS.md §0.2 两段式规则与 §3 验收「发布正式版」步骤改为 release 流程；docs/design.md §6 登记 R18 决策；README 安装说明同步。
- **用户操作约定**：以后只需说「vX.Y.Z 可以发布了」，AI 执行上述发布流程（清时间戳 → push develop → merge → push release → 核对 Release 产物）。
- **验证**：本地 `git branch -a` 确认 release 存在（本地+origin）；workflow 语法为纯 YAML 字段替换（branches 数组），无需额外校验；首次触发路径已有 v0.4.1 闸门保护。
- **总结**：requests.md 占号 R18；扩展端 `extension/` 零改动，manifest 版本不动（延续 R16 先例）；规则已同步 AGENTS.md / design.md / README / 记忆库。

### R19（详解面板粘性：不因离开/误点关闭 + AI 生成中提示）

- **回应**：content.js 面板生命周期改独立（v0.6.x 基线）：
  - 面板仅由 ✕/Esc/新「详」查询关闭；滚动、新选区、点外 mousedown 不再连带收面板——生成等待期（15~30s）误关一趟就白等。
  - Esc 分层退出：面板开着时 Esc 只关面板，不连带收划词气泡。
  - 加载文案改为「AI 正常生成中…（首次查询约 15~30 秒，完成后自动显示，期间可继续浏览网页）」；失败态（非鉴权）支持点击重试。
  - **SSE 取舍**：暂缓。详解为单次结构化 JSON，流式半截 JSON 无法优雅增量渲染（逐板块流式需自写增量 JSON 解析器）；痛点已由面板粘性解决，且 thinking 关闭后生成仅 15~30s。后续如需「逐板块流式呈现」再立项（moon-well 流式接口 + 增量解析）。
- **提交状态说明**：content.js 改动已写入工作区（扩展重载即生效）但**未单独提交**——并行会话（词库高亮 R13-R18）正在同一文件及其他多文件上在途工作，抢先提交会把其在途改动混入本次 commit；待高亮批次落地后随其一并提交。冲突记录：requests.md 初占「9」与既有 R9 撞号，按纪律续编 R19 并留更正条目。
- **总结**：requests.md 占号 R19（含撞号更正）；response.md 本条。

### R20（悬浮即时翻译：生词波浪线悬停即显翻译卡，对齐明畅交互）

- **回应**：highlight.js 新增「悬浮即时翻译」段（v0.7.0-202610071013 测试版），只对已高亮生词生效——波浪线即「已判定为生词」的视觉承诺，悬停 ~250ms 弹翻译卡，免去不方便的双击/划选；点击单词仍是完整划词气泡。
  - **命中测试**：`caretRangeFromPoint` + `nodeRaws` 查表（仅已高亮节点有登记，非高亮区域 O(1) 拒绝），命中区间 [start, end] 双端含边界；建卡前复验 `data.slice(start,end)===raw`（与渲染层 buildRange 同款防错位）。
  - **卡片**：独立懒创建 closed Shadow DOM（`#magiclens-hover-host`，z-index 与气泡同级），词名 + 译文 + 一行「点击单词：翻译 · 详解 · 标记」提示；全 textContent 渲染；限高 60vh 可滚动；卡内可选中复制（mousedown 对自身 UI 放行）。
  - **翻译链路**：复用既有 `ml:translate`——自动享受 v0.6.0 金山直连快路径（百毫秒级），miss 回退 moon-well + ES 缓存；本页会话词级缓存（hoverCache）使二次悬浮零请求即时显示；失败不缓存、卡上显示「翻译获取失败」（用户节奏触发，无请求轰炸）。
  - **状态机（交叉审查修复后）**：hoverPending 为唯一目标源——同词微动不打扰已排定时器（防手抖把 250ms 无限重排）；换词立即摘旧卡；快速掠过空格又回归（<150ms 宽限）卡片保持不闪；40ms mousemove 节流。
  - **抑制条件**：拖选中（e.buttons）、划词气泡打开（content.js show/hide/onScroll 三处同步 `__magicLensBubbleVisible`，覆盖 ✕/ask/滚动/后台关闭全部路径）、滚动（无条件收卡——必须作废未触发的 show 定时器，否则滚动后卡片弹在鼠标已不在的词上）、Esc；与 R19 详解面板的叠加判定为可接受（面板是显式打开且生成期 15~30s 本就鼓励继续浏览，悬浮卡瞬时且仅生词触发）。
  - **配套**：content.js selectionInfo 的 insideHost 扩展识别 `#magiclens-hover-host`（卡内划选复制不触发划词气泡）；page-extract.js 排除选择器同步；popup/popup.html 本次零改动。
  - **交叉审查**（独立 agent，只读）：无 P0，硬约束全守住；2×P1 全修——①悬浮状态机 pending/shown 混用单状态引出四症状（微动永不弹卡、宽限回归被误收、掠词后卡片指向错位、扫词旧卡挂屏）；②scroll 监听被 `if (hoverUi)` 短路，冷启动窗口滚动后卡片弹在错位词上。另择要修 P2：mousedown 对卡放行（可复制）、删死代码 hoverSeq、建卡前区间复验、卡片限高。
- **校验**：七个 JS 全过 `node --check`；manifest 0.7.0-202610071013（测试版，不触发发布）。
- **待用户验收**：①悬浮生词 ~250ms 弹翻译卡，移开消失；②沿句子缓慢移动/手抖时卡片正常弹出（同词微动不重置）；③点高亮词仍出完整气泡且不与悬浮卡叠加；④卡内译文可选中复制；⑤同词二次悬浮瞬时显示（缓存）。
- **总结**：
  - requests.md：占号 R20。
  - response.md：本条。
  - 冲突记录：无（R15-R19 为并行会话编号，本条按空号续编；content.js 在 R19 基础上叠加改动，仅增 `__magicLensBubbleVisible` 三处与 insideHost 扩展，未动 R19 语义）。
  - 未决事项：随高亮批次一并提交（R19 已说明的提交顺序约束）；真机验收通过后随批次发正式版。

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
