# 单词详解 · LLD（R6–R7/R100，v0.4.0）

> 提示词设计与反推结论见同目录 [prompts.md](./prompts.md)（板块结构、JSON schema、示例的权威源）。
> 后端实现对应 moon-well `requests.md` R100。

## US1 · moon-well 详解接口（后端，已实现）

**端点**：`GET /vocabulary/detail/{word}`（`VocabularyController`，经 JWT 鉴权，Result 包装）→ `Result<WordDetailVO>`。

**链路**（`WordDetailService`）：
1. 归一：trim + 小写；空词抛 `GlobalException`。
2. 缓存查询（新索引 `magicbook-vocabulary`）：`word` / `lemma` / `forms.form` 三路 term 匹配 + Porter 词干兜底（`WordStemmer`），任一命中即返回。**Why forms.form 也参与匹配**：划词常是变体（ran/running），LLM 生成的 forms 列出变体后，任何变体查询都能直接命中词目文档，不花 LLM 钱。
3. miss → `PromptRenderer` 渲染 `vocabulary-word-detail` 模板（变量 word/context，context 当前传空串，P1 可带划词上下文）→ `llmFacade.simpleCallSyncAsCaller(null, prompt, "vocabulary-word-detail")`（sync-model 档，与 vocabulary-search 同口径）。
4. 解析：剥 markdown 围栏与前后杂文 → fastjson2 反序列化 `WordDetailVO`；`word` 强制回写划词原词，`lemma` 缺失降级为划词原词；解析失败抛 `GlobalException("单词详解生成失败")`（不做占位降级）。
5. 写回：doc id = **SHA-256(lemma 小写)**，覆盖写；写失败仅记 error 不阻断返回。索引缺失时 synchronized ensure 建显式 mapping（word/lemma/forms.form=keyword，etymology/variantNote=text）。

**配套变更**：`EsIndexEnum.MAGICBOOK_VOCABULARY("magicbook-vocabulary")`、`PromptDefinitions.VOCABULARY_WORD_DETAIL`（入 MANAGED 清单，Nacos bootstrap 自动注册、线上可热改）、`CreditCallerCatalog` 登记「单词详解」。旧 `vocabulary` 索引后续废弃（下线另立任务）。

**测试**：`WordDetailServiceTest` 14 例（缓存命中不调 LLM / miss 生成并按 SHA-256(lemma) 写回 / LLM 输出含围栏与杂文可解析 / 垃圾输出抛错且不写缓存 / 缓存写失败不阻断返回 / 查询子句含三路匹配+词干精确值 / 词目降级与小写归一 / **Jackson 序列化 isVariant 键回归** / 超长词拒绝 / 模板入 MANAGED 且可渲染）。

**交叉审查修复记录（2026-10-05）**：
- **P0**：HTTP 响应走 Spring 默认 Jackson（非 fastjson2），`isVariant` 会漂移成 `variant` 键、插件变体角标静默失效 → VO 字段双注解（`@JSONField` + `@JsonProperty`），并补 Jackson 序列化回归测试。
- **P1**：`saveToEs` 从仅捕 `IOException` 改宽捕 `Exception`（ES 级 `ElasticsearchStatusException` 是 RuntimeException，穿透会 500 且积分已扣）；同词并发首查加 per-key 锁 + 双检（防缓存击穿重复计费，锁对象常驻不移除）；词干兜底断言从恒真子串改为精确 term 值断言。
- **P2**：lemma/forms 入库前小写归一（keyword term 大小写敏感）；word 参数加 ≤64 上限；插件详解请求加序号 token（防旧词慢响应覆盖新词面板）；选区锚点在扩展 UI 内时跳过划词处理（面板内复制例句不再误关面板）；删除未用的 `toJsonStr()`；README「后端零改动」过时表述与架构图公网域名口径已修正。
- 遗留（不改）：多实例部署需把 per-key 锁升级 Redis `SETNX`；`ensureIndexIfAbsent` 每查询 1-2 次 exists 探测（内网延迟可忽略）；详解接口无用户维度统计。

## US2 · magiclens 划词详解面板（v0.4.0，已实现）

**入口**：划词气泡新增「详」按钮（与「译」并列）。仅英文单词可用（与生词标记同口径，`current.word` 为空时气泡报错）。

**background**（`ml:detail`）：中转 `GET /vocabulary/detail/{word}`，走既有 `callApi`（401 静默刷新 + Result 解析），无新增鉴权逻辑。

**content.js**：详解面板与划词气泡同一 closed Shadow DOM（不新增全局节点）。
- 渲染顺序即板块顺序：基本意思 → 词源 → 搭配·用法·习语 → 变体与衍生词 → 同义词/反义词 → 俚语/冷知识；空板块整段隐藏，全空显示「暂无详解内容」。
- 变体呈现：标题显示词目（lemma），右上「变体」角标 + 橙色 variantNote 一行（「ran 是 run 的过去式」）。
- forms 板块渲染为 chips，`irregular: true` 金色高亮（不规则变化一眼可见）。
- **安全**：LLM 返回内容全部经 `textContent` 组装 DOM，不进 innerHTML（静态骨架模板除外）。
- 交互细节：新选区自动收起旧面板；Esc/点击面板外关闭；面板内滚动不触发 scroll 关闭（scroll capture 判定 `composedPath().includes(host)`）；面板内容撑开后重新定位（气泡下方优先，放不下翻上方）。

**遵守硬性约定**：请求全部经 background SW 中转；UI 挂 closed Shadow DOM；token 只在 chrome.storage.sync；manifest 0.3.1 → 0.4.0。

## 验收清单（手工，待真机）

1. 加载扩展（chrome://extensions 重载，版本 0.4.0，控制台无新增报错）。
2. 划选规则词（如 justice）→「详」→ 六板块齐全、词源在第二位。
3. 划选变体（如 ran / running）→ 标题显示 run、有「变体」角标与说明；再次查询 ran 不再等待生成（缓存命中，秒回）。
4. 划选不规则动词原形（如 go）→ forms 中 went/gone 带不规则高亮。
5. 生僻词/无俚语词 → 对应板块隐藏，不出现空白段。
6. 未登录/401 → 面板内「重新登录」链接可用。
7. 回归：划词翻译、认识/生词标记、朗读、AI 抽屉不受影响。

## 遗留与后续

- `context` 变量已留孔：P1 段落翻译接入后可把划词所在句传入，提升义项选择的贴合度。
- moon-well 详解接口未做用户维度统计（生词本联动），待词汇表打通时一并考虑。
