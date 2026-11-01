import { html } from '../vendor/preact-htm.js'
import { dineroCorto, nombreMesCorto } from '../datos/formato.js'
import { C } from './componentes.js'

/** Gráfico de dona (gastos por categoría). `valores` es una lista de [color, monto]. */
export function Dona({ valores, lado = 110 }) {
  const total = valores.reduce((t, [, v]) => t + v, 0)
  if (total <= 0) return null
  const grosor = lado * 0.16
  const radio = (lado - grosor) / 2
  const largo = 2 * Math.PI * radio
  const hueco = valores.length > 1 ? (2.5 / 360) * largo : 0
  let inicio = 0
  return html`<svg class="dona" width=${lado} height=${lado} viewBox=${`0 0 ${lado} ${lado}`} aria-hidden="true">
    ${valores.map(([color, valor]) => {
      const tramo = (valor / total) * largo
      const trazo = html`<circle cx=${lado / 2} cy=${lado / 2} r=${radio} fill="none" stroke=${color} stroke-width=${grosor}
        stroke-dasharray=${`${Math.max(tramo - hueco, 0.5)} ${largo}`} stroke-dashoffset=${-(inicio + hueco / 2)}
        transform=${`rotate(-90 ${lado / 2} ${lado / 2})`} />`
      inicio += tramo
      return trazo
    })}
  </svg>`
}

const Leyenda = ({ texto, color }) => html`<span class="leyenda"><i style=${{ background: color }}></i>${texto}</span>`

/** Barras de ingresos y gastos de los últimos meses. */
export function BarrasMeses({ meses, ingresos, gastos }) {
  const maximo = Math.max(...ingresos, ...gastos, 1)
  const alto = (valor) => ({ height: `${(valor / maximo) * 100}%` })
  return html`<div class="barras-meses">
    <div class="fila-centro">
      <${Leyenda} texto="Ingresos" color=${C.ingreso} />
      <${Leyenda} texto="Gastos" color=${C.gasto} />
      <small class="crece derecha terciario">máx. ${dineroCorto(maximo)}</small>
    </div>
    <div class="barras" role="img" aria-label="Ingresos y gastos de los últimos meses">
      ${meses.map((_, i) => html`
        <div class="par">
          ${ingresos[i] > 0 && html`<i style=${{ ...alto(ingresos[i]), background: C.ingreso }}></i>`}
          ${gastos[i] > 0 && html`<i style=${{ ...alto(gastos[i]), background: C.gasto }}></i>`}
        </div>`)}
    </div>
    <div class="meses">${meses.map((m) => html`<small>${nombreMesCorto(m)}</small>`)}</div>
  </div>`
}
