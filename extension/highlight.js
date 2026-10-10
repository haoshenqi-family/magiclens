/* MagicLens 生词智能高亮（P1，R14/R24）。机制借鉴「明畅·个人词库」扩展：
 * - 判定下沉 moon-well /vocabulary/reading/analyze（手动标记优先 + 分级词档兜底，
 *   与 magicbook 阅读器同一判定矩阵，网页生词顺带进同一阅读事件流）；
 * - 渲染用 CSS Custom Highlight API（零 DOM 改动，不与页面框架冲突）；
 * - 两级缓存 + IntersectionObserver 视口懒渲染 + MutationObserver 增量维护；
 * - R24：多文档支持——magicbook 阅读器把书内正文渲染在同源 iframe 里，顶层 frame
 *   只看得到阅读器外壳；引擎按 document 多实例化（每个文档独立的 Highlight 注册表、
 *   样式表、IO 与交互监听），首扫前所有文档的观察者就已就位，epub 向 iframe 内写入
 *   正文会直接触发首扫；英文门控增加「逐文档正文采样」判据（中文书名/无 lang 的
 *   阅读页也能过闸）。
 * Why 与 content.js 同处隔离世界：经 window.__magicLens* 全局钩子互相调用。 */
(() => {
  if (window.__magicLensHighlightLoaded) return;
  window.__magicLensHighlightLoaded = true;

  /* ---------- 配置 ---------- */
  const cfg = { enabled: true, hlEnabled: true, token: '' };
  /* Why analyze 请求体上限：服务端 DTO 无硬限制，防御性截断超大页面（Wikipedia 全文级） */
  const MAX_PAGE_TEXT = 150000;
  const FAMILIAR_BATCH = 300;  // familiar 增量判定的单批词数上限
  const MIN_SCAN_TEXT = 300;   // 低于此长度视为首屏未渲染完，延迟重试
  const HOVER_SHOW_DELAY = 200; // 悬停稳定后才开气泡，扫过单词不闪（R20）
  const HOVER_HIDE_DELAY = 150; // 离开词的宽限，跨行/移进气泡不闪断

  let scanning = false;
  let active = false;          // 当前页高亮引擎是否已启动（= 已发过 analyze 且未关停）
  // scannedKeys：analyze 成功过的 pageKey（SPA 换页回来不重扫，靠 unknownSet 存量重亮）；
  // failedKeys：自动全量被拒的 pageKey（gate 判否或请求失败）——增量降级 familiar，
  // 不再自动重试，popup 重扫（force）或 teardown 清空后恢复
  const scannedKeys = new Set();
  const failedKeys = new Set();
  const retriedKeys = new Set(); // 每个 key 只做一次「首屏未渲染完」延迟重试，防循环

  let siteDisabled = false; // R25 域名管理：启动时判定一次，页内不更新（名单变更刷新生效，LLD §US1）
  const shouldEngineRun = () => !siteDisabled && cfg.enabled && cfg.hlEnabled && Boolean(cfg.token);
  const pageKey = () => `${location.origin}${location.pathname}${location.search}`;

  /* ---------- 生词集合与变形归并 ---------- */
  // unknownSet：analyze/familiar 返回的生词（小写、’→'，与 moon-well extractWords 归一口径一致）
  const unknownSet = new Set();
  // lemmaSet：生词集全部还原候选的并集——反向匹配用（页面是原形 run、生词集是 running 也能点亮）
  const lemmaSet = new Set();
  // 本页会话内已查询过的增量词（无论命中与否）：避免对同一词反复发 familiar
  const resolvedMiss = new Set();

  /** 常规屈折还原候选（明畅用词典 exchange 字段，这里用规则版；不规则变形是已知缺口） */
  function lemmaCandidates(t) {
    const set = new Set([t]);
    if (!/^[a-z]+$/.test(t)) return set; // don't / mother-in-law 等非纯字母只按原样匹配
    const dedouble = (s) =>
      s.length >= 3 && s[s.length - 1] === s[s.length - 2] ? s.slice(0, -1) : s;
    if (t.endsWith('ies') && t.length > 3) set.add(t.slice(0, -3) + 'y'); // studies→study
    if (t.endsWith('ves') && t.length > 3) { set.add(t.slice(0, -3) + 'f'); set.add(t.slice(0, -3) + 'fe'); } // wolves→wolf/fe
    if (t.endsWith('es') && t.length > 2) set.add(t.slice(0, -2)); // boxes→box, goes→go
    if (t.endsWith('s') && !t.endsWith('ss') && t.length > 2) set.add(t.slice(0, -1)); // dogs→dog
    if (t.endsWith('ied') && t.length > 3) set.add(t.slice(0, -3) + 'y'); // carried→carry
    if (t.endsWith('ed') && t.length > 3) {
      const base = t.slice(0, -2);
      set.add(base); set.add(base + 'e'); set.add(dedouble(base)); // walked→walk, hated→hate, stopped→stop
    }
    if (t.endsWith('ing') && t.length > 4) {
      const base = t.slice(0, -3);
      set.add(base); set.add(base + 'e'); set.add(dedouble(base)); // doing→do, having→have, running→run
    }
    if (t.endsWith('er') && t.length > 3) { set.add(t.slice(0, -2)); set.add(t.slice(0, -1)); set.add(dedouble(t.slice(0, -2))); } // bigger→big, nicer→nice
    if (t.endsWith('est') && t.length > 4) { set.add(t.slice(0, -3)); set.add(t.slice(0, -2)); set.add(dedouble(t.slice(0, -3))); }
    return set;
  }

  function rebuildLemmaSet() {
    lemmaSet.clear();
    for (const w of unknownSet) for (const c of lemmaCandidates(w)) lemmaSet.add(c);
  }

  /** token 归一口径对齐 moon-well extractWords：小写 + 弯撇号转直撇号 */
  function normWord(raw) {
    return raw.toLowerCase().replace(/’/g, "'");
  }

  /** token 是否命中生词集：原样命中，或还原候选命中，或落在生词的还原候选里（双向覆盖常见变形） */
  function matchWord(raw) {
    const t = normWord(raw);
    if (t.length < 2) return false;
    if (unknownSet.has(t)) return t;
    const bare = t.endsWith("'s") ? t.slice(0, -2) : t; // dog's → dog
    if (bare !== t && unknownSet.has(bare)) return bare;
    for (const c of lemmaCandidates(bare)) if (unknownSet.has(c)) return c;
    if (lemmaSet.has(bare)) return bare;
    if (bare !== t && lemmaSet.has(t)) return bare;
    return null;
  }

  /* ---------- 文本采集与分词 ---------- */
  // Why 排除 CODE/PRE/KBD/SAMP：代码块生词噪音大；表单/contenteditable 是编辑区不应标注。
  // IFRAME 只表示「不作为文本容器穿透」——同源 iframe 的正文由多文档引擎单独绑定（R24）
  const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE', 'TEXTAREA', 'INPUT',
    'SELECT', 'OPTION', 'CODE', 'PRE', 'KBD', 'SAMP', 'IFRAME', 'SVG', 'CANVAS']);
  const WORD_RE = /[A-Za-z][A-Za-z'’-]*/g; // 与 moon-well extractWords / magicbook epub.js 同口径

  function skipped(el) {
    for (let n = el; n; n = n.parentElement) {
      if (SKIP_TAGS.has(n.tagName) || n.id === 'magiclens-host' || n.id === 'magiclens-chat-host') return true;
      if (n.isContentEditable) return true;
    }
    return false;
  }

  function tokenizeText(text) {
    const tokens = [];
    const p = text.parentElement;
    if (!p || skipped(p)) return tokens;
    WORD_RE.lastIndex = 0;
    let m;
    while ((m = WORD_RE.exec(text.data))) tokens.push({ start: m.index, end: m.index + m[0].length, raw: m[0] });
    return tokens;
  }

  /** 收集 root 下可标注的 Text 节点（data 偏移即 Range 偏移，直接可建 Range）。
   * Why 用 root 自属文档建 TreeWalker：多文档引擎下 root 可能在 iframe 文档里。 */
  function collectTexts(root) {
    const out = [];
    if (!root) return out;
    const doc = root.ownerDocument || root;
    const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        if (!node.data || !node.data.trim()) return NodeFilter.FILTER_REJECT;
        const p = node.parentElement;
        return p && !skipped(p) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
      },
    });
    let text;
    while ((text = walker.nextNode())) out.push(text);
    return out;
  }

  /* ---------- 多文档引擎（R24） ----------
   * 每个可标注文档（顶层 + 同源 iframe）一份渲染状态：
   * ::highlight() 样式与 CSS.highlights 注册表都是 per-document 的，必须各自注入；
   * IntersectionObserver 用各文档自己的视口；交互监听挂在各自文档上（iframe 内的
   * mousemove/click 不会冒泡到顶层文档）。文档在登录+开关就绪后即绑定——早于首扫，
   * 这样 epub.js 向 iframe 写正文时 per-doc 观察者能立刻触发首扫（审查 P0-1 修复）。 */
  const HL_NAME = 'ml-vocab';
  const HL_CSS = `::highlight(${HL_NAME}){background-color:rgba(124,58,237,.10);text-decoration:underline wavy #8b5cf6;text-decoration-skip-ink:none;text-underline-offset:3px;}`;
  const docStates = new Map(); // Document → state（见 setupDoc）
  // 两级缓存（明畅 parent2Text2RawsAll / RangeView 同构）——Text 节点跨文档共用全局键：
  // nodeRaws = 全量匹配数据（纯对象，无 Range）；nodeRanges = 视口内已物化的 Range
  const nodeRaws = new Map(); // Text → [{start, end, raw, word}]
  const nodeRanges = new Map(); // Text → Range[]
  // 本页扫描覆盖过的全部 Text 节点：标词回写要全页重估（未命中的 token 不在 nodeRaws 里）
  const allTexts = new Set();

  /** 列出可标注文档：顶层 + 同源 iframe（两层内）。跨源 iframe 访问 contentDocument 会抛，静默跳过 */
  function collectDocs() {
    const entries = [{ doc: document, win: window, iframeEl: null }];
    const walk = (doc, depth) => {
      if (depth >= 2) return; // 顶层 1 层 + iframe 内再嵌 1 层
      for (const f of doc.querySelectorAll('iframe')) {
        try {
          const d = f.contentDocument;
          if (d) {
            entries.push({ doc: d, win: f.contentWindow, iframeEl: f });
            walk(d, depth + 1);
          }
        } catch { /* 跨源/沙箱：跳过 */ }
      }
    };
    walk(document, 0);
    return entries;
  }

  function collectAllTexts() {
    const out = [];
    for (const { doc } of collectDocs()) out.push(...collectTexts(doc.body));
    return out;
  }

  function isIframeish(n) {
    return n instanceof HTMLIFrameElement
      || Boolean(n && n.querySelector && n.querySelector('iframe'));
  }

  function hideSelectionBubble() {
    // iframe 内的 Esc/滚动/点空白够不到 content.js 的顶层处理器，经钩子收持久气泡
    if (window.__magicLensBubbleSource === 'selection' && window.__magicLensHideBubble) {
      window.__magicLensHideBubble();
    }
  }

  function setupDoc(entry) {
    const st = { ...entry, hl: null, sheet: null, io: null, mo: null, docListeners: [],
      parent2Texts: new Map(), visibleParents: new Set() };
    try {
      if ('highlights' in st.win.CSS) {
        st.hl = new st.win.Highlight();
        st.win.CSS.highlights.set(HL_NAME, st.hl);
      }
    } catch { /* 老内核降级：不渲染但不影响判定 */ }
    try {
      // Why per-document 样式：::highlight() 只认所在文档的样式表，顶层注入管不到 iframe
      st.sheet = new st.win.CSSStyleSheet();
      st.sheet.replaceSync(HL_CSS);
      st.doc.adoptedStyleSheets = [...st.doc.adoptedStyleSheets, st.sheet];
    } catch { st.sheet = null; }

    st.io = new st.win.IntersectionObserver(ioCallback(st), { rootMargin: '200px 0px' });

    // 交互监听（悬浮 + 点词）：挂在各文档上，闭包携带 st 做命中测试与坐标换算
    const on = (target, type, fn, opts) => { target.addEventListener(type, fn, opts); st.docListeners.push({ target, type, fn, opts }); };
    on(st.doc, 'mousemove', (e) => onMouseMove(e, st), true);
    on(st.doc, 'mousedown', (e) => {
      if (isOwnUiPath(e)) return;
      cancelHover();
      // 与 content.js 顶层 mousedown 语义对齐：文档内任意非扩展 UI 按下都收气泡
      //（悬浮走自己的宽限节奏，这里只作废它；持久气泡直接收）
      hideSelectionBubble();
    }, true);
    on(st.doc, 'click', (e) => onWordClick(e, st), true);
    // R34：iframe 内的拖选选区送进划词链路。Why 只给 iframe 绑：顶层文档的选区已由
    // content.js 自己的 mouseup 处理，两处同绑会双开气泡、双发翻译请求——两个入口算出的
    // 矩形一个取原生顶层坐标、一个取 iframe 偏移换算值，未必逐字相等，靠 500ms 去重兜不住。
    // Why 延迟 60ms：与顶层同节奏，等选区稳定；双击选词也会触发 mouseup。
    if (st.iframeEl) {
      on(st.doc, 'mouseup', () => setTimeout(() => pushIframeSelection(st), 60), true);
    }
    on(st.doc, 'keydown', (e) => {
      if (e.key !== 'Escape') return;
      dismissHover();
      hideSelectionBubble(); // R19/R21 顶层语义：Esc 关气泡——iframe 内打开的也要能关
    }, true);
    on(st.doc, 'scroll', () => { dismissHover(); hideSelectionBubble(); }, { capture: true, passive: true });
    if (st.doc.documentElement) on(st.doc.documentElement, 'mouseleave', cancelHover);
    // Why iframe load：TOC 式阅读器翻章会换 contentDocument 而不增删 iframe 元素，
    // 元素不动 → 无 structure 标志 → 靠 load 事件触发 syncDocs 重绑（审查 P1-3）
    if (st.iframeEl) on(st.iframeEl, 'load', () => scheduleSync());

    st.mo = new MutationObserver(masterMutHandler);
    st.mo.observe(st.doc.body || st.doc.documentElement || st.doc, { childList: true, subtree: true, characterData: true });
    return st;
  }

  function teardownDoc(doc) {
    const st = docStates.get(doc);
    if (!st) return;
    if (st.io) st.io.disconnect();
    if (st.mo) st.mo.disconnect();
    for (const { target, type, fn, opts } of st.docListeners) target.removeEventListener(type, fn, opts);
    try { if (st.hl) { st.hl.clear(); st.win.CSS.highlights.delete(HL_NAME); } } catch { /* 已随框架销毁 */ }
    try {
      if (st.sheet) st.doc.adoptedStyleSheets = st.doc.adoptedStyleSheets.filter((s) => s !== st.sheet);
    } catch { /* 文档已死 */ }
    // 清掉该文档名下的缓存节点（先于 docStates.delete：dropNode 要查 st）
    for (const text of [...allTexts]) if (text.ownerDocument === doc) dropNode(text);
    docStates.delete(doc);
  }

  /** 绑定/解绑文档引擎。预 active 也调用：epub 正文晚渲染依赖 per-doc 观察者触发首扫 */
  function syncDocs() {
    const seen = new Set();
    for (const entry of collectDocs()) {
      seen.add(entry.doc);
      if (!docStates.has(entry.doc)) docStates.set(entry.doc, setupDoc(entry));
    }
    for (const doc of [...docStates.keys()]) if (!seen.has(doc)) teardownDoc(doc);
  }

  function ensureRegistry(st) {
    if (!st.hl && 'highlights' in st.win.CSS) {
      try {
        st.hl = new st.win.Highlight();
        st.win.CSS.highlights.set(HL_NAME, st.hl);
      } catch { return false; }
    }
    return Boolean(st.hl);
  }

  function buildRange(text, raw) {
    // Why 复核文本：节点 data 被页面脚本替换后 offset 会错位，宁可丢一条高亮也不标错位置
    if (text.data.slice(raw.start, raw.end) !== raw.raw) return null;
    try {
      const r = text.ownerDocument.createRange();
      r.setStart(text, raw.start);
      r.setEnd(text, raw.end);
      return r;
    } catch { return null; }
  }

  /** 词在顶层视口中的矩形：iframe 文档需叠加 iframe 自身的位置偏移 */
  function tokRect(st, text, tok) {
    const r = buildRange(text, tok);
    if (!r) return null;
    const rect = r.getBoundingClientRect();
    if (st.iframeEl) {
      const f = st.iframeEl.getBoundingClientRect();
      return { left: rect.left + f.left, top: rect.top + f.top, bottom: rect.bottom + f.top,
        width: rect.width, height: rect.height };
    }
    return { left: rect.left, top: rect.top, bottom: rect.bottom, width: rect.width, height: rect.height };
  }

  /** iframe 内选区 → 顶层划词气泡（R34）：文本取该文档选区，矩形叠加 iframe 自身偏移
   *  换算到顶层视口（与 tokRect 同一套换算，气泡才不会被画在书页外的错误位置）。
   *  Why 不弹「取消选区」：点正文会先触发本文档的 mousedown → 已有 hideSelectionBubble
   *  收气泡，这里若再对空选区做动作只会互相干扰。 */
  function pushIframeSelection(st) {
    const hook = window.__magicLensShowIframeSelection;
    if (!hook || !st.iframeEl) return;
    let sel;
    try { sel = st.win.getSelection(); } catch { return; } // 翻章会换掉 contentDocument
    if (!sel || sel.isCollapsed || sel.rangeCount === 0) return;
    const text = String(sel.toString()).replace(/\s+/g, ' ').trim();
    if (!text) return;
    let rect;
    try { rect = sel.getRangeAt(0).getBoundingClientRect(); } catch { return; }
    if (!rect.width && !rect.height) return; // 选区不可见（如被折叠元素包住）
    const f = st.iframeEl.getBoundingClientRect();
    hook(text, { left: rect.left + f.left, top: rect.top + f.top, bottom: rect.bottom + f.top });
  }

  function materializeNode(text) {
    const raws = nodeRaws.get(text);
    const st = docStates.get(text.ownerDocument);
    if (!raws || !st || !st.hl || nodeRanges.has(text)) return;
    const ranges = [];
    for (const raw of raws) {
      const r = buildRange(text, raw);
      if (r) { ranges.push(r); st.hl.add(r); }
    }
    nodeRanges.set(text, ranges);
  }

  function dematerializeNode(text) {
    const ranges = nodeRanges.get(text);
    if (!ranges) return;
    const st = docStates.get(text.ownerDocument);
    if (st && st.hl) for (const r of ranges) st.hl.delete(r);
    nodeRanges.delete(text);
  }

  function unregisterText(text) {
    const st = docStates.get(text.ownerDocument);
    if (!st) return;
    // 先走现父元素快路径（绝大多数命中），兜不住再全表扫（父元素刚被替换的罕见情形）
    const cur = text.parentElement;
    const curSet = cur && st.parent2Texts.get(cur);
    if (curSet && curSet.delete(text)) {
      if (!curSet.size) { st.parent2Texts.delete(cur); if (st.io) st.io.unobserve(cur); st.visibleParents.delete(cur); }
      return;
    }
    for (const [parent, set] of st.parent2Texts) {
      if (set.delete(text) && !set.size) { st.parent2Texts.delete(parent); if (st.io) st.io.unobserve(parent); st.visibleParents.delete(parent); }
    }
  }

  function ioCallback(st) {
    return (entries) => {
      for (const entry of entries) {
        const parent = entry.target;
        if (!parent.isConnected) { st.io.unobserve(parent); st.visibleParents.delete(parent); }
        else if (entry.isIntersecting) st.visibleParents.add(parent);
        else st.visibleParents.delete(parent);
        // Why 按 parent2Texts 取节点：进出视口的段落整体物化/移除，未物化的节点也在此补上
        for (const text of st.parent2Texts.get(parent) || []) {
          if (entry.isIntersecting && parent.isConnected) materializeNode(text);
          else dematerializeNode(text);
        }
      }
    };
  }

  function registerParent(text, parent) {
    const st = docStates.get(text.ownerDocument);
    if (!st) return;
    let set = st.parent2Texts.get(parent);
    if (!set) { set = new Set(); st.parent2Texts.set(parent, set); }
    set.add(text);
    st.io.observe(parent);
  }

  /** 对一批 Text 节点按当前生词集重估匹配（初次扫描 / 增量 / 标词回写共用） */
  function rescanNodes(texts) {
    for (const text of texts) {
      dematerializeNode(text);
      unregisterText(text);
      nodeRaws.delete(text);
      if (!text.isConnected) { nodeRanges.delete(text); allTexts.delete(text); continue; }
      const st = docStates.get(text.ownerDocument);
      // Why 无状态即清册：文档被 teardown 后其（仍 isConnected 的）残留节点不得滞留 allTexts
      if (!st || !ensureRegistry(st)) { allTexts.delete(text); nodeRanges.delete(text); continue; }
      const tokens = tokenizeText(text);
      const raws = [];
      for (const { start, end, raw } of tokens) {
        const hit = matchWord(raw);
        if (hit) raws.push({ start, end, raw, word: hit });
      }
      if (raws.length && text.parentElement) {
        nodeRaws.set(text, raws);
        registerParent(text, text.parentElement);
        if (st.visibleParents.has(text.parentElement)) materializeNode(text);
      }
    }
  }

  function dropNode(text) {
    dematerializeNode(text);
    nodeRaws.delete(text);
    allTexts.delete(text); // Why：死节点滞留 allTexts 会让 SPA 长会话缓慢泄漏
    unregisterText(text);
  }

  function teardown() {
    for (const doc of [...docStates.keys()]) teardownDoc(doc);
    if (syncTimer) { clearTimeout(syncTimer); syncTimer = null; }
    if (deltaTimer) { clearTimeout(deltaTimer); deltaTimer = null; }
    deltaNodes.clear();
    nodeRaws.clear();
    nodeRanges.clear();
    allTexts.clear();
    cancelHover();
    // Why hover 来源的气泡要主动收：关停后 onMouseMove 短路，宽限回调永不触发
    if (window.__magicLensBubbleSource === 'hover' && window.__magicLensHoverLeave) window.__magicLensHoverLeave();
    scannedKeys.clear(); // Why：重开必须重扫（unknownSet 已清，凭据残缺）
    failedKeys.clear();  // Why：开关/登录态变化后失败原因可能已解除（审查 P2-9）
    lastAttemptKey = null;
    scanning = false;    // Why：在途请求已被判定放弃，不得阻塞下一次扫描
    active = false;
    unknownSet.clear();
    lemmaSet.clear();
    resolvedMiss.clear();
  }

  /* ---------- 判定链路 ---------- */

  function letterRatio(s) {
    const chars = s.replace(/\s/g, '');
    if (!chars.length) return false;
    return (chars.match(/[A-Za-z]/g) || []).length / chars.length >= 0.6;
  }

  /** 英文页检测（borrowing 明畅 RR：title/meta/lang 字母占比 ≥60%）——仅看顶层信号 */
  function isEnglishPage() {
    const parts = [];
    if (document.title) parts.push(document.title);
    document.querySelectorAll('meta[name="description"],meta[name="keywords"],meta[property="og:title"],meta[property="og:description"]')
      .forEach((m) => { if (m.content) parts.push(m.content); });
    if ((document.documentElement.lang || '').toLowerCase().startsWith('en')) return true;
    if (!parts.length) return false;
    return parts.filter(letterRatio).length / parts.length > 0.6;
  }

  /** 门控：顶层信号（title/meta/lang）或任一文档的正文采样判英文。
   * Why 逐文档采样：顶层壳（长中文目录/评论）可能占满整体采样头，书内英文进不了前 2000 字 */
  function gatePassed(pageText) {
    if (isEnglishPage()) return true;
    if (letterRatio((pageText || '').slice(0, 2000))) return true;
    for (const { doc } of collectDocs()) {
      if (letterRatio(gatherPageText(collectTexts(doc.body)).slice(0, 2000))) return true;
    }
    return false;
  }

  function gatherPageText(texts) {
    const chunks = [];
    let total = 0;
    for (const text of texts) {
      const s = text.data.trim();
      if (!s) continue;
      if (total + s.length + 1 > MAX_PAGE_TEXT) break;
      chunks.push(s);
      total += s.length + 1;
    }
    return chunks.join('\n');
  }

  function askBackground(msg, onResult) {
    // 扩展被重载后旧副本上下文失效：摘掉自己的样式与注册（对齐 content.js「失效即退役」），
    // 否则冻结的高亮会一直残留在页面上。Why 无条件 teardown：!active 时同样安全且
    // 能把预绑定的观察者一并拆除（审查 P2-3）
    try {
      if (!chrome.runtime || !chrome.runtime.id) { teardown(); return onResult(null); }
      chrome.runtime.sendMessage(msg, (resp) => {
        const err = chrome.runtime.lastError;
        if (err) {
          if (/invalidated|disposed/i.test(String(err.message || err))) teardown();
          return onResult(null);
        }
        onResult(resp || null);
      });
    } catch (e) {
      if (e && /invalidated|disposed/i.test(String(e.message || e))) teardown();
      onResult(null);
    }
  }

  // Why 记录最近一次尝试：onSyncTick 由 mutation 驱动，gate 判否页每次 DOM 变化都会
  // 重走 collect+gate；failedKeys 已挡重复全量尝试，这里仅避免重复收集的开销毛刺
  let lastAttemptKey = null;

  /**
   * 全页扫描：analyze 判定矩阵（手动标记优先 + 词档兜底）+ 事件流归档。
   * 返回是否真正发起了 analyze（popup 重新扫描据此回真实结果，不假成功）。
   */
  function maybeScan(force) {
    if (!shouldEngineRun() || !('highlights' in window.CSS) || scanning) return false;
    if (!force && (scannedKeys.has(pageKey()) || failedKeys.has(pageKey()))) return false;
    if (!force && lastAttemptKey === pageKey() && active) return false;

    const texts = collectAllTexts();
    const pageText = gatherPageText(texts);
    if (!pageText) return false; // 无内容：文档观察者接管后续渲染
    // Why 重试：SPA/阅读器在 document_idle 时往往还没渲染出正文；仅自动路径重试一次
    if (!force && pageText.length < MIN_SCAN_TEXT && !retriedKeys.has(pageKey())) {
      retriedKeys.add(pageKey());
      setTimeout(() => { if (shouldEngineRun()) maybeScan(false); }, 2000);
      return false;
    }
    // 重试后仍过短：放弃（两三行文本不值得写一次阅读事件）
    if (!force && pageText.length < MIN_SCAN_TEXT) return false;
    // Why 双重门控：顶层信号（title/meta/lang）判否时再逐文档采样正文——
    // magicbook 阅读页标题是中文书名、无 lang，但书内正文是英文（R24）
    if (!force && !gatePassed(pageText)) {
      failedKeys.add(pageKey()); // 该 key 不再自动尝试；增量降级 familiar；popup 重扫可 force
      return false;
    }

    lastAttemptKey = pageKey();
    scanning = true;
    // Why 请求在途前就启动引擎：等待响应期间渲染的内容由增量链路接管，
    // 否则会漏标到下次全量重估（文档绑定早于首扫已就位，这里主要是置 active）
    active = true;
    syncDocs();
    // Why 容错 decode：畸形百分号编码的 pathname 会让 decodeURIComponent 抛 URIError
    let chapter = location.pathname;
    try { chapter = decodeURIComponent(location.pathname); } catch { /* 原样使用 */ }
    askBackground({
      type: 'ml:analyze',
      pageText,
      bookName: location.hostname.slice(0, 200),
      chapter: chapter.slice(0, 200),
    }, (resp) => {
      scanning = false;
      if (!resp || !resp.ok || !Array.isArray(resp.data)) {
        failedKeys.add(pageKey()); // 增量降级 familiar；popup 重扫可 force
        return; // 静默降级：不打扰阅读
      }
      if (!shouldEngineRun()) return; // 在途期间被关闭/登出（teardown 已清场，不得复活）
      unknownSet.clear();
      resolvedMiss.clear();
      for (const item of resp.data) if (item && item.word) unknownSet.add(normWord(item.word));
      rebuildLemmaSet();
      scannedKeys.add(pageKey());
      failedKeys.delete(pageKey());
      syncDocs();
      for (const t of texts) allTexts.add(t);
      for (const t of collectAllTexts()) allTexts.add(t); // 在途期间新渲染的文档一并纳入
      // Why 连 allTexts 一起重估：扫描在途期间标过的词/渲染的旧节点按新词集校正
      rescanNodes([...allTexts]);
    });
    return true;
  }

  /* ---------- MutationObserver：结构变化 + SPA 增量维护 + 新词增量判定 ---------- */
  let deltaTimer = null;
  let syncTimer = null;
  const deltaNodes = new Set();

  function scheduleSync() {
    clearTimeout(syncTimer);
    syncTimer = setTimeout(onSyncTick, 400);
  }

  function onSyncTick() {
    syncTimer = null;
    if (shouldEngineRun()) syncDocs(); // 绑定新文档/清理死文档（含首扫前的预绑定）
    maybeScan(false);                  // 未扫过则尝试首扫（内部有 gate/失败键判断）
  }

  function masterMutHandler(muts) {
    let structure = false;
    for (const mut of muts) {
      if (mut.type === 'characterData') {
        if (active && mut.target instanceof Text && mut.target.isConnected) deltaNodes.add(mut.target);
        continue;
      }
      for (const n of mut.removedNodes) {
        if (isIframeish(n)) structure = true;
        // 移除节点：立即摘除其 raws/ranges（防悬空 Range 残留在 Highlight 里）
        if (active) {
          for (const text of collectTexts(n)) dropNode(text);
          if (n instanceof Text) dropNode(n);
        }
      }
      for (const n of mut.addedNodes) {
        if (isIframeish(n)) structure = true;
        if (active) deltaNodes.add(n);
      }
    }
    // Why 未启动也响应：epub.js 向 iframe 写正文时顶层文档可能毫无变化，
    // 只有 per-doc 观察者看得见——任一文档的 mutation 都要能触发首扫（审查 P0-1）
    if (structure || !active) scheduleSync();
    if (active && deltaNodes.size) {
      clearTimeout(deltaTimer);
      deltaTimer = setTimeout(processDelta, 800);
    }
  }

  /** 增量处理：重扫变更节点；未判定过的新词批量走 familiar（无事件副作用）补判定 */
  function processDelta() {
    if (!active || !deltaNodes.size) return;
    const texts = new Set();
    const candidateWords = new Set();
    for (const node of deltaNodes) {
      const collected = node instanceof Text ? [node] : collectTexts(node);
      for (const text of collected) {
        if (!text.isConnected) continue;
        texts.add(text);
        allTexts.add(text);
        for (const { raw } of tokenizeText(text)) {
          // Why matchWord 而非集合成员判断：页面是 running、生词集是 run 时也要高亮，
          // 不能把这类词再发去 familiar 白查一次
          if (normWord(raw).length >= 2 && !matchWord(raw) && !resolvedMiss.has(normWord(raw))) {
            candidateWords.add(normWord(raw));
          }
        }
      }
    }
    deltaNodes.clear();

    // Why 首扫未成功前不发 familiar：新到的大块内容（如 epub 正文晚渲染）应当吃
    // analyze 的词档兜底，familiar 只有单词本手标词，会造成「同一本书两套口径」；
    // 该 key 已被拒（gate 判否/请求失败）则直接走 familiar，不再空转 scheduleSync
    if (!scannedKeys.has(pageKey()) && !failedKeys.has(pageKey())) { scheduleSync(); return; }

    const words = [...candidateWords].slice(0, FAMILIAR_BATCH);
    const apply = () => rescanNodes([...texts]);
    if (!words.length) return apply();
    askBackground({ type: 'ml:familiar', words }, (resp) => {
      if (!active) return; // 在途期间引擎被关停（teardown 已清场）
      if (resp && resp.ok && Array.isArray(resp.data)) {
        for (const w of resp.data) if (w) unknownSet.add(normWord(w));
        if (resp.data.length) rebuildLemmaSet();
      }
      for (const w of words) resolvedMiss.add(w); // 无论命中与否本页会话内不再重复查询
      apply();
    });
  }

  /* ---------- 点词交互：点高亮词 → 唤起划词气泡 ---------- */
  function isOwnUiPath(e) {
    return e.composedPath().some((n) => n && (n.id === 'magiclens-host' || n.id === 'magiclens-chat-host'));
  }

  function onWordClick(e, st) {
    if (!active) return;
    if (isOwnUiPath(e)) return;
    if (typeof st.doc.caretRangeFromPoint !== 'function') return;
    const sel = st.win.getSelection();
    if (sel && !sel.isCollapsed) return; // 正在划选，不抢
    const caret = st.doc.caretRangeFromPoint(e.clientX, e.clientY);
    const text = caret && caret.startContainer instanceof Text ? caret.startContainer : null;
    const raws = text ? nodeRaws.get(text) : null;
    // Why 只查 nodeRaws：仅已高亮（生词）节点有登记，非生词区域 O(1) 拒绝
    const off = caret ? caret.startOffset : -1;
    const tok = raws && raws.length ? raws.find((t) => off >= t.start && off <= t.end) : null;
    if (!tok) {
      // Why 文档内点空白处也要能关气泡：content.js 的 mousedown 关闭逻辑在 iframe 文档
      // 够不着（顶层已由其自带处理器负责），仅针对持久气泡（悬浮气泡有自己的宽限节奏）
      if (st.iframeEl) hideSelectionBubble();
      return;
    }
    if (!text.parentElement || skipped(text.parentElement)) return;
    // Why preventDefault 仅在命中时：高亮词常落在 <a> 里，放行默认行为会直接跳走
    e.preventDefault();
    const rect = tokRect(st, text, tok);
    if (!rect) return;
    // 顶层：保留 R14 的真实选中行为（复用划词流程）；iframe 内零副作用唤起气泡
    //（选中态在 iframe 里对顶层气泡无意义，还可能在书上留下选区高亮）
    if (!st.iframeEl) {
      try {
        const r = buildRange(text, tok);
        sel.removeAllRanges();
        sel.addRange(r);
      } catch { return; }
      if (window.__magicLensProcessSelection) window.__magicLensProcessSelection();
    } else if (window.__magicLensShowWordBubble) {
      window.__magicLensShowWordBubble(tok.raw, rect, 'selection');
    }
  }

  /* ---------- 悬浮生词即显划词气泡（R20/R21，R24 起支持 iframe 内悬浮） ----------
   * Why 悬浮触发：部分页面元素（链接/标题）点击会跳转，悬浮零副作用；
   * Why 直接复用 content.js 气泡而非自绘小卡：用户要完整动作（译/详/朗读/标记/AI），
   * 且不开真实选区（「类似选中」但不选中——不覆盖用户已有选区、无原生选区高亮）。
   * 本文件只负责命中测试与节奏（延迟/宽限/节流/抑制），气泡生命周期归 content.js：
   * 经 __magicLensBubbleSource（selection/hover/null）互通状态。 */
  let hoverPending = null;   // 鼠标下的悬浮目标 { text, tok }
  let hoverShownFor = null;  // 已为其打开悬浮气泡的目标（同词微动判定 + 关后重开）
  let hoverDismissed = null; // 用户主动关闭（Esc/滚动）时所在的词：鼠标不离词不重开
  let hoverShowTimer = null;
  let hoverHideTimer = null;
  let hoverLastMove = 0;

  function cancelHover() {
    clearTimeout(hoverShowTimer);
    clearTimeout(hoverHideTimer);
    hoverShowTimer = null;
    hoverHideTimer = null;
    hoverPending = null;
    hoverShownFor = null;
  }

  /** 用户主动关闭场景（Esc/滚动）：记下所在词，鼠标不离词就不重开，否则气泡关不掉 */
  function dismissHover() {
    hoverDismissed = hoverShownFor;
    cancelHover();
  }

  function hoverLeave() {
    hoverShownFor = null;
    hoverPending = null;
    hoverDismissed = null;
    if (window.__magicLensHoverLeave) window.__magicLensHoverLeave();
  }

  function sameHit(a, b) {
    return Boolean(a && b && a.text === b.text && a.tok.start === b.tok.start);
  }

  function fireShow(hit, st) {
    hoverShownFor = hit;
    clearTimeout(hoverHideTimer);
    // 复验区间（与 buildRange 同款）：MO 去抖窗口内文本被页面脚本改写时 token 可能错位
    if (hit.text.data.slice(hit.tok.start, hit.tok.end) !== hit.tok.raw) return cancelHover();
    const rect = tokRect(st, hit.text, hit.tok);
    // Why 零尺寸校验：display:none/不可见词的 rect 全 0，会弹出定位异常的气泡
    if (!rect || (!rect.width && !rect.height)) return cancelHover();
    if (window.__magicLensShowWordBubble) {
      window.__magicLensShowWordBubble(hit.tok.raw, rect, 'hover');
    }
  }

  function hoverHitTest(x, y, st) {
    if (typeof st.doc.caretRangeFromPoint !== 'function') return null;
    const caret = st.doc.caretRangeFromPoint(x, y);
    if (!caret || !(caret.startContainer instanceof Text)) return null;
    // Why 只查 nodeRaws：仅已高亮（生词）节点有登记，非高亮区域 O(1) 拒绝
    const raws = nodeRaws.get(caret.startContainer);
    if (!raws || !raws.length) return null;
    const off = caret.startOffset;
    const tok = raws.find((t) => off >= t.start && off <= t.end);
    return tok ? { text: caret.startContainer, tok } : null;
  }

  function onMouseMove(e, st) {
    if (!active || !unknownSet.size) return;
    if (e.buttons) return cancelHover();               // 拖选/按住中不悬浮
    // 划选/点词打开的气泡归用户，悬浮不得打扰或替换
    if (window.__magicLensBubbleSource === 'selection') return cancelHover();
    if (isOwnUiPath(e)) { clearTimeout(hoverHideTimer); return; } // 移到气泡上保持显示
    const now = Date.now();
    if (now - hoverLastMove < 40) return;              // 节流
    hoverLastMove = now;
    const hit = hoverHitTest(e.clientX, e.clientY, st);
    if (!hit) {
      // 离开词：宽限后收悬浮气泡（移进气泡/回词会取消）；离词即解除「已关闭」抑制
      hoverDismissed = null;
      clearTimeout(hoverShowTimer);
      if (hoverShownFor && !hoverHideTimer) {
        hoverHideTimer = setTimeout(() => { hoverHideTimer = null; hoverLeave(); }, HOVER_HIDE_DELAY);
      }
      return;
    }
    if (sameHit(hoverPending, hit)) {
      // 同词微动：不打扰已排定时器/已显示气泡（防手抖把延迟无限重排）
      clearTimeout(hoverHideTimer);
      if (hoverDismissed && sameHit(hoverDismissed, hit)) return;
      // Why 校验来源：✕ 关闭时 mousedown 落在气泡上不触发 cancelHover，shownFor 会残留；
      // 来源已非 hover 说明气泡已关（✕/点外处），鼠标移回词上应重新打开
      if (hoverShownFor && window.__magicLensBubbleSource === 'hover') return;
      hoverShownFor = null;
      if (!hoverShowTimer) {
        hoverShowTimer = setTimeout(() => { hoverShowTimer = null; fireShow(hit, st); }, HOVER_SHOW_DELAY);
      }
      return;
    }
    // 换词：立即收旧悬浮气泡（划选来源的不动），为新词重排
    cancelHover();
    hoverDismissed = null;
    if (window.__magicLensBubbleSource === 'hover') hoverLeave();
    hoverPending = hit;
    hoverShowTimer = setTimeout(() => { hoverShowTimer = null; fireShow(hit, st); }, HOVER_SHOW_DELAY);
  }

  /* ---------- 标词回写：气泡里标认识/生词后，全页该词（含变形）即时熄灭/点亮 ---------- */
  window.__magicLensOnMarked = (word, known) => {
    if (!active || !word) return;
    const t = normWord(word);
    const bare = t.endsWith("'s") ? t.slice(0, -2) : t;
    if (known) {
      // Why 全集清扫：unknownSet 里存的是页面表层形（run 与 running 各自独立），
      // 标认识「run」时须把能还原到同一词形的表面形一并熄灭（明畅按 lemma 熄灭的等价语义）
      for (const w of [...unknownSet]) {
        if (w === t || w === bare || lemmaCandidates(w).has(bare) || lemmaCandidates(bare).has(w)) unknownSet.delete(w);
      }
    } else {
      unknownSet.add(t);
      unknownSet.add(bare);
      for (const c of lemmaCandidates(bare)) unknownSet.add(c);
    }
    rebuildLemmaSet();
    // Why 全页重估：新标记的词此前未命中、不在 nodeRaws 里，只有全量重估才能点亮/熄灭；
    // 只是重算内存匹配（tokenize + Set 查询），无 DOM 重扫开销，几百节点 <10ms
    rescanNodes([...allTexts]);
  };

  /* ---------- 消息与开关 ---------- */
  chrome.runtime.onMessage.addListener((msg, _s, sendResponse) => {
    if (!msg || typeof msg.type !== 'string') return;
    if (msg.type === 'ml:hl-rescan') {
      if (!cfg.token) return sendResponse({ ok: false, error: '未登录' });
      if (siteDisabled) return sendResponse({ ok: false, error: '本站已在域名管理中禁用，恢复后刷新生效' });
      if (!cfg.enabled || !cfg.hlEnabled) return sendResponse({ ok: false, error: '生词高亮已关闭，请先开启' });
      // Why 据实回包：maybeScan 在扫描中/空页时会拒绝，据实回报避免 popup 假成功
      const started = maybeScan(true);
      sendResponse(started
        ? { ok: true }
        : { ok: false, error: scanning ? '扫描进行中，请稍后再试' : '本页没有可扫描的文本' });
    } else if (msg.type === 'ml:hl-toggle') {
      // R25：本站被域名管理禁用时 Alt+U 不动全局开关——本站引擎永不应复活，
      // 静默翻转 hlEnabled 却殃及所有其它站点。Why 回 ok:true：background 的
      // fallback 是「收不到 ok 就代翻 storage」，回 false 反而会触发那次翻转
      if (siteDisabled) return sendResponse({ ok: true, siteDisabled: true });
      // Why 现读现翻：用缓存的 cfg 取反可能在 storage 回填前覆盖真实设置
      chrome.storage.sync.get({ hlEnabled: true }, ({ hlEnabled }) => {
        chrome.storage.sync.set({ hlEnabled: !hlEnabled });
        sendResponse({ ok: true, hlEnabled: !hlEnabled });
      });
      return true; // 异步 sendResponse，保持通道开启
    }
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'sync') return;
    if (changes.enabled) cfg.enabled = changes.enabled.newValue;
    if (changes.hlEnabled) cfg.hlEnabled = changes.hlEnabled.newValue;
    if (changes.token) cfg.token = changes.token.newValue;
    if (!shouldEngineRun()) {
      if (active) teardown();
    } else if (document.body) {
      // 重开/登录完成：文档观察者重新就位（epub iframe 晚渲染场景依赖它触发首扫）
      if (!docStates.size) syncDocs();
      maybeScan(false);
    }
  });

  /* ---------- 启动 ---------- */
  function boot() {
    if (!document.body || !shouldEngineRun()) return;
    // Why 绑定文档早于首扫：epub.js 在 document_idle 之后才向 iframe 写正文，
    // 只有 per-doc 观察者先就位，正文写入才能触发首扫（R24 根因）
    syncDocs();
    maybeScan(false);
  }
  // Why boot 在 storage 回调内：cfg 异步回填前 token 为空，同步调 boot 永远扫不了（R14 P0 修复）
  chrome.storage.sync.get({ enabled: true, hlEnabled: true, token: '', disabledDomains: [] }, (c) => {
    // R25 域名管理：禁用站不启动引擎。Why 写进 siteDisabled 而非仅跳过 boot：
    // 本文件有 storage.onChanged/Alt+U 等现成「重开路径」，只挡 boot 的话，
    // 禁用站上后续翻转全局开关会把引擎复活
    siteDisabled = window.__magicLensIsDisabledHost(location.hostname, c.disabledDomains);
    delete c.disabledDomains;
    Object.assign(cfg, c);
    boot(); // content script 注入于 document_idle，body 必已存在
  });

  window.addEventListener('pageshow', (e) => {
    // bfcache 恢复：各文档 Highlight 注册表可能失效，重新注册并按缓存重建可见区；悬浮节奏一并作废
    if (e.persisted && active) {
      cancelHover();
      for (const st of docStates.values()) {
        if (!ensureRegistry(st)) continue;
        st.win.CSS.highlights.set(HL_NAME, st.hl);
        const vis = [...st.visibleParents];
        for (const parent of vis) for (const text of st.parent2Texts.get(parent) || []) dematerializeNode(text);
        for (const parent of vis) for (const text of st.parent2Texts.get(parent) || []) materializeNode(text);
      }
    }
  });
  // Why 只监听 popstate 不监听 hashchange：pageKey 不含 hash，锚点跳转本就不会重扫。
  // 换页不清 scannedKeys：同 key 回来靠 unknownSet 存量重亮，新 key 全量、被拒 key 降级 familiar
  window.addEventListener('popstate', () => { maybeScan(false); });
})();
