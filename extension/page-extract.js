/* MagicLens 页面上下文采集器（P0 简版，LLD §4.3）。
 * Why 发送时才采集：SPA 页面内容随时变，发送瞬间取视口相关正文天然规避陈旧上下文。
 * 输出对齐 moon-well AgentChatRequest：pageText ≤6000（给服务端 8000 截断留余量）。 */
(() => {
  if (window.__magicLensExtractLoaded) return;
  window.__magicLensExtractLoaded = true;

  const MAX_PAGE_TEXT = 6000;
  // Why 不含 SPAN：行内 span 噪声大（按钮/导航标签），段落级标签足够
  const TEXT_TAGS = 'P,LI,BLOCKQUOTE,TD,TH,DD,DT,H1,H2,H3,H4,H5,PRE';

  function visible(el) {
    const r = el.getBoundingClientRect();
    if (r.width < 40 || r.height < 8) return false;
    // 视口上下各放宽一段：滚动位置附近的正文也算
    if (r.bottom < -200 || r.top > innerHeight + 400) return false;
    const s = getComputedStyle(el);
    if (s.visibility === 'hidden' || s.display === 'none' || parseFloat(s.opacity) < 0.1) return false;
    return true;
  }

  function collectPageContext() {
    let title = '';
    try { title = (document.title || '').trim().slice(0, 500); } catch { /* 忽略 */ }

    const paragraphs = [];
    const seen = new Set();
    let total = 0;
    try {
      const walker = document.createTreeWalker(
        document.body, NodeFilter.SHOW_ELEMENT,
        { acceptNode: (el) => (el.matches(TEXT_TAGS) && visible(el) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT) }
      );
      while (walker.nextNode()) {
        const el = walker.currentNode;
        // 跳过 MagicLens 自己的 UI 与表单类噪声
        if (el.closest('#magiclens-host, #magiclens-chat-host, script, style, noscript, textarea, input, select')) continue;
        const text = (el.innerText || '').replace(/\s+/g, ' ').trim();
        if (text.length < 2 || seen.has(text)) continue;
        seen.add(text);
        if (total + text.length + 1 > MAX_PAGE_TEXT) break;
        paragraphs.push(text);
        total += text.length + 1;
      }
    } catch { /* 页面异常时退化为只带标题 */ }

    return {
      bookId: null,          // 网页场景判据，服务端落 0
      bookTitle: title,
      authors: null,
      chapter: null,
      pageText: paragraphs.join('\n'),
      unfamiliarWords: null, // US5 生词标注落地后接入
    };
  }

  // 与 content.js / chat.js 同处隔离世界，直接挂全局供 chat.js 调用
  window.__magicLensCollectPageContext = collectPageContext;
})();
