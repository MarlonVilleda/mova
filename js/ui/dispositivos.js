import { html, useEffect, useState } from '../vendor/preact-htm.js'
import { fechaLocal } from '../datos/fechas.js'
import { textoFecha } from '../datos/formato.js'
import { C, Icono, MensajeError, Nota, Vacio } from './componentes.js'
import { avisar, confirmar, nube } from './estado.js'
import { FilaBoton, Hoja, SeccionForm, Separador } from './formularios.js'

const ICONOS = { iphone: 'iphone', ipad: 'iphone', android: 'iphone', mac: 'laptopcomputer', windows: 'laptopcomputer', otro: 'circle.grid.2x2' }

export function Dispositivos({ alCerrar }) {
  const [lista, setLista] = useState(null)
  const [error, setError] = useState(null)
  const cargar = () => nube.dispositivos().then(setLista).catch((e) => setError(e.message))
  useEffect(() => { cargar() }, [])

  const cerrarOtros = () => confirmar(
    '¿Cerrar sesión en los demás?',
    'Úsalo si perdiste un dispositivo. Dejará de sincronizar enseguida o en menos de una hora, y lo que ya tenga guardado seguirá en él.',
    'Cerrar sesión',
    async () => {
      try {
        await nube.cerrarOtrosDispositivos()
        await cargar()
        avisar('Listo. Solo este dispositivo sigue conectado.')
      } catch (e) {
        avisar(e.message)
      }
    },
  )

  return html`<${Hoja} titulo="Mis dispositivos" alCerrar=${alCerrar} textoCerrar="Atrás">
    <${MensajeError} texto=${error} />
    ${lista == null && !error && html`<${Nota}>Cargando…<//>`}
    ${lista?.length === 0 && html`<${Vacio} s="iphone" titulo="Sin dispositivos" texto="Aparecerán aquí cuando entres con tu cuenta." />`}
    ${lista?.length > 0 && html`
      <${SeccionForm}>
        ${lista.map((d, i) => html`
          ${i > 0 && html`<${Separador} />`}
          <div class="fila" key=${d.id}>
            <${Icono} s=${ICONOS[d.plataforma] ?? 'circle.grid.2x2'} color=${C.acento} lado=${36} />
            <span class="crece corta">
              <b>${d.nombre}${d.id === nube.dispositivoId ? ' · este' : ''}</b>
              <small>${d.bloqueo ? `Se abre con ${d.metodo}` : 'Sin bloqueo'} · ${textoFecha(fechaLocal(d.ultimo_acceso))}</small>
            </span>
          </div>`)}
      <//>
      <${SeccionForm}>
        <${FilaBoton} texto="Cerrar sesión en los demás" alTocar=${cerrarOtros} color=${C.gasto} habilitado=${lista.length > 1} />
      <//>`}
  <//>`
}
