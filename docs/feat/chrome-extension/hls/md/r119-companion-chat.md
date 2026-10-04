# HLS / PRD · AI 伴读聊天移植到 Chrome 插件（R119）

> 需求来源：magicbook 仓库 `response.md` R119（2026-10-04 专项评估，实读两侧代码逐节确认）。本文为标准化转录，作为 magiclens 伴读聊天（feat: chrome-extension）的需求基线；LLD 见 [`../design/lld.md`](../design/lld.md)。

## 结论

高度可行——后端几乎零改动，比词汇/翻译部分更顺。伴读 agent 在 2026-09 后端化改造时已做成「client-agnostic」：moon-well 对前端身份的全部认知就是请求体里那几个可空字段；magicbook 侧只是 ~830 行薄皮。

## 链路拆解

| magicbook（要替换的部分，~830 行） | moon-well（全部保留，零改动候选） |
| --- | --- |
| ai_chat.js 576 行（会话下拉/改名/删除、消息渲染、SSE 帧手写解析、工具芯片、记忆/学情面板） | AgentChatController（SSE，虚拟线程） |
| ai_page_extract.js 76 行（epub/pdf/txt 三格式采集） | AgentChatService 332 行（会话解析/记忆注入/学情/prompt 组装） |
| ai_chat_panel.html 51 行 + CSS 142 行 | AgentLoop 411 行（有界循环 maxSteps=5、7 工具、写确认门、自动反思） |
| cps/ai/proxy.py 180 行（SSE 透传 + JWT 刷新重连） | MySQL: ai_conversation/ai_messages/ai_user_memory/ai_book_profile |

## 请求契约天然支持非书场景（AgentChatRequest）

| 字段 | 网页场景传法 | 服务端行为 |
| --- | --- | --- |
| conversationId | null | 首问由服务端建会话，final 事件回传 id |
| message | 用户输入 | 唯一必填（≤4000） |
| bookId | null | resolveConversation 落 0；「只存引用不校验」 |
| bookTitle/authors/chapter | 网页 title / 空 / 空 | 可空，模板兜底「未知书名」 |
| pageText | 插件采集的网页正文 | 服务端 8000 chars 截断 |
| unfamiliarWords | 插件生词标注状态（P1 联动） | ≤30 词，可空 |

## 7 工具网页场景可用性

| 工具 | 可用性 |
| --- | --- |
| lookup_word | ✅ 查词与书无关（词典+AI 兜底） |
| get_paragraph_translation | ✅ 按段落原文查 ES 缓存，网页与书共享翻译缓存 |
| list_annotations / add_annotation | ✅ 批注按段落 SHA-256 定位 ES 文档，与 bookId 解耦 |
| save_memory / recall_memory | ✅ 记忆分 book/user 两级，网页场景 bookId=0 落跨书通用，语义正确 |
| reflect | ✅ 循环内部机制，与场景无关 |

会话管理零适配：会话列表 bookId null = 本人全部会话；学情面板 bookId≤0 返回空不报错；记忆面板 bookId 0 显示「[通用]」。SSE 直连无障碍（CORS 全开、SseEmitter(0L) 不设超时、写确认门为非交互式）。

## 需要动的三处（按体验优先级）

1. **moon-well system prompt 场景分支**（推荐，~10 行）：模板硬编码「英文书伴读助手…《{{bookTitle}}》」；网页场景语义错位。改法：buildSystemPrompt 按 bookId==null 判定 web 场景，启用新模板（Nacos prompt registry 加 `agent-chat-system-web`）。
2. **页面上下文采集器重写**（前端，必须）：三格式检测在网页全部落空 → 返回 ""（伴读变盲）。P0 简版：title + 视口段落 + 划词引用；P1 增强版：Readability 风格正文抽取 + SPA 发送时采集。
3. **SSE 消费位置**（架构，必须想清楚）：MV3 service worker 30s 空闲回收，不能在 background 挂 agent 长流。推荐：SSE fetch 放 content script（与页面同生命周期）；备选 offscreen document（仅当需要「关抽屉继续跑」）。

## 工程量

| 部分 | 来源 | 处理 | 估算 |
| --- | --- | --- | --- |
| SSE 解析 + 消息渲染 + 工具芯片 | ai_chat.js L238-415 | 去 jQuery + DOM API 重写 | ~500 行 |
| 会话/记忆/学情面板 | ai_chat.js 其余 | fetch 直连 + Bearer；CSRF 全删 | ~400 行 |
| 抽屉 UI + 样式 | ai_chat_panel.html + CSS | Shadow DOM 重封装 | ~300 行 |
| 页面提取器 | 新写 | P0 视口+选区版 | ~150 行 |
| 登录/JWT（复用划词基建） | — | 共享 | 0 |

合计增量 ~1.2-1.4k 行。moon-well 改动：prompt 分支（推荐）+ skipMemoryExtract 字段（可选，~5 行）。

## 风险清单（接 R118）

- **计费放大**：一次问答 = 1+ 次 LLM 调用（≤5 步循环 + 收尾记忆抽取 + 可能 reflect）；插件侧显示 token usage（final 事件已带）。
- **记忆污染面扩大**：memoryExtractOnFinish 对网页会话照常抽取；建议 prompt 引导少抽或插件加「本会话不记忆」开关（moon-well 加 skipMemoryExtract 字段）。
- **公网入口**：agent 端点走 JWT（非 internalUri）；moon-well 暴露公网前必须处理信任头剥离问题（同 R118 结论）。
- **CSP/防检测站点**：fetch 不受 connect-src 约束、Shadow DOM 不受宿主 style-src 影响；个别站点防御性检测（如 Cloudflare turnstile）兜底方案是 chrome.sidePanel。
