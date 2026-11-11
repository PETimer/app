/**
 * Lista de membros da equipe e menu de ações.
 */

let teamMemberSearchTerm = '';
function normalizeTeamMemberSearch(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').trim();
}
function filterTeamMembers(value) {
  teamMemberSearchTerm = String(value || '');
  renderTeamMembers();
}
function renderTeamMembers() {
  if (currentView === 'team') document.getElementById('view-title').textContent = (DB.getTeams()[session?.teamCode]?.name ? 'Equipe - ' + DB.getTeams()[session.teamCode].name : 'Gestão da Equipe');
  const teams = DB.getTeams(), users = DB.getUsers(), team = teams[session.teamCode], isOwner = team.admin === session.username, isAdmin = isTeamAdmin(), el = document.getElementById('team-members-list');
  document.getElementById('team-leave-access').hidden = isOwner;
  document.getElementById('team-admin-manage-access').hidden = !isAdmin;
  syncTeamManagementModals();
  const sectors = [...new Set(['Geral', ...getTeamSectors()])];
  const allMembers = Object.keys(team.members);
  const isLargeTeam = allMembers.length > 20;
  const membersCard = document.querySelector('#view-team .team-members-card');
  const searchInput = document.getElementById('team-member-search');
  const searchLabel = searchInput?.closest('.team-member-search');
  const searchToolbar = searchLabel?.parentElement;
  const countEl = document.getElementById('team-members-count');
  membersCard?.classList.toggle('is-large-team', isLargeTeam);
  if (searchLabel) searchLabel.hidden = !isLargeTeam;
  if (searchToolbar) searchToolbar.hidden = !isLargeTeam;
  if (countEl) countEl.hidden = !isLargeTeam;
  if (!isLargeTeam) {
    teamMemberSearchTerm = '';
    if (searchInput) searchInput.value = '';
  }
  const searchTerm = normalizeTeamMemberSearch(teamMemberSearchTerm);
  const filteredMembers = allMembers.filter(memberUser => {
    if (!searchTerm) return true;
    const member = team.members[memberUser] || {};
    const uData = users[memberUser] || { name: memberUser };
    const displayedName = uData.name || uData.username || memberUser;
    return normalizeTeamMemberSearch([displayedName, '@' + memberUser, memberUser, member.sector || 'Geral'].join(' ')).includes(searchTerm);
  });
  if (countEl) countEl.textContent = searchTerm
    ? `Mostrando ${filteredMembers.length} de ${allMembers.length} ${allMembers.length === 1 ? 'membro' : 'membros'}`
    : `${allMembers.length} ${allMembers.length === 1 ? 'membro' : 'membros'}`;
  const canActOnMember = memberUser => {
    const isMemberOwner = team.admin === memberUser;
    const isMemberAdmin = isMemberOwner || team.members[memberUser]?.role === 'admin';
    return (isOwner && !isMemberOwner) || (isAdmin && !isMemberOwner && (!isMemberAdmin || isOwner));
  };
  const hasActions = Object.keys(team.members).some(canActOnMember);
  const rows = filteredMembers.map(memberUser => {
    const uData = users[memberUser] || { name: memberUser };
    const realMemName = uData.name || uData.username || memberUser;
    const sector = team.members[memberUser].sector || 'Geral';
    const isMemOwner = team.admin === memberUser;
    const isMemAdmin = isMemOwner || team.members[memberUser]?.role === 'admin';
    const memberActions = [];
    if (isOwner && !isMemOwner) memberActions.push(isMemAdmin ? 'demote' : 'promote');
    if (isAdmin && !isMemOwner && (!isMemAdmin || isOwner)) memberActions.push('remove');
    const sectorControl = isAdmin ? `<select class="team-sector-select" data-member="${escapeHtml(memberUser)}" aria-label="Setor de ${escapeHtml(realMemName)}" onchange="changeTeamSector(this)" ${(isActionPending('update-sector:' + session.teamCode + ':' + memberUser) || isActionPending('delete-sector:' + session.teamCode)) ? 'disabled' : ''}><option value="add">＋ Adicionar</option>${sectors.map((name, index) => `<option value="${index}" ${name === sector ? 'selected' : ''}>${escapeHtml(name)}</option>`).join('')}</select>` : escapeHtml(sector);
    const roleBadge = isMemOwner
      ? `<span class="team-role-badge is-owner">Criador</span>`
      : isMemAdmin ? `<span class="team-role-badge is-admin">Admin</span>` : '';
    const actionButton = memberActions.length
      ? `<button class="team-actions-trigger" type="button" aria-label="Ações de ${escapeHtml(realMemName)}" aria-haspopup="menu" aria-expanded="false" data-member="${escapeHtml(memberUser)}" data-member-name="${escapeHtml(realMemName)}" data-actions="${memberActions.join(',')}" onclick="toggleTeamActionsMenu(this)"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="12" r="1.7"></circle><circle cx="12" cy="12" r="1.7"></circle><circle cx="19" cy="12" r="1.7"></circle></svg></button>`
      : '<span class="team-actions-spacer" aria-hidden="true"></span>';
    return `<div class="team-member-row${hasActions ? '' : ' no-actions'}"><div class="team-member-identity"><span class="team-avatar" aria-hidden="true">${escapeHtml(cycleMemberInitials(realMemName))}</span><div class="team-member-copy"><div class="team-member-name-line"><span class="team-member-name" title="${escapeHtml(realMemName)}">${escapeHtml(realMemName)}</span><span class="team-member-username" title="@${escapeHtml(memberUser)}">@${escapeHtml(memberUser)}</span>${roleBadge}</div></div></div><div class="team-sector"><span class="team-sector-label">Setor: </span>${sectorControl}</div><div class="team-member-actions">${hasActions ? actionButton : ''}</div></div>`;
  }).join('');
  const emptyState = !allMembers.length
    ? '<div class="team-search-empty">Nenhum membro na equipe.</div>'
    : !filteredMembers.length
      ? '<div class="team-search-empty">Nenhum membro encontrado.<span>Tente buscar por nome, usuário ou setor.</span></div>'
      : rows;
  el.innerHTML = `<div class="team-list-head${hasActions ? '' : ' no-actions'}"><span>Membro</span><span>Setor</span>${hasActions ? '<span>Ações</span>' : ''}</div><div class="team-list-body${hasActions ? '' : ' no-actions'}">${emptyState}</div>`;
}

let teamActionsLayer = null, teamActionsMenu = null, teamActionsTrigger = null;
function closeTeamActionsMenu(returnFocus = false) {
  const trigger = teamActionsTrigger;
  const menuHadFocus = !!(teamActionsMenu && teamActionsMenu.contains(document.activeElement));
  if (trigger) trigger.setAttribute('aria-expanded', 'false');
  teamActionsLayer?.remove();
  teamActionsLayer = teamActionsMenu = teamActionsTrigger = null;
  if ((returnFocus || menuHadFocus) && trigger?.isConnected) trigger.focus();
}
function toggleTeamActionsMenu(trigger) {
  if (teamActionsTrigger === trigger) { closeTeamActionsMenu(true); return; }
  closeTeamActionsMenu(false);
  const actions = String(trigger.dataset.actions || '').split(',').filter(Boolean);
  if (!actions.length) return;
  teamActionsTrigger = trigger;
  trigger.setAttribute('aria-expanded', 'true');
  const layer = document.createElement('div');
  layer.className = 'team-actions-layer';
  layer.addEventListener('click', event => { if (event.target === layer || event.target.classList.contains('team-actions-scrim')) closeTeamActionsMenu(false); });
  const scrim = document.createElement('div');
  scrim.className = 'team-actions-scrim';
  scrim.setAttribute('aria-hidden', 'true');
  const menu = document.createElement('div');
  menu.className = 'team-actions-menu';
  menu.setAttribute('role', 'menu');
  menu.setAttribute('aria-label', 'Ações para ' + trigger.dataset.memberName);
  menu.dataset.member = trigger.dataset.member;
  menu.dataset.memberName = trigger.dataset.memberName;
  menu.innerHTML = `<div class="team-actions-menu-head">${escapeHtml(trigger.dataset.memberName)}</div>${actions.map(action => {
    if (action === 'promote') return `<button class="team-actions-menu-item" type="button" role="menuitem" tabindex="-1" data-action="promote"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="8" r="3.5"></circle><path d="M3 20v-1.5A4.5 4.5 0 0 1 7.5 14h3"></path><path d="M18 8v8M14 12h8"></path></svg><span>Tornar admin</span></button>`;
    if (action === 'demote') return `<button class="team-actions-menu-item" type="button" role="menuitem" tabindex="-1" data-action="demote"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 20 6v5c0 5-3.4 8.3-8 10-4.6-1.7-8-5-8-10V6l8-3Z"></path><path d="M8 12h8"></path></svg><span>Remover admin</span></button>`;
    return `<button class="team-actions-menu-item is-danger" type="button" role="menuitem" tabindex="-1" data-action="remove"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M9 7V4h6v3M6 7l1 14h10l1-14"></path></svg><span>Remover da equipe</span></button>`;
  }).join('')}`;
  // Mantém remoção sempre após as ações de papel, separada por divisor.
  if (actions.includes('remove') && (actions.includes('promote') || actions.includes('demote'))) {
    const removeItem = menu.querySelector('[data-action="remove"]');
    const divider = document.createElement('div'); divider.className = 'team-actions-menu-separator'; divider.setAttribute('role', 'separator');
    removeItem?.before(divider);
  }
  layer.append(scrim, menu);
  document.body.appendChild(layer);
  teamActionsLayer = layer; teamActionsMenu = menu;
  const items = [...menu.querySelectorAll('[role="menuitem"]')];
  items.forEach(item => item.addEventListener('click', () => chooseTeamMemberAction(item.dataset.action)));
  if (!window.matchMedia('(max-width: 640px)').matches) {
    const rect = trigger.getBoundingClientRect(), menuRect = menu.getBoundingClientRect(), gap = 6;
    const left = Math.max(12, Math.min(window.innerWidth - menuRect.width - 12, rect.right - menuRect.width));
    const below = window.innerHeight - rect.bottom;
    const top = below < menuRect.height + gap && rect.top > menuRect.height + gap ? rect.top - menuRect.height - gap : rect.bottom + gap;
    menu.style.left = left + 'px'; menu.style.top = Math.max(8, Math.min(window.innerHeight - menuRect.height - 8, top)) + 'px';
  }
  items[0]?.focus();
}
function chooseTeamMemberAction(action) {
  const trigger = teamActionsTrigger;
  if (!trigger) return closeTeamActionsMenu(false);
  const username = trigger.dataset.member;
  closeTeamActionsMenu(false);
  if (action === 'promote' || action === 'demote') requestTeamRoleChange(username, action, trigger);
  else if (action === 'remove') removeMember(username, trigger);
}
document.addEventListener('pointerdown', event => {
  if (!teamActionsMenu || teamActionsMenu.contains(event.target) || event.target === teamActionsTrigger) return;
  closeTeamActionsMenu(false);
}, true);
document.addEventListener('keydown', event => {
  if (!teamActionsMenu) return;
  const items = [...teamActionsMenu.querySelectorAll('[role="menuitem"]')];
  const index = items.indexOf(document.activeElement);
  if (event.key === 'Escape') { event.preventDefault(); closeTeamActionsMenu(true); }
  else if (event.key === 'ArrowDown') { event.preventDefault(); items[(index + 1 + items.length) % items.length]?.focus(); }
  else if (event.key === 'ArrowUp') { event.preventDefault(); items[(index - 1 + items.length) % items.length]?.focus(); }
  else if (event.key === 'Home') { event.preventDefault(); items[0]?.focus(); }
  else if (event.key === 'End') { event.preventDefault(); items[items.length - 1]?.focus(); }
  else if (event.key === 'Tab') closeTeamActionsMenu(false);
}, true);
document.addEventListener('scroll', () => closeTeamActionsMenu(false), true);
window.addEventListener('resize', () => closeTeamActionsMenu(false));

async function changeTeamSector(select) {
  const code = session?.teamCode, actor = session?.username;
  const team = DB.getTeams()[code], u = select.dataset.member;
  if (!team || !isTeamAdmin() || !team.members[u]) { renderTeamMembers(); return; }
  const key = 'update-sector:' + code + ':' + u;
  if (isActionPending(key) || isActionPending('delete-sector:' + code)) { renderTeamMembers(); return; }
  const member = team.members[u], previous = member.sector;
  const current = previous || 'Geral';
  const sectors = [...new Set(['Geral', ...getTeamSectors()])];
  let next;
  if (select.value === 'add') {
    renderTeamMembers();
    openTeamSectorModal(u, select);
    return;
  } else next = sectors[Number(select.value)];
  if (!next || next === current) { renderTeamMembers(); return; }
  return runOnce(key, select, null, async () => {
    writeSeq++; pendingWrites++;
    member.sector = next;
    renderTeamMembers();
    try {
      await api('updateSector', { code, username: u, sector: next });
    } catch (err) {
      member.sector = previous;
      alert(err.message);
    } finally {
      pendingWrites--;
      // Uma resposta da equipe anterior não altera a equipe agora aberta.
      if (session?.teamCode === code && session?.username === actor) {
        renderTeamMembers();
        renderAnalysis();
      }
    }
  }).finally(() => {
    if (session?.teamCode === code && session?.username === actor) renderTeamMembers();
  });
}
