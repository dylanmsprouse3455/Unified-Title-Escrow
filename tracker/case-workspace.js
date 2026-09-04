(function(){
"use strict";

var OWNER_EMAIL="dylan.sprouse@unifiedtitle.net";
var STORAGE_KEY="utei.dylan.callTracker.v1";
var WORKSPACE_SCHEMA=1;
var SUPABASE_URL="https://hdqmcjlpyjpfeltmxfax.supabase.co";
var SUPABASE_KEY="sb_publishable_lC2M8fZGmJQt6bWKgfiDnw_4Nx1TwHD";
var cloud=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY);

var records=[];
var caseRefs=[];
var currentView="tracked";
var currentCaseId="";
var editingContactId="";
var editingIdentifierId="";
var editingEventId="";
var toastTimer=0;

function el(id){return document.getElementById(id);}
function clean(value){return String(value==null?"":value).trim();}
function lower(value){return clean(value).toLowerCase();}
function esc(value){return String(value==null?"":value).replace(/[&<>"']/g,function(ch){return{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[ch];});}
function uid(prefix){return(prefix||"id")+"-"+(window.crypto&&crypto.randomUUID?crypto.randomUUID():Date.now()+"-"+Math.random().toString(36).slice(2));}
function now(){return new Date().toISOString();}
function today(){var d=new Date();return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");}
function dateOnly(value){if(!value)return today();var d=new Date(value);if(isNaN(d))return String(value).slice(0,10)||today();return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");}
function localDate(value){if(!value)return"No date";var d=new Date(String(value).length===10?value+"T12:00:00":value);return isNaN(d)?value:d.toLocaleDateString(undefined,{month:"short",day:"numeric",year:"numeric"});}
function localDateTime(value){if(!value)return"—";var d=new Date(value);return isNaN(d)?value:d.toLocaleString(undefined,{month:"short",day:"numeric",year:"numeric",hour:"numeric",minute:"2-digit"});}
function parseRecords(raw){try{var parsed=JSON.parse(raw||"[]");return Array.isArray(parsed)?parsed:[];}catch(_error){return[];}}
function loadRecords(){records=parseRecords(localStorage.getItem(STORAGE_KEY));}
function persistRecords(){localStorage.setItem(STORAGE_KEY,JSON.stringify(records));if(typeof window.__dylanCallCloudSyncNow==="function")setTimeout(function(){window.__dylanCallCloudSyncNow();},0);}
function clone(value){return JSON.parse(JSON.stringify(value));}

function showToast(message){clearTimeout(toastTimer);el("toastText").textContent=message;el("toast").classList.add("show");toastTimer=setTimeout(function(){el("toast").classList.remove("show");},3500);}

function recordId(record){if(!clean(record.id))record.id=uid("legacy");return record.id;}
function legacyGroupKey(record){
  var file=lower(record.fileNumber);if(file)return"file:"+file;
  var address=lower(record.address).replace(/\s+/g," ");if(address)return"address:"+address;
  return"record:"+recordId(record);
}
function legacyStatus(record){return clean(record.status||record.followStatus||"");}
function legacyTracked(record){var follow=typeof record.followUp==="boolean"?record.followUp:!!(record.followUpType&&record.followUpType!=="No Follow-Up");return follow&&legacyStatus(record)!=="Completed";}
function legacyContactKey(record){return[lower(record.caller),lower(record.phone),lower(record.companyRole)].join("|");}
function hasLegacyCallContent(record){return !![
  record.caller,record.phone,record.companyRole,record.direction,record.outcome,record.result,
  record.subject,record.reason,record.issueType,record.results,record.outcomeNotes,record.notes,
  record.advised,record.promise,record.followType,record.followUpType,record.status,record.waitingOn
].some(function(value){return clean(value);});}
function legacyNote(record){
  var rows=[];
  var subject=clean(record.subject||record.reason||record.issueType);
  var results=clean(record.results||record.outcomeNotes||record.notes);
  var advised=clean(record.advised||record.promise);
  var outcome=clean(record.outcome||record.result);
  if(subject)rows.push("Subject: "+subject);
  if(results)rows.push("Results: "+results);
  if(advised)rows.push("Told / promised: "+advised);
  if(outcome)rows.push("Outcome: "+outcome);
  if(!rows.length&&clean(record.caller))rows.push("Interaction with "+clean(record.caller)+".");
  if(!rows.length)rows.push("Legacy call/follow-up record retained from the previous tracker.");
  return rows.join("\n");
}
function legacySnapshot(record){
  return{
    direction:record.direction||"",caller:record.caller||"",phone:record.phone||"",companyRole:record.companyRole||"",
    fileNumber:record.fileNumber||"",address:record.address||"",subject:record.subject||record.reason||record.issueType||"",
    outcome:record.outcome||record.result||"",results:record.results||record.outcomeNotes||record.notes||"",advised:record.advised||record.promise||"",
    followUp:record.followUp,followType:record.followType||record.followUpType||record.category||"",status:record.status||record.followStatus||"",
    owner:record.owner||record.assignedTo||"",waitingOn:record.waitingOn||"",dueDate:record.dueDate||record.followUpDate||"",
    task:record.task||record.nextAction||"",callbackRequired:!!record.callbackRequired,
    createdAt:record.createdAt||"",updatedAt:record.updatedAt||"",completedAt:record.completedAt||"",
    history:Array.isArray(record.history)?clone(record.history):[]
  };
}
function createWorkspace(group){
  var stamp=now();
  var firstFile=group.map(function(r){return clean(r.fileNumber);}).find(Boolean)||"";
  var firstAddress=group.map(function(r){return clean(r.address);}).find(Boolean)||"";
  return{
    schemaVersion:WORKSPACE_SCHEMA,id:uid("case"),fileNumber:firstFile,address:firstAddress,
    tracked:group.some(legacyTracked),identifiers:[],contacts:[],events:[],todos:[],audit:[],sourceRecordIds:[],
    createdAt:group.map(function(r){return r.createdAt||r.updatedAt||stamp;}).sort()[0]||stamp,
    updatedAt:group.map(function(r){return r.updatedAt||r.createdAt||stamp;}).sort().pop()||stamp,
    migratedAt:stamp
  };
}
function ensureWorkspaceArrays(ws){
  ["identifiers","contacts","events","todos","audit","sourceRecordIds"].forEach(function(key){if(!Array.isArray(ws[key]))ws[key]=[];});
  ws.schemaVersion=WORKSPACE_SCHEMA;if(typeof ws.tracked!=="boolean")ws.tracked=false;if(!ws.id)ws.id=uid("case");
}
function ensureLegacyContact(ws,record){
  var name=clean(record.caller),phone=clean(record.phone),role=clean(record.companyRole);
  if(!name&&!phone&&!role)return"";
  var key=[lower(name),lower(phone),lower(role)].join("|");
  var existing=ws.contacts.find(function(contact){return[lower(contact.name),lower(contact.phone),lower(contact.role)].join("|")===key;});
  if(existing)return existing.id;
  var contact={id:uid("contact"),name:name||"Unknown contact",phone:phone,role:role,createdAt:record.createdAt||now(),updatedAt:record.updatedAt||record.createdAt||now(),source:"legacy"};
  ws.contacts.push(contact);return contact.id;
}
function migrateRecordIntoWorkspace(ws,record){
  var id=recordId(record);if(ws.sourceRecordIds.indexOf(id)!==-1)return false;
  var changed=false,contactId=ensureLegacyContact(ws,record);if(contactId)changed=true;
  if(hasLegacyCallContent(record)||!record.workspaceOnly){
    ws.events.push({id:uid("event"),eventDate:dateOnly(record.createdAt||record.updatedAt||now()),contactId:contactId,note:legacyNote(record),createdAt:record.createdAt||record.updatedAt||now(),updatedAt:record.updatedAt||record.createdAt||now(),sourceRecordId:id,legacy:legacySnapshot(record)});changed=true;
  }
  var todos=Array.isArray(record.todos)?record.todos:[];
  todos.forEach(function(todo){
    var text=clean(todo&&todo.text);if(!text)return;
    ws.todos.push({id:uid("todo"),text:text,completed:typeof todo.completed==="boolean"?todo.completed:!!todo.done,createdAt:todo.createdAt||record.createdAt||now(),completedAt:(typeof todo.completed==="boolean"?todo.completed:!!todo.done)?(todo.completedAt||record.updatedAt||""):"",sourceRecordId:id,sourceTodoId:todo.id||""});changed=true;
  });
  if(!todos.length){
    var legacyTask=clean(record.task||record.nextAction);
    if(legacyTask){ws.todos.push({id:uid("todo"),text:legacyTask,completed:false,createdAt:record.createdAt||now(),completedAt:"",sourceRecordId:id,sourceTodoId:"legacy-next-action"});changed=true;}
  }
  ws.sourceRecordIds.push(id);return true;
}
function migrateWorkspace(){
  var changed=false;
  records.forEach(function(record){
    if(!record||typeof record!=="object")return;
    if(!record.id){record.id=uid("legacy");changed=true;}
    if(!record.createdAt){record.createdAt=record.updatedAt||now();changed=true;}
    if(!record.updatedAt){record.updatedAt=record.createdAt;changed=true;}
    if(record.workspaceCase){ensureWorkspaceArrays(record.workspaceCase);}
  });

  var groups=new Map();
  records.forEach(function(record){
    if(record.workspaceOnly&&record.workspaceCase)return;
    var key=legacyGroupKey(record);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(record);
  });
  groups.forEach(function(group){
    var anchor=group.find(function(r){return r.workspaceCase&&typeof r.workspaceCase==="object";})||group[0];
    if(!anchor.workspaceCase){anchor.workspaceCase=createWorkspace(group);changed=true;}
    var ws=anchor.workspaceCase;ensureWorkspaceArrays(ws);
    if(!clean(ws.fileNumber))ws.fileNumber=group.map(function(r){return clean(r.fileNumber);}).find(Boolean)||"";
    if(!clean(ws.address))ws.address=group.map(function(r){return clean(r.address);}).find(Boolean)||"";
    if(!ws.sourceRecordIds.length&&group.some(legacyTracked))ws.tracked=true;
    group.forEach(function(record){if(migrateRecordIntoWorkspace(ws,record))changed=true;});
  });

  records.forEach(function(record){
    if(record.workspaceOnly&&record.workspaceCase){ensureWorkspaceArrays(record.workspaceCase);if(record.workspaceCase.sourceRecordIds.indexOf(record.id)===-1)record.workspaceCase.sourceRecordIds.push(record.id);}
  });
  if(changed)persistRecords();
  buildCaseRefs();
}
function buildCaseRefs(){caseRefs=records.filter(function(record){return record&&record.workspaceCase&&typeof record.workspaceCase==="object";}).map(function(anchor){return{anchor:anchor,ws:anchor.workspaceCase};});}
function findCase(caseId){return caseRefs.find(function(ref){return ref.ws.id===caseId;});}
function sourceRecords(ref){var ids=new Set(ref.ws.sourceRecordIds||[]);return records.filter(function(record){return ids.has(record.id);});}
function addAudit(ref,text){ref.ws.audit.push({id:uid("audit"),at:now(),text:text});if(ref.ws.audit.length>500)ref.ws.audit=ref.ws.audit.slice(-500);}
function touch(ref,text){var stamp=now();ref.ws.updatedAt=stamp;ref.anchor.updatedAt=stamp;if(text)addAudit(ref,text);persistRecords();buildCaseRefs();}

function openTodoCount(ref){return(ref.ws.todos||[]).filter(function(todo){return !todo.completed;}).length;}
function firstOpenTodo(ref){var item=(ref.ws.todos||[]).find(function(todo){return !todo.completed;});return item?item.text:"";}
function lastEvent(ref){return(ref.ws.events||[]).slice().sort(function(a,b){return String(b.eventDate||"").localeCompare(String(a.eventDate||""))||String(b.createdAt||"").localeCompare(String(a.createdAt||""));})[0]||null;}
function lastContactFor(ref,contactId){return(ref.ws.events||[]).filter(function(event){return event.contactId===contactId;}).sort(function(a,b){return String(b.eventDate||"").localeCompare(String(a.eventDate||""))||String(b.createdAt||"").localeCompare(String(a.createdAt||""));})[0]||null;}
function caseSearchText(ref){
  var ws=ref.ws;
  var parts=[ws.fileNumber,ws.address].concat((ws.identifiers||[]).map(function(x){return(x.label||"")+" "+(x.value||"");}),(ws.contacts||[]).map(function(x){return(x.name||"")+" "+(x.phone||"")+" "+(x.role||"");}),(ws.todos||[]).map(function(x){return x.text||"";}),(ws.events||[]).map(function(x){return(x.note||"")+" "+JSON.stringify(x.legacy||{});}));
  sourceRecords(ref).forEach(function(record){parts.push(JSON.stringify(record));});
  return parts.join(" ").toLowerCase();
}
function visibleCases(){
  var query=lower(el("caseSearch").value),list=caseRefs.slice();
  if(query)list=list.filter(function(ref){return caseSearchText(ref).indexOf(query)!==-1;});
  else if(currentView==="tracked")list=list.filter(function(ref){return !!ref.ws.tracked;});
  else if(currentView==="history")list=list.filter(function(ref){return !ref.ws.tracked;});
  return list.sort(function(a,b){
    if(a.ws.tracked!==b.ws.tracked)return a.ws.tracked?-1:1;
    var aOpen=openTodoCount(a),bOpen=openTodoCount(b);if(aOpen!==bOpen)return bOpen-aOpen;
    return String(b.ws.updatedAt||"").localeCompare(String(a.ws.updatedAt||""));
  });
}
function heading(){
  if(clean(el("caseSearch").value))return["Search Results","Searches file numbers, addresses, last-four identifiers, people, notes, old call details, and to-dos."];
  if(currentView==="all")return["All Files","Every case in your personal workspace, whether you are actively tracking it or not."];
  if(currentView==="history")return["Not Tracking","Files kept for history and search but removed from your active main page."];
  return["Tracked Files","The files you currently want kept on your main page."];
}
function renderStats(){
  var tracked=caseRefs.filter(function(ref){return ref.ws.tracked;});
  var open=tracked.reduce(function(total,ref){return total+openTodoCount(ref);},0);
  var updated=caseRefs.filter(function(ref){return dateOnly(ref.ws.updatedAt)===today();}).length;
  el("statTracked").textContent=tracked.length;el("statTodos").textContent=open;el("statUpdated").textContent=updated;el("statAll").textContent=caseRefs.length;
}
function caseCardHtml(ref){
  var ws=ref.ws,last=lastEvent(ref),open=openTodoCount(ref),next=firstOpenTodo(ref)||"No open to-do items";
  var identifiers=(ws.identifiers||[]).slice(0,2).map(function(item){return esc(item.label+": "+item.value);}).join(" · ");
  return'<article class="case-card '+(ws.tracked?'tracked':'')+'">'+
    '<header class="case-card-head"><div class="case-card-title"><span>File</span><strong>'+esc(ws.fileNumber||"No file number")+'</strong></div><label class="track-toggle '+(ws.tracked?'on':'')+'"><input type="checkbox" data-track-card="'+esc(ws.id)+'" '+(ws.tracked?'checked':'')+'> '+(ws.tracked?'Tracking':'Not tracking')+'</label></header>'+
    '<div class="case-card-address">'+esc(ws.address||"No property address")+'</div>'+
    '<div class="case-card-body">'+
      '<div class="case-card-field"><span class="micro-label">People</span><strong>'+esc((ws.contacts||[]).length+' connected')+'</strong><small>'+(last&&last.contactId?esc(contactName(ws,last.contactId)):"No recent contact")+'</small></div>'+
      '<div class="case-card-field"><span class="micro-label">Open To-Dos</span><strong>'+open+'</strong><small>'+esc(open?"Needs attention":"Nothing open")+'</small></div>'+
      '<div class="case-card-field"><span class="micro-label">Last Note</span><strong>'+esc(last?localDate(last.eventDate):"No notes yet")+'</strong><small>'+esc(last?truncate(last.note,62):"Add the first file note")+'</small></div>'+
      '<div class="case-card-field"><span class="micro-label">Identifiers</span><strong>'+esc((ws.identifiers||[]).length?"Searchable":"None added")+'</strong><small>'+esc(identifiers||"Add account last four, reference number, etc.")+'</small></div>'+
    '</div>'+
    '<div class="case-next"><span class="micro-label">Next Action</span><p>'+esc(next)+'</p><small>Updated '+esc(localDateTime(ws.updatedAt))+'</small></div>'+
    '<footer class="case-card-actions"><button class="primary" data-open-case="'+esc(ws.id)+'">Open File</button><button class="quick" data-quick-note="'+esc(ws.id)+'">+ Note</button><button data-quick-todo="'+esc(ws.id)+'">+ To-Do</button></footer></article>';
}
function truncate(value,length){value=clean(value).replace(/\s+/g," ");return value.length>length?value.slice(0,length-1)+"…":value;}
function contactName(ws,id){var c=(ws.contacts||[]).find(function(item){return item.id===id;});return c?c.name:"Internal / general";}
function render(){
  renderStats();
  document.querySelectorAll("#viewTabs [data-view]").forEach(function(button){button.classList.toggle("active",button.dataset.view===currentView&&!clean(el("caseSearch").value));});
  var copy=heading(),list=visibleCases();el("viewTitle").textContent=copy[0];el("viewDescription").textContent=copy[1];el("resultCount").textContent=list.length+" file"+(list.length===1?"":"s");
  el("recordGrid").innerHTML=list.map(caseCardHtml).join("");el("emptyState").classList.toggle("hidden",!!list.length);el("emptyState").textContent=clean(el("caseSearch").value)?"No files match that search.":"Nothing is in this view yet.";
  bindCards();
}
function bindCards(){
  document.querySelectorAll("[data-open-case]").forEach(function(button){button.onclick=function(){openCase(button.dataset.openCase);};});
  document.querySelectorAll("[data-quick-note]").forEach(function(button){button.onclick=function(){openCase(button.dataset.quickNote,"note");};});
  document.querySelectorAll("[data-quick-todo]").forEach(function(button){button.onclick=function(){openCase(button.dataset.quickTodo,"todo");};});
  document.querySelectorAll("[data-track-card]").forEach(function(input){input.onchange=function(){setTracked(input.dataset.trackCard,input.checked);};});
}
function setTracked(caseId,value){var ref=findCase(caseId);if(!ref)return;ref.ws.tracked=!!value;touch(ref,value?"File added to active tracking":"File removed from active tracking");render();if(currentCaseId===caseId)renderCase(ref);showToast(value?"File is now tracked on your main page.":"File kept in history and removed from your main page.");}

function renderCase(ref){
  var ws=ref.ws;el("caseModalTitle").textContent=ws.fileNumber||"File Workspace";el("caseModalSubtitle").textContent=ws.address||"People, notes, identifiers, and to-dos";
  el("caseFileNumber").value=ws.fileNumber||"";el("caseAddress").value=ws.address||"";el("caseTracking").checked=!!ws.tracked;el("caseTrackingLabel").textContent=ws.tracked?"Tracking this file":"Not tracking this file";el("caseTrackingWrap").classList.toggle("on",!!ws.tracked);
  renderIdentifiers(ref);renderContacts(ref);renderTodos(ref);renderContactOptions(ref);renderTimeline(ref);
}
function openCase(caseId,focus){
  buildCaseRefs();var ref=findCase(caseId);if(!ref)return;currentCaseId=caseId;resetEditors();renderCase(ref);el("caseModal").classList.add("show");
  if(focus==="note")setTimeout(function(){el("eventNote").focus();},30);
  else if(focus==="todo")setTimeout(function(){el("newCaseTodo").focus();},30);
}
function closeCase(){el("caseModal").classList.remove("show");currentCaseId="";resetEditors();}
function currentRef(){return findCase(currentCaseId);}
function resetEditors(){
  editingContactId="";editingIdentifierId="";editingEventId="";
  if(el("contactEditor"))el("contactEditor").classList.add("hidden");if(el("identifierEditor"))el("identifierEditor").classList.add("hidden");
  if(el("contactName"))el("contactName").value="";if(el("contactPhone"))el("contactPhone").value="";if(el("contactRole"))el("contactRole").value="";
  if(el("identifierLabel"))el("identifierLabel").value="";if(el("identifierValue"))el("identifierValue").value="";
  if(el("eventDate"))el("eventDate").value=today();if(el("eventContact"))el("eventContact").value="";if(el("eventNote"))el("eventNote").value="";
  if(el("eventEditingBanner"))el("eventEditingBanner").classList.add("hidden");if(el("cancelEventEdit"))el("cancelEventEdit").classList.add("hidden");if(el("saveEvent"))el("saveEvent").textContent="Add Note";
}
function saveCaseDetails(){
  var ref=currentRef();if(!ref)return;var file=clean(el("caseFileNumber").value),address=clean(el("caseAddress").value);if(!file&&!address){alert("Enter a file number or property address.");return;}
  var changes=[];if(file!==clean(ref.ws.fileNumber)){changes.push("file number");ref.ws.fileNumber=file;ref.anchor.fileNumber=file;}if(address!==clean(ref.ws.address)){changes.push("property address");ref.ws.address=address;ref.anchor.address=address;}
  if(changes.length){touch(ref,"Updated "+changes.join(" and "));buildCaseRefs();render();renderCase(findCase(currentCaseId));showToast("File details saved.");}else showToast("No file detail changes to save.");
}

function renderIdentifiers(ref){
  var list=ref.ws.identifiers||[];el("identifierList").innerHTML=list.length?list.map(function(item){return'<div class="identifier-row"><div><strong>'+esc(item.label||"Identifier")+'</strong><small>'+esc(item.value||"")+'</small></div><div class="row-actions"><button data-edit-identifier="'+esc(item.id)+'">Edit</button><button class="danger-link" data-remove-identifier="'+esc(item.id)+'">Remove</button></div></div>';}).join(""):'<div class="empty-inline">No extra identifiers yet. Add the last four of an account, payoff number, loan/reference number, or anything else you might be handed.</div>';
  document.querySelectorAll("[data-edit-identifier]").forEach(function(button){button.onclick=function(){editIdentifier(button.dataset.editIdentifier);};});
  document.querySelectorAll("[data-remove-identifier]").forEach(function(button){button.onclick=function(){removeIdentifier(button.dataset.removeIdentifier);};});
}
function startIdentifier(){editingIdentifierId="";el("identifierLabel").value="Account Last Four";el("identifierValue").value="";el("identifierEditor").classList.remove("hidden");el("identifierValue").focus();}
function editIdentifier(id){var ref=currentRef(),item=ref&&ref.ws.identifiers.find(function(x){return x.id===id;});if(!item)return;editingIdentifierId=id;el("identifierLabel").value=item.label;el("identifierValue").value=item.value;el("identifierEditor").classList.remove("hidden");el("identifierValue").focus();}
function saveIdentifier(){
  var ref=currentRef();if(!ref)return;var label=clean(el("identifierLabel").value)||"Identifier",value=clean(el("identifierValue").value);if(!value){alert("Enter the identifier value.");return;}
  var item=editingIdentifierId?ref.ws.identifiers.find(function(x){return x.id===editingIdentifierId;}):null;
  if(item){var old=item.label+": "+item.value;item.label=label;item.value=value;item.updatedAt=now();touch(ref,"Updated identifier from "+old+" to "+label+": "+value);}else{ref.ws.identifiers.push({id:uid("identifier"),label:label,value:value,createdAt:now(),updatedAt:now()});touch(ref,"Added identifier "+label+": "+value);}
  editingIdentifierId="";el("identifierEditor").classList.add("hidden");renderIdentifiers(ref);render();showToast("Identifier saved and searchable.");
}
function removeIdentifier(id){var ref=currentRef(),index=ref&&ref.ws.identifiers.findIndex(function(x){return x.id===id;});if(index==null||index<0)return;var item=ref.ws.identifiers[index];if(!confirm("Remove "+item.label+": "+item.value+"? The change will remain in the activity audit."))return;ref.ws.identifiers.splice(index,1);touch(ref,"Removed identifier "+item.label+": "+item.value);renderIdentifiers(ref);render();}

function renderContacts(ref){
  var list=ref.ws.contacts||[];el("contactList").innerHTML=list.length?list.map(function(contact){var last=lastContactFor(ref,contact.id);return'<article class="contact-card"><div class="contact-card-head"><div><strong>'+esc(contact.name||"Unnamed contact")+'</strong><div class="contact-meta">'+esc([contact.role,contact.phone].filter(Boolean).join(" · ")||"No phone or relationship entered")+'</div><div class="last-contact">'+esc(last?"Last interaction: "+localDate(last.eventDate):"No interaction date yet")+'</div></div><div class="row-actions"><button data-log-contact="'+esc(contact.id)+'">Log Interaction</button><button data-edit-contact="'+esc(contact.id)+'">Edit</button></div></div></article>';}).join(""):'<div class="empty-inline">No people are attached to this file yet. Add sellers, buyers, agents, lenders, payoff companies, or anyone else you deal with.</div>';
  document.querySelectorAll("[data-log-contact]").forEach(function(button){button.onclick=function(){el("eventContact").value=button.dataset.logContact;el("eventDate").value=today();el("eventNote").focus();};});
  document.querySelectorAll("[data-edit-contact]").forEach(function(button){button.onclick=function(){editContact(button.dataset.editContact);};});
}
function startContact(){editingContactId="";el("contactName").value="";el("contactPhone").value="";el("contactRole").value="";el("contactEditor").classList.remove("hidden");el("contactName").focus();}
function editContact(id){var ref=currentRef(),contact=ref&&ref.ws.contacts.find(function(x){return x.id===id;});if(!contact)return;editingContactId=id;el("contactName").value=contact.name;el("contactPhone").value=contact.phone;el("contactRole").value=contact.role;el("contactEditor").classList.remove("hidden");el("contactName").focus();}
function saveContact(){
  var ref=currentRef();if(!ref)return;var name=clean(el("contactName").value),phone=clean(el("contactPhone").value),role=clean(el("contactRole").value);if(!name&&!phone&&!role){alert("Enter at least a name, phone number, or relationship.");return;}
  var contact=editingContactId?ref.ws.contacts.find(function(x){return x.id===editingContactId;}):null;
  if(!contact){
    var same=ref.ws.contacts.find(function(x){return lower(x.name)===lower(name)&&name;});
    if(same&&confirm("A contact named "+same.name+" is already attached to this file. Update that contact instead of creating another one?"))contact=same;
  }
  if(contact){var oldName=contact.name;contact.name=name||contact.name||"Unknown contact";contact.phone=phone;contact.role=role;contact.updatedAt=now();touch(ref,"Updated contact "+(oldName||contact.name));}
  else{contact={id:uid("contact"),name:name||"Unknown contact",phone:phone,role:role,createdAt:now(),updatedAt:now(),source:"workspace"};ref.ws.contacts.push(contact);touch(ref,"Added contact "+contact.name);}
  editingContactId="";el("contactEditor").classList.add("hidden");renderContacts(ref);renderContactOptions(ref);renderTimeline(ref);render();showToast("Contact saved.");
}
function renderContactOptions(ref){
  var current=el("eventContact").value;el("eventContact").innerHTML='<option value="">Internal / General File Note</option>'+ref.ws.contacts.map(function(c){return'<option value="'+esc(c.id)+'">'+esc(c.name+(c.role?" — "+c.role:""))+'</option>';}).join("");if(ref.ws.contacts.some(function(c){return c.id===current;}))el("eventContact").value=current;
}

function renderTodos(ref){
  var list=ref.ws.todos||[],open=list.filter(function(todo){return !todo.completed;}).length;el("todoSummary").textContent=open+" open";
  el("caseTodoList").innerHTML=list.length?list.map(function(todo){return'<div class="case-todo-item '+(todo.completed?'complete':'')+'"><label><input type="checkbox" data-toggle-todo="'+esc(todo.id)+'" '+(todo.completed?'checked':'')+'><span>'+esc(todo.text)+'<small>'+esc(todo.completed?(todo.completedAt?"Completed "+localDate(todo.completedAt):"Completed"):(todo.sourceRecordId?"Carried forward from the previous tracker":"Open item"))+'</small></span></label><div class="row-actions"><button data-edit-todo="'+esc(todo.id)+'">Edit</button><button class="danger-link" data-remove-todo="'+esc(todo.id)+'">Remove</button></div></div>';}).join(""):'<div class="empty-inline">No to-do items yet.</div>';
  document.querySelectorAll("[data-toggle-todo]").forEach(function(input){input.onchange=function(){toggleTodo(input.dataset.toggleTodo,input.checked);};});
  document.querySelectorAll("[data-edit-todo]").forEach(function(button){button.onclick=function(){editTodo(button.dataset.editTodo);};});
  document.querySelectorAll("[data-remove-todo]").forEach(function(button){button.onclick=function(){removeTodo(button.dataset.removeTodo);};});
}
function addTodo(){var ref=currentRef(),text=clean(el("newCaseTodo").value);if(!ref||!text)return;ref.ws.todos.push({id:uid("todo"),text:text,completed:false,createdAt:now(),completedAt:"",sourceRecordId:"",sourceTodoId:""});el("newCaseTodo").value="";touch(ref,'Added to-do: "'+text+'"');renderTodos(ref);render();el("newCaseTodo").focus();}
function toggleTodo(id,completed){var ref=currentRef(),todo=ref&&ref.ws.todos.find(function(x){return x.id===id;});if(!todo)return;todo.completed=!!completed;todo.completedAt=completed?now():"";touch(ref,(completed?'Completed':'Reopened')+' to-do: "'+todo.text+'"');renderTodos(ref);render();}
function editTodo(id){var ref=currentRef(),todo=ref&&ref.ws.todos.find(function(x){return x.id===id;});if(!todo)return;var value=prompt("Edit this to-do:",todo.text);if(value===null)return;value=clean(value);if(!value)return;var old=todo.text;todo.text=value;touch(ref,'Edited to-do from "'+old+'" to "'+value+'"');renderTodos(ref);render();}
function removeTodo(id){var ref=currentRef(),index=ref&&ref.ws.todos.findIndex(function(x){return x.id===id;});if(index==null||index<0)return;var todo=ref.ws.todos[index];if(!confirm("Remove this to-do?\n\n"+todo.text+"\n\nThe original legacy record, if any, is not deleted."))return;ref.ws.todos.splice(index,1);touch(ref,'Removed to-do: "'+todo.text+'"');renderTodos(ref);render();}

function renderTimeline(ref){
  var events=(ref.ws.events||[]).slice().sort(function(a,b){return String(b.eventDate||"").localeCompare(String(a.eventDate||""))||String(b.createdAt||"").localeCompare(String(a.createdAt||""));});
  el("timelineCount").textContent=events.length+" entr"+(events.length===1?"y":"ies");
  el("timeline").innerHTML=events.length?events.map(function(event){var legacy=event.legacy?legacyDetails(event):"";return'<article class="timeline-entry"><div class="timeline-entry-head"><div><time>'+esc(localDate(event.eventDate))+'</time><span class="person">'+esc(event.contactId?contactName(ref.ws,event.contactId):"Internal / General")+'</span></div><div class="row-actions"><button data-edit-event="'+esc(event.id)+'">Edit</button></div></div><div class="event-note">'+esc(event.note||"")+'</div>'+(legacy?'<details><summary>Original call details retained</summary><div class="legacy-details">'+esc(legacy)+'</div></details>':'')+'</article>';}).join(""):'<div class="empty-inline">No file notes yet. Add anything that happened, whether it was a call, paper handed to you, internal update, document received, or something you checked yourself.</div>';
  document.querySelectorAll("[data-edit-event]").forEach(function(button){button.onclick=function(){editEvent(button.dataset.editEvent);};});
}
function legacyDetails(event){
  var x=event.legacy||{},rows=[];
  [["Direction",x.direction],["Caller / Contact",x.caller],["Phone",x.phone],["Company / Relationship",x.companyRole],["Call outcome",x.outcome],["Subject",x.subject],["Results",x.results],["Told / promised",x.advised],["Follow-up type",x.followType],["Legacy status",x.status],["Owner",x.owner],["Waiting on",x.waitingOn],["Due / check-in",x.dueDate]].forEach(function(pair){if(clean(pair[1]))rows.push(pair[0]+": "+pair[1]);});
  if(Array.isArray(x.history)&&x.history.length){rows.push("Running activity from old tracker:");x.history.forEach(function(item){rows.push("- "+(item.at?localDateTime(item.at)+" — ":"")+(item.text||""));});}
  if(event.sourceRecordId)rows.push("Source record retained: "+event.sourceRecordId);
  return rows.join("\n");
}
function saveEvent(){
  var ref=currentRef();if(!ref)return;var eventDate=el("eventDate").value||today(),contactId=el("eventContact").value,note=clean(el("eventNote").value);if(!note){alert("Enter a note before saving.");return;}
  if(editingEventId){var event=ref.ws.events.find(function(x){return x.id===editingEventId;});if(!event)return;var oldDate=event.eventDate;event.eventDate=eventDate;event.contactId=contactId;event.note=note;event.updatedAt=now();touch(ref,"Edited file note"+(oldDate!==eventDate?" and changed its date from "+oldDate+" to "+eventDate:""));showToast("Note updated. Original legacy details remain retained.");}
  else{ref.ws.events.push({id:uid("event"),eventDate:eventDate,contactId:contactId,note:note,createdAt:now(),updatedAt:now(),sourceRecordId:"",legacy:null});touch(ref,"Added file note dated "+eventDate);showToast("Note added.");}
  editingEventId="";el("eventDate").value=today();el("eventContact").value="";el("eventNote").value="";el("eventEditingBanner").classList.add("hidden");el("cancelEventEdit").classList.add("hidden");el("saveEvent").textContent="Add Note";renderContacts(ref);renderTimeline(ref);render();
}
function editEvent(id){var ref=currentRef(),event=ref&&ref.ws.events.find(function(x){return x.id===id;});if(!event)return;editingEventId=id;el("eventDate").value=event.eventDate||today();el("eventContact").value=event.contactId||"";el("eventNote").value=event.note||"";el("eventEditingBanner").classList.remove("hidden");el("eventEditingBanner").textContent=event.sourceRecordId?"Editing the workspace note. The original call record is still retained underneath and is not overwritten.":"Editing this note. You can change both the text and the date.";el("cancelEventEdit").classList.remove("hidden");el("saveEvent").textContent="Save Note Changes";el("eventNote").focus();}
function cancelEventEdit(){editingEventId="";el("eventDate").value=today();el("eventContact").value="";el("eventNote").value="";el("eventEditingBanner").classList.add("hidden");el("cancelEventEdit").classList.add("hidden");el("saveEvent").textContent="Add Note";}

function createNewCase(){
  var file=prompt("File number (you can leave this blank if all you have is an address):","");if(file===null)return;var address=prompt("Property address (you can leave this blank if you entered a file number):","");if(address===null)return;file=clean(file);address=clean(address);if(!file&&!address){alert("Enter a file number or property address so the file can be found again.");return;}
  var stamp=now(),ws={schemaVersion:WORKSPACE_SCHEMA,id:uid("case"),fileNumber:file,address:address,tracked:true,identifiers:[],contacts:[],events:[],todos:[],audit:[],sourceRecordIds:[],createdAt:stamp,updatedAt:stamp,migratedAt:""};
  var record={id:uid("workspace"),workspaceOnly:true,fileNumber:file,address:address,caller:"",phone:"",companyRole:"",subject:"",results:"",advised:"",followUp:false,status:"Completed",todos:[],history:[],createdAt:stamp,updatedAt:stamp,workspaceCase:ws};ws.sourceRecordIds.push(record.id);ws.audit.push({id:uid("audit"),at:stamp,text:"Created file workspace"});records.unshift(record);persistRecords();buildCaseRefs();render();openCase(ws.id);showToast("New tracked file created.");
}

function printCase(){
  var ref=currentRef();if(!ref)return;var ws=ref.ws,popup=window.open("","utei-case-workspace-print","width=930,height=950");if(!popup){alert("Please allow pop-ups to open the print sheet.");return;}
  var ids=(ws.identifiers||[]).map(function(x){return'<li><strong>'+esc(x.label)+':</strong> '+esc(x.value)+'</li>';}).join("")||'<li>None recorded</li>';
  var contacts=(ws.contacts||[]).map(function(c){return'<li><strong>'+esc(c.name)+'</strong> '+esc([c.role,c.phone].filter(Boolean).join(" · "))+'</li>';}).join("")||'<li>None recorded</li>';
  var todos=(ws.todos||[]).map(function(t){return'<li class="'+(t.completed?'done':'')+'">'+(t.completed?'☑':'☐')+' '+esc(t.text)+'</li>';}).join("")||'<li>No to-do items</li>';
  var events=(ws.events||[]).slice().sort(function(a,b){return String(b.eventDate||"").localeCompare(String(a.eventDate||""));}).map(function(e){return'<div class="event"><strong>'+esc(localDate(e.eventDate))+' — '+esc(e.contactId?contactName(ws,e.contactId):"General")+'</strong><div>'+esc(e.note).replace(/\n/g,"<br>")+'</div></div>';}).join("")||'<div>No notes recorded.</div>';
  popup.document.write('<!doctype html><html><head><meta charset="utf-8"><title>'+esc(ws.fileNumber||"Case Workspace")+'</title><style>@page{size:letter;margin:.45in}body{font:10.5pt Arial,sans-serif;color:#000;line-height:1.35}h1{margin:0;font-size:20pt}h2{margin:16px 0 6px;font-size:11pt;text-transform:uppercase;border-bottom:2px solid #000;padding-bottom:3px}.head{display:flex;justify-content:space-between;border-bottom:4px solid #000;padding-bottom:10px}.track{font-weight:700}.grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}ul{margin:5px 0;padding-left:20px}.done{text-decoration:line-through;color:#555}.event{padding:8px 0;border-bottom:1px solid #aaa}.event strong{display:block;margin-bottom:3px}.actions{margin-bottom:12px;text-align:right}.actions button{padding:8px 12px;border:2px solid #000;background:#fff;font-weight:700}@media print{.actions{display:none}}</style></head><body><div class="actions"><button onclick="window.print()">Print</button></div><header class="head"><div><div>Unified Title &amp; Escrow</div><h1>'+esc(ws.fileNumber||"Case Workspace")+'</h1><div>'+esc(ws.address||"No property address")+'</div></div><div class="track">'+(ws.tracked?'TRACKING':'NOT TRACKING')+'</div></header><div class="grid"><section><h2>Identifiers</h2><ul>'+ids+'</ul></section><section><h2>People</h2><ul>'+contacts+'</ul></section></div><section><h2>To-Do List</h2><ul>'+todos+'</ul></section><section><h2>File Notes</h2>'+events+'</section></body></html>');popup.document.close();
}

function exportBackup(){var payload={schemaVersion:"case-workspace-"+WORKSPACE_SCHEMA,exportedAt:now(),records:records};var blob=new Blob([JSON.stringify(payload,null,2)],{type:"application/json"}),link=document.createElement("a");link.href=URL.createObjectURL(blob);link.download="dylan-case-workspace-backup-"+today()+".json";document.body.appendChild(link);link.click();setTimeout(function(){URL.revokeObjectURL(link.href);link.remove();},1000);showToast("Backup downloaded with all legacy and workspace data.");}
function importBackup(file){
  if(!file)return;var reader=new FileReader();reader.onload=function(){try{var parsed=JSON.parse(reader.result),incoming=Array.isArray(parsed)?parsed:(Array.isArray(parsed.records)?parsed.records:parsed.calls);if(!Array.isArray(incoming))throw new Error("No records were found in this backup.");if(!confirm("Import "+incoming.length+" record"+(incoming.length===1?"":"s")+"? Existing newer records will be kept."))return;var map=new Map(records.map(function(record){return[record.id,record];})),added=0,updated=0;incoming.forEach(function(record){if(!record||typeof record!=="object")return;var id=record.id||uid("imported");record.id=id;var old=map.get(id);if(!old){map.set(id,record);added++;}else if(String(record.updatedAt||record.createdAt||"")>String(old.updatedAt||old.createdAt||"")){map.set(id,record);updated++;}});records=Array.from(map.values());persistRecords();migrateWorkspace();render();showToast("Import complete: "+added+" added, "+updated+" updated.");}catch(error){alert("Could not import this backup. "+error.message);}finally{el("importFile").value="";}};reader.readAsText(file);
}

function bind(){
  el("newFile").onclick=createNewCase;el("exportWorkspace").onclick=exportBackup;el("importWorkspace").onclick=function(){el("importFile").click();};el("importFile").onchange=function(){importBackup(this.files&&this.files[0]);};
  el("caseSearch").oninput=render;document.querySelectorAll("#viewTabs [data-view]").forEach(function(button){button.onclick=function(){currentView=button.dataset.view;el("caseSearch").value="";render();};});
  el("closeCaseModal").onclick=closeCase;el("closeCaseFooter").onclick=closeCase;el("caseModal").onclick=function(event){if(event.target===el("caseModal"))closeCase();};
  el("saveCaseDetails").onclick=saveCaseDetails;el("caseTracking").onchange=function(){if(currentCaseId)setTracked(currentCaseId,this.checked);};el("printCase").onclick=printCase;
  el("addIdentifierButton").onclick=startIdentifier;el("saveIdentifier").onclick=saveIdentifier;el("cancelIdentifier").onclick=function(){editingIdentifierId="";el("identifierEditor").classList.add("hidden");};
  el("addContactButton").onclick=startContact;el("saveContact").onclick=saveContact;el("cancelContact").onclick=function(){editingContactId="";el("contactEditor").classList.add("hidden");};
  el("addCaseTodo").onclick=addTodo;el("newCaseTodo").onkeydown=function(event){if(event.key==="Enter"){event.preventDefault();addTodo();}};
  el("saveEvent").onclick=saveEvent;el("cancelEventEdit").onclick=cancelEventEdit;
  document.addEventListener("keydown",function(event){if(event.key==="Escape"&&el("caseModal").classList.contains("show"))closeCase();});
}
async function boot(){
  var response=await cloud.auth.getSession(),session=response.data&&response.data.session;
  if(!session||lower(session.user&&session.user.email)!==OWNER_EMAIL){el("accessGate").innerHTML='<section class="gate-card"><div class="eyebrow">Dylan-only workspace</div><h1>Sign in through the tracker first</h1><p>This tool uses your existing Unified Title tracker session and remains limited to Dylan.</p><a class="button" href="./">Return to Tracker Sign-In</a></section>';return;}
  loadRecords();migrateWorkspace();bind();render();el("accessGate").classList.add("hidden");el("callsApp").classList.remove("hidden");
}
boot();
})();
