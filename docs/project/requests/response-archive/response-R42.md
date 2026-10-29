### R42（bug 修复：详解面板滚动时丢失 ✕）

- **根因**：`.detail` 面板自身是滚动容器（`max-height: min(70vh, 560px)` + `overflow-y: auto`），词名与 ✕ 位于滚动内容之内的 `.d-head`，滚到底时头部整体移出可视区；面板关闭路径只有 ✕ 与 Esc，于是「看到最后没法关」。
- **修复**：`.d-head` 改 `position: sticky; top: 0` 吸顶，白底铺满整行内宽。**两个坑都靠实测纠出**：① sticky 的吸顶边界是「滚动容器 padding 内缩后的区域」，第一版用 `margin-top: -12px` 把头部顶进面板那 12px 上内边距被约束回弹（头部仍停在 133px），那 12px 反成头部上方一条漏字的缝——改为把 `.detail` 的 `padding-top` 移交 `.d-head`（面板 `padding: 0 14px 12px`）；② 交叉审查指出头部的 8px 下内边距若再用 `margin-bottom: -8px` 收回（本想换取未滚动时逐像素不变），带 z-index 的白底板会压住下一行——变体说明行只有 2px 上边距，`elementFromPoint` 在变体行 top+2 处返回的是头部（gap −6px），故最终不收回负 margin，下方各行下移 8px 换零遮挡。
- **验证**（本仓无自动化框架）：用**真实影子模板 + 真实 reader.css** 搭同源复刻页，headless Chrome 154 跑三态对照（控制组 develop 未修版 / 初版 `-8px` / 最终版）——① 滚到底时 ✕ 的 `elementFromPoint` 判定 `clickable=true` 且 `X.top` 与未滚动时相同（控制组 false，✕ 落在 −1389px）；② 未滚动时 `head.bottom` 与变体行 `top` 的 gap：控制组 +2、初版 −6（被盖）、最终 +2；③ 盒模型量（词目/✕ 的 top 两态相等）与截图确认头部常驻、内容干净穿过、圆角未被白底方角破坏。真机验收仍待用户在 `chrome://extensions` 加载本 worktree 目录实测。
- **版本**：0.8.8 → **0.8.9-202610122121**（测试版，带时间戳不触发发布）。
- **文档**：`docs/feat/word-detail/design/lld.md` 交互细节补吸顶一条（两个坑都记）。
- **交付**：用户批准「merge + push（等于上线）」后，主检出（工作区干净、develop==origin/develop ec9ae45）`git merge --ff-only fix/r42-sticky-detail-head`，push `ec9ae45..0499029`；带时间戳后缀不触发商店发布，正式发布仍走 §0.2 两段式待用户确认。**worktree 驻留待验收**：`chrome://extensions` 重载 `../magiclens-sticky-detail-head` 后划词→「详」→滚到底应仍见词目与 ✕。
- **同源**：magicbook R165 用同一修法改其 `.reading-word-detail` / `.wd-head`，两仓详解面板保持同构。
- **总结**：requests.md 占号 R42；本条为回应；冲突记录：无。窗口 R32–R42 共 10 个 request，未超限不搬移。
