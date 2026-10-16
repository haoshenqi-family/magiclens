# magiclens 重构项明细（L1–L7 + 未编号项 + 跨仓项本仓部分）

> 状态：任务清单（2026-10-15 建档，全部待启动；开工时按 `AGENTS.md` worktree 纪律逐项单独立项）
> 来源：家族根 [`architecture-review-2026-10-14.md`](../../../../../docs/architecture-review-2026-10-14.md) §2.3 / §3.3；编号 L1–L7 与原文一一对应。总表与波次见 [overview.md](overview.md)。

**通用验收底线（每项都适用，下文不再重复）**：修改完成即递增测试版本号（不触发发布）；`chrome://extensions` 重载后控制台无新增报错；涉及 AC 条目真机实测（background 中转 / Result 解包 / Shadow DOM 隔离三条硬性约定不破坏）；正式发布仅由用户确认。

---

## L1 · 抽 `rpc.js`：统一消息封装【X1 本仓部分】

- **严重度 / 波次 / 前置**：🟠 ｜ **波 1（X1 三端合围）** ｜ 无
- **模式**：门面
- **现状问题**：消息封装三份语义各异——`content.js:232` / `highlight.js:466`（吞错返 null）/ `chat.js:27`；无统一 RPC 门面，错误语义漂移。
- **任务内容**：抽 `rpc.js` 合并三份 askBackground，消息类型常量集中；统一错误语义（不再吞错返 null 后静默）。
- **验收判据**：① 三处调用方全部迁入门面；② 与 moon-well M4、magicbook B5 联合验收（X1 判据：三端契约事故链「包装/解包/错误上浮」两端机制 + 一端可见）；③ 划词/高亮/伴读全链路真机回归。

## L2 · content.js 拆分

- **严重度 / 波次 / 前置**：🟠 ｜ 波 3 ｜ 无
- **模式**：拆分
- **现状问题**：content.js 740 行——OIDC 回调劫持（L8-49）+ 气泡 + 详解 + TTS + 划词 + iframe 六个关注点同文件；回调页跑完整启动门控；改气泡必通读全文。
- **任务内容**：拆 `oidc-callback.js`（独立 content_script，仅 match moon-well 域）+ `bubble.js` + `detail-panel.js` + `tts.js`；回调页不再执行主门控。
- **验收判据**：① OIDC 登录回调在 moon-well 域正常捕获 token，在其他页面零开销；② 划词气泡 / 详解面板 / TTS / iframe 选区中继（R36 链路）真机回归；③ 每文件 <1,000 行（波 3 判据）。

## L3 · background.js 减重

- **严重度 / 波次 / 前置**：🟡 ｜ 未排（原波次表未覆盖） ｜ 无
- **模式**：减重
- **现状问题**：`background.js` `importScripts('stemmer.js','icuba.js')` 混入 120 行领域代码——SW 职责混杂（消息路由 + 领域逻辑）。
- **任务内容**：MV3 SW 支持 importScripts，把领域代码（词形还原 / 金山查词）移出消息路由文件为独立模块；消息路由层只做分发。
- **验收判据**：① 消息路由文件无领域逻辑；② 金山直连快路径（R15）与词族口径（R16）回归正常。

## L4 · 抽 `ensureAuthToken()`：token 刷新链合一

- **严重度 / 波次 / 前置**：🟠 ｜ 波 2 ｜ 无
- **模式**：状态机
- **现状问题**：token 刷新两份手抄——`background.js:98-111`（callApi 401 分支）↔ `:420-434`（`ml:auth`）；SSE 第三处散落（`chat.js:350,356`）；口径靠注释对齐，401 处理不一致风险。
- **任务内容**：抽 `ensureAuthToken()`，callApi 401 分支与 `ml:auth` 共用一份刷新 / 清凭据逻辑；R35 定下的语义（刷新超时保凭据提示重试 / 确定性失败清凭据引导重登）为唯一口径。
- **验收判据**：① 全仓 token 刷新逻辑单点；② 401 → 静默刷新 → 重放 / 刷新失败 → 清凭据引导重登，两条路径真机验证；③ SSE 前置凭据解析（chat.js）同口径。

## L5 · settings 单一 schema

- **严重度 / 波次 / 前置**：🟡 ｜ 波 2 ｜ 无
- **模式**：单一 schema
- **现状问题**：设置默认值 5 处重复（`background:8` / `content:67` / `highlight:858` / `popup:17` / `options:21`）——新增设置需改 5 处。
- **任务内容**：settings.js 的 DEFAULTS 对象 + 读写助手并入 common.js，5 处默认值全部消灭。
- **验收判据**：① 全仓设置默认值单点；② 新增一个设置项只改一处（以本次新增项验证）；③ popup / options 读写回归正常。

## L6 · 失败可见：静默降级上浮

- **严重度 / 波次 / 前置**：🔴 ｜ 未排（原波次表未覆盖；🔴 建议尽早，可与波 1 同窗口） ｜ 无
- **模式**：失败可见
- **现状问题**：① `highlight.js:533-536` analyze 失败 → 静默降级「不打扰阅读」，接口故障与「本页无生词」UI 同形（R44 同型病未根治，用户只会报「波浪线没了」）；② `chat.js:495-498,509-514` memory save / delete `if (r.ok)` 无 else——用户手动存的记忆静默丢失。
- **任务内容**：① 高亮 analyze 失败上浮 console.warn + popup 常驻失败原因（可展开查看）；② chat.js memory 写操作补 else 提示（成功/失败均在界面可见）。
- **验收判据**：① 真机模拟接口故障（断网 / 错误 token）：高亮页可见失败原因而非「无生词」假象；memory 保存失败有明确提示；② 正常路径无新增噪音；③ R44 已修的面板解包失败可见行为不回退。

## L7 · 镜像向量锁：四组同构逻辑 node 断言向量【X2 本仓部分】

- **严重度 / 波次 / 前置**：🟠 ｜ 波 4（与 magicbook / moon-well 同窗口） ｜ 无
- **模式**：镜像加锁
- **现状问题**：与 magicbook / moon-well 四组同构逻辑无机器锁，靠注释对齐——
  - TTS fallback：`content.js:413-454` ↔ magicbook `epub.js:469-506`；
  - 详解六板块渲染：`content.js:548-633` ↔ `epub.js:607-801`；
  - SSE 帧解析：`chat.js:280-314` ↔ magicbook `ai_chat.js:387-430`；
  - Result 解包口径 + 词形还原（实际三处：本仓 `background` porterStem / `highlight` lemmaCandidates / moon-well `WordInflection`）。
  R16/R24 类漂移 bug 必复发。
- **任务内容**：与 magicbook / moon-well 共建共享测试向量（JSON 用例同源，放各仓 tests），本仓侧建 node 断言向量跑同一份用例（本项目无测试框架，此为首个 node 断言入口）。
- **验收判据**：① 四组向量用例三端同源一致；② 任一端口径漂移即本仓断言红灯（用一次故意漂移验证红灯有效）。

---

## 未编号项（报告 §3.3 列明但未入 L1–L7 编号主体，如实登记）

### U1 · `__magicLens*` 隐式钩子注册表化

- **严重度**：🟡 ｜ 13 个 `window.__magicLens*` 隐式钩子靠 manifest 数组顺序——无 schema 无注册表，换序 / 漏挂静默失效。
- **任务**：钩子改注册表模式（显式注册 + 加载完备性自检），消灭对 manifest 顺序的隐式依赖。
- **验收**：故意调换顺序仍正常；漏挂有 console 告警。

### U2 · host 挂载 id 防御小缺口

- **严重度**：🟡 ｜ `content.js:79` host 挂 documentElement + `page-extract.js:37` 同 id 排除——页面自造 `#magiclens-host` 可隐藏气泡 / 漏采上下文。
- **任务**：挂载点加不可预测性或校验（如随机后缀 id + 内部引用不依赖选择器）。
- **验收**：页面预置同 id 元素不影响气泡与上下文采集。

---

## 状态回填约定

每项开工 / 完成 / 验收时：① 回填本节各条目下方一行 `状态：待启动 → 开发中（日期，分支）→ 已上线（版本号）`；② 同步 [overview.md](overview.md) 总表「状态」列。
