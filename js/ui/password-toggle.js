/**
 * Botão "olho" (mostrar/ocultar) em todos os campos de senha.
 */

/* Adiciona o botão "olho" (mostrar/ocultar) em todos os campos de senha do site */
(function(){
  var EYE='<svg class="pw-eye" viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg>'
          +'<svg class="pw-eye-off" viewBox="0 0 24 24" aria-hidden="true"><path d="M9.9 5.2A10.4 10.4 0 0 1 12 5c6.4 0 10 7 10 7a17.6 17.6 0 0 1-3.2 4.1"/><path d="M6.6 6.6C3.7 8.4 2 12 2 12s3.6 7 10 7c1.7 0 3.2-.4 4.5-1.1"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/><path d="m3 3 18 18"/></svg>';

  function enhance(input){
    if(input.dataset.pwEnhanced) return;
    input.dataset.pwEnhanced='1';
    var wrap=document.createElement('div');
    wrap.className='pw-wrap';
    input.parentNode.insertBefore(wrap,input);
    wrap.appendChild(input);
    var btn=document.createElement('button');
    btn.type='button';
    btn.className='pw-toggle';
    btn.setAttribute('aria-label','Mostrar senha');
    btn.title='Mostrar senha';
    btn.innerHTML=EYE;
    btn.addEventListener('mousedown',function(e){e.preventDefault();});
    btn.addEventListener('click',function(){
      var show=input.type==='password';
      input.type=show?'text':'password';
      btn.classList.toggle('shown',show);
      var label=show?'Ocultar senha':'Mostrar senha';
      btn.setAttribute('aria-label',label);
      btn.title=label;
    });
    wrap.appendChild(btn);
  }

  function scan(){
    document.querySelectorAll('input[type="password"]').forEach(enhance);
  }

  function start(){
    scan();
    new MutationObserver(scan).observe(document.body,{childList:true,subtree:true});
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',start); else start();
})();
