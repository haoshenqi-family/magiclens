/* MagicLens service worker：唯一负责对 moon-well 的 HTTP 调用。
 * Why：MV3 中 content script 的 fetch 遵循页面源的 CORS 规则，
 * 而 service worker 持有 host_permissions 豁免，且能绕开 http 页面对
 * http 接口的混合内容限制，故所有 JSON API 请求统一在此中转。
 * v0.3：默认公网域名（Traefik → fnOS:8082）；JWT 静默刷新（access 7d / refresh 30d）。 */

const DEFAULT_CFG = {
  // 公网入口（moon-well.haoshenqi.top → fnOS tailscale :8082，见 app-manager traefik-dynamic/moonwell.yml）
  apiBase: 'https://moon-well.haoshenqi.top',
  token: '',        // moon-well JWT（OIDC 登录后自动捕获）
  refreshToken: '',
};
// v0.2 时代的旧默认（内网直连），一次性迁移到公网域名
const LEGACY_INTERNAL_BASE = 'http://192.168.31.9:8082';
const LOGIN_PATH = '/auth/oidc/login';

async function getCfg() {
  const cfg = await chrome.storage.sync.get(DEFAULT_CFG);
  if (cfg.apiBase === LEGACY_INTERNAL_BASE) {
    cfg.apiBase = DEFAULT_CFG.apiBase;
    await chrome.storage.sync.set({ apiBase: cfg.apiBase });
  }
  return cfg;
}

/** 用 refreshToken 换新令牌对（moon-well /auth/refreshToken → Result{accessToken, refreshToken}）。 */
async function refreshTokens(refreshToken) {
  const { apiBase } = await getCfg();
  const resp = await fetch(apiBase.replace(/\/+$/, '') + '/auth/refreshToken', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });
  const payload = await resp.json().catch(() => null);
  const result = payload && payload.result;
  if (!resp.ok || !payload || payload.success !== true || !result || !result.accessToken) {
    throw new Error('refresh failed');
  }
  await chrome.storage.sync.set({ token: result.accessToken, refreshToken: result.refreshToken });
  return result.accessToken;
}

async function callApi(path, { method = 'POST', body } = {}, retried = false) {
  const { apiBase, token, refreshToken } = await getCfg();
  if (!apiBase) return { ok: false, error: '未配置服务地址', status: 0 };
  if (!token && !refreshToken) return { ok: false, error: '未登录，请先在设置页登录', status: 0, auth: true };

  let resp;
  try {
    resp = await fetch(apiBase.replace(/\/+$/, '') + path, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (e) {
    return { ok: false, error: `网络错误：${e.message}`, status: 0 };
  }

  // 401：静默刷新一次后重试；刷新失败清空令牌强制重登
  if (resp.status === 401 && !retried && refreshToken) {
    try {
      await refreshTokens(refreshToken);
      return callApi(path, { method, body }, true);
    } catch {
      await chrome.storage.sync.set({ token: '', refreshToken: '' });
      return { ok: false, error: '登录已失效，请重新登录', status: 401, auth: true };
    }
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
    const out = { ok: false, error: msg, status: resp.status };
    if (resp.status === 401 || resp.status === 403) out.auth = true;
    return out;
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
      case 'ml:api': {
        // Why 白名单：chat.js 面板端点经此中转，防任意 path 透传
        const ALLOWED = new Set([
          '/ai/agent/conversations', '/ai/agent/history',
          '/ai/agent/conversation/rename', '/ai/agent/conversation/delete',
          '/ai/agent/memory/list', '/ai/agent/memory/save', '/ai/agent/memory/delete',
          '/ai/agent/book-profile',
        ]);
        if (!ALLOWED.has(msg.path)) {
          sendResponse({ ok: false, error: 'path not allowed', status: 0 });
          break;
        }
        sendResponse(await callApi(msg.path, { body: msg.body || {} }));
        break;
      }
      case 'ml:login':
        // 打开 moon-well 的 Authentik 登录页（与 magicbook 同一登录入口）；
        // 成功后 callback 页由 content.js 自动捕获令牌
        chrome.tabs.create({ url: (await getCfg()).apiBase + LOGIN_PATH });
        sendResponse({ ok: true });
        break;
      case 'ml:logout':
        await chrome.storage.sync.set({ token: '', refreshToken: '' });
        sendResponse({ ok: true });
        break;
      case 'ml:login-ok':
        // 登录成功：callback 标签页展示 2.5s 成功横幅后由 background 关闭
        if (sender && sender.tab && sender.tab.id != null) {
          setTimeout(() => { chrome.tabs.remove(sender.tab.id).catch(() => { /* 已关则忽略 */ }); }, 2500);
        }
        sendResponse({ ok: true });
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
