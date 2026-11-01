import { ahora, diaDelMes, diasDesdeHoy, diasEntre, fechaLocal, hoy, instante, mesActual, mesDe, mesesEntre, sumarAnios, sumarDias, sumarMes } from './fechas.js'
import { monedaDelDispositivo } from './formato.js'

// Los nombres de los casos y de los campos son iguales a los de iPhone y Android
// para que un respaldo de una plataforma se pueda restaurar en otra.

export const Tonos = {
  cian: 'turquesa', acento: 'azul', ingreso: 'menta', gasto: 'coral', deuda: 'ambar',
  /** Colores que el usuario elige por índice (el mismo orden que en iPhone). */
  elegibles: ['azul', 'turquesa', 'rosa', 'ambar', 'menta', 'cielo', 'coral', 'lima', 'violeta', 'durazno'],
}

export const deIndice = (i) => Tonos.elegibles[Math.abs(i) % Tonos.elegibles.length]

// MARK: - Movimientos

export const TipoMovimiento = {
  gasto: { nombre: 'Gasto', icono: 'arrow.up.right', tono: Tonos.gasto },
  ingreso: { nombre: 'Ingreso', icono: 'arrow.down.left', tono: Tonos.ingreso },
  transferencia: { nombre: 'Transferencia', icono: 'arrow.left.arrow.right', tono: 'cielo' },
}

export const Categoria = {
  // Gastos
  comida: { nombre: 'Comida', icono: 'fork.knife', tono: 'durazno' },
  supermercado: { nombre: 'Súper', icono: 'cart', tono: 'lima' },
  transporte: { nombre: 'Transporte', icono: 'car', tono: 'cielo' },
  vivienda: { nombre: 'Vivienda', icono: 'house', tono: 'lavanda' },
  servicios: { nombre: 'Servicios', icono: 'bolt', tono: 'ambar' },
  internet: { nombre: 'Internet y cel.', icono: 'wifi', tono: 'turquesa' },
  salud: { nombre: 'Salud', icono: 'heart', tono: 'coral' },
  entretenimiento: { nombre: 'Ocio', icono: 'popcorn', tono: 'rosa' },
  compras: { nombre: 'Compras', icono: 'bag', tono: 'violeta' },
  ropa: { nombre: 'Ropa', icono: 'tshirt', tono: 'rosa' },
  educacion: { nombre: 'Educación', icono: 'book', tono: 'cielo' },
  viajes: { nombre: 'Viajes', icono: 'airplane', tono: 'turquesa' },
  mascotas: { nombre: 'Mascotas', icono: 'pawprint', tono: 'durazno' },
  suscripciones: { nombre: 'Suscripciones', icono: 'repeat', tono: 'lavanda' },
  regalos: { nombre: 'Regalos', icono: 'gift', tono: 'coral' },
  deudas: { nombre: 'Deudas', icono: 'creditcard', tono: 'ambar' },
  otrosGastos: { nombre: 'Otros', icono: 'circle.grid.2x2', tono: 'gris' },
  // Ingresos
  salario: { nombre: 'Salario', icono: 'briefcase', tono: 'menta' },
  negocio: { nombre: 'Negocio', icono: 'storefront', tono: 'lima' },
  freelance: { nombre: 'Freelance', icono: 'laptopcomputer', tono: 'turquesa' },
  inversion: { nombre: 'Inversiones', icono: 'chart.line.uptrend.xyaxis', tono: 'violeta' },
  reembolso: { nombre: 'Reembolsos', icono: 'arrow.uturn.backward', tono: 'cielo' },
  prestamos: { nombre: 'Préstamos', icono: 'hand.raised', tono: 'ambar' },
  otrosIngresos: { nombre: 'Otros', icono: 'sparkles', tono: 'menta' },
  // Transferencias
  transferencia: { nombre: 'Transferencia', icono: 'arrow.left.arrow.right', tono: 'cielo' },
}

export const categoriasDeGasto = [
  'comida', 'supermercado', 'transporte', 'vivienda', 'servicios', 'internet', 'salud', 'entretenimiento',
  'compras', 'ropa', 'educacion', 'viajes', 'mascotas', 'suscripciones', 'regalos', 'deudas', 'otrosGastos',
]
export const categoriasDeIngreso = ['salario', 'negocio', 'freelance', 'inversion', 'reembolso', 'prestamos', 'otrosIngresos']

export function categoriasPara(tipo) {
  if (tipo === 'gasto') return categoriasDeGasto
  if (tipo === 'ingreso') return categoriasDeIngreso
  return ['transferencia']
}

/** Categorías donde caen los movimientos de una categoría propia eliminada; no se pueden eliminar. */
export const categoriaOtros = (tipo) => (tipo === 'ingreso' ? 'otrosIngresos' : 'otrosGastos')
export const categoriasFijas = ['otrosGastos', 'otrosIngresos', 'transferencia']

export const iconosCategoria = [...new Set([...Object.values(Categoria).map((c) => c.icono), ...iconosComunes()])]

function iconosComunes() {
  return ['star', 'shield', 'leaf', 'banknote', 'camera', 'gamecontroller', 'graduationcap', 'iphone', 'envelope', 'calendar']
}

export function nuevoId() {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID().toUpperCase()
  // randomUUID solo existe en HTTPS; con http en la red local se arma a mano.
  const b = crypto.getRandomValues(new Uint8Array(16))
  b[6] = (b[6] & 0x0f) | 0x40
  b[8] = (b[8] & 0x3f) | 0x80
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`.toUpperCase()
}

/** Positivo para ingresos, negativo para gastos, cero para transferencias. */
export function efectoNeto(m) {
  if (m.tipo === 'ingreso') return m.monto
  return m.tipo === 'gasto' ? -m.monto : 0
}

// MARK: - Cuentas

export const TipoCuenta = {
  efectivo: { nombre: 'Efectivo', icono: 'banknote' },
  banco: { nombre: 'Cuenta bancaria', icono: 'building.columns' },
  tarjeta: { nombre: 'Tarjeta de crédito', icono: 'creditcard' },
  ahorro: { nombre: 'Ahorro', icono: 'leaf' },
  inversion: { nombre: 'Inversión', icono: 'chart.line.uptrend.xyaxis' },
}

// MARK: - Deudas

export const DireccionDeuda = {
  yoDebo: { nombre: 'Yo debo', tono: Tonos.deuda },
  meDeben: { nombre: 'Me deben', tono: Tonos.cian },
}

const suma = (lista, f) => lista.reduce((total, x) => total + f(x), 0)

export const pagado = (d) => suma(d.abonos, (a) => a.monto)
export const restante = (d) => Math.max(d.montoTotal - pagado(d), 0)
export const progresoDeuda = (d) => (d.montoTotal > 0 ? Math.min(pagado(d) / d.montoTotal, 1) : 0)
export const liquidada = (d) => restante(d) < 0.005
export const abonadoEsteMes = (d) => d.abonos.some((a) => mesDe(a.fecha) === mesActual())

/** Próxima fecha de pago según el día del mes configurado (ajustado a meses cortos). */
export function proximoPago(d) {
  if (d.diaDePago == null || liquidada(d)) return null
  return diaDelMes(d.diaDePago, abonadoEsteMes(d) ? sumarMes(mesActual(), 1) : mesActual())
}

/** Lo que toca pagar en la próxima cuota. */
export const montoProximaCuota = (d) => Math.min(d.cuotaMensual ?? restante(d), restante(d))

export function mesesRestantes(d) {
  if (d.cuotaMensual == null || d.cuotaMensual <= 0 || liquidada(d)) return null
  return Math.ceil(restante(d) / d.cuotaMensual)
}

// MARK: - Planeación

export const iconosMeta = [
  'star', 'house', 'car', 'airplane', 'laptopcomputer', 'iphone', 'graduationcap',
  'heart', 'gift', 'shield', 'leaf', 'pawprint', 'camera', 'gamecontroller',
]

export const ahorrado = (m) => suma(m.aportes, (a) => a.monto)
export const faltante = (m) => Math.max(m.objetivo - ahorrado(m), 0)
export const progresoMeta = (m) => (m.objetivo > 0 ? Math.min(Math.max(ahorrado(m) / m.objetivo, 0), 1) : 0)
export const cumplida = (m) => faltante(m) < 0.005

/** Cuánto apartar al mes para llegar a tiempo. */
export function sugeridoMensual(m) {
  if (m.fechaObjetivo == null || cumplida(m)) return null
  return faltante(m) / Math.max(mesesEntre(hoy(), fechaLocal(m.fechaObjetivo)), 1)
}

export const Frecuencia = {
  semanal: { nombre: 'Semanal', vecesPorMes: 52 / 12 },
  mensual: { nombre: 'Mensual', vecesPorMes: 1 },
  anual: { nombre: 'Anual', vecesPorMes: 1 / 12 },
}

export const fechaCobro = (p) => fechaLocal(p.proximoCobro)

/** Costo equivalente por mes y por año, para comparar suscripciones. */
export const costoMensual = (p) => p.monto * Frecuencia[p.frecuencia].vecesPorMes
export const costoAnual = (p) => costoMensual(p) * 12
export const vencido = (p) => !p.cancelada && diasDesdeHoy(fechaCobro(p)) < 0

/** Fecha del cobro siguiente a `fecha`. */
export function siguienteCobro(p, fecha) {
  if (p.frecuencia === 'semanal') return sumarDias(fecha, 7)
  if (p.frecuencia === 'anual') return sumarAnios(fecha, 1)
  return diaDelMes(p.diaDelMes, sumarMes(fecha.slice(0, 7), 1))
}

/** ¿Se pagó hace poco (dentro del último periodo)? */
export function pagadoReciente(p) {
  if (p.ultimoPago == null) return false
  const dias = diasEntre(fechaLocal(p.ultimoPago), hoy())
  if (p.frecuencia === 'semanal') return dias < 3
  return p.frecuencia === 'mensual' ? dias < 10 : dias < 30
}

export const nuevoPagoFijo = ({ nombre, monto, categoria, proximoCobro }) => ({
  id: nuevoId(), nombre, monto, categoria, frecuencia: 'mensual',
  diaDelMes: Number(proximoCobro.slice(8)), proximoCobro: instante(proximoCobro),
  esSuscripcion: false, cancelada: false, avisarDiasAntes: 1,
})

/** Suscripciones populares para llenar el formulario con un toque. */
export const suscripcionesPopulares = [
  ['Netflix', 15.49], ['Spotify', 11.99], ['YouTube Premium', 13.99], ['Disney+', 10.99],
  ['Max', 16.99], ['Prime Video', 8.99], ['Apple Music', 10.99], ['Google One', 1.99],
  ['ChatGPT Plus', 20], ['Xbox Game Pass', 19.99], ['PlayStation Plus', 9.99], ['Gimnasio', 30],
]

// MARK: - Sobres

export const iconosSobre = [
  'fork.knife', 'cart', 'house', 'car', 'bolt', 'heart', 'popcorn', 'bag', 'tshirt', 'book',
  'airplane', 'pawprint', 'gift', 'leaf', 'creditcard', 'star', 'shield', 'banknote',
]

export const nuevoSobre = (campos) => ({
  id: nuevoId(), acumula: false, creado: ahora(), montoHabitual: 0, categorias: [], ...campos,
})

export const sobresSugeridos = () => [
  nuevoSobre({ nombre: 'Vivienda', icono: 'house', color: 8, categorias: ['vivienda', 'servicios', 'internet'] }),
  nuevoSobre({ nombre: 'Comida', icono: 'fork.knife', color: 9, categorias: ['comida', 'supermercado'] }),
  nuevoSobre({ nombre: 'Transporte', icono: 'car', color: 5, categorias: ['transporte'] }),
  nuevoSobre({ nombre: 'Salud', icono: 'heart', color: 6, categorias: ['salud'] }),
  nuevoSobre({ nombre: 'Ocio', icono: 'popcorn', color: 2, categorias: ['entretenimiento', 'suscripciones', 'viajes'] }),
  nuevoSobre({ nombre: 'Compras', icono: 'bag', color: 3, categorias: ['compras', 'ropa', 'regalos'] }),
  nuevoSobre({ nombre: 'Deudas', icono: 'creditcard', color: 7, categorias: ['deudas'] }),
  nuevoSobre({ nombre: 'Ahorro', icono: 'leaf', color: 4, acumula: true }),
]

// MARK: - Ajustes y contenedor

export const Apariencia = {
  automatica: { nombre: 'Automática' },
  clara: { nombre: 'Clara' },
  oscura: { nombre: 'Oscura' },
}

/** `bloqueo`, `recordatorios` y `montosEnWidget` no se usan en la web, pero se conservan en los respaldos. */
export const ajustesIniciales = () => ({
  nombre: '', moneda: monedaDelDispositivo(), bloqueo: false, recordatorios: false,
  apariencia: 'automatica', montosEnWidget: true, respaldoAutomatico: true,
})

export const datosVacios = () => ({
  cuentas: [], movimientos: [], deudas: [], metas: [], pagosFijos: [], sobres: [],
  asignaciones: {}, presupuestos: {}, ajustes: ajustesIniciales(),
  // Solo existen en la web; iPhone y Android los ignoran al abrir un respaldo.
  categoriasPropias: [], categoriasBase: {},
})

export const datosIniciales = () => ({
  ...datosVacios(),
  cuentas: [{ id: nuevoId(), nombre: 'Efectivo', tipo: 'efectivo', saldoInicial: 0, color: 4 }],
})
