/**
 * Análise por período e metas de horas por cargo/projeto.
 */

// ---------- Análise › Período (planilha de horas por semana do período) ----------
let analysisPeriodCycleId = null;

function setAnalysisPeriodCycle(id) { analysisPeriodCycleId = id || null; renderAnalysis(); }

// Setas do filtro: delta +1 = período anterior (mais antigo), -1 = próximo (mais recente).
function changeAnalysisPeriodCycle(delta) {
  const cycles = DB.getCycles().filter(c => c.teamCode === session.teamCode).slice().sort((a, b) => String(b.startDate).localeCompare(String(a.startDate)));
  if (!cycles.length) return;
  const i = Math.max(0, cycles.findIndex(c => c.id === analysisPeriodCycleId));
  const next = cycles[Math.min(cycles.length - 1, Math.max(0, i + delta))];
  setAnalysisPeriodCycle(next.id);
}

function weekStartOfDate(dateStr) {
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() - (d.getDay() + 6) % 7);
  return localDateStr(d);
}

function fmtBR(iso) { const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? `${m[3]}/${m[2]}/${m[1]}` : ''; }

// Sem cargo selecionado, valem exclusivamente as metas gerais do Período.
// Cargos individuais só têm acompanhamento de metas quando configurados,
// exceto Projetos, que preserva a regra já existente até haver configuração.
function periodCargoHasGoal(cargo, cycle) {
  const key = String(cargo || '').trim().toLocaleLowerCase('pt-BR');
  if (!key) return true;
  const cfg = cycle ? resolveGoalConfig(cycle, key) : null;
  if (cfg) return !cfg.disabled;
  return key === 'projetos';
}


// ---------- Metas de horas por cargo/projeto (Análise › Acompanhamento) ----------
const GOAL_GEAR_SVG = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"></circle><circle cx="12" cy="12" r="6.5"></circle><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M18.7 5.3l-2.1 2.1M7.4 16.6l-2.1 2.1"></path></svg>';
function analysisGoalKey() { return String(document.getElementById('analysis-cargo')?.value || '').trim().toLocaleLowerCase('pt-BR'); }
function canEditGoals() {
  const k = analysisGoalKey();
  const t = (CACHE.myTeams || []).find(x => x.code === session.teamCode);
  return !!k && !!(t && t.isAdmin);
}
function goalGearButton() { return `<button type="button" class="goals-add-btn goals-edit-btn" title="Configurar metas deste cargo/projeto" aria-label="Configurar metas deste cargo/projeto" onclick="openGoalsModal()">${GOAL_GEAR_SVG}</button>`; }
// Versão vigente para o período: a última salva até o fim dele (períodos encerrados não mudam retroativamente).
function resolveGoalConfig(cycle, key) {
  let hit = null;
  (CACHE.goals || []).forEach(g => { if (g.cargo === key && String(g.effectiveFrom) <= String(cycle.endDate)) hit = g; });
  return hit;
}
// Entrada livre como nos horários do registro: 1 -> 01:00, 123 -> 12:30,
// 947 -> 09:47 e 2033 -> 20:33. HH:MM permite durações acima de 24 h.
function parseDurationInput(raw) {
  const t = String(raw || '').trim();
  if (!t) return null;
  const withColon = t.match(/^(\d{1,4}):([0-5]\d)$/);
  if (withColon) return Number(withColon[1]) * 60 + Number(withColon[2]);
  if (!/^\d{1,6}$/.test(t)) return null;
  const hhmm = (hh, mm) => mm < 60 ? hh * 60 + mm : null;
  if (t.length <= 2) {
    const h = Number(t);
    // Compatibilidade com a entrada manual: 93 -> 09:30.
    return t.length === 2 && h > 23
      ? hhmm(Number(t[0]), Number(t[1]) * 10) : h * 60;
  }
  if (t.length === 3) {
    const hh = Number(t.slice(0, 2)), last = Number(t[2]) * 10;
    // Ex.: 123 -> 12:30. Se a hora não cabe num relógio (947),
    // usar o padrão alternativo de entrada manual: 09:47.
    return hh <= 23 ? hhmm(hh, last) : hhmm(Number(t[0]), Number(t.slice(1)));
  }
  return hhmm(Number(t.slice(0, -2)), Number(t.slice(-2)));
}
function fmtDurationInput(min) { min = Math.max(0, Math.round(min || 0)); return String(Math.floor(min / 60)).padStart(2, '0') + ':' + String(min % 60).padStart(2, '0'); }
function beginGoalsDurationEdit(input) {
  input.dataset.previousValue = input.value || '00:00';
  input.value = '';
  input.setCustomValidity('');
}
function sanitizeGoalsDurationTyping(input) {
  // Não força máscara enquanto o usuário digita.
  input.value = input.value.replace(/[^\d:]/g, '').slice(0, 7);
  input.setCustomValidity('');
}
function finishGoalsDurationEdit(input) {
  const t = input.value.trim();
  const min = t ? parseDurationInput(t) : null;
  if (min === null || min > 60 * 168) {
    input.value = input.dataset.previousValue || '00:00';
    input.setCustomValidity('');
    if (t) {
      const err = document.getElementById('goals-err');
      if (err) { err.textContent = 'Duração inválida. Use HH:MM (ex.: 12:30 ou 25:00).'; err.hidden = false; }
    }
    return;
  }
  input.value = fmtDurationInput(min);
  const err = document.getElementById('goals-err');
  if (err) err.hidden = true;
}
function goalsToast(msg) {
  let el = document.getElementById('goals-toast');
  if (!el) { el = document.createElement('div'); el.id = 'goals-toast'; document.body.appendChild(el); }
  el.textContent = msg; el.className = 'show'; clearTimeout(el._t); el._t = setTimeout(() => el.className = '', 2600);
}
function canManageGoals() {
  const t = (CACHE.myTeams || []).find(x => x.code === session.teamCode);
  return !!(t && t.isAdmin);
}
// Os controles de metas só ficam disponíveis no período semanal ATIVO e selecionado.
function editableAnalysisGoalCycle() {
  const active = getActiveCycle();
  return active && active.id === analysisPeriodCycleId && active.unit === 'weeks' ? active : null;
}
function openAddGoalsModal() {
  if (!canManageGoals()) return;
  const cycle = editableAnalysisGoalCycle();
  const key = analysisGoalKey();
  if (!cycle || !key || periodCargoHasGoal(key, cycle)) return;
  openGoalsModal(key, true);
}
function openGoalsModal(keyOverride, adding = false) {
  if (!canManageGoals()) return;
  const cycle = editableAnalysisGoalCycle();
  const key = String(keyOverride || analysisGoalKey()).trim().toLocaleLowerCase('pt-BR');
  if (!cycle || !key || key !== analysisGoalKey()) return;
  if (adding ? periodCargoHasGoal(key, cycle) : !periodCargoHasGoal(key, cycle)) return;

  // O cargo/projeto já vem do filtro que originou a abertura; não há outro select no modal.
  const select = document.getElementById('analysis-cargo');
  const opt = Array.from(select?.options || []).find(o => o.value.toLocaleLowerCase('pt-BR') === key);
  if (!opt) return;
  const cargoName = opt.textContent;
  let cur = resolveGoalConfig(cycle, key);
  if (!cur || cur.disabled) {
    const h = (cycle.holidayWeeks || [])[0];
    cur = key === 'projetos'
      ? { normalMin: 60, normalAvg: 250, holidayMin: 60, holidayAvg: 200 }
      : adding
        ? { normalMin: 0, normalAvg: 0, holidayMin: 0, holidayAvg: 0 }
        : {
            normalMin: cycle.minimumMinutes || 0,
            normalAvg: cycle.goalMinutes || 0,
            holidayMin: h ? h.minimumMinutes : (cycle.minimumMinutes || 0),
            holidayAvg: h ? h.goalMinutes : (cycle.goalMinutes || 0)
          };
  }

  const opener = document.activeElement;
  closeGoalsModal();
  const f = (id, label, v) => `<div class="goals-field">
      <label for="${id}">${label}</label>
      <div class="goals-time-wrap">
        <input id="${id}" type="text" inputmode="numeric" autocomplete="off" spellcheck="false" placeholder="00:00"
          value="${fmtDurationInput(v)}" onfocus="beginGoalsDurationEdit(this)"
          oninput="sanitizeGoalsDurationTyping(this)" onblur="finishGoalsDurationEdit(this)"
          onkeydown="if(event.key==='Enter'){event.preventDefault();this.blur();}">
        <span class="goals-unit" aria-hidden="true">h</span>
      </div>
    </div>`;

  const bd = document.createElement('div');
  bd.id = 'goals-modal';
  bd.className = 'goals-backdrop';
  bd._opener = opener;
  bd.innerHTML = `<div class="goals-card" role="dialog" aria-modal="true" aria-labelledby="goals-title" aria-describedby="goals-subtitle">
      <button type="button" class="goals-x" aria-label="Fechar" onclick="closeGoalsModal()">×</button>
      <div class="goals-head">
        <h3 id="goals-title">Configurar metas de horas</h3>
        <span class="goals-cargo-badge">${escapeHtml(cargoName)}</span>
        <p class="goals-sub" id="goals-subtitle">Defina as metas semanais deste cargo/projeto.</p>
      </div>
      <section class="goals-sec" aria-labelledby="goals-normal-title">
        <h4 id="goals-normal-title" class="goals-sec-title">
          <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18"/></svg>
          Semanas normais
        </h4>
        <div class="goals-grid">${f('goal-nmin','Mínimo semanal',cur.normalMin)}${f('goal-navg','Média semanal necessária',cur.normalAvg)}</div>
        <p class="goals-hint">Usadas nas semanas sem feriado.</p>
      </section>
      <section class="goals-sec" aria-labelledby="goals-holiday-title">
        <h4 id="goals-holiday-title" class="goals-sec-title">
          <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3 2.7 5.7L21 9.6l-4.5 4.4 1.1 6.2L12 17.3l-5.6 2.9 1.1-6.2L3 9.6l6.3-.9L12 3Z"/></svg>
          Semanas com feriado
        </h4>
        <div class="goals-grid">${f('goal-hmin','Mínimo semanal',cur.holidayMin)}${f('goal-havg','Média semanal necessária',cur.holidayAvg)}</div>
        <p class="goals-hint">Usadas nas semanas marcadas como feriado em Período.</p>
      </section>
      <p class="goals-err" id="goals-err" role="alert" hidden></p>
      <div class="goals-foot">
        ${!adding && periodCargoHasGoal(key, cycle) ? '<button type="button" class="goals-remove" id="goals-remove" title="Remover metas específicas" aria-label="Remover metas específicas"><svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4h8v2m3 0-1 14H6L5 6m5 4v7m4-7v7"/></svg></button>' : ''}
        <button type="button" class="btn-outline" onclick="closeGoalsModal()">Cancelar</button>
        <button type="button" class="btn-solid" id="goals-save">${adding ? 'Adicionar metas' : 'Salvar metas'}</button>
      </div>
    </div>`;

  // Reaproveita integralmente as rotinas de validação, salvamento e remoção.
  bd.querySelector('#goals-save').addEventListener('click', () => saveGoalsModal(key));
  bd.querySelector('#goals-remove')?.addEventListener('click', () => removeGoalsModal(key));
  bd.addEventListener('click', e => { if (e.target === bd) closeGoalsModal(); });
  bd.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      closeGoalsModal();
      return;
    }
    if (e.key !== 'Tab') return;
    const focusable = Array.from(bd.querySelectorAll('button:not(:disabled), input:not(:disabled)'));
    if (!focusable.length) return;
    if (e.shiftKey && document.activeElement === focusable[0]) {
      e.preventDefault();
      focusable[focusable.length - 1].focus();
    } else if (!e.shiftKey && document.activeElement === focusable[focusable.length - 1]) {
      e.preventDefault();
      focusable[0].focus();
    }
  });
  document.body.appendChild(bd);
  // Não apaga o valor de um campo só porque o modal foi aberto.
  bd.querySelector('.goals-x').focus({ preventScroll: true });
}
function closeGoalsModal() {
  const bd = document.getElementById('goals-modal');
  if (!bd) return;
  const opener = bd._opener;
  bd.remove();
  if (opener?.isConnected) opener.focus({ preventScroll: true });
}
async function removeGoalsModal(key) {
  if (!canManageGoals()) return;
  const confirmOverlay = document.getElementById('app-confirm-overlay');
  if (confirmOverlay) confirmOverlay.classList.add('goals-confirm-top');
  let approved = false;
  try {
    approved = await appConfirm({ title: 'Remover metas específicas', message: 'Deseja remover as metas deste cargo/projeto?', note: 'Os registros de atividades e as metas gerais do período serão preservados.', confirmText: 'Remover metas', danger: true });
  } finally {
    if (confirmOverlay) confirmOverlay.classList.remove('goals-confirm-top');
  }
  if (!approved) return;
  const btn = document.getElementById('goals-remove');
  const err = document.getElementById('goals-err');
  if (btn) btn.disabled = true;
  try {
    await api('deleteGoals', { code: session.teamCode, cargo: key });
    await refreshTeamData();
    closeGoalsModal(); renderAnalysis(); goalsToast('Metas específicas removidas.');
  } catch (e) { if (btn) btn.disabled = false; if (err) { err.textContent = e.message || 'Não foi possível remover.'; err.hidden = false; } }
}
async function saveGoalsModal(key) {
  const btn = document.getElementById('goals-save'), err = document.getElementById('goals-err');
  const v = id => parseDurationInput(document.getElementById(id).value);
  const g = { normalMin: v('goal-nmin'), normalAvg: v('goal-navg'), holidayMin: v('goal-hmin'), holidayAvg: v('goal-havg') };
  const fail = m => { err.textContent = m; err.hidden = false; };
  if (Object.values(g).some(x => x === null)) return fail('Informe durações válidas (ex.: 16:40, 20:00 ou 2000).');
  if (g.normalAvg <= 0 || g.holidayAvg <= 0) return fail('A média semanal precisa ser maior que zero.');
  if (g.normalMin > g.normalAvg || g.holidayMin > g.holidayAvg) return fail('O mínimo não pode ser maior que a média.');
  err.hidden = true; btn.disabled = true;
  try {
    await api('saveGoals', Object.assign({ code: session.teamCode, cargo: key }, g));
    await refreshTeamData();
    closeGoalsModal(); renderAnalysis(); goalsToast('Metas atualizadas.');
  } catch (e) { btn.disabled = false; fail(e.message || 'Não foi possível salvar.'); }
}

function renderAnalysisPeriod() {
  const content = document.getElementById('analysis-period-content');
  const label = document.getElementById('analysis-period-cycle-label');
  const note = document.getElementById('analysis-period-note');
  if (!content || !label) return;

  const cycles = DB.getCycles().filter(c => c.teamCode === session.teamCode).slice().sort((a, b) => String(b.startDate).localeCompare(String(a.startDate)));
  if (!cycles.length) {
    label.textContent = 'Sem períodos';
    if (note) note.textContent = '';
    content.innerHTML = '<div class="reports-empty">Nenhum período cadastrado. Um administrador pode criar um na aba Período.</div>';
    return;
  }
  const todayStr = localDateStr(new Date());
  let cycle = cycles.find(c => c.id === analysisPeriodCycleId);
  if (!cycle) cycle = cycles.find(c => todayStr >= c.startDate && todayStr <= c.endDate) || cycles.find(c => c.startDate <= todayStr) || cycles[0];
  analysisPeriodCycleId = cycle.id;
  label.textContent = `${fmtBR(cycle.startDate)} – ${fmtBR(cycle.endDate)}`;
  const ci = cycles.findIndex(c => c.id === cycle.id);
  const wrap = document.getElementById('analysis-period-cycle-wrap');
  if (wrap) { const b = wrap.querySelectorAll('button'); b[0].disabled = ci >= cycles.length - 1; b[1].disabled = ci <= 0; }

  if (cycle.unit !== 'weeks') {
    if (note) note.textContent = '';
    content.innerHTML = '<div class="reports-empty">Esta página funciona para períodos com metas semanais.</div>';
    return;
  }

  const weeks = getCycleWeeklyPeriods(cycle);
  const todayWeek = weekStartOfDate(todayStr);
  const weeksRemaining = weeks.filter(w => w.weekStart >= todayWeek).length; // contando a semana atual
  // Regras da planilha:
  //  - filtrado por Projetos: mínimo 1h; média 4h10 (250 min) menos 50 min por feriado na semana;
  //  - todos os cargos/projetos: usa a média e o mínimo do próprio período (ex.: 20h/16h40, 16h40/13h20 com feriado).
  const onlyProjects = String(document.getElementById('analysis-cargo')?.value || '').trim().toLocaleLowerCase('pt-BR') === 'projetos';
  const goalKey = analysisGoalKey();
  const rawGoalCfg = goalKey ? resolveGoalConfig(cycle, goalKey) : null;
  const goalCfg = rawGoalCfg && !rawGoalCfg.disabled ? rawGoalCfg : null;
  weeks.forEach(w => {
    const hol = (Array.isArray(cycle.holidayWeeks) ? cycle.holidayWeeks : []).filter(x => x.weekStart === w.weekStart).length;
    const isHol = Math.max(hol, w.holidayDate ? 1 : 0) > 0;
    if (goalCfg) {
      w.sheetMin = isHol ? goalCfg.holidayMin : goalCfg.normalMin;
      w.sheetAvg = isHol ? goalCfg.holidayAvg : goalCfg.normalAvg;
    } else if (onlyProjects) {
      w.sheetMin = 60;
      w.sheetAvg = Math.max(0, 250 - 50 * (isHol ? 1 : 0));
    } else {
      w.sheetMin = w.minimumMinutes;
      w.sheetAvg = w.goalMinutes;
    }
  });
  const goalTotalMs = weeks.reduce((sum, w) => sum + w.sheetAvg * 60000, 0);

  const cargoFilter = document.getElementById('analysis-cargo')?.value || '';
  const showGoal = periodCargoHasGoal(cargoFilter, cycle);

  const team = DB.getTeams()[session.teamCode];
  const idleOwner = !!team && team.adminParticipatesInCycle === false ? team.admin : null;

  const cycleEntries = DB.getEntries().filter(e => e.teamCode === session.teamCode && e.date && e.date >= cycle.startDate && e.date <= cycle.endDate);
  const entries = applyAnalysisFilters(cycleEntries);

  const members = analysisScopeMembers().slice().sort((a, b) => String(a).localeCompare(String(b), 'pt-BR'));
  const byUser = {};
  members.forEach(u => { byUser[u] = weeks.map(() => 0); });
  const weekIndex = {};
  weeks.forEach((w, i) => { weekIndex[w.weekStart] = i; });
  const effective = effectiveWorkDurations(entries);
  entries.forEach(e => {
    if (!byUser[e.user]) return;
    const i = weekIndex[weekStartOfDate(e.date)];
    if (i === undefined) return;
    byUser[e.user][i] += effective.get(e) || 0;
  });

  if (note) note.textContent = '';

  const head = weeks.map((w, i) => `<th>Semana ${i + 1}<small>${reportDateLabel(new Date(w.weekStart + 'T12:00:00'))}</small></th>`).join('');
  const goalHead = showGoal ? '<th class="goal-col">Total período</th><th class="goal-col">Faltante</th><th class="goal-col">Média para bater</th>' : '';

  const rows = members.map(u => {
    const cells = byUser[u];
    const total = cells.reduce((a, b) => a + b, 0);
    const weekCells = weeks.map((w, i) => w.weekStart > todayStr
      ? `<td class="is-future"></td>`
      : `<td class="">${fmtClock(cells[i])}${(u !== idleOwner && showGoal && w.weekEnd < todayStr && cells[i] < w.sheetMin * 60000) ? '<span class="min-flag" title="Abaixo do mínimo semanal">*</span>' : ''}</td>`).join('');
    let goalCells = '';
    if (showGoal) {
      if (u === idleOwner) {
        goalCells = '<td colspan="3" class="is-future" title="Apenas administrador">não participa</td>';
      } else {
        const missing = Math.max(0, goalTotalMs - total);
        const avg = weeksRemaining > 0 ? missing / weeksRemaining : 0;
        const done = missing <= 30000;
        goalCells = `<td>${fmtClock(goalTotalMs)}</td><td class="${done ? 'is-done' : ''}">${fmtClock(missing)}</td><td class="${done ? 'is-done' : ''}">${weeksRemaining > 0 || done ? fmtClock(avg) : '—'}</td>`;
      }
    }
    return `<tr><td class="member-col">${escapeHtml(u)}</td>${weekCells}<td class="total-col">${fmtClock(total)}</td>${goalCells}</tr>`;
  }).join('');

  const foot = showGoal ? `<tfoot>
      <tr><td class="foot-label">Mínimo</td>${weeks.map(w => `<td>${fmtClock(w.sheetMin * 60000)}</td>`).join('')}<td class="foot-empty" colspan="4"></td></tr>
      <tr><td class="foot-label">Média</td>${weeks.map(w => `<td>${fmtClock(w.sheetAvg * 60000)}</td>`).join('')}<td class="foot-empty" colspan="4"></td></tr>
    </tfoot>` : '';

  // Um cargo/projeto específico recebe apenas uma ação: configurar OU adicionar.
  // Em "Todos os cargos/projetos", em períodos passados ou sem período ativo, não há botões.
  const canConfigureCargo = !!goalKey && canManageGoals() && !!editableAnalysisGoalCycle();
  const goalAction = !canConfigureCargo ? '' : showGoal
    ? `<div class="goals-add-row">${goalGearButton()}</div>`
    : `<div class="goals-add-row"><button type="button" class="goals-add-btn" onclick="openAddGoalsModal()" title="Adicionar metas para este cargo/projeto"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg> Adicionar metas</button></div>`;
  content.innerHTML = members.length
    ? `<div class="period-sheet-wrap"><table class="period-sheet"><thead><tr><th>Membro</th>${head}<th class="goal-col">Total</th>${goalHead}</tr></thead><tbody>${rows}</tbody>${foot}</table></div>
         ${(goalAction || rows.includes('class="min-flag"')) ? `<div class="period-legend-row">${goalAction}${rows.includes('class="min-flag"') ? '<div class="period-legend"><span><span class="lg-star">*</span>Abaixo do mínimo semanal</span></div>' : ''}</div>` : ''}`
    : '<div class="reports-empty">Sem membros neste filtro.</div>';
}
