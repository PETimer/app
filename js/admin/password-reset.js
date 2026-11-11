/**
 * Troca obrigatória de senha após redefinição pelo master.
 */

// ---------- TROCA OBRIGATÓRIA APÓS REDEFINIÇÃO ----------
function maybeForceReset() {
  if (!session || !session.mustChange) return;
  ['force-reset-pass', 'force-reset-pass2', 'force-reset-answer'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  const err = document.getElementById('force-reset-error'); if (err) err.hidden = true;
  document.getElementById('force-reset-overlay').hidden = false;
  setTimeout(() => document.getElementById('force-reset-pass')?.focus(), 50);
}
function forceResetError(text) {
  const el = document.getElementById('force-reset-error');
  el.textContent = text || ''; el.hidden = !text;
}
async function submitForcedReset(e) {
  if (e) e.preventDefault();
  const btn = actionButton(e);
  const newPassword = document.getElementById('force-reset-pass').value;
  const confirmPass = document.getElementById('force-reset-pass2').value;
  const answer = document.getElementById('force-reset-answer').value.trim();
  if (newPassword.length < 6) return forceResetError('A nova senha deve ter pelo menos 6 caracteres.');
  if (newPassword === '123456') return forceResetError('Escolha uma senha diferente da padrão.');
  if (newPassword !== confirmPass) return forceResetError('A confirmação da senha não confere.');
  if (answer.length < 2) return forceResetError('Informe a resposta de segurança.');
  forceResetError('');
  return runOnce('force-reset', btn, 'Salvando...', async () => {
    try {
      await api('completePasswordReset', { newPassword, questionId: document.getElementById('force-reset-qid').value, answer });
      session.mustChange = false;
      document.getElementById('force-reset-overlay').hidden = true;
    } catch (err) { forceResetError(err.message || 'Não foi possível salvar.'); }
  });
}
async function masterDeleteTeam(code, button) {
  const t = (masterAdminData?.teams || []).find(x => x.code === code);
  if (!t) return;
  const ok = await appConfirm({
    title: 'Excluir equipe',
    message: 'Excluir a equipe **' + t.name + '** (código ' + t.code + ')?',
    note: 'Apaga a equipe, ' + t.entries + ' registro(s), períodos e metas. Não dá para desfazer.',
    confirmText: 'Excluir equipe', danger: true
  });
  if (!ok) return;
  return runOnce('master-delete-team-' + code, button, 'Excluindo...', async () => {
    try {
      await api('adminDeleteTeam', { code });
      masterShowMsg('Equipe ' + t.name + ' excluída.', false);
      await loadMasterAdmin();
      if (session && session.teamCode === code) {
        closeMasterAdmin(); stopPolling(); clearInterval(tickInterval);
        DB.saveRunning(null);
        session.teamCode = null;
        try { localStorage.removeItem('petimer_last_team'); } catch (_) {}
        try { const m = await api('me'); CACHE.myTeams = m.teams || []; } catch (_) {}
        goToHub();
      } else {
        try { const m = await api('me'); CACHE.myTeams = m.teams || []; } catch (_) {}
      }
    } catch (err) { masterShowMsg(err.message || 'Não foi possível excluir.', true); }
  });
}
