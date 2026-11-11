/**
 * Formulário de período e semanas de feriado.
 */

// ---------- PERÍODO ----------
const CYCLE_UNIT_MS = { weeks: 7 * 86400000, days: 86400000, hours: 3600000 };
const CYCLE_UNIT_TEXT = {
  weeks: { esta: 'esta semana', desta: 'desta semana', da: 'da semana', por: 'por semana', singular: 'semana', plural: 'semanas', label: 'Semanas' },
  days:  { esta: 'este dia',    desta: 'deste dia',    da: 'do dia',    por: 'por dia',    singular: 'dia',    plural: 'dias',    label: 'Dias' },
  hours: { esta: 'esta hora',   desta: 'desta hora',   da: 'da hora',   por: 'por hora',   singular: 'hora',   plural: 'horas',   label: 'Horas' }
};

let cycleHolidayWeeksDraft = [];

function getWeekStartIso(iso) {
  if (!iso) return '';
  const d = new Date(`${iso}T00:00:00`);
  const dow = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - dow);
  return localDateStr(d);
}
function getWeekEndIso(weekStart) {
  const d = new Date(`${weekStart}T00:00:00`);
  d.setDate(d.getDate() + 6);
  return localDateStr(d);
}
function minutesFromFields(hId, mId) {
  const h = Math.max(0, parseInt(document.getElementById(hId)?.value, 10) || 0);
  const m = Math.max(0, Math.min(59, parseInt(document.getElementById(mId)?.value, 10) || 0));
  return h * 60 + m;
}
function setDurationFields(hId, mId, total) {
  const mins = Math.max(0, Number(total) || 0);
  document.getElementById(hId).value = Math.floor(mins / 60);
  document.getElementById(mId).value = mins % 60;
}
function formatCycleDraftMinutes(mins) {
  const total = Math.max(0, Number(mins) || 0);
  return formatHM(total * 60000);
}
function updateCycleFormUnit() {
const unit = document.getElementById('cycle-unit')?.value;
const weekly = unit === 'weeks';
const minField = document.getElementById('cycle-minimum-field');
const holidayConfig = document.getElementById('cycle-holiday-config');
const toggleWrap = document.getElementById('cycle-holiday-toggle-wrap');
const toggle = document.getElementById('cycle-has-holidays');

if (minField) minField.hidden = !weekly;
if (toggleWrap) toggleWrap.hidden = !weekly;
if (!weekly) {
  if (toggle) toggle.checked = false;
  cycleHolidayWeeksDraft = [];
}
if (holidayConfig) holidayConfig.hidden = !(weekly && toggle && toggle.checked);
renderCycleHolidayDraft();
}
function previewCycleHolidayWeek() {
  const date = document.getElementById('cycle-holiday-date')?.value;
  const start = document.getElementById('cycle-start')?.value;
  const end = document.getElementById('cycle-end')?.value;
  const label = document.getElementById('cycle-holiday-week-label');
  if (!label) return;
  if (!date) { label.value = ''; return; }
  if (start && end && (date < start || date > end)) {
    label.value = 'Data fora do período';
    return;
  }
  const ws = getWeekStartIso(date);
  label.value = `${fmtDateBR(ws)} a ${fmtDateBR(getWeekEndIso(ws))}`;
  const existing = cycleHolidayWeeksDraft.find(x => x.weekStart === ws);
  if (existing) {
    setDurationFields('cycle-holiday-goal-hours','cycle-holiday-goal-minutes',existing.goalMinutes);
    setDurationFields('cycle-holiday-min-hours','cycle-holiday-min-minutes',existing.minimumMinutes);
  }
}
function addCycleHolidayWeek() {
  const date = document.getElementById('cycle-holiday-date')?.value;
  const start = document.getElementById('cycle-start')?.value;
  const end = document.getElementById('cycle-end')?.value;
  if (!date) return alert('Selecione o dia do feriado.');
  if (start && end && (date < start || date > end)) return alert('O feriado precisa estar dentro do período.');
  const weekStart = getWeekStartIso(date);
  const goalMinutes = minutesFromFields('cycle-holiday-goal-hours','cycle-holiday-goal-minutes');
  const minimumMinutes = minutesFromFields('cycle-holiday-min-hours','cycle-holiday-min-minutes');
  if (goalMinutes <= 0) return alert('Defina a meta da semana com feriado.');
  if (minimumMinutes > goalMinutes) return alert('O mínimo da semana não pode ser maior que a meta.');
  const item = { holidayDate: date, weekStart, goalMinutes, minimumMinutes };
  const index = cycleHolidayWeeksDraft.findIndex(x => x.weekStart === weekStart);
  if (index >= 0) cycleHolidayWeeksDraft[index] = item;
  else cycleHolidayWeeksDraft.push(item);
  cycleHolidayWeeksDraft.sort((a,b) => a.weekStart.localeCompare(b.weekStart));
  renderCycleHolidayDraft();
  document.getElementById('cycle-holiday-date').value = '';
  document.getElementById('cycle-holiday-week-label').value = '';
  return true;
}
function removeCycleHolidayWeek(index) {
  cycleHolidayWeeksDraft.splice(index, 1);
  renderCycleHolidayDraft();
}
function renderCycleHolidayDraft() {
  const list = document.getElementById('cycle-holiday-list');
  if (!list) return;
  if (!cycleHolidayWeeksDraft.length) {
    list.innerHTML = '<div class="empty" style="padding:8px 0">Nenhum feriado cadastrado.</div>';
    return;
  }
  list.innerHTML = cycleHolidayWeeksDraft.map((x,i) => `<div class="cycle-holiday-item"><div><strong>Feriado: ${fmtDateBR(x.holidayDate)}</strong><span>Semana de ${fmtDateBR(x.weekStart)} a ${fmtDateBR(getWeekEndIso(x.weekStart))} · Meta: ${formatCycleDraftMinutes(x.goalMinutes)} · Mínimo: ${formatCycleDraftMinutes(x.minimumMinutes)}</span></div><button type="button" class="cycle-holiday-delete" onclick="removeCycleHolidayWeek(${i})" title="Excluir exceção" aria-label="Excluir exceção">×</button></div>`).join('');
}
