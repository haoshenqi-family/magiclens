#!/usr/bin/env node
/*
 * MagicLens 悬浮球显隐守卫（R56）：
 * magicbook 的 layout/阅读器模板会全站注入宿主 buddy 球，扩展 ball.js 若仍按
 * 「所有网页」显示，就会在同一位置叠出第二个入口。这里真实加载 common.js，
 * 锁住宿主让位域及原有的主开关 / 球开关 / iframe / 用户禁用名单语义。
 *
 * R69 增补气泡注册表双锁（用户口径「代码层面写清楚，避免下次再犯」的执行机制）：
 * - 锁 A（common.js VM 真实执行）：__magicLensBallActions 的每个 cfgKey 必须在
 *   __magicLensDefaults 里有对应布尔默认（bubble 前缀键或 ballReview），且每个
 *   这类默认键必须回指唯一气泡——防「删气泡漏删默认键 / 加默认键忘挂气泡」；
 * - 锁 B（ball.js / options.js 文本断言）：ball.js 必须消费注册表（禁止私挂字面量
 *   ACTIONS 数组）、每个注册表 id 在 ball.js 有对应 RUNS 处理器行、options.js 必须
 *   循环注册表渲染配置（禁止手抄清单）——防「新气泡绕过配置面」回归 R67 前的状态。
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

// ---- R69 锁 A：气泡注册表 ↔ 默认键 双向覆盖（common.js 同一 VM 里对账） ----
const registry = context.__magicLensBallActions;
const defaults = context.__magicLensDefaults;
assert.ok(Array.isArray(registry) && registry.length >= 1, '气泡注册表必须存在且非空');
assert.equal(Object.isFrozen(registry), true, '气泡注册表必须冻结，运行期不得漂移');
assert.equal(Object.isFrozen(defaults), true, '默认值单点必须冻结');

const ids = new Set();
const cfgKeys = new Set();
for (const a of registry) {
  assert.ok(a && typeof a.id === 'string' && a.id, `注册表条目缺 id: ${JSON.stringify(a)}`);
  assert.ok(typeof a.icon === 'string' && typeof a.label === 'string' && a.label,
    `气泡 ${a.id} 缺 icon/label（options 配置 UI 直接渲染）`);
  assert.ok(typeof a.cfgKey === 'string' && a.cfgKey, `气泡 ${a.id} 缺 cfgKey（配置性是硬要求，R69）`);
  assert.ok(/^(bubble|ballReview)/.test(a.cfgKey), `气泡 ${a.id} 的 cfgKey 必须走 bubble*/ballReview 前缀契约: ${a.cfgKey}`);
  assert.equal(defaults[a.cfgKey], true, `气泡 ${a.id} 的默认键 ${a.cfgKey} 必须在 __magicLensDefaults 且默认 true（升级零变化）`);
  assert.ok(!ids.has(a.id), `气泡 id 重复: ${a.id}`);
  assert.ok(!cfgKeys.has(a.cfgKey), `cfgKey 重复: ${a.cfgKey}`);
  ids.add(a.id);
  cfgKeys.add(a.cfgKey);
}
// 反向：defaults 里所有 bubble 前缀键必须回指唯一注册表条目（ballReview 是滚动复习
// 词卡的全局开关、不是径向气泡——单独断言其默认值存在，不参与气泡双向对账）
assert.equal(defaults.ballReview, true, 'ballReview（滚动复习词卡开关）默认必须存在且为 true');
for (const key of Object.keys(defaults)) {
  if (!key.startsWith('bubble')) continue;
  assert.ok(cfgKeys.has(key), `默认键 ${key} 是孤儿——气泡已删但默认键未清，或默认键未挂注册表条目`);
}

// ---- R69 锁 B：ball.js 必须消费注册表、RUNS 全覆盖；options.js 禁手抄 ----
const ballSrc = fs.readFileSync(path.join(extensionDir, 'ball.js'), 'utf8');
assert.ok(ballSrc.includes('__magicLensBallActions'), 'ball.js 必须消费 __magicLensBallActions 注册表');
assert.ok(!/const\s+ACTIONS\s*=\s*\[/.test(ballSrc),
  'ball.js 禁止私挂字面量 ACTIONS 数组（清单只许来自注册表，R69）');
for (const id of ids) {
  assert.ok(new RegExp(`^\\s*'?${id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}'?\\s*:\\s*\\(\\)`, 'm').test(ballSrc),
    `ball.js 的 RUNS 表缺气泡 ${id} 的处理器行——注册表与 RUNS 必须一一对应`);
}
const optionsSrc = fs.readFileSync(path.join(extensionDir, 'options.js'), 'utf8');
assert.ok(optionsSrc.includes('__magicLensBallActions'),
  'options.js 必须循环 __magicLensBallActions 渲染配置 UI（禁止手抄气泡清单）');
assert.ok(optionsSrc.includes('ballReview'), 'options.js 必须渲染滚动复习词卡开关（ballReview）');

console.log('PASS ball visibility: magicbook host yield + original gates');
console.log(`PASS ball bubbles registry: ${registry.length} actions two-way locked with defaults + RUNS + options UI`);
