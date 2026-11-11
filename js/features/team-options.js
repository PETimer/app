/**
 * Opções da equipe: cargos/projetos, modalidades, seletores e diálogo de confirmação.
 */

const DEFAULT_CARGOS = [
  { name:'Cargo de apoio', color:'#276097' },
  { name:'Geral', color:'#334155' },
  { name:'Operacional (grupo)', color:'#6b5b95' },
  { name:'Projetos', color:'#2f7d68' },
  { name:'Graduação', color:'#9a6b2f' }
];
const DEFAULT_MODALIDADES = ['Fixo','Home office','Flexível'];

const SECURITY_QUESTIONS = {
  q1: 'Qual o nome do seu primeiro animal de estimação?',
  q2: 'Qual o nome da cidade onde você nasceu?',
  q3: 'Qual o nome do seu melhor amigo de infância?',
  q4: 'Qual foi o modelo do seu primeiro carro ou bicicleta?',
  q5: 'Qual o nome da sua escola primária?'
};
document.addEventListener('DOMContentLoaded', () => {
  const sel = document.getElementById('reg-question');
  if (sel) {
    Object.keys(SECURITY_QUESTIONS).forEach(id => {
      const opt = document.createElement('option');
      opt.value = id; opt.textContent = SECURITY_QUESTIONS[id];
      sel.appendChild(opt);
    });
  }
});
let managingOptionType = null;
const managedSelectPreviousValue = { cargo:'', modalidade:'' };

function ensureTeamOptionConfig() {
  if (!session || !session.teamCode) return null;
  const teams = DB.getTeams();
  const team = teams[session.teamCode];
  if (!team) return null;
  if (!Array.isArray(team.cargos) || !team.cargos.length) team.cargos = DEFAULT_CARGOS.map(x => ({...x}));
  else team.cargos = team.cargos.map(c => typeof c === 'string' ? {name:c,color:'#334155'} : {name:c.name,color:c.color || '#334155'});
  if (!Array.isArray(team.modalidades) || !team.modalidades.length) team.modalidades = [...DEFAULT_MODALIDADES];
  teams[session.teamCode] = team;
  DB.saveTeams(teams);
  return team;
}

function getCargoOptions() {
  const team = ensureTeamOptionConfig();
  return team ? team.cargos : DEFAULT_CARGOS;
}
function getModalidadeOptions() {
  const team = ensureTeamOptionConfig();
  return team ? team.modalidades : DEFAULT_MODALIDADES;
}
function getCargoColor(name, fallback = '#334155') {
  const found = getCargoOptions().find(c => c.name === name);
  return found ? found.color : fallback;
}
function cargoOptionsHTML(selected='', includeManage=true) {
  const manage = includeManage ? '<option class="manage-select-option" value="__manage__">＋ Adicionar / gerenciar</option>' : '';
  return manage + getCargoOptions().map(c => `<option value="${escapeHtml(c.name)}" style="color:${c.color};font-weight:600;" ${c.name===selected?'selected':''}>${escapeHtml(c.name)}</option>`).join('');
}
function modalidadeOptionsHTML(selected='', includeManage=true) {
  const manage = includeManage ? '<option class="manage-select-option" value="__manage__">＋ Adicionar</option>' : '';
  const empty = `<option value="" ${!selected?'selected':''}>&nbsp;</option>`;
  const opts = getModalidadeOptions().map(m => `<option value="${escapeHtml(m)}" ${m===selected?'selected':''}>${escapeHtml(m)}</option>`).join('');
  return manage + empty + opts;
}
function populateManagedSelects(preserve=true) {
  const cargoEl=document.getElementById('cargo-input'), modEl=document.getElementById('modalidade-input');
  if(!cargoEl||!modEl||!session||!session.teamCode)return;
  const cargoCurrent=(preserve?cargoEl.value:managedSelectPreviousValue.cargo)||managedSelectPreviousValue.cargo;
  const modCurrent=preserve&&modEl.value!=='__manage__'?modEl.value:managedSelectPreviousValue.modalidade;
  cargoEl.innerHTML=cargoOptionsHTML(cargoCurrent,true); modEl.innerHTML=modalidadeOptionsHTML(modCurrent);
  const cargos=getCargoOptions(), modalidades=getModalidadeOptions(), cargoObj=cargos.find(c=>c.name===cargoCurrent);
  const cargoNext=cargoObj?cargoCurrent:(cargos[0]?.name||'__manage__');
  const modNext=modCurrent&&modalidades.includes(modCurrent)?modCurrent:'';
  cargoEl.value=cargoNext; modEl.value=modNext; if(cargoNext)managedSelectPreviousValue.cargo=cargoNext; if(modNext!=='__manage__')managedSelectPreviousValue.modalidade=modNext;
  applyCargoSelectColor(cargoEl); syncCargoPickerTrigger(); syncModalidadePickerTrigger();
}
function applyCargoSelectColor(select) {
  if (!select) return;
  select.style.color = select.value && select.value !== '__manage__' ? getCargoColor(select.value) : 'var(--text)';
  select.style.fontWeight = select.value && select.value !== '__manage__' ? '600' : '400';
}
function handleManagedSelectChange(type, select) {
  if (select.value === '__manage__') {
    openOptionsManager(type, managedSelectPreviousValue[type] || '');
    return;
  }
  managedSelectPreviousValue[type] = select.value;
  if (type === 'cargo') applyCargoSelectColor(select);
}
function syncModalidadePickerTrigger(){
  const trigger=document.getElementById('modalidade-picker-trigger'),select=document.getElementById('modalidade-input');if(!trigger||!select)return;
  const span=trigger.querySelector('.cargo-picker-label');if(span)span.textContent=select.value&&select.value!=='__manage__'?select.value:'';
}
function toggleModalidadePicker(event){
  event?.stopPropagation();const pop=document.getElementById('modalidade-picker-popover');if(!pop)return;
  const opening=pop.hidden;closeCargoPicker();pop.hidden=!opening;
  document.getElementById('modalidade-picker-trigger')?.setAttribute('aria-expanded',String(opening));
  if(opening){const q=document.getElementById('modalidade-picker-search');if(q)q.value='';renderModalidadePicker('');setTimeout(()=>q?.focus(),0);}
}
function closeModalidadePicker(){
  const pop=document.getElementById('modalidade-picker-popover');if(pop)pop.hidden=true;
  document.getElementById('modalidade-picker-trigger')?.setAttribute('aria-expanded','false');
}
function toggleModalidadeOption(encoded,checked){
  const select=document.getElementById('modalidade-input');if(!select)return;
  const value=checked?decodeURIComponent(encoded):'';
  if(value&&!Array.from(select.options).some(o=>o.value===value))select.add(new Option(value,value));
  select.value=value;managedSelectPreviousValue.modalidade=value;
  syncModalidadePickerTrigger();closeModalidadePicker();
}
function renderModalidadePicker(filter=''){
  const host=document.getElementById('modalidade-picker-list'),select=document.getElementById('modalidade-input');if(!host)return;
  const q=String(filter||'').trim().toLocaleLowerCase('pt-BR'),current=select?select.value:'';
  const items=getModalidadeOptions().filter(m=>!q||m.toLocaleLowerCase('pt-BR').includes(q));
  if(!items.length){host.innerHTML='<div class="empty" style="padding:18px">Nenhum local encontrado.</div>';return;}
  host.innerHTML=items.map(m=>`<label class="modalidade-option"><input type="checkbox" ${m===current?'checked':''} onchange="toggleModalidadeOption('${encodeURIComponent(m)}',this.checked)"><span>${escapeHtml(m)}</span></label>`).join('');
}
document.addEventListener('click',event=>{const wrap=document.querySelector('.modalidade-picker-wrap');if(wrap&&!wrap.contains(event.target))closeModalidadePicker();});
function syncCargoPickerTrigger(){
  const trigger=document.getElementById('cargo-picker-trigger'),select=document.getElementById('cargo-input');if(!trigger||!select)return;
  const label=select.value||'Cargo/Projeto';const span=trigger.querySelector('.cargo-picker-label');if(span)span.textContent=label;trigger.style.color=select.value?getCargoColor(select.value):'var(--text)';
}
function toggleCargoPicker(event){event?.stopPropagation();const pop=document.getElementById('cargo-picker-popover');if(!pop)return;const opening=pop.hidden;pop.hidden=!opening;document.getElementById('cargo-picker-trigger')?.setAttribute('aria-expanded',String(opening));if(opening){const q=document.getElementById('cargo-picker-search');if(q)q.value='';renderCargoPicker('');setTimeout(()=>q?.focus(),0);}}
function closeCargoPicker(){const pop=document.getElementById('cargo-picker-popover');if(pop)pop.hidden=true;document.getElementById('cargo-picker-trigger')?.setAttribute('aria-expanded','false');}
function selectCargoFromPicker(encodedCargo){const cargo=decodeURIComponent(encodedCargo),select=document.getElementById('cargo-input');if(!select)return;select.value=cargo;managedSelectPreviousValue.cargo=cargo;applyCargoSelectColor(select);syncCargoPickerTrigger();closeCargoPicker();}
function renderCargoPicker(filter=''){const host=document.getElementById('cargo-picker-projects');if(!host)return;const q=String(filter||'').trim().toLocaleLowerCase('pt-BR');const items=getCargoOptions().filter(c=>!q||c.name.toLocaleLowerCase('pt-BR').includes(q));if(!items.length){host.innerHTML='<div class="empty" style="padding:18px">Nenhum cargo ou projeto encontrado.</div>';return;}host.innerHTML=items.map(c=>{const enc=encodeURIComponent(c.name);return `<div class="cargo-project-block"><div class="cargo-project-row"><div class="cargo-project-main" onclick="selectCargoFromPicker('${enc}')"><span class="cargo-project-dot" style="background:${c.color}"></span><span class="cargo-project-name" style="color:${c.color}">${escapeHtml(c.name)}</span></div></div></div>`;}).join('');}
document.addEventListener('click',event=>{const wrap=document.querySelector('.cargo-select-wrap');if(wrap&&!wrap.contains(event.target))closeCargoPicker();});
function openOptionsManager(type, fallback='') {
  if (!isTeamAdmin()) { alert('Somente administradores podem gerenciar cargos e locais.'); return; }
  managingOptionType = type;
  if (fallback && fallback !== '__manage__') managedSelectPreviousValue[type] = fallback;
  const modal = document.getElementById('manage-options-modal');
  const title = document.getElementById('manage-options-title');
  const color = document.getElementById('manage-option-color');
  const row = document.getElementById('manage-create-row');
  const name = document.getElementById('manage-option-name');
  title.textContent = type === 'cargo' ? 'Adicionar ou excluir cargo/projeto' : 'Adicionar ou excluir local de trabalho';
  color.hidden = type !== 'cargo';
  row.classList.toggle('no-color', type !== 'cargo');
  name.placeholder = type === 'cargo' ? 'Nome do cargo ou projeto' : 'Nome do local/modalidade';
  name.value = '';
  if (type === 'cargo') color.value = '#276097';
  renderManagedOptionsList();
  modal.hidden = false;
  name.onkeydown = (event) => {
    if (event.key === 'Enter') { event.preventDefault(); addManagedOption(); }
  };
  setTimeout(()=>name.focus(),0);
}
function closeOptionsManager() {
  document.getElementById('manage-options-modal').hidden = true;
  const type = managingOptionType;
  const select = document.getElementById(type === 'cargo' ? 'cargo-input' : 'modalidade-input');
  if (select) {
    const values = type === 'cargo' ? getCargoOptions().map(c=>c.name) : getModalidadeOptions();
    const previous = managedSelectPreviousValue[type];
    const next = values.includes(previous) ? previous : (type === 'modalidade' ? '' : (values[0] || '__manage__'));
    select.value = next;
    if (next !== '__manage__') managedSelectPreviousValue[type] = next;
  }
  if (type === 'cargo') applyCargoSelectColor(select);
  syncModalidadePickerTrigger();
  managingOptionType = null;
}
function renderManagedOptionsList() {
  const list = document.getElementById('manage-options-list');
  const items = managingOptionType === 'cargo' ? getCargoOptions() : getModalidadeOptions().map(name=>({name}));
  list.innerHTML = items.length ? items.map(item => `
      <div class="manage-item">
        ${managingOptionType === 'cargo' ? `${isTeamAdmin() ? `<span class="manage-color-edit"><button type="button" class="manage-color-dot" style="background:${item.color}" title="Alterar cor" aria-label="Alterar cor de ${escapeHtml(item.name)}" ${isActionPending('cargo-color:' + session.teamCode + ':' + item.name) ? 'disabled' : ''} onclick="this.nextElementSibling.click()"></button><input type="color" value="${item.color}" aria-label="Cor de ${escapeHtml(item.name)}" tabindex="-1" onchange="updateManagedCargoColor('${encodeURIComponent(item.name)}', this.value, this.previousElementSibling)"></span>` : `<span class="manage-color-dot" style="background:${item.color}"></span>`}` : '<span class="line-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z"></path><circle cx="12" cy="10" r="2.5"></circle></svg></span>'}
        <span class="manage-item-name" ${managingOptionType === 'cargo' ? `style="color:${item.color}"` : ''}>${escapeHtml(item.name)}</span>
        <button class="manage-delete" type="button" onclick="deleteManagedOption('${encodeURIComponent(item.name)}', this)" title="Excluir" aria-label="Excluir ${escapeHtml(item.name)}"><svg viewBox="0 0 24 24"><path d="M4 7h16"></path><path d="M10 11v6"></path><path d="M14 11v6"></path><path d="M9 7V4h6v3"></path><path d="M6 7l1 14h10l1-14"></path></svg></button>
      </div>`).join('') : '<div class="empty">Nenhuma opção cadastrada.</div>';
}
async function updateManagedCargoColor(encodedName, color, button) {
  const code = session?.teamCode, actor = session?.username;
  const team = DB.getTeams()[code], name = decodeURIComponent(encodedName);
  if (!team || !isTeamAdmin() || !/^#[0-9a-f]{6}$/i.test(color)) return;
  const cargo = team.cargos.find(c => c.name === name);
  const key = 'cargo-color:' + code + ':' + name;
  if (!cargo || cargo.color === color || isActionPending(key) || isActionPending('delete-option:cargo:' + name)) return;
  return runOnce(key, button, null, async () => {
    const previous = cargo.color;
    writeSeq++; pendingWrites++; cargo.color = color;
    const repaint = () => {
      if (session?.teamCode !== code || session?.username !== actor) return;
      refreshAppViews(); populateManagedSelects(); renderCargoPicker(); updateSuggestions();
      if (managingOptionType === 'cargo') renderManagedOptionsList();
    };
    try {
      repaint();
      await api('updateOptionColor', {code, type:'cargo', name, color});
    } catch (err) { const currentCargo = team.cargos.find(c => c.name === name); if (currentCargo) currentCargo.color = previous; repaint(); alert(err.message); }
    finally { pendingWrites--; }
  }).finally(() => {
    if (session?.teamCode === code && managingOptionType === 'cargo') renderManagedOptionsList();
  });
}
async function addManagedOption(btn) {
  const input = document.getElementById('manage-option-name');
  const name = input.value.trim();
  if (!name) return;
  const type = managingOptionType;
  const color = document.getElementById('manage-option-color').value || '#276097';
  const key = `add-option:${type}`;
  if (isActionPending(key)) return;
  if (!btn) btn = document.querySelector('#manage-create-row .manage-add-btn');
  return runOnce(key, btn, 'Adicionando...', async () => {
  try {
    await api('addOption', { code: session.teamCode, type, name, color });
    await refreshTeamData();
    populateManagedSelects(false);
    const select = document.getElementById(type === 'cargo' ? 'cargo-input' : 'modalidade-input');
    select.value = name;
    managedSelectPreviousValue[type] = name;
    if (type === 'cargo') applyCargoSelectColor(select);
    syncModalidadePickerTrigger();
    input.value = '';
    renderManagedOptionsList();
    renderEntries();
  } catch (err) { alert(err.message); }
  });
}
// Caixa de confirmação no centro da tela (no lugar do confirm() do navegador).
// Retorna uma Promise<boolean>. Use **texto** na mensagem para negrito.
function appConfirm({ title = 'Confirmar', message = '', note = '', confirmText = 'Confirmar', cancelText = 'Cancelar', danger = true } = {}) {
  return new Promise(resolve => {
    const overlay = document.getElementById('app-confirm-overlay');
    if (!overlay || !overlay.hidden) { resolve(false); return; }
    const okBtn = document.getElementById('app-confirm-ok');
    const cancelBtn = document.getElementById('app-confirm-cancel');
    const xBtn = document.getElementById('app-confirm-x');
    const noteEl = document.getElementById('app-confirm-note');
    document.getElementById('app-confirm-title').textContent = title;
    document.getElementById('app-confirm-text').innerHTML = escapeHtml(message).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    noteEl.textContent = note; noteEl.hidden = !note;
    okBtn.textContent = confirmText; cancelBtn.textContent = cancelText;
    okBtn.classList.toggle('profile-btn-danger', !!danger);
    okBtn.classList.toggle('profile-btn-primary', !danger);
    const previousFocus = document.activeElement;
    const finish = value => {
      overlay.hidden = true;
      document.removeEventListener('keydown', onKey, true);
      overlay.removeEventListener('click', onBackdrop);
      okBtn.onclick = cancelBtn.onclick = xBtn.onclick = null;
      if (previousFocus && previousFocus.focus) previousFocus.focus();
      resolve(value);
    };
    const onKey = ev => {
      if (ev.key === 'Escape') { ev.preventDefault(); ev.stopPropagation(); finish(false); }
    };
    const onBackdrop = ev => { if (ev.target === overlay) finish(false); };
    okBtn.onclick = () => finish(true);
    cancelBtn.onclick = xBtn.onclick = () => finish(false);
    document.addEventListener('keydown', onKey, true);
    overlay.addEventListener('click', onBackdrop);
    overlay.hidden = false;
    cancelBtn.focus(); // foco no "Cancelar": Enter sem querer não exclui nada
  });
}

async function deleteManagedOption(encodedName, btn) {
  const name = decodeURIComponent(encodedName);
  const type = managingOptionType;
  const key = `delete-option:${type}:${name}`;
  if (isActionPending(key) || (type === 'cargo' && isActionPending('cargo-color:' + session.teamCode + ':' + name))) return;
  const kindLabel = type === 'cargo' ? 'cargo/projeto' : 'local';
  const confirmed = await appConfirm({
    title: `Excluir ${kindLabel}`,
    message: `Tem certeza que deseja excluir **${name}**?`,
    note: 'Os registros já criados manterão o nome salvo.',
    confirmText: 'Excluir'
  });
  if (!confirmed) return;
  return runOnce(key, btn, null, async () => {
  try {
    await api('deleteOption', { code: session.teamCode, type, name });
    await refreshTeamData();
    if (managedSelectPreviousValue[type] === name) managedSelectPreviousValue[type] = '';
    populateManagedSelects(false);
    renderManagedOptionsList();
    renderEntries();
  } catch (err) { alert(err.message); }
  });
}
