---
changelogVersion: 1
plugin: byaiden_pixverse
version: 1.1.0
locale: "zh-CN"
---

# Changelog

## [1.1.0]

### Added

- 可在上游为另一台已安装本插件的 New API 网关的 New API 渠道（类型 60）上使用本插件：请求发往该网关的 `/{key}/openapi/v2/...` 路由并以其令牌作 Bearer 认证，上传的图片按该网关的任务 id 引用，下载走它的任务内容路由，任务按该网关转来的 PixVerse 积分结算。
