/**
 * Restaura o tema (claro/escuro) antes de montar a página, evitando "piscada".
 * Precisa rodar de forma síncrona no <head>.
 */

/* Tema visual isolado: restaura antes de construir qualquer conteúdo da página. */
(function () {
  var theme = 'light';
  try { if (localStorage.getItem('petimer_theme') === 'dark') theme = 'dark'; } catch (_) {}
  document.documentElement.dataset.theme = theme;
  function syncThemeMenu() {
    var dark = document.documentElement.dataset.theme === 'dark';
    var label = document.getElementById('petimer-theme-label');
    var moon = document.getElementById('petimer-theme-moon');
    var sun = document.getElementById('petimer-theme-sun');
    var button = document.getElementById('petimer-theme-toggle');
    if (label) label.textContent = dark ? 'Modo claro' : 'Modo escuro';
    if (moon) moon.toggleAttribute('hidden', dark);
    if (sun) sun.toggleAttribute('hidden', !dark);
    if (button) button.setAttribute('aria-label', dark ? 'Ativar modo claro' : 'Ativar modo escuro');
    if (window.syncBrandLogoForTheme) window.syncBrandLogoForTheme();
  }
  window.togglePetimerTheme = function () {
    var next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem('petimer_theme', next); } catch (_) {}
    syncThemeMenu();
  };
  document.addEventListener('DOMContentLoaded', syncThemeMenu);
  window.addEventListener('storage', function (event) {
    if (event.key === 'petimer_theme') {
      document.documentElement.dataset.theme = event.newValue === 'dark' ? 'dark' : 'light';
      syncThemeMenu();
    }
  });
})();
