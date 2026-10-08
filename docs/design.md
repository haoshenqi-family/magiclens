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

> **更新（2026-10-07 R26 文档整理）**：上表为 R118/R119 评估时快照。现状：v0.3.0 起已采用 Authentik OIDC 登录（`/auth/oidc/login` → 回调页自动捕获）+ `/auth/refreshToken` 静默刷新，`mk-` 静态 key 手动配置通道已随登录化弃用；JWT 有效期为 access 30 天 / refresh 90 天（moon-well R101 起，`app.auth.*ExpireDay` 可配置）。

## 4. 风险与前置

1. **moon-well 无公网 HTTPS 入口**（fnOS 8082 仅内网）→ 需 Server 2 Traefik 加路由（如 `api.haoshenqi.top`）或仅内网/Tailscale 使用。
2. **JWT 刷新窗口 30 天** → 若走 JWT 需静默 refreshToken + 过期引导重登；P0 用不过期的 `mk-` key 回避。
3. **TTS 65s 超时** → 长段/慢网需 loading 态与降级（P0 先用浏览器 speechSynthesis，P2 接 moon-well 声音）。
4. **MV3 Service Worker 生命周期** → JSON 请求走 SW 无碍；P3 的 SSE 长连接应在 content script 侧消费（与页面同生命周期）或 offscreen document，不在 background 挂 300s 流。

## 5. 分期

- **P0（已交付）**：划词翻译 + 认识/生词标记 + 本地朗读 + 设置页（US1/US2）。
- **P0.5（已交付）**：AI 伴读聊天抽屉（R119 评估并入当前批次，与划词共享全部基建）+ moon-well 侧两改动（web prompt 分支 + skipMemoryExtract），设计见 `docs/feat/chrome-extension/design/lld.md`。
- **P1（部分交付）**：生词智能高亮已交付（v0.5.0，2026-10-06，借鉴「明畅·个人词库」机制：CSS Custom Highlight API 渲染 + analyze 判定矩阵 + 视口懒渲染 + MutationObserver 增量，设计见 `docs/feat/vocab-highlight/design/lld.md`）；v0.7.2（2026-10-07，R24）补多文档（iframe）支持——magicbook 阅读器正文在 epub.js 同源 iframe 里且阅读页标题为中文书名，引擎按文档多实例化 + 文档绑定早于首扫 + 逐文档正文采样门控（lld.md §6）；剩段落整页翻译（translate-batch）与 OIDC/JWT 相关收尾。
- **P2**：moon-well TTS 朗读（/tts/speak 音频播放状态机 + speechSynthesis 降级）。
- **储备**：chrome.sidePanel 兜底方案、Readability 深度正文抽取、右键菜单「问 AI」。

## 6. 版本与发布（2026-10-06，依据 requests.md R11；R18 改为 release 分支触发）

仓库已转 **public**。版本号两段式，发布全自动：

- **测试版 `X.Y.Z-YYYYMMDDHHmm`**：每次修改完成即递增（`version` 语义化 +1，时间戳写进 `version_name`），供 `chrome://extensions` 重载验证，**不触发发布**。
- **正式版 `X.Y.Z`**：**用户确认**可发布后，清理 `version_name` 时间戳推送到 `develop`，再由 AI merge `develop` 到 `release` 分支——push 到 `release` 才触发 [.github/workflows/release.yml](./.github/workflows/release.yml)（R18 起，原 develop 触发已废除；`release` 分支随 R18 自 develop HEAD 建立）：打 `vX.Y.Z` tag、创建 GitHub Release、附 `extension/` 打包 zip；测试后缀或 Release 已存在均跳过。
- **分发渠道（2026-10-07，R23 决策）**：**仅通过 GitHub Releases 分发，不上架 Chrome Web Store**——避免注册费、`<all_urls>` 广泛权限深度审核与后续每次更新的审核维护成本；用户经开发者模式加载 zip 自装。商店上架材料已备好备用：[docs/webstore/listing.md](./webstore/listing.md)（listing 文案/权限理由/截图规格）与 [PRIVACY.md](../PRIVACY.md)（隐私政策），未来决定上架时直接可用。注意 GitHub 分发的固有限制：扩展更新需手动重新下载 zip 并在 `chrome://extensions` 重载（无自动更新通道）。

## 7. 金山词霸直连快路径（2026-10-07，R15，v0.6.0）

**决策**：单词划词由 background service worker 直连金山词霸 suggest 接口（`dict-mobile.iciba.com`，免费无凭证，与 moon-well `IcibaDictClient` 同一端点同一解析口径），miss/异常静默回退 moon-well `/vocabulary/reading/translate`。moon-well 零改动，magicbook 不受影响。

- **动机**：原链路单词查询要绕行 浏览器→Traefik(Server 2)→Tailscale→fnOS→出网查金山（两段 TLS + 一段隧道）；R122 曾观测到浏览器→moon-well 入口间 ~5.9s 未解释盲区。直连一跳通常百毫秒级，且免登录（未登录用户单词翻译也可用）。
- **权限**：manifest 本就 `host_permissions: ["<all_urls>"]`，无新增权限。
- **词干还原**：background.js 内置 JS 版 Porter，对齐 moon-well `WordStemmer` 依赖的 Lucene 8.3.0 `EnglishAnalyzer`（94 向量经真实 Lucene 实测逐一验证）。注意 Lucene 版与 1980 原始算法有两处规则差异（`bli→ble` 替代 `abli→able`、新增 `logi→log`），且 `wolves→wolv`、`agreed→agre` 才是 Lucene 实测输出（moon-well `WordStemmer` 注释里 `wolves→wolve` 的示例是 step1 中间值，非最终输出；行为结论「截出的非词由 iciba 自然 miss 降级 LLM」不受影响）。若未来 Java/JS 两份实现出现偏差，后果仅是金山多 miss 一次后回退后端（权威兜底），不会产生错误翻译。
- **缓存**：`chrome.storage.session`（会话级）512 条 LRU，含 miss 负缓存（接口不可用时同词不重复白等超时）；权威缓存仍在 moon-well ES（跨设备），故本地不做持久化。
- **超时**：直查 2.5s（后端 3s 同量级），超时负缓存并回退。
- **边界**：短语/句子/词典 miss 仍走 moon-well（时间大头是 LLM 生成本身，直连帮不了）；扩展直查后词典释义不再从插件侧写入 ES（magicbook 链路仍在写，无实际损失）。

## 8. 生词判定后端升级为词族口径（2026-10-07，R16，扩展零改动）

**决策**：单词的「认识/生词」判定按单词（屈折词族）而非页面表层形（token），由 moon-well 侧落地（`WordInflection` + `WordFamilyJudge`，analyze 与 familiar 同矩阵）；翻译/释义等信息提供仍按表层形 token。扩展端零改动、不升版本。

- **动机（R16 bug）**：服务端按精确 token 判定、客户端高亮按词族双向匹配——标记 installed 认识只写了精确词形，同页未标记的 install（CET4=3 > 用户档位）仍按词档兜底返回生词，重扫时经 `lemmaCandidates` 双向匹配把 installed 重新点亮。标记当下的消失只是前端全集清扫的临时效果。
- **后端语义**：自身显式标记 > 词族显式标记（认识优先）> 词族最小档位兜底；单词本/分级表查询按词族全集展开，跨页标记生效；派生词（installation）与不规则变形（ran/run）不在规则还原范围，维持独立判定（与扩展端同缺口）。
- **两端镜像约束**：moon-well `WordInflection.lemmaCandidates` 与本仓库 `highlight.js lemmaCandidates` 规则逐条一致，改任一侧必须同步另一侧并向量测试互为镜像（moon-well `WordInflectionTest`）。

## 9. 域名管理：按域名禁用插件（2026-10-07，R25，v0.8.0）

**决策**：`chrome.storage.sync` 新增 `disabledDomains: string[]`，条目为归一化 hostname，匹配语义「该域 + 全部子域」（无精确/仅子域两种模式——域名禁用的直觉语义就是整站别管，多一种模式多一份理解成本）；门控放 content script 注入层（content.js 主引擎与 highlight.js boot 各自判定，`common.js` 提供共享的归一化/匹配助手），禁用站零 UI、零 DOM 监听、零请求（highlight.js 保留判定所需的 chrome.runtime/storage 内部监听，页面 DOM 监听为零）。UI：options 名单管理 + popup 本站一键禁用/恢复。设计细节见 `docs/feat/domain-management/design/lld.md`。

- **生效语义（统一）**：名单只决定新加载页面，变更后刷新生效。Why 不做运行中即时拆装：content.js 的 UI 与监听是顶层一次性装配，可逆化需把装配重写为 init/retire 对称结构，风险与收益不成比例（低频配置动作）。
- **highlight.js 的坑**：它有 storage.onChanged / Alt+U 等现成「重开路径」，只挡 boot 的话禁用站会被后续全局开关变化复活引擎；因此启动时把判定结果固化进 `siteDisabled` 并入 `shouldEngineRun()`，所有路径统一封死。
- **边界**：OIDC 登录回调捕获不受域名禁用影响（禁 moon-well 域不该废掉自己的登录回调）；chat.js 零改动（唯一入口是划词气泡「问 AI」，content 禁用即天然禁用）；不新增 permission；不做白名单模式与子路径粒度。
