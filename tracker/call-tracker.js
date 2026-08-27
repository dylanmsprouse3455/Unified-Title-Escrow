(function(){
"use strict";

var OWNER_EMAIL="dylan.sprouse@unifiedtitle.net";
var STORAGE_KEY="utei.dylan.callTracker.v1";
var installed=false;
var calls=[];
var currentFilter="all";
var editingId="";
var callWizardStep=1;

function ownerSignedIn(){var node=document.getElementById("cloudUserEmail");return String(node&&node.textContent||"").trim().toLowerCase()===OWNER_EMAIL;}
function id(){return window.crypto&&crypto.randomUUID?crypto.randomUUID():"call-"+Date.now()+"-"+Math.random().toString(36).slice(2);}
function now(){return new Date().toISOString();}
function today(){var d=new Date();return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");}
function esc(value){return String(value==null?"":value).replace(/[&<>"']/g,function(ch){return{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[ch];});}
function localDate(value){if(!value)return"—";var d=new Date(value.length===10?value+"T12:00:00":value);if(isNaN(d))return value;return d.toLocaleDateString(undefined,{month:"short",day:"numeric",year:"numeric"});}
function localDateTime(value){if(!value)return"—";var d=new Date(value);if(isNaN(d))return value;return d.toLocaleString(undefined,{month:"short",day:"numeric",year:"numeric",hour:"numeric",minute:"2-digit"});}
function dayDiff(value){if(!value)return null;var due=new Date(value+"T12:00:00"),base=new Date();base.setHours(12,0,0,0);return Math.round((due-base)/86400000);}
function countdown(record){if(record.status==="Completed")return{label:"Completed",kind:"complete"};if(!record.followUpDate)return{label:"—",kind:"none"};var diff=dayDiff(record.followUpDate);if(diff===0)return{label:"Today",kind:"today"};if(diff>0)return{label:diff+" day"+(diff===1?"":"s"),kind:"future"};diff=Math.abs(diff);return{label:diff+" day"+(diff===1?"":"s")+" overdue",kind:"overdue"};}
function isWaiting(record){return /^Waiting/i.test(record.status||"")||/^Waiting/i.test(record.followUpType||"");}
function isCompleted(record){return record.status==="Completed";}
function needsCallback(record){return !isCompleted(record)&&(record.callbackRequired||record.followUpType==="Callback");}

function load(){try{var data=JSON.parse(localStorage.getItem(STORAGE_KEY)||"[]");calls=Array.isArray(data)?data:[];}catch(e){calls=[];}}
function persist(){localStorage.setItem(STORAGE_KEY,JSON.stringify(calls));}
function sortCalls(list){return list.slice().sort(function(a,b){if(isCompleted(a)!==isCompleted(b))return isCompleted(a)?1:-1;var ad=a.followUpDate||"9999-12-31",bd=b.followUpDate||"9999-12-31";if(ad!==bd)return ad.localeCompare(bd);return String(b.updatedAt||"").localeCompare(String(a.updatedAt||""));});}

function addStyles(){if(document.getElementById("callTrackerStyles"))return;var s=document.createElement("style");s.id="callTrackerStyles";s.textContent=`
.call-tool-card{width:100%;display:grid;grid-template-columns:auto 1fr auto;gap:14px;align-items:center;padding:18px;border:2px solid #c7d5e4;border-radius:16px;background:#f8fbff;color:#17345e;text-align:left;box-shadow:0 5px 16px rgba(23,52,94,.07)}.call-tool-card:hover{background:#fff;border-color:#8ca8c5;filter:none}.call-tool-icon{width:48px;height:48px;display:grid;place-items:center;border-radius:13px;background:#17345e;color:#fff;font-size:1.35rem}.call-tool-card strong{display:block;font-size:1.05rem}.call-tool-card small{display:block;margin-top:4px;color:#697991;font-weight:700;line-height:1.4}.call-tool-arrow{font-size:1.45rem}.toolbox-card-list{display:grid;gap:12px;margin:18px 0}.call-tracker-app{display:none;position:fixed;inset:0;z-index:215;background:#f4f7fb;overflow:auto;color:#172033}.call-tracker-app.show{display:block}.call-shell{width:min(1500px,100%);margin:0 auto;padding:24px}.call-topbar{display:flex;justify-content:space-between;gap:16px;align-items:flex-start;flex-wrap:wrap;margin-bottom:18px}.call-brand small{display:block;color:#a17310;font-size:.73rem;font-weight:900;letter-spacing:.11em;text-transform:uppercase}.call-brand h1{margin:5px 0 5px;color:#17345e;font-size:clamp(1.8rem,4vw,2.55rem)}.call-brand p{margin:0;color:#697991}.call-actions{display:flex;gap:8px;flex-wrap:wrap}.call-btn{border:0;border-radius:11px;padding:11px 14px;font-weight:900;cursor:pointer;background:#17345e;color:#fff}.call-btn:hover{filter:brightness(.97)}.call-btn.secondary{background:#fff;color:#17345e;border:1px solid #c9d4e1}.call-btn.gold{background:#c9a13b;color:#172033}.call-btn.danger{background:#fff4f3;color:#a52d25;border:1px solid #e3bbb7}.call-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:16px}.call-stat{background:#fff;border:1px solid #dce4ed;border-radius:16px;padding:17px;box-shadow:0 6px 18px rgba(23,52,94,.06)}.call-stat strong{display:block;color:#17345e;font-size:1.8rem}.call-stat span{color:#6b7a91;font-size:.86rem;font-weight:800}.call-toolbar{display:grid;grid-template-columns:minmax(240px,1fr) auto;gap:10px;margin-bottom:11px}.call-search{width:100%;min-height:44px;padding:10px 13px;border:2px solid #c4d0de;border-radius:11px;background:#fff;font:inherit}.call-tabs{display:flex;gap:7px;flex-wrap:wrap;margin-bottom:13px}.call-tab{padding:9px 12px;border:1px solid #cbd6e2;border-radius:999px;background:#fff;color:#53647d;font-weight:900;cursor:pointer}.call-tab.active{background:#17345e;color:#fff;border-color:#17345e}.call-table-wrap{overflow:auto;border:1px solid #d9e2ec;border-radius:16px;background:#fff;box-shadow:0 7px 22px rgba(23,52,94,.06)}.call-table{width:100%;border-collapse:collapse;min-width:1220px}.call-table th{position:sticky;top:0;z-index:1;padding:12px 11px;background:#edf2f8;color:#455871;font-size:.72rem;letter-spacing:.05em;text-transform:uppercase;text-align:left;border-bottom:2px solid #cbd7e4}.call-table td{padding:12px 11px;border-bottom:1px solid #e4e9f0;vertical-align:top;font-size:.84rem}.call-table tbody tr{cursor:pointer}.call-table tbody tr:hover{background:#f7faff}.call-main{font-weight:900;color:#17345e}.call-muted{color:#738197;font-size:.78rem;margin-top:3px}.call-pill{display:inline-block;padding:5px 8px;border-radius:999px;background:#edf2f7;color:#40536d;font-size:.72rem;font-weight:900}.call-pill.waiting{background:#fff4d8;color:#7a5707}.call-pill.complete{background:#e8f6ee;color:#1f7049}.call-countdown{font-weight:900}.call-countdown.today{color:#9a6810}.call-countdown.overdue{color:#b23b32}.call-countdown.future{color:#2c6e49}.call-empty{padding:42px;text-align:center;color:#758299}.call-modal-wrap{display:none;position:fixed;inset:0;z-index:230;background:rgba(9,26,48,.55);padding:18px;align-items:flex-start;justify-content:center;overflow:auto}.call-modal-wrap.show{display:flex}.call-modal{width:min(980px,100%);margin-top:12px;background:#fff;border-radius:20px;box-shadow:0 24px 70px rgba(9,26,48,.28);overflow:hidden}.call-modal-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;padding:20px 22px;background:#17345e;color:#fff}.call-modal-head h2{margin:0;font-size:1.35rem}.call-modal-head p{margin:5px 0 0;color:#d7e2ef;font-size:.82rem}.call-close{width:36px;height:36px;padding:0;border:1px solid rgba(255,255,255,.35);border-radius:50%;background:rgba(255,255,255,.1);color:#fff;font-size:1.25rem;cursor:pointer}.call-modal-body{padding:20px 22px}.call-section{margin-bottom:18px;padding:16px;border:1px solid #dbe3ec;border-radius:15px;background:#f9fbfd}.call-section h3{margin:0 0 12px;color:#17345e;font-size:1rem}.call-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:11px}.call-field{display:flex;flex-direction:column;gap:5px}.call-field.span2{grid-column:span 2}.call-field.full{grid-column:1/-1}.call-field label{color:#5c6d84;font-size:.75rem;font-weight:900}.call-field input,.call-field select,.call-field textarea{width:100%;min-height:42px;padding:9px 11px;border:1px solid #bdcada;border-radius:9px;background:#fff;color:#172033;font:inherit}.call-field textarea{min-height:86px;resize:vertical}.call-check{display:flex;align-items:center;gap:8px;min-height:42px;color:#42566f;font-weight:800}.call-check input{width:18px;height:18px}.call-history{display:grid;gap:8px;max-height:240px;overflow:auto}.call-history-item{padding:10px 12px;border:1px solid #dce4ed;border-radius:10px;background:#fff}.call-history-item time{display:block;color:#7b8798;font-size:.72rem;font-weight:800;margin-bottom:3px}.call-history-item div{color:#334861;font-size:.85rem;line-height:1.45}.call-history-add{display:grid;grid-template-columns:1fr auto;gap:8px;margin-top:9px}.call-history-add input{min-height:42px;padding:9px 11px;border:1px solid #bdcada;border-radius:9px}.call-modal-actions{display:flex;justify-content:space-between;gap:9px;flex-wrap:wrap;padding:16px 22px;border-top:1px solid #dfe6ee;background:#f8fafc}.call-modal-actions .right{display:flex;gap:8px;flex-wrap:wrap}.call-note{margin-top:10px;color:#778398;font-size:.75rem}.call-footer{text-align:center;color:#7a8698;font-size:.76rem;margin:14px 0}.toolbox-back-row{display:flex;justify-content:flex-start;margin-top:12px}@media(max-width:850px){.call-stats{grid-template-columns:1fr 1fr}.call-grid{grid-template-columns:1fr 1fr}.call-field.full{grid-column:1/-1}}@media(max-width:560px){.call-shell{padding:14px}.call-stats,.call-grid,.call-toolbar{grid-template-columns:1fr}.call-field.span2,.call-field.full{grid-column:auto}.call-actions{width:100%}.call-actions .call-btn{flex:1}.call-history-add{grid-template-columns:1fr}.call-modal-body{padding:15px}.call-modal-actions{padding:13px}.call-stat strong{font-size:1.55rem}}

.call-modal{width:min(780px,100%)}
.call-wizard-progress{padding:14px 22px 0;background:#17345e;color:#fff}
.call-wizard-progress-row{display:flex;justify-content:space-between;gap:12px;color:#dce7f3;font-size:.76rem;font-weight:900}
.call-wizard-track{height:8px;margin-top:8px;border-radius:999px;background:rgba(255,255,255,.2);overflow:hidden}
.call-wizard-track span{display:block;width:14%;height:100%;border-radius:999px;background:#d5aa39;transition:width .2s ease}
.call-wizard-step{display:none;margin-bottom:0;padding:20px;border:2px solid #d3deea;border-radius:16px;background:linear-gradient(145deg,#fbfdff,#f4f8fc)}
.call-wizard-step.active{display:block}
.call-wizard-question{margin:0 0 6px;color:#17345e;font-size:1.42rem;font-weight:900;line-height:1.2}
.call-wizard-help{margin:0 0 18px;color:#68778d;line-height:1.5}
.call-wizard-step .call-grid{grid-template-columns:1fr 1fr}
.call-wizard-step .call-field.full{grid-column:1/-1}
.call-wizard-step .call-field input,.call-wizard-step .call-field select,.call-wizard-step .call-field textarea{min-height:50px;border:2px solid #c5d2e0;border-radius:11px;font-size:1rem}
.call-wizard-step .call-field textarea{min-height:118px}
.call-wizard-step .call-field label{font-size:.82rem;color:#425873}
.call-wizard-note{margin-top:13px;padding:10px 12px;border-radius:10px;background:#edf4fb;color:#3f5773;font-size:.8rem;font-weight:750;line-height:1.45}
.call-wizard-review{display:grid;grid-template-columns:1fr 1fr;gap:9px}
.call-review-item{padding:11px 12px;border:1px solid #d3deea;border-radius:11px;background:#fff}
.call-review-item.wide{grid-column:1/-1}
.call-review-item span{display:block;margin-bottom:4px;color:#728096;font-size:.68rem;font-weight:900;letter-spacing:.06em;text-transform:uppercase}
.call-review-item strong{display:block;color:#17345e;font-size:.9rem;line-height:1.4;white-space:pre-wrap}
.call-wizard-actions{display:flex;align-items:center;gap:8px}
.call-wizard-actions button:disabled{opacity:.45;cursor:not-allowed}
#saveCallButton.call-save-finish{background:#c9a13b;color:#172033}
.call-modal-body{min-height:390px}
.call-modal-actions{position:sticky;bottom:0;z-index:2}
.call-history-in-wizard{margin-top:16px}
@media(max-width:620px){
  .call-wizard-progress{padding:12px 16px 0}
  .call-wizard-step{padding:15px}
  .call-wizard-step .call-grid,.call-wizard-review{grid-template-columns:1fr}
  .call-wizard-step .call-field.full,.call-review-item.wide{grid-column:auto}
  .call-wizard-question{font-size:1.22rem}
  .call-modal-actions .right.call-wizard-actions{width:100%;display:grid;grid-template-columns:1fr 1fr}
  .call-modal-actions .right.call-wizard-actions button{width:100%}
  .call-modal-actions .right.call-wizard-actions #cancelCallButton{grid-column:1/-1;order:4}
}

@media print{.call-tracker-app{display:none!important}}
`;
document.head.appendChild(s);}

function installToolboxEntry(){var panel=document.getElementById("dylanToolboxPanel");if(!panel)return false;panel.innerHTML='<h2>Dylans Tool Box</h2><p>Your personal work tools live here.</p><div class="toolbox-card-list"><button id="openCallTrackerTool" type="button" class="call-tool-card"><span class="call-tool-icon">☎</span><span><strong>Call &amp; Follow-Up Tracker</strong><small>Track incoming calls, callbacks, check-ins, next actions, and printable call sheets.</small></span><span class="call-tool-arrow">›</span></button></div><div class="toolbox-back-row"><button id="callToolboxBackHome" type="button" class="secondary">← Back to Home</button></div>';
document.getElementById("openCallTrackerTool").addEventListener("click",openApp);document.getElementById("callToolboxBackHome").addEventListener("click",function(){var grid=document.getElementById("dylanHomeGrid");if(grid)grid.style.display="grid";panel.classList.remove("show");});return true;}

function installApp(){if(document.getElementById("callTrackerApp"))return;var app=document.createElement("div");app.id="callTrackerApp";app.className="call-tracker-app";app.innerHTML='<main class="call-shell"><div class="call-topbar"><div class="call-brand"><small>Unified Title &amp; Escrow · Dylan\'s Tool Box</small><h1>Call &amp; Follow-Up Tracker</h1><p>Keep calls, promises, callbacks, and check-ins from falling through the cracks.</p></div><div class="call-actions"><button id="callBackToolbox" class="call-btn secondary" type="button">← Tool Box</button><button id="newCallButton" class="call-btn gold" type="button">+ New Call</button></div></div><section class="call-stats"><div class="call-stat"><strong id="callDueToday">0</strong><span>Due Today</span></div><div class="call-stat"><strong id="callUpcoming">0</strong><span>Upcoming</span></div><div class="call-stat"><strong id="callOverdue">0</strong><span>Overdue</span></div><div class="call-stat"><strong id="callWaiting">0</strong><span>Waiting on Others</span></div></section><div class="call-toolbar"><input id="callSearch" class="call-search" placeholder="Search file number, address, caller, phone, notes, or next action…"><button id="newCallButton2" class="call-btn" type="button">+ Add Call / Follow-Up</button></div><nav id="callTabs" class="call-tabs" aria-label="Call tracker views"></nav><div class="call-table-wrap"><table class="call-table"><thead><tr><th>File</th><th>Property</th><th>Caller</th><th>Issue</th><th>Assigned To</th><th>Status</th><th>Follow-Up</th><th>Days Remaining</th><th>Last Update</th><th>Next Action</th></tr></thead><tbody id="callRows"></tbody></table><div id="callEmpty" class="call-empty" style="display:none">No call records match this view.</div></div><div class="call-footer">Call records are saved in this browser for Dylan\'s personal workspace.</div></main>';
document.body.appendChild(app);document.getElementById("callBackToolbox").addEventListener("click",closeApp);document.getElementById("newCallButton").addEventListener("click",function(){openEditor();});document.getElementById("newCallButton2").addEventListener("click",function(){openEditor();});document.getElementById("callSearch").addEventListener("input",render);installModal();installCallWizard();buildTabs();}

function installModal(){var wrap=document.createElement("div");wrap.id="callEditorWrap";wrap.className="call-modal-wrap";wrap.innerHTML='<section class="call-modal" role="dialog" aria-modal="true" aria-labelledby="callEditorTitle"><header class="call-modal-head"><div><h2 id="callEditorTitle">New Call</h2><p id="callEditorSubtitle">Enter the essentials first, then set the follow-up.</p></div><button id="callEditorClose" class="call-close" type="button" aria-label="Close">×</button></header><div class="call-modal-body"><section class="call-section"><h3>Call essentials</h3><div class="call-grid"><div class="call-field"><label for="ctFile">File Number</label><input id="ctFile" placeholder="G26-0000"></div><div class="call-field span2"><label for="ctAddress">Property Address</label><input id="ctAddress"></div><div class="call-field"><label for="ctCaller">Caller Name</label><input id="ctCaller"></div><div class="call-field"><label for="ctCompany">Company / Role</label><input id="ctCompany" placeholder="Realtor, lender, client…"></div><div class="call-field"><label for="ctPhone">Callback Number</label><input id="ctPhone" type="tel"></div><div class="call-field span2"><label for="ctIssue">Reason / Issue Type</label><input id="ctIssue" list="ctIssueList" placeholder="Closing question, earnest money, document request…"><datalist id="ctIssueList"><option value="Closing Question"><option value="Earnest Money"><option value="Title Search"><option value="Document Request"><option value="Lender Question"><option value="Realtor Question"><option value="Client Question"><option value="Scheduling"><option value="Other"></datalist></div><div class="call-field full"><label for="ctNotes">Call Notes</label><textarea id="ctNotes" placeholder="What did the caller need and what was discussed?"></textarea></div><div class="call-field full"><label for="ctPromise">What I Promised / Commitment</label><input id="ctPromise" placeholder="Example: Call once Lynn confirms closing time"></div></div></section><section class="call-section"><h3>Follow-up</h3><div class="call-grid"><div class="call-field"><label for="ctFollowType">Follow-Up Type</label><select id="ctFollowType"><option>No Follow-Up</option><option>Callback</option><option>Internal Follow-Up</option><option>Check-In</option><option>Email</option><option>Document Needed</option><option>Waiting on Client</option><option>Waiting on Third Party</option></select></div><div class="call-field"><label for="ctAssigned">Assigned To</label><input id="ctAssigned" list="ctAssignedList" value="Dylan"><datalist id="ctAssignedList"><option value="Dylan"><option value="Lynn"><option value="Cindy"></datalist></div><div class="call-field"><label for="ctStatus">Status</label><select id="ctStatus"><option>Open</option><option>Needs Callback</option><option>In Progress</option><option>Waiting on Lynn</option><option>Waiting on Someone</option><option>Waiting on Client</option><option>Waiting on Third Party</option><option>Completed</option></select></div><div class="call-field"><label for="ctFollowDate">Callback / Check-In Date</label><input id="ctFollowDate" type="date"></div><div class="call-field span2"><label class="call-check"><input id="ctCallback" type="checkbox"> Callback required</label></div><div class="call-field full"><label for="ctNext">Next Action</label><input id="ctNext" placeholder="What needs to happen next?"></div><div class="call-field full"><label for="ctOutcome">Final Outcome</label><textarea id="ctOutcome" placeholder="Complete this when the item is resolved."></textarea></div></div></section><section id="callHistorySection" class="call-section" style="display:none"><h3>Running Call History</h3><div id="callHistory" class="call-history"></div><div class="call-history-add"><input id="callHistoryText" placeholder="Add an update, callback result, email sent, document received…"><button id="addCallHistory" type="button" class="call-btn">Add Update</button></div></section><div class="call-note">Status and Next Action are separate so you can see both where the item stands and exactly what needs to happen next.</div></div><footer class="call-modal-actions"><div><button id="deleteCallButton" type="button" class="call-btn danger" style="display:none">Delete</button></div><div class="right"><button id="printCallButton" type="button" class="call-btn secondary" style="display:none">Print Call Sheet</button><button id="cancelCallButton" type="button" class="call-btn secondary">Cancel</button><button id="saveCallButton" type="button" class="call-btn">Save Call</button></div></footer></section>';
document.body.appendChild(wrap);document.getElementById("callEditorClose").addEventListener("click",closeEditor);document.getElementById("cancelCallButton").addEventListener("click",closeEditor);document.getElementById("saveCallButton").addEventListener("click",saveEditor);document.getElementById("deleteCallButton").addEventListener("click",deleteCurrent);document.getElementById("printCallButton").addEventListener("click",function(){if(editingId)printRecord(editingId);});document.getElementById("addCallHistory").addEventListener("click",addHistory);document.getElementById("callHistoryText").addEventListener("keydown",function(e){if(e.key==="Enter"){e.preventDefault();addHistory();}});wrap.addEventListener("click",function(e){if(e.target===wrap)closeEditor();});}

var FILTERS=[["all","All Calls"],["callback","Needs Callback"],["waiting","Waiting on Someone"],["today","Due Today"],["upcoming","Upcoming"],["overdue","Overdue"],["complete","Completed"]];
function buildTabs(){var box=document.getElementById("callTabs");box.innerHTML=FILTERS.map(function(f){return'<button type="button" class="call-tab '+(f[0]===currentFilter?'active':'')+'" data-filter="'+f[0]+'">'+f[1]+'</button>';}).join("");box.querySelectorAll(".call-tab").forEach(function(btn){btn.addEventListener("click",function(){currentFilter=btn.dataset.filter;buildTabs();render();});});}
function matchesFilter(r){var diff=dayDiff(r.followUpDate);if(currentFilter==="callback")return needsCallback(r);if(currentFilter==="waiting")return !isCompleted(r)&&isWaiting(r);if(currentFilter==="today")return !isCompleted(r)&&diff===0;if(currentFilter==="upcoming")return !isCompleted(r)&&diff!==null&&diff>0;if(currentFilter==="overdue")return !isCompleted(r)&&diff!==null&&diff<0;if(currentFilter==="complete")return isCompleted(r);return true;}
function matchesSearch(r,q){if(!q)return true;return [r.fileNumber,r.address,r.caller,r.companyRole,r.phone,r.issueType,r.notes,r.promise,r.assignedTo,r.status,r.followUpType,r.nextAction,r.finalOutcome].join(" ").toLowerCase().indexOf(q)!==-1||(r.history||[]).some(function(h){return String(h.text||"").toLowerCase().indexOf(q)!==-1;});}

function renderStats(){var open=calls.filter(function(r){return !isCompleted(r);});document.getElementById("callDueToday").textContent=open.filter(function(r){return dayDiff(r.followUpDate)===0;}).length;document.getElementById("callUpcoming").textContent=open.filter(function(r){var d=dayDiff(r.followUpDate);return d!==null&&d>0;}).length;document.getElementById("callOverdue").textContent=open.filter(function(r){var d=dayDiff(r.followUpDate);return d!==null&&d<0;}).length;document.getElementById("callWaiting").textContent=open.filter(isWaiting).length;}
function render(){if(!document.getElementById("callRows"))return;renderStats();var q=String(document.getElementById("callSearch").value||"").trim().toLowerCase();var rows=sortCalls(calls.filter(matchesFilter).filter(function(r){return matchesSearch(r,q);}));var body=document.getElementById("callRows"),empty=document.getElementById("callEmpty");body.innerHTML=rows.map(function(r){var cd=countdown(r),wait=isWaiting(r)?" waiting":"",complete=isCompleted(r)?" complete":"";return'<tr data-id="'+esc(r.id)+'"><td><div class="call-main">'+esc(r.fileNumber||"—")+'</div></td><td><div>'+esc(r.address||"—")+'</div></td><td><div class="call-main">'+esc(r.caller||"—")+'</div><div class="call-muted">'+esc(r.phone||r.companyRole||"")+'</div></td><td>'+esc(r.issueType||"—")+'</td><td>'+esc(r.assignedTo||"—")+'</td><td><span class="call-pill'+wait+complete+'">'+esc(r.status||"Open")+'</span></td><td><div>'+esc(r.followUpType||"No Follow-Up")+'</div><div class="call-muted">'+(r.followUpDate?localDate(r.followUpDate):"No date")+'</div></td><td><span class="call-countdown '+cd.kind+'">'+esc(cd.label)+'</span></td><td>'+esc(localDateTime(r.updatedAt||r.createdAt))+'</td><td>'+esc(r.nextAction||"—")+'</td></tr>';}).join("");empty.style.display=rows.length?"none":"block";body.querySelectorAll("tr[data-id]").forEach(function(row){row.addEventListener("click",function(){openEditor(row.dataset.id);});});}

function openApp(){if(!ownerSignedIn())return;load();installApp();document.getElementById("callTrackerApp").classList.add("show");render();}
function closeApp(){document.getElementById("callTrackerApp").classList.remove("show");var panel=document.getElementById("dylanToolboxPanel"),grid=document.getElementById("dylanHomeGrid");if(grid)grid.style.display="none";if(panel)panel.classList.add("show");}

function field(id){return document.getElementById(id);}
function clearForm(){
  ["ctFile","ctAddress","ctCaller","ctCompany","ctPhone","ctIssue","ctNotes","ctPromise","ctNext","ctOutcome","callHistoryText"].forEach(function(k){var el=field(k);if(el)el.value="";});
  var follow=field("ctFollowType");if(follow)follow.value="No Follow-Up";
  var assigned=field("ctAssigned");if(assigned)assigned.value="Dylan";
  var status=field("ctStatus");if(status)status.value="Open";
  var date=field("ctFollowDate");if(date)date.value="";
  var callback=field("ctCallback");if(callback)callback.checked=false;
}
function openEditor(recordId){editingId=recordId||"";clearForm();var record=calls.find(function(r){return r.id===editingId;});field("callEditorTitle").textContent=record?"Call / Follow-Up Record":"New Call";field("callEditorSubtitle").textContent=record?(record.fileNumber||"No file number")+" · "+(record.caller||"No caller entered"):"Enter the essentials first, then set the follow-up.";field("callHistorySection").style.display=record?"block":"none";field("deleteCallButton").style.display=record?"inline-block":"none";field("printCallButton").style.display=record?"inline-block":"none";if(record){field("ctFile").value=record.fileNumber||"";field("ctAddress").value=record.address||"";field("ctCaller").value=record.caller||"";field("ctCompany").value=record.companyRole||"";field("ctPhone").value=record.phone||"";field("ctIssue").value=record.issueType||"";field("ctNotes").value=record.notes||"";field("ctPromise").value=record.promise||"";field("ctFollowType").value=record.followUpType||"No Follow-Up";field("ctAssigned").value=record.assignedTo||"Dylan";field("ctStatus").value=record.status||"Open";field("ctFollowDate").value=record.followUpDate||"";field("ctCallback").checked=!!record.callbackRequired;field("ctNext").value=record.nextAction||"";field("ctOutcome").value=record.finalOutcome||"";renderHistory(record);}field("callEditorWrap").classList.add("show");setTimeout(function(){field("ctFile").focus();},40);}
function closeEditor(){field("callEditorWrap").classList.remove("show");editingId="";}
function values(){return{fileNumber:field("ctFile").value.trim(),address:field("ctAddress").value.trim(),caller:field("ctCaller").value.trim(),companyRole:field("ctCompany").value.trim(),phone:field("ctPhone").value.trim(),issueType:field("ctIssue").value.trim(),notes:field("ctNotes").value.trim(),promise:field("ctPromise").value.trim(),followUpType:field("ctFollowType").value,assignedTo:field("ctAssigned").value.trim()||"Dylan",status:field("ctStatus").value,followUpDate:field("ctFollowDate").value,callbackRequired:field("ctCallback").checked,nextAction:field("ctNext").value.trim(),finalOutcome:field("ctOutcome").value.trim()};}
var LABELS={fileNumber:"file number",address:"address",caller:"caller",companyRole:"company / role",phone:"phone",issueType:"issue type",notes:"call notes",promise:"commitment",followUpType:"follow-up type",assignedTo:"assigned to",status:"status",followUpDate:"follow-up date",callbackRequired:"callback requirement",nextAction:"next action",finalOutcome:"final outcome"};
function saveEditor(){var data=values();if(!data.fileNumber&&!data.caller&&!data.notes){alert("Enter at least a file number, caller, or call note before saving.");return;}var stamp=now(),record=calls.find(function(r){return r.id===editingId;});if(!record){record=Object.assign({id:id(),createdAt:stamp,updatedAt:stamp,history:[]},data);record.history.push({id:id(),at:stamp,text:"Call record created"});calls.unshift(record);editingId=record.id;}else{var changed=[];Object.keys(data).forEach(function(k){if(String(record[k]||"")!==String(data[k]||""))changed.push(LABELS[k]||k);record[k]=data[k];});record.updatedAt=stamp;if(changed.length)record.history.push({id:id(),at:stamp,text:"Updated "+changed.join(", ")});}persist();render();renderHistory(record);field("callHistorySection").style.display="block";field("deleteCallButton").style.display="inline-block";field("printCallButton").style.display="inline-block";field("callEditorTitle").textContent="Call / Follow-Up Record";field("callEditorSubtitle").textContent=(record.fileNumber||"No file number")+" · "+(record.caller||"No caller entered");}
function renderHistory(record){var list=(record.history||[]).slice().sort(function(a,b){return String(b.at).localeCompare(String(a.at));});field("callHistory").innerHTML=list.length?list.map(function(h){return'<div class="call-history-item"><time>'+esc(localDateTime(h.at))+'</time><div>'+esc(h.text)+'</div></div>';}).join(""):'<div class="call-muted">No history yet.</div>';}
function addHistory(){var record=calls.find(function(r){return r.id===editingId;}),text=field("callHistoryText").value.trim();if(!record||!text)return;var stamp=now();record.history=record.history||[];record.history.push({id:id(),at:stamp,text:text});record.updatedAt=stamp;field("callHistoryText").value="";persist();renderHistory(record);render();}
function deleteCurrent(){var record=calls.find(function(r){return r.id===editingId;});if(!record)return;if(!confirm("Delete this call record?"))return;calls=calls.filter(function(r){return r.id!==editingId;});persist();closeEditor();render();}

function printRecord(recordId){var r=calls.find(function(x){return x.id===recordId;});if(!r)return;var cd=countdown(r),history=(r.history||[]).slice().sort(function(a,b){return String(b.at).localeCompare(String(a.at));}).slice(0,8);var w=window.open("","utei-call-sheet","width=850,height=1000");if(!w){alert("Please allow pop-ups to print the call sheet.");return;}w.document.write('<!doctype html><html><head><meta charset="utf-8"><title>Call Sheet '+esc(r.fileNumber||"")+'</title><style>@page{size:letter;margin:.42in}*{box-sizing:border-box}body{font-family:Arial,sans-serif;color:#172033;margin:0;font-size:11px}.head{border-bottom:3px solid #17345e;padding-bottom:10px;margin-bottom:12px}.office{color:#9a6f0d;font-size:10px;font-weight:800;letter-spacing:.1em;text-transform:uppercase}.head h1{margin:4px 0 3px;color:#17345e;font-size:23px}.sub{color:#65738a}.grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}.box{border:1px solid #b9c6d5;border-radius:8px;padding:8px;min-height:48px}.wide{grid-column:1/-1}.label{display:block;color:#607086;font-size:8px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;margin-bottom:4px}.value{font-size:11px;font-weight:700;white-space:pre-wrap;line-height:1.35}.section{margin-top:11px}.section h2{margin:0 0 6px;color:#17345e;font-size:12px}.history{border:1px solid #c5d0dc;border-radius:8px;overflow:hidden}.hist{display:grid;grid-template-columns:125px 1fr;gap:7px;padding:6px 8px;border-bottom:1px solid #e0e6ed}.hist:last-child{border:0}.hist time{color:#68768a;font-size:9px}.footer{margin-top:10px;padding-top:7px;border-top:1px solid #ccd6e1;color:#748196;font-size:9px}@media print{button{display:none}}</style></head><body><div class="head"><div class="office">Unified Title &amp; Escrow</div><h1>Call / Follow-Up Sheet</h1><div class="sub">Printed '+esc(localDateTime(now()))+'</div></div><div class="grid"><div class="box"><span class="label">File Number</span><div class="value">'+esc(r.fileNumber||"—")+'</div></div><div class="box"><span class="label">Property Address</span><div class="value">'+esc(r.address||"—")+'</div></div><div class="box"><span class="label">Caller</span><div class="value">'+esc(r.caller||"—")+'</div></div><div class="box"><span class="label">Company / Role</span><div class="value">'+esc(r.companyRole||"—")+'</div></div><div class="box"><span class="label">Callback Number</span><div class="value">'+esc(r.phone||"—")+'</div></div><div class="box"><span class="label">Reason / Issue</span><div class="value">'+esc(r.issueType||"—")+'</div></div><div class="box wide"><span class="label">Call Notes</span><div class="value">'+esc(r.notes||"—")+'</div></div><div class="box wide"><span class="label">What I Promised / Commitment</span><div class="value">'+esc(r.promise||"—")+'</div></div><div class="box"><span class="label">Status</span><div class="value">'+esc(r.status||"Open")+'</div></div><div class="box"><span class="label">Assigned To</span><div class="value">'+esc(r.assignedTo||"—")+'</div></div><div class="box"><span class="label">Follow-Up Type</span><div class="value">'+esc(r.followUpType||"No Follow-Up")+(r.callbackRequired?" · Callback required":"")+'</div></div><div class="box"><span class="label">Callback / Check-In Date</span><div class="value">'+esc(r.followUpDate?localDate(r.followUpDate):"—")+' · '+esc(cd.label)+'</div></div><div class="box wide"><span class="label">Next Action</span><div class="value">'+esc(r.nextAction||"—")+'</div></div><div class="box wide"><span class="label">Final Outcome</span><div class="value">'+esc(r.finalOutcome||"—")+'</div></div></div><div class="section"><h2>Recent Call History</h2><div class="history">'+(history.length?history.map(function(h){return'<div class="hist"><time>'+esc(localDateTime(h.at))+'</time><div>'+esc(h.text)+'</div></div>';}).join(""):'<div class="hist"><div>No history recorded.</div></div>')+'</div></div><div class="footer">Personal Call &amp; Follow-Up Tracker · Dylan</div><script>window.onload=function(){window.print();}<\/script></body></html>');w.document.close();}


/* CALL WIZARD START */
var callWizardOpenEditorBase=openEditor;
var callWizardSaveEditorBase=saveEditor;

function installCallWizard(){
  var wrap=document.getElementById("callEditorWrap");
  if(!wrap||document.getElementById("callWizardProgress"))return;

  var modal=wrap.querySelector(".call-modal");
  var body=wrap.querySelector(".call-modal-body");
  var footer=wrap.querySelector(".call-modal-actions");
  var right=footer.querySelector(".right");
  var oldSections=[].slice.call(body.querySelectorAll(":scope > .call-section"));
  var history=document.getElementById("callHistorySection");
  var note=body.querySelector(":scope > .call-note");

  var progress=document.createElement("div");
  progress.id="callWizardProgress";
  progress.className="call-wizard-progress";
  progress.innerHTML='<div class="call-wizard-progress-row"><span id="callWizardStepText">Step 1 of 7</span><span id="callWizardPercent">14%</span></div><div class="call-wizard-track"><span id="callWizardBar"></span></div>';
  modal.insertBefore(progress,body);

  var stepInfo=[
    ["What file is this call connected to?","Enter the file number and property address if they are available."],
    ["Who is calling?","Add enough information to know who to contact later."],
    ["What is the call about?","Choose or type the issue, then capture what was discussed."],
    ["What did you promise to do?","Record any commitment you made so it does not get lost."],
    ["Does anything need to happen after this call?","Choose the follow-up type and set a callback or check-in date when needed."],
    ["Who owns the next step?","Keep the current status separate from the exact action that needs to happen."],
    ["Review and save the call","Check the important details below. Use Back to correct anything before saving."]
  ];
  var fieldGroups=[
    ["ctFile","ctAddress"],
    ["ctCaller","ctCompany","ctPhone"],
    ["ctIssue","ctNotes"],
    ["ctPromise"],
    ["ctFollowType","ctFollowDate","ctCallback"],
    ["ctAssigned","ctStatus","ctNext","ctOutcome"]
  ];

  fieldGroups.forEach(function(ids,index){
    var step=document.createElement("section");
    step.className="call-wizard-step";
    step.dataset.callStep=String(index+1);
    step.innerHTML='<h3 class="call-wizard-question">'+stepInfo[index][0]+'</h3><p class="call-wizard-help">'+stepInfo[index][1]+'</p><div class="call-grid"></div>';
    var grid=step.querySelector(".call-grid");
    ids.forEach(function(fieldId){
      var input=document.getElementById(fieldId);
      var fieldBox=input&&input.closest(".call-field");
      if(fieldBox)grid.appendChild(fieldBox);
    });
    if(index===0){
      var n=document.createElement("div");n.className="call-wizard-note";n.textContent="You can continue if one of these is not known yet.";step.appendChild(n);
    }
    if(index===3){
      var p=document.createElement("div");p.className="call-wizard-note";p.textContent="Leave this blank when you did not make a commitment.";step.appendChild(p);
    }
    body.insertBefore(step,note||history||null);
  });

  var review=document.createElement("section");
  review.className="call-wizard-step";
  review.dataset.callStep="7";
  review.innerHTML='<h3 class="call-wizard-question">'+stepInfo[6][0]+'</h3><p class="call-wizard-help">'+stepInfo[6][1]+'</p><div id="callWizardReview" class="call-wizard-review"></div>';
  if(history){history.classList.add("call-history-in-wizard");review.appendChild(history);}
  body.insertBefore(review,note||null);

  oldSections.forEach(function(section){if(section!==history&&section.parentNode)section.remove();});
  if(note)note.remove();

  var back=document.createElement("button");
  back.id="callWizardBack";
  back.type="button";
  back.className="call-btn secondary";
  back.textContent="Back";

  var next=document.createElement("button");
  next.id="callWizardNext";
  next.type="button";
  next.className="call-btn";
  next.textContent="Continue";

  var save=document.getElementById("saveCallButton");
  var replacement=save.cloneNode(true);
  replacement.classList.add("call-save-finish");
  save.replaceWith(replacement);
  save=replacement;

  right.classList.add("call-wizard-actions");
  right.insertBefore(back,save);
  right.insertBefore(next,save);

  back.addEventListener("click",callWizardBack);
  next.addEventListener("click",callWizardNext);
  save.addEventListener("click",saveCallFromWizard);

  var follow=document.getElementById("ctFollowType");
  if(follow)follow.addEventListener("change",function(){
    if(this.value==="Callback"){
      document.getElementById("ctCallback").checked=true;
      if(document.getElementById("ctStatus").value==="Open")document.getElementById("ctStatus").value="Needs Callback";
    }else if(this.value==="Waiting on Client"){
      document.getElementById("ctStatus").value="Waiting on Client";
    }else if(this.value==="Waiting on Third Party"){
      document.getElementById("ctStatus").value="Waiting on Third Party";
    }
  });
}

function updateCallWizardReview(){
  var data=values();
  var rows=[
    ["File Number",data.fileNumber||"Not entered"],["Property Address",data.address||"Not entered"],
    ["Caller",data.caller||"Not entered"],["Company / Role",data.companyRole||"Not entered"],
    ["Callback Number",data.phone||"Not entered"],["Reason / Issue",data.issueType||"Not entered"],
    ["Call Notes",data.notes||"Not entered","wide"],["Commitment",data.promise||"None entered","wide"],
    ["Follow-Up",data.followUpType+(data.callbackRequired?" · Callback required":"")],
    ["Follow-Up Date",data.followUpDate?localDate(data.followUpDate):"No date"],
    ["Assigned To",data.assignedTo||"Dylan"],["Status",data.status||"Open"],
    ["Next Action",data.nextAction||"Not entered","wide"],["Final Outcome",data.finalOutcome||"Not entered","wide"]
  ];
  var box=document.getElementById("callWizardReview");
  if(box)box.innerHTML=rows.map(function(row){return'<div class="call-review-item '+(row[2]||"")+'"><span>'+esc(row[0])+'</span><strong>'+esc(row[1])+'</strong></div>';}).join("");
}

function renderCallWizard(){
  var total=7;
  if(callWizardStep<1)callWizardStep=1;
  if(callWizardStep>total)callWizardStep=total;

  document.querySelectorAll("#callEditorWrap .call-wizard-step").forEach(function(step){
    step.classList.toggle("active",Number(step.dataset.callStep)===callWizardStep);
  });

  var pct=Math.round(callWizardStep/total*100);
  document.getElementById("callWizardStepText").textContent="Step "+callWizardStep+" of "+total;
  document.getElementById("callWizardPercent").textContent=pct+"%";
  document.getElementById("callWizardBar").style.width=pct+"%";
  document.getElementById("callWizardBack").disabled=callWizardStep===1;
  document.getElementById("callWizardNext").style.display=callWizardStep===total?"none":"inline-block";
  document.getElementById("saveCallButton").style.display=callWizardStep===total?"inline-block":"none";

  var existing=!!editingId;
  document.getElementById("deleteCallButton").style.display=existing&&callWizardStep===total?"inline-block":"none";
  document.getElementById("printCallButton").style.display=existing&&callWizardStep===total?"inline-block":"none";
  document.getElementById("callHistorySection").style.display=existing&&callWizardStep===total?"block":"none";

  if(callWizardStep===total)updateCallWizardReview();

  setTimeout(function(){
    var active=document.querySelector("#callEditorWrap .call-wizard-step.active");
    var focusable=active&&active.querySelector('input:not([type="checkbox"]),select,textarea');
    if(focusable)focusable.focus();
  },35);
}

function callWizardNext(){
  if(callWizardStep<7){callWizardStep++;renderCallWizard();}
}

function callWizardBack(){
  if(callWizardStep>1){callWizardStep--;renderCallWizard();}
}

function saveCallFromWizard(){
  var data=values();
  if(!data.fileNumber&&!data.caller&&!data.notes){
    alert("Enter at least a file number, caller, or call note before saving.");
    callWizardStep=1;
    renderCallWizard();
    return;
  }
  callWizardSaveEditorBase();
  closeEditor();
}

openEditor=function(recordId){
  callWizardStep=1;
  callWizardOpenEditorBase(recordId);
  renderCallWizard();
};
/* CALL WIZARD END */

function boot(){if(installed||!ownerSignedIn())return;addStyles();if(!installToolboxEntry())return;installApp();load();render();installed=true;}
setInterval(boot,500);
setTimeout(boot,0);
})();
