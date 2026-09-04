(function(){
"use strict";

var STORAGE_KEY="utei.dylan.callTracker.v1";
var activePersonId="";
var editingPersonEventId="";
var bypassAddPerson=false;

function el(id){return document.getElementById(id);}
function clean(value){return String(value==null?"":value).trim();}
function esc(value){return String(value==null?"":value).replace(/[&<>"']/g,function(ch){return{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[ch];});}
function localDate(value){if(!value)return"No date";var d=new Date(String(value).length===10?value+"T12:00:00":value);return isNaN(d)?value:d.toLocaleDateString(undefined,{month:"short",day:"numeric",year:"numeric"});}
function today(){var d=new Date();return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");}
function readRecords(){try{var parsed=JSON.parse(localStorage.getItem(STORAGE_KEY)||"[]");return Array.isArray(parsed)?parsed:[];}catch(_error){return[];}}
function currentWorkspace(){
  var file=clean(el("caseFileNumber")&&el("caseFileNumber").value).toLowerCase();
  var address=clean(el("caseAddress")&&el("caseAddress").value).toLowerCase();
  var records=readRecords(),fallback=null;
  for(var i=0;i<records.length;i++){
    var ws=records[i]&&records[i].workspaceCase;
    if(!ws)continue;
    if(file&&clean(ws.fileNumber).toLowerCase()===file)return ws;
    if(!file&&address&&clean(ws.address).toLowerCase()===address)return ws;
    if(address&&clean(ws.address).toLowerCase()===address)fallback=ws;
  }
  return fallback;
}
function currentContact(){var ws=currentWorkspace();return ws&&(ws.contacts||[]).find(function(c){return c.id===activePersonId;});}
function relatedEvents(){var ws=currentWorkspace();if(!ws)return[];return(ws.events||[]).filter(function(event){return event.contactId===activePersonId;}).sort(function(a,b){return String(b.eventDate||"").localeCompare(String(a.eventDate||""))||String(b.createdAt||"").localeCompare(String(a.createdAt||""));});}

function refreshMainCopy(){
  var subtitle=el("caseModalSubtitle");if(subtitle&&/identifier/i.test(subtitle.textContent||""))subtitle.textContent="People, notes, and to-dos.";
  var search=el("caseSearch");if(search)search.placeholder="Search file number, address, person, phone, note, or to-do…";
}

function openPerson(personId){
  activePersonId=personId||"";editingPersonEventId="";
  var contact=currentContact();
  el("personModalTitle").textContent=contact?(contact.name||"Person Details"):"Add Person / Company";
  el("personModalSubtitle").textContent=contact?([contact.role,contact.phone].filter(Boolean).join(" · ")||"Contact information and interaction history."):"Add this person to the current file.";
  el("personName").value=contact?contact.name||"":"";
  el("personRole").value=contact?contact.role||"":"";
  el("personPhone").value=contact?contact.phone||"":"";
  el("personLogDate").value=today();el("personLogNote").value="";
  el("cancelPersonLogEdit").classList.add("hidden");el("savePersonLog").textContent="Add Interaction";
  el("personLogDate").disabled=!contact;el("personLogNote").disabled=!contact;el("savePersonLog").disabled=!contact;
  renderPersonHistory();el("personModal").classList.add("show");setTimeout(function(){el("personName").focus();},20);
}
function closePerson(){el("personModal").classList.remove("show");activePersonId="";editingPersonEventId="";}

function renderPersonHistory(){
  var list=relatedEvents();el("personHistoryCount").textContent=list.length+" entr"+(list.length===1?"y":"ies");
  el("personHistory").innerHTML=list.length?list.map(function(event){
    var hasLegacy=!!event.legacy;
    return'<article class="person-history-entry"><div class="person-history-entry-head"><time>'+esc(localDate(event.eventDate))+'</time><div class="person-history-actions"><button type="button" data-person-edit-event="'+esc(event.id)+'">Edit</button></div></div><div class="person-history-note">'+esc(event.note||"")+'</div>'+(hasLegacy?'<details><summary>Original call details retained</summary><div class="legacy-details">This interaction came from the previous tracker. The original stored call fields remain preserved in the file record.</div></details>':'')+'</article>';
  }).join(""):'<div class="empty-inline">No interactions logged for this person yet.</div>';
}

function savePersonDetails(){
  var name=clean(el("personName").value),role=clean(el("personRole").value),phone=clean(el("personPhone").value);if(!name&&!role&&!phone){alert("Enter at least a name, relationship, or phone number.");return;}
  if(activePersonId){
    var editButton=document.querySelector('[data-edit-contact="'+CSS.escape(activePersonId)+'"]');if(!editButton){alert("Could not locate this person in the file. Close and reopen the file, then try again.");return;}
    editButton.click();
  }else{
    bypassAddPerson=true;el("addContactButton").click();bypassAddPerson=false;
  }
  el("contactName").value=name;el("contactRole").value=role;el("contactPhone").value=phone;el("saveContact").click();
  setTimeout(function(){
    var ws=currentWorkspace();
    if(!activePersonId&&ws){var matches=(ws.contacts||[]).filter(function(c){return clean(c.name)===name&&clean(c.role)===role&&clean(c.phone)===phone;});if(matches.length)activePersonId=matches[matches.length-1].id;}
    var contact=currentContact();if(contact){el("personModalTitle").textContent=contact.name||"Person Details";el("personModalSubtitle").textContent=[contact.role,contact.phone].filter(Boolean).join(" · ")||"Contact information and interaction history.";el("personLogDate").disabled=false;el("personLogNote").disabled=false;el("savePersonLog").disabled=false;}
    renderPersonHistory();
  },40);
}

function beginEditPersonEvent(id){
  var mainEdit=document.querySelector('[data-edit-event="'+CSS.escape(id)+'"]');if(!mainEdit)return;
  mainEdit.click();editingPersonEventId=id;
  el("personLogDate").value=el("eventDate").value||today();el("personLogNote").value=el("eventNote").value||"";
  el("cancelPersonLogEdit").classList.remove("hidden");el("savePersonLog").textContent="Save Interaction";el("personLogNote").focus();
}
function cancelPersonEventEdit(){editingPersonEventId="";el("personLogDate").value=today();el("personLogNote").value="";el("cancelPersonLogEdit").classList.add("hidden");el("savePersonLog").textContent="Add Interaction";if(!el("cancelEventEdit").classList.contains("hidden"))el("cancelEventEdit").click();}
function savePersonLog(){
  if(!activePersonId)return;var date=el("personLogDate").value||today(),note=clean(el("personLogNote").value);if(!note){alert("Enter an interaction note before saving.");return;}
  if(editingPersonEventId){var mainEdit=document.querySelector('[data-edit-event="'+CSS.escape(editingPersonEventId)+'"]');if(mainEdit)mainEdit.click();}
  el("eventContact").value=activePersonId;el("eventDate").value=date;el("eventNote").value=note;el("saveEvent").click();
  editingPersonEventId="";el("personLogDate").value=today();el("personLogNote").value="";el("cancelPersonLogEdit").classList.add("hidden");el("savePersonLog").textContent="Add Interaction";setTimeout(renderPersonHistory,40);
}

function printSheet(){
  var ws=currentWorkspace();if(!ws)return;var popup=window.open("","utei-file-sheet","width=980,height=1000");if(!popup){alert("Please allow pop-ups to open the print sheet.");return;}
  var contacts=(ws.contacts||[]).map(function(c){var events=(ws.events||[]).filter(function(e){return e.contactId===c.id;}).sort(function(a,b){return String(b.eventDate||"").localeCompare(String(a.eventDate||""));});var last=events[0];return'<div class="person"><div class="person-main"><strong>'+esc(c.name||"Unnamed contact")+'</strong><span>'+esc(c.role||"Relationship not entered")+'</span><span>'+esc(c.phone||"Phone not entered")+'</span></div><div class="person-last">'+esc(last?"Last interaction: "+localDate(last.eventDate):"No interaction logged")+'</div></div>';}).join("")||'<div class="empty">No people recorded.</div>';
  var todos=(ws.todos||[]).map(function(t){return'<div class="todo '+(t.completed?'done':'')+'"><span class="box">'+(t.completed?'✓':'')+'</span><span>'+esc(t.text)+'</span></div>';}).join("")||'<div class="empty">No to-do items recorded.</div>';
  var events=(ws.events||[]).slice().sort(function(a,b){return String(b.eventDate||"").localeCompare(String(a.eventDate||""))||String(b.createdAt||"").localeCompare(String(a.createdAt||""));}).map(function(e){var person=(ws.contacts||[]).find(function(c){return c.id===e.contactId;});return'<div class="event"><div class="event-head"><strong>'+esc(localDate(e.eventDate))+'</strong><span>'+esc(person?(person.name||"Person / Company"):"General File Note")+'</span></div><div class="event-note">'+esc(e.note||"").replace(/\n/g,"<br>")+'</div></div>';}).join("")||'<div class="empty">No file notes recorded.</div>';
  var lines=new Array(9).fill('<div class="office-line"></div>').join("");
  popup.document.write('<!doctype html><html><head><meta charset="utf-8"><title>'+esc(ws.fileNumber||"File Sheet")+'</title><style>@page{size:letter;margin:.45in}*{box-sizing:border-box}html{background:#e9edf1}body{width:min(8.5in,100%);margin:18px auto;padding:.42in;background:#fff;color:#111;font:10.5pt Arial,sans-serif;line-height:1.35;box-shadow:0 4px 22px rgba(0,0,0,.14)}.actions{display:flex;justify-content:flex-end;gap:8px;margin-bottom:14px}.actions button{padding:8px 13px;border:2px solid #111;background:#fff;font-weight:800}.actions .print{background:#111;color:#fff}.top{display:grid;grid-template-columns:1fr auto;gap:16px;align-items:start;padding-bottom:12px;border-bottom:4px solid #111}.office{font-size:8pt;font-weight:900;letter-spacing:.09em;text-transform:uppercase}.top h1{margin:4px 0 2px;font-size:23pt}.address{font-size:11.5pt}.track{padding:7px 10px;border:2px solid #111;font-size:9pt;font-weight:900;letter-spacing:.06em}.section{margin-top:15px}.section h2{margin:0 0 7px;padding-bottom:4px;border-bottom:2px solid #111;font-size:10pt;letter-spacing:.05em;text-transform:uppercase}.people{display:grid;grid-template-columns:1fr 1fr;gap:7px}.person{padding:8px 9px;border:1px solid #888;border-radius:5px;break-inside:avoid}.person-main{display:grid;grid-template-columns:1.2fr 1fr 1fr;gap:8px}.person-main strong{font-size:10pt}.person-main span{font-size:9pt}.person-last{margin-top:5px;color:#555;font-size:8.5pt}.todo{display:grid;grid-template-columns:18px 1fr;gap:7px;align-items:start;padding:4px 0}.box{width:15px;height:15px;display:grid;place-items:center;border:1.5px solid #111;font-size:9pt;font-weight:900}.todo.done{color:#666;text-decoration:line-through}.event{padding:7px 0;border-bottom:1px solid #aaa;break-inside:avoid}.event-head{display:flex;gap:10px;align-items:baseline}.event-head strong{font-size:9pt}.event-head span{font-size:8.5pt;color:#555}.event-note{margin-top:3px}.empty{color:#666;font-style:italic}.office-line{height:29px;border-bottom:1px solid #777}.footer{margin-top:12px;padding-top:6px;border-top:1px solid #aaa;color:#666;font-size:8pt;text-align:right}@media print{html{background:#fff}body{width:auto;margin:0;padding:0;box-shadow:none}.actions{display:none}}</style></head><body><div class="actions"><button onclick="window.close()">Close</button><button class="print" onclick="window.print()">Print</button></div><header class="top"><div><div class="office">Unified Title &amp; Escrow</div><h1>'+esc(ws.fileNumber||"File")+'</h1><div class="address">'+esc(ws.address||"No property address")+'</div></div><div class="track">'+(ws.tracked?'TRACKING':'NOT TRACKING')+'</div></header><section class="section"><h2>People Connected to This File</h2><div class="people">'+contacts+'</div></section><section class="section"><h2>To-Do List</h2>'+todos+'</section><section class="section"><h2>File Notes / Activity</h2>'+events+'</section><section class="section"><h2>Office Notes</h2>'+lines+'</section><div class="footer">Printed '+esc(new Date().toLocaleString())+'</div></body></html>');popup.document.close();
}

function wire(){
  refreshMainCopy();
  var contactList=el("contactList");
  if(contactList)contactList.addEventListener("click",function(event){var card=event.target.closest(".contact-card");if(!card)return;var button=card.querySelector("[data-edit-contact]");if(button){event.preventDefault();event.stopPropagation();openPerson(button.dataset.editContact);}});
  var add=el("addContactButton");if(add)add.addEventListener("click",function(event){if(bypassAddPerson)return;event.preventDefault();event.stopImmediatePropagation();openPerson("");},true);
  el("closePersonModal").onclick=closePerson;el("donePersonModal").onclick=closePerson;el("personModal").addEventListener("click",function(event){if(event.target===el("personModal"))closePerson();});
  el("savePersonDetails").onclick=savePersonDetails;el("savePersonLog").onclick=savePersonLog;el("cancelPersonLogEdit").onclick=cancelPersonEventEdit;
  el("personHistory").addEventListener("click",function(event){var button=event.target.closest("[data-person-edit-event]");if(button)beginEditPersonEvent(button.dataset.personEditEvent);});
  var print=el("printCase");if(print)print.addEventListener("click",function(event){event.preventDefault();event.stopImmediatePropagation();printSheet();},true);
  document.addEventListener("keydown",function(event){if(event.key==="Escape"&&el("personModal").classList.contains("show")){event.stopPropagation();closePerson();}},true);
  var observer=new MutationObserver(refreshMainCopy);observer.observe(document.body,{childList:true,subtree:true,characterData:true});
}

wire();
})();
