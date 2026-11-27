# response-R53.md（归档）

> 2026-11-13 R63 写入触发轮转：本节由 response.md 原样搬入，未改写。

### R53（伴读抽屉语音双向，对齐 magicbook R227：麦克风转写输入 + 回复朗读）

- **背景**：用户对 R52 汇报的拍板「要做」。R227 双向口径承接：录音→16k wav→ASR 转写→**追加**输入框不自动发送；每条助手回复「🔊 朗读本条」手动点，≤1800 字分段顺序播，`/tts/speak` 听=消费、不带书籍上下文落 7 天临时档。moon-well/magicbook 零改动。
- **交付（分支 `feat/r52-buddy-parity` 同树续作（家族口径第 7 条），版本 0.8.16-202610271104 测试版，manifest permissions + `offscreen`）**：
  - **录音宿主 = offscreen 文档**（D1）：content 录音要逐站点授权麦克风、http 页拿不到 getUserMedia，SW 无 DOM；offscreen 属扩展 origin 一次授权。消息两套：`ml:rec-start/stop/cancel`（content→SW）与 `ml:rec-go/done`（SW→offscreen 转发）——content 的 runtime.sendMessage 广播到全部扩展上下文，offscreen 只认自己那组、其余不回话；popup/options/content/highlight 四处监听器逐一核实不会抢响应。
  - **采集核心移植 magicbook learning-voice.js**（D2）：16k wav 采集端编码（webm/opus 兼容性存疑不用 MediaRecorder）、R159 全静音 −46dB 判定、R158 失败必复位；新增 5 分钟硬顶（停采保音频 + 清引用，content 计时同步封顶）。
  - **播放 = Web Audio + 字节走消息通道**（D3）：SW 取 TTS 二进制转 base64 回传，content 解码播放——比 magicbook 的 CSP 规避更彻底，宿主页 media-src/connect-src 都不占用；自动播放拦截/suspended/老 Safari 回调形态三处兼容照搬。
  - **background 抽出 `callMoonWellRaw`**（D4）：鉴权+超时+401 静默刷新单点，callApi（JSON）委托之，ASR（multipart）与 TTS（二进制）复用同分支；TTS 失败体 Result 信封必带出 message（积分不足不伪装成播放器坏了）；TTS 超时 180s（本地 Qwen3-TTS 分钟级）、ASR 60s。
- **验证（诚实）**：node --check 五文件全过；node 冒烟 22 例全过（分段边界×8、base64 跨块往返、**encodeWav 抽源码实跑**校验 RIFF 头/16k/16bit/样本数）；MSG 表 23 键引用一致；callApi 重构 diff 逐行自审（retried 守卫保留）。**真机手工清单待用户**：①🎤 说一句→停止→转写进输入框可编辑发送；②首次授权只弹一次；③🔊 出声/再点停止；④长回复「朗读中 n/m」；⑤关抽屉朗读立停；⑥积分不足报「积分不足」。
- **文档**：README 功能表与 API 契约表回填（`/tts/speak` 转「部分接入」+ 补 ASR 行）；LLD `iterations/1.0/r53-buddy-voice/lld.md`；迭代 plan.md 增 MAGICLENS-7。
- **台账**：worktree `../magiclens-r52-buddy-parity`（分支 `feat/r52-buddy-parity`）merge 后驻留待验收（R52+R53 两批一起验）；未 push（正式发布需用户确认后去时间戳 merge release）。窗口轮转：最旧的 R46 原样搬至 `response-archive/response-R46.md` 并登记索引，写入后窗口 10 条。
- **总结**：requests.md 占号 R53（claim.sh `f9805c8`）；PingCode idea [ML-52 / 1nxbdoBF](https://haoshenqi.pingcode.com/ship/ideas/1nxbdoBF)（Pending → In progress，待验收后 Completed）；response.md 本条；冲突记录：无。
