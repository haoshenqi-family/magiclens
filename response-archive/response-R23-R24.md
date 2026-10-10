# response-archive — R23–R24

> 2026-10-10 R35 完成时按窗口纪律自 response.md 原样搬移（只搬原文，不总结、不改写）。
### R23（分发渠道决策：仅 GitHub Releases，搁置 Chrome Web Store）

- **回应**：已记录决策并同步文档——
  - `docs/design.md` §6 新增「分发渠道（R23）」：仅 GitHub Releases 分发（避免 $5 注册费、`<all_urls>` 深度审核与每次更新的审核维护），并写明固有限制（更新需手动下载 zip 重载，无自动更新通道）；
  - `docs/webstore/listing.md` 顶部标注搁置状态，材料（listing 文案/权限理由/截图规格）与 `PRIVACY.md` 原样保留，未来上架直接可用；
  - README 安装节补充分发说明。
  - 现有发布流程（R18 两段式：develop → release 分支 → 自动 Release + zip）不变，就是当前唯一且完整的分发通道。
- **总结**：
  - requests.md：占号 R23。
  - response.md：本条。
  - 冲突记录：无。
  - 未决事项：无。

### R24（magicbook 阅读页生词高亮无效：iframe 多文档支持 + 门控采样）

- **诊断**（证据链）：用户报 `/read/102/epub`（新概念英语85第三册）第 1/4 课高亮无效。
  ①解包 epub（fnOS magicbook 容器直读 Calibre metadata.db + zip）：60 课 toc.ncx/toc.xhtml 链接与
  `text/index.html` 内 60 个 `toc_N` 锚点全部可达且无重复——**书完好，排除目录死链**；
  ②ES 日志证实扩展已生效（11:26 对 login.tailscale.com 的 analyze 200 返回生词），但
  `bookName=magicbook.haoyuhang.top` 的 analyze **从未出现**；③读 `read.html` 与 epub.js：
  正文渲染在 epub.js 的同源 iframe 里，且页面 `<html>` 无 lang、meta description 为空、
  标题含中文书名 → 旧引擎（只扫顶层文档）+ 旧英文门控（title/meta/lang）双杀：扫描既不触发、
  触发了也看不见正文。「1 无效 4 无效」即第 1 课/第 4 课无高亮。
- **修复**（manifest `0.7.2-202610071324` 测试版，不触发发布）：
  - **highlight.js 多文档引擎**（lld.md §6）：`docStates: Map<Document, state>`——顶层与同源
    iframe（两层内）各持独立 Highlight 注册表（`new win.Highlight()`/`win.CSS.highlights`）、
    独立 constructable stylesheet、per-window IntersectionObserver、per-doc 交互监听
    （mousemove/click/mousedown/Esc/scroll/mouseleave）与 MutationObserver（汇入同一
    masterMutHandler）；Range 全部 `text.ownerDocument.createRange()`；悬浮/点词矩形经
    `tokRect()` 叠加 iframe 位置换算。
  - **首扫触发链**：文档绑定早于首扫（boot 即 syncDocs 预绑定）——epub.js 向 iframe 写正文时
    per-doc 观察者直接触发 scheduleSync→maybeScan，不再依赖顶层 mutation（审查 P0-1：
    初版 structureMo 只看顶层文档，iframe 内写入顶层不可见，晚渲染场景首扫仍漏）；iframe
    load 事件重绑换 document 的场景（审查 P1-3）。
  - **状态机**：`scannedKeys`（成功过，SPA 回来不重扫、靠 unknownSet 存量重亮）/
    `failedKeys`（gate 判否或请求失败，自动不再尝试、增量降级 familiar，popup 重扫 force 解除，
    teardown 清空）/`retriedKeys`（过短一次性 2s 重试）。首扫未成的 key 不发 familiar
    （防「同一本书两套口径」），被拒 key 例外直走 familiar（审查 P1-1：初版 popstate 清
    scannedOnce 会让中文路由的 familiar 增量永久空转，改为按 key 记账）。
  - **门控**：顶层信号 ∨ 整体采样 ∨ 逐文档正文采样（审查 P2-2：长中文壳占满采样头时书内英文
    仍可过闸）。
  - **iframe 交互**：悬浮同顶层；点词零副作用唤起持久气泡（`__magicLensShowWordBubble(word,
    rect, 'selection')`，不真实选中）；点空白/Esc/滚动经 `__magicLensHideBubble` 收起（content.js
    顶层 mousedown 够不到 iframe，审查 P1-2）；teardown 补收 hover 气泡（P2-4）。
  - 其余审查修复：retire 无条件 teardown（P2-3）、fireShow 零尺寸矩形校验（P2-5）、per-doc
    mousedown 对齐顶层收气泡语义（P2-6）、collectDocs 深度注释与实现对齐（P2-7）、
    rescanNodes 对无状态文档节点清册防泄漏（P2-1）。
- **校验**：全部 JS 过 `node --check`；独立 agent 交叉审查（1×P0 + 3×P1 + 12×P2，P0/P1 全修，
  P2 择要）；文档同步（lld.md §6 / design.md P1 / README / 本文件）。
- **待用户验收**：①重载扩展 → 打开 `/read/102/epub` 任意一课（含第 1/4 课）→ 生词波浪线出现；
  ②悬浮/点高亮词出气泡且可标认识/生词（全页含变形即时灭/亮）；③Esc/滚动/点空白能关气泡；
  ④popup「重新扫描本页」可用；⑤普通网页（含中文页）行为不回归。
- **遗留（R25 候选）**：iframe 内长句划选翻译不可用（selection 属 iframe 文档，顶层
  mouseup/getSelection 够不到；本次只覆盖单词点击与悬浮）。
- **总结**：requests.md 占号 R24；response.md 本条；冲突记录：无（R15-R23 系并行会话所记）；
  改动仅在工作区未 commit。
