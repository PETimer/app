/**
 * Escolhe e sincroniza a logo conforme o tema. Depende de brand-logos.js.
 */

(function () {
  var logos = window.PETIMER_BRAND_LOGOS;
  window.getLightBrandLogo = function () { return logos.light; };
  window.getCurrentBrandLogo = function () {
    return document.documentElement.dataset.theme === 'dark' ? logos.dark : logos.light;
  };
  window.syncBrandLogoForTheme = function () {
    var src = window.getCurrentBrandLogo();
    document.querySelectorAll('#brand-logo-source, .brand-logo-img').forEach(function (image) {
      if (image.getAttribute('src') !== src) image.setAttribute('src', src);
    });
    var loader = document.getElementById('petimer-loading-logo');
    if (loader) loader.setAttribute('href', src);
  };
  // Prepara apenas a versão escolhida antes de construir o conteúdo.
  var preload = new Image(); preload.src = window.getCurrentBrandLogo();
  document.addEventListener('DOMContentLoaded', window.syncBrandLogoForTheme);
})();
