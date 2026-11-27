# response 归档 · R64–R68

> 2026-11-27 R78 写入触发轮转搬移（窗口 14→10），原样搬移、不改写。

## 2026-11-14（R64：登录成功回调页不自动关闭修复）

### R64（用户：「✓ MagicLens 登录成功 / 令牌已自动保存，本窗口稍后自动关闭。然后一直没有关闭」）

- **做了什么**：登录成功回调页的两条关闭链路（background 收 ML_LOGIN_OK 后 2.5s `chrome.tabs.remove` 为主、content 3s `window.close` 为兜底）双双哑火，断点是同一处——`oidc-callback.js` 引用裸 `MSG`，而 `MSG` 从非全局（rpc.js 只挂 `__magicLensRpc`，全仓口径 `const MSG = __magicLensRpc.MSG`）；R47（906e232）迁独立 content script 时把裸引用带了过来、解构行丢了。ReferenceError 抛在 `chrome.storage.sync.set` 异步回调里、外层 try/catch 接不住：横幅照常渲染（用户看得到「登录成功」），但 ML_LOGIN_OK 发不出、兜底定时器不注册、background 永不 `tabs.remove`，标签页永久停留。修复：① storage 回调内解构 `MSG`（异步执行时两条注入条目的 rpc.js 必已落定；刻意不放 IIFE 顶层——条目顺序变动会先崩、连令牌捕获一起丢）；② `sendMessage` 包 try/catch，发送失败不吞兜底定时器；③ manifest 回调条目显式先注入 `rpc.js`（依赖显式化，不借道 catch-all 条目的注入）。潜伏期自 2026-10-15（token 90 天有效、登录罕见故一直未炸）。
- **测试**：`scripts/check-extension-modules.js` +1 段回调页契约——VM 按 manifest 注入顺序真实执行 rpc.js → oidc-callback.js，锁「存令牌→渲染横幅→发 ML_LOGIN_OK（类型取自 MSG 表）→注册兜底定时器」链路；storage 回调按浏览器语义异步投递（同步调用会被外层 try/catch 接住，掩盖真实失败形态——首版测试即踩此坑）；**旧版缺陷回放 FAIL 证明守卫有效**（0c4b792 旧文件换入重跑 = `ReferenceError: MSG is not defined` 复现 + 套件 exit 1，恢复修复版全绿）；node --check + manifest JSON 合法性过；本套件之外 T1 手工矩阵无登录回调独立行（真机验收覆盖）。
- **验收（用户真机）**：`chrome://extensions` 加载本 worktree `extension/` → 设置页「登录」→ Authentik 登录完成 → 回调页应显示「✓ MagicLens 登录成功」并在约 2.5-3s 内自动关闭（修复前永不关闭）；回 options 页登录状态应已刷新。
- **部署**：`0c4b792..dd08928` push `origin/develop`（R64 先行，0.8.25-202611141302 测试版）；2026-11-14 用户令「merge 到 develop」——R63（5805c32/d45b580）与 R64 在主检出正式合并推送，合并结果顺延 **0.8.26-202611141315**（含两修）；正式版随下一轮发布去时间戳 merge `release`。
- **总结**：requests.md 占号 R64（`0c4b792`）本条为回应；冲突记录：R63 并行会话同日开发且测试版同递增至 0.8.25——其提交（5805c32/d45b580）驻主检出树尚未 push，曾致主检出试合并 manifest 冲突（即时 abort，未留痕）；R64 先以纯快进推上 origin/develop；同日用户令合并，已在合并中把撞号顺延为 0.8.26（R63 修复同车），其台账撞号条目（Worktree 纪律修订）重编为 65。

## 2026-11-14（R66：划词发音四级链路——IndexedDB 词音缓存 + moon-well 词典代理）

**对 R66 的回应**：用户要「缓存每个单词的真人发音、不要机械合成音」，并拍板链路与边界：
不预取；词典直连失效走后端（后端给的也必须是词典音），后端也失效才机器合成。

- **交付（版本 0.8.27-202611141415 测试版）**：
  - 四级的第 1~3 级收进 background SW（新消息 `ML_DICT_SPEAK`）：① IndexedDB 词音缓存
    （库 `magiclens`/store `dictvoice`，键=trim+弯撇号归一+小写，与 moon-well R259 同口径；
    软上限 3000 词 LRU，`ts` 索引剪枝；读写失败按 miss/跳过降级）；② 有道 dictvoice 直连
    （SW fetch 吃 host_permissions 豁免，5s 超时，形制校验同服务端）；③ moon-well
    `POST /tts/dict-voice`（R259 词典真人音非 TTS，10s，404/断网/未登录都落下一级）。
    同词并发 single-flight；L2/L3 字节均回写客户端缓存。
  - content `speak()` 改 Web Audio 解码播放（`decodeAudioData` 老 Safari 回调形态兼容，
    chat.js 同款）：字节经消息通道，**对宿主页 CSP 免疫**——根治 R43 起 media-src 严格
    站点被页面 CSP 打回机械音的问题。`speakSeq`（stopSpeak 时 +1）+ `current.text` 双闸
    作废迟到响应/迟到回退；AudioContext 每页复用；`ctx` 悬挂或解码失败退机器合成。
  - 机器合成（speechSynthesis）退居最终兜底：四级全空 / 短语句子 / 解码或播放被拦。
- **守卫**：`scripts/check-extension-modules.js` 增 R66 契约段（VM 内存 IndexedDB 桩 +
  可控 fetch 真实执行 background.js）：直连命中回传形制与归一词序 / 缓存命中零出网 /
  直连失败→代理命中（登录态）/ 四级全空 `{ok:false}` / 形状闸零出网，5 组断言全绿。
- **集成套件**：`matrix/magiclens.csv` ml-speak 行改四级口径；`browser/run.js` 用例断言
  「SW 直连 dictvoice」+「二次朗读 IndexedDB 缓存零出网」+「直连命中不叠打代理」
  （mock 对 youdao 域有 R43 遗留成功路由，即第 2 级命中短路；第 3 级代理由 VM 契约测试
  与 moonwell T1 dict-voice 用例覆盖）——**magiclens T1 17/0/0/0 全绿**。
- **服务端配对**：moon-well R259（`/tts/dict-voice` + MinIO 永久缓存），其仓 LLD/台账各自
  回写；dev 已部署验证（api-docs 见端点）。
- **文档四问**：L1 README 功能表「划词朗读」行 + API 契约速查新增 `/tts/dict-voice`；
  L2 design.md 追加决策 19；LLD 落 `iterations/1.0/r66-dictvoice-cache/lld.md`。
- **发布范围**：push develop `b034224`（测试版不触发发布）；正式发布待用户确认后按
  §0.2 两段式（去时间戳后缀 → merge release）。
- **手工 AC（待真机验收）**：单词点 🔊 真人音；同词第二次秒出（缓存）；短语/句子合成音；
  关气泡即停；断网单词仍机械音兜底。
- **PingCode**：idea 未建，待用户令补建挂 ML-56+（本条先台账承载）。

**台账总结**：`requests.md` 第 66 条由 `claim.sh` 占号即 push（`ce139f3`）；response.md 现
7 节未超窗口。冲突记录：无撞号；R65 为今日已完成的 docs-only 任务（worktree 纪律同源修订，主号 ops R187），本条顺延 R66。

## 2026-11-14（R67：段落整页翻译——translate-batch 攒批懒加载 + 双语内联渲染）

**对 R67 的回应**：用户指令「把这个功能上线」——补齐 design.md §5 P1 收尾项
「剩段落整页翻译（translate-batch）」（R1-R66 全台账从未立项）。moon-well 零改动。

- **交付（0.8.28-202611142136 测试版）**：
  - `page-translate.js` 新模块（manifest 主清单 highlight.js 之后）：视口懒加载
    （IO rootMargin 400px per-doc）+ 攒满 8 段或 800ms 即发、单飞行顺序；译文以兄弟块
    插原段下方（textContent-only、内联 style 自包含，LI/TD 类插元素内部——ul/tr 下兄弟
    div 非法）；状态 chip closed Shadow DOM 左下角（进度/达上限提示/✕ 关闭/401 重新登录链）；
    页内内存缓存挡 toggle 循环重复扣费；单次开启 ≤100 段护栏；生命周期三件
    （storage.onChanged / onInvalidated / bfcache pageshow）与 highlight/content/ball 同模式；
    能力握手 `data-magiclens-page-translate`。
  - rpc.js MSG +2（ML_TRANSLATE_BATCH / ML_PT_TOGGLE）；background 两 case：批量端点
    `/vocabulary/reading/translate-batch`（60s 超时，SW 侧兜底归一/去空白/≤20 段/每段 ≤2000
    ——服务端 `@Size` 镜像）；toggle 转发给 sender tab（收不到回「请刷新页面」可行动文案，
    R63 教训）。悬浮球 +1 气泡（🌐，经 SW 转发）；popup +1 按钮（直发 tabs.sendMessage）；
    highlight.js `skipped()` 排除译文标记（译文英文词不进判定矩阵）。
  - **设计要点**（design.md §20 ADR）：攒批是契约级设计——服务端把一次请求内的 miss 段
    合并为一次 LLM 调用（8 段 1 积分 vs 逐段 8 积分）；译文块是内容性插入不属 UI 面板，
    §0.2 的 Shadow DOM 约束精神（样式隔离/无全局污染）不受损。
- **守卫**：check-extension-modules.js +R67 契约段全绿（MSG 两键 / manifest 注入位 /
  归一过滤截断与 20 段上限 / 空段落护栏零出网 / 积分不足文案透传 / `""` 段透传）；
  node --check 全过。
- **集成套件（同任务内同步）**：matrix/magiclens.csv +1（ml-page-translate，15 行）；
  e2e_bridge.py +1；browser/run.js +1 特性用例（开启 → 6 段单批 body 断言 → 内联块渲染 →
  关闭清干净 → 三开页内缓存零新请求）+ translate-batch mock 路由（result 按请求段落序动态
  生成）+ pages/article.html fixture——`guard.py` 三向对账全绿，套件 magiclens 18/18 PASS
  （0 FAIL 0 SKIP），浏览器全特性回归 15/15。
- **文档四问**：L1 README 新「整页翻译」节 + 悬浮球气泡清单 +「规划中」注记移除；
  L2 design.md 追加决策 20；LLD 落 `iterations/1.0/r67-page-translate/lld.md`。
- **手工 AC（待真机验收）**：英文页开/关与滚动渐进出译文；关闭移除干净、刷新重置；
  同源 iframe 页出译文；积分不足/401 文案；生词高亮不点亮译文；magicbook 域球让位但
  popup 按钮可用。
- **PingCode**：idea 未建，待用户令补建挂 ML-56+（R66 同口径，本条先台账承载）。

**台账总结**：`requests.md` 第 67 条由 `claim.sh` 占号即 push（`5122f3d`）；response.md 现
8 节未超窗口。冲突记录：无撞号。

## 2026-11-15（R68：划词链路加固——控件选区双轨检测 + 气泡响应判代防漂移）

**对 R68 的回应**：wupage（GPL-3.0，只学思路不搬码）研读报告 P0 两项落地 + 在册缺陷
「GitHub code view 划词不弹」。moon-well 零改动，纯扩展侧。

- **交付（0.8.29-202611150857 测试版，`5b38c49` merge 即清分支）**：
  - `content.js selectionInfo` 双轨制：控件轨（textarea/input 文本类读
    `selectionStart/End`——控件选区不进 `window.getSelection()`，旧逻辑在此整段失效；
    readOnly 允许查询只挡替换）+ range 轨保留并加 shadow 探针（`ShadowRoot.getSelection`
    有值优先）；只读零干扰（不 focus/不 setSelectionRange/不拦事件）。
  - 控件锚点：光标行号 × 行高近似定位，三重回退字段矩形（GitHub 整文件透明 textarea
    直接贴字段矩形会把气泡钉在文件顶部）。
  - `selection-relay.js` 同口径控件轨（iframe 内输入框此前同样不弹）+ `sendSelection` 抽取。
  - **translate 判代**：`current` 加 `seq`，三赋值点统一 `seq: ++bubbleSeq`，回调 stale
    检查文本比对 → seq 比对（同词关泡重开旧响应不得复活——R63 词卡漂移的机制层收尾）；
    详解/朗读此前已有各自判代不动。
- **GitHub 边界实测（修正 11-14 判断）**：扩展注入正常、单击定位写 textarea，但拖选/
  双击/键盘 Shift 选择均由 GitHub JS 层自管（三路径实测不落任何标准选区 API，渲染层
  无稳定契约）→ 本修复恢复「标准控件行为」站点；GitHub 拖选特例不可行（wupage 同样
  无此特判），是否立项待用户拍板。
- **集成套件（同任务内同步）**：matrix +1（ml-control-selection，16 行）、run.js 新用例
  （普通 textarea + readOnly 模拟 GitHub 透明层）+ iframe-relay 控件轨补断言 +
  control-selection.html/iframe-child.html fixture；**顺手修 run.js 预存 ReferenceError**
  （总结打印引用循环内变量 → 全 PASS 也 exit 2，退出码门禁被废）。`guard.py` 三向全绿、
  套件 16/16 PASS、真站四场景全绿（详见 LLD §4）。
- **调试教训（存档）**：closed Shadow DOM 主世界 `host.shadowRoot` 恒 null——页面级
  探测必须走 CDP pierce（diag8-12 连续假阴性根因）；CDP pierce 的 closed shadow root
  在 `shadowRoots` 字段不在 `children`；品牌 Chrome 136+ 忽略 --load-extension，扩展
  E2E 必须用 CfT（套件 findCft 已有）。
- **文档四问**：L1 功能不变不涉；L2 架构不变不涉；LLD 落
  `iterations/1.0/r68-selection-hardening/lld.md`（状态行随验收回填）。
- **手工 AC（待真机验收）**：标准输入框/textarea 划词应弹、普通网页划词零回归、
  同词关泡重开无旧译文复活、GitHub blob 拖选不弹属预期（自管选择壁垒）。
- **PingCode**：idea 未建，待用户令补建（R66/R67 同口径，本条先台账承载）。

**台账总结**：`requests.md` 第 68 条由 `claim.sh` 占号即 push（`433b573`）、详情已回填；
response.md 现 9 节未超窗口。冲突记录：无撞号。配套 ops 仓套件改动随 ops main
`53d04ef` push。
