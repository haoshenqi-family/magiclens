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
})();
