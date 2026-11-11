/**
 * Hub de equipes: criar, entrar por código e abrir uma equipe.
 */

// ---------- HUB ----------
function renderHub() {
  syncMasterUi();
  const displayName = session.name || session.username;

  const nameDisplay = document.getElementById('hub-user-name');
  if (nameDisplay) nameDisplay.textContent = escapeHtml(displayName);

  document.getElementById('hub-list-view').hidden = false;
  document.querySelector('#hub-screen .card-modal').classList.remove('team-create-mode');
  document.getElementById('form-hub-create').hidden = true;
  document.getElementById('form-hub-join').hidden = true;

  const listEl = document.getElementById('hub-team-list');
  const teamsSection = document.getElementById('hub-existing-teams-section');
  const myTeams = CACHE.myTeams || [];

  if (myTeams.length > 0) {
    listEl.innerHTML = myTeams.map(t => {
      const roleBadge = t.isOwner
        ? `<span class="badge-role badge-role-admin">Criador</span>`
        : t.isAdmin ? `<span class="badge-role badge-role-admin">Admin</span>`
        : `<span class="badge-role badge-role-member">Membro</span>`;
      return `
          <div class="team-card-wrap">
            <button class="team-card-btn" onclick="enterTeam('${t.code}', this)">
              <div class="team-card-title">${escapeHtml(t.name)}</div>
              <div class="team-card-sub">Código: ${t.code}</div>
              ${roleBadge}
              <span class="team-card-chevron" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="m9 18 6-6-6-6"></path></svg></span>
            </button>
          </div>
        `;
    }).join('');
    teamsSection.hidden = false;
  } else {
    listEl.innerHTML = '';
    teamsSection.hidden = true;
  }
}

function showHubForm(type) {
  document.getElementById('hub-list-view').hidden = type === 'create';
  document.querySelector('#hub-screen .card-modal').classList.toggle('team-create-mode', type === 'create');
  document.getElementById('create-team-error').hidden = true;
  if (type === 'create') requestAnimationFrame(() => document.getElementById('new-team-name').focus());
  document.getElementById('form-hub-create').hidden = (type !== 'create');
  document.getElementById('form-hub-join').hidden = (type !== 'join');
}

function cancelCreateTeam() {
  if (isActionPending('create-team')) return;
  document.getElementById('new-team-name').value = '';
  showHubForm(null);
}
function showCreateTeamError(message) {
  const error = document.getElementById('create-team-error');
  error.textContent = message; error.hidden = false;
}
async function handleCreateTeam(e) {
  e.preventDefault();
  if (isActionPending('create-team')) return;
  const btn = actionButton(e);
  const name = document.getElementById('new-team-name').value.trim();
  if (!name) return showCreateTeamError('Dê um nome para a equipe.');
  if ((CACHE.myTeams || []).length >= 3) return showCreateTeamError('Você já participa de 3 equipes, que é o limite por pessoa.');
  document.getElementById('create-team-error').hidden = true;
  return runOnce('create-team', btn, 'Criando...', async () => {
    try {
      const created = await api('createTeam', { name });
      const meData = await api('me');
      CACHE.myTeams = meData.teams || [];
      await enterTeam(created.team.code);
    } catch (err) { showCreateTeamError(err.message); }
  });
}

async function handleJoinTeam(e) {
  e.preventDefault();
  if (isActionPending('join-team')) return;
  const btn = actionButton(e);
  const code = document.getElementById('join-team-code').value.trim().toUpperCase();
  if (!code) return alert('Informe o código de convite.');
  const alreadyIn = (CACHE.myTeams || []).some(t => t.code === code);
  if (!alreadyIn && (CACHE.myTeams || []).length >= 3) return alert('Você já participa de 3 equipes, que é o limite por pessoa.');
  return runOnce('join-team', btn, 'Entrando...', async () => {
    try {
      await api('joinTeam', { code });
      const d = await api('me');
      CACHE.myTeams = d.teams || [];
      await enterTeam(code);
    } catch (err) { alert(err.message); }
  });
}

const enteringTeams = new Set();
async function enterTeam(code, button = null) {
  if (enteringTeams.has(code)) return;
  enteringTeams.add(code);
  const disabledByUs = !!button && !button.disabled;
  if (button) button.disabled = true;
  let succeeded = false;
  const releaseEntry = () => {
    enteringTeams.delete(code);
    if (disabledByUs) button.disabled = false;
  };
  showPetimerLoading('Carregando equipe...');
  try {
    if (session.teamCode && session.teamCode !== code) { if (DB.getRunning()) await stopTimer(); }
    session.teamCode = code;
    localStorage.setItem('petimer_last_team', code);
    try {
      await refreshTeamData();
    } catch (err) {
      alert(err.message);
      session.teamCode = null;
      showScreen('hub-screen'); renderHub();
      return;
    }
    showScreen('main-app');
    setupApp();
    startPolling();
    succeeded = true;
  } finally {
    hidePetimerLoading();
    if (succeeded) setTimeout(releaseEntry, 3000);
    else releaseEntry();
  }
}
