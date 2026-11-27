# LLD — R76 段末工具：朗读 + 翻译两个按钮

> 状态：已发布 v0.8.38（2026-11-27）
> 关联需求：magiclens R76；设计决策见 `docs/product/design.md` §25；L3 见
> `docs/product/features/page-read-aloud.md`。

## 1. 范围与非目标

**范围**：R75 的段末共享浮钮由单个 ▶ 扩为一组两个 24px 圆钮（`▶ 朗读` / `译`）；
「译」复用 `page-translate.js` 的 R71 单段翻译状态机（翻译 / 撤销 / 页内缓存 / 计费护栏）；
不合格段落（<40 字符的短标题等）按同一资格闸不渲染「译」。

**非目标**：其它段落动作（标注/问 AI/复制）、每段插 DOM、第二套翻译实现、
整页翻译入口改造（`Alt+A` 与右键菜单不动）。

## 2. 数据流

```
mousemove → page-speak.js 定位段末行尾（Range.getClientRects 最后一个 rect）
  ├─ click .mlr-speak → startReader([item]) → ML_TTS_SPEAK → /tts/speak（R75 链路不变）
  └─ click .mlr-trans → window.__magicLensParagraphTranslate(el)
        → page-translate.js translateParagraphEl(el)   ← Alt+P / Shift 悬停同一函数
        → enqueue → translate-batch（单段）→ 内联 [data-magiclens-translation]
```

## 3. 关键决策

- **D1 同一浮钮组、两个动作**：`.mlr-hover` 由 button 改 div 容器，内含
  `.mlr-speak` / `.mlr-trans`；定位仍用段末最后一行矩形，组宽 52px，右侧放不下时
  落到行下右对齐。不为每段插 DOM 的约束不变。
- **D2 翻译状态机单源**：`page-translate.js` 抽出 `translateParagraphEl(el)`，Alt+P、
  按住 Shift 悬停、段末「译」三个入口共用；只暴露
  `__magicLensParagraphTranslate(el)`（翻译/撤销）与
  `__magicLensParagraphTranslateState(el)`（读态）两个函数，`records`/队列/缓存仍封闭。
- **D3 资格闸不复制**：状态接口对未入 records 的段落现场 `qualifies()`，不合格返回
  `n/a` → 段末不渲染「译」。为什么不复制 page-speak 的 `MIN_CHARS=40` 判定：
  page-speak 对标题放宽到 8 字符，而翻译侧不允许短标题，复制会漂移。
- **D4 状态反馈**：`译` 在 `pending/loading` 显示 ⟳ 并每 200ms 跟随该段状态直到落定；
  `done` 加 `is-done`（半透明，语义=再点撤销）。`▶` 的 ■/⟳ 保持 R75 语义。
- **D5 计费口径不变**：单段翻译走 `start(false)`（不做整页发现）→ 1 段
  `translate-batch`；同段撤销零请求；`sessionCache` 命中复活零请求。

## 4. 落位

| 文件 | 改动 |
| --- | --- |
| `extension/page-speak.js` | 段末按钮组（▶/译）、译按钮态跟随、点击转发 |
| `extension/page-translate.js` | 抽出 `translateParagraphEl`；暴露两个跨模块函数 |
| `scripts/check-extension-modules.js` | R76 契约段（只两个按钮 / 状态机单源） |
| `docs/*` | README、design §25、L3、AC 同步 |
| `ops/tools/integration-suite/browser/run.js` | `ml-read-aloud` 增「译」链路断言 |

## 5. 失败与边界

| 场景 | 行为 |
| --- | --- |
| 页面上没有 `page-translate.js`（理论不可达） | 「译」不渲染（状态恒 `n/a`） |
| 段落不合格（短标题/中文/代码块） | 只有 ▶，不出现「译」 |
| 划词总开关关闭 / 域名禁用 | 点击「译」由 page-translate 出可见文案（沿用 R71 反馈） |
| 请求失败 | 块内显示错误态（page-translate 既有行为），「译」恢复可点 |
| 已译段落再点 | 摘块、`dismissed`、零请求；再点复活走页内缓存 |
