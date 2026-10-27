# response-archive — R26

> 2026-10-10（R36 写入触发窗口轮转）从 `response.md` 原样搬移。只搬原文，不总结、不改写、不改编号。

### R26（跨项目 L1-L3 文档评审与产品评估，只改文档）

- **范围**：配合家族根 `docs/product-review-2026-10-07.md`，核查本仓库 README ↔ docs/feat ↔ manifest 三方对齐并修正漂移。**未触碰 extension/ 任何文件**（工作区里 v0.7.2/v0.8.0 在途改动与 response-archive/ 均系 R24/R25 并行会话产物，保持原样）。
- **修正清单（5 处）**：design.md §3 鉴权表加更新注（R118/R119 快照：现行 v0.3.0 起 OIDC 登录化、mk- key 弃用、token 30/90 天——R101）；chrome-extension lld US3/US4 状态回填（US3 v0.2.0 已交付、US4 moon-well R97 已上线）+ §6.3 鉴权表 7d/30d→30/90d 并标注 mk- 已弃用；vocab-highlight lld §3/§5「仅顶层 frame 不进 iframe」与 §6 R24 多文档自相矛盾→统一为「同源两层内 iframe 参与，跨源/更深层不进」；README 待办 P1 收窄（生词标注已随 v0.5.0 交付，剩段落整页翻译）；webstore/listing.md 加上架前勘误（现行 release.yml `zip -r … extension` 产出 zip 根层是 extension/ 目录，与商店「manifest 在根层」要求不符，上架需改打包方式并刷新版本锚点）。
- **遗留（代码类不动）**：`extension/background.js:5` 注释仍写 access 7d/refresh 30d，属代码注释按任务边界未改，建议下次改扩展时顺手更新。
- **总结**：requests.md 本条 R26；response.md 追加后仍在 10 条窗口（R25 已做过 R1-R15 归档）；冲突记录：无。

