#!/usr/bin/env node
/*
 * MagicLens 模块边界冒烟（R55）：
 * R48 把金山直连域拆到 iciba.js 后，background.js 仍按内部函数名解构，
 * 而模块公开的是 lookupWithStemming——静态 node --check 发现不了这种跨文件
 * 契约漂移，直到用户划词才抛 "icibaLookupWithStemming is not a function"。
 *
 * 本守卫在 Node VM 中真实执行 common.js → rpc.js → iciba.js → background.js，
 * 再触发一次 ML_TRANSLATE 直连命中，锁住「模块导出名 ↔ SW 消费名」契约。
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
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
