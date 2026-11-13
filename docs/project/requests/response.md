# response.md — 对话回应记录（仅保留最近 10 个 request 的回应）

> 归档索引：[response-R1-R10.md](response-archive/response-R1-R10.md) · [response-R11-R15.md](response-archive/response-R11-R15.md)（2026-10-07 R25 完成时补执行 R10/R20 漏掉的归档） · [response-R16.md](response-archive/response-R16.md)、[response-R17-R18.md](response-archive/response-R17-R18.md)（2026-10-08 R28 收口时搬移） · [response-R19.md](response-archive/response-R19.md)（2026-10-08 R29 完成时搬移） · [response-R20.md](response-archive/response-R20.md)（2026-10-08 R30 完成时搬移） · [response-R21-R22.md](response-archive/response-R21-R22.md)（2026-10-08 R32 完成时搬移） · [response-R23-R24.md](response-archive/response-R23-R24.md) · [response-R28.md](response-archive/response-R28.md) · [response-R25.md](response-archive/response-R25.md)（2026-10-10 R35 完成时搬移） · [response-R26.md](response-archive/response-R26.md)（2026-10-10 R36 写入触发轮转搬移） · [response-R27.md](response-archive/response-R27.md)（2026-10-10 R38 写入触发轮转搬移） · [response-R29.md](response-archive/response-R29.md)（2026-10-11 R40 写入触发轮转搬移） · [response-R30-R31.md](response-archive/response-R30-R31.md)（2026-10-11 R41 集成时窗口超限搬移） · [response-R32.md](response-archive/response-R32.md)（2026-10-13 R43 写入触发轮转搬移） · [response-R33.md](response-archive/response-R33.md)（2026-10-14 R44 写入触发轮转搬移） · [response-R34.md](response-archive/response-R34.md)（2026-10-15 R45 写入触发轮转搬移） · [response-R35-R38.md](response-archive/response-R35-R38.md)（2026-10-16 R50 写入触发轮转搬移，窗口回 10 条 request 内） · [response-R41.md](response-archive/response-R41.md)（2026-10-27 R56 写入触发轮转搬移） · [response-R45.md](response-archive/response-R45.md)（2026-10-21 R51 写入触发轮转搬移） · [response-R39.md](response-archive/response-R39.md)（2026-10-27 R52 写入触发轮转搬移） · [response-R46.md](response-archive/response-R46.md)（2026-10-27 R53 写入触发轮转搬移） · [response-R40.md](response-archive/response-R40.md)（2026-10-27 R54 写入触发轮转搬移） · [response-R47.md](response-archive/response-R47.md)（2026-10-27 R55 写入触发轮转搬移） · [response-R42.md](response-archive/response-R42.md)（2026-10-29 R57 写入触发轮转搬移） · [response-R43.md](response-archive/response-R43.md)（2026-11-02 R58 写入触发轮转搬移） · [response-R44.md](response-archive/response-R44.md)（2026-11-08 R59 写入触发轮转搬移）

## 2026-10-16（R50：docs v2 迁移——单模块退化形态）

### R50（用户指令「moon-well 和 magiclens 也整理 docs」：家族文档架构 v2 试点第三仓）

- **范围**：纯文档结构迁移（`git mv` + 链接 / 口径改写），**零代码行为改动**——`extension/` 只动了 `background.js` 一行 Javadoc 里的文档路径；manifest 版本未递增，不触发发布。
- **前置处置（用户拍板「先原样提交再迁移」）**：主检出在途未提交的台账与文档先原样落库（commit `888a84e`）——requests 补落 R45/R46/R47/R49 四条、response 补 R45/R46/R47 三条回应、design.md §15/§16、架构评审 overview 状态行、R34 归档。「原样」提交：R48 台账条目仍缺这一既存缺口也照原样保留（见 R49 条目自述）。
- **窗口轮转（本条写入触发）**：写入前 response.md 实含 12 个 request（并行会话插入 R45–R47 时未按纪律轮转，窗口已超限）；本条写入前先把最旧的 R35 / R36 / R38 三节原样搬至新建的 `response-archive/response-R35-R38.md` 并登记索引（与占号同 commit `786961b`），窗口回 10 个 request（R39–R44 / R45–R47 / R50）。
- **物理搬迁（`git mv`，内容不改写）**：本仓为**单模块纯前端扩展**，按 v2 **退化形态**落地——**L1 仍是根 `README.md`**（不建 `docs/product/readme/`，不为目录对称把单模块硬拆）；`docs/design.md`（L2 ADR 兼任）→`docs/product/design.md`；`docs/feat/`（5 个：arch-review-2026-10 / chrome-extension / domain-management / vocab-highlight / word-detail）→`docs/project/_legacy/feat/`（**冻结归档、不回溯**）；`docs/webstore/listing.md`→`docs/product/webstore/listing.md`（产品级静态）；仓库根 `requests.md` / `response.md` / `requests-archive/` / `response-archive/`→`docs/project/requests/`。
- **链接口径**：脚本改写 8 条（`./docs/design.md` → `docs/product/design.md`、`./feat/...` → `../project/_legacy/feat/...` 等）+ 手工修 5 条随迁移变深 / 变浅的根文件相对链（`docs/product/design.md` 与 `docs/product/webstore/listing.md` 指向 `PRIVACY.md`、`.github/workflows/release.yml`）。改后 `docs/product`、`README.md`、`AGENTS.md` 相对链接存在性校验 **0 坏链**。代码侧同步 1 处（`extension/background.js` Javadoc）。
- **文档改写**：`AGENTS.md` 文档规范节整体改 v2 **退化形态**（L1 = 根 `README.md` / L2 = `docs/product/design.md` ADR 兼任 / L3 = `docs/product/features/<FEATURE>.md`；工作项目录标准结构；其他目录表；「交付四问」），工作流目标路径、前置阅读（补 L1/L2 入口）与「对话记录」节路径同步。
- **占号与基线**：台账占号 **R50**（全史最大 49 + 1，49 为家族迁入 PingCode 条目）；worktree 从本地 `develop` 切出（与 `origin/develop` 同点，0/0）。
- **未做 / 待决**：① Wiki 镜像重刷与前两仓同批**暂缓**（用户拍板）；② `docs/product/features/`（L3）与 `docs/project/iterations/` 从新工作开始建；③ 本仓无 `docs/tasks/`，未新建 `docs/project/tasks/`。
- **验证**：目录树与 `git status` 复核；相对链接存在性脚本 0 坏链；`AGENTS.md` 三处路径口径自检；`extension/` 无行为改动（无需手工清单全跑）。
- **收尾**：merge 本地 `develop`；worktree `../magiclens-docs-v2` 与分支 `refactor/r50-docs-v2` **原样保留待验收**（本仓验收方式 = `chrome://extensions` 加载该目录实测；本轮零代码改动，验收以目录与文档口径复核为主）。push 一条另行待批。

### R51（发布链纯文档跳过打包发布）

- **范围**：用户指令「修改一下部署脚本，如果只有文档更新，则不触发部署」；四仓同源 + 「触发但跳过」两口径拍板。本仓无部署产物，对应的是 `release` 分支的**发布**流程。
- **改动**：`.github/workflows/release.yml` 新增 `changes` job（compare API 取本次 push 改动文件 + 文档口径正则），`release` job 加 `needs` / `if` 门禁；纯文档 push 到 `release` 时打包 zip 与 GitHub Release 创建整体跳过，step summary 留痕。
- **文档口径**：`docs/`、`doc/` 下任意文件、`*.md`、`LICENSE`、`.gitignore`、`.gitattributes`；判定失败 / 首次推送一律走原判定（安全侧）。
- **验证**：YAML 解析通过、`bash -n` 通过、桩响应端到端 5 例符合预期（纯文档 true，其余 false）。
- **驻留**：worktree `../magiclens-doc-skip-deploy`，分支 `chore/r51-doc-skip-deploy`，合并 commit `875166e`（本地 `develop`，未 push）。

### R52（伴读抽屉对齐 magicbook R232/R233：回复不显示 token 用量、站内链接新窗口可点）

- **背景**：用户指令「阅读近期 magicbook 的能力提升，同步到 magiclens」。盘点 magicbook 2026-10-26 批次：R232（伴读面板隐藏 token 用量）在本仓有**已登记遗留**（magicbook R232 LLD §5 点名 `chat.js` onFinal 的 `tokens x+y`，彼时「只记录、不夹带修改」）；R233（AI 回复站内链接可点、新窗口）同期上线；R234（悬浮球快捷动作 chat 钉首位）本仓无快捷动作 UI，**不适用**。
- **交付（worktree `../magiclens-r52-buddy-parity`，分支 `feat/r52-buddy-parity`，版本 0.8.15-202610271026 测试版）**：
  - `common.js`：新增 `__magicLensSiteOrigin` 常量（`https://magicbook.haoshenqi.top`）与 `__magicLensAssistantHtml()` 助手消息安全渲染器（纯函数，node 可直测）——安全口径逐条移植 magicbook `ai_chat.js` R233：先整段转义再受控还原、href 白名单归一化（拒控制字符/反斜杠/`//host`/外部 origin/userinfo/非 http(s)）、`target="_blank" rel="noopener noreferrer"`、围栏代码隔离、尾随标点出链。**三处刻意分叉**：① origin 用常量（content script 的 location 是宿主页）；② href 写绝对地址（相对路径会解析到宿主页 origin）；③ 裸路径 token 只吃 ASCII（上游字符类放行 CJK，`/credits，或者` 会被整段吞进 href；本仓顺带修掉、未回提上游）。
  - `chat.js`：`onFinal` 删 token 用量展示（`usage` 不再消费；`conversationId` 回填与非 COMPLETED 状态提示保留——R232 守卫口径「删用量不许顺手删分支」）；流式原文缓冲 `acc`，final 与历史渲染统一走渲染器（历史里书内会话的 `/book/N` 同样可点）；抽屉 CSS 补链接/代码样式。
  - moon-well 零改动：`final` 帧 `usage` 照旧下发，扩展只是不消费；用量唯一入口 = magicbook 设置·积分。
- **验证（诚实）**：`node --check` 两文件全过；渲染器 node 冒烟 23 例全过（链接/CJK 断词/标点出链/同源归一/query·fragment 保留/外链·`//host`·`javascript:`·userinfo·反斜杠·控制字符拒绝/HTML 转义/代码块隔离/粗体/换行/空串/注入 origin 隔离）；**真机手工清单待用户**：从本 worktree 重载扩展 → ① 回复气泡下不再出现 `tokens x+y`；② 让 AI 给本站链接（如「我的积分页在哪」），点击新窗口打开 magicbook 对应页；③ 历史会话里的旧回复同样可点链接、无 token 行；④ 代码块与外链仍为文本。
- **文档**：README 功能表回填；LLD `iterations/1.0/r52-buddy-parity/lld.md`；迭代 `plan.md` 增 MAGICLENS-6。
- **台账**：worktree `../magiclens-r52-buddy-parity`（分支 `feat/r52-buddy-parity`）merge 后驻留待验收，验收通过后 remove + branch -d；未 push（push develop 不触发发布；正式发布需用户确认后去时间戳 merge release）。窗口轮转：本条写入前已把最旧的 R39 原样搬至 `response-archive/response-R39.md` 并登记索引，写入后窗口 10 条未超限。
- **总结**：requests.md 占号 R52（claim.sh `e56575e`）；PingCode idea [ML-51 / 6Lljn2pb](https://haoshenqi.pingcode.com/ship/ideas/6Lljn2pb)（Pending → In progress，待验收后 Completed）；response.md 本条；冲突记录：无。

### R53（伴读抽屉语音双向，对齐 magicbook R227：麦克风转写输入 + 回复朗读）

- **背景**：用户对 R52 汇报的拍板「要做」。R227 双向口径承接：录音→16k wav→ASR 转写→**追加**输入框不自动发送；每条助手回复「🔊 朗读本条」手动点，≤1800 字分段顺序播，`/tts/speak` 听=消费、不带书籍上下文落 7 天临时档。moon-well/magicbook 零改动。
- **交付（分支 `feat/r52-buddy-parity` 同树续作（家族口径第 7 条），版本 0.8.16-202610271104 测试版，manifest permissions + `offscreen`）**：
  - **录音宿主 = offscreen 文档**（D1）：content 录音要逐站点授权麦克风、http 页拿不到 getUserMedia，SW 无 DOM；offscreen 属扩展 origin 一次授权。消息两套：`ml:rec-start/stop/cancel`（content→SW）与 `ml:rec-go/done`（SW→offscreen 转发）——content 的 runtime.sendMessage 广播到全部扩展上下文，offscreen 只认自己那组、其余不回话；popup/options/content/highlight 四处监听器逐一核实不会抢响应。
  - **采集核心移植 magicbook learning-voice.js**（D2）：16k wav 采集端编码（webm/opus 兼容性存疑不用 MediaRecorder）、R159 全静音 −46dB 判定、R158 失败必复位；新增 5 分钟硬顶（停采保音频 + 清引用，content 计时同步封顶）。
  - **播放 = Web Audio + 字节走消息通道**（D3）：SW 取 TTS 二进制转 base64 回传，content 解码播放——比 magicbook 的 CSP 规避更彻底，宿主页 media-src/connect-src 都不占用；自动播放拦截/suspended/老 Safari 回调形态三处兼容照搬。
  - **background 抽出 `callMoonWellRaw`**（D4）：鉴权+超时+401 静默刷新单点，callApi（JSON）委托之，ASR（multipart）与 TTS（二进制）复用同分支；TTS 失败体 Result 信封必带出 message（积分不足不伪装成播放器坏了）；TTS 超时 180s（本地 Qwen3-TTS 分钟级）、ASR 60s。
- **验证（诚实）**：node --check 五文件全过；node 冒烟 22 例全过（分段边界×8、base64 跨块往返、**encodeWav 抽源码实跑**校验 RIFF 头/16k/16bit/样本数）；MSG 表 23 键引用一致；callApi 重构 diff 逐行自审（retried 守卫保留）。**真机手工清单待用户**：①🎤 说一句→停止→转写进输入框可编辑发送；②首次授权只弹一次；③🔊 出声/再点停止；④长回复「朗读中 n/m」；⑤关抽屉朗读立停；⑥积分不足报「积分不足」。
- **文档**：README 功能表与 API 契约表回填（`/tts/speak` 转「部分接入」+ 补 ASR 行）；LLD `iterations/1.0/r53-buddy-voice/lld.md`；迭代 plan.md 增 MAGICLENS-7。
- **台账**：worktree `../magiclens-r52-buddy-parity`（分支 `feat/r52-buddy-parity`）merge 后驻留待验收（R52+R53 两批一起验）；未 push（正式发布需用户确认后去时间戳 merge release）。窗口轮转：最旧的 R46 原样搬至 `response-archive/response-R46.md` 并登记索引，写入后窗口 10 条。
- **总结**：requests.md 占号 R53（claim.sh `f9805c8`）；PingCode idea [ML-52 / 1nxbdoBF](https://haoshenqi.pingcode.com/ship/ideas/1nxbdoBF)（Pending → In progress，待验收后 Completed）；response.md 本条；冲突记录：无。

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
