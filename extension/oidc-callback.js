/* MagicLens OIDC 登录回调捕获（v0.3 引入；R46/L2 阶段一自 content.js 迁出）。
 * moon-well /auth/oidc/callback 成功时页面 body 即 Result{accessToken, refreshToken}
 * 的 JSON 文本：在此读出并写入 chrome.storage，用户全程无需手动填 Token。
 * Why 独立 content_script（架构评审 L2）：本段只在 moon-well 回调页有意义，此前随
 * content.js 注入全部页面——回调域之外是一段永不生效的死逻辑，而回调页反而要跑
 * 完整的划词引擎启动门控。独立条目 matches 仅 moon-well 域，互不干扰。
 * R64 修复：迁出时把裸 MSG 引用带了过来，而 MSG 从非全局（rpc.js 只挂
 * __magicLensRpc，全仓口径是 const MSG = __magicLensRpc.MSG）——ReferenceError
 * 抛在 storage 异步回调里、外层 try/catch 接不住：横幅照常渲染，但 ML_LOGIN_OK
 * 发不出、window.close 兜底定时器不注册，background 的 tabs.remove 永不调度，
 * 登录成功页永不关闭。修复=回调内解构 MSG + 发送失败不吞兜底定时器
 * + manifest 条目显式先注入 rpc.js（依赖显式化，不借道 catch-all 条目）。 */
/* ---------- OIDC 登录回调捕获（v0.3） ----------
 * moon-well /auth/oidc/callback 成功时页面 body 即 Result{accessToken, refreshToken}
 * 的 JSON 文本：在此读出并写入 chrome.storage，用户全程无需手动填 Token。 */
(() => {
  // manifest matches 已限定本域；防御性再判一次（content script 可能被显式注入）
  if (location.hostname !== 'moon-well.haoshenqi.top'
    || location.pathname !== '/auth/oidc/callback') return;

  function banner(ok, message) {
    document.body.innerHTML = '';
    const style = document.createElement('style');
    style.textContent = 'body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;'
      + "font:16px/1.7 -apple-system,'PingFang SC','Segoe UI',sans-serif;background:#f8fafc;color:#1f2937;}"
      + '.card{padding:40px 48px;border-radius:16px;background:#fff;box-shadow:0 10px 40px rgba(0,0,0,.1);text-align:center;}'
      + 'h1{font-size:20px;margin:0 0 8px;} .ok{color:#059669;} .bad{color:#dc2626;} p{color:#6b7280;margin:0;}';
    const card = document.createElement('div');
    card.className = 'card';
    const h = document.createElement('h1');
    h.textContent = ok ? '✓ MagicLens 登录成功' : '✗ MagicLens 登录失败';
    h.className = ok ? 'ok' : 'bad';
    const p = document.createElement('p');
    p.textContent = ok ? '令牌已自动保存，本窗口稍后自动关闭。' : (message || '未获取到登录信息');
    card.append(h, p);
    document.head.appendChild(style);
    document.body.appendChild(card);
  }

  try {
    const payload = JSON.parse(document.body.innerText);
    if (payload && payload.success && payload.result && payload.result.accessToken) {
      chrome.storage.sync.set({
        token: payload.result.accessToken,
        refreshToken: payload.result.refreshToken || '',
      }, () => {
        banner(true);
        // R64：MSG 非全局，必须在回调内解构——此处异步执行时本条目与 catch-all
        // 条目的 rpc.js 必已落定；放 IIFE 顶层会在条目顺序变动时先崩、连令牌捕获
        // 一起丢（storage 回调抛错外层 try/catch 接不住，R47 即此翻车）。
        const MSG = __magicLensRpc.MSG;
        // 通知 options 页刷新登录状态；background 稍后关闭本标签。
        // 发送失败不吞兜底：异常只跳过通知，下方 window.close 定时器照常注册。
        try {
          chrome.runtime.sendMessage({ type: MSG.ML_LOGIN_OK }, () => void chrome.runtime.lastError);
        } catch { /* SW 不可达时静默，由下方兜底 */ }
        setTimeout(() => { try { window.close(); } catch { /* 非脚本打开时静默 */ } }, 3000);
      });
      return;
    }
    banner(false, (payload && payload.message) || '未获取到登录信息');
  } catch (e) {
    banner(false, '回调页面解析失败：' + e.message);
  }
})();
