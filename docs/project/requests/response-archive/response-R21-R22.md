# response-archive — R21~R22（原样搬移自 response.md，2026-10-08 R32 完成时搬移）

> 归档索引：[response-R1-R10.md](response-archive/response-R1-R10.md) · [response-R11-R15.md](response-archive/response-R11-R15.md)（2026-10-07 R25 完成时补执行 R10/R20 漏掉的归档） · [response-R16.md](response-archive/response-R16.md)、[response-R17-R18.md](response-archive/response-R17-R18.md)（2026-10-08 R28 收口时搬移） · [response-R19.md](response-archive/response-R19.md)（2026-10-08 R29 完成时搬移） · [response-R20.md](response-archive/response-R20.md)（2026-10-08 R30 完成时搬移）

### R21（悬浮改为直接弹出完整划词气泡：不真实选中，规避点击跳转）

- **回应**：按用户反馈把 R20 的「小翻译卡」升级为「悬浮即显完整划词气泡」（v0.7.1-202610071045 测试版）——悬停生词 ~200ms 直接弹出带 译/详/朗读/认识/生词/AI 全部按钮的既有气泡，效果「类似选中」但**不开真实选区**：部分 HTML 元素（链接/标题）点击会跳转，悬浮零副作用；也不覆盖用户已有选区、无原生选区高亮。
  - **职责划分**：highlight.js 只做命中测试（caretRangeFromPoint + nodeRaws 查表 + 区间复验）与节奏控制；气泡生命周期归 content.js。新增钩子 `__magicLensShowWordBubble(word, anchor)`（按词开气泡：resetButtons → show(anchor,'hover') → current 直置 → autoTranslate 自动翻译）与 `__magicLensHoverLeave`（只收 hover 来源气泡，划选气泡不动）。
  - **来源互通**：content.js show()/hide() 带 `__magicLensBubbleSource`（selection/hover/null），onScroll 复用 hide() 同步来源（顺带修掉 R20 审查提过的 onScroll 内联复制漂移隐患）。
  - **状态机（自查补刀两处）**：同词微动不打扰已排定时器；换词立即切换气泡；离开 150ms 宽限内回归不闪、超时只收 hover 气泡；移进气泡保持。**①Esc/滚动视为主动关闭**——记下所在词（hoverDismissed），鼠标不离词不重开，否则 Esc 关不掉原地复活；**②✕ 关闭的残留态**——mousedown 落在气泡上不触发 cancelHover，hoverShownFor 残留会导致移回词上不重开，sameHit 分支改为校验来源非 hover 即重排。
  - **清理**：R20 的自绘悬浮卡（#magiclens-hover-host/ensureHoverUi/hoverCache 等）整体移除（含 page-extract.js 与 content.js selectionInfo 的对应排除项还原）；ml:translate 直连链路复用不变（金山直连百毫秒级）。
- **校验**：七个 JS 全过 `node --check`；manifest 0.7.1-202610071045（测试版，不触发发布）。
- **待用户验收**：①悬浮生词 ~200ms 弹完整气泡且自动出译文；②气泡上 译/详/认识/生词/AI/✕ 全部可用；③Esc 关闭后鼠标不动不复活，移开再悬停可重开；④链接里的生词悬浮出气泡、页面不跳转；⑤划选文本的气泡不被悬浮干扰。
- **总结**：
  - requests.md：占号 R21。
  - response.md：本条。
  - 冲突记录：无。
  - 未决事项：随 v0.6.x+R14 高亮批次一并提交（R19/R20 已说明的提交顺序约束）；验收通过后统一发正式版。

### R22（发布 release v0.7.1 + Chrome 商店上架材料）

- **回应**：按 R18 流程完成发布——
  - develop 提交发布批次（commit `12eacc6`，15 文件：R14 高亮 + R20/R21 悬浮 + R15-R19 并行批次 + 台账），manifest 清理时间戳为纯 `0.7.1`；push develop；
  - merge develop → release 分支推送，`release.yml` 触发成功（run 37567109100，12s）；
  - **Release 已上线**：tag `v0.7.1`，附件 `magiclens-extension-v0.7.1.zip`，https://github.com/haoshenqi-family/magiclens/releases/tag/v0.7.1 。
  - **商店上架材料**（见 `docs/webstore/listing.md`，可直接复制粘贴）：`PRIVACY.md` 隐私政策入库（商店必填 URL：github.com/haoshenqi-family/magiclens/blob/develop/PRIVACY.md）；单一用途声明、`storage`/`<all_urls>` 权限理由、数据披露口径、截图与宣传图规格清单、unlisted 先行 + 演示视频建议。上架操作本身需用户 Google 账号（$5 一次性注册费）在 Developer Dashboard 手动完成，AI 无法代办。
- **总结**：
  - requests.md：占号 R22。
  - response.md：本条。
  - 冲突记录：无。
  - 未决事项：商店账号注册与上传需用户手动操作；后续商店版本号需大于 0.7.1。

