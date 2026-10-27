# response-archive · response-R40（2026-10-27 R54 写入触发轮转搬移，原文如下）

### R40（background.js 直连命中上报 /learning/strands/lookup；随 moon-well R152 端点）

- **交付**（worktree `../magiclens-lookup-report`，分支 `feat/r40-lookup-report`，基于 origin/develop a73fd95；worktree 驻留待用户确认）：`ml:translate` 的 iciba 直连命中分支加 `reportLookup(text)`——fire-and-forget POST `/learning/strands/lookup {word}`（复用 callApi 的 Bearer 与 401 静默续期），会话内 Set 去重（SW 挂起重置由服务端同词同日 doc id 幂等兜底），失败静默不打断翻译快路径。miss 回退路径本经 moon-well（logWord→LOOKUP_DAY）无需处理。
- **语义**：纯遥测——moon-well R152 端点只发 LOOKUP_DAY 事件（canonical 归一），不建生词本行、不建词典文档；直连命中因此计入词汇股而零建档副作用。
- **版本**：0.8.7 → **0.8.8-202610111039**（测试版：带时间戳不触发发布，`chrome://extensions` 重载即用；正式发布仍走用户确认 + release 分支两段式）。
- **README（L1）**：API 契约速查表补 `/learning/strands/lookup` 一行。
- **总结**：requests.md 占号 R40；本条为回应；冲突记录：无。
