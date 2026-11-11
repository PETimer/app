/**
 * Cadastro, login, recuperação de senha e logout.
 */

// ---------- AUTH ----------
function toggleAuth(type) {
  document.getElementById('tab-login').classList.toggle('active', type === 'login');
  document.getElementById('tab-register').classList.toggle('active', type === 'register');
  document.getElementById('form-login').hidden = (type !== 'login');
  document.getElementById('form-register').hidden = (type !== 'register');
}

async function handleRegister(e) {
  e.preventDefault();
  if (isActionPending('signup')) return;
  const btn = actionButton(e);
  const name = document.getElementById('reg-name').value.trim();
  const username = normalizeUsername(document.getElementById('reg-user').value);
  const pass = document.getElementById('reg-pass').value.trim();
  const questionId = document.getElementById('reg-question').value;
  const answer = document.getElementById('reg-answer').value.trim();

  if (!username) return alert('Informe um nome de usuário.');
  if (/\s/.test(username)) return alert('O nome de usuário não pode conter espaços.');
  if (!pass || pass.length < 6) return alert('A senha precisa ter pelo menos 6 caracteres.');
  if (!questionId) return alert('Escolha uma pergunta de segurança.');
  if (!answer) return alert('Informe uma resposta de segurança.');

  return runOnce('signup', btn, 'Cadastrando...', async () => {
    try {
      const d = await api('signup', { username, password: pass, displayName: name, questionId, answer });
      applySession(d.token, d.user);
    } catch (err) { alert(err.message); }
  });
}

// ---------- RECUPERAÇÃO DE SENHA ----------
let recoveryUsername = null;

function openRecovery() {
  recoveryUsername = null;
  document.getElementById('recovery-username').value = '';
  document.getElementById('recovery-answer').value = '';
  document.getElementById('recovery-pass').value = '';
  document.getElementById('recovery-pass2').value = '';
  document.getElementById('recovery-form1').hidden = false;
  document.getElementById('recovery-form2').hidden = true;
  setMsg('recovery-error', null);
  setMsg('recovery-success', null);
  showScreen('recovery-screen');
}
function closeRecovery() {
  showScreen('auth-screen');
}
function setMsg(id, msg) {
  const el = document.getElementById(id);
  if (!el) return;
  if (!msg) { el.hidden = true; return; }
  el.textContent = msg; el.hidden = false;
}

async function handleRecoveryStep1(e) {
  e.preventDefault();
  if (isActionPending('recovery-step1')) return;
  setMsg('recovery-error', null);
  recoveryUsername = document.getElementById('recovery-username').value.trim().toLowerCase();
  const btn = document.getElementById('recovery-btn1');
  return runOnce('recovery-step1', btn, 'Buscando...', async () => {
    try {
      const d = await api('getRecoveryQuestion', { username: recoveryUsername });
      document.getElementById('recovery-question-label').textContent = d.questionText || 'Pergunta de segurança';
      document.getElementById('recovery-form1').hidden = true;
      document.getElementById('recovery-form2').hidden = false;
    } catch (err) {
      setMsg('recovery-error', err.message || 'Não foi possível localizar esse usuário.');
    }
  });
}

async function handleRecoveryStep2(e) {
  e.preventDefault();
  if (isActionPending('recovery-step2')) return;
  setMsg('recovery-error', null);
  const answer = document.getElementById('recovery-answer').value;
  const pass = document.getElementById('recovery-pass').value;
  const pass2 = document.getElementById('recovery-pass2').value;
  if (pass !== pass2) return setMsg('recovery-error', 'As senhas não coincidem.');
  if (!pass || pass.length < 6) return setMsg('recovery-error', 'A nova senha precisa ter pelo menos 6 caracteres.');

  const btn = document.getElementById('recovery-btn2');
  return runOnce('recovery-step2', btn, 'Redefinindo...', async () => {
    try {
      await api('resetPassword', { username: recoveryUsername, answer, newPassword: pass });
      setMsg('recovery-success', 'Senha redefinida! Você já pode entrar.');
      setTimeout(() => { showScreen('auth-screen'); }, 1600);
    } catch (err) {
      setMsg('recovery-error', err.message || 'Não foi possível redefinir sua senha.');
    }
  });
}

async function handleLogin(e) {
  e.preventDefault();
  if (isActionPending('login')) return;
  const btn = actionButton(e);
  const user = document.getElementById('login-user').value.trim().toLowerCase();
  const pass = document.getElementById('login-pass').value.trim();
  return runOnce('login', btn, 'Entrando...', async () => {
    try {
      const d = await api('login', { username: user, password: pass });
      await applySession(d.token, d.user);
    } catch (err) { alert(err.message || 'Usuário ou senha incorretos!'); }
  });
}

function normalizeUsername(value) {
  return String(value || '').trim().toLowerCase();
}

async function applySession(token, user) {
  authToken = token;
  localStorage.setItem('petimer_token', token);
  session = { username: user.username, name: user.displayName, teamCode: null };
  CACHE.users[session.username] = { username: session.username, name: session.name };
  try {
    const d = await api('me');
    CACHE.myTeams = d.teams || [];
    session.isMaster = !!d.isMaster;
    session.mustChange = !!d.mustChange;
  } catch (err) { CACHE.myTeams = []; }
  showScreen('hub-screen');
  renderHub();
  maybeForceReset();
}

async function logout() {
  stopPolling();
  if (DB.getRunning()) await stopTimer();
  authToken = null;
  session = null;
  CACHE = { users: {}, teams: {}, entries: [], cycles: [], running: null, teamRunning: [], myTeams: [] };
  localStorage.removeItem('petimer_token');
  localStorage.removeItem('petimer_last_team');
  try { sessionStorage.removeItem('petimer_visual_navigation'); } catch (_) {}
  location.reload();
}
