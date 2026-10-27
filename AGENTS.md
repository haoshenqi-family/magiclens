# 🤖 AGENT INSTRUCTIONS — magiclens（AI 必读）

> 🟢 **加载确认**：读取本文件后，请首行回复：`✅ AGENTS.md 已激活 | 语言：中文 | 模式：严格遵循工作流`
> 📌 **必读声明**：本文件是 AI Agent 在 magiclens 仓库工作的**最高优先级约束**，任何任务（包括改一行 typo）前必须完整读取。家族根目录 [`Agents.md`](../Agents.md) 的「强制规则」表已将 `magiclens` 指向本文件，两者冲突时以本文件为准。

---

## 0. 系统说明（AI 必读）

### 0.1 项目定位

**MagicLens 词镜**：Chrome MV3 扩展，把 magicbook 的阅读能力（划词/段落翻译、生词智能高亮、认识/生词标记、词汇表、TTS、伴读聊天）带到任意网页。**纯前端项目，无自建后端**——所有能力直连 [moon-well](../moon-well) 既有 API，moon-well 后端零改动。

- 可行性评估与决策记录：magicbook 仓库 `response.md` R118/R119 + 本仓库 [`docs/product/design.md`](docs/product/design.md)（新功能设计前必读）。
- 用户文档：[`README.md`](./README.md)（功能表、安装、API 契约速查）。

### 0.2 架构与硬性约定

- **API 契约以 moon-well 代码为唯一权威**（`ReadingVocabularyController` / `VocabularyController` / `ReadingSettingsController` / tts 模块），统一 `Result{success, result, message}` 包装；改接口先改 moon-well 并走其 AGENTS.md 流程。
- **所有 moon-well 请求必须经 background service worker 中转**：MV3 中 content script 的 fetch 遵循页面源 CORS，且 http 页面有混合内容限制；SW 持有 `host_permissions` 豁免。
- **UI 一律挂 closed Shadow DOM**，禁止向页面注入全局样式或污染 `window`（仅保留 `__magicLensLoaded` 防重入门）。
- **Token 只存 `chrome.storage.sync`**（浏览器本地）；任何真实 token、密钥、上游凭据禁止入库。
- **后端默认走公网域名 `https://moon-well.haoshenqi.top`**（Server 2 Traefik → fnOS:8082，含 X-User-* 信任头剥离中间件，配置源 `app-manager/deploy/traefik-dynamic/moonwell.yml`）；用户经 Authentik 统一登录（与 magicbook 同一账号），令牌由 `/auth/oidc/callback` 页自动捕获、`/auth/refreshToken` 静默续期——**设置页不提供手动地址/Token 配置项**；记忆始终开启（不携带 skipMemoryExtract）。
- 无构建链，`extension/` 目录即最终产物：改完在 `chrome://extensions` 重新加载即可验证；**版本号两段式规则 `X.Y.Z` / `X.Y.Z-YYYYMMDDHHmm`：每次修改完成后必须递增**——
    - **测试版（默认）**：修改完成即递增——`version` 按语义化版本 +1（Chrome manifest 的 `version` 只接受点分整数，时间戳不能写进该字段），`version_name` 写完整 `X.Y.Z-YYYYMMDDHHmm`（取修改完成时刻的时间戳），popup 展示 `version_name`；**带时间戳后缀的版本不触发发布**。
    - **正式版**：**用户确认**某版本可发布后由 AI 执行发布流程——把 `version_name` 的时间戳后缀去掉（只留纯 `X.Y.Z`）推送到 `develop`，再 merge `develop` 到 `release` 分支并 push；**只有 `release` 分支的 push 触发** [.github/workflows/release.yml](./.github/workflows/release.yml) 自动打 `vX.Y.Z` tag、创建 GitHub Release 并附 `extension/` 打包 zip（Release 已存在或带时间戳后缀则跳过）。日常开发 push `develop` 不再触发发布；2026-10-21 R51 起**纯文档 push `release` 分支**同样跳过打包与发布。
- 选区文本上限 2000 字符（moon-well translate 接口约束）；生词标记仅英文单词（正则提取首个英文词）；`known`=标记已认识（移出学习队列）、`unknown`=加入生词本。
- 图标由 `scripts/gen_icons.py` 生成（纯标准库）并入库，改图标改脚本后重新生成，不手工编辑 PNG。

### 0.3 引用关系（何时必读谁）

| 引用对象 | 路径 | 何时必读 |
| --- | --- | --- |
| 家族全局规则与网络底账 | [`../Agents.md`](../Agents.md) | 任何任务前（其强制规则表指向本文件） |
| 上游阅读器（逻辑移植来源） | [`../magicbook/AGENTS.md`](../magicbook/AGENTS.md) | 涉及 magicbook 目录或移植其前端逻辑（如 epub.js） |
| 后端 API 所有方 | [`../moon-well/AGENTS.md`](../moon-well/AGENTS.md) | 涉及 moon-well 契约、代码或其部署 |
| API 权威源码 | `../moon-well/src/main/java/top/haoshenqi/magicbook/`（controller/、vocabulary/、tts/） | 改 API 契约、排查接口行为时 |
| 本仓库架构决策 | [`docs/product/design.md`](docs/product/design.md) | 新功能设计与编码前 |
| 本仓库用户文档 | [`README.md`](./README.md) | 功能/安装说明变更时 |

---

## 🔄 核心工作流 (Core Workflow)
接到用户任务时，**必须严格按以下顺序执行**，禁止跳过或合并步骤：

1. **任务分类**：判断当前任务属于下方 `## 📋 任务分类与执行策略` 中的哪一类。
2. **状态同步**：向用户回复 `🔍 正在执行 [任务类型] 类任务`。
3. **前置阅读**：除非任务明确与项目无关，否则**必须优先阅读**本文档 `## 0. 系统说明`、根 `README.md`（L1）与 [`docs/product/design.md`](docs/product/design.md)（L2 ADR）；涉及上游项目时先读其 `AGENTS.md`（见 §0.3）。
4. **执行对应流程**：严格按分类指南逐步操作，并在关键节点输出确认信息。

---

## 🔀 Git Worktree 使用规范（2026-10-10 R38 增补；2026-10-23 ops R158 修订命名并增补同编号互斥；家族统一口径见 ../AGENTS.md「Git Worktree 开发纪律」）

> **模式：一任务一临时 worktree，合并后保留待验收，验收通过后删除**。正面先例：R36 发布 merge 全程在临时 worktree（/tmp/ml-release）完成，没有在并行会话共用的工作目录切分支。

- **何时必须用**：编码类任务（改 `extension/`、`manifest.json` 等）开工时创建专属 worktree 开发，**不得在可能被并行会话共用的主检出上直接改分支**；纯问答、排查、文档微改可在主检出直接进行。本仓无构建链，worktree 即装即用，成本几乎为零。
- **一次会话一个 worktree（2026-10-12 moon-well R164 同源增补；家族统一口径第 7 条）**：同一会话内的连续工作（含多阶段/多子任务）必须**复用同一个 worktree**——阶段收尾 merge 回开发分支后不删树，续作前 `git fetch` 并 merge `origin/<开发分支>` 拉齐基线继续推进；**禁止每阶段/每子任务各开新树**（反面样本：moon-well R162 重构五阶段 + NAS 下线累积 6 处驻留）。跨会话续作优先复用台账登记的该任务 worktree；仅并行会话允许并存多树。
- **创建**（位置必须在仓库目录外的兄弟目录，命名 **`magiclens-r<编号>-<slug>`**，目录名与分支名的编号一致——2026-10-23 ops R158 修订，原 `<任务slug>` 不带编号、同一任务可被起成两个名字，无法作互斥判据；先 `git fetch origin`，从 `origin/develop` 最新点切出）：
  ```bash
  git worktree add ../magiclens-r<编号>-<slug> -b <type>/r<编号>-<slug> origin/develop
  ```
- **同编号互斥（2026-10-23 ops R158；家族统一口径第 9 条）**：一个 request 编号同时只允许存在一个 worktree——目录名带编号后由文件系统天然强制，同编号目录已存在时 `git worktree add` 直接失败，此时**禁止换 slug 绕开**：是验收期驻留 → 按上条在原 worktree 续作；是另一并行会话在途 → 协调而非并行开工；是登记外残留 → 向用户报告，不擅删。互斥粒度钉在编号（功能）级，不升到模块级。
- **收尾闸门（merge 后不立即删除，等验收）**：
  ```bash
  git merge <type>/r<编号>-<slug>        # 在主检出 develop 上执行
  ```
  merge 完成后 worktree **原样保留**，等用户验收；验收通过后执行删除：
  ```bash
  git worktree remove ../magiclens-r<编号>-<slug>
  git branch -d <type>/r<编号>-<slug>    # 只用 -d：未合并会被 git 拒绝，此时停下排查
  ```
  **禁止 `branch -D`**（会吞掉未合并提交，属破坏性操作，必须先经用户确认）；worktree 内有未提交残留导致 remove 被拒时，先向用户出示 diff 再处置，不得静默丢弃。
- **验收期驻留（正常状态）**：merge 后未验收的 worktree 属正常驻留，须在当轮 response.md 登记分支名与合并 commit，验收通过后立即删除；用户明确否决的改动，处置方式（revert merge / 保留分支）由用户定夺。本仓验收方式：`chrome://extensions` 从该 worktree 目录「加载已解压的扩展程序」实测；验收发现新问题时在原 worktree 内继续修（manifest 版本按 §0.2 再次递增），修完重新 merge 后再等验收。
- **长任务例外**：跨多会话、未到 merge 点的任务同样驻留 worktree，须登记分支名、日期与原因；任务关闭时按闸门收尾。
- **收尾失败留台账**：任务中止、冲突未解等无法完成闸门时，必须在 response.md 记录 worktree 位置、分支名与原因，禁止静默滞留。
- **发布流程不变**：正式发布仍按 §0.2 两段式规则，merge `develop` → `release` 并 push；发布类 merge 操作本身也建议在临时 worktree 内完成（R36 先例），避免在共用目录切分支。

---

## 📋 任务分类与执行策略

### 📦 1. 需求理解 & 系统设计
- **目标路径**：`docs/project/iterations/<ITER>/<工作项>/hls/`（PRD/HLS 标准化后放入）；本次实现设计落同目录 `lld.md`（LLD）
- **执行要求**：
	- 需求文档**逐句解析**，严禁跳过任何背景、目标或限制条件。
	- 遇到不确定的概念/术语，**立即查阅资料或向用户提问**，禁止主观猜测或假装理解。
	- 涉及 moon-well 能力时，先到 §0.3 的 API 权威源码核对真实契约，再输出系统设计草案供用户确认。

### 💻 2. 编码实现
- **必读文档**：本文档 §0.2 硬性约定 + [`docs/product/design.md`](docs/product/design.md)
- **目标路径**：LLD `docs/project/iterations/<ITER>/<工作项>/lld.md`
- **执行要求**：
	- **单线程开发**：每次仅处理 1 个 User Story，完成并验证后再进入下一个。
	- **注释规范**：先写注释阐明 `Why`（业务意图/约束条件），再写 `How`（实现逻辑）。
	- **交付标准**：代码完成后，扩展须可在 `chrome://extensions` 重新加载并正常工作（控制台无新增报错），`manifest.json` 已按 §0.2 版本号规则递增为测试版（`version` 语义化 +1，`version_name` 更新为 `X.Y.Z-YYYYMMDDHHmm`，不触发发布）。
		- **两级验证闸门（2026-10-08 R30 修订，与家族三仓口径对齐）**：本项目无自动化测试框架，闸门落在 §3 的手工清单上——**开发态（默认）**只实测本次改动涉及的 AC 条目；**正式发布态**（用户显式提出「发布 / 上线」，即 §0.2 去掉时间戳后缀并 merge `release` 的那一步）必须把 §3 手工清单**逐条走全**并全过。
	- **Code Review**：完成后主动切换模型/Agent 视角进行交叉审查，确认无误后再提交。

### 🔍 3. 验收 (AC 对齐)
- **目标路径**：`docs/project/iterations/<ITER>/<工作项>/ac/<USER_STORY>-ac.md`（若存在）
- **执行要求**：
    - 本项目无自动化测试框架，验收 = **手工清单**逐条实测：加载扩展 → 划词 → 翻译展示 → 认识/生词标记 → 朗读 → 设置页保存与测试连接（涉及哪条验哪条）。
    - 所有验证点必须全部验证，不可以跳过。条件不足（如无 moon-well 内网环境）则请求用户提供更多信息。
    - 重点关注**请求经 background 中转、Result 包装解析、Shadow DOM 隔离**这三条硬性约定是否被破坏。
    - 验收完成后，输出详细验证报告（含每条 AC 结果与截图/console 佐证），最后回复 `✅ 所有 AC 已覆盖验证`。
    - **发布正式版**：验收通过且**用户确认**可发布后，把 `manifest.json` 的 `version_name` 时间戳后缀去掉（`X.Y.Z-YYYYMMDDHHmm` → 纯 `X.Y.Z`）推送 `develop`，再由 AI merge `develop` 到 `release` 分支并 push——`release` 分支变动即由 `release.yml` 自动创建 GitHub Release（见 §0.2 两段式规则）。

### 🛠 4. bug修复
- **执行要求**：
  - 阐述 bug 产生的原因、修复方案和验证方法，确保修复后不影响其他功能。
  - 验证通过后同步更新对应 AC / 设计文档 / 本文件 KB。

### 🛠 5. 细节修改 & 知识沉淀
- **执行要求**：按需查阅对应迭代工作项目录（`docs/project/iterations/<ITER>/<工作项>/`）与产品侧文档（L1/L2/L3）。修改完成后，同步更新相关文档或决策记录。

### 🌐 6. 项目无关任务
- **适用范围**：简单问答、百科查询、工具配置等。
- **执行策略**：直接高效响应，无需加载项目文档或触发工作流。

---

## 📁 项目文档规范 (Docs Structure · v2 静态 product / 动态 project 二分 · 单模块退化形态)

> 权威约定见家族仓 [`../ops/docs-architecture.md`](../ops/docs-architecture.md)（v2 二分体系与 §2 退化形态；本仓为**单模块纯前端扩展**，按退化形态落地）。本节只定本仓落位；与家族册冲突时，先改家族册、再同步本节。

文档按 **静态（product：产品现在长什么样）/ 动态（project：这次、最近改了什么）** 二分。**L1–L3 仅指产品侧静态文档**；原 L2/L3 里的 HLD/**LLD 已拆出去**——「功能 / 接口是什么」留在产品侧，「**这一次怎么实现**」= LLD，归 project 迭代。

**退化形态**：本仓单模块，**不建 `docs/product/readme/`、不为目录对称把单模块硬拆**——L1 就是根 `README.md`，模块层省略：

| 级别 | 位置 | 读者 | 内容 | 维护时机 |
| --- | --- | --- | --- | --- |
| **L1 用户文档** | `README.md`（仓库根） | 使用者 | 功能状态表、安装说明、API 契约速查：**只讲功能与安装**，不涉及实现 | 对用户可见的能力变化（随版本） |
| **L2 接口说明（ADR 兼任）** | `docs/product/design.md` | 集成者 / 后续维护者 | 架构决策记录：分期规划、鉴权与契约依据、风险评估、发布策略（本仓无自建后端，对外契约即 moon-well 的 L2） | 架构 / 契约 / 发布策略变化 |
| **L3 实现说明** | `docs/product/features/<FEATURE>.md` | 修改者 | User Story 级实现方式 + 边界条件（含 AC 手工清单）（尚未新建；历史实现说明在 `docs/project/_legacy/feat/`） | 每次功能开发 |

**工作项目录标准结构（project · 动态）**：

| 路径 | 用途与操作规则 |
| --- | --- |
| `docs/project/iterations/<ITER>/plan.md` | 本次迭代计划（对应 PingCode 迭代 / 版本） |
| `docs/project/iterations/<ITER>/<工作项>/lld.md` | **LLD：这次怎么实现**（头部必须有 `状态` 行：设计 / 开发中 / 已上线） |
| `docs/project/iterations/<ITER>/<工作项>/{hls/,ac/,raw/}` | 需求标准化稿 / 验收标准与手工清单 / 原始素材 |

**其他目录**：

| 路径 | 用途与操作规则 |
| --- | --- |
| `docs/product/` | ▶ **静态 · 产品**文档根（本仓退化：只放 `design.md` 与 `features/`） |
| `docs/product/webstore/` | Chrome 商店上架材料（R23 起搁置保留备用；上架前先读其内置勘误） |
| `docs/project/` | ▶ **动态 · 项目 / 迭代**文档根 |
| `docs/project/requests/` | 需求台账：`requests.md` / `response.md` + `requests-archive/` / `response-archive/`（2026-10-16 R50 由仓库根迁入） |
| `docs/project/_legacy/feat/` | **冻结归档**：老 `docs/feat/`（4 个）整体搬入，不回溯迭代归属，正文只读不改 |
| `README.md` | L1：只讲功能与安装，不涉及实现 |

**三级联动纪律（v2 重述：R30 原始，2026-10-16 R50 改口径）**：功能交付前四问——① 用户可见能力变了吗 → 改 `README.md` 功能表并按 §0.2 递增版本；② 架构 / 契约 / 发布策略变了吗 → 改 L2 `docs/product/design.md`（追加决策记录）；③ 实现方式 / 边界条件变了吗 → 改 L3 `docs/product/features/<FEATURE>.md`；④ **这次怎么实现** → LLD 落 `docs/project/iterations/<ITER>/<工作项>/lld.md`，头部必须有 `状态` 行并随里程碑回填（先例：R26 发现 US3/US4 状态滞留两版未回填）。
**数值同源**：token 时效、超时、上限等数值一律以 moon-well 现行契约为准，禁止沿用旧快照（先例：R26 发现 7d/30d 旧口径曾在三处文档滞留）。
**历史文档只标注不重写**：过时章节在其后追加「更新（日期）」注记指向现行口径，正文保留原貌；被取代的设计文档加「已被取代」横幅；`docs/project/_legacy/feat/` 内的历史文档一律**只读不改**。
**一致性纪律**：功能清单以 `extension/` 实际文件与 `manifest.json` 为准；README 功能状态表 ↔ 老 `feat` 归档目录 ↔ `manifest.json` version 三者保持对齐，发现漂移随手修正。

---

## 🚫 不纳入 Git 的内容

以下属于敏感信息或产物，**禁止**提交（`.gitignore` 已覆盖，新增同类文件必须保持忽略）：

| 类别 | 示例 | 原因 |
|------|------|------|
| 密钥凭据 | 真实 token（`mk-…`/JWT）、`config.json` 类上游凭据、`.env` | 敏感信息，只存浏览器 `chrome.storage.sync` 或本机 |
| 打包产物 | `*.zip` | 由 `extension/` 目录直接加载或按需打包 |
| 系统噪音 | `.DS_Store`、`*.log` | 运行/系统文件 |

> 图标 PNG 由 `scripts/gen_icons.py` 生成但**必须入库**（保证仓库克隆即可加载），改图标走脚本重生成。

---

## 📝 对话记录 (docs/project/requests/ · requests.md / response.md)

- **位置（2026-10-16 R50）**：需求台账已从仓库根迁入 `docs/project/requests/`（`requests.md` / `response.md` + `requests-archive/` / `response-archive/`）；本节下文凡称 `requests.md` / `response.md` / 归档目录，均指该目录下对应文件。
- **`requests.md`**：仅记录每一次对话用户的需求，除此之外不做任何事情。**接到任务立即占号（占号即 push，2026-10-23 ops R158/R159）**：跑 **`../ops/tools/claim.sh magiclens --title "需求标题"`**，stdout 末行 `CLAIMED <N> <sha>` 即占到（`--quiet` 只输出编号，`--dry-run` 只看下一号）。脚本对 `origin` 最新台账算全史最大 +1、只含台账文件 commit 并 push 到 develop，**push 成功才算占到号**，被拒自动重算；全程不动主检出，本地 develop 领先远端 / 工作区脏都不影响、不会带出待点头提交。脚本不可用时的手动兜底序列与原理见 `../ops/dev-workflow.md` §1 步骤 4。（原「写入即锁定」口径废止：并行会话各自工作区的写入互不可见直到 push，moon-well 152/154 两次撞号即此。）
- **`response.md`**：任务**完成后**再写入回应（编号对应 requests.md 开始时占用的条目），包括：
  - 对每个 request 的回应；
  - 对 requests.md 与 response.md 两个文件的总结。
- **编号纪律**：编号只追加、不回改、不重排；并行会话若仍出现重复编号，不修改既有记录，续编下一个空号，并在 response.md 冲突记录中说明。
- **冲突记录**：若 request 之间存在冲突，必须在 response.md 中记录。
- **归档**：`response.md` 只保留最近 10 个 request 的回应。**任何写入使条目数超过 10，立即把最早超出窗口的回应原样搬移**到 `response-archive/response-R<起>-R<止>.md`（如 `response-R11-R20.md`；孤立单条可命名 `response-R16.md`），并在 `response.md` 顶部归档索引登记；只搬移原文，不总结、不改写。（2026-10-08 修订：原「逢 10 的整数倍触发」在 R110/R120 等触发点多次被跳过致窗口失控，改为写入即检查。）**requests 归档（2026-10-08 新增，R33）**：`requests.md` 中已确认完成且过时的条目按编号区间原样搬移到 `requests-archive/requests-R<起>-R<止>.md`（孤立单条 `requests-R<N>.md`），只搬移原文、不总结、不改写、不改编号；未完成的与有经验教训价值的条目保留；`requests.md` 顶部维护归档索引。归档不释放编号——新任务仍取全史最大编号 +1。（原「requests.md 永不归档」条款同日废止。）
- **查历史**：需要更早的回应细节时，按 request 编号到 `response-archive/` 对应文件检索，不要把全量历史读进上下文。
- **原则**：尽量简单。

---

## 1. 内网设备（192.168.31.0/24）

> **拓扑与设备事实的唯一权威源：ops 仓库 `servers` 分册 与 app-manager `docs/kb/truth/server.md`**（2026-10-08 R29 指针化，收敛六处副本为两处权威源）。
> 常用速查：飞牛 NAS（fnOS，**moon-well :8082 在此**）`192.168.31.9` · Ubuntu 开发机 `192.168.31.11`（外网代理 naive `:12811`）· 公网统一入口 Server 2 `116.62.200.90`（Traefik :443）。


---

## 🌐 语言与术语规范
- **默认语言**：中文
- **术语保留**：技术栈/工具名保持原文，**禁止翻译**（如 `Chrome MV3`、`service worker`、`Shadow DOM`、`CORS`、`Bearer` 等）

---

## 📖 扩展阅读
- 家族全局视图与强制规则：[`../Agents.md`](../Agents.md)
- 上游项目：[`../magicbook/AGENTS.md`](../magicbook/AGENTS.md)、[`../moon-well/AGENTS.md`](../moon-well/AGENTS.md)
- 本项目：[`docs/product/design.md`](docs/product/design.md)（架构与决策）、[`README.md`](./README.md)（功能与安装）
