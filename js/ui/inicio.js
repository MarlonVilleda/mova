import { html } from '../vendor/preact-htm.js'
import { diasDesdeHoy, mesActual, sumarMes, textoRelativo } from '../datos/fechas.js'
import { dinero, dineroCorto, mesConMayuscula, porcentaje } from '../datos/formato.js'
import { guardarRespaldo } from './ajustes.js'
import {
  BarraProgreso, BotonMova, C, Dato, Encabezado, FilaDatos, FilaMovimiento, Icono, Logo, Monto, Nota, Simbolo, Tarjeta,
  TituloPantalla, Vacio, colorDe, tono,
} from './componentes.js'
import { almacen, marcarPagado, nav, nube } from './estado.js'
import { BarrasMeses } from './graficos.js'

export function InicioPantalla() {
  const hora = new Date().getHours()
  const base = hora < 12 ? 'Buenos días' : hora < 19 ? 'Buenas tardes' : 'Buenas noches'
  const { nombre } = almacen.datos.ajustes
  return html`<div class="pantalla">
    <${TituloPantalla} titulo=${nombre ? `${base}, ${nombre}` : base}><${Logo} /><//>
    <${TarjetaPrincipal} />
    <${AvisoRespaldo} />
    <${TraerDatos} />
    <${AccionesRapidas} />
    <${ResumenDelMes} />
    <${GraficoSeisMeses} />
    <${AlertasSobres} />
    <${ProximosPagos} />
    <${Recientes} />
  </div>`
}

function TarjetaPrincipal() {
  return html`<${Tarjeta} tinte=${C.violeta}>
    <span class="secundario">Dinero disponible</span>
    <${Monto} texto=${dinero(almacen.saldoTotal)} tamano=${38} />
    <hr />
    <${FilaDatos}>
      <${Dato} titulo="Debo" valor=${dineroCorto(almacen.totalQueDebo)} color=${C.deuda} icono="arrow.up.right" />
      <${Dato} titulo="Me deben" valor=${dineroCorto(almacen.totalQueMeDeben)} color=${C.cian} icono="arrow.down.left" />
      <${Dato} titulo="Patrimonio" valor=${dineroCorto(almacen.patrimonio)} icono="sparkle" />
    <//>
  <//>`
}

/** Los datos viven solo en este navegador: se recuerda guardar una copia cada semana. */
function AvisoRespaldo() {
  if (!almacen.debeRespaldar || nube.sesion) return null
  return html`<${Tarjeta} tinte=${C.ambar}>
    <div class="fila-centro">
      <${Simbolo} s="exclamationmark.triangle" color=${C.ambar} />
      <div class="crece">
        <b>Guarda un respaldo</b>
        <${Nota}>Tus datos están solo en este navegador. Una copia en Archivos o Drive los protege si se borran.<//>
      </div>
    </div>
    <${BotonMova} texto="Guardar respaldo" alTocar=${guardarRespaldo} icono="arrow.up.doc" prominente ancho />
  <//>`
}

function TraerDatos() {
  const { movimientos, deudas, metas, sobres, cuentas } = almacen.datos
  if (movimientos.length + deudas.length + metas.length + sobres.length > 0 || cuentas.length > 1) return null
  return html`<${Tarjeta} tinte=${C.azul} alTocar=${() => nav.irA('ajustes')}>
    <div class="fila-centro">
      <${Simbolo} s="arrow.down.doc" color=${C.azul} />
      <div class="crece">
        <b>¿Vienes de iPhone o Android?</b>
        <${Nota}>Restaura tu respaldo de Mova desde Ajustes.<//>
      </div>
      <${Simbolo} s="chevron.right" color=${C.terciario} />
    </div>
  <//>`
}

function AccionesRapidas() {
  const accion = (titulo, simbolo, color, alTocar) => html`
    <button class="accion-rapida" style=${{ '--c': color }} onClick=${alTocar}>
      <span><${Simbolo} s=${simbolo} /></span>
      <small>${titulo}</small>
    </button>`
  const nuevo = (tipo) => () => nav.abrir({ tipo: 'FormMovimiento', movimiento: tipo })
  return html`<div class="acciones-rapidas">
    ${accion('Gasto', 'minus', C.gasto, nuevo('gasto'))}
    ${accion('Ingreso', 'plus', C.ingreso, nuevo('ingreso'))}
    ${accion('Transferir', 'arrow.left.arrow.right', C.cielo, nuevo('transferencia'))}
    ${accion('Deudas', 'creditcard', C.deuda, () => nav.irA('deudas'))}
  </div>`
}

function ResumenDelMes() {
  const mes = mesActual()
  const ingresos = almacen.ingresos(mes)
  const gastos = almacen.gastos(mes)
  const ahorro = ingresos > 0 ? (ingresos - gastos) / ingresos : 0
  return html`<${Tarjeta}>
    <${Encabezado} titulo=${mesConMayuscula(mes)} accion="Ver todo" alAccion=${() => nav.irA('movimientos')} />
    <${FilaDatos}>
      <${Dato} titulo="Ingresos" valor=${dineroCorto(ingresos)} color=${C.ingreso} />
      <${Dato} titulo="Gastos" valor=${dineroCorto(gastos)} color=${C.gasto} />
      <${Dato} titulo="Ahorro" valor=${ingresos > 0 ? porcentaje(ahorro) : '—'} color=${ahorro >= 0 ? C.cian : C.gasto} />
    <//>
    ${ingresos > 0 && html`
      <${BarraProgreso} valor=${gastos / ingresos} color=${gastos > ingresos ? C.gasto : C.cian} />
      <${Nota}>${gastos > ingresos ? 'Este mes gastaste más de lo que ganaste.' : `Has gastado el ${porcentaje(gastos / ingresos)} de tus ingresos.`}<//>`}
  <//>`
}

function GraficoSeisMeses() {
  const meses = [5, 4, 3, 2, 1, 0].map((n) => sumarMes(mesActual(), -n))
  return html`<${Tarjeta}>
    <${Encabezado} titulo="Últimos 6 meses" />
    <${BarrasMeses} meses=${meses} ingresos=${meses.map((m) => almacen.ingresos(m))} gastos=${meses.map((m) => almacen.gastos(m))} />
  <//>`
}

function AlertasSobres() {
  const mes = mesActual()
  const porRepartir = almacen.porAsignar(mes)
  const enRiesgo = almacen.datos.sobres.flatMap((sobre) => {
    const total = almacen.asignado(sobre, mes) + almacen.arrastre(sobre, mes)
    const gastado = almacen.gastado(sobre, mes)
    if (total <= 0 && gastado <= 0) return []
    const uso = total > 0 ? gastado / total : 1
    return uso >= 0.8 ? [{ sobre, uso, queda: almacen.disponible(sobre, mes) }] : []
  })
  return html`
    ${almacen.datos.sobres.length > 0 && porRepartir > 0.005 && html`
      <${Tarjeta} tinte=${C.azul} alTocar=${() => nav.irA('planear')}>
        <div class="fila-centro">
          <${Simbolo} s="square.split.2x2" color=${C.azul} />
          <div class="crece">
            <b>Tienes ${dinero(porRepartir)} por repartir</b>
            <${Nota}>Ponlo en tus sobres para darle un destino.<//>
          </div>
          <${Simbolo} s="chevron.right" color=${C.terciario} />
        </div>
      <//>`}
    ${enRiesgo.length > 0 && html`
      <${Tarjeta} tinte=${C.gasto}>
        <${Encabezado} titulo="Sobres casi vacíos" accion="Ver" alAccion=${() => nav.irA('planear')} />
        ${enRiesgo.map(({ sobre, uso, queda }) => html`
          <div class="fila-centro">
            <${Icono} s=${sobre.icono} color=${colorDe(sobre.color)} lado=${32} />
            <div class="crece columna">
              <div class="fila-centro">
                <span class="crece">${sobre.nombre}</span>
                <small class="fuerte" style=${{ color: uso >= 1 ? C.gasto : C.ambar }}>
                  ${queda < 0 ? `Te pasaste ${dineroCorto(-queda)}` : `Quedan ${dineroCorto(queda)}`}
                </small>
              </div>
              <${BarraProgreso} valor=${uso} color=${uso >= 1 ? C.gasto : C.ambar} alto=${6} />
            </div>
          </div>`)}
      <//>`}`
}

function ProximosPagos() {
  const pagos = almacen.proximosPagos.filter((p) => !p.pagado && diasDesdeHoy(p.fecha) <= 30).slice(0, 5)
  if (pagos.length === 0) return null
  const pagar = (pago) => {
    if (pago.esDeuda) nav.abrir({ tipo: 'FormAbono', deudaId: pago.id })
    else {
      const fijo = almacen.datos.pagosFijos.find((p) => p.id === pago.id)
      if (fijo) marcarPagado(fijo)
    }
  }
  return html`<${Tarjeta}>
    <${Encabezado} titulo="Próximos pagos" accion="Planear" alAccion=${() => nav.irA('planear')} />
    ${pagos.map((pago) => html`
      <div class="fila-centro" key=${pago.id}>
        <${Icono} s=${pago.icono} color=${tono(pago.tono)} lado=${36} />
        <div class="crece corta">
          <b>${pago.nombre}</b>
          <${Nota} color=${diasDesdeHoy(pago.fecha) < 0 ? C.gasto : null}>${textoRelativo(pago.fecha)}<//>
        </div>
        <strong>${dinero(pago.monto)}</strong>
        <${BotonMova} texto="Pagar" alTocar=${() => pagar(pago)} color=${tono(pago.tono)} compacto etiqueta=${`Pagar ${pago.nombre}`} />
      </div>`)}
  <//>`
}

function Recientes() {
  const ultimos = [...almacen.datos.movimientos].sort((a, b) => Date.parse(b.fecha) - Date.parse(a.fecha)).slice(0, 6)
  return html`<${Tarjeta}>
    <${Encabezado} titulo="Recientes" />
    ${ultimos.length === 0
      ? html`<${Vacio} s="sparkles" titulo="Empieza a registrar" texto="Anota tu primer gasto o ingreso con los botones de arriba." />`
      : ultimos.map((m) => html`<${FilaMovimiento} key=${m.id} movimiento=${m} alTocar=${() => nav.abrir({ tipo: 'FormMovimiento', original: m })} />`)}
  <//>`
}
