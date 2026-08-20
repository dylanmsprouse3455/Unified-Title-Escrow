(()=>{
'use strict';

function isRockys(){
  const restaurant=(document.getElementById('lunchCustomizeRestaurant')?.textContent||'').trim();
  return restaurant==="Rocky’s Pizza" || restaurant==="Rocky's Pizza";
}

function preselectClickedSize(){
  if(!isRockys()) return;

  const body=document.getElementById('lunchCustomizeBody');
  const item=(document.getElementById('lunchCustomizeName')?.textContent||'').trim();
  if(!body || !item) return;

  const group=body.querySelector('[data-size-group]');
  if(!group || group.querySelector('.option-chip.selected')) return;

  const match=item.match(/\b(10|12|14)\s*inch\b/i);
  if(!match) return;

  const wanted=match[1];
  const chip=[...group.querySelectorAll('.option-chip')].find(el=>{
    let value='';
    try{ value=decodeURIComponent(el.dataset.value||''); }catch{ value=el.dataset.value||''; }
    const text=(el.textContent||'').trim();
    return value.startsWith(wanted) || text.startsWith(wanted);
  });

  if(chip) chip.classList.add('selected');
}

// After the restaurant-menu Add button opens the customizer, select the size
// represented by the Rocky's item that was clicked (10, 12, or 14 inch).
document.addEventListener('click',e=>{
  if(e.target?.closest?.('.order-add')) setTimeout(preselectClickedSize,0);
});

// Safety net: run before the builder's Add-to-order handler. This prevents its
// required-size guard from silently rejecting a Rocky's pizza whose clicked
// size is already known from the item title.
document.addEventListener('click',e=>{
  if(e.target?.closest?.('#lunchAddCustom')) preselectClickedSize();
},true);
})();
