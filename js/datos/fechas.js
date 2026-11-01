// Una fecha local es "2026-10-18" y un mes es "2026-10"; un instante es ISO sin fracciones de
// segundo ("2026-10-18T18:30:00Z"), el mismo formato que usan los respaldos de iPhone y Android.

const dos = (n) => String(n).padStart(2, '0')

const local = (d) => `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`

export const aISO = (d) => d.toISOString().replace(/\.\d+Z$/, 'Z')

export const ahora = () => aISO(new Date())
export const hoy = () => local(new Date())
export const mesActual = () => hoy().slice(0, 7)

export const fechaLocal = (iso) => local(new Date(iso))
export const mesDe = (iso) => fechaLocal(iso).slice(0, 7)

/** Fecha local como objeto Date a medianoche. */
export function aDate(fecha) {
  const [a, m, d] = fecha.split('-').map(Number)
  return new Date(a, m - 1, d)
}

/** Inicio del día (00:00 local) como instante. */
export const instante = (fecha) => aISO(aDate(fecha))

/** Fecha elegida en un formulario: conserva la hora actual si es hoy, para ordenar bien los movimientos del día. */
export function comoMomento(fecha) {
  if (fecha === hoy()) return ahora()
  const d = aDate(fecha)
  d.setHours(12)
  return aISO(d)
}

export function diasEnMes(mes) {
  const [a, m] = mes.split('-').map(Number)
  return new Date(a, m, 0).getDate()
}

/** El día indicado dentro del mes, ajustado si el mes es más corto (p. ej. 31 → 30). */
export const diaDelMes = (dia, mes) => `${mes}-${dos(Math.min(Math.max(dia, 1), diasEnMes(mes)))}`

export function sumarMes(mes, n) {
  const [a, m] = mes.split('-').map(Number)
  const d = new Date(a, m - 1 + n, 1)
  return local(d).slice(0, 7)
}

export function sumarDias(fecha, n) {
  const d = aDate(fecha)
  d.setDate(d.getDate() + n)
  return local(d)
}

/** Suma meses conservando el día; si el mes destino es más corto se usa su último día. */
export const sumarMeses = (fecha, n) => diaDelMes(Number(fecha.slice(8)), sumarMes(fecha.slice(0, 7), n))

export const sumarAnios = (fecha, n) => sumarMeses(fecha, n * 12)

/** Días desde hoy (negativo si ya pasó). */
export const diasDesdeHoy = (fecha) => diasEntre(hoy(), fecha)

export const diasEntre = (a, b) => Math.round((aDate(b) - aDate(a)) / 86_400_000)

/** Meses completos entre dos fechas. */
export function mesesEntre(a, b) {
  const signo = b < a ? -1 : 1
  const [menor, mayor] = b < a ? [b, a] : [a, b]
  const [a1, m1, d1] = menor.split('-').map(Number)
  const [a2, m2, d2] = mayor.split('-').map(Number)
  let meses = (a2 - a1) * 12 + (m2 - m1)
  if (d2 < d1) meses--
  return signo * meses
}

export function textoRelativo(fecha) {
  const d = diasDesdeHoy(fecha)
  if (d === 0) return 'Hoy'
  if (d === 1) return 'Mañana'
  if (d === -1) return 'Ayer'
  return d < 0 ? `Venció hace ${-d} días` : `En ${d} días`
}
