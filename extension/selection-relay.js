/* MagicLens iframe 选区中继（R36，all_frames 注入）。
 *
 * Why 单独一个脚本而不是复用 highlight.js 的 per-doc 装配：划词是主能力，生词高亮只是
 * 它的一个开关（popup / Alt+U / 域名禁用）。挂在高亮引擎的文档装配里，关掉高亮或换页
 * 重扫就会连带把阅读器里的划词一起带走——那是 R34 初版留下的耦合缺陷。
 *
 * Why 不在 iframe 里直接画气泡：content.js 只在顶层文档运行（气泡与按钮链路、详解面板、
 * 伴读抽屉都只有这一份属主），iframe 内只负责「采集自己文档的选区」，经 background 投回
 * 同一 tab 的顶层文档呈现，普通网页的划词路径一行未改。
 *
 * 顶层文档直接退出：那里的选区已由 content.js 的 mouseup 处理，两处同开会双气泡、双发
 * 翻译请求。 */
(() => {
  const MSG = __magicLensRpc.MSG;
  if (window === window.top) return; // 顶层交给 content.js
  if (window.__magicLensRelayLoaded) return; // 同文档重复注入保护
  window.__magicLensRelayLoaded = true;

  /** 本帧 viewport 坐标 → 顶层 viewport 坐标。
   * Why 逐层累加 frameElement 的矩形：同源才拿得到 frameElement（跨源返回 null 或抛错），
   * 拿不到就放弃上报——与扩展既有边界一致（跨源 iframe 本就不处理）。 */
  function toTopViewport(rect) {
    let left = rect.left, top = rect.top, bottom = rect.bottom;
    let w = window;
    try {
      while (w !== window.top) {
        const fe = w.frameElement;
        if (!fe) return null;
        const r = fe.getBoundingClientRect();
        left += r.left;
        top += r.top;
        bottom += r.top;
        w = w.parent;
      }
    } catch {
      return null;
    }
    return { left, top, bottom };
  }

  // 扩展重载后仍留在页上的旧副本：chrome.runtime 对象还在，但上下文已失效，任何调用
  // 都会抛 "Extension context invalidated"——孤立世界里没有源文件与行号，真机上就表现成
  // 「Error://(:0)」这种无名报错。这里一次性取版本号，取不到就整体退出、不注册任何监听。
  let extVersion;
  try { extVersion = chrome.runtime.getManifest().version; } catch { return; }

  function report() {
    let sel;
    try { sel = window.getSelection(); } catch { return; } // 文档可能已随翻章销毁
    if (!sel || sel.isCollapsed || sel.rangeCount === 0) return; // 取消选区不弹：收起另有路径
    const text = String(sel.toString()).replace(/\s+/g, ' ').trim();
    if (!text) return;
    let rect;
    try { rect = sel.getRangeAt(0).getBoundingClientRect(); } catch { return; }
    if (!rect.width && !rect.height) return; // 选区不可见（折叠元素内等）
    const mapped = toTopViewport(rect);
    if (!mapped) return;
    try {
      chrome.runtime.sendMessage({ type: MSG.ML_SELECTION, text, rect: mapped }, () => {
        void chrome.runtime.lastError; // 顶层尚未装载（站点禁用/刚重载）时无人接收，静默即可
      });
    } catch {
      retire(); // 发消息这一刻上下文已失效：摘掉自己，不要再抛第二次
    }
  }

  // 能力握手标记（R37）：写在**本文档**上，供宿主页面（magicbook 阅读器）逐项判断
  // 「本帧的拖选划词确实已被接管」，从而关掉自己那份内置气泡。Why 写在帧级而不是只写
  // 顶层：装了扩展 ≠ 这条能力在此处通（about:srcdoc 注入不进去就是现例子）；宿主读不到
  // 这个标记就继续自己干，不留能力空白。
  document.documentElement.dataset.magiclensSelection = extVersion;

  // 与顶层同节奏：mouseup 后延迟一帧等选区稳定；双击选词也会触发 mouseup
  const onMouseUp = () => setTimeout(report, 60);
  const onTouchEnd = () => setTimeout(report, 80);

  // Why 具名 + 可摘除：上下文失效时要能自我退役（匿名监听摘不掉，会在页上留一个
  // 每次点击都抛错的幽灵副本）
  function retire() {
    document.removeEventListener('mouseup', onMouseUp, true);
    document.removeEventListener('touchend', onTouchEnd, true);
    delete document.documentElement.dataset.magiclensSelection; // 同时收回接管声明，宿主好把内置找回来
  }

  document.addEventListener('mouseup', onMouseUp, true);
  document.addEventListener('touchend', onTouchEnd, true);
})();
