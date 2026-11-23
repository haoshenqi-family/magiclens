## 2026-11-11（R60 注册死链修复 + R61 邀请链接改后端动态获取）

### R60（用户：「检查magiclens 的注册链接是不是失效的那个」→「改」）

- **排查**：`background.js` 的 `ENROLLMENT_URL` 常量（v0.3.1 引入后从未更新）仍指 2026-10-30 过期且已从 Authentik 库删除的旧邀请 `5566492c`——10-23 邀请轮换（新邀请 `1572b336`、过期 2027-01-21、single_use=false）只同步了 magicbook `.env`，扩展侧所有已发布版本（商店 zip 手动装、无自动更新）注册按钮自 10-30 起全是死链。域名 `authentik.haoshenqi.top` 301→`account.haoshenqi.top` 保留 query，域名无罪。
- **修复**：常量换现役邀请 + 域名改 `account.haoshenqi.top` 免 301；manifest 0.8.23-202611111026 测试版（`447eebf` push develop，worktree `magiclens-r60-enroll-url-refresh`）。
- **教训沉淀**：邀请轮换是「magicbook .env + 扩展常量发版」双落点——此教训随即被 R61 从根上消除（见下）。
- **总结**：requests.md 占号 R60（`445febc`）；本条为回应；冲突记录：无。

### R61（用户：「邀请链接改为从后端获取，避免两端不一致。注意这个后端接口要开发白名单，不登录也可以获取」）

- **做了什么**：`ML_REGISTER` 从「硬编码常量」改为运行时获取 moon-well 匿名端点 `GET /auth/enrollment-invite`（对端 moon-well R250：Nacos `app.auth.enrollment-invite-url` 真值源，热重绑，轮换改后端一处即全端生效）；**删除 `ENROLLMENT_URL` 内置常量**——保留即残留漂移面，违背真值收敛初衷；失败不静默（options 结果区 `showResult` 明示原因）。Why 匿名直连不走 callApi：其「无 token 即拒」闸门与注册按钮场景（未登录态）冲突，也不透传本地令牌避免无谓 401/静默刷新链。
- **测试**：本项目无自动化测试框架——`node --check` 双文件语法过、旧 token 全仓零残留、manifest JSON 合法；集成套件侧语义用例落在 moon-well R250 的 `mw-get-auth-enrollment-invite`（dev 12/12 全绿），magiclens 矩阵 14 行无 ML_REGISTER 独立行（消息行为=开浏览器标签，非 API 契约，无需增行）。
- **验收（用户真机）**：`chrome://extensions` 加载 `magiclens-r60-enroll-url-refresh/extension/` → 设置页点「注册」→ 应打开邀请流程页进入表单；断网/后端不可达时应看到 `✗` 错误文案而非无反应。
- **部署**：`b43ad2f..f709a89` push `origin/develop`；0.8.24-202611111044 测试版（不触发发布）；正式版待用户验收后去时间戳 merge `release`。
- **运维口径**：邀请轮换从此=Nacos 键（热重绑）+ magicbook `.env`（登录页）两处同步——扩展侧零动作。
- **总结**：requests.md 占号 R61（`b43ad2f`）；本条为回应；冲突记录：无（与 R60 同树续作，一次会话一树）。
