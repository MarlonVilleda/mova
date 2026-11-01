import { html } from '../vendor/preact-htm.js'
import { textoFecha } from '../datos/formato.js'
import { saneadoComoMonto } from '../datos/validacion.js'
import { C, Icono, Simbolo } from './componentes.js'

/** Pantalla de formulario: Cancelar a la izquierda, título al centro y Guardar a la derecha. */
export function Hoja({ titulo, alCerrar, puedeGuardar = true, alGuardar, textoCerrar = 'Cancelar', children }) {
  const guardar = () => {
    alGuardar()
    alCerrar()
  }
  return html`<div class="hoja-fondo">
    <div class="hoja" role="dialog" aria-modal="true" aria-label=${titulo}>
      <header class="hoja-barra">
        <button class="enlace" onClick=${alCerrar}>${textoCerrar}</button>
        <h2>${titulo}</h2>
        ${alGuardar
          ? html`<button class="enlace fuerte" disabled=${!puedeGuardar} onClick=${guardar}>Guardar</button>`
          : html`<span class="relleno"></span>`}
      </header>
      <div class="hoja-cuerpo">${children}</div>
    </div>
  </div>`
}

/** Grupo de filas con título y pie opcionales. */
export const SeccionForm = ({ titulo, pie, children }) => html`
  <section class="seccion">
    ${titulo && html`<h4>${titulo}</h4>`}
    <div class="seccion-caja">${children}</div>
    ${pie && html`<div class="seccion-pie">${pie}</div>`}
  </section>`

export const Separador = () => html`<hr />`

/** Campo de texto simple de una fila. */
export function FilaTexto({ valor, alCambiar, placeholder, maximo, multilinea, grande }) {
  const propiedades = {
    value: valor, placeholder, maxLength: maximo, autocapitalize: 'sentences', 'aria-label': placeholder,
    onInput: (e) => alCambiar(e.target.value),
  }
  return multilinea
    ? html`<textarea class="fila-texto" rows="3" ...${propiedades}></textarea>`
    : html`<input class=${`fila-texto ${grande ? 'grande' : ''}`} type="text" ...${propiedades} />`
}

/** Etiqueta a la izquierda y monto a la derecha (ej. "Cuota mensual    Opcional"). */
export function FilaMontoCorto({ etiqueta, valor, alCambiar, placeholder = 'Opcional' }) {
  const alEscribir = (e) => {
    const limpio = saneadoComoMonto(e.target.value)
    e.target.value = limpio
    alCambiar(limpio)
  }
  return html`<label class="fila">
    ${etiqueta && html`<span class="crece">${etiqueta}</span>`}
    <input class="monto-corto" type="text" inputmode="decimal" autocomplete="off" value=${valor} placeholder=${placeholder}
      aria-label=${etiqueta || 'Monto'} onInput=${alEscribir} />
  </label>`
}

export const FilaInterruptor = ({ etiqueta, valor, alCambiar, simbolo }) => html`
  <label class="fila">
    ${simbolo && html`<${Simbolo} s=${simbolo} color=${C.acento} />`}
    <span class="crece">${etiqueta}</span>
    <input class="interruptor" type="checkbox" role="switch" checked=${valor} onChange=${(e) => {
      const nuevo = e.target.checked
      // El interruptor solo cambia si el valor cambia de verdad (activar el bloqueo puede cancelarse).
      e.target.checked = valor
      alCambiar(nuevo)
    }} />
  </label>`

/** Fila que muestra el valor elegido y abre la lista nativa con las opciones. */
export function FilaSelector({ etiqueta, valor, opciones, texto, alCambiar, simbolo }) {
  return html`<label class="fila fila-selector">
    ${simbolo && html`<${Simbolo} s=${simbolo} color=${C.acento} />`}
    <span class="crece">${etiqueta}</span>
    <span class="valor">${texto(valor)}</span>
    <${Simbolo} s="chevron.down" tam=${18} color=${C.terciario} />
    <select aria-label=${etiqueta} value=${opciones.indexOf(valor)} onChange=${(e) => alCambiar(opciones[Number(e.target.value)])}>
      ${opciones.map((o, i) => html`<option value=${i}>${texto(o)}</option>`)}
    </select>
  </label>`
}

/** Fila con fecha que abre el calendario del sistema. */
export function FilaFecha({ etiqueta, fecha, alCambiar, minimo, maximo }) {
  const alElegir = (e) => {
    const nueva = e.target.value
    // Safari permite elegir fuera de min/max: se ignora y se vuelve a la fecha anterior.
    if (!nueva || (minimo && nueva < minimo) || (maximo && nueva > maximo)) {
      e.target.value = fecha
      return
    }
    alCambiar(nueva)
  }
  return html`<label class="fila">
    <span class="crece">${etiqueta}</span>
    <span class="fecha">
      ${textoFecha(fecha)}
      <input type="date" aria-label=${etiqueta} value=${fecha} min=${minimo} max=${maximo} onChange=${alElegir} />
    </span>
  </label>`
}

/** Botón de texto que ocupa toda la fila (ej. "Eliminar"). */
export const FilaBoton = ({ texto, alTocar, color = C.acento, simbolo, habilitado = true }) => html`
  <button class="fila fila-boton" disabled=${!habilitado} style=${{ color: habilitado ? color : C.terciario }} onClick=${alTocar}>
    ${simbolo && html`<${Simbolo} s=${simbolo} />`}${texto}
  </button>`

/** Fila de detalle: icono, título y valor. */
export const FilaInfo = ({ simbolo, titulo, valor }) => html`
  <div class="fila-info">
    <${Simbolo} s=${simbolo} tam=${16} />
    <span class="crece">${titulo}</span>
    <b>${valor}</b>
  </div>`

/** Selector de icono en cuadrícula. */
export const SelectorIcono = ({ iconos, elegido, color, alCambiar }) => html`
  <div class="selector-icono">
    ${iconos.map((s) => html`
      <button aria-label=${s} aria-pressed=${s === elegido} class=${s === elegido ? 'activo' : ''} style=${{ '--c': color }} onClick=${() => alCambiar(s)}>
        <${Simbolo} s=${s} />
      </button>`)}
  </div>`

/** Botón de categoría con icono y nombre (para las cuadrículas de categorías). */
export const BotonCategoria = ({ simbolo, nombre, color, elegido, alTocar, atenuar }) => html`
  <button class=${`boton-categoria ${elegido ? 'activo' : ''} ${atenuar && !elegido ? 'atenuado' : ''}`} style=${{ '--c': color }}
    aria-pressed=${elegido} onClick=${alTocar}>
    <${Icono} s=${simbolo} color=${color} lado=${44} />
    <span>${nombre}</span>
  </button>`

export const Cuadricula = ({ children }) => html`<div class="cuadricula">${children}</div>`
