(function(){
"use strict";

var OWNER_EMAIL="dylan.sprouse@unifiedtitle.net";
var STORAGE_KEY="utei.dylan.callTracker.v1";
var CONTACT_STORAGE_KEY="utei.dylan.callContacts.v1";
var installed=false;
var calls=[];
var contacts=[];
var currentFilter="all";
var editingId="";
var callWizardStep=1;
var callWizardEditMode=true;

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

/* CALL CONTACT MEMORY START */
function contactKey(value){return String(value||"").trim().toLowerCase().replace(/\s+/g," ");}
function phoneDigits(value){var digits=String(value||"").replace(/\D/g,"");if(digits.length===11&&digits.charAt(0)==="1")digits=digits.slice(1);return digits.slice(0,10);}
function formatPhone(value){
  var digits=phoneDigits(value);
  if(!digits)return "";
  if(digits.length<4)return "("+digits;
  if(digits.length<7)return "("+digits.slice(0,3)+") "+digits.slice(3);
  return "("+digits.slice(0,3)+") "+digits.slice(3,6)+"-"+digits.slice(6);
}
function persistContacts(){
  try{localStorage.setItem(CONTACT_STORAGE_KEY,JSON.stringify(contacts.slice(0,300)));}catch(error){}
}
function upsertContact(record,saveNow){
  var name=String(record&&record.caller||"").trim();
  if(!name)return;
  var key=contactKey(name);
  var existing=contacts.find(function(item){return contactKey(item.name)===key;});
  var stamp=record.updatedAt||record.createdAt||now();
  if(!existing){
    existing={name:name,companyRole:"",phone:"",lastUsedAt:stamp};
    contacts.push(existing);
  }
  existing.name=name;
  if(String(record.companyRole||"").trim())existing.companyRole=String(record.companyRole).trim();
  if(String(record.phone||"").trim())existing.phone=formatPhone(record.phone);
  existing.lastUsedAt=stamp;
  contacts.sort(function(a,b){return String(b.lastUsedAt||"").localeCompare(String(a.lastUsedAt||""));});
  if(saveNow){persistContacts();refreshCallerOptions();}
}
function loadContacts(){
  try{
    var saved=JSON.parse(localStorage.getItem(CONTACT_STORAGE_KEY)||"[]");
    contacts=Array.isArray(saved)?saved.filter(function(item){return item&&String(item.name||"").trim();}):[];
  }catch(error){contacts=[];}
  calls.forEach(function(record){upsertContact(record,false);});
  persistContacts();
  refreshCallerOptions();
}
function findContact(name){
  var key=contactKey(name);
  if(!key)return null;
  return contacts.find(function(item){return contactKey(item.name)===key;})||null;
}
function fillContact(contact){
  if(!contact)return;
  var caller=field("ctCaller"),company=field("ctCompany"),phone=field("ctPhone"),hint=field("callContactHint");
  if(caller)caller.value=contact.name||caller.value;
  if(company)company.value=contact.companyRole||"";
  if(phone)phone.value=formatPhone(contact.phone||"");
  if(hint){
    var details=[contact.companyRole,formatPhone(contact.phone)].filter(Boolean).join(" · ");
    hint.textContent=details?"Filled from a previous call: "+details:"Previous caller selected.";
  }
}
function refreshCallerOptions(){
  var list=field("ctCallerOptions"),quick=field("callContactQuickList");
  if(list){
    list.innerHTML=contacts.map(function(contact){
      var details=[contact.companyRole,formatPhone(contact.phone)].filter(Boolean).join(" · ");
      return '<option value="'+esc(contact.name)+'" label="'+esc(details)+'"></option>';
    }).join("");
  }
  if(quick){
    quick.innerHTML=contacts.slice(0,6).map(function(contact,index){
      return '<button type="button" class="call-contact-chip" data-contact-index="'+index+'"><strong>'+esc(contact.name)+'</strong><span>'+esc(contact.companyRole||formatPhone(contact.phone)||"Previous caller")+'</span></button>';
    }).join("");
    quick.querySelectorAll(".call-contact-chip").forEach(function(button){
      button.addEventListener("click",function(){fillContact(contacts[Number(button.dataset.contactIndex)]);});
    });
  }
}
function rememberContact(record){upsertContact(record,true);}
function installCallerMemory(){
  var caller=field("ctCaller"),company=field("ctCompany"),phone=field("ctPhone");
  if(!caller||!company||!phone||caller.dataset.contactMemoryInstalled==="1")return;
  caller.dataset.contactMemoryInstalled="1";
  caller.setAttribute("list","ctCallerOptions");
  caller.setAttribute("autocomplete","off");
  var list=document.createElement("datalist");
  list.id="ctCallerOptions";
  document.body.appendChild(list);
  var fieldBox=caller.closest(".call-field");
  if(fieldBox){
    var hint=document.createElement("div");
    hint.id="callContactHint";
    hint.className="call-contact-hint";
    hint.textContent="Choose a previous caller to fill their company/role and callback number.";
    var quick=document.createElement("div");
    quick.id="callContactQuickList";
    quick.className="call-contact-quick";
    fieldBox.appendChild(hint);
    fieldBox.appendChild(quick);
  }
  function applyExactCaller(){var contact=findContact(caller.value);if(contact)fillContact(contact);}
  caller.addEventListener("input",function(){if(findContact(caller.value))applyExactCaller();});
  caller.addEventListener("change",applyExactCaller);
  caller.addEventListener("blur",applyExactCaller);
  phone.addEventListener("input",function(){phone.value=formatPhone(phone.value);});
  phone.addEventListener("blur",function(){phone.value=formatPhone(phone.value);});
  refreshCallerOptions();
}
/* CALL CONTACT MEMORY END */

function load(){
  try{var data=JSON.parse(localStorage.getItem(STORAGE_KEY)||"[]");calls=Array.isArray(data)?data:[];}catch(e){calls=[];}
  calls.forEach(function(record){if(record.phone)record.phone=formatPhone(record.phone);});
  loadContacts();
}
function persist(){localStorage.setItem(STORAGE_KEY,JSON.stringify(calls));}
function sortCalls(list){return list.slice().sort(function(a,b){if(isCompleted(a)!==isCompleted(b))return isCompleted(a)?1:-1;var ad=a.followUpDate||"9999-12-31",bd=b.followUpDate||"9999-12-31";if(ad!==bd)return ad.localeCompare(bd);return String(b.updatedAt||"").localeCompare(String(a.updatedAt||""));});}
function ensureTodos(record){if(!record)return[];if(!Array.isArray(record.todos))record.todos=[];return record.todos;}
function todoSummary(record){var list=ensureTodos(record),open=list.filter(function(todo){return !todo.completed;}).length;return{total:list.length,open:open,label:open?open+" open":list.length?"All complete":"No items yet"};}

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
document.body.appendChild(app);document.getElementById("callBackToolbox").addEventListener("click",closeApp);document.getElementById("newCallButton").addEventListener("click",function(){openEditor();});document.getElementById("newCallButton2").addEventListener("click",function(){openEditor();});document.getElementById("callSearch").addEventListener("input",render);installModal();installCallWizard();installCallerMemory();buildTabs();}

function installModal(){var wrap=document.createElement("div");wrap.id="callEditorWrap";wrap.className="call-modal-wrap";wrap.innerHTML='<section class="call-modal" role="dialog" aria-modal="true" aria-labelledby="callEditorTitle"><header class="call-modal-head"><div><h2 id="callEditorTitle">New Call</h2><p id="callEditorSubtitle">Enter the essentials first, then set the follow-up.</p></div><button id="callEditorClose" class="call-close" type="button" aria-label="Close">×</button></header><div class="call-modal-body"><section class="call-section"><h3>Call essentials</h3><div class="call-grid"><div class="call-field"><label for="ctFile">File Number</label><input id="ctFile" placeholder="G26-0000"></div><div class="call-field span2"><label for="ctAddress">Property Address</label><input id="ctAddress"></div><div class="call-field"><label for="ctCaller">Caller Name</label><input id="ctCaller"></div><div class="call-field"><label for="ctCompany">Company / Role</label><input id="ctCompany" placeholder="Realtor, lender, client…"></div><div class="call-field"><label for="ctPhone">Callback Number</label><input id="ctPhone" type="tel"></div><div class="call-field span2"><label for="ctIssue">Reason / Issue Type</label><input id="ctIssue" list="ctIssueList" placeholder="Closing question, earnest money, document request…"><datalist id="ctIssueList"><option value="Closing Question"><option value="Earnest Money"><option value="Title Search"><option value="Document Request"><option value="Lender Question"><option value="Realtor Question"><option value="Client Question"><option value="Scheduling"><option value="Other"></datalist></div><div class="call-field full"><label for="ctNotes">Call Notes</label><textarea id="ctNotes" placeholder="What did the caller need and what was discussed?"></textarea></div><div class="call-field full"><label for="ctPromise">What I Promised / Commitment</label><input id="ctPromise" placeholder="Example: Call once Lynn confirms closing time"></div></div></section><section class="call-section"><h3>Follow-up</h3><div class="call-grid"><div class="call-field"><label for="ctFollowType">Follow-Up Type</label><select id="ctFollowType"><option>No Follow-Up</option><option>Callback</option><option>Internal Follow-Up</option><option>Check-In</option><option>Email</option><option>Document Needed</option><option>Waiting on Client</option><option>Waiting on Third Party</option></select></div><div class="call-field"><label for="ctAssigned">Assigned To</label><input id="ctAssigned" list="ctAssignedList" value="Dylan"><datalist id="ctAssignedList"><option value="Dylan"><option value="Lynn"><option value="Cindy"></datalist></div><div class="call-field"><label for="ctStatus">Status</label><select id="ctStatus"><option>Open</option><option>Needs Callback</option><option>In Progress</option><option>Waiting on Lynn</option><option>Waiting on Someone</option><option>Waiting on Client</option><option>Waiting on Third Party</option><option>Completed</option></select></div><div class="call-field"><label for="ctFollowDate">Callback / Check-In Date</label><input id="ctFollowDate" type="date"></div><div class="call-field span2"><label class="call-check"><input id="ctCallback" type="checkbox"> Callback required</label></div><div class="call-field full"><label for="ctNext">Next Action</label><input id="ctNext" placeholder="What needs to happen next?"></div><div class="call-field full"><label for="ctOutcome">Final Outcome</label><textarea id="ctOutcome" placeholder="Complete this when the item is resolved."></textarea></div></div></section><details id="callHistorySection" class="call-section call-history-accordion" style="display:none"><summary><span>Running Call History</span><strong id="callHistoryCount">0 updates</strong></summary><div class="call-history-accordion-body"><div id="callHistory" class="call-history"></div><div class="call-history-add"><input id="callHistoryText" placeholder="Add an update, callback result, email sent, document received…"><button id="addCallHistory" type="button" class="call-btn">Add Update</button></div></div></details><div class="call-note">Status and Next Action are separate so you can see both where the item stands and exactly what needs to happen next.</div></div><footer class="call-modal-actions"><div><button id="deleteCallButton" type="button" class="call-btn danger" style="display:none">Delete</button></div><div class="right"><button id="printCallButton" type="button" class="call-btn secondary" style="display:none">Print Call Sheet</button><button id="cancelCallButton" type="button" class="call-btn secondary">Cancel</button><button id="saveCallButton" type="button" class="call-btn">Save Call</button></div></footer></section>';
document.body.appendChild(wrap);document.getElementById("callEditorClose").addEventListener("click",closeEditor);document.getElementById("cancelCallButton").addEventListener("click",closeEditor);document.getElementById("saveCallButton").addEventListener("click",saveEditor);document.getElementById("deleteCallButton").addEventListener("click",deleteCurrent);document.getElementById("printCallButton").textContent="Print All Details";document.getElementById("printCallButton").addEventListener("click",function(){if(editingId)printRecord(editingId);});document.getElementById("addCallHistory").addEventListener("click",addHistory);document.getElementById("callHistoryText").addEventListener("keydown",function(e){if(e.key==="Enter"){e.preventDefault();addHistory();}});wrap.addEventListener("click",function(e){if(e.target===wrap)closeEditor();});}

var FILTERS=[["all","All Calls"],["callback","Needs Callback"],["waiting","Waiting on Someone"],["today","Due Today"],["upcoming","Upcoming"],["overdue","Overdue"],["complete","Completed"]];
function buildTabs(){var box=document.getElementById("callTabs");box.innerHTML=FILTERS.map(function(f){return'<button type="button" class="call-tab '+(f[0]===currentFilter?'active':'')+'" data-filter="'+f[0]+'">'+f[1]+'</button>';}).join("");box.querySelectorAll(".call-tab").forEach(function(btn){btn.addEventListener("click",function(){currentFilter=btn.dataset.filter;buildTabs();render();});});}
function matchesFilter(r){var diff=dayDiff(r.followUpDate);if(currentFilter==="callback")return needsCallback(r);if(currentFilter==="waiting")return !isCompleted(r)&&isWaiting(r);if(currentFilter==="today")return !isCompleted(r)&&diff===0;if(currentFilter==="upcoming")return !isCompleted(r)&&diff!==null&&diff>0;if(currentFilter==="overdue")return !isCompleted(r)&&diff!==null&&diff<0;if(currentFilter==="complete")return isCompleted(r);return true;}
function matchesSearch(r,q){if(!q)return true;return [r.fileNumber,r.address,r.caller,r.companyRole,r.phone,r.issueType,r.notes,r.promise,r.assignedTo,r.status,r.followUpType,r.nextAction,r.finalOutcome].join(" ").toLowerCase().indexOf(q)!==-1||(r.history||[]).some(function(h){return String(h.text||"").toLowerCase().indexOf(q)!==-1;})||ensureTodos(r).some(function(todo){return String(todo.text||"").toLowerCase().indexOf(q)!==-1;});}

function renderStats(){var open=calls.filter(function(r){return !isCompleted(r);});document.getElementById("callDueToday").textContent=open.filter(function(r){return dayDiff(r.followUpDate)===0;}).length;document.getElementById("callUpcoming").textContent=open.filter(function(r){var d=dayDiff(r.followUpDate);return d!==null&&d>0;}).length;document.getElementById("callOverdue").textContent=open.filter(function(r){var d=dayDiff(r.followUpDate);return d!==null&&d<0;}).length;document.getElementById("callWaiting").textContent=open.filter(isWaiting).length;}
function render(){if(!document.getElementById("callRows"))return;renderStats();var q=String(document.getElementById("callSearch").value||"").trim().toLowerCase();var rows=sortCalls(calls.filter(matchesFilter).filter(function(r){return matchesSearch(r,q);}));var body=document.getElementById("callRows"),empty=document.getElementById("callEmpty");body.innerHTML=rows.map(function(r){var cd=countdown(r),wait=isWaiting(r)?" waiting":"",complete=isCompleted(r)?" complete":"",todos=todoSummary(r);return'<tr data-id="'+esc(r.id)+'" tabindex="0" aria-label="Open full details for '+esc(r.fileNumber||r.caller||"call record")+'"><td><div class="call-main">'+esc(r.fileNumber||"—")+'</div></td><td><div>'+esc(r.address||"—")+'</div></td><td><div class="call-main">'+esc(r.caller||"—")+'</div><div class="call-muted">'+esc([r.companyRole,r.phone].filter(Boolean).join(" · "))+'</div></td><td>'+esc(r.issueType||"—")+'</td><td>'+esc(r.assignedTo||"—")+'</td><td><span class="call-pill'+wait+complete+'">'+esc(r.status||"Open")+'</span></td><td><div>'+esc(r.followUpType||"No Follow-Up")+'</div><div class="call-muted">'+(r.followUpDate?localDate(r.followUpDate):"No date")+'</div></td><td><span class="call-countdown '+cd.kind+'">'+esc(cd.label)+'</span></td><td>'+esc(localDateTime(r.updatedAt||r.createdAt))+'</td><td><div class="call-next-action">'+esc(r.nextAction||"—")+'</div><button type="button" class="call-view-todos" data-todo-id="'+esc(r.id)+'">View To-Do List <span>'+esc(todos.label)+'</span></button></td></tr>';}).join("");empty.style.display=rows.length?"none":"block";body.querySelectorAll("tr[data-id]").forEach(function(row){row.addEventListener("click",function(){openEditor(row.dataset.id);});row.addEventListener("keydown",function(event){if(event.key==="Enter"||event.key===" "){event.preventDefault();openEditor(row.dataset.id);}});});body.querySelectorAll(".call-view-todos").forEach(function(button){button.addEventListener("click",function(event){event.preventDefault();event.stopPropagation();openTodoList(button.dataset.todoId);});});}

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
function openEditor(recordId){editingId=recordId||"";clearForm();var record=calls.find(function(r){return r.id===editingId;});field("callEditorTitle").textContent=record?"Call / Follow-Up Record":"New Call";field("callEditorSubtitle").textContent=record?(record.fileNumber||"No file number")+" · "+(record.caller||"No caller entered"):"Enter the essentials first, then set the follow-up.";field("callHistorySection").style.display=record?"block":"none";field("callHistorySection").open=false;field("deleteCallButton").style.display=record?"inline-block":"none";field("printCallButton").style.display=record?"inline-block":"none";if(record){field("ctFile").value=record.fileNumber||"";field("ctAddress").value=record.address||"";field("ctCaller").value=record.caller||"";field("ctCompany").value=record.companyRole||"";field("ctPhone").value=record.phone||"";field("ctIssue").value=record.issueType||"";field("ctNotes").value=record.notes||"";field("ctPromise").value=record.promise||"";field("ctFollowType").value=record.followUpType||"No Follow-Up";field("ctAssigned").value=record.assignedTo||"Dylan";field("ctStatus").value=record.status||"Open";field("ctFollowDate").value=record.followUpDate||"";field("ctCallback").checked=!!record.callbackRequired;field("ctNext").value=record.nextAction||"";field("ctOutcome").value=record.finalOutcome||"";renderHistory(record);}field("callEditorWrap").classList.add("show");setTimeout(function(){field("ctFile").focus();},40);}
function closeEditor(){field("callEditorWrap").classList.remove("show");editingId="";}
function values(){return{fileNumber:field("ctFile").value.trim(),address:field("ctAddress").value.trim(),caller:field("ctCaller").value.trim(),companyRole:field("ctCompany").value.trim(),phone:formatPhone(field("ctPhone").value),issueType:field("ctIssue").value.trim(),notes:field("ctNotes").value.trim(),promise:field("ctPromise").value.trim(),followUpType:field("ctFollowType").value,assignedTo:field("ctAssigned").value.trim()||"Dylan",status:field("ctStatus").value,followUpDate:field("ctFollowDate").value,callbackRequired:field("ctCallback").checked,nextAction:field("ctNext").value.trim(),finalOutcome:field("ctOutcome").value.trim()};}
var LABELS={fileNumber:"file number",address:"address",caller:"caller",companyRole:"company / role",phone:"phone",issueType:"issue type",notes:"call notes",promise:"commitment",followUpType:"follow-up type",assignedTo:"assigned to",status:"status",followUpDate:"follow-up date",callbackRequired:"callback requirement",nextAction:"next action",finalOutcome:"final outcome"};
function saveEditor(){var data=values();if(!data.fileNumber&&!data.caller&&!data.notes){alert("Enter at least a file number, caller, or call note before saving.");return;}var stamp=now(),record=calls.find(function(r){return r.id===editingId;});if(!record){record=Object.assign({id:id(),createdAt:stamp,updatedAt:stamp,history:[]},data);record.history.push({id:id(),at:stamp,text:"Call record created"});calls.unshift(record);editingId=record.id;}else{var changed=[];Object.keys(data).forEach(function(k){if(String(record[k]||"")!==String(data[k]||""))changed.push(LABELS[k]||k);record[k]=data[k];});record.updatedAt=stamp;if(changed.length)record.history.push({id:id(),at:stamp,text:"Updated "+changed.join(", ")});}rememberContact(record);persist();render();renderHistory(record);field("callHistorySection").style.display="block";field("deleteCallButton").style.display="inline-block";field("printCallButton").style.display="inline-block";field("callEditorTitle").textContent="Call / Follow-Up Record";field("callEditorSubtitle").textContent=(record.fileNumber||"No file number")+" · "+(record.caller||"No caller entered");}
function renderHistory(record){var list=(record.history||[]).slice().sort(function(a,b){return String(b.at).localeCompare(String(a.at));});field("callHistory").innerHTML=list.length?list.map(function(h){return'<div class="call-history-item"><time>'+esc(localDateTime(h.at))+'</time><div>'+esc(h.text)+'</div></div>';}).join(""):'<div class="call-muted">No history yet.</div>';var count=field("callHistoryCount");if(count)count.textContent=list.length+" update"+(list.length===1?"":"s");}
function addHistory(){var record=calls.find(function(r){return r.id===editingId;}),text=field("callHistoryText").value.trim();if(!record||!text)return;var stamp=now();record.history=record.history||[];record.history.push({id:id(),at:stamp,text:text});record.updatedAt=stamp;field("callHistoryText").value="";persist();renderHistory(record);render();}
function deleteCurrent(){var record=calls.find(function(r){return r.id===editingId;});if(!record)return;if(!confirm("Delete this call record?"))return;calls=calls.filter(function(r){return r.id!==editingId;});persist();closeEditor();render();}

function currentRecord(){return calls.find(function(record){return record.id===editingId;});}
function recordTodoHistory(record,text){var stamp=now();record.history=record.history||[];record.history.push({id:id(),at:stamp,text:text});record.updatedAt=stamp;persist();renderHistory(record);render();renderTodos(record);}
function addTodo(){var record=currentRecord(),input=field("callTodoText");if(!record||!input)return;var text=String(input.value||"").trim();if(!text)return;ensureTodos(record).push({id:id(),text:text,completed:false,createdAt:now(),completedAt:""});input.value="";recordTodoHistory(record,'Added to-do: "'+text+'"');input.focus();}
function toggleTodo(todoId,completed){var record=currentRecord();if(!record)return;var todo=ensureTodos(record).find(function(item){return item.id===todoId;});if(!todo)return;todo.completed=!!completed;todo.completedAt=todo.completed?now():"";recordTodoHistory(record,(todo.completed?'Completed':'Reopened')+' to-do: "'+todo.text+'"');}
function editTodo(todoId){var record=currentRecord();if(!record)return;var todo=ensureTodos(record).find(function(item){return item.id===todoId;});if(!todo)return;var changed=prompt("Edit this to-do item:",todo.text);if(changed===null)return;changed=String(changed).trim();if(!changed)return;var old=todo.text;todo.text=changed;recordTodoHistory(record,'Edited to-do: "'+old+'" to "'+changed+'"');}
function deleteTodo(todoId){var record=currentRecord();if(!record)return;var todo=ensureTodos(record).find(function(item){return item.id===todoId;});if(!todo||!confirm('Delete this to-do item?\n\n'+todo.text))return;record.todos=ensureTodos(record).filter(function(item){return item.id!==todoId;});recordTodoHistory(record,'Deleted to-do: "'+todo.text+'"');}
function renderTodos(record){var list=field("callTodoList"),summary=field("callTodoSummary");if(!list||!summary)return;var todos=ensureTodos(record),counts=todoSummary(record);summary.textContent=counts.label;list.innerHTML=todos.length?todos.map(function(todo){return'<div class="call-todo-item'+(todo.completed?' complete':'')+'"><label><input type="checkbox" data-todo-check="'+esc(todo.id)+'" '+(todo.completed?'checked':'')+'><span>'+esc(todo.text)+'</span></label><div class="call-todo-actions"><button type="button" data-todo-edit="'+esc(todo.id)+'">Edit</button><button type="button" data-todo-delete="'+esc(todo.id)+'">Delete</button></div></div>';}).join(""):'<div class="call-todo-empty">No to-do items yet. Add the first step below.</div>';list.querySelectorAll("[data-todo-check]").forEach(function(box){box.addEventListener("change",function(){toggleTodo(box.dataset.todoCheck,box.checked);});});list.querySelectorAll("[data-todo-edit]").forEach(function(button){button.addEventListener("click",function(){editTodo(button.dataset.todoEdit);});});list.querySelectorAll("[data-todo-delete]").forEach(function(button){button.addEventListener("click",function(){deleteTodo(button.dataset.todoDelete);});});}
function openTodoList(recordId){openEditor(recordId);setTimeout(function(){var section=field("callTodosSection");if(section){section.scrollIntoView({behavior:"smooth",block:"center"});section.classList.add("call-todos-highlight");setTimeout(function(){section.classList.remove("call-todos-highlight");},1200);}var input=field("callTodoText");if(input)input.focus();},80);}

function printRecord(recordId){var r=calls.find(function(x){return x.id===recordId;});if(!r)return;var cd=countdown(r),todos=ensureTodos(r),history=(r.history||[]).slice().sort(function(a,b){return String(b.at).localeCompare(String(a.at));});var w=window.open("","utei-call-sheet","width=850,height=1000");if(!w){alert("Please allow pop-ups to print the call sheet.");return;}w.document.write('<!doctype html><html><head><meta charset="utf-8"><title>Call Details '+esc(r.fileNumber||"")+'</title><style>@page{size:letter;margin:.42in}*{box-sizing:border-box}body{font-family:Arial,sans-serif;color:#172033;margin:0;font-size:11px}.head{border-bottom:3px solid #17345e;padding-bottom:10px;margin-bottom:12px}.office{color:#9a6f0d;font-size:10px;font-weight:800;letter-spacing:.1em;text-transform:uppercase}.head h1{margin:4px 0 3px;color:#17345e;font-size:23px}.sub{color:#65738a}.grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}.box{border:1px solid #b9c6d5;border-radius:8px;padding:8px;min-height:48px;break-inside:avoid}.wide{grid-column:1/-1}.label{display:block;color:#607086;font-size:8px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;margin-bottom:4px}.value{font-size:11px;font-weight:700;white-space:pre-wrap;line-height:1.35}.section{margin-top:11px;break-inside:auto}.section h2{margin:0 0 6px;color:#17345e;font-size:12px}.history{border:1px solid #c5d0dc;border-radius:8px;overflow:hidden}.hist,.todo{display:grid;grid-template-columns:125px 1fr;gap:7px;padding:6px 8px;border-bottom:1px solid #e0e6ed;break-inside:avoid}.hist:last-child,.todo:last-child{border:0}.hist time,.todo strong{color:#68768a;font-size:9px}.todo.done div{text-decoration:line-through;color:#65738a}.footer{margin-top:10px;padding-top:7px;border-top:1px solid #ccd6e1;color:#748196;font-size:9px}@media print{button{display:none}}</style></head><body><div class="head"><div class="office">Unified Title &amp; Escrow</div><h1>Call / Follow-Up Details</h1><div class="sub">Printed '+esc(localDateTime(now()))+'</div></div><div class="grid"><div class="box"><span class="label">File Number</span><div class="value">'+esc(r.fileNumber||"—")+'</div></div><div class="box"><span class="label">Property Address</span><div class="value">'+esc(r.address||"—")+'</div></div><div class="box"><span class="label">Caller</span><div class="value">'+esc(r.caller||"—")+'</div></div><div class="box"><span class="label">Company / Role</span><div class="value">'+esc(r.companyRole||"—")+'</div></div><div class="box"><span class="label">Callback Number</span><div class="value">'+esc(r.phone||"—")+'</div></div><div class="box"><span class="label">Reason / Issue</span><div class="value">'+esc(r.issueType||"—")+'</div></div><div class="box wide"><span class="label">Call Notes</span><div class="value">'+esc(r.notes||"—")+'</div></div><div class="box wide"><span class="label">What I Promised / Commitment</span><div class="value">'+esc(r.promise||"—")+'</div></div><div class="box"><span class="label">Status</span><div class="value">'+esc(r.status||"Open")+'</div></div><div class="box"><span class="label">Assigned To</span><div class="value">'+esc(r.assignedTo||"—")+'</div></div><div class="box"><span class="label">Follow-Up Type</span><div class="value">'+esc(r.followUpType||"No Follow-Up")+(r.callbackRequired?" · Callback required":"")+'</div></div><div class="box"><span class="label">Callback / Check-In Date</span><div class="value">'+esc(r.followUpDate?localDate(r.followUpDate):"—")+' · '+esc(cd.label)+'</div></div><div class="box wide"><span class="label">Next Action</span><div class="value">'+esc(r.nextAction||"—")+'</div></div><div class="box wide"><span class="label">Final Outcome</span><div class="value">'+esc(r.finalOutcome||"—")+'</div></div><div class="box"><span class="label">Created</span><div class="value">'+esc(localDateTime(r.createdAt))+'</div></div><div class="box"><span class="label">Last Updated</span><div class="value">'+esc(localDateTime(r.updatedAt||r.createdAt))+'</div></div></div><div class="section"><h2>Case To-Do List</h2><div class="history">'+(todos.length?todos.map(function(todo){var todoDate=todo.completed?localDateTime(todo.completedAt):localDateTime(todo.createdAt);return'<div class="todo '+(todo.completed?'done':'')+'"><strong>'+(todo.completed?'Completed':'Open')+'<br>'+esc(todoDate)+'</strong><div>'+esc(todo.text)+'</div></div>';}).join(""):'<div class="todo"><div>No to-do items recorded.</div></div>')+'</div></div><div class="section"><h2>Complete Call History</h2><div class="history">'+(history.length?history.map(function(h){return'<div class="hist"><time>'+esc(localDateTime(h.at))+'</time><div>'+esc(h.text)+'</div></div>';}).join(""):'<div class="hist"><div>No history recorded.</div></div>')+'</div></div><div class="footer">Personal Call &amp; Follow-Up Tracker · Dylan</div><script>window.onload=function(){window.print();}<\/script></body></html>');w.document.close();}

/* Keep the transported print sheet aligned with the simplified call screen. */
printRecord=function(recordId){
  var r=calls.find(function(record){return record.id===recordId;});
  if(!r)return;
  var todos=ensureTodos(r);
  var history=(r.history||[]).slice().sort(function(a,b){return String(b.at).localeCompare(String(a.at));});
  var details=[
    ["File Number",r.fileNumber||"—"],["Property Address",r.address||"—"],
    ["Caller",r.caller||"—"],["Callback Number",r.phone||"—"],
    ["Why They Called",r.notes||"—","wide"],["What I Advised",r.promise||"—","wide"],
    ["Follow-Up",followChoiceLabel(r.followUpType)],["Follow-Up Date",r.followUpDate?localDate(r.followUpDate):"—"],
    ["Next Action",r.nextAction||r.promise||"—","wide"]
  ];
  var boxes=details.map(function(item){return'<div class="box '+(item[2]||"")+'"><span class="label">'+esc(item[0])+'</span><div class="value">'+esc(item[1])+'</div></div>';}).join("");
  var todoRows=todos.length?todos.map(function(todo){return'<div class="row todo '+(todo.completed?'done':'')+'"><strong>'+(todo.completed?'Completed':'Open')+'</strong><div>'+esc(todo.text)+'</div></div>';}).join(""):'<div class="empty">No to-do items recorded.</div>';
  var historyRows=history.length?history.map(function(item){return'<div class="row"><time>'+esc(localDateTime(item.at))+'</time><div>'+esc(item.text)+'</div></div>';}).join(""):'<div class="empty">No history recorded.</div>';
  var w=window.open("","utei-call-sheet","width=900,height=900");
  if(!w){alert("Please allow pop-ups to print the call details.");return;}
  w.document.write('<!doctype html><html><head><meta charset="utf-8"><title>Call Details '+esc(r.fileNumber||"")+'</title><style>@page{size:letter;margin:.45in}*{box-sizing:border-box}body{margin:0;font-family:Arial,sans-serif;color:#172033;font-size:10.5px}.head{display:flex;justify-content:space-between;align-items:flex-end;gap:20px;padding-bottom:10px;border-bottom:4px solid #17345e}.office{color:#9a6f0d;font-size:9px;font-weight:800;letter-spacing:.1em;text-transform:uppercase}.head h1{margin:3px 0 0;color:#17345e;font-size:22px}.printed{color:#65738a;font-size:9px}.grid{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin-top:11px}.box{padding:8px;border:1px solid #bdcada;border-radius:7px;break-inside:avoid}.box.wide{grid-column:1/-1;background:#f1f6fb}.label{display:block;margin-bottom:3px;color:#607086;font-size:7.5px;font-weight:800;letter-spacing:.06em;text-transform:uppercase}.value{font-weight:700;line-height:1.35;white-space:pre-wrap}.section{margin-top:12px;break-inside:auto}.section h2{margin:0 0 6px;color:#17345e;font-size:12px}.todo-section{padding:9px;border:1px solid #e2aaa6;border-radius:8px;background:#fff3f3}.rows{overflow:hidden;border:1px solid #c5d0dc;border-radius:7px;background:#fff}.row{display:grid;grid-template-columns:120px 1fr;gap:8px;padding:6px 8px;border-bottom:1px solid #e0e6ed;break-inside:avoid}.row:last-child{border:0}.row time,.row strong{color:#68768a;font-size:8.5px}.todo.done div{text-decoration:line-through;color:#65738a}.empty{padding:9px;color:#718096}.footer{margin-top:11px;padding-top:6px;border-top:1px solid #ccd6e1;color:#748196;font-size:8px}</style></head><body><header class="head"><div><div class="office">Unified Title &amp; Escrow</div><h1>Call Details</h1></div><div class="printed">Printed '+esc(localDateTime(now()))+'</div></header><main><div class="grid">'+boxes+'</div><section class="section todo-section"><h2>Case To-Do List</h2><div class="rows">'+todoRows+'</div></section><section class="section"><h2>Complete Call History</h2><div class="rows">'+historyRows+'</div></section></main><div class="footer">Personal Call &amp; Follow-Up Tracker · Dylan</div><script>window.onload=function(){setTimeout(function(){window.focus();window.print();},150);}<\/script></body></html>');
  w.document.close();
};


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

  var labelChanges={ctNotes:"Why were they calling?",ctPromise:"What did you advise?",ctFollowDate:"Follow-Up Date",ctNext:"Next Action (optional)"};
  Object.keys(labelChanges).forEach(function(fieldId){var input=document.getElementById(fieldId),label=input&&input.closest(".call-field")&&input.closest(".call-field").querySelector("label");if(label)label.textContent=labelChanges[fieldId];});

  var legacy=document.createElement("div");
  legacy.hidden=true;
  legacy.id="callLegacyFields";
  ["ctCompany","ctIssue","ctAssigned","ctStatus","ctOutcome","ctCallback","ctFollowType"].forEach(function(fieldId){var input=document.getElementById(fieldId),fieldBox=input&&input.closest(".call-field");if(fieldBox)legacy.appendChild(fieldBox);});
  body.insertBefore(legacy,note||history||null);

  var stepInfo=[
    ["What file is this call connected to?","Enter the file number and property address if they are available."],
    ["Who was calling?","Enter the caller's name and callback number."],
    ["What happened on the call?","Record why they called and what you advised."],
    ["Does anything need to happen next?","Choose a callback, a status check, or no follow-up. Both follow-up choices use the same date field."],
    ["Review and save the call","Check the important answers below before saving."]
  ];
  var fieldGroups=[
    ["ctFile","ctAddress"],
    ["ctCaller","ctPhone"],
    ["ctNotes","ctPromise"],
    ["ctFollowDate","ctNext"]
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
    if(index===2){var p=document.createElement("div");p.className="call-wizard-note";p.textContent="Keep this practical: what they needed, and exactly what you told them.";step.appendChild(p);}
    if(index===3){
      var choices=document.createElement("div");
      choices.className="call-follow-choice";
      choices.innerHTML='<button type="button" data-follow-choice="No Follow-Up">No Follow-Up</button><button type="button" data-follow-choice="Callback">Callback Needed</button><button type="button" data-follow-choice="Check-In">Check Up on Status</button>';
      step.insertBefore(choices,grid);
      var nextField=document.getElementById("ctNext")&&document.getElementById("ctNext").closest(".call-field");
      if(nextField){var helper=document.createElement("button");helper.id="useAdviceForNext";helper.type="button";helper.className="call-use-advice";helper.textContent="Use What I Advised";nextField.appendChild(helper);}
    }
    body.insertBefore(step,note||history||null);
  });

  var review=document.createElement("section");
  review.className="call-wizard-step";
  review.dataset.callStep="5";
  review.innerHTML='<h3 class="call-wizard-question">Call Details</h3><p class="call-wizard-help">The information needed to understand the call and follow through.</p><div id="callWizardReview" class="call-wizard-review"></div><section id="callTodosSection" class="call-todos-panel"><div class="call-todos-head"><div><span>Working list</span><h4>Case To-Do List</h4></div><strong id="callTodoSummary">No items yet</strong></div><div id="callTodoList" class="call-todo-list"></div><div class="call-todo-add"><input id="callTodoText" placeholder="Add the next task for this call…"><button id="addCallTodo" type="button" class="call-btn">+ Add To-Do</button></div></section>';
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
  document.getElementById("addCallTodo").addEventListener("click",addTodo);
  document.getElementById("callTodoText").addEventListener("keydown",function(event){if(event.key==="Enter"){event.preventDefault();addTodo();}});
  document.querySelectorAll("[data-follow-choice]").forEach(function(button){button.addEventListener("click",function(){setFollowChoice(button.dataset.followChoice);});});
  document.getElementById("useAdviceForNext").addEventListener("click",function(){var advice=document.getElementById("ctPromise").value.trim();if(advice){document.getElementById("ctNext").value=advice;document.getElementById("ctNext").focus();}});

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
    ["Caller",data.caller||"Not entered"],["Callback Number",data.phone||"Not entered"],
    ["Why They Called",data.notes||"Not entered","wide"],["What I Advised",data.promise||"Not entered","wide"],
    ["Follow-Up",followChoiceLabel(data.followUpType)],["Follow-Up Date",data.followUpDate?localDate(data.followUpDate):"No date"],
    ["Next Action",data.nextAction||data.promise||"Not entered","wide"]
  ];
  var box=document.getElementById("callWizardReview");
  if(box)box.innerHTML=rows.map(function(row){return'<div class="call-review-item '+(row[2]||"")+'"><span>'+esc(row[0])+'</span><strong>'+esc(row[1])+'</strong></div>';}).join("");
}

function followChoiceLabel(value){if(value==="Callback")return"Callback Needed";if(value==="No Follow-Up")return"No Follow-Up";return"Check Up on Status";}
function updateFollowChoice(){var follow=document.getElementById("ctFollowType"),value=follow&&follow.value||"No Follow-Up",dateLabel=document.querySelector('label[for="ctFollowDate"]');document.querySelectorAll("[data-follow-choice]").forEach(function(button){var selected=button.dataset.followChoice===(value==="Callback"?"Callback":value==="No Follow-Up"?"No Follow-Up":"Check-In");button.classList.toggle("active",selected);button.setAttribute("aria-pressed",selected?"true":"false");});if(dateLabel)dateLabel.textContent=value==="Callback"?"Callback Date":value==="No Follow-Up"?"Follow-Up Date (optional)":"Check-Up on Status Date";}
function setFollowChoice(value){document.getElementById("ctFollowType").value=value;document.getElementById("ctCallback").checked=value==="Callback";if(value==="Callback")document.getElementById("ctStatus").value="Needs Callback";else if(value==="Check-In")document.getElementById("ctStatus").value="In Progress";else document.getElementById("ctStatus").value="Open";updateFollowChoice();if(value!=="No Follow-Up")document.getElementById("ctFollowDate").focus();}

function renderCallWizard(){
  var total=5;
  if(callWizardStep<1)callWizardStep=1;
  if(callWizardStep>total)callWizardStep=total;

  document.querySelectorAll("#callEditorWrap .call-wizard-step").forEach(function(step){
    step.classList.toggle("active",Number(step.dataset.callStep)===callWizardStep);
  });

  var pct=Math.round(callWizardStep/total*100);
  document.getElementById("callWizardStepText").textContent="Step "+callWizardStep+" of "+total;
  document.getElementById("callWizardPercent").textContent=pct+"%";
  document.getElementById("callWizardBar").style.width=pct+"%";
  var viewing=!!editingId&&callWizardStep===total&&!callWizardEditMode;
  document.getElementById("callEditorWrap").classList.toggle("call-viewing-details",viewing);
  document.getElementById("callWizardProgress").style.display=viewing?"none":"block";
  document.getElementById("callWizardBack").disabled=callWizardStep===1&&!viewing;
  document.getElementById("callWizardBack").textContent=viewing?"Edit Details":"Back";
  document.getElementById("cancelCallButton").textContent=viewing?"Close":"Cancel";
  document.getElementById("callWizardNext").style.display=callWizardStep===total?"none":"inline-block";
  document.getElementById("saveCallButton").style.display=callWizardStep===total&&callWizardEditMode?"inline-block":"none";

  var existing=!!editingId;
  document.getElementById("deleteCallButton").style.display=existing&&callWizardStep===total&&callWizardEditMode?"inline-block":"none";
  document.getElementById("printCallButton").style.display=existing&&callWizardStep===total?"inline-block":"none";
  document.getElementById("callHistorySection").style.display=existing&&callWizardStep===total?"block":"none";

  if(callWizardStep===4)updateFollowChoice();
  if(callWizardStep===total){updateCallWizardReview();var record=currentRecord(),todosSection=document.getElementById("callTodosSection");if(todosSection)todosSection.style.display=record?"block":"none";if(record)renderTodos(record);}

  setTimeout(function(){
    var active=document.querySelector("#callEditorWrap .call-wizard-step.active");
    var focusable=active&&active.querySelector('input:not([type="checkbox"]),select,textarea');
    if(focusable)focusable.focus();
  },35);
}

function callWizardNext(){
  if(callWizardStep<5){callWizardStep++;renderCallWizard();}
}

function callWizardBack(){
  if(editingId&&callWizardStep===5&&!callWizardEditMode){callWizardEditMode=true;callWizardStep=1;renderCallWizard();return;}
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
  callWizardEditMode=!recordId;
  callWizardStep=recordId?5:1;
  callWizardOpenEditorBase(recordId);
  renderCallWizard();
};
/* CALL WIZARD END */

function boot(){if(installed||!ownerSignedIn())return;addStyles();if(!installToolboxEntry())return;installApp();load();render();installed=true;}
setInterval(boot,500);
setTimeout(boot,0);
})();

