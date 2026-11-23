# R74 LLD：缺陷修复——双击 Alt 键序误伤（R72）+ 在途回包跨会话重复渲染（R67 潜伏）

状态：开发完成（2026-11-23，0.8.35-202611232133 测试版；插桩定位→修复→套件+CfT 真实浏览器实测全绿，待真机验收）

## 0. 缺陷定性（R73 浏览器实测发现，缺陷环定位到 R72 别名 + R67 攒批管线）

- **用户委托浏览器实测**（CfT + 真实 dev moon-well + 可信键盘事件）暴露：①双击 Alt 开后 300ms 按 Alt+A，撤销步失效、页面出现**同段两条不同译文**、chip 累计「已译 13 段」；②每段两条译文文本不同=两次独立真实翻译。
- **插桩实锤缺陷一（R72 双击 Alt 误伤）**：keydown 时间线 `t=11 第二次 Alt down→判双击 ON` → `t=313 Alt+A 的 Alt down（303ms<500ms）被当下一组双击的第二击→误 toggle` → `t=314 A→再 toggle`。即「双击后 ≤500ms 内的任何 Alt 组合键」其 Alt down 都会被误判；**长按 Alt 的 keydown 重复（e.repeat）同样会在 500ms 窗口内连环判定**。
- **实锤缺陷二（R67 潜伏，误伤放大器）**：`sendBatch` 回包仅守 `!active`——快速 OFF→ON 时旧会话在途回包落进**新会话**（active 已为 true），`fillBlock` 把旧批译文重复插进页面，与新会话缓存渲染的块并存 → 同段双译文。stop() 只清块不清「在途回包的会话归属」。

## 1. 修复（page-translate.js）

1. **`e.repeat` 守卫**：别名分发开头忽略长按 keydown 重复（不是「击」）。
2. **静默确认窗**：第二击判定不再即时 toggle——置 `doubleAltTimer=setTimeout(toggle, 150)`；期间任何其他 keydown（`cancelPendingDouble`，含 Alt+A 的 A、⌥P 的 P）取消判定；`stop()` 同步取消（防幽灵 toggle）。纯双击延迟 150ms 触发（无感）。
3. **会话代守卫**：`sessionSeq` 每次 `start()` +1；`sendBatch` 捕获 `seq`，回包 `stale = !active || seq !== sessionSeq`——stale 时**仍写页内缓存**（翻译费已花，重开零计费）但跳过 DOM/chip/续发；`!stale` 分支行为不变。

## 2. 回归锁

- 套件 `ml-shortcuts` +⑩：双击开 →（缓存渲染）→ 立刻 Alt+A → 恰好关闭、400ms 后无幽灵复活、全程零新请求；`repeat=true` 裸 Alt keydown 零反应。
- 守卫 `check-extension-modules.js` R74 段：`e.repeat`/`DOUBLE_ALT_QUIET`/`cancelPendingDouble` 三处调用/`sessionSeq` 捕获与比较/`start()` 递增，静态锁死。

## 3. 验证

- 套件：`ml-shortcuts` 全过；浏览器全特性 **18/18**；guard 三向 18 行缺口 0；模块契约守卫 7 段全绿。
- **CfT 真实浏览器端到端**（真实 dev moon-well + 可信键盘事件）：修复前失败的完整键序（整页→关→双击别名→Alt+P 单段→撤销→Wikipedia 真实世界页）全过——6/6 真实中文译文、单段撤销归零、Wikipedia 首屏 8 段真实翻译、`scrollTo(4000)` 后 IO 续批至 16 段、关闭清零（截图存 /tmp/ml-browser-test/）。

## 4. 交付四问

- L1：不变；L2：不变；L3：触发器时序边界与会话代语义（本 LLD）；LLD 状态行已回填。
