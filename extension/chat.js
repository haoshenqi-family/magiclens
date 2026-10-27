/* MagicLens 伴读聊天抽屉（LLD §4，US3）。
 * Why SSE 在 content script 消费：MV3 service worker 30s 空闲回收，工具调用期间
 * 可能数百秒无 delta，流必须挂在与抽屉同生命周期的上下文（LLD 决策 A1）；
 * moon-well CORS allowedHeaders("*")，带 Bearer 的跨源直连可行（R3 已核实）。
 * Why adoptedStyleSheets：不受宿主页 CSP style-src 影响，比 shadow 内 <style> 更稳。 */
(() => {
  if (window.__magicLensChatLoaded) return;
  window.__magicLensChatLoaded = true;

  const MAX_MESSAGE = 4000;      // moon-well AgentChatRequest.message 上限
  const SSE_PATH = '/ai/agent/chat';

  const state = {
    built: false, open: false,
    view: 'chat',                // chat | memory | profile
    conversationId: null,        // null = 新会话（服务端首问创建，final 回传）
    running: false, abort: null,
    recording: false, recTimer: null,   // R53 语音输入（录音状态与本地计时器）
    els: null,
  };

  /* ---------- 配置与 JSON API（面板请求走 background 中转，LLD A2） ----------
   * Why 凭据向 background 索取而非本地读 storage（R35）：apiBase 公网域名只存在
   * 于 background 的 DEFAULT 兜底（设置页自 v0.3 起无地址配置项，storage 里没有
   * 这个键），token 的静默刷新也只在 background——本地读空串曾让面板永远停在
   * 「未配置服务地址或 Token」且重新登录无效。 */
  // R46（架构评审 L1）：传输与失效分类迁 __magicLensRpc——失效文案（扩展已更新，
  // 请刷新本页面）保留在本薄包装（面板契约是 Promise {ok,error,status}）。
  const MSG = __magicLensRpc.MSG;  // R46：消息类型常量集中（rpc.js）

  function bg(msg) {
    return new Promise((resolve) => {
      const failed = (error) => resolve({ ok: false, error, status: 0 });
      __magicLensRpc.send(msg, (resp, err) => {
        if (err) {
          return failed(__magicLensRpc.isInvalidated(err)
            ? '扩展已更新，请刷新本页面（F5）' : err);
        }
        resolve(resp || { ok: false, error: 'no response', status: 0 });
      });
    });
  }
  const api = (path, body) => bg({ type: MSG.ML_API, path, body: body || {} });

  /* ---------- DOM 构建（closed Shadow DOM，懒创建） ---------- */
  const CSS = `
    :host { all: initial; }
    * { box-sizing: border-box; font: 13px/1.65 -apple-system, 'PingFang SC', 'Segoe UI', sans-serif; }
    .mask { position: fixed; inset: 0; z-index: 2147483646; background: rgba(0,0,0,.25); display: none; }
    .drawer { position: fixed; top: 0; right: -420px; width: 400px; height: 100vh; z-index: 2147483647;
      background: #fff; color: #1f2937; box-shadow: -8px 0 32px rgba(0,0,0,.18);
      display: flex; flex-direction: column; transition: right .22s ease; }
    /* Why 状态类挂 wrap（shadow 内元素）：closed shadow 的 :host 类不影响内部选择器 */
    .wrap.on .drawer { right: 0; }
    .wrap.on .mask { display: block; }
    .head { display: flex; align-items: center; gap: 6px; padding: 10px 12px; border-bottom: 1px solid #e5e7eb; }
    .head select { flex: 1 1 auto; min-width: 0; border: 1px solid #d1d5db; border-radius: 8px; padding: 5px 8px; background: #fff; }
    .ic { all: unset; cursor: pointer; text-align: center; width: 28px; height: 28px; line-height: 28px;
      border-radius: 8px; background: #f3f4f6; font-size: 13px; flex: 0 0 auto; }
    .ic:hover { background: #e5e7eb; }
    .ic.tab.active { background: #e0e7ff; color: #4f46e5; }
    .flex { flex: 1; }
    main { flex: 1; overflow-y: auto; padding: 12px; }
    .panel[hidden] { display: none; }
    .msg { margin: 0 0 10px; max-width: 88%; padding: 8px 10px; border-radius: 12px; white-space: pre-wrap; word-break: break-word; }
    .msg.user { background: #4f46e5; color: #fff; margin-left: auto; border-bottom-right-radius: 4px; }
    .msg.assistant { background: #f3f4f6; border-bottom-left-radius: 4px; }
    .msg.assistant .meta { margin-top: 4px; font-size: 11px; color: #9ca3af; white-space: normal; }
    /* R52（对齐 magicbook R233）：助手消息里的站内链接（__magicLensAssistantHtml 产物） */
    .msg.assistant a.ai-chat-site-link { color: #4f46e5; text-decoration: underline; }
    .msg.assistant a.ai-chat-site-link:hover { color: #3730a3; }
    .msg.assistant pre { background: #eef1f6; padding: 6px 8px; border-radius: 8px; overflow-x: auto;
      white-space: pre-wrap; word-break: break-word; margin: 4px 0; }
    .msg.assistant code { background: #e8ebf3; border-radius: 4px; padding: 0 3px; }
    .msg.err { background: #fef2f2; color: #b91c1c; border: 1px solid #fecaca; }
    .msg.hint { background: #eef2ff; color: #4f46e5; max-width: 100%; }
    .tools { display: flex; flex-wrap: wrap; gap: 4px; margin-bottom: 6px; }
    .chip { font-size: 11px; background: #eef2ff; color: #4f46e5; border-radius: 6px; padding: 2px 6px;
      max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .chip.run::after { content: '…'; }
    .chip.ok { background: #ecfdf5; color: #059669; }
    .chip.fail { background: #fef2f2; color: #b91c1c; }
    .chip.warn { background: #fffbeb; color: #b45309; border: 1px solid #fde68a; }
    details.trace { margin-top: 4px; font-size: 11px; color: #6b7280; }
    details.trace pre { margin: 2px 0 0; white-space: pre-wrap; word-break: break-word; }
    .compose { border-top: 1px solid #e5e7eb; padding: 10px 12px; }
    .row { display: flex; gap: 8px; align-items: flex-end; }
    textarea { flex: 1; resize: none; border: 1px solid #d1d5db; border-radius: 10px; padding: 8px 10px; font: inherit; }
    .send { all: unset; cursor: pointer; background: #4f46e5; color: #fff; border-radius: 10px; padding: 8px 14px; }
    .send.stop { background: #dc2626; }
    .send:disabled { opacity: .5; cursor: default; }
    .panel h4 { margin: 0 0 8px; font-size: 13px; color: #374151; }
    .mem-item { border: 1px solid #e5e7eb; border-radius: 10px; padding: 8px 10px; margin-bottom: 8px; }
    .mem-item .t { font-size: 11px; color: #9ca3af; margin-top: 2px; }
    .mem-item button, .mem-add button { all: unset; cursor: pointer; color: #b91c1c; font-size: 11px; float: right; }
    .mem-add textarea { width: 100%; margin-bottom: 6px; }
    .mem-add button { color: #4f46e5; font-size: 12px; background: #eef2ff; border-radius: 6px; padding: 4px 10px; float: none; }
    .profile p { margin: 6px 0; }
    .profile .kv { color: #6b7280; font-size: 12px; }
    .empty { color: #9ca3af; text-align: center; padding: 24px 0; }
    .cfg-link { color: #4f46e5; cursor: pointer; text-decoration: underline; }
    /* R53 语音：麦克风按钮（录音红底呼吸）、语音状态行、每条回复的朗读按钮 */
    .mic { all: unset; cursor: pointer; text-align: center; width: 36px; height: 36px; line-height: 36px;
      border-radius: 10px; background: #f3f4f6; font-size: 15px; flex: 0 0 auto; }
    .mic:hover { background: #e5e7eb; }
    .mic:disabled { opacity: .5; cursor: default; }
    .mic.rec { background: #dc2626; color: #fff; animation: ml-mic-pulse 1.2s ease-in-out infinite; }
    @keyframes ml-mic-pulse { 0%, 100% { opacity: 1; } 50% { opacity: .55; } }
    .voice-status { min-height: 15px; margin-top: 6px; font-size: 11px; color: #6b7280; white-space: normal; }
    .speak-btn { all: unset; cursor: pointer; margin-top: 6px; margin-right: 6px; display: inline-block;
      font-size: 11px; color: #4f46e5; background: #eef2ff; border-radius: 6px; padding: 2px 8px; }
    .speak-btn:hover { background: #e0e7ff; }
    .speak-btn.playing { background: #dc2626; color: #fff; }
  `;

  function build() {
    if (state.built) return;
    state.built = true;
    const host = document.createElement('div');
    host.id = 'magiclens-chat-host';
    document.documentElement.appendChild(host);
    const shadow = host.attachShadow({ mode: 'closed' });
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(CSS);
    shadow.adoptedStyleSheets = [sheet];

    const wrap = document.createElement('div');
    wrap.className = 'wrap';
    wrap.innerHTML = `
      <div class="mask"></div>
      <aside class="drawer">
        <div class="head">
          <select class="conv-sel"><option value="">＋ 新会话</option></select>
          <button class="ic" data-act="rename" title="重命名当前会话">✎</button>
          <button class="ic" data-act="del" title="删除当前会话">🗑</button>
          <button class="ic tab" data-view="memory" title="长期记忆">🧠</button>
          <button class="ic tab" data-view="profile" title="学情（网页会话暂无）">📈</button>
          <button class="ic" data-act="close" title="关闭">✕</button>
        </div>
        <main class="msgs view-chat"></main>
        <main class="panel view-memory" hidden></main>
        <main class="panel view-profile" hidden></main>
        <div class="compose">
          <div class="row">
            <button class="mic" title="语音输入（点击开始，说完再点一下停止）">🎤</button>
            <textarea class="input" rows="2" placeholder="问点什么…（Enter 发送 / Shift+Enter 换行）"></textarea>
            <button class="send">发送</button>
          </div>
          <div class="voice-status"></div>
        </div>
      </aside>`;
    shadow.appendChild(wrap);

    state.els = {
      host, wrap, shadow,
      mask: shadow.querySelector('.mask'),
      convSel: shadow.querySelector('.conv-sel'),
      msgs: shadow.querySelector('.msgs'),
      memory: shadow.querySelector('.view-memory'),
      profile: shadow.querySelector('.view-profile'),
      input: shadow.querySelector('.input'),
      sendBtn: shadow.querySelector('.send'),
      mic: shadow.querySelector('.mic'),
      voiceStatus: shadow.querySelector('.voice-status'),
    };

    // ---------- 事件 ----------
    state.els.mask.addEventListener('click', close);
    shadow.addEventListener('click', (e) => {
      const btn = e.target.closest('button');
      if (!btn) return;
      const act = btn.dataset.act, view = btn.dataset.view;
      if (act === 'close') close();
      else if (act === 'rename') renameConversation();
      else if (act === 'del') deleteConversation();
      else if (view) switchView(view);
    });
    state.els.convSel.addEventListener('change', () => {
      const id = state.els.convSel.value ? Number(state.els.convSel.value) : null;
      switchConversation(id);
    });
    state.els.sendBtn.addEventListener('click', () => {
      if (state.running) { state.abort && state.abort.abort(); return; }
      send(state.els.input.value);
    });
    state.els.mic.addEventListener('click', () => { toggleMic(); });
    state.els.input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (!state.running) send(state.els.input.value); }
    });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && state.open) close(); });
  }

  function open(text) {
    build();
    state.open = true;
    state.els.wrap.classList.add('on');
    if (!state.bootstrapped) {
      state.bootstrapped = true;
      welcome();
      refreshConversations();
    }
    if (text) state.els.input.value = `「${text}」`;
    switchView('chat');
    state.els.input.focus();
  }

  function close() {
    state.open = false;
    state.els.wrap.classList.remove('on');
    if (state.running && state.abort) state.abort.abort(); // P0 不做关抽屉续跑（LLD 非目标）
    stopSpeech();       // R227 口径：关抽屉立即停朗读，不留「念着但找不到停止入口」
    cancelRecording();  // 录音直接放弃（不转写不计费）
  }

  function switchView(view) {
    state.view = view;
    state.els.msgs.hidden = view !== 'chat';
    state.els.memory.hidden = view !== 'memory';
    state.els.profile.hidden = view !== 'profile';
    state.els.shadow.querySelectorAll('.ic.tab').forEach((b) =>
      b.classList.toggle('active', b.dataset.view === view));
    if (view === 'memory') loadMemory();
    if (view === 'profile') loadProfile();
  }

  /* ---------- 消息流 ---------- */
  function el(tag, cls, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  const scrollBottom = () => { state.els.msgs.scrollTop = state.els.msgs.scrollHeight; };

  function welcome() {
    const m = el('div', 'msg hint', 'MagicLens 伴读：划词后点「问 AI」，或直接输入问题。当前网页的标题与正文会自动作为上下文；重要的信息可让我「记住」，随时在 🧠 面板查看。');
    state.els.msgs.appendChild(m);
  }

  function appendMsg(cls, text) {
    const m = el('div', `msg ${cls}`, text);
    state.els.msgs.appendChild(m);
    scrollBottom();
    return m;
  }

  function appendAssistantShell() {
    const m = el('div', 'msg assistant');
    const tools = el('div', 'tools');
    const text = el('div', 'text');
    const meta = el('div', 'meta');
    m.append(tools, text, meta);
    state.els.msgs.appendChild(m);
    scrollBottom();
    return { root: m, tools, text, meta };
  }

  function appendError(shell, message, auth) {
    shell.meta.textContent = '';
    shell.meta.appendChild(el('span', '', message));
    if (auth) {
      shell.meta.appendChild(el('span', '', '，请 '));
      const link = el('span', 'cfg-link', '重新登录');
      link.addEventListener('click', () => {
        try {
          chrome.runtime.sendMessage({ type: MSG.ML_LOGIN }, () => void chrome.runtime.lastError);
        } catch (e) {
          console.warn('[MagicLens] 扩展已更新，本页旧脚本退役；刷新页面（F5）后生效');
        }
      });
      shell.meta.appendChild(link);
    }
  }

  function chipCall(d) {
    const c = el('span', `chip run${d.requireConfirm ? ' warn' : ''}`, `${d.name} ${d.argsSummary || ''}`);
    c.dataset.step = d.step;
    c.title = `${d.name}(${d.argsSummary || ''})`;
    return c;
  }

  function chipResult(shell, d) {
    const c = shell.tools.querySelector(`.chip[data-step="${d.step}"]`);
    if (!c) return;
    c.classList.remove('run');
    c.classList.add(d.ok ? 'ok' : 'fail');
    const summary = String(d.resultSummary || '').slice(0, 60);
    c.textContent = `${d.name} ${d.ok ? '✓' : '✗'} ${summary}（${d.durationMs}ms）`;
    c.title = `${d.name}: ${d.resultSummary || ''}`;
  }

  function renderTrace(shell, traceJson) {
    let lines = null;
    try { lines = JSON.parse(traceJson); } catch { return; }
    if (!Array.isArray(lines) || !lines.length) return;
    const det = document.createElement('details');
    det.className = 'trace';
    det.appendChild(el('summary', '', `工具轨迹（${lines.length} 行）`));
    const pre = el('pre', '', lines.join('\n'));
    det.appendChild(pre);
    shell.root.appendChild(det);
  }

  /* ---------- SSE 消费（分型帧协议，LLD §4.2；服务端 complete() 关流、无 [DONE]） ---------- */
  async function consumeSse(resp, h) {
    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let buf = '';
    const handleFrame = (frame) => {
      let event = 'delta';
      const dataLines = [];
      for (const line of frame.split('\n')) {
        if (line.startsWith('event:')) event = line.slice(6).trim();
        else if (line.startsWith('data:')) dataLines.push(line.slice(5).replace(/^ /, ''));
        // 其余行（[DONE]、注释、空行）按协议忽略
      }
      if (!dataLines.length) return;
      const raw = dataLines.join('\n');
      if (raw === '[DONE]') return;
      let data;
      try { data = JSON.parse(raw); } catch { h.onDelta(raw); return; } // 裸文本降级
      if (event === 'delta') h.onDelta(data.text != null ? data.text : (data.data || ''));
      else if (event === 'tool_call') h.onToolCall(data);
      else if (event === 'tool_result') h.onToolResult(data);
      else if (event === 'final') h.onFinal(data);
      else if (event === 'error') h.onError(data);
    };
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      let idx;
      while ((idx = buf.indexOf('\n\n')) >= 0) {
        handleFrame(buf.slice(0, idx));
        buf = buf.slice(idx + 2);
      }
    }
    if (buf.trim()) handleFrame(buf); // 尾帧容错
  }

  /* ---------- 发送 ---------- */
  async function send(raw) {
    if (state.running) return;
    let text = (raw || '').trim();
    if (!text) return;
    if (text.length > MAX_MESSAGE) text = text.slice(0, MAX_MESSAGE);

    const auth = await bg({ type: MSG.ML_AUTH });
    if (!auth.ok) {
      appendError(appendAssistantShell(), auth.error || '未登录，请重新登录', Boolean(auth.auth));
      return;
    }

    state.running = true;
    state.abort = new AbortController();
    state.els.input.value = '';
    state.els.sendBtn.textContent = '停止';
    state.els.sendBtn.classList.add('stop');

    appendMsg('user', text);
    const shell = appendAssistantShell();
    const ctx = window.__magicLensCollectPageContext ? window.__magicLensCollectPageContext() : {};

    const body = {
      message: text,
      bookId: null,                    // 网页场景判据（moon-well 落 0、用 web prompt）
      bookTitle: ctx.bookTitle || '',
      pageText: ctx.pageText || '',
      // 记忆始终开启（用户决策 2026-10-04，移除 skipMemoryExtract 开关）
    };
    if (state.conversationId) body.conversationId = state.conversationId;

    let gotFinal = false;
    let acc = ''; // 流式原文缓冲：final 后按 R52 渲染站内链接（textContent 只在流式阶段用）
    try {
      const resp = await fetch(auth.apiBase.replace(/\/+$/, '') + SSE_PATH, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${auth.token}`, Accept: 'text/event-stream' },
        body: JSON.stringify(body),
        signal: state.abort.signal,
      });
      if (resp.status === 401 || resp.status === 403) throw Object.assign(new Error('登录失效'), { auth: true });
      if (!resp.ok || !resp.body) throw new Error(`HTTP ${resp.status}`);

      await consumeSse(resp, {
        onDelta: (t) => { acc += t; shell.text.textContent = acc; scrollBottom(); },
        onToolCall: (d) => { shell.tools.appendChild(chipCall(d)); scrollBottom(); },
        onToolResult: (d) => chipResult(shell, d),
        onFinal: (d) => {
          gotFinal = true;
          if (d.conversationId) state.conversationId = d.conversationId; // 首问回填（R232 口径：删用量不许顺手删此分支）
          // R232（对齐 magicbook）：不展示 token 用量——账务只在 magicbook 设置·积分查；
          // meta 仅保留非完成状态提示，成功时留空（gotFinal 兜底判空逻辑不受影响）
          shell.meta.textContent = d.status && d.status !== 'COMPLETED' ? String(d.status) : '';
          if (acc) {
            shell.text.innerHTML = window.__magicLensAssistantHtml(acc); // R233：站内链接可点
            shell.root.__mlRaw = acc;   // R53：朗读正文取原文
            attachSpeakButton(shell);
          }
          refreshConversations();
        },
        onError: (d) => {
          // R32：后端 R124 起发干净文案，此处净化兜网络层/旧版残留的技术细节
          const prefix = d.code === 'LLM_REJECTED' ? '积分不足：' : '';
          appendError(shell, prefix + window.__magicLensUserFacingError(d.message, 'AI 服务异常'), false);
        },
      });
      if (!gotFinal) {
        shell.meta.textContent = shell.meta.textContent || '';
        if (!shell.meta.textContent) appendError(shell, '连接中断，本轮未完成（可重发）', false);
      }
    } catch (e) {
      if (e.name === 'AbortError') {
        shell.meta.textContent = '已停止';
      } else if (e.auth) {
        appendError(shell, e.message, true);
      } else {
        appendError(shell, window.__magicLensUserFacingError(e.message, '请求失败，请稍后重试'), false);
      }
    } finally {
      state.running = false;
      state.abort = null;
      state.els.sendBtn.textContent = '发送';
      state.els.sendBtn.classList.remove('stop');
      scrollBottom();
    }
  }

  /* ---------- R53 语音（对齐 magicbook R227）：录音转写输入 + 回复朗读 ----------
   * 请求全部经 background 中转（AGENTS 硬性约定）：录音在扩展 offscreen 文档采集
   *（麦克风权限归扩展 origin，不受宿主页 http/混合内容限制），ASR/TTS 由 SW 发出；
   * 音频字节以 base64 走消息通道，content 侧 Web Audio 解码播放——连宿主页 CSP 的
   * media-src/connect-src 都不占用（R227 D2 的扩展版：任意宿主页 CSP 不可控）。
   * 朗读口径同 R227：每条手动点（不自动播）、分段 ≤1800 顺序播、播放中再点是停止、
   * 切会话/关抽屉即停。 */

  let voiceStatusTimer = null;

  function setVoiceStatus(text, sticky) {
    state.els.voiceStatus.textContent = text || '';
    if (voiceStatusTimer) { clearTimeout(voiceStatusTimer); voiceStatusTimer = null; }
    if (text && !sticky) {
      voiceStatusTimer = setTimeout(() => {
        state.els.voiceStatus.textContent = '';
        voiceStatusTimer = null;
      }, 6000);
    }
  }

  function micReset() {
    state.recording = false;
    if (state.recTimer) { clearInterval(state.recTimer); state.recTimer = null; }
    state.els.mic.classList.remove('rec');
    state.els.mic.disabled = false;
    state.els.mic.textContent = '🎤';
    state.els.mic.title = '语音输入（点击开始，说完再点一下停止）';
  }

  /** 放弃录音：丢弃音频、不转写（不产生 ASR 调用）。关抽屉时走这里。 */
  function cancelRecording() {
    if (!state.recording) return;
    micReset();
    bg({ type: MSG.ML_REC_CANCEL });
  }

  async function toggleMic() {
    const mic = state.els.mic;
    if (!state.recording) {
      if (state.running) { setVoiceStatus('上一条还在发送，发完再录音'); return; }
      mic.disabled = true;
      setVoiceStatus('正在请求麦克风…', true);
      const resp = await bg({ type: MSG.ML_REC_START });
      mic.disabled = false;
      if (!resp || !resp.ok) { setVoiceStatus('⚠ ' + ((resp && resp.error) || '录音启动失败')); return; }
      state.recording = true;
      mic.classList.add('rec');
      mic.textContent = '⏹';
      // Why 本地计时：录音态活在 offscreen 文档里，SW 可能中途挂起，不值得为
      // 秒表显示做 SW↔content 推送；时长只作展示，硬顶在 offscreen 侧执行
      const startedAt = Date.now();
      const tick = () => {
        // 与 offscreen 侧 5 分钟硬顶（MAX_MS）对齐：到顶后停表提示，避免无限走表
        const s = Math.floor((Date.now() - startedAt) / 1000);
        const capped = s >= 300;
        const short = capped ? '已到 5 分钟上限'
          : `录音中 ${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
        mic.title = `${short} · 点击停止`;
        setVoiceStatus(capped ? `${short}，点击停止转写` : `${short}，说完再点一下停止`, true);
      };
      tick();
      state.recTimer = setInterval(tick, 500);
      return;
    }
    // 停止 → offscreen 编码 wav → SW 转写。按钮禁用到回执，任何失败都必须复位
    //（R158 口径：同步段抛错/失败路径漏复位会让按钮永远停在「转写中…」）
    clearInterval(state.recTimer); state.recTimer = null;
    mic.disabled = true;
    mic.classList.remove('rec');
    setVoiceStatus('转写中…', true);
    const resp = await bg({ type: MSG.ML_REC_STOP });
    const errText = (!resp || !resp.ok) ? ((resp && resp.error) || '转写失败') : '';
    const text = (resp && resp.ok) ? String((resp.data && resp.data.text) || '').trim() : '';
    micReset();
    if (errText) { setVoiceStatus('⚠ ' + errText); return; }
    if (!text) { setVoiceStatus('⚠ 未识别到语音，请靠近麦克风再试一次'); return; }
    // R227 口径：转写结果追加到输入框（有草稿时空格连接），不自动发送
    const cur = state.els.input.value.replace(/\s+$/, '');
    state.els.input.value = cur ? `${cur} ${text}` : text;
    state.els.input.focus();
    try { state.els.input.setSelectionRange(state.els.input.value.length, state.els.input.value.length); } catch (e) { /* 类型不符时忽略 */ }
    setVoiceStatus('转写完成，可编辑后发送');
  }

  /* ---------- R53 回复朗读（/tts/speak 1 积分/次，听=消费；长回复分段顺序播） ---------- */
  const speech = { ctx: null, source: null, btn: null, token: 0 };

  function speechContext() {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    if (!speech.ctx) speech.ctx = new Ctx();
    // 点击手势链里创建/恢复：无手势时浏览器把上下文留在 suspended，播不出声时
    // 按状态行提示（与 magicbook 同口径）
    if (speech.ctx.state === 'suspended' && speech.ctx.resume) speech.ctx.resume();
    return speech.ctx;
  }

  function markSpeakButton(btn, playing) {
    if (!btn) return;
    btn.classList.toggle('playing', !!playing);
    const label = btn.querySelector('.speak-label');
    if (label) label.textContent = playing ? '⏹ 停止朗读' : '🔊 朗读本条';
  }

  function stopSpeech() {
    speech.token += 1;
    if (speech.source) {
      try { speech.source.onended = null; speech.source.stop(); } catch (e) { /* 已结束 */ }
      speech.source = null;
    }
    if (speech.btn) { markSpeakButton(speech.btn, false); speech.btn = null; }
  }

  // 老 Safari 只有回调形态的 decodeAudioData，Promise 形态会被当成 undefined（magicbook 同款兼容）
  function decodeSpeech(ctx, bytes) {
    return new Promise((resolve, reject) => {
      const maybe = ctx.decodeAudioData(bytes, resolve, reject);
      if (maybe && typeof maybe.then === 'function') maybe.then(resolve, reject);
    });
  }

  function playReply(rawText, btn) {
    stopSpeech();
    const segments = window.__magicLensSplitForSpeech(rawText);
    if (!segments.length) { setVoiceStatus('没有可朗读的内容'); return; }
    const ctx = speechContext();
    if (!ctx) { setVoiceStatus('⚠ 当前浏览器不支持音频播放'); return; }

    const token = speech.token;
    speech.btn = btn;
    markSpeakButton(btn, true);

    const playAt = (index) => {
      if (token !== speech.token) return;
      if (index >= segments.length) { stopSpeech(); setVoiceStatus(''); return; }
      if (segments.length > 1) setVoiceStatus(`朗读中 ${index + 1}/${segments.length}`, true);
      bg({ type: MSG.ML_TTS_SPEAK, text: segments[index] }).then((resp) => {
        if (token !== speech.token) return null;
        if (!resp || !resp.ok) throw new Error((resp && resp.error) || '朗读音频不可用');
        return decodeSpeech(ctx, window.__magicLensB64Decode(resp.audioBase64));
      }).then((buffer) => {
        if (!buffer || token !== speech.token) return;
        if (ctx.state === 'suspended') {
          stopSpeech();
          setVoiceStatus('⚠ 浏览器拦截了音频播放，请先与页面交互后重试');
          return;
        }
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.connect(ctx.destination);
        speech.source = source;
        source.onended = () => playAt(index + 1);
        source.start(0);
      }).catch((err) => {
        if (token !== speech.token) return;
        stopSpeech();
        setVoiceStatus('⚠ ' + (err.message || String(err)));
      });
    };
    playAt(0);
  }

  /** 每条助手消息挂「朗读本条」（只挂助手侧——读自己的提问没有意义，R227）。
   * Why 正文取渲染前原文（shell.root.__mlRaw）而非渲染后 DOM 反解析：扩展侧消息
   * 是纯文本 + 受控链接，原文即最忠实的朗读稿，也免去 magicbook 那套 br/pre 还原。 */
  function attachSpeakButton(shell) {
    const raw = shell.root.__mlRaw;
    if (!raw || !raw.trim()) return;
    const old = shell.root.querySelector('.speak-btn');
    if (old) old.remove();
    const btn = el('button', 'speak-btn');
    btn.appendChild(el('span', 'speak-label', '🔊 朗读本条'));
    btn.addEventListener('click', () => {
      if (btn.classList.contains('playing')) { stopSpeech(); return; }
      playReply(shell.root.__mlRaw, btn);
    });
    shell.root.appendChild(btn);
  }

  /* ---------- 会话管理 ---------- */
  async function refreshConversations() {
    const resp = await api('/ai/agent/conversations', {});
    const sel = state.els.convSel;
    if (!resp.ok) {
      // Why 失败必须可见（R44）：这里原本写作 `if (!resp.ok) return;`——列表拉挂了下拉就只剩
      // 「＋ 新会话」，与「你真的没有历史」在界面上长得一模一样，用户只能判定「记录被吞了」。
      // 现在把原因写进入口本身，并保住当前会话态（继续追问/重命名/删除照常用，只是暂时无从切换）；
      // 下一次成功响应会整体重建下拉。
      sel.textContent = '';
      if (state.conversationId == null) {
        const optNew = el('option', '', '＋ 新会话');
        optNew.value = '';
        sel.appendChild(optNew);
        sel.value = '';
      } else {
        const cur = el('option', '', `当前会话 #${state.conversationId}（列表加载失败，暂无法切换）`);
        cur.value = String(state.conversationId);
        cur.disabled = true; // 禁用项仍可被选作当前值，只是用户点不到
        sel.appendChild(cur);
        sel.value = cur.value;
      }
      const bad = el('option', '', `⚠ 会话列表加载失败：${resp.error || '未知错误'}`);
      bad.disabled = true;
      sel.appendChild(bad);
      return;
    }
    const current = state.conversationId;
    sel.textContent = '';
    const optNew = el('option', '', '＋ 新会话');
    optNew.value = '';
    sel.appendChild(optNew);
    for (const c of resp.data || []) {
      const label = `${c.bookId === 0 ? '[通用] ' : ''}${(c.title || '(无标题)').slice(0, 26)}`;
      const opt = el('option', '', label);
      opt.value = c.id;
      sel.appendChild(opt);
    }
    sel.value = current == null ? '' : String(current);
    if (sel.selectedIndex === -1) sel.value = ''; // 当前会话被删/无权限时回落
  }

  async function switchConversation(id) {
    if (state.running && state.abort) state.abort.abort();
    stopSpeech(); // R227 口径：切会话立即停朗读，不给旧会话的声音留停止入口
    state.conversationId = id;
    state.els.msgs.textContent = '';
    if (id == null) { welcome(); return; }
    const resp = await api('/ai/agent/history', { conversationId: id });
    if (!resp.ok) { appendMsg('err', resp.error || '历史加载失败'); return; }
    for (const m of resp.data || []) {
      if (m.role === 'user') {
        appendMsg('user', m.content);
      } else if (m.role === 'assistant') {
        const shell = appendAssistantShell();
        // R52（对齐 magicbook R233）：历史助手消息同样渲染站内链接（书内会话的历史
        // 也会出现在下拉里，其中可能有 /book/N、/me 等站内路径）
        shell.text.innerHTML = window.__magicLensAssistantHtml(m.content || '');
        shell.root.__mlRaw = m.content || '';   // R53：历史回复同样可朗读
        attachSpeakButton(shell);
        renderTrace(shell, m.toolTrace);
      }
    }
    scrollBottom();
  }

  async function renameConversation() {
    if (state.conversationId == null) { appendMsg('hint', '先开始一个会话再重命名（发送第一条消息后自动创建）。'); return; }
    const cur = state.els.convSel.selectedOptions[0];
    const name = prompt('新标题：', cur ? cur.textContent.replace(/^\[通用\] /, '') : '');
    if (!name) return;
    const resp = await api('/ai/agent/conversation/rename', { conversationId: state.conversationId, title: name.slice(0, 100) });
    if (resp.ok) refreshConversations();
    else appendMsg('err', resp.error || '重命名失败');
  }

  async function deleteConversation() {
    if (state.conversationId == null) return;
    if (!confirm('删除当前会话？')) return;
    const resp = await api('/ai/agent/conversation/delete', { conversationId: state.conversationId });
    if (resp.ok) {
      stopSpeech(); // 删掉正在朗读的会话同理
      state.conversationId = null;
      state.els.msgs.textContent = '';
      welcome();
      refreshConversations();
    } else {
      appendMsg('err', resp.error || '删除失败');
    }
  }

  /* ---------- 记忆 / 学情面板 ---------- */
  async function loadMemory() {
    const box = state.els.memory;
    box.textContent = '';
    box.appendChild(el('h4', '', '长期记忆（书级 + 通用级）'));
    const resp = await api('/ai/agent/memory/list', {});
    if (!resp.ok) { box.appendChild(el('div', 'empty', resp.error || '加载失败')); return; }
    const items = resp.data || [];
    if (!items.length) box.appendChild(el('div', 'empty', '暂无记忆'));
    for (const m of items) {
      const item = el('div', 'mem-item');
      const del = el('button', '', '删除');
      del.addEventListener('click', async () => {
        const r = await api('/ai/agent/memory/delete', { id: m.id });
        if (r.ok) { loadMemory(); return; }
        // L6（架构评审）：删除失败必须在面板上可见——静默吞掉会让用户以为「删了还在」
        box.appendChild(el('div', 'empty', (r.error || '删除失败') + '（删除失败）'));
      });
      item.appendChild(del);
      item.appendChild(el('div', '', m.memory || ''));
      item.appendChild(el('div', 't', `${m.bookId === 0 ? '[通用]' : '[书 ' + m.bookId + ']'} ${m.source || ''}`));
      box.appendChild(item);
    }
    const add = el('div', 'mem-add');
    const ta = document.createElement('textarea');
    ta.rows = 2;
    ta.placeholder = '手动记一条通用记忆（bookId=0）…';
    const save = el('button', '', '保存');
    save.addEventListener('click', async () => {
      const text = ta.value.trim();
      if (!text) return;
      const r = await api('/ai/agent/memory/save', { bookId: 0, memory: text });
      if (r.ok) { ta.value = ''; loadMemory(); return; }
      // L6（架构评审）：手动保存失败必须可见——静默丢失会让用户以为「存了其实没存」
      box.appendChild(el('div', 'empty', (r.error || '保存失败') + '（保存失败）'));
    });
    add.append(ta, save);
    box.appendChild(add);
  }

  async function loadProfile() {
    const box = state.els.profile;
    box.textContent = '';
    box.appendChild(el('h4', '', '学情（网页会话 bookId=0）'));
    const resp = await api('/ai/agent/book-profile', { bookId: 0 }); // @NotNull：须显式传 0
    if (!resp.ok) { box.appendChild(el('div', 'empty', resp.error || '加载失败')); return; }
    const p = resp.data;
    if (!p || !p.summary) { box.appendChild(el('div', 'empty', '网页会话暂无学情')); return; }
    const wrap = el('div', 'profile');
    wrap.appendChild(el('p', '', p.summary));
    if (p.difficulty) wrap.appendChild(el('p', 'kv', `难度感受：${p.difficulty}`));
    if (p.topics && p.topics.length) wrap.appendChild(el('p', 'kv', `常问主题：${p.topics.join('、')}`));
    if (p.hotWords && p.hotWords.length) wrap.appendChild(el('p', 'kv', `高频生词：${p.hotWords.join('、')}`));
    wrap.appendChild(el('p', 'kv', `累计提问 ${p.questionCount} 次 · 工具调用 ${p.toolUseCount} 次`));
    box.appendChild(wrap);
  }

  /* ---------- 划词气泡联动（content.js 调用） ---------- */
  window.__magicLensAsk = (text) => open(typeof text === 'string' ? text.trim() : '');
})();
