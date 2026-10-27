# LLD — R53 伴读抽屉语音双向（对齐 magicbook R227：麦克风转写输入 + 回复朗读）

> 状态：**已 merge 本地 develop，待真机验收**（2026-10-27）
> 来源：用户对 R52 汇报里「R227 伴读语音要不要同步」的拍板「要做」。R227 双向口径
> （输入 + 朗读）原样承接；worktree 沿用 R52 验收期驻留树（家族口径第 7 条：一次会话
> 一个 worktree），目录名保留 r52。

## 1. 承接与范围（对齐 magicbook R227 LLD）

| 复用（口径一致） | 不复用 / 不移植 |
| --- | --- |
| 录音→16k wav→ASR 转写（`POST /learning/asr/transcribe`，multipart `file`，≤10MB，Result 包 `{text}`） | 语音条回放：只转文字（R227 拍板同款） |
| `/tts/speak` 朗读（1 积分/次、听=消费；不带 bookName/chapter → 7 天临时档） | 服务端同步合成 TTS：SSE 流式语义不变 |
| 每条助手消息「朗读本条」手动点；≤1800 分段顺序播 + 进度；再点停止 | 设备选择下拉（R160）：抽屉无设备 UI，固定系统默认 |
| 转写**追加**输入框不自动发送；关抽屉/切会话停朗读 | 按住说话 / 全双工 / 发音评分（R221/R227 非目标同款） |

moon-well 零改动（两个端点 R155/R166 已上线）；magicbook 零改动。

## 2. 三处「不能照搬」与对应决策

### D1 · 录音宿主 = offscreen 文档（非 content script / SW）

- content script 录音：麦克风权限要对每个宿主站点逐个授权，http 页拿不到 `getUserMedia`；
- SW 无 DOM：`AudioContext`/`ScriptProcessor` 采集链路没有语义保证；
- offscreen 属扩展自身 origin：权限一次授权到处可用，宿主页 CSP/混合内容全部无涉。
- 生命周期：`ML_REC_START` 惰性 `createDocument`（已存在则吞错——`getContexts` 要
  Chrome 116，为兼容 min 110 用「试建 + 吞已存在」模式；SW 中途挂起再唤醒靠它幂等），
  `ML_REC_STOP` 取完音频即 `closeDocument`，`ML_REC_CANCEL` 丢弃不转写。
- 消息分两套：`ml:rec-start/stop/cancel` 是 content→SW；`ml:rec-go/done` 是 SW→offscreen
  内部转发。Why：content 的 `runtime.sendMessage` 广播到全部扩展上下文（含 offscreen），
  offscreen 只认自己那组类型且其余一律不回话，避免抢占 SW 的响应通道。
- 已核 Safety：popup/options/content/highlight 的 `onMessage` 监听器都按 type 过滤且
  未知类型不调用 `sendResponse`（逐一复查过），不会偷走 offscreen 的回执。

### D2 · 采集核心移植 learning-voice.js（MediaRecorder 仍然不用）

webm/opus 在 SiliconFlow 转写端兼容性存疑（magicbook R155 结论），WebAudio 拿原始 PCM
采集端编码 16k 单声道 wav；R159 全静音判定（峰值 <0.005≈−46dB 直接提示，不浪费上游转写）、
R158「任何失败路径都复位按钮」两条坑随移植继承。新增 5 分钟硬顶：到顶停采集保住音频、
清掉会话引用（否则再点开始被「已在录音中」挡住），content 侧计时同步封顶提示。
编码器为逐行移植，node 抽源码实跑校验（RIFF/fmt/data 头、16k/16bit/单声道、样本数）。

### D3 · 播放 = Web Audio；字节走消息通道（比 magicbook 更彻底的 CSP 隔离）

R227 D2 用 `decodeAudioData` 规避 `media-src blob:`；扩展侧更进一步——TTS 音频在 SW
取字节转 base64 回传，content 侧 `Web Audio` 解码播放，连宿主页 CSP 的 `connect-src`
都不占用（fetch 发生在 SW，host_permissions 豁免）。自动播放拦截、`suspended` 上下文、
老 Safari 回调形态 `decodeAudioData` 三处兼容照搬 magicbook。

### D4 · background 低层抽出 `callMoonWellRaw`

鉴权 + 超时 + 401 静默刷新单点化：`callApi`（JSON/Result）委托它；ASR（multipart，
Content-Type 必须留给浏览器生成边界）与 TTS（二进制响应）复用同一 401/超时/清凭据
分支，不再各抄一份（R46 单点纪律）。TTS 失败体是 HTTP 500 + Result 信封（典型「积分
不足」），必须带出 `message`，否则前端把计费拒绝伪装成「播放器坏了」（R227 同款）。
TTS 超时 180s（fnOS 本地 Qwen3-TTS 长段合成本就要分钟级，与 Nacos `tts.local.timeout-ms`
同值）；ASR 60s。

## 3. 实现落点

| 文件 | 改动 |
| --- | --- |
| `extension/offscreen.html` / `offscreen.js` | 新增：录音宿主文档 + 采集/编码/静音判定/硬顶 |
| `extension/background.js` | `callMoonWellRaw` 抽出（callApi 委托）；`ML_REC_START/STOP/CANCEL` offscreen 编排 + `transcribeAudio`；`ML_TTS_SPEAK` + `synthesizeSpeech`（二进制→base64） |
| `extension/common.js` | `__magicLensB64Encode/Decode`（分块，防 `String.fromCharCode.apply` 栈溢出）；`__magicLensSplitForSpeech`（R227 D4 同款分段） |
| `extension/rpc.js` | MSG 增 6 键（rec-start/stop/cancel/go/done + tts-speak） |
| `extension/chat.js` | 🎤 按钮 + 语音状态行 + 本地计时；转写追加输入框；🔊 朗读按钮挂每条助手消息（正文取渲染前原文 `__mlRaw`）；Web Audio 播放基元；关抽屉/切会话/删会话停播停录 |
| `extension/manifest.json` | permissions + `offscreen`；`0.8.16-202610271104` 测试版 |

## 4. 边界与失败（对齐 R227 §4，扩展侧增补）

| 场景 | 行为 |
| --- | --- |
| 麦克风权限被拒 / 无设备 / 被占用 | offscreen 按异常名映射可操作中文提示，状态行红字可见 |
| 录音 <1s 由 content 侧守卫？ | 无：扩展侧不复制 1s 守卫，过短录音由「无有效块/全静音」兜住（magicbook 的 1s 判定防的是连点，扩展侧按钮状态机天然防重入） |
| 录音 >5 分钟 | offscreen 硬顶停采保音频，content 计时同步封顶；10MB 上限由 moon-well 兜底 |
| 全静音 | 不转写，「请检查系统输入设备或静音开关」 |
| ASR 失败 / 空文本 | 状态行可见，录音已丢弃可重录；**不自动发送** |
| 转写成功不发送 | 文字留在输入框，无副作用 |
| TTS 400（段超 2000） | 理论不发生（1800 硬切）；发生则状态行可见 |
| TTS 500 + Result 信封（积分不足） | 带出 `message` 到状态行 |
| 浏览器拦截自动播放 | 手动点击是手势链；`suspended` 时提示「先与页面交互」 |
| 关抽屉（录音中） | `ML_REC_CANCEL` 丢弃音频，不产生 ASR 调用 |
| 关抽屉/切会话/删会话（朗读中） | `stopSpeech()` 立即停 + 复位按钮 |
| SW 录音中途挂起 | offscreen 文档独立存活；STOP 唤醒 SW 后 `ensureOffscreen` 幂等续接 |
| 首次使用麦克风 | Chrome 对扩展 origin 弹一次权限气泡，授权后免弹 |

## 5. 验证

- 本仓无自动化测试框架（AGENTS §3）：`node --check` 五文件全过；
- node 冒烟 **22 例全过**：分段（空串/纯空白/短文本/空行分段/1900 无标点硬切/纯中文
  2100 按句切不丢字/单句 3000 硬切/混合）、base64 跨块往返（30001 字节 + 字母表校验）、
  **encodeWav 从 offscreen.js 源码抽出真函数实跑**（RIFF/WAVE/fmt/data 头、16k/16bit/
  单声道、样本数、总长）；
- MSG 表-引用一致性脚本：23 键，background/chat/offscreen 引用无缺失；
- 交叉审查：background `callApi` 重构 diff 逐行过（401 retried 守卫保留）；三个页面
  监听器不抢响应通道逐一核实；5 分钟硬顶两处边角（会话引用清理、计时封顶）自审抓出即修。
- **手工清单（待用户真机）**：① 🎤 说一句 → 停止 → 输入框出现转写文字，编辑后发送成功；
  ② 首次授权麦克风只弹一次；③ 助手回复点「🔊 朗读本条」出声、再点停止；④ 长回复显示
  「朗读中 n/m」连续播完；⑤ 关抽屉朗读立停；⑥ 积分不足时朗读报「积分不足」而非「播放失败」。

## 6. 遗留

- `attachSpeakButton` 的朗读正文取 `__mlRaw`（原文），与 magicbook 的「渲染后 DOM 反解析」
  口径不同——扩展侧消息是纯文本 + 受控链接，原文即最忠实朗读稿，无需 br/pre 还原。
- options.js 的 `'ml:login-ok'` 裸字符串（存量，R46 漏收编）本轮不动，登记待后续小改。
- 语音输入不留痕（录音不入库），与 R227 拍板一致；自动朗读对话模式仍不做。
