#!/usr/bin/env node
/*
 * MagicLens 悬浮球显隐守卫（R56）：
 * magicbook 的 layout/阅读器模板会全站注入宿主 buddy 球，扩展 ball.js 若仍按
 * 「所有网页」显示，就会在同一位置叠出第二个入口。这里真实加载 common.js，
 * 锁住宿主让位域及原有的主开关 / 球开关 / iframe / 用户禁用名单语义。
 *
 * R69 增补气泡注册表双锁（用户口径「代码层面写清楚，避免下次再犯」的执行机制）；
 * R70 真值源迁 moon-well 后锁 A 升级为跨仓断言、锁 B 改挂 buddy 页引导：
 * - 锁 A（跨仓）：__magicLensBallActions 的每个 id 必须在 moon-well BuddyService
 *   QUICK_ACTION_IDS 白名单内（真值源 POST /buddy/quick-actions 与 buddy 页配置面
 *   同一份）——新增气泡先扩后端白名单，否则 buddy 页表达不了它；
 * - 锁 B（ball.js / options.js 文本断言）：ball.js 必须消费注册表（禁止私挂字面量
 *   ACTIONS 数组）、每个注册表 id 在 ball.js 有对应 RUNS 处理器行；options.js 必须
 *   引导去 buddy 页且不得再渲染本地开关（R69 本地开关已随真值迁移移除）。
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

// ---- R70 锁 A：气泡注册表 ⊆ moon-well 快捷动作白名单（跨仓对账） ----
// 真值源 = moon-well POST /buddy/quick-actions 的白名单（BuddyService.QUICK_ACTION_IDS，
// magicbook buddy 页配置面同一份）。扩展 registry 的 id 必须都在白名单内——否则用户
// 在 buddy 页根本表达不了这个气泡（R70 起没有本地开关兜底）。家族布局两仓同层；
// 文件缺失/白名单解析失败直接挂（宁可误报不放过漂移）。
const registry = context.__magicLensBallActions;
assert.ok(Array.isArray(registry) && registry.length >= 1, '气泡注册表必须存在且非空');
assert.equal(Object.isFrozen(registry), true, '气泡注册表必须冻结，运行期不得漂移');

const ids = new Set();
for (const a of registry) {
  assert.ok(a && typeof a.id === 'string' && a.id, `注册表条目缺 id: ${JSON.stringify(a)}`);
  assert.ok(typeof a.icon === 'string' && typeof a.label === 'string' && a.label,
    `气泡 ${a.id} 缺 icon/label（渲染与无障碍名直接消费）`);
  assert.ok(!ids.has(a.id), `气泡 id 重复: ${a.id}`);
  ids.add(a.id);
}
const moonWellServicePath = path.resolve(extensionDir, '..', '..', 'moon-well',
  'src/main/java/top/haoshenqi/magicbook/buddy/service/BuddyService.java');
assert.ok(fs.existsSync(moonWellServicePath),
  `找不到 moon-well BuddyService.java（家族布局要求两仓同层）: ${moonWellServicePath}`);
const mwSrc = fs.readFileSync(moonWellServicePath, 'utf8');
const mwMatch = mwSrc.match(/QUICK_ACTION_IDS\s*=\s*List\.of\(([^)]*)\)/);
assert.ok(mwMatch, 'moon-well BuddyService.QUICK_ACTION_IDS 解析失败（形态漂移即挂）');
const mwWhitelist = new Set([...mwMatch[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]));
assert.ok(mwWhitelist.size >= registry.length, 'moon-well 白名单必须覆盖全部扩展气泡');
for (const id of ids) {
  assert.ok(mwWhitelist.has(id),
    `气泡 ${id} 不在 moon-well 快捷动作白名单——先去 BuddyService 扩白名单（buddy 页才能表达它），R70`);
}

// ---- R70 锁 B：ball.js 必须消费注册表、RUNS 全覆盖；options 必须引导去 buddy 页 ----
const ballSrc = fs.readFileSync(path.join(extensionDir, 'ball.js'), 'utf8');
assert.ok(ballSrc.includes('__magicLensBallActions'), 'ball.js 必须消费 __magicLensBallActions 注册表');
assert.ok(!/const\s+ACTIONS\s*=\s*\[/.test(ballSrc),
  'ball.js 禁止私挂字面量 ACTIONS 数组（清单只许来自注册表，R69/R70）');
for (const id of ids) {
  assert.ok(new RegExp(`^\\s*'?${id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}'?\\s*:\\s*\\(\\)`, 'm').test(ballSrc),
    `ball.js 的 RUNS 表缺气泡 ${id} 的处理器行——注册表与 RUNS 必须一一对应`);
}
const optionsSrc = fs.readFileSync(path.join(extensionDir, 'options.js'), 'utf8');
assert.ok(optionsSrc.includes('buddyConfigBtn') && optionsSrc.includes('__magicLensSiteOrigin'),
  'options.js 必须引导用户去 magicbook buddy 页配置快捷动作（R70 单一真值，本地无开关）');
assert.ok(!optionsSrc.includes('__magicLensBallActions'),
  'options.js 不得再循环注册表渲染本地开关（R70 真值已迁 moon-well，本地开关会漂移）');

console.log('PASS ball visibility: magicbook host yield + original gates');
console.log(`PASS ball bubbles registry: ${registry.length} actions ⊆ moon-well whitelist (${mwWhitelist.size}) + RUNS + buddy-page guide`);
