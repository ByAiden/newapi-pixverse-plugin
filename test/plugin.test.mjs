import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash, randomUUID } from "node:crypto";

globalThis.utils = {
  uuid: () => randomUUID(),
  sha256: (data) => createHash("sha256").update(String(data)).digest("hex"),
  fetch: () => ({ status: 200, headers: {}, body: {} }),
};

const plugin = await import("../plugin.js");
const source = readFileSync(new URL("../plugin.js", import.meta.url), "utf8");

const BASE = "https://app-api.pixverse.ai";
const KEY = plugin.meta.key;

function driver(requestBody, extra) {
  return Object.assign(
    {
      requestBody,
      requestHeaders: { "Content-Type": "application/json", Accept: "" },
      action: "",
      model: "pixverse-v6",
      upstreamModel: "pixverse-v6",
      baseUrl: BASE,
      apiKey: "test-key",
      authHeader: "Bearer test-key",
      upstream: { kind: "vendor" },
      config: {},
      files: [],
      publicTaskId: "task_public",
    },
    extra || {},
  );
}

// A video task as the host stores it after a poll.
const DONE = {
  ErrCode: 0,
  ErrMsg: "success",
  Resp: { id: 5001, status: 1, url: "https://media.example/v5001.mp4", credits: 40, customer_paths: { a: 1 } },
};
const RUNNING = { ErrCode: 0, ErrMsg: "success", Resp: { id: 5001, status: 5, url: "" } };

function queryContext(extra) {
  return Object.assign(
    {
      taskId: "5001",
      publicTaskId: "task_public",
      action: "text_to_video",
      model: "pixverse-v6",
      upstreamModel: "pixverse-v6",
      baseUrl: BASE,
      apiKey: "test-key",
      authHeader: "Bearer test-key",
      upstream: { kind: "vendor" },
      config: {},
      data: DONE,
      state: null,
    },
    extra || {},
  );
}

test("meta is a plain JSON literal equal to the exported meta", () => {
  const start = source.indexOf("export const meta = {");
  const block = source.slice(start, source.indexOf("\n};", start) + 2);
  const json = block.slice(block.indexOf("{")).replace(/;\s*$/, "");
  assert.deepEqual(JSON.parse(json), plugin.meta);
});

test("meta follows the marketplace naming rules", () => {
  assert.match(plugin.meta.key, /^[a-z0-9_]{1,30}$/);
  assert.match(plugin.meta.version, /^\d+\.\d+\.\d+$/);
  assert.equal(plugin.meta.apiVersion, 1);
  assert.ok(plugin.meta.author.name);
  assert.ok(plugin.meta.website.startsWith("https://"));
  assert.equal(plugin.meta.baseUrl, BASE);
  assert.equal(plugin.meta.channelTypes, undefined);
  assert.ok(plugin.meta.models.length > 0);
});

test("every model is declared and priced by a usage profile", () => {
  const profiles = plugin.meta.usageProfiles || [];
  const covered = [];
  for (const profile of profiles) {
    assert.ok(profile.models.length > 0, "a profile must declare models");
    assert.ok(profile.schema, "a profile must declare a schema");
    for (const model of profile.models) {
      assert.ok(plugin.meta.models.includes(model), model + " is not declared in meta.models");
      assert.ok(!covered.includes(model), model + " is in two profiles");
      covered.push(model);
    }
    // Each example is a complete vector over its own profile schema.
    for (const example of profile.examples || []) {
      const keys = Object.keys(example.facts);
      for (const field of Object.keys(profile.schema)) assert.ok(keys.includes(field), example.label + " misses " + field);
      for (const key of keys) assert.ok(profile.schema[key], example.label + " has the undeclared field " + key);
    }
  }
  for (const model of plugin.meta.models) assert.ok(covered.includes(model), model + " is in no usage profile");
  // The upload model has no billable facts of its own.
  const upload = profiles.find((profile) => profile.models.includes("pixverse-image-upload"));
  assert.deepEqual(upload.schema, {});
});

test("usage examples are complete vectors over the usage schema", () => {
  const schema = plugin.meta.usageSchema;
  for (const example of plugin.meta.usageExamples) {
    const keys = Object.keys(example.facts);
    for (const field of Object.keys(schema)) assert.ok(keys.includes(field), example.label + " misses " + field);
    for (const key of keys) assert.ok(schema[key], example.label + " has the undeclared field " + key);
  }
});

test("the plugin only addresses the channel base URL host", () => {
  const allowed = new Set([new URL(plugin.meta.baseUrl).host]);
  for (const host of plugin.meta.allowedHosts || []) allowed.add(host);
  const requests = [
    plugin.buildSubmitRequest(driver({ model: "v6", prompt: "a", duration: 5, quality: "720p" })),
    plugin.buildQueryRequest(queryContext()),
  ];
  for (const request of requests) assert.ok(allowed.has(new URL(request.url).host), request.url);
});

test("a text-to-video request maps to the PixVerse endpoint", () => {
  const intent = plugin.native.textToVideo({
    body: { kind: "json", value: { model: "v6", prompt: "a cat", duration: 8, quality: "1080p", generate_audio_switch: true, seed: 7, aspect_ratio: "9:16" } },
  });
  assert.equal(intent.action, "text_to_video");
  assert.equal(intent.model, "pixverse-v6");
  const request = plugin.buildSubmitRequest(driver(intent.requestBody, { action: intent.action, model: intent.model, upstreamModel: "v6" }));
  assert.equal(request.url, BASE + "/openapi/v2/video/text/generate");
  assert.equal(request.method, "POST");
  assert.equal(request.headers["API-KEY"], "test-key");
  assert.match(request.headers["Ai-trace-id"], /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  assert.equal(request.body.model, "v6");
  assert.equal(request.body.prompt, "a cat");
  assert.equal(request.body.duration, 8);
  assert.equal(request.body.quality, "1080p");
  assert.equal(request.body.aspect_ratio, "9:16");
  assert.equal(request.body.generate_audio_switch, true);
  assert.equal(request.body.seed, 7);
});

test("a text-to-video request fills in the price-determining defaults", () => {
  const intent = plugin.native.textToVideo({ body: { kind: "json", value: { model: "v6", prompt: "a cat" } } });
  assert.equal(intent.requestBody.duration, 5);
  assert.equal(intent.requestBody.quality, "720p");
  assert.equal(intent.requestBody.aspect_ratio, "16:9");
  assert.equal(intent.requestBody.generate_audio_switch, false);
});

test("an image-to-video request carries the uploaded image id", () => {
  const intent = plugin.native.imageToVideo({
    body: { kind: "json", value: { model: "c1", prompt: "move", duration: 5, quality: "720p", img_id: "task_upload" } },
  });
  assert.equal(intent.action, "image_to_video");
  assert.deepEqual(intent.originTaskIds, ["task_upload"]);
  const request = plugin.buildSubmitRequest(
    driver(intent.requestBody, {
      action: intent.action,
      model: intent.model,
      upstreamModel: "c1",
      originTasks: [{ taskId: "task_upload", upstreamTaskId: "9001", action: "upload", status: "SUCCESS", data: { ErrCode: 0, Resp: { img_id: 9001 } } }],
    }),
  );
  assert.equal(request.url, BASE + "/openapi/v2/video/img/generate");
  assert.equal(request.body.img_id, 9001);
});

test("a transition request maps to the transition endpoint with two frames", () => {
  const intent = plugin.native.transition({
    body: { kind: "json", value: { model: "v6", prompt: "morph", duration: 5, quality: "720p", first_frame_img: "task_a", last_frame_img: "task_b" } },
  });
  assert.equal(intent.action, "transition");
  assert.deepEqual(intent.originTaskIds, ["task_a", "task_b"]);
  const request = plugin.buildSubmitRequest(
    driver(intent.requestBody, {
      action: intent.action,
      model: intent.model,
      upstreamModel: "v6",
      originTasks: [
        { taskId: "task_a", upstreamTaskId: "9001", action: "upload", status: "SUCCESS", data: { ErrCode: 0, Resp: { img_id: 9001 } } },
        { taskId: "task_b", upstreamTaskId: "9002", action: "upload", status: "SUCCESS", data: { ErrCode: 0, Resp: { img_id: 9002 } } },
      ],
    }),
  );
  assert.equal(request.url, BASE + "/openapi/v2/video/transition/generate");
  assert.equal(request.body.first_frame_img, 9001);
  assert.equal(request.body.last_frame_img, 9002);
});

test("the upload route takes one image file or one image_url", () => {
  const intent = plugin.native.uploadImage({
    body: { kind: "multipart", fields: {}, files: [{ ref: "request_file:image", field: "image", filename: "a.png", mimeType: "image/png", size: 1024 }] },
  });
  assert.equal(intent.action, "upload");
  assert.equal(intent.model, "pixverse-image-upload");
  const request = plugin.buildSubmitRequest(driver(intent.requestBody, { action: "upload", model: "pixverse-image-upload", upstreamModel: "pixverse-image-upload" }));
  assert.equal(request.url, BASE + "/openapi/v2/image/upload");
  assert.equal(request.bodyType, "multipart");
  assert.equal(request.parts[0].name, "image");
  assert.equal(request.parts[0].fileRef, "request_file:image");
});

test("the upload route refuses a JSON body", () => {
  assert.throws(
    () => plugin.native.uploadImage({ body: { kind: "json", value: { image_url: "https://example.com/a.png" } } }),
    /multipart\/form-data body required/,
  );
});

test("the upload route refuses a non-image file", () => {
  assert.throws(
    () => plugin.native.uploadImage({ body: { kind: "multipart", fields: {}, files: [{ ref: "request_file:image", field: "image", filename: "a.txt", mimeType: "text/plain", size: 10 }] } }),
    /image must be JPEG, PNG or WebP/,
  );
});

test("the upload route refuses both an image and an image_url", () => {
  assert.throws(
    () =>
      plugin.native.uploadImage({
        body: { kind: "multipart", fields: { image_url: ["https://example.com/a.png"] }, files: [{ ref: "request_file:image", field: "image", filename: "a.png", mimeType: "image/png", size: 10 }] },
      }),
    /provide exactly one of image or image_url/,
  );
});

test("validation rejects unknown and unsupported request fields", () => {
  assert.throws(() => plugin.native.textToVideo({ body: { kind: "json", value: { model: "v6", prompt: "x", temperature: 0.5 } } }), /request.temperature is not supported/);
  assert.throws(() => plugin.native.textToVideo({ body: { kind: "json", value: { model: "v6", prompt: "x", webhook_id: "w1" } } }), /webhook_id is not supported/);
  assert.throws(() => plugin.native.textToVideo({ body: { kind: "json", value: { model: "v6", prompt: "x", template_id: 5 } } }), /template_id is not supported/);
  assert.throws(() => plugin.native.textToVideo({ body: { kind: "json", value: { model: "v6" } } }), /prompt is required/);
  assert.throws(() => plugin.native.textToVideo({ body: { kind: "json", value: { model: "v9", prompt: "x" } } }), /unsupported model/);
});

test("validation refuses a raw PixVerse image id", () => {
  assert.throws(
    () => plugin.native.imageToVideo({ body: { kind: "json", value: { model: "v6", prompt: "x", img_id: 9001 } } }),
    /img_id must be the task id returned by the image upload route/,
  );
});

test("validation refuses a duration or quality the model does not serve", () => {
  assert.throws(() => plugin.native.textToVideo({ body: { kind: "json", value: { model: "v5.6", prompt: "x", duration: 6 } } }), /duration for pixverse-v5.6 must be one of 5, 8, 10/);
  assert.throws(() => plugin.native.textToVideo({ body: { kind: "json", value: { model: "v5.6", prompt: "x", duration: 10, quality: "1080p" } } }), /1080p is not available for 10-second pixverse-v5.6 videos/);
  assert.throws(() => plugin.native.textToVideo({ body: { kind: "json", value: { model: "v5", prompt: "x", duration: 8, quality: "1080p", generate_audio_switch: true } } }), /pixverse-v5 does not generate audio/);
  assert.throws(() => plugin.native.textToVideo({ body: { kind: "json", value: { model: "v5.6", prompt: "x", generate_multi_clip_switch: true } } }), /generate_multi_clip_switch is only supported/);
});

test("validation refuses a capability the model does not have", () => {
  assert.throws(
    () => plugin.native.transition({ body: { kind: "json", value: { model: "v6-max", prompt: "x", first_frame_img: "task_a", last_frame_img: "task_b" } } }),
    /pixverse-v6-max does not support transition/,
  );
});

test("a submit reply keeps the PixVerse task id", () => {
  const ctx = driver({ model: "v6", prompt: "x" }, { action: "text_to_video" });
  const parsed = plugin.parseSubmitResponse(ctx, { statusCode: 200, headers: {}, body: { ErrCode: 0, ErrMsg: "success", Resp: { video_id: 5001, credits: 45 } } });
  assert.equal(parsed.taskId, "5001");
  assert.deepEqual(parsed.state, { credits: 45 });
});

test("a vendor error fails the submission so the gateway refunds it", () => {
  const ctx = driver({ model: "v6", prompt: "x" }, { action: "text_to_video" });
  assert.throws(
    () => plugin.parseSubmitResponse(ctx, { statusCode: 200, headers: {}, body: { ErrCode: 400017, ErrMsg: "Invalid parameter", Resp: null } }),
    /PixVerse error 400017: Invalid parameter/,
  );
});

test("an upload reply is immediate and keeps the image id", () => {
  const ctx = driver({}, { action: "upload", model: "pixverse-image-upload", upstreamModel: "pixverse-image-upload" });
  const parsed = plugin.parseSubmitResponse(ctx, { statusCode: 200, headers: {}, body: { ErrCode: 0, ErrMsg: "success", Resp: { img_id: 9001, img_url: "https://media.example/i.png" } } });
  assert.equal(parsed.taskId, "9001");
  assert.equal(parsed.immediate.status, "SUCCESS");
});

test("the task states map to the host states", () => {
  assert.deepEqual(plugin.parseTaskResult(queryContext(), DONE).status, "SUCCESS");
  assert.deepEqual(plugin.parseTaskResult(queryContext(), RUNNING).status, "IN_PROGRESS");
  assert.equal(plugin.parseTaskResult(queryContext(), { ErrCode: 0, Resp: { status: 7 } }).status, "FAILURE");
  assert.equal(plugin.parseTaskResult(queryContext(), { ErrCode: 0, Resp: { status: 8 } }).status, "FAILURE");
  assert.equal(plugin.parseTaskResult(queryContext(), { ErrCode: 0, Resp: { status: 42 } }).status, "UNKNOWN");
  assert.equal(plugin.parseTaskResult(queryContext(), { ErrCode: 500008, ErrMsg: "not found" }).status, "FAILURE");
});

test("the reservation follows PixVerse's published credit prices", () => {
  const cases = [
    { model: "v6", duration: 5, quality: "720p", credits: 45 },
    { model: "v6", duration: 8, quality: "720p", audio: true, credits: 96 },
    { model: "v6", duration: 15, quality: "1080p", credits: 270 },
    { model: "c1", duration: 5, quality: "1080p", credits: 95 },
    { model: "v6-max", duration: 15, quality: "1080p", audio: true, credits: 420 },
    { model: "v5.6", duration: 8, quality: "720p", audio: true, credits: 135 },
    { model: "v5.6", duration: 10, quality: "720p", credits: 99 },
    { model: "v5.5", duration: 5, quality: "360p", credits: 45 },
    { model: "v5.5", duration: 5, quality: "360p", multiClip: true, credits: 75 },
    { model: "v5", duration: 8, quality: "1080p", credits: 240 },
  ];
  for (const item of cases) {
    const body = { model: item.model, prompt: "x", duration: item.duration, quality: item.quality };
    if (item.audio) body.generate_audio_switch = true;
    if (item.multiClip) body.generate_multi_clip_switch = true;
    const intent = plugin.native.textToVideo({ body: { kind: "json", value: body } });
    const usage = plugin.extractUsage(driver(intent.requestBody, { action: intent.action, model: intent.model, upstreamModel: item.model }));
    assert.equal(usage.credits, item.credits, item.model + " " + item.duration + "s " + item.quality);
    assert.equal(usage.seconds, item.duration);
    assert.equal(usage.resolution, item.quality);
    assert.equal(usage.audio, item.audio === true);
    assert.equal(usage.multi_clip, item.multiClip === true);
  }
});

test("the upload reserves nothing", () => {
  const usage = plugin.extractUsage(driver({}, { action: "upload", model: "pixverse-image-upload", upstreamModel: "pixverse-image-upload" }));
  assert.deepEqual(usage, {});
});

test("legacy per-call billing has no ratio to scale", () => {
  const usage = plugin.extractUsage(driver({ model: "v6", prompt: "x" }, { usagePurpose: "billing_ratios" }));
  assert.equal(usage, null);
});

test("a finished task settles on the credits PixVerse reports", () => {
  const usage = plugin.extractUsageOnComplete(queryContext(), { status: "SUCCESS" }, DONE);
  assert.deepEqual(usage, { credits: 40 });
});

test("a task without reported credits keeps its reservation", () => {
  const body = { ErrCode: 0, Resp: { id: 5001, status: 1, url: "https://media.example/v.mp4" } };
  assert.equal(plugin.extractUsageOnComplete(queryContext(), { status: "SUCCESS" }, body), null);
});

test("an unfinished task does not settle", () => {
  assert.equal(plugin.extractUsageOnComplete(queryContext(), { status: "IN_PROGRESS" }, RUNNING), null);
});

test("a finished video is the only artifact", () => {
  const artifacts = plugin.listArtifacts({ task_id: "task_public", status: "SUCCESS", action: "text_to_video", data: DONE });
  assert.deepEqual(artifacts, [{ key: "video", type: "video", mimeType: "video/mp4" }]);
  assert.deepEqual(plugin.listArtifacts({ task_id: "task_public", status: "FAILURE", action: "text_to_video", data: DONE }), []);
  assert.deepEqual(plugin.listArtifacts({ task_id: "task_public", status: "SUCCESS", action: "upload", data: DONE }), []);
});

test("a download asks PixVerse for a fresh url and stays credentialless", () => {
  const calls = [];
  globalThis.utils.fetch = (request) => {
    calls.push(request);
    return { status: 200, headers: {}, body: { ErrCode: 0, Resp: { id: 5001, status: 1, url: "https://media.example/fresh.mp4" } } };
  };
  const request = plugin.buildContentRequest({
    artifactKey: "video",
    data: DONE,
    upstreamTaskId: "5001",
    baseUrl: BASE,
    apiKey: "test-key",
    clientRequest: { method: "GET", headers: {} },
  });
  assert.equal(request.url, "https://media.example/fresh.mp4");
  assert.equal(request.credentialless, true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, BASE + "/openapi/v2/video/result/5001");
  globalThis.utils.fetch = () => ({ status: 200, headers: {}, body: {} });
});

test("a download falls back to the url of the last poll", () => {
  globalThis.utils.fetch = () => {
    throw new Error("no network");
  };
  const request = plugin.buildContentRequest({
    artifactKey: "video",
    data: DONE,
    upstreamTaskId: "5001",
    baseUrl: BASE,
    apiKey: "test-key",
    clientRequest: { method: "GET", headers: {} },
  });
  assert.equal(request.url, "https://media.example/v5001.mp4");
  globalThis.utils.fetch = () => ({ status: 200, headers: {}, body: {} });
});

test("the openai video protocol decodes a text-to-video request", () => {
  const intent = plugin.protocols.openai_video.decodeRequest({
    model: "pixverse-v6",
    upstreamModel: "pixverse-v6",
    body: { kind: "json", value: { prompt: "a fox", seconds: "8", size: "1280x720" } },
  });
  assert.equal(intent.action, "text_to_video");
  assert.equal(intent.requestBody.duration, 8);
  assert.equal(intent.requestBody.quality, "720p");
  assert.equal(intent.requestBody.aspect_ratio, "16:9");
});

test("the openai video protocol maps input_reference to image-to-video", () => {
  const intent = plugin.protocols.openai_video.decodeRequest({
    model: "pixverse-c1",
    upstreamModel: "pixverse-c1",
    body: { kind: "json", value: { prompt: "a fox", seconds: "5", input_reference: "task_upload" } },
  });
  assert.equal(intent.action, "image_to_video");
  assert.deepEqual(intent.originTaskIds, ["task_upload"]);
});

test("the openai video protocol maps two frames to a transition", () => {
  const intent = plugin.protocols.openai_video.decodeRequest({
    model: "pixverse-v6",
    upstreamModel: "pixverse-v6",
    body: { kind: "json", value: { prompt: "a fox", seconds: "5", first_frame_img: "task_a", last_frame_img: "task_b" } },
  });
  assert.equal(intent.action, "transition");
  assert.deepEqual(intent.originTaskIds, ["task_a", "task_b"]);
});

test("the openai video protocol refuses an unknown size", () => {
  assert.throws(
    () =>
      plugin.protocols.openai_video.decodeRequest({
        model: "pixverse-v6",
        upstreamModel: "pixverse-v6",
        body: { kind: "json", value: { prompt: "x", size: "1024x1024" } },
      }),
    /has no PixVerse quality and aspect ratio/,
  );
});

test("the openai video protocol refuses an image file", () => {
  assert.throws(
    () =>
      plugin.protocols.openai_video.decodeRequest({
        model: "pixverse-v6",
        upstreamModel: "pixverse-v6",
        body: { kind: "multipart", fields: {}, files: [{ ref: "request_file:input_reference", field: "input_reference", filename: "a.png", mimeType: "image/png", size: 10 }] },
      }),
    /upload the image to POST/,
  );
});

test("the native presenters answer with the PixVerse envelope", () => {
  const created = plugin.native.videoCreated({}, { task_id: "task_public", data: { ErrCode: 0, Resp: { video_id: 5001, credits: 45 } } });
  assert.deepEqual(created, { ErrCode: 0, ErrMsg: "success", Resp: { video_id: "task_public", credits: 45 } });
  const uploaded = plugin.native.imageUploaded({}, { task_id: "task_public", data: { ErrCode: 0, Resp: { img_id: 9001, img_url: "https://media.example/i.png" } } });
  assert.equal(uploaded.Resp.img_id, "task_public");
  assert.equal(uploaded.Resp.img_url, "https://media.example/i.png");
});

test("the native result presenter hides the account data", () => {
  const result = plugin.native.videoResult({ artifacts: { video: { url: "http://gateway/content" } } }, { task_id: "task_public", status: "SUCCESS", action: "text_to_video", data: DONE });
  assert.equal(result.Resp.id, "task_public");
  assert.equal(result.Resp.url, "http://gateway/content");
  assert.equal(result.Resp.customer_paths, undefined);
  assert.equal(result.Resp.path, undefined);
});

test("the hooks do not mutate their arguments", () => {
  const body = { model: "v6", prompt: "a cat", duration: 5, quality: "720p" };
  const before = JSON.stringify(body);
  const intent = plugin.native.textToVideo({ body: { kind: "json", value: body } });
  plugin.buildSubmitRequest(driver(intent.requestBody, { action: intent.action, model: intent.model, upstreamModel: "v6" }));
  plugin.extractUsage(driver(intent.requestBody, { action: intent.action, model: intent.model, upstreamModel: "v6" }));
  assert.equal(JSON.stringify(body), before);
});
