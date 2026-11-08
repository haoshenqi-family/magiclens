# response-R44.md（归档）

> 2026-11-08 R59 写入触发轮转：本节由 response.md 原样搬入，未改写。

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
