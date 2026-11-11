/**
 * Tela de carregamento (overlay) exibida durante chamadas ao servidor.
 */

let petimerLoadingDepth = 0;
let petimerLoadingState = [];
let petimerLoadingFocus = null;
let petimerLoadingBusy = null;
function showPetimerLoading(message = 'Carregando PETimer...') {
  const overlay = document.getElementById('petimer-loading');
  if (petimerLoadingDepth++ > 0) return;
  document.getElementById('petimer-loading-logo').setAttribute('href', getCurrentBrandLogo());
  document.getElementById('petimer-loading-message').textContent = message;
  petimerLoadingFocus = document.activeElement;
  petimerLoadingBusy = document.body.getAttribute('aria-busy');
  petimerLoadingState = Array.from(document.body.children)
    .filter(el => el !== overlay && !['SCRIPT','STYLE'].includes(el.tagName))
    .map(el => ({el, inert: el.inert}));
  petimerLoadingState.forEach(({el}) => { el.inert = true; });
  document.body.setAttribute('aria-busy','true');
  document.body.classList.add('petimer-is-loading');
  overlay.hidden = false;
  overlay.focus({preventScroll:true});
}
function hidePetimerLoading() {
  if (!petimerLoadingDepth || --petimerLoadingDepth > 0) return;
  document.getElementById('petimer-loading').hidden = true;
  petimerLoadingState.forEach(({el,inert}) => { el.inert = inert; });
  petimerLoadingState = [];
  if (petimerLoadingBusy === null) document.body.removeAttribute('aria-busy');
  else document.body.setAttribute('aria-busy', petimerLoadingBusy);
  document.body.classList.remove('petimer-is-loading');
  if (petimerLoadingFocus?.isConnected && !petimerLoadingFocus.closest('[hidden],[inert]')) petimerLoadingFocus.focus({preventScroll:true});
  petimerLoadingFocus = null;
}
