(function(){
"use strict";

var pendingCaseImports=[];
var caseImportSource="";

function ciEsc(value){
  return String(value==null?"":value).replace(/[&<>"']/g,function(ch){
    return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[ch];
  });
}
function ciKey(value){return String(value||"").toLowerCase().replace(/[^a-z0-9]/g,"");}
function ciCaseNumber(value){return String(value||"").trim().toUpperCase().replace(/\s+/g,"");}
function ciValue(record,aliases){
  var entries=Object.entries(record||{});
  for(var i=0;i<aliases.length;i++){
    var wanted=ciKey(aliases[i]);
    for(var j=0;j<entries.length;j++)if(ciKey(entries[j][0])===wanted)return {present:true,value:entries[j][1]};
  }
  return {present:false,value:""};
}
function ciDate(value){
  var text=String(value||"").trim();
  if(!text)return "";
  var iso=text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if(iso)return iso[1]+"-"+iso[2]+"-"+iso[3];
  var us=text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/);
  if(us){var year=us[3].length===2?"20"+us[3]:us[3];return year+"-"+us[1].padStart(2,"0")+"-"+us[2].padStart(2,"0");}
  return text;
}

var FIELD_DEFS=[
  {field:"address",label:"Address",aliases:["Address","Property Address","Address Line 1"]},
  {field:"type",label:"Transaction Type",aliases:["Transaction Type","Type"]},
  {field:"assigned",label:"Title Searcher",aliases:["Title Searcher","Title Searcher Full Name","Assigned Person","Assigned","Assigned To"]},
  {field:"status",label:"Status",aliases:["Current Status","Status","Transcript Status"]},
  {field:"nextAction",label:"Next Step",aliases:["Next Action","Next Step","Next Step / What Is Needed","To-Do List"]},
  {field:"priority",label:"Priority",aliases:["Priority"]},
  {field:"targetDate",label:"Search Due Date",aliases:["Target Date","Search Due Date","Due Date"],date:true},
  {field:"closingDate",label:"Closing Date",aliases:["Closing Date","Close Date"],date:true}
];

function normalizeImportRecord(record){
  var number=ciValue(record,["Case Number","Order Number","File Number","Number","caseNumber","number"]);
  var out={number:ciCaseNumber(number.value),fields:{},runningNotes:""};
  FIELD_DEFS.forEach(function(def){
    var found=ciValue(record,[def.field].concat(def.aliases));
    if(!found.present)return;
    var value=found.value==null?"":String(found.value).trim();
    if(!value)return;
    if(def.date)value=ciDate(value);
    out.fields[def.field]=value;
  });
  var notes=ciValue(record,["runningNotes","Running File Notes","Running File Record","Notes","File Notes"]);
  if(notes.present&&String(notes.value||"").trim())out.runningNotes=String(notes.value).trim();
  return out;
}

function parseCaseUpdateText(text,name){
  var trimmed=String(text||"").trim();
  if(!trimmed)throw new Error("The selected file is empty.");
  if(/\.json$/i.test(name)||trimmed.charAt(0)==="{"||trimmed.charAt(0)==="["){
    var data=JSON.parse(trimmed),jsonRows=Array.isArray(data)?data:data.cases;
    if(!Array.isArray(jsonRows))throw new Error("The JSON file must contain a cases array.");
    return jsonRows;
  }
  var rows=parseCSV(trimmed);
  if(rows.length<2)throw new Error("The CSV or text file does not contain any case rows.");
  var headers=rows[0].map(function(value){return String(value||"").trim();});
  return rows.slice(1).filter(function(row){return row.some(function(value){return String(value||"").trim();});}).map(function(row){
    var item={};headers.forEach(function(header,index){item[header]=row[index]||"";});return item;
  });
}

function prepareCaseImport(records,source){
  var missing=0;
  pendingCaseImports=(records||[]).map(normalizeImportRecord).filter(function(record){
    if(!record.number){missing++;return false;}return true;
  }).map(function(record){
    var matches=cases.filter(function(item){return ciCaseNumber(item.number)===record.number;});
    var existing=matches.length===1?matches[0]:null;
    var changes=[];
    Object.keys(record.fields).forEach(function(field){
      var value=record.fields[field];
      if(!existing||String(existing[field]||"")!==String(value)){
        var def=FIELD_DEFS.find(function(item){return item.field===field;});
        changes.push({field:field,label:def?def.label:field,value:value,old:existing?existing[field]||"":""});
      }
    });
    if(record.runningNotes&&(!existing||String(existing.notes||"").indexOf(record.runningNotes)===-1))changes.push({field:"runningNotes",label:"Running File Notes",value:record.runningNotes,old:""});
    return {record:record,existing:existing,duplicate:matches.length>1,changes:changes,selected:matches.length<=1&&changes.length>0};
  });
  caseImportSource=source||"uploaded case update";
  renderCaseImportPreview(missing);
  document.getElementById("caseImportWrap").classList.add("show");
}

function renderCaseImportPreview(missing){
  var body=document.getElementById("caseImportRows"),existing=0,added=0,conflicts=0,selected=0;
  body.innerHTML=pendingCaseImports.map(function(item,index){
    if(item.duplicate)conflicts++;else if(item.existing)existing++;else added++;
    if(item.selected)selected++;
    var state=item.duplicate?'<span class="case-import-conflict">Duplicate case number—review manually</span>':item.existing?"Update existing case":"Add new case";
    var details=item.changes.length?item.changes.map(function(change){
      var before=change.old?'<span class="case-import-muted"> (was '+ciEsc(change.old)+')</span>':"";
      return '<span class="case-import-change"><b>'+ciEsc(change.label)+':</b> '+ciEsc(change.value)+before+'</span>';
    }).join(""):'<span class="case-import-muted">No changes found</span>';
    return '<tr><td><input type="checkbox" data-import-index="'+index+'" '+(item.selected?"checked":"")+' '+(item.duplicate||!item.changes.length?"disabled":"")+' onchange="caseImportSelectionChanged(this)"></td><td><strong>'+ciEsc(item.record.number)+'</strong><br><span class="case-import-muted">'+state+'</span></td><td>'+ciEsc(item.record.fields.address||(item.existing&&item.existing.address)||"")+'</td><td>'+details+'</td></tr>';
  }).join("");
  document.getElementById("caseImportExisting").textContent=existing;
  document.getElementById("caseImportNew").textContent=added;
  document.getElementById("caseImportConflicts").textContent=conflicts;
  document.getElementById("caseImportSelected").textContent=selected;
  document.getElementById("caseImportApply").disabled=!selected;
  document.getElementById("caseImportStatus").textContent=(caseImportSource?"Source: "+caseImportSource+". ":"")+(missing?missing+" row(s) without a case number were skipped. ":"")+"Blank cells do not erase existing tracker information.";
}

window.caseImportSelectionChanged=function(box){
  var index=Number(box.dataset.importIndex);
  if(pendingCaseImports[index])pendingCaseImports[index].selected=box.checked;
  var count=pendingCaseImports.filter(function(item){return item.selected;}).length;
  document.getElementById("caseImportSelected").textContent=count;
  document.getElementById("caseImportApply").disabled=!count;
};
window.closeCaseImport=function(){document.getElementById("caseImportWrap").classList.remove("show");pendingCaseImports=[];caseImportSource="";};
window.openCaseImport=function(){
  if(document.getElementById("dashboardMenu").classList.contains("show"))toggleDashboardMenu(false);
  document.getElementById("caseUpdateFile").click();
};
window.handleCaseUpdateFile=async function(event){
  var file=event.target.files[0];event.target.value="";if(!file)return;
  try{prepareCaseImport(parseCaseUpdateText(await file.text(),file.name),file.name);}catch(error){alert("That case-update file could not be read: "+error.message);}
};
window.loadPreparedCaseUpdates=async function(){
  try{
    document.getElementById("caseImportStatus").textContent="Loading the prepared August 26 update…";
    var response=await fetch("imports/active-case-updates-2026-08-26.json",{cache:"no-store"});
    if(!response.ok)throw new Error("The prepared update file is unavailable.");
    var data=await response.json();
    prepareCaseImport(Array.isArray(data)?data:data.cases,"Prepared August 26, 2026 update");
  }catch(error){alert(error.message);}
};
window.applyCaseImport=function(){
  var chosen=pendingCaseImports.filter(function(item){return item.selected&&!item.duplicate;});
  if(!chosen.length)return;
  var changed=0,created=0,stamp=nowISO(),user=currentOfficeUser();
  chosen.forEach(function(item){
    var target=item.existing;
    if(!target){target=normalizeCase({number:item.record.number,type:"Title Search",assigned:"Unassigned",status:"Not Started",priority:"Normal"});cases.push(target);created++;}
    item.changes.forEach(function(change){
      if(change.field==="runningNotes"){
        if(String(target.notes||"").indexOf(change.value)===-1)target.notes=target.notes?target.notes+"\n\n"+change.value:change.value;
      }else target[change.field]=change.value;
    });
    touchCase(target,stamp);
    target.history=Array.isArray(target.history)?target.history:[];
    target.history.push({id:uid(),at:stamp,by:user,text:"Imported case update from "+caseImportSource+": "+item.changes.map(function(change){return change.label;}).join(", ")});
    changed++;
  });
  save(true);refreshFilters();render();closeCaseImport();
  toast(changed+" case"+(changed===1?"":"s")+" updated"+(created?" ("+created+" new)":""));
};

function installCaseImporter(){
  var input=document.createElement("input");
  input.id="caseUpdateFile";input.className="file-input";input.type="file";input.accept=".json,.csv,.txt,application/json,text/csv,text/plain";
  input.addEventListener("change",handleCaseUpdateFile);document.body.appendChild(input);
  document.body.insertAdjacentHTML("beforeend",'<div id="caseImportWrap" class="modal-backdrop case-import-backdrop" role="dialog" aria-modal="true" aria-labelledby="caseImportTitle"><div class="modal case-import-modal"><h2 id="caseImportTitle">Import Case Updates</h2><p class="case-import-intro">Review a CSV, JSON, or text-based case update before merging it into the shared tracker. Cases are matched by case number. Unrelated cases are never replaced.</p><div class="case-import-actions"><button type="button" onclick="document.getElementById(&quot;caseUpdateFile&quot;).click()">Choose Update File</button><button type="button" class="gold" onclick="loadPreparedCaseUpdates()">Use Prepared Aug. 26 Update</button></div><div id="caseImportStatus" class="case-import-status"></div><div class="case-import-summary"><div><strong id="caseImportExisting">0</strong><span>Existing Matches</span></div><div><strong id="caseImportNew">0</strong><span>New Cases</span></div><div><strong id="caseImportConflicts">0</strong><span>Conflicts</span></div><div><strong id="caseImportSelected">0</strong><span>Selected</span></div></div><div class="case-import-table-wrap"><table class="case-import-table"><thead><tr><th>Use</th><th>Case</th><th>Address</th><th>Proposed Changes</th></tr></thead><tbody id="caseImportRows"></tbody></table></div><div class="case-import-footer"><button type="button" class="secondary" onclick="closeCaseImport()">Cancel</button><button id="caseImportApply" type="button" onclick="applyCaseImport()" disabled>Apply Selected Updates</button></div></div></div>');
  var actions=document.querySelector(".dashboard-actions"),button=document.createElement("button");
  button.type="button";button.className="secondary";button.textContent="Import Case Updates";button.addEventListener("click",openCaseImport);
  var addButton=actions&&actions.querySelector(".gold");if(actions)actions.insertBefore(button,addButton||null);
  document.getElementById("caseImportWrap").addEventListener("click",function(event){if(event.target.id==="caseImportWrap")closeCaseImport();});
}

installCaseImporter();

/* Dylan-only personal landing page. Other authenticated users are left unchanged. */
(function installDylanPersonalHome(){
  var DYLAN_EMAIL="dylan.sprouse@unifiedtitle.net";
  var homeInstalled=false;
  var trackerVisible=false;

  function signedInEmail(){
    var node=document.getElementById("cloudUserEmail");
    return String(node&&node.textContent||"").trim().toLowerCase();
  }
  function isDylan(){return signedInEmail()===DYLAN_EMAIL;}

  function addStyles(){
    if(document.getElementById("dylanHomeStyles"))return;
    var style=document.createElement("style");
    style.id="dylanHomeStyles";
    style.textContent=".dylan-home{display:none;position:fixed;inset:0;z-index:180;background:linear-gradient(145deg,#eef3f9,#f8fafc);align-items:center;justify-content:center;padding:24px}.dylan-home.show{display:flex}.dylan-home-shell{width:min(900px,100%);text-align:center}.dylan-home-kicker{color:#a2730c;font-size:.75rem;font-weight:900;letter-spacing:.12em;text-transform:uppercase}.dylan-home h1{margin:8px 0 8px;color:#0b315f;font-size:clamp(2rem,5vw,3.2rem)}.dylan-home p{margin:0 auto 28px;max-width:600px;color:#68768b;line-height:1.55}.dylan-home-grid{display:grid;grid-template-columns:1fr 1fr;gap:20px}.dylan-home-card{min-height:230px;padding:28px;border:2px solid #c5d2e0;border-radius:22px;background:#fff;color:#17345e;box-shadow:0 14px 36px rgba(20,47,82,.10);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:11px;cursor:pointer;transition:.18s ease}.dylan-home-card:hover{transform:translateY(-3px);border-color:#8fa9c4;box-shadow:0 20px 44px rgba(20,47,82,.16);filter:none}.dylan-home-card .icon{width:64px;height:64px;display:grid;place-items:center;border-radius:17px;background:#edf4fb;color:#17345e;font-size:1.8rem;font-weight:900}.dylan-home-card strong{font-size:1.35rem}.dylan-home-card small{max-width:280px;color:#6c7b91;font-size:.85rem;line-height:1.45}.dylan-home-card.toolbox .icon{background:#fff4d8;color:#8a650b}.dylan-toolbox-panel{display:none;margin-top:20px;padding:28px;border:1px solid #cad6e3;border-radius:20px;background:#fff;box-shadow:0 12px 34px rgba(20,47,82,.09);text-align:left}.dylan-toolbox-panel.show{display:block}.dylan-toolbox-panel h2{margin:0 0 8px;color:#17345e}.dylan-toolbox-panel p{margin:0 0 18px}.dylan-home-actions{display:flex;justify-content:center;gap:10px;margin-top:20px}.dylan-home-actions button{min-width:130px}.dylan-back-home{display:none!important}.dylan-back-home.show{display:flex!important;align-items:center;gap:7px}@media(max-width:650px){.dylan-home{padding:16px;align-items:flex-start;overflow:auto}.dylan-home-shell{padding-top:34px}.dylan-home-grid{grid-template-columns:1fr}.dylan-home-card{min-height:170px}.dylan-home h1{font-size:2rem}}";
    document.head.appendChild(style);
  }

  function ensureHome(){
    if(homeInstalled)return;
    addStyles();
    var home=document.createElement("div");
    home.id="dylanPersonalHome";
    home.className="dylan-home";
    home.innerHTML='<div class="dylan-home-shell"><div class="dylan-home-kicker">Unified Title &amp; Escrow</div><h1>Dylan\'s Workspace</h1><p>Choose where you want to go.</p><div id="dylanHomeGrid" class="dylan-home-grid"><button id="dylanTrackerCard" type="button" class="dylan-home-card"><span class="icon">T</span><strong>Title Search Tracker</strong><small>Open the shared title-search board and case workflow.</small></button><button id="dylanToolboxCard" type="button" class="dylan-home-card toolbox"><span class="icon">⚒</span><strong>Dylans Tool Box</strong><small>Open your personal tools area.</small></button></div><section id="dylanToolboxPanel" class="dylan-toolbox-panel"><h2>Dylans Tool Box</h2><p>This area is ready for the personal tools we add next. It is visible only when signed in with Dylan\'s account.</p><button id="dylanToolboxBack" type="button" class="secondary">← Back to Home</button></section><div class="dylan-home-actions"><button id="dylanHomeSignOut" type="button" class="secondary">Sign Out</button></div></div>';
    document.body.appendChild(home);
    document.getElementById("dylanTrackerCard").addEventListener("click",openTracker);
    document.getElementById("dylanToolboxCard").addEventListener("click",openToolbox);
    document.getElementById("dylanToolboxBack").addEventListener("click",showHomeCards);
    document.getElementById("dylanHomeSignOut").addEventListener("click",function(){cloudSignOut();});
    var topButtons=document.querySelector(".topbar-buttons");
    if(topButtons&&!document.getElementById("dylanBackHome")){
      var back=document.createElement("button");
      back.id="dylanBackHome";
      back.type="button";
      back.className="secondary dylan-back-home";
      back.textContent="← My Home";
      back.addEventListener("click",showPersonalHome);
      topButtons.insertBefore(back,topButtons.firstChild);
    }
    homeInstalled=true;
  }

  function showHomeCards(){
    var grid=document.getElementById("dylanHomeGrid"),panel=document.getElementById("dylanToolboxPanel");
    if(grid)grid.style.display="grid";
    if(panel)panel.classList.remove("show");
  }
  function showPersonalHome(){
    if(!isDylan())return;
    ensureHome();
    trackerVisible=false;
    showHomeCards();
    document.getElementById("dylanPersonalHome").classList.add("show");
    var back=document.getElementById("dylanBackHome");if(back)back.classList.remove("show");
  }
  function openTracker(){
    trackerVisible=true;
    var home=document.getElementById("dylanPersonalHome");if(home)home.classList.remove("show");
    var back=document.getElementById("dylanBackHome");if(back)back.classList.add("show");
  }
  function openToolbox(){
    trackerVisible=true;
    var grid=document.getElementById("dylanHomeGrid"),panel=document.getElementById("dylanToolboxPanel");
    if(grid)grid.style.display="none";
    if(panel)panel.classList.add("show");
  }
  function checkSession(){
    if(isDylan()){
      ensureHome();
      if(!trackerVisible)showPersonalHome();
    }
  }

  var attempts=0;
  var timer=setInterval(function(){
    attempts++;
    if(signedInEmail()){
      clearInterval(timer);
      checkSession();
    }else if(attempts>200){clearInterval(timer);}
  },100);
  setInterval(checkSession,1000);
})();
})();
