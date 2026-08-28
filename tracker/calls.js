(function(){
"use strict";

var OWNER_EMAIL="dylan.sprouse@unifiedtitle.net";
var STORAGE_KEY="utei.dylan.callTracker.v1";
var SCHEMA_VERSION=2;
var SUPABASE_URL="https://hdqmcjlpyjpfeltmxfax.supabase.co";
var SUPABASE_KEY="sb_publishable_lC2M8fZGmJQt6bWKgfiDnw_4Nx1TwHD";
var cloud=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY);

var records=[];
var currentView="work";
var statFilter="";
var editingId="";
var followMode=false;
var draftTodos=[];
var formDirty=false;
var toastTimer=0;

function el(id){return document.getElementById(id);}
function esc(value){return String(value==null?"":value).replace(/[&<>"']/g,function(ch){return{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[ch];});}
function uid(){return window.crypto&&crypto.randomUUID?crypto.randomUUID():"call-"+Date.now()+"-"+Math.random().toString(36).slice(2);}
function now(){return new Date().toISOString();}
function today(){var date=new Date();return date.getFullYear()+"-"+String(date.getMonth()+1).padStart(2,"0")+"-"+String(date.getDate()).padStart(2,"0");}
function localDate(value){if(!value)return"No date";var date=new Date(value.length===10?value+"T12:00:00":value);return isNaN(date)?value:date.toLocaleDateString(undefined,{month:"short",day:"numeric",year:"numeric"});}
function localDateTime(value){if(!value)return"—";var date=new Date(value);return isNaN(date)?value:date.toLocaleString(undefined,{month:"short",day:"numeric",year:"numeric",hour:"numeric",minute:"2-digit"});}
function dayDiff(value){if(!value)return null;var due=new Date(value+"T12:00:00"),base=new Date();base.setHours(12,0,0,0);return Math.round((due-base)/86400000);}
function ownerIsDylan(record){return !record.owner||String(record.owner).trim().toLowerCase()==="dylan";}
function isCompleted(record){return record.status==="Completed";}
function isWaiting(value){return /^Waiting/i.test(String(value||""));}

function normalizedStatus(raw){
  var values=[raw.status,raw.followStatus].filter(Boolean);
  if(values.some(function(value){return value==="Completed";}))return"Completed";
  if(values.some(isWaiting))return"Waiting";
  return"Open";
}
function normalizeTodo(todo,record){
  var completed=typeof todo.completed==="boolean"?todo.completed:!!todo.done;
  return{id:todo.id||uid(),text:String(todo.text||"").trim(),completed:completed,createdAt:todo.createdAt||record.createdAt||now(),completedAt:completed?(todo.completedAt||record.updatedAt||now()):""};
}
function meaningfulOutcome(value){
  var automated=["Follow-up created","Passed message to staff","No further action"];
  return automated.indexOf(String(value||""))===-1?String(value||""):"";
}
function firstOpenTodo(record){var todo=(record.todos||[]).find(function(item){return !item.completed;});return todo?todo.text:"";}
function syncAliases(record){
  record.schemaVersion=SCHEMA_VERSION;
  record.reason=record.subject;
  record.issueType=record.subject;
  record.notes=record.results;
  record.outcomeNotes=record.results;
  record.promise=record.advised;
  record.result=record.outcome;
  record.followStatus=record.status;
  record.category=record.followType;
  record.followUpType=record.followUp?record.followType:"No Follow-Up";
  record.assignedTo=record.owner||"Dylan";
  record.otherOwner=record.followUp&&!ownerIsDylan(record);
  record.dueDate=record.followUp?record.dueDate:"";
  record.followUpDate=record.dueDate;
  record.task=firstOpenTodo(record);
  record.nextAction=record.task;
  record.callbackRequired=record.followUp&&ownerIsDylan(record)&&record.followType==="Callback"&&record.status!=="Completed";
  return record;
}
function normalizeRecord(raw){
  raw=raw||{};
  var stamp=raw.createdAt||raw.updatedAt||now();
  var follow=typeof raw.followUp==="boolean"?raw.followUp:!!((raw.followUpType&&raw.followUpType!=="No Follow-Up")||raw.callbackRequired||raw.nextAction||raw.task);
  var todos=Array.isArray(raw.todos)?raw.todos.map(function(todo){return normalizeTodo(todo,raw);}).filter(function(todo){return todo.text;}):[];
  var legacyAction=String(raw.task||raw.nextAction||"").trim();
  if(follow&&!todos.length&&legacyAction)todos.push({id:uid(),text:legacyAction,completed:false,createdAt:stamp,completedAt:""});
  var record={
    schemaVersion:SCHEMA_VERSION,id:raw.id||uid(),direction:raw.direction||"Incoming",
    caller:raw.caller||"",phone:raw.phone||"",companyRole:raw.companyRole||"",
    fileNumber:raw.fileNumber||"",address:raw.address||"",
    subject:raw.subject||raw.reason||raw.issueType||"",
    outcome:raw.outcome||meaningfulOutcome(raw.result),
    results:raw.results||raw.outcomeNotes||raw.notes||"",
    advised:raw.advised||raw.promise||"",followUp:follow,
    followType:raw.followType||raw.category||((raw.followUpType&&raw.followUpType!=="No Follow-Up")?raw.followUpType:"Callback"),
    status:normalizedStatus(raw),previousStatus:raw.previousStatus||"Open",
    owner:raw.owner||raw.assignedTo||"Dylan",waitingOn:raw.waitingOn||"",
    dueDate:raw.dueDate||raw.followUpDate||"",todos:todos,
    createdAt:stamp,updatedAt:raw.updatedAt||stamp,
    completedAt:raw.completedAt||((normalizedStatus(raw)==="Completed")?(raw.updatedAt||stamp):""),
    history:Array.isArray(raw.history)?raw.history:[]
  };
  Object.keys(raw).forEach(function(key){if(!(key in record))record[key]=raw[key];});
  return syncAliases(record);
}
function loadRecords(){
  try{var stored=JSON.parse(localStorage.getItem(STORAGE_KEY)||"[]");records=Array.isArray(stored)?stored.map(normalizeRecord):[];}catch(error){records=[];}
  persistRecords();
}
function persistRecords(){localStorage.setItem(STORAGE_KEY,JSON.stringify(records.map(syncAliases)));}
function addHistory(record,text){record.history=Array.isArray(record.history)?record.history:[];record.history.push({id:uid(),at:now(),text:text});}

function nextStatus(record){
  if(isCompleted(record))return{label:"Completed",kind:"completed"};
  if(record.status==="Waiting")return{label:record.waitingOn?"Waiting on "+record.waitingOn:"Waiting",kind:"waiting"};
  if(!record.dueDate)return{label:"Needs a date",kind:"nodate"};
  var diff=dayDiff(record.dueDate);
  if(diff===0)return{label:"Due today",kind:"today"};
  if(diff<0)return{label:Math.abs(diff)+" day"+(Math.abs(diff)===1?"":"s")+" overdue",kind:"overdue"};
  return{label:diff+" day"+(diff===1?"":"s"),kind:"future"};
}
function openTodoCount(record){return(record.todos||[]).filter(function(todo){return !todo.completed;}).length;}
function searchable(record){return[
  record.caller,record.phone,record.companyRole,record.fileNumber,record.address,record.direction,
  record.subject,record.outcome,record.results,record.advised,record.followType,record.status,
  record.owner,record.waitingOn,firstOpenTodo(record)
].concat((record.todos||[]).map(function(todo){return todo.text;}),(record.history||[]).map(function(item){return item.text;})).join(" ").toLowerCase();}

function viewRecords(){
  var query=String(el("callSearch").value||"").trim().toLowerCase();
  var list;
  if(query){list=records.filter(function(record){return searchable(record).indexOf(query)!==-1;});}
  else if(currentView==="calls"){list=records.slice();}
  else if(currentView==="assigned"){list=records.filter(function(record){return record.followUp&&!ownerIsDylan(record)&&!isCompleted(record);});}
  else if(currentView==="completed"){list=records.filter(function(record){return record.followUp&&isCompleted(record);});}
  else{list=records.filter(function(record){return record.followUp&&ownerIsDylan(record)&&!isCompleted(record);});}
  if(!query&&currentView==="work"&&statFilter){list=list.filter(function(record){var diff=dayDiff(record.dueDate);if(statFilter==="today")return diff===0;if(statFilter==="overdue")return diff!==null&&diff<0;if(statFilter==="nodate")return !record.dueDate;return true;});}
  return list.sort(function(a,b){
    if(currentView==="calls")return String(b.createdAt).localeCompare(String(a.createdAt));
    var ad=a.dueDate||"9999-12-31",bd=b.dueDate||"9999-12-31";
    return ad.localeCompare(bd)||String(b.updatedAt).localeCompare(String(a.updatedAt));
  });
}
function renderStats(){
  var work=records.filter(function(record){return record.followUp&&ownerIsDylan(record)&&!isCompleted(record);});
  el("statOpen").textContent=work.length;
  el("statToday").textContent=work.filter(function(record){return dayDiff(record.dueDate)===0;}).length;
  el("statOverdue").textContent=work.filter(function(record){var diff=dayDiff(record.dueDate);return diff!==null&&diff<0;}).length;
  el("statNoDate").textContent=work.filter(function(record){return !record.dueDate;}).length;
  el("assignedCount").textContent=records.filter(function(record){return record.followUp&&!ownerIsDylan(record)&&!isCompleted(record);}).length;
}
function heading(){
  var query=String(el("callSearch").value||"").trim();
  if(query)return["Search Results","Searching every call, completed item, note, and to-do."];
  if(currentView==="calls")return["Call History","Every incoming and outgoing call, newest first."];
  if(currentView==="assigned")return["Assigned Out","Open work currently owned by another staff member."];
  if(currentView==="completed")return["Completed","Finished follow-ups retained for history and reopening."];
  if(statFilter==="today")return["Due Today","Your follow-ups due today."];
  if(statFilter==="overdue")return["Overdue","Your follow-ups past their due date."];
  if(statFilter==="nodate")return["Needs a Date","Your open follow-ups without a due or check-in date."];
  return["My Work","Open follow-ups that you still own."];
}
function cardHtml(record){
  var urgency=nextStatus(record),openTodos=openTodoCount(record),next=firstOpenTodo(record)||"No open next action";
  var completeButton=record.followUp?(isCompleted(record)?'<button type="button" class="reopen" data-reopen="'+esc(record.id)+'">Reopen</button>':'<button type="button" class="complete" data-complete="'+esc(record.id)+'">Mark Completed</button>'):"";
  return'<article class="record-card '+urgency.kind+' '+(isCompleted(record)?'completed':'')+'">'+
    '<header class="record-head"><div class="record-file"><span>File</span><strong>'+esc(record.fileNumber||"No file")+'</strong></div><span class="status-pill '+urgency.kind+'">'+esc(urgency.label)+'</span></header>'+
    '<div class="record-address">'+esc(record.address||"No property address")+'</div>'+
    '<div class="record-grid-fields">'+
      '<div class="record-field"><span class="field-label">Caller / Contact</span><strong>'+esc(record.caller||"Not entered")+'</strong><small>'+esc(record.phone||record.companyRole||"")+'</small></div>'+
      '<div class="record-field"><span class="field-label">Direction</span><strong>'+esc(record.direction)+'</strong><small>'+esc(record.outcome||"No outcome selected")+'</small></div>'+
      '<div class="record-field"><span class="field-label">Call Subject</span><strong>'+esc(record.subject||"Not entered")+'</strong></div>'+
      '<div class="record-field"><span class="field-label">Owner / Due</span><strong>'+esc(record.owner||"Dylan")+'</strong><small>'+esc(record.dueDate?localDate(record.dueDate):"No date")+'</small></div>'+
    '</div>'+
    '<div class="record-next"><span class="field-label">Next Action</span><p>'+esc(next)+'</p><small>'+openTodos+' open to-do'+(openTodos===1?"":"s")+' · Updated '+esc(localDateTime(record.updatedAt))+'</small></div>'+
    '<footer class="record-actions">'+completeButton+'<button type="button" data-edit="'+esc(record.id)+'">View / Edit</button><button type="button" data-print="'+esc(record.id)+'">Print Handoff</button></footer></article>';
}
function bindCards(){
  document.querySelectorAll("[data-edit]").forEach(function(button){button.onclick=function(){openForm(button.dataset.edit);};});
  document.querySelectorAll("[data-print]").forEach(function(button){button.onclick=function(){var record=findRecord(button.dataset.print);if(record)printRecord(record);};});
  document.querySelectorAll("[data-complete]").forEach(function(button){button.onclick=function(){completeRecord(button.dataset.complete);};});
  document.querySelectorAll("[data-reopen]").forEach(function(button){button.onclick=function(){reopenRecord(button.dataset.reopen);};});
}
function render(){
  renderStats();
  document.querySelectorAll("#viewTabs [data-view]").forEach(function(button){button.classList.toggle("active",button.dataset.view===currentView&&!String(el("callSearch").value||"").trim());});
  var copy=heading(),list=viewRecords();
  el("viewTitle").textContent=copy[0];el("viewDescription").textContent=copy[1];
  el("resultCount").textContent=list.length+" record"+(list.length===1?"":"s");
  el("recordGrid").innerHTML=list.map(cardHtml).join("");
  el("emptyState").classList.toggle("hidden",!!list.length);
  el("emptyState").textContent=String(el("callSearch").value||"").trim()?"No records match that search.":"Nothing is waiting in this view.";
  bindCards();
}
function findRecord(id){return records.find(function(record){return record.id===id;});}

function showToast(message,actionLabel,action){
  clearTimeout(toastTimer);el("toastText").textContent=message;
  var button=el("toastAction");button.classList.toggle("hidden",!actionLabel);button.textContent=actionLabel||"";button.onclick=action||null;
  el("toast").classList.add("show");toastTimer=setTimeout(function(){el("toast").classList.remove("show");},6000);
}
function completeRecord(id){
  var record=findRecord(id);if(!record)return;
  var count=openTodoCount(record);
  if(count&&!confirm("This follow-up still has "+count+" open to-do"+(count===1?"":"s")+". Mark it completed anyway?"))return;
  record.previousStatus=record.status==="Completed"?(record.previousStatus||"Open"):record.status;
  record.status="Completed";record.completedAt=now();record.updatedAt=record.completedAt;
  addHistory(record,"Follow-up marked completed"+(count?" with "+count+" open to-do"+(count===1?"":"s"):""));
  syncAliases(record);persistRecords();render();
  showToast("Follow-up completed.","Undo",function(){reopenRecord(id);});
}
function reopenRecord(id){
  var record=findRecord(id);if(!record)return;
  record.status=record.previousStatus&&record.previousStatus!=="Completed"?record.previousStatus:"Open";
  record.completedAt="";record.updatedAt=now();addHistory(record,"Follow-up reopened as "+record.status);
  syncAliases(record);persistRecords();render();showToast("Follow-up reopened.");
}

function markDirty(){formDirty=true;el("unsavedStatus").classList.remove("hidden");}
function clearDirty(){formDirty=false;el("unsavedStatus").classList.add("hidden");}
function updateDirectionPrompts(){
  var outgoing=el("formDirection").value==="Outgoing";
  el("subjectLabel").textContent=outgoing?"What was I calling about?":"What were they calling about?";
  el("resultsLabel").textContent=outgoing?"What were the results?":"What happened on the call?";
  el("advisedLabel").textContent=outgoing?"What did I tell or promise them?":"What did I tell or promise them?";
}
function toggleFollow(on,dirty){
  followMode=on;el("noFollow").classList.toggle("active",!on);el("yesFollow").classList.toggle("active",on);el("followPanel").classList.toggle("hidden",!on);
  if(dirty)markDirty();
}
function toggleWaiting(){el("waitingOnField").classList.toggle("hidden",el("formStatus").value!=="Waiting");}
function fillContactOptions(){
  var map=new Map();records.forEach(function(record){if(record.caller&&!map.has(record.caller.toLowerCase()))map.set(record.caller.toLowerCase(),record);});
  el("contactOptions").innerHTML=Array.from(map.values()).sort(function(a,b){return a.caller.localeCompare(b.caller);}).map(function(record){return'<option value="'+esc(record.caller)+'" label="'+esc([record.companyRole,record.phone].filter(Boolean).join(" · "))+'"></option>';}).join("");
}
function applyKnownContact(){
  var name=String(el("formCaller").value||"").trim().toLowerCase();if(!name)return;
  var record=records.find(function(item){return String(item.caller||"").trim().toLowerCase()===name;});if(!record)return;
  if(!el("formPhone").value)el("formPhone").value=record.phone||"";
  if(!el("formCompany").value)el("formCompany").value=record.companyRole||"";
}
function renderTodos(){
  var open=draftTodos.filter(function(todo){return !todo.completed;}).length;
  el("todoSummary").textContent=open?open+" open":draftTodos.length?"All complete":"No items yet";
  el("todoList").innerHTML=draftTodos.length?draftTodos.map(function(todo){return'<div class="todo-item '+(todo.completed?'complete':'')+'"><label><input type="checkbox" data-todo-check="'+esc(todo.id)+'" '+(todo.completed?'checked':'')+'><span>'+esc(todo.text)+'</span></label><button type="button" data-todo-remove="'+esc(todo.id)+'">Remove</button></div>';}).join(""):'<div class="todo-empty">Add the first next action above.</div>';
  el("todoList").querySelectorAll("[data-todo-check]").forEach(function(box){box.onchange=function(){var todo=draftTodos.find(function(item){return item.id===box.dataset.todoCheck;});if(!todo)return;todo.completed=box.checked;todo.completedAt=todo.completed?now():"";commitTodoChange((todo.completed?"Completed":"Reopened")+' to-do: "'+todo.text+'"');};});
  el("todoList").querySelectorAll("[data-todo-remove]").forEach(function(button){button.onclick=function(){var todo=draftTodos.find(function(item){return item.id===button.dataset.todoRemove;});if(!todo||!confirm('Remove this to-do?\n\n'+todo.text))return;draftTodos=draftTodos.filter(function(item){return item.id!==todo.id;});commitTodoChange('Removed to-do: "'+todo.text+'"');};});
}
function assignTodosToRecord(list,id,todos){
  var record=list.find(function(item){return item.id===id;});
  if(!record)return null;
  record.todos=todos.map(function(todo){return Object.assign({},todo);});
  return record;
}
function commitTodoChange(historyText){
  renderTodos();
  if(!editingId){markDirty();return;}
  var record=assignTodosToRecord(records,editingId,draftTodos);if(!record)return;
  record.updatedAt=now();addHistory(record,historyText);syncAliases(record);persistRecords();renderHistory(record);render();
  el("todoSaveNote").textContent="Checklist saved automatically.";
}
function addTodo(){
  var input=el("newTodoText"),text=String(input.value||"").trim();if(!text)return;
  draftTodos.push({id:uid(),text:text,completed:false,createdAt:now(),completedAt:""});input.value="";commitTodoChange('Added to-do: "'+text+'"');input.focus();
}
function renderHistory(record){
  var history=(record.history||[]).slice().sort(function(a,b){return String(b.at).localeCompare(String(a.at));});
  el("historyCount").textContent=history.length+" entr"+(history.length===1?"y":"ies");
  el("historyList").innerHTML=history.length?history.map(function(item){return'<div class="history-item"><time>'+esc(localDateTime(item.at))+'</time><div>'+esc(item.text)+'</div></div>';}).join(""):'<div class="todo-empty">No activity recorded yet.</div>';
}
function clearFormFields(){
  ["formCaller","formPhone","formCompany","formFile","formAddress","formSubject","formResults","formAdvised","formWaitingOn","newTodoText"].forEach(function(id){el(id).value="";});
  el("formDirection").value="Incoming";el("formOutcome").value="";el("formFollowType").value="Callback";el("formStatus").value="Open";el("formDueDate").value="";el("formOwner").value="Dylan";
  updateDirectionPrompts();toggleWaiting();
}
function openForm(id){
  editingId=id||"";draftTodos=[];clearFormFields();toggleFollow(false,false);clearDirty();
  var record=findRecord(editingId);
  el("modalTitle").textContent=record?"Call Record":"Add Call";
  el("modalSubtitle").textContent=record?(record.fileNumber||"No file")+" · "+(record.caller||"No caller"):"Capture the conversation, then decide what happens next.";
  el("deleteCall").classList.toggle("hidden",!record);el("historySection").classList.toggle("hidden",!record);
  if(record){
    el("formCaller").value=record.caller;el("formPhone").value=record.phone;el("formCompany").value=record.companyRole;el("formFile").value=record.fileNumber;el("formAddress").value=record.address;
    el("formDirection").value=record.direction;el("formOutcome").value=record.outcome;el("formSubject").value=record.subject;el("formResults").value=record.results;el("formAdvised").value=record.advised;
    toggleFollow(record.followUp,false);el("formFollowType").value=record.followType;el("formStatus").value=record.status;el("formDueDate").value=record.dueDate;el("formOwner").value=record.owner;el("formWaitingOn").value=record.waitingOn;
    draftTodos=(record.todos||[]).map(function(todo){return Object.assign({},todo);});renderHistory(record);
  }
  updateDirectionPrompts();toggleWaiting();renderTodos();
  el("todoSaveNote").textContent=record?"Checklist changes save automatically.":"Checklist changes save with this new call.";
  el("callModal").classList.add("show");setTimeout(function(){el("formCaller").focus();},30);
}
function requestClose(){if(formDirty&&!confirm("Discard your unsaved call changes?"))return;clearDirty();el("callModal").classList.remove("show");editingId="";}
function formValues(){return{
  caller:el("formCaller").value.trim(),phone:el("formPhone").value.trim(),companyRole:el("formCompany").value.trim(),fileNumber:el("formFile").value.trim(),address:el("formAddress").value.trim(),direction:el("formDirection").value,outcome:el("formOutcome").value,subject:el("formSubject").value.trim(),results:el("formResults").value.trim(),advised:el("formAdvised").value.trim(),followType:el("formFollowType").value,status:el("formStatus").value,dueDate:el("formDueDate").value,owner:el("formOwner").value.trim(),waitingOn:el("formWaitingOn").value.trim()
};}
function validate(data){
  if(!data.caller&&!data.fileNumber){alert("Enter at least a caller/contact or file number.");return false;}
  if(!data.subject){alert(data.direction==="Outgoing"?"Enter what you were calling about.":"Enter what they were calling about.");return false;}
  if(followMode&&!draftTodos.length){alert("Add at least one follow-up to-do item.");return false;}
  if(followMode&&!data.dueDate){alert("Choose a due or check-in date for the follow-up.");return false;}
  if(followMode&&!data.owner){alert("Enter who owns the follow-up.");return false;}
  if(followMode&&data.status==="Waiting"&&!data.waitingOn){alert("Enter who or what this follow-up is waiting on.");return false;}
  if(followMode&&data.status==="Completed"&&draftTodos.some(function(todo){return !todo.completed;})&&!confirm("This follow-up still has open to-do items. Save it as completed anyway?"))return false;
  return true;
}
function saveForm(){
  var data=formValues();if(!validate(data))return null;
  var existing=findRecord(editingId),stamp=now(),record=existing||normalizeRecord({id:uid(),createdAt:stamp,history:[]});
  Object.keys(data).forEach(function(key){record[key]=data[key];});
  record.followUp=followMode;record.todos=draftTodos.map(function(todo){return Object.assign({},todo);});
  if(!followMode){record.status="Completed";record.completedAt=record.completedAt||stamp;record.followType="No Follow-Up";record.waitingOn="";record.dueDate="";record.owner="Dylan";}
  else if(record.status!=="Completed"){record.completedAt="";}
  record.updatedAt=stamp;addHistory(record,existing?"Call record updated":"Call record created");syncAliases(record);
  if(!existing)records.unshift(record);persistRecords();clearDirty();el("callModal").classList.remove("show");editingId="";fillContactOptions();render();showToast("Call saved.");return record;
}
function deleteFormRecord(){
  var record=findRecord(editingId);if(!record||!confirm("Delete this call record? This cannot be undone."))return;
  records=records.filter(function(item){return item.id!==record.id;});persistRecords();clearDirty();el("callModal").classList.remove("show");editingId="";render();showToast("Call deleted.");
}

function printRecord(record){
  var popup=window.open("","utei-call-handoff","width=930,height=950");if(!popup){alert("Please allow pop-ups to open the handoff sheet.");return;}
  var todos=record.todos||[],open=openTodoCount(record);
  var todoHtml=todos.length?todos.map(function(todo){return'<li class="'+(todo.completed?'done':'')+'"><span class="check">'+(todo.completed?'✓':'')+'</span><div><strong>'+esc(todo.text)+'</strong><small>'+(todo.completed?'Completed':'Open follow-up item')+'</small></div></li>';}).join(""):'<li class="empty">No follow-up items recorded.</li>';
  popup.document.write('<!doctype html><html><head><meta charset="utf-8"><title>Call Handoff '+esc(record.fileNumber||"")+'</title><style>@page{size:letter;margin:.45in}*{box-sizing:border-box}html{background:#ddd}body{width:min(8.5in,100%);margin:18px auto;padding:.48in;background:#fff;color:#000;font:11pt Arial,sans-serif;line-height:1.4;box-shadow:0 4px 22px rgba(0,0,0,.16)}.actions{display:flex;justify-content:flex-end;gap:8px;margin-bottom:14px}.actions button{padding:9px 14px;border:2px solid #000;background:#fff;font-weight:800}.actions .print{background:#000;color:#fff}.head{display:flex;justify-content:space-between;align-items:end;padding-bottom:10px;border-bottom:4px solid #000}.office{font-size:9pt;font-weight:900;letter-spacing:.1em;text-transform:uppercase}.head h1{margin:3px 0;font-size:22pt}.direction{padding:7px 11px;border:2px solid #000;font-weight:900;text-transform:uppercase}.grid{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin-top:11px}.box{padding:10px 12px;border:1px solid #777;border-radius:7px}.wide{grid-column:1/-1}.label{display:block;margin-bottom:4px;font-size:8pt;font-weight:900;letter-spacing:.06em;text-transform:uppercase}.value{font-weight:700;white-space:pre-wrap}.tasks{margin-top:11px;padding:12px;border:2px solid #000;border-radius:8px}.section-head{display:flex;justify-content:space-between}.tasks h2,.notes h2{margin:0 0 7px;font-size:10pt;text-transform:uppercase}.tasks ul{margin:0;padding:0;list-style:none}.tasks li{display:grid;grid-template-columns:24px 1fr;gap:7px;padding:7px 0;border-top:1px solid #aaa}.tasks li:first-child{border-top:0}.check{width:18px;height:18px;display:grid;place-items:center;border:2px solid #000;font-weight:900}.tasks li strong,.tasks li small{display:block}.tasks li small{color:#555;font-size:8pt}.tasks li.done strong{text-decoration:line-through;color:#555}.tasks li.empty{display:block;color:#555}.notes{margin-top:14px}.line{height:27px;border-bottom:1px solid #666}.footer{margin-top:12px;padding-top:7px;border-top:1px solid #777;font-size:8.5pt}@media print{html{background:#fff}body{width:auto;margin:0;padding:0;box-shadow:none}.actions{display:none}}</style></head><body><div class="actions"><button onclick="window.close()">Close Preview</button><button class="print" onclick="window.print()">Print Handoff</button></div><header class="head"><div><div class="office">Unified Title &amp; Escrow</div><h1>Call Handoff</h1><div>Prepared '+esc(localDateTime(now()))+'</div></div><div class="direction">'+esc(record.direction)+'</div></header><main><div class="grid"><div class="box"><span class="label">Caller / Contact</span><div class="value">'+esc(record.caller||"—")+'</div></div><div class="box"><span class="label">Phone</span><div class="value">'+esc(record.phone||"—")+'</div></div><div class="box"><span class="label">File Number</span><div class="value">'+esc(record.fileNumber||"—")+'</div></div><div class="box"><span class="label">Property</span><div class="value">'+esc(record.address||"—")+'</div></div><div class="box"><span class="label">Call Outcome</span><div class="value">'+esc(record.outcome||"—")+'</div></div><div class="box"><span class="label">Owner / Due</span><div class="value">'+esc(record.followUp?(record.owner+" · "+localDate(record.dueDate)):"No follow-up")+'</div></div><div class="box wide"><span class="label">'+(record.direction==="Outgoing"?"What I Was Calling About":"What They Were Calling About")+'</span><div class="value">'+esc(record.subject||"—")+'</div></div><div class="box wide"><span class="label">'+(record.direction==="Outgoing"?"Results":"What Happened on the Call")+'</span><div class="value">'+esc(record.results||"—")+'</div></div><div class="box wide"><span class="label">What I Told / Promised Them</span><div class="value">'+esc(record.advised||"—")+'</div></div></div><section class="tasks"><div class="section-head"><h2>Follow-Up To-Do List</h2><strong>'+open+' open</strong></div><ul>'+todoHtml+'</ul></section><section class="notes"><h2>Office Handoff Notes</h2>'+new Array(8).fill('<div class="line"></div>').join("")+'</section></main><footer class="footer">Calls &amp; Follow-Ups · Office Handoff Copy</footer></body></html>');
  popup.document.close();
}

function exportBackup(){
  var payload={schemaVersion:SCHEMA_VERSION,exportedAt:now(),records:records.map(syncAliases)};
  var blob=new Blob([JSON.stringify(payload,null,2)],{type:"application/json"}),link=document.createElement("a");
  link.href=URL.createObjectURL(blob);link.download="calls-follow-ups-backup-"+today()+".json";document.body.appendChild(link);link.click();setTimeout(function(){URL.revokeObjectURL(link.href);link.remove();},1000);showToast("Call backup downloaded.");
}
function importBackup(file){
  if(!file)return;var reader=new FileReader();
  reader.onload=function(){
    try{
      var parsed=JSON.parse(reader.result),incoming=Array.isArray(parsed)?parsed:(Array.isArray(parsed.records)?parsed.records:parsed.calls);
      if(!Array.isArray(incoming))throw new Error("No call records were found in this backup.");
      if(!confirm("Import "+incoming.length+" call record"+(incoming.length===1?"":"s")+"? Existing records with newer updates will be kept."))return;
      var map=new Map(records.map(function(record){return[record.id,record];}));var added=0,updated=0;
      incoming.map(normalizeRecord).forEach(function(record){var old=map.get(record.id);if(!old){map.set(record.id,record);added++;}else if(String(record.updatedAt||"")>String(old.updatedAt||"")){map.set(record.id,record);updated++;}});
      records=Array.from(map.values());persistRecords();fillContactOptions();render();showToast("Import complete: "+added+" added, "+updated+" updated.");
    }catch(error){alert("Could not import this backup. "+error.message);}
    finally{el("importCallsFile").value="";}
  };
  reader.readAsText(file);
}

function bind(){
  el("newCall").onclick=function(){openForm();};el("exportCalls").onclick=exportBackup;el("importCalls").onclick=function(){el("importCallsFile").click();};el("importCallsFile").onchange=function(){importBackup(this.files&&this.files[0]);};
  el("callSearch").oninput=function(){statFilter="";render();};
  document.querySelectorAll("#viewTabs [data-view]").forEach(function(button){button.onclick=function(){currentView=button.dataset.view;statFilter="";el("callSearch").value="";render();};});
  document.querySelectorAll("[data-stat-view]").forEach(function(button){button.onclick=function(){currentView=button.dataset.statView;statFilter="";el("callSearch").value="";render();};});
  document.querySelectorAll("[data-stat-filter]").forEach(function(button){button.onclick=function(){currentView="work";statFilter=button.dataset.statFilter;el("callSearch").value="";render();};});
  el("noFollow").onclick=function(){toggleFollow(false,true);};el("yesFollow").onclick=function(){toggleFollow(true,true);};el("formDirection").onchange=function(){updateDirectionPrompts();markDirty();};el("formStatus").onchange=function(){toggleWaiting();markDirty();};el("formCaller").onchange=applyKnownContact;
  el("addTodo").onclick=addTodo;el("newTodoText").onkeydown=function(event){if(event.key==="Enter"){event.preventDefault();addTodo();}};
  el("closeCallModal").onclick=requestClose;el("cancelCall").onclick=requestClose;el("saveCall").onclick=saveForm;el("savePrintCall").onclick=function(){var record=saveForm();if(record)printRecord(record);};el("deleteCall").onclick=deleteFormRecord;
  el("callModal").onclick=function(event){if(event.target===el("callModal"))requestClose();};
  el("callModal").querySelectorAll("input,select,textarea").forEach(function(field){if(field.id==="newTodoText")return;field.addEventListener("input",markDirty);field.addEventListener("change",markDirty);});
  document.addEventListener("keydown",function(event){if(event.key==="Escape"&&el("callModal").classList.contains("show"))requestClose();});
}
async function boot(){
  var response=await cloud.auth.getSession(),session=response.data&&response.data.session;
  if(!session||String(session.user.email||"").toLowerCase()!==OWNER_EMAIL){el("accessGate").innerHTML='<section class="gate-card"><div class="eyebrow">Dylan-only workspace</div><h1>Sign in through the tracker first</h1><p>This tool uses your existing Unified Title tracker session.</p><a class="button" href="./">Return to Tracker Sign-In</a></section>';return;}
  loadRecords();fillContactOptions();bind();render();el("accessGate").classList.add("hidden");el("callsApp").classList.remove("hidden");
}
boot();
})();

