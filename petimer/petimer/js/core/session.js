/**
 * Sessão, polling, histórico do navegador, init() e troca de telas.
 */

let session = null; 
let tickInterval = null;
let pollInterval = null;
function startPolling() {
  stopPolling();
  pollInterval = setInterval(async () => {
    if (!session || !session.teamCode || document.hidden || pendingWrites > 0) return;
    try {
      const wasRunning = !!DB.getRunning();
      await refreshTeamData();
      // Não sobrescreve o cronômetro em andamento localmente com o
      // valor do servidor a cada poll — apenas os dados da equipe.
      if (wasRunning && !DB.getRunning()) { clearInterval(tickInterval); setTimerUI(false); }
      refreshAppViews();
    } catch (err) {
      // Equipe apagada pelo administrador (ou membro removido): volta para o início.
      if (/Equipe não encontrada|não faz parte dessa equipe/i.test(String(err.message || err))) {
        stopPolling(); clearInterval(tickInterval);
        DB.saveRunning(null);
        session.teamCode = null;
        try { localStorage.removeItem('petimer_last_team'); } catch (_) {}
        try { const m = await api('me'); CACHE.myTeams = m.teams || []; } catch (_) {}
        alert('Esta equipe não está mais disponível (foi excluída ou você foi removido).');
        goToHub();
      }
      /* demais erros (rede) ficam em silêncio para não interromper o uso */
    }
  }, 30000);
}
function stopPolling() { if (pollInterval) clearInterval(pollInterval); pollInterval = null; }
let currentView = 'tracker';
let editingCycleId = null;
let cycleSubView = 'current';
let selectedCycleDetailId = null;


function savePetimerVisualNavigation() {
  if (!session?.teamCode) return;
  try {
    sessionStorage.setItem('petimer_visual_navigation', JSON.stringify({
      teamCode: session.teamCode, view: currentView, cycleSubView, analysisMode
    }));
  } catch (_) { /* Preferência opcional; nunca impede a navegação. */ }
  syncPetimerHistory();
}

// ---------- HISTÓRICO DO NAVEGADOR (botão voltar/avançar) ----------
let petimerHistoryLock = false;

function petimerHash() {
  let h = currentView;
  if (currentView === 'analysis' && analysisMode !== 'overview') h += '/' + analysisMode;
  if (currentView === 'cycle' && cycleSubView !== 'current') h += '/' + cycleSubView;
  return '#' + h;
}

function syncPetimerHistory() {
  if (petimerHistoryLock || !session?.teamCode) return;
  const hash = petimerHash();
  if (location.hash === hash && history.state?.petimer) return;
  const state = { petimer: true, view: currentView, cycleSubView, analysisMode };
  // Primeira vez: só marca a entrada atual. Depois: cria uma entrada nova a cada mudança.
  if (!history.state?.petimer) history.replaceState(state, '', hash);
  else history.pushState(state, '', hash);
}

window.addEventListener('popstate', (e) => {
  const s = e.state;
  if (!s?.petimer || !session?.teamCode) return;
  petimerHistoryLock = true;            // evita criar nova entrada ao restaurar
  try {
    setAnalysisMode(s.analysisMode, null, false);
    switchCycleSubView(s.cycleSubView, false);
    const btn = Array.from(document.querySelectorAll('.nav-item'))
      .find(b => b.getAttribute('onclick')?.includes("switchView('" + s.view + "'"));
    switchView(s.view, btn);            // já renderiza a tela
  } finally {
    petimerHistoryLock = false;
  }
});

function preparePetimerVisualRestore() {
  const state = window.petimerVisualRestore;
  if (!state || !authToken) return;
  showScreen('main-app');
  setAnalysisMode(state.analysisMode, null, false);
  switchCycleSubView(state.cycleSubView, false);
  const button = Array.from(document.querySelectorAll('.nav-item'))
    .find(b => b.getAttribute('onclick')?.includes("switchView('" + state.view + "'"));
  switchView(state.view, button, false);
  showPetimerLoading('Carregando PETimer...');
  document.documentElement.classList.remove('petimer-restoring');
  document.documentElement.removeAttribute('data-petimer-restore-view');
}

// Mensagens do servidor que indicam indisponibilidade momentânea (e não sessão inválida).
function isTransientServerMessage(msg) {
  return /timeout|tempo esgotado|ocupad|too many|muitas|quota|limite|lock|busy|tente novamente|try again|indispon/i.test(String(msg || ''));
}

async function init() {
  if (!authToken) { showScreen('auth-screen'); return; }
  if (!petimerLoadingDepth) showPetimerLoading('Carregando PETimer...');
  window.petimerRestoringSession = true;
  let sessionRejected = false;
  try {
    // 1) Valida a sessão com a lógica existente ('me').
    let d = null;
    while (!d) {
      try {
        d = await api('me');
      } catch (err) {
        if (err && err.petimerServerRejected && !isTransientServerMessage(err.message)) {
          sessionRejected = true; // servidor confirmou: token inválido/expirado
          throw err;
        }
        // Falha de rede/indisponibilidade: mantém token e navegação salvos.
        if (!confirm('Não foi possível conectar ao PETimer para restaurar sua sessão.\n\nSua sessão foi mantida. Deseja tentar novamente?')) {
          showScreen('auth-screen');
          return;
        }
      }
    }
    session = { username: d.user.username, name: d.user.displayName, teamCode: null, isMaster: !!d.isMaster, mustChange: !!d.mustChange };
    CACHE.users[session.username] = { username: session.username, name: session.name };
    CACHE.myTeams = d.teams || [];
    // 2) Restaura a equipe anterior (se ainda for membro); a view/subview já foi restaurada visualmente.
    const lastTeam = localStorage.getItem('petimer_last_team');
    const stillMember = lastTeam && CACHE.myTeams.some(t => t.code === lastTeam);
    if (stillMember) {
      await enterTeam(lastTeam);
    } else {
      if (lastTeam) { try { localStorage.removeItem('petimer_last_team'); } catch (_) {} }
      showScreen('hub-screen');
      renderHub();
    }
  } catch (err) {
    if (sessionRejected) {
      // Único caso em que o F5 termina no login: sessão realmente recusada pelo servidor.
      showScreen('auth-screen');
      logout();
    } else {
      // Erro inesperado que NÃO é sessão inválida: nunca desloga.
      console.error('PETimer: erro ao restaurar a sessão', err);
      if (session && document.getElementById('main-app').hidden) {
        try { showScreen('hub-screen'); renderHub(); } catch (_) {}
      }
    }
  } finally {
    window.petimerRestoringSession = false;
    hidePetimerLoading();
    maybeForceReset();
  }
}

function showScreen(id) {
  document.getElementById('auth-screen').hidden = (id !== 'auth-screen');
  document.getElementById('recovery-screen').hidden = (id !== 'recovery-screen');
  document.getElementById('hub-screen').hidden = (id !== 'hub-screen');
  document.getElementById('main-app').hidden = (id !== 'main-app');

  // O aviso do último período só pode existir dentro da equipe selecionada.
  // Ao voltar para login ou seleção de equipes, ele é sempre ocultado.
  if (id !== 'main-app') {
    const finalOverlay = document.getElementById('final-period-overlay');
    if (finalOverlay) finalOverlay.hidden = true;
    const endedOverlay = document.getElementById('ended-cycle-overlay');
    if (endedOverlay) endedOverlay.hidden = true;
  }
}
