# LLD — R66 划词发音四级链路（IndexedDB 词音缓存 → 词典直连 → moon-well 词典代理 → 机器合成）

> 状态：**开发中**（2026-11-14；服务端配对 moon-well R259 `POST /tts/dict-voice`；分支 `feat/r66-dictvoice-cache`；版本 0.8.27）
> 来源：用户需求（magiclens R66）——缓存每个单词的真人发音、消灭「奇怪机械音」；不预取；词典失效走后端（后端也给词典音），后端也失效才机器合成。

## 1. 决策

- **四级的第 1~3 级全部收进 background SW**，content 只发起消息、解码播放：MV3 下 SW fetch 吃 `host_permissions` 豁免、且字节经消息通道进 content 后走 Web Audio 解码，**与宿主页 CSP 完全无涉**（此前 content `new Audio(词典外链)`，media-src 严格站点被页面 CSP 打回机械音——R43 遗留问题的根治点）。
- 服务端 R259 给的仍是词典真人音（dictvoice），不是 TTS 合成——「后端」是词典音的第二取货渠道 + 多设备共享缓存 + 词典源变质时的存量保底。
- 不预取（用户拍板）：发音仍是点 🔊 才取，缓存只加速重复播放。
- 不复用 R53 `/tts/speak`（那是 Qwen3-TTS 机械音 + 1 积分/次计费）；本链路三级全部零计费零 key。

## 2. 消息契约

- `MSG.ML_DICT_SPEAK = 'ml:dict-speak'`（rpc.js 注册表，R46 集中口径）。
- 请求 `{word}`（选区 trim 后原样，归一在 SW 侧做）；响应 `{ok:true, audioBase64, source:'cache'|'dict'|'proxy'}` 或 `{ok:false, error}`——content 对 `ok:false` 一律落 `speakWithBrowser`（机器合成），不区分失败原因。

## 3. background.js（四级实现）

- **归一与形状闸**：`trim + '’'→"'" + toLowerCase` 后须过 `[a-z](?:[a-z'-]*[a-z])?`——与 moon-well `DictVoiceService.SINGLE_WORD_RE` 同口径（`don’t`/`don't` 共享一条缓存）；非单词形状直接 `{ok:false,'not-a-word'}`，不出网。
- **L1 IndexedDB**（库 `magiclens`/store `dictvoice`/键 `word`、`ts` 索引）：命中即回并 touch `ts`（LRU）；软上限 3000 词（≈36MB，R43 实测 ~12KB/词）超限按 `ts` 升序游标剪最旧。Why 不用 `chrome.storage.local`：默认 ~10MB 配额墙只装得下 ~800 词，`sync` 100KB 更不行；IndexedDB 跨 SW 挂起持久。读写失败一律按 miss/跳过降级（缓存是加速器不是依赖）。
- **L2 词典直连**：`fetch(DICT_VOICE_URL + encodeURIComponent(word))`（type=2 美式），5s `AbortSignal.timeout`；形制校验同服务端（200 + `content-type` audio 开头 + 非空体）——错误页字节绝不入库下发。
- **L3 后端代理**：`callMoonWellRaw('/tts/dict-voice', ...)` 10s（跨公网放宽）；404/断网/未登录都返回 null 落下一级，错误详情不外露。
- **L1 写入**：L2/L3 拿到的字节都写 IndexedDB（后端音下次也零网络）。
- **single-flight**：`dictInflight` Map 同词并发共享一次链路（R39 在途守卫同思路，防连点叠请求）。

## 4. content.js（speak() 改造）

- 保留 `SINGLE_WORD_RE`（首尾字母、词内撇号/连字符）分流：非单词直接机器合成，词走 `ML_DICT_SPEAK`。
- 播放：`__magicLensB64Decode` → `AudioContext.decodeAudioData`（老 Safari 回调形态兼容，chat.js 同款）→ `BufferSource`；`AudioContext` 每页复用一个；`ctx.state === 'suspended'` 或解码失败 → 退机器合成不静音收场。
- 迟到作废双闸：`speakSeq`（`stopSpeak()` 时 +1——关气泡/再朗读都会停旧音）+ `current.text !== text`（换词），同 translate 的口径；回退也过闸，防旧词机械音盖新词（R43 `dictAudio` 判重的同款问题，消息化后用序号）。
- `stopSpeak()`：停 `BufferSource` 播放柄 + `speechSynthesis.cancel()`。

## 5. 测试

- `scripts/check-extension-modules.js` 增补 R66 契约段（内存 IndexedDB 桩 + 可控 fetch，VM 真实执行 background.js）：直连命中回传形制/归一词序、缓存命中零出网、直连失败→代理命中（登录态）、四级全空 `{ok:false,'no dict voice'}`、形状闸零出网——5 组断言全绿（连同既有 ML_TRANSLATE / R64 回调页契约）。
- `node --check` 三文件过；`mvn test` moon-well 侧 12/12 绿（见其 LLD）。
- 集成套件：`matrix/magiclens.csv` ml-speak 行改写为四级口径 + `browser/run.js` 用例双断言（SW 直连请求被 fail-fast → 代理请求 `word=hello`），`/tts/dict-voice` 补 mock 路由，`guard.py` 三向全绿。
- 手工 AC（开发态，加载扩展实测）：单词点 🔊 出真人音；同词第二次点秒出（缓存）；短语/句子出合成音；断网/关后端时单词仍有机械音兜底；关气泡声音即停。

## 6. 边界与遗留

- 服务端缓存键=归一词，客户端同——两端共享同词缓存粒度；音色固定美音（type=2），英音（type=1）未开口径，需要时加设置项。
- 客户端 LRU 上限 3000 词未做持久化计数校验（软上限，剪枝路径由 `ts` 索引游标承担）。
- magicbook 阅读器划词发音暂未接本链路（仍浏览器直连），后续需要共享服务端缓存时再切。
