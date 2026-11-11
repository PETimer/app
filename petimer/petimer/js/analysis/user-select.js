/**
 * Modal de seleção de usuários.
 */

// ---------- Modal de seleção de usuário ----------
let userSelectKind = 'user';
function openUserSelectModal(kind = 'user') {
  userSelectKind = kind === 'sector' ? 'sector' : 'user';
  const title = document.getElementById('user-select-title');
  if (title) title.textContent = userSelectKind === 'sector' ? 'Selecionar setor' : 'Selecionar usuários';
  if (userSelectKind === 'sector') {
    ensureAnalysisSelectedSector();
    userSelectPendingChoice = analysisSelectedSector;
  } else {
    ensureAnalysisSelectedUser();
    userSelectPendingChoice = analysisScope === 'user' ? analysisSelectedUser : (analysisSelectedUser || session.username);
    // Multisseleção: parte da seleção atual (ou do próprio usuário, se o filtro não estava em "Usuário").
    userSelectPendingSet = new Set(analysisScope === 'user' && analysisSelectedUsers.length ? analysisSelectedUsers : [userSelectPendingChoice].filter(Boolean));
  }
  const search = document.getElementById('user-select-search');
  if (search) {
    search.value = '';
    search.placeholder = userSelectKind === 'sector' ? 'Buscar setor...' : 'Buscar usuário...';
    // Com poucos setores a busca é desnecessária: esconde e foca direto na lista.
    search.hidden = userSelectKind === 'sector' && getTeamSectors().length <= USER_SELECT_SEARCH_MIN_SECTORS;
  }
  const overlay = document.getElementById('user-select-overlay');
  if (overlay) overlay.hidden = false;
  renderUserSelectList('', true);
  const focusTarget = (search && !search.hidden) ? search : document.getElementById('user-select-list');
  if (focusTarget) setTimeout(() => focusTarget.focus(), 0);
}

function closeUserSelectModal() {
  const overlay = document.getElementById('user-select-overlay');
  if (overlay) overlay.hidden = true;
}

function normalizeUserSelectText(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

// Itens exibidos na lista (usuários, com o próprio usuário no topo; ou setores com a contagem de membros).
function getUserSelectEntries(filterText) {
  const term = normalizeUserSelectText(filterText);
  const team = DB.getTeams()[session.teamCode] || { members: {} };
  if (userSelectKind === 'sector') {
    const counts = {};
    Object.values(team.members || {}).forEach(m => { const name = (m && m.sector) || 'Geral'; counts[name] = (counts[name] || 0) + 1; });
    return getTeamSectors()
      .filter(name => !term || normalizeUserSelectText(name).includes(term))
      .map(name => ({ value: name, name, count: counts[name] || 0 }));
  }
  const all = getAnalysisTeamMembers();
  const me = all.filter(m => m.username === session.username);
  const others = all.filter(m => m.username !== session.username);
  return [...me, ...others]
    .filter(m => !term || normalizeUserSelectText(m.username).includes(term) || normalizeUserSelectText(m.name).includes(term))
    .map(m => {
      const isOwner = team.admin === m.username;
      const isAdmin = !isOwner && (team.members || {})[m.username]?.role === 'admin';
      return { value: m.username, name: m.name, username: m.username, isOwner, isAdmin, isMe: m.username === session.username };
    });
}

const USER_SELECT_SEARCH_MIN_SECTORS = 8;
const USER_SELECT_CHECK_BOX = '<span class="user-select-check is-box" aria-hidden="true"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg></span>';
const USER_SELECT_CHECK = '<span class="user-select-check" aria-hidden="true"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg></span>';

function renderUserSelectList(filterText, scrollToSelected) {
  const list = document.getElementById('user-select-list');
  if (!list) return;
  const entries = getUserSelectEntries(filterText);
  if (!entries.length) {
    list.innerHTML = '<div class="user-select-empty">' + (userSelectKind === 'sector' ? 'Nenhum setor encontrado.' : 'Nenhum usuário encontrado.') + '</div>';
  } else {
    list.innerHTML = entries.map(e => {
      const selected = userSelectKind === 'sector' ? e.value === userSelectPendingChoice : userSelectPendingSet.has(e.value);
      const dbl = userSelectKind === 'sector' ? ` ondblclick="pickUserSelectOption(this.dataset.value);confirmUserSelect()"` : '';
      const attrs = `type="button" role="option" aria-selected="${selected}" class="user-select-item ${selected ? 'selected' : ''}" data-value="${escapeHtml(e.value)}" onclick="pickUserSelectOption(this.dataset.value)"${dbl}`;
      if (userSelectKind === 'sector') {
        return `<button ${attrs}>
            <span class="user-select-copy"><span class="user-select-name" title="${escapeHtml(e.name)}">${escapeHtml(e.name)}</span></span><span class="user-select-meta user-select-count">${e.count} ${e.count === 1 ? 'membro' : 'membros'}</span>${USER_SELECT_CHECK}
          </button>`;
      }
      const badge = e.isOwner ? '<span class="user-select-badge is-owner">Criador</span>' : (e.isAdmin ? '<span class="user-select-badge is-admin">Admin</span>' : '');
      return `<button ${attrs}>
          <span class="user-select-avatar" aria-hidden="true">${escapeHtml(cycleMemberInitials(e.name))}</span>
          <span class="user-select-copy"><span class="user-select-name" title="${escapeHtml(e.name)}">${escapeHtml(e.name)}</span><span class="user-select-username">@${escapeHtml(e.username)}</span>${badge}${e.isMe ? '<span class="user-select-you">(você)</span>' : ''}</span>${USER_SELECT_CHECK_BOX}
        </button>`;
    }).join('');
  }
  if (scrollToSelected) {
    const sel = list.querySelector('.user-select-item.selected');
    if (sel) list.scrollTop = Math.max(0, sel.offsetTop - (list.clientHeight - sel.offsetHeight) / 2);
  }
  updateUserSelectConfirm();
  updateUserSelectFade();
}

function updateUserSelectConfirm() {
  const btn = document.getElementById('user-select-confirm');
  if (!btn) return;
  if (userSelectKind === 'sector') { btn.disabled = !userSelectPendingChoice; btn.textContent = 'Selecionar'; return; }
  const n = userSelectPendingSet.size;
  btn.disabled = n === 0;
  btn.textContent = n > 1 ? 'Selecionar (' + n + ')' : 'Selecionar';
}

// Degradê no rodapé da lista só aparece enquanto ainda há itens abaixo.
function updateUserSelectFade() {
  const list = document.getElementById('user-select-list');
  const wrap = document.getElementById('user-select-list-wrap');
  if (!list || !wrap) return;
  wrap.classList.toggle('at-end', list.scrollTop + list.clientHeight >= list.scrollHeight - 2);
}

function filterUserSelectList() {
  const search = document.getElementById('user-select-search');
  renderUserSelectList(search ? search.value : '', false);
}

function pickUserSelectOption(value) {
  if (userSelectKind !== 'sector') {
    // Usuários: clicar alterna (marca/desmarca) sem limpar os demais.
    if (userSelectPendingSet.has(value)) userSelectPendingSet.delete(value); else userSelectPendingSet.add(value);
  } else {
    userSelectPendingChoice = value;
  }
  document.querySelectorAll('#user-select-list .user-select-item').forEach(el => {
    const on = userSelectKind === 'sector' ? el.dataset.value === value : userSelectPendingSet.has(el.dataset.value);
    el.classList.toggle('selected', on);
    el.setAttribute('aria-selected', on ? 'true' : 'false');
  });
  updateUserSelectConfirm();
}

// Teclado: setas movem o foco pela lista; Espaço/Enter no item marca ou desmarca;
// Enter na busca confirma (se nada estiver marcado, marca o primeiro resultado). Esc fecha.
function userSelectSearchKey(ev) {
  const search = document.getElementById('user-select-search');
  if (ev.key === 'Escape') { ev.preventDefault(); closeUserSelectModal(); return; }
  const entries = getUserSelectEntries(search && !search.hidden ? search.value : '');
  const focused = ev.target && ev.target.closest ? ev.target.closest('.user-select-item') : null;
  if (userSelectKind !== 'sector') {
    if (ev.key === 'Enter') {
      ev.preventDefault();
      if (focused) { pickUserSelectOption(focused.dataset.value); return; }
      if (!userSelectPendingSet.size && entries.length) pickUserSelectOption(entries[0].value);
      if (userSelectPendingSet.size) confirmUserSelect();
      return;
    }
    if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp') {
      const items = Array.from(document.querySelectorAll('#user-select-list .user-select-item'));
      if (!items.length) return;
      ev.preventDefault();
      const current = focused ? items.indexOf(focused) : -1;
      const step = ev.key === 'ArrowDown' ? 1 : -1;
      const next = current < 0 ? (step > 0 ? 0 : items.length - 1) : (current + step + items.length) % items.length;
      items[next].focus();
      items[next].scrollIntoView({ block: 'nearest' });
    }
    return;
  }
  if (ev.key === 'Enter') {
    ev.preventDefault();
    if (focused) pickUserSelectOption(focused.dataset.value);
    if (entries.length && !entries.some(e => e.value === userSelectPendingChoice)) pickUserSelectOption(entries[0].value);
    if (userSelectPendingChoice) confirmUserSelect();
    return;
  }
  if ((ev.key === 'ArrowDown' || ev.key === 'ArrowUp') && entries.length) {
    ev.preventDefault();
    const current = entries.findIndex(e => e.value === userSelectPendingChoice);
    const step = ev.key === 'ArrowDown' ? 1 : -1;
    const next = current < 0 ? 0 : (current + step + entries.length) % entries.length;
    pickUserSelectOption(entries[next].value);
    const el = document.querySelector('#user-select-list .user-select-item.selected');
    if (el) el.scrollIntoView({ block: 'nearest' });
  }
}

function confirmUserSelect() {
  if (userSelectKind === 'sector' ? !userSelectPendingChoice : !userSelectPendingSet.size) { alert(userSelectKind === 'sector' ? 'Selecione um setor.' : 'Selecione ao menos um usuário.'); return; }
  if (userSelectKind === 'sector') {
    analysisScope = 'sector';
    analysisSelectedSector = userSelectPendingChoice;
  } else {
    analysisScope = 'user';
    // Mantém a ordem da equipe (alfabética por username), independente da ordem dos cliques.
    analysisSelectedUsers = getAnalysisTeamMembers().map(m => m.username).filter(u => userSelectPendingSet.has(u));
    analysisSelectedUser = analysisSelectedUsers[0] || null;
  }
  document.getElementById('analysis-sector').hidden = true;
  closeUserSelectModal();
  updateAnalysisScopeLabel();
  renderAnalysis();
}
