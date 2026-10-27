# HLD — R28 派生词族判定缺口（document↔documentation）

> 状态：设计（草案 v1，2026-10-18，待用户第二轮讨论）
> 关联：Ship [MAGICLENS-29 / idea nvvFdct0](https://haoshenqi.pingcode.com/ship/ideas/nvvFdct0)（缺陷，关联需求 MAGICLENS-15/R14）· PJM 工作项 MAGICLENS-2 · 历史：R16 installed 案例（屈折已覆盖）、R116 方案 A（大小写归一）已上线。

## 1. 问题与根因

用户在网页标记「Documentation」为认识，刷新后仍被划线——系统不认为 document 词族已认识。

根因（两侧同构）：词形还原只覆盖**屈折**（九个后缀族：ies/ves/es/s/ied/ed/ing/er/est），**派生**后缀（-ation/-ment/-ion…）不在规则内，`document ↔ documentation` 互不认为是同族。涉及两处互为镜像的实现：

- 扩展端 `extension/highlight.js` `lemmaCandidates()`（L47-68 规则区；`matchWord()` 三层命中与标记回写 L787-794 自动继承规则扩展）。
- moon-well `WordInflection` / `WordFamilyJudge`（判定权威侧，入口守卫同样只认小写屈折）。

家族口径（vocab-family-judgment 纪律）：**判定按词族、翻译按 token；改规则两侧必须同步。**

## 2. 目标与范围

- 标记 document 认识后，documentation 不再划线；反向（标记 documentation 认识 → document 不划线）同理。
- 屈折 × 派生组合链（documentations → document）随双向候选结构自动生效，不单独处理。
- **翻译仍按 token**（划词翻译翻译的是原词形），本条不改翻译。

## 3. 方案选型

**推荐方案 A：保守白名单派生后缀族，双侧同步纯规则**

首批只收误伤可控的高频后缀，每条规则 = 剥后缀 + 最小词干长度守卫：

| 后缀 | 还原动作 | 词干守卫 | 样例（覆盖/拒绝） |
| --- | --- | --- | --- |
| `-ation` | 剥去（词干尾接 e 者不补，词表按裸词干比对） | 剩余 ≥4 字符 | documentation→document ✓；information→inform ✓；station→st（2 字符）拒 ✓；vacation→vac（3 字符）拒 ✓ |
| `-ment` | 剥去 | 剩余 ≥4 字符 | government→govern ✓；judgment→judg（4 字符，≠judge，首版接受不覆盖）✓部分 |

派生规则与屈折规则**分层存放**（新表 `DERIVATION_RULES`），语义上互不混叠（屈折 `er` 是比较级、派生 `er` 是施动者——首版**不收** -er/-or/-ee 等高误伤后缀）。

否决方案：

| 否决 | 理由 |
| --- | --- |
| B：moon-well 词表驱动派生闭包（判 X 的派生 Y 是否真词再入族） | 精确但扩展端无词表可镜像，两侧从「规则镜像」变「数据镜像」，同步成本与体积失控；可作为二期增强 |
| C：全量后缀学规则（-ion/-ity/-ness/-ance/-ive/-ous…） | 误伤率高（nation/section/pinion…），每收一个后缀都要拿词频表验误伤，首版不值 |
| 只改单侧 | 直接违背镜像纪律，两侧判定漂移就是本缺陷的复制品 |

## 4. 仓间分工

- **moon-well**（判定权威侧）：`WordInflection` 增派生规则（与扩展端同表同守卫）→ `WordFamilyJudge` 词族判定自动生效 → 补单测（document/documentation/组合词形/误伤样例 station/vacation）。**moon-well 主检出当前有并行会话在途，开发必须走 worktree 从 `origin/develop` 切。**
- **magiclens**（本仓）：`highlight.js` `lemmaCandidates` 增同表派生分支；`matchWord` 与标记回写零改动（结构自动继承）；版本两段式递增测试版。

## 5. 契约与守卫

- 无 API 变化（known/unknown 端点不动）。
- 守卫（家族纪律：契约形制要有可执行守卫）：moon-well 侧单测断言「派生规则表与扩展端 `DERIVATION_RULES` 字面量一致」（moon-well 测试里内嵌扩展端规则表的期望副本——改任一侧不同步即红，先例：isVariant 双注解钉键、JS Porter 镜像口径）。

## 6. 风险与回滚

| 风险 | 缓解 |
| --- | --- |
| 假词族误伤（不该同族的划线熄灭） | 首版只收 2 后缀 + 词干长度守卫 + 误伤样例进单测；观察期后 再议扩后缀 |
| 判定语义扩大化（认识判定连带过宽） | 仅影响「划线/熄灭」判定，不动翻译与积分 |
| 回滚 | 规则表回退单 commit（两侧各自 revert），无数据迁移 |

## 7. 开放问题（第二轮讨论）

1. 首批后缀集 `{-ation, -ment}` 是否认可？是否要加 `-ion`（decide→decision 属 -sion 变体，建议二期）？
2. judgment→judge 这类需补 e 的不规则派生，首版接受不覆盖还是加 `+e` 修复规则？
3. 存量影响：已按 document 标记的用户，documentation 高亮即刻熄灭（读时折算，无存量清洗）——确认符合预期。
