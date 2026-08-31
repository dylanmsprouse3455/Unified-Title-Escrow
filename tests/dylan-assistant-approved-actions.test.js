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

assert(html.includes("Nothing is saved until you review and approve them."));
assert(html.includes("Prepare Changes"));
assert(browser.includes('cloud.functions.invoke("propose-assistant-actions"'));
assert(browser.includes('cloud.functions.invoke("apply-assistant-actions"'));
[/\.(?:insert|update|upsert|delete)\s*\(/,/\.rpc\s*\(/,/service_role|SUPABASE_SERVICE_ROLE_KEY/i].forEach(pattern=>assert.equal(pattern.test(browser),false));
assert(browser.includes("Select at least one action to approve."));
assert(browser.includes("expected_updated_at"));
assert(browser.includes("Nothing above has been saved yet."));

assert(proposal.includes("Dylan authentication is required."));
assert(proposal.includes("json_schema"));
assert(proposal.includes("Do not invent facts"));
assert.equal(/createClient\(|\.from\(|\.rpc\s*\(/.test(proposal),false);

assert(apply.includes("Dylan authentication is required."));
assert(apply.includes("SUPABASE_SERVICE_ROLE_KEY"));
assert(apply.includes('admin.rpc("apply_dylan_assistant_actions"'));
["add_case_note","update_next_step","create_todo","create_callback"].forEach(type=>assert(apply.includes(type)));
assert(apply.includes("A callback must have a contact"));

assert(sql.includes("where id = p_case_id"));
assert(sql.includes("updated_at <> p_expected_updated_at"));
assert(sql.includes("for update"));
assert(sql.includes("dylan_assistant_action_audit"));
assert(sql.includes("grant execute on function public.apply_dylan_assistant_actions")&&sql.includes("to service_role"));
assert(sql.includes("revoke all on function public.apply_dylan_assistant_actions")&&sql.includes("from authenticated"));
assert(audit.includes("enable row level security"));

[/\.(?:insert|update|upsert|delete)\s*\(/,/functions\.invoke\s*\(/,/\.rpc\s*\(/,/\bfetch\s*\(/,/OPENAI_API_KEY|service_role/i].forEach(pattern=>assert.equal(pattern.test(core),false));
console.log("Dylan Assistant approved-action security tests passed.");
