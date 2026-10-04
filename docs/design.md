# MagicLens 词镜 · 设计决策记录

来源：magicbook 仓库 `response.md` R118（Chrome 插件可行性评估）、R119（伴读聊天移植评估），2026-10-04。本文件沉淀其结论作为本项目的起点依据。

## 1. 核心决策：插件直连 moon-well，后端零改动

调研确认（实读代码）：magicbook 的阅读能力后端全部是 moon-well 薄代理（`cps/web.py` 的 `_moonwell_proxy`），真正逻辑都在 moon-well：

- 生词判定 `/vocabulary/reading/analyze`、划词翻译 `/vocabulary/reading/translate`、批量段落翻译 `/vocabulary/reading/translate-batch`（`ReadingVocabularyController`）
- 词标记 `GET /vocabulary/known|unknown/{word}`（known=移出学习队列，unknown=入生词本，`VocabularyController`）
- 阅读设置 `/vocabulary/reading/settings`（`ReadingSettingsController`）
- TTS `/tts/speak`（DashScope 非实时合成，65s 超时）
- 伴读 agent SSE（`AgentChatService` + 7 工具，`AgentChatRequest` 除 message 外全部可空，网页场景 bookId 传 null 即可）

关键宽容性：CORS 全开 `allowedOrigins("*")`；analyze 的 bookId/bookName/chapter 全部可空（缺省 0）；段落译文有 ES 缓存（同段落命中不重复计费）；积分按 token 计费。

因此插件不需要任何后端改造，直接复用。

## 2. MV3 形态的天然优势

- content script 直插主文档 → epub.js 里的 CSRF 自愈、iframe 坐标换算全部消失；
- 请求统一走 background service worker（`host_permissions` 豁免 CORS，且规避 http 页面混合内容限制）；
- UI 挂 closed Shadow DOM 与页面样式隔离。

## 3. 鉴权

moon-well 认证三通道：

| 通道 | 形态 | 插件采用 |
| --- | --- | --- |
| JWT Bearer | Authentik OIDC `/auth/oidc/exchange` 换取，access 7 天 / refresh 30 天 | 备选（P1+ 可做静默刷新） |
| `mk-` 静态 API-key | 存 `user.token`，`AuthHandlerInterceptor` 走数据库校验，无自助签发端点 | ✅ P0 采用（手动配置） |
| 内网信任头 `X-User-*` | `INTERNAL_TRUST_ENABLED=true` 才生效，语义是"agent 只出不进" | ❌ 插件不能依赖 |

## 4. 风险与前置

1. **moon-well 无公网 HTTPS 入口**（fnOS 8082 仅内网）→ 需 Server 2 Traefik 加路由（如 `api.haoshenqi.top`）或仅内网/Tailscale 使用。
2. **JWT 刷新窗口 30 天** → 若走 JWT 需静默 refreshToken + 过期引导重登；P0 用不过期的 `mk-` key 回避。
3. **TTS 65s 超时** → 长段/慢网需 loading 态与降级（P0 先用浏览器 speechSynthesis，P2 接 moon-well 声音）。
4. **MV3 Service Worker 生命周期** → JSON 请求走 SW 无碍；P3 的 SSE 长连接应在 content script 侧消费（与页面同生命周期）或 offscreen document，不在 background 挂 300s 流。

## 5. 分期

- **P0（本仓库当前）**：划词翻译 + 认识/生词标记 + 本地朗读 + 设置页。
- **P1**：段落整页翻译（translate-batch 并发池，从 epub.js 移植）+ 生词波浪线标注（analyze）+ Token 自助化。
- **P2**：moon-well TTS 朗读（/tts/speak 音频播放状态机 + speechSynthesis 降级）。
- **P3**：AI 伴读聊天面板（SSE 消费移植 ai_chat.js ~1.2k 行；唯一建议的 moon-well 改动是 system prompt 增加 web 场景分支）。
