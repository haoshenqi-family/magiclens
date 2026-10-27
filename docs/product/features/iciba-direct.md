# 金山词霸直连查词（L3 实现说明）

> 状态：现行。R15 引入，R48 拆为独立模块，R55 修复模块导出契约回归。

## 实现

- `extension/iciba.js` 持有金山 suggest 直连、Porter 词干化与 `chrome.storage.session`
  查词缓存；模块经 `globalThis.__magicLensIciba` 公开 `WORD_PATTERN`、
  `lookupWithStemming`、`lookup`、`stemWord`。
- `extension/background.js` 经 `importScripts('common.js', 'rpc.js', 'iciba.js')` 加载模块，
  只消费公开键；`ML_TRANSLATE` 对单词先直连查词，命中返回 `source: 'iciba'`，
  miss/异常回退 moon-well `/vocabulary/reading/translate`。
- `scripts/check-extension-modules.js` 是模块边界守卫：在 Node VM 中真实加载上述四文件并
  触发一次直连命中，断言导出名、消息路由与响应形制一致。

## 边界

- 只有 `WORD_PATTERN` 命中的单词进入直连快路径；短语/句子直接走 moon-well。
- 直连异常、超时、模糊匹配 miss 都静默回退 moon-well，不改变翻译最终结果。
- 模块内部函数名不是对外契约；`background.js` 必须使用 `__magicLensIciba` 的公开键，
  需要沿用路由侧旧名时只能显式别名。
