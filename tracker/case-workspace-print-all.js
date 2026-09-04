(function(){
"use strict";

var STORAGE_KEY="utei.dylan.callTracker.v1";

function el(id){return document.getElementById(id);}
function clean(value){return String(value==null?"":value).trim();}
function esc(value){return String(value==null?"":value).replace(/[&<>"']/g,function(ch){return{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[ch];});}
function localDate(value){if(!value)return"No date";var d=new Date(String(value).length===10?value+"T12:00:00":value);return isNaN(d)?value:d.toLocaleDateString(undefined,{month:"short",day:"numeric",year:"numeric"});}
function readRecords(){try{var parsed=JSON.parse(localStorage.getItem(STORAGE_KEY)||"[]");return Array.isArray(parsed)?parsed:[];}catch(_error){return[];}}
function uniqueWorkspaces(){
  var seen=new Set(),list=[];
  readRecords().forEach(function(record){
    var ws=record&&record.workspaceCase;
    if(!ws||!ws.id||seen.has(ws.id))return;
    seen.add(ws.id);list.push(ws);
  });
  return list.sort(function(a,b){return clean(a.fileNumber).localeCompare(clean(b.fileNumber),undefined,{numeric:true,sensitivity:"base"})||clean(a.address).localeCompare(clean(b.address));});
}
function contactName(ws,id){var c=(ws.contacts||[]).find(function(item){return item.id===id;});return c?clean(c.name):"General File Note";}
function openTodo(ws){var todo=(ws.todos||[]).find(function(item){return !item.completed;});return todo?clean(todo.text):"No open to-do items";}
function renderCase(ws){
  var contacts=(ws.contacts||[]).map(function(c){
    var events=(ws.events||[]).filter(function(e){return e.contactId===c.id;}).sort(function(a,b){return String(b.eventDate||"").localeCompare(String(a.eventDate||""))||String(b.createdAt||"").localeCompare(String(a.createdAt||""));});
    var last=events[0];
    return'<div class="person"><div class="person-main"><strong>'+esc(c.name||"Unnamed contact")+'</strong><span>'+esc(c.role||"Relationship not entered")+'</span><span>'+esc(c.phone||"Phone not entered")+'</span></div><div class="person-last">'+esc(last?"Last interaction: "+localDate(last.eventDate):"No interaction logged")+'</div></div>';
  }).join("")||'<div class="empty">No people recorded.</div>';
  var todos=(ws.todos||[]).map(function(t){return'<div class="todo '+(t.completed?'done':'')+'"><span class="box">'+(t.completed?'✓':'')+'</span><span>'+esc(t.text)+'</span></div>';}).join("")||'<div class="empty">No to-do items recorded.</div>';
  var events=(ws.events||[]).slice().sort(function(a,b){return String(b.eventDate||"").localeCompare(String(a.eventDate||""))||String(b.createdAt||"").localeCompare(String(a.createdAt||""));}).map(function(e){return'<div class="event"><div class="event-head"><strong>'+esc(localDate(e.eventDate))+'</strong><span>'+esc(e.contactId?contactName(ws,e.contactId):"General File Note")+'</span></div><div class="event-note">'+esc(e.note||"").replace(/\n/g,"<br>")+'</div></div>';}).join("")||'<div class="empty">No file notes recorded.</div>';
  var lines=new Array(9).fill('<div class="office-line"></div>').join("");
  return'<section class="case-page"><header class="top"><div><div class="office">Unified Title &amp; Escrow</div><h1>'+esc(ws.fileNumber||"File")+'</h1><div class="address">'+esc(ws.address||"No property address")+'</div></div><div class="track">'+(ws.tracked?'TRACKING':'NOT TRACKING')+'</div></header><section class="next"><span>NEXT ACTION</span><strong>'+esc(openTodo(ws))+'</strong></section><section class="section"><h2>People Connected to This File</h2><div class="people">'+contacts+'</div></section><section class="section"><h2>To-Do List</h2>'+todos+'</section><section class="section"><h2>File Notes / Activity</h2>'+events+'</section><section class="section"><h2>Office Notes</h2>'+lines+'</section><div class="footer">Case Workspace · '+esc(ws.fileNumber||"File")+'</div></section>';
}
function printAll(){
  var workspaces=uniqueWorkspaces();if(!workspaces.length){alert("There are no Case Workspace files to print.");return;}
  var popup=window.open("","utei-case-workspace-print-all","width=980,height=1000");if(!popup){alert("Please allow pop-ups to open the full case packet.");return;}
  var sheets=workspaces.map(renderCase).join("");
  popup.document.write('<!doctype html><html><head><meta charset="utf-8"><title>All Case Workspace Files</title><style>@page{size:letter;margin:.45in}*{box-sizing:border-box}html{background:#e9edf1}body{margin:0;color:#111;font:10.5pt Arial,sans-serif;line-height:1.35}.packet-actions{position:fixed;right:18px;bottom:18px;z-index:5;display:flex;gap:8px}.packet-actions button{padding:10px 14px;border:2px solid #111;background:#fff;font-weight:800}.packet-actions .print{background:#111;color:#fff}.case-page{width:min(8.5in,100%);margin:18px auto;padding:.42in;background:#fff;box-shadow:0 4px 22px rgba(0,0,0,.14);break-after:page;page-break-after:always}.case-page:last-of-type{break-after:auto;page-break-after:auto}.top{display:grid;grid-template-columns:1fr auto;gap:16px;align-items:start;padding-bottom:12px;border-bottom:4px solid #111}.office{font-size:8pt;font-weight:900;letter-spacing:.09em;text-transform:uppercase}.top h1{margin:4px 0 2px;font-size:23pt}.address{font-size:11.5pt;overflow-wrap:anywhere}.track{padding:7px 10px;border:2px solid #111;font-size:9pt;font-weight:900;letter-spacing:.06em}.next{margin-top:12px;padding:10px 12px;border:2px solid #111;break-inside:avoid}.next span{display:block;font-size:8pt;font-weight:900;letter-spacing:.08em}.next strong{display:block;margin-top:3px;font-size:12pt;white-space:pre-wrap;overflow-wrap:anywhere}.section{margin-top:15px}.section h2{margin:0 0 7px;padding-bottom:4px;border-bottom:2px solid #111;font-size:10pt;letter-spacing:.05em;text-transform:uppercase}.people{display:grid;grid-template-columns:1fr 1fr;gap:7px}.person{padding:8px 9px;border:1px solid #888;border-radius:5px;break-inside:avoid}.person-main{display:grid;grid-template-columns:1.2fr 1fr 1fr;gap:8px}.person-main strong,.person-main span{overflow-wrap:anywhere}.person-main strong{font-size:10pt}.person-main span{font-size:9pt}.person-last{margin-top:5px;color:#555;font-size:8.5pt}.todo{display:grid;grid-template-columns:18px 1fr;gap:7px;align-items:start;padding:4px 0;break-inside:avoid}.box{width:15px;height:15px;display:grid;place-items:center;border:1.5px solid #111;font-size:9pt;font-weight:900}.todo.done{color:#666;text-decoration:line-through}.event{padding:7px 0;border-bottom:1px solid #aaa;break-inside:avoid}.event-head{display:flex;gap:10px;align-items:baseline}.event-head strong{font-size:9pt}.event-head span{font-size:8.5pt;color:#555}.event-note{margin-top:3px;white-space:normal;overflow-wrap:anywhere}.empty{color:#666;font-style:italic}.office-line{height:29px;border-bottom:1px solid #777}.footer{margin-top:12px;padding-top:6px;border-top:1px solid #aaa;color:#666;font-size:8pt;text-align:right}@media(max-width:650px){.people{grid-template-columns:1fr}.person-main{grid-template-columns:1fr}}@media print{html{background:#fff}body{background:#fff}.case-page{width:auto;margin:0;padding:0;box-shadow:none}.packet-actions{display:none}}</style></head><body>'+sheets+'<div class="packet-actions"><button type="button" onclick="window.close()">Close</button><button type="button" class="print" onclick="window.print()">Print All '+workspaces.length+' Cases</button></div></body></html>');
  popup.document.close();popup.focus();
}

var button=el("printAllCases");if(button)button.addEventListener("click",printAll);
})();
