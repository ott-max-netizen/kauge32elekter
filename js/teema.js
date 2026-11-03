/* Kauge 32 · teema ja raamimise kaitse enne esimest joonistamist (laaditakse <head>-is ilma defer'ita, kõigil lehtedel).
 *
 * 1. Raamimise kaitse: GitHub Pages ei luba saata X-Frame-Options ega CSP frame-ancestors päist (meta-sildis frame-ancestors
 *    ei toimi), seega ei näidata lehte teise saidi raamis (iframe) – see takistab „clickjacking“-it, kus nähtamatu leht
 *    asetatakse võõra nupu alla. Leht peidetakse ja võimalusel avatakse see kogu aknas. Liivakastis ilma skriptideta raamis
 *    ei käivitu ka lehe kood: siis on näha ainult tühi raam (andmed on krüpteeritud ja avamisvaade peidetud).
 * 2. Teema: <html data-theme> on alati "light" või "dark", ka „auto“ korral süsteemi eelistuse järgi (võti kauge32_theme,
 *    sama reegel mis lehtede applyTheme-is), seega on tume tokenikomplekt failis css/common.css ainult kahes plokis.
 */
(function () {
  'use strict';
  if (window.top !== window.self) {
    document.documentElement.style.display = 'none';
    try {
      window.top.location.replace(window.location.href);
    } catch (error) { /* teise saidi raam ei luba ülemist akent muuta: leht jääb peidetuks */ }
    return;
  }
  let theme = 'auto';
  try {
    theme = localStorage.getItem('kauge32_theme') || 'auto';
  } catch (error) { /* salvestusruum keelatud: süsteemi teema */ }
  const dark = theme === 'dark' || (theme !== 'light' && Boolean(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches));
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
})();
