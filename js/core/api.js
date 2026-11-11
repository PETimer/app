/**
 * Comunicação com o backend (Apps Script): token, ações pendentes e função api().
 */

// ---------- CONEXÃO COM O BACKEND (Google Apps Script + Planilha) ----------

let authToken = localStorage.getItem('petimer_token') || null;

/* ---------- PROTEÇÃO CONTRA DUPLO CLIQUE / MÚLTIPLAS SUBMISSÕES ----------
     Camada 1 (lógica): a chave fica em pendingActions enquanto a Promise da ação
     estiver em andamento; novas chamadas com a mesma chave são ignoradas (retornam
     a Promise já em andamento, sem executar a ação de novo).
     Camada 2 (DOM): o botão fica disabled durante a ação.
     A liberação sempre ocorre em finally (sucesso, erro ou exceção inesperada).
     Sem setTimeout/debounce/throttle: dura exatamente o tempo da operação real. */
const pendingActions = new Set();
const pendingPromises = new Map();
function isActionPending(key) { return pendingActions.has(key); }
// Botão de submit de um evento de formulário (clique ou Enter).
function actionButton(e) {
  if (!e) return null;
  if (e.submitter) return e.submitter;
  const form = e.target && e.target.querySelector ? e.target : null;
  return form ? form.querySelector('button[type="submit"]') : null;
}
function runOnce(key, button, loadingText, action) {
  if (pendingActions.has(key)) return pendingPromises.get(key);
  pendingActions.add(key);
  // Preserva o conteúdo do botão; loadingText é mantido por compatibilidade.
  const disabledByUs = !!button && !button.disabled;
  if (button) {
    button.disabled = true;
  }
  const promise = (async () => {
    try {
      return await action();
    } finally {
      pendingActions.delete(key);
      pendingPromises.delete(key);
      if (button) {
        if (disabledByUs) button.disabled = false;
      }
    }
  })();
  if (pendingActions.has(key)) pendingPromises.set(key, promise);
  return promise;
}

/* Chamada ao Apps Script. Usa text/plain de propósito: com
     application/json o navegador dispara preflight CORS e o Apps
     Script rejeita a requisição. */
async function api(action, payload = {}) {
  if (!API_URL || API_URL.indexOf('COLE_AQUI') === 0) throw new Error('Configure a API_URL no topo do arquivo (dentro da tag <script>).');
  // Durante a restauração da sessão (F5) falhas de rede são repetidas algumas vezes.
  // Fora disso o comportamento é idêntico ao original (uma única tentativa).
  const maxAttempts = window.petimerRestoringSession ? 3 : 1;
  for (let attempt = 1; ; attempt++) {
    let json;
    try {
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action, payload: Object.assign({ token: authToken }, payload) })
      });
      json = await res.json();
    } catch (netErr) {
      // Falha de rede / resposta não-JSON: NÃO é prova de sessão inválida.
      netErr.petimerTransient = true;
      if (attempt < maxAttempts) { await new Promise(r => setTimeout(r, 1200 * attempt)); continue; }
      throw netErr;
    }
    if (!json.ok) {
      const serverErr = new Error(json.error || 'Erro desconhecido.');
      serverErr.petimerServerRejected = true; // o servidor respondeu e recusou a chamada
      throw serverErr;
    }
    return json.data;
  }
}
