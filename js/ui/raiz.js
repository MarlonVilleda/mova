import { html, useEffect, useReducer } from '../vendor/preact-htm.js'
import { FormAcceso } from './acceso.js'
import { AjustesPantalla, FormCuenta } from './ajustes.js'
import { PantallaBloqueo } from './bloqueo.js'
import { Categorias, FormCategoria } from './categorias.js'
import { Logo, Simbolo } from './componentes.js'
import { Dispositivos } from './dispositivos.js'
import { DeudasPantalla, DetalleDeuda, FormAbono, FormDeuda } from './deudas.js'
import { almacen, bloqueo, nav, suscribirInterfaz } from './estado.js'
import { InicioPantalla } from './inicio.js'
import { FormMovimiento, MovimientosPantalla } from './movimientos.js'
import { FormAporte, FormMeta, FormMoverDinero, FormRepartir, FormSobre, FormSuscripcion, PlanearPantalla } from './planear.js'

const PESTANAS = {
  inicio: { titulo: 'Inicio', simbolo: 'house', Pantalla: InicioPantalla },
  movimientos: { titulo: 'Movimientos', simbolo: 'arrow.left.arrow.right', Pantalla: MovimientosPantalla },
  deudas: { titulo: 'Deudas', simbolo: 'creditcard', Pantalla: DeudasPantalla },
  planear: { titulo: 'Planear', simbolo: 'target', Pantalla: PlanearPantalla },
  ajustes: { titulo: 'Ajustes', simbolo: 'gearshape', Pantalla: AjustesPantalla },
}

function usarTema(apariencia) {
  useEffect(() => {
    const oscuroSistema = matchMedia('(prefers-color-scheme: dark)')
    const aplicar = () => {
      const oscuro = apariencia === 'oscura' || (apariencia === 'automatica' && oscuroSistema.matches)
      document.documentElement.dataset.tema = oscuro ? 'oscuro' : 'claro'
      document.querySelector('meta[name=theme-color]')?.setAttribute('content', oscuro ? '#0A1022' : '#F7F9FF')
    }
    aplicar()
    oscuroSistema.addEventListener('change', aplicar)
    return () => oscuroSistema.removeEventListener('change', aplicar)
  }, [apariencia])
}

export function Raiz() {
  const [, refrescar] = useReducer((n) => n + 1, 0)
  useEffect(() => {
    const quitarAlmacen = almacen.suscribir(refrescar)
    const quitarInterfaz = suscribirInterfaz(refrescar)
    const alVolver = (e) => nav.alVolver(e.state)
    const alTeclear = (e) => {
      if (e.key !== 'Escape') return
      if (nav.dialogo) nav.cerrarDialogo()
      else nav.cerrar()
    }
    addEventListener('popstate', alVolver)
    addEventListener('keydown', alTeclear)
    return () => {
      quitarAlmacen()
      quitarInterfaz()
      removeEventListener('popstate', alVolver)
      removeEventListener('keydown', alTeclear)
    }
  }, [])
  usarTema(almacen.datos.ajustes.apariencia)

  if (bloqueo.bloqueado) return html`<div class="fondo-app"></div><${PantallaBloqueo} />`

  const { Pantalla } = PESTANAS[nav.pestana]
  return html`
    <div class="fondo-app"></div>
    <div class="app">
      <nav class="pestanas" aria-label="Secciones">
        <div class="marca"><${Logo} tam=${30} /><b>Mova</b></div>
        ${Object.entries(PESTANAS).map(([clave, p]) => html`
          <button key=${clave} class=${nav.pestana === clave ? 'activa' : ''} aria-current=${nav.pestana === clave ? 'page' : null}
            onClick=${() => nav.elegir(clave)}>
            <${Simbolo} s=${p.simbolo} tam=${22} />
            <span>${p.titulo}</span>
          </button>`)}
      </nav>
      <main class="contenido" key=${nav.pestana}><${Pantalla} /></main>
    </div>
    ${nav.pila.map((pantalla, i) => html`<${PantallaEncima} key=${`${i}-${pantalla.tipo}`} p=${pantalla} />`)}
    <${Dialogo} />
    ${almacen.errorAlGuardar && html`
      <${Cuadro} titulo="Mova" mensaje=${almacen.errorAlGuardar} alCerrar=${() => { almacen.errorAlGuardar = null; almacen.avisar() }}>
        <button class="enlace fuerte" onClick=${() => { almacen.errorAlGuardar = null; almacen.avisar() }}>OK</button>
      <//>`}`
}

function PantallaEncima({ p }) {
  const cerrar = () => nav.cerrar()
  switch (p.tipo) {
    case 'FormMovimiento': return html`<${FormMovimiento} original=${p.original} tipoInicial=${p.movimiento} fechaInicial=${p.fecha} alCerrar=${cerrar} />`
    case 'DetalleDeuda': return html`<${DetalleDeuda} deudaID=${p.id} alCerrar=${cerrar} />`
    case 'FormDeuda': return html`<${FormDeuda} original=${p.original} direccionInicial=${p.direccion} alCerrar=${cerrar} />`
    case 'FormAbono': return html`<${FormAbono} deudaID=${p.deudaId} alCerrar=${cerrar} />`
    case 'FormCuenta': return html`<${FormCuenta} original=${p.original} alCerrar=${cerrar} />`
    case 'FormSobre': return html`<${FormSobre} original=${p.original} alCerrar=${cerrar} />`
    case 'FormRepartir': return html`<${FormRepartir} mes=${p.mes} alCerrar=${cerrar} />`
    case 'FormMover': return html`<${FormMoverDinero} origenId=${p.origenId} mes=${p.mes} alCerrar=${cerrar} />`
    case 'FormMeta': return html`<${FormMeta} original=${p.original} alCerrar=${cerrar} />`
    case 'FormAporte': return html`<${FormAporte} metaId=${p.metaId} alCerrar=${cerrar} />`
    case 'FormSuscripcion': return html`<${FormSuscripcion} original=${p.original} alCerrar=${cerrar} />`
    case 'FormAcceso': return html`<${FormAcceso} alCerrar=${cerrar} />`
    case 'Dispositivos': return html`<${Dispositivos} alCerrar=${cerrar} />`
    case 'Categorias': return html`<${Categorias} alCerrar=${cerrar} />`
    case 'FormCategoria': return html`<${FormCategoria} clave=${p.clave} tipoCategoria=${p.tipoCategoria} alCrear=${p.alCrear} alCerrar=${cerrar} />`
    default: return null
  }
}

const Cuadro = ({ titulo, mensaje, alCerrar, children }) => html`
  <div class="cuadro-fondo" onClick=${(e) => { if (e.target === e.currentTarget) alCerrar() }}>
    <div class="cuadro" role="alertdialog" aria-modal="true" aria-label=${titulo}>
      <h3>${titulo}</h3>
      ${mensaje && html`<p>${mensaje}</p>`}
      <div class="cuadro-acciones">${children}</div>
    </div>
  </div>`

function Dialogo() {
  const d = nav.dialogo
  if (!d) return null
  const cerrar = () => nav.cerrarDialogo()
  if (d.tipo === 'aviso') {
    return html`<${Cuadro} titulo="Mova" mensaje=${d.mensaje} alCerrar=${cerrar}>
      <button class="enlace fuerte" onClick=${cerrar}>OK</button>
    <//>`
  }
  if (d.tipo === 'confirmar') {
    const aceptar = () => {
      cerrar()
      d.alConfirmar()
    }
    return html`<${Cuadro} titulo=${d.titulo} mensaje=${d.mensaje} alCerrar=${cerrar}>
      <button class="enlace" onClick=${cerrar}>Cancelar</button>
      <button class="enlace peligro" onClick=${aceptar}>${d.accion}</button>
    <//>`
  }
  return html`<div class="cuadro-fondo abajo" onClick=${(e) => { if (e.target === e.currentTarget) cerrar() }}>
    <div class="menu" role="menu" aria-label=${d.titulo}>
      <h4>${d.titulo}</h4>
      ${d.opciones.map((o) => html`
        <button role="menuitem" class=${o.peligro ? 'peligro' : ''} onClick=${() => { cerrar(); o.accion() }}>
          <${Simbolo} s=${o.icono} />${o.texto}
        </button>`)}
      <button class="cancelar" onClick=${cerrar}>Cancelar</button>
    </div>
  </div>`
}

export const PantallaCarga = () => html`<div class="carga"><${Logo} tam=${72} /></div>`
