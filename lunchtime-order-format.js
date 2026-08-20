(()=>{
'use strict';

function boot(){
  const orderContents=document.getElementById('lunchOrderContents');
  const copyButton=document.getElementById('lunchCopyOrder');
  const restaurantDialog=document.getElementById('restaurantDialog');
  const orderDialog=document.getElementById('lunchOrderDialog');
  const orderCount=document.getElementById('lunchOrderCount');
  if(!orderContents||!copyButton)return;

  function readOrder(){
    const groups=[];
    let total=0;
    let unknownUnits=0;
    let itemCount=0;
    let hasTax=false;

    orderContents.querySelectorAll('.order-group').forEach(groupEl=>{
      const group={name:(groupEl.textContent||'').trim(),items:[]};
      let node=groupEl.nextElementSibling;
      while(node&&!node.classList.contains('order-group')){
        if(node.classList.contains('order-line')){
          const title=(node.querySelector('h4')?.textContent||'').trim();
          const qtyMatch=title.match(/^\s*(\d+)\s*[x×]\s*(.*)$/i);
          const qty=qtyMatch?Number(qtyMatch[1]):1;
          const name=qtyMatch?qtyMatch[2].trim():title;
          const detailText=(node.querySelector('.order-detail')?.innerText||'').trim();
          const detailLines=detailText.split(/\n+/).map(s=>s.trim()).filter(Boolean);
          const priceLine=detailLines.find(s=>/^Listed:/i.test(s));
          const listed=priceLine?priceLine.replace(/^Listed:\s*/i,'').trim():'';
          const extras=detailLines.filter(s=>!/^Listed:/i.test(s));
          const note=(node.querySelector('.order-note')?.value||'').trim();

          itemCount+=qty;
          if(/\+\s*tax/i.test(listed))hasTax=true;
          const prices=[...listed.matchAll(/\$\s*([0-9]+(?:\.[0-9]{1,2})?)/g)].map(m=>Number(m[1]));
          if(prices.length===1&&Number.isFinite(prices[0]))total+=prices[0]*qty;
          else unknownUnits+=qty;

          group.items.push({qty,name,listed,extras,note});
        }
        node=node.nextElementSibling;
      }
      if(group.items.length)groups.push(group);
    });

    return {groups,total,unknownUnits,itemCount,hasTax};
  }

  function formatBody(data,compact=false){
    const lines=[];
    const divider=compact?'──────────────────':'────────────────────────────';
    data.groups.forEach((group,gi)=>{
      if(gi)lines.push('');
      lines.push(group.name.toUpperCase());
      lines.push(divider);
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

  function prettyOrderText(){
    const data=readOrder();
    if(!data.itemCount)return 'OFFICE LUNCH ORDER\n\nNo items selected.';

    const lines=['OFFICE LUNCH ORDER','════════════════════════════','',...formatBody(data,false),'','════════════════════════════'];
    if(data.unknownUnits){
      lines.push(`KNOWN SUBTOTAL: $${data.total.toFixed(2)}`);
      lines.push(`${data.unknownUnits} item${data.unknownUnits===1?'':'s'} need${data.unknownUnits===1?'s':''} a price check`);
    }else if(data.hasTax){
      lines.push(`SUBTOTAL BEFORE TAX: $${data.total.toFixed(2)}`);
    }else{
      lines.push(`TOTAL: $${data.total.toFixed(2)}`);
    }
    lines.push(`${data.itemCount} item${data.itemCount===1?'':'s'}`);
    return lines.join('\n');
  }

  function prettyRailText(){
    const data=readOrder();
    if(!data.itemCount)return 'No items yet.';
    return formatBody(data,true).join('\n');
  }

  window.lunchPrettyOrderText=prettyOrderText;
  window.lunchPrettyRailText=prettyRailText;

  copyButton.onclick=async()=>{
    const text=prettyOrderText();
    try{await navigator.clipboard.writeText(text)}
    catch{
      const area=document.createElement('textarea');
      area.value=text;document.body.appendChild(area);area.select();document.execCommand('copy');area.remove();
    }
    const old=copyButton.textContent;
    copyButton.textContent='Copied ✓';
    setTimeout(()=>copyButton.textContent=old,1000);
  };

  function refreshDisplays(){
    const text=prettyRailText();

    if(!restaurantDialog||restaurantDialog.open){
      const restaurantLedger=document.querySelector('[data-summary-ledger]');
      if(restaurantLedger)restaurantLedger.textContent=text;
    }

    const checkoutLedger=document.getElementById('lunchLedgerText');
    if(checkoutLedger)checkoutLedger.textContent=text;
  }

  new MutationObserver(()=>requestAnimationFrame(refreshDisplays)).observe(orderContents,{childList:true,subtree:true,characterData:true});
  if(orderCount)new MutationObserver(()=>requestAnimationFrame(refreshDisplays)).observe(orderCount,{childList:true,subtree:true,characterData:true});
  if(orderDialog)orderDialog.addEventListener('toggle',()=>requestAnimationFrame(refreshDisplays));
  document.addEventListener('input',e=>{
    if(e.target?.classList?.contains('order-note'))requestAnimationFrame(refreshDisplays);
  });
  refreshDisplays();
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});
else boot();
})();