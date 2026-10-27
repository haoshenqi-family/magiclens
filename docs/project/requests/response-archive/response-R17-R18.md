# response-R17-R18.md — 归档（2026-10-08 R28 实施收口时自 response.md 原样搬移，补 R20/R30 触发点欠账）

## R17 回应：设置页说明「单词等级等详细设置在 magicbook 管理」并提供跳转

- **改动**（`extension/options.html`，「与 magicbook 的关系」与「自动翻译」开关之间新增「更多设置」块（用户反馈后由初稿「单词等级等详细设置」改名），纯静态 HTML，options.js 零改动）：
  - 说明文案：MagicLens 本页只保留最常用的开关；**单词难度等级、词汇量测试（含难度推荐）**等详细设置统一在 magicbook「阅读设置」页管理，两者共用同一份数据。
  - 跳转链接：`https://magicbook.haoyuhang.top/reading/settings`（新标签打开，`rel="noopener"`）；路由实存核对过（magicbook `cps/web.py:307` `@web.route("/reading/settings")`，登录后可访问），页面内容即词汇难度档位 + 词汇量测试（R125 推荐档位）。
  - 生效口径如实说明：判定矩阵在 moon-well `/vocabulary/reading/analyze` 每次扫描时服务端计算，插件不缓存等级——文案写「在 magicbook 改完难度档位，新开或刷新网页，生词高亮与划词判定即按新等级生效」。
  - CSS 新增 `a.link` 样式（沿用主题紫色 #4f46e5）。
- **文档同步**：README 功能表「设置页」行补跳转说明（v0.6.1）；manifest 测试版 `0.6.1`，version_name 随文案微调更新为 `0.6.1-202610070858`（不触发发布）。
- **验证**：静态交叉审查（链接/文案/结构/JSON 合法性）通过；纯 HTML 无新增脚本，重载扩展即可验收：打开设置页看新块与链接跳转、magicbook 侧改档位后刷新网页核对高亮按新档判定。
- **总结**：requests.md 占号 R17；未提交 git（工作区仍有 v0.6.0 在途未提交改动，避免混入）；待用户真机验收。

## R18 回应：发布规则改为 release 分支触发（develop 不再发布）

- **规则定案**：日常开发在 `develop`（测试版节奏不变）；**用户确认**某版本可发布 → AI 把 `version_name` 时间戳清理为纯 `X.Y.Z` 推送 `develop` → merge `develop` 到 `release` 分支并 push → `release` 分支的 push 触发发布。
- **改动**：
  - `.github/workflows/release.yml`：`on.push.branches` 由 `[develop]` 改为 `[release]`，头部注释同步改写；「version_name 纯 X.Y.Z 才发布 / 测试后缀跳过 / Release 已存在跳过」三道闸门原样保留。
  - `release` 分支已自 develop HEAD（432eef1）建立并推 origin——本地与远端均存在，未夹带任何工作区未提交改动。建分支的这次 push 会让 workflow 跑一次，但该提交 version_name=0.4.1 且 Release 已存在，按闸门跳过，不产生重复发布。
  - 文档同步：AGENTS.md §0.2 两段式规则与 §3 验收「发布正式版」步骤改为 release 流程；docs/design.md §6 登记 R18 决策；README 安装说明同步。
- **用户操作约定**：以后只需说「vX.Y.Z 可以发布了」，AI 执行上述发布流程（清时间戳 → push develop → merge → push release → 核对 Release 产物）。
- **验证**：本地 `git branch -a` 确认 release 存在（本地+origin）；workflow 语法为纯 YAML 字段替换（branches 数组），无需额外校验；首次触发路径已有 v0.4.1 闸门保护。
- **总结**：requests.md 占号 R18；扩展端 `extension/` 零改动，manifest 版本不动（延续 R16 先例）；规则已同步 AGENTS.md / design.md / README / 记忆库。
