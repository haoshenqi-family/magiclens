/* MagicLens 网页正文朗读（R75）。
 *
 * 目标：把「像听文章一样听网页」做成默认 AI 音的轻量能力——正文段落逐段朗读、
 * 当前段高亮并自动滚入视口、每段一个 ▶、整页连播，入口为快捷键与右键菜单。
 *
 * 硬性约定（与 content/chat/page-translate 同口径）：
 * - 只操作顶层文档；magicbook 阅读器正文在 iframe，站点自身已有段落朗读，本模块不抢。
 * - UI 全部挂 closed Shadow DOM（#magiclens-read-host），不改宿主 DOM、不注入全局样式。
 * - 音频一律走 background 的 ML_TTS_SPEAK（moon-well /tts/speak，1..2000 字符）；
 *   超过 1800 字符的段落用 common.js __magicLensSplitForSpeech 切句后顺序播。
 * - 默认 AI 音、不做计费二次确认（R75 用户拍板）；SW 侧新增文本级 IndexedDB 音频缓存，
 *   同一段重听零网络零积分，预取下一段也不会与当前段并发重复合成。
 */
(() => {
  if (window.__magicLensReadLoaded) return;
  window.__magicLensReadLoaded = true;
  // 非顶层文档不装配：iframe 内正文由 magicbook 阅读器自己的段落朗读承担。
  if (window.top !== window) return;

  const MSG = __magicLensRpc.MSG;
  const HOST_ID = 'magiclens-read-host';
  const HOST_SELECTOR = `#${HOST_ID}, #magiclens-host, #magiclens-chat-host, #magiclens-ball-host, #magiclens-pt-host`;
  const BLOCK_SEL = 'p,li,blockquote,dd,dt,h1,h2,h3,h4,h5,h6';
  const SKIP_SEL = `nav,header,footer,aside,form,pre,code,[contenteditable],[aria-hidden="true"],[role="navigation"],[role="banner"],[role="contentinfo"],${HOST_SELECTOR}`;
  const CJK_RE = /[\u3400-\u9fff\uf900-\ufaff]/g;
  const MIN_CHARS = 40;
  const MIN_HEADING_CHARS = 8;
  const MAX_PARAGRAPHS = 200;
  const SPEED_KEY = 'magiclens.ttsSpeed';
  const SPEED_STEPS = [1, 0.75, 0.5];

  const cfg = {
    enabled: true,
    shortcutReadAloud: __magicLensDefaults.shortcutReadAloud,
  };
  let siteDisabled = false;
  let paragraphs = [];
  let itemByEl = new WeakMap();
  let paragraphsDirty = true;
  let rescanTimer = null;
  let reader = null;        // 当前连播状态
  let readerSeq = 0;
  let hoverItem = null;
  let hoverTimer = null;
  let lastContextItem = null;
  let toastTimer = null;
  let lastSpeed = 1;
  let resizeRaf = 0;

  /* ---------- UI（closed Shadow DOM） ---------- */
  const host = document.createElement('div');
  host.id = HOST_ID;
  host.style.cssText = 'all:initial;';
  const shadow = host.attachShadow({ mode: 'closed' });
  shadow.innerHTML = `
    <style>
      :host { all: initial; }
      * { box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', sans-serif; }
      .mlr-hover, .mlr-bar, .mlr-toast, .mlr-hl { position: fixed; z-index: 2147483644; }
      .mlr-hover {
        display: none; align-items: center; gap: 4px;
        transform: translate(-100%, 0);
        padding: 5px 9px; border: 1px solid rgba(79,70,229,.22); border-radius: 999px;
        background: rgba(255,255,255,.96); color: #4f46e5;
        box-shadow: 0 4px 14px rgba(17,24,39,.16);
        font-size: 12px; line-height: 1; cursor: pointer; user-select: none;
        backdrop-filter: blur(6px);
      }
      .mlr-hover:hover { background: #eef2ff; }
      .mlr-bar {
        display: none; left: 50%; bottom: 24px; transform: translateX(-50%);
        align-items: center; gap: 4px;
        padding: 7px 9px; border: 1px solid rgba(17,24,39,.08); border-radius: 999px;
        background: rgba(255,255,255,.97); color: #1f2937;
        box-shadow: 0 8px 28px rgba(17,24,39,.18);
        font-size: 12px; line-height: 1; user-select: none;
        backdrop-filter: blur(8px);
      }
      .mlr-bar button {
        all: unset; cursor: pointer; padding: 5px 7px; border-radius: 8px;
        color: #374151; font-size: 13px; line-height: 1;
      }
      .mlr-bar button:hover { background: #eef2ff; color: #4f46e5; }
      .mlr-bar .mlr-pos { color: #6b7280; padding: 0 4px 0 2px; font-variant-numeric: tabular-nums; }
      .mlr-bar .mlr-speed { min-width: 38px; text-align: center; color: #4f46e5; background: #eef2ff; }
      .mlr-toast {
        display: none; left: 50%; bottom: 76px; transform: translateX(-50%);
        max-width: min(520px, calc(100vw - 32px));
        padding: 8px 12px; border-radius: 10px;
        background: rgba(31,41,55,.94); color: #fff;
        box-shadow: 0 8px 24px rgba(17,24,39,.22);
        font-size: 12px; line-height: 1.5; text-align: center;
      }
      .mlr-hl {
        display: none; pointer-events: none;
        border: 1px solid rgba(79,70,229,.45); border-radius: 6px;
        background: rgba(79,70,229,.06);
        box-shadow: 0 0 0 2px rgba(79,70,229,.08);
      }
      @media (prefers-reduced-motion: reduce) { .mlr-bar, .mlr-hover { backdrop-filter: none; } }
    </style>
    <div class="mlr-hl"></div>
    <button class="mlr-hover" type="button" title="朗读这一段">▶ 朗读</button>
    <div class="mlr-toast" role="status" aria-live="polite"></div>
    <div class="mlr-bar" role="toolbar" aria-label="MagicLens 正文朗读">
      <span class="mlr-pos">0/0</span>
      <button type="button" data-act="mlr-toggle" title="暂停/继续">⏸</button>
      <button type="button" data-act="mlr-next" title="下一段">⏭</button>
      <button type="button" class="mlr-speed" data-act="mlr-speed" title="朗读语速">1.0x</button>
      <button type="button" data-act="mlr-stop" title="停止朗读">⏹</button>
    </div>
  `;
  const ui = {
    hl: shadow.querySelector('.mlr-hl'),
    hover: shadow.querySelector('.mlr-hover'),
    toast: shadow.querySelector('.mlr-toast'),
    bar: shadow.querySelector('.mlr-bar'),
    pos: shadow.querySelector('.mlr-pos'),
    toggle: shadow.querySelector('[data-act="mlr-toggle"]'),
    next: shadow.querySelector('[data-act="mlr-next"]'),
    speed: shadow.querySelector('[data-act="mlr-speed"]'),
    stop: shadow.querySelector('[data-act="mlr-stop"]'),
  };

  function toast(text) {
    if (!text) return;
    ui.toast.textContent = text;
    ui.toast.style.display = 'block';
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toastTimer = null;
      ui.toast.style.display = 'none';
    }, 4200);
  }

  function speedLabel(v) {
    return v === 1 ? '1.0x' : `${v}x`;
  }

  /* ---------- 段落发现与资格 ---------- */
  function normalizeText(el) {
    return (el.innerText || '').replace(/\s+/g, ' ').trim();
  }

  function isVisible(el) {
    const r = el.getBoundingClientRect();
    if (r.width < 40 || r.height < 8) return false;
    const s = getComputedStyle(el);
    if (s.visibility === 'hidden' || s.display === 'none' || parseFloat(s.opacity) < 0.1) return false;
    return true;
  }

  function qualifies(el, text) {
    if (!el || !el.isConnected) return false;
    if (el.closest(SKIP_SEL)) return false;
    const min = /^H[1-3]$/.test(el.tagName) ? MIN_HEADING_CHARS : MIN_CHARS;
    if (text.length < min) return false;
    const cjk = (text.match(CJK_RE) || []).length;
    if (cjk / text.length > 0.3) return false;
    // 导航/菜单类列表通常整行是链接：正文段落不因链接绝对排除，但短列表项不读。
    if (el.tagName === 'LI' && el.querySelector('a') && text.length < 120) return false;
    return true;
  }

  function collectParagraphs() {
    if (!document.body) return;
    const found = [];
    const seen = new Set();
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_ELEMENT,
      {
        acceptNode: (el) => (el.matches(BLOCK_SEL) && isVisible(el)
          ? NodeFilter.FILTER_ACCEPT
          : NodeFilter.FILTER_SKIP),
      }
    );
    while (walker.nextNode() && found.length < MAX_PARAGRAPHS) {
      const el = walker.currentNode;
      if (el.closest(HOST_SELECTOR)) continue;
      // 列表/引用内嵌 <p> 时只读最内层，避免同一段读两遍。
      if (/^(LI|BLOCKQUOTE|DD|DT)$/.test(el.tagName) && el.querySelector('p,blockquote,li,dd,dt')) continue;
      const text = normalizeText(el);
      if (!qualifies(el, text) || seen.has(text)) continue;
      seen.add(text);
      found.push({ el, text });
    }
    paragraphs = found;
    itemByEl = new WeakMap();
    for (const item of paragraphs) itemByEl.set(item.el, item);
    paragraphsDirty = false;
  }

  function ensureParagraphs() {
    if (paragraphsDirty || !paragraphs.length) collectParagraphs();
    return paragraphs;
  }

  const scheduleRescan = () => {
    if (rescanTimer) clearTimeout(rescanTimer);
    rescanTimer = setTimeout(() => {
      rescanTimer = null;
      paragraphsDirty = true;
      if (!reader) collectParagraphs();
    }, 900);
  };

  /* ---------- 悬浮 ▶ ---------- */
  function hideHover() {
    if (hoverTimer) { clearTimeout(hoverTimer); hoverTimer = null; }
    hoverItem = null;
    ui.hover.style.display = 'none';
  }

  const scheduleHideHover = () => {
    if (hoverTimer) clearTimeout(hoverTimer);
    hoverTimer = setTimeout(hideHover, 220);
  };

  function showHover(item) {
    const r = item.el.getBoundingClientRect();
    if (r.bottom < 8 || r.top > innerHeight - 8) { hideHover(); return; }
    hoverItem = item;
    ui.hover.style.top = `${Math.max(8, r.top + 4)}px`;
    ui.hover.style.left = `${Math.min(innerWidth - 8, r.right - 6)}px`;
    ui.hover.style.display = 'inline-flex';
  }

  function onMouseMove(e) {
    if (reader) { hideHover(); return; }
    const raw = e.target;
    if (!raw || (raw.closest && raw.closest(HOST_SELECTOR))) return;
    const el = raw.closest ? raw.closest(BLOCK_SEL) : null;
    if (!el) { scheduleHideHover(); return; }
    const item = itemByEl.get(el);
    if (!item) { scheduleHideHover(); return; }
    if (hoverTimer) { clearTimeout(hoverTimer); hoverTimer = null; }
    showHover(item);
  }

  ui.hover.addEventListener('mouseenter', () => {
    if (hoverTimer) { clearTimeout(hoverTimer); hoverTimer = null; }
  });
  ui.hover.addEventListener('mouseleave', scheduleHideHover);
  ui.hover.addEventListener('click', () => {
    if (hoverItem) readParagraph(hoverItem);
  });

  /* ---------- 播放器与队列 ---------- */
  function speechContext() {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    if (!reader) return null;
    if (!reader.ctx) reader.ctx = new Ctx();
    if (reader.ctx.state === 'suspended' && reader.ctx.resume) reader.ctx.resume();
    return reader.ctx;
  }

  function decodeAudio(ctx, bytes) {
    return new Promise((resolve, reject) => {
      const maybe = ctx.decodeAudioData(bytes, resolve, reject);
      if (maybe && typeof maybe.then === 'function') maybe.then(resolve, reject);
    });
  }

  function stopAudio(r) {
    if (!r) return;
    r.busy = false;
    if (r.audio) {
      const audio = r.audio;
      r.audio = null;
      try { audio.onended = null; audio.onerror = null; audio.pause(); audio.src = ''; } catch { /* 已结束 */ }
    }
    if (r.audioUrl) {
      try { URL.revokeObjectURL(r.audioUrl); } catch { /* 已回收 */ }
      r.audioUrl = '';
    }
    if (r.source) {
      const source = r.source;
      r.source = null;
      try { source.onended = null; source.stop(); } catch { /* 已结束 */ }
    }
  }

  function playBytes(bytes, r, onEnded) {
    const speed = r.speed;
    const segSeq = r.segSeq;
    const alive = () => Boolean(reader) && reader.token === r.token && r.segSeq === segSeq;
    let settled = false;
    const finish = () => { if (!settled) { settled = true; onEnded(); } };

    const fallback = () => {
      const ctx = speechContext();
      if (!ctx) { stopReader(true); toast('当前浏览器不支持音频播放'); return; }
      decodeAudio(ctx, bytes).then((buffer) => {
        if (!alive()) return;
        if (!buffer || ctx.state === 'suspended') {
          stopReader(true);
          toast('浏览器拦截了音频播放，请先与页面交互后重试');
          return;
        }
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.playbackRate.value = speed;
        source.connect(ctx.destination);
        r.source = source;
        source.onended = () => {
          if (r.source === source) r.source = null;
          if (!alive()) return;
          finish();
        };
        source.start(0);
      }).catch(() => {
        if (!alive()) return;
        stopReader(true);
        toast('朗读音频无法解码，请稍后重试');
      });
    };

    try {
      r.audioUrl = URL.createObjectURL(new Blob([bytes]));
      const audio = new Audio(r.audioUrl);
      r.audio = audio;
      audio.preservesPitch = true;
      try { audio.mozPreservesPitch = true; } catch { /* 非 Firefox */ }
      audio.webkitPreservesPitch = true;
      audio.playbackRate = speed;
      audio.onended = () => {
        const url = r.audioUrl;
        r.audioUrl = '';
        if (url) { try { URL.revokeObjectURL(url); } catch { /* 已回收 */ } }
        if (r.audio === audio) r.audio = null;
        if (!alive()) return;
        finish();
      };
      audio.onerror = () => {
        if (!alive()) return;
        stopAudio(r);
        fallback();
      };
      audio.play().catch(() => {
        if (!alive()) return;
        stopAudio(r);
        fallback();
      });
    } catch {
      fallback();
    }
  }

  function fetchAudio(text) {
    return new Promise((resolve) => {
      __magicLensRpc.send({ type: MSG.ML_TTS_SPEAK, text }, (resp, err) => {
        if (err) return resolve({ ok: false, error: err });
        resolve(resp || { ok: false, error: '朗读音频不可用' });
      });
    });
  }

  // 预取下一段：SW 侧有文本级缓存与 single-flight，命中时只是把字节放进 IndexedDB；
  // 用户若立刻停止，最多浪费一次「即将播放」的合成，符合 R75「不做二次确认」的口径。
  function prefetch(text) {
    if (!text) return;
    __magicLensRpc.send({ type: MSG.ML_TTS_SPEAK, text }, () => void chrome.runtime.lastError);
  }

  function buildSegments(items, baseIndex) {
    const out = [];
    items.forEach((item, i) => {
      const segments = __magicLensSplitForSpeech(item.text, 1800);
      segments.forEach((text) => {
        out.push({ el: item.el, text, pi: baseIndex + i });
      });
    });
    return out;
  }

  function updateBar() {
    if (!reader) return;
    const seg = reader.segments[reader.i];
    ui.bar.style.display = 'inline-flex';
    ui.pos.textContent = seg ? `${seg.pi + 1}/${reader.total}` : '0/0';
    ui.toggle.textContent = reader.paused ? '▶' : '⏸';
    ui.toggle.title = reader.paused ? '继续朗读' : '暂停朗读';
    ui.speed.textContent = speedLabel(reader.speed);
  }

  function positionHighlight() {
    if (!reader || !reader.lastEl || !reader.lastEl.isConnected) {
      ui.hl.style.display = 'none';
      return;
    }
    const r = reader.lastEl.getBoundingClientRect();
    if (r.bottom < 0 || r.top > innerHeight) { ui.hl.style.display = 'none'; return; }
    ui.hl.style.display = 'block';
    ui.hl.style.top = `${Math.max(0, r.top - 3)}px`;
    ui.hl.style.left = `${Math.max(0, r.left - 4)}px`;
    ui.hl.style.width = `${Math.max(20, r.width + 8)}px`;
    ui.hl.style.height = `${Math.max(12, r.height + 6)}px`;
  }

  const onViewportChange = () => {
    if (resizeRaf) return;
    resizeRaf = requestAnimationFrame(() => {
      resizeRaf = 0;
      hideHover();
      positionHighlight();
    });
  };

  function focusParagraph(el) {
    if (!el || !el.isConnected) return;
    const r = el.getBoundingClientRect();
    if (r.top < 80 || r.bottom > innerHeight - 80) {
      try { el.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch { el.scrollIntoView(); }
    }
    positionHighlight();
  }

  function playCurrent() {
    const r = reader;
    if (!r || r.busy || r.paused) return;
    const seg = r.segments[r.i];
    if (!seg) {
      toast('朗读完成');
      stopReader(true);
      return;
    }
    r.busy = true;
    // 段代：暂停/下一段/停止都可能让上一段的在途请求晚到；只认最后一次 playCurrent。
    const seq = ++r.segSeq;
    if (seg.el !== r.lastEl) {
      r.lastEl = seg.el;
      focusParagraph(seg.el);
    }
    updateBar();
    prefetch((r.segments[r.i + 1] || {}).text);

    fetchAudio(seg.text).then((resp) => {
      if (!reader || reader.token !== r.token || r.segSeq !== seq) return;
      r.busy = false;
      // 请求在途时用户已暂停：不抢播，恢复时再走一次（本地缓存命中，零积分）。
      if (r.paused) return;
      if (!resp.ok) {
        const auth = resp.auth || resp.status === 401 || resp.status === 403;
        const msg = auth
          ? '登录已失效，请重新登录后再朗读'
          : __magicLensUserFacingError(resp.error, '朗读失败，请稍后重试');
        stopReader(true);
        toast(msg);
        return;
      }
      let bytes;
      try { bytes = __magicLensB64Decode(resp.audioBase64); } catch {
        stopReader(true);
        toast('朗读音频解析失败，请稍后重试');
        return;
      }
      playBytes(bytes, r, () => {
        if (!reader || reader.token !== r.token || r.segSeq !== seq) return;
        if (r.paused) return;
        r.i += 1;
        playCurrent();
      });
    });
  }

  function startReader(items, baseIndex) {
    const segments = buildSegments(items, baseIndex);
    if (!segments.length) { toast('未找到可朗读的英文正文段落'); return; }
    stopReader(true);
    reader = {
      token: ++readerSeq,
      segments,
      total: paragraphs.length || items.length,
      i: 0,
      paused: false,
      busy: false,
      segSeq: 0,
      speed: lastSpeed,
      audio: null,
      audioUrl: '',
      source: null,
      ctx: null,
      lastEl: null,
    };
    hideHover();
    playCurrent();
  }

  function startFullRead() {
    ensureParagraphs();
    if (!paragraphs.length) { toast('未找到可朗读的英文正文段落'); return; }
    let start = paragraphs.findIndex((item) => item.el.getBoundingClientRect().bottom > 60);
    if (start < 0) start = 0;
    startReader(paragraphs.slice(start), start);
  }

  function readParagraph(item) {
    if (!item || !item.el || !item.el.isConnected) { toast('这一段已不在页面上，请刷新后重试'); return; }
    startReader([item], Math.max(0, paragraphs.indexOf(item)));
  }

  function readSelection(text) {
    const clean = String(text || '').replace(/\s+/g, ' ').trim();
    if (clean.length < 2) return false;
    const el = lastContextItem && lastContextItem.el && lastContextItem.el.isConnected
      ? lastContextItem.el
      : null;
    startReader([{ el, text: clean }], el ? Math.max(0, paragraphs.indexOf(lastContextItem)) : 0);
    return true;
  }

  function stopReader(silent) {
    if (!reader) return;
    const r = reader;
    reader = null;
    r.token += 1;
    stopAudio(r);
    ui.bar.style.display = 'none';
    ui.hl.style.display = 'none';
    ui.pos.textContent = '0/0';
    if (!silent) toast('已停止朗读');
  }

  function toggleReader() {
    if (reader) { stopReader(false); return; }
    startFullRead();
  }

  /* ---------- 控制条 ---------- */
  ui.toggle.addEventListener('click', () => {
    if (!reader) return;
    if (reader.paused) {
      reader.paused = false;
      if (reader.audio) {
        reader.audio.play().catch(() => { reader.busy = false; playCurrent(); });
      } else {
        playCurrent();
      }
      updateBar();
      return;
    }
    reader.paused = true;
    if (reader.audio) {
      try { reader.audio.pause(); } catch { /* 已结束 */ }
    } else if (reader.source) {
      try { reader.source.stop(); reader.source = null; } catch { /* 已结束 */ }
    }
    updateBar();
  });

  ui.next.addEventListener('click', () => {
    if (!reader) return;
    stopAudio(reader);
    reader.i += 1;
    reader.paused = false;
    playCurrent();
  });

  ui.stop.addEventListener('click', () => stopReader(false));

  ui.speed.addEventListener('click', () => {
    if (!reader) return;
    reader.speed = SPEED_STEPS[(SPEED_STEPS.indexOf(reader.speed) + 1) % SPEED_STEPS.length];
    lastSpeed = reader.speed;
    try { chrome.storage.local.set({ [SPEED_KEY]: lastSpeed }); } catch { /* 存不上不影响本次 */ }
    // 换档不打断当前段，下一段起生效（与聊天朗读同口径）。
    updateBar();
  });

  /* ---------- 右键菜单上下文 ---------- */
  function onContextMenu(e) {
    const raw = e.target;
    if (!raw || (raw.closest && raw.closest(HOST_SELECTOR))) return;
    const el = raw.closest ? raw.closest(BLOCK_SEL) : null;
    lastContextItem = el ? (itemByEl.get(el) || null) : null;
  }

  function readFromContext(selectionText) {
    const sel = String(selectionText || '').trim();
    if (sel.length >= 8) {
      // 右击点落在哪一段，就以那一段为准（选区在段内任意位置都读整段）。
      if (lastContextItem && lastContextItem.el.isConnected && lastContextItem.text.includes(sel)) {
        readParagraph(lastContextItem);
        return;
      }
      const first = sel.slice(0, 80);
      const matched = paragraphs.find((item) => item.text.includes(first));
      if (matched) { readParagraph(matched); return; }
      if (readSelection(sel)) return;
    }
    if (lastContextItem && lastContextItem.el.isConnected) {
      readParagraph(lastContextItem);
      return;
    }
    toast('请把鼠标放在要朗读的正文段落上再右键');
  }

  /* ---------- 快捷键 ---------- */
  function isEditable(t) {
    if (!t || !t.tagName) return false;
    const tag = String(t.tagName).toUpperCase();
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
    return Boolean(t.isContentEditable);
  }

  function onKeydown(e) {
    if (e.isComposing || e.repeat || siteDisabled || !cfg.enabled) return;
    const t = e.target;
    // 朗读控制条自身获得焦点时仍允许快捷键（它只是工具条，不是输入区）；
    // 伴读/划词/悬浮球等其它扩展 UI 内继续忽略，避免抽屉输入框里误触。
    if (isEditable(t)) return;
    if (t && t.closest && t.closest('#magiclens-host, #magiclens-chat-host, #magiclens-ball-host, #magiclens-pt-host')) return;
    if (!window.__magicLensComboMatches(cfg.shortcutReadAloud, e)) return;
    e.preventDefault();
    e.stopPropagation();
    toggleReader();
  }

  /* ---------- 生命周期 ---------- */
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (!msg || !msg.type) return;
    if (msg.type === MSG.ML_READ_TOGGLE) {
      toggleReader();
      sendResponse({ ok: true });
      return;
    }
    if (msg.type === MSG.ML_READ_PARAGRAPH) {
      readFromContext(msg.selectionText);
      sendResponse({ ok: true });
    }
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'sync') return;
    if (changes.enabled) {
      cfg.enabled = changes.enabled.newValue !== false;
      if (!cfg.enabled) { stopReader(true); hideHover(); }
    }
    if (changes.shortcutReadAloud) cfg.shortcutReadAloud = changes.shortcutReadAloud.newValue;
  });

  __magicLensRpc.onInvalidated(() => {
    try { stopReader(true); } catch { /* 文档已死 */ }
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('keydown', onKeydown, true);
    document.removeEventListener('contextmenu', onContextMenu, true);
    window.removeEventListener('scroll', onViewportChange, true);
    window.removeEventListener('resize', onViewportChange);
    if (rescanTimer) clearTimeout(rescanTimer);
    host.remove();
  });

  const mo = new MutationObserver(() => scheduleRescan());

  chrome.storage.sync.get(__magicLensDefaults, (c) => {
    siteDisabled = window.__magicLensIsDisabledHost(location.hostname, c.disabledDomains);
    cfg.enabled = c.enabled !== false;
    cfg.shortcutReadAloud = typeof c.shortcutReadAloud === 'string'
      ? c.shortcutReadAloud
      : cfg.shortcutReadAloud;
    // magicbook 站内（含子域）让位宿主阅读器：正文在 iframe，站点已有段落朗读。
    const hostYielded = window.__magicLensIsDisabledHost(
      location.hostname, window.__magicLensBallYieldDomains);
    if (siteDisabled || hostYielded || !cfg.enabled) return;

    document.addEventListener('mousemove', onMouseMove, { passive: true });
    document.addEventListener('keydown', onKeydown, true);
    document.addEventListener('contextmenu', onContextMenu, true);
    window.addEventListener('scroll', onViewportChange, { capture: true, passive: true });
    window.addEventListener('resize', onViewportChange);

    chrome.storage.local.get({ [SPEED_KEY]: 1 }, (store) => {
      const v = Number(store[SPEED_KEY]);
      lastSpeed = SPEED_STEPS.indexOf(v) >= 0 ? v : 1;
    });

    document.documentElement.appendChild(host);
    collectParagraphs();
    if (document.body) {
      mo.observe(document.body, { childList: true, subtree: true, characterData: true });
    }
    // 能力握手（与 data-magiclens-page-translate 同模式）：装了 ≠ 通，测试与宿主可探测。
    document.documentElement.dataset.magiclensRead = '1';
  });
})();
