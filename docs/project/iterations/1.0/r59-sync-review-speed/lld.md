# LLD — R59 同步 magicbook 近期功能：悬浮球 SRS 滚动复习轮播 + 回复朗读语速三档

> 状态：**开发中**（2026-11-08，worktree `magiclens-r59-buddy-review-speed` / 分支 `feat/r59-buddy-review-speed`）
> 关联需求：magiclens R59（PingCode ML-55）；对端 magicbook R285/R289（滚动复习）与 R263（朗读速度三档）。
> 范围裁决（用户 2026-11-08 拍板）：R261 行内 gloss **不做**。

## 1. 背景与目标

magiclens 上次与 magicbook 对齐停在 R52-R54（2026-10-27，对齐 magicbook R223/R227）。
此后 magicbook 落了两个用户可见能力：R285+R289 Buddy 头顶滚动复习（SRS 到期词轮播，
R289 升级为单词详情分页）、R263 朗读语速三档。本任务把两者移植进扩展：

- **A 滚动复习**：悬浮球上方常驻词卡轮播（可暂停/收起），数据 = moon-well SRS 到期队列
  （`GET /learning/srs/queue`，due_at<=now 含积压，默认 20 词前端洗牌）+ R289 详情分页
  （`POST /vocabulary/detail/cached-batch`，只读缓存零计费）。
- **B 语速三档**：伴读抽屉头部语速按钮，1.0/0.75/0.5x 循环，作用于回复朗读
  （`/tts/speak` 音频），变速不变调（`preservesPitch`）。

## 2. 契约（以 moon-well 现行代码为唯一权威，均已核对源码）

| 端点 | 方法 | 说明 |
| --- | --- | --- |
| `/learning/srs/queue?limit=20` | GET | `Result<List<LearningReviewItemVO>>`：`word`/`meaning`（中文短释义，缓存 miss 为 null）/`contextSentence`/`contextBook`/`contextChapter` 等 |
| `/vocabulary/detail/cached-batch` | POST `{words:[…]}` | `Result<Map<String,WordDetailVO>>`，键=归一词（trim→弯撇号转直撇号→小写），**未命中词不出现**；只读缓存绝不触发生成（moon-well R248，对端 magicbook R289） |
| `/vocabulary/known/{word}` | GET | 「认识」= 毕业/移出队列（复用既有 `ML_MARK` 消息，magiclens 划词气泡同款语义；不写复习日志、不计 x/20，R285 口径同源） |

⚠️ **发版时序**：`cached-batch` 在 moon-well develop（dev 环境），生产 release 尚未携带
（2026-11-08 release 落后 develop 22 提交）。扩展直连生产 moon-well——该端点 404 期间
**详情分页自动回退简卡**（与「无缓存词」同一降级路径），moon-well R248 发生产后详情自动生效，
扩展无需再发版。

### 计费红线（R285/R289 同款，扩展侧同样钉死）

轮播任何路径**绝不**调 `/vocabulary/detail/{word}`（缓存 miss 现场生成：计费 + 15~30s）——
轮播是无人操作的被动卡片，翻页不许变成隐藏下单。详情只来自 `cached-batch`，miss 静默回退简卡。

## 3. A — 滚动复习轮播（`extension/ball.js`）

### 3.1 形态与位置

- 词卡 = 球 shadow root 内 `wrap` 的兄弟节点（**不进 wrap**——wrap 上有
  mouseenter→径向气泡与 pointerdown→拖拽，magicbook R285 已实证塞进 wrap 会互相打架）；
  `position:fixed`，按 FAB rect 贴上方（间距 12px），左缘吸附时贴左、上方空间不足翻到球下方，
  280px 宽（与 magicbook ai_chat.css R285 段逐段对齐，类名去 `ai-` 前缀改 `rvw-`）。
- 尾部小箭头/方向类（`is-left`/`is-below`）与 magicbook 同款；拖拽/吸附过渡结束后重算位置。

### 3.2 数据流

```
ball build() → initReview()
  ├─ reviewLoad()：ML_REVIEW_QUEUE → /learning/srs/queue（默认 20，不透传 limit）
  │    ├─ resp.auth=true（未登录）→ review.authFailed=true，卡片隐藏、不发请求（静默）
  │    ├─ resp.ok → 20 词前端洗牌截断；review.pages={}（新队列=新随机模块选择）
  │    │    └─ reviewLoadDetails()：ML_REVIEW_DETAIL_BATCH → /vocabulary/detail/cached-batch
  │    │         失败/空结果 → review.pages={}（简卡回退；详情是增强层，失败不可见是设计口径）
  │    └─ 其他失败 → 错误态 + 重试按钮（失败必须可见，R44 口径）
  └─ setInterval 8s reviewTick()：先在当前词内翻页（R289），翻完才换词并清 markError
```

- 「认识」→ 复用 `ML_MARK {known:true}` → `/vocabulary/known/{word}`；请求按**点击瞬间下标**
  删词（可能跨过一个 8s tick，R285 S1 同款修法）；本地先移除避免 8 秒后滚回来。
- 词形校验照搬 magicbook `REVIEW_WORD_RE`（`/^[A-Za-z](?:[A-Za-z'\u2019-]*[A-Za-z])?$/`
  归一后 ≤64），不合法词禁用「认识」按钮——后端先归一再校验，前端照做才不误禁。

### 3.3 详情分页装配（逐段移植 magicbook R289 `reviewDetailPages`）

- 每词 = **基本意思前 2 义项**（`pos. sense\nexample`）+ **随机 1 个非空模块**（≤2 页）：
  词源按句切约 60 字装页（≤2 页）；搭配取前 2 条（`phrase　meaning`）；词形取前 6 个
  （`form（type）`）；同/反义词取前 8 个顿号连排；俚语取前 2 条（`meaning\nexample`）；
  趣闻取前 2 条。总页数 ≤4（用户口径「基本意思+1 随机模块」）。
- 随机在队列加载时定一次，同一轮稳定，下次拉队列重洗（magicbook 口径）。
- 渲染：词面常驻，正文一次只显一页，`-webkit-line-clamp:3` 硬钳 + `white-space:pre-line`；
  服务端内容一律 `textContent`（详解六板块来自 ES，禁拼 HTML）。
- 简卡回退（无缓存词/端点未发生产/详情加载失败）：`meaning` + `contextSentence`（2 行钳）+
  `contextBook` 出处行。

### 3.4 暂停矩阵（magicbook `reviewShouldPause` 扩展侧同构）

loading / failed / inFlight / paused / collapsed / 队列空 / **页面不可见**
（`visibilityState==='hidden'` 或 `!hasFocus()` 且 activeElement 非 IFRAME）/
**径向气泡展开**（hover 球=用户在交互，不在复习）/ **伴读抽屉打开** /
球进入让位域名时随球整体移除。

- 暂停只跳过 tick，不重置计时器、不发请求；页面生命周期内队列只拉一次，不轮询（R243 口径）。
- `paused`/`collapsed` 持久化走 `chrome.storage.local`（键 `magiclens.reviewPaused` /
  `magiclens.reviewCollapsed`）——**禁用页面 localStorage**（扩展禁污染宿主，ball.js
  fabPos 同款口径；magicbook 用 localStorage 是站内特权，扩展不能照抄）。
- 抽屉开合感知：chat.js `open()/close()` 派发 `window` CustomEvent `magiclens-chat`，
  ball.js 监听置 `drawerOpen`（closed shadow 无法从球侧查询，事件是唯一通道）。
- 未登录态静默：`resp.auth=true` 时 `authFailed=true` 且**不发任何后续请求**；
  登录成功（`chrome.storage.sync` 的 `token` 变更）后自动重试一次 `reviewLoad()`。

### 3.5 background 新增消息（`rpc.js` MSG + `background.js` 路由）

| 消息 | 端点 | 方法 |
| --- | --- | --- |
| `ML_REVIEW_QUEUE`（`ml:review-queue`） | `/learning/srs/queue` | GET |
| `ML_REVIEW_DETAIL_BATCH`（`ml:review-detail-batch`） | `/vocabulary/detail/cached-batch` | POST `{words}` |

走既有 `callApi`（鉴权/超时/401 静默刷新/Result 解包单点）；「认识」复用 `ML_MARK`。

## 4. B — 回复朗读语速三档（`extension/chat.js`）

- 抽屉头部加 `<button class="ic speed">`，显示当前档位（`1.0x`/`0.75x`/`0.5x`），点击循环
  （常速→慢→更慢→回常速，magicbook R263 顺序）。
- 档位持久化 `chrome.storage.local`（键 `magiclens.ttsSpeed`，per-browser——朗读是屏幕/设备
  相关体验，与 fabPos 同级，不进 sync 的用户设置域）。
- **播放链路分叉**（Why 不全量切 <audio>：现行 Web Audio `decodeAudioData`+BufferSource
  链路对页面 CSP 免疫，1.0x 行为零回归）：
  - **1.0x**：现行 BufferSource 链路原样（不碰已验证路径）。
  - **0.75x/0.5x**：`<audio>` 元素 + Blob URL 播放，`playbackRate` + `preservesPitch`/
    `webkitPreservesPitch`/`mozPreservesPitch` 三连钉（变速不变调，magicbook R263 的
    Why：服务端缓存键=原文 SHA-256，变速落服务端要么双份缓存要么击穿永久缓存设计）；
    `<audio>` `error` 事件（严格 CSP 页 `media-src` 拦 blob:）→ 回退 BufferSource
    链路并套 `playbackRate`（此时音调随速变化，属已知降级，状态行不提示）。
- 分段顺序播语义不变：`onended` → 下一段；停止/换档 `token` 递增防竞态；
  切档时若正在朗读，**不打断当前段**，下一段起生效（换档不打断是低惊讶原则）。

## 5. 集成套件（R185 门禁）

- `matrix/magiclens.csv` 新增两行：`ml-ball-review`（ball, T1）、`ml-chat-speed`（chat, T1）。
- `browser/run.js`：mock 层补 `/learning/srs/queue`（fixture `moonwell-srs-queue`，2 词）与
  `/vocabulary/detail/cached-batch`（fixture `moonwell-detail-cached-batch`，1 词命中 1 词 miss）
  两个响应；新增 feature 用例：
  - `ml-ball-review`：球出现→复习卡出现→打队列与批量详情请求→卡片渲词面+简卡释义→
    「认识」点击→ `/vocabulary/known/` 请求→词从卡上移除；收起态写 `chrome.storage.local`。
  - `ml-chat-speed`：开抽屉→头部语速按钮存在→点击循环 1.0x→0.75x→0.5x→1.0x→
    storage 断言 `magiclens.ttsSpeed` 持久化（mock 音频不可解码，不点「朗读本条」）。
- `guard.py` 三向对账全绿。

## 6. 版本与文档

- `manifest.json`：`version` 0.8.21→**0.8.22**，`version_name` `0.8.22-<YYYYMMDDHHmm>`（测试版，不触发发布）。
- L1 `README.md`：悬浮球行补「SRS 滚动复习轮播」，AI 伴读表补「语速三档」；API 契约速查 +2 端点。
- 台账 `docs/project/requests/requests.md`（已由占号脚本写入）+ `response.md` 回填；PingCode ML-55 → In progress。

## 7. 非目标

- R261 行内 gloss（用户拍板不做）。
- 划词朗读（有道音频/`speechSynthesis` 回退）不加语速——B 范围钉在伴读回复朗读。
- 复习卡不写查词记录、不接 `/learning/srs/answer`（不写复习日志、不计 x/20，R285 口径）。
