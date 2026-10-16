# response-archive — R30–R31

> 2026-10-11（R41 集成时窗口超限——R40 先行推送使窗口达 12）从 `response.md` 原样搬移。只搬原文，不总结、不改写、不改编号。

### R30（单测逻辑改两级：开发态部分验证，正式发布才走全量清单）

- **AGENTS.md §2 编码实现·交付标准**：新增「两级验证闸门」子条——本项目无自动化测试框架，闸门落在 §3 手工验收清单上：**开发态（默认）**只实测本次改动涉及的 AC 条目；**正式发布态**（用户显式提出「发布 / 上线」，即 §0.2 去掉时间戳后缀并 merge `release` 那一步）必须把 §3 清单逐条走全并全过。
- **跨仓同步**：moon-well R119 / magicbook R131 / app-manager R36 把「全量单元测试」拆成开发态部分 + 发布态全量两级；本仓以手工清单对应同一口径。与既有 §0.2 两段式版本规则天然吻合（带时间戳后缀的测试版不触发发布）。
- **归档**：本条使窗口超 10（原 R20–R29 共 10 条），按「写入即检查、超 10 立即搬移」当场把 R20 条目原样搬移至 `response-archive/response-R20.md`（逐字节 diff 校验一致）并登记索引，窗口回到 10 个 request。
- **总结**：requests.md 本条 R30；response.md 追加本条并完成上述搬移；冲突记录：无（30 未被并行占用）。只改文档，未动扩展代码与 manifest 版本。

### R31（发布 magiclens）

- **回应**：按 R18 流程完成 v0.8.0 正式发布——
  - 发布批次 commit `522092d`（23 文件：R24 iframe 多文档 + R25 域名管理 + R26-R30 文档体系批次 + 台账与归档补账），`version_name` 清理时间戳为纯 `0.8.0`；push develop → merge release 分支推送；
  - `release.yml` 触发成功（run 37735576781，12s），**Release v0.8.0 已上线**：https://github.com/haoshenqi-family/magiclens/releases/tag/v0.8.0 ，附件 `magiclens-extension-v0.8.0.zip`；
  - zip 下载实测：manifest `0.8.0 / 0.8.0`（无时间戳），13 个文件齐全（含新增 common.js）。
- **总结**：requests.md 占号 R31；response.md 本条；冲突记录：无。

