/**
 * Estrutura do app: setupApp, navegação entre views e botão do cronômetro.
 */

function goToHub() { stopPolling(); showScreen('hub-screen'); renderHub(); }
function cancelHub() { showScreen('main-app'); setupApp(); startPolling(); }

// ---------- APP & TIMER ----------
function setupApp() {
  const users = DB.getUsers();
  const teams = DB.getTeams();
  
  let currentName = session.name || session.username;
  if (users[session.username] && users[session.username].name) {
    currentName = users[session.username].name;
  }

  const team = teams[session.teamCode];

  const initials = String(currentName || session.username || 'U').trim().split(/\s+/).filter(Boolean).slice(0,2).map(p => p[0]).join('').toUpperCase();
  document.getElementById('sidebar-profile-trigger').textContent = initials || 'U';
  syncMasterUi();
  document.getElementById('admin-add-area').hidden = !isTeamAdmin();
  const mayManageTeamOptions = isTeamAdmin();
  const cargoManageFooter = document.getElementById('cargo-manage-footer');
  const modalityManageFooter = document.getElementById('modality-manage-footer');
  if (cargoManageFooter) cargoManageFooter.hidden = !mayManageTeamOptions;
  if (modalityManageFooter) modalityManageFooter.hidden = !mayManageTeamOptions;
  document.getElementById('nav-cycle').hidden = false;
  updateCycleRoleControl();
  notifyEndedCycle();

  // Inicia o registro manual na data atual, acompanhando futuras viradas de dia.
  // Uma escolha manual de outra data só fica fixa quando o usuário altera o calendário.
  resetAutomaticEntryDate();
  setEntryMode('manual');
  ensureTeamOptionConfig();
  populateManagedSelects(false);

  const run = DB.getRunning();
  if (run && run.user === session.username && run.teamCode === session.teamCode) {
    document.getElementById('activity-input').value = run.activity;
    if(run.cargo) { document.getElementById('cargo-input').value = run.cargo; applyCargoSelectColor(document.getElementById('cargo-input')); syncCargoPickerTrigger(); }
    if(run.modalidade) { document.getElementById('modalidade-input').value = run.modalidade; syncModalidadePickerTrigger(); }
    // A data histórica do cronômetro pertence ao próprio registro em andamento;
    // não deve substituir a data padrão do formulário de registro manual.
    setTimerUI(true); startTick(); setEntryMode('timer'); updateSelectedDate();
  } else {
    document.getElementById('activity-input').value = '';
    document.getElementById('activity-input').disabled = false;
    document.getElementById('timer-digits').textContent = '00:00:00';
    setTimerUI(false); clearInterval(tickInterval);
  }
  refreshAppViews();
  updateSuggestions();
  savePetimerVisualNavigation();
}

function refreshAppViews() { renderEntries(); renderTeamMembers(); renderCycleBadge(); renderAnalysis(); if (currentView === 'cycle') renderCycleView(); }

function switchView(view, btn, render = true) {
  document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
  btn?.classList.add('active');
  document.querySelectorAll('.view').forEach(v => v.hidden = true);
  document.getElementById('view-' + view).hidden = false;
  currentView = view;
  syncTrackerObserver();
  const titles = { 'tracker': 'Registro de atividade', 'analysis': 'Análise', 'team': (DB.getTeams()[session?.teamCode]?.name ? 'Equipe - ' + DB.getTeams()[session.teamCode].name : 'Gestão da Equipe'), 'cycle': 'Período' };
  document.getElementById('view-title').textContent = titles[view];
  savePetimerVisualNavigation();
  if (!render) return;
  if (view === 'cycle') renderCycleView();
  if (view === 'analysis') renderAnalysis();
  renderCycleBadge();
}

function toggleTimer() { const run = DB.getRunning(); if (run) stopTimer(); else startTimer(); }
