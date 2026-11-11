/**
 * Marca a página como "restaurando" para reabrir na última tela usada.
 * Só guarda navegação; nenhum dado de membros ou registros.
 */

  // Somente navegação; não guarda dados de membros, registros ou gráficos.
  window.petimerVisualRestore = null;
  try {
    if (localStorage.getItem('petimer_token')) {
      const teamCode = localStorage.getItem('petimer_last_team');
      let saved = null;
      try { saved = JSON.parse(sessionStorage.getItem('petimer_visual_navigation') || 'null'); } catch (_) {}
      const state = saved && saved.teamCode === teamCode ? saved : {};
      window.petimerVisualRestore = {
        view: ['tracker','analysis','cycle','team'].includes(state.view) ? state.view : 'tracker',
        cycleSubView: state.cycleSubView === 'records' ? 'records' : 'current',
        analysisMode: ['overview','detailed','weekly','period'].includes(state.analysisMode) ? state.analysisMode : 'overview'
      };
      document.documentElement.classList.add('petimer-restoring');
      document.documentElement.dataset.petimerRestoreView = window.petimerVisualRestore.view;
    }
  } catch (_) { /* Armazenamento indisponível: mantém o fluxo normal. */ }
