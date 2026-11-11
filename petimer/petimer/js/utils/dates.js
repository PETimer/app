/**
 * Utilitários de data usados em vários módulos (carregado antes deles,
 * pois é chamado já na inicialização de tracker/entry-form.js).
 */

function localDateStr(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
