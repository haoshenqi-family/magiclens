/* MagicLens service worker：唯一负责对 moon-well 的 HTTP 调用。
 * Why：MV3 中 content script 的 fetch 遵循页面源的 CORS 规则，
 * 而 service worker 持有 host_permissions 豁免，且能绕开 http 页面对
 * http 接口的混合内容限制，故所有 API 请求统一在此中转。 */

const DEFAULT_CFG = {
  // 默认 moon-well 内网地址（fnOS）；公网入口（如 api.haoshenqi.top）待 Traefik 加路由后在设置里改
  apiBase: 'http://192.168.31.9:8082',
  token: '',
};

async function callApi(path, { method = 'POST', body } = {}) {
  const { apiBase, token } = await chrome.storage.sync.get(DEFAULT_CFG);
  if (!apiBase) return { ok: false, error: '未配置服务地址，请打开扩展设置', status: 0 };
  if (!token) return { ok: false, error: '未配置访问 Token，请打开扩展设置', status: 0 };

  let resp;
  try {
    resp = await fetch(apiBase.replace(/\/+$/, '') + path, {
      method,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (e) {
    return { ok: false, error: `网络错误：${e.message}`, status: 0 };
  }

  let payload = null;
  try {
    payload = await resp.json();
  } catch {
    /* 非 JSON 响应按失败处理 */
  }
  // moon-well 统一 Result{success, result, message} 包装
  if (!resp.ok || !payload || payload.success !== true) {
    const msg = (payload && (payload.message || payload.msg)) || `HTTP ${resp.status}`;
    return { ok: false, error: msg, status: resp.status };
  }
  return { ok: true, data: payload.result };
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  (async () => {
    switch (msg && msg.type) {
      case 'ml:translate':
        sendResponse(
          await callApi('/vocabulary/reading/translate', {
            body: { text: String(msg.text || '').slice(0, 2000) },
          })
        );
        break;
      case 'ml:mark': {
        // known = 标记已认识（移出学习队列）；unknown = 加入生词本
        const action = msg.known ? 'known' : 'unknown';
        sendResponse(
          await callApi(`/vocabulary/${action}/${encodeURIComponent(msg.word || '')}`, { method: 'GET' })
        );
        break;
      }
      case 'ml:settings':
        sendResponse(await callApi('/vocabulary/reading/settings', { method: 'GET' }));
        break;
      case 'ml:openOptions':
        chrome.runtime.openOptionsPage();
        sendResponse({ ok: true });
        break;
      default:
        sendResponse({ ok: false, error: 'unknown message type' });
    }
  })();
  return true; // 保持通道开启，等待异步 sendResponse
});

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') chrome.runtime.openOptionsPage();
});
