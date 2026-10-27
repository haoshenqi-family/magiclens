# 常驻入口悬浮球（L3 实现说明）

> 状态：现行。R54 引入，R56 增加 magicbook 宿主站让位。

## 实现

- `extension/ball.js` 是仅顶层文档加载的 content script，UI 挂在 closed Shadow DOM；
  点击头像打开伴读抽屉，hover 展开径向快捷气泡，拖拽后吸附左右边缘并按 hostname 记忆位置。
- `extension/common.js` 的 `__magicLensBallVisible(cfg, host, isTop)` 是唯一显隐判定：
  主开关、`ballEnabled`、顶层文档、用户禁用名单和宿主让位名单同时满足才显示。
- `__magicLensBallYieldDomains` 是冻结数组，当前仅包含 `magicbook.haoshenqi.top`；
  匹配复用域名禁用助手的「本域 + 全部子域」语义。
- `scripts/check-ball-visibility.js` 在 Node VM 中加载真实 `common.js`，锁住宿主让位、
  相似域名边界、iframe、主开关、球开关、用户禁用名单与名单冻结。

## 边界

- magicbook 主域及子域始终不显示扩展球，宿主球是否显示由 magicbook 自身控制。
- 该让位只针对常驻入口，不关闭 magicbook 站内的划词、高亮、标记或伴读能力。
- `notmagicbook.haoshenqi.top` 不是 `magicbook.haoshenqi.top` 的子域，扩展球仍按开关显示。
- 非顶层 frame 不显示悬浮球，因此 magicbook 阅读器 iframe 不会各自生成一份入口。
- 用户禁用名单优先于一切显示条件；主开关或球开关任一关闭都不显示。
