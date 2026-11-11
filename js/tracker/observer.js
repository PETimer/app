/**
 * Modo observador: ver o registro de outros membros.
 */

// RENDER ENTRIES AGRUPADO POR DATA E COM EDIÇÃO INLINE 
let trackerObservedUser = null, trackerObservedTeam = null;
// Modo observador "fixo": o criador da equipe que NÃO participa do período só observa.
function isForcedTrackerObserver() {
  const team = DB.getTeams()[session?.teamCode];
  return !!(team && team.admin === session?.username && team.adminParticipatesInCycle === false);
}
// Modo observador ligado manualmente pelo menu do perfil (só administradores; vale só para a equipe em que foi ligado).
let trackerObserverManualTeam = null;
function isManualTrackerObserver() {
  if (trackerObserverManualTeam && trackerObserverManualTeam !== session?.teamCode) trackerObserverManualTeam = null;
  return !!trackerObserverManualTeam && isTeamAdmin();
}
function isTrackerObserver() { return isForcedTrackerObserver() || isManualTrackerObserver(); }
function toggleObserverMode() {
  closeProfileMenu();
  if (!session?.teamCode || !isTeamAdmin() || isForcedTrackerObserver()) return;
  trackerObserverManualTeam = isManualTrackerObserver() ? null : session.teamCode;
  // leva direto para os registros (a barra de registro some e aparece o seletor de pessoa)
  const trackerNav = document.querySelector('.nav-item[onclick*="\'tracker\'"]');
  switchView('tracker', trackerNav);
  renderEntries();
}
function updateObserverModeToggle() {
  const btn = document.getElementById('observer-mode-toggle');
  if (!btn) return;
  const available = isTeamAdmin() && !isForcedTrackerObserver();
  btn.hidden = !available;
  const on = available && isManualTrackerObserver();
  btn.classList.toggle('is-on', on);
  btn.setAttribute('aria-pressed', String(on));
  const label = document.getElementById('observer-mode-toggle-label');
  if (label) label.textContent = on ? 'Sair do modo observador' : 'Modo observador';
}
function filterTrackerMembers() {
  const input = document.getElementById('tracker-member-search');
  const normalize = text => String(text).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR');
  const query = normalize(input.value.trim());
  let count = 0;
  document.querySelectorAll('#tracker-member-items button').forEach(button => {
    button.hidden = !normalize(button.textContent).includes(query);
    if (!button.hidden) count++;
  });
  document.getElementById('tracker-member-clear').hidden = !input.value;
  document.getElementById('tracker-member-no-results').hidden = count !== 0;
}
function clearTrackerMemberSearch() {
  document.getElementById('tracker-member-search').value = '';
  filterTrackerMembers(); document.getElementById('tracker-member-search').focus();
}
function handleTrackerMemberSearchKey(event) {
  const input = document.getElementById('tracker-member-search');
  if (event.key === 'Escape' && input.value) { event.preventDefault(); event.stopPropagation(); clearTrackerMemberSearch(); return; }
  const items = [...document.querySelectorAll('#tracker-member-items button:not([hidden])')];
  if (event.key === 'Enter' && items.length === 1) { event.preventDefault(); items[0].click(); }
  if (event.key === 'ArrowDown' && items.length) { event.preventDefault(); items[0].focus(); }
  if (event.key === 'ArrowUp' && items.length) { event.preventDefault(); items[items.length-1].focus(); }
}
document.addEventListener('keydown', event => {
  if (!event.target.matches('#tracker-member-items button')) return;
  if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
  const items = [...document.querySelectorAll('#tracker-member-items button:not([hidden])')];
  const index = items.indexOf(event.target), step = event.key === 'ArrowDown' ? 1 : -1;
  event.preventDefault(); items[(index + step + items.length) % items.length]?.focus();
});
function closeTrackerMemberMenu() {
  document.getElementById('tracker-member-menu').hidden = true;
  document.getElementById('tracker-member-search').value = '';
  filterTrackerMembers();
  document.getElementById('tracker-member-trigger').setAttribute('aria-expanded','false');
}
function toggleTrackerMemberMenu() {
  const menu = document.getElementById('tracker-member-menu');
  menu.hidden = !menu.hidden;
  document.getElementById('tracker-member-trigger').setAttribute('aria-expanded',String(!menu.hidden));
  if (!menu.hidden) { if (matchMedia('(min-width:640px)').matches) document.getElementById('tracker-member-search').focus(); }
  else { document.getElementById('tracker-member-search').value = ''; filterTrackerMembers(); }
}
function navigateTrackerMember(direction) {
  const team = DB.getTeams()[session?.teamCode];
  if (!isTrackerObserver() || !team) return;
  const members = Object.keys(team.members || {}).filter(u => u !== session.username);
  if (members.length <= 1) return;
  const current = members.indexOf(trackerObservedUser);
  const index = current < 0 ? 0 : (current + direction + members.length) % members.length;
  trackerObservedUser = members[index];
  closeTrackerMemberMenu(); renderEntries(); renderCycleBadge();
}
function selectTrackerMember(user) {
  const team = DB.getTeams()[session?.teamCode];
  if (!isTrackerObserver() || user === session.username || !team.members[user]) return;
  trackerObservedUser = user; closeTrackerMemberMenu(); renderEntries(); renderCycleBadge();
  document.getElementById('tracker-member-trigger').focus();
}
function syncTrackerObserver() {
  const observer = isTrackerObserver(), team = DB.getTeams()[session?.teamCode];
  const controls = document.getElementById('tracker-observer-controls');
  controls.hidden = !observer || currentView !== 'tracker';
  updateObserverModeToggle();
  if (trackerObservedTeam !== session?.teamCode) { trackerObservedUser = null; trackerObservedTeam = session?.teamCode; closeTrackerMemberMenu(); }
  const members = observer ? Object.keys(team.members || {}).filter(u => u !== session.username) : [];
  if (!members.includes(trackerObservedUser)) trackerObservedUser = members[0] || null;
  const users = DB.getUsers();
  const observedName = users[trackerObservedUser]?.name || trackerObservedUser || '';
  document.getElementById('tracker-member-trigger').innerHTML = trackerObservedUser ? '<span class="tracker-member-avatar">' + escapeHtml(observedName.slice(0,2).toUpperCase()) + '</span><span class="tracker-member-label"><span class="tracker-viewing-label">Visualizando:</span><span class="tracker-selected-name">' + escapeHtml(observedName) + '</span></span><span class="tracker-member-chevron" aria-hidden="true">▼</span>' : 'Nenhum membro disponível';
  document.getElementById('tracker-member-trigger').title = observedName;
  document.getElementById('tracker-member-trigger').disabled = !members.length;
  const memberNav = document.getElementById('tracker-member-nav');
  if (memberNav) {
    const navOff = members.length <= 1;
    memberNav.classList.toggle('inactive', navOff);
    memberNav.querySelectorAll('button').forEach(b => { b.disabled = navOff; b.setAttribute('aria-hidden', String(navOff)); });
  }
  document.getElementById('tracker-member-items').innerHTML = members.map(u => {
    const name = users[u]?.name || u;
    return '<button type="button" data-user="' + escapeHtml(u) + '"><span class="tracker-member-avatar">' + escapeHtml(name.slice(0,2).toUpperCase()) + '</span><span class="tracker-member-name">' + escapeHtml(name) + '<small>@' + escapeHtml(u) + '</small></span></button>';
  }).join('');
  document.querySelectorAll('#tracker-member-items button').forEach(button => { button.onclick = () => selectTrackerMember(button.dataset.user); button.classList.toggle('selected',button.dataset.user === trackerObservedUser); });
  filterTrackerMembers();
  document.getElementById('view-tracker').classList.toggle('observer-mode',observer);
  document.querySelectorAll('#view-tracker .tracker-bar input,#view-tracker .tracker-bar select,#view-tracker .tracker-bar button').forEach(input => {
    if (observer) { if (!input.hasAttribute('data-observer-disabled')) input.dataset.observerDisabled = String(input.disabled); input.disabled = true; }
    else if (input.hasAttribute('data-observer-disabled')) { input.disabled = input.dataset.observerDisabled === 'true'; delete input.dataset.observerDisabled; }
  });
  if (observer) { closeCargoPicker(); closeModalidadePicker(); document.getElementById('activity-suggestions').hidden = true; }
  return observer;
}
document.addEventListener('click', event => { if (!event.target.closest('#tracker-observer-controls')) closeTrackerMemberMenu(); });
document.addEventListener('keydown', event => { if (event.key === 'Escape' && !document.getElementById('tracker-member-menu').hidden) { closeTrackerMemberMenu(); document.getElementById('tracker-member-trigger').focus(); } });
