# LLD — R57 划词翻译仅单词直译，长选区/中文改为 AI 入框

> 状态：**已 merge 本地 develop，待真机验收**（2026-10-29，0.8.21-202610291722 测试版）
> 关联需求：R57；复用 R36 iframe 选区中继与既有伴读抽屉。

## 1. 背景

当前 `openBubble()` 对所有非空选区都按 `autoTranslate` 自动请求
`/vocabulary/reading/translate`。单个英文单词有金山词典快路径，体验最好；
短语、句子和中文选区则更适合让用户选择是否交给伴读 AI。

## 2. 行为口径

选区按以下矩阵处理：

| 选区 | 自动行为 | 气泡动作 |
| --- | --- | --- |
| 单个英文单词 | 自动翻译 | 译/详/🔊/认识/生词/AI |
| 英文短语或句子 | 只显示提示，不发请求 | 译/🔊/AI（AI 为主按钮） |
| 含中文的任意文本 | 只显示提示，不发请求 | 译/🔊/AI（AI 为主按钮） |
| 数字、URL、代码等 | 只显示提示，不发请求 | 译/🔊/AI（AI 为主按钮） |

点击 AI 后打开既有伴读抽屉，把选中原文原样放入输入框并把光标移到末尾，不自动发送。

## 3. 实现

- `extension/common.js` 新增纯函数 `__magicLensSelectionAction(text)`：
  单词口径限定为首尾 ASCII 字母、词内允许撇号/连字符；中文检测覆盖
  `\u3400-\u9fff` 与 `\uf900-\ufaff`；单词含中文时仍归 AI。
- `extension/content.js`：
  - `openBubble()` 先判定动作，再决定是否自动翻译；
  - AI 模式给按钮加 `primary` 样式，隐藏 `detail/known/unknown`；
  - 翻译长度上限只在 `translate` 分支检查，避免把长文本误拦在 AI 入口之外；
  - 「译」按钮保留，允许用户显式翻译任意文本。
- `extension/chat.js`：`open(text)` 直接赋值 `textarea.value = text`，去掉旧的
  `「」` 包装；保留 focus 与末尾光标。
- `extension/manifest.json`：`0.8.20 → 0.8.21-202610291722` 测试版。

## 4. 验证

```bash
node --check extension/common.js
node --check extension/content.js
node --check extension/chat.js
node scripts/check-selection-ai.js
node scripts/check-extension-modules.js
node scripts/check-ball-visibility.js
git diff --check
```

新增守卫覆盖单词、撇号/连字符词、短语、中文、英中混排、数字、标点与空文本。
另用本机 Chrome headless 直接加载真实 `common.js → content.js → chat.js`，
以 stub 的中转层记录消息：实测单词只发 1 次 `ml:translate`，短语/中文均不新增请求，
AI 模式手动点「译」能新增请求；从短语切回单词后按钮状态复位；点击中文气泡的 AI 后，
伴读输入框值为 `你好世界`（原文、无引号）。

真机清单待用户：

1. 选中单个英文单词，仍自动显示词典译文；
2. 选中英文短语/句子，不自动发翻译，AI 按钮突出；
3. 选中含中文文本，不自动翻译，AI 按钮突出；
4. 点 AI 后抽屉输入框内容与选区原文一致，光标在末尾、未自动发送；
5. 在 AI 模式下点「译」仍能手动翻译；
6. iframe 正文拖选与顶层页面行为一致。

## 5. 边界

- 不改 moon-well 接口、background 消息类型或 AI 发送协议。
- AI 输入仍受 `chat.js MAX_MESSAGE=4000` 的既有发送上限约束。
- 悬浮生词和点高亮词的来源是单个单词，行为保持自动翻译。
