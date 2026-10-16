# 单词详解 · 提示词设计（R6–R7）

> 状态：**v2 草案**（R7 按用户反馈重排板块、新增变体还原、缓存改新索引 `magicbook-vocabulary`），待确认后实施。
> 来源需求：magiclens `requests.md` R6（初稿）、R7（重设计）。划词翻译增加「单词详解」，扩展定义缓存到 ES 新索引 `magicbook-vocabulary`。

## 1. 从旧 vocabulary 索引反推出的现有提示词结构（R6 调研结论，背景）

ES 旧 `vocabulary` 索引（fnOS `base_es`，165,743 条，`processed_by=logstash` 批量导入）每条文档为一个 LLM 生成的 markdown 单词卡，字段 `word / content / fullContent / level / tag(s)`。抽样（justice、create 等）反推出导入时的提示词模板为 **8 个固定小节**：分析词义、列举例句、词根分析、词缀分析、发展历史和文化背景、单词变形、记忆辅助、小故事。

对反推过程的两点观察：

1. **`fullContent` 字段几乎未使用**（全索引仅 21 条非空）。
2. 导入内容小节标题风格不统一（`### 词义` 与 `**词义**` 混用），说明原提示词未锁定输出格式——**新提示词必须显式固定输出格式**。

现有索引没有覆盖：俚语、同义词、反义词、习语、冷知识；「起源」只有部分重叠。详解是增量内容。

> **R7 决策**：旧 `vocabulary` 索引后续废弃，详解缓存用新索引 **`magicbook-vocabulary`**；现有 vocabulary-search 单词卡流程暂不受影响，旧索引下线另立任务。

## 2. 现状约束与关键决策

- moon-well 现有查词链路 `VocabularyService`：`llmFacade.simpleCallSyncAsCaller(null, word, "vocabulary-search")` —— prompt 只有裸单词，无系统提示词，ES 缓存 markdown。
- magiclens 划词弹窗目前用 `textContent` 渲染，**没有 markdown 渲染器** → **详解输出用结构化 JSON**，每个板块一个数组/字段，插件按单元渲染小卡片（满足「每个小单元不要太长」），ES 缓存可按字段增量更新与展示。
- moon-well prompt 体系（`PromptDefinitions` + Nacos Registry）：`{{var}}` 语法，模板 = 角色 + 任务 + 约束 + 输出格式，中文，末尾「只返回…不要解释」。

**R7 新增决策——变体还原**：划词选中的经常不是词目原形（如 `ran`、`running`、`went`、`cities`）。设计约定：

- LLM 负责还原词目（lemma），**全部讲解针对词目展开**；
- 返回 `lemma / isVariant / variantNote`，UI 在顶部标注「ran 是 run 的过去式」；
- **ES 缓存的 doc id = SHA-256(词目 lemma)**，任何变体的查询都落到词目文档，避免同词目多份缓存。

## 3. 板块顺序（v2，重要板块在前）

| # | 板块 | JSON 字段 | 内容与上限 |
| --- | --- | --- | --- |
| 0 | 词目信息（元数据，非展示板块） | `word / lemma / isVariant / variantNote` | 变体关系一句话 |
| 1 | **基本意思** | `meaning` | 最核心 2~4 个义项：词性 + 一句话释义 +（可选）迷你例句 |
| 2 | **词源** | `etymology` | 2~3 句：语种来源、本义、演变路径 |
| 3 | **固定搭配 / 常见用法 / 习语** | `phrases`（`kind` 区分三类） | 合计最多 6 条：搭配 2~4、用法 1~2、习语 0~2，每条附中文含义 |
| 4 | **变体与衍生词** | `forms` | 过去式、过去分词、三单、复数、名词/形容词/副词形态及主要派生词；**不规则变化必须逐条给出**并加 `irregular: true` |
| 5 | 同义词 / 反义词 | `synonyms / antonyms` | 各 3~5 / 2~4 个，每个一句话辨析 |
| 6 | 俚语 / 冷知识 | `slang / funFacts` | 俚语最多 3 条；冷知识最多 2 条；没有给空数组 |

## 4. 提示词 v2（整理稿）

命名与落位：moon-well `PromptDefinitions` 新增 key `VOCABULARY_WORD_DETAIL`（模板 key `vocabulary-word-detail`），变量 `word`（必填）、`context`（划词上下文，可空串）。

```text
你是面向中国学习者的英语词汇讲解员。用户划词选中了「{{word}}」，它可能是词目原形，也可能是某个变体（过去式、过去分词、复数、派生词等）——先还原词目，所有讲解都针对词目展开。
用户划词时所在的上下文（仅用于确定词义侧重，可能为空）：{{context}}

先返回词目信息（lemma / isVariant / variantNote），再按以下顺序给出六个板块，每个板块都要简短：
- meaning：词目最核心的 2~4 个义项，每条 = 词性 + 一句话中文释义 +（可选）迷你例句；
- etymology：2~3 句话讲清语种来源、本义和演变路径，这是重点板块；
- phrases：固定搭配、常见用法、习语合计最多 6 条，每条用 kind 标注（搭配/用法/习语）并附中文含义；
- forms：常见变体与衍生词——过去式、过去分词、三单、复数、名词/形容词/副词形态及主要派生词；不规则变化必须逐条给出，并用 irregular 标注；
- synonyms / antonyms：同义词 3~5 个、反义词 2~4 个，每个用一句话说明与词目的差别或相反语境；
- slang / funFacts：俚语或非正式含义最多 3 条，冷知识最多 2 条，没有就给空数组。

只返回一个 JSON 对象，不要 markdown 代码块，不要解释：
{"word":"{{word}}","lemma":"词目原形","isVariant":false,"variantNote":"","meaning":[{"pos":"词性","sense":"中文释义","example":"英文例句（中文翻译）"}],"etymology":"中文词源讲解","phrases":[{"kind":"搭配|用法|习语","phrase":"英文短语","meaning":"中文含义","example":"英文例句（中文翻译）"}],"forms":[{"form":"变体形式","type":"过去式|过去分词|三单|复数|名词|形容词|副词|派生词","irregular":false}],"synonyms":[{"word":"英文词","note":"中文辨析"}],"antonyms":[{"word":"英文词","note":"中文说明"}],"slang":[{"meaning":"中文含义","example":"英文例句（中文翻译）"}],"funFacts":["中文趣闻"]}

讲解用中文，英文单词、例句、习语保留原文。内容必须真实，不确定的宁缺毋滥，对应字段返回空数组或空串。
```

## 5. 输出示例（传入 `ran`，验证变体还原与不规则形态）

```json
{
  "word": "ran",
  "lemma": "run",
  "isVariant": true,
  "variantNote": "ran 是 run 的过去式",
  "meaning": [
    {"pos": "动词", "sense": "跑，奔跑", "example": "He ran to catch the bus.（他跑去赶公交。）"},
    {"pos": "动词", "sense": "经营，管理；（机器）运转", "example": "She runs a small bookshop.（她经营一家小书店。）"},
    {"pos": "名词", "sense": "跑步；连续的一段（演出、行情等）", "example": "I go for a run every morning.（我每天早上去跑步。）"}
  ],
  "etymology": "源自古英语 rinnan / iernan（流动、奔跑），与古诺尔斯语 rinna 同源；『水流』义保留在 river run 等表达里，『经营、运转』义由『使流动』引申而来。",
  "phrases": [
    {"kind": "搭配", "phrase": "run out of", "meaning": "用完，耗尽", "example": "We ran out of time.（我们时间不够了。）"},
    {"kind": "搭配", "phrase": "run into", "meaning": "偶然遇见；遭遇（困难）", "example": "I ran into an old friend.（我偶遇一位老友。）"},
    {"kind": "用法", "phrase": "run + 时长/场次", "meaning": "表示持续上演、维持（The play ran for six months.）", "example": ""},
    {"kind": "习语", "phrase": "in the long run", "meaning": "从长远来看", "example": ""},
    {"kind": "习语", "phrase": "run in the family", "meaning": "（特质）世代相传", "example": ""}
  ],
  "forms": [
    {"form": "runs", "type": "三单", "irregular": false},
    {"form": "ran", "type": "过去式", "irregular": true},
    {"form": "run", "type": "过去分词", "irregular": true},
    {"form": "running", "type": "现在分词/动名词", "irregular": false},
    {"form": "runner", "type": "派生词（名词，跑步的人）", "irregular": false},
    {"form": "runny", "type": "派生词（形容词，稀的）", "irregular": false}
  ],
  "synonyms": [
    {"word": "jog", "note": "慢跑，强调锻炼节奏"},
    {"word": "sprint", "note": "短距离冲刺"},
    {"word": "dash", "note": "猛冲，比 run 更急促"},
    {"word": "operate", "note": "表『经营/运转』义时的近义"}
  ],
  "antonyms": [
    {"word": "walk", "note": "步行，与『跑』义相对"},
    {"word": "stop", "note": "表『机器运转』义时相反"}
  ],
  "slang": [
    {"meaning": "a run on sth：抢购风潮、挤兑（金融口语）", "example": "a run on the banks（银行挤兑）"}
  ],
  "funFacts": [
    "run 是英语释义最多的词之一：2011 年《牛津英语词典》修订为动词 run 收了 645 个义项，取代 set 登顶。"
  ]
}
```

## 6. 后续实现落位（本次不做，确认提示词后再动工）

1. **moon-well**：
   - `PromptDefinitions` 增 `vocabulary-word-detail` 模板并入 MANAGED 清单（Nacos bootstrap 自动注册，线上可热改）；
   - 新索引 `magicbook-vocabulary`（`EsIndexEnum` 增枚举 + 索引模板脚本进 `deploy/`）：`word`/`lemma` 用 `keyword` 类型便于 term 查询（旧索引 `text` 类型靠分词兜底是历史教训），`detail` 结构化 JSON 存储；**doc id = SHA-256(lemma)**，变体查询经 LLM 还原词目后同文档覆盖写；
   - `VocabularyService` 新增详解接口（如 `GET /vocabulary/detail/{word}`）：先按词目查缓存 → miss 才调 LLM → 解析 JSON 校验后写缓存；计费 caller `vocabulary-word-detail`；
   - 旧 `vocabulary` 索引后续废弃：现有单词卡流程暂不动，下线与数据迁移另立任务。
2. **magiclens**：划词气泡加「详解」入口 → background 中转 → 弹窗按 §3 板块顺序渲染（变体标注置顶，每板块一小块卡片），全部经 background SW 请求、Shadow DOM 展示，遵守 §0.2 硬性约定。
3. **验收**：手工清单（详见 AGENTS.md §验收），重点覆盖：变体词查询（ran/running）、规则词查询、生僻词空板块渲染。
