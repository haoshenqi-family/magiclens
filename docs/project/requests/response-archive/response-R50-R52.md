# response-archive · R50–R52（docs v2 迁移 / 发布链纯文档跳过 / 伴读抽屉对齐 R232-R233）

> 2026-11-13 R62 写入触发轮转搬移（窗口 12→13 压回 10），原样搬移不改写。

## 2026-10-16（R50：docs v2 迁移——单模块退化形态）

### R50（用户指令「moon-well 和 magiclens 也整理 docs」：家族文档架构 v2 试点第三仓）

- **范围**：纯文档结构迁移（`git mv` + 链接 / 口径改写），**零代码行为改动**——`extension/` 只动了 `background.js` 一行 Javadoc 里的文档路径；manifest 版本未递增，不触发发布。
- **前置处置（用户拍板「先原样提交再迁移」）**：主检出在途未提交的台账与文档先原样落库（commit `888a84e`）——requests 补落 R45/R46/R47/R49 四条、response 补 R45/R46/R47 三条回应、design.md §15/§16、架构评审 overview 状态行、R34 归档。「原样」提交：R48 台账条目仍缺这一既存缺口也照原样保留（见 R49 条目自述）。
- **窗口轮转（本条写入触发）**：写入前 response.md 实含 12 个 request（并行会话插入 R45–R47 时未按纪律轮转，窗口已超限）；本条写入前先把最旧的 R35 / R36 / R38 三节原样搬至新建的 `response-archive/response-R35-R38.md` 并登记索引（与占号同 commit `786961b`），窗口回 10 个 request（R39–R44 / R45–R47 / R50）。
- **物理搬迁（`git mv`，内容不改写）**：本仓为**单模块纯前端扩展**，按 v2 **退化形态**落地——**L1 仍是根 `README.md`**（不建 `docs/product/readme/`，不为目录对称把单模块硬拆）；`docs/design.md`（L2 ADR 兼任）→`docs/product/design.md`；`docs/feat/`（5 个：arch-review-2026-10 / chrome-extension / domain-management / vocab-highlight / word-detail）→`docs/project/_legacy/feat/`（**冻结归档、不回溯**）；`docs/webstore/listing.md`→`docs/product/webstore/listing.md`（产品级静态）；仓库根 `requests.md` / `response.md` / `requests-archive/` / `response-archive/`→`docs/project/requests/`。
- **链接口径**：脚本改写 8 条（`./docs/design.md` → `docs/product/design.md`、`./feat/...` → `../project/_legacy/feat/...` 等）+ 手工修 5 条随迁移变深 / 变浅的根文件相对链（`docs/product/design.md` 与 `docs/product/webstore/listing.md` 指向 `PRIVACY.md`、`.github/workflows/release.yml`）。改后 `docs/product`、`README.md`、`AGENTS.md` 相对链接存在性校验 **0 坏链**。代码侧同步 1 处（`extension/background.js` Javadoc）。
- **文档改写**：`AGENTS.md` 文档规范节整体改 v2 **退化形态**（L1 = 根 `README.md` / L2 = `docs/product/design.md` ADR 兼任 / L3 = `docs/product/features/<FEATURE>.md`；工作项目录标准结构；其他目录表；「交付四问」），工作流目标路径、前置阅读（补 L1/L2 入口）与「对话记录」节路径同步。
- **占号与基线**：台账占号 **R50**（全史最大 49 + 1，49 为家族迁入 PingCode 条目）；worktree 从本地 `develop` 切出（与 `origin/develop` 同点，0/0）。
- **未做 / 待决**：① Wiki 镜像重刷与前两仓同批**暂缓**（用户拍板）；② `docs/product/features/`（L3）与 `docs/project/iterations/` 从新工作开始建；③ 本仓无 `docs/tasks/`，未新建 `docs/project/tasks/`。
- **验证**：目录树与 `git status` 复核；相对链接存在性脚本 0 坏链；`AGENTS.md` 三处路径口径自检；`extension/` 无行为改动（无需手工清单全跑）。
- **收尾**：merge 本地 `develop`；worktree `../magiclens-docs-v2` 与分支 `refactor/r50-docs-v2` **原样保留待验收**（本仓验收方式 = `chrome://extensions` 加载该目录实测；本轮零代码改动，验收以目录与文档口径复核为主）。push 一条另行待批。

### R51（发布链纯文档跳过打包发布）

- **范围**：用户指令「修改一下部署脚本，如果只有文档更新，则不触发部署」；四仓同源 + 「触发但跳过」两口径拍板。本仓无部署产物，对应的是 `release` 分支的**发布**流程。
- **改动**：`.github/workflows/release.yml` 新增 `changes` job（compare API 取本次 push 改动文件 + 文档口径正则），`release` job 加 `needs` / `if` 门禁；纯文档 push 到 `release` 时打包 zip 与 GitHub Release 创建整体跳过，step summary 留痕。
- **文档口径**：`docs/`、`doc/` 下任意文件、`*.md`、`LICENSE`、`.gitignore`、`.gitattributes`；判定失败 / 首次推送一律走原判定（安全侧）。
- **验证**：YAML 解析通过、`bash -n` 通过、桩响应端到端 5 例符合预期（纯文档 true，其余 false）。
- **驻留**：worktree `../magiclens-doc-skip-deploy`，分支 `chore/r51-doc-skip-deploy`，合并 commit `875166e`（本地 `develop`，未 push）。

### R52（伴读抽屉对齐 magicbook R232/R233：回复不显示 token 用量、站内链接新窗口可点）

- **背景**：用户指令「阅读近期 magicbook 的能力提升，同步到 magiclens」。盘点 magicbook 2026-10-26 批次：R232（伴读面板隐藏 token 用量）在本仓有**已登记遗留**（magicbook R232 LLD §5 点名 `chat.js` onFinal 的 `tokens x+y`，彼时「只记录、不夹带修改」）；R233（AI 回复站内链接可点、新窗口）同期上线；R234（悬浮球快捷动作 chat 钉首位）本仓无快捷动作 UI，**不适用**。
- **交付（worktree `../magiclens-r52-buddy-parity`，分支 `feat/r52-buddy-parity`，版本 0.8.15-202610271026 测试版）**：
  - `common.js`：新增 `__magicLensSiteOrigin` 常量（`https://magicbook.haoshenqi.top`）与 `__magicLensAssistantHtml()` 助手消息安全渲染器（纯函数，node 可直测）——安全口径逐条移植 magicbook `ai_chat.js` R233：先整段转义再受控还原、href 白名单归一化（拒控制字符/反斜杠/`//host`/外部 origin/userinfo/非 http(s)）、`target="_blank" rel="noopener noreferrer"`、围栏代码隔离、尾随标点出链。**三处刻意分叉**：① origin 用常量（content script 的 location 是宿主页）；② href 写绝对地址（相对路径会解析到宿主页 origin）；③ 裸路径 token 只吃 ASCII（上游字符类放行 CJK，`/credits，或者` 会被整段吞进 href；本仓顺带修掉、未回提上游）。
  - `chat.js`：`onFinal` 删 token 用量展示（`usage` 不再消费；`conversationId` 回填与非 COMPLETED 状态提示保留——R232 守卫口径「删用量不许顺手删分支」）；流式原文缓冲 `acc`，final 与历史渲染统一走渲染器（历史里书内会话的 `/book/N` 同样可点）；抽屉 CSS 补链接/代码样式。
  - moon-well 零改动：`final` 帧 `usage` 照旧下发，扩展只是不消费；用量唯一入口 = magicbook 设置·积分。
- **验证（诚实）**：`node --check` 两文件全过；渲染器 node 冒烟 23 例全过（链接/CJK 断词/标点出链/同源归一/query·fragment 保留/外链·`//host`·`javascript:`·userinfo·反斜杠·控制字符拒绝/HTML 转义/代码块隔离/粗体/换行/空串/注入 origin 隔离）；**真机手工清单待用户**：从本 worktree 重载扩展 → ① 回复气泡下不再出现 `tokens x+y`；② 让 AI 给本站链接（如「我的积分页在哪」），点击新窗口打开 magicbook 对应页；③ 历史会话里的旧回复同样可点链接、无 token 行；④ 代码块与外链仍为文本。
- **文档**：README 功能表回填；LLD `iterations/1.0/r52-buddy-parity/lld.md`；迭代 `plan.md` 增 MAGICLENS-6。
- **台账**：worktree `../magiclens-r52-buddy-parity`（分支 `feat/r52-buddy-parity`）merge 后驻留待验收，验收通过后 remove + branch -d；未 push（push develop 不触发发布；正式发布需用户确认后去时间戳 merge release）。窗口轮转：本条写入前已把最旧的 R39 原样搬至 `response-archive/response-R39.md` 并登记索引，写入后窗口 10 条未超限。
- **总结**：requests.md 占号 R52（claim.sh `e56575e`）；PingCode idea [ML-51 / 6Lljn2pb](https://haoshenqi.pingcode.com/ship/ideas/6Lljn2pb)（Pending → In progress，待验收后 Completed）；response.md 本条；冲突记录：无。

