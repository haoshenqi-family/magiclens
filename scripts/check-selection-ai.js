#!/usr/bin/env node
/*
 * MagicLens 划词去向守卫（R57）：
 * 单个英文单词继续即时翻译；短语、句子和含中文的选区不得自动触发翻译，
 * 应由气泡里的 AI 按钮把原文复制到伴读输入框。
 *
 * 无第三方依赖：node scripts/check-selection-ai.js
 */
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const extensionDir = path.resolve(__dirname, '..', 'extension');
const context = vm.createContext({ console, URL });
context.window = vm.runInContext('globalThis', context);

vm.runInContext(
  fs.readFileSync(path.join(extensionDir, 'common.js'), 'utf8'),
  context,
  { filename: 'common.js' },
);

const action = context.__magicLensSelectionAction;
assert.equal(typeof action, 'function', 'common.js 必须公开 __magicLensSelectionAction');

for (const word of ['hello', '  hello  ', "don't", 'don’t', 'well-known']) {
  assert.equal(action(word), 'translate', `单个英文单词应直接翻译：${word}`);
}

for (const text of [
  'hello world',
  'read the docs',
  '你好',
  'hello 世界',
  '123',
  'hello!',
]) {
  assert.equal(action(text), 'ai', `非单个英文单词应交给 AI：${text}`);
}

for (const text of ['', '   ']) {
  assert.equal(action(text), 'none', '空选区不应启动任何动作');
}

console.log('PASS selection action: single English word -> translate, otherwise -> AI');
