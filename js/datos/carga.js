import { aISO, ahora, diaDelMes, instante, mesActual, mesDe, sumarMes } from './fechas.js'
import { Apariencia, Categoria, DireccionDeuda, Frecuencia, TipoCuenta, TipoMovimiento, ajustesIniciales, categoriaOtros, nuevoId } from './modelos.js'

// Lectores de cada campo: lanzan una excepción si el valor no sirve, igual que el
// serializador de Android. Los campos desconocidos se conservan al copiar cada registro.

function texto(v, porDefecto) {
  if (v == null && porDefecto !== undefined) return porDefecto
  if (typeof v !== 'string') throw new Error('texto')
  return v
}

function numero(v, porDefecto) {
  if (v == null && porDefecto !== undefined) return porDefecto
  if (typeof v !== 'number' || !Number.isFinite(v)) throw new Error('número')
  return v
}

function entero(v, porDefecto) {
  const n = numero(v, porDefecto)
  if (n != null && !Number.isInteger(n)) throw new Error('entero')
  return n
}

function booleano(v, porDefecto) {
  return typeof v === 'boolean' ? v : porDefecto
}

function id(v) {
  if (typeof v !== 'string' || !/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(v)) throw new Error('id')
  return v.toUpperCase()
}

const idOpcional = (v) => (v == null ? undefined : id(v))
const idODefecto = (v) => (v == null ? nuevoId() : id(v))

function fecha(v) {
  const ms = typeof v === 'string' ? Date.parse(v) : NaN
  if (Number.isNaN(ms)) throw new Error('fecha')
  return aISO(new Date(ms))
}

const fechaOpcional = (v) => (v == null ? undefined : fecha(v))

function caso(v, tabla) {
  if (typeof v !== 'string' || !Object.hasOwn(tabla, v)) throw new Error('caso')
  return v
}

/** Un valor desconocido en un campo con valor por defecto usa ese valor (coerceInputValues en Android). */
const casoODefecto = (v, tabla, porDefecto) => (typeof v === 'string' && Object.hasOwn(tabla, v) ? v : porDefecto)

/** Los campos opcionales vacíos no se escriben en el archivo. */
function sinVacios(o) {
  for (const k of Object.keys(o)) if (o[k] == null) delete o[k]
  return o
}

function lista(v) {
  if (v == null) return []
  if (!Array.isArray(v)) throw new Error('lista')
  return v
}

const leerMovimiento = (o) => sinVacios({
  ...o,
  id: idODefecto(o.id), tipo: caso(o.tipo, TipoMovimiento), monto: numero(o.monto), categoria: caso(o.categoria, Categoria),
  categoriaPropia: idOpcional(o.categoriaPropia),
  cuentaID: idOpcional(o.cuentaID), cuentaDestinoID: idOpcional(o.cuentaDestinoID), sobreID: idOpcional(o.sobreID),
  nota: texto(o.nota, ''), fecha: fecha(o.fecha),
})

const leerCuenta = (o) => sinVacios({
  ...o,
  id: idODefecto(o.id), nombre: texto(o.nombre), tipo: caso(o.tipo, TipoCuenta), saldoInicial: numero(o.saldoInicial), color: entero(o.color),
  limite: numero(o.limite, null),
})

const leerAbono = (o) => sinVacios({
  ...o, id: idODefecto(o.id), monto: numero(o.monto), fecha: fecha(o.fecha), nota: texto(o.nota, ''), movimientoID: idOpcional(o.movimientoID),
})

const leerDeuda = (o) => sinVacios({
  ...o,
  id: idODefecto(o.id), nombre: texto(o.nombre), persona: texto(o.persona, ''), direccion: caso(o.direccion, DireccionDeuda),
  montoTotal: numero(o.montoTotal), tasaAnual: numero(o.tasaAnual, null), cuotaMensual: numero(o.cuotaMensual, null),
  diaDePago: entero(o.diaDePago, null), fechaInicio: fecha(o.fechaInicio), fechaLimite: fechaOpcional(o.fechaLimite),
  nota: texto(o.nota, ''), abonos: lista(o.abonos).map(leerAbono), color: entero(o.color),
  cuentaID: idOpcional(o.cuentaID),
})

const leerMeta = (o) => sinVacios({
  ...o,
  id: idODefecto(o.id), nombre: texto(o.nombre), icono: texto(o.icono), objetivo: numero(o.objetivo),
  fechaObjetivo: fechaOpcional(o.fechaObjetivo), aportes: lista(o.aportes).map(leerAbono), color: entero(o.color),
})

/** Versión anterior de iPhone: solo tenía día del mes y último pago; se calcula el próximo cobro. */
function proximoCobroAnterior(o) {
  const dia = Number.isInteger(o.diaDelMes) ? o.diaDelMes : 1
  const ultimo = o.ultimoPago == null || Number.isNaN(Date.parse(o.ultimoPago)) ? null : mesDe(fecha(o.ultimoPago))
  const pagadoEsteMes = ultimo === mesActual()
  return instante(diaDelMes(dia, pagadoEsteMes ? sumarMes(mesActual(), 1) : mesActual()))
}

const leerPagoFijo = (o) => sinVacios({
  ...o,
  id: idODefecto(o.id), nombre: texto(o.nombre), monto: numero(o.monto), categoria: caso(o.categoria, Categoria),
  categoriaPropia: idOpcional(o.categoriaPropia),
  frecuencia: casoODefecto(o.frecuencia, Frecuencia, 'mensual'), diaDelMes: entero(o.diaDelMes),
  proximoCobro: o.proximoCobro == null ? proximoCobroAnterior(o) : fecha(o.proximoCobro),
  cuentaID: idOpcional(o.cuentaID), ultimoPago: fechaOpcional(o.ultimoPago),
  esSuscripcion: booleano(o.esSuscripcion, false), cancelada: booleano(o.cancelada, false),
  fechaCancelacion: fechaOpcional(o.fechaCancelacion), avisarDiasAntes: entero(o.avisarDiasAntes, 1),
})

const leerSobre = (o) => ({
  ...o,
  id: idODefecto(o.id), nombre: texto(o.nombre), icono: texto(o.icono), color: entero(o.color),
  categorias: lista(o.categorias).map((c) => caso(c, Categoria)), montoHabitual: numero(o.montoHabitual),
  categoriasPropias: lista(o.categoriasPropias).map(id),
  acumula: booleano(o.acumula, false), creado: o.creado == null ? ahora() : fecha(o.creado),
})

const leerCategoriaPropia = (o) => ({
  ...o,
  id: idODefecto(o.id), tipo: caso(o.tipo, { gasto: 1, ingreso: 1 }), nombre: texto(o.nombre), icono: texto(o.icono), color: entero(o.color),
})

function leerCategoriasBase(o) {
  if (typeof o !== 'object' || o === null || Array.isArray(o)) throw new Error('mapa')
  return Object.fromEntries(Object.entries(o).map(([clave, cambio]) => {
    caso(clave, Categoria)
    return [clave, sinVacios({
      ...cambio, nombre: texto(cambio.nombre, null), icono: texto(cambio.icono, null), color: entero(cambio.color, null),
      oculta: booleano(cambio.oculta, undefined),
    })]
  }))
}

/**
 * En el archivo, un registro con categoría propia guarda además una categoría normal («Otros»)
 * para que iPhone y Android lo sigan abriendo. Dentro de la app, `categoria` es directamente la propia.
 */
function aplicarPropia(registro, ids) {
  const { categoriaPropia, ...resto } = registro
  return categoriaPropia != null && ids.has(categoriaPropia) ? { ...resto, categoria: categoriaPropia } : resto
}

function aplicarPropiasSobre(sobre, ids) {
  const { categoriasPropias, ...resto } = sobre
  return { ...resto, categorias: [...resto.categorias, ...categoriasPropias.filter((c) => ids.has(c))] }
}

/** Lo contrario de lo anterior: prepara los datos para escribirlos en el archivo. */
export function aFormatoArchivo(datos) {
  const propias = new Map(datos.categoriasPropias.map((c) => [c.id, c]))
  const convertir = (registro) => {
    const propia = propias.get(registro.categoria)
    return propia ? { ...registro, categoria: categoriaOtros(propia.tipo), categoriaPropia: propia.id } : registro
  }
  return {
    ...datos,
    movimientos: datos.movimientos.map(convertir),
    pagosFijos: datos.pagosFijos.map(convertir),
    sobres: datos.sobres.map((s) => {
      const lasPropias = s.categorias.filter((c) => propias.has(c))
      if (lasPropias.length === 0) return s
      return { ...s, categorias: s.categorias.filter((c) => !propias.has(c)), categoriasPropias: lasPropias }
    }),
  }
}

function leerAjustes(o) {
  if (typeof o !== 'object' || Array.isArray(o)) throw new Error('ajustes')
  const base = ajustesIniciales()
  return sinVacios({
    ...o,
    nombre: texto(o.nombre, base.nombre), moneda: texto(o.moneda, base.moneda),
    bloqueo: booleano(o.bloqueo, base.bloqueo), recordatorios: booleano(o.recordatorios, base.recordatorios),
    apariencia: casoODefecto(o.apariencia, Apariencia, base.apariencia),
    montosEnWidget: booleano(o.montosEnWidget, base.montosEnWidget),
    respaldoAutomatico: booleano(o.respaldoAutomatico, base.respaldoAutomatico),
    ultimoRespaldo: fechaOpcional(o.ultimoRespaldo),
  })
}

function leerMontos(o) {
  if (typeof o !== 'object' || o === null || Array.isArray(o)) throw new Error('mapa')
  return Object.fromEntries(Object.entries(o).map(([k, v]) => [k, numero(v)]))
}

function leerAsignaciones(o) {
  if (typeof o !== 'object' || o === null || Array.isArray(o)) throw new Error('mapa')
  return Object.fromEntries(Object.entries(o).map(([mes, montos]) => [
    mes, Object.fromEntries(Object.entries(leerMontos(montos)).map(([k, v]) => [k.toUpperCase(), v])),
  ]))
}

/**
 * Lee el archivo de datos elemento por elemento: si un movimiento (o deuda, meta…) está dañado
 * se omite solo ese, en lugar de perder todo el archivo.
 * Lanza una excepción únicamente si el archivo no es JSON o no tiene la forma esperada.
 */
export function cargarTolerante(contenido) {
  const raiz = JSON.parse(contenido)
  if (typeof raiz !== 'object' || raiz === null || Array.isArray(raiz)) throw new Error('raíz')
  let descartados = 0

  const leerLista = (clave, leer) => {
    if (!Array.isArray(raiz[clave])) return []
    return raiz[clave].flatMap((elemento) => {
      try {
        return [leer(elemento)]
      } catch {
        descartados++
        return []
      }
    })
  }
  const leerValor = (clave, leer, porDefecto) => {
    if (raiz[clave] == null) return porDefecto
    try {
      return leer(raiz[clave])
    } catch {
      descartados++
      return porDefecto
    }
  }

  const categoriasPropias = leerLista('categoriasPropias', leerCategoriaPropia)
  const ids = new Set(categoriasPropias.map((c) => c.id))
  const datos = {
    cuentas: leerLista('cuentas', leerCuenta),
    movimientos: leerLista('movimientos', leerMovimiento).map((m) => aplicarPropia(m, ids)),
    deudas: leerLista('deudas', leerDeuda),
    metas: leerLista('metas', leerMeta),
    pagosFijos: leerLista('pagosFijos', leerPagoFijo).map((p) => aplicarPropia(p, ids)),
    sobres: leerLista('sobres', leerSobre).map((s) => aplicarPropiasSobre(s, ids)),
    asignaciones: leerValor('asignaciones', leerAsignaciones, {}),
    presupuestos: leerValor('presupuestos', leerMontos, {}),
    ajustes: leerValor('ajustes', leerAjustes, ajustesIniciales()),
    categoriasPropias,
    categoriasBase: leerValor('categoriasBase', leerCategoriasBase, {}),
  }
  return { datos, descartados }
}
