/**
 * Card lateral, visão geral e relatórios detalhado/semanal.
 */

// ---------- Card lateral da Análise: Membros | Atividades ----------
let analysisSideTab = null; // null = automático (Membros se houver mais de uma pessoa no filtro)

function fmtHM(ms) {
  const mins = Math.round(Math.max(0, ms) / 60000);
  const h = Math.floor(mins / 60), m = mins % 60;
  if (!h) return `${m}min`;
  return m ? `${h}h ${String(m).padStart(2,'0')}min` : `${h}h`;
}

function analysisScopeMembers() {
  if (analysisScope === 'user') return analysisSelectedUsers.length ? analysisSelectedUsers.slice() : (analysisSelectedUser ? [analysisSelectedUser] : []);
  if (analysisScope === 'sector') { ensureAnalysisSelectedSector(); return usersInSector(analysisSelectedSector || ''); }
  return getAnalysisTeamMembers().map(m => m.username);
}

function setAnalysisSideTab(tab) {
  analysisSideTab = tab;
  renderAnalysis();
}

function renderAnalysisSide(entries, activityTotals, total, effective) {
  const list = document.getElementById('dash-top-activities');
  const hint = document.getElementById('dash-side-hint');
  if (!list) return;
  const scopeMembers = analysisScopeMembers();
  const tab = analysisSideTab || (scopeMembers.length > 1 ? 'members' : 'activities');
  document.querySelectorAll('[data-side-tab]').forEach(b => b.classList.toggle('active', b.dataset.sideTab === tab));

  if (tab === 'members') {
    const byUser = {};
    scopeMembers.forEach(u => { byUser[u] = { duration: 0, cargos: {} }; });
    entries.forEach(e => {
      if (!byUser[e.user]) byUser[e.user] = { duration: 0, cargos: {} };
      const dur = effective.get(e) || 0, cargo = e.cargo || 'Sem cargo';
      byUser[e.user].duration += dur;
      if (!byUser[e.user].cargos[cargo]) byUser[e.user].cargos[cargo] = { duration: 0, color: dashboardCargoColor(e) };
      byUser[e.user].cargos[cargo].duration += dur;
    });
    const rows = Object.entries(byUser).sort((a,b) => b[1].duration - a[1].duration || reportMemberName(a[0]).localeCompare(reportMemberName(b[0]), 'pt-BR'));
    const max = Math.max(...rows.map(r => r[1].duration), 1);
    const active = rows.filter(r => r[1].duration > 0).length;
    if (hint) hint.textContent = `${active} de ${rows.length} com horas`;
    list.innerHTML = rows.length ? rows.map(([u,obj]) => {
      return `<div class="member-hours-row${obj.duration ? '' : ' is-zero'}"><div class="member-hours-name" title="${escapeHtml(reportMemberName(u))}">${escapeHtml(reportMemberName(u))}</div><div class="member-hours-time">${obj.duration ? fmtHM(obj.duration) : '—'}</div></div>`;
    }).join('') + `<div class="member-hours-total"><span>Total do filtro</span><strong>${fmtHM(total)}</strong></div>`
      : '<div class="empty" style="padding:24px 16px">Sem membros neste filtro.</div>';
    return;
  }

  if (hint) hint.textContent = 'Top 10';
  const topActs = Object.entries(activityTotals).sort((a,b) => b[1].duration - a[1].duration).slice(0,10);
  list.innerHTML = topActs.length ? topActs.map(([activity,obj]) => `<div class="dashboard-activity-row"><div class="dashboard-activity-main"><div class="dashboard-activity-name">${escapeHtml(activity)}</div><div class="dashboard-activity-sub"><span class="dashboard-dot" style="background:${obj.color}"></span><span style="color:${obj.color}">${escapeHtml(obj.cargo)}</span></div></div><div class="dashboard-activity-time">${fmtClock(obj.duration)}</div></div>`).join('') : '<div class="empty" style="padding:24px 16px">Sem registros nesta semana.</div>';
}

function renderAnalysisOverview(entries, start) {
  const effective = effectiveWorkDurations(entries);
  const total = uniqueWorkMs(entries);
  document.getElementById('dash-total-time').textContent = fmtClock(total);
  document.getElementById('dash-donut-total').textContent = fmtClock(total);

  const cargoTotals = {}, locationTotals = {}, activityTotals = {};
  entries.forEach(e => {
    const counted = effective.get(e) || 0;
    const cargo = e.cargo || 'Sem cargo';
    const loc = e.modalidade || 'Sem localização';
    cargoTotals[cargo] = (cargoTotals[cargo] || 0) + counted;
    locationTotals[loc] = (locationTotals[loc] || 0) + counted;
    const actKey = e.activity || 'Sem descrição';
    if (!activityTotals[actKey]) activityTotals[actKey] = { duration:0, cargo, color:dashboardCargoColor(e) };
    activityTotals[actKey].duration += counted;
  });

  const topKey = obj => Object.entries(obj).sort((a,b)=>b[1]-a[1])[0]?.[0] || '—';
  document.getElementById('dash-top-cargo').textContent = topKey(cargoTotals);
  document.getElementById('dash-top-location').textContent = topKey(locationTotals);

  // Barras por dia, empilhadas por cargo/projeto
  const dayNames = ['SEG','TER','QUA','QUI','SEX','SÁB','DOM'];
  const daily = Array.from({length:7}, (_,i) => ({ date:new Date(start.getFullYear(),start.getMonth(),start.getDate()+i), total:0, cargos:{} }));
  entries.forEach(e => {
    const d = new Date(e.date + 'T12:00:00');
    const idx = Math.round((startOfDay(d)-startOfDay(start))/86400000);
    if (idx < 0 || idx > 6) return;
    const dur = effective.get(e) || 0;
    const cargo = e.cargo || 'Sem cargo';
    daily[idx].total += dur;
    if (!daily[idx].cargos[cargo]) daily[idx].cargos[cargo] = {duration:0,color:dashboardCargoColor(e)};
    daily[idx].cargos[cargo].duration += dur;
  });
  const maxMsRaw = Math.max(...daily.map(d=>d.total), 3600000);
  const maxHours = Math.max(1, Math.ceil(maxMsRaw/3600000));
  const chartCeilHours = Math.ceil(maxHours/2)*2;
  const chartMax = chartCeilHours * 3600000;

  const yAxis = document.getElementById('dash-y-axis');
  const yMarks = [0,.25,.5,.75,1].map(r => Math.round(chartCeilHours*r));
  yAxis.innerHTML = yMarks.map((h,i)=>`<span class="dashboard-y-label" style="bottom:${i*25}%">${h}.0h</span>`).join('');

  const bars = document.getElementById('dash-bars');
  bars.innerHTML = daily.map((d,i)=>{
    const barHeight = Math.min(78, d.total/chartMax*78);
    const segments = Object.entries(d.cargos).map(([name,obj])=>{
      const pct = d.total ? obj.duration/d.total*100 : 0;
      return `<div class="dashboard-stack-segment" title="${escapeHtml(name)} — ${fmtClock(obj.duration)}" style="height:${pct}%;background:${obj.color}"></div>`;
    }).join('');
    const dateTxt = `${String(d.date.getDate()).padStart(2,'0')}/${String(d.date.getMonth()+1).padStart(2,'0')}`;
    return `<div class="dashboard-day" style="--bar-height:${barHeight}%"><div class="dashboard-total-label">${fmtClock(d.total)}</div><div class="dashboard-stack">${segments}</div><div class="dashboard-day-label">${dayNames[i]}, ${dateTxt}</div></div>`;
  }).join('');

  // Donut + participação por cargo/projeto
  const cargoRows = Object.entries(cargoTotals).sort((a,b)=>b[1]-a[1]);
  let angle = 0;
  const gradients = [];
  cargoRows.forEach(([name,dur])=>{
    const color = getCargoColor(name) || '#64748b';
    const next = total ? angle + dur/total*360 : angle;
    gradients.push(`${color} ${angle}deg ${next}deg`);
    angle = next;
  });
  const donut = document.getElementById('dash-donut');
  donut.style.background = gradients.length ? `conic-gradient(${gradients.join(',')})` : '#eef0f4';
  const catList = document.getElementById('dash-category-list');
  catList.innerHTML = cargoRows.length ? cargoRows.map(([name,dur])=>{
    const pct = total ? dur/total*100 : 0;
    const color = getCargoColor(name) || '#64748b';
    return `<div class="dashboard-category-row"><div class="dashboard-category-name" style="color:${color}">${escapeHtml(name)}</div><div class="dashboard-category-time">${fmtClock(dur)}</div><div class="dashboard-category-track"><div class="dashboard-category-fill" style="width:${pct}%;background:${color}"></div></div><div class="dashboard-category-percent">${pct.toFixed(1).replace('.',',')}%</div></div>`;
  }).join('') : '<div class="empty">Sem registros nesta semana.</div>';

  // Card lateral: horas por membro / atividades
  renderAnalysisSide(entries, activityTotals, total, effective);
}

function renderReportDetailed(entries) {
  if(!entries.length) return '<div class="reports-empty">Nenhum registro neste período.</div>';
  const sorted=[...entries].sort((a,b)=>(b.date||'').localeCompare(a.date||'') || (b.startTime||'').localeCompare(a.startTime||''));
  return `<div class="reports-table-wrap"><table class="reports-table"><thead><tr><th>Atividade</th><th>Cargo/Projeto</th><th>Membro</th><th>Data</th><th>Horário</th><th>Duração</th></tr></thead><tbody>${sorted.map(e=>{
    const color=dashboardCargoColor(e), times=e.startTime&&e.endTime?`${e.startTime} – ${e.endTime}`:'—';
    const date=e.date?e.date.split('-').reverse().join('/'):'—';
    return `<tr><td class="reports-desc" title="${escapeHtml(e.activity||'Sem descrição')}">${escapeHtml(e.activity||'Sem descrição')}</td><td><span class="reports-cargo" style="color:${color}">${escapeHtml(e.cargo||'Sem cargo')}</span></td><td>${escapeHtml(reportMemberName(e.user))}</td><td class="muted">${date}</td><td class="reports-timecell">${times}</td><td class="reports-timecell"><strong>${fmtClock(Number(e.duration)||0)}</strong></td></tr>`;
  }).join('')}</tbody></table></div>`;
}

function renderReportWeekly(entries, start) {
  const effective = effectiveWorkDurations(entries);
  const cargos={};
  entries.forEach(e=>{
    const cargo=e.cargo||'Sem cargo', color=dashboardCargoColor(e), d=new Date(e.date+'T12:00:00'), idx=Math.round((startOfDay(d)-startOfDay(start))/86400000), dur=effective.get(e)||0;
    if(idx<0||idx>6) return;
    if(!cargos[cargo]) cargos[cargo]={days:Array(7).fill(0),total:0,color};
    cargos[cargo].days[idx]+=dur; cargos[cargo].total+=dur;
  });
  const dailyTotals=Array(7).fill(0); Object.values(cargos).forEach(o=>o.days.forEach((v,i)=>dailyTotals[i]+=v));
  const grand=dailyTotals.reduce((a,b)=>a+b,0), names=['Seg','Ter','Qua','Qui','Sex','Sáb','Dom'];
  const rows=Object.entries(cargos).sort((a,b)=>b[1].total-a[1].total);
  if(!rows.length) return '<div class="reports-empty">Nenhum registro neste período.</div>';
  return `<div class="reports-table-wrap"><table class="reports-table weekly-table"><thead><tr><th>Cargo/Projeto</th>${names.map((n,i)=>`<th>${n}, ${reportDateLabel(new Date(start.getFullYear(),start.getMonth(),start.getDate()+i))}</th>`).join('')}<th>Total</th></tr></thead><tbody>${rows.map(([name,o])=>`<tr><td><div class="weekly-cargo"><span class="weekly-dot" style="background:${o.color}"></span><span style="color:${o.color};font-weight:650">${escapeHtml(name)}</span></div></td>${o.days.map(v=>`<td class="reports-timecell">${v?fmtClock(v):'—'}</td>`).join('')}<td class="reports-timecell weekly-total-col">${fmtClock(o.total)}</td></tr>`).join('')}<tr class="weekly-total-row"><td>Total</td>${dailyTotals.map(v=>`<td class="reports-timecell">${fmtClock(v)}</td>`).join('')}<td class="reports-timecell">${fmtClock(grand)}</td></tr></tbody></table></div>`;
}
