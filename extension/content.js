/* MagicLens content script（划词翻译 + 认识/生词标记 + 本地朗读 + OIDC 回调捕获）。
 * Why：UI 挂在 closed Shadow DOM 里与页面样式完全隔离；
 * 翻译/标记请求经 background 中转（content script fetch 受页面 CORS 约束）。 */

/* ---------- OIDC 登录回调捕获（v0.3） ----------
 * moon-well /auth/oidc/callback 成功时页面 body 即 Result{accessToken, refreshToken}
 * 的 JSON 文本：在此读出并写入 chrome.storage，用户全程无需手动填 Token。 */
(() => {
  if (location.hostname !== 'moon-well.haoshenqi.top'
    || location.pathname !== '/auth/oidc/callback') return;

  function banner(ok, message) {
    document.body.innerHTML = '';
    const style = document.createElement('style');
    style.textContent = 'body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;'
      + "font:16px/1.7 -apple-system,'PingFang SC','Segoe UI',sans-serif;background:#f8fafc;color:#1f2937;}"
      + '.card{padding:40px 48px;border-radius:16px;background:#fff;box-shadow:0 10px 40px rgba(0,0,0,.1);text-align:center;}'
      + 'h1{font-size:20px;margin:0 0 8px;} .ok{color:#059669;} .bad{color:#dc2626;} p{color:#6b7280;margin:0;}';
    const card = document.createElement('div');
    card.className = 'card';
    const h = document.createElement('h1');
    h.textContent = ok ? '✓ MagicLens 登录成功' : '✗ MagicLens 登录失败';
    h.className = ok ? 'ok' : 'bad';
    const p = document.createElement('p');
    p.textContent = ok ? '令牌已自动保存，本窗口稍后自动关闭。' : (message || '未获取到登录信息');
    card.append(h, p);
    document.head.appendChild(style);
    document.body.appendChild(card);
  }

  try {
    const payload = JSON.parse(document.body.innerText);
    if (payload && payload.success && payload.result && payload.result.accessToken) {
      chrome.storage.sync.set({
        token: payload.result.accessToken,
        refreshToken: payload.result.refreshToken || '',
      }, () => {
        banner(true);
        // 通知 options 页刷新登录状态；background 稍后关闭本标签
        chrome.runtime.sendMessage({ type: 'ml:login-ok' }, () => void chrome.runtime.lastError);
        setTimeout(() => { try { window.close(); } catch { /* 非脚本打开时静默 */ } }, 3000);
      });
      return;
    }
    banner(false, (payload && payload.message) || '未获取到登录信息');
  } catch (e) {
    banner(false, '回调页面解析失败：' + e.message);
  }
})();

(() => {
  if (window.__magicLensLoaded) return;
  window.__magicLensLoaded = true;

  const MAX_LEN = 2000; // moon-well /vocabulary/reading/translate 的文本长度上限

  const cfg = { enabled: true, autoTranslate: true };
  const syncCfg = () =>
    chrome.storage.sync.get({ enabled: true, autoTranslate: true }, (c) => Object.assign(cfg, c));
  syncCfg();
  chrome.storage.onChanged.addListener((_changes, area) => {
    if (area === 'sync') syncCfg();
  });

  /* ---------- UI（Shadow DOM） ---------- */
  const host = document.createElement('div');
  host.style.cssText = 'all:initial;';
  // Why id：page-extract/highlight 的排除逻辑按 #magiclens-host 识别自身 UI（v0.4.2 前漏挂，补上）
  host.id = 'magiclens-host';
  document.documentElement.appendChild(host);
  const shadow = host.attachShadow({ mode: 'closed' });
  shadow.innerHTML = `
    <style>
      :host { all: initial; }
      .card {
        position: fixed; display: none; z-index: 2147483647;
        max-width: 380px; min-width: 160px;
        background: #fff; color: #1f2937;
        border: 1px solid #e5e7eb; border-radius: 10px;
        box-shadow: 0 8px 28px rgba(0,0,0,.16);
        font: 13px/1.6 -apple-system, 'PingFang SC', 'Segoe UI', sans-serif;
        padding: 10px 12px;
      }
      .card.show { display: block; }
      .src { color: #9ca3af; max-height: 3.2em; overflow: hidden; margin-bottom: 4px; word-break: break-word; }
      .out { white-space: pre-wrap; word-break: break-word; }
      .msg { color: #111827; }
      .msg.err { color: #dc2626; }
      .spin {
        display: inline-block; width: 12px; height: 12px; margin-right: 6px; vertical-align: -1px;
        border: 2px solid #c7d2fe; border-top-color: #4f46e5; border-radius: 50%;
        animation: ml-spin .8s linear infinite;
      }
      @keyframes ml-spin { to { transform: rotate(360deg); } }
      /* Why：hidden 属性的 UA display:none 会被影子表单里任何显式 display（如 .spin 的
         inline-block）覆盖——spinner 一旦显示，setResult 的 elSpin.hidden=true 永远藏不掉，
         表现为「结果已渲染但转圈不停」。统一兜底所有用 hidden 收起的元素。 */
      [hidden] { display: none !important; }
      .actions { display: flex; gap: 6px; margin-top: 8px; align-items: center; }
      .actions button {
        all: unset; cursor: pointer; font: 12px/1 inherit; color: #4f46e5;
        background: #eef2ff; border-radius: 6px; padding: 4px 8px;
      }
      .actions button:hover { background: #e0e7ff; }
      .actions button.done { color: #059669; background: #d1fae5; cursor: default; }
      .actions .gap { flex: 1; }
      .cfg-link { color: #4f46e5; cursor: pointer; text-decoration: underline; }
      /* 单词详解面板（v0.4）：与划词气泡同 shadow，选中态独立展示 */
      .detail {
        position: fixed; display: none; z-index: 2147483647;
        width: 420px; max-width: calc(100vw - 16px);
        max-height: min(70vh, 560px); overflow-y: auto;
        background: #fff; color: #1f2937;
        border: 1px solid #e5e7eb; border-radius: 12px;
        box-shadow: 0 12px 40px rgba(0,0,0,.18);
        font: 13px/1.65 -apple-system, 'PingFang SC', 'Segoe UI', sans-serif;
        padding: 12px 14px;
      }
      .detail.show { display: block; }
      .d-head { display: flex; align-items: baseline; gap: 8px; }
      .d-word { font-size: 20px; font-weight: 700; color: #111827; }
      .d-tag {
        font-size: 11px; color: #92400e; background: #fef3c7;
        border-radius: 6px; padding: 1px 6px;
      }
      .d-close {
        all: unset; cursor: pointer; margin-left: auto;
        color: #9ca3af; font-size: 14px; padding: 0 4px;
      }
      .d-close:hover { color: #374151; }
      .d-variant { color: #b45309; font-size: 12px; margin: 2px 0 0; }
      .d-msg { color: #6b7280; padding: 10px 0 4px; }
      .d-msg.err { color: #dc2626; }
      .d-sec { margin-top: 12px; }
      .d-sec h3 {
        margin: 0 0 4px; font-size: 12px; color: #4f46e5;
        text-transform: none; letter-spacing: .02em;
      }
      .d-sec p { margin: 0; white-space: pre-wrap; word-break: break-word; }
      .d-sec ul { margin: 0; padding: 0; list-style: none; }
      .d-sec li { padding: 3px 0; border-bottom: 1px dashed #f3f4f6; word-break: break-word; }
      .d-sec li:last-child { border-bottom: none; }
      .d-pos { color: #6b7280; font-size: 12px; margin-right: 4px; }
      .d-en { color: #111827; }
      .d-note { color: #6b7280; }
      .d-chip { display: inline-block; margin: 2px 6px 2px 0; padding: 1px 8px;
        background: #f5f3ff; border-radius: 8px; font-size: 12px; }
      .d-chip b { font-weight: 600; }
      .d-chip.irr { background: #fef3c7; color: #92400e; }
    </style>
    <div class="card">
      <div class="src"></div>
      <div class="out"><span class="spin" hidden></span><span class="msg"></span></div>
      <div class="actions">
        <button data-act="translate" title="翻译选中文本">译</button>
        <button data-act="detail" title="单词详解（词源/搭配/变体等六板块）">详</button>
        <button data-act="speak" title="朗读原文（浏览器本地语音）">🔊</button>
        <button data-act="known" title="标记为已认识">认识</button>
        <button data-act="unknown" title="加入生词本">生词</button>
        <button data-act="ask" title="把选中内容发给伴读 AI">AI</button>
        <span class="gap"></span>
        <button data-act="close" title="关闭">✕</button>
      </div>
    </div>
    <div class="detail">
      <div class="d-head">
        <span class="d-word"></span>
        <span class="d-tag" hidden></span>
        <button class="d-close" data-act="d-close" title="关闭详解">✕</button>
      </div>
      <p class="d-variant" hidden></p>
      <div class="d-body"><div class="d-msg">加载中…</div></div>
    </div>`;
  const card = shadow.querySelector('.card');
  const elSrc = shadow.querySelector('.src');
  const elSpin = shadow.querySelector('.spin');
  const elMsg = shadow.querySelector('.msg');
  const btnKnown = shadow.querySelector('[data-act=known]');
  const btnUnknown = shadow.querySelector('[data-act=unknown]');
  // 单词详解面板（v0.4）
  const detail = shadow.querySelector('.detail');
  const elDWord = shadow.querySelector('.d-word');
  const elDTag = shadow.querySelector('.d-tag');
  const elDVariant = shadow.querySelector('.d-variant');
  const elDBody = shadow.querySelector('.d-body');

  let current = null; // { text, word }
  let detailSeq = 0;  // Why 序号：旧词的慢响应不得覆盖新词面板（缓存 miss 的词响应最慢）

  /* ---------- 孤儿上下文自处（R13「译」永久转圈的根因） ----------
   * Why：扩展重新加载/发版后，已打开标签页里的这份脚本副本上下文失效，
   * chrome.runtime.* 同步抛 "Extension context invalidated"；调用点不接住，
   * 气泡就永远停在「翻译中…」，而且请求根本没发出（后端零日志）。
   * 失效即退役：摘掉事件监听并移除自己的 UI——一份再也发不出请求的副本继续
   * 驻留在页面上只会制造「点了没反应」的死 UI，刷新页面后由新副本接管。 */
  let dormant = false;

  function retireOrphan() {
    dormant = true;
    document.removeEventListener('mouseup', onMouseUp, true);
    document.removeEventListener('mousedown', onMouseDown, true);
    document.removeEventListener('keydown', onKeyDown, true);
    window.removeEventListener('scroll', onScroll, { capture: true });
    host.remove();
    console.warn('[MagicLens] 扩展已更新，本页旧脚本退役；刷新页面（F5）后生效');
  }

  /** 统一的中转调用：上下文失效即退役，其余错误归一成 {ok:false,error} 交给调用方展示。 */
  function askBackground(msg, onResult) {
    if (dormant) return;
    // Why 同步抛与异步 lastError 走同一分类器：失效可能在发消息那一刻发生（throw），
    // 也可能发生在请求在途时扩展被重载（回调带 lastError）；两条路都不得把英文原文糊进气泡。
    const report = (message) => {
      if (/invalidated|disposed/i.test(message)) return void retireOrphan();
      onResult({ ok: false, error: message });
    };
    try {
      if (!chrome.runtime || !chrome.runtime.id) throw new Error('Extension context invalidated');
      chrome.runtime.sendMessage(msg, (resp) => {
        const lastErr = chrome.runtime.lastError;
        if (lastErr) return report(String((lastErr && lastErr.message) || lastErr));
        onResult(resp || { ok: false, error: '无响应' });
      });
    } catch (e) {
      report(String((e && e.message) || e));
    }
  }

  function hide() {
    // R19：详解面板与气泡生命周期解耦——收气泡不再收面板。
    // 面板仅由 ✕/Esc/新「详」查询关闭：生成要 15~30s，误关一次用户就白等一趟
    card.classList.remove('show');
    current = null;
    // R21：气泡来源（selection=划选/点词, hover=悬浮生词）；highlight.js 以此决定悬浮触发与收起
    window.__magicLensBubbleSource = null;
  }

  function show(anchor, source = 'selection') {
    card.classList.add('show');
    window.__magicLensBubbleSource = source;
    const r = card.getBoundingClientRect();
    const left = Math.min(Math.max(8, anchor.left), window.innerWidth - r.width - 8);
    let top = anchor.bottom + 8;
    if (top + r.height > window.innerHeight - 8) top = Math.max(8, anchor.top - r.height - 8);
    card.style.left = `${left}px`;
    card.style.top = `${top}px`;
  }

  function setLoading(text) {
    elSpin.hidden = false;
    elMsg.className = 'msg';
    elMsg.textContent = text || '翻译中…';
  }

  function setResult(translation, source) {
    elSpin.hidden = true;
    elMsg.className = 'msg';
    elMsg.textContent = translation;
    elMsg.title = source ? `来源：${source}` : '';
  }

  function setError(message, status) {
    elSpin.hidden = true;
    elMsg.className = 'msg err';
    elMsg.textContent = message;
    if (status === 401 || status === 403) {
      elMsg.textContent = '登录已失效，请 ';
      const link = document.createElement('span');
      link.className = 'cfg-link';
      link.textContent = '重新登录';
      link.addEventListener('click', () => askBackground({ type: 'ml:login' }, () => {}));
      elMsg.appendChild(link);
    }
  }

  /* ---------- 选区 ---------- */
  function selectionInfo() {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || sel.rangeCount === 0) return null;
    // Why：用户在扩展 UI 内划选/复制文本（气泡或详解面板）时不得触发新翻译流程
    const insideHost = (node) =>
      node && node.getRootNode && node.getRootNode() === shadow;
    if (insideHost(sel.anchorNode) || insideHost(sel.focusNode)) return null;
    const text = sel.toString().trim();
    if (!text) return null;
    const rect = sel.getRangeAt(0).getBoundingClientRect();
    const m = text.match(/^[A-Za-z][A-Za-z'\-]{0,40}/); // 生词标记只针对英文词
    return { text, rect, word: m ? m[0] : null };
  }

  function resetButtons() {
    btnKnown.textContent = '认识';
    btnKnown.classList.remove('done');
    btnUnknown.textContent = '生词';
    btnUnknown.classList.remove('done');
  }

  // Why 去重：点高亮词会两路触发本函数——mouseup 的 60ms 定时器 + highlight.js 的
  // click 处理器（程序化选中单词后立即调用）。同一选区 500ms 内只处理一次，
  // 避免重开气泡并重复发翻译请求
  let lastProc = { key: '', at: 0 };

  function processSelection() {
    if (!cfg.enabled) return;
    const info = selectionInfo();
    if (!info) return;
    const key = `${info.text}|${Math.round(info.rect.left)},${Math.round(info.rect.top)}`;
    const now = Date.now();
    if (key === lastProc.key && now - lastProc.at < 500) return;
    lastProc = { key, at: now };
    resetButtons();
    elSrc.textContent = info.text.length > 120 ? `${info.text.slice(0, 120)}…` : info.text;
    show({ left: info.rect.left, top: info.rect.top, bottom: info.rect.bottom });

    if (info.text.length > MAX_LEN) {
      current = null;
      setError(`选区过长（超过 ${MAX_LEN} 字符），请缩小选区`);
      return;
    }
    current = { text: info.text, word: info.word };
    if (cfg.autoTranslate) {
      translate();
    } else {
      setLoading('点击「译」开始翻译');
      elSpin.hidden = true;
    }
  }

  function translate() {
    if (!current) return;
    setLoading('翻译中…');
    askBackground({ type: 'ml:translate', text: current.text }, (resp) => {
      if (!current) return; // 气泡已关闭
      if (!resp.ok) return setError(resp.error || '翻译失败', resp.status);
      const data = resp.data || {};
      setResult(data.translation || '（空结果）', data.source);
    });
  }

  function mark(btn, known) {
    if (!current || !current.word) {
      setError('生词标记仅支持英文单词');
      return;
    }
    // Why 闭包捕获：响应到达前气泡可能已关闭（current=null 会抛错）或已换词
    //（会把新词传给高亮回写，页面点亮的是错的词），标记的词必须是按下按钮那一刻的词
    const word = current.word;
    btn.textContent = '…';
    askBackground({ type: 'ml:mark', word, known }, (resp) => {
      if (resp.ok) {
        btn.textContent = known ? '已认识 ✓' : '已入生词本 ✓';
        btn.classList.add('done');
        // 生词高亮（highlight.js）即时回写：标认识全页熄灭、标生词全页点亮（含常见变形）
        if (window.__magicLensOnMarked) window.__magicLensOnMarked(word, known);
      } else {
        btn.textContent = known ? '认识' : '生词';
        setError(resp.error || '标记失败', resp.status);
      }
    });
  }

  function speak() {
    if (!current || !('speechSynthesis' in window)) return;
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(current.text);
    u.lang = /^[\x00-\xFF]+$/.test(current.text) ? 'en-US' : 'zh-CN';
    speechSynthesis.speak(u);
  }

  /* ---------- 单词详解（v0.4，六板块：意思/词源/搭配/变体/同反义词/俚语冷知识） ---------- */
  // Why 全部 textContent 组装：详解内容来自 LLM，不进 innerHTML，杜绝注入
  const arr = (v) => (Array.isArray(v) ? v : []);

  function span(cls, text) {
    const s = document.createElement('span');
    if (cls) s.className = cls;
    s.textContent = text;
    return s;
  }

  function dSection(title) {
    const sec = document.createElement('div');
    sec.className = 'd-sec';
    const h = document.createElement('h3');
    h.textContent = title;
    const ul = document.createElement('ul');
    sec.append(h, ul);
    return { sec, ul };
  }

  function dLine(ul, build) {
    const li = document.createElement('li');
    build(li);
    ul.appendChild(li);
  }

  function positionDetail() {
    const r = detail.getBoundingClientRect();
    const cr = card.getBoundingClientRect();
    const left = Math.min(Math.max(8, cr.left), window.innerWidth - r.width - 8);
    let top = cr.bottom + 8;
    if (top + r.height > window.innerHeight - 8) top = Math.max(8, cr.top - r.height - 8);
    detail.style.left = `${left}px`;
    detail.style.top = `${top}px`;
  }

  function dError(message, status) {
    elDBody.innerHTML = '';
    const msg = document.createElement('div');
    msg.className = 'd-msg err';
    elDBody.appendChild(msg);
    if (status === 401 || status === 403) {
      msg.textContent = '登录已失效，请 ';
      const link = document.createElement('span');
      link.className = 'cfg-link';
      link.textContent = '重新登录';
      link.addEventListener('click', () => askBackground({ type: 'ml:login' }, () => {}));
      msg.appendChild(link);
    } else {
      msg.textContent = message;
      // R19：非鉴权失败（多为生成超时）面板不关，给出点击重试——后端已缓存
      // 部分结果或下次命中，重试代价远低于重新划词
      const retry = document.createElement('span');
      retry.className = 'cfg-link';
      retry.textContent = ' 点击重试';
      retry.addEventListener('click', () => {
        if (detailWord) {
          current = { text: detailWord, word: detailWord };
          openDetail();
        }
      });
      msg.appendChild(retry);
    }
  }

  function openDetail() {
    // 与生词标记同口径：详解只针对英文单词
    if (!current || !current.word) {
      setError('单词详解仅支持英文单词');
      return;
    }
    const seq = ++detailSeq;
    detailWord = current.word;
    detail.classList.add('show');
    elDWord.textContent = current.word;
    elDTag.hidden = true;
    elDVariant.hidden = true;
    elDBody.innerHTML = '';
    const loading = document.createElement('div');
    loading.className = 'd-msg';
    // R19：生成期间面板不会被误关，明确告知等待时长与自动显示
    loading.textContent = 'AI 正常生成中…（首次查询约 15~30 秒，完成后自动显示，期间可继续浏览网页）';
    elDBody.appendChild(loading);
    positionDetail();
    askBackground({ type: 'ml:detail', word: current.word }, (resp) => {
      if (seq !== detailSeq || !detail.classList.contains('show')) return; // 已换词或面板已关闭
      if (!resp.ok) return dError(resp.error || '详解加载失败', resp.status);
      renderDetail(resp.data || {});
    });
  }

  function renderDetail(d) {
    elDBody.innerHTML = '';
    elDWord.textContent = d.lemma || d.word || current.word;
    if (d.isVariant) {
      elDTag.hidden = false;
      elDTag.textContent = '变体';
      elDVariant.hidden = !d.variantNote;
      elDVariant.textContent = d.variantNote || '';
    }

    // 1 基本意思
    if (arr(d.meaning).length) {
      const { sec, ul } = dSection('基本意思');
      d.meaning.forEach((m) => dLine(ul, (li) => {
        if (m.pos) li.appendChild(span('d-pos', `【${m.pos}】`));
        li.appendChild(span('d-en', m.sense || ''));
        if (m.example) li.appendChild(span('d-note', `　${m.example}`));
      }));
      elDBody.appendChild(sec);
    }
    // 2 词源（重点板块）
    if (d.etymology) {
      const { sec, ul } = dSection('词源');
      dLine(ul, (li) => { li.textContent = d.etymology; });
      elDBody.appendChild(sec);
    }
    // 3 固定搭配 / 常见用法 / 习语
    if (arr(d.phrases).length) {
      const { sec, ul } = dSection('搭配 · 用法 · 习语');
      d.phrases.forEach((p) => dLine(ul, (li) => {
        if (p.kind) li.appendChild(span('d-pos', `【${p.kind}】`));
        li.appendChild(span('d-en', p.phrase || ''));
        if (p.meaning) li.appendChild(span('d-note', `　${p.meaning}`));
        if (p.example) li.appendChild(span('d-note', `　${p.example}`));
      }));
      elDBody.appendChild(sec);
    }
    // 4 变体与衍生词（不规则变化高亮）
    if (arr(d.forms).length) {
      const { sec, ul } = dSection('变体与衍生词');
      dLine(ul, (li) => {
        d.forms.forEach((f) => {
          const chip = span(f.irregular ? 'd-chip irr' : 'd-chip', '');
          const b = document.createElement('b');
          b.textContent = f.form || '';
          chip.appendChild(b);
          if (f.type) chip.appendChild(document.createTextNode(` ${f.type}`));
          li.appendChild(chip);
        });
      });
      elDBody.appendChild(sec);
    }
    // 5 同义词 / 反义词
    const wordSection = (title, list) => {
      const { sec, ul } = dSection(title);
      list.forEach((w) => dLine(ul, (li) => {
        li.appendChild(span('d-en', w.word || ''));
        if (w.note) li.appendChild(span('d-note', `　${w.note}`));
      }));
      elDBody.appendChild(sec);
    };
    if (arr(d.synonyms).length) wordSection('同义词', d.synonyms);
    if (arr(d.antonyms).length) wordSection('反义词', d.antonyms);
    // 6 俚语 / 冷知识
    if (arr(d.slang).length) {
      const { sec, ul } = dSection('俚语与非正式用法');
      d.slang.forEach((s) => dLine(ul, (li) => {
        li.appendChild(span('d-en', s.meaning || ''));
        if (s.example) li.appendChild(span('d-note', `　${s.example}`));
      }));
      elDBody.appendChild(sec);
    }
    if (arr(d.funFacts).length) {
      const { sec, ul } = dSection('冷知识');
      d.funFacts.forEach((t) => dLine(ul, (li) => { li.textContent = t; }));
      elDBody.appendChild(sec);
    }

    if (!elDBody.childElementCount) {
      const msg = document.createElement('div');
      msg.className = 'd-msg';
      msg.textContent = '（暂无详解内容）';
      elDBody.appendChild(msg);
    }
    positionDetail(); // 内容撑开面板后重新定位
  }

  /* ---------- 事件 ---------- */
  // 生词高亮点词交互（highlight.js）复用划词流程：程序化选中单词后走同一气泡链路
  window.__magicLensProcessSelection = processSelection;

  // R21 悬浮生词即显气泡（highlight.js 悬停命中后调用）：不开真实选区——部分页面元素
  // 点击会跳转，且程序化选中会覆盖用户已有选区；仅按悬浮词打开气泡，按钮全部照常工作
  window.__magicLensShowWordBubble = (word, anchor) => {
    if (!cfg.enabled || !word || !anchor) return;
    resetButtons();
    elSrc.textContent = word;
    show(anchor, 'hover');
    current = { text: word, word };
    if (cfg.autoTranslate) {
      translate();
    } else {
      setLoading('点击「译」开始翻译');
      elSpin.hidden = true;
    }
  };
  // 悬浮离开（highlight.js 宽限到期调用）：只收「悬浮打开」的气泡，不动划选的气泡
  window.__magicLensHoverLeave = () => {
    if (window.__magicLensBubbleSource === 'hover') hide();
  };

  shadow.addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    const act = btn.dataset.act;
    if (act === 'close') {
      // Why 取消选中：✕ 的 mouseup 已排下 60ms 后的 processSelection，残留选区
      // 会在去重窗外让气泡立刻复活，表现为「点了关闭但弹框又弹回来」
      const sel = window.getSelection();
      if (sel) sel.removeAllRanges();
      hide();
    }
    else if (act === 'd-close') detail.classList.remove('show');
    else if (act === 'translate') translate();
    else if (act === 'detail') openDetail();
    else if (act === 'speak') speak();
    else if (act === 'known') mark(btn, true);
    else if (act === 'unknown') mark(btn, false);
    else if (act === 'ask') {
      // 「问 AI」：把选中文本带进伴读抽屉（chat.js 同隔离世界，经隔离世界全局钩子）
      const text = current ? current.text : '';
      hide();
      if (window.__magicLensAsk) window.__magicLensAsk(text);
    }
  });

  // mouseup 后延迟一帧等待选区稳定；dblclick 选词后也会触发 mouseup
  // Why 具名 handler：孤儿副本退役时要能摘掉自己的监听（见 retireOrphan），
  // 匿名箭头函数无法 remove，摘不掉的监听会在页面上留一个「点了没反应」的幽灵气泡
  const onMouseUp = () => setTimeout(processSelection, 60);
  const onMouseDown = (e) => {
    if (!e.composedPath().includes(host)) hide();
  };
  const onKeyDown = (e) => {
    if (e.key !== 'Escape') return;
    // R19 分层退出：详解面板是最表层，Esc 只关它；面板没开才收划词气泡
    if (detail.classList.contains('show')) {
      detail.classList.remove('show');
      return;
    }
    hide();
  };
  const onScroll = (e) => {
    // R19：滚动不再关闭详解面板（生成等待期用户很可能滚动页面），
    // 面板固定留原地可继续阅读或 ✕ 关闭；气泡维持原有关闭行为
    // R21：改为复用 hide()——语义一致且同步清气泡来源标记
    if (e.target && e.composedPath && e.composedPath().includes(host)) return;
    hide();
  };
  document.addEventListener('mouseup', onMouseUp, true);
  document.addEventListener('mousedown', onMouseDown, true);
  document.addEventListener('keydown', onKeyDown, true);
  window.addEventListener('scroll', onScroll, { passive: true, capture: true });
})();
