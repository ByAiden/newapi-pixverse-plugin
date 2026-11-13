---
changelogVersion: 1
plugin: byaiden_pixverse
version: 1.0.0
locale: "zh-CN"
---

# Changelog

## [1.0.0]

### Added

- 通过 `POST /v1/videos` 以及 PixVerse 原生的 `POST /openapi/v2/video/text/generate`、`POST /openapi/v2/video/img/generate` 和 `POST /openapi/v2/video/transition/generate` 使用 PixVerse 平台 API 生成视频：文生视频、图生视频和首尾帧过渡，支持 `pixverse-v6-max`、`pixverse-c1`、`pixverse-v6`、`pixverse-v5.6`、`pixverse-v5.5` 和 `pixverse-v5`。
- 通过 `POST /openapi/v2/image/upload` 上传图片供后续视频请求使用：以 `multipart/form-data` 提交一个图片文件部分或一个图片 URL 字段，并在视频请求中用上传返回的任务 id 引用该图片。
- 任务按 PixVerse 积分、秒数、输出清晰度以及音频与多镜头开关定价。提交时预留 PixVerse 公布价格对应的积分，任务完成后按 PixVerse 报告的积分结算。
