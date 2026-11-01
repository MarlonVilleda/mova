import assert from 'node:assert/strict'
import { test } from 'node:test'
import { Bloqueo, ErrorBloqueo, detectarDispositivo } from '../js/datos/biometria.js'

const memoria = () => {
  const m = new Map()
  return { m, leer: async (k) => m.get(k), escribir: async (k, v) => { m.set(k, v) } }
}

const banderas = (verificado) => {
  const datos = new Uint8Array(37)
  datos[32] = verificado ? 0x05 : 0x01
  return datos.buffer
}

function credenciales({ verificado = true, error = null } = {}) {
  const c = {
    creadas: 0, pedidas: [],
    create: async (o) => {
      if (error) throw Object.assign(new Error('x'), { name: error })
      c.creadas++
      c.opciones = o.publicKey
      return { rawId: new Uint8Array([1, 2, 3]).buffer }
    },
    get: async (o) => {
      if (error) throw Object.assign(new Error('x'), { name: error })
      c.pedidas.push(o.publicKey)
      return { response: { authenticatorData: banderas(verificado) } }
    },
  }
  return c
}

test('reconoce cada dispositivo y su desbloqueo', () => {
  const iphone = detectarDispositivo({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)', maxTouchPoints: 5 })
  assert.equal(iphone.plataforma, 'iphone')
  assert.match(iphone.metodo, /Face ID/)
  const android = detectarDispositivo({ userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8)', maxTouchPoints: 5 })
  assert.equal(android.plataforma, 'android')
  assert.equal(android.metodo, 'huella o PIN')
  assert.equal(detectarDispositivo({ userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', maxTouchPoints: 5 }).plataforma, 'ipad')
  assert.equal(detectarDispositivo({ userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', maxTouchPoints: 0 }).plataforma, 'mac')
  assert.equal(detectarDispositivo({ userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', maxTouchPoints: 0 }).metodo, 'Windows Hello')
  assert.equal(detectarDispositivo({ userAgent: 'raro' }).plataforma, 'otro')
})

test('activar pide el desbloqueo del dispositivo y queda guardado', async () => {
  const c = credenciales()
  const p = memoria()
  const b = new Bloqueo({ persistencia: p, credenciales: c })
  await b.iniciar()
  assert.equal(b.bloqueado, false)
  await b.activar({ usuario: 'U', correo: 'yo@correo.com' })
  assert.equal(c.opciones.authenticatorSelection.authenticatorAttachment, 'platform')
  assert.equal(c.opciones.authenticatorSelection.userVerification, 'required')
  assert.ok(b.activo)

  const otra = new Bloqueo({ persistencia: p, credenciales: c })
  await otra.iniciar()
  assert.equal(otra.bloqueado, true)
  await otra.desbloquear()
  assert.equal(otra.bloqueado, false)
  assert.deepEqual([...c.pedidas[0].allowCredentials[0].id], [1, 2, 3])
})

test('cancelar no activa ni desbloquea', async () => {
  const p = memoria()
  const b = new Bloqueo({ persistencia: p, credenciales: credenciales({ error: 'NotAllowedError' }) })
  await b.iniciar()
  await assert.rejects(b.activar({ usuario: 'U', correo: 'c' }), ErrorBloqueo)
  assert.equal(b.activo, false)

  p.m.set('bloqueo-credencial', 'AQID')
  await b.iniciar()
  await assert.rejects(b.desbloquear(), /Se canceló/)
  assert.equal(b.bloqueado, true)
})

test('no abre si el dispositivo no verificó a la persona', async () => {
  const p = memoria()
  p.m.set('bloqueo-credencial', 'AQID')
  const b = new Bloqueo({ persistencia: p, credenciales: credenciales({ verificado: false }) })
  await b.iniciar()
  await assert.rejects(b.desbloquear(), ErrorBloqueo)
  assert.equal(b.bloqueado, true)
})

test('quitar el bloqueo exige confirmar', async () => {
  const p = memoria()
  p.m.set('bloqueo-credencial', 'AQID')
  const c = credenciales({ error: 'NotAllowedError' })
  const b = new Bloqueo({ persistencia: p, credenciales: c })
  await b.iniciar()
  await assert.rejects(b.desactivar(), ErrorBloqueo)
  assert.ok(b.activo)
})

test('pide el desbloqueo al volver tras un minuto, no antes', async () => {
  const p = memoria()
  p.m.set('bloqueo-credencial', 'AQID')
  let reloj = 0
  const b = new Bloqueo({ persistencia: p, credenciales: credenciales(), ahora: () => reloj })
  await b.iniciar()
  await b.desbloquear()
  b.alOcultar()
  reloj = 59_000
  assert.equal(b.alMostrar(), false)
  assert.equal(b.bloqueado, false)
  b.alOcultar()
  reloj += 60_000
  assert.equal(b.alMostrar(), true)
  assert.equal(b.bloqueado, true)
})

test('sin bloqueo activo nunca se bloquea', async () => {
  let reloj = 0
  const b = new Bloqueo({ persistencia: memoria(), credenciales: credenciales(), ahora: () => reloj })
  await b.iniciar()
  b.alOcultar()
  reloj = 999_999
  assert.equal(b.alMostrar(), false)
})
