// Registro del service worker. Debe correr desde el documento real, no desde la cáscara.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('./sw.js', { scope: './' })
      .then(function (r) { console.log('SW listo, scope:', r.scope); })
      .catch(function (e) { console.warn('SW no se registró:', e); });
  });
}
