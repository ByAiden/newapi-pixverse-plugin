---
translations:
  zh-CN: README.zh-CN.md
---
# PixVerse

**English** | [简体中文](README.zh-CN.md)

Generates videos with the PixVerse platform API: text to video, image to video and first and last frame transitions, with `pixverse-v6-max`, `pixverse-c1`, `pixverse-v6`, `pixverse-v5.6`, `pixverse-v5.5` and `pixverse-v5`.

It covers the current PixVerse generation models. The older `v4`, `v4.5`, `v3.5` and `v5-fast` models are not offered: PixVerse publishes no price for them.

## Channel setup

- Install the plugin, then add a channel of the Task Plugin type and bind it to `byaiden_pixverse`.
- The key is an API key from the [PixVerse API Platform](https://platform.pixverse.ai). PixVerse bills API credits separately from the PixVerse web app; buy them on the Billing page of the platform.
- The API address is `https://app-api.pixverse.ai`. The plugin sends the key in the `API-KEY` header and a fresh `Ai-trace-id` with every request.
- Add the models you offer to the channel. A channel can also offer them under other names through model mapping.

## Models and endpoints

| Endpoint | What it does | Models |
| --- | --- | --- |
| `POST /v1/videos` | Creates a video from a prompt. `input_reference` (the task id of an uploaded image) makes an image to video video; `first_frame_img` and `last_frame_img` make a transition. | video models |
| `POST /byaiden_pixverse/openapi/v2/image/upload` | Uploads an image for later video requests: one `image` file part or one `image_url` field, as `multipart/form-data`. Answers with the task id to use as `img_id`. | `pixverse-image-upload` |
| `POST /byaiden_pixverse/openapi/v2/video/text/generate` | Text to video with PixVerse's own body. | video models |
| `POST /byaiden_pixverse/openapi/v2/video/img/generate` | Image to video with PixVerse's own body. | video models |
| `POST /byaiden_pixverse/openapi/v2/video/transition/generate` | First and last frame transition with PixVerse's own body. | video models |
| `GET /byaiden_pixverse/openapi/v2/video/result/{task_id}` | Reads a PixVerse task. | video models |

The video models are `pixverse-v6-max`, `pixverse-c1`, `pixverse-v6`, `pixverse-v5.6`, `pixverse-v5.5` and `pixverse-v5`. A request body names the PixVerse model (`v6-max`, `c1`, `v6`, `v5.6`, `v5.5`, `v5`) or the public model name; the plugin sends the PixVerse name upstream.

A video request takes `prompt`, `duration`, `quality` (`360p`, `540p`, `720p`, `1080p`), `aspect_ratio`, `seed`, `generate_audio_switch` and, where the model supports it, `generate_multi_clip_switch`. An image request takes `img_id`; a transition takes `first_frame_img` and `last_frame_img`. These image ids are the task ids of this plugin's upload route, never raw PixVerse image ids: the plugin resolves them to the image ids of your PixVerse account.

For videos, clients poll `GET /v1/videos/{task_id}` and download the file from `GET /v1/videos/{task_id}/content`.

## Billing

PixVerse prices its API in credits, and 225 credits are worth USD 1. The plugin reports the facts of a task, never a price:

- "PixVerse credit unit price" counts the credits of the task. The request reserves the credits of PixVerse's published price for the requested model, quality, duration and audio setting, and the finished task settles on the credits PixVerse reports.
- "Generated video unit price" counts the seconds of the finished video.
- "Output video quality" gives each quality its own price.
- "Native audio generated" and "Multi-clip generation" tell the two price switches apart.

PixVerse bills V6 Max, C1 and V6 per generated second, and V5.6, V5.5 and V5 per request. One expression covers all of them, because the credits already carry the model's own rate:

```
tier("base", u("credits") / 225 * M)
```

`M` is the margin: `1` charges PixVerse's list price. To charge a fixed price per second instead, use the seconds and the quality:

```
tier("base", (u("resolution") == "1080p" ? 0.080 : u("resolution") == "720p" ? 0.040 : u("resolution") == "540p" ? 0.031 : 0.022) * u("seconds") * M)
```

The image upload is not billable and has no price field.

## Example

Upload an image, then use its task id:

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

## Limits

- `pixverse-v6-max` and `pixverse-c1` make 1 to 15 seconds, `pixverse-v6` 1 to 15 seconds, `pixverse-v5.6` and `pixverse-v5.5` 5, 8 or 10 seconds, and `pixverse-v5` 5 or 8 seconds.
- `pixverse-v5.6` and `pixverse-v5.5` have no 1080p at 10 seconds. `pixverse-v5.5` and `pixverse-v6` are the only models with multi-clip generation; `pixverse-v5` is the only one of these without native audio.
- `pixverse-v6-max` supports text to video and image to video only. `pixverse-v5.5` supports text to video and image to video only, and `pixverse-v5` has no multi-clip generation.
- The aspect ratios are `16:9`, `9:16`, `4:3`, `3:4`, `1:1`, `2:3`, `3:2` and `21:9`; the V5 family takes only `16:9`, `9:16`, `4:3`, `3:4` and `1:1`.
- An uploaded image is JPEG, PNG or WebP and smaller than 20 MB.
- The upload route takes `multipart/form-data` with exactly one `image` file part or one `image_url` field.
- PixVerse's own effect templates, video references, video extension, upscaling, restyling, lip sync, sound effects and avatar endpoints are not covered; their prices differ per capability and per template.
- PixVerse's API is not idempotent: a retried request creates and charges a new video. The gateway waits up to its protocol timeout (600 seconds by default).
- Requests with `webhook_id` or `callback_url` are refused. Poll the task instead.
