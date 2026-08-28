(function(){
  'use strict';

  var OWNER_EMAIL='dylan.sprouse@unifiedtitle.net';
  var installed=false;

  function isDylan(){
    var user=document.getElementById('cloudUserEmail');
    return String(user&&user.textContent||'').trim().toLowerCase()===OWNER_EMAIL;
  }

  function openPrototype(){
    window.location.href='call-prototype.html';
  }

  function openCallbackFromQuery(){
    var params=new URLSearchParams(window.location.search);
    if(params.get('openCallback')!=='1')return;
    var button=document.getElementById('openCallTrackerTool');
    if(!button)return;
    params.delete('openCallback');
    var next=window.location.pathname+(params.toString()?'?'+params.toString():'')+window.location.hash;
    history.replaceState(null,'',next);
    button.click();
  }

  function install(){
    if(!isDylan())return;
    var panel=document.getElementById('dylanToolboxPanel');
    var existing=document.getElementById('openCallTrackerTool');
    if(!panel||!existing)return;

    var title=existing.querySelector('strong');
    if(title&&title.textContent!=='Callback Request Details')title.textContent='Callback Request Details';
    var description=existing.querySelector('small');
    if(description&&description.textContent!=='Track callbacks, check-ins, next actions, documents, and personal follow-ups.')description.textContent='Track callbacks, check-ins, next actions, documents, and personal follow-ups.';

    var list=existing.closest('.toolbox-card-list');
    if(!list)return;

    if(!document.getElementById('openDylanCallHub')){
      var hub=document.createElement('button');
      hub.id='openDylanCallHub';
      hub.type='button';
      hub.className='call-tool-card';
      hub.innerHTML='<span class="call-tool-icon">☏</span><span><strong>Call Tracker</strong><small>Log every incoming and outgoing call, search call history, and connect calls to files and follow-ups.</small></span><span class="call-tool-arrow">›</span>';
      hub.addEventListener('click',openPrototype);
      list.appendChild(hub);
    }

    openCallbackFromQuery();
    installed=true;
  }

  var observer=new MutationObserver(function(){
    install();
    if(installed&&document.getElementById('openDylanCallHub')){
      var title=document.querySelector('#openCallTrackerTool strong');
      if(title&&title.textContent!=='Callback Request Details')title.textContent='Callback Request Details';
    }
  });

  observer.observe(document.documentElement,{childList:true,subtree:true});
  setInterval(install,500);
  setTimeout(install,0);
})();

