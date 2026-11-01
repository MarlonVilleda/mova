import { Categoria } from './modelos.js'

export const Limites = {
  montoMaximo: 999_999_999.99,
  nombre: 60,
  nombreCategoria: 30,
  nota: 200,
  tasaMaxima: 500,
  /** Tamaño máximo de un archivo de respaldo (evita abrir archivos enormes o maliciosos). */
  respaldoMaximoBytes: 20 * 1024 * 1024,
}

// MARK: - Montos

/**
 * Convierte lo escrito en el teclado ("12,50" o "12.50") en un monto válido, o null.
 * Rechaza letras, notación científica, negativos, más de 2 decimales y montos absurdos.
 */
export function comoMonto(entrada) {
  const texto = entrada.trim().replace(',', '.')
  if (!texto || texto.length > 16 || !/^\d*\.?\d{0,2}$/.test(texto) || texto === '.') return null
  const valor = Number(texto)
  if (!Number.isFinite(valor) || valor > Limites.montoMaximo) return null
  return Math.round(valor * 100) / 100
}

/** Limpia lo que se escribe en un campo de monto: solo dígitos, un separador y 2 decimales. */
export function saneadoComoMonto(entrada) {
  let resultado = ''
  let separador = false
  let decimales = 0
  for (const c of entrada) {
    if (c >= '0' && c <= '9') {
      if (separador) {
        if (decimales >= 2) continue
        decimales++
      }
      resultado += c
    } else if ((c === '.' || c === ',') && !separador) {
      separador = true
      if (!resultado) resultado = '0'
      resultado += c
    }
  }
  // Sin ceros a la izquierda innecesarios ("007" → "7").
  return resultado.replace(/^0+(?=\d)/, '').slice(0, 13)
}

/** Texto sin espacios sobrantes y recortado al largo máximo. */
export const limpio = (texto, max) => texto.trim().slice(0, max)

export const esMontoValido = (v) => Number.isFinite(v) && v >= 0 && v <= Limites.montoMaximo

/** Recibe pares [condición, mensaje] y devuelve el primer problema encontrado, o null si todo está bien. */
export const primerError = (...reglas) => reglas.find(([falla]) => falla)?.[1] ?? null

// MARK: - Validación de datos completos (al restaurar un respaldo)

export class ErrorDatos extends Error {}

export const monedaValida = (codigo) => typeof codigo === 'string' && /^[A-Z]{3}$/.test(codigo)

const esId = (texto) => /^[0-9A-F]{8}(-[0-9A-F]{4}){3}-[0-9A-F]{12}$/.test(texto)

/** Revisa que un respaldo no traiga montos imposibles, días fuera de rango o referencias rotas. */
export function validar(d) {
  const revisar = (ok, detalle) => {
    if (!ok) throw new ErrorDatos(`El respaldo tiene datos inválidos: ${detalle}.`)
  }
  const unicos = (lista) => new Set(lista.map((x) => x.id)).size === lista.length
  const enRango = (v, min, max) => v >= min && v <= max

  revisar(unicos(d.cuentas), 'cuentas repetidas')
  revisar(monedaValida(d.ajustes.moneda), 'moneda desconocida')

  for (const c of d.cuentas) {
    revisar(Math.abs(c.saldoInicial) <= Limites.montoMaximo, `saldo de ${c.nombre}`)
    revisar(c.limite == null || esMontoValido(c.limite), `límite de ${c.nombre}`)
  }
  for (const m of d.movimientos) {
    revisar(esMontoValido(m.monto) && m.monto > 0, 'monto de un movimiento')
    // Si una de las cuentas se eliminó, la transferencia queda con un lado vacío: eso es válido.
    if (m.tipo === 'transferencia' && m.cuentaID != null && m.cuentaDestinoID != null) {
      revisar(m.cuentaID !== m.cuentaDestinoID, 'transferencia a la misma cuenta')
    }
  }
  for (const x of d.deudas) {
    revisar(esMontoValido(x.montoTotal) && x.montoTotal > 0, `total de ${x.nombre}`)
    revisar(x.abonos.every((a) => esMontoValido(a.monto) && a.monto > 0), `pagos de ${x.nombre}`)
    revisar(x.cuotaMensual == null || esMontoValido(x.cuotaMensual), `cuota de ${x.nombre}`)
    revisar(x.tasaAnual == null || enRango(x.tasaAnual, 0, Limites.tasaMaxima), `interés de ${x.nombre}`)
    revisar(x.diaDePago == null || enRango(x.diaDePago, 1, 31), `día de pago de ${x.nombre}`)
  }
  for (const meta of d.metas) {
    revisar(esMontoValido(meta.objetivo) && meta.objetivo > 0, `objetivo de ${meta.nombre}`)
    revisar(meta.aportes.every((a) => Math.abs(a.monto) <= Limites.montoMaximo), `aportes de ${meta.nombre}`)
    revisar(meta.aportes.reduce((t, a) => t + a.monto, 0) >= -0.005, `saldo de ${meta.nombre}`)
  }
  for (const p of d.pagosFijos) {
    revisar(esMontoValido(p.monto) && p.monto > 0, `monto de ${p.nombre}`)
    revisar(enRango(p.diaDelMes, 1, 31), `día de ${p.nombre}`)
    revisar(enRango(p.avisarDiasAntes, 0, 30), `aviso de ${p.nombre}`)
  }
  revisar(unicos(d.sobres), 'sobres repetidos')
  const idsSobres = new Set(d.sobres.map((s) => s.id))
  for (const s of d.sobres) revisar(esMontoValido(s.montoHabitual), `monto habitual de ${s.nombre}`)
  for (const [mes, montos] of Object.entries(d.asignaciones)) {
    revisar(mes.length === 7, 'mes de una asignación')
    for (const [id, monto] of Object.entries(montos)) {
      revisar(esId(id) && idsSobres.has(id), 'sobre de una asignación')
      // Se permiten negativos: mover dinero entre sobres puede dejarlos en negativo.
      revisar(Math.abs(monto) <= Limites.montoMaximo, 'monto asignado')
    }
  }
  for (const [clave, limite] of Object.entries(d.presupuestos)) {
    revisar(Object.hasOwn(Categoria, clave), 'categoría de presupuesto')
    revisar(esMontoValido(limite) && limite > 0, 'límite de presupuesto')
  }
}
