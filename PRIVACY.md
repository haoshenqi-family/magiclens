# MagicLens 词镜 隐私政策 / Privacy Policy

生效日期：2026-10-07 ｜ 版本：1.0（对应扩展 v0.7.1）

MagicLens 词镜（下称"本扩展"）是 Magicbook 个人阅读体系的浏览器端，把划词翻译、生词高亮、词汇学习与 AI 伴读带到任意网页。我们尽量少收集数据，且**不收集任何用于广告或画像的数据**。

## 一、本扩展处理的数据

| 数据 | 何时处理 | 去向 |
| --- | --- | --- |
| 登录令牌（JWT） | 你通过 Authentik 登录后自动捕获 | 仅存于浏览器 `chrome.storage.sync`（随你的 Chrome 账号同步），用于调用你自己的后端时鉴权；不发送给任何第三方 |
| 用户设置（开关、快捷键等） | 你调整设置时 | 同上，仅存于浏览器 |
| 划词/选中的文本 | 你主动划词翻译、查详解、问 AI | 发送到**你自己登录的后端** `moon-well.haoshenqi.top`（自建服务）处理；单词翻译会经该后端或直连金山词霸开放接口查询 |
| 浏览页面的文本 | 生词智能高亮开启时（自动，仅英文页面） | 整页文本发送到你的后端 `moon-well.haoshenqi.top` 做生词判定；判定出的生词与阅读事件存入你自己的词汇库 |
| 标记数据（认识/生词） | 你点击"认识/生词"按钮 | 发送到你的后端，存入你的词汇本 |
| AI 伴读对话内容 | 你主动发起对话 | 发送到你的后端（LLM 网关）处理 |

## 二、我们不做什么

- **不收集**浏览历史、不追踪你在不同网站的行为（生词判定请求由你的浏览器直接发往你自己的后端，不经过任何第三方统计）；
- **不出售或共享**任何数据给第三方（上述后端为你自建服务，金山词霸接口仅接收被查询单词本身）；
- **不在本地数据库之外持久化**页面内容（翻译/生词缓存由你的后端管理）；
- **不包含**远程托管代码（所有代码随扩展包分发，符合 Chrome Web Store 政策）。

## 三、数据存储与删除

- 本地：令牌与设置存于 `chrome.storage.sync`，卸载扩展或在扩展内退出登录即删除；
- 服务端：划词译文、生词本、阅读事件、AI 对话均存储于**你自建的 moon-well 服务**（你拥有完全控制权，可自行删除数据库记录）。

## 四、权限说明

- `storage`：保存登录令牌与用户设置；
- 宿主权限（所有网站）：生词高亮需要读取并标注任意网页的正文文本，划词翻译需要在你选中的任意页面工作；网络请求由扩展 service worker 统一中转。

## 五、联系方式

问题或删除数据请求：https://github.com/haoshenqi-family/magiclens/issues

---

English (summary): MagicLens is a reading companion extension. It stores only your login token and settings in browser storage; text you select (or page text for vocabulary highlighting) is sent **only to your self-hosted moon-well backend** for translation/vocabulary processing. No analytics, no tracking, no ads, no data sharing, no remote-hosted code. Contact: the GitHub issues page above.
