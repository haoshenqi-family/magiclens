# magiclens 文档修正项明细（DF1–DF4）

> 状态：任务清单（2026-10-15 建档，全部待启动；均为纯文档活，主检出可直接做，无需 worktree）
> 来源：家族根 [`architecture-review-2026-10-14.md`](../../../../../docs/architecture-review-2026-10-14.md) §5（文档冲突标记）中本仓相关条目；编号沿用原文（N=数值冲突、K=口径冲突）便于回溯。
> ⚠️ 执行纪律：本清单只登记任务，本轮未执行任何修正。

---

## DF1 ·（N4）design.md §3 表体 token 时效改正文

- **问题**：`docs/design.md` §3 鉴权表体仍写旧值「access 7 天 / refresh 30 天」，仅靠 L35 更新注（2026-10-07 R26）指正——表体旧值未改，同文正文与 `README.md`、moon-well system HLD 均为 30/90 天（moon-well R101 起 `app.auth.*ExpireDay` 可配置）。
- **任务**：按报告建议「表体应直接改正文」：表体改为 access 30 天 / refresh 90 天，保留 R26 更新注说明历史口径（历史文档只标注不重写——更新注保留，表体数值改现行值）。
- **验收**：表体、L35 注、README、moon-well HLD 四处口径一致（数值同源：以 moon-well 现行契约为准）。

## DF2 ·（K3）README 兼 L1 + API 契约速查的二义——待用户决策

- **问题**：本仓 `README.md` 同时承担 L1 用户文档（功能表、安装）与 API 契约速查——与家族根文档规范「L1 负面清单（契约/部署细节下沉）」冲突；但本仓 `AGENTS.md` 文档规范表又自我豁免（L1 含「API 契约速查」）。两级规则并存二义。
- **任务**：**需用户定夺**，两个方向：
  - A. 契约速查下沉新文件（如 `docs/api-quick-reference.md`），README 回归纯 L1；本仓 AGENTS.md 文档规范表同步修订；
  - B. 维持现状，在家族根文档规范节为本仓（单模块纯前端项目）加显式豁免注记。
  两方向均涉规则文件（AGENTS.md）变更，须用户批准后执行，不擅自动手。
- **验收**：选定方向落地后，家族根规范与本仓 AGENTS.md 口径一致，二义消除。

## DF3 · 悬空 feat 补索引

- **问题**：`docs/feat/word-detail` 的 lld 无 L1/L2 引用（报告 §5「C-索引完整性」）。
- **任务**：在 `docs/design.md` §5 分期或 README 功能表补该 feat 的引用路径（本仓反向索引口径：L3 至少在 design.md 或 README 出现一次）。
- **验收**：`docs/feat/*` 目录集合与 design.md / README 引用集合差集为空。

## DF4 · 三方一致性检查（README ↔ feat ↔ manifest）

- **问题**：一致性纪律要求 README 功能状态表 ↔ `docs/feat/` ↔ `manifest.json` version 三者对齐；架构评审后新增本拆分 feat 目录，需一并纳入对齐检查。
- **任务**：随每次交付例行核对；本轮建档后先做一次全量核对（功能表条目、feat 目录、版本号）。
- **验收**：三方对齐，发现漂移随手修正（AGENTS 一致性纪律）。
