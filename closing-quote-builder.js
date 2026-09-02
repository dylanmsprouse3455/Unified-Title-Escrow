(function(){
  'use strict';

  var NOTICES={
    documentPreparation:'FYI - DOCUMENT PREPARATION FEES NECESSARY TO CLEAR TITLE MAY BE CHARGED, BUT UNKNOWN UNTIL TITLE SEARCH IS COMPLETED',
    manufacturedHome:'FYI - MANUFACTURED HOME TITLE WORK IS QUOTED ON A PER-FILE BASIS (Unless the MH title has been de-titled with the State of Tennessee, our de-title fees start at $150.00)',
    remoteNotary:'FYI - ANY REMOTE NOTARY SERVICES WILL INCUR AN ADDITIONAL FEE OF $200.00+ PER SERVICE'
  };

  var TYPES=[
    {id:'loan-purchase',name:'Loan Purchase',group:'Standard',basis:['salesPrice','loanAmount'],fields:['lenderPolicy','deedTax','mortgageTax','ownerTitle'],notices:['manufacturedHome','remoteNotary']},
    {id:'refinance',name:'Refinance',group:'Standard',basis:['loanAmount'],fields:['lenderPolicy','mortgageTax'],notices:['documentPreparation','manufacturedHome','remoteNotary']},
    {id:'reverse',name:'Reverse Mortgage',group:'Standard',basis:['appraisedValue'],fields:['lenderPolicy'],notices:['documentPreparation','manufacturedHome','remoteNotary']},
    {id:'cash-purchase',name:'Cash Purchase',group:'Standard',basis:['salesPrice'],fields:['ownerInsurance','deedTax'],decisions:['payoffNeeded'],notices:['manufacturedHome']},
    {id:'apex-purchase',name:'APEX Loan Purchase',group:'In-House Lenders',inHouse:true,basis:['salesPrice','loanAmount'],fields:['lenderPolicy','deedTax','mortgageTax','ownerTitle'],notices:['manufacturedHome','remoteNotary']},
    {id:'apex-refinance',name:'APEX Refinance',group:'In-House Lenders',inHouse:true,basis:['loanAmount'],fields:['lenderPolicy','mortgageTax'],decisions:['apexClosing'],notices:['documentPreparation','manufacturedHome','remoteNotary']},
    {id:'ccu-hcb-purchase',name:'CCU / HCB Loan Purchase',group:'In-House Lenders',inHouse:true,basis:['salesPrice','loanAmount'],fields:['lenderPolicy','deedTax','mortgageTax','ownerTitle'],decisions:['cplRequired','lenderPolicyRequired','ownerPolicyType'],notices:['manufacturedHome','remoteNotary']},
    {id:'ccu-hcb-refinance',name:'CCU / HCB Refinance',group:'In-House Lenders',inHouse:true,basis:['loanAmount'],fields:['lenderPolicy','mortgageTax'],decisions:['cplRequired','settlementRequired','lenderPolicyRequired'],notices:['documentPreparation','manufacturedHome','remoteNotary']},
    {id:'fsbo-purchase',name:'FSBO Loan Purchase',group:'Other',basis:['salesPrice','loanAmount'],fields:['lenderPolicy','deedTax','mortgageTax','ownerTitle'],decisions:['payoffNeeded'],notices:['manufacturedHome','remoteNotary']}
  ];

  var FIELD_DEFS={
    salesPrice:{label:'Purchase Price'},loanAmount:{label:'Loan Amount'},appraisedValue:{label:'Appraised Value'},
    lenderPolicy:{label:"Lender's Policy"},ownerInsurance:{label:"Owner's Title Insurance"},ownerTitle:{label:"Owner's Policy"},
    deedTax:{label:'Transfer Taxes (Deed)'},mortgageTax:{label:'Transfer Taxes (Mtg)'}
  };

  var DECISIONS={
    apexClosing:{label:'What are we handling?',choices:[['closing','Closing the loan'],['title-only','Title work / insurance only']]},
    apexTitleInsurance:{label:'Will title insurance be issued?',choices:[['yes','Yes'],['no','No - use final update fee']]},
    cplRequired:{label:'CPL required?',choices:[['yes','Yes'],['no','No']]},
    settlementRequired:{label:'Settlement fee required?',choices:[['yes','Yes'],['no','No']]},
    lenderPolicyRequired:{label:"Lender's title policy required?",choices:[['yes','Yes'],['no','No']]},
    ownerPolicyType:{label:"Owner's policy quote",choices:[['simultaneous','Simultaneous issue'],['standard','Standard']]},
    payoffNeeded:{label:'Payoff fee needed?',choices:[['yes','Yes'],['no','No']]}
  };

  var state={typeId:'',values:{},decisions:{}};

  function typeById(id){return TYPES.filter(function(type){return type.id===id;})[0];}
  function money(value){if(value==='N/A')return 'N/A';var number=Number(value);return isFinite(number)?'$'+number.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2}):'';}
  function validAmount(value){return value!==undefined&&value!==''&&isFinite(Number(value))&&Number(value)>=0;}
  function valueLine(key){return validAmount(state.values[key])?money(state.values[key]):'$[ENTER AMOUNT]';}
  function addFee(lines,label,value,note){lines.push(label+' '+money(value)+(note?' ('+note+')':''));}
  function addEntered(lines,label,key){lines.push(label+' '+valueLine(key));}
  function addNotices(lines,type){type.notices.forEach(function(key){lines.push('',NOTICES[key]);});}

  function basisSentence(type){
    if(type.basis.length===2)return 'Based on a Sales Price of '+valueLine('salesPrice')+' and Loan Amount of '+valueLine('loanAmount')+' :';
    if(type.basis[0]==='appraisedValue')return 'Based on an Appraised Value of '+valueLine('appraisedValue')+' :';
    if(type.basis[0]==='salesPrice')return 'Based on a Sales Price of '+valueLine('salesPrice')+' :';
    return 'Based on a Loan Amount of '+valueLine('loanAmount')+':';
  }

  function buildQuote(type){
    type=type||typeById(state.typeId);if(!type)return '';
    var lines=[];

    if(type.id==='apex-refinance'&&state.decisions.apexClosing==='title-only'){
      lines.push(basisSentence(type),'');
      addFee(lines,'Title - Title Search Fee',250);
      if(state.decisions.apexTitleInsurance==='yes')addEntered(lines,"Title - Lender's Title Policy",'lenderPolicy');
      if(state.decisions.apexTitleInsurance==='no')addFee(lines,'Title - Final Update Fee',50);
      lines.push('','Let me know if you need anything else; we look forward to working with you on this transaction!');
      return lines.join('\n');
    }

    if(type.id==='fsbo-purchase')lines.push('BUYER FEES:','');
    lines.push(basisSentence(type),'');

    if(type.id==='loan-purchase'){
      addFee(lines,'Title - CPL Fee',50);addEntered(lines,"Title - Lender's Title Policy",'lenderPolicy');addFee(lines,'Title - Settlement Fee',450);addFee(lines,'Title - Title Search Fee',300);addFee(lines,'Recording Fee',116,'est');addEntered(lines,'Transfer Taxes (Deed)','deedTax');addEntered(lines,'Transfer Taxes (Mtg)','mortgageTax');addNotices(lines,type);lines.push('','OTHER:');addEntered(lines,"Title - Owner's Title Quote",'ownerTitle');
    }
    if(type.id==='refinance'){
      addFee(lines,'Title - CPL Fee',50);addEntered(lines,"Title - Lender's Title Policy",'lenderPolicy');addFee(lines,'Title - Settlement Fee',450);addFee(lines,'Title - Title Search Fee',300);addNotices(lines,type);lines.push('');addFee(lines,'Recording Fee',103,'est');addEntered(lines,'Transfer Taxes (Mtg)','mortgageTax');
    }
    if(type.id==='reverse'){
      addFee(lines,'Closing Fee',500);addFee(lines,'Title Search Fee',300);addEntered(lines,"Lender's TI Fee",'lenderPolicy');addFee(lines,'CPL Fee',50);addFee(lines,'Mortgage Recording Fee',159,'est');addFee(lines,'Mortgage Tax','N/A');addNotices(lines,type);
    }
    if(type.id==='cash-purchase'){
      addFee(lines,'Buyer Closing Fee',175);addFee(lines,'Title Search Fee',300);addEntered(lines,"Owners Title Insurance",'ownerInsurance');addFee(lines,'Deed Recording Fee',13);addEntered(lines,'Deed Tax:','deedTax');addFee(lines,'Seller Closing Fee',175);if(state.decisions.payoffNeeded==='yes')addFee(lines,'Payoff fee (if needed)',50);addFee(lines,'Deed Preparation Fee',150);addNotices(lines,type);
    }
    if(type.id==='apex-purchase'){
      addFee(lines,'Title - CPL Fee',50);addEntered(lines,"Title - Lender's Title Policy",'lenderPolicy');addFee(lines,'Title - Settlement Fee',400);addFee(lines,'Title - Title Search Fee',250);addFee(lines,'Recording Fee',116,'est');addEntered(lines,'Transfer Taxes (Deed)','deedTax');addEntered(lines,'Transfer Taxes (Mtg)','mortgageTax');addNotices(lines,type);lines.push('','OTHER:');addEntered(lines,"Title - Owner's Title Quote",'ownerTitle');
    }
    if(type.id==='apex-refinance'){
      addFee(lines,'Title - CPL Fee',50);addEntered(lines,"Title - Lender's Title Policy",'lenderPolicy');addFee(lines,'Title - Settlement Fee',350);addFee(lines,'Title - Title Search Fee',250);addNotices(lines,type);lines.push('');addFee(lines,'Recording Fee',103,'est');addEntered(lines,'Transfer Taxes (Mtg)','mortgageTax');
    }
    if(type.id==='ccu-hcb-purchase'){
      if(state.decisions.cplRequired==='yes')addFee(lines,'Title - CPL Fee',50);if(state.decisions.lenderPolicyRequired==='yes')addEntered(lines,"Title - Lender's Title Policy",'lenderPolicy');addFee(lines,'Title - Settlement Fee',450);addFee(lines,'Title - Title Search Fee',300);addFee(lines,'Recording Fee',116,'est');addEntered(lines,'Transfer Taxes (Deed)','deedTax');addEntered(lines,'Transfer Taxes (Mtg)','mortgageTax');addNotices(lines,type);lines.push('','OTHER:');addEntered(lines,"Title - Owner's Title Quote",'ownerTitle');
    }
    if(type.id==='ccu-hcb-refinance'){
      if(state.decisions.cplRequired==='yes')addFee(lines,'Title - CPL Fee',50);if(state.decisions.settlementRequired==='yes')addFee(lines,'Title - Settlement Fee',400);if(state.decisions.lenderPolicyRequired==='yes')addEntered(lines,"Title - Lender's Title Policy",'lenderPolicy');addFee(lines,'Title - Title Search Fee',300);addNotices(lines,type);lines.push('');addFee(lines,'Recording Fee',103,'est');addEntered(lines,'Transfer Taxes (Mtg)','mortgageTax');
    }
    if(type.id==='fsbo-purchase'){
      addFee(lines,'Title - CPL Fee',50);addEntered(lines,"Title - Lender's Title Policy",'lenderPolicy');addFee(lines,'Title - Settlement Fee',450);addFee(lines,'Title - Title Search Fee',300);addFee(lines,'Recording Fee',116,'est');addEntered(lines,'Transfer Taxes (Deed)','deedTax');addEntered(lines,'Transfer Taxes (Mtg)','mortgageTax');addNotices(lines,type);lines.push('','OTHER:');addEntered(lines,"Title - Owner's Title Quote",'ownerTitle');lines.push('','SELLER FEES:');addFee(lines,'Seller Closing Fee',175);if(state.decisions.payoffNeeded==='yes')addFee(lines,'Payoff fee (if needed)',50);addFee(lines,'Deed Preparation Fee',150);
    }

    lines.push('','Let me know if you need anything else; we look forward to working with you on this transaction!');
    return lines.join('\n');
  }

  function activeDecisions(type){var decisions=(type.decisions||[]).slice();if(type.id==='apex-refinance'&&state.decisions.apexClosing==='title-only')decisions.push('apexTitleInsurance');return decisions;}
  function activeFields(type){
    var fields=type.basis.slice();
    if(type.id==='apex-refinance'&&state.decisions.apexClosing==='title-only'){if(state.decisions.apexTitleInsurance==='yes')fields.push('lenderPolicy');return fields;}
    type.fields.forEach(function(field){if(field==='lenderPolicy'&&(type.id==='ccu-hcb-purchase'||type.id==='ccu-hcb-refinance')&&state.decisions.lenderPolicyRequired!=='yes')return;fields.push(field);});return fields;
  }
  function missingItems(type){var missing=[];if(!type)return missing;activeDecisions(type).forEach(function(key){if(!state.decisions[key])missing.push(DECISIONS[key].label);});activeFields(type).forEach(function(key){if(!validAmount(state.values[key]))missing.push(FIELD_DEFS[key].label);});return missing;}
  function escapeHtml(value){return String(value).replace(/[&<>"']/g,function(char){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char];});}

  function renderTransactions(){
    var grid=document.getElementById('transactionGrid');var groups=['Standard','In-House Lenders','Other'];
    grid.innerHTML=groups.map(function(group){var items=TYPES.filter(function(type){return type.group===group;});if(!items.length)return '';return '<div class="transaction-group"><div class="transaction-group-title">'+escapeHtml(group)+'</div><div class="transaction-grid">'+items.map(function(type){return '<button type="button" class="transaction-option'+(type.inHouse?' in-house':'')+'" aria-pressed="'+(type.id===state.typeId)+'" data-type="'+type.id+'"><strong>'+escapeHtml(type.name)+'</strong></button>';}).join('')+'</div></div>';}).join('');
    grid.querySelectorAll('[data-type]').forEach(function(button){button.addEventListener('click',function(){selectType(button.dataset.type);});});
  }
  function selectType(id){state={typeId:id,values:{},decisions:{}};renderTransactions();renderForm();var workspace=document.getElementById('builderWorkspace');workspace.hidden=false;if(window.matchMedia('(max-width: 760px)').matches)workspace.scrollIntoView({behavior:'smooth',block:'start'});}
  function renderDecision(key){var def=DECISIONS[key],current=state.decisions[key]||'';return '<div class="decision-group"><span>'+escapeHtml(def.label)+'</span><div class="choice-row">'+def.choices.map(function(choice){return '<button type="button" class="choice-button" data-decision="'+key+'" data-value="'+choice[0]+'" aria-pressed="'+(current===choice[0])+'">'+escapeHtml(choice[1])+'</button>';}).join('')+'</div></div>';}
  function fieldLabel(type,key){if(type.id==='ccu-hcb-purchase'&&key==='ownerTitle'){if(state.decisions.ownerPolicyType==='simultaneous')return "Owner's Policy - simultaneous issue";if(state.decisions.ownerPolicyType==='standard')return "Owner's Policy - standard";}return FIELD_DEFS[key].label;}
  function renderForm(){
    var type=typeById(state.typeId);if(!type)return;document.getElementById('inHouseNotice').hidden=!type.inHouse;document.getElementById('detailsHelp').textContent=type.id==='apex-refinance'?'Choose what Unified is handling, then enter the amounts for that path.':'Enter the confirmed amounts for this file.';
    var decisions=activeDecisions(type);document.getElementById('decisionFields').innerHTML=decisions.map(renderDecision).join('');
    document.querySelectorAll('[data-decision]').forEach(function(button){button.addEventListener('click',function(){var key=button.dataset.decision;state.decisions[key]=button.dataset.value;if(key==='apexClosing'){delete state.decisions.apexTitleInsurance;delete state.values.lenderPolicy;delete state.values.mortgageTax;}if(key==='lenderPolicyRequired'&&button.dataset.value==='no')delete state.values.lenderPolicy;renderForm();});});
    var fields=activeFields(type);document.getElementById('amountFields').innerHTML=fields.map(function(key){return '<div class="field"><label for="field-'+key+'">'+escapeHtml(fieldLabel(type,key))+'</label><div class="money-wrap"><span class="money-prefix">$</span><input id="field-'+key+'" name="'+key+'" inputmode="decimal" autocomplete="off" placeholder="0.00" value="'+escapeHtml(state.values[key]||'')+'"></div></div>';}).join('');
    document.querySelectorAll('#amountFields input').forEach(function(input){input.addEventListener('input',function(){var clean=input.value.replace(/[^0-9.]/g,'');var parts=clean.split('.');if(parts.length>2)clean=parts.shift()+'.'+parts.join('');input.value=clean;state.values[input.name]=clean;input.classList.remove('invalid');updatePreview();});});updatePreview();
  }
  function updatePreview(){var type=typeById(state.typeId);if(!type)return;document.getElementById('quotePreview').textContent=buildQuote(type);var missing=missingItems(type),pill=document.getElementById('completionPill');pill.textContent=missing.length?'Needs '+missing.length:'Ready';pill.classList.toggle('complete',!missing.length);document.getElementById('formAlert').hidden=true;document.getElementById('actionStatus').textContent='';}
  function validate(){var type=typeById(state.typeId),missing=missingItems(type);document.querySelectorAll('#amountFields input').forEach(function(input){input.classList.toggle('invalid',!validAmount(input.value));});var alert=document.getElementById('formAlert');if(missing.length){alert.textContent='Finish the missing quote details before copying or printing.';alert.hidden=false;document.querySelector('.details-card').scrollIntoView({behavior:'smooth',block:'start'});return false;}alert.hidden=true;return true;}
  function copyQuote(){if(!validate())return;var text=buildQuote(),status=document.getElementById('actionStatus');function done(){status.textContent='Copied.';}if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(text).then(done).catch(function(){fallbackCopy(text,done);});else fallbackCopy(text,done);}
  function fallbackCopy(text,done){var area=document.createElement('textarea');area.value=text;area.style.position='fixed';area.style.opacity='0';document.body.appendChild(area);area.select();document.execCommand('copy');area.remove();done();}
  function resetQuote(){state={typeId:'',values:{},decisions:{}};renderTransactions();document.getElementById('builderWorkspace').hidden=true;document.getElementById('quoteForm').reset();document.getElementById('actionStatus').textContent='';document.getElementById('transactionHeading').scrollIntoView({behavior:'smooth',block:'start'});}
  function init(){renderTransactions();document.getElementById('copyButton').addEventListener('click',copyQuote);document.getElementById('printButton').addEventListener('click',function(){if(validate())window.print();});document.getElementById('resetButton').addEventListener('click',resetQuote);}

  if(typeof module!=='undefined'&&module.exports)module.exports={TYPES:TYPES,NOTICES:NOTICES,typeById:typeById,money:money,_setState:function(next){state=next;},buildQuote:buildQuote,missingItems:missingItems};
  if(typeof document!=='undefined')document.addEventListener('DOMContentLoaded',init);
})();
