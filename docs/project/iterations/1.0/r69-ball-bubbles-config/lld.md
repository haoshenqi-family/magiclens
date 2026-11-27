# LLD — R69 悬浮球气泡功能逐项配置（registry 单源 + 守卫双锁）

> 状态：**开发完成待真机验收**（2026-11-15；分支 `feat/r69-ball-bubbles-config`；版本 0.8.30-202611152156 测试版）
> 来源：用户需求「buddy 整页翻译 回顾等气泡功能都要能在悬浮球那里配置。代码层面写清楚，避免下次再犯」——R54 头注释登记的「可配置性 LLD 遗留」清账（R67 的 🌐 气泡再次硬编码印证了欠账）。配置入口用户拍板：**设置页「悬浮球」区块**。

## 1. 决策

- **注册表单源进 common.js**（R46 默认值单点旁）：`__magicLensBallActions`（frozen，`{id, icon, label, cfgKey}` 纯数据，6 条目）+ `__magicLensDefaults` 新增 7 布尔键（`bubbleChat/bubbleHighlight/bubblePageTranslate/bubbleLearning/bubbleLibrary/bubbleMe/ballReview`，**默认全 true=升级零变化**）。Why 表只放纯数据：options 页不加载 ball.js（common.js 单文件可独立求值），而 run 处理器依赖 ball.js 的 MSG/SITE/`__magicLensAsk` 作用域——数据与行为分层，配置 UI 与渲染各自消费同一单源。
- **纪律写进代码**（注册表注释 ⚠️ 三条）：① 新增/下线气泡只改注册表，cfgKey 必须走 `bubble*`/`ballReview` 前缀（前缀即契约，双锁按前缀对账）；② ball.js 的 RUNS 表按 id 补处理器，**禁止私挂字面量 ACTIONS**；③ options.js 循环注册表渲染配置 UI，**禁止手抄清单**。「避免下次再犯」的执行机制=check-ball-visibility.js 双锁（见 §4），违反即挂。
- **渲染过滤**：ball.js `ACTIONS = registry.map(+RUNS[id])`，`build(cfg)` 内 `activeActions = ACTIONS.filter(cfg[a.cfgKey] !== false)`——build 是气泡 DOM 的唯一装配点（R223 命名监听纪律：重复 init 会累积监听，所以**配置变更走 remove()+build(cfg)+applySavedPosition() 整体重建**，不就地增删；位置从 storage.local 恢复无损，teardownReview 级联拆复习卡）。
- **即时生效**：storage.onChanged 盯全部视觉键（enabled/ballEnabled/disabledDomains/各 bubble*/ballReview），`sync()` 内按 `visualSignature`（这些键的 JSON 签名）判断是否真重建——**token 等非视觉键刻意排除**（token 刷新不引发重建）；未变化不重建，避免无谓 flicker。
- **FAB 本体点击跟随配置**：chat 启用→开抽屉（原行为）；chat 被关→第一个启用气泡的动作兜底；**全关→发 `ML_OPENOPTIONS` 开设置页**（与 popup「设置」同一链路，给用户留「重新开启」的回路）。Why 读过滤后的 `activeActions` 不读全量 ACTIONS：过滤集才是本页真实可用面。
- **滚动复习词卡门控**：`cfg.ballReview !== false` 才 `initReview()`——关闭=整个子系统不激活（卡片 DOM 保持 hidden、零队列请求）；既有暂停/收起（storage.local）语义不变，两者独立。恢复开关=重建路径自动重新 initReview。
- **零气泡早退**：`openBubbles()` 无气泡直接 return——Why 不只是省几何计算：`bubbles-open` 类还承担「展开时复习卡让位」（`.wrap.bubbles-open ~ .rvw`），空展开会白白隐藏词卡。

## 2. options「悬浮球」区块

- html：ballEnabled 行下追加 `#bubbleToggles` 容器（注释注明由注册表渲染）+ `#ballReview` 行 + hint（关闭语义：hover 不再出现对应气泡；全部关闭时点球本体直达设置页）。
- js：循环 `__magicLensBallActions` 逐项渲染 checkbox（`data-cfg-key` 可查），change 直写对应键；沿用域名管理的「storage 为唯一事实源」模式——get 渲染、change 直写、onChanged 只在悬浮球相关键变化时重渲染（两个 options 标签/跨设备互不打架）。

## 3. 守卫双锁（check-ball-visibility.js 增补）

- **锁 A（common.js 同一 VM 对账）**：注册表每条目 id/icon/label/cfgKey 齐全、cfgKey 走前缀契约、`defaults[cfgKey] === true`（升级零变化）；反向——defaults 所有 `bubble*` 键必须回指唯一注册表条目（`ballReview` 是词卡开关不是气泡，单独断言默认 true，不参与气泡双向对账——首版把 ballReview 也塞进反向锁被自己的守卫打回，口径修正即本锁的活证据）。
- **锁 B（ball.js / options.js 文本断言）**：ball.js 必须引用 `__magicLensBallActions`；`const ACTIONS = [` 字面量必须不存在（防私挂清单复活）；每个注册表 id 在 ball.js 有 `RUNS` 处理器行（正则 `^\s*'?<id>'?\s*:\s*\(\)`）；options.js 必须引用注册表与 ballReview（防配置 UI 手抄漂移）。

## 4. 测试

- `node --check` 全部 extension/*.js + scripts/*.js 过；check-ball-visibility（含双锁，输出 `6 actions two-way locked`）/ check-selection-ai / check-extension-modules 全绿。
- 集成套件（同任务内）：matrix/magiclens.csv +1（ml-ball-bubbles，17 行）+ e2e_bridge +1 + run.js 特性用例——基线 6 气泡+队列请求 → sSet 关 2 个 → 计数 4 且 `dataAction` 缺席/在场断言 → ballReview:false 后 800ms 内零队列请求 → 恢复后词卡复活（重发请求）→ 气泡计数回 6；`guard.py` 三向全绿；浏览器全特性回归 17/17（含并行 R68 的 ml-control-selection）；runner magiclens 20/20。
- 手工 AC（真机）：设置页出现逐气泡开关与词卡开关；关某气泡 hover 悬浮球立即少一项（已打开页即时生效，无需刷新）；全关后点球本体落到设置页；词卡关闭后消失且不再轮询；重开恢复；升级用户（默认全 true）行为零变化；FAB 兜底链（关 chat→点球开第一个启用气泡功能）。

## 5. 版本漂移插曲（并行会话）

占号时 R68 已被并行会话占走（本条顺延 69）；R68（划词链路加固）已把 manifest bump 到 0.8.29——本条按语义化 +1 落 **0.8.30-202611152156**。两改动文件不相交（R68 动 content.js/selection-relay，本条动 common/ball/options/check-ball-visibility），分支基于含 R68 的 origin/develop HEAD 切出，无冲突。
