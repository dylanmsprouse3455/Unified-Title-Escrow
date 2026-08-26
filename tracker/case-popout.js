(function(){
"use strict";

var casePopoutWindow=null;
var casePopoutSelectedId="";
var casePopoutIsAlwaysOnTop=false;

function poEsc(value){return String(value==null?"":value).replace(/[&<>"']/g,function(ch){return{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[ch];});}
function poCase(){return cases.find(function(item){return item.id===casePopoutSelectedId&&!item.isDeleted;});}
function poLiveCases(){return cases.filter(function(item){return !item.isDeleted;});}
function poDateTime(value){return typeof displayDateTime==="function"?displayDateTime(value):displayDate(value);}
function poDocument(){return casePopoutWindow&&!casePopoutWindow.closed?casePopoutWindow.document:null;}
function poStatus(message){var doc=poDocument(),box=doc&&doc.getElementById("popStatus");if(box){box.textContent=message;setTimeout(function(){if(box.textContent===message)box.textContent="";},1800);}}
function poCommit(c,message){var at=touchCase(c);c.history=Array.isArray(c.history)?c.history:[];c.history.push({id:uid(),at:at,by:c.lastTouchedBy,text:message});save(true);refreshFilters();render();poStatus("Saved for everyone");}

function popoutShell(doc){
  var cssUrl=new URL("case-popout.css",location.href).href;
  doc.head.innerHTML='<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Floating Case File</title><link rel="stylesheet" href="'+cssUrl+'">';
  doc.body.innerHTML='<main class="pop-shell"><header class="pop-top"><div class="pop-brand"><strong>Floating Case File</strong><small>Unified Title &amp; Escrow</small></div><button id="popClose" class="pop-close" aria-label="Close floating window">×</button></header><div id="popMode" class="pop-mode"></div><div class="pop-search-wrap"><input id="popSearch" class="pop-search" autocomplete="off" placeholder="Type a case number or address…"><span class="pop-search-icon">⌕</span></div><div id="popResults" class="pop-results"></div><div id="popCase"></div><div id="popStatus" class="pop-status" aria-live="polite"></div></main>';
  doc.getElementById("popMode").textContent=casePopoutIsAlwaysOnTop?"Always-on-top window":"Floating window fallback — your browser cannot guarantee always-on-top";
  if(!casePopoutIsAlwaysOnTop)doc.getElementById("popMode").classList.add("fallback");
  doc.getElementById("popClose").addEventListener("click",function(){casePopoutWindow.close();});
  doc.getElementById("popSearch").addEventListener("input",renderPopoutSearch);
  renderPopoutSearch();
  setTimeout(function(){doc.getElementById("popSearch").focus();},30);
}

window.openFloatingCase=async function(){
  if(document.getElementById("dashboardMenu")&&document.getElementById("dashboardMenu").classList.contains("show"))toggleDashboardMenu(false);
  if(casePopoutWindow&&!casePopoutWindow.closed){casePopoutWindow.focus();return;}
  try{
    if(window.documentPictureInPicture&&documentPictureInPicture.requestWindow){
      casePopoutWindow=await window.documentPictureInPicture.requestWindow({width:390,height:720});
      casePopoutIsAlwaysOnTop=true;
    }else{
      casePopoutWindow=window.open("","utei-floating-case","popup=yes,width=390,height=720,resizable=yes,scrollbars=yes");
      casePopoutIsAlwaysOnTop=false;
    }
    if(!casePopoutWindow){alert("Please allow pop-ups so the floating case file can open.");return;}
    casePopoutWindow.addEventListener("pagehide",function(){casePopoutWindow=null;});
    popoutShell(casePopoutWindow.document);
  }catch(error){console.error(error);alert("The floating case window could not open in this browser. Please allow pop-ups and try again.");}
};

function renderPopoutSearch(){
  var doc=poDocument();if(!doc)return;
  var input=doc.getElementById("popSearch"),query=String(input.value||"").trim().toLowerCase(),results=doc.getElementById("popResults");
  if(casePopoutSelectedId){results.innerHTML="";renderPopoutCase();return;}
  if(!query){results.innerHTML='<div class="pop-empty">Start typing a case number or property address.</div>';doc.getElementById("popCase").innerHTML="";return;}
  var matches=poLiveCases().filter(function(item){return String(item.number||"").toLowerCase().includes(query)||String(item.address||"").toLowerCase().includes(query);}).slice(0,20);
  if(matches.length===1&&(String(matches[0].number||"").toLowerCase()===query||String(matches[0].address||"").toLowerCase()===query)){casePopoutSelectedId=matches[0].id;results.innerHTML="";renderPopoutCase();return;}
  results.innerHTML=matches.length?matches.map(function(item){return'<button type="button" class="pop-result" data-case-id="'+poEsc(item.id)+'"><strong>'+poEsc(item.number)+'</strong><span>'+poEsc(item.address||"No address entered")+' · '+poEsc(item.assigned||"Unassigned")+'</span></button>';}).join(""):'<div class="pop-empty">No matching case was found.</div>';
  Array.from(results.querySelectorAll("[data-case-id]")).forEach(function(button){button.addEventListener("click",function(){casePopoutSelectedId=button.dataset.caseId;renderPopoutCase();});});
}

function renderPopoutCase(){
  var doc=poDocument(),c=poCase();if(!doc)return;
  if(!c){casePopoutSelectedId="";renderPopoutSearch();return;}
  var priority=String(c.priority||"Normal"),priorityClass=priority.toLowerCase(),todos=(c.todos||[]).slice().sort(function(a,b){return Number(a.done)-Number(b.done)||String(a.createdAt||"").localeCompare(String(b.createdAt||""));});
  var history=(c.history||[]).slice().sort(function(a,b){return String(b.at||"").localeCompare(String(a.at||""));});
  doc.getElementById("popResults").innerHTML="";
  doc.getElementById("popCase").innerHTML='<article class="pop-card priority-'+poEsc(priorityClass)+'"><div class="pop-card-main"><div class="pop-case-head"><div><div class="pop-case-number">'+poEsc(c.number)+'</div><div class="pop-address">'+poEsc(c.address||"No address entered")+'</div><div class="pop-assigned">'+poEsc(c.assigned||"Unassigned")+'</div></div><button id="popClear" class="pop-clear" aria-label="Choose another case">×</button></div><div class="pop-badges"><span class="pop-badge">'+poEsc(c.status||"Not Started")+'</span><span class="pop-badge priority '+(priorityClass==="rush"?"rush":priorityClass==="high"?"high":"")+'">'+poEsc(priority)+' priority</span></div><div class="pop-next"><span class="pop-label">Next Step</span><strong>'+poEsc(c.nextAction||"No next step entered")+'</strong></div><div class="pop-meta">'+(c.targetDate?"Search due "+poEsc(displayDate(c.targetDate)):"No search due date")+(c.closingDate?" · Closing "+poEsc(displayDate(c.closingDate)):"")+'<br>Last touched by '+poEsc(c.lastTouchedBy||"No employee recorded")+(c.lastTouchedAt||c.lastUpdated?" · "+poEsc(poDateTime(c.lastTouchedAt||c.lastUpdated)):"")+'</div></div>'+detailsHtml(c)+todosHtml(todos)+historyHtml(history)+'</article>';
  bindPopoutCaseEvents();
}

function detailsHtml(c){
  var searchers=["Unassigned","Amy Hartman","Michael Womelduff"];if(c.assigned&&!searchers.includes(c.assigned))searchers.push(c.assigned);
  var statuses=["Not Assigned","Not Started","In Progress","Waiting on Information","Problem / Research","Complete"],priorities=["Normal","Rush","High","Low"];
  return'<details class="pop-section"><summary>Update Case Details</summary><div class="pop-section-body"><div class="pop-grid"><div class="pop-field"><label>Title Searcher</label><select id="poAssigned">'+searchers.map(function(value){return'<option '+(value===c.assigned?"selected":"")+'>'+poEsc(value)+'</option>';}).join("")+'</select></div><div class="pop-field"><label>Status</label><select id="poStatusField">'+statuses.map(function(value){return'<option '+(value===c.status?"selected":"")+'>'+poEsc(value)+'</option>';}).join("")+'</select></div><div class="pop-field"><label>Priority</label><select id="poPriority">'+priorities.map(function(value){return'<option '+(value===c.priority?"selected":"")+'>'+poEsc(value)+'</option>';}).join("")+'</select></div><div class="pop-field"><label>Search Due Date</label><input id="poTarget" type="date" value="'+poEsc(c.targetDate||"")+'"></div><div class="pop-field"><label>Closing Date</label><input id="poClosing" type="date" value="'+poEsc(c.closingDate||"")+'"></div><div class="pop-field full"><label>Next Step</label><textarea id="poNext">'+poEsc(c.nextAction||"")+'</textarea></div><div class="pop-field full"><label>Running File Notes</label><textarea id="poNotes">'+poEsc(c.notes||"")+'</textarea></div></div><button id="poSaveDetails" class="pop-save">Save Case Changes</button></div></details>';
}
function todosHtml(todos){
  var rows=todos.length?todos.map(function(todo){return'<div class="pop-todo '+(todo.done?"done":"")+'"><input type="checkbox" data-todo-toggle="'+poEsc(todo.id)+'" '+(todo.done?"checked":"")+'><div><div class="pop-todo-text">'+poEsc(todo.text)+'</div><div class="pop-todo-meta">'+(todo.done?"Completed "+poEsc(poDateTime(todo.completedAt||todo.updatedAt)):"Added "+poEsc(poDateTime(todo.createdAt)))+'</div></div><div class="pop-todo-actions"><button class="secondary" data-todo-edit="'+poEsc(todo.id)+'">Edit</button><button class="danger" data-todo-delete="'+poEsc(todo.id)+'">×</button></div></div>';}).join(""):'<div class="pop-empty">No to-do items yet.</div>';
  return'<details class="pop-section" open><summary>To-Do List ('+todos.filter(function(todo){return !todo.done;}).length+' open)</summary><div class="pop-section-body"><div class="pop-todos">'+rows+'</div><div class="pop-add-row"><input id="poNewTodo" placeholder="Add a to-do item…"><button id="poAddTodo">Add</button></div></div></details>';
}
function historyHtml(history){
  var rows=history.length?history.map(function(item){return'<div class="pop-history-item"><strong>'+poEsc(item.text||"")+'</strong><small>'+poEsc(item.by||"Unknown user")+' · '+poEsc(poDateTime(item.at))+'</small></div>';}).join(""):'<div class="pop-empty">No running file updates yet.</div>';
  return'<details class="pop-section"><summary>Updates &amp; Running File Record ('+history.length+')</summary><div class="pop-section-body"><div class="pop-history">'+rows+'</div><div class="pop-update-row"><textarea id="poNewUpdate" class="pop-update-input" placeholder="Add a file update or change note…"></textarea><button id="poAddUpdate">Add Update</button></div></div></details>';
}

function bindPopoutCaseEvents(){
  var doc=poDocument(),c=poCase();if(!doc||!c)return;
  doc.getElementById("popClear").addEventListener("click",function(){casePopoutSelectedId="";var input=doc.getElementById("popSearch");input.value="";renderPopoutSearch();setTimeout(function(){input.focus();},20);});
  doc.getElementById("poSaveDetails").addEventListener("click",savePopoutDetails);
  doc.getElementById("poAddTodo").addEventListener("click",addPopoutTodo);
  doc.getElementById("poNewTodo").addEventListener("keydown",function(event){if(event.key==="Enter"){event.preventDefault();addPopoutTodo();}});
  doc.getElementById("poAddUpdate").addEventListener("click",addPopoutUpdate);
  Array.from(doc.querySelectorAll("[data-todo-toggle]")).forEach(function(input){input.addEventListener("change",function(){togglePopoutTodo(input.dataset.todoToggle,input.checked);});});
  Array.from(doc.querySelectorAll("[data-todo-edit]")).forEach(function(button){button.addEventListener("click",function(){editPopoutTodo(button.dataset.todoEdit);});});
  Array.from(doc.querySelectorAll("[data-todo-delete]")).forEach(function(button){button.addEventListener("click",function(){deletePopoutTodo(button.dataset.todoDelete);});});
}

function savePopoutDetails(){
  var doc=poDocument(),c=poCase();if(!doc||!c)return;
  var values={assigned:doc.getElementById("poAssigned").value,status:doc.getElementById("poStatusField").value,priority:doc.getElementById("poPriority").value,targetDate:doc.getElementById("poTarget").value,closingDate:doc.getElementById("poClosing").value,nextAction:doc.getElementById("poNext").value.trim(),notes:doc.getElementById("poNotes").value.trim()};
  var labels={assigned:"title searcher",status:"status",priority:"priority",targetDate:"search due date",closingDate:"closing date",nextAction:"next step",notes:"running file notes"},changed=[];
  Object.keys(values).forEach(function(field){if(String(c[field]||"")!==String(values[field]||"")){c[field]=values[field];changed.push(labels[field]);}});
  if(!changed.length){poStatus("No changes to save");return;}
  poCommit(c,"Floating window updated "+changed.join(", "));
}
function addPopoutTodo(){var doc=poDocument(),c=poCase(),input=doc&&doc.getElementById("poNewTodo"),text=input&&input.value.trim();if(!c||!text)return;var at=touchCase(c);c.todos=Array.isArray(c.todos)?c.todos:[];c.todos.push({id:uid(),text:text,done:false,createdAt:at,updatedAt:at});c.history=Array.isArray(c.history)?c.history:[];c.history.push({id:uid(),at:at,by:c.lastTouchedBy,text:"To-do added from floating window: "+text});save(true);refreshFilters();render();poStatus("To-do added");}
function togglePopoutTodo(id,done){var c=poCase(),todo=c&&(c.todos||[]).find(function(item){return item.id===id;});if(!todo)return;var at=touchCase(c);todo.done=done;todo.updatedAt=at;todo.completedAt=done?at:"";c.history.push({id:uid(),at:at,by:c.lastTouchedBy,text:"To-do "+(done?"completed":"reopened")+" from floating window: "+todo.text});save(true);render();poStatus(done?"To-do completed":"To-do reopened");}
function editPopoutTodo(id){var c=poCase(),todo=c&&(c.todos||[]).find(function(item){return item.id===id;});if(!todo)return;var changed=casePopoutWindow.prompt("Change this to-do item:",todo.text);if(changed===null)return;var text=changed.trim();if(!text||text===todo.text)return;var old=todo.text,at=touchCase(c);todo.text=text;todo.updatedAt=at;c.history.push({id:uid(),at:at,by:c.lastTouchedBy,text:'To-do changed from “'+old+'” to “'+text+'” in floating window'});save(true);render();poStatus("To-do changed");}
function deletePopoutTodo(id){var c=poCase(),todo=c&&(c.todos||[]).find(function(item){return item.id===id;});if(!todo)return;var reason=casePopoutWindow.prompt("Why is this to-do being deleted?\n\n"+todo.text);if(reason===null)return;reason=reason.trim();if(!reason){casePopoutWindow.alert("A deletion reason is required.");return;}var at=touchCase(c);c.todos=c.todos.filter(function(item){return item.id!==id;});c.history.push({id:uid(),at:at,by:c.lastTouchedBy,text:"To-do deleted from floating window: "+todo.text+". Reason: "+reason});save(true);render();poStatus("To-do deleted");}
function addPopoutUpdate(){var doc=poDocument(),c=poCase(),input=doc&&doc.getElementById("poNewUpdate"),text=input&&input.value.trim();if(!c||!text)return;poCommit(c,"Floating window update: "+text);}

function installFloatingCaseButton(){
  var actions=document.querySelector(".dashboard-actions");
  if(actions&&!actions.querySelector("[data-floating-case]")){
    var button=document.createElement("button");button.type="button";button.className="secondary";button.dataset.floatingCase="true";button.textContent="Open Floating Case";button.addEventListener("click",openFloatingCase);
    var addButton=actions.querySelector(".gold");actions.insertBefore(button,addButton||null);
  }
  var topButtons=document.querySelector(".topbar-buttons");
  if(topButtons&&!topButtons.querySelector("[data-top-floating-case]")){
    var topButton=document.createElement("button");topButton.type="button";topButton.className="top-floating-case";topButton.dataset.topFloatingCase="true";topButton.innerHTML='<span aria-hidden="true">▣</span> Floating Case';topButton.addEventListener("click",openFloatingCase);
    var menuButton=document.getElementById("menuButton");topButtons.insertBefore(topButton,menuButton||null);
  }
}

var popoutBaseRender=render;
render=function(){popoutBaseRender();if(casePopoutWindow&&!casePopoutWindow.closed&&casePopoutSelectedId)renderPopoutCase();};
installFloatingCaseButton();
})();

