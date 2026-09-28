// Corre desde la cáscara del bundle. El bundle reemplaza <html> completo al desempacar,
// así que las etiquetas de instalación se vuelven a poner cada vez que eso pasa.
(function () {
  var TAGS = [
    ['link', { rel: 'manifest', href: 'manifest.json' }],
    ['meta', { name: 'theme-color', content: '#A53692' }],
    ['meta', { name: 'mobile-web-app-capable', content: 'yes' }],
    ['meta', { name: 'apple-mobile-web-app-capable', content: 'yes' }],
    ['meta', { name: 'apple-mobile-web-app-status-bar-style', content: 'default' }],
    ['meta', { name: 'apple-mobile-web-app-title', content: 'Levantamientos' }],
    ['link', { rel: 'apple-touch-icon', href: 'icon-192.png' }],
    ['link', { rel: 'icon', type: 'image/png', href: 'icon-192.png' }]
  ];
  function asegurar() {
    var head = document.head || document.getElementsByTagName('head')[0];
    if (!head) return;
    TAGS.forEach(function (t) {
      var sel = t[0] + (t[1].rel ? '[rel="' + t[1].rel + '"]' : '[name="' + t[1].name + '"]');
      if (head.querySelector(sel)) return;
      var el = document.createElement(t[0]);
      for (var k in t[1]) el.setAttribute(k, t[1][k]);
      head.appendChild(el);
    });
    if (!document.title || /Bundled/i.test(document.title)) document.title = 'Levantamientos · Diseñarte';
  }
  asegurar();
  new MutationObserver(asegurar).observe(document, { childList: true, subtree: true });

  // Botón "Instalar app" (Android / Chrome / Edge)
  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    window.__instalarApp = e;
    window.dispatchEvent(new Event('lev-instalable'));
  });
  window.addEventListener('appinstalled', function () {
    window.__instalarApp = null;
    window.dispatchEvent(new Event('lev-instalable'));
  });

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('./sw.js', { scope: './' })
        .then(function (r) { r.update().catch(function () {}); console.log('SW listo, scope:', r.scope); })
        .catch(function (e) { console.warn('SW no se registró:', e); });
    });
  }
})();
