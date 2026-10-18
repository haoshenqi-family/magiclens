# LLD — R32 报错卫生剩余接入点

> 状态：设计（草案 v1，2026-10-18；开工改「开发中」，上线回填）
> 上层设计：[hld.md](./hld.md)。防御层本体：`extension/common.js` L51-64 `__magicLensUserFacingError`（黑名单正则 + fallback + console.warn）。

## 1. 接入点改动表（8 处）

| # | 文件:行 | 现状 | 改为 |
| --- | --- | --- | --- |
| 1 | `popup.js` L89 | `(resp && resp.error) \|\| '扫描失败'` | `g.__magicLensUserFacingError(resp && resp.error, '重新扫描失败，请稍后再试')` |
| 2 | `popup.js` L21-25 常驻行 | 裸显 `analyzeLastError`（截 200 字符原文） | 渲染前再过一层防御层（存储值语义已变，见 #3） |
| 3 | `highlight.js` L527 | 失败 reason 截 200 字符存 `chrome.storage.local.analyzeLastError` | 存 `__magicLensUserFacingError(reason, '生词判定暂不可用')` 的**脱敏结果**；原文仅 `console.warn` |
| 4 | `options.js` L51 | `resp.error` 裸显 | `__magicLensUserFacingError(resp.error, '连接失败，请检查网络与登录状态')` |
| 5-9 | `chat.js` L419/445/465/478/488/527 | 会话列表/历史/重命名/删除/记忆列表失败 `resp.error \|\| '…'` 裸显 | 新增 `chatFallback(err, scene)` helper（内部走 `__magicLensUserFacingError`，scene 决定 fallback 文案），6 处统一替换 |

## 2. 行为边界（不改的）

- 401/403 重登流程、积分不足、选区过长等**干净业务文案**照旧直显（防御层正则不命中即放行）。
- `console.warn` 保留完整原文（排障入口）。
- SSE error 事件路径（chat.js L373/386，v0.8.1 已接）不动。

## 3. 版本与发布

- `version` 0.8.14 → 0.8.15、`version_name` `0.8.15-<时间戳>`（测试版不触发发布）；正式版按两段式等用户确认后另走 release merge。

## 4. 手测清单（无自动化测试）

1. 断网后 popup 重扫描 → 仅见短文案；console 有原文。
2. 断网后 options 测试连接 → 短文案。
3. 断网后 chat 会话列表/重命名/删除 → 各自短文案，无 URL/IP/堆栈。
4. 后端不可用时等任意页面触发 analyze 失败 → popup 常驻行只显「生词判定暂不可用」（无 200 字符技术串）；恢复后常驻行随下次成功清除（现状行为保持）。
5. 401 过期 → 重登流程照常（文案未被吞）；积分不足文案原样。
6. `chrome://extensions` 重载后版本号显示 0.8.15-时间戳。

## 5. 文档四问预答

- L1（README）：无能力变化，不加条目。
- L2（design.md ADR §10）：防御层接入点清单表补全 8 处（现状表已含 5 处）。
- L3：无独立 L3 页（ADR 覆盖）。
- LLD：本文件状态行。
