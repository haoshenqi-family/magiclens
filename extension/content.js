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

  function hide() {
    card.classList.remove('show');
    detail.classList.remove('show');
    current = null;
  }

  function show(anchor) {
    card.classList.add('show');
    detail.classList.remove('show'); // 新选区重开气泡时收起旧详解
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
      link.addEventListener('click', () => chrome.runtime.sendMessage({ type: 'ml:login' }));
      elMsg.appendChild(link);
    }
  }

  /* ---------- 选区 ---------- */
  function selectionInfo() {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || sel.rangeCount === 0) return null;
    // Why：用户在详解面板内划选/复制例句时不得触发新翻译流程（会误关面板）
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

  function processSelection() {
    if (!cfg.enabled) return;
    const info = selectionInfo();
    if (!info) return;
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
    chrome.runtime.sendMessage({ type: 'ml:translate', text: current.text }, (resp) => {
      if (!current) return; // 气泡已关闭
      if (chrome.runtime.lastError) return setError(chrome.runtime.lastError.message);
      if (!resp || !resp.ok) return setError((resp && resp.error) || '翻译失败', resp && resp.status);
      const data = resp.data || {};
      setResult(data.translation || '（空结果）', data.source);
    });
  }

  function mark(btn, known) {
    if (!current || !current.word) {
      setError('生词标记仅支持英文单词');
      return;
    }
    btn.textContent = '…';
    chrome.runtime.sendMessage({ type: 'ml:mark', word: current.word, known }, (resp) => {
      if (resp && resp.ok) {
        btn.textContent = known ? '已认识 ✓' : '已入生词本 ✓';
        btn.classList.add('done');
      } else {
        btn.textContent = known ? '认识' : '生词';
        setError((resp && resp.error) || '标记失败', resp && resp.status);
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
      link.addEventListener('click', () => chrome.runtime.sendMessage({ type: 'ml:login' }));
      msg.appendChild(link);
    } else {
      msg.textContent = message;
    }
  }

  function openDetail() {
    // 与生词标记同口径：详解只针对英文单词
    if (!current || !current.word) {
      setError('单词详解仅支持英文单词');
      return;
    }
    const seq = ++detailSeq;
    detail.classList.add('show');
    elDWord.textContent = current.word;
    elDTag.hidden = true;
    elDVariant.hidden = true;
    elDBody.innerHTML = '';
    const loading = document.createElement('div');
    loading.className = 'd-msg';
    loading.textContent = '详解加载中…（首次查询生词需在线生成，稍慢）';
    elDBody.appendChild(loading);
    positionDetail();
    chrome.runtime.sendMessage({ type: 'ml:detail', word: current.word }, (resp) => {
      if (seq !== detailSeq || !detail.classList.contains('show')) return; // 已换词或面板已关闭
      if (chrome.runtime.lastError) return dError(chrome.runtime.lastError.message);
      if (!resp || !resp.ok) return dError((resp && resp.error) || '详解加载失败', resp && resp.status);
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
  shadow.addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    const act = btn.dataset.act;
    if (act === 'close') hide();
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
  document.addEventListener('mouseup', () => setTimeout(processSelection, 60), true);
  document.addEventListener('mousedown', (e) => {
    if (!e.composedPath().includes(host)) hide();
  }, true);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') hide();
  }, true);
  window.addEventListener('scroll', (e) => {
    // 详解面板自身可滚动：目标在扩展 UI 内的滚动不触发关闭
    if (e.target && e.composedPath && e.composedPath().includes(host)) return;
    hide();
  }, { passive: true, capture: true });
})();
