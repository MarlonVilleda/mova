import { html, render } from './vendor/preact-htm.js'
import { pedirAlmacenamientoPersistente } from './datos/persistencia.js'
import { almacen, avisar, bloqueo, nav, nube, refrescar } from './ui/estado.js'
import { PantallaCarga, Raiz } from './ui/raiz.js'

const raiz = document.getElementById('app')

render(html`<${PantallaCarga} />`, raiz)
await almacen.iniciar()
await nube.iniciar().catch(() => {})
await bloqueo.iniciar().catch(() => {})
raiz.textContent = ''

// Los enlaces de los correos de Supabase vuelven aquí con el resultado después del #.
function atenderEnlaceDeCorreo() {
  const retorno = new URLSearchParams(location.hash.slice(1))
  if (!retorno.has('access_token') && !retorno.has('error')) return
  history.replaceState(null, '', location.pathname)
  if (retorno.has('error')) avisar('Ese enlace venció o ya se usó. Intenta entrar con tu correo y contraseña; si no puedes, pide uno nuevo.')
  else if (retorno.get('type') === 'recovery') nav.abrir({ tipo: 'FormNuevaClave', token: retorno.get('access_token') })
  else avisar('Correo confirmado. Ahora entra con tu correo y contraseña en Ajustes.')
}

render(html`<${Raiz} alMontar=${atenderEnlaceDeCorreo} />`, raiz)

// Guarda lo pendiente al salir: en el teléfono la app puede cerrarse sin avisar.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') {
    almacen.guardarAhora()
    bloqueo.alOcultar()
  } else {
    if (bloqueo.alMostrar()) refrescar()
    nube.sincronizar()
  }
})
addEventListener('pagehide', () => almacen.guardarAhora())
addEventListener('online', () => nube.sincronizar())

// Si Mova está abierta en dos pestañas, la otra se actualiza para no escribir encima de estos cambios.
const canal = 'BroadcastChannel' in globalThis ? new BroadcastChannel('mova') : null
if (canal) canal.onmessage = () => almacen.recargar()
almacen.despuesDeGuardar = () => {
  canal?.postMessage('guardado')
  nube.alGuardar()
}

nube.sincronizar()

pedirAlmacenamientoPersistente()

if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js')
