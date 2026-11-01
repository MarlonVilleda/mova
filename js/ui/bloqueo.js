import { html, useEffect, useState } from '../vendor/preact-htm.js'
import { BotonMova, Logo, MensajeError, Nota } from './componentes.js'
import { bloqueo, dispositivo, nube, refrescar } from './estado.js'

/** Safari solo abre Face ID tras un toque; en los demás se pide al abrir. */
const pedirAlAbrir = !['iphone', 'ipad'].includes(dispositivo.plataforma)

/** Bloqueado no se dibuja nada más: así ningún dato queda a la vista. */
export function PantallaBloqueo() {
  const [error, setError] = useState(null)
  const [conContrasena, setConContrasena] = useState(false)
  const [contrasena, setContrasena] = useState('')
  const [intentando, setIntentando] = useState(false)

  const intentar = async (hacer) => {
    if (intentando) return
    setIntentando(true)
    setError(null)
    try {
      await hacer()
      refrescar()
    } catch (e) {
      setError(e.message)
    }
    setIntentando(false)
  }
  const desbloquear = () => intentar(() => bloqueo.desbloquear())
  // La contraseña se comprueba con Supabase, por eso necesita internet. Si el desbloqueo falló, se quita para activarlo de nuevo.
  const entrar = () => intentar(async () => {
    await nube.entrar(nube.sesion.correo, contrasena)
    await bloqueo.olvidar()
  })
  useEffect(() => { if (pedirAlAbrir) desbloquear() }, [])

  return html`<div class="bloqueo">
    <div class="bloqueo-logo"><${Logo} tam=${64} /></div>
    <h1>Mova</h1>
    <p class="secundario">Tus datos están protegidos</p>
    ${conContrasena && html`
      <form class="bloqueo-clave" onSubmit=${(e) => { e.preventDefault(); if (contrasena) entrar() }}>
        <${Nota}>${nube.sesion?.correo}<//>
        <input class="fila-texto" type="password" autocomplete="current-password" placeholder="Contraseña" aria-label="Contraseña"
          value=${contrasena} onInput=${(e) => setContrasena(e.target.value)} />
      </form>`}
    <${MensajeError} texto=${error} />
    ${conContrasena
      ? html`<${BotonMova} texto="Entrar" alTocar=${entrar} prominente habilitado=${Boolean(contrasena) && !intentando} />`
      : html`<${BotonMova} texto=${`Desbloquear con ${dispositivo.metodo}`} alTocar=${desbloquear} icono="shield" prominente habilitado=${!intentando} />`}
    ${nube.sesion && html`
      <button class="enlace" onClick=${() => { setConContrasena(!conContrasena); setError(null) }}>
        ${conContrasena ? `Usar ${dispositivo.metodo}` : 'Usar mi contraseña'}
      </button>`}
  </div>`
}
