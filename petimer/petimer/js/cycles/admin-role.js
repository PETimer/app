/**
 * Participação do administrador no período.
 */

function adminParticipatesInCycle() {
  const team = DB.getTeams()[session.teamCode];
  return !team || team.admin !== session.username || team.adminParticipatesInCycle !== false;
}
function openAdminCycleRoleDialog() {
  const team = DB.getTeams()[session.teamCode];
  if (!team || team.admin !== session.username) return;
  closeProfileMenu();
  const overlay = document.getElementById('admin-cycle-role-overlay');
  if (!overlay) return;
  const value = adminParticipatesInCycle() ? 'participant' : 'admin-only';
  const input = overlay.querySelector(`input[name="admin-cycle-role"][value="${value}"]`);
  if (input) input.checked = true;
  updateAdminCycleRoleCards();
  overlay.hidden = false;
}
function closeAdminCycleRoleDialog() {
  const overlay = document.getElementById('admin-cycle-role-overlay');
  if (overlay) overlay.hidden = true;
}
function updateAdminCycleRoleCards() {
  const selected = document.querySelector('input[name="admin-cycle-role"]:checked')?.value;
  document.getElementById('admin-role-only-card')?.classList.toggle('selected', selected === 'admin-only');
  document.getElementById('admin-role-participant-card')?.classList.toggle('selected', selected === 'participant');
}
async function saveAdminCycleRole(btn) {
  if (isActionPending('save-admin-role')) return;
  const selected = document.querySelector('input[name="admin-cycle-role"]:checked')?.value;
  if (!selected) return;
  const team = DB.getTeams()[session.teamCode];
  if (!team || team.admin !== session.username) return;
  return runOnce('save-admin-role', btn, null, async () => {
    try {
      await api('setAdminParticipation', { code: session.teamCode, value: selected === 'participant' });
      await refreshTeamData();
      closeAdminCycleRoleDialog();
      setupApp();
    } catch (err) { alert(err.message); }
  });
}
function toggleAdminCycleParticipation() { openAdminCycleRoleDialog(); }
function updateCycleRoleControl() {
  const team = DB.getTeams()[session.teamCode], btn=document.getElementById('cycle-role-toggle'), label=document.getElementById('cycle-role-toggle-label');
  if(!btn||!team) return; const admin=team.admin===session.username; btn.hidden=!admin;
  if(admin && label) label.textContent = adminParticipatesInCycle() ? 'Administrador e participante do período' : 'Apenas administrador';
}
