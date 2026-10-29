# 划词去向（L3 实现说明）

> 状态：现行。R57 引入。

## 实现

- `extension/common.js` 的 `__magicLensSelectionAction(text)` 是唯一去向判定：
  单个英文单词返回 `translate`，其他非空文本返回 `ai`，空文本返回 `none`。
- `extension/content.js` 在 `openBubble()` 中消费该判定：
  - `translate` 且 `autoTranslate` 开启时，保持原有自动翻译；
  - `ai` 时不发翻译请求，突出「AI」主按钮，隐藏不能用于普通文本的「详/认识/生词」；
  - 「译」仍保留为手动操作，用户可显式翻译短语、句子或中文。
- `extension/chat.js` 的 `open(text)` 把选区原文直接写入伴读输入框，不添加引用符号，
  并把光标放到末尾；不自动发送。
- `scripts/check-selection-ai.js` 加载真实 `common.js`，锁住单词/短语/中文/数字/
  标点/空文本的判定矩阵。

## 边界

- 单词口径与划词朗读一致：首尾必须是 ASCII 字母，词内可含直撇号、弯撇号或连字符。
- 只要包含中文就归入 AI，即使选区里同时有英文单词。
- `MAX_LEN=2000` 只限自动翻译；AI 选区复制阶段不按该上限拦截，发送时沿用
  `chat.js` 既有的 4000 字上限。
- 悬浮生词与点高亮词本身就是单个英文单词，仍走即时翻译；iframe 选区与顶层选区
  共用 `openBubble()`，去向一致。
