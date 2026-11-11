/**
 * Sugestões de atividade e salvamento da atividade em andamento.
 */

let timerActivitySaveTimeout = null;
function flushRunningActivity() {
  clearTimeout(timerActivitySaveTimeout);
  const run = DB.getRunning(); if (!run) return;
  const activity = document.getElementById('activity-input').value.trim();
  run.activity = activity;
  writeSeq++; pendingWrites++;
  api('updateTimerActivity', { activity }).catch(() => {}).finally(() => { pendingWrites--; });
}
document.addEventListener('DOMContentLoaded', () => {
  const input = document.getElementById('activity-input');
  input.addEventListener('input', () => {
    const run = DB.getRunning(); if (!run) return;
    run.activity = input.value.trim();
    clearTimeout(timerActivitySaveTimeout);
    timerActivitySaveTimeout = setTimeout(flushRunningActivity, 600);
  });
  input.addEventListener('blur', () => { if (DB.getRunning()) flushRunningActivity(); });
});
let activitySuggestionRows = [];
let activitySuggestionIndex = -1;
function recentActivitySuggestions(query='') {
  if (!session?.teamCode) return [];
  const q = query.trim().toLocaleLowerCase('pt-BR');
  const entries = DB.getEntries().filter(e => e.user === session.username && e.teamCode === session.teamCode)
    .slice().sort((a,b) => String(b.date || '').localeCompare(String(a.date || '')) || String(b.startTime || '').localeCompare(String(a.startTime || '')));
  const seen = new Set(), suggestions = [];
  for (const entry of entries) {
    if (q && !String(entry.activity || '').toLocaleLowerCase('pt-BR').includes(q)) continue;
    const key = JSON.stringify([entry.activity, entry.cargo, entry.modalidade]
      .map(value => String(value || '').trim().toLocaleLowerCase('pt-BR')));
    if (seen.has(key)) continue;
    seen.add(key);
    suggestions.push(entry);
    if (suggestions.length === 5) break;
  }
  return suggestions;
}
function closeActivitySuggestions() {
  document.getElementById('activity-suggestions').hidden = true;
  const input = document.getElementById('activity-input');
  input.setAttribute('aria-expanded','false');
  input.removeAttribute('aria-activedescendant');
  activitySuggestionIndex = -1;
}
function showActivitySuggestions() {
  const input=document.getElementById('activity-input'), box=document.getElementById('activity-suggestions');
  if(input.disabled) return closeActivitySuggestions();
  activitySuggestionRows=recentActivitySuggestions(input.value);
  activitySuggestionIndex=-1;
  input.removeAttribute('aria-activedescendant');
  box.replaceChildren();
  activitySuggestionRows.forEach((entry,index)=>{
    const row=document.createElement('div');
    row.className='activity-suggestion';row.id='activity-suggestion-'+index;
    row.dataset.index=String(index);row.setAttribute('role','option');row.setAttribute('aria-selected','false');
    const description=document.createElement('span');description.className='activity-suggestion-description';description.textContent=entry.activity || '';description.title=entry.activity || '';row.append(description);
    const meta=document.createElement('span');meta.className='activity-suggestion-meta';
    if(entry.cargo){
      const cargo=document.createElement('span');cargo.className='activity-suggestion-cargo';cargo.title=entry.cargo;
      const dot=document.createElement('span');dot.className='activity-suggestion-dot';dot.style.backgroundColor=getCargoColor(entry.cargo, entry.cargoColor);
      const name=document.createElement('span');name.textContent=entry.cargo;cargo.append(dot,name);meta.append(cargo);
    }
    if(entry.modalidade){const place=document.createElement('span');place.className='activity-suggestion-place';place.textContent=entry.modalidade;place.title=entry.modalidade;meta.append(place);}
    row.append(meta);box.append(row);
  });
  box.hidden=!activitySuggestionRows.length;
  input.setAttribute('aria-expanded',String(!box.hidden));
}
function selectActivitySuggestion(index) {
  const entry=activitySuggestionRows[index],input=document.getElementById('activity-input');
  if(!entry || input.disabled || !session || entry.teamCode!==session.teamCode || entry.user!==session.username) return closeActivitySuggestions();
  input.value=entry.activity || '';
  if (DB.getRunning()) { closeActivitySuggestions(); flushRunningActivity(); return; }
  [['cargo',entry.cargo],['modalidade',entry.modalidade]].forEach(([type,value])=>{
    const select=document.getElementById(type+'-input'), next=value || '';
    // Opção local para reproduzir fielmente um valor histórico, sem cadastrar no servidor.
    if(!Array.from(select.options).some(o=>o.value===next))select.add(new Option(next,next));
    select.value=next;managedSelectPreviousValue[type]=next;
  });
  applyCargoSelectColor(document.getElementById('cargo-input'));syncCargoPickerTrigger();syncModalidadePickerTrigger();
  closeActivitySuggestions();
}
function updateSuggestions() {
  const input=document.getElementById('activity-input');
  if(document.activeElement===input)showActivitySuggestions();else closeActivitySuggestions();
}
document.addEventListener('DOMContentLoaded',()=>{
  const input=document.getElementById('activity-input'),box=document.getElementById('activity-suggestions'),wrap=document.getElementById('activity-autocomplete');
  input.addEventListener('focus',showActivitySuggestions);input.addEventListener('click',showActivitySuggestions);input.addEventListener('input',showActivitySuggestions);
  box.addEventListener('mousedown',e=>e.preventDefault());
  box.addEventListener('click',e=>{const row=e.target.closest('.activity-suggestion');if(row)selectActivitySuggestion(Number(row.dataset.index));});
  input.addEventListener('keydown',e=>{
    if(e.key==='Escape'){closeActivitySuggestions();return;}
    if(e.key==='ArrowDown'||e.key==='ArrowUp'){
      e.preventDefault();if(box.hidden)showActivitySuggestions();if(!activitySuggestionRows.length)return;
      const count=activitySuggestionRows.length;
      activitySuggestionIndex=e.key==='ArrowDown'?(activitySuggestionIndex+1)%count:(activitySuggestionIndex<0?count-1:(activitySuggestionIndex-1+count)%count);
      Array.from(box.children).forEach((row,i)=>row.setAttribute('aria-selected',String(i===activitySuggestionIndex)));
      const row=box.children[activitySuggestionIndex];input.setAttribute('aria-activedescendant',row.id);row.scrollIntoView({block:'nearest'});
    }else if(e.key==='Enter'&&!box.hidden&&activitySuggestionIndex>=0){e.preventDefault();selectActivitySuggestion(activitySuggestionIndex);}
  });
  document.addEventListener('click',e=>{if(!wrap.contains(e.target))closeActivitySuggestions();});
  wrap.addEventListener('focusout',e=>{if(!wrap.contains(e.relatedTarget))closeActivitySuggestions();});
});
