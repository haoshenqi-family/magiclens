# LLD — R54 常驻入口悬浮球（设置开关 + 首次安装引导选择）

> 状态：**已 merge 本地 develop，待真机验收**（2026-10-27）
> 来源：用户需求原话「添加一个常驻入口，可以用户选择是否开启常驻。首次安装插件的时候，
> 提示用户选择。」背景：R52 汇报指出 magiclens 的伴读抽屉唯一入口是划词「问 AI」
>（无悬浮球/快捷键），用户拍板补常驻入口。worktree 沿用 r52 驻留树（家族口径第 7 条）。

## 1. 需求拆解与决策

| 需求 | 落地 |
| --- | --- |
| 常驻入口 | 网页右下角固定悬浮球（44px 圆钮，AI 字样），点击 `__magicLensAsk('')` 打开伴读抽屉（不划词也能聊） |
| 用户可选是否开启 | 设置页「常驻入口」复选框（`ballEnabled`，**默认关闭**）；实时显隐挂 `storage.onChanged`，已打开页面无需刷新 |
| 首次安装提示选择 | 安装时 background 既有 `onInstalled(install) → openOptionsPage()` 自动打开设置页；页首引导卡片（`ballAsked=false` 时显示）「开启常驻入口 / 暂不开启」二选一，表态后（`ballAsked=true`）永不再问 |

关键取舍：
- **默认关闭**：常驻悬浮球是侵入性 UI，未经选择不突现；存量用户升级（`onInstalled=update`，
  不自动开设置页）后行为零变化，想要时设置页自行打开。引导卡片对老用户也在——他们哪天
  进设置页仍会被问一次。
- **`ballAsked` 独立成键**：区分「没问过」与「用户选了不开」；开关翻动、引导二选一都同时落
  两个键，避免「关了开关又被问一遍」。走 `storage.sync`：换设备装上后不再重复问、开关状态
  跨设备一致。
- **球压在抽屉遮罩 z-index 之下**（2147483645 < 遮罩 2147483646）：抽屉打开时球被半透明
  遮罩盖住，不出现穿层浮球。
- **v1 不做拖拽换位**（遗留）：固定右下角 18px；要拖拽需加位置持久化与指针事件处理，另立需求。
- popup 快捷开关不做（设置页 + 引导已满足「用户选择」，popup 需要可另立需求）。

## 2. 实现落点

| 文件 | 改动 |
| --- | --- |
| `extension/ball.js` | 新增（content script，manifest 组 2 末位=仅顶层文档）：closed Shadow DOM 圆钮；显隐判定走 common.js 纯函数；`storage.onChanged` 实时显隐；rpc `onInvalidated` 失效退役（扩展重载后旧球自行摘除，R39 口径） |
| `extension/common.js` | 默认值单点增 `ballEnabled: false` / `ballAsked: false`；新增 `__magicLensBallVisible(cfg, host, isTop)` 纯函数（主开关 × 球开关 × 顶层 × 域名管理名单，名单匹配复用 `__magicLensIsDisabledHost`） |
| `extension/options.html` | 页首引导卡片（`#ballAsk`，indigo 高亮）；「常驻入口」复选框字段（`#ballEnabled`） |
| `extension/options.js` | 引导卡片显隐（`ballAsked`）+ 二选一落库；复选框 change 落库（均写 `ballEnabled+ballAsked`） |
| `extension/manifest.json` | 组 2 content_scripts 末位加 `ball.js`；`0.8.17-202610271714` 测试版 |

为什么不塞进 content.js：划词引擎已是 688 行巨石（L2 阶段二拆分在案），常驻入口是独立
关注点；同隔离世界直接复用 chat.js 的 `__magicLensAsk` 钩子，零新消息类型、零 background 改动。

## 3. 验证

- `node --check`：common.js / ball.js / options.js 全过；
- node 冒烟 **10 例全过**：全开可见 / 球关隐藏 / 主开关关隐藏 / iframe 隐藏 / 禁用域名及其
  子域隐藏 / 其他域名可见 / URL 形态禁用条目命中 / 默认值（球关、未问过）；
- options DOM id 齐全性脚本：`ballAsk / ballAskOn / ballAskOff / ballEnabled` html+js 双侧命中；
- 交叉审查：z-index 穿层问题自审抓出即修（球 2147483646 → 2147483645）。
- **手工清单（待用户真机）**：① `chrome://extensions` 从 worktree 重载 → 设置页应出现引导
  卡片；② 点「开启常驻入口」→ 当前已打开的网页**不刷新**即出现右下角悬浮球；③ 点球 → 伴读
  抽屉打开；④ 设置页关掉开关 → 球立刻消失；⑤ 把当前站加入域名管理 → 球消失、刷新后也不出现；
  ⑥ 抽屉打开时球被遮罩盖住、不穿层；⑦ 重载扩展后旧标签页的球随旧副本退役消失（console 有
  退役提示）。

## 4. 边界

- 球的显隐与划词/高亮共用「域名管理 + 主开关」语义；域名管理站点球不显示，但站点本身
  划词功能同被禁用，口径一致。
- `enabled`（主开关）与 `ballEnabled` 是与关系：任一关闭球都不显示。
- chrome:// 等扩展页无 content script 注入，天然无球。
- 首次引导若用户直接关掉设置页未表态：下次进设置页仍会看到卡片（`ballAsked` 未落），球
  保持关闭直至表态。
