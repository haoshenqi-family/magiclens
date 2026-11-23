# requests.md — 对话需求记录

> 仅记录每一次对话用户的需求，除此之外不做任何事情。
> 2026-10-08 起引入归档：已确认完成且过时的条目按编号区间原样搬移至 `requests-archive/`；未完成与有经验教训价值的条目保留于此。编号永不回改、归档不释放编号，新任务按全史最大编号 +1 递增（当前最大 R57）。

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

55. **缺陷：R48 金山直连模块化回归（icibaLookupWithStemming 未导出）**：用户在 `magiclens-r52-buddy-parity` worktree 重载扩展后，划词触发 `Uncaught (in promise) TypeError: icibaLookupWithStemming is not a function`（`background.js:249`）。R48 把金山直连域迁 `iciba.js` 时公开键为 `lookupWithStemming`，`background.js` 却按内部函数名解构；要求修复导出契约、补回归守卫并回填测试版。关联需求：R48 金山直连域迁 `iciba.js`（原台账缺条，保持原样不重写）。

56. **缺陷：magicbook 站内悬浮球与 MagicLens 悬浮球重复显示**：开启 MagicLens「常驻入口」后，magicbook 全站自带的 buddy 悬浮球与扩展悬浮球同时出现在同一位置。产品口径为宿主站内优先：magicbook 主域及子域保留原生入口，扩展球自动让位；其他网站继续显示扩展球。同时确认 MagicLens 悬浮球的 buddy 形象、hover 径向快捷气泡、拖拽吸附与位置记忆已对齐 magicbook R223，刻意差异仅在头像通道、动作集配置性、位置存储与网页场景动作语义。

57. **划词翻译仅单词直译，长选区/中文改为 AI 入框**：划词翻译遇到非单个单词或包含中文时，不要直接翻译；选中后提供 AI 按钮，点击后把选中的原文复制到 AI 伴读输入框中。

58. **重写 GitHub README：核心功能与入门用法**（2026-11-02 完成已 push）：根 README 重写为核心功能四组表格 + 五步上手，保留架构/API 契约/隐私/分发说明，回归 L1「只讲功能与安装」；纯文档版本不递增；随 r57 三个提交一起 push develop（282236f..8f9f0c2，不触发 Release）。R43 回应归档轮转。

59. **同步 magicbook 近期功能：悬浮球 SRS 滚动复习轮播（R285/R289 对齐）+ 回复朗读语速三档（R263 对齐）**（占号 2026-11-08；2026-11-08 开发完成已 merge 本地 develop 待验收）：A=球旁常驻 SRS 到期词轮播卡（/learning/srs/queue 20 词洗牌 8s、认识→/vocabulary/known 毕业）+ 详情分页（POST /vocabulary/detail/cached-batch 只读缓存零计费，每词≤4 页 line-clamp 3，无缓存/端点未发生产回退简卡，计费红线=绝不调逐词详解）；B=抽屉头部语速 1.0/0.75/0.5x 循环（preservesPitch 变速不变调，1.0x 原链路零回归）；R261 行内 gloss 用户拍板不做。0.8.22-202611082233 测试版；集成套件 +2 用例 guard 全绿、CfT 全量 14/14 pass；PingCode ML-55；worktree 驻留待验收。

60. **注册链接指向已过期邀请令牌（10-23 轮换未同步扩展常量），更新为新邀请并发测试版**（占号 2026-11-11，待回填）

61. **注册按钮改为从 moon-well /auth/enrollment-invite 动态获取邀请链接，删除内置常量**（占号 2026-11-11，待回填）

62. **发布正式版 v0.8.24：R59 悬浮球滚动复习/详情分页/语速三档 + R60 注册链接修复 + R61 邀请链接动态获取（去时间戳 merge release）**（占号 2026-11-13，待回填）

63. **缺陷：悬浮球滚动复习词卡显示 unknown message type（service worker 版本漂移，旧 SW 不识别 ml:review-queue）**（占号 2026-11-13，待回填）

64. **登录成功回调页不自动关闭：oidc-callback 引用不存在的裸全局 MSG 臺 ReferenceError**（占号 2026-11-14；2026-11-14 修复完成已 push origin/develop；同日用户令与 R63 合并 develop，合并结果顺延 0.8.26-202611141315）：R47（906e232）迁独立 content script 时把裸 `MSG` 引用带了过来，而 `MSG` 从非全局（rpc.js 只挂 `__magicLensRpc`，全仓口径 `const MSG = __magicLensRpc.MSG`）——ReferenceError 抛在 chrome.storage.sync.set 异步回调、外层 try/catch 接不住：横幅照常渲染，但 ML_LOGIN_OK 发不出、window.close 兜底定时器不注册、background tabs.remove 永不调度，登录成功页永久停留（潜伏期 2026-10-15 起，token 90 天有效登录罕见故未炸过）。修复=storage 回调内解构 MSG + sendMessage try/catch 不吞兜底 + manifest 回调条目显式先注入 rpc.js；契约套件 +1 段（VM 真实执行 rpc.js→oidc-callback.js 锁登录链路，旧版回放 FAIL 证明有效）。0.8.25-202611141302 测试版（dd08928）；按 ops R187 新口径 merge 即清树，验收改在主检出进行。

65. **Worktree 纪律同源修订：主检出优先、merge 即清**（主号 ops R187；2026-11-14，**已完成**；原登记为 64，与本仓占号 64（登录回调页修复）撞号，合并时顺延为 65）：本仓 `AGENTS.md`「Git Worktree 使用规范」节按 ops R187 新口径重写——主检出空闲时直接切任务分支开发（默认），主检出被占才建 worktree，干净复跑用 detached 临时树；merge 后立即 `worktree remove` + `branch -d`，验收状态由 PingCode idea `In progress` 承载；本地加载验收改在主检出进行（merge 后切回 `develop`），不再依赖任务树路径。`../ops/tools/worktree-doctor.sh` 巡检清理，本轮清掉本仓 r59/r60/r62 三棵已合入驻留树及分支（r63 在途未合入，保留）。纯文档 push，本仓无构建链。

66. **划词发音缓存与四级链路：IndexedDB 词音缓存 → 词典直连 → moon-well 词典代理 → 浏览器合成**（占号 2026-11-14，待回填）

67. **段落整页翻译：悬浮球+popup 入口、translate-batch 攒批懒加载、双语内联渲染**（占号 2026-11-14；2026-11-14 开发完成待真机验收，0.8.28-202611142136 测试版）：①**背景**——design.md §5 P1 收尾项「剩段落整页翻译（translate-batch）」，R1-R66 全台账从未立项，用户指令「把这个功能上线」补齐；moon-well 零改动（契约实测：≤20 段/批、每段 ≤2000 字符、顺序数组 `""`=段失败可重试、计费=1 积分/次 LLM 调用（miss 段合并）+1 积分/缓存命中段、code 1101=积分不足）。②**设计决策**（详见 `iterations/1.0/r67-page-translate/lld.md` 与 design.md §20 ADR）——入口两条按页手动开关绝不自动（悬浮球「🌐 整页翻译」气泡经 SW 转发 ML_PT_TOGGLE + popup 按钮直发 tabs.sendMessage，Why 不互走：popup 的 sender 无 tab、旧页面钩子缺失要可行动文案）；IntersectionObserver 400px 视口懒加载 + 攒满 8 段或 800ms 即发、单飞行顺序（**攒批是省钱关键**：8 段 miss 合并 1 积分 vs 逐段 8 积分）；计费护栏=单次开启 ≤100 段 + 页内内存缓存挡 toggle 循环重复扣费（服务端 ES 缓存命中仍计费）；文本 `\s+` 归一+2000 截断发送（与 magicbook paragraphSpeechText 缓存键对齐）；段落资格=TEXT_TAGS（剔 PRE）+可见+≥40 字符+CJK ≤30%+页面去重；多文档=顶层+同源 iframe ≤2 层 contentDocument 伸手（highlight.js collectDocs 同款）。③**渲染口径**——译文兄弟块插原段下方（LI/TD/TH/DD/DT 插内部：ul/tr 下兄弟 div 非法；块级 afterend 同 magicbook），textContent-only 永不 innerHTML、内联 style 自包含——**不注入全局样式表不污染 window**（AGENTS.md §0.2 管的是 UI 面板，译文块是内容性插入，chip 照旧 closed Shadow DOM `#magiclens-pt-host`）；`data-magiclens-translation` 标记三处排除（自身发现/highlight.js skipped()/划词）。④**落位**——`page-translate.js` 新模块（manifest 主清单 highlight.js 之后）+ rpc.js MSG 两键（ML_TRANSLATE_BATCH/ML_PT_TOGGLE）+ background 两 case（批量 60s 超时+SW 侧兜底归一/≤20 段/2000 截断镜像服务端 @Size；toggle 转发带「请刷新页面」文案——R63 教训）+ ball.js 气泡 + popup 按钮 + highlight.js 一行排除 + 能力握手 `data-magiclens-page-translate`。⑤**验证**——check-extension-modules.js +R67 契约段全绿（MSG 表/manifest 注入位/归一过滤截断 20 上限/空段落护栏零出网/积分不足文案透传/"" 段透传）；node --check 全过；集成套件同任务内同步：matrix/magiclens.csv +1（15 行）+ e2e_bridge +1 + run.js 特性用例（开→6 段单批→内联块→关清干净→三开缓存零新请求）+ translate-batch mock 路由 + pages/article.html fixture，`guard.py` 三向全绿，套件 magiclens 18/18 PASS、浏览器全特性回归 15/15。⑥**遗留**——手工 AC 待真机（滚动渐进出译文/iframe 页/积分不足与 401 文案/高亮不误扫译文/magicbook 域让位）；正式发布待用户确认后按 §0.2 两段式；PingCode idea 未建待用户令补建（R66 同口径）。

68. **划词链路加固：控件选区双轨检测（textarea/input/ShadowRoot）+气泡响应判代防漂移**（占号 2026-11-15；2026-11-15 开发完成待真机验收，0.8.29-202611150857 测试版）：①**背景**——wupage（GPL-3.0，只学思路不搬码）研读报告 P0 两项 + 在册缺陷「GitHub code view 划词不弹」（11-14 memory）；纯扩展侧改动，moon-well 零改动。②**设计决策**（详见 `iterations/1.0/r68-selection-hardening/lld.md`）——`selectionInfo` 双轨制：控件轨（`activeElement` 为 textarea/input type∈{text,search,url,tel} 时读 `selectionStart/End`，**控件选区不进 window.getSelection** 旧逻辑整段失效；readOnly 允许查询只挡替换，disabled 不允许）+ range 轨保留并加 shadow 探针（`ShadowRoot.getSelection` 有值优先，空则回退 window）；只读零干扰（不 focus/不 setSelectionRange/不拦事件）；控件锚点=光标行号×行高近似，行高不可得/≤3 行/越界三重回退字段矩形；`selection-relay.js` 同口径控件轨（iframe 内输入框此前同样不弹）；**translate 判代**——`current` 加 `seq`，三赋值点（划词/悬浮词卡/详解重试）统一 `seq: ++bubbleSeq`，回调 stale 检查由文本比对换 seq 比对（同词关泡重开旧响应不得复活；详解 detailSeq/朗读 speakSeq 已有各自判代不动；translateInflight 同词去重保留）。③**GitHub 边界实测（修正 11-14 判断）**——扩展注入正常，单击定位确实写 textarea，但**拖选/双击/键盘 Shift 选择均由 GitHub JS 层自管**（三路径实测不落 textarea 也不落 window 选区，渲染层无稳定契约、类名全 CSS module 哈希）→ 本修复恢复「标准控件行为」站点；GitHub 拖选特例不可行且 wupage（679 星）同样无此特判，是否立项待用户拍板。④**验证**——套件全量 16 项 PASS + `guard.py` 16 行缺口 0（matrix +1 ml-control-selection、run.js 新用例、iframe-relay 补断言、**顺手修 run.js 预存 ReferenceError**：总结打印引用循环内 `t.log.blocked` → 全 PASS 也 exit 2 退出码门禁被废）；真站四场景（本地 range/控件轨、真实鼠标拖选 textarea、GitHub code view 程序化选区、GitHub README range 轨）全绿——**调试教训**：closed shadow 在主世界 `host.shadowRoot` 恒 null，页面级探测必须走 CDP pierce（diag8-12 假阴性根因）；品牌 Chrome 136+ 忽略 --load-extension，扩展 E2E 必须用 CfT。⑤**遗留**——GitHub 拖选特例拍板项；wupage P1/P2（悬浮球 delta/iciba 防滥用/设置归一化/错误信封）未立项；真机 AC 待用户；正式发布待用户确认按 §0.2 两段式；PingCode idea 未建待用户令（R66/R67 同口径）。

69. **悬浮球气泡功能逐项配置：registry 单源、options 悬浮球区块、守卫双锁**（占号 2026-11-15；2026-11-15 开发完成待真机验收，0.8.30-202611152156 测试版）：①**背景**——用户指令「buddy 整页翻译 回顾等气泡功能都要能在悬浮球那里配置。代码层面写清楚，避免下次再犯」——清 R54 头注释登记的「可配置性 LLD 遗留」（R67 的 🌐 气泡再次硬编码印证欠账）；配置入口用户拍板**设置页「悬浮球」区块**。②**设计决策**（详见 `iterations/1.0/r69-ball-bubbles-config/lld.md` 与 design.md §21 ADR）——**registry 单源**：`common.js __magicLensBallActions`（frozen 纯数据 {id,icon,label,cfgKey} ×6，Why 数据进 common：options 页不加载 ball.js 须可独立求值；run 处理器留 ball.js 按 id 映射 RUNS 表）；`__magicLensDefaults` +7 键（bubble* ×6 + ballReview，**默认全 true=升级零变化**）；注册表注释写死三条纪律（新增气泡只改表一处/cfgKey 必须走前缀契约/禁私挂 ACTIONS 禁手抄 options 清单）。③**行为**——ball.js `build(cfg)` 按键过滤（activeActions）；**配置变更即时生效**=storage.onChanged 盯全部视觉键 → sync() 按 visualSignature 判重 → remove()+build()+applySavedPosition() 整体重建（R223 命名监听纪律下唯一对称拆装路径，teardownReview 级联、位置从 storage.local 恢复；token 等非视觉键刻意排除不触发重建）；**FAB 本体点击跟随配置**：chat 开→开抽屉（原行为）/chat 关→第一个启用气泡兜底/全关→ML_OPENOPTIONS 开设置页；**滚动复习词卡门控** `ballReview`：关闭=不 initReview（DOM 隐藏零队列请求），与暂停/收起（storage.local）独立；`openBubbles()` 零气泡早退（bubbles-open 还承担复习卡让位，空展开会误隐藏词卡）。④**守卫双锁（check-ball-visibility.js，"避免下次再犯"的执行机制）**——锁 A：registry cfgKey ↔ defaults bubble* 键双向覆盖（ballReview 是词卡开关非气泡单独断言——首版把 ballReview 塞进反向锁被自己的守卫打回，口径修正即锁的活证据）；锁 B：ball.js 禁 `const ACTIONS = [` 字面量 + RUNS 按注册表 id 全覆盖正则 + options.js 必须引用注册表与 ballReview。⑤**验证**——node --check 全过；三守卫全绿（双锁输出 `6 actions two-way locked`）；套件同任务内同步：matrix/magiclens.csv +1（ml-ball-bubbles，17 行）+ run.js 特性用例（基线 6 气泡+队列请求→关 2 个计数 4 且 dataAction 缺席/在场→ballReview:false 800ms 零队列请求→恢复词卡复活+计数回 6）+ e2e_bridge +1，`guard.py` 三向全绿，浏览器全特性回归 17/17（含并行 R68）、runner magiclens 20/20。⑥**版本漂移**——并行会话 R68 已 bump 0.8.29，本条语义化 +1 落 0.8.30；两改动文件不相交、分支基于含 R68 的 origin/develop 切出无冲突。⑦**遗留**——真机 AC 待用户（逐项开关即时生效/全关点球落设置页/词卡消失与复活/升级零变化）；正式发布待用户确认按 §0.2 两段式（可与 R66/R67/R68 同车）；PingCode idea 未建待用户令（R66-R68 同口径）。

70. **悬浮球配置切 buddy 页服务端真值：拉取 quick-actions 映射渲染、R69 本地开关换引导链接**（占号 2026-11-15；2026-11-15 开发完成待真机验收，0.8.31-202611152331 测试版）：①**背景与纠偏**——用户对 R69 反馈「还是不行啊」+ buddy 页截图：真意是扩展球与 magicbook buddy 页「伙伴悬浮球快捷动作」**同一份服务端配置**，而非扩展设置页本地开关（AskUserQuestion 二次确认：同一份配置；R69 本地开关移除换引导链接）。②**三仓接力**——moon-well R260 白名单 7→10（+highlight/page-translate/review，不变量零动，测试 9/9）；magicbook R294 buddy 页路由切 _moonwell_proxy+存量懒迁移+离线兜底+配置面 7→10（扩展项「仅扩展」标、ai_chat.js 按 HOST_ACTION_IDS 过滤，pytest 12/12）；本仓=只读消费。③**本仓决策**（详见 iterations/1.0/r70-server-ball-config/lld.md 与 design.md §22）——background ML_API 白名单 +/buddy/quick-actions；ball.js **缓存先行+服务端校正**（storage.local magiclens.ballQuickActions 先行渲染、启动即 fetch、签名变化才重建、失败静默保留缓存）；stored=true 按 selected∩registry **服务端顺序**渲染、词卡=selected 含 review；stored=false=全量默认（升级零变化）；R69 本地键 bubble*×6+ballReview 删除、registry 去 cfgKey（id=服务端白名单 id）、options 开关区换 buddy 页直达按钮。④**守卫升级**——锁 A 从本地默认键对账升级为**跨仓断言**（registry id ⊆ moon-well BuddyService QUICK_ACTION_IDS，../moon-well 同层文本解析）；锁 B 增补「options 不得再引用 registry」防本地开关复活。⑤**验证**——三守卫全绿（`6 actions ⊆ moon-well whitelist (10)`）；套件 mock /buddy/quick-actions（t.qa 注入）+ ml-ball-bubbles 重写四段 reload 断言（全量→过滤+词卡渲染→词卡关零请求→回全量）+ matrix note 更新，guard.py 三向全绿、浏览器全特性 17/17、runner 20/20。⑥**踩坑**——moon-well client 回包是 response.text 需路由侧解 JSON（magicbook 首版字符串当 dict 全 502）；守卫 `registry.size` 应为 length（守卫挂自己=正确行为）；E2E 词卡探针 reviewLoad 每次激活只发一次、请求计数差有竞态→改词卡 DOM 渲染直证。⑦**遗留**——真机 AC 待三仓 dev 齐（moon-well/magicbook dev 已 push 自动部署）；正式发布待用户确认（与 R66-R69 攒批次）；PingCode idea 待用户令。

71. **翻译快捷键：整页翻译与翻译段落快捷键 + 设置页自定义（参考沉浸式翻译）**（占号 2026-11-23；2026-11-23 开发完成待真机验收，0.8.32-202611231607 测试版）：①**背景**——R67「段落整页翻译」是一个开关（悬浮球 🌐 / popup 同切它），用户要给「翻译段落」「整页翻译」各配快捷键并做设置页自定义（点名参考沉浸式翻译）；口径经 AskUserQuestion 拍板：整页键=切现有开关，段落键=**悬停单段翻译**（翻译/撤销鼠标所在段，与沉浸式「鼠标悬停段落翻译」同款），默认 `Alt+A`/`Alt+P`。②**设计**（`iterations/1.0/r71-translate-shortcuts/lld.md` + design.md §23）——扩展内 keydown 录制式（沉浸式同款）而非 chrome.commands（自定义 UI 归 Chrome 不可编程）；键位串=修饰键固定序+**e.code**（mac Option 死键 å/π 使 e.key 匹配失效），''=禁用；combo 三件套落 common.js 纯函数；单段=mousemove 锚点→elementFromPoint→closest(TEXT_TAGS)→`qualifies`（从 paragraphText 拆出的纯资格判定）；done→撤销置 `dismissed`（防 MO 重扫复活，sessionCache 复活零计费）、pending/loading 忽略、否则 `start(false)` 保底开启（**不做全页发现**，视口段落不得放大成批量计费）；编辑态/扩展自建 shadow host/禁用站不触发，未命中零拦截。③**落位**——common.js（defaults 两键+三件套）/page-translate.js（keydown capture 分发+单段+chip 分层重构：host/errBox 与 chipRow 拆开，inactive 反馈走独立提示条 4s 消隐；坑=closed shadow `host.shadowRoot` 恒 null 须持 attachShadow 引用）/options.html+js（录制器：Esc 取消、冲突拒绝、清除=禁用）/manifest 0.8.32；moon-well 零改动。④**验证**——`check-extension-modules.js` +R71 契约段全绿；套件同任务内 matrix +1（ml-shortcuts，18 行）+run.js 用例（单段→撤销防复活窗→编辑态守卫→Alt+A 两按关再开、整页批次只含未缓存 5 段=单段→整页不重复计费实证→清干净→未命中零拦截）+e2e_bridge +1，guard.py 三向全绿，浏览器全特性 18/18、runner magiclens 21/21。⑤**遗留**——真机 AC 16 条待用户（`ac/manual-ac.md`）；正式发布待用户确认按 §0.2 两段式（与 R66–R70 同车）；PingCode idea 未建待用户令。

72. **翻译快捷键对齐沉浸式翻译补充：双击 Alt 整页别名 + Shift 悬停单段 + Mac 键位说明与录制器单修饰键修复**（占号 2026-11-23；2026-11-23 开发完成待真机验收，0.8.33-202611231637 测试版）：①**背景**——R71 验收问询核实沉浸式翻译官方口径（整页=Alt+A；悬停段落=按住 Shift 且默认关闭、无独立快捷键；「双击 Alt」非官方功能），用户拍板**两个都加**（保留 Alt+A/Alt+P；Mac 上即 ⌥A/⌥P，e.code 匹配天然可用）。②**设计**（`iterations/1.0/r72-shortcut-it-parity/lld.md` + design.md §23.1）——双击 Alt（裸 AltLeft/Right、仅 altKey、≤500ms）走 toggle() 同路径，其他键断连击、单按零拦截；按住 Shift 悬停单段复用 Alt+P 状态机（敢默认启用的底气=光标不在合格段落上零反应，沉浸式默认关是因无资格闸）；录制器怪串根修=comboFromEvent 拒修饰键物理 code（AltLeft 族→null，录制/匹配/守卫三处受益）；两别名固定不进 storage。③**验证**——check-extension-modules R72 断言全绿；套件 ml-shortcuts 用例 +4 段（单按 Alt 零反应/断连击/双击开 6 段全缓存零请求/双击关/Shift 悬停/Shift 撤销），guard 三向 18 行缺口 0，浏览器 18/18、runner 21/21。④**遗留**——真机 AC（R71 16 条 + R72 13 条：双击窗口 500ms 手感、Shift 悬停误触观察）；正式发布 R66–R72 攒批次待用户确认；PingCode idea 待用户令。


73. **缺陷：整页翻译「已译 0 段」与伴读网页上下文采零——TreeWalker FILTER_REJECT 跳过子树**（占号 2026-11-23；同日修复完成待真机复测，0.8.34-202611231721 测试版；缺陷：R67 验收发现，顺带 P0 上下文采集同根因）：①**症状**——用户验收 R71/R72 时报「段落翻译没问题、整页翻译有问题」，确认症状=整页开启后 chip 恒「已译 0 段」从不翻译，同页 Alt+P 单段正常。②**根因**——`rescanDoc` 元素级 TreeWalker 对不匹配元素返回 `FILTER_REJECT`（REJECT=连整棵子树剪掉），真实页面 `<p>` 嵌在 div/article 容器里从 body 遇容器即全灭 → 发现数恒 0；Alt+P 走 elementFromPoint+closest 不经 walker 故正常。漏网原因=E2E fixture 的 `<p>` 恰是 body 直接子元素（扁平结构侥幸绕过剪枝）。R67 原始缺陷真机首测暴露，非 R71/R72 回归。③**顺带同根因**——`page-extract.js`（伴读问 AI 网页上下文采集）同款 REJECT：嵌套页面伴读上下文采零只带标题，随 R73 一并修（同次排查同修法，条目注明）；highlight.js 的 SHOW_TEXT walker REJECT 打在无子树文本节点上无此缺陷。④**修复与回归锁**——两处 FILTER_REJECT→FILTER_SKIP+语义注释；fixture 嵌套化（正文包进 article>div.prose）；守卫 R73 段（两文件禁 REJECT 必 SKIP、fixture 嵌套在册）；TDD 先复现（嵌套 fixture 下 ml-page-translate FAIL 批量 0 请求）后修转绿。⑤**验证**——ml-page-translate/ml-shortcuts 全过，浏览器 18/18、runner 21/21、guard 三向 18 行 0 缺口、契约守卫 6 段全绿。⑥**遗留**——真机复测整页翻译（嵌套正文页）；正式发布 R66–R73 攒批次待用户确认；PingCode idea 待用户令。

74. **缺陷：双击 Alt 窗口误伤 Alt+A 键序与长按重复（R72）+ 在途回包跨会话重复渲染（R67 潜伏）——浏览器实测发现**（占号 2026-11-23；同日修复完成待真机抽查，0.8.35-202611232133 测试版）：①**发现**——用户令「使用浏览器测试一下」，CfT+真实 dev moon-well+可信键盘事件实测暴露：双击 Alt 开后 300ms 按 Alt+A → 撤销失效、**同段两条不同译文**、chip「已译 13 段」。②**插桩实锤两缺陷**——R72 双击 Alt 误伤：第二击即时判定，「双击后 ≤500ms 内任何 Alt 组合键的前半按」被误判（时间线 t=313 实锤），长按 Alt 的 e.repeat 连环判定同理；R67 潜伏：`sendBatch` 回包仅守 `!active`，快速 OFF→ON 时旧会话在途回包落进新会话重复插 DOM（误伤放大器，双译文来源）。③**修复**（page-translate.js）——`e.repeat` 守卫；第二击判定延迟 **150ms 静默窗**（`DOUBLE_ALT_QUIET`，窗内任何其他 keydown 经 cancelPendingDouble 取消，stop 同步取消防幽灵 toggle）；**会话代守卫**（sessionSeq 每次 start()+1，回包 stale 时仍写页内缓存——钱已花重开零计费——但跳过 DOM/chip/续发）。④**回归锁**——套件 ml-shortcuts +⑩（双击开→立刻 Alt+A→恰好关闭不复活、零幽灵、repeat 零反应）；守卫 R74 段四断言。⑤**验证**——ml-shortcuts 全过、浏览器 18/18、guard 18 行 0 缺口、契约守卫 7 段全绿；**CfT 真实浏览器端到端复测全过**（修复前失败键序全走通 + Wikipedia 首屏 8 段真实中文译文、scrollTo 后 IO 续批至 16、关闭清零，截图 /tmp/ml-browser-test/）。⑥**遗留**——真机抽查 AC 8 条（r74-shortcut-misfire/ac/）；正式发布 R66–R74 攒批次待用户确认；PingCode idea 待用户令。
