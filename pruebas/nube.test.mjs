import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { Almacen } from '../js/datos/almacen.js'
import { combinar, iguales } from '../js/datos/combinar.js'
import { Nube, estaSinUsar } from '../js/datos/nube.js'

const respaldo = readFileSync(new URL('./respaldo-android.json', import.meta.url), 'utf8')
const USUARIO = 'U1'
const MA = 'AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA'
const MB = 'BBBBBBBB-BBBB-4BBB-8BBB-BBBBBBBBBBBB'

const respuesta = (cuerpo, status = 200) => ({ ok: status < 400, status, json: async () => JSON.parse(JSON.stringify(cuerpo)) })

/** Imita a Supabase: una fila por usuario y escritura condicionada a la versión. */
function servidor() {
  const s = { fila: null, llamadas: [], fallar: false, alLeer: null }
  s.pedir = async (url, op = {}) => {
    if (s.fallar) throw new Error('red')
    s.llamadas.push(`${op.method ?? 'GET'} ${url}`)
    if (url.includes('/auth/v1/token') && JSON.parse(op.body).password === 'mala') {
      return respuesta({ error_code: 'invalid_credentials' }, 400)
    }
    if (url.includes('/auth/v1/token') || url.includes('/auth/v1/logout')) {
      return respuesta({ access_token: `t${s.llamadas.length}`, refresh_token: 'r', expires_in: 3600, user: { id: USUARIO, email: 'yo@correo.com' } })
    }
    if (url.includes('mova_dispositivos')) {
      s.dispositivos = [...(s.dispositivos ?? []), { url, cuerpo: op.body, method: op.method }]
      return respuesta([])
    }
    if (op.method === 'POST') {
      if (s.fila) return respuesta({ code: '23505' }, 409)
      s.fila = JSON.parse(op.body)
      return respuesta([s.fila], 201)
    }
    if (op.method === 'PATCH') {
      const version = Number(url.match(/version=eq\.(\d+)/)[1])
      if (s.fila.version !== version) return respuesta([])
      s.fila = { ...s.fila, ...JSON.parse(op.body) }
      return respuesta([s.fila])
    }
    const resultado = s.fila ? [{ contenido: s.fila.contenido, version: s.fila.version }] : []
    s.alLeer?.()
    return respuesta(resultado)
  }
  return s
}

const memoria = () => {
  const m = new Map()
  return { m, leer: async (k) => m.get(k), escribir: async (k, v) => { m.set(k, v) } }
}

async function dispositivo(s, contenido) {
  const persistencia = memoria()
  if (contenido) persistencia.m.set('mova.json', contenido)
  const almacen = new Almacen(persistencia)
  await almacen.iniciar()
  const nube = new Nube({ almacen, persistencia, url: 'https://x', clave: 'k', pedir: s.pedir })
  await nube.iniciar()
  return { almacen, nube }
}

const entrar = (d) => d.nube.entrar('yo@correo.com', 'buena-clave')
const gasto = (id, monto = 10) => ({ id, tipo: 'gasto', monto, categoria: 'comida', nota: '', fecha: '2026-10-05T12:00:00Z' })

test('combinar conserva lo que cambió cada lado', () => {
  const base = { lista: [{ id: 1, a: 1, b: 1 }, { id: 2, a: 2 }, { id: 3, a: 3 }], ajustes: { x: 1, y: 1 } }
  const local = { lista: [{ id: 1, a: 9, b: 1 }, { id: 3, a: 3 }, { id: 4, a: 4 }], ajustes: { x: 2, y: 1 } }
  const remoto = { lista: [{ id: 1, a: 1, b: 8 }, { id: 2, a: 2 }, { id: 5, a: 5 }], ajustes: { x: 1, y: 3 } }
  const r = combinar(base, local, remoto)
  assert.deepEqual(r.lista.find((x) => x.id === 1), { id: 1, a: 9, b: 8 })
  assert.equal(r.lista.some((x) => x.id === 2), false, 'borrado en local')
  assert.equal(r.lista.some((x) => x.id === 3), false, 'borrado en remoto')
  assert.ok(r.lista.some((x) => x.id === 4))
  assert.ok(r.lista.some((x) => x.id === 5))
  assert.deepEqual(r.ajustes, { x: 2, y: 3 })
})

test('combinar no pierde un registro editado en un lado y borrado en otro', () => {
  const base = { lista: [{ id: 1, a: 1 }] }
  assert.equal(combinar(base, { lista: [] }, { lista: [{ id: 1, a: 2 }] }).lista.length, 1)
  assert.equal(combinar(base, { lista: [{ id: 1, a: 2 }] }, { lista: [] }).lista.length, 1)
})

test('combinar junta los abonos de la misma deuda', () => {
  const deuda = (abonos) => ({ deudas: [{ id: 'D', abonos }] })
  const r = combinar(deuda([{ id: 1 }]), deuda([{ id: 1 }, { id: 2 }]), deuda([{ id: 1 }, { id: 3 }]))
  assert.deepEqual(r.deudas[0].abonos.map((a) => a.id).sort(), [1, 2, 3])
})

test('iguales no depende del orden de las claves', () => {
  assert.ok(iguales({ a: 1, b: { c: 2, d: 3 } }, { b: { d: 3, c: 2 }, a: 1 }))
})

test('un dispositivo nuevo sin usar es reconocido', async () => {
  const a = await dispositivo(servidor())
  assert.ok(estaSinUsar(JSON.parse(a.almacen.exportarRespaldo())))
  const b = await dispositivo(servidor(), respaldo)
  assert.equal(estaSinUsar(JSON.parse(b.almacen.exportarRespaldo())), false)
})

test('el primer dispositivo sube sus datos y el segundo los recibe sin duplicar', async () => {
  const s = servidor()
  const a = await dispositivo(s, respaldo)
  await entrar(a)
  assert.equal(s.fila.contenido.movimientos.length, 3)

  const b = await dispositivo(s)
  await entrar(b)
  assert.equal(b.almacen.datos.movimientos.length, 3)
  assert.equal(b.almacen.datos.cuentas.length, 2, 'no agrega la cuenta Efectivo inicial')
  assert.equal(b.almacen.saldoTotal, a.almacen.saldoTotal)
  assert.equal(s.fila.version, 1)
})

test('un cambio en un dispositivo llega al otro', async () => {
  const s = servidor()
  const a = await dispositivo(s, respaldo)
  await entrar(a)
  const b = await dispositivo(s)
  await entrar(b)

  a.almacen.guardarMovimiento(gasto(MA))
  assert.equal(await a.nube.sincronizar(), true)
  await b.nube.sincronizar()
  assert.ok(b.almacen.datos.movimientos.some((m) => m.id === MA))

  b.almacen.eliminarMovimiento({ id: MA })
  await b.nube.sincronizar()
  await a.nube.sincronizar()
  assert.equal(a.almacen.datos.movimientos.some((m) => m.id === MA), false)
})

test('cambios sin conexión en dos dispositivos se juntan', async () => {
  const s = servidor()
  const a = await dispositivo(s, respaldo)
  await entrar(a)
  const b = await dispositivo(s)
  await entrar(b)

  a.almacen.guardarMovimiento(gasto(MA))
  b.almacen.guardarMovimiento(gasto(MB))
  await a.nube.sincronizar()
  await b.nube.sincronizar()
  await a.nube.sincronizar()
  for (const d of [a, b]) {
    const ids = d.almacen.datos.movimientos.map((m) => m.id)
    assert.ok(ids.includes(MA) && ids.includes(MB))
  }
})

test('si otro dispositivo escribe en medio, nadie pierde nada', async () => {
  const s = servidor()
  const a = await dispositivo(s, respaldo)
  await entrar(a)
  const b = await dispositivo(s)
  await entrar(b)
  a.almacen.guardarMovimiento(gasto(MA))
  b.almacen.guardarMovimiento(gasto(MB))

  // Justo después de que A lee, B sube sus cambios: el PATCH de A falla por versión y debe repetir.
  let una = true
  s.alLeer = () => {
    if (!una) return
    una = false
    s.fila = {
      ...s.fila, version: s.fila.version + 1,
      contenido: { ...s.fila.contenido, movimientos: [...s.fila.contenido.movimientos, gasto(MB)] },
    }
  }
  assert.equal(await a.nube.sincronizar(), true)
  const ids = s.fila.contenido.movimientos.map((m) => m.id)
  assert.ok(ids.includes(MA) && ids.includes(MB))
})

test('sin conexión se avisa y los cambios se suben después', async () => {
  const s = servidor()
  const a = await dispositivo(s, respaldo)
  await entrar(a)
  s.fallar = true
  a.almacen.guardarMovimiento(gasto(MA))
  assert.equal(await a.nube.sincronizar(), false)
  assert.match(a.nube.error, /Sin conexión/)
  s.fallar = false
  assert.equal(await a.nube.sincronizar(), true)
  assert.equal(a.nube.error, null)
  assert.ok(s.fila.contenido.movimientos.some((m) => m.id === MA))
})

test('el token vencido se renueva', async () => {
  const s = servidor()
  const a = await dispositivo(s, respaldo)
  await entrar(a)
  a.nube.sesion.expira = 0
  await a.nube.sincronizar()
  assert.ok(s.llamadas.some((l) => l.includes('grant_type=refresh_token')))
})

test('la contraseña incorrecta da un mensaje claro y no guarda sesión', async () => {
  const a = await dispositivo(servidor())
  await assert.rejects(a.nube.entrar('yo@correo.com', 'mala'), /Correo o contraseña incorrectos/)
  assert.equal(a.nube.sesion, null)
})

test('la sesión sobrevive al reabrir', async () => {
  const s = servidor()
  const a = await dispositivo(s, respaldo)
  await entrar(a)
  const otra = new Nube({ almacen: a.almacen, persistencia: a.almacen.persistencia, url: 'https://x', clave: 'k', pedir: s.pedir })
  await otra.iniciar()
  assert.equal(otra.sesion.correo, 'yo@correo.com')
})

test('cerrar sesión sube lo pendiente y limpia el dispositivo', async () => {
  const s = servidor()
  const a = await dispositivo(s, respaldo)
  await entrar(a)
  a.almacen.guardarMovimiento(gasto(MA))
  await a.nube.salir()
  assert.ok(s.fila.contenido.movimientos.some((m) => m.id === MA))
  assert.equal(a.almacen.datos.movimientos.length, 0)
  assert.equal(a.nube.sesion, null)
})

test('sin internet no se cierra sesión', async () => {
  const s = servidor()
  const a = await dispositivo(s, respaldo)
  await entrar(a)
  s.fallar = true
  await assert.rejects(a.nube.salir(), /Conéctate/)
  assert.equal(a.almacen.datos.movimientos.length, 3)
})

test('sin cuenta no se llama a la red', async () => {
  const s = servidor()
  const a = await dispositivo(s, respaldo)
  assert.equal(await a.nube.sincronizar(), false)
  a.nube.alGuardar()
  assert.equal(s.llamadas.length, 0)
})

test('cada dispositivo se anota una vez y puede cerrar los demás', async () => {
  const s = servidor()
  const a = await dispositivo(s, respaldo)
  a.nube.infoDispositivo = () => ({ nombre: 'iPhone', plataforma: 'iphone', metodo: 'Face ID o Touch ID', bloqueo: true })
  await entrar(a)
  await a.nube.sincronizar()
  assert.equal(s.dispositivos.length, 1)
  const fila = JSON.parse(s.dispositivos[0].cuerpo)
  assert.equal(fila.plataforma, 'iphone')
  assert.equal(fila.bloqueo, true)
  assert.ok(s.dispositivos[0].url.includes('on_conflict=id'))
  await a.nube.cerrarOtrosDispositivos()
  assert.ok(s.llamadas.some((l) => l.includes('/auth/v1/logout?scope=others')))
  assert.ok(s.dispositivos.at(-1).url.includes(`id=neq.${fila.id}`))
})
