# response-archive · response-R47（2026-10-27 R55 写入触发轮转搬移，原文如下）

### R47（架构评审波 3 · L2 阶段一：OIDC 回调迁独立 content_script）

- **交付（commit `906e232`，分支 `refactor/r46-rpc-facade` 同分支第二 commit，已 merge 本地 develop；版本 0.8.13-202610151643 测试版）**：新增 `oidc-callback.js`（matches 仅 moon-well.haoshenqi.top）——回调捕获不再依赖全站注入的 content.js；content.js 734→688 行（回调段迁出），回调页不再跑完整划词引擎启动门控，其余页面卸下永不生效的死逻辑。
- **L2 阶段二（登记）**：bubble.js / detail-panel.js / tts.js 三模块拆分（共享 shadow 状态需重构为 window 命名空间互调）与 magicbook epub.js 拆分（B4）同批——同属前端巨石拆分，模式统一后一次做。
- **验证**：node --check 全过；真机验收点：moon-well 登录回调仍能自动捕获 token 写 storage + 三秒关页（独立脚本在新条目下首次真机验证）；划词/高亮/伴读回归。
- **台账**：worktree `../magiclens-arch-l1` 同树第二 commit（r46→r47），merge 后驻留待验收。未 push；正式发布待用户确认后去时间戳 merge release（会同时带上 R46+R47 两批）。
- **总结**：requests.md 占号 R47；冲突记录：无。
