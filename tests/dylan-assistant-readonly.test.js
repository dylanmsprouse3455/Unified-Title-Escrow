"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const jsPath = path.join(root, "tracker", "dylan-assistant.js");
const htmlPath = path.join(root, "tracker", "dylan-assistant.html");
const source = fs.readFileSync(jsPath, "utf8");
const html = fs.readFileSync(htmlPath, "utf8");

function titleCase(id, number, address, overrides = {}) {
  return {
    id, number, address, assigned: "Amy Hartman", status: "In Progress", nextAction: "Order the municipal lien search",
    priority: "High", targetDate: "2026-09-03", notes: "Waiting for the search package.", lastUpdated: "2026-08-31T14:00:00.000Z",
    lastTouchedAt: "2026-08-31T14:00:00.000Z", lastTouchedBy: "amy@unifiedtitle.net",
    todos: [{ id: id + "-todo", text: "Check courthouse response", done: false, createdAt: "2026-08-31T13:00:00.000Z", updatedAt: "2026-08-31T13:00:00.000Z" }],
    history: [{ id: id + "-history", at: "2026-08-31T14:00:00.000Z", by: "amy@unifiedtitle.net", text: "Search status changed to In Progress" }],
    ...overrides
  };
}

function callRecord(id, caller, fileNumber, address, createdAt, overrides = {}) {
  return {
    id, caller, phone: "555-0100", companyRole: "Realtor", fileNumber, address, direction: "Incoming", subject: "Status question",
    results: "Discussed the current title-search status.", outcome: "Reached and spoke", advised: "Will follow up tomorrow.",
    followUp: false, followType: "No Follow-Up", status: "Completed", owner: "Dylan", dueDate: "", todos: [], createdAt, updatedAt: createdAt, history: [],
    ...overrides
  };
}

const fixtures = {
  cases: [
    titleCase("case-1", "G26-0434", "1695 Jim Fox Road"),
    titleCase("case-2", "G21-0483", "230 Mohawk Creek Road", { status: "Waiting on Information", nextAction: "Receive the corrected legal description", priority: "Normal" }),
    titleCase("case-3", "G26-0999", "1695 Jim Fox Lane", { nextAction: "Confirm property address" })
  ],
  calls: [
    callRecord("call-1", "Nicole Smith", "G26-0434", "1695 Jim Fox Road", "2026-08-30T15:00:00.000Z", {
      followUp: true, followType: "Callback", status: "Open", dueDate: "2026-09-01",
      todos: [{ id: "todo-1", text: "Call Nicole with the search update", completed: false, createdAt: "2026-08-30T15:00:00.000Z" }]
    }),
    callRecord("call-2", "Ricky Jones", "G21-0483", "230 Mohawk Creek Road", "2026-08-31T16:30:00.000Z", { results: "Ricky supplied the corrected legal description." }),
    callRecord("call-3", "Nicole Jones", "G26-0999", "1695 Jim Fox Lane", "2026-08-29T12:00:00.000Z", { followUp: true, followType: "Check-In", status: "Open", todos: [{ id: "todo-2", text: "Check in with Nicole Jones", completed: false }] })
  ]
};

function fakeElement(id) {
  return {
    id, hidden: false, disabled: false, value: "", textContent: "", innerHTML: "", dataset: {}, lastChild: { nodeValue: "" },
    classList: { toggle() {}, add() {}, remove() {}, contains() { return false; } },
    addEventListener() {}, setAttribute() {}, remove() { this.removed = true; }, focus() {}, scrollIntoView() {}
  };
}

function makeCloud({ cases = fixtures.cases, email = "dylan.sprouse@unifiedtitle.net", failRead = false, noSession = false } = {}) {
  const calls = { from: [], select: [], eq: [], maybeSingle: 0, getSession: 0, getUser: 0 };
  return {
    calls,
    auth: {
      async getSession() { calls.getSession += 1; return { data: { session: noSession ? null : { user: { id: "dylan-user", email } } } }; },
      async getUser() { calls.getUser += 1; return { data: { user: { id: "dylan-user", email } }, error: null }; }
    },
    from(table) {
      calls.from.push(table);
      assert.equal(table, "tracker_state", "core assistant reads only the compatibility tracker_state view");
      return {
        select(columns) {
          calls.select.push(columns);
          return {
            eq(field, value) {
              calls.eq.push([field, value]);
              return {
                async maybeSingle() {
                  calls.maybeSingle += 1;
                  return failRead ? { data: null, error: new Error("read unavailable") } : { data: { cases: JSON.parse(JSON.stringify(cases)), updated_at: "2026-08-31T18:00:00.000Z", updated_by: "amy@unifiedtitle.net" }, error: null };
                }
              };
            }
          };
        }
      };
    }
  };
}

function createHarness(options = {}) {
  const cloud = options.cloud || makeCloud(options);
  const local = new Map([
    ["uteTitleCaseTracker.v2", JSON.stringify({ schemaVersion: 2, cases: fixtures.cases })],
    ["utei.dylan.callTracker.v1", JSON.stringify(fixtures.calls)]
  ]);
  let writeAttempts = 0;
  const elements = new Map();
  const document = {
    getElementById(id) { if (!elements.has(id)) elements.set(id, fakeElement(id)); return elements.get(id); },
    querySelectorAll() { return []; }
  };
  const window = { supabase: { createClient: () => cloud }, document };
  const sandbox = {
    window, document, console, Date, Map, Set, Math, Number, Intl, JSON, String, Array, Object,
    setTimeout, clearTimeout,
    localStorage: {
      getItem(key) { return local.has(key) ? local.get(key) : null; },
      setItem() { writeAttempts += 1; throw new Error("read-only assistant attempted localStorage write"); },
      removeItem() { writeAttempts += 1; throw new Error("read-only assistant attempted localStorage delete"); }
    }
  };
  const instrumented = source.replace(
    "  initialize();\n}());",
    "  window.__assistantTest={initialize:initialize,loadReadOnlyData:loadReadOnlyData,normalizeCaseNumber:normalizeCaseNumber,extractCaseNumber:extractCaseNumber,extractAddressQuestion:extractAddressQuestion,find_case_by_number:find_case_by_number,find_case_by_address:find_case_by_address,find_contact_calls:find_contact_calls,get_case_details:get_case_details,get_case_history:get_case_history,get_case_calls:get_case_calls,get_open_callbacks:get_open_callbacks,normalizedCaseModel:normalizedCaseModel,answerFromContext:answerFromContext,makeCaseContext:makeCaseContext,makeContactContext:makeContactContext,renderContext:renderContext,clearCurrentContext:clearCurrentContext,handleQuery:handleQuery,setData:function(caseItems,callItems){titleCases=caseItems.map(normalizeTitleCase).filter(function(item){return !item.is_deleted;});callRecords=callItems.map(normalizeCall);},getCurrentContext:function(){return currentContext;}};\n}());"
  );
  vm.createContext(sandbox);
  vm.runInContext(instrumented, sandbox, { filename: jsPath });
  return { api: window.__assistantTest, cloud, elements, local, writeAttempts: () => writeAttempts };
}

(async function run() {
  const harness = createHarness();
  harness.api.setData(fixtures.cases, fixtures.calls);
  assert.equal(harness.api.find_case_by_number("G26-0434")[0].case_number, "G26-0434");
  ["G 26 0434", "G 26 0 4 3 4", "G26 0434", "G 26-0434"].forEach(variant => {
    assert.equal(harness.api.extractCaseNumber("Pull up " + variant + "."), "G26-0434");
    assert.equal(harness.api.find_case_by_number(variant)[0].case_number, "G26-0434");
    harness.api.handleQuery("Pull up " + variant + ".");
    assert.equal(harness.api.getCurrentContext().case_record.case_number, "G26-0434");
  });
  assert.equal(harness.api.find_case_by_number("G26-043").length, 0);
  assert.equal(harness.api.find_case_by_address("1695 Jim Fox Road")[0].case_number, "G26-0434");
  assert.equal(harness.api.find_case_by_address("230 Mohawk Creek Rd.")[0].case_number, "G21-0483");

  const g26 = harness.api.find_case_by_number("G26-0434")[0];
  harness.api.renderContext(harness.api.makeCaseContext(g26));
  assert.match(harness.api.answerFromContext("What is the next step?"), /municipal lien search/i);
  assert.match(harness.api.answerFromContext("What was the most recent call?"), /Nicole Smith/i);
  assert.match(harness.api.answerFromContext("Are there any open callbacks?"), /1 open callback or follow-up/i);

  harness.api.handleQuery("Pull up G26-0434.");
  harness.api.handleQuery("Pull up G26-9998.");
  assert.equal(harness.api.getCurrentContext(), null, "failed explicit case lookup clears previous context");
  assert.equal(harness.elements.get("contextPanel").hidden, true, "failed lookup hides stale panel");

  harness.api.handleQuery("Find Nicole's callback.");
  assert.equal(harness.elements.get("choicePanel").hidden, false);
  assert.match(harness.elements.get("choicePanel").innerHTML, /Nicole Smith/);
  assert.match(harness.elements.get("choicePanel").innerHTML, /Nicole Jones/);

  const loaded = createHarness();
  assert.equal(await loaded.api.initialize(), true);
  assert.deepEqual(loaded.cloud.calls.select, ["cases,updated_at,updated_by"]);
  assert.deepEqual(loaded.cloud.calls.eq, [["id", "office"]]);
  assert.equal(loaded.writeAttempts(), 0);

  const deniedCloud = makeCloud({ email: "amy@unifiedtitle.net" });
  const denied = createHarness({ cloud: deniedCloud });
  assert.equal(await denied.api.initialize(), false);
  assert.equal(deniedCloud.calls.from.length, 0);

  const fallbackCloud = makeCloud({ failRead: true });
  const fallback = createHarness({ cloud: fallbackCloud });
  const fallbackData = await fallback.api.loadReadOnlyData();
  assert.equal(fallbackData.title_cases.length, fixtures.cases.length);
  assert.match(fallbackData.title_warning, /may be older/i);
  assert.equal(fallback.writeAttempts(), 0);

  const forbiddenOperations = [
    [/\.(?:insert|update|upsert|delete)\s*\(/, "Supabase mutation"],
    [/localStorage\.(?:setItem|removeItem|clear)\s*\(/, "localStorage mutation"],
    [/functions\.invoke\s*\(/, "Edge Function invocation"],
    [/\.rpc\s*\(/, "RPC invocation"],
    [/\.storage\b/, "Storage API access"],
    [/\.channel\s*\(/, "Realtime channel access"],
    [/\bfetch\s*\(/, "generic network request"],
    [/OPENAI_API_KEY|service_role/i, "server secret"]
  ];
  forbiddenOperations.forEach(([pattern, label]) => assert.equal(pattern.test(source), false, `core assistant exposes no ${label}`));
  assert(html.includes("dylan-assistant-central-data.js"), "assistant page keeps central read adapter");
  assert(html.includes("dylan-assistant-actions.js"), "assistant page isolates approved write workflow in separate script");

  console.log("Dylan Assistant core read-only lookup and security tests passed.");
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
