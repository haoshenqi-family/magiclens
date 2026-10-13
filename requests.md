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
