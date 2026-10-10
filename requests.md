# requests.md — 对话需求记录

> 仅记录每一次对话用户的需求，除此之外不做任何事情。
> 2026-10-08 起引入归档：已确认完成且过时的条目按编号区间原样搬移至 `requests-archive/`；未完成与有经验教训价值的条目保留于此。编号永不回改、归档不释放编号，新任务按全史最大编号 +1 递增（当前最大 R33）。

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
