/* MagicLens OIDC 登录回调捕获（v0.3 引入；R46/L2 阶段一自 content.js 迁出）。
 * moon-well /auth/oidc/callback 成功时页面 body 即 Result{accessToken, refreshToken}
 * 的 JSON 文本：在此读出并写入 chrome.storage，用户全程无需手动填 Token。
 * Why 独立 content_script（架构评审 L2）：本段只在 moon-well 回调页有意义，此前随
 * content.js 注入全部页面——回调域之外是一段永不生效的死逻辑，而回调页反而要跑
 * 完整的划词引擎启动门控。独立条目 matches 仅 moon-well 域，互不干扰。 */
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
        // 通知 options 页刷新登录状态；background 稍后关闭本标签
        chrome.runtime.sendMessage({ type: MSG.ML_LOGIN_OK }, () => void chrome.runtime.lastError);
        setTimeout(() => { try { window.close(); } catch { /* 非脚本打开时静默 */ } }, 3000);
      });
      return;
    }
    banner(false, (payload && payload.message) || '未获取到登录信息');
  } catch (e) {
    banner(false, '回调页面解析失败：' + e.message);
  }
})();
