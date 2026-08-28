"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const callsPath = path.join(root, "tracker", "calls.js");
let source = fs.readFileSync(callsPath, "utf8");
source = source.replace("boot();", "window.__callsTest={normalizeRecord:normalizeRecord,syncAliases:syncAliases,firstOpenTodo:firstOpenTodo,normalizedStatus:normalizedStatus,openTodoCount:openTodoCount,assignTodosToRecord:assignTodosToRecord};");

const sandbox = {
  window: {
    supabase: { createClient: () => ({}) },
    crypto: { randomUUID: (() => { let number = 0; return () => `test-${++number}`; })() }
  },
  crypto: null,
  console,
  Date,
  Map,
  Math,
  JSON,
  String,
  Array,
  Object,
  setTimeout,
  clearTimeout
};
sandbox.crypto = sandbox.window.crypto;
vm.createContext(sandbox);
vm.runInContext(source, sandbox, { filename: callsPath });
const api = sandbox.window.__callsTest;

const legacyA = api.normalizeRecord({
  id: "case-a",
  fileNumber: "G26-1000",
  reason: "Order payoff",
  notes: "Spoke with lender",
  promise: "Will email the authorization",
  followUpType: "Callback",
  followStatus: "Open",
  task: "Call lender Tuesday",
  dueDate: "2026-09-01",
  assignedTo: "Dylan",
  createdAt: "2026-08-27T12:00:00.000Z"
});
const legacyB = api.normalizeRecord({
  id: "case-b",
  fileNumber: "G26-2000",
  reason: "Confirm wiring instructions",
  followUpType: "Callback",
  status: "Completed",
  followStatus: "Open",
  nextAction: "Call seller",
  createdAt: "2026-08-27T13:00:00.000Z"
});

assert.equal(legacyA.schemaVersion, 2, "legacy records migrate to schema 2");
assert.equal(legacyA.subject, "Order payoff");
assert.equal(legacyA.results, "Spoke with lender");
assert.equal(legacyA.advised, "Will email the authorization");
assert.equal(legacyA.todos.length, 1, "legacy task becomes one checklist item");
assert.equal(api.firstOpenTodo(legacyA), "Call lender Tuesday");
assert.equal(legacyA.nextAction, "Call lender Tuesday", "legacy alias stays synchronized");
assert.equal(legacyB.status, "Completed", "either legacy completion field wins over stale open field");
assert.equal(legacyB.followStatus, "Completed", "status aliases cannot drift after migration");
assert.equal(legacyA.fileNumber, "G26-1000");
assert.equal(legacyB.fileNumber, "G26-2000");
assert.notEqual(legacyA.todos[0].id, legacyB.todos[0].id, "different cases keep distinct to-do identities");

const records = [legacyA, legacyB];
api.assignTodosToRecord(records, "case-b", [{ id: "new-b", text: "Send confirmation", completed: false }]);
assert.equal(records[0].todos[0].text, "Call lender Tuesday", "adding to case B cannot change case A");
assert.equal(records[1].todos[0].text, "Send confirmation", "to-do is written only to its selected case");

legacyA.todos[0].completed = true;
api.syncAliases(legacyA);
assert.equal(legacyA.nextAction, "", "completed checklist item no longer drives Next Action");
assert.equal(api.openTodoCount(legacyA), 0);

const index = fs.readFileSync(path.join(root, "tracker", "index.html"), "utf8");
const launcher = fs.readFileSync(path.join(root, "tracker", "calls-launcher.js"), "utf8");
const redirect = fs.readFileSync(path.join(root, "tracker", "call-prototype.html"), "utf8");
const callsHtml = fs.readFileSync(path.join(root, "tracker", "calls.html"), "utf8");
const requiredIds = Array.from(source.matchAll(/el\("([A-Za-z0-9_-]+)"\)/g), match => match[1]);
const missingIds = [...new Set(requiredIds)].filter(id => !callsHtml.includes(`id="${id}"`));
assert.deepEqual(missingIds, [], `calls.html is missing required elements: ${missingIds.join(", ")}`);
assert(index.includes("calls-launcher.js"), "tracker loads the consolidated launcher");
assert(!index.includes("call-tracker.js"), "tracker no longer loads the duplicate embedded call tracker");
assert(!index.includes("call-toolbox-bridge.js"), "tracker no longer loads the duplicate bridge");
assert(!index.includes("call-tracker-layout.css"), "tracker no longer loads duplicate tracker styling");
assert(launcher.includes("calls.html"), "single launcher opens the consolidated workspace");
assert(!launcher.includes("setInterval"), "launcher does not leave a polling loop running");
assert(redirect.includes("window.location.replace(\"calls.html\""), "old prototype bookmarks redirect safely");

console.log("Calls & Follow-Ups migration and launcher tests passed.");

