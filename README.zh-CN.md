---
locale: zh-CN
---
# PixVerse

[English](README.md) | **简体中文**

使用 PixVerse 官方平台 API 生成视频：文生视频、图生视频和首尾帧过渡，支持 `pixverse-v6-max`、`pixverse-c1`、`pixverse-v6`、`pixverse-v5.6`、`pixverse-v5.5` 和 `pixverse-v5`。

本插件覆盖 PixVerse 当前的生成模型。较早的 `v4`、`v4.5`、`v3.5` 和 `v5-fast` 没有提供，因为 PixVerse 没有公布它们的价格。

## 渠道设置

- 安装插件后，新建一个「任务插件」类型的渠道，绑定 `byaiden_pixverse`。
- 密钥填 [PixVerse API Platform](https://platform.pixverse.ai) 创建的 API Key。PixVerse 的 API 积分与 PixVerse 网页版订阅分开计费，请在平台的 Billing 页面购买。
- API 地址是 `https://app-api.pixverse.ai`。插件把密钥放在 `API-KEY` 请求头里，并为每次请求生成新的 `Ai-trace-id`。
- 把要提供的模型加到渠道里；也可以通过模型映射用别的名字提供。

## 模型与接口

| 接口 | 作用 | 模型 |
| --- | --- | --- |
| `POST /v1/videos` | 根据提示词创建视频。`input_reference`（上传图片得到的任务 id）表示图生视频，`first_frame_img` 与 `last_frame_img` 表示首尾帧过渡。 | 视频模型 |
| `POST /byaiden_pixverse/openapi/v2/image/upload` | 上传图片供后续视频请求使用：以 `multipart/form-data` 提交一个 `image` 文件部分或一个 `image_url` 字段，返回可作为 `img_id` 的任务 id。 | `pixverse-image-upload` |
| `POST /byaiden_pixverse/openapi/v2/video/text/generate` | 使用 PixVerse 原始请求体做文生视频。 | 视频模型 |
| `POST /byaiden_pixverse/openapi/v2/video/img/generate` | 使用 PixVerse 原始请求体做图生视频。 | 视频模型 |
| `POST /byaiden_pixverse/openapi/v2/video/transition/generate` | 使用 PixVerse 原始请求体做首尾帧过渡。 | 视频模型 |
| `GET /byaiden_pixverse/openapi/v2/video/result/{task_id}` | 查询 PixVerse 任务。 | 视频模型 |

视频模型为 `pixverse-v6-max`、`pixverse-c1`、`pixverse-v6`、`pixverse-v5.6`、`pixverse-v5.5` 和 `pixverse-v5`。请求体里可以写 PixVerse 的模型名（`v6-max`、`c1`、`v6`、`v5.6`、`v5.5`、`v5`），也可以写对外的模型名；插件上送 PixVerse 的模型名。

视频请求可传 `prompt`、`duration`、`quality`（`360p`、`540p`、`720p`、`1080p`）、`aspect_ratio`、`seed`、`generate_audio_switch`，模型支持时还可传 `generate_multi_clip_switch`。图生视频传 `img_id`，首尾帧过渡传 `first_frame_img` 和 `last_frame_img`。这里的图片 id 必须是本插件上传接口返回的任务 id，不能直接写 PixVerse 的图片 id：插件会把它换成你账号下的 PixVerse 图片 id。

视频任务的客户端轮询 `GET /v1/videos/{task_id}`，并从 `GET /v1/videos/{task_id}/content` 下载文件。

## 定价

PixVerse 的 API 以积分计费，225 积分等于 1 美元。插件只上报用量事实，不上报价格：

- 「PixVerse 积分单价」统计任务消耗的积分。提交时按请求的模型、清晰度、时长和音频开关预留 PixVerse 公布的积分，任务完成后按 PixVerse 报告的积分结算。
- 「生成视频单价」统计成片的秒数。
- 「输出视频清晰度」为每种清晰度单独定价。
- 「生成原生音频」和「多镜头生成」区分两个计费开关。

PixVerse 对 V6 Max、C1、V6 按生成秒数计费，对 V5.6、V5.5、V5 按次计费。积分本身已经包含模型的费率，所以一个表达式即可覆盖全部模型：

```
tier("base", u("credits") / 225 * M)
```

`M` 是利润率，`1` 表示按 PixVerse 的官方价格收费。如果想改成按秒固定计价，可用秒数与清晰度：

```
tier("base", (u("resolution") == "1080p" ? 0.080 : u("resolution") == "720p" ? 0.040 : u("resolution") == "540p" ? 0.031 : 0.022) * u("seconds") * M)
```

图片上传不计费，没有价格字段。

## 示例

先上传图片，再使用它返回的任务 id：

```bash
curl https://your-gateway.example.com/byaiden_pixverse/openapi/v2/image/upload \
  -H "Authorization: Bearer ***" \
  -F "image=@first-frame.png"
```

```bash
curl https://your-gateway.example.com/v1/videos \
  -H "Authorization: Bearer ***" \
  -H "Content-Type: application/json" \
  -d '{"model": "pixverse-v6", "prompt": "A fox trotting through fresh snow", "seconds": "8", "size": "1280x720"}'
```

```bash
curl https://your-gateway.example.com/v1/videos \
  -H "Authorization: Bearer ***" \
  -H "Content-Type: application/json" \
  -d '{"model": "pixverse-c1", "prompt": "The character turns into a robot", "seconds": "5", "first_frame_img": "task_upload_id", "last_frame_img": "task_other_upload_id"}'
```

## 限制

- `pixverse-v6-max` 与 `pixverse-c1` 可生成 1 到 15 秒，`pixverse-v6` 1 到 15 秒，`pixverse-v5.6` 与 `pixverse-v5.5` 为 5、8 或 10 秒，`pixverse-v5` 为 5 或 8 秒。
- `pixverse-v5.6` 与 `pixverse-v5.5` 在 10 秒时没有 1080p。只有 `pixverse-v5.5` 和 `pixverse-v6` 支持多镜头生成；这些模型中只有 `pixverse-v5` 不生成原生音频。
- `pixverse-v6-max` 只支持文生视频和图生视频；`pixverse-v5.5` 也只支持文生视频和图生视频；`pixverse-v5` 不支持多镜头生成。
- 可用画幅为 `16:9`、`9:16`、`4:3`、`3:4`、`1:1`、`2:3`、`3:2`、`21:9`，V5 系列只支持 `16:9`、`9:16`、`4:3`、`3:4`、`1:1`。
- 上传的图片需为 JPEG、PNG 或 WebP，且小于 20 MB。
- 上传接口只接受 `multipart/form-data`，且只能有一个 `image` 文件部分或一个 `image_url` 字段。
- PixVerse 的特效模板、视频参考、视频延长、超清、重绘、对口型、音效和数字人接口不在覆盖范围内：它们的价格按能力和模板各不相同。
- PixVerse 的 API 不具备幂等性，重试请求会新建并重新计费一次视频。网关最长等待到协议超时（默认 600 秒）。
- 带 `webhook_id` 或 `callback_url` 的请求会被拒绝，请改为轮询任务。
