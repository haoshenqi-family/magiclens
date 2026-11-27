# LLD — R75 网页正文段落朗读（默认 AI 音 + 每段 ▶ + 快捷键/右键菜单）

> 状态：开发中（2026-11-27）
> 关联需求：magiclens R75；设计决策见 `docs/product/design.md` §24；L3 见
> `docs/product/features/page-read-aloud.md`。

## 1. 范围与非目标

**范围**：顶层网页正文段落发现（magicbook 域让位宿主）、段落悬浮 ▶、整页连播、控制条（暂停/下一段/变速/停止）、
当前段高亮与自动滚屏、`Alt+S` 快捷键、右键菜单、SW 文本级音频缓存。

**非目标**：iframe 正文（magicbook 阅读器已有段落朗读）、逐词/逐句卡拉 OK 高亮、
整篇一次性合成、计费二次确认（用户拍板不做）、移动端手势。

## 2. 数据流

```
mousemove/contextmenu/keydown
  → page-speak.js 段落资格 + 队列
  → ML_TTS_SPEAK (rpc.js)
  → background.js synthesizeSpeech
      → IndexedDB ttsaudio 命中? 直接回 base64
      → miss: POST /tts/speak（180s，≤2000 字符）
      → 写回 ttsaudio（200 段 LRU / 7 天）
  → content 解码播放（<audio> preservesPitch → Web Audio 回退）
```

## 3. 关键决策

- **D1 段落资格与 page-translate 同轴**：可见、≥40 字符（标题 ≥8）、CJK ≤30%、排除代码/
  导航/扩展 UI；只取最内层段落，避免列表/引用重复读。上限 200 段是计费与 DOM 扫描护栏。
- **D2 默认 AI 音，不回落机械音**：用户拍板默认 AI 音；失败必须可见（401/积分不足文案），
  不允许静默改用 `speechSynthesis`，否则「默认 AI」名不副实。
- **D3 预取 + single-flight + 本地缓存**：用户不做二次确认，省钱靠工程——预取下一段平滑播放；
  SW 同文本并发合并；文本级缓存让重听零网络零积分。缓存 TTL 与服务端临时档一致（7 天）。
- **D4 播放链路**：优先 `<audio>` + `preservesPitch`，因为需要暂停/继续与变速不变调；
  `blob:` 被宿主页 `media-src` 拦时回退 Web Audio（变速会变调，但好过无声）。
- **D5 悬浮 ▶ 共享浮钮**：不为每段插 DOM，避免 200 个节点与页面布局耦合；`WeakMap`
  从元素到段落，滚动只重定位一个浮钮。
- **D6 右键菜单两层**：`background.js` 创建菜单并转发消息；`page-speak.js` 用
  `contextmenu` 记录最后右击段落。带选区时优先找包含选区的段落，找不到才读选区本身。

## 4. 落位

| 文件 | 改动 |
| --- | --- |
| `extension/page-speak.js` | 新模块：发现、浮钮、队列、播放器、控制条、高亮、快捷键、消息 |
| `extension/background.js` | TTS 文本缓存 + single-flight；右键菜单创建/转发；DB v2 新 store |
| `extension/rpc.js` | MSG 增 `ML_READ_PARAGRAPH / ML_READ_TOGGLE` |
| `extension/common.js` | defaults 增 `shortcutReadAloud='Alt+KeyS'` |
| `extension/options.html/js` | 快捷键第三行录制（三方冲突检查） |
| `extension/manifest.json` | `contextMenus` 权限 + `page-speak.js` 注入 |
| `page-extract/page-translate/highlight` | 排除 `#magiclens-read-host` |
| `scripts/check-extension-modules.js` | R75 契约段（AI 音/菜单/缓存/注入顺序/设置项） |
| `ops/tools/integration-suite/*` | matrix + bridge + `ml-read-aloud` E2E + 可解码 WAV mock |

## 5. 失败与边界

| 场景 | 行为 |
| --- | --- |
| 401/403 | 停止队列，提示重新登录 |
| 积分不足（HTTP 500 + Result） | 显示服务端 `message`，停止队列 |
| 音频解码失败 | 停止并提示，不静默 |
| 宿主页 CSP 拦 `blob:` | Web Audio 回退（暂停=停当前段，继续重播该段） |
| 段落在连播中被移除 | 文本仍可播完；高亮隐藏；不抛错 |
| 页面加载后关闭主开关 | 停播、收起 UI；再打开需刷新 |
| 禁用站 | 零 host、零监听、零请求 |

## 6. 验证

- `node --check extension/*.js`
- `node scripts/check-extension-modules.js`（R75 段）
- `python3 ops/tools/integration-suite/guard.py --repo magiclens`
- `node ops/tools/integration-suite/browser/run.js --feature ml-read-aloud --json`
- 手工 AC 见 `docs/product/features/page-read-aloud.md` 与 `ac/manual-ac.md`
