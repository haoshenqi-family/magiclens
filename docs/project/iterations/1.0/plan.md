# 迭代计划 1.0（magiclens 项目）

> 对应 PingCode：项目 `magiclens`（scrum）· 迭代 `1.0`（2026-10-15 → 2026-10-30）。
> 本文件 2026-10-18 建立（设计阶段补落），是迭代工作项清单与状态权威源。

## 目标

1. 朗读词典发音（R43）验收闭环（已随 v0.8.10 正式版发布）。
2. 派生词族判定缺口（R28 缺陷）设计定稿并进入开发（moon-well 双侧同步）。
3. 报错文案卫生（R32 缺陷）剩余接入点收尾设计定稿。

## 工作项清单

| 工作项 | 类型 | Ship 需求 | 设计文档 | 状态（2026-10-18） |
| --- | --- | --- | --- | --- |
| MAGICLENS-1 R43 划词朗读补词典发音 | 用户故事 | [idea wTvejHOk](https://haoshenqi.pingcode.com/ship/ideas/wTvejHOk) | —（实现记录见 response-archive/response-R43 系列） | 已发布：df13c9d，随 v0.8.10 正式版上线（tag/Release 38356015482） |
| MAGICLENS-2 R28 派生词族判定缺口 | 缺陷 | [idea nvvFdct0](https://haoshenqi.pingcode.com/ship/ideas/nvvFdct0) | [r28-derived-word-family/](./r28-derived-word-family/)（本轮新增 HLD/LLD/AC 草案） | 设计草案 v1（双侧：moon-well WordInflection/WordFamilyJudge + 本仓 lemmaCandidates），待第二轮讨论 |
| MAGICLENS-3 R32 报错详情不暴露 | 缺陷 | [idea IBnRbOtq](https://haoshenqi.pingcode.com/ship/ideas/IBnRbOtq) | [r32-error-hygiene/](./r32-error-hygiene/)（本轮新增） | 防御层 v0.8.1 已上线；剩余接入点收尾设计草案 v1 |
| MAGICLENS-4 R46 架构评审波 1+2 真机验收 | 任务 | （idea In progress） | — | 等用户真机验收，不在本轮设计范围 |
| MAGICLENS-5 R47 架构评审波 3 阶段二 | 用户故事 | （idea In progress） | — | 开发中（bubble/detail-panel/tts 拆分），不在本轮设计范围 |
| MAGICLENS-6 R52 伴读抽屉对齐 magicbook R232/R233 | 用户故事 | [idea 6Lljn2pb](https://haoshenqi.pingcode.com/ship/ideas/6Lljn2pb)（ML-51，In progress） | [r52-buddy-parity/](./r52-buddy-parity/)（LLD） | 已 merge 本地 develop（0.8.15 测试版），待真机验收（2026-10-27） |
| MAGICLENS-7 R53 伴读抽屉语音双向（对齐 magicbook R227） | 用户故事 | [idea 1nxbdoBF](https://haoshenqi.pingcode.com/ship/ideas/1nxbdoBF)（ML-52，In progress） | [r53-buddy-voice/](./r53-buddy-voice/)（LLD） | 已 merge 本地 develop（0.8.16 测试版，与 R52 同树续作），待真机验收（2026-10-27） |
| MAGICLENS-8 R54 常驻入口悬浮球（设置开关 + 首次安装引导） | 用户故事 | （idea 见 response R54 回执） | [r54-ball/](./r54-ball/)（LLD） | 已 merge 本地 develop（0.8.17 测试版，同树续作），待真机验收（2026-10-27） |

## 备注

- R28 的 moon-well 侧改动跟随 `magicbook` PJM 项目口径（moon-well 不单独建载体）；开发时 moon-well 侧走 worktree（其主检出当前有并行会话在途）。
- 本仓无自动化测试：AC 以手测清单为准（`chrome://extensions` 重载实测）。
