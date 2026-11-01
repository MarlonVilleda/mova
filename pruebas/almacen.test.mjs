// Ejecutar con: node --test "pruebas/*.test.mjs"
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { Almacen } from '../js/datos/almacen.js'
import { cargarTolerante } from '../js/datos/carga.js'
import { aISO, comoMomento, diaDelMes, hoy, instante, mesActual, mesesEntre, sumarMes, sumarMeses } from '../js/datos/fechas.js'
import { faltante, fechaCobro, liquidada, pagadoReciente, proximoPago, restante, siguienteCobro, sugeridoMensual } from '../js/datos/modelos.js'
import { ErrorDatos, comoMonto, saneadoComoMonto, validar } from '../js/datos/validacion.js'

const respaldo = readFileSync(new URL('./respaldo-android.json', import.meta.url), 'utf8')

const memoria = () => {
  const m = new Map()
  return { m, leer: async (k) => m.get(k), escribir: async (k, v) => { m.set(k, v) } }
}

async function almacenCon(contenido) {
  const p = memoria()
  const a = new Almacen(p)
  if (contenido) p.m.set('mova.json', contenido)
  await a.iniciar()
  return a
}

const dentroDe = (mes, dia = 15) => `${mes}-${String(dia).padStart(2, '0')}T12:00:00Z`

test('comoMonto acepta coma y punto y rechaza basura', () => {
  assert.equal(comoMonto('12,50'), 12.5)
  assert.equal(comoMonto('12.5'), 12.5)
  assert.equal(comoMonto(' 7 '), 7)
  for (const malo of ['', '.', 'abc', '1e5', '-1', '1.234', '1.2.3', '9999999999.99']) assert.equal(comoMonto(malo), null, malo)
})

test('saneadoComoMonto limpia lo escrito', () => {
  assert.equal(saneadoComoMonto('007'), '7')
  assert.equal(saneadoComoMonto(',5'), '0,5')
  assert.equal(saneadoComoMonto('12a.345'), '12.34')
  assert.equal(saneadoComoMonto('0.05'), '0.05')
})

test('las fechas ajustan meses cortos y cuentan meses completos', () => {
  assert.equal(diaDelMes(31, '2026-02'), '2026-02-28')
  assert.equal(sumarMes('2026-12', 1), '2027-01')
  assert.equal(sumarMes('2026-01', -1), '2025-12')
  assert.equal(sumarMeses('2026-01-31', 1), '2026-02-28')
  assert.equal(mesesEntre('2026-01-15', '2026-03-14'), 1)
  assert.equal(mesesEntre('2026-01-15', '2026-03-15'), 2)
})

test('comoMomento conserva el mismo día local', () => {
  assert.match(comoMomento('2026-03-10'), /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/)
  assert.equal(new Date(comoMomento('2026-03-10')).getDate(), 10)
})

test('un respaldo de Android se lee completo y vuelve a salir igual', async () => {
  const a = await almacenCon(respaldo)
  assert.equal(a.errorAlGuardar, null)
  assert.equal(a.datos.movimientos.length, 3)
  validar(a.datos)

  const original = JSON.parse(respaldo)
  const salida = JSON.parse(a.exportarRespaldo())
  assert.deepEqual(salida.cuentas, original.cuentas)
  assert.deepEqual(salida.movimientos, original.movimientos)
  assert.deepEqual(salida.deudas, original.deudas)
  assert.deepEqual(salida.metas, original.metas)
  assert.deepEqual(salida.pagosFijos, original.pagosFijos)
  assert.deepEqual(salida.sobres, original.sobres)
  assert.deepEqual(salida.asignaciones, original.asignaciones)
  assert.deepEqual(salida.ajustes, original.ajustes)
})

test('los saldos siguen las mismas reglas que Android', async () => {
  const a = await almacenCon(respaldo)
  const [banco, tarjeta] = a.datos.cuentas
  // Banco: 1000 inicial + 500 ingreso - 200 transferencia. Tarjeta: -300 inicial + 200 transferencia - 80 gasto.
  assert.equal(a.saldo(banco), 1300)
  assert.equal(a.saldo(tarjeta), -180)
  assert.equal(a.saldoTotal, 1120)
  assert.equal(a.totalQueDebo, 750)
  assert.equal(a.patrimonio, 370)
})

test('un registro dañado se omite sin perder lo demás y se aparta el original', async () => {
  const d = JSON.parse(respaldo)
  d.movimientos[0].monto = 'mucho'
  const a = await almacenCon(JSON.stringify(d))
  assert.equal(a.datos.movimientos.length, 2)
  assert.match(a.errorAlGuardar, /Se omitieron 1 registros/)
  assert.ok([...a.persistencia.m.keys()].some((k) => k.startsWith('mova-respaldo-')))
})

test('un archivo ilegible no se sobrescribe', async () => {
  const a = await almacenCon('esto no es json')
  assert.match(a.errorAlGuardar, /No se pudieron leer/)
  assert.ok([...a.persistencia.m.values()].filter((v) => v === 'esto no es json').length >= 1)
  assert.ok([...a.persistencia.m.keys()].some((k) => k.startsWith('mova-respaldo-')))
})

test('la versión anterior de iPhone se completa', () => {
  const { datos, descartados } = cargarTolerante(JSON.stringify({
    pagosFijos: [{ nombre: 'Luz', monto: 10, categoria: 'servicios', diaDelMes: 31 }],
    presupuestos: { comida: 100 },
  }))
  assert.equal(descartados, 0)
  assert.equal(datos.pagosFijos[0].frecuencia, 'mensual')
  assert.match(datos.pagosFijos[0].proximoCobro, /Z$/)
})

test('los presupuestos se convierten en sobres al abrir y al restaurar', async () => {
  const antiguo = JSON.stringify({ presupuestos: { comida: 100 } })
  const a = await almacenCon(antiguo)
  assert.equal(a.datos.sobres[0].montoHabitual, 100)
  const b = await almacenCon()
  await b.restaurar(antiguo)
  assert.equal(b.datos.sobres[0].nombre, 'Comida')
  assert.deepEqual(b.datos.presupuestos, {})
})

test('restaurar rechaza un respaldo inválido sin cambiar nada', async () => {
  const a = await almacenCon(respaldo)
  const antes = a.exportarRespaldo()
  const malo = JSON.parse(respaldo)
  malo.deudas[0].diaDePago = 45
  await assert.rejects(a.restaurar(JSON.stringify(malo)), ErrorDatos)
  await assert.rejects(a.restaurar('[]'), ErrorDatos)
  await assert.rejects(a.restaurar('no'), ErrorDatos)
  assert.equal(a.exportarRespaldo(), antes)
})

test('restaurar guarda antes una copia de lo actual', async () => {
  const a = await almacenCon(respaldo)
  const antes = a.exportarRespaldo()
  await a.restaurar(JSON.stringify({}))
  assert.equal(a.datos.movimientos.length, 0)
  assert.equal(a.persistencia.m.get('mova-antes-de-restaurar.json'), antes)
})

test('abonar con cuenta crea el movimiento y nunca paga de más', async () => {
  const a = await almacenCon(respaldo)
  const deuda = a.datos.deudas[0]
  const cuenta = a.datos.cuentas[0]
  a.abonar(99999, deuda.id, aISO(new Date()), 'x', cuenta.id)
  const actual = a.datos.deudas[0]
  assert.ok(liquidada(actual))
  const abono = actual.abonos.at(-1)
  assert.equal(abono.monto, 750)
  const mov = a.datos.movimientos.find((m) => m.id === abono.movimientoID)
  assert.equal(mov.categoria, 'deudas')

  a.eliminarAbono(abono, deuda.id)
  assert.equal(restante(a.datos.deudas[0]), 750)
  assert.equal(a.datos.movimientos.some((m) => m.id === abono.movimientoID), false)
})

test('editar el movimiento de un abono actualiza el abono y borrarlo lo quita', async () => {
  const a = await almacenCon(respaldo)
  const deuda = a.datos.deudas[0]
  a.abonar(50, deuda.id, aISO(new Date()), '', a.datos.cuentas[0].id)
  const abono = a.datos.deudas[0].abonos.at(-1)
  const mov = a.datos.movimientos.find((m) => m.id === abono.movimientoID)
  a.guardarMovimiento({ ...mov, monto: 60 })
  assert.equal(a.datos.deudas[0].abonos.at(-1).monto, 60)
  a.eliminarMovimiento({ ...mov, monto: 60 })
  assert.equal(a.datos.deudas[0].abonos.some((x) => x.id === abono.id), false)
})

test('los sobres calculan gastado, arrastre y mover dinero', async () => {
  const a = await almacenCon()
  a.crearSobresSugeridos()
  const comida = a.datos.sobres.find((s) => s.nombre === 'Comida')
  const ahorro = a.datos.sobres.find((s) => s.nombre === 'Ahorro')
  const mes = mesActual()
  a.guardarSobre({ ...ahorro, creado: dentroDe(sumarMes(mes, -2)) })
  const ahorroAntiguo = a.datos.sobres.find((s) => s.nombre === 'Ahorro')

  a.asignar({ [comida.id]: 300, [ahorroAntiguo.id]: 100 }, mes)
  a.asignar({ [ahorroAntiguo.id]: 40 }, sumarMes(mes, -1))
  a.guardarMovimiento({ id: 'A', tipo: 'gasto', monto: 120, categoria: 'comida', nota: '', fecha: dentroDe(mes, 1) })

  assert.equal(a.gastado(comida, mes), 120)
  assert.equal(a.disponible(comida, mes), 180)
  assert.equal(a.arrastre(ahorroAntiguo, mes), 40)
  assert.equal(a.disponible(ahorroAntiguo, mes), 140)

  a.mover(50, comida, ahorroAntiguo, mes)
  assert.equal(a.asignado(comida, mes), 250)
  a.mover(99999, comida, ahorroAntiguo, mes)
  assert.equal(a.asignado(comida, mes), 250)

  a.eliminarSobre(comida)
  assert.equal(a.datos.asignaciones[mes][comida.id], undefined)
})

test('una categoría cae en un solo sobre', async () => {
  const a = await almacenCon()
  a.crearSobresSugeridos()
  const ocio = a.datos.sobres.find((s) => s.nombre === 'Ocio')
  a.guardarSobre({ ...ocio, categorias: ['comida'] })
  const comida = a.datos.sobres.find((s) => s.nombre === 'Comida')
  assert.deepEqual(comida.categorias, ['supermercado'])
})

test('marcar un pago fijo avanza la fecha sin tocar el dinero', async () => {
  const a = await almacenCon(respaldo)
  const pago = a.datos.pagosFijos[0]
  const movimientos = a.datos.movimientos.length
  const saldo = a.saldoTotal
  const siguiente = a.pagar(pago)
  assert.equal(siguiente, '2026-11-30')
  assert.equal(a.pagar(pago), null)
  assert.equal(a.datos.movimientos.length, movimientos)
  assert.equal(a.saldoTotal, saldo)
  const actual = a.datos.pagosFijos[0]
  assert.ok(pagadoReciente(actual))
  assert.equal(fechaCobro(actual), '2026-11-30')
})

test('una categoría propia se usa, se guarda y vuelve igual', async () => {
  const a = await almacenCon(respaldo)
  const clave = a.guardarCategoria({ tipo: 'gasto', nombre: 'Gasolina', icono: 'car', color: 3 })
  assert.equal(a.categoria(clave).nombre, 'Gasolina')
  assert.equal(a.categoria(clave).tono, 'ambar')
  const lista = a.categoriasDe('gasto')
  assert.ok(lista.includes(clave))
  assert.equal(lista.at(-1), 'otrosGastos')

  a.guardarMovimiento({ id: 'AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA', tipo: 'gasto', monto: 5, categoria: clave, nota: '', fecha: dentroDe(mesActual()) })
  const sobre = a.datos.sobres[0]
  a.guardarSobre({ ...sobre, categorias: [...sobre.categorias, clave] })

  const archivo = JSON.parse(a.exportarRespaldo())
  const enArchivo = archivo.movimientos.at(-1)
  assert.equal(enArchivo.categoria, 'otrosGastos')
  assert.equal(enArchivo.categoriaPropia, clave)
  assert.ok(archivo.sobres[0].categorias.every((c) => c !== clave))

  const b = await almacenCon(a.exportarRespaldo())
  assert.equal(b.errorAlGuardar, null)
  assert.equal(b.datos.movimientos.at(-1).categoria, clave)
  assert.equal(b.sobreAutomatico(clave).id, sobre.id)
  assert.equal(b.categoria(clave).nombre, 'Gasolina')
})

test('eliminar una categoría propia pasa lo registrado a Otros', async () => {
  const a = await almacenCon(respaldo)
  const clave = a.guardarCategoria({ tipo: 'ingreso', nombre: 'Rifas', icono: 'gift', color: 1 })
  a.guardarMovimiento({ id: 'BBBBBBBB-BBBB-4BBB-8BBB-BBBBBBBBBBBB', tipo: 'ingreso', monto: 5, categoria: clave, nota: '', fecha: dentroDe(mesActual()) })
  a.eliminarCategoria(clave)
  assert.equal(a.datos.movimientos.at(-1).categoria, 'otrosIngresos')
  assert.equal(a.categoriasDe('ingreso').includes(clave), false)
})

test('una categoría de Mova se edita, se oculta y se restablece', async () => {
  const a = await almacenCon(respaldo)
  a.guardarCategoria({ clave: 'comida', nombre: 'Restaurantes', icono: 'star', color: 2 })
  assert.equal(a.categoria('comida').nombre, 'Restaurantes')
  assert.equal(a.categoria('comida').tono, 'rosa')

  a.eliminarCategoria('comida')
  assert.equal(a.categoriasDe('gasto').includes('comida'), false)
  assert.equal(a.categoriasDe('gasto', 'comida').includes('comida'), true)
  assert.equal(a.categoria('comida').nombre, 'Restaurantes')
  assert.deepEqual(a.categoriasOcultas('gasto'), ['comida'])

  const b = await almacenCon(a.exportarRespaldo())
  assert.equal(b.categoria('comida').oculta, true)
  b.restablecerCategoria('comida')
  assert.equal(b.categoria('comida').nombre, 'Comida')
  assert.equal(b.categoria('comida').oculta, false)
})

test('Otros no se puede eliminar', async () => {
  const a = await almacenCon(respaldo)
  a.eliminarCategoria('otrosGastos')
  assert.ok(a.categoriasDe('gasto').includes('otrosGastos'))
})

test('una categoría propia perdida no daña el registro', () => {
  const { datos, descartados } = cargarTolerante(JSON.stringify({
    movimientos: [{ tipo: 'gasto', monto: 1, categoria: 'otrosGastos', categoriaPropia: '99999999-9999-4999-8999-999999999999', fecha: '2026-10-01T18:30:00Z' }],
  }))
  assert.equal(descartados, 0)
  assert.equal(datos.movimientos[0].categoria, 'otrosGastos')
})

test('el cobro mensual conserva el día 31', () => {
  const p = { frecuencia: 'mensual', diaDelMes: 31 }
  const febrero = siguienteCobro(p, '2027-01-31')
  assert.equal(febrero, '2027-02-28')
  assert.equal(siguienteCobro(p, febrero), '2027-03-31')
})

test('las metas no permiten retirar de más', async () => {
  const a = await almacenCon(respaldo)
  const meta = a.datos.metas[0]
  a.aportar(-999999, meta.id, 'Retiro')
  assert.equal(a.datos.metas[0].aportes.length, meta.aportes.length)
  assert.equal(faltante(a.datos.metas[0]), 900)
  assert.ok(sugeridoMensual({ ...meta, fechaObjetivo: instante(sumarMeses(hoy(), 9)) }) === 100)
})

test('eliminar una cuenta deja los movimientos sin cuenta', async () => {
  const a = await almacenCon(respaldo)
  const [banco] = a.datos.cuentas
  a.eliminarCuenta(banco)
  assert.equal(a.datos.movimientos.some((m) => m.cuentaID === banco.id || m.cuentaDestinoID === banco.id), false)
  assert.equal(a.datos.movimientos.length, 3)
  validar(a.datos)
})

test('la próxima cuota salta al mes siguiente si ya se abonó', () => {
  const mes = mesActual()
  const base = { montoTotal: 100, diaDePago: 31, abonos: [] }
  assert.equal(proximoPago(base), diaDelMes(31, mes))
  const abonada = { ...base, abonos: [{ monto: 10, fecha: aISO(new Date()) }] }
  assert.equal(proximoPago(abonada), diaDelMes(31, sumarMes(mes, 1)))
})

test('el CSV neutraliza fórmulas y lleva BOM', async () => {
  const a = await almacenCon(respaldo)
  a.guardarMovimiento({ id: 'F', tipo: 'gasto', monto: 1, categoria: 'comida', nota: '=SUM(A1)', fecha: dentroDe(mesActual()) })
  const csv = a.exportarCSV()
  assert.equal(csv.charCodeAt(0), 0xFEFF)
  assert.ok(csv.includes(`"'=SUM(A1)"`))
  assert.ok(csv.includes('"-1.00"'))
})

test('recuerda respaldar pasada una semana', async () => {
  const a = await almacenCon(respaldo)
  a.cambiarAjustes({ ultimoRespaldo: aISO(new Date(Date.now() - 8 * 86_400_000)) })
  assert.equal(a.debeRespaldar, true)
  a.marcarRespaldo()
  assert.equal(a.debeRespaldar, false)
})

test('los cambios se escriben y sobreviven al reabrir', async () => {
  const a = await almacenCon(respaldo)
  a.cambiarAjustes({ nombre: 'Prueba' })
  await a.guardarAhora()
  const b = new Almacen(a.persistencia)
  await b.iniciar()
  assert.equal(b.datos.ajustes.nombre, 'Prueba')
})

test('si no se puede leer, no se escribe encima', async () => {
  const escrituras = []
  const a = new Almacen({ leer: async () => { throw new Error('bloqueado') }, escribir: async (k) => { escrituras.push(k) } })
  await a.iniciar()
  a.cambiarAjustes({ nombre: 'x' })
  await a.guardarAhora()
  assert.deepEqual(escrituras, [])
})

test('cada cuenta calcula lo disponible con sus deudas asociadas', async () => {
  const a = await almacenCon(respaldo)
  const [banco, tarjeta] = a.datos.cuentas
  const deuda = a.datos.deudas[0]
  assert.equal(a.disponibleEn(banco), 1300, 'sin deuda asociada es su saldo')

  a.guardarDeuda({ ...deuda, cuentaID: banco.id })
  assert.equal(a.comprometido(banco), 750)
  assert.equal(a.disponibleEn(banco), 550)
  assert.equal(a.saldo(banco), 1300, 'asociar no toca el saldo')
  assert.equal(a.disponibleEn(tarjeta), a.saldo(tarjeta), 'no mezcla cuentas')

  a.abonar(100, deuda.id, new Date().toISOString().replace(/\.\d+Z$/, 'Z'), '', null)
  assert.equal(a.disponibleEn(banco), 650)
  a.abonar(650, deuda.id, new Date().toISOString().replace(/\.\d+Z$/, 'Z'), '', null)
  assert.equal(a.deudasDe(banco).length, 0, 'una deuda liquidada ya no cuenta')

  const b = await almacenCon(a.exportarRespaldo())
  assert.equal(b.datos.deudas[0].cuentaID, banco.id)
})

test('una tarjeta con límite parte del crédito sin usar', async () => {
  const a = await almacenCon(respaldo)
  const tarjeta = a.datos.cuentas[1]
  a.guardarCuenta({ ...tarjeta, limite: 1000 })
  const conLimite = a.datos.cuentas[1]
  assert.equal(a.saldo(conLimite), -180)
  assert.equal(a.disponibleEn(conLimite), 820)
  a.guardarDeuda({ ...a.datos.deudas[0], cuentaID: conLimite.id })
  assert.equal(a.disponibleEn(conLimite), 70)
})

test('eliminar una cuenta suelta sus deudas', async () => {
  const a = await almacenCon(respaldo)
  const [banco] = a.datos.cuentas
  a.guardarDeuda({ ...a.datos.deudas[0], cuentaID: banco.id })
  a.eliminarCuenta(banco)
  assert.equal(a.datos.deudas[0].cuentaID, undefined)
})

test('una deuda de otra persona no descuenta de la cuenta', async () => {
  const a = await almacenCon(respaldo)
  const [banco] = a.datos.cuentas
  a.guardarDeuda({ ...a.datos.deudas[0], direccion: 'meDeben', cuentaID: banco.id })
  assert.equal(a.comprometido(banco), 0)
})

test('corregir el saldo actual no toca los movimientos', async () => {
  const a = await almacenCon(respaldo)
  const [banco, tarjeta] = a.datos.cuentas
  const movimientos = a.datos.movimientos.length
  a.guardarCuenta({ ...banco, saldoInicial: a.saldoInicialPara(banco, 255) })
  assert.equal(a.saldo(a.datos.cuentas[0]), 255)
  assert.equal(a.datos.movimientos.length, movimientos)
  assert.equal(a.saldo(tarjeta), -180, 'las otras cuentas no cambian')

  a.guardarMovimiento({ id: 'CCCCCCCC-CCCC-4CCC-8CCC-CCCCCCCCCCCC', tipo: 'gasto', monto: 5, categoria: 'comida', cuentaID: banco.id, nota: '', fecha: dentroDe(mesActual()) })
  assert.equal(a.saldo(a.datos.cuentas[0]), 250, 'lo nuevo sigue sumando y restando')

  const b = await almacenCon(a.exportarRespaldo())
  validar(b.datos)
  assert.equal(b.saldo(b.datos.cuentas[0]), 250)
  assert.equal(a.saldoInicialPara(null, 40), 40, 'una cuenta nueva parte de lo escrito')
})
