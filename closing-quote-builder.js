(function(){
  'use strict';

  var NOTICES={
    documentPreparation:'FYI - DOCUMENT PREPARATION FEES NECESSARY TO CLEAR TITLE MAY BE CHARGED, BUT UNKNOWN UNTIL TITLE SEARCH IS COMPLETED',
    manufacturedHome:'FYI - MANUFACTURED HOME TITLE WORK IS QUOTED ON A PER-FILE BASIS (Unless the MH title has been de-titled with the State of Tennessee, our de-title fees start at $150.00)',
    remoteNotary:'FYI - ANY REMOTE NOTARY SERVICES WILL INCUR AN ADDITIONAL FEE OF $200.00+ PER SERVICE'
  };

  var TYPES=[
    {id:'loan-purchase',name:'Loan Purchase',basis:['salesPrice','loanAmount'],fields:['lenderPolicy','ownerTitle','deedTax','mortgageTax'],notices:['manufacturedHome','remoteNotary']},
    {id:'refinance',name:'Refinance',basis:['loanAmount'],fields:['lenderPolicy','mortgageTax'],notices:['documentPreparation','manufacturedHome','remoteNotary']},
    {id:'reverse',name:'Reverse Mortgage',basis:['appraisedValue'],fields:['lenderPolicy'],notices:['documentPreparation','manufacturedHome','remoteNotary']},
    {id:'cash-purchase',name:'Cash Purchase',basis:['salesPrice'],fields:['ownerInsurance','deedTax'],decisions:['payoffNeeded'],notices:['manufacturedHome']},
    {id:'apex-purchase',name:'APEX Loan Purchase',basis:['salesPrice','loanAmount'],fields:['lenderPolicy','ownerTitle','deedTax','mortgageTax'],notices:['manufacturedHome','remoteNotary']},
    {id:'apex-refinance',name:'APEX Refinance',basis:['loanAmount'],fields:['lenderPolicy','mortgageTax'],decisions:['apexClosing'],notices:['documentPreparation','manufacturedHome','remoteNotary']},
    {id:'ccu-hcb-purchase',name:'CCU / HCB Loan Purchase',basis:['salesPrice','loanAmount'],fields:['lenderPolicy','ownerTitle','deedTax','mortgageTax'],decisions:['cplRequired','lenderPolicyRequired','ownerPolicyType'],notices:['manufacturedHome','remoteNotary']},
    {id:'ccu-hcb-refinance',name:'CCU / HCB Refinance',basis:['loanAmount'],fields:['lenderPolicy','mortgageTax'],decisions:['cplRequired','settlementRequired','lenderPolicyRequired'],notices:['documentPreparation','manufacturedHome','remoteNotary']},
    {id:'fsbo-purchase',name:'FSBO Loan Purchase',basis:['salesPrice','loanAmount'],fields:['lenderPolicy','ownerTitle','deedTax','mortgageTax'],decisions:['payoffNeeded'],notices:['manufacturedHome','remoteNotary']}
  ];

  var FIELD_DEFS={
    salesPrice:{label:'What is the purchase price?',short:'Purchase Price',help:'Use the sales price shown on the purchase contract.'},
    loanAmount:{label:'What is the loan amount?',short:'Loan Amount',help:'Use the loan amount provided by the lender for this transaction.'},
    appraisedValue:{label:'What is the appraised value?',short:'Appraised Value',help:'For a reverse mortgage quote, the fee guide bases the quote on the appraised value.'},
    lenderPolicy:{label:"What is the lender's title policy amount?",short:"Lender's Policy",help:'Enter the confirmed lender title insurance premium. This builder does not calculate title insurance premiums.'},
    ownerInsurance:{label:"What is the owner's title insurance amount?",short:"Owner's Title Insurance",help:'Enter the confirmed owner title insurance premium for the cash purchase.'},
    ownerTitle:{label:"What is the owner's policy quote?",short:"Owner's Policy",help:'Enter the confirmed owner title insurance quote. For CCU/HCB purchases, the previous question tells the builder which policy path applies.'},
    deedTax:{label:'What is the deed transfer tax?',short:'Transfer Taxes (Deed)',help:'Enter the confirmed deed transfer tax for the file. The builder intentionally does not calculate this amount.'},
    mortgageTax:{label:'What is the mortgage transfer tax?',short:'Transfer Taxes (Mtg)',help:'Enter the confirmed mortgage transfer tax for the file. The builder intentionally does not calculate this amount.'}
  };

  var DECISIONS={
    apexClosing:{label:'Is Unified handling the closing?',hint:'APEX refinance has two different fee paths.',help:'The office fee guide specifically says to ask whether Unified is closing the loan or only issuing title insurance.',choices:[['closing','Yes, Unified is closing'],['title-only','No, title work / insurance only']]},
    apexTitleInsurance:{label:'Will a title insurance policy be issued?',hint:'This changes the APEX title-only quote.',help:'If title insurance is issued, the quote includes the title search plus the title insurance premium. If no title insurance is issued, the fee guide adds a $50 final update fee.',choices:[['yes','Yes'],['no','No']]},
    cplRequired:{label:'Does this file require a CPL?',hint:'Only include the fee when it is required.',help:'For CCU/HCB in-house loans, the fee guide marks the $50 CPL fee as “IF REQUIRED.” If you are not sure whether the lender requires one, confirm before sending the quote.',choices:[['yes','Yes'],['no','No']]},
    settlementRequired:{label:'Is a settlement fee required?',hint:'This question only applies to CCU/HCB refinances.',help:'The fee guide marks the $400 settlement fee as “IF REQUIRED” for HCB/CCU in-house refinances.',choices:[['yes','Yes'],['no','No']]},
    lenderPolicyRequired:{label:"Does the lender require a lender's title policy?",hint:'Only include it when required.',help:'The CCU/HCB fee schedules mark the lender title policy as “IF REQUIRED.”',choices:[['yes','Yes'],['no','No']]},
    ownerPolicyType:{label:"Which owner's policy quote are you using?",hint:'CCU/HCB purchases may receive a simultaneous issue discount.',help:'The fee guide says the owner policy quote may use the simultaneous issue discount; otherwise use the regular owner policy amount.',choices:[['simultaneous','Simultaneous issue discount'],['standard','Regular owner policy']]},
    payoffNeeded:{label:'Is there a payoff that needs to be handled?',hint:'A payoff adds a $50 fee where the fee guide says “if needed.”',help:'Choose Yes when this transaction requires the office to handle a payoff. Choose No when no payoff fee applies.',choices:[['yes','Yes'],['no','No']]}
  };

  var ROUTE={
    deal:{label:'What kind of transaction is this?',hint:'Start with the basic transaction. The builder will narrow the fee schedule from there.',help:'Purchase means property is being bought. Refinance means an existing owner is replacing or changing financing. Reverse Mortgage uses the separate reverse-mortgage fee schedule.',choices:[['purchase','Purchase'],['refinance','Refinance'],['reverse','Reverse Mortgage']]},
    financing:{label:'Is the purchase using a loan?',hint:'This separates a cash purchase from a financed purchase.',help:'Choose Cash when there is no lender financing the purchase. Choose Loan when a lender is funding part of the purchase.',choices:[['loan','Yes, there is a loan'],['cash','No, it is a cash purchase']]},
    fsbo:{label:'Is the seller represented by a listing agent?',hint:'This helps identify whether the file uses the standard purchase path or the For Sale By Owner (FSBO) path.',help:'Look at the purchase contract or the file contacts. If a listing agent is named for the seller, choose Yes. If the owner is selling the property directly without a listing agent, choose No; the builder will use the FSBO buyer and seller fee schedule.',choices:[['no','Yes — there is a listing agent'],['yes','No — the owner is selling without a listing agent']]},
    lender:{label:'Who is the lender?',hint:'Some in-house lenders use a different fee structure.',help:'APEX, Consumer Credit Union (CCU), and Heritage Community Bank (HCB) have specific in-house fee schedules in the office guide. Use Other Lender for the standard fee schedule.',choices:[['apex','APEX Bank'],['ccu-hcb','CCU or HCB'],['other','Another lender']]}
  };

  var state={typeId:'',values:{},decisions:{}};
  var route={};
  var wizardStep=0;

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
      lines.push(basisSentence(type),'');addFee(lines,'Title - Title Search Fee',250);
      if(state.decisions.apexTitleInsurance==='yes')addEntered(lines,"Title - Lender's Title Policy",'lenderPolicy');
      if(state.decisions.apexTitleInsurance==='no')addFee(lines,'Title - Final Update Fee',50);
      lines.push('','Let me know if you need anything else; we look forward to working with you on this transaction!');return lines.join('\n');
    }
    if(type.id==='fsbo-purchase')lines.push('BUYER FEES:','');
    lines.push(basisSentence(type),'');
    if(type.id==='loan-purchase'){addFee(lines,'Title - CPL Fee',50);addEntered(lines,"Title - Lender's Title Policy",'lenderPolicy');addFee(lines,'Title - Settlement Fee',450);addFee(lines,'Title - Title Search Fee',300);addFee(lines,'Recording Fee',116,'est');addEntered(lines,'Transfer Taxes (Deed)','deedTax');addEntered(lines,'Transfer Taxes (Mtg)','mortgageTax');addNotices(lines,type);lines.push('','OTHER:');addEntered(lines,"Title - Owner's Title Quote",'ownerTitle');}
    if(type.id==='refinance'){addFee(lines,'Title - CPL Fee',50);addEntered(lines,"Title - Lender's Title Policy",'lenderPolicy');addFee(lines,'Title - Settlement Fee',450);addFee(lines,'Title - Title Search Fee',300);addNotices(lines,type);lines.push('');addFee(lines,'Recording Fee',103,'est');addEntered(lines,'Transfer Taxes (Mtg)','mortgageTax');}
    if(type.id==='reverse'){addFee(lines,'Closing Fee',500);addFee(lines,'Title Search Fee',300);addEntered(lines,"Lender's TI Fee",'lenderPolicy');addFee(lines,'CPL Fee',50);addFee(lines,'Mortgage Recording Fee',159,'est');addFee(lines,'Mortgage Tax','N/A');addNotices(lines,type);}
    if(type.id==='cash-purchase'){addFee(lines,'Buyer Closing Fee',175);addFee(lines,'Title Search Fee',300);addEntered(lines,"Owners Title Insurance",'ownerInsurance');addFee(lines,'Deed Recording Fee',13);addEntered(lines,'Deed Tax:','deedTax');addFee(lines,'Seller Closing Fee',175);if(state.decisions.payoffNeeded==='yes')addFee(lines,'Payoff fee (if needed)',50);addFee(lines,'Deed Preparation Fee',150);addNotices(lines,type);}
    if(type.id==='apex-purchase'){addFee(lines,'Title - CPL Fee',50);addEntered(lines,"Title - Lender's Title Policy",'lenderPolicy');addFee(lines,'Title - Settlement Fee',400);addFee(lines,'Title - Title Search Fee',250);addFee(lines,'Recording Fee',116,'est');addEntered(lines,'Transfer Taxes (Deed)','deedTax');addEntered(lines,'Transfer Taxes (Mtg)','mortgageTax');addNotices(lines,type);lines.push('','OTHER:');addEntered(lines,"Title - Owner's Title Quote",'ownerTitle');}
    if(type.id==='apex-refinance'){addFee(lines,'Title - CPL Fee',50);addEntered(lines,"Title - Lender's Title Policy",'lenderPolicy');addFee(lines,'Title - Settlement Fee',350);addFee(lines,'Title - Title Search Fee',250);addNotices(lines,type);lines.push('');addFee(lines,'Recording Fee',103,'est');addEntered(lines,'Transfer Taxes (Mtg)','mortgageTax');}
    if(type.id==='ccu-hcb-purchase'){if(state.decisions.cplRequired==='yes')addFee(lines,'Title - CPL Fee',50);if(state.decisions.lenderPolicyRequired==='yes')addEntered(lines,"Title - Lender's Title Policy",'lenderPolicy');addFee(lines,'Title - Settlement Fee',450);addFee(lines,'Title - Title Search Fee',300);addFee(lines,'Recording Fee',116,'est');addEntered(lines,'Transfer Taxes (Deed)','deedTax');addEntered(lines,'Transfer Taxes (Mtg)','mortgageTax');addNotices(lines,type);lines.push('','OTHER:');addEntered(lines,"Title - Owner's Title Quote",'ownerTitle');}
    if(type.id==='ccu-hcb-refinance'){if(state.decisions.cplRequired==='yes')addFee(lines,'Title - CPL Fee',50);if(state.decisions.settlementRequired==='yes')addFee(lines,'Title - Settlement Fee',400);if(state.decisions.lenderPolicyRequired==='yes')addEntered(lines,"Title - Lender's Title Policy",'lenderPolicy');addFee(lines,'Title - Title Search Fee',300);addNotices(lines,type);lines.push('');addFee(lines,'Recording Fee',103,'est');addEntered(lines,'Transfer Taxes (Mtg)','mortgageTax');}
    if(type.id==='fsbo-purchase'){addFee(lines,'Title - CPL Fee',50);addEntered(lines,"Title - Lender's Title Policy",'lenderPolicy');addFee(lines,'Title - Settlement Fee',450);addFee(lines,'Title - Title Search Fee',300);addFee(lines,'Recording Fee',116,'est');addEntered(lines,'Transfer Taxes (Deed)','deedTax');addEntered(lines,'Transfer Taxes (Mtg)','mortgageTax');addNotices(lines,type);lines.push('','OTHER:');addEntered(lines,"Title - Owner's Title Quote",'ownerTitle');lines.push('','SELLER FEES:');addFee(lines,'Seller Closing Fee',175);if(state.decisions.payoffNeeded==='yes')addFee(lines,'Payoff fee (if needed)',50);addFee(lines,'Deed Preparation Fee',150);}
    lines.push('','Let me know if you need anything else; we look forward to working with you on this transaction!');return lines.join('\n');
  }

  function resolveType(){
    if(route.deal==='reverse')return 'reverse';
    if(route.deal==='purchase'){
      if(route.financing==='cash')return 'cash-purchase';
      if(route.financing==='loan'&&route.fsbo==='yes')return 'fsbo-purchase';
      if(route.financing==='loan'&&route.fsbo==='no'&&route.lender==='apex')return 'apex-purchase';
      if(route.financing==='loan'&&route.fsbo==='no'&&route.lender==='ccu-hcb')return 'ccu-hcb-purchase';
      if(route.financing==='loan'&&route.fsbo==='no'&&route.lender==='other')return 'loan-purchase';
    }
    if(route.deal==='refinance'){
      if(route.lender==='apex')return 'apex-refinance';
      if(route.lender==='ccu-hcb')return 'ccu-hcb-refinance';
      if(route.lender==='other')return 'refinance';
    }
    return '';
  }

  function activeDecisions(type){var decisions=(type.decisions||[]).slice();if(type.id==='apex-refinance'&&state.decisions.apexClosing==='title-only')decisions.push('apexTitleInsurance');return decisions;}
  function activeFields(type){var fields=type.basis.slice();if(type.id==='apex-refinance'&&state.decisions.apexClosing==='title-only'){if(state.decisions.apexTitleInsurance==='yes')fields.push('lenderPolicy');return fields;}type.fields.forEach(function(field){if(field==='lenderPolicy'&&(type.id==='ccu-hcb-purchase'||type.id==='ccu-hcb-refinance')&&state.decisions.lenderPolicyRequired!=='yes')return;fields.push(field);});return fields;}
  function missingItems(type){var missing=[];if(!type)return missing;activeDecisions(type).forEach(function(key){if(!state.decisions[key])missing.push(DECISIONS[key].label);});activeFields(type).forEach(function(key){if(!validAmount(state.values[key]))missing.push(FIELD_DEFS[key].short);});return missing;}
  function escapeHtml(value){return String(value).replace(/[&<>"']/g,function(char){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char];});}

  function routeScreens(){
    var screens=[{kind:'route',key:'deal'}];
    if(route.deal==='purchase'){
      screens.push({kind:'route',key:'financing'});
      if(route.financing==='loan'){
        screens.push({kind:'route',key:'fsbo'});
        if(route.fsbo==='no')screens.push({kind:'route',key:'lender'});
      }
    }
    if(route.deal==='refinance')screens.push({kind:'route',key:'lender'});
    return screens;
  }

  function buildScreens(){
    var screens=routeScreens();
    var typeId=resolveType();
    if(!typeId)return screens;
    state.typeId=typeId;
    var type=typeById(typeId);
    activeDecisions(type).forEach(function(key){screens.push({kind:'decision',key:key});});
    activeFields(type).forEach(function(key){screens.push({kind:'field',key:key});});
    screens.push({kind:'final'});
    return screens;
  }

  function clearAfterRoute(key){
    var order=['deal','financing','fsbo','lender'];var index=order.indexOf(key);order.slice(index+1).forEach(function(k){delete route[k];});state.typeId='';state.values={};state.decisions={};
  }

  function stageFor(screen){if(screen.kind==='route')return 1;if(screen.kind==='decision')return 2;if(screen.kind==='field')return 3;return 4;}
  function updateStages(screen){var current=stageFor(screen);document.querySelectorAll('.stage').forEach(function(el){var number=Number(el.dataset.stage);el.classList.toggle('active',number===current);el.classList.toggle('done',number<current);});}
  function setHelp(text){var button=document.getElementById('helpButton'),panel=document.getElementById('helpPanel');panel.hidden=true;panel.innerHTML=text?'<strong>Why this matters</strong><br>'+escapeHtml(text):'';button.hidden=!text;button.textContent="I'm not sure what this means";}
  function setPath(){var box=document.getElementById('resolvedPath'),type=typeById(resolveType());if(!type){box.hidden=true;box.textContent='';return;}box.hidden=false;box.textContent='Using: '+type.name+' fee schedule';}

  function renderChoices(def,onChoose){var area=document.getElementById('answerArea');area.innerHTML=def.choices.map(function(choice){return '<button type="button" class="answer-button" data-value="'+escapeHtml(choice[0])+'">'+escapeHtml(choice[1])+'</button>';}).join('');area.querySelectorAll('[data-value]').forEach(function(button){button.addEventListener('click',function(){onChoose(button.dataset.value);});});}

  function render(){
    var screens=buildScreens();if(wizardStep>=screens.length)wizardStep=screens.length-1;if(wizardStep<0)wizardStep=0;var screen=screens[wizardStep];
    var title=document.getElementById('questionTitle'),hint=document.getElementById('questionHint'),label=document.getElementById('stepLabel'),area=document.getElementById('answerArea'),back=document.getElementById('backButton'),validation=document.getElementById('validationMessage');
    back.hidden=wizardStep===0;validation.hidden=true;validation.textContent='';setPath();updateStages(screen);label.textContent='Question '+(wizardStep+1)+' of '+screens.length;

    if(screen.kind==='route'){
      var routeDef=ROUTE[screen.key];title.textContent=routeDef.label;hint.textContent=routeDef.hint||'';setHelp(routeDef.help);renderChoices(routeDef,function(value){clearAfterRoute(screen.key);route[screen.key]=value;wizardStep++;render();});return;
    }
    if(screen.kind==='decision'){
      var decision=DECISIONS[screen.key];title.textContent=decision.label;hint.textContent=decision.hint||'';setHelp(decision.help);renderChoices(decision,function(value){state.decisions[screen.key]=value;if(screen.key==='apexClosing'){delete state.decisions.apexTitleInsurance;delete state.values.lenderPolicy;delete state.values.mortgageTax;}if(screen.key==='lenderPolicyRequired'&&value==='no')delete state.values.lenderPolicy;wizardStep++;render();});return;
    }
    if(screen.kind==='field'){
      var field=FIELD_DEFS[screen.key];title.textContent=field.label;hint.textContent='Enter the confirmed amount for this file.';setHelp(field.help);var current=state.values[screen.key]||'';area.innerHTML='<div class="input-wrap"><div class="money-input"><span>$</span><input id="amountInput" inputmode="decimal" autocomplete="off" placeholder="0.00" value="'+escapeHtml(current)+'"></div><button id="continueButton" class="continue-button" type="button">Continue</button></div>';
      var input=document.getElementById('amountInput');input.focus();input.addEventListener('input',function(){var clean=input.value.replace(/[^0-9.]/g,'');var parts=clean.split('.');if(parts.length>2)clean=parts.shift()+'.'+parts.join('');input.value=clean;});
      function save(){if(!validAmount(input.value)){validation.textContent='Enter a valid amount to continue.';validation.hidden=false;input.focus();return;}state.values[screen.key]=input.value;wizardStep++;render();}
      document.getElementById('continueButton').addEventListener('click',save);input.addEventListener('keydown',function(event){if(event.key==='Enter'){event.preventDefault();save();}});return;
    }

    var type=typeById(state.typeId);title.textContent='Your quote is ready.';hint.textContent='Review it once, then copy it into your email.';setHelp('If something is wrong, use Back to return to that answer. Changing an earlier transaction answer will clear information that no longer applies.');
    var summary='<div class="summary"><div class="summary-row"><span>Fee schedule</span><strong>'+escapeHtml(type.name)+'</strong></div></div>';
    area.innerHTML=summary+'<div class="quote-box" id="quoteBox">'+escapeHtml(buildQuote(type))+'</div><div class="final-actions"><button type="button" id="copyFinal" class="copy-final">Copy Quote</button><button type="button" id="printFinal" class="secondary-final">Print</button><button type="button" id="startOver" class="quiet-final">Start Over</button></div><p id="actionStatus" class="action-status" role="status"></p>';
    document.getElementById('copyFinal').addEventListener('click',copyQuote);document.getElementById('printFinal').addEventListener('click',function(){window.print();});document.getElementById('startOver').addEventListener('click',resetAll);
  }

  function copyQuote(){var text=buildQuote(),status=document.getElementById('actionStatus');function done(){status.textContent='Quote copied.';}if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(text).then(done).catch(function(){fallbackCopy(text,done);});else fallbackCopy(text,done);}
  function fallbackCopy(text,done){var area=document.createElement('textarea');area.value=text;area.style.position='fixed';area.style.opacity='0';document.body.appendChild(area);area.select();document.execCommand('copy');area.remove();done();}
  function resetAll(){route={};state={typeId:'',values:{},decisions:{}};wizardStep=0;render();window.scrollTo({top:0,behavior:'smooth'});}

  function init(){document.getElementById('backButton').addEventListener('click',function(){if(wizardStep>0){wizardStep--;render();}});document.getElementById('helpButton').addEventListener('click',function(){var panel=document.getElementById('helpPanel');panel.hidden=!panel.hidden;this.textContent=panel.hidden?"I'm not sure what this means":'Hide explanation';});render();}

  if(typeof module!=='undefined'&&module.exports)module.exports={TYPES:TYPES,NOTICES:NOTICES,typeById:typeById,money:money,_setState:function(next){state=next;},buildQuote:buildQuote,missingItems:missingItems};
  if(typeof document!=='undefined')document.addEventListener('DOMContentLoaded',init);
})();