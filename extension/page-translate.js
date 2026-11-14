/* MagicLens 段落整页翻译（R67，P1 收尾项——design.md §5「剩段落整页翻译（translate-batch）」）。
 *
 * 把 magicbook 阅读器的段落翻译带到任意网页：开/关切换 → 发现正文段落 → 进入视口才请求
 * （IntersectionObserver 懒加载，计费敏感故绝不自动整页）→ 攒批 8 段一次请求
 *（服务端把 miss 段合并为一次 LLM 调用：8 段 1 积分 vs 逐段 8 积分）→ 译文以
 * 内联样式兄弟块插在原段下方（textContent-only，永不 innerHTML）。
 *
 * 架构口径（与既有引擎同构）：
 *  - 多文档：顶层 + 同源 iframe ≤2 层经 contentDocument 伸手（highlight.js collectDocs
 *    同款，design.md §12 L165 口径），跨源 iframe 不做；iframe 内监听挂在各文档上。
 *  - UI：状态 chip 挂 closed Shadow DOM（#magiclens-pt-host）；译文块是内容性插入，
 *    不属「UI 面板」——用内联 style 自包含，不注入全局样式表、不污染 window
 *   （AGENTS.md §0.2 禁的是全局样式与 window 污染；magicbook 阅读器阅读翻译同款形态）。
 *  - 消息：ML_TRANSLATE_BATCH 经 background 中转（callApi 60s）；ML_PT_TOGGLE 两条入口
 *    （悬浮球经 SW 转发、popup 直发 tabs.sendMessage）同落本文件的 onMessage。
 *  - 生命周期：storage.onChanged 联动主开关、rpc onInvalidated 失效自清理、
 *    bfcache pageshow 重建文档绑定——三件与 highlight/content/ball 同模式。
 *
 * 计费与缓存：服务端 ES 缓存（SHA-256(trim 文本)）命中仍计 1 积分/段，故页内再挂一层
 * 内存缓存（toggle 循环零请求零计费）；失败译文两端都不缓存，重开开关即重试。
 */
(() => {
  if (window.__magicLensPageTranslateLoaded) return;
  window.__magicLensPageTranslateLoaded = true;

  const MSG = __magicLensRpc.MSG;

  /* ---------- 常量（口径来源见各行 Why） ---------- */
  const BATCH = 8;           // 每次请求最多 8 段：服务端上限 20，但 8×数百字符一般 <20s，60s 超时留足余量
  const FLUSH_DEBOUNCE = 800; // 未攒满也发：懒加载场景段是随滚动陆续进入视口的，等满批会显得迟钝
  const MAX_ACTIVATION = 100; // 每次开启的请求段数上限（计费护栏；页内缓存命中不计数）
  const MIN_CHARS = 40;      // <40 字符的多是导航/按钮/页脚噪声（page-extract 的 2 字下限是给 LLM 上下文的，这里直接渲染要更严）
  const CJK_RATIO_MAX = 0.3; // 中文占比过高的段落翻译无意义（目标用户在读英文网页）
  const IO_ROOT_MARGIN = '400px 0px'; // 比高亮（200px）更宽：翻译是整段请求，提前起批减少滚动等待感

  // 沿用 page-extract.js 的块级标签集（Why 不含 SPAN：行内噪声大），PRE 剔除——代码块不该被翻译
  const TEXT_TAGS = 'P,LI,BLOCKQUOTE,TD,TH,DD,DT,H1,H2,H3,H4,H5,H6';

  /* ---------- 状态 ---------- */
  let siteDisabled = false;   // 域名管理禁用：与高亮同口径，写死在本页生命周期内（刷新生效）
  let cfg = { enabled: true };
  let active = false;         // 本页本次开启状态（按页临时态，无全局设置键）
  let docs = new Map();       // Document → {doc, win, io, mo, listeners[], rescanTimer}
  let records = new Map();    // Element → {el, doc, text, state, node}
  let pending = [];           // 待请求队列（records 引用，攒批用）
  let flushTimer = null;
  let inflight = false;       // 单飞行：一次只发一个批量请求，顺序完成
  let scheduled = 0;          // 本次开启已请求段数（计费护栏计数）
  let translatedCount = 0;    // 已渲染段数（chip 进度）
  const sessionCache = new Map(); // 归一化文本 → 译文（页内 toggle 循环零计费；刷新即清，服务端 ES 缓存为权威）

  const PT_HOST_ID = 'magiclens-pt-host';
  let host = null;            // chip 的 shadow host
  let chipParts = null;       // {status, done, close, error, retryLink}

  /* ---------- 段落发现 ---------- */
  const CJK_RE = /[\u3400-\u9fff\uf900-\ufaff]/g;

  function visible(win, el) {
    const r = el.getBoundingClientRect();
    if (r.width < 40 || r.height < 8) return false;
    // Why 用 el 所属文档的 window 取 computed style：模块只执行一次（顶层隔离世界），
    // 裸 getComputedStyle 恒是顶层 window，iframe 段落会拿错视口关联
    const s = win.getComputedStyle(el);
    if (s.visibility === 'hidden' || s.display === 'none' || parseFloat(s.opacity) < 0.1) return false;
    return true;
  }

  /** 段落文本是否够格翻译：够长、非中文主导、页面级去重。返回归一化文本或 null */
  function paragraphText(el, seen) {
    if (el.closest('pre, code, [contenteditable], [data-magiclens-translation]')) return null;
    if (el.closest('#magiclens-host, #magiclens-chat-host, #magiclens-ball-host, #magiclens-pt-host')) return null;
    if (records.has(el)) return null;
    const text = (el.innerText || '').replace(/\s+/g, ' ').trim();
    if (text.length < MIN_CHARS) return null;
    const cjk = (text.match(CJK_RE) || []).length;
    if (cjk / text.length > CJK_RATIO_MAX) return null;
    if (seen.has(text)) return null;
    seen.add(text);
    return text;
  }

  /** 列出待绑文档：顶层 + 同源 iframe ≤2 层（highlight.js collectDocs 同款） */
  function collectDocs() {
    const entries = [{ doc: document, win: window, iframeEls: [] }];
    const walk = (doc, depth, iframeEls) => {
      if (depth >= 2) return;
      for (const f of doc.querySelectorAll('iframe')) {
        try {
          const d = f.contentDocument;
          if (d) {
            const next = [...iframeEls, f];
            entries.push({ doc: d, win: f.contentWindow, iframeEls: next });
            walk(d, depth + 1, next);
          }
        } catch { /* 跨源/沙箱：跳过 */ }
      }
    };
    walk(document, 0, []);
    return entries;
  }

  function rescanDoc(st) {
    if (!active || !st.doc.body) return;
    const seen = new Set();
    const walker = st.doc.createTreeWalker(
      st.doc.body, NodeFilter.SHOW_ELEMENT,
      { acceptNode: (el) => (el.matches(TEXT_TAGS) && visible(st.win, el) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT) }
    );
    const found = [];
    while (walker.nextNode()) {
      const el = walker.currentNode;
      const text = paragraphText(el, seen);
      if (text) found.push({ el, doc: st.doc, text });
    }
    for (const item of found) {
      const rec = { el: item.el, doc: item.doc, text: item.text, state: 'idle', node: null };
      records.set(item.el, rec);
      try { st.io.observe(item.el); } catch { /* 文档已死 */ }
    }
  }

  const rescanDocDebounced = (st) => {
    if (st.rescanTimer) clearTimeout(st.rescanTimer);
    st.rescanTimer = setTimeout(() => { st.rescanTimer = null; rescanDoc(st); }, FLUSH_DEBOUNCE);
  };

  /* ---------- 文档绑定/解绑 ---------- */
  function setupDoc(entry) {
    const st = { doc: entry.doc, win: entry.win, io: null, mo: null, listeners: [], rescanTimer: null };
    // Why 每文档一份 IO：IntersectionObserver 的 rootMargin 相对「所在文档视口」，
    // iframe 段落必须用 iframe 自己的视口判交（与 highlight.js 同因）
    st.io = new st.win.IntersectionObserver((entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        const rec = records.get(e.target);
        if (!rec || rec.state !== 'idle') continue;
        enqueue(rec);
      }
    }, { rootMargin: IO_ROOT_MARGIN });

    // Why per-doc MO：SPA 动态段落与 epub 翻章晚渲染都要增量发现（highlight.js 同因）
    st.mo = new MutationObserver(() => rescanDocDebounced(st));
    st.mo.observe(st.doc.body || st.doc.documentElement || st.doc, { childList: true, subtree: true, characterData: true });

    // Why iframe load：翻章换 contentDocument 时 iframe 元素不动，靠 load 重建发现
    for (const f of entry.iframeEls) {
      const onLoad = () => rescanDocDebounced(st);
      f.addEventListener('load', onLoad);
      st.listeners.push({ target: f, type: 'load', fn: onLoad });
    }
    return st;
  }

  function teardownDocs() {
    for (const st of docs.values()) {
      try { if (st.io) st.io.disconnect(); } catch { /* 已随文档销毁 */ }
      try { if (st.mo) st.mo.disconnect(); } catch { /* 已随文档销毁 */ }
      if (st.rescanTimer) clearTimeout(st.rescanTimer);
      for (const { target, type, fn } of st.listeners) target.removeEventListener(type, fn);
    }
    docs.clear();
  }

  /* ---------- 攒批请求 ---------- */
  function enqueue(rec) {
    // 页内缓存命中：直接渲染、零请求零计费（toggle 循环与服务端 ES 缓存命中的双层省钱）
    const cached = sessionCache.get(rec.text);
    if (cached !== undefined) {
      rec.state = 'done';
      fillBlock(rec, cached);
      translatedCount += 1;
      updateChip();
      return;
    }
    if (scheduled >= MAX_ACTIVATION) return; // 护栏满：不再排队（chip 提示），已入队批次照常完成
    scheduled += 1;
    rec.state = 'pending';
    pending.push(rec);
    updateChip();
    if (pending.length >= BATCH) {
      flushNow();
    } else if (!flushTimer && !inflight) {
      flushTimer = setTimeout(flushNow, FLUSH_DEBOUNCE);
    }
    // inflight 时不用另起 timer：请求完成后会检查 pending 续发
  }

  function flushNow() {
    if (inflight) return;
    if (flushTimer) { clearTimeout(flushTimer); flushTimer = null; }
    if (!pending.length) return;
    const batch = pending.splice(0, BATCH);
    inflight = true;
    // 请求前先落「翻译中」占位：长批次下用户能立刻看到这一段在动
    for (const rec of batch) {
      rec.state = 'loading';
      if (!rec.node) rec.node = renderBlock(rec, null, true);
    }
    sendBatch(batch);
  }

  function sendBatch(batch) {
    const msg = {
      type: MSG.ML_TRANSLATE_BATCH,
      paragraphs: batch.map((r) => r.text),
      bookName: location.hostname.slice(0, 200),      // 与 analyze 同口径：host 作书名、路径作章节（服务端各截 200）
      chapter: (location.pathname + location.search).slice(0, 200),
    };
    __magicLensRpc.send(msg, (resp, err) => {
      inflight = false;
      // Why 先于一切：stop() 后的在途回包若继续走 fill/remove，会把译文块重新插回已关闭的页面
      if (!active) return;
      const error = err || (resp && !resp.ok ? resp.error : null);
      if (error) {
        // 整批失败：摘掉占位块（失败不缓存，重开开关即重试），chip 给可行动文案
        for (const rec of batch) {
          rec.state = 'failed';
          if (rec.node) { rec.node.remove(); rec.node = null; }
        }
        showChipError(__magicLensUserFacingError(error, '翻译失败，请稍后重试'), resp && resp.auth);
      } else {
        const list = Array.isArray(resp.data) ? resp.data : [];
        batch.forEach((rec, i) => {
          const t = String(list[i] || '').trim();
          if (!t) { rec.state = 'failed'; if (rec.node) { rec.node.remove(); rec.node = null; } return; }
          rec.state = 'done';
          sessionCache.set(rec.text, t);
          fillBlock(rec, t);
          translatedCount += 1;
        });
        clearChipError();
        updateChip();
      }
      // 续发：单飞行队列，完成一条再看下一条（满批立即发，零散的走防抖）
      if (pending.length >= BATCH) flushNow();
      else if (pending.length && !flushTimer) flushTimer = setTimeout(flushNow, FLUSH_DEBOUNCE);
    });
  }

  /* ---------- 译文渲染 ---------- */
  /** Why LI/TD/TH/DD/DT 插在元素内部：表格外层是 ul/tr，兄弟位放 div 是非法结构；
   * 块级容器（P/H 标签/BLOCKQUOTE）才走 afterend（与 magicbook 阅读器同款） */
  function insertInto(el, div) {
    if (/^(LI|TD|TH|DD|DT)$/.test(el.tagName)) el.appendChild(div);
    else el.insertAdjacentElement('afterend', div);
    return div;
  }

  function renderBlock(rec, text, loading) {
    const doc = rec.el.ownerDocument;
    const div = doc.createElement('div');
    div.setAttribute('data-magiclens-translation', ''); // 高亮/划词/本模块发现的三处排除标记
    div.style.cssText = 'margin:4px 0 12px;padding-left:10px;border-left:2px solid #c7d2fe;'
      + 'font-size:0.92em;line-height:1.7;color:#6b7280;white-space:pre-wrap;';
    if (loading) {
      div.textContent = '翻译中…';
      div.style.color = '#9ca3af';
    } else if (text) {
      div.textContent = text;
    }
    return insertInto(rec.el, div);
  }

  function fillBlock(rec, text) {
    if (rec.node) {
      rec.node.textContent = text;
      rec.node.style.color = '#6b7280';
    } else {
      rec.node = renderBlock(rec, text, false);
    }
  }

  function removeAllBlocks() {
    for (const rec of records.values()) {
      if (rec.node) { rec.node.remove(); rec.node = null; }
    }
  }

  /* ---------- 状态 chip（closed Shadow DOM） ---------- */
  function buildChip() {
    if (host) return;
    host = document.createElement('div');
    host.id = PT_HOST_ID;
    const shadow = host.attachShadow({ mode: 'closed' });
    const style = document.createElement('style');
    style.textContent = `
      :host { all: initial; }
      * { box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
      .chip { position: fixed; left: 16px; bottom: 16px; z-index: 2147483644;
        display: flex; align-items: center; gap: 8px; max-width: 60vw;
        background: rgba(17, 24, 39, .88); color: #e5e7eb; border-radius: 999px;
        padding: 7px 8px 7px 14px; font-size: 12px; line-height: 1.4;
        box-shadow: 0 4px 12px rgba(0,0,0,.25); }
      .close { all: unset; cursor: pointer; color: #9ca3af; font-size: 14px; padding: 0 6px; }
      .close:hover { color: #e5e7eb; }
      .err { position: fixed; left: 16px; bottom: 52px; z-index: 2147483644; max-width: 60vw;
        background: rgba(127, 29, 29, .92); color: #fecaca; border-radius: 8px;
        padding: 7px 12px; font-size: 12px; line-height: 1.5; }
      .err a { color: #fca5a5; cursor: pointer; text-decoration: underline; }`;
    shadow.appendChild(style);
    const chip = document.createElement('div');
    chip.className = 'chip';
    const status = document.createElement('span');
    status.textContent = '段落翻译';
    const close = document.createElement('button');
    close.className = 'close';
    close.textContent = '✕';
    close.title = '关闭整页翻译';
    close.addEventListener('click', () => toggle());
    chip.append(status, close);
    const err = document.createElement('div');
    err.className = 'err';
    err.hidden = true;
    shadow.append(chip, err);
    document.documentElement.appendChild(host);
    chipParts = { status, error: err };
  }

  function updateChip() {
    if (!host || !chipParts) return;
    let text = scheduled >= MAX_ACTIVATION
      ? `段落翻译 · 已译 ${translatedCount} 段（达本页上限 ${MAX_ACTIVATION} 段）`
      : `段落翻译 · 已译 ${translatedCount} 段`;
    if (inflight || pending.length) text += `，进行中 ${pending.length + (inflight ? BATCH : 0)} 段`;
    chipParts.status.textContent = text;
  }

  function showChipError(message, auth) {
    if (!host || !chipParts) return;
    chipParts.error.textContent = '';
    const span = document.createElement('span');
    span.textContent = message;
    chipParts.error.append(span);
    if (auth) {
      // 与 content.js setError 同款：401/403 给内联「重新登录」入口
      const link = document.createElement('a');
      link.textContent = '重新登录';
      link.addEventListener('click', () => __magicLensRpc.send({ type: MSG.ML_LOGIN }, () => void chrome.runtime.lastError));
      chipParts.error.append(' ', link);
    }
    chipParts.error.hidden = false;
  }

  function clearChipError() {
    if (host && chipParts) chipParts.error.hidden = true;
  }

  /* ---------- 开/关 ---------- */
  function start() {
    if (active) return;
    active = true;
    scheduled = 0;
    translatedCount = 0;
    records.clear();
    pending = [];
    buildChip();
    clearChipError();
    updateChip();
    // 逐文档绑定 + 首扫：IO observe 的初始回调会立刻为视口内段落起批
    for (const entry of collectDocs()) {
      const st = setupDoc(entry);
      docs.set(entry.doc, st);
      rescanDoc(st);
    }
  }

  function stop() {
    if (!active) return;
    active = false;
    teardownDocs();
    if (flushTimer) { clearTimeout(flushTimer); flushTimer = null; }
    pending = [];
    inflight = false; // 在途回包回来时 active=false，fill/remove 前有 active 守卫
    removeAllBlocks();
    records.clear();
    if (host) { host.remove(); host = null; chipParts = null; }
  }

  function toggle() {
    if (siteDisabled) return { ok: false, error: '本站已在域名管理中禁用，恢复后刷新生效' };
    if (!cfg.enabled) return { ok: false, error: '划词翻译总开关已关闭，请先在 popup 开启' };
    if (active) stop(); else start();
    return { ok: true, active };
  }

  // 供两个入口与 bfcache 恢复共用的唯一开关路径
  window.__magicLensPageTranslateToggle = toggle;

  /* ---------- 入口消息：popup 直发 / 悬浮球经 SW 转发，同落此处 ---------- */
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (!msg || msg.type !== MSG.ML_PT_TOGGLE) return;
    sendResponse(toggle());
  });

  /* ---------- 生命周期 ---------- */
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'sync') return;
    if (changes.enabled) {
      cfg.enabled = changes.enabled.newValue;
      // 总开关关闭时整页翻译一并停（与 highlight.js teardown 联动同语义）
      if (!cfg.enabled && active) stop();
    }
  });

  window.addEventListener('pageshow', (e) => {
    // bfcache 恢复：IO/MO 可能失效，重建文档绑定；records 与译文块随堆存活，
    // 重扫按 records 去重不会二次插入（已译段落零请求零计费）
    if (e.persisted && active) {
      teardownDocs();
      for (const entry of collectDocs()) {
        const st = setupDoc(entry);
        docs.set(entry.doc, st);
        rescanDoc(st);
      }
    }
  });

  __magicLensRpc.onInvalidated(() => {
    // 扩展重载孤儿页：摘掉 chip 与译文块、停监听（与 content retireOrphan 同语义）
    try { stop(); } catch { /* 文档已死时尽力而为 */ }
  });

  /* ---------- 启动 ---------- */
  chrome.storage.sync.get(__magicLensDefaults, (c) => {
    siteDisabled = window.__magicLensIsDisabledHost(location.hostname, c.disabledDomains);
    cfg.enabled = c.enabled !== false;
    // 能力握手（与 data-magiclens-highlight / data-magiclens-selection 同模式）：popup/ball
    // 直发 tabs.sendMessage 依赖本监听已就位，标记给出「装了 ≠ 通」的显式探针
    document.documentElement.dataset.magiclensPageTranslate = '1';
  });
})();
