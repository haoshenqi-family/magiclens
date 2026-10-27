/* MagicLens offscreen 录音文档（R53 伴读语音输入，对齐 magicbook R227）。
 *
 * Why 用 offscreen 文档录音，而不是 service worker 或 content script：
 * - SW 无 DOM：AudioContext/ScriptProcessor 采集链路在 MV3 SW 里没有语义保证；
 * - content script 录音要把麦克风权限对每个宿主站点逐个授权，http 页更拿不到
 *   getUserMedia；offscreen 属扩展自身 origin，权限一次授权到处可用；
 * 采集核心移植 magicbook cps/static/js/learning-voice.js：WebAudio 拿原始 PCM
 * 在采集端编码 16k 单声道 wav（Why 不用 MediaRecorder：webm/opus 在 SiliconFlow
 * 转写端兼容性存疑，magicbook R155 同款结论），含 R159 全静音判定（−46dB）；
 * R160 的站内设备选择不移植——扩展抽屉无设备下拉，固定系统默认设备。
 * 只与 background 通信（ML_REC_GO 开始 / ML_REC_DONE 取音频 / ML_REC_CANCEL 丢弃）；
 * content script 广播来的其余消息一律不回话，避免抢占响应通道。 */
(() => {
  const MSG = __magicLensRpc.MSG;
  // 硬顶 5 分钟：忘点停止时不让 wav 无限涨（16k 单声道 ≈32KB/s，300s ≈ 9.4MB，
  // 贴着 moon-well ASR 的 10MB 上限）。到顶只停采集、保住已录音频，等 STOP 来取。
  const MAX_MS = 300000;

  const recorder = { ctx: null, stream: null, source: null, processor: null,
                     chunks: [], startedAt: 0, autoTimer: null };

  function stopCapture() {
    if (recorder.autoTimer) { clearTimeout(recorder.autoTimer); recorder.autoTimer = null; }
    try {
      if (recorder.processor) recorder.processor.onaudioprocess = null;
      if (recorder.processor) recorder.processor.disconnect();
      if (recorder.source) recorder.source.disconnect();
      if (recorder.stream) recorder.stream.getTracks().forEach((t) => t.stop());
    } catch (e) { /* 已停止时忽略 */ }
  }

  // Why ScriptProcessor（已标过时）而非 AudioWorklet：worklet 要单独模块文件 +
  // fetch 加载，offscreen 场景没有任何收益；magicbook 同款选择已跑通三年量级。
  function recorderStart() {
    if (recorder.ctx || recorder.stream) return Promise.reject(new Error('已在录音中'));
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      return Promise.reject(new Error('当前浏览器不支持麦克风录音'));
    }
    return navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1 } })
      .then((stream) => {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        recorder.ctx = new AudioCtx();
        recorder.stream = stream;
        recorder.source = recorder.ctx.createMediaStreamSource(stream);
        recorder.processor = recorder.ctx.createScriptProcessor(4096, 1, 1);
        recorder.chunks = [];
        recorder.startedAt = Date.now();
        recorder.processor.onaudioprocess = (event) => {
          recorder.chunks.push(new Float32Array(event.inputBuffer.getChannelData(0)));
        };
        if (recorder.ctx.state === 'suspended') recorder.ctx.resume();
        recorder.source.connect(recorder.processor);
        recorder.processor.connect(recorder.ctx.destination);
        recorder.autoTimer = setTimeout(() => {
          // 硬顶到顶：只停采集、保留 chunks 供 STOP 取用，同时清掉会话引用——
          // 否则再点开始会被「已在录音中」守卫挡住（采集其实早已停止）
          stopCapture();
          if (recorder.ctx && recorder.ctx.close) recorder.ctx.close();
          recorder.ctx = null; recorder.processor = null; recorder.source = null;
          recorder.stream = null;
        }, MAX_MS);
      });
  }

  /* 停止并取音频：cancel=true 只清场；否则做 R159 全静音判定后编码 16k wav。
   * 各步包在 try 里：SW 侧把本调用整体视为「结束录音」，同步抛错也必须落到
   * {ok:false} 回执（R158 口径：同步段抛错会让按钮永远停在「转写中…」）。 */
  function recorderStop(cancel) {
    stopCapture();
    const rate = recorder.ctx ? recorder.ctx.sampleRate : 48000;
    const chunks = recorder.chunks.slice();
    if (recorder.ctx && recorder.ctx.close) recorder.ctx.close();
    recorder.ctx = null; recorder.processor = null; recorder.source = null;
    recorder.stream = null; recorder.chunks = [];
    if (cancel) return null;
    if (!chunks.length) throw new Error('录音太短');
    let maxAmp = 0;
    chunks.forEach((chunk) => {
      for (let i = 0; i < chunk.length; i += 1) {
        const abs = Math.abs(chunk[i]);
        if (abs > maxAmp) maxAmp = abs;
      }
    });
    // R159：全静音录音送进引擎只会得到「不可读」——低于 −46dB 几乎必然是设备
    // 静音/选错输入源，直接给可操作提示，不浪费一次上游转写
    if (maxAmp < 0.005) {
      throw new Error('麦克风没有录到声音——请检查系统输入设备或静音开关');
    }
    return encodeWav(chunks, rate);
  }

  function encodeWav(chunks, inputRate) {
    const targetRate = 16000;
    let count = 0;
    chunks.forEach((chunk) => { count += chunk.length; });
    // 先合并成单条 PCM（逐块索引在长音频上是百万次链表遍历）
    const merged = new Float32Array(count);
    let offset = 0;
    chunks.forEach((chunk) => { merged.set(chunk, offset); offset += chunk.length; });
    const outLength = Math.max(1, Math.floor(count * targetRate / inputRate));
    const samples = new Int16Array(outLength);
    for (let i = 0; i < outLength; i += 1) {
      const pos = i * inputRate / targetRate;
      const index = Math.floor(pos);
      const frac = pos - index;
      const a = merged[Math.min(index, count - 1)];
      const b = merged[Math.min(index + 1, count - 1)];
      const sample = a + (b - a) * frac;
      samples[i] = Math.max(-32768, Math.min(32767, Math.round(sample * 32767)));
    }
    const buffer = new ArrayBuffer(44 + samples.length * 2);
    const view = new DataView(buffer);
    const str = (off, value) => {
      for (let i = 0; i < value.length; i += 1) view.setUint8(off + i, value.charCodeAt(i));
    };
    str(0, 'RIFF'); view.setUint32(4, 36 + samples.length * 2, true); str(8, 'WAVE');
    str(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true);
    view.setUint16(22, 1, true); view.setUint32(24, targetRate, true);
    view.setUint32(28, targetRate * 2, true); view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    str(36, 'data'); view.setUint32(40, samples.length * 2, true);
    new Int16Array(buffer, 44).set(samples);
    return new Blob([buffer], { type: 'audio/wav' });
  }

  function micErrorMessage(e) {
    const name = (e && e.name) || '';
    if (/NotAllowed|PermissionDenied/.test(name)) return '麦克风权限被拒绝：请在地址栏右侧的权限设置里允许本扩展使用麦克风';
    if (/NotFound|DevicesNotFound/.test(name)) return '未找到可用的麦克风设备';
    if (/NotReadable|TrackStart/.test(name)) return '麦克风被其他应用占用，请关闭后重试';
    return (e && e.message) || '录音启动失败';
  }

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (!msg) return false;
    if (msg.type === MSG.ML_REC_GO) {
      recorderStart()
        .then(() => sendResponse({ ok: true }))
        .catch((e) => sendResponse({ ok: false, error: micErrorMessage(e) }));
      return true; // 异步回执
    }
    if (msg.type === MSG.ML_REC_DONE) {
      let wav = null;
      try { wav = recorderStop(false); } catch (e) {
        sendResponse({ ok: false, error: e && e.message || '录音读取失败' });
        return false;
      }
      wav.arrayBuffer()
        .then((buf) => sendResponse({ ok: true, audioBase64: __magicLensB64Encode(buf) }))
        .catch(() => sendResponse({ ok: false, error: '录音编码失败' }));
      return true;
    }
    if (msg.type === MSG.ML_REC_CANCEL) {
      try { recorderStop(true); } catch (e) { /* 无有效录音也照常清场 */ }
      sendResponse({ ok: true });
      return false;
    }
    return false; // 其余类型（含 content 广播进来的 ML_REC_START 等）不认领
  });
})();
