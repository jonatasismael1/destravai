/*
 * Analytics do app: Microsoft Clarity + Google Analytics 4.
 *
 * Carregado por <script src="/analytics.js"> no index.html. Mantemos os loaders
 * fora do bundle (arquivo 'self') para respeitar a CSP do app, que nao permite
 * script inline. Os EVENTOS do funil sao disparados pelo React (src/lib/analytics.ts):
 *   checkout_iniciado, checkout_preenchido, compra_aprovada, compra_recusada.
 *
 * IDs publicos (podem ficar no codigo). O API secret do GA4 (server-side, usado
 * no webhook) NAO fica aqui — fica em env nas Netlify Functions.
 */
;(function () {
  var CLARITY_ID = 'x7k52ebt1b'
  var GA4_ID = 'G-JYVZKMEF8T' // para desligar, troque por 'G-XXXXXXXXXX'

  // ── Microsoft Clarity ──
  ;(function (c, l, a, r, i, t, y) {
    c[a] = c[a] || function () { (c[a].q = c[a].q || []).push(arguments) }
    t = l.createElement(r); t.async = 1; t.src = 'https://www.clarity.ms/tag/' + i
    y = l.getElementsByTagName(r)[0]; y.parentNode.insertBefore(t, y)
  })(window, document, 'clarity', 'script', CLARITY_ID)

  // ── Google Analytics 4 (so liga com ID valido) ──
  var GA4_ENABLED = GA4_ID && GA4_ID.indexOf('G-') === 0 && GA4_ID !== 'G-XXXXXXXXXX'
  window.dataLayer = window.dataLayer || []
  window.gtag = function () { window.dataLayer.push(arguments) }
  if (GA4_ENABLED) {
    var s = document.createElement('script')
    s.async = true
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA4_ID
    document.head.appendChild(s)
    window.gtag('js', new Date())
    window.gtag('config', GA4_ID)
  }
  window.__GA4_ENABLED = GA4_ENABLED

  // ── (Futuro) Meta Pixel ──
  // Quando tiver o ID: inicialize aqui o fbq e libere connect.facebook.net na CSP.
})()
