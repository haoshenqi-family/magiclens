# response.md — 对话回应记录（仅保留最近 10 个 request 的回应）

> 归档索引：[response-R1-R10.md](response-archive/response-R1-R10.md) · [response-R11-R15.md](response-archive/response-R11-R15.md)（2026-10-07 R25 完成时补执行 R10/R20 漏掉的归档） · [response-R16.md](response-archive/response-R16.md)、[response-R17-R18.md](response-archive/response-R17-R18.md)（2026-10-08 R28 收口时搬移） · [response-R19.md](response-archive/response-R19.md)（2026-10-08 R29 完成时搬移） · [response-R20.md](response-archive/response-R20.md)（2026-10-08 R30 完成时搬移） · [response-R21-R22.md](response-archive/response-R21-R22.md)（2026-10-08 R32 完成时搬移） · [response-R23-R24.md](response-archive/response-R23-R24.md) · [response-R28.md](response-archive/response-R28.md) · [response-R25.md](response-archive/response-R25.md)（2026-10-10 R35 完成时搬移） · [response-R26.md](response-archive/response-R26.md)（2026-10-10 R36 写入触发轮转搬移） · [response-R27.md](response-archive/response-R27.md)（2026-10-10 R38 写入触发轮转搬移） · [response-R29.md](response-archive/response-R29.md)（2026-10-11 R40 写入触发轮转搬移） · [response-R30-R31.md](response-archive/response-R30-R31.md)（2026-10-11 R41 集成时窗口超限搬移） · [response-R32.md](response-archive/response-R32.md)（2026-10-13 R43 写入触发轮转搬移） · [response-R33.md](response-archive/response-R33.md)（2026-10-14 R44 写入触发轮转搬移） · [response-R34.md](response-archive/response-R34.md)（2026-10-15 R45 写入触发轮转搬移） · [response-R35-R38.md](response-archive/response-R35-R38.md)（2026-10-16 R50 写入触发轮转搬移，窗口回 10 条 request 内） · [response-R41.md](response-archive/response-R41.md)（2026-10-27 R56 写入触发轮转搬移） · [response-R45.md](response-archive/response-R45.md)（2026-10-21 R51 写入触发轮转搬移） · [response-R39.md](response-archive/response-R39.md)（2026-10-27 R52 写入触发轮转搬移） · [response-R46.md](response-archive/response-R46.md)（2026-10-27 R53 写入触发轮转搬移） · [response-R40.md](response-archive/response-R40.md)（2026-10-27 R54 写入触发轮转搬移） · [response-R47.md](response-archive/response-R47.md)（2026-10-27 R55 写入触发轮转搬移） · [response-R42.md](response-archive/response-R42.md)（2026-10-29 R57 写入触发轮转搬移） · [response-R43.md](response-archive/response-R43.md)（2026-11-02 R58 写入触发轮转搬移） · [response-R44.md](response-archive/response-R44.md)（2026-11-08 R59 写入触发轮转搬移）

- `response-archive/response-R50-R52.md`：R50 docs v2 迁移 / R51 发布链纯文档跳过打包 / R52 伴读抽屉去 token+站内链接——2026-11-13 R62 写入触发轮转搬移（窗口 12→13 压回 10），原样搬移不改写

- `response-archive/response-R53.md`：R53 伴读抽屉语音双向（麦克风转写 + 回复朗读）——2026-11-13 R63 写入触发轮转搬移，原样搬移不改写

## 2026-10-27 ～ 2026-11-02（R54–R58：悬浮球常驻入口 / 两缺陷修复 / 划词直译 / README 重写）
### R54（常驻入口悬浮球：设置开关 + 首次安装引导选择）

- **背景**：用户需求「添加一个常驻入口，可以用户选择是否开启常驻。首次安装插件的时候，提示用户选择。」此前伴读抽屉唯一入口是划词「问 AI」（R52 汇报指出，用户随即拍板补常驻入口）。
- **交付（分支 `feat/r52-buddy-parity` 同树续作（家族口径第 7 条），版本 0.8.17-202610271714 测试版）**：
  - `ball.js`（新 content script，manifest 组 2 末位=仅顶层文档）：右下角 44px 圆钮（AI 字样，closed Shadow DOM），点击经同隔离世界钩子 `__magicLensAsk('')` 直接打开伴读抽屉——零新消息类型、零 background 改动；显隐判定走 common.js 新纯函数 `__magicLensBallVisible`（主开关 × 球开关 × 顶层文档 × 域名管理名单，名单复用 `__magicLensIsDisabledHost` 同一份语义）；挂 `storage.onChanged` **实时显隐**（已打开页面无需刷新）；rpc `onInvalidated` 失效退役（扩展重载后旧球自行摘除）。
  - 设置页：新增「常驻入口」复选框；页首引导卡片「要把伴读入口常驻到每个网页吗？【开启常驻入口】【暂不开启】」——只问一次（`ballAsked` 落库后永不再问），安装时 background 既有 `onInstalled(install) → openOptionsPage()` 自动打开本页正好承接。
  - **默认关闭**：常驻悬浮球属侵入性 UI，未经选择不突现；存量用户升级（update 不自动开设置页）行为零变化。任何一次明确选择都同时写 `ballEnabled+ballAsked`，避免「关了开关又被问一遍」；走 `storage.sync` 跨设备一致。
  - 交叉审查修掉一个穿层：球 z-index 2147483646→**2147483645**，抽屉打开时球被半透明遮罩盖住不浮在遮罩上。
  - v1 不做拖拽换位与 popup 快捷开关（LLD §1 遗留登记）。
- **验证（诚实）**：`node --check` 三文件全过；`__magicLensBallVisible` node 冒烟 10 例全过（全开/球关/主开关关/iframe/禁用域名及子域/其他域名/URL 形态条目/默认值两项）；options DOM id 齐全性脚本 html+js 双侧命中。**真机手工清单待用户**：① 设置页出现引导卡片；② 点「开启」→ 已打开网页不刷新即现球；③ 点球开抽屉；④ 关开关球立刻消失；⑤ 域名管理站点球不显示；⑥ 抽屉打开时球不穿层；⑦ 重载扩展旧球随旧副本退役。
- **文档**：README 功能表增「常驻入口悬浮球」行；LLD `iterations/1.0/r54-ball/lld.md`；迭代 plan.md 增 MAGICLENS-8。
- **台账**：worktree `../magiclens-r52-buddy-parity`（分支 `feat/r52-buddy-parity`）merge 后驻留待验收（R52/R53/R54 三批一起验）；未 push（正式发布需用户确认后去时间戳 merge release）。窗口轮转：最旧的 R40 原样搬至 `response-archive/response-R40.md` 并登记索引，写入后窗口 10 条。
- **验收修订 v2（2026-10-27 同日，0.8.18-202610271758，同 worktree 续作）**：用户修改意见「这个悬浮球和 magicbook 的保持一致，使用 buddy 形象，悬浮提供更多选项。」ball.js 重写为 magicbook R223 同形态——①**buddy 形象**：56px 透明头像球（moon-well `/buddy/catalog` JWT 取 equipped 伙伴 MinIO 直链，probe 成功才切、失败保蓝色「AI」兜底；`ML_API` 白名单加 `/buddy/catalog`）；②**hover 径向快捷气泡**（类 iPhone AssistiveTouch）：五项动作 💬 对话（恒首位，R234 扩展侧同构）/〰 生词高亮（background 新增 `ML_HL_TOGGLE` 转发，与 Alt+U 同链路）/🎓 每日学习 /📚 书库 /👤 我的（新标签开 magicbook）；扇区 120°/贴边 90°、半径 74px、弹簧曲线、350ms 延迟关闭、方向自适应——几何与交互逐段移植 magicbook；③**拖拽吸附 + 位置记忆**：pointer-capture 延迟 6px 阈值（R223 真机修法），位置存 `chrome.storage.local` per-hostname（禁污染宿主 localStorage）。验证：node --check 过 + 几何冒烟 12 例全过（径向数学独立复算，初版预期按「向上扇」误算 5 例、复核公式后全绿，生产代码为逐行移植未改）；手工清单追加 ⑧-⑪（头像同步/五气泡动作/拖拽吸附/延迟关闭）。LLD §5 修订版含与 magicbook 的四处刻意分叉表（头像通道/动作集配置性/位置存储/动作语义）。
- **总结**：requests.md 占号 R54（claim.sh `c0e00fd`）；PingCode idea [ML-53 / G8snk5AS](https://haoshenqi.pingcode.com/ship/ideas/G8snk5AS)（Pending → In progress，待验收后 Completed）；response.md 本条；冲突记录：无。

### R55（缺陷：R48 金山直连模块化回归——`icibaLookupWithStemming` 未导出）

- **根因**：R48 把金山直连域从 `background.js` 迁到 `iciba.js` 时，模块公开键写成 `lookupWithStemming`，但 `background.js` 仍按内部函数名解构：
  `const { WORD_PATTERN, icibaLookupWithStemming } = __magicLensIciba;`
  得到 `undefined`。错误只在 `ML_TRANSLATE` 消息回调触发时暴露，因此模块加载与 `node --check` 均不报错；用户划词即看到 `TypeError: icibaLookupWithStemming is not a function`。
- **修复（分支 `feat/r52-buddy-parity` 同树续作，版本 0.8.19-202610272026 测试版）**：`background.js` 改按模块公开键解构并显式别名 `lookupWithStemming: icibaLookupWithStemming`；新增 `scripts/check-extension-modules.js`，在 Node VM 中真实执行 `common.js → rpc.js → iciba.js → background.js`，触发 `ML_TRANSLATE('hello')`，断言直连响应 `{ok:true,data:{text,translation,source:'iciba'}}`。
- **验证（诚实）**：`node --check extension/*.js scripts/*.js` 全过；新守卫通过。**鉴别力对照**：把同一守卫指向修复前 `background.js`（HEAD 版本）会复现 `TypeError: icibaLookupWithStemming is not a function`，证明断言不是自证。未改动金山查词行为、词干口径、缓存或 moon-well 回退。
- **文档四问**：用户可见能力未变 → README 不改；契约边界（模块公开键与 SW 消费键）变了 → L2 `docs/product/design.md` §7 追加更新注记；实现/边界回填 → 新增 L3 `docs/product/features/iciba-direct.md`；本次怎么实现 → LLD `iterations/1.0/r55-iciba-export/lld.md`（状态已回填）。
- **台账**：`requests.md` 占号 R55（claim.sh `872578a`）；worktree `../magiclens-r52-buddy-parity`（分支 `feat/r52-buddy-parity`）merge 后驻留待验收。R48 历史台账缺条按原样保留，不借本轮静默补写。
- **待用户真机验收**：`chrome://extensions` 从该 worktree 重载 → 任意网页划单个英文单词，应正常出词典译文（无 `TypeError`）；再验证 miss 单词仍回退 moon-well、短语翻译不受影响。
- **总结**：response.md 本条；冲突记录：无。本条写入后 response 窗口 11 条，按纪律把最旧的 R47 原样搬至 `response-archive/response-R47.md` 并登记索引。

### R56（缺陷：magicbook 站内悬浮球与 MagicLens 悬浮球重复显示）

- **根因**：magicbook 的 `cps/templates/layout.html` 与阅读器模板全站引入 `ai_chat_panel.html`，宿主 buddy 球本来就存在；MagicLens 的 `ball.js` 又匹配所有 `http/https` 顶层页面。用户开启「常驻入口」后，两个球在右下角重叠。
- **产品口径（宿主页优先）**：`magicbook.haoshenqi.top` 及其子域保留 magicbook 原生球，MagicLens 扩展球自动让位；其他网站继续按用户开关显示扩展球。magicbook 侧零改动。
- **修复（分支 `feat/r52-buddy-parity` 同树续作，版本 0.8.20-202610272114 测试版）**：`common.js` 新增冻结名单 `__magicLensBallYieldDomains = ['magicbook.haoshenqi.top']`，`__magicLensBallVisible` 增加宿主让位条件并复用 `__magicLensIsDisabledHost`，因此覆盖子域且不会误伤 `notmagicbook.haoshenqi.top`。`ball.js` 的 `sync()` 逻辑不变。
- **关于「气泡是否和 magicbook 一样」**：形态已对齐 magicbook R223——buddy 头像、hover 径向快捷气泡、拖拽吸附、位置记忆、350ms 延迟关闭、方向自适应均同构；按 R54 修订版逐段移植。刻意分叉只有四类：头像来源（moon-well `/buddy/catalog` vs 本站 `/ajax/buddy/image`）、动作集（扩展固定五项 vs magicbook 可配置）、位置存储（`chrome.storage.local` vs 页面 localStorage）、网页场景动作语义（高亮开关 + magicbook 导航 vs 阅读页顶栏工具）。
- **验证（诚实）**：`node --check extension/*.js scripts/*.js` 全过；新增 `scripts/check-ball-visibility.js` 加载真实 `common.js`，主域、子域、相似域名、其他网站、iframe、主开关、球开关、用户禁用名单与冻结名单断言全过；`scripts/check-extension-modules.js` 继续通过；`git diff --check` 干净。**真机手工清单待用户**：① magicbook 首页/阅读器只看到宿主球；② 其他网站扩展球正常；③ magicbook 站内划词、高亮、标记与伴读不受影响。
- **文档四问**：用户可见能力变化（站内不再显示扩展球）→ L1 `README.md`；产品/架构决策 → L2 `docs/product/design.md` §17；实现与边界 → 新增 L3 `docs/product/features/ball.md`；本次怎么实现 → LLD `iterations/1.0/r56-ball-yield/lld.md`，并登记 plan MAGICLENS-10。
- **台账**：`requests.md` 占号 R56（claim.sh `9922456`）；worktree `../magiclens-r52-buddy-parity`（分支 `feat/r52-buddy-parity`）merge 后驻留待验收（与 R52/R53/R54/R55 同树）；未 push（正式发布需用户确认后去时间戳 merge release）。窗口轮转：最旧的 R41 原样搬至 `response-archive/response-R41.md` 并登记索引，写入后窗口 10 条。
- **正式发布（2026-10-27，用户指令「发一个 release」）**：测试版 `0.8.20-202610272114` 去后缀为纯 `0.8.20`（commit `750d8f6`），推送 `develop` 后，在临时 worktree `../magiclens-release-0820` 内 `merge --no-ff origin/develop` 成 `2202000` 并 push `release`。Workflow run [40511249301](https://github.com/haoshenqi-family/magiclens/actions/runs/40511249301) 两步均 success；GitHub Release [v0.8.20](https://github.com/haoshenqi-family/magiclens/releases/tag/v0.8.20) 已创建，附件 `magiclens-extension-v0.8.20.zip`（94,859 B，23 个条目）实测可下载且包含 `ball.js` / `iciba.js` / `rpc.js` / `offscreen.js`，manifest 为纯 `0.8.20`。本次正式版覆盖 R52 伴读面板对齐、R53 语音双向、R54 常驻悬浮球、R55 金山模块导出修复、R56 magicbook 站内双球去重。workflow 既有行为未改：tag `v0.8.20` 指向 `develop` 的 `750d8f6`，不是 `release` 的 merge commit。
- **总结**：response.md 本条；冲突记录：无。

### R57（划词仅单词直译，非单词/含中文改为 AI 入框）

- **行为**：单个英文单词继续自动翻译；短语、句子、含中文文本不再自动请求翻译。气泡突出「AI」主按钮，隐藏对普通文本无效的「详/认识/生词」，「译」保留为手动操作。
- **交付（worktree `../magiclens-r57-ai-selection`，分支 `feat/r57-ai-selection`，版本 0.8.21-202610291724 测试版）**：`common.js` 新增 `__magicLensSelectionAction` 统一去向判定与 `__magicLensSelectionWord` 统一取词；`content.js openBubble()` 按判定门控自动翻译、先配置按钮再定位，并在 `translate()` 统一守住 2000 字上限；迟到翻译响应按当前文本作废；`chat.js` 把选区原文直接写入伴读输入框（去掉 `「」` 包装），光标置末尾且不自动发送。
- **验证**：`node --check` 三个改动文件与守卫脚本全过；`scripts/check-selection-ai.js` 覆盖单词、撇号/连字符词、短语、中文、英中混排、数字、标点与空文本，并锁住 `don’t` 的完整取词；R55/R56 守卫继续通过；`git diff --check` 干净。另用本机 Chrome headless 加载真实三份脚本并以 stub 中转层计数——单词只发 1 次 `ml:translate`，短语/中文不新增请求，手动「译」可新增，模式切换后按钮复位，旧翻译迟到响应不覆盖新 AI 提示，2001 字以上手动「译」被拦截，中文 AI 入框值为 `你好世界`（无引号）。真机清单待用户：单词自动译文、短语/中文不发翻译、AI 入框原文一致、iframe 行为一致。
- **交叉审查修正**：补齐 P1「AI 模式手动译绕过 2000 字上限」；修正 P2「弯撇号单词只截出 don」并抽共享取词函数；调整为先配置按钮再测量定位，避免 AI→单词切换按旧宽度裁边；迟到翻译响应增加当前文本校验，禁止覆盖新 AI 气泡。
- **文档四问**：用户可见能力变化 → README；产品决策 → design.md §18；实现边界 → `features/selection-routing.md`；本次实现 → `r57-selection-ai/lld.md`，并登记 plan MAGICLENS-11。
- **台账**：requests.md 占号 R57（claim.sh `992a624`）；PingCode idea [ML-54 / Mr7EGN8B](https://haoshenqi.pingcode.com/ship/ideas/Mr7EGN8B)（In progress，待验收）；worktree merge 后驻留待真机验收。窗口轮转：最旧的 R42 原样搬至 `response-archive/response-R42.md` 并登记索引。
- **总结**：response.md 本条；冲突记录：无。


### R58（用户：「修改一下 github magicbook 和magiclens的 readme。把核心功能 入门用法讲明白」）

- **做了什么**：根 `README.md` 整体重写为「核心功能 + 入门」导向：功能按 划词即查 / 生词管理 / AI 伴读 / 常驻入口 四组表格（吸收 R57 单词直译与 AI 入框新口径，不再按 P0 版本演进流水账）；安装收成五步上手（下载 zip → 开发者模式加载 → Authentik 登录 → 划词试 → 开高亮/悬浮球）；保留 架构图与两条硬约定、API 契约速查表（9 端点）、分发与更新（两段式版本/不上架商店）、隐私（`chrome.storage.sync`）与关联项目。原「当前状态 P0」表的版本考古信息由 LLD/归档承载，README 回归 L1「只讲功能与安装」。
- **口径**：纯文档、无能力变化 → **manifest 版本不递增**（对照 R51 纯文档 push 先例）；0.8.21-202610291724 仍为测试版待真机验收。
- **push 决策（用户拍板）**：README 随本地 r57 的 3 个未 push 提交一起 push `develop`——develop 是默认分支 README 立即生效；不触发 Release（发布闸门在 `release` 分支），且避免远端 README 描述领先于远端代码。
- **上线**：`282236f..8f9f0c2` push `origin/develop`（r57 三提交 + 本次 README + 台账 merge）。
- **台账**：requests.md 占号 R58（claim.sh `282236f`）；merge origin 时 requests.md 冲突按并集解决（本地 57 完成条 + 远端 58 占号行）。magicbook 同题任务见 magicbook 仓 response.md R267（那边连 R262/R264/R265 十个提交一起 push 上线并修了一个预存测试破损）。
- **总结**：requests.md 条目 58 已回填；R43 回应子节按 R42 先例原样搬至 `response-archive/response-R43.md`（父级日期头留在原地包住 R44）并登记索引，本条写入后窗口 10。冲突记录：无。


## 2026-11-08（R59：同步 magicbook 近期功能——悬浮球滚动复习 + 语速三档）

### R59（同步 magicbook R285/R289/R263：悬浮球 SRS 滚动复习轮播 + 回复朗读语速三档）

- **做了什么**：对齐 magicbook 上次同步点（10-27 R52-R54）之后的两个用户可见能力——**A 滚动复习**（R285 词卡轮播 + R289 详情分页）与 **B 语速三档**（R263）；R261 行内 gloss 用户拍板不做（涉及任意网页排版、改动大，且 magicbook 站内已接受「扩展接管高亮时该开关不生效」）。
- **A 交付（`ball.js` + `rpc.js` + `background.js` + `chat.js` 抽屉事件）**：球 shadow root 内 `wrap` 兄弟节点常驻词卡（不进 wrap——径向气泡与拖拽命中区冲突，R285 同源教训）；`ML_REVIEW_QUEUE`→`GET /learning/srs/queue` 20 词洗牌 8s 轮播、「认识」复用 `ML_MARK`→`GET /vocabulary/known/{word}` 按点击瞬间下标删词；`ML_REVIEW_DETAIL_BATCH`→`POST /vocabulary/detail/cached-batch`（moon-well R248 只读缓存零计费）详情分页：每词基本意思前 2 义项 + 随机 1 模块 ≤4 页、line-clamp 3 硬钳、同词连翻、无缓存/端点未发生产/失败三路静默回退简卡；**计费红线**：绝不调 `/vocabulary/detail/{word}`（miss 现场生成计费）；暂停矩阵对齐 R285（页面不可见/气泡展开/抽屉打开/inFlight…），抽屉开合经 chat.js 派发的 `magiclens-chat` 事件感知（closed shadow 唯一通道）；paused/collapsed 走 `chrome.storage.local`（禁污染宿主 localStorage——magicbook 用页面 localStorage 是站内特权不能照抄）；未登录静默隐藏、登录成功（token 落库）自动补拉。
- **B 交付（`chat.js`）**：抽屉头部语速按钮 1.0/0.75/0.5x 循环（R263 顺序），档位 `chrome.storage.local` `magiclens.ttsSpeed`（设备相关体验，不进 sync）；播放分叉：1.0x 恒走原 BufferSource 链路零回归，非 1.0x 走 `<audio>` + `preservesPitch`/`webkit`/`moz` 三连钉变速不变调（Why：BufferSource 只有重采样必变调，`preservesPitch` 是 HTMLMediaElement 专属），blob 被页面 CSP `media-src` 拦时回退 BufferSource 套 `playbackRate`（变调降级好过无声）；换档不打断当前段、下一段生效。
- **⚠ 发版时序**：`cached-batch` 在 moon-well develop（dev 环境），生产 release 尚未携带（2026-11-08 release 落后 develop 22 提交）——扩展直连生产 moon-well，该端点 404 期间详情分页自动回退简卡（与「无缓存词」同一降级路径），moon-well R248 发生产后详情自动生效，扩展无需再发版。
- **集成套件（R185 门禁）**：`matrix/magiclens.csv` +2 行（`ml-ball-review`/`ml-chat-speed`）、`e2e_bridge.py` FEATURES 同步、run.js mock 层补 `/learning/srs/queue` 与 `cached-batch`（fixture：队列两词、批量表 apple 命中/terrible 有意 miss 验简卡分叉）；**坑**：`/vocabulary/detail/` 前缀规则抢配批量端点致前端全量 miss（详情失败不可见口径反而掩盖 mock 配错）——精确规则必须排在前缀之前（已写进 run.js 注释）；悬浮球默认关闭须显式 `sSet ballEnabled:true`；harness 默认装主检出，验 worktree 必须 `--ext`。**实测**：CfT chrome@157 全量 **14/14 pass**（worktree 扩展）、静态守卫 3/3、`guard.py` 三向对账全绿；套件变更已 push ops main（303de4f）。
- **版本**：0.8.21 → **0.8.22-202611082233**（测试版，带时间戳不触发发布）。
- **文档四问**：能力变了吗 → README 功能表 3 处（悬浮球行补滚动复习、语音双向行补语速、契约速查 +2 端点）；实现/边界 → 本 LLD `r59-sync-review-speed/lld.md`（含 4 条踩坑）；本次怎么实现 → 同文件；契约速查以 moon-well 现行代码为准（`LearningController.srs/queue`、`VocabularyController.detail/cached-batch` 均已核对源码）。
- **台账**：requests.md 占号 R59（claim.sh `f18f602`，push 即占）；PingCode idea **ML-55**（J5QST1pL）已建 → In progress；worktree `../magiclens-r59-buddy-review-speed` / 分支 `feat/r59-buddy-review-speed` merge 后**驻留待真机验收**。窗口轮转：写入前含 R44/R50–R58 共 10 条，本条写入达 11，最旧的 R44 原样搬至 `response-archive/response-R44.md` 并登记索引，窗口回 10。
- **总结**：requests.md 条目 59 已回填；本条为回应；冲突记录：无。


## 2026-11-11（R60 注册死链修复 + R61 邀请链接改后端动态获取）

### R60（用户：「检查magiclens 的注册链接是不是失效的那个」→「改」）

- **排查**：`background.js` 的 `ENROLLMENT_URL` 常量（v0.3.1 引入后从未更新）仍指 2026-10-30 过期且已从 Authentik 库删除的旧邀请 `5566492c`——10-23 邀请轮换（新邀请 `1572b336`、过期 2027-01-21、single_use=false）只同步了 magicbook `.env`，扩展侧所有已发布版本（商店 zip 手动装、无自动更新）注册按钮自 10-30 起全是死链。域名 `authentik.haoshenqi.top` 301→`account.haoshenqi.top` 保留 query，域名无罪。
- **修复**：常量换现役邀请 + 域名改 `account.haoshenqi.top` 免 301；manifest 0.8.23-202611111026 测试版（`447eebf` push develop，worktree `magiclens-r60-enroll-url-refresh`）。
- **教训沉淀**：邀请轮换是「magicbook .env + 扩展常量发版」双落点——此教训随即被 R61 从根上消除（见下）。
- **总结**：requests.md 占号 R60（`445febc`）；本条为回应；冲突记录：无。

### R61（用户：「邀请链接改为从后端获取，避免两端不一致。注意这个后端接口要开发白名单，不登录也可以获取」）

- **做了什么**：`ML_REGISTER` 从「硬编码常量」改为运行时获取 moon-well 匿名端点 `GET /auth/enrollment-invite`（对端 moon-well R250：Nacos `app.auth.enrollment-invite-url` 真值源，热重绑，轮换改后端一处即全端生效）；**删除 `ENROLLMENT_URL` 内置常量**——保留即残留漂移面，违背真值收敛初衷；失败不静默（options 结果区 `showResult` 明示原因）。Why 匿名直连不走 callApi：其「无 token 即拒」闸门与注册按钮场景（未登录态）冲突，也不透传本地令牌避免无谓 401/静默刷新链。
- **测试**：本项目无自动化测试框架——`node --check` 双文件语法过、旧 token 全仓零残留、manifest JSON 合法；集成套件侧语义用例落在 moon-well R250 的 `mw-get-auth-enrollment-invite`（dev 12/12 全绿），magiclens 矩阵 14 行无 ML_REGISTER 独立行（消息行为=开浏览器标签，非 API 契约，无需增行）。
- **验收（用户真机）**：`chrome://extensions` 加载 `magiclens-r60-enroll-url-refresh/extension/` → 设置页点「注册」→ 应打开邀请流程页进入表单；断网/后端不可达时应看到 `✗` 错误文案而非无反应。
- **部署**：`b43ad2f..f709a89` push `origin/develop`；0.8.24-202611111044 测试版（不触发发布）；正式版待用户验收后去时间戳 merge `release`。
- **运维口径**：邀请轮换从此=Nacos 键（热重绑）+ magicbook `.env`（登录页）两处同步——扩展侧零动作。
- **总结**：requests.md 占号 R61（`b43ad2f`）；本条为回应；冲突记录：无（与 R60 同树续作，一次会话一树）。

## 2026-11-13（R62：发布正式版 v0.8.24）

### R62（用户：「release magiclens」）

**回应**：执行两段式正式发布（AGENTS.md §0.2），把 develop 上的 R59/R60/R61 三个测试版（0.8.22→0.8.24）合成正式版 **v0.8.24** 发布。

- **发布前验证（正式发布态）**：家族套件 magiclens T1 **17/17 PASS 全绿**（含 R59 的 ml-ball-review 悬浮球滚动复习 1263ms/intercepted=9 与 ml-chat-speed 语速 E2E 实测；无 FAIL 无 SKIP）；`guard.py` magiclens 矩阵 14 行缺口 0——另报出 4 条 **moonwell** 缺口（`/yakka/*` 端点在 dev /v3/api-docs 出现但矩阵未收）系**另一会话在途的 moon-well 新模块**，与 magiclens 无关、不拦本次发布，已如实登记待该任务收口。
- **发布动作**（worktree `../magiclens-r62-release-v0824`，R36 先例）：① `28a1075` chore(release) 去时间戳后缀（`0.8.24-202611111044` → `0.8.24`）push develop；② release 头（2202000）上 `--no-ff` merge develop → `f03fcc3` push release（release 分支含 v0.8.20 独有提交，非 FF，须在 release 头上合）；③ `release.yml` 自动跑成功（16s）。
- **发布产物验证**：GitHub Release **v0.8.24**（Latest）已建，资产 `magiclens-extension-v0.8.24.zip`，changelog `v0.8.20...v0.8.24`（涵盖 R57 划词直译/R58 README/R59 悬浮球滚动复习+详情分页+语速三档/R60+R61 注册链接两修）。
- **驻留**：worktree `../magiclens-r62-release-v0824`、分支 `chore/r62-release-v0824`（已全部推远端），与 R59/R60/R61 驻留一同待用户装 v0.8.24 实测后清理。

**台账总结**：`requests.md` 第 62 条占号（5c69f6c）本处回填；`response.md` 写入前 12 节（历史欠账），本次压回 10 节，最旧 R50–R52 原样搬入 `response-archive/response-R50-R52.md` 并登记索引。

## 2026-11-13（R63：缺陷——滚动复习词卡报 unknown message type）

### R63（用户：「fix this bug」+ 截图：滚动复习词卡红字 unknown message type + 重试）

- **现象**：悬浮球旁「滚动复习」词卡整卡变红字 `unknown message type`，「重试」恒失败；同页其它功能（划词、高亮、伴读）正常。
- **根因（实测证据，非 R59 代码回归，是 SW 与 content script 版本错位）**：报错串全仓唯一来源是 `background.js` 的 `default` 分支；词卡拉队列只发 `ml:review-queue`（R59 新增类型）。Chrome（Default profile）加载的是解包扩展 `magiclens/extension`，而其 **SW ScriptCache 仍是 2026-10-29 的构建**——`rpc.js` 的 MSG 表没有 `ML_REVIEW_QUEUE`、`background.js` 仍含 R61 已删除的 `ENROLLMENT_URL` 常量，整个 ScriptCache 目录 grep `ml:review-queue` 命中 0；对应 V8 code cache 时间戳却是 2026-11-13 16:14，说明今天 SW 被唤醒时仍在跑旧脚本。content script 则是每页从磁盘重读的，所以页面里是 R59 之后的新版（词卡在）→ 新类型落到旧 SW 的 `default`。MV3 解包扩展改消息表后，SW 只有在 `chrome://extensions` 重新加载或扩展更新时才重新注册，SW 脚本缓存（含 `importScripts` 的 `rpc.js`）会把旧构建一直沿用。
- **处置 A（根因动作，用户侧 2 步）**：`chrome://extensions` → MagicLens 词镜 → **重新加载** → 刷新出问题的页面，词卡即恢复。
- **处置 B（代码加固，本次提交）**：`ball.js` 新增 `reviewErrorText()`，把 `unknown message type` / `Extension context invalidated` 两类环境错误翻成可行动中文（「扩展版本未同步：请在 chrome://extensions 重新加载扩展，再刷新本页」/「扩展已更新，请刷新本页后重试」），业务错误（积分不足/超时/401 话术）原样透出——不静默降级；`background.js` 的 `default` 回带 `type` 便于 console 定位，错误串前缀保持不变；版本 0.8.24 → **0.8.25-202611131705** 测试版（带时间戳不触发发布；合并时与并行 R64 撞 0.8.25，按推送序顺延 **0.8.26-202611141315**）。
- **验证**：`node --check` 双文件过、`manifest.json` JSON 合法；`reviewErrorText` 抽源码实跑 5 例断言全过（unknown→重载指引、invalidated→刷新指引、积分不足原样透出、空串兜底、「重新加载」关键词）；确认 `background.js` default 回带 `type`。**真机待用户按处置 A 验收**：重载扩展 + 刷新后词卡正常轮播。
- **文档四问**：能力未变（仅错误话术）→ README 不动；契约未变（无新消息类型/新端点）→ design.md 不动；实现/边界 → LLD `iterations/1.0/r63-review-sw-skew/lld.md`；本次怎么实现 → 同文件。集成矩阵无新行（不新增/修改路由与特性，guard 三向对账不触发）。
- **教训**：本仓新增消息类型的验收必须「**先 `chrome://extensions` 重新加载，再刷新页面**」——只刷新页面会得到「新 content script + 旧 SW」的假失败（与 R62「harness 默认装主检出、验 worktree 必须 `--ext`」同类：验收前先确认被测的是哪一版构建）。
- **台账**：requests.md 占号 R63（claim.sh `0931667`，已 push）；worktree `../magiclens-r63-review-sw-skew`、分支 `fix/r63-review-sw-skew`，已 merge 本地 develop；**2026-11-14 用户令与 R64 一并 merge develop 并 push**（合并版顺延 0.8.26-202611141315），按 ops R187 merge 即清口径，其 worktree/分支待 worktree-doctor 巡检清理；窗口轮转：写入前 R53–R62 共 10 条，R53 原样搬至 `response-archive/response-R53.md` 并登记索引，窗口回到 R54–R63 共 10 条。
- **总结**：本条为回应；冲突记录：无。

## 2026-11-14（R64：登录成功回调页不自动关闭修复）

### R64（用户：「✓ MagicLens 登录成功 / 令牌已自动保存，本窗口稍后自动关闭。然后一直没有关闭」）

- **做了什么**：登录成功回调页的两条关闭链路（background 收 ML_LOGIN_OK 后 2.5s `chrome.tabs.remove` 为主、content 3s `window.close` 为兜底）双双哑火，断点是同一处——`oidc-callback.js` 引用裸 `MSG`，而 `MSG` 从非全局（rpc.js 只挂 `__magicLensRpc`，全仓口径 `const MSG = __magicLensRpc.MSG`）；R47（906e232）迁独立 content script 时把裸引用带了过来、解构行丢了。ReferenceError 抛在 `chrome.storage.sync.set` 异步回调里、外层 try/catch 接不住：横幅照常渲染（用户看得到「登录成功」），但 ML_LOGIN_OK 发不出、兜底定时器不注册、background 永不 `tabs.remove`，标签页永久停留。修复：① storage 回调内解构 `MSG`（异步执行时两条注入条目的 rpc.js 必已落定；刻意不放 IIFE 顶层——条目顺序变动会先崩、连令牌捕获一起丢）；② `sendMessage` 包 try/catch，发送失败不吞兜底定时器；③ manifest 回调条目显式先注入 `rpc.js`（依赖显式化，不借道 catch-all 条目的注入）。潜伏期自 2026-10-15（token 90 天有效、登录罕见故一直未炸）。
- **测试**：`scripts/check-extension-modules.js` +1 段回调页契约——VM 按 manifest 注入顺序真实执行 rpc.js → oidc-callback.js，锁「存令牌→渲染横幅→发 ML_LOGIN_OK（类型取自 MSG 表）→注册兜底定时器」链路；storage 回调按浏览器语义异步投递（同步调用会被外层 try/catch 接住，掩盖真实失败形态——首版测试即踩此坑）；**旧版缺陷回放 FAIL 证明守卫有效**（0c4b792 旧文件换入重跑 = `ReferenceError: MSG is not defined` 复现 + 套件 exit 1，恢复修复版全绿）；node --check + manifest JSON 合法性过；本套件之外 T1 手工矩阵无登录回调独立行（真机验收覆盖）。
- **验收（用户真机）**：`chrome://extensions` 加载本 worktree `extension/` → 设置页「登录」→ Authentik 登录完成 → 回调页应显示「✓ MagicLens 登录成功」并在约 2.5-3s 内自动关闭（修复前永不关闭）；回 options 页登录状态应已刷新。
- **部署**：`0c4b792..dd08928` push `origin/develop`（R64 先行，0.8.25-202611141302 测试版）；2026-11-14 用户令「merge 到 develop」——R63（5805c32/d45b580）与 R64 在主检出正式合并推送，合并结果顺延 **0.8.26-202611141315**（含两修）；正式版随下一轮发布去时间戳 merge `release`。
- **总结**：requests.md 占号 R64（`0c4b792`）本条为回应；冲突记录：R63 并行会话同日开发且测试版同递增至 0.8.25——其提交（5805c32/d45b580）驻主检出树尚未 push，曾致主检出试合并 manifest 冲突（即时 abort，未留痕）；R64 先以纯快进推上 origin/develop；同日用户令合并，已在合并中把撞号顺延为 0.8.26（R63 修复同车），其台账撞号条目（Worktree 纪律修订）重编为 65。
