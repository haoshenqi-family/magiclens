# LLD — R52 伴读抽屉对齐 magicbook R232/R233（回复不显示 token 用量、站内链接新窗口可点）

> 状态：**已 merge 本地 develop，待真机验收**（2026-10-27）
> 来源：magicbook 近期能力提升的扩展侧同步。R232（伴读面板不再显示 token 用量）在本仓有
> **已登记遗留**（magicbook `iterations/1.0/r232-hide-token-usage/lld.md` §5：扩展
> `chat.js` onFinal 仍写 `tokens x+y`，彼时「只记录、不夹带修改」）；R233（AI 回复站内
> 链接可点、新窗口）为同期能力，一并同步。R234（悬浮球快捷动作 chat 钉首位）**不适用**：
> 本仓无快捷动作 UI，服务端不变量对扩展透明。

## 1. 改动落点

| 文件 | 改动 |
| --- | --- |
| `extension/common.js` | 新增 `__magicLensSiteOrigin` 常量与 `__magicLensAssistantHtml(text, siteOrigin?)`——助手消息安全渲染器（纯函数、无 chrome/DOM 依赖，node 可直测） |
| `extension/chat.js` | ① `onFinal` 删 token 用量展示（`usage` 不再消费；`conversationId` 回填与 `refreshConversations()` 保留，非 COMPLETED 状态提示保留）；② 流式原文缓冲 `acc`，final 与历史渲染统一走 `__magicLensAssistantHtml`；③ 抽屉 CSS 增站内链接/代码样式 |
| `extension/manifest.json` | `0.8.14 → 0.8.15-202610271026`（测试版，不触发发布） |
| `README.md` | L1 功能表「AI 伴读聊天抽屉」行回填两项能力 |

服务端（moon-well）零改动：SSE `final` 帧的 `usage` 字段照旧下发，扩展只是不消费。

## 2. 安全口径（移植 magicbook `ai_chat.js` R233，逐条对齐）

1. 先整段 HTML 转义，再以受控占位还原链接/代码/粗体——模型输出无法借 Markdown 注入 HTML；
2. href 只认「单个 `/` 开头」或「站内 origin 开头」的 http(s) 目标；拒绝控制字符、反斜杠、
   协议相对 `//host`、外部 origin、带 userinfo 的 URL；最终只写规范化后的
   `pathname + search + hash` 并按属性上下文再转义一次；
3. 链接恒 `target="_blank" rel="noopener noreferrer"`；
4. 围栏代码先占位、不进裸路径扫描；行内代码只有整段即站内路径才成链；
5. 裸路径尾随中英文标点与括号留在链接外。

**与上游（magicbook）的三处刻意分叉**（均有 Why）：

| # | 上游 | 本仓 | Why |
| --- | --- | --- | --- |
| 1 | origin 取 `window.location.origin` | 常量 `__magicLensSiteOrigin = https://magicbook.haoshenqi.top` | 扩展 content script 的 location 是宿主页，与「站内」语义无关；与 apiBase 兜底同口径（设置页不提供手改） |
| 2 | href 写相对路径 | href 写 `origin + path` 绝对地址 | 相对路径在扩展里会解析到宿主页 origin，点开跑到用户正在看的网站 |
| 3 | 裸路径 token 字符类放行 CJK | token 只吃 ASCII 可打印字符（`\x21-\x7e`） | 上游「`/credits，或者`」会把 CJK 连标点整段吞进 href（URL 编码后 404）；站内路由均为 ASCII，到非 ASCII 即断，顺带修掉上游此坑 |

不渲染用户消息（划词提问是用户自己输入的纯文本，保持现状）；外部 URL 仍为纯文本（不扩大钓鱼面，
同上游「未做」边界）；不把 `\n` 转 `<br>`（`.msg` 挂 pre-wrap，流式 textContent 与最终
innerHTML 观感一致）。

## 3. 验证

- 本仓无自动化测试框架（AGENTS §3），闸门 = 冒烟 + 手工清单：
  - `node --check`：`common.js` / `chat.js` 通过；
  - 渲染器 node 冒烟 **23 例全过**（node 直载 common.js 调生产函数）：Markdown 链接、裸路径
    CJK 断词与中文标点出链、同源绝对 URL 归一、query/fragment 保留（属性 `&amp;` 转义）、
    外链/`//host`/`javascript:`/userinfo/反斜杠/控制字符拒绝、`<img onerror>` 转义、
    围栏代码不成链、行内代码两分支、粗体（含链接 label）、换行保留、空串、注入 origin 隔离；
- **手工清单（待用户真机）**：`chrome://extensions` 从本 worktree 重载 → ① 划词「问 AI」发
  一条消息，回复气泡下不再出现 `tokens x+y`；② 让 AI 给一个本站链接（如「我的积分页在哪」），
  点击新窗口打开 magicbook 对应页；③ 左上下拉切历史会话，旧回复同样可点链接、无 token 行；
  ④ 回复中 ```代码块``` 与外链仍为文本。

## 4. 边界与遗留

- 会话历史接口返回的是纯文本 content，无残留用量节点问题（magicbook 侧当时是即时 DOM，本仓
  同为即时渲染，均无存储残留）。
- `__magicLensSiteOrigin` 与 `__magicLensDefaults.apiBase` 是两个独立常量（moon-well API 入口
  ≠ magicbook 站点入口），改域名时两处一起改。
- 上游 magicbook 裸路径 CJK 吞字坑已在本仓修复但**未回提上游**（跨仓改动另立需求，勿静默夹带）。
