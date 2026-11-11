/**
 * Formulário de registro: tempo digitado, data, modo manual e addManualEntry().
 */

// ADICIONAR REGISTRO MANUALMENTE

function normalizeTime(value, manual = false) {
  const digits = String(value || '').replace(/\D/g, '').slice(0, 4);
  if (!digits) return null;
  let hours = 0, minutes = 0;
  if (digits.length <= 2) {
    hours = Number(digits);
    if (manual && hours > 23 && digits.length === 2) { hours = Number(digits[0]); minutes = Number(digits[1]) * 10; }
  } else if (digits.length === 3) {
    hours = Number(digits.slice(0, 2));
    minutes = Number(digits[2]) * 10;
    if (manual && (hours > 23 || minutes > 59)) { hours = Number(digits[0]); minutes = Number(digits.slice(1, 3)); }
  } else {
    hours = Number(digits.slice(0, 2));
    minutes = Number(digits.slice(2, 4));
  }
  if (hours > 23 || minutes > 59) return null;
  return String(hours).padStart(2, '0') + ':' + String(minutes).padStart(2, '0');
}
function beginClockEdit(input) {
  if (!input) return;
  input.dataset.previousValue = input.value || '00:00';
  input.value = '';
  input.setCustomValidity('');
}
function sanitizeTimeTyping(input) {
  input.value = String(input.value || '').replace(/\D/g, '').slice(0, 4);
  input.setCustomValidity('');
}
function inheritManualEndTime() {
  const input = document.getElementById('time-end');
  const raw = String(input.value || '').trim();
  if (input.dataset.userDefined === '1') {
    if (!raw) input.value = input.dataset.previousValue || '00:00';
    return;
  }
  if (raw && raw !== '00:00' && raw !== input.dataset.inheritedValue) return;
  const start = normalizeTime(document.getElementById('time-start').value, true);
  if (start) { input.value = start; input.dataset.inheritedValue = start; }
}
function finishClockEdit(input) {
  if (!input) return false;
  const raw = String(input.value || '').trim();
  if (!raw && input.id === 'time-end' && input.dataset.userDefined !== '1') {
    inheritManualEndTime(); input.setCustomValidity(''); return false;
  }
  if (!raw) {
    input.value = input.dataset.previousValue || '00:00';
    input.setCustomValidity('');
    return false;
  }
  const normalized = normalizeTime(raw, true);
  if (normalized === null) {
    input.value = input.dataset.previousValue || '00:00';
    input.setCustomValidity('Informe um horário válido de 00:00 a 23:59.');
    input.reportValidity();
    return false;
  }
  input.value = normalized;
  if (input.id === 'time-end') input.dataset.userDefined = '1';
  else if (input.id === 'time-start') inheritManualEndTime();
  input.setCustomValidity('');
  return true;
}

async function finishEntryClockEdit(input, id, field) {
if (!input || input.dataset.saving === '1') return;
const previous = input.dataset.previousValue || '00:00';
const raw = String(input.value || '').trim();

if (!raw) { input.value = previous; return; }

const normalized = normalizeTime(raw, true);
if (normalized === null) {
  input.value = previous;
  alert('Informe um horário válido de 00:00 a 23:59.');
  return;
}

input.value = normalized;
if (normalized === previous) return;

input.dataset.saving = '1';
try { await updateEntry(id, field, normalized); }
finally { delete input.dataset.saving; }
}

function handleEntryClockKey(event, input, id, field) {
if (event.key === 'Enter') {
  event.preventDefault();
  input.blur();
} else if (event.key === 'Escape') {
  input.value = input.dataset.previousValue || input.value;
  input.blur();
}
}
function normalizeTimeField(input) {
  const normalized = normalizeTime(input.value, true);
  input.setCustomValidity(normalized === null ? 'Informe um horário válido de 00:00 a 23:59.' : '');
  if (normalized === null) { input.reportValidity(); return false; }
  input.value = normalized;
  return true;
}
function selectedDateText(value, now = new Date()) {
  if (value === localDateStr(now)) return 'HOJE';
  const yesterday = new Date(now); yesterday.setDate(yesterday.getDate() - 1);
  if (value === localDateStr(yesterday)) return 'ONTEM';
  return value.slice(8,10) + '/' + value.slice(5,7);
}

// A data do registro manual acompanha o relógio local, a menos que o usuário
// escolha explicitamente uma data diferente da atual pelo calendário.
let entryDateManuallySelected = false;
let lastObservedEntryDay = localDateStr(new Date());

function updateSelectedDate() {
  const input = document.getElementById('date-input');
  if (!input) return;
  if (!input.value) input.value = localDateStr(new Date());
  document.getElementById('selected-date-label').textContent = selectedDateText(input.value);
}

function resetAutomaticEntryDate() {
  const today = localDateStr(new Date());
  lastObservedEntryDay = today;
  entryDateManuallySelected = false;
  const input = document.getElementById('date-input');
  if (input) input.value = today;
  updateSelectedDate();
}

function handleManualEntryDateChange() {
  const input = document.getElementById('date-input');
  if (!input) return;
  const today = localDateStr(new Date());
  lastObservedEntryDay = today;
  entryDateManuallySelected = Boolean(input.value && input.value !== today);
  updateSelectedDate();
}

function syncEntryDateAtDayChange() {
  const today = localDateStr(new Date());
  if (today === lastObservedEntryDay) return;
  lastObservedEntryDay = today;
  const input = document.getElementById('date-input');
  if (!input) return;
  if (!entryDateManuallySelected) input.value = today;
  // Mesmo uma data fixada manualmente deve deixar de mostrar HOJE/ONTEM
  // quando o dia do calendário mudar.
  updateSelectedDate();
}
function setEntryMode(mode) {
  document.getElementById('manual-controls').hidden = mode !== 'manual';
  document.getElementById('timer-controls').hidden = mode !== 'timer';
}
document.addEventListener('DOMContentLoaded', () => {
  ['time-start', 'time-end'].forEach(id => {
    const input = document.getElementById(id);
    input.addEventListener('focus', () => beginClockEdit(input));
    input.addEventListener('beforeinput', event => {
      if (event.inputType === 'insertText' && event.data && !/^\d+$/.test(event.data)) event.preventDefault();
    });
    input.addEventListener('input', () => sanitizeTimeTyping(input));
    input.addEventListener('blur', () => finishClockEdit(input));
    input.addEventListener('keydown', event => {
      if (event.key === 'Enter') { event.preventDefault(); if (finishClockEdit(input)) input.blur(); }
      if (event.key === 'Escape') { input.value = input.dataset.previousValue || '00:00'; input.blur(); }
    });
  });
  updateSelectedDate();
  // Checagem periódica, ao voltar à aba e antes de registrar: cobre também
  // navegadores que suspendem timers quando a página fica em segundo plano.
  setInterval(syncEntryDateAtDayChange, 30000);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) syncEntryDateAtDayChange();
  });
  window.addEventListener('focus', syncEntryDateAtDayChange);
});

async function addManualEntry(btn) {
  if (isTrackerObserver()) return;
  if (isActionPending('add-entry')) return;
  // Garante a data correta mesmo se a virada ocorreu enquanto a aba dormia.
  syncEntryDateAtDayChange();
  inheritManualEndTime();
  if (!["time-start", "time-end"].map(id => normalizeTimeField(document.getElementById(id))).every(Boolean)) return;
  const activity = document.getElementById('activity-input').value.trim();
  const cargo = document.getElementById('cargo-input').value;
  const modalidade = document.getElementById('modalidade-input').value;
  if (!cargo || cargo === '__manage__') return alert('Selecione ou adicione um cargo/projeto.');
  if (modalidade === '__manage__') return;
  const date = document.getElementById('date-input').value;
  const startT = document.getElementById('time-start').value;
  const endT = document.getElementById('time-end').value;

  if (!date || !startT || !endT) return alert('Preencha a data e as horas de início e fim.');

  const startObj = new Date(`${date}T${startT}`);
  const endObj = new Date(`${date}T${endT}`);

  // Término antes do início = a atividade passou da meia-noite. Ela é salva em dois trechos,
  // um em cada dia (até 23:59 e a partir de 00:00), com a duração total preservada.
  // Término "00:00" significa fim do dia: vira um único trecho até a meia-noite.
  const crossesMidnight = endObj.getTime() < startObj.getTime();
  let nextDate = null;
  const parts = [];
  if (!crossesMidnight) {
    parts.push({ date, startTime: startT, endTime: endT, duration: endObj.getTime() - startObj.getTime() });
  } else {
    const nd = new Date(`${date}T12:00:00`); nd.setDate(nd.getDate() + 1);
    nextDate = localDateStr(nd);
    const midnight = new Date(`${nextDate}T00:00`);
    parts.push({ date, startTime: startT, endTime: '23:59', duration: midnight.getTime() - startObj.getTime() });
    if (endT !== '00:00') {
      parts.push({ date: nextDate, startTime: '00:00', endTime: endT, duration: new Date(`${nextDate}T${endT}`).getTime() - midnight.getTime() });
    }
    const total = parts.reduce((sum, p) => sum + p.duration, 0);
    if (total > 12 * 3600000) {
      const fmtDay = d => d.slice(8, 10) + '/' + d.slice(5, 7);
      const ok = await appConfirm({
        title: 'Atividade longa',
        message: `Esta atividade vai de ${startT} (${fmtDay(date)}) até ${endT} (${fmtDay(nextDate)}), com ${fmtDur(total, true)} de duração. Registrar mesmo assim?`,
        confirmText: 'Registrar',
        danger: false
      });
      if (!ok) return;
    }
  }

  if (!btn) btn = document.querySelector('button.manual-add');
  // Atualização otimista: o registro aparece na hora e o servidor salva em segundo plano.
  const stamp = Date.now();
  const temps = parts.map((p, i) => ({
    id: 'tmp-' + stamp + '-' + i, user: session.username, teamCode: session.teamCode, activity, cargo,
    cargoColor: getCargoColor(cargo), modalidade, date: p.date, startTime: p.startTime, endTime: p.endTime, duration: p.duration
  }));
  DB.saveEntries([...DB.getEntries(), ...temps]);
  document.getElementById('time-start').value = endT;
  document.getElementById('time-end').value = '00:00';
  delete document.getElementById('time-end').dataset.userDefined;
  delete document.getElementById('time-end').dataset.inheritedValue;
  document.getElementById('activity-input').value = '';
  if (crossesMidnight) { document.getElementById('date-input').value = nextDate; updateSelectedDate(); }
  refreshAppViews();
  updateSuggestions();

  writeSeq++; pendingWrites++;
  (async () => {
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i], tempId = temps[i].id;
      try {
        const r = await api('addEntry', {
          code: session.teamCode, activity, cargo, cargoColor: getCargoColor(cargo), modalidade,
          date: p.date, startTime: p.startTime, endTime: p.endTime, durationMs: p.duration
        });
        const e = DB.getEntries().find(x => x.id === tempId);
        if (e && r && r.entryId) e.id = r.entryId;
        renderEntries();
      } catch (err) {
        const failed = temps.slice(i).map(t => t.id);
        DB.saveEntries(DB.getEntries().filter(x => !failed.includes(x.id)));
        refreshAppViews();
        alert('Erro ao salvar: ' + err.message + (i > 0 ? ' O primeiro trecho (até 23:59) foi salvo; refaça só o trecho do dia seguinte.' : ''));
        break;
      }
    }
  })().finally(() => { pendingWrites--; });
}
