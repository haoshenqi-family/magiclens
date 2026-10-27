# response-archive · response-R46（2026-10-27 R53 写入触发轮转搬移，原文如下）

### R46（架构评审波 1+2 · L1+L4+L5+L6：rpc 门面 / 令牌刷新单点 / 默认值单点 / 失败可见）

- **交付（commit `2b7be68`，分支 `refactor/r46-rpc-facade`，已 merge 本地 develop；版本 0.8.12-202610151621 测试版）**：
  - **L1**：新增 `rpc.js`——send 统一传输与失效分类（同步抛/lastError 两路同一分类器）、onInvalidated 退役钩子（content=retireOrphan、highlight=teardown）、MSG 表 16 键（全仓 type 字面量清零）；三份薄包装保留各自契约（content {ok,error} / highlight 吞错返 null / chat Promise+失效文案）；manifest 两处 content_scripts 组与 background（importScripts）都载 rpc.js，globalThis 挂载兼容 SW 与页面；
  - **L4**：`refreshOrClear` 单点——callApi 401 与 ml:auth 的超时/清凭据分支合一（R35 口径从注释对齐变代码单点）；
  - **L5**：`__magicLensDefaults` 冻结表入 common.js（globalThis 挂载），五处内联默认与 DEFAULT_CFG 全部引用单点，新增设置键只改一处；
  - **L6**：highlight analyze 失败不再纯静默（console.warn + storage.local 上报 + popup 常驻失败原因行，高亮页本身仍不打扰阅读）；chat memory save/delete 补失败提示。
- **验证（诚实）**：node --check 10 文件全过；node 冒烟（SW/页面双环境挂载、DEFAULTS 取值、失效双钩子触发均过，**冒烟曾抓到 onInvalidated 未定义的真 bug**——node --check 只查语法不查引用，已补）；MSG 表-引用一致性脚本核验无缺失无冗余；真机手工清单待用户重载验收（划词/高亮/伴读全链路 + popup 失败行 + 记忆保存失败提示）。
- **X1 合围收官**：moon-well M4（包装兑底）+ magicbook B5（统一解包）+ magiclens L1（rpc 门面）三端齐——R44/R173 类事故链从「三端各自防御」变「两端机制 + 一端可见」，联合验收待三仓真机同步。
- **台账**：worktree `../magiclens-arch-l1`（分支 `refactor/r46-rpc-facade`，merge commit `2b7be68`）驻留待验收，验收通过后 remove + branch -d；验收发现新问题在原 worktree 修（manifest 按 §0.2 再递增）。未 push（push develop 不触发发布；正式发布需用户确认后去时间戳 merge release）。
- **总结**：requests.md 占号 R46；response.md 本条；冲突记录：无。
