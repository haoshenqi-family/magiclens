# requests.md — 对话需求记录（只追加，永不归档）

1. 重构 AGENTS.md：从 magicbook 复制模板结构（核心工作流/任务分类/文档规范/对话记录纪律），将原有轻量版内容整理为「系统说明（AI 必读）」章节，补齐家族根规则、上游项目与 API 权威源的正确引用，并标注 AI 必读。
2. 依据 R119 专项评估完成 magiclens 的 LLD（docs/feat/chrome-extension/）：伴读聊天移植为主（SSE 消费/抽屉 UI/页面上下文提取/会话记忆学情面板），含 moon-well 侧 system prompt 场景分支与 skipMemoryExtract 字段设计，并同步调整分期（P0=登录+划词翻译+伴读聊天简版）。
3. 实施 LLD M2+M3：伴读聊天抽屉（chat.js + page-extract.js + 划词气泡「问 AI」联动 + background 面板端点中转），manifest 0.2.0。
4. v0.3.0 配置与登录改版：设置页去掉手动地址/Token 配置，改为跳转 magicbook 同款 Authentik 登录页、登录成功自动捕获令牌（401 静默刷新）；后端默认走公网域名 moon-well.haoshenqi.top（含 Traefik 公网路由上线）；移除「本会话不记忆」勾选与设置项，记忆始终开启。
