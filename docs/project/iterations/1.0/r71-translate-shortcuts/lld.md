# R71 LLD：翻译快捷键——整页翻译 / 悬停单段翻译 + 设置页自定义

状态：开发完成（2026-11-23，0.8.32-202611231607 测试版；守卫+套件全绿，待真机验收）

## 0. 需求与拍板

- 用户诉求（R71）：给「翻译段落」与「整页翻译」加快捷键，**参考沉浸式翻译**，并在设置页提供快捷键自定义。
- 口径拍板（AskUserQuestion 二轮确认，2026-11-23）：
  - **整页翻译快捷键** = 切换现有整页翻译开关（R67 `ML_PT_TOGGLE` 同一语义，无新能力）。
  - **翻译段落快捷键** = **悬停单段翻译**：按一次翻译鼠标所在的那一个段落，再按一次撤销该段——与沉浸式翻译「鼠标悬停切换段落翻译」同款；不必先开整页模式，指哪翻哪、按需计费。
  - **默认键位** = `Alt+A`（整页，与沉浸式翻译一致）/ `Alt+P`（单段）；设置页可改、可清除（清除=禁用）。

## 1. 方案选型（含被否方案）

| 方案 | 结论 | 理由 |
| --- | --- | --- |
| A. 扩展内 keydown 监听 + 设置页录制（沉浸式翻译同款） | **采用** | 键位可编程自定义；设置项随 chrome.storage.sync 跨设备；用户诉求原文即「加一个快捷键设置」 |
| B. `chrome.commands`（manifest）+ `chrome://extensions/shortcuts` 自定义 | 否（`toggle-highlight` Alt+U 维持现状） | 扩展无法在自家设置页读写/改键，自定义 UI 归 Chrome、扩展不可编程设置；与「快捷键设置」诉求不符 |
| C. A+B 双轨 | 否 | 同一动作两条真值互相打架（哪边算数），无收益 |

边界后果（方案 A 固有，与沉浸式翻译一致，登记 AC）：快捷键仅在**网页获得焦点**时生效（浏览器 chrome 聚焦时不触发）；iframe 内聚焦不响应（引擎顶层文档监听，iframe 段落由整页模式覆盖）。

## 2. 契约与数据

### 2.1 键位串形制（storage.sync 值）

- 形制：`修饰键(固定序 Alt,Ctrl,Meta,Shift) + "+" + e.code`，如 `Alt+KeyA`、`Ctrl+Shift+Comma`。
- **Why 存 e.code 不存 e.key**：macOS 的 Option 组合把 `e.key` 变成死键字符（Alt+A → `å`、Alt+P → `π`），按 key 匹配在 Mac 上整段失效；`e.code` 是物理键位，跨键盘布局稳定。
- 空串 `''` = 该快捷键禁用（用户清除）。
- 默认值进 `common.js __magicLensDefaults`（R46 单点纪律）：
  - `shortcutPageToggle: 'Alt+KeyA'`
  - `shortcutParagraph: 'Alt+KeyP'`

### 2.2 common.js 纯函数（供 options/page-translate/守卫三方共用）

- `__magicLensComboFromEvent(e)`：KeyboardEvent → 键位串；无主修饰键（Alt/Ctrl/Meta 任一）时返回 null（裸键/Shift 组合不可录制——页面聚焦时裸键属于网页本身）。
- `__magicLensComboMatches(stored, e)`：串与事件全等比对（修饰键集合 + code 一致）；串非法返回 false。
- `__magicLensComboLabel(stored)`：串 → 展示文案（`KeyA`→`A`、`Digit1`→`1`、`Comma`→`,` 等；非法串返回空）。
- Why 落 common.js：options 页不加载 page-translate.js（R69 registry 先例）；纯函数可被 Node 守卫直接锁契约。

### 2.3 行为守卫（触发侧硬规则）

1. **编辑态不触发**：事件 target 为 `input/textarea/select/contenteditable` 时忽略——macOS Alt+字母在输入框会插死键字符（å/π），快捷键再翻译一次会造成双重效果。
2. **域名禁用站不触发**：与划词/高亮同一份 `disabledDomains` 语义，静默忽略（站已禁用不应有任何反应）。
3. **划词总开关关闭**：整页切换走现有 `toggle()`（自带该护栏与文案）；单段翻译同样给出 chip 文案。
4. 命中键位才 `preventDefault + stopPropagation`——快捷键从此归属 MagicLens；未命中不碰事件（网页自身快捷键零干扰）。
5. 冲突：设置页录制时若与另一条快捷键相同，拒绝并提示换键位。

## 3. 悬停单段翻译（page-translate.js 内）

- **鼠标锚点**：顶层文档 `mousemove`（capture+passive）记 `lastX/lastY`；Why 只顶层：快捷键监听在顶层，单段仅支持鼠标所在顶层文档段落（同源 iframe 段落由整页模式覆盖）。
- **定位段落**：`document.elementFromPoint(lastX, lastY)` → `closest(TEXT_TAGS)`；复用 `paragraphText` 资格判定（剥掉 `records` 查重——单段路径自行管理已录段落）。
- **单段 toggle 状态机**：
  - `records` 有该段且 `state==='done'` 且有译文块 → **撤销**：摘块、`records.delete`（`sessionCache` 保留译文，再按一次零计费复活）。
  - `state` 为 `pending/loading` → 忽略（在途批次无法单段取消；chip 进度可见）。
  - 其余（`idle/failed/不存在`）→ 翻译：`start(false)` 保底开启（见下）→ 建/复用 record → `enqueue(rec)`（页内缓存命中即时渲染零请求；未命中走既有攒批管线，**单段也享受 800ms 攒批**，与整页开启首屏段合批省钱）。
- **`start(discover = true)` 增参**：单段路径传 `false`——**不做全页发现**，否则光标视口内的其他段落会随 IO 自动起批（单段诉求被放大成视口翻译，计费违约）。整页 toggle 与 bfcache 恢复两处调用不变（默认 true）。
- 计费护栏沿用：`MAX_ACTIVATION`（100 段/次开启）、服务端 ES 缓存命中仍计费故页内 `sessionCache` 双层挡重复。
- 单段撤销不回退 `scheduled` 计数（保守方向：只可能少用配额，不可能超用）。

## 4. 设置页（options）

- 新增「快捷键」节：两行（整页翻译开/关、翻译鼠标所在段落），每行 = 只读录制框 + 「清除」按钮。
- **录制交互**（沉浸式翻译同款）：聚焦 → 提示「按下组合键（Esc 取消）」→ keydown 捕获：Esc 取消还原；仅修饰键按下继续等待；`__magicLensComboFromEvent` 出串合法即落 `chrome.storage.sync` 并回显 label；与另一条冲突拒绝。
- 「清除」= 存 `''`，回显「未设置」（placeholder）。
- 存储变更经 `chrome.storage.onChanged` 由 page-translate.js 实时采纳（已开页面即时生效，无需刷新——与 R56/R69 配置生效口径一致）。

## 5. 守卫与套件（测试用例跟着产品走，R185）

- `scripts/check-extension-modules.js` 增 R71 契约段：①defaults 两键在册；②combo 三函数 round-trip（事件→串→匹配/反例→label）；③page-translate.js 静态装配断言（keydown 监听、两默认键引用、编辑态守卫）；④options.html/js 元素与录制器接线断言。
- 集成套件同任务内同步：`matrix/magiclens.csv` +1 行（`ml-shortcuts`，module=page-translate）；`browser/run.js` 新特性用例（悬停单段→1 段请求→再按撤销→Alt+A 整页 5+1 缓存合批→关闭清干净→编辑态不触发）；`e2e_bridge.py` FEATURES +1；`guard.py` 三向全绿。
- E2E 关键断言口径：先单段后整页时，整页批次应为 **5 段**（首段命中页内缓存零请求零计费）——锁「单段→整页不重复计费」。

## 6. 文档四问预答

- L1 `README.md`：整页翻译行补快捷键说明 + 单段翻译入口行；上手五步补 Alt+A/Alt+P。
- L2 `docs/product/design.md`：§23 ADR（键位串形制、方案 A 否 B 理由、编辑态/禁用站护栏）。
- L3：实现边界（iframe/编辑态不触发、单段撤销状态机、`start(discover)` 增参）随本 LLD 承载（本仓 L3 features/ 尚未建立的既有口径，跟随 R67 先例）。
- LLD：状态行随里程碑回填。

## 7. 版本

`0.8.32` / `version_name 0.8.32-<完成时刻时间戳>`（测试版，不触发发布）；正式发布仍由用户确认后按 §0.2 两段式（可与 R66–R70 同车）。
