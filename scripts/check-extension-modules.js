#!/usr/bin/env node
/*
 * MagicLens 模块边界冒烟（R55）：
 * R48 把金山直连域拆到 iciba.js 后，background.js 仍按内部函数名解构，
 * 而模块公开的是 lookupWithStemming——静态 node --check 发现不了这种跨文件
 * 契约漂移，直到用户划词才抛 "icibaLookupWithStemming is not a function"。
 *
 * 本守卫在 Node VM 中真实执行 common.js → rpc.js → iciba.js → background.js，
 * 再触发一次 ML_TRANSLATE 直连命中，锁住「模块导出名 ↔ SW 消费名」契约。
 * R64 增补回调页契约：oidc-callback.js 在 VM 中按 manifest 注入顺序真实执行
 * rpc.js → oidc-callback.js，锁住「存令牌 → 渲染横幅 → 发 ML_LOGIN_OK → 注册
 * 兜底定时器」链路——R47 迁独立 content script 后引用裸 MSG（rpc.js 只挂
 * __magicLensRpc），ReferenceError 抛在 storage 异步回调里无人接，登录成功页
 * 永不关闭，静态 node --check 与本套件原断言都覆盖不到这个域。
 * 无第三方依赖：node scripts/check-extension-modules.js
 */
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

async function main() {
  const extensionDir = path.resolve(__dirname, '..', 'extension');
  const read = (name) => fs.readFileSync(path.join(extensionDir, name), 'utf8');

  let messageListener = null;
  const storage = {
    sync: {
      get: async (defaults) => ({ ...defaults }),
      set: async () => {},
    },
    session: {
      get: async () => ({}),
      set: async () => {},
    },
  };

  const chrome = {
    runtime: {
      id: 'magiclens-contract-check',
      lastError: null,
      onMessage: { addListener: (fn) => { messageListener = fn; } },
      onInstalled: { addListener: () => {} },
      sendMessage: () => {},
      openOptionsPage: () => {},
    },
    storage,
    commands: { onCommand: { addListener: () => {} } },
    tabs: {
      create: () => {},
      query: () => {},
      remove: async () => {},
      sendMessage: () => {},
    },
    offscreen: {
      createDocument: async () => {},
      closeDocument: async () => {},
    },
  };

  const context = vm.createContext({
    AbortSignal,
    Blob,
    FormData,
    URL,
    chrome,
    console,
    fetch: async () => ({
      ok: true,
      status: 200,
      json: async () => ({ message: [{ key: 'hello', paraphrase: 'int. 你好' }] }),
    }),
    setTimeout,
    clearTimeout,
  });

  const imported = [];
  context.importScripts = (...names) => {
    imported.push(...names);
    for (const name of names) vm.runInContext(read(name), context, { filename: name });
  };

  vm.runInContext(read('background.js'), context, { filename: 'background.js' });

  assert.deepEqual(imported, ['common.js', 'rpc.js', 'iciba.js']);
  assert.equal(typeof context.__magicLensIciba.lookupWithStemming, 'function',
    'iciba.js 必须公开 lookupWithStemming');
  assert.equal(typeof messageListener, 'function', 'background.js 必须注册消息监听器');

  const response = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('ML_TRANSLATE 冒烟超时')), 2000);
    try {
      const keepChannel = messageListener(
        { type: context.__magicLensRpc.MSG.ML_TRANSLATE, text: 'hello' },
        {},
        (value) => {
          clearTimeout(timer);
          resolve(value);
        },
      );
      assert.equal(keepChannel, true, '异步 sendResponse 必须保持消息通道');
    } catch (error) {
      clearTimeout(timer);
      reject(error);
    }
  });

  // vm 内对象来自另一 realm，原型不同会让 deepStrictEqual 误报；先归一再比字段。
  assert.deepEqual(JSON.parse(JSON.stringify(response)), {
    ok: true,
    data: { text: 'hello', translation: 'int. 你好', source: 'iciba' },
  });

  console.log('PASS extension module contract: iciba.js export -> background.js ML_TRANSLATE');

  // ---- R64 回调页契约：登录成功链路必须真实走通（存令牌→发 ML_LOGIN_OK→兜底定时器）----
  // manifest 断言注入顺序：oidc-callback.js 依赖 __magicLensRpc.MSG，rpc.js 必须先注入。
  const manifest = JSON.parse(read('manifest.json'));
  const callbackEntry = manifest.content_scripts.find((entry) => entry.js.includes('oidc-callback.js'));
  assert.ok(callbackEntry, 'manifest 必须有 oidc-callback.js 的注入条目');
  assert.deepEqual(callbackEntry.js, ['rpc.js', 'oidc-callback.js'],
    '回调页条目必须先注入 rpc.js（oidc-callback.js 解构 __magicLensRpc.MSG）');

  const saved = {};
  const sent = [];
  const timers = [];
  const makeElement = (tag) => ({
    tagName: tag,
    className: '',
    textContent: '',
    style: {},
    children: [],
    append(...els) { this.children.push(...els); },
    appendChild(el) { this.children.push(el); return el; },
  });
  const head = makeElement('head');
  const body = makeElement('body');
  body.innerText = JSON.stringify({
    success: true,
    result: { accessToken: 'at-contract-check', refreshToken: 'rt-contract-check' },
  });
  // content script 世界：window 即隔离世界的全局（rpc.js 挂 __magicLensRpc 的目标），
  // 所以 window 必须自指回全局，否则裸 __magicLensRpc 解析不到——恰是 R64 缺陷形态。
  const sandbox = {
    location: { hostname: 'moon-well.haoshenqi.top', pathname: '/auth/oidc/callback' },
    document: { head, body, createElement: (tag) => makeElement(tag) },
    chrome: {
      // storage 回调按浏览器语义异步投递：修复前（裸 MSG）会在异步回调里抛
      // ReferenceError——同步调用会被外层 try/catch 接住，掩盖真实失败形态
      storage: { sync: { set: (items, cb) => { queueMicrotask(() => { Object.assign(saved, items); cb(); }); } } },
      runtime: { sendMessage: (msg, cb) => { sent.push(msg); cb(); } },
    },
    // 只记录不执行：window.close 兜底 3s 不必真等，链路正确性由注册与否断言
    setTimeout: (fn, ms) => { timers.push(ms); return 0; },
    clearTimeout: () => {},
    console,
  };
  sandbox.window = sandbox;
  sandbox.close = () => {};
  const callbackContext = vm.createContext(sandbox);
  vm.runInContext(read('rpc.js'), callbackContext, { filename: 'rpc.js' });
  vm.runInContext(read('oidc-callback.js'), callbackContext, { filename: 'oidc-callback.js' });
  await new Promise((resolve) => setImmediate(resolve)); // 让异步 storage 回调落地

  assert.deepEqual(saved, { token: 'at-contract-check', refreshToken: 'rt-contract-check' },
    '回调页必须把两个令牌写入 chrome.storage.sync');
  assert.equal(sent.length, 1, 'ML_LOGIN_OK 必须恰好发出一次（background 据此关标签页）');
  assert.equal(sent[0].type, context.__magicLensRpc.MSG.ML_LOGIN_OK,
    '发出的消息类型必须取自 rpc.js 的 MSG 表（R64：裸 MSG 引用会让发送整段哑火）');

  const bannerTexts = [];
  const walk = (el) => { bannerTexts.push(String(el.textContent)); (el.children || []).forEach(walk); };
  walk(head);
  walk(body);
  assert.ok(bannerTexts.some((t) => t === '✓ MagicLens 登录成功'), '成功横幅必须已渲染');
  assert.ok(timers.includes(3000), 'window.close 兜底定时器必须注册');

  console.log('PASS extension module contract: oidc-callback.js stores token and sends ML_LOGIN_OK');

  // ---- R66 划词发音契约：四级链路（缓存→词典直连→后端代理）与单词形状闸 ----
  // VM 里补内存 IndexedDB 桩 + 可控 fetch，锁 background 侧「归一 → 形状闸 → 直连 →
  // 代理 → 缓存写读回」顺序与回传形制 {ok, audioBase64, source}——content 侧只认
  // 这个形制，rpc.js 的 ML_DICT_SPEAK 条目在上方 importScripts 时已随 MSG 表锁定。
  const dictMp3 = 'RkFLRS1NUDM='; // "FAKE-MP3" 的 base64，回传形制断言用
  const mp3Bytes = Uint8Array.from(atob(dictMp3), (c) => c.charCodeAt(0)).buffer;

  function makeIdbStub() {
    const records = new Map();
    const ok = (value) => {
      const req = { result: value, onsuccess: null, onerror: null };
      queueMicrotask(() => req.onsuccess && req.onsuccess());
      return req;
    };
    return {
      open() {
        const db = {
          transaction(_name, _mode) {
            const tx = {
              oncomplete: null,
              objectStore() {
                return {
                  get(key) {
                    return ok(records.get(key) ? { ...records.get(key) } : undefined);
                  },
                  put(record) {
                    records.set(record.word, { ...record });
                    queueMicrotask(() => tx.oncomplete && tx.oncomplete());
                    return ok(undefined);
                  },
                  count() { return ok(records.size); },
                  index(_name) {
                    return {
                      openCursor() {
                        // 按 ts 升序游标（LRU 剪枝路径；删除即时生效）
                        const items = [...records.values()].sort((a, b) => a.ts - b.ts);
                        const req = { onsuccess: null, onerror: null };
                        queueMicrotask(() => {
                          const next = () => {
                            const rec = items.shift();
                            if (!rec) return req.onsuccess && req.onsuccess(null);
                            records.delete(rec.word);
                            req.onsuccess && req.onsuccess({
                              delete() { /* 顺序遍历已统一删除 */ },
                              continue() { next(); },
                            });
                          };
                          next();
                        });
                        return req;
                      },
                    };
                  },
                };
              },
            };
            return tx;
          },
        };
        return ok(db);
      },
    };
  }

  const idb = makeIdbStub();
  context.indexedDB = { open: (name, version) => idb.open(name, version) };
  context.atob = atob;
  context.btoa = btoa;

  const fetchLog = [];
  const syncStore = {};
  chrome.storage.sync.get = async (defaults) => ({ ...defaults, ...syncStore });
  const fetchRoutes = {
    // 默认路由：词典直连命中；后端代理与失败场景逐用例覆盖
    direct: { status: 200, contentType: 'audio/mpeg', body: mp3Bytes, fail: false },
    proxy: { status: 200, contentType: 'audio/mpeg', body: mp3Bytes, fail: false },
  };
  function HeadersImpl(entries) {
    const map = new Map(entries.map(([k, v]) => [k.toLowerCase(), v]));
    return { get: (k) => map.get(String(k).toLowerCase()) || null };
  }
  context.fetch = async (input) => {
    const url = String(input);
    fetchLog.push(url);
    const route = url.includes('dict.youdao.com') ? fetchRoutes.direct
      : url.includes('/tts/dict-voice') ? fetchRoutes.proxy : null;
    if (!route || route.fail) throw new TypeError('network down');
    if (route.status >= 400) {
      return { ok: false, status: route.status, headers: HeadersImpl([['Content-Type', route.contentType]]), arrayBuffer: async () => route.body };
    }
    return {
      ok: true,
      status: route.status,
      headers: HeadersImpl([['content-type', route.contentType]]),
      arrayBuffer: async () => route.body,
    };
  };

  const askDict = (word) => new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('ML_DICT_SPEAK 冒烟超时')), 2000);
    messageListener({ type: context.__magicLensRpc.MSG.ML_DICT_SPEAK, word }, {}, (value) => {
      clearTimeout(timer);
      resolve(JSON.parse(JSON.stringify(value)));
    });
  });

  // ① 未登录（syncStore 空）+ 直连命中：走四级第 2 级并回传词典音
  fetchLog.length = 0;
  const dictResp = await askDict('  Hello  ');
  assert.equal(dictResp.ok, true, '直连命中必须 ok');
  assert.equal(dictResp.source, 'dict', '未登录时命中级=词典直连');
  assert.equal(dictResp.audioBase64, dictMp3, '回传必须是 base64 音频字节');
  assert.equal(fetchLog.length, 1, '直连命中后不得再打后端代理');
  assert.ok(fetchLog[0].includes('audio=hello'), '请求词必须归一（trim+小写）');

  // ② 缓存命中：不打任何网络（四级第 1 级短路）
  fetchLog.length = 0;
  const cacheResp = await askDict('hello');
  assert.equal(cacheResp.ok, true);
  assert.equal(cacheResp.source, 'cache', '第二次同词必须走 IndexedDB 缓存');
  assert.equal(fetchLog.length, 0, '缓存命中不得出网');

  // ③ 直连失败 + 登录态后端代理命中：四级第 3 级兜底，且代理音同样入缓存
  syncStore.apiBase = 'https://mw.test';
  syncStore.token = 'at-r66';
  fetchRoutes.direct.fail = true;
  fetchLog.length = 0;
  const proxyResp = await askDict('word');
  assert.equal(proxyResp.ok, true, '直连失败必须继续走后端代理');
  assert.equal(proxyResp.source, 'proxy', '后端代理命中级=proxy');
  assert.equal(fetchLog.length, 2, '直连 1 次 + 后端 1 次');
  assert.ok(fetchLog[1].includes('/tts/dict-voice'), '第二跳必须是 moon-well 词典代理端点');

  // ④ 直连 + 后端都无音频：ok:false（content 据此落机器合成兜底）
  fetchRoutes.proxy.status = 404;
  fetchLog.length = 0;
  const noneResp = await askDict('zzzz');
  assert.deepEqual(noneResp, { ok: false, error: 'no dict voice' }, '四级全空必须明确失败');

  // ⑤ 非单词形状：形状闸直接拒，不出网不查缓存（防端点被当通用朗读用）
  fetchLog.length = 0;
  const shapeResp = await askDict('hello world');
  assert.deepEqual(shapeResp, { ok: false, error: 'not-a-word' }, '非单词必须被形状闸拦下');
  assert.equal(fetchLog.length, 0, '形状闸拦截不得出网');

  console.log('PASS extension module contract: background.js ML_DICT_SPEAK four-tier dict voice chain');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
