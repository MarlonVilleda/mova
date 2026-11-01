import { useEffect, useRef, html } from '../vendor/preact-htm.js'
import { deIndice, Tonos } from '../datos/modelos.js'
import { dinero, nombreMesAnio, simboloMoneda } from '../datos/formato.js'
import { mesActual, sumarMes } from '../datos/fechas.js'
import { saneadoComoMonto } from '../datos/validacion.js'
import { almacen, mostrarMenu } from './estado.js'
import { TRAZOS } from './trazos.js'

/** Color de la paleta: cambia solo entre modo claro y oscuro. */
export const tono = (nombre) => `var(--t-${nombre})`
/** Color elegido por índice (cuentas, deudas, metas, sobres). */
export const colorDe = (indice) => tono(deIndice(indice))
export const C = {
  acento: tono(Tonos.acento), cian: tono(Tonos.cian), ingreso: tono(Tonos.ingreso), gasto: tono(Tonos.gasto),
  deuda: tono(Tonos.deuda), azul: tono('azul'), violeta: tono('violeta'), cielo: tono('cielo'), ambar: tono('ambar'),
  texto: 'var(--texto)', secundario: 'var(--secundario)', terciario: 'var(--terciario)',
}

export function Simbolo({ s, tam = 20, color, titulo }) {
  const trazo = Object.hasOwn(TRAZOS, s) ? TRAZOS[s] : TRAZOS.circle
  return html`<svg class="simbolo" width=${tam} height=${tam} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style=${color ? { color } : null}
    role=${titulo ? 'img' : null} aria-label=${titulo} aria-hidden=${titulo ? null : 'true'}
    dangerouslySetInnerHTML=${{ __html: trazo }}></svg>`
}

let logos = 0

/** El símbolo de Mova en vectores. Cada logo necesita ids propios: un degradado dentro de un logo oculto no se dibuja. */
export function Logo({ tam = 34 }) {
  const numero = useRef(++logos).current
  const barra = (nombre, x1, y1, x2, y2, colores) => {
    const id = `logo-${numero}-${nombre}`
    return html`
      <linearGradient id=${id} gradientUnits="userSpaceOnUse" x1=${x1} y1=${y1} x2=${x2} y2=${y2}>
        ${colores.map((c, i) => html`<stop offset=${i / (colores.length - 1)} stop-color=${c} />`)}
      </linearGradient>
      <line x1=${x1} y1=${y1} x2=${x2} y2=${y2} stroke=${`url(#${id})`} stroke-width="70" stroke-linecap="round" />`
  }
  return html`<svg width=${tam} height=${tam} viewBox="0 0 400 400" role="img" aria-label="Mova">
    ${barra('a', 62, 282, 150, 122, ['#0A47F2', '#2A6BFF'])}
    ${barra('b', 258, 122, 346, 282, ['#07AEB4', '#2CC9C6'])}
    ${barra('c', 170, 282, 258, 122, ['#005A72', '#0193A3', '#02AFB5'])}
  </svg>`
}

export function Tarjeta({ tinte, alTocar, clase = '', children }) {
  const estilo = tinte ? { '--tinte': tinte } : null
  const clases = `tarjeta ${tinte ? 'con-tinte' : ''} ${alTocar ? 'pulsable' : ''} ${clase}`
  if (!alTocar) return html`<section class=${clases} style=${estilo}>${children}</section>`
  const alTeclear = (e) => {
    if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault()
      alTocar()
    }
  }
  return html`<section class=${clases} style=${estilo} role="button" tabindex="0" onClick=${alTocar} onKeyDown=${alTeclear}>${children}</section>`
}

/** Símbolo de línea fina sobre un círculo de color suave. */
export const Icono = ({ s, color, lado = 40 }) => html`
  <span class="icono" style=${{ '--c': color, width: `${lado}px`, height: `${lado}px` }}>
    <${Simbolo} s=${s} tam=${Math.round(lado * 0.46)} />
  </span>`

export const Encabezado = ({ titulo, accion, alAccion }) => html`
  <div class="fila-centro">
    <h3 class="crece">${titulo}</h3>
    ${accion && html`<button class="enlace" onClick=${(e) => { e.stopPropagation(); alAccion() }}>${accion}</button>`}
  </div>`

export function BarraProgreso({ valor, color = C.acento, alto = 8 }) {
  const ancho = Math.min(Math.max(valor, 0), 1) * 100
  return html`<div class="barra" style=${{ height: `${alto}px` }}>
    ${valor > 0 && html`<div style=${{ width: `max(${ancho}%, ${alto}px)`, background: color }}></div>`}
  </div>`
}

export function Anillo({ valor, color, grosor = 10, lado = 110 }) {
  const radio = (lado - grosor) / 2
  const largo = 2 * Math.PI * radio
  const fraccion = Math.min(Math.max(valor, 0), 1)
  const circulo = (extra) => html`<circle cx=${lado / 2} cy=${lado / 2} r=${radio} fill="none" stroke-width=${grosor} ...${extra} />`
  return html`<svg class="anillo" width=${lado} height=${lado} viewBox=${`0 0 ${lado} ${lado}`} aria-hidden="true">
    ${circulo({ stroke: 'var(--pista)' })}
    ${fraccion > 0 && circulo({
      stroke: color, 'stroke-linecap': 'round', 'stroke-dasharray': `${fraccion * largo} ${largo}`,
      transform: `rotate(-90 ${lado / 2} ${lado / 2})`,
    })}
  </svg>`
}

/** Dato pequeño con título y valor (ej. "Ingresos  $1,200"). */
export const Dato = ({ titulo, valor, color, icono }) => html`
  <div class="dato">
    <small>${icono && html`<${Simbolo} s=${icono} tam=${12} />`} ${titulo}</small>
    <strong style=${color ? { color } : null}>${valor}</strong>
  </div>`

export const FilaDatos = ({ children }) => html`<div class="fila-datos">${children}</div>`

export function Segmentos({ opciones, seleccion, alCambiar, titulo }) {
  return html`<div class="segmentos" role="tablist">
    ${opciones.map((o) => html`
      <button role="tab" aria-selected=${o === seleccion} class=${o === seleccion ? 'activo' : ''} onClick=${() => alCambiar(o)}>${titulo(o)}</button>`)}
  </div>`
}

export function SelectorMes({ mes, alCambiar }) {
  const puede = mes < sumarMes(mesActual(), 12)
  return html`<div class="selector-mes">
    <button aria-label="Mes anterior" onClick=${() => alCambiar(sumarMes(mes, -1))}><${Simbolo} s="chevron.left" /></button>
    <strong>${nombreMesAnio(mes)}</strong>
    <button aria-label="Mes siguiente" disabled=${!puede} onClick=${() => alCambiar(sumarMes(mes, 1))}><${Simbolo} s="chevron.right" /></button>
  </div>`
}

/** Campo grande para escribir montos. */
export function CampoMonto({ texto, alCambiar, color = C.texto, enfocar = !texto, etiqueta = 'Monto' }) {
  const campo = useRef(null)
  useEffect(() => { if (enfocar) campo.current?.focus() }, [])
  const alEscribir = (e) => {
    const limpio = saneadoComoMonto(e.target.value)
    e.target.value = limpio
    alCambiar(limpio)
  }
  return html`<div class="campo-monto">
    <span>${simboloMoneda()}</span>
    <input ref=${campo} type="text" inputmode="decimal" autocomplete="off" placeholder="0" aria-label=${etiqueta}
      value=${texto} onInput=${alEscribir} style=${{ color }} />
  </div>`
}

export function FilaMovimiento({ movimiento: m, alTocar }) {
  const categoria = almacen.categoria(m.categoria)
  const detalle = m.tipo === 'transferencia'
    ? `${almacen.cuenta(m.cuentaID)?.nombre ?? '?'} → ${almacen.cuenta(m.cuentaDestinoID)?.nombre ?? '?'}`
    : [categoria.nombre, almacen.cuenta(m.cuentaID)?.nombre].filter(Boolean).join(' · ')
  const color = m.tipo === 'ingreso' ? C.ingreso : m.tipo === 'transferencia' ? C.cielo : C.texto
  return html`<button class="fila-movimiento" onClick=${alTocar}>
    <${Icono} s=${categoria.icono} color=${tono(categoria.tono)} />
    <span class="crece corta">
      <b>${m.nota || categoria.nombre}</b>
      <small>${detalle}</small>
    </span>
    <strong style=${{ color }}>${m.tipo === 'gasto' ? '−' : ''}${dinero(m.monto)}</strong>
  </button>`
}

/** Mensaje para listas vacías. */
export const Vacio = ({ s, titulo, texto }) => html`
  <div class="vacio">
    <${Simbolo} s=${s} tam=${34} color=${C.acento} />
    <h3>${titulo}</h3>
    <p>${texto}</p>
  </div>`

export function SelectorColor({ indice, alCambiar }) {
  return html`<div class="selector-color">
    ${Tonos.elegibles.map((t, i) => html`
      <button aria-label=${`Color ${t}`} aria-pressed=${indice === i} class=${indice === i ? 'activo' : ''}
        style=${{ background: tono(t) }} onClick=${() => alCambiar(i)}></button>`)}
  </div>`
}

export function MensajeError({ texto }) {
  if (!texto) return null
  return html`<div class="error" role="alert"><${Simbolo} s="exclamationmark.triangle" tam=${14} /> ${texto}</div>`
}

/** Botón en forma de cápsula (prominente = relleno de color). */
export function BotonMova({ texto, alTocar, icono, prominente, color = C.acento, habilitado = true, compacto, ancho, etiqueta }) {
  const clases = `boton ${prominente ? 'prominente' : ''} ${compacto ? 'compacto' : ''} ${ancho ? 'ancho' : ''}`
  const alPulsar = (e) => {
    e.stopPropagation()
    alTocar()
  }
  return html`<button class=${clases} style=${{ '--c': color }} disabled=${!habilitado} aria-label=${etiqueta} onClick=${alPulsar}>
    ${icono && html`<${Simbolo} s=${icono} tam=${compacto ? 16 : 18} />`}${texto}
  </button>`
}

/** Botón de tres puntos que abre las acciones de un elemento. */
export function BotonOpciones({ titulo, opciones }) {
  const abrir = (e) => {
    e.stopPropagation()
    mostrarMenu(titulo, opciones)
  }
  return html`<button class="boton-puntos" aria-label=${`Opciones de ${titulo}`} onClick=${abrir}><${Simbolo} s="ellipsis" /></button>`
}

export const Nota = ({ color, children }) => html`<p class="nota" style=${color ? { color } : null}>${children}</p>`

export const TituloPantalla = ({ titulo, children }) => html`
  <header class="titulo-pantalla"><h1 class="crece">${titulo}</h1>${children}</header>`

export const BotonCircular = ({ s, descripcion, alTocar }) => html`
  <button class="boton-circular" aria-label=${descripcion} onClick=${alTocar}><${Simbolo} s=${s} color=${C.acento} /></button>`

export const Monto = ({ texto, color, tamano = 34 }) => html`
  <div class="monto" style=${{ fontSize: `${tamano}px`, color }}>${texto}</div>`
