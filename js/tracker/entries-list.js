/**
 * Lista de registros do dia: renderização, edição e exclusão.
 */

function renderEntries() {
  const readOnly = syncTrackerObserver();
  const entryUser = readOnly ? trackerObservedUser : session.username;
  const el = document.getElementById('entries-list');
  const all = DB.getEntries().filter(e => e.teamCode === session.teamCode && e.user === entryUser);
  const run = readOnly ? null : DB.getRunning();
  let list = [...all];
  const users = DB.getUsers();

  if (run && run.teamCode === session.teamCode) {
    list.push({ ...run, endTime: '--:--', duration: Date.now() - new Date(run.start).getTime(), isRunning: true });
  }

  if (!list.length) return el.innerHTML = readOnly ? '<div class="observer-empty"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="3" width="16" height="18" rx="3"/><path d="M8 8h8M8 12h8M8 16h5"/></svg><strong>Nenhum registro encontrado</strong><p>Quando este membro registrar atividades, elas aparecerão aqui.</p></div>' : '<div class="empty">Nenhum registro ainda.</div>';

  const grouped = {};
  list.forEach(item => {
    const d = item.date || item.start.split('T')[0];
    if (!grouped[d]) grouped[d] = [];
    grouped[d].push(item);
  });

  // Trechos de uma atividade que passou da meia-noite (termina 23:59 num dia e recomeça 00:00 no seguinte).
  const contNext = new Set(), contPrev = new Set();
  all.forEach(a => {
    if (a.endTime !== '23:59' || !a.date) return;
    const nd = new Date(a.date + 'T12:00:00'); nd.setDate(nd.getDate() + 1);
    const nextKey = localDateStr(nd);
    const b = all.find(x => x.date === nextKey && x.startTime === '00:00' && (x.activity || '') === (a.activity || '') && x.cargo === a.cargo && x.modalidade === a.modalidade);
    if (b) { contNext.add(a); contPrev.add(b); }
  });

  const sortedDates = Object.keys(grouped).sort((a, b) => new Date(b) - new Date(a));
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const currentWeekStart = new Date(today);
  const dayNum = (today.getDay() + 6) % 7; // segunda = 0
  currentWeekStart.setDate(today.getDate() - dayNum);
  const isoKey = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  const currentWeekKey = isoKey(currentWeekStart);
  const previousWeekStart = new Date(currentWeekStart);
  previousWeekStart.setDate(currentWeekStart.getDate() - 7);
  const previousWeekKey = isoKey(previousWeekStart);

  // Chave da semana (segunda-feira) à qual a data pertence; semanas futuras têm a própria seção.
  function weekKeyOf(dateStr){
    const d = new Date(dateStr + 'T12:00:00');
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    return isoKey(d);
  }

  // "14 set - 20 set" (com o ano quando a semana cruza anos diferentes do atual).
  function weekRangeLabel(key){
    const start = new Date(key + 'T12:00:00');
    const end = new Date(start); end.setDate(start.getDate() + 6);
    const fmt = (d, withYear) => d.toLocaleDateString('pt-BR', { day:'2-digit', month:'short' }).replace('.', '') + (withYear ? ' ' + d.getFullYear() : '');
    const withYear = start.getFullYear() !== now.getFullYear() || end.getFullYear() !== now.getFullYear();
    return `${fmt(start, withYear)} - ${fmt(end, withYear)}`;
  }

  function sectionLabel(key){
    if (key === currentWeekKey) return 'Esta semana';
    if (key === previousWeekKey) return 'Semana passada';
    return weekRangeLabel(key);
  }

  const sections = {};
  sortedDates.forEach(date => {
    const k = weekKeyOf(date);
    (sections[k] = sections[k] || []).push(date);
  });

  let html = '';
  Object.keys(sections).sort().reverse().forEach(bucket => {
    const dates = sections[bucket];
    if (!dates.length) return;
    const weekTotal = uniqueWorkMs(dates.flatMap(date => grouped[date]));
    html += `<div class="entries-week-section">`;
    html += `<div class="entries-week-title"><span>${sectionLabel(bucket)}</span><span class="entries-week-total">Total da semana: <strong>${fmtDur(weekTotal, true)}</strong></span></div>`;

    dates.forEach(date => {
      const dateObj = new Date(date + 'T12:00:00');
      const todayKey = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
      const yesterdayObj = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
      const yesterdayKey = `${yesterdayObj.getFullYear()}-${String(yesterdayObj.getMonth()+1).padStart(2,'0')}-${String(yesterdayObj.getDate()).padStart(2,'0')}`;
      const dateLabel = dateObj.toLocaleDateString('pt-BR', { day:'2-digit', month:'short' }).replace('.', '');
      let dateStr;
      if (date === todayKey) dateStr = `HOJE, ${dateLabel}`;
      else if (date === yesterdayKey) dateStr = `ONTEM, ${dateLabel}`;
      else {
        const weekday = dateObj.toLocaleDateString('pt-BR', { weekday:'short' }).replace('.', '');
        dateStr = `${weekday.toUpperCase()}, ${dateLabel}`;
      }
      const dayTotal = uniqueWorkMs(grouped[date]);
      html += `<div class="day-group"><div class="day-group-header"><span>${readOnly ? escapeHtml(dateObj.toLocaleDateString('pt-BR', {weekday:'long',day:'numeric',month:'long',year:'numeric'})) : dateStr.toUpperCase()}</span><span class="day-group-total">${readOnly ? 'Total do dia:' : 'Total:'} <strong>${fmtDur(dayTotal, true)}</strong></span></div>`;

      grouped[date].sort((a, b) => {
        if(a.isRunning) return -1; if(b.isRunning) return 1;
        return (b.startTime || '').localeCompare(a.startTime || '');
      });

      grouped[date].forEach(e => {
        // Mantém o timer nos totais existentes, mas só exibe linhas finalizadas.
        if (e.isRunning) return;
        const uObj = users[e.user];
        const uName = uObj ? (uObj.name || uObj.username || e.user) : e.user;
        if (readOnly) {
          const color = getCargoColor(e.cargo, e.cargoColor);
          html += '<div class="observer-entry"><span class="observer-time">' + escapeHtml(e.startTime || '00:00') + ' – ' + escapeHtml(e.endTime || '00:00') + '</span><span class="observer-dot" style="background:' + escapeHtml(color) + '"></span><span class="observer-description">' + escapeHtml(e.activity || 'Sem descrição') + '</span><span class="observer-cargo" style="color:' + escapeHtml(color) + ';border-color:' + escapeHtml(color) + '">' + escapeHtml(e.cargo || 'Sem cargo') + '</span><span class="observer-location"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/></svg>' + escapeHtml(e.modalidade || 'Sem localização') + '</span><span class="observer-duration">' + fmtDur(e.duration, true) + '</span></div>';
          return;
        }


        html += `
            <div class="row-item-edit">
              <div class="entry-primary">
                <div class="activity-cell">
                  <input type="text" class="edit-input activity-edit-input" style="font-weight:500;--activity-width:${Math.max(14, Math.min(72, String((e.activity && e.activity !== 'Sem descrição') ? e.activity : '').length + 2))}ch;" value="${escapeHtml((e.activity && e.activity !== 'Sem descrição') ? e.activity : '')}" placeholder="Sem descrição" oninput="this.style.setProperty('--activity-width', Math.max(14, Math.min(72, this.value.length + 2)) + 'ch')" onchange="updateEntry('${e.id}', 'activity', this.value.trim())" ${readOnly || e.isRunning ? 'disabled' : ''}>${contPrev.has(e) ? '<span class="entry-cont-tag" title="Esta atividade começou no dia anterior">Continuação do dia anterior</span>' : ''}${contNext.has(e) ? '<span class="entry-cont-tag" title="Esta atividade continua no dia seguinte">Continua no dia seguinte</span>' : ''}
                </div>
              </div>

              <div class="entry-right-cluster">
                <div class="entry-select-wrap entry-cargo-wrap">
                  <span class="line-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M9 18h6"></path><path d="M10 22h4"></path><path d="M8.5 15.5h7"></path><path d="M9 15.5c-.2-1.4-.8-2.2-1.7-3.1A5.9 5.9 0 1 1 16.7 12.4c-.9.9-1.5 1.7-1.7 3.1"></path></svg></span>
                  <select class="edit-select" style="color:${getCargoColor(e.cargo, e.cargoColor)};font-weight:600;" onchange="updateEntry('${e.id}', 'cargo', this.value)" ${readOnly || e.isRunning ? 'disabled' : ''}>
                    ${cargoOptionsHTML(e.cargo, false)}
                    ${!getCargoOptions().some(c=>c.name===e.cargo) ? `<option value="${escapeHtml(e.cargo)}" selected>${escapeHtml(e.cargo)}</option>` : ''}
                  </select>
                </div>

                <div class="entry-select-wrap entry-select-modalidade">
                <span class="line-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z"></path><circle cx="12" cy="10" r="2.5"></circle></svg></span>
                <select class="edit-select" style="font-size:11px;" onchange="updateEntry('${e.id}', 'modalidade', this.value)" ${readOnly || e.isRunning ? 'disabled' : ''}>
                  ${modalidadeOptionsHTML(e.modalidade, false)}
                  ${e.modalidade && !getModalidadeOptions().includes(e.modalidade) ? `<option value="${escapeHtml(e.modalidade)}" selected>${escapeHtml(e.modalidade)}</option>` : ''}
                </select>
              </div>

              <div class="entry-times">
                <input type="text" class="edit-input time-field" inputmode="numeric" maxlength="4" autocomplete="off" value="${e.startTime || '00:00'}" aria-label="Hora de início" onfocus="beginClockEdit(this)" oninput="sanitizeTimeTyping(this)" onblur="finishEntryClockEdit(this,'${e.id}','startTime')" onkeydown="handleEntryClockKey(event,this,'${e.id}','startTime')" ${readOnly || e.isRunning ? 'disabled' : ''}>
                <span class="time-separator">-</span>
                <input type="text" class="edit-input time-field" inputmode="numeric" maxlength="4" autocomplete="off" value="${e.endTime || '00:00'}" aria-label="Hora de término" onfocus="beginClockEdit(this)" oninput="sanitizeTimeTyping(this)" onblur="finishEntryClockEdit(this,'${e.id}','endTime')" onkeydown="handleEntryClockKey(event,this,'${e.id}','endTime')" ${readOnly || e.isRunning ? 'disabled' : ''}>
                ${e.isRunning ? '' : `<label class="entry-date-edit" title="Alterar data do registro" aria-label="Alterar data do registro">
                  <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"></rect><path d="M7 3v4M17 3v4M3 10h18"></path></svg>
                  <input type="date" ${readOnly ? 'disabled' : ''} value="${e.date || ''}" onchange="updateEntry('${e.id}', 'date', this.value)" aria-label="Data do registro">
                </label>`}
              </div>

              <span class="text-mono entry-duration-total" style="font-size:13px; min-width:80px; text-align:right; font-weight:400; font-family:inherit; font-variant-numeric:tabular-nums">
                ${e.isRunning ? 'agora...' : fmtDur(e.duration, true)}
              </span>

                <div class="entry-actions">
                  ${readOnly || e.isRunning ? '' : `<button class="entry-delete" onclick="deleteEntry('${e.id}', this)" title="Apagar horário" aria-label="Apagar horário">
                    <svg viewBox="0 0 24 24"><path d="M4 7h16"></path><path d="M10 11v6"></path><path d="M14 11v6"></path><path d="M9 7V4h6v3"></path><path d="M6 7l1 14h10l1-14"></path></svg>
                  </button>`}
                </div>
              </div>
            </div>`;
      });
      html += `</div>`;
    });
    html += `</div>`;
  });

  el.innerHTML = html;
}

async function deleteEntry(id, btn, confirmed = false) {
  if (isTrackerObserver()) return;
  const ownedEntry = DB.getEntries().find(entry => entry.id === id);
  if (!ownedEntry || ownedEntry.user !== session.username || ownedEntry.teamCode !== session.teamCode) return;
  const key = `delete-entry:${id}`;
  if (isActionPending(key)) return;
  const entries = DB.getEntries();
  const entry = entries.find(e => e.id === id);
  if (!entry) return;
  if (!confirmed) {
    openTeamActionConfirm({type:'entry', id, code:session.teamCode, actor:session.username, trigger:btn}, 'Apagar horário', 'Tem certeza que deseja apagar este horário?', 'Apagar');
    return;
  }
  if (String(id).startsWith('tmp-')) return alert('Aguarde o registro terminar de salvar e tente de novo.');
  return runOnce(key, btn, null, async () => {
  const removedIndex = entries.findIndex(e => e.id === id);
  DB.saveEntries(entries.filter(e => e.id !== id));
  refreshAppViews();
  updateSuggestions();
  writeSeq++; pendingWrites++;
  return api('deleteEntry', { entryId: id }).catch(err => {
    const list = [...DB.getEntries()];
    list.splice(Math.max(0, removedIndex), 0, entry);
    DB.saveEntries(list);
    refreshAppViews();
    alert('Erro ao excluir: ' + err.message);
  }).finally(() => { pendingWrites--; });
  });
}

async function updateEntry(id, field, value) {
  if (isTrackerObserver()) return;
  const ownedEntry = DB.getEntries().find(entry => entry.id === id);
  if (!ownedEntry || ownedEntry.user !== session.username || ownedEntry.teamCode !== session.teamCode) return;
const key = `update-entry:${id}`;
if (isActionPending(key)) return;
const entries = DB.getEntries();
const entryIndex = entries.findIndex(e => e.id === id);
if (entryIndex === -1) return;

const entry = { ...entries[entryIndex] };
entry[field] = value;
if (field === 'cargo') entry.cargoColor = getCargoColor(value);

if (field === 'startTime' || field === 'endTime') {
  if (entry.startTime && entry.endTime) {
    const s = new Date(`${entry.date}T${entry.startTime}`);
    const e = new Date(`${entry.date}T${entry.endTime}`);
    if (e < s) {
      alert('A hora de término não pode ser anterior à hora de início.');
      renderEntries();
      return;
    }
    entry.duration = e.getTime() - s.getTime();
  }
}

if (String(id).startsWith('tmp-')) { alert('Aguarde o registro terminar de salvar e tente de novo.'); renderEntries(); return; }
const previous = entries[entryIndex];
entries[entryIndex] = entry;
if (field === 'date') refreshAppViews();
else { renderEntries(); renderCycleBadge(); }
if (field === 'activity') updateSuggestions();

writeSeq++; pendingWrites++;
try {
  await api('updateEntry', {
    entryId: id, activity: entry.activity, cargo: entry.cargo, cargoColor: entry.cargoColor,
    modalidade: entry.modalidade, date: entry.date, startTime: entry.startTime,
    endTime: entry.endTime, durationMs: entry.duration
  });
} catch (err) {
  const i = DB.getEntries().findIndex(e => e.id === id);
  if (i >= 0) DB.getEntries()[i] = previous;
  refreshAppViews();
  alert('Erro ao salvar alteração: ' + err.message);
} finally { pendingWrites--; }
}
