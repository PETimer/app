/**
 * Menu e diálogo de perfil do usuário.
 */

function toggleProfileMenu(event) {
  if (event) event.stopPropagation();
  const menu = document.getElementById('sidebar-profile-menu');
  const trigger = document.getElementById('sidebar-profile-trigger');
  const opening = menu.hidden;
  menu.hidden = !opening;
  trigger.setAttribute('aria-expanded', opening ? 'true' : 'false');
}
function closeProfileMenu() {
  const menu = document.getElementById('sidebar-profile-menu');
  const trigger = document.getElementById('sidebar-profile-trigger');
  if (menu) menu.hidden = true;
  if (trigger) trigger.setAttribute('aria-expanded','false');
}
function openProfileDialog() {
  closeProfileMenu();
  refreshProfileDialog();
  setProfileEditMode(false);
  document.getElementById('profile-dialog-overlay').hidden = false;
}
function closeProfileDialog() { document.getElementById('profile-dialog-overlay').hidden = true; }

function refreshProfileDialog() {
  const users = DB.getUsers();
  const teams = DB.getTeams();
  const u = users[session.username] || {};
  const t = teams[session.teamCode] || {};
  const displayName = u.name || session.name || session.username;
  document.getElementById('profile-view-name').textContent = displayName;
  document.getElementById('profile-view-user').textContent = '@' + session.username;
  document.getElementById('profile-name-input').value = displayName;
  document.getElementById('profile-user-input').value = session.username;
  document.getElementById('profile-pass-input').value = '';
  document.getElementById('profile-pass-confirm-input').value = '';
}

function setProfileEditMode(editing) {
  const view = document.getElementById('profile-view-mode');
  const edit = document.getElementById('profile-edit-mode');
  const title = document.getElementById('profile-dialog-title');
  if (view) view.hidden = !!editing;
  if (edit) edit.hidden = !editing;
  if (title) title.textContent = editing ? 'Editar perfil' : 'Meu perfil';
  if (editing) setTimeout(() => document.getElementById('profile-name-input')?.focus(), 30);
}

function cancelProfileEdit() {
  refreshProfileDialog();
  setProfileEditMode(false);
}

async function saveProfileChanges(e) {
  if (e) e.preventDefault();
  if (isActionPending('save-profile')) return;
  const btn = actionButton(e);
  const oldUsername = session.username;
  const name = document.getElementById('profile-name-input').value.trim();
  const newUsername = normalizeUsername(document.getElementById('profile-user-input').value);
  const newPass = document.getElementById('profile-pass-input').value;
  const passConfirm = document.getElementById('profile-pass-confirm-input').value;

  if (!name) return alert('Informe seu nome.');
  if (!newUsername) return alert('Informe um nome de usuário.');
  if (/\s/.test(newUsername)) return alert('O nome de usuário não pode conter espaços.');
  if (newPass && newPass.length < 6) return alert('A nova senha deve ter pelo menos 6 caracteres.');
  if (newPass !== passConfirm) return alert('A confirmação da senha não confere.');

  return runOnce('save-profile', btn, 'Salvando...', async () => {
    try {
      const d = await api('updateProfile', {
        displayName: name,
        newUsername: newUsername !== oldUsername ? newUsername : undefined,
        newPassword: newPass || undefined
      });
      authToken = d.token;
      localStorage.setItem('petimer_token', d.token);
      session.username = d.user.username;
      session.name = d.user.displayName;
      delete CACHE.users[oldUsername];
      CACHE.users[session.username] = { username: session.username, name: session.name };

      const me = await api('me');
      CACHE.myTeams = me.teams || [];
      session.isMaster = !!me.isMaster;
      if (session.teamCode) await refreshTeamData();
      setupApp();
      refreshProfileDialog();
      setProfileEditMode(false);
    } catch (err) { alert(err.message); }
  });
}
