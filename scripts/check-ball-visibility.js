#!/usr/bin/env node
/*
 * MagicLens 悬浮球显隐守卫（R56）：
 * magicbook 的 layout/阅读器模板会全站注入宿主 buddy 球，扩展 ball.js 若仍按
 * 「所有网页」显示，就会在同一位置叠出第二个入口。这里真实加载 common.js，
 * 锁住宿主让位域及原有的主开关 / 球开关 / iframe / 用户禁用名单语义。
 *
 * 无第三方依赖：node scripts/check-ball-visibility.js
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

const visible = context.__magicLensBallVisible;
const yieldDomains = context.__magicLensBallYieldDomains;
const enabled = { enabled: true, ballEnabled: true, disabledDomains: [] };

assert.equal(typeof visible, 'function', 'common.js 必须公开 __magicLensBallVisible');

// R56 宿主让位：magicbook 当前正式域及其全部子域隐藏。
assert.equal(visible(enabled, 'magicbook.haoshenqi.top', true), false,
  'magicbook 站内必须让位给宿主悬浮球');
assert.equal(visible(enabled, 'reader.magicbook.haoshenqi.top', true), false,
  'magicbook 子域必须同样让位');

// 边界：不能误伤相似域名、其他站点或用户自己配置的禁用站。
assert.equal(visible(enabled, 'notmagicbook.haoshenqi.top', true), true,
  '相似域名不得被当成 magicbook 子域');
assert.equal(visible(enabled, 'example.com', true), true,
  '其他网站仍应显示扩展悬浮球');
assert.equal(visible(enabled, 'magicbook.haoshenqi.top.evil.example', true), true,
  '把让位域塞进更长的域名不得误判为子域');
assert.equal(visible(enabled, 'magicbook.haoshenqi.top', false), false,
  'iframe 中不得显示悬浮球');

// 原有开关与用户名单语义保持不变。
assert.equal(visible({ ...enabled, enabled: false }, 'example.com', true), false,
  '主开关关闭时必须隐藏');
assert.equal(visible({ ...enabled, ballEnabled: false }, 'example.com', true), false,
  '球开关关闭时必须隐藏');
assert.equal(visible({ ...enabled, disabledDomains: ['example.com'] }, 'sub.example.com', true), false,
  '用户禁用域及其子域必须隐藏');

assert.equal(Array.isArray(yieldDomains), true, '让位域必须是数组');
assert.equal(Object.isFrozen(yieldDomains), true, '让位域名单位必须冻结，运行期不得漂移');
assert.deepEqual(Array.from(yieldDomains), ['magicbook.haoshenqi.top']);

console.log('PASS ball visibility: magicbook host yield + original gates');
