// PixVerse Platform API (docs.platform.pixverse.ai): text to video, image to
// video and first/last frame transitions with V6 Max, C1, V6, V5.6, V5.5 and
// V5. Every request carries the API-KEY header and a fresh Ai-trace-id;
// generations answer {ErrCode, ErrMsg, Resp: {video_id}} and are polled at
// GET /openapi/v2/video/result/{video_id}. Generation endpoints take only
// PixVerse image ids, so images are first uploaded through the plugin's
// upload route, whose gateway task id later requests reference.
const VIDEO_MODELS = ["pixverse-v6-max", "pixverse-c1", "pixverse-v6", "pixverse-v5.6", "pixverse-v5.5", "pixverse-v5"];
const UPLOAD_MODEL = "pixverse-image-upload";
const MODEL_PREFIX = "pixverse-";

const ACTION_TEXT = "text_to_video";
const ACTION_IMAGE = "image_to_video";
const ACTION_TRANSITION = "transition";
const ACTION_UPLOAD = "upload";

const PATH_TEXT = "/openapi/v2/video/text/generate";
const PATH_IMAGE = "/openapi/v2/video/img/generate";
const PATH_TRANSITION = "/openapi/v2/video/transition/generate";
const PATH_UPLOAD = "/openapi/v2/image/upload";
const PATH_RESULT = "/openapi/v2/video/result/";

const QUALITIES = ["360p", "540p", "720p", "1080p"];
const WIDE_RATIOS = ["16:9", "9:16", "4:3", "3:4", "1:1", "2:3", "3:2", "21:9"];
const BASIC_RATIOS = ["16:9", "9:16", "4:3", "3:4", "1:1"];
const DEFAULT_QUALITY = "720p";
const DEFAULT_DURATION = 5;
const DEFAULT_RATIO = "16:9";
const MAX_SEED = 2147483647;
const IMAGE_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
const MAX_IMAGE_BYTES = 20 * 1024 * 1024;

// What each model accepts, from PixVerse's Model Capability Map and the
// endpoint schemas. durations is a list of allowed values, or [min, max]
// with range: true.
const PROFILES = {
  "v6-max": { durations: [1, 15], range: true, ratios: WIDE_RATIOS, audio: true, multiClip: false, actions: [ACTION_TEXT, ACTION_IMAGE] },
  c1: { durations: [1, 15], range: true, ratios: WIDE_RATIOS, audio: true, multiClip: false, actions: [ACTION_TEXT, ACTION_IMAGE, ACTION_TRANSITION] },
  v6: { durations: [1, 15], range: true, ratios: WIDE_RATIOS, audio: true, multiClip: true, actions: [ACTION_TEXT, ACTION_IMAGE, ACTION_TRANSITION] },
  "v5.6": { durations: [5, 8, 10], ratios: BASIC_RATIOS, audio: true, multiClip: false, no1080At: [10], actions: [ACTION_TEXT, ACTION_IMAGE, ACTION_TRANSITION] },
  "v5.5": { durations: [5, 8, 10], ratios: BASIC_RATIOS, audio: true, multiClip: true, no1080At: [10], actions: [ACTION_TEXT, ACTION_IMAGE] },
  v5: { durations: [5, 8], ratios: BASIC_RATIOS, audio: false, multiClip: false, actions: [ACTION_TEXT, ACTION_IMAGE, ACTION_TRANSITION] },
};

// PixVerse's published API prices in credits (225 credits = USD 1), from
// docs.platform.pixverse.ai "PixVerse API Pricing". They reserve a task's
// charge; a finished task settles on the credits PixVerse reports.
// Per generated second, by audio off / on and quality.
const CREDITS_PER_SECOND = {
  "v6-max": { off: { "360p": 6, "540p": 9, "720p": 11, "1080p": 22 }, on: { "360p": 9, "540p": 11, "720p": 15, "1080p": 28 } },
  c1: { off: { "360p": 6, "540p": 8, "720p": 10, "1080p": 19 }, on: { "360p": 8, "540p": 10, "720p": 13, "1080p": 24 } },
  v6: { off: { "360p": 5, "540p": 7, "720p": 9, "1080p": 18 }, on: { "360p": 7, "540p": 9, "720p": 12, "1080p": 23 } },
};
// Fixed credits per request, by duration, audio off / on and quality.
const CREDITS_PER_REQUEST = {
  "v5.6": {
    5: { off: { "360p": 35, "540p": 35, "720p": 45, "1080p": 75 }, on: { "360p": 80, "540p": 80, "720p": 90, "1080p": 120 } },
    8: { off: { "360p": 70, "540p": 70, "720p": 90, "1080p": 150 }, on: { "360p": 115, "540p": 115, "720p": 135, "1080p": 195 } },
    10: { off: { "360p": 77, "540p": 77, "720p": 99 }, on: { "360p": 122, "540p": 122, "720p": 144 } },
  },
  "v5.5": {
    5: { off: { "360p": 45, "540p": 45, "720p": 60, "1080p": 120 }, on: { "360p": 55, "540p": 55, "720p": 70, "1080p": 130 } },
    8: { off: { "360p": 90, "540p": 90, "720p": 120, "1080p": 240 }, on: { "360p": 100, "540p": 100, "720p": 130, "1080p": 250 } },
    10: { off: { "360p": 99, "540p": 99, "720p": 132 }, on: { "360p": 109, "540p": 109, "720p": 142 } },
  },
  "v5.5-multi": {
    5: { off: { "360p": 75, "540p": 75, "720p": 90, "1080p": 150 }, on: { "360p": 85, "540p": 85, "720p": 100, "1080p": 160 } },
    8: { off: { "360p": 120, "540p": 120, "720p": 150, "1080p": 270 }, on: { "360p": 130, "540p": 130, "720p": 160, "1080p": 280 } },
    10: { off: { "360p": 129, "540p": 129, "720p": 162 }, on: { "360p": 139, "540p": 139, "720p": 172 } },
  },
  v5: {
    5: { off: { "360p": 45, "540p": 45, "720p": 60, "1080p": 120 } },
    8: { off: { "360p": 90, "540p": 90, "720p": 120, "1080p": 240 } },
  },
};
// The highest credit count one task can cost: 15 seconds of V6 Max 1080p with
// audio.
const MAX_CREDITS = 420;

const COMMON_FIELDS = ["model", "prompt", "duration", "quality", "seed", "generate_audio_switch"];
const ACTION_FIELDS = {
  text_to_video: COMMON_FIELDS.concat(["aspect_ratio", "generate_multi_clip_switch"]),
  image_to_video: COMMON_FIELDS.concat(["img_id", "generate_multi_clip_switch"]),
  transition: COMMON_FIELDS.concat(["first_frame_img", "last_frame_img"]),
};
const MAX_PROMPT = { text_to_video: 5000, image_to_video: 2048, transition: 5000 };
const IMAGE_FIELDS = { image_to_video: ["img_id"], transition: ["first_frame_img", "last_frame_img"] };
// Fields PixVerse documents that this plugin does not forward, with the reason.
const REJECTED_FIELDS = {
  webhook_id: "webhook_id is not supported; the gateway polls the task",
  template_id: "template_id is not supported: template prices vary per template",
  img_ids: "img_ids is only used by templates, which are not supported",
  sound_effect_switch: "sound_effect_switch is a legacy option; use generate_audio_switch",
  sound_effect_content: "sound_effect_content is a legacy option; use generate_audio_switch",
  lip_sync_switch: "lip_sync_switch is a legacy option and is not supported",
  lip_sync_tts_content: "lip_sync_tts_content is a legacy option and is not supported",
  lip_sync_tts_speaker_id: "lip_sync_tts_speaker_id is a legacy option and is not supported",
};

export const meta = {
  "apiVersion": 1,
  "key": "byaiden_pixverse",
  "name": "PixVerse",
  "icon": "PixVerse.Color",
  "description": {
    "en": "PixVerse video generation (V6 Max, C1, V6, V5.6, V5.5, V5): text-to-video, image-to-video and first/last frame transitions, with image upload",
    "zh": "PixVerse 视频生成（V6 Max、C1、V6、V5.6、V5.5、V5）：文生视频、图生视频与首尾帧过渡，含图片上传"
  },
  "version": "1.0.0",
  "author": {
    "name": "ByAiden",
    "url": "https://github.com/ByAiden"
  },
  "website": "https://docs.platform.pixverse.ai/",
  "baseUrl": "https://app-api.pixverse.ai",
  "models": [
    "pixverse-v6-max",
    "pixverse-c1",
    "pixverse-v6",
    "pixverse-v5.6",
    "pixverse-v5.5",
    "pixverse-v5",
    "pixverse-image-upload"
  ],
  "fetchMode": "per_task",
  "usageSchema": {
    "credits": {
      "type": "number",
      "unit": "credit",
      "description": {
        "en": "PixVerse credit unit price",
        "zh": "PixVerse 积分单价"
      }
    },
    "seconds": {
      "type": "number",
      "unit": "second",
      "description": {
        "en": "Generated video unit price",
        "zh": "生成视频单价"
      }
    },
    "resolution": {
      "enum": [
        "360p",
        "540p",
        "720p",
        "1080p"
      ],
      "description": {
        "en": "Output video quality",
        "zh": "输出视频清晰度"
      }
    },
    "audio": {
      "type": "boolean",
      "description": {
        "en": "Native audio generated",
        "zh": "生成原生音频"
      }
    },
    "multi_clip": {
      "type": "boolean",
      "description": {
        "en": "Multi-clip generation",
        "zh": "多镜头生成"
      }
    }
  },
  "usageExamples": [
    {
      "label": "v6 720p 5s",
      "facts": {
        "credits": 45,
        "seconds": 5,
        "resolution": "720p",
        "audio": false,
        "multi_clip": false
      }
    },
    {
      "label": "v6 720p 8s audio",
      "facts": {
        "credits": 96,
        "seconds": 8,
        "resolution": "720p",
        "audio": true,
        "multi_clip": false
      }
    },
    {
      "label": "c1 1080p 5s",
      "facts": {
        "credits": 95,
        "seconds": 5,
        "resolution": "1080p",
        "audio": false,
        "multi_clip": false
      }
    },
    {
      "label": "v6-max 1080p 15s audio",
      "facts": {
        "credits": 420,
        "seconds": 15,
        "resolution": "1080p",
        "audio": true,
        "multi_clip": false
      }
    },
    {
      "label": "v5.6 720p 8s audio",
      "facts": {
        "credits": 135,
        "seconds": 8,
        "resolution": "720p",
        "audio": true,
        "multi_clip": false
      }
    },
    {
      "label": "v5.5 540p 5s multi-clip",
      "facts": {
        "credits": 75,
        "seconds": 5,
        "resolution": "540p",
        "audio": false,
        "multi_clip": true
      }
    },
    {
      "label": "v5 360p 5s",
      "facts": {
        "credits": 45,
        "seconds": 5,
        "resolution": "360p",
        "audio": false,
        "multi_clip": false
      }
    }
  ],
  "usageProfiles": [
    {
      "models": [
        "pixverse-v6-max",
        "pixverse-c1",
        "pixverse-v6",
        "pixverse-v5.6",
        "pixverse-v5.5",
        "pixverse-v5"
      ],
      "schema": {
        "credits": {
          "type": "number",
          "unit": "credit",
          "description": {
            "en": "PixVerse credit unit price",
            "zh": "PixVerse 积分单价"
          }
        },
        "seconds": {
          "type": "number",
          "unit": "second",
          "description": {
            "en": "Generated video unit price",
            "zh": "生成视频单价"
          }
        },
        "resolution": {
          "enum": [
            "360p",
            "540p",
            "720p",
            "1080p"
          ],
          "description": {
            "en": "Output video quality",
            "zh": "输出视频清晰度"
          }
        },
        "audio": {
          "type": "boolean",
          "description": {
            "en": "Native audio generated",
            "zh": "生成原生音频"
          }
        },
        "multi_clip": {
          "type": "boolean",
          "description": {
            "en": "Multi-clip generation",
            "zh": "多镜头生成"
          }
        }
      },
      "examples": [
        {
          "label": "v6 720p 5s",
          "facts": {
            "credits": 45,
            "seconds": 5,
            "resolution": "720p",
            "audio": false,
            "multi_clip": false
          }
        },
        {
          "label": "v6 720p 8s audio",
          "facts": {
            "credits": 96,
            "seconds": 8,
            "resolution": "720p",
            "audio": true,
            "multi_clip": false
          }
        },
        {
          "label": "c1 1080p 5s",
          "facts": {
            "credits": 95,
            "seconds": 5,
            "resolution": "1080p",
            "audio": false,
            "multi_clip": false
          }
        },
        {
          "label": "v6-max 1080p 15s audio",
          "facts": {
            "credits": 420,
            "seconds": 15,
            "resolution": "1080p",
            "audio": true,
            "multi_clip": false
          }
        },
        {
          "label": "v5.6 720p 8s audio",
          "facts": {
            "credits": 135,
            "seconds": 8,
            "resolution": "720p",
            "audio": true,
            "multi_clip": false
          }
        },
        {
          "label": "v5.5 540p 5s multi-clip",
          "facts": {
            "credits": 75,
            "seconds": 5,
            "resolution": "540p",
            "audio": false,
            "multi_clip": true
          }
        },
        {
          "label": "v5 360p 5s",
          "facts": {
            "credits": 45,
            "seconds": 5,
            "resolution": "360p",
            "audio": false,
            "multi_clip": false
          }
        }
      ]
    },
    {
      "models": [
        "pixverse-image-upload"
      ],
      "schema": {},
      "examples": []
    }
  ],
  "routes": [
    {
      "method": "POST",
      "path": "/openapi/v2/image/upload",
      "type": "submit",
      "decode": "uploadImage",
      "render": "imageUploaded"
    },
    {
      "method": "POST",
      "path": "/openapi/v2/video/text/generate",
      "type": "submit",
      "decode": "textToVideo",
      "render": "videoCreated"
    },
    {
      "method": "POST",
      "path": "/openapi/v2/video/img/generate",
      "type": "submit",
      "decode": "imageToVideo",
      "render": "videoCreated"
    },
    {
      "method": "POST",
      "path": "/openapi/v2/video/transition/generate",
      "type": "submit",
      "decode": "transition",
      "render": "videoCreated"
    },
    {
      "method": "GET",
      "path": "/openapi/v2/video/result/:video_id",
      "type": "query",
      "taskIdParam": "video_id",
      "render": "videoResult"
    }
  ],
  "protocols": [
    {
      "name": "openai_video",
      "models": [
        "pixverse-v6-max",
        "pixverse-c1",
        "pixverse-v6",
        "pixverse-v5.6",
        "pixverse-v5.5",
        "pixverse-v5"
      ]
    }
  ]
};

function trimmed(value) {
  return String(value === undefined || value === null ? "" : value).trim();
}

function plainObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : null;
}

function present(value) {
  return value !== undefined && value !== null;
}

function given(value) {
  return present(value) && value !== "";
}

// The public model name ("pixverse-v6") of a PixVerse name ("v6") or a
// public one.
function publicModel(name) {
  const text = trimmed(name).toLowerCase();
  const vendor = text.indexOf(MODEL_PREFIX) === 0 ? text.slice(MODEL_PREFIX.length) : text;
  return PROFILES[vendor] ? MODEL_PREFIX + vendor : "";
}

// The PixVerse model name the channel sends: the mapped name first, then the
// client's.
function vendorModel(identity) {
  for (const name of [identity.upstreamModel, identity.model]) {
    const model = publicModel(name);
    if (model) return model.slice(MODEL_PREFIX.length);
  }
  throw new Error("unsupported model: " + (trimmed(identity.upstreamModel) || trimmed(identity.model) || "(empty)"));
}

function booleanValue(value, name) {
  if (typeof value === "boolean") return value;
  if (value === "true" || value === "false") return value === "true";
  throw new Error(name + " must be true or false");
}

function integerValue(value, name) {
  const number = typeof value === "string" && value.trim() !== "" ? Number(value) : value;
  if (typeof number !== "number" || !Number.isInteger(number)) throw new Error(name + " must be an integer");
  return number;
}

// A reference to an image uploaded through this plugin: the gateway task id
// of the upload. PixVerse image ids belong to the gateway's account, so raw
// numeric ids are refused.
function imageRef(value, name) {
  if (typeof value !== "string" || !value.trim()) throw new Error(name + " must be the task id returned by the image upload route (POST " + PATH_UPLOAD + ")");
  return value.trim();
}

// Validates a PixVerse generation body for action and returns the body the
// plugin forwards, with defaults for the price-determining fields filled in.
function videoRequest(source, action, vendor) {
  const body = plainObject(source);
  if (!body) throw new Error("request body must be an object");
  const allowed = ACTION_FIELDS[action];
  for (const key of Object.keys(body)) {
    if (REJECTED_FIELDS[key]) throw new Error(REJECTED_FIELDS[key]);
    if (!allowed.includes(key)) throw new Error("request." + key + " is not supported");
  }
  const profile = PROFILES[vendor];
  if (!profile.actions.includes(action)) throw new Error(MODEL_PREFIX + vendor + " does not support " + action.replace(/_/g, "-"));
  const out = {};
  const prompt = trimmed(body.prompt);
  if (!prompt) throw new Error("prompt is required");
  if (prompt.length > MAX_PROMPT[action]) throw new Error("prompt must be at most " + MAX_PROMPT[action] + " characters");
  out.prompt = prompt;

  const duration = given(body.duration) ? integerValue(body.duration, "duration") : DEFAULT_DURATION;
  if (profile.range ? duration < profile.durations[0] || duration > profile.durations[1] : !profile.durations.includes(duration))
    throw new Error("duration for " + MODEL_PREFIX + vendor + " must be " + (profile.range ? profile.durations.join("-") + " seconds" : "one of " + profile.durations.join(", ")));
  out.duration = duration;

  const quality = given(body.quality) ? trimmed(body.quality).toLowerCase() : DEFAULT_QUALITY;
  if (!QUALITIES.includes(quality)) throw new Error("quality must be one of " + QUALITIES.join(", "));
  if (quality === "1080p" && (profile.no1080At || []).includes(duration)) throw new Error("1080p is not available for " + duration + "-second " + MODEL_PREFIX + vendor + " videos");
  out.quality = quality;

  if (action === ACTION_TEXT) {
    const ratio = given(body.aspect_ratio) ? trimmed(body.aspect_ratio) : DEFAULT_RATIO;
    if (!profile.ratios.includes(ratio)) throw new Error("aspect_ratio for " + MODEL_PREFIX + vendor + " must be one of " + profile.ratios.join(", "));
    out.aspect_ratio = ratio;
  }
  if (given(body.seed)) {
    const seed = integerValue(body.seed, "seed");
    if (seed < 0 || seed > MAX_SEED) throw new Error("seed must be between 0 and " + MAX_SEED);
    out.seed = seed;
  }
  const audio = given(body.generate_audio_switch) ? booleanValue(body.generate_audio_switch, "generate_audio_switch") : false;
  if (audio && !profile.audio) throw new Error(MODEL_PREFIX + vendor + " does not generate audio");
  if (profile.audio) out.generate_audio_switch = audio;
  if (action !== ACTION_TRANSITION) {
    const multiClip = given(body.generate_multi_clip_switch) ? booleanValue(body.generate_multi_clip_switch, "generate_multi_clip_switch") : false;
    if (multiClip && !profile.multiClip) throw new Error("generate_multi_clip_switch is only supported by pixverse-v6 and pixverse-v5.5");
    if (multiClip) out.generate_multi_clip_switch = true;
  }
  for (const field of IMAGE_FIELDS[action] || []) {
    if (!given(body[field])) throw new Error(field + " is required");
    out[field] = imageRef(body[field], field);
  }
  return out;
}

function estimatedCredits(body, vendor) {
  const audio = body.generate_audio_switch === true ? "on" : "off";
  const perSecond = CREDITS_PER_SECOND[vendor];
  if (perSecond) return Math.min(perSecond[audio][body.quality] * body.duration, MAX_CREDITS);
  const table = CREDITS_PER_REQUEST[vendor === "v5.5" && body.generate_multi_clip_switch ? "v5.5-multi" : vendor];
  const credits = ((table[body.duration] || {})[audio] || {})[body.quality];
  return credits > 0 ? credits : MAX_CREDITS;
}

function usageFacts(body, vendor) {
  return {
    credits: estimatedCredits(body, vendor),
    seconds: body.duration,
    resolution: body.quality,
    audio: body.generate_audio_switch === true,
    multi_clip: body.generate_multi_clip_switch === true,
  };
}

function videoIntent(model, action, body) {
  const intent = { kind: "submit", model: model, action: action, requestBody: Object.assign({ model: model }, body) };
  const ids = [];
  for (const field of IMAGE_FIELDS[action] || []) if (body[field] && !ids.includes(body[field])) ids.push(body[field]);
  if (ids.length) intent.originTaskIds = ids;
  return intent;
}

function imageURL(value) {
  const url = trimmed(value);
  if (!/^https?:\/\/[^\s]+$/i.test(url)) throw new Error("image_url must be an http(s) URL");
  return url;
}

// The upload body: a multipart form with one image file (field image) or an
// image_url field. PixVerse's upload endpoint takes multipart only, and the
// gateway rebuilds the upstream multipart form from the client's own one.
function uploadRequest(body) {
  if (!body || body.kind !== "multipart") throw new Error("multipart/form-data body required with an image file or an image_url field");
  const fields = body.fields || {};
  for (const key of Object.keys(fields)) {
    if (key !== "image_url") throw new Error("request." + key + " is not supported");
    if (fields[key].length > 1) throw new Error("image_url must be provided once");
  }
  const files = body.files || [];
  for (const file of files) if (file.field !== "image") throw new Error("unexpected file field: " + file.field);
  const url = fields.image_url ? trimmed(fields.image_url[0]) : "";
  if (files.length + (url ? 1 : 0) !== 1) throw new Error("provide exactly one of image or image_url");
  if (url) return { image_url: imageURL(url) };
  const file = files[0];
  const mimeType = trimmed(file.mimeType).toLowerCase();
  if (!IMAGE_TYPES.includes(mimeType)) throw new Error("image must be JPEG, PNG or WebP");
  if (file.size >= MAX_IMAGE_BYTES) throw new Error("image must be smaller than 20 MB");
  return { image: { ref: file.ref, filename: trimmed(file.filename) || "image", mimeType: mimeType } };
}

function uploadIntent(request) {
  return { kind: "submit", model: UPLOAD_MODEL, action: ACTION_UPLOAD, requestBody: Object.assign({ model: UPLOAD_MODEL }, request) };
}

// PixVerse asks for a new UUID per request. A submission derives it from the
// gateway task id, so the vendor log and the gateway task correlate.
function traceId(seed) {
  let hex = "";
  if (seed && typeof utils.sha256 === "function") hex = String(utils.sha256("pixverse-trace:" + seed));
  if (!/^[0-9a-f]{32}/.test(hex)) return utils.uuid();
  const variant = ((parseInt(hex[16], 16) & 3) | 8).toString(16);
  return hex.slice(0, 8) + "-" + hex.slice(8, 12) + "-4" + hex.slice(13, 16) + "-" + variant + hex.slice(17, 20) + "-" + hex.slice(20, 32);
}

function vendorHeaders(ctx, trace) {
  return { "API-KEY": ctx.apiKey || "", "Ai-trace-id": trace, Accept: "application/json" };
}

function pixverseError(body) {
  const object = plainObject(body) || {};
  const detail = plainObject(object.Error);
  const message = trimmed(detail && detail.Message) || trimmed(object.ErrMsg) || "unknown error";
  return "PixVerse error " + trimmed(object.ErrCode) + ": " + message;
}

function resp(body) {
  const object = plainObject(body);
  return object ? plainObject(object.Resp) : null;
}

// The PixVerse image id of a referenced upload task.
function uploadedImageId(ref, originTasks) {
  for (const task of originTasks || []) {
    if (!task || task.taskId !== ref) continue;
    if (task.action !== ACTION_UPLOAD) throw new Error(ref + " is not an image upload task");
    const data = resp(task.data);
    const id = data && present(data.img_id) ? data.img_id : trimmed(task.upstreamTaskId);
    const number = Number(id);
    if (!Number.isInteger(number) || number < 1) throw new Error("image " + ref + " is not available");
    return number;
  }
  throw new Error("image " + ref + " is not available");
}

function videoStatus(body) {
  const data = resp(body);
  return data ? Number(data.status) : NaN;
}

function videoURL(body) {
  const data = resp(body);
  return data && videoStatus(body) === 1 ? trimmed(data.url) : "";
}

// PixVerse's result without the fields that describe the gateway's account.
function publicResult(body, taskId, url) {
  const data = resp(body) || {};
  const out = {};
  for (const key of Object.keys(data)) {
    if (key === "customer_paths" || key === "path") continue;
    out[key] = data[key];
  }
  out.id = taskId;
  if (url) out.url = url;
  else if (out.status !== 1) out.url = "";
  return out;
}

export const native = {
  uploadImage: function (ctx) {
    return uploadIntent(uploadRequest(ctx.body));
  },
  textToVideo: function (ctx) {
    return nativeVideo(ctx, ACTION_TEXT);
  },
  imageToVideo: function (ctx) {
    return nativeVideo(ctx, ACTION_IMAGE);
  },
  transition: function (ctx) {
    return nativeVideo(ctx, ACTION_TRANSITION);
  },
  imageUploaded: function (ctx, task) {
    const data = resp(task.data) || {};
    const out = { img_id: task.task_id };
    if (trimmed(data.img_url)) out.img_url = trimmed(data.img_url);
    return { ErrCode: 0, ErrMsg: "success", Resp: out };
  },
  videoCreated: function (ctx, task) {
    const data = resp(task.data) || {};
    const out = { video_id: task.task_id };
    if (typeof data.credits === "number") out.credits = data.credits;
    return { ErrCode: 0, ErrMsg: "success", Resp: out };
  },
  videoResult: function (ctx, task) {
    if (task.action === ACTION_UPLOAD) return native.imageUploaded(ctx, task);
    const status = videoStatus(task.data);
    const artifact = ctx.artifacts && ctx.artifacts.video;
    const url = artifact && trimmed(artifact.url);
    // Before the first poll the task holds the submit reply, and the gateway
    // can fail a task PixVerse still reports as running.
    if (task.status === "FAILURE" && status !== 7 && status !== 8)
      return { ErrCode: 0, ErrMsg: task.fail_reason || "generation failed", Resp: Object.assign(publicResult(task.data, task.task_id, ""), { id: task.task_id, status: 8 }) };
    if (status !== 1 && status !== 5 && status !== 7 && status !== 8) return { ErrCode: 0, ErrMsg: "success", Resp: { id: task.task_id, status: 5, url: "" } };
    return { ErrCode: 0, ErrMsg: "success", Resp: publicResult(task.data, task.task_id, url) };
  },
  error: function (ctx, error) {
    return { ErrCode: error.httpStatus || 500, ErrMsg: error.message, Resp: null, Error: { Type: error.code, Message: error.message, Param: {} } };
  },
};

function nativeVideo(ctx, action) {
  if (!ctx.body || ctx.body.kind !== "json") throw new Error("JSON body required");
  const body = plainObject(ctx.body.value);
  if (!body) throw new Error("request body must be an object");
  if (!given(body.model)) throw new Error("model is required");
  const model = publicModel(body.model);
  if (!model) throw new Error("unsupported model: " + trimmed(body.model));
  return videoIntent(model, action, videoRequest(body, action, model.slice(MODEL_PREFIX.length)));
}

function requestAction(ctx) {
  const body = plainObject(ctx.requestBody) || {};
  if (ctx.action === ACTION_UPLOAD || ctx.action === ACTION_TEXT || ctx.action === ACTION_IMAGE || ctx.action === ACTION_TRANSITION) return ctx.action;
  if (given(body.first_frame_img) || given(body.last_frame_img)) return ACTION_TRANSITION;
  if (given(body.img_id)) return ACTION_IMAGE;
  if (present(body.image) || given(body.image_url)) return ACTION_UPLOAD;
  return ACTION_TEXT;
}

function withoutModel(body) {
  const out = Object.assign({}, plainObject(body) || {});
  delete out.model;
  return out;
}

export function buildSubmitRequest(ctx) {
  const action = requestAction(ctx);
  if (action === ACTION_UPLOAD) {
    const request = withoutModel(ctx.requestBody);
    const parts = [];
    if (plainObject(request.image)) parts.push({ name: "image", fileRef: request.image.ref, filename: request.image.filename });
    else parts.push({ name: "image_url", value: imageURL(request.image_url) });
    return { url: ctx.baseUrl + PATH_UPLOAD, method: "POST", headers: vendorHeaders(ctx, traceId(ctx.publicTaskId)), bodyType: "multipart", parts: parts, action: action };
  }
  const vendor = vendorModel(ctx);
  const body = videoRequest(withoutModel(ctx.requestBody), action, vendor);
  for (const field of IMAGE_FIELDS[action] || []) body[field] = uploadedImageId(body[field], ctx.originTasks);
  const out = Object.assign({ model: vendor }, body);
  const path = action === ACTION_IMAGE ? PATH_IMAGE : action === ACTION_TRANSITION ? PATH_TRANSITION : PATH_TEXT;
  const headers = vendorHeaders(ctx, traceId(ctx.publicTaskId));
  headers["Content-Type"] = "application/json";
  return { url: ctx.baseUrl + path, method: "POST", headers: headers, body: out, action: action };
}

// PixVerse answers HTTP 200 with a nonzero ErrCode when it refuses a request;
// throwing fails the submission so the gateway refunds it.
export function parseSubmitResponse(ctx, response) {
  const body = plainObject(response.body);
  if (!body || Number(body.ErrCode) !== 0) throw new Error(pixverseError(body));
  const data = resp(body) || {};
  if (requestAction(ctx) === ACTION_UPLOAD) {
    const id = Number(data.img_id);
    if (!Number.isInteger(id) || id < 1) throw new Error("PixVerse did not return an image id");
    return { taskId: String(id), taskData: body, immediate: { status: "SUCCESS", progress: "100%" } };
  }
  const id = Number(data.video_id);
  if (!Number.isInteger(id) || id < 1) throw new Error("PixVerse did not return a video id");
  const result = { taskId: String(id), taskData: body };
  if (Number(data.credits) > 0) result.state = { credits: Number(data.credits) };
  return result;
}

export function extractUsage(ctx) {
  // Legacy per-call prices have no ratio to scale.
  if (ctx.usagePurpose === "billing_ratios") return null;
  const action = requestAction(ctx);
  if (action === ACTION_UPLOAD) return {};
  const vendor = vendorModel(ctx);
  return usageFacts(videoRequest(withoutModel(ctx.requestBody), action, vendor), vendor);
}

export function buildQueryRequest(ctx) {
  return { url: ctx.baseUrl + PATH_RESULT + encodeURIComponent(ctx.taskId), method: "GET", headers: vendorHeaders(ctx, traceId("")) };
}

// status 1 done, 5 generating, 7 moderation failed, 8 generation failed.
export function parseTaskResult(ctx, body) {
  const object = plainObject(body);
  if (!object) return { status: "UNKNOWN", reason: "PixVerse returned no result" };
  const code = Number(object.ErrCode);
  // 500008 not found, 500064 deleted, 500085 another account's task.
  if (code === 500008 || code === 500064 || code === 500085) return { status: "FAILURE", reason: pixverseError(object) };
  if (code !== 0) return { status: "UNKNOWN", reason: pixverseError(object) };
  const status = videoStatus(object);
  // PixVerse calls a task done once status is 1 and the URL is set.
  if (status === 1) return videoURL(object) ? { status: "SUCCESS", progress: "100%" } : { status: "IN_PROGRESS" };
  if (status === 5) return { status: "IN_PROGRESS" };
  if (status === 7) return { status: "FAILURE", reason: "PixVerse content moderation failed" };
  if (status === 8) return { status: "FAILURE", reason: "PixVerse generation failed" };
  return { status: "UNKNOWN", reason: "unrecognized PixVerse status: " + trimmed(resp(object) ? resp(object).status : "") };
}

// A finished task settles on the credits PixVerse reports for it, else on
// the credits of the submit reply; without either the reservation stays.
export function extractUsageOnComplete(task, result, body) {
  if (task && task.action === ACTION_UPLOAD) return null;
  if (videoStatus(body) !== 1) return null;
  const data = resp(body) || {};
  const state = plainObject(task && task.state) || {};
  let credits = Number(data.credits);
  if (!(credits > 0) || !Number.isFinite(credits)) credits = Number(state.credits);
  if (!(credits > 0) || !Number.isFinite(credits)) return null;
  return { credits: Math.min(credits, MAX_CREDITS) };
}

export function listArtifacts(task) {
  if (task.status !== "SUCCESS" || task.action === ACTION_UPLOAD || !videoURL(task.data)) return [];
  return [{ key: "video", type: "video", mimeType: "video/mp4" }];
}

// Downloads ask PixVerse for the current URL first and fall back to the URL
// from the last poll.
export function buildContentRequest(ctx) {
  if (ctx.artifactKey !== "video") throw new Error("artifact_not_found");
  let url = "";
  if (trimmed(ctx.upstreamTaskId)) {
    try {
      const response = utils.fetch({ url: ctx.baseUrl + PATH_RESULT + encodeURIComponent(ctx.upstreamTaskId), headers: vendorHeaders(ctx, traceId("")) });
      if (response.status === 200) url = videoURL(response.body);
    } catch (_error) {
      url = "";
    }
  }
  if (!url) url = videoURL(ctx.data);
  if (!url) throw new Error("artifact_not_found");
  return { url: url, method: ctx.clientRequest.method, credentialless: true };
}

// OpenAI-style WIDTHxHEIGHT sizes select the quality of the shorter side and
// the exact aspect ratio; a bare quality ("720p") is accepted too.
function sizeOptions(size) {
  const text = trimmed(size).toLowerCase();
  if (QUALITIES.includes(text)) return { quality: text };
  const parts = text.replace("*", "x").split("x");
  const width = Number(parts[0]);
  const height = Number(parts[1]);
  if (parts.length !== 2 || !Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1)
    throw new Error("size must be WIDTHxHEIGHT or one of " + QUALITIES.join(", "));
  const shorter = Math.min(width, height);
  const quality = QUALITIES.find(function (value) {
    return Number(value.slice(0, -1)) === shorter;
  });
  const ratio = WIDE_RATIOS.find(function (value) {
    const sides = value.split(":").map(Number);
    return Math.abs(width / height - sides[0] / sides[1]) < 0.01;
  });
  if (!quality || !ratio) throw new Error("size " + text + " has no PixVerse quality and aspect ratio; use for example 1280x720 or 720x1280");
  return { quality: quality, aspect_ratio: ratio };
}

const OPENAI_FIELDS = ["model", "prompt", "seconds", "size", "input_reference", "user", "metadata"];
const OPENAI_EXTRAS = ["duration", "quality", "aspect_ratio", "seed", "generate_audio_switch", "generate_multi_clip_switch", "img_id", "first_frame_img", "last_frame_img"];

// The OpenAI video API: prompt, seconds, size and input_reference (the task
// id of an uploaded image), plus PixVerse's own fields. first_frame_img and
// last_frame_img make a transition.
function openAIVideoRequest(req) {
  for (const key of Object.keys(req)) {
    if (REJECTED_FIELDS[key]) throw new Error(REJECTED_FIELDS[key]);
    if (!OPENAI_FIELDS.includes(key) && !OPENAI_EXTRAS.includes(key)) throw new Error("request." + key + " is not supported");
  }
  const body = {};
  if (present(req.prompt)) body.prompt = req.prompt;
  const seconds = given(req.seconds) ? req.seconds : req.duration;
  if (given(seconds)) body.duration = seconds;
  const sized = given(req.size) ? sizeOptions(req.size) : {};
  const quality = given(req.quality) ? req.quality : sized.quality;
  if (quality) body.quality = quality;
  for (const key of ["seed", "generate_audio_switch", "generate_multi_clip_switch"]) if (given(req[key])) body[key] = req[key];
  const image = given(req.img_id) ? req.img_id : req.input_reference;
  let action = ACTION_TEXT;
  if (given(req.first_frame_img) || given(req.last_frame_img)) {
    action = ACTION_TRANSITION;
    if (given(image) && given(req.first_frame_img)) throw new Error("give the first frame once: input_reference or first_frame_img");
    body.first_frame_img = given(req.first_frame_img) ? req.first_frame_img : image;
    body.last_frame_img = req.last_frame_img;
    delete body.generate_multi_clip_switch;
    if (given(req.generate_multi_clip_switch)) throw new Error("generate_multi_clip_switch is not supported for transitions");
  } else if (given(image)) {
    action = ACTION_IMAGE;
    body.img_id = image;
  }
  // An image sets the frame of image-to-video and transition videos.
  if (action === ACTION_TEXT) {
    const ratio = given(req.aspect_ratio) ? req.aspect_ratio : sized.aspect_ratio;
    if (ratio) body.aspect_ratio = ratio;
  } else if (given(req.aspect_ratio)) throw new Error("aspect_ratio is only supported for text-to-video; the image sets the frame");
  return { action: action, body: body };
}

function protocolModel(ctx) {
  return publicModel(ctx.upstreamModel) || publicModel(ctx.model);
}

export const protocols = {
  openai_video: {
    decodeRequest: function (ctx) {
      if (!ctx.body || (ctx.body.kind !== "json" && ctx.body.kind !== "multipart")) throw new Error("JSON or multipart body required");
      let req;
      if (ctx.body.kind === "json") {
        req = plainObject(ctx.body.value);
        if (!req) throw new Error("JSON object required");
        const reference = plainObject(req.input_reference);
        if (reference) req = Object.assign({}, req, { input_reference: reference.task_id || reference.id });
      } else {
        if ((ctx.body.files || []).length)
          throw new Error("image files are not accepted here: upload the image to POST " + PATH_UPLOAD + " and pass its task id as input_reference");
        req = {};
        const fields = ctx.body.fields || {};
        for (const name of Object.keys(fields)) {
          if (fields[name].length > 1) throw new Error(name + " must be provided once");
          req[name] = fields[name][0];
        }
      }
      const model = protocolModel(ctx);
      if (!model) throw new Error("unsupported model: " + trimmed(ctx.model));
      const request = openAIVideoRequest(req);
      return videoIntent(ctx.model, request.action, videoRequest(request.body, request.action, model.slice(MODEL_PREFIX.length)));
    },
    // The host owns id, status, progress and timestamps.
    render: function (ctx, task) {
      const output = { object: "video" };
      if (task.status === "FAILURE") output.error = { code: videoStatus(task.data) === 7 ? "content_moderation_failed" : "video_generation_failed", message: task.fail_reason || "generation failed" };
      return output;
    },
  },
};
