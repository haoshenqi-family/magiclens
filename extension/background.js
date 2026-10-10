/* MagicLens service worker：全部 HTTP 调用的唯一出口（moon-well API 中转 + 金山词霸直连）。
 * Why：MV3 中 content script 的 fetch 遵循页面源的 CORS 规则，
 * 而 service worker 持有 host_permissions 豁免，且能绕开 http 页面对
 * http 接口的混合内容限制，故所有 JSON API 请求统一在此中转。
 * v0.3：默认公网域名（Traefik → fnOS:8082）；JWT 静默刷新（access 7d / refresh 30d）。
 * v0.6：单词划词直连金山词霸 suggest（免登录快路径），miss 回退 moon-well。 */

const DEFAULT_CFG = {
  // 公网入口（moon-well.haoshenqi.top → fnOS tailscale :8082，见 app-manager traefik-dynamic/moonwell.yml）
  apiBase: 'https://moon-well.haoshenqi.top',
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

async function callApi(path, { method = 'POST', body, timeoutMs = TIMEOUT_MS } = {}, retried = false) {
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
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (e) {
    if (e.name === 'TimeoutError' || e.name === 'AbortError') {
      return { ok: false, error: `请求超时（${Math.round(timeoutMs / 1000)}s），请稍后重试`, status: 0 };
    }
    return { ok: false, error: `网络错误：${e.message}`, status: 0 };
  }

  // 401：静默刷新一次后重试；刷新真被拒绝才清空令牌强制重登
  if (resp.status === 401 && !retried && refreshToken) {
    try {
      await refreshTokens(refreshToken);
      return callApi(path, { method, body, timeoutMs }, true);
    } catch (e) {
      // Why 超时不清凭据：refresh 慢/断网只说明这一刻连不上，refreshToken 本身仍有效，
      // 抹掉会把一次网络抖动变成全标签页强制重登（且刚续期成功的并发请求会被连带清掉）。
      if (e && (e.name === 'TimeoutError' || e.name === 'AbortError')) {
        return { ok: false, error: `登录续期超时（${Math.round(TIMEOUT_MS / 1000)}s），请稍后重试`, status: 0 };
      }
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

/* ---------- 金山词霸 suggest 直连（单词划词快路径，R15） ----------
 * Why：单词翻译不再绕行 moon-well（浏览器→Traefik→Tailscale→fnOS 才到金山，两段
 * TLS + 一段隧道），service worker 持 <all_urls> host_permissions 天然豁免 CORS，
 * 直连通常百毫秒级且免登录。口径与后端 IcibaDictClient 完全一致：免费无凭证的
 * suggest 接口、仅接受首条 key 与查询词全等（忽略大小写）的结果、一切异常静默
 * 降级——词典 miss/异常回退 moon-well /vocabulary/reading/translate（ES 缓存、
 * 后端词干还原与 LLM 兜底原样保留），金山接口变动只影响速度，不影响正确性。 */

const ICIBA_URL =
  'https://dict-mobile.iciba.com/interface/index.php?c=word&m=getsuggest&nums=1&is_need_mean=1&word=';
// Why 每次直查也必须带超时：接口不可用时不能让单词气泡比走 moon-well 还慢
const ICIBA_TIMEOUT_MS = 2500;
// 划词「单词」判定，与后端 ReadingVocabularyService.WORD_PATTERN 一致
const WORD_PATTERN = /^[A-Za-z][A-Za-z'’-]*$/;
// session 缓存（含 miss 负缓存）：重复划词零网络。Why 不持久化：权威缓存在
// moon-well ES（跨设备），本地陈旧词条没必要跨浏览器会话存活
const ICIBA_CACHE_KEY = 'icibaCache';
const ICIBA_CACHE_CAP = 512;

// —— Porter 词干化，对齐 moon-well WordStemmer 依赖的 Lucene 8.3.0 EnglishAnalyzer ——
// Why 是 Lucene 版而非 1980 原始版：后端口径以 Lucene 为准（bli→ble 替代 abli→able、
// 新增 logi→log；wolves→wolv、agreed→agre 是实测输出，原论文注释只是中间值），
// 本实现已用 94 向量对照 Lucene 实测逐一验证。即使未来出现偏差，后果仅是金山多
// miss 一次 → 回退 moon-well（后端权威兜底），不会产生错误翻译。
const EN_STOPWORDS = new Set(('a an and are as at be but by for if in into is it ' +
  'no not of on or such that the their then there these they this to was will with').split(' '));

function porterStem(input) {
  let w = input;
  if (w.length <= 2) return w;
  const cons = (i) => {
    const c = w[i];
    if (c === 'a' || c === 'e' || c === 'i' || c === 'o' || c === 'u') return false;
    if (c === 'y') return i === 0 ? true : !cons(i - 1);
    return true;
  };
  // Porter m()：w[0..j] 内 VC 序列个数
  const measure = (j) => {
    let n = 0, i = 0;
    while (true) {
      if (i > j) return n;
      if (!cons(i)) break;
      i++;
    }
    i++;
    while (true) {
      while (true) {
        if (i > j) return n;
        if (cons(i)) break;
        i++;
      }
      i++; n++;
      while (true) {
        if (i > j) return n;
        if (!cons(i)) break;
        i++;
      }
      i++;
    }
  };
  const vowelInStem = (j) => {
    for (let i = 0; i <= j; i++) if (!cons(i)) return true;
    return false;
  };
  const doubleC = (j) => j >= 1 && w[j] === w[j - 1] && cons(j);
  // *o：词干以 c v c 结尾且末位非 w/x/y
  const cvc = (i) => i >= 2 && cons(i) && !cons(i - 1) && cons(i - 2) && w[i] !== 'w' && w[i] !== 'x' && w[i] !== 'y';

  // step1（原 1a+1b）：复数与 -ed/-ing
  if (w.endsWith('sses')) w = w.slice(0, -2);
  else if (w.endsWith('ies')) w = w.slice(0, -2);
  else if (!w.endsWith('ss') && w.endsWith('s')) w = w.slice(0, -1);
  if (w.endsWith('eed')) {
    if (measure(w.length - 4) > 0) w = w.slice(0, -1);
  } else {
    let stripped = false;
    if (w.endsWith('ed') && vowelInStem(w.length - 3)) { w = w.slice(0, -2); stripped = true; }
    else if (w.endsWith('ing') && vowelInStem(w.length - 4)) { w = w.slice(0, -3); stripped = true; }
    if (stripped) {
      if (w.endsWith('at') || w.endsWith('bl') || w.endsWith('iz')) w += 'e';
      else if (doubleC(w.length - 1) && w[w.length - 1] !== 'l' && w[w.length - 1] !== 's' && w[w.length - 1] !== 'z') w = w.slice(0, -1);
      else if (measure(w.length - 1) === 1 && cvc(w.length - 1)) w += 'e';
    }
  }
  // step2（原 1c）：(*v*) Y→I
  if (w.endsWith('y') && vowelInStem(w.length - 2)) w = w.slice(0, -1) + 'i';
  // step3（原 2）：双后缀映射（首条命中即止，m(stem)>0 才替换）
  const step3 = [['ational', 'ate'], ['tional', 'tion'], ['enci', 'ence'], ['anci', 'ance'],
    ['izer', 'ize'], ['bli', 'ble'], ['alli', 'al'], ['entli', 'ent'], ['eli', 'e'],
    ['ousli', 'ous'], ['ization', 'ize'], ['ation', 'ate'], ['ator', 'ate'], ['alism', 'al'],
    ['iveness', 'ive'], ['fulness', 'ful'], ['ousness', 'ous'], ['aliti', 'al'],
    ['iviti', 'ive'], ['biliti', 'ble'], ['logi', 'log']];
  for (const [suf, rep] of step3) {
    if (w.endsWith(suf)) {
      const j = w.length - suf.length - 1;
      if (measure(j) > 0) w = w.slice(0, j + 1) + rep;
      break;
    }
  }
  // step4（原 3）：-icate/-ative/-alize/-iciti/-ical/-ful/-ness
  const step4 = [['icate', 'ic'], ['ative', ''], ['alize', 'al'], ['iciti', 'ic'], ['ical', 'ic'], ['ful', ''], ['ness', '']];
  for (const [suf, rep] of step4) {
    if (w.endsWith(suf)) {
      const j = w.length - suf.length - 1;
      if (measure(j) > 0) w = w.slice(0, j + 1) + rep;
      break;
    }
  }
  // step5（原 4）：m>1 剥离固定后缀（按倒数第二字符分派，同 Lucene switch 语义）
  const step5fam = { a: ['al'], c: ['ance', 'ence'], e: ['er'], i: ['ic'], l: ['able', 'ible'],
    n: ['ant', 'ement', 'ment', 'ent'], o: ['ion', 'ou'], s: ['ism'], t: ['ate', 'iti'],
    u: ['ous'], v: ['ive'], z: ['ize'] };
  const fam = step5fam[w[w.length - 2]];
  if (fam) {
    for (const suf of fam) {
      if (!w.endsWith(suf)) continue;
      if (suf === 'ion') {
        const j = w.length - 4;
        if (j >= 0 && (w[j] === 's' || w[j] === 't') && measure(j) > 1) w = w.slice(0, j + 1);
      } else {
        const j = w.length - suf.length - 1;
        if (measure(j) > 1) w = w.slice(0, j + 1);
      }
      break;
    }
  }
  // step6（原 5a+5b）：m>1 或 m=1 且非 *o 去 E；m>1 且 LL → 单 L
  if (w.endsWith('e')) {
    const a = measure(w.length - 1);
    if (a > 1 || (a === 1 && !cvc(w.length - 2))) w = w.slice(0, -1);
  }
  if (w.endsWith('l') && doubleC(w.length - 1) && measure(w.length - 1) > 1) w = w.slice(0, -1);
  return w;
}

// 对齐后端 WordStemmer.stemWord：小写 → 剥所有格 → 纯字母校验 → 停用词过滤 → Porter
function stemWord(word) {
  let lower = word.trim().toLowerCase();
  if (!lower) return null;
  if (lower.endsWith("'s") || lower.endsWith('’s')) lower = lower.slice(0, -2);
  // 残留撇号/连字符（don't / mother-in-law）→ 非屈折形态，不还原
  if (!/^[a-z]+$/.test(lower)) return null;
  // 停用词（the、of 等）后端被分析器过滤返回 null；直查 miss 后同样不重查
  if (EN_STOPWORDS.has(lower)) return null;
  return porterStem(lower);
}

async function icibaCacheGet(word) {
  const store = await chrome.storage.session.get(ICIBA_CACHE_KEY);
  const cache = store[ICIBA_CACHE_KEY];
  return cache && Object.prototype.hasOwnProperty.call(cache, word) ? cache[word] : undefined;
}

async function icibaCachePut(word, paraphrase) {
  const store = await chrome.storage.session.get(ICIBA_CACHE_KEY);
  const cache = store[ICIBA_CACHE_KEY] || {};
  cache[word] = paraphrase;
  // 超容量按插入序淘汰最旧（字符串键保持插入序；命中不刷新位次，与后端
  // accessOrder LRU 略有差异，512 上限下无实际影响）
  const keys = Object.keys(cache);
  for (const k of keys.slice(0, Math.max(0, keys.length - ICIBA_CACHE_CAP))) delete cache[k];
  await chrome.storage.session.set({ [ICIBA_CACHE_KEY]: cache });
}

// suggest 会模糊匹配：仅接受首条记录 key 与查询词完全一致（忽略大小写）的结果
function parseIcibaParaphrase(payload, word) {
  const first = payload && Array.isArray(payload.message) ? payload.message[0] : null;
  if (!first || typeof first.key !== 'string') return null;
  if (first.key.trim().toLowerCase() !== word) return null;
  const paraphrase = typeof first.paraphrase === 'string' ? first.paraphrase.trim() : '';
  return paraphrase || null;
}

// 查询单词释义；miss/异常返回 null（异常同样写负缓存：接口不可用时同一词不再白等超时）
async function icibaLookup(word) {
  const key = word.trim().toLowerCase();
  if (!key) return null;
  const cached = await icibaCacheGet(key);
  if (cached !== undefined) return cached || null;
  let paraphrase = null;
  try {
    const resp = await fetch(ICIBA_URL + encodeURIComponent(key), {
      signal: AbortSignal.timeout(ICIBA_TIMEOUT_MS),
    });
    paraphrase = parseIcibaParaphrase(await resp.json(), key);
  } catch {
    /* 网络/超时/非 JSON：静默降级，与后端 IcibaDictClient 同哲学 */
  }
  await icibaCachePut(key, paraphrase || '');
  return paraphrase;
}

// 带词形还原的查询：原词 miss 后剥所有格 + Porter 词干重查一次（sidebars→sidebar），
// 与后端 IcibaDictClient.lookupWithStemming 同构；还原词与原词相同不重查
async function icibaLookupWithStemming(word) {
  const direct = await icibaLookup(word);
  if (direct) return direct;
  const stem = stemWord(word);
  if (!stem || stem === word.trim().toLowerCase()) return null;
  return icibaLookup(stem);
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  (async () => {
    switch (msg && msg.type) {
      case 'ml:translate': {
        // Why 单词先直连金山（R15 快路径，免登录、绕开 moon-well 网络链路）；
        // miss/异常回退 moon-well 全链路（ES 缓存 + 后端词干还原 + LLM 兜底），行为兼容改动前
        const text = String(msg.text || '').slice(0, 2000).trim();
        const dictTranslation = WORD_PATTERN.test(text) ? await icibaLookupWithStemming(text) : null;
        if (dictTranslation) {
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
      case 'ml:mark': {
        // known = 标记已认识（移出学习队列）；unknown = 加入生词本
        const action = msg.known ? 'known' : 'unknown';
        sendResponse(
          await callApi(`/vocabulary/${action}/${encodeURIComponent(msg.word || '')}`, { method: 'GET' })
        );
        break;
      }
      case 'ml:detail':
        // 单词详解：moon-well 缓存优先（magicbook-vocabulary 索引），miss 才调 LLM；
        // 划词可能是变体（ran），服务端负责还原词目并返回六板块结构化 JSON
        sendResponse(
          await callApi(`/vocabulary/detail/${encodeURIComponent(msg.word || '')}`,
            { method: 'GET', timeoutMs: DETAIL_TIMEOUT_MS })
        );
        break;
      case 'ml:analyze':
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
      case 'ml:familiar':
        // 高亮增量判定（SPA 动态内容）：单词本批量查询，无阅读事件副作用，故用于增量
        sendResponse(
          await callApi('/vocabulary/familiar', {
            body: { words: Array.isArray(msg.words) ? msg.words.slice(0, 300) : [] },
          })
        );
        break;
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
      case 'ml:auth': {
        // 聊天 SSE 直连前的凭据解析（R35）：apiBase/token 只此一处出——设置页自 v0.3
        // 起不写 apiBase，公网域名仅存在于本文件 DEFAULT 兜底，chat.js 曾本地读
        // storage 默认空串导致面板永远「未配置服务地址或 Token」且重新登录无效。
        // token 空而 refreshToken 有效时先静默刷新（与 callApi 的 401 刷新同语义），
        // SSE 不带空 Bearer 起跑；刷新失败的超时/清凭据分支也与 callApi 对齐。
        const { apiBase, token, refreshToken } = await getCfg();
        let authToken = token;
        if (!authToken && refreshToken) {
          try {
            authToken = await refreshTokens(refreshToken);
          } catch (e) {
            if (e && (e.name === 'TimeoutError' || e.name === 'AbortError')) {
              sendResponse({ ok: false, error: `登录续期超时（${Math.round(TIMEOUT_MS / 1000)}s），请稍后重试`, status: 0 });
              break;
            }
            await chrome.storage.sync.set({ token: '', refreshToken: '' });
            sendResponse({ ok: false, error: '登录已失效，请重新登录', status: 401, auth: true });
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
      case 'ml:login':
        // 打开 moon-well 的 Authentik 登录页（与 magicbook 同一登录入口）；
        // 成功后 callback 页由 content.js 自动捕获令牌
        chrome.tabs.create({ url: (await getCfg()).apiBase + LOGIN_PATH });
        sendResponse({ ok: true });
        break;
      case 'ml:register':
        // 邀请制注册（Authentik invitation-enrollment 流程，注册完回到登录页正常登录）
        chrome.tabs.create({ url: ENROLLMENT_URL });
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

// Alt+U 快捷开关生词高亮（manifest commands）：优先转发给当前标签页的 highlight.js；
// 页面无 content script 时（chrome:// 内置页、扩展重载前的旧标签）由 background
// 直接翻转 storage.sync 的 hlEnabled（各页经 storage.onChanged 自行启停）
chrome.commands.onCommand.addListener((command) => {
  if (command !== 'toggle-highlight') return;
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs && tabs[0];
    if (!tab || tab.id == null) return;
    chrome.tabs.sendMessage(tab.id, { type: 'ml:hl-toggle' }, (resp) => {
      if (chrome.runtime.lastError || !resp || !resp.ok) {
        chrome.storage.sync.get({ hlEnabled: true }, ({ hlEnabled }) => {
          chrome.storage.sync.set({ hlEnabled: !hlEnabled });
        });
      }
    });
  });
});
