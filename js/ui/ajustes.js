import { html, useState } from '../vendor/preact-htm.js'
import { fechaLocal, hoy } from '../datos/fechas.js'
import { dinero, nombreMoneda, textoEditable, textoFecha } from '../datos/formato.js'
import { Apariencia, TipoCuenta, nuevoId } from '../datos/modelos.js'
import { ErrorDatos, Limites, comoMonto, limpio, primerError } from '../datos/validacion.js'
import { elegirArchivo, entregarArchivo, estaInstalada } from './archivos.js'
import { C, CampoMonto, Icono, Logo, MensajeError, Nota, SelectorColor, TituloPantalla, colorDe } from './componentes.js'
import { almacen, avisar, bloqueo, confirmar, dispositivo, nav, nube, refrescar } from './estado.js'
import { FilaBoton, FilaInterruptor, FilaMontoCorto, FilaSelector, FilaTexto, Hoja, SeccionForm, Separador } from './formularios.js'

const MONEDAS = [
  'USD', 'MXN', 'EUR', 'GTQ', 'HNL', 'NIO', 'CRC', 'PAB', 'DOP', 'COP',
  'PEN', 'CLP', 'ARS', 'BOB', 'PYG', 'UYU', 'VES', 'BRL', 'CAD', 'GBP',
]

/** Con el bloqueo activo, lo delicado exige confirmar con Face ID, huella o PIN. */
async function conPermiso(accion) {
  if (bloqueo.activo) {
    try {
      await bloqueo.verificar()
    } catch (e) {
      avisar(e.message)
      return
    }
  }
  accion()
}

/** Tras Face ID, Safari exige otro toque para abrir la hoja de compartir o el selector de archivos. */
function exportar(titulo, entregar) {
  conPermiso(() => {
    if (bloqueo.activo) confirmar(titulo, 'El archivo no va cifrado: guárdalo en un lugar seguro.', 'Guardar', entregar)
    else entregar()
  })
}

async function entregarRespaldo() {
  await almacen.guardarAhora()
  const entregado = await entregarArchivo(`mova-respaldo-${hoy()}.json`, almacen.exportarRespaldo(), 'application/json')
  if (entregado) {
    almacen.marcarRespaldo()
    avisar('Respaldo guardado ✓')
  }
}

export const guardarRespaldo = () => exportar('Guardar respaldo', entregarRespaldo)

async function entregarCSV() {
  if (await entregarArchivo(`movimientos-${hoy()}.csv`, almacen.exportarCSV(), 'text/csv')) avisar('Exportado ✓')
}

const exportarCSV = () => exportar('Exportar a Excel', entregarCSV)

async function restaurarRespaldo() {
  const archivo = await elegirArchivo()
  if (!archivo) return
  try {
    if (archivo.size > Limites.respaldoMaximoBytes) throw new ErrorDatos('El archivo es demasiado grande para ser un respaldo de Mova.')
    await almacen.restaurar(await archivo.text())
    avisar('Respaldo restaurado ✓')
  } catch (e) {
    const mensaje = e instanceof ErrorDatos ? e.message : 'No se pudo leer el respaldo. Elige un archivo creado con «Guardar respaldo».'
    avisar(`${mensaje} No se cambió nada.`)
  }
}

export function AjustesPantalla() {
  const { ajustes, cuentas } = almacen.datos
  const alcance = nube.sesion ? ' en todos tus dispositivos' : ''
  const borrar = () => conPermiso(() => confirmar('¿Borrar todo?', `Se eliminarán movimientos, deudas, metas, sobres y cuentas${alcance}. No se puede deshacer.`, 'Borrar todos los datos', () => {
    almacen.borrarTodo()
    avisar('Se borraron todos los datos.')
  }))
  const restaurar = () => conPermiso(() => confirmar('Restaurar respaldo', 'Se reemplazarán todos los datos actuales por los del respaldo.', 'Elegir archivo', restaurarRespaldo))

  return html`<div class="pantalla">
    <${TituloPantalla} titulo="Ajustes" />

    ${!estaInstalada() && html`
      <${SeccionForm} titulo="Instalar" pie="En iPhone, abre esta página en Safari, toca Compartir y elige «Agregar a pantalla de inicio». Hazlo antes de restaurar tu respaldo: la app instalada guarda sus datos aparte de Safari.">
        <div class="fila"><${Logo} tam=${24} /><span class="crece">Usa Mova como una app</span></div>
      <//>`}

    <${SeccionCuenta} />

    <${SeccionForm} titulo="Perfil">
      <${FilaTexto} valor=${ajustes.nombre} alCambiar=${(nombre) => almacen.cambiarAjustes({ nombre })} placeholder="Tu nombre" maximo=${30} />
    <//>

    <${SeccionForm} titulo="Cuentas" pie="Efectivo, bancos, tarjetas o ahorros. Cada una lleva su propio saldo.">
      ${cuentas.map((cuenta) => html`
        <${FilaCuenta} key=${cuenta.id} cuenta=${cuenta} />
        <${Separador} />`)}
      <${FilaBoton} texto="Agregar cuenta" alTocar=${() => nav.abrir({ tipo: 'FormCuenta' })} simbolo="plus" />
    <//>

    <${SeccionForm} titulo="Categorías">
      <${FilaBoton} texto="Administrar categorías" alTocar=${() => nav.abrir({ tipo: 'Categorias' })} simbolo="circle.grid.2x2" />
    <//>

    <${SeccionForm} titulo="Preferencias">
      <${FilaSelector} etiqueta="Moneda" valor=${ajustes.moneda} opciones=${[...new Set([...MONEDAS, ajustes.moneda])]}
        texto=${(m) => `${m} · ${nombreMoneda(m)}`} alCambiar=${(moneda) => almacen.cambiarAjustes({ moneda })} />
      <${Separador} />
      <${FilaSelector} etiqueta="Apariencia" valor=${ajustes.apariencia} opciones=${Object.keys(Apariencia)} texto=${(a) => Apariencia[a].nombre}
        alCambiar=${(apariencia) => almacen.cambiarAjustes({ apariencia })} simbolo="circle.lefthalf.filled" />
    <//>

    <${SeccionForm} titulo="Respaldo" pie=${nube.sesion
      ? 'Tus datos se guardan en tu cuenta. Un respaldo es una copia extra en Archivos, iCloud o Drive.'
      : 'Tus datos están solo en este navegador. Si se borran los datos de Safari o desinstalas la app, se pierden. Guarda el respaldo en Archivos, iCloud o Drive.'}>
      <${FilaInterruptor} etiqueta="Recordarme cada semana" valor=${ajustes.respaldoAutomatico}
        alCambiar=${(respaldoAutomatico) => almacen.cambiarAjustes({ respaldoAutomatico })} simbolo="clock.arrow.circlepath" />
      <${Separador} />
      <div class="fila">
        <span class="crece">Último respaldo</span>
        <span class="secundario">${ajustes.ultimoRespaldo ? textoFecha(fechaLocal(ajustes.ultimoRespaldo)) : 'Nunca'}</span>
      </div>
      <${Separador} />
      <${FilaBoton} texto="Guardar respaldo" alTocar=${guardarRespaldo} simbolo="arrow.up.doc" />
      <${Separador} />
      <${FilaBoton} texto="Restaurar respaldo" alTocar=${restaurar} simbolo="arrow.down.doc" />
    <//>

    <${SeccionForm} titulo="Datos" pie="Los respaldos de Mova también se pueden abrir en iPhone y Android, donde tus categorías propias aparecen como «Otros».">
      <${FilaBoton} texto="Exportar a Excel (CSV)" alTocar=${exportarCSV} simbolo="tablecells" />
      <${Separador} />
      <${FilaBoton} texto="Borrar todos los datos" alTocar=${borrar} color=${C.gasto} simbolo="trash" />
    <//>

    <div class="pie-app"><${Logo} tam=${36} /><${Nota}>Mova · uso personal<//></div>
  </div>`
}

function SeccionCuenta() {
  if (!nube.sesion) {
    return html`<${SeccionForm} titulo="Cuenta" pie="Entra para ver los mismos datos en todos tus dispositivos. Sin cuenta, Mova guarda todo solo en este navegador.">
      <${FilaBoton} texto="Entrar o crear cuenta" alTocar=${() => nav.abrir({ tipo: 'FormAcceso' })} simbolo="person" />
    <//>`
  }
  const salir = () => confirmar('¿Cerrar sesión?', 'Tus datos siguen en tu cuenta, pero se quitarán de este dispositivo hasta que vuelvas a entrar.', 'Cerrar sesión', async () => {
    try {
      await nube.salir()
      await bloqueo.olvidar()
    } catch (e) {
      avisar(e.message)
    }
  })
  const cambiarBloqueo = async (activar) => {
    try {
      if (activar) await bloqueo.activar({ usuario: nube.sesion.usuario, correo: nube.sesion.correo })
      else await bloqueo.desactivar()
      refrescar()
      nube.anotarDispositivo()
    } catch (e) {
      avisar(e.message)
    }
  }
  const estado = nube.sincronizando ? 'Sincronizando…' : nube.ultimaSincronizacion ? 'Al día' : 'Pendiente'
  return html`<${SeccionForm} titulo="Cuenta" pie=${html`<${MensajeError} texto=${nube.error} />`}>
    <div class="fila"><span class="crece corta"><span>${nube.sesion.correo}</span></span><span class="secundario">${estado}</span></div>
    <${Separador} />
    ${bloqueo.disponible && html`
      <${FilaInterruptor} etiqueta=${`Entrar con ${dispositivo.metodo}`} valor=${bloqueo.activo} alCambiar=${cambiarBloqueo} simbolo="lock.shield" />
      <${Separador} />`}
    <${FilaBoton} texto="Sincronizar ahora" alTocar=${() => nube.sincronizar()} simbolo="arrow.counterclockwise" habilitado=${!nube.sincronizando} />
    <${Separador} />
    <${FilaBoton} texto="Mis dispositivos" alTocar=${() => nav.abrir({ tipo: 'Dispositivos' })} simbolo="iphone" />
    <${Separador} />
    <${FilaBoton} texto="Cerrar sesión" alTocar=${salir} color=${C.gasto} />
  <//>`
}

function FilaCuenta({ cuenta }) {
  const saldo = almacen.saldo(cuenta)
  return html`<button class="fila fila-cuenta" onClick=${() => nav.abrir({ tipo: 'FormCuenta', original: cuenta })}>
    <${Icono} s=${TipoCuenta[cuenta.tipo].icono} color=${colorDe(cuenta.color)} lado=${36} />
    <span class="crece corta">
      <b>${cuenta.nombre}</b>
      <small>${TipoCuenta[cuenta.tipo].nombre}</small>
    </span>
    <strong style=${{ color: saldo < 0 ? C.gasto : C.texto }}>${dinero(saldo)}</strong>
  </button>`
}

// MARK: - Cuenta

export function FormCuenta({ original, alCerrar }) {
  const [nombre, setNombre] = useState(original?.nombre ?? '')
  const [tipo, setTipo] = useState(original?.tipo ?? 'banco')
  const [saldoTexto, setSaldoTexto] = useState(original ? textoEditable(Math.abs(original.saldoInicial)) : '')
  const [color, setColor] = useState(original?.color ?? 5)
  const [limiteTexto, setLimiteTexto] = useState(original?.limite != null ? textoEditable(original.limite) : '')

  const nombreLimpio = limpio(nombre, Limites.nombre)
  const error = primerError(
    [!nombreLimpio, 'Escribe un nombre.'],
    [almacen.datos.cuentas.some((c) => c.id !== original?.id && c.nombre.toLowerCase() === nombreLimpio.toLowerCase()), 'Ya tienes una cuenta con ese nombre.'],
    [saldoTexto && comoMonto(saldoTexto) == null, 'El saldo no es válido.'],
    [tipo === 'tarjeta' && limiteTexto && comoMonto(limiteTexto) == null, 'El límite no es válido.'],
  )
  const esTarjeta = tipo === 'tarjeta'

  const guardar = () => {
    const saldo = Math.abs(comoMonto(saldoTexto) ?? 0)
    const cuenta = { ...(original ?? { id: nuevoId() }), nombre: nombre.trim(), tipo, saldoInicial: esTarjeta ? -saldo : saldo, color }
    const limite = comoMonto(limiteTexto)
    if (esTarjeta && limite > 0) cuenta.limite = limite
    else delete cuenta.limite
    almacen.guardarCuenta(cuenta)
  }
  const eliminar = () => confirmar('¿Eliminar esta cuenta?', 'Sus movimientos se conservan, pero quedarán sin cuenta.', 'Eliminar', () => {
    almacen.eliminarCuenta(original)
    alCerrar()
  })

  return html`<${Hoja} titulo=${original ? 'Editar cuenta' : 'Nueva cuenta'} alCerrar=${alCerrar} puedeGuardar=${error == null} alGuardar=${guardar}>
    <${SeccionForm} titulo=${esTarjeta ? 'Lo que debes en la tarjeta' : 'Saldo inicial'}
      pie=${esTarjeta ? 'Se guarda como saldo negativo. Tus compras con la tarjeta lo aumentan y tus pagos lo reducen.' : 'Lo que tenías en esta cuenta antes de empezar a usar la app.'}>
      <${CampoMonto} texto=${saldoTexto} alCambiar=${setSaldoTexto} color=${colorDe(color)} etiqueta="Saldo" />
    <//>
    <${SeccionForm} pie=${html`<${MensajeError} texto=${nombre ? error : null} />`}>
      <${FilaTexto} valor=${nombre} alCambiar=${setNombre} placeholder="Nombre (ej. BAC, Banrural, Cartera)" maximo=${Limites.nombre} />
      <${Separador} />
      <${FilaSelector} etiqueta="Tipo" valor=${tipo} opciones=${Object.keys(TipoCuenta)} texto=${(t) => TipoCuenta[t].nombre} alCambiar=${setTipo} />
      ${esTarjeta && html`
        <${Separador} />
        <${FilaMontoCorto} etiqueta="Límite de crédito" valor=${limiteTexto} alCambiar=${setLimiteTexto} />`}
    <//>
    <${SeccionForm} titulo="Color"><${SelectorColor} indice=${color} alCambiar=${setColor} /><//>
    ${original && html`<${SeccionForm}><${FilaBoton} texto="Eliminar cuenta" alTocar=${eliminar} color=${C.gasto} simbolo="trash" /><//>`}
  <//>`
}
