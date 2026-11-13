---
changelogVersion: 1
plugin: byaiden_pixverse
version: 1.0.0
locale: "en"
translations:
  zh-CN: CHANGELOG.zh-CN.md
---

# Changelog

## [1.0.0]

### Added

- Generate videos with the PixVerse platform API through `POST /v1/videos` and PixVerse's own `POST /openapi/v2/video/text/generate`, `POST /openapi/v2/video/img/generate` and `POST /openapi/v2/video/transition/generate`: text to video, image to video and first and last frame transitions with `pixverse-v6-max`, `pixverse-c1`, `pixverse-v6`, `pixverse-v5.6`, `pixverse-v5.5` and `pixverse-v5`.
- Upload images for later video requests through `POST /openapi/v2/image/upload`, as `multipart/form-data` with one image file part or one image url field, and reference the uploaded image by its task id.
- Price a task by its PixVerse credits, its seconds, its output quality and its audio and multi-clip switches. The request reserves the credits of PixVerse's published price and the finished task settles on the credits PixVerse reports.
