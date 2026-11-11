/**
 * Estado da aba Análise: semana, modo, escopo e utilitários de relatório.
 */

let analysisWeekOffset = 0;
let analysisMode = 'overview';
let analysisScope = 'user';
let analysisSelectedUser = null;      // primeiro usuário selecionado (usado pelas setas de navegação)
let analysisSelectedUsers = [];       // todos os usuários selecionados (multisseleção)
let analysisSelectedSector = null;
let userSelectPendingChoice = null;
let userSelectPendingSet = new Set();   // seleção pendente no modo usuário (multisseleção)

function startOfWeek(date) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0,0,0,0);
  return d;
}

function analysisWeekRange() {
  const start = startOfWeek(new Date());
  start.setDate(start.getDate() + analysisWeekOffset * 7);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  end.setHours(23,59,59,999);
  return { start, end };
}

function navigateAnalysisUser(direction) {
  if (analysisScope !== 'user') return;
  const members = getAnalysisTeamMembers();
  if (members.length <= 1) return;
  const current = members.findIndex(member => member.username === analysisSelectedUser);
  const index = current < 0 ? 0 : (current + direction + members.length) % members.length;
  analysisSelectedUser = members[index].username;
  analysisSelectedUsers = [analysisSelectedUser];
  updateAnalysisScopeLabel();
  renderAnalysis();
}

// Setas do filtro: no modo Usuário navegam entre membros; em "Por setor", entre setores; em "Equipe inteira" não fazem nada.
function navigateAnalysisScopeItem(direction) {
  if (analysisScope === 'user') { navigateAnalysisUser(direction); return; }
  if (analysisScope !== 'sector') return;
  const sectors = getTeamSectors();
  if (sectors.length <= 1) return;
  ensureAnalysisSelectedSector();
  const current = sectors.indexOf(analysisSelectedSector);
  const index = current < 0 ? 0 : (current + direction + sectors.length) % sectors.length;
  analysisSelectedSector = sectors[index];
  updateAnalysisScopeLabel();
  renderAnalysis();
}

function changeAnalysisWeek(delta) {
  analysisWeekOffset += delta;
  renderAnalysis();
}

// Semanal e Acompanhamento são alternativas conforme a existência de período ativo.
// Preserve as outras abas e nunca deixe uma aba oculta selecionada.
function syncAnalysisPeriodTabs() {
  const hasActivePeriod = Boolean(getActiveCycle());
  const weeklyTab = document.querySelector('[data-analysis-mode="weekly"]');
  const periodTab = document.querySelector('[data-analysis-mode="period"]');
  if (weeklyTab) weeklyTab.hidden = hasActivePeriod;
  if (periodTab) periodTab.hidden = !hasActivePeriod;
  const nextMode = analysisMode === 'weekly' && hasActivePeriod ? 'period'
    : analysisMode === 'period' && !hasActivePeriod ? 'weekly' : analysisMode;
  return nextMode;
}

function setAnalysisMode(mode, btn, render = true) {
  // Também valida restauração de aba após F5 ou troca de equipe.
  syncAnalysisPeriodTabs();
  const hasActivePeriod = Boolean(getActiveCycle());
  if ((mode === 'weekly' && hasActivePeriod) || (mode === 'period' && !hasActivePeriod)) {
    mode = mode === 'weekly' ? 'period' : 'weekly';
  }
  analysisMode = mode;
  document.querySelectorAll('[data-analysis-mode]').forEach(b => b.classList.toggle('active', b.dataset.analysisMode === mode));
  document.getElementById('analysis-overview-panel').hidden = mode !== 'overview';
  document.getElementById('analysis-table-panel').hidden = mode !== 'detailed' && mode !== 'weekly';
  const periodPanel = document.getElementById('analysis-period-panel'); if (periodPanel) periodPanel.hidden = mode !== 'period';
  const weekNav = document.getElementById('analysis-week-nav'); if (weekNav) weekNav.hidden = mode === 'period';
  const cycleWrap = document.getElementById('analysis-period-cycle-wrap'); if (cycleWrap) cycleWrap.hidden = mode !== 'period';
  const exportBtn = document.getElementById('analysis-export-btn'); if (exportBtn) exportBtn.hidden = false;
  savePetimerVisualNavigation();
  if (render) renderAnalysis();
}

function fmtClock(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600), m = Math.floor((total % 3600) / 60), sec = total % 60;
  return [h,m,sec].map(v => String(v).padStart(2,'0')).join(':');
}

function dashboardCargoColor(entry) {
  return getCargoColor(entry.cargo, entry.cargoColor) || '#64748b';
}

function startOfDay(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

function reportDateLabel(d) {
  return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}`;
}

function reportMemberName(username) {
  const u = DB.getUsers()[username];
  return u ? (u.name || u.username || username) : username;
}
