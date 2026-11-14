/* MagicLens 常驻入口悬浮球（R54；验收修订=对齐 magicbook R223：buddy 形象 + hover 径向快捷气泡）。
 *
 * 用户修改意见（2026-10-27）：「这个悬浮球和 magicbook 的保持一致，使用 buddy 形象，
 * 悬浮提供更多选项。」视觉与交互逐段移植 magicbook ai_chat.js/ai_chat.css 的
 * R223 实现：56px 透明头像球（无装备回落浅蓝「AI」底）、hover/focus 弹出径向气泡
 * （类 iPhone AssistiveTouch，扇区 130°→50°、半径 74px、弹簧曲线）、350ms 延迟
 * 关闭、拖拽吸附 + 位置记忆、pointer-capture 延迟到 6px 拖动阈值（R223 真机缺陷
 * 修法，防止 click 被重定向）。
 *
 * 与 magicbook 的三处分叉（Why）：
 * - 头像来源：magicbook 走本站代理 /ajax/buddy/image（Flask 会话）；扩展改 moon-well
 *   `POST /buddy/catalog`（JWT 经 background 中转）拿 equipped 伙伴的 MinIO 匿名直链，
 *   <img> 直连——probe 成功才切头像态，失败保留文字兜底（R206 同款探测再切换）。
 * - 动作集：magicbook 在 /buddy 页配置、阅读页动作转发顶栏工具；网页上下文没有
 *   顶栏，固定五项（chat 钉首位，R234 服务端不变量的扩展侧同构）：对话=开抽屉、
 *   生词高亮=本页开关（经 background 转发 ML_HL_TOGGLE，与 Alt+U 同一语义）、
 *   每日学习/书库/我的=新标签打开 magicbook 对应页。可配置性登记 LLD 遗留。
 * - 位置记忆：magicbook 用页面 localStorage；扩展禁污染宿主，改 chrome.storage.local
 *   按 hostname 键（同一站点各页共用，换设备不跟随——位置本就是屏幕相关）。
 *
 * R56：magicbook 站内保留宿主自带、带阅读上下文的悬浮球，本扩展球在该域及子域
 * 自动让位（__magicLensBallYieldDomains），避免两个球同位置重叠；其他网站不受影响。
 *
 * 其余约定同 R54 v1：closed Shadow DOM、显隐=主开关×球开关×域名管理×宿主让位名单
 *（common.js __magicLensBallVisible）、storage.onChanged 实时显隐、rpc onInvalidated 失效退役；
 * z-index 2147483645 压在伴读抽屉遮罩（2147483646）之下，开抽屉时球与气泡被遮罩盖住。 */
(() => {
  if (window.__magicLensBallLoaded) return;
  window.__magicLensBallLoaded = true;

  const MSG = __magicLensRpc.MSG;
  const SITE = window.__magicLensSiteOrigin;

  // 动作全集（顺序即展开顺位，chat 恒首位——R234 口径的扩展侧同构）
  const ACTIONS = [
    { id: 'chat', icon: '💬', label: '对话', run: () => window.__magicLensAsk('') },
    { id: 'highlight', icon: '〰', label: '生词高亮', run: () => {
      // 经 background 转发给本页 highlight.js（与 Alt+U 完全同一链路与语义）
      __magicLensRpc.send({ type: MSG.ML_HL_TOGGLE }, () => void chrome.runtime.lastError);
    } },
    { id: 'page-translate', icon: '🌐', label: '整页翻译', run: () => {
      // R67 段落整页翻译：经 SW 转发给本页 page-translate.js（与高亮气泡同构，Why 不直调
      // window 钩子：扩展重载后的旧页面上钩子缺失，SW 转发能回「请刷新页面」类可行动文案）
      __magicLensRpc.send({ type: MSG.ML_PT_TOGGLE }, () => void chrome.runtime.lastError);
    } },
    { id: 'learning', icon: '🎓', label: '每日学习', run: () => window.open(`${SITE}/learning`, '_blank', 'noopener') },
    { id: 'library', icon: '📚', label: '书库', run: () => window.open(`${SITE}/`, '_blank', 'noopener') },
    { id: 'me', icon: '👤', label: '我的', run: () => window.open(`${SITE}/me`, '_blank', 'noopener') },
  ];

  let host = null;      // shadow host
  let wrap = null;      // 定位/拖拽命中区（R223：定位迁 wrap，按钮只画头像）
  let visible = false;
  let bubbleCloseTimer = null;

  function bg(msg) {
    return new Promise((resolve) => {
      __magicLensRpc.send(msg, (resp, err) => {
        if (err) return resolve({ ok: false, error: err, status: 0 });
        resolve(resp || { ok: false, error: 'no response', status: 0 });
      });
    });
  }

  function remove() {
    if (bubbleCloseTimer) { clearTimeout(bubbleCloseTimer); bubbleCloseTimer = null; }
    teardownReview();
    if (host) { host.remove(); host = null; wrap = null; }
    visible = false;
  }

  /* ---------- DOM（closed Shadow DOM） ---------- */
  function build() {
    host = document.createElement('div');
    host.id = 'magiclens-ball-host';
    const shadow = host.attachShadow({ mode: 'closed' });
    const style = document.createElement('style');
    // 尺寸/动效/气泡样式逐段对齐 magicbook ai_chat.css R223 段；选择器改类名
    //（shadow 内无 #id 命名空间问题，类名即可）
    style.textContent = `
      :host { all: initial; }
      * { box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
      .wrap { position: fixed; right: 24px; bottom: 24px; z-index: 2147483645;
        width: 56px; height: 56px; touch-action: none; }
      .wrap.snapping { transition: left .22s ease-out, top .22s ease-out; }
      .fab { position: static; width: 100%; height: 100%; border-radius: 50%;
        background: transparent; color: #fff; border: none; cursor: grab;
        font-size: 20px; display: flex; align-items: center; justify-content: center;
        transition: transform .2s; overflow: visible; padding: 0; }
      .fab:active { cursor: grabbing; }
      .fab:hover { transform: scale(1.06); }
      .fab:not(.has-buddy) { background: rgba(26,115,232,.92); }
      .fab.has-buddy { background: transparent; box-shadow: none; }
      .fab .fab-text { font-size: 18px; font-weight: 600; letter-spacing: .5px; }
      .fab-img { width: 100%; height: 100%; object-fit: cover; border-radius: 50%;
        display: none; -webkit-user-drag: none; user-select: none; }
      .fab.has-buddy .fab-text { display: none; }
      .fab.has-buddy .fab-img { display: block; animation: ball-breathe 3.4s ease-in-out infinite; }
      @keyframes ball-breathe { 0%,100% { transform: scale(1); } 50% { transform: scale(1.06); } }
      @media (prefers-reduced-motion: reduce) { .fab.has-buddy .fab-img { animation: none; } }

      .bubbles { position: absolute; right: 8px; bottom: 8px; width: 40px; height: 40px; pointer-events: none; }
      .bubble { position: absolute; right: 0; bottom: 0; width: 40px; height: 40px; border-radius: 50%;
        background: #fff; color: #333; border: 1px solid rgba(0,0,0,.08);
        box-shadow: 0 2px 10px rgba(0,0,0,.18); display: flex; align-items: center; justify-content: center;
        font-size: 17px; cursor: pointer; opacity: 0; visibility: hidden;
        transform: translate(0,0) scale(.6);
        transition: opacity .16s ease, transform .18s cubic-bezier(.34,1.56,.64,1), visibility 0s linear .16s; }
      .wrap.bubbles-open .bubble { opacity: 1; visibility: visible; pointer-events: auto;
        transform: translate(var(--bx), var(--by)) scale(1); transition-delay: 0s; }
      .bubble:hover { transform: translate(var(--bx), var(--by)) scale(1.12); background: #f0f6ff; }
      .bubble .tip { position: absolute; right: 46px; top: 50%; transform: translateY(-50%);
        background: rgba(32,33,36,.92); color: #fff; font-size: 11px; line-height: 1;
        padding: 4px 8px; border-radius: 6px; white-space: nowrap; opacity: 0;
        transition: opacity .12s ease; pointer-events: none; }
      .bubble:hover .tip { opacity: 1; }
      .wrap.bubbles-left .bubble .tip { right: auto; left: 46px; }

      /* ---------- R59 滚动复习词卡（逐段移植 magicbook ai_chat.css R285/R289 段） ---------- */
      .rvw { position: fixed; z-index: 2147483645; width: 280px; max-width: calc(100vw - 16px);
        padding: 10px 12px 12px; background: #fff; color: #263b52;
        border: 1px solid #d7e3f7; border-radius: 12px;
        box-shadow: 0 6px 24px rgba(30, 60, 100, 0.16); }
      .rvw[hidden], .rvw [hidden] { display: none !important; }
      .rvw::after { content: ""; position: absolute; bottom: -6px; right: 22px; width: 10px; height: 10px;
        background: #fff; border-right: 1px solid #d7e3f7; border-bottom: 1px solid #d7e3f7;
        transform: rotate(45deg); }
      .rvw.is-left::after { right: auto; left: 18px; }
      .rvw.is-below::after { bottom: auto; top: -6px; transform: rotate(225deg); }
      .rvw-head { display: flex; align-items: center; gap: 6px; margin-bottom: 8px; }
      .rvw-title { font-size: 11px; color: #7a8aa2; letter-spacing: .02em; }
      .rvw-progress { margin-left: auto; font-size: 11px; color: #7a8aa2; font-variant-numeric: tabular-nums; }
      .rvw-icon { flex: 0 0 auto; width: 24px; height: 24px; padding: 0; border: none; border-radius: 6px;
        background: #f2f6fc; color: #4a5a75; font-size: 12px; line-height: 24px; cursor: pointer; }
      .rvw-icon:hover { background: #e6effc; }
      .rvw-word-row { display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap; }
      .rvw-word { font-size: 17px; font-weight: 500; color: #18324f; word-break: break-word; }
      .rvw-meaning { font-size: 13px; color: #40566e; word-break: break-word; }
      /* R289 详情分页正文：一次只显一页，硬钳 3 行（用户口径「每次显示不超过3行」）；
         pre-line 让页内 义项/例句 按换行分行，行数仍由 clamp 兜底 */
      .rvw-detail { margin-top: 6px; font-size: 12px; color: #40566e; display: -webkit-box;
        -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden;
        word-break: break-word; white-space: pre-line; }
      .rvw-detail:empty { display: none; }
      .rvw-context { margin-top: 6px; font-size: 12px; color: #5f6f84; display: -webkit-box;
        -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; word-break: break-word; }
      .rvw-context:empty, .rvw-source:empty { display: none; }
      .rvw-source { margin-top: 4px; font-size: 11px; color: #93a1b3; white-space: nowrap;
        overflow: hidden; text-overflow: ellipsis; }
      .rvw-actions { display: flex; gap: 8px; margin-top: 10px; }
      .rvw-btn { flex: 1; min-height: 30px; padding: 5px 8px; border: 1px solid #cfdded; border-radius: 8px;
        background: #f7faff; color: #33475e; cursor: pointer; font-size: 12px; }
      .rvw-btn.primary { background: #4285f4; border-color: #4285f4; color: #fff; }
      .rvw-btn:hover:not(:disabled) { filter: brightness(0.97); }
      .rvw-btn:disabled { opacity: 0.5; cursor: not-allowed; }
      .rvw-status { margin-top: 6px; font-size: 12px; color: #7a8aa2; }
      .rvw-status:empty { display: none; }
      .rvw-status.is-error { color: #b42318; }
      .rvw-error { font-size: 12px; color: #b42318; }
      .rvw-error button { margin-left: 6px; padding: 3px 9px; border: 1px solid #e6b8b3; border-radius: 6px;
        background: #fff; color: #b42318; cursor: pointer; }
      .rvw-peek { display: block; width: 30px; height: 30px; padding: 0; border: 1px solid #d7e3f7;
        border-radius: 50%; background: #fff; color: #33475e; font-size: 11px; cursor: pointer;
        box-shadow: 0 2px 10px rgba(0, 0, 0, 0.14); }
      .rvw.is-collapsed { width: auto; padding: 0; border: none; background: transparent; box-shadow: none; }
      .rvw.is-collapsed::after, .rvw.is-collapsed .rvw-head,
      .rvw.is-collapsed .rvw-body, .rvw.is-collapsed .rvw-error { display: none; }
      /* 快捷气泡展开时词卡让位（magicbook R285 同款「~」兄弟选择器），不与径向气泡同屏打架 */
      .wrap.bubbles-open ~ .rvw { visibility: hidden; }
    `;
    wrap = document.createElement('div');
    wrap.className = 'wrap';
    const fab = document.createElement('button');
    fab.className = 'fab';
    const text = document.createElement('span');
    text.className = 'fab-text';
    text.textContent = 'AI';
    const img = document.createElement('img');
    img.className = 'fab-img';
    img.alt = '';
    img.addEventListener('dragstart', (e) => e.preventDefault()); // 头像原生拖拽会断 pointer 流（R220）
    fab.append(text, img);
    const bubbles = document.createElement('div');
    bubbles.className = 'bubbles';
    wrap.append(fab, bubbles);
    shadow.append(style, wrap, buildReviewDom());
    (document.body || document.documentElement).appendChild(host);

    // 气泡（chat 恒首位由 ACTIONS 顺序保证）
    for (const a of ACTIONS) {
      const b = document.createElement('button');
      b.className = 'bubble';
      b.dataset.action = a.id;
      b.setAttribute('aria-label', a.label);
      b.appendChild(document.createTextNode(a.icon));
      const tip = document.createElement('span');
      tip.className = 'tip';
      tip.textContent = a.label;
      b.appendChild(tip);
      b.addEventListener('click', () => { closeBubbles(); a.run(); });
      bubbles.appendChild(b);
    }

    // FAB 本体点击 = 对话（与 magicbook 同：点球开抽屉，气泡是 hover 增强）
    fab.addEventListener('click', () => {
      if (typeof window.__magicLensAsk === 'function') window.__magicLensAsk('');
    });

    initBubbles();
    initDrag();
    loadBuddyAvatar(fab, img);
    initReview();
    visible = true;
  }

  /* ---------- R206 伙伴头像：catalog（moon-well JWT）→ MinIO 直链 probe 再切换 ---------- */
  function loadBuddyAvatar(fab, img) {
    bg({ type: MSG.ML_API, path: '/buddy/catalog', body: {} }).then((resp) => {
      if (!resp || !resp.ok || !Array.isArray(resp.data)) return; // 未登录/失败：保留文字兜底
      const equipped = resp.data.find((b) => b && b.equipped);
      const url = equipped && (equipped.fullImageUrl || equipped.imageUrl);
      if (!url) return; // 未装备伙伴：文字兜底（magicbook 同款语义）
      const probe = new Image();
      probe.onload = () => { img.src = url; fab.classList.add('has-buddy'); };
      probe.onerror = () => { /* 图片未就绪/被拦：保留兜底，不裂图 */ };
      probe.src = url;
    });
  }

  /* ---------- hover 径向气泡（R223 移植：350ms 延迟关闭 + 方向自适应） ---------- */
  function closeBubbles() { wrap && wrap.classList.remove('bubbles-open'); }

  function openBubbles() {
    if (bubbleCloseTimer) { clearTimeout(bubbleCloseTimer); bubbleCloseTimer = null; }
    if (!wrap) return;
    const items = wrap.querySelectorAll('.bubble');
    if (items.length) {
      const rect = wrap.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const clearRadius = 94; // 气泡半径 + 展开半径的余量
      const inward = centerX > window.innerWidth / 2 ? -1 : 1;
      const vertical = centerY < clearRadius ? -1 : (window.innerHeight - centerY < clearRadius ? 1 : 0);
      // 顶/底空间不足时往反方向让位。屏幕方向向量 (dx,dy)=(inward,-vertical)；
      // 气泡位移按 (cos a, -sin a) 存（数学角），故 a = -atan2(dy, dx)。
      const baseDeg = vertical
        ? -Math.atan2(-vertical, inward) * 180 / Math.PI
        : (inward < 0 ? 180 : 0);
      const spread = vertical ? 90 : 120;
      const count = items.length;
      items.forEach((bubble, i) => {
        const off = count > 1 ? (i / (count - 1) - 0.5) * spread : 0;
        const angle = (baseDeg + off) * Math.PI / 180;
        bubble.style.setProperty('--bx', `${Math.round(Math.cos(angle) * 74)}px`);
        bubble.style.setProperty('--by', `${Math.round(-Math.sin(angle) * 74)}px`);
      });
      wrap.classList.toggle('bubbles-left', inward > 0);
    }
    wrap.classList.add('bubbles-open');
  }

  function initBubbles() {
    wrap.addEventListener('mouseenter', openBubbles);
    wrap.addEventListener('mouseleave', () => {
      // FAB 与气泡间有空隙，鼠标穿越会短暂 mouseleave——350ms 内重进即取消
      if (bubbleCloseTimer) clearTimeout(bubbleCloseTimer);
      bubbleCloseTimer = setTimeout(() => { bubbleCloseTimer = null; closeBubbles(); }, 350);
    });
    wrap.addEventListener('focusin', openBubbles);
    wrap.addEventListener('focusout', closeBubbles);
    document.addEventListener('click', (e) => {
      if (wrap.classList.contains('bubbles-open') && !wrap.contains(e.target)) closeBubbles();
    }, true);
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeBubbles(); });
  }

  /* ---------- 拖拽 + 吸附 + 位置记忆（R223 移植；存储改 chrome.storage.local） ---------- */
  const POS_KEY = 'magiclens.fabPos'; // value: { [hostname]: {x,y} }，同站点各页共用
  let posCache = null;

  function applySavedPosition() {
    chrome.storage.local.get({ [POS_KEY]: {} }, (store) => {
      if (chrome.runtime.lastError || !wrap) return;
      posCache = store[POS_KEY] || {};
      const saved = posCache[location.hostname];
      if (saved && Number.isFinite(saved.x) && Number.isFinite(saved.y)) {
        const p = snapPosition(saved.x, saved.y);
        wrap.style.left = `${p.x}px`;
        wrap.style.top = `${p.y}px`;
        wrap.style.right = 'auto';
        wrap.style.bottom = 'auto';
      }
    });
  }

  function savePosition(p) {
    posCache = posCache || {};
    posCache[location.hostname] = p;
    chrome.storage.local.set({ [POS_KEY]: posCache }, () => void chrome.runtime.lastError);
  }

  function snapPosition(x, y) {
    const gap = 10;
    const maxX = Math.max(gap, window.innerWidth - 56 - gap);
    const maxY = Math.max(gap, window.innerHeight - 56 - gap);
    return {
      x: x + 28 < window.innerWidth / 2 ? gap : maxX,
      y: Math.max(gap, Math.min(maxY, y)),
    };
  }

  function initDrag() {
    if (!window.PointerEvent) return;
    let startX = 0, startY = 0, originX = 0, originY = 0, moved = false;
    wrap.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      wrap.classList.remove('snapping');
      closeBubbles();
      const rect = wrap.getBoundingClientRect();
      startX = e.clientX; startY = e.clientY;
      originX = rect.left; originY = rect.top; moved = false;
      // 不能在 pointerdown 就捕获：捕获会把后续 click 重定向到 wrap，
      // FAB 与气泡的 click 全部失效；捕获延迟到真正开始拖动时设置（R223 真机修法）
    });
    wrap.addEventListener('pointermove', (e) => {
      if (!(e.buttons & 1)) return; // 未按住左键的移动（含悬停）不拖拽
      const dx = e.clientX - startX, dy = e.clientY - startY;
      if (!moved) {
        if (Math.hypot(dx, dy) < 6) return;
        moved = true;
        wrap.setPointerCapture(e.pointerId);
      }
      const x = Math.max(0, Math.min(window.innerWidth - 56, originX + dx));
      const y = Math.max(0, Math.min(window.innerHeight - 56, originY + dy));
      wrap.style.left = `${x}px`;
      wrap.style.top = `${y}px`;
      wrap.style.right = 'auto';
      wrap.style.bottom = 'auto';
    });
    wrap.addEventListener('pointerup', (e) => {
      if (wrap.hasPointerCapture(e.pointerId)) wrap.releasePointerCapture(e.pointerId);
      if (moved) {
        e.preventDefault();
        const rect = wrap.getBoundingClientRect();
        const snapped = snapPosition(rect.left, rect.top);
        wrap.classList.add('snapping');
        wrap.style.left = `${snapped.x}px`;
        wrap.style.top = `${snapped.y}px`;
        savePosition(snapped);
        wrap.dataset.dragged = '1';
        setTimeout(() => { delete wrap.dataset.dragged; }, 0);
      }
    });
    wrap.addEventListener('click', (e) => {
      if (wrap.dataset.dragged) { e.stopImmediatePropagation(); e.preventDefault(); }
    }, true);
  }

  /* ============================================================
   * R59 滚动复习词卡（对齐 magicbook R285/R289）
   * ============================================================
   * 球旁常驻纯文字词卡轮播（不出声、不计费）：SRS 到期队列（due_at<=now 含积压）
   * 20 词前端洗牌，8s/词；「认识」= GET /vocabulary/known/{word} 毕业/移出队列
   * （复用 ML_MARK，不写复习日志、不计 x/20——R285 口径）。
   * R289 详情分页：数据只来自 /vocabulary/detail/cached-batch（moon-well R248
   * 只读缓存零计费），每词「基本意思前 2 义项 + 1 随机模块」≤4 页、同词连翻、
   * 每页 line-clamp 3 硬钳；无缓存词/端点未发生产/加载失败 → 回退简卡。
   * 计费红线：绝不调 /vocabulary/detail/{word}——缓存 miss 现场生成（计费 +
   * 15~30s），轮播是无人操作的被动卡片，翻页不许变成隐藏下单（R289 同源）。
   *
   * 与 magicbook 的差异（Why）：
   * - 存储口径：暂停/收起标志走 chrome.storage.local（扩展禁污染宿主 localStorage，
   *   fabPos 同款）；magicbook 用页面 localStorage 是站内特权，不能照抄。
   * - 抽屉开合感知：magicbook 同页查询 DOM；扩展抽屉是另一个 closed shadow，
   *   事件（chat.js open/close 派发 magiclens-chat）是唯一感知通道。
   * - 未登录静默：magicbook 模板层登录守卫不渲染容器；扩展只能探到 resp.auth，
   *   auth 失败时隐藏卡片不发请求，登录成功（storage token 变更）自动重试。
   * ============================================================ */
  const REVIEW_QUEUE_MSG = MSG.ML_REVIEW_QUEUE;
  const REVIEW_DETAIL_MSG = MSG.ML_REVIEW_DETAIL_BATCH;
  const REVIEW_MAX = 20;
  const REVIEW_INTERVAL_MS = 8000;
  const REVIEW_PAUSED_KEY = 'magiclens.reviewPaused';
  const REVIEW_COLLAPSED_KEY = 'magiclens.reviewCollapsed';
  // 与 magicbook web.py 的 _READING_WORD_RE 同形：不合法词不给一个必然 400 的「认识」按钮
  const REVIEW_WORD_RE = /^[A-Za-z](?:[A-Za-z'\u2019-]*[A-Za-z])?$/;
  const review = {
    items: [], index: 0, timer: null, loading: false, inFlight: false,
    paused: false, collapsed: false, failed: false, markError: '',
    authFailed: false, drawerOpen: false,
    // R289 详情分页：pages = 归一词 → 页数组（每页 {label, text}），page = 当前词内页下标；
    // pages 为空 = 简卡回退（义项 + 原句 + 出处）
    pages: {}, page: 0,
  };
  let rvwEls = null;          // 词卡内部节点引用（build 时装配）
  let onChatDrawerEvent = null; // 抽屉开合事件处理器（teardown 时摘除）

  function reviewWordKey(word) {
    // 与上游 cached-batch 的归一口径一致（trim → 弯撇号转直撇号 → 小写），pages 按此键存取
    return String(word || '').trim().replace(/\u2019/g, "'").toLowerCase();
  }

  function reviewSet(id, value) {
    const el = rvwEls && rvwEls[id];
    if (el) el.textContent = value == null ? '' : String(value);
  }

  function reviewCurrent() {
    return review.items.length ? review.items[review.index % review.items.length] : null;
  }

  function reviewShuffled(list) {
    const a = list.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = a[i]; a[i] = a[j]; a[j] = tmp;
    }
    return a;
  }

  function reviewReadFlag(key) {
    return new Promise((resolve) => {
      chrome.storage.local.get({ [key]: false }, (store) => {
        resolve(!chrome.runtime.lastError && store[key] === true);
      });
    });
  }

  function reviewWriteFlag(key, on) {
    chrome.storage.local.set({ [key]: on === true }, () => void chrome.runtime.lastError);
  }

  /* ---------- R289 详情分页装配（逐段移植 magicbook reviewDetailPages） ----------
   * Why 每词只展示「基本意思 + 一个随机模块」（magicbook 2026-11-08 拍板）：六板块
   * 全上一个词要停 30~60s，滚动复习是路过瞄一眼的被动卡片，太长就成了阅读任务。
   * 随机在队列加载时定一次，同一轮内稳定，下次拉队列重新洗。 */
  function reviewModuleLabel(kind) {
    const labels = {
      etymology: '词源', phrases: '搭配', forms: '词形',
      synonyms: '同义词', antonyms: '反义词', slang: '俚语', funFacts: '趣闻',
    };
    return labels[kind] || '';
  }

  function reviewPushModulePage(pages, kind, text) {
    const body = String(text || '').trim();
    if (!body) return;
    pages.push({ label: reviewModuleLabel(kind), text: body });
  }

  // 词源是一整段：按句切、约 60 字装一页，最多 2 页（避免长词源霸屏）
  function reviewAppendEtymologyPages(pages, etymology) {
    const sentences = String(etymology).match(/[^。！？!?]+[。！？!?]?/g) || [];
    let buf = '';
    let count = 0;
    for (let i = 0; i < sentences.length && count < 2; i++) {
      const s = sentences[i].trim();
      if (!s) continue;
      if (buf && (buf + s).length > 60) {
        reviewPushModulePage(pages, 'etymology', buf);
        count += 1;
        buf = '';
      }
      buf = buf ? buf + s : s;
    }
    if (buf && count < 2) reviewPushModulePage(pages, 'etymology', buf);
  }

  // 从非空板块里随机挑一个，装配 ≤2 页
  function reviewAppendModulePages(pages, kind, detail) {
    if (kind === 'etymology') { reviewAppendEtymologyPages(pages, detail.etymology); return; }
    if (kind === 'phrases' || kind === 'slang') {
      const items = (detail[kind] || []).slice(0, 2);
      for (const it of items) {
        const o = it || {};
        const text = kind === 'phrases'
          ? [o.phrase, o.meaning].filter(Boolean).join('　')
          : [o.meaning, o.example].filter(Boolean).join('\n');
        reviewPushModulePage(pages, kind, text);
      }
      return;
    }
    if (kind === 'forms') {
      const lines = (detail.forms || []).slice(0, 6).map((f) => {
        if (!f || !f.form) return '';
        return f.form + (f.type ? `（${f.type}）` : '');
      }).filter(Boolean);
      if (lines.length) reviewPushModulePage(pages, 'forms', lines.join('\n'));
      return;
    }
    if (kind === 'synonyms' || kind === 'antonyms') {
      const names = (detail[kind] || []).slice(0, 8).map((w) => w && w.word).filter(Boolean);
      if (names.length) reviewPushModulePage(pages, kind, names.join('、'));
      return;
    }
    if (kind === 'funFacts') {
      const facts = (detail.funFacts || []).slice(0, 2);
      for (const fact of facts) reviewPushModulePage(pages, 'funFacts', fact);
    }
  }

  // 页装配总入口：基本意思（前 2 个义项）+ 随机模块（≤2 页），单词总数 ≤4
  function reviewDetailPages(detail) {
    const pages = [];
    if (!detail || typeof detail !== 'object') return pages;
    const meanings = Array.isArray(detail.meaning) ? detail.meaning : [];
    for (let i = 0; i < meanings.length && pages.length < 2; i++) {
      const m = meanings[i] || {};
      let line = (m.pos ? m.pos + '. ' : '') + String(m.sense || '').trim();
      if (!line) continue;
      if (m.example) line += `\n${String(m.example).trim()}`;
      pages.push({ label: '', text: line });
    }
    const pool = [];
    if (detail.etymology && String(detail.etymology).trim()) pool.push('etymology');
    if (Array.isArray(detail.phrases) && detail.phrases.length) pool.push('phrases');
    if (Array.isArray(detail.forms) && detail.forms.length) pool.push('forms');
    if (Array.isArray(detail.synonyms) && detail.synonyms.length) pool.push('synonyms');
    if (Array.isArray(detail.antonyms) && detail.antonyms.length) pool.push('antonyms');
    if (Array.isArray(detail.slang) && detail.slang.length) pool.push('slang');
    if (Array.isArray(detail.funFacts) && detail.funFacts.length) pool.push('funFacts');
    if (pool.length) {
      reviewAppendModulePages(pages, pool[Math.floor(Math.random() * pool.length)], detail);
    }
    return pages;
  }

  function reviewPagesFor(item) {
    return review.pages[reviewWordKey(item && item.word)] || null;
  }

  // 队列拉到后批量补详情。失败/空结果都静默回退简卡：详情是增强层，卡片的核心
  // 功能（轮播 + 认识）不依赖它——失败不可见是设计口径（R289 同源）。
  function reviewLoadDetails() {
    if (!review.items.length) return;
    const words = review.items.map((it) => String(it.word || '')).filter(Boolean).slice(0, REVIEW_MAX);
    if (!words.length) return;
    bg({ type: REVIEW_DETAIL_MSG, words }).then((resp) => {
      if (!resp.ok) throw new Error('details unavailable');
      const data = resp.data;
      if (!data || typeof data !== 'object') throw new Error('details unavailable');
      const pages = {};
      review.items.forEach((it) => {
        const key = reviewWordKey(it.word);
        const built = reviewDetailPages(data[key]);
        if (built.length) pages[key] = built;
      });
      review.pages = pages;
      review.page = 0;
    }).catch(() => {
      review.pages = {};
    }).then(() => reviewRender());
  }

  // 纯展示：任一「用户不在看」或「已有浮层」态都只跳过本次 tick，不重置计时器、不发请求。
  // 页面生命周期内队列只在初始化拉一次，不轮询（R243 口径同源）。
  function reviewPageActive() {
    if (document.visibilityState === 'hidden') return false;
    if (document.hasFocus()) return true;
    // 焦点进 iframe（阅读器/嵌入页）时顶层 hasFocus() 可能 false，但用户明明还在
    // 本页——activeElement 是 IFRAME 就仍算页面内活跃（magicbook R285 同款豁免）
    const el = document.activeElement;
    return !!(el && el.tagName === 'IFRAME');
  }

  function reviewShouldPause() {
    // inFlight 必须算暂停：标记请求在途时若让 tick 推进 index，回来会删错词（R285 S1）
    return review.loading || review.failed || review.inFlight || review.paused ||
      review.collapsed || review.items.length === 0 || !reviewPageActive() ||
      (wrap && wrap.classList.contains('bubbles-open')) || review.drawerOpen;
  }

  // 球可拖拽吸附到左右边缘：词卡按球 rect 贴上方，左缘吸附时改贴左，
  // 上方空间不足时翻到球下方，避免被视口裁掉或压住伙伴头像（R285 同款）
  function reviewPosition() {
    const root = rvwEls && rvwEls.root;
    if (!root || !wrap || root.hidden) return;
    const rect = wrap.getBoundingClientRect();
    const w = root.offsetWidth || 280;
    const h = root.offsetHeight || 150;
    const leftSide = rect.left + rect.width / 2 < window.innerWidth / 2;
    let left = leftSide ? rect.left : rect.right - w;
    left = Math.max(8, Math.min(left, window.innerWidth - w - 8));
    let top = rect.top - h - 12;
    if (top < 8) top = rect.bottom + 12;
    root.classList.toggle('is-left', leftSide);
    root.classList.toggle('is-below', top > rect.bottom);
    root.style.left = `${Math.round(left)}px`;
    root.style.top = `${Math.round(top)}px`;
  }

  /* R63：协议漂移的错误话术。
   * Why：MV3 解包扩展改了消息表后，service worker 只有在 chrome://extensions 点「重新加载」
   * （或扩展更新）才会重新注册——Chrome 的 SW 脚本缓存还会把旧 background.js/rpc.js 一并
   * 留住跑下去。此时页面里是新版 content script（有滚动复习卡），SW 却还是旧构建，
   * 新消息类型落到旧代码的 default 分支，回来的就是裸的 'unknown message type'。
   * 用户看到英文内部错误无从下手，点「重试」也只是同样失败（SW 不会自愈）。
   * How：只把这两类「环境/生命周期」错误翻成可执行的中文指引；后端业务错误原样透出
   *（失败必须在界面上可见，静默降级会把接口故障伪装成空数据——家族口径）。 */
  function reviewErrorText(error) {
    const raw = String(error || '');
    if (/unknown message type/i.test(raw)) {
      return '扩展版本未同步：请在 chrome://extensions 重新加载扩展，再刷新本页';
    }
    if (/invalidated|disposed/i.test(raw)) {
      return '扩展已更新，请刷新本页后重试';
    }
    return raw || '复习词拉取失败';
  }

  function reviewShowError(message) {
    review.failed = true;
    reviewSet('errorText', message);
    if (rvwEls) {
      rvwEls.error.hidden = false;
      rvwEls.body.hidden = true;
    }
  }

  function reviewClearError() {
    review.failed = false;
    if (rvwEls) {
      rvwEls.error.hidden = true;
      rvwEls.body.hidden = false;
    }
  }

  function reviewRender() {
    const root = rvwEls && rvwEls.root;
    if (!root) return;
    // 未登录：词卡整体隐藏、不发请求；登录成功后 storage token 变更会重试
    root.hidden = !!review.authFailed;
    if (root.hidden) return;
    root.classList.toggle('is-collapsed', review.collapsed);
    const peek = rvwEls.peek;
    if (peek) {
      peek.hidden = !review.collapsed;
      peek.textContent = review.collapsed ? String(review.items.length) : '';
      peek.title = '展开复习';
    }
    if (review.collapsed) { reviewPosition(); return; }

    const toggle = rvwEls.toggle;
    if (toggle) {
      toggle.textContent = review.paused ? '▶' : '❚❚';
      toggle.title = review.paused ? '继续复习' : '暂停复习';
    }
    reviewSet('title', '滚动复习');
    reviewSet('next', '下一个');
    reviewSet('known', '认识');

    const item = reviewCurrent();
    if (!item) {
      reviewSet('progress', '');
      reviewSet('word', '');
      reviewSet('meaning', '');
      reviewSet('context', '');
      reviewSet('source', '');
      reviewSet('detail', '');
      reviewSet('status', review.loading ? '正在拉取复习词…' : '暂无到期复习词');
      if (rvwEls) { rvwEls.known.disabled = true; rvwEls.next.disabled = true; }
      reviewPosition();
      return;
    }
    // R289 详情页模式：词面常驻，正文显示当前页（≤3 行）；进度带页码。
    // 无详情页的词回退简卡（义项 + 原句 + 出处），两态互斥由 pages 空/非空表达。
    const pages = reviewPagesFor(item);
    let pageNo = 0;
    if (pages && pages.length) pageNo = Math.min(review.page, pages.length - 1);
    reviewSet('progress', `${review.index + 1}/${review.items.length}` +
      (pages && pages.length > 1 ? ` · ${pageNo + 1}/${pages.length}` : ''));
    // 服务端内容一律 textContent：meaning / contextSentence / 详解六板块都来自 ES，禁拼 HTML
    reviewSet('word', item.word);
    if (pages && pages.length) {
      const page = pages[pageNo];
      reviewSet('detail', page.label ? `${page.label}：${page.text}` : page.text);
      reviewSet('meaning', '');
      reviewSet('context', '');
      reviewSet('source', '');
    } else {
      reviewSet('detail', '');
      reviewSet('meaning', item.meaning || '');
      reviewSet('context', item.contextSentence || '');
      reviewSet('source', item.contextBook || '');
    }
    // 「认识」失败的原因要留到用户下一次操作；render 每次重画状态行，错误文案存在
    // review.markError 里而不是直接写 DOM（R285 M3 口径）
    reviewSet('status', review.markError);
    if (rvwEls) rvwEls.status.classList.toggle('is-error', !!review.markError);
    const known = rvwEls && rvwEls.known;
    if (known) {
      // 后端先归一再校验（trim → 弯撇号转直撇号 → 小写），前端照做才不会误禁用
      const normalized = String(item.word || '').trim().replace(/\u2019/g, "'").toLowerCase();
      const ok = REVIEW_WORD_RE.test(normalized) && normalized.length <= 64;
      known.disabled = !ok || review.inFlight;
      known.title = ok ? '认识（移出复习队列）' : '该词无法在此标记';
    }
    if (rvwEls) rvwEls.next.disabled = review.inFlight;
    reviewPosition();
  }

  function reviewTick() {
    if (reviewShouldPause()) return;
    // R289：先在当前词内翻页（若有），翻完才换词。markError 只在换词时清——
    // 「认识」失败的原因属于这个词，翻它的下一页时仍应可见（M3 口径）
    const pages = reviewPagesFor(reviewCurrent());
    if (pages && pages.length && review.page < pages.length - 1) {
      review.page += 1;
    } else {
      review.markError = '';
      review.index = (review.index + 1) % review.items.length;
      review.page = 0;
    }
    reviewRender();
  }

  function reviewLoad() {
    if (!rvwEls || review.loading) return;
    review.loading = true;
    review.markError = '';
    reviewClearError();
    reviewRender();
    bg({ type: REVIEW_QUEUE_MSG }).then((resp) => {
      // 未登录（callApi 返回 auth:true）：卡片整体隐藏、不发后续请求——
      // 扩展侧登录守卫，避免每个网页都挂一块「请先登录」的常驻错误卡
      if (resp.auth) {
        review.authFailed = true;
        review.loading = false;
        reviewRender();
        return;
      }
      // R63：走 reviewErrorText——版本漂移/上下文失效翻成可执行指引，业务错误原样透出
      if (!resp.ok) throw new Error(reviewErrorText(resp.error));
      const data = resp.data;
      if (!Array.isArray(data)) throw new Error('复习词拉取失败');
      review.items = reviewShuffled(data.filter((it) => it && typeof it.word === 'string' && it.word.trim()))
        .slice(0, REVIEW_MAX);
      review.index = 0;
      review.pages = {}; // 新队列 = 新随机模块选择，旧页表全部作废
      review.page = 0;
      if (review.items.length) reviewLoadDetails();
    }).catch((err) => {
      reviewShowError((err && err.message) || '复习词拉取失败');
    }).then(() => {
      review.loading = false;
      reviewRender();
    });
  }

  function reviewAdvance() {
    if (!review.items.length) return;
    review.markError = '';
    review.index = (review.index + 1) % review.items.length;
    review.page = 0;
    reviewRender();
  }

  function reviewMarkKnown() {
    const item = reviewCurrent();
    if (!item || review.inFlight) return;
    // 请求可能跨过一个 8s tick；删词只能按点击瞬间的下标，不能用回来时的 index（R285 S1）
    const markedIndex = review.index;
    const word = String(item.word || '');
    review.inFlight = true;
    reviewRender();
    bg({ type: MSG.ML_MARK, word, known: true }).then((resp) => {
      if (!resp.ok) throw new Error(resp.error || '标记失败，请稍后重试');
      // 上游把 SRS 行异步毕业；本地先移除，避免 8 秒后它又滚回来。
      // 失败时什么都不改，卡片留在原地并显出原因。
      review.items.splice(markedIndex, 1);
      delete review.pages[reviewWordKey(word)]; // R289：页表随词一起移除
      review.page = 0;
      if (review.index > markedIndex) review.index -= 1;
      if (review.index >= review.items.length) review.index = 0;
      review.markError = '';
      reviewClearError();
    }).catch((err) => {
      review.markError = (err && err.message) || '标记失败，请稍后重试';
    }).then(() => {
      review.inFlight = false;
      reviewRender();
    });
  }

  function reviewSetPaused(on) {
    review.paused = !!on;
    reviewWriteFlag(REVIEW_PAUSED_KEY, review.paused);
    reviewRender();
  }

  function reviewSetCollapsed(on) {
    review.collapsed = !!on;
    reviewWriteFlag(REVIEW_COLLAPSED_KEY, review.collapsed);
    reviewRender();
  }

  /* ---------- 词卡 DOM（build 时装配进球 shadow root，wrap 的兄弟节点） ----------
   * Why 不进 wrap：wrap 上有 mouseenter→径向气泡与 pointerdown→拖拽，塞进去会
   * 出现「鼠标移到卡片上卡片反而被气泡遮住」并抢走拖拽命中区（R285 同源教训）。 */
  function buildReviewDom() {
    const root = document.createElement('div');
    root.className = 'rvw';
    root.hidden = true;
    root.innerHTML = `
      <div class="rvw-head">
        <span class="rvw-title"></span>
        <span class="rvw-progress"></span>
        <button type="button" class="rvw-icon rvw-toggle"></button>
        <button type="button" class="rvw-icon rvw-collapse">×</button>
      </div>
      <div class="rvw-body">
        <div class="rvw-word-row">
          <span class="rvw-word"></span>
          <span class="rvw-meaning"></span>
        </div>
        <div class="rvw-detail"></div>
        <div class="rvw-context"></div>
        <div class="rvw-source"></div>
        <div class="rvw-actions">
          <button type="button" class="rvw-btn rvw-next"></button>
          <button type="button" class="rvw-btn rvw-known primary"></button>
        </div>
        <div class="rvw-status"></div>
      </div>
      <div class="rvw-error" hidden><span class="rvw-error-text"></span><button type="button" class="rvw-retry">重试</button></div>
      <button type="button" class="rvw-peek" hidden></button>`;
    rvwEls = {
      root,
      title: root.querySelector('.rvw-title'),
      progress: root.querySelector('.rvw-progress'),
      toggle: root.querySelector('.rvw-toggle'),
      body: root.querySelector('.rvw-body'),
      word: root.querySelector('.rvw-word'),
      meaning: root.querySelector('.rvw-meaning'),
      detail: root.querySelector('.rvw-detail'),
      context: root.querySelector('.rvw-context'),
      source: root.querySelector('.rvw-source'),
      next: root.querySelector('.rvw-next'),
      known: root.querySelector('.rvw-known'),
      status: root.querySelector('.rvw-status'),
      error: root.querySelector('.rvw-error'),
      errorText: root.querySelector('.rvw-error-text'),
      retry: root.querySelector('.rvw-retry'),
      collapse: root.querySelector('.rvw-collapse'),
      peek: root.querySelector('.rvw-peek'),
    };
    // 卡片上的点击/按下都不该穿透成球的点击或拖拽（卡片虽在 wrap 外，
    // 但事件会冒到 document 层的全局监听）
    root.addEventListener('click', (e) => e.stopPropagation());
    root.addEventListener('pointerdown', (e) => e.stopPropagation());
    return root;
  }

  function initReview() {
    if (!rvwEls) return;
    // 拖拽/吸附过渡有 0.22s left/top 插值，pointerup/transitionend 当帧读不到终位
    wrap.addEventListener('transitionend', (e) => {
      if (e.propertyName === 'left' || e.propertyName === 'top') reviewPosition();
    });
    wrap.addEventListener('pointerup', () => setTimeout(reviewPosition, 260));
    window.addEventListener('resize', reviewPosition);

    rvwEls.toggle.addEventListener('click', (e) => { e.stopPropagation(); reviewSetPaused(!review.paused); });
    rvwEls.collapse.addEventListener('click', (e) => { e.stopPropagation(); reviewSetCollapsed(true); });
    rvwEls.peek.addEventListener('click', (e) => { e.stopPropagation(); reviewSetCollapsed(false); });
    rvwEls.next.addEventListener('click', (e) => { e.stopPropagation(); reviewAdvance(); });
    rvwEls.known.addEventListener('click', (e) => { e.stopPropagation(); reviewMarkKnown(); });
    rvwEls.retry.addEventListener('click', (e) => { e.stopPropagation(); reviewLoad(); });

    // 抽屉开合感知（chat.js open/close 派发 magiclens-chat）：抽屉开着时暂停轮播
    onChatDrawerEvent = (ev) => {
      review.drawerOpen = !!(ev && ev.detail && ev.detail.open);
      reviewRender();
    };
    window.addEventListener('magiclens-chat', onChatDrawerEvent);
    // 命名句柄：teardown 时必须成对摘除——球会随开关反复 build/remove，
    // 匿名句柄会按次数累积监听（球在设置页开关一次就多挂一个）
    window.addEventListener('resize', onReviewResize);
    window.addEventListener('pagehide', onReviewPageHide);
    window.addEventListener('pageshow', onReviewPageShow);

    Promise.all([
      reviewReadFlag(REVIEW_PAUSED_KEY),
      reviewReadFlag(REVIEW_COLLAPSED_KEY),
    ]).then(([paused, collapsed]) => {
      review.paused = paused;
      review.collapsed = collapsed;
      reviewStartTimer();
      reviewLoad();
    });
  }

  // bfcache 返回时 pagehide 已清掉 timer，必须重建，否则轮播永久停摆（R285 同款）
  function reviewStartTimer() {
    if (!review.timer) review.timer = setInterval(reviewTick, REVIEW_INTERVAL_MS);
  }
  function onReviewResize() { reviewPosition(); }
  function onReviewPageHide() {
    if (review.timer) { clearInterval(review.timer); review.timer = null; }
  }
  function onReviewPageShow(event) {
    if (event && event.persisted) { reviewStartTimer(); reviewRender(); }
  }

  function teardownReview() {
    if (review.timer) { clearInterval(review.timer); review.timer = null; }
    if (onChatDrawerEvent) {
      window.removeEventListener('magiclens-chat', onChatDrawerEvent);
      onChatDrawerEvent = null;
    }
    window.removeEventListener('resize', onReviewResize);
    window.removeEventListener('pagehide', onReviewPageHide);
    window.removeEventListener('pageshow', onReviewPageShow);
    // 球被移除=卡片随 shadow 整体消失；状态复位等下次 build 全新开轮（旧队列不跨球复用）
    review.items = [];
    review.pages = {};
    review.index = 0;
    review.page = 0;
    review.loading = false;
    review.inFlight = false;
    review.failed = false;
    review.markError = '';
    review.drawerOpen = false;
    rvwEls = null;
  }

  /* ---------- 显隐（R54 v1 口径不变） ---------- */
  function sync() {
    chrome.storage.sync.get(__magicLensDefaults, (cfg) => {
      if (chrome.runtime.lastError) return;
      const want = window.__magicLensBallVisible(cfg, location.hostname, window === window.top);
      if (want && !visible) { build(); applySavedPosition(); }
      else if (!want && visible) remove();
    });
  }

  __magicLensRpc.onInvalidated(remove);
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'sync') return;
    if (changes.enabled || changes.ballEnabled || changes.disabledDomains) sync();
    // R59：未登录时复习卡静默隐藏；登录成功（token 落库）自动补拉一次队列
    if (changes.token && review.authFailed && visible && rvwEls) reviewLoad();
  });
  sync();
})();
