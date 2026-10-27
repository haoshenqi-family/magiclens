### R41（worktree 规范微调：merge 后保留待验收，验收通过后删除）

- **用户指令**：不要 merge 即删除 worktree，改为 merge 后保留等用户验收，验收通过后再删除。规范主体（临时 worktree、非占用池、无构建链即装即用、发布 merge 在 worktree 内做）不变，只改收尾时序。
- **落地改动**：家族根「Git Worktree 开发纪律」收尾闸门改两段式；本仓 AGENTS.md 收尾闸门同步微调，新增「验收期驻留（正常状态）」条——本仓验收方式：`chrome://extensions` 从该 worktree 目录「加载已解压的扩展程序」实测；验收发现新问题时在原 worktree 内继续修（manifest 版本按 §0.2 再次递增），修完重新 merge 后再等验收。
- **窗口**：与远端 R40 集成后窗口含 R30–R41 共 12 个 request，把最旧的 R30、R31 两节原样搬至 `response-archive/response-R30-R31.md` 并登记索引，窗口恢复 10 个（R32–R41）；此前本条初版已搬 R29（当时窗口 11）。
- **总结**：requests.md 占号 R41（与并行会话金山直连查词补报撞号 40 后按纪律续编）；response.md 本条；冲突记录：R40 撞号如上。本任务只改文档与对话记录，未动任何代码与 manifest（版本号不变）。
