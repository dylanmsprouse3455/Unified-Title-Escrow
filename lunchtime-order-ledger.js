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

function cleanText(text){return String(text||'').replace(/\s+/g,' ').trim()}

function readOrder(){
  const groups=[];
  let total=0;
  let unpriced=0;
  let items=0;
  let hasTax=false;

  orderContents.querySelectorAll('.order-group').forEach(groupEl=>{
    const group={name:cleanText(groupEl.textContent),items:[]};
    let node=groupEl.nextElementSibling;

    while(node&&!node.classList.contains('order-group')){
      if(node.classList.contains('order-line')){
        const rawTitle=cleanText(node.querySelector('h4')?.textContent);
        const qtyMatch=rawTitle.match(/^\s*(\d+)\s*[x×]\s*(.*)$/i);
        const qty=qtyMatch?Number(qtyMatch[1]):1;
        const name=qtyMatch?qtyMatch[2].trim():rawTitle;

        const detailText=(node.querySelector('.order-detail')?.innerText||'').trim();
        const detailLines=detailText.split(/\n+/).map(cleanText).filter(Boolean);
        const priceLine=detailLines.find(line=>/^Listed\s*:/i.test(line));
        const listed=priceLine?priceLine.replace(/^Listed\s*:\s*/i,'').trim():'';
        const extras=detailLines.filter(line=>!/^Listed\s*:/i.test(line));
        const note=cleanText(node.querySelector('.order-note')?.value);

        items+=qty;
        if(/\+\s*tax/i.test(listed))hasTax=true;

        const amounts=[...listed.matchAll(/\$\s*([0-9]+(?:\.[0-9]{1,2})?)/g)].map(m=>Number(m[1]));
        if(amounts.length===1&&Number.isFinite(amounts[0])) total+=amounts[0]*qty;
        else unpriced+=qty;

        group.items.push({qty,name,listed,extras,note});
      }
      node=node.nextElementSibling;
    }

    if(group.items.length)groups.push(group);
  });

  return {groups,total,unpriced,items,hasTax};
}

function formatGroups(data){
  const lines=[];
  data.groups.forEach((group,gi)=>{
    if(gi)lines.push('');
    lines.push(group.name.toUpperCase());
    lines.push('────────────────────────');
    group.items.forEach((item,ii)=>{
      const price=item.listed?` — ${item.listed}`:'';
      lines.push(`• ${item.qty} × ${item.name}${price}`);
      item.extras.forEach(extra=>lines.push(`  ↳ ${extra}`));
      if(item.note)lines.push(`  ↳ Notes: ${item.note}`);
      if(ii<group.items.length-1)lines.push('');
    });
  });
  return lines;
}

function formatRailText(){
  const data=readOrder();
  if(!data.items)return 'No items yet.';
  return formatGroups(data).join('\n');
}

function formatCopyText(){
  const data=readOrder();
  if(!data.items)return 'OFFICE LUNCH ORDER\n\nNo items selected.';

  const lines=[
    'OFFICE LUNCH ORDER',
    '════════════════════════',
    '',
    ...formatGroups(data),
    '',
    '════════════════════════'
  ];

  if(data.unpriced){
    lines.push(`KNOWN SUBTOTAL: $${data.total.toFixed(2)}`);
    lines.push(`${data.unpriced} item${data.unpriced===1?'':'s'} need${data.unpriced===1?'s':''} a price check`);
  }else if(data.hasTax){
    lines.push(`SUBTOTAL BEFORE TAX: $${data.total.toFixed(2)}`);
  }else{
    lines.push(`TOTAL: $${data.total.toFixed(2)}`);
  }
  lines.push(`${data.items} item${data.items===1?'':'s'}`);
  return lines.join('\n');
}

window.lunchPrettyRailText=formatRailText;
window.lunchPrettyOrderText=formatCopyText;

function updateLedger(){
  const data=readOrder();
  if(ledgerText)ledgerText.textContent=formatRailText();
  if(balance)balance.textContent=`$${data.total.toFixed(2)}`;
  if(balanceLabel){
    balanceLabel.textContent=data.unpriced
      ? `Known subtotal • ${data.unpriced} unpriced`
      : (data.hasTax?'Subtotal before tax':'Running balance');
  }
  if(warning){
    if(data.unpriced){
      warning.textContent=`${data.unpriced} selected item${data.unpriced===1?' has':'s have'} a missing or multi-price listing, so the subtotal only includes prices that can be calculated exactly.`;
      warning.classList.add('show');
    }else{
      warning.textContent='';
      warning.classList.remove('show');
    }
  }
}

function fallbackCopy(text){
  const area=document.createElement('textarea');
  area.value=text;
  area.style.position='fixed';
  area.style.opacity='0';
  document.body.appendChild(area);
  area.focus();
  area.select();
  try{document.execCommand('copy')}catch(e){}
  area.remove();
}

if(copyButton){
  copyButton.addEventListener('click',async e=>{
    e.preventDefault();
    e.stopImmediatePropagation();
    const text=formatCopyText();
    try{
      if(navigator.clipboard?.writeText)await navigator.clipboard.writeText(text);
      else fallbackCopy(text);
    }catch(err){
      fallbackCopy(text);
    }
    const old=copyButton.textContent;
    copyButton.textContent='Copied ✓';
    setTimeout(()=>copyButton.textContent=old,1000);
    requestAnimationFrame(updateLedger);
  },true);
}

function addPrintSummary(){
  if(!printArea)return;
  printArea.querySelector('.ledger-print-summary')?.remove();
  const data=readOrder();
  const box=document.createElement('div');
  box.className='ledger-print-summary';
  box.style.cssText='margin:18px 0 0;padding-top:10px;border-top:2px solid #000;font-weight:700';
  if(data.unpriced)box.textContent=`Known subtotal: $${data.total.toFixed(2)} • ${data.unpriced} item(s) need price confirmation`;
  else if(data.hasTax)box.textContent=`Subtotal before tax: $${data.total.toFixed(2)}`;
  else box.textContent=`Total: $${data.total.toFixed(2)}`;
  printArea.appendChild(box);
}
window.addEventListener('beforeprint',addPrintSummary);

document.addEventListener('input',e=>{
  if(e.target?.classList?.contains('order-note'))updateLedger();
});
new MutationObserver(()=>updateLedger()).observe(orderContents,{childList:true,subtree:true,characterData:true});
orderContents.addEventListener('click',()=>setTimeout(updateLedger,0));
orderDialog.addEventListener('toggle',updateLedger);
setTimeout(updateLedger,0);
})();