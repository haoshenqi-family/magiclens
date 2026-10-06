# requests.md — 对话需求记录（只追加，永不归档）

1. 重构 AGENTS.md：从 magicbook 复制模板结构（核心工作流/任务分类/文档规范/对话记录纪律），将原有轻量版内容整理为「系统说明（AI 必读）」章节，补齐家族根规则、上游项目与 API 权威源的正确引用，并标注 AI 必读。
2. 依据 R119 专项评估完成 magiclens 的 LLD（docs/feat/chrome-extension/）：伴读聊天移植为主（SSE 消费/抽屉 UI/页面上下文提取/会话记忆学情面板），含 moon-well 侧 system prompt 场景分支与 skipMemoryExtract 字段设计，并同步调整分期（P0=登录+划词翻译+伴读聊天简版）。
3. 实施 LLD M2+M3：伴读聊天抽屉（chat.js + page-extract.js + 划词气泡「问 AI」联动 + background 面板端点中转），manifest 0.2.0。
4. v0.3.0 配置与登录改版：设置页去掉手动地址/Token 配置，改为跳转 magicbook 同款 Authentik 登录页、登录成功自动捕获令牌（401 静默刷新）；后端默认走公网域名 moon-well.haoshenqi.top（含 Traefik 公网路由上线）；移除「本会话不记忆」勾选与设置项，记忆始终开启。

5. 设置页增加「注册」按钮（Authentik 邀请制注册，与 magicbook 同一 invitation-enrollment 流程）与「与 magicbook 的关系」说明块；v0.3.1。

6. 划词翻译增加「单词详解」功能：缓存到 ES vocabulary 索引；先读取 vocabulary 索引反推提示词结构，再整理扩展定义的提示词（含俚语、同义词、反义词、习语、词源/起源、冷知识），帮助全面理解单词；每个小单元不要太长。本条仅先整理提示词。

7. 单词详解提示词重新设计：①词源更重要，重要板块放前面；②详情要包含词的基本意思；③板块顺序改为：基本意思 → 词源 → 固定搭配/常见用法/习语 → 各种变体与衍生词（过去式、过去分词、名词/动词/副词形态等，不规则变化必须给出）→ 同义词/反义词 → 俚语和冷知识；④特别注意查询可能通过变体发起（需还原词目）；⑤缓存改用新索引 magicbook-vocabulary（旧 vocabulary 索引后续废弃）。重新给出提示词与单词示例。

8. 开始开发单词详解功能（按 R7 v2 提示词与方案落地）：moon-well 后端详解接口 + ES 缓存 + magiclens 划词详解面板。
