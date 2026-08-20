(()=> {
'use strict';

function ready(fn){
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn, {once:true});
  else fn();
}

ready(() => {
  const restaurantDialog = document.getElementById('restaurantDialog');
  const modalBody = document.getElementById('modalBody');
  const orderDialog = document.getElementById('lunchOrderDialog');
  const orderButton = document.getElementById('lunchOrderButton');
  const orderContents = document.getElementById('lunchOrderContents');
  const orderCount = document.getElementById('lunchOrderCount');

  if(!restaurantDialog || !modalBody || !orderDialog || !orderButton || !orderContents || !orderCount) return;

  function compiledOrderText(){
    if(window.lunchCompileText) return window.lunchCompileText();
    const blocks = [];
    orderContents.querySelectorAll('.order-group').forEach(group => {
      const lines = [];
      let sib = group.nextElementSibling;
      while(sib && !sib.classList.contains('order-group')){
        if(sib.classList.contains('order-line')){
          const title = sib.querySelector('h4')?.textContent?.trim() || '';
          const detail = sib.querySelector('.order-detail')?.textContent?.trim() || '';
          const note = sib.querySelector('.order-note')?.value?.trim() || '';
          let line = title;
          if(detail) line += "\n  " + detail.replace(/\s+/g,' ').trim();
          if(note) line += "\n  Note: " + note;
          lines.push(line);
        }
        sib = sib.nextElementSibling;
      }
      if(lines.length) blocks.push(group.textContent.trim() + "\n" + lines.join("\n"));
    });
    return blocks.join("\n\n");
  }

  function parseSummary(){
    let total = 0;
    let unknownUnits = 0;
    let itemCount = 0;

    orderContents.querySelectorAll('.order-line').forEach(line => {
      const title = line.querySelector('h4')?.textContent || '';
      const qtyMatch = title.match(/^\s*(\d+)\s*[x×]/i);
      const qty = qtyMatch ? Number(qtyMatch[1]) : 1;
      itemCount += qty;

      const detail = line.querySelector('.order-detail')?.textContent || '';
      const listedMatch = detail.match(/Listed:\s*([^\n]+)/i);
      if(!listedMatch){
        unknownUnits += qty;
        return;
      }

      const prices = [...listedMatch[1].matchAll(/\$\s*([0-9]+(?:\.[0-9]{1,2})?)/g)].map(m => Number(m[1]));
      if(prices.length === 1 && Number.isFinite(prices[0])) total += prices[0] * qty;
      else unknownUnits += qty;
    });

    if(!itemCount){
      const badge = Number(orderCount.textContent) || 0;
      itemCount = badge;
      if(badge > 0) unknownUnits = badge;
    }

    return {total, unknownUnits, itemCount};
  }

  function renderRail(){
    if(!restaurantDialog.open) return;

    let layout = modalBody.querySelector('.restaurant-menu-layout');
    let aside = modalBody.querySelector('#restaurantOrderSummary');
    if(!layout){
      const existing = [...modalBody.childNodes];
      const main = document.createElement('div');
      main.className = 'restaurant-menu-main';
      existing.forEach(node => main.appendChild(node));

      aside = document.createElement('aside');
      aside.className = 'restaurant-order-summary';
      aside.id = 'restaurantOrderSummary';
      aside.innerHTML = `
        <div class="restaurant-order-summary__card">
          <div class="restaurant-order-summary__top">
            <div class="restaurant-order-summary__eyebrow">Your order</div>
            <div class="restaurant-order-summary__count" data-summary-count>0 items</div>
          </div>
          <div class="restaurant-order-summary__label" data-summary-label>Running balance</div>
          <div class="restaurant-order-summary__balance" data-summary-balance>$0.00</div>
          <div class="restaurant-order-summary__warning" data-summary-warning hidden></div>
          <div class="restaurant-order-summary__ledger-title">Running list</div>
          <pre class="restaurant-order-summary__ledger" data-summary-ledger>No items yet.</pre>
          <button type="button" class="restaurant-checkout-btn" data-summary-checkout>Checkout</button>
          <div class="restaurant-order-summary__hint">Review, copy, or print the full order on checkout.</div>
        </div>
      `;
      aside.querySelector('[data-summary-checkout]').addEventListener('click', () => {
        if(restaurantDialog.open) restaurantDialog.close();
        setTimeout(() => orderButton.click(), 0);
      });

      layout = document.createElement('div');
      layout.className = 'restaurant-menu-layout';
      layout.append(main, aside);
      modalBody.appendChild(layout);
    }
    updateRail();
  }

  function updateRail(){
    const summary = document.getElementById('restaurantOrderSummary');
    if(!summary) return;

    const snap = parseSummary();
    summary.querySelector('[data-summary-count]').textContent = `${snap.itemCount} item${snap.itemCount === 1 ? '' : 's'}`;
    summary.querySelector('[data-summary-label]').textContent = snap.unknownUnits ? 'Known subtotal' : 'Running balance';
    summary.querySelector('[data-summary-balance]').textContent = `$${snap.total.toFixed(2)}`;

    const warning = summary.querySelector('[data-summary-warning]');
    if(snap.unknownUnits){
      warning.hidden = false;
      warning.textContent = `+ ${snap.unknownUnits} item${snap.unknownUnits === 1 ? '' : 's'} need${snap.unknownUnits === 1 ? 's' : ''} a price check`;
    } else {
      warning.hidden = true;
      warning.textContent = '';
    }

    const ledger = summary.querySelector('[data-summary-ledger]');
    const text = compiledOrderText().trim();
    ledger.textContent = text || 'No items yet.';
    summary.querySelector('[data-summary-checkout]').disabled = snap.itemCount === 0;
  }

  const prevOpenRestaurant = window.openRestaurant;
  if(typeof prevOpenRestaurant === 'function'){
    window.openRestaurant = function(...args){
      const result = prevOpenRestaurant.apply(this, args);
      requestAnimationFrame(renderRail);
      return result;
    };
  }

  new MutationObserver(() => {
    if(restaurantDialog.open) requestAnimationFrame(updateRail);
  }).observe(orderContents, {childList:true, subtree:true, characterData:true});

  new MutationObserver(() => {
    if(restaurantDialog.open) requestAnimationFrame(updateRail);
  }).observe(orderCount, {childList:true, subtree:true, characterData:true});
});
})();