---
changelogVersion: 1
plugin: byaiden_pixverse
version: 1.1.0
locale: "en"
translations:
  zh-CN: CHANGELOG.zh-CN.md
---

# Changelog

## [1.1.0]

### Added

- Use this plugin on a New API channel (type 60) whose upstream is another New API gateway with the same plugin installed: requests go to that gateway's `/{key}/openapi/v2/...` routes with its token as a Bearer header, uploaded images are referenced by that gateway's task ids, downloads come from its task content route, and tasks settle on the PixVerse credits that gateway passes on.
