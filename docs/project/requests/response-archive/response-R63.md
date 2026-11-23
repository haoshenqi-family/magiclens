## 2026-11-13（R63：缺陷——滚动复习词卡报 unknown message type）

### R63（用户：「fix this bug」+ 截图：滚动复习词卡红字 unknown message type + 重试）

- **现象**：悬浮球旁「滚动复习」词卡整卡变红字 `unknown message type`，「重试」恒失败；同页其它功能（划词、高亮、伴读）正常。
- **根因（实测证据，非 R59 代码回归，是 SW 与 content script 版本错位）**：报错串全仓唯一来源是 `background.js` 的 `default` 分支；词卡拉队列只发 `ml:review-queue`（R59 新增类型）。Chrome（Default profile）加载的是解包扩展 `magiclens/extension`，而其 **SW ScriptCache 仍是 2026-10-29 的构建**——`rpc.js` 的 MSG 表没有 `ML_REVIEW_QUEUE`、`background.js` 仍含 R61 已删除的 `ENROLLMENT_URL` 常量，整个 ScriptCache 目录 grep `ml:review-queue` 命中 0；对应 V8 code cache 时间戳却是 2026-11-13 16:14，说明今天 SW 被唤醒时仍在跑旧脚本。content script 则是每页从磁盘重读的，所以页面里是 R59 之后的新版（词卡在）→ 新类型落到旧 SW 的 `default`。MV3 解包扩展改消息表后，SW 只有在 `chrome://extensions` 重新加载或扩展更新时才重新注册，SW 脚本缓存（含 `importScripts` 的 `rpc.js`）会把旧构建一直沿用。
- **处置 A（根因动作，用户侧 2 步）**：`chrome://extensions` → MagicLens 词镜 → **重新加载** → 刷新出问题的页面，词卡即恢复。
- **处置 B（代码加固，本次提交）**：`ball.js` 新增 `reviewErrorText()`，把 `unknown message type` / `Extension context invalidated` 两类环境错误翻成可行动中文（「扩展版本未同步：请在 chrome://extensions 重新加载扩展，再刷新本页」/「扩展已更新，请刷新本页后重试」），业务错误（积分不足/超时/401 话术）原样透出——不静默降级；`background.js` 的 `default` 回带 `type` 便于 console 定位，错误串前缀保持不变；版本 0.8.24 → **0.8.25-202611131705** 测试版（带时间戳不触发发布；合并时与并行 R64 撞 0.8.25，按推送序顺延 **0.8.26-202611141315**）。
- **验证**：`node --check` 双文件过、`manifest.json` JSON 合法；`reviewErrorText` 抽源码实跑 5 例断言全过（unknown→重载指引、invalidated→刷新指引、积分不足原样透出、空串兜底、「重新加载」关键词）；确认 `background.js` default 回带 `type`。**真机待用户按处置 A 验收**：重载扩展 + 刷新后词卡正常轮播。
- **文档四问**：能力未变（仅错误话术）→ README 不动；契约未变（无新消息类型/新端点）→ design.md 不动；实现/边界 → LLD `iterations/1.0/r63-review-sw-skew/lld.md`；本次怎么实现 → 同文件。集成矩阵无新行（不新增/修改路由与特性，guard 三向对账不触发）。
- **教训**：本仓新增消息类型的验收必须「**先 `chrome://extensions` 重新加载，再刷新页面**」——只刷新页面会得到「新 content script + 旧 SW」的假失败（与 R62「harness 默认装主检出、验 worktree 必须 `--ext`」同类：验收前先确认被测的是哪一版构建）。
- **台账**：requests.md 占号 R63（claim.sh `0931667`，已 push）；worktree `../magiclens-r63-review-sw-skew`、分支 `fix/r63-review-sw-skew`，已 merge 本地 develop；**2026-11-14 用户令与 R64 一并 merge develop 并 push**（合并版顺延 0.8.26-202611141315），按 ops R187 merge 即清口径，其 worktree/分支待 worktree-doctor 巡检清理；窗口轮转：写入前 R53–R62 共 10 条，R53 原样搬至 `response-archive/response-R53.md` 并登记索引，窗口回到 R54–R63 共 10 条。
- **总结**：本条为回应；冲突记录：无。
