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
      onStartup: { addListener: () => {} },
      sendMessage: () => {},
      openOptionsPage: () => {},
    },
    storage,
    commands: { onCommand: { addListener: () => {} } },
    contextMenus: {
      removeAll: (cb) => { if (cb) cb(); },
      create: () => {},
      onClicked: { addListener: () => {} },
    },
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
  // R67：批量翻译端点的响应与请求体捕获（JSON Result 信封，与 R66 的二进制路由分开）
  let batchResponse = { success: true, result: [] };
  const batchCalls = [];
  function HeadersImpl(entries) {
    const map = new Map(entries.map(([k, v]) => [k.toLowerCase(), v]));
    return { get: (k) => map.get(String(k).toLowerCase()) || null };
  }
  context.fetch = async (input, init) => {
    const url = String(input);
    fetchLog.push(url);
    if (url.includes('/vocabulary/reading/translate-batch')) {
      batchCalls.push({ url, body: init && init.body ? JSON.parse(String(init.body)) : null });
      return { ok: true, status: 200, json: async () => batchResponse };
    }
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

  // ---- R67 段落整页翻译契约：批量端点形制 + manifest 注入位 ----
  // 锁三件事：①ML_TRANSLATE_BATCH 的「归一/过滤/截断→envelope 解包→顺序数组透传」——
  // page-translate.js 只认 {ok, data:[...]} 形制；②空段落护栏（不发网）；③manifest 必须把
  // page-translate.js 注入主内容脚本清单且不得进 all_frames 条目（引擎只在顶层文档跑）。
  assert.equal(context.__magicLensRpc.MSG.ML_TRANSLATE_BATCH, 'ml:translate-batch', 'MSG 表必须有 ML_TRANSLATE_BATCH');
  assert.equal(context.__magicLensRpc.MSG.ML_PT_TOGGLE, 'ml:pt-toggle', 'MSG 表必须有 ML_PT_TOGGLE');

  const mainEntry = manifest.content_scripts.find((entry) => entry.js.includes('page-translate.js'));
  assert.ok(mainEntry, 'manifest 必须把 page-translate.js 注入主内容脚本清单');
  assert.ok(mainEntry.js.indexOf('rpc.js') < mainEntry.js.indexOf('page-translate.js'),
    'page-translate.js 必须晚于 rpc.js 注入（依赖 __magicLensRpc.MSG）');
  assert.ok(!manifest.content_scripts.some((entry) => entry.all_frames && entry.js.includes('page-translate.js')),
    'page-translate.js 不得进 all_frames 条目（多文档由引擎自行经 contentDocument 伸手）');

  const askBatch = (payload) => new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('ML_TRANSLATE_BATCH 冒烟超时')), 2000);
    messageListener({ type: context.__magicLensRpc.MSG.ML_TRANSLATE_BATCH, ...payload }, {}, (value) => {
      clearTimeout(timer);
      resolve(JSON.parse(JSON.stringify(value)));
    });
  });

  // ① 归一/过滤/截断 + 信封解包：空白段剔除、\s+ 归一、2000 截断，服务端顺序数组原样透传
  batchCalls.length = 0;
  batchResponse = { success: true, result: ['你好世界', '第二个译文'] };
  const long = 'x'.repeat(2500);
  const batchResp = await askBatch({
    paragraphs: ['  Hello   world  ', long, '', '   '],
    bookName: 'example.com',
    chapter: '/a/b?c=1',
  });
  assert.equal(batchResp.ok, true, '批量翻译必须 ok');
  assert.deepEqual(batchResp.data, ['你好世界', '第二个译文'], '结果必须是服务端顺序数组');
  assert.equal(batchCalls.length, 1, '有效段落必须恰好发出一次批量请求');
  assert.ok(batchCalls[0].url.includes('/vocabulary/reading/translate-batch'), '端点必须正确');
  assert.deepEqual(batchCalls[0].body.paragraphs,
    ['Hello world', 'x'.repeat(2000)], '段落必须归一+截断且空白段被剔除');
  assert.equal(batchCalls[0].body.bookName, 'example.com');
  assert.equal(batchCalls[0].body.chapter, '/a/b?c=1');

  // ② 服务端截断为空串的段：前端按失败丢弃（""=该段失败，可重试、未缓存）
  batchCalls.length = 0;
  batchResponse = { success: true, result: ['好的', ''] };
  const partialResp = await askBatch({ paragraphs: ['first paragraph text', 'second paragraph text'] });
  assert.equal(partialResp.ok, true);
  assert.deepEqual(partialResp.data, ['好的', ''], '"" 段必须原样透传（丢弃语义在 page-translate 侧）');

  // ③ >20 段：SW 侧截到服务端上限 20（@Size(max=20)，超发必 400）
  batchCalls.length = 0;
  batchResponse = { success: true, result: [] };
  await askBatch({ paragraphs: Array.from({ length: 25 }, (_, i) => `paragraph ${i} with enough text`) });
  assert.equal(batchCalls[0].body.paragraphs.length, 20, '超过 20 段必须在 SW 侧截断');

  // ④ 空段落：护栏直接拒，不出网
  batchCalls.length = 0;
  const emptyResp = await askBatch({ paragraphs: ['', '   '] });
  assert.deepEqual(emptyResp, { ok: false, error: '没有可翻译的段落', status: 0 }, '空段落必须明确拒绝');
  assert.equal(batchCalls.length, 0, '护栏拦截不得出网');

  // ⑤ 积分不足（服务端 code 1101）：信封失败按原样透出，干净业务文案进 UI
  batchCalls.length = 0;
  batchResponse = { success: false, code: 1101, message: '积分不足，无法使用AI功能' };
  const poorResp = await askBatch({ paragraphs: ['some paragraph'] });
  assert.equal(poorResp.ok, false, '积分不足必须失败');
  assert.equal(poorResp.error, '积分不足，无法使用AI功能', '业务文案必须原样透传（R32 不做技术化改写）');

  console.log('PASS extension module contract: background.js ML_TRANSLATE_BATCH batch translate contract');

  // ---- R71 翻译快捷键契约：键位串三件套 + defaults 在册 + 装配静态断言 ----
  // 锁四件事：①common.js combo 三件套 round-trip（事件→串→匹配/反例→展示）——
  // e.code 形制是 macOS 死键（Alt+A→å）下快捷键能活的命门，按 e.key 匹配的回归
  // 必须在守卫层打掉；②__magicLensDefaults 两键在册（R46 默认值单点纪律）；
  // ③page-translate.js 装配（keydown 监听/编辑态守卫/两默认键引用/晚于 common.js 注入）；
  // ④options 录制器接线（录制框+清除按钮+combo 函数引用）。
  const defaults = context.__magicLensDefaults;
  assert.equal(defaults.shortcutPageToggle, 'Alt+KeyA', 'defaults 必须有 shortcutPageToggle（默认 Alt+A，与沉浸式翻译一致）');
  assert.equal(defaults.shortcutParagraph, 'Alt+KeyP', 'defaults 必须有 shortcutParagraph（默认 Alt+P）');

  const comboOf = context.__magicLensComboFromEvent;
  const comboMatch = context.__magicLensComboMatches;
  const comboLabel = context.__magicLensComboLabel;
  assert.equal(typeof comboOf, 'function', 'common.js 必须公开 __magicLensComboFromEvent');
  assert.equal(typeof comboMatch, 'function', 'common.js 必须公开 __magicLensComboMatches');
  assert.equal(typeof comboLabel, 'function', 'common.js 必须公开 __magicLensComboLabel');
  const ev = (mods, code) => ({
    altKey: mods.includes('Alt'), ctrlKey: mods.includes('Ctrl'),
    metaKey: mods.includes('Meta'), shiftKey: mods.includes('Shift'), code,
  });
  assert.equal(comboOf(ev(['Alt'], 'KeyA')), 'Alt+KeyA', '单修饰键出串');
  assert.equal(comboOf(ev(['Ctrl', 'Shift'], 'Comma')), 'Ctrl+Shift+Comma', '多修饰键固定序（Alt,Ctrl,Meta,Shift）');
  assert.equal(comboOf(ev(['Meta'], 'Digit1')), 'Meta+Digit1');
  assert.equal(comboOf(ev(['Shift'], 'KeyA')), null, '纯 Shift 不可录制（裸键属网页）');
  assert.equal(comboOf(ev([], 'KeyA')), null, '无主修饰键不可录制');
  assert.equal(comboOf({ code: 'KeyA' }), null, '残缺事件安全返回 null');
  assert.equal(comboOf(ev(['Alt'], 'AltLeft')), null, 'R72：修饰键自身物理键不可录制（防 Alt+AltLeft 怪串）');
  assert.equal(comboOf(ev(['Shift'], 'ShiftRight')), null, 'R72：裸 Shift 不可录制');
  assert.equal(comboMatch('Alt+KeyA', ev(['Alt'], 'KeyA')), true, '串↔事件全等命中');
  assert.equal(comboMatch('Alt+KeyA', ev(['Alt', 'Shift'], 'KeyA')), false, '修饰键集合必须全等（多 Shift 不命中）');
  assert.equal(comboMatch('Alt+KeyA', ev(['Ctrl'], 'KeyA')), false, '修饰键不同不命中');
  assert.equal(comboMatch('', ev(['Alt'], 'KeyA')), false, '空串=禁用，永不命中');
  assert.equal(comboMatch('Alt+KeyA', null), false, '非法事件安全返回 false');
  assert.equal(comboLabel('Alt+KeyA'), 'Alt+A', 'Key 前缀剥除');
  assert.equal(comboLabel('Ctrl+Shift+Comma'), 'Ctrl+Shift+,', '命名键给可读符号');
  assert.equal(comboLabel('Meta+Digit1'), 'Meta+1');
  assert.equal(comboLabel('Alt+Space'), 'Alt+空格');
  assert.equal(comboLabel(''), '', '空串展示为空（设置页显「未设置」）');
  assert.equal(comboLabel('Alt+Nonsense'), 'Alt+Nonsense', '未知 code 原样透出（新键盘键不炸展示）');

  const ptSrc = read('page-translate.js');
  assert.ok(ptSrc.includes("document.addEventListener('keydown'"), 'page-translate.js 必须挂顶层 keydown 监听');
  assert.ok(ptSrc.includes('isEditableTarget'), 'page-translate.js 必须带编辑态守卫（输入框内不触发）');
  assert.ok(ptSrc.includes('cfg.shortcutPageToggle') && ptSrc.includes('cfg.shortcutParagraph'),
    'page-translate.js 必须消费两个快捷键默认键');
  assert.ok(ptSrc.includes('__magicLensComboMatches'), '触发匹配必须走 common.js 三件套（禁私写匹配逻辑）');
  assert.ok(ptSrc.includes('onAliasKeydown') && ptSrc.includes('DOUBLE_ALT_MS'),
    'R72：必须挂别名监听（双击 Alt 切整页，500ms 窗口常量在册）');
  assert.ok(/BARE_ALT_RE|Alt\(\?:Left\|Right\)/.test(ptSrc) && /BARE_SHIFT_RE|Shift\(\?:Left\|Right\)/.test(ptSrc),
    'R72：双击 Alt/Shift 悬停必须按物理键 code（AltLeft/ShiftLeft 族）识别，不得按 e.key');
  const mainEntryR71 = manifest.content_scripts.find((entry) => entry.js.includes('page-translate.js'));
  assert.ok(mainEntryR71.js.indexOf('common.js') < mainEntryR71.js.indexOf('page-translate.js'),
    'page-translate.js 必须晚于 common.js 注入（依赖 defaults 与 combo 三件套）');

  const optHtml = read('options.html');
  const optSrc = read('options.js');
  for (const id of ['scPage', 'scPara', 'scPageClear', 'scParaClear', 'scErr']) {
    assert.ok(optHtml.includes(`id="${id}"`), `options.html 必须有快捷键录制元素 #${id}`);
  }
  assert.ok(optSrc.includes('__magicLensComboFromEvent') && optSrc.includes('__magicLensComboLabel'),
    'options.js 录制器必须走 common.js 三件套');
  assert.ok(optSrc.includes('shortcutPageToggle') && optSrc.includes('shortcutParagraph'),
    'options.js 必须读写两个快捷键设置键');

  console.log('PASS extension module contract: R71 translate shortcuts combo contract');

  // ---- R73 缺陷回归锁：元素级 TreeWalker 不得用 FILTER_REJECT ----
  // REJECT 语义=连子树一起剪掉：真实页面正文都嵌在 div/article 容器里，从 body 出发
  // 遇容器即全灭（整页翻译「已译 0 段」/伴读上下文采零，R67/P0 原始缺陷，扁平 fixture
  // 曾侥幸掩盖）。元素 walker 只许 SKIP（跳节点不下钻）；highlight.js 的 SHOW_TEXT
  // walker 用 REJECT 无害（文本节点无子树），不在本锁范围。
  const ptWalker = read('page-translate.js');
  const pxWalker = read('page-extract.js');
  assert.ok(!ptWalker.includes('FILTER_REJECT'), 'page-translate.js 元素 walker 禁用 FILTER_REJECT（R73：REJECT 剪子树致发现数恒 0）');
  assert.ok(ptWalker.includes('FILTER_SKIP'), 'page-translate.js 元素 walker 必须用 FILTER_SKIP 下钻嵌套容器');
  assert.ok(!pxWalker.includes('FILTER_REJECT'), 'page-extract.js 元素 walker 禁用 FILTER_REJECT（R73：伴读上下文采零）');
  assert.ok(pxWalker.includes('FILTER_SKIP'), 'page-extract.js 元素 walker 必须用 FILTER_SKIP 下钻嵌套容器');
  const fixtureHtml = fs.readFileSync(path.resolve(extensionDir, '..', '..', 'ops', 'tools', 'integration-suite', 'browser', 'pages', 'article.html'), 'utf8');
  assert.ok(fixtureHtml.includes('<article>') && fixtureHtml.includes('class="prose"'),
    'article fixture 必须保持嵌套容器结构（扁平 <p> 会掩盖 REJECT/SKIP 语义回归）');

  console.log('PASS extension module contract: R73 element-walker SKIP-subtree regression lock');

  // ---- R74 缺陷回归锁：双击 Alt 静默窗 + 会话代守卫 ----
  // 真机实测实锤两个键序缺陷：①双击 Alt 后 ≤500ms 按 Alt+A，其 Alt down 被当第二击
  // 误 toggle（连开两次）；②快速 OFF→ON 时旧会话在途回包跨会话插 DOM（同段双译文）。
  const ptR74 = read('page-translate.js');
  assert.ok(ptR74.includes('e.repeat'), '别名分发必须忽略长按 keydown 重复（e.repeat）');
  assert.ok(ptR74.includes('DOUBLE_ALT_QUIET'), '双击判定必须带静默确认窗（150ms 内其他 keydown 取消）');
  assert.ok((ptR74.match(/cancelPendingDouble\(\)/g) || []).length >= 3,
    'cancelPendingDouble 必须在「其他 keydown / stop / 新双击」三处调用');
  assert.ok(ptR74.includes('const seq = sessionSeq') && ptR74.includes('seq !== sessionSeq'),
    '批量回包必须按会话代守卫（stale 只进缓存不插 DOM）');
  assert.ok(ptR74.includes('sessionSeq += 1'), 'start() 必须递增会话代');

  console.log('PASS extension module contract: R74 double-tap quiet window + session-seq guard');

  // ---- R75 正文朗读：AI 音链路、段落独立模块、右键菜单与快捷键契约 ----
  const readSrc = read('page-speak.js');
  assert.ok(manifest.permissions.includes('contextMenus'),
    'R75：右键菜单需要 manifest contextMenus 权限');
  const mainEntryR75 = manifest.content_scripts.find((entry) => entry.js.includes('page-speak.js'));
  assert.ok(mainEntryR75, 'R75：page-speak.js 必须注入主文档');
  assert.ok(mainEntryR75.js.indexOf('common.js') < mainEntryR75.js.indexOf('page-speak.js'),
    'R75：page-speak.js 必须晚于 common.js（依赖 defaults / combo / split 三件套）');
  assert.ok(readSrc.includes('window.top !== window'),
    'R75：page-speak.js 必须只装配顶层文档（iframe 交给 magicbook 自身朗读）');
  assert.ok(readSrc.includes('MSG.ML_TTS_SPEAK') && !readSrc.includes('speechSynthesis'),
    'R75：网页朗读必须默认 AI 音（ML_TTS_SPEAK），不得退回浏览器机械音');
  assert.ok(readSrc.includes('shortcutReadAloud') && readSrc.includes('__magicLensComboMatches'),
    'R75：快捷键必须走 common.js 三件套与 shortcutReadAloud 设置键');
  assert.ok(readSrc.includes('ML_READ_PARAGRAPH') && readSrc.includes('ML_READ_TOGGLE'),
    'R75：必须消费右键菜单两条消息');
  assert.ok(readSrc.includes("data-magiclensRead") || readSrc.includes("dataset.magiclensRead"),
    'R75：必须写能力握手标记 data-magiclens-read');
  assert.ok(readSrc.includes('__magicLensSplitForSpeech'),
    'R75：超长段落必须复用共同分段器（≤1800 字符）');
  assert.ok(readSrc.includes('getClientRects') && readSrc.includes('lastLineRect'),
    'R75：段落 ▶ 必须定位到最后一行行尾（对齐 magicbook 段末工具）');
  assert.ok(readSrc.includes('syncHoverIcon') && readSrc.includes("'■'"),
    'R75：播放中段末按钮必须变 ■ 且可再点停止');

  const bgSrc = read('background.js');
  assert.ok(bgSrc.includes('TTS_CACHE_STORE') && bgSrc.includes('ttsInflight'),
    'R75：SW 必须带文本级朗读缓存与 single-flight（预取不重复计费）');
  assert.ok(bgSrc.includes('READ_MENU_PARAGRAPH') && bgSrc.includes('READ_MENU_TOGGLE'),
    'R75：background 必须创建两条右键菜单并转发');
  assert.ok(optHtml.includes('id="scRead"') && optSrc.includes('shortcutReadAloud'),
    'R75：设置页必须可录制朗读快捷键');

  console.log('PASS extension module contract: R75 page read-aloud AI voice + menu/shortcut');

  // ---- R76 段末工具：只留「朗读 + 翻译」两个按钮，翻译复用 page-translate 状态机 ----
  assert.strictEqual((readSrc.match(/class="mlr-pbtn /g) || []).length, 2,
    'R76：段末工具只能有朗读 + 翻译两个按钮（用户拍板不加其他动作）');
  assert.ok(readSrc.includes('mlr-speak') && readSrc.includes('mlr-trans'),
    'R76：段末工具按钮必须是 .mlr-speak 与 .mlr-trans');
  assert.ok(readSrc.includes('__magicLensParagraphTranslate')
    && readSrc.includes('__magicLensParagraphTranslateState'),
    'R76：段末「译」必须复用 page-translate 的单段翻译状态机（不复制资格/缓存/计费口径）');
  assert.ok(ptSrc.includes('function translateParagraphEl')
    && ptSrc.includes('window.__magicLensParagraphTranslate ='),
    'R76：page-translate 必须暴露段落翻译入口');
  assert.ok(/function translateParagraphAt[\s\S]{0,400}translateParagraphEl\(el\)/.test(ptSrc),
    'R76：Alt+P 与段末「译」必须共用 translateParagraphEl');
  assert.ok(readSrc.includes('[data-magiclens-translation]'),
    'R76：段落文本必须剔除内联译文块（列表项译文块插在元素内部，否则重扫掉出朗读列表）');

  console.log('PASS extension module contract: R76 paragraph tools speak + translate');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
