# Chrome Web Store 上架材料（直接复制粘贴）

> ⏸️ **搁置中（2026-10-07，R23）**：已决定暂不上架 Chrome Web Store，仅通过 GitHub Releases 分发。本材料与 [PRIVACY.md](../../PRIVACY.md) 保留，未来上架时可直接使用。

> 对应扩展 v0.7.1。zip 用 Release 附件 `magiclens-extension-v0.7.1.zip`。
> ⚠️ 上架前注意（2026-10-07 R26 核对）：现行 [.github/workflows/release.yml](../../.github/workflows/release.yml) 的打包命令 `zip -r … extension` 产出 zip 根层是 `extension/` 目录而非 manifest.json 本身，与 Chrome Web Store「manifest 在 zip 根层」的要求不符；上架时需改为在 `extension/` 目录内打包（`cd extension && zip -r ../xxx.zip .`）或手动重打，并同步刷新本行版本锚点。

## 1. 商店信息（Store listing）

- **名称**：MagicLens 词镜
- **简短描述**（≤132 字符，商店会同步 manifest description）：
  > 把 magicbook 的阅读能力带到整个 Web：划词翻译、单词详解、生词高亮、认识/生词标记、词汇表与朗读，直连 moon-well。
- **详细描述**（建议）：
  > MagicLens 词镜把 Magicbook 的英文阅读能力带到你浏览的每一个网页。
  >
  > ✨ 核心功能
  > • 划词翻译——选中任意文本即时翻译，单词直连词典（百毫秒级），段落走 AI 翻译
  > • 单词详解——词源、搭配、变体、同反义词等六板块深度解析
  > • 生词智能高亮——自动标注网页上的生词（波浪线），悬浮即显翻译，与你的词汇本同步
  > • 认识/生词标记——一键标记，全页同词形即时点亮/熄灭，数据与 Magicbook 完全互通
  > • AI 伴读——把选中内容发给 AI 伴读助手，长期记忆你的学习情况
  > • 朗读——选中文本本地朗读
  >
  > 📚 数据说明：本扩展是你自建 Magicbook/moon-well 体系的客户端，所有词汇数据与学习记录
  > 存在你自己的服务中；隐私政策见 https://github.com/haoshenqi-family/magiclens/blob/develop/PRIVACY.md
- **类别**：生产力工具（Productivity）
- **语言**：中文（简体）为主，可加 English

## 2. 图片素材

| 素材 | 规格 | 必填 | 建议 |
| --- | --- | --- | --- |
| 商店图标 | 128×128 PNG | ✅ | 已有 `icons/icon128.png` |
| 截图 | 1280×800 或 640×400，1~5 张 | ✅ | ①英文网页生词波浪线+悬浮气泡；②划词翻译气泡；③单词详解面板；④AI 伴读抽屉；⑤设置页 |
| 小宣传图 | 440×280 | 选填 | 可后补 |
| 大宣传图 | 1400×560 | 选填 | 可后补 |

## 3. 隐私权标签页（Privacy practices）——审核重点

- **单一用途说明**（Single purpose）：
  > 在用户浏览的网页上提供英文阅读辅助：划词翻译、单词详解、生词高亮标注与生词本管理、文本朗读与 AI 伴读。
  > （英文：Provide English reading assistance on any web page: text selection translation, word details, vocabulary highlighting and word-book management, text-to-speech and AI companion.）
- **权限用途说明**（逐条填写）：
  - `storage`：存储用户登录令牌与扩展设置（chrome.storage.sync）。
  - 宿主权限 `<all_urls>`：生词智能高亮需要读取任意网页正文并标注生词；划词翻译需要在用户选中的任意页面工作。所有网络请求由扩展 service worker 中转，仅发往用户自己配置/登录的后端。
- **数据使用披露**（勾选"是否收集用户数据"= 是，逐项声明）：
  - 个人身份信息：无（登录令牌不是身份信息，仅作鉴权凭据）
  - 网页内容/用户活动：✅「网站内容」——划词文本与页面文本，仅在用户主动使用功能（划词、生词高亮开启）时发送到用户自己的后端，**不用于广告、不出售、不转移给第三方**（勾选相应三项不适用声明）
  - 明确声明：数据不与第三方共享；不以收集数据为主要用途之外的目的使用
- **隐私政策 URL**：
  > https://github.com/haoshenqi-family/magiclens/blob/develop/PRIVACY.md
  （要求公开可访问；PRIVACY.md 已入库，若商店要求网站域名，可再挂到 haoshenqi.top 静态页）

## 4. 分发与审核

- **首次上架建议**：先「不公开列出」（unlisted）自用+小范围验证，审核通过后再切「公开」。
- **广泛权限审核**：`<all_urls>` 会触发深度审核，**强烈建议主动附演示视频**（YouTube 链接，1~2 分钟：展示英文网页上生词自动高亮、悬浮出气泡、划词翻译、标记生词后高亮变化），可显著缩短审核往返。
- **审核时长**：首次通常数小时~数天；含广泛权限可能更久，被拒会写明理由，按提示补材料重提即可。
- **后续更新**：递增 manifest `version` → 重打包上传 → 再次审核（通常比首次快）。商店版本号必须大于已上架版本。

## 5. 费用与账号

- 开发者账号一次性注册费 **$5**（Google Pay/信用卡），注册地址：https://chrome.google.com/webstore/devconsole
- 发布免费扩展不收费；后续无年费。
