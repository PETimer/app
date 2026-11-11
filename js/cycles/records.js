/**
 * Registros de períodos, modal de dados e aviso de período encerrado.
 */

function memberCycleProgress(cycle, username) {
  const old=session.username; session.username=username; const result=computeCycleProgress(cycle); session.username=old; return result;
}
function cycleTimeLeft(cycle){ const ms=new Date(cycle.endDate+'T23:59:59').getTime()-Date.now(); if(ms<=0)return 'Encerrado'; const d=Math.floor(ms/86400000),h=Math.floor(ms%86400000/3600000); return d?`${d}d ${h}h`:`${h}h`; }
function cycleStatusLabel(cycle){
  const today=localDateStr(new Date());
  if(today<cycle.startDate) return '<span class="status-badge status-neutral">Agendado</span>';
  if(today>cycle.endDate) return '<span class="status-badge status-neutral">Encerrado</span>';
  return '<span class="status-badge status-active">Ativo</span>';
}
function cycleGoalText(cycle){
  const h=Math.floor(cycle.goalMinutes/60),m=cycle.goalMinutes%60,u=CYCLE_UNIT_TEXT[cycle.unit];
  return `${m?`${h}h ${m}m`:`${h}h`} ${u.por}`;
}
function cycleParticipants(cycle){
  const team=DB.getTeams()[session.teamCode]||{}, users=DB.getUsers();
  return Object.keys(team.members||{}).filter(u=>u!==team.admin||adminParticipatesInCycle()).map(u=>{
    const p=memberCycleProgress(cycle,u), avg=p.loggedMs/Math.max(1,p.totalPeriods);
    return {username:u,name:users[u]?.name||u,progress:p,avg};
  });
}
function cycleMemberInitials(name){
  const parts=String(name||'').trim().split(/\s+/).filter(Boolean);
  if(!parts.length)return '?';
  return (parts.length===1?parts[0].slice(0,2):parts[0][0]+parts[parts.length-1][0]).toUpperCase();
}
function renderCycleMembersTable(cycle,filter=''){
  const participants=cycleParticipants(cycle);
  const q=String(filter||'').trim().toLocaleLowerCase('pt-BR');
  const filtered=q?participants.filter(x=>String(x.name||'').toLocaleLowerCase('pt-BR').includes(q)||String(x.username||'').toLocaleLowerCase('pt-BR').includes(q)):participants;
  const rows=filtered.map(x=>`<tr><td><div class="cycle-data-member"><span class="cycle-data-avatar">${escapeHtml(cycleMemberInitials(x.name))}</span><span class="cycle-data-member-name">${escapeHtml(x.name)}</span></div></td><td>${formatHM(x.progress.loggedMs)}</td><td><strong>${formatHM(x.avg)}</strong></td><td>${formatHM(x.progress.remainingMs)}</td></tr>`).join('');
  return `<div class="cycle-data-table-card"><div class="cycle-data-table-head"><h4>Médias dos membros no período</h4><label class="cycle-data-search"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"></circle><path d="m20 20-4-4"></path></svg><input type="search" id="cycle-data-search-input" placeholder="Buscar membro..." autocomplete="off" aria-label="Buscar membro" oninput="filterCycleDataMembers(this.value)"></label></div><div class="cycle-data-table-scroll"><table class="cycle-data-table"><thead><tr><th>Membro</th><th>Tempo registrado</th><th>Média no período</th><th>Tempo restante</th></tr></thead><tbody>${rows||'<tr><td class="cycle-data-empty" colspan="4">Nenhum participante encontrado.</td></tr>'}</tbody></table></div></div>`;
}
let activeCycleDataModalId=null;
let activeCycleDataShowHistory=false;
let activeCycleDataTab='info';
function renderCycleDataBody(cycle,filter=''){
  const tab=activeCycleDataTab;
  const tabs=`<div class="cdm-tabs" role="tablist"><button type="button" role="tab" class="cdm-tab${tab==='info'?' active':''}" aria-selected="${tab==='info'}" onclick="setCycleDataTab('info')">Informações</button><button type="button" role="tab" class="cdm-tab${tab==='members'?' active':''}" aria-selected="${tab==='members'}" onclick="setCycleDataTab('members')">Membros</button></div>`;
  const panel=tab==='info' ? renderCycleInfoPanel(cycle,{history:activeCycleDataShowHistory}) : renderCycleMembersTable(cycle,filter);
  const count=document.getElementById('cycle-data-member-count');
  if(count){
    const total=cycleParticipants(cycle).length;
    count.textContent=tab==='members' ? `${total} ${total===1?'membro':'membros'} no período` : '';
  }
  return `${tabs}<div class="cdm-panel" role="tabpanel">${panel}</div>`;
}
function setCycleDataTab(tab){
  if(!activeCycleDataModalId||activeCycleDataTab===tab)return;
  const cycle=DB.getCycles().find(c=>c.id===activeCycleDataModalId&&c.teamCode===session.teamCode);
  const body=document.getElementById('cycle-data-modal-body');
  if(!cycle||!body)return;
  activeCycleDataTab=tab;
  body.innerHTML=renderCycleDataBody(cycle);
}
function filterCycleDataMembers(value){
  if(!activeCycleDataModalId)return;
  const cycle=DB.getCycles().find(c=>c.id===activeCycleDataModalId&&c.teamCode===session.teamCode);
  const body=document.getElementById('cycle-data-modal-body');
  if(!cycle||!body)return;
  body.innerHTML=renderCycleDataBody(cycle,value);
  const input=document.getElementById('cycle-data-search-input');
  if(input){input.value=value;input.focus();try{input.setSelectionRange(value.length,value.length)}catch(e){}}
}
function openCycleDataModal(cycleId, showHistory=false){
  const cycle=DB.getCycles().find(c=>c.id===cycleId&&c.teamCode===session.teamCode);
  if(!cycle)return;
  const modal=document.getElementById('cycle-data-modal');
  const period=document.getElementById('cycle-data-modal-period');
  const body=document.getElementById('cycle-data-modal-body');
  const count=document.getElementById('cycle-data-member-count');
  if(!modal||!period||!body)return;
  activeCycleDataModalId=cycleId;
  activeCycleDataShowHistory=showHistory;
  body.classList.remove('cycle-data-history');
  activeCycleDataTab='info';
  period.textContent=`${fmtDateBR(cycle.startDate)} — ${fmtDateBR(cycle.endDate)} · ${cycleGoalText(cycle)}`;
  body.innerHTML=renderCycleDataBody(cycle);
  modal.hidden=false;
}
function closeCycleDataModal(){
  const modal=document.getElementById('cycle-data-modal');
  if(modal)modal.hidden=true;
  activeCycleDataModalId=null;
}
function handleCycleDataModalBackdrop(event){
  if(event.target===event.currentTarget)closeCycleDataModal();
}
const CYCLE_ICONS = {
  cal:'<svg viewBox="0 0 24 24"><rect x="3.5" y="5" width="17" height="15.5" rx="2"></rect><path d="M8 3v4M16 3v4M3.5 10h17"></path></svg>',
  target:'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5"></circle><circle cx="12" cy="12" r="4.5"></circle><circle cx="12" cy="12" r="1"></circle></svg>',
  clock:'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"></circle><path d="M12 7v5l3 2"></path></svg>',
  layers:'<svg viewBox="0 0 24 24"><path d="m12 3 9 5-9 5-9-5 9-5Z"></path><path d="m3 13 9 5 9-5"></path></svg>',
  bars:'<svg viewBox="0 0 24 24"><path d="M4 19V9M10 19V5M16 19v-7M22 19H2"></path></svg>',
  flag:'<svg viewBox="0 0 24 24"><path d="M5 21V4M5 4h11l-2 4 2 4H5"></path></svg>'
};
// Aba "Informações" do modal "Dados sobre o período": cartões + semanas com feriado.
function renderCycleInfoPanel(cycle,{history=false}={}){
  const ico=CYCLE_ICONS, u=CYCLE_UNIT_TEXT[cycle.unit];
  const holidays = cycle.unit === 'weeks' ? (cycle.holidayWeeks || []) : [];
  const isoToUtc = iso => { const [y,m,d]=iso.split('-').map(Number); return Date.UTC(y,m-1,d); };
  const totalDays = Math.max(1, Math.round((isoToUtc(cycle.endDate)-isoToUtc(cycle.startDate))/86400000)+1);
  const ended = cycle.endDate < localDateStr(new Date());
  const metric = (icon,label,value) => `<div class="pc-metric"><span class="pc-mi" aria-hidden="true">${icon}</span><div class="pc-metric-text"><span>${label}</span><strong>${value}</strong></div></div>`;
  const lastMetric = ended ? metric(ico.clock,'Duração',`${totalDays} ${totalDays===1?'dia':'dias'}`) : metric(ico.clock,'Tempo restante',cycleTimeLeft(cycle));
  const row2 = metric(ico.layers,'Divisão',u.label)
    + (cycle.unit==='weeks' ? metric(ico.bars,'Mínimo semanal',formatCycleDraftMinutes(cycle.minimumMinutes || 0)) + metric(ico.flag,'Semanas com feriado',holidays.length) : '');
  const holidayRows = holidays.map(x => `<div class="pc-hol"><div class="pc-hol-main"><span class="pc-hol-icon" aria-hidden="true">${ico.cal}</span><div class="pc-hol-text"><strong>Feriado: ${fmtDateBR(x.holidayDate)}</strong><span>Semana de ${fmtDateBR(x.weekStart)} a ${fmtDateBR(getWeekEndIso(x.weekStart))}</span></div></div><div class="pc-hol-goal">Meta: ${formatCycleDraftMinutes(x.goalMinutes)}<i>•</i>Mínimo: ${formatCycleDraftMinutes(x.minimumMinutes)}</div></div>`).join('');
  const holBlock = holidays.length ? `<div class="card pc-block"><div class="pc-block-head"><h4>Semanas com feriado</h4><p>Semanas que possuem feriados e suas metas ajustadas.</p></div><div class="pc-hol-list">${holidayRows}</div></div>` : '';
  let top = '';
  if (history) {
    const editable = isTeamAdmin() && !ended;
    const actions = editable ? `<div class="cycle-page-actions"><button type="button" class="btn-outline" onclick="closeCycleDataModal();startEditCycle('${cycle.id}')">Editar período</button></div>` : '';
    top = `<div class="cdm-info-top">${cycleStatusLabel(cycle)}${actions}</div>`;
  }
  return `${top}<div class="pc-metrics">${metric(ico.cal,'Início',fmtDateBR(cycle.startDate))}${metric(ico.cal,'Fim',fmtDateBR(cycle.endDate))}${metric(ico.target,'Meta',cycleGoalText(cycle))}${lastMetric}${row2}</div>${holBlock}`;
}
function renderCycleDetail(cycle,{history=false}={}){
  if(!cycle) return '';
  const admin=isTeamAdmin(), u=CYCLE_UNIT_TEXT[cycle.unit], editable=admin&&cycle.endDate>=localDateStr(new Date()), actions=editable?`<div class="cycle-page-actions"><button type="button" class="btn-outline" onclick="startEditCycle('${cycle.id}')">Editar período</button></div>`:'';
  const remaining=cycleTimeLeft(cycle);
  const holidays = cycle.unit === 'weeks' ? (cycle.holidayWeeks || []) : [];
  // Ícones lineares (apenas apresentação)
  const ico = {
    cal:'<svg viewBox="0 0 24 24"><rect x="3.5" y="5" width="17" height="15.5" rx="2"></rect><path d="M8 3v4M16 3v4M3.5 10h17"></path></svg>',
    target:'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5"></circle><circle cx="12" cy="12" r="4.5"></circle><circle cx="12" cy="12" r="1"></circle></svg>',
    clock:'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"></circle><path d="M12 7v5l3 2"></path></svg>',
    layers:'<svg viewBox="0 0 24 24"><path d="m12 3 9 5-9 5-9-5 9-5Z"></path><path d="m3 13 9 5 9-5"></path></svg>',
    bars:'<svg viewBox="0 0 24 24"><path d="M4 19V9M10 19V5M16 19v-7M22 19H2"></path></svg>',
    flag:'<svg viewBox="0 0 24 24"><path d="M5 21V4M5 4h11l-2 4 2 4H5"></path></svg>'
  };
  const dataBtn = `<button type="button" class="btn-outline cycle-data-btn pc-data-btn" onclick="openCycleDataModal('${cycle.id}')">${ico.bars}Dados sobre o período</button>`;
  const holidayRows = holidays.map(x => `<div class="pc-hol"><div class="pc-hol-main"><span class="pc-hol-icon" aria-hidden="true">${ico.cal}</span><div class="pc-hol-text"><strong>Feriado: ${fmtDateBR(x.holidayDate)}</strong><span>Semana de ${fmtDateBR(x.weekStart)} a ${fmtDateBR(getWeekEndIso(x.weekStart))}</span></div></div><div class="pc-hol-goal">Meta: ${formatCycleDraftMinutes(x.goalMinutes)}<i>•</i>Mínimo: ${formatCycleDraftMinutes(x.minimumMinutes)}</div></div>`).join('');
  // Duração e progresso: cálculo simples somente com as datas já existentes no frontend
  const isoToUtc = iso => { const [y,m,d]=iso.split('-').map(Number); return Date.UTC(y,m-1,d); };
  const totalDays = Math.max(1, Math.round((isoToUtc(cycle.endDate)-isoToUtc(cycle.startDate))/86400000)+1);

  if(history){
    const minCell = cycle.unit==='weeks' ? `<div><span>Mínimo semanal</span><strong>${formatCycleDraftMinutes(cycle.minimumMinutes || 0)}</strong></div>` : '';
    const holBlock = holidays.length ? `<div class="pc-hol-list-title">Semanas com feriado</div><div class="pc-hol-list">${holidayRows}</div>` : '';
    return `<div class="card pc-record"><div class="pc-record-head"><div><div class="pc-record-eyebrow">Detalhes do período</div><h3 class="pc-record-title">${fmtDateBR(cycle.startDate)} — ${fmtDateBR(cycle.endDate)}</h3></div><div class="pc-record-side">${cycleStatusLabel(cycle)}${actions}</div></div><div class="pc-record-body"><div class="pc-record-info"><div><span>Início</span><strong>${fmtDateBR(cycle.startDate)}</strong></div><div><span>Fim</span><strong>${fmtDateBR(cycle.endDate)}</strong></div><div><span>Meta</span><strong>${cycleGoalText(cycle)}</strong></div><div><span>Divisão</span><strong>${u.label}</strong></div>${minCell}<div><span>Duração</span><strong>${totalDays} ${totalDays===1?'dia':'dias'}</strong></div></div>${dataBtn}</div>${holBlock}</div>`;
  }

  const todayUtc = isoToUtc(localDateStr(new Date()));
  const elapsedDays = Math.min(totalDays, Math.max(0, Math.round((todayUtc-isoToUtc(cycle.startDate))/86400000)+1));
  const leftDays = totalDays - elapsedDays;
  const pct = Math.round(elapsedDays/totalDays*100);
  const metric = (icon,label,value) => `<div class="pc-metric"><span class="pc-mi" aria-hidden="true">${icon}</span><div class="pc-metric-text"><span>${label}</span><strong>${value}</strong></div></div>`;
  const row2 = metric(ico.layers,'Divisão',u.label)
    + (cycle.unit==='weeks' ? metric(ico.bars,'Mínimo semanal',formatCycleDraftMinutes(cycle.minimumMinutes || 0)) + metric(ico.flag,'Semanas com feriado',holidays.length) : '');
  const holBlock = holidays.length ? `<div class="card pc-block"><div class="pc-block-head"><h4>Semanas com feriado</h4><p>Semanas que possuem feriados e suas metas ajustadas.</p></div><div class="pc-hol-list">${holidayRows}</div></div>` : '';
  return `<div class="card pc-hero"><div class="pc-hero-top"><div class="pc-hero-id"><span class="pc-hero-icon" aria-hidden="true">${ico.cal}</span><div><div class="pc-hero-titlerow"><h3>Período atual</h3>${cycleStatusLabel(cycle)}</div><p class="pc-hero-range">${fmtDateBR(cycle.startDate)} — ${fmtDateBR(cycle.endDate)}</p></div></div><div class="pc-hero-actions">${dataBtn}${actions}</div></div><div class="pc-progress"><div class="pc-progress-label"><strong>${pct}%</strong> do período</div><div class="pc-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}"><div class="pc-bar-fill" style="width:${pct}%"></div></div><div class="pc-progress-foot"><span><strong>${elapsedDays}</strong> ${elapsedDays===1?'dia decorrido':'dias decorridos'}</span><span><strong>${leftDays}</strong> ${leftDays===1?'dia restante':'dias restantes'}</span></div></div></div>`;
}
function openNewCycleForm(){
  if(!isTeamAdmin()) return;
  editingCycleId = null;
  cycleHolidayWeeksDraft = [];
  document.getElementById('form-cycle').reset();
  document.getElementById('cycle-form-title').textContent = 'Criar novo período';
  document.getElementById('cycle-form-description').textContent = 'Defina o período, a meta de tempo e, se necessário, as semanas com feriado.';
  document.getElementById('cycle-submit-label').textContent = 'Criar período';
  document.getElementById('cycle-submit-icon').hidden = false;
  document.getElementById('cycle-cancel-btn').hidden = false;
  document.getElementById('cycle-delete-btn').hidden = true;
  updateCycleFormUnit();
  const modal=document.getElementById('cycle-form-modal');
  if(modal) modal.hidden=false;
}

function hideCycleForm(){ const modal=document.getElementById('cycle-form-modal'); if(modal)modal.hidden=true; }
function handleCycleModalBackdrop(event){ if(event.target===event.currentTarget) cancelEditCycle(); }
function switchCycleSubView(view, render = true){
  cycleSubView=view;
  ['current','records'].forEach(v=>{
    document.getElementById(`cycle-tab-${v}`)?.classList.toggle('active',v===view);
    const p=document.getElementById(`cycle-page-${v}`); if(p)p.hidden=v!==view;
  });
  savePetimerVisualNavigation();
  if (!render) return;
  if(view==='records') renderCycleRecordsPage();
  if(view==='current') renderCycleCurrentPage();
}
function renderCycleCurrentPage(){
  const el=document.getElementById('cycle-current-content'), team=DB.getTeams()[session.teamCode], cycle=getActiveCycle();
  if(!el||!team)return;
  const admin=isTeamAdmin();
  if(!cycle){
    el.innerHTML=`<div class="cycle-page-head"><div><h3>Período</h3><p>Acompanhe o período atual da equipe.</p></div>${admin?'<div class="cycle-page-actions"><button type="button" class="btn-solid" onclick="openNewCycleForm()">Criar período</button></div>':''}</div><p class="cycle-empty-state cycle-empty-message">${escapeHtml(team.name)} não iniciou nenhum período.</p>`;
    return;
  }
  el.innerHTML=`<div class="cycle-page-head"><div><h3>Período</h3><p>Visão geral do período atualmente em andamento.</p></div>${admin?'<div class="cycle-page-actions"><button type="button" class="btn-solid" onclick="openNewCycleForm()">Novo período</button></div>':''}</div>${renderCycleDetail(cycle)}`;
}
function selectCycleRecord(id){ selectedCycleDetailId=id; renderCycleRecordsPage(); }
function renderCycleRecordCompact(cycle){
  const ended = cycle.endDate < localDateStr(new Date());
  return `<article class="pc-compact${ended?' pc-compact-ended':''}"><div class="pc-compact-title"><span class="pc-compact-label">Período</span><strong class="pc-compact-range">${fmtDateBR(cycle.startDate)} — ${fmtDateBR(cycle.endDate)}</strong></div><div class="pc-compact-date"><span class="pc-compact-label">Início</span><strong>${fmtDateBR(cycle.startDate)}</strong></div><div class="pc-compact-date"><span class="pc-compact-label">Fim</span><strong>${fmtDateBR(cycle.endDate)}</strong></div><div class="pc-compact-status"><span class="pc-compact-label">Status</span>${cycleStatusLabel(cycle)}</div><button type="button" class="btn-outline cycle-data-btn pc-data-btn" onclick="openCycleDataModal('${cycle.id}',true)"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 19V9M10 19V5M16 19v-7M22 19H2"></path></svg>Dados sobre o período</button></article>`;
}
function renderCycleHistoryData(cycle, filter=''){
  // Reutiliza o detalhe existente para preservar metas, feriados e ações.
  const detail = renderCycleDetail(cycle,{history:true})
    .replace(/<button[^>]*onclick="openCycleDataModal[^>]*>[\s\S]*?<\/button>/, '')
    .replaceAll('onclick="startEditCycle(', 'onclick="closeCycleDataModal();startEditCycle(');
  return detail + renderCycleMembersTable(cycle,filter);
}
function renderCycleRecordsPage(){
  const el=document.getElementById('cycle-records-content'); if(!el)return;
  const cycles=DB.getCycles().filter(c=>c.teamCode===session.teamCode).sort((a,b)=>b.startDate.localeCompare(a.startDate));
  if(!cycles.length){el.innerHTML='<div class="card cycle-empty-state">Nenhum período cadastrado.</div>';return;}
  el.innerHTML=`<div class="pc-records">${cycles.map(renderCycleRecordCompact).join('')}</div>`;
}
function renderCycleMemberArea(){ renderCycleCurrentPage(); }
function renderAdminCycleSummary(){ /* conteúdo integrado às páginas internas do período */ }
function dismissEndedCycleNotice(){
  const overlay = document.getElementById('ended-cycle-overlay');
  if (overlay) {
    overlay.hidden = true;
    if (overlay._returnFocus?.isConnected) overlay._returnFocus.focus({ preventScroll: true });
  }
}

function ensureEndedCycleNotice(){
  let overlay = document.getElementById('ended-cycle-overlay');
  if (overlay) return overlay;
  overlay = document.createElement('div');
  overlay.id = 'ended-cycle-overlay';
  overlay.className = 'final-period-overlay';
  overlay.hidden = true;
  overlay.innerHTML = `<div class="final-period-notice" role="dialog" aria-modal="true" aria-labelledby="ended-cycle-title" aria-describedby="ended-cycle-text">
      <button class="final-period-close" type="button" aria-label="Fechar aviso" onclick="dismissEndedCycleNotice()">×</button>
      <div class="final-period-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M8 3v4M16 3v4"/><rect x="3.5" y="5" width="17" height="15.5" rx="2"/><path d="M3.5 10h17"/><path d="m9 15 2 2 4-4"/></svg></div>
      <h2 id="ended-cycle-title">Período encerrado</h2>
      <p id="ended-cycle-text"></p>
    </div>`;
  overlay.addEventListener('click', e => { if (e.target === overlay) dismissEndedCycleNotice(); });
  overlay.addEventListener('keydown', e => {
    if (e.key === 'Escape') { e.preventDefault(); dismissEndedCycleNotice(); }
  });
  document.body.appendChild(overlay);
  return overlay;
}

const ENDED_NOTICE_GRACE_DAYS = 2;

function notifyEndedCycle(){
  const team = DB.getTeams()[session.teamCode];
  if (!team || (team.admin === session.username && !adminParticipatesInCycle())) return;
  const today = localDateStr(new Date());
  // O aviso vale até 2 dias após o término (fim 01/11 → aparece até 03/11).
  const lastNoticeDay = iso => {
    const d = new Date(`${iso}T00:00:00`);
    d.setDate(d.getDate() + ENDED_NOTICE_GRACE_DAYS);
    return localDateStr(d);
  };
  const ended = DB.getCycles().filter(c => c.teamCode === session.teamCode && c.endDate < today && today <= lastNoticeDay(c.endDate))
    .sort((a,b) => b.endDate.localeCompare(a.endDate))[0];
  if (!ended) return;
  const key = `petimer_cycle_ended_${session.teamCode}_${session.username}_${ended.id}`;
  if (sessionStorage.getItem(key)) return;
  const code = session.teamCode, username = session.username;
  sessionStorage.setItem(key, '1');
  setTimeout(() => {
    if (!session || session.teamCode !== code || session.username !== username || document.getElementById('main-app')?.hidden) return;
    const overlay = ensureEndedCycleNotice();
    document.getElementById('ended-cycle-text').innerHTML = `O período de <strong>${escapeHtml(fmtDateBR(ended.startDate))} a ${escapeHtml(fmtDateBR(ended.endDate))}</strong> terminou.<br>Veja os resultados em <strong>Período › Registros de Períodos</strong>.`;
    overlay._returnFocus = document.activeElement;
    overlay.hidden = false;
    overlay.querySelector('.final-period-close').focus({ preventScroll: true });
  }, 100);
}
