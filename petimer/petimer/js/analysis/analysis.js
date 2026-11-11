/**
 * Filtros aplicados e renderização principal da Análise.
 */

function populateAnalysisFilters() {
  if (!session || !session.teamCode) return;
  const all = DB.getEntries().filter(e => e.teamCode === session.teamCode);

  const cargoSel = document.getElementById('analysis-cargo');
  if (cargoSel) {
    const prev = cargoSel.value;
    const cargos = [...new Set(all.map(e => e.cargo || 'Sem cargo'))].sort((a,b)=>a.localeCompare(b,'pt-BR'));
    cargoSel.innerHTML = '<option value="">Todos os cargos/projetos</option>' + cargos.map(c=>`<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');
    if (cargos.includes(prev)) cargoSel.value = prev;
  }

  const modSel = document.getElementById('analysis-modalidade');
  if (modSel) {
    const prev = modSel.value;
    const mods = [...new Set(all.map(e => e.modalidade).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'pt-BR'));
    modSel.innerHTML = '<option value="">Todos os locais</option>' + mods.map(m=>`<option value="${escapeHtml(m)}">${escapeHtml(m)}</option>`).join('');
    if (mods.includes(prev)) modSel.value = prev;
  }

  ensureAnalysisSelectedUser();

  const sectorSel = document.getElementById('analysis-sector');
  if (sectorSel) {
    const sectors = getTeamSectors();
    ensureAnalysisSelectedSector();
    sectorSel.innerHTML = sectors.map(s => `<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`).join('');
    if (analysisSelectedSector) sectorSel.value = analysisSelectedSector;
  }

  updateAnalysisScopeLabel();
}

function getAnalysisFilteredEntries() {
  if (!session || !session.teamCode) return [];
  const { start, end } = analysisWeekRange();

  let entries = DB.getEntries().filter(e => e.teamCode === session.teamCode && e.date);
  entries = entries.filter(e => {
    const d = new Date(e.date + 'T12:00:00');
    return d >= start && d <= end;
  });
  return applyAnalysisFilters(entries);
}

// Escopo (usuário / setor / equipe), cargo e local — compartilhado entre as abas da Análise.
function applyAnalysisFilters(entries) {
  const scope = analysisScope || 'user';
  const cargo = document.getElementById('analysis-cargo')?.value || '';
  const modalidade = document.getElementById('analysis-modalidade')?.value || '';

  if (scope === 'user') {
    ensureAnalysisSelectedUser();
    const selectedUsers = analysisSelectedUsers;
    entries = entries.filter(e => selectedUsers.includes(e.user));
  } else if (scope === 'sector') {
    ensureAnalysisSelectedSector();
    const sector = analysisSelectedSector || '';
    const members = sector ? usersInSector(sector) : [];
    entries = entries.filter(e => members.includes(e.user));
  }
  // scope === 'team' -> sem filtro de usuário

  if (cargo) entries = entries.filter(e => (e.cargo || 'Sem cargo') === cargo);
  if (modalidade) entries = entries.filter(e => (e.modalidade || 'Sem localização') === modalidade);
  return entries;
}

function renderAnalysis() {
  const root = document.getElementById('view-analysis');
  if (!root || !session || !session.teamCode) return;

  const nextMode = syncAnalysisPeriodTabs();
  if (nextMode !== analysisMode) setAnalysisMode(nextMode, null, false);
  populateAnalysisFilters();
  document.getElementById('analysis-sector').hidden = true; // setor é escolhido pelo botão principal + setas

  const { start, end } = analysisWeekRange();
  const label = document.getElementById('analysis-period-label');
  if (label) label.textContent = analysisWeekOffset === 0 ? 'Esta semana' : `${reportDateLabel(start)} – ${reportDateLabel(end)}`;

  if (analysisMode === 'period') { renderAnalysisPeriod(); return; }

  const entries = getAnalysisFilteredEntries();

  if (analysisMode === 'overview') {
    renderAnalysisOverview(entries, start);
  } else {
    const total = uniqueWorkMs(entries);
    const totalEl = document.getElementById('analysis-table-total'); if (totalEl) totalEl.textContent = fmtClock(total);
    const group = document.getElementById('analysis-table-group-label'); if (group) group.textContent = analysisMode === 'detailed' ? 'Registros individuais' : 'Agrupado por Cargo/Projeto';
    const content = document.getElementById('analysis-table-content'); if (!content) return;
    content.innerHTML = analysisMode === 'detailed' ? renderReportDetailed(entries) : renderReportWeekly(entries, start);
  }
}
