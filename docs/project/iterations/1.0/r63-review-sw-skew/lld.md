# LLD — R63 滚动复习词卡报 `unknown message type`（缺陷：service worker 版本漂移）

- **状态**：开发中（0.8.25-202611131705 测试版，已 merge 本地 develop，待真机验收）
- **关联需求**：magiclens R63（缺陷，挂在 R59 滚动复习之上）；对端 moon-well / magicbook **零改动**（不改契约、不加端点）。

## 1. 现象

悬浮球旁的「滚动复习」词卡整卡变成红色错误 `unknown message type` + 「重试」，且点重试永远同样失败；同页其它功能（划词翻译、生词高亮、伴读）正常。

## 2. 根因（证据链，2026-11-13 实测）

1. **报错串唯一来源**是全仓 `background.js` 的 `default` 分支（`grep -rn "unknown message type"` 仅 1 处命中）。
2. 词卡拉队列只发一条消息：`ball.js` 的 `bg({ type: MSG.ML_REVIEW_QUEUE })` → `ml:review-queue`（R59 新增类型）。旧 SW 不认识它，才走 `default`。
3. Chrome（Default profile）加载的是**解包扩展** `magiclens/extension`（`Secure Preferences`：`path=/Users/haoshenqi/codelib/haoshenqi-family/magiclens/extension`、`location=4`）。
4. Chrome 的 **SW ScriptCache 仍是 2026-10-29 的构建**：
   - `background.js` 原始副本无 `ML_REVIEW_QUEUE`、仍含已被 R61 删除的 `ENROLLMENT_URL` 常量；
   - `rpc.js` 原始副本的 `MSG` 表里没有 `ML_REVIEW_QUEUE` / `ML_REVIEW_DETAIL_BATCH`；
   - 全 ScriptCache 目录 grep `ml:review-queue` = 0 命中；
   - 而对应 V8 code cache 的时间戳是 **2026-11-13 16:14**（即今天 SW 被唤醒时仍在跑 10-29 的旧脚本）。
5. content script 是**每页加载时从磁盘重读**的，所以页面里是 R59 之后的新版（词卡存在）；两侧版本错位 → 新消息类型落到旧 SW 的 `default`。

**结论**：MV3 解包扩展改消息表后，service worker 只有在 `chrome://extensions` 点「重新加载」或扩展更新时才重新注册；Chrome 的 SW 脚本缓存（连同 `importScripts` 进来的 `common.js`/`rpc.js`/`iciba.js`）会把旧构建一直沿用下去。**这不是 R59 的代码回归，是 SW 与 content script 版本错位**。

## 3. 修复

### A. 现场处置（真正的根因动作）

`chrome://extensions` → MagicLens 词镜 → **重新加载** → 刷新出问题的页面。重载后 SW 重新注册、重读磁盘脚本，词卡即恢复。

### B. 代码加固（本次提交，让同类故障不再以裸英文内部错误示人）

| 文件 | 改动 | Why |
| --- | --- | --- |
| `extension/ball.js` | 新增 `reviewErrorText()`，`reviewLoad()` 的 `if (!resp.ok)` 走它 | `unknown message type` / `Extension context invalidated` 是**环境/生命周期**错误，用户唯一可做的事是重载扩展或刷新页面；原样抛英文等于无解（重试恒失败） |
| `extension/background.js` | `default` 分支回带 `type: msg.type` | 版本漂移时在 console 一眼看到是哪个类型没人认领；错误串前缀保持不变，content 侧按前缀识别 |
| `extension/manifest.json` | `0.8.24` → `0.8.25-202611131705` 测试版 | 版本号规则 §0.2，带时间戳不触发发布 |

**话术映射**（只翻两类，其余原样透出）：

| 上游 error | 卡片文案 |
| --- | --- |
| 含 `unknown message type` | 扩展版本未同步：请在 chrome://extensions 重新加载扩展，再刷新本页 |
| 含 `invalidated` / `disposed` | 扩展已更新，请刷新本页后重试 |
| 其它（如「积分不足…」/「请求超时…」） | 原样透出 |
| 空 | 复习词拉取失败 |

## 4. 边界与不做

- **不静默降级**：失败必须在界面上可见（家族口径），所以不做「隐藏词卡」；只把无法行动的英文协议错误换成可行动的中文指引。
- **不掩盖业务错误**：白名单式只匹配两类协议/生命周期串，moon-well 的真实 message（积分、超时、401 话术）原样透出。
- **不改消息契约、不加消息类型** → 无 moon-well 侧改动，集成矩阵无新行（B-4 门禁不触发）。
- **旧 SW 不会自愈**：同一 SW 生命周期内点「重试」仍会失败，属预期；卡片文案指的就是唯一可行动作。

## 5. 验证

- 静态：`node --check extension/ball.js`、`node --check extension/background.js`、`manifest.json` JSON 合法。
- 话术单测（node 抽源码实跑 `reviewErrorText`）：`unknown message type` → chrome://extensions 指引；`Extension context invalidated` → 刷新指引；`积分不足，无法使用AI功能` → 原样；空串 → 兜底；background `default` 确认回带 `type`。
- 真机（待用户）：① 重载扩展 + 刷新页面后词卡正常轮播（恢复）；② 不重载扩展打开新页面时，卡片应显示中文指引而非 `unknown message type`。

## 6. 教训（可复用）

**本仓任何新增消息类型的验收，必须「先在 `chrome://extensions` 重新加载扩展，再刷新页面」**。只刷新页面会得到「新 content script + 旧 SW」的假失败——R63 就是用户 11-13 验收 v0.8.24 时踩到的：SW 停在 10-29 的构建，页面却是 11-08 的脚本。此坑与 R62「harness 默认装主检出、验 worktree 必须 `--ext`」属同一类：**验收前先确认被测的到底是哪一版构建**。
