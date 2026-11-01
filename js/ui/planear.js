import { html, useState } from '../vendor/preact-htm.js'
import { ahora, fechaLocal, hoy, instante, mesActual, sumarMeses, textoRelativo } from '../datos/fechas.js'
import { dinero, dineroCorto, nombreMes, textoDiaMes, textoEditable, textoFecha } from '../datos/formato.js'
import {
  Frecuencia, ahorrado, costoAnual, costoMensual, cumplida, faltante, fechaCobro, iconosMeta, iconosSobre,
  nuevoId, nuevoPagoFijo, nuevoSobre, pagadoReciente, progresoMeta, sugeridoMensual, suscripcionesPopulares, vencido,
} from '../datos/modelos.js'
import { Limites, comoMonto, limpio, primerError } from '../datos/validacion.js'
import {
  Anillo, BarraProgreso, BotonMova, BotonOpciones, C, CampoMonto, Dato, Encabezado, FilaDatos, Icono, MensajeError, Monto, Nota,
  Segmentos, SelectorColor, SelectorMes, Simbolo, Tarjeta, TituloPantalla, Vacio, colorDe, tono,
} from './componentes.js'
import { almacen, confirmar, marcarPagado, nav } from './estado.js'
import {
  BotonCategoria, Cuadricula, FilaBoton, FilaFecha, FilaInterruptor, FilaMontoCorto, FilaSelector, FilaTexto, Hoja, SeccionForm,
  SelectorIcono, Separador,
} from './formularios.js'

const SECCIONES = { sobres: 'Sobres', metas: 'Metas', suscripciones: 'Suscripciones' }

export function PlanearPantalla() {
  const [seccion, setSeccion] = useState('sobres')
  return html`<div class="pantalla">
    <${TituloPantalla} titulo="Planear" />
    <${Segmentos} opciones=${Object.keys(SECCIONES)} seleccion=${seccion} alCambiar=${setSeccion} titulo=${(s) => SECCIONES[s]} />
    ${seccion === 'sobres' && html`<${SobresSeccion} />`}
    ${seccion === 'metas' && html`<${MetasSeccion} />`}
    ${seccion === 'suscripciones' && html`<${SuscripcionesSeccion} />`}
  </div>`
}

// MARK: - Sobres

function SobresSeccion() {
  const [mes, setMes] = useState(mesActual)
  const porAsignar = almacen.porAsignar(mes)
  const sinSobre = almacen.gastosSinSobre(mes)
  const ingresos = almacen.ingresos(mes)
  const { sobres } = almacen.datos
  const pasado = porAsignar < -0.005
  const nota = ingresos === 0 ? 'Registra tus ingresos del mes para repartirlos en tus sobres.'
    : pasado ? 'Pusiste en sobres más de lo que ganaste este mes.'
      : porAsignar < 0.005 ? '¡Todo tu dinero tiene un destino!' : 'Este dinero todavía no está en ningún sobre.'

  return html`
    <${SelectorMes} mes=${mes} alCambiar=${setMes} />
    <${Tarjeta} tinte=${pasado ? C.gasto : C.azul}>
      <span class="secundario">Por repartir</span>
      <${Monto} texto=${dinero(porAsignar)} color=${pasado ? C.gasto : null} />
      <${Nota}>${nota}<//>
      <${FilaDatos}>
        <${Dato} titulo="Ingresos" valor=${dineroCorto(ingresos)} color=${C.ingreso} />
        <${Dato} titulo="En sobres" valor=${dineroCorto(almacen.totalAsignado(mes))} color=${C.azul} />
        <${Dato} titulo="Gastado" valor=${dineroCorto(almacen.gastos(mes))} color=${C.gasto} />
      <//>
      ${sobres.length > 0 && html`
        <${BotonMova} texto="Repartir dinero" alTocar=${() => nav.abrir({ tipo: 'FormRepartir', mes })} icono="square.split.2x2" prominente ancho />`}
    <//>

    ${sobres.length === 0
      ? html`<${Tarjeta}>
          <${Vacio} s="envelope" titulo="Organiza tu dinero en sobres"
            texto="Cada vez que cobras, reparte tu ingreso en sobres: Vivienda, Comida, Ocio… Cada gasto sale de su sobre y siempre sabes cuánto te queda." />
          <${BotonMova} texto="Crear sobres sugeridos" alTocar=${() => almacen.crearSobresSugeridos()} icono="sparkles" prominente ancho />
        <//>`
      : html`
        ${sobres.map((sobre) => html`<${TarjetaSobre} key=${sobre.id} sobre=${sobre} mes=${mes} />`)}
        ${sinSobre > 0 && html`<${Nota}>${dinero(sinSobre)} en gastos de este mes no caen en ningún sobre. Asígnales una categoría en un sobre.<//>`}`}

    <${BotonMova} texto="Nuevo sobre" alTocar=${() => nav.abrir({ tipo: 'FormSobre' })} icono="plus" ancho />`
}

function confirmarBorrarSobre(sobre, alTerminar) {
  confirmar('¿Eliminar este sobre?', 'Los gastos no se borran; solo dejarán de contar en este sobre.', 'Eliminar', () => {
    almacen.eliminarSobre(sobre)
    alTerminar?.()
  })
}

function TarjetaSobre({ sobre, mes }) {
  const color = colorDe(sobre.color)
  const asignado = almacen.asignado(sobre, mes) + almacen.arrastre(sobre, mes)
  const gastado = almacen.gastado(sobre, mes)
  const disponible = almacen.disponible(sobre, mes)
  const uso = asignado > 0 ? gastado / asignado : gastado > 0 ? 1 : 0
  const pasado = disponible < -0.005
  return html`<${Tarjeta} alTocar=${() => nav.abrir({ tipo: 'FormSobre', original: sobre })}>
    <div class="fila-centro">
      <${Icono} s=${sobre.icono} color=${color} />
      <div class="crece corta">
        <b>${sobre.nombre} ${sobre.acumula && html`<${Simbolo} s="arrow.turn.down.right" tam=${14} color=${C.secundario} titulo="Acumula" />`}</b>
        <${Nota}>Gastado ${dineroCorto(gastado)} de ${dineroCorto(asignado)}<//>
      </div>
      <div class="derecha">
        <strong style=${{ color: pasado ? C.gasto : C.texto }}>${dinero(disponible)}</strong>
        <${Nota}>${pasado ? 'te pasaste' : 'disponible'}<//>
      </div>
      <${BotonOpciones} titulo=${sobre.nombre} opciones=${[
        { texto: 'Editar', icono: 'pencil', accion: () => nav.abrir({ tipo: 'FormSobre', original: sobre }) },
        { texto: 'Mover dinero', icono: 'arrow.left.arrow.right', accion: () => nav.abrir({ tipo: 'FormMover', origenId: sobre.id, mes }) },
        { texto: 'Eliminar', icono: 'trash', peligro: true, accion: () => confirmarBorrarSobre(sobre) },
      ]} />
    </div>
    <${BarraProgreso} valor=${uso} color=${uso >= 1 ? C.gasto : uso >= 0.8 ? C.ambar : color} alto=${7} />
  <//>`
}

export function FormRepartir({ mes, alCerrar }) {
  const { sobres } = almacen.datos
  // Lo que había al abrir: si un sobre no se toca, no se modifica (así no se pierde lo movido entre sobres).
  const [iniciales] = useState(() => Object.fromEntries(sobres.map((s) => {
    const actual = almacen.asignado(s, mes)
    return [s.id, actual > 0 ? textoEditable(actual) : '']
  })))
  const [textos, setTextos] = useState(iniciales)
  const poner = (id, texto) => setTextos((t) => ({ ...t, [id]: texto }))

  const monto = (s) => {
    const texto = textos[s.id] ?? ''
    // Un sobre sin tocar conserva su asignación real (incluso si quedó negativa tras mover dinero).
    return texto === iniciales[s.id] ? almacen.asignado(s, mes) : comoMonto(texto) ?? 0
  }
  const restanteMes = almacen.ingresos(mes) - sobres.reduce((t, s) => t + monto(s), 0)
  const error = primerError([sobres.some((s) => textos[s.id] && comoMonto(textos[s.id]) == null), 'Hay un monto que no es válido.'])
  const guardar = () => {
    const cambiados = sobres.filter((s) => (textos[s.id] ?? '') !== iniciales[s.id])
    almacen.asignar(Object.fromEntries(cambiados.map((s) => [s.id, comoMonto(textos[s.id] ?? '') ?? 0])), mes)
  }
  const usarHabituales = () => setTextos((t) => ({
    ...t, ...Object.fromEntries(sobres.filter((s) => s.montoHabitual > 0).map((s) => [s.id, textoEditable(s.montoHabitual)])),
  }))

  return html`<${Hoja} titulo=${`Repartir ${nombreMes(mes)}`} alCerrar=${alCerrar} puedeGuardar=${error == null} alGuardar=${guardar}>
    <${SeccionForm}>
      <div class="bloque">
        <span class="secundario">Queda por repartir</span>
        <${Monto} texto=${dinero(restanteMes)} color=${restanteMes < -0.005 ? C.gasto : C.azul} />
        <${Nota}>Ingresos de ${nombreMes(mes)}: ${dinero(almacen.ingresos(mes))}<//>
        <${MensajeError} texto=${error ?? (restanteMes < -0.005 ? 'Estás repartiendo más de lo que ganaste.' : null)} />
      </div>
      <${Separador} />
      <${FilaBoton} texto="Usar mis montos habituales" alTocar=${usarHabituales} simbolo="arrow.counterclockwise" habilitado=${sobres.some((s) => s.montoHabitual > 0)} />
    <//>
    <${SeccionForm} titulo="Sobres">
      ${sobres.map((sobre, i) => html`
        ${i > 0 && html`<${Separador} />`}
        <div class="fila-centro" key=${sobre.id}>
          <${Icono} s=${sobre.icono} color=${colorDe(sobre.color)} lado=${34} />
          <div class="crece corta">
            <span>${sobre.nombre}</span>
            ${sobre.montoHabitual > 0 && html`<${Nota}>Habitual: ${dineroCorto(sobre.montoHabitual)}<//>`}
          </div>
          <${FilaMontoCorto} etiqueta="" valor=${textos[sobre.id] ?? ''} alCambiar=${(t) => poner(sobre.id, t)} placeholder="0" />
        </div>`)}
    <//>
  <//>`
}

export function FormMoverDinero({ origenId, mes, alCerrar }) {
  const origen = almacen.datos.sobres.find((s) => s.id === origenId)
  const [destinoID, setDestinoID] = useState(null)
  const [texto, setTexto] = useState('')
  if (!origen) {
    return html`<${Hoja} titulo="Mover dinero" alCerrar=${alCerrar}>
      <${Vacio} s="questionmark" titulo="Sobre no encontrado" texto="Puede que lo hayas eliminado." />
    <//>`
  }
  const disponible = almacen.disponible(origen, mes)
  const monto = comoMonto(texto) ?? 0
  const error = primerError(
    [monto <= 0, 'Escribe un monto mayor que cero.'],
    [monto > disponible + 0.005, `En ${origen.nombre} solo hay ${dinero(Math.max(disponible, 0))}.`],
    [destinoID == null, 'Elige a qué sobre pasar el dinero.'],
  )
  const otros = almacen.datos.sobres.filter((s) => s.id !== origen.id)
  const guardar = () => {
    const destino = otros.find((s) => s.id === destinoID)
    if (destino) almacen.mover(monto, origen, destino, mes)
  }
  return html`<${Hoja} titulo=${`Mover desde ${origen.nombre}`} alCerrar=${alCerrar} puedeGuardar=${error == null} alGuardar=${guardar}>
    <${SeccionForm} pie=${html`<${MensajeError} texto=${texto ? error : null} />Disponible en ${origen.nombre}: ${dinero(disponible)}`}>
      <${CampoMonto} texto=${texto} alCambiar=${setTexto} color=${colorDe(origen.color)} />
    <//>
    <${SeccionForm}>
      <${FilaSelector} etiqueta="Pasar a" valor=${destinoID} opciones=${[null, ...otros.map((s) => s.id)]}
        texto=${(id) => otros.find((s) => s.id === id)?.nombre ?? 'Elegir'} alCambiar=${setDestinoID} />
    <//>
  <//>`
}

export function FormSobre({ original, alCerrar }) {
  const [nombre, setNombre] = useState(original?.nombre ?? '')
  const [simbolo, setSimbolo] = useState(original?.icono ?? 'envelope')
  const [color, setColor] = useState(original?.color ?? 0)
  const [categorias, setCategorias] = useState(original?.categorias ?? [])
  const [habitualTexto, setHabitualTexto] = useState(original?.montoHabitual > 0 ? textoEditable(original.montoHabitual) : '')
  const [acumula, setAcumula] = useState(original?.acumula ?? false)

  const { sobres } = almacen.datos
  const limpioNombre = limpio(nombre, Limites.nombre)
  const error = primerError(
    [!limpioNombre, 'Ponle un nombre al sobre.'],
    [sobres.some((s) => s.id !== original?.id && s.nombre.toLowerCase() === limpioNombre.toLowerCase()), 'Ya tienes un sobre con ese nombre.'],
    [habitualTexto && comoMonto(habitualTexto) == null, 'El monto habitual no es válido.'],
  )
  /** Sobre que ya tiene esa categoría (se le quitará al guardar). */
  const duenio = (c) => sobres.find((s) => s.id !== original?.id && s.categorias.includes(c))
  const movidas = categorias.flatMap((c) => {
    const otro = duenio(c)
    return otro ? [`${almacen.categoria(c).nombre} (de ${otro.nombre})`] : []
  })
  const opciones = [...new Set([...almacen.categoriasDe('gasto'), ...categorias])]
  const alternar = (c) => setCategorias((lista) => (lista.includes(c) ? lista.filter((x) => x !== c) : [...lista, c]))

  const guardar = () => almacen.guardarSobre({
    ...(original ?? nuevoSobre({})),
    nombre, icono: simbolo, color, categorias: opciones.filter((c) => categorias.includes(c)),
    montoHabitual: comoMonto(habitualTexto) ?? 0, acumula,
  })

  return html`<${Hoja} titulo=${original ? 'Editar sobre' : 'Nuevo sobre'} alCerrar=${alCerrar} puedeGuardar=${error == null} alGuardar=${guardar}>
    <${SeccionForm} pie=${html`<${MensajeError} texto=${nombre ? error : null} />`}>
      <div class="fila-centro">
        <${Icono} s=${simbolo} color=${colorDe(color)} lado=${48} />
        <div class="crece"><${FilaTexto} valor=${nombre} alCambiar=${setNombre} placeholder="Nombre (ej. Comida, Salidas)" maximo=${Limites.nombre} grande /></div>
      </div>
    <//>
    <${SeccionForm} pie="El monto habitual se usa al tocar «Usar mis montos habituales» cuando repartes. Activa «pasa al mes siguiente» para ahorros o gastos que no son de cada mes.">
      <${FilaMontoCorto} etiqueta="Monto habitual al mes" valor=${habitualTexto} alCambiar=${setHabitualTexto} />
      <${Separador} />
      <${FilaInterruptor} etiqueta="Lo que sobra pasa al mes siguiente" valor=${acumula} alCambiar=${setAcumula} />
    <//>
    <${SeccionForm} titulo="Categorías que salen de este sobre" pie=${movidas.length > 0 ? `Se moverán a este sobre: ${movidas.join(', ')}.` : null}>
      <${Cuadricula}>
        ${opciones.map((c) => html`
          <${BotonCategoria} key=${c} simbolo=${almacen.categoria(c).icono} nombre=${almacen.categoria(c).nombre} color=${tono(almacen.categoria(c).tono)}
            elegido=${categorias.includes(c)} alTocar=${() => alternar(c)} atenuar />`)}
      <//>
    <//>
    <${SeccionForm} titulo="Icono"><${SelectorIcono} iconos=${iconosSobre} elegido=${simbolo} color=${colorDe(color)} alCambiar=${setSimbolo} /><//>
    <${SeccionForm} titulo="Color"><${SelectorColor} indice=${color} alCambiar=${setColor} /><//>
    ${original && html`<${SeccionForm}><${FilaBoton} texto="Eliminar sobre" alTocar=${() => confirmarBorrarSobre(original, alCerrar)} color=${C.gasto} simbolo="trash" /><//>`}
  <//>`
}

// MARK: - Metas

function MetasSeccion() {
  const { metas } = almacen.datos
  return html`
    ${metas.length === 0
      ? html`<${Tarjeta}><${Vacio} s="target" titulo="Sin metas todavía" texto="Crea una meta de ahorro: un viaje, un fondo de emergencia, un teléfono nuevo…" /><//>`
      : html`<${Tarjeta} tinte=${C.cian}><${Dato} titulo="Ahorrado en metas" valor=${dinero(almacen.totalAhorradoEnMetas)} color=${C.cian} /><//>`}
    <div class="rejilla-metas">${metas.map((meta) => html`<${TarjetaMeta} key=${meta.id} meta=${meta} />`)}</div>
    <${BotonMova} texto="Nueva meta" alTocar=${() => nav.abrir({ tipo: 'FormMeta' })} icono="plus" ancho />`
}

function TarjetaMeta({ meta }) {
  const color = colorDe(meta.color)
  const lograda = cumplida(meta)
  const sugerido = sugeridoMensual(meta)
  const eliminar = () => confirmar(`¿Eliminar ${meta.nombre}?`, 'Se borra la meta y su historial de aportes.', 'Eliminar', () => almacen.eliminarMeta(meta))
  return html`<${Tarjeta} tinte=${color} alTocar=${() => nav.abrir({ tipo: 'FormMeta', original: meta })} clase="meta">
    <div class="meta-opciones">
      <${BotonOpciones} titulo=${meta.nombre} opciones=${[
        { texto: 'Editar', icono: 'pencil', accion: () => nav.abrir({ tipo: 'FormMeta', original: meta }) },
        { texto: 'Eliminar', icono: 'trash', peligro: true, accion: eliminar },
      ]} />
    </div>
    <div class="anillo-caja pequena">
      <${Anillo} valor=${progresoMeta(meta)} color=${color} grosor=${8} lado=${84} />
      <div><${Simbolo} s=${lograda ? 'checkmark' : meta.icono} tam=${26} color=${color} /></div>
    </div>
    <b class="corta">${meta.nombre}</b>
    <${Nota}>${dineroCorto(ahorrado(meta))} de ${dineroCorto(meta.objetivo)}<//>
    ${sugerido != null && html`<${Nota} color=${color}>${dineroCorto(sugerido)}/mes<//>`}
    <${BotonMova} texto=${lograda ? '¡Lograda!' : 'Aportar'} alTocar=${() => nav.abrir({ tipo: 'FormAporte', metaId: meta.id })}
      color=${color} compacto habilitado=${!lograda} etiqueta=${lograda ? null : `Aportar a ${meta.nombre}`} />
  <//>`
}

export function FormMeta({ original, alCerrar }) {
  const [nombre, setNombre] = useState(original?.nombre ?? '')
  const [objetivoTexto, setObjetivoTexto] = useState(original ? textoEditable(original.objetivo) : '')
  const [simbolo, setSimbolo] = useState(original?.icono ?? 'star')
  const [color, setColor] = useState(original?.color ?? 1)
  const [tieneFecha, setTieneFecha] = useState(original?.fechaObjetivo != null)
  const [fecha, setFecha] = useState(original?.fechaObjetivo ? fechaLocal(original.fechaObjetivo) : sumarMeses(hoy(), 6))
  // Si la meta ya tenía una fecha pasada, se permite guardarla igual (solo se exige futura al cambiarla).
  const fechaOriginal = original?.fechaObjetivo ? fechaLocal(original.fechaObjetivo) : null

  const error = primerError(
    [(comoMonto(objetivoTexto) ?? 0) <= 0, 'Escribe un monto mayor que cero.'],
    [!limpio(nombre, Limites.nombre), 'Ponle un nombre a tu meta.'],
    [tieneFecha && fecha < hoy() && fecha !== fechaOriginal, 'La fecha debe ser futura.'],
  )
  const guardar = () => {
    const meta = {
      ...(original ?? { id: nuevoId(), aportes: [] }),
      nombre: nombre.trim(), objetivo: comoMonto(objetivoTexto) ?? 0, icono: simbolo, color,
    }
    if (tieneFecha) meta.fechaObjetivo = instante(fecha)
    else delete meta.fechaObjetivo
    almacen.guardarMeta(meta)
  }
  return html`<${Hoja} titulo=${original ? 'Editar meta' : 'Nueva meta'} alCerrar=${alCerrar} puedeGuardar=${error == null} alGuardar=${guardar}>
    <${SeccionForm} titulo="¿Cuánto quieres ahorrar?" pie=${html`<${MensajeError} texto=${objetivoTexto ? error : null} />`}>
      <${CampoMonto} texto=${objetivoTexto} alCambiar=${setObjetivoTexto} color=${colorDe(color)} />
    <//>
    <${SeccionForm}>
      <${FilaTexto} valor=${nombre} alCambiar=${setNombre} placeholder="Nombre de la meta" maximo=${Limites.nombre} />
      <${Separador} />
      <${FilaInterruptor} etiqueta="Fecha objetivo" valor=${tieneFecha} alCambiar=${setTieneFecha} />
      ${tieneFecha && html`<${FilaFecha} etiqueta="Lograrla antes de" fecha=${fecha} alCambiar=${setFecha} minimo=${hoy()} />`}
    <//>
    <${SeccionForm} titulo="Icono"><${SelectorIcono} iconos=${iconosMeta} elegido=${simbolo} color=${colorDe(color)} alCambiar=${setSimbolo} /><//>
    <${SeccionForm} titulo="Color"><${SelectorColor} indice=${color} alCambiar=${setColor} /><//>
  <//>`
}

export function FormAporte({ metaId, alCerrar }) {
  const meta = almacen.datos.metas.find((m) => m.id === metaId)
  const [texto, setTexto] = useState('')
  const [retirar, setRetirar] = useState(false)
  if (!meta) {
    return html`<${Hoja} titulo="Meta" alCerrar=${alCerrar}>
      <${Vacio} s="questionmark" titulo="Meta no encontrada" texto="Puede que la hayas eliminado." />
    <//>`
  }
  const monto = comoMonto(texto) ?? 0
  const guardado = ahorrado(meta)
  const error = primerError(
    [monto <= 0, 'Escribe un monto mayor que cero.'],
    [retirar && monto > guardado + 0.005, `Solo tienes ${dinero(guardado)} ahorrado.`],
  )
  const guardar = () => almacen.aportar(retirar ? -Math.min(monto, guardado) : monto, meta.id, retirar ? 'Retiro' : '')
  return html`<${Hoja} titulo=${meta.nombre} alCerrar=${alCerrar} puedeGuardar=${error == null} alGuardar=${guardar}>
    <${Segmentos} opciones=${['aportar', 'retirar']} seleccion=${retirar ? 'retirar' : 'aportar'} alCambiar=${(o) => setRetirar(o === 'retirar')}
      titulo=${(o) => (o === 'retirar' ? 'Retirar' : 'Aportar')} />
    <${SeccionForm} pie=${html`<${MensajeError} texto=${texto ? error : null} />Llevas ${dinero(guardado)} de ${dinero(meta.objetivo)}. Te faltan ${dinero(faltante(meta))}.`}>
      <${CampoMonto} texto=${texto} alCambiar=${setTexto} color=${retirar ? C.gasto : colorDe(meta.color)} />
    <//>
  <//>`
}

// MARK: - Suscripciones

function SuscripcionesSeccion() {
  const [verCanceladas, setVerCanceladas] = useState(false)
  const { pagosFijos } = almacen.datos
  const activos = pagosFijos.filter((p) => !p.cancelada).sort((a, b) => Date.parse(a.proximoCobro) - Date.parse(b.proximoCobro))
  const suscripciones = activos.filter((p) => p.esSuscripcion)
  const fijos = activos.filter((p) => !p.esSuscripcion)
  const canceladas = pagosFijos.filter((p) => p.cancelada)
  const mensual = activos.reduce((t, p) => t + costoMensual(p), 0)
  const soloSuscripciones = suscripciones.reduce((t, p) => t + costoAnual(p), 0)
  const ahorro = canceladas.reduce((t, p) => t + costoAnual(p), 0)

  return html`
    <${Tarjeta} tinte=${C.azul}>
      <${FilaDatos}>
        <${Dato} titulo="Al mes" valor=${dinero(mensual)} color=${C.azul} />
        <${Dato} titulo="Al año" valor=${dinero(mensual * 12)} />
      <//>
      ${soloSuscripciones > 0 && html`<${Nota}>Solo en suscripciones pagas ${dinero(soloSuscripciones)} al año.<//>`}
      ${ahorro > 0 && html`<${Nota} color=${C.ingreso}><${Simbolo} s="leaf" tam=${14} /> Ahorras ${dinero(ahorro)} al año por lo que cancelaste<//>`}
    <//>
    ${activos.length === 0 && html`
      <${Tarjeta}>
        <${Vacio} s="repeat" titulo="Sin suscripciones ni pagos fijos"
          texto="Agrega Netflix, Spotify, la renta o la luz. Mova te dice cuándo toca cada cobro y cuánto pagas al año." />
      <//>`}
    ${suscripciones.length > 0 && html`<${Grupo} titulo="Suscripciones" pagos=${suscripciones} />`}
    ${fijos.length > 0 && html`<${Grupo} titulo="Pagos fijos" pagos=${fijos} />`}
    <${BotonMova} texto="Agregar suscripción o pago fijo" alTocar=${() => nav.abrir({ tipo: 'FormSuscripcion' })} icono="plus" ancho />
    ${canceladas.length > 0 && html`
      <${Tarjeta}>
        <button class="fila-canceladas" aria-expanded=${verCanceladas} onClick=${() => setVerCanceladas(!verCanceladas)}>
          <span class="crece">Canceladas (${canceladas.length})</span>
          <${Simbolo} s=${verCanceladas ? 'chevron.down' : 'chevron.right'} color=${C.secundario} />
        </button>
        ${verCanceladas && canceladas.map((pago) => html`
          <button class="fila-cancelada" key=${pago.id} onClick=${() => nav.abrir({ tipo: 'FormSuscripcion', original: pago })}>
            <${Icono} s=${almacen.categoria(pago.categoria).icono} color=${C.secundario} lado=${34} />
            <span class="crece corta">
              <s>${pago.nombre}</s>
              ${pago.fechaCancelacion && html`<small>Cancelada el ${textoFecha(fechaLocal(pago.fechaCancelacion))}</small>`}
            </span>
            <small class="fuerte" style=${{ color: C.ingreso }}>+${dineroCorto(costoAnual(pago))}/año</small>
          </button>`)}
      <//>`}`
}

const Grupo = ({ titulo, pagos }) => html`
  <${Tarjeta}>
    <${Encabezado} titulo=${titulo} />
    ${pagos.map((pago) => html`<${FilaPago} key=${pago.id} pago=${pago} />`)}
  <//>`

function confirmarBorrarPago(pago, alTerminar) {
  confirmar(`¿Eliminar ${pago.nombre}?`, 'Los pagos ya registrados en Movimientos se conservan.', 'Eliminar', () => {
    almacen.eliminarPagoFijo(pago)
    alTerminar?.()
  })
}

function FilaPago({ pago }) {
  const categoria = almacen.categoria(pago.categoria)
  const color = tono(categoria.tono)
  const fecha = fechaCobro(pago)
  return html`<div class="fila-centro fila-pago">
    <button class="area-pago" onClick=${() => nav.abrir({ tipo: 'FormSuscripcion', original: pago })}>
      <${Icono} s=${categoria.icono} color=${color} lado=${38} />
      <span class="crece corta">
        <b>${pago.nombre}</b>
        <small style=${{ color: vencido(pago) ? C.gasto : C.secundario }}>
          ${pagadoReciente(pago) ? `Próximo: ${textoDiaMes(fecha)}` : `${Frecuencia[pago.frecuencia].nombre} · ${textoRelativo(fecha)}`}
        </small>
      </span>
      <strong>${dinero(pago.monto)}</strong>
    </button>
    ${pagadoReciente(pago)
      ? html`<span class="pago-hecho"><${Simbolo} s="checkmark.circle" color=${C.ingreso} titulo="Pagado" /></span>`
      : html`<button class="pago-marcar" style=${{ '--c': color }} aria-label=${`Marcar ${pago.nombre} como pagado`} onClick=${() => marcarPagado(pago)}>
          <${Simbolo} s="checkmark" tam=${18} />
        </button>`}
    <${BotonOpciones} titulo=${pago.nombre} opciones=${[
      { texto: 'Editar', icono: 'pencil', accion: () => nav.abrir({ tipo: 'FormSuscripcion', original: pago }) },
      { texto: 'Eliminar', icono: 'trash', peligro: true, accion: () => confirmarBorrarPago(pago) },
    ]} />
  </div>`
}

export function FormSuscripcion({ original, alCerrar }) {
  const [esSuscripcion, setEsSuscripcion] = useState(original?.esSuscripcion ?? true)
  const [nombre, setNombre] = useState(original?.nombre ?? '')
  const [montoTexto, setMontoTexto] = useState(original ? textoEditable(original.monto) : '')
  const [categoria, setCategoria] = useState(original?.categoria ?? 'suscripciones')
  const [frecuencia, setFrecuencia] = useState(original?.frecuencia ?? 'mensual')
  const [proximoCobro, setProximoCobro] = useState(original ? fechaCobro(original) : hoy())

  const monto = comoMonto(montoTexto)
  const error = primerError(
    [(monto ?? 0) <= 0, 'Escribe un monto mayor que cero.'],
    [!limpio(nombre, Limites.nombre), 'Escribe un nombre.'],
  )

  const guardarCon = (cambio = {}) => {
    const pago = {
      ...(original ?? nuevoPagoFijo({ nombre, monto: 0, categoria, proximoCobro })),
      nombre, monto: monto ?? 0, categoria, frecuencia, proximoCobro: instante(proximoCobro),
      diaDelMes: Number(proximoCobro.slice(8)), esSuscripcion, ...cambio,
    }
    if (pago.cancelada === false) delete pago.fechaCancelacion
    almacen.guardarPagoFijo(pago)
  }

  const elegirTipo = (tipo) => {
    const suscripcion = tipo === 'suscripcion'
    setEsSuscripcion(suscripcion)
    if (!original) setCategoria(suscripcion ? 'suscripciones' : 'vivienda')
  }
  const elegirPopular = (nombrePopular, montoPopular) => {
    setNombre(nombrePopular)
    if (!montoTexto) setMontoTexto(textoEditable(montoPopular))
    setCategoria('suscripciones')
  }
  const reactivar = () => {
    guardarCon({ cancelada: false })
    alCerrar()
  }
  const cancelar = () => {
    guardarCon({ cancelada: true, fechaCancelacion: ahora() })
    alCerrar()
  }

  const equivalente = monto > 0 && frecuencia !== 'anual' ? `Equivale a ${dinero(monto * Frecuencia[frecuencia].vecesPorMes * 12)} al año.` : null

  return html`<${Hoja} titulo=${original ? 'Editar' : 'Nuevo'} alCerrar=${alCerrar} puedeGuardar=${error == null} alGuardar=${() => guardarCon()}>
    <${Segmentos} opciones=${['suscripcion', 'pagoFijo']} seleccion=${esSuscripcion ? 'suscripcion' : 'pagoFijo'} alCambiar=${elegirTipo}
      titulo=${(t) => (t === 'suscripcion' ? 'Suscripción' : 'Pago fijo')} />

    ${!original && esSuscripcion && html`
      <${SeccionForm} titulo="Populares">
        <div class="populares">
          ${suscripcionesPopulares.map(([nombrePopular, montoPopular]) => html`
            <button key=${nombrePopular} class=${nombre === nombrePopular ? 'activo' : ''} onClick=${() => elegirPopular(nombrePopular, montoPopular)}>${nombrePopular}</button>`)}
        </div>
      <//>`}

    <${SeccionForm} pie=${html`<${MensajeError} texto=${montoTexto ? error : null} />`}>
      <${CampoMonto} texto=${montoTexto} alCambiar=${setMontoTexto} color=${tono(almacen.categoria(categoria).tono)} enfocar=${false} />
    <//>

    <${SeccionForm} pie=${equivalente}>
      <${FilaTexto} valor=${nombre} alCambiar=${setNombre} placeholder=${esSuscripcion ? 'Nombre (ej. Netflix)' : 'Nombre (ej. Renta, Luz)'} maximo=${Limites.nombre} />
      <${Separador} />
      <${FilaSelector} etiqueta="Se cobra" valor=${frecuencia} opciones=${Object.keys(Frecuencia)} texto=${(f) => Frecuencia[f].nombre} alCambiar=${setFrecuencia} />
      <${Separador} />
      <${FilaFecha} etiqueta="Próximo cobro" fecha=${proximoCobro} alCambiar=${setProximoCobro} />
      <${Separador} />
      <${FilaSelector} etiqueta="Categoría" valor=${categoria} opciones=${almacen.categoriasDe('gasto', categoria)}
        texto=${(c) => almacen.categoria(c).nombre} alCambiar=${setCategoria} />
    <//>

    ${original && html`
      <${SeccionForm}>
        ${original.cancelada
          ? html`<${FilaBoton} texto="Reactivar" alTocar=${reactivar} />`
          : html`<${FilaBoton} texto=${esSuscripcion ? 'Marcar como cancelada' : 'Ya no lo pago'} alTocar=${cancelar} color=${C.ambar} />`}
        <${Separador} />
        <${FilaBoton} texto="Eliminar" alTocar=${() => confirmarBorrarPago(original, alCerrar)} color=${C.gasto} simbolo="trash" />
      <//>`}
  <//>`
}
