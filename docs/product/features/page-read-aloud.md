# 网页正文朗读（L3 实现说明）

> 状态：现行。R75 引入（v0.8.37）。

## 实现

- `extension/page-speak.js` 是唯一实现模块，manifest 在主文档条目中晚于
  `common.js / rpc.js / page-translate.js` 注入；非顶层文档直接 return。
- 段落发现用 `TreeWalker(SHOW_ELEMENT)` + `FILTER_SKIP` 下钻容器，命中
  `P,LI,BLOCKQUOTE,DD,DT,H1-H6` 后按「可见 + 最短字符数 + 中文占比 ≤30%」过滤；
  排除 `nav/header/footer/aside/form/pre/code/contenteditable` 与全部 MagicLens host。
  列表/引用内嵌 `<p>` 时只取最内层，按归一文本去重，单页上限 200 段。
- 段末 ▶ 是一个共享浮钮（不是每段插 DOM）：`mousemove → closest(BLOCK_SEL) → WeakMap`
  找到段落，用 `Range.getClientRects()` 取最后一行矩形，把 24px 圆钮摆在行尾右侧
  （与 magicbook 段落工具同位置语义；末行顶到视口右缘时落到行下右对齐）；
  播放中同一按钮变 ■（请求在途为 ⟳），再点即停；滚动/移出 220ms 后收起。
- 连播队列把每段用 `__magicLensSplitForSpeech(text, 1800)` 切句后扁平化。播放前调用
  `ML_TTS_SPEAK`，并 `prefetch` 下一段；SW 侧 `ttsInflight` 合并同文本并发请求，
  `ttsaudio` IndexedDB 缓存命中直接回字节。
- 播放优先 `HTMLAudioElement` + `preservesPitch`（支持暂停/继续、变速不变调）；
  `play()` 被 CSP/自动播放策略拒绝时回退 Web Audio `decodeAudioData + BufferSource`
  （此时暂停会停当前段，继续从该段重播）。
- 控制条状态：`pos`（当前段/总段）、暂停/继续、下一段、语速、停止；当前段用固定定位的
  半透明框高亮，段落切换时 `scrollIntoView({block:'center'})`。
- 右键菜单由 `background.js` 在 `onInstalled/onStartup` 创建，经
  `ML_READ_PARAGRAPH / ML_READ_TOGGLE` 转发给当前 tab；`contextmenu` 捕获最后右击段落。
- 快捷键走页面级 `keydown capture` + `__magicLensComboMatches`，默认 `Alt+KeyS`，
  存 `shortcutReadAloud`；编辑态与其它扩展 UI 内不触发，朗读控制条自身聚焦时不拦截。
- 能力握手：`document.documentElement.dataset.magiclensRead = '1'`。

## 边界

- 只处理顶层文档；iframe 正文不装配；magicbook 域（含子域）整体让位宿主阅读器。
- 只读正文段落；不读表格单元格、代码块、表单、导航/页眉页脚与扩展 UI。
- 主开关与域名禁用只在页面加载时判定；加载后关闭主开关会立即停播并收起 UI，再打开需刷新。
- 连播中不重扫 DOM；SPA 变更在空闲时 900ms 防抖重扫。
- 音频缓存 200 段、7 天；超限按 `ts` LRU 剪枝，写失败不影响本次播放。
- 用户口径「不做计费二次确认」：首次合成按字符计费，重听走本地缓存零积分。

## 手工 AC

1. 打开一篇英文长文（如 Anthropic 文章），鼠标移到正文段落，段落最后一行末尾出现小圆 ▶。
2. 点 ▶ → 默认 AI 音读出该段，图标变 ■；当前段有高亮框，长段自动切句连续播；再点 ■ 停止。
3. 控制条显示当前段/总段；暂停后能继续；「下一段」立即跳读；停止后高亮与控制条收起。
4. 语速 1.0→0.75→0.5 循环，变速不变调；刷新页面后档位保持。
5. 按 `Alt+S`（或设置页改键）从当前视口起整页连播，页面自动滚屏；再按一次停止。
6. 右键正文空白处 →「MagicLens 朗读本段」读该段；右键菜单「朗读全文 / 停止」同快捷键。
7. 选中段落中一句话再右键「朗读本段」→ 读包含选区的整段，不读半句。
8. 未登录点朗读 → 提示重新登录；积分不足 → 显示服务端文案，不静默无声。
9. 同一段停止后重播 → 不再发 `/tts/speak`（SW 本地缓存命中，零积分）。
10. magicbook 阅读器页不出现第二套朗读 UI（iframe 不装配 + 扩展悬浮球让位）。
