from pathlib import Path
import re

js_path = Path("tracker/call-tracker.js")
css_path = Path("tracker/call-tracker-layout.css")
html_path = Path("tracker/index.html")

js = js_path.read_text(encoding="utf-8").replace("\r\n", "\n")

if 'var CONTACT_STORAGE_KEY=' not in js:
    js = js.replace(
        'var STORAGE_KEY="utei.dylan.callTracker.v1";',
        'var STORAGE_KEY="utei.dylan.callTracker.v1";\nvar CONTACT_STORAGE_KEY="utei.dylan.callContacts.v1";',
        1,
    )
if 'var contacts=[];' not in js:
    js = js.replace('var calls=[];', 'var calls=[];\nvar contacts=[];', 1)

memory_block = r'''/* CALL CONTACT MEMORY START */
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
'''

js = re.sub(
    r'/\* CALL CONTACT MEMORY START \*/.*?/\* CALL CONTACT MEMORY END \*/\n?',
    '',
    js,
    flags=re.S,
)
load_marker = 'function load(){'
pos = js.find(load_marker)
if pos == -1:
    raise SystemExit('Could not find load function')
js = js[:pos] + memory_block + '\n' + js[pos:]

load_pattern = re.compile(
    r'function load\(\)\{try\{var data=JSON\.parse\(localStorage\.getItem\(STORAGE_KEY\)\|\|"\[\]"\);calls=Array\.isArray\(data\)\?data:\[\];\}catch\(e\)\{calls=\[\];\}\}'
)
replacement_load = '''function load(){
  try{var data=JSON.parse(localStorage.getItem(STORAGE_KEY)||"[]");calls=Array.isArray(data)?data:[];}catch(e){calls=[];}
  calls.forEach(function(record){if(record.phone)record.phone=formatPhone(record.phone);});
  loadContacts();
}'''
if load_pattern.search(js):
    js = load_pattern.sub(replacement_load, js, count=1)
elif 'loadContacts();' not in js:
    raise SystemExit('Could not update load function')

old_install = 'installModal();installCallWizard();buildTabs();'
new_install = 'installModal();installCallWizard();installCallerMemory();buildTabs();'
if old_install in js:
    js = js.replace(old_install, new_install, 1)
elif new_install not in js:
    raise SystemExit('Could not install caller memory')

old_phone = 'phone:field("ctPhone").value.trim()'
new_phone = 'phone:formatPhone(field("ctPhone").value)'
if old_phone in js:
    js = js.replace(old_phone, new_phone, 1)
elif new_phone not in js:
    raise SystemExit('Could not format stored phone values')

old_caller_display = '''<div class="call-muted">'+esc(r.phone||r.companyRole||"")+'</div>'''
new_caller_display = '''<div class="call-muted">'+esc([r.companyRole,r.phone].filter(Boolean).join(" · "))+'</div>'''
if old_caller_display in js:
    js = js.replace(old_caller_display, new_caller_display, 1)
elif new_caller_display not in js:
    raise SystemExit('Could not expand caller display')

if 'rememberContact(record);persist();' not in js:
    save_marker = '}persist();render();renderHistory(record);'
    if save_marker not in js:
        raise SystemExit('Could not find save marker')
    js = js.replace(
        save_marker,
        '}rememberContact(record);persist();render();renderHistory(record);',
        1,
    )

js_path.write_text(js, encoding='utf-8')

css = css_path.read_text(encoding='utf-8').replace('\r\n', '\n')
contact_css = '''
.call-contact-quick{display:flex;flex-wrap:wrap;gap:7px;margin-top:9px}
.call-contact-chip{display:flex;flex-direction:column;align-items:flex-start;gap:2px;max-width:190px;padding:7px 10px;border:1px solid #bfd0e0;border-radius:10px;background:#fff;color:#17345e;text-align:left;box-shadow:none}
.call-contact-chip:hover{background:#edf5fd;border-color:#8daac5;filter:none}
.call-contact-chip strong{max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:.78rem}
.call-contact-chip span{max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#6d7d92;font-size:.68rem;font-weight:750}
'''
if '.call-contact-quick{' not in css:
    css += '\n' + contact_css
css_path.write_text(css, encoding='utf-8')

html = html_path.read_text(encoding='utf-8').replace('\r\n', '\n')
if 'call-tracker-layout.css' not in html:
    html = html.replace(
        '</head>',
        '<link rel="stylesheet" href="call-tracker-layout.css?v=call-board-20260827-1">\n</head>',
        1,
    )
else:
    html = re.sub(
        r'<link rel="stylesheet" href="call-tracker-layout\.css[^\"]*">',
        '<link rel="stylesheet" href="call-tracker-layout.css?v=call-board-20260827-1">',
        html,
        count=1,
    )
html, count = re.subn(
    r'<script src="call-tracker\.js[^\"]*"></script>',
    '<script src="call-tracker.js?v=contacts-layout-20260827-1"></script>',
    html,
    count=1,
)
if count != 1:
    raise SystemExit('Could not update call tracker script version')
html_path.write_text(html, encoding='utf-8')

print('Call tracker contact memory and layout enhancement applied.')
