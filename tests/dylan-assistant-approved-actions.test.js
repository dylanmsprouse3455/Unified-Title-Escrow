"use strict";
const assert=require("assert"),fs=require("fs"),path=require("path");
const root=path.resolve(__dirname,"..");
const read=p=>fs.readFileSync(path.join(root,p),"utf8");
const browser=read("tracker/dylan-assistant-actions.js");
const html=read("tracker/dylan-assistant.html");
const core=read("tracker/dylan-assistant.js");
const proposal=read("supabase/functions/propose-assistant-actions/index.ts");
const apply=read("supabase/functions/apply-assistant-actions/index.ts");
const sql=read("tracker/dylan-assistant-actions-setup.sql");
const audit=read("tracker/dylan-assistant-approval-setup.sql");

assert(html.includes("Nothing is saved until you review and approve them."),"UI states that proposal is not an automatic save");
assert(html.includes("Prepare Changes"),"UI exposes proposal step separately from approval");
assert(browser.includes('cloud.functions.invoke("propose-assistant-actions"'),"browser uses proposal Edge Function");
assert(browser.includes('cloud.functions.invoke("apply-assistant-actions"'),"browser uses apply Edge Function only after approval");
[/\.(?:insert|update|upsert|delete)\s*\(/,/\.rpc\s*\(/,/service_role|SUPABASE_SERVICE_ROLE_KEY/i].forEach(pattern=>assert.equal(pattern.test(browser),false,"browser has no direct privileged database write path"));
assert(browser.includes("Select at least one action to approve."),"approval requires selected actions");
assert(browser.includes("expected_updated_at"),"approval carries optimistic-concurrency snapshot");

assert(proposal.includes("Dylan authentication is required."),"proposal function verifies Dylan");
assert(proposal.includes("json_schema"),"proposal uses structured output");
assert(proposal.includes("Never invent facts"),"proposal prompt forbids invention");
assert.equal(/createClient\(|\.from\(|\.rpc\s*\(/.test(proposal),false,"proposal function cannot mutate application data");

assert(apply.includes("Dylan authentication is required."),"apply function verifies Dylan");
assert(apply.includes("SUPABASE_SERVICE_ROLE_KEY"),"privileged credential remains server-side");
assert(apply.includes('admin.rpc("apply_dylan_assistant_actions"'),"apply function calls one narrow executor RPC");
["add_case_note","update_next_step","create_todo","create_callback"].forEach(type=>assert(apply.includes(type),`apply allowlists ${type}`));
assert(apply.includes("A callback must have a contact"),"callback approval requires a known contact");

assert(sql.includes("where id = p_case_id"),"executor targets one selected case");
assert(sql.includes("updated_at <> p_expected_updated_at"),"executor detects stale proposal snapshots");
assert(sql.includes("for update"),"executor locks case while applying approved actions");
assert(sql.includes("dylan_assistant_action_audit"),"executor records approved actions in audit trail");
assert(sql.includes("grant execute on function public.apply_dylan_assistant_actions")&&sql.includes("to service_role"),"executor RPC is service-role only");
assert(sql.includes("revoke all on function public.apply_dylan_assistant_actions")&&sql.includes("from authenticated"),"authenticated browsers cannot call executor RPC directly");
assert(audit.includes("enable row level security"),"audit table uses RLS");

[/\.(?:insert|update|upsert|delete)\s*\(/,/functions\.invoke\s*\(/,/\.rpc\s*\(/,/\bfetch\s*\(/,/OPENAI_API_KEY|service_role/i].forEach(pattern=>assert.equal(pattern.test(core),false,"core retrieval engine remains isolated and read-only"));
console.log("Dylan Assistant approved-action security tests passed.");
