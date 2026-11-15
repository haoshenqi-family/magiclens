# response-R54（原样搬移）

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
