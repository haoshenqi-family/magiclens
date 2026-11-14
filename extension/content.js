/* MagicLens content script（划词翻译 + 认识/生词标记 + 本地朗读 + OIDC 回调捕获）。
 * Why：UI 挂在 closed Shadow DOM 里与页面样式完全隔离；
 * 翻译/标记请求经 background 中转（content script fetch 受页面 CORS 约束）。 */

/* ---------- 主引擎启动门控（R25 域名管理） ----------
 * Why 经 storage 回调启动而非顶层立即执行：chrome.storage 无同步 API，禁用名单
 * 未就绪前不能放行注入；命中名单的站点保持零 UI 零监听。名单只决定新加载页面，
 * 变更后刷新本页生效（已开页面不拆装，见 LLD §US1）。 */
chrome.storage.sync.get(__magicLensDefaults, ({ disabledDomains }) => {
  if (window.__magicLensIsDisabledHost(location.hostname, disabledDomains)) return;
  startMainEngine();
});

function startMainEngine() {
  if (window.__magicLensLoaded) return;
  window.__magicLensLoaded = true;

  const MSG = __magicLensRpc.MSG;  // R46：消息类型常量集中（rpc.js）

  const MAX_LEN = 2000; // moon-well /vocabulary/reading/translate 的文本长度上限

  const cfg = { enabled: true, autoTranslate: true };
  const syncCfg = () =>
    chrome.storage.sync.get(__magicLensDefaults, (c) => Object.assign(cfg, c));
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
      .actions button.primary { color: #fff; background: #4f46e5; }
      .actions button.primary:hover { background: #4338ca; }
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
        /* 上内边距交给 .d-head 承担（见下）：滚动容器自带的 padding-top 会成为头部上方一条
           漏字的缝——sticky 的吸顶边界是「padding 内缩后的区域」，负 margin 顶不开它。 */
        padding: 0 14px 12px;
      }
      .detail.show { display: block; }
      /* Why：面板自身是滚动容器（max-height + overflow-y），详解内容一长，滚到底时词名与 ✕
         一起移出可视区，用户没法就地关闭面板——头部必须吸顶常驻。
         How：头部 sticky 吸顶并自带 12px 上内边距（面板的 padding-top 已挪到这里），白底铺满
         整行内宽（负 margin 抵消左右 padding，改面板 padding-x 必须同步改这里），滚动内容不会
         从头部上下透出来。8px 下内边距是滚动时的呼吸缝隙，**不可**再用负 margin-bottom 收回：
         头部有 z-index，白底板会压在下一行（变体说明只有 2px 上边距）上盖掉它的字顶。 */
      .d-head {
        position: sticky; top: 0; z-index: 1;
        display: flex; align-items: baseline; gap: 8px;
        margin: 0 -14px; padding: 12px 14px 8px;
        background: #fff;
      }
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
        <button data-act="speak" title="朗读原文（单词用词典真人音频，其余用浏览器语音）">🔊</button>
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
  const btnDetail = shadow.querySelector('[data-act=detail]');
  const btnAsk = shadow.querySelector('[data-act=ask]');
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
    chrome.runtime.onMessage.removeListener(onRuntimeMessage); // R39：iframe 选区的接收端也要一起退役
    host.remove();
    console.warn('[MagicLens] 扩展已更新，本页旧脚本退役；刷新页面（F5）后生效');
  }

  /** 统一的中转调用：上下文失效即退役，其余错误归一成 {ok:false,error} 交给调用方展示。 */
  // R46（架构评审 L1）：传输与失效分类迁 __magicLensRpc（rpc.js）——失效退役
  // 经 onInvalidated 钩子注册，本薄包装只保留 {ok,error} 契约形态。
  __magicLensRpc.onInvalidated(() => retireOrphan());

  function askBackground(msg, onResult) {
    if (dormant) return;
    __magicLensRpc.send(msg, (resp, err) => {
      if (err) return onResult({ ok: false, error: err });
      onResult(resp || { ok: false, error: '无响应' });
    });
  }

  function hide() {
    // R19：详解面板与气泡生命周期解耦——收气泡不再收面板。
    // 面板仅由 ✕/Esc/新「详」查询关闭：生成要 15~30s，误关一次用户就白等一趟
    card.classList.remove('show');
    current = null;
    translateInflight = null; // 收气泡即解锁：下一次选同一个词要能重新翻译
    stopSpeak(); // 关气泡要一并静音：词典音频与浏览器合成音都可能在播
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
      link.addEventListener('click', () => askBackground({ type: MSG.ML_LOGIN }, () => {}));
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
    // 生词标记只针对英文词；词形口径由 common.js 统一，确保弯撇号等边界一致。
    return { text, rect, word: window.__magicLensSelectionWord(text) };
  }

  function resetButtons() {
    btnKnown.textContent = '认识';
    btnKnown.classList.remove('done');
    btnUnknown.textContent = '生词';
    btnUnknown.classList.remove('done');
  }

  function configureActions(action) {
    // 单词专属动作在长选区/中文选区上没有意义；译保留为显式手动操作，AI 升为主按钮。
    const wordOnly = action === 'translate';
    btnDetail.hidden = !wordOnly;
    btnKnown.hidden = !wordOnly;
    btnUnknown.hidden = !wordOnly;
    btnAsk.classList.toggle('primary', !wordOnly);
    btnAsk.title = wordOnly
      ? '把选中内容发给伴读 AI'
      : '把选中内容填入伴读 AI 输入框';
  }

  // Why 去重：点高亮词会两路触发本函数——mouseup 的 60ms 定时器 + highlight.js 的
  // click 处理器（程序化选中单词后立即调用）。同一选区 500ms 内只处理一次，
  // 避免重开气泡并重复发翻译请求
  let lastProc = { key: '', at: 0 };

  function claimSelection(key) {
    const now = Date.now();
    if (key === lastProc.key && now - lastProc.at < 500) return false;
    lastProc = { key, at: now };
    return true;
  }

  /** 打开划词气泡并按配置发起翻译：顶层选区与 iframe 选区共用（R34） */
  function openBubble(text, word, rect) {
    translateInflight = null; // 新一轮气泡 = 新的一次翻译机会（换词/重开都要能再发）
    resetButtons();
    const action = window.__magicLensSelectionAction(text);
    if (action === 'none') return;
    current = { text, word: action === 'translate' ? word : null };
    configureActions(action);
    elSrc.textContent = text.length > 120 ? `${text.slice(0, 120)}…` : text;
    // Why 先配置按钮再测量：AI 模式隐藏过单词按钮，若不先恢复，card 会按旧宽度定位，
    // 从 AI 选区切回单词时靠近视口右缘会被裁掉右侧动作。
    show({ left: rect.left, top: rect.top, bottom: rect.bottom });

    if (action === 'translate' && text.length > MAX_LEN) {
      current = null;
      setError(`选区过长（超过 ${MAX_LEN} 字符），请缩小选区`);
      return;
    }

    // R57：非单个英文单词（含中文）不自动发翻译请求——这类内容更适合先交给 AI；
    // 用户仍可点「译」显式调用原翻译接口。
    if (action === 'ai') {
      setLoading('已选中，点「AI」带入伴读，或点「译」手动翻译');
      elSpin.hidden = true;
      return;
    }

    if (cfg.autoTranslate) {
      translate();
    } else {
      setLoading('点击「译」开始翻译');
      elSpin.hidden = true;
    }
  }

  function processSelection() {
    if (!cfg.enabled) return;
    const info = selectionInfo();
    if (!info) return;
    if (!claimSelection(`${info.text}|${Math.round(info.rect.left)},${Math.round(info.rect.top)}`)) return;
    openBubble(info.text, info.word, info.rect);
  }

  // 在途守卫（R39）：同一段文本在上一条请求返回前，点「译」不再叠一条。
  // Why：一条翻译可能要十几秒（单词走金山+词形还原、短语/句子走 moon-well LLM），
  // 连点会把慢响应一个个压进气泡、并把 moon-well 免费档并发占满——真机表现就是
  // 「选中一个词，译点几下就卡死」。锁在 hide() 与每次打开气泡时复位，所以即使某条
  // 请求因扩展重载而永久不回，也不会把这个词此后永远锁死。
  let translateInflight = null;

  function translate() {
    if (!current) return;
    const text = current.text;
    // MAX_LEN 是 translate 接口约束，自动与手动入口都必须遵守。
    if (text.length > MAX_LEN) {
      setError(`选区过长（超过 ${MAX_LEN} 字符），请缩小选区`);
      return;
    }
    if (translateInflight === text) return;
    translateInflight = text;
    setLoading('翻译中…');
    askBackground({ type: MSG.ML_TRANSLATE, text }, (resp) => {
      if (translateInflight === text) translateInflight = null;
      // 气泡关闭或已换成别的选区时，旧请求的迟到响应必须作废。
      if (!current || current.text !== text) return;
      if (!resp.ok) return setError(window.__magicLensUserFacingError(resp.error, '翻译失败，请稍后重试'), resp.status);
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
    askBackground({ type: MSG.ML_MARK, word, known }, (resp) => {
      if (resp.ok) {
        btn.textContent = known ? '已认识 ✓' : '已入生词本 ✓';
        btn.classList.add('done');
        // 生词高亮（highlight.js）即时回写：标认识全页熄灭、标生词全页点亮（含常见变形）
        if (window.__magicLensOnMarked) window.__magicLensOnMarked(word, known);
      } else {
        btn.textContent = known ? '认识' : '生词';
        setError(window.__magicLensUserFacingError(resp.error, '标记失败，请稍后重试'), resp.status);
      }
    });
  }

  /* ---------- 朗读 ---------- */
  // Why 词典音频优先：与 magicbook 划词发音同构（其 epub.js `speakSelection` 成例）——
  // 单个英文单词要的是真人词库示范音，浏览器 speechSynthesis 的机械声退居最终兜底。
  // R66 起四级链路：background（IndexedDB 缓存 → 词典直连 → moon-well 词典代理，见
  // background.js）统一取字节回传，这里 Web Audio 解码播放——字节经消息通道进来，
  // 对宿主页 CSP 免疫（此前直接 new Audio(词典外链)，media-src 严格的站点会被页面
  // CSP 打回机械音）。机器合成覆盖三种情形：四级全空、短语/句子（词库没有整句音频）、
  // 解码或播放被拦。type=2 美音由 background 直连 URL 与 moon-well 服务端共同钉住。
  // 与 magicbook 同一条单词正则：首尾须为字母，词内的撇号/连字符算单词的一部分，
  // 短语与句子不匹配（它们交给浏览器合成，词库也没有整句音频）
  const SINGLE_WORD_RE = /^\s*[A-Za-z](?:[A-Za-z'’-]*[A-Za-z])?\s*$/;
  // 播放序号：stopSpeak（关气泡/再朗读）时 +1，让迟到响应与迟到回退作废——否则旧词的
  // 兜底机械音会盖在新词上（R43 dictAudio 判重的同款问题，消息化后用序号更省心）
  let speakSeq = 0;
  let dictPlayback = null; // 正在播的词典音播放柄：再朗读/关气泡都先停，避免两声叠播
  let dictAudioContext = null; // AudioContext 每页复用一个（反复 new 会撞浏览器实例上限）

  function stopSpeak() {
    speakSeq += 1;
    if (dictPlayback) {
      dictPlayback.stop();
      dictPlayback = null;
    }
    if ('speechSynthesis' in window) speechSynthesis.cancel();
  }

  function speakWithBrowser(text) {
    if (!('speechSynthesis' in window)) return;
    const u = new SpeechSynthesisUtterance(text);
    u.lang = /^[\x00-\xFF]+$/.test(text) ? 'en-US' : 'zh-CN';
    speechSynthesis.speak(u);
  }

  // 老 Safari 只有回调形态的 decodeAudioData，Promise 形态会被当成 undefined（chat.js 同款兼容）
  function decodeDictAudio(ctx, bytes) {
    return new Promise((resolve, reject) => {
      const maybe = ctx.decodeAudioData(bytes, resolve, reject);
      if (maybe && typeof maybe.then === 'function') maybe.then(resolve, reject);
    });
  }

  function playDictAudio(b64, onFail) {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) { onFail(); return; }
    try {
      const ctx = dictAudioContext || (dictAudioContext = new Ctx());
      decodeDictAudio(ctx, window.__magicLensB64Decode(b64)).then((buffer) => {
        // 自动播放策略拦住（ctx 悬挂）或解不出缓冲：退机器合成，不静音收场
        if (!buffer || ctx.state === 'suspended') { onFail(); return; }
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.connect(ctx.destination);
        const handle = { stop: () => { try { source.stop(); } catch (e) { /* 已结束 */ } }, source };
        dictPlayback = handle;
        source.onended = () => { if (dictPlayback === handle) dictPlayback = null; };
        source.start(0);
      }).catch(onFail);
    } catch (e) {
      onFail();
    }
  }

  function speak() {
    if (!current) return;
    const text = current.text;
    stopSpeak();
    const seq = speakSeq;
    if (!SINGLE_WORD_RE.test(text)) {
      speakWithBrowser(text);
      return;
    }
    // 四级链路前三级都在 background（同词并发 single-flight 去重）；失败只回退一次，
    // 迟到的响应与回退经 seq + current.text 双闸作废（同 translate 的口径）
    askBackground({ type: MSG.ML_DICT_SPEAK, word: text.trim() }, (resp) => {
      if (seq !== speakSeq || !current || current.text !== text) return;
      if (!resp || !resp.ok || !resp.audioBase64) {
        speakWithBrowser(text);
        return;
      }
      playDictAudio(resp.audioBase64, () => {
        if (seq !== speakSeq || !current || current.text !== text) return;
        speakWithBrowser(text);
      });
    });
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
      link.addEventListener('click', () => askBackground({ type: MSG.ML_LOGIN }, () => {}));
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
    askBackground({ type: MSG.ML_DETAIL, word: current.word }, (resp) => {
      if (seq !== detailSeq || !detail.classList.contains('show')) return; // 已换词或面板已关闭
      if (!resp.ok) return dError(window.__magicLensUserFacingError(resp.error, 'AI 生成超时或繁忙，请稍后重试'), resp.status);
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
  // 点击会跳转，且程序化选中会覆盖用户已有选区；仅按悬浮词打开气泡，按钮全部照常工作。
  // R24 第三参 source：iframe 内点高亮词传 'selection'（持久气泡，不随鼠标离开收起）；
  // 悬浮默认 'hover'（鼠标离开宽限后自动收起）
  window.__magicLensShowWordBubble = (word, anchor, source = 'hover') => {
    if (!cfg.enabled || !word || !anchor) return;
    resetButtons();
    configureActions('translate');
    elSrc.textContent = word;
    show(anchor, source);
    current = { text: word, word };
    if (cfg.autoTranslate) {
      translate();
    } else {
      setLoading('点击「译」开始翻译');
      elSpin.hidden = true;
    }
  };
  // R24：iframe 内非生词区点击时收起持久气泡（顶层 mousedown 处理器够不到 iframe）
  window.__magicLensHideBubble = () => { if (window.__magicLensBubbleSource) hide(); };

  /** iframe 文档内的拖选选区（R36，由 selection-relay.js 经 background 回投）：
   *  content script 的注入项没有 all_frames，本文件只在顶层文档运行，而 iframe 内的
   *  mouseup 既不跨文档冒泡、其选区也不属于顶层 window.getSelection()——magicbook
   *  epub.js 的书页正文正是这种同源 iframe。文本与「已换算到顶层视口」的矩形由子文档
   *  采集后送进来，气泡、按钮、上限与 autoTranslate 全部复用顶层那一条 openBubble 链路。 */
  function openIframeSelection(text, rect) {
    if (!cfg.enabled || !text || !rect) return;
    if (!claimSelection(`${text}|${Math.round(rect.left)},${Math.round(rect.top)}`)) return;
    // 词形口径与顶层 selectionInfo 保持一致（前缀匹配，命中才允许标记生词）
    openBubble(text, window.__magicLensSelectionWord(text), rect);
  }

  // Why 具名函数声明：retireOrphan() 要能 removeListener 摘掉它（匿名箭头摘不掉），
  // 否则扩展重载后的旧副本仍会接住 ml:openSelection，在一个已被移除的宿主上开气泡。
  // 用函数声明而非 const：声明提升到作用域顶部，退役路径无论先后都能引用。
  function onRuntimeMessage(msg, _sender, sendResponse) {
    if (!msg || msg.type !== 'ml:openSelection') return false; // 不认识的类型交还给其它监听
    if (window !== window.top) return false; // 气泡唯一属主是顶层文档
    openIframeSelection(msg.text, msg.rect);
    sendResponse({ ok: true });
    return false; // 同步应答，不需要保持消息通道
  }
  chrome.runtime.onMessage.addListener(onRuntimeMessage);
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
}
