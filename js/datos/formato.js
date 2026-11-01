import { aDate } from './fechas.js'

const idioma = globalThis.navigator?.language ?? 'es'
/** La app está en español: si el navegador está en otro idioma, las fechas también van en español. */
const locale = idioma.toLowerCase().startsWith('es') ? idioma : 'es'

const monedaPorRegion = {
  US: 'USD', MX: 'MXN', GT: 'GTQ', HN: 'HNL', NI: 'NIO', CR: 'CRC', PA: 'PAB', DO: 'DOP', CO: 'COP', PE: 'PEN',
  CL: 'CLP', AR: 'ARS', BO: 'BOB', PY: 'PYG', UY: 'UYU', VE: 'VES', BR: 'BRL', CA: 'CAD', GB: 'GBP', ES: 'EUR',
}

export function monedaDelDispositivo() {
  try {
    return monedaPorRegion[new Intl.Locale(idioma).region] ?? 'USD'
  } catch {
    return 'USD'
  }
}

export const Formato = { moneda: monedaDelDispositivo() }

const formatos = new Map()

function formatoMoneda(codigo, decimales) {
  const clave = `${codigo}-${decimales}`
  if (!formatos.has(clave)) {
    const digitos = decimales ? 2 : 0
    const opciones = { style: 'currency', currency: codigo, maximumFractionDigits: digitos, minimumFractionDigits: digitos }
    let formato
    try {
      formato = new Intl.NumberFormat(locale, { ...opciones, currencyDisplay: 'narrowSymbol' })
    } catch {
      formato = new Intl.NumberFormat(locale, opciones)
    }
    formatos.set(clave, formato)
  }
  return formatos.get(clave)
}

export function dinero(valor, decimales = true, codigo = Formato.moneda) {
  // Evita mostrar "-0".
  return formatoMoneda(codigo, decimales).format(Math.abs(valor) < 0.005 ? 0 : valor)
}

export const dineroCorto = (valor) => dinero(valor, false)

export function simboloMoneda() {
  return formatoMoneda(Formato.moneda, true).formatToParts(0).find((p) => p.type === 'currency')?.value ?? Formato.moneda
}

export function nombreMoneda(codigo) {
  try {
    return new Intl.DisplayNames(locale, { type: 'currency' }).of(codigo) ?? codigo
  } catch {
    return codigo
  }
}

const formatoPorcentaje = new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 0 })
const formatoPorcentajeFino = new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 2 })

export const porcentaje = (valor) => formatoPorcentaje.format(valor)
export const porcentajeFino = (valor) => formatoPorcentajeFino.format(valor)

/** Monto para poner en un campo de texto: sin separador de miles, hasta 2 decimales ("1250.5"). */
export const textoEditable = (valor) => String(Math.round(valor * 100) / 100)

const mayuscula = (s) => s.charAt(0).toLocaleUpperCase(locale) + s.slice(1)
const parte = (fecha, opciones) => new Intl.DateTimeFormat(locale, opciones).format(aDate(fecha))

export const textoFecha = (fecha) => parte(fecha, { dateStyle: 'medium' })

/** "18 oct" */
export const textoDiaMes = (fecha) => `${Number(fecha.slice(8))} ${parte(fecha, { month: 'short' }).replace(/\.$/, '')}`

/** "Sábado 18 de octubre" */
export const textoDiaLargo = (fecha) =>
  mayuscula(`${parte(fecha, { weekday: 'long' })} ${Number(fecha.slice(8))} de ${parte(fecha, { month: 'long' })}`)

export const nombreMes = (mes) => parte(`${mes}-01`, { month: 'long' })
export const nombreMesCorto = (mes) => parte(`${mes}-01`, { month: 'short' }).replace(/\.$/, '')
export const nombreMesAnio = (mes) => `${mayuscula(nombreMes(mes))} ${mes.slice(0, 4)}`
export const mesConMayuscula = (mes) => mayuscula(nombreMes(mes))
