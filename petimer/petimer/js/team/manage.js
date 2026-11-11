/**
 * Tela de gerenciar equipes: renomear, excluir, sair e adicionar membro.
 */

// ---------- GERENCIAR EQUIPES (tela de equipes) ----------
let manageTeamCode = null;
let leaveTeamTargetCode = null;
function openManageTeams() {
  renderManagePicker();
  document.getElementById('manage-team-overlay').hidden = false;
}
function renderManagePicker() {
  // O gerenciamento se limita à equipe atualmente aberta.
  selectManageTeam(session?.teamCode);
}
function selectManageTeam(code) {
  if (!code || code !== session?.teamCode) return;
  const t = (CACHE.myTeams || []).find(x => x.code === code);
  if (!t) return;
  manageTeamCode = code;
  const currentTeam = DB.getTeams()[code];
  const name = currentTeam?.name || t.name;
  document.getElementById('manage-team-invite-code').textContent = code;
  document.getElementById('manage-team-copy-status').textContent = '';
  document.getElementById('manage-team-copy-btn').textContent = 'Copiar';
  document.getElementById('manage-team-admin').hidden = !t.isAdmin;
  document.getElementById('manage-team-owner-controls').hidden = !t.isOwner;
  document.getElementById('manage-team-admin-leave').hidden = !!t.isOwner;
  document.getElementById('manage-team-member').hidden = !!t.isAdmin;
  document.getElementById('manage-team-name').disabled = !t.isOwner;
  document.getElementById('manage-team-name').value = name;
  document.getElementById('manage-team-detail').hidden = false;
  document.getElementById('manage-team-title').textContent = 'Gerenciar equipe - ' + name;
  if (t.isOwner) setTimeout(() => document.getElementById('manage-team-name').focus(), 30);
}
async function copyManagedTeamCode(btn) {
  const code = manageTeamCode;
  if (!code || code !== session?.teamCode) return;
  const status = document.getElementById('manage-team-copy-status');
  return runOnce('copy-team-code', btn, null, async () => {
    try {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(code);
      else {
        const field = document.createElement('textarea');
        field.value = code;
        field.style.cssText = 'position:fixed;left:-9999px;top:0;';
        document.getElementById('manage-team-overlay').appendChild(field);
        try {
          field.select();
          if (!document.execCommand('copy')) throw new Error('Cópia indisponível');
        } finally { field.remove(); btn.focus(); }
      }
      if (manageTeamCode === code) { btn.textContent = 'Copiado'; status.textContent = 'Código copiado.'; }
    } catch (err) {
      if (manageTeamCode === code) status.textContent = 'Não foi possível copiar. Selecione o código e copie manualmente.';
    }
  });
}
function closeManageTeam() {
  if (isActionPending('rename-team')) return;
  document.getElementById('manage-team-overlay').hidden = true;
  manageTeamCode = null;
}
async function saveTeamName(btn) {
  const code = manageTeamCode;
  const t = (CACHE.myTeams || []).find(x => x.code === code);
  if (!t || !t.isOwner) return;
  const name = document.getElementById('manage-team-name').value.trim();
  if (!name) return alert('Dê um nome para a equipe.');
  if (name === t.name) return closeManageTeam();
  return runOnce('rename-team', btn, 'Salvando...', async () => {
    try {
      const r = await api('renameTeam', { code, name });
      t.name = (r && r.name) || name;
      if (CACHE.teams && CACHE.teams[code]) CACHE.teams[code].name = t.name;
      document.getElementById('manage-team-overlay').hidden = true;
      manageTeamCode = null;
      renderHub();
    } catch (err) { alert(err.message); }
  });
}
function manageTeamDelete() {
  const code = manageTeamCode;
  document.getElementById('manage-team-overlay').hidden = true;
  manageTeamCode = null;
  deleteTeamAction(code);
}
function manageTeamLeave() {
  const code = manageTeamCode;
  const t = (CACHE.myTeams || []).find(x => x.code === code);
  if (!t) return;
  document.getElementById('manage-team-overlay').hidden = true;
  manageTeamCode = null;
  leaveTeamTargetCode = code;
  document.getElementById('leave-team-name').textContent = t.name;
  document.getElementById('leave-team-overlay').hidden = false;
}
function closeLeaveTeamModal() {
  if (isActionPending('leave-team')) return;
  document.getElementById('leave-team-overlay').hidden = true;
  leaveTeamTargetCode = null;
}
async function confirmLeaveTeam(btn) {
  const code = leaveTeamTargetCode;
  const t = (CACHE.myTeams || []).find(x => x.code === code);
  if (!code || !t) return closeLeaveTeamModal();
  return runOnce('leave-team', btn, 'Saindo...', async () => {
    pendingWrites++;
    try {
      await api('leaveTeam', { code });
      if (session.teamCode === code) {
        stopPolling(); clearInterval(tickInterval);
        DB.saveRunning(null);
        session.teamCode = null;
      }
      try { if (localStorage.getItem('petimer_last_team') === code) localStorage.removeItem('petimer_last_team'); } catch (_) {}
      const meData = await api('me');
      CACHE.myTeams = meData.teams || [];
      document.getElementById('leave-team-overlay').hidden = true;
      leaveTeamTargetCode = null;
      showScreen('hub-screen');
      renderHub();
    } catch (err) {
      document.getElementById('leave-team-overlay').hidden = true;
      leaveTeamTargetCode = null;
      alert(err.message);
    }
    finally { pendingWrites--; }
  });
}

let deleteTeamTargetCode = null;
function deleteTeamAction(code) {
  code = code || session.teamCode;
  const t = (CACHE.myTeams || []).find(x => x.code === code);
  if (!t || !t.isOwner) return;
  deleteTeamTargetCode = code;
  document.getElementById('delete-team-name').textContent = t.name;
  document.getElementById('delete-team-overlay').hidden = false;
}
function closeDeleteTeamModal() {
  if (isActionPending('delete-team')) return;
  document.getElementById('delete-team-overlay').hidden = true;
  deleteTeamTargetCode = null;
}
document.addEventListener('keydown', (ev) => {
  if (ev.key !== 'Escape') return;
  if (!document.getElementById('delete-team-overlay').hidden) closeDeleteTeamModal();
  else if (!document.getElementById('leave-team-overlay').hidden) closeLeaveTeamModal();
  else if (!document.getElementById('manage-team-overlay').hidden) closeManageTeam();
});
async function confirmDeleteTeam(btn) {
  if (isActionPending('delete-team')) return;
  const code = deleteTeamTargetCode;
  const t = (CACHE.myTeams || []).find(x => x.code === code);
  if (!code || !t || !t.isOwner) return closeDeleteTeamModal();
  return runOnce('delete-team', btn, 'Excluindo...', async () => {
    pendingWrites++;
    try {
      await api('deleteTeam', { code });
      const wasCurrent = session.teamCode === code;
      if (wasCurrent) {
        stopPolling();
        clearInterval(tickInterval);
        DB.saveRunning(null);
        session.teamCode = null;
      }
      try { if (localStorage.getItem('petimer_last_team') === code) localStorage.removeItem('petimer_last_team'); } catch (_) {}
      const meData = await api('me');
      CACHE.myTeams = meData.teams || [];
      document.getElementById('delete-team-overlay').hidden = true;
      deleteTeamTargetCode = null;
      if (wasCurrent) goToHub(); else renderHub();
    } catch (err) {
      document.getElementById('delete-team-overlay').hidden = true;
      deleteTeamTargetCode = null;
      alert(err.message);
    }
    finally { pendingWrites--; }
  });
}
function syncManualAddButton() {
  const input = document.getElementById('manual-add-user');
  const button = document.getElementById('manual-add-submit');
  if (button) button.disabled = isActionPending('add-member') || !input?.value.trim();
}
async function addMemberManually(btn) {
  if (isActionPending('add-member')) return;
  const i = document.getElementById('manual-add-user'), u = i.value.trim().toLowerCase();
  if (!u) return;
  return runOnce('add-member', btn, 'Adicionando...', async () => {
    try {
      await api('addMember', { code: session.teamCode, username: u });
      await refreshTeamData();
      i.value = '';
      renderTeamMembers();
    } catch (err) { alert(err.message); }
  }).finally(syncManualAddButton);
}
