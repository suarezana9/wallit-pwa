// Service worker de Wallit.
// 1) Atiende "Compartir con Wallit" (Web Share Target): Android manda un POST a /compartir con la foto
//    o el texto; lo guardamos en Cache Storage y redirigimos a la página /compartir, que lo procesa con IA.
// 2) Todo lo demás (caché offline, actualizaciones) lo hace el service worker de Angular, que se importa abajo.
//    Nuestro listener va primero para que ngsw no intente responder ese POST.

const SHARE_CACHE = 'wallit-share';

function shareKey(name) {
  return new URL(`__wallit-share/${name}`, self.registration.scope).href;
}

async function handleShare(request, target) {
  try {
    const form = await request.formData();
    const cache = await caches.open(SHARE_CACHE);
    await Promise.all([cache.delete(shareKey('file')), cache.delete(shareKey('text'))]);

    const file = form.get('receipt');
    if (file && typeof file !== 'string' && file.size > 0) {
      await cache.put(shareKey('file'), new Response(file, { headers: { 'Content-Type': file.type || 'image/jpeg' } }));
    }

    const parts = ['title', 'text', 'url']
      .map((name) => form.get(name))
      .filter((value) => typeof value === 'string' && value.trim())
      .map((value) => value.trim());
    const text = [...new Set(parts)].join('\n');
    if (text) await cache.put(shareKey('text'), new Response(text));
  } catch (error) {
    console.error('[wallit-sw] share', error);
  }
  return Response.redirect(target.href, 303);
}

self.addEventListener('fetch', (event) => {
  const target = new URL('compartir', self.registration.scope);
  const url = new URL(event.request.url);
  if (event.request.method !== 'POST' || url.origin !== target.origin || url.pathname !== target.pathname) return;
  event.stopImmediatePropagation();
  event.respondWith(handleShare(event.request, target));
});

importScripts('./ngsw-worker.js');
