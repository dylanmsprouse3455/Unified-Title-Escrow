(()=>{
'use strict';

const orderDialog=document.getElementById('lunchOrderDialog');
const orderContents=document.getElementById('lunchOrderContents');
const copyButton=document.getElementById('lunchCopyOrder');
const printArea=document.getElementById('lunchPrintArea');
if(!orderDialog||!orderContents)return;

const modalBody=orderDialog.querySelector('.modal-body');
if(modalBody&&!document.getElementById('lunchOrderWorkspace')){
  const workspace=document.createElement('div');
  workspace.id='lunchOrderWorkspace';
  workspace.className='order-workspace';
  const ledger=document.createElement('aside');
  ledger.className='order-ledger';
  ledger.innerHTML=`
    <div class="order-ledger-title">Running order</div>
    <div class="order-ledger-balance" id="lunchRunningBalance">$0.00</div>
    <div class="order-ledger-balance-label" id="lunchRunningBalanceLabel">Running balance</div>
    <div class="order-ledger-warning" id="lunchLedgerWarning"></div>
    <pre id="lunchLedgerText">No items selected yet.</pre>`;
  const editor=document.createElement('div');
  editor.className='order-editor';
  modalBody.insertBefore(workspace,orderContents);
  workspace.appendChild(ledger);
  workspace.appendChild(editor);
  editor.appendChild(orderContents);
}

const ledgerText=document.getElementById('lunchLedgerText');
const balance=document.getElementById('lunchRunningBalance');
const balanceLabel=document.getElementById('lunchRunningBalanceLabel');
const warning=document.getElementById('lunchLedgerWarning');

function qtyFromLine(line){
  const text=line.querySelector('h4')?.textContent||'';
  const match=text.match(/^\s*(\d+)\s*[x×]/i);
  return match?Number(match[1]):1;
}
function listedDetail(line){
  return [...line.querySelectorAll('.order-detail')].map(x=>x.textContent.trim()).find(t=>/^Listed\s*:/i.test(t))||'';
}
function exactUnitPrice(line){
  const detail=listedDetail(line);
  if(!detail)return {amount:null,status:'missing'};
  const amounts=[...detail.matchAll(/\$\s*([0-9]+(?:\.[0-9]{1,2})?)/g)].map(m=>Number(m[1]));
  if(amounts.length===1&&Number.isFinite(amounts[0]))return {amount:amounts[0],status:'exact'};
  if(amounts.length>1)return {amount:null,status:'ambiguous'};
  return {amount:null,status:'missing'};
}
function cleanText(text){return String(text||'').replace(/\s+/g,' ').trim()}

function buildLedger(){
  const nodes=[...orderContents.querySelectorAll('.order-group,.order-line')];
  if(!nodes.length){
    return {text:'No items selected yet.',total:0,unpriced:0,items:0};
  }
  const out=['OFFICE LUNCH ORDER',''];
  let total=0,unpriced=0,items=0,currentGroup='';
  for(const node of nodes){
    if(node.classList.contains('order-group')){
      currentGroup=cleanText(node.textContent).toUpperCase();
      if(currentGroup){
        if(out[out.length-1]!=='')out.push('');
        out.push(currentGroup);
      }
      continue;
    }
    const title=cleanText(node.querySelector('h4')?.textContent);
    if(!title)continue;
    const qty=qtyFromLine(node);
    items+=qty;
    out.push(title);
    const details=[...node.querySelectorAll('.order-detail')].map(x=>cleanText(x.textContent)).filter(Boolean);
    details.forEach(d=>out.push(`  ${d}`));
    const note=cleanText(node.querySelector('.order-note')?.value);
    if(note)out.push(`  Notes: ${note}`);
    const price=exactUnitPrice(node);
    if(price.status==='exact') total+=price.amount*qty;
    else unpriced+=qty;
  }
  out.push('');
  if(unpriced===0){
    out.push(`RUNNING BALANCE: $${total.toFixed(2)}`);
  }else{
    out.push(`KNOWN SUBTOTAL: $${total.toFixed(2)}`);
    out.push(`${unpriced} item${unpriced===1?'':'s'} need price confirmation.`);
  }
  return {text:out.join('\n'),total,unpriced,items};
}

function updateLedger(){
  const data=buildLedger();
  if(ledgerText)ledgerText.textContent=data.text;
  if(balance)balance.textContent=`$${data.total.toFixed(2)}`;
  if(balanceLabel)balanceLabel.textContent=data.unpriced?`Known subtotal • ${data.unpriced} unpriced`:'Running balance';
  if(warning){
    if(data.unpriced){
      warning.textContent=`${data.unpriced} selected item${data.unpriced===1?' has':'s have'} a missing or multi-price listing, so the balance only includes prices that can be calculated exactly.`;
      warning.classList.add('show');
    }else warning.classList.remove('show');
  }
}

function fallbackCopy(text){
  const area=document.createElement('textarea');
  area.value=text;
  area.style.position='fixed';
  area.style.opacity='0';
  document.body.appendChild(area);
  area.focus();area.select();
  try{document.execCommand('copy')}catch(e){}
  area.remove();
}

if(copyButton){
  copyButton.addEventListener('click',async e=>{
    e.preventDefault();
    e.stopImmediatePropagation();
    const data=buildLedger();
    try{
      if(navigator.clipboard?.writeText)await navigator.clipboard.writeText(data.text);
      else fallbackCopy(data.text);
      const old=copyButton.textContent;
      copyButton.textContent='Copied ✓';
      setTimeout(()=>copyButton.textContent=old,1000);
    }catch(err){
      fallbackCopy(data.text);
    }
  },true);
}

function addPrintSummary(){
  if(!printArea)return;
  printArea.querySelector('.ledger-print-summary')?.remove();
  const data=buildLedger();
  const box=document.createElement('div');
  box.className='ledger-print-summary';
  box.style.cssText='margin:18px 0 0;padding-top:10px;border-top:2px solid #000;font-weight:700';
  box.textContent=data.unpriced?`Known subtotal: $${data.total.toFixed(2)} • ${data.unpriced} item(s) need price confirmation`:`Running balance: $${data.total.toFixed(2)}`;
  printArea.appendChild(box);
}
window.addEventListener('beforeprint',addPrintSummary);

document.addEventListener('input',e=>{
  if(e.target?.classList?.contains('order-note'))updateLedger();
});
const observer=new MutationObserver(()=>updateLedger());
observer.observe(orderContents,{childList:true,subtree:true,characterData:true});
orderContents.addEventListener('click',()=>setTimeout(updateLedger,0));
orderDialog.addEventListener('toggle',updateLedger);
updateLedger();
})();
