(()=>{
  document.addEventListener('click', (event)=>{
    const button=event.target.closest('#wizardResults button');
    if(!button || !/^View menu$/i.test(button.textContent.trim())) return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    const card=button.closest('.match-card');
    const heading=card?.querySelector('h4')?.textContent?.trim() || '';
    const restaurantName=heading.replace(/^\d+\.\s*/, '').trim();
    const restaurant=restaurants.find(r=>r.name===restaurantName);
    if(!restaurant) return;

    const quiz=document.getElementById('wizardDialog');
    if(quiz?.open) quiz.close();
    openRestaurant(restaurant);
  }, true);
})();