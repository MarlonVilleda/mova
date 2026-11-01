import { aFormatoArchivo, cargarTolerante } from './carga.js'
import { ahora, fechaLocal, instante, mesDe, sumarMes } from './fechas.js'
import { Formato } from './formato.js'
import {
  Categoria, TipoMovimiento, abonadoEsteMes, ahorrado, categoriaOtros, categoriasDeGasto, categoriasDeIngreso, categoriasFijas,
  categoriasPara, datosIniciales, deIndice, fechaCobro, liquidada, montoProximaCuota, nuevoId, nuevoSobre, proximoPago, restante, siguienteCobro,
  sobresSugeridos, Tonos,
} from './modelos.js'
import { ErrorDatos, Limites, esMontoValido, limpio, validar } from './validacion.js'

const CLAVE_DATOS = 'mova.json'
const CLAVE_ANTERIOR = 'mova-antes-de-restaurar.json'

const suma = (lista, f) => lista.reduce((total, x) => total + f(x), 0)

/** Cálculos que se reutilizan mientras los datos no cambien. */
class Indice {
  constructor(datos) {
    this.datos = datos
    this.porMes = new Map()
    for (const m of datos.movimientos) {
      const mes = mesDe(m.fecha)
      if (!this.porMes.has(mes)) this.porMes.set(mes, [])
      this.porMes.get(mes).push(m)
    }
    for (const lista of this.porMes.values()) lista.sort((a, b) => Date.parse(b.fecha) - Date.parse(a.fecha))

    this.sobrePorId = new Map(datos.sobres.map((s) => [s.id, s]))
    this.sobrePorCategoria = new Map()
    for (const s of datos.sobres) {
      for (const c of s.categorias) if (!this.sobrePorCategoria.has(c)) this.sobrePorCategoria.set(c, s)
    }
    this.cuentaPorId = new Map(datos.cuentas.map((c) => [c.id, c]))

    this.saldos = new Map(datos.cuentas.map((c) => [c.id, c.saldoInicial]))
    const mover = (id, monto) => {
      if (id != null && this.saldos.has(id)) this.saldos.set(id, this.saldos.get(id) + monto)
    }
    for (const m of datos.movimientos) {
      if (m.tipo === 'ingreso') mover(m.cuentaID, m.monto)
      else if (m.tipo === 'gasto') mover(m.cuentaID, -m.monto)
      else {
        mover(m.cuentaID, -m.monto)
        mover(m.cuentaDestinoID, m.monto)
      }
    }
    this.gastadoPorSobre = new Map()
    this.arrastres = new Map()

    this.categorias = new Map()
    const tipoDe = (clave) => {
      if (categoriasDeIngreso.includes(clave)) return 'ingreso'
      return categoriasDeGasto.includes(clave) ? 'gasto' : 'transferencia'
    }
    for (const [clave, base] of Object.entries(Categoria)) {
      const { nombre, icono, color, oculta = false } = datos.categoriasBase[clave] ?? {}
      this.categorias.set(clave, {
        clave, tipo: tipoDe(clave), propia: false, oculta, color, cambiada: clave in datos.categoriasBase,
        nombre: nombre ?? base.nombre, icono: icono ?? base.icono, tono: color == null ? base.tono : deIndice(color),
      })
    }
    for (const c of datos.categoriasPropias) {
      this.categorias.set(c.id, {
        clave: c.id, tipo: c.tipo, propia: true, oculta: false, color: c.color, cambiada: false,
        nombre: c.nombre, icono: c.icono, tono: deIndice(c.color),
      })
    }
  }
}

/**
 * Guarda y calcula todo. `persistencia` guarda textos por clave (`leer` y `escribir`, ambos asíncronos);
 * en el navegador es IndexedDB.
 */
export class Almacen {
  constructor(persistencia) {
    this.persistencia = persistencia
    this.datos = datosIniciales()
    /** Mensaje si algo no se pudo guardar o leer (se muestra al usuario). */
    this.errorAlGuardar = null
    this.despuesDeGuardar = null
    /** Si los datos existen pero no se pudieron leer, no se escribe para no sobrescribirlos. */
    this.soloLectura = false
    this.pendiente = null
    this.oyentes = new Set()
    this.cache = null
    Formato.moneda = this.datos.ajustes.moneda
  }

  async iniciar() {
    let contenido
    try {
      contenido = await this.persistencia.leer(CLAVE_DATOS)
    } catch {
      this.soloLectura = true
      this.errorAlGuardar = 'No se pudieron abrir tus datos. Cierra y vuelve a abrir Mova.'
      this.avisar()
      return
    }
    if (contenido != null) await this.aplicar(contenido)
    Formato.moneda = this.datos.ajustes.moneda
    this.convertirPresupuestosEnSobres()
    this.avisar()
  }

  async aplicar(contenido) {
    try {
      const carga = cargarTolerante(contenido)
      this.datos = carga.datos
      if (carga.descartados > 0) {
        const copia = await this.apartar(contenido)
        this.errorAlGuardar = `Se omitieron ${carga.descartados} registros dañados. El original se guardó como ${copia ?? 'copia'}.`
      }
    } catch {
      // Nunca sobrescribir datos que no se pudieron leer: se apartan como respaldo y se avisa.
      const copia = await this.apartar(contenido)
      this.datos = datosIniciales()
      this.errorAlGuardar = `No se pudieron leer tus datos y Mova empezó de nuevo. El original se guardó como ${copia ?? 'copia'}; puedes restaurar un respaldo desde Ajustes.`
    }
  }

  async apartar(contenido) {
    const nombre = `mova-respaldo-${Math.floor(Date.now() / 1000)}.json`
    try {
      await this.persistencia.escribir(nombre, contenido)
      return nombre
    } catch {
      // Sin copia del original, no se puede escribir encima.
      this.soloLectura = true
      return null
    }
  }

  /** Vuelve a leer los datos que otra pestaña acaba de guardar. */
  async recargar() {
    if (this.pendiente != null) return
    const contenido = await this.persistencia.leer(CLAVE_DATOS)
    if (contenido == null) return
    await this.aplicar(contenido)
    Formato.moneda = this.datos.ajustes.moneda
    this.avisar()
  }

  /** Los presupuestos por categoría de la versión anterior se convierten en sobres. */
  convertirPresupuestosEnSobres() {
    const { datos } = this
    if (datos.sobres.length > 0 || Object.keys(datos.presupuestos).length === 0) return
    const sobres = categoriasDeGasto.filter((c) => datos.presupuestos[c] != null).map((c) => nuevoSobre({
      nombre: Categoria[c].nombre, icono: Categoria[c].icono, color: 0, categorias: [c], montoHabitual: datos.presupuestos[c],
    }))
    this.cambiar({ ...datos, sobres, presupuestos: {} })
  }

  // MARK: Avisos

  suscribir(oyente) {
    this.oyentes.add(oyente)
    return () => this.oyentes.delete(oyente)
  }

  avisar() {
    for (const oyente of this.oyentes) oyente()
  }

  // MARK: Guardado

  cambiar(nuevos) {
    this.datos = nuevos
    Formato.moneda = nuevos.ajustes.moneda
    this.programarGuardado()
    this.avisar()
  }

  cambiarAjustes(cambio) {
    this.cambiar({ ...this.datos, ajustes: { ...this.datos.ajustes, ...cambio } })
  }

  /** Agrupa los cambios seguidos (p. ej. escribir un nombre) en una sola escritura. */
  programarGuardado() {
    clearTimeout(this.pendiente)
    this.pendiente = setTimeout(() => this.guardarAhora(), 400)
  }

  /** Guarda de inmediato (al salir de la app). */
  async guardarAhora() {
    if (this.pendiente == null) return
    clearTimeout(this.pendiente)
    this.pendiente = null
    await this.escribir()
  }

  async escribir() {
    if (this.soloLectura) return
    try {
      await this.persistencia.escribir(CLAVE_DATOS, this.exportarRespaldo())
      if (this.errorAlGuardar?.startsWith('No se pudieron guardar')) {
        this.errorAlGuardar = null
        this.avisar()
      }
      this.despuesDeGuardar?.()
    } catch (e) {
      this.errorAlGuardar = `No se pudieron guardar los cambios: ${e?.message ?? 'error desconocido'}`
      this.avisar()
    }
  }

  // MARK: Consultas

  get indice() {
    if (this.cache?.datos !== this.datos) this.cache = new Indice(this.datos)
    return this.cache
  }

  cuenta(id) {
    return id == null ? undefined : this.indice.cuentaPorId.get(id)
  }

  saldo(cuenta) {
    return this.indice.saldos.get(cuenta.id) ?? cuenta.saldoInicial
  }

  /** Saldo inicial con el que la cuenta llega a `deseado`, sin tocar sus movimientos. */
  saldoInicialPara(cuenta, deseado) {
    const movimientos = cuenta ? this.saldo(cuenta) - cuenta.saldoInicial : 0
    return Math.round((deseado - movimientos) * 100) / 100
  }

  /** Deudas pendientes asociadas a esta cuenta. Es opcional: una deuda puede no tener cuenta. */
  deudasDe(cuenta) {
    return this.datos.deudas.filter((d) => d.cuentaID === cuenta.id && d.direccion === 'yoDebo' && !liquidada(d))
  }

  /** Lo que falta pagar de las deudas asociadas a esta cuenta. */
  comprometido(cuenta) {
    return suma(this.deudasDe(cuenta), restante)
  }

  /**
   * Lo que queda libre en una cuenta después de sus deudas asociadas. En una tarjeta con límite
   * parte del crédito sin usar; las demás parten de su saldo.
   */
  disponibleEn(cuenta) {
    const saldo = this.saldo(cuenta)
    const base = cuenta.tipo === 'tarjeta' && cuenta.limite != null ? cuenta.limite + saldo : saldo
    return base - this.comprometido(cuenta)
  }

  get saldoTotal() {
    return suma([...this.indice.saldos.values()], (v) => v)
  }

  get totalQueDebo() {
    return suma(this.datos.deudas.filter((d) => d.direccion === 'yoDebo'), restante)
  }

  get totalQueMeDeben() {
    return suma(this.datos.deudas.filter((d) => d.direccion === 'meDeben'), restante)
  }

  get totalAhorradoEnMetas() {
    return suma(this.datos.metas, ahorrado)
  }

  /** Lo que tienes, más lo que te deben, menos lo que debes. */
  get patrimonio() {
    return this.saldoTotal + this.totalQueMeDeben - this.totalQueDebo
  }

  movimientos(mes) {
    return this.indice.porMes.get(mes) ?? []
  }

  ingresos(mes) {
    return suma(this.movimientos(mes).filter((m) => m.tipo === 'ingreso'), (m) => m.monto)
  }

  gastos(mes) {
    return suma(this.movimientos(mes).filter((m) => m.tipo === 'gasto'), (m) => m.monto)
  }

  /** Lista de [categoría, total] de mayor a menor. */
  gastosPorCategoria(mes) {
    const totales = new Map()
    for (const m of this.movimientos(mes)) {
      if (m.tipo === 'gasto') totales.set(m.categoria, (totales.get(m.categoria) ?? 0) + m.monto)
    }
    return [...totales].sort((a, b) => b[1] - a[1])
  }

  // MARK: Categorías

  /** Nombre, icono y color de una categoría, con los cambios del usuario. */
  categoria(clave) {
    return this.indice.categorias.get(clave) ?? this.indice.categorias.get('otrosGastos')
  }

  /** Claves para elegir en un formulario; `incluir` mantiene visible la que ya tiene un registro aunque esté oculta. */
  categoriasDe(tipo, incluir) {
    const visibles = categoriasPara(tipo).filter((c) => !this.categoria(c).oculta || c === incluir)
    const propias = this.datos.categoriasPropias.filter((c) => c.tipo === tipo).map((c) => c.id)
    if (tipo === 'transferencia') return visibles
    // «Otros» siempre va al final.
    const otros = visibles.pop()
    return [...visibles, ...propias, otros]
  }

  categoriasOcultas(tipo) {
    return categoriasPara(tipo).filter((c) => this.categoria(c).oculta)
  }

  /** Crea o edita una categoría y devuelve su clave. */
  guardarCategoria({ clave, tipo, nombre, icono, color }) {
    const limpioNombre = limpio(nombre, Limites.nombreCategoria)
    if (!limpioNombre) return null
    if (clave != null && Object.hasOwn(Categoria, clave)) {
      const cambio = { ...this.datos.categoriasBase[clave], nombre: limpioNombre, icono }
      if (color != null) cambio.color = color
      this.cambiar({ ...this.datos, categoriasBase: { ...this.datos.categoriasBase, [clave]: cambio } })
      return clave
    }
    const categoria = { id: clave ?? nuevoId(), tipo, nombre: limpioNombre, icono, color: color ?? 0 }
    this.cambiar({ ...this.datos, categoriasPropias: reemplazarOAgregar(this.datos.categoriasPropias, categoria) })
    return categoria.id
  }

  /**
   * Una categoría de Mova solo se oculta, para que los movimientos viejos conserven su nombre.
   * Una propia se borra y lo registrado en ella pasa a «Otros».
   */
  eliminarCategoria(clave) {
    if (categoriasFijas.includes(clave)) return
    if (Object.hasOwn(Categoria, clave)) {
      const cambio = { ...this.datos.categoriasBase[clave], oculta: true }
      this.cambiar({ ...this.datos, categoriasBase: { ...this.datos.categoriasBase, [clave]: cambio } })
      return
    }
    const propia = this.datos.categoriasPropias.find((c) => c.id === clave)
    if (!propia) return
    const otros = categoriaOtros(propia.tipo)
    const mover = (registro) => (registro.categoria === clave ? { ...registro, categoria: otros } : registro)
    this.cambiar({
      ...this.datos,
      categoriasPropias: this.datos.categoriasPropias.filter((c) => c.id !== clave),
      movimientos: this.datos.movimientos.map(mover),
      pagosFijos: this.datos.pagosFijos.map(mover),
      sobres: this.datos.sobres.map((s) => ({ ...s, categorias: s.categorias.filter((c) => c !== clave) })),
    })
  }

  /** Devuelve una categoría de Mova a como venía: nombre, icono, color y visible. */
  restablecerCategoria(clave) {
    const { [clave]: _, ...resto } = this.datos.categoriasBase
    this.cambiar({ ...this.datos, categoriasBase: resto })
  }

  // MARK: Sobres

  /** El sobre del que sale un gasto: el elegido, o el que tiene su categoría. */
  sobre(movimiento) {
    if (movimiento.tipo !== 'gasto') return undefined
    const elegido = movimiento.sobreID == null ? undefined : this.indice.sobrePorId.get(movimiento.sobreID)
    return elegido ?? this.indice.sobrePorCategoria.get(movimiento.categoria)
  }

  sobreAutomatico(categoria) {
    return this.indice.sobrePorCategoria.get(categoria)
  }

  asignado(sobre, mes) {
    return this.datos.asignaciones[mes]?.[sobre.id] ?? 0
  }

  gastado(sobre, mes) {
    const { gastadoPorSobre } = this.indice
    if (!gastadoPorSobre.has(mes)) {
      const totales = new Map()
      for (const m of this.movimientos(mes)) {
        const s = this.sobre(m)
        if (s) totales.set(s.id, (totales.get(s.id) ?? 0) + m.monto)
      }
      gastadoPorSobre.set(mes, totales)
    }
    return gastadoPorSobre.get(mes).get(sobre.id) ?? 0
  }

  /** Lo que sobró en meses anteriores (solo en sobres que acumulan). */
  arrastre(sobre, hasta) {
    if (!sobre.acumula) return 0
    const { arrastres } = this.indice
    const clave = `${sobre.id}|${hasta}`
    if (!arrastres.has(clave)) {
      let total = 0
      let cursor = mesDe(sobre.creado)
      for (let vueltas = 0; cursor < hasta && vueltas < 600; vueltas++) {
        total += this.asignado(sobre, cursor) - this.gastado(sobre, cursor)
        cursor = sumarMes(cursor, 1)
      }
      arrastres.set(clave, total)
    }
    return arrastres.get(clave)
  }

  /** Lo que queda en el sobre este mes (negativo si te pasaste). */
  disponible(sobre, mes) {
    return this.arrastre(sobre, mes) + this.asignado(sobre, mes) - this.gastado(sobre, mes)
  }

  totalAsignado(mes) {
    return suma(this.datos.sobres, (s) => this.asignado(s, mes))
  }

  /** Ingresos del mes que todavía no repartiste en sobres. */
  porAsignar(mes) {
    return this.ingresos(mes) - this.totalAsignado(mes)
  }

  /** Gastos del mes que no caen en ningún sobre. */
  gastosSinSobre(mes) {
    return suma(this.movimientos(mes).filter((m) => m.tipo === 'gasto' && !this.sobre(m)), (m) => m.monto)
  }

  /** Pagos fijos y cuotas de deudas que vienen (incluye los vencidos). */
  get proximosPagos() {
    const fijos = this.datos.pagosFijos.filter((p) => !p.cancelada).map((p) => ({
      id: p.id, nombre: p.nombre, monto: p.monto, fecha: fechaCobro(p),
      icono: this.categoria(p.categoria).icono, tono: this.categoria(p.categoria).tono, pagado: false, esDeuda: false,
    }))
    const deudas = this.datos.deudas.flatMap((d) => {
      const fecha = proximoPago(d)
      if (fecha == null || d.direccion !== 'yoDebo') return []
      return [{
        id: d.id, nombre: d.nombre, monto: montoProximaCuota(d), fecha,
        icono: 'creditcard', tono: Tonos.deuda, pagado: abonadoEsteMes(d), esDeuda: true,
      }]
    })
    return [...fijos, ...deudas].sort((a, b) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : 0))
  }

  // MARK: Cambios
  // Cada operación revisa sus datos aunque el formulario ya lo haya hecho: nunca entra basura al archivo.

  guardarMovimiento(movimiento) {
    if (!esMontoValido(movimiento.monto) || movimiento.monto <= 0) return
    if (movimiento.tipo === 'transferencia') {
      if (movimiento.cuentaID == null || movimiento.cuentaDestinoID == null) return
      if (movimiento.cuentaID === movimiento.cuentaDestinoID) return
    }
    const m = { ...movimiento, nota: limpio(movimiento.nota, Limites.nota) }
    // Si este movimiento es el pago de una deuda, el abono se mantiene igual al movimiento.
    const deudas = this.datos.deudas.map((d) => (d.abonos.some((a) => a.movimientoID === m.id)
      ? { ...d, abonos: d.abonos.map((a) => (a.movimientoID === m.id ? { ...a, monto: m.monto, fecha: m.fecha } : a)) }
      : d))
    this.cambiar({ ...this.datos, movimientos: reemplazarOAgregar(this.datos.movimientos, m), deudas })
  }

  guardarCuenta(cuenta) {
    if (!Number.isFinite(cuenta.saldoInicial) || Math.abs(cuenta.saldoInicial) > Limites.montoMaximo) return
    if (cuenta.limite != null && !esMontoValido(cuenta.limite)) return
    const c ={ ...cuenta, nombre: limpio(cuenta.nombre, Limites.nombre) }
    if (!c.nombre) return
    this.cambiar({ ...this.datos, cuentas: reemplazarOAgregar(this.datos.cuentas, c) })
  }

  guardarDeuda(deuda) {
    if (!esMontoValido(deuda.montoTotal) || deuda.montoTotal <= 0) return
    if (deuda.cuotaMensual != null && !esMontoValido(deuda.cuotaMensual)) return
    if (deuda.tasaAnual != null && !(deuda.tasaAnual >= 0 && deuda.tasaAnual <= Limites.tasaMaxima)) return
    if (deuda.diaDePago != null && !(deuda.diaDePago >= 1 && deuda.diaDePago <= 31)) return
    const d = {
      ...deuda,
      nombre: limpio(deuda.nombre, Limites.nombre), persona: limpio(deuda.persona, Limites.nombre), nota: limpio(deuda.nota, Limites.nota),
    }
    if (!d.nombre) return
    this.cambiar({ ...this.datos, deudas: reemplazarOAgregar(this.datos.deudas, d) })
  }

  guardarMeta(meta) {
    if (!esMontoValido(meta.objetivo) || meta.objetivo <= 0) return
    const m = { ...meta, nombre: limpio(meta.nombre, Limites.nombre) }
    if (!m.nombre) return
    this.cambiar({ ...this.datos, metas: reemplazarOAgregar(this.datos.metas, m) })
  }

  guardarPagoFijo(pago) {
    if (!esMontoValido(pago.monto) || pago.monto <= 0) return
    if (pago.diaDelMes < 1 || pago.diaDelMes > 31 || pago.avisarDiasAntes < 0 || pago.avisarDiasAntes > 30) return
    const p = { ...pago, nombre: limpio(pago.nombre, Limites.nombre) }
    if (!p.nombre) return
    this.cambiar({ ...this.datos, pagosFijos: reemplazarOAgregar(this.datos.pagosFijos, p) })
  }

  eliminarMovimiento(movimiento) {
    // Si era el pago de una deuda, también se quita el abono.
    this.cambiar({
      ...this.datos,
      movimientos: this.datos.movimientos.filter((m) => m.id !== movimiento.id),
      deudas: this.datos.deudas.map((d) => ({ ...d, abonos: d.abonos.filter((a) => a.movimientoID !== movimiento.id) })),
    })
  }

  eliminarCuenta(cuenta) {
    this.cambiar({
      ...this.datos,
      cuentas: this.datos.cuentas.filter((c) => c.id !== cuenta.id),
      movimientos: this.datos.movimientos.map((m) => sinCampos(m, {
        cuentaID: m.cuentaID === cuenta.id, cuentaDestinoID: m.cuentaDestinoID === cuenta.id,
      })),
      pagosFijos: this.datos.pagosFijos.map((p) => sinCampos(p, { cuentaID: p.cuentaID === cuenta.id })),
      deudas: this.datos.deudas.map((d) => sinCampos(d, { cuentaID: d.cuentaID === cuenta.id })),
    })
  }

  eliminarDeuda(deuda) {
    this.cambiar({ ...this.datos, deudas: this.datos.deudas.filter((d) => d.id !== deuda.id) })
  }

  eliminarMeta(meta) {
    this.cambiar({ ...this.datos, metas: this.datos.metas.filter((m) => m.id !== meta.id) })
  }

  eliminarPagoFijo(pago) {
    this.cambiar({ ...this.datos, pagosFijos: this.datos.pagosFijos.filter((p) => p.id !== pago.id) })
  }

  guardarSobre(sobre) {
    if (!esMontoValido(sobre.montoHabitual)) return
    const s = { ...sobre, nombre: limpio(sobre.nombre, Limites.nombre) }
    if (!s.nombre) return
    // Una categoría solo puede caer en un sobre: se quita de los demás.
    const otros = this.datos.sobres.map((o) => (o.id === s.id ? o : { ...o, categorias: o.categorias.filter((c) => !s.categorias.includes(c)) }))
    this.cambiar({ ...this.datos, sobres: reemplazarOAgregar(otros, s) })
  }

  eliminarSobre(sobre) {
    const asignaciones = {}
    for (const [mes, montos] of Object.entries(this.datos.asignaciones)) {
      const { [sobre.id]: _, ...resto } = montos
      if (Object.keys(resto).length > 0) asignaciones[mes] = resto
    }
    this.cambiar({
      ...this.datos,
      sobres: this.datos.sobres.filter((s) => s.id !== sobre.id),
      asignaciones,
      movimientos: this.datos.movimientos.map((m) => sinCampos(m, { sobreID: m.sobreID === sobre.id })),
    })
  }

  crearSobresSugeridos() {
    const usadas = new Set(this.datos.sobres.flatMap((s) => s.categorias))
    const nuevos = sobresSugeridos()
      .filter((s) => !this.datos.sobres.some((o) => o.nombre === s.nombre))
      .map((s) => ({ ...s, categorias: s.categorias.filter((c) => !usadas.has(c)) }))
    this.cambiar({ ...this.datos, sobres: [...this.datos.sobres, ...nuevos] })
  }

  /**
   * Fija cuánto dinero tiene cada sobre en un mes. Solo cambia los sobres incluidos en `montos`,
   * así no se pierden los ajustes hechos con «Mover dinero» en los demás.
   */
  asignar(montos, mes) {
    const delMes = { ...this.datos.asignaciones[mes] }
    for (const [id, monto] of Object.entries(montos)) {
      if (!esMontoValido(monto) || !this.datos.sobres.some((s) => s.id === id)) continue
      if (monto > 0) delMes[id] = monto
      else delete delMes[id]
    }
    const asignaciones = { ...this.datos.asignaciones }
    if (Object.keys(delMes).length === 0) delete asignaciones[mes]
    else asignaciones[mes] = delMes
    this.cambiar({ ...this.datos, asignaciones })
  }

  /** Pasa dinero de un sobre a otro en el mismo mes. */
  mover(monto, origen, destino, mes) {
    if (!esMontoValido(monto) || monto <= 0 || origen.id === destino.id) return
    if (monto > this.disponible(origen, mes) + 0.005) return
    const delMes = { ...this.datos.asignaciones[mes] }
    delMes[origen.id] = (delMes[origen.id] ?? 0) - monto
    delMes[destino.id] = (delMes[destino.id] ?? 0) + monto
    this.cambiar({ ...this.datos, asignaciones: { ...this.datos.asignaciones, [mes]: delMes } })
  }

  /** Registra un abono; si se indica una cuenta, también crea el movimiento correspondiente. */
  abonar(monto, deudaID, fecha, nota, cuentaID) {
    const deuda = this.datos.deudas.find((d) => d.id === deudaID)
    if (!deuda || !esMontoValido(monto) || monto <= 0) return
    // Nunca se abona más de lo que falta.
    const real = Math.min(monto, restante(deuda))
    if (real <= 0) return
    const abono = { id: nuevoId(), monto: real, fecha, nota: limpio(nota, Limites.nota) }
    let { movimientos } = this.datos
    if (cuentaID != null) {
      const yoDebo = deuda.direccion === 'yoDebo'
      const movimiento = {
        id: nuevoId(), tipo: yoDebo ? 'gasto' : 'ingreso', monto: real, categoria: yoDebo ? 'deudas' : 'prestamos',
        cuentaID, nota: `Abono · ${deuda.nombre}`, fecha,
      }
      abono.movimientoID = movimiento.id
      movimientos = [...movimientos, movimiento]
    }
    const deudas = this.datos.deudas.map((d) => (d.id === deudaID ? { ...d, abonos: [...d.abonos, abono] } : d))
    this.cambiar({ ...this.datos, deudas, movimientos })
  }

  eliminarAbono(abono, deudaID) {
    this.cambiar({
      ...this.datos,
      deudas: this.datos.deudas.map((d) => (d.id === deudaID ? { ...d, abonos: d.abonos.filter((a) => a.id !== abono.id) } : d)),
      movimientos: abono.movimientoID == null ? this.datos.movimientos : this.datos.movimientos.filter((m) => m.id !== abono.movimientoID),
    })
  }

  aportar(monto, metaID, nota) {
    const meta = this.datos.metas.find((m) => m.id === metaID)
    if (!meta || !Number.isFinite(monto) || monto === 0 || Math.abs(monto) > Limites.montoMaximo) return
    if (ahorrado(meta) + monto < -0.005) return // no se puede retirar más de lo ahorrado
    const aporte = { id: nuevoId(), monto, fecha: ahora(), nota: limpio(nota, Limites.nota) }
    this.cambiar({
      ...this.datos,
      metas: this.datos.metas.map((m) => (m.id === metaID ? { ...m, aportes: [...m.aportes, aporte] } : m)),
    })
  }

  /**
   * Marca una suscripción o pago fijo como pagado y pasa al siguiente cobro. Es solo un recordatorio:
   * no toca el dinero ni crea un movimiento. Devuelve la fecha del siguiente cobro.
   */
  pagar(pago) {
    const actual = this.datos.pagosFijos.find((p) => p.id === pago.id)
    if (!actual || actual.cancelada) return null
    // Una sola vez por cobro: si ya se pagó hace un momento (doble toque), no se repite.
    if (actual.ultimoPago != null && Date.now() - Date.parse(actual.ultimoPago) <= 5000) return null
    const siguiente = siguienteCobro(actual, fechaCobro(actual))
    const actualizado = { ...actual, ultimoPago: ahora(), proximoCobro: instante(siguiente) }
    this.cambiar({ ...this.datos, pagosFijos: this.datos.pagosFijos.map((p) => (p.id === pago.id ? actualizado : p)) })
    return siguiente
  }

  borrarTodo() {
    this.cambiar({ ...datosIniciales(), ajustes: this.datos.ajustes })
  }

  // MARK: Exportar / respaldar / restaurar

  exportarCSV() {
    const celda = (s) => `"${s.replaceAll('"', '""')}"`
    // Un texto que empieza con = + - @ podría ejecutarse como fórmula en Excel: se neutraliza.
    const texto = (s) => (s && '=+-@\t\r'.includes(s[0]) ? celda(`'${s}`) : celda(s))
    const lineas = ['Fecha,Tipo,Categoría,Cuenta,Cuenta destino,Monto,Nota']
    const ordenados = [...this.datos.movimientos].sort((a, b) => Date.parse(b.fecha) - Date.parse(a.fecha))
    for (const m of ordenados) {
      lineas.push([
        celda(fechaLocal(m.fecha)),
        celda(TipoMovimiento[m.tipo].nombre),
        celda(this.categoria(m.categoria).nombre),
        texto(this.cuenta(m.cuentaID)?.nombre ?? ''),
        texto(this.cuenta(m.cuentaDestinoID)?.nombre ?? ''),
        celda((m.tipo === 'gasto' ? -m.monto : m.monto).toFixed(2)),
        texto(m.nota),
      ].join(','))
    }
    // BOM para que Excel reconozca los acentos (UTF-8).
    return `﻿${lineas.join('\r\n')}`
  }

  exportarRespaldo() {
    return JSON.stringify(aFormatoArchivo(this.datos), null, 2)
  }

  /** Reemplaza todo con un respaldo, solo si es válido. Antes guarda una copia de lo actual. */
  async restaurar(contenido) {
    if (contenido.length > Limites.respaldoMaximoBytes) throw new ErrorDatos('El archivo es demasiado grande para ser un respaldo de Mova.')
    let carga
    try {
      carga = cargarTolerante(contenido)
    } catch {
      throw new ErrorDatos('No se pudo leer el respaldo. Elige un archivo creado con «Guardar respaldo».')
    }
    if (carga.descartados > 0) throw new ErrorDatos(`El respaldo tiene ${carga.descartados} registros dañados.`)
    validar(carga.datos)
    try {
      await this.persistencia.escribir(CLAVE_ANTERIOR, this.exportarRespaldo())
    } catch {
      // La copia es una protección extra: si falla, igual se restaura lo que el usuario pidió.
    }
    this.soloLectura = false
    this.cambiar(carga.datos)
    this.convertirPresupuestosEnSobres()
  }

  /** Reemplaza los datos con lo que llegó de la nube, solo si es válido. */
  aplicarRemoto(contenido) {
    const { datos, descartados } = cargarTolerante(contenido)
    if (descartados > 0) throw new ErrorDatos('Los datos de la nube tienen registros dañados.')
    validar(datos)
    this.cambiar(datos)
  }

  /** Deja este dispositivo como nuevo (al cerrar sesión). */
  async reiniciar() {
    this.cambiar(datosIniciales())
    await this.guardarAhora()
  }

  /** ¿Toca recordar que se guarde un respaldo? Los datos viven solo en este navegador. */
  get debeRespaldar() {
    const { respaldoAutomatico, ultimoRespaldo } = this.datos.ajustes
    if (!respaldoAutomatico || this.datos.movimientos.length === 0) return false
    return ultimoRespaldo == null || Date.now() - Date.parse(ultimoRespaldo) >= 7 * 86_400_000
  }

  marcarRespaldo() {
    this.cambiarAjustes({ ultimoRespaldo: ahora() })
  }
}

function reemplazarOAgregar(lista, elemento) {
  const i = lista.findIndex((x) => x.id === elemento.id)
  if (i < 0) return [...lista, elemento]
  const copia = [...lista]
  copia[i] = elemento
  return copia
}

/** Copia del registro sin los campos marcados; devuelve el mismo si no hay nada que quitar. */
function sinCampos(registro, quitar) {
  if (!Object.values(quitar).some(Boolean)) return registro
  const copia = { ...registro }
  for (const [campo, si] of Object.entries(quitar)) if (si) delete copia[campo]
  return copia
}
