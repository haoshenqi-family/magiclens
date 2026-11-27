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
    // R70：悬浮球气泡/词卡的逐项配置真值源迁 moon-well（POST /buddy/quick-actions，
    // 与 magicbook buddy 页「伙伴悬浮球快捷动作」同一份配置；R69 的本地 bubble*/ballReview
    // 键随之作废删除——单一真值，不再有本地开关）。扩展侧只读：拉取结果缓存在
    // chrome.storage.local `magiclens.ballQuickActions` = {selected:[], stored:bool, ts}
    // 供断网兜底；stored=false（用户从未在 buddy 页保存过）或无缓存时按注册表全量渲染。
    // 逐项可配的入口在设置页引导去 buddy 页（options.js）。
    // R71 翻译快捷键默认键位（串形制见 __magicLensComboFromEvent）：Alt+A=整页翻译开关
    //（与沉浸式翻译一致）/ Alt+P=悬停单段翻译；''=禁用。设置页「快捷键」节可录制/清除。
    shortcutPageToggle: 'Alt+KeyA',
    shortcutParagraph: 'Alt+KeyP',
    // R75 网页正文朗读：Alt+S=整页连播开/停（每段悬浮 ▶ 与右键菜单不受此键位影响）
    shortcutReadAloud: 'Alt+KeyS',
  });

  /* R78：正文文本块解析（page-translate / page-speak 共用，单点口径）。
   * Why：段落引擎原先只认 P/LI/… 标准标签，Google 支持社区把帖子正文放在
   * <html-blob> 自定义元素里（整页 0 个 <p>），Alt+P 与段末 ▶/译 全部落空。
   * 解析分两级：标准段标签（含 html-blob）优先；否则从命中元素向上找最近的
   * 块级文本容器（display 非 inline、文本 ≥40 字），兜住 div 承载正文的站点。
   * 这里只解析「候选元素」，长度/中文占比/去重仍由各模块的 qualifies 判。 */
  g.__magicLensTextBlockSelector = 'P,LI,BLOCKQUOTE,TD,TH,DD,DT,H1,H2,H3,H4,H5,H6,HTML-BLOB';
  g.__magicLensClosestTextBlock = (el) => {
    if (!el || typeof el.closest !== 'function') return null;
    // 代码块/编辑器/导航/扩展自建 UI 不参与（与 page-speak 的 SKIP 口径对齐）
    if (el.closest('pre,code,[contenteditable],nav,header,footer,aside,form,[aria-hidden="true"],[role="navigation"],[role="banner"],[role="contentinfo"]')) return null;
    const hit = el.closest(g.__magicLensTextBlockSelector);
    if (hit) return hit;
    // 通用兜底：向上找最近的块级文本容器。停到 body/html 前，避免把整页当一段。
    let node = el;
    for (let depth = 0; node && depth < 8; depth += 1, node = node.parentElement) {
      if (node === document.body || node === document.documentElement) break;
      const text = (node.innerText || '').replace(/\s+/g, ' ').trim();
      if (text.length < 40) continue;
      const display = getComputedStyle(node).display;
      if (display && display !== 'inline') return node;
    }
    return null;
  };

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

  /* R70 悬浮球气泡注册表（单源）：径向气泡的唯一权威清单。id 即 moon-well
   * 快捷动作白名单 id（POST /buddy/quick-actions 的 selected 成员，与 buddy 页同一份
   * 配置），两侧白名单由 check-ball-visibility.js 跨仓断言对齐（registry id ⊆
   * moon-well BuddyService.QUICK_ACTION_IDS）。
   * ⚠️ 新增/下线气泡的纪律（守卫强制，违反即挂）：
   *   1. 只改本表——声明 {id, icon, label}；id 必须已在 moon-well 白名单内
   *      （buddy 页 chips 才能表达它；缺什么先去 moon-well BuddyService 扩白名单）；
   *   2. ball.js 的 RUNS 表按 id 补动作处理器（锁 B：RUNS 的 id 集合必须等于本表），
   *      禁止在 ball.js 私挂 ACTIONS 字面量绕过本表；
   *   3. review=滚动复习词卡不是径向气泡，不进本表——由服务端 selected 含 'review'
   *      驱动（ball.js 门控）。
   * Why 表只放纯数据不放处理器：options 页不加载 ball.js（此处须可独立求值），
   * 而 __magicLensAsk/MSG 等 handler 依赖 ball.js/content.js 的作用域。 */
  g.__magicLensBallActions = Object.freeze([
    { id: 'chat', icon: '💬', label: '伴读对话' },
    { id: 'highlight', icon: '〰', label: '生词高亮' },
    { id: 'page-translate', icon: '🌐', label: '整页翻译' },
    { id: 'learning', icon: '🎓', label: '每日学习' },
    { id: 'library', icon: '📚', label: '书库' },
    { id: 'me', icon: '👤', label: '我的' },
  ]);

  /** R56：宿主已自带常驻入口的域名——扩展悬浮球在这些域及子域自动让位。
   * Why 不放开给用户配置：这是「同一入口不能有两个」的产品约束，不是用户偏好；
   * 用户想关掉宿主球时应去 magicbook 自身设置调整，不应靠扩展再叠一个。 */
  g.__magicLensBallYieldDomains = Object.freeze(['magicbook.haoshenqi.top']);

  /** R54 常驻入口（悬浮球）可见性判定：主开关 + 悬浮球开关 + 顶层文档 + 域名管理
   * 名单（复用 __magicLensIsDisabledHost，与划词/高亮同一份禁用语义）。
   * R56：magicbook 站点自带的 buddy 球是全站 layout 注入的宿主能力，扩展球在
   * 该域及子域让位——否则两个球同位置重叠，用户无法分辨点哪个。为什么不由
   * magicbook 探测扩展后隐藏：宿主球还承载读书上下文与站内快捷动作，扩展只提供
   * 通用网页入口；让「能力更完整的一方」留任，且域名判定是静态配置、无需 DOM 轮询。
   * 纯函数入 common.js：ball.js 每次显隐判定与 node 冒烟共用同一实现。 */
  g.__magicLensBallVisible = (cfg, host, isTop) =>
    Boolean(isTop && cfg && cfg.enabled && cfg.ballEnabled
      && !g.__magicLensIsDisabledHost(host, cfg.disabledDomains)
      && !g.__magicLensIsDisabledHost(host, g.__magicLensBallYieldDomains));

  /** R57 划词去向：只有单个英文单词走即时翻译；短语、句子、含中文的选区
   * 一律交给伴读 AI。Why 不在 content.js 内联判断：这是用户可见的行为口径，
   * 抽成 common.js 纯函数后可由 Node 守卫锁住，避免后续按钮/iframe 路径漂移。 */
  g.__magicLensSelectionAction = (text) => {
    const value = String(text || '').trim();
    if (!value) return 'none';
    const singleEnglishWord = /^[A-Za-z](?:[A-Za-z'’-]*[A-Za-z])?$/.test(value);
    const containsChinese = /[\u3400-\u9fff\uf900-\ufaff]/.test(value);
    return singleEnglishWord && !containsChinese ? 'translate' : 'ai';
  };

  /** R57 划词词形：取选区开头的英文词，供标记/详解按钮使用。与去向判定共用
   * 同一撇号口径（直/弯），避免 don’t 被判为单词、实际却只截出 don。 */
  g.__magicLensSelectionWord = (text) => {
    const match = String(text || '').match(/^[A-Za-z][A-Za-z'’\-]{0,40}/);
    return match ? match[0] : null;
  };

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

  /* ---------- R71 翻译快捷键：键位串三件套（options / page-translate / 守卫三方共用） ----------
   * 串形制 = 修饰键（固定序 Alt,Ctrl,Meta,Shift）+ "+" + e.code，如 Alt+KeyA、Ctrl+Shift+Comma。
   * Why 存 e.code 不存 e.key：macOS Option 组合把 e.key 变成死键字符（Alt+A→å、Alt+P→π），
   * 按 key 匹配在 Mac 上整段失效；e.code 是物理键位，跨布局稳定。空串 = 该键禁用。
   * Why 落 common.js 纯函数：options 页不加载 page-translate.js（R69 registry 同因），
   * 且 Node 守卫（check-extension-modules.js R71 段）可直接锁契约防漂移。 */

  const COMBO_MODS = ['altKey', 'ctrlKey', 'metaKey', 'shiftKey'];
  const COMBO_MOD_NAMES = { altKey: 'Alt', ctrlKey: 'Ctrl', metaKey: 'Meta', shiftKey: 'Shift' };
  // 修饰键自身的物理键（R72）：裸按 Alt/Shift 等不可录制也不可匹配——否则会录出
  // "Alt+AltLeft" 怪串，且双击 Alt 连击检测会误碰已录键位串
  const COMBO_MOD_CODE_RE = /^(Alt|Control|Meta|Shift)(Left|Right)$/;
  // e.code → 展示名：字母/数字剥前缀，常见命名键给可读符号（录制框回显用）
  const COMBO_CODE_LABELS = {
    Comma: ',', Period: '.', Slash: '/', Semicolon: ';', Quote: "'",
    BracketLeft: '[', BracketRight: ']', Backslash: '\\', Minus: '-', Equal: '=',
    Backquote: '`', Space: '空格', ArrowLeft: '←', ArrowRight: '→', ArrowUp: '↑', ArrowDown: '↓',
  };
  const COMBO_CODE_LABEL = (code) =>
    COMBO_CODE_LABELS[code] || (/^Key./.test(code) ? code.slice(3)
      : /^Digit./.test(code) ? code.slice(5) : code);

  /** KeyboardEvent → 键位串。无主修饰键（Alt/Ctrl/Meta 任一）返回 null：
   * 裸键/纯 Shift 属于网页本身（页面聚焦时要打字），不可录制为快捷键。
   * 修饰键自身的物理键（R72）也返回 null——裸按 Alt 录不出怪串、双击连击不误碰已录串。 */
  g.__magicLensComboFromEvent = (e) => {
    if (!e || typeof e.code !== 'string' || !e.code) return null;
    if (COMBO_MOD_CODE_RE.test(e.code)) return null;
    if (!e.altKey && !e.ctrlKey && !e.metaKey) return null;
    const parts = COMBO_MODS.filter((k) => e[k]).map((k) => COMBO_MOD_NAMES[k]);
    parts.push(e.code);
    return parts.join('+');
  };

  /** 键位串与事件全等比对（修饰键集合 + code 逐一对上）；串非法/空返回 false。 */
  g.__magicLensComboMatches = (stored, e) => {
    const combo = String(stored || '');
    if (!combo) return false;
    const made = g.__magicLensComboFromEvent(e);
    return Boolean(made) && made === combo;
  };

  /** 键位串 → 展示文案（Alt+KeyA → Alt+A）；空/非法串返回空串（设置页显「未设置」）。 */
  g.__magicLensComboLabel = (stored) => {
    const combo = String(stored || '');
    if (!combo) return '';
    const parts = combo.split('+');
    const code = parts.pop();
    if (!code || parts.some((p) => !COMBO_MOD_NAMES[`${p.toLowerCase()}Key`])) return '';
    return [...parts, COMBO_CODE_LABEL(code)].join('+');
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
