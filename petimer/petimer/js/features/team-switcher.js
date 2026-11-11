/**
 * Troca rápida entre equipes.
 */

function openTeamSwitcher() {
  closeProfileMenu();
  renderTeamSwitcher();
  document.getElementById('team-switcher-overlay').hidden = false;
}
function closeTeamSwitcher() { document.getElementById('team-switcher-overlay').hidden = true; }
function renderTeamSwitcher() {
  const list = document.getElementById('team-switcher-list');
  if (!list) return;
  const mine = CACHE.myTeams || [];
  if (!mine.length) {
    list.innerHTML = '<div style="padding:10px 2px;color:#8a909e;font-size:12px;">Nenhuma equipe disponível.</div>';
    return;
  }
  list.innerHTML = mine.map(team => {
    const current = team.code === session.teamCode;
    return `<button type="button" class="switch-team-item ${current ? 'current' : ''}" onclick="switchTeamInline('${team.code}')">
        <span class="switch-team-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M16 20v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2"></path><circle cx="9.5" cy="7.5" r="3.5"></circle><path d="M21 20v-2a4 4 0 0 0-3-3.85"></path><path d="M15.5 4.15a3.5 3.5 0 0 1 0 6.7"></path></svg></span>
        <span class="switch-team-info"><span class="switch-team-name">${escapeHtml(team.name)}</span><span class="switch-team-meta">Código: ${escapeHtml(team.code)} <span class="switch-team-role ${team.isAdmin ? 'admin' : ''}">${team.isOwner ? 'Criador' : team.isAdmin ? 'Admin' : 'Membro'}</span></span></span>
        ${current ? '<span class="switch-team-check" title="Equipe atual"><svg viewBox="0 0 24 24"><path d="m6 12 4 4 8-8"></path></svg></span>' : '<svg class="switch-team-chevron" viewBox="0 0 24 24"><path d="m9 18 6-6-6-6"></path></svg>'}
      </button>`;
  }).join('');
}
async function switchTeamInline(code) {
  if (!code || code === session.teamCode) { closeTeamSwitcher(); return; }
  if (!(CACHE.myTeams || []).some(t => t.code === code)) return alert('Você não faz parte desta equipe.');
  showPetimerLoading('Carregando equipe...');
  try {
    const running = DB.getRunning();
    if (running && running.user === session.username && running.teamCode === session.teamCode) await stopTimer();
    session.teamCode = code;
    localStorage.setItem('petimer_last_team', code);
    closeTeamSwitcher();
    try { await refreshTeamData(); } catch (err) { alert(err.message); }
    setupApp();
    startPolling();
  } finally {
    hidePetimerLoading();
  }
}
document.addEventListener('click', function(e) {
  const menu = document.getElementById('sidebar-profile-menu');
  const trigger = document.getElementById('sidebar-profile-trigger');
  if (menu && !menu.hidden && !menu.contains(e.target) && e.target !== trigger) closeProfileMenu();
});
