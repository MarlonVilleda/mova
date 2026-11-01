import { html, useState } from '../vendor/preact-htm.js'
import { comoMomento, fechaLocal, hoy, mesActual, sumarAnios } from '../datos/fechas.js'
import { dinero, dineroCorto, porcentaje, textoDiaLargo, textoEditable } from '../datos/formato.js'
import { TipoMovimiento, efectoNeto, nuevoId } from '../datos/modelos.js'
import { Limites, comoMonto, primerError } from '../datos/validacion.js'
import {
  BotonCircular, C, CampoMonto, Dato, FilaDatos, FilaMovimiento, MensajeError, Segmentos, SelectorMes, Simbolo, Tarjeta,
  TituloPantalla, Vacio, tono,
} from './componentes.js'
import { almacen, confirmar, nav } from './estado.js'
import { BotonCategoria, Cuadricula, FilaBoton, FilaFecha, FilaSelector, FilaTexto, Hoja, SeccionForm, Separador } from './formularios.js'
import { Dona } from './graficos.js'

const FILTROS = {
  todos: { titulo: 'Todos', incluye: () => true },
  gastos: { titulo: 'Gastos', incluye: (m) => m.tipo === 'gasto' },
  ingresos: { titulo: 'Ingresos', incluye: (m) => m.tipo === 'ingreso' },
  transferencias: { titulo: 'Transf.', incluye: (m) => m.tipo === 'transferencia' },
}

export function MovimientosPantalla() {
  const [mes, setMes] = useState(mesActual)
  const [filtro, setFiltro] = useState('todos')
  const [busqueda, setBusqueda] = useState('')

  const buscado = busqueda.trim().toLowerCase()
  const lista = almacen.movimientos(mes).filter((m) => FILTROS[filtro].incluye(m) && (!buscado
    || m.nota.toLowerCase().includes(buscado) || almacen.categoria(m.categoria).nombre.toLowerCase().includes(buscado)))

  const porDia = new Map()
  for (const m of lista) {
    const dia = fechaLocal(m.fecha)
    if (!porDia.has(dia)) porDia.set(dia, [])
    porDia.get(dia).push(m)
  }
  const dias = [...porDia].sort((a, b) => (a[0] < b[0] ? 1 : -1))

  return html`<div class="pantalla">
    <${TituloPantalla} titulo="Movimientos">
      <${BotonCircular} s="plus" descripcion="Nuevo movimiento"
        alTocar=${() => nav.abrir({ tipo: 'FormMovimiento', fecha: mes === mesActual() ? hoy() : `${mes}-01` })} />
    <//>
    <label class="buscador">
      <${Simbolo} s="magnifyingglass" tam=${18} color=${C.secundario} />
      <input type="search" value=${busqueda} maxLength="60" placeholder="Buscar por nota o categoría" aria-label="Buscar"
        onInput=${(e) => setBusqueda(e.target.value)} />
    </label>
    <${SelectorMes} mes=${mes} alCambiar=${setMes} />
    <${ResumenMes} mes=${mes} />
    <${Segmentos} opciones=${Object.keys(FILTROS)} seleccion=${filtro} alCambiar=${setFiltro} titulo=${(f) => FILTROS[f].titulo} />
    ${lista.length === 0 && html`<${Vacio} s="tray" titulo="Sin movimientos" texto="No hay nada registrado aquí todavía." />`}
    ${dias.map(([dia, movimientos]) => {
      const neto = movimientos.reduce((t, m) => t + efectoNeto(m), 0)
      return html`<div class="grupo-dia" key=${dia}>
        <div class="dia"><small class="crece">${textoDiaLargo(dia)}</small><small style=${{ color: neto >= 0 ? C.ingreso : C.secundario }}>${dinero(neto)}</small></div>
        ${movimientos.map((m) => html`
          <div class="caja-movimiento" key=${m.id}>
            <${FilaMovimiento} movimiento=${m} alTocar=${() => nav.abrir({ tipo: 'FormMovimiento', original: m })} />
          </div>`)}
      </div>`
    })}
  </div>`
}

function ResumenMes({ mes }) {
  const categorias = almacen.gastosPorCategoria(mes)
  const gastos = almacen.gastos(mes)
  const ingresos = almacen.ingresos(mes)
  return html`<${Tarjeta}>
    <${FilaDatos}>
      <${Dato} titulo="Ingresos" valor=${dineroCorto(ingresos)} color=${C.ingreso} />
      <${Dato} titulo="Gastos" valor=${dineroCorto(gastos)} color=${C.gasto} />
      <${Dato} titulo="Balance" valor=${dineroCorto(ingresos - gastos)} />
    <//>
    ${categorias.length > 0 && html`
      <div class="resumen-categorias">
        <${Dona} valores=${categorias.map(([c, total]) => [tono(almacen.categoria(c).tono), total])} />
        <ul>
          ${categorias.slice(0, 5).map(([c, total]) => html`
            <li key=${c}>
              <i style=${{ background: tono(almacen.categoria(c).tono) }}></i>
              <span class="crece">${almacen.categoria(c).nombre}</span>
              <span class="secundario">${porcentaje(total / Math.max(gastos, 1))}</span>
            </li>`)}
        </ul>
      </div>`}
  <//>`
}

// MARK: - Formulario

export function FormMovimiento({ original, tipoInicial = 'gasto', fechaInicial = hoy(), alCerrar }) {
  const { cuentas, sobres } = almacen.datos
  const [tipo, setTipo] = useState(original?.tipo ?? tipoInicial)
  const [montoTexto, setMontoTexto] = useState(original ? textoEditable(original.monto) : '')
  const [categoria, setCategoria] = useState(original?.categoria ?? almacen.categoriasDe(tipo)[0])
  const [cuentaID, setCuentaID] = useState(original ? original.cuentaID ?? null : cuentas[0]?.id ?? null)
  const [destinoID, setDestinoID] = useState(() => {
    if (original?.cuentaDestinoID) return original.cuentaDestinoID
    return tipo === 'transferencia' ? cuentas.find((c) => c.id !== cuentaID)?.id ?? null : null
  })
  const [sobreID, setSobreID] = useState(original?.sobreID ?? null)
  const [nota, setNota] = useState(original?.nota ?? '')
  const [fecha, setFecha] = useState(original ? fechaLocal(original.fecha) : fechaInicial)
  const fechaMaxima = sumarAnios(hoy(), 1)

  const cambiarTipo = (nuevo) => {
    setTipo(nuevo)
    if (!almacen.categoriasDe(nuevo).includes(categoria)) setCategoria(almacen.categoriasDe(nuevo)[0])
    if (nuevo === 'transferencia' && (destinoID == null || destinoID === cuentaID)) {
      setDestinoID(cuentas.find((c) => c.id !== cuentaID)?.id ?? null)
    }
  }

  const monto = comoMonto(montoTexto)
  const esTransferencia = tipo === 'transferencia'
  const error = primerError(
    [(monto ?? 0) <= 0, 'Escribe un monto mayor que cero.'],
    [esTransferencia && cuentas.length < 2, 'Necesitas al menos dos cuentas para transferir.'],
    [esTransferencia && (cuentaID == null || destinoID == null), 'Elige la cuenta de origen y la de destino.'],
    [esTransferencia && cuentaID === destinoID, 'Las cuentas deben ser distintas.'],
    [fecha > fechaMaxima, 'La fecha no puede ser tan lejana.'],
  )

  const guardar = () => {
    // Si se edita sin cambiar la fecha, se conserva la hora original.
    const instanteElegido = original && fechaLocal(original.fecha) === fecha ? original.fecha : comoMomento(fecha)
    const movimiento = { ...original, id: original?.id ?? nuevoId(), tipo, monto, categoria, nota: nota.trim(), fecha: instanteElegido }
    delete movimiento.cuentaID
    delete movimiento.cuentaDestinoID
    delete movimiento.sobreID
    if (cuentaID != null) movimiento.cuentaID = cuentaID
    if (esTransferencia && destinoID != null) movimiento.cuentaDestinoID = destinoID
    if (tipo === 'gasto' && sobreID != null) movimiento.sobreID = sobreID
    almacen.guardarMovimiento(movimiento)
  }

  const eliminar = () => confirmar('¿Eliminar este movimiento?', null, 'Eliminar', () => {
    almacen.eliminarMovimiento(original)
    alCerrar()
  })

  const nombreCuenta = (vacio) => (id) => (id == null ? vacio : almacen.cuenta(id)?.nombre ?? '—')
  const nombreSobre = (id) => (id == null
    ? `Automático (${almacen.sobreAutomatico(categoria)?.nombre ?? 'ninguno'})`
    : sobres.find((s) => s.id === id)?.nombre ?? '—')

  const tituloNuevo = esTransferencia ? 'Nueva transferencia' : `Nuevo ${TipoMovimiento[tipo].nombre.toLowerCase()}`

  return html`<${Hoja} titulo=${original ? 'Editar' : tituloNuevo} alCerrar=${alCerrar}
    puedeGuardar=${error == null} alGuardar=${guardar}>
    <${Segmentos} opciones=${Object.keys(TipoMovimiento)} seleccion=${tipo} alCambiar=${cambiarTipo} titulo=${(t) => TipoMovimiento[t].nombre} />

    <${SeccionForm} pie=${html`<${MensajeError} texto=${montoTexto ? error : null} />`}>
      <${CampoMonto} texto=${montoTexto} alCambiar=${setMontoTexto} color=${tono(TipoMovimiento[tipo].tono)} />
    <//>

    ${!esTransferencia && html`
      <${SeccionForm} titulo="Categoría">
        <${Cuadricula}>
          ${almacen.categoriasDe(tipo, categoria).map((c) => html`
            <${BotonCategoria} key=${c} simbolo=${almacen.categoria(c).icono} nombre=${almacen.categoria(c).nombre} color=${tono(almacen.categoria(c).tono)}
              elegido=${categoria === c} alTocar=${() => setCategoria(c)} />`)}
          <${BotonCategoria} simbolo="plus" nombre="Nueva" color=${C.acento} alTocar=${() => nav.abrir({ tipo: 'FormCategoria', tipoCategoria: tipo, alCrear: setCategoria })} />
        <//>
      <//>`}

    ${tipo === 'gasto' && sobres.length > 0 && html`
      <${SeccionForm} titulo="Sobre">
        <${FilaSelector} etiqueta="Sale del sobre" valor=${sobreID} opciones=${[null, ...sobres.map((s) => s.id)]} texto=${nombreSobre} alCambiar=${setSobreID} />
      <//>`}

    <${SeccionForm} titulo=${esTransferencia ? 'Cuentas' : 'Cuenta'}>
      <${FilaSelector} etiqueta=${esTransferencia ? 'Desde' : 'Cuenta'} valor=${cuentaID} opciones=${[null, ...cuentas.map((c) => c.id)]}
        texto=${nombreCuenta('Sin cuenta')} alCambiar=${setCuentaID} />
      ${esTransferencia && html`
        <${Separador} />
        <${FilaSelector} etiqueta="Hacia" valor=${destinoID} opciones=${[null, ...cuentas.filter((c) => c.id !== cuentaID).map((c) => c.id)]}
          texto=${nombreCuenta('Elegir')} alCambiar=${setDestinoID} />`}
    <//>

    <${SeccionForm}>
      <${FilaTexto} valor=${nota} alCambiar=${setNota} placeholder="Nota (opcional)" maximo=${Limites.nota} />
      <${Separador} />
      <${FilaFecha} etiqueta="Fecha" fecha=${fecha} alCambiar=${setFecha} maximo=${fechaMaxima} />
    <//>

    ${original && html`<${SeccionForm}><${FilaBoton} texto="Eliminar movimiento" alTocar=${eliminar} color=${C.gasto} simbolo="trash" /><//>`}
  <//>`
}
