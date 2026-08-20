(()=>{
'use strict';

const style=document.createElement('style');
style.textContent=`
.item{align-items:center}
.item.has-order-add{grid-template-columns:minmax(0,1fr) auto}
.item.has-order-add .item-name{grid-column:1}
.item.has-order-add .price{grid-column:1}
.item.has-order-add .desc{grid-column:1}
.order-add{
  grid-column:2;grid-row:1 / span 3;align-self:center;border:0;background:var(--accent);
  color:#fff;border-radius:10px;padding:8px 11px;min-height:38px;font-weight:800;cursor:pointer
}
.order-add.added{background:var(--good)}
.floating-order{
  min-width:92px;height:44px;padding:0 14px;border:0;border-radius:999px;
  background:linear-gradient(135deg,var(--teal),#167a6b);color:#fff;
  box-shadow:0 8px 24px rgba(0,0,0,.18);font-weight:900;cursor:pointer;
  display:flex;align-items:center;justify-content:center;gap:7px
}
.order-count{
  min-width:22px;height:22px;padding:0 6px;border-radius:999px;display:inline-grid;place-items:center;
  background:#fff;color:var(--teal);font-size:12px;font-weight:900
}
.order-empty{padding:28px 14px;text-align:center;color:var(--muted)}
.order-list{display:flex;flex-direction:column;gap:10px}
.order-group{font-size:13px;font-weight:900;color:var(--accent);margin:14px 2px 4px;text-transform:uppercase;letter-spacing:.04em}
.order-line{
  background:#fffdf9;border:1px solid var(--line);border-radius:14px;padding:12px;
  display:grid;grid-template-columns:1fr auto;gap:8px
}
.order-line h4{margin:0;font-size:16px}
.order-detail{grid-column:1/-1;color:var(--muted);font-size:13px;line-height:1.45}
.order-note{
  grid-column:1/-1;width:100%;min-height:48px;resize:vertical;padding:9px 10px;border:1px solid var(--line);
  border-radius:10px;font:inherit;background:#fff
}
.qty-controls{display:flex;align-items:center;gap:7px}
.qty-controls button,.remove-order{border:1px solid var(--line);background:#fff;border-radius:9px;min-width:34px;height:34px;font-weight:900;cursor:pointer}
.remove-order{color:var(--coral)}
.order-toolbar{
  position:sticky;bottom:0;z-index:5;margin:16px -18px -18px;padding:12px 18px calc(12px + env(safe-area-inset-bottom));
  background:rgba(247,242,235,.97);backdrop-filter:blur(10px);border-top:1px solid var(--line);
  display:grid;grid-template-columns:1fr 1fr;gap:9px
}
.order-toolbar button{border:0;border-radius:12px;padding:12px;font-weight:900;cursor:pointer}
.copy-order{background:var(--accent);color:#fff}
.print-order{background:var(--teal);color:#fff}
.clear-order{grid-column:1/-1;background:#fff;color:var(--coral);border:1px solid #f2c7c1!important}
.custom-block{background:#fffdf9;border:1px solid var(--line);border-radius:14px;padding:13px;margin:10px 0}
.custom-block h4{margin:0 0 9px;font-size:14px}
.option-chips{display:flex;flex-wrap:wrap;gap:7px}
.option-chip{
  border:1px solid var(--line);background:#fff;border-radius:999px;padding:8px 10px;min-height:38px;
  font-weight:700;font-size:13px;cursor:pointer
}
.option-chip.selected{background:var(--accent);border-color:var(--accent);color:#fff}
.custom-note{width:100%;min-height:74px;resize:vertical;padding:10px;border:1px solid var(--line);border-radius:11px;font:inherit;background:#fff}
.custom-actions{display:flex;gap:9px;margin-top:12px}
.custom-actions button{flex:1;border:0;border-radius:12px;padding:12px;font-weight:900;cursor:pointer}
.add-custom{background:var(--accent);color:#fff}.cancel-custom{background:#edf1f5;color:var(--ink)}
.verified-note{font-size:12px;color:var(--muted);margin-top:7px;line-height:1.45}
#lunchPrintArea{display:none}
@media(max-width:620px){
  .floating-order{height:42px;min-width:88px}
  .order-add{padding:7px 9px;font-size:12px;min-height:34px}
  .order-toolbar{margin-left:-14px;margin-right:-14px;margin-bottom:-18px;padding-left:14px;padding-right:14px}
}
@media print{
  body *{visibility:hidden!important}
  #lunchPrintArea,#lunchPrintArea *{visibility:visible!important}
  #lunchPrintArea{display:block!important;position:absolute;left:0;top:0;width:100%;padding:24px;color:#000;background:#fff;font-family:Arial,sans-serif}
  #lunchPrintArea h1{font-size:22px;margin:0 0 6px}
  #lunchPrintArea h2{font-size:17px;margin:18px 0 5px;border-bottom:1px solid #bbb;padding-bottom:4px}
  #lunchPrintArea .pitem{margin:8px 0;line-height:1.4}
  #lunchPrintArea .pdetail{font-size:12px;color:#444}
}`;
document.head.appendChild(style);

const modalMarkup=`
<dialog id="lunchCustomizeDialog">
  <div class="modal-head">
    <div><h2 id="lunchCustomizeName">Customize item</h2><div class="meta" id="lunchCustomizeRestaurant"></div></div>
    <button class="close" id="lunchCloseCustomize" aria-label="Close">×</button>
  </div>
  <div class="modal-body" id="lunchCustomizeBody"></div>
</dialog>
<dialog id="lunchOrderDialog">
  <div class="modal-head">
    <div><h2>Office Lunch Order</h2><div class="meta" id="lunchOrderSubtitle">Build the order, then copy or print it.</div></div>
    <button class="close" id="lunchCloseOrder" aria-label="Close">×</button>
  </div>
  <div class="modal-body">
    <div id="lunchOrderContents"></div>
    <div class="order-toolbar">
      <button type="button" class="copy-order" id="lunchCopyOrder">Copy order</button>
      <button type="button" class="print-order" id="lunchPrintOrder">Print</button>
      <button type="button" class="clear-order" id="lunchClearOrder">Clear order</button>
    </div>
  </div>
</dialog>
<div id="lunchPrintArea" aria-hidden="true"></div>`;
document.body.insertAdjacentHTML('beforeend',modalMarkup);

const floating=document.querySelector('.floating-controls');
if(floating && !document.getElementById('lunchOrderButton')){
  floating.insertAdjacentHTML('afterbegin','<button class="floating-order" id="lunchOrderButton" aria-label="Open lunch order">Order <span class="order-count" id="lunchOrderCount">0</span></button>');
}

const orderDialog=document.getElementById('lunchOrderDialog');
const customizeDialog=document.getElementById('lunchCustomizeDialog');
const orderButton=document.getElementById('lunchOrderButton');
const orderCount=document.getElementById('lunchOrderCount');
const orderContents=document.getElementById('lunchOrderContents');
const orderSubtitle=document.getElementById('lunchOrderSubtitle');
const printArea=document.getElementById('lunchPrintArea');

let lunchOrder=[];
let pending=null;

const verifiedPizzaOptions={
  "Casa Nostra Italian Cuisine":{
    groups:[
      ["Toppings",["Pepperoni","Sliced Italian Sausage","Hamburger","Bacon","Ham","Mushrooms","Onions","Green Peppers","Black Olives","Hot Banana Peppers","Spinach","Broccoli","Pineapple","Fresh Tomatoes","Ricotta Cheese","Feta Cheese","Fresh Garlic","Jalapeño Peppers"]]
    ],
    note:'Verified from the photographed Casa Nostra menu. Extra toppings shown there: 10″ +$1.00 each; 16″ +$1.50 each.'
  },
  "Casa Express Italian Eatery":{
    groups:[
      ["Sauce",["Pizza Sauce","Alfredo","Buffalo","BBQ","Pesto","Spicy Romano","Ranch","Signature White Sauce","Herb Infused Olive Oil"]],
      ["Meat",["Pepperoni","Sliced Sausage","Hamburger","Ham","Bacon","Grilled Chicken","Steak","Salami","Anchovies","Meatball","Gyro","Shrimp","Smoked Salmon"]],
      ["Cheese",["Mozzarella","Ricotta","Feta","Parmesan","Gorgonzola","Cheddar","White American"]],
      ["Veggies & Herbs",["Spinach","Tomato","Eggplant","Mushrooms","Broccoli","Kalamata Olives","Artichoke Hearts","Capers","Jalapeño","Red Roasted Peppers","Bell Peppers","Banana Peppers","Oregano","Garlic","Basil"]]
    ],
    note:'Verified from the photographed Casa Express Build Your Own Pizza menu.'
  }
};

function isPizzaItem(restaurant,section,item){
  const name=(item[0]||'').toLowerCase();
  const text=`${restaurant.name} ${section} ${name}`.toLowerCase();
  return /\bpizza\b/.test(text) && !/pizza fries|pizza roll/.test(name);
}
function parseSizes(item,restaurant){
  const price=item[1]||'',desc=item[2]||'';
  let found=[...price.matchAll(/(\d+(?:\.\d+)?)\s*(?:["”]|inch)?\s*\$([0-9]+(?:\.[0-9]+)?)/gi)]
    .map(m=>({label:`${m[1]}″`,price:`$${m[2]}`}));
  if(found.length>1)return found;
  const sizes=[...desc.matchAll(/(\d+(?:\.\d+)?)\s*(?:inch|["”])/gi)].map(m=>`${m[1]}″`);
  const prices=price.match(/\$[0-9]+(?:\.[0-9]+)?/g)||[];
  if(sizes.length>1&&prices.length>=sizes.length)return sizes.map((s,i)=>({label:s,price:prices[i]}));
  if(restaurant.name==="Rocky’s Pizza"){
    const section=restaurant.sections.find(s=>/pizza sizes/i.test(s[0]));
    if(section)return section[1].map(x=>({label:x[0].replace(/\s*(Individual|Small|Large)\s*/i,' ').trim(),price:''}));
  }
  return [];
}
function pizzaOptions(restaurant){
  if(verifiedPizzaOptions[restaurant.name])return verifiedPizzaOptions[restaurant.name];
  const section=restaurant.sections.find(s=>/pizza toppings|^toppings$/i.test(s[0]));
  if(section)return {groups:[["Toppings",section[1].map(x=>x[0])]],note:'Toppings are taken from this restaurant’s saved menu information.'};
  return null;
}
function itemKey(x){return JSON.stringify([x.restaurant,x.item,x.listedPrice,x.size,x.options,x.notes])}
function addItem(x){
  const found=lunchOrder.find(y=>itemKey(y)===itemKey(x));
  if(found)found.qty++;else lunchOrder.push(x);
  refreshBadge();
}
function refreshBadge(){if(orderCount)orderCount.textContent=lunchOrder.reduce((n,x)=>n+x.qty,0)}
function flash(button){
  if(!button)return;const text=button.textContent;
  button.textContent='Added ✓';button.classList.add('added');
  setTimeout(()=>{button.textContent=text;button.classList.remove('added')},850);
}
function beginAdd(restaurant,section,item,button){
  const pizza=isPizzaItem(restaurant,section,item);
  const sizes=pizza?parseSizes(item,restaurant):[];
  const options=pizza?pizzaOptions(restaurant):null;
  if(!pizza){
    addItem({restaurant:restaurant.name,item:item[0],listedPrice:item[1]||'',size:'',options:[],notes:'',qty:1});
    flash(button);return;
  }
  pending={restaurant,section,item,button,pizza,sizes,pizzaOptions:options};
  showCustomizer();
  customizeDialog.showModal();
}
function showCustomizer(){
  const p=pending;if(!p)return;
  document.getElementById('lunchCustomizeName').textContent=p.item[0];
  document.getElementById('lunchCustomizeRestaurant').textContent=p.restaurant.name;
  let content='';
  if(p.sizes.length){
    content+=`<div class="custom-block"><h4>Choose a size</h4><div class="option-chips" data-size-group>${p.sizes.map(s=>`<button type="button" class="option-chip" data-value="${encodeURIComponent(s.label)}" data-price="${encodeURIComponent(s.price||'')}">${s.label}${s.price?` • ${s.price}`:''}</button>`).join('')}</div></div>`;
  }
  if(p.pizzaOptions){
    p.pizzaOptions.groups.forEach(([label,values])=>{
      const single=/^sauce$/i.test(label);
      content+=`<div class="custom-block"><h4>${label}</h4><div class="option-chips" data-option-label="${encodeURIComponent(label)}"${single?' data-single-option':''}>${values.map(v=>`<button type="button" class="option-chip" data-value="${encodeURIComponent(v)}">${v}</button>`).join('')}</div></div>`;
    });
    content+=`<div class="verified-note">${p.pizzaOptions.note}</div>`;
  }else{
    content+=`<div class="custom-block"><h4>Toppings / changes</h4><div class="verified-note">A verified topping list is not saved for this menu, so use special instructions instead of guessing.</div></div>`;
  }
  content+=`<div class="custom-block"><h4>Special instructions</h4><textarea id="lunchCustomNotes" class="custom-note" placeholder="No onions, extra sauce, dressing on the side, etc."></textarea></div>
  <div class="custom-actions"><button type="button" class="cancel-custom" id="lunchCancelCustom">Cancel</button><button type="button" class="add-custom" id="lunchAddCustom">Add to order</button></div>`;
  const body=document.getElementById('lunchCustomizeBody');
  body.innerHTML=content;
  body.querySelectorAll('.option-chip').forEach(chip=>chip.addEventListener('click',()=>{
    const parent=chip.parentElement;
    if(parent.hasAttribute('data-size-group')||parent.hasAttribute('data-single-option')){
      parent.querySelectorAll('.option-chip').forEach(x=>x.classList.remove('selected'));
    }
    chip.classList.toggle('selected');
  }));
  document.getElementById('lunchCancelCustom').onclick=()=>customizeDialog.close();
  document.getElementById('lunchAddCustom').onclick=()=>{
    const sizeChip=body.querySelector('[data-size-group] .option-chip.selected');
    if(p.sizes.length&&!sizeChip){
      body.querySelector('[data-size-group]').scrollIntoView({behavior:'smooth',block:'center'});return;
    }
    const groups=[];
    body.querySelectorAll('[data-option-label]').forEach(group=>{
      const values=[...group.querySelectorAll('.option-chip.selected')].map(c=>decodeURIComponent(c.dataset.value));
      if(values.length)groups.push({group:decodeURIComponent(group.dataset.optionLabel),values});
    });
    addItem({
      restaurant:p.restaurant.name,item:p.item[0],
      listedPrice:sizeChip?decodeURIComponent(sizeChip.dataset.price||''):(p.item[1]||''),
      size:sizeChip?decodeURIComponent(sizeChip.dataset.value):'',
      options:groups,notes:(document.getElementById('lunchCustomNotes').value||'').trim(),qty:1
    });
    flash(p.button);customizeDialog.close();
  };
}
function enhanceMenu(restaurant){
  const body=document.getElementById('modalBody');if(!body)return;
  const detailBlocks=[...body.querySelectorAll('details')];
  restaurant.sections.forEach((section,si)=>{
    const detail=detailBlocks[si];if(!detail)return;
    const rows=[...detail.querySelectorAll('.items > .item')];
    section[1].forEach((item,ii)=>{
      const row=rows[ii];if(!row||row.querySelector('.order-add'))return;
      row.classList.add('has-order-add');
      const button=document.createElement('button');
      button.type='button';button.className='order-add';button.textContent='+ Add';
      button.addEventListener('click',()=>beginAdd(restaurant,section[0],item,button));
      row.appendChild(button);
    });
  });
}
const originalOpenRestaurant=openRestaurant;
openRestaurant=function(restaurant){
  originalOpenRestaurant(restaurant);
  enhanceMenu(restaurant);
};

function detailLines(x,includePrice=true){
  const lines=[];
  if(x.size)lines.push(`Size: ${x.size}`);
  (x.options||[]).forEach(g=>lines.push(`${g.group}: ${g.values.join(', ')}`));
  if(x.notes)lines.push(`Notes: ${x.notes}`);
  if(includePrice&&x.listedPrice)lines.push(`Listed: ${x.listedPrice}`);
  return lines;
}
function renderOrder(){
  if(!lunchOrder.length){
    orderSubtitle.textContent='Build the order, then copy or print it.';
    orderContents.innerHTML='<div class="order-empty"><strong>No items yet.</strong><br>Open a restaurant and tap <b>+ Add</b> next to anything you want.</div>';
    return;
  }
  const total=lunchOrder.reduce((n,x)=>n+x.qty,0);
  orderSubtitle.textContent=`${total} item${total===1?'':'s'} selected`;
  const groups={};lunchOrder.forEach((x,i)=>(groups[x.restaurant]??=[]).push({x,i}));
  orderContents.innerHTML='<div class="order-list">'+Object.entries(groups).map(([restaurant,items])=>`
    <div><div class="order-group">${restaurant}</div>${items.map(({x,i})=>`
      <div class="order-line">
        <div><h4>${x.qty}× ${x.item}</h4></div>
        <div class="qty-controls"><button type="button" data-minus="${i}">−</button><strong>${x.qty}</strong><button type="button" data-plus="${i}">+</button><button type="button" class="remove-order" data-remove="${i}">×</button></div>
        ${detailLines(x).length?`<div class="order-detail">${detailLines(x).join('<br>')}</div>`:''}
        <textarea class="order-note" data-note="${i}" placeholder="Add or change special instructions…">${x.notes||''}</textarea>
      </div>`).join('')}</div>`).join('')+'</div>';
  orderContents.querySelectorAll('[data-minus]').forEach(b=>b.onclick=()=>{const i=+b.dataset.minus;if(lunchOrder[i].qty>1)lunchOrder[i].qty--;else lunchOrder.splice(i,1);refreshBadge();renderOrder()});
  orderContents.querySelectorAll('[data-plus]').forEach(b=>b.onclick=()=>{lunchOrder[+b.dataset.plus].qty++;refreshBadge();renderOrder()});
  orderContents.querySelectorAll('[data-remove]').forEach(b=>b.onclick=()=>{lunchOrder.splice(+b.dataset.remove,1);refreshBadge();renderOrder()});
  orderContents.querySelectorAll('[data-note]').forEach(t=>t.addEventListener('input',()=>{lunchOrder[+t.dataset.note].notes=t.value.trim()}));
}
function compileText(){
  if(!lunchOrder.length)return 'OFFICE LUNCH ORDER\n\nNo items selected.';
  const groups={};lunchOrder.forEach(x=>(groups[x.restaurant]??=[]).push(x));
  const lines=['OFFICE LUNCH ORDER'];
  Object.entries(groups).forEach(([restaurant,items])=>{
    lines.push('',restaurant.toUpperCase());
    items.forEach(x=>{
      lines.push(`${x.qty}x ${x.item}${x.size?` — ${x.size}`:''}${x.listedPrice?` (${x.listedPrice})`:''}`);
      (x.options||[]).forEach(g=>lines.push(`  ${g.group}: ${g.values.join(', ')}`));
      if(x.notes)lines.push(`  Notes: ${x.notes}`);
    });
  });
  return lines.join('\n');
}
function buildPrint(){
  const groups={};lunchOrder.forEach(x=>(groups[x.restaurant]??=[]).push(x));
  printArea.innerHTML=`<h1>Office Lunch Order</h1><div>${new Date().toLocaleString()}</div>`+
    Object.entries(groups).map(([restaurant,items])=>`<h2>${restaurant}</h2>${items.map(x=>`
      <div class="pitem"><strong>${x.qty}× ${x.item}${x.size?` — ${x.size}`:''}</strong>${x.listedPrice?` <span>${x.listedPrice}</span>`:''}
      <div class="pdetail">${detailLines(x,false).join('<br>')}</div></div>`).join('')}`).join('');
}
orderButton.onclick=()=>{renderOrder();orderDialog.showModal()};
document.getElementById('lunchCloseOrder').onclick=()=>orderDialog.close();
document.getElementById('lunchCloseCustomize').onclick=()=>customizeDialog.close();
orderDialog.addEventListener('click',e=>{if(e.target===orderDialog)orderDialog.close()});
customizeDialog.addEventListener('click',e=>{if(e.target===customizeDialog)customizeDialog.close()});
document.getElementById('lunchCopyOrder').onclick=async()=>{
  const text=compileText();
  try{await navigator.clipboard.writeText(text)}
  catch{
    const area=document.createElement('textarea');area.value=text;document.body.appendChild(area);area.select();document.execCommand('copy');area.remove();
  }
  const button=document.getElementById('lunchCopyOrder'),old=button.textContent;
  button.textContent='Copied ✓';setTimeout(()=>button.textContent=old,1000);
};
document.getElementById('lunchPrintOrder').onclick=()=>{if(!lunchOrder.length)return;buildPrint();window.print()};
document.getElementById('lunchClearOrder').onclick=()=>{if(!lunchOrder.length)return;lunchOrder=[];refreshBadge();renderOrder()};

refreshBadge();
})();