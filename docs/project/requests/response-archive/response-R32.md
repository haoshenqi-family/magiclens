# response 归档：R32（2026-10-08）

> 从 response.md 原样搬移（2026-10-13 R43 写入触发窗口检查：搬前窗口 R32–R42 共 10 个 request，写入 R43 达 11）。只搬移原文，未总结、未改写、未改编号。

### R32（报错详情不应暴露给用户）

- **回应**：按「干净文案给用户 + 详情进日志」双层修复（magiclens v0.8.1-202610081457 测试版；moon-well 侧为其台账 R124，commit fba5ca4 **已部署上线**）。
  - **moon-well（权威层）**：单词详解（截图病灶，`WordDetailService` 反转 R106「cause 保留进消息」旧口径）、translate/translate-batch（此前**无任何兜底**，网关异常原文透传）、伴读 SSE（`AgentChatService` 透传 `e.getMsg()`；`AgentLoop` 兜底分支原先连日志都不记）全部统一；写作题目/批改、复述、口语、ASR 四条 learning 链路同口径修复。业务拒绝（积分不足）保持原文案；**LLM 客户端层消息（`Zhipu/Magpie call failed`）保留不改**——失败分类器按其文本分类、任务表持久化、排障都依赖。`WordDetailServiceTest` 断言反转为「禁止携带 cause 文本」。
  - **验证**：工作区被并行会话（LLM 任务管理功能）持续占用、mvn 跑不稳，改走 git worktree 干净验证——HEAD+我的补丁（即 fnOS 将构建的组合）三个单测类 83/83 全绿；`AgentChatServiceIntegrationTest` 10 Error 为 H2 DDL 既有环境问题（与本次无关）。部署后公网入口 502→401 确认新容器上线。
  - **提交纪律**：`learning/` 整目录系并行会话在途新功能（untracked），其中四条链路的修复**留在文件里随对方功能批次提交**，本次只精确提交 tracked 且无外来 hunk 的 6 文件（`ReadingVocabularyService` 用 `git apply --cached` 挑净我的 hunk，排除对方混入的 eventPublisher/LearningMarkEvent 在途改动——直接整文件 add 会因引用未提交的新包打爆 fnOS 构建）。
  - **magiclens（防御层）**：`common.js` 新增 `__magicLensUserFacingError(msg, fallback)`——疑似技术细节（URL/内部 IP/英文异常/网关标识）归一为通用文案并 console.warn 原文，干净业务文案（未登录/积分不足/选区过长）原样放行，401/403 重新登录流程不受影响；content.js（译/标记/详解）与 chat.js（SSE error/请求失败）接入。node 冒烟 7 场景通过（含截图原始报文）。
  - ADR 记于 `docs/design.md` §10。
- **待用户验收**：重载扩展（v0.8.1）后，随便找一个断网/超时场景（或等网关再超时一次）：详解面板/翻译气泡应显示「AI 生成超时或繁忙，请稍后重试」等干净文案 + 「点击重试」，不再出现内部地址与英文异常；伴读抽屉基础设施故障同理。完整效果依赖 moon-well 新版（已上线）。
- **总结**：requests.md 占号 R32；response.md 本条；冲突记录：无。response.md 归档窗口按新纪律执行（R21-R22 搬入 response-archive/）。
