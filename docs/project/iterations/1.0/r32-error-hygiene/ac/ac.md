# AC — R32 报错卫生收尾

> 手测环境：worktree 加载已解压扩展；断网用 devtools offline 模拟。

- [ ] GIVEN 断网 WHEN popup 重扫描 / options 测试连接 / chat 会话列表·重命名·删除·记忆列表 THEN 均只见场景短文案，无 URL/IP/Exception/timed out 等技术串
- [ ] GIVEN 后端不可用 WHEN analyze 失败 THEN popup 常驻行只显「生词判定暂不可用」；console.warn 保留完整原文
- [ ] GIVEN 旧版本遗留的 analyzeLastError 长文（升级场景）WHEN 渲染 THEN 过防御层后再显示（双保险）
- [ ] GIVEN 401 过期 / 积分不足 / 选区过长 WHEN 报错 THEN 原有干净文案与重登流程不受影响
- [ ] 版本号递增至 0.8.15-<时间戳>（测试版，不触发发布）
- [ ] design.md ADR §10 接入点清单已补全；LLD 状态行回填
