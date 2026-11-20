---
changelogVersion: 1
plugin: byaiden_pixverse
version: "1.1.1"
locale: "en"
translations:
  zh-CN: CHANGELOG.zh-CN.md
---

# Changelog

## [1.1.1]

### Fixed

- The README price expressions now display as a price table on the gateway's model page: the credit expression is `u("credits") * 0.0044444444444` (USD 1 / 225 per credit, less than USD 0.000000001 below the list price per 10,000 credits) instead of `u("credits") / 225 * M`, and the per-second expression is a chain with one tier per quality instead of a nested condition. The README now says to multiply each number by the margin.
