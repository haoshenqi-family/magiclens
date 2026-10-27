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
    shadow.append(style, wrap);
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
  });
  sync();
})();
