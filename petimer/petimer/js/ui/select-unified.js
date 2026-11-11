/**
 * Lista de opções arredondada e igual em todo o site (par do css/select-unified.css).
 */

/* Substitui a lista quadrada nativa dos <select> por uma lista arredondada, igual em todo o site.
   Funciona por delegação de eventos: o <select> continua sendo o campo real (valor, onchange, re-renderizações). */
(function(){
  if(!window.matchMedia||!matchMedia('(hover:hover) and (pointer:fine)').matches)return; // em celular, mantém o seletor nativo
  var menu=null,owner=null,items=[],active=-1;
  function usable(sel){
    return sel&&sel.tagName==='SELECT'&&!sel.disabled&&!sel.multiple&&!(sel.size>1)&&!/pointer-events:\s*none/.test(sel.getAttribute('style')||'');
  }
  function close(){
    if(menu){menu.remove();menu=null;}
    if(owner){owner.setAttribute('aria-expanded','false');}
    owner=null;items=[];active=-1;
  }
  function setActive(i,scroll){
    if(!items.length)return;
    i=Math.max(0,Math.min(items.length-1,i));
    while(items[i]&&items[i].getAttribute('aria-disabled')==='true'){i+=(i>=active?1:-1);if(i<0||i>=items.length)return;}
    if(active>-1&&items[active])items[active].removeAttribute('data-active');
    active=i;items[i].setAttribute('data-active','1');
    if(scroll)items[i].scrollIntoView({block:'nearest'});
  }
  function choose(i){
    var sel=owner,opt=sel&&sel.options[i];
    if(!opt||opt.disabled)return;
    var changed=sel.selectedIndex!==i;
    close();
    if(changed){
      sel.selectedIndex=i;
      sel.dispatchEvent(new Event('input',{bubbles:true}));
      sel.dispatchEvent(new Event('change',{bubbles:true}));
    }
    sel.focus();
  }
  function open(sel){
    close();
    owner=sel;sel.setAttribute('aria-expanded','true');
    menu=document.createElement('div');
    menu.className='ui-select-menu';menu.setAttribute('role','listbox');
    var cs=getComputedStyle(sel);
    Array.prototype.forEach.call(sel.options,function(opt,i){
      if(opt.hidden)return;
      var it=document.createElement('div');
      it.className='ui-select-item'+(opt.value==='__manage__'||opt.className.indexOf('manage-select-option')>-1?' is-manage':'');
      it.setAttribute('role','option');it.dataset.index=i;
      it.setAttribute('aria-selected',i===sel.selectedIndex?'true':'false');
      if(opt.disabled)it.setAttribute('aria-disabled','true');
      var label=document.createElement('span');label.textContent=opt.textContent;it.appendChild(label);
      if(opt.style&&opt.style.color)label.style.color=opt.style.color;
      it.addEventListener('mousemove',function(){var k=items.indexOf(it);if(k!==active)setActive(k,false);});
      it.addEventListener('mousedown',function(e){e.preventDefault();e.stopPropagation();choose(i);});
      menu.appendChild(it);items.push(it);
    });
    document.body.appendChild(menu);
    var r=sel.getBoundingClientRect(),vh=window.innerHeight,vw=window.innerWidth;
    menu.style.minWidth=Math.max(r.width,120)+'px';
    menu.style.maxHeight=Math.min(300,vh-24)+'px';
    var mh=menu.offsetHeight,mw=menu.offsetWidth;
    var below=vh-r.bottom-10,above=r.top-10,up=mh>below&&above>below;
    var top=up?Math.max(8,r.top-mh-6):r.bottom+6;
    if(!up&&top+mh>vh-8)top=Math.max(8,vh-mh-8);
    var left=Math.min(Math.max(8,r.left),Math.max(8,vw-mw-8));
    menu.style.top=top+'px';menu.style.left=left+'px';
    if(up)menu.setAttribute('data-up','1');
    var cur=items.findIndex(function(el){return el.getAttribute('aria-selected')==='true';});
    setActive(cur>-1?cur:0,true);
  }
  // abre ao clicar (bloqueia a lista nativa)
  document.addEventListener('mousedown',function(e){
    var t=e.target;
    if(menu&&menu.contains(t))return;
    var sel=t&&t.closest?t.closest('select'):null;
    if(usable(sel)){
      e.preventDefault();
      var same=owner===sel;
      sel.focus();
      if(same)close();else open(sel);
      return;
    }
    if(menu)close();
  },true);
  // teclado: abrir e navegar
  document.addEventListener('keydown',function(e){
    if(menu){
      if(e.key==='ArrowDown'){e.preventDefault();setActive(active+1,true);}
      else if(e.key==='ArrowUp'){e.preventDefault();setActive(active-1,true);}
      else if(e.key==='Home'){e.preventDefault();setActive(0,true);}
      else if(e.key==='End'){e.preventDefault();setActive(items.length-1,true);}
      else if(e.key==='Enter'||e.key===' '){e.preventDefault();if(active>-1)choose(+items[active].dataset.index);}
      else if(e.key==='Escape'){e.preventDefault();var s=owner;close();if(s)s.focus();}
      else if(e.key==='Tab'){close();}
      return;
    }
    var t=e.target;
    if(usable(t)&&(e.key==='ArrowDown'||e.key==='ArrowUp'||e.key==='Enter'||e.key===' ')&&!e.altKey&&!e.ctrlKey&&!e.metaKey){
      e.preventDefault();open(t);
    }
  },true);
  window.addEventListener('resize',close);
  window.addEventListener('blur',close);
  document.addEventListener('scroll',function(e){if(menu&&!menu.contains(e.target))close();},true);
})();
