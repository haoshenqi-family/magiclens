# requests.md — 对话需求记录（只追加，永不归档）

1. 重构 AGENTS.md：从 magicbook 复制模板结构（核心工作流/任务分类/文档规范/对话记录纪律），将原有轻量版内容整理为「系统说明（AI 必读）」章节，补齐家族根规则、上游项目与 API 权威源的正确引用，并标注 AI 必读。
2. 依据 R119 专项评估完成 magiclens 的 LLD（docs/feat/chrome-extension/）：伴读聊天移植为主（SSE 消费/抽屉 UI/页面上下文提取/会话记忆学情面板），含 moon-well 侧 system prompt 场景分支与 skipMemoryExtract 字段设计，并同步调整分期（P0=登录+划词翻译+伴读聊天简版）。
3. 实施 LLD M2+M3：伴读聊天抽屉（chat.js + page-extract.js + 划词气泡「问 AI」联动 + background 面板端点中转），manifest 0.2.0。
4. v0.3.0 配置与登录改版：设置页去掉手动地址/Token 配置，改为跳转 magicbook 同款 Authentik 登录页、登录成功自动捕获令牌（401 静默刷新）；后端默认走公网域名 moon-well.haoshenqi.top（含 Traefik 公网路由上线）；移除「本会话不记忆」勾选与设置项，记忆始终开启。

5. 设置页增加「注册」按钮（Authentik 邀请制注册，与 magicbook 同一 invitation-enrollment 流程）与「与 magicbook 的关系」说明块；v0.3.1。

6. 划词翻译增加「单词详解」功能：缓存到 ES vocabulary 索引；先读取 vocabulary 索引反推提示词结构，再整理扩展定义的提示词（含俚语、同义词、反义词、习语、词源/起源、冷知识），帮助全面理解单词；每个小单元不要太长。本条仅先整理提示词。

7. 单词详解提示词重新设计：①词源更重要，重要板块放前面；②详情要包含词的基本意思；③板块顺序改为：基本意思 → 词源 → 固定搭配/常见用法/习语 → 各种变体与衍生词（过去式、过去分词、名词/动词/副词形态等，不规则变化必须给出）→ 同义词/反义词 → 俚语和冷知识；④特别注意查询可能通过变体发起（需还原词目）；⑤缓存改用新索引 magicbook-vocabulary（旧 vocabulary 索引后续废弃）。重新给出提示词与单词示例。

8. 开始开发单词详解功能（按 R7 v2 提示词与方案落地）：moon-well 后端详解接口 + ES 缓存 + magiclens 划词详解面板。

9. 在 magicbook 页面上划词是否会同时触发 magicbook 自带划词与 MagicLens 扩展、造成冲突？（纯问答，不改代码）

10. magiclens 每次修改完成后增加版本号，按照0.0.0-Timesnap 增加。

11. magiclens 我已经改为了public 版本升级后自动在 GitHub 发一个releases  X.Y.Z 的版本功能验证通过后发，-YYYYMMDDHHmm 是为了测试，不触发发布

12. github 没有release

13. magiclens 划词翻译单词 `exact` 时卡死，排查原因。

14. 借鉴「明畅·个人词库」扩展的生词智能高亮机制（已完成逆向分析：CSS Custom Highlight API 渲染 / 分级词库+个人词库判定矩阵 / 视口懒渲染 / MutationObserver 增量 / 变形归并），在 magiclens 落地 P1 生词智能高亮：页面英文生词自动标注 + 点词交互，数据源 moon-well 既有 API，后端零改动。

15. 划词翻译调用金山 api 的行为能否放在前端，由浏览器直接调用。这样可以节省时间（纯可行性评估，未确认实施）。
16. bug 反馈：生词高亮把 installed 标记为「认识」后，重新扫描该词又出现了（DevTools 截图：GET /vocabulary/known/installed 返回 200）。排查原因。
17. 设置页（options.html）对「详细信息设置、单词等级等」加说明：这些细项在 magicbook 中管理，提供跳转 magicbook 的链接说明。
18. 修改发布规则：开发通常在 develop 分支；当用户认为某个版本可以发布时，由 AI 把 develop merge 到 release 分支；GitHub Action 改为 release 分支变动则发布 Release。

9. 详解面板不因离开/误点关闭：请求未完成时保持面板并提示「AI 正常生成中」，完成后自动显示；仅 ✕/Esc 或新「详」查询关闭面板（与气泡生命周期解耦）。SSE 经评估暂缓（结构化 JSON 无法优雅增量渲染，详见 response）。

19. （更正：上方重复的「9. 详解面板不因离开/误点关闭」系本会话所补，与既有 R9 撞号，按纪律续编 R19）详解面板不因离开/误点关闭：请求未完成时保持面板并提示「AI 正常生成中」，完成后自动显示；仅 ✕/Esc 或新「详」查询关闭面板（与气泡生命周期解耦）。SSE 经评估暂缓（结构化 JSON 无法优雅增量渲染，详见 response）。
20. 有些单词不方便双击，如果已经识别为生词（生成了波浪线），悬浮即显示翻译——与「明畅·个人词库」（ecneibafmplgkfjomcbbgbajkleanoml）的悬浮词典卡一致。
21. 悬浮生词希望直接显示完整划词气泡（译/详/认识/生词/AI 那个弹框，「类似选中」的效果），而不是小翻译卡——因为部分 HTML 元素点击会跳转，悬浮应零副作用（不真实选中、不点击）。
22. 发布 release（按 R18 新流程：develop 清理时间戳 → merge 到 release 分支自动发布），并说明如何上架 Google Chrome 商店。
23. 暂时不上架 Google 商店，仅通过 GitHub Release 分发。

24. magicbook 阅读页生词高亮无效：`/read/102/epub`（新概念英语85第三册）第 1 课、第 4 课无高亮。排查 + 修复。

25. MagicLens 增加域名管理，可以选择在某些域名禁用此插件。

26. 你是一个资深的产品经理，从产品设计的角度评估近期的功能，哪些设计不合理，哪些设计冗余。提出优化建议，并写入文档。重新整理整个组多个项目的设计，检查L1-L3 3级文档。确保文档的正确性。你只修改文档不动代码。（跨项目文档任务：moon-well L1-L3 三级体系 + magiclens/magicbook/app-manager 文档 + 家族级产品评估文档）

27. 更新四个子项目的 AGENTS.md 文档规范：统一 L1-L3 三级体系口径与三级联动纪律（数值同源/L1 负面清单/状态行回填/历史文档标注），不合理之处写修改方案（家族 docs/agents-doc-spec-plan-2026-10-07.md）。只改文档与 AGENTS.md 行为约束，不动代码。

28. bug 排查：网页上的「Documentation」明明标记了认识，刷新页面后仍然被划线（系统仍认为不认识）。排查原因（疑似与 R16 installed 案例同构：派生词形的词族判定缺口）。

29. （本条原占 28，与并行会话 R28「Documentation 划词 bug」撞号，按编号纪律续编空号 29）执行 AGENTS.md 文档统一方案的待决策项 P1-A（magicbook L1/L2 骨架）、P1-B（拓扑表指针化）、P2-C（moon-well 事实层+伴读归属）、P2-D（归档规则修订+补账）、P2-E（hugo 降级）、P3-F（家族 Agents.md 锚点节）。只改文档。

30. 修改单测逻辑：开发功能只做部分单测，正式发布才做全量单测。跨四仓（moon-well / magicbook / app-manager / magiclens）统一「两级闸门」口径，只改 AGENTS.md 与 kb 文档，不动代码。

31. 发布一下 magiclens。
