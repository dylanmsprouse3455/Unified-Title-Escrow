(function(){
  'use strict';

  var NOTICES={
    documentPreparation:'FYI - DOCUMENT PREPARATION FEES NECESSARY TO CLEAR TITLE MAY BE CHARGED, BUT UNKNOWN UNTIL TITLE SEARCH IS COMPLETED',
    manufacturedHome:'FYI - MANUFACTURED HOME TITLE WORK IS QUOTED ON A PER-FILE BASIS (Unless the MH title has been de-titled with the State of Tennessee, our de-title fees start at $150.00)',
    remoteNotary:'FYI - ANY REMOTE NOTARY SERVICES WILL INCUR AN ADDITIONAL FEE OF $200.00+ PER SERVICE'
  };

  var TYPES=[
    {id:'loan-purchase',name:'Loan Purchase',group:'Standard',icon:'LP',basis:['salesPrice','loanAmount'],fields:['lenderPolicy','ownerTitle','deedTax','mortgageTax'],fees:[['Title - CPL Fee',50],['Title - Settlement Fee',450],['Title - Title Search Fee',300],['Recording Fee',116,'est']],notices:['manufacturedHome','remoteNotary']},
    {id:'refinance',name:'Refinance',group:'Standard',icon:'RF',basis:['loanAmount'],fields:['lenderPolicy','mortgageTax'],fees:[['Title - CPL Fee',50],['Title - Settlement Fee',450],['Title - Title Search Fee',300],['Recording Fee',103,'est']],notices:['documentPreparation','manufacturedHome','remoteNotary']},
    {id:'reverse',name:'Reverse Mortgage',group:'Standard',icon:'RM',basis:['appraisedValue'],fields:['lenderPolicy'],fees:[['Closing Fee',500],['Title Search Fee',300],['CPL Fee',50],['Mortgage Recording Fee',159,'est'],['Mortgage Tax','N/A']],notices:['documentPreparation','manufacturedHome','remoteNotary']},
    {id:'cash-purchase',name:'Cash Purchase',group:'Standard',icon:'CP',basis:['salesPrice'],fields:['ownerInsurance','deedTax'],decisions:['payoffNeeded'],fees:[['Buyer Closing Fee',175],['Title Search Fee',300],['Deed Recording Fee',13],['Seller Closing Fee',175],['Deed Preparation Fee',150]],notices:['manufacturedHome']},
    {id:'apex-purchase',name:'APEX Loan Purchase',group:'In-house lender',icon:'AP',inHouse:true,basis:['salesPrice','loanAmount'],fields:['lenderPolicy','ownerTitle','deedTax','mortgageTax'],fees:[['Title - CPL Fee',50],['Title - Settlement Fee',400],['Title - Title Search Fee',250],['Recording Fee',116,'est']],notices:['manufacturedHome','remoteNotary']},
    {id:'apex-refinance',name:'APEX Refinance',group:'In-house lender',icon:'AR',inHouse:true,basis:['loanAmount'],decisions:['apexClosing'],fields:['lenderPolicy','mortgageTax'],fees:[['Title - CPL Fee',50],['Title - Settlement Fee',350],['Title - Title Search Fee',250],['Recording Fee',103,'est']],notices:['documentPreparation','manufacturedHome','remoteNotary']},
    {id:'ccu-hcb-purchase',name:'CCU / HCB Loan Purchase',group:'In-house lender',icon:'CH',inHouse:true,basis:['salesPrice','loanAmount'],decisions:['cplRequired','lenderPolicyRequired','simultaneousIssue'],fields:['lenderPolicy','ownerTitle','deedTax','mortgageTax'],fees:[['Title - Settlement Fee',450],['Title - Title Search Fee',300],['Recording Fee',116,'est']],notices:['manufacturedHome','remoteNotary']},
    {id:'ccu-hcb-refinance',name:'CCU / HCB Refinance',group:'In-house lender',icon:'CR',inHouse:true,basis:['loanAmount'],decisions:['cplRequired','settlementRequired','lenderPolicyRequired'],fields:['lenderPolicy','mortgageTax'],fees:[['Title - Title Search Fee',300],['Recording Fee',103,'est']],notices:['documentPreparation','manufacturedHome','remoteNotary']},
    {id:'fsbo-purchase',name:'FSBO Loan Purchase',group:'Other',icon:'FS',basis:['salesPrice','loanAmount'],decisions:['payoffNeeded'],fields:['lenderPolicy','ownerTitle','deedTax','mortgageTax'],fees:[['Title - CPL Fee',50],['Title - Settlement Fee',450],['Title - Title Search Fee',300],['Recording Fee',116,'est'],['Seller Closing Fee',175],['Deed Preparation Fee',150]],notices:['manufacturedHome','remoteNotary']}
  ];

  var FIELD_DEFS={
    salesPrice:{label:'Purchase Price'},loanAmount:{label:'Loan Amount'},appraisedValue:{label:'Appraised Value'},
    lenderPolicy:{label:"Lender's Policy"},ownerInsurance:{label:"Owner's Title Insurance"},ownerTitle:{label:"Owner's Policy"},
    deedTax:{label:'Transfer Taxes (Deed)'},mortgageTax:{label:'Transfer Taxes (Mtg)'}
  };
  var DECISIONS={
    apexClosing:{label:'Is Unified closing the loan or only issuing title insurance?',choices:[['closing','Unified is closing'],['title-only','Title work / insurance only']]},
    apexTitleInsurance:{label:'Will title insurance be issued?',choices:[['yes','Yes - include premium'],['no','No - add final update fee']]},
    cplRequired:{label:'Is the CPL fee required?',choices:[['yes','Yes'],['no','No']]},
    settlementRequired:{label:'Is the settlement fee required?',choices:[['yes','Yes'],['no','No']]},
    lenderPolicyRequired:{label:"Is a lender's title policy required?",choices:[['yes','Yes'],['no','No']]},
    simultaneousIssue:{label:"Does the owner's policy use the simultaneous issue discount?",choices:[['yes','Yes'],['no','No']]},
    payoffNeeded:{label:'Is a payoff fee needed?',choices:[['yes','Yes'],['no','No']]}
  };
  var state={typeId:'',values:{},decisions:{}};

  function typeById(id){return TYPES.filter(function(type){return type.id===id})[0];}
  function money(value){
    if(value==='N/A')return 'N/A';
    var number=Number(value);
    return isFinite(number)?'$'+number.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2}):'';
  }
  function validAmount(value){return value!==undefined&&value!==''&&isFinite(Number(value))&&Number(value)>=0;}
  function valueLine(key){return state.values[key]!==undefined&&state.values[key]!==''?money(state.values[key]):'$[ENTER AMOUNT]';}
  function basisSentence(type){
    if(type.basis.length===2)return 'Based on a Sales Price of '+valueLine('salesPrice')+' and Loan Amount of '+valueLine('loanAmount')+':';
    if(type.basis[0]==='appraisedValue')return 'Based on an Appraised Value of '+valueLine('appraisedValue')+':';
    if(type.basis[0]==='salesPrice')return 'Based on a Sales Price of '+valueLine('salesPrice')+':';
    return 'Based on a Loan Amount of '+valueLine('loanAmount')+':';
  }
  function addFee(lines,label,value,note){lines.push(label.padEnd(36,' ')+money(value)+(note?' ('+note+')':''));}
  function addEntered(lines,label,key){lines.push(label.padEnd(36,' ')+valueLine(key));}

  function buildQuote(type){
    type=type||typeById(state.typeId);if(!type)return '';
    var lines=[type.name.toUpperCase()+(type.inHouse?' - IN-HOUSE LOANS ONLY':''),''];
    if(type.id==='apex-refinance'&&state.decisions.apexClosing==='title-only'){
      lines.push(basisSentence(type),'');
      addFee(lines,'Title - Title Search Fee',250);
      if(state.decisions.apexTitleInsurance==='yes')addEntered(lines,"Title - Lender's Title Policy",'lenderPolicy');
      if(state.decisions.apexTitleInsurance==='no')addFee(lines,'Title - Final Update Fee',50);
      lines.push('','Unified is not handling the closing.');
    }else{
      if(type.id==='fsbo-purchase')lines.push('BUYER FEES:','');
      lines.push(basisSentence(type),'');
      if(type.id==='reverse'){
        addFee(lines,'Closing Fee',500);addFee(lines,'Title Search Fee',300);addEntered(lines,"Lender's TI Fee",'lenderPolicy');addFee(lines,'CPL Fee',50);addFee(lines,'Mortgage Recording Fee',159,'est');addFee(lines,'Mortgage Tax','N/A');
      }else if(type.id==='cash-purchase'){
        addFee(lines,'Buyer Closing Fee',175);addFee(lines,'Title Search Fee',300);addEntered(lines,"Owner's Title Insurance",'ownerInsurance');addFee(lines,'Deed Recording Fee',13);addEntered(lines,'Deed Tax','deedTax');
        lines.push('');addFee(lines,'Seller Closing Fee',175);if(state.decisions.payoffNeeded==='yes')addFee(lines,'Payoff fee (if needed)',50);addFee(lines,'Deed Preparation Fee',150);
      }else{
        var isCcu=type.id==='ccu-hcb-purchase'||type.id==='ccu-hcb-refinance';
        var isRefi=type.id==='refinance'||type.id==='apex-refinance'||type.id==='ccu-hcb-refinance';
        if(isCcu){if(state.decisions.cplRequired==='yes')addFee(lines,'Title - CPL Fee',50);}else addFee(lines,'Title - CPL Fee',50);
        if(type.id==='ccu-hcb-refinance'&&state.decisions.settlementRequired==='yes')addFee(lines,'Title - Settlement Fee',400);
        if((!isCcu||state.decisions.lenderPolicyRequired==='yes'))addEntered(lines,"Title - Lender's Title Policy",'lenderPolicy');
        if(type.id!=='ccu-hcb-refinance'){
          var settlement=type.fees.filter(function(f){return f[0]==='Title - Settlement Fee'})[0];if(settlement)addFee(lines,settlement[0],settlement[1]);
        }
        var search=type.fees.filter(function(f){return f[0]==='Title - Title Search Fee'})[0];if(search)addFee(lines,search[0],search[1]);
        var recording=type.fees.filter(function(f){return f[0]==='Recording Fee'})[0];if(recording){lines.push('');addFee(lines,recording[0],recording[1],recording[2]);}
        if(!isRefi)addEntered(lines,'Transfer Taxes (Deed)','deedTax');
        if(!isRefi)addEntered(lines,'Transfer Taxes (Mtg)','mortgageTax');
      }
      if(type.id==='refinance'||type.id==='apex-refinance'||type.id==='ccu-hcb-refinance'){
        var trailingRecording=type.fees.filter(function(f){return f[0]==='Recording Fee'})[0];
        if(trailingRecording){
          var recordingText=lines.pop();
          if(lines[lines.length-1]==='')lines.pop();
          type.notices.forEach(function(key){lines.push('',NOTICES[key]);});
          lines.push('',recordingText);addEntered(lines,'Transfer Taxes (Mtg)','mortgageTax');
        }
      }else type.notices.forEach(function(key){lines.push('',NOTICES[key]);});
      if(type.id==='loan-purchase'||type.id==='apex-purchase'||type.id==='ccu-hcb-purchase'||type.id==='fsbo-purchase'){
        lines.push('','OTHER:');
        var ownerLabel="Title - Owner's Title Quote";
        if(type.id==='ccu-hcb-purchase')ownerLabel+=state.decisions.simultaneousIssue==='yes'?' (with simultaneous issue discount)':' (without simultaneous issue discount)';
        addEntered(lines,ownerLabel,'ownerTitle');
      }
      if(type.id==='fsbo-purchase'){
        lines.push('','SELLER FEES:');addFee(lines,'Seller Closing Fee',175);if(state.decisions.payoffNeeded==='yes')addFee(lines,'Payoff fee (if needed)',50);addFee(lines,'Deed Preparation Fee',150);
      }
    }
    lines.push('','Let me know if you need anything else; we look forward to working with you on this transaction!');
    return lines.join('\n');
  }

  function activeDecisions(type){
    var decisions=(type.decisions||[]).slice();
    if(type.id==='apex-refinance'&&state.decisions.apexClosing==='title-only')decisions.push('apexTitleInsurance');
    return decisions;
  }
  function activeFields(type){
    var fields=type.basis.slice();
    if(type.id==='apex-refinance'&&state.decisions.apexClosing==='title-only'){
      if(state.decisions.apexTitleInsurance==='yes')fields.push('lenderPolicy');
      return fields;
    }
    type.fields.forEach(function(field){
      if(field==='lenderPolicy'&&(type.id==='ccu-hcb-purchase'||type.id==='ccu-hcb-refinance')&&state.decisions.lenderPolicyRequired!=='yes')return;
      fields.push(field);
    });
    return fields;
  }
  function missingItems(type){
    var missing=[];
    activeDecisions(type).forEach(function(key){if(!state.decisions[key])missing.push(DECISIONS[key].label);});
    activeFields(type).forEach(function(key){if(!validAmount(state.values[key]))missing.push(FIELD_DEFS[key].label);});
    return missing;
  }
  function escapeHtml(value){return String(value).replace(/[&<>"']/g,function(char){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char];});}

  function renderTransactions(){
    var grid=document.getElementById('transactionGrid');
    grid.innerHTML=TYPES.map(function(type){return '<button type="button" class="transaction-option'+(type.inHouse?' in-house':'')+'" role="radio" aria-checked="'+(type.id===state.typeId)+'" data-type="'+type.id+'"><span class="transaction-icon">'+type.icon+'</span><strong>'+escapeHtml(type.name)+'</strong><small>'+escapeHtml(type.group)+'</small></button>';}).join('');
    grid.querySelectorAll('[data-type]').forEach(function(button){button.addEventListener('click',function(){selectType(button.dataset.type);});});
  }
  function selectType(id){
    state={typeId:id,values:{},decisions:{}};
    renderTransactions();renderForm();
    var workspace=document.getElementById('builderWorkspace');workspace.hidden=false;
    if(window.matchMedia('(max-width: 680px)').matches)workspace.scrollIntoView({behavior:'smooth',block:'start'});
  }
  function renderDecision(key){
    var def=DECISIONS[key],current=state.decisions[key]||'';
    return '<div class="decision-group"><span>'+escapeHtml(def.label)+' <b class="required" aria-hidden="true">*</b></span><div class="choice-row">'+def.choices.map(function(choice){return '<button type="button" class="choice-button" data-decision="'+key+'" data-value="'+choice[0]+'" aria-pressed="'+(current===choice[0])+'">'+escapeHtml(choice[1])+'</button>';}).join('')+'</div></div>';
  }
  function fieldLabel(type,key){
    if(type.id==='ccu-hcb-purchase'&&key==='ownerTitle')return state.decisions.simultaneousIssue==='yes'?"Owner's Policy - with simultaneous issue discount":"Owner's Policy - without simultaneous issue discount";
    return FIELD_DEFS[key].label;
  }
  function renderForm(){
    var type=typeById(state.typeId);if(!type)return;
    document.getElementById('inHouseNotice').hidden=!type.inHouse;
    document.getElementById('detailsHelp').textContent=type.id==='apex-refinance'?'Answer the closing question first; the correct fee path will appear automatically.':'Only the amounts that vary by file need to be entered.';
    var decisions=activeDecisions(type);
    document.getElementById('decisionFields').innerHTML=decisions.map(renderDecision).join('');
    document.querySelectorAll('[data-decision]').forEach(function(button){button.addEventListener('click',function(){
      state.decisions[button.dataset.decision]=button.dataset.value;
      if(button.dataset.decision==='apexClosing'){delete state.decisions.apexTitleInsurance;delete state.values.lenderPolicy;delete state.values.mortgageTax;}
      if(button.dataset.decision==='lenderPolicyRequired'&&button.dataset.value==='no')delete state.values.lenderPolicy;
      renderForm();
    });});
    var fields=activeFields(type);
    document.getElementById('amountFields').innerHTML=fields.map(function(key){var def=FIELD_DEFS[key];return '<div class="field"><label for="field-'+key+'">'+escapeHtml(fieldLabel(type,key))+' <span class="required">*</span></label><div class="money-wrap"><span class="money-prefix">$</span><input id="field-'+key+'" name="'+key+'" inputmode="decimal" autocomplete="off" placeholder="0.00" value="'+escapeHtml(state.values[key]||'')+'" aria-required="true"></div><span class="field-note">Enter the confirmed amount; the tool does not calculate this.</span></div>';}).join('');
    document.querySelectorAll('#amountFields input').forEach(function(input){input.addEventListener('input',function(){
      var clean=input.value.replace(/[^0-9.]/g,'');var parts=clean.split('.');if(parts.length>2)clean=parts.shift()+'.'+parts.join('');input.value=clean;state.values[input.name]=clean;input.classList.remove('invalid');updatePreview();
    });});
    updatePreview();
  }
  function updatePreview(){
    var type=typeById(state.typeId);if(!type)return;
    document.getElementById('quotePreview').textContent=buildQuote(type);
    var missing=missingItems(type),pill=document.getElementById('completionPill');
    pill.textContent=missing.length?'Needs '+missing.length+' detail'+(missing.length===1?'':'s'):'Ready to send';pill.classList.toggle('complete',!missing.length);
    document.getElementById('formAlert').hidden=true;
    document.getElementById('actionStatus').textContent='';
  }
  function validate(){
    var type=typeById(state.typeId),missing=missingItems(type);
    document.querySelectorAll('#amountFields input').forEach(function(input){input.classList.toggle('invalid',!validAmount(input.value));});
    var alert=document.getElementById('formAlert');
    if(missing.length){alert.textContent='Finish '+missing.length+' required detail'+(missing.length===1?'':'s')+' before copying or printing the quote.';alert.hidden=false;document.querySelector('.details-card').scrollIntoView({behavior:'smooth',block:'start'});return false;}
    alert.hidden=true;return true;
  }
  function copyQuote(){
    if(!validate())return;
    var text=buildQuote(),status=document.getElementById('actionStatus');
    function done(){status.textContent='Email copied to your clipboard.';}
    if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(text).then(done).catch(function(){fallbackCopy(text,done);});else fallbackCopy(text,done);
  }
  function fallbackCopy(text,done){var area=document.createElement('textarea');area.value=text;area.style.position='fixed';area.style.opacity='0';document.body.appendChild(area);area.select();document.execCommand('copy');area.remove();done();}
  function resetQuote(){state={typeId:'',values:{},decisions:{}};renderTransactions();document.getElementById('builderWorkspace').hidden=true;document.getElementById('quoteForm').reset();document.getElementById('actionStatus').textContent='';document.getElementById('transactionHeading').scrollIntoView({behavior:'smooth',block:'start'});}
  function init(){
    renderTransactions();
    document.getElementById('copyButton').addEventListener('click',copyQuote);
    document.getElementById('printButton').addEventListener('click',function(){if(validate())window.print();});
    document.getElementById('editButton').addEventListener('click',function(){document.querySelector('.details-card').scrollIntoView({behavior:'smooth',block:'start'});var first=document.querySelector('#amountFields input');if(first)first.focus();});
    document.getElementById('resetButton').addEventListener('click',resetQuote);
  }
  if(typeof module!=='undefined'&&module.exports)module.exports={TYPES:TYPES,NOTICES:NOTICES,FIELD_DEFS:FIELD_DEFS,typeById:typeById,money:money,_setState:function(next){state=next;},_activeFields:activeFields,buildQuote:buildQuote,missingItems:missingItems};
  if(typeof document!=='undefined')document.addEventListener('DOMContentLoaded',init);
})();
