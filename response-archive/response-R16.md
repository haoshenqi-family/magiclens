# response-R16.md — 归档（2026-10-07 R28 完成时自 response.md 原样搬移）

## R16 回应：标记认识后重新扫描仍出现（已修复：后端判定升级词族口径）

- **回应**：标记本身已生效，重新扫描把 installed「带回来」的是同页另一个未标记词形 **install**（GitHub 页的 Install 按钮），非 installed 自身。证据链：①`vocabulary_notebook` 中 user 1 `installed` familiarity=7 已落库（08:17:50）；②重扫（08:21:11）ES 阅读事件 `installed`=KNOWN（服务端已正确过滤、未进生词返回），`install`=UNKNOWN（无手动标记，magicbook_word_level 档位 3=CET4 > 用户 hard_level=2 → 词档兜底判生词返回）；③扩展 `highlight.js` `matchWord` 对 token 做屈折还原双向匹配，`lemmaCandidates("installed")` 含 `install` → 命中生词集合再次点亮。标记当下消失是 `__magicLensOnMarked` 全集清扫只清了页内集合，重扫以服务端为准。
- **根因**：手动标记「认识」只写精确词形；服务端 analyze 按精确 token 判定，客户端高亮按词族匹配，口径不一致。
- **修复（用户确认「单词判断都按单词来，仅翻译等信息按 token」后实施）**：moon-well 新增 `WordInflection`（屈折还原，与 highlight.js `lemmaCandidates` 逐条同规则，测试向量互为镜像）与 `WordFamilyJudge`（自身显式标记 > 词族显式标记（认识优先）> 词族最小档位兜底）；analyze 与 familiar 同矩阵，单词本/分级表查询按词族全集展开（跨页标记生效）；翻译/释义仍按 token。派生词（installation）与不规则变形（ran/run）不在还原范围，维持独立判定。备选「前端批量标词族」因会把 installe 等副产物写进单词本污染学习队列而否决。
- **验证**：moon-well 新增 25 个单测（WordInflection 6 / WordFamilyJudge 9 / analyze 词族场景 4 / familiar 6，含 R16 复现用例 `knownMarkOnInstalledFiltersSamePageInstallToken`），全量 709 测试通过后 push develop 走 fnOS 链部署。扩展端零改动、版本不变。
- **总结**：requests.md 占号 R16；跨查并修改 moon-well（其台账 R107）；ADR 记于 docs/design.md §8。
