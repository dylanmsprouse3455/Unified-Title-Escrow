from pathlib import Path
import re

js_path = Path("tracker/call-tracker.js")
js = js_path.read_text(encoding="utf-8").replace("\r\n", "\n")

if 'var callWizardStep=1;' not in js:
    marker = 'var editingId="";'
    if marker not in js:
        raise SystemExit("Could not find call tracker state marker")
    js = js.replace(marker, marker + '\nvar callWizardStep=1;', 1)

wizard_css = r'''
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
'''

css_marker = '@media print{.call-tracker-app{display:none!important}}'
if '.call-wizard-progress{' not in js:
    if css_marker not in js:
        raise SystemExit("Could not find call tracker style marker")
    js = js.replace(css_marker, wizard_css + '\n' + css_marker, 1)

if 'installModal();installCallWizard();buildTabs();' not in js:
    old = 'installModal();buildTabs();'
    if old not in js:
        raise SystemExit("Could not find modal installation marker")
    js = js.replace(old, 'installModal();installCallWizard();buildTabs();', 1)

wizard_block = r'''
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

  oldSections.forEach(function(section){if(section.parentNode)section.remove();});
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
'''

wizard_pattern = re.compile(r'/\* CALL WIZARD START \*/.*?/\* CALL WIZARD END \*/\n?', re.S)
js = wizard_pattern.sub("", js)
boot_marker = 'function boot(){'
if boot_marker not in js:
    raise SystemExit("Could not find call tracker boot marker")
js = js.replace(boot_marker, wizard_block + '\n' + boot_marker, 1)

js_path.write_text(js, encoding="utf-8")

html_path = Path("tracker/index.html")
html = html_path.read_text(encoding="utf-8").replace("\r\n", "\n")
html = re.sub(
    r'<script src="call-tracker\.js[^"]*"></script>',
    '<script src="call-tracker.js?v=call-wizard-20260827-2"></script>',
    html,
    count=1
)
html_path.write_text(html, encoding="utf-8")
