# LLD — R28 派生词族判定（双侧同步）

> 状态：设计（草案 v1，2026-10-18；开工改「开发中」，上线回填）
> 上层设计：[hld.md](./hld.md)。

## 1. magiclens 侧（`extension/highlight.js`）

现状锚点：

- `lemmaCandidates(word)`（L46-91）：九个屈折后缀族 + `/^[a-z]+$/` 入口守卫；输出候选集合。
- `matchWord(bare)`（L81-91）：原样 → 去 `'s` → 候选双向（`lemmaCandidates(bare)` 正向 ∪ `lemmaSet` 反向）。
- 标记回写（L787-794）：`lemmaCandidates(w).has(bare) || lemmaCandidates(bare).has(w)` 判同族熄灭。

改动：

```js
// 派生词族（R28）：与 moon-well WordInflection.DERIVATION_RULES 互为镜像，改规则两侧同步。
// 只收低误伤高频后缀；词干长度守卫拒绝 station→st、vacation→vac 这类假还原。
var DERIVATION_RULES = [
  { suffix: 'ation', minStem: 4 },   // documentation→document, information→inform
  { suffix: 'ment',  minStem: 4 },   // government→govern（judgment→judg 首版不覆盖）
];
function derivedCandidates(w) { /* 剥后缀 → 词干 ≥ minStem 才产出，规则表驱动 */ }
```

- `lemmaCandidates` 内在屈折候选之后追加派生候选（派生结果可再进屈折链，如 documentations→documentation→document——现有递归/并集结构按现状确认，不新造机制）。
- `matchWord` / 标记回写**零改动**；入口守卫维持小写（大写已在读侧 `normWord` 归一）。
- 版本：`version` +0.0.1、`version_name` 带时间戳（测试版，不触发发布）。

## 2. moon-well 侧（走 worktree，分支 `fix/r<n>-derived-family` 从 `origin/develop` 切）

- `WordInflection`：新增与扩展端同表的派生分支（后缀/最小词干两个维度完全一致）；javadoc 注明与 magiclens `DERIVATION_RULES` 镜像关系。
- `WordFamilyJudge`：词族判定消费 WordInflection 候选，无独立改动（确认无第二处硬编码屈折表）。
- 单测（新增 `WordInflectionDerivationTest` 等）：
  1. 覆盖样例：document↔documentation、install→installation、govern→government（正反向）。
  2. 组合链：documentations → document。
  3. 误伤拒绝：station、vacation、nation 不产出 1–3 字符词干候选。
  4. **镜像守卫**：测试内嵌扩展端 `DERIVATION_RULES` 字面量期望（后缀+minStem 逐项相等），两侧漂移即红。

## 3. 发布顺序

moon-well 先行或同批（判定权威侧先生效，扩展端后到只影响网页端划线时点；无兼容窗口风险——旧扩展 + 新后端 = 行为不变，新扩展 + 旧后端 = 网页端先行熄灭、词库判定滞后，均在可接受区间）。

## 4. 验收手测（本仓无自动化测试）

1. 划词 document → 标记认识 → 刷新 → documentation 与 document 均不划线。
2. 反向：标记 documentation 认识 → document 不划线。
3. station/vacation 照常划线（未被误归入 st/vac 族）。
4. 翻译 documentation 仍翻译该词本身（按 token 口径不变）。
5. moon-well 单测全绿（含镜像守卫）。

## 5. 文档四问预答

- L1（README）：高亮判定口径补一句「派生词形（如 documentation↔document）按同族判定」。
- L2（design.md ADR）：§判定口径增派生规则表与镜像纪律引注。
- L3：features/ 如有判定相关页则同步；无则 L2 覆盖。
- LLD：本文件状态行。
