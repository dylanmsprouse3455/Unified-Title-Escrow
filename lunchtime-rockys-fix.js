(()=>{
'use strict';

function normalizeRockysText(text){
  if(!text) return text;
  return text.replace(/^(\s*\d+x\s+)(?:10\s*inch\s*Individual|12\s*inch\s*Small|14\s*inch\s*Large)\s*[—-]\s*(10|12|14)(?:\s*inch|\s*[″”"])?(.*)$/gmi,
    (_,qty,size,rest)=>`${qty}Pizza — ${size} inch${rest||''}`)
    .replace(/^(\s*\d+x\s+)(?:10\s*inch\s*Individual|12\s*inch\s*Small|14\s*inch\s*Large)(.*)$/gmi,
    (_,qty,rest)=>`${qty}Pizza${rest||''}`);
}

// Make Rocky's menu behave like one build-your-own pizza instead of three fake "items" that are really sizes.
function cleanRockysMenu(){
  const title=document.getElementById('modalTitle')?.textContent?.trim();
  if(title!=="Rocky’s Pizza" && title!=="Rocky's Pizza") return;
  const body=document.getElementById('modalBody');
  if(!body) return;
  const details=[...body.querySelectorAll('details')];
  const sizeDetails=details.find(d=>/pizza sizes/i.test(d.querySelector('summary')?.textContent||''));
  if(!sizeDetails) return;
  const rows=[...sizeDetails.querySelectorAll('.items > .item')];
  if(!rows.length) return;
  const first=rows[0];
  const name=first.querySelector('.item-name');
  if(name) name.textContent='Build Your Own Pizza';
  let desc=first.querySelector('.desc');
  if(!desc){
    desc=document.createElement('div');
    desc.className='desc';
    first.appendChild(desc);
  }
  desc.textContent='Choose 10, 12, or 14 inch, then select toppings.';
  rows.slice(1).forEach(row=>{ row.style.display='none'; });
}

const bodyObserver=new MutationObserver(()=>cleanRockysMenu());
const modalBody=document.getElementById('modalBody');
if(modalBody) bodyObserver.observe(modalBody,{childList:true,subtree:true});
cleanRockysMenu();

// Keep the visible compiled order clean too.
const orderContents=document.getElementById('lunchOrderContents');
if(orderContents){
  const orderObserver=new MutationObserver(()=>{
    orderContents.querySelectorAll('.order-line h4').forEach(h=>{
      const fixed=normalizeRockysText(h.textContent);
      if(fixed!==h.textContent) h.textContent=fixed;
    });
  });
  orderObserver.observe(orderContents,{childList:true,subtree:true,characterData:true});
}

// Normalize exactly what Copy Order places on the clipboard.
if(navigator.clipboard && typeof navigator.clipboard.writeText==='function'){
  const originalWrite=navigator.clipboard.writeText.bind(navigator.clipboard);
  navigator.clipboard.writeText=(text)=>originalWrite(normalizeRockysText(text));
}

// Normalize the print sheet immediately before the native print dialog opens.
const nativePrint=window.print.bind(window);
window.print=()=>{
  const printArea=document.getElementById('lunchPrintArea');
  if(printArea){
    printArea.querySelectorAll('.pitem').forEach(el=>{
      el.childNodes.forEach(node=>{
        if(node.nodeType===Node.TEXT_NODE){
          const fixed=normalizeRockysText(node.textContent);
          if(fixed!==node.textContent) node.textContent=fixed;
        }
      });
    });
  }
  nativePrint();
};
})();