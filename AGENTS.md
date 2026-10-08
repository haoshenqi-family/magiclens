# 🤖 AGENT INSTRUCTIONS — magiclens（AI 必读）

> 🟢 **加载确认**：读取本文件后，请首行回复：`✅ AGENTS.md 已激活 | 语言：中文 | 模式：严格遵循工作流`
> 📌 **必读声明**：本文件是 AI Agent 在 magiclens 仓库工作的**最高优先级约束**，任何任务（包括改一行 typo）前必须完整读取。家族根目录 [`Agents.md`](../Agents.md) 的「强制规则」表已将 `magiclens` 指向本文件，两者冲突时以本文件为准。

---

## 0. 系统说明（AI 必读）

### 0.1 项目定位

**MagicLens 词镜**：Chrome MV3 扩展，把 magicbook 的阅读能力（划词/段落翻译、生词智能高亮、认识/生词标记、词汇表、TTS、伴读聊天）带到任意网页。**纯前端项目，无自建后端**——所有能力直连 [moon-well](../moon-well) 既有 API，moon-well 后端零改动。

- 可行性评估与决策记录：magicbook 仓库 `response.md` R118/R119 + 本仓库 [`docs/design.md`](./docs/design.md)（新功能设计前必读）。
- 用户文档：[`README.md`](./README.md)（功能表、安装、API 契约速查）。

### 0.2 架构与硬性约定

- **API 契约以 moon-well 代码为唯一权威**（`ReadingVocabularyController` / `VocabularyController` / `ReadingSettingsController` / tts 模块），统一 `Result{success, result, message}` 包装；改接口先改 moon-well 并走其 AGENTS.md 流程。
- **所有 moon-well 请求必须经 background service worker 中转**：MV3 中 content script 的 fetch 遵循页面源 CORS，且 http 页面有混合内容限制；SW 持有 `host_permissions` 豁免。
- **UI 一律挂 closed Shadow DOM**，禁止向页面注入全局样式或污染 `window`（仅保留 `__magicLensLoaded` 防重入门）。
- **Token 只存 `chrome.storage.sync`**（浏览器本地）；任何真实 token、密钥、上游凭据禁止入库。
- **后端默认走公网域名 `https://moon-well.haoshenqi.top`**（Server 2 Traefik → fnOS:8082，含 X-User-* 信任头剥离中间件，配置源 `app-manager/deploy/traefik-dynamic/moonwell.yml`）；用户经 Authentik 统一登录（与 magicbook 同一账号），令牌由 `/auth/oidc/callback` 页自动捕获、`/auth/refreshToken` 静默续期——**设置页不提供手动地址/Token 配置项**；记忆始终开启（不携带 skipMemoryExtract）。
- 无构建链，`extension/` 目录即最终产物：改完在 `chrome://extensions` 重新加载即可验证；**版本号两段式规则 `X.Y.Z` / `X.Y.Z-YYYYMMDDHHmm`：每次修改完成后必须递增**——
    - **测试版（默认）**：修改完成即递增——`version` 按语义化版本 +1（Chrome manifest 的 `version` 只接受点分整数，时间戳不能写进该字段），`version_name` 写完整 `X.Y.Z-YYYYMMDDHHmm`（取修改完成时刻的时间戳），popup 展示 `version_name`；**带时间戳后缀的版本不触发发布**。
    - **正式版**：**用户确认**某版本可发布后由 AI 执行发布流程——把 `version_name` 的时间戳后缀去掉（只留纯 `X.Y.Z`）推送到 `develop`，再 merge `develop` 到 `release` 分支并 push；**只有 `release` 分支的 push 触发** [.github/workflows/release.yml](./.github/workflows/release.yml) 自动打 `vX.Y.Z` tag、创建 GitHub Release 并附 `extension/` 打包 zip（Release 已存在或带时间戳后缀则跳过）。日常开发 push `develop` 不再触发发布。
- 选区文本上限 2000 字符（moon-well translate 接口约束）；生词标记仅英文单词（正则提取首个英文词）；`known`=标记已认识（移出学习队列）、`unknown`=加入生词本。
- 图标由 `scripts/gen_icons.py` 生成（纯标准库）并入库，改图标改脚本后重新生成，不手工编辑 PNG。

### 0.3 引用关系（何时必读谁）

| 引用对象 | 路径 | 何时必读 |
| --- | --- | --- |
| 家族全局规则与网络底账 | [`../Agents.md`](../Agents.md) | 任何任务前（其强制规则表指向本文件） |
| 上游阅读器（逻辑移植来源） | [`../magicbook/AGENTS.md`](../magicbook/AGENTS.md) | 涉及 magicbook 目录或移植其前端逻辑（如 epub.js） |
| 后端 API 所有方 | [`../moon-well/AGENTS.md`](../moon-well/AGENTS.md) | 涉及 moon-well 契约、代码或其部署 |
| API 权威源码 | `../moon-well/src/main/java/top/haoshenqi/magicbook/`（controller/、vocabulary/、tts/） | 改 API 契约、排查接口行为时 |
| 本仓库架构决策 | [`docs/design.md`](./docs/design.md) | 新功能设计与编码前 |
| 本仓库用户文档 | [`README.md`](./README.md) | 功能/安装说明变更时 |

---

## 🔄 核心工作流 (Core Workflow)
接到用户任务时，**必须严格按以下顺序执行**，禁止跳过或合并步骤：

1. **任务分类**：判断当前任务属于下方 `## 📋 任务分类与执行策略` 中的哪一类。
2. **状态同步**：向用户回复 `🔍 正在执行 [任务类型] 类任务`。
3. **前置阅读**：除非任务明确与项目无关，否则**必须优先阅读**本文档 `## 0. 系统说明` 与 [`docs/design.md`](./docs/design.md)；涉及上游项目时先读其 `AGENTS.md`（见 §0.3）。
4. **执行对应流程**：严格按分类指南逐步操作，并在关键节点输出确认信息。

---

## 📋 任务分类与执行策略

### 📦 1. 需求理解 & 系统设计
- **目标路径**：`docs/feat/<FEATURE>/design/`（PRD/HLS 标准化后放入）
- **执行要求**：
	- 需求文档**逐句解析**，严禁跳过任何背景、目标或限制条件。
	- 遇到不确定的概念/术语，**立即查阅资料或向用户提问**，禁止主观猜测或假装理解。
	- 涉及 moon-well 能力时，先到 §0.3 的 API 权威源码核对真实契约，再输出系统设计草案供用户确认。

### 💻 2. 编码实现
- **必读文档**：本文档 §0.2 硬性约定 + [`docs/design.md`](./docs/design.md)
- **目标路径**：`docs/feat/<FEATURE>/design/<USER_STORY>.md`
- **执行要求**：
	- **单线程开发**：每次仅处理 1 个 User Story，完成并验证后再进入下一个。
	- **注释规范**：先写注释阐明 `Why`（业务意图/约束条件），再写 `How`（实现逻辑）。
	- **交付标准**：代码完成后，扩展须可在 `chrome://extensions` 重新加载并正常工作（控制台无新增报错），`manifest.json` 已按 §0.2 版本号规则递增为测试版（`version` 语义化 +1，`version_name` 更新为 `X.Y.Z-YYYYMMDDHHmm`，不触发发布）。
		- **两级验证闸门（2026-10-08 R30 修订，与家族三仓口径对齐）**：本项目无自动化测试框架，闸门落在 §3 的手工清单上——**开发态（默认）**只实测本次改动涉及的 AC 条目；**正式发布态**（用户显式提出「发布 / 上线」，即 §0.2 去掉时间戳后缀并 merge `release` 的那一步）必须把 §3 手工清单**逐条走全**并全过。
	- **Code Review**：完成后主动切换模型/Agent 视角进行交叉审查，确认无误后再提交。

### 🔍 3. 验收 (AC 对齐)
- **目标路径**：`docs/feat/<FEATURE>/ac/<USER_STORY>-ac.md`（若存在）
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
- **执行要求**：按需查阅 `docs/feat/<FEATURE>/` 及 [`docs/design.md`](./docs/design.md)。修改完成后，同步更新相关文档或决策记录。

### 🌐 6. 项目无关任务
- **适用范围**：简单问答、百科查询、工具配置等。
- **执行策略**：直接高效响应，无需加载项目文档或触发工作流。

---

## 📁 项目文档规范 (Docs Structure · 三级体系)

文档分三级，写哪级取决于「给谁看」，新增/变更功能时**三级联动维护**。本项目为单模块纯前端扩展，L2 由全局 ADR 兼任，不另建 hld 目录：

| 级别 | 位置 | 读者 | 内容 | 维护时机 |
| --- | --- | --- | --- | --- |
| **L1 用户文档** | `README.md` | 使用者 | 功能状态表、安装说明、API 契约速查：**只讲功能与安装**，不涉及实现 | 对用户可见的能力变化（随版本） |
| **L2 设计概要（ADR 兼任）** | `docs/design.md` | 集成者/后续维护者 | 架构决策记录：分期规划、鉴权与契约依据、风险评估、发布策略 | 架构 / 契约 / 发布策略变化 |
| **L3 详细设计（LLD）** | `docs/feat/<FEATURE>/` | 开发/维护者 | User Story 级设计、AC 手工清单、原始素材 | 每次功能开发 |

| 路径 | 用途与操作规则 |
| --- | --- |
| `docs/feat/<FEATURE>/design/` | L3 LLD 设计文档（User Story 级） |
| `docs/feat/<FEATURE>/ac/` | 验收标准与手工测试清单 |
| `docs/feat/<FEATURE>/raw/` | 原始资料文件（非文档类素材） |
| `docs/webstore/` | Chrome 商店上架材料（R23 起搁置保留备用；上架前先读其内置勘误） |
| `docs/design.md` | L2 ADR：分期规划、风险评估、契约依据 |
| `README.md` | L1：只讲功能与安装，不涉及实现 |
| `requests.md` / `response.md` / `response-archive/` / `requests-archive/` | 对话记录（纪律见下节） |

**三级联动纪律**：功能交付前三问——用户可见能力变了吗 → 改 README 功能表并按 §0.2 递增版本；架构/契约/发布策略变了吗 → 在 `docs/design.md` 追加决策记录；LLD/AC 状态还停在「待实施 / 待 moon-well」吗 → 回填实际交付状态（先例：R26 发现 US3/US4 状态滞留两版未回填）。
**数值同源**：token 时效、超时、上限等数值一律以 moon-well 现行契约为准，禁止沿用旧快照（先例：R26 发现 7d/30d 旧口径曾在三处文档滞留）。
**历史文档只标注不重写**：过时章节在其后追加「更新（日期）」注记指向现行口径，正文保留原貌；被取代的设计文档加「已被取代」横幅。
**一致性纪律**：功能清单以 `extension/` 实际文件与 `manifest.json` 为准；README 功能状态表 ↔ `docs/feat/` ↔ `manifest.json` version 三者保持对齐，发现漂移随手修正。

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

## 📝 对话记录 (requests.md / response.md)

- **`requests.md`**：仅记录每一次对话用户的需求，除此之外不做任何事情。**接到任务立即追加编号占位**：读文件取当前最大编号 +1，随即写入需求原文；编号在任务开始即锁定，避免并行会话争用同一编号。
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
- 本项目：[`docs/design.md`](./docs/design.md)（架构与决策）、[`README.md`](./README.md)（功能与安装）
