# response-archive — R25

> 2026-10-10 R34 回应入库后窗口达 11 条，按纪律把最旧的 R25（域名管理）原样搬出；只搬原文，不总结、不改写。

### R25（域名管理：在指定域名禁用 MagicLens）

- **回应**：功能落地（manifest `0.8.0-202610071945` 测试版，不触发发布），moon-well 零改动、不新增任何 permission。设计文档 `docs/feat/domain-management/design/lld.md`（US1 判定与门控 / US2 设置页名单 / US3 popup 本站开关），ADR 记于 `docs/design.md` §9。
  - **存储与语义**：`chrome.storage.sync` 新增 `disabledDomains: string[]`（与既有配置同库、随浏览器同步）；条目为归一化 hostname，匹配语义「该域 + 全部子域」，不做精确/仅子域两种模式（域名禁用的直觉语义就是整站别管，项目原则「尽量简单」）；端口不参与匹配（禁 localhost 即禁所有端口）。
  - **`common.js`（新增）**：`__magicLensNormDomain`（借道 URL 归一化：剥协议/端口/路径/尾点/`*.` 前缀，非法输入返 null）与 `__magicLensIsDisabledHost`（含子域匹配）；manifest content_scripts 头位挂载 + options/popup `<script>` 直挂，四个消费方共享一份实现。node 冒烟 26 用例全过（含 `notexample.com` 不被 `example.com` 后缀误伤、IPv6/尾点/非法输入）。
  - **门控**：content.js 主引擎 IIFE 改为具名 `startMainEngine()`，由 storage 回调判定后启动（禁用站零 UI 零 DOM 监听零注入）；OIDC 登录回调捕获不受域名禁用影响（禁 moon-well 域不该废掉自己的登录回调）；highlight.js 启动时把判定固化进 `siteDisabled` 并入 `shouldEngineRun()`——Why 不只挡 boot：它有 storage.onChanged/Alt+U 等现成「重开路径」，禁用站会被后续全局开关变化复活；chat.js 零改动（唯一入口是划词气泡「问 AI」，content 禁用即天然禁用）。**生效语义统一「刷新页面后生效」**：名单只决定新加载页面，不做运行中拆装（低频配置动作，可逆化重构风险与收益不成比例）。
  - **UI**：设置页「域名管理」块（输入任意形态自动归一化、幂等添加、逐项移除、回车即添加、storage 为唯一事实源 + onChanged 渲染、全 textContent 组装）；popup 新增「本站启用」checkbox（非 http(s) 页隐藏；状态按 isDisabledHost 真实判定，恢复时移除所有覆盖本站的父域条目，否则勾上了仍被父域禁着自相矛盾）；「重新扫描本页」在本站禁用时报真实原因。
  - **交叉审查**（独立 agent）：1×P1 + 7×P2，无 P0。P1 = popup/options 的 `[hidden]` 被 author CSS 压过（`label{display:flex}` / `button{all:unset}` vs UA hidden 样式，content.js 曾修过同款陷阱）——两处补 `[hidden]{display:none!important}`（顺带修掉 options 登录按钮显隐的既有失效坑）。P2 择修：`ml:hl-toggle` 在禁用站 no-op（回 ok:true 防 background fallback 代翻全局开关、殃及其它站点）、`ml:hl-rescan` 禁用站回真实原因、popup hostname 过归一化剥尾点。余下 P2（storage 读改写无事务、startMainEngine 多暴露一个隔离世界全局等）记录在案不阻塞。
- **校验**：八个 JS 全过 `node --check`；manifest JSON 解析通过；助手函数 node 冒烟 26 用例全过。
- **待用户验收**（真机手工清单）：①设置页添加 `example.com` → 打开 example.com 及其子域页面：无划词、无高亮、popup 显示「本站启用」未勾选；②popup 取消勾选禁用当前站 → 刷新后插件静默；③重新勾选恢复 → 刷新后功能回来；④名单外的站点行为完全不回归；⑤Alt+U 在禁用站按下后，其它站点的生词高亮开关不受影响。
- **总结**：requests.md 占号 R25；response.md 本条；冲突记录：无（R24 遗留所提「R25 候选：iframe 内长句划选」未被本条占用实现，仍为待办，后续按实际需求续编号）；顺手补执行了 R10/R20 触发点漏掉的 response.md 归档（R1-R15 原样搬入 response-archive/，本文件恢复 10 条窗口）。改动未 commit。

