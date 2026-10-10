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
    chrome.runtime.sendMessage({ type: 'ml:selection', text, rect: mapped }, () => {
      void chrome.runtime.lastError; // 扩展刚更新、顶层尚未装载时无人接收，静默即可
    });
  }

  // 与顶层同节奏：mouseup 后延迟一帧等选区稳定；双击选词也会触发 mouseup
  const onMouseUp = () => setTimeout(report, 60);
  document.addEventListener('mouseup', onMouseUp, true);
  document.addEventListener('touchend', () => setTimeout(report, 80), true);
})();
