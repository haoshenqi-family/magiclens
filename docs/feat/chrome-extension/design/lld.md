# LLD · chrome-extension（MagicLens 词镜 · 伴读聊天与整体演进）

> 需求基线：[`../hls/md/r119-companion-chat.md`](../hls/md/r119-companion-chat.md)（R119，源自 magicbook response.md）+ R118 评估（划词/词汇/TTS）。
> 契约核实：本文所有 moon-well 契约均于 2026-10-04 实读源码确认（文件路径随表标注），LLD 编写时版本为准。
> 分工约定：本文 US1/US2 已随 P0 交付；US3（伴读聊天）在 magiclens 实施；US4（moon-well 侧两项改动）需在 moon-well 仓库按其 AGENTS.md 工作流实施——设计在本文，代码不在本仓库。

---

## 1. 目标与非目标

**目标**：
1. 在 magiclens 抽屉中提供与 magicbook 完全同构的 AI 伴读聊天（会话/工具/记忆/学情），网页上下文自动注入；
2. moon-well 侧仅做两处小改动（web 场景 system prompt、skipMemoryExtract 字段），其余零改动；
3. 复用 P0 已有基建（Bearer 鉴权、background 中转、Shadow DOM 规范），划词气泡一键唤起抽屉。

**非目标**（本轮不做）：段落整页翻译与生词波浪线（US5 后移）、moon-well TTS 接入（US6 后移）、关抽屉后台继续跑（offscreen 方案）、Readability 深度正文抽取（P1 增强）。

## 2. 总体架构

```mermaid
flowchart LR
    subgraph 扩展（MV3，无构建链）
        CS["content.js<br/>划词气泡（P0 已交付）"]
        CH["chat.js<br/>抽屉 UI + SSE 消费 + 页面上下文采集"]
        BG["background.js<br/>JSON 短请求中转 + Token 管理"]
        OPT["options.js / popup.js"]
    end
    CH -->|SSE 长流<br/>fetch ReadableStream| MW
    BG -->|JSON 短请求| MW["moon-well（fnOS :8082）"]
    MW --> DB[(MySQL ai_conversation<br/>ai_message/ai_user_memory<br/>ai_book_profile/ai_agent_run)]
    MW --> LLM[("LLM 网关（Nacos 多 provider）<br/>+ 积分计费")]
```

**关键架构决策**：

| # | 决策 | 理由 |
| --- | --- | --- |
| A1 | SSE 长流在 **content script** 侧消费，不进 background | MV3 SW 30s 空闲即回收；工具调用期间可 300s 无 delta，流必须挂在与抽屉同生命周期的上下文（R119 结论） |
| A2 | JSON 类请求（会话/记忆/学情/词汇）仍走 background 中转 | 统一豁免页面 CORS 与混合内容限制（P0 既有约定，AGENTS.md §0.2） |
| A3 | 抽屉与划词气泡各自独立 closed Shadow DOM 宿主 | 互不干扰；抽屉常驻懒创建（首次唤起才构建 DOM） |
| A4 | 聊天脚本静态进 manifest `content_scripts`，懒激活 | 无构建链约束下最简：`js: ["content.js", "chat.js"]`，chat.js 仅在唤起时构建 UI；单文件 ~35KB 常驻可接受。备选 `chrome.scripting` 按需注入需加 `scripting` 权限，暂不引入 |

## 3. User Story 划分与状态

| US | 内容 | 优先级 | 状态 |
| --- | --- | --- | --- |
| US1 | 鉴权基建（服务地址/Token 配置、Bearer、401 引导） | P0 | ✅ 已交付（划词共用） |
| US2 | 划词翻译 + 认识/生词标记 + 本地朗读 | P0 | ✅ 已交付 |
| US4 | **moon-well 侧**：web 场景 prompt 分支 + skipMemoryExtract | P0 前置 | 📋 本文 §5 设计，待 moon-well 实施 |
| US3 | 伴读聊天抽屉（SSE/上下文/会话/记忆/学情） | P0 核心 | 🔨 本文 §4 设计，待实施 |
| US5 | 段落整页翻译 + 生词标注（translate-batch + analyze） | P1 | 规划 |
| US6 | moon-well TTS 朗读（/tts/speak 状态机 + 本地降级） | P2 | 规划 |

> 分期调整说明：R119 建议将伴读聊天提前并入 P0（与划词共享全部基建，且为用户最高频诉求），原 P1 的生词标注/段落翻译顺位后移——本文按此执行。

## 4. US3 伴读聊天抽屉（magiclens 侧设计）

### 4.1 模块与文件

| 文件 | 职责 | 预估行数 |
| --- | --- | --- |
| `extension/chat.js` | 抽屉宿主 + Shadow DOM UI + SSE 消费 + 状态机 | ~1200 |
| `extension/page-extract.js` | 页面上下文采集（title + 视口段落 + 选区引用） | ~150 |

（manifest.json `content_scripts.js` 追加这两个文件；`content.css` 不引入，样式内联进 Shadow root。）

### 4.2 SSE 消费（端点：`POST /ai/agent/chat`）

- **请求**：`content-type: application/json` + `Authorization: Bearer <token>`，body 见 §6.1；`Accept: text/event-stream`。
- **消费**：`fetch` + `response.body.getReader()` 手写 SSE 帧解析（`event:`/`data:` 帧、多行 data 拼接、容错裸文本行）——解析逻辑从 `magicbook/cps/static/js/ai/ai_chat.js` 移植，去 jQuery 化。`AbortController` 在抽屉关闭/会话切换时 abort。
- **事件协议**（核实源：`AgentChatController.AgentEventSenderBridge`）：

| event | data 字段 | 前端处理 |
| --- | --- | --- |
| `delta` | `text`（`data` 同值，兼容字段） | 追加渲染本轮回答 |
| `tool_call` | `step, name, argsSummary, requireConfirm` | 工具芯片（进行中态；requireConfirm=true 渲染醒目写样式） |
| `tool_result` | `step, name, ok, resultSummary, durationMs` | 对应芯片转结果态（ok/耗时） |
| `final` | `conversationId, messageId, status, usage{promptTokens, completionTokens}` | 锁定本轮；**首问回填 conversationId**；usage 显示本轮 token（计费可见） |
| `error` | `message, code`（`LLM_REJECTED`=积分不足 / `LLM_FAILED`=网关配置 / `AGENT_FAILED`=其它） | 按码分文案；`LLM_REJECTED` 引导充值（magicbook 同款提示） |

- **流结束**：服务端 `final`/`error` 后 `emitter.complete()` 关流，**无显式 `[DONE]` 帧**；解析器须兼容「流自然关闭」收尾（magicbook 解析器已兼容，移植时保留该容错）。经代理链路若出现 `[DONE]` 需忽略。
- **生命周期**：页面刷新即断流（可接受：会话历史在服务端，重开抽屉经 `/ai/agent/history` 恢复）；跨页导航不保活——不做 offscreen（非目标）。

### 4.3 页面上下文采集器（page-extract.js）

`collectPageContext()` 返回 `{ bookTitle, chapter, pageText, unfamiliarWords }`，**发送时才采集**（SPA 天然规避陈旧上下文）：

| 字段 | P0 策略 | 约束 |
| --- | --- | --- |
| `bookId` | 恒 `null`（web 场景判据，服务端落 0） | — |
| `bookTitle` | `document.title`（≤500 截断） | 服务端 DTO 校验 |
| `chapter` / `authors` | 空 | — |
| `pageText` | 视口内段落 + `document.title` 拼接：取正文候选（p/li/blockquote/td 中文字数最多者加权），按 DOM 顺序 join，**≤6000 chars**（给 8000 截断留余量） | 服务端 8000 截断（`AgentChatService.MAX_PAGE_TEXT_CHARS`） |
| `unfamiliarWords` | P0 空；US5 生词标注落地后接入（≤30 词） | 单词 ≤100 chars |

选区引用：划词气泡新增「问 AI」按钮（content.js 发消息给 chat.js），抽屉输入框预填 `「<选中文本>」`（沿用 magicbook `insertIntoInput` 引用样式）；右键菜单「问 MagicLens」为 P1 可选（需 `contextMenus` 权限，暂不加）。

### 4.4 抽屉 UI（Shadow DOM）

- 右侧固定抽屉 380px，遮罩可关；内部区块：消息流（用户右/助手左，工具芯片行内嵌）、输入区（textarea + 发送 + 「本会话不记忆」勾选，见 §5.2）、顶栏（会话下拉 + 新会话 + 改名/删除 + 记忆/学情两个子页签）。
- 会话流：首问 `conversationId=null` → `final.conversationId` 回填 → 追问携带；切会话经 `/ai/agent/history` 拉取回放（消息含 `toolTrace` JSON，渲染为折叠芯片）。
- 会话列表：`POST /ai/agent/conversations`（`bookId` 不传 = 本人全部会话，按 `updatedAt` 倒序，网页与读书会话同列；`bookId: 0` 会话显示「[通用]」前缀——与 magicbook 语义一致）。
- 记忆面板：`/ai/agent/memory/list`（分 book 两级展示）/ `memory/save` / `memory/delete`；学情面板：`/ai/agent/book-profile`（`bookId≤0` 返回空，UI 显示「网页会话暂无学情」，**不得视为错误**）。
- usage 展示：`final.usage` 拼在消息尾部（`tokens: 1234+567`），用户对计费放大有感知。

### 4.5 异常与降级

| 场景 | 行为 |
| --- | --- |
| 401/403（token 失效） | 中止流；抽屉顶部提示「登录失效」+ 打开设置页（P0 同款交互）；US1 的 OIDC 静默刷新落地后自动续期重试一次 |
| SSE 中途断流（无 final） | 提示「连接中断」；本轮不回填历史（服务端 assistant 消息未持久化），用户重发 |
| `ai.agent.enabled=false`（生产开关） | 端点抛「AI agent 功能未开启」→ 抽屉显示引导文案，其余功能不受影响 |
| 积分不足（`LLM_REJECTED`） | 明确报错文案，不重试 |

## 5. US4 moon-well 侧设计（在 moon-well 仓库实施）

### 5.1 web 场景 system prompt 分支（推荐项，~15 行）

**现状**（核实源：`AgentChatService.buildSystemPrompt` L142-175 + `AgentPrompts.DEFAULT_TEMPLATE` L25-26）：模板键 `agent-chat-system`（`PromptDefinitions.AGENT_CHAT_SYSTEM`，Nacos prompt registry），渲染变量 `bookTitle/authors/chapter/pageContext/unfamiliarWords/memory/bookProfile`；定位语硬编码「你是用户的英文书伴读助手。用户正在阅读《{{bookTitle}}》…」，空值兜底「未知书名/未知章节」——网页场景语义错位。

**设计**：
1. `buildSystemPrompt` 头部加判定：`boolean webScene = request.getBookId() == null;`（书内场景恒有 bookId，网页场景恒 null，判据唯一且与 `resolveConversation` 的落 0 逻辑同源）。
2. 新增 prompt 键 `agent-chat-system-web`（`PromptDefinitions.AGENT_CHAT_SYSTEM_WEB`），Nacos prompt registry 注册 web 版模板，定位语改为「你是用户的网页阅读助手。用户正在浏览网页《{{bookTitle}}》…」，其余变量集**保持完全一致**（pageContext/memory/bookProfile/bookTitle 同名复用，bookProfile 对 web 恒为「（暂无）」）。
3. 本地兜底：`AgentPrompts` 增加 `WEB_DEFAULT_TEMPLATE`，`buildSystemPrompt` 的 catch 分支按 webScene 选兜底模板（与主路径同一判定，避免分支漂移）。
4. 兼容性：不改既有 `agent-chat-system` 模板与变量集；magicbook 前端（bookId 非 null）走原路径零感知。

**验收要点**：bookId=null 请求的 system prompt 含「网页阅读助手」且无「未知书名」；bookId=非 0 请求行为与现状逐字节一致（回归 magicbook 读书场景）。

### 5.2 `skipMemoryExtract` 请求字段（可选但建议，~5 行）

**现状**（核实源：`AgentChatService.finishHooks` L215-222）：`final` 发出后同线程顺带 `memoryService.extractOnFinish(...)`——网页会话照常抽取记忆，下次读书时注入（记忆本就跨书）。

**设计**：
1. `AgentChatRequest` 增加 `private Boolean skipMemoryExtract;`（null 视为 false，完全向后兼容）。
2. `run()` 把 `Boolean.TRUE.equals(request.getSkipMemoryExtract())` 传入 `finishHooks`，为 true 时**跳过** `memoryService.extractOnFinish`；`bookProfileService.recordRun` **保留**（学情计数与记忆抽取无关，且不产生 LLM 调用）。
3. 无 DDL 变更、无配置变更。

**插件侧联动**：抽屉输入区「本会话不记忆」勾选，**默认勾选**（隐私优先：任意网站的聊天默认不进长期记忆），设置页提供默认值反转；每轮 `/chat` 请求都携带该字段（抽取是每轮收尾动作，不存在会话级持久开关）。用户想跨书记忆时手动取消勾选。

## 6. 契约汇总（本轮核实版）

### 6.1 聊天与面板端点（前缀 `/ai/agent`，均 POST + Bearer）

| 端点 | 请求要点 | 响应 |
| --- | --- | --- |
| `/chat`（SSE） | §6.2 字段；`ai.agent.enabled=true` 才可用 | text/event-stream，§4.2 事件表 |
| `/conversations` | `bookId` 可空（null=全部） | 会话 VO 列表 |
| `/history` | `conversationId` | 消息 VO 列表（含 toolTrace） |
| `/conversation/rename` · `/conversation/delete` | 会话维度 DTO | Result |
| `/memory/list` · `/memory/save` · `/memory/delete` | `bookId` 可空（0=[通用]） | 记忆 VO 列表/Result |
| `/book-profile` | `bookId`（≤0 返回空） | 学情 VO |

（DTO 具体字段以 `moon-well/.../reading/agent/dto/` 为准；插件侧封装在 background，字段漂移只改一处。）

### 6.2 AgentChatRequest（核实源：`AgentChatRequest.java`）

| 字段 | 类型/约束 | 插件传法 |
| --- | --- | --- |
| conversationId | Long，null=新建 | 首问 null，后续回填 |
| message | 必填 ≤4000 | 输入框内容 |
| bookId | Integer，null=web 场景 | 恒 null |
| bookTitle | ≤500 | `document.title` |
| authors | List，每项 ≤200 | 不传 |
| chapter | ≤500 | 不传 |
| pageText | 服务端截断 8000 | 采集器 ≤6000 |
| unfamiliarWords | 设计约定 ≤30 词，每词 ≤100 | P0 不传 |
| skipMemoryExtract | Boolean，null=false（US4 新增） | 勾选态（默认 true） |

### 6.3 鉴权（核实源：`AuthController` / `OidcAuthController`）

| 端点 | 用途 | 阶段 |
| --- | --- | --- |
| `mk-` 静态 key（`Authorization: Bearer mk-…`，`AuthHandlerInterceptor` 走库校验） | P0 现行 | ✅ |
| `POST /auth/oidc/exchange`（Authentik id_token 换 JWT）+ `POST /auth/refreshToken` 续期（access 7d / refresh 30d） | 插件登录页 + 静默刷新 | P1（US1 增强，与 US5 同批） |

## 7. 数据与配置

- **无新表、无迁移**：moon-well 侧仅 `AgentChatRequest` 加一个可空字段；四张 ai_* 表语义不变（web 会话 = `book_id=0` 行，`book_title` 存网页标题）。
- **配置**：`ai.agent.enabled` 生产须为 true（当前生产已开，伴读已上线）；`ai.agent.write-confirm-required` 若为 true，写工具被服务端拒绝并引导模型改为展示内容——**非交互式门**，插件无需确认 UI，仅把 `tool_call.requireConfirm=true` 的芯片渲染得更醒目。
- **Nacos**：新增 prompt 键 `agent-chat-system-web`（生产经 Nacos prompt registry 注册；本地兜底模板进 `AgentPrompts.java`）。

## 8. 工程量与里程碑

| 里程碑 | 内容 | 估算 |
| --- | --- | --- |
| M1 | US4 moon-well 两改动（独立 PR，走 moon-well 工作流 + 测试） | ~20 行 + 模板 |
| M2 | US3 骨架：抽屉 UI + SSE 消费 + 会话流（先通 magicbook 同款体验） | ~800 行 |
| M3 | US3 收尾：记忆/学情面板 + usage 展示 + page-extract 采集器 + 划词「问 AI」联动 | ~550 行 |
| M4 | 手工验收清单全过 + README/docs 同步 + manifest 0.2.0 | — |

合计 magiclens 侧 ~1.35k 行（与 R119 估算一致），moon-well 侧 ~20 行。

## 9. 风险与对策（承接 R119，落为设计项）

| 风险 | 对策（已落设计） |
| --- | --- |
| 计费放大（1 问答 ≥1 次 LLM 调用） | final.usage 必显（§4.4）；抽屉文案提示 agent 比划词翻译贵 |
| 记忆污染/隐私 | skipMemoryExtract 默认 true（§5.2）；prompt web 模板不鼓励主动写记忆 |
| 公网入口与信任头剥离 | 前置条件不变（R118 风险①）；agent 走 JWT，上公网前完成 Traefik 路由 + 信任头剥离审计 |
| 防检测站点拦截 | 兜底 chrome.sidePanel 承载抽屉（P1 可选，本文不展开） |
| SSE 长流与页面生命周期 | 断流提示 + 会话历史服务端可恢复（§4.5），不做后台保活 |
