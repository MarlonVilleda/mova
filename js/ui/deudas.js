import { html, useState } from '../vendor/preact-htm.js'
import { comoMomento, diasDesdeHoy, fechaLocal, hoy, instante, sumarMeses, textoRelativo } from '../datos/fechas.js'
import { dinero, dineroCorto, porcentaje, porcentajeFino, textoEditable, textoFecha } from '../datos/formato.js'
import {
  DireccionDeuda, Tonos, liquidada, mesesRestantes, montoProximaCuota, nuevoId, pagado, progresoDeuda, proximoPago, restante,
} from '../datos/modelos.js'
import { Limites, comoMonto, limpio, primerError } from '../datos/validacion.js'
import {
  Anillo, BarraProgreso, BotonCircular, BotonMova, BotonOpciones, C, CampoMonto, Dato, Encabezado, FilaDatos, Icono, MensajeError,
  Nota, Segmentos, SelectorColor, Tarjeta, TituloPantalla, Vacio, colorDe,
} from './componentes.js'
import { almacen, confirmar, nav } from './estado.js'
import {
  FilaBoton, FilaFecha, FilaInfo, FilaInterruptor, FilaMontoCorto, FilaSelector, FilaTexto, Hoja, SeccionForm, Separador,
} from './formularios.js'

const FILTROS = { yoDebo: 'Yo debo', meDeben: 'Me deben', liquidadas: 'Liquidadas' }

export function DeudasPantalla() {
  const [filtro, setFiltro] = useState('yoDebo')
  const { deudas } = almacen.datos

  const lista = deudas
    .filter((d) => (filtro === 'liquidadas' ? liquidada(d) : d.direccion === filtro && !liquidada(d)))
    .sort((a, b) => (proximoPago(a) ?? '9999').localeCompare(proximoPago(b) ?? '9999'))
  const cuotasDelMes = deudas
    .filter((d) => d.direccion === 'yoDebo' && !liquidada(d))
    .reduce((t, d) => t + (d.cuotaMensual == null ? 0 : Math.min(d.cuotaMensual, restante(d))), 0)

  return html`<div class="pantalla">
    <${TituloPantalla} titulo="Deudas">
      <${BotonCircular} s="plus" descripcion="Nueva deuda"
        alTocar=${() => nav.abrir({ tipo: 'FormDeuda', direccion: filtro === 'meDeben' ? 'meDeben' : 'yoDebo' })} />
    <//>
    <${Tarjeta} tinte=${C.deuda}>
      <${FilaDatos}>
        <${Dato} titulo="Total que debo" valor=${dinero(almacen.totalQueDebo)} color=${C.deuda} />
        <${Dato} titulo="Me deben" valor=${dinero(almacen.totalQueMeDeben)} color=${C.cian} />
      <//>
      ${cuotasDelMes > 0 && html`
        <hr />
        <${FilaInfo} simbolo="calendar" titulo="Cuotas al mes" valor=${dinero(cuotasDelMes)} />`}
    <//>
    <${Segmentos} opciones=${Object.keys(FILTROS)} seleccion=${filtro} alCambiar=${setFiltro} titulo=${(f) => FILTROS[f]} />
    ${lista.length === 0 && html`
      <${Tarjeta}>
        <${Vacio}
          s=${filtro === 'liquidadas' ? 'checkmark.seal' : 'creditcard'}
          titulo=${filtro === 'liquidadas' ? 'Nada liquidado aún' : 'Sin deudas aquí'}
          texto=${filtro === 'meDeben' ? 'Registra a quién le prestaste dinero para no olvidarlo.' : 'Agrega préstamos, tarjetas o lo que le debas a alguien con el botón +.'} />
      <//>`}
    ${lista.map((deuda) => html`<${TarjetaDeuda} key=${deuda.id} deuda=${deuda} />`)}
  </div>`
}

function TarjetaDeuda({ deuda }) {
  const color = colorDe(deuda.color)
  const fecha = proximoPago(deuda)
  return html`<${Tarjeta} alTocar=${() => nav.abrir({ tipo: 'DetalleDeuda', id: deuda.id })}>
    <div class="fila-centro">
      <${Icono} s=${deuda.direccion === 'yoDebo' ? 'creditcard' : 'hand.raised'} color=${color} />
      <div class="crece corta">
        <b>${deuda.nombre}</b>
        ${deuda.persona && html`<${Nota}>${deuda.persona}<//>`}
      </div>
      <div class="derecha">
        <strong>${dinero(restante(deuda))}</strong>
        <${Nota}>de ${dineroCorto(deuda.montoTotal)}<//>
      </div>
    </div>
    <${BarraProgreso} valor=${progresoDeuda(deuda)} color=${color} />
    <div class="fila-centro">
      <div class="crece"><${Nota}>${liquidada(deuda) ? 'Liquidada' : `${porcentaje(progresoDeuda(deuda))} pagado`}<//></div>
      ${fecha && html`<${Nota} color=${diasDesdeHoy(fecha) < 0 ? C.gasto : null}>${textoRelativo(fecha)}<//>`}
    </div>
  <//>`
}

// MARK: - Detalle

export function DetalleDeuda({ deudaID, alCerrar }) {
  const deuda = almacen.datos.deudas.find((d) => d.id === deudaID)
  if (!deuda) {
    return html`<${Hoja} titulo="Deuda" alCerrar=${alCerrar} textoCerrar="Atrás">
      <${Vacio} s="questionmark" titulo="Deuda no encontrada" texto="Puede que la hayas eliminado." />
    <//>`
  }
  const color = colorDe(deuda.color)
  const yoDebo = deuda.direccion === 'yoDebo'
  const proximo = proximoPago(deuda)
  const meses = mesesRestantes(deuda)
  const eliminar = () => confirmar(`¿Eliminar ${deuda.nombre}?`, 'Los movimientos ya registrados en tus cuentas se conservan.', 'Eliminar', () => {
    almacen.eliminarDeuda(deuda)
    alCerrar()
  })

  return html`<${Hoja} titulo=${deuda.nombre} alCerrar=${alCerrar} textoCerrar="Atrás">
    <div class="derecha">
      <${BotonOpciones} titulo=${deuda.nombre} opciones=${[
        { texto: 'Editar', icono: 'pencil', accion: () => nav.abrir({ tipo: 'FormDeuda', original: deuda }) },
        { texto: 'Eliminar', icono: 'trash', peligro: true, accion: eliminar },
      ]} />
    </div>
    <${Tarjeta} tinte=${color}>
      <div class="fila-centro separada">
        <div class="anillo-caja">
          <${Anillo} valor=${progresoDeuda(deuda)} color=${color} grosor=${12} />
          <div><b>${porcentaje(progresoDeuda(deuda))}</b><small>pagado</small></div>
        </div>
        <div class="columna">
          <${Dato} titulo=${yoDebo ? 'Me falta pagar' : 'Me falta cobrar'} valor=${dinero(restante(deuda))} color=${color} />
          <${Dato} titulo="Pagado" valor=${dinero(pagado(deuda))} />
          <${Dato} titulo="Total" valor=${dinero(deuda.montoTotal)} />
        </div>
      </div>
      ${!liquidada(deuda) && html`
        <${BotonMova} texto=${yoDebo ? 'Registrar pago' : 'Registrar cobro'} alTocar=${() => nav.abrir({ tipo: 'FormAbono', deudaId: deuda.id })}
          icono="plus" prominente color=${color} ancho />`}
    <//>

    <${Tarjeta}>
      <${Encabezado} titulo="Detalles" />
      ${deuda.persona && html`<${FilaInfo} simbolo="person" titulo=${yoDebo ? 'Acreedor' : 'Deudor'} valor=${deuda.persona} />`}
      ${deuda.cuotaMensual != null && html`<${FilaInfo} simbolo="calendar" titulo="Cuota mensual" valor=${dinero(deuda.cuotaMensual)} />`}
      ${deuda.diaDePago != null && html`<${FilaInfo} simbolo="clock" titulo="Día de pago" valor=${`Día ${deuda.diaDePago} de cada mes`} />`}
      ${proximo && html`<${FilaInfo} simbolo="bell" titulo="Próximo pago" valor=${textoFecha(proximo)} />`}
      ${meses != null && html`<${FilaInfo} simbolo="hourglass" titulo="Terminas en" valor=${meses === 1 ? '1 mes' : `${meses} meses`} />`}
      ${deuda.tasaAnual != null && html`<${FilaInfo} simbolo="percent" titulo="Interés anual" valor=${porcentajeFino(deuda.tasaAnual / 100)} />`}
      ${deuda.fechaLimite && html`<${FilaInfo} simbolo="flag" titulo="Fecha límite" valor=${textoFecha(fechaLocal(deuda.fechaLimite))} />`}
      <${FilaInfo} simbolo="calendar.badge.plus" titulo="Desde" valor=${textoFecha(fechaLocal(deuda.fechaInicio))} />
      ${deuda.nota && html`<${Nota}>${deuda.nota}<//>`}
    <//>

    <${Historial} deuda=${deuda} />
  <//>`
}

function Historial({ deuda }) {
  const borrar = (abono) => confirmar('¿Eliminar este pago?', 'Si se registró en una cuenta, también se quita el movimiento.', 'Eliminar', () => {
    almacen.eliminarAbono(abono, deuda.id)
  })
  const abonos = [...deuda.abonos].sort((a, b) => Date.parse(b.fecha) - Date.parse(a.fecha))
  return html`<${Tarjeta}>
    <${Encabezado} titulo="Historial de pagos" />
    ${abonos.length === 0 && html`<${Nota}>Aún no hay pagos registrados.<//>`}
    ${abonos.map((abono) => html`
      <div class="fila-centro" key=${abono.id}>
        <div class="crece">
          <span>${textoFecha(fechaLocal(abono.fecha))}</span>
          ${abono.nota && html`<${Nota}>${abono.nota}<//>`}
        </div>
        <strong style=${{ color: C.ingreso }}>${dinero(abono.monto)}</strong>
        <${BotonOpciones} titulo="este pago" opciones=${[{ texto: 'Eliminar', icono: 'trash', peligro: true, accion: () => borrar(abono) }]} />
      </div>`)}
  <//>`
}

// MARK: - Formularios

export function FormDeuda({ original, direccionInicial = 'yoDebo', alCerrar }) {
  const [direccion, setDireccion] = useState(original?.direccion ?? direccionInicial)
  const [nombre, setNombre] = useState(original?.nombre ?? '')
  const [persona, setPersona] = useState(original?.persona ?? '')
  const [totalTexto, setTotalTexto] = useState(original ? textoEditable(original.montoTotal) : '')
  const [yaPagadoTexto, setYaPagadoTexto] = useState('')
  const [cuotaTexto, setCuotaTexto] = useState(original?.cuotaMensual != null ? textoEditable(original.cuotaMensual) : '')
  const [tasaTexto, setTasaTexto] = useState(original?.tasaAnual != null ? textoEditable(original.tasaAnual) : '')
  const [tieneDiaDePago, setTieneDiaDePago] = useState(original?.diaDePago != null)
  const [diaDePago, setDiaDePago] = useState(original?.diaDePago ?? Number(hoy().slice(8)))
  const [fechaInicio, setFechaInicio] = useState(original ? fechaLocal(original.fechaInicio) : hoy())
  const [tieneLimite, setTieneLimite] = useState(original?.fechaLimite != null)
  const [fechaLimite, setFechaLimite] = useState(original?.fechaLimite ? fechaLocal(original.fechaLimite) : sumarMeses(hoy(), 12))
  const [nota, setNota] = useState(original?.nota ?? '')
  const [color, setColor] = useState(() => original?.color ?? Math.floor(Math.random() * Tonos.elegibles.length))

  const total = comoMonto(totalTexto) ?? 0
  const pagadoAntes = original ? pagado(original) : comoMonto(yaPagadoTexto) ?? 0
  const tasa = comoMonto(tasaTexto)
  const yoDebo = direccion === 'yoDebo'
  const error = primerError(
    [total <= 0, 'Escribe el monto total.'],
    [!limpio(nombre, Limites.nombre), 'Escribe un nombre para la deuda.'],
    [yaPagadoTexto && comoMonto(yaPagadoTexto) == null, 'Lo ya pagado no es válido.'],
    [pagadoAntes > total, original ? `Ya registraste pagos por ${dinero(pagadoAntes)}; el total no puede ser menor.` : 'Lo ya pagado no puede ser mayor que el total.'],
    [cuotaTexto && comoMonto(cuotaTexto) == null, 'La cuota no es válida.'],
    [(comoMonto(cuotaTexto) ?? 0) > total, 'La cuota no puede ser mayor que el total.'],
    [tasaTexto && (tasa == null || tasa > Limites.tasaMaxima), 'El interés debe estar entre 0 y 500 %.'],
    [tieneLimite && fechaLimite < fechaInicio, 'La fecha límite debe ser después del inicio.'],
  )

  const guardar = () => {
    const deuda = {
      ...(original ?? { id: nuevoId(), abonos: [] }),
      nombre: nombre.trim(), persona: persona.trim(), direccion, montoTotal: total,
      fechaInicio: instante(fechaInicio), nota, color,
    }
    const cuota = comoMonto(cuotaTexto)
    for (const [campo, valor] of [
      ['cuotaMensual', cuota > 0 ? cuota : null],
      ['tasaAnual', tasa > 0 ? tasa : null],
      ['diaDePago', tieneDiaDePago ? diaDePago : null],
      ['fechaLimite', tieneLimite ? instante(fechaLimite) : null],
    ]) {
      if (valor == null) delete deuda[campo]
      else deuda[campo] = valor
    }
    const yaPagado = comoMonto(yaPagadoTexto)
    if (!original && yaPagado > 0) {
      deuda.abonos = [{ id: nuevoId(), monto: Math.min(yaPagado, total), fecha: instante(fechaInicio), nota: 'Pagado antes de registrar' }]
    }
    almacen.guardarDeuda(deuda)
  }

  return html`<${Hoja} titulo=${original ? 'Editar deuda' : 'Nueva deuda'} alCerrar=${alCerrar} puedeGuardar=${error == null} alGuardar=${guardar}>
    <${Segmentos} opciones=${Object.keys(DireccionDeuda)} seleccion=${direccion} alCambiar=${setDireccion} titulo=${(d) => DireccionDeuda[d].nombre} />

    <${SeccionForm} titulo="Monto total" pie=${html`<${MensajeError} texto=${totalTexto ? error : null} />`}>
      <${CampoMonto} texto=${totalTexto} alCambiar=${setTotalTexto} color=${colorDe(color)} etiqueta="Monto total" />
    <//>

    <${SeccionForm}>
      <${FilaTexto} valor=${nombre} alCambiar=${setNombre} placeholder=${yoDebo ? 'Nombre (ej. Tarjeta, Préstamo auto)' : 'Concepto (ej. Préstamo a Juan)'} maximo=${Limites.nombre} />
      <${Separador} />
      <${FilaTexto} valor=${persona} alCambiar=${setPersona} placeholder=${yoDebo ? '¿A quién le debes? (opcional)' : '¿Quién te debe?'} maximo=${Limites.nombre} />
      ${!original && html`
        <${Separador} />
        <${FilaMontoCorto} etiqueta="Ya pagado" valor=${yaPagadoTexto} alCambiar=${setYaPagadoTexto} placeholder="0" />`}
    <//>

    <${SeccionForm} titulo="Pagos">
      <${FilaMontoCorto} etiqueta="Cuota mensual" valor=${cuotaTexto} alCambiar=${setCuotaTexto} />
      <${Separador} />
      <${FilaInterruptor} etiqueta="Día de pago fijo" valor=${tieneDiaDePago} alCambiar=${setTieneDiaDePago} />
      ${tieneDiaDePago && html`
        <${FilaSelector} etiqueta="Día del mes" valor=${diaDePago} opciones=${Array.from({ length: 31 }, (_, i) => i + 1)} texto=${(d) => `Día ${d}`} alCambiar=${setDiaDePago} />`}
      <${Separador} />
      <${FilaMontoCorto} etiqueta="Interés anual %" valor=${tasaTexto} alCambiar=${setTasaTexto} />
    <//>

    <${SeccionForm} titulo="Fechas">
      <${FilaFecha} etiqueta="Inicio" fecha=${fechaInicio} alCambiar=${setFechaInicio} maximo=${hoy()} />
      <${Separador} />
      <${FilaInterruptor} etiqueta="Fecha límite" valor=${tieneLimite} alCambiar=${setTieneLimite} />
      ${tieneLimite && html`<${FilaFecha} etiqueta="Pagar antes de" fecha=${fechaLimite} alCambiar=${setFechaLimite} minimo=${fechaInicio} />`}
    <//>

    <${SeccionForm} titulo="Color"><${SelectorColor} indice=${color} alCambiar=${setColor} /><//>
    <${SeccionForm} titulo="Nota"><${FilaTexto} valor=${nota} alCambiar=${setNota} placeholder="Opcional" maximo=${Limites.nota} multilinea /><//>
  <//>`
}

export function FormAbono({ deudaID, alCerrar }) {
  const deuda = almacen.datos.deudas.find((d) => d.id === deudaID)
  const { cuentas } = almacen.datos
  const [montoTexto, setMontoTexto] = useState(deuda ? textoEditable(montoProximaCuota(deuda)) : '')
  const [fecha, setFecha] = useState(hoy)
  const [nota, setNota] = useState('')
  const [enCuenta, setEnCuenta] = useState(cuentas.length > 0)
  const [cuentaID, setCuentaID] = useState(cuentas[0]?.id ?? null)

  if (!deuda) {
    return html`<${Hoja} titulo="Pago" alCerrar=${alCerrar}>
      <${Vacio} s="questionmark" titulo="Deuda no encontrada" texto="Puede que la hayas eliminado." />
    <//>`
  }
  const yoDebo = deuda.direccion === 'yoDebo'
  const monto = comoMonto(montoTexto)
  const falta = restante(deuda)
  const error = primerError(
    [(monto ?? 0) <= 0, 'Escribe un monto mayor que cero.'],
    [(monto ?? 0) > falta + 0.005, `Solo te falta ${dinero(falta)}.`],
    [enCuenta && cuentaID == null, 'Elige una cuenta o desactiva la opción.'],
    [fecha > hoy(), 'La fecha no puede ser futura.'],
  )

  return html`<${Hoja} titulo=${yoDebo ? 'Registrar pago' : 'Registrar cobro'} alCerrar=${alCerrar} puedeGuardar=${error == null}
    alGuardar=${() => almacen.abonar(monto, deuda.id, comoMomento(fecha), nota, enCuenta ? cuentaID : null)}>
    <${SeccionForm}>
      <${CampoMonto} texto=${montoTexto} alCambiar=${setMontoTexto} color=${colorDe(deuda.color)} enfocar=${false} />
      <${MensajeError} texto=${montoTexto ? error : null} />
      <${Separador} />
      <div class="fila"><span class="crece">Te falta</span><span class="secundario">${dinero(falta)}</span></div>
      <${Separador} />
      <${FilaBoton} texto="Pagar todo lo que falta" alTocar=${() => setMontoTexto(textoEditable(falta))} />
    <//>
    <${SeccionForm}>
      <${FilaFecha} etiqueta="Fecha" fecha=${fecha} alCambiar=${setFecha} minimo=${fechaLocal(deuda.fechaInicio)} maximo=${hoy()} />
      <${Separador} />
      <${FilaTexto} valor=${nota} alCambiar=${setNota} placeholder="Nota (opcional)" maximo=${Limites.nota} />
    <//>
    <${SeccionForm} pie=${enCuenta ? `También se registrará como ${yoDebo ? 'gasto' : 'ingreso'} en Movimientos.` : 'Solo se actualizará la deuda.'}>
      <${FilaInterruptor} etiqueta=${yoDebo ? 'Descontar de una cuenta' : 'Sumar a una cuenta'} valor=${enCuenta} alCambiar=${setEnCuenta} />
      ${enCuenta && html`
        <${FilaSelector} etiqueta="Cuenta" valor=${cuentaID} opciones=${cuentas.map((c) => c.id)}
          texto=${(id) => almacen.cuenta(id)?.nombre ?? 'Elegir'} alCambiar=${setCuentaID} />`}
    <//>
  <//>`
}
