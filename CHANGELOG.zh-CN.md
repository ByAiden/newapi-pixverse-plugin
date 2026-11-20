---
changelogVersion: 1
plugin: byaiden_pixverse
version: "1.1.1"
locale: "zh-CN"
---

# Changelog

## [1.1.1]

### Fixed

- README 中的价格表达式现在能在模型广场显示为价格表：积分表达式改为 `u("credits") * 0.0044444444444`（每积分 1/225 美元，每 10,000 积分比官方价少收不到 0.000000001 美元），不再是 `u("credits") / 225 * M`；按秒表达式改为每种清晰度一档的条件链，不再嵌套条件。README 改为说明把每个数字乘以倍率。
