# magiclens 架构评审任务拆分（2026-10）

> 状态：任务清单（2026-10-15 建档，全部待启动；本轮仅登记任务，未做任何开发）
> 来源：家族根 [`architecture-review-2026-10-14.md`](../../../../../docs/architecture-review-2026-10-14.md) §2.3（L1–L7）、§3.3（严重度标记）、§2.5（X1/X2 本仓部分）、§2.7（波次）；跨仓协同总账见家族根 [`arch-review-2026-10-tasks-crossrepo.md`](../../../../../docs/arch-review-2026-10-tasks-crossrepo.md)
> 建档：2026-10-15（`requests.md` R45）。开工时逐任务按 `AGENTS.md` worktree 纪律单独立项（一任务一分支），本清单不整包启动。

## 一、本目录文档

| 文档 | 内容 |
| --- | --- |
| [overview.md](overview.md) | 本文件：任务总表、波次依赖、跨仓协同、执行纪律 |
| [refactor-items.md](refactor-items.md) | 编码类重构项 L1–L7 + §3.3 未编号项 + 跨仓项 X2 本仓部分（开工需 worktree） |
| [doc-fixes.md](doc-fixes.md) | 文档修正项 DF1–DF4（纯文档活，主检出可直接做，无需 worktree） |

## 二、任务总表

（「状态」列随开工 / 验收回填；编号与家族根评审报告一一对应，便于回溯原文。）

| ID | 任务 | 类型 | 严重度 | 波次 | 前置依赖 | 状态 |
| --- | --- | --- | --- | --- | --- | --- |
| L1 | 抽 `rpc.js`：合并三份 askBackground，消息类型常量集中（X1 本仓部分） | 编码 | 🟠 | **波 1（X1 三端合围）** | 无 | 待启动 |
| L6 | 失败可见：高亮 analyze 静默降级上浮 + chat memory 写操作补提示 | 编码 | 🔴 | 未排（原波次表未覆盖；🔴 建议尽早，可与波 1 同窗口） | 无 | 待启动 |
| L4 | 抽 `ensureAuthToken()`：token 刷新链两份手抄合一 | 编码 | 🟠 | 波 2 | 无 | 待启动 |
| L5 | settings.js 单一 schema：DEFAULTS 并入 common.js，消灭 5 处默认值 | 编码 | 🟡 | 波 2 | 无 | 待启动 |
| L2 | content.js 拆分（oidc-callback / bubble / detail-panel / tts） | 编码 | 🟠 | 波 3 | 无 | 待启动 |
| L3 | background.js 减重：importScripts 移出领域代码 | 编码 | 🟡 | 未排（原波次表未覆盖） | 无 | 待启动 |
| L7 | 镜像向量锁：四组同构逻辑建 node 断言向量（X2 本仓部分） | 测试 | 🟠 | 波 4 | 与 magicbook / moon-well 同窗口 | 待启动 |
| U1 | §3.3 未编号：`__magicLens*` 隐式钩子 13 处靠 manifest 顺序——注册表化 | 编码 | 🟡 | 未排 | 无 | 待启动 |
| U2 | §3.3 未编号：host 挂载 id 防御小缺口（`content.js:79` / `page-extract.js:37`） | 编码 | 🟡 | 未排 | 无 | 待启动 |
| DF1–DF4 | 文档修正（数值冲突 / 口径二义 / 悬空索引 / 一致性） | 文档 | — | 数值类随波 0，其余未排 | 无 | 待启动 |

> 波次口径引自报告 §2.7：波 1（契约 X1：M4+B5+L1）→ 波 2（L4/L5）→ 波 3（巨石拆分：L2）→ 波 4（X2 向量锁：L7）。L3 / L6 未入原波次表，属本拆分文档如实标注的「未排」项；其中 **L6 严重度 🔴（R44 同型病未根治）**，本拆分建议尽早执行（可与波 1 同窗口），最终顺序由用户定夺。

## 三、跨仓协同项（本仓承担部分）

| 项 | 内容 | 协同仓 | 落地窗口 |
| --- | --- | --- | --- |
| X1 契约治理三端合围 | 本仓 **L1**（rpc 门面：统一消息封装与错误语义） | moon-well **M4**（包装兜底）、magicbook **B5**（统一解包） | 波 1 同一窗口（R44/R173 类事故从「三端各自防御」变「两端机制 + 一端可见」） |
| X2 镜像向量锁 | 本仓 **L7**：四组同构逻辑（TTS fallback / 详解六板块 / SSE 帧解析 / 词形还原 porterStem + lemmaCandidates）node 断言向量 | magicbook（三组镜像）、moon-well（`WordInflection` 向量） | 波 4 |
| X3 词汇标度统一（显示侧） | band 唯一标度落地后，高亮/详情展示层跟进 | moon-well 主责 | 未排，随 moon-well X3 |

## 四、执行纪律（引用本仓 `AGENTS.md`，不复制细则）

1. **worktree**：编码类任务开工即建 `../magiclens-<slug>`（从 `origin/develop` 最新点切出）；本仓无构建链，worktree 即装即用；验收 = `chrome://extensions` 从 worktree 目录加载实测。
2. **版本号两段式**：每次修改完成必须递增测试版（`version` 语义化 +1，`version_name` 带 `YYYYMMDDHHmm` 时间戳，不触发发布）；正式发布（去时间戳 + merge `release`）仅由用户确认后执行。
3. **硬性约定不破坏**：请求一律经 background SW 中转；UI 挂 closed Shadow DOM；token 只存 `chrome.storage.sync`；API 契约以 moon-well 代码为唯一权威。
4. **验收**：本项目无自动化测试框架——除 L7（node 断言向量）外，各任务验收按 §3 手工清单实测涉及项；L6 的「失败可见」必须真机模拟接口故障验证 UI 呈现。
5. **状态回填**：每任务完成即回填本文件总表「状态」列与 `refactor-items.md` 对应小节的状态行；README 功能表与 design.md 决策记录按三级联动同步。
