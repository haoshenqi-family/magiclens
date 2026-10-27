# response-archive · response-R39（2026-10-27 R52 写入触发轮转搬移，原文如下）

### R39（真机两问题：`Error://(:0)` 与「译点几下就卡死」）

- **用户报告**：装上 0.8.6 后控制台出现 `Error://(:0)`；阅读器里选中一个单词后，「译」点几下就卡死。
- **卡死根因（代码级，非推测）**：`content.js` 的 `translate()` **没有在途守卫**，`background.js` 的 `ml:translate` 也没有去重——每次点击都实打实发一条请求（单词走金山+词形还原，短语/句子走 moon-well LLM，一条可能十几秒）。连点就是把慢响应一个个压进气泡、并把 moon-well 免费档并发占满，表现为一直转圈的「卡死」。这是扩展既有缺陷，但 R36/R37 之后阅读器里的划词第一次真正高频走这条链路，所以现在就暴露了。
- **修复**：
  - `translate()` 加 `translateInflight`（同文本在途时点「译」直接忽略），完成回调里按文本解锁；`hide()` 与每次 `openBubble()` 都复位锁——这样即使某条请求因扩展重载永久不回（`askBackground` 在 invalidated 分支不调 onResult），也不会把这个词此后锁死。
  - `Error://(:0)` 归因到「扩展重载后残留在页上的旧副本」：孤立世界里抛出的 `Extension context invalidated` 没有源文件与行号，就显示成这种无名错误。`selection-relay.js` 改为一次性 `try getManifest` 失败即整体不注册；`sendMessage` 包 try/catch，抛错就 `retire()` 摘掉自己的监听并**收回 `data-magiclens-selection` 标记**（宿主的内置气泡因此能立刻回来，而不是留一个不会工作的空声明）；`highlight.js` 的 `markTakenOver()` 同样吞掉失效异常。
  - 顺带修一处我自己引入的漏洞：`retireOrphan()` 原来只摘 DOM 监听，R36 新加的 `chrome.runtime.onMessage` 监听摘不掉（匿名箭头），退役副本仍会接住 `ml:openSelection` 并在已 remove 的宿主上开气泡。现改为具名 `function onRuntimeMessage`（声明提升，退役路径任何顺序都能引用）并在 `retireOrphan()` 里 `removeListener`。
- **验证状态（诚实）**：`node --check` 四个 JS 全过；**未做真机验证**——扩展装不进这台自动化浏览器，且 magicbook 阅读器正文在自动化浏览器里渲染不出来（`file.epub` 200 但 iframe 不产生，控制台无 JS 报错，换书同样）。需要你在自己 Chrome 里重载 0.8.7 后验三件事：① 连点「译」不再叠请求（DevTools Network 里 `ml:translate` 对应的那次 moon-well/金山调用应当只有一条在途）；② 控制台不再出现 `:0` 那类无名错误；③ 重载扩展后旧标签页刷新前不应再有报错。
- **版本**：manifest `0.8.6 → 0.8.7-202610110826`（测试版，不触发发布）。0.8.6 已推 origin/develop 但**未发 GitHub Release**，所以线上扩展 zip 仍是 v0.8.5——它不写接管标记，magicbook 的探测版已上线，两者会同时出现（双气泡、双波浪线），**请尽快重载到 0.8.7**。
- **总结**：requests.md 占号 R39（`e0eda8e` 单独锁号）；本条写入使窗口达 11 个 request，最旧的 R28 原样搬至 `response-archive/response-R28.md` 并在索引登记；冲突记录：无（39 未被占用，顶端他人 commit 未动）。
