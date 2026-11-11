/**
 * Administração PETimer (usuário master).
 */

// ---------- ADMINISTRAÇÃO PETimer (usuário master) ----------
let masterAdminData = null;
let masterAdminTab = 'users';
function syncMasterUi() {
  const on = !!(session && session.isMaster);
  const a = document.getElementById('master-admin-toggle');
  const b = document.getElementById('hub-master-admin');
  if (a) a.hidden = !on;
  if (b) b.hidden = !on;
}
function masterFmtDate(v) {
  const m = String(v || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? m[3] + '/' + m[2] + '/' + m[1] : '—';
}
function masterShowMsg(text, isError) {
  const el = document.getElementById('master-admin-msg');
  if (!el) return;
  el.textContent = text || '';
  el.hidden = !text;
  el.classList.toggle('is-error', !!isError);
}
async function openMasterAdmin() {
  if (!session || !session.isMaster) return;
  closeProfileMenu();
  document.getElementById('master-admin-overlay').hidden = false;
  document.getElementById('master-admin-search').value = '';
  masterShowMsg('');
  await loadMasterAdmin();
}
function closeMasterAdmin() { document.getElementById('master-admin-overlay').hidden = true; }
async function loadMasterAdmin() {
  const list = document.getElementById('master-admin-list');
  if (!masterAdminData) list.innerHTML = '<p class="master-empty">Carregando...</p>';
  try {
    masterAdminData = await api('adminOverview');
    renderMasterAdmin();
  } catch (err) {
    list.innerHTML = '<p class="master-empty">' + escapeHtml(err.message || 'Não foi possível carregar.') + '</p>';
  }
}
function setMasterAdminTab(tab) {
  masterAdminTab = tab;
  document.getElementById('master-tab-users').classList.toggle('active', tab === 'users');
  document.getElementById('master-tab-teams').classList.toggle('active', tab === 'teams');
  document.getElementById('master-admin-search').placeholder = tab === 'users' ? 'Buscar por nome ou usuário' : 'Buscar por equipe, código ou criador';
  renderMasterAdmin();
}
function renderMasterAdmin() {
  const d = masterAdminData;
  const list = document.getElementById('master-admin-list');
  if (!d) return;
  document.getElementById('master-count-users').textContent = d.users.length;
  document.getElementById('master-count-teams').textContent = d.teams.length;
  const q = String(document.getElementById('master-admin-search').value || '').trim().toLocaleLowerCase('pt-BR');
  const has = (...vals) => !q || vals.some(v => String(v || '').toLocaleLowerCase('pt-BR').includes(q));
  if (masterAdminTab === 'users') {
    const rows = d.users.filter(u => has(u.username, u.displayName)).map(u => {
      const flags = [];
      if (u.locked) flags.push('<span class="master-chip warn">Bloqueado</span>');
      if (!u.hasRecovery) flags.push('<span class="master-chip">Sem pergunta de segurança</span>');
      if (u.mustChange) flags.push('<span class="master-chip warn">Aguardando nova senha</span>');
      if (u.isMaster) flags.push('<span class="master-chip ok">Master</span>');
      const teams = u.teams.length ? u.teams.map(t => escapeHtml(t.name) + ' <span class="master-code">' + escapeHtml(t.code) + '</span>').join('<br>') : '—';
      return `<tr>
          <td><strong>${escapeHtml(u.displayName)}</strong><div class="master-sub">@${escapeHtml(u.username)}</div>${flags.length ? '<div class="master-flags">' + flags.join('') + '</div>' : ''}</td>
          <td>${masterFmtDate(u.createdAt)}</td>
          <td>${teams}</td>
          <td><button type="button" class="profile-btn profile-btn-secondary master-btn" data-user="${escapeHtml(u.username)}" onclick="masterResetPassword(this.dataset.user, this)">Redefinir senha</button></td>
        </tr>`;
    }).join('');
    list.innerHTML = rows
      ? '<div class="master-scroll"><table class="master-table"><thead><tr><th>Usuário</th><th>Criado em</th><th>Equipes</th><th>Senha</th></tr></thead><tbody>' + rows + '</tbody></table></div>'
      : '<p class="master-empty">Nenhum usuário encontrado.</p>';
  } else {
    const rows = d.teams.filter(t => has(t.name, t.code, t.admin, t.adminName)).map(t => `<tr>
          <td><strong>${escapeHtml(t.name)}</strong></td>
          <td><span class="master-code">${escapeHtml(t.code)}</span></td>
          <td>${escapeHtml(t.adminName || t.admin)}<div class="master-sub">@${escapeHtml(t.admin)}</div></td>
          <td>${t.members}</td>
          <td>${t.entries}</td>
          <td>${masterFmtDate(t.createdAt)}</td>
          <td class="master-actions"><button type="button" class="profile-btn profile-btn-danger master-btn" data-code="${escapeHtml(t.code)}" onclick="masterDeleteTeam(this.dataset.code, this)">Excluir</button></td>
        </tr>`).join('');
    list.innerHTML = rows
      ? '<div class="master-scroll"><table class="master-table"><thead><tr><th>Equipe</th><th>Código</th><th>Criador</th><th>Membros</th><th>Registros</th><th>Criada em</th><th></th></tr></thead><tbody>' + rows + '</tbody></table></div>'
      : '<p class="master-empty">Nenhuma equipe encontrada.</p>';
  }
}
async function masterResetPassword(username, button) {
  const ok = await appConfirm({
    title: 'Redefinir senha',
    message: 'A senha de **@' + username + '** voltará a ser **123456**.',
    note: 'No próximo login, a pessoa será obrigada a escolher uma nova senha e uma nova pergunta de segurança.',
    confirmText: 'Redefinir', danger: false
  });
  if (!ok) return;
  return runOnce('master-reset-' + username, button, 'Redefinindo...', async () => {
    try {
      await api('adminResetPassword', { username });
      masterShowMsg('Senha de @' + username + ' redefinida para 123456.', false);
      await loadMasterAdmin();
    } catch (err) { masterShowMsg(err.message || 'Não foi possível redefinir.', true); }
  });
}
