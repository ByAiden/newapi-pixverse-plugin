// The plugin on a New API channel (type 60): the same plugin answers on
// another gateway. node --test test/
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash, randomUUID } from "node:crypto";

const fetched = [];
globalThis.utils = {
  uuid: () => randomUUID(),
  sha256: (data) => createHash("sha256").update(String(data)).digest("hex"),
  fetch: (request) => {
    fetched.push(request);
    throw new Error("no fetch on a New API channel");
  },
};

const plugin = await import("../plugin.js");
const source = readFileSync(new URL("../plugin.js", import.meta.url), "utf8");

const GATEWAY = "https://middle.example.com";
const KEY = plugin.meta.key;
const TOKEN = "sk-middle";
const UPSTREAM = { kind: "new_api" };

function driver(requestBody, extra) {
  return Object.assign(
    { requestBody, requestHeaders: {}, action: "", model: "pixverse-v6", upstreamModel: "pixverse-v6", baseUrl: GATEWAY, apiKey: TOKEN, authHeader: "Bearer " + TOKEN, upstream: UPSTREAM, config: {}, files: [], publicTaskId: "task_outer" },
    extra || {},
  );
}

function queryContext(extra) {
  return Object.assign(
    { taskId: "task_middle_v", publicTaskId: "task_outer", action: "text_to_video", model: "pixverse-v6", upstreamModel: "pixverse-v6", baseUrl: GATEWAY, apiKey: TOKEN, authHeader: "Bearer " + TOKEN, upstream: UPSTREAM, config: {}, data: null, state: null },
    extra || {},
  );
}

// What the middle gateway's own presenters render.
const MIDDLE_CREATED = { ErrCode: 0, ErrMsg: "success", Resp: { video_id: "task_middle_v", credits: 45 } };
const MIDDLE_UPLOADED = { ErrCode: 0, ErrMsg: "success", Resp: { img_id: "task_middle_img", img_url: "https://media.example/i.png" } };
const MIDDLE_DONE = {
  ErrCode: 0,
  ErrMsg: "success",
  Resp: { id: "task_middle_v", status: 1, credits: 40, url: GATEWAY + "/v1/tasks/task_middle_v/artifacts/video/content?access=sig" },
};

test("meta declares the New API upstream and PLUGIN_KEY matches meta.key", () => {
  assert.deepEqual(plugin.meta.upstreams, ["vendor", "new_api"]);
  assert.equal(/const PLUGIN_KEY = "([^"]+)";/.exec(source)[1], KEY);
});

test("the version matches both CHANGELOGs", () => {
  for (const file of ["CHANGELOG.md", "CHANGELOG.zh-CN.md"]) {
    const text = readFileSync(new URL("../" + file, import.meta.url), "utf8");
    assert.equal(/\nversion: "?([0-9.]+)"?\n/.exec(text)[1], plugin.meta.version, file);
    assert.equal((text.match(/^## \[/gm) || []).length, 1, file);
    assert.ok(text.includes("## [" + plugin.meta.version + "]"), file);
  }
});

test("submissions go to the gateway's native routes under the plugin key with its token", () => {
  const request = plugin.buildSubmitRequest(driver({ model: "pixverse-v6", prompt: "a cat", duration: 5, quality: "720p" }, { action: "text_to_video" }));
  assert.equal(request.url, GATEWAY + "/" + KEY + "/openapi/v2/video/text/generate");
  assert.deepEqual(request.headers, { Authorization: "Bearer " + TOKEN, Accept: "application/json", "Content-Type": "application/json" });
  assert.equal(request.headers["API-KEY"], undefined);
  assert.equal(request.headers["Ai-trace-id"], undefined);
  assert.equal(request.body.model, "pixverse-v6");
  assert.equal(fetched.length, 0);
});

test("a mapped vendor model name is sent as the plugin's public name", () => {
  const request = plugin.buildSubmitRequest(driver({ model: "x", prompt: "a cat" }, { action: "text_to_video", model: "alias", upstreamModel: "v6" }));
  assert.equal(request.body.model, "pixverse-v6");
});

test("an upload goes to the gateway's upload route", () => {
  const request = plugin.buildSubmitRequest(driver({ model: "pixverse-image-upload", image_url: "https://example.com/a.png" }, { action: "upload", model: "pixverse-image-upload" }));
  assert.equal(request.url, GATEWAY + "/" + KEY + "/openapi/v2/image/upload");
  assert.equal(request.bodyType, "multipart");
  assert.equal(request.headers.Authorization, "Bearer " + TOKEN);
});

test("an uploaded image is referenced by the gateway's task id", () => {
  const origin = [{ taskId: "task_outer_img", upstreamTaskId: "task_middle_img", action: "upload", data: MIDDLE_UPLOADED }];
  const request = plugin.buildSubmitRequest(driver({ model: "pixverse-v6", prompt: "go", img_id: "task_outer_img" }, { action: "image_to_video", originTasks: origin }));
  assert.equal(request.url, GATEWAY + "/" + KEY + "/openapi/v2/video/img/generate");
  assert.equal(request.body.img_id, "task_middle_img");
  const transition = plugin.buildSubmitRequest(
    driver({ model: "pixverse-v6", prompt: "go", first_frame_img: "task_outer_img", last_frame_img: "task_outer_img" }, { action: "transition", originTasks: origin }),
  );
  assert.equal(transition.body.first_frame_img, "task_middle_img");
  assert.equal(transition.body.last_frame_img, "task_middle_img");
});

test("the gateway's submit replies carry its task ids", () => {
  const video = plugin.parseSubmitResponse(driver({ model: "pixverse-v6", prompt: "a" }, { action: "text_to_video" }), { status: 200, body: MIDDLE_CREATED });
  assert.deepEqual(video, { taskId: "task_middle_v", taskData: MIDDLE_CREATED, state: { credits: 45 } });
  const upload = plugin.parseSubmitResponse(driver({ image_url: "https://example.com/a.png" }, { action: "upload" }), { status: 200, body: MIDDLE_UPLOADED });
  assert.equal(upload.taskId, "task_middle_img");
  assert.equal(upload.immediate.status, "SUCCESS");
  assert.throws(() => plugin.parseSubmitResponse(driver({}, { action: "upload" }), { status: 200, body: { ErrCode: 0, Resp: { img_id: "bad id/" } } }), /image task id/);
  assert.throws(() => plugin.parseSubmitResponse(driver({}, { action: "text_to_video" }), { status: 400, body: { ErrCode: 400, ErrMsg: "duration invalid", Resp: null } }), /duration invalid/);
});

test("polling uses the gateway's native query route", () => {
  const request = plugin.buildQueryRequest(queryContext());
  assert.equal(request.url, GATEWAY + "/" + KEY + "/openapi/v2/video/result/task_middle_v");
  assert.deepEqual(request.headers, { Authorization: "Bearer " + TOKEN, Accept: "application/json" });
});

test("the gateway's result presenter maps to the host states", () => {
  const ctx = queryContext();
  assert.deepEqual(plugin.parseTaskResult(ctx, MIDDLE_DONE), { status: "SUCCESS", progress: "100%" });
  assert.deepEqual(plugin.parseTaskResult(ctx, { ErrCode: 0, ErrMsg: "success", Resp: { id: "task_middle_v", status: 5, url: "" } }), { status: "IN_PROGRESS" });
  assert.deepEqual(plugin.parseTaskResult(ctx, { ErrCode: 0, ErrMsg: "upstream timed out", Resp: { id: "task_middle_v", status: 8 } }), { status: "FAILURE", reason: "upstream timed out" });
  assert.equal(plugin.parseTaskResult(ctx, { ErrCode: 404, ErrMsg: "task not found", Resp: null }).status, "FAILURE");
  assert.equal(plugin.parseTaskResult(ctx, { ErrCode: 502, ErrMsg: "bad gateway", Resp: null }).status, "UNKNOWN");
});

test("settlement uses the credits the gateway passes on, with the same facts", () => {
  assert.deepEqual(plugin.extractUsageOnComplete(queryContext(), { status: "SUCCESS" }, MIDDLE_DONE), { credits: 40 });
  const noCredits = { ErrCode: 0, Resp: Object.assign({}, MIDDLE_DONE.Resp, { credits: undefined }) };
  assert.deepEqual(plugin.extractUsageOnComplete(queryContext({ state: { credits: 45 } }), { status: "SUCCESS" }, noCredits), { credits: 45 });
  const vendor = plugin.extractUsage(driver({ model: "pixverse-v6", prompt: "a", duration: 8, quality: "1080p" }, { action: "text_to_video", upstream: { kind: "vendor" } }));
  const gateway = plugin.extractUsage(driver({ model: "pixverse-v6", prompt: "a", duration: 8, quality: "1080p" }, { action: "text_to_video" }));
  assert.deepEqual(gateway, vendor);
});

test("downloads come from the gateway's task content route with its token", () => {
  const task = { status: "SUCCESS", action: "text_to_video", data: MIDDLE_DONE };
  assert.deepEqual(plugin.listArtifacts(task), [{ key: "video", type: "video", mimeType: "video/mp4" }]);
  const ctx = Object.assign(queryContext({ data: MIDDLE_DONE }), { artifactKey: "video", upstreamTaskId: "task_middle_v", clientRequest: { method: "GET", headers: {} } });
  const request = plugin.buildContentRequest(ctx);
  assert.deepEqual(request, { url: GATEWAY + "/v1/tasks/task_middle_v/artifacts/video/content", method: "GET", headers: { Authorization: "Bearer " + TOKEN } });
  assert.equal(request.credentialless, undefined);
  assert.equal(fetched.length, 0);
});

test("a context without upstream keeps the vendor behaviour", () => {
  const request = plugin.buildSubmitRequest(driver({ model: "pixverse-v6", prompt: "a" }, { action: "text_to_video", upstream: undefined, baseUrl: "https://app-api.pixverse.ai" }));
  assert.equal(request.url, "https://app-api.pixverse.ai/openapi/v2/video/text/generate");
  assert.equal(request.headers["API-KEY"], TOKEN);
  assert.equal(request.body.model, "v6");
});
