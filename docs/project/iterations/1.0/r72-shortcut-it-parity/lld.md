# R72 LLD：翻译快捷键对齐沉浸式翻译补充——双击 Alt 别名 + Shift 悬停单段 + Mac 说明

状态：开发完成（2026-11-23，0.8.33-202611231637 测试版；守卫+套件全绿，待真机验收）

## 0. 背景与拍板

R71 验收问询触发核实：**沉浸式翻译官方口径**（官方文档/FAQ 实测）= `Alt+A` 切网页翻译（`Alt+W` 强制整页）；悬停段落翻译**无独立快捷键**，是「按住 Shift + 悬停」且**默认关闭**；「双击 Alt」**不是**沉浸式翻译的功能（官方文档与 FAQ 全文无此设计，属其他工具习惯）。Mac 上沉浸式选 Shift 做悬停触发键正是为避开 Option 死键（å/π）。

**用户拍板（AskUserQuestion）：两个都加**——在保留 R71 `Alt+A`/`Alt+P`（Mac=⌥Option，e.code 匹配天然可用）的基础上：
1. **双击 Alt（Mac 双击 ⌥）**作为整页翻译开关的别名触发；
2. **按住 Shift 悬停**触发悬停单段翻译（对齐沉浸式交互）。

顺手修 R71 审查发现的录制器缺陷：只按单个修饰键会录出 `Alt+AltLeft` 类怪串。

## 1. 设计决策

### 1.1 双击 Alt 整页别名（page-translate.js）

- 识别：`e.code ∈ {AltLeft, AltRight}` 且仅 altKey（其余修饰键为假）= 裸 Alt 按下；两次裸 Alt keydown 间隔 ≤ `DOUBLE_ALT_MS = 500ms` → 调 `toggle()`（整页开关，与 Alt+A 同路径）。
- 连击纪律：任何其他 keydown 清除断连记录；单次裸 Alt **不拦截不动作**（网页自身行为零干扰）；触发那次 `preventDefault+stopPropagation`。
- Why code 不 key：与键位串同一理由（跨布局稳定）；Mac Option 双击天然同 code，无需平台分叉。
- 已有守卫全部沿用：编辑态/扩展 shadow host/禁用站/composing 不触发。
- 固定别名不进 storage 不可改键——Why：它是 Alt+A 的冗余别名，给习惯双击的用户兜底；不新增设置面（两键已够）。

### 1.2 Shift 悬停单段（page-translate.js）

- 识别：裸 Shift（`e.code ∈ {ShiftLeft, ShiftRight}` 且仅 shiftKey）→ `translateParagraphAt(lastX, lastY)`（复用 R71 全套：资格判定、翻译/撤销状态机、sessionCache）。
- 误触面分析（Why 敢默认启用而沉浸式默认关）：触发前提是**光标已悬停在合格正文段落上**（`elementFromPoint` 资格闸），纯 Shift 按下在其他位置零反应；Shift+Tab/Shift+F10/Shift+方向键均非裸 Shift 不命中。残留风险（Shift+点击扩展选区不经过 keydown、长按 Shift 悬停即触发——沉浸式 issue #1749 同款）登记真机 AC 观察。
- Shift+字母（如 Shift+A 大写）在编辑态被既有编辑态守卫拦下；页面非编辑态按 Shift+A 不命中（code=KeyA 非裸 Shift），零干扰。

### 1.3 录制器单修饰键根修（common.js）

- `__magicLensComboFromEvent` 增闸：`e.code` 命中修饰键物理键（`/^(Alt|Control|Meta|Shift)(Left|Right)$/`）→ 返回 null。Why 落在源头：录制器自动「继续等待」（null 不可录）、匹配器永不命中修饰键 code（双击连击不会误碰任何已录键位串）、守卫可锁。Node 守卫补 round-trip 反例。

### 1.4 设置页文案

- 「快捷键」节 hint 补：Mac 上 Alt = ⌥ Option、需含修饰键说明保持；两个固定别名（双击 Alt/⌥ 切整页、按住 Shift 悬停单段）入文案。

## 2. 版本

`0.8.33` / `0.8.33-<完成时刻>`（测试版）；R71 同为待真机验收，两版同车待发布。
