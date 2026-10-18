# AC — R28 派生词族判定

> 手测环境：本仓 worktree 加载已解压扩展 + moon-well 测试/生产环境；moon-well 单测在仓内跑。

- [ ] GIVEN 页面含 document 与 documentation WHEN 标记 document 认识 THEN 刷新后两者均不划线
- [ ] GIVEN 反向标记 documentation 认识 WHEN 刷新 THEN document 不划线
- [ ] GIVEN documentations（屈折×派生组合）WHEN 判定 THEN 归入 document 同族不划线
- [ ] GIVEN station / vacation / nation WHEN 判定 THEN 不产出假词干（st/vac/n），照常按原词判定
- [ ] GIVEN 划词翻译 documentation WHEN 翻译 THEN 仍翻译该 token 本身（按词翻译口径不变）
- [ ] moon-well `WordInflection` 派生单测全绿，含镜像守卫（扩展端 DERIVATION_RULES 字面量逐项相等）
- [ ] 扩展版本号已按两段式递增（测试版带时间戳，不触发发布）
- [ ] L1/L2/LLD 状态行回填
