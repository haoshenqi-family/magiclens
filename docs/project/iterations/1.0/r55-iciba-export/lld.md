# LLD — R55 修复 R48 金山直连模块导出契约回归

> 状态：**已 merge 本地 develop，待真机验收**（2026-10-27，0.8.19-202610272026 测试版）
> 关联需求：R48 金山直连域迁 `iciba.js`；本缺陷由该重构引入。

## 1. 根因

R48 将金山直连域从 `background.js` 拆到 `iciba.js` 时，模块公开键为
`lookupWithStemming`，但 `background.js` 仍按原内部函数名解构：

```js
const { WORD_PATTERN, icibaLookupWithStemming } = __magicLensIciba;
```

解构结果中 `icibaLookupWithStemming` 为 `undefined`。由于错误发生在消息回调而非
模块加载期，`node --check` 与页面加载都不报错，只有用户划词进入 `ML_TRANSLATE`
时才抛 `TypeError: icibaLookupWithStemming is not a function`。

## 2. 修复

- 消费模块公开键并显式别名：
  `lookupWithStemming: icibaLookupWithStemming`；
- 新增 `scripts/check-extension-modules.js`：Node VM 真实执行
  `common.js → rpc.js → iciba.js → background.js`，触发 `ML_TRANSLATE('hello')`，
  断言直连命中响应为 `{ok:true, data:{..., source:'iciba'}}`；
- 测试版版本递增 `0.8.18 → 0.8.19-202610272026`。

## 3. 验证

```bash
for f in extension/*.js; do node --check "$f"; done
node scripts/check-extension-modules.js
```

守卫在修复前会因 `icibaLookupWithStemming is not a function` 失败，修复后通过；
它锁的是跨文件导出契约，不替代 `chrome://extensions` 真机划词验收。

## 4. 边界

- 金山直连行为、词干化口径、缓存与 moon-well 回退均未改变。
- 本次不处理 R48 台账缺条：该历史缺口保持原样登记，不静默重写。
