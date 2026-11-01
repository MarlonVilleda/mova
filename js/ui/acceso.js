import { html, useState } from '../vendor/preact-htm.js'
import { C, MensajeError, Segmentos } from './componentes.js'
import { avisar, nube } from './estado.js'
import { FilaBoton, Hoja, SeccionForm, Separador } from './formularios.js'

const correoValido = (c) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c)

/** Se abre desde el enlace del correo «Olvidé mi contraseña». */
export function FormNuevaClave({ token, alCerrar }) {
  const [contrasena, setContrasena] = useState('')
  const [error, setError] = useState(null)
  const guardar = async () => {
    try {
      await nube.cambiarContrasena(token, contrasena)
      alCerrar()
      avisar('Contraseña cambiada. Ya puedes entrar con ella.')
    } catch (e) {
      setError(e.message)
    }
  }
  return html`<${Hoja} titulo="Nueva contraseña" alCerrar=${alCerrar}>
    <${SeccionForm} pie=${html`<${MensajeError} texto=${error} />Debe tener al menos 8 caracteres.`}>
      <input class="fila-texto" type="password" autocomplete="new-password" placeholder="Nueva contraseña" aria-label="Nueva contraseña"
        value=${contrasena} onInput=${(e) => setContrasena(e.target.value)} />
    <//>
    <${SeccionForm}><${FilaBoton} texto="Guardar contraseña" alTocar=${guardar} habilitado=${contrasena.length >= 8} /><//>
  <//>`
}

export function FormAcceso({ alCerrar }) {
  const [modo, setModo] = useState('entrar')
  const [correo, setCorreo] = useState('')
  const [contrasena, setContrasena] = useState('')
  const [error, setError] = useState(null)
  const [enviando, setEnviando] = useState(false)
  const creando = modo === 'crear'
  const correoLimpio = correo.trim()
  const listo = correoValido(correoLimpio) && contrasena.length >= (creando ? 8 : 1) && !enviando

  const accion = async (hacer) => {
    setEnviando(true)
    setError(null)
    try {
      await hacer()
    } catch (e) {
      setError(e.message)
    }
    setEnviando(false)
  }
  const enviar = () => accion(async () => {
    if (creando) {
      const entro = await nube.registrar(correoLimpio, contrasena)
      alCerrar()
      if (!entro) avisar('Te enviamos un correo. Confirma tu cuenta con el enlace y luego entra aquí con tu contraseña.')
    } else {
      await nube.entrar(correoLimpio, contrasena)
      alCerrar()
    }
  })
  const recuperar = () => accion(async () => {
    await nube.recuperar(correoLimpio)
    avisar('Si esa cuenta existe, te enviamos un correo para cambiar la contraseña.')
  })
  const alEnviar = (e) => {
    e.preventDefault()
    if (listo) enviar()
  }

  return html`<${Hoja} titulo=${creando ? 'Crear cuenta' : 'Entrar'} alCerrar=${alCerrar}>
    <${Segmentos} opciones=${['entrar', 'crear']} seleccion=${modo} alCambiar=${setModo} titulo=${(m) => (m === 'crear' ? 'Crear cuenta' : 'Entrar')} />
    <form onSubmit=${alEnviar}>
      <${SeccionForm} pie=${html`<${MensajeError} texto=${error} />${creando ? 'Tu contraseña debe tener al menos 8 caracteres.' : ''}`}>
        <input class="fila-texto" type="email" autocomplete="email" inputmode="email" autocapitalize="none" placeholder="Correo" aria-label="Correo"
          value=${correo} onInput=${(e) => setCorreo(e.target.value)} />
        <${Separador} />
        <input class="fila-texto" type="password" autocomplete=${creando ? 'new-password' : 'current-password'} placeholder="Contraseña" aria-label="Contraseña"
          value=${contrasena} onInput=${(e) => setContrasena(e.target.value)} />
      <//>
    </form>
    <${SeccionForm}>
      <${FilaBoton} texto=${enviando ? 'Un momento…' : creando ? 'Crear cuenta' : 'Entrar'} alTocar=${enviar} habilitado=${listo} color=${C.acento} />
      ${!creando && html`
        <${Separador} />
        <${FilaBoton} texto="Olvidé mi contraseña" alTocar=${recuperar} habilitado=${correoValido(correoLimpio) && !enviando} />`}
    <//>
  <//>`
}
