(()=>{
'use strict';

function isRockys(){
  const restaurant=(document.getElementById('lunchCustomizeRestaurant')?.textContent||'').trim();
  return restaurant==="Rocky’s Pizza" || restaurant==="Rocky's Pizza";
}

function chooseRockysSize(){
  if(!isRockys()) return null;

  const body=document.getElementById('lunchCustomizeBody');
  const item=(document.getElementById('lunchCustomizeName')?.textContent||'').trim();
  if(!body) return null;

  const group=body.querySelector('[data-size-group]');
  if(!group) return null;

  let selected=group.querySelector('.option-chip.selected');
  if(selected) return selected;

  const match=item.match(/\b(10|12|14)\s*inch\b/i);
  const wanted=match?.[1] || '';
  const chips=[...group.querySelectorAll('.option-chip')];

  let chip=null;
  if(wanted){
    chip=chips.find(el=>{
      let value='';
      try{ value=decodeURIComponent(el.dataset.value||''); }
      catch{ value=el.dataset.value||''; }
      const text=(el.textContent||'').trim();
      return value.startsWith(wanted) || text.startsWith(wanted);
    }) || null;
  }

  // Rocky's first visible build-your-own row originates from the 10-inch item.
  // If the item title has already been normalized by the Rocky's display cleanup,
  // the original clicked row is still the 10-inch row, so default to the first size.
  if(!chip && chips.length) chip=chips[0];

  if(chip){
    chips.forEach(x=>x.classList.remove('selected'));
    chip.classList.add('selected');
  }
  return chip;
}

function showSizeError(){
  const group=document.querySelector('#lunchCustomizeBody [data-size-group]');
  if(!group) return;
  let msg=document.getElementById('lunchRockysSizeError');
  if(!msg){
    msg=document.createElement('div');
    msg.id='lunchRockysSizeError';
    msg.style.cssText='margin-top:9px;color:#b42318;font-weight:800;font-size:13px';
    msg.textContent='Choose a pizza size before adding it to the order.';
    group.parentElement?.appendChild(msg);
  }
  group.scrollIntoView({behavior:'smooth',block:'center'});
}

// Select the correct Rocky's size as soon as the customizer is rendered.
const body=document.getElementById('lunchCustomizeBody');
if(body){
  new MutationObserver(()=>queueMicrotask(chooseRockysSize))
    .observe(body,{childList:true,subtree:true});
}

const dialog=document.getElementById('lunchCustomizeDialog');
if(dialog) dialog.addEventListener('toggle',()=>queueMicrotask(chooseRockysSize));

// Rocky's only: take the Add button click, guarantee a selected size, then invoke
// the REAL order-builder onclick function directly. This avoids its silent size
// guard and does not duplicate or reimplement the private lunch-order state.
document.addEventListener('click',e=>{
  const button=e.target?.closest?.('#lunchAddCustom');
  if(!button || !isRockys()) return;

  e.preventDefault();
  e.stopImmediatePropagation();

  const size=chooseRockysSize();
  const sizeGroup=document.querySelector('#lunchCustomizeBody [data-size-group]');
  if(sizeGroup && !size){
    showSizeError();
    return;
  }

  const realHandler=button.onclick;
  if(typeof realHandler==='function'){
    realHandler.call(button);
  }else{
    console.error("Rocky's Add to order handler is missing");
  }
},true);
})();