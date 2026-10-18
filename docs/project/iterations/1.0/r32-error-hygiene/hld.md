# HLD — R32 报错详情不暴露给用户（剩余接入点收尾）

> 状态：设计（草案 v1，2026-10-18，待第二轮讨论）
> 关联：Ship [MAGICLENS-33 / idea IBnRbOtq](https://haoshenqi.pingcode.com/ship/ideas/IBnRbOtq)（缺陷，关联需求 MAGICLENS-8/R8 单词详解）· PJM 工作项 MAGICLENS-3 · 已交付：moon-well R124 权威层（fba5ca4）、本仓防御层 v0.8.1（b74cea0，已随 v0.8.5/v0.8.10 正式版发布）。

## 1. 背景与现状

原缺陷：单词详解面板把上游技术细节（`Magpie call failed: I/O error on POST http://192.168.31.9:3425/...: Read timed out`）直接亮给用户。

两层已上线：

- **权威层**（moon-well R124）：服务端只回干净业务文案，技术细节进日志。
- **防御层**（本仓 v0.8.1）：`common.js` `g.__magicLensUserFacingError(msg, fallback)` 黑名单正则（URL/IP/Exception/I\/O error/timed out/call failed/Failed to fetch）命中即换 fallback + `console.warn` 原文；已接入 content.js 翻译/标记/详解、chat.js SSE error 与请求失败。

**2026-10-18 调查结论——剩余未接入点（本条范围）**：

| 位置 | 现状 |
| --- | --- |
| `popup.js` L89 重扫描失败 | `(resp && resp.error) || '扫描失败'` 裸显 resp.error |
| `popup.js` L21-25 + `highlight.js` L527 analyze 失败 | 失败 reason 截 200 字符存 `analyzeLastError`，popup 常驻行裸显 |
| `options.js` L51 测试连接 | `resp.error` 裸显 |
| `chat.js` L419/445/465/478/488/527 会话管理 | 会话列表/历史/重命名/删除/记忆列表失败 `resp.error \|\|` 裸显（R44 加的失败可见路径没走防御层） |

**范围外（登记为依赖/开放问题）**：Magpie 网关（fnOS:3425）自身超时文案治理——网关是部署在 fnOS 的独立服务，其响应文案属于上游侧配置/代码，不在本仓改动面；防御层正则已可兜住 `call failed`/`timed out` 到达扩展端的情形。

## 2. 目标

1. 全部用户可见错误路径统一过 `__magicLensUserFacingError`：技术细节不再出现在任何面板/常驻行。
2. 失败仍**可见**（家族纪律：静默降级把故障伪装成「数据不存在」）——短文案 + console 原文，不吞错。
3. `analyzeLastError` 常驻行改为「短提示 + 原文仅 console」，不再整段裸显。

## 3. 方案

**统一接入既有防御层**（不新建机制）：上表 8 处调用点包 `__magicLensUserFacingError(resp.error, '<场景短文案>')`；`analyzeLastError` 存储改存脱敏后短文案（原文 `console.warn` 一次即可，不落 storage——常驻行是给用户看的，不是排障日志）。

否决方案：

| 否决 | 理由 |
| --- | --- |
| 每点手写 if/正则 | 防御层已存在，重复实现必漂移 |
| 完全隐藏失败（不显示任何提示） | 违背失败可见纪律，接口故障会被误报成「记录丢了」 |
| popup 常驻行保留原文 + 加「详情」折叠 | popup 空间小、折叠交互重；console 已留原文，排障入口够 |

## 4. 仓间分工

- **magiclens**：8 处接入 + storage 字段语义微调（analyzeLastError 内容变短文案）+ 版本两段式递增。
- **moon-well / Magpie 网关**：零改动（权威层已上线）；网关文案治理另立事项（开放问题③）。

## 5. 风险与回滚

| 风险 | 缓解 |
| --- | --- |
| 防御层正则误吞干净业务文案（401 重登/积分不足/选区过长） | 既有正则对干净文案放行（v0.8.1 实测）；AC 重验三类干净文案不受影响 |
| analyzeLastError 语义变化致旧存储残留长文 | 读取时同样过防御层（存旧读新双保险） |
| 回滚 | 单 commit revert；无契约/数据结构变更 |

## 6. 开放问题（第二轮讨论）

1. 各场景 fallback 短文案口径（建议：重扫描「重新扫描失败，请稍后再试」、连接测试「连接失败，请检查网络与登录状态」、会话操作「操作失败，请稍后再试」、analyze「生词判定暂不可用」）。
2. chat.js 会话管理 6 处是否合并为一个共用 helper（建议：是，`chatFallback(err, scene)` 内聚）。
3. Magpie 网关文案治理是否单独立条（属 fnOS 部署物，建议在 ops 侧登记待办而非挂本缺陷）。
