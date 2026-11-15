# LLD — R70 悬浮球配置切 buddy 页服务端真值（moon-well R260 + magicbook R294 + magiclens R70 三仓接力）

> 状态：**开发完成待真机验收**（2026-11-15；分支 `feat/r70-server-ball-config`；版本 0.8.31-202611152331 测试版）
> 来源：用户反馈「还是不行啊」+ buddy 页截图——R69 误解为「扩展设置页本地开关」，用户真意是**与 magicbook buddy 页同一份配置**（AskUserQuestion 二次确认：①同一份服务端配置 ②R69 本地开关移除换引导链接）。

## 1. 三仓分工（依赖顺序 moon-well → magicbook → magiclens）

- **moon-well R260**：`BuddyService.QUICK_ACTION_IDS` 7→10（+highlight/page-translate/review）；R234 不变量零变动（chat 钉首、4-5、defaults、写入拒绝不截断）。BuddyServiceQuickActionsTest 9/9。
- **magicbook R294**：buddy 页 quick-actions 路由切 `_moonwell_proxy`（javadoc 预留的薄代理形态）+ **存量懒迁移**（stored=false 且 view_settings 有存量 → 代用户回填一次，幂等自愈）+ **离线兜底**（moon-well 不可用 GET 退本地 view_settings、POST 透 502）+ 配置面 available 7→10（扩展三项带「仅扩展」标，po+pybabel）+ ai_chat.js 按 HOST_ACTION_IDS 过滤（宿主球跳过扩展 id）。pytest 12/12。关键坑：moon-well client 回包是 `response.text`，路由侧 `_quick_actions_json` 统一解 JSON——首版把字符串当 dict 判，POST 全 502。
- **magiclens R70（本条）**：扩展球只读服务端配置，R69 本地开关移除。

## 2. magiclens 侧决策

- **单一真值 + 缓存先行**：build 不等网络——先读 `chrome.storage.local magiclens.ballQuickActions = {selected, stored, ts}` 渲染，启动即 `fetchQuickActions()`（ML_API `/buddy/quick-actions`，POST 符合 buddy 域全 POST 约定），回包落缓存后签名变化才重建（visualSignature=显隐三键+serverSelection；token 等非视觉键不触发）。失败静默保留缓存——球不因后端抖动翻脸。
- **渲染语义**：`stored=true` → `selected ∩ registry` **按服务端顺序**渲染（宿主专有 id 静默跳过）；词卡=`selected 含 'review'`。`stored=false`（从未在 buddy 页保存）或无缓存 → 注册表全量 + 词卡开（升级/新用户零变化）。FAB 点击 fallback 链不变（chat→第一个启用气泡→全关 ML_OPENOPTIONS）。
- **R69 本地键清理**：`bubble*`×6 + `ballReview` 从 defaults 删除（dead keys 即漂移温床——「避免下次再犯」的一部分）；registry 去 cfgKey 字段、id 即服务端白名单 id；options 开关区换「打开 magicbook 伙伴页配置」直达按钮（`__magicLensSiteOrigin/buddy`）。
- **守卫升级（双锁改跨仓）**：锁 A=registry 全部 id ⊆ moon-well `BuddyService.java` QUICK_ACTION_IDS（`../moon-well` 同层文本解析，家族布局两仓同层；文件缺失/解析失败即挂）——新增气泡先扩后端白名单，buddy 页才能表达它；锁 B=RUNS 覆盖/禁字面量 ACTIONS + options 必须有 buddy 页引导**且不得再引用 registry**（防本地开关复活）。
- **review 不进 registry**：词卡不是径向气泡，由 selected 含 'review' 驱动——与 magicbook 宿主球「无词卡」自然分化，配置面（buddy 页）一个 chip 管两端语义。

## 3. 踩坑实录

- moon-well client 回包是字符串不是 dict（见上，magicbook 侧）。
- 守卫跨仓断言首版 `registry.size`——数组是 `length`，`10 >= undefined` 恒 false（守卫自己挂自己，正确行为）。
- E2E 词卡探针：reviewLoad **每次激活只发一次**（8s 轮播消费已缓存队列），不能等新请求——改用词卡 DOM 渲染（rvw-word 词面）做激活证据；请求计数差存在「缓存先行+校正重建两段请求都先于探针落地」的竞态。

## 4. 测试

- 三守卫全绿（跨仓锁输出 `6 actions ⊆ moon-well whitelist (10)`）；node --check 全过。
- 套件：run.js mock `/buddy/quick-actions`（`t.qa` 注入 {stored, selected}，未设定=从未保存）；ml-ball-bubbles 重写为四段 reload 断言（未保存全量→过滤 3 气泡+词卡渲染→去 review 词卡关闭稳定窗口零请求→回全量）；matrix 行 note 更新；guard.py 三向全绿；浏览器全特性 17/17；runner magiclens 20/20。
- 手工 AC（真机，依赖 moon-well dev + magicbook dev 部署）：buddy 页勾掉「整页翻译」保存 → 扩展球（普通网页刷新后）无 🌐；勾「回顾」→ 词卡现；从未保存账号 → 全量；宿主球不出现扩展项气泡；断网 → 用缓存渲染。
