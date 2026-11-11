/**
 * Modais de gestão: setores, papéis de administrador e remoção de membros.
 */

let teamActionConfirmTarget = null;
function openTeamActionConfirm(target, title, text, label) {
  if (teamActionConfirmTarget?.busy) return;
  teamActionConfirmTarget = target;
  document.getElementById('team-action-confirm-title').textContent = title;
  document.getElementById('team-action-confirm-text').textContent = text;
  document.getElementById('team-action-confirm-submit').textContent = label;
  document.getElementById('team-action-confirm-error').hidden = true;
  document.getElementById('team-action-confirm-overlay').hidden = false;
  document.getElementById('team-action-confirm-cancel').focus();
}
function closeTeamActionConfirm() {
  if (teamActionConfirmTarget?.busy) return;
  const target = teamActionConfirmTarget;
  teamActionConfirmTarget = null;
  document.getElementById('team-action-confirm-overlay').hidden = true;
  if (target?.type === 'sector' && !document.getElementById('team-sector-modal').hidden) document.getElementById('team-sector-name').focus();
  else if (target?.trigger?.isConnected) target.trigger.focus();
}
function requestDeleteTeamSector(btn) {
  const code = session?.teamCode, actor = session?.username, name = btn.dataset.sector;
  const team = DB.getTeams()[code];
  if (!team || !isTeamAdmin() || name === 'Geral' || isActionPending('delete-sector:' + code)) return;
  const count = Object.values(team.members).filter(m => (m.sector || 'Geral') === name).length;
  const text = count ? 'O setor “' + name + '” está sendo usado por ' + count + ' membro(s). Ao excluí-lo, esses membros serão movidos para o setor Geral.' : 'Tem certeza que deseja excluir o setor “' + name + '”?';
  openTeamActionConfirm({type:'sector', code, actor, name, trigger:btn}, 'Excluir setor', text, 'Excluir');
}
async function submitTeamActionConfirm(btn) {
  const target = teamActionConfirmTarget;
  if (!target || target.busy) return;
  if (session?.teamCode !== target.code || session?.username !== target.actor) { closeTeamActionConfirm(); return; }
  if (target.type === 'entry') {
    closeTeamActionConfirm();
    return deleteEntry(target.id, btn, true);
  }
  const team = DB.getTeams()[target.code];
  if (!team || !isTeamAdmin() || target.name === 'Geral') { closeTeamActionConfirm(); return; }
  const error = document.getElementById('team-action-confirm-error');
  if (isActionPending('add-sector:' + target.code) || Object.keys(team.members).some(u => isActionPending('update-sector:' + target.code + ':' + u))) {
    error.textContent = 'Aguarde as alterações de setor terminarem e tente novamente.'; error.hidden = false; return;
  }
  const key = 'delete-sector:' + target.code;
  if (isActionPending(key)) return;
  target.busy = true; error.hidden = true;
  return runOnce(key, btn, null, async () => {
    writeSeq++; pendingWrites++;
    renderTeamMembers();
    try {
      const result = await api('deleteSector', {code:target.code, sector:target.name});
      Object.values(team.members).forEach(member => {
        if ((member.sector || 'Geral').toLocaleLowerCase('pt-BR') === target.name.toLocaleLowerCase('pt-BR')) member.sector = 'Geral';
      });
      team.sectors = normalizeTeamSectors(result.sectors, team.members);
      if (teamSectorTarget?.code === target.code) renderTeamSectorOptions();
      target.busy = false;
      closeTeamActionConfirm();
    } catch (err) {
      error.textContent = 'Não foi possível excluir o setor. ' + err.message;
      error.hidden = false;
    } finally {
      target.busy = false;
      pendingWrites--;
      if (session?.teamCode === target.code && session?.username === target.actor) { renderTeamMembers(); renderAnalysis(); }
    }
  }).finally(() => {
    if (session?.teamCode === target.code && session?.username === target.actor) renderTeamMembers();
  });
}

let teamSectorTarget = null, removeMemberTarget = null;
function teamModalTargetValid(target) {
  const team = target && DB.getTeams()[target.code];
  return !!(target && session?.teamCode === target.code && session?.username === target.actor && isTeamAdmin() && team?.members?.[target.user]);
}
function syncTeamManagementModals() {
  if (teamSectorTarget && !teamModalTargetValid(teamSectorTarget)) closeTeamSectorModal();
  else if (teamSectorTarget) renderTeamSectorOptions();
  if (removeMemberTarget && !teamModalTargetValid(removeMemberTarget)) closeRemoveMemberModal();
}
function openTeamSectorModal(user, trigger) {
  const target = {code:session?.teamCode, actor:session?.username, user, trigger};
  if (!teamModalTargetValid(target)) return;
  teamSectorTarget = target;
  document.getElementById('team-sector-name').value = '';
  document.getElementById('team-sector-error').hidden = true;
  renderTeamSectorOptions();
  document.getElementById('team-sector-modal').hidden = false;
  document.getElementById('team-sector-name').focus();
}
function closeTeamSectorModal() {
  document.getElementById('team-sector-modal').hidden = true;
  const target = teamSectorTarget;
  teamSectorTarget = null;
  if (target?.trigger?.isConnected) target.trigger.focus();
}
function renderTeamSectorOptions() {
  const sectors = [...new Set(['Geral', ...getTeamSectors()])];
  document.getElementById('team-sector-options').innerHTML = sectors.map(name =>
    '<div class="manage-item"><span class="manage-item-name">' + escapeHtml(name) + '</span>' + (name === 'Geral' ? '' : '<button class="manage-delete" type="button" data-sector="' + escapeHtml(name) + '" onclick="requestDeleteTeamSector(this)" title="Excluir" aria-label="Excluir ' + escapeHtml(name) + '"><svg viewBox="0 0 24 24"><path d="M4 7h16"></path><path d="M10 11v6"></path><path d="M14 11v6"></path><path d="M9 7V4h6v3"></path><path d="M6 7l1 14h10l1-14"></path></svg></button>') + '</div>'
  ).join('');
}
async function addTeamSector(btn) {
  const target = teamSectorTarget;
  if (!teamModalTargetValid(target)) { closeTeamSectorModal(); return; }
  const input = document.getElementById('team-sector-name');
  const name = input.value.trim();
  if (!name) { input.focus(); return; }
  const error = document.getElementById('team-sector-error');
  if (getTeamSectors().some(s => s.toLocaleLowerCase('pt-BR') === name.toLocaleLowerCase('pt-BR'))) {
    error.textContent = 'Esse setor já existe.'; error.hidden = false; input.focus(); return;
  }
  const key = 'add-sector:' + target.code;
  if (isActionPending(key) || isActionPending('delete-sector:' + target.code)) return;
  error.hidden = true;
  return runOnce(key, btn, null, async () => {
    writeSeq++; pendingWrites++; input.disabled = true;
    try {
      const result = await api('addSector', {code:target.code, sector:name});
      const team = DB.getTeams()[target.code];
      if (team) team.sectors = normalizeTeamSectors(result.sectors, team.members);
      if (teamSectorTarget === target) { input.value = ''; renderTeamSectorOptions(); }
    } catch (err) {
      if (teamSectorTarget === target) { error.textContent = err.message; error.hidden = false; }
      else alert(err.message);
    } finally {
      pendingWrites--; input.disabled = false;
      if (session?.teamCode === target.code && session?.username === target.actor) { renderTeamMembers(); renderAnalysis(); }
      if (teamSectorTarget === target) input.focus();
    }
  });
}

let teamRoleChangeTarget = null;
function requestTeamRoleChange(username, action, trigger) {
  const team = DB.getTeams()[session?.teamCode];
  if (!team || team.admin !== session?.username || !team.members?.[username] || username === team.admin || !['promote','demote'].includes(action)) return;
  const displayName = DB.getUsers()[username]?.name || DB.getUsers()[username]?.displayName || username;
  teamRoleChangeTarget = {code:session.teamCode, actor:session.username, username, action, trigger};
  document.getElementById('team-role-change-error').hidden = true;
  document.getElementById('team-role-change-error').textContent = '';
  document.getElementById('team-role-change-title').textContent = action === 'promote' ? 'Tornar administrador' : 'Remover administração';
  document.getElementById('team-role-change-copy').textContent = action === 'promote' ? 'Deseja tornar ' + displayName + ' (@' + username + ') administrador? Essa pessoa poderá gerenciar membros, setores, cargos/projetos, locais e períodos.' : 'Deseja remover a permissão de administrador de ' + displayName + ' (@' + username + ')?';
  document.getElementById('team-role-change-overlay').hidden = false;
  document.getElementById('team-role-change-cancel').focus();
}
function closeTeamRoleChange() {
  if (isActionPending('team-role-change')) return;
  const target = teamRoleChangeTarget; teamRoleChangeTarget = null;
  document.getElementById('team-role-change-overlay').hidden = true;
  if (target?.trigger?.isConnected) target.trigger.focus();
}
async function submitTeamRoleChange(btn) {
  const target = teamRoleChangeTarget;
  if (!target || isActionPending('team-role-change') || session?.teamCode !== target.code || session?.username !== target.actor || DB.getTeams()[target.code]?.admin !== target.actor) return closeTeamRoleChange();
  let actionSucceeded = false;
  await runOnce('team-role-change', btn, 'Salvando...', async () => {
    try {
      await api(target.action === 'promote' ? 'promoteMemberToAdmin' : 'demoteMemberFromAdmin', {code:target.code, username:target.username});
      actionSucceeded = true;
      await refreshTeamData();
    } catch (err) {
      const error = document.getElementById('team-role-change-error');
      error.textContent = err.message || 'Não foi possível alterar o papel deste membro.';
      error.hidden = false;
    }
  });
  if (actionSucceeded) {
    if (teamRoleChangeTarget === target) closeTeamRoleChange();
    renderTeamMembers();
    [...document.querySelectorAll('#team-members-list .team-actions-trigger')].find(button => button.dataset.member === target.username)?.focus();
  }
}

function removeMember(u, btn) {
  const target = {code:session?.teamCode, actor:session?.username, user:u, trigger:btn};
  if (!teamModalTargetValid(target) || u === target.actor || isActionPending('remove-member:' + u)) return;
  removeMemberTarget = target;
  const memberData = DB.getUsers()[u] || {};
  document.getElementById('remove-member-name').textContent = (memberData.name || memberData.displayName || u) + ' (@' + u + ')';
  document.getElementById('remove-member-error').hidden = true;
  document.getElementById('remove-member-overlay').hidden = false;
  document.getElementById('remove-member-cancel').focus();
}
function closeRemoveMemberModal() {
  document.getElementById('remove-member-overlay').hidden = true;
  const target = removeMemberTarget;
  removeMemberTarget = null;
  if (target?.trigger?.isConnected) target.trigger.focus();
}
async function confirmRemoveMember(btn) {
  const target = removeMemberTarget;
  if (!teamModalTargetValid(target) || target.user === target.actor) { closeRemoveMemberModal(); return; }
  const key = 'remove-member:' + target.user;
  if (isActionPending(key)) return;
  return runOnce(key, btn, null, async () => {
    try {
      await api('removeMember', {code:target.code, username:target.user});
      if (removeMemberTarget === target) closeRemoveMemberModal();
      if (session?.teamCode === target.code && session?.username === target.actor) {
        await refreshTeamData();
        renderTeamMembers();
      }
    } catch (err) {
      if (removeMemberTarget === target) {
        const error = document.getElementById('remove-member-error');
        error.textContent = err.message; error.hidden = false;
      } else alert(err.message);
    }
  });
}
document.addEventListener('keydown', event => {
  const modal = !document.getElementById('team-action-confirm-overlay').hidden ? document.getElementById('team-action-confirm-overlay') : !document.getElementById('team-sector-modal').hidden ? document.getElementById('team-sector-modal') : !document.getElementById('remove-member-overlay').hidden ? document.getElementById('remove-member-overlay') : null;
  if (!modal) return;
  if (event.key === 'Escape') { event.preventDefault(); if (modal.id === 'team-action-confirm-overlay') closeTeamActionConfirm(); else if (modal.id === 'team-sector-modal') closeTeamSectorModal(); else closeRemoveMemberModal(); }
  if (event.key === 'Tab') {
    const items = [...modal.querySelectorAll('button:not(:disabled),input:not(:disabled)')];
    const first = items[0], last = items[items.length-1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  }
});
