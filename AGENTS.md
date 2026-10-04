# 🤖 AGENT INSTRUCTIONS — magiclens

> 🟢 **加载确认**：读取本文件后，请首行回复：`✅ AGENTS.md 已激活 | 语言：中文 | 模式：严格遵循工作流`

---

## 项目定位

**MagicLens 词镜**：Chrome MV3 扩展，把 magicbook 的阅读能力（划词/段落翻译、认识/生词标记、词汇表、TTS、伴读聊天）带到任意网页。**纯前端项目，无自建后端**——所有能力直连 [moon-well](../moon-well) 既有 API；可行性评估见 magicbook 仓库 `response.md` R118/R119 与本仓库 `docs/design.md`。

## 核心工作流（轻量版）

1. **任务分类**：编码 / bug 修复 / 文档 / 问答。
2. **状态同步**：回复 `🔍 正在执行 [任务类型] 类任务`。
3. **记录纪律**（与家族项目一致）：接到任务先在 `requests.md` 占号追加；完成后写 `response.md`（只保留最近 10 条，满 10 的整数倍归档到 `response-archive/`）。
4. 单线程开发：一次只做一个任务，完成验证后再进入下一个。

## 硬性约定

- **API 契约以 moon-well 代码为唯一权威**（`ReadingVocabularyController` / `VocabularyController` / `ReadingSettingsController` / tts 模块），统一 `Result{success, result, message}` 包装；改接口先改 moon-well 并确认其 `AGENTS.md` 流程。
- **所有 moon-well 请求必须经 background service worker 中转**：MV3 content script 的 fetch 遵循页面源 CORS，且 http 页面有混合内容限制；SW 持有 `host_permissions` 豁免。
- **UI 一律挂 closed Shadow DOM**，禁止向页面注入全局样式或污染 `window`（仅保留 `__magicLensLoaded` 防重入门）。
- **Token 只存 `chrome.storage.sync`**（浏览器本地）；任何真实 token、密钥禁止入库。
- 无构建链，`extension/` 目录即最终产物：改完在 `chrome://extensions` 重新加载即可验证；`manifest.json` 的 `version` 按语义化版本递增。
- 选区文本上限 2000 字符（moon-well translate 接口约束）；生词标记仅英文单词（正则提取首个英文词）。
- 图标由 `scripts/gen_icons.py` 生成（纯标准库），改图标改脚本后重新生成，不手工编辑 PNG。

## Git 约定

- 默认分支 `develop`，日常开发一律在 `develop` 进行（对齐家族 magicbook / moon-well 惯例）；`main` 仅用于发布：需要发版时将 `develop` 合并到 `main` 并推送，禁止在 `main` 上直接开发或临时提交。
- 提交信息用 `类型: 摘要`（init / feat / fix / docs / chore）。
- 仓库在 `haoshenqi-family` 组织下，**private**。

## 内网环境

与家族一致（见根目录 `Agents.md`）：moon-well 运行在飞牛 NAS（192.168.31.9:8082），默认 `apiBase` 即此地址；公网入口待 Server 2 Traefik 加路由。
