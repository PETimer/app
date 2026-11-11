/**
 * Filtros por pessoa, setor, cargo e local.
 */

// ---------- Filtros: pessoas (eu / eu+colegas / equipe / setor), setor, cargo, local ----------
function normalizeTeamSectors(sectors, members = {}) {
  const names = ['Geral'];
  const seen = new Set(['geral']);
  // Dados antigos sem cadastro independente mantêm os setores dos membros.
  const source = Array.isArray(sectors) ? sectors : Object.values(members).map(m => m.sector);
  source.forEach(value => {
    const name = String(value || '').trim(), key = name.toLocaleLowerCase('pt-BR');
    if (name && !seen.has(key)) { seen.add(key); names.push(name); }
  });
  return names;
}
function getTeamSectors() {
  const team = DB.getTeams()[session.teamCode];
  return team ? normalizeTeamSectors(team.sectors, team.members) : ['Geral'];
}

function usersInSector(sector) {
  const team = DB.getTeams()[session.teamCode];
  if (!team) return [];
  const idleAdmin = team.adminParticipatesInCycle === false ? team.admin : null;
  return Object.keys(team.members || {}).filter(u => u !== idleAdmin && (team.members[u].sector || 'Geral') === sector);
}

// Membros da equipe atual, para a seleção individual de usuário.
// Reutiliza exclusivamente os dados que o frontend já mantém (team.members / DB.getUsers()).
function getAnalysisTeamMembers() {
  const team = DB.getTeams()[session.teamCode];
  if (!team) return [];
  const users = DB.getUsers();
  const idleAdmin = team.adminParticipatesInCycle === false ? team.admin : null;
  return Object.keys(team.members || {}).filter(u => u !== idleAdmin).map(u => ({
    username: u,
    name: (users[u] && users[u].name) || (u === session.username ? session.name : null) || u
  })).sort((a,b) => a.username.localeCompare(b.username,'pt-BR'));
}

// Garante que o usuário selecionado ainda é válido para a equipe atual
// (equipe trocada, membro removido, etc.). Se não for, volta para o próprio usuário logado.
function ensureAnalysisSelectedUser() {
  const members = getAnalysisTeamMembers();
  const valid = new Set(members.map(m => m.username));
  // Mantém a seleção múltipla apenas com membros ainda válidos (na ordem da equipe).
  let selected = (analysisSelectedUsers || []).filter(u => valid.has(u));
  if (!selected.length && analysisSelectedUser && valid.has(analysisSelectedUser)) selected = [analysisSelectedUser];
  if (!selected.length) {
    const fallback = valid.has(session.username) ? session.username : (members[0]?.username || null);
    selected = fallback ? [fallback] : [];
  }
  analysisSelectedUsers = selected;
  analysisSelectedUser = selected[0] || null;
}

// Texto curto do(s) usuário(s) selecionado(s) para o filtro: "ez" / "ez, al, bz" / "5 usuários".
function analysisSelectedUsersText() {
  const list = analysisSelectedUsers || [];
  if (!list.length) return '';
  if (list.length <= 3) return list.join(', ');
  return list.length + ' usuários';
}

// Garante um setor válido: mantém o anterior; senão "Geral"; senão o primeiro disponível.
function ensureAnalysisSelectedSector() {
  const sectors = getTeamSectors();
  if (analysisSelectedSector && sectors.includes(analysisSelectedSector)) return;
  analysisSelectedSector = sectors.includes('Geral') ? 'Geral' : (sectors[0] || null);
}

function updateAnalysisScopeLabel() {
  const label = document.getElementById('analysis-scope-label');
  if (!label) return;
  ensureAnalysisSelectedSector();
  if (analysisScope === 'team') label.textContent = 'Equipe inteira';
  else if (analysisScope === 'sector') label.textContent = analysisSelectedSector ? 'Por setor (' + analysisSelectedSector + ')' : 'Por setor';
  else if (analysisSelectedUser) label.innerHTML = '<svg class="scope-user-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="3.6"></circle><path d="M5 20c0-3.6 3.1-6 7-6s7 2.4 7 6"></path></svg><span class="scope-user-name">' + escapeHtml(analysisSelectedUsersText()) + '</span>';
  else label.textContent = 'Usuário';
  const nav = document.getElementById('analysis-user-nav');
  if (nav) {
    const itemCount = analysisScope === 'sector' ? getTeamSectors().length : getAnalysisTeamMembers().length;
    const disabled = analysisScope === 'team' || itemCount <= 1;
    const prevBtn = document.getElementById('analysis-nav-prev'), nextBtn = document.getElementById('analysis-nav-next');
    const prevText = analysisScope === 'sector' ? 'Setor anterior' : 'Usuário anterior';
    const nextText = analysisScope === 'sector' ? 'Próximo setor' : 'Próximo usuário';
    if (prevBtn) { prevBtn.title = prevText; prevBtn.setAttribute('aria-label', prevText); }
    if (nextBtn) { nextBtn.title = nextText; nextBtn.setAttribute('aria-label', nextText); }
    nav.classList.toggle('inactive', disabled);
    nav.querySelectorAll('button').forEach(button => { button.disabled = disabled; button.setAttribute('aria-hidden', String(disabled)); });
  }
  const userItem = document.querySelector('#analysis-scope-menu .analysis-scope-menu-item[data-scope="user"]');
  if (userItem) userItem.innerHTML = '<span class="scope-item-text">' + (analysisSelectedUser ? 'Usuário (<strong>' + escapeHtml(analysisSelectedUsersText()) + '</strong>)' : 'Usuário') + '</span><span class="scope-item-arrow" aria-hidden="true"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg></span>';
  const sectorItem = document.querySelector('#analysis-scope-menu .analysis-scope-menu-item[data-scope="sector"]');
  if (sectorItem) sectorItem.innerHTML = '<span class="scope-item-text">' + (analysisSelectedSector ? 'Por setor (<strong>' + escapeHtml(analysisSelectedSector) + '</strong>)' : 'Por setor') + '</span><span class="scope-item-arrow" aria-hidden="true"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg></span>';
  document.querySelectorAll('#analysis-scope-menu .analysis-scope-menu-item').forEach(el => {
    el.classList.toggle('active', el.dataset.scope === analysisScope);
  });
}

function toggleAnalysisScopeMenu(evt) {
  if (evt) evt.stopPropagation();
  const menu = document.getElementById('analysis-scope-menu');
  const btn = document.getElementById('analysis-scope-btn');
  if (!menu || !btn) return;
  const willOpen = menu.hidden;
  menu.hidden = !willOpen;
  btn.setAttribute('aria-expanded', String(willOpen));
}

function closeAnalysisScopeMenu() {
  const menu = document.getElementById('analysis-scope-menu');
  const btn = document.getElementById('analysis-scope-btn');
  if (menu) menu.hidden = true;
  if (btn) btn.setAttribute('aria-expanded', 'false');
}

document.addEventListener('click', (evt) => {
  const wrap = document.getElementById('analysis-scope-wrap');
  if (wrap && !wrap.contains(evt.target)) closeAnalysisScopeMenu();
});

function chooseAnalysisScopeOption(scope) {
  closeAnalysisScopeMenu();
  if (scope === 'user') {
    openUserSelectModal('user');
    return;
  }
  if (scope === 'sector') {
    openUserSelectModal('sector');
    return;
  }
  analysisScope = scope;
  document.getElementById('analysis-sector').hidden = true;
  updateAnalysisScopeLabel();
  renderAnalysis();
}
