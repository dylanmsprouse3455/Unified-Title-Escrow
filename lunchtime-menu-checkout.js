(()=>{
'use strict';

const restaurantDialog=document.getElementById('restaurantDialog');
const modalBody=document.getElementById('modalBody');
const orderDialog=document.getElementById('lunchOrderDialog');
const orderButton=document.getElementById('lunchOrderButton');
const orderContents=document.getElementById('lunchOrderContents');
const orderCount=document.getElementById('lunchOrderCount');

if(!restaurantDialog||!modalBody||!orderDialog||!orderButton||!orderContents||!orderCount)return;

let snapshotBusy=false;

function parseRenderedOrder(){
  let total=0;
  let unknownUnits=0;
  let itemCount=0;

  orderContents.querySelectorAll('.order-line').forEach(line=>{
    const title=line.querySelector('h4')?.textContent||'';
    const qtyMatch=title.match(/^\s*(\d+)\s*[x×]/i);
    const qty=qtyMatch?Number(qtyMatch[1]):1;
    itemCount+=qty;

    const detail=line.querySelector('.order-detail')?.textContent||'';
    const listedMatch=detail.match(/Listed:\s*([^\n]+)/i);
    if(!listedMatch){
      unknownUnits+=qty;
      return;
    }

    const prices=[...listedMatch[1].matchAll(/\$\s*([0-9]+(?:\.[0-9]{1,2})?)/g)].map(m=>Number(m[1]));
    if(prices.length===1 && Number.isFinite(prices[0])) total+=prices[0]*qty;
    else unknownUnits+=qty;
  });

  if(!itemCount){
    const badgeCount=Number(orderCount.textContent)||0;
    itemCount=badgeCount;
    if(badgeCount>0) unknownUnits=badgeCount;
  }

  return {total,unknownUnits,itemCount};
}

function getOrderSnapshot(){
  if(snapshotBusy)return parseRenderedOrder();

  const wasOpen=orderDialog.open;
  snapshotBusy=true;
  try{
    if(!wasOpen){
      orderDialog.classList.add('lunch-order-snapshotting');
      orderButton.click();
    }
    return parseRenderedOrder();
  }catch(err){
    return {total:0,unknownUnits:Number(orderCount.textContent)||0,itemCount:Number(orderCount.textContent)||0};
  }finally{
    if(!wasOpen && orderDialog.open)orderDialog.close();
    orderDialog.classList.remove('lunch-order-snapshotting');
    snapshotBusy=false;
  }
}

function updateSummary(){
  const summary=document.getElementById('restaurantOrderSummary');
  if(!summary)return;

  const snap=getOrderSnapshot();
  const countEl=summary.querySelector('[data-summary-count]');
  const labelEl=summary.querySelector('[data-summary-label]');
  const balanceEl=summary.querySelector('[data-summary-balance]');
  const warningEl=summary.querySelector('[data-summary-warning]');
  const checkout=summary.querySelector('[data-summary-checkout]');

  countEl.textContent=`${snap.itemCount} item${snap.itemCount===1?'':'s'}`;
  labelEl.textContent=snap.unknownUnits?'Known subtotal':'Running balance';
  balanceEl.textContent=`$${snap.total.toFixed(2)}`;

  if(snap.unknownUnits){
    warningEl.hidden=false;
    warningEl.textContent=`+ ${snap.unknownUnits} item${snap.unknownUnits===1?'':'s'} need${snap.unknownUnits===1?'s':''} a price check`;
  }else{
    warningEl.hidden=true;
    warningEl.textContent='';
  }

  checkout.disabled=snap.itemCount===0;
  checkout.textContent=snap.itemCount?`Checkout • ${snap.itemCount}`:'Checkout';
}

function checkout(){
  if(restaurantDialog.open)restaurantDialog.close();
  setTimeout(()=>orderButton.click(),0);
}

function mountSummary(){
  if(!restaurantDialog.open)return;
  if(modalBody.querySelector('.restaurant-menu-layout')){
    updateSummary();
    return;
  }

  const layout=document.createElement('div');
  layout.className='restaurant-menu-layout';

  const main=document.createElement('div');
  main.className='restaurant-menu-main';

  const existing=[...modalBody.childNodes];
  existing.forEach(node=>main.appendChild(node));

  const aside=document.createElement('aside');
  aside.className='restaurant-order-summary';
  aside.id='restaurantOrderSummary';
  aside.innerHTML=`
    <div class="restaurant-order-summary__top">
      <div class="restaurant-order-summary__eyebrow">Your order</div>
      <div class="restaurant-order-summary__count" data-summary-count>0 items</div>
    </div>
    <div class="restaurant-order-summary__label" data-summary-label>Running balance</div>
    <div class="restaurant-order-summary__balance" data-summary-balance>$0.00</div>
    <div class="restaurant-order-summary__warning" data-summary-warning hidden></div>
    <button type="button" class="restaurant-checkout-btn" data-summary-checkout>Checkout</button>
    <div class="restaurant-order-summary__hint">Review, copy, or print the full order on checkout.</div>`;

  aside.querySelector('[data-summary-checkout]').addEventListener('click',checkout);

  layout.append(main,aside);
  modalBody.appendChild(layout);
  updateSummary();
}

const previousOpenRestaurant=window.openRestaurant;
if(typeof previousOpenRestaurant==='function'){
  window.openRestaurant=function(restaurant){
    previousOpenRestaurant(restaurant);
    requestAnimationFrame(mountSummary);
  };
}

const countObserver=new MutationObserver(()=>{
  if(restaurantDialog.open)requestAnimationFrame(updateSummary);
});
countObserver.observe(orderCount,{childList:true,subtree:true,characterData:true});

const dialogObserver=new MutationObserver(()=>{
  if(restaurantDialog.open && !modalBody.querySelector('.restaurant-menu-layout'))requestAnimationFrame(mountSummary);
});
dialogObserver.observe(modalBody,{childList:true});

})();