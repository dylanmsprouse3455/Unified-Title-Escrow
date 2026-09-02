const test=require('node:test');
const assert=require('node:assert/strict');
const quote=require('../closing-quote-builder.js');

function render(typeId,values={},decisions={}){
  quote._setState({typeId,values:Object.assign({salesPrice:'250000',loanAmount:'200000',appraisedValue:'300000',lenderPolicy:'1000',ownerInsurance:'900',ownerTitle:'900',deedTax:'925',mortgageTax:'750'},values),decisions});
  return quote.buildQuote(quote.typeById(typeId));
}

test('all nine PDF transaction types are available',()=>{
  assert.deepEqual(quote.TYPES.map(type=>type.id),['loan-purchase','refinance','reverse','cash-purchase','apex-purchase','apex-refinance','ccu-hcb-purchase','ccu-hcb-refinance','fsbo-purchase']);
});

test('standard fixed fees match the guide',()=>{
  const purchase=render('loan-purchase');
  ['$50.00','$450.00','$300.00','$116.00'].forEach(amount=>assert.ok(purchase.includes(amount)));
  const refinance=render('refinance');
  assert.match(refinance,/\$450\.00/);assert.match(refinance,/\$300\.00/);assert.match(refinance,/\$103\.00/);assert.doesNotMatch(refinance,/Transfer Taxes \(Deed\)/);
  const reverse=render('reverse');
  ['$500.00','$300.00','$50.00','$159.00'].forEach(amount=>assert.ok(reverse.includes(amount)));assert.match(reverse,/Mortgage Tax\s+N\/A/);
  const cash=render('cash-purchase',{}, {payoffNeeded:'yes'});
  ['$175.00','$300.00','$13.00','$50.00','$150.00'].forEach(amount=>assert.ok(cash.includes(amount)));
});

test('APEX fee paths match the guide',()=>{
  const purchase=render('apex-purchase');
  ['$50.00','$400.00','$250.00','$116.00'].forEach(amount=>assert.ok(purchase.includes(amount)));
  const closing=render('apex-refinance',{}, {apexClosing:'closing'});
  ['$50.00','$350.00','$250.00','$103.00'].forEach(amount=>assert.ok(closing.includes(amount)));
  const titleOnly=render('apex-refinance',{lenderPolicy:'875'},{apexClosing:'title-only',apexTitleInsurance:'yes'});
  assert.match(titleOnly,/Title Search Fee\s+\$250\.00/);assert.match(titleOnly,/Lender's Title Policy\s+\$875\.00/);assert.doesNotMatch(titleOnly,/Settlement Fee/);
  const noInsurance=render('apex-refinance',{}, {apexClosing:'title-only',apexTitleInsurance:'no'});
  assert.match(noInsurance,/Final Update Fee\s+\$50\.00/);assert.doesNotMatch(noInsurance,/Lender's Title Policy/);
});

test('CCU and HCB optional fees appear only when required',()=>{
  const purchase=render('ccu-hcb-purchase',{}, {cplRequired:'yes',lenderPolicyRequired:'yes',ownerPolicyType:'simultaneous'});
  ['$50.00','$450.00','$300.00','$116.00'].forEach(amount=>assert.ok(purchase.includes(amount)));
  assert.match(purchase,/Owner's Title Quote\s+\$900\.00/);
  const refinance=render('ccu-hcb-refinance',{}, {cplRequired:'no',settlementRequired:'no',lenderPolicyRequired:'no'});
  assert.doesNotMatch(refinance,/CPL Fee|Settlement Fee|Lender's Title Policy/);assert.match(refinance,/Title Search Fee\s+\$300\.00/);assert.match(refinance,/Recording Fee\s+\$103\.00/);
});

test('FSBO seller fees and payoff behavior match the guide',()=>{
  const withPayoff=render('fsbo-purchase',{}, {payoffNeeded:'yes'});
  assert.match(withPayoff,/BUYER FEES/);assert.match(withPayoff,/SELLER FEES/);assert.match(withPayoff,/Payoff fee \(if needed\)\s+\$50\.00/);assert.match(withPayoff,/Seller Closing Fee\s+\$175\.00/);assert.match(withPayoff,/Deed Preparation Fee\s+\$150\.00/);
  assert.doesNotMatch(render('fsbo-purchase',{}, {payoffNeeded:'no'}),/Payoff fee/);
});

test('unknown premiums and taxes remain user-entered',()=>{
  const output=render('loan-purchase',{lenderPolicy:'',ownerTitle:'',deedTax:'',mortgageTax:''});
  assert.equal((output.match(/\$\[ENTER AMOUNT\]/g)||[]).length,4);
});

test('blank or invalid amounts keep a quote incomplete',()=>{
  quote._setState({typeId:'refinance',values:{loanAmount:'200000',lenderPolicy:'.',mortgageTax:'-1'},decisions:{}});
  assert.deepEqual(quote.missingItems(quote.typeById('refinance')),["Lender's Policy",'Transfer Taxes (Mtg)']);
});

test('CCU/HCB purchase requires the owner policy path',()=>{
  quote._setState({typeId:'ccu-hcb-purchase',values:{salesPrice:'250000',loanAmount:'200000',ownerTitle:'900',deedTax:'925',mortgageTax:'750'},decisions:{cplRequired:'no',lenderPolicyRequired:'no'}});
  assert.ok(quote.missingItems(quote.typeById('ccu-hcb-purchase')).includes("Which owner's policy quote are you using?"));
});

test('PDF notices are preserved on applicable quotes',()=>{
  const refinance=render('refinance');
  assert.ok(refinance.includes(quote.NOTICES.documentPreparation));assert.ok(refinance.includes(quote.NOTICES.manufacturedHome));assert.ok(refinance.includes(quote.NOTICES.remoteNotary));
  const cash=render('cash-purchase',{}, {payoffNeeded:'no'});
  assert.ok(cash.includes(quote.NOTICES.manufacturedHome));assert.ok(!cash.includes(quote.NOTICES.remoteNotary));assert.ok(!cash.includes(quote.NOTICES.documentPreparation));
});

test('customer output excludes internal workflow commentary',()=>{
  assert.doesNotMatch(render('apex-purchase'),/IN-HOUSE LOANS ONLY/);
  const titleOnly=render('apex-refinance',{lenderPolicy:'875'},{apexClosing:'title-only',apexTitleInsurance:'yes'});
  assert.doesNotMatch(titleOnly,/Unified is not handling the closing/);
});
