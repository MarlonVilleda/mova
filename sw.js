// Guarda la app para que abra sin internet. Con conexión usa siempre la versión publicada,
// así una actualización llega sola; sin conexión (o si tarda demasiado) usa la copia guardada.
const CACHE = 'mova-v1'
const ESPERA_MS = 2500

const ARCHIVOS = [
  './', 'index.html', 'manifest.webmanifest', 'css/estilos.css',
  'iconos/icono-180.png', 'iconos/icono-192.png', 'iconos/icono-512.png',
  'js/principal.js', 'js/vendor/preact-htm.js',
  'js/datos/almacen.js', 'js/datos/biometria.js', 'js/datos/carga.js', 'js/datos/combinar.js', 'js/datos/config.js', 'js/datos/fechas.js',
  'js/datos/formato.js', 'js/datos/modelos.js', 'js/datos/nube.js', 'js/datos/persistencia.js', 'js/datos/validacion.js',
  'js/ui/acceso.js', 'js/ui/ajustes.js', 'js/ui/archivos.js', 'js/ui/bloqueo.js', 'js/ui/categorias.js', 'js/ui/componentes.js',
  'js/ui/dispositivos.js', 'js/ui/deudas.js', 'js/ui/estado.js',
  'js/ui/formularios.js', 'js/ui/graficos.js', 'js/ui/inicio.js', 'js/ui/movimientos.js', 'js/ui/planear.js',
  'js/ui/raiz.js', 'js/ui/trazos.js',
]

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ARCHIVOS)).then(() => self.skipWaiting()))
})

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const nombre of await caches.keys()) if (nombre !== CACHE) await caches.delete(nombre)
    await self.clients.claim()
  })())
})

async function responder(pedido) {
  const cache = await caches.open(CACHE)
  // GitHub Pages deja guardar cada archivo 10 minutos; `no-cache` pregunta siempre si hay versión nueva.
  const red = fetch(pedido.url, { cache: 'no-cache' }).then((respuesta) => {
    if (respuesta.ok) cache.put(pedido, respuesta.clone())
    return respuesta
  })
  const guardada = await cache.match(pedido)
  if (!guardada) return red
  const limite = new Promise((resolver) => { setTimeout(() => resolver(guardada), ESPERA_MS) })
  return Promise.race([red.catch(() => guardada), limite])
}

self.addEventListener('fetch', (e) => {
  if (e.request.method === 'GET' && new URL(e.request.url).origin === location.origin) e.respondWith(responder(e.request))
})
