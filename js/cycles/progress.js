/**
 * Cálculo de progresso do período, avisos e selo de status.
 */

function getActiveCycle() {
  if (!session || !session.teamCode) return null;
  const todayStr = localDateStr(new Date());
  return DB.getCycles().find(c => c.teamCode === session.teamCode && todayStr >= c.startDate && todayStr <= c.endDate) || null;
}

// Período atual do período, sempre alinhado ao calendário:
//  - semanas: segunda-feira -> domingo (nunca blocos de 7 dias a partir do início do período);
//  - dias: cada dia do calendário (00:00 -> 23:59);
//  - horas: cada hora cheia do relógio (HH:00 -> HH:59).
// Apenas o trecho do período que está dentro das datas do período é contabilizado.
function getCyclePeriodRange(cycle) {
  const unitMs = CYCLE_UNIT_MS[cycle.unit];
  const startMs = new Date(`${cycle.startDate}T00:00:00`).getTime();
  const endMs = new Date(`${cycle.endDate}T23:59:59.999`).getTime();
  const nowMs = Date.now();
  const ref = new Date(Math.min(Math.max(nowMs, startMs), endMs));
  let periodStart, periodEnd;
  if (cycle.unit === 'weeks') {
    const dow = (ref.getDay() + 6) % 7; // 0 = segunda ... 6 = domingo
    const monday = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate() - dow);
    periodStart = monday.getTime();
    periodEnd = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 7).getTime();
  } else if (cycle.unit === 'days') {
    periodStart = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate()).getTime();
    periodEnd = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate() + 1).getTime();
  } else {
    periodStart = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate(), ref.getHours()).getTime();
    periodEnd = periodStart + unitMs;
  }
  // Somente o intervalo efetivamente abrangido pelo período entra na contagem
  const countStart = Math.max(periodStart, startMs);
  const countEnd = Math.min(periodEnd, endMs + 1);
  return { periodStart, periodEnd, countStart, countEnd, unitMs, startMs, endMs, nowMs };
}

// Quantos períodos (do atual até o fim do período, inclusive) ainda restam
function countRemainingPeriods(cycle, periodStart) {
  const end = new Date(`${cycle.endDate}T00:00:00`);
  const start = new Date(periodStart);
  if (cycle.unit === 'hours') {
    const endMs = new Date(`${cycle.endDate}T23:59:59.999`).getTime();
    return Math.max(1, Math.ceil((endMs + 1 - periodStart) / 3600000 - 0.01));
  }
  const dayDiff = Math.round((new Date(end.getFullYear(), end.getMonth(), end.getDate()) - new Date(start.getFullYear(), start.getMonth(), start.getDate())) / 86400000);
  if (cycle.unit === 'weeks') return Math.max(1, Math.floor(dayDiff / 7) + 1);
  return Math.max(1, dayDiff + 1);
}

// Sum durations by activity date throughout the cycle, including retroactive entries.
function getCycleWeeklyPeriods(cycle) {
  const first = new Date(`${cycle.startDate}T00:00:00`);
  first.setDate(first.getDate() - (first.getDay() + 6) % 7);
  const last = new Date(`${cycle.endDate}T00:00:00`);
  last.setDate(last.getDate() - (last.getDay() + 6) % 7);
  const result = [];
  const exceptions = Array.isArray(cycle.holidayWeeks) ? cycle.holidayWeeks : [];
  const byWeek = {};
  exceptions.forEach(x => { byWeek[x.weekStart] = x; });
  for (let d = new Date(first); d <= last; d.setDate(d.getDate() + 7)) {
    const weekStart = localDateStr(d);
    const exception = byWeek[weekStart];
    result.push({
      weekStart,
      weekEnd: getWeekEndIso(weekStart),
      holidayDate: exception?.holidayDate || '',
      goalMinutes: Number(exception?.goalMinutes) || Number(cycle.goalMinutes) || 0,
      minimumMinutes: Number(exception?.minimumMinutes) || Number(cycle.minimumMinutes) || 0
    });
  }
  return result;
}

function computeCycleProgress(cycle, username = session.username) {
  const { periodStart, countStart, countEnd } = getCyclePeriodRange(cycle);
  const first = new Date(cycle.startDate + 'T00:00:00');
  if (cycle.unit === 'weeks') first.setDate(first.getDate() - (first.getDay() + 6) % 7);
  const weeklyPeriods = cycle.unit === 'weeks' ? getCycleWeeklyPeriods(cycle) : [];
  const totalPeriods = cycle.unit === 'weeks' ? weeklyPeriods.length : countRemainingPeriods(cycle, first.getTime());
  const periodsRemaining = countRemainingPeriods(cycle, periodStart);
  const all = DB.getEntries().filter(e => e.teamCode === session.teamCode && e.user === username);
  const run = DB.getRunning();
  if (run && run.teamCode === session.teamCode && run.user === username) all.push({...run, isRunning:true});
  const counted = effectiveWorkDurations(all.filter(e => {
    const date = e.date || (e.start ? localDateStr(new Date(e.start)) : '');
    return date >= cycle.startDate && date <= cycle.endDate;
  }));
  let loggedMs = 0, currentLoggedMs = 0;
  all.forEach(e => {
    const date = e.date || (e.start ? localDateStr(new Date(e.start)) : '');
    if (date < cycle.startDate || date > cycle.endDate) return;
    const duration = counted.get(e) || 0;
    const activityTs = new Date(date + 'T' + (e.startTime || '00:00')).getTime();
    loggedMs += duration;
    if (activityTs >= countStart && activityTs < countEnd) currentLoggedMs += duration;
  });

  let basePeriodGoalMs = Number(cycle.goalMinutes) * 60000;
  let currentMinimumMs = 0;
  let currentGoalMs = basePeriodGoalMs;
  let weightShare = 1 / periodsRemaining; // divisão igual: fatia da semana atual no que ainda falta
  if (cycle.unit === 'weeks') {
    const currentWeekStart = localDateStr(new Date(periodStart));
    const currentWeek = weeklyPeriods.find(w => w.weekStart === currentWeekStart) || { goalMinutes: cycle.goalMinutes, minimumMinutes: cycle.minimumMinutes || 0 };
    currentGoalMs = currentWeek.goalMinutes * 60000;
    currentMinimumMs = currentWeek.minimumMinutes * 60000;
    basePeriodGoalMs = currentGoalMs;
    // O que falta no período é dividido por igual entre as semanas restantes
    // (weightShare = 1 / periodsRemaining), sem ponderar pela meta de cada semana.
  }

  const goalMs = cycle.unit === 'weeks'
    ? weeklyPeriods.reduce((sum, w) => sum + w.goalMinutes * 60000, 0)
    : totalPeriods * basePeriodGoalMs;
  const remainingMs = Math.max(0, goalMs - loggedMs);
  const loggedBeforeCurrentPeriodMs = loggedMs - currentLoggedMs;
  const remainingAtPeriodStartMs = Math.max(0, goalMs - loggedBeforeCurrentPeriodMs);
  const balanceTargetMs = Math.max(0, remainingAtPeriodStartMs * weightShare);
  const targetThisPeriodMs = Math.max(currentMinimumMs, balanceTargetMs);
  const remainingThisPeriodMs = Math.max(0, targetThisPeriodMs - currentLoggedMs);
  const requiredMs = remainingMs / periodsRemaining;
  // A conclusão exige cumprir também o mínimo da unidade atual.
  const periodCompleted = remainingThisPeriodMs <= 30000;
  const needsExtra = !periodCompleted && targetThisPeriodMs > basePeriodGoalMs + 30000;
  const alertLevel = periodCompleted ? 'success' : (targetThisPeriodMs - currentLoggedMs > 25 * 3600000 ? 'danger' : 'warning');
  return { loggedMs, currentLoggedMs, goalMs, remainingMs, requiredMs, periodsRemaining, totalPeriods, basePeriodGoalMs, targetThisPeriodMs, remainingThisPeriodMs, periodCompleted, needsExtra, currentGoalMs, currentMinimumMs, alertLevel };
}

function formatHM(ms) {
  const totalMin = Math.round(Math.max(0, ms) / 60000);
  const h = Math.floor(totalMin / 60), m = totalMin % 60;
  if (h <= 0 && m <= 0) return '0m';
  if (m === 0) return `${h}h`;
  if (h === 0) return `${m}m`;
  return `${h}h ${m}m`;
}

function cycleAverageLabel(unit) {
  if (unit === 'days') return 'média diária';
  if (unit === 'hours') return 'média por hora';
  return 'média semanal';
}

function buildCycleMessage(cycle, username = session.username) {
  const progress = computeCycleProgress(cycle, username);
  const { remainingMs, remainingThisPeriodMs, periodsRemaining, periodCompleted, targetThisPeriodMs } = progress;
  const u = CYCLE_UNIT_TEXT[cycle.unit];
  const avgLabel = cycleAverageLabel(cycle.unit);
  let line1;
  if (periodCompleted) line1 = 'Média da semana atingida.';
  else if (targetThisPeriodMs - progress.currentLoggedMs > 25 * 3600000) line1 = `Faltam ${formatHM(remainingThisPeriodMs)} para cumprir a média semanal.`;
  else line1 = `Faltam ${formatHM(remainingThisPeriodMs)} para bater a ${avgLabel}.`;
  const unitWord = periodsRemaining === 1 ? u.singular : u.plural;
  const lastPeriodText = cycle.unit === 'weeks'
    ? 'Esta é a última semana do período.'
    : cycle.unit === 'hours'
      ? 'Esta é a última hora do período.'
      : 'Este é o último dia do período.';
  const line2 = periodsRemaining === 1 ? lastPeriodText : `O período termina em ${periodsRemaining} ${unitWord}.`;
  return { line1, line2, progress };
}

function statusIconSvg(status) {
  if (status === 'danger') return `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"></circle><path d="M8.5 8.5 15.5 15.5M15.5 8.5 8.5 15.5"></path></svg>`;
  if (status === 'warning') return `<svg viewBox="0 0 24 24"><path d="M10.3 4.2 2.8 17.3A2 2 0 0 0 4.5 20h15a2 2 0 0 0 1.7-2.7L13.7 4.2a2 2 0 0 0-3.4 0Z"></path><path d="M12 9v4"></path><path d="M12 16.5h.01"></path></svg>`;
  if (status === 'success') return `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"></circle><path d="m8 12.3 2.6 2.6L16.5 9"></path></svg>`;
  return `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"></circle><path d="M12 7.5V12l3 2"></path></svg>`;
}

function ensureFinalPeriodNotice() {
  let overlay = document.getElementById('final-period-overlay');
  if (overlay) return overlay;
  overlay = document.createElement('div');
  overlay.id = 'final-period-overlay';
  overlay.className = 'final-period-overlay';
  overlay.hidden = true;
  overlay.innerHTML = `<div class="final-period-notice" role="dialog" aria-modal="true" aria-labelledby="final-period-title">
      <button class="final-period-close" type="button" aria-label="Fechar aviso" onclick="dismissFinalPeriodNotice()">×</button>
      <div class="final-period-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M6 3v3M18 3v3"></path><rect x="3.5" y="5" width="17" height="15.5" rx="2"></rect><path d="M3.5 10h17"></path><path d="M12 13v3"></path><path d="M12 18h.01"></path></svg></div>
      <h2 id="final-period-title"></h2>
      <p id="final-period-text"></p>
    </div>`;
  document.body.appendChild(overlay);
  return overlay;
}

function finalNoticeKey(cycle) {
  const { periodStart } = getCyclePeriodRange(cycle);
  return `petimer_final_notice_${session.teamCode}_${session.username}_${cycle.startDate}_${cycle.endDate}_${cycle.unit}_${periodStart}`;
}

function dismissFinalPeriodNotice() {
  const cycle = getActiveCycle();
  if (cycle) sessionStorage.setItem(finalNoticeKey(cycle), '1');
  const overlay = document.getElementById('final-period-overlay');
  if (overlay) overlay.hidden = true;
}

function renderFinalPeriodNotice(cycle, progress) {
  const overlay = ensureFinalPeriodNotice();
  const mainApp = document.getElementById('main-app');
  const insideSelectedTeam = !!(session && session.username && session.teamCode && mainApp && !mainApp.hidden);

  if (!insideSelectedTeam || !cycle || currentView !== 'tracker' || progress.periodsRemaining !== 1 || sessionStorage.getItem(finalNoticeKey(cycle)) === '1') {
    overlay.hidden = true;
    return;
  }
  const u = CYCLE_UNIT_TEXT[cycle.unit];
  const periodName = u.singular;
  // O aviso superior utiliza remainingThisPeriodMs: respeita o mínimo da semana,
  // além do saldo redistribuído do período. A janela precisa usar o mesmo valor.
  const remaining = Math.max(0, progress.remainingThisPeriodMs);
  const isWeek = periodName === 'semana';
  document.getElementById('final-period-title').textContent = isWeek
    ? 'Esta é a última semana do período'
    : `Este é o último ${periodName} do período`;
  document.getElementById('final-period-text').innerHTML = !progress.periodCompleted && remaining > 30000
    ? `Para cumprir a meta ${isWeek ? 'semanal' : 'do período'}, você precisa registrar <strong>${escapeHtml(formatHM(remaining))}</strong> ${isWeek ? 'nesta última semana' : `neste último ${escapeHtml(periodName)}`}.`
    : `Você já cumpriu a meta ${isWeek ? 'desta semana' : 'necessária do período'}. Continue registrando suas atividades normalmente.`;
  overlay.hidden = false;
}

// Capacidade apenas visual; não participa dos cálculos de meta/média.
const MAX_RECOVERY_HOURS_PER_DAY = 4;
function weeklyBadgePresentation(cycle, progress) {
  const {nowMs, countEnd} = getCyclePeriodRange(cycle);
  let capacityMs = 0;
  for (let cursor = nowMs; cursor < countEnd;) {
    const day = new Date(cursor);
    const next = Math.min(countEnd, new Date(day.getFullYear(), day.getMonth(), day.getDate()+1).getTime());
    capacityMs += Math.min(MAX_RECOVERY_HOURS_PER_DAY * 3600000, next - cursor);
    cursor = next;
  }
  const status = progress.periodCompleted ? 'success' : progress.remainingThisPeriodMs <= capacityMs ? 'warning' : 'danger';
  const currentWeek = Math.max(1, Math.min(progress.totalPeriods, progress.totalPeriods - progress.periodsRemaining + 1));
  const lastWeek = progress.periodsRemaining === 1;
  return {
    status, lastWeek,
    pill: lastWeek ? 'Última semana' : `Semana ${currentWeek} de ${progress.totalPeriods}`,
    line1: progress.periodCompleted ? 'Média semanal atingida!' : `Faltam ${formatHM(progress.remainingThisPeriodMs)} para bater a média semanal.`,
    line2: `${formatHM(progress.currentLoggedMs)} de ${formatHM(progress.currentGoalMs)} completas`
  };
}
function weeklyBadgeIcon(status) {
  const path = status === 'success' ? '<circle cx="12" cy="12" r="9"></circle><path d="m7.5 12 3 3 6-6"></path>'
    : status === 'danger' ? '<path d="M5 21V4m0 0h13l-3 4 3 4H5"></path>'
    : '<circle cx="12" cy="12" r="9"></circle><path d="M12 7v5l3 2"></path>';
  return '<svg viewBox="0 0 24 24">' + path + '</svg>';
}

function renderCycleBadge() {
  const badge = document.getElementById('cycle-status-badge');
  if (!badge) return;
  if (currentView !== 'tracker') {
    badge.hidden = true;
    const overlay = document.getElementById('final-period-overlay');
    if (overlay) overlay.hidden = true;
    return;
  }
  // Modo observador: o cartão mostra o progresso de quem está sendo visualizado, não o do administrador.
  const observing = isTrackerObserver();
  if (observing) syncTrackerObserver();
  const progressUser = observing ? trackerObservedUser : session.username;
  if (observing) {
    const obsTeam = DB.getTeams()[session.teamCode];
    const observedIsIdleOwner = !!obsTeam && progressUser === obsTeam.admin && obsTeam.adminParticipatesInCycle === false;
    if (!progressUser || observedIsIdleOwner) { badge.hidden = true; badge.innerHTML = ''; return; }
  } else if (isTeamAdmin() && !adminParticipatesInCycle()) { badge.hidden = true; badge.innerHTML = ''; return; }
  const cycle = getActiveCycle();
  if (!cycle) {
    badge.hidden = true; badge.innerHTML = '';
    const overlay = document.getElementById('final-period-overlay');
    if (overlay) overlay.hidden = true;
    return;
  }
  let { line1, line2, progress } = buildCycleMessage(cycle, progressUser);
  const weekly = cycle.unit === 'weeks' ? weeklyBadgePresentation(cycle, progress) : null;
  if (weekly) { line1 = weekly.line1; line2 = weekly.line2; }
  const status = weekly ? weekly.status : progress.alertLevel || 'warning';
  badge.classList.toggle('is-weekly', !!weekly);
  badge.classList.toggle('is-warning', status === 'warning');
  badge.classList.toggle('is-success', status === 'success');
  badge.classList.toggle('is-danger', status === 'danger');
  badge.innerHTML = `<span class="line-icon" aria-hidden="true">${weekly ? weeklyBadgeIcon(status) : statusIconSvg(status)}</span><div class="cycle-badge-copy"><div class="cycle-badge-main">${escapeHtml(line1)}</div>${weekly ? '' : `<div class="cycle-badge-sub">${escapeHtml(line2)}</div>`}</div>${weekly ? `<span class="cycle-week-pill${weekly.lastWeek ? ' is-last' : ''}"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="5" width="16" height="16" rx="2"></rect><path d="M8 3v4M16 3v4M4 10h16"></path></svg>${escapeHtml(weekly.pill)}</span><span class="cycle-badge-sr">${status === 'danger' ? 'Ritmo de recuperação acima de ' + MAX_RECOVERY_HOURS_PER_DAY + ' horas por dia disponível.' : status === 'warning' ? 'Meta viável no tempo disponível.' : ''}</span>` : ''}`;
  badge.hidden = false;
  if (observing) {
    const overlay = document.getElementById('final-period-overlay');
    if (overlay) overlay.hidden = true; // o aviso de "última semana" é pessoal, não aparece ao observar outra pessoa
  } else {
    renderFinalPeriodNotice(cycle, progress);
  }
}
