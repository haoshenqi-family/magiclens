# requests.md — 对话需求记录

> 仅记录每一次对话用户的需求，除此之外不做任何事情。
> 2026-10-08 起引入归档：已确认完成且过时的条目按编号区间原样搬移至 `requests-archive/`；未完成与有经验教训价值的条目保留于此。编号永不回改、归档不释放编号，新任务按全史最大编号 +1 递增（当前最大 R40）。

## 归档索引

- R01–R27（28 条）→ `requests-archive/requests-R01-R27.md`
- R29–R31（3 条）→ `requests-archive/requests-R29-R31.md`

28. bug 排查：网页上的「Documentation」明明标记了认识，刷新页面后仍然被划线（系统仍认为不认识）。排查原因（疑似与 R16 installed 案例同构：派生词形的词族判定缺口）。

> 归档整理注（2026-10-08）：方案 A（标记入口小写归一 + 存量 435 行清洗）已实施并上线（moon-well R116，e30e13b）；方案 B（派生词族入词族判定口径，moon-well WordInflection 与扩展端 lemmaCandidates 双侧同步）未做；另遗留 fnOS DHCP 续租丢默认路由的持久化修复待用户处理。

32. 报错详情不应该暴露给用户，用户看不懂也不想了解。（截图：单词详解面板报「单词详解生成失败（LLM 超时或异常）: Magpie call failed: I/O error on POST request for "http://192.168.31.9:3425/v1/chat/completions": Read timed out」）

> 归档整理注（2026-10-08）：moon-well R124 权威层已上线（fba5ca4）；magiclens 防御层落在 v0.8.1 测试版（-202610081457），真机验收与正式发布（去时间戳 merge release）未完成。

## 2026-10-08

33. 整理 requests.md：已确认完成且过时的条目按编号区间原样归档到 `requests-archive/`（只搬移原文，不改写、不改编号）；未完成的与有经验教训价值的条目保留在 requests.md；编号永不回改、归档不释放编号，新任务继续按全史最大编号 +1 递增。同步修订 AGENTS.md 对话记录条款（原「requests.md 永不归档」废止为「按区间归档」）。（跨四仓同源任务：moon-well R125 / magicbook R134 / app-manager R37 / magiclens R33）

## 2026-10-10

34. 补 iframe 内的拖选划词：magicbook 阅读器正文在同源 iframe 里，R24 的多文档引擎只把生词高亮与「hover/点高亮词弹气泡」接进 iframe，选区链路（content.js 的 mouseup→processSelection）仍只在顶层文档，导致阅读器里选中单词无反应。magicbook 侧已按「只隐藏 magiclens 已实现的部分」下线内置气泡（其 R141/R143），这条缺口必须补上。

35. bug 排查：magiclens 的 AI 功能（伴读聊天）一直提示「未配置 token 或者未登录」，跳转登录也不行；但其他功能（划词/生词标记等）正常。该功能应与插件其他功能共用同一登录与 token。

36. iframe 选区能力解耦重构：R34 把 iframe 的 mouseup 绑在高亮引擎的 per-doc 装配里，而该装配受 shouldEngineRun()（高亮开关 + token）门控——关掉生词高亮或没登录时，阅读器里划词会一起失效。用户要求不为「顶层 content.js / iframe 中继」这种分工做妥协，因为未来 magicbook 的阅读能力可能整体移植进 magiclens，选区采集应做成与高亮无关、可复用的骨架。方案：新增 all_frames 注入的 selection-relay.js，任意子文档采集自己的选区并经 background 回投顶层画气泡。

37. 能力握手标记：由 magiclens 在页面上留「本条能力正在被接管」的显式标记，供 magicbook 逐项探测决定是否让位内置实现（分能力：本帧选区中继 / 顶层高亮引擎）。Why：magicbook 单侧无法检测扩展（不能枚举、未打包 ID 随路径变化），而「装了扩展」不等于「这条能力在此处通」——v0.8.5 之前 iframe 拖选就是装了也不通。

38. 为四个项目添加 worktree 使用说明（同源 moon-well R146）：接到开发任务时开一个 worktree 完成开发，完成后 merge 回 develop 再删除 worktree；或改为固定 worktree 池占用模式（每任务找未使用的 worktree，先 merge develop，完成后合回不删）。比较两种方式优劣并落地选定模式的规范。

39. 用户反馈两个真机问题：① 控制台 `Error://(:0)`；② 阅读器里划词选中单词后，「译」点几下就卡死。修：翻译在途守卫（连点不叠请求）、孤儿副本退役时摘掉 onMessage 监听、中继脚本对上下文失效做保护。

40. 金山直连查词补报四股台账（P3，随 moon-well R152 端点）：单词划词直连金山命中时 fire-and-forget 上报 /learning/strands/lookup（服务端同词同日幂等），补齐词汇股 LOOKUP_DAY 口径；miss 回退路径本就走 moon-well 无需处理。版本测试版递增 0.8.8。

41. 微调 worktree 规范（家族根 + 四仓 AGENTS.md 同源修订）：不要 merge 后立即删除 worktree，改为 merge 后保留 worktree 等用户验收，验收通过后再删除。（跨四仓同源任务：moon-well R153 / magicbook R155 / app-manager R39。编号说明：本条与并行会话的金山直连查词补报曾同占 40，其已先行推送；按「只追加、不回改」原则双方记录并存，本条按纪律续编 41）

## 2026-10-12

42. bug 修复：单词详解面板内容一长就需要滚动，滚动时头部（词名 + ✕）跟着移出可视区，看到最后没法方便地关闭面板。要求滚动时把一部分内容固定住。（同源 magicbook R165，两仓详解面板保持同构）

## 2026-10-13

43. 排查并补齐朗读引擎：用户反馈「朗读引擎选了 AI，最近又变成本地」，且「理论上还应该有个词典发音，默认应该是词典」。排查结论是 magiclens 划词气泡的 🔊 只有浏览器 `speechSynthesis`（moon-well TTS 属规划 P2 未实现），而阅读器划词让位（magicbook R146 + 本仓 v0.8.6 接管标记）后，magicbook 那份带有道 dictvoice 真人词库音频的气泡被换掉，单词发音退化成机械音。本条要求：给 magiclens 的朗读补词典发音分支，单个英文单词默认走 dictvoice，失败/短语句子回退浏览器语音。

44. 接 R43 排查的后续（同源 moon-well R173）：伴读抽屉的会话列表/记忆/学情看不到既有记录。定性为契约漂移——moon-well 的 `/ai/agent` 面板 8 个端点返回裸对象/数组，而本仓 `callApi` 按统一 Result 包装判定 `success === true`，成功响应被误判为失败；`chat.js` 的 `refreshConversations()` 又是 `if (!resp.ok) return;`，于是静默降级成「历史凭空消失」。要求两手：① 解包改为与 magicbook `unwrap()` 同口径的容错判定；② 失败必须在界面上可见，不允许静默空列表。

## 2026-10-15

45. 家族根架构评审任务拆分建档（跨四仓同源：moon-well R180 / magicbook R174 / magiclens R45 / app-manager R42）：阅读家族根 `../docs/architecture-review-2026-10-14.md`，把评审结论拆分为各仓待办并落入各仓文档，**仅写文档不做开发**。magiclens 侧落位 `docs/feat/arch-review-2026-10/design/`（overview 总表 / refactor-items L1–L7 + U1–U2 + X2 本仓部分 / doc-fixes DF1–DF4，含 N4 token 时效表体旧值与 K3 README 二义待决策等登记项），跨仓协同项 X1–X6 与家族根修正任务登记在家族根 `../docs/arch-review-2026-10-tasks-crossrepo.md`。design.md 追加 §15 决策记录指向该目录；不改任何 `extension/` 代码，manifest 版本不递增（无代码修改）。

46. 架构评审波 1+2——L1+L4+L5+L6：统一 RPC 门面 rpc.js（三份消息封装合一，X1 本仓部分收官）、令牌刷新/清凭据单点 refreshOrClear（callApi 401 与 ml:auth 同分支）、设置默认值单点 __magicLensDefaults（五处内联默认+DEFAULT_CFG 引用）、失败可见（highlight analyze 失败 console.warn + storage.local 上报 + popup 常驻失败行；chat memory save/delete 补失败提示）。版本 0.8.12-时间戳测试版递增，不触发发布；真机手工清单待验收。（编号说明：接 R45）

47. 架构评审波 3——L2 阶段一：OIDC 回调捕获迁独立 content_script oidc-callback.js（matches 仅 moon-well 域）——回调页不再跑完整划词引擎启动门控，其余页面卸下永不生效的死逻辑；bubble/detail-panel/tts 三模块拆分（阶段二）与 epub.js 拆分（B4）同批，登记下一轮。版本 0.8.13 测试版递增。（编号说明：接 R46）

49. 家族迁入 PingCode（跨仓同源：magicbook R184 / magiclens R49 / ops R131；用户指令：学习使用 PingCode，把项目搬上去）：①知识管理——本仓 `docs/` 与根 README 全量镜像至 PingCode DEV 空间（目录结构同源；顶级页与空间主页平级，主页是空间系统页、API 不能挂子页；仓库 docs/ 仍是权威源，wiki 只读镜像）；②产品管理——本仓全史 requests 48 条（R01–R47 含归档）建为 MAGICLENS 产品需求池条目，标题 R 编号开头、描述带原文与来源脚注，状态按已完成/未完成分类；③工作流——此后新需求先记本台账占号，再 `../ops/tools/pingcode.py idea-create magiclens "R<编号> 标题" --desc "详情"` 发布，agent 按看板领取建 worktree 开发并流转状态（手册 `../ops/pingcode.md` §10）。（编号说明：git 已有 r48 提交（background.js 金山直连域迁移）但其台账条目尚未落文件，按全史最大编号 +1 取 49；其 R48 条目落本文件时双方并存）
50. docs v2 迁移（家族文档架构 v2 试点第三仓；蓝本 `../ops/docs-architecture.md` §2 退化形态/§5/§7；用户指令「moon-well 和 magiclens 也整理 docs」）：本仓为**单模块纯前端扩展**，按 v2 **退化形态**落地——**L1 仍是根 `README.md`**（不建 `docs/product/readme/`，不为目录对称把单模块硬拆）；`docs/design.md`（L2 ADR 兼任）→`docs/product/design.md`；`docs/feat/`（4 个）→`docs/project/_legacy/feat/`（**冻结归档、不回溯迭代归属**）；`docs/webstore/listing.md`→`docs/product/webstore/listing.md`（产品级静态）；仓库根 `requests.md`/`response.md` + `requests-archive/`/`response-archive/`→`docs/project/requests/`。同步改写本仓 `AGENTS.md` 文档规范节为 v2 退化形态，并更新家族根 `Agents.md` 四仓落位映射。（编号说明：全史最大 49，按「全史最大 +1」取 50；跨仓：magicbook R188 / moon-well R190 已完成）

51. 发布链加「纯文档提交不发布」判据（跨仓同源：app-manager R51 / magicbook R192 / moon-well R194）：`.github/workflows/release.yml` 增 `changes` 判定 job——compare API 取本次 push 改动文件，全部是文档时 `docs_only=true`，打包与 GitHub Release 步骤整体跳过；混合改动、判定失败走原版本判定。本仓无部署产物，此处对应的是「发布」而非「部署」。worktree 开发，push 闸门留用户。

52. **伴读抽屉对齐 magicbook R232/R233——AI 回复不显示 token 用量、站内链接新窗口可点**（占号 2026-10-27，待回填）

53. **伴读抽屉语音双向（对齐 magicbook R227）：麦克风转写输入 + 回复朗读**（占号 2026-10-27，待回填）

54. **常驻入口悬浮球：设置开关 + 首次安装引导选择**（占号 2026-10-27，待回填）

55. **缺陷：R48 金山直连模块化回归（icibaLookupWithStemming 未导出）**（占号 2026-10-27，待回填）

56. **缺陷：magicbook 站内悬浮球与 MagicLens 悬浮球重复显示**（占号 2026-10-27，待回填）
