# LLD — R68 划词链路加固（控件选区双轨检测 + 气泡响应判代防漂移）

> 状态：**开发完成待真机验收**（2026-11-15；纯扩展侧改动，moon-well 零改动；分支 `feat/r68-selection-hardening`；版本 0.8.29-202611150857 测试版）
> 来源：wupage（GPL-3.0，只学思路不搬代码）研读报告 P0 两项 + 在册缺陷「GitHub code view 划词不弹」；R68 台账 433b573。

## 1. 决策

- **选区检测双轨制**（`content.js selectionInfo`）：选区分两类来源——
  - **控件轨**：`activeElement` 是 `<textarea>` / `<input type∈{text,search,url,tel}>`（number/date 等类型浏览器不暴露选择状态，划了也是无效选区）时读 `selectionStart/End`，`value.slice(start,end)` 即选中文本。Why：**控件选区不进 `window.getSelection()`**——DOM Selection API 只描述文本节点，控件内选区只存在于元素自身属性上，此时 window 选区恒 `isCollapsed`，旧逻辑整段失效。
  - **range 轨**（原逻辑保留）：window/文档级选区；入口加 **shadow 探针**——`activeElement.getRootNode()` 是 ShadowRoot 且其 `getSelection()`（Chromium 扩展专用 API，Chrome 110+ 满足）返回非空选区时优先采用（shadow 内选区的 window 选区被重定向到宿主），返回空则照旧走 `window.getSelection()`，只在「能拿到真选区」时替换，避免误伤。
  - **只读零干扰**：控件轨只读 `selectionStart/End` 与 `getBoundingClientRect`，不 focus、不 `setSelectionRange`、不 preventDefault/stopPropagation、不拦事件——对宿主页（快捷键/复制/光标定位/框架状态）零干扰；readOnly 字段允许查询（只挡替换，代码视图场景），disabled 不允许。
  - **控件锚点 = 光标行号近似 + 三重回退**：控件内选区拿不到行级 rect（整个字段一个大矩形），GitHub code view 的透明 textarea 覆盖整个文件，贴字段矩形会把气泡钉在文件顶部。按 `value.slice(0,start).split('\n').length` 反推光标行号 × `getComputedStyle().lineHeight` − `scrollTop` 估算锚点 y；行高取不到（`line-height: normal`）、字段 ≤3 行、坐标越界（虚拟化文本/滚动错位）均回退字段矩形（wupage 同款「锚字段不锚行」基线）。
- **iframe 中继同口径**（`selection-relay.js`）：relay 的 `report()` 复制控件轨（iframe 内输入框/批注框此前同样划词不弹），发送逻辑抽 `sendSelection(text, mapped)` 共用；iframe 内锚点用字段矩形（字段一般不大，不做行号近似）。relay 是独立脚本，与顶层改动互不影响。
- **translate 响应判代**（`content.js bubbleSeq`）：`current` 增加 `seq` 字段，三个赋值点（`openBubble` 划词、`__magicLensShowWordBubble` 悬浮/点高亮词、详解面板「点击重试」）统一 `seq: ++bubbleSeq`；`translate()` 回调的 stale 检查从「文本比对」换为 `current.seq !== seq`。Why：文本相等 ≠ 同代请求——同词重复划选/关泡重开时文本比对放行旧响应，旧词迟到译文可复活进新气泡（R63 词卡漂移的机制层缺口）。详解（`detailSeq`）与朗读（`speakSeq`）此前已有各自判代（R19/R43 口径），本次不动；`translateInflight` 同词去重保留（防连点重发，与判代正交）。
- **为什么不搬 wupage 的完整替换协议**：`replaceSelectionSource`（快照三查 + beforeinput 可取消 + execCommand 保 undo 栈）服务于「译文回填页面」功能，magiclens 无此功能暂不引入；将来做替换时按其思路重新实现（GPL-3.0 禁止直接搬代码）。

## 2. GitHub code view 边界（真站实测结论，修正 11-14 在册判断）

- 实测（CfT 157 真站 `github.com/<repo>/blob/<path>`）：扩展注入正常（`magiclens-host` 在）；**单击定位光标确实写 textarea**（`selectionStart=offset`、`activeElement=TEXTAREA`），**但拖选/双击/键盘 Shift 选择均由 GitHub 的 JS 层自管**——三路径实测都不写 textarea 选区也不写 window 选区（拖选后 `selectionStart/End` 维持单击时的旧值，渲染层无 `.selected` 类、无内联高亮样式，类名全为 CSS module 哈希无稳定契约）。
- 因此：**本修复恢复的是「标准控件行为」站点**（原生拖选 textarea/input、双击选词——真实鼠标拖选已在 E2E+真站验证弹泡），**GitHub code view 的鼠标拖选场景不覆盖**；GitHub 特例（解析其渲染层/React state）不可行——无 DOM 契约、改版即碎，且 wupage（679 星同赛道）同样无此特判（其 GitHub 特例仅在排除选择器）。是否立项站点特例待用户拍板。
- 11-14 在册 memory「代码文本在透明 textarea → 控件选区 isCollapsed」只对了半程：还有「GitHub 自管选择」一层。

## 3. 改动清单

| 文件 | 改动 |
| --- | --- |
| `extension/content.js` | `selectionInfo` 双轨化（控件轨 + shadow 探针 + range 轨保留）；`controlRect` 行号近似；`bubbleSeq` 判代（三处 `current` 赋值点带 seq + `translate()` 回调换 seq 比对）；版本 0.8.29 |
| `extension/selection-relay.js` | `report()` 控件轨 + `sendSelection()` 抽取 |
| `extension/manifest.json` | `version` 0.8.28→0.8.29，`version_name` 0.8.29-202611150857（测试版，不触发发布） |
| `ops/tools/integration-suite/browser/run.js` | 新增 `ml-control-selection` 用例；`ml-iframe-relay` 补控件轨断言；**修复预存缺陷**：总结打印引用 for 作用域内的 `t.log.blocked` 必然 ReferenceError → main reject → `exit(2)`（全 PASS 被误报基础设施失败，退出码门禁被废；改经 `lastBlocked` 收集） |
| `ops/tools/integration-suite/browser/pages/control-selection.html` | 新 fixture：普通 textarea + readOnly textarea（模拟 GitHub code view 透明层） |
| `ops/tools/integration-suite/browser/pages/iframe-child.html` | 加 `ta-child` textarea |
| `ops/tools/integration-suite/cases/magiclens/e2e_bridge.py` | FEATURES 注册表加 `("ml-control-selection", "selection-bubble")` |
| `ops/tools/integration-suite/matrix/magiclens.csv` | 加行 `ml-control-selection`（15→16 行） |

## 4. 验证

- **套件**：`node run.js` 全量 16 项 PASS、`exit=0`（退出码缺陷修复生效）；`python3 guard.py --repo magiclens` 矩阵 16 行缺口 0。
- **真站四场景**（`/tmp/ml-r68-github/verify2.js` + `verify-drag.js`，CfT 157 headful + CDP `DOM.getDocument(pierce:true)` 探测 closed shadow）：本地 range 轨合成事件 ✓、本地控件轨程序化选区 ✓、**真实鼠标拖选 textarea ✓**（气泡弹出、回显拖选文本）、GitHub code view textarea 程序化选区 ✓、GitHub README 正文 range 轨 ✓。
- **调试教训（存档）**：closed Shadow DOM 在主世界 `host.shadowRoot` 恒为 null——**页面级探测必须走 CDP pierce**；本次 diag8–12 的「不弹」连续假阴性均由此（套件 `pierceQuery` 的 CDP 路径是对的）；CDP `DOM.getDocument(pierce:true)` 的 closed shadow root 挂在节点的 **`shadowRoots`** 字段而非 `children`。品牌版 Chrome 136+ 忽略 `--load-extension`（157 实测），扩展 E2E 必须用 CfT（套件 `findCft()` 已有）。
- **真机 AC（用户验收）**：GitHub blob 页单击光标后拖选/双击不弹属预期（自管选择壁垒）；任意含标准输入框/textarea 的站点划词应弹；普通网页划词行为零回归；同词关泡重开无旧译文复活。

## 5. 未了

- GitHub 拖选站点特例是否立项待拍板（本 LLD §2）。
- PingCode idea 回写（沿用 magiclens ML- 系列）。
- wupage 研读报告 P1/P2 项（悬浮球 delta、iciba 防滥用三件套、设置归一化、错误信封）未立项。
