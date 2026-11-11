/**
 * Cronômetro: iniciar, parar, editar horário de início e atualização na tela.
 */

async function startTimer() {
  if (isTrackerObserver()) return;
  if (isActionPending('start-timer')) return;
  const activity = document.getElementById('activity-input').value.trim();
  const cargo = document.getElementById('cargo-input').value;
  const modalidade = document.getElementById('modalidade-input').value;
  if (!cargo || cargo === '__manage__') return alert('Selecione ou adicione um cargo/projeto.');
  if (modalidade === '__manage__') return;
  const date = localDateStr(new Date());

  

  const now = new Date();
  const startH = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');

  return runOnce('start-timer', document.getElementById('timer-btn'), 'Iniciando...', async () => {
    DB.saveRunning({
      id: 'running', activity, cargo, cargoColor: getCargoColor(cargo), modalidade, date,
      user: session.username, teamCode: session.teamCode,
      start: now.toISOString(), startTime: startH
    });
    setTimerUI(true); startTick(); refreshAppViews();
    writeSeq++; pendingWrites++;
    try {
      await api('startTimer', {
        code: session.teamCode, activity, cargo, cargoColor: getCargoColor(cargo), modalidade,
        date, startTime: startH, start: now.toISOString()
      });
    } catch (err) {
      DB.saveRunning(null); clearInterval(tickInterval);
      document.getElementById('activity-input').disabled = false;
      document.getElementById('timer-digits').textContent = '00:00:00';
      setTimerUI(false); refreshAppViews();
      alert('Erro ao iniciar: ' + err.message);
    } finally { pendingWrites--; }
  });
}

async function stopTimer() {
  if (isTrackerObserver()) return;
  return runOnce('stop-timer', document.getElementById('timer-btn'), 'Parando...', async () => {
    const run = DB.getRunning(); if (!run) return;
    clearTimeout(timerActivitySaveTimeout);
    const finalActivity = document.getElementById('activity-input').value.trim();
    const end = new Date();
    const tempId = 'tmp-' + end.getTime();
    const endH = String(end.getHours()).padStart(2, '0') + ':' + String(end.getMinutes()).padStart(2, '0');
    DB.saveEntries([...DB.getEntries(), {
      id: tempId, user: run.user || session.username, teamCode: run.teamCode || session.teamCode,
      activity: finalActivity, cargo: run.cargo, cargoColor: run.cargoColor, modalidade: run.modalidade,
      date: run.date, startTime: run.startTime, endTime: endH,
      duration: Math.max(0, end.getTime() - new Date(run.start).getTime())
    }]);
    DB.saveRunning(null); clearInterval(tickInterval);
    document.getElementById('activity-input').disabled = false;
    document.getElementById('activity-input').value = '';
    document.getElementById('timer-digits').textContent = '00:00:00';
    setTimerUI(false); refreshAppViews();
    updateSuggestions();

    writeSeq++; pendingWrites++;
    try {
      const r = await api('stopTimer', { end: end.toISOString(), activity: finalActivity });
      const e = DB.getEntries().find(x => x.id === tempId);
      if (e && r && r.entryId) e.id = r.entryId;
      renderEntries();
    } catch (err) {
      DB.saveEntries(DB.getEntries().filter(x => x.id !== tempId));
      refreshAppViews();
      alert('Erro ao parar: ' + err.message);
    } finally { pendingWrites--; }
  });
}

function handleTimerStartKey(event, input) {
  if (event.key === 'Enter') { event.preventDefault(); input.blur(); }
  else if (event.key === 'Escape') {
    const run = DB.getRunning();
    input.value = run ? run.startTime : '';
    input.blur();
  }
}

async function commitTimerStart(input) {
  if (isTrackerObserver()) return;
  const run = DB.getRunning();
  if (!run) return;
  const raw = String(input.value || '').trim();
  if (!raw) { input.value = run.startTime; return; }
  const normalized = normalizeTime(raw, true);
  if (normalized === null) {
    input.value = run.startTime;
    alert('Informe um horário válido de 00:00 a 23:59.');
    return;
  }
  input.value = normalized;
  if (normalized === run.startTime) return;

  const newStart = new Date(`${run.date}T${normalized}`);
  if (isNaN(newStart.getTime()) || newStart.getTime() > Date.now()) {
    input.value = run.startTime;
    alert('O horário de início não pode estar no futuro.');
    return;
  }

  const previous = { start: run.start, startTime: run.startTime };
  run.start = newStart.toISOString();
  run.startTime = normalized;
  document.getElementById('timer-digits').textContent = fmtDur(Date.now() - newStart.getTime(), true);
  renderCycleBadge();

  writeSeq++; pendingWrites++;
  try {
    await api('updateTimerStart', { start: run.start, startTime: normalized });
  } catch (err) {
    if (DB.getRunning() === run) {
      run.start = previous.start;
      run.startTime = previous.startTime;
      input.value = previous.startTime;
      document.getElementById('timer-digits').textContent = fmtDur(Date.now() - new Date(run.start).getTime(), true);
      renderCycleBadge();
    }
    alert('Erro ao alterar o início: ' + err.message);
  } finally { pendingWrites--; }
}

function startTick() {
  clearInterval(tickInterval);
  tickInterval = setInterval(() => {
    const r = DB.getRunning(); if (!r) return;
    document.getElementById('timer-digits').textContent = fmtDur(Date.now() - new Date(r.start).getTime(), true);
    syncTimerStartInput();
    renderCycleBadge();
  }, 1000);
}

function syncTimerStartInput() {
  const input = document.getElementById('timer-start-input');
  const run = DB.getRunning();
  if (input && run && document.activeElement !== input) input.value = run.startTime || '';
}
function setTimerUI(isRun) {
  const btn = document.getElementById('timer-btn');
  const startInput = document.getElementById('timer-start-input');
  if (startInput) startInput.hidden = !isRun;
  if (isRun) { btn.textContent = 'PARAR'; btn.className = 'btn-pill btn-stop'; syncTimerStartInput(); }
  else { btn.textContent = 'INICIAR'; btn.className = 'btn-pill btn-start'; }
}
