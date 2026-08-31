"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { webcrypto } = require("crypto");

const root = path.resolve(__dirname, "..");
const todoPath = path.join(root, "tracker", "todo-list.js");
const originalSource = fs.readFileSync(todoPath, "utf8");
const todoHtml = fs.readFileSync(path.join(root, "tracker", "todo-list.html"), "utf8");

function clone(value) { return JSON.parse(JSON.stringify(value)); }

function makeCloud(initialRows, controls = {}) {
  let rows = clone(initialRows);
  const calls = { selects: 0, upserts: [], updates: [] };
  return {
    calls,
    rows: () => clone(rows),
    auth: {},
    functions: { invoke: async () => ({ data: { tasks: [] }, error: null }) },
    from(table) {
      assert.equal(table, "dylan_voice_todos", "migration only touches the isolated voice todo table");
      return {
        select() {
          return {
            async order() {
              calls.selects += 1;
              if (controls.failSelect) return { data: null, error: new Error("cloud unavailable") };
              return { data: clone(rows), error: null };
            }
          };
        },
        async upsert(values, options) {
          const items = Array.isArray(values) ? values : [values];
          calls.upserts.push({ items: clone(items), options: clone(options) });
          if (controls.failUpsert) return { error: new Error("migration write failed") };
          items.forEach(item => {
            const index = rows.findIndex(row => row.id === item.id);
            if (index < 0) rows.push(clone(item));
            else if (!options.ignoreDuplicates) rows[index] = clone(item);
          });
          return { error: null };
        },
        update(value) {
          return {
            eq(field, id) {
              assert.equal(field, "id");
              return {
                async lt(timestampField, timestamp) {
                  assert.equal(timestampField, "updated_at");
                  calls.updates.push({ id, value: clone(value), timestamp });
                  if (controls.beforeConditionalUpdate) controls.beforeConditionalUpdate(rows, id);
                  if (controls.failUpdate) return { error: new Error("conditional update failed") };
                  const index = rows.findIndex(row => row.id === id);
                  if (index >= 0 && Date.parse(rows[index].updated_at) < Date.parse(timestamp)) rows[index] = clone(value);
                  return { error: null };
                }
              };
            }
          };
        },
        delete() { return { in: async () => ({ error: null }) }; }
      };
    }
  };
}

function fakeElement(id) {
  return {
    id, value: "", textContent: "", innerHTML: "", hidden: false, disabled: false,
    dataset: {}, lastChild: { nodeValue: "" },
    classList: { toggle() {}, add() {}, remove() {}, contains() { return false; } },
    addEventListener() {}, setAttribute() {}, remove() {}, focus() {}
  };
}

function createHarness({ cloud, localTasks = [], email = "dylan.sprouse@unifiedtitle.net", userId = "11111111-1111-4111-8111-111111111111" }) {
  const local = new Map([["utei.dylan.voiceTodos.v1", JSON.stringify(localTasks)]]);
  const elements = new Map();
  const document = {
    getElementById(id) { if (!elements.has(id)) elements.set(id, fakeElement(id)); return elements.get(id); },
    addEventListener() {}
  };
  const window = {
    supabase: { createClient: () => cloud },
    confirm: () => true,
    document,
    crypto: webcrypto
  };
  const sandbox = {
    window, document, crypto: webcrypto, console, Date, Map, Set, Math, Number, Intl, JSON, String, Array, Object,
    setTimeout, clearTimeout,
    localStorage: {
      getItem(key) { return local.has(key) ? local.get(key) : null; },
      setItem(key, value) { local.set(key, value); },
      removeItem(key) { local.delete(key); }
    }
  };
  let source = originalSource.replace(
    "  initialize();\n}());",
    "  window.__voiceTodoTest={loadTasks:loadTasks,loadLocal:loadLocal,mergeTaskLists:mergeTaskLists,migrateLocalToCloud:migrateLocalToCloud,getTasks:function(){return tasks;},getStorageMode:function(){return storageMode;},setSession:function(value){session=value;}};\n}());"
  );
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox, { filename: todoPath });
  const api = window.__voiceTodoTest;
  api.setSession({ user: { id: userId, email } });
  return { api, cloud, local, elements };
}

function task(id, title, updatedAt, userId = "11111111-1111-4111-8111-111111111111") {
  return {
    id, user_id: userId, title, details: null, due_date: null, due_time: null, due_text: null,
    priority: "normal", completed: false, original_request: null,
    created_at: "2026-08-31T09:00:00.000Z", updated_at: updatedAt
  };
}

(async function run() {
  const cloudA = task("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", "Newer cloud A", "2026-08-31T12:00:00.000Z");
  const cloudB = task("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", "Older cloud B", "2026-08-31T10:00:00.000Z");
  const localA = task(cloudA.id, "Older local A", "2026-08-31T11:00:00.000Z");
  const localB = task(cloudB.id, "Newer local B", "2026-08-31T13:00:00.000Z");
  const localC = task("cccccccc-cccc-4ccc-8ccc-cccccccccccc", "Local-only C", "2026-08-31T14:00:00.000Z");
  const duplicateOlderC = task(localC.id, "Duplicate older C", "2026-08-31T08:00:00.000Z");
  const successCloud = makeCloud([cloudA, cloudB]);
  const success = createHarness({ cloud: successCloud, localTasks: [localA, localB, duplicateOlderC, localC] });
  await success.api.loadTasks();

  const successfulTasks = success.api.getTasks();
  assert.equal(successfulTasks.length, 3, "task IDs prevent duplicate records during migration");
  assert.equal(successfulTasks.find(item => item.id === cloudA.id).title, "Newer cloud A", "older local data cannot overwrite newer cloud data");
  assert.equal(successfulTasks.find(item => item.id === cloudB.id).title, "Newer local B", "newer local data migrates to cloud");
  assert.equal(successfulTasks.find(item => item.id === localC.id).title, "Local-only C", "local-only tasks migrate to cloud");
  assert.equal(successCloud.rows().length, 3, "cloud contains one row per task ID after migration");
  assert.equal(successCloud.calls.upserts[0].options.ignoreDuplicates, true, "local-only inserts cannot overwrite a racing cloud row");
  assert.deepEqual(successCloud.calls.updates.map(call => call.id), [cloudB.id], "only a demonstrably newer local row is conditionally updated");
  assert.equal(success.api.getStorageMode(), "cloud");
  assert.match(success.elements.get("storageStatus").textContent, /synchronized/);
  const backup = JSON.parse(success.local.get("utei.dylan.voiceTodos.v1"));
  assert.equal(backup.length, 3, "successful migration keeps a complete deduplicated local backup");
  assert.equal(backup.find(item => item.id === cloudA.id).title, "Newer cloud A", "local backup receives the newer cloud version");

  const failureLocal = task("dddddddd-dddd-4ddd-8ddd-dddddddddddd", "Never delete this local task", "2026-08-31T15:00:00.000Z");
  const failureCloud = makeCloud([cloudA], { failUpsert: true });
  const failure = createHarness({ cloud: failureCloud, localTasks: [failureLocal] });
  const originalLocalPayload = failure.local.get("utei.dylan.voiceTodos.v1");
  await failure.api.loadTasks();
  assert.equal(failure.local.get("utei.dylan.voiceTodos.v1"), originalLocalPayload, "migration failure leaves the original local payload untouched");
  assert.equal(failure.api.getTasks().length, 2, "cloud and local tasks both remain visible when migration fails");
  assert.equal(failure.api.getStorageMode(), "local", "failed migration safely returns to local mode");
  assert.match(failure.elements.get("storageStatus").textContent, /migration paused.*local list is still safe/i);

  const raceLocal = task("eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee", "Local at eleven", "2026-08-31T11:00:00.000Z");
  const raceCloud = makeCloud([
    task(raceLocal.id, "Cloud at ten", "2026-08-31T10:00:00.000Z")
  ], {
    beforeConditionalUpdate(rows, id) {
      const index = rows.findIndex(row => row.id === id);
      rows[index] = task(id, "Cloud changed concurrently at noon", "2026-08-31T12:00:00.000Z");
    }
  });
  const race = createHarness({ cloud: raceCloud, localTasks: [raceLocal] });
  await race.api.loadTasks();
  assert.equal(race.api.getTasks()[0].title, "Cloud changed concurrently at noon", "conditional timestamp filter prevents a race from overwriting newer cloud data");

  const foreignTask = task("ffffffff-ffff-4fff-8fff-ffffffffffff", "Another user's task", "2026-08-31T16:00:00.000Z", "22222222-2222-4222-8222-222222222222");
  const ownerCloud = makeCloud([]);
  const owner = createHarness({ cloud: ownerCloud, localTasks: [foreignTask] });
  await owner.api.loadTasks();
  assert.equal(ownerCloud.calls.upserts.length, 0, "tasks carrying another user ID are never migrated");
  assert.equal(owner.api.getTasks().length, 0, "another user's local task is not exposed in Dylan's list");

  const legacyTask = task("12121212-1212-4212-8212-121212121212", "Legacy Dylan task without stored owner", "2026-08-31T17:00:00.000Z", null);
  const legacyCloud = makeCloud([]);
  const legacy = createHarness({ cloud: legacyCloud, localTasks: [legacyTask] });
  await legacy.api.loadTasks();
  assert.equal(legacyCloud.rows().length, 1, "legacy tasks from Dylan's protected localStorage can migrate");
  assert.equal(legacyCloud.rows()[0].user_id, "11111111-1111-4111-8111-111111111111", "legacy local tasks are assigned only to Dylan's verified user ID");

  const unavailableLocal = task("34343434-3434-4434-8434-343434343434", "Keep local while table is unavailable", "2026-08-31T18:00:00.000Z");
  const unavailableCloud = makeCloud([], { failSelect: true });
  const unavailable = createHarness({ cloud: unavailableCloud, localTasks: [unavailableLocal] });
  const unavailablePayload = unavailable.local.get("utei.dylan.voiceTodos.v1");
  await unavailable.api.loadTasks();
  assert.equal(unavailable.api.getTasks()[0].title, unavailableLocal.title, "table unavailability continues to show the browser-local list");
  assert.equal(unavailable.local.get("utei.dylan.voiceTodos.v1"), unavailablePayload, "table unavailability does not rewrite or delete the local backup");
  assert.match(unavailable.elements.get("storageStatus").textContent, /until cloud setup is completed/i);

  const nonDylanCloud = makeCloud([]);
  const nonDylan = createHarness({ cloud: nonDylanCloud, localTasks: [task(localC.id, "Legacy local task", "2026-08-31T14:00:00.000Z", null)], email: "amy@unifiedtitle.net" });
  await nonDylan.api.loadTasks();
  assert.equal(nonDylanCloud.calls.selects, 0, "non-Dylan sessions cannot start cloud migration");
  assert.equal(nonDylanCloud.calls.upserts.length, 0, "non-Dylan sessions cannot write migrated tasks");

  assert(originalSource.includes("SpeechRecognition/webkitSpeechRecognition is supplied by the browser"), "implementation documents the current browser transcription boundary");
  assert(originalSource.includes("does not send microphone audio to OpenAI for transcription"), "implementation explicitly distinguishes browser recognition from OpenAI transcription");
  assert(originalSource.includes("Future secure option (not implemented)"), "implementation documents the future secure Edge Function transcription path");
  assert(todoHtml.includes('id="requestInput"'), "manual typed input remains available");
  assert(todoHtml.includes("not OpenAI audio transcription"), "the visible microphone help accurately identifies the current browser transcription provider");

  console.log("Voice To-Do local-to-cloud migration tests passed.");
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
