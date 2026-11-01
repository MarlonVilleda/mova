// Combina los cambios de dos dispositivos a partir de la última versión que ambos conocían.
// Lo que solo cambió de un lado se conserva; si los dos cambiaron el mismo campo, gana el local.

function ordenar(v) {
  if (Array.isArray(v)) return v.map(ordenar)
  if (v && typeof v === 'object') {
    return Object.fromEntries(Object.keys(v).sort().map((k) => [k, ordenar(v[k])]))
  }
  return v
}

/** Texto comparable de un valor: Postgres puede devolver las claves en otro orden. */
export const canonico = (v) => JSON.stringify(ordenar(v))
export const iguales = (a, b) => canonico(a) === canonico(b)

const esObjeto = (v) => v != null && typeof v === 'object' && !Array.isArray(v)
const esListaConIds = (v) => Array.isArray(v) && v.every((x) => esObjeto(x) && x.id != null)

function combinarLista(base, local, remoto) {
  const anteriores = new Map(base.map((x) => [x.id, x]))
  const locales = new Map(local.map((x) => [x.id, x]))
  const remotos = new Map(remoto.map((x) => [x.id, x]))
  const ids = [...new Set([...remoto.map((x) => x.id), ...local.map((x) => x.id)])]
  return ids.flatMap((id) => {
    const anterior = anteriores.get(id)
    const l = locales.get(id)
    const r = remotos.get(id)
    // Si un lado lo borró y el otro lo editó, se conserva: es peor perder un registro que recuperar uno borrado.
    if (l === undefined) return iguales(r, anterior) ? [] : [r]
    if (r === undefined) return iguales(l, anterior) ? [] : [l]
    return [combinarValor(anterior, l, r)]
  })
}

function combinarObjeto(base, local, remoto) {
  const resultado = {}
  for (const k of new Set([...Object.keys(remoto), ...Object.keys(local)])) {
    const v = combinarValor(base[k], local[k], remoto[k])
    if (v !== undefined) resultado[k] = v
  }
  return resultado
}

function combinarValor(base, local, remoto) {
  if (iguales(local, remoto)) return local
  if (iguales(local, base)) return remoto
  if (iguales(remoto, base)) return local
  if (esListaConIds(local) && esListaConIds(remoto)) return combinarLista(esListaConIds(base) ? base : [], local, remoto)
  if (esObjeto(local) && esObjeto(remoto)) return combinarObjeto(esObjeto(base) ? base : {}, local, remoto)
  return local
}

export const combinar = (base, local, remoto) => combinarObjeto(base ?? {}, local, remoto)
