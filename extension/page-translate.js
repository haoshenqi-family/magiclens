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
 *  - 快捷键（R71）：顶层文档 keydown（capture）分发两条——整页开关（默认 Alt+A，与
 *    沉浸式翻译一致）与悬停单段翻译（默认 Alt+P，翻译/撤销鼠标所在段落）；键位串存
 *    chrome.storage.sync（e.code 形制，common.js 三件套），设置页「快捷键」节可录制。
 *    边界：编辑态输入框不触发（mac 死键字符不搞双重效果）、域名禁用站静默、
 *    iframe 内聚焦不响应（单段只认顶层文档段落）。
 *  - 别名触发（R72，对齐沉浸式习惯）：双击 Alt（Mac 双击 ⌥，≤500ms）同切整页开关；
 *    按住 Shift 悬停到合格段落即翻译该段（复用 Alt+P 状态机，沉浸式选 Shift 正是为
 *    避开 mac Option 死键）。两个别名固定不可改键，不进 storage。
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
  let cfg = {
    enabled: true,
    // R71 快捷键键位串（common.js __magicLensDefaults 单点）：'' = 禁用该键
    shortcutPageToggle: 'Alt+KeyA',
    shortcutParagraph: 'Alt+KeyP',
  };
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
  let host = null;            // chip/提示条共用的 shadow host
  let shadowDom = null;       // closed shadow 根的持引（host.shadowRoot 对 closed 恒 null，不可回查）
  let chipRow = null;         // 活跃态进度行（active 时才建；{status, close}）
  let errBox = null;          // 错误/提示条（host 在即可用，inactive 时的快捷键反馈走这里）
  let hintTimer = null;       // inactive 提示条的自动消隐定时器
  let lastX = -1;             // R71 鼠标锚点（悬停单段翻译用；顶层文档坐标）
  let lastY = -1;

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

  const normalizeText = (el) => (el.innerText || '').replace(/\s+/g, ' ').trim();

  /** 段落资格（不含 records 查重）：互斥标记（代码块/编辑器/扩展自建 UI）+ 够长 + 非中文主导。
   * Why 拆出纯资格判定：整页发现（records 查重+页面去重）与 R71 单段快捷键（自行管理
   * 已录段落）共用同一门槛，两条入口的资格口径永不漂移。 */
  function qualifies(el, text) {
    if (el.closest('pre, code, [contenteditable], [data-magiclens-translation]')) return false;
    if (el.closest('#magiclens-host, #magiclens-chat-host, #magiclens-ball-host, #magiclens-pt-host')) return false;
    if (text.length < MIN_CHARS) return false;
    const cjk = (text.match(CJK_RE) || []).length;
    return cjk / text.length <= CJK_RATIO_MAX;
  }

  /** 段落文本是否够格翻译：资格 + 页面级去重。返回归一化文本或 null */
  function paragraphText(el, seen) {
    if (records.has(el)) return null;
    const text = normalizeText(el);
    if (!qualifies(el, text)) return null;
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

  /* ---------- 状态 chip（closed Shadow DOM） ----------
   * host/errBox 与 chipRow 分层：错误提示在未开启时也要能出现（R71 快捷键的
   * 「未找到段落/总开关关闭」反馈），进度行（含 ✕=关闭整页翻译）只在 active 时存在。 */
  function ensureHost() {
    if (host) return;
    host = document.createElement('div');
    host.id = PT_HOST_ID;
    const shadow = host.attachShadow({ mode: 'closed' });
    shadowDom = shadow;
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
    const err = document.createElement('div');
    err.className = 'err';
    err.hidden = true;
    shadow.appendChild(err);
    errBox = err;
    document.documentElement.appendChild(host);
  }

  function buildChip() {
    ensureHost();
    if (chipRow) return;
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
    shadowDom.insertBefore(chip, errBox);
    chipRow = { status, close };
  }

  function updateChip() {
    if (!chipRow) return;
    let text = scheduled >= MAX_ACTIVATION
      ? `段落翻译 · 已译 ${translatedCount} 段（达本页上限 ${MAX_ACTIVATION} 段）`
      : `段落翻译 · 已译 ${translatedCount} 段`;
    if (inflight || pending.length) text += `，进行中 ${pending.length + (inflight ? BATCH : 0)} 段`;
    chipRow.status.textContent = text;
  }

  function showChipError(message, auth) {
    ensureHost();
    errBox.textContent = '';
    const span = document.createElement('span');
    span.textContent = message;
    errBox.append(span);
    if (auth) {
      // 与 content.js setError 同款：401/403 给内联「重新登录」入口
      const link = document.createElement('a');
      link.textContent = '重新登录';
      link.addEventListener('click', () => __magicLensRpc.send({ type: MSG.ML_LOGIN }, () => void chrome.runtime.lastError));
      errBox.append(' ', link);
    }
    errBox.hidden = false;
  }

  function clearChipError() {
    if (errBox) errBox.hidden = true;
  }

  /** R71 快捷键反馈：active 时走既有错误条（下次成功自动清）；inactive 时临时提示
   * 4s 自动消隐——不建进度行（✕ 的「关闭整页翻译」语义只在开启态成立） */
  function hint(message) {
    showChipError(message);
    if (hintTimer) clearTimeout(hintTimer);
    hintTimer = active ? null : setTimeout(() => {
      hintTimer = null;
      if (errBox) errBox.hidden = true;
    }, 4000);
  }

  /* ---------- 开/关 ---------- */
  /** discover=false：R71 单段保底开启——只建 chip 不做全页发现。Why 必须跳过：
   * 全页发现会给视口内段落起批，单段诉求被放大成视口批量计费（LLD §3）。 */
  function start(discover = true) {
    if (active) return;
    active = true;
    scheduled = 0;
    translatedCount = 0;
    records.clear();
    pending = [];
    buildChip();
    clearChipError();
    updateChip();
    if (!discover) return;
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
    if (hintTimer) { clearTimeout(hintTimer); hintTimer = null; }
    if (host) { host.remove(); host = null; shadowDom = null; chipRow = null; errBox = null; }
  }

  function toggle() {
    if (siteDisabled) return { ok: false, error: '本站已在域名管理中禁用，恢复后刷新生效' };
    if (!cfg.enabled) return { ok: false, error: '划词翻译总开关已关闭，请先在 popup 开启' };
    if (active) stop(); else start();
    return { ok: true, active };
  }

  // 供两个入口与 bfcache 恢复共用的唯一开关路径
  window.__magicLensPageTranslateToggle = toggle;

  /* ---------- R71 悬停单段翻译：翻译/撤销鼠标所在的那一个段落 ---------- */
  const NO_PARA_HINT = '未找到可翻译段落（把鼠标移到正文段落上再按）';

  function translateParagraphAt(x, y) {
    if (siteDisabled) return; // 禁用站零反应（与划词/高亮同一份禁用语义）
    if (!cfg.enabled) return hint('划词翻译总开关已关闭，请先在 popup 开启');
    if (x < 0 && y < 0) return hint(NO_PARA_HINT); // 鼠标未进过页面（尚无锚点）
    const hit = document.elementFromPoint(x, y);
    const el = hit && hit.closest ? hit.closest(TEXT_TAGS) : null;
    if (!el) return hint(NO_PARA_HINT);

    const rec = records.get(el);
    // 已译段落再按一次=撤销：摘块、置 dismissed（records 保留以防 MO 重扫复活），
    // sessionCache 保留译文——再按一次复活零请求零计费
    if (rec && rec.state === 'done') {
      if (rec.node) { rec.node.remove(); rec.node = null; }
      rec.state = 'dismissed';
      translatedCount = Math.max(0, translatedCount - 1);
      updateChip();
      return;
    }
    // 在途（排队/请求中）：单段无法从攒批里摘除，静默忽略（chip 已见进度）
    if (rec && (rec.state === 'pending' || rec.state === 'loading')) return;

    // 新段落判资格；failed/dismissed/idle 复用已归一文本（failed 重试按用户指令再计费）
    let text = rec ? rec.text : null;
    if (!text) {
      const candidate = normalizeText(el);
      if (!qualifies(el, candidate)) return hint(NO_PARA_HINT);
      text = candidate;
    }
    if (!active) start(false); // 单段保底开启：不做全页发现（视口段落不得被放大成批量计费）
    const target = records.get(el) || { el, doc: document, text, state: 'idle', node: null };
    target.text = text;
    target.state = 'idle';
    records.set(el, target);
    enqueue(target); // 页内缓存命中即时渲染零请求；未命中走既有攒批管线（单段也享受合批）
  }

  /* ---------- R71 快捷键分发（顶层文档 keydown capture） ---------- */
  // 扩展自建 UI 的 shadow host：焦点落在其内部（如伴读输入框）时事件被重定向到 host，
  // 外层只见 div——显式忽略，避免在伴读抽屉里打字误触翻译
  const LENS_HOST_IDS = 'magiclens-host, magiclens-chat-host, magiclens-ball-host, magiclens-pt-host';

  function isEditableTarget(t) {
    if (!t || !t.tagName) return false; // target 为 document/window 时不拦
    const tag = String(t.tagName).toUpperCase();
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
    return Boolean(t.isContentEditable);
  }

  function onKeydown(e) {
    if (e.isComposing) return;
    if (siteDisabled) return; // 禁用站零反应（R25 高亮 Alt+U 同口径：禁用站连提示都不给）
    const t = e.target;
    // 编辑态不触发（mac Alt+字母在输入框插死键字符，快捷键再翻译一次=双重效果）；
    // 扩展自建 UI host 同口径忽略
    if (isEditableTarget(t) || (t && t.closest && t.closest(LENS_HOST_IDS))) return;
    if (window.__magicLensComboMatches(cfg.shortcutPageToggle, e)) {
      e.preventDefault();
      e.stopPropagation();
      const resp = toggle();
      if (resp && resp.ok === false) hint(resp.error);
      return;
    }
    if (window.__magicLensComboMatches(cfg.shortcutParagraph, e)) {
      e.preventDefault();
      e.stopPropagation();
      translateParagraphAt(lastX, lastY);
    }
  }

  const onMousemove = (e) => { lastX = e.clientX; lastY = e.clientY; };
  document.addEventListener('keydown', onKeydown, true);
  document.addEventListener('mousemove', onMousemove, { capture: true, passive: true });

  /* ---------- R72 沉浸式风格别名触发：双击 Alt 切整页 + 按住 Shift 悬停单段 ---------- */
  const DOUBLE_ALT_MS = 500; // 双击判定窗口；两次裸 Alt keydown 间隔 ≤500ms 视为双击
  let lastAltTap = 0;        // 上一次裸 Alt keydown 的时间戳（0=无连击记录）
  const BARE_ALT_RE = /^Alt(?:Left|Right)$/;
  const BARE_SHIFT_RE = /^Shift(?:Left|Right)$/;

  const isBareAlt = (e) => BARE_ALT_RE.test(e.code || '') && e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey;
  const isBareShift = (e) => BARE_SHIFT_RE.test(e.code || '') && e.shiftKey && !e.altKey && !e.ctrlKey && !e.metaKey;

  function onAliasKeydown(e) {
    if (isBareAlt(e)) {
      // 任何其他 keydown 都会断连击（含 Alt+A 的 A）——双击语义只认连续两次裸 Alt
      const now = Date.now();
      if (lastAltTap && now - lastAltTap <= DOUBLE_ALT_MS) {
        lastAltTap = 0;
        e.preventDefault();
        e.stopPropagation();
        const resp = toggle(); // 与 Alt+A 同一开关路径
        if (resp && resp.ok === false) hint(resp.error);
        return;
      }
      // 单次裸 Alt 不拦截不动作（网页自身行为零干扰），只记连击起点
      lastAltTap = now;
      return;
    }
    lastAltTap = 0; // 非 Alt 物理键打断连击
    if (isBareShift(e)) {
      // 按住 Shift 悬停（沉浸式交互对齐）：复用 Alt+P 的翻译/撤销状态机与资格闸。
      // 误触面小：光标不在合格段落上时零反应；Shift+Tab/Shift+方向键/Shift+字母均非裸 Shift
      e.preventDefault();
      e.stopPropagation();
      translateParagraphAt(lastX, lastY);
    }
  }
  document.addEventListener('keydown', onAliasKeydown, true);

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
    // R71 快捷键键位即时生效（设置页录制/清除无需刷新已开页面）
    if (changes.shortcutPageToggle) cfg.shortcutPageToggle = changes.shortcutPageToggle.newValue;
    if (changes.shortcutParagraph) cfg.shortcutParagraph = changes.shortcutParagraph.newValue;
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
    // 扩展重载孤儿页：摘掉 chip 与译文块、停监听（与 content retireOrphan 同语义）；
    // R71/R72 快捷键/鼠标锚点监听是模块级生命周期，一并退役
    try { stop(); } catch { /* 文档已死时尽力而为 */ }
    document.removeEventListener('keydown', onKeydown, true);
    document.removeEventListener('keydown', onAliasKeydown, true);
    document.removeEventListener('mousemove', onMousemove, { capture: true });
  });

  /* ---------- 启动 ---------- */
  chrome.storage.sync.get(__magicLensDefaults, (c) => {
    siteDisabled = window.__magicLensIsDisabledHost(location.hostname, c.disabledDomains);
    cfg.enabled = c.enabled !== false;
    // R71 键位串（'' = 禁用，直接采纳不回退默认）
    cfg.shortcutPageToggle = typeof c.shortcutPageToggle === 'string' ? c.shortcutPageToggle : cfg.shortcutPageToggle;
    cfg.shortcutParagraph = typeof c.shortcutParagraph === 'string' ? c.shortcutParagraph : cfg.shortcutParagraph;
    // 能力握手（与 data-magiclens-highlight / data-magiclens-selection 同模式）：popup/ball
    // 直发 tabs.sendMessage 依赖本监听已就位，标记给出「装了 ≠ 通」的显式探针
    document.documentElement.dataset.magiclensPageTranslate = '1';
  });
})();
