(()=>{
'use strict';

const customizeBody=document.getElementById('lunchCustomizeBody');
const customizeDialog=document.getElementById('lunchCustomizeDialog');
const restaurantLabel=document.getElementById('lunchCustomizeRestaurant');
const itemLabel=document.getElementById('lunchCustomizeName');
if(!customizeBody||!customizeDialog||!restaurantLabel||!itemLabel)return;

const verifiedFallbacks={
  "Carter’s Corner Restaurant":{
    toppings:["Pepperoni","Meatballs","Sausage","Ham","Bacon","Hamburger","Chicken","Black Olives","Onions","Tomatoes","Sun-Dried Tomatoes","Spinach","Mushrooms","Banana Peppers","Bell Peppers","Jalapeños","Chopped Garlic","Broccoli","Pickles"],
    note:'Carter’s menu lists additional toppings at $1.00 for 12″ pizzas and $1.50 for 16″ pizzas.'
  },
  "Casa Nostra Italian Cuisine":{
    toppings:["Pepperoni","Sliced Italian Sausage","Hamburger","Bacon","Ham","Mushrooms","Onions","Green Peppers","Black Olives","Hot Banana Peppers","Spinach","Broccoli","Pineapple","Fresh Tomatoes","Ricotta Cheese","Feta Cheese","Fresh Garlic","Jalapeño Peppers"],
    note:'Verified from the saved Casa Nostra menu.'
  },
  "Rocky’s Pizza":{
    toppings:["Pepperoni","Sausage","Hamburger","Ham","Onion","Mushrooms","Green Peppers","Black Olives","Jalapeño Peppers","Green Olives","Banana Peppers","Pineapple","Steak","BBQ Chicken","Meatball","Bacon","Tomatoes","Spinach"],
    note:'Verified from the saved Rocky’s Pizza menu.'
  }
};

function isRealPizzaCustomizer(restaurant,item){
  if(restaurant==="Carter’s Corner Restaurant")return true;
  if(restaurant==="Casa Nostra Italian Cuisine")return true;
  if(restaurant==="Casa Express Italian Eatery")return true;
  if(restaurant==="Rocky’s Pizza")return /^(10 inch Individual|12 inch Small|14 inch Large|Build Your Own Pizza|Rocky’s Special)$/i.test(item);
  return false;
}

function addChoiceGroup(label,values,note){
  if(customizeBody.querySelector('[data-option-label]'))return;
  const notesBlock=document.getElementById('lunchCustomNotes')?.closest('.custom-block');
  if(!notesBlock)return;

  const block=document.createElement('div');
  block.className='custom-block pizza-audit-options';
  block.innerHTML=`<h4>${label}</h4><div class="option-chips" data-option-label="${encodeURIComponent(label)}"></div>${note?`<div class="verified-note">${note}</div>`:''}`;
  const chips=block.querySelector('.option-chips');
  values.forEach(value=>{
    const chip=document.createElement('button');
    chip.type='button';
    chip.className='option-chip';
    chip.dataset.value=encodeURIComponent(value);
    chip.textContent=value;
    chip.addEventListener('click',()=>chip.classList.toggle('selected'));
    chips.appendChild(chip);
  });
  notesBlock.before(block);
}

function applyFix(){
  const restaurant=(restaurantLabel.textContent||'').trim();
  const item=(itemLabel.textContent||'').trim();
  if(!restaurant||!item||!isRealPizzaCustomizer(restaurant,item))return;

  // Casa Express already has multiple verified sauce/meat/cheese/veggie groups in the main builder.
  if(restaurant==="Casa Express Italian Eatery")return;

  // If the main builder already supplied a topping group, leave it alone.
  if(customizeBody.querySelector('[data-option-label]'))return;

  const fallback=verifiedFallbacks[restaurant];
  if(fallback)addChoiceGroup('Toppings',fallback.toppings,fallback.note);
}

const observer=new MutationObserver(()=>queueMicrotask(applyFix));
observer.observe(customizeBody,{childList:true,subtree:true});
customizeDialog.addEventListener('toggle',applyFix);
document.addEventListener('click',e=>{
  if(e.target?.closest?.('.order-add'))setTimeout(applyFix,0);
},true);
})();
