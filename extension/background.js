/* MagicLens service worker：moon-well API 中转 + 消息路由（金山词霸直连域已迁 iciba.js，R47/L3）。
 * Why：MV3 中 content script 的 fetch 遵循页面源的 CORS 规则，
 * 而 service worker 持有 host_permissions 豁免，且能绕开 http 页面对
 * http 接口的混合内容限制，故所有 JSON API 请求统一在此中转。
 * v0.3：默认公网域名（Traefik → fnOS:8082）；JWT 静默刷新（access 7d / refresh 30d）。
 * v0.6：单词划词直连金山词霸 suggest（免登录快路径），miss 回退 moon-well。 */

// R46（架构评审 L5）：设置默认值单点在 common.js 的 __magicLensDefaults
//（本 SW 经 importScripts 引入），新增设置键只改那一处。
importScripts('common.js', 'rpc.js', 'iciba.js');
const { WORD_PATTERN, icibaLookupWithStemming } = __magicLensIciba;  // R47/L3：金山直连域模块化
const MSG = __magicLensRpc.MSG;  // R46：消息类型常量集中（rpc.js）
const DEFAULT_CFG = {
  // 公网入口（moon-well.haoshenqi.top → fnOS tailscale :8082，见 app-manager traefik-dynamic/moonwell.yml）
  apiBase: __magicLensDefaults.apiBase,
  token: '',        // moon-well JWT（OIDC 登录后自动捕获）
  refreshToken: '',
};
// v0.2 时代的旧默认（内网直连），一次性迁移到公网域名
const LEGACY_INTERNAL_BASE = 'http://192.168.31.9:8082';
const LOGIN_PATH = '/auth/oidc/login';
// Why 每个请求都必须带超时：fetch 无 abort 时，上游卡住会让气泡永久停在「翻译中…」
// （R13 卡死——用户只能刷新页面脱困）。交互调用 20s 足够；详解冷词要整段 LLM 生成，单独放宽。
const TIMEOUT_MS = 20000;
const DETAIL_TIMEOUT_MS = 120000;
// Authentik 邀请制注册链接（与 magicbook 登录页注册入口同源：fnOS magicbook/.env 的
// AUTHENTIK_ENROLLMENT_INVITE_URL）。Why 内置：注册是打开邀请流程页而非 OAuth 端点；
// 注意邀请令牌轮换时需同步更新本常量并发版。
const ENROLLMENT_URL =
  'https://authentik.haoshenqi.top/if/flow/invitation-enrollment/?itoken=5566492c-5d73-49dd-abe0-8dc9d48c14d8';

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
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const payload = await resp.json().catch(() => null);
  const result = payload && payload.result;
  if (!resp.ok || !payload || payload.success !== true || !result || !result.accessToken) {
    throw new Error('refresh failed');
  }
  await chrome.storage.sync.set({ token: result.accessToken, refreshToken: result.refreshToken });
  return result.accessToken;
}

/* ---------- moon-well 响应解包（R44） ----------
 * Why 兼容两种形制：moon-well 的「统一 Result{success,result,message}」是各 controller
 * 显式返回的，服务端没有任何 ResponseBodyAdvice 兜底——实测 55 个 controller 里 49 个显式
 * 包装，而 `/ai/agent` 的 8 个面板端点漏包直接返回裸数组/对象。旧判定 `payload.success !== true`
 * 于是把成功响应判成失败，调用方（chat.js 会话列表）再 `if (!resp.ok) return;` 一吞，
 * 用户看到的就是「历史记录凭空消失」。现与 magicbook 侧 `ai_chat.js unwrap()` 同口径：
 * 只有 HTTP 不成功 / 非 JSON / 显式 `success === false` 才算失败，其余取 result，
 * 裸 payload 原样透出。
 * How 做成不碰 fetch/storage 的纯函数：本仓无测试框架，纯函数可以直接把源码片段抽出来
 * 喂给断言跑（见 docs/project/_legacy/feat/chrome-extension/design/lld.md §10 R44 的验证方式）。 */
function unwrapMoonWellResponse(resp, payload) {
  if (!resp.ok || !payload || payload.success === false) {
    const msg = (payload && (payload.message || payload.msg)) || `HTTP ${resp.status}`;
    const out = { ok: false, error: msg, status: resp.status };
    if (resp.status === 401 || resp.status === 403) out.auth = true;
    return out;
  }
  return { ok: true, data: payload.result !== undefined ? payload.result : payload };
}

/* ---------- L4（架构评审）：令牌刷新/清凭据决策单点 ----------
 * Why 抽出：callApi 的 401 分支与 ml:auth 的「token 空而 refreshToken 有效」
 * 原先各抄一份超时/清凭据分支（R35 口径靠注释对齐）——漂移即 401 处理不一致。
 * 返回 {token}（刷新成功）或 {error, status, auth?}（失败，调用方原样透出）。 */
async function refreshOrClear(refreshToken) {
  try {
    return { token: await refreshTokens(refreshToken) };
  } catch (e) {
    // Why 超时不清凭据：refresh 慢/断网只说明这一刻连不上，refreshToken 本身仍有效，
    // 抹掉会把一次网络抖动变成全标签页强制重登（且刚续期成功的并发请求会被连带清掉）。
    if (e && (e.name === 'TimeoutError' || e.name === 'AbortError')) {
      return { error: `登录续期超时（${Math.round(TIMEOUT_MS / 1000)}s），请稍后重试`, status: 0 };
    }
    await chrome.storage.sync.set({ token: '', refreshToken: '' });
    return { error: '登录已失效，请重新登录', status: 401, auth: true };
  }
}

/* ---------- moon-well 调用低层（R53 抽出）：鉴权 + fetch + 超时 + 401 静默刷新单点 ----------
 * callApi（JSON/Result）、ASR 转写（multipart）、TTS 朗读（二进制响应）三类请求共用
 * 这一段。此前 401/超时分支只活在 callApi 里，语音两类若照抄等于把 R35/L4 类漂移
 * 温床再抄两份。返回 {resp}（HTTP 层已完成，由调用方按各自形制解包）或
 * {error, status, auth?}（请求未发出 / 刷新失败）。 */
async function callMoonWellRaw(path, init, timeoutMs = TIMEOUT_MS, retried = false) {
  const { apiBase, token, refreshToken } = await getCfg();
  if (!apiBase) return { error: '未配置服务地址', status: 0 };
  if (!token && !refreshToken) return { error: '未登录，请先在设置页登录', status: 0, auth: true };

  let resp;
  try {
    resp = await fetch(apiBase.replace(/\/+$/, '') + path, {
      ...init,
      headers: {
        ...(init.headers || {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (e) {
    if (e.name === 'TimeoutError' || e.name === 'AbortError') {
      return { error: `请求超时（${Math.round(timeoutMs / 1000)}s），请稍后重试`, status: 0 };
    }
    return { error: `网络错误：${e.message}`, status: 0 };
  }

  // 401：静默刷新一次后重试；刷新真被拒绝才清空令牌强制重登（L4 单点 refreshOrClear）。
  // retried 守卫防死循环：刚刷新的 token 再被拒就该停（与原 callApi 口径一致）
  if (resp.status === 401 && !retried && refreshToken) {
    const refreshed = await refreshOrClear(refreshToken);
    if (refreshed.token) return callMoonWellRaw(path, init, timeoutMs, true);
    return { error: refreshed.error, status: refreshed.status, auth: refreshed.auth };
  }
  return { resp };
}

async function callApi(path, { method = 'POST', body, timeoutMs = TIMEOUT_MS } = {}) {
  const out = await callMoonWellRaw(path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  }, timeoutMs);
  if (out.error) return { ok: false, error: out.error, status: out.status ?? 0, auth: out.auth };
  let payload = null;
  try {
    payload = await out.resp.json();
  } catch {
    /* 非 JSON 响应按失败处理 */
  }
  return unwrapMoonWellResponse(out.resp, payload);
}

/* ---------- R53 语音输入：offscreen 录音文档生命周期 ----------
 * Why offscreen 而非 SW/content script 录音：SW 无 DOM（AudioContext/ScriptProcessor
 * 采集链路没有语义保证），content script 录音要把麦克风权限对每个宿主站点逐个授权、
 * http 页更拿不到 getUserMedia；offscreen 属扩展自身 origin，权限一次授权到处可用。
 * createDocument 在文档已存在时抛错——getContexts 要 Chrome 116，为兼容 manifest 的
 * min 110，用「试建 + 吞已存在错误」模式；SW 中途挂起再醒来也靠它幂等续命。 */
async function ensureOffscreen() {
  try {
    await chrome.offscreen.createDocument({
      url: 'offscreen.html',
      reasons: ['USER_MEDIA'],
      justification: '伴读抽屉语音输入：把麦克风录音转写成文字',
    });
  } catch (e) {
    if (!/single|exist/i.test(String((e && e.message) || e))) throw e;
  }
}

function sendToOffscreen(msg) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(msg, (resp) => {
      if (chrome.runtime.lastError) return resolve(null);
      resolve(resp || null);
    });
  });
}

/* ---------- R53 ASR 转写：multipart 直传 moon-well /learning/asr/transcribe ----------
 * 为什么不走 callApi：body 是 FormData（Content-Type 边界由浏览器生成，手工设置会坏）。
 * 上限 10MB/次由 moon-well 校验；响应是 Result 包装，取 result.text。 */
const ASR_TIMEOUT_MS = 60000;

async function transcribeAudio(audioBase64) {
  const bytes = __magicLensB64Decode(audioBase64);
  const form = new FormData();
  form.append('file', new Blob([bytes], { type: 'audio/wav' }), 'recording.wav');
  const out = await callMoonWellRaw('/learning/asr/transcribe', { method: 'POST', body: form }, ASR_TIMEOUT_MS);
  if (out.error) return { ok: false, error: out.error, status: out.status ?? 0, auth: out.auth };
  let payload = null;
  try {
    payload = await out.resp.json();
  } catch {
    /* 非 JSON 按 unwrap 的失败分支处理 */
  }
  return unwrapMoonWellResponse(out.resp, payload);
}

/* ---------- R53 回复朗读：/tts/speak（二进制音频，不套 Result 包装） ----------
 * body 不带 bookName/chapter：moon-well 据此把音频落「AI 临时语音」档（7 天清理），
 * 不污染书籍段落永久缓存（R227 D3 口径）。听=消费：命中缓存也扣 1 积分/次（R166）。
 * Why 超时放宽到 180s：fnOS 本地 Qwen3-TTS 长段合成本来就要分钟级（tts.local.timeout-ms 同值）。 */
const TTS_TIMEOUT_MS = 180000;

async function synthesizeSpeech(text) {
  const out = await callMoonWellRaw('/tts/speak', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  }, TTS_TIMEOUT_MS);
  if (out.error) return { ok: false, error: out.error, status: out.status ?? 0, auth: out.auth };
  const resp = out.resp;
  const type = (resp.headers.get('Content-Type') || '').toLowerCase();
  if (resp.ok && (type.startsWith('audio/') || type.startsWith('application/octet-stream'))) {
    return { ok: true, audioBase64: __magicLensB64Encode(await resp.arrayBuffer()) };
  }
  // 失败体是 moon-well 的 Result 信封（HTTP 500 + JSON），典型是「积分不足，无法使用AI功能」。
  // 不带出 message 的话前端只能拿 JSON 字节去解码，把计费拒绝伪装成「播放器坏了」（R227）。
  let payload = null;
  try {
    payload = await resp.json();
  } catch {
    /* 非 JSON 按状态码兜底 */
  }
  return {
    ok: false,
    error: (payload && (payload.message || payload.msg)) || `HTTP ${resp.status}`,
    status: resp.status,
    auth: resp.status === 401 || resp.status === 403,
  };
}

// R40 查词补报：会话内去重即可（SW 挂起重置后服务端幂等兜底），遥测失败静默
const reportedLookups = new Set();

function reportLookup(word) {
  const key = word.trim().toLowerCase();
  if (!key || reportedLookups.has(key)) return;
  reportedLookups.add(key);
  callApi('/learning/strands/lookup', { body: { word: key } })
    .catch(() => { /* callApi 自身不抛（返回 {ok:false}），此处仅防御 */ });
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  (async () => {
    switch (msg && msg.type) {
      case MSG.ML_TRANSLATE: {
        // Why 单词先直连金山（R15 快路径，免登录、绕开 moon-well 网络链路）；
        // miss/异常回退 moon-well 全链路（ES 缓存 + 后端词干还原 + LLM 兜底），行为兼容改动前
        const text = String(msg.text || '').slice(0, 2000).trim();
        const dictTranslation = WORD_PATTERN.test(text) ? await icibaLookupWithStemming(text) : null;
        if (dictTranslation) {
          // R40：直连命中的查词补报四股台账（词汇股 LOOKUP_DAY）——fire-and-forget，
          // 失败静默；服务端同词同日 doc id 幂等，重复上报无副作用。
          reportLookup(text);
          sendResponse({ ok: true, data: { text, translation: dictTranslation, source: 'iciba' } });
          break;
        }
        sendResponse(
          await callApi('/vocabulary/reading/translate', {
            body: { text },
          })
        );
        break;
      }
      case MSG.ML_MARK: {
        // known = 标记已认识（移出学习队列）；unknown = 加入生词本
        const action = msg.known ? 'known' : 'unknown';
        sendResponse(
          await callApi(`/vocabulary/${action}/${encodeURIComponent(msg.word || '')}`, { method: 'GET' })
        );
        break;
      }
      case MSG.ML_DETAIL:
        // 单词详解：moon-well 缓存优先（magicbook-vocabulary 索引），miss 才调 LLM；
        // 划词可能是变体（ran），服务端负责还原词目并返回六板块结构化 JSON
        sendResponse(
          await callApi(`/vocabulary/detail/${encodeURIComponent(msg.word || '')}`,
            { method: 'GET', timeoutMs: DETAIL_TIMEOUT_MS })
        );
        break;
      case MSG.ML_ANALYZE:
        // 生词智能高亮初次扫描（P1）：整页文本走 analyze 判定矩阵（手动标记优先 + 词档兜底），
        // 返回生词列表；顺带进 reading_vocabulary 阅读事件流，与 magicbook 学情互通。
        // bookName/chapter 服务端各截 200 字符；analyze 无 LLM 调用但查词档表与 ES，放宽到 30s
        sendResponse(
          await callApi('/vocabulary/reading/analyze', {
            body: {
              pageText: String(msg.pageText || '').slice(0, 150000),
              bookName: String(msg.bookName || '').slice(0, 200),
              chapter: String(msg.chapter || '').slice(0, 200),
            },
            timeoutMs: 30000,
          })
        );
        break;
      case MSG.ML_FAMILIAR:
        // 高亮增量判定（SPA 动态内容）：单词本批量查询，无阅读事件副作用，故用于增量
        sendResponse(
          await callApi('/vocabulary/familiar', {
            body: { words: Array.isArray(msg.words) ? msg.words.slice(0, 300) : [] },
          })
        );
        break;
      case MSG.ML_SETTINGS:
        sendResponse(await callApi('/vocabulary/reading/settings', { method: 'GET' }));
        break;
      case MSG.ML_API: {
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
      case MSG.ML_AUTH: {
        // 聊天 SSE 直连前的凭据解析（R35）：apiBase/token 只此一处出——设置页自 v0.3
        // 起不写 apiBase，公网域名仅存在于本文件 DEFAULT 兜底，chat.js 曾本地读
        // storage 默认空串导致面板永远「未配置服务地址或 Token」且重新登录无效。
        // token 空而 refreshToken 有效时先静默刷新（与 callApi 的 401 刷新同语义），
        // SSE 不带空 Bearer 起跑；刷新失败的超时/清凭据分支也与 callApi 对齐。
        const { apiBase, token, refreshToken } = await getCfg();
        let authToken = token;
        if (!authToken && refreshToken) {
          // L4：刷新/清凭据决策走单点 refreshOrClear（与 callApi 401 同分支）
          const refreshed = await refreshOrClear(refreshToken);
          if (refreshed.token) {
            authToken = refreshed.token;
          } else {
            sendResponse({ ok: false, error: refreshed.error, status: refreshed.status, auth: refreshed.auth });
            break;
          }
        }
        if (!authToken) {
          sendResponse({ ok: false, error: '未登录，请先在设置页登录', status: 0, auth: true });
          break;
        }
        sendResponse({ ok: true, apiBase, token: authToken });
        break;
      }
      case MSG.ML_SELECTION: {
        // R36：子文档（iframe）里的选区上报——selection-relay.js 只在非顶层文档运行，
        // 气泡与按钮链路的唯一属主是顶层 content.js，故投回同一 tab 让它呈现。
        // content script 用不了 chrome.tabs，这一跳中转是必须的；不指定 frameId 即投给
        // 该 tab 的全部文档，中继脚本不认识这个消息类型会自行忽略，无需新增 "tabs" 权限
        // （既有 host_permissions 已覆盖，与 ml:hl-toggle 同一用法）。
        if (!sender.tab || sender.tab.id == null) {
          sendResponse({ ok: false });
          break;
        }
        chrome.tabs.sendMessage(sender.tab.id,
          { type: MSG.ML_OPENSELECTION, text: msg.text, rect: msg.rect },
          () => { void chrome.runtime.lastError; }); // 顶层未装载（站点禁用/扩展刚更新）时无人接收
        sendResponse({ ok: true });
        break;
      }
      case MSG.ML_LOGIN:
        // 打开 moon-well 的 Authentik 登录页（与 magicbook 同一登录入口）；
        // 成功后 callback 页由 content.js 自动捕获令牌
        chrome.tabs.create({ url: (await getCfg()).apiBase + LOGIN_PATH });
        sendResponse({ ok: true });
        break;
      case MSG.ML_REGISTER:
        // 邀请制注册（Authentik invitation-enrollment 流程，注册完回到登录页正常登录）
        chrome.tabs.create({ url: ENROLLMENT_URL });
        sendResponse({ ok: true });
        break;
      case MSG.ML_LOGOUT:
        await chrome.storage.sync.set({ token: '', refreshToken: '' });
        sendResponse({ ok: true });
        break;
      case MSG.ML_LOGIN_OK:
        // 登录成功：callback 标签页展示 2.5s 成功横幅后由 background 关闭
        if (sender && sender.tab && sender.tab.id != null) {
          setTimeout(() => { chrome.tabs.remove(sender.tab.id).catch(() => { /* 已关则忽略 */ }); }, 2500);
        }
        sendResponse({ ok: true });
        break;
      case MSG.ML_OPENOPTIONS:
        chrome.runtime.openOptionsPage();
        sendResponse({ ok: true });
        break;
      case MSG.ML_REC_START: {
        // 录音开始：惰性建 offscreen 文档并转发 ML_REC_GO。
        // Why GO/DONE 与 START/STOP 两套类型：content 的 runtime.sendMessage 会广播
        // 到全部扩展上下文（含 offscreen），offscreen 只认 GO/DONE/CANCEL 且对其余
        // 类型不回话，避免抢占 SW 的响应通道（rpc.js MSG 表注释同口径）。
        try {
          await ensureOffscreen();
          const rec = await sendToOffscreen({ type: MSG.ML_REC_GO });
          sendResponse(rec || { ok: false, error: '录音模块无响应，请重试' });
        } catch (e) {
          sendResponse({ ok: false, error: (e && e.message) || '录音启动失败' });
        }
        break;
      }
      case MSG.ML_REC_STOP: {
        // 取音频 → 关文档 → 转写。文档先关：ASR 慢（最长 60s），offscreen 文档
        // 没必要陪等；ASR 失败也不影响录音已正常收尾。
        try {
          await ensureOffscreen();
          const rec = await sendToOffscreen({ type: MSG.ML_REC_DONE });
          chrome.offscreen.closeDocument().catch(() => { /* 已关/不存在则忽略 */ });
          if (!rec || !rec.ok) {
            sendResponse({ ok: false, error: (rec && rec.error) || '录音模块无响应，请重试' });
            break;
          }
          sendResponse(await transcribeAudio(rec.audioBase64));
        } catch (e) {
          sendResponse({ ok: false, error: (e && e.message) || '转写失败' });
        }
        break;
      }
      case MSG.ML_REC_CANCEL:
        // 关抽屉等场景放弃录音：丢弃音频、不转写不计费
        await sendToOffscreen({ type: MSG.ML_REC_CANCEL });
        chrome.offscreen.closeDocument().catch(() => { /* 已关/不存在则忽略 */ });
        sendResponse({ ok: true });
        break;
      case MSG.ML_TTS_SPEAK:
        // 朗读合成：SW 取二进制音频转 base64 回传（content 里 Web Audio 解码播放，
        // 与宿主页 CSP 无涉——字节经消息通道进来，连 connect-src 都不占用）
        sendResponse(await synthesizeSpeech(String(msg.text || '').slice(0, 2000)));
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

// Alt+U 快捷开关生词高亮（manifest commands）：优先转发给当前标签页的 highlight.js；
// 页面无 content script 时（chrome:// 内置页、扩展重载前的旧标签）由 background
// 直接翻转 storage.sync 的 hlEnabled（各页经 storage.onChanged 自行启停）
chrome.commands.onCommand.addListener((command) => {
  if (command !== 'toggle-highlight') return;
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs && tabs[0];
    if (!tab || tab.id == null) return;
    chrome.tabs.sendMessage(tab.id, { type: MSG.ML_HL_TOGGLE }, (resp) => {
      if (chrome.runtime.lastError || !resp || !resp.ok) {
        chrome.storage.sync.get(__magicLensDefaults, ({ hlEnabled }) => {
          chrome.storage.sync.set({ hlEnabled: !hlEnabled });
        });
      }
    });
  });
});
