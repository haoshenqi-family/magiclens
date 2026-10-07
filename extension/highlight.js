/* MagicLens 生词智能高亮（P1，R14）。机制借鉴「明畅·个人词库」扩展：
 * - 判定下沉 moon-well /vocabulary/reading/analyze（手动标记优先 + 分级词档兜底，
 *   与 magicbook 阅读器同一判定矩阵，网页生词顺带进同一阅读事件流）；
 * - 渲染用 CSS Custom Highlight API（零 DOM 改动，不与页面框架冲突）；
 * - 两级缓存 + IntersectionObserver 视口懒渲染 + MutationObserver 增量维护。
 * Why 与 content.js 同处隔离世界：经 window.__magicLens* 全局钩子互相调用
 * （与 page-extract.js 的 __magicLensCollectPageContext 同一模式）。 */
(() => {
  if (window.__magicLensHighlightLoaded) return;
  window.__magicLensHighlightLoaded = true;

  /* ---------- 配置 ---------- */
  const cfg = { enabled: true, hlEnabled: true, token: '' };
  /* Why analyze 请求体上限：服务端 DTO 无硬限制，防御性截断超大页面（Wikipedia 全文级） */
  const MAX_PAGE_TEXT = 150000;
  const FAMILIAR_BATCH = 300;  // familiar 增量判定的单批词数上限
  const MIN_SCAN_TEXT = 300;   // 低于此长度视为首屏未渲染完，延迟重试

  let scanning = false;
  let active = false;          // 当前页高亮引擎是否已启动
  let lastScanKey = null;      // Why 不含 hash（pageKey）：TOC 锚点跳转不应触发重扫虚增学情
  const retriedKeys = new Set(); // 每个 URL 只做一次「首屏未渲染完」延迟重试，防循环

  const shouldEngineRun = () => cfg.enabled && cfg.hlEnabled && Boolean(cfg.token);
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
  // Why 排除 CODE/PRE/KBD/SAMP：代码块生词噪音大；表单/contenteditable 是编辑区不应标注
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

  /** 收集 root 下可标注的 Text 节点（data 偏移即 Range 偏移，直接可建 Range） */
  function collectTexts(root) {
    const out = [];
    if (!root) return out;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
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

  /* ---------- 渲染（CSS Custom Highlight API + 视口懒渲染） ---------- */
  const HL_NAME = 'ml-vocab';
  let sheet = null;
  let hl = null;
  let io = null;
  let mo = null;
  // 两级缓存（明畅 parent2Text2RawsAll / RangeView 同构）：
  // nodeRaws = 全量匹配数据（纯对象，无 Range）；nodeRanges = 视口内已物化的 Range
  const nodeRaws = new Map(); // Text → [{start, end, raw, word}]
  const nodeRanges = new Map(); // Text → Range[]
  const parent2Texts = new Map(); // 段落父元素 → Set<Text>（IO 回调按段落批量物化/移除）
  const visibleParents = new Set(); // 当前在视口（含 rootMargin）内的父元素
  // 本页扫描覆盖过的全部 Text 节点：标词回写要全页重估（未命中的 token 不在 nodeRaws 里）
  const allTexts = new Set();

  function injectStyle() {
    if (sheet) return;
    try {
      sheet = new CSSStyleSheet();
      // Why 文档级：::highlight() 只认文档样式表，进 Shadow DOM 不生效（设计文档已批准的例外）
      sheet.replaceSync(
        `::highlight(${HL_NAME}){background-color:rgba(124,58,237,.10);text-decoration:underline wavy #8b5cf6;` +
        'text-decoration-skip-ink:none;text-underline-offset:3px;}'
      );
      document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
    } catch { /* 无 constructable stylesheet 的极老内核直接放弃（manifest 已限 110+，理论不可达） */ }
  }

  function ensureRegistry() {
    if (!('highlights' in CSS)) return false;
    if (!hl) { hl = new Highlight(); CSS.highlights.set(HL_NAME, hl); }
    return true;
  }

  function buildRange(text, raw) {
    // Why 复核文本：节点 data 被页面脚本替换后 offset 会错位，宁可丢一条高亮也不标错位置
    if (text.data.slice(raw.start, raw.end) !== raw.raw) return null;
    try {
      const r = new Range();
      r.setStart(text, raw.start);
      r.setEnd(text, raw.end);
      return r;
    } catch { return null; }
  }

  function materializeNode(text) {
    const raws = nodeRaws.get(text);
    if (!raws || nodeRanges.has(text)) return;
    const ranges = [];
    for (const raw of raws) {
      const r = buildRange(text, raw);
      if (r) { ranges.push(r); hl.add(r); }
    }
    nodeRanges.set(text, ranges);
  }

  function dematerializeNode(text) {
    const ranges = nodeRanges.get(text);
    if (!ranges) return;
    for (const r of ranges) hl.delete(r);
    nodeRanges.delete(text);
  }

  function unregisterText(text) {
    // 先走现父元素快路径（绝大多数命中），兜不住再全表扫（父元素刚被替换的罕见情形）
    const cur = text.parentElement;
    const curSet = cur && parent2Texts.get(cur);
    if (curSet && curSet.delete(text)) {
      if (!curSet.size) { parent2Texts.delete(cur); if (io) io.unobserve(cur); visibleParents.delete(cur); }
      return;
    }
    for (const [parent, set] of parent2Texts) {
      if (set.delete(text) && !set.size) { parent2Texts.delete(parent); if (io) io.unobserve(parent); visibleParents.delete(parent); }
    }
  }

  function observeParent(parent) {
    if (!io) {
      io = new IntersectionObserver((entries) => {
        for (const entry of entries) {
          const parent = entry.target;
          if (!parent.isConnected) { io.unobserve(parent); visibleParents.delete(parent); }
          else if (entry.isIntersecting) visibleParents.add(parent);
          else visibleParents.delete(parent);
          // Why 按 parent2Texts 取节点：进出视口的段落整体物化/移除，未物化的节点也在此补上
          for (const text of parent2Texts.get(parent) || []) {
            if (entry.isIntersecting && parent.isConnected) materializeNode(text);
            else dematerializeNode(text);
          }
        }
      }, { rootMargin: '200px 0px' });
    }
    io.observe(parent);
  }

  function registerParent(text, parent) {
    let set = parent2Texts.get(parent);
    if (!set) { set = new Set(); parent2Texts.set(parent, set); }
    set.add(text);
    observeParent(parent);
  }

  /** 对一批 Text 节点按当前生词集重估匹配（初次扫描 / 增量 / 标词回写共用） */
  function rescanNodes(texts) {
    if (!ensureRegistry()) return;
    for (const text of texts) {
      dematerializeNode(text);
      unregisterText(text);
      nodeRaws.delete(text);
      if (!text.isConnected) { nodeRanges.delete(text); allTexts.delete(text); continue; }
      const tokens = tokenizeText(text);
      const raws = [];
      for (const { start, end, raw } of tokens) {
        const hit = matchWord(raw);
        if (hit) raws.push({ start, end, raw, word: hit });
      }
      if (raws.length && text.parentElement) {
        nodeRaws.set(text, raws);
        registerParent(text, text.parentElement);
        if (visibleParents.has(text.parentElement)) materializeNode(text);
      }
    }
  }

  function dropNode(text) {
    dematerializeNode(text);
    nodeRaws.delete(text);
    allTexts.delete(text); // Why：死节点滞留 allTexts 会让 SPA 长会话缓慢泄漏
    unregisterText(text);
  }

  function startEngine() {
    if (active) return;
    active = true;
    injectStyle();
    ensureRegistry();
    installObservers();
  }

  function teardown() {
    if (mo) { mo.disconnect(); mo = null; }
    if (io) { io.disconnect(); io = null; }
    if (hl) { hl.clear(); CSS.highlights.delete(HL_NAME); hl = null; }
    if (sheet) {
      document.adoptedStyleSheets = document.adoptedStyleSheets.filter((s) => s !== sheet);
      sheet = null;
    }
    if (deltaTimer) { clearTimeout(deltaTimer); deltaTimer = null; }
    deltaNodes.clear();
    nodeRaws.clear();
    nodeRanges.clear();
    parent2Texts.clear();
    visibleParents.clear();
    allTexts.clear();
    cancelHover(); // 作废悬浮节奏（气泡由 content.js 各自路径收起）
    lastScanKey = null; // Why：重新开启时必须重扫（缓存已清，key 残留会永不恢复）
    scanning = false;   // Why：在途请求已被判定放弃，不得阻塞下一次扫描
    active = false;
  }

  /* ---------- 判定链路 ---------- */

  /** 英文页检测（borrowing 明畅 RR：title/meta/lang 字母占比 ≥60%） */
  function isEnglishPage() {
    const parts = [];
    if (document.title) parts.push(document.title);
    document.querySelectorAll('meta[name="description"],meta[name="keywords"],meta[property="og:title"],meta[property="og:description"]')
      .forEach((m) => { if (m.content) parts.push(m.content); });
    const letterRatio = (s) => {
      const chars = s.replace(/\s/g, '');
      if (!chars.length) return false;
      return (chars.match(/[A-Za-z]/g) || []).length / chars.length >= 0.6;
    };
    if ((document.documentElement.lang || '').toLowerCase().startsWith('en')) return true;
    if (!parts.length) return false;
    return parts.filter(letterRatio).length / parts.length > 0.6;
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
    // 否则冻结的高亮会一直残留在页面上
    const retire = () => { if (active) teardown(); };
    try {
      if (!chrome.runtime || !chrome.runtime.id) { retire(); return onResult(null); }
      chrome.runtime.sendMessage(msg, (resp) => {
        const err = chrome.runtime.lastError;
        if (err) {
          if (/invalidated|disposed/i.test(String(err.message || err))) retire();
          return onResult(null);
        }
        onResult(resp || null);
      });
    } catch (e) {
      if (e && /invalidated|disposed/i.test(String(e.message || e))) retire();
      onResult(null);
    }
  }

  /**
   * 初次全页扫描：analyze 判定矩阵（手动标记优先 + 词档兜底）+ 事件流归档。
   * 返回是否真正发起了 analyze（popup 重新扫描据此回真实结果，不假成功）。
   */
  function runScan(force) {
    if (!shouldEngineRun() || !('highlights' in CSS) || scanning) return false;
    if (!force && lastScanKey === pageKey()) return false;

    const texts = collectTexts(document.body);
    const pageText = gatherPageText(texts);
    if (!pageText) { startEngine(); return false; } // 空页：MO 增量链路接管后续渲染
    // Why 重试：SPA 在 document_idle 时往往还没渲染出正文；仅自动路径重试一次
    if (!force && pageText.length < MIN_SCAN_TEXT && !retriedKeys.has(pageKey())) {
      retriedKeys.add(pageKey());
      setTimeout(() => { if (shouldEngineRun()) runScan(false); }, 2000);
      return false;
    }
    // 重试后仍过短：放弃（两三行文本不值得写一次阅读事件）
    if (!force && pageText.length < MIN_SCAN_TEXT) return false;

    lastScanKey = pageKey();
    scanning = true;
    // Why 请求在途前就启动引擎（装 MO）：SPA 在等待响应期间渲染的内容
    // 由增量链路接管，否则会漏标到下次全量重估
    startEngine();
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
      if (!resp || !resp.ok || !Array.isArray(resp.data)) return; // 静默降级：不打扰阅读
      if (!shouldEngineRun()) return; // 在途期间被关闭/登出（teardown 已清场，不得复活）
      unknownSet.clear();
      resolvedMiss.clear();
      for (const item of resp.data) if (item && item.word) unknownSet.add(normWord(item.word));
      rebuildLemmaSet();
      for (const t of texts) allTexts.add(t);
      // Why 连 allTexts 一起重估：扫描在途期间标过的词/渲染的旧节点按新词集校正
      rescanNodes([...allTexts]);
    });
    return true;
  }

  /* ---------- MutationObserver：SPA 增量维护 + 新词增量判定 ---------- */
  let deltaTimer = null;
  const deltaNodes = new Set();

  function installObservers() {
    if (mo) mo.disconnect();
    mo = new MutationObserver((muts) => {
      for (const mut of muts) {
        if (mut.type === 'characterData') {
          if (mut.target instanceof Text && mut.target.isConnected) deltaNodes.add(mut.target);
        } else {
          for (const n of mut.removedNodes) {
            // 移除节点：立即摘除其 raws/ranges（防悬空 Range 残留在 Highlight 里）
            for (const text of collectTexts(n)) dropNode(text);
            if (n instanceof Text) dropNode(n);
          }
          for (const n of mut.addedNodes) deltaNodes.add(n);
        }
      }
      if (deltaNodes.size) {
        clearTimeout(deltaTimer);
        deltaTimer = setTimeout(processDelta, 800);
      }
    });
    mo.observe(document.body, { childList: true, subtree: true, characterData: true });
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

  /* ---------- 点词交互：点高亮词 → 程序化选中 → 复用划词气泡 ---------- */
  document.addEventListener('click', (e) => {
    if (!active || !unknownSet.size) return;
    if (isOwnUiPath(e)) return;
    if (typeof document.caretRangeFromPoint !== 'function') return;
    const sel = window.getSelection();
    if (sel && !sel.isCollapsed) return; // 正在划选，不抢
    const caret = document.caretRangeFromPoint(e.clientX, e.clientY);
    if (!caret || !(caret.startContainer instanceof Text)) return;
    const text = caret.startContainer;
    if (!text.parentElement || skipped(text.parentElement)) return;
    const tokens = tokenizeText(text);
    if (!tokens.length) return;
    const off = caret.startOffset;
    // 命中条件：偏移落在词内（两端都含——caret 可能落在首字符左沿或末字符之后）
    const tok = tokens.find((t) => off >= t.start && off <= t.end);
    if (!tok || !matchWord(tok.raw)) return;
    // Why preventDefault 仅在命中时：高亮词常落在 <a> 里，选中后放行默认行为会直接跳走
    e.preventDefault();
    try {
      const r = new Range();
      r.setStart(text, tok.start);
      r.setEnd(text, tok.end);
      sel.removeAllRanges();
      sel.addRange(r);
    } catch { return; }
    // 复用 content.js 的划词流程（气泡 + 翻译/详解/标记/AI）
    if (window.__magicLensProcessSelection) window.__magicLensProcessSelection();
  }, true);

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

  /* ---------- 悬浮生词即显划词气泡（R20/R21） ----------
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
  const HOVER_SHOW_DELAY = 200; // 悬停稳定后才开气泡，扫过单词不闪
  const HOVER_HIDE_DELAY = 150; // 离开词的宽限，跨行/移进气泡不闪断

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

  function fireShow(hit) {
    hoverShownFor = hit;
    clearTimeout(hoverHideTimer);
    // 复验区间（与 buildRange 同款）：MO 去抖窗口内文本被页面脚本改写时 token 可能错位
    if (hit.text.data.slice(hit.tok.start, hit.tok.end) !== hit.tok.raw) return cancelHover();
    const range = document.createRange();
    try {
      range.setStart(hit.text, hit.tok.start);
      range.setEnd(hit.text, hit.tok.end);
    } catch { return cancelHover(); }
    const rect = range.getBoundingClientRect();
    if (!rect || (!rect.width && !rect.height)) return cancelHover();
    if (window.__magicLensShowWordBubble) {
      window.__magicLensShowWordBubble(hit.tok.raw, { left: rect.left, top: rect.top, bottom: rect.bottom });
    }
  }

  function hoverHitTest(x, y) {
    if (typeof document.caretRangeFromPoint !== 'function') return null;
    const caret = document.caretRangeFromPoint(x, y);
    if (!caret || !(caret.startContainer instanceof Text)) return null;
    // Why 只查 nodeRaws：仅已高亮（生词）节点有登记，非高亮区域 O(1) 拒绝
    const raws = nodeRaws.get(caret.startContainer);
    if (!raws || !raws.length) return null;
    const off = caret.startOffset;
    const tok = raws.find((t) => off >= t.start && off <= t.end);
    return tok ? { text: caret.startContainer, tok } : null;
  }

  function isOwnUiPath(e) {
    return e.composedPath().some((n) => n && (n.id === 'magiclens-host' || n.id === 'magiclens-chat-host'));
  }

  function onMouseMove(e) {
    if (!active || !unknownSet.size) return;
    if (e.buttons) return cancelHover();               // 拖选/按住中不悬浮
    // 划选/点词打开的气泡归用户，悬浮不得打扰或替换
    if (window.__magicLensBubbleSource === 'selection') return cancelHover();
    if (isOwnUiPath(e)) { clearTimeout(hoverHideTimer); return; } // 移到气泡上保持显示
    const now = Date.now();
    if (now - hoverLastMove < 40) return;              // 节流
    hoverLastMove = now;
    const hit = hoverHitTest(e.clientX, e.clientY);
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
        hoverShowTimer = setTimeout(() => { hoverShowTimer = null; fireShow(hit); }, HOVER_SHOW_DELAY);
      }
      return;
    }
    // 换词：立即收旧悬浮气泡（划选来源的不动），为新词重排
    cancelHover();
    hoverDismissed = null;
    if (window.__magicLensBubbleSource === 'hover') hoverLeave();
    hoverPending = hit;
    hoverShowTimer = setTimeout(() => { hoverShowTimer = null; fireShow(hit); }, HOVER_SHOW_DELAY);
  }

  document.addEventListener('mousemove', onMouseMove, true);
  // 外处按下：作废悬浮节奏（气泡关闭由 content.js mousedown 处理）；气泡内按下不干扰
  document.addEventListener('mousedown', (e) => { if (!isOwnUiPath(e)) cancelHover(); }, true);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') dismissHover(); }, true);
  // 滚动视作用户主动关闭：作废节奏并抑制同词重开；气泡本体由 content.js 滚动逻辑收起
  document.addEventListener('scroll', dismissHover, { capture: true, passive: true });
  document.documentElement.addEventListener('mouseleave', cancelHover); // 鼠标离窗，挂起的弹出不得再触发

  /* ---------- 消息与开关 ---------- */
  chrome.runtime.onMessage.addListener((msg, _s, sendResponse) => {
    if (!msg || typeof msg.type !== 'string') return;
    if (msg.type === 'ml:hl-rescan') {
      if (!cfg.token) return sendResponse({ ok: false, error: '未登录' });
      if (!cfg.enabled || !cfg.hlEnabled) return sendResponse({ ok: false, error: '生词高亮已关闭，请先开启' });
      // Why 据实回包：runScan 在扫描中/空页时会拒绝，据实回报避免 popup 假成功
      const started = runScan(true);
      sendResponse(started
        ? { ok: true }
        : { ok: false, error: scanning ? '扫描进行中，请稍后再试' : '本页没有可扫描的文本' });
    } else if (msg.type === 'ml:hl-toggle') {
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
    } else if (!active && document.body) {
      runScan(false);
    }
  });

  /* ---------- 启动 ---------- */
  // Why 仅英文页自动扫描：中文页发 analyze 无词可标，纯浪费一次请求与事件流写入
  function boot() {
    if (!document.body) return;
    if (shouldEngineRun() && isEnglishPage()) runScan(false);
  }
  // Why boot 在 storage 回调内：cfg 异步回填前 token 为空，同步调 boot 永远扫不了（P0 修复）
  chrome.storage.sync.get({ enabled: true, hlEnabled: true, token: '' }, (c) => {
    Object.assign(cfg, c);
    boot(); // content script 注入于 document_idle，body 必已存在
  });

  window.addEventListener('pageshow', (e) => {
    // bfcache 恢复：Highlight 注册表可能失效，重新注册并按缓存重建可见区；悬浮节奏一并作废
    if (e.persisted && active) {
      cancelHover();
      if (ensureRegistry()) {
        CSS.highlights.set(HL_NAME, hl);
        const vis = [...visibleParents];
        for (const parent of vis) for (const text of parent2Texts.get(parent) || []) dematerializeNode(text);
        for (const parent of vis) for (const text of parent2Texts.get(parent) || []) materializeNode(text);
      }
    }
  });
  // Why 只监听 popstate 不监听 hashchange：pageKey 不含 hash，锚点跳转本就不会重扫
  window.addEventListener('popstate', () => { if (active && lastScanKey !== pageKey()) runScan(false); });
})();
