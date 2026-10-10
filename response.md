# response.md — 对话回应记录（仅保留最近 10 个 request 的回应）

> 归档索引：[response-R1-R10.md](response-archive/response-R1-R10.md) · [response-R11-R15.md](response-archive/response-R11-R15.md)（2026-10-07 R25 完成时补执行 R10/R20 漏掉的归档） · [response-R16.md](response-archive/response-R16.md)、[response-R17-R18.md](response-archive/response-R17-R18.md)（2026-10-08 R28 收口时搬移） · [response-R19.md](response-archive/response-R19.md)（2026-10-08 R29 完成时搬移） · [response-R20.md](response-archive/response-R20.md)（2026-10-08 R30 完成时搬移） · [response-R21-R22.md](response-archive/response-R21-R22.md)（2026-10-08 R32 完成时搬移） · [response-R23-R24.md](response-archive/response-R23-R24.md)（2026-10-10 R35 完成时搬移）

### R25（域名管理：在指定域名禁用 MagicLens）

- **回应**：功能落地（manifest `0.8.0-202610071945` 测试版，不触发发布），moon-well 零改动、不新增任何 permission。设计文档 `docs/feat/domain-management/design/lld.md`（US1 判定与门控 / US2 设置页名单 / US3 popup 本站开关），ADR 记于 `docs/design.md` §9。
  - **存储与语义**：`chrome.storage.sync` 新增 `disabledDomains: string[]`（与既有配置同库、随浏览器同步）；条目为归一化 hostname，匹配语义「该域 + 全部子域」，不做精确/仅子域两种模式（域名禁用的直觉语义就是整站别管，项目原则「尽量简单」）；端口不参与匹配（禁 localhost 即禁所有端口）。
  - **`common.js`（新增）**：`__magicLensNormDomain`（借道 URL 归一化：剥协议/端口/路径/尾点/`*.` 前缀，非法输入返 null）与 `__magicLensIsDisabledHost`（含子域匹配）；manifest content_scripts 头位挂载 + options/popup `<script>` 直挂，四个消费方共享一份实现。node 冒烟 26 用例全过（含 `notexample.com` 不被 `example.com` 后缀误伤、IPv6/尾点/非法输入）。
  - **门控**：content.js 主引擎 IIFE 改为具名 `startMainEngine()`，由 storage 回调判定后启动（禁用站零 UI 零 DOM 监听零注入）；OIDC 登录回调捕获不受域名禁用影响（禁 moon-well 域不该废掉自己的登录回调）；highlight.js 启动时把判定固化进 `siteDisabled` 并入 `shouldEngineRun()`——Why 不只挡 boot：它有 storage.onChanged/Alt+U 等现成「重开路径」，禁用站会被后续全局开关变化复活；chat.js 零改动（唯一入口是划词气泡「问 AI」，content 禁用即天然禁用）。**生效语义统一「刷新页面后生效」**：名单只决定新加载页面，不做运行中拆装（低频配置动作，可逆化重构风险与收益不成比例）。
  - **UI**：设置页「域名管理」块（输入任意形态自动归一化、幂等添加、逐项移除、回车即添加、storage 为唯一事实源 + onChanged 渲染、全 textContent 组装）；popup 新增「本站启用」checkbox（非 http(s) 页隐藏；状态按 isDisabledHost 真实判定，恢复时移除所有覆盖本站的父域条目，否则勾上了仍被父域禁着自相矛盾）；「重新扫描本页」在本站禁用时报真实原因。
  - **交叉审查**（独立 agent）：1×P1 + 7×P2，无 P0。P1 = popup/options 的 `[hidden]` 被 author CSS 压过（`label{display:flex}` / `button{all:unset}` vs UA hidden 样式，content.js 曾修过同款陷阱）——两处补 `[hidden]{display:none!important}`（顺带修掉 options 登录按钮显隐的既有失效坑）。P2 择修：`ml:hl-toggle` 在禁用站 no-op（回 ok:true 防 background fallback 代翻全局开关、殃及其它站点）、`ml:hl-rescan` 禁用站回真实原因、popup hostname 过归一化剥尾点。余下 P2（storage 读改写无事务、startMainEngine 多暴露一个隔离世界全局等）记录在案不阻塞。
- **校验**：八个 JS 全过 `node --check`；manifest JSON 解析通过；助手函数 node 冒烟 26 用例全过。
- **待用户验收**（真机手工清单）：①设置页添加 `example.com` → 打开 example.com 及其子域页面：无划词、无高亮、popup 显示「本站启用」未勾选；②popup 取消勾选禁用当前站 → 刷新后插件静默；③重新勾选恢复 → 刷新后功能回来；④名单外的站点行为完全不回归；⑤Alt+U 在禁用站按下后，其它站点的生词高亮开关不受影响。
- **总结**：requests.md 占号 R25；response.md 本条；冲突记录：无（R24 遗留所提「R25 候选：iframe 内长句划选」未被本条占用实现，仍为待办，后续按实际需求续编号）；顺手补执行了 R10/R20 触发点漏掉的 response.md 归档（R1-R15 原样搬入 response-archive/，本文件恢复 10 条窗口）。改动未 commit。

### R26（跨项目 L1-L3 文档评审与产品评估，只改文档）

- **范围**：配合家族根 `docs/product-review-2026-10-07.md`，核查本仓库 README ↔ docs/feat ↔ manifest 三方对齐并修正漂移。**未触碰 extension/ 任何文件**（工作区里 v0.7.2/v0.8.0 在途改动与 response-archive/ 均系 R24/R25 并行会话产物，保持原样）。
- **修正清单（5 处）**：design.md §3 鉴权表加更新注（R118/R119 快照：现行 v0.3.0 起 OIDC 登录化、mk- key 弃用、token 30/90 天——R101）；chrome-extension lld US3/US4 状态回填（US3 v0.2.0 已交付、US4 moon-well R97 已上线）+ §6.3 鉴权表 7d/30d→30/90d 并标注 mk- 已弃用；vocab-highlight lld §3/§5「仅顶层 frame 不进 iframe」与 §6 R24 多文档自相矛盾→统一为「同源两层内 iframe 参与，跨源/更深层不进」；README 待办 P1 收窄（生词标注已随 v0.5.0 交付，剩段落整页翻译）；webstore/listing.md 加上架前勘误（现行 release.yml `zip -r … extension` 产出 zip 根层是 extension/ 目录，与商店「manifest 在根层」要求不符，上架需改打包方式并刷新版本锚点）。
- **遗留（代码类不动）**：`extension/background.js:5` 注释仍写 access 7d/refresh 30d，属代码注释按任务边界未改，建议下次改扩展时顺手更新。
- **总结**：requests.md 本条 R26；response.md 追加后仍在 10 条窗口（R25 已做过 R1-R15 归档）；冲突记录：无。

### R27（AGENTS.md 文档规范升级：三级体系落表）

- **改动**：AGENTS.md 文档规范节升级为三级表——L1 `README.md`、L2 `docs/design.md`（ADR 兼任 HLD，单模块纯前端不另建 hld 目录）、L3 `docs/feat/`；目录表补 `docs/webstore/` 行（原表遗漏）。新增纪律三条：交付三问（能力→README+版本递增 / 契约→design.md 追加决策 / LLD-AC 状态回填，附 R26 US3/US4 滞留先例）、数值同源（以 moon-well 现行契约为准，附 7d/30d 三处滞留先例）、历史文档只标注不重写。既有「一致性纪律」（README↔feat↔manifest 三方对齐）保留。
- **总结**：requests.md 本条 R27；response.md 追加本条后共 10 个条目，恰在窗口内（下次写入即触发归档）；冲突记录：无。

### R28（排查：Documentation 标记认识后刷新仍划线——只排查未修码）

- **回应**：标记本身已落库生效，问题出在**写读词形大小写不对称**：标记按页面原始词形存（`Documentation` 大写 D），扫描判定全按小写 token 比对，服务端把这条认识标记「看不见」，落到词档兜底后仍判生词。
- **证据链**：
  ①写链路：扩展划选/悬浮取**页面原文词形**（content.js:296 / highlight.js:659 传 `tok.raw`），background.js:330-337 原样拼 `GET /vocabulary/known/Documentation`，`VocabularyService.kill`（moon-well）**原样落库**——`vocabulary_notebook` user 1 存在 `word='Documentation'`（大写 D）familiarity=7 行（id 8826），今天 11:47 首标、22:48 重标均写的是它；
  ②读链路：analyze 服务端 `extractWords` 对整页重新分词并 `toLowerCase`（ReadingVocabularyService.java:289），token 全小写；`WordFamilyJudge.judgeOne:85` `notesByWord.get("documentation")` 大小写敏感 **miss 自身标记**；词族索引 `lemmaCandidates("Documentation")` 因 `^[a-z]+$` 守卫（WordInflection.java:31，扩展端 highlight.js:49 同款）对大写词退化为自身，与 token 候选 `{"documentation"}` **永不相交 → 词族桥接也 miss**；
  ③兜底：`magicbook_word_level` 中 `documentation`=TOEFL（level 6）> 用户 hard_level → 判 UNKNOWN 返回；
  ④ES 日志铁证：22:48:09 `GET /vocabulary/known/Documentation` 200 落库后，22:49:04 `/vocabulary/reading/analyze` 仍返回 `{"word":"documentation","unknown":true}`（当日 11:12/11:53/20:15/22:47 各次扫描全为 unknown:true）；
  ⑤无缓存层干扰（WordLevelCacheService 只缓存全局词档；扩展端 unknownSet 刷新即重建）；magicbook 端写链路自带小写归一（epub.js:445）故从未复现——扩展端独有此缺口。
- **根因**：R107 词族判定只对齐了「判定口径的词族化」，未对齐「写入口径的大小写」；扩展端标记请求与落库均不归一大小写，扫描侧全小写，两侧永不匹配。
- **次要缺口（同构隐患，本例非触发者）**：词族展开仅屈折（s/es/ed/ing/er/est），派生词形不在口径内——`document` 与 `documentation` 互不覆盖；即使修好大小写，标 `document` 也不会覆盖 `documentation`（属 R16 已文档化口径的边界，变更需 moon-well `WordInflection` 与扩展端 `lemmaCandidates` 双侧同步）。
- **修复方向（待用户确认后实施）**：A. 最小闭环——moon-well `VocabularyService.kill/unknown` 入口（或扩展端 background.js ml:mark 发出前）统一小写归一 + 存量脏数据清洗（`UPDATE vocabulary_notebook SET word=LOWER(word)`，含本例 id 8826）；B. 派生词形入词族口径（口径变更，双侧同步+单测）。
- **总结**：requests.md 占号 R28；response.md 本条，R16 原样搬入 response-archive/response-R16.md、R17/R18 搬入 response-R17-R18.md（窗口保持 10 条）；本次只排查，未改任何代码与数据。
- **实施回填（用户裁决「只修A」，2026-10-08）**：方案 A 已落地——①moon-well R116（commit e30e13b）：`VocabularyService` 新增 `normalizeMarkWord`（与 familiar 同口径小写归一），kill/unknown 入口调用，补 2 单测、全量 800 测试绿，push develop 走 fnOS 链部署；②存量清洗：fnOS `magichouse.vocabulary_notebook` 全表 435 行大小写混排 `UPDATE word=LOWER(word)` 归零（不止本例，含 code/mode/cache 等近期扩展标记与早期人名地名；flare/militant 历史重复行未动，判定端 toMap 已合并），清洗后现行判定即能匹配小写行，**无需等新版本上线 Documentation 已不再划线**。扩展端零改动、版本不变（延续 R16 先例）。方案 B（派生词族）未做。部署插曲：fnOS 凌晨 03:01 DHCP 续租丢失默认路由致 webhook git-fetch 失败（ai-fix 亦因智谱账户欠费未接起），已临时补路由并手动重跑构建；持久化修复（fnOS 静态网关/路由器 DHCP + ai-fix 充值）待用户处理。

### R29（执行文档统一方案：拓扑指针化 + 归档规则修订）

- **冲突记录**：本条原占 28，与并行会话 R28「Documentation 标记认识后仍划线」撞号（该单已由 moon-well R116 修复闭环），按编号纪律续编空号 29。
- **P1-B**：AGENTS.md「内网设备」表指针化——拓扑事实以 ops 仓库与 app-manager truth/server.md 为唯一权威源，本表收敛为一行速查（保留 fnOS=moon-well :8082、ubuntu naive :12811 两个本项目相关坐标）。
- **P2-D**：归档规则修订为「写入即检查、超 10 立即搬移」；本条回应使窗口超 10，按新规则当场把 R19 条目原样搬移至 response-archive/response-R19.md 并登记索引（新规则首次执行）。
- **总结**：requests.md 本条 R29（原占 28 撞号续编）；冲突记录见上。

### R30（单测逻辑改两级：开发态部分验证，正式发布才走全量清单）

- **AGENTS.md §2 编码实现·交付标准**：新增「两级验证闸门」子条——本项目无自动化测试框架，闸门落在 §3 手工验收清单上：**开发态（默认）**只实测本次改动涉及的 AC 条目；**正式发布态**（用户显式提出「发布 / 上线」，即 §0.2 去掉时间戳后缀并 merge `release` 那一步）必须把 §3 清单逐条走全并全过。
- **跨仓同步**：moon-well R119 / magicbook R131 / app-manager R36 把「全量单元测试」拆成开发态部分 + 发布态全量两级；本仓以手工清单对应同一口径。与既有 §0.2 两段式版本规则天然吻合（带时间戳后缀的测试版不触发发布）。
- **归档**：本条使窗口超 10（原 R20–R29 共 10 条），按「写入即检查、超 10 立即搬移」当场把 R20 条目原样搬移至 `response-archive/response-R20.md`（逐字节 diff 校验一致）并登记索引，窗口回到 10 个 request。
- **总结**：requests.md 本条 R30；response.md 追加本条并完成上述搬移；冲突记录：无（30 未被并行占用）。只改文档，未动扩展代码与 manifest 版本。

### R31（发布 magiclens）

- **回应**：按 R18 流程完成 v0.8.0 正式发布——
  - 发布批次 commit `522092d`（23 文件：R24 iframe 多文档 + R25 域名管理 + R26-R30 文档体系批次 + 台账与归档补账），`version_name` 清理时间戳为纯 `0.8.0`；push develop → merge release 分支推送；
  - `release.yml` 触发成功（run 37735576781，12s），**Release v0.8.0 已上线**：https://github.com/haoshenqi-family/magiclens/releases/tag/v0.8.0 ，附件 `magiclens-extension-v0.8.0.zip`；
  - zip 下载实测：manifest `0.8.0 / 0.8.0`（无时间戳），13 个文件齐全（含新增 common.js）。
- **总结**：requests.md 占号 R31；response.md 本条；冲突记录：无。

### R32（报错详情不应暴露给用户）

- **回应**：按「干净文案给用户 + 详情进日志」双层修复（magiclens v0.8.1-202610081457 测试版；moon-well 侧为其台账 R124，commit fba5ca4 **已部署上线**）。
  - **moon-well（权威层）**：单词详解（截图病灶，`WordDetailService` 反转 R106「cause 保留进消息」旧口径）、translate/translate-batch（此前**无任何兜底**，网关异常原文透传）、伴读 SSE（`AgentChatService` 透传 `e.getMsg()`；`AgentLoop` 兜底分支原先连日志都不记）全部统一；写作题目/批改、复述、口语、ASR 四条 learning 链路同口径修复。业务拒绝（积分不足）保持原文案；**LLM 客户端层消息（`Zhipu/Magpie call failed`）保留不改**——失败分类器按其文本分类、任务表持久化、排障都依赖。`WordDetailServiceTest` 断言反转为「禁止携带 cause 文本」。
  - **验证**：工作区被并行会话（LLM 任务管理功能）持续占用、mvn 跑不稳，改走 git worktree 干净验证——HEAD+我的补丁（即 fnOS 将构建的组合）三个单测类 83/83 全绿；`AgentChatServiceIntegrationTest` 10 Error 为 H2 DDL 既有环境问题（与本次无关）。部署后公网入口 502→401 确认新容器上线。
  - **提交纪律**：`learning/` 整目录系并行会话在途新功能（untracked），其中四条链路的修复**留在文件里随对方功能批次提交**，本次只精确提交 tracked 且无外来 hunk 的 6 文件（`ReadingVocabularyService` 用 `git apply --cached` 挑净我的 hunk，排除对方混入的 eventPublisher/LearningMarkEvent 在途改动——直接整文件 add 会因引用未提交的新包打爆 fnOS 构建）。
  - **magiclens（防御层）**：`common.js` 新增 `__magicLensUserFacingError(msg, fallback)`——疑似技术细节（URL/内部 IP/英文异常/网关标识）归一为通用文案并 console.warn 原文，干净业务文案（未登录/积分不足/选区过长）原样放行，401/403 重新登录流程不受影响；content.js（译/标记/详解）与 chat.js（SSE error/请求失败）接入。node 冒烟 7 场景通过（含截图原始报文）。
  - ADR 记于 `docs/design.md` §10。
- **待用户验收**：重载扩展（v0.8.1）后，随便找一个断网/超时场景（或等网关再超时一次）：详解面板/翻译气泡应显示「AI 生成超时或繁忙，请稍后重试」等干净文案 + 「点击重试」，不再出现内部地址与英文异常；伴读抽屉基础设施故障同理。完整效果依赖 moon-well 新版（已上线）。
- **总结**：requests.md 占号 R32；response.md 本条；冲突记录：无。response.md 归档窗口按新纪律执行（R21-R22 搬入 response-archive/）。

### R33（整理 requests.md：已完成条目按区间归档）

- **回应**：R01–R27（28 条）与 R29–R31（3 条）共 31 条确认完成，原样搬移至 `requests-archive/`（只搬原文、不改写、不改编号）；保留 R28（方案 A 已上线；方案 B 派生词族口径未做 + fnOS DHCP 丢路由持久化修复遗留）与 R32（v0.8.1 测试版在途，真机验收与正式发布未完成），各附归档整理注。编号纪律不变：归档不释放编号，新任务按全史最大编号 +1（32 → 本条 33）。AGENTS.md「requests.md 永不归档」条款同步废止为区间归档制，目录表补 `requests-archive/` 行。验证：原 33 条 = 归档 31 + 保留 2 + 新占号 1，计数守恒。
- **总结**：requests.md 占号 R33；response.md 本条；冲突记录：无。

### R35（bug 修复：伴读 AI 永远「未配置服务地址或 Token」，重新登录无效）

- **诊断**（证据链）：chat.js 自带 `getCfg()` 直读 `chrome.storage.sync` 且默认 `{ apiBase: '', token: '' }`；发送前守卫 `if (!cfg.apiBase || !cfg.token)` 一票否决。而 v0.3.0 起设置页已无地址/Token 手动配置项，`apiBase` 公网域名只作为 background.js `DEFAULT_CFG` 兜底存在——storage 里根本**没有 `apiBase` 这个键**（仅 v0.2 存量内网地址会被一次性迁移写入；全新安装永不写入），登录回调（content.js）也只写 `token/refreshToken`。于是：伴读面板永远命中 `!cfg.apiBase` → 报「未配置服务地址或 Token」；点「重新登录」走完 OIDC 只补了 token，`apiBase` 仍为空 → 报错不变，即用户所见「跳转登录也不行」。其他功能（翻译/标记/详解/高亮）全部经 background `callApi`（其 `getCfg` 有域名兜底）故不受影响，与「插件明明已登录」的直觉自洽。次要缺口：chat.js 要求 `token` 非空才放行，而 `callApi` 允许 token 空 + refreshToken 有效（401 时静默刷新），两侧口径不一致。
- **修复**（manifest `0.8.3-202610101524` 测试版，不触发发布）：
  - background.js 新增 `ml:auth` 消息：凭据只此一处出——返回 `{ apiBase, token }`；token 空而 refreshToken 有效时先经 `/auth/refreshToken` 静默刷新（超时不清凭据只报稍后重试、确定性失败清凭据引导重登，与 `callApi` 的 401 分支同语义）；未登录返回 `auth: true`。
  - chat.js 删除本地 `getCfg`，原 `api()` 的消息收发泛化为 `bg(msg)`（保留 R13 的 Invalidated 分类），JSON 面板端点与 SSE 前置凭据解析都走它；SSE 直连仍留在 content script 消费（LLD 决策 A1 不变），URL/Bearer 改用 `ml:auth` 返回值；错误分支的「重新登录」链接改按 `resp.auth` 判定（扩展重载类错误不再误挂登录链接）。
  - LLD 变更记录追加本条；apiBase/凭据出口收敛的约束写入 chat.js 与 background.js 注释。
- **验证**：`node --check` chat.js/background.js 通过；分支推演覆盖 未登录（auth 链接）/ token 空+refresh 有效（静默刷新后放行）/ 刷新超时（保凭据提示重试）/ 刷新被拒（清凭据+重登链接）/ 扩展重载（刷新页面提示，无登录链接）。真机清单（需用户 chrome://extensions 重载后实测）：① 退出登录 → 问 AI 提示「未登录，请先在设置页登录」+ 链接；② 点链接完成 OIDC 登录 → 回页直接发送 → SSE 流式回复正常；③ 会话列表/记忆/学情面板正常；④ 划词翻译等其他功能回归正常。
- **总结**：requests.md 占号 R35；response.md 本条；归档 R23–R24（窗口回到 10 条内）。冲突记录：与 R34（iframe 划词，另一会话在途）并行——manifest.json 版本竞态（R34 会话 15:23 写入 `0.8.2-202610101523`，本会话按「每次修改完成递增」续增为 `0.8.3-202610101524`）；本会话未触碰 content.js/highlight.js。

### R34（补 iframe 内拖选划词：阅读器里选中单词没反应）

- **用户报告**：magicbook 阅读器里「选中单词没有反应，但波浪线正常生成」，并问是否是后端接口改动导致。
- **结论：不是后端，是插件自身的覆盖缺口**。`manifest.json` 未声明 `all_frames` → content.js（气泡与划词流程）只在顶层文档运行；highlight.js 的 per-doc 监听只有 `mousemove/mousedown/click/keydown/scroll`，**没有 `mouseup`**；而 iframe 内的 mouseup 不跨文档冒泡、其选区也不属于顶层 `window.getSelection()`，于是 `mouseup → processSelection → selectionInfo` 一次都没触发。波浪线之所以正常，是因为高亮引擎本就按文档实例化（往每个同源 iframe 注入 `::highlight()` 样式表 + 各自的 IntersectionObserver）；hover 生词与点高亮词能弹气泡，是因为 R24 专门搭了 `__magicLensShowWordBubble` 这条跨文档钩子——**当年只搬了这两条交互，选区那条从来没接进来**。
- **该缺口原本有账**：`docs/feat/vocab-highlight/design/lld.md` §6.5 写着「iframe 内长句划选翻译不可用……阅读场景影响小」并列为 R25 候选，一直没闭。magicbook R141/R143 把口径定为「只隐藏 magiclens 已实现的部分」并下线内置气泡后，这个「影响小」的判断直接变成用户可感知的故障。
- **交付（commit `ba0eaa8`）**：highlight.js 给 **iframe 文档单独**加绑 `mouseup`（延迟 60ms 等选区稳定；顶层不绑——与 content.js 同绑会双开气泡、双发翻译请求，两个入口算出的矩形一个原生一个换算、未必逐字相等，500ms 去重兜不住），取选区文本 + Range 矩形按 `tokRect` 同款换算叠加 iframe 偏移，经新钩子 `__magicLensShowIframeSelection(text, rect)` 交顶层；content.js 把 `processSelection` 的呈现部分抽成共用 `openBubble(text, word, rect)`，词形前缀口径、2000 字符上限、`autoTranslate` 与译/详/🔊/认识/生词/问 AI 全部复用同一条链路，不复制第二套语义。文档同步：lld.md §6.4/§6.5、README 功能表、design.md §11。
- **验证状态（诚实）**：本项目无自动化测试；`node --check` 两文件通过、相邻同文行扫描无异常，但**扩展装载与真机效果未验**——需你在 `chrome://extensions` 重新加载插件并刷新阅读页（插件自带旧脚本退役保护，不刷新不生效），然后拖选书页里任意单词应出气泡、点空白/Esc 能收。AGENTS §3 手工清单的「划词→翻译展示」此前只在顶层文档验过，iframe 路径属新增覆盖面。
- **版本冲突记录**：manifest 的 `version/version_name` 不由我的 commit 携带——写码期间 R35 会话已把它推到 `0.8.3-202610101524`，其 `background.js`/`chat.js`/`docs/feat/chrome-extension/design/lld.md`/`requests.md#35` 仍是未提交在途改动，我不代为收编；我的代码已在工作区，随那个版本号一起被浏览器加载即可。
- **代提交记录**：本条下方的 response.md 窗口轮转（R23、R24 原样搬至 `response-archive/response-R23-R24.md`）系 R35 会话在 2026-10-10 做的，已逐字核对为原文搬移、未改写，随本条一起入库；另 R32 会话 2026-10-08 未提交的 v0.8.1「错误文案卫生」已由 commit `b74cea0` 单独收编并注明其自记验收状态。
- **总结**：requests.md 占号 R34（`a94de1c` 单独锁号；占号时确认 34 未占用，随后发现 35 已被并行会话占用，按不回改纪律保留）；response.md 本条，当前窗口 10 条、无需再搬。
