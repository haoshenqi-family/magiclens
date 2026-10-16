# response-archive — R28

> 2026-10-11（R39 写入触发窗口轮转）从 `response.md` 原样搬移。只搬原文，不总结、不改写、不改编号。

### R28（排查：Documentation 标记认识后刷新仍划线——只排查未修码）

- **回应**：标记本身已落库生效，问题出在**写读词形大小写不对称**：标记按页面原始词形存（`Documentation` 大写 D），扫描判定全按小写 token 比对，服务端把这条认识标记「看不见」，落到词档兜底后仍判生词。
- **证据链**：
  ①写链路：扩展划选/悬浮取**页面原文词形**（content.js:296 / highlight.js:659 传 `tok.raw`），background.js:330-337 原样拼 `GET /vocabulary/known/Documentation`，`VocabularyService.kill`（moon-well）**原样落库**——`vocabulary_notebook` user 1 存在 `word='Documentation'`（大写 D）familiarity=7 行（id 8826），今天 11:47 首标、22:48 重标均写的是它；
  ②读链路：analyze 服务端 `extractWords` 对整页重新分词并 `toLowerCase`（ReadingVocabularyService.java:289），token 全小写；`WordFamilyJudge.judgeOne:85` `notesByWord.get("documentation")` 大小写敏感 **miss 自身标记**；词族索引 `lemmaCandidates("Documentation")` 因 `^[a-z]+$` 守卫（WordInflection.java:31，扩展端 highlight.js:49 同款）对大写词退化为自身，与 token 候选 `{"documentation"}` **永不相交 → 词族桥接也 miss**；
  ③兜底：`magicbook_word_level` 中 `documentation`=TOEFL（level 6）> 用户 hard_level → 判 UNKNOWN 返回；
  ④ES 日志铁证：22:48:09 `GET /vocabulary/known/Documentation` 200 落库后，22:49:04 `/vocabulary/reading/analyze` 仍返回 `{"word":"documentation","unknown":true}`（当日 11:12/11:53/20:15/22:47 各次扫描全为 unknown:true）；
  ⑤无缓存层干扰（WordLevelCacheService 只缓存全局词档；扩展端 unknownSet 刷新即重建）；magicbook 端写链路自带小写归一（epub.js:445）故从未复现——扩展端独有此缺口。
- **根因**：R107 词族判定只对齐了「判定口径的词族化」，未对齐「写入口径的大小写」；扩展端标记请求与落库均不归一大小写，扫描侧全小写，两侧永不匹配。
- **次要缺口（同构隐患，本例非触发者）**：词族展开仅屈折（s/es/ed/ing/er/est），派生词形不在口径内——`document` 与 `documentation` 互不覆盖；即使修好大小写，标 `document` 也不会覆盖 `documentation`（属 R16 已文档化口径的边界，变更需 moon-well `WordInflection` 与扩展端 `lemmaCandidates` 双侧同步）。
- **修复方向（待用户确认后实施）**：A. 最小闭环——moon-well `VocabularyService.kill/unknown` 入口（或扩展端 background.js ml:mark 发出前）统一小写归一 + 存量脏数据清洗（`UPDATE vocabulary_notebook SET word=LOWER(word)`，含本例 id 8826）；B. 派生词形入词族口径（口径变更，双侧同步+单测）。
- **总结**：requests.md 占号 R28；response.md 本条，R16 原样搬入 response-archive/response-R16.md、R17/R18 搬入 response-R17-R18.md（窗口保持 10 条）；本次只排查，未改任何代码与数据。
- **实施回填（用户裁决「只修A」，2026-10-08）**：方案 A 已落地——①moon-well R116（commit e30e13b）：`VocabularyService` 新增 `normalizeMarkWord`（与 familiar 同口径小写归一），kill/unknown 入口调用，补 2 单测、全量 800 测试绿，push develop 走 fnOS 链部署；②存量清洗：fnOS `magichouse.vocabulary_notebook` 全表 435 行大小写混排 `UPDATE word=LOWER(word)` 归零（不止本例，含 code/mode/cache 等近期扩展标记与早期人名地名；flare/militant 历史重复行未动，判定端 toMap 已合并），清洗后现行判定即能匹配小写行，**无需等新版本上线 Documentation 已不再划线**。扩展端零改动、版本不变（延续 R16 先例）。方案 B（派生词族）未做。部署插曲：fnOS 凌晨 03:01 DHCP 续租丢失默认路由致 webhook git-fetch 失败（ai-fix 亦因智谱账户欠费未接起），已临时补路由并手动重跑构建；持久化修复（fnOS 静态网关/路由器 DHCP + ai-fix 充值）待用户处理。

