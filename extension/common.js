/* MagicLens 共享助手（无构建链，content script 与扩展页各自挂载）：
 * 域名管理（R25）的归一化与禁用匹配。content script 侧经 window.__magicLens*
 * 在隔离世界共享（与 content/highlight 的钩子同模式）；options/popup 以
 * <script src="common.js"> 直挂后使用。 */
(() => {
  if (window.__magicLensNormDomain) return;

  /** 输入归一化为 hostname：小写、剥协议/端口/路径/末尾点/`*.` 前缀。
   * Why 借道 URL：免手写解析（IPv6/大小写/末尾点等边角）；非法输入返回 null，
   * 由调用方（UI 添加/门控匹配）拒收。无协议输入补 http:// 以便解析；
   * 端口不保留——域名禁用语义按主机不按端口（禁 localhost 即禁所有端口）。 */
  window.__magicLensNormDomain = (input) => {
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
  window.__magicLensIsDisabledHost = (host, list) => {
    const h = String(host || '').toLowerCase().replace(/\.$/, '');
    if (!h) return false;
    return (Array.isArray(list) ? list : []).some((d) => {
      const n = window.__magicLensNormDomain(d);
      return Boolean(n) && (h === n || h.endsWith(`.${n}`));
    });
  };

  /** 上游错误详情不进 UI（R32 用户反馈：报错详情用户看不懂也不想了解）：
   * 疑似技术细节（URL/内部 IP/英文异常/网关标识）归一为通用文案，原文进
   * console 供排查；干净的业务文案（未登录/积分不足/选区过长等）原样放行。
   * Why 防御层而非全量替换：moon-well R124 起服务端已返回干净文案，此层兜住
   * 网络层报错与任何漏改路径；fallback 由调用方按场景给出（翻译/标记/详解）。 */
  window.__magicLensUserFacingError = (msg, fallback) => {
    const raw = String(msg || '');
    if (!raw) return fallback || '';
    if (/https?:\/\/|(\d{1,3}\.){3}\d{1,3}|Exception|I\/O error|timed out|call failed|Failed to fetch/i.test(raw)) {
      console.warn('[MagicLens] 上游错误详情：', raw);
      return fallback || '服务暂时不可用，请稍后重试';
    }
    return raw;
  };
})();
