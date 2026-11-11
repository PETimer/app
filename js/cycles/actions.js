/**
 * Ações de período: salvar, editar, excluir e utilitários de data/escape.
 */

function isTeamAdmin() {
  const teams = DB.getTeams();
  const team = teams[session.teamCode];
  return !!team && (team.admin === session?.username || team.members?.[session?.username]?.role === 'admin');
}

function renderCycleView() {
  switchCycleSubView(cycleSubView || 'current');
}

function fmtDateBR(iso) { const [y, m, d] = iso.split('-'); return `${d}/${m}/${y}`; }

function renderCyclesList(admin) { renderCycleRecordsPage(); }

// Limites inclusivos: compartilhar até mesmo um dia já é conflito.
function findCycleOverlap(cycles, teamCode, startDate, endDate, excludedId) {
  return cycles.find(c => c.teamCode === teamCode
    && (excludedId == null || String(c.id) !== String(excludedId))
    && startDate <= c.endDate && endDate >= c.startDate) || null;
}

function cycleOverlapMessage(cycle, editing) {
  return `Não é possível ${editing ? 'editar' : 'criar'} este período porque as datas selecionadas coincidem com um período já existente (${fmtDateBR(cycle.startDate)} a ${fmtDateBR(cycle.endDate)}). Escolha um intervalo sem sobreposição.`;
}

async function handleSaveCycle(e) {
e.preventDefault();
if (isActionPending('save-cycle')) return;
if (!isTeamAdmin()) return alert('Apenas o administrador da equipe pode gerenciar períodos.');

const startDate = document.getElementById('cycle-start').value;
const endDate = document.getElementById('cycle-end').value;
const unit = document.getElementById('cycle-unit').value;
const goalMinutes = minutesFromFields('cycle-goal-hours','cycle-goal-minutes');
const minimumMinutes = unit === 'weeks' ? minutesFromFields('cycle-minimum-hours','cycle-minimum-minutes') : 0;
const hasHolidays = unit === 'weeks' && !!document.getElementById('cycle-has-holidays')?.checked;

if (!startDate || !endDate) return alert('Preencha as datas de início e término.');
if (endDate < startDate) return alert('A data de término deve ser posterior à data de início.');
if (goalMinutes <= 0) return alert('Defina uma meta de tempo maior que zero.');
if (hasHolidays && document.getElementById('cycle-holiday-date')?.value) {
  if (!addCycleHolidayWeek()) return;
}
if (minimumMinutes > goalMinutes) return alert('O mínimo semanal não pode ser maior que a meta semanal.');
if (hasHolidays) {
  for (const item of cycleHolidayWeeksDraft) {
    if (item.holidayDate < startDate || item.holidayDate > endDate) return alert('Existe um feriado cadastrado fora do período.');
    if (item.minimumMinutes > item.goalMinutes) return alert('O mínimo de uma semana com feriado não pode ser maior que a meta.');
  }
}

const teamCode = session.teamCode, cycleId = editingCycleId;
const holidayWeeks = hasHolidays ? cycleHolidayWeeksDraft.map(x => ({...x})) : [];
const conflict = findCycleOverlap(DB.getCycles(), teamCode, startDate, endDate, cycleId);
if (conflict) return alert(cycleOverlapMessage(conflict, cycleId != null));

return runOnce('save-cycle', actionButton(e), null, async () => {
try {
  const latest = await api('getTeamBootstrap', { code: teamCode });
  if (!session || session.teamCode !== teamCode) return;
  if (!Array.isArray(latest.cycles)) throw new Error('Não foi possível verificar os períodos da equipe. Tente novamente.');
  const latestCycles = latest.cycles.map(c => ({...c, teamCode}));
  const latestConflict = findCycleOverlap(latestCycles, teamCode, startDate, endDate, cycleId);
  if (latestConflict) return alert(cycleOverlapMessage(latestConflict, cycleId != null));
  await api('saveCycle', {
    code: teamCode, cycleId: cycleId || undefined, startDate, endDate, unit, goalMinutes,
    minimumMinutes, holidayWeeks
  });
  if (!session || session.teamCode !== teamCode) return;
  await refreshTeamData();
  cancelEditCycle();
  renderCycleView();
  renderCycleBadge();
} catch (err) { alert(err.message); }
});
}

function startEditCycle(id) {
if (!isTeamAdmin()) return;
const cycle = DB.getCycles().find(c => c.id === id);
if (!cycle) return;
editingCycleId = id;
document.getElementById('cycle-start').value = cycle.startDate;
document.getElementById('cycle-end').value = cycle.endDate;
document.getElementById('cycle-unit').value = cycle.unit;
setDurationFields('cycle-goal-hours','cycle-goal-minutes',cycle.goalMinutes);
setDurationFields('cycle-minimum-hours','cycle-minimum-minutes',cycle.minimumMinutes || 0);
cycleHolidayWeeksDraft = (cycle.holidayWeeks || []).map(x => ({...x}));
const holToggle = document.getElementById('cycle-has-holidays');
if (holToggle) holToggle.checked = cycleHolidayWeeksDraft.length > 0;
updateCycleFormUnit();
document.getElementById('cycle-form-title').textContent = 'Editar período';
document.getElementById('cycle-form-description').textContent = 'Altere as informações do período e as exceções de feriados antes de salvar.';
document.getElementById('cycle-submit-label').textContent = 'Salvar alterações';
document.getElementById('cycle-submit-icon').hidden = true;
document.getElementById('cycle-cancel-btn').hidden = false;
document.getElementById('cycle-delete-btn').hidden = false;
document.getElementById('cycle-form-modal').hidden = false;
}

function cancelEditCycle() {
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
  hideCycleForm();
}

async function deleteCycle(id, btn) {
  const key = `delete-cycle:${id}`;
  if (isActionPending(key)) return;
  if (!isTeamAdmin()) return alert('Apenas o administrador da equipe pode gerenciar períodos.');
  const confirmedCycle = await appConfirm({
    title: 'Excluir período',
    message: 'Tem certeza que deseja excluir este período?',
    confirmText: 'Excluir período'
  });
  if (!confirmedCycle) return;
  return runOnce(key, btn, null, async () => {
    try {
      await api('deleteCycle', { cycleId: id });
      await refreshTeamData();
      if (editingCycleId === id) cancelEditCycle();
      renderCycleView();
      renderCycleBadge();
    } catch (err) { alert(err.message); }
  });
}

function fmtDur(ms, wSec = false) { const t = Math.max(0, Math.floor(ms/1000)), h = Math.floor(t/3600), m = Math.floor((t%3600)/60), s = t%60; if (wSec) return [h,m,s].map(v=>String(v).padStart(2,'0')).join(':'); return `${h}h ${String(m).padStart(2,'0')}m`; }
function escapeHtml(s) { return String(s).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

try {
  preparePetimerVisualRestore();
} catch (err) {
  // Falha na pré-restauração visual nunca pode impedir a init() de rodar.
  console.error('PETimer: falha na pré-restauração visual', err);
  document.documentElement.classList.remove('petimer-restoring');
  document.documentElement.removeAttribute('data-petimer-restore-view');
  try { if (authToken && !petimerLoadingDepth) showPetimerLoading('Carregando PETimer...'); } catch (_) {}
}
