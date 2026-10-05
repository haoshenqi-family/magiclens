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
    els: null,
  };

  /* ---------- 配置与 JSON API（面板请求走 background 中转，LLD A2） ---------- */
  const getCfg = () => chrome.storage.sync.get({ apiBase: '', token: '' });

  function api(path, body) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: 'ml:api', path, body: body || {} }, (resp) => {
        if (chrome.runtime.lastError) return resolve({ ok: false, error: chrome.runtime.lastError.message, status: 0 });
        resolve(resp || { ok: false, error: 'no response', status: 0 });
      });
    });
  }

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
            <textarea class="input" rows="2" placeholder="问点什么…（Enter 发送 / Shift+Enter 换行）"></textarea>
            <button class="send">发送</button>
          </div>
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
      link.addEventListener('click', () => chrome.runtime.sendMessage({ type: 'ml:login' }));
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

    const cfg = await getCfg();
    if (!cfg.apiBase || !cfg.token) {
      appendError(appendAssistantShell(), '未配置服务地址或 Token', true);
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
    try {
      const resp = await fetch(cfg.apiBase.replace(/\/+$/, '') + SSE_PATH, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.token}`, Accept: 'text/event-stream' },
        body: JSON.stringify(body),
        signal: state.abort.signal,
      });
      if (resp.status === 401 || resp.status === 403) throw Object.assign(new Error('登录失效'), { auth: true });
      if (!resp.ok || !resp.body) throw new Error(`HTTP ${resp.status}`);

      await consumeSse(resp, {
        onDelta: (t) => { shell.text.textContent += t; scrollBottom(); },
        onToolCall: (d) => { shell.tools.appendChild(chipCall(d)); scrollBottom(); },
        onToolResult: (d) => chipResult(shell, d),
        onFinal: (d) => {
          gotFinal = true;
          if (d.conversationId) state.conversationId = d.conversationId; // 首问回填
          const u = d.usage || {};
          shell.meta.textContent = `tokens ${u.promptTokens ?? '?'}+${u.completionTokens ?? '?'}`
            + (d.status && d.status !== 'COMPLETED' ? ` · ${d.status}` : '');
          refreshConversations();
        },
        onError: (d) => {
          const prefix = d.code === 'LLM_REJECTED' ? '积分不足：' : '';
          appendError(shell, prefix + (d.message || 'AI 服务异常'), false);
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
        appendError(shell, e.message, false);
      }
    } finally {
      state.running = false;
      state.abort = null;
      state.els.sendBtn.textContent = '发送';
      state.els.sendBtn.classList.remove('stop');
      scrollBottom();
    }
  }

  /* ---------- 会话管理 ---------- */
  async function refreshConversations() {
    const resp = await api('/ai/agent/conversations', {});
    if (!resp.ok) return;
    const sel = state.els.convSel;
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
        shell.text.textContent = m.content || '';
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
        if (r.ok) loadMemory();
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
      if (r.ok) { ta.value = ''; loadMemory(); }
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
