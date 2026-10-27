# LLD — R56 magicbook 站内悬浮球去重

> 状态：**已 merge 本地 develop，待真机验收**（2026-10-27，0.8.20-202610272114 测试版）
> 关联需求：R54 常驻入口悬浮球；本缺陷修复宿主球与扩展球同页重复显示。

## 1. 背景与根因

magicbook 在 `cps/templates/layout.html` 和阅读器模板中全站引入
`ai_chat_panel.html`，因此 magicbook 页面本身已有一个 buddy 悬浮球。
MagicLens 的 `ball.js` 又匹配全部 `http/https` 顶层页面；用户开启「常驻入口」后，
两个球同时出现在右下角。

产品决策为**宿主页优先**：magicbook 站内保留带阅读上下文的原生球，MagicLens
在 `magicbook.haoshenqi.top` 及子域让位；其他网站继续显示扩展球。

## 2. 实现

- `extension/common.js`
  - 新增冻结名单 `__magicLensBallYieldDomains = ['magicbook.haoshenqi.top']`；
  - `__magicLensBallVisible` 增加 `!__magicLensIsDisabledHost(host, yieldDomains)`；
  - 复用现有域名助手，天然支持子域且不会误伤相似后缀。
- `extension/ball.js`：逻辑不变，只补充宿主让位说明；`sync()` 继续消费同一个纯函数。
- `extension/options.html`、`README.md`：用户文案从「所有网页」改为明确说明
  magicbook 站内使用宿主球。
- `scripts/check-ball-visibility.js`：加载真实 `common.js`，断言主域、子域、相似域名、
  其他站点、iframe、主开关、球开关、用户禁用名单与冻结名单。

## 3. 验证

```bash
for f in extension/*.js scripts/*.js; do node --check "$f"; done
node scripts/check-ball-visibility.js
node scripts/check-extension-modules.js
git diff --check
```

守卫断言全部通过。真机验收待用户：

1. 开启常驻入口后打开 `magicbook.haoshenqi.top`，页面只出现 magicbook 原生球；
2. 打开 magicbook 阅读器，仍只有一个宿主球；
3. 打开其他网站，MagicLens 扩展球正常显示；
4. 在设置页关闭常驻入口，其他网站的扩展球即时消失；
5. magicbook 站内划词、高亮、标记与伴读不受影响。

## 4. 边界

- 本次不改 magicbook 代码，也不尝试从宿主侧探测扩展。
- 让位名单是产品约束而非用户偏好，不开放配置。
- 旧域 `magicbook.haoyuhang.top` 已 301 到现域，不重复登记。
- 不触碰 R55 的金山直连修复与模块导出守卫。
