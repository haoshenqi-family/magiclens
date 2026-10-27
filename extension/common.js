/* MagicLens 共享助手（无构建链，content script 与扩展页各自挂载）：
 * 域名管理（R25）的归一化与禁用匹配。content script 侧经 window.__magicLens*
 * 在隔离世界共享（与 content/highlight 的钩子同模式）；options/popup 以
 * <script src="common.js"> 直挂后使用。 */
(() => {
  const g = typeof window !== 'undefined' ? window : globalThis;

  /* R46（架构评审 L5）：设置默认值单点——五处 chrome.storage.sync.get 的
   * 内联默认对象（background/content/highlight/popup/options）统一引用本表，
   * 新增设置键只改这里。apiBase 是公网入口兜底（设置页不提供手改，见 design §3）。 */
  g.__magicLensDefaults = Object.freeze({
    enabled: true,
    hlEnabled: true,
    autoTranslate: true,
    token: '',
    refreshToken: '',
    apiBase: 'https://moon-well.haoshenqi.top',
    disabledDomains: [],
    // R54 常驻入口（悬浮球）：默认关闭——是否常驻交给用户选择，首次安装由设置页
    // 引导卡片问一次（ballAsked 记录「已表态」，问过就不再弹）；存量用户升级后
    // 不突现悬浮球，想要时设置页自行打开
    ballEnabled: false,
    ballAsked: false,
  });

  if (g.__magicLensNormDomain) return;

  /** 输入归一化为 hostname：小写、剥协议/端口/路径/末尾点/`*.` 前缀。
   * Why 借道 URL：免手写解析（IPv6/大小写/末尾点等边角）；非法输入返回 null，
   * 由调用方（UI 添加/门控匹配）拒收。无协议输入补 http:// 以便解析；
   * 端口不保留——域名禁用语义按主机不按端口（禁 localhost 即禁所有端口）。 */
  g.__magicLensNormDomain = (input) => {
    let s = String(input || '').trim().toLowerCase();
    if (!s) return null;
    s = s.replace(/^\*\./, ''); // *.example.com 与 example.com 同语义（本就含子域）
    if (!/^[a-z][a-z0-9+.-]*:\/\//.test(s)) s = `http://${s}`;
    try {
      const u = new URL(s);
      return u.hostname ? u.hostname.replace(/\.$/, '') : null;
    } catch {
      return null;
    }
  };

  /** host 是否命中禁用名单：条目等于 host，或 host 是条目的子域
   *（example.com 同时禁住 a.b.example.com）。list 非法时按空名单处理。 */
  g.__magicLensIsDisabledHost = (host, list) => {
    const h = String(host || '').toLowerCase().replace(/\.$/, '');
    if (!h) return false;
    return (Array.isArray(list) ? list : []).some((d) => {
      const n = g.__magicLensNormDomain(d);
      return Boolean(n) && (h === n || h.endsWith(`.${n}`));
    });
  };

  /** R54 常驻入口（悬浮球）可见性判定：主开关 + 悬浮球开关 + 顶层文档 + 域名管理
   * 名单（复用 __magicLensIsDisabledHost，与划词/高亮同一份禁用语义）。
   * 纯函数入 common.js：ball.js 每次显隐判定与 node 冒烟共用同一实现。 */
  g.__magicLensBallVisible = (cfg, host, isTop) =>
    Boolean(isTop && cfg && cfg.enabled && cfg.ballEnabled
      && !g.__magicLensIsDisabledHost(host, cfg.disabledDomains));

  /** 上游错误详情不进 UI（R32 用户反馈：报错详情用户看不懂也不想了解）：
   * 疑似技术细节（URL/内部 IP/英文异常/网关标识）归一为通用文案，原文进
   * console 供排查；干净的业务文案（未登录/积分不足/选区过长等）原样放行。
   * Why 防御层而非全量替换：moon-well R124 起服务端已返回干净文案，此层兜住
   * 网络层报错与任何漏改路径；fallback 由调用方按场景给出（翻译/标记/详解）。 */
  g.__magicLensUserFacingError = (msg, fallback) => {
    const raw = String(msg || '');
    if (!raw) return fallback || '';
    if (/https?:\/\/|(\d{1,3}\.){3}\d{1,3}|Exception|I\/O error|timed out|call failed|Failed to fetch/i.test(raw)) {
      console.warn('[MagicLens] 上游错误详情：', raw);
      return fallback || '服务暂时不可用，请稍后重试';
    }
    return raw;
  };

  /* R52（对齐 magicbook R232/R233）：伴读 AI 回复「站内」归宿。AI 提示词里的
   * /me、/credits、/book/N 等路径都是 magicbook 站点路径；Why 不取
   * window.location——扩展 content script 的 location 是宿主页，与站内语义无关。
   * 与 apiBase 兜底同口径（设置页不提供手改），改域名两处一起改。 */
  g.__magicLensSiteOrigin = 'https://magicbook.haoshenqi.top';

  /** 助手消息安全渲染（R52，安全口径移植 magicbook ai_chat.js renderMarkdown·R233）：
   * 先整段 HTML 转义，再只把「magicbook 站内」目标还原为受控 <a>——Markdown 链接
   * [文本](/path)、裸站内路径、整段即站内路径的行内代码；其余（含外部 URL、
   * ```代码块```）保持转义纯文本。拒绝控制字符/反斜杠/协议相对 URL/外部
   * origin/非 http(s)/带 userinfo；href 只写规范化结果并按属性上下文再转义；
   * 链接恒 target=_blank rel=noopener noreferrer。与上游两处分叉：
   * ① origin 用 __magicLensSiteOrigin 常量（上游取 window.location.origin）；
   * ② href 写绝对地址（相对路径会解析到宿主页 origin）且不把 \n 转 <br>
   *（.msg 挂 pre-wrap，转义文本换行由 CSS 呈现，流式 textContent 与最终
   * innerHTML 观感一致）。siteOrigin 参数仅供测试注入，生产走默认。 */
  g.__magicLensAssistantHtml = (text, siteOrigin) => {
    const origin = siteOrigin || g.__magicLensSiteOrigin;
    const escapeHtml = (value) => String(value == null ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    if (!text) return '';
    let esc = escapeHtml(text);
    const decodeEscaped = (v) => String(v || '').replace(/&(amp|lt|gt|quot|#39);/g,
      (_, n) => ({ amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'" })[n]);

    const normalizeSiteHref = (raw) => {
      const value = decodeEscaped(raw).trim();
      if (!value || /[\u0000-\u001f\u007f\\]/.test(value)) return '';
      if (value !== origin && value.indexOf(origin + '/') !== 0 && value.charAt(0) !== '/') return '';
      if (value.indexOf('//') === 0) return '';
      let url;
      try { url = new URL(value, origin); } catch { return ''; }
      if (url.origin !== origin || url.username || url.password) return '';
      if (url.protocol !== 'http:' && url.protocol !== 'https:') return '';
      return url.pathname + url.search + url.hash;
    };
    const siteLink = (href, labelHtml) =>
      `<a class="ai-chat-site-link" href="${escapeHtml(origin + href)}" target="_blank" rel="noopener noreferrer">${labelHtml}</a>`;

    // 代码与 Markdown 链接先占位：代码里的路径样 token 绝不能进裸路径扫描，
    // 非法链接目标保持纯文本；普通占位在粗体扫描前还原，粗体包链接才不会碎。
    const held = [];
    let marker = '\u0000';
    while (esc.indexOf(marker) !== -1) marker += '\u0000';
    const hold = (html, isFinal) => { held.push({ html, final: !!isFinal }); return `${marker}${held.length - 1}${marker}`; };
    const restore = (finalOnly) => {
      for (let pass = 0; pass < held.length; pass += 1) {
        held.forEach((item, index) => {
          if (!!item.final === finalOnly) esc = esc.split(`${marker}${index}${marker}`).join(item.html);
        });
      }
    };

    esc = esc.replace(/```([\s\S]*?)```/g, (_, code) => hold(`<pre><code>${code.replace(/^\n/, '')}</code></pre>`, true));
    esc = esc.replace(/`([^`\n]+)`/g, (_, code) => {
      const href = normalizeSiteHref(code);
      return hold(href ? siteLink(href, `<code>${code}</code>`) : `<code>${code}</code>`, true);
    });
    esc = esc.replace(/\[([^\]\n]+)\]\(([^)\s]+)\)/g, (whole, label, target) => {
      const href = normalizeSiteHref(target);
      if (!href) return hold(whole, true);
      const labelHtml = label.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
      return hold(siteLink(href, labelHtml), true);
    });

    // 裸站内路径 / 站内 origin 开头的绝对 URL：尾随中英文标点与括号留在链接外。
    // 与上游第三处分叉：token 只吃 ASCII 可打印字符——上游字符类放行 CJK，
    // 「/credits，或者」会被整段吞进 href；站内路由均为 ASCII，到非 ASCII 即断。
    esc = esc.replace(/(^|[\s(（\[【:：,，;；、])(\/[\x21-\x7e]+|https?:\/\/[\x21-\x7e]+)/g,
      (_, prefix, target) => {
        const chain = target.match(/(?:[.,;:!?，。；：！？、）)\]}>】》]+)$/);
        const trailing = chain ? chain[0] : '';
        const trimmed = trailing ? target.slice(0, -trailing.length) : target;
        const href = normalizeSiteHref(trimmed);
        if (!href) return prefix + target;
        return prefix + siteLink(href, escapeHtml(href)) + trailing;
      });
    restore(false);
    esc = esc.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    restore(true);
    return esc;
  };

  /* ---------- R53 伴读语音共享工具（content / background / offscreen 三处共用） ---------- */

  /** base64 ↔ 字节。Why 手写分块而不是一次 btoa/fromCharCode：音频几百 KB 一次
   * Function.apply 展开会栈溢出；SW 与扩展页、offscreen 三处都要，故落共享件。 */
  g.__magicLensB64Encode = (buffer) => {
    const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
    let bin = '';
    for (let i = 0; i < bytes.length; i += 0x8000) {
      bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    }
    return btoa(bin);
  };
  g.__magicLensB64Decode = (b64) => {
    const bin = atob(String(b64 || ''));
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
    return bytes.buffer;
  };

  /** 朗读分段（R227 D4 口径）：/tts/speak 单次上限 2000 字（moon-well 校验），1800 留
   * 余量。先按空行分段，段仍超长再按句末标点（中英文都认）切，最后才硬切——不把
   * 半句话读成两条。纯函数，node 直测。 */
  g.__magicLensSplitForSpeech = (text, segmentMax) => {
    const MAX = segmentMax || 1800;
    const normalized = String(text || '').replace(/\r\n/g, '\n').trim();
    if (!normalized) return [];
    const out = [];
    normalized.split(/\n{2,}/).forEach((para) => {
      para = para.trim();
      if (!para) return;
      if (para.length <= MAX) { out.push(para); return; }
      const sentences = para.match(/[^.!?。！？；;]+[.!?。！？；;]*/g) || [para];
      let current = '';
      sentences.forEach((sentence) => {
        if (sentence.length > MAX) {
          if (current) { out.push(current); current = ''; }
          for (let i = 0; i < sentence.length; i += MAX) out.push(sentence.slice(i, i + MAX));
          return;
        }
        if (current && (current + sentence).length > MAX) { out.push(current); current = ''; }
        current += sentence;
      });
      if (current) out.push(current);
    });
    return out;
  };
})();
